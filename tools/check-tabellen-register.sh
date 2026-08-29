#!/bin/sh
# KAPI: her veritabanı tablosunun db/REGISTER.md içinde bir kaydı olmalı.
#
# Neden var: yeni tablo açmak beş saniye sürer, "bu tablo neydi" sorusuna altı ay
# sonra cevap vermek imkânsızdır. Kayıt aynı commit'e girmezse hiç girmez.
#
# Yalnızca şema dökümü değiştiğinde çalışır — yani gerçekten tablo eklenmiş/silinmiş
# olabilecek commit'lerde. Her commit'te node çalıştırmanın anlamı yok.

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root" || exit 1

git diff --cached --name-only | grep -q '^db/SCHEMA\.sql$' || exit 0

command -v node >/dev/null 2>&1 || {
  echo "check-tabellen-register: node bulunamadi, kapi atlandi"
  exit 0
}

node tools/tabellenkarte.mjs --check || {
  echo ""
  echo "Kayit eksik. db/REGISTER.md icine sunu ekle (db-ustasi ajani yazar):"
  echo ""
  echo "  ### \`tablo_adi\`"
  echo "  - **Warum:** hangi problem cozuldu"
  echo "  - **Seit:** TT.AA.YYYY · migration_adi"
  echo "  - **Status:** aktiv"
  echo "  - **Wer:** kim yazacak / hangi ekrandan gelecek"
  echo ""
  echo "Atlamak icin: SKIP_REGISTER_GATE=1 git commit ..."
  [ -n "$SKIP_REGISTER_GATE" ] && exit 0
  exit 1
}
