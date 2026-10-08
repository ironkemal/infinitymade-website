# Kemal — Freigabe zur lokalen Weiterarbeit nach M4

Stand: **08.10.2026**. Auftrag von Melih: erneute Prüfung, anschließend Kemal für Weiterarbeit freigeben.

## Entscheidung

**Kemals lokale Hat-K-Weiterarbeit ist freigegeben.** Beim Veröffentlichungsabgleich wurde der neuere Remote-Stand `4409428` gelesen: K2b.7a (`b3da84e6`) und K2b.7b (`82c30d7f`) sind dort bereits als umgesetzt dokumentiert. Der frühere Auftrag K2b.7a ist damit überholt; diese Arbeit nicht erneut beginnen.

**Aktuelle Fortsetzung laut Remote-Sprint:** K2b.16/ORG-Rechteklärung und O-178 „Über diese Software“ nach den dort genannten Rechte-/Sicherheitsentscheidungen; verbleibende Geräteprüfungen nach §5b. O-179 Phase 2/T20 betrifft den SaaS-VPS und bleibt an Kemals gesonderte Freigabe gebunden. Der Merkez-/KI-Jetonvertrag kann weiterhin lokal vorbereitet werden. Diese Remote-Angaben sind dokumentarisch abgeglichen, nicht in diesem Auftrag live nachgeprüft.

Diese Übergabe enthält **keine K3-Gesamtabnahme, Produktionsfreigabe oder Freigabe zur realen KI-Aktivierung**. VPS-Zugriff und Deployment bleiben außerhalb dieses Auftrags. ORG-Unterlagen können vorbereitet werden; externe Nachrichten wurden nicht versendet.

## Erneut geprüfter lokaler Stand — vor Remote-Integration

Repo: `/Users/melihdonmez/infinitymade-website`, Branch `main`, HEAD `00c0a216f0fee730bc5b9d76b9b43277cdd1a393`.

Der geprüfte M4-Runtime-Stand liegt weiterhin **lokal und uncommittet** auf Basis `00c0a21`. Dieses Dokumentationspaket wird getrennt auf den neueren Remote-Stand aufgesetzt; es enthält keine M4-Runtime-Dateien. Die veröffentlichten Dokumente machen M4-Code weder verfügbar noch deployt. Ein anderer Checkout erhält diesen Stand nicht durch `git pull`. Gemeinsamer Checkout enthält außerdem M3- und fremde Änderungen; Änderungen zuerst nach Verantwortlichkeit und bei gemischten Dateien nach Hunks prüfen. Kein pauschales Staging, Überschreiben oder Zurücksetzen.

| Prüfung vom 08.10.2026 | Status | Nachweis / Grenze |
|---|---|---|
| Gesamtsuite erneut | PASS | 3117/3117: Frontend 1793, Backend 1182, Tools 142; keine Fehler oder übersprungenen Tests. |
| Browser-Probesuite erneut | PASS | `npm run probe`, Exit 0; synthetische lokale Browserprüfungen. Separater M3-Lauf 39/39. Kein physischer Chrome-/Box-Gerätenachweis. |
| Bestehender Zentraldienst erneut | PASS | 48/48; beweist keinen realen KI-Jetonaussteller. |
| Vollbackend erneut | PASS | 14/14 lokale HTTP-Prüfungen mit isolierter echter Auth/DB und synthetischen Konten. |
| Typecheck, Funktionskarte, Diff | PASS | Typecheck Exit 0; Karte 3192 Funktionen / 388 Dateien; `git diff --check` ohne Befund. |
| Packaging und Dashboard-Größengate erneut | PASS | 19 Manifestdateien; Prüfung über separaten temporären Git-Index. Echter Git-Index bleibt unverändert. |
| Backend und privater HTTP-Zugriff erneut | PASS | Backend `/health` und `/health/ready` 200; private Pfade einschließlich kodierter Variante und `.env.local` über Frontend 403. |
| Unabhängiges Runtime-Review | PASS | Kein neuer lokaler Übergabeblocker im geprüften Umfang; echte B2B-/B2C-Funktionen mit null-Feldern 2/2, ohne Netzaufrufe. |
| Unabhängige Freeze-Prüfung | PASS | 37 Dateien und Map-Digest unverändert: `1eb8c0ebe1f88852c4d21abf8a76a5a49d054af827e7118e2d2682155702f5bb`. |
| Unabhängige Prüfung dieser Übergabe | PASS | Betriebsagent bestätigt Arbeitsreihenfolge, Freigabegrenzen, TTL-/Worker-Vertrag und Schutz des gemischten Checkouts. |
| Freitextqualität | FAIL | Bestehender Cold-Befund 36/156 Restlecks (23,08 %); nicht erneut als ungesehener Satz ausgewertet. |
| NER-Übernahme | FAIL | Qualitätsgate und unverändertes Alpine-Ziel verfehlt; Entscheidung NO_NER bleibt. |
| Reale Box, Anbieter, Rechtsfreigabe, Produktion | NICHT GEPRÜFT | Separate Nachweise fehlen. |

Code-Review- und Betriebsagent unabhängig eingesetzt; Skill `engineering:code-review` angewendet. Zwei Dokumentationsreste korrigiert: keine unbelegte „revisionssichere“ Opt-in-Historie; Modellmetadaten entsprechen geschlossener Runtime-Liste. Runtime unverändert. Aktuelle Nachprüfung verwendete keine Gemini-Aufrufe; frühere Gemini-Kontingentsperre und deklarierter Codex-Ersatz sind im QA-Bericht dokumentiert. Keine gemessene Tokenersparnis behauptet.

## Historische K2b.7-Reihenfolge — im Remote bereits umgesetzt

Die folgende Detailfolge gehörte zur Prüfung des älteren lokalen Checkouts. Für neue Arbeit gilt der oben ergänzte Remote-Abgleich und der aktuelle Sprintprompt; keine Doppelimplementierung.

1. **K2b.7a umsetzen.** In `api-backend/setup/router.js` gemeinsamen Abschlussriegel setzen: Bei `abgeschlossen_am` darf ausschließlich `GET /status` weiterlaufen; alle anderen Setup-Routen antworten 410. Alle vorhandenen Routen und eine nachträglich ergänzte Route testen.
2. **Setup-Token absichern.** `SETUP_TOKEN_SEIT` als Epoch; Frist 14 Tage. Bestehende Kompatibilitätsregel ohne SEIT gemäß Sprint beibehalten. `install.sh --neuer-jeton` nur vor abgeschlossenem Setup, neue Zeit setzen und API neu erstellen. Link einmalig sicher anzeigen. Gemeinsame Cleanup-Funktion in Installation/Update: DB-Status intern lesen; bei Lesefehler nur warnen, Token behalten; bei Abschluss beide Variablen leeren. Rollback darf den DB-Abschlussriegel nicht aushebeln.
3. **Setup- und Auth-Oberfläche schließen.** Setup-Status-404 bei nicht gemountetem Router zur Login-Ansicht führen. Caddy blockiert `/auth/v1/admin*`, `/auth/v1/signup`, `/auth/v1/invite` extern mit 404; interne API-Wege getrennt prüfen. Quelle und bestehender Beschluss: `KUTU_HAZIRLIK_SPRINT.md`, §6 „K2b devam“.
4. **K2b.7b messen.** Passwortlogin auf lokalem GoTrue mit echten, getrennten Client-IP-Adressen und von Caddy überschriebenem IP-Header prüfen. Erst danach GoTrue-Konfiguration oder fest gepinntes Caddy-Modul auswählen. Kein bisher ungeprüftes Rate-Limit als wirksam markieren.
5. **Weitere Hat-K-Arbeit.** K2b.15-Rest und K2b.8 Teil 2 abarbeiten; reale Linux-/WSL-/Windows-/LAN-Prüfungen vorbereiten. K2b.16-Lizenz erst nach bestehender Rechteklärung ändern. Merkez-Jetonvertrag lokal mit Fakes implementieren und testen. VPS-abhängige Punkte bleiben offen.

Vor neuen Funktionen `fonksiyon-ustasi`, vor Schemaannahmen `db/README.md` und `db-ustasi` konsultieren. Onprem vor Änderungen konsultieren, anschließend Absicht/Ergebnis melden; öffentliche Box-Schnittstellen zusätzlich Sicherheitsreview. Hat M verantwortet KI-Kern und Frontendmodule; gemischte Dateien wie `server.js` und `dashboard.js` abgestimmt nach Hunks bearbeiten.

## Verbindlicher M4-/Merkez-Vertrag

- KI bleibt aus: `AI_MODE=aus`, `AI_ACTIVATION_READY=0`, `AI_MAIL_READY=0`, `AI_ALLOW_FREETEXT=0`. Owner-Opt-in allein aktiviert keine KI. Kein OCR/C; Jeton ausschließlich erlaubte A-Strukturen.
- Vorhandene Boxidentität und Signatur aus `merkez-istemci` wiederverwenden. Kein zweiter Schlüssel oder eigener Signaturpfad. Endpoint: signiertes `POST /v1/ki/jeton`.
- Antwort: `{token, exp, endpoint, deployment, region, apiVersion, acknowledgedReportId?}`. `exp` in UNIX-Sekunden, verbleibende TTL **höchstens 3600 Sekunden**. Älterer K-20-Text nennt 60–90 Minuten; Aussteller auf maximal eine Stunde abstimmen, Clientgrenze nicht ungeprüft erweitern.
- HTTPS, exakte imagegebundene Hostliste, freigegebene EU-Region und Deployment. Leere aktuelle Hostliste sperrt reale Anbieteraktivierung; nur anhand belegter Ressource ändern.
- Zwei Worker haben getrennte RAM-Caches. Aggregierte Berichte über `reportId` idempotent verarbeiten; nur exakt passende `acknowledgedReportId` quittiert. Keine Patientendaten, Prompts, Rohtexte oder Zuordnungsmaps an Merkez. Verbrauchsberichte sind keine garantierte Abrechnung oder Budgetabschaltung.
- Eigenes privates `ki_freigaben`-Volume erhalten: Verzeichnis 0700, Dateien 0600; API-Identitätsvolume `kimlik` bleibt read-only. Token/Maps bleiben RAM-only. Owner-/Betreiberfreigaben vor jedem tatsächlichen Sendeschritt neu prüfen.

## Vor späterer Betriebsfreigabe

K2b abschließen und Releaseintegration nachweisen. Danach getrennt prüfen: reale HTTPS-Testbox, Chrome-/Handygeräte, zwei PM2-Worker unter Boxlast, Widerruf/Neustart/Offlineverhalten, RAM/CPU und frische Volumes. Azure-/Entra-Ressource, Host/Region/Deployment/RBAC, Aussteller-TTL, Widerrufsgrenzen, Quote/Budget und Quittierung belegen. Microsoft-/Anwalts-/Vertragsauflagen aus §5 separat erfüllen.

Freitextstrategie wegen FAIL neu bewerten. Bekannten Cold-Satz als Regression behalten; spätere Qualitätsfreigabe braucht neuen unabhängigen Satz. Kein Aufdrehen von Freitext- oder Mailflags aus PASS-Testzählern. K3 erst nach tatsächlicher Erfüllung seiner Sprintvoraussetzungen, nicht wegen M4 `✅*`.

## Dateien zum Einstieg

- `KUTU_HAZIRLIK_SPRINT.md`: §0, §2, K2b, §3b.4, §5–7; diese Übergabe ergänzt den älteren K2b-Prompt für den aktuellen gemischten lokalen Checkout.
- `api-backend/ai/M4-VERTRAG.md`: technische Schnittstelle und Aktivierungsgates.
- `wissensbank/sitzungen/2026-10-08_m4-qa-bericht.md`: vollständige Nachweise, Qualitätsfehler und Grenzen.
- `CHROME-M4-TEST.md`: lokaler Browserauftrag. `.local-m4-work/README.md`: private lokale Testdienste; Zugangsdaten nicht in Chat, Berichte oder Screenshots kopieren.
- `onprem/REGISTER.md`, `compliance/TOM.md` §1.5, `compliance/LEGAL_DECISIONS.md`: Betriebs-/Rechtsgrenzen. Privates Sicherheitsregister bleibt außerhalb Veröffentlichung.

**Freigabe gilt für die beschriebene Weiterarbeit. Sie bestätigt keine erfolgte Benachrichtigung Kemals und keine externe Aktivierung.**
