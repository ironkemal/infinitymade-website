#!/bin/sh
# OTOMATIK TAZELEME (06.11.2026): kod degistiren her commit'te fonksiyon
# haritasini (funktionen/INDEX.json + INDEX.md) yeniden uretir ve commit'e ekler.
#
# Neden kapi degil de tazeleme: harita 12.08.2026'dan beri "ayni commit'te tazele"
# kuraliyla yasiyordu ve elle tetiklendigi icin surekli bayatliyordu (06.11.2026'da
# yine `--check` "Harita eskimis" dedi). Reddeden bir kapi herkesi elle ayni komutu
# kosmaya zorlardi; uretilen bir dosya icin bunu makine yapar.
#
# Bilinen sinir: uretici diski okur, staged durumu degil. Ayni depoda paralel bir
# oturumun commit edilmemis JS'i varsa harita onu da gorur. Harita turevdir,
# sonraki commit duzeltir — bu kabul edildi.
#
# Atlamak icin: SKIP_HARITA=1 git commit ...

[ "$SKIP_HARITA" = "1" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root" || exit 0

git diff --cached --name-only --diff-filter=ACMRD | grep -qE '\.(js|mjs|cjs|sh|ps1)$' || exit 0

node tools/funktionskarte.mjs --check >/dev/null 2>&1 && exit 0

node tools/funktionskarte.mjs >/dev/null || {
  echo "harita-tazele: tools/funktionskarte.mjs hata verdi, harita tazelenmedi"
  exit 0
}
git add funktionen/INDEX.json funktionen/INDEX.md
echo "harita-tazele: funktionen/INDEX.* tazelendi ve commit'e eklendi"
exit 0
