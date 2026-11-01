#!/bin/sh
# Spalten-Kapi: .from('t').select('...') und Filter gegen db/SCHEMA.sql.
# Gerekce ve kapsam: tools/check-select-spalten.mjs basligi.
# Devre disi (bilincli istisna): SKIP_SPALTEN_GATE=1 git commit ...

[ "$SKIP_SPALTEN_GATE" = "1" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root" || exit 0

git cat-file -e :db/SCHEMA.sql 2>/dev/null || exit 0
git diff --cached --name-only --diff-filter=ACMR | grep -qE '\.(js|mjs|cjs)$' || exit 0

node tools/check-select-spalten.mjs
