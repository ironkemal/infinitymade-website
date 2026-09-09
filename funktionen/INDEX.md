# Funktionskarte

> Üretim: 2026-09-09 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**2167 fonksiyon** · 236 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 14 bağımsız yazma yolu

**Yol 1 — `cancelRequestBookings()`** · Ekran: _UI yolu çözülemedi_
- `cancelRequestBookings()` — [api-backend/booking/cancel-request.js:3](api-backend/booking/cancel-request.js#L3-L16) · 14 satır · bookings:update

**Yol 2 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:17](api-backend/booking/from-request.js#L17-L114) · 98 satır · bookings:insert

**Yol 3 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:3274](dashboard.js#L3274-L3750) · 477 satır · bookings:update

**Yol 4 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3958](dashboard.js#L3958-L4054) · 97 satır · bookings:insert

**Yol 5 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4238](dashboard.js#L4238-L4304) · 67 satır · bookings:update

**Yol 6 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4321](dashboard.js#L4321-L4335) · 15 satır · bookings:update

**Yol 7 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4365](dashboard.js#L4365-L4457) · 93 satır · bookings:update

**Yol 8 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4459](dashboard.js#L4459-L4527) · 69 satır · bookings:update

**Yol 9 — `korrigiereNoShow()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4549](dashboard.js#L4549-L4587) · 39 satır · bookings:update
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:67](module/booking-status-korrektur.js#L67-L106) · 40 satır · bookings:update

**Yol 10 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:4840](dashboard.js#L4840-L4918) · 79 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:4956](dashboard.js#L4956-L5077) · 122 satır · bookings:insert

**Yol 11 — `doMoveBooking()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:5423](dashboard.js#L5423-L5452) · 30 satır · bookings:update

**Yol 12 — `bindeTermin()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:122](module/verordnung-termine.js#L122-L130) · 9 satır · bookings:update

**Yol 13 — `loeseTermin()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:133](module/verordnung-termine.js#L133-L141) · 9 satır · bookings:update

**Yol 14 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:195](module/warteliste-nachruecker.js#L195-L231) · 37 satır · bookings:insert

### `profiles` — 9 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2348](dashboard.js#L2348-L2458) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5725](dashboard.js#L5725-L5751) · 27 satır · profiles:update

**Yol 3 — `fmt()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `fmt()` — [dashboard.js:10841](dashboard.js#L10841-L13842) · 3002 satır · profiles:update
- `openEmpDetail()` — [dashboard.js:11173](dashboard.js#L11173-L11370) · 198 satır · profiles:update
- `ensureCompanyCode()` — [dashboard.js:13535](dashboard.js#L13535-L13541) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:13552](dashboard.js#L13552-L13565) · 14 satır · profiles:update
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
- `saveEmployee()` — [dashboard.js:14244](dashboard.js#L14244-L14307) · 64 satır · profiles:insert

**Yol 5 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:21376](dashboard.js#L21376-L21433) · 58 satır · profiles:update

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [module/ausfall-einstellungen.js:76](module/ausfall-einstellungen.js#L76-L118) · 43 satır · profiles:update

**Yol 7 — `speichereKonten()`** · Ekran: _UI yolu çözülemedi_
- `speichereKonten()` — [module/buchungskonten.js:283](module/buchungskonten.js#L283-L313) · 31 satır · profiles:update

**Yol 8 — `speichereStufen()`** · Ekran: _UI yolu çözülemedi_
- `speichereStufen()` — [module/selbstzahler-stufen.js:259](module/selbstzahler-stufen.js#L259-L289) · 31 satır · profiles:update

**Yol 9 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `prescriptions` — 8 bağımsız yazma yolu

**Yol 1 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:7177](dashboard.js#L7177-L7249) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:8489](dashboard.js#L8489-L8525) · 37 satır · prescriptions:update

**Yol 2 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:7252](dashboard.js#L7252-L7320) · 69 satır · prescriptions:update

**Yol 3 — `renderAbrechnungHistory()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `renderAbrechnungHistory()` — [dashboard.js:17900](dashboard.js#L17900-L17999) · 100 satır · prescriptions:update

**Yol 4 — `triggerStorno()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `triggerStorno()` — [dashboard.js:18941](dashboard.js#L18941-L19000) · 60 satır · prescriptions:update

**Yol 5 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [module/rechnung-dmrz.js:109](module/rechnung-dmrz.js#L109-L182) · 74 satır · prescriptions:update

**Yol 6 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L120) · 39 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:85](module/sitzungsfortschritt.js#L85-L113) · 29 satır · prescriptions:update

**Yol 7 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:126](module/verordnung-einheiten.js#L126-L160) · 35 satır · prescriptions:update

**Yol 8 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `services` — 6 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7604](dashboard.js#L7604-L7643) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:9486](dashboard.js#L9486-L9513) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:9682](dashboard.js#L9682-L9717) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `renderServices()` — [dashboard.js:9869](dashboard.js#L9869-L9893) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:16847](dashboard.js#L16847-L16928) · 82 satır · services:insert

**Yol 6 — `ensureBlockerServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlockerServices()` — [module/kalender-blocker.js:71](module/kalender-blocker.js#L71-L112) · 42 satır · services:update, services:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:10186](dashboard.js#L10186-L10206) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:16847](dashboard.js#L16847-L16928) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:16930](dashboard.js#L16930-L16947) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `ensureBusinessCoords()` — [dashboard.js:20864](dashboard.js#L20864-L20893) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `leads` — 4 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4589](dashboard.js#L4589-L4735) · 147 satır · leads:update

**Yol 2 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:7507](dashboard.js#L7507-L7594) · 88 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:19516](dashboard.js#L19516-L19639) · 124 satır · leads:insert

**Yol 4 — `verordnungPatientenAbgleich()`** · Ekran: _UI yolu çözülemedi_
- `verordnungPatientenAbgleich()` — [module/verordnung-patient-abgleich.js:18](module/verordnung-patient-abgleich.js#L18-L92) · 75 satır · leads:update

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3958](dashboard.js#L3958-L4054) · 97 satır · prescription_sessions:update

**Yol 2 — `korrigiereNoShow()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4549](dashboard.js#L4549-L4587) · 39 satır · prescription_sessions:update
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:67](module/booking-status-korrektur.js#L67-L106) · 40 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7382](dashboard.js#L7382-L7400) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7415](dashboard.js#L7415-L7505) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:86](module/sitzung-abgleich.js#L86-L112) · 27 satır · prescription_sessions:upsert

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:55](api-backend/lib/arzt-registry.js#L55-L170) · 116 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:15871](dashboard.js#L15871-L15878) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:15880](dashboard.js#L15880-L15925) · 46 satır · aerzte:update

### `fahrten` — 3 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4238](dashboard.js#L4238-L4304) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4365](dashboard.js#L4365-L4457) · 93 satır · fahrten:upsert

**Yol 3 — `toLocal()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `toLocal()` — [dashboard.js:18517](dashboard.js#L18517-L18580) · 64 satır · fahrten:update, fahrten:delete

### `podologie_behandlungen` — 3 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:388](module/podologie-abrechnung.js#L388-L798) · 411 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:165](module/rechnung-bruecke.js#L165-L174) · 10 satır · podologie_behandlungen:update

**Yol 3 — `verknuepfungLoesen()`** · Ekran: _UI yolu çözülemedi_
- `verknuepfungLoesen()` — [module/rechnung-bruecke.js:182](module/rechnung-bruecke.js#L182-L190) · 9 satır · podologie_behandlungen:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:10210](dashboard.js#L10210-L10283) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `fmt()` — [dashboard.js:10841](dashboard.js#L10841-L13842) · 3002 satır · breaks:insert, breaks:delete
- `loadEmpHours()` — [dashboard.js:11464](dashboard.js#L11464-L11554) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `fmt()` — [dashboard.js:10841](dashboard.js#L10841-L13842) · 3002 satır · calendar_integrations:delete
- `loadSettings()` — [dashboard.js:12277](dashboard.js#L12277-L12393) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:747](kalender.js#L747-L769) · 23 satır · calendar_integrations:delete

### `email_logs` — 2 bağımsız yazma yolu

**Yol 1 — `loadPatientDetailMails()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `loadPatientDetailMails()` — [dashboard.js:8910](dashboard.js#L8910-L8946) · 37 satır · email_logs:update

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `fmt()` — [dashboard.js:10841](dashboard.js#L10841-L13842) · 3002 satır · email_logs:insert

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `fmt()` — [dashboard.js:10841](dashboard.js#L10841-L13842) · 3002 satır · employee_services:insert, employee_services:delete
- `loadEmpServices()` — [dashboard.js:11556](dashboard.js#L11556-L11640) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · employee_services:insert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:15035](dashboard.js#L15035-L15129) · 95 satır · invoices:update, invoices:insert

**Yol 2 — `frageZahlungsstatus()`** · Ekran: ortak yardımcı — 27 modülden çağrılıyor
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:58](module/rechnung-zahlung.js#L58-L65) · 8 satır · invoices:update
- `frageZahlungsstatus()` — [module/rechnung-zahlung.js:77](module/rechnung-zahlung.js#L77-L140) · 64 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:288](admin.js#L288-L317) · 30 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · module_visibility:upsert

### `patient_consents` — 2 bağımsız yazma yolu

**Yol 1 — `speichereEinwilligung()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:295](module/patienten-einwilligung.js#L295-L333) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `widerrufen()` — [module/patienten-einwilligung.js:535](module/patienten-einwilligung.js#L535-L552) · 18 satır · patient_consents:update

### `time_offs` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `loadTeam()` — [dashboard.js:10511](dashboard.js#L10511-L10706) · 196 satır · time_offs:insert
- `deleteEmpTimeOff()` — [dashboard.js:10777](dashboard.js#L10777-L10791) · 15 satır · time_offs:delete
- `fmt()` — [dashboard.js:10841](dashboard.js#L10841-L13842) · 3002 satır · time_offs:delete, time_offs:insert
- `deleteUrlaub()` — [dashboard.js:10851](dashboard.js#L10851-L10858) · 8 satır · time_offs:delete
- `openEmpDetail()` — [dashboard.js:11173](dashboard.js#L11173-L11370) · 198 satır · time_offs:insert

**Yol 2 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:10793](dashboard.js#L10793-L10820) · 28 satır · time_offs:insert

### `user_preferences` — 2 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `saveUserPref()` — [dashboard.js:14470](dashboard.js#L14470-L14480) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:17009](dashboard.js#L17009-L17024) · 16 satır · user_preferences:upsert

### `vehicles` — 2 bağımsız yazma yolu

**Yol 1 — `saveQuickVehicleHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveQuickVehicleHandler()` — [dashboard.js:4215](dashboard.js#L4215-L4236) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 10 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:18616](dashboard.js#L18616-L18677) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:18719](dashboard.js#L18719-L18751) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `reportSidebarVisibility()` — [dashboard.js:971](dashboard.js#L971-L995) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 9 modülden çağrılıyor
- `fmt()` — [dashboard.js:10841](dashboard.js#L10841-L13842) · 3002 satır · working_hours:upsert
- `loadEmpHours()` — [dashboard.js:11464](dashboard.js#L11464-L11554) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

## En çok yazılan tablolar

- `profiles` — 21 ayrı fonksiyon yazıyor
- `bookings` — 16 ayrı fonksiyon yazıyor
- `prescriptions` — 10 ayrı fonksiyon yazıyor
- `document_vorlagen` — 10 ayrı fonksiyon yazıyor
- `services` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `prescription_sessions` — 6 ayrı fonksiyon yazıyor
- `time_offs` — 6 ayrı fonksiyon yazıyor
- `businesses` — 5 ayrı fonksiyon yazıyor
- `leads` — 4 ayrı fonksiyon yazıyor
- `employee_business_assignments` — 4 ayrı fonksiyon yazıyor
- `employee_services` — 4 ayrı fonksiyon yazıyor
- `ops_finance_expenses` — 4 ayrı fonksiyon yazıyor
- `aerzte` — 3 ayrı fonksiyon yazıyor
- `vehicles` — 3 ayrı fonksiyon yazıyor
- `fahrten` — 3 ayrı fonksiyon yazıyor
- `breaks` — 3 ayrı fonksiyon yazıyor
- `working_hours` — 3 ayrı fonksiyon yazıyor
- `calendar_integrations` — 3 ayrı fonksiyon yazıyor
- `invoices` — 3 ayrı fonksiyon yazıyor

## Bilinçli aynalar — kod içinde beyan edilmiş (kopya DEĞiL)

Frontend/backend paylaşılan modül yolu yok; bu yüzden aynı kural iki dosyaya
yazılmış ve kod bunu kendi yorumunda söylemiş („Spiegel von“ / „Identisch mit“).
Bunları birleştirme — birleştirilecek olsaydı zaten tek dosya olurdu.

- `dgStamm()` — [api-backend/billing/api/verordnung-status.routes.js:91](api-backend/billing/api/verordnung-status.routes.js#L91-L95) — Spiegel von `dgRoot()` in verordnung-podo
- `fehlendePflichtangaben()` — [module/beleg-druck.js:55](module/beleg-druck.js#L55-L60) — Identisch mit `fehlendePflichtangaben()` im Backend — beim Ändern beide
- `leitsymptomatikAlsBitmaske()` — [api-backend/billing/dta/leitsymptomatik.js:58](api-backend/billing/dta/leitsymptomatik.js#L58-L96) — Spiegel von `leitsymptomatikListe()` in `module/verordnung-pruefung
- `leitsymptomatikListe()` — [module/verordnung-pruefung.js:108](module/verordnung-pruefung.js#L108-L120) — Spiegel von `api-backend/billing/dta/leitsymptomatik
- `pruefTitel()` — [module/verordnung-uebersicht.js:534](module/verordnung-uebersicht.js#L534-L540) — Spiegel von `pruefTitel` in module/verordnung-liste

## Aynı ada sahip birden fazla tanım

Bu bir kopya listesi değil, bir isim çakışması listesi — aynı isim farklı iş yapıyor olabilir.
`aynalar` doluysa o konum bilinçli ayna; boşsa isim çakışması başka bir şeydir, incele.

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:23 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:887 · module/abrechnung-status.js:157 · module/abrechnungsstatus.js:614 · module/ausfallrechnung.js:19 · module/behandlungsbestaetigung.js:36 · module/diagnosegruppen-regeln.js:30 · module/fussbefund.js:179 · module/kalender-raster.js:24 · module/kalender-woche.js:39 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/patient-termine.js:1 · module/rezeptinfo-geld.js:70 · module/termin-aktionen.js:39 · module/termin-druck.js:27 · module/termin-panel-patient.js:41 · module/warteliste-ansicht.js:26 · module/warteliste-nachruecker.js:46
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-auswahl.js:420 · module/abrechnung-freigabe.js:112 · module/arzt-register.js:125 · module/krankenkasse-suche.js:173 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:43 · module/rechnung-zahlungseingang.js:164 · module/verordnung-feldmarker.js:70 · module/verordnung-uebersicht.js:112 · module/zuzahlung-befreiung.js:261 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `fmt` — dashboard.js:3885 · dashboard.js:8534 · dashboard.js:10474 · dashboard.js:10763 · dashboard.js:10841 · dashboard.js:14558 · dashboard.js:20428 · dashboard.js:20514 · dashboard.js:20592 · dashboard.js:20624 · dashboard.js:20684 · module/kalender-raster.js:71 · module/rechnung-ansicht.js:184 · module/rezeptinfo-geld.js:68
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:28 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1395 · ops/app.js:84
- `render` — calendar-widget.js:127 · dashboard.js:13918 · dashboard.js:20244 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:116
- `$` — attendance.js:10 · employee-signup.js:10 · module/kiosk.js:59 · module/rechnung-zahlungseingang.js:368 · module/verordnung-podo.js:106 · module/verordnung-pruefen-knopf.js:45 · module/zuzahlung-korrektur.js:206 · ops/app.js:48
- `g` — dashboard.js:15938 · dashboard.js:15951 · dashboard.js:16248 · dashboard.js:16319 · module/rezept-in-maske.js:39 · module/verordnung-anlegen.js:28 · module/verordnung-maske.js:324 · module/verordnung-nachweis.js:28
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:259 · api-backend/server.js:1289 · dashboard.js:3215
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:26 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/rechnung-zahlung.routes.js:84 · api-backend/billing/api/statistik.routes.js:19 · api-backend/billing/api/verordnung-status.routes.js:42 · api-backend/billing/api/warteliste.routes.js:21 · api-backend/billing/api/zuzahlung.routes.js:47
- `r2` — api-backend/billing/api/statistik.routes.js:176 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:55 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/zuzahlung/calculator.js:14 · api-backend/billing/zuzahlung/korrektur.js:16 · module/zuzahlung-rechnen.js:42
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:27 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · module/geld.js:48
- `init` — attendance.js:297 · booking-request.js:1242 · booking.js:58 · cookie-consent.js:139 · dashboard.js:17072 · kalender.js:149 · onboarding.js:77
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:542 · module/arzt-register.js:276 · module/rechnung-zahlungseingang.js:424 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:209
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/preise_autoupdate.mjs:169 · api-backend/preise_pruefen.mjs:240 · api-backend/sync_heilmittel_katalog.js:106 · stripe-live-setup.js:80
- `cleanup` — dashboard.js:7014 · dashboard.js:7043 · dashboard.js:7146 · dashboard.js:21037 · module/absagegrund-modal.js:81
- `zeile` — module/rechnung-druck.js:31 · module/verordnung-detail.js:255 · module/verordnung-detail.js:382 · module/verordnung-detail.js:439 · module/verordnung-pruefen-knopf.js:148
- `showMsg` — admin-login.js:15 · attendance.js:68 · employee-signup.js:130 · login.js:163
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:145
- `loadServices` — booking-request.js:419 · booking.js:193 · dashboard.js:9465 · kalender.js:635
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:679 · module/verordnung-detail.js:800
- `closeModal` — dashboard.js:1329 · dashboard.js:12454 · dashboard.js:12873 · ops/app.js:162
- `onEsc` — dashboard.js:7153 · module/rechnung-leistung-picker.js:46 · module/zuzahlung-befreiung.js:155 · module/zuzahlung-korrektur.js:214
- `v` — dashboard.js:13378 · dashboard.js:13403 · dashboard.js:13423 · dashboard.js:16858
- `zeichne` — module/abrechnung-auswahl.js:424 · module/abrechnungsstatus.js:554 · module/patienten-einwilligung.js:477 · module/rezeptinfo-geld.js:364
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:192
- `showToast` — admin.js:22 · dashboard.js:1343 · module/kiosk.js:46
- `q` — booking-request.js:84 · dashboard.js:18590 · script.js:751
- `loadTeam` — booking-request.js:513 · dashboard.js:10511 · kalender.js:238
- `initCalendar` — booking-request.js:562 · dashboard.js:2577 · kalender.js:288
- `el` — module/arzt-register.js:251 · module/fussbefund.js:207 · module/verordnung-maske.js:482
- `DE` — module/behandlungsbestaetigung.js:40 · module/patientenkarte.js:37 · module/verordnung-uebersicht.js:106
- `oeffne` — module/kalender-kontextmenue.js:119 · module/leistungen-liste.js:190 · module/verordnung-liste.js:204
- `p` — module/kalender-raster.js:105 · module/podologie-positionen.js:48 · module/podologie-positionen.js:69
- `reload` — ops/board.js:840 · ops/finance.js:1602 · ops/wissen.js:170
- `form` — ops/decisions.js:52 · ops/meetings.js:54 · ops/wissen.js:113
- `clearMsg` — admin-login.js:16 · login.js:167
- `allocate` — api-backend/ai/pii-mask.js:54 · api-backend/ai/pii-mask.js:114
