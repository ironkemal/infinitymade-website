# Funktionskarte

> Üretim: 2026-10-05 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**2904 fonksiyon** · 345 dosya · 41 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 15 bağımsız yazma yolu

**Yol 1 — `cancelRequestBookings()`** · Ekran: _UI yolu çözülemedi_
- `cancelRequestBookings()` — [api-backend/booking/cancel-request.js:3](api-backend/booking/cancel-request.js#L3-L16) · 14 satır · bookings:update

**Yol 2 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:17](api-backend/booking/from-request.js#L17-L114) · 98 satır · bookings:insert

**Yol 3 — `kontoLoeschen()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschen()` — [api-backend/dsgvo/loeschen.js:59](api-backend/dsgvo/loeschen.js#L59-L727) · 669 satır · bookings:delete

**Yol 4 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:2816](dashboard.js#L2816-L3229) · 414 satır · bookings:update

**Yol 5 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3402](dashboard.js#L3402-L3498) · 97 satır · bookings:insert

**Yol 6 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:3646](dashboard.js#L3646-L3707) · 62 satır · bookings:update

**Yol 7 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:3724](dashboard.js#L3724-L3738) · 15 satır · bookings:update

**Yol 8 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:3768](dashboard.js#L3768-L3853) · 86 satır · bookings:update

**Yol 9 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:3855](dashboard.js#L3855-L3933) · 79 satır · bookings:update

**Yol 10 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:4230](dashboard.js#L4230-L4308) · 79 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:4346](dashboard.js#L4346-L4467) · 122 satır · bookings:insert

**Yol 11 — `doMoveBooking()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:4802](dashboard.js#L4802-L4830) · 29 satır · bookings:update

**Yol 12 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:68](module/booking-status-korrektur.js#L68-L117) · 50 satır · bookings:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · bookings:update

**Yol 13 — `bindeTermin()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:122](module/verordnung-termine.js#L122-L130) · 9 satır · bookings:update

**Yol 14 — `loeseTermin()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:133](module/verordnung-termine.js#L133-L141) · 9 satır · bookings:update

**Yol 15 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:198](module/warteliste-nachruecker.js#L198-L234) · 37 satır · bookings:insert

### `profiles` — 10 bağımsız yazma yolu

**Yol 1 — `kontoLoeschen()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschen()` — [api-backend/dsgvo/loeschen.js:59](api-backend/dsgvo/loeschen.js#L59-L727) · 669 satır · profiles:update

**Yol 2 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:1907](dashboard.js#L1907-L2017) · 111 satır · profiles:update

**Yol 3 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:5101](dashboard.js#L5101-L5127) · 27 satır · profiles:update

**Yol 4 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · profiles:update
- `openEmpDetail()` — [dashboard.js:10325](dashboard.js#L10325-L10522) · 198 satır · profiles:update
- `ensureCompanyCode()` — [dashboard.js:12520](dashboard.js#L12520-L12526) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:12537](dashboard.js#L12537-L12550) · 14 satır · profiles:update
- `init()` — [kalender.js:130](kalender.js#L130-L182) · 53 satır · profiles:update
- `wireAbrechnungSettings()` — [module/abrechnung-einstellungen.js:271](module/abrechnung-einstellungen.js#L271-L426) · 156 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1720](module/fussbefund.js#L1720-L1784) · 65 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:870](onboarding.js#L870-L1016) · 147 satır · profiles:update

**Yol 5 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 30 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:19117](dashboard.js#L19117-L19174) · 58 satır · profiles:update

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [module/ausfall-einstellungen.js:76](module/ausfall-einstellungen.js#L76-L118) · 43 satır · profiles:update

**Yol 7 — `speichereKonten()`** · Ekran: _UI yolu çözülemedi_
- `speichereKonten()` — [module/buchungskonten.js:295](module/buchungskonten.js#L295-L325) · 31 satır · profiles:update

**Yol 8 — `mountPraxisStandort()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `mountPraxisStandort()` — [module/praxis-standort.js:93](module/praxis-standort.js#L93-L171) · 79 satır · profiles:update
- `schalter()` — [module/praxis-standort.js:130](module/praxis-standort.js#L130-L141) · 12 satır · profiles:update
- `setzen()` — [module/praxis-standort.js:143](module/praxis-standort.js#L143-L167) · 25 satır · profiles:update

**Yol 9 — `speichereStufen()`** · Ekran: _UI yolu çözülemedi_
- `speichereStufen()` — [module/selbstzahler-stufen.js:259](module/selbstzahler-stufen.js#L259-L289) · 31 satır · profiles:update

**Yol 10 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `prescriptions` — 9 bağımsız yazma yolu

**Yol 1 — `kostentraegerIkZurueckschreiben()`** · Ekran: _UI yolu çözülemedi_
- `kostentraegerIkZurueckschreiben()` — [api-backend/billing/utils/kostentraeger-frisch.js:114](api-backend/billing/utils/kostentraeger-frisch.js#L114-L136) · 23 satır · prescriptions:update

**Yol 2 — `kontoLoeschen()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschen()` — [api-backend/dsgvo/loeschen.js:59](api-backend/dsgvo/loeschen.js#L59-L727) · 669 satır · prescriptions:delete

**Yol 3 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:6506](dashboard.js#L6506-L6578) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:7771](dashboard.js#L7771-L7806) · 36 satır · prescriptions:update

**Yol 4 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:6581](dashboard.js#L6581-L6649) · 69 satır · prescriptions:update

**Yol 5 — `triggerStorno()`** · Ekran: ortak yardımcı — 30 modülden çağrılıyor
- `triggerStorno()` — [dashboard.js:16757](dashboard.js#L16757-L16816) · 60 satır · prescriptions:update

**Yol 6 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [module/rechnung-dmrz.js:109](module/rechnung-dmrz.js#L109-L183) · 75 satır · prescriptions:update

**Yol 7 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:128](module/sitzungsfortschritt.js#L128-L173) · 46 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:131](module/sitzungsfortschritt.js#L131-L166) · 36 satır · prescriptions:update

**Yol 8 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:126](module/verordnung-einheiten.js#L126-L160) · 35 satır · prescriptions:update

**Yol 9 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:292](module/zuzahlung-befreiung.js#L292-L302) · 11 satır · prescriptions:update

### `leads` — 6 bağımsız yazma yolu

**Yol 1 — `kontoLoeschen()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschen()` — [api-backend/dsgvo/loeschen.js:59](api-backend/dsgvo/loeschen.js#L59-L727) · 669 satır · leads:delete, leads:update

**Yol 2 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:3979](dashboard.js#L3979-L4125) · 147 satır · leads:update

**Yol 3 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:6776](dashboard.js#L6776-L6867) · 92 satır · leads:update

**Yol 4 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:17305](dashboard.js#L17305-L17426) · 122 satır · leads:insert

**Yol 5 — `verordnungPatientenAbgleich()`** · Ekran: _UI yolu çözülemedi_
- `verordnungPatientenAbgleich()` — [module/verordnung-patient-abgleich.js:19](module/verordnung-patient-abgleich.js#L19-L98) · 80 satır · leads:update

**Yol 6 — `beantworteAltbestand()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `beantworteAltbestand()` — [module/verordnung-podo.js:907](module/verordnung-podo.js#L907-L920) · 14 satır · leads:update

### `businesses` — 5 bağımsız yazma yolu

**Yol 1 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:9349](dashboard.js#L9349-L9369) · 21 satır · businesses:update

**Yol 2 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:14922](dashboard.js#L14922-L15003) · 82 satır · businesses:update, businesses:insert

**Yol 3 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:15005](dashboard.js#L15005-L15022) · 18 satır · businesses:delete

**Yol 4 — `mountPraxisStandort()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `mountPraxisStandort()` — [module/praxis-standort.js:93](module/praxis-standort.js#L93-L171) · 79 satır · businesses:update
- `setzen()` — [module/praxis-standort.js:143](module/praxis-standort.js#L143-L167) · 25 satır · businesses:update

**Yol 5 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `prescription_sessions` — 5 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3402](dashboard.js#L3402-L3498) · 97 satır · prescription_sessions:update

**Yol 2 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:6651](dashboard.js#L6651-L6669) · 19 satır · prescription_sessions:update

**Yol 3 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:6684](dashboard.js#L6684-L6774) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:86](module/sitzung-abgleich.js#L86-L112) · 27 satır · prescription_sessions:upsert

**Yol 4 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:68](module/booking-status-korrektur.js#L68-L117) · 50 satır · prescription_sessions:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · prescription_sessions:update
- `rebindeNoShowSitzungen()` — [module/termin-nicht-erschienen.js:283](module/termin-nicht-erschienen.js#L283-L319) · 37 satır · prescription_sessions:update

**Yol 5 — `bindeSitzungenAnTermin()`** · Ekran: _UI yolu çözülemedi_
- `bindeSitzungenAnTermin()` — [module/sitzung-bindung.js:44](module/sitzung-bindung.js#L44-L75) · 32 satır · prescription_sessions:update

### `services` — 5 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:6877](dashboard.js#L6877-L6916) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:8649](dashboard.js#L8649-L8676) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:8845](dashboard.js#L8845-L8880) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `renderServices()` — [dashboard.js:9032](dashboard.js#L9032-L9056) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:14922](dashboard.js#L14922-L15003) · 82 satır · services:insert

### `abrechnung` — 3 bağımsız yazma yolu

**Yol 1 — `createZuzahlungsforderungRouter()`** · Ekran: _UI yolu çözülemedi_
- `aktualisiereArtefaktVersion()` — [api-backend/billing/api/artefakt-version.js:142](api-backend/billing/api/artefakt-version.js#L142-L237) · 96 satır · abrechnung:update
- `createZuzahlungsforderungRouter()` — [api-backend/billing/api/zuzahlungsforderung.routes.js:130](api-backend/billing/api/zuzahlungsforderung.routes.js#L130-L1560) · 1431 satır · abrechnung:update, abrechnung:insert

**Yol 2 — `verworfeneNummerFesthalten()`** · Ekran: _UI yolu çözülemedi_
- `verworfeneNummerFesthalten()` — [api-backend/billing/api/verworfen.js:126](api-backend/billing/api/verworfen.js#L126-L178) · 53 satır · abrechnung:insert

**Yol 3 — `downloadAbrechnungFile()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `downloadAbrechnungFile()` — [module/abrechnung-detail.js:769](module/abrechnung-detail.js#L769-L787) · 19 satır · abrechnung:update

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:60](api-backend/lib/arzt-registry.js#L60-L194) · 135 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:14106](dashboard.js#L14106-L14113) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:14115](dashboard.js#L14115-L14160) · 46 satır · aerzte:update

### `employee_services` — 3 bağımsız yazma yolu

**Yol 1 — `kontoLoeschen()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschen()` — [api-backend/dsgvo/loeschen.js:59](api-backend/dsgvo/loeschen.js#L59-L727) · 669 satır · employee_services:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · employee_services:insert, employee_services:delete
- `loadEmpServices()` — [dashboard.js:10708](dashboard.js#L10708-L10792) · 85 satır · employee_services:insert, employee_services:delete

**Yol 3 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · employee_services:insert

### `anamnese` — 2 bağımsız yazma yolu

**Yol 1 — `speichereNeu()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `speichereNeu()` — [module/anamnese-daten.js:69](module/anamnese-daten.js#L69-L75) · 7 satır · anamnese:insert

**Yol 2 — `markiereGeprueft()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `markiereGeprueft()` — [module/anamnese-daten.js:88](module/anamnese-daten.js#L88-L95) · 8 satır · anamnese:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:9373](dashboard.js#L9373-L9446) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · breaks:insert, breaks:delete
- `loadEmpHours()` — [dashboard.js:10616](dashboard.js#L10616-L10706) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · calendar_integrations:delete
- `loadSettings()` — [dashboard.js:11429](dashboard.js#L11429-L11517) · 89 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:762](kalender.js#L762-L784) · 23 satır · calendar_integrations:delete

### `email_logs` — 2 bağımsız yazma yolu

**Yol 1 — `loadPatientDetailMails()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `loadPatientDetailMails()` — [dashboard.js:8127](dashboard.js#L8127-L8163) · 37 satır · email_logs:update

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · email_logs:insert

### `employee_business_assignments` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschen()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschen()` — [api-backend/dsgvo/loeschen.js:59](api-backend/dsgvo/loeschen.js#L59-L727) · 669 satır · employee_business_assignments:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · employee_business_assignments:upsert, employee_business_assignments:delete
- `renderOtherStandortEmps()` — [dashboard.js:10024](dashboard.js#L10024-L10109) · 86 satır · employee_business_assignments:upsert
- `renderEmpStandortList()` — [dashboard.js:10171](dashboard.js#L10171-L10236) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete
- `saveEmpPermissions()` — [dashboard.js:10272](dashboard.js#L10272-L10323) · 52 satır · employee_business_assignments:upsert

### `employee_scope_overrides` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschen()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschen()` — [api-backend/dsgvo/loeschen.js:59](api-backend/dsgvo/loeschen.js#L59-L727) · 669 satır · employee_scope_overrides:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · employee_scope_overrides:delete, employee_scope_overrides:insert
- `saveEmpPermissions()` — [dashboard.js:10272](dashboard.js#L10272-L10323) · 52 satır · employee_scope_overrides:delete, employee_scope_overrides:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:3646](dashboard.js#L3646-L3707) · 62 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:3768](dashboard.js#L3768-L3853) · 86 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:13712](dashboard.js#L13712-L13805) · 94 satır · invoices:update, invoices:insert

**Yol 2 — `frageZahlungsstatus()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:68](module/rechnung-zahlung.js#L68-L75) · 8 satır · invoices:update
- `frageZahlungsstatus()` — [module/rechnung-zahlung.js:87](module/rechnung-zahlung.js#L87-L150) · 64 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:279](admin.js#L279-L304) · 26 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:360](admin.js#L360-L375) · 16 satır · module_visibility:upsert

### `patient_consents` — 2 bağımsız yazma yolu

**Yol 1 — `speichereEinwilligung()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:307](module/patienten-einwilligung.js#L307-L345) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `widerrufen()` — [module/patienten-einwilligung.js:547](module/patienten-einwilligung.js#L547-L564) · 18 satır · patient_consents:update

### `podologie_behandlungen` — 2 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `behandlungStornieren()` — [module/podo-storno.js:91](module/podo-storno.js#L91-L166) · 76 satır · podologie_behandlungen:update
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:488](module/podologie-abrechnung.js#L488-L1221) · 734 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:182](module/rechnung-bruecke.js#L182-L195) · 14 satır · podologie_behandlungen:update

### `prescription_documents` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschen()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschen()` — [api-backend/dsgvo/loeschen.js:59](api-backend/dsgvo/loeschen.js#L59-L727) · 669 satır · prescription_documents:delete

**Yol 2 — `ladeLhbNachweisHoch()`** · Ekran: _UI yolu çözülemedi_
- `ladeLhbNachweisHoch()` — [module/verordnung-nachweis.js:109](module/verordnung-nachweis.js#L109-L145) · 37 satır · prescription_documents:insert

### `time_offs` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `loadTeam()` — [dashboard.js:9672](dashboard.js#L9672-L9855) · 184 satır · time_offs:insert
- `deleteEmpTimeOff()` — [dashboard.js:9926](dashboard.js#L9926-L9940) · 15 satır · time_offs:delete
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · time_offs:delete, time_offs:insert
- `deleteUrlaub()` — [dashboard.js:10003](dashboard.js#L10003-L10010) · 8 satır · time_offs:delete
- `openEmpDetail()` — [dashboard.js:10325](dashboard.js#L10325-L10522) · 198 satır · time_offs:insert

**Yol 2 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:9942](dashboard.js#L9942-L9972) · 31 satır · time_offs:insert

### `user_preferences` — 2 bağımsız yazma yolu

**Yol 1 — `saveUserPref()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `saveUserPref()` — [dashboard.js:13145](dashboard.js#L13145-L13155) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:15084](dashboard.js#L15084-L15099) · 16 satır · user_preferences:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 29 modülden çağrılıyor
- `fmt()` — [dashboard.js:9993](dashboard.js#L9993-L12994) · 3002 satır · working_hours:upsert
- `loadEmpHours()` — [dashboard.js:10616](dashboard.js#L10616-L10706) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

## En çok yazılan tablolar

- `profiles` — 25 ayrı fonksiyon yazıyor
- `bookings` — 17 ayrı fonksiyon yazıyor
- `prescriptions` — 11 ayrı fonksiyon yazıyor
- `document_vorlagen` — 10 ayrı fonksiyon yazıyor
- `prescription_sessions` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `services` — 7 ayrı fonksiyon yazıyor
- `leads` — 6 ayrı fonksiyon yazıyor
- `businesses` — 6 ayrı fonksiyon yazıyor
- `time_offs` — 6 ayrı fonksiyon yazıyor
- `employee_services` — 5 ayrı fonksiyon yazıyor
- `employee_business_assignments` — 5 ayrı fonksiyon yazıyor
- `abrechnung` — 4 ayrı fonksiyon yazıyor
- `ops_finance_expenses` — 4 ayrı fonksiyon yazıyor
- `employee_scope_overrides` — 3 ayrı fonksiyon yazıyor
- `aerzte` — 3 ayrı fonksiyon yazıyor
- `breaks` — 3 ayrı fonksiyon yazıyor
- `working_hours` — 3 ayrı fonksiyon yazıyor
- `calendar_integrations` — 3 ayrı fonksiyon yazıyor
- `invoices` — 3 ayrı fonksiyon yazıyor

## Bilinçli aynalar — kod içinde beyan edilmiş (kopya DEĞiL)

Frontend/backend paylaşılan modül yolu yok; bu yüzden aynı kural iki dosyaya
yazılmış ve kod bunu kendi yorumunda söylemiş („Spiegel von“ / „Identisch mit“).
Bunları birleştirme — birleştirilecek olsaydı zaten tek dosya olurdu.

- `dgStamm()` — [api-backend/billing/api/verordnung-status.routes.js:102](api-backend/billing/api/verordnung-status.routes.js#L102-L106) — Spiegel von `dgWurzel()` in `module/verordnung-regeln
- `fehlendePflichtangaben()` — [module/beleg-druck.js:55](module/beleg-druck.js#L55-L60) — Identisch mit `fehlendePflichtangaben()` im Backend — beim Ändern beide
- `kartenIkNormalisieren()` — [module/krankenkasse-suche.js:169](module/krankenkasse-suche.js#L169-L172) — Spiegel von `kartenIkNormalisieren()` in `api-backend/lib/rezept-felder
- `leitsymptomatikAlsBitmaske()` — [api-backend/billing/dta/leitsymptomatik.js:58](api-backend/billing/dta/leitsymptomatik.js#L58-L96) — Spiegel von `leitsymptomatikListe()` in `module/verordnung-pruefung
- `leitsymptomatikListe()` — [module/verordnung-pruefung.js:112](module/verordnung-pruefung.js#L112-L124) — Spiegel von `api-backend/billing/dta/leitsymptomatik
- `pruefTitel()` — [module/verordnung-uebersicht.js:533](module/verordnung-uebersicht.js#L533-L539) — Spiegel von `pruefTitel` in module/verordnung-liste
- `zuVieleBehandlungenJeTag()` — [module/podo-behandlungstag-regel.js:79](module/podo-behandlungstag-regel.js#L79-L94) — Spiegel von behandlungstageJeDatum/TAGESHOECHSTZAHL in api-backend/billing/utils/behandlungstage

## Aynı ada sahip birden fazla tanım

Bu bir kopya listesi değil, bir isim çakışması listesi — aynı isim farklı iş yapıyor olabilir.
`aynalar` doluysa o konum bilinçli ayna; boşsa isim çakışması başka bir şeydir, incele.

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:24 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:506 · module/abrechnung-status.js:187 · module/abrechnungsstatus.js:735 · module/ausfallrechnung.js:19 · module/behandlungsbestaetigung.js:37 · module/diagnosegruppen-regeln.js:32 · module/fussbefund.js:186 · module/kalender-raster.js:24 · module/kalender-woche.js:42 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/patient-termine.js:1 · module/rezeptinfo-geld.js:71 · module/termin-aktionen.js:41 · module/termin-druck.js:27 · module/termin-panel.js:34 · module/warteliste-ansicht.js:26 · module/warteliste-nachruecker.js:49
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-artefakte.js:22 · module/abrechnung-auswahl.js:759 · module/abrechnung-detail.js:173 · module/abrechnung-freigabe.js:112 · module/anamnese.js:43 · module/arzt-register.js:125 · module/krankenkasse-suche.js:642 · module/patienten-einwilligung.js:58 · module/patientenkarte.js:44 · module/podo-einheiten.js:372 · module/rechnung-zahlungseingang.js:165 · module/verordnung-feldmarker.js:80 · module/verordnung-uebersicht.js:112 · module/zuzahlung-befreiung.js:304 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `fmt` — api-backend/setup/router.js:111 · dashboard.js:3334 · dashboard.js:7815 · dashboard.js:9635 · dashboard.js:9912 · dashboard.js:9993 · dashboard.js:13233 · dashboard.js:18216 · dashboard.js:18302 · dashboard.js:18381 · dashboard.js:18413 · dashboard.js:18473 · module/kalender-raster.js:71 · module/rechnung-ansicht.js:184 · module/rezeptinfo-geld.js:69
- `r2` — api-backend/billing/api/abrechnung.routes.js:2262 · api-backend/billing/api/statistik.routes.js:176 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:62 · api-backend/billing/dta/preflight.js:773 · api-backend/billing/preise/resolver.js:42 · api-backend/billing/utils/abrechnung-zeilen.js:36 · api-backend/billing/zuzahlung/calculator.js:14 · api-backend/billing/zuzahlung/korrektur.js:16 · module/abrechnung-verlauf.js:128 · module/zuzahlung-rechnen.js:42
- `fmtDate` — api-backend/billing/dta/encoding.js:85 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:29 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:980 · ops/app.js:84
- `render` — calendar-widget.js:127 · dashboard.js:12718 · dashboard.js:18032 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:116
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:27 · api-backend/billing/api/mahnwesen.routes.js:22 · api-backend/billing/api/podo-empfangsnachweis.routes.js:12 · api-backend/billing/api/rechnung-zahlung.routes.js:84 · api-backend/billing/api/statistik.routes.js:19 · api-backend/billing/api/verordnung-status.routes.js:47 · api-backend/billing/api/warteliste.routes.js:21 · api-backend/billing/api/zuzahlung.routes.js:47
- `$` — attendance.js:10 · module/anamnese.js:42 · module/kiosk.js:72 · module/rechnung-zahlungseingang.js:376 · module/verordnung-podo.js:83 · module/verordnung-pruefen-knopf.js:41 · module/zuzahlung-korrektur.js:206 · ops/app.js:48
- `init` — attendance.js:299 · booking-request.js:1410 · booking.js:63 · cookie-consent.js:139 · dashboard.js:15147 · kalender.js:130 · onboarding.js:77 · setup.js:127
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:596 · module/arzt-register.js:276 · module/rechnung-zahlungseingang.js:432 · module/verordnung-feldmarker.js:240 · module/zuzahlung-befreiung.js:151 · module/zuzahlung-korrektur.js:209
- `g` — dashboard.js:14173 · dashboard.js:14186 · dashboard.js:14340 · dashboard.js:14410 · module/rezept-in-maske.js:39 · module/verordnung-anlegen.js:28 · module/verordnung-maske.js:369 · module/verordnung-nachweis.js:28
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:28 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · module/geld.js:48
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:70 · api-backend/ai/tasks/b2c-draft.js:59 · api-backend/ai/tasks/rezept-normalize.js:113 · api-backend/ai/tasks/rezept-ocr.js:166 · api-backend/ai/tasks/rezept-validate.js:9 · api-backend/ai/tasks/series-scheduler.js:118
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:45 · api-backend/server.js:300 · api-backend/server.js:1446
- `mockResponse` — api-backend/ai/tasks/appointment-confirm-draft.js:56 · api-backend/ai/tasks/b2c-draft.js:47 · api-backend/ai/tasks/rezept-normalize.js:45 · api-backend/ai/tasks/rezept-ocr.js:95 · api-backend/ai/tasks/series-scheduler.js:104
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/builder.js:63 · api-backend/billing/dta/preflight.js:159
- `sha256Hex` — api-backend/billing/api/abrechnung.routes.js:91 · api-backend/billing/api/artefakt-registry.js:23 · api-backend/billing/api/zuzahlungsforderung.routes.js:38 · api-backend/billing/dta/zuzahlungsforderung-ursprung.js:73 · module/einwilligung-texte.js:360
- `leer` — api-backend/billing/dta/auftragsdatei.js:53 · module/fahrtenbuch-regeln.js:288 · module/fussbefund-archiv.js:199 · module/sitzungsplan.js:114 · module/verordnung-pruefung.js:97
- `cleanup` — dashboard.js:6361 · dashboard.js:6390 · dashboard.js:6477 · dashboard.js:18782 · module/absagegrund-modal.js:81
- `zeichne` — module/abrechnung-auswahl.js:763 · module/abrechnungsstatus.js:609 · module/patienten-einwilligung.js:489 · module/praxis-standort.js:115 · module/rezeptinfo-geld.js:355
- `el` — module/arzt-register.js:251 · module/fussbefund.js:214 · module/termin-aktionsleiste.js:49 · module/termin-panel.js:39 · module/verordnung-maske.js:629
- `zeile` — module/rechnung-druck.js:31 · module/verordnung-detail.js:273 · module/verordnung-detail.js:400 · module/verordnung-detail.js:457 · module/verordnung-pruefen-knopf.js:115
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/preise_autoupdate.mjs:194 · api-backend/preise_pruefen.mjs:240 · api-backend/sync_heilmittel_katalog.js:151
- `loadServices` — booking-request.js:528 · booking.js:164 · dashboard.js:8629 · kalender.js:643
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:732 · module/verordnung-detail.js:824
- `closeModal` — dashboard.js:911 · dashboard.js:11578 · dashboard.js:11999 · ops/app.js:162
- `onEsc` — dashboard.js:6484 · module/rechnung-leistung-picker.js:46 · module/zuzahlung-befreiung.js:156 · module/zuzahlung-korrektur.js:214
- `v` — dashboard.js:12453 · dashboard.js:12475 · dashboard.js:12495 · dashboard.js:14933
- `zeigeFehler` — module/abrechnung-detail.js:568 · module/abrechnung-detail.js:610 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:208
- `load` — ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `showMsg` — admin-login.js:15 · attendance.js:69 · login.js:100
- `isAdmin` — admin-login.js:18 · api/_lib/auth.js:90 · login.js:132
- `showToast` — admin.js:22 · dashboard.js:928 · module/kiosk.js:55
- `zahl` — api-backend/lib/gps-checkin.js:11 · module/frequenz-pruefung.js:137 · module/rezept-in-maske.js:218
- `setzen` — api-backend/server.js:4177 · module/praxis-standort.js:143 · module/rechnung-druck.js:110
- `loadTeam` — booking-request.js:622 · dashboard.js:9672 · kalender.js:219
- `initCalendar` — booking-request.js:671 · dashboard.js:2136 · kalender.js:269
- `t` — dashboard.js:505 · module/anamnese.js:381 · module/kiosk.js:56
- `applyLang` — kalender.js:67 · login.js:50 · setup.js:71
- `norm` — katalog-suche.js:414 · module/termin-aktionen.js:610 · ops/tools/regroup.mjs:59
