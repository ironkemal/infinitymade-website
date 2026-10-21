# Funktionskarte

> Üretim: 2026-10-21 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**3626 fonksiyon** (3511 JS · 88 bash · 27 ps1) · 450 dosya · 42 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `bookings` — 15 bağımsız yazma yolu

**Yol 1 — `cancelRequestBookings()`** · Ekran: _UI yolu çözülemedi_
- `cancelRequestBookings()` — [api-backend/booking/cancel-request.js:3](api-backend/booking/cancel-request.js#L3-L16) · 14 satır · bookings:update

**Yol 2 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:17](api-backend/booking/from-request.js#L17-L131) · 115 satır · bookings:insert
- `insertBooking()` — [api-backend/booking/from-request.js:39](api-backend/booking/from-request.js#L39-L45) · 7 satır · bookings:insert

**Yol 3 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · bookings:delete

**Yol 4 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:2715](dashboard.js#L2715-L3122) · 408 satır · bookings:update

**Yol 5 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3258](dashboard.js#L3258-L3354) · 97 satır · bookings:insert

**Yol 6 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:3502](dashboard.js#L3502-L3563) · 62 satır · bookings:update

**Yol 7 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:3580](dashboard.js#L3580-L3594) · 15 satır · bookings:update

**Yol 8 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:3624](dashboard.js#L3624-L3712) · 89 satır · bookings:update

**Yol 9 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:3714](dashboard.js#L3714-L3792) · 79 satır · bookings:update

**Yol 10 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:4089](dashboard.js#L4089-L4167) · 79 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:4205](dashboard.js#L4205-L4326) · 122 satır · bookings:insert

**Yol 11 — `doMoveBooking()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:4661](dashboard.js#L4661-L4689) · 29 satır · bookings:update

**Yol 12 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:94](module/booking-status-korrektur.js#L94-L148) · 55 satır · bookings:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · bookings:update

**Yol 13 — `bindeTermin()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:194](module/verordnung-termine.js#L194-L202) · 9 satır · bookings:update

**Yol 14 — `loeseTermin()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:205](module/verordnung-termine.js#L205-L213) · 9 satır · bookings:update

**Yol 15 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:198](module/warteliste-nachruecker.js#L198-L234) · 37 satır · bookings:insert

### `profiles` — 10 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · profiles:update

**Yol 2 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:1806](dashboard.js#L1806-L1916) · 111 satır · profiles:update

**Yol 3 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:4960](dashboard.js#L4960-L4986) · 27 satır · profiles:update

**Yol 4 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · profiles:update
- `openEmpDetail()` — [dashboard.js:10052](dashboard.js#L10052-L10249) · 198 satır · profiles:update
- `ensureCompanyCode()` — [dashboard.js:12160](dashboard.js#L12160-L12166) · 7 satır · profiles:update
- `ensureBookingSlug()` — [dashboard.js:12177](dashboard.js#L12177-L12190) · 14 satır · profiles:update
- `init()` — [kalender.js:130](kalender.js#L130-L182) · 53 satır · profiles:update
- `wireAbrechnungSettings()` — [module/abrechnung-einstellungen.js:271](module/abrechnung-einstellungen.js#L271-L426) · 156 satır · profiles:update
- `mountBrandingExtras()` — [module/branding-ui.js:27](module/branding-ui.js#L27-L100) · 74 satır · profiles:update
- `renderLegendeSettings()` — [module/fussbefund.js:1797](module/fussbefund.js#L1797-L1861) · 65 satır · profiles:update
- `speichern()` — [module/praxis-rechtslinks-einstellungen.js:100](module/praxis-rechtslinks-einstellungen.js#L100-L123) · 24 satır · profiles:update
- `stempelHochladen()` — [module/stempel.js:55](module/stempel.js#L55-L68) · 14 satır · profiles:update
- `stempelEntfernen()` — [module/stempel.js:70](module/stempel.js#L70-L78) · 9 satır · profiles:update
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · profiles:update
- `bindPlan()` — [onboarding.js:870](onboarding.js#L870-L1016) · 147 satır · profiles:update

**Yol 5 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:18406](dashboard.js#L18406-L18463) · 58 satır · profiles:update

**Yol 6 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [module/ausfall-einstellungen.js:76](module/ausfall-einstellungen.js#L76-L118) · 43 satır · profiles:update

**Yol 7 — `speichereKonten()`** · Ekran: _UI yolu çözülemedi_
- `speichereKonten()` — [module/buchungskonten.js:295](module/buchungskonten.js#L295-L325) · 31 satır · profiles:update

**Yol 8 — `mountPraxisStandort()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `mountPraxisStandort()` — [module/praxis-standort.js:93](module/praxis-standort.js#L93-L171) · 79 satır · profiles:update
- `schalter()` — [module/praxis-standort.js:130](module/praxis-standort.js#L130-L141) · 12 satır · profiles:update
- `setzen()` — [module/praxis-standort.js:143](module/praxis-standort.js#L143-L167) · 25 satır · profiles:update

**Yol 9 — `speichereStufen()`** · Ekran: _UI yolu çözülemedi_
- `speichereStufen()` — [module/selbstzahler-stufen.js:260](module/selbstzahler-stufen.js#L260-L290) · 31 satır · profiles:update

**Yol 10 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

### `prescriptions` — 9 bağımsız yazma yolu

**Yol 1 — `kostentraegerIkZurueckschreiben()`** · Ekran: _UI yolu çözülemedi_
- `kostentraegerIkZurueckschreiben()` — [api-backend/billing/utils/kostentraeger-frisch.js:114](api-backend/billing/utils/kostentraeger-frisch.js#L114-L136) · 23 satır · prescriptions:update

**Yol 2 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · prescriptions:delete

**Yol 3 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:6330](dashboard.js#L6330-L6402) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:7548](dashboard.js#L7548-L7583) · 36 satır · prescriptions:update

**Yol 4 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:6405](dashboard.js#L6405-L6473) · 69 satır · prescriptions:update

**Yol 5 — `triggerStorno()`** · Ekran: _UI yolu çözülemedi_
- `triggerStorno()` — [dashboard.js:16036](dashboard.js#L16036-L16096) · 61 satır · prescriptions:update

**Yol 6 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [module/rechnung-dmrz.js:109](module/rechnung-dmrz.js#L109-L183) · 75 satır · prescriptions:update

**Yol 7 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:128](module/sitzungsfortschritt.js#L128-L173) · 46 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:131](module/sitzungsfortschritt.js#L131-L166) · 36 satır · prescriptions:update

**Yol 8 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:126](module/verordnung-einheiten.js#L126-L160) · 35 satır · prescriptions:update

**Yol 9 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:292](module/zuzahlung-befreiung.js#L292-L303) · 12 satır · prescriptions:update

### `leads` — 7 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · leads:delete, leads:update

**Yol 2 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:3838](dashboard.js#L3838-L3984) · 147 satır · leads:update

**Yol 3 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:6600](dashboard.js#L6600-L6687) · 88 satır · leads:update

**Yol 4 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:16585](dashboard.js#L16585-L16706) · 122 satır · leads:insert

**Yol 5 — `oeffnePatientenImport()`** · Ekran: _UI yolu çözülemedi_
- `oeffnePatientenImport()` — [module/patienten-import.js:399](module/patienten-import.js#L399-L565) · 167 satır · leads:insert, leads:delete
- `importiere()` — [module/patienten-import.js:515](module/patienten-import.js#L515-L534) · 20 satır · leads:insert
- `schritt3()` — [module/patienten-import.js:536](module/patienten-import.js#L536-L562) · 27 satır · leads:delete

**Yol 6 — `verordnungPatientenAbgleich()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `verordnungPatientenAbgleich()` — [module/verordnung-patient-abgleich.js:19](module/verordnung-patient-abgleich.js#L19-L98) · 80 satır · leads:update

**Yol 7 — `beantworteAltbestand()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `beantworteAltbestand()` — [module/verordnung-podo.js:919](module/verordnung-podo.js#L919-L932) · 14 satır · leads:update

### `businesses` — 6 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · businesses:update

**Yol 2 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:9076](dashboard.js#L9076-L9096) · 21 satır · businesses:update

**Yol 3 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:14422](dashboard.js#L14422-L14503) · 82 satır · businesses:update, businesses:insert

**Yol 4 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:14505](dashboard.js#L14505-L14522) · 18 satır · businesses:delete

**Yol 5 — `mountPraxisStandort()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `mountPraxisStandort()` — [module/praxis-standort.js:93](module/praxis-standort.js#L93-L171) · 79 satır · businesses:update
- `setzen()` — [module/praxis-standort.js:143](module/praxis-standort.js#L143-L167) · 25 satır · businesses:update

**Yol 6 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `prescription_sessions` — 5 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:3258](dashboard.js#L3258-L3354) · 97 satır · prescription_sessions:update

**Yol 2 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:6475](dashboard.js#L6475-L6493) · 19 satır · prescription_sessions:update

**Yol 3 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:6508](dashboard.js#L6508-L6598) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:86](module/sitzung-abgleich.js#L86-L112) · 27 satır · prescription_sessions:upsert

**Yol 4 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:94](module/booking-status-korrektur.js#L94-L148) · 55 satır · prescription_sessions:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · prescription_sessions:update
- `rebindeNoShowSitzungen()` — [module/termin-nicht-erschienen.js:283](module/termin-nicht-erschienen.js#L283-L319) · 37 satır · prescription_sessions:update

**Yol 5 — `bindeSitzungenAnTermin()`** · Ekran: _UI yolu çözülemedi_
- `bindeSitzungenAnTermin()` — [module/sitzung-bindung.js:44](module/sitzung-bindung.js#L44-L75) · 32 satır · prescription_sessions:update

### `services` — 5 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:6697](dashboard.js#L6697-L6736) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:8376](dashboard.js#L8376-L8403) · 28 satır · services:insert
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:8572](dashboard.js#L8572-L8607) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `renderServices()` — [dashboard.js:8759](dashboard.js#L8759-L8783) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:14422](dashboard.js#L14422-L14503) · 82 satır · services:insert

### `abrechnung` — 3 bağımsız yazma yolu

**Yol 1 — `createZuzahlungsforderungRouter()`** · Ekran: _UI yolu çözülemedi_
- `aktualisiereArtefaktVersion()` — [api-backend/billing/api/artefakt-version.js:142](api-backend/billing/api/artefakt-version.js#L142-L237) · 96 satır · abrechnung:update
- `createZuzahlungsforderungRouter()` — [api-backend/billing/api/zuzahlungsforderung.routes.js:131](api-backend/billing/api/zuzahlungsforderung.routes.js#L131-L1573) · 1443 satır · abrechnung:update, abrechnung:insert

**Yol 2 — `verworfeneNummerFesthalten()`** · Ekran: _UI yolu çözülemedi_
- `verworfeneNummerFesthalten()` — [api-backend/billing/api/verworfen.js:126](api-backend/billing/api/verworfen.js#L126-L178) · 53 satır · abrechnung:insert

**Yol 3 — `downloadAbrechnungFile()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `downloadAbrechnungFile()` — [module/abrechnung-detail.js:777](module/abrechnung-detail.js#L777-L800) · 24 satır · abrechnung:update

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:60](api-backend/lib/arzt-registry.js#L60-L194) · 135 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:13661](dashboard.js#L13661-L13668) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:13670](dashboard.js#L13670-L13715) · 46 satır · aerzte:update

### `employee_services` — 3 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · employee_services:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · employee_services:insert, employee_services:delete
- `loadEmpServices()` — [dashboard.js:10435](dashboard.js#L10435-L10519) · 85 satır · employee_services:insert, employee_services:delete

**Yol 3 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:599](onboarding.js#L599-L728) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:618](onboarding.js#L618-L728) · 111 satır · employee_services:insert

### `anamnese` — 2 bağımsız yazma yolu

**Yol 1 — `speichereNeu()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `speichereNeu()` — [module/anamnese-daten.js:69](module/anamnese-daten.js#L69-L75) · 7 satır · anamnese:insert

**Yol 2 — `markiereGeprueft()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `markiereGeprueft()` — [module/anamnese-daten.js:88](module/anamnese-daten.js#L88-L95) · 8 satır · anamnese:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:9100](dashboard.js#L9100-L9173) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · breaks:insert, breaks:delete
- `loadEmpHours()` — [dashboard.js:10343](dashboard.js#L10343-L10433) · 91 satır · breaks:insert, breaks:delete

### `calendar_integrations` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · calendar_integrations:delete
- `loadSettings()` — [dashboard.js:11056](dashboard.js#L11056-L11157) · 102 satır · calendar_integrations:delete

**Yol 2 — `loadIntegrations()`** · Ekran: _UI yolu çözülemedi_
- `loadIntegrations()` — [kalender.js:762](kalender.js#L762-L784) · 23 satır · calendar_integrations:delete

### `email_logs` — 2 bağımsız yazma yolu

**Yol 1 — `loadPatientDetailMails()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loadPatientDetailMails()` — [dashboard.js:7904](dashboard.js#L7904-L7940) · 37 satır · email_logs:update

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · email_logs:insert

### `employee_business_assignments` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · employee_business_assignments:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · employee_business_assignments:upsert, employee_business_assignments:delete
- `renderOtherStandortEmps()` — [dashboard.js:9751](dashboard.js#L9751-L9836) · 86 satır · employee_business_assignments:upsert
- `renderEmpStandortList()` — [dashboard.js:9898](dashboard.js#L9898-L9963) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete
- `saveEmpPermissions()` — [dashboard.js:9999](dashboard.js#L9999-L10050) · 52 satır · employee_business_assignments:upsert

### `employee_scope_overrides` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · employee_scope_overrides:delete

**Yol 2 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · employee_scope_overrides:delete, employee_scope_overrides:insert
- `saveEmpPermissions()` — [dashboard.js:9999](dashboard.js#L9999-L10050) · 52 satır · employee_scope_overrides:delete, employee_scope_overrides:insert

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:3502](dashboard.js#L3502-L3563) · 62 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:3624](dashboard.js#L3624-L3712) · 89 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:13272](dashboard.js#L13272-L13360) · 89 satır · invoices:update, invoices:insert

**Yol 2 — `frageZahlungsstatus()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:72](module/rechnung-zahlung.js#L72-L84) · 13 satır · invoices:update
- `frageZahlungsstatus()` — [module/rechnung-zahlung.js:159](module/rechnung-zahlung.js#L159-L230) · 72 satır · invoices:update

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:279](admin.js#L279-L304) · 26 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:360](admin.js#L360-L375) · 16 satır · module_visibility:upsert

### `patient_consents` — 2 bağımsız yazma yolu

**Yol 1 — `speichereEinwilligung()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:353](module/patienten-einwilligung.js#L353-L391) · 39 satır · patient_consents:insert

**Yol 2 — `widerrufen()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `widerrufen()` — [module/patienten-einwilligung.js:600](module/patienten-einwilligung.js#L600-L618) · 19 satır · patient_consents:update

### `podologie_behandlungen` — 2 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `behandlungStornieren()` — [module/podo-storno.js:91](module/podo-storno.js#L91-L166) · 76 satır · podologie_behandlungen:update
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:492](module/podologie-abrechnung.js#L492-L1264) · 773 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:194](module/rechnung-bruecke.js#L194-L223) · 30 satır · podologie_behandlungen:update

### `prescription_documents` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:75](api-backend/dsgvo/loeschen.js#L75-L760) · 686 satır · prescription_documents:delete

**Yol 2 — `ladeLhbNachweisHoch()`** · Ekran: _UI yolu çözülemedi_
- `ladeLhbNachweisHoch()` — [module/verordnung-nachweis.js:109](module/verordnung-nachweis.js#L109-L145) · 37 satır · prescription_documents:insert

### `time_offs` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loadTeam()` — [dashboard.js:9399](dashboard.js#L9399-L9582) · 184 satır · time_offs:insert
- `deleteEmpTimeOff()` — [dashboard.js:9653](dashboard.js#L9653-L9667) · 15 satır · time_offs:delete
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · time_offs:delete, time_offs:insert
- `deleteUrlaub()` — [dashboard.js:9730](dashboard.js#L9730-L9737) · 8 satır · time_offs:delete
- `openEmpDetail()` — [dashboard.js:10052](dashboard.js#L10052-L10249) · 198 satır · time_offs:insert

**Yol 2 — `saveUrlaub()`** · Ekran: _UI yolu çözülemedi_
- `saveUrlaub()` — [dashboard.js:9669](dashboard.js#L9669-L9699) · 31 satır · time_offs:insert

### `user_preferences` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · user_preferences:upsert
- `saveUserPref()` — [dashboard.js:12713](dashboard.js#L12713-L12723) · 11 satır · user_preferences:upsert

**Yol 2 — `switchBusiness()`** · Ekran: _UI yolu çözülemedi_
- `switchBusiness()` — [dashboard.js:14584](dashboard.js#L14584-L14599) · 16 satır · user_preferences:upsert

### `working_hours` — 2 bağımsız yazma yolu

**Yol 1 — `fmt()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `fmt()` — [dashboard.js:9720](dashboard.js#L9720-L12721) · 3002 satır · working_hours:upsert
- `loadEmpHours()` — [dashboard.js:10343](dashboard.js#L10343-L10433) · 91 satır · working_hours:upsert

**Yol 2 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:813](onboarding.js#L813-L858) · 46 satır · working_hours:delete, working_hours:insert

## En çok yazılan tablolar

- `profiles` — 29 ayrı fonksiyon yazıyor
- `bookings` — 18 ayrı fonksiyon yazıyor
- `prescriptions` — 11 ayrı fonksiyon yazıyor
- `document_vorlagen` — 10 ayrı fonksiyon yazıyor
- `leads` — 9 ayrı fonksiyon yazıyor
- `prescription_sessions` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `businesses` — 7 ayrı fonksiyon yazıyor
- `services` — 7 ayrı fonksiyon yazıyor
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
- `user_preferences` — 3 ayrı fonksiyon yazıyor

## Bilinçli aynalar — kod içinde beyan edilmiş (kopya DEĞiL)

Frontend/backend paylaşılan modül yolu yok; bu yüzden aynı kural iki dosyaya
yazılmış ve kod bunu kendi yorumunda söylemiş („Spiegel von“ / „Identisch mit“).
Bunları birleştirme — birleştirilecek olsaydı zaten tek dosya olurdu.

- `ausstellerSnapshot()` — [api-backend/lib/rechnung-snapshot.js:18](api-backend/lib/rechnung-snapshot.js#L18-L31) — Spiegel von module/branding
- `bgFehltFuerRechnung()` — [api-backend/lib/rezept-felder.js:326](api-backend/lib/rezept-felder.js#L326-L332) — Spiegel von `bgFehltFuerRechnung` in `module/bg-angaben
- `dgStamm()` — [api-backend/billing/api/verordnung-status.routes.js:102](api-backend/billing/api/verordnung-status.routes.js#L102-L106) — Spiegel von `dgWurzel()` in `module/verordnung-regeln
- `empfaengerSnapshot()` — [api-backend/lib/rechnung-snapshot.js:53](api-backend/lib/rechnung-snapshot.js#L53-L74) — Spiegel von module/bg-angaben
- `fehlendePflichtangaben()` — [module/beleg-druck.js:52](module/beleg-druck.js#L52-L57) — Identisch mit `fehlendePflichtangaben()` im Backend — beim Ändern beide
- `istEchteUebersetzung()` — [api-backend/billing/zaa/anwenden.js:15](api-backend/billing/zaa/anwenden.js#L15-L18) — identisch mit dem Dateitext (z
- `kartenIkNormalisieren()` — [module/krankenkasse-suche.js:169](module/krankenkasse-suche.js#L169-L172) — Spiegel von `kartenIkNormalisieren()` in `api-backend/lib/rezept-felder
- `leitsymptomatikAlsBitmaske()` — [api-backend/billing/dta/leitsymptomatik.js:58](api-backend/billing/dta/leitsymptomatik.js#L58-L96) — Spiegel von `leitsymptomatikListe()` in `module/verordnung-pruefung
- `leitsymptomatikListe()` — [module/verordnung-pruefung.js:115](module/verordnung-pruefung.js#L115-L127) — Spiegel von `api-backend/billing/dta/leitsymptomatik
- `pruefTitel()` — [module/verordnung-uebersicht.js:510](module/verordnung-uebersicht.js#L510-L516) — Spiegel von `pruefTitel` in module/verordnung-liste
- `t()` — [api-backend/lib/rechnung-snapshot.js:14](api-backend/lib/rechnung-snapshot.js#L14-L31) — Spiegel von `module/branding
- `zuVieleBehandlungenJeTag()` — [module/podo-behandlungstag-regel.js:79](module/podo-behandlungstag-regel.js#L79-L94) — Spiegel von behandlungstageJeDatum/TAGESHOECHSTZAHL in api-backend/billing/utils/behandlungstage

## Aynı ada sahip birden fazla tanım

Bu bir kopya listesi değil, bir isim çakışması listesi — aynı isim farklı iş yapıyor olabilir.
`aynalar` doluysa o konum bilinçli ayna; boşsa isim çakışması başka bir şeydir, incele.

- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:24 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:522 · module/abrechnung-status.js:187 · module/abrechnungsstatus.js:735 · module/ausfallrechnung.js:19 · module/behandlungsbestaetigung.js:37 · module/diagnosegruppen-regeln.js:32 · module/fussbefund.js:204 · module/kalender-raster.js:24 · module/kalender-woche.js:42 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/patient-termine.js:1 · module/rezeptinfo-geld.js:72 · module/termin-aktionen.js:42 · module/termin-druck.js:27 · module/termin-panel.js:34 · module/warteliste-ansicht.js:26 · module/warteliste-nachruecker.js:49
- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-artefakte.js:22 · module/abrechnung-auswahl.js:763 · module/abrechnung-detail.js:175 · module/abrechnung-freigabe.js:112 · module/anamnese.js:44 · module/arzt-register.js:125 · module/branding-ui.js:16 · module/einrichtung-ring.js:12 · module/krankenkasse-suche.js:642 · module/patienten-einwilligung.js:60 · module/patienten-import.js:309 · module/patientenkarte.js:44 · module/podo-einheiten.js:379 · module/rechnung-zahlungseingang.js:225 · module/ueber.js:26 · module/verordnung-feldmarker.js:80 · module/verordnung-uebersicht.js:115 · module/zuzahlung-befreiung.js:305 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `fmt` — api-backend/setup/router.js:122 · dashboard.js:1142 · dashboard.js:7592 · dashboard.js:9362 · dashboard.js:9639 · dashboard.js:9720 · dashboard.js:12801 · dashboard.js:17505 · dashboard.js:17591 · dashboard.js:17670 · dashboard.js:17702 · dashboard.js:17762 · module/kalender-raster.js:71 · module/rechnung-ansicht.js:220 · module/rezeptinfo-geld.js:70
- `render` — calendar-widget.js:127 · dashboard.js:12358 · dashboard.js:17321 · module/app-start.js:32 · module/ki-einstellungen.js:13 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:116
- `r2` — api-backend/billing/api/abrechnung.routes.js:2334 · api-backend/billing/api/statistik.routes.js:176 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:62 · api-backend/billing/dta/preflight.js:773 · api-backend/billing/preise/resolver.js:42 · api-backend/billing/utils/abrechnung-zeilen.js:36 · api-backend/billing/zuzahlung/calculator.js:14 · api-backend/billing/zuzahlung/korrektur.js:16 · module/abrechnung-verlauf.js:128 · module/zuzahlung-rechnen.js:42
- `$` — attendance.js:10 · module/anamnese.js:43 · module/branding-ui.js:31 · module/kiosk.js:72 · module/rechnung-zahlungseingang.js:455 · module/ueber.js:52 · module/verordnung-podo.js:83 · module/verordnung-pruefen-knopf.js:42 · module/zuzahlung-korrektur.js:206 · ops/app.js:48
- `fmtDate` — api-backend/billing/dta/encoding.js:85 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:29 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:990 · ops/app.js:84
- `g` — dashboard.js:13728 · dashboard.js:13741 · dashboard.js:13914 · module/rezept-barcode-bestaetigung.js:4 · module/rezept-barcode-dialog.js:6 · module/rezept-in-maske.js:40 · module/rezept-patientenkopf.js:4 · module/verordnung-anlegen.js:32 · module/verordnung-maske.js:434 · module/verordnung-nachweis.js:28
- `schliessen` — cookie-consent.js:76 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:596 · module/arzt-register.js:276 · module/patienten-import.js:418 · module/rechnung-zahlungseingang.js:555 · module/verordnung-feldmarker.js:240 · module/verordnung-import.js:314 · module/zuzahlung-befreiung.js:151 · module/zuzahlung-korrektur.js:209
- `init` — attendance.js:299 · booking-request.js:1420 · booking.js:64 · cookie-consent.js:139 · dashboard.js:14647 · kalender.js:130 · onboarding.js:77 · setup.js:218
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:28 · api-backend/billing/api/mahnwesen.routes.js:24 · api-backend/billing/api/podo-empfangsnachweis.routes.js:12 · api-backend/billing/api/rechnung-zahlung.routes.js:84 · api-backend/billing/api/statistik.routes.js:19 · api-backend/billing/api/verordnung-status.routes.js:47 · api-backend/billing/api/warteliste.routes.js:22 · api-backend/billing/api/zuzahlung.routes.js:47
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:11 · api-backend/ai/tasks/b2b-draft.js:62 · api-backend/ai/tasks/b2c-draft.js:62 · api-backend/ai/tasks/rezept-normalize.js:109 · api-backend/ai/tasks/rezept-ocr.js:19 · api-backend/ai/tasks/rezept-validate.js:8 · api-backend/ai/tasks/series-scheduler.js:3 · merkez/db.js:125
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:28 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · module/geld.js:48
- `t` — api-backend/lib/rechnung-snapshot.js:14 · dashboard.js:521 · module/anamnese.js:386 · module/bg-angaben.js:36 · module/branding.js:28 · module/kiosk.js:56 · module/termin-rechtstexte.js:20
  - ayna: api-backend/lib/rechnung-snapshot.js:14 — Spiegel von `module/branding
- `zeichne` — module/abrechnung-auswahl.js:767 · module/abrechnungsstatus.js:609 · module/einrichtung-ring.js:27 · module/patienten-einwilligung.js:541 · module/patienten-import.js:342 · module/praxis-standort.js:115 · module/rezeptinfo-geld.js:421
- `zeile` — module/branding-ui.js:39 · module/einrichtung-ring.js:40 · module/rechnung-druck.js:33 · module/verordnung-detail.js:274 · module/verordnung-detail.js:403 · module/verordnung-detail.js:460 · module/verordnung-pruefen-knopf.js:116
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:47 · api-backend/billing/zuzahlung/zu-beleg.js:15 · api-backend/server.js:342
- `cleanup` — dashboard.js:6214 · dashboard.js:6301 · dashboard.js:18071 · merkez/test/dev-server.js:84 · module/absagegrund-modal.js:81 · module/bestaetigungs-dialog.js:20
- `el` — module/arzt-register.js:251 · module/fussbefund.js:232 · module/patient-notizen.js:3 · module/termin-aktionsleiste.js:49 · module/termin-panel.js:39 · module/verordnung-maske.js:703
- `load` — module/patient-notizen.js:19 · module/rezept-patientenkopf.js:23 · ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `sha256Hex` — api-backend/billing/api/abrechnung.routes.js:95 · api-backend/billing/api/artefakt-registry.js:23 · api-backend/billing/api/zuzahlungsforderung.routes.js:39 · api-backend/billing/dta/zuzahlungsforderung-ursprung.js:73 · api-backend/merkez-istemci/signatur.js:22 · module/einwilligung-texte.js:422
- `wert` — module/anfrage-bearbeiten.js:171 · module/fahrtenbuch-regeln.js:307 · module/hausbesuch-route.js:31 · module/mail-entwurf.js:41 · module/verordnung-pruefen-knopf.js:43 · setup.js:324
- `leer` — api-backend/billing/dta/auftragsdatei.js:53 · module/fahrtenbuch-regeln.js:315 · module/fussbefund-archiv.js:199 · module/sitzungsplan.js:114 · module/verordnung-pruefung.js:100
- `log` — installieren/install.sh:19 · onprem/backup.sh:47 · onprem/install.sh:68 · onprem/restore.sh:44 · onprem/update.sh:59
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/merkez-istemci/kayit.js:195 · api-backend/preise_autoupdate.mjs:194 · api-backend/preise_pruefen.mjs:240 · api-backend/sync_heilmittel_katalog.js:151
- `ok` — installieren/install.sh:20 · onprem/backup.sh:48 · onprem/install.sh:69 · onprem/restore.sh:45 · onprem/update.sh:60
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/builder.js:63 · api-backend/billing/dta/preflight.js:159
- `speichern` — cookie-consent.js:69 · module/arzt-register.js:292 · module/fussbefund.js:792 · module/praxis-rechtslinks-einstellungen.js:100 · module/verordnung-detail.js:827
- `closeModal` — dashboard.js:919 · dashboard.js:11218 · dashboard.js:11639 · ops/app.js:162
- `fehler` — installieren/install.sh:22 · onprem/backup.sh:50 · onprem/restore.sh:47 · onprem/update.sh:65
- `invalidate` — api-backend/ai/ki-jeton.js:146 · module/patient-notizen.js:9 · module/patient-ueberweisung-upload.js:4 · module/rezept-patientenkopf.js:19
- `loadServices` — booking-request.js:529 · booking.js:176 · dashboard.js:8356 · kalender.js:643
- `norm` — katalog-suche.js:414 · module/patienten-import.js:73 · module/termin-aktionen.js:608 · ops/tools/regroup.mjs:59
- `onEsc` — dashboard.js:6308 · module/rechnung-leistung-picker.js:46 · module/zuzahlung-befreiung.js:156 · module/zuzahlung-korrektur.js:214
- `setze` — merkez/cloudflare.js:30 · module/serien-termine.js:200 · module/termin-folge.js:194 · module/termin-heute.js:86
- `tick` — api-backend/dsgvo/fristen.js:97 · api-backend/merkez-istemci/ip-abgleich.js:257 · api-backend/server.js:3873 · dashboard.js:13085
- `v` — dashboard.js:12093 · dashboard.js:12115 · dashboard.js:12135 · dashboard.js:14433
- `warn` — onprem/backup.sh:49 · onprem/install.sh:70 · onprem/restore.sh:46 · onprem/update.sh:61
- `zahl` — api-backend/lib/gps-checkin.js:11 · module/frequenz-pruefung.js:137 · module/rechnung-summen.js:11 · module/rezept-in-maske.js:223
- `zeigeFehler` — module/abrechnung-detail.js:576 · module/abrechnung-detail.js:618 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:208

## Shell (onprem/)

### `installieren/install.ps1`
- sources: `lib-setup-jeton.sh`
- `U()` — Zeile 112 · calledBy: BoxEnv, BoxFrage, BoxImFenster, BoxZeile, EinrichtungsLink, Frage, InWsl, UiStarten, installieren/install.ps1
- `Rgb()` — Zeile 122 · calledBy: Dialog, installieren/install.ps1
- `Pt()` — Zeile 123 · calledBy: installieren/install.ps1
- `Gr()` — Zeile 124 · calledBy: installieren/install.ps1
- `UiStarten()` — Zeile 289 · calledBy: installieren/install.ps1
- `UiSchritt()` — Zeile 321 · calledBy: Log
- `UiFrage()` — Zeile 330 · calledBy: Fehler, Frage, installieren/install.ps1
- `UiAbschluss()` — Zeile 338 · calledBy: Fehler, installieren/install.ps1
- `UiZu()` — Zeile 348 · calledBy: UiAbschluss
- `KonsoleZeigen()` — Zeile 356 · calledBy: UiZu, installieren/install.ps1
- `Dialog()` — Zeile 374 · calledBy: BoxFrage, installieren/install.ps1
- `BoxFrage()` — Zeile 446 · calledBy: BoxImFenster
- `BoxZeile()` — Zeile 482 · calledBy: BoxImFenster
- `BoxImFenster()` — Zeile 490 · calledBy: installieren/install.ps1
- `Log()` — Zeile 524 · calledBy: Fehler, Ok, Warn, installieren/install.ps1
- `Ok()` — Zeile 531 · calledBy: Dialog, installieren/install.ps1
- `Warn()` — Zeile 532 · calledBy: EinrichtungOeffnen, EinrichtungsLink, installieren/install.ps1
- `Fehler()` — Zeile 533 · calledBy: UiStarten, installieren/install.ps1
- `Frage()` — Zeile 547 · calledBy: BoxImFenster, UiFrage, UiStarten, installieren/install.ps1
- `InWsl()` — Zeile 561 · calledBy: installieren/install.ps1
- `WslLeise()` — Zeile 574 · calledBy: BoxEnv, DistroVorhanden, EinrichtungsLink, installieren/install.ps1
- `WslMitFehlertext()` — Zeile 578 · calledBy: installieren/install.ps1
- `WslInBenutzung()` — Zeile 585
- `BoxEnv()` — Zeile 589 · calledBy: EinrichtungOeffnen, EinrichtungsLink, installieren/install.ps1
- `DistroVorhanden()` — Zeile 594
- `EinrichtungsLink()` — Zeile 614 · calledBy: installieren/install.ps1
- `EinrichtungOeffnen()` — Zeile 635 · calledBy: installieren/install.ps1

### `installieren/install.sh`
- sources: `os-release`
- `log()` — Zeile 19 · calledBy: docker_installieren, main
- `ok()` — Zeile 20 · calledBy: docker_installieren, main
- `fehler()` — Zeile 22 · calledBy: docker_installieren, main
- `hilfe()` — Zeile 28
- `docker_installieren()` — Zeile 43 · calledBy: main
- `main()` — Zeile 79 · calledBy: installieren/install.sh

### `onprem/backup.sh`
- `log()` — Zeile 47 · calledBy: fehler, onprem/backup.sh, sicherung_alarm
- `ok()` — Zeile 48 · calledBy: onprem/backup.sh
- `warn()` — Zeile 49 · calledBy: onprem/backup.sh, sicherung_alarm
- `fehler()` — Zeile 50 · calledBy: onprem/backup.sh
- `sicherung_alarm()` — Zeile 98 · calledBy: bitis, bitis_alarm
- `sicherung_status_yaz()` — Zeile 142 · calledBy: sicherung_alarm
- `env_wert()` — Zeile 149 · calledBy: onprem/backup.sh, sicherung_alarm
- `bitis_alarm()` — Zeile 155
- `temizle()` — Zeile 226 · calledBy: bitis
- `bitis()` — Zeile 231
- `sema_versiyonu_oku()` — Zeile 286 · calledBy: onprem/backup.sh
- `pki_sammeln()` — Zeile 299 · calledBy: onprem/backup.sh
- `parmak_izi_dek()` — Zeile 373 · calledBy: onprem/backup.sh
- `parmak_izi_db_taraf()` — Zeile 393 · calledBy: onprem/backup.sh
- `kanonischer_meta_text()` — Zeile 447 · calledBy: onprem/backup.sh
- `meta_hmac_berechnen()` — Zeile 454 · calledBy: onprem/backup.sh
- `json_deger()` — Zeile 487 · calledBy: onprem/backup.sh
- `durum_dosyasi_yaz()` — Zeile 535 · calledBy: onprem/backup.sh
- `rotasyon_vor_migration()` — Zeile 559 · calledBy: onprem/backup.sh
- `rotasyon_nightly()` — Zeile 562 · calledBy: onprem/backup.sh

### `onprem/install.sh`
- sources: `lib-ip.sh`, `lib-setup-jeton.sh`, `||`, `lib-health.sh`
- `log()` — Zeile 68 · calledBy: fail, onprem/install.sh
- `ok()` — Zeile 69 · calledBy: lokale_ca_vorbereiten, onprem/install.sh
- `warn()` — Zeile 70 · calledBy: onprem/install.sh
- `reveal_once()` — Zeile 71 · calledBy: onprem/install.sh
- `frage()` — Zeile 85 · calledBy: onprem/install.sh
- `fail()` — Zeile 97 · calledBy: frage, lokale_ca_vorbereiten, lokaler_name_pruefen, onprem/install.sh
- `env_get()` — Zeile 117 · calledBy: onprem/install.sh
- `set_env()` — Zeile 127 · calledBy: onprem/install.sh
- `b64url()` — Zeile 723 · calledBy: sign_jwt
- `sign_jwt()` — Zeile 724 · calledBy: onprem/install.sh
- `lokaler_name_pruefen()` — Zeile 778 · calledBy: lokale_ca_vorbereiten, onprem/install.sh
- `lokale_ca_vorbereiten()` — Zeile 798 · calledBy: onprem/install.sh

### `onprem/ip-melden.sh`
- sources: `lib-ip.sh`, `||`
- `le_konto_melden()` — Zeile 31 · calledBy: onprem/ip-melden.sh
- `zeit_melden()` — Zeile 59 · calledBy: onprem/ip-melden.sh

### `onprem/lib-health.sh`
- `warte_auf_gesundheit()` — Zeile 21 · calledBy: onprem/install.sh, onprem/update.sh
- `bereitschaft_einordnen()` — Zeile 78 · calledBy: bereitschaft_pruefen
- `bereitschaft_pruefen()` — Zeile 98 · calledBy: onprem/install.sh, onprem/update.sh

### `onprem/lib-ip.sh`
- `lan_ip_ermitteln()` — Zeile 22 · calledBy: onprem/install.sh, onprem/ip-melden.sh, onprem/update.sh
- `ist_rfc1918()` — Zeile 34 · calledBy: ip_modus_yaz, onprem/install.sh, onprem/ip-melden.sh
- `ip_modus_yaz()` — Zeile 50 · calledBy: onprem/install.sh, onprem/update.sh
- `ip_timer_kur()` — Zeile 97 · calledBy: onprem/install.sh, onprem/update.sh
- `status_datei_yaz()` — Zeile 145 · calledBy: status_stand_yaz, zeit_melden
- `status_container_digest()` — Zeile 160 · calledBy: status_stand_yaz
- `status_stand_yaz()` — Zeile 171 · calledBy: onprem/install.sh, onprem/update.sh

### `onprem/lib-setup-jeton.sh`
- `_sj_env_lesen()` — Zeile 18 · calledBy: setup_abgeschlossen_lesen, setup_jeton_aufraeumen
- `_sj_env_setzen()` — Zeile 24 · calledBy: setup_jeton_aufraeumen, setup_jeton_neu
- `setup_abgeschlossen_lesen()` — Zeile 49 · calledBy: onprem/install.sh, setup_jeton_aufraeumen
- `setup_jeton_aufraeumen()` — Zeile 82 · calledBy: onprem/install.sh, onprem/update.sh
- `setup_jeton_neu()` — Zeile 110 · calledBy: onprem/install.sh

### `onprem/reset-owner-passwort.sh`
- `fail()` — Zeile 22 · calledBy: onprem/reset-owner-passwort.sh

### `onprem/restore.sh`
- `log()` — Zeile 44 · calledBy: fehler, onprem/restore.sh
- `ok()` — Zeile 45 · calledBy: onprem/restore.sh
- `warn()` — Zeile 46 · calledBy: onprem/restore.sh
- `fehler()` — Zeile 47 · calledBy: onprem/restore.sh
- `env_wert()` — Zeile 93 · calledBy: onprem/restore.sh
- `meta_alan()` — Zeile 119 · calledBy: onprem/restore.sh
- `restore_temizle()` — Zeile 217 · calledBy: onprem/restore.sh
- `kanonischer_meta_text()` — Zeile 286 · calledBy: onprem/restore.sh
- `meta_hmac_berechnen()` — Zeile 294 · calledBy: onprem/restore.sh
- `parmak_izi_dek()` — Zeile 456 · calledBy: onprem/restore.sh
- `parmak_izi_db_taraf()` — Zeile 464 · calledBy: onprem/restore.sh
- `pki_ca_zurueck()` — Zeile 798 · calledBy: pki_zurueckspielen
- `pki_zurueckspielen()` — Zeile 810 · calledBy: onprem/restore.sh

### `onprem/update.sh`
- sources: `lib-health.sh`, `lib-ip.sh`, `lib-setup-jeton.sh`
- `log()` — Zeile 59 · calledBy: fehler, mail_gonder_container, onprem/update.sh, zertifikat_pruefen
- `ok()` — Zeile 60 · calledBy: bildirim_degerlendir, onprem/update.sh, zertifikat_pruefen
- `warn()` — Zeile 61 · calledBy: bildirim_degerlendir, mail_gonder_container, onprem/update.sh, zertifikat_pruefen
- `fehler()` — Zeile 65 · calledBy: fail, onprem/update.sh
- `fail()` — Zeile 79
- `env_wert()` — Zeile 125 · calledBy: onprem/update.sh, owner_bilgisini_guncelle, zertifikat_pruefen
- `mail_gonder_container()` — Zeile 141 · calledBy: bildirim_degerlendir, zertifikat_pruefen
- `zertifikat_pruefen()` — Zeile 173 · calledBy: onprem/update.sh
- `manifest_feld()` — Zeile 259 · calledBy: onprem/update.sh
- `dateien_sha_icerik()` — Zeile 306 · calledBy: durumu_yaz
- `onceki_sha()` — Zeile 309 · calledBy: onprem/update.sh
- `durumu_yaz()` — Zeile 315 · calledBy: onprem/update.sh
- `owner_bilgisini_guncelle()` — Zeile 343 · calledBy: onprem/update.sh
- `bildirim_alani_oku()` — Zeile 359 · calledBy: bildirim_degerlendir, onprem/update.sh
- `bildirim_kaydet()` — Zeile 371 · calledBy: bildirim_degerlendir
- `bildirim_degerlendir()` — Zeile 388 · calledBy: durumu_yaz
- `geri_yukle()` — Zeile 541 · calledBy: onprem/update.sh
- `anahtarlari_oku()` — Zeile 560 · calledBy: onprem/update.sh
- `deger_oku()` — Zeile 564 · calledBy: onprem/update.sh
