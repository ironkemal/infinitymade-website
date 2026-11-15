#!/bin/bash
# Box-nahe Messung: supabase/postgres:17.6.1.136 + supabase/storage-api:v1.74.0 (lokale Images, --pull=never),
# DB ohne Netzwerk, Storage im selben Netzwerk-Namespace, Init-Skripte wie onprem/docker-compose.yml (inkl.
# no-pg-net). Unveraenderte Originaldateien + unveraenderter migrate.js/schema-zaehler.js, zwei Laeufe,
# Ledger-SHA-Vergleich, Zaehler; optional DB-Tests (TESTS_B="a.test.sql b.test.sql").
# Geheimnisse nur zufaellig lokal erzeugt. Keine GoTrue-/Signup-/Stack-Abnahme.
# Aufruf aus dem Repo: tools/db-vollkette/vollkette-box.sh
set -euo pipefail
P="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$P/../.." && pwd)"; W="$(mktemp -d)"
S="$(date +%s)-$RANDOM"; DB="praxura-proof-b-db-$S"; ST="praxura-proof-b-st-$S"
PW="local-proof-only-$RANDOM$RANDOM"; JWT="local-proof-jwt-secret-not-real-$RANDOM$RANDOM$RANDOM"
cleanup(){ docker rm -f "$ST" "$DB" >/dev/null 2>&1 || true; }; trap cleanup EXIT
V=$REPO/onprem/volumes/db
docker run -d --pull=never --network none --name "$DB" --tmpfs /var/lib/postgresql/data \
 -v $V/realtime.sql:/docker-entrypoint-initdb.d/migrations/99-realtime.sql:ro \
 -v $V/webhooks.sql:/docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql:ro \
 -v $V/no-pg-net.sql:/docker-entrypoint-initdb.d/init-scripts/98a-no-pg-net.sql:ro \
 -v $V/roles.sql:/docker-entrypoint-initdb.d/init-scripts/99-roles.sql:ro \
 -v $V/jwt.sql:/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql:ro \
 -v $V/praxura-rollen.sql:/docker-entrypoint-initdb.d/init-scripts/99a-praxura-rollen.sql:ro \
 -v $V/_supabase.sql:/docker-entrypoint-initdb.d/migrations/97-_supabase.sql:ro \
 -e POSTGRES_HOST=/var/run/postgresql -e PGPORT=5432 -e POSTGRES_PORT=5432 -e PGPASSWORD=$PW -e POSTGRES_PASSWORD=$PW \
 -e PG_AUTHENTICATOR_PASSWORD=$PW -e PG_AUTH_ADMIN_PASSWORD=$PW -e PG_STORAGE_ADMIN_PASSWORD=$PW \
 -e PGDATABASE=postgres -e POSTGRES_DB=postgres -e JWT_SECRET=$JWT -e JWT_EXP=3600 \
 supabase/postgres:17.6.1.136 postgres -c config_file=/etc/postgresql/postgresql.conf -c log_min_messages=fatal >/dev/null
for i in $(seq 1 150); do docker exec "$DB" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done; sleep 3
docker exec "$DB" pg_isready -U postgres -h localhost
echo "logs $W"; echo "public tables before: $(docker exec "$DB" psql -U supabase_admin -h localhost -d postgres -At -c "select count(*) from information_schema.tables where table_schema='public'")"
docker run -d --pull=never --network container:"$DB" --name "$ST" \
 -e ANON_KEY=x -e SERVICE_KEY=x -e POSTGREST_URL=http://127.0.0.1:3000 -e AUTH_JWT_SECRET=$JWT \
 -e DATABASE_URL=postgres://supabase_storage_admin:$PW@127.0.0.1:5432/postgres -e FILE_SIZE_LIMIT=52428800 \
 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/tmp/storage -e TENANT_ID=stub -e REGION=stub -e GLOBAL_S3_BUCKET=stub \
 -e ENABLE_IMAGE_TRANSFORMATION=false supabase/storage-api:v1.74.0 >/dev/null
for i in $(seq 1 90); do
  n=$(docker exec "$DB" psql -U supabase_admin -h localhost -d postgres -At -c "select count(*) from pg_tables where schemaname='storage' and tablename='objects'" 2>/dev/null || echo 0)
  [ "$n" = "1" ] && docker logs "$ST" 2>&1 | grep -qiE "listening|started|Server listening" && break; sleep 1; done
echo "storage.objects: $n"; docker logs "$ST" 2>&1 | tail -3
mkdir -p "$W/b"
cp -R "$REPO/api-backend/db/migrations" "$W/b/migrations"; rm -f "$W/b/migrations/README.md"
cp "$REPO/api-backend/db/migrate.js" "$REPO/api-backend/db/schema-zaehler.js" "$REPO/api-backend/db/erwartete-zaehler.json" "$P/migrate-zweimal.mjs" "$W/b/"
echo '{"type":"module"}' > "$W/b/package.json"
docker cp "$W/b" "$ST:/tmp/praxura-p"
docker exec -u 0 "$ST" sh -c 'ln -sfn /app/node_modules /tmp/praxura-p/node_modules'
docker exec -e PROOF_DB_URL="postgres://supabase_admin:$PW@127.0.0.1:5432/postgres" -w /tmp/praxura-p "$ST" node migrate-zweimal.mjs
docker cp "$ST:/tmp/praxura-p/result.json" "$W/result-b.json"
echo "=== ledger sha vs original"
docker exec "$DB" psql -U supabase_admin -h localhost -d postgres -At -c "select version||' '||checksum from praxura_migrations order by version" > "$W/ledger-b.txt"
( cd "$REPO/api-backend/db/migrations" && for f in [0-9]*.sql; do echo "${f:0:4} $(shasum -a 256 "$f" | cut -d' ' -f1)"; done ) > "$W/orig-sha.txt"
diff "$W/ledger-b.txt" "$W/orig-sha.txt" && echo "LEDGER == ORIGINAL ($(wc -l < "$W/orig-sha.txt") files)"
docker exec "$DB" psql -U supabase_admin -h localhost -d postgres -At -c "select string_agg(extname,',' order by extname) from pg_extension"
docker exec -i "$DB" psql -U supabase_admin -h localhost -d postgres -At < "$P/zaehler.sql"
if [ -n "${TESTS_B:-}" ]; then
  docker cp "$REPO/api-backend/db/tests" "$DB:/tmp/tests"
  for t in $TESTS_B; do docker exec "$DB" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -f /tmp/tests/$t > "$W/b-$t.log" 2>&1; echo "B $t exit=$? PASS=$(grep -c PASS "$W/b-$t.log") ERR=$(grep -cE 'FAIL|ERROR' "$W/b-$t.log")"; done
fi
