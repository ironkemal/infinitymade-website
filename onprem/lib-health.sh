#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — geteilte Gesundheitsprüfung
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 12.09.2026 · onprem/REGISTER.md §7J (J5 Schritt 9): install.sh und
#  update.sh dürfen NICHT zwei Kopien derselben Prüfung pflegen — das ist
#  genau die Sorte Drift, die O-63 (Gegenlesen 11.09.2026) einmal schon
#  gefunden hat. EIN Ort, beide Skripte `source` ihn.
#
#  Erwartet vom Aufrufer (beide Skripte definieren das bereits selbst):
#    log()  — Bildschirm + Logdatei
#    ok()   — wie log(), mit "[ok]"-Präfix
#    fail() — TITEL GEFUNDEN ERWARTET WAS-TUN, beendet den Prozess (exit),
#             kehrt NICHT zurück
#
#  Aufruf: warte_auf_gesundheit <timeout_sekunden>
#  Muss im Verzeichnis mit der aktiven docker-compose.yml aufgerufen werden.
# ════════════════════════════════════════════════════════════════════════════

warte_auf_gesundheit() {
  timeout_sek="${1:-180}"
  versuche=$(( timeout_sek / 2 ))
  [ "$versuche" -ge 1 ] || versuche=1

  # `docker compose ps --format …` statt `docker inspect` pro Dienst wurde
  # bewusst NICHT gewählt: die Tabellen-/Template-Unterstützung unterscheidet
  # sich zwischen Compose-Versionen, und ein Dienst ohne laufenden Container
  # (abgestürzt, nie gestartet) taucht in "ps" ohne "--all" oft schlicht nicht
  # auf — der Zwischenstand wirkt dann fälschlich vollständig (O-63).
  mapfile -t DIENSTE < <(docker compose config --services 2>/dev/null)
  ERWARTETE_DIENSTE="${#DIENSTE[@]}"
  [ "$ERWARTETE_DIENSTE" -gt 0 ] || fail "Compose-Konfiguration liefert keine Dienste" "0 Dienste" "8 Dienste (db, auth, rest, realtime, storage, kong, api, caddy)" \
    "'docker compose config' von Hand prüfen — die Compose-Datei ist vermutlich beschädigt."

  for i in $(seq 1 "$versuche"); do
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
      return 0
    fi
    if [ "$i" -eq "$versuche" ]; then
      return 1
    fi
    sleep 2
  done
  return 1
}

# ── O-193 (0.6.0): "gesund" heisst nicht "bereit" ───────────────────────────
# Seit O-190 (c) zählt der Wartungsmodus im api-Healthcheck als gesund (sonst
# startet caddy nicht und der Kunde sieht nicht einmal die Wartungsmeldung).
# Damit läuft warte_auf_gesundheit auch bei gescheiterter Migration durch —
# update.sh meldete dann `ok`. Deshalb nach der Gesundheit /health/ready lesen.
#
# bereitschaft_einordnen "<http-status> <grund> <art>" → eine Zeile:
#   ok                    200
#   schema_fehler <art>   503 + grund=schema_migration + art aus der Weißliste
#                         (endgültig: wartungsmodus wird vor app.listen gesetzt)
#   nicht_bereit          alles andere (auch art=verbindung — der O-190-Fall,
#                         der geht in den Rückroll-Zweig, nicht nach schema_fehler)
# Rein, ohne Docker — testbar. Nur `art` verlässt die Funktion, nie Text/Datei:
# Postgres-Meldungen gehören nicht in Statusdateien (onprem O-193).
bereitschaft_einordnen() {
  local status grund art
  read -r status grund art <<<"$1"
  if [ "$status" = "200" ]; then echo "ok"; return 0; fi
  if [ "$status" = "503" ] && [ "$grund" = "schema_migration" ]; then
    case "$art" in
      migration|pruefsumme|downgrade|reihenfolge) echo "schema_fehler $art"; return 0 ;;
    esac
  fi
  echo "nicht_bereit"
}

# bereitschaft_pruefen <timeout_sekunden> — fragt /health/ready im api-Container
# alle 5 s, bis ok oder schema_fehler (beides endgültig) oder Zeit um.
# `timeout 15` je Versuch: fetch hat kein eigenes Zeitlimit (onprem 11.10.2026).
# Muss im Verzeichnis mit der aktiven docker-compose.yml aufgerufen werden.
bereitschaft_pruefen() {
  local timeout_sek="${1:-60}" versuche roh ergebnis i
  versuche=$(( timeout_sek / 5 ))
  [ "$versuche" -ge 1 ] || versuche=1
  ergebnis="nicht_bereit"
  for i in $(seq 1 "$versuche"); do
    roh="$(timeout 15 docker compose exec -T api node -e "fetch('http://127.0.0.1:3000/health/ready').then(async r=>{const j=await r.json().catch(()=>({}));const s=v=>String(v||'-').replace(/[^a-z_]/gi,'').slice(0,32)||'-';console.log(r.status+' '+s(j.grund)+' '+s(j.detail&&j.detail.art))}).catch(()=>console.log('0 - -'))" 2>/dev/null | tail -n 1 || true)"
    ergebnis="$(bereitschaft_einordnen "${roh:-0 - -}")"
    case "$ergebnis" in ok|schema_fehler*) echo "$ergebnis"; return 0 ;; esac
    [ "$i" -eq "$versuche" ] || sleep 5
  done
  echo "$ergebnis"
}
