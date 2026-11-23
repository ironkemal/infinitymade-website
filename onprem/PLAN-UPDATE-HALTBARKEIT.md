# Plan — Box-Updates über Jahre stabil halten

> Stand: **lokal umgesetzt & getestet (Schritte 1–5 + Timer-Zeitzone `Europe/Berlin`, 23.11.2026)** —
> wartet auf Push-GO + CI-Image + Schritt 6 (Live-Abnahme auf der Testbox). Vorprüfung durch `onprem`-Agent:
> kein Veto, Sicherfunde O-213 (b)/(e), O-247, O-248, O-249 (Commit `8e237af6`).
> Reihenfolge-Vorgabe von Melih: Testbox mit Vorher-Stand installiert (22.11.), jetzt Plan gebaut,
> als Nächstes pushen, Schritt 6 prüfen + Snapshot zurücksetzen für saubere Neuinstallation.
>
> Vor dem Bauen: `onprem`-Agent kurz informieren („setze PLAN-UPDATE-HALTBARKEIT um"),
> Änderungen an `update.sh`/Compose sind seine Pflichtkonsultation (CLAUDE.md).

## Warum

Die Box aktualisiert sich jede Nacht selbst (`update.sh`). Vier Lücken lassen sie über
Monate/Jahre still stehen bleiben, ohne dass es jemand merkt:

| # | Lücke | Folge | Register |
|---|---|---|---|
| 1 | Disk-Tor `update.sh:217-222` bricht mit `exit 1` ab, **bevor** `durumu_yaz` (:315) und `bildirim_degerlendir` (:388) definiert sind | volle Platte → kein Status, keine Mail, Box hängt jede Nacht still | O-213 (e) |
| 2 | Kein Aufräumen alter Images | Platte läuft über Monate voll → Lücke 1 greift | O-213 (b) |
| 3 | `onprem/docker-compose.yml` ohne `logging:` | json-file-Logs wachsen unbegrenzt → Lücke 1 greift | O-247 |
| 4 | Kein Schutz gegen Postgres-Hauptversionswechsel (`VERSION_POSTGRES`, `.env.template:27`) | Major-Sprung (17 → 18) lässt jedes Box-Update scheitern und zurückrollen | O-248 |

## Arbeitsteilung (Melih-Wunsch: einfache Teile an kleinere Modelle)

| Schritt | Wer | Dateien |
|---|---|---|
| 1 Disk-Tor meldet sich | Hauptagent | `onprem/update.sh`, `api-backend/setup/update-alarm-mail.mjs` |
| 2 Image-Aufräumen | Hauptagent | `onprem/update.sh` |
| 3 Log-Limit | Haiku | `onprem/docker-compose.yml` + Manifest |
| 4 Postgres-Tor | Sonnet | `tools/check-onprem.sh` |
| 5 Tests | Sonnet; Prüfung + Commit Hauptagent | `tools/*.test.js` |

Schritte 3 und 4 parallel starten, währenddessen 1 + 2 bauen.

## Schritt 1 — Disk-Tor meldet sich (O-213 e)

- Muster der Zertifikatswarnung übernehmen (`update.sh:173-212`, steht **vor** dem Disk-Tor
  und nutzt nur `mail_gonder_container` von :141):
  eigene Zustandsdatei `$STAND_DIR/son-speicher-bildirim.json`, Drosselung über
  `BILDIRIM_ARALIK_SANIYE`, dann `mail_gonder_container speicher_voll`, danach `exit 1`.
- Neuer Text `speicher_voll` in `api-backend/setup/update-alarm-mail.mjs` (`METINLER`),
  fester Text, **nie** Log-Auszug (Vertrag wie `backup.sh:88`).
- Status für `/api/status` (O-191) möglichst ebenfalls schreiben; geht `durumu_yaz` dort
  noch nicht, minimal-JSON in `STAND_FILE` nach demselben Schema.
- Hinweistext ändern: **nicht** `docker system prune` (löscht beim Kunden auch fremde,
  gestoppte Container). Stattdessen: alte Sicherungen prüfen, `docker image prune`.

## Schritt 2 — Alte Images aufräumen (O-213 b)

- Nur bei `sonuc=ok` **nach** grüner Gesundheit (Schritt 10, `update.sh:847`), vor Schritt 11.
- Image-Referenzen (`PRAXURA_*_IMAGE`, `VERSION_*`) **vor** dem `.env`-Abgleich (Schritt 6,
  :518) merken, nachher vergleichen; nur die ersetzten alten Referenzen `docker rmi`
  (Fehler ignorieren — noch genutzte Images verweigert Docker selbst).
- Danach `docker image prune -f` (nur dangling).
- ⛔ Kein `-a`, kein `--filter until=` (bewertet Build-Datum, nicht Nutzung; fremde
  Container des Kunden). Eine Abhängigkeit von alten Images gibt es nicht:
  `backup.sh:417` liest nur den Digest, `restore.sh:545` zieht das aktuelle Image.
- Windows-Box: Aufräumen gibt Platz in WSL frei, **nicht** auf C: (O-158, separat).

## Schritt 3 — Log-Limit (O-247)

Direkt über `services:` in `onprem/docker-compose.yml` (nach `name: praxura`):

```yaml
# O-247 (22.11.2026): Container-Logs begrenzen — ohne max-size wächst json-file
# über Jahre unbegrenzt und füllt die Platte (dann stoppt update.sh am 8-%-Tor).
x-praxura-logging: &praxura-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

In **allen 9 Diensten** (`db, auth, rest, realtime, storage, kong, api, kayit, caddy`)
direkt nach `restart:` die Zeile `    logging: *praxura-logging`.
Dann `node tools/onprem-manifest.mjs` (sha256 erneuern, gleicher Commit).

Prüfen: `docker compose -f onprem/docker-compose.yml --env-file onprem/.env.template config --quiet`.
Nebenwirkung, akzeptiert: in der Update-Nacht werden alle Container einmal neu erzeugt
(kurzer Ausfall 02–04 Uhr, Gesundheitsprüfung Schritt 10 fängt Fehler).
`daemon.json` wurde verworfen (globale Host-Änderung, dockerd-Neustart, nur Neuinstallationen).

## Schritt 4 — Postgres-Tor (O-248)

In `tools/check-onprem.sh` (POSIX sh, liest den **Index** — `git show :onprem/.env.template`):
`ERWARTETE_PG_MAJOR=17`; Hauptversion aus `VERSION_POSTGRES` ≠ 17 oder leer → Commit
abgelehnt mit Hinweis „onprem O-248: Postgres-Hauptversion darf nicht ohne Upgrade-Pfad
wechseln (pg_upgrade)". **Kein** Skip-Schalter, auch keine `durak:true`-Ausnahme, solange
O-75 offen ist. Auf die Box geht dafür kein Code.

## Schritt 5 — Tests

Textprüfungen im Stil von `tools/onprem-update-sapma.test.js`:
- Disk-Tor ruft `mail_gonder_container speicher_voll` vor `exit 1`
- Aufräumen nur im `ok`-Pfad nach der Gesundheitsprüfung
- kein `image prune -a` / `system prune` in `update.sh`
- jeder Compose-Dienst hat `logging: *praxura-logging`
- Postgres-Tor: Beispiel `18.1.0.1` → abgelehnt, `17.6.1.136` → ok

Dann `npm test`, `sh tools/check-onprem.sh`, Commit auf `main` (Push nur mit GO).

## Schritt 6 — Live-Abnahme auf der Testbox (nach Push + CI-Image)

| Prüfung | Befehl | Erwartet |
|---|---|---|
| Update | `bash /opt/praxura/onprem/update.sh --jetzt` | Ergebnis `ok` |
| Log-Limit | `docker inspect -f '{{.HostConfig.LogConfig}}' $(docker ps -q) \| sort -u` | `max-size:10m` |
| Aufräumen | `docker images` vor/nach | keine alten Praxura-Versionen |
| Disk-Alarm | `fallocate -l 66G /fuell` → Update starten → `rm /fuell` | Abbruch **mit** Status + Alarm (Mail nur mit SMTP) |

## Bewusst später

| Punkt | Warum nicht jetzt |
|---|---|
| Pflichtstationen bei Mehrfach-Sprung erkennen (`mindest_von`, O-75) | heute keine Pflichtstation; Schritt 4 deckt den gefährlichsten Fall; braucht Sprungtest |
| WSL-Platte gibt Platz auf C: nicht frei (O-158) | eigenes Windows-Thema |
| Docker-Mindestversion (O-249) | Version erst festlegen; Vorschlag: `update.sh` schreibt Docker-Version in den Status |
