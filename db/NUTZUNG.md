# Tabellen-Nutzung — wer liest, wer schreibt

> ÜRETİLEN DOSYA — elle düzenleme. `node tools/tabellenkarte.mjs`
> NİYE açıldıkları: `db/REGISTER.md` · YAPILARI: `db/SCHEMA.sql`

**Erzeugt:** 2026-09-09 · 87 Tabellen · Quelle: db/SCHEMA.sql (Stand 2026-09-09), funktionen/INDEX.json (erzeugt 2026-09-09)

## Kayıt durumu

- Register kaydı olan: **87/87**

## Kodda hiç çağrılmayan tablolar

`.from()` ile hiçbir dosyadan erişilmiyor. **Ölü demek değildir** — trigger, RPC,
view veya backend raw SQL üzerinden beslenebilir. `SQL-Treffer` sütunu SCHEMA-RLS.sql
içindeki geçiş sayısıdır: 0 ise gerçekten şüphelidir.

| Tabelle | SQL-Treffer | Register-Status |
|---|---|---|
| `abrechnung_zahlung` | 11 | aktiv |
| `abrechnung_zeile` | 13 | aktiv |
| `accommodations` | 2 | fremd |
| `applications` | 2 | fremd |
| `dta_schluessel` | 4 | Referenz, im Code ungenutzt |
| `fußstatus` | 2 | veraltet |
| `heilmittel_catalog` | 2 | veraltet |
| `heilmittel_position` | 5 | veraltet |
| `icd10_titles` | 7 | aktiv (Referenz) |
| `icd_sector_ranges` | 3 | aktiv (Referenz) |
| `nummernkreise` | 1 | aktiv |
| `referral_drafts` | 9 | verdächtig |
| `spatial_ref_sys` | 1 | System |
| `trip_history` | 1 | fremd |
| `trip_plans` | 1 | fremd |
| `user_credits` | 2 | fremd |

## DSGVO-Abdeckung (`api/dsgvo.js`)

Auskunft (Art. 15): **57** · Löschung (Art. 17): **49** · anonymisiert statt gelöscht: **2**

⚠️ Personenbezug (FK auf `leads`/`profiles`/`auth.users`) aber **nicht** in der Auskunftsliste:

`accommodations`, `admin_users`, `applications`, `booking_status_korrekturen`

Prüfen, nicht blind nachtragen: manche davon sind Konfigurations- oder
Referenztabellen ohne Personendaten. Die Entscheidung gehört ins Register.

## En çok yazılan tablolar

| Tabelle | Schreiber | Leser | Dateien | Module |
|---|---|---|---|---|
| `profiles` | 21 | 36 | 30 | abrechnung, anfragen, fahrtenbuch, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `bookings` | 16 | 39 | 30 | abrechnung, anamnese, anfragen, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, qvSaveBtn, rechnungen, services, settings, statistik, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `document_vorlagen` | 10 | 2 | 3 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen, vorlagen |
| `prescriptions` | 10 | 29 | 25 | abrechnung, anamnese, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fbFahrtenExportCsv, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, notizen, podologie-billing, qvSaveBtn, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen |
| `services` | 8 | 15 | 11 | abrechnung, anfragen, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `prescription_sessions` | 6 | 10 | 11 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `time_offs` | 6 | 8 | 3 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `businesses` | 5 | 6 | 8 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `employee_business_assignments` | 4 | 5 | 4 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `employee_services` | 4 | 2 | 6 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `leads` | 4 | 36 | 15 | abrechnung, anamnese, b2c, doctors, fussstatus, hours, kunden, notizen, rechnungen, services, settings, team, ueberblick, verordnungen |
| `aerzte` | 3 | 3 | 4 | abrechnung, anamnese, doctors, fussstatus, hours, kunden, rechnungen, services, settings, team, ueberblick, verordnungen |
| `breaks` | 3 | 2 | 2 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `calendar_integrations` | 3 | 2 | 4 | abrechnung, fussstatus, hours, kunden, rechnungen, services, settings, team, ueberblick, verordnungen |
| `fahrten` | 3 | 2 | 1 | abrechnung, fahrtenbuch, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `invoices` | 3 | 5 | 5 | abrechnung, anamnese, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fbFahrtenExportCsv, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, notizen, podologie-billing, qvSaveBtn, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen |
| `podologie_behandlungen` | 3 | 8 | 9 | abrechnung, fussstatus, hours, kunden, podologie-billing, rechnungen, services, team, ueberblick, verordnungen |
| `vehicles` | 3 | 4 | 1 | abrechnung, fahrtenbuch, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `working_hours` | 3 | 11 | 8 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `b2b_contacts` | 2 | 1 | 2 | abrechnung, b2b, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `email_logs` | 2 | 0 | 2 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `employee_scope_overrides` | 2 | 1 | 1 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `messreihen` | 2 | 0 | 1 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `module_visibility` | 2 | 1 | 2 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |
| `pat_fussbefund` | 2 | 5 | 3 | abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen |

## Alle Tabellen

### `abrechnung`

22 Spalten · Status: aktiv
Warum: Der Abrechnungslauf als Ganzes: eine Sammelrechnung an einen Kostenträger, mit DTA-Datei, Signaturzustand, Upload- und Zahlungsdatum. Ohne diesen Kopfsatz gäbe es keinen Bezugspunkt für Absetzungen.

**Schreibt (1):** `downloadAbrechnungFile()` [update] — dashboard.js:18136

**Liest (3):** `fmt()`, `ladeAbrechnungHistorie()`, `openDasGuideModal()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/statistik.routes.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `abrechnung_zahlung`

12 Spalten · Status: aktiv
Warum: Geldeingang je Sammelabrechnung, tranchenweise. Bis dahin gab es `abrechnung.paid_at`

### `abrechnung_zeile`

27 Spalten · Status: aktiv
Warum: Was in EINER Datei tatsächlich an die Kasse ging — eingefroren. Vorher wurde die

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

**Schreibt (3):** `deleteAerzte()` [delete] — dashboard.js:15871 · `editAerzte()` [update] — dashboard.js:15880 · `resolveOrCreateArzt()` [insert/update] — api-backend/lib/arzt-registry.js:55

**Liest (3):** `downloadDmrzForInvoice()`, `fillRzPatientFromLead()`, `loadAerzte()`

**Dateien:** `api-backend/lib/arzt-registry.js`, `api-backend/server.js`, `dashboard.js`, `module/rechnung-dmrz.js`

**Module:** abrechnung, anamnese, doctors, fussstatus, hours, kunden, rechnungen, services, settings, team, ueberblick, verordnungen

### `ai_audit_log`

15 Spalten · Status: aktiv
Warum: Protokoll jedes KI-Aufrufs (Rezept-OCR, Entwürfe): Modell, Kosten, Ergebnis. Nachweis gegenüber dem EU AI Act und Kostenkontrolle.

**Schreibt (1):** `logCall()` [insert] — api-backend/ai/audit.js:21

**Dateien:** `api-backend/ai/audit.js`, `api/admin/data.js`

### `anamnese`

28 Spalten · Status: aktiv
Warum: Erstaufnahme und Vorgeschichte. Eigene Tabelle, weil sie versioniert entsteht und nicht bei jedem Termin neu geschrieben wird.

**Schreibt (1):** `saveAnamnese()` [insert/update] — dashboard.js:15470

**Liest (5):** `fillAnamneseForm()`, `loadPatientDetailAnamnese()`, `openBookingActionModal()`, `printAnamnese()`, `printAnamneseInline()`

**Dateien:** `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, anamnese, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `applications`

6 Spalten · Status: fremd
Warum: Fremdprojekt (Bewerbungen). Nie Teil von Praxura.

### `attendance`

12 Spalten · Status: aktiv
Warum: Kommen/Gehen der Mitarbeiter (Arbeitszeiterfassung), getrennt von der Sollarbeitszeit in `working_hours`.

**Schreibt (1):** `toRad()` [insert/update] — api-backend/server.js:3425

**Liest (1):** `fetchHistory()`

**Dateien:** `api-backend/server.js`, `attendance.js`

### `ausfallrechnungen`

15 Spalten · Status: aktiv
Warum: Ausfallhonorar bei No-Show oder kurzfristiger Absage. Rechtlich **Schadensersatz**, damit umsatzsteuerfrei und keine GKV-Leistung — deshalb keine Zeile in `invoices`.

**Dateien:** `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`

### `b2b_contacts`

16 Spalten · Status: aktiv (Randmodul)
Warum: B2B-Akquise: Ärzte und Partner anschreiben, um Zuweisungen zu bekommen. Aus der Zeit, als Praxura noch selbst Kunden für die Praxis gewinnen wollte.

**Schreibt (2):** `fmt()` [delete/insert/update] — dashboard.js:10841 · `renderB2B()` [delete] — dashboard.js:11723

**Liest (1):** `loadB2B()`

**Dateien:** `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, b2b, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `belegliste`

14 Spalten · Status: aktiv
Warum: GoBD-Belegjournal: jeder Geldvorgang lückenlos und unveränderlich.

**Liest (3):** `loadPatientDetailRezepte()`, `saldoFuerRezept()`, `storniereZuzahlung()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/zuzahlung.routes.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `booking_leistungen`

7 Spalten · Status: aktiv
Warum: Ein Termin trägt in der Podologie fast immer mehr als eine Leistung — „Podologische Behandlung + Eingangsbefundung" ist der Normalfall, nicht die Ausnahme (Beta-1, 31.08.2026: „wenn man es nicht vollstopfen will, kann man auch einfach nur [ein] Pluszeichen drücken … und die Anzahl"). `bookings.service_id` konnte genau eine halten; der Kalenderblock war deshalb systematisch zu kurz und die zweite Leistung fiel aus der Abrechnung.

**Schreibt (1):** `speichereLeistungen()` [delete/upsert] — module/termin-leistungen.js:373

**Liest (2):** `gelernteDauer()`, `ladeLeistungen()`

**Dateien:** `module/termin-dauer.js`, `module/termin-leistungen.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `booking_requests`

37 Spalten · Status: aktiv
Warum: Termin-**Anfrage** statt Sofortbuchung: der Patient bittet um einen Termin, der Inhaber bestätigt oder lehnt ab. Ein bestätigter Antrag wird zu einem `bookings`-Eintrag.

**Schreibt (1):** `cancelRequestBookings()` [update] — api-backend/booking/cancel-request.js:3

**Dateien:** `api-backend/booking/cancel-request.js`, `api-backend/server.js`

### `booking_status_korrekturen`

9 Spalten · Status: aktiv
Warum: Beta-2 (05.09.2026, Ops #270): der Status eines vergangenen Termins (v.a. `no_show`) muss nachträglich korrigierbar sein — z.B. wenn der Patient doch noch behandelt wurde und nachträglich unterschreibt. Freie Korrektur ist erlaubt, aber niemals stillschweigend: diese Tabelle hält je Änderung fest, wer wann von welchem zu welchem Status gewechselt hat und warum. Gleicher Grund wie bei `zuzahlung_korrekturen` — eine Spalte an `bookings` hätte bei der zweiten Korrektur die erste Begründung überschrieben.

**Schreibt (1):** `korrigiereNoShow()` [insert] — module/booking-status-korrektur.js:67

**Dateien:** `module/booking-status-korrektur.js`

### `bookings`

36 Spalten · Status: aktiv
Warum: Der Termin selbst. Alles andere im Kalender hängt daran.

**Schreibt (16):** `bindeTermin()` [update] — module/verordnung-termine.js:122 · `cancelRequestBookings()` [update] — api-backend/booking/cancel-request.js:3 · `createBookingsFromRequestFactory()` [insert] — api-backend/booking/from-request.js:17 · `doMoveBooking()` [update] — dashboard.js:5423 · `handlePatientNichtErschienen()` [update] — dashboard.js:4549 · `handleSessionDrop()` [insert] — dashboard.js:3958 · `handleTerminStarten()` [update] — dashboard.js:4459 · `initBkGroupPatientAutocomplete()` [insert] — dashboard.js:4956 · `korrigiereNoShow()` [update] — module/booking-status-korrektur.js:67 · `loadGroupParticipants()` [update] — dashboard.js:4840 · `loeseTermin()` [update] — module/verordnung-termine.js:133 · `markArrivedHandler()` [update] — dashboard.js:4321 · `openBookingActionModal()` [update] — dashboard.js:3274 · `saveFahrtEndHandler()` [update] — dashboard.js:4365 · `saveFahrtStartHandler()` [update] — dashboard.js:4238 · `uebernimmSlot()` [insert] — module/warteliste-nachruecker.js:195

**Liest (39):** `_terminBearbeiten()`, `calculateSessionInfo()`, `escapeHtml()`, `fmt()`, `frag()`, `frageNachrueckerAb()`, `gelernteDauer()`, `getAvailableSlots()`, `heuteAktualisieren()`, `horizonDays()`, `initCalendar()`, `initCalendar()`, `ladeBescheinigungTermine()`, `ladeKommendeTermineDesPatienten()`, `ladePatientenkontext()`, `ladePatientTermine()`, `ladePodoTermine()`, `ladeTerminVollstaendig()`, `ladeVerlauf()`, `loadActivityFeed()` … +19

**Dateien:** `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/warteliste.routes.js`, `api-backend/billing/statistik/therapeuten.js`, `api-backend/booking/cancel-request.js`, `api-backend/booking/from-request.js`, `api-backend/server.js`, `api/admin/data.js`, `booking.js`, `dashboard.js`, `kalender.js`, `module/behandlungsbestaetigung.js`, `module/booking-status-korrektur.js`, `module/fussbefund.js`, `module/kalender-monat.js`, `module/kalender-woche.js`, `module/patient-termine.js`, `module/patientenkarte.js`, `module/podologie-abrechnung.js`, `module/rechnung-editor.js`, `module/rechnung-editor.test.js`, `module/rechnung-verordnung.js`, `module/signal.js`, `module/termin-aktionen.js`, `module/termin-dauer.js`, `module/termin-heute.js`, `module/termin-laden.js`, `module/termin-patient-bezug.js`, `module/verordnung-detail.js`, `module/verordnung-termine.js`, `module/warteliste-nachruecker.js`

**Module:** abrechnung, anamnese, anfragen, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, qvSaveBtn, rechnungen, services, settings, statistik, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `breaks`

7 Spalten · Status: aktiv
Warum: Pausen sind keine Arbeitszeit und keine Abwesenheit — sie wiederholen sich täglich und müssen Slots blockieren.

**Schreibt (3):** `fmt()` [delete/insert] — dashboard.js:10841 · `loadEmpHours()` [delete/insert] — dashboard.js:11464 · `renderHoursGrid()` [delete/insert] — dashboard.js:10210

**Liest (2):** `getAvailableSlots()`, `horizonDays()`

**Dateien:** `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `businesses`

26 Spalten · Status: aktiv
Warum: Zweiter Standort und aufwärts. Ohne Standortbegriff ließen sich Öffnungszeiten, Team und Leistungen nicht trennen, sobald eine Praxis mehr als eine Adresse hat.

**Schreibt (5):** `bindBusiness()` [insert/update] — onboarding.js:388 · `deleteBusiness()` [delete] — dashboard.js:16930 · `ensureBusinessCoords()` [update] — dashboard.js:20864 · `toggleStandortDay()` [update] — dashboard.js:10186 · `wireBusinessModal()` [insert/update] — dashboard.js:16847

**Liest (6):** `bootBusinessSwitcher()`, `fetchBusinesses()`, `getAvailableSlots()`, `init()`, `renderBookingCalendar()`, `toRad()`

**Dateien:** `api-backend/billing/api/ausfall.routes.js`, `api-backend/server.js`, `api/stripe/webhook.js`, `attendance.js`, `booking.js`, `confirm.html`, `dashboard.js`, `onboarding.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `calendar_integrations`

9 Spalten · Status: aktiv
Warum: Google-Kalender-Anbindung je Nutzer: Tokens, Kalender-ID, Synchronisationszustand.

**Schreibt (3):** `fmt()` [delete] — dashboard.js:10841 · `loadIntegrations()` [delete] — kalender.js:747 · `loadSettings()` [delete] — dashboard.js:12277

**Liest (2):** `getAvailableSlots()`, `openEmpDetail()`

**Dateien:** `api-backend/server.js`, `api/admin/data.js`, `dashboard.js`, `kalender.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, settings, team, ueberblick, verordnungen

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

**Schreibt (1):** `saveSpecialDays()` [upsert] — dashboard.js:10408

**Liest (5):** `getAvailableSlots()`, `horizonDays()`, `loadBookingSlots()`, `renderBookingCalendar()`, `renderHoursMiniCal()`

**Dateien:** `api-backend/server.js`, `booking.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `data_access_log`

15 Spalten · Status: aktiv
Warum: Zugriffsprotokoll nach DSGVO Art. 32 — wer hat wann welche Patientendaten gesehen. Aufbewahrung 12 Monate.

**Schreibt (1):** `logAccess()` [insert] — api-backend/_lib/access-log.js:72

**Dateien:** `api-backend/_lib/access-log.js`, `api/dsgvo.js`

### `data_sharing_settings`

8 Spalten · Status: aktiv
Warum: Ein Inhaber mit mehreren Standorten muss je Datenkategorie entscheiden: gemeinsam oder getrennt. Fehlende Zeile = alles getrennt (bewusst als sichere Vorgabe).

**Schreibt (1):** `saveDataSharing()` [upsert] — dashboard.js:16693

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

**Liest (3):** `loadDgIcdRules()`, `podRegelnLaden()`, `regelsatzLaden()`

**Dateien:** `api-backend/check_diagnosegruppen_icd.js`, `module/diagnosegruppen-regeln.js`, `module/verordnung-podo.js`, `module/verordnung-regelsatz-cache.js`

**Module:** abrechnung, fussstatus, hours, kunden, podologie-billing, rechnungen, services, team, ueberblick, verordnungen

### `document_vorlagen`

9 Spalten · Status: aktiv
Warum: Druckvorlagen je Inhaber (Rechnung, Mahnung, Bericht) als JSON. Sonst müsste jede Layoutänderung deployt werden.

**Schreibt (10):** `_enterAnsichtEditMode()` [update] — dashboard.js:12926 · `commit()` [update] — dashboard.js:13158 · `deleteVorlage()` [delete] — dashboard.js:13126 · `duplicateVorlage()` [insert] — dashboard.js:13135 · `fmt()` [delete/insert/update] — dashboard.js:10841 · `openVorlagenAnsicht()` [update] — dashboard.js:12836 · `saveVorlage()` [insert/update] — dashboard.js:13096 · `seedDefaultVorlagen()` [insert] — dashboard.js:13194 · `seedMissingVorlagen()` [insert] — dashboard.js:13200 · `startVorlagenInlineRename()` [update] — dashboard.js:13151

**Liest (2):** `loadVorlagenPanel()`, `openVorlagenEdit()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen, vorlagen

### `dta_schluessel`

10 Spalten · Status: Referenz, im Code ungenutzt
Warum: Schlüsselverzeichnisse aus Anlage 3 TP5 (Kennzeichen, Gruppen, Codes) als Datenbestand.

### `email_logs`

11 Spalten · Status: aktiv
Warum: Welche Mail ging wann an wen raus. Bei Terminbestätigungen ist „ist die Mail angekommen?" die häufigste Rückfrage.

**Schreibt (2):** `fmt()` [insert] — dashboard.js:10841 · `loadPatientDetailMails()` [update] — dashboard.js:8910

**Dateien:** `api/admin/data.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `employee_business_assignments`

5 Spalten · Status: aktiv
Warum: Ein Angestellter kann an mehreren Standorten arbeiten. Die Zuordnung passt weder in `profiles` (1:n) noch in `businesses`.

**Schreibt (4):** `fmt()` [delete/upsert] — dashboard.js:10841 · `renderEmpStandortList()` [delete/upsert] — dashboard.js:11019 · `renderOtherStandortEmps()` [upsert] — dashboard.js:10872 · `saveEmpPermissions()` [upsert] — dashboard.js:11120

**Liest (5):** `bootBusinessSwitcher()`, `getAvailableSlots()`, `init()`, `loadEmpPermissions()`, `loadTeam()`

**Dateien:** `api-backend/server.js`, `booking.js`, `confirm.html`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `employee_groups`

5 Spalten · Status: aktiv
Warum: Rollen oberhalb von „Inhaber/Angestellter" — Rezeption, Therapeut, Leitung. Wird beim Anlegen eines Standorts automatisch vorbefüllt.

**Liest (4):** `fmt()`, `loadEmpPermissions()`, `renderEmpStandortList()`, `renderOtherStandortEmps()`

**Dateien:** `confirm.html`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `employee_scope_overrides`

5 Spalten · Status: aktiv
Warum: Ausnahme für eine einzelne Person, ohne dafür eine neue Gruppe zu erfinden („die eine Rezeptionskraft darf zusätzlich Rechnungen sehen").

**Schreibt (2):** `fmt()` [delete/insert] — dashboard.js:10841 · `saveEmpPermissions()` [delete/insert] — dashboard.js:11120

**Liest (1):** `renderEmpPermGrid()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `employee_services`

4 Spalten · Status: aktiv
Warum: Nicht jeder Therapeut macht jede Leistung. Ohne diese Zuordnung bietet die Buchungsseite Termine bei Leuten an, die sie nicht durchführen dürfen.

**Schreibt (4):** `fmt()` [delete/insert] — dashboard.js:10841 · `loadEmpServices()` [delete/insert] — dashboard.js:11556 · `normName()` [insert] — onboarding.js:599 · `syncServices()` [insert] — onboarding.js:618

**Liest (2):** `loadServices()`, `openBookingFromRxPreset()`

**Dateien:** `api-backend/server.js`, `api/stripe/webhook.js`, `booking.js`, `dashboard.js`, `kalender.js`, `onboarding.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `fahrten`

21 Spalten · Status: aktiv
Warum: Fahrtenbuch für Hausbesuche, finanzamtstauglich (Zweck, Start-/Zielort, Kilometer).

**Schreibt (3):** `saveFahrtEndHandler()` [upsert] — dashboard.js:4365 · `saveFahrtStartHandler()` [upsert] — dashboard.js:4238 · `toLocal()` [delete/update] — dashboard.js:18517

**Liest (2):** `loadActivityFeed()`, `loadFbFahrten()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, fahrtenbuch, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `feedbacks`

12 Spalten · Status: aktiv
Warum: Rückmeldung aus dem Produkt heraus. Ein Trigger schickt jeden neuen Eintrag per Telegram — sonst liest sie niemand rechtzeitig.

**Liest (1):** `loadFeedbacks()`

**Dateien:** `api/admin/feedbacks.js`, `dashboard.js`

**Module:** abrechnung, feedback, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `fußstatus`

11 Spalten · Status: veraltet
Warum: Der **alte** Fußbefund aus dem ersten Podologie-Wurf.

### `group_scopes`

4 Spalten · Status: aktiv
Warum: Was eine Gruppe darf. Trennt die Rechtematrix von der Gruppendefinition, damit Rechte änderbar sind ohne Gruppen anzufassen.

**Liest (3):** `fmt()`, `renderEmpPermGrid()`, `saveEmpPermissions()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `heilmittel_catalog`

10 Spalten · Status: veraltet
Warum: Erster Podologie-Katalog (nur HPNR 78xxx), aus der Zeit vor der Vereinheitlichung.

### `heilmittel_katalog`

20 Spalten · Status: aktiv (Referenz)
Warum: Der **aktive**, vereinheitlichte und zeitversionierte Heilmittelkatalog aller vier Fachbereiche. Löste die beiden Vorgänger ab, weil abgelöste Positionen sonst als unbegrenzt gültig erschienen.

**Schreibt (1):** `main()` [delete/upsert] — api-backend/sync_heilmittel_katalog.js:106

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

36 Spalten · Status: aktiv
Warum: Die Rechnung an Privatzahler und Selbstzahler (GKV läuft über `abrechnung`).

**Schreibt (3):** `frageZahlungsstatus()` [update] — module/rechnung-zahlung.js:77 · `markiereRechnungBezahlt()` [update] — module/rechnung-zahlung.js:58 · `saveInvoice()` [insert/update] — dashboard.js:15035

**Liest (5):** `downloadDmrzForInvoice()`, `ladeLetztePreise()`, `loadActivityFeed()`, `loadPatientDetailRechnungen()`, `loadRechnungen()`

**Dateien:** `api-backend/billing/api/rechnung-zahlung.routes.js`, `dashboard.js`, `module/rechnung-dmrz.js`, `module/rechnung-zahlung.js`, `module/selbstzahler-stufen.js`

**Module:** abrechnung, anamnese, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fbFahrtenExportCsv, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, notizen, podologie-billing, qvSaveBtn, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen

### `kiosk_pins`

6 Spalten · Status: aktiv
Warum: Der Kiosk-Modus (Tablet im Wartezimmer) braucht eine Anmeldung, die kein Passwort ist. Die PIN liegt als scrypt-Hash, geprüft wird ausschließlich im Backend.

**Dateien:** `api-backend/server.js`

### `kostentraeger`

15 Spalten · Status: aktiv — **Echtdaten**, mit 9 Mock-Resten
Warum: Die §302-Seite der Kassen. Seit dem 06.09.2026 trägt sie zwei Dinge, die vorher gefehlt haben: die **echten** IK-Nummern aus der TP5-Kostenträgerdatei — und die **n:1-Beziehung**, ohne die eine IK allein nichts wert ist. Eine Versichertenkarte nennt fast nie die Stelle, die am Ende abrechnet: die DAK-Karte trägt `100167999`, das Geld holt man aber bei `105830016`. Genau diese Auflösung steckt in `abrechnender_kt_ik` / `ist_abrechnender_kt` (VKG-Verknüpfungsart 01).

**Liest (4):** `baueBegleitzettel()`, `kostentraegerIkAufloesen()`, `ladeAbrechnungHistorie()`, `ladeAnnahmestelle()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/kostentraeger/annahmestelle.js`, `api-backend/lib/rezept-felder.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `kostentraeger_annahmestellen`

12 Spalten · Status: aktiv (Referenz) — **vollständig geladen**, aber mit einem Zeitfehler, siehe unten
Warum: Beantwortet die Frage, an der der §302-Versand sonst scheitert: **wohin geht diese Datei?** Der Empfänger ist nicht die Kasse, sondern ihre Datenannahmestelle — und die hängt am Viererschlüssel (Kostenträger, Abrechnungscode, Art der Datenlieferung, Bundesland). Eine einzelne Spalte an `kostentraeger` (`das_ik`) konnte das nie abbilden; deshalb eine eigene Tabelle statt weiterer Spalten. Sie ist damit auch die Antwort auf „hätte eine Spalte gereicht?" — nein, es ist eine echte 1:n-Beziehung.

**Liest (1):** `ladeAnnahmestelle()`

**Dateien:** `api-backend/billing/kostentraeger/annahmestelle.js`

### `krankenkassen`

6 Spalten · Status: aktiv (Referenz) — ⛔ `ik_number` **fehlerhaft**, siehe unten
Warum: Die Kassenliste für das Auswahlfeld in der Oberfläche. 94 Zeilen (live 06.09.2026), gesetzt am 02.06.2026.

**Liest (3):** `ladeKassen()`, `loadKkList()`, `toRad()`

**Dateien:** `api-backend/server.js`, `booking-request.js`, `dashboard.js`, `module/krankenkasse-suche.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `leads`

51 Spalten · Status: aktiv
Warum: **Das ist die Patientenakte.** Der Name stammt aus der Akquise-Zeit (daher `title`, `google_url`, `reviews_count`) und ist geblieben, weil ein Umbenennen jede Abfrage im Projekt anfasst.

**Schreibt (4):** `handleDirectAusfallrechnung()` [update] — dashboard.js:4589 · `initSchnellerfassung()` [insert] — dashboard.js:19516 · `maybeOfferAppointmentConfirmEmail()` [update] — dashboard.js:7507 · `verordnungPatientenAbgleich()` [update] — module/verordnung-patient-abgleich.js:18

**Liest (36):** `ausfallVereinbarungDatum()`, `downloadDmrzForInvoice()`, `fillRzPatientFromLead()`, `findeLeadIdZuTermin()`, `fmt()`, `handleSessionDrop()`, `handleTerminStarten()`, `initBkCustomerAutocomplete()`, `initBkGroupPatientAutocomplete()`, `initCalRightPanel()`, `initWlPatientAutocomplete()`, `ladeAktiveVerordnungen()`, `ladeKassen()`, `ladePatienten()`, `loadActivityFeed()`, `loadAnamnese()`, `loadB2C()`, `loadBkLeads()`, `loadInvPatients()`, `loadLeads()` … +16

**Dateien:** `api-backend/billing/api/statistik.routes.js`, `api-backend/server.js`, `dashboard.js`, `module/arzt-register.js`, `module/ausfallrechnung.js`, `module/fussbefund.js`, `module/krankenkasse-suche.js`, `module/patienten-einwilligung.js`, `module/rechnung-ansicht.js`, `module/rechnung-dmrz.js`, `module/rechnung-editor.js`, `module/rechnung-editor.test.js`, `module/termin-patient-bezug.js`, `module/verordnung-patient-abgleich.js`, `module/verordnung-uebersicht.js`

**Module:** abrechnung, anamnese, b2c, doctors, fussstatus, hours, kunden, notizen, rechnungen, services, settings, team, ueberblick, verordnungen

### `mahnungen`

13 Spalten · Status: aktiv
Warum: Mahnstufen zu offenen Rechnungen, mit eigenem Nummernkreis.

**Dateien:** `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`

### `messreihen`

12 Spalten · Status: aktiv
Warum: Messwerte im Verlauf (Blankoverordnung: der Therapeut muss den Behandlungserfolg belegen).

**Schreibt (2):** `refreshMessreihen()` [delete] — dashboard.js:8635 · `saveMessung()` [insert] — dashboard.js:8759

**Dateien:** `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `module_visibility`

6 Spalten · Status: aktiv
Warum: Nicht jede Praxis braucht jedes Sidebar-Modul. Der Schalter je Inhaber und Modul liegt hier; die Modulliste selbst steht im Code (`nav-registry.js`).

**Schreibt (2):** `loadVisibility()` [upsert] — admin.js:288 · `saveVisToggle()` [upsert] — admin.js:387

**Liest (1):** `loadVisibilityMatrix()`

**Dateien:** `admin.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `nummernkreise`

4 Spalten · Status: aktiv
Warum: Lückenlose, race-freie Nummernvergabe je Inhaber und Jahr (`rechnung_nr`, `beleg_nr`, `mahnung_nr`). Vorher zählte das Frontend mit `MAX+1` hoch — bei zwei gleichzeitigen Nutzern gibt das dieselbe Nummer zweimal.

### `pat_fussbefund`

16 Spalten · Status: aktiv
Warum: Der podologische Fußbefund samt Fußkarte. Ersetzt fachlich `fußstatus`. Seit 30.08.2026 hält die Tabelle nicht mehr nur den *aktuellen* Befund, sondern seinen **Verlauf**.

**Schreibt (2):** `renderBefundListe()` [delete] — module/fussbefund.js:925 · `speichern()` [insert] — module/fussbefund.js:679

**Liest (5):** `frag()`, `ladePatientenkontext()`, `ladeVerlauf()`, `renderFussbefundArchiv()`, `verdrahteFussbefundKnopf()`

**Dateien:** `module/fussbefund-archiv.js`, `module/fussbefund.js`, `module/patientenkarte.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `patient_consents`

16 Spalten · Status: aktiv
Warum: Digitale Einwilligung des Patienten mit einfacher elektronischer Signatur. Vorher gab es dafür nur Papier, und der Nachweis fehlte bei Praxisübergabe.

**Schreibt (2):** `speichereEinwilligung()` [insert] — module/patienten-einwilligung.js:295 · `widerrufen()` [update] — module/patienten-einwilligung.js:535

**Liest (2):** `kopieOeffnen()`, `renderEinwilligungListe()`

**Dateien:** `module/patienten-einwilligung.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `patient_notes`

10 Spalten · Status: aktiv
Warum: Freitext-Notizen zum Patienten, die weder Anamnese noch Behandlungsdokumentation sind.

**Liest (6):** `loadActivityFeed()`, `loadNotizen()`, `loadPatientDetailNotes()`, `loadPatientNotes()`, `openBookingActionModal()`, `zeigePatientOhneTermin()`

**Dateien:** `dashboard.js`, `module/termin-panel-patient.js`

**Module:** abrechnung, fussstatus, hours, kunden, notizen, rechnungen, services, team, ueberblick, verordnungen

### `patients`

8 Spalten · Status: aktiv
Warum: Der Anfragende ist noch kein Patient der Praxis. Er darf nicht in die echte Akte (`leads`) geschrieben werden, bevor jemand die Anfrage angenommen hat.

**Liest (1):** `toRad()`

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
Warum: Die Behandlung zur podologischen Verordnung — das Gegenstück zu `prescription_sessions`. `verordnung_id` zeigt seit 04.09.2026 auf `prescriptions` (Zusammenlegung der Verordnungstöpfe, ids unverändert) — vorher auf die eigene Tabelle `verordnungen`.

**Schreibt (3):** `behandlungenVerknuepfen()` [update] — module/rechnung-bruecke.js:165 · `loadPodologieBilling()` [insert] — module/podologie-abrechnung.js:388 · `verknuepfungLoesen()` [update] — module/rechnung-bruecke.js:182

**Liest (8):** `frag()`, `ladeAbrechnungAuswahl()`, `ladeAktiveVerordnungen()`, `ladeVerlauf()`, `offeneBehandlungen()`, `patientenBehandlungen()`, `podPatientBehandlungen()`, `verordnungenLaden()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `module/abrechnung-auswahl.js`, `module/patientenkarte.js`, `module/podologie-abrechnung.js`, `module/rechnung-bruecke.js`, `module/rechnung-verordnung.js`, `module/termin-leistungen.js`, `module/verordnung-uebersicht.js`

**Module:** abrechnung, fussstatus, hours, kunden, podologie-billing, rechnungen, services, team, ueberblick, verordnungen

### `prescription_documents`

13 Spalten · Status: aktiv
Warum: Nachweise und Anhänge zu einer Verordnung — Befreiungsausweis, LHB-Genehmigung, korrigierte Verordnung, Therapiebericht. Als Spalten in `prescriptions` wären es beliebig viele.

**Schreibt (1):** `ladeLhbNachweisHoch()` [insert] — module/verordnung-nachweis.js:109

**Dateien:** `module/verordnung-nachweis.js`

### `prescription_sessions`

9 Spalten · Status: aktiv
Warum: Die einzelne Behandlungseinheit auf der Verordnung. Ohne sie ließe sich nicht sagen, wie viele der verordneten Einheiten schon geleistet sind.

**Schreibt (6):** `gleicheSitzungenAb()` [upsert] — module/sitzung-abgleich.js:86 · `handlePatientNichtErschienen()` [update] — dashboard.js:4549 · `handleSessionDrop()` [update] — dashboard.js:3958 · `korrigiereNoShow()` [update] — module/booking-status-korrektur.js:67 · `linkBookingsToPrescriptionSessions()` [insert/update] — dashboard.js:7415 · `markPrescriptionSession()` [update] — dashboard.js:7382

**Liest (10):** `decorateBookingTitleWithSession()`, `ladePrivatSumme()`, `loadCalRpUnverga()`, `loadRxSessionsPanel()`, `openInvView()`, `pruefeFrequenz()`, `pruefeVerordnungsfortschritt()`, `terminAuswahlLaden()`, `waehleVerordnungFuerPanel()`, `zaehler()`

**Dateien:** `api-backend/billing/api/statistik.routes.js`, `api-backend/server.js`, `dashboard.js`, `module/booking-status-korrektur.js`, `module/frequenz-pruefung.js`, `module/rechnung-ansicht.js`, `module/rechnung-editor.js`, `module/rezeptinfo-geld.js`, `module/sitzung-abgleich.js`, `module/sitzungsfortschritt.js`, `module/termin-aktionen.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `prescription_validations`

13 Spalten · Status: aktiv
Warum: Prüfergebnis der Rezeptvalidierung samt Übersteuerung. Getrennt von `prescriptions`, weil es ein Protokoll ist: wer hat wann welche Warnung überstimmt.

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/server.js`

### `prescriptions`

83 Spalten · Status: aktiv
Warum: Die Verordnung (Muster 13) für ALLE vier Fachbereiche — Physio, Ergo, Logopädie UND (seit 04.09.2026) Podologie. `therapie_bereich` unterscheidet; Podologie-Zeilen tragen zusätzlich neun aus `verordnungen` übernommene Spalten (`patient_name`, `wagner_grad`, `versichertennummer`, `behandlungsanlass`, `absetzung_*`, `storno_*`, `rezeptart`).

**Schreibt (10):** `betragNullsetzen()` [update] — module/zuzahlung-befreiung.js:249 · `downloadDmrzForInvoice()` [update] — module/rechnung-dmrz.js:109 · `flipAbrechnungStatus()` [update] — dashboard.js:8489 · `kassiereZuzahlung()` [update] — dashboard.js:7177 · `pruefeVerordnungsfortschritt()` [update] — module/sitzungsfortschritt.js:82 · `renderAbrechnungHistory()` [update] — dashboard.js:17900 · `speichereEinheiten()` [update] — module/verordnung-einheiten.js:126 · `storniereZuzahlung()` [update] — dashboard.js:7252 · `triggerStorno()` [update] — dashboard.js:18941 · `zaehler()` [update] — module/sitzungsfortschritt.js:85

**Liest (29):** `aufEuro()`, `frag()`, `frageZahlungsstatus()`, `initBkCustomerAutocomplete()`, `korrekturAusPanel()`, `ladeAbrechnungAuswahl()`, `ladeAktiveVerordnungen()`, `ladeVerlauf()`, `ladeZuweisungen()`, `linkBookingsToPrescriptionSessions()`, `loadAnamneseRxContext()`, `loadBkVerordnungen()`, `loadCalRpRezeptInfo()`, `loadPatientDetailRezepte()`, `loadPatRxTable()`, `loadPhysioRezKpis()`, `loadRxSessionsPanel()`, `loadUeberblickDeadlines()`, `oeffneZuzahlungKorrektur()`, `openBookingActionModal()` … +9

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `api-backend/billing/api/zuzahlung.routes.js`, `api-backend/server.js`, `dashboard.js`, `module/abrechnung-auswahl.js`, `module/arzt-register.js`, `module/booking-status-korrektur.js`, `module/patientenkarte.js`, `module/rechnung-ansicht.js`, `module/rechnung-dmrz.js`, `module/rechnung-verordnung.js`, `module/rechnung-zahlung.js`, `module/rezeptinfo-geld.js`, `module/sitzungsfortschritt.js`, `module/termin-aktionen.js`, `module/termin-leistungen.js`, `module/verordnung-detail.js`, `module/verordnung-einheiten.js`, `module/verordnung-uebersicht.js`, `module/verordnung-uebersicht.test.js`, `module/zuzahlung-befreiung.js`, `module/zuzahlung-korrektur.js`

**Module:** abrechnung, anamnese, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fbFahrtenExportCsv, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, notizen, podologie-billing, qvSaveBtn, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen

### `profiles`

84 Spalten · Status: aktiv
Warum: Der Dreh- und Angelpunkt der Mandantentrennung. Jeder Account — Inhaber wie Angestellter — hat genau eine Zeile; `role` und `owner_id` entscheiden, wer wessen Daten sieht. Weil Einzelstandort-Inhaber gar keinen `businesses`-Datensatz haben, liegen **Inhaber-Einstellungen hier**, nicht in `businesses`.

**Schreibt (21):** `bindBilling()` [update] — onboarding.js:453 · `bindBusiness()` [update] — onboarding.js:388 · `bindHours()` [update] — onboarding.js:813 · `bindOwner()` [update] — onboarding.js:516 · `bindPlan()` [update] — onboarding.js:870 · `ensureBookingSlug()` [update] — dashboard.js:13552 · `ensureClinicLocation()` [update] — dashboard.js:5725 · `ensureCompanyCode()` [update] — dashboard.js:13535 · `fmt()` [update] — dashboard.js:10841 · `handleSave()` [update] — onboarding.js:457 · `init()` [update] — kalender.js:149 · `initAnfragenPanel()` [update] — dashboard.js:21376 · `loadProfile()` [insert] — onboarding.js:115 · `openEmpDetail()` [update] — dashboard.js:11173 · `openStripePortal()` [update] — dashboard.js:2348 · `renderLegendeSettings()` [update] — module/fussbefund.js:1633 · `saveAusfallSettings()` [update] — module/ausfall-einstellungen.js:76 · `saveEmployee()` [insert] — dashboard.js:14244 · `saveStepProgress()` [update] — onboarding.js:281 · `speichereKonten()` [update] — module/buchungskonten.js:283 · `speichereStufen()` [update] — module/selbstzahler-stufen.js:259

**Liest (36):** `fetchBusinesses()`, `gehoertZurPraxis()`, `getAvailableSlots()`, `handleDirectAusfallrechnung()`, `kontenFuer()`, `ladeLegende()`, `ladePraxisAbrechnungsProfil()`, `loadAusfallConfig()`, `loadAusfallConfig()`, `loadEmpUrlaubSection()`, `loadFahrtenbuchPanel()`, `loadFbFahrten()`, `loadFbReports()`, `loadHoursPanel()`, `loadPatientDetailAnamnese()`, `loadPraxisProfile()`, `loadTeam()`, `loadTherapeutenStatistik()`, `loadUeberblickVacations()`, `proceedToOwnerCheck()` … +16

**Dateien:** `api-backend/ai/auth.js`, `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/rechnung-zahlung.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `api-backend/billing/api/warteliste.routes.js`, `api-backend/billing/api/zuzahlung.routes.js`, `api-backend/billing/statistik/therapeuten.js`, `api-backend/fix_db.js`, `api-backend/server.js`, `api-backend/test_schema.js`, `api/admin/data.js`, `api/dsgvo.js`, `api/onboarding/check-email.js`, `api/stripe/create-checkout-session.js`, `api/stripe/portal-session.js`, `api/stripe/webhook.js`, `attendance.js`, `confirm.html`, `dashboard.js`, `kalender.js`, `module/anfrage-bearbeiten.js`, `module/ausfall-einstellungen.js`, `module/beleg-druck.js`, `module/buchungskonten.js`, `module/fussbefund.js`, `module/selbstzahler-stufen.js`, `onboarding.js`

**Module:** abrechnung, anfragen, fahrtenbuch, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `rechnung_zahlungen`

12 Spalten · Status: aktiv
Warum: Eine Privatrechnung wird nicht immer in einem Zug bezahlt — Teilzahlung, Nachzahlung, Ausbuchung eines Restbetrags, Storno einer Fehlbuchung. Vorher trug `invoices.payment_status` allein die Antwort und konnte genau eine davon abbilden: bezahlt oder nicht. Wer zweimal kassierte, überschrieb die erste Buchung; nach einer Korrektur war nicht mehr feststellbar, was wann tatsächlich geflossen war. Diese Tabelle ist die Zahlungshistorie als Hauptbuch — jede Bewegung eine eigene Zeile. Gleiches Muster und gleicher Grund wie `zuzahlung_korrekturen` und `belegliste`.

**Dateien:** `api-backend/billing/api/rechnung-zahlung.routes.js`

### `referral_drafts`

21 Spalten · Status: verdächtig
Warum: Erster Rezept-Fluss: Foto einer Verordnung → KI-Auszug (`raw_ai_data`, `seans_sayisi`, `tedavi_turu`) → Bestätigung → Terminserie (`booking_series_id`). Der Vorläufer von `prescriptions` + `/booking/ai-suggest-series`.

### `scraper_data`

14 Spalten · Status: aktiv (Randmodul)
Warum: Ergebnisse der Apify-Suche (Google-Maps-Praxen) als Akquiseliste — die Zulieferung für `b2b_contacts`.

**Schreibt (1):** `fmt()` [insert] — dashboard.js:10841

**Liest (1):** `loadDoctors()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, doctors, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `services`

19 Spalten · Status: aktiv
Warum: Was die Praxis anbietet, mit Dauer und Preis. Grundlage für Slot-Berechnung und Abrechnung.

**Schreibt (8):** `autoSeedGkvServices()` [insert] — dashboard.js:9486 · `ensureBlankoBonusServices()` [insert/update] — dashboard.js:7604 · `ensureBlockerServices()` [insert/update] — module/kalender-blocker.js:71 · `migratePodologieLegacyServices()` [update] — dashboard.js:9682 · `normName()` [delete/insert/update] — onboarding.js:599 · `renderServices()` [delete] — dashboard.js:9869 · `syncServices()` [delete/insert/update] — onboarding.js:618 · `wireBusinessModal()` [insert] — dashboard.js:16847

**Liest (15):** `anfrageKorrekturenPruefen()`, `ausfallPriceEur()`, `createBookingsFromRequestFactory()`, `findMatchingServiceId()`, `fmt()`, `getAvailableSlots()`, `initCalendar()`, `loadEmpServices()`, `loadProfile()`, `loadServices()`, `loadServices()`, `sondiere()`, `stammdatenLaden()`, `toRad()`, `updateBkDuration()`

**Dateien:** `api-backend/booking/from-request.js`, `api-backend/check_db.js`, `api-backend/server.js`, `api/stripe/webhook.js`, `dashboard.js`, `kalender.js`, `module/anfrage-bearbeiten.js`, `module/kalender-blocker.js`, `module/kostentraeger-spalte.js`, `module/kostentraeger-spalte.test.js`, `onboarding.js`

**Module:** abrechnung, anfragen, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `spatial_ref_sys`

5 Spalten · Status: System
Warum: Systemtabelle der PostGIS-Erweiterung (Koordinatensysteme). Kam mit `enable_postgis` für die Geocodierung im Fahrtenbuch.

### `terapeut_zertifikat`

10 Spalten · Status: aktiv
Warum: Das **Signaturzertifikat** für die §302-Einreichung (PKCS#7). Ohne gültiges Zertifikat lässt sich keine DTA-Datei signieren.

**Schreibt (1):** `fmt()` [upsert] — dashboard.js:10841

**Liest (3):** `ikVorbelegen()`, `loadSettings()`, `renderOverview()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `dashboard.js`, `module/verordnung-podo.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, settings, team, ueberblick, verordnungen

### `therapist_certificates`

5 Spalten · Status: aktiv
Warum: Fachliche Qualifikationen des Therapeuten (MT, MLD, KGG). Bestimmte Leistungen darf nur abrechnen, wer die Qualifikation nachweist.

**Schreibt (2):** `fmt()` [delete/insert] — dashboard.js:10841 · `loadEmpCertificates()` [delete/insert] — dashboard.js:11642

**Liest (2):** `ladeAbrechnungAuswahl()`, `loadEmpServices()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `dashboard.js`, `module/abrechnung-auswahl.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `time_offs`

12 Spalten · Status: aktiv
Warum: Urlaub, Krankheit, Fortbildung. Anders als `custom_days` personenbezogen und mehrtägig.

**Schreibt (6):** `deleteEmpTimeOff()` [delete] — dashboard.js:10777 · `deleteUrlaub()` [delete] — dashboard.js:10851 · `fmt()` [delete/insert] — dashboard.js:10841 · `loadTeam()` [insert] — dashboard.js:10511 · `openEmpDetail()` [insert] — dashboard.js:11173 · `saveUrlaub()` [insert] — dashboard.js:10793

**Liest (8):** `getAvailableSlots()`, `horizonDays()`, `initCalendar()`, `loadEmpDaySchedule()`, `loadEmpUrlaubSection()`, `loadUeberblickVacations()`, `loadUrlaubListe()`, `renderDayView()`

**Dateien:** `api-backend/server.js`, `dashboard.js`, `kalender.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

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

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `user_credits`

6 Spalten · Status: fremd
Warum: Fremdprojekt (Guthabenmodell). Praxura rechnet über Stripe ab, nicht über Credits.

### `user_preferences`

5 Spalten · Status: aktiv
Warum: Pro Nutzer merkbare Oberflächen-Zustände (gewählter Standort, Kalenderansicht, Mitarbeiterfilter) gehören nicht in `profiles` — das ist die fachliche Stammdatentabelle.

**Schreibt (2):** `saveUserPref()` [upsert] — dashboard.js:14470 · `switchBusiness()` [upsert] — dashboard.js:17009

**Liest (2):** `bootBusinessSwitcher()`, `bootScheduleViewToggle()`

**Dateien:** `api-backend/server.js`, `api/stripe/webhook.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `vehicles`

11 Spalten · Status: aktiv
Warum: Fahrzeugstamm zum Fahrtenbuch; Kilometerstände und Kennzeichen gehören nicht an die einzelne Fahrt.

**Schreibt (3):** `loadFbVehicles()` [delete] — dashboard.js:18616 · `saveQuickVehicleHandler()` [insert] — dashboard.js:4215 · `saveVehicleEdit()` [insert/update] — dashboard.js:18719

**Liest (4):** `loadVehiclesForPicker()`, `q()`, `saveFahrtEndHandler()`, `saveFahrtStartHandler()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, fahrtenbuch, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `visibility_reports`

8 Spalten · Status: aktiv
Warum: Telemetrie zur Modulmatrix: welcher Kunde sieht tatsächlich welche Module. Ohne diese Rückmeldung wäre die Matrix eine Behauptung.

**Schreibt (2):** `reportSidebarVisibility()` [upsert] — dashboard.js:971 · `saveVisToggle()` [delete] — admin.js:387

**Liest (1):** `loadVisibility()`

**Dateien:** `admin.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `warteliste`

14 Spalten · Status: aktiv
Warum: Wenn nichts frei ist, soll der Wunsch nicht verlorengehen. Wird beim Freiwerden eines Slots gegen die Wunschzeiten gematcht.

**Schreibt (1):** `initWlModal()` [delete/insert/update] — dashboard.js:19833

**Liest (1):** `loadWarteliste()`

**Dateien:** `api-backend/billing/api/warteliste.routes.js`, `dashboard.js`, `module/warteliste-nachruecker.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen, warteliste

### `working_hours`

9 Spalten · Status: aktiv
Warum: Regelarbeitszeit je Mitarbeiter und Standort — die Grundlage jeder Slot-Berechnung.

**Schreibt (3):** `bindHours()` [delete/insert] — onboarding.js:813 · `fmt()` [upsert] — dashboard.js:10841 · `loadEmpHours()` [upsert] — dashboard.js:11464

**Liest (11):** `fetchOwnerHoursMap()`, `getAvailableSlots()`, `getEmployeeWorkingHours()`, `horizonDays()`, `initWorkingHours()`, `loadHours()`, `renderBookingCalendar()`, `renderGaps()`, `renderGapsForDate()`, `renderHoursGrid()`, `renderHoursMiniCal()`

**Dateien:** `api-backend/server.js`, `api/stripe/webhook.js`, `booking.js`, `confirm.html`, `dashboard.js`, `employee-signup.js`, `kalender.js`, `onboarding.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `zaa_fehler`

10 Spalten · Status: aktiv
Warum: Absetzungen und Fehlermeldungen der Kasse aus der ZAA-Rückmeldung, samt Übersetzung und Lösungshinweis. Roh sind die Codes für einen Therapeuten unlesbar.

**Liest (1):** `showZaaErrors()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `dashboard.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `zuzahlung_befreiung`

11 Spalten · Status: aktiv
Warum: Befreiungsausweise. Ob ein Patient zuzahlungsfrei ist, entscheidet über den abrechenbaren Betrag und darf nicht als Häkchen an der Verordnung hängen — es gilt zeitraumbezogen.

**Schreibt (2):** `oeffneBefreiungsFormular()` [delete/upsert] — module/zuzahlung-befreiung.js:62 · `wireBefreiungCard()` [delete] — dashboard.js:8562

**Liest (2):** `loadPatientDetailRezepte()`, `openBookingActionModal()`

**Dateien:** `dashboard.js`, `module/zuzahlung-befreiung.js`

**Module:** abrechnung, fussstatus, hours, kunden, rechnungen, services, team, ueberblick, verordnungen

### `zuzahlung_guthaben`

13 Spalten · Status: aktiv
Warum: Hat der Patient im Voraus für 6 Einheiten gezahlt und bricht nach 3 ab, liegt Geld zuviel in der Praxis. Statt es auszuzahlen, soll es auf die nächste Verordnung angerechnet werden. Das Guthaben gehört dem Patienten, nicht der Verordnung — deshalb eigene Tabelle mit `patient_id` und nicht eine Spalte am Rezept.

**Dateien:** `api-backend/billing/api/zuzahlung.routes.js`

### `zuzahlung_korrekturen`

15 Spalten · Status: aktiv
Warum: Der geforderte Zuzahlungsbetrag darf sich ändern (Patient bricht nach 3 von 6 Einheiten ab), aber nicht stillschweigend — es ist Geld und es ist GoBD. Diese Tabelle hält je Änderung fest: wer, wann, alter Wert, neuer Wert, Grund. Eine Spalte an `prescriptions` hätte bei der zweiten Korrektur die erste Begründung überschrieben, also genau das, was hier verhindert werden soll.

**Dateien:** `api-backend/billing/api/zuzahlung.routes.js`

