#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — install.sh (Playbook Phase 2.1c)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 11.09.2026 · Design gesperrt in onprem/REGISTER.md §7G (Konsultation
#  mit dem onprem-Agenten, 15-Schritt-Tabelle, zwei Gegenlesen-Runden — O-63/
#  O-64/O-65) und §7H/O-66 (SMTP-Schritt, Entscheidung Kemal 11.09.2026: SMTP
#  wird HIER gefragt, nicht im Assistenten — GoTrue liest seine Umgebung nur
#  beim Start, ein Browser-Formular käme dort nie an). NICHT ohne erneute
#  Konsultation umbauen — jede Zeile hier hat einen Grund, der dort steht.
#
#  Was dieses Skript TUT: Hardware/Software prüfen, .env erzeugen, Geheimnisse
#  AUF DIESEM SERVER würfeln (G2 — keins davon kommt von uns oder geht an uns),
#  ANON_KEY/SERVICE_ROLE_KEY aus JWT_SECRET ableiten (O-60 — NICHT würfeln),
#  optional SMTP abfragen (O-66), die Box hochfahren, mit dem abgeleiteten
#  Schlüssel wirklich testen.
#
#  Was dieses Skript NICHT TUT: kein Owner-Konto, kein Praxisname, kein
#  Backup-Ziel, keine SMTP-*Testmail* (die schickt der Assistent — er hat
#  einen Empfänger, dieses Skript noch keinen). Sobald im Browser der erste
#  Bildschirm des Assistenten (Phase 2.2) erscheint, ist die Aufgabe dieses
#  Skripts erledigt.
#
#  Fehlermodell (K10 — wir kommen nicht in die Box): jeder Schritt meldet
#  [ok]/[fehler]; ein Fehler nennt GEFUNDEN · ERWARTET · WAS TUN und STOPPT.
#  Kein Schritt läuft nach einem Fehler weiter. Alles geht zusätzlich nach
#  install.log — AUSSER den Geheimnissen selbst (nur "erzeugt", nie der Wert).
#
#  Erneuter Lauf: ohne --neu bricht das Skript ab, wenn .env schon existiert
#  (Idempotenz, RELEASE-STANDARD.md §5.5/1 — erzeugte Geheimnisse werden nicht
#  zweimal erzeugt). --neu LÖSCHT die Datenbank — die Bestätigung kommt früh
#  (Schritt 0), die eigentliche Löschung aber erst NACH allen Vorprüfungen
#  (unmittelbar vor Schritt 5): eine Box, die an Schritt 3 (Port belegt)
#  scheitert, soll dabei keine vorhandene Datenbank verloren haben.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/install.log"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_TEMPLATE="$SCRIPT_DIR/.env.template"

# ── Ausgabe-Helfer ───────────────────────────────────────────────────────────
# log(): Bildschirm UND install.log. Für Geheimnis-Werte NIE benutzen — dafür
# gibt es reveal_once(), die absichtlich NICHT nach install.log schreibt.
log() { printf '%s\n' "$*" | tee -a "$LOG_FILE"; }
ok()   { log "  [ok] $*"; }
warn() { log "  [warn] $*"; }
reveal_once() { printf '%s\n' "$*"; }  # bewusst OHNE tee — siehe Kopf der Datei

fail() {
  # $1 Titel · $2 gefunden · $3 erwartet · $4 was-tun
  log ""
  log "  ✗ [fehler] $1"
  log "      Gefunden:  $2"
  log "      Erwartet:  $3"
  log "      Was tun:   $4"
  log ""
  log "  Kompletter Ablauf: $LOG_FILE"
  exit 1
}

# env_get KEY — liest eine "KEY=WERT"-Zeile aus .env zurück. Bewusst NICHT
# "grep … | cut …" ohne Absicherung: unter `set -o pipefail` macht ein
# NICHT gefundener Schlüssel grep zu einem Fehlschlag, und dieser Fehlschlag
# reisst unter `set -e` das ganze Skript OHNE Fehlermeldung mit — genau in
# der Zeile, die eigentlich eine ordentliche Meldung erzeugen soll (mit
# lokalem bash nachvollzogen, onprem-Gegenlesen 11.09.2026). Das
# nachgestellte "|| true" faengt NUR den Exit-Code ab, nicht die Ausgabe:
# awk gibt bei keinem Treffer ohnehin sauber eine leere Zeile zurueck.
env_get() {
  awk -F= -v k="$1" '$1==k{sub(/^[^=]*=/,""); print; f=1} END{if(!f) print ""}' "$ENV_FILE" 2>/dev/null || true
}

: > "$LOG_FILE"
log "Praxura On-Premise — Einrichtung $(date '+%Y-%m-%d %H:%M:%S')"
log ""

# Das Skript fragt mehrfach interaktiv (Adresse, TLS-Modus, SMTP, ggf. --neu-
# Bestätigung, ggf. Docker-Installation). Aus einer Pipe heraus gestartet
# (z. B. "curl … | sudo bash") liest `read` dann vom Installationsskript
# selbst statt von einer Person — das Fehlermodell (K10: klare Meldung statt
# stillem Abbruch) wäre komplett umgangen (Gegenlesen 11.09.2026, 3. Runde).
if [ ! -t 0 ]; then
  fail "Kein interaktives Terminal" "Eingabe kommt nicht von einer Tastatur (z. B. aus einer Pipe)" \
    "direkter Aufruf in einem Terminal" \
    "Repository klonen und 'sudo bash install.sh' direkt in einer SSH-Sitzung ausführen, nicht über eine Pipe."
fi

NEU=0
for arg in "$@"; do
  [ "$arg" = "--neu" ] && NEU=1
done

# ── Schritt 0 — Wurzel + Idempotenz ─────────────────────────────────────────
log "[0/15] Wurzel- und Wiederholungsprüfung"
if [ "$(id -u)" -ne 0 ]; then
  fail "Kein Root" "Benutzer $(id -un)" "root (Docker-Setup, Port 80/443, Dateirechte brauchen es)" \
    "Mit 'sudo bash install.sh' erneut starten."
fi

if [ -f "$ENV_FILE" ] && [ "$NEU" -ne 1 ]; then
  fail ".env existiert bereits" "$ENV_FILE" "kein .env, ODER --neu bewusst gesetzt" \
    "Box neu starten: 'docker compose up -d'. Wirklich neu erzeugen (LÖSCHT DIE DATENBANK): 'bash install.sh --neu'."
fi

NEU_BESTAETIGT=0
if [ "$NEU" -eq 1 ] && [ -d "$SCRIPT_DIR/volumes/db/data" ]; then
  log ""
  log "  ⚠️  --neu gesetzt: neue Geheimnisse werden erzeugt, aber die vorhandene"
  log "      Datenbank in volumes/db/data ist mit den ALTEN Geheimnissen verschlüsselt/"
  log "      authentifiziert. Sie wird nach den Vorprüfungen UNWIEDERBRINGLICH GELÖSCHT."
  read -r -p "  Zum Fortfahren genau tippen: LÖSCHEN " confirm
  [ "$confirm" = "LÖSCHEN" ] || fail "Bestätigung nicht erhalten" "'$confirm'" "'LÖSCHEN'" "Abgebrochen, nichts wurde verändert."
  NEU_BESTAETIGT=1
fi
ok "root, Neuanlage möglich"

# ── Schritt 1 — Hardware ─────────────────────────────────────────────────────
log "[1/15] Hardware-Vorprüfung"
CPU_COUNT="$(nproc 2>/dev/null || echo 0)"
MEM_KB="$(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
MEM_GB=$(( MEM_KB / 1024 / 1024 ))
DISK_KB="$(df -Pk "$SCRIPT_DIR" 2>/dev/null | awk 'NR==2{print $4}' || echo 0)"
DISK_GB=$(( DISK_KB / 1024 / 1024 ))

[ "$CPU_COUNT" -ge 2 ] || fail "Zu wenige CPU-Kerne" "$CPU_COUNT" "mindestens 2" "Server mit mindestens 2 vCPU verwenden (Playbook Phase 2.1c)."
# Schwelle 3, nicht 4: ein nominell "4 GB"-Server meldet durch Kernel-/
# Hypervisor-Reservierung oft nur 3,7-3,9 GB freien MemTotal — die
# ganzzahlige Division rundet das auf 3 ab. Echte Anforderung bleibt 4 GB.
[ "$MEM_GB" -ge 3 ] || fail "Zu wenig Arbeitsspeicher" "${MEM_GB} GB" "mindestens 4 GB (kann als ~3 GB gemeldet werden, siehe Kommentar)" "Server mit mindestens 4 GB RAM verwenden."
[ "$DISK_GB" -ge 40 ] || fail "Zu wenig freier Speicher" "${DISK_GB} GB" "mindestens 40 GB" "Speicherplatz freigeben oder größeren Server verwenden."
ok "${CPU_COUNT} vCPU · ${MEM_GB} GB RAM · ${DISK_GB} GB frei"

if command -v swapon >/dev/null 2>&1; then
  swapon --show 2>/dev/null | grep -q . || warn "Kein Swap eingerichtet — bei Speicherdruck beendet der Kernel einen Container statt zu bremsen (gemessenes Risiko, heutige VPS)."
else
  warn "swapon nicht gefunden — Swap-Status konnte nicht geprüft werden."
fi

# ── Schritt 2 — Software ─────────────────────────────────────────────────────
log "[2/15] Software-Vorprüfung"
command -v curl >/dev/null 2>&1 || fail "curl fehlt" "nicht installiert" "curl" "apt install curl"
command -v openssl >/dev/null 2>&1 || fail "openssl fehlt" "nicht installiert" "openssl" "apt install openssl"

if ! printf 'x' | base64 -w0 >/dev/null 2>&1; then
  fail "base64 unterstützt -w0 nicht" "$(base64 --version 2>&1 | head -1)" "GNU coreutils base64" \
    "Skript ist nur für Ubuntu 24.04 getestet (Playbook-Zielsystem). Anderes OS: onprem-Agenten konsultieren."
fi
ok "base64 -w0 verfügbar (GNU coreutils)"

if ! command -v docker >/dev/null 2>&1; then
  warn "Docker nicht gefunden."
  read -r -p "  Offizielles Docker-Installationsskript jetzt ausführen (curl https://get.docker.com | sh)? [j/N] " antwort
  if [ "$antwort" = "j" ] || [ "$antwort" = "J" ]; then
    curl -fsSL https://get.docker.com | sh
  else
    fail "Docker nicht installiert" "nicht installiert" "Docker Engine + Compose-Plugin" "https://docs.docker.com/engine/install/ubuntu/ folgen, dann erneut starten."
  fi
fi
docker compose version >/dev/null 2>&1 || fail "Docker-Compose-Plugin fehlt" "nicht gefunden" "'docker compose' (Plugin, nicht das alte docker-compose)" "apt install docker-compose-plugin"
ok "docker + docker compose vorhanden"

# ── Schritt 3 — Ports ─────────────────────────────────────────────────────────
log "[3/15] Port-Vorprüfung (80, 443)"
if command -v ss >/dev/null 2>&1; then
  for port in 80 443; do
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${port}\$"; then
      besetzer="$(ss -ltnp 2>/dev/null | awk -v p=":${port}\$" '$4 ~ p {print $0}' | head -1)"
      fail "Port ${port} ist belegt" "${besetzer:-unbekannter Prozess}" "Port ${port} frei (Caddy braucht ihn)" \
        "Den Dienst auf Port ${port} stoppen oder auf einem anderen Server installieren."
    fi
  done
  ok "80 und 443 sind frei"
else
  warn "'ss' nicht gefunden — Port-Vorprüfung übersprungen. 'docker compose up' meldet einen Portkonflikt notfalls selbst, aber später und weniger klar."
fi

# ── Schritt 4 — Adresse (O-59) ────────────────────────────────────────────────
log "[4/15] Adresse der Box"
log "  Unter welcher Adresse ruft der Praxisrechner die Box im Browser auf?"
log "  Beispiel: https://praxis.local  (ohne Port — Caddy hört auf 443)"
read -r -p "  SITE_URL: " SITE_URL_INPUT
case "$SITE_URL_INPUT" in
  https://*) : ;;
  *) fail "Falsches Schema" "$SITE_URL_INPUT" "https://… (kein http, TLS ist Pflicht)" "Erneut mit https:// beginnen." ;;
esac
# Port oder Pfad im Host-Anteil verboten (O-59: Caddy site-address matcht
# exakten Host, keinen Pfad).
HOST_PART="${SITE_URL_INPUT#https://}"
HOST_PART="${HOST_PART%/}"
case "$HOST_PART" in
  *:*) fail "Adresse enthält einen Port" "$SITE_URL_INPUT" "kein Port — https://name, ohne :nnnn" \
    "Ohne Port eintragen. Caddy hört ohnehin fest auf 443." ;;
  */*) fail "Adresse enthält einen Pfad" "$SITE_URL_INPUT" "nur der Host — https://name, kein /irgendwas" \
    "Nur die Domain/den Hostnamen eintragen, ohne alles nach dem ersten '/'." ;;
esac
SITE_URL="https://${HOST_PART}"
ok "SITE_URL = ${SITE_URL}"

# ── Jetzt erst, nach allen Vorprüfungen: alte Datenbank löschen (falls --neu) ─
if [ "$NEU_BESTAETIGT" -eq 1 ]; then
  log "Vorprüfungen bestanden — lösche jetzt die vorhandene Datenbank (--neu)"
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$SCRIPT_DIR/volumes/db/data" "$SCRIPT_DIR/volumes/storage"
  ok "Alte Datenbank entfernt"
fi

# ── Schritt 5 — .env aus Vorlage ─────────────────────────────────────────────
log "[5/15] .env aus Vorlage erzeugen"
[ -f "$ENV_TEMPLATE" ] || fail "Vorlage fehlt" "$ENV_TEMPLATE nicht gefunden" "onprem/.env.template im Repository" "Repository vollständig auschecken."
cp "$ENV_TEMPLATE" "$ENV_FILE"
chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE" 2>/dev/null || true
ok ".env angelegt, chmod 600 (O-61)"

# set_env KEY VALUE — ersetzt "KEY=" Zeile in .env, ohne den Wert zu loggen.
#
# ACHTUNG: der Wert geht über ENVIRON, NICHT über ein zweites "-v v=...".
# awks "-v"-Zuweisung interpretiert Backslash-Escapes im ÜBERGEBENEN Wert
# (z. B. wird "\b" zu einem Backspace-Byte) — bei den gewürfelten Hex-Werten
# fiel das nie auf, aber SMTP_PASS ist beliebiger Text von Menschenhand, und
# ein Passwort mit Backslash würde so lautlos verstümmelt. ENVIRON liest die
# Shell-Variable roh, ohne dass awk sie nochmal interpretiert (geprüft: ein
# "\b" im Wert kommt unverändert in .env an).
set_env() {
  local key="$1"
  export SET_ENV_VALUE="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    local tmp; tmp="$(mktemp -p "$SCRIPT_DIR")"
    awk -v k="$key" 'BEGIN{FS=OFS="="} $1==k{$0=k"="ENVIRON["SET_ENV_VALUE"]} {print}' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$SET_ENV_VALUE" >> "$ENV_FILE"
  fi
  unset SET_ENV_VALUE
}

set_env SITE_URL "$SITE_URL"
set_env API_EXTERNAL_URL "$SITE_URL"
set_env SUPABASE_PUBLIC_URL "$SITE_URL"

# ── Schritt 6 — Geheimnisse würfeln (G2, ausschliesslich auf diesem Server) ──
log "[6/15] Geheimnisse erzeugen (auf diesem Server, G2)"
# Alle Werte als HEX, nicht Base64: POSTGRES_PASSWORD landet in mehreren
# postgres://user:PASSWORT@host-Verbindungs-URIs (docker-compose.yml) — ein
# zufälliges '/' oder '+' aus Base64 wäre dort ein URL-Sonderzeichen und
# bräche das Parsing gelegentlich, abhängig vom Zufall. Hex hat dieses
# Problem strukturell nicht (Alphabet 0-9a-f), deshalb einheitlich hex.
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 32)"
SECRET_KEY_BASE="$(openssl rand -hex 32)"
# 16 Zeichen = AES-128-Schlüssel, wie Upstreams eigener Default
# "supabaserealtime" (ebenfalls 16 Zeichen) — NICHT -hex 16 (das wären 32).
REALTIME_DB_ENC_KEY="$(openssl rand -hex 8)"
S3_KEY_ID="$(openssl rand -hex 16)"
S3_KEY_SECRET="$(openssl rand -hex 32)"
DATA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
# Einrichtungs-Jeton für den Assistenten (O-62) — HIER erzeugt, nicht erst im
# Ausgabe-Schritt: der `api`-Container liest seine Umgebung beim Start, ein
# Wert, der erst NACH "docker compose up" entsteht, kommt nie an (Gegenlesen
# 11.09.2026 — ursprünglich stand das im letzten Schritt und war wirkungslos).
SETUP_TOKEN="$(openssl rand -hex 24)"

set_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
set_env JWT_SECRET "$JWT_SECRET"
set_env SECRET_KEY_BASE "$SECRET_KEY_BASE"
set_env REALTIME_DB_ENC_KEY "$REALTIME_DB_ENC_KEY"
set_env S3_PROTOCOL_ACCESS_KEY_ID "$S3_KEY_ID"
set_env S3_PROTOCOL_ACCESS_KEY_SECRET "$S3_KEY_SECRET"
set_env DATA_ENCRYPTION_KEY "$DATA_ENCRYPTION_KEY"
set_env SETUP_TOKEN "$SETUP_TOKEN"
ok "acht Geheimnisse erzeugt (Werte NICHT geloggt)"

# ── Schritt 7 — ANON_KEY / SERVICE_ROLE_KEY aus JWT_SECRET ableiten (O-60) ───
log "[7/15] ANON_KEY / SERVICE_ROLE_KEY aus JWT_SECRET ableiten"
# HS256, per Hand — kein Node auf dem Host nötig (Herleitung gegen Node
# gegengeprüft, onprem/REGISTER.md O-60). exp = 10 Jahre, NICHT JWT_EXPIRY
# (das ist die Sitzungsdauer eingeloggter Nutzer, nicht der API-Schlüssel).
b64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }
sign_jwt() {
  local role="$1"
  local now exp header payload signing_input signature
  now="$(date +%s)"
  exp=$(( now + 10*365*24*3600 ))
  header='{"alg":"HS256","typ":"JWT"}'
  payload="{\"role\":\"${role}\",\"iss\":\"supabase\",\"iat\":${now},\"exp\":${exp}}"
  signing_input="$(printf '%s' "$header" | b64url).$(printf '%s' "$payload" | b64url)"
  signature="$(printf '%s' "$signing_input" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)"
  printf '%s.%s' "$signing_input" "$signature"
}
ANON_KEY="$(sign_jwt anon)"
SERVICE_ROLE_KEY="$(sign_jwt service_role)"
set_env ANON_KEY "$ANON_KEY"
set_env SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
ok "ANON_KEY / SERVICE_ROLE_KEY abgeleitet (nicht gewürfelt)"

# ── Schritt 8 — SUPABASE_PUBLIC_WSS (O-52 b) ─────────────────────────────────
log "[8/15] SUPABASE_PUBLIC_WSS"
# Ein Origin (Normalfall, siehe .env.template §3): 'self' im CSP deckt das
# eigene wss:// schon ab — Feld bleibt leer, kein Rätselraten nötig.
set_env SUPABASE_PUBLIC_WSS ""
ok "leer gelassen (SUPABASE_PUBLIC_URL = SITE_URL, ein Origin)"

# ── Schritt 9 — Pflichtfeld-Tor (O-53) ───────────────────────────────────────
log "[9/15] Pflichtfelder prüfen, bevor irgendetwas startet"
for key in SUPABASE_PUBLIC_URL ANON_KEY SERVICE_ROLE_KEY JWT_SECRET POSTGRES_PASSWORD DATA_ENCRYPTION_KEY SETUP_TOKEN; do
  wert="$(env_get "$key")"
  [ -n "$wert" ] || fail "Pflichtfeld leer: ${key}" "leer" "erzeugter Wert" "Skript erneut mit --neu starten — dies deutet auf einen Fehler in Schritt 6/7 hin."
done
ok "alle Pflichtfelder gefüllt"

# ── Schritt 10 — TLS-Modus ───────────────────────────────────────────────────
log "[10/15] TLS-Modus"
log "  Ist ${SITE_URL} von ausserhalb dieses Netzes über eine echte Domain"
log "  erreichbar (öffentliches DNS), UND soll Let's Encrypt ein echtes"
log "  Zertifikat ausstellen?"
read -r -p "  Echtes Zertifikat einrichten? [j/N] " tls_antwort
if [ "$tls_antwort" = "j" ] || [ "$tls_antwort" = "J" ]; then
  read -r -p "  E-Mail-Adresse für Let's-Encrypt-Benachrichtigungen: " acme_mail
  [ -n "$acme_mail" ] || fail "Keine E-Mail-Adresse" "leer" "eine gültige E-Mail-Adresse" "Erneut ausführen und Adresse eintragen."
  CADDY_TLS_ARG_VALUE="$acme_mail"
  set_env CADDY_TLS_ARG "$CADDY_TLS_ARG_VALUE"
  set_env HSTS_MAX_AGE "63072000"
  ok "TLS: Let's Encrypt (${acme_mail})"
else
  CADDY_TLS_ARG_VALUE="internal"
  set_env CADDY_TLS_ARG "$CADDY_TLS_ARG_VALUE"
  set_env HSTS_MAX_AGE "0"
  ok "TLS: Caddys eigene Zertifizierungsstelle (selbstsigniert, LAN-only)"
  log "  ⚠️  Jeder Praxisrechner muss Caddys Root-Zertifikat einmalig als vertrauenswürdig"
  log "      einstufen (letzter Schritt zeigt, wo es liegt), sonst zeigt der Browser eine Warnung."
fi

# ── Schritt 11 — SMTP (O-66) ─────────────────────────────────────────────────
log "[11/15] SMTP (Einladungen, Passwort-Reset, Termin-Mails)"
log "  Ohne SMTP startet die Box trotzdem — aber niemand bekommt eine Mail:"
log "  keine Mitarbeiter-Einladung, kein Passwort-Reset, keine Terminbestätigung."
log "  Der Assistent (Schritt 2.2) kann eine Testmail schicken, aber SMTP nicht"
log "  EINRICHTEN — GoTrue liest seine Mail-Konfiguration nur beim Start."
read -r -p "  SMTP jetzt einrichten? [J/n] " smtp_antwort
if [ "$smtp_antwort" = "n" ] || [ "$smtp_antwort" = "N" ]; then
  set_env SMTP_HOST ""
  warn "SMTP übersprungen — kann später mit 'bash install.sh --neu' oder von Hand in .env + 'docker compose up -d auth api' nachgeholt werden (BEIDE Container, sonst liest nur einer die neue Adresse)."
else
  read -r -p "  SMTP-Host (z. B. smtp.strato.de): " smtp_host
  [ -n "$smtp_host" ] || fail "Kein SMTP-Host" "leer" "ein Hostname" "Erneut ausführen und Host eintragen, oder [n] für 'ohne SMTP'."
  read -r -p "  SMTP-Port [587]: " smtp_port
  smtp_port="${smtp_port:-587}"
  read -r -p "  SMTP-Benutzername: " smtp_user
  read -r -s -p "  SMTP-Passwort: " smtp_pass
  echo
  read -r -p "  Absenderadresse (z. B. praxis@ihre-domain.de): " smtp_from
  [ -n "$smtp_from" ] || fail "Keine Absenderadresse" "leer" "eine E-Mail-Adresse auf Ihrer eigenen Domain" "Erneut ausführen — ohne eigene Domain weist SPF/DMARC die Mails beim Empfänger ab (Register O-51)."

  # Erreichbarkeitstest — NICHT fail(): ein falscher Port/Firewall-Regel ist
  # kein Grund, die ganze Einrichtung abzubrechen, nur ein fruehes Warnsignal.
  if command -v timeout >/dev/null 2>&1 && ! timeout 5 bash -c ">/dev/tcp/${smtp_host}/${smtp_port}" 2>/dev/null; then
    warn "SMTP-Server unter ${smtp_host}:${smtp_port} antwortet nicht — Firewall oder falscher Port? Wird trotzdem gespeichert, der Assistent kann später erneut testen."
  fi

  set_env SMTP_HOST "$smtp_host"
  set_env SMTP_PORT "$smtp_port"
  set_env SMTP_USER "$smtp_user"
  set_env SMTP_PASS "$smtp_pass"
  # Zwei Ziele, EINE Eingabe: GoTrue braucht SMTP_ADMIN_EMAIL, die eigene
  # Absenderlogik (api-backend/lib/mail.js, O-51) SMTP_FROM — beide sollen
  # dieselbe Adresse sein, sonst wirkt die Herkunft der Mails uneinheitlich.
  set_env SMTP_ADMIN_EMAIL "$smtp_from"
  set_env SMTP_FROM "$smtp_from"
  ok "SMTP gespeichert (${smtp_host}:${smtp_port}) — Testmail folgt im Assistenten"
fi

# ── Schritt 12 — pull + up ───────────────────────────────────────────────────
log "[12/15] Container-Images holen und starten"
if ! docker compose pull 2>&1 | tee -a "$LOG_FILE"; then
  fail "Images konnten nicht geholt werden" "docker compose pull ist fehlgeschlagen" \
    "PRAXURA_API_IMAGE / PRAXURA_FRONTEND_IMAGE als ':stable' erreichbar" \
    "Bekannte Lücke (Register O-25): der Veröffentlichungsweg baut heute nur ':latest' und einen Kurz-SHA-Tag, ':stable' existiert noch nicht überall. Support kontaktieren — NICHT an Ihrer Verbindung liegend."
fi
if ! docker compose up -d 2>&1 | tee -a "$LOG_FILE"; then
  log "  Letzte Zeilen von 'api' (haeufigste Ursache — Migrationskette):"
  docker compose logs --tail=40 api 2>&1 | tee -a "$LOG_FILE" || true
  fail "Container konnten nicht gestartet werden" "docker compose up -d ist fehlgeschlagen" "alle Container gestartet" \
    "Obige 'api'-Logzeilen (auch in $LOG_FILE) an den Support geben — wir kommen nicht in die Box (K10)."
fi
ok "Container gestartet"

# ── Schritt 12 — Gesundheitsprüfung ──────────────────────────────────────────
log "[13/15] Warten, bis alle Dienste gesund sind (bis zu 3 Minuten)"
# Ueber `docker inspect` pro Dienst statt `docker compose ps --format …`:
# die Tabellen-/Template-Unterstuetzung von "ps --format" unterscheidet sich
# zwischen Compose-Versionen, und ein Dienst, der gar keinen Container mehr
# hat (abgestuerzt, nie gestartet), taucht in "ps" ohne "--all" oft schlicht
# nicht auf — der Zwischenstand wirkt dann faelschlich vollstaendig
# (onprem-Gegenlesen 11.09.2026, O-63).
mapfile -t DIENSTE < <(docker compose config --services 2>/dev/null)
ERWARTETE_DIENSTE="${#DIENSTE[@]}"
[ "$ERWARTETE_DIENSTE" -gt 0 ] || fail "Compose-Konfiguration liefert keine Dienste" "0 Dienste" "8 Dienste (db, auth, rest, realtime, storage, kong, api, caddy)" \
  "'docker compose config' von Hand prüfen — die Compose-Datei ist vermutlich beschädigt."

for i in $(seq 1 90); do
  gesund=0
  alle_da=1
  for dienst in "${DIENSTE[@]}"; do
    cid="$(docker compose ps -q "$dienst" 2>/dev/null || true)"
    if [ -z "$cid" ]; then
      alle_da=0
      continue
    fi
    laufstatus="$(docker inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || echo 'unknown')"
    [ "$laufstatus" = "running" ] || { alle_da=0; continue; }
    healthstatus="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}kein-healthcheck{{end}}' "$cid" 2>/dev/null || echo 'unknown')"
    if [ "$healthstatus" = "healthy" ] || [ "$healthstatus" = "kein-healthcheck" ]; then
      gesund=$((gesund + 1))
    fi
  done
  if [ "$alle_da" -eq 1 ] && [ "$gesund" -eq "$ERWARTETE_DIENSTE" ]; then
    ok "Alle ${ERWARTETE_DIENSTE} Container da und gesund"
    break
  fi
  if [ "$i" -eq 90 ]; then
    fail "Nicht alle Container wurden gesund" "${gesund}/${ERWARTETE_DIENSTE} gesund, vollständig da: ${alle_da}" "${ERWARTETE_DIENSTE} Container, alle 'running' + 'healthy'" \
      "'docker compose ps --all' und 'docker compose logs' auf dem Server prüfen — wir kommen nicht in die Box (K10)."
  fi
  sleep 2
done

# ── Schritt 14 — Schlüsselbeweis (O-60) ──────────────────────────────────────
log "[14/15] Abgeleiteten Schlüssel wirklich testen"
# --resolve: SITE_URL loest sich auf DIESEM Server selbst noch nirgends auf
# (der hosts-/DNS-Hinweis kommt erst im letzten Schritt) — ohne diesen Zwang
# scheitert der Test an einer Namensaufloesung, nicht am Schluessel, und
# fuehrt bei --neu in einen Datenverlust-Zirkel (O-65, Gegenlesen 11.09.2026).
# "localhost" waere FALSCH: Caddy matcht auf den Host-Namen (O-59).
RESOLVE_ARG="--resolve"
RESOLVE_VAL="${HOST_PART}:443:127.0.0.1"
ohne_key="$(curl -sk "$RESOLVE_ARG" "$RESOLVE_VAL" -o /dev/null -w '%{http_code}' "${SITE_URL}/rest/v1/" || echo 000)"
mit_key="$(curl -sk "$RESOLVE_ARG" "$RESOLVE_VAL" -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${ANON_KEY}" -H "apikey: ${ANON_KEY}" "${SITE_URL}/rest/v1/" || echo 000)"
# Verfälschter Schlüssel — NUR im Authorization-Header, apikey bleibt echt:
# Kongs key-auth prüft ausschliesslich den apikey-Header als Zeichenkette
# gegen sein eigenes kong.yml (aus demselben .env erzeugt) und würde einen
# ZUGLEICH verfälschten apikey schon selbst mit 401 abweisen — der Test
# bewiese dann nur "Kong vergleicht Zeichenketten", nicht "die Signatur wird
# geprüft". Nur mit echtem apikey + kaputter Signatur im Authorization-Header
# erreicht die Anfrage wirklich PostgREST, wo O-60s eigentliche Sorge liegt
# (3. Gegenlesen-Runde, 11.09.2026 — 2. Runde hatte beide Header verfälscht
# und damit am Kong-Layer gemessen, nicht am PostgREST-Layer).
mit_kaputtem_key="$(curl -sk "$RESOLVE_ARG" "$RESOLVE_VAL" -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${ANON_KEY}x" -H "apikey: ${ANON_KEY}" "${SITE_URL}/rest/v1/" || echo 000)"

if [ "$mit_key" != "200" ]; then
  fail "Abgeleiteter Schlüssel wird nicht akzeptiert" "HTTP ${mit_key} mit apikey" "HTTP 200" \
    "JWT_SECRET wurde nach der Ableitung verändert, oder Kong/PostgREST sind noch nicht bereit. 'bash install.sh --neu' erneut versuchen."
fi
if [ "$mit_kaputtem_key" = "200" ]; then
  fail "Test ist blind — ein verfälschter Schlüssel wurde ebenfalls angenommen" "HTTP 200 mit absichtlich falscher Signatur" "HTTP 401" \
    "Kong/PostgREST prüfen die Signatur nicht wie erwartet — onprem-Agenten konsultieren, BEVOR die Box in Betrieb geht."
fi
if [ "$ohne_key" != "401" ]; then
  warn "Ohne apikey kam HTTP ${ohne_key} statt 401 zurück — Kong prüfen, bevor die Box in Betrieb geht."
fi
ok "ANON_KEY akzeptiert (200), verfälschter Schlüssel abgelehnt, kein Schlüssel abgelehnt (${ohne_key})"

# SERVICE_ROLE_KEY separat pruefen — eine falsch abgeleitete Signatur waere
# sonst erst im Assistenten (Phase 2.2, service_role-Aufrufe) aufgefallen.
mit_service_key="$(curl -sk "$RESOLVE_ARG" "$RESOLVE_VAL" -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" -H "apikey: ${SERVICE_ROLE_KEY}" "${SITE_URL}/rest/v1/" || echo 000)"
if [ "$mit_service_key" != "200" ]; then
  fail "SERVICE_ROLE_KEY wird nicht akzeptiert" "HTTP ${mit_service_key}" "HTTP 200" \
    "Wie beim ANON_KEY — 'bash install.sh --neu' erneut versuchen."
fi
ok "SERVICE_ROLE_KEY akzeptiert (200)"

# ── Schritt 15 — Ausgabe ──────────────────────────────────────────────────────
# Die Route zu einer beliebigen oeffentlichen Adresse zeigt zuverlaessiger
# auf die echte Praxisnetz-Schnittstelle als "hostname -I" — letzteres kann
# auch eine interne Docker-Bridge-Adresse (typ. 172.17.0.1) an erster Stelle
# zurückgeben (O-59-Nachbarfund, Gegenlesen 11.09.2026). Trotzdem nur ein
# Hinweis, keine Wahrheit — immer gegen die tatsächliche Praxisnetz-IP prüfen.
LAN_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')"
[ -n "$LAN_IP" ] || LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

log "[15/15] Fertig"
log ""
log "  Box erreichbar unter:  ${SITE_URL}"
[ -n "$LAN_IP" ] && log "  Eine Server-Adresse:    ${LAN_IP} (PRÜFEN, ob das die echte Praxisnetz-IP ist, nicht z. B. eine Docker-interne)"
if [ "$CADDY_TLS_ARG_VALUE" = "internal" ]; then
  log "  Zertifikat der Box:     'docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt .'"
  log "                          — pro Praxisrechner einmalig als vertrauenswürdig importieren."
fi
log ""
reveal_once "  ════════════════════════════════════════════════════════════════"
reveal_once "  DATA_ENCRYPTION_KEY (wird NIE wieder angezeigt, NICHT in install.log):"
reveal_once ""
reveal_once "    ${DATA_ENCRYPTION_KEY}"
reveal_once ""
reveal_once "  In einen Tresor oder einen ZWEITEN Datenträger — NICHT in den Backup-"
reveal_once "  Ordner (O-61). Geht dieser Wert verloren, sind die verschlüsselten"
reveal_once "  Patientenfelder auch mit einem vollständigen Backup unlesbar."
reveal_once "  ════════════════════════════════════════════════════════════════"
reveal_once ""
reveal_once "  Einrichtungs-Jeton für den Assistenten (einmalig, NICHT in install.log):"
reveal_once ""
reveal_once "    ${SETUP_TOKEN}"
reveal_once ""
log "  Weiter im Browser:     ${SITE_URL}/login.html"
log ""
log "  Ablauf dieser Einrichtung: $LOG_FILE (ohne Geheimnisse)"
