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

B01 ist lokal fertig, von Astra unabhängig abgenommen und als `e94acaae` committet:
drei Zeilen Owner-Gate sowie neuer echter Router-/SDK-Grenztest. Sol hat ausschließlich
Route und Test bearbeitet. Der erste Modelllauf endete am Nutzungslimit; die automatische
Fortsetzung ist abgeschlossen, kein zweiter Schreiber wurde gestartet. B02 ist separat
gebaut und unabhängig geprüft; seine beiden Dateien gehören nicht zum B01-Commit.

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

### B02: lokale Paketnachweise

- Neuer Export `berlinMonatsgrenzen(jetzt = new Date())` in bestehendem Modul:
  17 Zeilen, ausschließlich Wiederverwendung von `berlinHeute` und
  `berlinTagesgrenzen`; Rückgabe `{monat, von, bisExklusiv}`, ungültige Eingaben `null`.
  Erste Verwendung nur in Tests; alte UTC-Statistik ruft den Helfer nicht auf.
- Rotphase: fehlender Export. Danach 13/13 grün, acht neue Tests und alle alten
  Assertions erhalten. März 743 Stunden, Oktober 745 Stunden, Schaltjahr,
  Monats-/Jahreswechsel und exklusives Ende mit festen Erwartungswerten geprüft.
- Funktionsmeister hat Absicht und Erstverwendung erhalten, keine Fehler gefunden;
  Tests eigenständig lokal sowie mit UTC, New York und Kiritimati ausgeführt.
- Eigener vollständiger Lauf `npm test`: 4.121 bestanden (2.154 Frontend,
  1.649 Backend, 318 Werkzeuge), null Fehler und null übersprungen, Exit 0.
  Protokoll `/tmp/praxura-codex-b02-8ze1yeuq.log`.
- T1 nach gezieltem Staging: Syntax, Dashboard-Größe, IDs 1.271/52, Wachen,
  STATUS-Wache und Whitespaceprüfung grün. B02 ist der zweite eigene Produktcommit.
- Funktionskarte/STATUS bleiben ausschließlich beim Integrator. Neue Funktion dort
  im Integrationscommit ergänzen; B02 ist lokal geprüft, noch nicht live ausgeliefert.

Sitzungsstand auf Melihs Wunsch mit `context-save` außerhalb des Repos gesichert:
`~/.gstack/projects/ironkemal-infinitymade-website/checkpoints/20261026-134426-praxura-sitzung-bis-b01.md`.
Der aktive B01/B02-Auftrag bleibt erhalten; keine Produktdatei durch das Speichern verändert.

### Übergabe und nächster Schritt

B01 `e94acaae` und B02 `05ae519c` sind lokal committet; Übergabe per Queue an
Claude erfolgt (`praxura-v6b-b01-b02-integration-e94acaae-05ae519c`). Noch keine
Integrations- oder Live-Abnahme behaupten. Produktpatches ohne eigene Koordinationsdatei:
`/tmp/praxura-b01-e94acaae-z_ar6sln.patch` und
`/tmp/praxura-b02-05ae519c-_17je2h8.patch`. Beide mit `git apply --check` gegen
PRIMARY rein lesend geprüft, Exit 0; dort nichts angewandt oder gestagt.

B03/B04-Dateizuteilung bei Claude angefragt: neue Forderungs- und Startseitenmodule
mit Tests. Vor Bestätigung kein Schreiben außerhalb der vier bereits zugeteilten
Produktdateien. Beide rein lesenden Pflichtprüfungen sind abgeschlossen; nicht doppeln:

- `praxura-v6b-b03-fonksiyon-20261026-r1`: vorhandene Forderungs-/Saldo-/Pagination-Helfer.
- `praxura-v6b-b03-db-vkz03-20261026-r1`: vorhandener Übertragungsmarker VKZ03,
  Statusübergänge und Klassifikation von Patientrest versus Kassenforderung.

Funktionsmeister und DB-Meister belegen die vorhandenen Saldo-/Altzahlungshelfer,
die vollständige Pagination und den VKZ03-Pfad über den Ursprung der Abrechnungszeile.
Entwurf (`erstellt`, `heruntergeladen`) ist noch keine übertragene Forderung;
`gesendet`, `accepted`, `paid` sind übertragen, `rejected` bleibt eine eigene
Ablehnungsklasse und `verworfen` wird ignoriert. Unbekannte Preise und nach einer
DSGVO-Löschung fehlende Rezeptzuordnungen dürfen keine Nullforderung vortäuschen.

Die enge gkv-Nachprüfung `praxura-v6b-b03-gkv-restvertrag-20261026-r1` ist am
Claude-API-Limit fehlgeschlagen, ohne fachliches Ergebnis oder Dateiänderung.
Auch Claudes Integrator-Thread meldet beim Abgleich ein API-Limit; kein aktiver
Integrator-Lauf. Seine zwölf gestagten Frontend-Dateien bleiben unangetastet.

Luna hat anschließend den bestehenden Kassenzahlungs-Vertrag lokal extrahiert
(`praxura-v6b-b03-luna-kassenzahlung-20261026-r1`, abgeschlossen):
`abrechnung_zahlung` kennt Zahlung, Rücklastschrift, Abschreibung und Korrektur.
Der INSERT-Trigger berechnet die Deckung mit Vorzeichen und 0,005-Toleranz aus
dem Ledger; bei Unterschreitung wird ein bisheriger `paid`-Kopf `accepted`.
Quellen: `db/SCHEMA.sql:367–409`, `db/SCHEMA-RLS.sql:2816–2844` und `:5657`.
Das ist Forderungsdeckung; Abschreibungen sind weiterhin kein Geldeingang.
Ein eigener gespeicherter Restbetrag oder exakter reiner Resthelfer wurde nicht gefunden.

Abgeschlossen ist die starke Vertrags-/Planprüfung
`praxura-v6b-b03-astra-vertrag-plan-20261026-r2` (native T3, `gpt-6-astra`,
`reasoningEffort=xhigh`, `serviceTier=default`). Sie führt die bisherigen Berater-
und Luna-Ergebnisse zusammen und klärt Podologie-Sollquelle, negativen Saldo und
VKZ03-Rest nach Zahlung/Ablehnung. Keine Produktdateien durch den Planauftrag ändern.
Das ist ein Astra-Lauf nach ausgefallenem Opus-Lauf, kein behauptetes Opus-Ergebnis.
Es läuft kein weiterer B03-Kindauftrag; keinen zweiten Plan-/Bauauftrag starten.

#### B03: Ergebnis des Astra-Vertragsabgleichs (nur lokal geplant)

- Podologie: gespeichertes Soll allein besitzt vor Festschreibung keine belegte
  Aktualitätsgarantie. `podoZuzahlungSoll` zieht die Altzahlung bereits ab; diese
  nicht ein zweites Mal abziehen. Konservativ nur einen echten, eindeutig
  zugeordneten Einreichungssnapshot mit übereinstimmender Rezeptspalte verwenden,
  andernfalls Betrag unbekannt. Keine neue Preisformel. Quellen:
  `abrechnung.routes.js:3312`, `:4614`, Podologie-Vertrag §8.
- Negativer Patientensaldo: unbekannt plus Anomalie. Weder höhere Forderung noch
  Deckelung ist belastbarer Bestandsvertrag. Zusätzlich widersprechen vorhandene
  Belege mit Nullsaldo dem reinen Altvermerk-Fallback in `bezahlt.js`; diesen
  Konflikt ausweisen, Zentralhelfer und Altstatistik unverändert lassen.
- VKZ03: Entwurf löst keinen Schuldnerwechsel aus. Übertragene und abgelehnte
  Forderungen werden nicht wieder patientenoffen. Rest aus Zeilensoll, bezifferter
  Absetzung und vorzeichenbehaftetem Kassenledger ableiten; `paid` kann auch durch
  Abschreibung entstehen und beweist keinen Geldeingang. Unklare Ablehnung,
  widersprüchliches `paid`, spätere Patientenzahlung oder verwaiste Rezeptzuordnung
  bleiben unbekannt. Der Bestand hat Zahlungs- und Absetzungswege in
  `abrechnung.routes.js:2447` und `:5188`.
- Korrektur der Luna-Kurzfassung: Der Trigger greift beim Zeilensoll **0** auf den
  Kopf zurück, nicht ausschließlich bei NULL (`SCHEMA-RLS.sql:2823`).
- Vorgesehener reiner Rechner `berechneOffeneForderungen` erhält Rezepte, Belege,
  Abrechnungsköpfe/-zeilen und Zahlungen. Lader `ladeOffeneForderungen` lädt alle
  fünf Tabellen mit `owner_id`, stabiler ID-Sortierung und Pagination; abhängige
  IDs zusätzlich in 200er-Blöcken. Kein Standort-/Zeitraumfilter, kein `gt(0)`,
  jeder Fehler auf einer Folgeseite wirft. Keine Änderungen an Bestandsrouten.
- Ausgabe: Positionen mit Quelle/Status/Anomalie, bekannte Teilsummen und
  `gesamtCent=null` bei unbekannten Beträgen. Dezimalwerte prüfen; 0,005-Toleranz
  vor Cent-Rundung, sichere Integer-Cent. Befreiung ist echter Nullbetrag;
  Preis-NULL ist unbekannt. Altzahlung genau einmal berücksichtigen.
- Geplante Tests: Teil-/Altzahlung, Befreiung, Altvermerk/Nullsaldo-Widerspruch,
  Storno/Überzahlung, 0,0049/0,005/0,0051, fehlender Preis/Podo-Snapshot,
  alle VKZ03-Status, Kassen-Teilzahlung/Absetzung/Abschreibung/Korrektur,
  verlorene Zuordnung, normale Kassenabrechnung ohne Patientenzahlung,
  >1.000 Zeilen/>200 IDs, Folgeseitenfehler und Fremdtenant.

Der fachliche Bauplan ist konservativ ausführbar, aber noch **nicht geschrieben
oder getestet**. Insbesondere vollständige Podo-Summen werden ohne belastbare
Sollquelle nicht behauptet. Dateizuteilung bleibt gemäß Melih bei Claude.

Die vier vorgeschlagenen neuen B03/B04-Dateien sind in beiden Arbeitskopien noch
nicht vorhanden und ohne fremde Änderungen. Wegen des ausgefallenen Integrators
ist Melih eine konkrete Dateizuteilung gestellt: Forderungsmodul plus Test sowie
Startseitenrouter plus Test. Melih hat ausdrücklich entschieden, die Zuteilung
weiter über Claude abzuwarten. Bis zu dessen ACK keine produktiven Änderungen an
B03/B04; lokale Quellen- und Planprüfungen bleiben möglich. Kein allgemeines
Plan-OK wird erneut angefragt. `server.js` bleibt unzugeteilt.

Claudes bestätigendes ACK für die vier B01/B02-Pfade (Stand `a6fe9b47`) ist
eingetroffen. B01/B02 waren bereits auf Melihs unmittelbare Zuteilung gebaut und
committet; nicht erneut bauen. Commits, genaue Produktpfade, vorhandene
Testausgaben und selektive Produktpatches erneut zur Integration bestätigen.

Abgeschlossene B01/B02-Tasks und B03-Prüfungen nicht neu starten. Keine aktiven
B03-Kindaufträge; nächste produktive Arbeit wartet auf Claudes Datei-ACK.
Bestehender Scheduler bleibt unverändert aktiv, keine zweite Einrichtung.

### Weitere unabhängige Frontend-Prüfungen (nur gelesen)

- V2.06 `4f0345ac`: Reload-Rennen reproduziert. Bei verzögertem Konfigurationsladen
  startet die Shell vor der Wiederherstellung von `sidebar_collapsed=1`; die Leiste
  ist danach 72 px breit, der Knopf meldet weiter `aria-expanded=true` und
  „Menü einklappen“. Originalmodule, CSS, Renderer und Legacy-Handler im isolierten
  T3-Browser; synthetischer Konfigurations-Promise und Storage. Tastatur/Fokus und
  Defaultrollen geprüft. Screenreader-Baum wegen Snapshot-Timeout ungeprüft;
  Kalendernachweis umfasst nur Shell-Boxen, keine vollständige Kalender-Geometrie.
- V2.07 `355fefc3`, ergänzende Prüfung: Tab durchläuft die Menüeinträge und verlässt
  danach das Dokument, das Flyout bleibt offen. Shift+Tab vom ersten Eintrag springt
  zur letzten Hauptaktion. Zweifachklick/Doppelklick, Anfragebadge und Weiterleitung
  genau eines Originalklicks grün; Kiosk-`inert` nur synthetisch geprüft. Originale
  reine Tests 2/2 grün. R-18/R-19 aus der ersten Prüfung nicht erneut bearbeitet;
  V2.07b `416a68ac` anschließend unabhängig nachgeprüft: bei 1440×240 bleibt
  das Feld y8–232 (224 px), intern scrollbar; Ende erreicht Eintrag 6 vollständig,
  Pos1 erreicht Eintrag 1, App-/Seitenscroll jeweils 0. Wechsel 1440→1024 entfernt
  Feld und alle drei Menü-ARIA-Attribute trotz weiter offener Inline-Gruppe.
  Damit R-18/R-19 lokal bestätigt behoben; separater Tab-Befund bleibt eigenständig.
- V2.08 `aca08f93`: Profilmenü ohne Höhenbegrenzung. Bei 1440×240 mit Admin-Eintrag
  und längerem synthetischem Praxisnamen liegt „Abmelden“ bei y235,5–275,5; nur
  4,5 px bleiben im Fenster. Pfeiltaste erreicht den Eintrag, scrollt dabei aber
  `#app` um 35,5 px und schiebt den Profilknopf auf y−24. Admin-Freigabe und
  tatsächliches Linkziel, Original-Abmeldehandler mit geschlossenem Auth-/Window-
  Double, Tab-Schließen, Popover-Wechsel und Kiosk-`inert` synthetisch grün.
  Originaltests 2/2 grün, Detektor auf exakten Dateien ohne Funde. Keine echte
  Abmeldung, Admin-/DB-Abfrage, PIN-/Vollbild-/Live-Abnahme.

Alle drei Berichte mit Datei/Zeile und Reproduktion per Queue an Claude übergeben.
Keine Produkt-, Index- oder Referenzänderungen und kein Lauf auf Port 18081.

Neue Funktionen vorab im INDEX suchen und beim Funktionsmeister anfragen;
nachher Absicht und Erstverwendung melden. Funktionskarte und zentrale STATUS-Datei
bleiben beim Integrator. Backend-Übergabe muss Basis/Head, exakte Dateien, Tests und
Grenzen nennen; gemeinsame Register bei der Integration im selben Integrationscommit
aktualisieren. Codex pusht keinen Integrations- oder main-Stand.

Eigener bestehender T3-Zeitplan bleibt aktiv: alle zwei Stunden, keine zweite
Einrichtung. Fertige Kindaufträge melden sich automatisch. Bei tatsächlichem
V9-Abschluss Zeitplan deaktivieren; offene Abnahme nicht als fertig ausweisen.

## Fortsetzung am 26.10., abends

- PRIMARY zuletzt `758df107`: Claude hat B01/B02 selektiv integriert und lokal
  getestet. Claude arbeitet wieder aktiv an V2.10b (R-20–R-22); kein aktueller
  Nutzungsausfall belegt. Keine doppelte Frontend-Implementierung beginnen.
- Melih priorisiert schnellere sichtbare Ergebnisse. Neue Startseite früh
  vorziehen, gemeinsame Bausteine nutzen; Pflichtprüfungen erhalten. Zusätzliche
  Vorgabe: dominante orange Warnoptik überarbeiten, keine Emojis in der Oberfläche.
  Beide Aufträge per Queue an Claude übermittelt.
- B03/B04 weiterhin nicht exklusiv zugeteilt. Melihs vorherige ausdrückliche Wahl
  „Dateizuteilung weiter über Claude abwarten“ bleibt maßgeblich. Bei späterem
  Nutzungsausfall nur unabhängige zugeteilte Arbeit übernehmen; fremde Änderungen
  bleiben unberührt. ACK erneut mit konkreten vier neuen Pfaden angefragt.
- V2.09 `6e6eecb9` begrenzt unabhängig geprüft: Original-Suchmodul, gemeinsamer
  Picker und Signalbus in isoliertem T3-Browser mit CSP-Netzwerksperre und
  synthetischen Daten. `leads:changed` aktualisiert offene Treffer; HTML-artiger
  Name erzeugt keine HTML-Elemente; Auswahl gibt richtige ID weiter, leert Feld
  und schließt Liste. Sechs Zusatzprüfungen für Schrägstrich/Input/Ctrl/IME,
  `inert` und fehlende Patientenberechtigung grün. Standortwechsel macht laut
  Originalquelle `dashboard.js:14530–14544` einen Reload; Patientenabfrage nutzt
  `bizScope` in Zeile 7108. Keine neue belegte Regression in diesen Punkten.
  Keine vollständige App-, Kontrast- oder Live-Abnahme. Bericht an Claude:
  `praxura-codex-v209-teilpruefung-20261026-r1`. Browser-Tab geschlossen,
  Port 18081 nicht benutzt, keine Produktdatei verändert.
- `agy-context --local-only` für Koordinationskontext genutzt, Provider nicht
  aufgerufen. Keine gemessene Netto-Tokenersparnis behauptet. Bekannte Quellen
  gezielt gelesen; unvollständiger Kontext ersetzt keine Quellenprüfung.
- Verspätetes ursprüngliches gkv-B03-Gutachten eingetroffen. Abweichungen zum
  Astra-Vertrag insbesondere bei `paid`, Teilzahlung und Sollherkunft vor einem
  späteren Bau gezielt abgleichen; kein ungeprüftes Gutachten als Codefreigabe.

## Aktueller Abnahmestand B03/B04 (Fortsetzung nach Nutzungslimit)

Dieser Abschnitt ersetzt die oben beschriebenen damaligen Wartezustände.

- Claude hat B03/B04 ausdrücklich exklusiv zugeteilt: neue Dateien
  `api-backend/lib/offene-forderungen.js` und `.test.js` sowie
  `api-backend/routes/startseite.js` und `.test.js`. `server.js`, Frontend,
  Funktionskarte, STATUS und Integration bleiben bei Claude. Keine zusätzlichen
  Dateigrenzen aus dem allgemeinen Beschleunigungsauftrag abgeleitet.
- Beide Pakete von Sol geschrieben, noch untracked und nicht zur Integration
  freigegeben. B03 umfasst ausschließlich GKV-Zuzahlungsreste und VKZ03,
  vollständige Owner-Keyset-Pagination, getrennte bekannte Teilsummen und
  unbekannte Beträge. Keine allgemeine Praxisforderungssumme behaupten.
- B04 ist eine injizierbare Routing-/Rollengrenze ohne Finanzadapter und ohne
  Mount. Mitarbeiter-Default liefert leere Blöcke und ruft keine Lader auf;
  explizite Finanzanforderung wird abgewiesen. Fehlende Adapter sind Fehler,
  keine erfundenen Nullbestände. Adapter und Einhängen bleiben ausstehend.
- Fachvertrag durch Astra nach Quellenabgleich präzisiert; Podo nur mit
  belastbarem Snapshot, `paid` allein beweist keinen Geldfluss. Pflichtabsicht
  an Funktionsmeister im Vertrags-/Bauauftrag gemeldet: spätere Startseiten-
  Zuzahlungsblöcke, erste Verwendung nur Tests, alte Statistik unverändert.
- Parent-Focused-Lauf: B03/B04 zusammen 88/88 grün. Wiederholte vollständige
  Suite: 2.154 / 1.737 / 318 = 4.209 grün, null Fehler/Skip. Log:
  `/var/folders/63/7kx2wp_j22g5p98c7kmnqz_40000gn/T/praxura-b03-b04-npm-dty9e7bi.log`.
  Vorheriger Lauf vor B03 hatte ausschließlich Stripe-Testprozess-Timeout
  (`tools/stripe-url-contract.test.js:144`, `spawnSync ETIMEDOUT`); derselbe
  isolierte Fall anschließend 1/1 grün. Keine Tests geändert/abgeschwächt.
- Erster B04-Pflichtreview scheiterte am Nutzungslimit ohne Gutachten. Nach
  Wiederaufnahme läuft genau eine kombinierte unabhängige Astra-Runde mit
  getrennten Rollen guvenlik/onprem/fonksiyon/gkv:
  `praxura-b03-b04-guvenlik-onprem-review-20261027-r2`. Kein zweiter Reviewlauf.
- V2.10 Öffner/Freigaben gezielt grün. V2.10b `d287f880` R-20/R-21 durch
  unabhängige Node-Probes bestätigt; R-22 zusätzlich gerendert mit Original-CSS
  und Profilmodul bei 1440×240 geprüft: Menü unten 219,5, Abmelden sichtbar,
  Topbar bleibt 0–60, App/Seite scrollen nicht. Keine vollständige Live-Abnahme.
- V6.F01 `1e428c61` nur gelesen: Employee-Abfrage lädt ownerweite Termine und
  filtert `user_id` erst danach; lokales RLS erlaubt Teamzeilen. An Claude
  empfohlen: Employee-Filter in Query, fehlende UID fail closed. Zweiter
  Quellbefund: minütliches `wurzel.innerHTML` ersetzt fokussierte Elemente;
  Fokuspfad zur gerenderten Nachprüfung übergeben. Browser-Repro dieser Runde
  scheiterte an isolierter Auflösung relativer Subimporte; keine gerenderte
  Bestätigung behauptet. Keine Änderung an Claudes Dateien.
- PRIMARY zuletzt `6b5d8557`: Claude hat erledigte/doppelte Queue-Einträge
  bereinigt, Besitzgrenzen und kein-main/V10 festgehalten. Aktuell V3.W
  Warnoptik/Emojis, danach V6.F02. Codex beginnt dort keine parallele Umsetzung.
- Nächste Schritte: Reviewbefunde auswerten, höchstens drei gezielte Reparaturen,
  T1 nach explizitem Staging, kleine eigene Commits und selektive Produktpatches
  mit API-Vertrag/Grenzen an Claude. Zentrale Funktionskarte beim Integrator.

## Pflichtreview und erste Produktübergabe

- Unabhängiger Astra-Review R2 abgeschlossen: B04 ohne belegten Blocker,
  guvenlik/onprem bestanden im lokalen Umfang. Reviewer führte 88/88 Focused-
  Tests und neun zusätzliche B04-Proben grün aus. Keine Livefreigabe.
- B04 wird als eigenes Paket committet: nur neuer Router und Vertragstests,
  keine Fachadapter und kein `server.js`-Mount. Vor Fix bestand Gesamtsuite
  einschließlich unverändertem B04 mit 4.209 Tests; dessen Reviewdateien danach
  unverändert. API-Erfolg `status: "ok"`, Fehler fester Blockcode;
  Ladervertrag `lader[name]({ tenantId })`. Mitarbeiter-Default leere Blöcke,
  explizite Finanzanforderung 403. Fehlende Lader ergeben unavailable/503,
  keine fertige Geld-/Wochenkarte aus dieser Routinggrundlage ableiten.
- B03-R2 fand P2: Befreiung übersprang Journal-/Altbetragsvalidierung und
  Überzahlungsanomalie. Parent ergänzte zwei Regressionstests (beide zunächst
  rot). Fix setzt Befreiungssoll auf null Euro, validiert Journal/Altbetrag vor
  Rückgabe und nutzt bestehende Restprüfung für Überzahlung. Zweite Reparatur
  erhielt den vorhandenen VKZ03-Grund bei unklarem Patientensaldo durch
  Weitergabe von `empfangen`. Bestehende Assertions unverändert; 90/90 grün.
- B03 bleibt bis unabhängiger Nachprüfung R3 und vollständiger Suite gesperrt.
  Neue Runde `praxura-b03-befreiung-nachpruefung-20261027-r3`; Fullsuite-Log
  `/var/folders/63/7kx2wp_j22g5p98c7kmnqz_40000gn/T/praxura-b03-fix-npm-momfkb4c.log`.

## B03/B04 lokal abgenommen und Übergabe

- B04-Produktcommit `a99d3b8a`, Basis `7f21652e`. Selektiver Patch mit nur den
  zwei Routerdateien an Claude übergeben, `git apply --check` in PRIMARY grün:
  `/var/folders/63/7kx2wp_j22g5p98c7kmnqz_40000gn/T/praxura-b04-a99d3b8a-uboz78ji.patch`.
  Eigene Koordinationsdatei ausdrücklich nicht integrieren. Pre-commit markierte
  zunächst den Variablennamen eines synthetischen Fehlertexts als Secret;
  Umbenennung in `fehlerDetails`, identische Assertions, erneut 55/55 grün.
  Keine Hook-Ausnahme oder SKIP-Variable verwendet.
- B03-R3 abgeschlossen: lokaler Befreiungsbefund geschlossen, kein belegter
  Restblocker. Reviewer bestätigte getrennt gkv-/guvenlik-/onprem-Pfade;
  35/35 B03-Tests plus 37/37 eigene Proben grün. B03-Dateien während der
  Nachprüfung unverändert. Keine Live-/Release-/Transaktionssnapshotfreigabe.
- Gesamtsuite nach Fix: 2.154 / 1.739 / 318 = 4.211 grün, null Fehler/Skip.
  Logpfad wie oben. B03 wird separat mit genau seinen zwei neuen Produktdateien
  committet und selektiv übergeben. Zentrale Register/Funktionskarte bleiben
  bei Claude; Absicht weiter spätere Startseiten-Zuzahlungsblöcke, zuerst Tests.
- Integration noch erforderlich: B03-Adapter für B04, weitere Geld-/Mahn-/
  Abrechnungs-/Verfügbarkeitsblöcke und Router-Mount sind keine abgeschlossenen
  Kennzahlen. B03 zählt nur GKV-Zuzahlung und VKZ03, keine Privat-/Ausfallreste.
- V3.W `102211f7` unabhängig gelesen und isoliert gerendert: globaler Emoji-
  Filter verändert auch Nutzdatenanzeige; `contenteditable` ohne explizites
  `="true"` wird trotz echter Editierbarkeit verändert. Repros an Claude,
  keine Frontendänderung. Dynamische Titel und implizite Optionswerte als
  zusätzliche Integrationsgrenzen gemeldet, regulärer App-Auslöser dort nicht
  belegt. Warntext-Kontrast 9,93:1 hell / 10,73:1 dunkel; keine vollständige
  Kalender-/Performanceabnahme. Claude besitzt alle Korrekturen dieses Pakets.

## Nächste Finanzadapter: Planung, noch kein Dateibesitz

- B03-Produktcommit `cac76bd9`, selektiver Patch nur mit seinen zwei neuen
  Dateien übergeben und in PRIMARY erfolgreich auf Anwendbarkeit geprüft:
  `/var/folders/63/7kx2wp_j22g5p98c7kmnqz_40000gn/T/praxura-b03-cac76bd9-hgil9h8h.patch`.
  B04 ist bei Claude als `c039b2f7` integriert; noch ohne Server-Mount.
- Sol-Plan fertig, keine laufende doppelte Umsetzung. Korrigierter Vorschlag:
  acht neue Dateien unter `api-backend/lib/startseite/`: `geld`, `mahnungen`,
  `abrechnung`, `finanzadapter`, jeweils `.js` und `.test.js`. Dieser Pfad nutzt
  vorhandenes Docker-COPY und Backend-Test-Glob. Vorheriger Vorschlag außerhalb
  von `lib` würde unnötige gemeinsame Build-/Teständerungen erfordern.
- Konkretes Pfad-ACK bei Claude angefragt, weiterhin vor Bau abwarten.
  Reihenfolge: Monatsjournal plus B03, danach belegbare Privat-/Mahnreste,
  zuletzt Bereitschaftsschätzung mit vorhandenen Preis-/Snapshotwegen.
- Journal besitzt nur `created_at`: Berliner Monat der Journalerfassung,
  nicht behauptetes rückdatiertes Zahlungsdatum. Rechnungsledger nicht zum
  Belegjournal addieren. Unklare Kassenkorrekturen bleiben Unknown; kein Cash
  aus `paid` ableiten. Wochenauslastung erfordert eigene Arbeitsfensterspur.
- Designpräzisierung von Claude `4a85e25f`: weiße Flächen, nur Warnsymbole
  orange, Text neutral, Fehler rot. Orange-Symbolkontrast hell auf Weiß 3,64:1,
  auf Warnfeld 3,46:1; dunkel 5,75:1 auf Karte und 5,35:1 auf Warnfeld.
  Vorige Emoji-Nutzdaten-/Eingabebefunde bleiben farbunabhängig offen.
- Melihs neue ausdrückliche Modellpräferenz ersetzt frühere Astra-Vorgaben:
  Sol für Planung/Bau/Review, Luna für kleine Zuarbeit; Astra nur auf seinen
  ausdrücklichen Wunsch. Eigenen bestehenden 2h-Scheduler entsprechend
  korrigiert, weder dupliziert noch fremde Scheduler verändert. Abschlussgrenze
  dort ebenfalls präzisiert: kein main/V10, keine angeblich offene Rückfrage.

## Verbindliches Adapter-ACK und laufender Bau (27.10.)

- Claude-ACK `522e9197` erhalten: alle acht neuen Dateien unter
  `api-backend/lib/startseite/` exklusiv Codex; sämtliche älteren Pfadvarianten
  verworfen. Zusätzlich B07 nur neue `api-backend/lib/arbeitsfenster.js` und
  `.test.js` zugeteilt. Server-Mount/Umstellung weiterhin Claude.
- B03 bei Claude integriert als `86dc58d2`, Patch unverändert, 35 Tests grün.
  B04 integriert als `c039b2f7`; keine erneute Patchanwendung nötig.
- B05a einmalig gestartet: Sol/high schreibt nur `geld.js`, `geld.test.js`,
  `finanzadapter.js`, `finanzadapter.test.js` unter freigegebenem Ordner.
  Task `praxura-b05a-sol-geld-20261027-r1`. Vertrag wie Sol-Plan: Patient und
  Kasse getrennt, Berliner Erfassungsmonat des Journals mit `quelle/umfang`,
  B03-Zuzahlungsaggregate; Privat/Ausfall explizit unvollständig. Keine
  Wochensummen. Noch kein Code als abgenommen/integriert behauptet.
- B07 einmalig als read-only Sol/high-Paritätsplanung gestartet:
  `praxura-b07-sol-paritaet-plan-20261027-r1`. Originale Fensterregel aus
  `getAvailableSlots` gezielt belegen, danach kleinste reine Auslagerung mit
  Originalcode-Paritätstests; Altfehler nicht beiläufig reparieren.
- PRIMARY bei Wiederaufnahme `6810068b` (Kalenderphase V5 abgeschlossen),
  nächste Phase V8. „Codex pausiert“ im STATUS stammt aus damaligem Limit;
  neuere ausdrückliche Fortsetzung gilt. Kapazität auf Backend konzentrieren,
  keine breiten Frontend-Prüfungen doppeln.
- V3.Wb `0d24bd9f` gezielt unabhängig mit Originalmodul im isolierten T3-Browser
  bestätigt: Namen mit mittigem Emoji unverändert/0 SVG, `zerlege` liefert null;
  contenteditable/empty/plaintext-only, impliziter Optionswert und title bleiben
  unverändert; „Drucken“ erhält genau ein SVG. Frühere konkrete Repros damit
  geschlossen. Keine allgemeine Nutzdatenpräfix-/Performance-/Livefreigabe.
  Nachprüfung per Queue übergeben; Browser geschlossen, Port 18081 unbenutzt.

## B05a lokal abgenommen; B07 in unabhängiger Prüfung (27.10.)

- B05a: vier zugeteilte Dateien fertig. `ladeGeld({supabase,tenantId,jetzt})`
  liefert Patienteneingänge und Kasse getrennt sowie B03-Aggregate ohne IDs.
  `quelle` und `umfang` kennzeichnen Erfassungsmonat und unvollständige
  Privat-/Ausfallreste. `createFinanzlader` liefert lazy B04-Lader; standardmäßig
  nur Geld, noch keine Mahnungs-/Bereitschafts-/Wochenberechnung.
- Unabhängiger Sol-Review mit getrennten guvenlik/onprem/gkv/db/fonksiyon-
  Urteilen: kein belegter Produktblocker. Bestätigte Testlücke beim Kassen-
  Monatsfilter geschlossen: Randdaten vor/am Beginn und am exklusiven Ende,
  Servercap 1, Filterpflicht auf jeder Seite einschließlich leerer Schlussseite.
  Beide In-memory-Mutationen (Filter ganz entfernt / erst ab Folgeseite entfernt)
  werden jetzt erkannt. Produktcode gegenüber Review unverändert, 14 Tests grün.
- Gesamtsuite einschließlich B07: 2.154 / 1.842 / 318 bestanden, null Fehler,
  null übersprungen. Log:
  `/var/folders/63/7kx2wp_j22g5p98c7kmnqz_40000gn/T/praxura-b05a-b07-npm-pmktzpkq.log`.
- B07: zwei neue Dateien gebaut, 89 Original-Paritätstests zusätzlich unter
  UTC/Berlin/New York grün. Unabhängiger Sol-Review
  `praxura-b07-sol-review-20261027-r1` läuft; B07 bleibt separat ungestagt.
  Fensterparität ist kein Nachweis vollständiger Onlinebuchbarkeit (B08 offen).
- PRIMARY enthält fremde gestagte Frontend-/Index-/STATUS-Dateien; unangetastet.
  Selektive Übergabe enthält ausschließlich die vier B05a-Produktdateien.

## Übergabe B05a und gezielte B07-Testnachprüfung

- B05a committet als `bb64ac46`, Hook und T1 ohne Umgehung grün. Selektiver
  Vier-Dateien-Patch erfolgreich in PRIMARY auf Anwendbarkeit geprüft und
  Claude per Queue übergeben:
  `/var/folders/63/7kx2wp_j22g5p98c7kmnqz_40000gn/T/praxura-b05a-bb64ac46-crr3qz3h.patch`.
  Integration/Mount noch nicht als erfolgt behauptet.
- B07-R1: kein Produktfehler, zwei belegte Testlücken. Direkte Tests für
  getrennte Owner-/Mitarbeiterdaten und rückwärts gerichtete Grenzberührungen
  ergänzt; Produktcode unverändert. 91/91 jeweils unter UTC, Berlin und New
  York grün. Vier zuvor überlebende In-memory-Mutationen jetzt Exit 1.
- Original-Testbasis auf gemeinsamen Featurecommit `dc134770` umgestellt;
  Originalfunktionshash unverändert. Dadurch verlangt der selektive Patch
  keinen ausschließlich auf Codex liegenden Dokumentationscommit als Oracle.
- Eng begrenzte unabhängige Nachprüfung läuft als
  `praxura-b07-sol-testnachpruefung-20261027-r2`. Finale Gesamtsuite läuft,
  Log `/var/folders/63/7kx2wp_j22g5p98c7kmnqz_40000gn/T/praxura-b07-final-npm-iqwwcec9.log`.
  B07 bleibt bis Ergebnis ungestagt, server.js unangetastet.
- Nächster unabhängiger Schritt: read-only Vertragsprüfung Mahnungen mit
  Pflichtberaterperspektiven gestartet, `praxura-b06-sol-vertrag-20261027-r1`.
  Noch keine Mahnungsdatei erzeugt; keine doppelte Arbeit am selben Paket.
