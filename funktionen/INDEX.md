# Funktionskarte

> Üretim: 2026-09-05 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**1998 fonksiyon** · 204 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 14 bağımsız yazma yolu

**Yol 1 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:17](api-backend/booking/from-request.js#L17-L114) · 98 satır · bookings:insert

**Yol 2 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:3248](dashboard.js#L3248-L3720) · 473 satır · bookings:update

**Yol 3 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3932](dashboard.js#L3932-L4028) · 97 satır · bookings:insert

**Yol 4 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4212](dashboard.js#L4212-L4278) · 67 satır · bookings:update

**Yol 5 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4295](dashboard.js#L4295-L4309) · 15 satır · bookings:update

**Yol 6 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4339](dashboard.js#L4339-L4431) · 93 satır · bookings:update

**Yol 7 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4433](dashboard.js#L4433-L4501) · 69 satır · bookings:update

**Yol 8 — `korrigiereNoShow()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4523](dashboard.js#L4523-L4561) · 39 satır · bookings:update
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:67](module/booking-status-korrektur.js#L67-L106) · 40 satır · bookings:update

**Yol 9 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:4814](dashboard.js#L4814-L4892) · 79 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:4930](dashboard.js#L4930-L5051) · 122 satır · bookings:insert

**Yol 10 — `doMoveBooking()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:5396](dashboard.js#L5396-L5425) · 30 satır · bookings:update

**Yol 11 — `absageTerminMitGrund()`** · Ekran: _UI yolu çözülemedi_
- `absageTerminMitGrund()` — [dashboard.js:7838](dashboard.js#L7838-L7874) · 37 satır · bookings:update, bookings:delete

**Yol 12 — `bindeTermin()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:121](module/verordnung-termine.js#L121-L129) · 9 satır · bookings:update

**Yol 13 — `loeseTermin()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:132](module/verordnung-termine.js#L132-L140) · 9 satır · bookings:update

**Yol 14 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:195](module/warteliste-nachruecker.js#L195-L231) · 37 satır · bookings:insert

### `prescriptions` — 10 bağımsız yazma yolu

**Yol 1 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:7156](dashboard.js#L7156-L7228) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:8458](dashboard.js#L8458-L8494) · 37 satır · prescriptions:update

**Yol 2 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:7231](dashboard.js#L7231-L7299) · 69 satır · prescriptions:update

**Yol 3 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [dashboard.js:15422](dashboard.js#L15422-L15497) · 76 satır · prescriptions:update

**Yol 4 — `saveRezept()`** · Ekran: _UI yolu çözülemedi_
- `saveRezept()` — [dashboard.js:16796](dashboard.js#L16796-L16949) · 154 satır · prescriptions:insert

**Yol 5 — `renderAbrechnungReady()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `renderAbrechnungReady()` — [dashboard.js:19527](dashboard.js#L19527-L19752) · 226 satır · prescriptions:update

**Yol 6 — `renderAbrechnungHistory()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `renderAbrechnungHistory()` — [dashboard.js:19754](dashboard.js#L19754-L19841) · 88 satır · prescriptions:update

**Yol 7 — `triggerStorno()`** · Ekran: ortak yardımcı — 11 modülden çağrılıyor
- `triggerStorno()` — [dashboard.js:20858](dashboard.js#L20858-L20917) · 60 satır · prescriptions:update

**Yol 8 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L120) · 39 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:85](module/sitzungsfortschritt.js#L85-L113) · 29 satır · prescriptions:update

**Yol 9 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:126](module/verordnung-einheiten.js#L126-L160) · 35 satır · prescriptions:update

**Yol 10 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `profiles` — 7 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2322](dashboard.js#L2322-L2432) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5705](dashboard.js#L5705-L5731) · 27 satır · profiles:update

**Yol 3 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:10846](dashboard.js#L10846-L13847) · 3002 satır · profiles:update
- `openEmpDetail()` — [dashboard.js:11178](dashboard.js#L11178-L11375) · 198 satır · profiles:update
- `ensureCompanyCode()` — [dashboard.js:13540](dashboard.js#L13540-L13546) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:13557](dashboard.js#L13557-L13570) · 14 satır · profiles:update
- `init()` — [kalender.js:149](kalender.js#L149-L201) · 53 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1633](module/fussbefund.js#L1633-L1697) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:870](onboarding.js#L870-L1015) · 146 satır · profiles:update

**Yol 4 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:14249](dashboard.js#L14249-L14312) · 64 satır · profiles:insert

**Yol 5 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [dashboard.js:17081](dashboard.js#L17081-L17123) · 43 satır · profiles:update

**Yol 6 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 11 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:23278](dashboard.js#L23278-L23335) · 58 satır · profiles:update

**Yol 7 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `services` — 6 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7583](dashboard.js#L7583-L7622) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:9491](dashboard.js#L9491-L9518) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:9687](dashboard.js#L9687-L9722) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `renderServices()` — [dashboard.js:9874](dashboard.js#L9874-L9898) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17313](dashboard.js#L17313-L17394) · 82 satır · services:insert

**Yol 6 — `ensureBlockerServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlockerServices()` — [module/kalender-blocker.js:71](module/kalender-blocker.js#L71-L112) · 42 satır · services:update, services:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:10191](dashboard.js#L10191-L10211) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:17313](dashboard.js#L17313-L17394) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:17396](dashboard.js#L17396-L17413) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `ensureBusinessCoords()` — [dashboard.js:22766](dashboard.js#L22766-L22795) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `leads` — 4 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4563](dashboard.js#L4563-L4709) · 147 satır · leads:update

**Yol 2 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:7486](dashboard.js#L7486-L7573) · 88 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:21433](dashboard.js#L21433-L21556) · 124 satır · leads:insert

**Yol 4 — `verordnungPatientenAbgleich()`** · Ekran: _UI yolu çözülemedi_
- `verordnungPatientenAbgleich()` — [module/verordnung-patient-abgleich.js:17](module/verordnung-patient-abgleich.js#L17-L65) · 49 satır · leads:update

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3932](dashboard.js#L3932-L4028) · 97 satır · prescription_sessions:update

**Yol 2 — `korrigiereNoShow()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4523](dashboard.js#L4523-L4561) · 39 satır · prescription_sessions:update
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:67](module/booking-status-korrektur.js#L67-L106) · 40 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7361](dashboard.js#L7361-L7379) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7394](dashboard.js#L7394-L7484) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:86](module/sitzung-abgleich.js#L86-L112) · 27 satır · prescription_sessions:upsert

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:55](api-backend/lib/arzt-registry.js#L55-L170) · 116 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:16237](dashboard.js#L16237-L16244) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:16246](dashboard.js#L16246-L16291) · 46 satır · aerzte:update

### `fahrten` — 3 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4212](dashboard.js#L4212-L4278) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4339](dashboard.js#L4339-L4431) · 93 satır · fahrten:upsert

**Yol 3 — `toLocal()`** · Ekran: ortak yardımcı — 11 modülden çağrılıyor
- `toLocal()` — [dashboard.js:20434](dashboard.js#L20434-L20497) · 64 satır · fahrten:update, fahrten:delete

### `podologie_behandlungen` — 3 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:514](module/podologie-abrechnung.js#L514-L1856) · 1343 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:165](module/rechnung-bruecke.js#L165-L174) · 10 satır · podologie_behandlungen:update

**Yol 3 — `verknuepfungLoesen()`** · Ekran: _UI yolu çözülemedi_
- `verknuepfungLoesen()` — [module/rechnung-bruecke.js:182](module/rechnung-bruecke.js#L182-L190) · 9 satır · podologie_behandlungen:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:10215](dashboard.js#L10215-L10288) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:10846](dashboard.js#L10846-L13847) · 3002 satır · breaks:insert, breaks:delete
- `loadEmpHours()` — [dashboard.js:11469](dashboard.js#L11469-L11559) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:10846](dashboard.js#L10846-L13847) · 3002 satır · calendar_integrations:delete
- `loadSettings()` — [dashboard.js:12282](dashboard.js#L12282-L12398) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:746](kalender.js#L746-L768) · 23 satır · calendar_integrations:delete

### `email_logs` — 2 bağımsız yazma yolu

**Yol 1 — `loadPatientDetailMails()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadPatientDetailMails()` — [dashboard.js:8879](dashboard.js#L8879-L8915) · 37 satır · email_logs:update

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:10846](dashboard.js#L10846-L13847) · 3002 satır · email_logs:insert

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:10846](dashboard.js#L10846-L13847) · 3002 satır · employee_services:insert, employee_services:delete
- `loadEmpServices()` — [dashboard.js:11561](dashboard.js#L11561-L11645) · 85 satır · employee_services:insert, employee_services:delete

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
- `loadTeam()` — [dashboard.js:10516](dashboard.js#L10516-L10711) · 196 satır · time_offs:insert
- `deleteEmpTimeOff()` — [dashboard.js:10782](dashboard.js#L10782-L10796) · 15 satır · time_offs:delete
- `fmt()` — [dashboard.js:10846](dashboard.js#L10846-L13847) · 3002 satır · time_offs:delete, time_offs:insert
- `deleteUrlaub()` — [dashboard.js:10856](dashboard.js#L10856-L10863) · 8 satır · time_offs:delete
- `openEmpDetail()` — [dashboard.js:11178](dashboard.js#L11178-L11375) · 198 satır · time_offs:insert

**Yol 2 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:10798](dashboard.js#L10798-L10825) · 28 satır · time_offs:insert

### `user_preferences` — 2 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `saveUserPref()` — [dashboard.js:14475](dashboard.js#L14475-L14485) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:17475](dashboard.js#L17475-L17490) · 16 satır · user_preferences:upsert

### `vehicles` — 2 bağımsız yazma yolu

**Yol 1 — `saveQuickVehicleHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveQuickVehicleHandler()` — [dashboard.js:4189](dashboard.js#L4189-L4210) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 11 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:20533](dashboard.js#L20533-L20594) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:20636](dashboard.js#L20636-L20668) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `reportSidebarVisibility()` — [dashboard.js:946](dashboard.js#L946-L970) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `fmt()` — [dashboard.js:10846](dashboard.js#L10846-L13847) · 3002 satır · working_hours:upsert
- `loadEmpHours()` — [dashboard.js:11469](dashboard.js#L11469-L11559) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

### `zuzahlung_befreiung` — 2 bağımsız yazma yolu

**Yol 1 — `oeffneBefreiungsFormular()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `wireBefreiungCard()` — [dashboard.js:8531](dashboard.js#L8531-L8570) · 40 satır · zuzahlung_befreiung:delete
- `oeffneBefreiungsFormular()` — [module/zuzahlung-befreiung.js:62](module/zuzahlung-befreiung.js#L62-L240) · 179 satır · zuzahlung_befreiung:delete, zuzahlung_befreiung:upsert

**Yol 2 — `uploadRxNachweise()`** · Ekran: _UI yolu çözülemedi_
- `uploadRxNachweise()` — [dashboard.js:18385](dashboard.js#L18385-L18471) · 87 satır · zuzahlung_befreiung:update, zuzahlung_befreiung:insert

## En çok yazılan tablolar

- `profiles` — 19 ayrı fonksiyon yazıyor
- `bookings` — 16 ayrı fonksiyon yazıyor
- `prescriptions` — 12 ayrı fonksiyon yazıyor
- `document_vorlagen` — 10 ayrı fonksiyon yazıyor
- `services` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `prescription_sessions` — 6 ayrı fonksiyon yazıyor
- `time_offs` — 6 ayrı fonksiyon yazıyor
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

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:8 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:862 · module/abrechnungsstatus.js:614 · module/ausfallrechnung.js:19 · module/behandlungsbestaetigung.js:36 · module/diagnosegruppen-regeln.js:30 · module/fussbefund.js:179 · module/kalender-raster.js:24 · module/kalender-woche.js:39 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/rezeptinfo-geld.js:70 · module/termin-aktionen.js:37 · module/termin-druck.js:27 · module/termin-panel-patient.js:41 · module/warteliste-ansicht.js:26 · module/warteliste-nachruecker.js:46
- `fmt` — dashboard.js:3859 · dashboard.js:8503 · dashboard.js:10479 · dashboard.js:10768 · dashboard.js:10846 · dashboard.js:14563 · dashboard.js:14970 · dashboard.js:22350 · dashboard.js:22436 · dashboard.js:22514 · dashboard.js:22546 · dashboard.js:22606 · module/kalender-raster.js:71 · module/rezeptinfo-geld.js:68
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-freigabe.js:112 · module/arzt-register.js:125 · module/krankenkasse-suche.js:160 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:43 · module/verordnung-uebersicht.js:111 · module/zuzahlung-befreiung.js:261 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:12 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · dashboard.js:19099 · dashboard.js:21018 · dashboard.js:21159 · dashboard.js:21237 · module/podologie-abrechnung.js:994
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:13 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1370 · ops/app.js:84
- `render` — calendar-widget.js:127 · dashboard.js:13923 · dashboard.js:22166 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:110
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:255 · api-backend/server.js:1282 · dashboard.js:3189
- `r2` — api-backend/billing/api/statistik.routes.js:186 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:43 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14 · api-backend/billing/zuzahlung/korrektur.js:16 · module/zuzahlung-rechnen.js:42
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/verordnung-podo.js:105 · module/verordnung-pruefen-knopf.js:44 · module/zuzahlung-korrektur.js:206 · ops/app.js:48
- `init` — attendance.js:297 · booking-request.js:1242 · booking.js:58 · cookie-consent.js:139 · dashboard.js:17538 · kalender.js:149 · onboarding.js:77
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/statistik.routes.js:18 · api-backend/billing/api/verordnung-status.routes.js:42 · api-backend/billing/api/warteliste.routes.js:21 · api-backend/billing/api/zuzahlung.routes.js:47
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:542 · module/arzt-register.js:276 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:209
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/preise_autoupdate.mjs:169 · api-backend/preise_pruefen.mjs:240 · api-backend/sync_heilmittel_katalog.js:106 · stripe-live-setup.js:80
- `cleanup` — dashboard.js:6993 · dashboard.js:7022 · dashboard.js:7125 · dashboard.js:22939 · module/absagegrund-modal.js:81
- `g` — dashboard.js:16304 · dashboard.js:16317 · dashboard.js:16641 · dashboard.js:16707 · module/termin-aktionen.js:359
- `zeile` — module/rechnung-druck.js:31 · module/verordnung-detail.js:249 · module/verordnung-detail.js:376 · module/verordnung-detail.js:433 · module/verordnung-pruefen-knopf.js:135
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:144
- `loadServices` — booking-request.js:419 · booking.js:193 · dashboard.js:9470 · kalender.js:634
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:679 · module/verordnung-detail.js:733
- `closeModal` — dashboard.js:1304 · dashboard.js:12459 · dashboard.js:12878 · ops/app.js:162
- `onEsc` — dashboard.js:7132 · module/rechnung-leistung-picker.js:42 · module/zuzahlung-befreiung.js:155 · module/zuzahlung-korrektur.js:214
- `v` — dashboard.js:13383 · dashboard.js:13408 · dashboard.js:13428 · dashboard.js:17324
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1318 · module/kiosk.js:46
- `q` — booking-request.js:84 · dashboard.js:20507 · script.js:751
- `loadTeam` — booking-request.js:513 · dashboard.js:10516 · kalender.js:238
- `initCalendar` — booking-request.js:562 · dashboard.js:2551 · kalender.js:288
- `zeichne` — module/abrechnungsstatus.js:554 · module/patienten-einwilligung.js:477 · module/rezeptinfo-geld.js:364
- `DE` — module/behandlungsbestaetigung.js:40 · module/patientenkarte.js:37 · module/verordnung-uebersicht.js:105
- `oeffne` — module/kalender-kontextmenue.js:119 · module/leistungen-liste.js:190 · module/verordnung-liste.js:179
- `p` — module/kalender-raster.js:105 · module/podologie-positionen.js:48 · module/podologie-positionen.js:69
- `reload` — ops/board.js:840 · ops/finance.js:1602 · ops/wissen.js:170
- `form` — ops/decisions.js:52 · ops/meetings.js:54 · ops/wissen.js:113
- `clearMsg` — admin-login.js:16 · login.js:167
- `allocate` — api-backend/ai/pii-mask.js:54 · api-backend/ai/pii-mask.js:114
- `unmask` — api-backend/ai/pii-mask.js:80 · api-backend/ai/pii-mask.js:160
