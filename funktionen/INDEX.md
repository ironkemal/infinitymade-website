# Funktionskarte

> Üretim: 2026-11-17 · `node tools/funktionskarte.mjs`
> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.

**4727 fonksiyon** (4605 JS · 95 bash · 27 ps1) · 581 dosya · 42 sidebar modülü

## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar

Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var
(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.

### `profiles` — 24 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · profiles:update

**Yol 2 — `createMailversandRouter()`** · Ekran: _UI yolu çözülemedi_
- `createMailversandRouter()` — [api-backend/routes/mailversand.js:160](api-backend/routes/mailversand.js#L160-L358) · 199 satır · profiles:update

**Yol 3 — `openStripePortal()`** · Ekran: _UI yolu çözülemedi_
- `openStripePortal()` — [dashboard.js:1713](dashboard.js#L1713-L1823) · 111 satır · profiles:update

**Yol 4 — `ensureClinicLocation()`** · Ekran: _UI yolu çözülemedi_
- `ensureClinicLocation()` — [dashboard.js:4596](dashboard.js#L4596-L4622) · 27 satır · profiles:update

**Yol 5 — `openEmpDetail()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `openEmpDetail()` — [dashboard.js:9553](dashboard.js#L9553-L9750) · 198 satır · profiles:update

**Yol 6 — `ensureCompanyCode()`** · Ekran: _UI yolu çözülemedi_
- `ensureCompanyCode()` — [dashboard.js:11653](dashboard.js#L11653-L11659) · 7 satır · profiles:update

**Yol 7 — `ensureBookingSlug()`** · Ekran: _UI yolu çözülemedi_
- `ensureBookingSlug()` — [dashboard.js:11670](dashboard.js#L11670-L11683) · 14 satır · profiles:update

**Yol 8 — `initAnfragenPanel()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `initAnfragenPanel()` — [dashboard.js:17853](dashboard.js#L17853-L17910) · 58 satır · profiles:update

**Yol 9 — `wireAbrechnungSettings()`** · Ekran: _UI yolu çözülemedi_
- `wireAbrechnungSettings()` — [module/abrechnung-einstellungen.js:271](module/abrechnung-einstellungen.js#L271-L428) · 158 satır · profiles:update
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
- `speichereKonten()` — [module/buchungskonten.js:323](module/buchungskonten.js#L323-L353) · 31 satır · profiles:update

**Yol 13 — `nur()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `nur()` — [module/datev-einstellungen.js:41](module/datev-einstellungen.js#L41-L156) · 116 satır · profiles:update
- `renderDatevSettings()` — [module/datev-einstellungen.js:58](module/datev-einstellungen.js#L58-L118) · 61 satır · profiles:update

**Yol 14 — `renderLegendeSettings()`** · Ekran: _UI yolu çözülemedi_
- `renderLegendeSettings()` — [module/fussbefund.js:1804](module/fussbefund.js#L1804-L1868) · 65 satır · profiles:update

**Yol 15 — `mountPraxisStandort()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `mountPraxisStandort()` — [module/praxis-standort.js:99](module/praxis-standort.js#L99-L179) · 81 satır · profiles:update
- `schalter()` — [module/praxis-standort.js:138](module/praxis-standort.js#L138-L149) · 12 satır · profiles:update
- `setzen()` — [module/praxis-standort.js:151](module/praxis-standort.js#L151-L175) · 25 satır · profiles:update

**Yol 16 — `speichereStufen()`** · Ekran: _UI yolu çözülemedi_
- `speichereStufen()` — [module/selbstzahler-stufen.js:287](module/selbstzahler-stufen.js#L287-L317) · 31 satır · profiles:update

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
- `cancelRequestBookings()` — [api-backend/booking/cancel-request.js:7](api-backend/booking/cancel-request.js#L7-L20) · 14 satır · bookings:update

**Yol 2 — `createBookingsFromRequestFactory()`** · Ekran: _UI yolu çözülemedi_
- `createBookingsFromRequestFactory()` — [api-backend/booking/from-request.js:25](api-backend/booking/from-request.js#L25-L158) · 134 satır · bookings:insert
- `mitAkte()` — [api-backend/booking/from-request.js:64](api-backend/booking/from-request.js#L64-L72) · 9 satır · bookings:insert
- `insertBooking()` — [api-backend/booking/from-request.js:65](api-backend/booking/from-request.js#L65-L72) · 8 satır · bookings:insert

**Yol 3 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · bookings:delete

**Yol 4 — `openBookingActionModal()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `openBookingActionModal()` — [dashboard.js:2400](dashboard.js#L2400-L2802) · 403 satır · bookings:update

**Yol 5 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:2897](dashboard.js#L2897-L2992) · 96 satır · bookings:insert

**Yol 6 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:3140](dashboard.js#L3140-L3201) · 62 satır · bookings:update

**Yol 7 — `markArrivedHandler()`** · Ekran: _UI yolu çözülemedi_
- `markArrivedHandler()` — [dashboard.js:3218](dashboard.js#L3218-L3232) · 15 satır · bookings:update

**Yol 8 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:3262](dashboard.js#L3262-L3350) · 89 satır · bookings:update

**Yol 9 — `handleTerminStarten()`** · Ekran: _UI yolu çözülemedi_
- `handleTerminStarten()` — [dashboard.js:3352](dashboard.js#L3352-L3430) · 79 satır · bookings:update

**Yol 10 — `initBkGroupPatientAutocomplete()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loadGroupParticipants()` — [dashboard.js:3727](dashboard.js#L3727-L3804) · 78 satır · bookings:update
- `initBkGroupPatientAutocomplete()` — [dashboard.js:3842](dashboard.js#L3842-L3964) · 123 satır · bookings:insert

**Yol 11 — `doMoveBooking()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `doMoveBooking()` — [dashboard.js:4297](dashboard.js#L4297-L4325) · 29 satır · bookings:update

**Yol 12 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:94](module/booking-status-korrektur.js#L94-L151) · 58 satır · bookings:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · bookings:update

**Yol 13 — `mountAktionspanel()`** · Ekran: _UI yolu çözülemedi_
- `mountAktionspanel()` — [module/raum-auswahl.js:338](module/raum-auswahl.js#L338-L364) · 27 satır · bookings:update

**Yol 14 — `bindeTermin()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `bindeTermin()` — [module/verordnung-termine.js:196](module/verordnung-termine.js#L196-L229) · 34 satır · bookings:update

**Yol 15 — `loeseTermin()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loeseTermin()` — [module/verordnung-termine.js:232](module/verordnung-termine.js#L232-L240) · 9 satır · bookings:update

**Yol 16 — `uebernimmSlot()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `uebernimmSlot()` — [module/warteliste-nachruecker.js:257](module/warteliste-nachruecker.js#L257-L295) · 39 satır · bookings:insert

### `prescriptions` — 11 bağımsız yazma yolu

**Yol 1 — `kostentraegerIkZurueckschreiben()`** · Ekran: _UI yolu çözülemedi_
- `kostentraegerIkZurueckschreiben()` — [api-backend/billing/utils/kostentraeger-frisch.js:154](api-backend/billing/utils/kostentraeger-frisch.js#L154-L177) · 24 satır · prescriptions:update

**Yol 2 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · prescriptions:delete

**Yol 3 — `createDokumentMailRouter()`** · Ekran: _UI yolu çözülemedi_
- `createDokumentMailRouter()` — [api-backend/routes/dokument-mail.js:125](api-backend/routes/dokument-mail.js#L125-L387) · 263 satır · prescriptions:update

**Yol 4 — `kassiereZuzahlung()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `kassiereZuzahlung()` — [dashboard.js:5966](dashboard.js#L5966-L6038) · 73 satır · prescriptions:update
- `flipAbrechnungStatus()` — [dashboard.js:7129](dashboard.js#L7129-L7164) · 36 satır · prescriptions:update

**Yol 5 — `storniereZuzahlung()`** · Ekran: _UI yolu çözülemedi_
- `storniereZuzahlung()` — [dashboard.js:6041](dashboard.js#L6041-L6109) · 69 satır · prescriptions:update

**Yol 6 — `triggerStorno()`** · Ekran: _UI yolu çözülemedi_
- `triggerStorno()` — [dashboard.js:15489](dashboard.js#L15489-L15549) · 61 satır · prescriptions:update

**Yol 7 — `downloadDmrzForInvoice()`** · Ekran: _UI yolu çözülemedi_
- `downloadDmrzForInvoice()` — [module/rechnung-dmrz.js:109](module/rechnung-dmrz.js#L109-L186) · 78 satır · prescriptions:update

**Yol 8 — `pruefeVerordnungsfortschritt()`** · Ekran: _UI yolu çözülemedi_
- `pruefeVerordnungsfortschritt()` — [module/sitzungsfortschritt.js:130](module/sitzungsfortschritt.js#L130-L177) · 48 satır · prescriptions:update
- `zaehler()` — [module/sitzungsfortschritt.js:133](module/sitzungsfortschritt.js#L133-L170) · 38 satır · prescriptions:update

**Yol 9 — `speichereEinheiten()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `speichereEinheiten()` — [module/verordnung-einheiten.js:185](module/verordnung-einheiten.js#L185-L205) · 21 satır · prescriptions:update

**Yol 10 — `w()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `w()` — [module/verordnung-import.js:338](module/verordnung-import.js#L338-L990) · 653 satır · prescriptions:update
- `oeffneVerordnungImport()` — [module/verordnung-import.js:700](module/verordnung-import.js#L700-L989) · 290 satır · prescriptions:update
- `senden()` — [module/verordnung-import.js:903](module/verordnung-import.js#L903-L986) · 84 satır · prescriptions:update

**Yol 11 — `betragNullsetzen()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `betragNullsetzen()` — [module/zuzahlung-befreiung.js:292](module/zuzahlung-befreiung.js#L292-L303) · 12 satır · prescriptions:update

### `leads` — 10 bağımsız yazma yolu

**Yol 1 — `leadAusAnfrage()`** · Ekran: _UI yolu çözülemedi_
- `leadAusAnfrage()` — [api-backend/booking/lead-aus-anfrage.js:57](api-backend/booking/lead-aus-anfrage.js#L57-L85) · 29 satır · leads:insert

**Yol 2 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · leads:delete, leads:update

**Yol 3 — `handleDirectAusfallrechnung()`** · Ekran: _UI yolu çözülemedi_
- `handleDirectAusfallrechnung()` — [dashboard.js:3476](dashboard.js#L3476-L3622) · 147 satır · leads:update

**Yol 4 — `maybeOfferAppointmentConfirmEmail()`** · Ekran: _UI yolu çözülemedi_
- `maybeOfferAppointmentConfirmEmail()` — [dashboard.js:6235](dashboard.js#L6235-L6322) · 88 satır · leads:update

**Yol 5 — `initSchnellerfassung()`** · Ekran: _UI yolu çözülemedi_
- `initSchnellerfassung()` — [dashboard.js:16038](dashboard.js#L16038-L16159) · 122 satır · leads:insert

**Yol 6 — `oeffnePatientenImport()`** · Ekran: _UI yolu çözülemedi_
- `oeffnePatientenImport()` — [module/patienten-import.js:451](module/patienten-import.js#L451-L649) · 199 satır · leads:insert, leads:delete
- `importiere()` — [module/patienten-import.js:599](module/patienten-import.js#L599-L618) · 20 satır · leads:insert
- `schritt3()` — [module/patienten-import.js:620](module/patienten-import.js#L620-L646) · 27 satır · leads:delete

**Yol 7 — `montiereVorgeschichte()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `montiereVorgeschichte()` — [module/podo-vorgeschichte-form.js:79](module/podo-vorgeschichte-form.js#L79-L115) · 37 satır · leads:update

**Yol 8 — `$()`** · Ekran: _UI yolu çözülemedi_
- `$()` — [module/podo-vorgeschichte-form.js:88](module/podo-vorgeschichte-form.js#L88-L116) · 29 satır · leads:update

**Yol 9 — `verordnungPatientenAbgleich()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `verordnungPatientenAbgleich()` — [module/verordnung-patient-abgleich.js:19](module/verordnung-patient-abgleich.js#L19-L98) · 80 satır · leads:update

**Yol 10 — `beantworteAltbestand()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `beantworteAltbestand()` — [module/verordnung-podo.js:924](module/verordnung-podo.js#L924-L937) · 14 satır · leads:update

### `document_vorlagen` — 7 bağımsız yazma yolu

**Yol 1 — `openVorlagenAnsicht()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `openVorlagenAnsicht()` — [dashboard.js:11094](dashboard.js#L11094-L11165) · 72 satır · document_vorlagen:update
- `_enterAnsichtEditMode()` — [dashboard.js:11184](dashboard.js#L11184-L11248) · 65 satır · document_vorlagen:update

**Yol 2 — `saveVorlage()`** · Ekran: _UI yolu çözülemedi_
- `saveVorlage()` — [dashboard.js:11354](dashboard.js#L11354-L11382) · 29 satır · document_vorlagen:update, document_vorlagen:insert

**Yol 3 — `deleteVorlage()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `deleteVorlage()` — [dashboard.js:11384](dashboard.js#L11384-L11391) · 8 satır · document_vorlagen:delete

**Yol 4 — `duplicateVorlage()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `duplicateVorlage()` — [dashboard.js:11393](dashboard.js#L11393-L11407) · 15 satır · document_vorlagen:insert

**Yol 5 — `startVorlagenInlineRename()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `startVorlagenInlineRename()` — [dashboard.js:11409](dashboard.js#L11409-L11438) · 30 satır · document_vorlagen:update
- `commit()` — [dashboard.js:11416](dashboard.js#L11416-L11429) · 14 satır · document_vorlagen:update

**Yol 6 — `seedDefaultVorlagen()`** · Ekran: _UI yolu çözülemedi_
- `seedDefaultVorlagen()` — [dashboard.js:11440](dashboard.js#L11440-L11444) · 5 satır · document_vorlagen:insert

**Yol 7 — `seedeVorlagen()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `seedeVorlagen()` — [module/vorlagen-seed.js:37](module/vorlagen-seed.js#L37-L47) · 11 satır · document_vorlagen:insert

### `prescription_sessions` — 7 bağımsız yazma yolu

**Yol 1 — `handleSessionDrop()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `handleSessionDrop()` — [dashboard.js:2897](dashboard.js#L2897-L2992) · 96 satır · prescription_sessions:update

**Yol 2 — `markPrescriptionSession()`** · Ekran: _UI yolu çözülemedi_
- `markPrescriptionSession()` — [dashboard.js:6111](dashboard.js#L6111-L6128) · 18 satır · prescription_sessions:update
- `bucheErgaenzendMit()` — [module/ergaenzend-mitbuchen.js:35](module/ergaenzend-mitbuchen.js#L35-L49) · 15 satır · prescription_sessions:update

**Yol 3 — `gleicheSitzungenAb()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `linkBookingsToPrescriptionSessions()` — [dashboard.js:6143](dashboard.js#L6143-L6233) · 91 satır · prescription_sessions:update, prescription_sessions:insert
- `gleicheSitzungenAb()` — [module/sitzung-abgleich.js:176](module/sitzung-abgleich.js#L176-L267) · 92 satır · prescription_sessions:upsert

**Yol 4 — `markiereNichtErschienen()`** · Ekran: _UI yolu çözülemedi_
- `korrigiereNoShow()` — [module/booking-status-korrektur.js:94](module/booking-status-korrektur.js#L94-L151) · 58 satır · prescription_sessions:update
- `markiereNichtErschienen()` — [module/termin-nicht-erschienen.js:105](module/termin-nicht-erschienen.js#L105-L198) · 94 satır · prescription_sessions:update
- `rebindeNoShowSitzungen()` — [module/termin-nicht-erschienen.js:283](module/termin-nicht-erschienen.js#L283-L319) · 37 satır · prescription_sessions:update

**Yol 5 — `bindeSitzungenAnTermin()`** · Ekran: _UI yolu çözülemedi_
- `bindeSitzungenAnTermin()` — [module/sitzung-bindung.js:50](module/sitzung-bindung.js#L50-L212) · 163 satır · prescription_sessions:update

**Yol 6 — `_verdrahteSitzungsHeilmittelTausch()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `_verdrahteSitzungsHeilmittelTausch()` — [module/verordnung-detail.js:1112](module/verordnung-detail.js#L1112-L1182) · 71 satır · prescription_sessions:update

**Yol 7 — `schreibeVerordnung()`** · Ekran: _UI yolu çözülemedi_
- `schreibeVerordnung()` — [module/verordnung-maske.js:878](module/verordnung-maske.js#L878-L958) · 81 satır · prescription_sessions:update

### `businesses` — 6 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · businesses:update

**Yol 2 — `toggleStandortDay()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `toggleStandortDay()` — [dashboard.js:8648](dashboard.js#L8648-L8668) · 21 satır · businesses:update

**Yol 3 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:13907](dashboard.js#L13907-L13988) · 82 satır · businesses:update, businesses:insert

**Yol 4 — `deleteBusiness()`** · Ekran: _UI yolu çözülemedi_
- `deleteBusiness()` — [dashboard.js:13990](dashboard.js#L13990-L14007) · 18 satır · businesses:delete

**Yol 5 — `mountPraxisStandort()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `mountPraxisStandort()` — [module/praxis-standort.js:99](module/praxis-standort.js#L99-L179) · 81 satır · businesses:update
- `setzen()` — [module/praxis-standort.js:151](module/praxis-standort.js#L151-L175) · 25 satır · businesses:update

**Yol 6 — `bindBusiness()`** · Ekran: _UI yolu çözülemedi_
- `bindBusiness()` — [onboarding.js:388](onboarding.js#L388-L450) · 63 satır · businesses:update, businesses:insert

### `services` — 6 bağımsız yazma yolu

**Yol 1 — `ensureBlankoBonusServices()`** · Ekran: _UI yolu çözülemedi_
- `ensureBlankoBonusServices()` — [dashboard.js:6332](dashboard.js#L6332-L6371) · 40 satır · services:update, services:insert

**Yol 2 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `autoSeedGkvServices()` — [dashboard.js:7958](dashboard.js#L7958-L7985) · 28 satır · services:insert
- `normName()` — [onboarding.js:606](onboarding.js#L606-L735) · 130 satır · services:update, services:insert, services:delete
- `syncServices()` — [onboarding.js:625](onboarding.js#L625-L735) · 111 satır · services:update, services:insert, services:delete

**Yol 3 — `migratePodologieLegacyServices()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `migratePodologieLegacyServices()` — [dashboard.js:8145](dashboard.js#L8145-L8180) · 36 satır · services:update

**Yol 4 — `renderServices()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `renderServices()` — [dashboard.js:8334](dashboard.js#L8334-L8358) · 25 satır · services:delete

**Yol 5 — `wireBusinessModal()`** · Ekran: _UI yolu çözülemedi_
- `wireBusinessModal()` — [dashboard.js:13907](dashboard.js#L13907-L13988) · 82 satır · services:insert

**Yol 6 — `migrierePhysioAltlast()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `migrierePhysioAltlast()` — [module/physio-katalog-migration.js:99](module/physio-katalog-migration.js#L99-L107) · 9 satır · services:update

### `employee_business_assignments` — 4 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · employee_business_assignments:delete

**Yol 2 — `renderOtherStandortEmps()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `renderOtherStandortEmps()` — [dashboard.js:9252](dashboard.js#L9252-L9337) · 86 satır · employee_business_assignments:upsert

**Yol 3 — `renderEmpStandortList()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `renderEmpStandortList()` — [dashboard.js:9399](dashboard.js#L9399-L9464) · 66 satır · employee_business_assignments:upsert, employee_business_assignments:delete

**Yol 4 — `saveEmpPermissions()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `saveEmpPermissions()` — [dashboard.js:9500](dashboard.js#L9500-L9551) · 52 satır · employee_business_assignments:upsert

### `patient_consents` — 4 bağımsız yazma yolu

**Yol 1 — `createFormularSignierenRouter()`** · Ekran: _UI yolu çözülemedi_
- `createFormularSignierenRouter()` — [api-backend/routes/formular-signieren.js:124](api-backend/routes/formular-signieren.js#L124-L361) · 238 satır · patient_consents:insert

**Yol 2 — `noopMiddleware()`** · Ekran: _UI yolu çözülemedi_
- `noopMiddleware()` — [api-backend/routes/formular-signieren.js:128](api-backend/routes/formular-signieren.js#L128-L362) · 235 satır · patient_consents:insert

**Yol 3 — `speichereEinwilligung()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `speichereEinwilligung()` — [module/patienten-einwilligung.js:352](module/patienten-einwilligung.js#L352-L390) · 39 satır · patient_consents:insert

**Yol 4 — `widerrufen()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `widerrufen()` — [module/patienten-einwilligung.js:599](module/patienten-einwilligung.js#L599-L617) · 19 satır · patient_consents:update

### `abrechnung` — 3 bağımsız yazma yolu

**Yol 1 — `createZuzahlungsforderungRouter()`** · Ekran: _UI yolu çözülemedi_
- `aktualisiereArtefaktVersion()` — [api-backend/billing/api/artefakt-version.js:150](api-backend/billing/api/artefakt-version.js#L150-L246) · 97 satır · abrechnung:update
- `createZuzahlungsforderungRouter()` — [api-backend/billing/api/zuzahlungsforderung.routes.js:131](api-backend/billing/api/zuzahlungsforderung.routes.js#L131-L1573) · 1443 satır · abrechnung:update, abrechnung:insert

**Yol 2 — `verworfeneNummerFesthalten()`** · Ekran: _UI yolu çözülemedi_
- `verworfeneNummerFesthalten()` — [api-backend/billing/api/verworfen.js:127](api-backend/billing/api/verworfen.js#L127-L179) · 53 satır · abrechnung:insert

**Yol 3 — `downloadAbrechnungFile()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `downloadAbrechnungFile()` — [module/abrechnung-detail.js:777](module/abrechnung-detail.js#L777-L800) · 24 satır · abrechnung:update

### `aerzte` — 3 bağımsız yazma yolu

**Yol 1 — `resolveOrCreateArzt()`** · Ekran: _UI yolu çözülemedi_
- `resolveOrCreateArzt()` — [api-backend/lib/arzt-registry.js:84](api-backend/lib/arzt-registry.js#L84-L224) · 141 satır · aerzte:update, aerzte:insert

**Yol 2 — `deleteAerzte()`** · Ekran: _UI yolu çözülemedi_
- `deleteAerzte()` — [dashboard.js:13153](dashboard.js#L13153-L13160) · 8 satır · aerzte:delete

**Yol 3 — `editAerzte()`** · Ekran: _UI yolu çözülemedi_
- `editAerzte()` — [dashboard.js:13162](dashboard.js#L13162-L13207) · 46 satır · aerzte:update

### `employee_services` — 3 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · employee_services:delete

**Yol 2 — `loadEmpServices()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loadEmpServices()` — [dashboard.js:9936](dashboard.js#L9936-L10020) · 85 satır · employee_services:insert, employee_services:delete

**Yol 3 — `normName()`** · Ekran: _UI yolu çözülemedi_
- `normName()` — [onboarding.js:606](onboarding.js#L606-L735) · 130 satır · employee_services:insert
- `syncServices()` — [onboarding.js:625](onboarding.js#L625-L735) · 111 satır · employee_services:insert

### `mitarbeiter_anstellung` — 3 bağımsız yazma yolu

**Yol 1 — `austrittVermerken()`** · Ekran: _UI yolu çözülemedi_
- `austrittVermerken()` — [api-backend/routes/mitarbeiter-zugang.js:352](api-backend/routes/mitarbeiter-zugang.js#L352-L366) · 15 satır · mitarbeiter_anstellung:upsert

**Yol 2 — `speichereAnstellung()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `speichereAnstellung()` — [module/anstellung.js:258](module/anstellung.js#L258-L297) · 40 satır · mitarbeiter_anstellung:upsert

**Yol 3 — `mountEhemalige()`** · Ekran: _UI yolu çözülemedi_
- `mountEhemalige()` — [module/ehemalige-mitarbeiter.js:87](module/ehemalige-mitarbeiter.js#L87-L123) · 37 satır · mitarbeiter_anstellung:delete

### `patient_dokumente` — 3 bağımsız yazma yolu

**Yol 1 — `createFormularSignierenRouter()`** · Ekran: _UI yolu çözülemedi_
- `createFormularSignierenRouter()` — [api-backend/routes/formular-signieren.js:124](api-backend/routes/formular-signieren.js#L124-L361) · 238 satır · patient_dokumente:insert

**Yol 2 — `noopMiddleware()`** · Ekran: _UI yolu çözülemedi_
- `noopMiddleware()` — [api-backend/routes/formular-signieren.js:128](api-backend/routes/formular-signieren.js#L128-L362) · 235 satır · patient_dokumente:insert

**Yol 3 — `ladeDokumente()`** · Ekran: _UI yolu çözülemedi_
- `montiereHost()` — [module/patient-dokumente.js:189](module/patient-dokumente.js#L189-L327) · 139 satır · patient_dokumente:insert
- `ladeDokumente()` — [module/patient-dokumente.js:329](module/patient-dokumente.js#L329-L483) · 155 satır · patient_dokumente:update

### `praxis_mailversand` — 3 bağımsız yazma yolu

**Yol 1 — `speichereGmailMailversand()`** · Ekran: _UI yolu çözülemedi_
- `speichereGmailMailversand()` — [api-backend/lib/mail.js:190](api-backend/lib/mail.js#L190-L203) · 14 satır · praxis_mailversand:upsert

**Yol 2 — `meldeVerbindungsfehler()`** · Ekran: _UI yolu çözülemedi_
- `meldeVerbindungsfehler()` — [api-backend/lib/mail.js:341](api-backend/lib/mail.js#L341-L349) · 9 satır · praxis_mailversand:update

**Yol 3 — `createMailversandRouter()`** · Ekran: _UI yolu çözülemedi_
- `createMailversandRouter()` — [api-backend/routes/mailversand.js:160](api-backend/routes/mailversand.js#L160-L358) · 199 satır · praxis_mailversand:upsert, praxis_mailversand:update

### `rooms` — 3 bağımsız yazma yolu

**Yol 1 — `speichereRaum()`** · Ekran: _UI yolu çözülemedi_
- `speichereRaum()` — [module/raum-verwaltung.js:188](module/raum-verwaltung.js#L188-L264) · 77 satır · rooms:update, rooms:insert

**Yol 2 — `setzeRaumAktiv()`** · Ekran: _UI yolu çözülemedi_
- `setzeRaumAktiv()` — [module/raum-verwaltung.js:271](module/raum-verwaltung.js#L271-L286) · 16 satır · rooms:update

**Yol 3 — `loescheRaum()`** · Ekran: _UI yolu çözülemedi_
- `loescheRaum()` — [module/raum-verwaltung.js:293](module/raum-verwaltung.js#L293-L308) · 16 satır · rooms:delete

### `time_offs` — 3 bağımsız yazma yolu

**Yol 1 — `openEmpDetail()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loadTeam()` — [dashboard.js:8971](dashboard.js#L8971-L9153) · 183 satır · time_offs:insert
- `openEmpDetail()` — [dashboard.js:9553](dashboard.js#L9553-L9750) · 198 satır · time_offs:insert

**Yol 2 — `deleteEmpTimeOff()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `deleteEmpTimeOff()` — [dashboard.js:9224](dashboard.js#L9224-L9238) · 15 satır · time_offs:delete

**Yol 3 — `mountEhemalige()`** · Ekran: _UI yolu çözülemedi_
- `mountEhemalige()` — [module/ehemalige-mitarbeiter.js:87](module/ehemalige-mitarbeiter.js#L87-L123) · 37 satır · time_offs:delete

### `anamnese` — 2 bağımsız yazma yolu

**Yol 1 — `speichereNeu()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `speichereNeu()` — [module/anamnese-daten.js:69](module/anamnese-daten.js#L69-L75) · 7 satır · anamnese:insert

**Yol 2 — `markiereGeprueft()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `markiereGeprueft()` — [module/anamnese-daten.js:88](module/anamnese-daten.js#L88-L95) · 8 satır · anamnese:update

### `breaks` — 2 bağımsız yazma yolu

**Yol 1 — `renderHoursGrid()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `renderHoursGrid()` — [dashboard.js:8672](dashboard.js#L8672-L8745) · 74 satır · breaks:insert, breaks:delete

**Yol 2 — `loadEmpHours()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `loadEmpHours()` — [dashboard.js:9844](dashboard.js#L9844-L9934) · 91 satır · breaks:insert, breaks:delete

### `custom_days` — 2 bağımsız yazma yolu

**Yol 1 — `saveSpecialDays()`** · Ekran: _UI yolu çözülemedi_
- `saveSpecialDays()` — [dashboard.js:8868](dashboard.js#L8868-L8894) · 27 satır · custom_days:upsert

**Yol 2 — `feiertageKnopf()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `feiertageKnopf()` — [module/feiertage-knopf.js:39](module/feiertage-knopf.js#L39-L102) · 64 satır · custom_days:upsert

### `employee_scope_overrides` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · employee_scope_overrides:delete

**Yol 2 — `saveEmpPermissions()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `saveEmpPermissions()` — [dashboard.js:9500](dashboard.js#L9500-L9551) · 52 satır · employee_scope_overrides:delete, employee_scope_overrides:insert

### `employee_standort_plan` — 2 bağımsız yazma yolu

**Yol 1 — `standortplanAufraeumen()`** · Ekran: _UI yolu çözülemedi_
- `standortplanAufraeumen()` — [api-backend/routes/mitarbeiter-zugang.js:328](api-backend/routes/mitarbeiter-zugang.js#L328-L341) · 14 satır · employee_standort_plan:delete

**Yol 2 — `mountStandortPlan()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `mountStandortPlan()` — [module/standort-plan.js:511](module/standort-plan.js#L511-L658) · 148 satır · employee_standort_plan:insert, employee_standort_plan:update, employee_standort_plan:delete
- `speichern()` — [module/standort-plan.js:606](module/standort-plan.js#L606-L655) · 50 satır · employee_standort_plan:insert, employee_standort_plan:update, employee_standort_plan:delete

### `fahrten` — 2 bağımsız yazma yolu

**Yol 1 — `saveFahrtStartHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtStartHandler()` — [dashboard.js:3140](dashboard.js#L3140-L3201) · 62 satır · fahrten:upsert

**Yol 2 — `saveFahrtEndHandler()`** · Ekran: _UI yolu çözülemedi_
- `saveFahrtEndHandler()` — [dashboard.js:3262](dashboard.js#L3262-L3350) · 89 satır · fahrten:upsert

### `invoices` — 2 bağımsız yazma yolu

**Yol 1 — `saveInvoice()`** · Ekran: _UI yolu çözülemedi_
- `saveInvoice()` — [dashboard.js:12764](dashboard.js#L12764-L12852) · 89 satır · invoices:update, invoices:insert

**Yol 2 — `frageZahlungsstatus()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `markiereRechnungBezahlt()` — [module/rechnung-zahlung.js:83](module/rechnung-zahlung.js#L83-L95) · 13 satır · invoices:update
- `frageZahlungsstatus()` — [module/rechnung-zahlung.js:172](module/rechnung-zahlung.js#L172-L243) · 72 satır · invoices:update

### `messreihen` — 2 bağımsız yazma yolu

**Yol 1 — `refreshMessreihen()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `refreshMessreihen()` — [dashboard.js:7274](dashboard.js#L7274-L7347) · 74 satır · messreihen:delete
- `saveMessung()` — [dashboard.js:7398](dashboard.js#L7398-L7435) · 38 satır · messreihen:insert

**Yol 2 — `renderFormular()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `renderFormular()` — [module/physio-befund.js:669](module/physio-befund.js#L669-L1005) · 337 satır · messreihen:insert
- `speichern()` — [module/physio-befund.js:906](module/physio-befund.js#L906-L1001) · 96 satır · messreihen:insert
- `zeigeWiederholenDialog()` — [module/physio-befund.js:1010](module/physio-befund.js#L1010-L1050) · 41 satır · messreihen:insert

### `module_visibility` — 2 bağımsız yazma yolu

**Yol 1 — `loadVisibility()`** · Ekran: _UI yolu çözülemedi_
- `loadVisibility()` — [admin.js:279](admin.js#L279-L304) · 26 satır · module_visibility:upsert

**Yol 2 — `saveVisToggle()`** · Ekran: _UI yolu çözülemedi_
- `saveVisToggle()` — [admin.js:360](admin.js#L360-L375) · 16 satır · module_visibility:upsert

### `physio_befunde` — 2 bağımsız yazma yolu

**Yol 1 — `renderFormular()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `renderFormular()` — [module/physio-befund.js:669](module/physio-befund.js#L669-L1005) · 337 satır · physio_befunde:insert

**Yol 2 — `speichern()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `speichern()` — [module/physio-befund.js:906](module/physio-befund.js#L906-L1001) · 96 satır · physio_befunde:insert

### `podologie_behandlungen` — 2 bağımsız yazma yolu

**Yol 1 — `loadPodologieBilling()`** · Ekran: ortak yardımcı — 37 modülden çağrılıyor
- `behandlungStornieren()` — [module/podo-storno.js:91](module/podo-storno.js#L91-L166) · 76 satır · podologie_behandlungen:update
- `loadPodologieBilling()` — [module/podologie-abrechnung.js:503](module/podologie-abrechnung.js#L503-L1296) · 794 satır · podologie_behandlungen:insert

**Yol 2 — `behandlungenVerknuepfen()`** · Ekran: _UI yolu çözülemedi_
- `behandlungenVerknuepfen()` — [module/rechnung-bruecke.js:194](module/rechnung-bruecke.js#L194-L223) · 30 satır · podologie_behandlungen:update

### `prescription_documents` — 2 bağımsız yazma yolu

**Yol 1 — `kontoLoeschenIntern()`** · Ekran: _UI yolu çözülemedi_
- `kontoLoeschenIntern()` — [api-backend/dsgvo/loeschen.js:112](api-backend/dsgvo/loeschen.js#L112-L839) · 728 satır · prescription_documents:delete

**Yol 2 — `ladeLhbNachweisHoch()`** · Ekran: _UI yolu çözülemedi_
- `ladeLhbNachweisHoch()` — [module/verordnung-nachweis.js:116](module/verordnung-nachweis.js#L116-L155) · 40 satır · prescription_documents:insert

## Çift render adayları — aynı DOM id'ye HTML basan, birbirini çağırmayan fonksiyonlar

Tabloya yazmayan kopyaları yakalar (aynı ekranı iki yol çiziyor mu). Yaklaşık sinyal:
fonksiyon id'yi tutuyor ve gövdesinde bir yerde HTML basıyor. İnceleme kuyruğu, karar insanın.

- `#abDetailContent` — 2 yol: [`leere()`](module/abrechnung-detail.js#L177-L183) · [`zeigeAbrechnungDetail()`](module/abrechnung-detail.js#L185-L234)
- `#bkGroupParticipantsList` — 2 yol: [`loadGroupParticipants()`](dashboard.js#L3727-L3804) · [`renderLocalGroupParticipants()`](dashboard.js#L3806-L3840)
- `#bkSlotsList` — 2 yol: [`loadBookingSlots()`](booking.js#L232-L303) · [`ersterFreierTagImMonat()`](booking.js#L409-L417)
- `#zaaResult` — 2 yol: [`runZaaUpload()`](dashboard.js#L14747-L14794) · [`showZaaErrors()`](dashboard.js#L14804-L14823)

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

- `ausstellerSnapshot()` — [api-backend/lib/rechnung-snapshot.js:42](api-backend/lib/rechnung-snapshot.js#L42-L55) — Spiegel von module/branding
- `bgFehltFuerRechnung()` — [api-backend/lib/rezept-felder.js:347](api-backend/lib/rezept-felder.js#L347-L353) — Spiegel von `bgFehltFuerRechnung` in `module/bg-angaben
- `dgStamm()` — [api-backend/billing/api/verordnung-status.routes.js:129](api-backend/billing/api/verordnung-status.routes.js#L129-L133) — Spiegel von `dgWurzel()` in `module/verordnung-regeln
- `empfaengerSnapshot()` — [api-backend/lib/rechnung-snapshot.js:86](api-backend/lib/rechnung-snapshot.js#L86-L107) — Spiegel von module/bg-angaben
- `fehlendePflichtangaben()` — [api-backend/billing/api/abrechnung.routes.js:446](api-backend/billing/api/abrechnung.routes.js#L446-L452) — Spiegel von module/beleg-druck
- `fehlendePflichtangaben()` — [module/beleg-druck.js:64](module/beleg-druck.js#L64-L70) — Identisch mit `fehlendePflichtangaben()` im Backend — beim Ändern beide
- `istEchteUebersetzung()` — [api-backend/billing/zaa/anwenden.js:17](api-backend/billing/zaa/anwenden.js#L17-L20) — identisch mit dem Dateitext (z
- `kartenIkNormalisieren()` — [module/krankenkasse-suche.js:169](module/krankenkasse-suche.js#L169-L172) — Spiegel von `kartenIkNormalisieren()` in `api-backend/lib/rezept-felder
- `leitsymptomatikAlsBitmaske()` — [api-backend/billing/dta/leitsymptomatik.js:59](api-backend/billing/dta/leitsymptomatik.js#L59-L97) — Spiegel von `leitsymptomatikListe()` in `module/verordnung-pruefung
- `leitsymptomatikListe()` — [module/verordnung-pruefung.js:116](module/verordnung-pruefung.js#L116-L128) — Spiegel von `api-backend/billing/dta/leitsymptomatik
- `pruefTitel()` — [module/verordnung-uebersicht.js:515](module/verordnung-uebersicht.js#L515-L521) — Spiegel von `pruefTitel` in module/verordnung-liste
- `zuVieleBehandlungenJeTag()` — [module/podo-behandlungstag-regel.js:84](module/podo-behandlungstag-regel.js#L84-L99) — Spiegel von behandlungstageJeDatum/TAGESHOECHSTZAHL in api-backend/billing/utils/behandlungstage

## Aynı ada sahip birden fazla tanım

Bu bir kopya listesi değil, bir isim çakışması listesi — aynı isim farklı iş yapıyor olabilir.
`aynalar` doluysa o konum bilinçli ayna; boşsa isim çakışması başka bir şeydir, incele.

- `esc` — api-backend/billing/pdf/mahnung.template.js:7 · api-backend/lib/mail-signatur.js:21 · arzt-suche.js:34 · katalog-suche.js:86 · katalog-suche.js:98 · module/abrechnung-artefakte.js:22 · module/abrechnung-auswahl.js:765 · module/abrechnung-detail.js:175 · module/abrechnung-freigabe.js:137 · module/anamnese.js:44 · module/arzt-register.js:127 · module/branding-ui.js:16 · module/datev-einstellungen.js:31 · module/einrichtung-ring.js:13 · module/krankenkasse-suche.js:642 · module/leistungs-raum.js:4 · module/mail-signatur-editor.js:3 · module/mail-signatur.js:21 · module/mitarbeiter-app-einstellungen.js:35 · module/patienten-einwilligung.js:61 · module/patienten-import.js:361 · module/patientenkarte.js:45 · module/podo-einheiten.js:380 · module/podo-vorgeschichte-form.js:17 · module/raum-tagesansicht.js:99 · module/rechnung-mail.js:19 · module/rechnung-zahlungseingang.js:225 · module/start-aufgaben.js:6 · module/startseite-ansicht.js:10 · module/startseite-geld.js:16 · module/termin-hinweise.js:44 · module/therapiebericht.js:30 · module/ueber.js:26 · module/verordnung-einheiten.js:56 · module/verordnung-feldmarker.js:80 · module/verordnung-uebersicht.js:116 · module/zuzahlung-befreiung.js:305 · module/zuzahlung-korrektur.js:60 · ops/app.js:51
- `escapeHtml` — admin.js:61 · api-backend/billing/pdf/ausfallrechnung.template.js:16 · api-backend/billing/pdf/begleitzettel.template.js:29 · api-backend/billing/pdf/rechnung.template.js:11 · api-backend/billing/pdf/rezeptvorderseite.template.js:12 · api-backend/billing/pdf/rzg-quittung.template.js:9 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:14 · dashboard.js:526 · module/abrechnung-status.js:195 · module/abrechnungsstatus.js:742 · module/anstellung.js:15 · module/ausfallrechnung.js:19 · module/behandlungsbestaetigung.js:37 · module/diagnosegruppen-regeln.js:32 · module/ehemalige-mitarbeiter.js:13 · module/fax-deckblatt.js:30 · module/formular-editor.js:172 · module/formular-unterschreiben.js:102 · module/fussbefund.js:204 · module/kalender-raster.js:29 · module/kalender-woche.js:43 · module/leistung-farbwahl.js:30 · module/leistungen-liste.js:28 · module/patient-dokumente.js:40 · module/patient-termine.js:2 · module/physio-befund.js:46 · module/raum-streifen.js:110 · module/raum-verwaltung.js:20 · module/rezeptinfo-geld.js:73 · module/sondertag-mitteilung.js:11 · module/sondertag.js:29 · module/standort-plan.js:93 · module/termin-aktionen.js:43 · module/termin-druck.js:27 · module/termin-panel.js:34 · module/warteliste-ansicht.js:31 · module/warteliste-nachruecker.js:83
- `$` — attendance.js:10 · module/anamnese.js:43 · module/branding-ui.js:31 · module/heilmittel-zeilen-ui.js:29 · module/kiosk.js:74 · module/podo-vorgeschichte-form.js:88 · module/rechnung-zahlungseingang.js:455 · module/ueber.js:52 · module/verordnung-einheiten.js:543 · module/verordnung-podo.js:85 · module/verordnung-pruefen-knopf.js:43 · module/zuzahlung-korrektur.js:206 · ops/app.js:48 · widget/booking-widget.js:24
- `schliessen` — cookie-consent.js:137 · module/abrechnung-freigabe.js:190 · module/abrechnungsstatus.js:603 · module/arzt-register.js:278 · module/formular-editor.js:427 · module/patienten-import.js:479 · module/rechnung-zahlungseingang.js:555 · module/verordnung-einheiten.js:300 · module/verordnung-einheiten.js:398 · module/verordnung-einheiten.js:591 · module/verordnung-feldmarker.js:240 · module/verordnung-import.js:725 · module/zuzahlung-befreiung.js:151 · module/zuzahlung-korrektur.js:209
- `fmt` — api-backend/setup/router.js:135 · dashboard.js:1130 · dashboard.js:7173 · dashboard.js:8934 · dashboard.js:9210 · dashboard.js:12293 · dashboard.js:16958 · dashboard.js:17044 · dashboard.js:17123 · dashboard.js:17155 · module/kalender-raster.js:76 · module/rechnung-ansicht.js:230 · module/rezeptinfo-geld.js:71
- `render` — calendar-widget.js:127 · dashboard.js:11851 · dashboard.js:16774 · module/app-start.js:36 · module/ki-einstellungen.js:13 · module/mail-signatur-editor.js:41 · ops/board.js:206 · ops/decisions.js:14 · ops/files.js:52 · ops/finance.js:959 · ops/meetings.js:23 · ops/wissen.js:66 · patient-suche.js:116
- `handler` — api/admin/data.js:37 · api/admin/feedbacks.js:8 · api/apify/search.js:10 · api/config.js:6 · api/contact.js:33 · api/demo-booking.js:416 · api/onboarding/check-email.js:12 · api/onboarding/pending.js:13 · api/stripe/create-checkout-session.js:17 · api/stripe/portal-session.js:15 · api/stripe/webhook.js:98 · module/arztangaben-banner.js:104
- `g` — dashboard.js:13220 · dashboard.js:13233 · dashboard.js:13406 · module/heilmittel-zeilen-ui.js:262 · module/rezept-barcode-bestaetigung.js:15 · module/rezept-barcode-dialog.js:6 · module/rezept-in-maske.js:40 · module/rezept-patientenkopf.js:7 · module/verordnung-anlegen.js:32 · module/verordnung-maske.js:460 · module/verordnung-nachweis.js:29
- `r2` — api-backend/billing/api/abrechnung.routes.js:2541 · api-backend/billing/api/statistik.routes.js:187 · api-backend/billing/api/zuzahlung.routes.js:47 · api-backend/billing/dta/builder.js:137 · api-backend/billing/dta/preflight.js:1113 · api-backend/billing/preise/resolver.js:44 · api-backend/billing/utils/abrechnung-zeilen.js:39 · api-backend/billing/zuzahlung/calculator.js:78 · api-backend/billing/zuzahlung/korrektur.js:17 · module/abrechnung-verlauf.js:128 · module/zuzahlung-rechnen.js:42
- `fmtDate` — api-backend/billing/dta/encoding.js:107 · api-backend/billing/pdf/ausfallrechnung.template.js:24 · api-backend/billing/pdf/begleitzettel.template.js:34 · api-backend/billing/pdf/mahnung.template.js:11 · api-backend/billing/pdf/rechnung.template.js:16 · api-backend/billing/pdf/rezeptvorderseite.template.js:15 · api-backend/billing/pdf/rzg-quittung.template.js:14 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:19 · dashboard.js:991 · ops/app.js:84
- `t` — api-backend/lib/rechnung-pdf.js:120 · api-backend/lib/rechnung-snapshot.js:15 · api-backend/lib/therapiebericht.js:123 · api-backend/server.js:4238 · dashboard.js:525 · module/anamnese.js:393 · module/bg-angaben.js:36 · module/branding.js:28 · module/kiosk.js:58 · module/termin-rechtstexte.js:20
- `cleanup` — dashboard.js:5850 · dashboard.js:5937 · dashboard.js:17524 · merkez/test/dev-server.js:84 · module/absagegrund-modal.js:87 · module/bestaetigungs-dialog.js:49 · module/formular-editor.js:565 · module/formular-unterschreiben.js:201 · module/formular-unterschreiben.js:371
- `run` — api-backend/ai/tasks/appointment-confirm-draft.js:17 · api-backend/ai/tasks/b2b-draft.js:69 · api-backend/ai/tasks/b2c-draft.js:69 · api-backend/ai/tasks/rezept-normalize.js:136 · api-backend/ai/tasks/rezept-ocr.js:20 · api-backend/ai/tasks/rezept-validate.js:12 · api-backend/ai/tasks/series-scheduler.js:7 · api-backend/ai/tasks/transkribieren.js:15 · merkez/db.js:125
- `speichern` — cookie-consent.js:120 · module/arzt-register.js:294 · module/fax-einstellungen.js:112 · module/fussbefund.js:792 · module/mailversand.js:326 · module/physio-befund.js:906 · module/praxis-rechtslinks-einstellungen.js:102 · module/standort-plan.js:606 · module/verordnung-detail.js:959
- `resolveAuth` — api-backend/billing/api/ausfall.routes.js:33 · api-backend/billing/api/mahnwesen.routes.js:29 · api-backend/billing/api/podo-empfangsnachweis.routes.js:14 · api-backend/billing/api/rechnung-zahlung.routes.js:92 · api-backend/billing/api/statistik.routes.js:25 · api-backend/billing/api/verordnung-status.routes.js:53 · api-backend/billing/api/warteliste.routes.js:29 · api-backend/billing/api/zuzahlung.routes.js:53
- `zeichne` — module/abrechnung-auswahl.js:769 · module/abrechnungsstatus.js:616 · module/einrichtung-ring.js:44 · module/patienten-einwilligung.js:540 · module/patienten-import.js:394 · module/praxis-standort.js:122 · module/raum-auswahl.js:251 · module/rezeptinfo-geld.js:458
- `zeile` — api-backend/lib/therapiebericht.js:420 · module/branding-ui.js:39 · module/fax-deckblatt.js:54 · module/rechnung-druck.js:34 · module/verordnung-detail.js:293 · module/verordnung-detail.js:428 · module/verordnung-detail.js:496 · module/verordnung-pruefen-knopf.js:122
- `el` — module/arzt-register.js:253 · module/fussbefund.js:232 · module/mailversand.js:59 · module/patient-notizen.js:16 · module/termin-aktionsleiste.js:49 · module/termin-panel.js:39 · module/verordnung-maske.js:765
- `fmtEur` — api-backend/billing/pdf/ausfallrechnung.template.js:19 · api-backend/billing/pdf/begleitzettel.template.js:32 · api-backend/billing/pdf/mahnung.template.js:9 · api-backend/billing/pdf/rechnung.template.js:14 · api-backend/billing/pdf/rzg-quittung.template.js:12 · api-backend/billing/pdf/zuzahlungsrechnung.template.js:17 · module/geld.js:48
- `init` — attendance.js:299 · booking-request.js:1420 · booking.js:67 · cookie-consent.js:210 · dashboard.js:14132 · onboarding.js:77 · setup.js:197
- `leer` — api-backend/billing/dta/auftragsdatei.js:67 · api-backend/lib/terminerinnerung-job.js:27 · module/fahrtenbuch-regeln.js:315 · module/fussbefund-archiv.js:199 · module/sitzungsplan.js:114 · module/startseite-handlungsbedarf-karte.js:9 · module/verordnung-pruefung.js:101
- `onEsc` — dashboard.js:5944 · module/rechnung-leistung-picker.js:48 · module/verordnung-einheiten.js:304 · module/verordnung-einheiten.js:402 · module/verordnung-einheiten.js:596 · module/zuzahlung-befreiung.js:156 · module/zuzahlung-korrektur.js:214
- `wert` — module/anfrage-bearbeiten.js:186 · module/fahrtenbuch-regeln.js:307 · module/hausbesuch-route.js:33 · module/mail-entwurf.js:55 · module/mailversand.js:324 · module/verordnung-pruefen-knopf.js:44 · setup.js:290
- `zahl` — api-backend/lib/datev.js:358 · api-backend/lib/gps-checkin.js:12 · module/frequenz-pruefung.js:150 · module/rechnung-summen.js:14 · module/rezept-in-maske.js:223 · module/startseite-darstellung.js:168 · module/startseite-geld.js:17
- `fehler` — api-backend/billing/api/artefakt-historie.js:37 · api-backend/billing/api/artefakt-registry.js:21 · api-backend/billing/api/physio-publikation-ablauf.js:23 · api-backend/billing/codes/physio-leistungszeilen.js:32 · api-backend/lib/gmail-senden.js:66 · module/therapiebericht.js:205
- `laden` — module/kopf-dokumente.js:54 · module/mailversand.js:193 · module/mein-urlaub.js:6 · module/plz.js:40 · module/start-aufgaben.js:359 · module/startseite-handlungsbedarf-karte.js:44
- `lesen` — cookie-consent.js:101 · module/mail-signatur-editor.js:24 · module/raum-tagesansicht.js:145 · module/rezept-barcode-scan.js:90 · module/startseite-handlungsbedarf-karte.js:40 · module/startseite-handlungsbedarf-laden.js:123
- `load` — module/patient-notizen.js:36 · module/rezept-patientenkopf.js:28 · ops/board.js:111 · ops/decisions.js:7 · ops/meetings.js:7 · ops/wissen.js:49
- `log` — installieren/install.sh:19 · onprem/backup.sh:47 · onprem/deinstallieren.sh:37 · onprem/install.sh:68 · onprem/restore.sh:44 · onprem/update.sh:59
- `ok` — installieren/install.sh:20 · onprem/backup.sh:48 · onprem/deinstallieren.sh:38 · onprem/install.sh:69 · onprem/restore.sh:45 · onprem/update.sh:60
- `sha256Hex` — api-backend/billing/api/abrechnung.routes.js:100 · api-backend/billing/api/artefakt-registry.js:28 · api-backend/billing/api/zuzahlungsforderung.routes.js:39 · api-backend/billing/dta/zuzahlungsforderung-ursprung.js:145 · api-backend/merkez-istemci/signatur.js:26 · module/einwilligung-texte.js:440
- `zeigeFehler` — module/abrechnung-detail.js:576 · module/abrechnung-detail.js:618 · module/verordnung-einheiten.js:552 · module/zuzahlung-befreiung.js:150 · module/zuzahlung-korrektur.js:208 · widget/booking-widget.js:362
- `add` — api-backend/ai/pii-mask.js:295 · api-backend/billing/dta/output-validator.js:164 · api-backend/lib/verbindungen.js:38 · module/feiertage.js:57 · module/podo-vorgeschichte.js:37
- `datumDe` — api-backend/lib/mail-entwurf.js:29 · module/datum.js:78 · module/ehemalige-mitarbeiter.js:27 · module/kopf-dokumente.js:35 · module/standort-plan.js:394
- `feld` — module/abrechnung-auswahl.js:985 · module/datev-einstellungen.js:71 · module/fussbefund.js:307 · module/mailversand.js:287 · module/rezeptinfo-geld.js:385
- `main` — api-backend/check_diagnosegruppen_icd.js:101 · api-backend/merkez-istemci/kayit.js:230 · api-backend/preise_autoupdate.mjs:211 · api-backend/preise_pruefen.mjs:261 · api-backend/sync_heilmittel_katalog.js:159
- `markiere` — module/kalender-auswahl.js:46 · module/leistung-farbwahl.js:51 · module/planung-bruecke.js:134 · module/verordnung-liste.js:268 · widget/booking-widget.js:107
- `oeffne` — module/kalender-kontextmenue.js:120 · module/kopf-suche-ansicht.js:122 · module/leiste-flyout.js:64 · module/leistungen-liste.js:190 · module/verordnung-liste.js:220
- `oeffnen` — dashboard.js:7206 · module/fussbefund.js:1078 · module/kopf-dokumente.js:108 · module/raum-auswahl.js:273 · module/rechnung-mail.js:63
- `tag` — module/podo-vorgeschichte.js:22 · module/rechnung-dmrz.js:38 · module/rezeptinfo-geld.js:257 · module/startseite-handlungsbedarf-laden.js:13 · module/startseite-handlungsbedarf.js:7

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
