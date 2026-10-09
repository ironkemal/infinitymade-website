# Tabellen-Nutzung — wer liest, wer schreibt

> ÜRETİLEN DOSYA — elle düzenleme. `node tools/tabellenkarte.mjs`
> NİYE açıldıkları: `db/REGISTER.md` · YAPILARI: `db/SCHEMA.sql`

**Erzeugt:** 2026-10-09 · 96 Tabellen · Quelle: db/SCHEMA.sql (Stand 2026-10-09), funktionen/INDEX.json (erzeugt 2026-10-09)

## Kayıt durumu

- Register kaydı olan: **96/96**

## Kodda hiç çağrılmayan tablolar

`.from()` ile hiçbir dosyadan erişilmiyor. **Ölü demek değildir** — trigger, RPC,
view veya backend raw SQL üzerinden beslenebilir. `SQL-Treffer` sütunu SCHEMA-RLS.sql
içindeki geçiş sayısıdır: 0 ise gerçekten şüphelidir.

| Tabelle | SQL-Treffer | Register-Status |
|---|---|---|
| `abrechnung_artefakt_freeze` | 20 | aktiv |
| `accommodations` | 39 | fremd |
| `applications` | 41 | fremd |
| `datenaustausch_zaehler` | 47 | aktiv — ✅ **am 20.09.2026 live angewandt** (MCP, zusammen mit 0026–0034). Die Tabelle ist noch leer: die erste Zeile entsteht, sobald die erste Datei unter dem neuen Verfahren erzeugt wird. Ein rückwirkender Backfill aus dem Bestand wurde bewusst **nicht** gemacht — die Altzeilen tragen keinen `empfaenger_ik`, eine je Paar aufgebaute Folge wäre geraten, nicht gewusst. Wer den Zähler vor dem ersten Lauf setzen will, nimmt `datenaustausch_zaehler_vorstellen()`. |
| `dta_schluessel` | 42 | Referenz, im Code ungenutzt |
| `heilmittel_catalog` | 38 | veraltet |
| `heilmittel_position` | 44 | veraltet |
| `heilmittel_tarif` | 40 | **veraltet** (13.09.2026, O-96 — siehe `onprem/REGISTER.md`) |
| `icd_sector_ranges` | 39 | aktiv (Referenz) |
| `nummernkreise` | 39 | aktiv |
| `praxura_migrations` | 21 | aktiv |
| `referral_drafts` | 51 | verdächtig |
| `spatial_ref_sys` | 46 | System |
| `trip_history` | 38 | fremd |
| `trip_plans` | 38 | fremd |
| `user_credits` | 43 | fremd |

## DSGVO-Abdeckung (`api-backend/dsgvo/klassifikation.js`)

Auskunft (Art. 15): **68** · Löschung (Art. 17): **32** · anonymisiert statt gelöscht: **2**

⚠️ Personenbezug (FK auf `leads`/`profiles`/`auth.users`) aber **nicht** in der Auskunftsliste:

`accommodations`, `admin_users`, `applications`, `datenaustausch_zaehler`, `employee_scope_overrides`, `kiosk_pins`, `trip_history`, `trip_plans`, `user_credits`

Prüfen, nicht blind nachtragen: manche davon sind Konfigurations- oder
Referenztabellen ohne Personendaten. Die Entscheidung gehört ins Register.

## En çok yazılan tablolar

| Tabelle | Schreiber | Leser | Dateien | Module |
|---|---|---|---|---|
| `profiles` | 28 | 50 | 44 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `bookings` | 17 | 50 | 39 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, statistik, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `prescriptions` | 11 | 42 | 38 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `document_vorlagen` | 10 | 2 | 4 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `prescription_sessions` | 8 | 10 | 13 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `services` | 7 | 15 | 11 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `businesses` | 6 | 6 | 11 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `leads` | 6 | 39 | 22 | abrechnung, anamnese, anfragen, b2b, b2c, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `time_offs` | 6 | 8 | 4 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `employee_business_assignments` | 5 | 5 | 5 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `employee_services` | 5 | 2 | 7 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `abrechnung` | 4 | 6 | 9 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `aerzte` | 3 | 3 | 4 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `breaks` | 3 | 2 | 2 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `calendar_integrations` | 3 | 2 | 5 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `employee_scope_overrides` | 3 | 1 | 2 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `invoices` | 3 | 6 | 7 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `podologie_behandlungen` | 3 | 15 | 15 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `working_hours` | 3 | 9 | 7 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `anamnese` | 2 | 4 | 3 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `b2b_contacts` | 2 | 1 | 2 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `betriebsart_empfaenger` | 2 | 2 | 2 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `email_logs` | 2 | 0 | 2 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `fahrten` | 2 | 2 | 1 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |
| `messreihen` | 2 | 0 | 1 | abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste |

## Alle Tabellen

### `abrechnung`

40 Spalten · Status: aktiv
Warum: Der Abrechnungslauf als Ganzes: eine Sammelrechnung an einen Kostenträger, mit DTA-Datei, Signaturzustand, Upload- und Zahlungsdatum. Ohne diesen Kopfsatz gäbe es keinen Bezugspunkt für Absetzungen.

**Schreibt (4):** `aktualisiereArtefaktVersion()` [update] — api-backend/billing/api/artefakt-version.js:142 · `createZuzahlungsforderungRouter()` [insert/update] — api-backend/billing/api/zuzahlungsforderung.routes.js:130 · `downloadAbrechnungFile()` [update] — module/abrechnung-detail.js:777 · `verworfeneNummerFesthalten()` [insert] — api-backend/billing/api/verworfen.js:126

**Liest (6):** `handleEmpfaengerPruefung()`, `ladeAbrechnungVerlauf()`, `ladeHeader()`, `mandantUndAbrechnung()`, `openDasGuideModalController()`, `verarbeiteVerschluesselungsSchritt()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/artefakt-historie.js`, `api-backend/billing/api/artefakt-version.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/verworfen.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js`, `module/abrechnung-detail.js`, `module/abrechnung-empfaenger.js`, `module/abrechnung-verlauf.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `abrechnung_artefakt_freeze`

2 Spalten · Status: aktiv
Warum: Marker, den der DSGVO-Löschlauf (`api-backend/dsgvo/loeschen.js`) zu Beginn setzt: ab dann entstehen für den Owner keine NEUEN Registry-Reservierungen mehr; bereits laufende Uploads dürfen abgeschlossen werden. Verhindert, dass während der Kontolöschung noch neue Dateien im Bucket `abrechnungen` entstehen.

### `abrechnung_artefakt_version`

16 Spalten · Status: aktiv. Schreiber im Code: Signed-/Encrypted-Upload (reserve → upload → publish, 05.10.2026) und Nachregistrierung der Erzeugungsdateien (`artefakt_registriere_veroeffentlicht`, 0063). Bestand: am 05.10.2026 per Backfill 30 Zeilen (12 DTA, 9 Auftragsdateien, 9 Begleitzettel) als `legacy` aufgenommen (Hash nur, wo der Header einen kennt). Unbekannte historische Bucketobjekte bleiben im Löschlauf konservativ erhalten.
Warum: Registry aller Dateien im Bucket `abrechnungen` (DTA, Auftragsdatei, Begleitzettel, Signatur, verschlüsselte Datei): unveränderlicher Pfad/Owner/Abrechnung/SHA-256/Art/Rolle und Lebenszyklus reserved → published → retire_pending → retired. Schützt Dateien vor Löschung durch Orphan-Bereinigung und DSGVO-Löschlauf; ersetzt NICHT die Rechnungs-Zustandsmaschine (Header-CAS bleibt in `abrechnung`).

**Liest (5):** `entferneUnsignierteDta()`, `kontoLoeschenIntern()`, `ladeArtefaktVersion()`, `listeArtefaktVersionen()`, `wiederholeAusmusterung()`

**Dateien:** `api-backend/billing/api/artefakt-ausmustern.js`, `api-backend/billing/api/artefakt-historie.js`, `api-backend/dsgvo/loeschen.js`

### `abrechnung_uebermittlung`

25 Spalten · Status: aktiv, aber **noch nicht angeschlossen** — ✅ Migration am 20.09.2026 live angewandt (MCP); der Versandweg selbst entsteht erst in Faz 2, die Tabelle ist deshalb leer. Die Tabelle und ihre Schreibfunktion existieren vorab, damit niemand die Dokumentation später rückwirkend erfinden muss.
Warum: Anlage 1 TP5 Kap. 3(2) schreibt vor: *„Über den Datenaustausch ist eine Dokumentation zu führen … mindestens **2 Jahre** aufzubewahren … **alle Schritte von der Initiierung bis ggf. zur Quittierung**."* Anhang 1 § 4.5(2) zählt zehn Mindestfelder auf (physikalischer Dateiname, Erstellungsdatum, lfd. Nr., Kommunikationspartner, Beginn/Ende, Dateigröße, Verarbeitungshinweise, Senden/Empfangen, Verarbeitungskennzeichen, Fehlerstatus). **Diese Dokumentation lässt sich nicht nachträglich erzeugen** — deshalb entsteht die Tabelle, bevor der Versandschritt gebaut wird, und nicht danach.

**Schreibt (1):** `uebermittlungProtokollieren()` [insert] — api-backend/billing/api/uebermittlung.js:76

**Dateien:** `api-backend/billing/api/uebermittlung.js`

### `abrechnung_zahlung`

12 Spalten · Status: aktiv
Warum: Geldeingang je Sammelabrechnung, tranchenweise. Bis dahin gab es `abrechnung.paid_at`

**Liest (1):** `ladeAbrechnungVerlauf()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `module/abrechnung-verlauf.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `abrechnung_zeile`

27 Spalten · Status: aktiv
Warum: Was in EINER Datei tatsächlich an die Kasse ging — eingefroren. Vorher wurde die

**Schreibt (1):** `createZuzahlungsforderungRouter()` [insert] — api-backend/billing/api/zuzahlungsforderung.routes.js:130

**Liest (3):** `bereichFuerAbrechnung()`, `ladeAbrechnungVerlauf()`, `loadPodologieBilling()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js`, `module/abrechnung-verlauf.js`, `module/podologie-abrechnung.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `accommodations`

7 Spalten · Status: fremd
Warum: Fremdprojekt (Unterkünfte). Nie Teil von Praxura.

### `admin_users`

3 Spalten · Status: aktiv
Warum: Trennt das interne Admin-Panel (`admin.praxura.de`) von den Kundenrollen. Ein Kunde soll nie durch Setzen eines Feldes in `profiles` Admin werden können.

**Liest (5):** `init()`, `isAdmin()`, `isAdmin()`, `isAdminUser()`, `neuerBkKanal()`

**Dateien:** `admin-login.js`, `admin.js`, `api/_lib/auth.js`, `dashboard.js`, `login.js`

### `aerzte`

17 Spalten · Status: aktiv
Warum: Arztregister je Inhaber. Wird beim Erfassen einer Verordnung automatisch befüllt: LANR-Treffer reichert den vorhandenen Datensatz an, sonst wird neu angelegt. Grundlage der Auswertung „welcher Arzt überweist wie viel".

**Schreibt (3):** `deleteAerzte()` [delete] — dashboard.js:13933 · `editAerzte()` [update] — dashboard.js:13942 · `resolveOrCreateArzt()` [insert/update] — api-backend/lib/arzt-registry.js:60

**Liest (3):** `downloadDmrzForInvoice()`, `fillRzPatientFromLead()`, `loadAerzte()`

**Dateien:** `api-backend/lib/arzt-registry.js`, `api-backend/server.js`, `dashboard.js`, `module/rechnung-dmrz.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `ai_audit_log`

15 Spalten · Status: aktiv
Warum: Protokoll jedes KI-Aufrufs (Rezept-OCR, Entwürfe): Modell, Kosten, Ergebnis. Nachweis gegenüber dem EU AI Act und Kostenkontrolle.

**Schreibt (1):** `logCall()` [insert] — api-backend/ai/audit.js:31

**Liest (1):** `makeUsageAggregateSupplier()`

**Dateien:** `api-backend/ai/audit.js`, `api/admin/data.js`

### `anamnese`

37 Spalten · Status: aktiv
Warum: Erstaufnahme und Vorgeschichte. Eigene Tabelle, weil sie nicht bei jedem Termin neu geschrieben wird. (Bis 30.09.2026 stand hier „weil sie versioniert entsteht" — das war falsch: es gab eine Zeile je Patient, die per UPDATE überschrieben wurde. Versioniert ist sie erst seit `0047`.)

**Schreibt (2):** `markiereGeprueft()` [update] — module/anamnese-daten.js:88 · `speichereNeu()` [insert] — module/anamnese-daten.js:69

**Liest (4):** `hatAnamnese()`, `ladeVersionen()`, `openBookingActionModal()`, `q()`

**Dateien:** `dashboard.js`, `module/anamnese-daten.js`, `module/podo-tag-zusatz.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `applications`

6 Spalten · Status: fremd
Warum: Fremdprojekt (Bewerbungen). Nie Teil von Praxura.

### `attendance`

12 Spalten · Status: aktiv
Warum: Kommen/Gehen der Mitarbeiter (Arbeitszeiterfassung), getrennt von der Sollarbeitszeit in `working_hours`.

**Schreibt (1):** `schliesse()` [update] — api-backend/server.js:3778

**Liest (1):** `fetchHistory()`

**Dateien:** `api-backend/server.js`, `attendance.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `aufbewahrung_sperre`

8 Spalten · Status: aktiv (Tabelle live, noch leer — der Schreiber entsteht in K1.4)
Warum: Sperrvermerk für die DSGVO-Löschung. Bei Kontolöschung (Fall B, SaaS) und später beim Löschantrag eines Patienten (Fall A) darf aufbewahrungspflichtiges Material nicht gelöscht werden (Art. 17 Abs. 3 lit. b DSGVO; § 630f Abs. 3 BGB, § 147 AO, § 14b UStG) — es wird **gesperrt** statt gelöscht. Die Tabelle hält fest, **was** gesperrt ist (Kategorie), **für wen** (ganzes Konto oder ein Patient), **seit wann, bis wann frühestens und warum** (Fundstelle). Ohne sie gäbe es keinen Nachweis der Einschränkung, keinen Antworttext „gesperrt bis …“ und später keinen engen Purge-Weg („DELETE nur wenn `gesperrt_bis` < heute“). Eigene Tabelle statt Spalten an `profiles`/`leads`, weil jede Kategorie eine eigene Frist hat (8 J. Belege, 10 J. Behandlung/Grundaufzeichnungen, 6 J. Geschäftsbriefe) und Fall A Patienten-Granularität braucht.

**Schreibt (1):** `kontoLoeschenIntern()` [upsert] — api-backend/dsgvo/loeschen.js:75

**Liest (1):** `exportErstellen()`

**Dateien:** `api-backend/dsgvo/export.js`, `api-backend/dsgvo/loeschen.js`

### `ausfallrechnungen`

15 Spalten · Status: aktiv
Warum: Ausfallhonorar bei No-Show oder kurzfristiger Absage. Rechtlich **Schadensersatz**, damit umsatzsteuerfrei und keine GKV-Leistung — deshalb keine Zeile in `invoices`.

**Dateien:** `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`

### `b2b_contacts`

16 Spalten · Status: aktiv (Randmodul)
Warum: B2B-Akquise: Ärzte und Partner anschreiben, um Zuweisungen zu bekommen. Aus der Zeit, als Praxura noch selbst Kunden für die Praxis gewinnen wollte.

**Schreibt (2):** `fmt()` [delete/insert/update] — dashboard.js:9951 · `renderB2B()` [delete] — dashboard.js:10833

**Liest (1):** `loadB2B()`

**Dateien:** `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `belegliste`

14 Spalten · Status: aktiv
Warum: GoBD-Belegjournal: jeder Geldvorgang lückenlos und unveränderlich.

**Liest (4):** `createZuzahlungsforderungRouter()`, `loadPatientDetailRezepte()`, `saldoFuerRezept()`, `storniereZuzahlung()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/zuzahlung.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `betriebsart_empfaenger`

7 Spalten · Status: aktiv — ✅ **am 20.09.2026 live angewandt** (MCP). Die Tabelle ist leer, und das ist der Normalzustand: eine Zeile entsteht erst, wenn für eine bestimmte Datenannahmestelle vom Vorgabewert abgewichen wird.
Warum: §302-Abrechnung: Erprobung und Zulassung zum Echtverfahren laufen nach Spezifikation (Anlage 1 TP5 V21 Kap. 2 (1)(2), Kap. 3 (1) + Kap. 8, Anhang 2 zur Anlage 1 Kap. 9 § 1/§ 5/§ 6) **zwischen Absender und Empfänger**. Ein praxisweites Einzel-Flag ist in beide Richtungen still falsch: zu früh `echt` schickt eine Echtdatei an eine Datenannahmestelle ohne Zulassung; zu spät `echt` schickt eine Testdatei an eine Datenannahmestelle mit Zulassung („löst keine Zahlungen aus" — das Geld bleibt einfach aus, es kommt keine Fehlermeldung). `gkv-302` hat deshalb am 20.09.2026 entschieden, dass die Betriebsart je Paar (Praxis-Inhaber × Datenannahmestelle) gilt. Migration 0028 (`terapeut_zertifikat.betriebsart`) bleibt als Vorgabewert erhalten, diese Tabelle ist die Ausnahme je Empfänger.

**Schreibt (2):** `_speichereAusnahme()` [upsert] — module/abrechnung-einstellungen.js:827 · `wireAbrechnungSettings()` [delete] — module/abrechnung-einstellungen.js:271

**Liest (2):** `_renderAusnahmenBlock()`, `ladeBetriebsart()`

**Dateien:** `api-backend/billing/api/betriebsart.js`, `module/abrechnung-einstellungen.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `booking_leistungen`

7 Spalten · Status: aktiv
Warum: Ein Termin trägt in der Podologie fast immer mehr als eine Leistung — „Podologische Behandlung + Eingangsbefundung" ist der Normalfall, nicht die Ausnahme (Beta-1, 31.08.2026: „wenn man es nicht vollstopfen will, kann man auch einfach nur [ein] Pluszeichen drücken … und die Anzahl"). `bookings.service_id` konnte genau eine halten; der Kalenderblock war deshalb systematisch zu kurz und die zweite Leistung fiel aus der Abrechnung.

**Schreibt (1):** `speichereLeistungen()` [delete/upsert] — module/termin-leistungen.js:473

**Liest (3):** `gelernteDauer()`, `ladeLeistungen()`, `oeffneFolgetermin()`

**Dateien:** `module/termin-dauer.js`, `module/termin-folge.js`, `module/termin-leistungen.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `booking_requests`

37 Spalten · Status: aktiv
Warum: Termin-**Anfrage** statt Sofortbuchung: der Patient bittet um einen Termin, der Inhaber bestätigt oder lehnt ab. Ein bestätigter Antrag wird zu einem `bookings`-Eintrag.

**Schreibt (1):** `cancelRequestBookings()` [update] — api-backend/booking/cancel-request.js:3

**Dateien:** `api-backend/booking/cancel-request.js`, `api-backend/server.js`

### `booking_status_korrekturen`

9 Spalten · Status: aktiv
Warum: Beta-2 (05.09.2026, Ops #270): der Status eines vergangenen Termins (v.a. `no_show`) muss nachträglich korrigierbar sein — z.B. wenn der Patient doch noch behandelt wurde und nachträglich unterschreibt. Freie Korrektur ist erlaubt, aber niemals stillschweigend: diese Tabelle hält je Änderung fest, wer wann von welchem zu welchem Status gewechselt hat und warum. Gleicher Grund wie bei `zuzahlung_korrekturen` — eine Spalte an `bookings` hätte bei der zweiten Korrektur die erste Begründung überschrieben.

**Schreibt (1):** `korrigiereNoShow()` [insert] — module/booking-status-korrektur.js:68

**Dateien:** `module/booking-status-korrektur.js`

### `bookings`

37 Spalten · Status: aktiv
Warum: Der Termin selbst. Alles andere im Kalender hängt daran.

**Schreibt (17):** `bindeTermin()` [update] — module/verordnung-termine.js:122 · `cancelRequestBookings()` [update] — api-backend/booking/cancel-request.js:3 · `createBookingsFromRequestFactory()` [insert] — api-backend/booking/from-request.js:17 · `doMoveBooking()` [update] — dashboard.js:4799 · `handleSessionDrop()` [insert] — dashboard.js:3399 · `handleTerminStarten()` [update] — dashboard.js:3852 · `initBkGroupPatientAutocomplete()` [insert] — dashboard.js:4343 · `kontoLoeschenIntern()` [delete] — api-backend/dsgvo/loeschen.js:75 · `korrigiereNoShow()` [update] — module/booking-status-korrektur.js:68 · `loadGroupParticipants()` [update] — dashboard.js:4227 · `loeseTermin()` [update] — module/verordnung-termine.js:133 · `markArrivedHandler()` [update] — dashboard.js:3721 · `markiereNichtErschienen()` [update] — module/termin-nicht-erschienen.js:105 · `openBookingActionModal()` [update] — dashboard.js:2813 · `saveFahrtEndHandler()` [update] — dashboard.js:3765 · `saveFahrtStartHandler()` [update] — dashboard.js:3643 · `uebernimmSlot()` [insert] — module/warteliste-nachruecker.js:198

**Liest (50):** `_terminBearbeiten()`, `ausgefalleneEinheiten()`, `calculateSessionInfo()`, `escapeHtml()`, `fahrtBeendenKlick()`, `fmt()`, `frag()`, `frageNachrueckerAb()`, `fragFolgetermin()`, `gelernteDauer()`, `getAvailableSlots()`, `heuteAktualisieren()`, `horizonDays()`, `initCalendar()`, `initCalendar()`, `ladeAbrechnungAuswahl()`, `ladeBescheinigungTermine()`, `ladeKommendeTermineDesPatienten()`, `ladePatientenkontext()`, `ladePatientTermine()` … +30

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/warteliste.routes.js`, `api-backend/billing/statistik/therapeuten.js`, `api-backend/booking/cancel-request.js`, `api-backend/booking/from-request.js`, `api-backend/dsgvo/loeschen.js`, `api-backend/server.js`, `api/admin/data.js`, `booking.js`, `dashboard.js`, `kalender.js`, `module/abrechnung-auswahl.js`, `module/abrechnungsstatus.js`, `module/behandlungsbestaetigung.js`, `module/booking-status-korrektur.js`, `module/frequenz-pruefung.test.js`, `module/fussbefund.js`, `module/kalender-monat.js`, `module/kalender-woche.js`, `module/patient-termine.js`, `module/patientenkarte.js`, `module/podo-tag-zusatz.js`, `module/podologie-abrechnung.js`, `module/rechnung-editor.js`, `module/rechnung-editor.test.js`, `module/rechnung-verordnung.js`, `module/signal.js`, `module/termin-aktionen.js`, `module/termin-dauer.js`, `module/termin-heute.js`, `module/termin-laden.js`, `module/termin-leistungen.js`, `module/termin-nicht-erschienen.js`, `module/termin-patient-bezug.js`, `module/termin-verordnung.js`, `module/verordnung-detail.js`, `module/verordnung-termine.js`, `module/warteliste-nachruecker.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, statistik, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `breaks`

7 Spalten · Status: aktiv
Warum: Pausen sind keine Arbeitszeit und keine Abwesenheit — sie wiederholen sich täglich und müssen Slots blockieren.

**Schreibt (3):** `fmt()` [delete/insert] — dashboard.js:9951 · `loadEmpHours()` [delete/insert] — dashboard.js:10574 · `renderHoursGrid()` [delete/insert] — dashboard.js:9331

**Liest (2):** `getAvailableSlots()`, `horizonDays()`

**Dateien:** `api-backend/server.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `businesses`

26 Spalten · Status: aktiv
Warum: Zweiter Standort und aufwärts. Ohne Standortbegriff ließen sich Öffnungszeiten, Team und Leistungen nicht trennen, sobald eine Praxis mehr als eine Adresse hat.

**Schreibt (6):** `bindBusiness()` [insert/update] — onboarding.js:388 · `deleteBusiness()` [delete] — dashboard.js:14826 · `mountPraxisStandort()` [update] — module/praxis-standort.js:93 · `setzen()` [update] — module/praxis-standort.js:143 · `toggleStandortDay()` [update] — dashboard.js:9307 · `wireBusinessModal()` [insert/update] — dashboard.js:14743

**Liest (6):** `bootBusinessSwitcher()`, `fetchBusinesses()`, `getAvailableSlots()`, `kontoLoeschenIntern()`, `ladeKennung()`, `renderBookingCalendar()`

**Dateien:** `api-backend/billing/api/ausfall.routes.js`, `api-backend/dsgvo/loeschen.js`, `api-backend/routes/mitarbeiter-zugang.js`, `api-backend/server.js`, `api/stripe/webhook.js`, `attendance.js`, `booking.js`, `dashboard.js`, `module/praxis-standort.js`, `module/public-owner.js`, `onboarding.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `calendar_integrations`

9 Spalten · Status: aktiv
Warum: Google-Kalender-Anbindung je Nutzer: Tokens, Kalender-ID, Synchronisationszustand.

**Schreibt (3):** `fmt()` [delete] — dashboard.js:9951 · `loadIntegrations()` [delete] — kalender.js:762 · `loadSettings()` [delete] — dashboard.js:11287

**Liest (2):** `getAvailableSlots()`, `openEmpDetail()`

**Dateien:** `api-backend/server.js`, `api/admin/data.js`, `dashboard.js`, `kalender.js`, `module/ki-dashboard-contract.test.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

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

**Schreibt (1):** `saveSpecialDays()` [upsert] — dashboard.js:9527

**Liest (5):** `getAvailableSlots()`, `horizonDays()`, `loadBookingSlots()`, `renderBookingCalendar()`, `renderHoursMiniCal()`

**Dateien:** `api-backend/server.js`, `booking.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `data_access_log`

15 Spalten · Status: aktiv
Warum: Zugriffsprotokoll nach DSGVO Art. 32 — wer hat wann welche Patientendaten angefasst. Aufbewahrung 12 Monate.

**Schreibt (1):** `logAccess()` [insert] — api-backend/_lib/access-log.js:72

**Liest (3):** `createDsgvoRouter()`, `db()`, `noopMiddleware()`

**Dateien:** `api-backend/_lib/access-log.js`, `api-backend/routes/dsgvo.js`

### `data_sharing_settings`

8 Spalten · Status: aktiv
Warum: Ein Inhaber mit mehreren Standorten muss je Datenkategorie entscheiden: gemeinsam oder getrennt. Fehlende Zeile = alles getrennt (bewusst als sichere Vorgabe).

**Schreibt (1):** `saveDataSharing()` [upsert] — dashboard.js:14589

**Liest (1):** `loadDataSharing()`

**Dateien:** `dashboard.js`

### `datenaustausch_zaehler`

6 Spalten · Status: aktiv — ✅ **am 20.09.2026 live angewandt** (MCP, zusammen mit 0026–0034). Die Tabelle ist noch leer: die erste Zeile entsteht, sobald die erste Datei unter dem neuen Verfahren erzeugt wird. Ein rückwirkender Backfill aus dem Bestand wurde bewusst **nicht** gemacht — die Altzeilen tragen keinen `empfaenger_ik`, eine je Paar aufgebaute Folge wäre geraten, nicht gewusst. Wer den Zähler vor dem ersten Lauf setzen will, nimmt `datenaustausch_zaehler_vorstellen()`.
Warum: Die zwei dauerhaften Zähler des §302-Datenaustauschs. Bis zum 20.09.2026 rechneten alle drei Erzeugungsrouten `COUNT(*) + 1` über `abrechnung` — je `owner_id`, mit `created_at >= 1. Januar`. Daran war dreierlei falsch: die **Datenaustauschreferenz** (UNB 0020) läuft laut Anlage 1 TP5 V21 Kap. 5.4/7.2 je **Paar (Absender-IK, Empfänger-IK)** fort, nicht je Konto; ein Neustart ist nur beim Überlauf von 99999 erlaubt, nicht jedes Jahr; und ein `COUNT(*)` gibt eine gelöschte Nummer wieder her und kollidiert bei zwei gleichzeitigen Einreichungen. Belegter Schaden: die Reihenfolge im Korrekturverfahren bricht — eine Korrektur, die vor ihrer Erstrechnung verarbeitet wird, weist die Kasse ab (Kap. 7.2), und der Fehler ist von außen kaum zu erkennen. Rechtlich (`legal-de`, 20.09.2026) ist eine doppelte Einreichung eine **Fehlfunktion**, kein Anwenderfehler — über AGB § 9(2) haften wir dafür. Die **Transfernummer** ist ausdrücklich etwas anderes („keinen Bezug zur lfd. Nr. des Vorlaufsatzes", Anhang 1 § 4.3) und wurde bis dahin per Modulo aus genau dieser Nummer abgeleitet.

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

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `document_vorlagen`

9 Spalten · Status: aktiv
Warum: Druckvorlagen je Inhaber (Rechnung, Mahnung, Bericht) als JSON. Sonst müsste jede Layoutänderung deployt werden.

**Schreibt (10):** `_enterAnsichtEditMode()` [update] — dashboard.js:11923 · `commit()` [update] — dashboard.js:12155 · `deleteVorlage()` [delete] — dashboard.js:12123 · `duplicateVorlage()` [insert] — dashboard.js:12132 · `fmt()` [delete/insert/update] — dashboard.js:9951 · `openVorlagenAnsicht()` [update] — dashboard.js:11833 · `saveVorlage()` [insert/update] — dashboard.js:12093 · `seedDefaultVorlagen()` [insert] — dashboard.js:12179 · `seedeVorlagen()` [insert] — module/vorlagen-seed.js:25 · `startVorlagenInlineRename()` [update] — dashboard.js:12148

**Liest (2):** `loadVorlagenPanel()`, `openVorlagenEdit()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `dashboard.js`, `module/vorlagen-seed.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `dta_schluessel`

10 Spalten · Status: Referenz, im Code ungenutzt
Warum: Schlüsselverzeichnisse aus Anlage 3 TP5 (Kennzeichen, Gruppen, Codes) als Datenbestand.

### `email_logs`

11 Spalten · Status: aktiv
Warum: Welche Mail ging wann an wen raus. Bei Terminbestätigungen ist „ist die Mail angekommen?" die häufigste Rückfrage.

**Schreibt (2):** `fmt()` [insert] — dashboard.js:9951 · `loadPatientDetailMails()` [update] — dashboard.js:8085

**Dateien:** `api/admin/data.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `empfaenger_zertifikate`

9 Spalten · Status: aktiv (Referenz) — Migration vorbereitet, Tabelle initial leer. Befüllung erfolgt manuell über das Admin-CLI-Werkzeug `tools/empfaenger-zertifikat-laden.mjs`.
Warum: Für die §302 CMS EnvelopedData-Verschlüsselung (GGT Anlage 16 §5.1, SECON) wird der öffentliche X.509-Schlüssel der zuständigen Annahmestelle benötigt. Anders als bei `terapeut_zertifikat` (wo nur Metadaten des Therapeuten-Signaturschlüssels gespeichert werden) muss hier das echte Zertifikat (DER-Bytes) der Empfänger-Annahmestellen im System hinterlegt sein.

**Liest (2):** `berechneVerschluesselung()`, `ermittleEmpfaengerZertifikatStatus()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`

### `employee_business_assignments`

5 Spalten · Status: aktiv
Warum: Ein Angestellter kann an mehreren Standorten arbeiten. Die Zuordnung passt weder in `profiles` (1:n) noch in `businesses`.

**Schreibt (5):** `fmt()` [delete/upsert] — dashboard.js:9951 · `kontoLoeschenIntern()` [delete] — api-backend/dsgvo/loeschen.js:75 · `renderEmpStandortList()` [delete/upsert] — dashboard.js:10129 · `renderOtherStandortEmps()` [upsert] — dashboard.js:9982 · `saveEmpPermissions()` [upsert] — dashboard.js:10230

**Liest (5):** `bootBusinessSwitcher()`, `getAvailableSlots()`, `init()`, `loadEmpPermissions()`, `loadTeam()`

**Dateien:** `api-backend/dsgvo/loeschen.js`, `api-backend/routes/mitarbeiter-zugang.js`, `api-backend/server.js`, `booking.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `employee_groups`

5 Spalten · Status: aktiv
Warum: Rollen oberhalb von „Inhaber/Angestellter" — Rezeption, Therapeut, Leitung. Wird beim Anlegen eines Standorts automatisch vorbefüllt.

**Schreibt (1):** `kontoLoeschenIntern()` [delete] — api-backend/dsgvo/loeschen.js:75

**Liest (4):** `fmt()`, `loadEmpPermissions()`, `renderEmpStandortList()`, `renderOtherStandortEmps()`

**Dateien:** `api-backend/dsgvo/loeschen.js`, `api-backend/routes/mitarbeiter-zugang.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `employee_scope_overrides`

5 Spalten · Status: aktiv
Warum: Ausnahme für eine einzelne Person, ohne dafür eine neue Gruppe zu erfinden („die eine Rezeptionskraft darf zusätzlich Rechnungen sehen").

**Schreibt (3):** `fmt()` [delete/insert] — dashboard.js:9951 · `kontoLoeschenIntern()` [delete] — api-backend/dsgvo/loeschen.js:75 · `saveEmpPermissions()` [delete/insert] — dashboard.js:10230

**Liest (1):** `renderEmpPermGrid()`

**Dateien:** `api-backend/dsgvo/loeschen.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `employee_services`

4 Spalten · Status: aktiv
Warum: Nicht jeder Therapeut macht jede Leistung. Ohne diese Zuordnung bietet die Buchungsseite Termine bei Leuten an, die sie nicht durchführen dürfen.

**Schreibt (5):** `fmt()` [delete/insert] — dashboard.js:9951 · `kontoLoeschenIntern()` [delete] — api-backend/dsgvo/loeschen.js:75 · `loadEmpServices()` [delete/insert] — dashboard.js:10666 · `normName()` [insert] — onboarding.js:599 · `syncServices()` [insert] — onboarding.js:618

**Liest (2):** `loadServices()`, `openBookingFromRxPreset()`

**Dateien:** `api-backend/dsgvo/loeschen.js`, `api-backend/server.js`, `api/stripe/webhook.js`, `booking.js`, `dashboard.js`, `kalender.js`, `onboarding.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `fahrten`

21 Spalten · Status: aktiv
Warum: Fahrtenbuch für Hausbesuche, finanzamtstauglich (Zweck, Start-/Zielort, Kilometer).

**Schreibt (2):** `saveFahrtEndHandler()` [upsert] — dashboard.js:3765 · `saveFahrtStartHandler()` [upsert] — dashboard.js:3643

**Liest (2):** `loadActivityFeed()`, `loadFbFahrten()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `fahrten_aenderungen`

10 Spalten · Status: aktiv
Warum: Fahrtenbuch-Änderungsprotokoll (BMF-Schreiben 18.11.2009): nachträgliche Änderungen abgeschlossener Fahrten und jede Löschung bleiben mit altem (und neuem) Wert, Benutzer und Zeitpunkt nachvollziehbar. Append-only, nur per Trigger beschrieben; ohne FK, damit die Spur Fahrt und Benutzerkonto überlebt.

**Liest (1):** `ladeFahrtenAenderungen()`

**Dateien:** `module/fahrtenbuch-export.js`

**Module:** fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz

### `feedbacks`

12 Spalten · Status: aktiv
Warum: Rückmeldung aus dem Produkt heraus. Ein Trigger schickt jeden neuen Eintrag per Telegram — sonst liest sie niemand rechtzeitig.

**Liest (1):** `loadFeedbacks()`

**Dateien:** `api/admin/feedbacks.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, feedback, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `group_scopes`

4 Spalten · Status: aktiv
Warum: Was eine Gruppe darf. Trennt die Rechtematrix von der Gruppendefinition, damit Rechte änderbar sind ohne Gruppen anzufassen.

**Schreibt (1):** `kontoLoeschenIntern()` [delete] — api-backend/dsgvo/loeschen.js:75

**Liest (3):** `fmt()`, `renderEmpPermGrid()`, `saveEmpPermissions()`

**Dateien:** `api-backend/dsgvo/loeschen.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `heilmittel_catalog`

10 Spalten · Status: veraltet
Warum: Erster Podologie-Katalog (nur HPNR 78xxx), aus der Zeit vor der Vereinheitlichung.

### `heilmittel_katalog`

20 Spalten · Status: aktiv (Referenz)
Warum: Der **aktive**, vereinheitlichte und zeitversionierte Heilmittelkatalog aller vier Fachbereiche. Löste die beiden Vorgänger ab, weil abgelöste Positionen sonst als unbegrenzt gültig erschienen.

**Schreibt (1):** `main()` [delete/upsert] — api-backend/sync_heilmittel_katalog.js:151

**Dateien:** `api-backend/sync_heilmittel_katalog.js`

### `heilmittel_position`

19 Spalten · Status: veraltet
Warum: §302-Abrechnungspositionen mit Preisen und Zuzahlung, Physio-Seed aus der A2-Phase.

### `heilmittel_tarif`

10 Spalten · Status: **veraltet** (13.09.2026, O-96 — siehe `onprem/REGISTER.md`)
Warum: Preise je Bundesland × Kostenträger × Stichtag — die Tarifseite zum Katalog, aus der A2-Phase. 928 Zeilen. Die Annahme dahinter (Physio-Preise unterscheiden sich regional und je Kasse) hat sich als falsch erwiesen.

### `icd10_titles`

7 Spalten · Status: aktiv (Referenz)
Warum: ICD-10-GM 2026, 16.905 Kodes. Der Anwender soll suchen können, ohne den Code zu kennen.

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`

### `icd_sector_ranges`

5 Spalten · Status: aktiv (Referenz)
Warum: Welcher ICD-Bereich zu welchem Fachbereich gehört. Grundlage des `strict`-Filters, der fachfremde Diagnosen ganz aus der Auswahl nimmt.

### `invoices`

36 Spalten · Status: aktiv
Warum: Die Rechnung an Privatzahler und Selbstzahler (GKV läuft über `abrechnung`).

**Schreibt (3):** `frageZahlungsstatus()` [update] — module/rechnung-zahlung.js:87 · `markiereRechnungBezahlt()` [update] — module/rechnung-zahlung.js:68 · `saveInvoice()` [insert/update] — dashboard.js:13544

**Liest (6):** `downloadDmrzForInvoice()`, `ladeLetztePreise()`, `ladeOffeneRechnung()`, `loadActivityFeed()`, `loadPatientDetailRechnungen()`, `loadRechnungen()`

**Dateien:** `api-backend/billing/api/rechnung-zahlung.routes.js`, `api-backend/server.js`, `dashboard.js`, `module/rechnung-dmrz.js`, `module/rechnung-zahlung.js`, `module/selbstzahler-stufen.js`, `module/verordnung-maske.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `kiosk_pins`

6 Spalten · Status: aktiv
Warum: Der Kiosk-Modus (Tablet im Wartezimmer) braucht eine Anmeldung, die kein Passwort ist. Die PIN liegt als scrypt-Hash, geprüft wird ausschließlich im Backend.

**Dateien:** `api-backend/server.js`

### `kostentraeger`

15 Spalten · Status: aktiv — **Echtdaten**, mit 9 Mock-Resten
Warum: Die §302-Seite der Kassen. Seit dem 06.09.2026 trägt sie zwei Dinge, die vorher gefehlt haben: die **echten** IK-Nummern aus der TP5-Kostenträgerdatei — und die **n:1-Beziehung**, ohne die eine IK allein nichts wert ist. Eine Versichertenkarte nennt fast nie die Stelle, die am Ende abrechnet: die DAK-Karte trägt `100167999`, das Geld holt man aber bei `105830016`. Genau diese Auflösung steckt in `abrechnender_kt_ik` / `ist_abrechnender_kt` (VKG-Verknüpfungsart 01).

**Liest (7):** `_loeseEmpfaengerNameAuf()`, `baueBegleitzettel()`, `createZuzahlungsforderungRouter()`, `kostentraegerAbfrage()`, `ladeAnnahmestelle()`, `ladeKostentraegerNamen()`, `ladePapierannahmestelle()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js`, `api-backend/billing/kostentraeger/annahmestelle.js`, `api-backend/lib/rezept-felder.js`, `dashboard.js`, `module/abrechnung-einstellungen.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `kostentraeger_annahmestellen`

14 Spalten · Status: aktiv (Referenz) — **vollständig geladen**, Stand **Q4/2026** (01.10.2026). Der frühere Zeitfehler ist erledigt, siehe unten. Seit 01.10.2026 mit Gültigkeitsfenster `valid_from`/`valid_to` (`0046`, siehe „Gültigkeitsfenster“ unten).
Warum: Beantwortet die Frage, an der der §302-Versand sonst scheitert: **wohin geht diese Datei?** Der Empfänger ist nicht die Kasse, sondern ihre Datenannahmestelle — und die hängt am Viererschlüssel (Kostenträger, Abrechnungscode, Art der Datenlieferung, Bundesland). Eine einzelne Spalte an `kostentraeger` (`das_ik`) konnte das nie abbilden; deshalb eine eigene Tabelle statt weiterer Spalten. Sie ist damit auch die Antwort auf „hätte eine Spalte gereicht?" — nein, es ist eine echte 1:n-Beziehung.

**Liest (3):** `_loeseEmpfaengerNameAuf()`, `ladeAnnahmestelle()`, `ladePapierannahmestelle()`

**Dateien:** `api-backend/billing/kostentraeger/annahmestelle.js`, `module/abrechnung-einstellungen.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `kostentraeger_anschriften`

11 Spalten · Status: aktiv (Referenz) — ✅ **am 20.09.2026 live angewandt** (MCP). Seit 01.10.2026 mit Gültigkeitsfenster `valid_from`/`valid_to` (`0046`) — gleiches Modell wie bei `kostentraeger_annahmestellen` (NULL = offen, inklusive, kein Backfill, UNIQUE unverändert, der Lader schliesst mit `valid_to` statt zu löschen), Einzelheiten dort. Befüllt wird sie von `tools/kostentraeger-annahmestellen-laden.mjs --write` (derselbe Lauf wie die VKG-Zeilen); die Seed-Migration für die Kundenbox entsteht daraus über `tools/seed-generieren.mjs`.
Warum: Die Urbelege (Verordnungen im Original) gehen **per Post** an die **Papierannahmestelle** (Verknüpfungsart **09**), nicht an die Datenannahmestelle (02/03) — Richtlinien-Text § 2(1) und § 4. Der Begleitzettel trug bis zum 20.09.2026 **keine Empfängeradresse**, weil es in der Datenbank keinen Ort dafür gab: `kostentraeger` hat nur IK und Name. Im Echtbetrieb muss der Podologe wissen, wohin der Umschlag geht.

**Liest (1):** `ladePapierannahmestelle()`

**Dateien:** `api-backend/billing/kostentraeger/annahmestelle.js`

### `krankenkassen`

6 Spalten · Status: aktiv (Referenz) — `ik_number` ist eine **Vorbelegung, nur wenn eindeutig**, keine Abrechnungswahrheit (Ops #301, Konsey 21.09.2026). Live 21.09.2026: 76 von 94 gefüllt, 18 NULL. Migration `0041_krankenkassen_ik_nachtrag`: ✅ **Live seit 27.09.2026** (MCP, Freigabe Melih) — 74 gefüllt, 20 NULL, alle drei Selbstprüfungen bestanden, 0 Mock-IKs übrig.
Warum: Die Kassenliste für das Auswahlfeld in der Oberfläche. 94 Zeilen (live 21.09.2026), gesetzt am 02.06.2026.

**Liest (2):** `ladeKassen()`, `loadKkList()`

**Dateien:** `api-backend/server.js`, `booking-request.js`, `dashboard.js`, `module/krankenkasse-suche.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `leads`

47 Spalten · Status: aktiv
Warum: **Das ist die Patientenakte.** Der Name stammt aus der Akquise-Zeit (daher `title`, `google_url`, `reviews_count`) und ist geblieben, weil ein Umbenennen jede Abfrage im Projekt anfasst.

**Schreibt (6):** `beantworteAltbestand()` [update] — module/verordnung-podo.js:919 · `handleDirectAusfallrechnung()` [update] — dashboard.js:3976 · `initSchnellerfassung()` [insert] — dashboard.js:16981 · `kontoLoeschenIntern()` [delete/update] — api-backend/dsgvo/loeschen.js:75 · `maybeOfferAppointmentConfirmEmail()` [update] — dashboard.js:6738 · `verordnungPatientenAbgleich()` [update] — module/verordnung-patient-abgleich.js:19

**Liest (39):** `altbestandAusLeads()`, `ausfallVereinbarungDatum()`, `downloadDmrzForInvoice()`, `fillRzPatientFromLead()`, `findeLeadIdZuTermin()`, `fmt()`, `handleSessionDrop()`, `handleTerminStarten()`, `initBkCustomerAutocomplete()`, `initBkGroupPatientAutocomplete()`, `initCalRightPanel()`, `initWlPatientAutocomplete()`, `ladeAktiveVerordnungen()`, `ladeAltbestand()`, `ladeKassen()`, `ladePatienten()`, `ladePatientenCache()`, `leadIdFuerFahrt()`, `loadActivityFeed()`, `loadAnamnese()` … +19

**Dateien:** `api-backend/billing/api/statistik.routes.js`, `api-backend/booking/public-guards.js`, `api-backend/dsgvo/loeschen.js`, `api-backend/server.js`, `dashboard.js`, `module/anamnese.js`, `module/arzt-register.js`, `module/ausfallrechnung.js`, `module/fahrt-beenden.js`, `module/fussbefund.js`, `module/krankenkasse-suche.js`, `module/patienten-einwilligung.js`, `module/podo-einheiten.js`, `module/rechnung-ansicht.js`, `module/rechnung-dmrz.js`, `module/rechnung-editor.js`, `module/rechnung-editor.test.js`, `module/rezept-patientenfeld.js`, `module/termin-patient-bezug.js`, `module/verordnung-patient-abgleich.js`, `module/verordnung-podo.js`, `module/verordnung-uebersicht.js`

**Module:** abrechnung, anamnese, anfragen, b2b, b2c, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `mahnungen`

13 Spalten · Status: aktiv
Warum: Mahnstufen zu offenen Rechnungen, mit eigenem Nummernkreis.

**Liest (1):** `createZuzahlungsforderungRouter()`

**Dateien:** `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js`

### `messreihen`

12 Spalten · Status: aktiv
Warum: Messwerte im Verlauf (Blankoverordnung: der Therapeut muss den Behandlungserfolg belegen).

**Schreibt (2):** `refreshMessreihen()` [delete] — dashboard.js:7874 · `saveMessung()` [insert] — dashboard.js:7998

**Dateien:** `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `module_visibility`

6 Spalten · Status: aktiv
Warum: Nicht jede Praxis braucht jedes Sidebar-Modul. Hier liegt der **zentrale** Schalter je **Fachbereich × Rolle × Modul** (`sector`, `role`, `module_id`, `enabled`); die Modulliste selbst steht im Code (`nav-registry.js`).

**Schreibt (2):** `loadVisibility()` [upsert] — admin.js:279 · `saveVisToggle()` [upsert] — admin.js:360

**Liest (1):** `loadVisibilityMatrix()`

**Dateien:** `admin.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `nummernkreise`

4 Spalten · Status: aktiv
Warum: Lückenlose, race-freie Nummernvergabe je Inhaber und Kreis. Vorher zählte man mit `MAX+1` hoch — bei zwei gleichzeitigen Nutzern gibt das dieselbe Nummer zweimal. Seit 11.09.2026 laufen **alle vier** Kreise hierüber: `rechnung` (→ `invoices.rechnung_nr`, jahresweise), `beleg` (→ `belegliste.beleg_nr`), `mahnung` (→ `mahnungen.mahnung_nr`), `ausfallrechnung` (→ `ausfallrechnungen.rechnung_nr`).

### `pat_fussbefund`

17 Spalten · Status: aktiv
Warum: Der podologische Fußbefund samt Fußkarte. Ersetzt fachlich `fußstatus`. Seit 30.08.2026 hält die Tabelle nicht mehr nur den *aktuellen* Befund, sondern seinen **Verlauf**.

**Schreibt (2):** `renderBefundListe()` [delete] — module/fussbefund.js:983 · `speichern()` [insert] — module/fussbefund.js:732

**Liest (8):** `frag()`, `ladeAltrisiken()`, `ladeLetzterBefund()`, `ladePatientenkontext()`, `ladeVerlauf()`, `ladeWagnerRozet()`, `renderFussbefundArchiv()`, `verdrahteFussbefundKnopf()`

**Dateien:** `module/anamnese-daten.js`, `module/fussbefund-archiv.js`, `module/fussbefund.js`, `module/patientenkarte.js`, `module/podo-tag-zusatz.js`, `module/podo-wagner.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `patient_consents`

16 Spalten · Status: aktiv
Warum: Digitale Einwilligung des Patienten mit einfacher elektronischer Signatur. Vorher gab es dafür nur Papier, und der Nachweis fehlte bei Praxisübergabe.

**Schreibt (2):** `speichereEinwilligung()` [insert] — module/patienten-einwilligung.js:340 · `widerrufen()` [update] — module/patienten-einwilligung.js:580

**Liest (2):** `kopieOeffnen()`, `renderEinwilligungListe()`

**Dateien:** `module/patienten-einwilligung.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `patient_notes`

10 Spalten · Status: aktiv
Warum: Freitext-Notizen zum Patienten, die weder Anamnese noch Behandlungsdokumentation sind.

**Schreibt (1):** `fmt()` [insert/update] — dashboard.js:9951

**Liest (5):** `loadActivityFeed()`, `loadNotizen()`, `loadPatientDetailNotes()`, `loadPatientNotes()`, `openBookingActionModal()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `patients`

8 Spalten · Status: aktiv
Warum: Der Anfragende ist noch kein Patient der Praxis. Er darf nicht in die echte Akte (`leads`) geschrieben werden, bevor jemand die Anfrage angenommen hat.

**Liest (1):** `validatePatient()`

**Dateien:** `api-backend/booking/public-guards.js`, `api-backend/server.js`

### `pending_signups`

6 Spalten · Status: aktiv
Warum: Zwischen „Formular ausgefüllt" und „bezahlt" existiert der Account noch nicht. Die Anmeldedaten müssen solange irgendwo liegen — inklusive Passwort, und das darf nicht im Klartext stehen.

**Liest (1):** `kontoLoeschenIntern()`

**Dateien:** `api-backend/dsgvo/loeschen.js`, `api-backend/server.js`, `api/stripe/create-checkout-session.js`, `api/stripe/webhook.js`

### `podologie_behandlungen`

16 Spalten · Status: aktiv
Warum: Die Behandlung zur podologischen Verordnung — das Gegenstück zu `prescription_sessions`. `verordnung_id` zeigt seit 04.09.2026 auf `prescriptions` (Zusammenlegung der Verordnungstöpfe, ids unverändert) — vorher auf die eigene Tabelle `verordnungen`.

**Schreibt (3):** `behandlungenVerknuepfen()` [update] — module/rechnung-bruecke.js:189 · `behandlungStornieren()` [update] — module/podo-storno.js:91 · `loadPodologieBilling()` [insert] — module/podologie-abrechnung.js:489

**Liest (15):** `createPodoEmpfangsnachweisRouter()`, `frag()`, `ladeAbrechnungAuswahl()`, `ladeAktiveVerordnungen()`, `ladeBehandlungen()`, `ladeVerlauf()`, `leiteBehandlungsbeginnAb()`, `oeffneStatusDialogFuer()`, `offeneBehandlungen()`, `patientenBehandlungen()`, `podBehandlungenDerVerordnung()`, `podoHistorie()`, `podPatientBehandlungen()`, `verknuepfungLoesen()`, `verordnungenLaden()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/podo-empfangsnachweis.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `module/abrechnung-auswahl.js`, `module/abrechnungsstatus.js`, `module/behandlungsbeginn.js`, `module/patientenkarte.js`, `module/podo-einheiten.js`, `module/podo-storno.js`, `module/podologie-abrechnung.js`, `module/rechnung-bruecke.js`, `module/rechnung-verordnung.js`, `module/termin-leistungen.js`, `module/verordnung-podo.js`, `module/verordnung-uebersicht.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `podologie_empfangsnachweise`

13 Spalten · Status: aktiv
Warum: Nachträgliche Prüfung des originalen Papier-Empfangsnachweises für die podologische Eingangsbefundung 78040 dokumentieren, ohne die bereits unveränderliche Behandlung umzuschreiben. Eigener append-only Ereignisverlauf, weil Bestätigung, Widerruf und erneute Prüfung einen anderen Lebenszyklus als die Behandlung haben. Ein Vermerk ersetzt weder Patientenunterschrift noch Originalpapier; technische DAS-Quittungen gehören weiterhin zur Übermittlung, nicht hierher.

**Liest (2):** `createPodoEmpfangsnachweisRouter()`, `pruefePodologieEmpfangsnachweise()`

**Dateien:** `api-backend/billing/api/podo-empfangsnachweis.routes.js`, `api-backend/billing/utils/podo-empfangsnachweis.js`

### `praxura_migrations`

6 Spalten · Status: aktiv
Warum: Das Buch der Schemakette — eine Zeile je angewandter Migrationsdatei. Bis

### `praxura_setup`

7 Spalten · Status: aktiv in der Box — **im SaaS bewusst inert** (siehe Achtung)
Warum: Der Einrichtungsassistent der Kundenbox (On-Premise Faz 2.2) braucht eine

**Schreibt (1):** `billigePruefungenLaufen()` [update] — api-backend/setup/router.js:134

**Liest (3):** `istAbgeschlossen()`, `kutuInEinrichtung()`, `ownerAngelegt()`

**Dateien:** `api-backend/server.js`, `api-backend/setup/owner-passwort-reset.mjs`, `api-backend/setup/router.js`

### `prescription_documents`

13 Spalten · Status: aktiv
Warum: Nachweise und Anhänge zu einer Verordnung — Befreiungsausweis, LHB-Genehmigung, korrigierte Verordnung, Therapiebericht. Als Spalten in `prescriptions` wären es beliebig viele.

**Schreibt (2):** `kontoLoeschenIntern()` [delete] — api-backend/dsgvo/loeschen.js:75 · `ladeLhbNachweisHoch()` [insert] — module/verordnung-nachweis.js:109

**Liest (1):** `createZuzahlungsforderungRouter()`

**Dateien:** `api-backend/billing/api/zuzahlungsforderung.routes.js`, `api-backend/dsgvo/loeschen.js`, `module/verordnung-nachweis.js`

### `prescription_sessions`

9 Spalten · Status: aktiv
Warum: Die einzelne Behandlungseinheit auf der Verordnung. Ohne sie ließe sich nicht sagen, wie viele der verordneten Einheiten schon geleistet sind.

**Schreibt (8):** `bindeSitzungenAnTermin()` [update] — module/sitzung-bindung.js:44 · `gleicheSitzungenAb()` [upsert] — module/sitzung-abgleich.js:86 · `handleSessionDrop()` [update] — dashboard.js:3399 · `korrigiereNoShow()` [update] — module/booking-status-korrektur.js:68 · `linkBookingsToPrescriptionSessions()` [insert/update] — dashboard.js:6646 · `markiereNichtErschienen()` [update] — module/termin-nicht-erschienen.js:105 · `markPrescriptionSession()` [update] — dashboard.js:6613 · `rebindeNoShowSitzungen()` [update] — module/termin-nicht-erschienen.js:283

**Liest (10):** `decorateBookingTitleWithSession()`, `ladePrivatSumme()`, `loadCalRpUnverga()`, `loadRxSessionsPanel()`, `openInvView()`, `pruefeFrequenz()`, `pruefeVerordnungsfortschritt()`, `terminAuswahlLaden()`, `waehleVerordnungFuerPanel()`, `zaehler()`

**Dateien:** `api-backend/billing/api/statistik.routes.js`, `api-backend/server.js`, `dashboard.js`, `module/booking-status-korrektur.js`, `module/frequenz-pruefung.js`, `module/rechnung-ansicht.js`, `module/rechnung-editor.js`, `module/rezeptinfo-geld.js`, `module/sitzung-abgleich.js`, `module/sitzung-bindung.js`, `module/sitzungsfortschritt.js`, `module/termin-aktionen.js`, `module/termin-nicht-erschienen.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `prescription_validations`

13 Spalten · Status: aktiv
Warum: Prüfergebnis der Rezeptvalidierung samt Übersteuerung. Getrennt von `prescriptions`, weil es ein Protokoll ist: wer hat wann welche Warnung überstimmt.

**Liest (1):** `ladeAbrechnungAuswahl()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `api-backend/server.js`, `module/abrechnung-auswahl.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `prescriptions`

90 Spalten · Status: aktiv
Warum: Die Verordnung (Muster 13) für ALLE vier Fachbereiche — Physio, Ergo, Logopädie UND (seit 04.09.2026) Podologie. `therapie_bereich` unterscheidet; Podologie-Zeilen tragen zusätzlich neun aus `verordnungen` übernommene Spalten (`patient_name`, `wagner_grad`, `versichertennummer`, `behandlungsanlass`, `absetzung_*`, `storno_*`, `rezeptart`).

**Schreibt (11):** `betragNullsetzen()` [update] — module/zuzahlung-befreiung.js:292 · `downloadDmrzForInvoice()` [update] — module/rechnung-dmrz.js:109 · `flipAbrechnungStatus()` [update] — dashboard.js:7729 · `kassiereZuzahlung()` [update] — dashboard.js:6468 · `kontoLoeschenIntern()` [delete] — api-backend/dsgvo/loeschen.js:75 · `kostentraegerIkZurueckschreiben()` [update] — api-backend/billing/utils/kostentraeger-frisch.js:114 · `pruefeVerordnungsfortschritt()` [update] — module/sitzungsfortschritt.js:128 · `speichereEinheiten()` [update] — module/verordnung-einheiten.js:126 · `storniereZuzahlung()` [update] — dashboard.js:6543 · `triggerStorno()` [update] — dashboard.js:16433 · `zaehler()` [update] — module/sitzungsfortschritt.js:131

**Liest (42):** `aufEuro()`, `bereichFuerAbrechnung()`, `bindePodoSerieVonRezept()`, `createZuzahlungsforderungRouter()`, `datumKurz()`, `frag()`, `frageZahlungsstatus()`, `heute()`, `korrekturAusPanel()`, `ladeAbrechnungAuswahl()`, `ladeAktiveVerordnungen()`, `ladeBehandlungen()`, `ladeRxKontext()`, `ladeVerlauf()`, `ladeVerordnung()`, `ladeWagnerRozet()`, `ladeZuweisungen()`, `linkBookingsToPrescriptionSessions()`, `loadCalRpRezeptInfo()`, `loadPatientDetailRezepte()` … +22

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `api-backend/billing/api/zuzahlung.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js`, `api-backend/billing/utils/kostentraeger-frisch.js`, `api-backend/billing/zaa/anwenden.js`, `api-backend/dsgvo/loeschen.js`, `api-backend/server.js`, `dashboard.js`, `module/abrechnung-auswahl.js`, `module/anamnese.js`, `module/arzt-register.js`, `module/booking-status-korrektur.js`, `module/frequenz-pruefung.js`, `module/frequenz-pruefung.test.js`, `module/patientenkarte.js`, `module/podo-behandlungen-oeffnen.js`, `module/podo-einheiten.js`, `module/podo-wagner.js`, `module/rechnung-ansicht.js`, `module/rechnung-dmrz.js`, `module/rechnung-verordnung.js`, `module/rechnung-zahlung.js`, `module/rezeptinfo-geld.js`, `module/sitzungsfortschritt.js`, `module/termin-aktionen.js`, `module/termin-folge.js`, `module/termin-leistungen.js`, `module/termin-panel.js`, `module/termin-verordnung.js`, `module/verordnung-detail.js`, `module/verordnung-einheiten.js`, `module/verordnung-uebersicht.js`, `module/verordnung-uebersicht.test.js`, `module/zuzahlung-befreiung.js`, `module/zuzahlung-korrektur.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `profiles`

89 Spalten · Status: aktiv
Warum: Der Dreh- und Angelpunkt der Mandantentrennung. Jeder Account — Inhaber wie Angestellter — hat genau eine Zeile; `role` und `owner_id` entscheiden, wer wessen Daten sieht. Weil Einzelstandort-Inhaber gar keinen `businesses`-Datensatz haben, liegen **Inhaber-Einstellungen hier**, nicht in `businesses`.

**Schreibt (28):** `bindBilling()` [update] — onboarding.js:453 · `bindBusiness()` [update] — onboarding.js:388 · `bindHours()` [update] — onboarding.js:813 · `bindOwner()` [update] — onboarding.js:516 · `bindPlan()` [update] — onboarding.js:870 · `ensureBookingSlug()` [update] — dashboard.js:12408 · `ensureClinicLocation()` [update] — dashboard.js:5098 · `ensureCompanyCode()` [update] — dashboard.js:12391 · `fmt()` [update] — dashboard.js:9951 · `handleSave()` [update] — onboarding.js:457 · `init()` [update] — kalender.js:130 · `initAnfragenPanel()` [update] — dashboard.js:18795 · `kontoLoeschenIntern()` [update] — api-backend/dsgvo/loeschen.js:75 · `loadProfile()` [insert] — onboarding.js:115 · `mountBrandingExtras()` [update] — module/branding-ui.js:27 · `mountPraxisStandort()` [update] — module/praxis-standort.js:93 · `openEmpDetail()` [update] — dashboard.js:10283 · `openStripePortal()` [update] — dashboard.js:1904 · `renderLegendeSettings()` [update] — module/fussbefund.js:1720 · `saveAusfallSettings()` [update] — module/ausfall-einstellungen.js:76 · `saveStepProgress()` [update] — onboarding.js:281 · `schalter()` [update] — module/praxis-standort.js:130 · `setzen()` [update] — module/praxis-standort.js:143 · `speichereKonten()` [update] — module/buchungskonten.js:295 · `speichereStufen()` [update] — module/selbstzahler-stufen.js:259 · `stempelEntfernen()` [update] — module/stempel.js:70 · `stempelHochladen()` [update] — module/stempel.js:55 · `wireAbrechnungSettings()` [update] — module/abrechnung-einstellungen.js:271

**Liest (50):** `_speichereBetriebsart()`, `bereichFuerAbrechnung()`, `createZuzahlungsforderungRouter()`, `fetchBusinesses()`, `gehoertZurPraxis()`, `getAvailableSlots()`, `gpsSchalterLesen()`, `handleDirectAusfallrechnung()`, `handleEmpfaengerPruefung()`, `kontenFuer()`, `lade()`, `ladeLegende()`, `ladeNutzerMap()`, `ladePatientenAnamnese()`, `ladePraxisAbrechnungsProfil()`, `loadAusfallConfig()`, `loadAusfallConfig()`, `loadEmpUrlaubSection()`, `loadFahrtenbuchPanel()`, `loadFbFahrten()` … +30

**Dateien:** `api-backend/ai/auth.js`, `api-backend/ai/ki-woerterbuch.js`, `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/ausfall.routes.js`, `api-backend/billing/api/mahnwesen.routes.js`, `api-backend/billing/api/podo-empfangsnachweis.routes.js`, `api-backend/billing/api/rechnung-zahlung.routes.js`, `api-backend/billing/api/statistik.routes.js`, `api-backend/billing/api/verordnung-status.routes.js`, `api-backend/billing/api/warteliste.routes.js`, `api-backend/billing/api/zuzahlung.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js`, `api-backend/billing/statistik/therapeuten.js`, `api-backend/booking/public-guards.js`, `api-backend/dsgvo/loeschen.js`, `api-backend/fix_db.js`, `api-backend/routes/mitarbeiter-zugang.js`, `api-backend/server.js`, `api-backend/setup/owner-passwort-reset.mjs`, `api-backend/setup/pruefungen.js`, `api-backend/setup/router.js`, `api-backend/test_schema.js`, `api/admin/data.js`, `api/onboarding/check-email.js`, `api/stripe/create-checkout-session.js`, `api/stripe/portal-session.js`, `api/stripe/webhook.js`, `attendance.js`, `dashboard.js`, `kalender.js`, `login.js`, `module/abrechnung-einstellungen.js`, `module/anamnese.js`, `module/anfrage-bearbeiten.js`, `module/ausfall-einstellungen.js`, `module/beleg-druck.js`, `module/branding-ui.js`, `module/buchungskonten.js`, `module/fahrtenbuch-export.js`, `module/fussbefund.js`, `module/praxis-standort.js`, `module/selbstzahler-stufen.js`, `module/stempel.js`, `onboarding.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

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

**Schreibt (1):** `initLeadSuche()` [insert] — module/lead-suche.js:19

**Liest (1):** `loadDoctors()`

**Dateien:** `module/lead-suche.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `services`

19 Spalten · Status: aktiv
Warum: Was die Praxis anbietet, mit Dauer und Preis. Grundlage für Slot-Berechnung und Abrechnung.

**Schreibt (7):** `autoSeedGkvServices()` [insert] — dashboard.js:8607 · `ensureBlankoBonusServices()` [insert/update] — dashboard.js:6835 · `migratePodologieLegacyServices()` [update] — dashboard.js:8803 · `normName()` [delete/insert/update] — onboarding.js:599 · `renderServices()` [delete] — dashboard.js:8990 · `syncServices()` [delete/insert/update] — onboarding.js:618 · `wireBusinessModal()` [insert] — dashboard.js:14743

**Liest (15):** `anfrageKorrekturenPruefen()`, `ausfallPriceEur()`, `createBookingsFromRequestFactory()`, `findMatchingServiceId()`, `fmt()`, `getAvailableSlots()`, `initCalendar()`, `loadEmpServices()`, `loadProfile()`, `loadServices()`, `loadServices()`, `sondiere()`, `stammdatenLaden()`, `updateBkDuration()`, `validateService()`

**Dateien:** `api-backend/booking/from-request.js`, `api-backend/booking/public-guards.js`, `api-backend/check_db.js`, `api-backend/server.js`, `api/stripe/webhook.js`, `dashboard.js`, `kalender.js`, `module/anfrage-bearbeiten.js`, `module/kostentraeger-spalte.js`, `module/kostentraeger-spalte.test.js`, `onboarding.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `spatial_ref_sys`

5 Spalten · Status: System
Warum: Systemtabelle der PostGIS-Erweiterung (Koordinatensysteme). Kam mit `enable_postgis` für die Geocodierung im Fahrtenbuch.

### `terapeut_zertifikat`

15 Spalten · Status: aktiv
Warum: Das **Signaturzertifikat** für die §302-Einreichung (PKCS#7). Ohne gültiges Zertifikat lässt sich keine DTA-Datei signieren.

**Schreibt (2):** `_speichereBetriebsart()` [upsert] — module/abrechnung-einstellungen.js:502 · `wireAbrechnungSettings()` [upsert] — module/abrechnung-einstellungen.js:271

**Liest (5):** `createZuzahlungsforderungRouter()`, `ikVorbelegen()`, `renderAbrechnungSettings()`, `renderOverview()`, `renderOwnerCertExpiryBanner()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js`, `dashboard.js`, `module/abrechnung-einstellungen.js`, `module/abrechnung-empfaenger.js`, `module/verordnung-podo.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `therapist_certificates`

5 Spalten · Status: aktiv
Warum: Fachliche Qualifikationen des Therapeuten (MT, MLD, KGG). Bestimmte Leistungen darf nur abrechnen, wer die Qualifikation nachweist.

**Schreibt (2):** `fmt()` [delete/insert] — dashboard.js:9951 · `loadEmpCertificates()` [delete/insert] — dashboard.js:10752

**Liest (2):** `ladeAbrechnungAuswahl()`, `loadEmpServices()`

**Dateien:** `api-backend/billing/api/abrechnung.routes.js`, `dashboard.js`, `module/abrechnung-auswahl.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `time_offs`

12 Spalten · Status: aktiv
Warum: Urlaub, Krankheit, Fortbildung. Anders als `custom_days` personenbezogen und mehrtägig.

**Schreibt (6):** `deleteEmpTimeOff()` [delete] — dashboard.js:9884 · `deleteUrlaub()` [delete] — dashboard.js:9961 · `fmt()` [delete/insert] — dashboard.js:9951 · `loadTeam()` [insert] — dashboard.js:9630 · `openEmpDetail()` [insert] — dashboard.js:10283 · `saveUrlaub()` [insert] — dashboard.js:9900

**Liest (8):** `getAvailableSlots()`, `horizonDays()`, `initCalendar()`, `ladeAbwesenheiten()`, `loadEmpDaySchedule()`, `loadEmpUrlaubSection()`, `loadUeberblickVacations()`, `loadUrlaubListe()`

**Dateien:** `api-backend/server.js`, `dashboard.js`, `kalender.js`, `module/abwesenheit.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

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

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `user_credits`

6 Spalten · Status: fremd
Warum: Fremdprojekt (Guthabenmodell). Praxura rechnet über Stripe ab, nicht über Credits.

### `user_preferences`

5 Spalten · Status: aktiv
Warum: Pro Nutzer merkbare Oberflächen-Zustände (gewählter Standort, Kalenderansicht, Mitarbeiterfilter) gehören nicht in `profiles` — das ist die fachliche Stammdatentabelle.

**Schreibt (2):** `saveUserPref()` [upsert] — dashboard.js:12981 · `switchBusiness()` [upsert] — dashboard.js:14905

**Liest (3):** `bootBusinessSwitcher()`, `bootScheduleViewToggle()`, `fmt()`

**Dateien:** `api-backend/server.js`, `api/stripe/webhook.js`, `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `vehicles`

11 Spalten · Status: aktiv
Warum: Fahrzeugstamm zum Fahrtenbuch; Kilometerstände und Kennzeichen gehören nicht an die einzelne Fahrt.

**Schreibt (2):** `loadFbVehicles()` [delete] — dashboard.js:16108 · `saveVehicleEditCore()` [insert/update] — dashboard.js:16220

**Liest (3):** `loadVehiclesForPicker()`, `saveFahrtEndHandler()`, `saveFahrtStartHandler()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `warteliste`

14 Spalten · Status: aktiv
Warum: Wenn nichts frei ist, soll der Wunsch nicht verlorengehen. Wird beim Freiwerden eines Slots gegen die Wunschzeiten gematcht.

**Schreibt (1):** `initWlModal()` [delete/insert/update] — dashboard.js:17298

**Liest (1):** `loadWarteliste()`

**Dateien:** `api-backend/billing/api/warteliste.routes.js`, `dashboard.js`, `module/warteliste-nachruecker.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `working_hours`

9 Spalten · Status: aktiv
Warum: Regelarbeitszeit je Mitarbeiter und Standort — die Grundlage jeder Slot-Berechnung.

**Schreibt (3):** `bindHours()` [delete/insert] — onboarding.js:813 · `fmt()` [upsert] — dashboard.js:9951 · `loadEmpHours()` [upsert] — dashboard.js:10574

**Liest (9):** `getAvailableSlots()`, `getEmployeeWorkingHours()`, `horizonDays()`, `loadHours()`, `renderBookingCalendar()`, `renderGaps()`, `renderGapsForDate()`, `renderHoursGrid()`, `renderHoursMiniCal()`

**Dateien:** `api-backend/routes/mitarbeiter-zugang.js`, `api-backend/server.js`, `api/stripe/webhook.js`, `booking.js`, `dashboard.js`, `kalender.js`, `onboarding.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `zaa_fehler`

10 Spalten · Status: aktiv
Warum: Absetzungen und Fehlermeldungen der Kasse aus der ZAA-Rückmeldung, samt Übersetzung und Lösungshinweis. Roh sind die Codes für einen Therapeuten unlesbar.

**Liest (1):** `showZaaErrors()`

**Dateien:** `dashboard.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `zuzahlung_befreiung`

11 Spalten · Status: aktiv
Warum: Befreiungsausweise. Ob ein Patient zuzahlungsfrei ist, entscheidet über den abrechenbaren Betrag und darf nicht als Häkchen an der Verordnung hängen — es gilt zeitraumbezogen.

**Schreibt (2):** `oeffneBefreiungsFormular()` [delete/upsert] — module/zuzahlung-befreiung.js:63 · `wireBefreiungCard()` [delete] — dashboard.js:7801

**Liest (2):** `loadPatientDetailRezepte()`, `openBookingActionModal()`

**Dateien:** `dashboard.js`, `module/zuzahlung-befreiung.js`

**Module:** abrechnung, anamnese, anfragen, b2b, belegliste, bkActionArrivedBtn, bkActionFahrtEndBtn, bkActionFahrtStartBtn, bkActionHbCopyBtn, doctors, fahrtenbuch, fbFahrtenExportCsv, fbFahrtenExportProt, fbFahrtenExportVerz, fbFahrtenRefresh, fbReportRefresh, fbVehicleAddBtn, feSaveBtn, fsAddVehicleBtn, fsSaveBtn, fussstatus, hours, kunden, mahnwesen, notizen, podologie-billing, rechnungen, services, settings, team, ueberblick, vehEditSaveBtn, verordnungen, vorlagen, warteliste

### `zuzahlung_guthaben`

13 Spalten · Status: aktiv
Warum: Hat der Patient im Voraus für 6 Einheiten gezahlt und bricht nach 3 ab, liegt Geld zuviel in der Praxis. Statt es auszuzahlen, soll es auf die nächste Verordnung angerechnet werden. Das Guthaben gehört dem Patienten, nicht der Verordnung — deshalb eigene Tabelle mit `patient_id` und nicht eine Spalte am Rezept.

**Dateien:** `api-backend/billing/api/zuzahlung.routes.js`

### `zuzahlung_korrekturen`

15 Spalten · Status: aktiv
Warum: Der geforderte Zuzahlungsbetrag darf sich ändern (Patient bricht nach 3 von 6 Einheiten ab), aber nicht stillschweigend — es ist Geld und es ist GoBD. Diese Tabelle hält je Änderung fest: wer, wann, alter Wert, neuer Wert, Grund. Eine Spalte an `prescriptions` hätte bei der zweiten Korrektur die erste Begründung überschrieben, also genau das, was hier verhindert werden soll.

**Dateien:** `api-backend/billing/api/zuzahlung.routes.js`

