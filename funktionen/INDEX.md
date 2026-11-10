# Funktionskarte

> Üretim: 2026-11-10 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**4506 fonksiyon** (4384 JS · 95 bash · 27 ps1) · 552 dosya · 42 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `profiles` — 24 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · profiles:update

**Yol 2 — `createMailversandRouter()`** · Ekran: _UI yolu çözülemedi_
- `createMailversandRouter()` — [api-backend/routes/mailversand.js:135](api-backend/routes/mailversand.js#L135-L330) · 196 satır · profiles:update

**Yol 3 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:1718](dashboard.js#L1718-L1828) · 111 satır · profiles:update

**Yol 4 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:4601](dashboard.js#L4601-L4627) · 27 satır · profiles:update

**Yol 5 — `openEmpDetail()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `openEmpDetail()` — [dashboard.js:9558](dashboard.js#L9558-L9755) · 198 satır · profiles:update

**Yol 6 — `ensureCompanyCode()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:11658](dashboard.js#L11658-L11664) · 7 satır · profiles:update

**Yol 7 — `ensureBookingSlug()`** · Ekran: _UI yolu çözülemedi_
- `ensureBookingSlug()` — [dashboard.js:11675](dashboard.js#L11675-L11688) · 14 satır · profiles:update

**Yol 8 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:17864](dashboard.js#L17864-L17921) · 58 satır · profiles:update

**Yol 9 — `wireAbrechnungSettings()`** · Ekran: _UI yolu çözülemedi_
- `wireAbrechnungSettings()` — [module/abrechnung-einstellungen.js:271](module/abrechnung-einstellungen.js#L271-L426) · 156 satır · profiles:update
- `speichern()` — [module/fax-einstellungen.js:112](module/fax-einstellungen.js#L112-L134) · 23 satır · profiles:update
- `verbindeMailSignaturen()` — [module/mail-signatur-anbindung.js:3](module/mail-signatur-anbindung.js#L3-L12) · 10 satır · profiles:update
- `speichern()` — [module/praxis-rechtslinks-einstellungen.js:102](module/praxis-rechtslinks-einstellungen.js#L102-L125) · 24 satır · profiles:update

**Yol 10 — `saveAusfallSettings()`** · Ekran: _UI yolu çözülemedi_
- `saveAusfallSettings()` — [module/ausfall-einstellungen.js:76](module/ausfall-einstellungen.js#L76-L118) · 43 satır · profiles:update

**Yol 11 — `mountBrandingExtras()`** · Ekran: _UI yolu çözülemedi_
- `mountBrandingExtras()` — [module/branding-ui.js:27](module/branding-ui.js#L27-L100) · 74 satır · profiles:update
- `stempelHochladen()` — [module/stempel.js:55](module/stempel.js#L55-L68) · 14 satır · profiles:update
- `stempelEntfernen()` — [module/stempel.js:70](module/stempel.js#L70-L78) · 9 satır · profiles:update

**Yol 12 — `speichereKonten()`** · Ekran: _UI yolu çözülemedi_
- `speichereKonten()` — [module/buchungskonten.js:295](module/buchungskonten.js#L295-L325) · 31 satır · profiles:update

**Yol 13 — `nur()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `nur()` — [module/datev-einstellungen.js:36](module/datev-einstellungen.js#L36-L142) · 107 satır · profiles:update
- `renderDatevSettings()` — [module/datev-einstellungen.js:51](module/datev-einstellungen.js#L51-L107) · 57 satır · profiles:update

**Yol 14 — `renderLegendeSettings()`** · Ekran: _UI yolu çözülemedi_
- `renderLegendeSettings()` — [module/fussbefund.js:1804](module/fussbefund.js#L1804-L1868) · 65 satır · profiles:update

**Yol 15 — `mountPraxisStandort()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `mountPraxisStandort()` — [module/praxis-standort.js:93](module/praxis-standort.js#L93-L171) · 79 satır · profiles:update
- `schalter()` — [module/praxis-standort.js:130](module/praxis-standort.js#L130-L141) · 12 satır · profiles:update
- `setzen()` — [module/praxis-standort.js:143](module/praxis-standort.js#L143-L167) · 25 satır · profiles:update

**Yol 16 — `speichereStufen()`** · Ekran: _UI yolu çözülemedi_
- `speichereStufen()` — [module/selbstzahler-stufen.js:260](module/selbstzahler-stufen.js#L260-L290) · 31 satır · profiles:update

**Yol 17 — `speichereSchalter()`** · Ekran: _UI yolu çözülemedi_
- `speichereSchalter()` — [module/terminerinnerung-einstellung.js:29](module/terminerinnerung-einstellung.js#L29-L33) · 5 satır · profiles:update

**Yol 18 — `loadProfile()`** · Ekran: _UI yolu çözülemedi_
- `loadProfile()` — [onboarding.js:115](onboarding.js#L115-L173) · 59 satır · profiles:insert

**Yol 19 — `saveStepProgress()`** · Ekran: _UI yolu çözülemedi_
- `saveStepProgress()` — [onboarding.js:281](onboarding.js#L281-L285) · 5 satır · profiles:update

**Yol 20 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · profiles:update

**Yol 21 — `bindBilling()`** · Ekran: _UI yolu çözülemedi_
- `bindBilling()` — [onboarding.js:453](onboarding.js#L453-L513) · 61 satır · profiles:update
- `handleSave()` — [onboarding.js:457](onboarding.js#L457-L503) · 47 satır · profiles:update

**Yol 22 — `bindOwner()`** · Ekran: _UI yolu çözülemedi_
- `bindOwner()` — [onboarding.js:516](onboarding.js#L516-L542) · 27 satır · profiles:update

**Yol 23 — `bindHours()`** · Ekran: _UI yolu çözülemedi_
- `bindHours()` — [onboarding.js:820](onboarding.js#L820-L865) · 46 satır · profiles:update

**Yol 24 — `bindPlan()`** · Ekran: _UI yolu çözülemedi_
- `bindPlan()` — [onboarding.js:877](onboarding.js#L877-L1023) · 147 satır · profiles:update

### `bookings` — 16 bağımsız yazma yolu

**Yol 1 — `cancelRequestBookings()`** · Ekran: _UI yolu çözülemedi_
- `cancelRequestBookings()` — [api-backend/booking/cancel-request.js:3](api-backend/booking/cancel-request.js#L3-L16) · 14 satır · bookings:update

**Yol 2 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:17](api-backend/booking/from-request.js#L17-L135) · 119 satır · bookings:insert
- `mitAkte()` — [api-backend/booking/from-request.js:41](api-backend/booking/from-request.js#L41-L49) · 9 satır · bookings:insert
- `insertBooking()` — [api-backend/booking/from-request.js:42](api-backend/booking/from-request.js#L42-L49) · 8 satır · bookings:insert

**Yol 3 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · bookings:delete

**Yol 4 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:2405](dashboard.js#L2405-L2807) · 403 satır · bookings:update

**Yol 5 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:2902](dashboard.js#L2902-L2997) · 96 satır · bookings:insert

**Yol 6 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:3145](dashboard.js#L3145-L3206) · 62 satır · bookings:update

**Yol 7 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:3223](dashboard.js#L3223-L3237) · 15 satır · bookings:update

**Yol 8 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:3267](dashboard.js#L3267-L3355) · 89 satır · bookings:update

**Yol 9 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:3357](dashboard.js#L3357-L3435) · 79 satır · bookings:update

**Yol 10 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:3732](dashboard.js#L3732-L3809) · 78 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:3847](dashboard.js#L3847-L3969) · 123 satır · bookings:insert

**Yol 11 — `doMoveBooking()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:4302](dashboard.js#L4302-L4330) · 29 satır · bookings:update

**Yol 12 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:94](module/booking-status-korrektur.js#L94-L151) · 58 satır · bookings:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · bookings:update

**Yol 13 — `mountAktionspanel()`** · Ekran: _UI yolu çözülemedi_
- `mountAktionspanel()` — [module/raum-auswahl.js:338](module/raum-auswahl.js#L338-L364) · 27 satır · bookings:update

**Yol 14 — `bindeTermin()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:196](module/verordnung-termine.js#L196-L229) · 34 satır · bookings:update

**Yol 15 — `loeseTermin()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:232](module/verordnung-termine.js#L232-L240) · 9 satır · bookings:update

**Yol 16 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:198](module/warteliste-nachruecker.js#L198-L234) · 37 satır · bookings:insert

### `prescriptions` — 11 bağımsız yazma yolu

**Yol 1 — `kostentraegerIkZurueckschreiben()`** · Ekran: _UI yolu çözülemedi_
- `kostentraegerIkZurueckschreiben()` — [api-backend/billing/utils/kostentraeger-frisch.js:114](api-backend/billing/utils/kostentraeger-frisch.js#L114-L136) · 23 satır · prescriptions:update

**Yol 2 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · prescriptions:delete

**Yol 3 — `createDokumentMailRouter()`** · Ekran: _UI yolu çözülemedi_
- `createDokumentMailRouter()` — [api-backend/routes/dokument-mail.js:90](api-backend/routes/dokument-mail.js#L90-L348) · 259 satır · prescriptions:update

**Yol 4 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:5971](dashboard.js#L5971-L6043) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:7134](dashboard.js#L7134-L7169) · 36 satır · prescriptions:update

**Yol 5 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:6046](dashboard.js#L6046-L6114) · 69 satır · prescriptions:update

**Yol 6 — `triggerStorno()`** · Ekran: _UI yolu çözülemedi_
- `triggerStorno()` — [dashboard.js:15494](dashboard.js#L15494-L15554) · 61 satır · prescriptions:update

**Yol 7 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [module/rechnung-dmrz.js:109](module/rechnung-dmrz.js#L109-L186) · 78 satır · prescriptions:update

**Yol 8 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:130](module/sitzungsfortschritt.js#L130-L177) · 48 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:133](module/sitzungsfortschritt.js#L133-L170) · 38 satır · prescriptions:update

**Yol 9 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:185](module/verordnung-einheiten.js#L185-L205) · 21 satır · prescriptions:update

**Yol 10 — `w()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `w()` — [module/verordnung-import.js:343](module/verordnung-import.js#L343-L995) · 653 satır · prescriptions:update
- `oeffneVerordnungImport()` — [module/verordnung-import.js:705](module/verordnung-import.js#L705-L994) · 290 satır · prescriptions:update
- `senden()` — [module/verordnung-import.js:908](module/verordnung-import.js#L908-L991) · 84 satır · prescriptions:update

**Yol 11 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:292](module/zuzahlung-befreiung.js#L292-L303) · 12 satır · prescriptions:update

### `leads` — 10 bağımsız yazma yolu

**Yol 1 — `leadAusAnfrage()`** · Ekran: _UI yolu çözülemedi_
- `leadAusAnfrage()` — [api-backend/booking/lead-aus-anfrage.js:50](api-backend/booking/lead-aus-anfrage.js#L50-L78) · 29 satır · leads:insert

**Yol 2 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · leads:delete, leads:update

**Yol 3 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:3481](dashboard.js#L3481-L3627) · 147 satır · leads:update

**Yol 4 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:6240](dashboard.js#L6240-L6327) · 88 satır · leads:update

**Yol 5 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:16043](dashboard.js#L16043-L16164) · 122 satır · leads:insert

**Yol 6 — `oeffnePatientenImport()`** · Ekran: _UI yolu çözülemedi_
- `oeffnePatientenImport()` — [module/patienten-import.js:451](module/patienten-import.js#L451-L649) · 199 satır · leads:insert, leads:delete
- `importiere()` — [module/patienten-import.js:599](module/patienten-import.js#L599-L618) · 20 satır · leads:insert
- `schritt3()` — [module/patienten-import.js:620](module/patienten-import.js#L620-L646) · 27 satır · leads:delete

**Yol 7 — `montiereVorgeschichte()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `montiereVorgeschichte()` — [module/podo-vorgeschichte-form.js:79](module/podo-vorgeschichte-form.js#L79-L115) · 37 satır · leads:update

**Yol 8 — `$()`** · Ekran: _UI yolu çözülemedi_
- `$()` — [module/podo-vorgeschichte-form.js:88](module/podo-vorgeschichte-form.js#L88-L116) · 29 satır · leads:update

**Yol 9 — `verordnungPatientenAbgleich()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `verordnungPatientenAbgleich()` — [module/verordnung-patient-abgleich.js:19](module/verordnung-patient-abgleich.js#L19-L98) · 80 satır · leads:update

**Yol 10 — `beantworteAltbestand()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `beantworteAltbestand()` — [module/verordnung-podo.js:923](module/verordnung-podo.js#L923-L936) · 14 satır · leads:update

### `document_vorlagen` — 7 bağımsız yazma yolu

**Yol 1 — `openVorlagenAnsicht()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `openVorlagenAnsicht()` — [dashboard.js:11099](dashboard.js#L11099-L11170) · 72 satır · document_vorlagen:update
- `_enterAnsichtEditMode()` — [dashboard.js:11189](dashboard.js#L11189-L11253) · 65 satır · document_vorlagen:update

**Yol 2 — `saveVorlage()`** · Ekran: _UI yolu çözülemedi_
- `saveVorlage()` — [dashboard.js:11359](dashboard.js#L11359-L11387) · 29 satır · document_vorlagen:update, document_vorlagen:insert

**Yol 3 — `deleteVorlage()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `deleteVorlage()` — [dashboard.js:11389](dashboard.js#L11389-L11396) · 8 satır · document_vorlagen:delete

**Yol 4 — `duplicateVorlage()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `duplicateVorlage()` — [dashboard.js:11398](dashboard.js#L11398-L11412) · 15 satır · document_vorlagen:insert

**Yol 5 — `startVorlagenInlineRename()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `startVorlagenInlineRename()` — [dashboard.js:11414](dashboard.js#L11414-L11443) · 30 satır · document_vorlagen:update
- `commit()` — [dashboard.js:11421](dashboard.js#L11421-L11434) · 14 satır · document_vorlagen:update

**Yol 6 — `seedDefaultVorlagen()`** · Ekran: _UI yolu çözülemedi_
- `seedDefaultVorlagen()` — [dashboard.js:11445](dashboard.js#L11445-L11449) · 5 satır · document_vorlagen:insert

**Yol 7 — `seedeVorlagen()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `seedeVorlagen()` — [module/vorlagen-seed.js:25](module/vorlagen-seed.js#L25-L35) · 11 satır · document_vorlagen:insert

### `prescription_sessions` — 7 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:2902](dashboard.js#L2902-L2997) · 96 satır · prescription_sessions:update

**Yol 2 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:6116](dashboard.js#L6116-L6133) · 18 satır · prescription_sessions:update
- `bucheErgaenzendMit()` — [module/ergaenzend-mitbuchen.js:23](module/ergaenzend-mitbuchen.js#L23-L37) · 15 satır · prescription_sessions:update

**Yol 3 — `linkBookingsToPrescriptionSessions()`** · Ekran: _UI yolu çözülemedi_
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:6148](dashboard.js#L6148-L6238) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:129](module/sitzung-abgleich.js#L129-L214) · 86 satır · prescription_sessions:upsert

**Yol 4 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:94](module/booking-status-korrektur.js#L94-L151) · 58 satır · prescription_sessions:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · prescription_sessions:update
- `rebindeNoShowSitzungen()` — [module/termin-nicht-erschienen.js:283](module/termin-nicht-erschienen.js#L283-L319) · 37 satır · prescription_sessions:update

**Yol 5 — `bindeSitzungenAnTermin()`** · Ekran: _UI yolu çözülemedi_
- `bindeSitzungenAnTermin()` — [module/sitzung-bindung.js:50](module/sitzung-bindung.js#L50-L212) · 163 satır · prescription_sessions:update

**Yol 6 — `_verdrahteSitzungsHeilmittelTausch()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `_verdrahteSitzungsHeilmittelTausch()` — [module/verordnung-detail.js:1112](module/verordnung-detail.js#L1112-L1182) · 71 satır · prescription_sessions:update

**Yol 7 — `schreibeVerordnung()`** · Ekran: _UI yolu çözülemedi_
- `schreibeVerordnung()` — [module/verordnung-maske.js:878](module/verordnung-maske.js#L878-L958) · 81 satır · prescription_sessions:update

### `businesses` — 6 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · businesses:update

**Yol 2 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:8653](dashboard.js#L8653-L8673) · 21 satır · businesses:update

**Yol 3 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:13912](dashboard.js#L13912-L13993) · 82 satır · businesses:update, businesses:insert

**Yol 4 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:13995](dashboard.js#L13995-L14012) · 18 satır · businesses:delete

**Yol 5 — `mountPraxisStandort()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `mountPraxisStandort()` — [module/praxis-standort.js:93](module/praxis-standort.js#L93-L171) · 79 satır · businesses:update
- `setzen()` — [module/praxis-standort.js:143](module/praxis-standort.js#L143-L167) · 25 satır · businesses:update

**Yol 6 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `services` — 6 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:6337](dashboard.js#L6337-L6376) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:7963](dashboard.js#L7963-L7990) · 28 satır · services:insert
- `normName()` — [onboarding.js:606](onboarding.js#L606-L735) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:625](onboarding.js#L625-L735) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:8150](dashboard.js#L8150-L8185) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `renderServices()` — [dashboard.js:8339](dashboard.js#L8339-L8363) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:13912](dashboard.js#L13912-L13993) · 82 satır · services:insert

**Yol 6 — `migrierePhysioAltlast()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `migrierePhysioAltlast()` — [module/physio-katalog-migration.js:85](module/physio-katalog-migration.js#L85-L92) · 8 satır · services:update

### `employee_business_assignments` — 4 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · employee_business_assignments:delete

**Yol 2 — `renderOtherStandortEmps()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `renderOtherStandortEmps()` — [dashboard.js:9257](dashboard.js#L9257-L9342) · 86 satır · employee_business_assignments:upsert

**Yol 3 — `renderEmpStandortList()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `renderEmpStandortList()` — [dashboard.js:9404](dashboard.js#L9404-L9469) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete

**Yol 4 — `saveEmpPermissions()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `saveEmpPermissions()` — [dashboard.js:9505](dashboard.js#L9505-L9556) · 52 satır · employee_business_assignments:upsert

### `patient_consents` — 4 bağımsız yazma yolu

**Yol 1 — `createFormularSignierenRouter()`** · Ekran: _UI yolu çözülemedi_
- `createFormularSignierenRouter()` — [api-backend/routes/formular-signieren.js:125](api-backend/routes/formular-signieren.js#L125-L362) · 238 satır · patient_consents:insert

**Yol 2 — `noopMiddleware()`** · Ekran: _UI yolu çözülemedi_
- `noopMiddleware()` — [api-backend/routes/formular-signieren.js:129](api-backend/routes/formular-signieren.js#L129-L363) · 235 satır · patient_consents:insert

**Yol 3 — `speichereEinwilligung()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:352](module/patienten-einwilligung.js#L352-L390) · 39 satır · patient_consents:insert

**Yol 4 — `widerrufen()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `widerrufen()` — [module/patienten-einwilligung.js:599](module/patienten-einwilligung.js#L599-L617) · 19 satır · patient_consents:update

### `abrechnung` — 3 bağımsız yazma yolu

**Yol 1 — `createZuzahlungsforderungRouter()`** · Ekran: _UI yolu çözülemedi_
- `aktualisiereArtefaktVersion()` — [api-backend/billing/api/artefakt-version.js:142](api-backend/billing/api/artefakt-version.js#L142-L237) · 96 satır · abrechnung:update
- `createZuzahlungsforderungRouter()` — [api-backend/billing/api/zuzahlungsforderung.routes.js:131](api-backend/billing/api/zuzahlungsforderung.routes.js#L131-L1573) · 1443 satır · abrechnung:update, abrechnung:insert

**Yol 2 — `verworfeneNummerFesthalten()`** · Ekran: _UI yolu çözülemedi_
- `verworfeneNummerFesthalten()` — [api-backend/billing/api/verworfen.js:126](api-backend/billing/api/verworfen.js#L126-L178) · 53 satır · abrechnung:insert

**Yol 3 — `downloadAbrechnungFile()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `downloadAbrechnungFile()` — [module/abrechnung-detail.js:777](module/abrechnung-detail.js#L777-L800) · 24 satır · abrechnung:update

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:60](api-backend/lib/arzt-registry.js#L60-L194) · 135 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:13158](dashboard.js#L13158-L13165) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:13167](dashboard.js#L13167-L13212) · 46 satır · aerzte:update

### `employee_services` — 3 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · employee_services:delete

**Yol 2 — `loadEmpServices()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `loadEmpServices()` — [dashboard.js:9941](dashboard.js#L9941-L10025) · 85 satır · employee_services:insert, employee_services:delete

**Yol 3 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:606](onboarding.js#L606-L735) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:625](onboarding.js#L625-L735) · 111 satır · employee_services:insert

### `mitarbeiter_anstellung` — 3 bağımsız yazma yolu

**Yol 1 — `austrittVermerken()`** · Ekran: _UI yolu çözülemedi_
- `austrittVermerken()` — [api-backend/routes/mitarbeiter-zugang.js:345](api-backend/routes/mitarbeiter-zugang.js#L345-L359) · 15 satır · mitarbeiter_anstellung:upsert

**Yol 2 — `speichereAnstellung()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `speichereAnstellung()` — [module/anstellung.js:254](module/anstellung.js#L254-L293) · 40 satır · mitarbeiter_anstellung:upsert

**Yol 3 — `mountEhemalige()`** · Ekran: _UI yolu çözülemedi_
- `mountEhemalige()` — [module/ehemalige-mitarbeiter.js:71](module/ehemalige-mitarbeiter.js#L71-L104) · 34 satır · mitarbeiter_anstellung:delete

### `patient_dokumente` — 3 bağımsız yazma yolu

**Yol 1 — `createFormularSignierenRouter()`** · Ekran: _UI yolu çözülemedi_
- `createFormularSignierenRouter()` — [api-backend/routes/formular-signieren.js:125](api-backend/routes/formular-signieren.js#L125-L362) · 238 satır · patient_dokumente:insert

**Yol 2 — `noopMiddleware()`** · Ekran: _UI yolu çözülemedi_
- `noopMiddleware()` — [api-backend/routes/formular-signieren.js:129](api-backend/routes/formular-signieren.js#L129-L363) · 235 satır · patient_dokumente:insert

**Yol 3 — `ladeDokumente()`** · Ekran: _UI yolu çözülemedi_
- `montiereHost()` — [module/patient-dokumente.js:189](module/patient-dokumente.js#L189-L327) · 139 satır · patient_dokumente:insert
- `ladeDokumente()` — [module/patient-dokumente.js:329](module/patient-dokumente.js#L329-L483) · 155 satır · patient_dokumente:update

### `praxis_mailversand` — 3 bağımsız yazma yolu

**Yol 1 — `speichereGmailMailversand()`** · Ekran: _UI yolu çözülemedi_
- `speichereGmailMailversand()` — [api-backend/lib/mail.js:152](api-backend/lib/mail.js#L152-L165) · 14 satır · praxis_mailversand:upsert

**Yol 2 — `meldeVerbindungsfehler()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `meldeVerbindungsfehler()` — [api-backend/lib/mail.js:249](api-backend/lib/mail.js#L249-L257) · 9 satır · praxis_mailversand:update

**Yol 3 — `createMailversandRouter()`** · Ekran: _UI yolu çözülemedi_
- `createMailversandRouter()` — [api-backend/routes/mailversand.js:135](api-backend/routes/mailversand.js#L135-L330) · 196 satır · praxis_mailversand:upsert, praxis_mailversand:update

### `rooms` — 3 bağımsız yazma yolu

**Yol 1 — `speichereRaum()`** · Ekran: _UI yolu çözülemedi_
- `speichereRaum()` — [module/raum-verwaltung.js:188](module/raum-verwaltung.js#L188-L264) · 77 satır · rooms:update, rooms:insert

**Yol 2 — `setzeRaumAktiv()`** · Ekran: _UI yolu çözülemedi_
- `setzeRaumAktiv()` — [module/raum-verwaltung.js:271](module/raum-verwaltung.js#L271-L286) · 16 satır · rooms:update

**Yol 3 — `loescheRaum()`** · Ekran: _UI yolu çözülemedi_
- `loescheRaum()` — [module/raum-verwaltung.js:293](module/raum-verwaltung.js#L293-L308) · 16 satır · rooms:delete

### `time_offs` — 3 bağımsız yazma yolu

**Yol 1 — `openEmpDetail()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `loadTeam()` — [dashboard.js:8976](dashboard.js#L8976-L9158) · 183 satır · time_offs:insert
- `openEmpDetail()` — [dashboard.js:9558](dashboard.js#L9558-L9755) · 198 satır · time_offs:insert

**Yol 2 — `deleteEmpTimeOff()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `deleteEmpTimeOff()` — [dashboard.js:9229](dashboard.js#L9229-L9243) · 15 satır · time_offs:delete

**Yol 3 — `mountEhemalige()`** · Ekran: _UI yolu çözülemedi_
- `mountEhemalige()` — [module/ehemalige-mitarbeiter.js:71](module/ehemalige-mitarbeiter.js#L71-L104) · 34 satır · time_offs:delete

### `anamnese` — 2 bağımsız yazma yolu

**Yol 1 — `speichereNeu()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `speichereNeu()` — [module/anamnese-daten.js:69](module/anamnese-daten.js#L69-L75) · 7 satır · anamnese:insert

**Yol 2 — `markiereGeprueft()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `markiereGeprueft()` — [module/anamnese-daten.js:88](module/anamnese-daten.js#L88-L95) · 8 satır · anamnese:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:8677](dashboard.js#L8677-L8750) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `loadEmpHours()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `loadEmpHours()` — [dashboard.js:9849](dashboard.js#L9849-L9939) · 91 satır · breaks:insert, breaks:delete

### `custom_days` — 2 bağımsız yazma yolu

**Yol 1 — `saveSpecialDays()`** · Ekran: _UI yolu çözülemedi_
- `saveSpecialDays()` — [dashboard.js:8873](dashboard.js#L8873-L8899) · 27 satır · custom_days:upsert

**Yol 2 — `feiertageKnopf()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `feiertageKnopf()` — [module/feiertage-knopf.js:39](module/feiertage-knopf.js#L39-L102) · 64 satır · custom_days:upsert

### `employee_scope_overrides` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · employee_scope_overrides:delete

**Yol 2 — `saveEmpPermissions()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `saveEmpPermissions()` — [dashboard.js:9505](dashboard.js#L9505-L9556) · 52 satır · employee_scope_overrides:delete, employee_scope_overrides:insert

### `employee_standort_plan` — 2 bağımsız yazma yolu

**Yol 1 — `standortplanAufraeumen()`** · Ekran: _UI yolu çözülemedi_
- `standortplanAufraeumen()` — [api-backend/routes/mitarbeiter-zugang.js:323](api-backend/routes/mitarbeiter-zugang.js#L323-L336) · 14 satır · employee_standort_plan:delete

**Yol 2 — `mountStandortPlan()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `mountStandortPlan()` — [module/standort-plan.js:313](module/standort-plan.js#L313-L449) · 137 satır · employee_standort_plan:insert, employee_standort_plan:update, employee_standort_plan:delete
- `speichern()` — [module/standort-plan.js:397](module/standort-plan.js#L397-L446) · 50 satır · employee_standort_plan:insert, employee_standort_plan:update, employee_standort_plan:delete

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:3145](dashboard.js#L3145-L3206) · 62 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:3267](dashboard.js#L3267-L3355) · 89 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:12769](dashboard.js#L12769-L12857) · 89 satır · invoices:update, invoices:insert

**Yol 2 — `frageZahlungsstatus()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:72](module/rechnung-zahlung.js#L72-L84) · 13 satır · invoices:update
- `frageZahlungsstatus()` — [module/rechnung-zahlung.js:159](module/rechnung-zahlung.js#L159-L230) · 72 satır · invoices:update

### `messreihen` — 2 bağımsız yazma yolu

**Yol 1 — `refreshMessreihen()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `refreshMessreihen()` — [dashboard.js:7279](dashboard.js#L7279-L7352) · 74 satır · messreihen:delete
- `saveMessung()` — [dashboard.js:7403](dashboard.js#L7403-L7440) · 38 satır · messreihen:insert

**Yol 2 — `renderFormular()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `renderFormular()` — [module/physio-befund.js:669](module/physio-befund.js#L669-L1005) · 337 satır · messreihen:insert
- `speichern()` — [module/physio-befund.js:906](module/physio-befund.js#L906-L1001) · 96 satır · messreihen:insert
- `zeigeWiederholenDialog()` — [module/physio-befund.js:1010](module/physio-befund.js#L1010-L1050) · 41 satır · messreihen:insert

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:279](admin.js#L279-L304) · 26 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:360](admin.js#L360-L375) · 16 satır · module_visibility:upsert

### `physio_befunde` — 2 bağımsız yazma yolu

**Yol 1 — `renderFormular()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `renderFormular()` — [module/physio-befund.js:669](module/physio-befund.js#L669-L1005) · 337 satır · physio_befunde:insert

**Yol 2 — `speichern()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `speichern()` — [module/physio-befund.js:906](module/physio-befund.js#L906-L1001) · 96 satır · physio_befunde:insert

### `podologie_behandlungen` — 2 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 38 modülden çağrılıyor
- `behandlungStornieren()` — [module/podo-storno.js:91](module/podo-storno.js#L91-L166) · 76 satır · podologie_behandlungen:update
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:501](module/podologie-abrechnung.js#L501-L1294) · 794 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:194](module/rechnung-bruecke.js#L194-L223) · 30 satır · podologie_behandlungen:update

### `prescription_documents` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:106](api-backend/dsgvo/loeschen.js#L106-L821) · 716 satır · prescription_documents:delete

**Yol 2 — `ladeLhbNachweisHoch()`** · Ekran: _UI yolu çözülemedi_
- `ladeLhbNachweisHoch()` — [module/verordnung-nachweis.js:109](module/verordnung-nachweis.js#L109-L145) · 37 satır · prescription_documents:insert

## Çift render adayları — aynı DOM id'ye HTML basan, birbirini çağırmayan fonksiyonlar

Tabloya yazmayan kopyaları yakalar (aynı ekranı iki yol çiziyor mu). Yaklaşık sinyal:
fonksiyon id'yi tutuyor ve gövdesinde bir yerde HTML basıyor. İnceleme kuyruğu, karar insanın.

- `#abDetailContent` — 2 yol: [`leere()`](module/abrechnung-detail.js#L177-L183) · [`zeigeAbrechnungDetail()`](module/abrechnung-detail.js#L185-L234)
- `#bkGroupParticipantsList` — 2 yol: [`loadGroupParticipants()`](dashboard.js#L3732-L3809) · [`renderLocalGroupParticipants()`](dashboard.js#L3811-L3845)
- `#zaaResult` — 2 yol: [`runZaaUpload()`](dashboard.js#L14752-L14799) · [`showZaaErrors()`](dashboard.js#L14809-L14828)

## En çok yazılan tablolar

- `profiles` — 33 ayrı fonksiyon yazıyor
- `bookings` — 20 ayrı fonksiyon yazıyor
- `prescriptions` — 15 ayrı fonksiyon yazıyor
- `leads` — 12 ayrı fonksiyon yazıyor
- `prescription_sessions` — 11 ayrı fonksiyon yazıyor
- `document_vorlagen` — 9 ayrı fonksiyon yazıyor
- `services` — 8 ayrı fonksiyon yazıyor
- `ops_todos` — 8 ayrı fonksiyon yazıyor
- `businesses` — 7 ayrı fonksiyon yazıyor
- `messreihen` — 5 ayrı fonksiyon yazıyor
- `praxis_aufgaben` — 5 ayrı fonksiyon yazıyor
- `abrechnung` — 4 ayrı fonksiyon yazıyor
- `employee_services` — 4 ayrı fonksiyon yazıyor
- `employee_business_assignments` — 4 ayrı fonksiyon yazıyor
- `patient_dokumente` — 4 ayrı fonksiyon yazıyor
- `patient_consents` — 4 ayrı fonksiyon yazıyor
- `time_offs` — 4 ayrı fonksiyon yazıyor
- `ops_finance_expenses` — 4 ayrı fonksiyon yazıyor
- `aerzte` — 3 ayrı fonksiyon yazıyor
- `praxis_mailversand` — 3 ayrı fonksiyon yazıyor

## Bilinçli aynalar — kod içinde beyan edilmiş (kopya DEĞiL)

Frontend/backend paylaşılan modül yolu yok; bu yüzden aynı kural iki dosyaya
yazılmış ve kod bunu kendi yorumunda söylemiş („Spiegel von“ / „Identisch mit“).
Bunları birleştirme — birleştirilecek olsaydı zaten tek dosya olurdu.

- `ausstellerSnapshot()` — [api-backend/lib/rechnung-snapshot.js:18](api-backend/lib/rechnung-snapshot.js#L18-L31) — Spiegel von module/branding
- `bgFehltFuerRechnung()` — [api-backend/lib/rezept-felder.js:326](api-backend/lib/rezept-felder.js#L326-L332) — Spiegel von `bgFehltFuerRechnung` in `module/bg-angaben
- `dgStamm()` — [api-backend/billing/api/verordnung-status.routes.js:102](api-backend/billing/api/verordnung-status.routes.js#L102-L106) — Spiegel von `dgWurzel()` in `module/verordnung-regeln
- `empfaengerSnapshot()` — [api-backend/lib/rechnung-snapshot.js:53](api-backend/lib/rechnung-snapshot.js#L53-L74) — Spiegel von module/bg-angaben
- `fehlendePflichtangaben()` — [api-backend/billing/api/abrechnung.routes.js:446](api-backend/billing/api/abrechnung.routes.js#L446-L452) — Spiegel von module/beleg-druck
- `fehlendePflichtangaben()` — [module/beleg-druck.js:57](module/beleg-druck.js#L57-L63) — Identisch mit `fehlendePflichtangaben()` im Backend — beim Ändern beide
- `istEchteUebersetzung()` — [api-backend/billing/zaa/anwenden.js:16](api-backend/billing/zaa/anwenden.js#L16-L19) — identisch mit dem Dateitext (z
- `kartenIkNormalisieren()` — [module/krankenkasse-suche.js:169](module/krankenkasse-suche.js#L169-L172) — Spiegel von `kartenIkNormalisieren()` in `api-backend/lib/rezept-felder
- `leitsymptomatikAlsBitmaske()` — [api-backend/billing/dta/leitsymptomatik.js:58](api-backend/billing/dta/leitsymptomatik.js#L58-L96) — Spiegel von `leitsymptomatikListe()` in `module/verordnung-pruefung
- `leitsymptomatikListe()` — [module/verordnung-pruefung.js:116](module/verordnung-pruefung.js#L116-L128) — Spiegel von `api-backend/billing/dta/leitsymptomatik
- `pruefTitel()` — [module/verordnung-uebersicht.js:514](module/verordnung-uebersicht.js#L514-L520) — Spiegel von `pruefTitel` in module/verordnung-liste
- `t()` — [api-backend/lib/rechnung-snapshot.js:14](api-backend/lib/rechnung-snapshot.js#L14-L31) — Spiegel von `module/branding
- `zuVieleBehandlungenJeTag()` — [module/podo-behandlungstag-regel.js:79](module/podo-behandlungstag-regel.js#L79-L94) — Spiegel von behandlungstageJeDatum/TAGESHOECHSTZAHL in api-backend/billing/utils/behandlungstage

## Aynı ada sahip birden fazla tanım

Bu bir kopya listesi değil, bir isim çakışması listesi — aynı isim farklı iş yapıyor olabilir.
`aynalar` doluysa o konum bilinçli ayna; boşsa isim çakışması başka bir şeydir, incele.

- `esc` — api-backend/billing/pdf/mahnung.template.js:4 · api-backend/lib/mail-signatur.js:3 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-artefakte.js:22 · module/abrechnung-auswahl.js:765 · module/abrechnung-detail.js:175 · module/abrechnung-freigabe.js:112 · module/anamnese.js:44 · module/arzt-register.js:127 · module/branding-ui.js:16 · module/datev-einstellungen.js:30 · module/einrichtung-ring.js:13 · module/krankenkasse-suche.js:642 · module/leistungs-raum.js:4 · module/mail-signatur-editor.js:3 · module/mail-signatur.js:3 · module/mitarbeiter-app-einstellungen.js:35 · module/patienten-einwilligung.js:61 · module/patienten-import.js:361 · module/patientenkarte.js:45 · module/podo-einheiten.js:380 · module/podo-vorgeschichte-form.js:17 · module/raum-tagesansicht.js:99 · module/rechnung-mail.js:19 · module/rechnung-zahlungseingang.js:225 · module/start-aufgaben.js:6 · module/termin-hinweise.js:37 · module/therapiebericht.js:30 · module/ueber.js:26 · module/verordnung-einheiten.js:56 · module/verordnung-feldmarker.js:80 · module/verordnung-uebersicht.js:115 · module/zuzahlung-befreiung.js:305 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:11 · api-backend/billing/pdf/begleitzettel.template.js:24 · api-backend/billing/pdf/rechnung.template.js:6 · api-backend/billing/pdf/rezeptvorderseite.template.js:6 · api-backend/billing/pdf/rzg-quittung.template.js:6 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:9 · dashboard.js:526 · module/abrechnung-status.js:187 · module/abrechnungsstatus.js:735 · module/anstellung.js:15 · module/ausfallrechnung.js:19 · module/behandlungsbestaetigung.js:37 · module/diagnosegruppen-regeln.js:32 · module/ehemalige-mitarbeiter.js:13 · module/fax-deckblatt.js:30 · module/formular-editor.js:172 · module/formular-unterschreiben.js:102 · module/fussbefund.js:204 · module/kalender-raster.js:24 · module/kalender-woche.js:43 · module/leistung-farbwahl.js:25 · module/leistungen-liste.js:28 · module/patient-dokumente.js:40 · module/patient-termine.js:1 · module/physio-befund.js:46 · module/raum-streifen.js:110 · module/raum-verwaltung.js:20 · module/rezeptinfo-geld.js:73 · module/sondertag-mitteilung.js:11 · module/sondertag.js:29 · module/standort-plan.js:31 · module/termin-aktionen.js:43 · module/termin-druck.js:27 · module/termin-panel.js:34 · module/warteliste-ansicht.js:26 · module/warteliste-nachruecker.js:49
- `$` — attendance.js:10 · module/anamnese.js:43 · module/branding-ui.js:31 · module/heilmittel-zeilen-ui.js:29 · module/kiosk.js:74 · module/podo-vorgeschichte-form.js:88 · module/rechnung-zahlungseingang.js:455 · module/ueber.js:52 · module/verordnung-einheiten.js:543 · module/verordnung-podo.js:84 · module/verordnung-pruefen-knopf.js:43 · module/zuzahlung-korrektur.js:206 · ops/app.js:48 · widget/booking-widget.js:24
- `fmt` — api-backend/setup/router.js:120 · dashboard.js:1135 · dashboard.js:7178 · dashboard.js:8939 · dashboard.js:9215 · dashboard.js:12298 · dashboard.js:16963 · dashboard.js:17049 · dashboard.js:17128 · dashboard.js:17160 · dashboard.js:17220 · module/kalender-raster.js:71 · module/rechnung-ansicht.js:222 · module/rezeptinfo-geld.js:71
- `schliessen` — cookie-consent.js:136 · module/abrechnung-freigabe.js:165 · module/abrechnungsstatus.js:596 · module/arzt-register.js:278 · module/formular-editor.js:427 · module/patienten-import.js:479 · module/rechnung-zahlungseingang.js:555 · module/verordnung-einheiten.js:300 · module/verordnung-einheiten.js:398 · module/verordnung-einheiten.js:591 · module/verordnung-feldmarker.js:240 · module/verordnung-import.js:730 · module/zuzahlung-befreiung.js:151 · module/zuzahlung-korrektur.js:209
- `render` — calendar-widget.js:127 · dashboard.js:11856 · dashboard.js:16779 · module/app-start.js:32 · module/ki-einstellungen.js:13 · module/mail-signatur-editor.js:41 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:116
- `handler` — api/admin/data.js:31 · api/admin/feedbacks.js:4 · api/apify/search.js:6 · api/config.js:2 · api/contact.js:28 · api/demo-booking.js:368 · api/onboarding/check-email.js:8 · api/onboarding/pending.js:9 · api/stripe/create-checkout-session.js:13 · api/stripe/portal-session.js:11 · api/stripe/webhook.js:87 · module/arztangaben-banner.js:104
- `g` — dashboard.js:13225 · dashboard.js:13238 · dashboard.js:13411 · module/heilmittel-zeilen-ui.js:262 · module/rezept-barcode-bestaetigung.js:4 · module/rezept-barcode-dialog.js:6 · module/rezept-in-maske.js:40 · module/rezept-patientenkopf.js:4 · module/verordnung-anlegen.js:32 · module/verordnung-maske.js:460 · module/verordnung-nachweis.js:28
- `r2` — api-backend/billing/api/abrechnung.routes.js:2544 · api-backend/billing/api/statistik.routes.js:176 · api-backend/billing/api/zuzahlung.routes.js:45 · api-backend/billing/dta/builder.js:63 · api-backend/billing/dta/preflight.js:804 · api-backend/billing/preise/resolver.js:43 · api-backend/billing/utils/abrechnung-zeilen.js:36 · api-backend/billing/zuzahlung/calculator.js:17 · api-backend/billing/zuzahlung/korrektur.js:16 · module/abrechnung-verlauf.js:128 · module/zuzahlung-rechnen.js:42
- `fmtDate` — api-backend/billing/dta/encoding.js:85 · api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:29 · api-backend/billing/pdf/mahnung.template.js:6 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:11 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:991 · ops/app.js:84
- `t` — api-backend/lib/rechnung-pdf.js:16 · api-backend/lib/rechnung-snapshot.js:14 · api-backend/lib/therapiebericht.js:40 · api-backend/server.js:4233 · dashboard.js:525 · module/anamnese.js:386 · module/bg-angaben.js:36 · module/branding.js:28 · module/kiosk.js:58 · module/termin-rechtstexte.js:20
  - ayna: api-backend/lib/rechnung-snapshot.js:14 — Spiegel von `module/branding
- `cleanup` — dashboard.js:5855 · dashboard.js:5942 · dashboard.js:17529 · merkez/test/dev-server.js:84 · module/absagegrund-modal.js:82 · module/bestaetigungs-dialog.js:20 · module/formular-editor.js:565 · module/formular-unterschreiben.js:201 · module/formular-unterschreiben.js:371
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:11 · api-backend/ai/tasks/b2b-draft.js:62 · api-backend/ai/tasks/b2c-draft.js:62 · api-backend/ai/tasks/rezept-normalize.js:109 · api-backend/ai/tasks/rezept-ocr.js:19 · api-backend/ai/tasks/rezept-validate.js:8 · api-backend/ai/tasks/series-scheduler.js:3 · api-backend/ai/tasks/transkribieren.js:11 · merkez/db.js:125
- `speichern` — cookie-consent.js:119 · module/arzt-register.js:294 · module/fax-einstellungen.js:112 · module/fussbefund.js:792 · module/mailversand.js:325 · module/physio-befund.js:906 · module/praxis-rechtslinks-einstellungen.js:102 · module/standort-plan.js:397 · module/verordnung-detail.js:959
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:28 · api-backend/billing/api/mahnwesen.routes.js:24 · api-backend/billing/api/podo-empfangsnachweis.routes.js:12 · api-backend/billing/api/rechnung-zahlung.routes.js:84 · api-backend/billing/api/statistik.routes.js:19 · api-backend/billing/api/verordnung-status.routes.js:47 · api-backend/billing/api/warteliste.routes.js:24 · api-backend/billing/api/zuzahlung.routes.js:47
- `zeichne` — module/abrechnung-auswahl.js:769 · module/abrechnungsstatus.js:609 · module/einrichtung-ring.js:44 · module/patienten-einwilligung.js:540 · module/patienten-import.js:394 · module/praxis-standort.js:115 · module/raum-auswahl.js:251 · module/rezeptinfo-geld.js:461
- `zeile` — api-backend/lib/therapiebericht.js:299 · module/branding-ui.js:39 · module/fax-deckblatt.js:62 · module/rechnung-druck.js:33 · module/verordnung-detail.js:293 · module/verordnung-detail.js:428 · module/verordnung-detail.js:496 · module/verordnung-pruefen-knopf.js:122
- `el` — module/arzt-register.js:253 · module/fussbefund.js:232 · module/mailversand.js:58 · module/patient-notizen.js:3 · module/termin-aktionsleiste.js:49 · module/termin-panel.js:39 · module/verordnung-maske.js:765
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:15 · api-backend/billing/pdf/begleitzettel.template.js:28 · api-backend/billing/pdf/mahnung.template.js:5 · api-backend/billing/pdf/rechnung.template.js:10 · api-backend/billing/pdf/rzg-quittung.template.js:10 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:13 · module/geld.js:48
- `init` — attendance.js:299 · booking-request.js:1420 · booking.js:64 · cookie-consent.js:205 · dashboard.js:14137 · onboarding.js:77 · setup.js:197
- `onEsc` — dashboard.js:5949 · module/rechnung-leistung-picker.js:46 · module/verordnung-einheiten.js:304 · module/verordnung-einheiten.js:402 · module/verordnung-einheiten.js:596 · module/zuzahlung-befreiung.js:156 · module/zuzahlung-korrektur.js:214
- `wert` — module/anfrage-bearbeiten.js:186 · module/fahrtenbuch-regeln.js:307 · module/hausbesuch-route.js:32 · module/mail-entwurf.js:41 · module/mailversand.js:323 · module/verordnung-pruefen-knopf.js:44 · setup.js:290
- `addDays` — api-backend/ai/validators/blankoRules.js:29 · api-backend/ai/validators/lhbBvbRules.js:24 · api-backend/ai/validators/standardRules.js:42 · api-backend/billing/api/mahnwesen.routes.js:47 · api-backend/billing/zuzahlung/zu-beleg.js:15 · api-backend/server.js:375
- `fehler` — api-backend/billing/api/artefakt-historie.js:26 · api-backend/billing/api/artefakt-registry.js:15 · api-backend/billing/api/physio-publikation-ablauf.js:17 · api-backend/billing/codes/physio-leistungszeilen.js:27 · api-backend/lib/gmail-senden.js:57 · module/therapiebericht.js:205
- `leer` — api-backend/billing/dta/auftragsdatei.js:53 · api-backend/lib/terminerinnerung-job.js:19 · module/fahrtenbuch-regeln.js:315 · module/fussbefund-archiv.js:199 · module/sitzungsplan.js:114 · module/verordnung-pruefung.js:101
- `load` — module/patient-notizen.js:19 · module/rezept-patientenkopf.js:23 · ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `log` — installieren/install.sh:19 · onprem/backup.sh:47 · onprem/deinstallieren.sh:37 · onprem/install.sh:68 · onprem/restore.sh:44 · onprem/update.sh:59
- `ok` — installieren/install.sh:20 · onprem/backup.sh:48 · onprem/deinstallieren.sh:38 · onprem/install.sh:69 · onprem/restore.sh:45 · onprem/update.sh:60
- `sha256Hex` — api-backend/billing/api/abrechnung.routes.js:100 · api-backend/billing/api/artefakt-registry.js:23 · api-backend/billing/api/zuzahlungsforderung.routes.js:39 · api-backend/billing/dta/zuzahlungsforderung-ursprung.js:73 · api-backend/merkez-istemci/signatur.js:22 · module/einwilligung-texte.js:428
- `zeigeFehler` — module/abrechnung-detail.js:576 · module/abrechnung-detail.js:618 · module/verordnung-einheiten.js:552 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:208 · widget/booking-widget.js:362
- `add` — api-backend/ai/pii-mask.js:121 · api-backend/billing/dta/output-validator.js:126 · api-backend/lib/verbindungen.js:29 · module/feiertage.js:48 · module/podo-vorgeschichte.js:30
- `feld` — module/abrechnung-auswahl.js:985 · module/datev-einstellungen.js:63 · module/fussbefund.js:307 · module/mailversand.js:286 · module/rezeptinfo-geld.js:385
- `main` — api-backend/check_diagnosegruppen_icd.js:94 · api-backend/merkez-istemci/kayit.js:195 · api-backend/preise_autoupdate.mjs:194 · api-backend/preise_pruefen.mjs:240 · api-backend/sync_heilmittel_katalog.js:151
- `markiere` — module/kalender-auswahl.js:39 · module/leistung-farbwahl.js:47 · module/planung-bruecke.js:134 · module/verordnung-liste.js:255 · widget/booking-widget.js:107
- `parseDate` — api-backend/ai/validators/blankoRules.js:23 · api-backend/ai/validators/lhbBvbRules.js:19 · api-backend/ai/validators/standardRules.js:35 · api-backend/billing/dta/builder.js:64 · api-backend/billing/dta/preflight.js:161
- `tick` — api-backend/dsgvo/fristen.js:97 · api-backend/lib/terminerinnerung-job.js:155 · api-backend/merkez-istemci/ip-abgleich.js:257 · api-backend/server.js:4032 · dashboard.js:12582
- `v` — dashboard.js:11590 · dashboard.js:11612 · dashboard.js:11632 · dashboard.js:13923 · module/heilmittel-zeilen-ui.js:263
- `warn` — onprem/backup.sh:49 · onprem/deinstallieren.sh:39 · onprem/install.sh:70 · onprem/restore.sh:46 · onprem/update.sh:61
- `zahl` — api-backend/lib/datev.js:280 · api-backend/lib/gps-checkin.js:11 · module/frequenz-pruefung.js:150 · module/rechnung-summen.js:11 · module/rezept-in-maske.js:223
- `abbrechen` — api-backend/billing/api/physio-publikation-ablauf.js:53 · module/langer-druck.js:45 · module/physio-befund.js:899 · module/rezept-barcode-scan.js:57

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

### `onprem/deinstallieren.sh`
- `log()` — Zeile 37 · calledBy: fail, main
- `ok()` — Zeile 38 · calledBy: main
- `warn()` — Zeile 39 · calledBy: main
- `fail()` — Zeile 40 · calledBy: main
- `frage()` — Zeile 49 · calledBy: main
- `env_get()` — Zeile 50 · calledBy: main
- `main()` — Zeile 54 · calledBy: onprem/deinstallieren.sh

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
- `b64url()` — Zeile 748 · calledBy: sign_jwt
- `sign_jwt()` — Zeile 749 · calledBy: onprem/install.sh
- `lokaler_name_pruefen()` — Zeile 803 · calledBy: lokale_ca_vorbereiten, onprem/install.sh
- `lokale_ca_vorbereiten()` — Zeile 823 · calledBy: onprem/install.sh

### `onprem/ip-melden.sh`
- sources: `lib-ip.sh`, `||`
- `le_konto_melden()` — Zeile 31 · calledBy: onprem/ip-melden.sh
- `zeit_melden()` — Zeile 59 · calledBy: onprem/ip-melden.sh

### `onprem/lib-health.sh`
- `warte_auf_gesundheit()` — Zeile 21 · calledBy: onprem/install.sh, onprem/update.sh
- `bereitschaft_einordnen()` — Zeile 83 · calledBy: bereitschaft_pruefen
- `bereitschaft_pruefen()` — Zeile 103 · calledBy: onprem/install.sh, onprem/update.sh

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
- `geri_yukle()` — Zeile 547 · calledBy: onprem/update.sh
- `anahtarlari_oku()` — Zeile 566 · calledBy: onprem/update.sh
- `deger_oku()` — Zeile 570 · calledBy: onprem/update.sh
