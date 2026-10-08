# M4 — lokaler QA-Bericht und Freigabegrenzen

Stand: **08.10.2026**. Repo: `/Users/melihdonmez/infinitymade-website`. Grundlagen: [[2026-10-07_m4-analyse-und-plan]], `konsey/tutanak/2026-10-08-m4-optin-lokal.md`, K-20 und `compliance/LEGAL_DECISIONS.md`, Nachtrag (4).

Fortschritt und Wiederaufnahme: [[2026-10-08_m4-fortschritt-und-kemal-uebergabe]]. Aktuelle Fortsetzung nach Remote-Abgleich steht dort; früherer K2b.7a-Auftrag ist überholt.

## 1. Management-Zusammenfassung

Lokale Implementierung und Regression abgeschlossen: **3117/3117 Tests**, M4-Browserprobe **22/22**, M3-Regression **39/39**, lokaler Vollbackend **14/14 HTTP-Prüfungen**. Standardzustand bleibt aus; Owner-Opt-in ersetzt keine Betreiberfreigabe. Strukturierte A-Daten und Jeton-B-Sperre bestehen die abgegrenzten synthetischen Gatewaytests. Keine produktiven Schreibzugriffe und keine Aufrufe eines echten KI-Anbieters.

**Freitextqualität: FAIL.** Eingefrorener Maskierungskern lässt im unabhängigen Cold-Korpus 36 von 156 annotierten Identifikatoren passieren (23,08 %); unter tatsächlich gesendeten Truth-Items 36/151 (23,84 %). Gate ≤2 % verfehlt. NER-Kandidat wegen Qualitäts- und Alpine-Betriebsfehlern nicht übernommen (**NO_NER**). Freitext bleibt standardmäßig gesperrt. Lokaler Abschluss ist keine uneingeschränkte M4-, Box-, Anbieter-, Rechts- oder Produktionsfreigabe.

## 2. Testumfang und Abgrenzung

Geprüft: Konfiguration, Owner-/Employee-Grenzen, Maskierung/Restore, Task-/Ausgabeschemata, Rückfragen, Transport mit Fakeanbieter/-zentrum, Logschutz und deutsche UI. Ausschließlich synthetische Korpora und Konten. Neue isolierte lokale Supabase-Instanz mit fünf Diensten und **72 bestehenden Migrationen**; GoTrue und PostgREST tatsächlich benutzt. Lokale Auth-/Profil- und Opt-in-Schreibzugriffe betreffen nur diese Testumgebung.

Native T3-Browserprüfung: `http://localhost:8081/dashboard.html`. M4-Probe: `http://localhost:8081/tools/browser-probe/ki-probe.html`. M3-Probe separat. Prozessprüfungen lokal und in Node-22-Alpine-Containern. Kein physischer Box-, HTTPS-Handykamera- oder realer PM2-Ressourcennachweis.

Pro Testfall ausschließlich **PASS**, **FAIL**, **NICHT GEPRÜFT**. PASS gilt nur für benannten Gegenstand. Erfolgreiche Blockierung, lokale Builds und Fakes beweisen keine Eigenschaften echter externer Dienste.

## 3. Ergebnisübersicht

| Prüfung | Status | Ergebnis und Grenze |
|---|---|---|
| Finale lokale Gesamtsuite | PASS | 3117/3117: Frontend 1793, Backend 1182, Tools 142; 0 FAIL, 0 übersprungen. |
| Typecheck, Funktionskarte und Diffprüfung | PASS | Konfigurierter Typecheck; Karte frisch: 3192 Funktionen / 388 Dateien; `git diff --check` ohne Befund. |
| M4-Browserprobe | PASS | 22/22; 0 Fehler, Konsolenfehler, fremde Origins und Netzwerk-Schreibzugriffe. |
| Dashboard: Login, Owner-Opt-in, erneutes Lesen, Widerruf | PASS | Tatsächliche lokale Antworten 200; `active=false` bleibt bei ausgeschalteten Betreiber-/Modusgates erhalten. |
| Vollbackend mit echter lokaler Auth/DB | PASS | 14/14 HTTP-Prüfungen; Owner, Employee, Ausmodus, OCR-Sperre und Fehlerbehandlung. |
| Prozessübergreifender Freigabe-/Rückfrageschutz | PASS | Je 3 Tests, zehn lokale und zehn Alpine-Läufe bestanden; kein realer Box-SLO. |
| Backendbuild und lokales Onprem-Packaging | PASS | ARM64-Build; Manifest-/Packaginggate geprüft; 19 Manifestdateien. Kein Deployment. |
| Vollständige Browser-Probesuite | PASS | `npm run probe` vollständig mit Exit 0; lokale synthetische Modul-/Layout-/Workflowprüfungen, keine Live-Abnahme. |
| Bestehender Zentraldienst-Testumfang | PASS | `npm run test:merkez`: 48/48; zunächst fehlende lokale Express-Abhängigkeiten, nach `npm ci --prefix merkez --ignore-scripts` aus vorhandenem Lockfile erfolgreich. Keine Quell-/Lockfileänderung oder echte Jeton-/Zentrumsfreigabe. |
| Frisches Consent-Volume im ARM64-Image | PASS | Nicht-Root, Named Volume neu erstellt, Opt-in schreiben/widerrufen, 0700/0600; Schreibversuch auf read-only `kimlik` abgewiesen. Nur eigene Testvolumes anschließend entfernt. |
| Lokale Testdienste nach Neustart | PASS | `/health` und `/health/ready` 200; lokale Zugangsdaten/.env einschließlich kodiertem Privatpfad über HTTP 403. Testserver dauerhaft lokal gestartet; Start/Stop unter `.local-m4-work/README.md`. |
| M3-Browserprobe | PASS | 39/39; 0 Fehler, fremde Origins, Schreibzugriffe und PDF-Fontwarnungen; 5 erfolgreiche lokale Fontrequests. |
| Korpus1: Maskierung/Restscan | PASS | 0/151 effektive Lecks, 150 gesendete Truth-Items, 1/60 Fälle blockiert. |
| Korpus2: Freitextgate ≤2 % | FAIL | 15/139 effektive Lecks (10,79 %); gesendet 15/89 (16,85 %). |
| Cold: Freitextgate ≤2 % | FAIL | 36/156 (23,08 %), gesendet 36/151 (23,84 %); 1/42 Fälle blockiert. |
| Cold: Negativfälle und Roundtrip | PASS | 0/14 negative Fehlalarme; keine Verarbeitungs-/Roundtripfehler. |
| Cold: erlaubte A-Struktur am Fake-Gateway | PASS | 42/42 erfolgreich; 0 Roh-PII-Lecks, 0 echte Anbieteraufrufe. |
| Cold: Jeton-B-Sperre | PASS | 42/42 abgewiesen, 0 Transportaufrufe. |
| NER: Korpus2-Qualität | FAIL | 4/139 effektive Lecks (2,88 %), 6/7 negative Fehlalarme. |
| NER: unverändertes Alpine-Ziel ARM64/AMD64 | FAIL | ONNX-Import: fehlender glibc-Loader. |
| CI, physische Box, echter Anbieter, externe Rechtsfreigabe | NICHT GEPRÜFT | Separate Nachweise erforderlich. |

## 4. Detaillierte Testergebnisse

### Standardzustand, Datenklassen und Transport

`AI_MODE=aus` priorisiert Legacykonfiguration. Operator-, Mail- und Freitextflags strikt und standardmäßig aus. A-Felder folgen geschlossenen Taskverträgen; Leistungs-/Terminwerte werden lokal eingesetzt. Zusätzliche Felder und ungültige Katalogpositionen scheitern vor Transport. Jeton akzeptiert kein B und kein C. OCR-Upload wird vor Bildverarbeitung/Storage-Schreiben mit `AI_OCR_DISABLED` abgewiesen; lokale M3-Barcodes bleiben getrennt.

Timeout, Tokenwartezeit, 401-/429-Wiederholung, Host-/Redirectgrenzen und `store:false` werden mit Fakes geprüft. Owner-/Betreiberfreigaben werden unmittelbar vor jedem Sendeschritt neu gelesen. Echte Azure-Ressource, Region, Deployment, RBAC und Aussteller-TTL bleiben ungeprüft; leere imagegebundene Hostliste verhindert reale Aktivierung. Aggregierter Verbrauch ist Information, keine garantierte Abrechnung oder Budgetabschaltung.

### Owner-Opt-in und Rückfragen

Eigenes Named Volume `ki_freigaben`, Mount `/var/lib/praxura/ki-freigaben`, außerhalb Webroot; Verzeichnis 0700, Dateien 0600. `kimlik` bleibt read-only. Keine neue `profiles`-Spalte oder Business-DB-Migration. Entscheidung an Owner/Praxis/Box/Textversion gebunden; beschädigter, fehlender oder fremder Zustand führt zu aus. Lokaler Employee-Lese-/Schreibversuch auf Owner-Konfiguration: 403.

Persistiert: Freigabemetadaten und kurzlebige verbrauchte HMAC-/Ablaufmarker. Keine Prompts, Patientendaten, Zuordnungsmaps oder Anbieter-/Entra-Tokens. Getrennte Prozesse prüfen frisches Lesen und Einmalverbrauch. Neue Box benötigt neue Entscheidung; kein übertragbares Freigabebackup.

### Browser und Build

M4-Probe prüft unter anderem strikte Serverflags, Rückfragebindung, Escape/Abbrechen/X, Ablauf, Quelländerungen, Auth-Wiederholung und Textausgabe ohne HTML-Injektion. Echtes lokales Dashboard: synthetischer Owner-Login, Opt-in, erneutes Lesen und Widerruf. Keine fremden Origins; keine Browserfehler **ab Anbringen der Testhooks**. Kein pauschaler Beweis einer fehlerfreien Dashboard-Konsole seit Seitenstart.

Backendbuild und Manifest wurden lokal geprüft, ohne Commit/Push/Deployment. Dashboard-Größengate bestanden: 18.979 → 18.858 Zeilen. Funktionskarte generiert, nicht manuell gepflegt.

### Maskierung und Cold-Methode

Quellen: `spike/ki-maske/2026-10-08-m4-runtime-korpora.json`, `2026-10-08-m4-cold-messbericht.json`. Eingefrorener Kerndigest: `1eb8c0ebe1f88852c4d21abf8a76a5a49d054af827e7118e2d2682155702f5bb`; nach Cold unverändert überprüft.

| Korpus | Fälle / Truth | Rohlecks | Effektive Lecks | Gesendete Truth | Blockierte Fälle | Negative Fehlalarme |
|---|---:|---:|---:|---:|---:|---:|
| Korpus1 | 60 / 151 | 0 | 0 | 150 | 1 | 0; keine Negativfälle |
| Korpus2 | 50 / 139 | 31 | 15 | 89 | 14 | 1/7 |
| Cold | 42 / 156 | 40 | 36 | 151 | 1 | 0/14 |

Alle drei Messungen ohne Verarbeitungs-/Roundtripfehler. Rohlecks: Maskierung vor Sperre. Effektive Lecks: verbleibende Truth-Items in nicht blockierten Fällen. „Gesendet“ bezeichnet den Benchmark-/Fake-Transportnenner; **kein echter Anbieter erhielt Texte**. Blockierung wird nicht als allgemeiner Qualitäts-PASS ausgegeben.

Cold: 28 positive, 14 negative Fälle, vier lange Texte. SHA-256 `34909b0efe921e065c841b344a99a7e2e77fa91ed5e75fe4beaf2fb7b594f90b`. Unabhängiger Codex-Agent erzeugte Satz ohne Runtime-/Alt-Korpus-/Quellenzugriff. Gemini wegen Kontingenterschöpfung nicht verfügbar; Providerwechsel offengelegt. Ursprünglicher Gemini-Cold-Satz beim Umgebungsneustart vor Auswertung verloren.

Methodische Grenze: Erste Maskenauswertung lief, anschließende falsche Harness-Erwartung brach vor Berichtsspeicherung ab. Zu langes B-Payload wurde korrekt mit `KI_SCHEMA` abgewiesen. Gespeicherter Bericht: **Ausführung 2 derselben eingefrorenen Runtime**, ohne Cold-Anpassung (`firstEvaluation=false`). Kein vorgetäuschter einmaliger Erstlauf. Formatadapter für `{version,cases}` wurde vor erster Maskenauswertung korrigiert. Nach Einsicht dient Cold als Regression; spätere Qualitätsfreigabe braucht neuen unabhängigen Satz. Drei gepinnte Korpora sind jetzt in lokaler Testsuite verdrahtet; diese Regression bewahrt Befunde und erklärt Freitext-FAIL nicht zum PASS.

### NER

**NO_NER.** Kandidat `Xenova/bert-base-multilingual-cased-ner-hrl`, Revision `263e82c06569c8c2ac46238a7ae5107598934234`, q8; Lockfile/Hashmanifest vorhanden. Qualität und unverändertes Alpine-Ziel scheitern. Kein Modell im Produktimage.

Native macOS-Referenz: Laden 440 ms, Peak-RSS 491,8 MiB, Korpus2 p95 114,4 ms; keine Box-/PM2-SLOs. Oracle-/Benchmarktests 13/13, zehn ursprüngliche Wiederholungen grün und späterer lokaler Wiederholungslauf grün. Auslieferungslizenz und reale Box-Ressourcen nicht freigegeben.

## 5. Gefundene Fehler und Reproduktion

| Befund | Status | Reproduktion / Nachprüfung |
|---|---|---|
| Freitext verfehlt Qualitätsgate | FAIL | Eingefrorenen Kern mit annotiertem Cold prüfen: 36/156 effektive Restlecks. Keine Anpassung an Cold. |
| NER-Qualität und Alpine-Import | FAIL | Festes Modell auf Korpus2/im unveränderten Alpine-Ziel ausführen; Messbericht/README dokumentieren Befehle. |
| Widerruf während Tokenwartezeit konnte Transport erreichen | PASS | Während `getToken` widerrufen; Regression verlangt 0 Transportaufrufe. Frische Prüfung vor jedem Sendeschritt ergänzt. |
| Rückfrageprojektion verlor Kandidatentyp | PASS | Backend-Rückfrage durch UI-Vertrag validieren; begrenztes `type` wird weitergegeben. |
| B2B-UI: `company_name` statt Taskfeld `company` | PASS | Nicht leere Kontaktauswahl durch Taskvertrag; UI-Mapping korrigiert. |
| Rezeptposition `x` akzeptierte beliebigen Rohtext | PASS | Rohtext-Sentinel einsetzen; geschlossenes Katalogschema weist vor Transport zurück. |
| Nullable Kontakt-/Inhaberfelder verletzten Mailvertrag | PASS | Tatsächliche null-Felder in B2B/B2C prüfen; Mapping und Regression ergänzt. |

PASS bei behobenen Fehlern bedeutet bestandene gezielte Regression. Weitere Reviewkorrekturen sind in technischen Testdateien belegt; keine erfundenen Fehlerfälle. Der Harness-Abbruch bei Cold war eine falsche Test-Erwartung, kein nachgewiesener Produktfehler.

## 6. Nicht geprüfte Bereiche und Blocker

| Gegenstand | Status | Fehlender Nachweis |
|---|---|---|
| CI | NICHT GEPRÜFT | Lokaler Lauf ersetzt CI nicht. |
| Physische HTTPS-Box, Handy-/Rezeptkamera | NICHT GEPRÜFT | Freigegebene Box, synthetische Daten, reales Gerät. |
| PM2-Zweiworker unter Boxlast, RAM/CPU/Offline-SLO | NICHT GEPRÜFT | Container-Prozesstests ersetzen keinen Betriebslasttest. |
| Azure-Host/Region/Deployment/RBAC/TTL | NICHT GEPRÜFT | Tatsächliche Ressource und Ausstellervertrag. |
| Hat K: Jeton, Quote/Budget/Aggregatquittierung | NICHT GEPRÜFT | Fakes/Best-effort-Audit ersetzen Zentralvertrag nicht. |
| Microsoft/Anwalt, C5-Scope/Bridge Letter/Product Terms/AVV | NICHT GEPRÜFT | Bestehende Reihenfolge vor Praxisaktivierung, Mail und bezahltem Einsatz. |
| Produktive Speicherung/Kundenworkflow | NICHT GEPRÜFT | Kein produktives Ziel verwendet. |

## 7. Risikoabschätzung

**Hohes Restrisiko bei Freitextaktivierung:** Cold widerlegt ausreichende allgemeine Maskierungsqualität. Opt-in und Rückfragen beseitigen Restlecks nicht. Default aus, Jeton A-only und C-Sperre begrenzen vorgesehenen Betrieb. Direkter B-Ausnahmeweg braucht gesonderte fachliche/rechtliche Freigabe und tragfähigen Qualitätsnachweis.

A-/Sperr-/Tenant-/Transporttests zeigen gute lokale Abdeckung. Kleine synthetische Sätze, Fakes und Containerverhalten beweisen keine allgemeine Anonymisierung oder reale Produktions-/Anbietersicherheit.

## 8. Konkrete nächste Schritte

1. KI standardmäßig aus lassen; keine Freitextfreigabe aus technischen PASS-Zählern ableiten.
2. Freitextstrategie wegen Cold-FAIL neu entscheiden; später neuen unabhängigen Cold-Satz prüfen, alten als Regression behalten.
3. Freigegebene isolierte HTTPS-Box: Chrome/Geräte, zwei PM2-Worker, Neustart, beschädigte/fremde Freigaben und Ressourcengrenzen prüfen. Auftrag: `CHROME-M4-TEST.md`.
4. Azure-/Hat-K-Ressource, Hostliste, Auth-/TTL-/Quote-/Budgetvertrag und Aggregatquittierung separat nachweisen.
5. Microsoft-/Anwalts-/Vertragsauflagen erfüllen; danach konkrete Praxis-/Mailaktivierung bewerten.

## 9. Freigabeempfehlung und Vorgehensbewertung

Lokale Implementierung und abgegrenzte Regression abgeschlossen. **Keine Freigabe für allgemeine Freitextverarbeitung, reale Anbieteraktivierung oder Produktion.** M4-Abschluss gilt ausschließlich lokal, mit dokumentierten Qualitätsfehlern und offenen Aktivierungsgates.

### Erneute Prüfung und Kemal-Übergabe am 08.10.2026

Auf Melihs Auftrag erneut ausgeführt: Gesamtsuite **3117/3117**, vollständige Browser-Probesuite, Merkez **48/48**, isolierter Vollbackend **14/14**, Typecheck, Funktionskarte, Diff und Packaging: **PASS**. Backend `/health` und `/health/ready` erneut 200; private Frontendpfade einschließlich kodierter Variante und `.env.local` erneut 403. Packaging über eigenen temporären Git-Index; tatsächlicher Index unverändert.

Unabhängiges Code-Review und Betriebsreview: kein neuer lokaler Übergabeblocker im geprüften Umfang. Echte B2B-/B2C-Funktionen mit synthetischen null-Feldern unabhängig **2/2 PASS**, ohne Netzaufrufe. **37 aktuelle Quelldateien** und Digest `1eb8c0ebe1f88852c4d21abf8a76a5a49d054af827e7118e2d2682155702f5bb` unabhängig identisch bestätigt. Kein neuer Cold-Lauf und keine Runtime-Anpassung. Zwei Dokumentationsaussagen präzisiert: versioniertes boxgebundenes Opt-in statt unbelegter revisionssicherer Historie; geschlossene Modellliste statt alter Regexbeschreibung.

**Kemal für lokale Hat-K-Weiterarbeit freigegeben**, erster Auftrag **K2b.7a**; konkrete Übergabe `KEMAL_M4_UEBERGABE.md`. Gemeinsamer Checkout bleibt gemischt und uncommittet; keine Veröffentlichung, kein VPS-Zugriff, keine externe Nachricht. Qualitäts-FAIL und externe Aktivierungsgates unverändert. K3 und produktiver KI-Betrieb bleiben ohne Freigabe.

Plan P0–P5 mit Agententeam und Skills für Architektur, Teststrategie, Code-Review und Konsey bearbeitet. Anfängliche Gemini-Umsetzung erforderte mehrere Vertrags-/Sicherheitskorrekturen; unabhängiges Codex-Review und Retests notwendig. Nach Gemini-Kontingenterschöpfung verbleibende Arbeit offen auf Codex-Team umgestellt. Lokale Kontext-Bridge-Aufrufe ohne Provider und tatsächliche Gemini-Aufrufe getrennt. Gesamtproviderverbrauch nicht vollständig gemessen; **keine gemessene Netto-Tokenersparnis**.

Kein Commit, Push, Deployment oder produktiver Schreibzugriff.

## Veröffentlichungsabgleich

Dokumentationspaket auf Remote `4409428` aufgesetzt. Dort sind K2b.7a/7b bereits dokumentiert umgesetzt; aktueller Hat-K-Prompt nennt Rechte-/Lizenzklärung, O-178 und offene §5b-Prüfungen. Frühere K2b.7a-Empfehlung gilt nur für den damals gelesenen lokalen Checkout. Keine neuen Runtime-/Livetests beim Push. Alle M4-Testzahlen und der Freeze-Digest beziehen sich auf lokalen Stand `00c0a21`, nicht auf den neueren Remote-Code. Insbesondere der inzwischen dokumentierte Boxstart `start.mjs` erfordert bei späterer M4-Integration neue Betriebsprüfungen. Veröffentlicht wird Dokumentation; M4-Code bleibt uncommittet lokal.
