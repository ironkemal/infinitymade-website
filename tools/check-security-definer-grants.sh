#!/bin/sh
# S-04-Kapı — verhindert den stillen Rückfall von SECURITY-DEFINER-Rechten.
#
# Warum: in Postgres setzt CREATE FUNCTION (auch CREATE OR REPLACE FUNCTION)
# das EXECUTE-Recht für PUBLIC zurück auf die Vorgabe — jeder frühere REVOKE
# ist damit stillschweigend weg, kein Fehler, kein roter Test. Genau das
# passierte bei get_gmail_token/set_gmail_token/clear_gmail_token (S-01/S-02,
# seit 11.06.2026 offen, geschlossen 11.09.2026 mit 0001) und bei
# naechste_nummer/naechste_verordnungsnummer (S-24, 0002, selber Tag). guvenlik
# hat danach ausdrücklich festgehalten: "0001 heilt sich nicht selbst — eine
# künftige Migration, die eine dieser Funktionen per DROP+CREATE ersetzt, holt
# das Recht sofort zurück, in der Cloud UND in jeder Kundenbox, ohne dass
# irgendeine Prüfung anschlägt."
#
# Regel: wer eine der unten gelisteten Funktionen in einer neuen Migrations-
# Datei per CREATE (OR REPLACE) FUNCTION neu anlegt, MUSS in derselben Datei
# auch REVOKE EXECUTE ... FROM PUBLIC für dieselbe Funktion schreiben. Sonst
# bricht der Commit ab.
#
# Kapsam: nur api-backend/db/migrations/*.sql (die ausführbare Kette) — nicht
# db/SCHEMA*.sql (Dokument, kein Code) und nicht die 0000-Baseline (bekannt,
# eigener Fund, hier nicht erneut gemeldet).
#
# Liste erweitern: neue SECURITY-DEFINER-Funktion mit Mandanten-Argument statt
# auth.uid()-Check und PII/Credential/Geld-Bezug -> hier eintragen. Die Liste
# ist bewusst eine Allowlist mit Begründung, kein automatischer Scan über alle
# Funktionen (der wäre zu breit und würde legitime service_role-only-Funktionen
# mit erfassen, die nie PUBLIC hatten).
#
# Devre dışı (bilinçli istisna): SKIP_SECDEF_GATE=1 git commit ...

set -e

repo_root=$(git rev-parse --show-toplevel)
checker="$repo_root/tools/check-security-definer-grants.mjs"

[ "$SKIP_SECDEF_GATE" = "1" ] && exit 0

files=$(git diff --cached --name-only --diff-filter=ACM -- 'api-backend/db/migrations/*.sql' \
          ':(exclude)api-backend/db/migrations/0000_baseline.sql' || true)

[ -z "$files" ] && exit 0

node "$checker" $(printf '%s\n' "$files")
