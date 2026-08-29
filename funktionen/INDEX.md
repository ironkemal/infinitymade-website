# Funktionskarte

> Üretim: 2026-08-29 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**1688 fonksiyon** · 159 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 8 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:3994](dashboard.js#L3994-L4090) · 97 satır · bookings:insert

**Yol 2 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4274](dashboard.js#L4274-L4340) · 67 satır · bookings:update

**Yol 3 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4357](dashboard.js#L4357-L4371) · 15 satır · bookings:update

**Yol 4 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4401](dashboard.js#L4401-L4493) · 93 satır · bookings:update

**Yol 5 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4495](dashboard.js#L4495-L4563) · 69 satır · bookings:update

**Yol 6 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4585](dashboard.js#L4585-L4633) · 49 satır · bookings:update

**Yol 7 — `initBkGroupPatientAutocomplete()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadGroupParticipants()` — [dashboard.js:5000](dashboard.js#L5000-L5064) · 65 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:5102](dashboard.js#L5102-L5223) · 122 satır · bookings:insert

**Yol 8 — `doMoveBooking()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `doMoveBooking()` — [dashboard.js:5559](dashboard.js#L5559-L5588) · 30 satır · bookings:update

### `prescriptions` — 8 bağımsız yazma yolu

**Yol 1 — `flipAbrechnungStatus()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `flipAbrechnungStatus()` — [dashboard.js:8651](dashboard.js#L8651-L8687) · 37 satır · prescriptions:update

**Yol 2 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [dashboard.js:15733](dashboard.js#L15733-L15808) · 76 satır · prescriptions:update

**Yol 3 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17118](dashboard.js#L17118-L17276) · 159 satır · prescriptions:insert

**Yol 4 — `renderAbrechnungReady()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungReady()` — [dashboard.js:19846](dashboard.js#L19846-L20077) · 232 satır · prescriptions:update

**Yol 5 — `renderAbrechnungHistory()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungHistory()` — [dashboard.js:20079](dashboard.js#L20079-L20166) · 88 satır · prescriptions:update

**Yol 6 — `triggerStorno()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Kassenbuch (physiotherapy/podologie/praxis) · Sidebar → Patienten · Sidebar → Team
- `triggerStorno()` — [dashboard.js:21183](dashboard.js#L21183-L21242) · 60 satır · prescriptions:update

**Yol 7 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L120) · 39 satır · prescriptions:update

**Yol 8 — `betragNullsetzen()`** · Ekran: _UI yolu çözülemedi_
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `profiles` — 8 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2277](dashboard.js#L2277-L2387) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5882](dashboard.js#L5882-L5908) · 27 satır · profiles:update

**Yol 3 — `openEmpDetail()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `openEmpDetail()` — [dashboard.js:11489](dashboard.js#L11489-L11686) · 198 satır · profiles:update

**Yol 4 — `bindPlan()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:13851](dashboard.js#L13851-L13857) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:13868](dashboard.js#L13868-L13881) · 14 satır · profiles:update
- `init()` — [kalender.js:140](kalender.js#L140-L191) · 52 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1381](module/fussbefund.js#L1381-L1445) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:870](onboarding.js#L870-L1015) · 146 satır · profiles:update

**Yol 5 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:14560](dashboard.js#L14560-L14623) · 64 satır · profiles:insert

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [dashboard.js:17408](dashboard.js#L17408-L17450) · 43 satır · profiles:update

**Yol 7 — `initAnfragenPanel()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Termin-Anfragen · Sidebar → Patienten · Sidebar → Team
- `initAnfragenPanel()` — [dashboard.js:23673](dashboard.js#L23673-L23730) · 58 satır · profiles:update

**Yol 8 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `document_vorlagen` — 7 bağımsız yazma yolu

**Yol 1 — `openVorlagenAnsicht()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `openVorlagenAnsicht()` — [dashboard.js:13152](dashboard.js#L13152-L13223) · 72 satır · document_vorlagen:update
- `_enterAnsichtEditMode()` — [dashboard.js:13242](dashboard.js#L13242-L13306) · 65 satır · document_vorlagen:update

**Yol 2 — `saveVorlage()`** · Ekran: _UI yolu çözülemedi_
- `saveVorlage()` — [dashboard.js:13412](dashboard.js#L13412-L13440) · 29 satır · document_vorlagen:update, document_vorlagen:insert

**Yol 3 — `deleteVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `deleteVorlage()` — [dashboard.js:13442](dashboard.js#L13442-L13449) · 8 satır · document_vorlagen:delete

**Yol 4 — `duplicateVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `duplicateVorlage()` — [dashboard.js:13451](dashboard.js#L13451-L13465) · 15 satır · document_vorlagen:insert

**Yol 5 — `startVorlagenInlineRename()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `startVorlagenInlineRename()` — [dashboard.js:13467](dashboard.js#L13467-L13496) · 30 satır · document_vorlagen:update
- `commit()` — [dashboard.js:13474](dashboard.js#L13474-L13487) · 14 satır · document_vorlagen:update

**Yol 6 — `seedDefaultVorlagen()`** · Ekran: _UI yolu çözülemedi_
- `seedDefaultVorlagen()` — [dashboard.js:13510](dashboard.js#L13510-L13514) · 5 satır · document_vorlagen:insert

**Yol 7 — `seedMissingVorlagen()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `seedMissingVorlagen()` — [dashboard.js:13516](dashboard.js#L13516-L13520) · 5 satır · document_vorlagen:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `toggleStandortDay()` — [dashboard.js:10500](dashboard.js#L10500-L10520) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17640](dashboard.js#L17640-L17721) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:17723](dashboard.js#L17723-L17740) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `ensureBusinessCoords()` — [dashboard.js:23105](dashboard.js#L23105-L23134) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `services` — 5 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7722](dashboard.js#L7722-L7761) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:9683](dashboard.js#L9683-L9710) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `migratePodologieLegacyServices()` — [dashboard.js:9879](dashboard.js#L9879-L9914) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `renderServices()` — [dashboard.js:10146](dashboard.js#L10146-L10214) · 69 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17640](dashboard.js#L17640-L17721) · 82 satır · services:insert

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:3994](dashboard.js#L3994-L4090) · 97 satır · prescription_sessions:update

**Yol 2 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4585](dashboard.js#L4585-L4633) · 49 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7500](dashboard.js#L7500-L7518) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7533](dashboard.js#L7533-L7623) · 91 satır · prescription_sessions:update, prescription_sessions:insert

### `time_offs` — 4 bağımsız yazma yolu

**Yol 1 — `loadTeam()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadTeam()` — [dashboard.js:10825](dashboard.js#L10825-L11022) · 198 satır · time_offs:insert
- `openEmpDetail()` — [dashboard.js:11489](dashboard.js#L11489-L11686) · 198 satır · time_offs:insert

**Yol 2 — `deleteEmpTimeOff()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `deleteEmpTimeOff()` — [dashboard.js:11093](dashboard.js#L11093-L11107) · 15 satır · time_offs:delete

**Yol 3 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:11109](dashboard.js#L11109-L11136) · 28 satır · time_offs:insert

**Yol 4 — `deleteUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `deleteUrlaub()` — [dashboard.js:11167](dashboard.js#L11167-L11174) · 8 satır · time_offs:delete

### `employee_business_assignments` — 3 bağımsız yazma yolu

**Yol 1 — `renderOtherStandortEmps()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderOtherStandortEmps()` — [dashboard.js:11188](dashboard.js#L11188-L11273) · 86 satır · employee_business_assignments:upsert

**Yol 2 — `renderEmpStandortList()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderEmpStandortList()` — [dashboard.js:11335](dashboard.js#L11335-L11400) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete

**Yol 3 — `saveEmpPermissions()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `saveEmpPermissions()` — [dashboard.js:11436](dashboard.js#L11436-L11487) · 52 satır · employee_business_assignments:upsert

### `leads` — 3 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4635](dashboard.js#L4635-L4781) · 147 satır · leads:update

**Yol 2 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17118](dashboard.js#L17118-L17276) · 159 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:21758](dashboard.js#L21758-L21881) · 124 satır · leads:insert

### `aerzte` — 2 bağımsız yazma yolu

**Yol 1 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:16541](dashboard.js#L16541-L16548) · 8 satır · aerzte:delete

**Yol 2 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:16550](dashboard.js#L16550-L16595) · 46 satır · aerzte:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderHoursGrid()` — [dashboard.js:10524](dashboard.js#L10524-L10597) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:11780](dashboard.js#L11780-L11870) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `loadSettings()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Einstellungen · Sidebar → Team
- `loadSettings()` — [dashboard.js:12593](dashboard.js#L12593-L12709) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:609](kalender.js#L609-L631) · 23 satır · calendar_integrations:delete

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpServices()` — [dashboard.js:11872](dashboard.js#L11872-L11956) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · employee_services:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4274](dashboard.js#L4274-L4340) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4401](dashboard.js#L4401-L4493) · 93 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:15577](dashboard.js#L15577-L15666) · 90 satır · invoices:update, invoices:insert

**Yol 2 — `markiereRechnungBezahlt()`** · Ekran: _UI yolu çözülemedi_
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:49](module/rechnung-zahlung.js#L49-L56) · 8 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:288](admin.js#L288-L317) · 30 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · module_visibility:upsert

### `patient_consents` — 2 bağımsız yazma yolu

**Yol 1 — `speichereEinwilligung()`** · Ekran: _UI yolu çözülemedi_
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:295](module/patienten-einwilligung.js#L295-L333) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: _UI yolu çözülemedi_
- `widerrufen()` — [module/patienten-einwilligung.js:535](module/patienten-einwilligung.js#L535-L552) · 18 satır · patient_consents:update

### `user_preferences` — 2 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `saveUserPref()` — [dashboard.js:14786](dashboard.js#L14786-L14796) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:17802](dashboard.js#L17802-L17817) · 16 satır · user_preferences:upsert

### `vehicles` — 2 bağımsız yazma yolu

**Yol 1 — `saveQuickVehicleHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveQuickVehicleHandler()` — [dashboard.js:4251](dashboard.js#L4251-L4272) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:20858](dashboard.js#L20858-L20919) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:20961](dashboard.js#L20961-L20993) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `reportSidebarVisibility()` — [dashboard.js:906](dashboard.js#L906-L930) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:11780](dashboard.js#L11780-L11870) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

### `zuzahlung_befreiung` — 2 bağımsız yazma yolu

**Yol 1 — `wireBefreiungCard()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `wireBefreiungCard()` — [dashboard.js:8724](dashboard.js#L8724-L8763) · 40 satır · zuzahlung_befreiung:delete

**Yol 2 — `uploadRxNachweise()`** · Ekran: _UI yolu çözülemedi_
- `uploadRxNachweise()` — [dashboard.js:18711](dashboard.js#L18711-L18797) · 87 satır · zuzahlung_befreiung:update, zuzahlung_befreiung:insert

## En çok yazılan tablolar

- `profiles` — 18 ayrı fonksiyon yazıyor
- `bookings` — 9 ayrı fonksiyon yazıyor
- `document_vorlagen` — 9 ayrı fonksiyon yazıyor
- `prescriptions` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `services` — 7 ayrı fonksiyon yazıyor
- `businesses` — 5 ayrı fonksiyon yazıyor
- `time_offs` — 5 ayrı fonksiyon yazıyor
- `prescription_sessions` — 4 ayrı fonksiyon yazıyor
- `ops_finance_expenses` — 4 ayrı fonksiyon yazıyor
- `vehicles` — 3 ayrı fonksiyon yazıyor
- `leads` — 3 ayrı fonksiyon yazıyor
- `employee_business_assignments` — 3 ayrı fonksiyon yazıyor
- `employee_services` — 3 ayrı fonksiyon yazıyor
- `module_visibility` — 2 ayrı fonksiyon yazıyor
- `visibility_reports` — 2 ayrı fonksiyon yazıyor
- `fahrten` — 2 ayrı fonksiyon yazıyor
- `zuzahlung_befreiung` — 2 ayrı fonksiyon yazıyor
- `messreihen` — 2 ayrı fonksiyon yazıyor
- `breaks` — 2 ayrı fonksiyon yazıyor

## Aynı ada sahip birden fazla tanım

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:8 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:822 · module/abrechnungsstatus.js:390 · module/diagnosegruppen-regeln.js:30 · module/fussbefund.js:121 · module/kalender-raster.js:24 · module/termin-aktionen.js:37 · module/termin-druck.js:27
- `fmt` — dashboard.js:2854 · dashboard.js:3921 · dashboard.js:8696 · dashboard.js:10788 · dashboard.js:11079 · dashboard.js:11157 · dashboard.js:14874 · dashboard.js:15281 · dashboard.js:22689 · dashboard.js:22775 · dashboard.js:22853 · dashboard.js:22885 · dashboard.js:22945 · module/kalender-raster.js:52
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-freigabe.js:112 · module/arzt-register.js:125 · module/krankenkasse-suche.js:160 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:42 · module/verordnung-uebersicht.js:91 · module/zuzahlung-befreiung.js:261 · ops/app.js:51
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:13 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1329 · ops/app.js:84
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:12 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · dashboard.js:19425 · dashboard.js:21343 · dashboard.js:21484 · dashboard.js:21562
- `render` — calendar-widget.js:127 · dashboard.js:14234 · dashboard.js:22505 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:110
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:262 · api-backend/server.js:1203 · dashboard.js:3284
- `init` — attendance.js:297 · booking-request.js:1220 · booking.js:60 · cookie-consent.js:139 · dashboard.js:17865 · kalender.js:140 · onboarding.js:77
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/statistik.routes.js:18 · api-backend/billing/api/verordnung-status.routes.js:32 · api-backend/billing/api/warteliste.routes.js:21
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/verordnung-podo.js:105 · ops/app.js:48
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:319 · module/arzt-register.js:276 · module/zuzahlung-befreiung.js:150
- `cleanup` — dashboard.js:7055 · dashboard.js:7084 · dashboard.js:7160 · dashboard.js:7264 · dashboard.js:23278
- `g` — dashboard.js:16608 · dashboard.js:16621 · dashboard.js:16963 · dashboard.js:17029 · module/termin-aktionen.js:336
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:144
- `r2` — api-backend/billing/api/statistik.routes.js:189 · api-backend/billing/dta/builder.js:43 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14
- `loadServices` — booking-request.js:419 · booking.js:195 · dashboard.js:9663 · kalender.js:497
- `closeModal` — dashboard.js:1263 · dashboard.js:12770 · dashboard.js:13189 · ops/app.js:162
- `v` — dashboard.js:13694 · dashboard.js:13719 · dashboard.js:13739 · dashboard.js:17651
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1277 · module/kiosk.js:46
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/sync_heilmittel_katalog.js:109 · stripe-live-setup.js:80
- `q` — booking-request.js:84 · dashboard.js:20832 · script.js:751
- `loadTeam` — booking-request.js:517 · dashboard.js:10825 · kalender.js:194
- `initCalendar` — booking-request.js:566 · dashboard.js:2506 · kalender.js:244
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:577
- `onEsc` — dashboard.js:7271 · module/rechnung-leistung-picker.js:42 · module/zuzahlung-befreiung.js:155
- `norm` — dashboard.js:18031 · module/arzt-register.js:470 · ops/tools/regroup.mjs:59
- `reload` — ops/board.js:840 · ops/finance.js:1602 · ops/wissen.js:170
- `form` — ops/decisions.js:52 · ops/meetings.js:54 · ops/wissen.js:113
- `clearMsg` — admin-login.js:16 · login.js:167
- `allocate` — api-backend/ai/pii-mask.js:54 · api-backend/ai/pii-mask.js:114
- `unmask` — api-backend/ai/pii-mask.js:80 · api-backend/ai/pii-mask.js:160
- `buildUserMessage` — api-backend/ai/tasks/appointment-confirm-draft.js:31 · api-backend/ai/tasks/b2c-draft.js:22
- `normalizeIcd` — api-backend/ai/validators/icdDgRules.js:41 · icd-dg-match.js:40
- `parseIcdList` — api-backend/ai/validators/icdDgRules.js:59 · icd-dg-match.js:62
- `matchIcdToDg` — api-backend/ai/validators/icdDgRules.js:84 · icd-dg-match.js:78
