# Ops #25 — Box-FAQ: interner Entwurf

Stand: 23.10.2026. **DRAFT / nur intern / nicht zur Veröffentlichung freigegeben.**

Quellenstand: gemeinsamer Checkout einschließlich vorhandener uncommitteter Änderungen. Belegt sind lokale Codewege, keine auf einer Box reproduzierten Abläufe. Plan vor Erstellung: letzter Abschnitt von `konsey/tutanak/2026-10-22-ops-fortsetzung.md`. Vorhandene fonksiyon-/legal-Beratung zum Storyboard wird im vorgegebenen Umfang übernommen; keine neue Beratung oder Produktentscheidung.

## Prüfrahmen

Alle folgenden Klickfolgen sind **noch auszuführende Zielbuild-Prüfungen**: ausschließlich isolierte synthetische Podologie-Testpraxis, bekannte Testperson und Testverordnung, vorbereitete Owner-/Mitarbeiterrollen; keine echten Konten oder Daten anlegen oder verwenden. Je Frage Datum, Build/Commit samt Arbeitsstand, Rolle, Gerät/Browser, tatsächliche Labels und Ergebnis festhalten, ohne Zugangsdaten oder Einrichtungscodes zu protokollieren. Bei abweichendem oder fehlendem Bildschirm: offen lassen. Menüeintrag allein beweist keine Berechtigung oder erfolgreiche Speicherung.

## 1. Wie melde ich mich als Praxisinhaber an?

**Antwortentwurf:** Auf der Anmeldeseite der eingerichteten Box „E-Mail“ und „Passwort“ des vorhandenen Praxiszugangs eingeben und „Anmelden“ wählen. Reguläre Praxisanmeldung führt zum Dashboard. Plattformadministration ist ein eigener Zugang.

**Quellbeleg:** `login.html:317` / `login.html:320` / `login.html:333` — Felder und Knopf; `login.js:180` — Passwortanmeldung; `login.js:147` / `login.js:148` — getrennte Admin-/Dashboardweiterleitung.

**Zielbuild offen:** Erreichbare Boxadresse, erfolgreiche Anmeldung mit vorbereitetem synthetischem Owner und richtige Praxis/Rolle nachweisen. Ersteinrichtung oder Kontowiederherstellung werden hier nicht erklärt.

## 2. Wie beginnt ein Mitarbeiter mit Einrichtungscode?

**Antwortentwurf:** Mitarbeiterzugänge werden von der Praxisleitung angelegt. Auf der Box-Anmeldeseite „Erstanmeldung mit Einrichtungscode“ öffnen, eigene E-Mail, erhaltenen Code und zweimal neues Passwort eingeben; „Passwort festlegen“ wählen. Nach Erfolg mit E-Mail und neuem Passwort regulär anmelden. Kein gemeinsames Ownerkonto verwenden.

**Quellbeleg:** `employee-signup.html:427` — Zugang durch Praxisleitung; `login.html:345` — Einstieg; `login.html:352` / `login.html:355` / `login.html:357` / `login.html:359` / `login.html:354` — Felder; `login.html:361` — „Passwort festlegen“; `login.js:317` / `login.js:329` — Erstanmeldung und Erfolgsmeldung.

**Zielbuild offen:** Mit vorbereitetem synthetischem Mitarbeiter und gültigem Testcode Ablauf einschließlich anschließender Anmeldung/Rollenzuordnung prüfen. Codes weder in Dokumentation noch Aufnahme zeigen. Codeerzeugung und Zurücksetzen sind keine Schritte dieser FAQ-Prüfung.

## 3. Wie ordne ich im Terminkalender einen Patienten zu?

**Antwortentwurf:** „Terminkalender“ → „Heute“ zur Orientierung; „+ Termin“ öffnet „Neuer Termin“. Im Feld „Patient“ über „Suchen oder auswählen…“ vorhandene Person suchen und Treffer auswählen. Mitarbeiter, Leistung und Zeitangaben kontrollieren. Ein eingetippter Name allein ist kein Nachweis der Aktenzuordnung.

**Quellbeleg:** `nav-registry.js:90` — Kalender für Owner/Mitarbeiter; `dashboard.html:276` / `dashboard.html:286` — Einstiege; `dashboard.js:210` / `dashboard.js:211` — aktuelle deutsche Labels, insbesondere „Patient“ statt HTML-Fallback „Kunde“; `dashboard.html:3113` — Suchfeld; `dashboard.js:4479` / `dashboard.js:4480` — Auswahl setzt Name und Patienten-ID.

**Zielbuild offen:** Mit synthetischem vorhandenen Patienten Trefferwahl, Mitarbeiter-/Leistungsangebot, Zeitangaben und nach zulässigem Testspeichern dieselbe Aktenzuordnung im geöffneten Termin nachweisen. Rollen-/Standortumfang prüfen; keine neue echte Buchung auslösen.

## 4. Wie finde ich die zugehörige Patientenakte?

**Antwortentwurf:** Im geöffneten Termin „Patientenakte“ wählen. Alternativ unter „Patienten“ im Feld „Suchen...“ dieselbe Person suchen und öffnen. Vor weiteren Eingaben kontrollieren, dass tatsächlich dieselbe synthetische Akte geöffnet ist.

**Quellbeleg:** `dashboard.html:5056` — Aktion „Patientenakte“; `nav-registry.js:93` — „Patienten“ für Owner/Mitarbeiter; `dashboard.html:359` — Suche; `dashboard.js:7147` / `dashboard.js:3041` — Öffnen der Akte aus Patientenliste beziehungsweise Terminkarte.

**Zielbuild offen:** Beide Einstiege mit derselben Testperson abgleichen, einschließlich eindeutiger Aktenidentität bei ähnlichen Namen und tatsächlichem Rollenzugriff. Keine Aussage über standortübergreifende Sichtbarkeit ableiten.

## 5. Wie erfasse ich eine Verordnung manuell und speichere einen Entwurf?

**Antwortentwurf:** „Verordnungen“ → „+ Neue Verordnung“ → „Patient auswählen“. Angaben vom vorbereiteten synthetischen Original übernehmen und „Speichern“ wählen. Bei offenen Angaben kann „Als Entwurf speichern?“ erscheinen: Hinweise lesen; „Weiter bearbeiten“ oder bewusst „Als Entwurf speichern“ wählen. „Entwurf · noch zu prüfen“ bedeutet keine Abrechnungsfreigabe.

**Quellbeleg:** `nav-registry.js:100` — Verordnungen für Owner/Mitarbeiter; `dashboard.html:1410` / `dashboard.html:3512` / `dashboard.html:3759` — Bedienweg; `dashboard.js:13980` — fehlendes Ausstellungsdatum; `dashboard.js:14004` — Dialog, beide Aktionen und Freigabegrenze; `module/verordnung-detail.js:237` — Entwurfskennzeichnung.

**Zielbuild offen:** Mit ansonsten konsistentem Testfall und bewusst fehlendem Ausstellungsdatum Entwurf speichern, wiederfinden und Kennzeichnung prüfen. Andere Validierungsprobleme können Ablauf blockieren. Kein KI-/Scanweg und keine automatische fachliche Richtigkeit zugesagt.

## 6. Wie ergänze und prüfe ich denselben Entwurf?

**Antwortentwurf:** Unter „Verordnungen“ dieselbe Listenzeile öffnen; dort steht die bearbeitbare Maske. Fehlende Angaben anhand desselben synthetischen Originals ergänzen, „Verordnung prüfen“, Ergebnisse lesen und „Speichern“. Es gibt in diesem Weg keinen zusätzlich vorausgesetzten „Bestätigen“-Knopf. Verbleibende Probleme klären; ein historischer Hinweis „Trotz Lücken gespeichert“ kann erhalten bleiben.

**Quellbeleg:** `module/verordnung-liste.js:139` / `module/verordnung-liste.js:232` — Öffnen und bearbeitbare Ansicht; `module/verordnung-pruefen-knopf.js:222` — Prüfknopf; `module/verordnung-maske.js:836` — Änderung derselben Verordnung; `api-backend/server.js:2898` / `api-backend/server.js:2899` — erneute Entwurfsentscheidung, Übergang zu `confirmed` nur ohne dortige Entwurfsgründe; `dashboard.js:14065` — Ergebnistext; `module/verordnung-detail.js:238` — historischer Hinweis.

**Zielbuild offen:** Identische Verordnung vor/nach Ergänzung, erneute Prüfung, tatsächliche Speicherung und sichtbaren aktuellen Status nachweisen. Ein bestätigter Erfassungsstand ersetzt weder Originalprüfung noch Kassenannahme. Keine Statusänderung allein aus einem Klick behaupten.

## 7. Ist ein Termin bereits eine dokumentierte Behandlung?

**Antwortentwurf:** Ein Kalendereintrag plant einen Termin. Für Podologie führt die Praxisleitung unter „Behandlungen“ über „Aktive Verordnungen“ zur Auswahl der Verordnung und „Tagesbehandlung erfassen“. „Behandlungsdatum“, „HPNR-Codes“ und weitere erforderliche Angaben gehören zur Dokumentation der erbrachten Behandlung; erst nach Kontrolle „Behandlung speichern“. Im Übungsablauf ausschließlich vorbereitete Simulation verwenden.

**Quellbeleg:** `nav-registry.js:105` — „Behandlungen“ nur Owner; `dashboard.js:237` / `dashboard.js:238` / `dashboard.js:253` / `dashboard.js:254` / `dashboard.js:257` — aktuelle Labels; `module/podologie-abrechnung.js:825` — Dokumentation nach Erbringung; `module/podologie-abrechnung.js:901` — Speicherknopf.

**Zielbuild offen:** Ownerzugang, richtige Testverordnung, zulässiges Testdatum, Pflichtangaben/Sperren und Wiederanzeige der simulierten Behandlung prüfen. Daraus folgt keine automatische Abrechnungsbereitschaft. Für Mitarbeiter keinen gleichwertigen Menüweg behaupten; „§302-Abrechnung“ ist ebenfalls Ownerbereich (`nav-registry.js:109`).

## 8. Was bedeutet ein Billing-Ladefehler 503 oder 401?

**Antwortentwurf:** „Authentifizierungsdienst vorübergehend nicht verfügbar. Bitte später erneut versuchen.“ bezeichnet im belegten 503-/`AUTH_UNAVAILABLE`-Fall einen technischen Ausfall. Bei HTTP 401 konnte die Anfrage nicht autorisiert werden; der Preiskatalog meldet den Ladefehler. Beide Meldungen sind weder Preis noch Tarifentscheidung. Ein „—“ bei betroffenen Beträgen ist kein Nullpreis; bei Ladefehler keine Zahlung aus einem Ersatzbetrag ableiten. Später erneut prüfen; bei fortbestehendem Fehler Hilfeweg aus Frage 10 nutzen.

**Quellbeleg:** `api-backend/lib/auth-antwort.js:38` / `api-backend/lib/auth-antwort.js:43` / `api-backend/lib/auth-antwort.js:48` — feste Ausfallantwort und 401; `module/podologie-positionen.js:92` / `module/podologie-positionen.js:93` — aktuelle Katalogmeldungen; `module/verordnung-detail.js:282` / `module/verordnung-detail.js:288` — unbekannte Summen und Hinweis; `module/rezeptinfo-geld.js:458` / `module/rezeptinfo-geld.js:501` — Ausfall sperrt Berechnung/Kassieren im betroffenen GKV-Weg.

**Zielbuild offen:** Synthetisch 503/401/anschließend erfolgreiche Antwort im echten Dashboard prüfen: Meldung sichtbar, keine irreführende Null-/Teilsumme, Kassieraktion gesperrt und Erholung nachvollziehbar. Lokale Klassifizierung erklärt keine historische Live-401-Ursache und beweist keine ausgelieferte Reparatur.

## 9. Wie finde ich die Installationshilfe fürs Handy?

**Antwortentwurf:** Als Praxisleitung „Einstellungen“ → „App für Mitarbeiter“ öffnen. Der QR-Code führt zu `/app.html` derselben Praxis und gehört nur ins Team. Android zeigt je Browser Installationsangebot oder Menüanleitung; iPhone/iPad zeigt „Teilen“ → „Zum Home-Bildschirm“ → „Hinzufügen“. Auf dem Computer bietet die Seite „Zur Anmeldung“. QR-Code und Startbildschirmsymbol ersetzen keine Anmeldung.

**Quellbeleg:** `module/mitarbeiter-app-einstellungen.js:68` / `module/mitarbeiter-app-einstellungen.js:119` — Abschnitt und Ownergrenze; `module/mitarbeiter-app-einstellungen.js:27` / `module/mitarbeiter-app-einstellungen.js:32` — Teamhinweis und Ziel; `app.html:64` / `app.html:67` / `app.html:77` / `app.html:79` / `app.html:80` / `app.html:88` — Gerätewege; `module/app-installieren.js:59` — ohne sicheren Kontext Menühinweis statt Installationsangebot.

**Zielbuild offen:** QR-Ziel, Erreichbarkeit derselben isolierten Box, jeweilige OS-/Browsermenüs, Installation beziehungsweise Verknüpfung, Wiederöffnung und Anmeldung auf echten freigegebenen Testgeräten prüfen. Keine Geräte- oder Offlinefähigkeit aus vorhandener Anleitung ableiten; keine Zertifikatsänderung anweisen.

## 10. Wo finde ich Hilfe in der Box?

**Antwortentwurf:** „Feedback & Support“ öffnen. Im Boxmodus ersetzt der Code Ticketformular und Ticketliste durch „Support kontaktieren“. Der Link bereitet eine Mail im eigenen Mailprogramm vor; keine Patientendaten hineinschreiben. Öffnen des Links belegt weder Versand noch Eingang oder Antwortzeit.

**Quellbeleg:** `nav-registry.js:118` — Menü für Owner/Mitarbeiter; `dashboard.js:18` — Import der Boxanpassung; `module/support-kontakt.js:19` / `module/support-kontakt.js:21` — Betreff und `mailto`; `module/support-kontakt.js:31` / `module/support-kontakt.js:34` / `module/support-kontakt.js:38` — Label und Hinweis; `module/support-kontakt.js:40` / `module/support-kontakt.js:44` / `module/support-kontakt.js:48` — Ersatz von Formular/Liste nur im Boxmodus.

**Zielbuild offen:** In Boxkonfiguration mit beiden Testrollen Ersatzansicht und vorhandene Mailprogrammzuordnung prüfen; keinen Versand auslösen. Ohne geeigneten Mailclient bleibt der weitere Hilfeweg offen. Das statische „Neues Ticket“ aus `dashboard.html` ist kein belegter Box-Supportweg.

## Übergabe und Abschlussgrenze

- **Geschrieben:** zehn interne Fragen mit lokalen Quellbelegen und offenen Zielbuild-Prüfungen. Keine Produktdatei geändert; vorhandene SaaS-/Google-/Stripe-FAQ nicht übertragen.
- **Noch offen:** Zielbuild-/Rollen-/Gerätelauf, redaktionelle Abnahme und separate Veröffentlichungsfreigabe. Keine neue Hardware-, Provider-, Rechts-, Aufbewahrungs- oder Preisentscheidung.
- **Abgleichhinweis an Hauptagent:** Storyboard-Szene 10 erwartet „Neues Ticket“; tatsächliche Boxanpassung ersetzt es durch „Support kontaktieren“ (Frage 10). Storyboard und Aufnahmeplan vor Dreh entsprechend prüfen. Storyboard hier unverändert.
- **#25 bleibt offen:** FAQ-Entwurf ist keine fertige Box-FAQ. Storyboard vorhanden; echte Mediendatei und gemessene Laufzeit ≥300 Sekunden fehlen weiterhin. Tagesdatei, Wissensbank und Ops-Pflege bleiben beim Hauptagenten; keine eigene Karte geändert.

## Selbstquellprüfung

Am 23.10.2026: 83 eindeutige Datei:Zeile-Verweise in 19 Quelldateien auf Existenz und Zeilengrenzen geprüft. Zitierte Quellzeilen und zugehörige Ausschnitte inhaltlich gelesen; ungenaue Erstbelege präzisiert und korrigierte Inhaltsanker erneut geprüft. Zehn Fragen, jeweils Quellbeleg und offene Zielbuild-Prüfung vorhanden. Nur lokale Textprüfung; keine Produkt-/Browser-/DB-/Netztests.

Kontextbridge: ausschließlich `agy-context --local-only`, `provider_invoked: false`; kein Modellprovider-Aufruf. Zweite Suchantwort war fachlich unpassend und wurde verworfen; gezielte lokale Quelllektüre verwendet. Keine gemessene Netto-Tokenersparnis behauptet.

## Nachtrag Hauptagent — Storyboard-Abgleich

Szene 10 im eigenen Storyboard inzwischen quellenkonform korrigiert: Boxhilfe zeigt „Support kontaktieren“ per Mailprogramm. Zehn Szenen/330 geplante Sekunden bleiben; aktuelle Zählung 643 Sprecherwörter und 62 Referenzen. Historischer Abgleichhinweis oben beschreibt den Übergabezeitpunkt, keinen noch offenen Dokumentfehler. Zielbuild-/Rollen-/Geräteabnahme und tatsächliche Aufnahme bleiben offen.

## Lokaler synthetischer Teilnachweis — 24.10.2026

Status: lokal synthetisch geprüft; unabhängige Gegenprüfung läuft. Kein Zielbox-, Authserver-, Datenbank-, Persistenz-, Geräte-, Mailclient- oder Videonachweis. Aktueller Code einschließlich uncommittiertem Fix, HEAD weiterhin 9b173772.

| FAQ | Nachgewiesener lokaler Teil | Tatsächlicher Rest |
|---|---|---|
| 3 | Echtes Dashboard → + Termin → vorhandenen synthetischen Patienten auswählen; sichtbarer Name und verborgene Auswahl-ID stimmen; ohne Speichern schließen | tatsächliche Terminpersistenz und Prüfung auf vorbereiteter Zielbox |
| 4 | Vorhandener completed Termin → Akte sowie Patientenliste → gleiche Akte; identische Patienten-ID und sechs Podologie-Reiter, alle Reiter regulär erreichbar | Zielbuild mit echter Auth-/Datenbankgrenze, zugelassener synthetischer Praxisbestand |
| 8 | Bereits separat geprüfter 503/401/200- und Erholungspfad; 13er-Nachbarmatrix nach aktuellem Aktenfix erneut grün | veröffentlichter Zielbuild und historische Live-401-Ursache |
| 10 | Vier Box- und vier SaaS-Konfigurationen: Box ersetzt Formular/Liste durch Supportkontakt und Patientendatenhinweis, SaaS behält Formular; Mailto nur gelesen | Zielbox und Zuordnung zum Mailprogramm; keine Zustellung geprüft oder ausgelöst |

Neue FAQ-Matrix: 390/1280 px, hell/dunkel, Box/SaaS, acht Fälle mit 308 Assertions. Zunächst alle acht rot wegen **OPS-25-AKTE-TERMINE-CACHE-20261024**: Termin-Akteneingang besaß Patientendatensatz, Terminloader suchte ihn erneut im leeren allgemeinen Cache. Kleinster Fix reicht vorhandenen Lead direkt weiter; keine neue Abfrage oder Cachemutation. Identische Probe danach 8/8 grün; 31 Boundarychecks sowie sieben quellgebundene zusätzliche Fixture-Leseverträge mit 35 Negativguards separat geprüft. Keine unerwarteten Reads, Writes, HTTP-/WS-Versuche oder PageErrors in grünen Fällen. Die Fixture ersetzt SDK/definierte HTTP-Antworten; sie beweist keine realen Berechtigungen oder Speicherung.

Nachbarn: 13/13 Fälle, 257 Checks und 31 Boundarychecks grün. Ein früherer Navigationstimeout trat dabei nicht erneut auf; historische Ursache unbestimmt. Frontend 2181/2181, fünf Terminmodul-Grenztests und Typecheck grün. Belege: `Claude outputs/2026-10-23-ops-fortsetzung/faq25-after-rootfix-01/faq25-results.json`, `faq25-legacy-after-rootfix-01/faq25-legacy-results.json`, historischer Rotstand `faq25-matrix-01/faq25-results.json`. Kein Gesamthaken für #25.

## Prüfstand nach R1 — 24.10.2026

R1 bestätigte Produktfix mit acht eigenen Klickfällen, 388 Assertions, 32 sichtbaren Terminansichten samt Wiederöffnung, 83 Cache-/Vertragsgegenproben und 31 Boundarychecks. Zugleich REQUEST CHANGES für ursprüngliche Probe: leere History fälschlich akzeptiert. Root hat Prüflücke geschlossen; neue konkrete Zeilen-/Filterprüfung bleibt zusätzliche Testhärtung, keine weitere Produktänderung. Aktuelle finale Probe verlangt Datum, Uhrzeit, Leistung, Code, Dauer und „Erledigt“ nach normalem Aufklappen. R2 prüft diesen endgültigen Stand separat; bisherige 308er- und frühere 340er-Nachweise sind historische Stufen. Gesamtkarte #25 bleibt offen.

## Lokaler #25-Teilabschluss — 24.10.2026

- [x] ~~Produktfix und endgültige Testhärtung unabhängig abgenommen.~~ R3 APPROVE: beide Probe-Findings geschlossen. Acht eigene Positivfälle mit 340 bestehenden plus 16 zusätzlichen Sichtbarkeitschecks, 31 Boundarychecks grün. Acht Negativfälle korrekt rot, darunter leere Historie, 130 Minuten, falsche Uhrzeit und falscher Query-Scope. Filter und Fences erhalten; sieben Kernquellen sowie 226 geladene Quellen unverändert. Separate Intent-Quittierung erfolgt; kein Livebeweis. Endgültige Rootmatrix `faq25-exact-final-01`: 8/8, 340 Checks; 130-Minuten-Kontrolle `faq25-exact-negative130-01` korrekt rot. R1-/R2-Berichte gelten historischen Probeversionen, deren Findings jetzt geschlossen sind. Produktstand seit Cachefix unverändert.
- [x] ~~Ausführbare FAQ3/4/10-Teilprüfung und QR-Präzisierung lokal abgeschlossen.~~ Geprüfte UI-Schritte ohne Speichern oder Versand; neue Fehler repariert, Nachbarn bestanden, konkrete Grenzen dokumentiert.
- [ ] Gesamtkarte #25 und Parent #122 bleiben offen: fehlende echte Aufnahme A1–A10, Zielbox-/Auth-/Persistenz-/Geräteabnahme, Video mit gemessenen mindestens 300 Sekunden und abgenommene Box-FAQ. Keine neue Produktentscheidung, Veröffentlichung oder reale Datenprüfung freigegeben.
