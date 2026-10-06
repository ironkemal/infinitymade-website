#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — Inhaber-Passwort zuruecksetzen (KHS K2.4, O-107)
# ════════════════════════════════════════════════════════════════════════════
#
#  Die Box verschickt keine Mails (O-142) — "Passwort vergessen" per Mail gibt
#  es hier nicht. Wer root auf diesem Server ist, setzt damit das Passwort des
#  PRAXISINHABERS neu (nur dieses eine Konto, aus praxura_setup — keine
#  E-Mail-Abfrage). Alle offenen Sitzungen des Inhabers werden beendet.
#  Mitarbeiter: der Inhaber vergibt im Dashboard einen neuen Einrichtungscode.
#
#  Aufruf:  sudo bash reset-owner-passwort.sh
#           (leer lassen → ein sicheres Passwort wird erzeugt und EINMAL gezeigt)
#
#  Das Passwort geht ueber stdin an den api-Container — nie als Argument
#  (in `ps` sichtbar) und nie in eine Logdatei.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

fail() { printf '\n  ✗ %s\n      Was tun: %s\n\n' "$1" "$2" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Kein Root" "Mit 'sudo bash reset-owner-passwort.sh' erneut starten."
[ -t 0 ] || fail "Kein interaktives Terminal" "Direkt in einer Terminal-/SSH-Sitzung ausführen, nicht über eine Pipe."
[ -f .env ] || fail ".env nicht gefunden in $SCRIPT_DIR" "Im Installationsverzeichnis der Box ausführen (dort, wo install.sh liegt)."
command -v docker >/dev/null 2>&1 || fail "docker nicht gefunden" "Läuft die Box auf diesem Rechner?"

status="$(docker compose ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk '$1=="api"{print $2}')"
[ "$status" = "running" ] || fail "Der Dienst 'api' läuft nicht (Status: ${status:-unbekannt})" "'docker compose up -d' und erneut versuchen."

echo ""
echo "  Praxura — Passwort des Praxisinhabers neu setzen"
echo "  (leer lassen = sicheres Passwort erzeugen lassen)"
echo ""
read -r -s -p "  Neues Passwort: " pw1; echo
erzeugt=0
if [ -z "$pw1" ]; then
  # 18 Byte → 24 Zeichen base64, ohne Sonderzeichen-Ärger beim Abtippen
  pw1="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  erzeugt=1
else
  read -r -s -p "  Wiederholen:     " pw2; echo
  [ "$pw1" = "$pw2" ] || fail "Die Eingaben stimmen nicht überein" "Erneut starten."
  # Frühe Warnung; die verbindliche Prüfung macht owner-passwort-reset.mjs aus der Backend-Regel (onprem: Bundle und Image werden getrennt aktualisiert).
  [ "${#pw1}" -ge 12 ] || fail "Passwort zu kurz (mindestens 12 Zeichen)" "Erneut starten."
fi

set +e
ausgabe="$(printf '%s\n' "$pw1" | docker compose exec -T api node setup/owner-passwort-reset.mjs 2>&1)"
code=$?
set -e

case "$code" in
  0) ;;
  2) fail "Noch kein Inhaber angelegt" "Erst den Einrichtungsassistenten im Browser abschließen." ;;
  3) fail "Das Inhaberkonto ist gelöscht" "Kein Zurücksetzen möglich — Support kontaktieren." ;;
  *) fail "Zurücksetzen fehlgeschlagen: $ausgabe" "'docker compose logs api' prüfen." ;;
esac

echo ""
echo "  [ok] $ausgabe"
if [ "$erzeugt" -eq 1 ]; then
  echo ""
  echo "  ════════════════════════════════════════════"
  echo "  Neues Passwort (wird nicht erneut angezeigt):"
  echo ""
  echo "    $pw1"
  echo ""
  echo "  ════════════════════════════════════════════"
fi
echo ""
echo "  Jetzt im Browser anmelden und das Passwort bei Bedarf unter"
echo "  Einstellungen ändern."
echo ""
