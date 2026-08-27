#!/bin/sh
# İsim kapısı — Konsey 2026-08-27
#
# Neden: depo PUBLIC. Beta müşterilerinin tam adları 34 dosyaya ve 4 commit
# mesajına yayılmıştı; ev stili gerekçeyi "<isim>, <tarih>: '<alıntı>'" diye
# kaynak göstererek yazdığı için isimler kendiliğinden çoğalıyordu.
# Karar: kişi adı yerine rumuz (Beta-1, Beta-2). Alıntı ve tarih AYNEN kalır — kararın
# gerekçesini onlar taşır, kopan tek şey kimlik olmalı.
# Eşleme yalnızca depo DIŞINDA: I:\My Drive\Ops Praxura gitnogo\meetings\
#
# Neden hash: yasak isimleri düz metin bir listede tutmak, tam da kapatmaya
# çalıştığımız sızıntıyı geri getirirdi. Bu yüzden tools/.namen-hashes içinde
# sadece sha256 var. Liste depoda durur, isim durmaz.
#
# Kapsam: sadece EKLENEN satırlara bakar (mevcut geçmişi tekrar tekrar dövmez).
#
# Devre dışı (bilinçli istisna): SKIP_NAME_GATE=1 git commit ...
#
# Tam gerekçe: konsey/tutanak/2026-08-27-klarnamen-public-repo.md


# Cok baytlÄ± girdide `sort` yerel ayara takÄ±lÄ±p hata veriyordu; kapÄ± o durumda
# yakalamayÄ± kaÃ§Ä±rabilir. Byte olarak karÅÄ±laÅtÄ±r.
LC_ALL=C
export LC_ALL
set -e

repo_root=$(git rev-parse --show-toplevel)
hash_file="$repo_root/tools/.namen-hashes"

[ "$SKIP_NAME_GATE" = "1" ] && exit 0
[ -f "$hash_file" ] || exit 0

# Kapının kendi dosyaları taranmaz — hash listesi ve bu betik.
# Ayrıca konsey tutanağı ve hukuki kayıt kararın kendisini anlatır.
added=$(git diff --cached --unified=0 --no-color \
          -- . ':(exclude)tools/.namen-hashes' ':(exclude)tools/check-namen.sh' \
        | grep '^+' | grep -v '^+++' || true)

[ -z "$added" ] && exit 0

# Kelimelere böl, 4 harften kısa olanları ele, küçült, hash'le, listeyle karşılaştır.
hits=$(printf '%s' "$added" \
  | tr -c 'A-Za-z\304\326\334\344\366\374\337' '\n' \
  | awk 'length($0) >= 4' \
  | tr 'A-Z' 'a-z' \
  | sort -u \
  | while read -r w; do
      [ -z "$w" ] && continue
      h=$(printf '%s' "$w" | sha256sum | cut -d' ' -f1)
      grep -qx "$h" "$hash_file" && printf '%s\n' "$w"
    done || true)

if [ -n "$hits" ]; then
  n=$(printf '%s\n' "$hits" | grep -c . || true)
  cat >&2 <<EOF

  ✗ COMMIT REDDEDİLDİ — eklenen satırlarda kişi adı var ($n eşleşme)

  Depo PUBLIC. Beta müşterisinin adı yerine rumuz kullanılır:

      Beta-1  — Podologe (08.08.2026 görüşmeleri)
      Beta-2  — (12.08.2026 görüşmeleri)

  Alıntıyı ve tarihi SİLME, sadece adı değiştir:

      ✗  // <Kundenname>, 12.08.2026: „wir sind die meiste Zeit dort"
      ✓  // Beta-2, 12.08.2026: „wir sind die meiste Zeit dort"

  Rumuz→kişi eşlemesi depo dışında:
      I:\My Drive\Ops Praxura gitnogo\meetings\

  Karar: konsey/tutanak/2026-08-27-klarnamen-public-repo.md
  Hukuki kayıt: compliance/LEGAL_DECISIONS.md

  Bilinçli istisna gerekiyorsa:  SKIP_NAME_GATE=1 git commit ...

EOF
  exit 1
fi

exit 0
