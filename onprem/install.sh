#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — install.sh (Playbook Phase 2.1c)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 11.09.2026 · Design gesperrt in onprem/REGISTER.md §7G (Konsultation
#  mit dem onprem-Agenten, 16-Schritt-Tabelle, zwei Gegenlesen-Runden — O-63/
#  O-64/O-65) und §7H/O-66 (SMTP-Schritt — seit 02.10.2026 ersetzt, s. u.; damals: SMTP
#  wird HIER gefragt, nicht im Assistenten — GoTrue liest seine Umgebung nur
#  beim Start, ein Browser-Formular käme dort nie an). NICHT ohne erneute
#  Konsultation umbauen — jede Zeile hier hat einen Grund, der dort steht.
#  12.09.2026: Schritt 16 (§7J, O-45 b) richtet die nächtliche Selbst-
#  Aktualisierung ein — install.sh checkt weiterhin den onprem/-Baum aus
#  (§7J J10: NICHT aus dem Bundle, das ist eine offene, spätere Entscheidung).
#  13.09.2026: Schritt 12 (O-26) fragt das Yedekleme-Ziel ab und Schritt 16
#  richtet zusätzlich `praxura-backup.timer` ein (backup.sh, geteilte Routine
#  mit update.sh — onprem/REGISTER.md O-26).
#
#  02.10.2026 (KHS K2.1/K2.5): Schritt 11 fragt den Update-Kanal (beta/stable,
#  O-148) statt SMTP — seit O-142 (01.10.2026) entstehen Konten ohne Mail,
#  die Box braucht keinen Mailserver mehr (optional nur fuer Patientenmails,
#  von Hand in .env, siehe .env.template §4).
#
#  07.10.2026 (K2b.7a): Jeton gilt 14 Tage (SETUP_TOKEN_SEIT); --neuer-jeton gibt
#  einen neuen aus, solange die Einrichtung offen ist; wiederholter Lauf leert
#  den Jeton nach Abschluss (lib-setup-jeton.sh).
#
#  Was dieses Skript TUT: Hardware/Software prüfen, .env erzeugen, Geheimnisse
#  AUF DIESEM SERVER würfeln (G2 — keins davon kommt von uns oder geht an uns),
#  ANON_KEY/SERVICE_ROLE_KEY aus JWT_SECRET ableiten (O-60 — NICHT würfeln),
#  Update-Kanal abfragen (O-148), Yedekleme-Ziel abfragen (O-26), die Box
#  hochfahren, mit dem abgeleiteten Schlüssel wirklich testen, die nächtliche
#  Selbst-Aktualisierung UND die nächtliche Yedekleme einrichten.
#
#  Was dieses Skript NICHT TUT: kein Owner-Konto, kein Praxisname. Sobald im
#  Browser der erste Bildschirm des Assistenten (Phase 2.2) erscheint, ist die
#  Aufgabe dieses Skripts erledigt.
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

# Geteilte IP-Ermittlung mit ip-melden.sh (K2b.6, O-161 L3)
# shellcheck source=./lib-ip.sh
source "$SCRIPT_DIR/lib-ip.sh"

# Einrichtungs-Jeton und Hygiene (K2b.7a, O-161 K2b.7)
# shellcheck source=./lib-setup-jeton.sh
source "$SCRIPT_DIR/lib-setup-jeton.sh"

NEU=0
NEUER_JETON=0
for arg in "$@"; do
  [ "$arg" = "--neu" ] && NEU=1
  [ "$arg" = "--neuer-jeton" ] && NEUER_JETON=1
done

if [ "$NEU" -eq 1 ] && [ "$NEUER_JETON" -eq 1 ]; then
  fail "Konflikt bei Optionen" "--neu und --neuer-jeton gleichzeitig gesetzt" "genau einen Modus wählen" \
    "Nur einen Modus wählen: 'sudo bash install.sh --neu' (Neuinstallation) ODER 'sudo bash install.sh --neuer-jeton' (neuer Jeton)."
fi

if [ "$NEUER_JETON" -eq 1 ]; then
  printf '\n─── %s (--neuer-jeton) ───\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
  log "Praxura On-Premise — Neuer Einrichtungs-Jeton $(date '+%Y-%m-%d %H:%M:%S')"
  log ""
else
  : > "$LOG_FILE"
  log "Praxura On-Premise — Einrichtung $(date '+%Y-%m-%d %H:%M:%S')"
  log ""
fi

# Das Skript fragt mehrfach interaktiv (Adresse, TLS-Modus, Kanal, ggf. --neu-
# Bestätigung, ggf. Docker-Installation). Aus einer Pipe heraus gestartet
# (z. B. "curl … | sudo bash") liest `read` dann vom Installationsskript
# selbst statt von einer Person — das Fehlermodell (K10: klare Meldung statt
# stillem Abbruch) wäre komplett umgangen (Gegenlesen 11.09.2026, 3. Runde).
if [ "$NEUER_JETON" -ne 1 ] && [ ! -t 0 ]; then
  fail "Kein interaktives Terminal" "Eingabe kommt nicht von einer Tastatur (z. B. aus einer Pipe)" \
    "direkter Aufruf in einem Terminal" \
    "Repository klonen und 'sudo bash install.sh' direkt in einer SSH-Sitzung ausführen, nicht über eine Pipe."
fi

# ── Schritt 0 — Wurzel + Idempotenz ─────────────────────────────────────────
log "[0/17] Wurzel- und Wiederholungsprüfung"
if [ "$(id -u)" -ne 0 ]; then
  fail "Kein Root" "Benutzer $(id -un)" "root (Docker-Setup, Port 80/443, Dateirechte brauchen es)" \
    "Mit 'sudo bash install.sh' erneut starten."
fi

if [ "$NEUER_JETON" -eq 1 ]; then
  if [ ! -f "$ENV_FILE" ]; then
    fail "Box nie eingerichtet" "keine .env-Datei ($ENV_FILE)" "vorhandene .env-Datei" \
      "Die Box wurde noch nie eingerichtet. Normale Installation mit 'sudo bash install.sh' starten."
  fi

  STATUS_ABG="$(setup_abgeschlossen_lesen)"
  case "$STATUS_ABG" in
    ja)
      SITE_URL_JETON="$(env_get SITE_URL)"
      [ -n "$SITE_URL_JETON" ] || SITE_URL_JETON="https://<adresse>"
      fail "Einrichtung ist bereits abgeschlossen" "abgeschlossen in der Datenbank" "offene Einrichtung" \
        "Anmeldung unter ${SITE_URL_JETON}/login.html; Passwort vergessen: 'sudo bash reset-owner-passwort.sh'."
      ;;
    unbekannt)
      fail "Datenbank nicht lesbar" "Datenbank antwortet nicht oder praxura_setup fehlt" "lesbare Datenbank" \
        "'docker compose up -d' ausführen und nach 1 Minute erneut versuchen."
      ;;
    nein)
      : # Einrichtung ist offen — weiter
      ;;
  esac

  JETON="$(setup_jeton_neu)"
  if ! docker compose up -d --no-deps api >>"$LOG_FILE" 2>&1; then
    fail "api-Dienst konnte nicht neu gestartet werden" "'docker compose up -d --no-deps api' fehlgeschlagen" "laufender api-Dienst" \
      "Container-Protokolle prüfen: 'docker compose logs api'."
  fi
  ok "Neuer Einrichtungs-Jeton erzeugt und api neu gestartet"

  if [ "${PRAXURA_BROWSER_OEFFNEN:-}" = "1" ]; then
    log ""
    log "  Der Browser öffnet sich gleich."
    log ""
  else
    SITE_URL_JETON="$(env_get SITE_URL)"
    [ -n "$SITE_URL_JETON" ] || SITE_URL_JETON="https://<adresse>"
    reveal_once ""
    reveal_once "  Einrichtung im Browser öffnen (Link einmalig, NICHT in install.log):"
    reveal_once ""
    reveal_once "    ${SITE_URL_JETON}/setup.html#${JETON}"
    reveal_once ""
    reveal_once "  Der Link gilt 14 Tage."
    reveal_once ""
  fi
  exit 0
fi

if [ -f "$ENV_FILE" ] && [ "$NEU" -ne 1 ]; then
  AUFRAEUM_ERG="$(setup_jeton_aufraeumen)"
  case "$AUFRAEUM_ERG" in
    geleert)
      ok "Einrichtungs-Jeton aus .env entfernt (Einrichtung abgeschlossen)"
      docker compose up -d --no-deps api >>"$LOG_FILE" 2>&1 || warn "api-Dienst konnte nach Jeton-Bereinigung nicht neu gestartet werden"
      ;;
    unbekannt)
      warn "Einrichtungsstatus nicht lesbar — Jeton bleibt"
      ;;
  esac

  WAS_TUN="Box neu starten: 'docker compose up -d'."
  if [ "$AUFRAEUM_ERG" = "offen" ]; then
    WAS_TUN="$WAS_TUN Neuer Einrichtungslink: 'sudo bash install.sh --neuer-jeton'."
  fi
  WAS_TUN="$WAS_TUN Wirklich neu erzeugen (LÖSCHT DIE DATENBANK): 'bash install.sh --neu'."

  fail ".env existiert bereits" "$ENV_FILE" "kein .env, ODER --neu bewusst gesetzt" "$WAS_TUN"
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
log "[1/17] Hardware-Vorprüfung"
CPU_COUNT="$(nproc 2>/dev/null || echo 0)"
MEM_KB="$(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
MEM_GB=$(( MEM_KB / 1024 / 1024 ))
DISK_KB="$(df -Pk "$SCRIPT_DIR" 2>/dev/null | awk 'NR==2{print $4}' || echo 0)"
DISK_GB=$(( DISK_KB / 1024 / 1024 ))

# O-174 (K2b.18 b): unsere Images gibt es nur für amd64 — auf ARM (z. B. Hetzner
# CAX) bräche das erste "docker compose pull" mitten in der Einrichtung mit
# "no matching manifest" ab. Lieber hier, vor jeder Änderung, klar abbrechen.
ARCH="$(uname -m 2>/dev/null || echo unbekannt)"
[ "$ARCH" = "x86_64" ] || fail "Prozessor-Architektur wird nicht unterstützt" "$ARCH" "x86_64 (Intel/AMD)" \
  "Einen x86-Server verwenden (bei Hetzner z. B. CX33, nicht CAX/ARM) — siehe KURULUM.md Weg C."
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

# K2b.18 c (onprem O-161 K2b.7 (e), guvenlik S-50 Bed. 4): nur WARNEN, nicht
# ändern — die Box gehört der Praxis (K10), wir sagen es nur. Ohne sshd (z. B.
# Windows/WSL-Box) gibt es nichts zu prüfen.
if command -v sshd >/dev/null 2>&1; then
  if sshd -T 2>/dev/null | grep -qi '^passwordauthentication yes'; then
    warn "SSH erlaubt Anmeldung mit Passwort — für einen Server im Internet unsicher. Anleitung: KURULUM.md „Linux-Server absichern“."
  fi
fi

# ── Schritt 2 — Software ─────────────────────────────────────────────────────
log "[2/17] Software-Vorprüfung"
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
log "[3/17] Port-Vorprüfung (80, 443)"
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

# ── Schritt 4 — Einrichtungscode / Adresse (O-161, K2b.5b) ─────────────────────
log "[4/17] Einrichtungscode / Adresse der Box"

# Umgebung vor Vorlage: erlaubt den lokalen Test gegen merkez/test/dev-server.js (docker compose
# übernimmt ein exportiertes MERKEZ_URL per ${MERKEZ_URL:-} auch in den kayit-Dienst).
MERKEZ_URL_VORLAGE="${MERKEZ_URL:-}"
[ -n "$MERKEZ_URL_VORLAGE" ] || MERKEZ_URL_VORLAGE="$(awk -F= '$1=="MERKEZ_URL"{sub(/^[^=]*=/,""); print; f=1} END{if(!f) print ""}' "$ENV_TEMPLATE" 2>/dev/null || true)"
if [ -z "$MERKEZ_URL_VORLAGE" ] && [ -f "$ENV_FILE" ]; then
  MERKEZ_URL_VORLAGE="$(env_get MERKEZ_URL)"
fi

KAYIT_CODE=""
KAYIT_MODUS="adresse"
SITE_URL=""
HOST_PART=""
CADDY_TLS_MODUS_VALUE="klassisch"
CADDY_TLS_ARG_VALUE="internal"

# Wiederholungsprüfung: Vor dem Code-Dialog prüfen, ob die Box schon registriert ist (O-161)
# (Fehler wird toleriert, da das Image beim Erstlauf noch fehlen darf; --pull never: vor der
# Kanalwahl in Schritt 11 kein Image holen — Schritt 13 prüft nach dem Pull erneut)
durum_json_vorab="$(docker compose --profile kurulum run --rm --no-deps --pull never kayit --durum --json 2>/dev/null || true)"
if printf '%s' "$durum_json_vorab" | grep -qE '"registriert"[[:space:]]*:[[:space:]]*true'; then
  durum_fqdn="$(printf '%s' "$durum_json_vorab" | sed -n 's/.*"fqdn"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  durum_ad="$(printf '%s' "$durum_json_vorab" | sed -n 's/.*"ad"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  [ -n "$durum_fqdn" ] || fail "Box-Identität ohne Adresse" "registriert als ${durum_ad:-?}, aber ohne fqdn" "box.json mit fqdn" \
    "Support kontaktieren (Wiederverbindungs-Code) — die Box-Identität bitte NICHT löschen."
  SITE_URL="https://${durum_fqdn}"
  HOST_PART="${durum_fqdn}"
  KAYIT_MODUS="vorhanden"
  log "  Box bereits registriert als ${durum_ad:-$durum_fqdn} (${SITE_URL})"
  ok "Bereits registrierte Identität übernommen (KAYIT_MODUS=vorhanden)"
elif [ -z "$MERKEZ_URL_VORLAGE" ]; then
  log "  Keine MERKEZ_URL konfiguriert — Einrichtungscode nicht verfügbar."
  log "  Verwende manuelle Adresseingabe (Ausstiegsweg)."
else
  log "  Einrichtungscode (XXXX-XXXX-XXXX-XXXX) eingeben."
  log "  (Enter ohne Eingabe = eigene Adresse manuell konfigurieren)"
  read -r -s -p "  Einrichtungscode: " RAW_CODE
  echo ""
  CLEAN_CODE="$(printf '%s' "$RAW_CODE" | tr -d '[:space:]')"
  if [ -n "$CLEAN_CODE" ]; then
    # Alphabet: FORMAT_KUTU (0123456789ABCDEFGHJKMNPQRSTVWXYZ, inkl. I, L, O-Toleranz)
    if printf '%s' "$CLEAN_CODE" | grep -qE '^[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}$'; then
      KAYIT_CODE="$CLEAN_CODE"
    elif printf '%s' "$CLEAN_CODE" | grep -qE '^[0-9A-Za-z]{16}$'; then
      KAYIT_CODE="${CLEAN_CODE:0:4}-${CLEAN_CODE:4:4}-${CLEAN_CODE:8:4}-${CLEAN_CODE:12:4}"
    else
      fail "Ungültiges Code-Format" "Eingabe entspricht nicht dem Format XXXX-XXXX-XXXX-XXXX" \
        "XXXX-XXXX-XXXX-XXXX (16 Zeichen aus Ziffern/Buchstaben)" \
        "Den von Praxura erhaltenen Einrichtungscode im Format XXXX-XXXX-XXXX-XXXX eingeben."
    fi
    KAYIT_MODUS="code"
    unset RAW_CODE CLEAN_CODE
    ok "Einrichtungscode erfasst (wird nicht geloggt)"
  fi
fi

if [ "$KAYIT_MODUS" = "adresse" ]; then
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
fi

# ── Jetzt erst, nach allen Vorprüfungen: alte Datenbank löschen (falls --neu) ─
if [ "$NEU_BESTAETIGT" -eq 1 ]; then
  log "Vorprüfungen bestanden — lösche jetzt die vorhandene Datenbank (--neu)"
  # O-161 (K3, K2b.5): `docker compose down -v` würde auch `kimlik` und `acmedns`
  # vernichten. Der Einrichtungscode ist einmalig und Merkez kennt den alten Schlüssel;
  # ein gelöschtes kimlik-Volume erzeugt jedes Mal einen Support-Fall (kod-rebind).
  # Daher nur Container stoppen (--remove-orphans) und gezielt NUR db-config,
  # caddy_data und caddy_config löschen. kimlik und acmedns bleiben für Wiederverbindung.
  docker compose down --remove-orphans >/dev/null 2>&1 || true
  # Projektname = oberste `name:`-Zeile der Compose-Datei (nur Spalte 0 — das
  # eingerückte `name:` unter networks ist der Netzname, nicht das Projekt).
  PROJEKT_NAME="${COMPOSE_PROJECT_NAME:-}"
  if [ -z "$PROJEKT_NAME" ] && [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    PROJEKT_NAME="$(awk '/^name:[[:space:]]*/{sub(/\r$/, "", $2); print $2; exit}' "$SCRIPT_DIR/docker-compose.yml" 2>/dev/null || true)"
  fi
  [ -n "$PROJEKT_NAME" ] || PROJEKT_NAME="$(basename "$SCRIPT_DIR")"
  for vol in db-config caddy_data caddy_config; do
    v_ids="$(docker volume ls -q --filter "label=com.docker.compose.project=${PROJEKT_NAME}" --filter "label=com.docker.compose.volume=${vol}" 2>/dev/null || true)"
    if [ -n "$v_ids" ]; then
      # shellcheck disable=SC2086  # mehrere IDs möglich
      docker volume rm $v_ids >/dev/null 2>&1 || warn "Volume ${vol} konnte nicht entfernt werden (läuft noch ein Container?) — 'docker volume ls' prüfen"
    fi
  done
  rm -rf "$SCRIPT_DIR/volumes/db/data" "$SCRIPT_DIR/volumes/storage"
  ok "Alte Datenbank entfernt"
fi

# ── Schritt 5 — .env aus Vorlage ─────────────────────────────────────────────
log "[5/17] .env aus Vorlage erzeugen"
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

if [ "$KAYIT_MODUS" != "code" ]; then
  set_env SITE_URL "$SITE_URL"
  set_env API_EXTERNAL_URL "$SITE_URL"
  set_env SUPABASE_PUBLIC_URL "$SITE_URL"
fi

# ── Schritt 6 — Geheimnisse würfeln (G2, ausschliesslich auf diesem Server) ──
log "[6/17] Geheimnisse erzeugen (auf diesem Server, G2)"
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
# S-21 (KHS K2.6): eine Rolle je Dienst, ein Passwort je Rolle — wer den
# rest/auth/storage-Container uebernimmt, kennt damit NICHT das Superuser-
# Passwort (volumes/db/praxura-rollen.sql, laeuft nach 99-roles.sql).
PG_AUTHENTICATOR_PASSWORD="$(openssl rand -hex 24)"
PG_AUTH_ADMIN_PASSWORD="$(openssl rand -hex 24)"
PG_STORAGE_ADMIN_PASSWORD="$(openssl rand -hex 24)"

set_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
set_env JWT_SECRET "$JWT_SECRET"
set_env SECRET_KEY_BASE "$SECRET_KEY_BASE"
set_env REALTIME_DB_ENC_KEY "$REALTIME_DB_ENC_KEY"
set_env S3_PROTOCOL_ACCESS_KEY_ID "$S3_KEY_ID"
set_env S3_PROTOCOL_ACCESS_KEY_SECRET "$S3_KEY_SECRET"
set_env DATA_ENCRYPTION_KEY "$DATA_ENCRYPTION_KEY"
set_env SETUP_TOKEN "$SETUP_TOKEN"
set_env SETUP_TOKEN_SEIT "$(date +%s)"
set_env PG_AUTHENTICATOR_PASSWORD "$PG_AUTHENTICATOR_PASSWORD"
set_env PG_AUTH_ADMIN_PASSWORD "$PG_AUTH_ADMIN_PASSWORD"
set_env PG_STORAGE_ADMIN_PASSWORD "$PG_STORAGE_ADMIN_PASSWORD"
ok "elf Geheimnisse erzeugt (Werte NICHT geloggt)"

# ── Schritt 7 — ANON_KEY / SERVICE_ROLE_KEY aus JWT_SECRET ableiten (O-60) ───
log "[7/17] ANON_KEY / SERVICE_ROLE_KEY aus JWT_SECRET ableiten"
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
log "[8/17] SUPABASE_PUBLIC_WSS"
# Ein Origin (Normalfall, siehe .env.template §3): 'self' im CSP deckt das
# eigene wss:// schon ab — Feld bleibt leer, kein Rätselraten nötig.
set_env SUPABASE_PUBLIC_WSS ""
ok "leer gelassen (SUPABASE_PUBLIC_URL = SITE_URL, ein Origin)"

# ── Schritt 9 — Pflichtfeld-Tor (O-53) ───────────────────────────────────────
log "[9/17] Pflichtfelder prüfen, bevor irgendetwas startet"
PFLICHTFELDER="ANON_KEY SERVICE_ROLE_KEY JWT_SECRET POSTGRES_PASSWORD DATA_ENCRYPTION_KEY SETUP_TOKEN PG_AUTHENTICATOR_PASSWORD PG_AUTH_ADMIN_PASSWORD PG_STORAGE_ADMIN_PASSWORD"
if [ "$KAYIT_MODUS" != "code" ]; then
  PFLICHTFELDER="SITE_URL SUPABASE_PUBLIC_URL $PFLICHTFELDER"
fi
for key in $PFLICHTFELDER; do
  wert="$(env_get "$key")"
  [ -n "$wert" ] || fail "Pflichtfeld leer: ${key}" "leer" "erzeugter Wert" "Skript erneut mit --neu starten — dies deutet auf einen Fehler in Schritt 6/7 hin."
  if [ "$key" = "SITE_URL" ] || [ "$key" = "SUPABASE_PUBLIC_URL" ]; then
    [ "$wert" != "https://praxis.local" ] || fail "Platzhalter nicht ersetzt: ${key}" "$wert" "echte Adresse" "Gültige SITE_URL angeben."
  fi
done
ok "alle Pflichtfelder gefüllt"

# ── Schritt 10 — TLS-Modus ───────────────────────────────────────────────────
log "[10/17] TLS-Modus"
if [ "$KAYIT_MODUS" = "code" ] || [ "$KAYIT_MODUS" = "vorhanden" ]; then
  if [ "$KAYIT_MODUS" = "code" ]; then
    log "  TLS: Let's Encrypt über den Praxura-Namensdienst (DNS-01) — wird nach der Registrierung festgelegt."
  else
    log "  TLS: Let's Encrypt über den Praxura-Namensdienst (DNS-01) — wird vor dem Start geprüft."
  fi
else
  set_env CADDY_TLS_MODUS "klassisch"
  CADDY_TLS_MODUS_VALUE="klassisch"
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
fi

# ── Schritt 11 — Update-Kanal (KHS K2.1, onprem O-148) ───────────────────────
# Ersetzt den früheren SMTP-Schritt (O-66) — seit O-142 (01.10.2026) braucht
# die Box keinen Mailserver mehr, Konten entstehen ohne Mail.
#
# ⚠️ Die Vorlage (.env.template) behält ':stable' als Wert — der Kanal wird
# NUR hier in die .env geschrieben. Stünde ':beta' in der Vorlage, würde
# update.sh's .env-Zusammenführung (J4) jede ':stable'-Box beim nächsten
# Update still auf beta umstellen (onprem-Vorprüfung 02.10.2026).
# Kanalwechsel später = nur VORWÄRTS sinnvoll: beta→stable, solange stable
# älter ist, hält der Migrations-Runner mit 'downgrade' an (migrate.js).
log "[11/17] Update-Kanal"
log "  beta   = jede veröffentlichte Version (Test-/Pilotbox, Entscheidung K-1)"
log "  stable = nur Versionen, die vorher 72 Stunden auf einer Testbox liefen"
read -r -p "  Kanal [beta/stable] (Enter = beta): " kanal
kanal="${kanal:-beta}"
case "$kanal" in
  beta|stable) : ;;
  *) fail "Unbekannter Kanal" "'$kanal'" "beta oder stable" "Erneut ausführen und 'beta' oder 'stable' eintippen." ;;
esac
api_img="$(env_get PRAXURA_API_IMAGE)"
fe_img="$(env_get PRAXURA_FRONTEND_IMAGE)"
api_img="${api_img%:*}:${kanal}"
fe_img="${fe_img%:*}:${kanal}"
# Vorab prüfen, ob es den Kanal in der Registry überhaupt gibt — sonst
# scheiterte das erst in Schritt 13, nach allen Fragen (Y2: ':stable' wurde
# bis 0.2.0 nie veröffentlicht). Ohne Netz kein Abbruch, nur eine Warnung.
if ! docker manifest inspect "$api_img" >/dev/null 2>&1; then
  if [ "$kanal" = "stable" ]; then
    warn "Kanal 'stable' ist (noch) nicht veröffentlicht: $api_img"
    read -r -p "  Stattdessen 'beta' verwenden? [J/n] " auf_beta
    if [ "$auf_beta" = "n" ] || [ "$auf_beta" = "N" ]; then
      fail "Kanal 'stable' nicht verfügbar" "$api_img nicht in der Registry" "ein veröffentlichter Kanal"         "Mit Kanal 'beta' installieren — ':stable' entsteht erst nach 72 h Testbetrieb (RELEASE-STANDARD.md §6.3)."
    fi
    kanal="beta"
    api_img="${api_img%:*}:beta"
    fe_img="${fe_img%:*}:beta"
  else
    warn "Registry nicht erreichbar oder Image fehlt ($api_img) — Schritt 13 versucht es trotzdem."
  fi
fi
set_env PRAXURA_API_IMAGE "$api_img"
set_env PRAXURA_FRONTEND_IMAGE "$fe_img"
ok "Kanal: ${kanal} ($api_img)"

# ── Schritt 12 — Yedekleme hedefi (O-26) ─────────────────────────────────────
# ⚠️ Bilinçli olarak burada soruluyor, ertelenmiyor (onprem, O-26 tasarım
# turu): sorulmazsa her kutu veritabanıyla AYNI diskte yedekle teslim edilir
# — RELEASE-STANDARD.md §4.3'ün "varsayılan kutu dışı" gereği kâğıtta kalır.
# Panel henüz yok (Faz 2.4), bu yüzden uyarı burada ve install.log'da kalıcı.
log "[12/17] Yedekleme hedefi (gecelik + migration-öncesi otomatik yedekler)"
log "  Yedekler varsayılan olarak KUTUNUN KENDİ DİSKİNDE tutulur — disk arızasında"
log "  veritabanıyla BİRLİKTE kaybolurlar. Önerilen: önceden bağladığınız (mount"
log "  ettiğiniz) bir NAS/SMB/NFS dizini."
read -r -p "  Yedek hedefi (boş = kutu içi, aksi hâlde mount edilmiş bir dizin yolu, ör. /mnt/yedek): " backup_ziel
if [ -n "$backup_ziel" ]; then
  if [ ! -d "$backup_ziel" ]; then
    warn "Girilen yol bir dizin olarak bulunamadı: $backup_ziel — yine de kaydediliyor, ama 'bash backup.sh --sebep manuel' ilk yedekte hata verecektir. Mount'un kalıcı olduğundan (fstab/otomatik bağlama) emin ol. Bağladıktan sonra bir kez: sudo touch '$backup_ziel/.praxura-backup-ziel'"
  else
    # O-154: Markierung "dieses Ziel ist eingebunden" — backup.sh schreibt nur
    # dorthin, wo sie liegt. Ist die Platte spaeter nicht eingesteckt, fehlt
    # sie (leerer Einhaengepunkt) und die Sicherung bricht laut ab, statt
    # still auf die Box-Platte zu schreiben.
    touch "$backup_ziel/.praxura-backup-ziel" 2>/dev/null \
      || warn "Markierungsdatei konnte nicht geschrieben werden ($backup_ziel) — ist das Ziel beschreibbar?"
  fi
  set_env BACKUP_ZIEL "$backup_ziel"
  ok "Yedek hedefi: $backup_ziel (kutu dışı)"
else
  set_env BACKUP_ZIEL ""
  warn "Yedek hedefi boş bırakıldı — yedekler kutu içinde kalacak (backups/). Sonradan .env'de BACKUP_ZIEL ile değiştirilebilir."
fi

# ── Schritt 13 — pull, Volumes, Registrierung + up ───────────────────────────
log "[13/17] Container-Images holen, Identität registrieren und starten"
if ! docker compose pull 2>&1 | tee -a "$LOG_FILE"; then
  fail "Images konnten nicht geholt werden" "docker compose pull ist fehlgeschlagen" \
    "${api_img} und ${fe_img} erreichbar (ghcr.io, ohne Anmeldung)" \
    "Internetverbindung des Servers prüfen ('curl -I https://ghcr.io'). Ist der Kanal 'stable' noch nie veröffentlicht worden: 'bash install.sh --neu' und Kanal 'beta' wählen."
fi

# Volumes vorbereiten (K13) — in JEDEM Weg (code/adresse/vorhanden)
log "  Bereite Volumes für Identität und DNS vor (K13)..."
if ! docker compose --profile kurulum run --rm --no-deps --entrypoint true kayit 2>&1 | tee -a "$LOG_FILE"; then
  fail "Volumes konnten nicht vorbereitet werden" "kayit entrypoint true fehlgeschlagen" \
    "Erfolgreiche Volume-Initialisierung (kimlik/acmedns)" \
    "Docker-Berechtigungen und Volume-Speicherplatz prüfen."
fi
ok "Volumes für Box-Identität und DNS vorbereitet (K13)"

# Registrierung im Code-Weg
if [ "$KAYIT_MODUS" = "code" ]; then
  # Nochmals --durum prüfen: falls schon registriert → überspringen
  durum_json_nochmals="$(docker compose --profile kurulum run --rm --no-deps kayit --durum --json 2>/dev/null || true)"
  if printf '%s' "$durum_json_nochmals" | grep -qE '"registriert"[[:space:]]*:[[:space:]]*true'; then
    durum_fqdn="$(printf '%s' "$durum_json_nochmals" | sed -n 's/.*"fqdn"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    durum_ad="$(printf '%s' "$durum_json_nochmals" | sed -n 's/.*"ad"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    [ -n "$durum_fqdn" ] || fail "Box-Identität ohne Adresse" "registriert als ${durum_ad:-?}, aber ohne fqdn" "box.json mit fqdn" \
      "Support kontaktieren (Wiederverbindungs-Code) — die Box-Identität bitte NICHT löschen."
    SITE_URL="https://${durum_fqdn}"
    HOST_PART="${durum_fqdn}"
    set_env SITE_URL "$SITE_URL"
    set_env API_EXTERNAL_URL "$SITE_URL"
    set_env SUPABASE_PUBLIC_URL "$SITE_URL"
    KAYIT_MODUS="vorhanden"
    log "  Box bereits registriert als ${durum_ad:-$durum_fqdn} (${SITE_URL})"
    ok "Registrierung übersprungen (bereits vorhanden)"
    unset KAYIT_CODE
  else
    log "  Fordere Namensvorschlag von Merkez an..."
    gewaehlter_name=""
    while true; do
      vorschlag_json="$(KAYIT_CODE="$KAYIT_CODE" docker compose --profile kurulum run --rm --no-deps -e KAYIT_CODE kayit --nur-vorschlag --json 2>>"$LOG_FILE" || true)"
      fehler_msg="$(printf '%s' "$vorschlag_json" | sed -n 's/.*"fehler"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
      if [ -n "$fehler_msg" ]; then
        fail "Namensvorschlag fehlgeschlagen" "$fehler_msg" "Gültiger Namensvorschlag von Merkez" \
          "Einrichtungscode und Erreichbarkeit von MERKEZ_URL prüfen."
      fi
      v_name="$(printf '%s' "$vorschlag_json" | sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
      v_fqdn="$(printf '%s' "$vorschlag_json" | sed -n 's/.*"fqdn"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
      if [ -z "$v_fqdn" ]; then
        fail "Ungültige Antwort von Merkez" "$vorschlag_json" "JSON mit fqdn und name" \
          "Erreichbarkeit von MERKEZ_URL prüfen."
      fi
      log "  Vorgeschlagene Adresse: https://${v_fqdn}"
      if printf '%s' "$vorschlag_json" | grep -qE '"rebind"[[:space:]]*:[[:space:]]*true'; then
        gewaehlter_name="$v_name"
        log "  Wiederverbindungs-Code: bisherige Adresse wird übernommen"
        break
      fi
      read -r -p "  Diesen Namen übernehmen? [J]a / [N]euen Namen vorschlagen: " name_antwort
      case "$name_antwort" in
        j|J|ja|Ja|JA|"")
          gewaehlter_name="$v_name"
          break
          ;;
        *)
          log "  Fordere neuen Namensvorschlag an..."
          ;;
      esac
    done

    log "  Registriere Box mit Namen '${gewaehlter_name}' bei Merkez..."
    LAN_IP="$(lan_ip_ermitteln)"
    # Leere IP = Netz noch nicht bereit (DHCP). NICHT still auf 'internet' fallen —
    # der Modus wird hier einmalig festgelegt (O-161 L1) und bliebe dauerhaft falsch.
    [ -n "$LAN_IP" ] || fail "Keine Netzwerkadresse gefunden" "keine Default-Route" "verbundenes Netzwerk" \
      "Netzwerkkabel/WLAN prüfen, ein paar Sekunden warten und install.sh erneut starten (der Code ist noch nicht verbraucht)."
    ip_modus="internet"
    ip_param="--internet"
    if ist_rfc1918 "$LAN_IP"; then
      ip_modus="lan"
      ip_param="--lan-ip $LAN_IP"
    fi

    # shellcheck disable=SC2086
    reg_json="$(KAYIT_CODE="$KAYIT_CODE" docker compose --profile kurulum run --rm --no-deps -e KAYIT_CODE kayit --name "$gewaehlter_name" $ip_param --json 2>>"$LOG_FILE" || true)"
    unset KAYIT_CODE

    fehler_msg="$(printf '%s' "$reg_json" | sed -n 's/.*"fehler"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    if [ -n "$fehler_msg" ]; then
      fail "Registrierung bei Merkez fehlgeschlagen" "$fehler_msg" "Erfolgreiche Registrierung" \
        "Meldung prüfen (Internet, Einrichtungscode). Einzelheiten in $LOG_FILE. Bei verbrauchtem Code: Support kontaktieren."
    fi

    reg_fqdn="$(printf '%s' "$reg_json" | sed -n 's/.*"fqdn"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    if [ -z "$reg_fqdn" ]; then
      fail "Keine FQDN in Registrierungsantwort" "$reg_json" "JSON mit fqdn" \
        "Support kontaktieren."
    fi

    if printf '%s' "$reg_json" | grep -qE '"ip"[[:space:]]*:[[:space:]]*\{[^{}]*"ok"[[:space:]]*:[[:space:]]*false'; then
      warn "Adresse registriert, aber IP noch nicht eingetragen — wird beim nächsten IP-Abgleich nachgeholt"
    fi

    SITE_URL="https://${reg_fqdn}"
    HOST_PART="${reg_fqdn}"
    set_env SITE_URL "$SITE_URL"
    set_env API_EXTERNAL_URL "$SITE_URL"
    set_env SUPABASE_PUBLIC_URL "$SITE_URL"
    ok "Box erfolgreich registriert: ${SITE_URL}"

    # Modus einmalig bei der Einrichtung festlegen (K2b.6 / L1, L5, L10)
    ip_modus_yaz "$SCRIPT_DIR/volumes/ip" "$LAN_IP" >/dev/null || fail "IP-Modus konnte nicht geschrieben werden" \
      "Schreibfehler in $SCRIPT_DIR/volumes/ip" "volumes/ip beschreibbar" \
      "Schreibrechte auf volumes/ip prüfen."
  fi
fi

# Verzeichnis für IP-Mount vor erstem Start immer anlegen (L5, Adress-Weg ohne Dateien)
mkdir -p "$SCRIPT_DIR/volumes/ip"
chmod 0755 "$SCRIPT_DIR/volumes/ip"

# Im Weg 'vorhanden' (falls Datei fehlt): Modus ebenfalls festlegen (L1, L10)
if [ "$KAYIT_MODUS" = "vorhanden" ] && [ ! -f "$SCRIPT_DIR/volumes/ip/modus" ]; then
  v_rc=0
  v_modus="$(ip_modus_yaz "$SCRIPT_DIR/volumes/ip" "$(lan_ip_ermitteln)")" || v_rc=$?
  if [ "$v_rc" -eq 1 ]; then
    warn "Keine Netzwerkadresse — IP-Modus wird beim nächsten Update festgelegt"
  elif [ "$v_rc" -ne 0 ]; then
    warn "IP-Modus konnte nicht festgelegt werden (Fehlercode $v_rc) — Schreibrechte auf volumes/ip prüfen"
  fi
fi

# TLS-Modus für Code-/Vorhanden-Weg festlegen (K2b.4, O-161 / O-171):
# Liegt NACH der Registrierung und textlich VOR dem ersten 'docker compose up -d',
# das caddy startet (onprem-tls-modus).
if [ "$KAYIT_MODUS" = "code" ] || [ "$KAYIT_MODUS" = "vorhanden" ]; then
  durum_tls_json="$(docker compose --profile kurulum run --rm --no-deps --pull never kayit --durum --json 2>/dev/null || true)"
  if printf '%s' "$durum_tls_json" | grep -qE '"acmedns"[[:space:]]*:[[:space:]]*true'; then
    set_env CADDY_TLS_MODUS "acmedns"
    set_env HSTS_MAX_AGE "86400"
    CADDY_TLS_MODUS_VALUE="acmedns"
    ok "TLS: Let's Encrypt über den Praxura-Namensdienst (DNS-01)"
  else
    set_env CADDY_TLS_MODUS "klassisch"
    set_env CADDY_TLS_ARG "internal"
    set_env HSTS_MAX_AGE "0"
    CADDY_TLS_MODUS_VALUE="klassisch"
    CADDY_TLS_ARG_VALUE="internal"
    warn "Zertifikatszugang der Box fehlt — Rückfall auf internes Zertifikat"
    log "      Was tun: install.sh erneut ausführen; hilft das nicht: Support (siehe KURULUM.md §10)"
  fi
fi

# Pflichtfeld-Tor direkt vor dem Start: SITE_URL darf nicht leer und kein Platzhalter sein
site_tor="$(env_get SITE_URL)"
[ -n "$site_tor" ] || fail "Pflichtfeld vor Start leer: SITE_URL" "leer" "gesetzte Adresse" "Registrierung oder Adresseingabe wiederholen."
[ "$site_tor" != "https://praxis.local" ] || fail "Platzhalter in SITE_URL nicht ersetzt" "$site_tor" "echte Adresse" "Registrierung bei Merkez oder Adresseingabe wiederholen."
for k in API_EXTERNAL_URL SUPABASE_PUBLIC_URL; do
  v="$(env_get "$k")"
  [ -n "$v" ] && [ "$v" != "https://praxis.local" ] || fail "Pflichtfeld $k vor Start ungültig" "${v:-leer}" "echte Adresse" "Registrierung oder Adresseingabe wiederholen."
done

if ! docker compose up -d 2>&1 | tee -a "$LOG_FILE"; then
  log "  Letzte Zeilen von 'api' (haeufigste Ursache — Migrationskette):"
  docker compose logs --tail=40 api 2>&1 | tee -a "$LOG_FILE" || true
  fail "Container konnten nicht gestartet werden" "docker compose up -d ist fehlgeschlagen" "alle Container gestartet" \
    "Obige 'api'-Logzeilen (auch in $LOG_FILE) an den Support geben — wir kommen nicht in die Box (K10)."
fi
ok "Container gestartet"

# ── Schritt 14 — Gesundheitsprüfung ──────────────────────────────────────────
log "[14/17] Warten, bis alle Dienste gesund sind (bis zu 3 Minuten)"
# Geteilte Prüfung mit update.sh (O-45 (b), §7J J5 Schritt 9) — EIN Ort,
# damit die beiden nie auseinanderdriften (O-63 ist genau das einmal passiert).
# shellcheck source=./lib-health.sh
source "$SCRIPT_DIR/lib-health.sh"
warte_auf_gesundheit 180 || fail "Nicht alle Container wurden gesund" "nicht alle Container 'running'+'healthy' nach 3 Minuten" "8 Container, alle 'running' + 'healthy'" \
  "'docker compose ps --all' und 'docker compose logs' auf dem Server prüfen — wir kommen nicht in die Box (K10)."

# ── Schritt 15 — Schlüsselbeweis (O-60) ──────────────────────────────────────
log "[15/17] Abgeleiteten Schlüssel wirklich testen"
# --resolve: SITE_URL loest sich auf DIESEM Server selbst noch nirgends auf
# (der hosts-/DNS-Hinweis kommt erst im letzten Schritt) — ohne diesen Zwang
# scheitert der Test an einer Namensaufloesung, nicht am Schluessel, und
# fuehrt bei --neu in einen Datenverlust-Zirkel (O-65, Gegenlesen 11.09.2026).
# "localhost" waere FALSCH: Caddy matcht auf den Host-Namen (O-59).
RESOLVE_ARG="--resolve"
RESOLVE_VAL="${HOST_PART}:443:127.0.0.1"
# ⚠️ O-76 (12.09.2026, erster echter End-zu-Ende-Lauf, Ubuntu 24.04 + echtes
# systemd + echtes GHCR-Image): DIESER Test lief zuvor gegen den nackten
# Wurzelpfad "/rest/v1/" — PostgREST baut dafuer sein volles OpenAPI-Dokument
# ueber JEDE Relation/RPC (bei unserer Groesse: 92 Relationen, 108 Beziehungen,
# 292 RPCs). Das ist KEIN Cache-Problem (Schema-Cache laedt in <1ms) sondern
# eine echte, jedes Mal >3s dauernde Katalog-Abfrage — und kollidiert
# deterministisch mit Supabase's eigenem, fest einprogrammiertem
# "statement_timeout=3s" fuer die Rolle `anon` (gemessen: 5/5 Versuche exakt
# ~3.0s, HTTP 500 "canceling statement due to statement timeout"; derselbe
# Server antwortete auf "/rest/v1/profiles?limit=1" in ~15ms mit HTTP 200).
# Ergebnis: Schritt 14 schlug auf JEDER echten Installation IMMER fehl —
# nicht testumgebungsspezifisch, sondern eine echte, schemagroessenbedingte
# Blockade. Ziel ist jetzt eine gezielte, immer vorhandene Tabelle statt des
# vollen Wurzelpfads — `profiles` ist Teil von 0000_baseline.sql und existiert
# auf jeder Installation, RLS filtert für `anon` auf eine leere Liste ([]),
# aber der HTTP-Status beweist weiterhin exakt das, was O-60 wissen will.
TESTPFAD="${SITE_URL}/rest/v1/profiles?limit=1"
ohne_key="$(curl -sk "$RESOLVE_ARG" "$RESOLVE_VAL" -o /dev/null -w '%{http_code}' "$TESTPFAD" || echo 000)"
mit_key="$(curl -sk "$RESOLVE_ARG" "$RESOLVE_VAL" -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${ANON_KEY}" -H "apikey: ${ANON_KEY}" "$TESTPFAD" || echo 000)"
# Verfälschter Schlüssel — NUR im Authorization-Header, apikey bleibt echt:
# Kongs key-auth prüft ausschliesslich den apikey-Header als Zeichenkette
# gegen sein eigenes kong.yml (aus demselben .env erzeugt) und würde einen
# ZUGLEICH verfälschten apikey schon selbst mit 401 abweisen — der Test
# bewiese dann nur "Kong vergleicht Zeichenketten", nicht "die Signatur wird
# geprüft". Nur mit echtem apikey + kaputter Signatur im Authorization-Header
# erreicht die Anfrage wirklich PostgREST, wo O-60s eigentliche Sorge liegt
# (3. Gegenlesen-Runde, 11.09.2026 — 2. Runde hatte beide Header verfälscht
# und damit am Kong-Layer gemessen, nicht am PostgREST-Layer).
mit_kaputtem_key="$(curl -sk "$RESOLVE_ARG" "$RESOLVE_VAL" -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${ANON_KEY}x" -H "apikey: ${ANON_KEY}" "$TESTPFAD" || echo 000)"

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
mit_service_key="$(curl -sk "$RESOLVE_ARG" "$RESOLVE_VAL" -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" -H "apikey: ${SERVICE_ROLE_KEY}" "$TESTPFAD" || echo 000)"
if [ "$mit_service_key" != "200" ]; then
  fail "SERVICE_ROLE_KEY wird nicht akzeptiert" "HTTP ${mit_service_key}" "HTTP 200" \
    "Wie beim ANON_KEY — 'bash install.sh --neu' erneut versuchen."
fi
ok "SERVICE_ROLE_KEY akzeptiert (200)"

# ── Schritt 16 — Selbst-Update einrichten (O-45 (b), §7J) ───────────────────
# update.sh + lib-health.sh liegen bereits in diesem Verzeichnis (Teil des
# ausgecheckten onprem/-Baums, wie install.sh selbst — J10 in §7J: das Bundle
# ersetzt diesen Weg NICHT, das ist eine offene, spätere Entscheidung).
log "[16/17] Automatische Aktualisierung + Yedekleme einrichten (nächtlich)"
chmod +x "$SCRIPT_DIR/update.sh" "$SCRIPT_DIR/lib-health.sh" "$SCRIPT_DIR/lib-ip.sh" "$SCRIPT_DIR/ip-melden.sh"

# Taban für update.sh's erste .env-Zusammenführung (§7J J4): ohne diese Kopie
# hätte der allererste Lauf nichts, wogegen er "was haben WIR geändert"
# vergleichen könnte.
mkdir -p "$SCRIPT_DIR/.praxura-stand"
# O-100 (guvenlik-Review, 13.09.2026): update.sh legt hier später echte
# .env-Schnappschüsse ab (Secrets im Klartext) — das Verzeichnis bekommt von
# Anfang an dieselbe 0700-Sperre wie backup.sh's Zielverzeichnisse, nicht erst
# beim ersten update.sh-Lauf.
chmod 700 "$SCRIPT_DIR/.praxura-stand"
cp "$ENV_TEMPLATE" "$SCRIPT_DIR/.praxura-stand/env.taban.template"

# Sapma-Tabanı (§7J J3) SOFORT aus dem committeten manifest.json säen — sonst
# hätte der erste update.sh-Lauf gar keine Basis ("ilk_kosu") und würde eine
# Kundenänderung, die zwischen Installation und erstem Update passiert, beim
# ersten Update stillschweigend überschreiben (onprem-Gegenlesen 12.09.2026).
# manifest.json liegt bereits fertig neben install.sh (derselbe onprem/-Baum,
# keine Bundle-Extraktion nötig — J10).
if [ -f "$SCRIPT_DIR/manifest.json" ]; then
  {
    printf '{'
    ilk=1
    while IFS=$'\t' read -r yol sha; do
      [ -z "$yol" ] && continue
      [ "$yol" = ".env.template" ] && continue
      [ "$ilk" -eq 1 ] || printf ','
      ilk=0
      printf '\n  "%s": "%s"' "$yol" "$sha"
    done < <(grep -oE '"yol"[[:space:]]*:[[:space:]]*"[^"]+"[[:space:]]*,[[:space:]]*"sha256"[[:space:]]*:[[:space:]]*"[0-9a-f]{64}"' "$SCRIPT_DIR/manifest.json" \
      | sed -E 's/"yol"[[:space:]]*:[[:space:]]*"([^"]+)".*"sha256"[[:space:]]*:[[:space:]]*"([0-9a-f]{64})"/\1\t\2/')
    printf '\n}\n'
  } > "$SCRIPT_DIR/.praxura-stand/dateien-sha.json"
fi

if command -v systemctl >/dev/null 2>&1; then
  cat > /etc/systemd/system/praxura-update.service <<EOF
[Unit]
Description=Praxura On-Premise — Compose/.env/Image aktualisieren (O-45 b)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/env bash ${SCRIPT_DIR}/update.sh
EOF

  cat > /etc/systemd/system/praxura-update.timer <<EOF
[Unit]
Description=Praxura On-Premise — nächtliches Update (Timer)

[Timer]
# Nachtfenster bewusst: ein schlechtes Release soll nicht während der
# Praxis-Öffnungszeiten landen. Der eigentliche Schutz gegen schlechte
# Releases ist das 72h-Soak vor :stable (RELEASE-STANDARD.md §6.3), nicht
# dieser Zeitpunkt.
OnCalendar=*-*-* 02:00:00
RandomizedDelaySec=7200
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now praxura-update.timer >/dev/null 2>&1
  ok "praxura-update.timer aktiv (nächtlich 02:00 + bis zu 2h Zufallsverzögerung)"

  # ── Yedekleme zamanlayıcısı (O-26) — praxura-update.timer'DAN ÖNCE ─────────
  # onprem'in O-26 tasarım notu: nightly yedek migration-timer'dan (02:00 +
  # 2 saate kadar) ÖNCE ve DAR bir jitter'la koşmalı, ikisi de AYNI
  # .praxura-update.lock dosyasını paylaşır (backup.sh kendi kilidini
  # PRAXURA_LOCK_HELD boşsa alır) — hangisi önce başlarsa diğeri o gece
  # atlanır, ikisi aynı anda pg_dump/`up -d` yapıp yarım bir yedek üretmesin.
  chmod +x "$SCRIPT_DIR/backup.sh"
  # restore.sh (O-26 kapanışı, 12.09.2026): zamanlanmış bir iş DEĞİL — yalnız
  # elle çağrılan bir felaket kurtarma aracı, systemd birimi yok. Yalnızca
  # çalıştırılabilir bit'i tutarlılık için ayarlanıyor.
  chmod +x "$SCRIPT_DIR/restore.sh" 2>/dev/null || true
  cat > /etc/systemd/system/praxura-backup.service <<EOF
[Unit]
Description=Praxura On-Premise — gecelik yedek (O-26)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/env bash ${SCRIPT_DIR}/backup.sh --sebep nightly
EOF

  cat > /etc/systemd/system/praxura-backup.timer <<EOF
[Unit]
Description=Praxura On-Premise — gecelik yedek (Timer)

[Timer]
# 01:00 + dar jitter — praxura-update.timer'ın 02:00+2h penceresinden ÖNCE,
# ikisi çakışmasın diye. .praxura-update.lock paylaşımı ek bir güvenlik ağı.
OnCalendar=*-*-* 01:00:00
RandomizedDelaySec=900
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now praxura-backup.timer >/dev/null 2>&1
  ok "praxura-backup.timer aktiv (nächtlich 01:00 + bis zu 15 Min Zufallsverzögerung)"
else
  warn "systemctl nicht gefunden — automatische Aktualisierung/Yedekleme NICHT eingerichtet. 'bash update.sh --jetzt' / 'bash backup.sh --sebep manuel' manuell/per Cron einrichten."
fi

# ── IP-Timer (K2b.6, O-161 / L7, L10) ───────────────────────────────────────
timer_rc=0
ip_timer_kur "$SCRIPT_DIR" || timer_rc=$?
case "$timer_rc" in
  0) ok "praxura-ip.timer aktiv (alle 2 Min, Start 1 Min nach Boot)" ;;
  1) warn "systemctl nicht gefunden — praxura-ip.timer NICHT eingerichtet. IP-Meldung per Cron einrichten." ;;
  2) : ;; # kein Namensdienst — still
  3) warn "nicht als root ausgeführt — praxura-ip.timer nicht eingerichtet" ;;
  4) warn "praxura-ip.timer konnte nicht eingerichtet werden (systemd) — Einzelheiten: systemctl status praxura-ip.timer" ;;
  *) warn "praxura-ip.timer konnte nicht eingerichtet werden (Fehlercode $timer_rc)" ;;
esac

# ── Schritt 17 — Ausgabe ──────────────────────────────────────────────────────
# Die Route zu einer beliebigen oeffentlichen Adresse zeigt zuverlaessiger
# auf die echte Praxisnetz-Schnittstelle als andere Schnittstellen — letztere koennen
# auch eine interne Docker-Bridge-Adresse (typ. 172.17.0.1) an erster Stelle
# zurückgeben (O-59-Nachbarfund, Gegenlesen 11.09.2026). Trotzdem nur ein
# Hinweis, keine Wahrheit — immer gegen die tatsächliche Praxisnetz-IP prüfen.
LAN_IP="$(lan_ip_ermitteln)"

log "[17/17] Fertig"
log ""
log "  Box erreichbar unter:  ${SITE_URL}"
[ -n "$LAN_IP" ] && log "  Eine Server-Adresse:    ${LAN_IP} (PRÜFEN, ob das die echte Praxisnetz-IP ist, nicht z. B. eine Docker-interne)"
if [ "$KAYIT_MODUS" = "code" ] || [ "$KAYIT_MODUS" = "vorhanden" ]; then
  log ""
  log "  Adresse: ${SITE_URL} — auf jedem Gerät im Praxisnetz direkt aufrufbar."
  log "  Hinweis: FRITZ!Box-DNS-Rebind-Schutz kann lokale Auflösung öffentlicher Domains blockieren."
  log "           Ausnahme für '${HOST_PART}' im Router eintragen (Details: KURULUM.md)."
else
  # O-59: Caddy antwortet NUR auf den Host-Namen in SITE_URL — die IP allein
  # oeffnet nichts. Ohne diese Zeile draengt sich der Eindruck auf, die Adresse
  # stehe schon "fertig" da; sie ist erst nach diesem Schritt auf jedem
  # Praxisrechner verwendbar (onprem-Review 12.09.2026).
  if [ -n "$LAN_IP" ]; then
    log ""
    log "  Auf JEDEM Praxisrechner eintragen, sonst wird ${SITE_URL} nicht gefunden:"
    log "    — hosts-Datei (Windows: C:\\Windows\\System32\\drivers\\etc\\hosts, Mac/Linux: /etc/hosts):"
    log "        ${LAN_IP}  ${HOST_PART}"
    log "    — ODER: als A-Eintrag im Praxis-Router/DNS, dann entfällt das pro Rechner"
  fi
fi
if [ "$CADDY_TLS_MODUS_VALUE" = "acmedns" ]; then
  log "  Zertifikat:             Let's Encrypt — auf keinem Gerät muss etwas importiert werden."
elif [ "$CADDY_TLS_MODUS_VALUE" = "klassisch" ] && [ "$CADDY_TLS_ARG_VALUE" = "internal" ]; then
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
# O-29 (2): bis hierher wurde der Schlüssel nur GEZEIGT, nie eine Bestätigung
# VERLANGT — ein Enter-Reflex ohne Lesen/Sichern war möglich. Kein Abbruch bei
# Falscheingabe (anders als "LÖSCHEN" oben, Zeile 122): die Installation ist
# an diesem Punkt bereits vollständig fertig, es gibt nichts abzubrechen —
# nur eine Schleife, bis die Bestätigung wirklich kommt.
while true; do
  read -r -p "  Zum Fortfahren genau tippen, sobald der Schlüssel gesichert ist: GESICHERT " dek_bestaetigt
  [ "$dek_bestaetigt" = "GESICHERT" ] && break
  log "  Nicht akzeptiert ('$dek_bestaetigt') — bitte exakt GESICHERT eintippen, erst NACHDEM der Schlüssel oben in einen Tresor/zweiten Datenträger kopiert wurde."
done
if [ "${PRAXURA_BROWSER_OEFFNEN:-}" = "1" ]; then
  log ""
  log "  Der Browser öffnet sich am Ende der Einrichtung automatisch."
  log ""
else
  reveal_once ""
  reveal_once "  Einrichtung im Browser öffnen (Link einmalig, NICHT in install.log):"
  reveal_once ""
  reveal_once "    ${SITE_URL}/setup.html#${SETUP_TOKEN}"
  reveal_once ""
  reveal_once "  Der Link gilt 14 Tage."
  reveal_once ""
fi
log "  Link abgelaufen:       sudo bash install.sh --neuer-jeton"
log "  Weiter im Browser:     ${SITE_URL}/login.html"
log ""
log "  Ablauf dieser Einrichtung: $LOG_FILE (ohne Geheimnisse)"
