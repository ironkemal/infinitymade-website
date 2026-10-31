# Ops #25 — Introvideo Podologie: lokales Storyboard

Stand: 23.10.2026. Ziel: 05:30 Minuten / 330 Sekunden, einschließlich Klick- und Lesepausen.

**Status: Dokument geschrieben, Quellbelege lokal geprüft. Kein Video aufgenommen, kein vollständiger Aufnahmeablauf reproduziert, keine Veröffentlichung. Einzelne lokale synthetische UI-Nachweise sind im Fortsetzungsplan separat dokumentiert. #25 bleibt hinsichtlich Video und Box-tauglicher FAQ offen.**

Grundlage: gemeinsamer Checkout `main`, HEAD bei Quellenaufnahme `9b173772`, einschließlich vorhandener uncommitteter Änderungen. Zeilenbelege gelten für diesen Arbeitsstand; vor Aufnahme erneut abgleichen. Pflichtberatung `legal-de` und `fonksiyon-ustasi` laut übergebenem Auftrag abgeschlossen. Hier keine erneute Beratung oder Delegation.

## Rahmen und Aufnahmevoraussetzungen

- Ausschließlich frische, isolierte synthetische Testpraxis **„Testpraxis Podologie“**. Patient **„Mia Beispiel“**, Mitarbeiter **„Alex Beispiel“**: vollständig erfunden; keine aus Bestandsdaten abgeleiteten Personen. Dauerhafte Einblendung: **„Synthetische Testdaten · keine echte Behandlung“**.
- Keine echten Konten, Kontakte, Versicherungsnummern, Dokumente, Unterschriften oder Zugangsdaten im Bild. Anmeldedaten außerhalb der Aufnahme eingeben; Aufnahme über redaktionellen Schnitt von leerer Anmeldemaske zur angemeldeten Testpraxis führen. Keine Einrichtungscodes filmen.
- Synthetische Musterverordnung vor Aufnahme fachlich konsistent vorbereiten. Einziger absichtlicher Mangel für Szene 5: fehlendes **Ausstellungsdatum**. Korrektur in Szene 6 ausschließlich anhand desselben synthetischen Musters. Diagnose, Heilmittel, Einheiten, Arzt-/Kassenangaben, Therapiezeit und Leistungen nicht während der Erzählung erfinden oder fachlich entscheiden. Pflichtwerte nur im isolierten Testbestand, keine unnötigen Kontakt-/Versicherungswerte im Storyboard oder im Bild.
- Testtermin und simulierte Tagesbehandlung gehören zu derselben Person und Verordnung. Keine zukünftige Leistung als erbracht darstellen. Für Szene 8 braucht dieselbe Testverordnung einen separat vorbereiteten, nachvollziehbaren synthetischen Abschlusszustand. Schnitt mit Einblendung **„Späterer Testzustand derselben Verordnung“**; keine automatische Abrechnungsbereitschaft durch einen Termin suggerieren.
- Zuständige Rolle, Fachbereich Podologie, Menüsichtbarkeit und §302-Zugang müssen im Aufnahmebuild vorhanden sein. Quelle allein beweist weder Box-Erreichbarkeit noch installierten Stand. **Alle folgenden Bildschirmzustände sind Erwartungen und offene Aufnahmevoraussetzungen.** Nicht erreichbaren Bildschirm als Blocker protokollieren; kein Ersatz durch Altdemo oder unbezeichnetes Mockup.
- Manuelle Erfassung ist Hauptweg. Keine pauschale KI-Aktivierung, Offlinefähigkeit, Kassenannahme, automatische Zustellung oder GoBD-Gesamtfreigabe zusagen. Keine Therapie- oder Zahlungsentscheidung vorführen. „Erstellen“, „Absenden“, „Teilen“ und Druckaktionen bleiben unbetätigt.
- `demo-dashboard.html` und `VIDEO_DEMO_DATEN.md` sind keine Belege für heutigen Boxablauf und wurden hierfür nicht verwendet.

## Schnitt- und Zeitplan

Zeitfenster sind Planwerte, keine gemessene Mediendauer. Sprechbudget ergibt sich aus Szenenlänge minus Pause. Probesprechen und echte Klickzeiten können Anpassungen innerhalb der 330 Sekunden erfordern.

| Szene | Start | Ende | Ziel Sekunden | Stumme Klick-/Lesepause Sekunden |
|---|---|---|---:|---:|
| 1 · Einstieg | 00:00 | 00:20 | 20 | 3 |
| 2 · Login und Navigation | 00:20 | 00:50 | 30 | 5 |
| 3 · Kalender | 00:50 | 01:25 | 35 | 6 |
| 4 · Patientenakte | 01:25 | 02:00 | 35 | 6 |
| 5 · Verordnung als Entwurf | 02:00 | 02:35 | 35 | 6 |
| 6 · Korrektur und Bestätigung | 02:35 | 03:10 | 35 | 6 |
| 7 · Behandlung und Leistungen | 03:10 | 03:50 | 40 | 7 |
| 8 · Abrechnung vorbereiten | 03:50 | 04:30 | 40 | 7 |
| 9 · App für Mitarbeiter | 04:30 | 05:05 | 35 | 6 |
| 10 · Hilfe und Abschluss | 05:05 | 05:30 | 25 | 4 |

Gesamt: 330 Sekunden; davon 56 Sekunden geplante stumme Bedien-/Lesepausen und 274 Sekunden Sprechbudget. Sprechertext ausschließlich in folgenden Zitatblöcken; Regie und Quellen nicht mitsprechen.

## Szenen

### 1 · 00:00–00:20 · Einstieg

**Bild/Aktion:** Titelkarte mit Testdatenhinweis, danach Übersicht mit Podologie-Navigation. Maus ruhig halten; 3 Sekunden Titel-/Orientierungspause.

**Erwarteter Zustand / offene Prüfung A1:** synthetische Praxis sichtbar, keine Bestandsdaten oder fremde Benachrichtigungen. Navigation tatsächlich im Aufnahmebuild prüfen.

**Codebeleg:** `nav-registry.js:93` — „Patienten“; `nav-registry.js:100` — „Verordnungen“; `nav-registry.js:105` — „Behandlungen“; `nav-registry.js:109` — „§302-Abrechnung“.

> Willkommen bei Praxura. Wir begleiten heute einen kleinen Ablauf aus einer podologischen Testpraxis: vom Termin über die Patientenakte und die Verordnung bis zur Vorbereitung der Abrechnung. Sämtliche gezeigten Daten sind erfunden. Wir beginnen mit der Anmeldung und orientieren uns anschließend in der Navigation.

### 2 · 00:20–00:50 · Login und Navigation

**Bild/Aktion:** leere `login.html` mit „E-Mail“, „Passwort“, „Anmelden“; Schnitt nach außerhalb des Bildes erfolgter Anmeldung. Anschließend Menüpunkte hervorheben, ohne andere Module zu öffnen. 5 Sekunden Bedienpause verteilen.

**Erwarteter Zustand / offene Prüfung A2:** regulärer Praxiszugang, kein Plattformadmin. Erfolgreiche Anmeldung und Rollenanzeige in isolierter Testpraxis erst reproduzieren; keine Zugangsdaten sichtbar.

**Codebeleg:** `login.html:317` — „E-Mail“; `login.html:320` — „Passwort“; `login.html:333` — „Anmelden“; `login.js:148` — Weiterleitung `dashboard.html`; `dashboard.js:172` — „Terminkalender“; `nav-registry.js:105` und `nav-registry.js:109` — hier gezeigte Bereiche nur für `owner`.

> Auf der Anmeldeseite stehen E-Mail und Passwort. Zugangsdaten blenden wir im Video aus. Nach der Anmeldung sehen wir die Bereiche unserer Testpraxis. Über den Terminkalender planen wir den Tag, unter Patienten öffnen wir die Akte. Verordnungen, Behandlungen und die §302-Abrechnung haben eigene Einstiege. Welche Bereiche verfügbar sind, hängt vom Zugang und von den eingerichteten Berechtigungen ab. Hier arbeiten wir als Praxisleitung.

### 3 · 00:50–01:25 · Kalender

**Bild/Aktion:** „Terminkalender“ → „Heute“ → vorbereiteten Testtermin öffnen. „+ Termin“ kurz zeigen, Dialog „Neuer Termin“ nur öffnen und wieder schließen; keine Buchung auslösen. 6 Sekunden zum Lesen von Datum, Person und Leistung.

**Erwarteter Zustand / offene Prüfung A3:** Testtermin eindeutig Mia Beispiel zugeordnet; Uhrzeit, Mitarbeiter und Leistung aus freigegebenem synthetischem Fall. Dialog und Terminansicht müssen im Zielbuild erreichbar sein.

**Codebeleg:** `dashboard.html:276` — „+ Termin“; `dashboard.html:286` — „Heute“; `dashboard.html:3090` — „Neuer Termin“; `dashboard.html:5056` — „Patientenakte“; `dashboard.js:210` — „Mitarbeiter“ und „Leistung“.

> Im Terminkalender wechseln wir mit Heute zum aktuellen Tag. Unser vorbereiteter Testtermin gehört zu Mia Beispiel. Wir öffnen ihn und vergleichen Uhrzeit, zuständigen Mitarbeiter und Leistung mit unserem Testfall. Über Plus Termin beginnt die Anlage eines weiteren Termins; heute bleibt es bei der vorhandenen Buchung. Ein eingetragener Termin dokumentiert noch keine erbrachte Behandlung. Für die Angaben zur Person gehen wir als Nächstes in die Patientenakte.

### 4 · 01:25–02:00 · Patientenakte

**Bild/Aktion:** im Termin „Patientenakte“ öffnen; dann Einstieg „Patienten“ mit „Suchen...“ zeigen und denselben Patienten erneut öffnen. Reiter „Verlauf“, „Anamnese“, „Fußbefund“, „Verordnungen“, „Dokumente“, „Rechnungen“ zeigen; keine Einwilligungen erzeugen. 6 Sekunden Lesepause.

**Erwarteter Zustand / offene Prüfung A4:** dieselbe synthetische Person in beiden Einstiegen; tatsächlich sechs Podologie-Reiter. Vorhandene synthetische Angaben nur zeigen, keine klinischen Befunde erfinden.

**Codebeleg:** `dashboard.html:359` — Suchfeld `leadSearch`; `dashboard.html:5056` — „Patientenakte“; `module/akte-podo.js:35` — sechs Reiter; `module/akte-podo.js:61` — Beschriftung „Verordnungen“ statt „Rezepte“; `dashboard.html:4142` — „Verlauf“.

> Die Patientenakte erreichen wir direkt aus dem Termin. Alternativ finden wir Mia Beispiel über die Suche im Bereich Patienten. In der Podologie gliedert sich die Akte in Verlauf, Anamnese, Fußbefund, Verordnungen, Dokumente und Rechnungen. Wir bleiben bei derselben Person und sehen uns die vorhandenen Testangaben an. So prüfen wir zuerst die Zuordnung, bevor wir eine Verordnung bearbeiten. Die gezeigten Befunde dienen ausschließlich diesem erfundenen Ablauf.

### 5 · 02:00–02:35 · Verordnung als Entwurf

**Bild/Aktion:** „Verordnungen“ → „+ Neue Verordnung“ → vorhandenen synthetischen Patienten wählen; vorbereitete Musterangaben übernehmen, Ausstellungsdatum bewusst leer lassen. „Speichern“ → Dialog „Als Entwurf speichern?“ lesen → „Als Entwurf speichern“. 6 Sekunden auf Hinweis und Entwurfskennzeichnung halten.

**Erwarteter Zustand / offene Prüfung A5:** eine neue Testverordnung, klarer Entwurf; Detailhinweis „Entwurf · noch zu prüfen“. Reproduzierbarkeit mit absichtlich fehlendem Datum und sämtlichen sonstigen notwendigen Testangaben offen. Keine Warnung verdecken.

**Codebeleg:** `dashboard.html:1410` — „+ Neue Verordnung“; `dashboard.html:3759` — „Speichern“; `dashboard.js:13980` — Prüfung Ausstellungsdatum; `dashboard.js:14004` — Entwurfsdialog einschließlich „Bis dahin ist keine Abrechnungsfreigabe möglich.“; `module/verordnung-detail.js:237` — „Entwurf · noch zu prüfen“.

> Unter Verordnungen öffnen wir Plus Neue Verordnung und ordnen Mia Beispiel zu. Die Angaben stammen aus unserer synthetischen Musterverordnung. Für diesen Schritt fehlt bewusst das Ausstellungsdatum. Beim Speichern erscheint deshalb die Frage Als Entwurf speichern. Wir lesen den Hinweis und speichern diesen Zwischenstand als Entwurf. Die Verordnung ist damit noch zu prüfen; daraus folgt keine Abrechnungsfreigabe. Ein Entwurf hilft, eine unvollständige Erfassung wiederzufinden und anschließend gezielt zu ergänzen.

### 6 · 02:35–03:10 · Korrektur und Bestätigung

**Bild/Aktion:** dieselbe Listenzeile öffnen; Ausstellungsdatum aus synthetischem Muster ergänzen; „Verordnung prüfen“, Ergebnisse lesen; „Speichern“. Keine Override-/Trotzdem-Aktion. 6 Sekunden auf Ergebnis und neu geladenem Status halten.

**Erwarteter Zustand / offene Prüfung A6:** dieselbe Verordnung nach Korrektur; erfolgreiche erneute Prüfung und tatsächliche Bestätigung überprüfen. Es gibt hier keinen behaupteten UI-Knopf „Bestätigen“: Speichern führt über erneute Validierung. Erwarteter Backendstatus `confirmed` nur bei sauberem Durchlauf; genaue sichtbare Statusbeschriftung vor Dreh dokumentieren. Bleiben aktuelle Prüfprobleme oder Entwurfsstatus bestehen, Szene blockiert. Historischer Hinweis „Trotz Lücken gespeichert“ kann nach Korrektur erhalten bleiben; ihn nicht als neuen Fehler oder als verschwundene Historie darstellen.

**Codebeleg:** `module/verordnung-liste.js:139` — Öffnen gespeicherter Verordnung; `module/verordnung-pruefen-knopf.js:222` — „Verordnung prüfen“; `module/verordnung-maske.js:836` — bestehende Verordnung per PATCH; `api-backend/server.js:2898` — erneute Entwurfsentscheidung; `api-backend/server.js:2899` — Übergang von `parsed` zu `confirmed`; `dashboard.js:14065` — Ergebnis „Verordnung aktualisiert ✓“; `module/verordnung-maske.js:809` — ursprüngliche Lückenspur bleibt erhalten; `module/verordnung-detail.js:238` — historischer Hinweis „Trotz Lücken gespeichert“.

> Jetzt öffnen wir genau diesen Entwurf erneut. Wir ergänzen das Ausstellungsdatum anhand unserer Musterverordnung und wählen Verordnung prüfen. Die Ergebnisse lesen wir vor dem erneuten Speichern. Für diesen vorbereiteten Testfall müssen die offenen Angaben geklärt sein. Erst danach zeigen wir den bestätigten Erfassungsstand. Die Bestätigung betrifft die gespeicherten Verordnungsangaben. Sie ersetzt weder die fachliche Prüfung des Originals noch eine Entscheidung der Krankenkasse über die spätere Abrechnung.

### 7 · 03:10–03:50 · Behandlung und Leistungen

**Bild/Aktion:** kurz „Leistungen“ zeigen; anschließend „Behandlungen“, dieselbe Verordnung unter „Aktive Verordnungen“ auswählen. „Tagesbehandlung erfassen“, „Behandlungsdatum“, „HPNR-Codes“ und „Notizen“ zeigen. Ausschließlich vorbereitete Simulation dokumentieren; „Behandlung speichern“ im isolierten Testlauf. 7 Sekunden für Kontrolle und Ergebnis.

**Erwarteter Zustand / offene Prüfung A7:** Formular nicht gesperrt; Testleistung gehört zu dieser Verordnung; Testdatum nicht zukünftig; erforderliche Nachweise im synthetischen Fall vorbereitet. Speichern und Wiederanzeige offen. Keine Preis-, Therapiezeit- oder Zuzahlungsentscheidung improvisieren; bei Sperre stoppen.

**Codebeleg:** `dashboard.js:173` — „Leistungen“; `dashboard.html:1682` — „Behandlungen“; `dashboard.js:237` — „Aktive Verordnungen“; `dashboard.js:238` — „Tagesbehandlung erfassen“; `dashboard.js:253` — „Behandlungsdatum“; `dashboard.js:254` — „HPNR-Codes“; `dashboard.js:257` — „Behandlung speichern“; `module/podologie-abrechnung.js:901` — Speicherknopf; `module/podologie-abrechnung.js:825` — Dokumentation nach Erbringung.

> Leistungen und Behandlungen erfüllen unterschiedliche Aufgaben. Unter Leistungen sehen wir das eingerichtete Angebot. Unter Behandlungen wählen wir unsere Verordnung aus und erfassen die Tagesbehandlung. Datum, Leistungszuordnung und gegebenenfalls weitere Pflichtangaben vergleichen wir mit dem vorbereiteten Testfall. Wir wählen hier keine Therapie für einen echten Menschen aus. Auch die Dokumentation einer erbrachten Leistung wird nur simuliert. Vor Behandlung speichern lesen wir Hinweise und kontrollieren die Auswahl. Anschließend prüfen wir, ob der Eintrag an derselben Verordnung wieder erscheint.

### 8 · 03:50–04:30 · Abrechnung vorbereiten

**Bild/Aktion:** beschrifteter Zeitsprung zum vorbereiteten späteren Testzustand derselben Verordnung. „§302-Abrechnung“ öffnen, „Abrechnungszeitraum“ einstellen, zugehörige Kassengruppe aufklappen und Angaben lesen. Maus vor „Erstellen“ stoppen; keine Datei erzeugen, keinen Versand starten. 7 Sekunden Lesepause.

**Erwarteter Zustand / offene Prüfung A8:** Zugang freigeschaltet; derselbe Fall nach nachvollziehbarem synthetischem Abschluss in Auswahlliste. Keine künstlich erzwungene Bereitschaft. Fehlt Fall oder Karten-IK, tatsächlichen Hinweis als Blocker erfassen und Testvoraussetzung korrigieren, nicht wegschneiden.

**Codebeleg:** `nav-registry.js:109` — „§302-Abrechnung“; `module/abrechnung-auswahl.js:839` — „Abrechnungszeitraum“; `module/abrechnung-auswahl.js:865` — Kassengruppe öffnen; `module/abrechnung-auswahl.js:878` — „Erstellen“; `module/abrechnung-auswahl.js:829` — Hinweis zu fehlendem Karten-IK.

> Für die Abrechnung wechseln wir zu einem vorbereiteten späteren Testzustand derselben Verordnung. Dieser Schnitt überspringt keine Arbeitsschritte im echten Praxisalltag. In der §302-Abrechnung begrenzen wir den Abrechnungszeitraum und öffnen die zugehörige Kassengruppe. Wir kontrollieren den Fall und die angezeigten Angaben. Fehlende oder widersprüchliche Daten müssen vor dem nächsten Schritt geklärt werden. Dieses Intro endet bei der Vorbereitung. Wir drücken Erstellen nicht und übertragen keine Datei. Eine vorbereitete Abrechnung ist noch keine Zusage über die Annahme durch eine Krankenkasse.

### 9 · 04:30–05:05 · App für Mitarbeiter

**Bild/Aktion:** „Einstellungen“ → Abschnitt „App für Mitarbeiter“ mit QR-Code aus ausschließlich synthetischer Testpraxis. In gesonderter Testgeräteaufnahme `app.html` zeigen; plattformspezifische Anleitung und „Zur Anmeldung“ hervorheben. „Teilen“, „Link kopieren“, „QR-Code drucken“ nur zeigen. 6 Sekunden Lesepause.

**Erwarteter Zustand / offene Prüfung A9:** Owner-Abschnitt und generierter Test-QR sichtbar; Testgerät erreicht dieselbe isolierte Praxis. Geräteschritte erst reproduzieren; keine erfolgreiche Installation behaupten, bevor sie geprüft wurde. Keine echte Praxisadresse oder Codes filmen; falls isolierte Zieladresse fehlt, Szene blockiert.

**Codebeleg:** `module/mitarbeiter-app-einstellungen.js:68` — „App für Mitarbeiter“; `module/mitarbeiter-app-einstellungen.js:91` — „Teilen“; `module/mitarbeiter-app-einstellungen.js:119` — Owner-Bedingung; `module/mitarbeiter-app-einstellungen.js:32` — QR-Ziel `/app.html`; `module/mitarbeiter-app-einstellungen.js:27` — nur im Team; `app.html:64` — „App installieren“; `app.html:79` — „Zum Home-Bildschirm“; `app.html:88` — „Zur Anmeldung“.

> Unter Einstellungen finden wir App für Mitarbeiter. Der QR-Code führt zuerst zur Installationshilfe der jeweiligen Praxis und gehört nur ins Team. Er ersetzt weder ein eigenes Konto noch die Anmeldung. Auf der Installationsseite stehen die Schritte für das verwendete Gerät: bei Android die angebotene Installation, beim iPhone der Weg über Teilen und Zum Home-Bildschirm. Wir zeigen diese Anleitung an unserem Testgerät. Daraus folgt keine Zusage, dass sämtliche Funktionen ohne Verbindung verfügbar sind.

### 10 · 05:05–05:30 · Hilfe und Abschluss

**Bild/Aktion:** „Feedback & Support“ → im Boxmodus „Support kontaktieren“ und Hinweis „Bitte keine Patientendaten in die Mail“ zeigen. Link nicht anklicken, kein Mailprogramm öffnen oder Versand auslösen. Optional lokal erreichbare `support.html` bei „Häufige Fragen“ zeigen, deutlich „FAQ für Boxbetrieb noch abzugleichen“ einblenden. Falls Seite fehlt, keine eingeblendete Altdemo als Ersatz. 4 Sekunden Abschlussbild.

**Erwarteter Zustand / offene Prüfung A10:** im Boxmodus ersetzt die Kontaktansicht Formular und Ticketliste. Aufnahmebuild und Betriebsmodus vor Dreh festhalten; das SaaS-Ticketformular nicht als Boxweg ausgeben. FAQ-Erreichbarkeit und Box-Eignung offen; bestehende Abo-/Stripe-/Google-Einträge nicht als Box-Anleitung vorlesen. Kein Supportversand und keine Antwortzeit versprechen.

**Codebeleg:** `nav-registry.js:118` — „Feedback & Support“; `module/support-kontakt.js:21` — mailto-Link; `module/support-kontakt.js:31` / `module/support-kontakt.js:34` — Titel und Datenhinweis; `module/support-kontakt.js:40` / `module/support-kontakt.js:48` — Ersetzung im Boxmodus; `support.html:159` — „Häufige Fragen“; `support.html:162` — Abo-Frage; `support.html:166` — Google-Kalender-Frage; `support.html:174` — Mitarbeiterkonto-Frage.

> Bei Fragen finden Sie Feedback und Support in der Navigation. In der Box führt Support kontaktieren zum eigenen Mailprogramm. Bitte keine Patientendaten mitsenden. Wir zeigen nur den Einstieg. Die häufigen Fragen müssen noch für den Boxbetrieb abgeglichen werden. Üben Sie diesen Ablauf zunächst mit synthetischen Daten in einer eingerichteten Testpraxis.

## Aufnahme- und Abnahmeprotokoll — noch auszufüllen

1. Frischen isolierten synthetischen Testbestand und Aufnahmebuild festhalten: Datum, Commit plus Arbeitsstand, Fachbereich, Rollen und Geräte. Keine Zugangsdaten protokollieren. A1–A10 anhand tatsächlicher Klickfolge reproduzieren und erwarteten gegen erreichten Bildschirmzustand abgleichen.
2. Gleiche Person und Verordnung durch Szenen 3–8 nachweisen. Fehlendes Datum → Entwurf → Korrektur → erneute Prüfung → Bestätigung wirklich reproduzieren. Sichtbare Statuslabels und eventuelle Warnungen festhalten. Getrennter späterer Testzustand für Szene 8 muss nachvollziehbar bleiben.
3. Alle Bildschirmaufnahmen ausschließlich aus dieser Testpraxis erstellen. Bei fehlender Erreichbarkeit oder abweichendem Label Storyboard vor Dreh korrigieren; kein unerreichbarer Bildschirm als funktionsfähig zeigen. Text- und Quellprüfung ersetzt diesen Lauf nicht.
4. FAQ in `support.html` ist vorhanden, aber noch keine abgenommene Box-FAQ: Abo/Stripe/Google-Inhalte fachlich auf Einsatzmodell prüfen; Login, Mitarbeiterzugang, manuelle Erfassung/Entwurfskorrektur und Hilfe anhand erreichbarer Boxwege redaktionell abgleichen. Änderung und Veröffentlichung außerhalb dieses Auftrags. Keine FAQ-Fertigmeldung für #25.
5. Sprechertext probesprechen; Pausen im echten Klicklauf messen. Fertiges Video vollständig ansehen. **Gemessene Laufzeit mindestens 300 Sekunden**, Ziel 330 Sekunden. Messnachweis später mit Dateiname, lokalem Pfad, Laufzeitwerkzeug und dessen Ausgabe ergänzen. Aktueller Messwert: **nicht vorhanden**, keine Mediendatei erstellt.
6. Vor Abnahme prüfen: lesbare UI, hörbarer Text, Testdatenhinweis, keine fremden Daten, keine Zugangsdaten, keine unbelegten Versprechen. Tatsächlich reproduzierter aktueller Workflow und aufgenommene Medien müssen vorliegen. **Veröffentlichung ausschließlich nach separatem ausdrücklichem GO.**

## Lokaler Dokumentprüfnachweis vor Box-Support-Korrektur

Diese Prüfungen betreffen nur Prosa und Quellreferenzen. Keine Produkt-, Browser-, DB- oder Netztests.

- Zeitmarkenprüfung am 23.10.2026: lokaler Python-Check PASS. Zehn Tabellenzeilen und zehn Szenenüberschriften stimmen überein; lückenlos 00:00–05:30, Summe 330 Sekunden, Pausen 56 Sekunden, Sprechbudget 274 Sekunden.
- Sprechertextzählung am 23.10.2026: lokaler Python-Check PASS. Zehn Zitatblöcke, 641 Wörter per Leerraumzählung; Ziel 600–750 erfüllt. Rechnerisch etwa 140,4 Wörter/Minute während des Sprechbudgets; noch nicht probesprochen.
- Referenzprüfung am 23.10.2026: lokaler Python-Check PASS. 59 eindeutige Datei:Zeile-Verweise in 16 Quelldateien; Existenz, Zeilengrenzen und passender Inhaltsanker auf jeder exakten Quellzeile geprüft. Anfangs ungenaue Zeilen korrigiert; Inhaltsabgleich anschließend ohne Fehler. Jede Szene enthält Aktion, erwarteten Bildschirmzustand, offene Aufnahmeprüfung und Codebeleg.
- Provider: `agy-context --local-only`, kein Modellaufruf (`provider_invoked: false`). Keine gemessene Netto-Tokenersparnis behauptet.
- Scope: nur diese neue Datei. Tagesdatei, Wissensbank und übergeordneter Plan bleiben beim Hauptagenten.

Nachtrag 23.10.2026, Folgeauftrag: Szene 10 nach direktem Quellabgleich um Box-Supportweg berichtigt. Ursache war die statische SaaS-Ticketansicht im HTML; das importierte Boxmodul ersetzt sie. Kein Produktfehler. Erneute lokale Prüfung nach Korrektur PASS: zehn lückenlose Szenen, unverändert 330 Sekunden, nun 643 Sprecherwörter und 62 Referenzen aus 17 Quelldateien; rechnerisch etwa 140,8 Wörter/Minute im Sprechbudget. Keine gemessene Mediendauer. Box-FAQ-Entwurf: `konsey/tutanak/2026-10-23-ops-25-box-faq-entwurf.md`.

Nachtrag 23.10.2026, nächster lokaler FAQ-Prüfauftrag: Szene 9 präzisiert QR-Ziel als zuerst Installationshilfe (`/app.html`), anschließend Anmeldung. Keine Änderung an Produkt oder Zeitplanung. Dokumentprüfung PASS: zehn lückenlose Szenen, 330 geplante Sekunden, 56 Pausensekunden, 644 Sprecherwörter; 62 eindeutige Referenzen aus 17 Quelldateien auf Existenz und Zeilengrenzen geprüft, QR-Quellanker exakt abgeglichen. Keine neue semantische Gesamtprüfung aller Altbelege oder gemessene Videodauer. Statuszeile benennt weiterhin fehlenden vollständigen Aufnahmeablauf; einzelne synthetische UI-Belege sind gesondert dokumentiert. Ergebnis: `Claude outputs/2026-10-23-ops-fortsetzung/faq25-storyboard-check.json`.

Nachtrag 24.10.2026: Szenen 3/4/10 haben zusätzliche lokale synthetische Teilnachweise laut FAQ-Nachtrag, keine vollständige Aufnahmeabnahme A1–A10. Patienten-Auswahl ohne Speichern, beide Akteneingänge und Box-/SaaS-Supportvergleich nach Cachefix 8/8 grün. Aufnahme verwendet weiterhin gesondert vorzubereitenden Musterfall; der Browsernachweis mit Synthetisch Testpatient ersetzt keine Aufnahme mit Mia Beispiel. Keine Behandlung oder Entwurfsänderung gespeichert, kein Mailversand, kein Video aufgenommen. Drei Dashboard-Quellzeilen je Dokument nach entfernter Codezeile um eins korrigiert; jeweiliger ursprünglicher Quellinhalt exakt identisch. Zeit-/Sprecherplanung unverändert.

## Lokaler #25-Teilabschluss — 24.10.2026

- [x] ~~Produktfix und endgültige Testhärtung unabhängig abgenommen.~~ R3 APPROVE: beide Probe-Findings geschlossen. Acht eigene Positivfälle mit 340 bestehenden plus 16 zusätzlichen Sichtbarkeitschecks, 31 Boundarychecks grün. Acht Negativfälle korrekt rot, darunter leere Historie, 130 Minuten, falsche Uhrzeit und falscher Query-Scope. Filter und Fences erhalten; sieben Kernquellen sowie 226 geladene Quellen unverändert. Separate Intent-Quittierung erfolgt; kein Livebeweis. Endgültige Rootmatrix `faq25-exact-final-01`: 8/8, 340 Checks; 130-Minuten-Kontrolle `faq25-exact-negative130-01` korrekt rot. R1-/R2-Berichte gelten historischen Probeversionen, deren Findings jetzt geschlossen sind. Produktstand seit Cachefix unverändert.
- [x] ~~Ausführbare FAQ3/4/10-Teilprüfung und QR-Präzisierung lokal abgeschlossen.~~ Geprüfte UI-Schritte ohne Speichern oder Versand; neue Fehler repariert, Nachbarn bestanden, konkrete Grenzen dokumentiert.
- [ ] Gesamtkarte #25 und Parent #122 bleiben offen: fehlende echte Aufnahme A1–A10, Zielbox-/Auth-/Persistenz-/Geräteabnahme, Video mit gemessenen mindestens 300 Sekunden und abgenommene Box-FAQ. Keine neue Produktentscheidung, Veröffentlichung oder reale Datenprüfung freigegeben.
