#!/bin/sh
# S-56-Kapı (onprem O-181 a) — verhindert den Rückfall von anon-Rechten auf profiles.
#
# Warum: bis 09.10.2026 hatte anon Tabellenrechte auf alle 87 Spalten von
# profiles (IBAN, E-Mail, Steuernummer …); profiles_public war nur Konvention.
# 0072 hat das auf Spaltenrechte umgestellt. Zwei Wege führen zurück:
#   (1) GRANT … ON ALL TABLES IN SCHEMA public TO anon
#   (2) GRANT SELECT/ALL ON public.profiles TO anon ohne Spaltenliste
# und ein dritter bricht still die Buchungsseite:
#   (3) profiles_public neu angelegt, aber die neuen Spalten nicht an anon gegeben
#       (Sicht ist security_invoker → anon braucht das Spaltenrecht selbst).
#
# Kapsam: gestagte api-backend/db/migrations/*.sql ohne 0000_baseline.
# Devre dışı (bilinçli istisna): SKIP_ANON_GRANT_GATE=1 git commit ...

set -e

repo_root=$(git rev-parse --show-toplevel)

[ "$SKIP_ANON_GRANT_GATE" = "1" ] && exit 0

files=$(git diff --cached --name-only --diff-filter=ACM -- 'api-backend/db/migrations/*.sql' \
          ':(exclude)api-backend/db/migrations/0000_baseline.sql' || true)

[ -z "$files" ] && exit 0

node "$repo_root/tools/check-anon-grants.mjs" $(printf '%s\n' "$files")
