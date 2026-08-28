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
#
# Neden node ve neden tek süreç (27.08.2026):
# Buradaki döngü her benzersiz kelime için AYRI bir `sha256sum` süreci açıyordu.
# Orta boy bir commit'te bu 800+ süreç demek; Windows'ta ölçüldü, iki dakikadan
# uzun sürüyordu. O kadar yavaş bir kapı denetlemez — insanı `SKIP_NAME_GATE=1`
# yazmaya iter, yani tam da engellemesi gereken şeyi kolaylaştırır. Aynı iş tek
# node sürecinde saniyenin altında bitiyor. (`funktionskarte.mjs` ve `npm test`
# zaten node istiyor, yeni bir bağımlılık değil.)
#
# Kelime ayırma kuralı shell sürümüyle birebir aynı: harf olmayan her şey ayraç,
# 4 harften kısa olanlar elenir, küçültülür. Alman harfleri (ÄÖÜäöüß) harf sayılır.
hits=$(printf '%s' "$added" | node -e '
  const { createHash } = require("node:crypto");
  const fs = require("node:fs");
  const hashes = new Set(
    fs.readFileSync(process.argv[1], "utf8")
      .split(/\r?\n/).map(l => l.trim().split(/\s+/)[0]).filter(Boolean)
  );
  let ein = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", d => ein += d);
  process.stdin.on("end", () => {
    const treffer = new Set();
    for (const w of new Set(
      ein.split(/[^A-Za-zÄÖÜäöüß]+/).filter(x => x.length >= 4).map(x => x.toLowerCase())
    )) {
      if (hashes.has(createHash("sha256").update(w, "utf8").digest("hex"))) treffer.add(w);
    }
    if (treffer.size) process.stdout.write([...treffer].join("\n") + "\n");
  });
' "$hash_file" || true)

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
