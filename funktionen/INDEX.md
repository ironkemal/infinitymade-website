# Funktionskarte

> Üretim: 2026-09-30 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**2618 fonksiyon** · 303 dosya · 39 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 14 bağımsız yazma yolu

**Yol 1 — `cancelRequestBookings()`** · Ekran: _UI yolu çözülemedi_
- `cancelRequestBookings()` — [api-backend/booking/cancel-request.js:3](api-backend/booking/cancel-request.js#L3-L16) · 14 satır · bookings:update

**Yol 2 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:17](api-backend/booking/from-request.js#L17-L114) · 98 satır · bookings:insert

**Yol 3 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:3253](dashboard.js#L3253-L3665) · 413 satır · bookings:update

**Yol 4 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3838](dashboard.js#L3838-L3934) · 97 satır · bookings:insert

**Yol 5 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4082](dashboard.js#L4082-L4143) · 62 satır · bookings:update

**Yol 6 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:4160](dashboard.js#L4160-L4174) · 15 satır · bookings:update

**Yol 7 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4204](dashboard.js#L4204-L4289) · 86 satır · bookings:update

**Yol 8 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:4291](dashboard.js#L4291-L4370) · 80 satır · bookings:update

**Yol 9 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:4673](dashboard.js#L4673-L4751) · 79 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:4789](dashboard.js#L4789-L4910) · 122 satır · bookings:insert

**Yol 10 — `doMoveBooking()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:5246](dashboard.js#L5246-L5275) · 30 satır · bookings:update

**Yol 11 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:68](module/booking-status-korrektur.js#L68-L117) · 50 satır · bookings:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · bookings:update

**Yol 12 — `bindeTermin()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:122](module/verordnung-termine.js#L122-L130) · 9 satır · bookings:update

**Yol 13 — `loeseTermin()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:133](module/verordnung-termine.js#L133-L141) · 9 satır · bookings:update

**Yol 14 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:198](module/warteliste-nachruecker.js#L198-L234) · 37 satır · bookings:insert

### `profiles` — 9 bağımsız yazma yolu

**Yol 1 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:2344](dashboard.js#L2344-L2454) · 111 satır · profiles:update

**Yol 2 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5547](dashboard.js#L5547-L5573) · 27 satır · profiles:update

**Yol 3 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10517](dashboard.js#L10517-L13518) · 3002 satır · profiles:update
- `openEmpDetail()` — [dashboard.js:10849](dashboard.js#L10849-L11046) · 198 satır · profiles:update
- `ensureCompanyCode()` — [dashboard.js:13143](dashboard.js#L13143-L13149) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:13160](dashboard.js#L13160-L13173) · 14 satır · profiles:update
- `init()` — [kalender.js:161](kalender.js#L161-L213) · 53 satır · profiles:update
- `wireAbrechnungSettings()` — [module/abrechnung-einstellungen.js:271](module/abrechnung-einstellungen.js#L271-L426) · 156 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1660](module/fussbefund.js#L1660-L1724) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:870](onboarding.js#L870-L1015) · 146 satır · profiles:update

**Yol 4 — `saveEmployee()`** · Ekran: _UI yolu çözülemedi_
- `saveEmployee()` — [dashboard.js:13669](dashboard.js#L13669-L13732) · 64 satır · profiles:insert

**Yol 5 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:20344](dashboard.js#L20344-L20401) · 58 satır · profiles:update

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [module/ausfall-einstellungen.js:76](module/ausfall-einstellungen.js#L76-L118) · 43 satır · profiles:update

**Yol 7 — `speichereKonten()`** · Ekran: _UI yolu çözülemedi_
- `speichereKonten()` — [module/buchungskonten.js:295](module/buchungskonten.js#L295-L325) · 31 satır · profiles:update

**Yol 8 — `speichereStufen()`** · Ekran: _UI yolu çözülemedi_
- `speichereStufen()` — [module/selbstzahler-stufen.js:259](module/selbstzahler-stufen.js#L259-L289) · 31 satır · profiles:update

**Yol 9 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `prescriptions` — 8 bağımsız yazma yolu

**Yol 1 — `kostentraegerIkZurueckschreiben()`** · Ekran: _UI yolu çözülemedi_
- `kostentraegerIkZurueckschreiben()` — [api-backend/billing/utils/kostentraeger-frisch.js:114](api-backend/billing/utils/kostentraeger-frisch.js#L114-L136) · 23 satır · prescriptions:update

**Yol 2 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:6952](dashboard.js#L6952-L7024) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:8217](dashboard.js#L8217-L8252) · 36 satır · prescriptions:update

**Yol 3 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:7027](dashboard.js#L7027-L7095) · 69 satır · prescriptions:update

**Yol 4 — `triggerStorno()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `triggerStorno()` — [dashboard.js:17950](dashboard.js#L17950-L18009) · 60 satır · prescriptions:update

**Yol 5 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [module/rechnung-dmrz.js:109](module/rechnung-dmrz.js#L109-L183) · 75 satır · prescriptions:update

**Yol 6 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:128](module/sitzungsfortschritt.js#L128-L173) · 46 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:131](module/sitzungsfortschritt.js#L131-L166) · 36 satır · prescriptions:update

**Yol 7 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:126](module/verordnung-einheiten.js#L126-L160) · 35 satır · prescriptions:update

**Yol 8 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:292](module/zuzahlung-befreiung.js#L292-L302) · 11 satır · prescriptions:update

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:9859](dashboard.js#L9859-L9879) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:16106](dashboard.js#L16106-L16187) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:16189](dashboard.js#L16189-L16206) · 18 satır · businesses:delete

**Yol 4 — `ensureBusinessCoords()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `ensureBusinessCoords()` — [dashboard.js:19832](dashboard.js#L19832-L19861) · 30 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `leads` — 5 bağımsız yazma yolu

**Yol 1 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:4422](dashboard.js#L4422-L4568) · 147 satır · leads:update

**Yol 2 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:7222](dashboard.js#L7222-L7313) · 92 satır · leads:update

**Yol 3 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:18498](dashboard.js#L18498-L18619) · 122 satır · leads:insert

**Yol 4 — `verordnungPatientenAbgleich()`** · Ekran: _UI yolu çözülemedi_
- `verordnungPatientenAbgleich()` — [module/verordnung-patient-abgleich.js:19](module/verordnung-patient-abgleich.js#L19-L98) · 80 satır · leads:update

**Yol 5 — `beantworteAltbestand()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `beantworteAltbestand()` — [module/verordnung-podo.js:907](module/verordnung-podo.js#L907-L920) · 14 satır · leads:update

### `prescription_sessions` — 5 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3838](dashboard.js#L3838-L3934) · 97 satır · prescription_sessions:update

**Yol 2 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:7097](dashboard.js#L7097-L7115) · 19 satır · prescription_sessions:update

**Yol 3 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:7130](dashboard.js#L7130-L7220) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:86](module/sitzung-abgleich.js#L86-L112) · 27 satır · prescription_sessions:upsert

**Yol 4 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:68](module/booking-status-korrektur.js#L68-L117) · 50 satır · prescription_sessions:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · prescription_sessions:update
- `rebindeNoShowSitzungen()` — [module/termin-nicht-erschienen.js:283](module/termin-nicht-erschienen.js#L283-L319) · 37 satır · prescription_sessions:update

**Yol 5 — `bindeSitzungenAnTermin()`** · Ekran: _UI yolu çözülemedi_
- `bindeSitzungenAnTermin()` — [module/sitzung-bindung.js:44](module/sitzung-bindung.js#L44-L75) · 32 satır · prescription_sessions:update

### `services` — 5 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:7323](dashboard.js#L7323-L7362) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:9159](dashboard.js#L9159-L9186) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:9355](dashboard.js#L9355-L9390) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `renderServices()` — [dashboard.js:9542](dashboard.js#L9542-L9566) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:16106](dashboard.js#L16106-L16187) · 82 satır · services:insert

### `abrechnung` — 3 bağımsız yazma yolu

**Yol 1 — `verarbeiteVerschluesselungsSchritt()`** · Ekran: _UI yolu çözülemedi_
- `verarbeiteVerschluesselungsSchritt()` — [api-backend/billing/api/abrechnung.routes.js:1380](api-backend/billing/api/abrechnung.routes.js#L1380-L1427) · 48 satır · abrechnung:update

**Yol 2 — `verworfeneNummerFesthalten()`** · Ekran: _UI yolu çözülemedi_
- `verworfeneNummerFesthalten()` — [api-backend/billing/api/verworfen.js:126](api-backend/billing/api/verworfen.js#L126-L178) · 53 satır · abrechnung:insert

**Yol 3 — `downloadAbrechnungFile()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `downloadAbrechnungFile()` — [module/abrechnung-detail.js:765](module/abrechnung-detail.js#L765-L783) · 19 satır · abrechnung:update

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:55](api-backend/lib/arzt-registry.js#L55-L170) · 116 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:15290](dashboard.js#L15290-L15297) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:15299](dashboard.js#L15299-L15344) · 46 satır · aerzte:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:9883](dashboard.js#L9883-L9956) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10517](dashboard.js#L10517-L13518) · 3002 satır · breaks:insert, breaks:delete
- `loadEmpHours()` — [dashboard.js:11140](dashboard.js#L11140-L11230) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10517](dashboard.js#L10517-L13518) · 3002 satır · calendar_integrations:delete
- `loadSettings()` — [dashboard.js:11953](dashboard.js#L11953-L12042) · 90 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:793](kalender.js#L793-L815) · 23 satır · calendar_integrations:delete

### `email_logs` — 2 bağımsız yazma yolu

**Yol 1 — `loadPatientDetailMails()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loadPatientDetailMails()` — [dashboard.js:8637](dashboard.js#L8637-L8673) · 37 satır · email_logs:update

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10517](dashboard.js#L10517-L13518) · 3002 satır · email_logs:insert

### `employee_services` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10517](dashboard.js#L10517-L13518) · 3002 satır · employee_services:insert, employee_services:delete
- `loadEmpServices()` — [dashboard.js:11232](dashboard.js#L11232-L11316) · 85 satır · employee_services:insert, employee_services:delete

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · employee_services:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:4082](dashboard.js#L4082-L4143) · 62 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:4204](dashboard.js#L4204-L4289) · 86 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:14460](dashboard.js#L14460-L14554) · 95 satır · invoices:update, invoices:insert

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
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:298](module/patienten-einwilligung.js#L298-L336) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `widerrufen()` — [module/patienten-einwilligung.js:538](module/patienten-einwilligung.js#L538-L555) · 18 satır · patient_consents:update

### `podologie_behandlungen` — 2 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `behandlungStornieren()` — [module/podo-storno.js:91](module/podo-storno.js#L91-L166) · 76 satır · podologie_behandlungen:update
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:481](module/podologie-abrechnung.js#L481-L1178) · 698 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:182](module/rechnung-bruecke.js#L182-L195) · 14 satır · podologie_behandlungen:update

### `time_offs` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `loadTeam()` — [dashboard.js:10184](dashboard.js#L10184-L10379) · 196 satır · time_offs:insert
- `deleteEmpTimeOff()` — [dashboard.js:10450](dashboard.js#L10450-L10464) · 15 satır · time_offs:delete
- `fmt()` — [dashboard.js:10517](dashboard.js#L10517-L13518) · 3002 satır · time_offs:delete, time_offs:insert
- `deleteUrlaub()` — [dashboard.js:10527](dashboard.js#L10527-L10534) · 8 satır · time_offs:delete
- `openEmpDetail()` — [dashboard.js:10849](dashboard.js#L10849-L11046) · 198 satır · time_offs:insert

**Yol 2 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:10466](dashboard.js#L10466-L10496) · 31 satır · time_offs:insert

### `user_preferences` — 2 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `saveUserPref()` — [dashboard.js:13895](dashboard.js#L13895-L13905) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:16268](dashboard.js#L16268-L16283) · 16 satır · user_preferences:upsert

### `visibility_reports` — 2 bağımsız yazma yolu

**Yol 1 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:387](admin.js#L387-L404) · 18 satır · visibility_reports:delete

**Yol 2 — `reportSidebarVisibility()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `reportSidebarVisibility()` — [dashboard.js:964](dashboard.js#L964-L988) · 25 satır · visibility_reports:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 28 modülden çağrılıyor
- `fmt()` — [dashboard.js:10517](dashboard.js#L10517-L13518) · 3002 satır · working_hours:upsert
- `loadEmpHours()` — [dashboard.js:11140](dashboard.js#L11140-L11230) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

## En çok yazılan tablolar

- `profiles` — 22 ayrı fonksiyon yazıyor
- `bookings` — 16 ayrı fonksiyon yazıyor
- `prescriptions` — 10 ayrı fonksiyon yazıyor
- `document_vorlagen` — 10 ayrı fonksiyon yazıyor
- `prescription_sessions` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `services` — 7 ayrı fonksiyon yazıyor
- `time_offs` — 6 ayrı fonksiyon yazıyor
- `leads` — 5 ayrı fonksiyon yazıyor
- `businesses` — 5 ayrı fonksiyon yazıyor
- `employee_business_assignments` — 4 ayrı fonksiyon yazıyor
- `employee_services` — 4 ayrı fonksiyon yazıyor
- `ops_finance_expenses` — 4 ayrı fonksiyon yazıyor
- `abrechnung` — 3 ayrı fonksiyon yazıyor
- `aerzte` — 3 ayrı fonksiyon yazıyor
- `breaks` — 3 ayrı fonksiyon yazıyor
- `working_hours` — 3 ayrı fonksiyon yazıyor
- `calendar_integrations` — 3 ayrı fonksiyon yazıyor
- `invoices` — 3 ayrı fonksiyon yazıyor
- `podologie_behandlungen` — 3 ayrı fonksiyon yazıyor

## Bilinçli aynalar — kod içinde beyan edilmiş (kopya DEĞiL)

Frontend/backend paylaşılan modül yolu yok; bu yüzden aynı kural iki dosyaya
yazılmış ve kod bunu kendi yorumunda söylemiş („Spiegel von“ / „Identisch mit“).
Bunları birleştirme — birleştirilecek olsaydı zaten tek dosya olurdu.

- `dgStamm()` — [api-backend/billing/api/verordnung-status.routes.js:99](api-backend/billing/api/verordnung-status.routes.js#L99-L103) — Spiegel von `dgWurzel()` in `module/verordnung-regeln
- `fehlendePflichtangaben()` — [module/beleg-druck.js:55](module/beleg-druck.js#L55-L60) — Identisch mit `fehlendePflichtangaben()` im Backend — beim Ändern beide
- `kartenIkNormalisieren()` — [module/krankenkasse-suche.js:169](module/krankenkasse-suche.js#L169-L172) — Spiegel von `kartenIkNormalisieren()` in `api-backend/lib/rezept-felder
- `leitsymptomatikAlsBitmaske()` — [api-backend/billing/dta/leitsymptomatik.js:58](api-backend/billing/dta/leitsymptomatik.js#L58-L96) — Spiegel von `leitsymptomatikListe()` in `module/verordnung-pruefung
- `leitsymptomatikListe()` — [module/verordnung-pruefung.js:109](module/verordnung-pruefung.js#L109-L121) — Spiegel von `api-backend/billing/dta/leitsymptomatik
- `pruefTitel()` — [module/verordnung-uebersicht.js:533](module/verordnung-uebersicht.js#L533-L539) — Spiegel von `pruefTitel` in module/verordnung-liste

## Aynı ada sahip birden fazla tanım

Bu bir kopya listesi değil, bir isim çakışması listesi — aynı isim farklı iş yapıyor olabilir.
`aynalar` doluysa o konum bilinçli ayna; boşsa isim çakışması başka bir şeydir, incele.

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:24 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:880 · module/abrechnung-status.js:187 · module/abrechnungsstatus.js:735 · module/ausfallrechnung.js:19 · module/behandlungsbestaetigung.js:37 · module/diagnosegruppen-regeln.js:32 · module/fussbefund.js:180 · module/kalender-raster.js:24 · module/kalender-woche.js:42 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/patient-termine.js:1 · module/rezeptinfo-geld.js:71 · module/termin-aktionen.js:41 · module/termin-druck.js:27 · module/termin-panel.js:34 · module/warteliste-ansicht.js:26 · module/warteliste-nachruecker.js:49
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-auswahl.js:750 · module/abrechnung-detail.js:171 · module/abrechnung-freigabe.js:112 · module/arzt-register.js:125 · module/krankenkasse-suche.js:650 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:44 · module/podo-einheiten.js:372 · module/rechnung-zahlungseingang.js:165 · module/verordnung-feldmarker.js:80 · module/verordnung-uebersicht.js:112 · module/zuzahlung-befreiung.js:304 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `fmt` — api-backend/setup/router.js:110 · dashboard.js:3770 · dashboard.js:8261 · dashboard.js:10147 · dashboard.js:10436 · dashboard.js:10517 · dashboard.js:13983 · dashboard.js:19408 · dashboard.js:19494 · dashboard.js:19573 · dashboard.js:19605 · dashboard.js:19665 · module/kalender-raster.js:71 · module/rechnung-ansicht.js:184 · module/rezeptinfo-geld.js:69
- `r2` — api-backend/billing/api/abrechnung.routes.js:1826 · api-backend/billing/api/statistik.routes.js:176 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:57 · api-backend/billing/preise/resolver.js:42 · api-backend/billing/utils/abrechnung-zeilen.js:36 · api-backend/billing/zuzahlung/calculator.js:14 · api-backend/billing/zuzahlung/korrektur.js:16 · module/abrechnung-verlauf.js:128 · module/zuzahlung-rechnen.js:42
- `fmtDate` — api-backend/billing/dta/encoding.js:80 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:29 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:1390 · ops/app.js:84
- `render` — calendar-widget.js:127 · dashboard.js:13343 · dashboard.js:19224 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:116
- `$` — attendance.js:9 · employee-signup.js:10 · module/kiosk.js:59 · module/rechnung-zahlungseingang.js:376 · module/verordnung-podo.js:83 · module/verordnung-pruefen-knopf.js:41 · module/zuzahlung-korrektur.js:206 · ops/app.js:48
- `init` — attendance.js:296 · booking-request.js:1246 · booking.js:58 · cookie-consent.js:139 · dashboard.js:16331 · kalender.js:161 · onboarding.js:77 · setup.js:225
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:596 · module/arzt-register.js:276 · module/rechnung-zahlungseingang.js:432 · module/verordnung-feldmarker.js:240 · module/zuzahlung-befreiung.js:151 · module/zuzahlung-korrektur.js:209
- `g` — dashboard.js:15357 · dashboard.js:15370 · dashboard.js:15524 · dashboard.js:15594 · module/rezept-in-maske.js:39 · module/verordnung-anlegen.js:28 · module/verordnung-maske.js:369 · module/verordnung-nachweis.js:28
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:27 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/rechnung-zahlung.routes.js:84 · api-backend/billing/api/statistik.routes.js:19 · api-backend/billing/api/verordnung-status.routes.js:44 · api-backend/billing/api/warteliste.routes.js:21 · api-backend/billing/api/zuzahlung.routes.js:47
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:28 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · module/geld.js:48
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9 · api-backend/ai/tasks/series-scheduler.js:118
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:295 · api-backend/server.js:1425
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95 · api-backend/ai/tasks/series-scheduler.js:104
- `cleanup` — dashboard.js:6807 · dashboard.js:6836 · dashboard.js:6923 · dashboard.js:20005 · module/absagegrund-modal.js:81
- `el` — module/arzt-register.js:251 · module/fussbefund.js:208 · module/termin-aktionsleiste.js:49 · module/termin-panel.js:39 · module/verordnung-maske.js:629
- `zeile` — module/rechnung-druck.js:31 · module/verordnung-detail.js:273 · module/verordnung-detail.js:400 · module/verordnung-detail.js:457 · module/verordnung-pruefen-knopf.js:114
- `showMsg` — admin-login.js:15 · attendance.js:67 · employee-signup.js:130 · login.js:168
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/preflight.js:148
- `leer` — api-backend/billing/dta/auftragsdatei.js:51 · module/fussbefund-archiv.js:199 · module/sitzungsplan.js:114 · module/verordnung-pruefung.js:94
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/preise_autoupdate.mjs:194 · api-backend/preise_pruefen.mjs:240 · api-backend/sync_heilmittel_katalog.js:151
- `loadServices` — booking-request.js:423 · booking.js:199 · dashboard.js:9139 · kalender.js:674
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:680 · module/verordnung-detail.js:824
- `closeModal` — dashboard.js:1322 · dashboard.js:12103 · dashboard.js:12524 · ops/app.js:162
- `onEsc` — dashboard.js:6930 · module/rechnung-leistung-picker.js:46 · module/zuzahlung-befreiung.js:156 · module/zuzahlung-korrektur.js:214
- `v` — dashboard.js:12987 · dashboard.js:13012 · dashboard.js:13032 · dashboard.js:16117
- `zeichne` — module/abrechnung-auswahl.js:754 · module/abrechnungsstatus.js:609 · module/patienten-einwilligung.js:480 · module/rezeptinfo-geld.js:355
- `zeigeFehler` — module/abrechnung-detail.js:564 · module/abrechnung-detail.js:606 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:208
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:208
- `showToast` — admin.js:22 · dashboard.js:1338 · module/kiosk.js:46
- `loadTeam` — booking-request.js:517 · dashboard.js:10184 · kalender.js:250
- `initCalendar` — booking-request.js:566 · dashboard.js:2573 · kalender.js:300
- `applyLang` — kalender.js:86 · login.js:119 · setup.js:158
- `norm` — katalog-suche.js:414 · module/termin-aktionen.js:610 · ops/tools/regroup.mjs:59
- `feld` — module/abrechnung-auswahl.js:968 · module/fussbefund.js:283 · module/rezeptinfo-geld.js:290
- `zeileHtml` — module/abrechnung-detail.js:349 · module/fussbefund.js:1613 · module/verordnung-liste.js:161
- `DE` — module/behandlungsbestaetigung.js:41 · module/patientenkarte.js:38 · module/verordnung-uebersicht.js:106
- `oeffne` — module/kalender-kontextmenue.js:119 · module/leistungen-liste.js:190 · module/verordnung-liste.js:219
