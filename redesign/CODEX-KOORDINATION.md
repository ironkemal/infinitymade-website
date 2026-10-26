# Codex-Koordination: Praxura-Redesign V6.B

Stand: 26.10.2026. Diese Datei beschreibt ausschließlich Zuständigkeiten,
Backend-Vorbereitung und Übergaben dieser Arbeitskopie. Der bereichsübergreifende
Fortschritt bleibt in `redesign/STATUS.md` beim Integrator.

## Auftrag und Grenzen

Melih hat die Umsetzung aller Dashboardbereiche nach PLAN-V2 bis V9 beauftragt.
Seine ausdrücklich beantwortete Abschlussfrage gilt auch bei älteren Handoffs:
vollständig umsetzen und testen hinter `?design=neu`; kein Push auf `main`, keine
Standardumschaltung V10. Eine allgemeine Planfreigabe ist nicht erneut nötig.

Kein Zugriff auf Live-DB, keine Migration, keine Secrets oder `.env`-Dateien,
keine echten Patienten-/Kundendaten, keine Nachrichten, Zahlungen oder Löschungen.
Öffentliche Seiten, PDF-/Druck-/Belegvorlagen und Leistungsfarben bleiben außerhalb
dieser Backend-Spur. Bestehende Buchungsfehler werden nicht beiläufig korrigiert.

## Arbeitskopien und Dateibesitz

| Verantwortung | Ort / Zuständigkeit |
|---|---|
| Codex | Worktree `~/.t3/worktrees/infinitymade-website/redesign-praxura-codex-backend`, Branch `redesign/praxura-codex-backend`, Basis `dc134770` |
| Claude | Worktree `~/.t3/worktrees/infinitymade-website/redesign-praxura-design`, Branch `redesign/praxura-design` |
| Claude allein | Frontend, gemeinsame STATUS-Datei, Funktionskarte, Referenzbilder, Integration und Browser-Port 18081 |
| Codex zunächst | Eigene Koordination, unabhängige Prüfung, lokale Analyse und Ausgangstests |
| Produktiver Backend-Dateibesitz | Noch nicht bestätigt; vor Änderungen ausdrückliches Datei-ACK von Claude abwarten |

Haupt-Checkout niemals bearbeiten. Fremde Änderungen in Claudes Arbeitskopie
weder stagen noch committen, zurücknehmen oder überschreiben. Keine gegenseitigen
Neustarts/Unterbrechungen. Übergaben per `t3_thread_send`, `mode=queue`, an
`41dfb91a-9993-4695-a4df-427735fa1a15`.

## Vorbereitung und Modelle

- Eigener Start geprüft: `dc134770`, sauberer Branch, `core.hooksPath=.githooks`.
- Fehlende Abhängigkeiten für Wurzel, `api-backend` und `merkez` ausschließlich
  mit `cp -cR` aus PRIMARY übernommen. Keine Umgebungsdateien kopiert/gelesen.
- Inventur fertig: 1.020 Werkzeugdefinitionen, 453 Skill-Dateien, 15 lokale
  Projektagenten-Definitionen. Metadaten belegen keine verbundenen Live-Apps.
- Astra-Gesamtplan fertig (`gpt-6-astra`, `xhigh`). Sol für kleine Codepakete;
  Luna nur begrenzte Recherche/Extraktion. Keine doppelten Plan-/Inventuraufträge.
- Native T3-Auswahl mit echten Modelloptionen; Registry unverändert,
  `agent-router validate`: `structure_valid`, Verfügbarkeit nicht geprüft.
- Pflichtberater: Funktionsmeister, DB-Meister, guvenlik und onprem haben lokal
  lesend geprüft; onprem nennt kein Veto. podoloji/gkv-302 prüfen die Gelddefinitionen.
  Die technischen Beraterberichte ersetzen Claudes Datei-ACK nicht.

## Konkrete nächste Backend-Pakete

| Paket | Vorgeschlagene Dateien | Abnahme |
|---|---|---|
| B01 R-06 | `api-backend/billing/api/statistik.routes.js`, gezielter Auth-Test | Owner-Gate vor Fachabfragen; Mitarbeiter/unbekannte Rolle 403 `NUR_INHABER`; ungültige Auth generisch 401; Owner-Antwortformat erhalten; abgelehnte Zugriffe mit null Fachabfragen |
| B02 Monatsgrenzen | `api-backend/lib/berlin-tag.js`, zugehöriger Test | Vorhandene Tagesgrenzen wiederverwenden; Berliner Kalendermonat, exklusives Ende, injizierbare Uhr; Monats-/Jahreswechsel, Schaltjahr und beide Zeitumstellungen |
| B03 Forderungen | Gemeinsamer Helfer mit Tests, Route nur sequenziell | Bestehende Bezahlt-/Saldo-Regeln; Teilzahlungen, Storno, Befreiung, vollständige Pagination, kein Fehler als Nullbetrag |
| B04–B06 Startseite | Neue Backend-Module und Router, nach gesonderter Dateizuteilung | Mandant aus Auth; Finanzblöcke nur Owner, keine Mitarbeiter-Summen in Antworten; echte Lade-/Leer-/Fehlerverträge |
| B07–B08 Verfügbarkeit | Gemeinsamer Kern erst nach Charakterisierung, Mount/Adapter exklusiv koordinieren | Gleiche Buchungsregeln; keine versteckte Korrektur bestehender Verhaltensabweichungen; keine feste Mindestdauer |

ACK-Anfragen bereits gesendet: `praxura-codex-kooperation-20261026-01`,
präzisiert durch `praxura-codex-astra-plan-abgleich-20261026-01` (B01/B02).
Antwort noch offen. Bis dahin keine produktiven Backend-Änderungen.

## Fragen und Prüfgrenzen

Keine erneute Frage zu E1–E12 oder main/V10. Vor Finanzkarten echte offene
Definitionen prüfen: Standortumfang, tatsächlich kassierte Eingänge versus
Ausbuchungen/Stornos, Mitarbeiterzugang zu freien Zeiten. Erst vorhandene
Entscheidungen und Pflichtberater auswerten, dann verbleibende Produktfragen bündeln.

R-06-Gate schließt weder direkte RLS-Zugriffe noch den alten Rechnungsfeed.
Diese Grenzen separat benennen; keine Live-Migration im Redesign-Auftrag.
T6 bleibt ohne freigegebenes Release live ungeprüft. Lokale Tests und synthetische
Browsernachweise sind keine Live-Abnahme.

## Nachweise und Integration

V2.04 (`dc134770`) und V2.05 (`b61979fd`) unabhängig geprüft, Ergebnisse per Queue
übergeben. Kein neuer Produktfehler belegt; kleinere Dokumentations-/Nachweisbefunde
benannt. V2.05: Registry-Tests 12/12, Admin-Renderer synthetisch geprüft,
Rollen/andere Profile unverändert, gespeicherte Smoke-Teilläufe je 0 neue Funde.
Keine eigenen Server-/Browserläufe auf Port 18081.

Eigene Ausgangstests auf `dc134770`: `npm test` mit Exit 0, 2.154 Frontend-,
1.625 Backend- und 318 Werkzeugtests bestanden (4.097 gesamt, keine Fehler).
Lokales Protokoll: `/tmp/praxura-codex-dc134770-0avb95k8.log`.
T1-Gates nach gezieltem Staging ausführen, keine SKIP-Optionen.
Für den Koordinationscommit nach Staging geprüft: Syntax und Dashboard-Größe
(Dokumentationsänderung, daher kein JS zu prüfen), IDs 1.271/52, Redesign-Wachen,
STATUS-Wache und `git diff --cached --check` grün. Produktdateien unverändert.

B01-Vorprüfung: guvenlik bestätigt die bestehende Lücke am tatsächlich gemounteten
Statistik-Router. Kleinster Schnitt ist ein striktes Rollen-Gate nach `resolveAuth`.
Die abweichende Empfehlung, zusätzlich Auth-Fehler auf 503 umzustellen oder die
gesamte Auth-Middleware auszutauschen, wird nicht beiläufig in R-06 übernommen.
Bestehende Owner-Antworten, UTC-Statistikmonate und Auth-Fehler bleiben in B01 gleich.
Weitere Zugangssperren/Altbefunde werden separat behandelt.

Neue Funktionen vorab im INDEX suchen und beim Funktionsmeister anfragen;
nachher Absicht und Erstverwendung melden. Funktionskarte und zentrale STATUS-Datei
bleiben beim Integrator. Backend-Übergabe muss Basis/Head, exakte Dateien, Tests und
Grenzen nennen; gemeinsame Register bei der Integration im selben Integrationscommit
aktualisieren. Codex pusht keinen Integrations- oder main-Stand.

Eigener bestehender T3-Zeitplan bleibt aktiv: alle zwei Stunden, keine zweite
Einrichtung. Fertige Kindaufträge melden sich automatisch. Bei tatsächlichem
V9-Abschluss Zeitplan deaktivieren; offene Abnahme nicht als fertig ausweisen.
