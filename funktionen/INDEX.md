# Funktionskarte

> Üretim: 2026-08-25 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**1710 fonksiyon** · 161 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 9 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:3873](dashboard.js#L3873-L3969) · 97 satır · bookings:insert

**Yol 2 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4153](dashboard.js#L4153-L4219) · 67 satır · bookings:update

**Yol 3 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4236](dashboard.js#L4236-L4250) · 15 satır · bookings:update

**Yol 4 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4280](dashboard.js#L4280-L4372) · 93 satır · bookings:update

**Yol 5 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4374](dashboard.js#L4374-L4442) · 69 satır · bookings:update

**Yol 6 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4464](dashboard.js#L4464-L4512) · 49 satır · bookings:update

**Yol 7 — `initBkGroupPatientAutocomplete()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadGroupParticipants()` — [dashboard.js:4877](dashboard.js#L4877-L4941) · 65 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:4979](dashboard.js#L4979-L5100) · 122 satır · bookings:insert

**Yol 8 — `doMoveBooking()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `doMoveBooking()` — [dashboard.js:5441](dashboard.js#L5441-L5470) · 30 satır · bookings:update

**Yol 9 — `absageTerminMitGrund()`** · Ekran: _UI yolu çözülemedi_
- `absageTerminMitGrund()` — [dashboard.js:8027](dashboard.js#L8027-L8054) · 28 satır · bookings:update, bookings:delete

### `prescriptions` — 8 bağımsız yazma yolu

**Yol 1 — `flipAbrechnungStatus()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `flipAbrechnungStatus()` — [dashboard.js:8613](dashboard.js#L8613-L8645) · 33 satır · prescriptions:update

**Yol 2 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [dashboard.js:15981](dashboard.js#L15981-L16056) · 76 satır · prescriptions:update

**Yol 3 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17366](dashboard.js#L17366-L17524) · 159 satır · prescriptions:insert

**Yol 4 — `renderAbrechnungReady()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungReady()` — [dashboard.js:20139](dashboard.js#L20139-L20368) · 230 satır · prescriptions:update

**Yol 5 — `renderAbrechnungHistory()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungHistory()` — [dashboard.js:20370](dashboard.js#L20370-L20457) · 88 satır · prescriptions:update

**Yol 6 — `triggerStorno()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Kassenbuch (physiotherapy/podologie/praxis) · Sidebar → Patienten · Sidebar → Team
- `triggerStorno()` — [dashboard.js:21459](dashboard.js#L21459-L21518) · 60 satır · prescriptions:update

**Yol 7 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L117) · 36 satır · prescriptions:update

**Yol 8 — `betragNullsetzen()`** · Ekran: _UI yolu çözülemedi_
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `profiles` — 8 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2270](dashboard.js#L2270-L2380) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5764](dashboard.js#L5764-L5790) · 27 satır · profiles:update

**Yol 3 — `openEmpDetail()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `openEmpDetail()` — [dashboard.js:11738](dashboard.js#L11738-L11935) · 198 satır · profiles:update

**Yol 4 — `bindPlan()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:14099](dashboard.js#L14099-L14105) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:14116](dashboard.js#L14116-L14129) · 14 satır · profiles:update
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
- `saveEmployee()` — [dashboard.js:14808](dashboard.js#L14808-L14871) · 64 satır · profiles:insert

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [dashboard.js:17656](dashboard.js#L17656-L17698) · 43 satır · profiles:update

**Yol 7 — `initAnfragenPanel()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Termin-Anfragen · Sidebar → Patienten · Sidebar → Team
- `initAnfragenPanel()` — [dashboard.js:25186](dashboard.js#L25186-L25243) · 58 satır · profiles:update

**Yol 8 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:257](onboarding.js#L257-L261) · 5 satır · profiles:update

### `document_vorlagen` — 7 bağımsız yazma yolu

**Yol 1 — `openVorlagenAnsicht()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `openVorlagenAnsicht()` — [dashboard.js:13401](dashboard.js#L13401-L13472) · 72 satır · document_vorlagen:update
- `_enterAnsichtEditMode()` — [dashboard.js:13491](dashboard.js#L13491-L13555) · 65 satır · document_vorlagen:update

**Yol 2 — `saveVorlage()`** · Ekran: _UI yolu çözülemedi_
- `saveVorlage()` — [dashboard.js:13661](dashboard.js#L13661-L13689) · 29 satır · document_vorlagen:update, document_vorlagen:insert

**Yol 3 — `deleteVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `deleteVorlage()` — [dashboard.js:13691](dashboard.js#L13691-L13698) · 8 satır · document_vorlagen:delete

**Yol 4 — `duplicateVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `duplicateVorlage()` — [dashboard.js:13700](dashboard.js#L13700-L13714) · 15 satır · document_vorlagen:insert

**Yol 5 — `startVorlagenInlineRename()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `startVorlagenInlineRename()` — [dashboard.js:13716](dashboard.js#L13716-L13745) · 30 satır · document_vorlagen:update
- `commit()` — [dashboard.js:13723](dashboard.js#L13723-L13736) · 14 satır · document_vorlagen:update

**Yol 6 — `seedDefaultVorlagen()`** · Ekran: _UI yolu çözülemedi_
- `seedDefaultVorlagen()` — [dashboard.js:13759](dashboard.js#L13759-L13763) · 5 satır · document_vorlagen:insert

**Yol 7 — `seedMissingVorlagen()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `seedMissingVorlagen()` — [dashboard.js:13765](dashboard.js#L13765-L13769) · 5 satır · document_vorlagen:insert

### `services` — 6 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7670](dashboard.js#L7670-L7709) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:10029](dashboard.js#L10029-L10056) · 28 satır · services:insert
- `normName()` — [onboarding.js:566](onboarding.js#L566-L721) · 156 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:584](onboarding.js#L584-L721) · 138 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `migratePodologieLegacyServices()` — [dashboard.js:10225](dashboard.js#L10225-L10260) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `renderServices()` — [dashboard.js:10412](dashboard.js#L10412-L10436) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17888](dashboard.js#L17888-L17969) · 82 satır · services:insert

**Yol 6 — `ensureBlockerServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlockerServices()` — [module/kalender-blocker.js:71](module/kalender-blocker.js#L71-L112) · 42 satır · services:update, services:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `toggleStandortDay()` — [dashboard.js:10751](dashboard.js#L10751-L10771) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17888](dashboard.js#L17888-L17969) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:17971](dashboard.js#L17971-L17988) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `ensureBusinessCoords()` — [dashboard.js:24618](dashboard.js#L24618-L24647) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:364](onboarding.js#L364-L426) · 63 satır · businesses:update, businesses:insert

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:3873](dashboard.js#L3873-L3969) · 97 satır · prescription_sessions:update

**Yol 2 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4464](dashboard.js#L4464-L4512) · 49 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7448](dashboard.js#L7448-L7466) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7481](dashboard.js#L7481-L7571) · 91 satır · prescription_sessions:update, prescription_sessions:insert

### `time_offs` — 4 bağımsız yazma yolu

**Yol 1 — `openEmpDetail()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadTeam()` — [dashboard.js:11076](dashboard.js#L11076-L11271) · 196 satır · time_offs:insert
- `openEmpDetail()` — [dashboard.js:11738](dashboard.js#L11738-L11935) · 198 satır · time_offs:insert

**Yol 2 — `deleteEmpTimeOff()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `deleteEmpTimeOff()` — [dashboard.js:11342](dashboard.js#L11342-L11356) · 15 satır · time_offs:delete

**Yol 3 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:11358](dashboard.js#L11358-L11385) · 28 satır · time_offs:insert

**Yol 4 — `deleteUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `deleteUrlaub()` — [dashboard.js:11416](dashboard.js#L11416-L11423) · 8 satır · time_offs:delete

### `employee_business_assignments` — 3 bağımsız yazma yolu

**Yol 1 — `renderOtherStandortEmps()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderOtherStandortEmps()` — [dashboard.js:11437](dashboard.js#L11437-L11522) · 86 satır · employee_business_assignments:upsert

**Yol 2 — `renderEmpStandortList()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderEmpStandortList()` — [dashboard.js:11584](dashboard.js#L11584-L11649) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete

**Yol 3 — `saveEmpPermissions()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `saveEmpPermissions()` — [dashboard.js:11685](dashboard.js#L11685-L11736) · 52 satır · employee_business_assignments:upsert

### `leads` — 3 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4514](dashboard.js#L4514-L4658) · 145 satır · leads:update

**Yol 2 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17366](dashboard.js#L17366-L17524) · 159 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:22034](dashboard.js#L22034-L22157) · 124 satır · leads:insert

### `user_preferences` — 3 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `saveUserPref()` — [dashboard.js:15034](dashboard.js#L15034-L15044) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:18050](dashboard.js#L18050-L18065) · 16 satır · user_preferences:upsert

**Yol 3 — `setActiveBusiness()`** · Ekran: _UI yolu çözülemedi_
- `setActiveBusiness()` — [lib/business.js:71](lib/business.js#L71-L94) · 24 satır · user_preferences:upsert

### `aerzte` — 2 bağımsız yazma yolu

**Yol 1 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:16789](dashboard.js#L16789-L16796) · 8 satır · aerzte:delete

**Yol 2 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:16798](dashboard.js#L16798-L16843) · 46 satır · aerzte:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderHoursGrid()` — [dashboard.js:10775](dashboard.js#L10775-L10848) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:12029](dashboard.js#L12029-L12119) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `loadSettings()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Einstellungen · Sidebar → Team
- `loadSettings()` — [dashboard.js:12842](dashboard.js#L12842-L12958) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:609](kalender.js#L609-L631) · 23 satır · calendar_integrations:delete

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpServices()` — [dashboard.js:12121](dashboard.js#L12121-L12205) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:566](onboarding.js#L566-L721) · 156 satır · employee_services:insert
- `syncServices()` — [onboarding.js:584](onboarding.js#L584-L721) · 138 satır · employee_services:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4153](dashboard.js#L4153-L4219) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4280](dashboard.js#L4280-L4372) · 93 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:15825](dashboard.js#L15825-L15914) · 90 satır · invoices:update, invoices:insert

**Yol 2 — `markiereRechnungBezahlt()`** · Ekran: _UI yolu çözülemedi_
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:49](module/rechnung-zahlung.js#L49-L56) · 8 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:288](admin.js#L288-L317) · 30 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · module_visibility:upsert

### `pat_fussbefund` — 2 bağımsız yazma yolu

**Yol 1 — `refreshFussbefundVerlauf()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `refreshFussbefundVerlauf()` — [dashboard.js:9051](dashboard.js#L9051-L9117) · 67 satır · pat_fussbefund:delete
- `saveFussbefund()` — [dashboard.js:9271](dashboard.js#L9271-L9322) · 52 satır · pat_fussbefund:update, pat_fussbefund:insert

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
- `saveQuickVehicleHandler()` — [dashboard.js:4130](dashboard.js#L4130-L4151) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:21134](dashboard.js#L21134-L21195) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:21237](dashboard.js#L21237-L21269) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `reportSidebarVisibility()` — [dashboard.js:906](dashboard.js#L906-L930) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:12029](dashboard.js#L12029-L12119) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:799](onboarding.js#L799-L844) · 46 satır · working_hours:delete, working_hours:insert

### `zuzahlung_befreiung` — 2 bağımsız yazma yolu

**Yol 1 — `wireBefreiungCard()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `wireBefreiungCard()` — [dashboard.js:8682](dashboard.js#L8682-L8721) · 40 satır · zuzahlung_befreiung:delete

**Yol 2 — `uploadRxNachweise()`** · Ekran: _UI yolu çözülemedi_
- `uploadRxNachweise()` — [dashboard.js:18959](dashboard.js#L18959-L19045) · 87 satır · zuzahlung_befreiung:update, zuzahlung_befreiung:insert

## En çok yazılan tablolar

- `profiles` — 18 ayrı fonksiyon yazıyor
- `bookings` — 10 ayrı fonksiyon yazıyor
- `document_vorlagen` — 9 ayrı fonksiyon yazıyor
- `services` — 8 ayrı fonksiyon yazıyor
- `prescriptions` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
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

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:8 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:822 · module/abrechnungsstatus.js:390 · module/fussbefund.js:121 · module/kalender-raster.js:24 · module/kalender-woche.js:38 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/termin-aktionen.js:37 · module/termin-druck.js:27
- `fmt` — dashboard.js:3800 · dashboard.js:8654 · dashboard.js:11039 · dashboard.js:11328 · dashboard.js:11406 · dashboard.js:15122 · dashboard.js:15529 · dashboard.js:22997 · dashboard.js:23083 · dashboard.js:23161 · dashboard.js:23193 · dashboard.js:23253 · module/kalender-raster.js:71
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:13 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1318 · ops/app.js:84
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:12 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · dashboard.js:19673 · dashboard.js:21619 · dashboard.js:21760 · dashboard.js:21838
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/arzt-register.js:125 · module/krankenkasse-suche.js:160 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:41 · module/zuzahlung-befreiung.js:261 · ops/app.js:51
- `render` — calendar-widget.js:127 · dashboard.js:14482 · dashboard.js:22813 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:110
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:262 · api-backend/server.js:1203 · dashboard.js:3163
- `init` — attendance.js:297 · booking-request.js:1220 · booking.js:60 · cookie-consent.js:52 · dashboard.js:18113 · kalender.js:140 · onboarding.js:77
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/statistik.routes.js:18 · api-backend/billing/api/verordnung-status.routes.js:32 · api-backend/billing/api/warteliste.routes.js:21
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/verordnung-podo.js:105 · ops/app.js:48
- `cleanup` — dashboard.js:6996 · dashboard.js:7025 · dashboard.js:7101 · dashboard.js:7212 · dashboard.js:24791
- `g` — dashboard.js:16856 · dashboard.js:16869 · dashboard.js:17211 · dashboard.js:17277 · module/termin-aktionen.js:336
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:143
- `r2` — api-backend/billing/api/statistik.routes.js:189 · api-backend/billing/dta/builder.js:43 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14
- `loadServices` — booking-request.js:419 · booking.js:195 · dashboard.js:10009 · kalender.js:497
- `closeModal` — dashboard.js:1252 · dashboard.js:13019 · dashboard.js:13438 · ops/app.js:162
- `v` — dashboard.js:13943 · dashboard.js:13968 · dashboard.js:13987 · dashboard.js:17899
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1266 · module/kiosk.js:46
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/sync_heilmittel_katalog.js:109 · stripe-live-setup.js:75
- `q` — booking-request.js:84 · dashboard.js:21108 · script.js:751
- `loadTeam` — booking-request.js:517 · dashboard.js:11076 · kalender.js:194
- `initCalendar` — booking-request.js:566 · dashboard.js:2523 · kalender.js:244
- `onEsc` — dashboard.js:7219 · module/rechnung-leistung-picker.js:42 · module/zuzahlung-befreiung.js:155
- `getCb` — dashboard.js:9120 · dashboard.js:9211 · module/fussbefund.js:151
- `norm` — dashboard.js:18279 · module/arzt-register.js:470 · ops/tools/regroup.mjs:59
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
