---
titel: Live-API liefert HTML statt JSON (n8n antwortet statt calendar-api)
typ: sitzung
angelegt: 2026-10-03
tags: [sitzung, live, vps, traefik, calendar-api, n8n, blocker, betrieb]
status: GELÖST — 04.10.2026 ~21:40 UTC, Ursache: VPS-Platte 100 % voll (Backup-Cron)
---

# Live-API liefert HTML statt JSON

> **Kemal için kısa özet (TR):** Son kayıtlı kontrolde (04.10.2026) `GET /api/krankenkassen` JSON yerine HTML döndürdü. Canlı backend/Traefik yönlendirmesi kontrol edilmeli. Container'ın durumu ve VPS label'ları henüz doğrulanmadı; çökme veya label farkı yalnız hipotez. `GET /health` de HTML döndürdü, ancak repo Traefik kuralı yalnız `/api` yolunu kapsıyor: dışarıdaki `/health` sonucu tek başına container arızası kanıtı değil. Bu not artık repo kökünden `wissensbank/sitzungen/2026-10-03_live-api-liefert-html-statt-json.md` yolunda paylaşılacak; yeni canlı kontrol veya server değişikliği yapılmadı.

> ⚠️ Keine Quelle, sondern Arbeitsnotiz (siehe [[SITZUNGEN]]). Repo ist PUBLIC: hier stehen
> bewusst **keine IPs, keine SSH-Befehle, keine Schlüssel**. Die stehen in `INFRASTRUCTURE.md`
> (nicht im Repo, `.gitignore`) bzw. beim VPS-Betreiber (Kemal).

## 1. Symptom (was gemessen wurde)

Gemessen am 03.10.2026 (lesender Test, siehe `fortschritte/2026-10-03.md`, Abschnitt „Live-Betriebsbefund"):

| Aufruf | Erwartet | Tatsächlich |
|---|---|---|
| `GET https://n8n.infinitymade.de/api/krankenkassen` | JSON (öffentlicher Krankenkassen-Endpunkt) | `200` mit n8n-**HTML** |
| `GET https://n8n.infinitymade.de/api/team` | JSON (oder 401 ohne Login) | `200` mit n8n-**HTML** |
| `POST /api/billing/abrechnung/zuzahlungsforderung` ohne Login, Body `{}` | `401` (Auth-Ablehnung) | `404` |

Weitere Fakten:
- Die öffentliche Produktions-Config (`/api/config`, Datei `api/config.js`) liefert
  `apiBase = https://n8n.infinitymade.de/api`. Das Dashboard ruft also genau diesen Host auf.
- Der GitHub-Image-Build für Commit `0260612` war erfolgreich. Das beweist nur, dass das Image
  **veröffentlicht** wurde, **nicht**, dass der Container auf dem VPS läuft.
- Erste Prüfversuche nutzten falsche Pfade (`/api/health`, Billing-Pfad ohne `/billing`). Der echte
  Health-Pfad ist **`/health`** (und `/health/ready` für „kann arbeiten", prüft die DB) in
  `api-backend/server.js` (~Z.345). Nachtrag vom 04.10.: öffentliches GET `/health` ebenfalls HTTP 200 HTML. Die Repo-Traefik-Regel umfasst nur `/api`; deshalb Prozess-Health direkt im Container prüfen oder zuerst ausdrücklich konfigurierte externe Health-Route nachweisen.

## 2. Warum das ein Problem ist

- Das Dashboard (`app.praxura.de`, Vercel) bekommt keine Daten → Fehler in der Oberfläche.
- Die geprüften API-Pfade erreichen offenbar nicht die erwarteten Handler. Weitere Backend-Funktionen könnten betroffen sein; deren vollständiger Live-Ausfall wurde nicht einzeln nachgewiesen.
- Die UI-Abnahme von M1 (z. B. M1.2 Storno) ist live nicht möglich.
- Der Kutu-Test (K3) setzt einen funktionierenden Weg voraus.

## 3. Wie der Weg aufgebaut ist (warum HTML herauskommt)

```
Browser/Dashboard → Traefik (HTTPS, Let's Encrypt) ─┬─ Host n8n…  && /api/* (ohne /api/v1) → calendar-api  (Soll)
                                                    └─ Host n8n…  (alles andere)           → n8n          (Fallback)
```

- Zwei getrennte Docker-Stacks im selben `web`-Netz: `/opt/n8n/` (Traefik + n8n) und
  `/opt/calendar-api/` (`calendar-api` + Watchtower). „Calendar API" ist nur der alte Name,
  der **gesamte Backend** ist darin (siehe `CLAUDE.md` → Mimari).
- Traefik-Regel (Repo-Kopie, `api-backend/docker-compose.yml`):
  ``Host(`n8n.infinitymade.de`) && PathPrefix(`/api`) && !PathPrefix(`/api/v1`)``
- Mögliche Erklärung: Ist `calendar-api` **nicht** aktiv/gesund, oder fehlt die Regel auf dem VPS, greift sie nicht →
  die Anfrage fällt an den n8n-Router (nur `Host`) → n8n liefert `200` HTML bzw. `404`.
  Das passt zu den Messwerten, beweist die Ursache aber nicht; je nach Traefik-Zustand sind auch Gatewayfehler möglich.
- **Bekannte Falle (Kommentar im Compose):** Watchtower erneuert nur das **Image**, nie die
  Compose-Datei oder die Labels. Die Repo-Datei ist nur eine Kopie. Änderungen an den Labels müssen
  auf dem VPS in `/opt/calendar-api/docker-compose.yml` nachgezogen und mit
  `docker compose up -d calendar-api` angewendet werden.
- **Dasselbe Symptom gab es schon:** 11.08.2026 (`/api/attendance`, `/api/admin`, `/api/arzt` → n8n
  antwortete mit HTML/404, sah im Browser wie ein CORS-Fehler aus) und 15.08.2026 (Kiosk-Modus
  `/api/kiosk` lief ins Leere). Beide Male stand der Fix im Repo, war aber auf dem VPS nicht aktiv.

## 4. Mögliche Ursachen (Hypothesen — NICHT bestätigt)

1. **`calendar-api` abgestürzt / Restart-Schleife** nach Watchtower-Update auf das neue `:beta`-Image
   (Build `0260612`, enthält M1.1 + Migration `0058`). Mögliche Auslöser: fehlende Variable in
   `/opt/calendar-api/.env.calendar`, Fehler beim Start im neuen Code.
2. **Label-Drift:** Traefik-Regeln auf dem VPS weichen vom Repo ab (Hilfsmittel: `tools/check-vps-drift.sh`).
3. **DNS/Zertifikat:** unwahrscheinlich, da überhaupt eine gültige HTTPS-Antwort kommt.

Hinweis: Von der Cloud-Sandbox aus ist der Host nicht erreichbar (Proxy blockt), daher wurde die
Ursache bisher **nur aus Repo-Dateien abgeleitet**, nicht am Server gemessen.

## 5. Zugang — Stand

- Ein dokumentierter read-only-Zugang auf den Betriebs-VPS scheiterte an **Host-Key-Verification**:
  kein vertrauter Schlüssel für Domain/IP in `known_hosts`. Die Prüfung wurde **nicht umgangen**
  und `known_hosts` **nicht geändert** (richtig so).
- Ein anderer lokal konfigurierter Server ist der **Synotix**-Server und enthält **kein** Praxura-
  `calendar-api` — dort wurde nichts geändert. Nicht verwechseln.
- Offen: richtiger VPS + **verifizierter Fingerprint** (Hetzner-Konsole oder Kemal).

## 6. Was zu tun ist (Reihenfolge)

1. Zugang zum richtigen VPS klären; Fingerprint über Hetzner-Konsole/Kemal verifizieren, nie blind akzeptieren.
2. Lesend prüfen:
   - `docker ps -a` (läuft `calendar-api`? Status `Restarting`/`unhealthy`?)
   - `docker logs calendar-api --tail 100` (Startfehler?)
3. Je nach Befund:
   - **Container abgestürzt:** Ursache im Log beheben (Env-Variable, Code), dann
     `docker compose pull && docker compose up -d --force-recreate calendar-api`.
   - **Container läuft, aber HTML:** Labels in `/opt/calendar-api/docker-compose.yml` gegen das Repo
     vergleichen (`tools/check-vps-drift.sh`), angleichen, `docker compose up -d calendar-api`.
4. Verifizieren:
   - `/health` direkt am Backend/Container → `200` JSON. Öffentlichen Health-Pfad nur anhand tatsächlich konfigurierter Traefik-Regel prüfen.
   - `GET /api/krankenkassen` ohne Login → JSON mit `krankenkassen` (öffentlicher Endpoint laut `server.js:3949`), **kein** HTML
   - `POST /api/billing/abrechnung/zuzahlungsforderung` ohne Login → `401`, nicht `404`
5. Danach: laufende Backend-Revision gegen aktuellen GitHub-main-Stand prüfen, benötigte Migrationen nachweisen und offene UI-Abnahme (M1.2 u. a.) nachholen. Ein Image-Build oder Git-Push allein belegt keinen laufenden Deploymentstand.
6. Ergebnis hier unter „Nachtrag" eintragen und die Ursache im Ops-Dashboard (Kategorie **Teknik**) schließen.

## 7. Offen / ungeprüft

- Tatsächliche Ursache (Abschnitt 4) — **ungeprüft**.
- Öffentlicher GET `/health` lieferte am 04.10. HTML; direkter Container-Health und gewünschte externe Routingregel — **ungeprüft**.
- Ob die Labels auf dem VPS dem Repo entsprechen — **ungeprüft**.
- Ob `0058` und die neuen M1-Routen im laufenden Container ankommen — **ungeprüft**.

## Nachtrag

04.10.2026: laut `fortschritte/2026-10-04.md:8` GET `/api/krankenkassen` und GET `/health` HTTP 200 `text/html`; HEAD `/api/krankenkassen` HTTP 404. Unterschiedliche Methoden getrennt bewerten. Keine bestätigte Ursache, keine Serverreparatur und keine erneute Live-Prüfung beim Dokumentieren dieses Nachtrags. Nutzer/Kemal übernehmen Infrastrukturprüfung; Ergebnis anschließend hier ergänzen.

**04.10.2026 ~21:40 UTC — GELÖST (Kemal + Claude, Server lesend und schreibend geprüft).**

*Ursache (gemessen, nicht mehr Hypothese):* Die Root-Platte des Betriebs-VPS war **zu 100 % voll** (38/38 GB).
Der nächtliche Host-Cron (Backup-Skript, 02:00 UTC) kopierte jede Nacht das komplette n8n-Datenverzeichnis
inklusive `binaryData/` (2,4 GB, wächst täglich ~100 MB) und behielt 8 Tage → ~20 GB. Der Lauf am
**03.10. 02:00** füllte die letzte Lücke; das `calendar-api`-Log endet um 02:01. Danach konnte Docker im
Container nicht einmal den Healthcheck ausführen (`OCI runtime exec failed … no space left on device`,
FailingStreak 2558) → Status `unhealthy` → Traefik nimmt ungesunde Container aus dem Routing → `/api/*`
fiel auf den n8n-Router (nur `Host`) → n8n-HTML bzw. 404. Watchtower, mail-db und uptime-kuma waren aus
demselben Grund `unhealthy`.

*Nicht* die Ursache: Code/Image `0260612` (startet lokal sauber), Migration 0058/0059 (auf SaaS läuft der
Runner nicht, `praxura_migrations` hat nur 0000/0005), Traefik-Labels (Repo-Regel korrekt, Container wurde
ohne Label-Änderung wieder geroutet).

*Behebung:* systemd-Journal geleert, ungenutzte Images entfernt (1,3 GB), der abgebrochene Backup-Ordner vom
03.10. und die drei ältesten (25.–27.09.) gelöscht → 11 GB frei. `calendar-api` wurde **ohne Neustart** von
selbst wieder `healthy`. Nachweis: `GET /api/krankenkassen` → `200 application/json`.

*Dauerhaft (gegen Wiederholung):* Backup-Skript neu (alte Fassung als `.bak-20261004` auf dem Host):
`binaryData/` und n8n-Eventlogs ausgeschlossen, Aufbewahrung 5 statt 8 Tage, alte Stände werden **vor**
dem neuen Lauf gelöscht, bei ≥ 85 % Plattenbelegung wird das Backup übersprungen und eine Warnung
geloggt. Probelauf: 147 MB statt 2,5 GB, Platte 61 % (pendelt sich nach Auslaufen der alten Stände bei
~40 % ein). Journal dauerhaft auf 300 MB begrenzt. Details/Befehle: `INFRASTRUCTURE.md` (nicht im Repo).

*Offen:* Kein Alarm bei voller Platte (uptime-kuma selbst `unhealthy`) → Ops-Dashboard, Kategorie Teknik.
Live-Abnahme M1 (§6) und Prüfung der laufenden Backend-Revision gegen `main` jetzt wieder möglich.

## Verweise

- `fortschritte/2026-10-03.md` → Abschnitt „Live-Betriebsbefund nach Push"
- `api-backend/docker-compose.yml` (Traefik-Labels, Kommentare zu Drift)
- `CLAUDE.md` → „Mimari" und „Deployment"
- `tools/check-vps-drift.sh`
- `KUTU_HAZIRLIK_SPRINT.md` (M1, K3)
