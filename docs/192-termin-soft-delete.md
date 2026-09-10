# #192 — Termin absagen erhält den Datensatz

## SQL-Reihenfolge und Bereitstellung

1. `sql-codex/2026-09-08-192-termin-soft-delete.sql` — Migration, einmal ausführen.
2. `sql-codex/2026-09-08-192-termin-soft-delete.pruefen.sql` — nur lesende Struktur-/Konsistenzprüfung; nach den Klicktests nochmals ausführen.
3. Danach Backend und Frontend mit dem Phase-2-Commit bereitstellen und den Browser vollständig neu laden. Codex hat nichts gepusht, gemergt oder bereitgestellt.

**Nur bei Rücknahme:** `sql-codex/2026-09-08-192-termin-soft-delete.rollback.sql`. Nicht als regulären dritten SQL-Schritt ausführen. Das Rollback entfernt die neue Triggerlogik, erhält aber Absagen und historische Metadaten; freigegebene Sitzungen werden nicht zurückgehängt, weil sie schon neu vergeben sein können. Vor weiteren Absagen muss dann wieder ein konsistenter Anwendungs-/Migrationsstand bereitstehen.

Alle SQL-Dateien sind lediglich geschrieben und gelesen, nicht gegen eine Datenbank ausgeführt. Die Laufzeitprüfung von Migration, Locks und RLS steht daher noch aus. `db/SCHEMA.sql` und `db/SCHEMA-RLS.sql` sind unveränderte Bestandsaufnahmen; nach erfolgreicher Migration vom Nutzer aktualisieren lassen, kein vermeintlich neuer Live-Dump durch Codex.

## Befund und Umsetzung

Der Absagepfad im Ausgangscommit `59b7f7d` löschte direkt im Frontend: `dashboard.js:7878`, `supabase.from('bookings').delete().eq('id', b.id)`. Im Backend existiert bereits ein authentifizierter PATCH-Endpunkt mit Mandantenfilter (`api-backend/server.js:2117`, `:2137`). Der neue Client ruft diesen Endpunkt mit `status: 'cancelled'` und dem Grund auf (`module/termin-storno.js:5`, `dashboard.js:7880`); ein fehlgeschlagener oder unbestätigter Update gilt nicht als Erfolg (`module/termin-storno.js:11`).

Vorhandene Felder werden verwendet: `bookings.status`, `cancellation_reason`, `no_show` (`db/SCHEMA.sql:459`, `:478`, `:480`). Das bestehende Constraint unterscheidet `cancelled` und `no_show` bereits (`db/SCHEMA.sql:486`). Hinzu kommen nur `cancelled_at` sowie `cancelled_session_links`: Letzteres sichert die früheren Sitzungs-/Verordnungs-IDs, bevor die geplante Einheit wieder frei wird (`sql-codex/2026-09-08-192-termin-soft-delete.sql:6`, `:63`). Ein bestehender Alt-Storno erhält keinen erfundenen historischen Absagezeitpunkt (`:43`).

Die Trigger laufen als `SECURITY INVOKER`, ohne neue RLS-Freigaben (`sql-codex/2026-09-08-192-termin-soft-delete.sql:17`). Statuswechsel, Snapshot, Freigabe geplanter Sitzungen und Absage der Gruppenteilnehmer gehören zur selben Datenbanktransaktion (`:58`, `:73`). PostgreSQL führt Trigger innerhalb der auslösenden Transaktion aus: [Trigger-Verhalten](https://www.postgresql.org/docs/current/trigger-definition.html).

Geplante Termine (`confirmed`, `pending`) dürfen abgesagt werden. Bereits erledigte oder nicht wahrgenommene Termine/Sitzungen werden dabei nicht umgeschrieben; eine laufende Fahrt muss zuerst beendet werden (`sql-codex/2026-09-08-192-termin-soft-delete.sql:47`). Abgesagte Termine lassen sich nicht versehentlich durch einen alten Bearbeitungsdialog reaktivieren (`:23`). Das Verhalten der separaten No-show-Karte wird nicht geändert (`module/sitzung-aktiv.js:2`).

Auch andere vorhandene Status-Update-Wege nutzen die Trigger: Teilnehmer entfernen (`dashboard.js:4884`), eigenständiger Kalender (`kalender.js:570`), Patientenlink (`api-backend/booking/cancel-request.js:7`). Beim Patientenlink werden Terminfehler jetzt geprüft, bevor die Anfrage als abgesagt quittiert wird (`api-backend/booking/cancel-request.js:10`). Anfrage und Termine sind weiterhin zwei API-Schreibvorgänge: schlägt nur das Quittieren fehl, sind die Termine bereits abgesagt und der Nutzer erhält einen Fehler; der Link kann erneut versucht werden (`:13`). Es wird dabei keine Nachricht versendet.

## Was beim bisherigen Löschen mitging

| Bezug | Bisher laut Schema | Verhalten nach Migration |
|---|---|---|
| Gruppenteilnehmer | `ON DELETE CASCADE`, `db/SCHEMA.sql:489` | Statuswechsel der Teilnehmer statt Löschung; bei einem Konflikt wird die gesamte Gruppenabsage zurückgenommen, SQL `:88` |
| Terminleistungen | `ON DELETE CASCADE`, `db/SCHEMA.sql:376` | bleiben am historischen Termin; der Absagetrigger löscht keine Leistungszeile, SQL `:73` |
| Fahrten | `ON DELETE CASCADE`, `db/SCHEMA.sql:873` | tatsächlich gefahrene Fahrten bleiben erhalten; laufende Fahrt blockiert die Absage, SQL `:51` |
| Korrekturhistorie | `ON DELETE CASCADE`, `db/SCHEMA.sql:558` | bleibt erhalten; deren bestehende Löschsperre wird nicht angetastet (`db/SCHEMA.sql:561`) |
| Befund | Terminbezug `ON DELETE SET NULL`, `db/SCHEMA.sql:1406` | Terminbezug bleibt erhalten |
| Ausfallrechnung | Terminbezug `ON DELETE SET NULL`, `db/SCHEMA.sql:317` | Terminbezug bleibt erhalten; keine Rechnungs-/Zahlungsänderung |
| Physio-/Ergo-/Logo-Sitzung | Terminbezug `ON DELETE SET NULL`, `archive/kod/database_v10_prescriptions.sql:85` | nur `planned` wird wieder ohne Termin; Sitzungszeile, Nummer und Status bleiben erhalten; alte Zuordnung im Snapshot, SQL `:63`, `:79` |
| Podologie-Verordnung | direkter Bezug am Termin, `db/SCHEMA.sql:483` | Bezug bleibt historisch stehen; Termin wird nicht als vergeben gezählt (`module/verordnung-termine.js:76`, `:108`) |

## Angepasste Lesestellen

| Stelle | Ausschluss/Verhalten |
|---|---|
| `dashboard.js:2004` | Aktivitätenliste: abgesagte Buchungen nicht als aktuelle Terminaktivität laden |
| `dashboard.js:7992` | Patientenliste: Terminzahl/Metadaten ohne Stornos |
| `module/patient-termine.js:10` | Patientenakte → Termine: standardmäßig ohne Stornos, optional mit Historie |
| `module/patient-termine.js:22` | Historische Zeile ausdrücklich „Abgesagt“, mit Grund und bekanntem Absagezeitpunkt; keine Bearbeitungsaktion |
| `module/patientenkarte.js:158` | Patientenverlauf standardmäßig ohne abgesagte Termine; Historie über den Termine-Umschalter erreichbar |
| `module/rechnung-editor.js:65` | Freigegebener einzelner Terminfilter in der Rechnungs-Terminauswahl |
| `module/verordnung-termine.js:76` | Podologie: zugeordnete Termine ohne `cancelled` |
| `dashboard.js:6325`, `:6335` | Sitzungsseiten laden den Buchungsstatus und verwenden den gemeinsamen Filter |
| `module/verordnung-detail.js:431` | Physio-Terminliste verwendet denselben Filter; `module/sitzung-aktiv.js:4` schließt abgesagte Sitzungen/Buchungen aus |
| `kalender.js:346` | Eigenständiger Kalender blendet Stornos aus |
| `api/admin/data.js:63`, `:103`, `:203` | Admin-Kennzahlen, Praxis-Terminzahlen und Terminliste ohne Stornos |
| `api-backend/server.js:2963` | Nächster geplanter Termin: Inner Join und Statusfilter überspringen freigegebene Platzhalter und Stornos |
| `dashboard.js:1944`, `:2984`, `:3268`, `:5073` | Frisch als abgesagt gelesene Termine öffnen keine aktiven Bearbeitungs-/Kontextaktionen |

Nur Importversionen angepasst: `module/verordnung-liste.js:48`, `module/termin-panel-patient.js:39`. Damit die geänderten Leser unter einer neuen Browser-Cache-Adresse geladen werden.

## Bereits passende Lesestellen — geprüft, unverändert

- Freie Plätze, Tagesliste, Tageskalender, Terminseriennummer: `dashboard.js:1609`, `:1694`, `:1760`, `:2763`, `:3249`; jeweils `cancelled` ausgeschlossen.
- Datumsübersicht und Wochen-/Monatsüberblick: `dashboard.js:2628`, `:14537`, `:14639`; `cancelled` ausgeschlossen. Die in Phase 1 benannte Blocker-Zählung der Monatsübersicht bleibt eine separate offene Stelle.
- Wochen-/Monatskalender: `module/kalender-woche.js:182`, `module/kalender-monat.js:150`.
- Heutige Patienten/Termine: `module/termin-heute.js:162`; Mitarbeiter-Tagesansicht: `dashboard.js:11402`.
- Gruppenbelegung: `dashboard.js:4845`, `api-backend/server.js:741`, `:958`; nur bestätigte Teilnehmer.
- Slot-/Auslastungsberechnung im Backend: `api-backend/server.js:728`, `:949`, `:1607`; nur `confirmed`. Öffentliche Monatsanzeige: `booking.js:353`, `cancelled` ausgeschlossen.
- Therapeuten-Statistik aus #197: `api-backend/billing/statistik/therapeuten.js:12`; unverändert `cancelled` ausgeschlossen. Der Regressionstest mit zwei Patiententerminen, drei Blockern und einem Storno bleibt grün (`api-backend/billing/statistik/therapeuten.test.js:61`).
- Terminzettel/Patientensuche: `module/termin-patient-bezug.js:139`, `module/termin-aktionen.js:115`; nur `confirmed`/`pending`.
- Befund-Terminauswahl: `module/fussbefund.js:491`; Frequenzprüfung: `module/frequenz-pruefung.js:256`; Bescheinigung: `module/behandlungsbestaetigung.js:68`; gelernte Dauer: `module/termin-dauer.js:149`.
- Sitzungsfortschritt: `module/sitzungsfortschritt.js:91` zählt offene geplante Zeilen nur mit `booking_id`. Die Migration setzt diese Referenz bei Absage auf NULL; der Sitzungsabgleich erzeugt keine zusätzlichen Nummern, weil die Zeile erhalten bleibt (`module/sitzung-abgleich.js:65`).
- Abrechnungsleser für erbrachte Sitzungen bleiben unverändert: `api-backend/billing/api/abrechnung.routes.js:264`, `module/rechnung-verordnung.js:253`, `module/rezeptinfo-geld.js:169` verwenden `done`. Solche Sitzungen können über den neuen Absageweg nicht storniert werden; bestehende Rechnungen werden nicht neu berechnet. Podologische Leistungsvorbelegung filtert schon `cancelled` (`module/podologie-abrechnung.js:269`).
- No-show-Auswertungen lesen ausdrücklich `status = 'no_show'` (`dashboard.js:3721`, `:21485`); keine Änderung an diesem Zustand.

Bewusste historische Einzelzugriffe bekommen keinen pauschalen Aktivfilter: Nachrücker brauchen die Uhrzeit des abgesagten Termins (`api-backend/billing/api/warteliste.routes.js:236`, `kalender.js:493`); `ladeTerminVollstaendig` wird auch hierfür benutzt (`module/termin-laden.js:58`). Befunde, Fahrten und bereits vorhandene Ausfallrechnungen behalten ihre Referenzen und zeigen historische Daten, keine freien/belegten Plätze (`db/SCHEMA.sql:1406`, `:873`, `:317`). Datenschutz-Export/-Löschung bleibt außerhalb des Absagepfads (`api/dsgvo.js:68`, `:246`).

## RLS

Die Bestandsaufnahme nennt SELECT/UPDATE für Inhaber sowie deren Mitarbeiter (`db/SCHEMA-RLS.sql:198`). Sitzungen sind über die zugehörige Verordnung für Inhaber und Team zugänglich (`db/SCHEMA-RLS.sql:366`). Keine Policy geändert. Der Backend-PATCH prüft die Anmeldung und schränkt den Termin auf `req.auth.tenantId` ein (`api-backend/server.js:2117`, `:2137`); direkte Statusupdates bleiben unter den bestehenden RLS-Policies. Die Trigger nutzen die Rechte des jeweiligen Aufrufers und werfen bei sichtbaren, aber nicht freigegebenen Restzeilen einen Fehler (`sql-codex/2026-09-08-192-termin-soft-delete.sql:81`, `:94`). Laufzeitprüfung mit Inhaber, Mitarbeiter und fremdem Mandanten bleibt beim Nutzer.

## Klick-Checkliste

In einer Testpraxis nach Migration und Bereitstellung des Codes:

1. Einen bestätigten Patiententermin mit geplanter Verordnungssitzung öffnen; Termin-ID, Statistikzahl N und Anzahl „Unvergebene“ M notieren.
2. „Absagen“ wählen, Grund eingeben, bestätigen. Erwartet: Meldung „Termin abgesagt“, kein DELETE-Request; ein PATCH an `/api/booking/<id>` mit `status: cancelled` (`module/termin-storno.js:5`).
3. Tag, Woche, Monat, Mitarbeiteransicht und freie Slots prüfen: Termin ausgeblendet, Zeitfenster wieder buchbar. Ein erneuter Termin im selben Slot muss möglich sein.
4. Verordnung öffnen: M + 1 unvergebene Einheiten, eine vergebene weniger; Zahl erbrachter Sitzungen unverändert. Die freigewordene Einheit erneut vergeben. Der alte Termin bleibt trotzdem abgesagt und sein Snapshot bleibt erhalten.
5. Patientenakte → Termine: zunächst ausgeblendet. „Abgesagte Termine anzeigen“ aktivieren: Datum und Grund bleiben sichtbar; die ursprüngliche ID ist im Netzwerk-Response/DB-Datensatz nachvollziehbar; ausschalten blendet die Zeile wieder aus. In der DB steht der Datensatz weiterhin mit `cancelled_at` und ggf. `cancelled_session_links`.
6. Statistik → Therapeuten-Auslastung neu laden: N − 1 (Einzeltermin). Blocker hinzufügen: keine Erhöhung. Ein bereits vorher abgesagter Termin bleibt ausgeschlossen.
7. Neue Rechnung → Einzeltermine wählen: der abgesagte Termin darf nicht angeboten werden. Vorhandene Rechnung und Befund dürfen nicht verschwinden; keine Zahlung wurde durch die Absage geändert.
8. Gruppentermin mit zwei bestätigten Teilnehmern absagen: Elterntermin und beide Teilnehmer erhalten `cancelled`; alle drei verschwinden aus aktiven Listen. Nur einen Teilnehmer entfernen: Gruppenplatz wird frei, übrige Teilnehmer bleiben aktiv.
9. Abgesagten Termin erneut absagen bzw. alten Bearbeitungsdialog speichern: keine Reaktivierung. Bei erledigter Sitzung, No-show oder laufender Fahrt muss die Absage scheitern und die Daten müssen unverändert bleiben.
10. Mit einem Mitarbeiter derselben Praxis wiederholen; fremden Termin per PATCH versuchen: kein fremder Datensatz darf geändert werden.
11. Patienten-Stornolink einer noch nicht behandelten Serie testen: alle Serientermine verschwinden. Bei simuliertem Terminfehler wird die Anfrage nicht fälschlich als erfolgreich storniert quittiert.
12. `sql-codex/2026-09-08-192-termin-soft-delete.pruefen.sql` erneut ausführen: drei aktive Trigger, beide Spalten und der Sitzungsindex vorhanden, Konsistenzzähler jeweils 0. Altbestands-Treffer mit erledigten Sitzungen erst fachlich prüfen; nicht automatisch umschreiben.

## Verifikation durch Codex

Lokale Tests mit Testdaten/ersetztem HTTP-Transport, keine Datenbank: Absage-Request und Fehlerbehandlung, Rechnungsfilter, Historienfilter, aktive Sitzungszeilen, Patientenlink-Serie sowie die bestehenden Kalender-, Verordnungs-, Sitzungs- und #197-Tests. Browserprüfung des echten neuen Moduls mit Testdaten: 1 → 2 → 1 sichtbare Termine beim Ein-/Ausschalten; Grund sichtbar, keine Browserfehler. JavaScript-Syntax und `git diff --check` geprüft.

Offen ist ausdrücklich die Ausführung und Prüfung des SQL gegen die Nutzer-Datenbank. Die Migration ist die Voraussetzung für atomare Freigabe und Integrität; reine JavaScript-Tests beweisen die Datenbankwirkung nicht.

Testaufruf: `rtk proxy node --test module/termin-storno.test.js module/patient-termine.test.js module/rechnung-editor.test.js api-backend/booking/cancel-request.test.js api-backend/billing/statistik/therapeuten.test.js module/verordnung-termine.test.js module/verordnung-detail.test.js module/sitzungsfortschritt.test.js module/sitzung-abgleich.test.js module/termin-laden.test.js module/kalender-woche.test.js module/kalender-monat.test.js module/termin-heute.test.js`.
