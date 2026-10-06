#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — geteilte IP-Ermittlung (K2b.6, O-161 / L2, L3)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 06.10.2026 · Auftrag K2b.6 (onprem/REGISTER.md O-161 L3):
#  install.sh und ip-melden.sh sourcen dieselbe Logik, damit die IP-Ermittlung
#  bei Erstinstallation und periodischem Abgleich identisch arbeitet und kein
#  Drift entsteht.
#
#  L2: Kein Fallback auf andere Schnittstellen (z. B. Docker-Bridges mit 172.17.0.1).
#  Ermittelt ausschließlich die IPv4 der Schnittstelle mit der Default-Route.
#
#  Keine Seiteneffekte beim Sourcen, set -euo pipefail-fest.
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
