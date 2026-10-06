#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — geteilte IP-Ermittlung (K2b.6, O-161 / L2, L3, L10)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 06.10.2026 · Auftrag K2b.6 (onprem/REGISTER.md O-161 L3, L10):
#  install.sh und ip-melden.sh sourcen dieselbe Logik, damit die IP-Ermittlung
#  bei Erstinstallation und periodischem Abgleich identisch arbeitet und kein
#  Drift entsteht.
#
#  L2: Kein Fallback auf andere Schnittstellen (z. B. Docker-Bridges mit 172.17.0.1).
#  Ermittelt ausschließlich die IPv4 der Schnittstelle mit der Default-Route.
#
#  L10: ip_modus_yaz und ip_timer_kur in lib-ip gebündelt; install.sh und
#  update.sh nutzen dieselben Funktionen.
#
#  Keine Seiteneffekte beim Sourcen, kein Logging, nur Rückgabecodes.
#  set -euo pipefail-fest.
# ════════════════════════════════════════════════════════════════════════════

# IPv4 der Schnittstelle der Default-Route ermitteln
lan_ip_ermitteln() {
  local dev ip
  dev="$(ip -4 route show default 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}' || true)"
  if [ -n "$dev" ]; then
    ip="$(ip -4 -o addr show dev "$dev" scope global 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="inet"){sub(/\/.*/, "", $(i+1)); print $(i+1); exit}}' || true)"
    printf '%s' "$ip"
    return 0
  fi
  printf ''
}

# Prüft, ob eine IPv4-Adresse im privaten RFC1918-Bereich liegt (10/8, 172.16-31, 192.168/16)
ist_rfc1918() {
  local ip="${1:-}"
  case "$ip" in
    10.*) return 0 ;;
    192.168.*) return 0 ;;
    172.1[6-9].*|172.2[0-9].*|172.3[0-1].*) return 0 ;;
    *) return 1 ;;
  esac
}

# Legt den IP-Modus (lan / internet) atomar fest (K2b.6, O-161 L1, L5, L10).
# Modus wird ausschließlich aus der übergebenen IP abgeleitet (L1: nie aus leerer IP).
# Rückgabewerte:
#   0: Modus erfolgreich geschrieben (gibt Modus auf stdout aus)
#   1: lan_ip ist leer (L1: niemals Modus aus leerer IP ableiten)
#   4: Schreibfehler (mkdir, chmod, write, mv)
ip_modus_yaz() {
  local ip_dir="${1:-}"
  local lan_ip="${2:-}"
  local modus

  [ -n "$lan_ip" ] || return 1

  if ist_rfc1918 "$lan_ip"; then
    modus="lan"
  else
    modus="internet"
  fi

  mkdir -p "$ip_dir" || return 4
  chmod 0755 "$ip_dir" || return 4

  printf '%s\n' "$modus" > "$ip_dir/modus.tmp" || return 4
  chmod 0644 "$ip_dir/modus.tmp" || return 4
  mv -f "$ip_dir/modus.tmp" "$ip_dir/modus" || return 4

  if [ "$modus" = "lan" ]; then
    printf '%s\n' "$lan_ip" > "$ip_dir/lan-ip.tmp" || return 4
    chmod 0644 "$ip_dir/lan-ip.tmp" || return 4
    mv -f "$ip_dir/lan-ip.tmp" "$ip_dir/lan-ip" || return 4
  fi

  printf '%s' "$modus"
  return 0
}

# Richtet den periodischen Host-Timer praxura-ip.timer ein (K2b.6, O-161 L10).
# Reihenfolge der Prüfungen:
#   1: [ -f "<script_dir>/volumes/ip/modus" ] || return 2 (kein Modus -> nichts einrichten)
#   2: [ "$(id -u)" = "0" ] || return 3 (nicht root)
#   3: command -v systemctl >/dev/null 2>&1 || return 1 (kein systemctl)
#   4: Schreib-/systemd-Fehler -> return 4
# Erfolg -> return 0.
#
# Wichtig (onprem-Bedingung 1): Jeder Schritt explizit mit '|| return' geprüft.
# Grund: Wird die Funktion im Aufrufer im 'if'- oder '||'-Kontext aufgerufen,
# ist errexit (set -e) darin deaktiviert. Ohne explizite Prüfung käme ein falsches ok.
#
# Idempotenz: Units werden bei jedem Aufruf neu geschrieben (Inhalt kann sich mit
# einem Update ändern); 'enable --now' auf einen aktiven Timer ist harmlos.
# Ein vom Kunden absichtlich deaktivierter Timer wird dadurch wieder aktiviert —
# bewusst: der Timer ist Teil der Adressfunktion (O-161 L10); wer ihn nicht will,
# nutzt den Ausstiegsweg ohne Namensdienst (dann kein Modus -> return 2).
ip_timer_kur() {
  local script_dir="${1:-}"

  [ -f "$script_dir/volumes/ip/modus" ] || return 2
  [ "$(id -u)" = "0" ] || return 3
  command -v systemctl >/dev/null 2>&1 || return 1

  chmod +x "$script_dir/ip-melden.sh" "$script_dir/lib-ip.sh" 2>/dev/null || true

  cat > /etc/systemd/system/praxura-ip.service <<EOF || return 4
[Unit]
Description=Praxura On-Premise — LAN-IP ermitteln und bereitstellen (K2b.6, O-161)
After=network.target

[Service]
Type=oneshot
WorkingDirectory=${script_dir}
ExecStart=/bin/bash ${script_dir}/ip-melden.sh
EOF

  cat > /etc/systemd/system/praxura-ip.timer <<EOF || return 4
[Unit]
Description=Praxura On-Premise — periodische LAN-IP-Prüfung (Timer)

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
AccuracySec=15s

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload >/dev/null 2>&1 || return 4
  systemctl enable --now praxura-ip.timer >/dev/null 2>&1 || return 4

  return 0
}
