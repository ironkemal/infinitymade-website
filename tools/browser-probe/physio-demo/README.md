# Lokale Physiotherapie-Testpraxis

## Für Partner: in drei Schritten starten

Voraussetzung: Node.js (Version 20 oder neuer) und das Praxura-Repository. `npm install` ist **nicht** nötig.

1. Branch holen: `git fetch origin && git checkout redesign/praxura-design && git pull`
2. Starten (macOS/Linux): `TAG=2026-10-30 node tools/browser-probe/physio-demo/server.mjs`
   Windows (PowerShell): `$env:TAG="2026-10-30"; node tools/browser-probe/physio-demo/server.mjs`
3. Im Browser öffnen: http://127.0.0.1:18086/dashboard.html?design=neu

Angestelltenansicht: zusätzlich `ROLLE=employee` (PowerShell: `$env:ROLLE="employee"`). Beenden mit Strg+C.
Vorführweg: Leistungen → Patient anlegen → Anamnese → Verordnung (Heilmittel aus der Liste wählen) →
Termin mit Verordnung, „Mehr Optionen“ → „Serientermin“ → Kalender: Termin anklicken → „Termin starten“ → Notiz.
Nicht verfügbar (gesperrt): KI („Einheiten als Serie verteilen“), Versand, Zahlungen. Abrechnungszahlen sind feste Beispiele.

Start aus dem Repository:

```sh
rtk proxy node tools/browser-probe/physio-demo/server.mjs
```

Öffnen: http://127.0.0.1:18086/dashboard.html?design=neu

Optional `PORT=18086`, `ROLLE=owner` oder `employee`, `TAG=2026-10-30` setzen. Der Server bindet ausschließlich `127.0.0.1`. Ein belegter Port führt zum Fehler, nicht zum Ausweichen auf einen fremden Server.

Leistungen, Patienten und verfügbare direkte Formular-Schreibwege verwenden ausschließlich synthetische Tabellen. Unterstützte direkte CRUD-Schreibwege speichern im Browser unter `praxura-physio-demo-v1`. Ein anderer Browser oder Port hat einen eigenen Stand. Zum Zurücksetzen in den Browser-Entwicklerwerkzeugen ausschließlich diesen LocalStorage-Schlüssel entfernen und neu laden. Die bisherige Podologie-Demo auf Port 18083 bleibt unabhängig.

Die mitgelieferten Physio-Daten werden vor einem vorhandenen Browserstand geladen. Danach gewinnt der gespeicherte Stand. Neue Datensatzversionen brauchen daher einen bewussten Reset dieses Demo-Schlüssels.

## Grenzen

- Keine echte Datenbank, Anmeldung, Verschlüsselungs-, Rollen- oder RLS-Abnahme. Mitarbeiteransicht ist eine synthetische Rollenprobe, kein Sicherheitsnachweis.
- Direkte Schreibwege für Patienten, Leistungen, Termine, Verordnungen, Sitzungen und Physio-Anamnese sind lokal unterstützt. Nicht jeder UI-Weg verwendet direkte Tabellenzugriffe.
- Leistungszuordnung `employee_services` ist lokal schreibbar. Neue `anamnese`-Einträge emulieren ausschließlich für die Demo die Versionierung pro Owner/Patient/Fachbereich: bisherige Versionen werden inaktiv, neue Version wird aktuell. Das ist keine Abnahme des echten DB-Triggers oder seiner Transaktionssicherheit.
- Ausschließlich `POST /api/rezept/confirm`, `PATCH /api/rezept/<UUID>` und `POST /api/booking/batch-create` werden über einen lokalen Browseradapter an Originalhandler mit synthetischem Speicher gereicht. Ohne verfügbare Engine Fehler 503. Keine echte DB oder Produktionsauthentifizierung. Sonstige Backendaktionen einschließlich Slotabfrage bleiben gesperrt/501.
- Die interne Engine-Schnittstelle akzeptiert nur lokalen Host und Origin, JSON bis 2 MiB und die drei erlaubten Pfade. Nur erfolgreiche Antworten werden gespeichert. Fehler verwerfen auch mögliche interne Teiländerungen: diese lokale Transaktionshülle ist kein Beleg für Produktions-Transaktionsverhalten. Parallele Aktionen oder zwischenzeitlich geänderter Browserstand ergeben 409 statt Überschreiben.
- Versand, KI, OAuth, Zahlungen und Storage-Uploads sind gesperrt. Finanzkarten verwenden feste, ausdrücklich gekennzeichnete Beispiele und rechnen neue Eingaben nicht nach.
- Original-Lesefixture ist teilweise nachsichtig: unbekannte Tabellen können leere Ergebnisse liefern und komplexe Lesefilter werden nicht vollständig ausgewertet. Keine Vollständigkeits-/Scope-Aussage daraus ableiten.
- Nicht unterstützte Schreibfilter/RPCs scheitern ausdrücklich. Ungefilterte Updates und Löschungen sind gesperrt. LocalStorage-Fehler setzen die lokale Tabellenänderung zurück.
- Nur Runtime-Dateien werden lokal ausgeliefert. HTTP+WS dürfen aufgrund CSP ausschließlich lokal bleiben; der Server leitet nichts an externe Dienste weiter.

Prüfung ohne Listener:

```sh
rtk proxy node --test tools/browser-probe/physio-demo/server.test.js
```
