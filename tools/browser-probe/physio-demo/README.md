# Lokale Physiotherapie-Testpraxis

## Für Partner: in drei Schritten starten

Voraussetzung: Node.js (Version 20 oder neuer) und das Praxura-Repository. `npm install` ist **nicht** nötig. Remote-Anleitung setzt voraus, dass der gewünschte Commit bereits auf dem Branch veröffentlicht wurde; ungepushte lokale Änderungen werden damit nicht übertragen.

1. Branch holen: `git fetch origin && git checkout redesign/praxura-design && git pull`
2. Starten (macOS/Linux): `TAG=2026-10-30 node tools/browser-probe/physio-demo/server.mjs`
   Windows (PowerShell): `$env:TAG="2026-10-30"; node tools/browser-probe/physio-demo/server.mjs`
3. Im Browser öffnen: http://127.0.0.1:18086/dashboard.html?design=neu

Angestelltenansicht: zusätzlich `ROLLE=employee` (PowerShell: `$env:ROLLE="employee"`). Beenden mit Strg+C.
Vorführweg: Leistungen → Patient anlegen → Anamnese → Verordnung (Heilmittel aus der Liste wählen) →
Termin mit Verordnung, „Mehr Optionen“ → „Serientermin“ → Kalender: Termin anklicken → „Termin starten“ → Notiz.
Nicht verfügbar (gesperrt): KI („Einheiten als Serie verteilen“), Versand, Zahlungen. Startseite und Abrechnung zeigen aktuelle Rezept-/Sitzungszähler aus dem eigenen browserlokalen Store. Geldbeträge bleiben ausdrücklich unbekannt; eine vollständige Abrechnungskette ist damit nicht abgenommen.

Aktueller lokaler Arbeitsordner: `/Users/melihdonmez/.t3/worktrees/infinitymade-website/redesign-praxura-design`, Branch `redesign/praxura-design`. Vor Start `git rev-parse --short HEAD` und `git status --short` prüfen; Nachweise am Arbeitsstand sind kein veröffentlichter Releasepin.

Behandlungsdokumentation wartet bestätigte Sitzungszeile einschließlich exaktem Notiztext ab. Speicherfehler oder fehlende Bindung halten den Ablauf an; Notiz bleibt für denselben Benutzer/Owner/Termin im Arbeitsspeicher erneut verfügbar. Browserneustart verwirft diesen ungespeicherten Entwurf. Seriensitzungen werden nur innerhalb verordneter Nummern, passender Owner-/Patientenbindung und atomar freiem `planned`-Stand beansprucht. Automatische Einzelterminauswahl übernimmt keine bereits gebundene Seriensitzung.

## Räume für Termine

1. **Verfügbarkeit** öffnen, unten unter **Räume** Namen eingeben und **Raum anlegen** wählen. Vorhandene Namen lassen sich mit **Umbenennen** ändern; Terminzuordnungen bleiben erhalten.
2. Beim neuen Einzeltermin oder unter **Mehr Optionen → Serientermin** im Feld **Raum** einen Raum wählen. Die Serie übernimmt diesen Raum für sämtliche tatsächlich erstellten Termine.
3. Bestehenden Termin im Kalender anklicken: unten **Raum** wählen und **Raum zuweisen** drücken. Im Bearbeitungsformular erscheint die bestehende Auswahl ebenfalls.

Überlappende Belegungen desselben Raums werden auch bei verschiedenen Behandlern abgewiesen. Direkt angrenzende Termine sind erlaubt; abgesagte Termine geben den Raum frei. **Kein Raum zugewiesen** entfernt die Zuordnung. Namen und Zuordnungen überstehen Neuladen im selben Browser/Origin.

**Nur lokale Testpraxis:** Räume stehen in `demo_rooms`, Zuordnungen in `demo_room_assignments` im gleichen Browserspeicher. Aktueller Umfang ist der synthetische Standardstandort ohne `business_id`; fremde Standortzuordnungen werden abgewiesen. Keine produktive Raumspalte, echte Datenbank oder geräteübergreifende Synchronisierung. Produktiver Mehrnutzerbetrieb braucht ein separates geprüftes Datenmodell mit serverseitiger Kollisionssicherung. Die Raumfunktionen werden nur vom lokalen Demo-Server injiziert; normales Hosting erhält sie nicht.

Raumprüfung und fünf Vorführabläufe gemeinsam:

```sh
PORT=18089 node tools/browser-probe/physio-demo/ablauf-probe.mjs
```

Benötigt vorhandenes Playwright; Starten/Benutzen der Testpraxis selbst weiterhin ohne `npm install`.

Start aus dem Repository:

```sh
rtk proxy node tools/browser-probe/physio-demo/server.mjs
```

Öffnen: http://127.0.0.1:18086/dashboard.html?design=neu

Optional `PORT=18086`, `ROLLE=owner` oder `employee`, `TAG=2026-10-30` setzen. Der Server bindet ausschließlich `127.0.0.1`. Ein belegter Port führt zum Fehler, nicht zum Ausweichen auf einen fremden Server.

Leistungen, Patienten und verfügbare direkte Formular-Schreibwege verwenden ausschließlich synthetische Tabellen. Unterstützte direkte CRUD-Schreibwege speichern im Browser unter `praxura-physio-demo-v2` (ältere `v1`-Stände bleiben ungelesen liegen). Ein anderer Browser oder Port hat einen eigenen Stand. Zum Zurücksetzen in den Browser-Entwicklerwerkzeugen ausschließlich diesen LocalStorage-Schlüssel entfernen und neu laden. Die bisherige Podologie-Demo auf Port 18083 bleibt unabhängig.

Die Termine liegen nur auf Werktagen; am Wochenende ist die Tagesansicht daher leer. Die mitgelieferten Physio-Daten werden vor einem vorhandenen Browserstand geladen. Danach gewinnt der gespeicherte Stand. Neue Datensatzversionen brauchen daher einen bewussten Reset dieses Demo-Schlüssels.

## Grenzen

- Keine echte Datenbank, Anmeldung, Verschlüsselungs-, Rollen- oder RLS-Abnahme. Mitarbeiteransicht ist eine synthetische Rollenprobe, kein Sicherheitsnachweis.
- Direkte Schreibwege für Patienten, Leistungen, Termine, Verordnungen, Sitzungen, Physio-Anamnese, Einwilligungen, Rechnungen (Nummer `DEMO-…`), Abwesenheiten und Messreihen sind lokal unterstützt. Nicht jeder UI-Weg verwendet direkte Tabellenzugriffe.
- Leistungszuordnung `employee_services` ist lokal schreibbar. Neue `anamnese`-Einträge emulieren ausschließlich für die Demo die Versionierung pro Owner/Patient/Fachbereich: bisherige Versionen werden inaktiv, neue Version wird aktuell. Das ist keine Abnahme des echten DB-Triggers oder seiner Transaktionssicherheit.
- Ausschließlich `POST /api/rezept/confirm`, `PATCH /api/rezept/<UUID>` und `POST /api/booking/batch-create` werden über einen lokalen Browseradapter an Originalhandler mit synthetischem Speicher gereicht. Ohne verfügbare Engine Fehler 503. Keine echte DB oder Produktionsauthentifizierung. Sonstige Backendaktionen einschließlich Slotabfrage bleiben gesperrt/501.
- Die interne Engine-Schnittstelle akzeptiert nur lokalen Host und Origin, JSON bis 2 MiB und die drei erlaubten Pfade. Nur erfolgreiche Antworten werden gespeichert. Fehler verwerfen auch mögliche interne Teiländerungen: diese lokale Transaktionshülle ist kein Beleg für Produktions-Transaktionsverhalten. Parallele Aktionen oder zwischenzeitlich geänderter Browserstand ergeben 409 statt Überschreiben.
- Versand, KI, OAuth und Zahlungen sind gesperrt. Unterschriften und Dokumente landen bis 1 MiB als Data-URL in `demo_storage` im Browserspeicher, das ist keine Storage-Abnahme. Finanz-API weiterhin 501; die getrennte lokale Rezept-/Sitzungsübersicht berechnet keine Geldbeträge. Sie zählt gespeicherte Physio-Verordnungen, exakten Status „bereit“ und gültig zugeordnete aktive Sitzungszeilen. „Bereit“ ist keine Versandfreigabe, Sitzungszeilen sind keine Behandlungstage.
- Zähler aktualisieren sich nach erfolgreicher lokaler Speicherung und bei Neuladen. „Übersicht aktualisieren“ liest ebenfalls den aktuellen Store. Owner-/Patienten-/Standort- und Terminzuordnungen werden vor Anzeige geprüft; Mitarbeiter erhalten keine Zählerkarte. Fehlende Quellen, Speicherfehler oder unbelegte Leistungsindizes ergeben Unbekannt beziehungsweise bekannte Teilmenge. Keine Tarifberechnung und keine Produktionsauth-/RLS-Abnahme.
- Original-Lesefixture ist teilweise nachsichtig: unbekannte Tabellen können leere Ergebnisse liefern. Lesefilter `.or()` wertet `filter.mjs` aus (and/or/not/in, Anführungszeichen); unbekannte Syntax oder referencedTable bleibt ungefiltert. Keine Vollständigkeits-/Scope-Aussage daraus ableiten.
- Ein gezielt unterstützter Standortfilter `business_id.eq.<UUID>,business_id.is.null` schneidet zusammen mit dem gesendeten Ownerfilter A/NULL gegen B/Fremdowner zu. Das belegt nur diesen lokalen Filter, keine allgemeine Mehrstandort-/RLS-Abnahme. OR-Schreibwege bleiben gesperrt.
- Nicht unterstützte Schreibfilter/RPCs scheitern ausdrücklich. Ungefilterte Updates und Löschungen sind gesperrt. LocalStorage-Fehler setzen die lokale Tabellenänderung zurück.
- Nur Runtime-Dateien werden lokal ausgeliefert. HTTP+WS dürfen aufgrund CSP ausschließlich lokal bleiben; der Server leitet nichts an externe Dienste weiter.

Prüfung ohne Listener:

```sh
rtk proxy node --test tools/browser-probe/physio-demo/server.test.js
```

Gezielte Zählerprüfung (vorhandenes Playwright, nur lokale synthetische Fixture-Schreibwege):

```sh
rtk proxy node --test tools/browser-probe/physio-demo/controlling.test.js
rtk proxy node tools/browser-probe/physio-demo/controlling-probe.mjs
```

Der Normalbetrieb kennzeichnet die Testpraxis mit dem Hinweis „Testpraxis“ in der Kopfleiste (Details im Tooltip). Wiederherstellungsfehler beim Lesen/JSON bleiben getrennt vom Schreibstatus. Übersicht zeigt dann Unknown, die feste Hinweisleiste unten kennzeichnet Startdaten als Beispiele, lokale Schreibwege sind gesperrt. Beschädigter Speicher wird nicht automatisch durch Seed ersetzt; kein automatischer Reset. Nullable Felder neuer synthetischer Patienten/Termine/Sitzungen sowie Abrechnungsachse erhalten nur belegte SQL-NULL-Werte, bestehende unbekannte Felder werden nicht nachträglich normalisiert.
