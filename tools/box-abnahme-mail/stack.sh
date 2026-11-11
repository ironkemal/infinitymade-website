#!/bin/bash
# Lokale Box-nahe Umgebung für die E-Mail-Versand-Abnahme (AUFTRAG-MAILVERSAND): supabase/postgres + storage-api + gotrue + postgrest
# aus lokalen Images (--pull=never), Migrationskette mit dem ECHTEN api-backend/db/migrate.js, Gateway als Ersatz für Kong (gateway.mjs).
# Eigene Container-Namen praxura-abn-* und Ports 54610–54613 (nur 127.0.0.1); berührt keinen anderen Supabase-Stack. Nur synthetische Geheimnisse.
# Aufruf: stack.sh up <BOX_DIR> | stack.sh down
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
DB=praxura-abn-db; ST=praxura-abn-st; AU=praxura-abn-auth; RE=praxura-abn-rest
PDB=${ABN_PORT_DB:-54610}; PREST=${ABN_PORT_REST:-54611}; PAUTH=${ABN_PORT_AUTH:-54612}; PGW=${ABN_PORT_GATEWAY:-54613}
weg() { docker rm -f $RE $AU $ST $DB >/dev/null 2>&1 || true; }
case "${1:-}" in
  down) weg; echo "Stack entfernt"; exit 0 ;;
  up) ;;
  *) echo "Aufruf: $0 up <BOX_DIR> | down"; exit 2 ;;
esac
BOX="${2:?BOX_DIR fehlt}"; mkdir -p "$BOX"
PW="abn-local-only-$RANDOM$RANDOM"; JWT="abn-local-jwt-secret-not-real-$RANDOM$RANDOM$RANDOM$RANDOM"
weg
V=$REPO/onprem/volumes/db
docker run -d --pull=never --name $DB -p 127.0.0.1:$PDB:5432 -p 127.0.0.1:$PREST:3000 -p 127.0.0.1:$PAUTH:9999 --tmpfs /var/lib/postgresql/data \
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
for i in $(seq 1 150); do docker exec $DB pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done; sleep 4
docker run -d --pull=never --network container:$DB --name $ST \
 -e ANON_KEY=x -e SERVICE_KEY=x -e POSTGREST_URL=http://127.0.0.1:3000 -e AUTH_JWT_SECRET=$JWT \
 -e DATABASE_URL=postgres://supabase_storage_admin:$PW@127.0.0.1:5432/postgres -e FILE_SIZE_LIMIT=52428800 \
 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/tmp/storage -e TENANT_ID=stub -e REGION=stub -e GLOBAL_S3_BUCKET=stub \
 -e ENABLE_IMAGE_TRANSFORMATION=false supabase/storage-api:v1.74.0 >/dev/null
n=0; for i in $(seq 1 90); do
  n=$(docker exec $DB psql -U supabase_admin -h localhost -d postgres -At -c "select count(*) from pg_tables where schemaname='storage' and tablename='objects'" 2>/dev/null || echo 0)
  [ "$n" = "1" ] && break; sleep 1; done
[ "$n" = "1" ] || { echo "storage.objects fehlt"; exit 1; }
# Migrationskette mit dem echten migrate.js (README ausgenommen)
mkdir -p "$BOX/migrations"; cp "$REPO"/api-backend/db/migrations/[0-9]*.sql "$BOX/migrations/"
cat > "$BOX/migrate-run.mjs" <<JS
import { runMigrations } from '$REPO/api-backend/db/migrate.js';
const r = await runMigrations({ databaseUrl: 'postgres://supabase_admin:$PW@127.0.0.1:$PDB/postgres', verzeichnis: '$BOX/migrations', appVersion: 'box-abnahme-lokal', log: () => {} });
console.log(JSON.stringify({ status: r.status, angewandt: r.angewandt?.length, letzte: r.angewandt?.at(-1)?.name, fehler: r.fehler }));
if (r.status === 'fehler') process.exit(1);
JS
( cd "$REPO/api-backend" && node "$BOX/migrate-run.mjs" )
docker run -d --pull=never --network container:$DB --name $AU \
 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:$PGW -e GOTRUE_DB_DRIVER=postgres \
 -e GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:$PW@127.0.0.1:5432/postgres -e GOTRUE_SITE_URL=http://127.0.0.1:$PGW \
 -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
 -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_SECRET=$JWT -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_PASSWORD_MIN_LENGTH=8 \
 supabase/gotrue:v2.196.0 >/dev/null
docker run -d --pull=never --network container:$DB --name $RE \
 -e PGRST_DB_URI=postgres://authenticator:$PW@127.0.0.1:5432/postgres -e PGRST_DB_SCHEMAS=public,storage -e PGRST_DB_ANON_ROLE=anon \
 -e PGRST_JWT_SECRET=$JWT -e PGRST_DB_USE_LEGACY_GUCS=false -e PGRST_ADMIN_SERVER_PORT=3001 -e PGRST_ADMIN_SERVER_HOST=localhost \
 postgrest/postgrest:v14.17 postgrest >/dev/null
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:$PAUTH/health && curl -s -o /dev/null "http://127.0.0.1:$PREST/praxis_mailversand?limit=1" && break; sleep 1; done
cat > "$BOX/env.json" <<JS
{"pw":"$PW","jwt":"$JWT","pdb":$PDB,"prest":$PREST,"pauth":$PAUTH,"pgw":$PGW,"db":"$DB"}
JS
echo "Stack oben (Gateway-Port $PGW)"
