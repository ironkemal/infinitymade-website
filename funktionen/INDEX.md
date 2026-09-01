# Funktionskarte

> Üretim: 2026-08-31 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**1791 fonksiyon** · 175 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 9 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:3886](dashboard.js#L3886-L3982) · 97 satır · bookings:insert

**Yol 2 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4166](dashboard.js#L4166-L4232) · 67 satır · bookings:update

**Yol 3 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4249](dashboard.js#L4249-L4263) · 15 satır · bookings:update

**Yol 4 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4293](dashboard.js#L4293-L4385) · 93 satır · bookings:update

**Yol 5 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4387](dashboard.js#L4387-L4455) · 69 satır · bookings:update

**Yol 6 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4477](dashboard.js#L4477-L4525) · 49 satır · bookings:update

**Yol 7 — `initBkGroupPatientAutocomplete()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadGroupParticipants()` — [dashboard.js:4892](dashboard.js#L4892-L4956) · 65 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:4994](dashboard.js#L4994-L5115) · 122 satır · bookings:insert

**Yol 8 — `doMoveBooking()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `doMoveBooking()` — [dashboard.js:5457](dashboard.js#L5457-L5486) · 30 satır · bookings:update

**Yol 9 — `absageTerminMitGrund()`** · Ekran: _UI yolu çözülemedi_
- `absageTerminMitGrund()` — [dashboard.js:8053](dashboard.js#L8053-L8080) · 28 satır · bookings:update, bookings:delete

### `prescriptions` — 8 bağımsız yazma yolu

**Yol 1 — `flipAbrechnungStatus()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `flipAbrechnungStatus()` — [dashboard.js:8629](dashboard.js#L8629-L8665) · 37 satır · prescriptions:update

**Yol 2 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [dashboard.js:15594](dashboard.js#L15594-L15669) · 76 satır · prescriptions:update

**Yol 3 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:16968](dashboard.js#L16968-L17126) · 159 satır · prescriptions:insert

**Yol 4 — `renderAbrechnungReady()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungReady()` — [dashboard.js:19699](dashboard.js#L19699-L19924) · 226 satır · prescriptions:update

**Yol 5 — `renderAbrechnungHistory()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderAbrechnungHistory()` — [dashboard.js:19926](dashboard.js#L19926-L20013) · 88 satır · prescriptions:update

**Yol 6 — `triggerStorno()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Kassenbuch (physiotherapy/podologie/praxis) · Sidebar → Patienten · Sidebar → Team
- `triggerStorno()` — [dashboard.js:21030](dashboard.js#L21030-L21089) · 60 satır · prescriptions:update

**Yol 7 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L120) · 39 satır · prescriptions:update

**Yol 8 — `betragNullsetzen()`** · Ekran: _UI yolu çözülemedi_
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `profiles` — 8 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2303](dashboard.js#L2303-L2413) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5780](dashboard.js#L5780-L5806) · 27 satır · profiles:update

**Yol 3 — `openEmpDetail()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `openEmpDetail()` — [dashboard.js:11350](dashboard.js#L11350-L11547) · 198 satır · profiles:update

**Yol 4 — `bindPlan()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:13712](dashboard.js#L13712-L13718) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:13729](dashboard.js#L13729-L13742) · 14 satır · profiles:update
- `init()` — [kalender.js:140](kalender.js#L140-L191) · 52 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1633](module/fussbefund.js#L1633-L1697) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:870](onboarding.js#L870-L1015) · 146 satır · profiles:update

**Yol 5 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:14421](dashboard.js#L14421-L14484) · 64 satır · profiles:insert

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [dashboard.js:17258](dashboard.js#L17258-L17300) · 43 satır · profiles:update

**Yol 7 — `initAnfragenPanel()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Termin-Anfragen · Sidebar → Patienten · Sidebar → Team
- `initAnfragenPanel()` — [dashboard.js:23464](dashboard.js#L23464-L23521) · 58 satır · profiles:update

**Yol 8 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `document_vorlagen` — 7 bağımsız yazma yolu

**Yol 1 — `openVorlagenAnsicht()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `openVorlagenAnsicht()` — [dashboard.js:13013](dashboard.js#L13013-L13084) · 72 satır · document_vorlagen:update
- `_enterAnsichtEditMode()` — [dashboard.js:13103](dashboard.js#L13103-L13167) · 65 satır · document_vorlagen:update

**Yol 2 — `saveVorlage()`** · Ekran: _UI yolu çözülemedi_
- `saveVorlage()` — [dashboard.js:13273](dashboard.js#L13273-L13301) · 29 satır · document_vorlagen:update, document_vorlagen:insert

**Yol 3 — `deleteVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `deleteVorlage()` — [dashboard.js:13303](dashboard.js#L13303-L13310) · 8 satır · document_vorlagen:delete

**Yol 4 — `duplicateVorlage()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `duplicateVorlage()` — [dashboard.js:13312](dashboard.js#L13312-L13326) · 15 satır · document_vorlagen:insert

**Yol 5 — `startVorlagenInlineRename()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `startVorlagenInlineRename()` — [dashboard.js:13328](dashboard.js#L13328-L13357) · 30 satır · document_vorlagen:update
- `commit()` — [dashboard.js:13335](dashboard.js#L13335-L13348) · 14 satır · document_vorlagen:update

**Yol 6 — `seedDefaultVorlagen()`** · Ekran: _UI yolu çözülemedi_
- `seedDefaultVorlagen()` — [dashboard.js:13371](dashboard.js#L13371-L13375) · 5 satır · document_vorlagen:insert

**Yol 7 — `seedMissingVorlagen()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team · Sidebar → Vorlagen
- `seedMissingVorlagen()` — [dashboard.js:13377](dashboard.js#L13377-L13381) · 5 satır · document_vorlagen:insert

### `services` — 6 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7688](dashboard.js#L7688-L7727) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:9661](dashboard.js#L9661-L9688) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `migratePodologieLegacyServices()` — [dashboard.js:9857](dashboard.js#L9857-L9892) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Leistungen · Sidebar → Team
- `renderServices()` — [dashboard.js:10044](dashboard.js#L10044-L10068) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17490](dashboard.js#L17490-L17571) · 82 satır · services:insert

**Yol 6 — `ensureBlockerServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlockerServices()` — [module/kalender-blocker.js:71](module/kalender-blocker.js#L71-L112) · 42 satır · services:update, services:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `toggleStandortDay()` — [dashboard.js:10363](dashboard.js#L10363-L10383) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17490](dashboard.js#L17490-L17571) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:17573](dashboard.js#L17573-L17590) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `ensureBusinessCoords()` — [dashboard.js:22952](dashboard.js#L22952-L22981) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `handleSessionDrop()` — [dashboard.js:3886](dashboard.js#L3886-L3982) · 97 satır · prescription_sessions:update

**Yol 2 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4477](dashboard.js#L4477-L4525) · 49 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7466](dashboard.js#L7466-L7484) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7499](dashboard.js#L7499-L7589) · 91 satır · prescription_sessions:update, prescription_sessions:insert

### `time_offs` — 4 bağımsız yazma yolu

**Yol 1 — `openEmpDetail()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadTeam()` — [dashboard.js:10688](dashboard.js#L10688-L10883) · 196 satır · time_offs:insert
- `openEmpDetail()` — [dashboard.js:11350](dashboard.js#L11350-L11547) · 198 satır · time_offs:insert

**Yol 2 — `deleteEmpTimeOff()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `deleteEmpTimeOff()` — [dashboard.js:10954](dashboard.js#L10954-L10968) · 15 satır · time_offs:delete

**Yol 3 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:10970](dashboard.js#L10970-L10997) · 28 satır · time_offs:insert

**Yol 4 — `deleteUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `deleteUrlaub()` — [dashboard.js:11028](dashboard.js#L11028-L11035) · 8 satır · time_offs:delete

### `employee_business_assignments` — 3 bağımsız yazma yolu

**Yol 1 — `renderOtherStandortEmps()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderOtherStandortEmps()` — [dashboard.js:11049](dashboard.js#L11049-L11134) · 86 satır · employee_business_assignments:upsert

**Yol 2 — `renderEmpStandortList()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `renderEmpStandortList()` — [dashboard.js:11196](dashboard.js#L11196-L11261) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete

**Yol 3 — `saveEmpPermissions()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `saveEmpPermissions()` — [dashboard.js:11297](dashboard.js#L11297-L11348) · 52 satır · employee_business_assignments:upsert

### `leads` — 3 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4527](dashboard.js#L4527-L4673) · 147 satır · leads:update

**Yol 2 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:16968](dashboard.js#L16968-L17126) · 159 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:21605](dashboard.js#L21605-L21728) · 124 satır · leads:insert

### `aerzte` — 2 bağımsız yazma yolu

**Yol 1 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:16409](dashboard.js#L16409-L16416) · 8 satır · aerzte:delete

**Yol 2 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:16418](dashboard.js#L16418-L16463) · 46 satır · aerzte:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Verfügbarkeit · Sidebar → Patienten · Sidebar → Team
- `renderHoursGrid()` — [dashboard.js:10387](dashboard.js#L10387-L10460) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:11641](dashboard.js#L11641-L11731) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `loadSettings()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Einstellungen · Sidebar → Team
- `loadSettings()` — [dashboard.js:12454](dashboard.js#L12454-L12570) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:609](kalender.js#L609-L631) · 23 satır · calendar_integrations:delete

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpServices()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpServices()` — [dashboard.js:11733](dashboard.js#L11733-L11817) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · employee_services:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4166](dashboard.js#L4166-L4232) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4293](dashboard.js#L4293-L4385) · 93 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:15438](dashboard.js#L15438-L15527) · 90 satır · invoices:update, invoices:insert

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
- `saveUserPref()` — [dashboard.js:14647](dashboard.js#L14647-L14657) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:17652](dashboard.js#L17652-L17667) · 16 satır · user_preferences:upsert

### `vehicles` — 2 bağımsız yazma yolu

**Yol 1 — `saveQuickVehicleHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveQuickVehicleHandler()` — [dashboard.js:4143](dashboard.js#L4143-L4164) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 5 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:20705](dashboard.js#L20705-L20766) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:20808](dashboard.js#L20808-L20840) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `reportSidebarVisibility()` — [dashboard.js:927](dashboard.js#L927-L951) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `loadEmpHours()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `loadEmpHours()` — [dashboard.js:11641](dashboard.js#L11641-L11731) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

### `zuzahlung_befreiung` — 2 bağımsız yazma yolu

**Yol 1 — `wireBefreiungCard()`** · Ekran: Sidebar → §302-Abrechnung (physiotherapy/praxis) · Sidebar → Patienten · Sidebar → Team
- `wireBefreiungCard()` — [dashboard.js:8702](dashboard.js#L8702-L8741) · 40 satır · zuzahlung_befreiung:delete

**Yol 2 — `uploadRxNachweise()`** · Ekran: _UI yolu çözülemedi_
- `uploadRxNachweise()` — [dashboard.js:18561](dashboard.js#L18561-L18647) · 87 satır · zuzahlung_befreiung:update, zuzahlung_befreiung:insert

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

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:8 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:843 · module/abrechnungsstatus.js:390 · module/diagnosegruppen-regeln.js:30 · module/fussbefund.js:179 · module/kalender-raster.js:24 · module/kalender-woche.js:39 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/termin-aktionen.js:37 · module/termin-druck.js:27
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-freigabe.js:112 · module/arzt-register.js:125 · module/krankenkasse-suche.js:160 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:42 · module/verordnung-uebersicht.js:91 · module/zuzahlung-befreiung.js:261 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `fmt` — dashboard.js:3813 · dashboard.js:8674 · dashboard.js:10651 · dashboard.js:10940 · dashboard.js:11018 · dashboard.js:14735 · dashboard.js:15142 · dashboard.js:22536 · dashboard.js:22622 · dashboard.js:22700 · dashboard.js:22732 · dashboard.js:22792 · module/kalender-raster.js:71
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:13 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1351 · ops/app.js:84
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:12 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · dashboard.js:19275 · dashboard.js:21190 · dashboard.js:21331 · dashboard.js:21409
- `render` — calendar-widget.js:127 · dashboard.js:14095 · dashboard.js:22352 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:110
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:263 · api-backend/server.js:1207 · dashboard.js:3176
- `r2` — api-backend/billing/api/statistik.routes.js:189 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:43 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14 · api-backend/billing/zuzahlung/korrektur.js:16 · module/zuzahlung-rechnen.js:42
- `init` — attendance.js:297 · booking-request.js:1216 · booking.js:58 · cookie-consent.js:139 · dashboard.js:17715 · kalender.js:140 · onboarding.js:77
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/statistik.routes.js:18 · api-backend/billing/api/verordnung-status.routes.js:32 · api-backend/billing/api/warteliste.routes.js:21 · api-backend/billing/api/zuzahlung.routes.js:47
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/verordnung-podo.js:105 · module/zuzahlung-korrektur.js:206 · ops/app.js:48
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:319 · module/arzt-register.js:276 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:209
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `cleanup` — dashboard.js:7021 · dashboard.js:7050 · dashboard.js:7126 · dashboard.js:7230 · dashboard.js:23125
- `g` — dashboard.js:16476 · dashboard.js:16489 · dashboard.js:16813 · dashboard.js:16879 · module/termin-aktionen.js:336
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:144
- `loadServices` — booking-request.js:419 · booking.js:193 · dashboard.js:9641 · kalender.js:497
- `closeModal` — dashboard.js:1285 · dashboard.js:12631 · dashboard.js:13050 · ops/app.js:162
- `onEsc` — dashboard.js:7237 · module/rechnung-leistung-picker.js:42 · module/zuzahlung-befreiung.js:155 · module/zuzahlung-korrektur.js:214
- `v` — dashboard.js:13555 · dashboard.js:13580 · dashboard.js:13600 · dashboard.js:17501
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1299 · module/kiosk.js:46
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/sync_heilmittel_katalog.js:109 · stripe-live-setup.js:80
- `q` — booking-request.js:84 · dashboard.js:20679 · script.js:751
- `loadTeam` — booking-request.js:513 · dashboard.js:10688 · kalender.js:194
- `initCalendar` — booking-request.js:562 · dashboard.js:2531 · kalender.js:244
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:679
- `norm` — dashboard.js:17881 · module/arzt-register.js:470 · ops/tools/regroup.mjs:59
- `reload` — ops/board.js:840 · ops/finance.js:1602 · ops/wissen.js:170
- `form` — ops/decisions.js:52 · ops/meetings.js:54 · ops/wissen.js:113
- `clearMsg` — admin-login.js:16 · login.js:167
- `allocate` — api-backend/ai/pii-mask.js:54 · api-backend/ai/pii-mask.js:114
- `unmask` — api-backend/ai/pii-mask.js:80 · api-backend/ai/pii-mask.js:160
- `buildUserMessage` — api-backend/ai/tasks/appointment-confirm-draft.js:31 · api-backend/ai/tasks/b2c-draft.js:22
- `normalizeIcd` — api-backend/ai/validators/icdDgRules.js:41 · icd-dg-match.js:40
- `parseIcdList` — api-backend/ai/validators/icdDgRules.js:59 · icd-dg-match.js:62
- `matchIcdToDg` — api-backend/ai/validators/icdDgRules.js:84 · icd-dg-match.js:78
