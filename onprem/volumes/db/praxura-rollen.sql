-- ═══════════════════════════════════════════════════════════════════════════
--  Praxura — eigenes Passwort je Datenbankrolle (guvenlik S-21, KHS K2.6)
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Upstreams roles.sql (Vendorkopie, NICHT anfassen) gibt allen Dienstrollen
--  DASSELBE Passwort: POSTGRES_PASSWORD. Wer einen Dienst-Container
--  kompromittiert, kennt damit auch das Passwort von supabase_admin
--  (Superuser). Diese Datei laeuft DANACH (gemountet als 99a-…, sortiert hinter
--  99-roles.sql und 99-jwt.sql) und ueberschreibt die drei Rollen, die ein
--  Dienst wirklich benutzt, mit eigenen, in install.sh gewuerfelten Werten:
--
--    authenticator           ← rest     (PG_AUTHENTICATOR_PASSWORD)
--    supabase_auth_admin     ← auth     (PG_AUTH_ADMIN_PASSWORD)
--    supabase_storage_admin  ← storage  (PG_STORAGE_ADMIN_PASSWORD)
--
--  pgbouncer / supabase_functions_admin benutzt in der Box niemand (supavisor
--  und functions sind weggelassen, docker-compose.yml REGEL 2) — sie bekommen
--  ein Zufallspasswort, das nirgends gespeichert wird.
--
--  ⚠️ Bleibt BEWUSST bei POSTGRES_PASSWORD: supabase_admin (realtime + api
--  DATABASE_URL — beide brauchen Superuser-Rechte, Baseline ALTER DEFAULT
--  PRIVILEGES). S-21 ist damit fuer die drei Dienstrollen geschlossen, fuer
--  supabase_admin bewusst nicht (onprem-Vorpruefung 02.10.2026).
--
--  Rueckfall: fehlt eine der drei Variablen (z. B. eine aeltere .env), gilt
--  POSTGRES_PASSWORD — exakt das Verhalten von 99-roles.sql, nichts bricht.
--  Laeuft beim Erststart (initdb) UND nach jedem restore.sh (Schritt 6,
--  zusammen mit 99-roles.sql) — idempotent.

\set pw_rest    `echo "${PG_AUTHENTICATOR_PASSWORD:-$POSTGRES_PASSWORD}"`
\set pw_auth    `echo "${PG_AUTH_ADMIN_PASSWORD:-$POSTGRES_PASSWORD}"`
\set pw_storage `echo "${PG_STORAGE_ADMIN_PASSWORD:-$POSTGRES_PASSWORD}"`
\set pw_unbenutzt `head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'`

ALTER USER authenticator            WITH PASSWORD :'pw_rest';
ALTER USER supabase_auth_admin      WITH PASSWORD :'pw_auth';
ALTER USER supabase_storage_admin   WITH PASSWORD :'pw_storage';
ALTER USER pgbouncer                WITH PASSWORD :'pw_unbenutzt';
ALTER USER supabase_functions_admin WITH PASSWORD :'pw_unbenutzt';
