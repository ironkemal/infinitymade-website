#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — ip-melden.sh (Host-Timer, K2b.6 / L1, L2, L5)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 06.10.2026 · Auftrag K2b.6 (onprem/REGISTER.md O-161):
#  Host-seitiger periodischer Job (systemd: praxura-ip.timer alle 2 Min).
#  Ermittelt die LAN-IP der Host-Maschine und schreibt sie atomar nach
#  volumes/ip/lan-ip, damit der Container (api) sie lesen und bei Merkez
#  abgleichen kann.
#
#  Kein Netzaufruf, keine Geheimnisse. Seit K2b.4b auch: LE-Konto-URL → volumes/ip/le-konto.
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./lib-ip.sh
source "$SCRIPT_DIR/lib-ip.sh"

MODUS_DATEI="$SCRIPT_DIR/volumes/ip/modus"
LAN_IP_DATEI="$SCRIPT_DIR/volumes/ip/lan-ip"
LE_KONTO_DATEI="$SCRIPT_DIR/volumes/ip/le-konto"

# ── K2b.4b (O-161 (9), guvenlik S-47 Nachtrag 08.10.2026): LE-Konto-URL für CAA accounturi ──
# caddy_data trägt die privaten Schlüssel (LE-Konto, Zertifikate) — darum liest HIER der Host
# genau die öffentliche Konto-JSON aus dem caddy-Container, und api sieht nur die URL
# (volumes/ip ist dort :ro). Nur Produktions-LE; genau EIN Konto, sonst nichts schreiben.
# Unabhängig vom IP-Modus (auch "internet"-Boxen brauchen CAA). Fehler → still weiter.
le_konto_melden() {
  local roh urls anzahl url alt
  [ -d "$SCRIPT_DIR/volumes/ip" ] || return 0
  roh="$(cd "$SCRIPT_DIR" && timeout -k 5 20 docker compose exec -T caddy sh -c \
    'cat /data/caddy/acme/acme-v02.api.letsencrypt.org-directory/users/*/*.json 2>/dev/null' 2>/dev/null || true)"
  [ -n "$roh" ] || return 0
  urls="$(printf '%s' "$roh" | grep -oE '"location"[[:space:]]*:[[:space:]]*"https://acme-v02\.api\.letsencrypt\.org/acme/acct/[0-9]{1,20}"' \
    | grep -oE 'https://acme-v02\.api\.letsencrypt\.org/acme/acct/[0-9]{1,20}' | sort -u || true)"
  anzahl="$(printf '%s' "$urls" | grep -c . || true)"
  if [ "$anzahl" != "1" ]; then
    [ "$anzahl" = "0" ] || printf '[praxura-ip] Warnung: %s LE-Konten gefunden — le-konto unveraendert\n' "$anzahl" >&2
    return 0
  fi
  url="$urls"
  find "$SCRIPT_DIR/volumes/ip" -maxdepth 1 -name 'le-konto.tmp.*' -mmin +60 -delete 2>/dev/null || true
  alt="$(tr -d '[:space:]' < "$LE_KONTO_DATEI" 2>/dev/null || true)"
  [ "$url" = "$alt" ] && return 0
  printf '%s\n' "$url" > "$LE_KONTO_DATEI.tmp.$$"
  chmod 0644 "$LE_KONTO_DATEI.tmp.$$"
  mv -f "$LE_KONTO_DATEI.tmp.$$" "$LE_KONTO_DATEI"
}
le_konto_melden || true

# Fehlt die Datei oder steht nicht "lan" drin (z. B. "internet") → nichts tun
[ -f "$MODUS_DATEI" ] || exit 0

MODUS="$(tr -d '[:space:]' < "$MODUS_DATEI" 2>/dev/null || true)"
[ "$MODUS" = "lan" ] || exit 0

NEUE_IP="$(lan_ip_ermitteln)"

# Leer oder nicht RFC1918 → Datei NICHT anfassen, Warnzeile auf stderr, exit 0
if [ -z "$NEUE_IP" ] || ! ist_rfc1918 "$NEUE_IP"; then
  printf '[praxura-ip] Warnung: Keine gueltige RFC1918-LAN-IP ermittelt ("%s") — lan-ip unveraendert\n' "${NEUE_IP:-leer}" >&2
  exit 0
fi

# Aktueller Inhalt von lan-ip
AKTUELLE_IP=""
if [ -f "$LAN_IP_DATEI" ]; then
  AKTUELLE_IP="$(tr -d '[:space:]' < "$LAN_IP_DATEI" 2>/dev/null || true)"
fi

# Nur schreiben, wenn sich der Wert geaendert hat
if [ "$NEUE_IP" != "$AKTUELLE_IP" ]; then
  TMP_DATEI="$SCRIPT_DIR/volumes/ip/lan-ip.tmp.$$"
  printf '%s\n' "$NEUE_IP" > "$TMP_DATEI"
  chmod 0644 "$TMP_DATEI"
  mv -f "$TMP_DATEI" "$LAN_IP_DATEI"
fi

exit 0
