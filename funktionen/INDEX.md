# Funktionskarte

> Üretim: 2026-09-12 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**2251 fonksiyon** · 244 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 14 bağımsız yazma yolu

**Yol 1 — `cancelRequestBookings()`** · Ekran: _UI yolu çözülemedi_
- `cancelRequestBookings()` — [api-backend/booking/cancel-request.js:3](api-backend/booking/cancel-request.js#L3-L16) · 14 satır · bookings:update

**Yol 2 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:17](api-backend/booking/from-request.js#L17-L114) · 98 satır · bookings:insert

**Yol 3 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:3238](dashboard.js#L3238-L3714) · 477 satır · bookings:update

**Yol 4 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3922](dashboard.js#L3922-L4018) · 97 satır · bookings:insert

**Yol 5 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4202](dashboard.js#L4202-L4268) · 67 satır · bookings:update

**Yol 6 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4285](dashboard.js#L4285-L4299) · 15 satır · bookings:update

**Yol 7 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4329](dashboard.js#L4329-L4421) · 93 satır · bookings:update

**Yol 8 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4423](dashboard.js#L4423-L4491) · 69 satır · bookings:update

**Yol 9 — `korrigiereNoShow()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4513](dashboard.js#L4513-L4551) · 39 satır · bookings:update
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:67](module/booking-status-korrektur.js#L67-L106) · 40 satır · bookings:update

**Yol 10 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:4804](dashboard.js#L4804-L4882) · 79 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:4920](dashboard.js#L4920-L5041) · 122 satır · bookings:insert

**Yol 11 — `doMoveBooking()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:5387](dashboard.js#L5387-L5416) · 30 satır · bookings:update

**Yol 12 — `bindeTermin()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:122](module/verordnung-termine.js#L122-L130) · 9 satır · bookings:update

**Yol 13 — `loeseTermin()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:133](module/verordnung-termine.js#L133-L141) · 9 satır · bookings:update

**Yol 14 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:195](module/warteliste-nachruecker.js#L195-L231) · 37 satır · bookings:insert

### `profiles` — 9 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2312](dashboard.js#L2312-L2422) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5689](dashboard.js#L5689-L5715) · 27 satır · profiles:update

**Yol 3 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10786](dashboard.js#L10786-L13787) · 3002 satır · profiles:update
- `openEmpDetail()` — [dashboard.js:11118](dashboard.js#L11118-L11315) · 198 satır · profiles:update
- `ensureCompanyCode()` — [dashboard.js:13480](dashboard.js#L13480-L13486) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:13497](dashboard.js#L13497-L13510) · 14 satır · profiles:update
- `init()` — [kalender.js:154](kalender.js#L154-L206) · 53 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1633](module/fussbefund.js#L1633-L1697) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:870](onboarding.js#L870-L1015) · 146 satır · profiles:update

**Yol 4 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:14189](dashboard.js#L14189-L14252) · 64 satır · profiles:insert

**Yol 5 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:21186](dashboard.js#L21186-L21243) · 58 satır · profiles:update

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [module/ausfall-einstellungen.js:76](module/ausfall-einstellungen.js#L76-L118) · 43 satır · profiles:update

**Yol 7 — `speichereKonten()`** · Ekran: _UI yolu çözülemedi_
- `speichereKonten()` — [module/buchungskonten.js:283](module/buchungskonten.js#L283-L313) · 31 satır · profiles:update

**Yol 8 — `speichereStufen()`** · Ekran: _UI yolu çözülemedi_
- `speichereStufen()` — [module/selbstzahler-stufen.js:259](module/selbstzahler-stufen.js#L259-L289) · 31 satır · profiles:update

**Yol 9 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `prescriptions` — 7 bağımsız yazma yolu

**Yol 1 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:7123](dashboard.js#L7123-L7195) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:8435](dashboard.js#L8435-L8471) · 37 satır · prescriptions:update

**Yol 2 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:7198](dashboard.js#L7198-L7266) · 69 satır · prescriptions:update

**Yol 3 — `triggerStorno()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `triggerStorno()` — [dashboard.js:18770](dashboard.js#L18770-L18829) · 60 satır · prescriptions:update

**Yol 4 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [module/rechnung-dmrz.js:109](module/rechnung-dmrz.js#L109-L182) · 74 satır · prescriptions:update

**Yol 5 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:82](module/sitzungsfortschritt.js#L82-L120) · 39 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:85](module/sitzungsfortschritt.js#L85-L113) · 29 satır · prescriptions:update

**Yol 6 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:126](module/verordnung-einheiten.js#L126-L160) · 35 satır · prescriptions:update

**Yol 7 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:249](module/zuzahlung-befreiung.js#L249-L259) · 11 satır · prescriptions:update

### `services` — 6 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7550](dashboard.js#L7550-L7589) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:9431](dashboard.js#L9431-L9458) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:9627](dashboard.js#L9627-L9662) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `renderServices()` — [dashboard.js:9814](dashboard.js#L9814-L9838) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:16792](dashboard.js#L16792-L16873) · 82 satır · services:insert

**Yol 6 — `ensureBlockerServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlockerServices()` — [module/kalender-blocker.js:71](module/kalender-blocker.js#L71-L112) · 42 satır · services:update, services:insert

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:10131](dashboard.js#L10131-L10151) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:16792](dashboard.js#L16792-L16873) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:16875](dashboard.js#L16875-L16892) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `ensureBusinessCoords()` — [dashboard.js:20674](dashboard.js#L20674-L20703) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `leads` — 4 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4553](dashboard.js#L4553-L4699) · 147 satır · leads:update

**Yol 2 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:7453](dashboard.js#L7453-L7540) · 88 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:19326](dashboard.js#L19326-L19449) · 124 satır · leads:insert

**Yol 4 — `verordnungPatientenAbgleich()`** · Ekran: _UI yolu çözülemedi_
- `verordnungPatientenAbgleich()` — [module/verordnung-patient-abgleich.js:18](module/verordnung-patient-abgleich.js#L18-L92) · 75 satır · leads:update

### `prescription_sessions` — 4 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3922](dashboard.js#L3922-L4018) · 97 satır · prescription_sessions:update

**Yol 2 — `korrigiereNoShow()`** · Ekran: _UI yolu çözülemedi_
- `handlePatientNichtErschienen()` — [dashboard.js:4513](dashboard.js#L4513-L4551) · 39 satır · prescription_sessions:update
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:67](module/booking-status-korrektur.js#L67-L106) · 40 satır · prescription_sessions:update

**Yol 3 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7328](dashboard.js#L7328-L7346) · 19 satır · prescription_sessions:update

**Yol 4 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7361](dashboard.js#L7361-L7451) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:86](module/sitzung-abgleich.js#L86-L112) · 27 satır · prescription_sessions:upsert

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:55](api-backend/lib/arzt-registry.js#L55-L170) · 116 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:15816](dashboard.js#L15816-L15823) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:15825](dashboard.js#L15825-L15870) · 46 satır · aerzte:update

### `fahrten` — 3 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4202](dashboard.js#L4202-L4268) · 67 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4329](dashboard.js#L4329-L4421) · 93 satır · fahrten:upsert

**Yol 3 — `toLocal()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `toLocal()` — [dashboard.js:18346](dashboard.js#L18346-L18409) · 64 satır · fahrten:update, fahrten:delete

### `podologie_behandlungen` — 3 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:388](module/podologie-abrechnung.js#L388-L798) · 411 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:165](module/rechnung-bruecke.js#L165-L174) · 10 satır · podologie_behandlungen:update

**Yol 3 — `verknuepfungLoesen()`** · Ekran: _UI yolu çözülemedi_
- `verknuepfungLoesen()` — [module/rechnung-bruecke.js:182](module/rechnung-bruecke.js#L182-L190) · 9 satır · podologie_behandlungen:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:10155](dashboard.js#L10155-L10228) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10786](dashboard.js#L10786-L13787) · 3002 satır · breaks:insert, breaks:delete
- `loadEmpHours()` — [dashboard.js:11409](dashboard.js#L11409-L11499) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10786](dashboard.js#L10786-L13787) · 3002 satır · calendar_integrations:delete
- `loadSettings()` — [dashboard.js:12222](dashboard.js#L12222-L12338) · 117 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:750](kalender.js#L750-L772) · 23 satır · calendar_integrations:delete

### `email_logs` — 2 bağımsız yazma yolu

**Yol 1 — `loadPatientDetailMails()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loadPatientDetailMails()` — [dashboard.js:8856](dashboard.js#L8856-L8892) · 37 satır · email_logs:update

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10786](dashboard.js#L10786-L13787) · 3002 satır · email_logs:insert

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10786](dashboard.js#L10786-L13787) · 3002 satır · employee_services:insert, employee_services:delete
- `loadEmpServices()` — [dashboard.js:11501](dashboard.js#L11501-L11585) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · employee_services:insert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:14980](dashboard.js#L14980-L15074) · 95 satır · invoices:update, invoices:insert

**Yol 2 — `frageZahlungsstatus()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:68](module/rechnung-zahlung.js#L68-L75) · 8 satır · invoices:update
- `frageZahlungsstatus()` — [module/rechnung-zahlung.js:87](module/rechnung-zahlung.js#L87-L150) · 64 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:288](admin.js#L288-L317) · 30 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · module_visibility:upsert

### `patient_consents` — 2 bağımsız yazma yolu

**Yol 1 — `speichereEinwilligung()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:295](module/patienten-einwilligung.js#L295-L333) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `widerrufen()` — [module/patienten-einwilligung.js:535](module/patienten-einwilligung.js#L535-L552) · 18 satır · patient_consents:update

### `time_offs` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loadTeam()` — [dashboard.js:10456](dashboard.js#L10456-L10651) · 196 satır · time_offs:insert
- `deleteEmpTimeOff()` — [dashboard.js:10722](dashboard.js#L10722-L10736) · 15 satır · time_offs:delete
- `fmt()` — [dashboard.js:10786](dashboard.js#L10786-L13787) · 3002 satır · time_offs:delete, time_offs:insert
- `deleteUrlaub()` — [dashboard.js:10796](dashboard.js#L10796-L10803) · 8 satır · time_offs:delete
- `openEmpDetail()` — [dashboard.js:11118](dashboard.js#L11118-L11315) · 198 satır · time_offs:insert

**Yol 2 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:10738](dashboard.js#L10738-L10765) · 28 satır · time_offs:insert

### `user_preferences` — 2 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `saveUserPref()` — [dashboard.js:14415](dashboard.js#L14415-L14425) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:16954](dashboard.js#L16954-L16969) · 16 satır · user_preferences:upsert

### `vehicles` — 2 bağımsız yazma yolu

**Yol 1 — `saveQuickVehicleHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveQuickVehicleHandler()` — [dashboard.js:4179](dashboard.js#L4179-L4200) · 22 satır · vehicles:insert

**Yol 2 — `loadFbVehicles()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `loadFbVehicles()` — [dashboard.js:18445](dashboard.js#L18445-L18506) · 62 satır · vehicles:delete
- `saveVehicleEdit()` — [dashboard.js:18548](dashboard.js#L18548-L18580) · 33 satır · vehicles:update, vehicles:insert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `reportSidebarVisibility()` — [dashboard.js:935](dashboard.js#L935-L959) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10786](dashboard.js#L10786-L13787) · 3002 satır · working_hours:upsert
- `loadEmpHours()` — [dashboard.js:11409](dashboard.js#L11409-L11499) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

## En çok yazılan tablolar

- `profiles` — 21 ayrı fonksiyon yazıyor
- `bookings` — 16 ayrı fonksiyon yazıyor
- `document_vorlagen` — 10 ayrı fonksiyon yazıyor
- `prescriptions` — 9 ayrı fonksiyon yazıyor
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

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:23 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:851 · module/abrechnung-status.js:170 · module/abrechnungsstatus.js:622 · module/ausfallrechnung.js:19 · module/behandlungsbestaetigung.js:36 · module/diagnosegruppen-regeln.js:30 · module/fussbefund.js:179 · module/kalender-raster.js:24 · module/kalender-woche.js:39 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/patient-termine.js:1 · module/rezeptinfo-geld.js:70 · module/termin-aktionen.js:39 · module/termin-druck.js:27 · module/termin-panel-patient.js:41 · module/warteliste-ansicht.js:26 · module/warteliste-nachruecker.js:46
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-auswahl.js:506 · module/abrechnung-detail.js:116 · module/abrechnung-freigabe.js:112 · module/arzt-register.js:125 · module/krankenkasse-suche.js:173 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:43 · module/rechnung-zahlungseingang.js:164 · module/verordnung-feldmarker.js:80 · module/verordnung-uebersicht.js:112 · module/zuzahlung-befreiung.js:261 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `fmt` — api-backend/setup/router.js:110 · dashboard.js:3849 · dashboard.js:8480 · dashboard.js:10419 · dashboard.js:10708 · dashboard.js:10786 · dashboard.js:14503 · dashboard.js:20238 · dashboard.js:20324 · dashboard.js:20402 · dashboard.js:20434 · dashboard.js:20494 · module/kalender-raster.js:71 · module/rechnung-ansicht.js:184 · module/rezeptinfo-geld.js:68
- `r2` — api-backend/billing/api/abrechnung.routes.js:1280 · api-backend/billing/api/statistik.routes.js:176 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:55 · api-backend/billing/preise/resolver.js:24 · api-backend/billing/utils/abrechnung-zeilen.js:36 · api-backend/billing/zuzahlung/calculator.js:14 · api-backend/billing/zuzahlung/korrektur.js:16 · module/abrechnung-verlauf.js:126 · module/zuzahlung-rechnen.js:42
- `fmtDate` — api-backend/billing/dta/encoding.js:47 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:28 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1359 · ops/app.js:84
- `render` — calendar-widget.js:127 · dashboard.js:13863 · dashboard.js:20054 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:116
- `$` — attendance.js:9 · employee-signup.js:10 · module/kiosk.js:59 · module/rechnung-zahlungseingang.js:368 · module/verordnung-podo.js:106 · module/verordnung-pruefen-knopf.js:45 · module/zuzahlung-korrektur.js:206 · ops/app.js:48
- `init` — attendance.js:296 · booking-request.js:1246 · booking.js:58 · cookie-consent.js:139 · dashboard.js:17017 · kalender.js:154 · onboarding.js:77 · setup.js:225
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:550 · module/arzt-register.js:276 · module/rechnung-zahlungseingang.js:424 · module/verordnung-feldmarker.js:240 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:209
- `g` — dashboard.js:15883 · dashboard.js:15896 · dashboard.js:16193 · dashboard.js:16264 · module/rezept-in-maske.js:39 · module/verordnung-anlegen.js:28 · module/verordnung-maske.js:324 · module/verordnung-nachweis.js:28
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:301 · api-backend/server.js:1422 · dashboard.js:3179
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:27 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/rechnung-zahlung.routes.js:84 · api-backend/billing/api/statistik.routes.js:19 · api-backend/billing/api/verordnung-status.routes.js:42 · api-backend/billing/api/warteliste.routes.js:21 · api-backend/billing/api/zuzahlung.routes.js:47
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:27 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · module/geld.js:48
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:679 · module/kassenbuch-beleg.js:91 · module/verordnung-detail.js:800
- `cleanup` — dashboard.js:6978 · dashboard.js:7007 · dashboard.js:7094 · dashboard.js:20847 · module/absagegrund-modal.js:81
- `zeile` — module/rechnung-druck.js:31 · module/verordnung-detail.js:255 · module/verordnung-detail.js:382 · module/verordnung-detail.js:439 · module/verordnung-pruefen-knopf.js:148
- `showMsg` — admin-login.js:15 · attendance.js:67 · employee-signup.js:130 · login.js:168
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:145
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/preise_autoupdate.mjs:169 · api-backend/preise_pruefen.mjs:240 · api-backend/sync_heilmittel_katalog.js:106
- `loadServices` — booking-request.js:423 · booking.js:199 · dashboard.js:9411 · kalender.js:638
- `closeModal` — dashboard.js:1293 · dashboard.js:12399 · dashboard.js:12818 · ops/app.js:162
- `onEsc` — dashboard.js:7101 · module/rechnung-leistung-picker.js:46 · module/zuzahlung-befreiung.js:155 · module/zuzahlung-korrektur.js:214
- `v` — dashboard.js:13323 · dashboard.js:13348 · dashboard.js:13368 · dashboard.js:16803
- `zeichne` — module/abrechnung-auswahl.js:510 · module/abrechnungsstatus.js:562 · module/patienten-einwilligung.js:477 · module/rezeptinfo-geld.js:364
- `zeigeFehler` — module/abrechnung-detail.js:464 · module/abrechnung-detail.js:506 · module/zuzahlung-befreiung.js:149 · module/zuzahlung-korrektur.js:208
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:208
- `showToast` — admin.js:22 · dashboard.js:1307 · module/kiosk.js:46
- `loadTeam` — booking-request.js:517 · dashboard.js:10456 · kalender.js:243
- `initCalendar` — booking-request.js:566 · dashboard.js:2541 · kalender.js:293
- `applyLang` — kalender.js:79 · login.js:119 · setup.js:158
- `feld` — module/abrechnung-auswahl.js:694 · module/fussbefund.js:282 · module/rezeptinfo-geld.js:299
- `zeileHtml` — module/abrechnung-detail.js:276 · module/fussbefund.js:1586 · module/verordnung-liste.js:149
- `el` — module/arzt-register.js:251 · module/fussbefund.js:207 · module/verordnung-maske.js:482
- `DE` — module/behandlungsbestaetigung.js:40 · module/patientenkarte.js:37 · module/verordnung-uebersicht.js:106
- `oeffne` — module/kalender-kontextmenue.js:119 · module/leistungen-liste.js:190 · module/verordnung-liste.js:204
- `p` — module/kalender-raster.js:105 · module/podologie-positionen.js:52 · module/podologie-positionen.js:73
- `reload` — ops/board.js:840 · ops/finance.js:1602 · ops/wissen.js:170
