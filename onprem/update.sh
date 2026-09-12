#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — update.sh (O-45 (b), Playbook Phase 2.1b)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 12.09.2026 · Design gesperrt in onprem/REGISTER.md §7J (J1-J9,
#  Konsultation mit dem onprem-Agenten). NICHT ohne erneute Konsultation
#  umbauen — jede Entscheidung hier hat einen Grund, der dort steht.
#
#  Was dieses Skript TUT: das eigene `praxura/api`-Image ziehen, das darin
#  mitgelieferte Bundle (Compose + Volumes + Skripte) auspacken, gegen den
#  Stand auf der Box vergleichen, unsere Dateien byte-genau ersetzen (ausser
#  bei Fremdänderung — dann STOP), wenn eine Migration bevorsteht `backup.sh`
#  aufrufen (O-26, geteilte Routine mit dem nächtlichen Backup-Timer —
#  schlägt sie fehl, STOPPT das Update hier, ohne die Box anzufassen), `.env`
#  anhand einzelner Schlüssel zusammenführen (NIE komplett ersetzen), die Box
#  neu starten, ihre Gesundheit prüfen. Schlägt etwas fehl, werden nur
#  DATEIEN zurückgerollt — NIE die Image-Version (J6: das ist Aufgabe des
#  Backup-Runners, nicht dieses Skripts) und NIE die Datenbank (`backup.sh`
#  ist ein Sicherheitsnetz für den Menschen, kein automatisches Restore —
#  `restore.sh` bleibt offen, O-26).
#
#  Was dieses Skript NICHT TUT: Watchtower ersetzen (das gibt es hier nicht,
#  J8 — zwei Aktualisierer wären ein Wettlauf), Datenbank-Migrationen selbst
#  ausführen (die laufen im `api`-Container beim Start), Passwörter/Secrets
#  anfassen (nur bekannte Schlüssel werden zusammengeführt, nie generiert).
#
#  Aufruf: `bash update.sh` (vom Timer) oder `bash update.sh --jetzt` (manuell,
#  überspringt keine Schritte — nur ein Logging-Unterschied).
#
#  Fehlermodell: anders als install.sh (das interaktiv ist und bei jedem
#  Fehler sofort abbricht) läuft dieses Skript UNBEAUFSICHTIGT nachts. Ein
#  Fehler nach den beiden Gates in Schritt 7 bedeutet Dateien zurückrollen und
#  sauber beenden (exit 1 fürs Systemd-Log) — nie einen Container in halb
#  aktualisiertem Zustand hinterlassen.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/update.log"
ENV_FILE="$SCRIPT_DIR/.env"
STAND_DIR="$SCRIPT_DIR/.praxura-stand"
STAND_FILE="$STAND_DIR/praxura-stand.json"
LOCK_FILE="$SCRIPT_DIR/.praxura-update.lock"

# ── Ausgabe-Helfer — gleiche Disziplin wie install.sh: Geheimnisse NIE loggen ─
log()  { printf '%s\n' "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE" >&2; }
ok()   { log "  [ok] $*"; }
warn() { log "  [warn] $*"; }

# Anders als install.sh's fail(): kein harter exit von hier aus — der Aufrufer
# entscheidet (Rollback vs. sauber beenden). Nur Logging.
fehler() {
  log ""
  log "  ✗ [fehler] $1"
  log "      Gefunden:  $2"
  log "      Erwartet:  $3"
  log "      Was tun:   $4"
  log ""
}

# lib-health.sh's Vertrag verlangt eine fail(), die NICHT zurückkehrt (siehe
# ihr Dateikopf) — für den einen Fall, den sie selbst auslöst (leere
# Dienstliste), gibt es ohnehin nichts zum Zurückrollen. Sonst würde
# lib-health.sh unter `set -e` mit "fail: command not found" abstürzen,
# ohne Log, ohne Rollback (onprem-Gegenlesen, 12.09.2026).
fail() {
  fehler "$1" "$2" "$3" "$4"
  exit 1
}

# 5 MB-Rotation, gleiche Disziplin wie install.log (§7G Kopf).
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 5242880 ]; then
  mv "$LOG_FILE" "$LOG_FILE.alt"
fi

mkdir -p "$STAND_DIR"

# ── Schritt 0 — Lock + Vorprüfung ────────────────────────────────────────────
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "[0] Ein anderer Lauf ist bereits aktiv — beende ohne etwas zu tun."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  log "[0] Keine .env gefunden — Box wurde nie mit install.sh eingerichtet. Beende."
  exit 0
fi

platz_frei_pct=$(df -P "$SCRIPT_DIR" | awk 'NR==2 {print 100 - $5}' | tr -d '%')
if [ -n "$platz_frei_pct" ] && [ "$platz_frei_pct" -lt 8 ]; then
  fehler "Zu wenig freier Speicher für ein sicheres Update" "${platz_frei_pct}% frei" "mindestens 8% frei" \
    "Speicher freigeben (alte Backups, Docker-Images: 'docker system prune'), dann erneut versuchen."
  exit 1
fi

log "[1/11] update.sh gestartet ($([ "${1:-}" = "--jetzt" ] && echo "manuell" || echo "Timer"))"

# shellcheck source=./lib-health.sh
source "$SCRIPT_DIR/lib-health.sh"

# `PRAXURA_API_IMAGE` aus .env lesen, ohne die ganze Datei zu sourcen (Werte
# könnten Sonderzeichen enthalten, die die Shell interpretiert).
env_wert() {
  # Gleiches, geprüftes Muster wie install.sh's env_get(): $0 üzerinde direkt
  # `sub()` — $1'i temizleyip OFS'le yeniden birleştirmek (önceki hâli) baştaki
  # boşluğu SİLMİYOR, `docker pull " image"` gibi geçersiz bir isimle bitiyordu
  # (gerçek kutuya karşı test edilerek bulundu, 12.09.2026).
  awk -F= -v k="$1" '$1==k{ sub(/^[^=]*=/,""); print; f=1 } END{ if(!f) print "" }' "$ENV_FILE" 2>/dev/null || true
}
API_IMAGE="$(env_wert PRAXURA_API_IMAGE)"
if [ -z "$API_IMAGE" ]; then
  fehler "PRAXURA_API_IMAGE fehlt in .env" "leer" "ein Image-Tag" "install.sh erneut prüfen — diese Zeile sollte dort geschrieben worden sein."
  exit 1
fi

# ── Schritt 1 — nur das eigene Image ziehen ─────────────────────────────────
log "[2/11] Image ziehen: $API_IMAGE"
if ! docker pull "$API_IMAGE" >>"$LOG_FILE" 2>&1; then
  log "  Pull fehlgeschlagen — nichts wurde verändert. Nächster Versuch: nächste Nacht."
  exit 0
fi

# ── Schritt 2 — Bundle auspacken (KEIN Verzeichnis kopieren, siehe J2) ──────
BUNDLE_TMP="$(mktemp -d)"
trap 'rm -rf "$BUNDLE_TMP"; docker rm -f praxura-bundle-tmp >/dev/null 2>&1 || true' EXIT

docker rm -f praxura-bundle-tmp >/dev/null 2>&1 || true
docker create --name praxura-bundle-tmp "$API_IMAGE" >/dev/null
docker cp praxura-bundle-tmp:/app/onprem-bundle "$BUNDLE_TMP/bundle" >/dev/null 2>&1 || {
  fehler "Image enthält kein onprem-Bundle" "kein /app/onprem-bundle im Image" "das Bundle-Verzeichnis (siehe onprem/REGISTER.md O-45 (b) J2)" \
    "Dieses Image wurde ohne Bundle gebaut — 'praxura/api'-Dockerfile prüfen."
  exit 1
}
# O-26: Migration-Dateiliste des NEUEN Image — aus DEMSELBEN Konteyner
# kopiert (onprem, O-26 tasarım turu: zweiten `docker create` nicht öffnen).
# Nur Dateinamen zählen hier — checksum-Vergleich ist migrate.js's Job, nicht
# eine bash-Kopie davon (aşağıdaki Schritt 8'e bak).
docker cp praxura-bundle-tmp:/app/db/migrations "$BUNDLE_TMP/migrations" >/dev/null 2>&1 || true
docker rm -f praxura-bundle-tmp >/dev/null 2>&1 || true

MANIFEST="$BUNDLE_TMP/bundle/manifest.json"
if [ ! -f "$MANIFEST" ]; then
  fehler "Bundle hat kein manifest.json" "Datei fehlt" "manifest.json im Bundle" "Build-Pipeline prüfen."
  exit 1
fi

# Kleines JSON lesen ohne jq-Abhängigkeit (Ziel-Boxen haben es evtl. nicht) —
# node ist bereits Voraussetzung fürs übrige Projekt, aber NICHT für die Box.
# python3 ist auf schlanken Ubuntu-Minimalinstallationen ebenfalls nicht
# garantiert. Reines awk/sed für die paar flachen Felder, die wir brauchen.
manifest_feld() {
  # $1 = Feldname (Top-Level-String/Bool), einfache Werte reichen für J2's Schema.
  grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"?[^\",}]*\"?" "$MANIFEST" | head -1 | sed -E 's/^"'"$1"'"[[:space:]]*:[[:space:]]*"?//; s/"?$//'
}
BUNDLE_SURUM="$(manifest_feld surum)"
BUNDLE_DURAK="$(manifest_feld durak)"

log "  Bundle-Version: ${BUNDLE_SURUM:-unbekannt} (durak=${BUNDLE_DURAK:-false})"

# ── Kendi kendini güncelleme — EN ERKEN, her şeyden önce (J5 sonu) ──────────
# ⚠️ Bu kontrol bilinçli olarak dosya yazma döngüsünden (Schritt 7) ÖNCE
# duruyor, sonra değil: update.sh KENDİSİ o döngüde yazılsaydı, o an çalışan
# bash süreci kendi betiğinin diskteki baytlarını ayaklarının altından
# değiştirmiş olurdu — gerçek kutuya karşı test edilirken tam olarak bu oldu
# ("kendi_sha: unbound variable", betiğin geri kalanı bozuk okundu). Çözüm:
# update.sh'ı HER ŞEYDEN ÖNCE, tek başına yaz ve hemen `exec` et; geri kalan
# adımlar (diff, .env birleştirme, dosya yazma) TAMAMEN yeni süreçte, dosya
# hiç değişmemiş gibi baştan çalışır.
if [ -z "${PRAXURA_UPDATE_REEXEC:-}" ] && [ -f "$BUNDLE_TMP/bundle/update.sh" ]; then
  yeni_sha="$(sha256sum "$BUNDLE_TMP/bundle/update.sh" | awk '{print $1}')"
  kendi_sha="$(sha256sum "$SCRIPT_DIR/update.sh" | awk '{print $1}')"
  if [ "$yeni_sha" != "$kendi_sha" ]; then
    log "  update.sh kendisi değişti — yazılıp yeniden başlatılıyor (tek seferlik)."
    cp "$BUNDLE_TMP/bundle/update.sh" "$SCRIPT_DIR/update.sh"
    chmod +x "$SCRIPT_DIR/update.sh"
    export PRAXURA_UPDATE_REEXEC=1
    # `exec` mevcut süreci DEĞİŞTİRİR — EXIT trap'i (yukarıda) bu yüzden hiç
    # tetiklenmez, geçici dizini burada elle temizliyoruz.
    rm -rf "$BUNDLE_TMP"
    docker rm -f praxura-bundle-tmp >/dev/null 2>&1 || true
    exec bash "$SCRIPT_DIR/update.sh" "$@"
  fi
fi

# ── Durum-dosyası yardımcıları ───────────────────────────────────────────────
# İki AYRI dosya, bilinçli olarak: DATEIEN_SHA_FILE sapma-tespitinin tabanıdır
# ve YALNIZ gerçek bir başarıda (sonuc=ok) yeniden yazılır. STAND_FILE ise
# panel/insan için bir durum anlık görüntüsüdür ve her koşuda yazılır — ama
# "dateien" alanını STAND_FILE'ın KENDİSİNDEN değil DATEIEN_SHA_FILE'dan
# okuyarak gömer. Ayrım bilinçli: durak/konflikt/geri_alindi çıkışlarında
# dosyalar ya hiç değişmedi ya da eskiye döndü — o yüzden sapma tabanı da
# DEĞİŞMEMELİ. Tek dosya kullanıp her çıkışta küçük bir "dateien" yazsaydık
# (ilk sürümde tam olarak bu oldu), taban bir konfliktte silinir, bir sonraki
# koşu sapma kontrolünü atlar ve müşterinin elle düzenlediği dosyayı sessizce
# ezerdi (onprem-Gegenlesen 12.09.2026 — J3'ün asıl amacını bozan bir hata).
DATEIEN_SHA_FILE="$STAND_DIR/dateien-sha.json"

dateien_sha_icerik() {
  [ -f "$DATEIEN_SHA_FILE" ] && cat "$DATEIEN_SHA_FILE" || echo '{}'
}
onceki_sha() {
  # $1 = yol. DATEIEN_SHA_FILE'dan okur (praxura-stand.json'dan DEĞİL).
  [ -f "$DATEIEN_SHA_FILE" ] || return 1
  grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[0-9a-f]{64}\"" "$DATEIEN_SHA_FILE" 2>/dev/null | sed -E 's/^.*"([0-9a-f]{64})"$/\1/' || return 1
}
# $1=sonuc  $2=opsiyonel ekstra alanlar, "\"anahtar\": \"deger\"," biçiminde, sonunda virgülle
durumu_yaz() {
  local sonuc="$1" ekstra="${2:-}"
  cat > "$STAND_FILE.tmp" <<EOF
{
  "surum": "${BUNDLE_SURUM:-}",
  "sonuc": "$sonuc",
  "zaman": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  ${ekstra}
  "dateien": $(dateien_sha_icerik)
}
EOF
  mv "$STAND_FILE.tmp" "$STAND_FILE"
}

# ── Schritt 3 — Durak-Tor ────────────────────────────────────────────────────
if [ "$BUNDLE_DURAK" = "true" ]; then
  log "[3/11] durak=true — dieses Update erfordert einen manuellen Schritt. Nichts wird angefasst."
  grep -A20 '"elle_adim"' "$MANIFEST" | tee -a "$LOG_FILE" >&2 || true
  durumu_yaz "durak"
  exit 0
fi

# ── Schritt 4/5 — Diskteki hâlle karşılaştır + sapma kontrolü (J3) ──────────
# "Bizim" dosyalar: .env HARİÇ hepsi. DATEIEN_SHA_FILE bir taban (bizim
# yazdığımız sha256) tutuyorsa, disk o tabandan sapmışsa müşteri elle
# değiştirmiştir → dokunma, .neu bırak, güncellemeyi tümden durdur.
ilk_kosu=1
[ -f "$DATEIEN_SHA_FILE" ] && ilk_kosu=0

sapma_bulundu=""
degisen_dosyalar=""
while IFS=$'\t' read -r yol yeni_sha; do
  [ -z "$yol" ] && continue
  hedef="$SCRIPT_DIR/$yol"
  if [ "$yol" = ".env.template" ]; then
    continue # ayrı ele alınır (J4)
  fi
  if [ "$yol" = "update.sh" ]; then
    # ⚠️ onprem-Gegenlesen (12.09.2026, O-77 turunun disk/pg_restore eklerini
    # test ederken bulundu): update.sh KENDİSİ zaten yukarıdaki "Kendi kendini
    # güncelleme" bloğunda KOŞULSUZ yazılıp re-exec edildi — bu satıra
    # geldiğimizde disk her zaman bundle'ın update.sh'ıyla birebir aynıdır.
    # Onu burada da genel sapma-kontrolüne sokmak SAHTE pozitif üretiyordu:
    # `mevcut_sha` (kendi kendini güncellemeden SONRAKİ, yeni değer) her
    # zaman `taban_sha`'dan (bir önceki BAŞARILI koşudan kalma, eski değer)
    # farklı çıkıyor — update.sh'ın kendi içeriği iki sürüm arasında
    # değiştiği HER gece (ki bu hafta üç kez oldu) "müşteri elle değiştirmiş"
    # sanılıp güncelleme tümden durduruluyordu, oysa kimse dokunmamıştı.
    # Gerçek kutuda doğrulandı: e8160dc → 40ffa3b geçişinde bu tam olarak
    # tetiklendi. Çözüm: update.sh'ı — tıpkı .env.template gibi — bu genel
    # döngünün dışında tut; onu koruyan/güncelleyen mekanizma zaten yukarıda.
    continue
  fi
  if [ -f "$hedef" ]; then
    mevcut_sha="$(sha256sum "$hedef" | awk '{print $1}')"
  else
    mevcut_sha=""
  fi
  if [ "$ilk_kosu" -eq 0 ]; then
    taban_sha="$(onceki_sha "$yol" || echo '')"
    if [ -n "$taban_sha" ] && [ -n "$mevcut_sha" ] && [ "$taban_sha" != "$mevcut_sha" ]; then
      warn "Sapma: $yol kutuda elden geçirilmiş — üzerine yazılmıyor"
      sapma_bulundu="$sapma_bulundu $yol"
      continue
    fi
  fi
  if [ "$mevcut_sha" != "$yeni_sha" ]; then
    degisen_dosyalar="$degisen_dosyalar $yol"
  fi
done < <(grep -oE '"yol"[[:space:]]*:[[:space:]]*"[^"]+"[[:space:]]*,[[:space:]]*"sha256"[[:space:]]*:[[:space:]]*"[0-9a-f]{64}"' "$MANIFEST" \
  | sed -E 's/"yol"[[:space:]]*:[[:space:]]*"([^"]+)".*"sha256"[[:space:]]*:[[:space:]]*"([0-9a-f]{64})"/\1\t\2/')

if [ -n "$sapma_bulundu" ]; then
  fehler "Kutuda elle değiştirilmiş dosya(lar) bulundu — güncelleme durduruldu" "$sapma_bulundu" "byte-özdeş 'bizim' dosyalar" \
    "Değişiklikleri gözden geçir, gerekiyorsa .neu dosyalarıyla elle birleştir (destek: install.log/update.log'u gönder, K10 gereği içeri giremiyoruz)."
  for yol in $sapma_bulundu; do
    hedef="$SCRIPT_DIR/$yol"
    [ -f "$hedef" ] && cp "$hedef" "$hedef.neu.bekliyor" 2>/dev/null || true
  done
  durumu_yaz "konflikt" "\"catisma_dosyalari\": \"$sapma_bulundu\","
  exit 1
fi

if [ "$ilk_kosu" -eq 1 ]; then
  log "  İlk çalıştırma — önceki bir sapma tabanı yok, sapma kontrolü bu turda atlandı."
fi

if [ -z "$degisen_dosyalar" ]; then
  log "[4-7/11] Bundle dosyaları zaten güncel — yalnız image'ı yeniden başlatılıyor."
else
  log "[4-7/11] Değişen dosyalar:$degisen_dosyalar"
fi

# ── Schritt 6 — Anlık görüntü (ÖNCE .env birleştirmesinden!) ────────────────
# ⚠️ Sıra kritik: anlık görüntü .env'in birleştirme ÖNCESİ hâlini yakalamalı.
# İlk sürümde bu tersti (önce birleştir, sonra anlık görüntü al) — bir geri
# alma o zaman zaten YÜKSELTİLMİŞ .env'i "eski" diye geri yazıyordu, `up -d`
# aynı bozuk VERSION_*'ı tekrar çekiyordu ve ikinci sağlık kontrolü de düşüyordu
# (onprem-Gegenlesen 12.09.2026 — J5'in kendi sırası hatalıydı, betik tasarıma
# sadıktı, tasarım yanlıştı; düzeltme burada, sırayla).
SNAPSHOT_DIR="$STAND_DIR/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$SNAPSHOT_DIR"
for yol in $degisen_dosyalar; do
  hedef="$SCRIPT_DIR/$yol"
  if [ -f "$hedef" ]; then
    mkdir -p "$SNAPSHOT_DIR/$(dirname "$yol")"
    cp "$hedef" "$SNAPSHOT_DIR/$yol"
  fi
done
cp "$ENV_FILE" "$SNAPSHOT_DIR/.env" 2>/dev/null || true
# Rotasyon: yalnız son 3 anlık görüntü.
ls -1dt "$STAND_DIR"/2*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf

# Snapshot'tan (dizin yapısını KORUYARAK) geri yükler — düz `basename` glob'u
# DEĞİL: ilk sürüm `for f in "$SNAPSHOT_DIR"/*` + `[ -f "$f" ]` kullanıyordu,
# bu alt dizinleri (volumes/api/kong.yml, volumes/db/*.sql) sessizce ATLIYORDU
# — bir geri alma compose'u eskiye döndürüp init SQL'lerini YENİ bırakırdı,
# tam olarak J3'ün yasakladığı "yarım uygulanmış paket" hâli (onprem-Gegenlesen
# 12.09.2026). Bu turda hiç değişmemiş (henüz oluşmamış) bir dosya varsa siler
# — o dosya update'ten ÖNCE yoktu, "geri" hâli budur.
geri_yukle() {
  cp "$SNAPSHOT_DIR/.env" "$ENV_FILE" 2>/dev/null || true
  for yol in $degisen_dosyalar; do
    kaynak="$SNAPSHOT_DIR/$yol"
    hedef="$SCRIPT_DIR/$yol"
    if [ -f "$kaynak" ]; then
      mkdir -p "$SCRIPT_DIR/$(dirname "$yol")"
      cp "$kaynak" "$hedef"
    else
      rm -f "$hedef"
    fi
  done
}

# ── .env birleştirme (J4) — anahtar bazında, metin merge DEĞİL ─────────────
TABAN_ENV="$STAND_DIR/env.taban.template"
BIZIM_ENV="$BUNDLE_TMP/bundle/.env.template"
catisan_anahtarlar=""

anahtarlari_oku() {
  # $1 = dosya. "KEY=value" satırlarını KEY'e göre çıkarır (yorumları/boşları atlar).
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$1" 2>/dev/null | cut -d= -f1
}
deger_oku() {
  # $1 = dosya, $2 = anahtar. Anahtar yoksa boru hattı `grep` (1) döner ve
  # çağıran `|| echo '__yok__'` ile yakalar — bu ANCAK dosyanın başındaki
  # `set -euo pipefail` sayesinde doğru çalışır (onprem-Gegenlesen 12.09.2026):
  # pipefail olmadan boru hattının SON komutu (`cut`, hep 0) sonucu belirler,
  # eksik anahtar sessizce boş dizgi döner ve J4'ün "yeni anahtar" dalı hiç
  # tetiklenmezdi.
  grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2-
}

if [ -f "$TABAN_ENV" ]; then
  for anahtar in $(anahtarlari_oku "$BIZIM_ENV"); do
    bizim_deger="$(deger_oku "$BIZIM_ENV" "$anahtar")"
    taban_deger="$(deger_oku "$TABAN_ENV" "$anahtar" || echo '__yok__')"
    onun_deger="$(deger_oku "$ENV_FILE" "$anahtar" || echo '__yok__')"

    if [ "$onun_deger" = "__yok__" ]; then
      # Yeni anahtar — sona eklenir.
      printf '\n# neu in %s\n%s=%s\n' "${BUNDLE_SURUM:-?}" "$anahtar" "$bizim_deger" >> "$ENV_FILE"
      continue
    fi
    if [ "$bizim_deger" = "$taban_deger" ]; then
      continue # biz değiştirmedik — müşterinin değeri (sır dahil) dokunulmaz kalır
    fi
    if [ "$onun_deger" = "$taban_deger" ]; then
      # Bizim yükseltmemiz uygulanır (ör. VERSION_*).
      tmp_env="$ENV_FILE.tmp"
      sed -E "s|^$anahtar=.*|$anahtar=$bizim_deger|" "$ENV_FILE" > "$tmp_env" && mv "$tmp_env" "$ENV_FILE"
      chmod 600 "$ENV_FILE"
    else
      # İkisi de değiştirdi — müşterininki kalır, çakışma kaydedilir.
      catisan_anahtarlar="$catisan_anahtarlar $anahtar"
    fi
  done
  if [ -n "$catisan_anahtarlar" ]; then
    warn ".env çakışması (müşterinin değeri korundu, güncelleme devam ediyor):$catisan_anahtarlar"
  fi
else
  log "  İlk çalıştırma — .env için taban şablonu henüz yok, bu turda .env birleştirmesi atlandı."
fi

# ── Schritt 7 — Yeni dosyaları yaz ──────────────────────────────────────────
# ⚠️ TABAN_ENV (bir sonraki koşunun .env karşılaştırma tabanı) burada
# YAZILMIYOR — yalnız gerçek bir başarıda (aşağıda, sonuc=ok). İlk sürümde
# burada yazılıyordu: bir geri alma sonrası taban "bunu uyguladık" derdi,
# oysa uygulanmamıştı; ertesi gece bizim==taban eşleşir, yükseltme bir daha
# HİÇ denenmezdi — kutu sessizce eski sürümde kalırdı (onprem-Gegenlesen
# 12.09.2026).
for yol in $degisen_dosyalar; do
  kaynak="$BUNDLE_TMP/bundle/$yol"
  hedef="$SCRIPT_DIR/$yol"
  if [ -f "$kaynak" ]; then
    mkdir -p "$(dirname "$hedef")"
    cp "$kaynak" "$hedef"
  fi
done

# ── İki kapı (Schritt 7b) — konteynerlere dokunmadan, bedava ───────────────
if ! docker compose config -q 2>>"$LOG_FILE"; then
  fehler "Yeni compose dosyası geçersiz" "'docker compose config -q' başarısız" "geçerli bir YAML" \
    "Değişiklikler geri alınıyor, kutu eski hâliyle çalışmaya devam ediyor."
  geri_yukle
  durumu_yaz "geri_alindi" "\"sebep\": \"compose_config_gecersiz\","
  exit 1
fi

eksik_mount=""
# Yalnız bir uzantısı olan kaynaklar (.sql/.yml/.sh) — uzantısız iki mount
# (volumes/db/data, volumes/storage) CANLI VERİ dizinleridir, dosya değil;
# aynı ayrım tools/check-onprem.sh'ın O-72 sayacında da var (12.09.2026,
# ilk sürümde unutulmuştu, gerçek kutuya karşı test edilirken bulundu —
# testte kendi veri dizinlerini "eksik dosya" diye işaretleyip geri
# alma yapmıştı).
for kaynak in $(grep -oE '\./volumes/[^:[:space:]"'"'"']+\.[A-Za-z0-9]+' docker-compose.yml | sort -u); do
  if [ ! -f "$SCRIPT_DIR/${kaynak#./}" ]; then
    eksik_mount="$eksik_mount $kaynak"
  fi
done
if [ -n "$eksik_mount" ]; then
  fehler "Bind-mount kaynağı diskte dosya olarak yok (O-72)" "$eksik_mount" "her kaynak bir dosya olarak var" \
    "Docker aksi halde sessizce boş bir DİZİN yaratırdı — O-49'un webhooks.sql dersinin aynısı. Değişiklikler geri alınıyor."
  geri_yukle
  durumu_yaz "geri_alindi" "\"sebep\": \"eksik_mount_kaynagi\","
  exit 1
fi
ok "İki kapı da geçti (compose geçerli, bind-mount kaynakları yerinde)"

# ── Schritt 8 — Migration-öncesi yedek (O-26, backup.sh çağrısı) ───────────
# "Migration çalışmadan önce kutu yedeği alır; yedek alınamıyorsa migration
# ÇALIŞMAZ." Migration'lar `api` konteyneri başlarken (server.js app.listen()'
# den ÖNCE, satır ~4536) koşuyor — yani güvenli durak burasıdır: konteyneri
# yeniden başlatan `up -d`'den (aşağıda) hemen önce, en son burada.
#
# O-77'nin ilk sürümü burada gömülü bir pg_dump bloğuydu (yalnız DB, künyesiz,
# koşulsuz). onprem'in O-26 tasarım turu bunu YENİDEN YAZDIRDI — §4.3
# "Faz 2.3'ün gecelik yedeğiyle aynı kod, farklı tetikleyici" kuralına uyarak:
# gerçek iş artık `backup.sh`'ta (storage + DB + künye + rotasyon), burada
# yalnız İKİ şey var: (a) bekleyen migration var mı diye BASİT bir kontrol —
# §4.3'ün "bekleyen yoksa yedek de yok" kuralı — (b) varsa/belirsizse
# backup.sh'ı çağırmak, PRAXURA_LOCK_HELD=1 ile (bu betik zaten Schritt 0'da
# kilidi tutuyor, backup.sh'ın kendi kilidi almaya çalışması kilitlenirdi).
#
# ⚠️ Kasıtlı olarak APTAL bir kontrol (onprem: migrate.js'in planErstellen()'i
# bash'te tekrar yazma — sapma yönü kötü olursa yedeksiz migration çıkar).
# Yalnız DOSYA ADI kümesi ↔ `praxura_migrations` karşılaştırılıyor, checksum
# yok. HER belirsizlikte (db'ye bağlanılamadı, dizin boş geldi, ayrıştırma
# hatası) sonuç "bekleyen VAR" sayılır — tek izinli hata yönü gereksiz yedek,
# asla yedeksiz migration değil. İkinci, kaba bir okuyucu olduğu not edildi:
# api-backend/db/migrations/README.md.
log "[8/11] Bekleyen migration kontrol ediliyor (yedek gerekiyor mu?)"
BEKLEYEN_VAR=1
MIGRATIONS_DIZIN="$BUNDLE_TMP/migrations"
if [ -d "$MIGRATIONS_DIZIN" ]; then
  BUNDLE_DOSYALAR="$(find "$MIGRATIONS_DIZIN" -maxdepth 1 -name '*.sql' -printf '%f\n' 2>/dev/null | sed -E 's/^([0-9]{4}).*/\1/' | sort -u)"
  UYGULANAN_VERSIYONLAR="$(docker compose exec -T db psql -U postgres -d "$(env_wert POSTGRES_DB)" -tAc "SELECT version FROM praxura_migrations;" 2>>"$LOG_FILE" | tr -d '\r' | sort -u)"
  if [ -n "$BUNDLE_DOSYALAR" ] && [ -n "$UYGULANAN_VERSIYONLAR" ]; then
    EKSIK="$(comm -23 <(printf '%s\n' "$BUNDLE_DOSYALAR") <(printf '%s\n' "$UYGULANAN_VERSIYONLAR") 2>/dev/null)"
    if [ -z "$EKSIK" ]; then
      BEKLEYEN_VAR=0
    fi
  fi
  log "DEBUG dizin=$MIGRATIONS_DIZIN bundle=[$(printf '%s' "$BUNDLE_DOSYALAR" | tr '\n' ',')] uygulanan=[$(printf '%s' "$UYGULANAN_VERSIYONLAR" | tr '\n' ',')] eksik=[$(printf '%s' "$EKSIK" | tr '\n' ',')]"
else
  log "DEBUG dizin yok: $MIGRATIONS_DIZIN"
fi

if [ "$BEKLEYEN_VAR" -eq 0 ]; then
  ok "Bekleyen migration yok — bu gece yedek atlandı (RELEASE-STANDARD.md §4.3)."
else
  log "  Bekleyen migration var (ya da belirsiz) — yedek alınıyor."
  if ! PRAXURA_LOCK_HELD=1 bash "$SCRIPT_DIR/backup.sh" --sebep vor-migration; then
    # ⚠️ backup.sh kendi geri_yukle()'sine sahip değil (update.sh'ın dahili
    # fonksiyonu) — Schritt 7 bu noktada zaten dosya yazdı ve .env'i
    # birleştirdi, betiğin kendi sözü ("yalnız dosyalar geri alınır") burada
    # da geçerli olmalı (O-77 Gegenlesen'in aynı dersi).
    geri_yukle
    fehler "Migration-öncesi yedek alınamadı — güncelleme durduruldu, dosyalar geri alındı" \
      "backup.sh başarısız (bkz. backup.log)" "başarılı bir yedek" \
      "backup.log'a bak (aynı dizinde). Bu geceki güncelleme atlandı, image'a dokunulmadı."
    durumu_yaz "yedek_basarisiz"
    exit 1
  fi
fi

# ── Schritt 9 — pull + up ───────────────────────────────────────────────────
# ⚠️ `up -d` burada `set -e`'ye bırakılmaz (`|| true` ile yumuşatılır): image
# geçersizse (ör. bozuk bir :stable etiketi) komut doğrudan başarısız olur ve
# script hiç rollback denemeden çıkardı — Schritt 9'un "başarısızsa geri al"
# mantığı hiç çalışmazdı (onprem-Gegenlesen 12.09.2026). Başarısızlık burada
# da aynı geri-alma+yeniden-dene yoluna düşer, aşağıdaki `if` üzerinden.
log "[9/11] docker compose pull && up -d --remove-orphans"
docker compose pull >>"$LOG_FILE" 2>&1 || true
ilk_up_basarili=1
docker compose up -d --remove-orphans >>"$LOG_FILE" 2>&1 || ilk_up_basarili=0
[ "$ilk_up_basarili" -eq 1 ] || warn "'docker compose up -d' başarısız oldu — sağlık kontrolüne girmeden geri alma denenecek"

# ── Schritt 10 — Sağlık ──────────────────────────────────────────────────────
log "[10/11] Sağlık kontrolü (lib-health.sh)"
if [ "$ilk_up_basarili" -eq 1 ] && warte_auf_gesundheit 180; then
  sonuc="ok"
else
  warn "Sağlıklı olmadı — dosyalar geri alınıyor ve yeniden deneniyor"
  geri_yukle
  docker compose up -d --remove-orphans >>"$LOG_FILE" 2>&1 || true
  if warte_auf_gesundheit 120; then
    sonuc="geri_alindi"
    warn "Geri alındıktan sonra kutu tekrar sağlıklı"
  else
    sonuc="bakim_modu"
    fehler "Kutu geri alındıktan sonra da sağlıklı değil" "health check başarısız (iki deneme)" "8 container healthy" \
      "Destek bilgisi: 'docker compose ps --all' + 'docker compose logs' + $LOG_FILE. K10 gereği içeri giremiyoruz."
  fi
fi

# ── Schritt 11 — Durum dosyası ───────────────────────────────────────────────
# DATEIEN_SHA_FILE (sapma tabanı) ve TABAN_ENV (.env birleştirme tabanı)
# YALNIZ burada, gerçek bir "ok" sonrasında güncellenir — "geri_alindi" ve
# "bakim_modu" ikisini de OLDUĞU GİBİ bırakır (dosyalar zaten eskiye döndü,
# taban da eski kalmalı).
if [ "$sonuc" = "ok" ]; then
  {
    printf '{'
    ilk=1
    while IFS=$'\t' read -r yol _; do
      [ -z "$yol" ] && continue
      [ "$yol" = ".env.template" ] && continue
      [ "$yol" = "update.sh" ] && continue # yukarıdaki Schritt 4/5 notuyla aynı gerekçe
      hedef="$SCRIPT_DIR/$yol"
      [ -f "$hedef" ] || continue
      sha="$(sha256sum "$hedef" | awk '{print $1}')"
      [ "$ilk" -eq 1 ] || printf ','
      ilk=0
      printf '\n  "%s": "%s"' "$yol" "$sha"
    done < <(grep -oE '"yol"[[:space:]]*:[[:space:]]*"[^"]+"' "$MANIFEST" | sed -E 's/.*"([^"]+)"$/\1/' | while read -r y; do printf '%s\t\n' "$y"; done)
    printf '\n}\n'
  } > "$DATEIEN_SHA_FILE.tmp"
  mv "$DATEIEN_SHA_FILE.tmp" "$DATEIEN_SHA_FILE"
  cp "$BIZIM_ENV" "$TABAN_ENV"
fi

if [ -n "$catisan_anahtarlar" ]; then
  durumu_yaz "$sonuc" "\"env_catismalari\": \"$catisan_anahtarlar\","
else
  durumu_yaz "$sonuc"
fi

log "[11/11] Bitti — sonuç: $sonuc"
[ "$sonuc" = "ok" ] || [ "$sonuc" = "geri_alindi" ]
