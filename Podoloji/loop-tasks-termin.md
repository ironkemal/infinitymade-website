# Loop-Liste: Termin und Kalender

Quelle: Ops-Dashboard → Podoloji → "Termin ve takvim" (Meeting 08.08.2026)
Kontext aus dem Meeting: Der Termin-Anfrage-Ablauf läuft schon live, gilt aber erst als
fertig wenn Annehmen/Ablehnen komplett steht — Gegenangebot oder Patienten-Nachricht vorher
zu bauen wäre verschwendete Arbeit. Deshalb startet die Kette mit Punkt 1.

Regel für den builder-Agenten: von oben nach unten abarbeiten. Ein Punkt mit `Zuerst:` erst
angehen, wenn die genannte Nummer `[x]` ist.

- [x] 1. Termin-Anfrage Annehmen/Ablehnen-Ablauf fertigstellen — inkl. E-Mail-Benachrichtigung [Priorität: Hoch]
      Geändert: `api-backend/booking/from-request.js` (neu) · `api-backend/booking/from-request.test.js`
      (neu, 6 Tests) · `api-backend/server.js` (approve nutzt die neue Funktion, Auto-Akzeptieren legt
      jetzt einen Termin an, Ablehnen prüft den Status, Patienten-Storno storniert auch die Buchung) ·
      `dashboard.js` (Sidebar-Zähler) · `dashboard.html` (Cache-Version)
      Befund: die Oberfläche war komplett fertig verdrahtet (Liste, Tabs, Detail-Modal,
      Therapeutenauswahl, alle drei Sprachen). Kaputt war das **Backend**:
      1. `bookings` wurde mit `employee_id` beschrieben — diese Spalte gibt es dort nicht,
         der Therapeut gehört in `user_id` (`NOT NULL`). Jedes Bestätigen endete in
         „Bestätigung fehlgeschlagen". Nebenwirkung: nur über `user_id` greift die
         Doppelbuchungs-Sperre `no_overlapping_bookings` überhaupt.
      2. Auto-Akzeptieren setzte die Anfrage auf „bestätigt", legte aber **keinen Termin**
         an — der Patient bekam eine Bestätigung für einen Termin, den niemand sah.
         Läuft jetzt über dieselbe Funktion; ohne gewählten Therapeuten bleibt die Anfrage
         bewusst offen, damit die Praxis jemanden auswählen kann.
      3. Ablehnen prüfte den Status nicht — eine bereits bestätigte Anfrage liess sich
         absagen, der Termin blieb im Kalender stehen.
      4. Der Storno-Link in der Patienten-Mail liess den bestätigten Termin als
         Geistertermin im Kalender stehen.

- [x] 2. Slot-Kollisionstest bei Termin-Anfrage — wird eine angefragte Zeit ausgeblendet/abgelehnt, sobald sie an jemand anderen vergeben wurde?
      Geändert: `api-backend/booking/from-request.js` (Vorabprüfung `slotIstFrei`, 23P01 → `conflict`) ·
      `api-backend/booking/from-request.test.js` (4 neue Fälle) · `api-backend/server.js`
      (approve antwortet mit 409, Auto-Akzeptieren lässt die Anfrage bei Konflikt offen)
      Befund: die **Folgetermine** einer Serie wurden schon korrekt geprüft, der **Wunschtermin
      selbst gar nicht**. Er wurde blind eingefügt und die Antwort hing allein an der
      DB-Sperre — die wegen Punkt 1 (fehlendes `user_id`) sowieso nicht griff.
      Jetzt: erst dieselbe Verfügbarkeitsprüfung wie beim Patienten (fängt auch Feiertag,
      Urlaub und Zeiten ausserhalb der Öffnungszeiten ab), dann Insert; verliert man
      trotzdem das Rennen, wird `23P01` als 409 mit klarer deutscher Meldung beantwortet.
      Die DB-Sperre bleibt unverändert der letzte Schutz.

- [x] 3. Kalender: "Verschieben"-Modus einbauen — Verschieben-Button drücken, Ziel-Slot anklicken [Priorität: Hoch]
      Geändert: `dashboard.js` (`cancelMoveBooking`, `updateMoveBanner`, Escape-Taste,
      Panel-Wechsel beendet den Modus, klare Kollisionsmeldung, i18n de/en/tr) ·
      `dashboard.html` (Hinweisleiste) · `dashboard.css` (`.cal-move-banner`) ·
      Cache-Version für `dashboard.js` und `dashboard.css`
      Befund: der Klick-Modus **existierte schon** in beiden Kalendern
      (`dashboard.js` `startMoveBooking` + Geist-Vorschau + `doMoveBooking`;
      `kalender.js` mit eigenem Banner). In `kalender.js` war nichts zu tun — dort gibt es
      Banner, Abbrechen-Knopf und die saubere 409-Meldung über `patchBooking` bereits.
      Im Dashboard fehlten drei Dinge:
      1. **Kein Weg zurück.** War der Modus aktiv, legte jeder Slot-Klick nur einen neuen
         Vorschlag an; er blieb sogar nach dem Wechsel in ein anderes Modul unsichtbar aktiv.
         Jetzt: Hinweisleiste mit „Verschieben abbrechen", Escape-Taste, und der Wechsel
         des Moduls beendet den Modus.
      2. Bei Kollision zeigte die Meldung rohen Postgres-Text; jetzt ein verständlicher Satz.
      3. Aus dem Tagesplan geöffnet wäre der Modus aktiv, aber unsichtbar gewesen —
         es wird jetzt in den Kalender gewechselt.
      Die DB-Sperre `no_overlapping_bookings` bleibt unangetastet; sie ist weiterhin das,
      was die Doppelbuchung verhindert — nur die Meldung ist jetzt lesbar.

- [ ] 4. Termin-Anfrage: Gegenangebot — bei ausgebuchter Zeit schlägt die Praxis eine Alternativzeit vor
      Zuerst: 1
      Code: nichts Vorhandenes gefunden ("Gegenangebot" kommt im Code nirgends vor) — komplett neu.

- [ ] 5. Termin-Anfrage: Nachricht an Patient — nur per E-Mail, KEIN In-App-Chat
      Zuerst: 4

- [ ] 6. Termin-Anfrage-Formular an die gleiche Struktur wie die Verordnung-Maske angleichen
      Code: `booking-request.html`/`.js` mit der Verordnung-Erfassung in `dashboard.js` vergleichen.

- [ ] 7. Minuten-Genauigkeit bei Terminzeiten — Labels klären (5–10 Min Kulanz)

- [x] 8. Kalender: Mitarbeiter-Filter und Farbcodierung prüfen — Termine eines einzelnen Mitarbeiters sollen isoliert sichtbar sein
      Geändert: `dashboard.js` (Farbe der Verschieben-Vorschau, Absicherung der Monatsabfrage)
      Geprüft und in Ordnung: die Filter-Chips (`renderCalEmpChips`) wirken in **allen drei**
      Ansichten — Tag, Woche und Monat filtern über `calEmpFilter` und fragen nur die
      Termine der gewählten Person ab. Die Farbe wird überall über die Position in
      `teamMembers` bestimmt, nicht über die gefilterte Liste — sie bleibt also gleich,
      egal ob gefiltert ist oder nicht. Das war der Punkt, an dem so etwas üblicherweise kippt.
      Zwei Kleinigkeiten korrigiert:
      1. Die Vorschau beim Verschieben nahm ihre Farbe aus einer anderen Liste — bei einem
         angemeldeten Mitarbeiter konnte sie deshalb anders aussehen als die eigene Spalte.
      2. Die Monatsabfrage war bei leerer Mitarbeiterliste nicht abgesichert (die
         Wochenansicht war es); jetzt gleich behandelt.

- [x] 9. Für jeden Mitarbeiter einen eigenen Buchungslink — prüfen ob vorhanden, sonst fertigstellen
      Geändert: `dashboard.js` (Link-Zeile in der Mitarbeiterkarte wieder eingesetzt)
      Befund: der Link **funktioniert schon vollständig**. `booking_slug` hängt am Profil,
      also auch an jedem Mitarbeiter, und `booking.js` erkennt ein Mitarbeiter-Profil
      (Zeile 111–135): der Buchungsweg springt dann direkt auf diese Person, ohne
      Mitarbeiterauswahl. Ohne eigenen Slug greift der Link auf die Profil-ID zurück,
      der funktioniert genauso. Jeder Mitarbeiter sieht seinen Link im Kalender oben.
      Fehlte: in der **Team-Übersicht** war die Link-Zeile aus der Karte verschwunden.
      Der Link wurde im Code noch berechnet (`buildBookingUrl(m)`), das CSS
      (`.emp-link-row`, `.emp-link-text`) und die Klick-Handler (`.emp-copy-link`) waren
      auch noch da — nur das Markup fehlte. Der Praxisinhaber konnte die Links seiner
      Mitarbeiter deshalb nicht sehen oder kopieren. Wieder eingesetzt.

- [ ] 10. Arbeitszeiten pro Standort statt nur global [Launch-Thema]
      Bestätigt: `working_hours` ist aktuell rein `user_id`-basiert (`kalender.js` Zeile 575,
      mehrfach in `dashboard.js`, `api-backend/server.js` Zeile 592+) — kein Standort-Override.
      Vermutlich größerer Umbau mit Schema-Änderung. Nicht auf die leichte Schulter nehmen.

---

## Für den builder-Agenten

- Diese Datei ist die einzige Quelle für "was ist als nächstes dran".
- Nach jeder erledigten Aufgabe: Checkbox auf `[x]` setzen + eine kurze Zeile darunter,
  welche Dateien geändert wurden.
- Bereits gelöste Probleme aus CLAUDE.md NICHT wieder aufmachen: OAuth-Race
  (`newOAuthClient()`-Factory), Doppel-Buchung (`no_overlapping_bookings` EXCLUDE GIST),
  Zeitzone (`Intl.DateTimeFormat` + `berlinOffsetMin()`, DST-safe), Service-Role-Fallback,
  Rate-Limit auf öffentlichen Routen. Diese vier gelten als erledigt — nur nutzen, nicht neu bauen.
