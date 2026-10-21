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
  deadline=$((SECONDS + timeout_sek))
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
      # Liveness reicht nicht: fehlgeschlagene Migrationen lassen /health grün.
      # Intern prüfen; Ready-Antwort enthält Diagnosedetails und bleibt unveröffentlicht.
      if docker compose exec -T api node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/ready',{signal:AbortSignal.timeout(5000)}).then(async r=>process.exit(r.ok&&(await r.json()).status==='ready'?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
        ok "Alle ${ERWARTETE_DIENSTE} Container gesund; API betriebsbereit"
        return 0
      fi
    fi
    if [ "$i" -eq "$versuche" ] || [ "$SECONDS" -ge "$deadline" ]; then
      return 1
    fi
    sleep 2
  done
  return 1
}
