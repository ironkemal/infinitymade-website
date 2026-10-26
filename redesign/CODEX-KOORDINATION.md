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
| Produktiver Backend-Dateibesitz | Melih hat am 26.10.2026 die vier B01/B02-Dateien ausdrücklich exklusiv Codex zugewiesen und den sofortigen Bau bestätigt |

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
- Pflichtberater: Funktionsmeister, DB-Meister, guvenlik, onprem, podoloji und
  gkv-302 haben lokal lesend geprüft; onprem nennt kein Veto.
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
Claude erreichte vor einer Antwort sein Sessionlimit bis 12:50 Uhr. Daraufhin
hat Melih die vier genannten Dateien unmittelbar zugewiesen: `statistik.routes.js`,
neue `statistik.routes.test.js`, `berlin-tag.js`, `berlin-tag.test.js`.
Damit ist der frühere ACK-Stopp für genau B01/B02 aufgehoben. Weitere Backend-Dateien,
insbesondere `server.js`, sind noch nicht zugeteilt. PRIMARY bleibt unverändert bei Claude.

B01 ist lokal fertig, von Astra unabhängig abgenommen und in diesem Commit:
drei Zeilen Owner-Gate sowie neuer echter Router-/SDK-Grenztest. Sol hat ausschließlich
Route und Test bearbeitet. Der erste Modelllauf endete am Nutzungslimit; die automatische
Fortsetzung ist abgeschlossen, kein zweiter Schreiber wurde gestartet. B02 ist separat
gebaut und in Prüfung; seine beiden Dateien gehören nicht zum B01-Commit.

## Fragen und Prüfgrenzen

Keine erneute Frage zu E1–E12 oder main/V10. Melih hat am 26.10.2026 die vier
gebündelten Produktfragen ausdrücklich beantwortet:

| Thema | Entscheidung |
|---|---|
| Kassiert diesen Monat | Patienteneingänge als Hauptzahl; Kassenzahlungen separat. Tatsächliche Eingänge minus Stornos, ohne Ausbuchungen. |
| Mitarbeiter: freie Zeit | Nur eigene nutzbare Lücken, ohne Geldangaben; kein neuer Praxisschalter. |
| Podologie: Pause droht | Warnung 7 Tage vorher; bestehende Gültigkeitsregel unverändert wiederverwenden. |
| VKZ 03 | Eigene Zeile „Bei Kasse gefordert“; übertragene Forderung zählt nicht mehr als offene Patientenzahlung. |

Finanzkarten bleiben wie der vorhandene Statistikvertrag praxisweit; keine
Standortzuordnung aus Tabellen ohne Standortspalte vortäuschen. Fachliche Umsetzung
nutzt bestehende Fristen-/Saldo-/Statusfunktionen; kein neues Schema nötig behaupten,
bevor der konkrete VKZ-03-Datenpfad geprüft ist.

Quellenwiderspruch aus den Beraterberichten geklärt: Der ältere Kommentar
„Privatrechnungsbeleg nur bei Barzahlung“ ist durch die ausführbare RPC überholt.
`db/SCHEMA-RLS.sql:4879–4899` schreibt den Beleg bei jeder Zahlart; Belegjournal und
`rechnung_zahlungen` daher nicht addieren. Das ist lokaler Quellbeleg, keine Live-Prüfung.

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

Luna hat R-06 zusätzlich am tatsächlichen Handler mit installiertem SDK und strikt
synthetischem Fetch reproduziert: Owner, Mitarbeiter und unbekannte Rolle jeweils
HTTP 200, 1 Auth-/1 Profil-/11 Fachabfragen. Kein Ziel außerhalb `synthetic.invalid`.
Dieser Nachweis bestätigt den Fehler im Bestand und ist kein erfolgreicher Grenztest.

### B01: lokale Paketnachweise

- Neuer Rollen-Grenztest vor dem Gate rot: sechs Fälle lieferten 200 statt 403.
  Auth-Fixture korrigiert, fachliche Erwartungen unverändert.
- Nach Gate: neuer Test plus unveränderter Therapeuten-Test 25/25 grün, kein SKIP.
  Nicht-Owner nur Auth/Profil, null Fachabfragen; Owner behält 13 Antwortschlüssel
  sowie Tenantfilter einschließlich Zahlungsnachladung.
- Eigener vollständiger Lauf `npm test`: 4.113 bestanden (2.154 Frontend,
  1.641 Backend, 318 Werkzeuge), null Fehler und null übersprungen, Exit 0.
  Protokoll `/tmp/praxura-codex-b01-sx8_fj22.log`.
- Astra: keine Blocker; neuer Test plus Therapeuten-Test eigenständig 25/25 grün.
  Sieben absichtliche Fehler nur im Speicher erkannt; sechs direkte Fetchzaun-Proben
  bestanden. Ein weiterer Endpoint-Mutationslauf wurde nach 30 Sekunden abgebrochen;
  die direkte Endpoint-Zaunprobe bestand. Keine Dateien durch Review verändert.
- T1 nach gezieltem Staging: Syntax, Dashboard-Größe, IDs 1.271/52, Wachen,
  STATUS-Wache und Whitespaceprüfung grün. Frontend-/Bild-/Live-Abnahme gehört
  nicht zu diesem lokalen API-Paket; `dashboard.js`/CSS unverändert.

### Zusätzliche Frontend-Prüfung an Claude übergeben

V2.07 (`355fefc3`) isoliert mit originalem Modul/CSS und synthetischem DOM geprüft,
ohne Port 18081: bei 1440×240 ragt das nicht scrollbare Flyout unter das Fenster;
beim Wechsel auf 1024 px wird `aria-expanded=false` nach der Rollenbereinigung
erneut gesetzt, obwohl die mobile Gruppe offen ist. Exakte Reproduktionen per
Queue übergeben. Claude führt sie in PRIMARY als R-18/R-19 und Paket V2.07b.
T3-Inkognito-Probetab anschließend geschlossen, keine Referenzbilder verändert.

Neue Funktionen vorab im INDEX suchen und beim Funktionsmeister anfragen;
nachher Absicht und Erstverwendung melden. Funktionskarte und zentrale STATUS-Datei
bleiben beim Integrator. Backend-Übergabe muss Basis/Head, exakte Dateien, Tests und
Grenzen nennen; gemeinsame Register bei der Integration im selben Integrationscommit
aktualisieren. Codex pusht keinen Integrations- oder main-Stand.

Eigener bestehender T3-Zeitplan bleibt aktiv: alle zwei Stunden, keine zweite
Einrichtung. Fertige Kindaufträge melden sich automatisch. Bei tatsächlichem
V9-Abschluss Zeitplan deaktivieren; offene Abnahme nicht als fertig ausweisen.
