#!/bin/sh
# Sözdizimi kapısı — 28.09.2026 olayı
#
# Neden: module/podologie-abrechnung.js'te template literal içindeki bir HTML
# yorumuna backtick yazıldı -> SyntaxError -> dashboard.js modül grafiğini
# statik import ettiği için canlı dashboard tamamen boş kaldı. `npm test`
# yakalamadı (modül node'da import edilemiyor), diğer kapılar sözdizimine bakmaz.
#
# Ne yapar: staged .js/.mjs (ESM) ve .cjs (CommonJS) dosyalarının STAGED içeriğini
# (çalışma ağacını değil) `node --check` ile denetler.
# Hariç: node_modules/, archive/, vendor/, tools/vendor/
#
# Devre dışı (bilinçli istisna): SKIP_SYNTAX_GATE=1 git commit ...

[ "$SKIP_SYNTAX_GATE" = "1" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root" || exit 0

tmpdir=$(mktemp -d 2>/dev/null) || exit 0
trap 'rm -rf "$tmpdir"' EXIT

fail=0
list=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|mjs|cjs)$' \
       | grep -Ev '(^|/)(node_modules|archive|vendor)/|^tools/vendor/')

[ -z "$list" ] && exit 0

echo "$list" | while IFS= read -r f; do
  case "$f" in
    *.cjs) ext=cjs ;;
    *) ext=mjs ;;
  esac
  tmp="$tmpdir/check.$ext"
  git show ":$f" > "$tmp" 2>/dev/null || continue
  out=$(node --check "$tmp" 2>&1)
  if [ $? -ne 0 ]; then
    echo "SYNTAX-KAPISI: $f sözdizimi hatası içeriyor:" >&2
    echo "$out" | sed "s#$tmp#$f#g" >&2
    echo 1 > "$tmpdir/failed"
  fi
done

if [ -f "$tmpdir/failed" ]; then
  echo "Commit reddedildi. Atlamak için: SKIP_SYNTAX_GATE=1 git commit ..." >&2
  exit 1
fi
exit 0
