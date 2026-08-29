# Tabellen-Nutzung — wer liest, wer schreibt

> ÜRETİLEN DOSYA — elle düzenleme. `node tools/tabellenkarte.mjs`
> NİYE açıldıkları: `db/REGISTER.md` · YAPILARI: `db/SCHEMA.sql`

**Erzeugt:** 2026-08-29 · 80 Tabellen · Quelle: db/SCHEMA.sql (Stand 2026-08-28), funktionen/INDEX.json (erzeugt 2026-08-29)

## Kayıt durumu

- Register kaydı olan: **80/80**

## Kodda hiç çağrılmayan tablolar

`.from()` ile hiçbir dosyadan erişilmiyor. **Ölü demek değildir** — trigger, RPC,
view veya backend raw SQL üzerinden beslenebilir. `SQL-Treffer` sütunu SCHEMA-RLS.sql
içindeki geçiş sayısıdır: 0 ise gerçekten şüphelidir.

| Tabelle | SQL-Treffer | Register-Status |
|---|---|---|
| `accommodations` | 2 | fremd |
| `applications` | 2 | fremd |
| `dta_schluessel` | 4 | Referenz, im Code ungenutzt |
| `fußstatus` | 2 | veraltet |
| `heilmittel_catalog` | 2 | veraltet |
| `heilmittel_position` | 4 | veraltet |
| `icd10_titles` | 7 | aktiv (Referenz) |
| `icd_sector_ranges` | 3 | aktiv (Referenz) |
| `nummernkreise` | 1 | aktiv |
| `referral_drafts` | 9 | verdächtig |
| `spatial_ref_sys` | 1 | System |
| `trip_history` | 1 | fremd |
| `trip_plans` | 1 | fremd |
| `user_credits` | 2 | fremd |

## DSGVO-Abdeckung (`api/dsgvo.js`)

Auskunft (Art. 15): **52** · Löschung (Art. 17): **48** · anonymisiert statt gelöscht: **1**

⚠️ Personenbezug (FK auf `leads`/`profiles`/`auth.users`) aber **nicht** in der Auskunftsliste:

`accommodations`, `admin_users`, `applications`

Prüfen, nicht blind nachtragen: manche davon sind Konfigurations- oder
Referenztabellen ohne Personendaten. Die Entscheidung gehört ins Register.

## En çok yazılan tablolar

| Tabelle | Schreiber | Leser | Dateien | Module |
|---|---|---|---|---|
| `profiles` | 18 | 25 | 23 | abrechnung, anfragen, fahrtenbuch, fussstatus, hours, kunden, team, ueberblick |
| `bookings` | 9 | 22 | 16 | abrechnung, fussstatus, hours, kunden, services, team, ueberblick |
| `document_vorlagen` | 9 | 2 | 3 | abrechnung, kunden, team, vorlagen |
| `prescriptions` | 8 | 17 | 15 | abrechnung, anamnese, belegliste, doctors, kunden, podologie-billing, rechnungen, settings, team, ueberblick, verordnungen |
| `services` | 7 | 10 | 7 | abrechnung, kunden, services, team |
| `businesses` | 5 | 5 | 8 | abrechnung, hours, kunden, services, team |
| `time_offs` | 5 | 7 | 3 | abrechnung, kunden, team, ueberblick |
| `prescription_sessions` | 4 | 6 | 8 | abrechnung, kunden, rechnungen, team |
| `employee_business_assignments` | 3 | 5 | 4 | abrechnung, kunden, team |
| `employee_services` | 3 | 2 | 6 | abrechnung, kunden, services, team |
| `leads` | 3 | 29 | 10 | abrechnung, anamnese, b2c, doctors, fussstatus, kunden, notizen, podologie-billing, rechnungen, settings, team, ueberblick, verordnungen |
| `vehicles` | 3 | 4 | 1 | abrechnung, fahrtenbuch, kunden, services, team |
| `aerzte` | 2 | 5 | 4 | abrechnung, anamnese, doctors, kunden, podologie-billing, settings, team, verordnungen |
| `breaks` | 2 | 1 | 2 | abrechnung, hours, kunden, team |
| `calendar_integrations` | 2 | 2 | 4 | abrechnung, kunden, settings, team |
| `fahrten` | 2 | 2 | 1 | abrechnung, fahrtenbuch, kunden, team |
| `invoices` | 2 | 4 | 2 | abrechnung, kunden, rechnungen, team |
| `messreihen` | 2 | 0 | 1 | abrechnung, kunden, team |
| `module_visibility` | 2 | 1 | 2 | abrechnung, kunden, team |
| `pat_fussbefund` | 2 | 4 | 3 | abrechnung, fussstatus, kunden, team |
| `patient_consents` | 2 | 2 | 1 | — |
| `user_preferences` | 2 | 2 | 3 | abrechnung, hours, kunden, team |
| `visibility_reports` | 2 | 1 | 2 | abrechnung, kunden, team |
| `working_hours` | 2 | 10 | 8 | abrechnung, hours, kunden, services, team |
| `zuzahlung_befreiung` | 2 | 1 | 2 | abrechnung, kunden, team |

## Alle Tabellen

### `abrechnung`

22 Spalten · Status: aktiv
Warum: Der Abrechnungslauf als Ganzes: eine Sammelrechnung an einen Kostenträger, mit DTA-Datei, Signaturzustand, Upload- und Zahlungsdatum. Ohne diesen Kopfsatz gäbe es keinen Bezugspunkt für Absetzungen.

**Schreibt (1):** `downloadAbrechnungFile()` [update] — dashboard.js:20303

**Liest (3):** `loadAbrechnung()`, `openDasGuideModal()`, `renderExportStep()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/statistik.routes.js`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `accommodations`

7 Spalten · Status: fremd
Warum: Fremdprojekt (Unterkünfte). Nie Teil von Praxura.

### `admin_users`

3 Spalten · Status: aktiv
Warum: Trennt das interne Admin-Panel (`admin.praxura.de`) von den Kundenrollen. Ein Kunde soll nie durch Setzen eines Feldes in `profiles` Admin werden können.

**Liest (4):** `init()`, `isAdmin()`, `isAdmin()`, `isAdminUser()`

**Dateien:** `admin-login.js`, `admin.js`, `api/_lib/auth.js`, `dashboard.js`, `login.js`

### `aerzte`

17 Spalten · Status: aktiv
Warum: Arztregister je Inhaber. Wird beim Erfassen einer Verordnung automatisch befüllt: LANR-Treffer reichert den vorhandenen Datensatz an, sonst wird neu angelegt. Grundlage der Auswertung „welcher Arzt überweist wie viel".

**Schreibt (2):** `deleteAerzte()` [delete] — dashboard.js:16541 · `editAerzte()` [update] — dashboard.js:16550

**Liest (5):** `downloadDmrzForInvoice()`, `fillRzPatientFromLead()`, `loadAerzte()`, `loadPodologieBilling()`, `podFillEditForm()`

**Dateien:** `api-backend/lib/arzt-registry.js`, `api-backend/server.js`, `dashboard.js`, `module/podologie-abrechnung.js`

**Module:** abrechnung, anamnese, doctors, kunden, podologie-billing, settings, team, verordnungen

### `ai_audit_log`

15 Spalten · Status: aktiv
Warum: Protokoll jedes KI-Aufrufs (Rezept-OCR, Entwürfe): Modell, Kosten, Ergebnis. Nachweis gegenüber dem EU AI Act und Kostenkontrolle.

**Dateien:** `api-backend/ai/audit.js`, `api/admin/data.js`

### `anamnese`

28 Spalten · Status: aktiv
Warum: Erstaufnahme und Vorgeschichte. Eigene Tabelle, weil sie versioniert entsteht und nicht bei jedem Termin neu geschrieben wird.

**Schreibt (1):** `saveAnamnese()` [insert/update] — dashboard.js:16148

**Liest (4):** `fillAnamneseForm()`, `loadPatientDetailAnamnese()`, `printAnamnese()`, `printAnamneseInline()`

**Dateien:** `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, anamnese, kunden, team

### `applications`

6 Spalten · Status: fremd
Warum: Fremdprojekt (Bewerbungen). Nie Teil von Praxura.

### `attendance`

12 Spalten · Status: aktiv
Warum: Kommen/Gehen der Mitarbeiter (Arbeitszeiterfassung), getrennt von der Sollarbeitszeit in `working_hours`.

**Liest (1):** `fetchHistory()`

**Dateien:** `api-backend/server.js`, `attendance.js`

### `ausfallrechnungen`

15 Spalten · Status: aktiv
Warum: Ausfallhonorar bei No-Show oder kurzfristiger Absage. Rechtlich **Schadensersatz**, damit umsatzsteuerfrei und keine GKV-Leistung — deshalb keine Zeile in `invoices`.

**Dateien:** `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`

### `b2b_contacts`

16 Spalten · Status: aktiv (Randmodul)
Warum: B2B-Akquise: Ärzte und Partner anschreiben, um Zuweisungen zu bekommen. Aus der Zeit, als Praxura noch selbst Kunden für die Praxis gewinnen wollte.

**Schreibt (1):** `renderB2B()` [delete] — dashboard.js:12039

**Liest (1):** `loadB2B()`

**Dateien:** `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, b2b, kunden, team

### `belegliste`

13 Spalten · Status: aktiv
Warum: GoBD-Belegjournal: jeder Geldvorgang lückenlos und unveränderlich.

**Liest (1):** `loadPatientDetailRezepte()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `booking_requests`

37 Spalten · Status: aktiv
Warum: Termin-**Anfrage** statt Sofortbuchung: der Patient bittet um einen Termin, der Inhaber bestätigt oder lehnt ab. Ein bestätigter Antrag wird zu einem `bookings`-Eintrag.

**Dateien:** `api-backend/server.js`

### `bookings`

32 Spalten · Status: aktiv
Warum: Der Termin selbst. Alles andere im Kalender hängt daran.

**Schreibt (9):** `doMoveBooking()` [update] — dashboard.js:5559 · `handlePatientNichtErschienen()` [update] — dashboard.js:4585 · `handleSessionDrop()` [insert] — dashboard.js:3994 · `handleTerminStarten()` [update] — dashboard.js:4495 · `initBkGroupPatientAutocomplete()` [insert] — dashboard.js:5102 · `loadGroupParticipants()` [update] — dashboard.js:5000 · `markArrivedHandler()` [update] — dashboard.js:4357 · `saveFahrtEndHandler()` [update] — dashboard.js:4401 · `saveFahrtStartHandler()` [update] — dashboard.js:4274

**Liest (22):** `calculateSessionInfo()`, `frag()`, `getAvailableSlots()`, `initCalendar()`, `initCalendar()`, `ladePatientenkontext()`, `ladeVerlauf()`, `loadActivityFeed()`, `loadEmpDaySchedule()`, `loadLeads()`, `loadPatientDetailTermine()`, `loadScheduleBookings()`, `loadUeberblickNoShows()`, `renderBookingCalendar()`, `renderDayView()`, `renderGaps()`, `renderGapsForDate()`, `renderMonthView()`, `renderOverviewMonthly()`, `renderOverviewWeekly()` … +2

**Dateien:** `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/warteliste.routes.js`, `api-backend/booking/from-request.js`, `api-backend/server.js`, `api/admin/data.js`, `booking.js`, `dashboard.js`, `kalender.js`, `module/fussbefund.js`, `module/patientenkarte.js`, `module/rechnung-editor.js`, `module/rechnung-verordnung.js`, `module/signal.js`, `module/termin-aktionen.js`, `module/termin-patient-bezug.js`

**Module:** abrechnung, fussstatus, hours, kunden, services, team, ueberblick

### `breaks`

7 Spalten · Status: aktiv
Warum: Pausen sind keine Arbeitszeit und keine Abwesenheit — sie wiederholen sich täglich und müssen Slots blockieren.

**Schreibt (2):** `loadEmpHours()` [delete/insert] — dashboard.js:11780 · `renderHoursGrid()` [delete/insert] — dashboard.js:10524

**Liest (1):** `getAvailableSlots()`

**Dateien:** `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, hours, kunden, team

### `businesses`

26 Spalten · Status: aktiv
Warum: Zweiter Standort und aufwärts. Ohne Standortbegriff ließen sich Öffnungszeiten, Team und Leistungen nicht trennen, sobald eine Praxis mehr als eine Adresse hat.

**Schreibt (5):** `bindBusiness()` [insert/update] — onboarding.js:388 · `deleteBusiness()` [delete] — dashboard.js:17723 · `ensureBusinessCoords()` [update] — dashboard.js:23105 · `toggleStandortDay()` [update] — dashboard.js:10500 · `wireBusinessModal()` [insert/update] — dashboard.js:17640

**Liest (5):** `bootBusinessSwitcher()`, `fetchBusinesses()`, `getAvailableSlots()`, `init()`, `renderBookingCalendar()`

**Dateien:** `api-backend/billing/api/ausfall.routes.js`, `api-backend/server.js`, `api/stripe/webhook.js`, `attendance.js`, `booking.js`, `confirm.html`, `dashboard.js`, `onboarding.js`

**Module:** abrechnung, hours, kunden, services, team

### `calendar_integrations`

9 Spalten · Status: aktiv
Warum: Google-Kalender-Anbindung je Nutzer: Tokens, Kalender-ID, Synchronisationszustand.

**Schreibt (2):** `loadIntegrations()` [delete] — kalender.js:609 · `loadSettings()` [delete] — dashboard.js:12593

**Liest (2):** `getAvailableSlots()`, `openEmpDetail()`

**Dateien:** `api-backend/server.js`, `api/admin/data.js`, `dashboard.js`, `kalender.js`

**Module:** abrechnung, kunden, settings, team

### `chatbot_usage`

15 Spalten · Status: verdächtig
Warum: Token- und Kostenprotokoll des Website-Chatbots.

**Dateien:** `api/admin/data.js`

### `consent_log`

9 Spalten · Status: aktiv
Warum: Nachweis der Einwilligung des **Praxisinhabers** (AVV, AGB, Datenschutz, Cookies) — DSGVO/TTDSG. Ohne Protokoll ist die Zustimmung nicht belegbar.

**Dateien:** `api/onboarding/pending.js`

### `custom_days`

9 Spalten · Status: aktiv
Warum: Der Einzelfall, der vom Wochenraster abweicht — verkürzter Freitag, Sondertermin am Samstag.

**Schreibt (1):** `saveSpecialDays()` [upsert] — dashboard.js:10722

**Liest (4):** `getAvailableSlots()`, `loadBookingSlots()`, `renderBookingCalendar()`, `renderHoursMiniCal()`

**Dateien:** `api-backend/server.js`, `booking.js`, `dashboard.js`

**Module:** abrechnung, hours, kunden, services, team

### `data_access_log`

15 Spalten · Status: aktiv
Warum: Zugriffsprotokoll nach DSGVO Art. 32 — wer hat wann welche Patientendaten gesehen. Aufbewahrung 12 Monate.

**Schreibt (1):** `logAccess()` [insert] — api-backend/_lib/access-log.js:72

**Dateien:** `api-backend/_lib/access-log.js`, `api/dsgvo.js`

### `data_sharing_settings`

8 Spalten · Status: aktiv
Warum: Ein Inhaber mit mehreren Standorten muss je Datenkategorie entscheiden: gemeinsam oder getrennt. Fehlende Zeile = alles getrennt (bewusst als sichere Vorgabe).

**Schreibt (1):** `saveDataSharing()` [upsert] — dashboard.js:17486

**Liest (1):** `loadDataSharing()`

**Dateien:** `dashboard.js`

### `demo_bookings`

11 Spalten · Status: aktiv
Warum: Demo-Termine von der Marketing-Seite. Die dürfen die echte Terminverwaltung nicht anfassen.

**Dateien:** `api/demo-booking.js`

### `diagnosegruppen`

20 Spalten · Status: aktiv (Referenz)
Warum: Diagnosegruppen der Heilmittel-Richtlinie samt ICD-Regeln — die Brücke zwischen Diagnose und zulässigem Heilmittel.

**Schreibt (1):** `main()` [update] — api-backend/check_diagnosegruppen_icd.js:94

**Liest (2):** `loadDgIcdRules()`, `podRegelnLaden()`

**Dateien:** `api-backend/check_diagnosegruppen_icd.js`, `module/diagnosegruppen-regeln.js`, `module/verordnung-podo.js`

**Module:** abrechnung, kunden, podologie-billing, team

### `document_vorlagen`

9 Spalten · Status: aktiv
Warum: Druckvorlagen je Inhaber (Rechnung, Mahnung, Bericht) als JSON. Sonst müsste jede Layoutänderung deployt werden.

**Schreibt (9):** `_enterAnsichtEditMode()` [update] — dashboard.js:13242 · `commit()` [update] — dashboard.js:13474 · `deleteVorlage()` [delete] — dashboard.js:13442 · `duplicateVorlage()` [insert] — dashboard.js:13451 · `openVorlagenAnsicht()` [update] — dashboard.js:13152 · `saveVorlage()` [insert/update] — dashboard.js:13412 · `seedDefaultVorlagen()` [insert] — dashboard.js:13510 · `seedMissingVorlagen()` [insert] — dashboard.js:13516 · `startVorlagenInlineRename()` [update] — dashboard.js:13467

**Liest (2):** `loadVorlagenPanel()`, `openVorlagenEdit()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `dashboard.js`

**Module:** abrechnung, kunden, team, vorlagen

### `dta_schluessel`

10 Spalten · Status: Referenz, im Code ungenutzt
Warum: Schlüsselverzeichnisse aus Anlage 3 TP5 (Kennzeichen, Gruppen, Codes) als Datenbestand.

### `email_logs`

11 Spalten · Status: aktiv
Warum: Welche Mail ging wann an wen raus. Bei Terminbestätigungen ist „ist die Mail angekommen?" die häufigste Rückfrage.

**Schreibt (1):** `loadPatientDetailMails()` [update] — dashboard.js:9072

**Dateien:** `api/admin/data.js`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `employee_business_assignments`

5 Spalten · Status: aktiv
Warum: Ein Angestellter kann an mehreren Standorten arbeiten. Die Zuordnung passt weder in `profiles` (1:n) noch in `businesses`.

**Schreibt (3):** `renderEmpStandortList()` [delete/upsert] — dashboard.js:11335 · `renderOtherStandortEmps()` [upsert] — dashboard.js:11188 · `saveEmpPermissions()` [upsert] — dashboard.js:11436

**Liest (5):** `bootBusinessSwitcher()`, `getAvailableSlots()`, `init()`, `loadEmpPermissions()`, `loadTeam()`

**Dateien:** `api-backend/server.js`, `booking.js`, `confirm.html`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `employee_groups`

5 Spalten · Status: aktiv
Warum: Rollen oberhalb von „Inhaber/Angestellter" — Rezeption, Therapeut, Leitung. Wird beim Anlegen eines Standorts automatisch vorbefüllt.

**Liest (3):** `loadEmpPermissions()`, `renderEmpStandortList()`, `renderOtherStandortEmps()`

**Dateien:** `confirm.html`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `employee_scope_overrides`

5 Spalten · Status: aktiv
Warum: Ausnahme für eine einzelne Person, ohne dafür eine neue Gruppe zu erfinden („die eine Rezeptionskraft darf zusätzlich Rechnungen sehen").

**Schreibt (1):** `saveEmpPermissions()` [delete/insert] — dashboard.js:11436

**Liest (1):** `renderEmpPermGrid()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, kunden, team

### `employee_services`

4 Spalten · Status: aktiv
Warum: Nicht jeder Therapeut macht jede Leistung. Ohne diese Zuordnung bietet die Buchungsseite Termine bei Leuten an, die sie nicht durchführen dürfen.

**Schreibt (3):** `loadEmpServices()` [delete/insert] — dashboard.js:11872 · `normName()` [insert] — onboarding.js:599 · `syncServices()` [insert] — onboarding.js:618

**Liest (2):** `loadServices()`, `openBookingFromRxPreset()`

**Dateien:** `api-backend/server.js`, `api/stripe/webhook.js`, `booking.js`, `dashboard.js`, `kalender.js`, `onboarding.js`

**Module:** abrechnung, kunden, services, team

### `fahrten`

21 Spalten · Status: aktiv
Warum: Fahrtenbuch für Hausbesuche, finanzamtstauglich (Zweck, Start-/Zielort, Kilometer).

**Schreibt (2):** `saveFahrtEndHandler()` [upsert] — dashboard.js:4401 · `saveFahrtStartHandler()` [upsert] — dashboard.js:4274

**Liest (2):** `loadActivityFeed()`, `loadFbFahrten()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, fahrtenbuch, kunden, team

### `feedbacks`

12 Spalten · Status: aktiv
Warum: Rückmeldung aus dem Produkt heraus. Ein Trigger schickt jeden neuen Eintrag per Telegram — sonst liest sie niemand rechtzeitig.

**Liest (1):** `loadFeedbacks()`

**Dateien:** `api/admin/feedbacks.js`, `dashboard.js`

**Module:** abrechnung, feedback, kunden, team

### `fußstatus`

11 Spalten · Status: veraltet
Warum: Der **alte** Fußbefund aus dem ersten Podologie-Wurf.

### `group_scopes`

4 Spalten · Status: aktiv
Warum: Was eine Gruppe darf. Trennt die Rechtematrix von der Gruppendefinition, damit Rechte änderbar sind ohne Gruppen anzufassen.

**Liest (2):** `renderEmpPermGrid()`, `saveEmpPermissions()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, kunden, team

### `heilmittel_catalog`

10 Spalten · Status: veraltet
Warum: Erster Podologie-Katalog (nur HPNR 78xxx), aus der Zeit vor der Vereinheitlichung.

### `heilmittel_katalog`

20 Spalten · Status: aktiv (Referenz)
Warum: Der **aktive**, vereinheitlichte und zeitversionierte Heilmittelkatalog aller vier Fachbereiche. Löste die beiden Vorgänger ab, weil abgelöste Positionen sonst als unbegrenzt gültig erschienen.

**Schreibt (1):** `main()` [delete/upsert] — api-backend/sync_heilmittel_katalog.js:109

**Dateien:** `api-backend/sync_heilmittel_katalog.js`

### `heilmittel_position`

19 Spalten · Status: veraltet
Warum: §302-Abrechnungspositionen mit Preisen und Zuzahlung, Physio-Seed aus der A2-Phase.

### `heilmittel_tarif`

10 Spalten · Status: aktiv (Referenz)
Warum: Preise je Kostenträger und Stichtag — die Tarifseite zum Katalog. 928 Zeilen.

**Schreibt (1):** `seed()` [delete/insert] — api-backend/seed_tarifs.js:33

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/seed_tarifs.js`

### `icd10_titles`

7 Spalten · Status: aktiv (Referenz)
Warum: ICD-10-GM 2026, 16.905 Kodes. Der Anwender soll suchen können, ohne den Code zu kennen.

### `icd_sector_ranges`

5 Spalten · Status: aktiv (Referenz)
Warum: Welcher ICD-Bereich zu welchem Fachbereich gehört. Grundlage des `strict`-Filters, der fachfremde Diagnosen ganz aus der Auswahl nimmt.

### `invoices`

34 Spalten · Status: aktiv
Warum: Die Rechnung an Privatzahler und Selbstzahler (GKV läuft über `abrechnung`).

**Schreibt (2):** `markiereRechnungBezahlt()` [update] — module/rechnung-zahlung.js:49 · `saveInvoice()` [insert/update] — dashboard.js:15577

**Liest (4):** `downloadDmrzForInvoice()`, `loadActivityFeed()`, `loadPatientDetailRechnungen()`, `loadRechnungen()`

**Dateien:** `dashboard.js`, `module/rechnung-zahlung.js`

**Module:** abrechnung, kunden, rechnungen, team

### `kiosk_pins`

6 Spalten · Status: aktiv
Warum: Der Kiosk-Modus (Tablet im Wartezimmer) braucht eine Anmeldung, die kein Passwort ist. Die PIN liegt als scrypt-Hash, geprüft wird ausschließlich im Backend.

**Dateien:** `api-backend/server.js`

### `kostentraeger`

9 Spalten · Status: aktiv, aber **Mock-Daten**
Warum: Die §302-Seite der Kassen: IK-Nummern, Annahmestellen, Datenannahme-Wege. Das ist etwas anderes als die Kassenliste in der Oberfläche.

**Liest (1):** `loadAbrechnung()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `krankenkassen`

6 Spalten · Status: aktiv (Referenz)
Warum: Die Kassenliste für das Auswahlfeld in der Oberfläche. 93 GKV-Kassen, gesetzt am 02.06.2026.

**Liest (2):** `ladeKassen()`, `loadKkList()`

**Dateien:** `api-backend/server.js`, `booking-request.js`, `dashboard.js`, `module/krankenkasse-suche.js`

**Module:** abrechnung, kunden, podologie-billing, team, verordnungen

### `leads`

51 Spalten · Status: aktiv
Warum: **Das ist die Patientenakte.** Der Name stammt aus der Akquise-Zeit (daher `title`, `google_url`, `reviews_count`) und ist geblieben, weil ein Umbenennen jede Abfrage im Projekt anfasst.

**Schreibt (3):** `handleDirectAusfallrechnung()` [update] — dashboard.js:4635 · `initSchnellerfassung()` [insert] — dashboard.js:21758 · `saveRezept()` [update] — dashboard.js:17118

**Liest (29):** `ausfallVereinbarungDatum()`, `downloadDmrzForInvoice()`, `fillRzPatientFromLead()`, `handleSessionDrop()`, `handleTerminStarten()`, `initBkCustomerAutocomplete()`, `initBkGroupPatientAutocomplete()`, `initCalRightPanel()`, `initWlPatientAutocomplete()`, `ladeKassen()`, `ladePatienten()`, `loadActivityFeed()`, `loadAnamnese()`, `loadB2C()`, `loadBkLeads()`, `loadInvPatients()`, `loadLeads()`, `loadNotizen()`, `loadPatientDetailMails()`, `loadUeberblickBirthdays()` … +9

**Dateien:** `api-backend/billing/api/statistik.routes.js`, `api-backend/server.js`, `dashboard.js`, `module/arzt-register.js`, `module/fussbefund.js`, `module/krankenkasse-suche.js`, `module/patienten-einwilligung.js`, `module/rechnung-editor.js`, `module/termin-patient-bezug.js`, `module/verordnung-uebersicht.js`

**Module:** abrechnung, anamnese, b2c, doctors, fussstatus, kunden, notizen, podologie-billing, rechnungen, settings, team, ueberblick, verordnungen

### `mahnungen`

13 Spalten · Status: aktiv
Warum: Mahnstufen zu offenen Rechnungen, mit eigenem Nummernkreis.

**Dateien:** `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`

### `messreihen`

12 Spalten · Status: aktiv
Warum: Messwerte im Verlauf (Blankoverordnung: der Therapeut muss den Behandlungserfolg belegen).

**Schreibt (2):** `refreshMessreihen()` [delete] — dashboard.js:8797 · `saveMessung()` [insert] — dashboard.js:8921

**Dateien:** `dashboard.js`

**Module:** abrechnung, kunden, team

### `module_visibility`

6 Spalten · Status: aktiv
Warum: Nicht jede Praxis braucht jedes Sidebar-Modul. Der Schalter je Inhaber und Modul liegt hier; die Modulliste selbst steht im Code (`nav-registry.js`).

**Schreibt (2):** `loadVisibility()` [upsert] — admin.js:288 · `saveVisToggle()` [upsert] — admin.js:387

**Liest (1):** `loadVisibilityMatrix()`

**Dateien:** `admin.js`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `nummernkreise`

4 Spalten · Status: aktiv
Warum: Lückenlose, race-freie Nummernvergabe je Inhaber und Jahr (`rechnung_nr`, `beleg_nr`, `mahnung_nr`). Vorher zählte das Frontend mit `MAX+1` hoch — bei zwei gleichzeitigen Nutzern gibt das dieselbe Nummer zweimal.

### `pat_fussbefund`

11 Spalten · Status: aktiv
Warum: Der aktuelle podologische Fußbefund samt Fußkarte. Ersetzt fachlich `fußstatus`.

**Schreibt (2):** `renderBefundListe()` [delete] — module/fussbefund.js:695 · `speichern()` [insert/update] — module/fussbefund.js:577

**Liest (4):** `ladePatientenkontext()`, `ladeVerlauf()`, `renderFussbefundArchiv()`, `verdrahteFussbefundKnopf()`

**Dateien:** `module/fussbefund-archiv.js`, `module/fussbefund.js`, `module/patientenkarte.js`

**Module:** abrechnung, fussstatus, kunden, team

### `patient_consents`

16 Spalten · Status: aktiv
Warum: Digitale Einwilligung des Patienten mit einfacher elektronischer Signatur. Vorher gab es dafür nur Papier, und der Nachweis fehlte bei Praxisübergabe.

**Schreibt (2):** `speichereEinwilligung()` [insert] — module/patienten-einwilligung.js:295 · `widerrufen()` [update] — module/patienten-einwilligung.js:535

**Liest (2):** `kopieOeffnen()`, `renderEinwilligungListe()`

**Dateien:** `module/patienten-einwilligung.js`

### `patient_notes`

10 Spalten · Status: aktiv
Warum: Freitext-Notizen zum Patienten, die weder Anamnese noch Behandlungsdokumentation sind.

**Liest (4):** `loadActivityFeed()`, `loadNotizen()`, `loadPatientDetailNotes()`, `loadPatientNotes()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, kunden, notizen, team

### `patients`

8 Spalten · Status: aktiv
Warum: Der Anfragende ist noch kein Patient der Praxis. Er darf nicht in die echte Akte (`leads`) geschrieben werden, bevor jemand die Anfrage angenommen hat.

**Dateien:** `api-backend/server.js`

### `pending_employee_registrations`

7 Spalten · Status: aktiv
Warum: Dasselbe für Angestellte: der Inhaber gibt einen 6-stelligen `company_code` heraus, der Angestellte registriert sich, der Inhaber bestätigt. Zwischen Registrierung und Bestätigung liegt der Datensatz hier.

**Dateien:** `confirm.html`, `employee-signup.js`

### `pending_signups`

6 Spalten · Status: aktiv
Warum: Zwischen „Formular ausgefüllt" und „bezahlt" existiert der Account noch nicht. Die Anmeldedaten müssen solange irgendwo liegen — inklusive Passwort, und das darf nicht im Klartext stehen.

**Dateien:** `api-backend/server.js`, `api/stripe/create-checkout-session.js`, `api/stripe/webhook.js`

### `podologie_behandlungen`

11 Spalten · Status: aktiv
Warum: Die Behandlung zur podologischen Verordnung — das Gegenstück zu `prescription_sessions` im anderen Topf.

**Schreibt (1):** `loadPodologieBilling()` [insert] — module/podologie-abrechnung.js:259

**Liest (1):** `ladeVerlauf()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `module/patientenkarte.js`, `module/podologie-abrechnung.js`, `module/rechnung-bruecke.js`, `module/rechnung-verordnung.js`, `module/verordnung-uebersicht.js`

**Module:** abrechnung, kunden, podologie-billing, team

### `prescription_documents`

13 Spalten · Status: aktiv
Warum: Nachweise und Anhänge zu einer Verordnung — Befreiungsausweis, LHB-Genehmigung, korrigierte Verordnung, Therapiebericht. Als Spalten in `prescriptions` wären es beliebig viele.

**Schreibt (1):** `uploadRxNachweise()` [insert] — dashboard.js:18711

**Dateien:** `dashboard.js`

### `prescription_sessions`

9 Spalten · Status: aktiv
Warum: Die einzelne Behandlungseinheit auf der Verordnung. Ohne sie ließe sich nicht sagen, wie viele der verordneten Einheiten schon geleistet sind.

**Schreibt (4):** `handlePatientNichtErschienen()` [update] — dashboard.js:4585 · `handleSessionDrop()` [update] — dashboard.js:3994 · `linkBookingsToPrescriptionSessions()` [insert/update] — dashboard.js:7533 · `markPrescriptionSession()` [update] — dashboard.js:7500

**Liest (6):** `decorateBookingTitleWithSession()`, `loadCalRpUnverga()`, `loadRxSessionsPanel()`, `openInvView()`, `pruefeVerordnungsfortschritt()`, `zaehler()`

**Dateien:** `api-backend/billing/api/statistik.routes.js`, `api-backend/server.js`, `dashboard.js`, `module/frequenz-pruefung.js`, `module/rechnung-editor.js`, `module/sitzung-abgleich.js`, `module/sitzungsfortschritt.js`, `module/termin-aktionen.js`

**Module:** abrechnung, kunden, rechnungen, team

### `prescription_validations`

13 Spalten · Status: aktiv
Warum: Prüfergebnis der Rezeptvalidierung samt Übersteuerung. Getrennt von `prescriptions`, weil es ein Protokoll ist: wer hat wann welche Warnung überstimmt.

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/server.js`

### `prescriptions`

71 Spalten · Status: aktiv
Warum: Die Verordnung (Muster 13) für Physio/Ergo/Logopädie: Diagnose, Heilmittel, Frequenz, Genehmigung — die Grundlage jeder GKV-Abrechnung.

**Schreibt (8):** `betragNullsetzen()` [update] — module/zuzahlung-befreiung.js:249 · `downloadDmrzForInvoice()` [update] — dashboard.js:15733 · `flipAbrechnungStatus()` [update] — dashboard.js:8651 · `pruefeVerordnungsfortschritt()` [update] — module/sitzungsfortschritt.js:82 · `renderAbrechnungHistory()` [update] — dashboard.js:20079 · `renderAbrechnungReady()` [update] — dashboard.js:19846 · `saveRezept()` [insert] — dashboard.js:17118 · `triggerStorno()` [update] — dashboard.js:21183

**Liest (17):** `initBkCustomerAutocomplete()`, `ladeVerlauf()`, `ladeZuweisungen()`, `linkBookingsToPrescriptionSessions()`, `loadAbrechnung()`, `loadAnamneseRxContext()`, `loadBkVerordnungen()`, `loadCalRpRezeptInfo()`, `loadPatientDetailRezepte()`, `loadPatRxTable()`, `loadPhysioRezKpis()`, `loadRxSessionsPanel()`, `loadUeberblickDeadlines()`, `openInvView()`, `showZaaErrors()`, `verordnungenListeLaden()`, `zeigeVerordnungDetail()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/server.js`, `dashboard.js`, `module/arzt-register.js`, `module/patientenkarte.js`, `module/rechnung-verordnung.js`, `module/rechnung-zahlung.js`, `module/sitzungsfortschritt.js`, `module/termin-aktionen.js`, `module/verordnung-detail.js`, `module/verordnung-liste.js`, `module/verordnung-uebersicht.js`, `module/zuzahlung-befreiung.js`

**Module:** abrechnung, anamnese, belegliste, doctors, kunden, podologie-billing, rechnungen, settings, team, ueberblick, verordnungen

### `profiles`

82 Spalten · Status: aktiv
Warum: Der Dreh- und Angelpunkt der Mandantentrennung. Jeder Account — Inhaber wie Angestellter — hat genau eine Zeile; `role` und `owner_id` entscheiden, wer wessen Daten sieht. Weil Einzelstandort-Inhaber gar keinen `businesses`-Datensatz haben, liegen **Inhaber-Einstellungen hier**, nicht in `businesses`.

**Schreibt (18):** `bindBilling()` [update] — onboarding.js:453 · `bindBusiness()` [update] — onboarding.js:388 · `bindHours()` [update] — onboarding.js:813 · `bindOwner()` [update] — onboarding.js:516 · `bindPlan()` [update] — onboarding.js:870 · `ensureBookingSlug()` [update] — dashboard.js:13868 · `ensureClinicLocation()` [update] — dashboard.js:5882 · `ensureCompanyCode()` [update] — dashboard.js:13851 · `handleSave()` [update] — onboarding.js:457 · `init()` [update] — kalender.js:140 · `initAnfragenPanel()` [update] — dashboard.js:23673 · `loadProfile()` [insert] — onboarding.js:115 · `openEmpDetail()` [update] — dashboard.js:11489 · `openStripePortal()` [update] — dashboard.js:2277 · `renderLegendeSettings()` [update] — module/fussbefund.js:1381 · `saveAusfallSettings()` [update] — dashboard.js:17408 · `saveEmployee()` [insert] — dashboard.js:14560 · `saveStepProgress()` [update] — onboarding.js:281

**Liest (25):** `approveAnfrage()`, `fetchBusinesses()`, `gehoertZurPraxis()`, `getAvailableSlots()`, `handleDirectAusfallrechnung()`, `ladeLegende()`, `loadAusfallConfig()`, `loadEmpUrlaubSection()`, `loadFahrtenbuchPanel()`, `loadFbFahrten()`, `loadFbReports()`, `loadHoursPanel()`, `loadPatientDetailAnamnese()`, `loadPraxisProfile()`, `loadTeam()`, `loadUeberblickVacations()`, `proceedToOwnerCheck()`, `renderOtherStandortEmps()`, `renderSidebar()`, `requireAuth()` … +5

**Dateien:** `api-backend/ai/auth.js`, `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `api-backend/billing/api/warteliste.routes.js`, `api-backend/fix_db.js`, `api-backend/server.js`, `api-backend/test_schema.js`, `api/admin/data.js`, `api/dsgvo.js`, `api/onboarding/check-email.js`, `api/stripe/create-checkout-session.js`, `api/stripe/portal-session.js`, `api/stripe/webhook.js`, `attendance.js`, `confirm.html`, `dashboard.js`, `kalender.js`, `module/beleg-druck.js`, `module/fussbefund.js`, `onboarding.js`

**Module:** abrechnung, anfragen, fahrtenbuch, fussstatus, hours, kunden, team, ueberblick

### `referral_drafts`

21 Spalten · Status: verdächtig
Warum: Erster Rezept-Fluss: Foto einer Verordnung → KI-Auszug (`raw_ai_data`, `seans_sayisi`, `tedavi_turu`) → Bestätigung → Terminserie (`booking_series_id`). Der Vorläufer von `prescriptions` + `/booking/ai-suggest-series`.

### `scraper_data`

14 Spalten · Status: aktiv (Randmodul)
Warum: Ergebnisse der Apify-Suche (Google-Maps-Praxen) als Akquiseliste — die Zulieferung für `b2b_contacts`.

**Liest (1):** `loadDoctors()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, doctors, kunden, team

### `services`

18 Spalten · Status: aktiv
Warum: Was die Praxis anbietet, mit Dauer und Preis. Grundlage für Slot-Berechnung und Abrechnung.

**Schreibt (7):** `autoSeedGkvServices()` [insert] — dashboard.js:9683 · `ensureBlankoBonusServices()` [insert/update] — dashboard.js:7722 · `migratePodologieLegacyServices()` [update] — dashboard.js:9879 · `normName()` [delete/insert/update] — onboarding.js:599 · `renderServices()` [delete] — dashboard.js:10146 · `syncServices()` [delete/insert/update] — onboarding.js:618 · `wireBusinessModal()` [insert] — dashboard.js:17640

**Liest (10):** `baseQuery()`, `findMatchingServiceId()`, `getAvailableSlots()`, `initCalendar()`, `loadEmpServices()`, `loadProfile()`, `loadServices()`, `loadServices()`, `populateRxcServiceSelect()`, `updateBkDuration()`

**Dateien:** `api-backend/booking/from-request.js`, `api-backend/check_db.js`, `api-backend/server.js`, `api/stripe/webhook.js`, `dashboard.js`, `kalender.js`, `onboarding.js`

**Module:** abrechnung, kunden, services, team

### `spatial_ref_sys`

5 Spalten · Status: System
Warum: Systemtabelle der PostGIS-Erweiterung (Koordinatensysteme). Kam mit `enable_postgis` für die Geocodierung im Fahrtenbuch.

### `terapeut_zertifikat`

10 Spalten · Status: aktiv
Warum: Das **Signaturzertifikat** für die §302-Einreichung (PKCS#7). Ohne gültiges Zertifikat lässt sich keine DTA-Datei signieren.

**Liest (3):** `ikVorbelegen()`, `loadSettings()`, `renderOverview()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `dashboard.js`, `module/verordnung-podo.js`

**Module:** abrechnung, kunden, settings, team

### `therapist_certificates`

5 Spalten · Status: aktiv
Warum: Fachliche Qualifikationen des Therapeuten (MT, MLD, KGG). Bestimmte Leistungen darf nur abrechnen, wer die Qualifikation nachweist.

**Schreibt (1):** `loadEmpCertificates()` [delete/insert] — dashboard.js:11958

**Liest (2):** `loadAbrechnung()`, `loadEmpServices()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `time_offs`

12 Spalten · Status: aktiv
Warum: Urlaub, Krankheit, Fortbildung. Anders als `custom_days` personenbezogen und mehrtägig.

**Schreibt (5):** `deleteEmpTimeOff()` [delete] — dashboard.js:11093 · `deleteUrlaub()` [delete] — dashboard.js:11167 · `loadTeam()` [insert] — dashboard.js:10825 · `openEmpDetail()` [insert] — dashboard.js:11489 · `saveUrlaub()` [insert] — dashboard.js:11109

**Liest (7):** `getAvailableSlots()`, `initCalendar()`, `loadEmpDaySchedule()`, `loadEmpUrlaubSection()`, `loadUeberblickVacations()`, `loadUrlaubListe()`, `renderDayView()`

**Dateien:** `api-backend/server.js`, `dashboard.js`, `kalender.js`

**Module:** abrechnung, kunden, team, ueberblick

### `trip_history`

8 Spalten · Status: fremd
Warum: Fremdprojekt, Gegenstück zu `trip_plans`.

### `trip_plans`

15 Spalten · Status: fremd
Warum: Fremdprojekt (Reiseplanung). Nicht mit dem Fahrtenbuch (`fahrten`) verwechseln — das ist unseres.

### `ueberweisungen`

9 Spalten · Status: aktiv
Warum: Überweisung an einen anderen Behandler, dokumentiert an der Akte.

**Liest (1):** `loadPatientDetailUeberweisung()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, kunden, team

### `user_credits`

6 Spalten · Status: fremd
Warum: Fremdprojekt (Guthabenmodell). Praxura rechnet über Stripe ab, nicht über Credits.

### `user_preferences`

5 Spalten · Status: aktiv
Warum: Pro Nutzer merkbare Oberflächen-Zustände (gewählter Standort, Kalenderansicht, Mitarbeiterfilter) gehören nicht in `profiles` — das ist die fachliche Stammdatentabelle.

**Schreibt (2):** `saveUserPref()` [upsert] — dashboard.js:14786 · `switchBusiness()` [upsert] — dashboard.js:17802

**Liest (2):** `bootBusinessSwitcher()`, `bootScheduleViewToggle()`

**Dateien:** `api-backend/server.js`, `api/stripe/webhook.js`, `dashboard.js`

**Module:** abrechnung, hours, kunden, team

### `vehicles`

11 Spalten · Status: aktiv
Warum: Fahrzeugstamm zum Fahrtenbuch; Kilometerstände und Kennzeichen gehören nicht an die einzelne Fahrt.

**Schreibt (3):** `loadFbVehicles()` [delete] — dashboard.js:20858 · `saveQuickVehicleHandler()` [insert] — dashboard.js:4251 · `saveVehicleEdit()` [insert/update] — dashboard.js:20961

**Liest (4):** `loadVehiclesForPicker()`, `q()`, `saveFahrtEndHandler()`, `saveFahrtStartHandler()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, fahrtenbuch, kunden, services, team

### `verordnungen`

35 Spalten · Status: aktiv
Warum: Die podologische Verordnung. Eigener Topf, weil Podologie andere Pflichtfelder hat (Wagner-Armstrong-Grad, Fußstatus-Bezug) und die Abrechnung über HPNR 78xxx läuft.

**Schreibt (1):** `loadPodologieBilling()` [insert/update] — module/podologie-abrechnung.js:259

**Liest (3):** `ladeStatusJePatient()`, `ladeVerlauf()`, `ladeZuweisungen()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `module/abrechnungsstatus.js`, `module/arzt-register.js`, `module/patientenkarte.js`, `module/podologie-abrechnung.js`, `module/rechnung-verordnung.js`, `module/verordnung-uebersicht.js`

**Module:** abrechnung, anamnese, doctors, kunden, podologie-billing, settings, team

### `visibility_reports`

8 Spalten · Status: aktiv
Warum: Telemetrie zur Modulmatrix: welcher Kunde sieht tatsächlich welche Module. Ohne diese Rückmeldung wäre die Matrix eine Behauptung.

**Schreibt (2):** `reportSidebarVisibility()` [upsert] — dashboard.js:906 · `saveVisToggle()` [delete] — admin.js:387

**Liest (1):** `loadVisibility()`

**Dateien:** `admin.js`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `warteliste`

14 Spalten · Status: aktiv
Warum: Wenn nichts frei ist, soll der Wunsch nicht verlorengehen. Wird beim Freiwerden eines Slots gegen die Wunschzeiten gematcht.

**Schreibt (1):** `initWlModal()` [delete/insert/update] — dashboard.js:22094

**Liest (1):** `loadWarteliste()`

**Dateien:** `api-backend/billing/api/warteliste.routes.js`, `dashboard.js`

**Module:** abrechnung, kunden, team, warteliste

### `working_hours`

9 Spalten · Status: aktiv
Warum: Regelarbeitszeit je Mitarbeiter und Standort — die Grundlage jeder Slot-Berechnung.

**Schreibt (2):** `bindHours()` [delete/insert] — onboarding.js:813 · `loadEmpHours()` [upsert] — dashboard.js:11780

**Liest (10):** `fetchOwnerHoursMap()`, `getAvailableSlots()`, `getEmployeeWorkingHours()`, `initWorkingHours()`, `loadHours()`, `renderBookingCalendar()`, `renderGaps()`, `renderGapsForDate()`, `renderHoursGrid()`, `renderHoursMiniCal()`

**Dateien:** `api-backend/server.js`, `api/stripe/webhook.js`, `booking.js`, `confirm.html`, `dashboard.js`, `employee-signup.js`, `kalender.js`, `onboarding.js`

**Module:** abrechnung, hours, kunden, services, team

### `zaa_fehler`

10 Spalten · Status: aktiv
Warum: Absetzungen und Fehlermeldungen der Kasse aus der ZAA-Rückmeldung, samt Übersetzung und Lösungshinweis. Roh sind die Codes für einen Therapeuten unlesbar.

**Liest (1):** `showZaaErrors()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `dashboard.js`

**Module:** abrechnung, kunden, team

### `zuzahlung_befreiung`

11 Spalten · Status: aktiv
Warum: Befreiungsausweise. Ob ein Patient zuzahlungsfrei ist, entscheidet über den abrechenbaren Betrag und darf nicht als Häkchen an der Verordnung hängen — es gilt zeitraumbezogen.

**Schreibt (2):** `uploadRxNachweise()` [insert/update] — dashboard.js:18711 · `wireBefreiungCard()` [delete] — dashboard.js:8724

**Liest (1):** `loadPatientDetailRezepte()`

**Dateien:** `dashboard.js`, `module/zuzahlung-befreiung.js`

**Module:** abrechnung, kunden, team

