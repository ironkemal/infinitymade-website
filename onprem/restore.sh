#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — restore.sh (O-26, RELEASE-STANDARD.md §4.5)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 12.09.2026 · Tasarım: onprem ajanıyla kilitlendi (onprem/REGISTER.md
#  O-26 — "kapsam bilinçli dar" notundaki iki şart + bu turun tam istişaresi).
#  NICHT ohne erneute Konsultation umbauen.
#
#  Kullanım:
#    bash restore.sh --von <yedek-adı-veya-tam-yol> [--force]
#
#  `--von` bir ad ise (`/` içermiyorsa) BACKUP_ZIEL (ya da kutu-içi backups/)
#  altında aranır. Tam yol verilirse doğrudan kullanılır.
#
#  `--force`: SADECE jwt_secret_fingerprint uyuşmazlığını atlamak için var.
#  data_key_fingerprint uyuşmazlığında YOKTUR — DEK farklıysa şifreli hasta
#  verisi bu kutuda hiçbir zaman çözülmez, bu force'lanacak bir şey değil;
#  doğru hareket eski DEK'i .env'e geri koymaktır (aşağıya bak, madde 2).
#
#  ⚠️ GERİ ALINAMAZ: mevcut veritabanı ve storage'ın üzerine yazılır. Onay
#  kelimesi yazılmadan hiçbir yıkıcı adım çalışmaz (madde 5).
#
#  Kapsam bilinçli dar: `_supabase` veritabanı (analytics/realtime tenant
#  metriği) yedeğin kapsamı DIŞINDA — geri gelmemesi hata değil, karar
#  (onprem, bu tur). SSH/rsync uzak hedeften geri yükleme YOK ve OLMAYACAK —
#  `--von` asla bir URL/uzak adres kabul etmez, yalnız yerel yol/mount (G1
#  sert veto — "Praxura bulutundan geri yükle" hiç var olmasın).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/restore.log"
ENV_FILE="$SCRIPT_DIR/.env"
LOCK_FILE="$SCRIPT_DIR/.praxura-update.lock"

log()  { printf '%s\n' "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE" >&2; }
ok()   { log "  [ok] $*"; }
warn() { log "  [warn] $*"; }
fehler() {
  log ""
  log "  ✗ [fehler] $1"
  log "      Gefunden:  $2"
  log "      Erwartet:  $3"
  log "      Was tun:   $4"
  log ""
}

if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 5242880 ]; then
  mv "$LOG_FILE" "$LOG_FILE.alt"
fi

# ── Argümanlar ────────────────────────────────────────────────────────────
VON=""
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --von) VON="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    *) shift ;;
  esac
done

if [ -z "$VON" ]; then
  fehler "Argüman eksik" "--von verilmedi" "bash restore.sh --von <yedek-adı-veya-yol> [--force]" \
    "Mevcut yedekleri görmek için: ls -1t \"\$BACKUP_ZIEL\" (ya da ./backups)."
  exit 2
fi
case "$VON" in
  http://*|https://*|ssh://*|*@*:*)
    fehler "Geçersiz --von değeri" "$VON" "yerel bir yol ya da mount edilmiş bir dizin adı" \
      "restore.sh yalnız yerelden okur — uzak/bulut hedeften geri yükleme yok ve olmayacak (G1)."
    exit 2
    ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  fehler "Kutu kurulmamış" ".env yok" "önce install.sh çalıştırılmış bir kutu" "Önce install.sh ile kurulum yap."
  exit 1
fi

env_wert() {
  awk -F= -v k="$1" '$1==k{ sub(/^[^=]*=/,""); print; f=1 } END{ if(!f) print "" }' "$ENV_FILE" 2>/dev/null || true
}

DB_NAME="$(env_wert POSTGRES_DB)"
[ -n "$DB_NAME" ] || DB_NAME=postgres

# ── Hedef yedek dizinini çöz ────────────────────────────────────────────────
case "$VON" in
  */*) YEDEK_DIR="$VON" ;;
  *)
    BACKUP_ZIEL_HAM="$(env_wert BACKUP_ZIEL)"
    if [ -n "$BACKUP_ZIEL_HAM" ]; then
      YEDEK_DIR="$BACKUP_ZIEL_HAM/$VON"
    else
      YEDEK_DIR="$SCRIPT_DIR/backups/$VON"
    fi
    ;;
esac

if [ ! -d "$YEDEK_DIR" ] || [ ! -f "$YEDEK_DIR/backup.meta.json" ] || [ ! -f "$YEDEK_DIR/db.dump" ]; then
  fehler "Yedek bulunamadı ya da eksik" "$YEDEK_DIR" "backup.meta.json + db.dump içeren bir dizin" \
    "Adı/yolu kontrol et. Mevcut yedekler: ls -1t \"\$(dirname "$YEDEK_DIR" 2>/dev/null)\" 2>/dev/null"
  exit 1
fi

meta_alan() {
  # backup.sh'ın manifest_feld'iyle aynı desen (update.sh) — jq bağımlılığı yok.
  grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"?[^\",}]*\"?" "$YEDEK_DIR/backup.meta.json" | head -1 \
    | sed -E 's/^"'"$1"'"[[:space:]]*:[[:space:]]*"?//; s/"?$//'
}

M_SEBEP="$(meta_alan sebep)"
M_TAKEN_AT="$(meta_alan taken_at)"
M_SCHEMA="$(meta_alan schema_version)"
M_DUMP_BYTES="$(meta_alan dump_bytes)"
M_DEK_FP="$(meta_alan data_key_fingerprint)"
M_JWT_FP="$(meta_alan jwt_secret_fingerprint)"
M_PGPW_FP="$(meta_alan postgres_password_fingerprint)"

log "Yedek: $(basename "$YEDEK_DIR") (sebep=${M_SEBEP:-?}, alındı=${M_TAKEN_AT:-?}, şema=${M_SCHEMA:-?})"

# ── Kilit — backup.sh/update.sh ile AYNI dosya ─────────────────────────────
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  fehler "Kilit alınamadı" "update.sh/backup.sh çalışıyor" "boşta bir kilit" \
    "Diğer işlemin bitmesini bekle, sonra tekrar dene. Aynı anda restore + migration/backup KESİNLİKLE çakışmamalı."
  exit 1
fi

# ── 1) Arşiv bütünlüğü — DB'YE DOKUNMADAN ÖNCE ──────────────────────────────
GERCEK_BYTES="$(wc -c < "$YEDEK_DIR/db.dump" | tr -d '[:space:]')"
if [ -n "$M_DUMP_BYTES" ] && [ "$M_DUMP_BYTES" != "$GERCEK_BYTES" ]; then
  fehler "Dump dosyası boyutu künyeyle uyuşmuyor" "diskte ${GERCEK_BYTES} byte, künyede ${M_DUMP_BYTES} byte" \
    "aynı boyut" "Dosya nakil sırasında bozulmuş/kesilmiş olabilir (NAS/ağ). Yedeği yeniden kopyala, farklı bir kopyasını dene."
  exit 1
fi
KONTROL_HEDEF="/tmp/praxura-restore-kontrol.dump"
if ! docker compose cp "$YEDEK_DIR/db.dump" "db:$KONTROL_HEDEF" >>"$LOG_FILE" 2>&1 \
   || ! docker compose exec -T db pg_restore -l "$KONTROL_HEDEF" >/dev/null 2>>"$LOG_FILE"; then
  docker compose exec -T db rm -f "$KONTROL_HEDEF" >/dev/null 2>&1 || true
  fehler "Dump dosyası bozuk (pg_restore -l başarısız)" "hata (bkz. $LOG_FILE)" "geçerli, listelenebilir bir arşiv" \
    "Bu yedeği kullanma — başka bir yedek dene."
  exit 1
fi
docker compose exec -T db rm -f "$KONTROL_HEDEF" >/dev/null 2>&1 || true
ok "Arşiv bütünlüğü doğrulandı (boyut + pg_restore -l)"

# ── 1b) Yer kontrolü — O-88 (onprem denetimi): backup.sh'ta var, burada yoktu ─
# Tepe kullanım kabaca: yeni boş DB'nin dump kadar büyümesi + eski (yeniden
# adlandırılmış) DB hâlâ diskte + storage'ın YENİ kopyası + eski storage hâlâ
# diskte (.alt-<zaman>) + dump'ın kendisi zaten diskte duruyor. Kesin bir
# formül yok (Postgres'in kendi büyümesi dump boyutundan farklı olabilir) —
# backup.sh'taki gibi bir PAY hesabı, kesin bir garanti değil.
STORAGE_ARSIV_BYTE=0
[ -f "$YEDEK_DIR/storage.tar.gz" ] && STORAGE_ARSIV_BYTE="$(wc -c < "$YEDEK_DIR/storage.tar.gz" | tr -d '[:space:]')"
BOS_ALAN_KB="$(df -k "$SCRIPT_DIR" 2>/dev/null | tail -n 1 | awk '{print $4}')"
if [ -n "$BOS_ALAN_KB" ]; then
  GEREKEN_KB=$(( ((GERCEK_BYTES + STORAGE_ARSIV_BYTE) * 2 / 1024) + 102400 ))
  if [ "$BOS_ALAN_KB" -lt "$GEREKEN_KB" ]; then
    fehler "Geri yükleme için yeterli disk yeri olmayabilir" "${BOS_ALAN_KB} KB boş" "en az ~${GEREKEN_KB} KB (kaba tahmin — eski+yeni DB, eski+yeni storage)" \
      "Disk temizle (özellikle eski restore'lardan kalan 'volumes/storage.alt-*' dizinlerini ve db'nin kendi 'postgres_onceki_*' veritabanlarını, memnun kaldıysan), sonra tekrar dene. Bu kesin bir sınır değil — devam etmek istiyorsan ve riski biliyorsan dosyaları elle temizleyip yeniden çalıştır."
    exit 1
  fi
else
  warn "Disk yeri ölçülemedi — yer kontrolü atlandı."
fi

# ── 2) Künye — KUTUYU BOZMADAN ÖNCE, konteynerlerin KENDİ ortamından ───────
# Aynı fonksiyonlar backup.sh'takiyle BİREBİR aynı olmalı — farklı bir yöntem
# (ör. host'ta openssl) sır argv'ye düşürür (onprem uyarısı, bu tur). Bu adım
# `api`/`db` henüz DURDURULMADAN çalışır — restore'un asıl yıkıcı kısmı olan
# pg_restore'dan önce, mevcut çalışan kutunun kendi sırlarıyla karşılaştırır.
#
# ⚠️ O-85 (onprem'in restore.sh sonrası denetimi, 12.09.2026): `docker compose
# exec` `api` AYAKTA DEĞİLSE boş döner — restore TAM DA `api`'nin çökük/kapalı
# olduğu günlerde çalıştırılır, yani bu en olası senaryodur. Eskiden boş dönüş
# aşağıdaki `elif`'i yanlış çıkarıp `else`'e ("uyuşuyor") düşürüyordu — YAPILAMAYAN
# bir kontrol, YAPILMIŞ ve BAŞARILI gibi rapor ediliyordu. Bu yüzden: (a) DEK
# için `docker compose run --rm --no-deps` — servis AYAKTA OLMASA BİLE image'dan
# tek seferlik bir konteyner açar, `exec`'in aksine `api`'nin çalışıyor olmasını
# gerektirmez (b) üç kontrol de artık İKİ farklı "atlandı" hâlini birbirinden
# ayırıyor: künyede parmak izi YOK (backup.sh o an hesaplayamamıştı) vs.
# güncel taraf hesaplanamadı (konteyner şu an erişilemez) — ikisi de "atlandı"
# ama SEBEBİ farklı, ikisi de asla "uyuşuyor" YAZMAZ.
parmak_izi_dek() {
  docker compose run --rm --no-deps -T api node -e '
    const crypto = require("crypto");
    const k = process.env.DATA_ENCRYPTION_KEY || "";
    if (!k) { process.exit(1); }
    process.stdout.write(crypto.createHmac("sha256", k).update("praxura-backup-fingerprint-v1:dek").digest("hex"));
  ' 2>>"$LOG_FILE" | head -c 16
}
parmak_izi_db_taraf() {
  local envvar="$1"
  local alan="$2"
  local sqldosya="/tmp/.fp-${alan}-restore.sql"
  local sonuc=""
  printf "SELECT encode(hmac(:'dom', :'key', 'sha256'), 'hex');\n" > "$SCRIPT_DIR/.fp-${alan}-restore.sql.tmp"
  if docker compose cp "$SCRIPT_DIR/.fp-${alan}-restore.sql.tmp" "db:${sqldosya}" >>"$LOG_FILE" 2>&1; then
    sonuc="$(docker compose exec -T db sh -c "psql -U postgres -d \"\$PGDATABASE\" -v key=\"\$${envvar}\" -v dom=\"praxura-backup-fingerprint-v1:${alan}\" -tA -f ${sqldosya}" 2>>"$LOG_FILE" | tr -d '[:space:]')"
    docker compose exec -T db rm -f "$sqldosya" >/dev/null 2>&1 || true
  fi
  rm -f "$SCRIPT_DIR/.fp-${alan}-restore.sql.tmp"
  printf '%s' "$sonuc" | head -c 16
}

GUNCEL_DEK_FP="$(parmak_izi_dek || true)"
GUNCEL_JWT_FP="$(parmak_izi_db_taraf JWT_SECRET jwt || true)"
GUNCEL_PGPW_FP="$(parmak_izi_db_taraf POSTGRES_PASSWORD pgpw || true)"

if [ -z "$M_DEK_FP" ] || [ "$M_DEK_FP" = "null" ]; then
  warn "Yedeğin künyesinde DATA_ENCRYPTION_KEY parmak izi YOK (backup.sh o an api'ye erişemedi) — bu kontrol ATLANDI, en kritik kontrol bu. Devam ediyorsan hasta verisinin şifresinin çözülüp çözülmeyeceğini bilmiyorsun."
elif [ -z "$GUNCEL_DEK_FP" ]; then
  fehler "DATA_ENCRYPTION_KEY doğrulanamadı — kutunun güncel değeri HESAPLANAMADI" \
    "boş sonuç (api image çalıştırılamadı ya da DATA_ENCRYPTION_KEY .env'de yok)" \
    "hesaplanabilir bir parmak izi" \
    "Bu bir 'uyuşuyor' değil — kontrol YAPILAMADI. .env'de DATA_ENCRYPTION_KEY var mı ve 'docker compose run --rm --no-deps api node -e \"console.log(1)\"' çalışıyor mu kontrol et, sonra tekrar dene. Bu kontrolü atlayıp devam etmenin yolu YOK (force dahil) — DEK doğrulanmadan restore, şifreli hasta verisinin sessizce çöpe gitmesi riskini taşır."
  exit 1
elif [ "$GUNCEL_DEK_FP" != "$M_DEK_FP" ]; then
  fehler "DATA_ENCRYPTION_KEY yedekle uyuşmuyor" "kutunun güncel .env'i: ${GUNCEL_DEK_FP} · yedeğin künyesi: ${M_DEK_FP}" \
    "aynı parmak izi" \
    "Bu yedek FARKLI bir DATA_ENCRYPTION_KEY ile alınmış (ör. disk değişti, install.sh --neu yeni bir anahtar üretti). ÇÖZÜM force'lamak DEĞİL: .env'deki DATA_ENCRYPTION_KEY'i bu yedeğin alındığı ANDAKİ değerle değiştir (eski .env'in bir kopyası duruyorsa oradan), sonra restore.sh'ı tekrar çalıştır. Bu adımı atlarsan şifreli hasta verisi bu kutuda BİR DAHA ASLA çözülmez — force bayrağı bunun için YOKTUR."
  exit 1
else
  ok "DATA_ENCRYPTION_KEY parmak izi uyuşuyor"
fi

if [ -z "$M_JWT_FP" ] || [ "$M_JWT_FP" = "null" ]; then
  warn "Yedeğin künyesinde JWT_SECRET parmak izi yok — kontrol atlandı."
elif [ -z "$GUNCEL_JWT_FP" ]; then
  warn "JWT_SECRET doğrulanamadı — kutunun güncel değeri hesaplanamadı (db konteyneri şu an erişilemez olabilir). Kontrol ATLANDI, 'uyuşuyor' DEĞİL. Devam edersen bu yedeğin doğru kurulumdan geldiğini varsaymış olursun."
elif [ "$GUNCEL_JWT_FP" != "$M_JWT_FP" ]; then
  if [ "$FORCE" -eq 1 ]; then
    warn "JWT_SECRET yedekle uyuşmuyor (güncel: ${GUNCEL_JWT_FP} · yedek: ${M_JWT_FP}) — --force ile DEVAM EDİLİYOR. Bu yedek başka bir kurulumdan geliyor olabilir. Bilinen yan etki: _realtime.tenants'taki tenant sırrı ESKİ JWT ile şifreliydi, bu kutunun GÜNCEL JWT_SECRET'ıyla artık çözülemeyebilir — Realtime (canlı güncellemeler) sessizce bozulabilir. Restore sonrası booking/randevu ekranlarını gerçek tarayıcıda test et."
  else
    fehler "JWT_SECRET yedekle uyuşmuyor" "güncel: ${GUNCEL_JWT_FP} · yedek: ${M_JWT_FP}" "aynı parmak izi ya da --force" \
      "Bu yedek muhtemelen BAŞKA bir kurulumdan geliyor. Emin değilsen dur ve doğru yedeği bul. Emin isen --force ekle (Realtime bozulma riski var, restore sonrası test et)."
    exit 1
  fi
else
  ok "JWT_SECRET parmak izi uyuşuyor"
fi

if [ -z "$M_PGPW_FP" ] || [ "$M_PGPW_FP" = "null" ]; then
  warn "Yedeğin künyesinde POSTGRES_PASSWORD parmak izi yok — kontrol atlandı."
elif [ -z "$GUNCEL_PGPW_FP" ]; then
  warn "POSTGRES_PASSWORD doğrulanamadı — kutunun güncel değeri hesaplanamadı. Kontrol ATLANDI, 'uyuşuyor' DEĞİL — zararı az (madde 8'de kendiliğinden onarılıyor) ama bilerek devam ediyorsun."
elif [ "$GUNCEL_PGPW_FP" != "$M_PGPW_FP" ]; then
  warn "POSTGRES_PASSWORD yedekle uyuşmuyor (güncel: ${GUNCEL_PGPW_FP} · yedek: ${M_PGPW_FP}) — bu DUR sebebi değil, restore sonrası roller/parolalar güncel .env ile yeniden uygulanacak (madde 8)."
else
  ok "POSTGRES_PASSWORD parmak izi uyuşuyor"
fi

# ── 3) Şema-sürümü kapısı — hedef image'ın bildiği EN BÜYÜK migration ──────
# update.sh'ın (Schritt 5) kullandığı AYNI teknik: `docker create` — hiç
# BAŞLATMADAN — sonra `docker cp` ile migrations dizinini çek. Konteyner
# hiç ayağa kalkmaz, DB'ye hiç dokunulmaz.
#
# ⚠️ O-86 (onprem'in denetimi, 12.09.2026): image lokalde yoksa `docker pull`
# deneniyordu, o da başarısızsa TÜM restore durduruluyordu — ama bu yalnızca
# DANIŞMA amaçlı bir kontrol (yedek image'dan yeni mi diye bakıyor), restore'un
# KENDİSİ için ön koşul DEĞİL. İnternetsiz/temiz bir sunucuda geçerli bir yedek
# ve çalışan Postgres varken restore.sh'ın hiç başlamaması yanlış — bu yüzden
# artık yalnız BU kontrol atlanıyor (loud warn), restore'un geri kalanı devam
# ediyor. Sert DUR yalnız "image lokalde VAR ve yedek ondan yeni" dalında kalıyor.
API_IMAGE="$(env_wert PRAXURA_API_IMAGE)"
SEMA_KONTROLU_ATLANDI=0
if [ -z "$API_IMAGE" ]; then
  warn "PRAXURA_API_IMAGE .env'de yok — şema-sürümü kapısı ATLANIYOR, restore devam ediyor."
  SEMA_KONTROLU_ATLANDI=1
elif ! docker image inspect "$API_IMAGE" >/dev/null 2>&1; then
  log "Image lokalde yok, çekiliyor: $API_IMAGE"
  if ! docker pull "$API_IMAGE" >>"$LOG_FILE" 2>&1; then
    warn "Image çekilemedi ($API_IMAGE — internet yok ya da GHCR erişilemiyor olabilir). Şema-sürümü kapısı ATLANIYOR (bu yalnız danışma amaçlıydı) — restore devam ediyor. Yedeğin şemasının kurulu image'dan YENİ olma ihtimaline karşı ekstra dikkatli ol."
    SEMA_KONTROLU_ATLANDI=1
  fi
fi

IMAJ_BILDIGI_MAX=""
if [ "$SEMA_KONTROLU_ATLANDI" -eq 0 ]; then
SEMA_GECICI="$(mktemp -d)"
trap 'rm -rf "$SEMA_GECICI"; docker rm -f praxura-restore-sema-tmp >/dev/null 2>&1 || true' EXIT
docker create --name praxura-restore-sema-tmp "$API_IMAGE" >/dev/null
docker cp praxura-restore-sema-tmp:/app/db/migrations "$SEMA_GECICI/migrations" >/dev/null 2>&1 || true
docker rm -f praxura-restore-sema-tmp >/dev/null 2>&1 || true
IMAJ_BILDIGI_MAX="$(find "$SEMA_GECICI/migrations" -maxdepth 1 -name '*.sql' -printf '%f\n' 2>/dev/null | sed -E 's/^([0-9]{4}).*/\1/' | sort -u | tail -n 1)"

if [ -n "$IMAJ_BILDIGI_MAX" ] && [ -n "$M_SCHEMA" ] && [ "$M_SCHEMA" != "none" ] && [ "$M_SCHEMA" != "null" ]; then
  if [ "$M_SCHEMA" \> "$IMAJ_BILDIGI_MAX" ]; then
    fehler "Yedek, kurulu image'ın bilmediği bir şemadan geliyor" \
      "yedek şeması: ${M_SCHEMA} · image'ın bildiği en yeni: ${IMAJ_BILDIGI_MAX}" \
      "yedek şeması ≤ image'ın bildiği" \
      "Önce image'ı güncelle (update.sh çalıştır ya da PRAXURA_API_IMAGE'ı daha yeni bir etikete al), sonra restore.sh'ı tekrar dene. Eski image + yeni şema kombinasyonu uygulamanın anlamadığı bir şekle karşı çalışması demektir."
    exit 1
  elif [ "$M_SCHEMA" \< "$IMAJ_BILDIGI_MAX" ]; then
    log "Not: yedek şeması (${M_SCHEMA}) image'ın bildiğinden (${IMAJ_BILDIGI_MAX}) eski — restore sonrası eksik migration'lar OTOMATİK uygulanacak (normal, güvenli — beklenen davranış)."
  fi
fi
rm -rf "$SEMA_GECICI"
trap - EXIT
fi

# ── 4) Onay — GERİ ALINAMAZ ─────────────────────────────────────────────────
echo "" >&2
echo "═══════════════════════════════════════════════════════════════" >&2
echo "  BU İŞLEM GERİ ALINAMAZ." >&2
echo "  Şu anki veritabanı ve dosya deposu SİLİNECEK, yerine" >&2
echo "  '$(basename "$YEDEK_DIR")' (alındı: ${M_TAKEN_AT:-?}) yüklenecek." >&2
echo "═══════════════════════════════════════════════════════════════" >&2
echo "" >&2
printf 'Devam etmek için WIEDERHERSTELLEN yaz: ' >&2
read -r ONAY
if [ "$ONAY" != "WIEDERHERSTELLEN" ]; then
  log "Onay verilmedi ('${ONAY}' ≠ WIEDERHERSTELLEN) — iptal edildi, hiçbir şey değiştirilmedi."
  exit 0
fi

# ── 5) DB'ye bağlı servisleri durdur — db AÇIK kalır ────────────────────────
# api/auth/rest/realtime/storage hepsi db'ye bağlanıyor (onprem uyarısı):
# biri açık kalırsa pg_restore --clean'in DROP'ları ACCESS EXCLUSIVE kilidini
# bekleyip asılabilir. kong/caddy ayakta kalabilir — kullanıcı yarım yamalak
# bir hata yerine dürüst bir 502 görür.
log "Servisler durduruluyor (api, auth, rest, realtime, storage)..."
docker compose stop api auth rest realtime storage >>"$LOG_FILE" 2>&1
ok "Durduruldu — db açık kaldı"

# Kalan bağlantıları da temizle (yukarıdaki stop'tan sonra artık bağlantı
# kalmamalı, ama bir bağlantı havuzu/health-check gecikmiş olabilir).
# ⚠️ `supabase_admin` ile — `postgres` burada gerçek superuser DEĞİL (aynı
# ayrım api-backend/docker-compose.yml'in DATABASE_URL yorumunda da var:
# "postgres darf fremde Vorgaberechte nicht aendern"). `postgres` ile bazı
# oturumları (başka superuser'a ait) sonlandıramaz — zararsız, yalnız uyarı.
docker compose exec -T db psql -U supabase_admin -d postgres -tAc \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid<>pg_backend_pid();" \
  >>"$LOG_FILE" 2>&1 || true

# ── 6) Veritabanı geri yükleme — TEK, ATOMİK pg_restore ─────────────────────
# Ledger (praxura_migrations) ve veri AYNI dump'ın içinde — asla ayrı ayrı
# restore edilmez (O-26'nın 1. tasarım şartı, tam olarak bu).
#
# ⚠️ Gerçek kutuda denendi, plan İKİ kez değişti:
#  1) `-U postgres` ile `pg_restore --clean`: "must be owner of event trigger
#     pgrst_drop_watch" — bu kutuda gerçek superuser `postgres` değil,
#     `supabase_admin` (aynı ayrım api-backend/docker-compose.yml'in
#     DATABASE_URL yorumunda da var).
#  2) `-U supabase_admin` ile `pg_restore --clean`: "cannot drop inherited
#     constraint messages_2026_09_15_pkey" — Supabase Realtime'ın GÜNLÜK
#     PARTİSYONLADIĞI `realtime.messages_*` tablolarında `--clean`'in ürettiği
#     `ALTER TABLE ... DROP CONSTRAINT` satırı partisyon çocuğunda başarısız
#     oluyor (kısıt üst tablodan miras, yalnız üstten ya da partisyonu
#     TAMAMEN silerek kaldırılabilir — bilinen bir pg_dump/--clean sınırı).
#
# Çözüm: cerrahi `--clean` YERİNE veritabanını YENİDEN ADLANDIRIP (SİLMEDEN)
# BOŞ bir tanesine restore ediyoruz. Bunun iki kazancı var: (a) partisyon/
# sahiplik kaynaklı HİÇBİR --clean sürprizi olmaz — boş hedefe hiçbir DROP
# gerekmez (b) restore YARIDA KALIRSA eski veritabanı KAYBOLMAMIŞ olur, ismi
# değişmiş olarak duruyor — storage.tar.gz'nin ".alt-<zaman>" deseniyle aynı
# mantık (madde 7'ye bak).
ESKI_DB_ADI="${DB_NAME}_onceki_$(date -u +%Y%m%dT%H%M%SZ)"
log "Veritabanı geri yükleniyor (yeniden adlandır + boşa restore)..."
if ! docker compose exec -T db psql -U supabase_admin -d template1 -c \
     "ALTER DATABASE \"$DB_NAME\" RENAME TO \"$ESKI_DB_ADI\";" >>"$LOG_FILE" 2>&1; then
  fehler "Mevcut veritabanı yeniden adlandırılamadı" "hata (bkz. $LOG_FILE)" "başarılı bir ALTER DATABASE RENAME" \
    "Hâlâ bağlı bir oturum olabilir (bkz. yukarıdaki pg_terminate_backend uyarısı) — 'docker compose ps' ile hangi konteynerin hâlâ ayakta olduğunu kontrol et, hepsi durdurulmuş olmalıydı."
  exit 1
fi
if ! docker compose exec -T db psql -U supabase_admin -d template1 -c \
     "CREATE DATABASE \"$DB_NAME\" OWNER supabase_admin;" >>"$LOG_FILE" 2>&1; then
  fehler "Yeni boş veritabanı yaratılamadı" "hata (bkz. $LOG_FILE)" "başarılı bir CREATE DATABASE" \
    "Eski veritabanın KAYBOLMADI, '${ESKI_DB_ADI}' adıyla duruyor. Geri almak için: docker compose exec -T db psql -U supabase_admin -d template1 -c 'ALTER DATABASE \"${ESKI_DB_ADI}\" RENAME TO \"${DB_NAME}\";'"
  exit 1
fi
RESTORE_HEDEF="/tmp/praxura-restore.dump"
if ! docker compose cp "$YEDEK_DIR/db.dump" "db:$RESTORE_HEDEF" >>"$LOG_FILE" 2>&1; then
  fehler "Dump db konteynerine kopyalanamadı" "hata (bkz. $LOG_FILE)" "başarılı bir docker compose cp" \
    "'${DB_NAME}' zaten '${ESKI_DB_ADI}' olarak yeniden adlandırıldı ve yeni boş '${DB_NAME}' yaratıldı — ama içine hiçbir şey YAZILMADI. Disk/konteyner durumunu kontrol et (df -h, docker compose ps db), sonra: docker compose exec -T db psql -U supabase_admin -d template1 -c 'DROP DATABASE IF EXISTS \"${DB_NAME}\"; ALTER DATABASE \"${ESKI_DB_ADI}\" RENAME TO \"${DB_NAME}\";' ile eski hâle dön, sorunu çözüp tekrar dene."
  exit 1
fi
if ! docker compose exec -T -e PGOPTIONS='-c lock_timeout=30s' db \
     pg_restore --single-transaction -U supabase_admin -d "$DB_NAME" "$RESTORE_HEDEF" >>"$LOG_FILE" 2>&1; then
  docker compose exec -T db rm -f "$RESTORE_HEDEF" >/dev/null 2>&1 || true
  fehler "pg_restore başarısız" "hata (bkz. $LOG_FILE)" "başarılı, tam bir geri yükleme" \
    "--single-transaction sayesinde YENİ '${DB_NAME}' YARIM KALMADI (boş kaldı, ya hep ya hiç). ESKİ VERİTABANI KAYBOLMADI — '${ESKI_DB_ADI}' adıyla duruyor. Geri dönmek için: docker compose exec -T db psql -U supabase_admin -d template1 -c 'DROP DATABASE IF EXISTS \"${DB_NAME}\"; ALTER DATABASE \"${ESKI_DB_ADI}\" RENAME TO \"${DB_NAME}\";' — sonra 'docker compose up -d api auth rest realtime storage'. Log'a bakıp sorunu çözdükten sonra restore.sh'ı tekrar dene."
  exit 1
fi
docker compose exec -T db rm -f "$RESTORE_HEDEF" >/dev/null 2>&1 || true
ok "Veritabanı geri yüklendi (eski hâl korunuyor: ${ESKI_DB_ADI})"

log "İstatistikler tazeleniyor (ANALYZE)..."
docker compose exec -T db psql -U supabase_admin -d "$DB_NAME" -c "ANALYZE;" >>"$LOG_FILE" 2>&1 || \
  warn "ANALYZE başarısız oldu — restore geçerli, yalnız ilk günlerde sorgular biraz yavaş olabilir."

# Roller ve JWT ayarları GÜNCEL .env ile yeniden uygulanıyor — bu ADİ bir
# temizlik değil, O-87 (onprem denetimi): `pg_dump -Fc` (`--create` YOK)
# DB-seviyesi ayarları (`ALTER DATABASE ... SET "app.settings.jwt_secret"`,
# `pg_db_role_setting` sistem kataloğunda durur) dump'a HİÇ GİRMEZ. RENAME
# yoluna geçtiğimiz için (madde 6) restore'un doğruluğu artık TAMAMEN bu
# adıma bağlı — `--clean` yolunda DB-seviyesi ayar zaten yerinde kalıyordu,
# burada aktif olarak yeniden kurulması ŞART. Başarısızlık PostgREST/Auth'un
# JWT doğrulamasını (dolayısıyla TÜM girişleri) kırabilir — bu yüzden aşağıda
# hem uygulama hem DOĞRULAMA var, sessiz `|| warn` değil.
log "Roller ve JWT ayarları güncel .env ile yeniden uygulanıyor..."
# `-U supabase_admin` — `postgres` başka rollerin parolasını değiştiremez
# (CREATEROLE/superuser gerekiyor, aynı gerekçe yukarıdaki pg_restore ile).
ROLLER_JWT_SORUNLU=0
if ! docker compose exec -T db psql -U supabase_admin -d "$DB_NAME" -f /docker-entrypoint-initdb.d/init-scripts/99-roles.sql >>"$LOG_FILE" 2>&1; then
  warn "99-roles.sql yeniden uygulanamadı — roller yedekteki eski parolada kalmış olabilir, PostgREST/Auth giriş yapamayabilir. Elle: docker compose exec -T db psql -U supabase_admin -d \"$DB_NAME\" -f /docker-entrypoint-initdb.d/init-scripts/99-roles.sql"
  ROLLER_JWT_SORUNLU=1
fi
if ! docker compose exec -T db psql -U supabase_admin -d "$DB_NAME" -f /docker-entrypoint-initdb.d/init-scripts/99-jwt.sql >>"$LOG_FILE" 2>&1; then
  warn "99-jwt.sql yeniden uygulanamadı — DB dump'ta JWT ayarı HİÇ yoktu (pg_dump --create almaz), yani bu adım atlanınca ESKİ/yanlış bir JWT kalabilir. PostgREST/Auth tüm istekleri reddedebilir. Elle: docker compose exec -T db psql -U supabase_admin -d \"$DB_NAME\" -f /docker-entrypoint-initdb.d/init-scripts/99-jwt.sql"
  ROLLER_JWT_SORUNLU=1
fi
# Doğrulama — sessizce "başarılı" saymıyoruz, gerçekten ayarlandığını okuyoruz.
# ⚠️ O-87(c) (onprem denetimi): burada boş dönmesi yalnız uyarı değil SERT DUR —
# veritabanı ZATEN geri yüklendi (güvende), ama servisleri şimdi açarsak
# PostgREST/Auth JWT'siz/yanlış JWT'yle ayağa kalkar ve gerçek kullanıcılara
# kırık kimlik doğrulama sunar. Servisler hâlâ durdurulmuş durumda — burada
# durmak "kutu kapalı ama veri güvende" hâlini korur, "kutu açık ama bozuk"
# hâlinden iyidir.
JWT_KONTROL="$(docker compose exec -T db psql -U supabase_admin -d "$DB_NAME" -tAc "SELECT current_setting('app.settings.jwt_secret', true);" 2>>"$LOG_FILE" | tr -d '[:space:]')"
if [ -z "$JWT_KONTROL" ]; then
  fehler "app.settings.jwt_secret restore sonrası HÂLÂ boş" "boş/okunamıyor" "99-jwt.sql'in uyguladığı, boş olmayan bir değer" \
    "Veritabanı ZATEN geri yüklendi (güvende, '${ESKI_DB_ADI}' de hâlâ duruyor) — yalnız JWT ayarı eksik. Servisler BİLEREK açılmadı: böyle açarsak PostgREST/Auth kırık kimlik doğrulamayla ayağa kalkardı. Elle uygula: docker compose exec -T db psql -U supabase_admin -d \"$DB_NAME\" -f /docker-entrypoint-initdb.d/init-scripts/99-jwt.sql — sonra tekrar doğrula, başarılıysa 'docker compose up -d api auth rest realtime storage' ile elle aç."
  exit 1
fi
if [ "$ROLLER_JWT_SORUNLU" -eq 0 ]; then
  ok "Roller/JWT senkron (doğrulandı)"
else
  warn "99-roles.sql'de bir sorun vardı (yukarıya bak, JWT doğrulandı) — restore.sh devam ediyor, ama restore sonrası GERÇEK bir tarayıcıdan giriş/booking testi yapmadan 'bitti' sayma."
fi

# ── 7) Storage geri yükleme — atomik, eski hâl kaybolmuyor ──────────────────
if [ -f "$YEDEK_DIR/storage.tar.gz" ]; then
  log "Storage geri yükleniyor..."
  STORAGE_DIR="$SCRIPT_DIR/volumes/storage"
  ESKI_YEDEK="$SCRIPT_DIR/volumes/storage.alt-$(date -u +%Y%m%dT%H%M%SZ)"
  TMP_STORAGE="$SCRIPT_DIR/volumes/.tmp-storage-restore"
  rm -rf "$TMP_STORAGE"
  mkdir -p "$TMP_STORAGE"
  if ! tar -xzp --numeric-owner -f "$YEDEK_DIR/storage.tar.gz" -C "$TMP_STORAGE" 2>>"$LOG_FILE"; then
    rm -rf "$TMP_STORAGE"
    fehler "Storage arşivi açılamadı" "tar hata verdi (bkz. $LOG_FILE)" "geçerli bir tar.gz" \
      "Veritabanı ZATEN geri yüklendi — yalnız storage (dosyalar) eski hâlinde kaldı. Arşivi kontrol et, elle tekrar dene: tar -xzpf \"$YEDEK_DIR/storage.tar.gz\" -C \"$SCRIPT_DIR/volumes\""
  else
    ESKI_TASINDI=0
    if [ -d "$STORAGE_DIR" ]; then
      mv "$STORAGE_DIR" "$ESKI_YEDEK"
      ESKI_TASINDI=1
    fi
    # O-89 (onprem denetimi): bu `mv` başarısız olursa ve eski dizin bir satır
    # önce taşınmışsa, kutu STORAGE'SIZ kalır (ne eski ne yeni yerinde). Bu
    # yüzden başarısızlıkta eskiyi HEMEN geri koyuyoruz — yarım bir hâl asla
    # kalıcı olmasın.
    if ! mv "$TMP_STORAGE/storage" "$STORAGE_DIR" 2>>"$LOG_FILE"; then
      if [ "$ESKI_TASINDI" -eq 1 ]; then
        mv "$ESKI_YEDEK" "$STORAGE_DIR" 2>>"$LOG_FILE" || true
      fi
      rm -rf "$TMP_STORAGE"
      fehler "Yeni storage yerine taşınamadı" "mv hatası (bkz. $LOG_FILE)" "başarılı bir mv" \
        "Eski storage GERİ KONULMAYA ÇALIŞILDI (\"$STORAGE_DIR\" hâlâ eski hâliyle olmalı — 'ls \"$STORAGE_DIR\"' ile doğrula). Veritabanı ZATEN geri yüklendi. Disk/izin sorununu çöz, sonra storage'ı elle aç: tar -xzpf \"$YEDEK_DIR/storage.tar.gz\" -C \"$SCRIPT_DIR/volumes\" (önce mevcut '$STORAGE_DIR'i kendin taşı)."
    else
      rm -rf "$TMP_STORAGE"
      ok "Storage geri yüklendi (eski hâl korunuyor: $(basename "$ESKI_YEDEK"))"
    fi
  fi
else
  warn "Yedekte storage.tar.gz yok — storage (reçete görüntüleri vb.) DEĞİŞTİRİLMEDİ, mevcut hâliyle kalıyor."
fi

# ── 8) Servisleri geri aç — migration self-healing burada normal şekilde çalışır ─
log "Servisler yeniden başlatılıyor..."
docker compose up -d api auth rest realtime storage >>"$LOG_FILE" 2>&1
for i in $(seq 1 60); do
  ST="$(docker inspect praxura-api --format '{{.State.Health.Status}}' 2>/dev/null || echo '?')"
  [ "$ST" = "healthy" ] && break
  sleep 2
done
if [ "$ST" = "healthy" ]; then
  ok "api sağlıklı"
else
  warn "api 120 sn içinde sağlıklı olmadı (son durum: ${ST}) — 'docker compose logs api --tail 50' ile bak."
fi
SATIR_SAYISI="$(docker compose exec -T db psql -U postgres -d "$DB_NAME" -tAc "SELECT count(*) FROM praxura_migrations;" 2>>"$LOG_FILE" | tr -d '[:space:]')"
ok "praxura_migrations: ${SATIR_SAYISI:-?} satır"

log ""
log "Not: '_supabase' veritabanı (analytics/realtime tenant metriği) bu yedeğin"
log "kapsamı dışındaydı ve geri gelmedi — bilinçli bir sınır, hata değil."
log ""
log "Eski veritabanı SİLİNMEDİ — '${ESKI_DB_ADI}' adıyla duruyor. Yeni hâlden"
log "memnun olduktan sonra elle temizleyebilirsin:"
log "  docker compose exec -T db psql -U supabase_admin -d template1 -c 'DROP DATABASE \"${ESKI_DB_ADI}\";'"
log ""
log "Bitti — kaynak: $(basename "$YEDEK_DIR"), sonuç: ok"
