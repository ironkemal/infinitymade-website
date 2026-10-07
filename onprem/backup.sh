#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — backup.sh (O-26, RELEASE-STANDARD.md §4.3-4.7/§6.6)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 13.09.2026 · Tasarım: onprem ajanıyla iki turda kilitlendi
#  (onprem/REGISTER.md O-26). NICHT ohne erneute Konsultation umbauen.
#
#  §4.3'ün "Faz 2.3'ün gecelik yedeğiyle aynı kod, farklı tetikleyici" kuralı
#  BUDUR: iki çağıran var, ikisi de bu tek script'i çağırır.
#    1. `praxura-backup.timer` (kurulu, koşulsuz) → `backup.sh --sebep nightly`
#    2. `update.sh` (yalnız bekleyen migration VARSA) → `backup.sh --sebep vor-migration`
#  Elle test için: `bash backup.sh --sebep manuel`
#
#  Ne YAZAR: <hedef>/<sebep>-<zaman>/{storage.tar.gz, db.dump, backup.meta.json}.
#  Storage ÖNCE, DB SONRA (DB satırı olmayan bir dosyaya işaret etmesin diye —
#  ters sırada tersi olurdu: sahipsiz dosya kalır, zararsız). Tamamı önce
#  `.tmp-<ad>/` altına yazılır, hepsi bitince TEK bir `mv` ile son ada geçer —
#  yarıda kesilen bir yedek asla `restore.sh`'a ya da rotasyona geçerli
#  görünmesin diye (onprem, O-26 1. tur).
#
#  Kilit: `update.sh` ile AYNI `.praxura-update.lock` dosyasını paylaşır — ikisi
#  aynı anda koşmasın (biri container'ı yeniden başlatırken diğeri dump alırsa
#  yarım bir yedek çıkar). `update.sh` `backup.sh`'ı KENDİ kilidini tutarken
#  çağırır — bu yüzden çağıran `PRAXURA_LOCK_HELD=1` set eder ve bu script
#  kilidi TEKRAR almaya çalışmaz (aksi hâlde aynı süreç ağacında kendi
#  kendini bekleyip kilitlenirdi).
#
#  Kapsam (bu turda YOK, bilinçli): SSH/rsync hedef sürücüsü (yalnız dizin
#  yolu — lokal ya da önceden mount edilmiş NAS/SMB/NFS), restore.sh.
#
#  07.10.2026 (O-173, guvenlik S-22): Verschlüsselte Sicherung mit age.
#  db.dump.age, storage.tar.gz.age, caddy-pki.tar.gz.age. Kein Klartext auf dem Ziel
#  ($SCRIPT_DIR/.backup-tmp als lokaler Arbeitsordner, per trap bereinigt).
#  backup.meta.json bleibt Klartext mit verschluesselung=age-v1, sha256-Map und hmac
#  (HMAC-SHA256 über DEK via api-Container, Domain praxura-backup-meta-v1).
#  Fail-closed wenn age fehlt oder BACKUP_EMPFAENGER leer/ungültig.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/backup.log"
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
SEBEP="nightly"
while [ $# -gt 0 ]; do
  case "$1" in
    --sebep) SEBEP="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done
case "$SEBEP" in
  nightly|vor-migration|manuel) ;;
  *)
    fehler "Bilinmeyen --sebep" "$SEBEP" "nightly|vor-migration|manuel" "Doğru değerle yeniden çağır."
    exit 2
    ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  log "Keine .env gefunden — Box wurde nie eingerichtet. Beende."
  exit 0
fi

env_wert() {
  awk -F= -v k="$1" '$1==k{ sub(/^[^=]*=/,""); print; f=1 } END{ if(!f) print "" }' "$ENV_FILE" 2>/dev/null || true
}

# ── Verschlüsselungsvoraussetzungen (O-173, guvenlik S-22: Fail-Closed) ───────
if ! command -v age >/dev/null 2>&1; then
  fehler "age fehlt" "age nicht auf dem Host installiert" "installiertes age-Paket" \
    "Sicherungswerkzeug installieren: sudo apt-get install -y age (oder sudo bash install.sh --sicherungsschluessel)."
  exit 1
fi

BACKUP_EMPFAENGER="$(env_wert BACKUP_EMPFAENGER)"
if [ -z "$BACKUP_EMPFAENGER" ]; then
  fehler "BACKUP_EMPFAENGER nicht gesetzt" "leer in .env" "öffentlicher age-Schlüssel (age1...)" \
    "Sicherungsschlüssel einrichten: sudo bash install.sh --sicherungsschluessel"
  exit 1
fi
if ! printf '%s' "$BACKUP_EMPFAENGER" | grep -qE '^age1[0-9a-z]{58}$'; then
  fehler "BACKUP_EMPFAENGER ungültig" "$BACKUP_EMPFAENGER" "Format ^age1[0-9a-z]{58}$ (62 Zeichen)" \
    "Sicherungsschlüssel neu einrichten: sudo bash install.sh --sicherungsschluessel"
  exit 1
fi

# ── Kilit — update.sh:in ÖNCE Schritt 0'da açtığı deseninin aynısı ─────────
if [ -z "${PRAXURA_LOCK_HELD:-}" ]; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "update.sh (ya da başka bir backup.sh çalışması) kilidi tutuyor — bu tur atlandı."
    exit 0
  fi
fi

DB_NAME="$(env_wert POSTGRES_DB)"
[ -n "$DB_NAME" ] || DB_NAME=postgres

# ── Hedef — yalnız dizin sürücüsü (O-26 1. tur) ────────────────────────────
BACKUP_ZIEL_HAM="$(env_wert BACKUP_ZIEL)"
if [ -n "$BACKUP_ZIEL_HAM" ]; then
  HEDEF_DIR="$BACKUP_ZIEL_HAM"
  ZIEL_DISI=true
else
  HEDEF_DIR="$SCRIPT_DIR/backups"
  ZIEL_DISI=false
  warn "BACKUP_ZIEL boş — yedek KUTU İÇİNDE kalıyor, disk arızasında veritabanıyla BİRLİKTE kaybolur (RELEASE-STANDARD.md §6.6). .env'de BACKUP_ZIEL'i mount edilmiş bir dizine ayarla, sonra kutuyu yeniden başlat."
fi

# O-154 (KHS K2.10, 02.10.2026): ein externes Ziel (USB-Platte, NAS) wird NIE
# selbst angelegt. Vorher machte 'mkdir -p' aus einem nicht eingesteckten
# Laufwerk still einen leeren Ordner auf DERSELBEN Platte wie die Datenbank —
# die Sicherung "lief", schuetzte aber vor nichts. install.sh (Schritt 12)
# legt die Markierungsdatei an; fehlt sie, ist das Ziel nicht eingebunden.
if [ "$ZIEL_DISI" = true ] && [ ! -f "$HEDEF_DIR/.praxura-backup-ziel" ]; then
  fehler "Yedek hedefi bağlı değil" "$HEDEF_DIR/.praxura-backup-ziel yok" "bağlı (mount edilmiş) hedef + işaret dosyası"     "Harici disk/NAS takılı ve bağlı mı? Bağlıysa ve hedef yeni ise bir kez: sudo touch '$HEDEF_DIR/.praxura-backup-ziel' — yedek BİLEREK kutunun kendi diskine yazılmadı."
  exit 1
fi
if ! mkdir -p "$HEDEF_DIR" 2>>"$LOG_FILE"; then
  fehler "Yedek hedefi oluşturulamadı/erişilemedi" "$HEDEF_DIR" "yazılabilir bir dizin" \
    "BACKUP_ZIEL doğru mu, mount edilmiş mi (NAS/SMB/NFS ise bağlı olduğundan emin ol) kontrol et."
  exit 1
fi
chmod 700 "$HEDEF_DIR" 2>/dev/null || true

ZAMAN="$(date -u +%Y%m%dT%H%M%SZ)"
AD="${SEBEP}-${ZAMAN}"
TMP_DIR="$HEDEF_DIR/.tmp-${AD}"
NIHAI_DIR="$HEDEF_DIR/${AD}"
LOKAL_TMP="$SCRIPT_DIR/.backup-tmp"

rm -rf "$TMP_DIR" "$LOKAL_TMP"
mkdir -p "$TMP_DIR" "$LOKAL_TMP"
chmod 700 "$TMP_DIR" "$LOKAL_TMP"
temizlendi=0
temizle() {
  rm -rf "$LOKAL_TMP"
  [ "$temizlendi" -eq 1 ] || rm -rf "$TMP_DIR"
}
trap temizle EXIT INT TERM

# ── Yer kontrolü — §4.3 madde 4.1: 2×(db+storage)+pay + Box-Platte (O-173) ─
DB_BOYUTU_BYTE="$(docker compose exec -T db psql -U postgres -d "$DB_NAME" -tAc 'SELECT pg_database_size(current_database());' 2>>"$LOG_FILE" | tr -d '[:space:]')"
STORAGE_BOYUTU_BYTE="$(du -sb "$SCRIPT_DIR/volumes/storage" 2>/dev/null | awk '{print $1}')"
[ -n "$STORAGE_BOYUTU_BYTE" ] || STORAGE_BOYUTU_BYTE=0
BOS_ALAN_KB="$(df -k "$HEDEF_DIR" 2>/dev/null | tail -n 1 | awk '{print $4}')"
BOS_ALAN_BOX_KB="$(df -k "$SCRIPT_DIR" 2>/dev/null | tail -n 1 | awk '{print $4}')"

if [ -n "$DB_BOYUTU_BYTE" ] && [ "$DB_BOYUTU_BYTE" -gt 0 ] 2>/dev/null; then
  # 1) Box-Platte: DB-Größe + 100 MB Puffer für den lokalen Arbeitsordner ($LOKAL_TMP)
  GEREKEN_BOX_KB=$(( (DB_BOYUTU_BYTE / 1024) + 102400 ))
  if [ -n "$BOS_ALAN_BOX_KB" ] && [ "$BOS_ALAN_BOX_KB" -lt "$GEREKEN_BOX_KB" ]; then
    fehler "Kutu diskinde yerel yedek çalışma alanı için yeterli yer yok" \
      "${BOS_ALAN_BOX_KB} KB boş ($SCRIPT_DIR)" "en az ${GEREKEN_BOX_KB} KB (DB + pay)" \
      "Kutu diskinde yer aç. Dolu diskte dump almak veritabanını da tehlikeye atabilir."
    exit 1
  fi

  # 2) Ziel-Laufwerk: 2×(DB+Storage) + 100 MB Puffer
  if [ -n "$BOS_ALAN_KB" ]; then
    GEREKEN_KB=$(( ((DB_BOYUTU_BYTE + STORAGE_BOYUTU_BYTE) * 2 / 1024) + 102400 ))
    if [ "$BOS_ALAN_KB" -lt "$GEREKEN_KB" ]; then
      fehler "Yedek için yeterli disk yeri yok" "${BOS_ALAN_KB} KB boş ($HEDEF_DIR)" "en az ${GEREKEN_KB} KB (2×(DB+storage)+pay)" \
        "RELEASE-STANDARD.md §6.6: dolu diskte yedek denemek Postgres'i de durdurabilir. Disk temizle, sonra 'bash backup.sh --sebep $SEBEP' ile yeniden dene."
      exit 1
    fi
  fi
else
  warn "Disk yeri / DB boyutu ölçülemedi (db henüz erişilemiyor olabilir) — yer kontrolü atlandı, asıl adımlar aşağıda başarısız olacak."
fi

# ── 1) Storage arşivi — DB'DEN ÖNCE (direkt streamen & verschlüsseln) ───────
log "Storage arşivleniyor ve şifreleniyor..."
if [ -d "$SCRIPT_DIR/volumes/storage" ]; then
  set +e
  tar -czf - -C "$SCRIPT_DIR/volumes" storage 2>>"$LOG_FILE" \
    | age -r "$BACKUP_EMPFAENGER" -o "$TMP_DIR/storage.tar.gz.age" 2>>"$LOG_FILE"
  st_pipes=("${PIPESTATUS[@]}")
  set -e
  if [ "${st_pipes[0]:-1}" -ne 0 ] || [ "${st_pipes[1]:-1}" -ne 0 ] || [ ! -s "$TMP_DIR/storage.tar.gz.age" ]; then
    fehler "Storage arşivi/şifreleme başarısız" "tar=${st_pipes[0]:-?}, age=${st_pipes[1]:-?} (bkz. $LOG_FILE)" "başarılı bir storage.tar.gz.age" \
      "Disk/izin/age sorunlarını kontrol et."
    exit 1
  fi
  ok "Storage arşivlendi ve şifrelendi ($(du -h "$TMP_DIR/storage.tar.gz.age" 2>/dev/null | cut -f1))"
else
  warn "onprem/volumes/storage dizini yok — storage arşivi atlandı (henüz hiç dosya yüklenmemiş olabilir)."
fi

sema_versiyonu_oku() {
  docker compose exec -T db psql -U postgres -d "$DB_NAME" -tAc "SELECT COALESCE(MAX(version), 'none') FROM praxura_migrations;" 2>>"$LOG_FILE" | tr -d '[:space:]' || true
}

# ── 1b) Caddy-Zertifizierungsstelle (O-153, KHS K2.10, O-173 verschlüsselt) ─
# Bei TLS "internal" stellt Caddy eine eigene Wurzel-CA aus, die JEDER
# Praxisrechner/jedes Tablet einmalig als vertrauenswuerdig importiert hat.
# Kopie erfolgt lokal nach $LOKAL_TMP (nie Klartext auf dem Ziel) und wird
# direkt in caddy-pki.tar.gz.age verschlüsselt.
if [ "$(env_wert CADDY_TLS_MODUS)" = "acmedns" ]; then
  ok "acmedns-Box: keine interne CA, caddy/pki wird bewusst nicht gesichert (S-43/S-47)"
elif docker compose cp caddy:/data/caddy/pki "$LOKAL_TMP/caddy-pki" >>"$LOG_FILE" 2>&1; then
  set +e
  tar -czf - -C "$LOKAL_TMP" caddy-pki 2>>"$LOG_FILE" \
    | age -r "$BACKUP_EMPFAENGER" -o "$TMP_DIR/caddy-pki.tar.gz.age" 2>>"$LOG_FILE"
  pki_pipes=("${PIPESTATUS[@]}")
  set -e
  rm -rf "$LOKAL_TMP/caddy-pki"
  if [ "${pki_pipes[0]:-1}" -eq 0 ] && [ "${pki_pipes[1]:-1}" -eq 0 ] && [ -s "$TMP_DIR/caddy-pki.tar.gz.age" ]; then
    ok "Caddy-Wurzel-CA gesichert und verschlüsselt"
  else
    rm -f "$TMP_DIR/caddy-pki.tar.gz.age"
    warn "Caddy-PKI Archivierung/Verschlüsselung fehlgeschlagen — übersprungen."
  fi
else
  rm -rf "$LOKAL_TMP/caddy-pki"
  warn "Caddy-PKI konnte nicht kopiert werden (Let's-Encrypt-Box oder caddy aus) — übersprungen."
fi

# ── 2) Veritabanı dump'ı ────────────────────────────────────────────────────
# Dump landet im lokalen Arbeitsordner $LOKAL_TMP auf der Box-Platte (chmod 700),
# wird dort per pg_restore -l geprüft und anschließend verschlüsselt nach
# $TMP_DIR/db.dump.age geschrieben. Die unverschlüsselte lokale Datei wird sofort gelöscht.
SEMA_ONCE="$(sema_versiyonu_oku)"
log "Veritabanı yedekleniyor..."
if ! docker compose exec -T db pg_dump -U postgres -d "$DB_NAME" -Fc > "$LOKAL_TMP/db.dump" 2>>"$LOG_FILE"; then
  fehler "pg_dump başarısız" "pg_dump hata verdi (bkz. $LOG_FILE)" "başarılı bir pg_dump çıktısı" \
    "'db' konteynerinin çalıştığından ve .env'deki POSTGRES_DB/POSTGRES_PASSWORD'ün doğru olduğundan emin ol."
  exit 1
fi
if [ ! -s "$LOKAL_TMP/db.dump" ]; then
  fehler "Yedek dosyası boş çıktı" "0 byte" "dolu bir pg_dump çıktısı" "pg_dump sessizce boş döndü — 'db' konteynerinin sağlığını kontrol et."
  exit 1
fi

# ── 3) Bütünlük testi — pg_restore -l (O-77'den taşındı) ───────────────────
KONTROL_HEDEF="/tmp/praxura-yedek-kontrol.dump"
if ! docker compose cp "$LOKAL_TMP/db.dump" "db:$KONTROL_HEDEF" >>"$LOG_FILE" 2>&1 \
   || ! docker compose exec -T db pg_restore -l "$KONTROL_HEDEF" >/dev/null 2>>"$LOG_FILE"; then
  docker compose exec -T db rm -f "$KONTROL_HEDEF" >/dev/null 2>&1 || true
  fehler "Yedek dosyası bozuk çıktı (pg_restore -l başarısız)" "pg_restore -l hata verdi (bkz. $LOG_FILE)" \
    "geçerli, listelenebilir bir pg_dump arşivi" "Disk/ağ sorunu dump'ı yarım bırakmış olabilir. Yeniden dene."
  exit 1
fi
docker compose exec -T db rm -f "$KONTROL_HEDEF" >/dev/null 2>&1 || true

SCHEMA_VERSION="$(sema_versiyonu_oku)"
if [ -n "$SEMA_ONCE" ] && [ -n "$SCHEMA_VERSION" ] && [ "$SEMA_ONCE" != "$SCHEMA_VERSION" ]; then
  fehler "Şema sürümü dump sırasında değişti — yedek iptal edildi" \
    "önce: ${SEMA_ONCE} · sonra: ${SCHEMA_VERSION}" "pg_dump boyunca sabit bir sürüm" \
    "Bir PM2 işçisi tam bu yedek anında migration uyguladı — künye yanlış sürüm iddia ederdi. Yeniden dene; sık tekrarlanıyorsa 'api' konteynerinin neden yeniden başladığını incele (OOM? mem_limit yok — O-48 yalnız Kong'a verildi)."
  exit 1
fi

# Lokale Dump-Datei mit age verschlüsseln, danach Klartext löschen
log "Veritabanı şifreleniyor (age)..."
if ! age -r "$BACKUP_EMPFAENGER" -o "$TMP_DIR/db.dump.age" "$LOKAL_TMP/db.dump" 2>>"$LOG_FILE"; then
  fehler "Veritabanı şifreleme başarısız (age)" "age hata verdi (bkz. $LOG_FILE)" "başarılı bir db.dump.age" \
    "BACKUP_EMPFAENGER anahtarını ve disk izinlerini kontrol et."
  exit 1
fi
rm -f "$LOKAL_TMP/db.dump"
ok "Veritabanı yedeklendi, doğrulandı ve şifrelendi ($(du -h "$TMP_DIR/db.dump.age" 2>/dev/null | cut -f1))"

# ── 4) Künye — backup.meta.json (§4.4, O-173 verschluesselung/sha256/hmac) ─
parmak_izi_dek() {
  local fp=""
  if docker compose ps --status running -q api 2>/dev/null | grep -q .; then
    fp="$(docker compose exec -T api node -e '
      const crypto = require("crypto");
      const k = process.env.DATA_ENCRYPTION_KEY || "";
      if (!k) { process.exit(1); }
      process.stdout.write(crypto.createHmac("sha256", k).update("praxura-backup-fingerprint-v1:dek").digest("hex"));
    ' 2>>"$LOG_FILE" || true)"
  fi
  if [ -z "$fp" ]; then
    fp="$(docker compose run --rm --no-deps -T api node -e '
      const crypto = require("crypto");
      const k = process.env.DATA_ENCRYPTION_KEY || "";
      if (!k) { process.exit(1); }
      process.stdout.write(crypto.createHmac("sha256", k).update("praxura-backup-fingerprint-v1:dek").digest("hex"));
    ' 2>>"$LOG_FILE" || true)"
  fi
  printf '%s' "$fp" | head -c 16
}
parmak_izi_db_taraf() {
  local envvar="$1"
  local alan="$2"
  local sqldosya="$LOKAL_TMP/.fp-${alan}.sql"
  local sonuc=""
  printf "SELECT encode(hmac(:'dom', :'key', 'sha256'), 'hex');\n" > "$sqldosya"
  if docker compose cp "$sqldosya" "db:/tmp/.fp-${alan}.sql" >>"$LOG_FILE" 2>&1; then
    sonuc="$(docker compose exec -T db sh -c "psql -U postgres -d \"\$PGDATABASE\" -v key=\"\$${envvar}\" -v dom=\"praxura-backup-fingerprint-v1:${alan}\" -tA -f /tmp/.fp-${alan}.sql" 2>>"$LOG_FILE" | tr -d '[:space:]')"
    docker compose exec -T db rm -f "/tmp/.fp-${alan}.sql" >/dev/null 2>&1 || true
  fi
  rm -f "$sqldosya"
  printf '%s' "$sonuc" | head -c 16
}

DEK_FP="$(parmak_izi_dek || true)"
JWT_FP="$(parmak_izi_db_taraf JWT_SECRET jwt || true)"
PGPW_FP="$(parmak_izi_db_taraf POSTGRES_PASSWORD pgpw || true)"
[ -n "$DEK_FP" ] || { DEK_FP=null; warn "DATA_ENCRYPTION_KEY parmak izi alınamadı (api konteyneri ayakta değil olabilir) — künyede null, yedek yine de tutuldu."; }
[ -n "$JWT_FP" ] || { JWT_FP=null; warn "JWT_SECRET parmak izi alınamadı — künyede null."; }
[ -n "$PGPW_FP" ] || { PGPW_FP=null; warn "POSTGRES_PASSWORD parmak izi alınamadı — künyede null."; }

[ -n "$SCHEMA_VERSION" ] || SCHEMA_VERSION=null
APP_VERSION="$(env_wert PRAXURA_API_IMAGE)"
[ -n "$APP_VERSION" ] || APP_VERSION=null
IMAGE_DIGEST="$(docker inspect --format='{{.Image}}' praxura-api 2>/dev/null || true)"
[ -n "$IMAGE_DIGEST" ] || IMAGE_DIGEST=null
DB_BYTES_FIELD="$(wc -c < "$TMP_DIR/db.dump.age" | tr -d '[:space:]')"
STORAGE_BYTES_FIELD=0
[ -f "$TMP_DIR/storage.tar.gz.age" ] && STORAGE_BYTES_FIELD="$(wc -c < "$TMP_DIR/storage.tar.gz.age" | tr -d '[:space:]')"

# SHA256-Map aller .age-Dateien im Ziel (pfadsicher ohne ls, LC_ALL=C sortiert)
SHA_LINES=""
for f in "$TMP_DIR"/*.age; do
  [ -f "$f" ] || continue
  fname="$(basename "$f")"
  fsha="$(sha256sum "$f" | awk '{print $1}')"
  if [ -n "$SHA_LINES" ]; then
    SHA_LINES="${SHA_LINES}"$'\n'"${fname}=${fsha}"
  else
    SHA_LINES="${fname}=${fsha}"
  fi
done
if [ -n "$SHA_LINES" ]; then
  SHA_LINES="$(printf '%s\n' "$SHA_LINES" | LC_ALL=C sort)"
fi

[ -n "$SHA_LINES" ] || {
  fehler "Hiçbir şifreli yedek dosyası üretilemedi" "TMP_DIR boş" "en az db.dump.age" "Yedek adımlarını kontrol et."
  exit 1
}

TAKEN_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Kanonik metin ve HMAC hesaplama (Domain: praxura-backup-meta-v1)
kanonischer_meta_text() {
  local v="$1" empf="$2" taken="$3" seb="$4" sch="$5" db_b="$6" st_b="$7" sha_l="$8"
  printf 'verschluesselung=%s\nbackup_empfaenger=%s\ntaken_at=%s\nsebep=%s\nschema_version=%s\ndump_bytes=%s\nstorage_bytes=%s\n%s\n' \
    "$v" "$empf" "$taken" "$seb" "$sch" "$db_b" "$st_b" "$sha_l"
}
KANONISCH="$(kanonischer_meta_text "age-v1" "$BACKUP_EMPFAENGER" "$TAKEN_AT" "$SEBEP" "$SCHEMA_VERSION" "$DB_BYTES_FIELD" "$STORAGE_BYTES_FIELD" "$SHA_LINES")"

meta_hmac_berechnen() {
  local input="$1"
  local hmac=""
  if docker compose ps --status running -q api 2>/dev/null | grep -q .; then
    hmac="$(printf '%s' "$input" | docker compose exec -T api node -e '
      const fs = require("fs");
      const crypto = require("crypto");
      const k = process.env.DATA_ENCRYPTION_KEY || "";
      if (!k) { process.exit(1); }
      const data = fs.readFileSync(0, "utf8");
      process.stdout.write(crypto.createHmac("sha256", k).update("praxura-backup-meta-v1\n" + data).digest("hex"));
    ' 2>>"$LOG_FILE" || true)"
  fi
  if [ -z "$hmac" ]; then
    hmac="$(printf '%s' "$input" | docker compose run --rm --no-deps -T api node -e '
      const fs = require("fs");
      const crypto = require("crypto");
      const k = process.env.DATA_ENCRYPTION_KEY || "";
      if (!k) { process.exit(1); }
      const data = fs.readFileSync(0, "utf8");
      process.stdout.write(crypto.createHmac("sha256", k).update("praxura-backup-meta-v1\n" + data).digest("hex"));
    ' 2>>"$LOG_FILE" || true)"
  fi
  printf '%s' "$hmac"
}

HMAC_WERT="$(meta_hmac_berechnen "$KANONISCH" || true)"
if [ -z "$HMAC_WERT" ]; then
  fehler "HMAC-Signatur konnte nicht berechnet werden" "leere Ausgabe aus api-Container" "gültiger HMAC-SHA256" \
    "Prüfen, ob Docker/api läuft und DATA_ENCRYPTION_KEY in .env gesetzt ist."
  exit 1
fi

json_deger() {
  # null olduğu gibi (tırnaksız) kalır, aksi hâlde tek satır string olarak tırnaklanır.
  [ "$1" = "null" ] && printf 'null' || printf '"%s"' "$1"
}

SHA_JSON_BLOCK="$(printf '%s\n' "$SHA_LINES" | awk -F= '{lines[NR]=sprintf("    \"%s\": \"%s\"", $1, $2)} END {for (i=1; i<=NR; i++) {printf "%s%s\n", lines[i], (i<NR?",":"")}}' || true)"

cat > "$TMP_DIR/backup.meta.json" <<EOF
{
  "verschluesselung": "age-v1",
  "backup_empfaenger": "${BACKUP_EMPFAENGER}",
  "sebep": "${SEBEP}",
  "taken_at": "${TAKEN_AT}",
  "schema_version": $(json_deger "$SCHEMA_VERSION"),
  "app_version": $(json_deger "$APP_VERSION"),
  "image_digest": $(json_deger "$IMAGE_DIGEST"),
  "dump_bytes": ${DB_BYTES_FIELD},
  "storage_bytes": ${STORAGE_BYTES_FIELD},
  "ziel_ausserhalb": ${ZIEL_DISI},
  "data_key_fingerprint": $(json_deger "$DEK_FP"),
  "jwt_secret_fingerprint": $(json_deger "$JWT_FP"),
  "postgres_password_fingerprint": $(json_deger "$PGPW_FP"),
  "sha256": {
${SHA_JSON_BLOCK}
  },
  "hmac": "${HMAC_WERT}"
}
EOF

# ── 5) Atomik geçiş — hepsi bitince TEK mv ──────────────────────────────────
rm -rf "$NIHAI_DIR"
mv "$TMP_DIR" "$NIHAI_DIR"
temizlendi=1
chmod 700 "$NIHAI_DIR"
ok "Yedek tamam: $(basename "$NIHAI_DIR") ($([ "$ZIEL_DISI" = true ] && echo "kutu dışı" || echo "kutu İÇİNDE, bkz. yukarıdaki uyarı"))"
if [ "$DEK_FP" != null ]; then
  warn "DATA_ENCRYPTION_KEY olmadan bu yedekteki şifreli hasta verisi geri gelmez (O-29) — künyedeki parmak izi ${DEK_FP}, .env'i ayrı ve güvenli sakla."
fi

# ── 6) Rotasyon — ad uzayı SEBEBE göre ayrı, kota §6.6 ─────────────────────
# vor-migration: yalnız son 3 (RELEASE-STANDARD §4.3 "en az son 3").
# nightly/manuel: son 14 GÜN'ün hepsi + her geçmiş takvim ayının EN ESKİ
# gecelik yedeği, 12 ay geriye. "En eski" seçimi geriye dönük değişmez
# (onprem, O-26 2. tur) — "aya en yakın" tarihe göre kayardı.
rotasyon_vor_migration() {
  ls -1dt "$HEDEF_DIR"/vor-migration-*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
}
rotasyon_nightly() {
  local simdi kesim_gun kesim_ay tutulacak d ad tarih_kismi yil ay gun saat dakika saniye yil_ay zaman_epoch mevcut
  simdi="$(date -u +%s)"
  kesim_gun=$(( simdi - 14*86400 ))
  kesim_ay=$(( simdi - 366*86400 ))
  tutulacak=""
  # 14 günden yeni olanların hepsi kalır; 14 günden eski ama 12 aydan yeni
  # olanlardan her (yıl,ay) için yalnız EN ESKİSİ kalır.
  declare -A ay_en_eski
  for d in $(ls -1d "$HEDEF_DIR"/nightly-*/ "$HEDEF_DIR"/manuel-*/ 2>/dev/null | sort); do
    ad="$(basename "$d")"
    tarih_kismi="${ad#*-}" # 20260913T010000Z
    # ⚠️ GNU `date -d` bu sıkışık biçimi (ayraçsız) OKUYAMIYOR (gerçek kutuda
    # denendi: "invalid date"). Önce ayraçlı forma çevrilmesi gerekiyor.
    yil="${tarih_kismi:0:4}"; ay="${tarih_kismi:4:2}"; gun="${tarih_kismi:6:2}"
    saat="${tarih_kismi:9:2}"; dakika="${tarih_kismi:11:2}"; saniye="${tarih_kismi:13:2}"
    yil_ay="${yil}${ay}"
    zaman_epoch="$(date -u -d "${yil}-${ay}-${gun} ${saat}:${dakika}:${saniye}" +%s 2>/dev/null || echo 0)"
    if [ "$zaman_epoch" -le 0 ] 2>/dev/null; then
      # Tarih ayrıştırılamadıysa güvenli yön SİLMEMEK — belirsizlikte yedek
      # tutulur, silinmez (onprem, O-26 2. tur).
      tutulacak="$tutulacak $d"
      continue
    fi
    if [ "$zaman_epoch" -ge "$kesim_gun" ]; then
      tutulacak="$tutulacak $d"
    elif [ "$zaman_epoch" -ge "$kesim_ay" ]; then
      mevcut="${ay_en_eski[$yil_ay]:-}"
      if [ -z "$mevcut" ]; then
        ay_en_eski[$yil_ay]="$d"
      fi
    fi
    # kesim_ay'dan da eskiyse hiçbir kümeye girmez → silinir
  done
  for d in "${ay_en_eski[@]:-}"; do
    [ -n "$d" ] && tutulacak="$tutulacak $d"
  done
  for d in $(ls -1d "$HEDEF_DIR"/nightly-*/ "$HEDEF_DIR"/manuel-*/ 2>/dev/null); do
    case " $tutulacak " in
      *" $d "*) ;;
      *) rm -rf "$d" ;;
    esac
  done
}
if [ "$SEBEP" = "vor-migration" ]; then
  rotasyon_vor_migration
else
  rotasyon_nightly || warn "Rotasyon sırasında bir hata oldu — yedek yine de alındı, eski dosyalar bir sonraki turda temizlenmeye çalışılacak."
fi

# ── 7) Kota — §6.6: sabit üst sınır, aşılırsa en eski gecelik önce gider ───
KOTA_GB="$(env_wert BACKUP_MAX_GB)"
if [ -n "$KOTA_GB" ] && [ "$KOTA_GB" -gt 0 ] 2>/dev/null; then
  kota_kb=$(( KOTA_GB * 1024 * 1024 ))
  while true; do
    kullanilan_kb="$(du -sk "$HEDEF_DIR" 2>/dev/null | awk '{print $1}')"
    [ -n "$kullanilan_kb" ] || break
    [ "$kullanilan_kb" -le "$kota_kb" ] && break
    en_eski="$(ls -1dt "$HEDEF_DIR"/nightly-*/ "$HEDEF_DIR"/manuel-*/ 2>/dev/null | tail -n 1)"
    [ -n "$en_eski" ] || { warn "Yedek dizini kotayı (${KOTA_GB} GB) aşıyor ve silinecek gecelik yedek kalmadı — göç-öncesi yedeklere dokunulmuyor, elle müdahale gerek."; break; }
    warn "Kota (${KOTA_GB} GB) aşıldı — en eski gecelik yedek siliniyor: $(basename "$en_eski")"
    rm -rf "$en_eski"
  done
fi

log "Bitti — sebep: $SEBEP, sonuç: ok"
