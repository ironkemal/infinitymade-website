// DSGVO Klassifikation — EINZIGE Quelle fuer Auskunft (Art. 15),
// Loeschung (Art. 17) und gesetzliche Aufbewahrungssperren (Art. 18).
//
// Rechtliche Grundlage: compliance/LEGAL_DECISIONS.md Abschnitt „2026-10-02"
// KHS K1.4, K1.8 und Nachtrag K1.4.
// Fristen: konservativ gerechnet als Jahresende (YYYY-12-31) ab dem Loeschjahr
// („fruehestens", da Ablaufhemmung nach § 147 Abs. 3 S. 5 AO Sache der Praxis ist).

/**
 * Gesetzliche Aufbewahrungskategorien mit Fristen und Rechtsgrundlagen.
 */
export const KATEGORIEN = {
  behandlung: {
    jahre: 10,
    grundlage: '§ 630f Abs. 3 BGB',
    label: 'Behandlungsdokumentation, Verordnungen',
  },
  einwilligung: {
    jahre: 10,
    grundlage: '§ 630f Abs. 3 BGB, Art. 7 Abs. 1 DSGVO',
    label: 'Einwilligungen',
  },
  beleg: {
    jahre: 8,
    grundlage: '§ 147 Abs. 1 Nr. 4 AO, § 14b UStG',
    label: 'Rechnungen und Abrechnungsdateien',
  },
  grundaufzeichnung: {
    jahre: 10,
    grundlage: '§ 147 Abs. 1 Nr. 1 AO',
    label: 'Zahlungsaufzeichnungen und Fahrtenbuch',
  },
  geschaeftsbrief: {
    jahre: 6,
    grundlage: '§ 147 Abs. 1 Nr. 3 AO',
    label: 'Mahnungen',
  },
};

/**
 * Vollstaendige Klassifikation aller mandantenbezogenen Tabellen.
 * Jede Tabelle in public mit Personenbezug muss hier aufgefuehrt sein.
 */
export const TABELLEN = [
  // ── Behandlungsdokumentation (§ 630f Abs. 3 BGB: 10 Jahre) ─────────────────
  {
    table: 'podologie_behandlungen',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'employee_id',
    anmerkung: 'Behandlungsdokumentation, Trigger blockt DELETE bedingungslos',
  },
  {
    table: 'podologie_empfangsnachweise',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'geprueft_von',
    anmerkung: 'Podologischer Empfangsnachweis (Papierbeleg-Prüfung § 302 SGB V), append-only',
  },
  {
    table: 'anamnese',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    anmerkung: 'Patientenanamnese, append-only',
  },
  {
    table: 'pat_fussbefund',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    anmerkung: 'Podologischer Fussbefund, Versionierung',
  },
  {
    table: 'messreihen',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    anmerkung: 'Verlaufsmessungen Blankoverordnung',
  },
  {
    table: 'patient_notes',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    anmerkung: 'Therapeuten- und Arztnotizen zur Akte',
  },
  {
    table: 'ueberweisungen',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    anmerkung: 'Aerztliche Ueberweisungsdokumente',
  },
  {
    table: 'aerzte',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    anmerkung: 'Aerzte-Register; bleibt solange Sperrbestand existiert (leads.arzt_id NO ACTION)',
  },
  {
    table: 'prescriptions',
    kategorie: 'behandlung',
    export: { filter: 'owner_id' },
    anmerkung: 'Behandelte VO -> behandlung (10 J.); unbehandelte VO -> loeschen',
  },
  {
    table: 'prescription_sessions',
    kategorie: 'vo_folgt',
    export: { filter: 'prescriptions.owner_id', select: '*,prescriptions!inner(owner_id)' },
    anmerkung: 'Folgt der Verordnung: erledigte Einheiten bleiben gesperrt',
  },
  {
    table: 'prescription_documents',
    kategorie: 'vo_folgt',
    export: { filter: 'owner_id' },
    anmerkung: 'Folgt der Verordnung: Dokumente behandelter VO bleiben gesperrt',
  },
  {
    table: 'prescription_validations',
    kategorie: 'vo_folgt',
    export: { filter: 'prescriptions.owner_id', select: '*,prescriptions!inner(owner_id)' },
    anmerkung: 'Audit-Trail der Pruefung; folgt der Verordnung',
  },

  // ── Einwilligungen (Art. 7 Abs. 1 DSGVO, § 630f Abs. 3 BGB: 10 Jahre) ──────
  {
    table: 'patient_consents',
    kategorie: 'einwilligung',
    export: { filter: 'owner_id' },
    anmerkung: 'Nachweiskette der Einwilligung, RESTRICT auf leads und profiles',
  },

  // ── Rechnungen und Buchungsbelege (§ 147 Abs. 1 Nr. 4 AO, § 14b UStG: 8 Jahre) ─
  {
    table: 'invoices',
    kategorie: 'beleg',
    export: { filter: 'owner_id' },
    anmerkung: 'Rechnungen, festgeschrieben nach GoBD',
  },
  {
    table: 'ausfallrechnungen',
    kategorie: 'beleg',
    export: { filter: 'owner_id' },
    anmerkung: 'Rechnungen bei Terminausfall',
  },
  {
    table: 'abrechnung',
    kategorie: 'beleg',
    export: { filter: 'owner_id' },
    anmerkung: 'GKV-Sammelabrechnung Kopfsatz (§ 302 SGB V)',
  },
  {
    table: 'abrechnung_artefakt_version',
    kategorie: 'artefakt_lebenszyklus',
    export: { filter: 'owner_id' },
    anmerkung: '§ 302 DTA-Artefaktversionen (unsigned/signed/encrypted); individueller Lebenszyklus pro Registry-Eintrag, keine pauschale 8-Jahre-Frist, Prüfung/Retention per Version',
  },
  {
    table: 'abrechnung_artefakt_freeze',
    kategorie: 'behalten_ohne_person',
    export: { filter: 'owner_id' },
    anmerkung: 'Freeze-Marker des Loeschlaufs (nur owner_id + Zeitstempel), keine Inhaltsdaten',
  },
  {
    table: 'abrechnung_zeile',
    kategorie: 'beleg',
    export: { filter: 'owner_id' },
    anmerkung: 'GKV-Abrechnung Einzelzeilen, festgeschrieben',
  },
  {
    table: 'abrechnung_uebermittlung',
    kategorie: 'beleg',
    export: { filter: 'owner_id' },
    anmerkung: 'Transportdokumentation Datenaustausch Anlage 1 TP5 Kap. 3(2)',
  },
  {
    table: 'zuzahlung_befreiung',
    kategorie: 'beleg',
    export: { filter: 'owner_id' },
    anmerkung: 'Befreiungsbescheide/Nachweise der Krankenkasse',
  },
  {
    table: 'zaa_fehler',
    kategorie: 'beleg',
    export: { filter: 'abrechnung.owner_id', select: '*,abrechnung!inner(owner_id)' },
    anmerkung: 'Kassenrueckmeldungen zu Abrechnungen, keine eigene owner_id',
  },

  // ── Grundaufzeichnungen (§ 147 Abs. 1 Nr. 1 AO: 10 Jahre) ──────────────────
  {
    table: 'rechnung_zahlungen',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    anmerkung: 'Zahlungshistorie zu Privatrechnungen (GoBD-Ledger)',
  },
  {
    table: 'abrechnung_zahlung',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    anmerkung: 'Geldeingaenge der Kassen auf Sammelabrechnungen',
  },
  {
    table: 'belegliste',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    anmerkung: 'Kassen- und Barbelegjournal (GoBD)',
  },
  {
    table: 'zuzahlung_korrekturen',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    anmerkung: 'GoBD-Aenderungsprotokoll von Zuzahlungsbetraegen',
  },
  {
    table: 'zuzahlung_guthaben',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    anmerkung: 'Guthaben aus Zuzahlungsueberzahlungen',
  },
  {
    table: 'booking_status_korrekturen',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    anmerkung: 'Aenderungsprotokoll des Terminstatus (GoBD)',
  },
  {
    table: 'fahrten',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'Fahrtenbuch fuer Hausbesuche (§ 147 Abs. 1 Nr. 1 AO)',
  },
  {
    table: 'fahrten_aenderungen',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    anmerkung: 'Fahrtenbuch-Aenderungsprotokoll (BMF 18.11.2009)',
  },
  {
    table: 'vehicles',
    kategorie: 'grundaufzeichnung',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'created_by',
    anmerkung: 'Fahrzeuge zum Fahrtenbuch',
  },

  // ── Geschaeftsbriefe (§ 147 Abs. 1 Nr. 3 AO: 6 Jahre) ──────────────────────
  {
    table: 'mahnungen',
    kategorie: 'geschaeftsbrief',
    export: { filter: 'owner_id' },
    anmerkung: 'Mahnungen an Patienten/Selbstzahler (K1.4 Nachtrag: 6 Jahre)',
  },

  // ── Patientenstamm minimiert ────────────────────────────────────────────────
  {
    table: 'leads',
    kategorie: 'stamm_minimiert',
    export: { filter: 'owner_id' },
    anmerkung: 'Patientenstamm; ohne Fremdbezug loeschen, sonst auf Minimalsatz reduzieren',
  },

  // ── Behalten ohne Personenbezug ─────────────────────────────────────────────
  {
    table: 'datenaustausch_zaehler',
    kategorie: 'behalten_ohne_person',
    export: null,
    anmerkung: 'IK-Zaehler, traegt keine Personendaten, darf nie zurueckgesetzt werden',
  },
  {
    table: 'nummernkreise',
    kategorie: 'behalten_ohne_person',
    export: { filter: 'owner_id' },
    anmerkung: 'Lueckenlose Nummernvergabe, bleibt zur Rechnungsnachpruefung',
  },
  {
    table: 'businesses',
    kategorie: 'behalten_ohne_person',
    export: { filter: 'owner_id' },
    anmerkung: 'Standorte; bleibt solange Sperrbestand existiert (CASCADE-Schutz)',
  },

  // ── Sofort loeschen (Art. 17 Abs. 1 DSGVO) ──────────────────────────────────
  {
    table: 'bookings',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'Termine; Sonderregel: fahrten.booking_id=null vor Loeschung, BSK ausnehmen',
  },
  {
    table: 'booking_leistungen',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Leistungszuordnung des Termins, vor bookings loeschen',
  },
  {
    table: 'booking_requests',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'employee_id',
    anmerkung: 'Terminanfragen aus Online-Buchung',
  },
  {
    table: 'patients',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Interessenten-Topf des Terminanfrage-Flows',
  },
  {
    table: 'warteliste',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Termin-Warteliste',
  },
  {
    table: 'email_logs',
    kategorie: 'loeschen',
    nurSaas: true,
    export: { filter: 'owner_id' },
    anmerkung: 'B2B Akquise-Mails',
  },
  {
    table: 'b2b_contacts',
    kategorie: 'loeschen',
    nurSaas: true,
    export: { filter: 'owner_id' },
    anmerkung: 'B2B Praxiskontakte',
  },
  {
    table: 'scraper_data',
    kategorie: 'loeschen',
    nurSaas: true,
    export: { filter: 'owner_id' },
    anmerkung: 'B2B Akquisedaten',
  },
  {
    table: 'referral_drafts',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Rezept-Entwuerfe aus OCR vor Bestaetigung',
  },
  {
    table: 'services',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Leistungskatalog der Praxis',
  },
  {
    table: 'working_hours',
    kategorie: 'loeschen',
    export: { filter: 'user_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'Arbeitszeiten',
  },
  {
    table: 'breaks',
    kategorie: 'loeschen',
    export: { filter: 'user_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'Pausenzeiten',
  },
  {
    table: 'custom_days',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Sonderoeffnungszeiten/Urlaubstage Praxis',
  },
  {
    table: 'time_offs',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'employee_id',
    anmerkung: 'Abwesenheiten/Urlaub Mitarbeiter',
  },
  {
    table: 'employee_services',
    kategorie: 'loeschen',
    export: { filter: 'employee_id' },
    mitarbeiterFilter: 'employee_id',
    anmerkung: 'Mitarbeiter-Leistungszuordnung',
  },
  {
    table: 'calendar_integrations',
    kategorie: 'loeschen',
    export: { filter: 'user_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'Google/Apple Kalendersynchronisation',
  },
  {
    table: 'document_vorlagen',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Druckvorlagen und Rechnungstexte',
  },
  {
    table: 'data_sharing_settings',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Standortuebergreifende Freigabeeinstellungen',
  },
  {
    table: 'attendance',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'employee_id',
    anmerkung: 'Anwesenheitserfassung/Check-in',
  },
  {
    table: 'therapist_certificates',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    mitarbeiterFilter: 'profile_id',
    anmerkung: 'Zertifikate (MT, MLD, KGG) von Therapeuten',
  },
  {
    table: 'terapeut_zertifikat',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Signaturzertifikat der Praxis fuer § 302 DTA',
  },
  {
    table: 'betriebsart_empfaenger',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'DTA-Betriebsart je Datenannahmestelle',
  },
  {
    table: 'user_preferences',
    kategorie: 'loeschen',
    export: { filter: 'user_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'UI-Einstellungen des Nutzers',
  },
  {
    table: 'employee_groups',
    kategorie: 'loeschen',
    export: { filter: 'businesses.owner_id', select: '*,businesses!inner(owner_id)' },
    anmerkung: 'Berechtigungsgruppen des Standorts',
  },
  {
    table: 'group_scopes',
    kategorie: 'loeschen',
    export: null,
    anmerkung: 'Gruppenrechte; faellt per CASCADE mit employee_groups',
  },
  {
    table: 'employee_business_assignments',
    kategorie: 'loeschen',
    export: { filter: 'employee_id' },
    mitarbeiterFilter: 'employee_id',
    anmerkung: 'Standortzuordnung der Mitarbeiter',
  },
  {
    table: 'employee_scope_overrides',
    kategorie: 'loeschen',
    export: null,
    mitarbeiterFilter: 'employee_id',
    anmerkung: 'Individuelle Rechteuebersteuerungen',
  },
  {
    table: 'kiosk_pins',
    kategorie: 'loeschen',
    export: null,
    anmerkung: 'PIN-Hashes fuer Kioskmodus; nicht in Auskunft, aber loeschen',
  },
  {
    table: 'chatbot_usage',
    kategorie: 'loeschen',
    export: { filter: 'owner_id' },
    anmerkung: 'Nutzungsprotokoll des Chatbots',
  },
  {
    table: 'feedbacks',
    kategorie: 'loeschen',
    export: { filter: 'user_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'Feedback-Einsendungen des Nutzers',
  },
  {
    table: 'ai_audit_log',
    kategorie: 'loeschen',
    export: { filter: 'user_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'KI-Aufrufprotokoll',
  },
  {
    table: 'pending_signups',
    kategorie: 'loeschen',
    nurSaas: true,
    export: null,
    anmerkung: 'Offene Registrierungen; vor Loeschung RPC pending_signup_delete aufrufen',
  },

  // ── Praxura-Eigen (nicht im Art.-17-Lauf, aber in Auskunft) ──────────────────
  {
    table: 'consent_log',
    kategorie: 'praxura_eigen',
    export: { filter: 'user_id' },
    mitarbeiterFilter: 'user_id',
    anmerkung: 'B2B AVV/AGB-Zustimmungsnachweis',
  },
  {
    table: 'data_access_log',
    kategorie: 'praxura_eigen',
    export: { filter: 'owner_id', select: 'occurred_at,action,resource,method' },
    anmerkung: 'Zugriffsprotokoll Art. 32; in Auskunft nur Zeit, Aktion, Ressource, Methode',
  },

  // ── Sperrbestand & System ───────────────────────────────────────────────────
  {
    table: 'aufbewahrung_sperre',
    kategorie: 'sperre_selbst',
    export: { filter: 'owner_id' },
    anmerkung: 'Der Sperrvermerk selbst; Auskunft ja (Nachweis)',
  },
  {
    table: 'praxura_setup',
    kategorie: 'praxura_eigen',
    export: { filter: 'owner_user_id' },
    anmerkung: 'Einrichtungsstatus der Box (nur Box relevant, Auskunft ja, nicht loeschen)',
  },
  {
    table: 'profiles',
    kategorie: 'konto',
    export: { filter: 'id' },
    mitarbeiterFilter: 'id',
    anmerkung: 'Benutzerprofil; wird anonymisiert und plan_status=deleted gesetzt',
  },
];

/**
 * Tabellen ohne Personenbezug oder Fremdprojekte (nicht mandantengebunden).
 */
export const AUSNAHMEN = [
  'accommodations',
  'admin_users',
  'applications',
  'demo_bookings',
  'diagnosegruppen',
  'dta_schluessel',
  'empfaenger_zertifikate',
  'heilmittel_catalog',
  'heilmittel_katalog',
  'heilmittel_position',
  'heilmittel_tarif',
  'icd10_titles',
  'icd_sector_ranges',
  'kostentraeger',
  'kostentraeger_annahmestellen',
  'kostentraeger_anschriften',
  'krankenkassen',
  'module_visibility',
  'praxura_migrations',
  'spatial_ref_sys',
  'trip_history',
  'trip_plans',
  'user_credits',
];

/**
 * Tabellen, die in der Box nicht existieren (0000_baseline.sql Kopf Z. 21-28).
 */
export const NUR_SAAS = [
  'accommodations',
  'applications',
  'trip_plans',
  'trip_history',
  'user_credits',
  'pending_signups',
  'demo_bookings',
  'visibility_reports',
  'scraper_data',
  'b2b_contacts',
  'email_logs',
];

/**
 * Storage-Buckets und die Herkunftsspalten ihrer Dateien.
 */
export const BUCKETS = [
  {
    bucket: 'prescriptions',
    pfadQuellen: [['prescriptions', 'image_storage_path']],
  },
  {
    bucket: 'abrechnungen',
    pfadQuellen: [
      ['abrechnung', 'storage_path'],
      ['abrechnung', 'signed_storage_path'],
      ['abrechnung', 'encrypted_storage_path'],
      ['abrechnung', 'begleitzettel_path'],
      ['abrechnung', 'auftragsdatei_path'],
    ],
  },
  {
    bucket: 'patient-documents',
    pfadQuellen: [
      ['patient_consents', 'signature_path'],
      ['zuzahlung_befreiung', 'beleg_url'],
      ['prescription_documents', 'storage_path'],
    ],
  },
  {
    bucket: 'avatars',
    pfadQuellen: [],
  },
  {
    bucket: 'referrals',
    pfadQuellen: [],
  },
];

/**
 * Alle Fremdschluessel und logischen Bezuege auf leads aus db/SCHEMA.sql.
 * Wird verwendet, um zu pruefen, ob ein Patient noch verknuepft ist oder geloescht werden darf.
 */
export const LEAD_BEZUEGE = [
  ['aufbewahrung_sperre', 'patient_id'],
  ['ausfallrechnungen', 'patient_id'],
  ['belegliste', 'patient_id'],
  ['invoices', 'patient_id'],
  ['invoices', 'lead_id'],
  ['anamnese', 'patient_id'],
  ['pat_fussbefund', 'lead_id'],
  ['patient_consents', 'patient_id'],
  ['prescriptions', 'patient_id'],
  ['bookings', 'lead_id'],
  ['ueberweisungen', 'lead_id'],
  ['zuzahlung_befreiung', 'patient_id'],
  ['zuzahlung_guthaben', 'patient_id'],
  ['zuzahlung_korrekturen', 'patient_id'],
  ['patient_notes', 'lead_id'],
  ['messreihen', 'lead_id'],
  ['mahnungen', 'patient_id'],
  ['fahrten', 'lead_id'],
  ['warteliste', 'lead_id'],
  ['referral_drafts', 'lead_id'],
  ['prescription_documents', 'patient_id'],
];
