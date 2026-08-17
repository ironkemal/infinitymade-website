# Funktionskarte

> Üretim: 2026-08-17 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**1663 fonksiyon** · 152 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 8 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:3993](dashboard.js#L3993-L4089) · 97 satır · bookings:insert

**Yol 2 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4273](dashboard.js#L4273-L4339) · 67 satır · bookings:update

**Yol 3 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4356](dashboard.js#L4356-L4370) · 15 satır · bookings:update

**Yol 4 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4400](dashboard.js#L4400-L4492) · 93 satır · bookings:update

**Yol 5 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4494](dashboard.js#L4494-L4562) · 69 satır · bookings:update

**Yol 6 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4584](dashboard.js#L4584-L4632) · 49 satır · bookings:update

**Yol 7 — `initBkGroupPatientAutocomplete()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadGroupParticipants()` — [dashboard.js:4997](dashboard.js#L4997-L5061) · 65 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:5099](dashboard.js#L5099-L5220) · 122 satır · bookings:insert

**Yol 8 — `doMoveBooking()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `doMoveBooking()` — [dashboard.js:5556](dashboard.js#L5556-L5585) · 30 satır · bookings:update

### `prescriptions` — 8 bağımsız yazma yolu

**Yol 1 — `flipAbrechnungStatus()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `flipAbrechnungStatus()` — [dashboard.js:8666](dashboard.js#L8666-L8698) · 33 satır · prescriptions:update

**Yol 2 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [dashboard.js:16131](dashboard.js#L16131-L16206) · 76 satır · prescriptions:update

**Yol 3 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17516](dashboard.js#L17516-L17674) · 159 satır · prescriptions:insert

**Yol 4 — `renderAbrechnungReady()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungReady()` — [dashboard.js:20289](dashboard.js#L20289-L20518) · 230 satır · prescriptions:update

**Yol 5 — `renderAbrechnungHistory()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungHistory()` — [dashboard.js:20520](dashboard.js#L20520-L20607) · 88 satır · prescriptions:update

**Yol 6 — `triggerStorno()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Kassenbuch (physiotherapy/podologie/praxis) · Sidebar → Patienten · Sidebar → Team
- `triggerStorno()` — [dashboard.js:21609](dashboard.js#L21609-L21668) · 60 satır · prescriptions:update

**Yol 7 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L117) · 36 satır · prescriptions:update

**Yol 8 — `betragNullsetzen()`** · Ekran: _UI yolu çözülemedi_
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `profiles` — 8 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2257](dashboard.js#L2257-L2367) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5879](dashboard.js#L5879-L5905) · 27 satır · profiles:update

**Yol 3 — `openEmpDetail()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `openEmpDetail()` — [dashboard.js:11888](dashboard.js#L11888-L12085) · 198 satır · profiles:update

**Yol 4 — `bindPlan()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:14249](dashboard.js#L14249-L14255) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:14266](dashboard.js#L14266-L14279) · 14 satır · profiles:update
- `init()` — [kalender.js:140](kalender.js#L140-L191) · 52 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1347](module/fussbefund.js#L1347-L1411) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L149) · 35 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:364](onboarding.js#L364-L426) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:429](onboarding.js#L429-L489) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:433](onboarding.js#L433-L479) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:492](onboarding.js#L492-L518) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:799](onboarding.js#L799-L844) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:856](onboarding.js#L856-L1001) · 146 satır · profiles:update

**Yol 5 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:14958](dashboard.js#L14958-L15021) · 64 satır · profiles:insert

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [dashboard.js:17806](dashboard.js#L17806-L17848) · 43 satır · profiles:update

**Yol 7 — `initAnfragenPanel()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Termin-Anfragen · Sidebar → Patienten · Sidebar → Team
- `initAnfragenPanel()` — [dashboard.js:25336](dashboard.js#L25336-L25393) · 58 satır · profiles:update

**Yol 8 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:257](onboarding.js#L257-L261) · 5 satır · profiles:update

### `document_vorlagen` — 7 bağımsız yazma yolu

**Yol 1 — `openVorlagenAnsicht()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `openVorlagenAnsicht()` — [dashboard.js:13551](dashboard.js#L13551-L13622) · 72 satır · document_vorlagen:update
- `_enterAnsichtEditMode()` — [dashboard.js:13641](dashboard.js#L13641-L13705) · 65 satır · document_vorlagen:update

**Yol 2 — `saveVorlage()`** · Ekran: _UI yolu çözülemedi_
- `saveVorlage()` — [dashboard.js:13811](dashboard.js#L13811-L13839) · 29 satır · document_vorlagen:update, document_vorlagen:insert

**Yol 3 — `deleteVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `deleteVorlage()` — [dashboard.js:13841](dashboard.js#L13841-L13848) · 8 satır · document_vorlagen:delete

**Yol 4 — `duplicateVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `duplicateVorlage()` — [dashboard.js:13850](dashboard.js#L13850-L13864) · 15 satır · document_vorlagen:insert

**Yol 5 — `startVorlagenInlineRename()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `startVorlagenInlineRename()` — [dashboard.js:13866](dashboard.js#L13866-L13895) · 30 satır · document_vorlagen:update
- `commit()` — [dashboard.js:13873](dashboard.js#L13873-L13886) · 14 satır · document_vorlagen:update

**Yol 6 — `seedDefaultVorlagen()`** · Ekran: _UI yolu çözülemedi_
- `seedDefaultVorlagen()` — [dashboard.js:13909](dashboard.js#L13909-L13913) · 5 satır · document_vorlagen:insert

**Yol 7 — `seedMissingVorlagen()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `seedMissingVorlagen()` — [dashboard.js:13915](dashboard.js#L13915-L13919) · 5 satır · document_vorlagen:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `toggleStandortDay()` — [dashboard.js:10899](dashboard.js#L10899-L10919) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:18038](dashboard.js#L18038-L18119) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:18121](dashboard.js#L18121-L18138) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `ensureBusinessCoords()` — [dashboard.js:24768](dashboard.js#L24768-L24797) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:364](onboarding.js#L364-L426) · 63 satır · businesses:update, businesses:insert

### `services` — 5 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7726](dashboard.js#L7726-L7765) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:10082](dashboard.js#L10082-L10109) · 28 satır · services:insert
- `normName()` — [onboarding.js:566](onboarding.js#L566-L721) · 156 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:584](onboarding.js#L584-L721) · 138 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `migratePodologieLegacyServices()` — [dashboard.js:10278](dashboard.js#L10278-L10313) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `renderServices()` — [dashboard.js:10545](dashboard.js#L10545-L10613) · 69 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:18038](dashboard.js#L18038-L18119) · 82 satır · services:insert

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:3993](dashboard.js#L3993-L4089) · 97 satır · prescription_sessions:update

**Yol 2 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4584](dashboard.js#L4584-L4632) · 49 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7504](dashboard.js#L7504-L7522) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7537](dashboard.js#L7537-L7627) · 91 satır · prescription_sessions:update, prescription_sessions:insert

### `time_offs` — 4 bağımsız yazma yolu

**Yol 1 — `loadTeam()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadTeam()` — [dashboard.js:11224](dashboard.js#L11224-L11421) · 198 satır · time_offs:insert
- `openEmpDetail()` — [dashboard.js:11888](dashboard.js#L11888-L12085) · 198 satır · time_offs:insert

**Yol 2 — `deleteEmpTimeOff()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `deleteEmpTimeOff()` — [dashboard.js:11492](dashboard.js#L11492-L11506) · 15 satır · time_offs:delete

**Yol 3 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:11508](dashboard.js#L11508-L11535) · 28 satır · time_offs:insert

**Yol 4 — `deleteUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `deleteUrlaub()` — [dashboard.js:11566](dashboard.js#L11566-L11573) · 8 satır · time_offs:delete

### `employee_business_assignments` — 3 bağımsız yazma yolu

**Yol 1 — `renderOtherStandortEmps()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderOtherStandortEmps()` — [dashboard.js:11587](dashboard.js#L11587-L11672) · 86 satır · employee_business_assignments:upsert

**Yol 2 — `renderEmpStandortList()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderEmpStandortList()` — [dashboard.js:11734](dashboard.js#L11734-L11799) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete

**Yol 3 — `saveEmpPermissions()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `saveEmpPermissions()` — [dashboard.js:11835](dashboard.js#L11835-L11886) · 52 satır · employee_business_assignments:upsert

### `leads` — 3 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4634](dashboard.js#L4634-L4778) · 145 satır · leads:update

**Yol 2 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17516](dashboard.js#L17516-L17674) · 159 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:22184](dashboard.js#L22184-L22307) · 124 satır · leads:insert

### `user_preferences` — 3 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `saveUserPref()` — [dashboard.js:15184](dashboard.js#L15184-L15194) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:18200](dashboard.js#L18200-L18215) · 16 satır · user_preferences:upsert

**Yol 3 — `setActiveBusiness()`** · Ekran: _UI yolu çözülemedi_
- `setActiveBusiness()` — [lib/business.js:71](lib/business.js#L71-L94) · 24 satır · user_preferences:upsert

### `aerzte` — 2 bağımsız yazma yolu

**Yol 1 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:16939](dashboard.js#L16939-L16946) · 8 satır · aerzte:delete

**Yol 2 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:16948](dashboard.js#L16948-L16993) · 46 satır · aerzte:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderHoursGrid()` — [dashboard.js:10923](dashboard.js#L10923-L10996) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:12179](dashboard.js#L12179-L12269) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `loadSettings()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Einstellungen · Sidebar → Team
- `loadSettings()` — [dashboard.js:12992](dashboard.js#L12992-L13108) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:609](kalender.js#L609-L631) · 23 satır · calendar_integrations:delete

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpServices()` — [dashboard.js:12271](dashboard.js#L12271-L12355) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:566](onboarding.js#L566-L721) · 156 satır · employee_services:insert
- `syncServices()` — [onboarding.js:584](onboarding.js#L584-L721) · 138 satır · employee_services:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4273](dashboard.js#L4273-L4339) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4400](dashboard.js#L4400-L4492) · 93 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:15975](dashboard.js#L15975-L16064) · 90 satır · invoices:update, invoices:insert

**Yol 2 — `markiereRechnungBezahlt()`** · Ekran: _UI yolu çözülemedi_
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:49](module/rechnung-zahlung.js#L49-L56) · 8 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:288](admin.js#L288-L317) · 30 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · module_visibility:upsert

### `pat_fussbefund` — 2 bağımsız yazma yolu

**Yol 1 — `refreshFussbefundVerlauf()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `refreshFussbefundVerlauf()` — [dashboard.js:9104](dashboard.js#L9104-L9170) · 67 satır · pat_fussbefund:delete
- `saveFussbefund()` — [dashboard.js:9324](dashboard.js#L9324-L9375) · 52 satır · pat_fussbefund:update, pat_fussbefund:insert

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
- `saveQuickVehicleHandler()` — [dashboard.js:4250](dashboard.js#L4250-L4271) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:21284](dashboard.js#L21284-L21345) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:21387](dashboard.js#L21387-L21419) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `reportSidebarVisibility()` — [dashboard.js:898](dashboard.js#L898-L922) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:12179](dashboard.js#L12179-L12269) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:799](onboarding.js#L799-L844) · 46 satır · working_hours:delete, working_hours:insert

### `zuzahlung_befreiung` — 2 bağımsız yazma yolu

**Yol 1 — `wireBefreiungCard()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `wireBefreiungCard()` — [dashboard.js:8735](dashboard.js#L8735-L8774) · 40 satır · zuzahlung_befreiung:delete

**Yol 2 — `uploadRxNachweise()`** · Ekran: _UI yolu çözülemedi_
- `uploadRxNachweise()` — [dashboard.js:19109](dashboard.js#L19109-L19195) · 87 satır · zuzahlung_befreiung:update, zuzahlung_befreiung:insert

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

- `fmt` — dashboard.js:2853 · dashboard.js:3920 · dashboard.js:8707 · dashboard.js:11187 · dashboard.js:11478 · dashboard.js:11556 · dashboard.js:15272 · dashboard.js:15679 · dashboard.js:23147 · dashboard.js:23233 · dashboard.js:23311 · dashboard.js:23343 · dashboard.js:23403 · module/kalender-raster.js:52
- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:8 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:814 · module/abrechnungsstatus.js:390 · module/fussbefund.js:121 · module/kalender-raster.js:24 · module/termin-aktionen.js:37 · module/termin-druck.js:27
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:13 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1309 · ops/app.js:84
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:12 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · dashboard.js:19823 · dashboard.js:21769 · dashboard.js:21910 · dashboard.js:21988
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/arzt-register.js:125 · module/krankenkasse-suche.js:160 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:41 · module/zuzahlung-befreiung.js:261 · ops/app.js:51
- `render` — calendar-widget.js:127 · dashboard.js:14632 · dashboard.js:22963 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:110
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:262 · api-backend/server.js:1203 · dashboard.js:3283
- `init` — attendance.js:297 · booking-request.js:1220 · booking.js:60 · cookie-consent.js:52 · dashboard.js:18263 · kalender.js:140 · onboarding.js:77
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/statistik.routes.js:18 · api-backend/billing/api/verordnung-status.routes.js:32 · api-backend/billing/api/warteliste.routes.js:21
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/verordnung-podo.js:105 · ops/app.js:48
- `cleanup` — dashboard.js:7052 · dashboard.js:7081 · dashboard.js:7157 · dashboard.js:7268 · dashboard.js:24941
- `g` — dashboard.js:17006 · dashboard.js:17019 · dashboard.js:17361 · dashboard.js:17427 · module/termin-aktionen.js:336
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:143
- `r2` — api-backend/billing/api/statistik.routes.js:189 · api-backend/billing/dta/builder.js:43 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14
- `loadServices` — booking-request.js:419 · booking.js:195 · dashboard.js:10062 · kalender.js:497
- `closeModal` — dashboard.js:1243 · dashboard.js:13169 · dashboard.js:13588 · ops/app.js:162
- `v` — dashboard.js:14093 · dashboard.js:14118 · dashboard.js:14137 · dashboard.js:18049
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1257 · module/kiosk.js:46
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/sync_heilmittel_katalog.js:109 · stripe-live-setup.js:75
- `q` — booking-request.js:84 · dashboard.js:21258 · script.js:751
- `loadTeam` — booking-request.js:517 · dashboard.js:11224 · kalender.js:194
- `initCalendar` — booking-request.js:566 · dashboard.js:2511 · kalender.js:244
- `onEsc` — dashboard.js:7275 · module/rechnung-leistung-picker.js:42 · module/zuzahlung-befreiung.js:155
- `getCb` — dashboard.js:9173 · dashboard.js:9264 · module/fussbefund.js:151
- `norm` — dashboard.js:18429 · module/arzt-register.js:470 · ops/tools/regroup.mjs:59
- `schliessen` — module/abrechnungsstatus.js:319 · module/arzt-register.js:276 · module/zuzahlung-befreiung.js:150
- `reload` — ops/board.js:840 · ops/finance.js:1602 · ops/wissen.js:170
- `form` — ops/decisions.js:52 · ops/meetings.js:54 · ops/wissen.js:113
- `clearMsg` — admin-login.js:16 · login.js:167
- `allocate` — api-backend/ai/pii-mask.js:54 · api-backend/ai/pii-mask.js:114
- `unmask` — api-backend/ai/pii-mask.js:80 · api-backend/ai/pii-mask.js:160
- `buildUserMessage` — api-backend/ai/tasks/appointment-confirm-draft.js:31 · api-backend/ai/tasks/b2c-draft.js:22
- `normalizeIcd` — api-backend/ai/validators/icdDgRules.js:41 · icd-dg-match.js:40
- `parseIcdList` — api-backend/ai/validators/icdDgRules.js:59 · icd-dg-match.js:62
- `matchIcdToDg` — api-backend/ai/validators/icdDgRules.js:84 · icd-dg-match.js:78
