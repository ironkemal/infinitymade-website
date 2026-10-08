#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Praxura On-Premise — Starter-Skript (praxura.de/install.sh)
# ════════════════════════════════════════════════════════════════════════════
#
# Was: Lädt das Installations-Bundle direkt aus dem Container-Image des
#      gewählten Kanals (stable/beta) und startet daraus install.sh.
# Warum: Installationsdateien und Container-Images stammen aus demselben
#        freigegebenen Release-Artefakt statt aus Git (O-157 / O-176).
# Sicherheit (guvenlik S-52):
#      - Docker-Installation nur aus offiziellem apt-Repo mit GPG-Signatur
#      - Download stets über TLS 1.2+ (--proto '=https' --tlsv1.2 -fsSL)
#      - Anonymer Image-Pull aus GHCR ohne Tokens oder Geheimnisse
#      - Temporärordner via mktemp -d, Bereinigung über EXIT-Trap
#      - Festes Literal beim Löschen alter Installationsversuche
#
API_IMAGE_BASIS="ghcr.io/ironkemal/infinitymade-website/calendar-api"

log() { printf '%s\n' "$*"; }
ok()  { printf '  [ok] %s\n' "$*"; }

fehler() {
  printf 'FEHLER: %s\n' "$1" >&2
  [ -n "${2:-}" ] && printf 'Was tun: %s\n' "$2" >&2
  exit 1
}

hilfe() {
  cat <<'EOF'
Praxura On-Premise — Starter-Skript
Verwendung:
  curl --proto '=https' --tlsv1.2 -fsSL https://praxura.de/install.sh | sudo bash
  curl --proto '=https' --tlsv1.2 -fsSL https://praxura.de/install.sh | sudo bash -s -- [OPTIONEN]
Optionen:
  --kanal=beta|stable   Wählt den Release-Kanal (Standard: stable)
  --hilfe               Zeigt diese Hilfe an
Weitere Optionen werden an install.sh durchgereicht. Der Starter richtet nur
eine NEUE Box ein; eine vorhandene aktualisiert update.sh, neu aufsetzen:
  sudo bash /opt/praxura/onprem/install.sh --neu
EOF
}

docker_installieren() {
  [ -f /etc/os-release ] || fehler "Betriebssystem konnte nicht ermittelt werden (/etc/os-release fehlt)." \
    "Docker manuell installieren: siehe https://docs.docker.com/engine/install/"
  # shellcheck source=/dev/null
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian) : ;;
    *) fehler "Automatische Docker-Installation wird nur für Ubuntu und Debian unterstützt (gefunden: '${ID:-unbekannt}')." \
         "Docker manuell installieren: siehe https://docs.docker.com/engine/install/" ;;
  esac
  local codename="${VERSION_CODENAME:-}"
  [ -n "$codename" ] || fehler "Codename des Betriebssystems (VERSION_CODENAME) fehlt in /etc/os-release." \
    "Docker manuell installieren: siehe https://docs.docker.com/engine/install/"

  log "Docker oder das Docker-Compose-Plugin fehlt auf diesem Server."
  local antwort=""
  read -r -p "Soll Docker aus dem offiziellen apt-Repository installiert werden? [J/n]: " antwort </dev/tty || antwort="n"
  case "$antwort" in
    [nN]*) fehler "Docker-Installation abgebrochen." \
             "Docker manuell installieren und erneut ausführen: https://docs.docker.com/engine/install/" ;;
  esac

  log "Richte Docker-Paketquelle ein..."
  install -m 0755 -d /etc/apt/keyrings
  curl --proto '=https' --tlsv1.2 -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$ID" "$codename" > /etc/apt/sources.list.d/docker.list

  log "Installiere Docker-Pakete..."
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker erfolgreich installiert und gestartet"
}

main() {
  set -euo pipefail

  # 1. Root prüfen
  [ "$(id -u)" -eq 0 ] || fehler "Dieses Skript benötigt Root-Rechte." \
    "Bitte mit sudo starten: curl --proto '=https' --tlsv1.2 -fsSL https://praxura.de/install.sh | sudo bash"

  # 2. Prozessor-Architektur (O-174)
  [ "$(uname -m 2>/dev/null || echo unbekannt)" = "x86_64" ] || fehler \
    "Die Praxura-Box läuft nur auf x86_64 (Intel/AMD). ARM (z. B. Hetzner CAX, Raspberry Pi) wird nicht unterstützt." \
    "Einen x86_64-Server wählen (z. B. Hetzner CX-Serie, Intel/AMD-Hardware)."

  # 3. Interaktives Terminal prüfen
  { : </dev/tty; } 2>/dev/null || fehler "Kein Terminal verfügbar (/dev/tty kann nicht geöffnet werden)." \
    "Die Einrichtung stellt Fragen, bitte in einer SSH-Sitzung/einem Terminal ausführen."

  # Argumente verarbeiten
  local kanal="stable" kanal_gewaehlt=0 weitere=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --kanal=*) kanal="${1#--kanal=}"; kanal_gewaehlt=1; shift ;;
      --hilfe|-h|--help) hilfe; exit 0 ;;
      *) weitere+=("$1"); shift ;;
    esac
  done

  case "$kanal" in
    stable|beta) : ;;
    *) fehler "Unbekannter Kanal in --kanal=: '$kanal' (erlaubt: beta, stable)." \
         "Bitte --kanal=stable oder --kanal=beta angeben." ;;
  esac

  # 4. Zielordner /opt/praxura/onprem prüfen
  local ziel_ersetzen=0
  if [ -f "/opt/praxura/onprem/.env" ]; then
    fehler "Hier ist schon eine Box eingerichtet." \
      "Aktualisieren: sudo bash /opt/praxura/onprem/update.sh --jetzt — komplett neu: sudo bash /opt/praxura/onprem/install.sh --neu"
  elif [ -d "/opt/praxura/onprem" ]; then
    log "Das Verzeichnis /opt/praxura/onprem existiert bereits ohne .env (abgebrochene Einrichtung)."
    local antwort=""
    read -r -p "Darf das vorhandene Verzeichnis ersetzt werden? [J/n]: " antwort </dev/tty || antwort="n"
    case "$antwort" in
      [nN]*) fehler "Einrichtung abgebrochen." "Verzeichnis /opt/praxura/onprem prüfen oder manuell sichern." ;;
      *) ziel_ersetzen=1 ;;
    esac
  fi

  # 5. Docker und Compose prüfen
  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    docker_installieren
  fi
  systemctl enable --now docker >/dev/null 2>&1 || true

  # 6. Kanal prüfen
  if ! docker manifest inspect "$API_IMAGE_BASIS:$kanal" >/dev/null 2>&1; then
    if [ "$kanal" = "stable" ] && [ "$kanal_gewaehlt" -eq 0 ]; then
      log "Der Kanal 'stable' ist noch nicht veröffentlicht."
      local antwort=""
      read -r -p "Mit 'beta' installieren? Ein späterer Wechsel zu 'stable' geht erst, wenn 'stable' Ihre Version erreicht hat. [J/n]: " antwort </dev/tty || antwort="n"
      case "$antwort" in
        [nN]*) fehler "Installation abgebrochen." "Warten, bis der Kanal 'stable' veröffentlicht wurde." ;;
        *)
          kanal="beta"
          docker manifest inspect "$API_IMAGE_BASIS:beta" >/dev/null 2>&1 || fehler \
            "Image '$API_IMAGE_BASIS:beta' nicht erreichbar." "Registry nicht erreichbar, Internet prüfen."
          ;;
      esac
    elif [ "$kanal" = "stable" ] && [ "$kanal_gewaehlt" -eq 1 ]; then
      fehler "Der Kanal 'stable' ist noch nicht veröffentlicht." \
        "Auf die Veröffentlichung warten oder mit '--kanal=beta' installieren."
    else
      fehler "Image '$API_IMAGE_BASIS:$kanal' nicht erreichbar." "Registry nicht erreichbar, Internet prüfen."
    fi
  fi
  ok "Kanal '$kanal' ausgewählt"

  # Temporärordner und Aufräum-Trap
  local tmp; tmp="$(mktemp -d)"
  trap 'docker rm -f praxura-starter-tmp >/dev/null 2>&1 || true; [ -n "${tmp:-}" ] && rm -rf "$tmp"' EXIT

  # 7. Image ziehen und Version ermitteln
  log "Ziehe Image '$API_IMAGE_BASIS:$kanal'..."
  docker pull "$API_IMAGE_BASIS:$kanal" >/dev/null

  local digest_ref; digest_ref="$(docker image inspect -f '{{index .RepoDigests 0}}' "$API_IMAGE_BASIS:$kanal" 2>/dev/null || true)"
  [ -n "$digest_ref" ] || fehler "Konnte Digest für '$API_IMAGE_BASIS:$kanal' nicht ermitteln." \
    "Prüfen, ob das Image vollständig heruntergeladen wurde."

  local image_version; image_version="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}' "$API_IMAGE_BASIS:$kanal" 2>/dev/null || true)"
  [ "$image_version" != "<no value>" ] || image_version=""
  log "Image: $digest_ref"
  log "Version: ${image_version:-unbekannt}"

  # 8. Bundle extrahieren
  docker rm -f praxura-starter-tmp >/dev/null 2>&1 || true
  docker create --name praxura-starter-tmp "$digest_ref" >/dev/null
  docker cp praxura-starter-tmp:/app/onprem-bundle "$tmp/bundle"
  docker rm -f praxura-starter-tmp >/dev/null 2>&1 || true

  [ -f "$tmp/bundle/install.sh" ] && [ -f "$tmp/bundle/manifest.json" ] || fehler \
    "Das Image enthält kein gültiges On-Premise-Bundle." \
    "Image '$digest_ref' prüfen — /app/onprem-bundle/install.sh oder manifest.json fehlt."

  # 9. Nach /opt/praxura/onprem verschieben
  install -d -m 0755 /opt/praxura
  [ "$ziel_ersetzen" -eq 1 ] && rm -rf -- /opt/praxura/onprem
  mv "$tmp/bundle" /opt/praxura/onprem

  local version="${image_version:-}"
  [ -n "$version" ] || version="$(grep -oE '"surum"[[:space:]]*:[[:space:]]*"[^"]+"' /opt/praxura/onprem/manifest.json 2>/dev/null | head -1 | sed -E 's/.*"([^"]+)"$/\1/')"
  log "Dateien Version ${version:-unbekannt} nach /opt/praxura/onprem"

  # 10. Vor exec aufräumen und install.sh starten
  docker rm -f praxura-starter-tmp >/dev/null 2>&1 || true
  rm -rf -- "${tmp:?}"
  trap - EXIT

  cd /opt/praxura/onprem
  exec bash install.sh --kanal="$kanal" ${weitere[@]+"${weitere[@]}"} </dev/tty
}

main "$@"
