#!/usr/bin/env bash
# Holt den Veröffentlichungs-Zustand vom merkez-VPS und trägt Status + 7-Tage-Kennzahlen in sosyal/SOSYAL-LOG.md ein.
# Aufruf (Repo-Wurzel, Git Bash): bash sosyal/yayinci/bericht.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
SSH=${SSH:-/c/Windows/System32/OpenSSH/ssh.exe}
HOST=${HOST:-praxura-merkez}
tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
"$SSH" -o BatchMode=yes "$HOST" "sudo cat /var/lib/praxura-sosyal/zustand.json 2>/dev/null || echo '{}'" > "$tmp"
node sosyal/yayinci/log-aktualisieren.mjs "$tmp"
