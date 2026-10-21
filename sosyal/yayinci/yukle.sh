#!/usr/bin/env bash
# Überträgt Code + Inhalte + fertige Medien auf den merkez-VPS und (re)startet den Veröffentlicher (systemd).
# Aufruf (Repo-Wurzel, Git Bash): bash sosyal/yayinci/yukle.sh
# Jedes Mal, wenn eine neue Inhaltsrunde gerendert ist. Bereits gepostete Tage bleiben im Zustand (/var/lib).
# Server-Layout: /opt/praxura-sosyal/{app,inhalt,medien} · /etc/praxura-sosyal/sosyal.env · /var/lib/praxura-sosyal
set -euo pipefail
cd "$(dirname "$0")/../.."
SSH=${SSH:-/c/Windows/System32/OpenSSH/ssh.exe}   # Windows-ssh sieht den ssh-agent (Git-Bash-ssh nicht)
HOST=${HOST:-praxura-merkez}
ZIEL=/opt/praxura-sosyal

node sosyal/yayinci/yayinci.mjs --pruefe 14 >/dev/null || echo "⚠ In den nächsten 14 Tagen fehlt Inhalt (Details: node sosyal/yayinci/yayinci.mjs --pruefe 14)"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/app"
cp sosyal/yayinci/*.mjs "$tmp/app/"; rm -f "$tmp/app/"*.test.mjs
cp sosyal/yayinci/praxura-sosyal.service "$tmp/"
[ -f sosyal/yayinci/.env ] && cp sosyal/yayinci/.env "$tmp/sosyal.env"
for j in sosyal/20[0-9][0-9]; do
  y=$(basename "$j"); mkdir -p "$tmp/inhalt/$y" "$tmp/medien/$y"
  cp "$j"/*.json "$tmp/inhalt/$y/"
  for f in sosyal/ausgabe/"$y"/*; do
    case "$f" in *-stumm.mp4|*-vorschau.png|*/galerie.html|*.txt) ;; *) cp "$f" "$tmp/medien/$y/";; esac
  done
done
echo "Übertrage $(du -sh "$tmp" | cut -f1) nach $HOST:$ZIEL …"

tar -C "$tmp" -czf - . | "$SSH" -o BatchMode=yes "$HOST" "set -e
  id sosyal >/dev/null 2>&1 || sudo useradd --system --no-create-home --shell /usr/sbin/nologin sosyal
  sudo mkdir -p $ZIEL /etc/praxura-sosyal
  sudo rm -rf $ZIEL/app && sudo tar -xzf - -C $ZIEL --no-same-owner
  sudo chown -R root:root $ZIEL && sudo chmod -R go-w $ZIEL
  if [ -f $ZIEL/sosyal.env ]; then
    sudo install -m 640 -o root -g sosyal $ZIEL/sosyal.env /etc/praxura-sosyal/sosyal.env && sudo rm -f $ZIEL/sosyal.env
  elif [ ! -f /etc/praxura-sosyal/sosyal.env ]; then
    sudo install -m 640 -o root -g sosyal /dev/null /etc/praxura-sosyal/sosyal.env
    echo '⚠ Noch keine Zugangsdaten — der Dienst läuft im Trockenmodus und veröffentlicht nichts.'
  fi
  sudo install -m 644 $ZIEL/praxura-sosyal.service /etc/systemd/system/praxura-sosyal.service && sudo rm -f $ZIEL/praxura-sosyal.service
  sudo systemctl daemon-reload
  sudo systemctl enable praxura-sosyal >/dev/null 2>&1
  sudo systemctl restart praxura-sosyal
  sleep 3
  systemctl is-active praxura-sosyal
  sudo journalctl -u praxura-sosyal -n 4 --no-pager -o cat"
