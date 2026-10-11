# Kemal — vollständige M3-/M4-Codeübergabe

Stand: **08.10.2026**. **Vollständiger Code auf main veröffentlicht: `a227e4c`. Frontend-/Backend-Imagepipelines und beide Vercel-Deployments PASS.** Auftrag von Melih: vollständigen Fortschritt committen und auf `main` veröffentlichen, damit Kemal seinen Teil fortführen kann.

## Was jetzt übernommen wird

**Vollständiger M3-/M4-Code, Vendor-Bibliotheken, Fixtures, Tests und Konfiguration sind mit Remote `39f54b2` einschließlich O-178 und SBOM-Korrektur integriert.** Der frühere reine Dokumentationspush `71dce32` wird damit durch eine tatsächliche Codeübergabe ergänzt. Auf einem sauberen Checkout erhält Kemal diese Arbeit mit `git pull --ff-only`. Vorher eigene Änderungen sichern/abstimmen; kein pauschales Reset oder Überschreiben.

Der ursprüngliche gemeinsame Checkout wurde erhalten. Integration und Prüfung erfolgten separat unter `/Users/melihdonmez/.codex/worktrees/m3-m4-integration-20261008`; keine fremden Arbeitsdateien, privaten Zugangsdaten oder Sicherheitsregister in den Commit übernommen. Original-KBV-PDF/TXT bleiben wegen ungeklärter Weitergaberechte lokal; Quellenmetadaten und Versions-/Kapitelbelege werden mitgeliefert.

Kemals neue Setup-/Zertifikats-/Kong-Änderungen und `start.mjs` sind erhalten. Boxstart: **zwei `node:cluster`-Worker**, kein Rückschritt auf alten PM2-Image-CMD. Gemeinsames privates `ki_freigaben`-Volume; `kimlik` read-only. M3 benötigt keine neue Business-DB-Migration.

## Frische Integrationsprüfung

| Prüfung | Status | Ergebnis / Grenze |
|---|---|---|
| Gesamtsuite | PASS | 3196/3196: Frontend1804, Backend1204, Tools188; 0 Fehler, 0 übersprungen. |
| Bestehender Zentraldienst | PASS | 49/49; kein echter KI-Jetonausstellernachweis. |
| Browser-Probesuite | PASS | Vollständiger Lauf auf HTTP-Dateien dieses Integrationscheckouts; Bytevergleich zentraler Module bestätigt. |
| M4-/M3-Probe | PASS | 22/22 und39/39; keine fremden Origins/Netzwerkschreibzugriffe. |
| Tatsächlicher Vollbackend | PASS | 14/14 HTTP-Prüfungen mit isolierter Auth/DB, synthetischen Konten und tatsächlichem `start.mjs` mit zwei Workern. |
| Typecheck / Karten | PASS | Typecheck; 3329 Funktionen/409Dateien; Tabellenkarte96/96 registriert. |
| Lokaler Backendbuild | PASS | Tatsächliches Dockerfile, ARM64 Node22; Lizenz-/SBOM-Prüfung, frische Volumes, Prozesssmokes 9/9 und Zwei-Worker-Start PASS. CI/Live gesondert prüfen. |
| Freitextqualität | FAIL | Bestehender unabhängiger Cold-Befund36/156; keine Neuauswertung als ungesehener Satz. |
| Reale Anbieter-/Rechts-/Produktionsabnahme | NICHT GEPRÜFT | Gesonderte Nachweise fehlen. |

Unabhängige Funktions-, Betriebs-, Quellen- und Code-Reviews; 341 relative Imports ohne fehlendes Ziel. Playwright-Range aus Remote bewahrt. Manifest aus aktueller Bundleliste neu erzeugt (**20 Dateien**, nicht historisch19).

Der KI-Kern hat gegenüber dem Cold-Freeze keine funktionalen Änderungen; nach finaler Diffprüfung wurden ausschließlich nachgestellte Leerzeichen entfernt. `server.js` und `dashboard.js` enthalten zusätzlich Hat-K-Ergänzungen. Die Provenienzmap nennt alle Byteabweichungen ausdrücklich. Neuer Digest `55a7b05fdffae7c344f24e0995e8a36d87806bf8793c886fc73e32b42c23d0d3`; Herkunft: `spike/ki-maske/2026-10-08-m4-integration-provenance.json`. Frühere3117-Test-/PM2-Angaben sind historische lokale Nachweise.

## Kemals nächste Arbeit

K2b.7a/7b sind laut neuerem Sprint bereits umgesetzt. **Nicht erneut beginnen.** O-178/K2b.16 „Über diese Software“ wurde von Kemal mit ff7e29a bereits veröffentlicht und ist in dieser Integration erhalten. Aktuelle Fortsetzung: offene ORG-/Rechtepunkte, Geräte-/Boxprüfungen gemäß §5b und der unten beschriebene Merkez-/KI-Jetonvertrag. O-179 Phase2/T20 betrifft SaaS-VPS und braucht Kemals gesonderte Freigabe.

Merkez-/KI-Jetonvertrag lokal weiterführen: signiertes `POST /v1/ki/jeton` über vorhandene Boxidentität. Antwort `{token, exp, endpoint, deployment, region, apiVersion, acknowledgedReportId?}`; UNIX-`exp`, TTL maximal3600Sekunden. Zwei unabhängige Worker-Caches berücksichtigen; Berichte über `reportId` idempotent verarbeiten und nur exakt passende Quittierung akzeptieren. Keine Prompts, Rohtexte oder Patientendaten an Merkez. Aggregate sind keine garantierte Abrechnung/Budgetabschaltung.

Vor neuen Funktionen Funktionsmeister, vor Schemaannahmen DB-Meister konsultieren. Onprem-/Sicherheitsreview gemäß Projektregeln. Schnittstellenvertrag: `api-backend/ai/M4-VERTRAG.md`; Sprint: `KUTU_HAZIRLIK_SPRINT.md`.

## Aktivierungs- und Abnahmegrenzen

**KI bleibt ausgeschaltet:** `AI_MODE=aus`; Betreiber-/Mail-/Freitextflags standardmäßig0. Owner-Opt-in aktiviert nichts allein. Imagegebundene Providerhostliste leer; keine reale Anbieteraktivierung. OCR/C gesperrt; Jeton ausschließlich erlaubte A-Strukturen. Freitextqualität FAIL und NO_NER bleiben bestehen.

Code-Push löst bestehende Frontend-/Image-Pipelines aus. Erfolgreicher Push ist kein Beweis erfolgreicher CI, Deployment oder funktionierender Live-App. Diese Zustände separat prüfen; keinen produktiven Daten-/Providerzugriff auslösen. Keine K3-Gesamtabnahme oder allgemeine Freitext-/Produktionsfreigabe.

QA: `wissensbank/sitzungen/2026-10-08_m4-qa-bericht.md`. Fortschritt: `wissensbank/sitzungen/2026-10-08_m4-fortschritt-und-kemal-uebergabe.md`. Browserauftrag: `CHROME-M4-TEST.md`. Private lokale Testzugänge werden nicht veröffentlicht; Kemal benötigt eigene isolierte synthetische Testumgebung.

## Veröffentlichungsnachweis

GitHub-main enthält Codecommit `a227e4cb3297bfae099cf7a09c14896f90b6d2e1`. Frontend-Imagepipeline [37825917725](https://github.com/ironkemal/infinitymade-website/actions/runs/37825917725) und Backend-Imagepipeline [37825917736](https://github.com/ironkemal/infinitymade-website/actions/runs/37825917736) abgeschlossen mit PASS. Beide Vercel-Commitstatus erfolgreich. Auf app.praxura.de wurden ki-client, rezept-barcode-scan, modal-escape, PDF.js, ZXing und Lizenzbericht bytegenau gegen Commit geprüft (PASS). Öffentliche Backend-Versionsroute /api/ueber meldet `0.4.0+a227e4c` (PASS). Das belegt ausgelieferten Stand, keine vollständige produktive Ablauf-/DB-/KI-Abnahme. KI bleibt aus; Kemal kann die dokumentierten offenen Arbeiten fortführen.
