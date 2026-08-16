# Funktionskarte

> Üretim: 2026-08-16 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**1644 fonksiyon** · 148 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 8 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:4034](dashboard.js#L4034-L4130) · 97 satır · bookings:insert

**Yol 2 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4314](dashboard.js#L4314-L4380) · 67 satır · bookings:update

**Yol 3 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4397](dashboard.js#L4397-L4411) · 15 satır · bookings:update

**Yol 4 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4441](dashboard.js#L4441-L4533) · 93 satır · bookings:update

**Yol 5 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4535](dashboard.js#L4535-L4603) · 69 satır · bookings:update

**Yol 6 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4625](dashboard.js#L4625-L4673) · 49 satır · bookings:update

**Yol 7 — `initBkGroupPatientAutocomplete()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadGroupParticipants()` — [dashboard.js:5038](dashboard.js#L5038-L5102) · 65 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:5140](dashboard.js#L5140-L5261) · 122 satır · bookings:insert

**Yol 8 — `doMoveBooking()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `doMoveBooking()` — [dashboard.js:5644](dashboard.js#L5644-L5673) · 30 satır · bookings:update

### `prescriptions` — 8 bağımsız yazma yolu

**Yol 1 — `flipAbrechnungStatus()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `flipAbrechnungStatus()` — [dashboard.js:8755](dashboard.js#L8755-L8787) · 33 satır · prescriptions:update

**Yol 2 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [dashboard.js:16220](dashboard.js#L16220-L16295) · 76 satır · prescriptions:update

**Yol 3 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17647](dashboard.js#L17647-L17805) · 159 satır · prescriptions:insert

**Yol 4 — `renderAbrechnungReady()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungReady()` — [dashboard.js:20420](dashboard.js#L20420-L20649) · 230 satır · prescriptions:update

**Yol 5 — `renderAbrechnungHistory()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungHistory()` — [dashboard.js:20651](dashboard.js#L20651-L20738) · 88 satır · prescriptions:update

**Yol 6 — `triggerStorno()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Kassenbuch (physiotherapy/podologie/praxis) · Sidebar → Patienten · Sidebar → Team
- `triggerStorno()` — [dashboard.js:21740](dashboard.js#L21740-L21799) · 60 satır · prescriptions:update

**Yol 7 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L117) · 36 satır · prescriptions:update

**Yol 8 — `betragNullsetzen()`** · Ekran: _UI yolu çözülemedi_
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `profiles` — 8 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2253](dashboard.js#L2253-L2363) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5967](dashboard.js#L5967-L5993) · 27 satır · profiles:update

**Yol 3 — `openEmpDetail()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `openEmpDetail()` — [dashboard.js:11977](dashboard.js#L11977-L12174) · 198 satır · profiles:update

**Yol 4 — `bindPlan()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:14338](dashboard.js#L14338-L14344) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:14355](dashboard.js#L14355-L14368) · 14 satır · profiles:update
- `init()` — [kalender.js:140](kalender.js#L140-L191) · 52 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1325](module/fussbefund.js#L1325-L1389) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L149) · 35 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:364](onboarding.js#L364-L426) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:429](onboarding.js#L429-L489) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:433](onboarding.js#L433-L479) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:492](onboarding.js#L492-L518) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:799](onboarding.js#L799-L844) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:856](onboarding.js#L856-L1001) · 146 satır · profiles:update

**Yol 5 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:15047](dashboard.js#L15047-L15110) · 64 satır · profiles:insert

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [dashboard.js:17937](dashboard.js#L17937-L17979) · 43 satır · profiles:update

**Yol 7 — `initAnfragenPanel()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Termin-Anfragen · Sidebar → Patienten · Sidebar → Team
- `initAnfragenPanel()` — [dashboard.js:25492](dashboard.js#L25492-L25549) · 58 satır · profiles:update

**Yol 8 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:257](onboarding.js#L257-L261) · 5 satır · profiles:update

### `document_vorlagen` — 7 bağımsız yazma yolu

**Yol 1 — `openVorlagenAnsicht()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `openVorlagenAnsicht()` — [dashboard.js:13640](dashboard.js#L13640-L13711) · 72 satır · document_vorlagen:update
- `_enterAnsichtEditMode()` — [dashboard.js:13730](dashboard.js#L13730-L13794) · 65 satır · document_vorlagen:update

**Yol 2 — `saveVorlage()`** · Ekran: _UI yolu çözülemedi_
- `saveVorlage()` — [dashboard.js:13900](dashboard.js#L13900-L13928) · 29 satır · document_vorlagen:update, document_vorlagen:insert

**Yol 3 — `deleteVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `deleteVorlage()` — [dashboard.js:13930](dashboard.js#L13930-L13937) · 8 satır · document_vorlagen:delete

**Yol 4 — `duplicateVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `duplicateVorlage()` — [dashboard.js:13939](dashboard.js#L13939-L13953) · 15 satır · document_vorlagen:insert

**Yol 5 — `startVorlagenInlineRename()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `startVorlagenInlineRename()` — [dashboard.js:13955](dashboard.js#L13955-L13984) · 30 satır · document_vorlagen:update
- `commit()` — [dashboard.js:13962](dashboard.js#L13962-L13975) · 14 satır · document_vorlagen:update

**Yol 6 — `seedDefaultVorlagen()`** · Ekran: _UI yolu çözülemedi_
- `seedDefaultVorlagen()` — [dashboard.js:13998](dashboard.js#L13998-L14002) · 5 satır · document_vorlagen:insert

**Yol 7 — `seedMissingVorlagen()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `seedMissingVorlagen()` — [dashboard.js:14004](dashboard.js#L14004-L14008) · 5 satır · document_vorlagen:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `toggleStandortDay()` — [dashboard.js:10988](dashboard.js#L10988-L11008) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:18169](dashboard.js#L18169-L18250) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:18252](dashboard.js#L18252-L18269) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `ensureBusinessCoords()` — [dashboard.js:24924](dashboard.js#L24924-L24953) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:364](onboarding.js#L364-L426) · 63 satır · businesses:update, businesses:insert

### `services` — 5 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7806](dashboard.js#L7806-L7845) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:10171](dashboard.js#L10171-L10198) · 28 satır · services:insert
- `normName()` — [onboarding.js:566](onboarding.js#L566-L721) · 156 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:584](onboarding.js#L584-L721) · 138 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `migratePodologieLegacyServices()` — [dashboard.js:10367](dashboard.js#L10367-L10402) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `renderServices()` — [dashboard.js:10634](dashboard.js#L10634-L10702) · 69 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:18169](dashboard.js#L18169-L18250) · 82 satır · services:insert

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:4034](dashboard.js#L4034-L4130) · 97 satır · prescription_sessions:update

**Yol 2 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4625](dashboard.js#L4625-L4673) · 49 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7584](dashboard.js#L7584-L7602) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7617](dashboard.js#L7617-L7707) · 91 satır · prescription_sessions:update, prescription_sessions:insert

### `time_offs` — 4 bağımsız yazma yolu

**Yol 1 — `loadTeam()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadTeam()` — [dashboard.js:11313](dashboard.js#L11313-L11510) · 198 satır · time_offs:insert
- `openEmpDetail()` — [dashboard.js:11977](dashboard.js#L11977-L12174) · 198 satır · time_offs:insert

**Yol 2 — `deleteEmpTimeOff()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `deleteEmpTimeOff()` — [dashboard.js:11581](dashboard.js#L11581-L11595) · 15 satır · time_offs:delete

**Yol 3 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:11597](dashboard.js#L11597-L11624) · 28 satır · time_offs:insert

**Yol 4 — `deleteUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `deleteUrlaub()` — [dashboard.js:11655](dashboard.js#L11655-L11662) · 8 satır · time_offs:delete

### `employee_business_assignments` — 3 bağımsız yazma yolu

**Yol 1 — `renderOtherStandortEmps()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderOtherStandortEmps()` — [dashboard.js:11676](dashboard.js#L11676-L11761) · 86 satır · employee_business_assignments:upsert

**Yol 2 — `renderEmpStandortList()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderEmpStandortList()` — [dashboard.js:11823](dashboard.js#L11823-L11888) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete

**Yol 3 — `saveEmpPermissions()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `saveEmpPermissions()` — [dashboard.js:11924](dashboard.js#L11924-L11975) · 52 satır · employee_business_assignments:upsert

### `leads` — 3 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4675](dashboard.js#L4675-L4819) · 145 satır · leads:update

**Yol 2 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17647](dashboard.js#L17647-L17805) · 159 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:22315](dashboard.js#L22315-L22438) · 124 satır · leads:insert

### `user_preferences` — 3 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `saveUserPref()` — [dashboard.js:15273](dashboard.js#L15273-L15283) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:18331](dashboard.js#L18331-L18346) · 16 satır · user_preferences:upsert

**Yol 3 — `setActiveBusiness()`** · Ekran: _UI yolu çözülemedi_
- `setActiveBusiness()` — [lib/business.js:71](lib/business.js#L71-L94) · 24 satır · user_preferences:upsert

### `aerzte` — 2 bağımsız yazma yolu

**Yol 1 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:17028](dashboard.js#L17028-L17035) · 8 satır · aerzte:delete

**Yol 2 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:17037](dashboard.js#L17037-L17082) · 46 satır · aerzte:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderHoursGrid()` — [dashboard.js:11012](dashboard.js#L11012-L11085) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:12268](dashboard.js#L12268-L12358) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `loadSettings()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Einstellungen · Sidebar → Team
- `loadSettings()` — [dashboard.js:13081](dashboard.js#L13081-L13197) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:609](kalender.js#L609-L631) · 23 satır · calendar_integrations:delete

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpServices()` — [dashboard.js:12360](dashboard.js#L12360-L12444) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:566](onboarding.js#L566-L721) · 156 satır · employee_services:insert
- `syncServices()` — [onboarding.js:584](onboarding.js#L584-L721) · 138 satır · employee_services:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4314](dashboard.js#L4314-L4380) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4441](dashboard.js#L4441-L4533) · 93 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:16064](dashboard.js#L16064-L16153) · 90 satır · invoices:update, invoices:insert

**Yol 2 — `markiereRechnungBezahlt()`** · Ekran: _UI yolu çözülemedi_
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:49](module/rechnung-zahlung.js#L49-L56) · 8 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:288](admin.js#L288-L317) · 30 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · module_visibility:upsert

### `pat_fussbefund` — 2 bağımsız yazma yolu

**Yol 1 — `refreshFussbefundVerlauf()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `refreshFussbefundVerlauf()` — [dashboard.js:9193](dashboard.js#L9193-L9259) · 67 satır · pat_fussbefund:delete
- `saveFussbefund()` — [dashboard.js:9413](dashboard.js#L9413-L9464) · 52 satır · pat_fussbefund:update, pat_fussbefund:insert

**Yol 2 — `renderBefundListe()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Fußbefund (podologie) · Sidebar → Patienten · Sidebar → Team
- `speichern()` — [module/fussbefund.js:577](module/fussbefund.js#L577-L655) · 79 satır · pat_fussbefund:update, pat_fussbefund:insert
- `renderBefundListe()` — [module/fussbefund.js:695](module/fussbefund.js#L695-L774) · 80 satır · pat_fussbefund:delete

### `patient_consents` — 2 bağımsız yazma yolu

**Yol 1 — `speichereEinwilligung()`** · Ekran: _UI yolu çözülemedi_
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:295](module/patienten-einwilligung.js#L295-L333) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: _UI yolu çözülemedi_
- `widerrufen()` — [module/patienten-einwilligung.js:535](module/patienten-einwilligung.js#L535-L552) · 18 satır · patient_consents:update

### `vehicles` — 2 bağımsız yazma yolu

**Yol 1 — `saveQuickVehicleHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveQuickVehicleHandler()` — [dashboard.js:4291](dashboard.js#L4291-L4312) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:21415](dashboard.js#L21415-L21476) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:21518](dashboard.js#L21518-L21550) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `reportSidebarVisibility()` — [dashboard.js:894](dashboard.js#L894-L918) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:12268](dashboard.js#L12268-L12358) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:799](onboarding.js#L799-L844) · 46 satır · working_hours:delete, working_hours:insert

### `zuzahlung_befreiung` — 2 bağımsız yazma yolu

**Yol 1 — `wireBefreiungCard()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `wireBefreiungCard()` — [dashboard.js:8824](dashboard.js#L8824-L8863) · 40 satır · zuzahlung_befreiung:delete

**Yol 2 — `uploadRxNachweise()`** · Ekran: _UI yolu çözülemedi_
- `uploadRxNachweise()` — [dashboard.js:19240](dashboard.js#L19240-L19326) · 87 satır · zuzahlung_befreiung:update, zuzahlung_befreiung:insert

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
- `pat_fussbefund` — 4 ayrı fonksiyon yazıyor
- `ops_finance_expenses` — 4 ayrı fonksiyon yazıyor
- `vehicles` — 3 ayrı fonksiyon yazıyor
- `leads` — 3 ayrı fonksiyon yazıyor
- `employee_business_assignments` — 3 ayrı fonksiyon yazıyor
- `employee_services` — 3 ayrı fonksiyon yazıyor
- `user_preferences` — 3 ayrı fonksiyon yazıyor
- `module_visibility` — 2 ayrı fonksiyon yazıyor
- `visibility_reports` — 2 ayrı fonksiyon yazıyor
- `fahrten` — 2 ayrı fonksiyon yazıyor
- `zuzahlung_befreiung` — 2 ayrı fonksiyon yazıyor

## Aynı ada sahip birden fazla tanım

- `fmt` — dashboard.js:2849 · dashboard.js:3961 · dashboard.js:8796 · dashboard.js:11276 · dashboard.js:11567 · dashboard.js:11645 · dashboard.js:15361 · dashboard.js:15768 · dashboard.js:23278 · dashboard.js:23327 · dashboard.js:23391 · dashboard.js:23469 · dashboard.js:23501 · dashboard.js:23561 · module/kalender-raster.js:52
- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:8 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:810 · module/abrechnungsstatus.js:390 · module/fussbefund.js:121 · module/kalender-raster.js:24 · module/termin-aktionen.js:37 · module/termin-druck.js:27
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:13 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1305 · ops/app.js:84
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:12 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · dashboard.js:19954 · dashboard.js:21900 · dashboard.js:22041 · dashboard.js:22119
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/arzt-register.js:125 · module/krankenkasse-suche.js:160 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:41 · module/zuzahlung-befreiung.js:261 · ops/app.js:51
- `render` — calendar-widget.js:127 · dashboard.js:14721 · dashboard.js:23094 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:108
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:262 · api-backend/server.js:1181 · dashboard.js:3259
- `init` — attendance.js:297 · booking-request.js:1220 · booking.js:60 · cookie-consent.js:52 · dashboard.js:18394 · kalender.js:140 · onboarding.js:77
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/statistik.routes.js:18 · api-backend/billing/api/verordnung-status.routes.js:32 · api-backend/billing/api/warteliste.routes.js:21
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/verordnung-podo.js:105 · ops/app.js:48
- `cleanup` — dashboard.js:7132 · dashboard.js:7161 · dashboard.js:7237 · dashboard.js:7348 · dashboard.js:25097
- `g` — dashboard.js:17095 · dashboard.js:17108 · dashboard.js:17450 · dashboard.js:17516 · module/termin-aktionen.js:339
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:143
- `r2` — api-backend/billing/api/statistik.routes.js:189 · api-backend/billing/dta/builder.js:43 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14
- `loadServices` — booking-request.js:419 · booking.js:195 · dashboard.js:10151 · kalender.js:497
- `closeModal` — dashboard.js:1239 · dashboard.js:13258 · dashboard.js:13677 · ops/app.js:162
- `v` — dashboard.js:14182 · dashboard.js:14207 · dashboard.js:14226 · dashboard.js:18180
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1253 · module/kiosk.js:46
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/sync_heilmittel_katalog.js:109 · stripe-live-setup.js:75
- `q` — booking-request.js:84 · dashboard.js:21389 · script.js:751
- `loadTeam` — booking-request.js:517 · dashboard.js:11313 · kalender.js:194
- `initCalendar` — booking-request.js:566 · dashboard.js:2507 · kalender.js:244
- `renderList` — dashboard.js:5370 · dashboard.js:14820 · ops/finance.js:774
- `onEsc` — dashboard.js:7355 · module/rechnung-leistung-picker.js:42 · module/zuzahlung-befreiung.js:155
- `getCb` — dashboard.js:9262 · dashboard.js:9353 · module/fussbefund.js:151
- `norm` — dashboard.js:18560 · module/arzt-register.js:470 · ops/tools/regroup.mjs:59
- `schliessen` — module/abrechnungsstatus.js:319 · module/arzt-register.js:276 · module/zuzahlung-befreiung.js:150
- `reload` — ops/board.js:840 · ops/finance.js:1602 · ops/wissen.js:170
- `form` — ops/decisions.js:52 · ops/meetings.js:54 · ops/wissen.js:113
- `clearMsg` — admin-login.js:16 · login.js:167
- `allocate` — api-backend/ai/pii-mask.js:54 · api-backend/ai/pii-mask.js:114
- `unmask` — api-backend/ai/pii-mask.js:80 · api-backend/ai/pii-mask.js:160
- `buildUserMessage` — api-backend/ai/tasks/appointment-confirm-draft.js:31 · api-backend/ai/tasks/b2c-draft.js:22
- `normalizeIcd` — api-backend/ai/validators/icdDgRules.js:41 · icd-dg-match.js:40
- `parseIcdList` — api-backend/ai/validators/icdDgRules.js:59 · icd-dg-match.js:62
