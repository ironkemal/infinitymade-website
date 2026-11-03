#!/bin/sh
# Tanimsiz-Kapi: Prueft dashboard.js und module/*.js auf undeklarierte Bezeichner
# Anlass: ReferenceError `g is not defined` in saveRezept (dashboard.js:13676)
# Devre disi (bilincli istisna): SKIP_TANIMSIZ_GATE=1 git commit ...

[ "$SKIP_TANIMSIZ_GATE" = "1" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root" || exit 0

git diff --cached --name-only --diff-filter=ACMR | grep -qE '(^dashboard\.js$|^module/.*\.js$)' || exit 0

node tools/check-tanimsiz.mjs
