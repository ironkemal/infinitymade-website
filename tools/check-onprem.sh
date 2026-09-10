#!/bin/sh
# On-prem tutarlılık kapısı — 2026-09-04
#
# Neden: ONPREM_MIGRATION_PLAYBOOK.md §3 G8 kuralı "buluta yeni zincir eklenmez" diyor
# ve 2026-07-06'da yürürlüğe girdi. Buna rağmen kural yürürlükteyken module/ altına
# dört yeni dosya açıldı ve hepsi backend adresini kodun içine gömdü. Kimse kötü
# niyetli değildi — o satırı yazarken kimse playbook'u açmadı.
#
# Kural tek başına tutmuyor. Bu yüzden kapı var.
#
# Ne yapar: yedi sayaç tutar. Sayı tabandan ARTARSA commit reddedilir.
# AZALIRSA taban otomatik sıkışır (kazanım geri alınamaz) — check-dashboard-size.sh
# ile aynı mantık.
#
# Sayım ÇALIŞMA KOPYASI değil, COMMIT EDİLECEK içerik (index) üzerinden yapılır:
# `git grep --cached`. Yani "dosyayı düzelttim ama stage etmedim" kapıyı kandırmaz.
#
# Tabanlar: tools/.onprem-baseline  ·  Gerekçeleri: onprem/REGISTER.md §8
# Devre dışı (bilinçli istisna): SKIP_ONPREM_GATE=1 git commit ...

# Çok baytlı girdide `sort`/`grep` yerel ayara takılabiliyor (check-namen.sh'te
# yaşandı). Byte olarak karşılaştır.
LC_ALL=C
export LC_ALL
set -e

repo_root=$(git rev-parse --show-toplevel)
baseline_file="$repo_root/tools/.onprem-baseline"

[ "$SKIP_ONPREM_GATE" = "1" ] && exit 0
[ -f "$baseline_file" ] || exit 0

cd "$repo_root"

# Eşleşen SATIR sayısını toplar (git grep -c dosya başına satır sayısı verir).
#
# Standart hariç tutmalar fonksiyonun İÇİNDE, tek tek tırnaklı argüman olarak durur.
# Bir değişkende toplayıp tırnaksız genişletmek CAZİP ama YANLIŞ: `ai chatbot proje/`
# boşluk içeriyor, kelime bölünmesi onu üçe ayırıyor ve klasör hariç tutulmuyor.
# İlk yazımda tam olarak bu oldu — kapı temiz ağaçta kırmızı verdi (04.09.2026).
#
#   archive/          eskimiş, dokunulmuyor
#   vendor/           yerelleştirilmiş üçüncü-parti kod (Konsey 2026-08-13 S3)
#   funktionen/       üretilen fonksiyon haritası
#   onprem/           on-prem belgeleri — kendilerinden bahsederler
#   ai chatbot proje/ terk edilmiş proje (CLAUDE.md: arşivlik)
#   index-old.html    ölü kopya
zaehle() {
  muster=$1
  shift
  git grep --cached -I -E -c "$muster" -- "$@" \
    ':(exclude)archive/' \
    ':(exclude)vendor/' \
    ':(exclude)tools/vendor/' \
    ':(exclude)funktionen/' \
    ':(exclude)onprem/' \
    ':(exclude)node_modules/' \
    ':(exclude)index-old.html' \
    ':(exclude)ai chatbot proje/' \
    2>/dev/null | awk -F: '{s+=$NF} END{print s+0}'
}

taban_oku() {
  # "anahtar=deger" satırından değeri alır; yoksa boş döner.
  sed -n "s/^$1=//p" "$baseline_file" | tr -d ' \r' | head -1
}

# --- Sayaçlar -------------------------------------------------------------

# 1) Backend adresi koda gömülü. Kutuda müşterinin tarayıcısı BİZİM sunucumuza gider.
n8n_host=$(zaehle "n8n\.infinitymade\.de" '*.js' '*.html' '*.mjs')

# 2) app.praxura.de — yalnız UYGULAMA yüzeyi. Pazarlama sayfaları hariç: onlar
#    on-prem paketine zaten girmiyor (playbook Faz 2.0), oradaki mutlak link doğru.
app_host=$(zaehle "app\.praxura\.de" dashboard.js dashboard.html \
  employee-signup.js admin-login.js api-backend/server.js)

# 3) Vercel serverless limiti 12/12 DOLU. Bir tane daha = deploy patlar (+ G8).
vercel_fn=$(git ls-files 'api/*' | grep '\.js$' | grep -v '^api/_lib/' | wc -l | tr -d ' ')

# 4) Üçüncü-parti <script src="http…">. Bugün yalnız Sentry loader (11 dosya).
#    Playbook Faz 2.6 onu koşullu hale getirecek; o zaman taban düşer.
ext_script=$(zaehle "<script[^>]+src=[\"']https?://" '*.html')

# 5) N8N_ env referansı. Hedef SIFIR (playbook Faz 1.2 kabul kriteri).
n8n_env=$(zaehle "N8N_" '*.js' '*.mjs')

# 6) Sabit Supabase proje adresi. On-prem'de kutunun kendi Supabase'i var.
#    ops/ hariç — o AYRI bir Supabase projesi (farkaejociddtgqkusvm) ve kutuya girmiyor.
supabase_co=$(zaehle "[a-z0-9]+\.supabase\.co" '*.js' '*.html' '*.mjs' ':(exclude)ops/')

# 7) CDN host'ları. Yerelleştirme kararı geri alınamaz (Konsey 2026-08-13 S3).
#    Regex URL bağlamı ister: dashboard.html:30'daki "esm.sh/jsDelivr-Sweep" bir
#    YORUM, geçmişteki temizlikten bahsediyor — gerçek yükleme değil. Protokol
#    şartı olmadan bu satır yanlış pozitif veriyordu (04.09.2026'da ölçüldü).
cdn_host=$(zaehle "https?://(fonts\.googleapis\.com|esm\.sh|unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)" \
  '*.js' '*.html' '*.mjs')

# 8) Kutu paketindeki bileşen sayısı. Güncelleme yolu olmayan her image bir
#    borçtur (O-45). Artış, onprem/NOTICE.md'de karşılık gelen lisans satırı
#    olmadan kabul edilmez (O-42). Kendi api image'ımız da sayılır.
onprem_image=$(git grep --cached -c -E "^[[:space:]]+image:" -- onprem/docker-compose.yml 2>/dev/null | awk -F: '{s+=$NF} END{print s+0}')

# 9) Koda gömülü gönderen mail adresi. Kutuda mail MÜŞTERİNİN sunucusundan
#    çıkıyor ama bizim adımıza konuşuyor. Ölçüldü (11.09.2026): praxura.de'nin
#    SPF'i `-all` (sert red), DMARC'ı `p=quarantine` → o mailler DMARC uygulayan
#    her alıcıda spam'e düşer. Gönderimde hata görünmez. Hedef 0 (O-51).
absender_fest=$(git grep --cached -c "noreply@praxura\.de" -- api-backend/ 2>/dev/null | awk -F: '{s+=$NF} END{print s+0}')

# --- Yıkıcı DDL kapısı (sayaç değil, doğrudan kontrol) --------------------
#
# :beta ve :stable AYNI ANDA canlı. Eski image yeni şemayla çalışabilmek zorunda.
# Kolon/tablo silmek veya yeniden adlandırmak tek adımda yapılırsa, o migration'ı
# çeken kutudaki ESKİ image aradığı kolonu bulamaz ve patlar — üstelik kutuya
# erişimimiz yok (K10).
#
# Doğru yol iki adımdır (api-backend/db/migrations/README.md, Kural 4):
#   Sürüm N   : yeni kolonu EKLE, kod ikisini de yazsın
#   Sürüm N+1 : eski kolonu SİL
#
# Kapı bunu yasaklamıyor, BİLİNÇLİ olmasını istiyor: dosyada gerekçe satırı ister.
ddl_ihlal=""
for f in $(git diff --cached --name-only --diff-filter=AM -- 'api-backend/db/migrations/*.sql' 2>/dev/null); do
  icerik=$(git show ":$f" 2>/dev/null) || continue
  echo "$icerik" | grep -qiE "DROP[[:space:]]+(COLUMN|TABLE)|RENAME[[:space:]]+(COLUMN|TO)" || continue
  # Gerekçe işareti var mı?
  echo "$icerik" | grep -qiE "^--[[:space:]]*(zweistufig|iki-adimli|expand-contract)" && continue
  ddl_ihlal="$ddl_ihlal
      $f"
done

# --- Şema drift kapısı (sayac değil, doğrudan kontrol) ---------------------
#
# Neden: 04.09.2026'da migration zinciri kuruldu (api-backend/db/migrate.js,
# server.js açılışında koşar). Buna rağmen sonraki altı günde db/SCHEMA.sql
# YEDİ commit'te değişti ve zincire TEK dosya yazılmadı — her şema
# değişikliği canlıya elle gitti. Bedeli ölçüldü: commit a9cbb13'ün başlığı
# "rechnung_zahlung_buchen fehlte in Produktion" — RPC canlıda yoktu, fatura
# akışı bloke oldu. Tek ortamda yarım gün; 50 kutuda 50 destek çağrısı, ve
# kutuya giremeyiz (K10).
#
# SCHEMA-VERTEILUNG.md §5.4 bu kapıyı istiyordu; yıkıcı-DDL yarısı yazıldı,
# bu yarısı yazılmadı. Drift tam bu delikten geçti.
#
# Kural: döküm (db/SCHEMA.sql / SCHEMA-RLS.sql) değiştiyse aynı commit'te
# çalıştırılabilir zincire de bir dosya girmelidir.
sema_dokum=$(git diff --cached --name-only --diff-filter=AM -- 'db/SCHEMA.sql' 'db/SCHEMA-RLS.sql' 2>/dev/null)
yeni_migration=$(git diff --cached --name-only --diff-filter=A -- 'api-backend/db/migrations/*.sql' 2>/dev/null)

drift_ihlal=""
if [ -n "$sema_dokum" ] && [ -z "$yeni_migration" ] && [ "$SKIP_MIGRATION_GATE" != "1" ]; then
  drift_ihlal=$(echo "$sema_dokum" | sed 's/^/      /')
fi

# --- Karşılaştır ----------------------------------------------------------
ihlal=""
sikis=""

if [ -n "$ddl_ihlal" ]; then
  ihlal="$ihlal
    ✗ yıkıcı DDL — gerekçesiz kolon/tablo silme veya yeniden adlandırma:$ddl_ihlal
      Eski image (:stable) o kolonu arar ve patlar. Kutuya giremeyiz (K10).
      Çıkış: iki adıma böl (önce ekle, bir sürüm sonra sil) — README Kural 4.
      Zaten iki adımın ikinci yarısıysa dosyanın başına şu satırı koy:
        -- zweistufig: <hangi sürümde eklendi / niye artık güvenli>
"
fi

if [ -n "$drift_ihlal" ]; then
  ihlal="$ihlal
    ✗ şema drift — döküm değişti, çalıştırılabilir zincire dosya girmedi:
$drift_ihlal
      Döküm (db/SCHEMA.sql) BELGEDİR, çalıştırılamaz. Kutuya giden gerçek SQL
      api-backend/db/migrations/NNNN_ad.sql dosyalarıdır. Zincire yazılmayan
      değişiklik müşteri kutusuna ULAŞMAZ ve sessiz şema farkı üretir.
      Çıkış: aynı commit'te sırası gelen numarayla migration dosyasını yaz.
      Baseline (0000) henüz yoksa önce o üretilir — onprem/SCHEMA-VERTEILUNG.md §2.
      Yalnızca biçimsel döküm tazelemesiyse: SKIP_MIGRATION_GATE=1 git commit ...
"
fi

kontrol() {
  anahtar=$1
  simdi=$2
  aciklama=$3
  cikis=$4

  taban=$(taban_oku "$anahtar")
  [ -z "$taban" ] && return 0

  if [ "$simdi" -gt "$taban" ]; then
    ihlal="$ihlal
    ✗ $anahtar : $taban -> $simdi  (+$((simdi - taban)))
      $aciklama
      $cikis
"
  elif [ "$simdi" -lt "$taban" ]; then
    sikis="$sikis $anahtar:$taban->$simdi"
    tmp="$baseline_file.tmp"
    sed "s/^$anahtar=.*/$anahtar=$simdi/" "$baseline_file" > "$tmp" && mv "$tmp" "$baseline_file"
  fi
}

kontrol n8n_host    "$n8n_host"    "Backend adresi koda gömüldü. Kutuda hasta verisi BİZİM sunucumuza akar (G1)." \
                                   "Çıkış: adresi config'ten oku (window.API_BASE / veri-öznitelik), sabit yazma."
kontrol app_host    "$app_host"    "Uygulama yüzeyine sabit app.praxura.de adresi eklendi." \
                                   "Çıkış: aynı — kutu kendi adresini bilmeli, merkezinkini değil."
kontrol vercel_fn   "$vercel_fn"   "Vercel serverless limiti 12/12 DOLU — bu commit deploy'u patlatır. Ayrıca G8." \
                                   "Çıkış: yeni endpoint api-backend/server.js'e yazılır (Express)."
kontrol ext_script  "$ext_script"  "Yeni üçüncü-parti script etiketi. Kutu dışarı çıkar + CSP yüzeyi büyür." \
                                   "Çıkış: kütüphaneyi vendor/ altına al (Konsey 2026-08-13 S3)."
kontrol n8n_env     "$n8n_env"     "Yeni N8N_ referansı. n8n on-prem pakete KONMAZ (K8: lisans yasağı)." \
                                   "Çıkış: akışı Express'e yaz (playbook Faz 1.2, hedef grep N8N_ = 0)."
kontrol supabase_co "$supabase_co" "Sabit Supabase proje adresi. Kutunun kendi Supabase'i var." \
                                   "Çıkış: SUPABASE_URL env var'ından oku."
kontrol cdn_host    "$cdn_host"    "Yeni CDN bağımlılığı. Yerelleştirme kararı geri alınamaz." \
                                   "Çıkış: dosyayı vendor/ altına indir, oradan servis et."
kontrol onprem_image "$onprem_image" "Kutuya yeni bir konteyner girdi. Güncelleme yolu olmayan her bileşen borçtur (O-45)." \
                                   "Çıkış: gerçekten gerekli mi? Gerekliyse onprem/NOTICE.md'ye lisans satırı ekle (O-42)."
kontrol absender_fest "$absender_fest" "Koda gömülü yeni gönderen adresi. Kutuda o mail müşterinin sunucusundan çıkar ve DMARC yüzünden spam'e düşer (O-51)." \
                                   "Çıkış: adresi .env'den oku (SMTP_ADMIN_EMAIL), altı çağrıyı tek yardımcıya bağla."

# --- Sonuç ----------------------------------------------------------------
if [ -n "$ihlal" ]; then
  cat >&2 <<EOF

  ✗ COMMIT REDDEDİLDİ — on-prem tutarlılığı
$ihlal
  Kural: G8 — bulut zinciri büyümez (ONPREM_MIGRATION_PLAYBOOK.md §3).
  Sebep: SaaS ve on-prem TEK codebase'den çıkacak (G7). Bugün eklenen her
         zincir, paketleme sprintinde elle sökülecek demektir.

  Emin değilsen sor:  onprem ajanı  (dört soru sorar, hüküm verir)
  Tabanlar ve gerekçeleri: onprem/REGISTER.md §8

  Bilinçli istisna gerekiyorsa:  SKIP_ONPREM_GATE=1 git commit ...
  (ve tools/.onprem-baseline elle güncellenir — gerekçesiyle)

EOF
  exit 1
fi

if [ -n "$sikis" ]; then
  git add "$baseline_file" 2>/dev/null || true
  echo "  ✓ on-prem: bulut zinciri küçüldü ->$sikis. Taban sıkıştırıldı." >&2
fi

exit 0
