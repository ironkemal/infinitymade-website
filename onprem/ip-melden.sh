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
#  Kein Netzaufruf, keine Geheimnisse.
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./lib-ip.sh
source "$SCRIPT_DIR/lib-ip.sh"

MODUS_DATEI="$SCRIPT_DIR/volumes/ip/modus"
LAN_IP_DATEI="$SCRIPT_DIR/volumes/ip/lan-ip"

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
