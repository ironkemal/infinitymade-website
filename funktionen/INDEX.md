# Funktionskarte

> Üretim: 2026-08-15 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**1501 fonksiyon** · 132 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 9 bağımsız yazma yolu

**Yol 1 — `openBookingActionModal()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `openBookingActionModal()` — [dashboard.js:3268](dashboard.js#L3268-L3561) · 294 satır · bookings:update

**Yol 2 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:4067](dashboard.js#L4067-L4163) · 97 satır · bookings:insert

**Yol 3 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4347](dashboard.js#L4347-L4413) · 67 satır · bookings:update

**Yol 4 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4430](dashboard.js#L4430-L4444) · 15 satır · bookings:update

**Yol 5 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4474](dashboard.js#L4474-L4566) · 93 satır · bookings:update

**Yol 6 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4568](dashboard.js#L4568-L4635) · 68 satır · bookings:update

**Yol 7 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4657](dashboard.js#L4657-L4705) · 49 satır · bookings:update

**Yol 8 — `initBkGroupPatientAutocomplete()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `loadGroupParticipants()` — [dashboard.js:5070](dashboard.js#L5070-L5134) · 65 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:5172](dashboard.js#L5172-L5293) · 122 satır · bookings:insert

**Yol 9 — `doMoveBooking()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `doMoveBooking()` — [dashboard.js:5697](dashboard.js#L5697-L5726) · 30 satır · bookings:update

### `prescriptions` — 9 bağımsız yazma yolu

**Yol 1 — `openBookingActionModal()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `openBookingActionModal()` — [dashboard.js:3268](dashboard.js#L3268-L3561) · 294 satır · prescriptions:update

**Yol 2 — `flipAbrechnungStatus()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `flipAbrechnungStatus()` — [dashboard.js:8705](dashboard.js#L8705-L8737) · 33 satır · prescriptions:update

**Yol 3 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [dashboard.js:16286](dashboard.js#L16286-L16361) · 76 satır · prescriptions:update

**Yol 4 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17720](dashboard.js#L17720-L17882) · 163 satır · prescriptions:insert

**Yol 5 — `renderAbrechnungReady()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungReady()` — [dashboard.js:20511](dashboard.js#L20511-L20740) · 230 satır · prescriptions:update

**Yol 6 — `renderAbrechnungHistory()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungHistory()` — [dashboard.js:20742](dashboard.js#L20742-L20829) · 88 satır · prescriptions:update

**Yol 7 — `triggerStorno()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `triggerStorno()` — [dashboard.js:21831](dashboard.js#L21831-L21890) · 60 satır · prescriptions:update

**Yol 8 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:65](module/sitzungsfortschritt.js#L65-L100) · 36 satır · prescriptions:update

**Yol 9 — `betragNullsetzen()`** · Ekran: _UI yolu çözülemedi_
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `profiles` — 8 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2215](dashboard.js#L2215-L2325) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:6020](dashboard.js#L6020-L6046) · 27 satır · profiles:update

**Yol 3 — `openEmpDetail()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `openEmpDetail()` — [dashboard.js:11927](dashboard.js#L11927-L12124) · 198 satır · profiles:update

**Yol 4 — `bindPlan()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:14350](dashboard.js#L14350-L14356) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:14367](dashboard.js#L14367-L14380) · 14 satır · profiles:update
- `init()` — [kalender.js:140](kalender.js#L140-L191) · 52 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1320](module/fussbefund.js#L1320-L1384) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L149) · 35 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:364](onboarding.js#L364-L426) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:429](onboarding.js#L429-L489) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:433](onboarding.js#L433-L479) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:492](onboarding.js#L492-L518) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:799](onboarding.js#L799-L844) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:856](onboarding.js#L856-L1001) · 146 satır · profiles:update

**Yol 5 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:15059](dashboard.js#L15059-L15122) · 64 satır · profiles:insert

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [dashboard.js:18014](dashboard.js#L18014-L18056) · 43 satır · profiles:update

**Yol 7 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:25558](dashboard.js#L25558-L25615) · 58 satır · profiles:update

**Yol 8 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:257](onboarding.js#L257-L261) · 5 satır · profiles:update

### `document_vorlagen` — 7 bağımsız yazma yolu

**Yol 1 — `openVorlagenAnsicht()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `openVorlagenAnsicht()` — [dashboard.js:13652](dashboard.js#L13652-L13723) · 72 satır · document_vorlagen:update
- `_enterAnsichtEditMode()` — [dashboard.js:13742](dashboard.js#L13742-L13806) · 65 satır · document_vorlagen:update

**Yol 2 — `saveVorlage()`** · Ekran: _UI yolu çözülemedi_
- `saveVorlage()` — [dashboard.js:13912](dashboard.js#L13912-L13940) · 29 satır · document_vorlagen:update, document_vorlagen:insert

**Yol 3 — `deleteVorlage()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `deleteVorlage()` — [dashboard.js:13942](dashboard.js#L13942-L13949) · 8 satır · document_vorlagen:delete

**Yol 4 — `duplicateVorlage()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `duplicateVorlage()` — [dashboard.js:13951](dashboard.js#L13951-L13965) · 15 satır · document_vorlagen:insert

**Yol 5 — `startVorlagenInlineRename()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `startVorlagenInlineRename()` — [dashboard.js:13967](dashboard.js#L13967-L13996) · 30 satır · document_vorlagen:update
- `commit()` — [dashboard.js:13974](dashboard.js#L13974-L13987) · 14 satır · document_vorlagen:update

**Yol 6 — `seedDefaultVorlagen()`** · Ekran: _UI yolu çözülemedi_
- `seedDefaultVorlagen()` — [dashboard.js:14010](dashboard.js#L14010-L14014) · 5 satır · document_vorlagen:insert

**Yol 7 — `seedMissingVorlagen()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `seedMissingVorlagen()` — [dashboard.js:14016](dashboard.js#L14016-L14020) · 5 satır · document_vorlagen:insert

### `prescription_sessions` — 6 bağımsız yazma yolu

**Yol 1 — `openBookingActionModal()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `openBookingActionModal()` — [dashboard.js:3268](dashboard.js#L3268-L3561) · 294 satır · prescription_sessions:update

**Yol 2 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:4067](dashboard.js#L4067-L4163) · 97 satır · prescription_sessions:update

**Yol 3 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4657](dashboard.js#L4657-L4705) · 49 satır · prescription_sessions:update

**Yol 4 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7567](dashboard.js#L7567-L7585) · 19 satır · prescription_sessions:update

**Yol 5 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7600](dashboard.js#L7600-L7681) · 82 satır · prescription_sessions:update, prescription_sessions:insert

**Yol 6 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17720](dashboard.js#L17720-L17882) · 163 satır · prescription_sessions:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `toggleStandortDay()` — [dashboard.js:10938](dashboard.js#L10938-L10958) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:18246](dashboard.js#L18246-L18327) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:18329](dashboard.js#L18329-L18346) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `ensureBusinessCoords()` — [dashboard.js:24990](dashboard.js#L24990-L25019) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:364](onboarding.js#L364-L426) · 63 satır · businesses:update, businesses:insert

### `services` — 5 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7780](dashboard.js#L7780-L7819) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:10121](dashboard.js#L10121-L10148) · 28 satır · services:insert
- `normName()` — [onboarding.js:566](onboarding.js#L566-L721) · 156 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:584](onboarding.js#L584-L721) · 138 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:10317](dashboard.js#L10317-L10352) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `renderServices()` — [dashboard.js:10584](dashboard.js#L10584-L10652) · 69 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:18246](dashboard.js#L18246-L18327) · 82 satır · services:insert

### `time_offs` — 4 bağımsız yazma yolu

**Yol 1 — `loadTeam()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `loadTeam()` — [dashboard.js:11263](dashboard.js#L11263-L11460) · 198 satır · time_offs:insert
- `openEmpDetail()` — [dashboard.js:11927](dashboard.js#L11927-L12124) · 198 satır · time_offs:insert

**Yol 2 — `deleteEmpTimeOff()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `deleteEmpTimeOff()` — [dashboard.js:11531](dashboard.js#L11531-L11545) · 15 satır · time_offs:delete

**Yol 3 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:11547](dashboard.js#L11547-L11574) · 28 satır · time_offs:insert

**Yol 4 — `deleteUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `deleteUrlaub()` — [dashboard.js:11605](dashboard.js#L11605-L11612) · 8 satır · time_offs:delete

### `employee_business_assignments` — 3 bağımsız yazma yolu

**Yol 1 — `renderOtherStandortEmps()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderOtherStandortEmps()` — [dashboard.js:11626](dashboard.js#L11626-L11711) · 86 satır · employee_business_assignments:upsert

**Yol 2 — `renderEmpStandortList()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderEmpStandortList()` — [dashboard.js:11773](dashboard.js#L11773-L11838) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete

**Yol 3 — `saveEmpPermissions()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `saveEmpPermissions()` — [dashboard.js:11874](dashboard.js#L11874-L11925) · 52 satır · employee_business_assignments:upsert

### `leads` — 3 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4707](dashboard.js#L4707-L4851) · 145 satır · leads:update

**Yol 2 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17720](dashboard.js#L17720-L17882) · 163 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:22406](dashboard.js#L22406-L22529) · 124 satır · leads:insert

### `user_preferences` — 3 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `saveUserPref()` — [dashboard.js:15285](dashboard.js#L15285-L15295) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:18408](dashboard.js#L18408-L18423) · 16 satır · user_preferences:upsert

**Yol 3 — `setActiveBusiness()`** · Ekran: _UI yolu çözülemedi_
- `setActiveBusiness()` — [lib/business.js:71](lib/business.js#L71-L94) · 24 satır · user_preferences:upsert

### `aerzte` — 2 bağımsız yazma yolu

**Yol 1 — `deleteAerzte()`** · Ekran: ortak yardımcı — 7 modülden çağrılıyor
- `deleteAerzte()` — [dashboard.js:17101](dashboard.js#L17101-L17108) · 8 satır · aerzte:delete

**Yol 2 — `editAerzte()`** · Ekran: ortak yardımcı — 7 modülden çağrılıyor
- `editAerzte()` — [dashboard.js:17110](dashboard.js#L17110-L17155) · 46 satır · aerzte:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderHoursGrid()` — [dashboard.js:10962](dashboard.js#L10962-L11035) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:12218](dashboard.js#L12218-L12308) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `loadSettings()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `loadSettings()` — [dashboard.js:13093](dashboard.js#L13093-L13209) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:609](kalender.js#L609-L631) · 23 satır · calendar_integrations:delete

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `loadEmpServices()` — [dashboard.js:12310](dashboard.js#L12310-L12394) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:566](onboarding.js#L566-L721) · 156 satır · employee_services:insert
- `syncServices()` — [onboarding.js:584](onboarding.js#L584-L721) · 138 satır · employee_services:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4347](dashboard.js#L4347-L4413) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4474](dashboard.js#L4474-L4566) · 93 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:16163](dashboard.js#L16163-L16219) · 57 satır · invoices:insert

**Yol 2 — `markiereRechnungBezahlt()`** · Ekran: _UI yolu çözülemedi_
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:49](module/rechnung-zahlung.js#L49-L56) · 8 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:288](admin.js#L288-L317) · 30 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · module_visibility:upsert

### `pat_fussbefund` — 2 bağımsız yazma yolu

**Yol 1 — `refreshFussbefundVerlauf()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `refreshFussbefundVerlauf()` — [dashboard.js:9143](dashboard.js#L9143-L9209) · 67 satır · pat_fussbefund:delete
- `saveFussbefund()` — [dashboard.js:9363](dashboard.js#L9363-L9414) · 52 satır · pat_fussbefund:update, pat_fussbefund:insert

**Yol 2 — `renderBefundListe()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `speichern()` — [module/fussbefund.js:572](module/fussbefund.js#L572-L650) · 79 satır · pat_fussbefund:update, pat_fussbefund:insert
- `renderBefundListe()` — [module/fussbefund.js:690](module/fussbefund.js#L690-L769) · 80 satır · pat_fussbefund:delete

### `patient_consents` — 2 bağımsız yazma yolu

**Yol 1 — `speichereEinwilligung()`** · Ekran: _UI yolu çözülemedi_
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:295](module/patienten-einwilligung.js#L295-L333) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: _UI yolu çözülemedi_
- `widerrufen()` — [module/patienten-einwilligung.js:535](module/patienten-einwilligung.js#L535-L552) · 18 satır · patient_consents:update

### `vehicles` — 2 bağımsız yazma yolu

**Yol 1 — `saveQuickVehicleHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveQuickVehicleHandler()` — [dashboard.js:4324](dashboard.js#L4324-L4345) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 6 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:21506](dashboard.js#L21506-L21567) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:21609](dashboard.js#L21609-L21641) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `reportSidebarVisibility()` — [dashboard.js:870](dashboard.js#L870-L894) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:12218](dashboard.js#L12218-L12308) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:799](onboarding.js#L799-L844) · 46 satır · working_hours:delete, working_hours:insert

### `zuzahlung_befreiung` — 2 bağımsız yazma yolu

**Yol 1 — `wireBefreiungCard()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `wireBefreiungCard()` — [dashboard.js:8774](dashboard.js#L8774-L8813) · 40 satır · zuzahlung_befreiung:delete

**Yol 2 — `uploadRxNachweise()`** · Ekran: _UI yolu çözülemedi_
- `uploadRxNachweise()` — [dashboard.js:19331](dashboard.js#L19331-L19417) · 87 satır · zuzahlung_befreiung:update, zuzahlung_befreiung:insert

## En çok yazılan tablolar

- `profiles` — 18 ayrı fonksiyon yazıyor
- `bookings` — 10 ayrı fonksiyon yazıyor
- `prescriptions` — 9 ayrı fonksiyon yazıyor
- `document_vorlagen` — 9 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `services` — 7 ayrı fonksiyon yazıyor
- `prescription_sessions` — 6 ayrı fonksiyon yazıyor
- `businesses` — 5 ayrı fonksiyon yazıyor
- `time_offs` — 5 ayrı fonksiyon yazıyor
- `pat_fussbefund` — 4 ayrı fonksiyon yazıyor
- `vehicles` — 3 ayrı fonksiyon yazıyor
- `leads` — 3 ayrı fonksiyon yazıyor
- `employee_business_assignments` — 3 ayrı fonksiyon yazıyor
- `employee_services` — 3 ayrı fonksiyon yazıyor
- `user_preferences` — 3 ayrı fonksiyon yazıyor
- `module_visibility` — 2 ayrı fonksiyon yazıyor
- `visibility_reports` — 2 ayrı fonksiyon yazıyor
- `fahrten` — 2 ayrı fonksiyon yazıyor
- `zuzahlung_befreiung` — 2 ayrı fonksiyon yazıyor
- `messreihen` — 2 ayrı fonksiyon yazıyor

## Aynı ada sahip birden fazla tanım

- `fmt` — dashboard.js:2809 · dashboard.js:3994 · dashboard.js:8746 · dashboard.js:11226 · dashboard.js:11517 · dashboard.js:11595 · dashboard.js:15373 · dashboard.js:15779 · dashboard.js:23368 · dashboard.js:23417 · dashboard.js:23481 · dashboard.js:23559 · dashboard.js:23591 · dashboard.js:23651
- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:8 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:786 · module/abrechnungsstatus.js:390 · module/fussbefund.js:121
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:13 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1281 · ops/app.js:84
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:12 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · dashboard.js:20045 · dashboard.js:21991 · dashboard.js:22132 · dashboard.js:22210
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/krankenkasse-suche.js:160 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:39 · module/zuzahlung-befreiung.js:261 · ops/app.js:51
- `render` — calendar-widget.js:127 · dashboard.js:14733 · dashboard.js:23184 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:108
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:261 · api-backend/server.js:1173 · dashboard.js:3209
- `init` — attendance.js:297 · booking-request.js:1220 · booking.js:60 · cookie-consent.js:52 · dashboard.js:18471 · kalender.js:140 · onboarding.js:77
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/statistik.routes.js:18 · api-backend/billing/api/verordnung-status.routes.js:32 · api-backend/billing/api/warteliste.routes.js:21
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/verordnung-podo.js:105 · ops/app.js:48
- `cleanup` — dashboard.js:7117 · dashboard.js:7146 · dashboard.js:7222 · dashboard.js:7331 · dashboard.js:25163
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:122
- `r2` — api-backend/billing/api/statistik.routes.js:189 · api-backend/billing/dta/builder.js:43 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14
- `loadServices` — booking-request.js:419 · booking.js:195 · dashboard.js:10101 · kalender.js:497
- `closeModal` — dashboard.js:1215 · dashboard.js:13270 · dashboard.js:13689 · ops/app.js:162
- `v` — dashboard.js:14194 · dashboard.js:14219 · dashboard.js:14238 · dashboard.js:18257
- `g` — dashboard.js:17168 · dashboard.js:17181 · dashboard.js:17523 · dashboard.js:17589
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1229 · module/kiosk.js:46
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/sync_heilmittel_katalog.js:109 · stripe-live-setup.js:75
- `q` — booking-request.js:84 · dashboard.js:21480 · script.js:751
- `loadTeam` — booking-request.js:517 · dashboard.js:11263 · kalender.js:194
- `initCalendar` — booking-request.js:566 · dashboard.js:2470 · kalender.js:244
- `getCb` — dashboard.js:9212 · dashboard.js:9303 · module/fussbefund.js:151
- `form` — ops/decisions.js:52 · ops/meetings.js:54 · ops/wissen.js:113
- `clearMsg` — admin-login.js:16 · login.js:167
- `allocate` — api-backend/ai/pii-mask.js:54 · api-backend/ai/pii-mask.js:114
- `unmask` — api-backend/ai/pii-mask.js:80 · api-backend/ai/pii-mask.js:160
- `buildUserMessage` — api-backend/ai/tasks/appointment-confirm-draft.js:31 · api-backend/ai/tasks/b2c-draft.js:22
- `normalizeIcd` — api-backend/ai/validators/icdDgRules.js:41 · icd-dg-match.js:40
- `parseIcdList` — api-backend/ai/validators/icdDgRules.js:59 · icd-dg-match.js:62
- `matchIcdToDg` — api-backend/ai/validators/icdDgRules.js:84 · icd-dg-match.js:78
- `dgsAcceptingIcd` — api-backend/ai/validators/icdDgRules.js:157 · icd-dg-match.js:129
- `autoSelectDg` — api-backend/ai/validators/icdDgRules.js:169 · icd-dg-match.js:141
- `soleIcdForDg` — api-backend/ai/validators/icdDgRules.js:205 · icd-dg-match.js:167
- `daysBetween` — api-backend/ai/validators/standardRules.js:46 · api-backend/billing/utils/tarifsplitting.js:138
