#!/bin/bash
# Vollkette in Wegwerf-PostgreSQL 17.11 (lokales Image, --pull=never, --network none, tmpfs).
# Wendet 0000..NNNN wie migrate.js an (EINE Sitzung, je Datei BEGIN/COMMIT + Ledgerzeile), misst die
# schema-zaehler-Werte vor STOP/SPLIT und danach, fuehrt danach die DB-Tests aus.
# Plattform (GoTrue/Storage/Vault/Realtime/Rollen) ist hier ein STUB (plattform-stub.sql), PostGIS ein
# Namens-Stub (postgis--0.0.0.sql: geography = domain over text). Einzige Abweichung an den Originaldateien:
# in einer KOPIE der Baseline wird `public.geography(Point,4326)` zu `public.geography` (Stub kann keine Typmods).
# Fuer die box-nahe Messung mit echtem migrate.js: vollkette-box.sh.
# Aufruf aus dem Repo: tools/db-vollkette/vollkette-pg17.sh   (ENV: STOP_AT=0111 SPLIT=0112 KEEP=1)
# Nur synthetische Daten; der Container wird am Ende entfernt (ausser KEEP=1).
set -euo pipefail
P="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$P/../.." && pwd)"; W="$(mktemp -d)"
N="praxura-proof-a-$(date +%s)-$RANDOM"
echo "container $N · logs $W"
cleanup(){ docker rm -f "$N" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --pull=never --network none --tmpfs /var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust --name "$N" postgres:17.11 >/dev/null
for i in $(seq 1 100); do docker logs "$N" 2>&1 | grep -q "init process complete" && docker exec "$N" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 0.2; done
docker cp "$P/postgis.control" "$N:/usr/share/postgresql/17/extension/postgis.control"
docker cp "$P/postgis--0.0.0.sql" "$N:/usr/share/postgresql/17/extension/postgis--0.0.0.sql"
mkdir -p "$W/probe/api-backend/db" "$W/probe/db"
cp -R "$REPO/api-backend/db/migrations" "$REPO/api-backend/db/tests" "$W/probe/api-backend/db/"
cp -R "$REPO/db/entwuerfe" "$W/probe/db/"
# Only disclosed deviation from original chain: PostGIS typmod removed in the COPY (stub domain cannot take typmods).
python3 - "$W/probe/api-backend/db/migrations/0000_baseline.sql" <<'PY'
import sys,pathlib; p=pathlib.Path(sys.argv[1]); t=p.read_text(); n=t.count('public.geography(Point,4326)'); assert n==2,n
p.write_text(t.replace('public.geography(Point,4326)','public.geography'))
PY
cp "$P/plattform-stub.sql" "$P/zaehler.sql" "$W/probe/"
python3 "$P/kette-treiber.py" "$W/probe/api-backend/db/migrations" "$W/probe/driver.sql" "${SPLIT:-0112}"
docker cp "$W/probe" "$N:/probe"
docker exec "$N" createdb -U postgres praxura
docker exec "$N" psql -U postgres -d praxura -q -v ON_ERROR_STOP=1 -f /probe/plattform-stub.sql
docker exec "$N" psql -U postgres -d praxura -q -At -v ON_ERROR_STOP=1 -f /probe/driver.sql 2>&1 | grep -vE "^APPLY|NOTICE|there is (already|no) a transaction" | tail -40
echo "=== ledger"; docker exec "$N" psql -U postgres -d praxura -At -c "SELECT count(*), max(version) FROM praxura_migrations"
run_t(){ # $1 file, rest psql vars
  local f="$1"; shift
  docker exec "$N" psql -U postgres -d praxura -v ON_ERROR_STOP=1 "$@" -f "/probe/api-backend/db/tests/$f" > "$W/log-$f${1:+-mode}.log" 2>&1; local rc=$?
  printf '%-58s exit=%s PASS=%s FAIL/ERROR=%s\n' "$f $*" "$rc" "$(grep -c 'PASS' "$W/log-$f${1:+-mode}.log")" "$(grep -cE 'FAIL|ERROR' "$W/log-$f${1:+-mode}.log")"
}
set +e
echo "=== REGRESSION (pre-existing chain tests, unchanged files)"
for f in 0079_ausfall_zahlung 0081_ausfall_zahlung 0080_request_approve_atomic 0082_request_approve_atomic 0085_request_approve_lead 0081_security_boundaries 0092_planung_rechte 0097_employee_standort_plan 0106_sondertag_sperre 0109_standort_plan_zeitfenster; do run_t $f.test.sql; done
echo "=== NEW (0112-0115)"
run_t 0112_prescriptions_entlassmanagement.test.sql
run_t 0114_zaa_import_idempotenz.test.sql
run_t 0115_physio_storage_direktzugriff.test.sql
run_t physio-publikation-v1.test.sql
run_t physio-publikation-v1.test.sql -v physio_keep_fixture=1 -v physio_concurrency=1
set -e
if [ -n "${KEEP:-}" ]; then trap - EXIT; echo "kept $N"; fi
