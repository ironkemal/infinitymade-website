# Funktionskarte

> Üretim: 2026-09-03 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**1873 fonksiyon** · 184 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 14 bağımsız yazma yolu

**Yol 1 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:17](api-backend/booking/from-request.js#L17-L114) · 98 satır · bookings:insert

**Yol 2 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:3241](dashboard.js#L3241-L3767) · 527 satır · bookings:update

**Yol 3 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3979](dashboard.js#L3979-L4075) · 97 satır · bookings:insert

**Yol 4 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4259](dashboard.js#L4259-L4325) · 67 satır · bookings:update

**Yol 5 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4342](dashboard.js#L4342-L4356) · 15 satır · bookings:update

**Yol 6 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4386](dashboard.js#L4386-L4478) · 93 satır · bookings:update

**Yol 7 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4480](dashboard.js#L4480-L4548) · 69 satır · bookings:update

**Yol 8 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4570](dashboard.js#L4570-L4618) · 49 satır · bookings:update

**Yol 9 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:4985](dashboard.js#L4985-L5063) · 79 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:5101](dashboard.js#L5101-L5222) · 122 satır · bookings:insert

**Yol 10 — `doMoveBooking()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:5564](dashboard.js#L5564-L5593) · 30 satır · bookings:update

**Yol 11 — `absageTerminMitGrund()`** · Ekran: _UI yolu çözülemedi_
- `absageTerminMitGrund()` — [dashboard.js:8076](dashboard.js#L8076-L8112) · 37 satır · bookings:update, bookings:delete

**Yol 12 — `bindeTermin()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:121](module/verordnung-termine.js#L121-L127) · 7 satır · bookings:update

**Yol 13 — `loeseTermin()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:130](module/verordnung-termine.js#L130-L136) · 7 satır · bookings:update

**Yol 14 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:195](module/warteliste-nachruecker.js#L195-L231) · 37 satır · bookings:insert

### `prescriptions` — 9 bağımsız yazma yolu

**Yol 1 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:7400](dashboard.js#L7400-L7472) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:8693](dashboard.js#L8693-L8729) · 37 satır · prescriptions:update

**Yol 2 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:7475](dashboard.js#L7475-L7543) · 69 satır · prescriptions:update

**Yol 3 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [dashboard.js:15658](dashboard.js#L15658-L15733) · 76 satır · prescriptions:update

**Yol 4 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17032](dashboard.js#L17032-L17190) · 159 satır · prescriptions:insert

**Yol 5 — `renderAbrechnungReady()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `renderAbrechnungReady()` — [dashboard.js:19756](dashboard.js#L19756-L19981) · 226 satır · prescriptions:update

**Yol 6 — `renderAbrechnungHistory()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `renderAbrechnungHistory()` — [dashboard.js:19983](dashboard.js#L19983-L20070) · 88 satır · prescriptions:update

**Yol 7 — `triggerStorno()`** · Ekran: ortak yardımcı — 11 modülden çağrılıyor
- `triggerStorno()` — [dashboard.js:21087](dashboard.js#L21087-L21146) · 60 satır · prescriptions:update

**Yol 8 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L120) · 39 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:85](module/sitzungsfortschritt.js#L85-L113) · 29 satır · prescriptions:update

**Yol 9 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `profiles` — 8 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2309](dashboard.js#L2309-L2419) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5887](dashboard.js#L5887-L5913) · 27 satır · profiles:update

**Yol 3 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:11082](dashboard.js#L11082-L13613) · 2532 satır · profiles:update
- `openEmpDetail()` — [dashboard.js:11414](dashboard.js#L11414-L11611) · 198 satır · profiles:update

**Yol 4 — `bindPlan()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:13776](dashboard.js#L13776-L13782) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:13793](dashboard.js#L13793-L13806) · 14 satır · profiles:update
- `init()` — [kalender.js:141](kalender.js#L141-L192) · 52 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1633](module/fussbefund.js#L1633-L1697) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:870](onboarding.js#L870-L1015) · 146 satır · profiles:update

**Yol 5 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:14485](dashboard.js#L14485-L14548) · 64 satır · profiles:insert

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [dashboard.js:17322](dashboard.js#L17322-L17364) · 43 satır · profiles:update

**Yol 7 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 11 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:23507](dashboard.js#L23507-L23564) · 58 satır · profiles:update

**Yol 8 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `services` — 6 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7827](dashboard.js#L7827-L7866) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:9725](dashboard.js#L9725-L9752) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:9921](dashboard.js#L9921-L9956) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `renderServices()` — [dashboard.js:10108](dashboard.js#L10108-L10132) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17554](dashboard.js#L17554-L17635) · 82 satır · services:insert

**Yol 6 — `ensureBlockerServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlockerServices()` — [module/kalender-blocker.js:71](module/kalender-blocker.js#L71-L112) · 42 satır · services:update, services:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:10427](dashboard.js#L10427-L10447) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17554](dashboard.js#L17554-L17635) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:17637](dashboard.js#L17637-L17654) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `ensureBusinessCoords()` — [dashboard.js:22995](dashboard.js#L22995-L23024) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `leads` — 4 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4620](dashboard.js#L4620-L4766) · 147 satır · leads:update

**Yol 2 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:7730](dashboard.js#L7730-L7817) · 88 satır · leads:update

**Yol 3 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:17032](dashboard.js#L17032-L17190) · 159 satır · leads:update

**Yol 4 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:21662](dashboard.js#L21662-L21785) · 124 satır · leads:insert

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3979](dashboard.js#L3979-L4075) · 97 satır · prescription_sessions:update

**Yol 2 — `handlePatientNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4570](dashboard.js#L4570-L4618) · 49 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7605](dashboard.js#L7605-L7623) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7638](dashboard.js#L7638-L7728) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:86](module/sitzung-abgleich.js#L86-L112) · 27 satır · prescription_sessions:upsert

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:55](api-backend/lib/arzt-registry.js#L55-L170) · 116 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:16473](dashboard.js#L16473-L16480) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:16482](dashboard.js#L16482-L16527) · 46 satır · aerzte:update

### `fahrten` — 3 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4259](dashboard.js#L4259-L4325) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4386](dashboard.js#L4386-L4478) · 93 satır · fahrten:upsert

**Yol 3 — `toLocal()`** · Ekran: ortak yardımcı — 11 modülden çağrılıyor
- `toLocal()` — [dashboard.js:20663](dashboard.js#L20663-L20726) · 64 satır · fahrten:update, fahrten:delete

### `podologie_behandlungen` — 3 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:357](module/podologie-abrechnung.js#L357-L1410) · 1054 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:165](module/rechnung-bruecke.js#L165-L174) · 10 satır · podologie_behandlungen:update

**Yol 3 — `verknuepfungLoesen()`** · Ekran: _UI yolu çözülemedi_
- `verknuepfungLoesen()` — [module/rechnung-bruecke.js:182](module/rechnung-bruecke.js#L182-L190) · 9 satır · podologie_behandlungen:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:10451](dashboard.js#L10451-L10524) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:11082](dashboard.js#L11082-L13613) · 2532 satır · breaks:insert, breaks:delete
- `loadEmpHours()` — [dashboard.js:11705](dashboard.js#L11705-L11795) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:11082](dashboard.js#L11082-L13613) · 2532 satır · calendar_integrations:delete
- `loadSettings()` — [dashboard.js:12518](dashboard.js#L12518-L12634) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:679](kalender.js#L679-L701) · 23 satır · calendar_integrations:delete

### `email_logs` — 2 bağımsız yazma yolu

**Yol 1 — `loadPatientDetailMails()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadPatientDetailMails()` — [dashboard.js:9114](dashboard.js#L9114-L9150) · 37 satır · email_logs:update

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:11082](dashboard.js#L11082-L13613) · 2532 satır · email_logs:insert

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:11082](dashboard.js#L11082-L13613) · 2532 satır · employee_services:insert, employee_services:delete
- `loadEmpServices()` — [dashboard.js:11797](dashboard.js#L11797-L11881) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · employee_services:insert

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:288](admin.js#L288-L317) · 30 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · module_visibility:upsert

### `patient_consents` — 2 bağımsız yazma yolu

**Yol 1 — `speichereEinwilligung()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:295](module/patienten-einwilligung.js#L295-L333) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `widerrufen()` — [module/patienten-einwilligung.js:535](module/patienten-einwilligung.js#L535-L552) · 18 satır · patient_consents:update

### `time_offs` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadTeam()` — [dashboard.js:10752](dashboard.js#L10752-L10947) · 196 satır · time_offs:insert
- `deleteEmpTimeOff()` — [dashboard.js:11018](dashboard.js#L11018-L11032) · 15 satır · time_offs:delete
- `fmt()` — [dashboard.js:11082](dashboard.js#L11082-L13613) · 2532 satır · time_offs:delete, time_offs:insert
- `deleteUrlaub()` — [dashboard.js:11092](dashboard.js#L11092-L11099) · 8 satır · time_offs:delete
- `openEmpDetail()` — [dashboard.js:11414](dashboard.js#L11414-L11611) · 198 satır · time_offs:insert

**Yol 2 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:11034](dashboard.js#L11034-L11061) · 28 satır · time_offs:insert

### `user_preferences` — 2 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `saveUserPref()` — [dashboard.js:14711](dashboard.js#L14711-L14721) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:17716](dashboard.js#L17716-L17731) · 16 satır · user_preferences:upsert

### `vehicles` — 2 bağımsız yazma yolu

**Yol 1 — `saveQuickVehicleHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveQuickVehicleHandler()` — [dashboard.js:4236](dashboard.js#L4236-L4257) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 11 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:20762](dashboard.js#L20762-L20823) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:20865](dashboard.js#L20865-L20897) · 33 satır · vehicles:update, vehicles:insert

### `verordnungen` — 2 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:357](module/podologie-abrechnung.js#L357-L1410) · 1054 satır · verordnungen:update, verordnungen:insert

**Yol 2 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:120](module/verordnung-einheiten.js#L120-L131) · 12 satır · verordnungen:update

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `reportSidebarVisibility()` — [dashboard.js:933](dashboard.js#L933-L957) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:11082](dashboard.js#L11082-L13613) · 2532 satır · working_hours:upsert
- `loadEmpHours()` — [dashboard.js:11705](dashboard.js#L11705-L11795) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

### `zuzahlung_befreiung` — 2 bağımsız yazma yolu

**Yol 1 — `oeffneBefreiungsFormular()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `wireBefreiungCard()` — [dashboard.js:8766](dashboard.js#L8766-L8805) · 40 satır · zuzahlung_befreiung:delete
- `oeffneBefreiungsFormular()` — [module/zuzahlung-befreiung.js:62](module/zuzahlung-befreiung.js#L62-L240) · 179 satır · zuzahlung_befreiung:delete, zuzahlung_befreiung:upsert

**Yol 2 — `uploadRxNachweise()`** · Ekran: _UI yolu çözülemedi_
- `uploadRxNachweise()` — [dashboard.js:18625](dashboard.js#L18625-L18711) · 87 satır · zuzahlung_befreiung:update, zuzahlung_befreiung:insert

## En çok yazılan tablolar

- `profiles` — 19 ayrı fonksiyon yazıyor
- `bookings` — 15 ayrı fonksiyon yazıyor
- `prescriptions` — 11 ayrı fonksiyon yazıyor
- `document_vorlagen` — 10 ayrı fonksiyon yazıyor
- `services` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `time_offs` — 6 ayrı fonksiyon yazıyor
- `prescription_sessions` — 5 ayrı fonksiyon yazıyor
- `businesses` — 5 ayrı fonksiyon yazıyor
- `leads` — 4 ayrı fonksiyon yazıyor
- `employee_business_assignments` — 4 ayrı fonksiyon yazıyor
- `employee_services` — 4 ayrı fonksiyon yazıyor
- `invoices` — 4 ayrı fonksiyon yazıyor
- `ops_finance_expenses` — 4 ayrı fonksiyon yazıyor
- `aerzte` — 3 ayrı fonksiyon yazıyor
- `vehicles` — 3 ayrı fonksiyon yazıyor
- `fahrten` — 3 ayrı fonksiyon yazıyor
- `zuzahlung_befreiung` — 3 ayrı fonksiyon yazıyor
- `breaks` — 3 ayrı fonksiyon yazıyor
- `working_hours` — 3 ayrı fonksiyon yazıyor

## Aynı ada sahip birden fazla tanım

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:8 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:849 · module/abrechnungsstatus.js:500 · module/diagnosegruppen-regeln.js:30 · module/fussbefund.js:179 · module/kalender-raster.js:24 · module/kalender-woche.js:39 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/rezeptinfo-geld.js:70 · module/termin-aktionen.js:37 · module/termin-druck.js:27 · module/termin-panel-patient.js:41 · module/warteliste-ansicht.js:26 · module/warteliste-nachruecker.js:46
- `fmt` — dashboard.js:3906 · dashboard.js:8738 · dashboard.js:10715 · dashboard.js:11004 · dashboard.js:11082 · dashboard.js:14799 · dashboard.js:15206 · dashboard.js:22579 · dashboard.js:22665 · dashboard.js:22743 · dashboard.js:22775 · dashboard.js:22835 · module/kalender-raster.js:71 · module/rezeptinfo-geld.js:68
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-freigabe.js:112 · module/arzt-register.js:125 · module/krankenkasse-suche.js:160 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:42 · module/verordnung-uebersicht.js:91 · module/zuzahlung-befreiung.js:261 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:13 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1357 · ops/app.js:84
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:12 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · dashboard.js:19339 · dashboard.js:21247 · dashboard.js:21388 · dashboard.js:21466
- `render` — calendar-widget.js:127 · dashboard.js:14159 · dashboard.js:22395 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:110
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:263 · api-backend/server.js:1207 · dashboard.js:3182
- `r2` — api-backend/billing/api/statistik.routes.js:189 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:43 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14 · api-backend/billing/zuzahlung/korrektur.js:16 · module/zuzahlung-rechnen.js:42
- `init` — attendance.js:297 · booking-request.js:1216 · booking.js:58 · cookie-consent.js:139 · dashboard.js:17779 · kalender.js:141 · onboarding.js:77
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/statistik.routes.js:18 · api-backend/billing/api/verordnung-status.routes.js:32 · api-backend/billing/api/warteliste.routes.js:21 · api-backend/billing/api/zuzahlung.routes.js:47
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/verordnung-podo.js:105 · module/zuzahlung-korrektur.js:206 · ops/app.js:48
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:429 · module/arzt-register.js:276 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:209
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `cleanup` — dashboard.js:7160 · dashboard.js:7189 · dashboard.js:7265 · dashboard.js:7369 · dashboard.js:23168
- `g` — dashboard.js:16540 · dashboard.js:16553 · dashboard.js:16877 · dashboard.js:16943 · module/termin-aktionen.js:347
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:144
- `loadServices` — booking-request.js:419 · booking.js:193 · dashboard.js:9705 · kalender.js:567
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:679 · module/verordnung-detail.js:679
- `closeModal` — dashboard.js:1291 · dashboard.js:12695 · dashboard.js:13114 · ops/app.js:162
- `onEsc` — dashboard.js:7376 · module/rechnung-leistung-picker.js:42 · module/zuzahlung-befreiung.js:155 · module/zuzahlung-korrektur.js:214
- `v` — dashboard.js:13619 · dashboard.js:13644 · dashboard.js:13664 · dashboard.js:17565
- `zeile` — module/rechnung-druck.js:31 · module/verordnung-detail.js:208 · module/verordnung-detail.js:329 · module/verordnung-detail.js:380
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1305 · module/kiosk.js:46
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/sync_heilmittel_katalog.js:109 · stripe-live-setup.js:80
- `q` — booking-request.js:84 · dashboard.js:20736 · script.js:751
- `loadTeam` — booking-request.js:513 · dashboard.js:10752 · kalender.js:195
- `initCalendar` — booking-request.js:562 · dashboard.js:2537 · kalender.js:245
- `norm` — dashboard.js:17945 · module/arzt-register.js:470 · ops/tools/regroup.mjs:59
- `oeffne` — module/kalender-kontextmenue.js:119 · module/leistungen-liste.js:190 · module/verordnung-liste.js:156
- `p` — module/kalender-raster.js:105 · module/podologie-positionen.js:48 · module/podologie-positionen.js:69
- `reload` — ops/board.js:840 · ops/finance.js:1602 · ops/wissen.js:170
- `form` — ops/decisions.js:52 · ops/meetings.js:54 · ops/wissen.js:113
- `clearMsg` — admin-login.js:16 · login.js:167
- `allocate` — api-backend/ai/pii-mask.js:54 · api-backend/ai/pii-mask.js:114
- `unmask` — api-backend/ai/pii-mask.js:80 · api-backend/ai/pii-mask.js:160
- `buildUserMessage` — api-backend/ai/tasks/appointment-confirm-draft.js:31 · api-backend/ai/tasks/b2c-draft.js:22
