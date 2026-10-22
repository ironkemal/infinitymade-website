#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — Box vollständig entfernen (onprem O-217, 22.10.2026)
# ════════════════════════════════════════════════════════════════════════════
#
#  Warum es das gibt: Beta-Test 22.10.2026 — von Hand entfernt („docker compose
#  down -v", Timer erst danach). Dazwischen lief praxura-update.timer (Persistent=
#  true holt verpasste Läufe nach) und legte die Container mit leeren Volumes neu
#  an; Caddy hing in einer Schleife und hielt Port 80/443 belegt.
#
#  Reihenfolge (onprem O-217):
#    1. Update-Sperre nehmen (dieselbe wie update.sh/backup.sh) — sonst stoppen,
#       ohne etwas anzufassen. Solange sie gehalten wird, ist ein Timer harmlos.
#    2. Letzte Sicherung anbieten; liegen Sicherungen IM Installationsordner
#       (BACKUP_ZIEL leer), werden sie vorher nach /root/praxura-sicherung-* gerettet —
#       sonst löschte dieses Skript die einzige Kopie (Aufbewahrungspflicht).
#    3. Bestätigung „ENTFERNEN".
#    4. Timer UND Dienste stoppen, Unit-Dateien löschen.
#    5. docker compose down -v --rmi all — nur Projekt „praxura", andere
#       Docker-Projekte auf dem Server bleiben unberührt.
#    6. Installationsordner löschen; /opt/praxura nur, wenn danach leer.
#
#  Keine Abmeldung bei der Zentrale (bewusst, onprem O-217): den Namen schließt
#  Praxura von Hand. Docker und das Paket „age" bleiben installiert.
#
#  Aufruf:  sudo bash /opt/praxura/onprem/deinstallieren.sh
#
#  Der gesamte Ablauf steht in main() und wird in der letzten Zeile aufgerufen:
#  das Skript löscht seinen eigenen Ordner, bash darf danach nichts mehr lesen.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
LOCK_FILE="$SCRIPT_DIR/.praxura-update.lock"
UNITS="praxura-update praxura-backup praxura-ip"

log()  { printf '%s\n' "$*"; }
ok()   { log "  [ok] $*"; }
warn() { log "  [warn] $*"; }
fail() {
  # $1 Titel · $2 gefunden · $3 was tun
  log ""
  log "  ✗ [fehler] $1"
  log "      Gefunden:  $2"
  log "      Was tun:   $3"
  log ""
  exit 1
}
frage() { read -r -p "$2" "$1" </dev/tty; }
env_get() {
  awk -F= -v k="$1" '$1==k{sub(/^[^=]*=/,""); print; f=1} END{if(!f) print ""}' "$ENV_FILE" 2>/dev/null || true
}

main() {
  log ""
  log "  Praxura-Box entfernen"
  log "  ─────────────────────"

  # ── Vorprüfung ─────────────────────────────────────────────────────────────
  [ "$(id -u)" -eq 0 ] || fail "Kein Root" "$(id -un)" "Mit 'sudo bash $SCRIPT_DIR/deinstallieren.sh' erneut starten."
  { : </dev/tty; } 2>/dev/null || fail "Kein Terminal" "/dev/tty nicht verfügbar" "Direkt in einer Terminal-/SSH-Sitzung ausführen."
  case "$SCRIPT_DIR" in
    /|/opt|/root|/home|/usr|/var|/etc|/srv|"${HOME:-/}")
      fail "Unsicherer Ordner" "$SCRIPT_DIR" "Nur im Installationsordner der Box ausführen (Standard: /opt/praxura/onprem)." ;;
  esac
  [ -f "$SCRIPT_DIR/docker-compose.yml" ] && grep -q '^name: praxura$' "$SCRIPT_DIR/docker-compose.yml" \
    || fail "Kein Praxura-Installationsordner" "$SCRIPT_DIR (docker-compose.yml mit 'name: praxura' fehlt)" \
         "Im Installationsordner der Box ausführen (Standard: /opt/praxura/onprem)."
  command -v docker >/dev/null 2>&1 || fail "docker nicht gefunden" "kein docker-Befehl" "Läuft die Box auf diesem Rechner?"

  # ── 1. Sperre ──────────────────────────────────────────────────────────────
  exec 9>"$LOCK_FILE"
  flock -n 9 || fail "Aktualisierung oder Sicherung läuft gerade" "$LOCK_FILE ist belegt" \
    "Einige Minuten warten und erneut starten. Es wurde nichts verändert."
  ok "Update-Sperre gesetzt — Aktualisierung/Sicherung kann jetzt nicht dazwischenkommen"

  local site_url backup_ziel
  site_url="$(env_get SITE_URL)"
  backup_ziel="$(env_get BACKUP_ZIEL)"
  log ""
  log "  Box:    ${site_url:-unbekannt}"
  log "  Ordner: $SCRIPT_DIR"
  log ""
  log "  ⚠️  Alle Patientendaten, Termine und Dokumente dieser Box werden GELÖSCHT."
  log "      Für Behandlungsdokumentation und Abrechnung gelten Aufbewahrungspflichten"
  log "      (in der Regel 10 Jahre) — diese liegen bei der Praxis."

  # ── 2. Sicherung ───────────────────────────────────────────────────────────
  if [ -f "$ENV_FILE" ] && [ -f "$SCRIPT_DIR/backup.sh" ]; then
    log ""
    local sich
    frage sich "  Vorher eine letzte Sicherung erstellen? [J/n] "
    if [ "${sich:-J}" != "n" ] && [ "${sich:-J}" != "N" ]; then
      if PRAXURA_LOCK_HELD=1 bash "$SCRIPT_DIR/backup.sh" --sebep manuel; then
        ok "Sicherung erstellt"
      else
        log ""
        warn "Die Sicherung ist fehlgeschlagen (läuft die Datenbank?)."
        local ohne
        frage ohne "  Trotzdem ohne neue Sicherung fortfahren? Genau tippen: OHNE-SICHERUNG (sonst Abbruch) "
        [ "$ohne" = "OHNE-SICHERUNG" ] || fail "Abgebrochen" "keine Sicherung" "Datenbank prüfen ('docker compose ps'), dann erneut starten. Es wurde nichts gelöscht."
      fi
    fi
  fi

  # Sicherungen im Installationsordner retten — sonst löscht Schritt 6 sie mit.
  local rettung=""
  local innen="$SCRIPT_DIR/backups"
  case "$backup_ziel" in "$SCRIPT_DIR"/*) innen="$backup_ziel" ;; esac
  if [ -d "$innen" ] && [ -n "$(ls -A "$innen" 2>/dev/null)" ]; then
    rettung="/root/praxura-sicherung-$(date +%Y%m%d-%H%M%S)"
    mkdir -m 700 -p "$rettung"
    cp -a "$innen/." "$rettung/" || fail "Sicherungen konnten nicht gerettet werden" "$innen → $rettung" \
      "Platz prüfen (df -h /root) und erneut starten. Es wurde nichts gelöscht."
    ok "Sicherungen aus dem Installationsordner nach $rettung kopiert"
  elif [ -n "$backup_ziel" ]; then
    ok "Sicherungen liegen außerhalb der Box ($backup_ziel) — bleiben unberührt"
  fi

  # ── 3. Bestätigung ─────────────────────────────────────────────────────────
  log ""
  local bestaetigt
  frage bestaetigt "  Zum Entfernen genau tippen: ENTFERNEN "
  [ "$bestaetigt" = "ENTFERNEN" ] || fail "Bestätigung nicht erhalten" "'$bestaetigt'" "Abgebrochen, nichts wurde gelöscht${rettung:+ (Sicherungskopie liegt in $rettung)}."

  # ── 4. Zeitgesteuerte Abläufe ──────────────────────────────────────────────
  if command -v systemctl >/dev/null 2>&1; then
    local u
    for u in $UNITS; do
      systemctl disable --now "$u.timer" >/dev/null 2>&1 || true
      systemctl stop "$u.service" >/dev/null 2>&1 || true
      rm -f "/etc/systemd/system/$u.timer" "/etc/systemd/system/$u.service"
    done
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl reset-failed >/dev/null 2>&1 || true
    ok "Automatische Aktualisierung, Sicherung und IP-Meldung entfernt"
  fi

  # ── 5. Container, Volumes, Images ──────────────────────────────────────────
  if (cd "$SCRIPT_DIR" && env -u COMPOSE_PROJECT_NAME docker compose down -v --remove-orphans --rmi all) </dev/null; then
    ok "Container, Daten-Volumes und Programmpakete entfernt"
  else
    # --rmi scheitert, wenn ein anderes Projekt dasselbe Image nutzt — dann ohne.
    warn "Programmpakete ließen sich nicht alle entfernen — entferne ohne sie"
    (cd "$SCRIPT_DIR" && env -u COMPOSE_PROJECT_NAME docker compose down -v --remove-orphans) </dev/null \
      || fail "Container ließen sich nicht entfernen" "docker compose down fehlgeschlagen" \
           "'cd $SCRIPT_DIR && sudo docker compose down -v' von Hand ausführen, dann dieses Skript erneut starten."
    ok "Container und Daten-Volumes entfernt"
  fi
  local rest
  rest="$(docker volume ls -q --filter label=com.docker.compose.project=praxura 2>/dev/null || true)"
  if [ -n "$rest" ]; then
    # shellcheck disable=SC2086
    docker volume rm $rest >/dev/null 2>&1 || warn "Volumes blieben übrig: $rest — 'sudo docker volume rm $rest'"
  fi

  # ── 6. Ordner ──────────────────────────────────────────────────────────────
  exec 9>&-
  local eltern
  eltern="$(dirname "$SCRIPT_DIR")"
  rm -rf -- "$SCRIPT_DIR"
  if [ "$(basename "$eltern")" = "praxura" ] && [ -z "$(ls -A "$eltern" 2>/dev/null)" ]; then
    rmdir -- "$eltern"
  fi
  ok "Installationsordner gelöscht"

  log ""
  log "  ════════════════════════════════════════════════════════════════"
  log "  Praxura ist entfernt."
  log ""
  log "  • Port 80/443 ist frei — ein anderer Webserver auf diesem Rechner"
  log "    kann jetzt wieder gestartet werden."
  if [ -n "$rettung" ]; then
    log "  • Sicherungskopie: $rettung"
    log "    Lesbar nur mit dem Sicherungsschlüssel (AGE-SECRET-KEY-…) und dem"
    log "    DATA_ENCRYPTION_KEY vom Notfallzettel der Einrichtung."
  fi
  log "  • Auf den Praxisrechnern ggf. von Hand entfernen: Zeile für die Box in der"
  log "    hosts-Datei, importiertes Box-Zertifikat, Lesezeichen/App-Symbol."
  [ -n "$site_url" ] && log "  • Teilen Sie Praxura mit, dass die Box ${site_url#https://} entfernt ist —"
  [ -n "$site_url" ] && log "    der Name wird dann geschlossen."
  log "  • Docker und das Paket „age“ bleiben installiert."
  log "  ════════════════════════════════════════════════════════════════"
  log ""
}

main "$@"
