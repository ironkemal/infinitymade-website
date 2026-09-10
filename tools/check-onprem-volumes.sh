#!/bin/sh
# Vergleicht die Konfigurationsdateien in onprem/volumes/ mit der
# Upstream-Vendorkopie unter onprem/supabase-docker/volumes/.
#
# Zweck: Wir kopieren Fremdkonfiguration in unser Installationspaket. Zieht
# jemand die Vendorkopie hoch (neue Supabase-Version), sollen die Kopien nicht
# stillschweigend auf dem alten Stand bleiben. Register O-45.
#
# Aufruf: sh tools/check-onprem-volumes.sh
# Ausnahme: SKIP_VOLUMES_GATE=1

[ "$SKIP_VOLUMES_GATE" = "1" ] && exit 0

wurzel=$(git rev-parse --show-toplevel 2>/dev/null) || wurzel=.
cd "$wurzel" || exit 0

quelle="onprem/supabase-docker/volumes"
ziel="onprem/volumes"
[ -d "$quelle" ] || exit 0

# Nur unveraenderte Kopien. api/kong.yml wird erzeugt (tools/kong-trim.py) und
# ist absichtlich anders — der Erzeuger prueft sich selbst gegen die Quelle.
dateien="api/kong-entrypoint.sh db/realtime.sql db/roles.sql db/jwt.sql db/_supabase.sql db/webhooks.sql"

abweichung=""
for d in $dateien; do
  if [ ! -f "$ziel/$d" ]; then
    abweichung="$abweichung\n      fehlt im Paket:  $ziel/$d"
  elif [ ! -f "$quelle/$d" ]; then
    abweichung="$abweichung\n      fehlt upstream:  $quelle/$d"
  elif ! cmp -s "$quelle/$d" "$ziel/$d"; then
    abweichung="$abweichung\n      abweichend:      $d"
  fi
done

if [ -n "$abweichung" ]; then
  printf '\n  ⛔ On-Prem-Paket weicht von der Upstream-Vendorkopie ab:\n'
  printf "$abweichung\n"
  printf '\n  Upstream hat sich bewegt (oder jemand hat die Kopie von Hand angefasst).\n'
  printf '  Richtig ist: Kopie neu ziehen, den ganzen Stack einmal gegen eine leere\n'
  printf '  Datenbank testen, dann die Versionen in onprem/.env.template anheben.\n'
  printf '  Nur formal uebergehen: SKIP_VOLUMES_GATE=1 git commit …\n\n'
  exit 1
fi
exit 0
