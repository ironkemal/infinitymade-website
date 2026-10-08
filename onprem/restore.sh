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
#    bash restore.sh --von <yedek-adı-veya-tam-yol> [--force] [--schluessel <datei>] [--altsicherung]
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
#
#  07.10.2026 (O-173, guvenlik S-22): Unterstützung für verschlüsselte Sicherungen (age-v1).
#  Automatische Formaterkennung; Downgrade-Schutz; Integritätsprüfung (SHA256 aller .age-Dateien
#  + HMAC-Prüfung der Künye via DEK im api-Container) sowie Schlüsselvalidierung (age-keygen -y)
#  vor jedem zerstörenden Schritt; Schlüsselübergabe via --schluessel <datei> oder interaktivem
#  read -rs; builtin printf (Schlüssel nie in ps/Log/Tempfile).
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
SCHLUESSEL_DATEI=""
ALTSICHERUNG=0
while [ $# -gt 0 ]; do
  case "$1" in
    --von) VON="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --schluessel) SCHLUESSEL_DATEI="${2:-}"; shift 2 ;;
    --altsicherung) ALTSICHERUNG=1; shift ;;
    *) shift ;;
  esac
done

if [ -z "$VON" ]; then
  fehler "Argüman eksik" "--von verilmedi" "bash restore.sh --von <yedek-adı-veya-yol> [--force] [--schluessel <datei>] [--altsicherung]" \
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

if [ ! -d "$YEDEK_DIR" ] || [ ! -f "$YEDEK_DIR/backup.meta.json" ]; then
  fehler "Yedek bulunamadı ya da eksik" "$YEDEK_DIR" "backup.meta.json içeren bir dizin" \
    "Adı/yolu kontrol et. Mevcut yedekler: ls -1t \"\$(dirname "$YEDEK_DIR" 2>/dev/null)\" 2>/dev/null"
  exit 1
fi

meta_alan() {
  # backup.sh'ın manifest_feld'iyle aynı desen (update.sh) — jq bağımlılığı yok.
  # ⚠️ KEIN \r in der Klammer: grep -E liest [^…\r] als "nicht Backslash, nicht r" und
  # schnitt Werte am ersten "r" ab (age1…-Schlüssel → HMAC passte nie; Testbox 07.10.2026).
  # CR (Windows/SMB-Kopie) entfernt das folgende tr.
  grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"?[^\",}]*\"?" "$YEDEK_DIR/backup.meta.json" | head -1 \
    | tr -d '\r' | sed -E 's/^"'"$1"'"[[:space:]]*:[[:space:]]*"?//; s/"?$//' || true
  # || true: fehlt das Feld (Altsicherung ohne "verschluesselung"), liefert grep 1 —
  # unter pipefail + set -e beendete das restore.sh OHNE Meldung (Testbox 07.10.2026).
}

M_SEBEP="$(meta_alan sebep)"
M_TAKEN_AT="$(meta_alan taken_at)"
M_SCHEMA="$(meta_alan schema_version)"
M_DUMP_BYTES="$(meta_alan dump_bytes)"
M_DEK_FP="$(meta_alan data_key_fingerprint)"
M_JWT_FP="$(meta_alan jwt_secret_fingerprint)"
M_PGPW_FP="$(meta_alan postgres_password_fingerprint)"
M_VERSCHLUESSELUNG="$(meta_alan verschluesselung)"
M_BACKUP_EMPFAENGER="$(meta_alan backup_empfaenger)"
M_HMAC="$(meta_alan hmac)"

# ── Format-Erkennung & Downgrade-Schutz (O-173) ─────────────────────────────
# Manipulationsverdacht 1: Künye hat hmac, aber verschluesselung ist nicht age-v1
if [ -n "$M_HMAC" ] && [ "$M_VERSCHLUESSELUNG" != "age-v1" ]; then
  fehler "Manipulationsverdacht" "Künye enthält HMAC, aber verschluesselung ist nicht age-v1" "verschluesselung=age-v1" \
    "Sicherung prüfen. Möglicher Manipulations- oder Downgrade-Angriff."
  exit 1
fi

# Manipulationsverdacht 2: .age-Dateien vorhanden, aber verschluesselung ist nicht age-v1
HAT_AGE_DATEI=0
for f in "$YEDEK_DIR"/*.age; do
  if [ -f "$f" ]; then
    HAT_AGE_DATEI=1
    break
  fi
done
if [ "$HAT_AGE_DATEI" -eq 1 ] && [ "$M_VERSCHLUESSELUNG" != "age-v1" ]; then
  fehler "Manipulationsverdacht" "Verschlüsselte .age-Dateien vorhanden, aber verschluesselung ist nicht age-v1" "verschluesselung=age-v1" \
    "Sicherung prüfen. Möglicher Manipulations- oder Downgrade-Angriff."
  exit 1
fi

# Manipulationsverdacht 3: verschluesselung=age-v1, aber Klartext-Dateien im Sicherungsordner vorhanden
if [ "$M_VERSCHLUESSELUNG" = "age-v1" ] && { [ -f "$YEDEK_DIR/db.dump" ] || [ -f "$YEDEK_DIR/storage.tar.gz" ] || [ -f "$YEDEK_DIR/caddy-pki.tar.gz" ]; }; then
  fehler "Manipulationsverdacht: Klartext-Dateien in verschlüsselter Sicherung gefunden" \
    "Klartextdateien vorhanden trotz verschluesselung=age-v1" "nur .age-Dateien bei verschluesselung=age-v1" \
    "Möglicher Manipulationsversuch: Eine verschlüsselte Sicherung darf keine unverschlüsselten Klartext-Dateien enthalten."
  exit 1
fi

IST_VERSCHLUESSELT=0
if [ "$M_VERSCHLUESSELUNG" = "age-v1" ]; then
  IST_VERSCHLUESSELT=1
  if [ ! -f "$YEDEK_DIR/db.dump.age" ]; then
    fehler "Verschlüsselte Sicherungsdatei fehlt" "db.dump.age nicht gefunden in $YEDEK_DIR" "db.dump.age" \
      "Sicherungsverzeichnis ist unvollständig."
    exit 1
  fi
else
  # Altsicherung (Klartext): NUR mit --altsicherung UND Bestätigung KLARTEXT-WIEDERHERSTELLEN
  if [ -f "$YEDEK_DIR/db.dump" ]; then
    if [ "$ALTSICHERUNG" -ne 1 ]; then
      fehler "Klartext-Altsicherung abgelehnt" "Unverschlüsselte Altsicherung ohne --altsicherung aufgerufen" "--altsicherung Schalter" \
        "Klartext-Altsicherungen werden nur mit explizitem Schalter angenommen: bash restore.sh --von ... --altsicherung"
      exit 1
    fi
    warn "Alte unverschlüsselte Sicherung erkannt (--altsicherung angegeben)."
    printf 'Zum Fortfahren mit unverschlüsselter Sicherung genau tippen: KLARTEXT-WIEDERHERSTELLEN: ' >&2
    read -r ONAY_KLARTEXT
    if [ "$ONAY_KLARTEXT" != "KLARTEXT-WIEDERHERSTELLEN" ]; then
      fehler "Abbruch" "Keine Klartext-Bestätigung erhalten ('$ONAY_KLARTEXT')" "KLARTEXT-WIEDERHERSTELLEN" "Wiederherstellung abgebrochen."
      exit 1
    fi
    IST_VERSCHLUESSELT=0
  else
    fehler "Yedek dosyası eksik" "$YEDEK_DIR" "db.dump.age (verschlüsselt) veya db.dump (Klartext)" \
      "Adı/yolu kontrol et. Mevcut yedekler: ls -1t \"\$(dirname "$YEDEK_DIR" 2>/dev/null)\" 2>/dev/null"
    exit 1
  fi
fi

log "Yedek: $(basename "$YEDEK_DIR") (sebep=${M_SEBEP:-?}, alındı=${M_TAKEN_AT:-?}, şema=${M_SCHEMA:-?}, format=$([ "$IST_VERSCHLUESSELT" -eq 1 ] && echo "age-v1" || echo "klartext"))"

# ── Kilit — backup.sh/update.sh ile AYNI dosya ─────────────────────────────
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  fehler "Kilit alınamadı" "update.sh/backup.sh çalışıyor" "boşta bir kilit" \
    "Diğer işlemin bitmesini bekle, sonra tekrar dene. Aynı anda restore + migration/backup KESİNLİKLE çakışmamalı."
  exit 1
fi

# ── Lokaler Arbeitsordner für temporäre Entschlüsselung (chmod 700, trap) ───
RESTORE_TMP="$SCRIPT_DIR/.restore-tmp"
rm -rf "$RESTORE_TMP"
mkdir -p "$RESTORE_TMP"
chmod 700 "$RESTORE_TMP"
restore_temizle() {
  PRIV_KEY=""
  unset PRIV_KEY 2>/dev/null || true
  if [ -n "${RESTORE_TMP:-}" ] && [ -d "$RESTORE_TMP" ]; then
    rm -rf "$RESTORE_TMP"
  fi
}
trap restore_temizle EXIT INT TERM

# ── 1) Bütünlük ve Şifre Çözme Kontrolleri — DB'YE DOKUNMADAN ÖNCE ──────────
PRIV_KEY=""

if [ "$IST_VERSCHLUESSELT" -eq 1 ]; then
  # 1a) age-Werkzeuge prüfen
  if ! command -v age >/dev/null 2>&1 || ! command -v age-keygen >/dev/null 2>&1; then
    fehler "age / age-keygen fehlt" "nicht installiert auf dem Host" "installiertes Paket 'age'" \
      "Sicherungswerkzeug installieren: sudo apt-get install -y age"
    exit 1
  fi

  # 1b) SHA256 jeder .age-Datei gegen Künye prüfen
  log "SHA256-Prüfsummen der verschlüsselten Dateien werden verifiziert..."
  M_SHA_LINES="$(sed -n '/"sha256"[[:space:]]*:[[:space:]]*{/,/}/p' "$YEDEK_DIR/backup.meta.json" 2>/dev/null \
    | grep -E '"[^"]+"[[:space:]]*:[[:space:]]*"[0-9a-f]{64}"' \
    | sed -E 's/^[[:space:]]*"([^"]+)"[[:space:]]*:[[:space:]]*"([0-9a-f]{64})".*/\1=\2/' \
    | tr -d '\r' \
    | LC_ALL=C sort || true)"
  [ -n "$M_SHA_LINES" ] || {
    fehler "Keine SHA256-Prüfsummen in Künye gefunden" "leere sha256-Tabelle in backup.meta.json" "sha256-Prüfsummen aller .age-Dateien" \
      "Künye ist beschädigt oder manipuliert."
    exit 1
  }
  while IFS= read -r sha_zeile; do
    [ -z "$sha_zeile" ] && continue
    d_name="${sha_zeile%%=*}"
    d_erwartet="${sha_zeile#*=}"
    d_pfad="$YEDEK_DIR/$d_name"
    if [ ! -f "$d_pfad" ]; then
      fehler "In Künye deklarierte Sicherungsdatei fehlt" "$d_name in $YEDEK_DIR nicht gefunden" "vorhandene Datei" \
        "Sicherung ist unvollständig."
      exit 1
    fi
    d_echt="$(sha256sum "$d_pfad" | awk '{print $1}')"
    if [ "$d_echt" != "$d_erwartet" ]; then
      fehler "SHA256-Prüfsumme fehlerhaft ($d_name)" "gefunden: $d_echt · erwartet: $d_erwartet" "identische Prüfsumme" \
        "Datei wurde manipuliert veya nakil sırasında bozulmuş."
      exit 1
    fi
  done <<< "$M_SHA_LINES"

  # Bidirektionale Integritätsprüfung gegen Dateiinjektion auf dem Sicherungsziel
  for f in "$YEDEK_DIR"/*.age; do
    [ -f "$f" ] || continue
    bn="$(basename "$f")"
    if ! printf '%s\n' "$M_SHA_LINES" | grep -qE "^${bn}="; then
      fehler "Nicht deklarierte Sicherungsdatei gefunden" "$bn in $YEDEK_DIR, aber nicht in Künye" "nur signierte Dateien" \
        "Möglicher Manipulationsversuch: Zusätzliche .age-Datei auf dem Sicherungsziel."
      exit 1
    fi
  done
  ok "SHA256-Prüfsummen aller Sicherungsdateien erfolgreich verifiziert (bidirektional)"

  # 1c) HMAC mit DEK aus .env im api-Container prüfen
  log "HMAC-Signatur der Künye wird mit DATA_ENCRYPTION_KEY geprüft..."
  [ -n "$M_HMAC" ] || {
    fehler "HMAC fehlt in Künye" "kein hmac-Feld in backup.meta.json" "HMAC-SHA256 Signatur" \
      "Verschlüsselte Sicherungen ohne HMAC werden nicht akzeptiert (Manipulationsschutz)."
    exit 1
  }
  kanonischer_meta_text() {
    local v="$1" empf="$2" taken="$3" seb="$4" sch="$5" db_b="$6" st_b="$7" sha_l="$8"
    printf 'verschluesselung=%s\nbackup_empfaenger=%s\ntaken_at=%s\nsebep=%s\nschema_version=%s\ndump_bytes=%s\nstorage_bytes=%s\n%s\n' \
      "$v" "$empf" "$taken" "$seb" "$sch" "$db_b" "$st_b" "$sha_l"
  }
  M_STORAGE_BYTES="$(meta_alan storage_bytes)"
  KANONISCH="$(kanonischer_meta_text "$M_VERSCHLUESSELUNG" "$M_BACKUP_EMPFAENGER" "$M_TAKEN_AT" "$M_SEBEP" "$M_SCHEMA" "$M_DUMP_BYTES" "$M_STORAGE_BYTES" "$M_SHA_LINES")"

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

  BERECHNETER_HMAC="$(meta_hmac_berechnen "$KANONISCH" || true)"
  if [ -z "$BERECHNETER_HMAC" ]; then
    fehler "HMAC konnte nicht berechnet werden — 'api'-Container läuft nicht oder DEK fehlt" \
      "keine HMAC-Ausgabe aus api-Container" "erfolgreich berechneter HMAC" \
      "Prüfen, ob Docker/api läuft ('docker compose up -d api') und DATA_ENCRYPTION_KEY in .env gesetzt ist."
    exit 1
  fi
  if [ "$BERECHNETER_HMAC" != "$M_HMAC" ]; then
    fehler "HMAC-Signatur der Künye stimmt NICHT überein (Manipulationsverdacht)" \
      "berechnet: $BERECHNETER_HMAC · Künye: $M_HMAC" "identischer HMAC" \
      "Die Sicherung wurde verändert oder mit einem anderen DATA_ENCRYPTION_KEY erstellt. Wiederherstellung abgebrochen."
    exit 1
  fi
  ok "HMAC der Künye erfolgreich verifiziert (Integrität & Herkunft bestätigt)"

  # 1d) Privaten Schlüssel einlesen und prüfen
  if [ -n "$SCHLUESSEL_DATEI" ]; then
    if [ ! -r "$SCHLUESSEL_DATEI" ]; then
      fehler "Schlüsseldatei nicht lesbar" "$SCHLUESSEL_DATEI" "lesbare Datei mit privatem age-Schlüssel" \
        "Pfad und Dateirechte prüfen."
      exit 1
    fi
    PRIV_KEY="$(tr -d '[:space:]' < "$SCHLUESSEL_DATEI")"
  else
    printf 'Privaten Sicherungsschlüssel (AGE-SECRET-KEY-1...) eingeben: ' >&2
    read -rs PRIV_KEY
    echo "" >&2
    PRIV_KEY="$(printf '%s' "$PRIV_KEY" | tr -d '[:space:]')"
  fi

  if ! printf '%s' "$PRIV_KEY" | grep -qE '^AGE-SECRET-KEY-1[0-9A-Z]{58}$'; then
    unset PRIV_KEY
    fehler "Ungültiges Format des Sicherungsschlüssels" "entspricht nicht AGE-SECRET-KEY-1..." "^AGE-SECRET-KEY-1[0-9A-Z]{58}$" \
      "Den privaten age-Schlüssel prüfen (beginnt mit AGE-SECRET-KEY-1 gefolgt von 58 Zeichen)."
    exit 1
  fi

  ABGELEITETER_EMPFAENGER="$(printf '%s\n' "$PRIV_KEY" | age-keygen -y 2>/dev/null | tr -d '[:space:]' || true)"
  if [ -z "$ABGELEITETER_EMPFAENGER" ] || [ "$ABGELEITETER_EMPFAENGER" != "$M_BACKUP_EMPFAENGER" ]; then
    unset PRIV_KEY
    fehler "Falscher Sicherungsschlüssel" "abgeleiteter Empfänger: ${ABGELEITETER_EMPFAENGER:-ungültig} · erwartet: $M_BACKUP_EMPFAENGER" \
      "zum backup_empfaenger passender privater Schlüssel" \
      "Der eingegebene Schlüssel passt NICHT zu dieser Sicherung. Es wurde nichts verändert."
    exit 1
  fi
  ok "Sicherungsschlüssel passt zum Empfänger ($M_BACKUP_EMPFAENGER)"

  # Vor dem Entschlüsseln: Speicherplatzprüfung auf der Box-Platte (Befund 5)
  BOS_ALAN_RESTORE_KB="$(df -k "$SCRIPT_DIR" 2>/dev/null | tail -n 1 | awk '{print $4}')"
  if [ -n "$M_DUMP_BYTES" ] && printf '%s' "$M_DUMP_BYTES" | grep -qE '^[0-9]+$' && [ "$M_DUMP_BYTES" -gt 0 ] 2>/dev/null; then
    GEREKEN_TMP_KB=$(( (M_DUMP_BYTES / 1024) + 102400 ))
    if [ -n "$BOS_ALAN_RESTORE_KB" ] && [ "$BOS_ALAN_RESTORE_KB" -lt "$GEREKEN_TMP_KB" ]; then
      restore_temizle
      fehler "Nicht genügend Festplattenplatz zum Entschlüsseln des Dumps" \
        "${BOS_ALAN_RESTORE_KB} KB frei ($SCRIPT_DIR)" "mindestens ${GEREKEN_TMP_KB} KB (Dump + Puffer)" \
        "Vor dem Restore Speicherplatz auf der Box-Platte freigeben."
      exit 1
    fi
  fi

  # 1e) DB Dump temporär nach $RESTORE_TMP/db.dump entschlüsseln für die Archivprüfung
  log "Veritabanı dump'ı geçici olarak çözülüyor (bütünlük testi için)..."
  if ! printf '%s\n' "$PRIV_KEY" | age -d -i - -o "$RESTORE_TMP/db.dump" "$YEDEK_DIR/db.dump.age" 2>>"$LOG_FILE"; then
    unset PRIV_KEY
    fehler "Entschlüsselung von db.dump.age fehlgeschlagen" "age -d lieferte Fehler (siehe $LOG_FILE)" \
      "erfolgreich entschlüsseltes db.dump" "Schlüssel oder Sicherungsdatei prüfen."
    exit 1
  fi
  DUMP_DATEI="$RESTORE_TMP/db.dump"
else
  # Unverschlüsselte Altsicherung
  DUMP_DATEI="$YEDEK_DIR/db.dump"
  GERCEK_BYTES="$(wc -c < "$DUMP_DATEI" | tr -d '[:space:]')"
  if [ -n "$M_DUMP_BYTES" ] && [ "$M_DUMP_BYTES" != "$GERCEK_BYTES" ]; then
    fehler "Dump dosyası boyutu künyeyle uyuşmuyor" "diskte ${GERCEK_BYTES} byte, künyede ${M_DUMP_BYTES} byte" \
      "aynı boyut" "Dosya nakil sırasında bozulmuş/kesilmiş olabilir (NAS/ağ). Yedeği yeniden kopyala, farklı bir kopyasını dene."
    exit 1
  fi
fi

# pg_restore -l Prüfung am Dump
GERCEK_BYTES="$(wc -c < "$DUMP_DATEI" | tr -d '[:space:]')"
KONTROL_HEDEF="/tmp/praxura-restore-kontrol.dump"
if ! docker compose cp "$DUMP_DATEI" "db:$KONTROL_HEDEF" >>"$LOG_FILE" 2>&1 \
   || ! docker compose exec -T db pg_restore -l "$KONTROL_HEDEF" >/dev/null 2>>"$LOG_FILE"; then
  docker compose exec -T db rm -f "$KONTROL_HEDEF" >/dev/null 2>&1 || true
  unset PRIV_KEY
  fehler "Dump dosyası bozuk (pg_restore -l başarısız)" "hata (bkz. $LOG_FILE)" "geçerli, listelenebilir bir arşiv" \
    "Bu yedeği kullanma — başka bir yedek dene."
  exit 1
fi
docker compose exec -T db rm -f "$KONTROL_HEDEF" >/dev/null 2>&1 || true
ok "Arşiv bütünlüğü doğrulandı (pg_restore -l)"

# ── 1b) Yer kontrolü — O-88 (onprem denetimi): backup.sh'ta var, burada yoktu ─
# Tepe kullanım kabaca: yeni boş DB'nin dump kadar büyümesi + eski (yeniden
# adlandırılmış) DB hâlâ diskte + storage'ın YENİ kopyası + eski storage hâlâ
# diskte (.alt-<zaman>) + dump'ın kendisi zaten diskte duruyor. Kesin bir
# formül yok (Postgres'in kendi büyümesi dump boyutundan farklı olabilir) —
# backup.sh'taki gibi bir PAY hesabı, kesin bir garanti değil.
STORAGE_ARSIV_BYTE=0
if [ "$IST_VERSCHLUESSELT" -eq 1 ] && printf '%s\n' "$M_SHA_LINES" | grep -q '^storage\.tar\.gz\.age=' && [ -f "$YEDEK_DIR/storage.tar.gz.age" ]; then
  STORAGE_ARSIV_BYTE="$(wc -c < "$YEDEK_DIR/storage.tar.gz.age" | tr -d '[:space:]')"
elif [ "$IST_VERSCHLUESSELT" -eq 0 ] && [ -f "$YEDEK_DIR/storage.tar.gz" ]; then
  STORAGE_ARSIV_BYTE="$(wc -c < "$YEDEK_DIR/storage.tar.gz" | tr -d '[:space:]')"
fi
BOS_ALAN_KB="$(df -k "$SCRIPT_DIR" 2>/dev/null | tail -n 1 | awk '{print $4}')"
if [ -n "$BOS_ALAN_KB" ]; then
  GEREKEN_KB=$(( ((GERCEK_BYTES + STORAGE_ARSIV_BYTE) * 2 / 1024) + 102400 ))
  if [ "$BOS_ALAN_KB" -lt "$GEREKEN_KB" ]; then
    restore_temizle
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
  restore_temizle
  fehler "DATA_ENCRYPTION_KEY doğrulanamadı — kutunun güncel değeri HESAPLANAMADI" \
    "boş sonuç (api image çalıştırılamadı ya da DATA_ENCRYPTION_KEY .env'de yok)" \
    "hesaplanabilir bir parmak izi" \
    "Bu bir 'uyuşuyor' değil — kontrol YAPILAMADI. .env'de DATA_ENCRYPTION_KEY var mı ve 'docker compose run --rm --no-deps api node -e \"console.log(1)\"' çalışıyor mu kontrol et, sonra tekrar dene. Bu kontrolü atlayıp devam etmenin yolu YOK (force dahil) — DEK doğrulanmadan restore, şifreli hasta verisinin sessizce çöpe gitmesi riskini taşır."
  exit 1
elif [ "$GUNCEL_DEK_FP" != "$M_DEK_FP" ]; then
  restore_temizle
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
    restore_temizle
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
  trap 'rm -rf "$SEMA_GECICI"; docker rm -f praxura-restore-sema-tmp >/dev/null 2>&1 || true; restore_temizle' EXIT INT TERM
  docker create --name praxura-restore-sema-tmp "$API_IMAGE" >/dev/null
  docker cp praxura-restore-sema-tmp:/app/db/migrations "$SEMA_GECICI/migrations" >/dev/null 2>&1 || true
  docker rm -f praxura-restore-sema-tmp >/dev/null 2>&1 || true
  IMAJ_BILDIGI_MAX="$(find "$SEMA_GECICI/migrations" -maxdepth 1 -name '*.sql' -printf '%f\n' 2>/dev/null | sed -E 's/^([0-9]{4}).*/\1/' | sort -u | tail -n 1)"

  if [ -n "$IMAJ_BILDIGI_MAX" ] && [ -n "$M_SCHEMA" ] && [ "$M_SCHEMA" != "none" ] && [ "$M_SCHEMA" != "null" ]; then
    if [ "$M_SCHEMA" \> "$IMAJ_BILDIGI_MAX" ]; then
      rm -rf "$SEMA_GECICI"
      trap restore_temizle EXIT INT TERM
      restore_temizle
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
  trap restore_temizle EXIT INT TERM
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
  restore_temizle
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
  restore_temizle
  fehler "Mevcut veritabanı yeniden adlandırılamadı" "hata (bkz. $LOG_FILE)" "başarılı bir ALTER DATABASE RENAME" \
    "Hâlâ bağlı bir oturum olabilir (bkz. yukarıdaki pg_terminate_backend uyarısı) — 'docker compose ps' ile hangi konteynerin hâlâ ayakta olduğunu kontrol et, hepsi durdurulmuş olmalıydı."
  exit 1
fi
if ! docker compose exec -T db psql -U supabase_admin -d template1 -c \
     "CREATE DATABASE \"$DB_NAME\" OWNER supabase_admin;" >>"$LOG_FILE" 2>&1; then
  restore_temizle
  fehler "Yeni boş veritabanı yaratılamadı" "hata (bkz. $LOG_FILE)" "başarılı bir CREATE DATABASE" \
    "Eski veritabanın KAYBOLMADI, '${ESKI_DB_ADI}' adıyla duruyor. Geri almak için: docker compose exec -T db psql -U supabase_admin -d template1 -c 'ALTER DATABASE \"${ESKI_DB_ADI}\" RENAME TO \"${DB_NAME}\";'"
  exit 1
fi
RESTORE_HEDEF="/tmp/praxura-restore.dump"
if ! docker compose cp "$DUMP_DATEI" "db:$RESTORE_HEDEF" >>"$LOG_FILE" 2>&1; then
  restore_temizle
  fehler "Dump db konteynerine kopyalanamadı" "hata (bkz. $LOG_FILE)" "başarılı bir docker compose cp" \
    "'${DB_NAME}' zaten '${ESKI_DB_ADI}' olarak yeniden adlandırıldı ve yeni boş '${DB_NAME}' yaratıldı — ama içine hiçbir şey YAZILMADI. Disk/konteyner durumunu kontrol et (df -h, docker compose ps db), sonra: docker compose exec -T db psql -U supabase_admin -d template1 -c 'DROP DATABASE IF EXISTS \"${DB_NAME}\"; ALTER DATABASE \"${ESKI_DB_ADI}\" RENAME TO \"${DB_NAME}\";' ile eski hâle dön, sorunu çözüp tekrar dene."
  exit 1
fi
if ! docker compose exec -T -e PGOPTIONS='-c lock_timeout=30s' db \
     pg_restore --single-transaction -U supabase_admin -d "$DB_NAME" "$RESTORE_HEDEF" >>"$LOG_FILE" 2>&1; then
  docker compose exec -T db rm -f "$RESTORE_HEDEF" >/dev/null 2>&1 || true
  restore_temizle
  fehler "pg_restore başarısız" "hata (bkz. $LOG_FILE)" "başarılı, tam bir geri yükleme" \
    "--single-transaction sayesinde YENİ '${DB_NAME}' YARIM KALMADI (boş kaldı, ya hep ya hiç). ESKİ VERİTABANI KAYBOLMADI — '${ESKI_DB_ADI}' adıyla duruyor. Geri dönmek için: docker compose exec -T db psql -U supabase_admin -d template1 -c 'DROP DATABASE IF EXISTS \"${DB_NAME}\"; ALTER DATABASE \"${ESKI_DB_ADI}\" RENAME TO \"${DB_NAME}\";' — sonra 'docker compose up -d api auth rest realtime storage'. Log'a bakıp sorunu çözdükten sonra restore.sh'ı tekrar dene."
  exit 1
fi
docker compose exec -T db rm -f "$RESTORE_HEDEF" >/dev/null 2>&1 || true
if [ "$IST_VERSCHLUESSELT" -eq 1 ] && [ -f "$RESTORE_TMP/db.dump" ]; then
  rm -f "$RESTORE_TMP/db.dump"
fi
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
# S-21 (KHS K2.6): eigene Passwoerter je Dienstrolle — NACH 99-roles.sql,
# sonst setzt jenes sie wieder auf POSTGRES_PASSWORD zurueck und rest/auth/
# storage (die mit PG_*_PASSWORD verbinden) kommen nicht mehr in die DB.
if ! docker compose exec -T db psql -U supabase_admin -d "$DB_NAME" -f /docker-entrypoint-initdb.d/init-scripts/99a-praxura-rollen.sql >>"$LOG_FILE" 2>&1; then
  warn "99a-praxura-rollen.sql yeniden uygulanamadı — rest/auth/storage DB'ye bağlanamayabilir. Elle: docker compose exec -T db psql -U supabase_admin -d \"$DB_NAME\" -f /docker-entrypoint-initdb.d/init-scripts/99a-praxura-rollen.sql"
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
  restore_temizle
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
STORAGE_DATEI=""
if [ "$IST_VERSCHLUESSELT" -eq 1 ] && printf '%s\n' "$M_SHA_LINES" | grep -q '^storage\.tar\.gz\.age=' && [ -f "$YEDEK_DIR/storage.tar.gz.age" ]; then
  STORAGE_DATEI="$YEDEK_DIR/storage.tar.gz.age"
elif [ "$IST_VERSCHLUESSELT" -eq 0 ] && [ -f "$YEDEK_DIR/storage.tar.gz" ]; then
  STORAGE_DATEI="$YEDEK_DIR/storage.tar.gz"
fi

if [ -n "$STORAGE_DATEI" ]; then
  log "Storage geri yükleniyor..."
  STORAGE_DIR="$SCRIPT_DIR/volumes/storage"
  ESKI_YEDEK="$SCRIPT_DIR/volumes/storage.alt-$(date -u +%Y%m%dT%H%M%SZ)"
  TMP_STORAGE="$SCRIPT_DIR/volumes/.tmp-storage-restore"
  rm -rf "$TMP_STORAGE"
  mkdir -p "$TMP_STORAGE"

  TAR_FEHLER=0
  if [ "$IST_VERSCHLUESSELT" -eq 1 ]; then
    set +e
    printf '%s\n' "$PRIV_KEY" | age -d -i - "$STORAGE_DATEI" 2>>"$LOG_FILE" | tar -xzp --numeric-owner -f - -C "$TMP_STORAGE" 2>>"$LOG_FILE"
    PIPE_STATUSES=("${PIPESTATUS[@]}")
    set -e
    if [ "${PIPE_STATUSES[1]:-1}" -ne 0 ] || [ "${PIPE_STATUSES[2]:-1}" -ne 0 ]; then
      TAR_FEHLER=1
    fi
  else
    if ! tar -xzp --numeric-owner -f "$STORAGE_DATEI" -C "$TMP_STORAGE" 2>>"$LOG_FILE"; then
      TAR_FEHLER=1
    fi
  fi

  if [ "$TAR_FEHLER" -eq 1 ] || [ ! -d "$TMP_STORAGE/storage" ]; then
    rm -rf "$TMP_STORAGE"
    restore_temizle
    fehler "Storage arşivi açılamadı" "tar/age hata verdi (bkz. $LOG_FILE)" "geçerli bir storage arşivi" \
      "Veritabanı ZATEN geri yüklendi — yalnız storage (dosyalar) eski hâlinde kaldı. Arşivi kontrol et."
    exit 1
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
      restore_temizle
      fehler "Yeni storage yerine taşınamadı" "mv hatası (bkz. $LOG_FILE)" "başarılı bir mv" \
        "Eski storage GERİ KONULMAYA ÇALIŞILDI (\"$STORAGE_DIR\" hâlâ eski hâliyle olmalı — 'ls \"$STORAGE_DIR\"' ile doğrula). Veritabanı ZATEN geri yüklendi. Disk/izin sorununu çöz, sonra storage'ı elle aç: tar -xzpf \"$STORAGE_DATEI\" -C \"$SCRIPT_DIR/volumes\" (önce mevcut '$STORAGE_DIR'i kendin taşı)."
      exit 1
    else
      rm -rf "$TMP_STORAGE"
      ok "Storage geri yüklendi (eski hâl korunuyor: $(basename "$ESKI_YEDEK"))"
    fi
  fi
else
  warn "Yedekte storage.tar.gz(.age) yok — storage (reçete görüntüleri vb.) DEĞİŞTİRİLMEDİ, mevcut hâliyle kalıyor."
fi

# ── 7b) Caddy-Wurzel-CA (O-153, KHS K2.10) ──────────────────────────────────
# Gleiche CA wie vor dem Ausfall → Praxisrechner/Tablets, die sie schon als
# vertrauenswuerdig importiert haben, sehen KEINE Zertifikatswarnung. Ohne
# diesen Schritt haette eine neu aufgesetzte Box eine neue CA erzeugt.
CADDY_PKI_NEU=0
# K2b.19 (O-177): _praxura-ca/ aus dem Archiv → volumes/caddy-ca (Bind-Mount),
# NICHT nach caddy_data. Danach Caddy neu starten, damit pki.caddy greift.
pki_ca_zurueck() {
  local quelle="$1/_praxura-ca"
  [ -d "$quelle" ] || return 0
  install -d -m 0755 "$SCRIPT_DIR/volumes/caddy-ca"
  cp -a "$quelle/." "$SCRIPT_DIR/volumes/caddy-ca/"
  [ ! -f "$SCRIPT_DIR/volumes/caddy-ca/intermediate.key" ] || chmod 600 "$SCRIPT_DIR/volumes/caddy-ca/intermediate.key"
  rm -rf -- "${quelle:?}"
  docker compose restart caddy >>"$LOG_FILE" 2>&1 || true
}
# Erfolg = CA zurück (K2b.19) ODER Caddys Altdaten zurück. Nach dem Herausnehmen von
# _praxura-ca kann caddy-pki leer sein — dann kein 'docker compose cp' (schlüge auf einer
# frischen Box ohne /data/caddy/pki fehl und meldete fälschlich einen Fehler).
pki_zurueckspielen() {
  local d="$1" erg=1
  if [ -d "$d/_praxura-ca" ]; then pki_ca_zurueck "$d" && erg=0; fi
  if [ -n "$(ls -A "$d" 2>/dev/null)" ]; then
    docker compose cp "$d/." caddy:/data/caddy/pki >>"$LOG_FILE" 2>&1 && erg=0
  fi
  return "$erg"
}
# acmedns-Box (K2b.4, guvenlik S-47 Bedingung 1): keine interne CA — eine alte
# Sicherung aus der internal-Zeit darf den CA-Schlüssel (S-43) nicht zurückschreiben.
if [ "$(env_wert CADDY_TLS_MODUS)" = "acmedns" ]; then
  log "  (acmedns-Box: keine interne CA — caddy-pki aus dem Backup wird bewusst NICHT zurückgespielt, S-43/S-47.)"
  # K2b.19: eine liegengebliebene pki-Datei aus der internal-Zeit zwänge Caddy eine interne CA auf.
  rm -f -- "$SCRIPT_DIR/volumes/caddy-ca/pki.caddy"
elif [ "$IST_VERSCHLUESSELT" -eq 1 ] && printf '%s\n' "$M_SHA_LINES" | grep -q '^caddy-pki\.tar\.gz\.age=' && [ -f "$YEDEK_DIR/caddy-pki.tar.gz.age" ]; then
  TMP_PKI="$(mktemp -d)"
  set +e
  printf '%s\n' "$PRIV_KEY" | age -d -i - "$YEDEK_DIR/caddy-pki.tar.gz.age" 2>>"$LOG_FILE" | tar -xzf - -C "$TMP_PKI" 2>>"$LOG_FILE"
  PIPE_PKI=("${PIPESTATUS[@]}")
  set -e
  if [ "${PIPE_PKI[1]:-1}" -eq 0 ] && [ "${PIPE_PKI[2]:-1}" -eq 0 ] && [ -d "$TMP_PKI/caddy-pki" ] \
     && pki_zurueckspielen "$TMP_PKI/caddy-pki"; then
    ok "Caddy-Wurzel-CA wiederhergestellt"
    CADDY_PKI_NEU=1
  else
    warn "Caddy-Wurzel-CA konnte nicht zurückgespielt werden (caddy aus?) — Geräte sehen ggf. eine Zertifikatswarnung, bis die neue CA importiert ist."
  fi
  rm -rf "$TMP_PKI"
elif [ "$IST_VERSCHLUESSELT" -eq 0 ] && [ -f "$YEDEK_DIR/caddy-pki.tar.gz" ]; then
  TMP_PKI="$(mktemp -d)"
  if tar -xzf "$YEDEK_DIR/caddy-pki.tar.gz" -C "$TMP_PKI" 2>>"$LOG_FILE" \
     && pki_zurueckspielen "$TMP_PKI/caddy-pki"; then
    ok "Caddy-Wurzel-CA wiederhergestellt"
    CADDY_PKI_NEU=1
  else
    warn "Caddy-Wurzel-CA konnte nicht zurückgespielt werden (caddy aus?) — Geräte sehen ggf. eine Zertifikatswarnung, bis die neue CA importiert ist."
  fi
  rm -rf "$TMP_PKI"
else
  log "  (Yedekte caddy-pki(.age) yok — 0.2.0 öncesi yedek ya da Let's-Encrypt kutusu; CA dokunulmadı.)"
fi

# Schlüssel und lokaler Arbeitsordner werden nach Gebrauch sofort ungesetzt und bereinigt
restore_temizle

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
if [ "$CADDY_PKI_NEU" -eq 1 ]; then
  docker compose restart caddy >>"$LOG_FILE" 2>&1 && ok "caddy mit wiederhergestellter CA neu gestartet"     || warn "caddy-Neustart fehlgeschlagen — 'docker compose restart caddy' von Hand."
fi

# ── 9) §302-Referenzzähler (O-123, KHS K2.10) ───────────────────────────────
# Die Datenaustauschreferenz MUSS je Absender→Empfänger streng steigen — die
# Annahmestelle weist eine schon benutzte Nummer ab. Ein Backup von gestern
# kennt die Dateien von heute nicht: der Zähler steht nach dem Restore ggf.
# HINTER dem zuletzt wirklich gesendeten Stand. Hier sichtbar machen (die
# Box kann nicht wissen, was zuletzt gesendet wurde — das weiss die Praxis).
ZAEHLER="$(docker compose exec -T db psql -U supabase_admin -d "$DB_NAME" -tA -F ' · ' -c "SELECT owner_id, absender_ik, empfaenger_ik, letzte_referenz, letzte_transfernummer, to_char(aktualisiert_am,'DD.MM.YYYY HH24:MI') FROM datenaustausch_zaehler ORDER BY aktualisiert_am DESC;" 2>>"$LOG_FILE" || true)"
if [ -n "$ZAEHLER" ]; then
  log ""
  log "  §302-Referenzzähler nach dem Restore (Owner · Absender-IK · Empfänger-IK · letzte Referenz · letzte Transfernummer · Stand):"
  printf '%s\n' "$ZAEHLER" | while IFS= read -r z; do log "    $z"; done
  log "  ⚠️  Wurden NACH dem Zeitpunkt dieses Backups (${M_TAKEN_AT:-?}) noch Abrechnungsdateien"
  log "      verschickt, steht der Zähler zu niedrig. Höchste tatsächlich gesendete Nummer aus"
  log "      dem Versandprotokoll/der Annahmestelle nehmen und vorstellen:"
  log "        docker compose exec -T db psql -U supabase_admin -d $DB_NAME -c \\"
  log "          \"SELECT datenaustausch_zaehler_vorstellen('<owner-uuid>','<absender-ik>','<empfaenger-ik>', <referenz>, <transfernummer>);\""
else
  log "  §302-Referenzzähler: noch keine Einträge (keine Abrechnung versendet) — nichts zu prüfen."
fi

log ""
log "Not: '_supabase' veritabanı (analytics/realtime tenant metriği) bu yedeğin"
log "kapsamı dışındaydı ve geri gelmedi — bilinçli bir sınır, hata değil."
log ""
log "Eski veritabanı SİLİNMEDİ — '${ESKI_DB_ADI}' adıyla duruyor. Yeni hâlden"
log "memnun olduktan sonra elle temizleyebilirsin:"
log "  docker compose exec -T db psql -U supabase_admin -d template1 -c 'DROP DATABASE \"${ESKI_DB_ADI}\";'"
log ""
log "Bitti — kaynak: $(basename "$YEDEK_DIR"), sonuç: ok"
