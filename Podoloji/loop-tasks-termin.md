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
      ⚠️ Nachtrag (bei Punkt 4 gefunden): die **Dialoge** des Moduls waren doch nicht
      fertig verdrahtet — `showInputModal` wurde mit einer Signatur aufgerufen, die es
      nicht gibt. Details siehe Punkt 4. Erst damit ist Punkt 1 wirklich zu.

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

- [x] 4. Termin-Anfrage: Gegenangebot — bei ausgebuchter Zeit schlägt die Praxis eine Alternativzeit vor
      (Entscheidung Melih, 10.08.2026: E-Mail mit 2–3 Alternativterminen, ein Klick genügt.)
      Geändert: `database_v34_anfrage_gegenangebot.sql` (neu) · `api-backend/server.js`
      (`POST /booking-request/offer`, `POST /booking-request/accept-offer`) ·
      `booking-request.html`/`.js`/`.css` (Annahme-Seite für den Link aus der Mail) ·
      `dashboard.js` (`showHtmlModal`, Ablehnen-Dialog mit Terminvorschlägen, i18n de/en/tr) ·
      `dashboard.html` (Dialog-Gerüst `#htmlModal`)
      ⚠️ SQL-Migration muss vor dem Deploy im Supabase SQL-Editor laufen.
      Ablauf: Ablehnen-Dialog → Haken „Alternativtermine anbieten" → die nächsten freien
      Zeiten desselben Therapeuten werden gesucht (`/booking/get-slots`, max. 7 Tage
      vorwärts), höchstens drei ankreuzen → der Patient bekommt eine Mail mit je einem
      Annehmen-Link. Jeder Link hat ein eigenes HMAC-Token **inklusive Index**, sonst
      liesse sich mit einem Link jeder Vorschlag annehmen. Angenommen wird erst auf
      Knopfdruck auf der Seite, nicht schon durch das Öffnen des Links.
      Die Anfrage bleibt bewusst **offen**, solange der Patient nicht geantwortet hat —
      das erspart einen vierten Status samt Constraint-Änderung und ist inhaltlich richtig.
      Die Annahme läuft durch dieselbe Kollisionsprüfung wie das Bestätigen (Punkt 2),
      kann also keine Doppelbuchung erzeugen.
      🚨 **Dabei gefunden — Punkt 1 war noch nicht ganz zu:** die drei Dialoge des
      Anfragen-Moduls riefen `showInputModal(Titel, HTML, Callback)` auf. Diese Signatur
      gibt es nicht (`showInputModal` nimmt ein Optionsobjekt). Der String wurde
      destrukturiert, also war alles `undefined`: **Anfrage-Details, Therapeutenauswahl
      und Ablehnen öffneten einen leeren Dialog namens „Eingabe", und der Callback lief
      nie** — Ablehnen tat schlicht gar nichts. Dafür gibt es jetzt `showHtmlModal`.

- [x] 5. Termin-Anfrage: Nachricht an Patient — nur per E-Mail, KEIN In-App-Chat
      Geändert: `api-backend/server.js` (`POST /booking-request/message`) ·
      `dashboard.js` (`nachrichtAnPatient`, Knopf im Anfrage-Detail, i18n de/en/tr)
      Im Anfrage-Detail steht jetzt „Nachricht an Patient" (nur, wenn eine E-Mail-Adresse
      hinterlegt ist). Die Mail geht mit `replyTo` der Praxis raus — der Patient antwortet
      also direkt ins Praxis-Postfach. **Kein Chat in der App**, damit kein zweites
      Postfach entsteht, das jemand betreuen müsste.
      Der Text wird vor dem Einsetzen in die HTML-Mail maskiert und ist auf 2000 Zeichen
      begrenzt.

- [x] 6. Termin-Anfrage-Formular an die gleiche Struktur wie die Verordnung-Maske angleichen
      (Entscheidung Melih, 10.08.2026: nur die fehlenden Rezept-Felder ergänzen, kein
      Muster-13-Formular für Patienten.)
      Geändert: `database_v33_anfrage_diagnosegruppe.sql` (neu) · `booking-request.html`
      (Feld Diagnosegruppe + Heilmittel-Liste nach Diagnosegruppe gefiltert) ·
      `booking-request.js` (State, Zusammenfassung, Versand) · `api-backend/server.js`
      (speichert `diagnosegruppe`) · `dashboard.js` (Anfrage-Detail zeigt sie an)
      ⚠️ SQL-Migration muss vor dem Deploy im Supabase SQL-Editor laufen.
      Befund: ICD-10 und Heilmittel kamen **schon** aus der gemeinsamen `katalog-suche.js`,
      inklusive Fachbereich der Praxis über die RPC `public_praxis_sector` — da war nichts
      zu tun. Gefehlt hat allein die **Diagnosegruppe**, das Feld, auf dem in der
      Verordnung-Maske alles aufbaut. Sie ist jetzt da (dasselbe Suchfeld, `kind: 'dg'`)
      und filtert zusätzlich die Heilmittel-Liste, genau wie im Dashboard.
      📋 Nebenbei gesehen, nicht angefasst: im Versand-Objekt in `booking-request.js` steht
      `icd10_diagnose` **zweimal** (Zeile ~1038 und ~1054). Der zweite Eintrag gewinnt und
      liefert zufällig dasselbe Ergebnis, deshalb fällt es heute nicht auf — aber die Zeile
      ist eine Falle für die nächste Änderung.

- [x] 7. Minuten-Genauigkeit bei Terminzeiten — Labels klären (5–10 Min Kulanz)
      (Entscheidung Melih, 10.08.2026: nur Beschriftung, kein Umbau der Schrittweite.)
      Geändert: `booking-request.html` + `booking-request.css` (Hinweis unter der Uhrzeit-Liste) ·
      `booking.html` (gleicher Hinweis im öffentlichen Buchungsweg) ·
      `api-backend/server.js` (derselbe Satz in beiden Bestätigungs-Mails)
      Befund: **intern ist die Minute längst frei wählbar** — `bkStart` ist ein
      `datetime-local`-Feld, 10:05 lässt sich eintragen und der Kalender zeichnet es
      minutengenau (`topPx` rechnet proportional). Nur der öffentliche Weg bietet feste
      30-Minuten-Schritte an. Geändert wurde deshalb nichts an der Mechanik, nur der Satz
      „Die Uhrzeit ist ein Richtwert. Bitte planen Sie 5–10 Minuten Puffer ein."

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
      ⏸ **Plan liegt vor, Umbau bewusst zurückgestellt** (Entscheidung Melih, 10.08.2026:
      erst planen, dann entscheiden). Neu: `ARBEITSZEITEN_PRO_STANDORT.md`
      Kurz: besser als gedacht. Die Spalte `working_hours.business_id` **existiert schon**,
      samt Index — sie wird nur von keiner Codestelle benutzt. Dasselbe bei
      `custom_days.business_id`. Der eigentliche Blocker ist die Constraint
      `UNIQUE (user_id, day_of_week)`: eine Zeile pro Person und Wochentag, ein zweiter
      Standort passt nicht hinein. Vorgeschlagen: Constraint auf
      `UNIQUE NULLS NOT DISTINCT (user_id, day_of_week, business_id)` umstellen,
      `business_id IS NULL` heisst „gilt überall". Kein Backfill, bestehende Praxen
      unverändert.
      Empfehlung im Plan: **nicht jetzt** — es gibt keine Praxis mit zwei Standorten in
      Betrieb, aber ein Fehler in `getAvailableSlots` trifft sofort alle. Reihenfolge, wenn
      es soweit ist: erst Tests für `getAvailableSlots`, dann Migration, dann die
      zwölf Lesestellen, zuletzt der Bildschirm.
      🔒 Bestätigt (Melih, 10.08.2026): bewusst NICHT jetzt bauen. Erst wieder aufgreifen,
      wenn eine echte Praxis einen zweiten Standort bekommt.

---

## Für den builder-Agenten

- Diese Datei ist die einzige Quelle für "was ist als nächstes dran".
- Nach jeder erledigten Aufgabe: Checkbox auf `[x]` setzen + eine kurze Zeile darunter,
  welche Dateien geändert wurden.
- Bereits gelöste Probleme aus CLAUDE.md NICHT wieder aufmachen: OAuth-Race
  (`newOAuthClient()`-Factory), Doppel-Buchung (`no_overlapping_bookings` EXCLUDE GIST),
  Zeitzone (`Intl.DateTimeFormat` + `berlinOffsetMin()`, DST-safe), Service-Role-Fallback,
  Rate-Limit auf öffentlichen Routen. Diese vier gelten als erledigt — nur nutzen, nicht neu bauen.
