-- SYNTHETIC SUBSET FIXTURE. Disposable empty database only, never production.
-- Generated from selected CREATE TABLE / constraints / five function bodies in
-- db/SCHEMA.sql + SCHEMA-RLS.sql, 0111 export. NOT a full migration-chain test.
-- PostGIS geography -> text, no geography behavior tested. Missing cross-subset
-- FKs, service audit/RLS/business-id/auth triggers and services equipment CHECK
-- are not loaded. New claim/registry FKs and selected existing FKs ARE real.
-- No real rows/secrets. Rebuild/review fixture when upstream schema changes.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE EXTENSION btree_gist;
-- SCHEMA.sql sha256: 625d5348f0f02fd3fb4da205968a4967ba2f5a5221315c6bd9e9e588f8edb7e5
-- SCHEMA-RLS.sql sha256: c482e307f3f63d5700060528b6a35b918810eef5d8ae3050477cc787f2d852cb
CREATE SEQUENCE zuzahlung_befreiung_id_seq;
CREATE SEQUENCE heilmittel_tarif_id_seq;
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  business_name text,
  plan text DEFAULT 'starter'::text,
  billing text DEFAULT 'monthly'::text,
  airtable_link text,
  whatsapp_number text,
  language text DEFAULT 'de'::text,
  created_at timestamp with time zone DEFAULT now(),
  activated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  sector text,
  city text,
  country text DEFAULT 'DE'::text,
  booking_slug text,
  whatsapp_phone_number_id text,
  whatsapp_waba_id text,
  whatsapp_access_token_secret_id uuid,
  working_hours jsonb DEFAULT '{}'::jsonb,
  faq jsonb DEFAULT '[]'::jsonb,
  message_templates jsonb DEFAULT '{}'::jsonb,
  system_prompt text,
  onboarding_step text DEFAULT 'account'::text,
  updated_at timestamp with time zone DEFAULT now(),
  plan_status text DEFAULT 'pending'::text NOT NULL,
  trial_ends_at timestamp with time zone,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  billing_interval text,
  current_period_end timestamp with time zone,
  role text DEFAULT 'owner'::text,
  company_code text,
  owner_id uuid,
  b2b_sender_name text,
  b2b_setup_done boolean DEFAULT false,
  b2b_from_email text,
  b2b_gmail_refresh_token text,
  street text,
  zip text,
  house_number text,
  owner_first_name text,
  owner_last_name text,
  accepts_bookings boolean DEFAULT true,
  avatar_url text,
  anrede text,
  ik_number text,
  plz text,
  phone text,
  iban text,
  bic text,
  bank_name text,
  steuernummer text,
  ust_id text,
  tax_exempt_note text,
  has_dta_pro boolean DEFAULT false NOT NULL,
  dta_pro_subscription_item_id text,
  clinic_location text,
  clinic_geocoded_at timestamp with time zone,
  clinic_lat numeric(9,6),
  clinic_lng numeric(9,6),
  avv_accepted_at timestamp with time zone,
  agb_accepted_at timestamp with time zone,
  deletion_scheduled_at timestamp with time zone,
  deletion_consent_at timestamp with time zone,
  deletion_consent_ip text,
  praxis_logo_url text,
  invoice_footer_text text,
  urlaub_jahrestage integer DEFAULT 30,
  booking_auto_approve boolean DEFAULT false,
  booking_auto_approve_types text[] DEFAULT '{}'::text[],
  booking_request_link_enabled boolean DEFAULT true,
  kim_adresse text,
  telematik_id text,
  ausfall_enabled boolean DEFAULT false NOT NULL,
  ausfall_mode text DEFAULT 'fixed'::text NOT NULL,
  ausfall_amount_eur numeric(10,2),
  ausfall_percent numeric(5,2),
  ausfall_cutoff_hours integer DEFAULT 24 NOT NULL,
  ausfall_hinweis text,
  fussbefund_legende jsonb DEFAULT '[]'::jsonb NOT NULL,
  tablet_kiosk_pin_set boolean DEFAULT false NOT NULL,
  selbstzahler_stufen jsonb DEFAULT '[]'::jsonb NOT NULL,
  buchungskonten jsonb DEFAULT '[]'::jsonb NOT NULL,
  gps_checkin_pruefen boolean DEFAULT false NOT NULL,
  praxis_stempel_path text,
  praxis_inhaber text,
  praxis_impressum_url text,
  praxis_datenschutz_url text,
  datev_einstellungen jsonb DEFAULT '{}'::jsonb NOT NULL,
  fax_mail_muster text
);
CREATE TABLE public.prescriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  patient_id uuid,
  arzt_id uuid,
  image_storage_path text,
  image_uploaded_at timestamp with time zone,
  status text DEFAULT 'parsed'::text NOT NULL,
  rezept_typ text DEFAULT 'standard'::text NOT NULL,
  icd10 text,
  diagnosegruppe text,
  heilmittel text,
  heilmittel_feld_text text,
  anzahl_einheiten integer,
  frequenz text,
  ausstellungsdatum date,
  behandlungsbeginn date,
  is_dringend boolean DEFAULT false,
  hausbesuch boolean DEFAULT false,
  gueltig_bis date,
  computed jsonb,
  warnings jsonb,
  blockers_overridden jsonb,
  ocr_confidence numeric(3,2),
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  proceed_anyway boolean DEFAULT false,
  dmrz_exported_at timestamp with time zone,
  total_bonuses_eur numeric(8,2),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  heilmittel_position text,
  zuzahlung_eur numeric(10,2),
  zuzahlung_befreit boolean DEFAULT false,
  is_blanko boolean DEFAULT false,
  is_lhb_bvb boolean DEFAULT false,
  doctor_lanr text,
  doctor_bsnr text,
  kostentraeger_ik text,
  abrechnung_id uuid,
  abrechnung_status text,
  business_id uuid,
  bericht_angefordert boolean DEFAULT false NOT NULL,
  bericht_status text DEFAULT 'offen'::text NOT NULL,
  leitsymptomatik text,
  unterschrift_vorhanden boolean,
  signature_confidence text,
  deadline_reminders jsonb DEFAULT '{}'::jsonb,
  heilmittel_typ_blanko text,
  vorrangig_einheiten integer,
  ergaenzend_einheiten integer,
  heilmittel_items jsonb DEFAULT '[]'::jsonb,
  evo_task_id text,
  evo_access_code text,
  quelle text DEFAULT 'papier'::text,
  fhir_raw jsonb,
  pat_leitsymptomatik text,
  diagnose_freitext text,
  ergaenzendes_heilmittel text,
  therapie_bereich text,
  hinweise text,
  icd10_2 text,
  zuzahlung_kassiert_am timestamp with time zone,
  zuzahlung_kassiert_von uuid,
  zuzahlung_kassiert_eur numeric(10,2),
  zuzahlung_zahlart text,
  verordnungsnummer integer,
  belegnummer text,
  patient_name text,
  wagner_grad smallint,
  versichertennummer text,
  behandlungsanlass text,
  absetzung_betrag numeric(10,2),
  absetzung_grund text,
  absetzung_am date,
  storno_grund text,
  storno_am date,
  rezeptart text,
  notizen text,
  nagel text,
  krankenkasse_ik text,
  abrechnung_status_manuell_am timestamp with time zone,
  abrechnung_status_manuell_von uuid,
  bg_traeger_name text,
  bg_traeger_anschrift text,
  bg_unfalltag date,
  bg_aktenzeichen text,
  bg_kostenzusage_datum date,
  bg_kostenzusage_zeichen text,
  bg_einverstaendnis_am date,
  bg_einverstaendnis_version text,
  zuzahlung_altsystem_eur numeric(10,2),
  zuzahlung_altsystem_am date,
  zuzahlung_altsystem_beleg text,
  ergaenzend_position text,
  hausbesuch_ort text,
  doppelbehandlung boolean DEFAULT false NOT NULL
);
CREATE TABLE public.prescription_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  prescription_id uuid NOT NULL,
  booking_id uuid,
  session_number integer NOT NULL,
  status text DEFAULT 'planned'::text NOT NULL,
  done_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  notes text,
  heilmittel_index integer DEFAULT 0,
  ergaenzend_erbracht boolean DEFAULT false NOT NULL
);
CREATE TABLE public.leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  total_score numeric,
  reviews_count integer,
  street text,
  city text,
  state text,
  country_code text,
  website text,
  phone text,
  categories text[],
  category_name text,
  google_url text,
  email text,
  status text DEFAULT 'new'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  phone_normalized text,
  first_name text,
  last_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  hausbesuch boolean DEFAULT false,
  besondere_wuensche text,
  arzt_id uuid,
  geschlecht text,
  geburtsdatum date,
  versichertennummer text,
  krankenkasse text,
  plz text,
  location text,
  distance_km numeric(6,2),
  duration_min integer,
  route_calculated_at timestamp with time zone,
  lat numeric(9,6),
  lng numeric(9,6),
  business_id uuid,
  insurance_type text,
  versichertenstatus text,
  ausfallvereinbarung_am date,
  handy text,
  handy_normalized text,
  patientennummer integer,
  podologie_altbestand_vor_2023 boolean,
  podologie_altbestand_beantwortet_am timestamp with time zone,
  krankenkasse_ik text,
  podo_vorgeschichte_erste_beh_am date,
  podo_vorgeschichte_78040_am date,
  podo_vorgeschichte_78100_am date,
  podo_vorgeschichte_naegel jsonb,
  podo_vorgeschichte_erfasst_am timestamp with time zone
);
CREATE TABLE public.aerzte (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  arzt_name text NOT NULL,
  arzt_nummer text,
  fachrichtung text,
  telefon text,
  adresse text,
  created_at timestamp with time zone DEFAULT now(),
  lanr text,
  bsnr text,
  business_id uuid,
  praxis_name text,
  fax text,
  email text,
  notizen text,
  quelle text,
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.bookings (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  service_id uuid,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  status text DEFAULT 'confirmed'::text,
  meeting_link text,
  created_at timestamp with time zone DEFAULT now(),
  owner_id uuid,
  customer_phone_normalized text,
  hausbesuch boolean DEFAULT false,
  notes text,
  fahrt_status text,
  vehicle_id uuid,
  start_km integer,
  end_km integer,
  fahrt_started_at timestamp with time zone,
  fahrt_arrived_at timestamp with time zone,
  fahrt_ended_at timestamp with time zone,
  business_id uuid,
  is_group boolean DEFAULT false,
  group_capacity integer DEFAULT 1,
  group_parent_id uuid,
  lead_id uuid,
  no_show boolean DEFAULT false NOT NULL,
  no_show_noted_at timestamp with time zone,
  cancellation_reason text,
  rezeptart text,
  payment_method text,
  verordnung_id uuid,
  dauer_quelle text,
  cancelled_at timestamp with time zone,
  cancelled_session_links jsonb DEFAULT '[]'::jsonb NOT NULL,
  no_show_session_links jsonb DEFAULT '[]'::jsonb NOT NULL,
  room_id uuid,
  room_automatisch boolean DEFAULT false NOT NULL,
  raum_service_ids uuid[]
);
CREATE TABLE public.services (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  title text NOT NULL,
  duration_minutes integer,
  price text,
  description text,
  is_online_meeting boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  color text DEFAULT '#22c55e'::text,
  owner_id uuid,
  price_config jsonb,
  code text,
  is_internal boolean DEFAULT false,
  business_id uuid,
  is_group boolean DEFAULT false,
  group_capacity integer DEFAULT 5,
  required_certificate text,
  gkv_position_nr text,
  kostentraeger_typ text,
  raum_ausstattung text[] DEFAULT '{}'::text[] NOT NULL
);
CREATE TABLE public.therapist_certificates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  certificate text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE public.zuzahlung_befreiung (
  id bigint DEFAULT nextval('zuzahlung_befreiung_id_seq'::regclass) NOT NULL,
  owner_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  jahr integer NOT NULL,
  befreit_ab date NOT NULL,
  befreit_bis date,
  beleg_url text,
  created_at timestamp with time zone DEFAULT now(),
  business_id uuid,
  nachweis_art text DEFAULT 'bescheinigung'::text,
  notiz text
);
CREATE TABLE public.prescription_documents (
  id bigint GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1) NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  prescription_id uuid NOT NULL,
  patient_id uuid,
  art text DEFAULT 'sonstiges'::text NOT NULL,
  storage_path text NOT NULL,
  dateiname text,
  mime_type text,
  groesse_bytes integer,
  notiz text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.heilmittel_katalog (
  code text NOT NULL,
  bereich text NOT NULL,
  label text NOT NULL,
  kuerzel text,
  kategorie text,
  diagnosegruppen text[],
  preis_eur numeric(10,2),
  zuzahlung_eur numeric(10,2),
  dauer text,
  gueltig_ab date DEFAULT '1900-01-01'::date NOT NULL,
  gueltig_bis date DEFAULT '9999-12-31'::date NOT NULL,
  deprecated boolean DEFAULT false NOT NULL,
  ungueltig_ab date,
  ersetzt_durch text,
  max_pro_tag integer,
  max_pro_termin integer,
  notiz text,
  gruppe boolean DEFAULT false NOT NULL,
  telemed boolean DEFAULT false NOT NULL,
  sort integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.heilmittel_position (
  positionsnummer text NOT NULL,
  template_x text NOT NULL,
  abrechnungscode text NOT NULL,
  heilmittel_bereich text NOT NULL,
  bezeichnung text NOT NULL,
  kategorie text,
  preis_eur numeric(8,2) NOT NULL,
  zuzahlung_eur numeric(8,2),
  zuzahlung_pflicht boolean GENERATED ALWAYS AS ((zuzahlung_eur IS NOT NULL)) STORED,
  behandlungsdauer text,
  is_gruppe boolean DEFAULT false,
  is_telemed boolean DEFAULT false,
  is_hausbesuch boolean DEFAULT false,
  notes text,
  source_vertrag text NOT NULL,
  gueltig_ab date NOT NULL,
  gueltig_bis date,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.heilmittel_tarif (
  id bigint DEFAULT nextval('heilmittel_tarif_id_seq'::regclass) NOT NULL,
  bundesland text NOT NULL,
  kostentraeger_ik text,
  position_nr text NOT NULL,
  heilmittel_code text,
  preis_eur numeric(10,2) NOT NULL,
  zuzahlung_pflicht boolean DEFAULT true,
  gueltig_ab date NOT NULL,
  gueltig_bis date,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.kostentraeger (
  ik text NOT NULL,
  name text NOT NULL,
  das_ik text,
  payer_type text,
  region text,
  active boolean DEFAULT true,
  valid_from date,
  valid_to date,
  updated_at timestamp with time zone DEFAULT now(),
  kurzname text,
  abrechnender_kt_ik text,
  ist_abrechnender_kt boolean DEFAULT false,
  quelle text,
  quelle_stand date,
  datensatz_status text DEFAULT 'echt'::text
);
CREATE TABLE public.kostentraeger_annahmestellen (
  id bigint GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1) NOT NULL,
  kostentraeger_ik text NOT NULL,
  verknuepfungsart text NOT NULL,
  partner_ik text NOT NULL,
  leistungserbringergruppe text DEFAULT ''::text NOT NULL,
  abrechnungscode text DEFAULT ''::text NOT NULL,
  art_datenlieferung text DEFAULT ''::text NOT NULL,
  uebermittlungsmedium text DEFAULT ''::text NOT NULL,
  bundesland text DEFAULT ''::text NOT NULL,
  quelle text,
  quelle_stand date,
  updated_at timestamp with time zone DEFAULT now(),
  valid_from date,
  valid_to date
);
CREATE TABLE public.krankenkassen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  abbreviation text,
  type text DEFAULT 'gesetzlich'::text,
  created_at timestamp with time zone DEFAULT now(),
  ik_number text
);
CREATE TABLE public.terapeut_zertifikat (
  owner_id uuid NOT NULL,
  ik_nummer text NOT NULL,
  cert_subject text,
  cert_valid_from date,
  cert_valid_to date,
  cert_thumbprint text,
  cert_serial text,
  uploaded_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_id uuid,
  betriebsart text DEFAULT 'test'::text NOT NULL,
  betriebsart_geaendert_am timestamp with time zone,
  betriebsart_geaendert_von uuid,
  zulassung_referenz text,
  zulassung_datum date
);
CREATE TABLE public.betriebsart_empfaenger (
  owner_id uuid NOT NULL,
  empfaenger_ik text NOT NULL,
  betriebsart text DEFAULT 'test'::text NOT NULL,
  zulassung_referenz text,
  zulassung_datum date,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid
);
CREATE TABLE public.empfaenger_zertifikate (
  ik text NOT NULL,
  zertifikat_der bytea NOT NULL,
  fingerprint_sha256 text NOT NULL,
  gueltig_von date NOT NULL,
  gueltig_bis date NOT NULL,
  quelle text NOT NULL,
  quelle_datum date NOT NULL,
  onaylayan text NOT NULL,
  hochgeladen_am timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.businesses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  business_name text NOT NULL,
  sector text,
  street text,
  house_number text,
  zip text,
  city text,
  country text DEFAULT 'DE'::text,
  phone text,
  email text,
  booking_slug text,
  is_default boolean DEFAULT false,
  ik_number text,
  clinic_lat numeric,
  clinic_lng numeric,
  clinic_geocoded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  closed_days integer[] DEFAULT ARRAY[]::integer[],
  ausfall_enabled boolean DEFAULT false NOT NULL,
  ausfall_mode text DEFAULT 'fixed'::text NOT NULL,
  ausfall_amount_eur numeric(10,2),
  ausfall_percent numeric(5,2),
  ausfall_cutoff_hours integer DEFAULT 24 NOT NULL,
  ausfall_hinweis text
);
CREATE TABLE public.abrechnung (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  kostentraeger_ik text NOT NULL,
  dateiname text,
  rechnungsnummer text,
  total_eur numeric(10,2) DEFAULT 0,
  zuzahlung_total numeric(10,2) DEFAULT 0,
  status text DEFAULT 'erstellt'::text NOT NULL,
  dta_file_size integer,
  dta_segment_count integer,
  prescription_count integer DEFAULT 0,
  rejected_count integer DEFAULT 0,
  storage_path text,
  begleitzettel_path text,
  zaa_uploaded_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  signed_storage_path text,
  signed_at timestamp with time zone,
  signed_by_cert_thumbprint text,
  business_id uuid,
  auftragsdatei_path text,
  auftragsdatei_size integer,
  dta_sha256 text,
  auftragsdatei_sha256 text,
  signed_sha256 text,
  betriebsart text,
  datenaustauschreferenz integer,
  transfernummer integer,
  empfaenger_ik text,
  verwerfungsgrund text,
  encrypted_storage_path text,
  encrypted_sha256 text,
  verschluesselt_am timestamp with time zone,
  verschluesselt_fuer_fingerprint text,
  verschluesselung_hinweis text,
  verarbeitungskennzeichen text,
  zuzahlungsforderung_ursprung_id uuid,
  zuzahlungsforderung_daten jsonb
);
CREATE TABLE public.abrechnung_zeile (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  abrechnung_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  prescription_id uuid,
  kostentraeger_ik text NOT NULL,
  karten_ik text,
  einzel_rechnungsnummer text NOT NULL,
  sort_order smallint DEFAULT 0 NOT NULL,
  belegnummer text,
  patient_name text,
  versichertennummer text,
  verordnungsdatum date,
  therapie_bereich text,
  heilmittel_position text,
  anzahl_einheiten integer,
  leistungen jsonb DEFAULT '[]'::jsonb NOT NULL,
  brutto_eur numeric(10,2) DEFAULT 0 NOT NULL,
  zuzahlung_eur numeric(10,2) DEFAULT 0 NOT NULL,
  netto_eur numeric(10,2) DEFAULT 0 NOT NULL,
  status text DEFAULT 'eingereicht'::text NOT NULL,
  absetzung_eur numeric(10,2) DEFAULT 0 NOT NULL,
  absetzung_grund text,
  absetzung_am date,
  herkunft text DEFAULT 'einreichung'::text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE public.prescription_validations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  prescription_id uuid NOT NULL,
  engine text NOT NULL,
  input_snapshot jsonb NOT NULL,
  result jsonb NOT NULL,
  ok boolean NOT NULL,
  warnings_count integer DEFAULT 0,
  blockers_count integer DEFAULT 0,
  proceeded_anyway boolean DEFAULT false,
  validated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  overridden_rules text[],
  proceed_reason text
);
CREATE TABLE public.datenaustausch_zaehler (
  absender_ik text NOT NULL,
  empfaenger_ik text NOT NULL,
  owner_id uuid,
  letzte_referenz bigint DEFAULT 0 NOT NULL,
  letzte_transfernummer integer DEFAULT 0 NOT NULL,
  aktualisiert_am timestamp with time zone DEFAULT now() NOT NULL
);






















































































































































ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_betriebsart_chk CHECK (betriebsart IS NULL OR (betriebsart = ANY (ARRAY['test'::text, 'erprobung'::text, 'echt'::text])));
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_status_check CHECK (status = ANY (ARRAY['erstellt'::text, 'heruntergeladen'::text, 'gesendet'::text, 'accepted'::text, 'rejected'::text, 'paid'::text, 'verworfen'::text]));
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_verarbeitungskennzeichen_check CHECK (verarbeitungskennzeichen = ANY (ARRAY['01'::text, '02'::text, '03'::text, '04'::text]));
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_zuzahlungsforderung_daten_check CHECK ((NOT verarbeitungskennzeichen IS DISTINCT FROM '03'::text) = (zuzahlungsforderung_daten IS NOT NULL));
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_zuzahlungsforderung_ursprung_check CHECK ((NOT verarbeitungskennzeichen IS DISTINCT FROM '03'::text) = (zuzahlungsforderung_ursprung_id IS NOT NULL));
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_absetzung_betrag CHECK (absetzung_eur >= 0::numeric AND (herkunft = 'rekonstruiert'::text OR absetzung_eur <= netto_eur));
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_absetzung_grund CHECK (absetzung_eur = 0::numeric OR btrim(COALESCE(absetzung_grund, ''::text)) <> ''::text);
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_herkunft_check CHECK (herkunft = ANY (ARRAY['einreichung'::text, 'rekonstruiert'::text]));
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_status_check CHECK (status = ANY (ARRAY['eingereicht'::text, 'akzeptiert'::text, 'abgesetzt'::text, 'teilabgesetzt'::text, 'nachgereicht'::text]));
ALTER TABLE ONLY public.aerzte
  ADD CONSTRAINT aerzte_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_betriebsart_chk CHECK (betriebsart = ANY (ARRAY['test'::text, 'erprobung'::text, 'echt'::text]));
ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_echt_braucht_zulassung_chk CHECK (betriebsart <> 'echt'::text OR btrim(COALESCE(zulassung_referenz, ''::text)) <> ''::text AND zulassung_datum IS NOT NULL);
ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_pkey PRIMARY KEY (owner_id, empfaenger_ik);
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_dauer_quelle_check CHECK (dauer_quelle IS NULL OR (dauer_quelle = ANY (ARRAY['vorschlag'::text, 'manuell'::text, 'serie'::text])));
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_fahrt_status_check CHECK (fahrt_status = ANY (ARRAY['fahrt_started'::text, 'fahrt_arrived'::text, 'fahrt_return_pending'::text, 'fahrt_completed'::text]));
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_raum_service_ids_gueltig CHECK (raum_service_ids IS NULL OR cardinality(raum_service_ids) <= 30 AND COALESCE(array_ndims(raum_service_ids), 1) = 1 AND array_position(raum_service_ids, NULL::uuid) IS NULL);
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'completed'::text, 'pending'::text, 'no_show'::text]));
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (user_id WITH =, tstzrange(start_time, end_time, '[)'::text) WITH &&) WHERE (status = 'confirmed'::text AND group_parent_id IS NULL);
ALTER TABLE ONLY public.businesses
  ADD CONSTRAINT businesses_ausfall_mode_check CHECK (ausfall_mode = ANY (ARRAY['fixed'::text, 'percent'::text]));
ALTER TABLE ONLY public.businesses
  ADD CONSTRAINT businesses_booking_slug_key UNIQUE (booking_slug);
ALTER TABLE ONLY public.businesses
  ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.datenaustausch_zaehler
  ADD CONSTRAINT datenaustausch_zaehler_pkey PRIMARY KEY (absender_ik, empfaenger_ik);
ALTER TABLE ONLY public.empfaenger_zertifikate
  ADD CONSTRAINT empfaenger_zertifikate_pkey PRIMARY KEY (ik);
ALTER TABLE ONLY public.heilmittel_katalog
  ADD CONSTRAINT heilmittel_katalog_pkey PRIMARY KEY (bereich, code, gueltig_ab);
ALTER TABLE ONLY public.heilmittel_position
  ADD CONSTRAINT heilmittel_position_pkey PRIMARY KEY (positionsnummer);
ALTER TABLE ONLY public.heilmittel_tarif
  ADD CONSTRAINT heilmittel_tarif_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.kostentraeger
  ADD CONSTRAINT kostentraeger_datensatz_status_check CHECK (datensatz_status = ANY (ARRAY['echt'::text, 'mock_unbestaetigt'::text]));
ALTER TABLE ONLY public.kostentraeger
  ADD CONSTRAINT kostentraeger_payer_type_check CHECK (payer_type = ANY (ARRAY['gkv'::text, 'sonst'::text, 'privat'::text]));
ALTER TABLE ONLY public.kostentraeger
  ADD CONSTRAINT kostentraeger_pkey PRIMARY KEY (ik);
ALTER TABLE ONLY public.kostentraeger_annahmestellen
  ADD CONSTRAINT kostentraeger_annahmestellen_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.kostentraeger_annahmestellen
  ADD CONSTRAINT kostentraeger_annahmestellen_uniq UNIQUE (kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland);
ALTER TABLE ONLY public.krankenkassen
  ADD CONSTRAINT krankenkassen_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_geschlecht_check CHECK (geschlecht = ANY (ARRAY['m'::text, 'f'::text, 'd'::text]));
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_insurance_type_check CHECK (insurance_type = ANY (ARRAY['gkv'::text, 'privat'::text]));
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_krankenkasse_ik_format CHECK (krankenkasse_ik IS NULL OR krankenkasse_ik ~ '^[0-9]{9}$'::text);
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_podo_vorgeschichte_naegel_check CHECK (podo_vorgeschichte_naegel IS NULL OR jsonb_typeof(podo_vorgeschichte_naegel) = 'object'::text);
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_status_check CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'booked'::text, 'won'::text, 'lost'::text]));
ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_art_check CHECK (art = ANY (ARRAY['befreiungsausweis'::text, 'lhb_genehmigung'::text, 'korrigierte_verordnung'::text, 'therapiebericht'::text, 'sonstiges'::text, 'berichtsanforderung'::text]));
ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_prescription_id_session_number_key UNIQUE (prescription_id, session_number);
ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_status_check CHECK (status = ANY (ARRAY['planned'::text, 'done'::text, 'cancelled'::text, 'no_show'::text]));
ALTER TABLE ONLY public.prescription_validations
  ADD CONSTRAINT prescription_validations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_abrechnung_status_check CHECK (abrechnung_status IS NULL OR (abrechnung_status = ANY (ARRAY['bereit'::text, 'in_abrechnung'::text, 'gesendet'::text, 'accepted'::text, 'rejected'::text, 'paid'::text, 'teilabsetzung'::text, 'storniert'::text, 'archiviert'::text])));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_absetzung_betrag_check CHECK (absetzung_betrag IS NULL OR absetzung_betrag > 0::numeric AND (abrechnung_status = ANY (ARRAY['teilabsetzung'::text, 'rejected'::text])));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_bericht_status_check CHECK (bericht_status = ANY (ARRAY['offen'::text, 'in_arbeit'::text, 'erledigt'::text]));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_bg_einverstaendnis_version_check CHECK (bg_einverstaendnis_version IS NULL OR char_length(bg_einverstaendnis_version) <= 60);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_bg_laengen_check CHECK ((bg_traeger_name IS NULL OR char_length(bg_traeger_name) <= 200) AND (bg_traeger_anschrift IS NULL OR char_length(bg_traeger_anschrift) <= 500) AND (bg_aktenzeichen IS NULL OR char_length(bg_aktenzeichen) <= 80) AND (bg_kostenzusage_zeichen IS NULL OR char_length(bg_kostenzusage_zeichen) <= 80));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_ergaenzend_position_format CHECK (ergaenzend_position IS NULL OR ergaenzend_position ~ '^[X0-9][0-9]{4}$'::text);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_hausbesuch_ort_check CHECK (hausbesuch_ort IS NULL OR (hausbesuch_ort = ANY (ARRAY['haeuslich'::text, 'soziale_einrichtung'::text, 'tagespflege_kurzzeit_betreut'::text])));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_heilmittel_items_check CHECK (heilmittel_items IS NULL OR jsonb_typeof(heilmittel_items) = 'array'::text AND (jsonb_array_length(heilmittel_items) <= 3 OR NOT jsonb_path_exists(heilmittel_items, '$[*]?(exists (@."einheiten"))'::jsonpath)));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_krankenkasse_ik_format CHECK (krankenkasse_ik IS NULL OR krankenkasse_ik ~ '^[0-9]{9}$'::text);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_nagel_check CHECK (nagel IS NULL OR (nagel = ANY (ARRAY['U1 links'::text, 'U2 links'::text, 'U3 links'::text, 'U4 links'::text, 'U5 links'::text, 'U1 rechts'::text, 'U2 rechts'::text, 'U3 rechts'::text, 'U4 rechts'::text, 'U5 rechts'::text])));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_quelle_check CHECK (quelle = ANY (ARRAY['papier'::text, 'ocr'::text, 'evo'::text]));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_rezept_typ_check CHECK (rezept_typ = ANY (ARRAY['standard'::text, 'blanko'::text, 'lhb_bvb'::text, 'kassen'::text, 'privat'::text]));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_rezeptart_check CHECK (rezeptart IS NULL OR (rezeptart = ANY (ARRAY['kassen'::text, 'privat'::text, 'selbstzahler'::text, 'bg'::text])));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_signature_confidence_check CHECK (signature_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_status_check CHECK (status = ANY (ARRAY['parsed'::text, 'confirmed'::text, 'in_therapy'::text, 'completed'::text, 'billed'::text, 'cancelled'::text]));
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_teilabsetzung_braucht_betrag CHECK (abrechnung_status IS DISTINCT FROM 'teilabsetzung'::text OR absetzung_betrag IS NOT NULL);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_wagner_grad_check CHECK (wagner_grad IS NULL OR wagner_grad >= 0 AND wagner_grad <= 5);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_altsystem_check CHECK (zuzahlung_altsystem_eur IS NULL OR zuzahlung_altsystem_eur >= 0::numeric);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_zahlart_check CHECK (zuzahlung_zahlart IS NULL OR (zuzahlung_zahlart = ANY (ARRAY['bar'::text, 'ec'::text, 'ueberweisung'::text, 'sonstiges'::text, 'paypal'::text])));
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_anrede_check CHECK (anrede = ANY (ARRAY['Herr'::text, 'Frau'::text, 'Divers'::text]));
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_ausfall_mode_check CHECK (ausfall_mode = ANY (ARRAY['fixed'::text, 'percent'::text]));
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_billing_check CHECK (billing = ANY (ARRAY['monthly'::text, 'annual'::text]));
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_billing_interval_check CHECK ((billing_interval = ANY (ARRAY['month'::text, 'year'::text])) OR billing_interval IS NULL);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_booking_slug_unique UNIQUE (booking_slug);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_company_code_key UNIQUE (company_code);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_fax_mail_muster_check CHECK (fax_mail_muster IS NULL OR length(fax_mail_muster) <= 200 AND fax_mail_muster ~ '^[A-Za-z0-9._+-]*\{nummer\}[A-Za-z0-9._+-]*@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$'::text);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_onboarding_step_check CHECK (onboarding_step = ANY (ARRAY['account'::text, 'business'::text, 'billing'::text, 'owner'::text, 'services'::text, 'hours'::text, 'whatsapp'::text, 'templates'::text, 'plan'::text, 'done'::text]));
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan = ANY (ARRAY['starter'::text, 'professional'::text, 'klinik'::text, 'mitarbeiter'::text, 'enterprise'::text]));
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_plan_status_check CHECK (plan_status = ANY (ARRAY['pending'::text, 'trial'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'expired'::text, 'deleted'::text]));
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_praxis_datenschutz_url_check CHECK (praxis_datenschutz_url IS NULL OR char_length(praxis_datenschutz_url) <= 500 AND praxis_datenschutz_url ~ '^https://[^[:space:][:cntrl:]]+$'::text);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_praxis_impressum_url_check CHECK (praxis_impressum_url IS NULL OR char_length(praxis_impressum_url) <= 500 AND praxis_impressum_url ~ '^https://[^[:space:][:cntrl:]]+$'::text);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_praxis_inhaber_laenge_check CHECK (praxis_inhaber IS NULL OR char_length(praxis_inhaber) <= 200);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_praxis_stempel_path_check CHECK (praxis_stempel_path IS NULL OR praxis_stempel_path ~ '^[0-9a-f-]{36}/stempel\.(png|jpg)$'::text);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['owner'::text, 'employee'::text]));
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_sector_check CHECK (sector IS NULL OR (sector = ANY (ARRAY['barber'::text, 'beauty'::text, 'nails'::text, 'tattoo'::text, 'spa'::text, 'gym'::text, 'massage'::text, 'physiotherapy'::text, 'praxis'::text, 'other'::text, 'podologie'::text, 'logopaedie'::text, 'ergotherapie'::text])));
ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_kostentraeger_typ_check CHECK (kostentraeger_typ IS NULL OR (kostentraeger_typ = ANY (ARRAY['gkv'::text, 'privat'::text, 'selbstzahler'::text, 'bg'::text])));
ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_required_certificate_check CHECK (required_certificate = ANY (ARRAY['MT'::text, 'MLD'::text, 'KGG'::text, 'ZNS-BOBATH'::text, 'ZNS-VOJTA'::text, 'ZNS-PNF'::text, 'ZNS-K-BOBATH'::text, 'ZNS-K-VOJTA'::text]));
ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_betriebsart_chk CHECK (betriebsart = ANY (ARRAY['test'::text, 'erprobung'::text, 'echt'::text]));
ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_echt_braucht_zulassung_chk CHECK (betriebsart <> 'echt'::text OR btrim(COALESCE(zulassung_referenz, ''::text)) <> ''::text AND zulassung_datum IS NOT NULL);
ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_pkey PRIMARY KEY (owner_id);
ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_certificate_check CHECK (certificate = ANY (ARRAY['MT'::text, 'MLD'::text, 'KGG'::text, 'ZNS-BOBATH'::text, 'ZNS-VOJTA'::text, 'ZNS-PNF'::text, 'ZNS-K-BOBATH'::text, 'ZNS-K-VOJTA'::text]));
ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_profile_id_certificate_key UNIQUE (profile_id, certificate);
ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_patient_id_jahr_key UNIQUE (patient_id, jahr);
ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik);
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_zuzahlungsforderung_ursprung_fk FOREIGN KEY (zuzahlungsforderung_ursprung_id) REFERENCES abrechnung_zeile(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.aerzte
  ADD CONSTRAINT aerzte_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.aerzte
  ADD CONSTRAINT aerzte_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_group_parent_id_fkey FOREIGN KEY (group_parent_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id);
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_verordnung_id_fkey FOREIGN KEY (verordnung_id) REFERENCES prescriptions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.businesses
  ADD CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.datenaustausch_zaehler
  ADD CONSTRAINT datenaustausch_zaehler_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.heilmittel_tarif
  ADD CONSTRAINT heilmittel_tarif_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik) ON DELETE CASCADE;
ALTER TABLE ONLY public.kostentraeger_annahmestellen
  ADD CONSTRAINT kostentraeger_annahmestellen_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik) ON DELETE CASCADE;
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_arzt_id_fkey FOREIGN KEY (arzt_id) REFERENCES aerzte(id);
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prescription_validations
  ADD CONSTRAINT prescription_validations_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prescription_validations
  ADD CONSTRAINT prescription_validations_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_abrechnung_status_manuell_von_fkey FOREIGN KEY (abrechnung_status_manuell_von) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_arzt_id_fkey FOREIGN KEY (arzt_id) REFERENCES aerzte(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik);
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_kassiert_von_fkey FOREIGN KEY (zuzahlung_kassiert_von) REFERENCES auth.users(id);
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id);
ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_betriebsart_geaendert_von_fkey FOREIGN KEY (betriebsart_geaendert_von) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.naechste_datenaustauschreferenz(p_owner uuid, p_absender_ik text, p_empfaenger_ik text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_n bigint;
begin
  if p_owner is null or btrim(coalesce(p_absender_ik,'')) = '' or btrim(coalesce(p_empfaenger_ik,'')) = '' then
    raise exception 'naechste_datenaustauschreferenz: owner, Absender-IK und Empfaenger-IK sind Pflicht';
  end if;

  insert into datenaustausch_zaehler (absender_ik, empfaenger_ik, owner_id, letzte_referenz)
  values (p_absender_ik, p_empfaenger_ik, p_owner, 1)
  on conflict (absender_ik, empfaenger_ik) do update
    set letzte_referenz = datenaustausch_zaehler.letzte_referenz + 1,
        owner_id = coalesce(datenaustausch_zaehler.owner_id, excluded.owner_id),
        aktualisiert_am = now()
  returning letzte_referenz into v_n;

  return ((v_n - 1) % 99999)::integer + 1;
end $function$
;
CREATE OR REPLACE FUNCTION public.naechste_transfernummer(p_owner uuid, p_absender_ik text, p_empfaenger_ik text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_n integer;
begin
  if p_owner is null or btrim(coalesce(p_absender_ik,'')) = '' or btrim(coalesce(p_empfaenger_ik,'')) = '' then
    raise exception 'naechste_transfernummer: owner, Absender-IK und Empfaenger-IK sind Pflicht';
  end if;

  insert into datenaustausch_zaehler (absender_ik, empfaenger_ik, owner_id, letzte_transfernummer)
  values (p_absender_ik, p_empfaenger_ik, p_owner, 1)
  on conflict (absender_ik, empfaenger_ik) do update
    set letzte_transfernummer = (datenaustausch_zaehler.letzte_transfernummer + 1) % 1000,
        owner_id = coalesce(datenaustausch_zaehler.owner_id, excluded.owner_id),
        aktualisiert_am = now()
  returning letzte_transfernummer into v_n;

  return v_n;
end $function$
;
CREATE OR REPLACE FUNCTION public.fn_abrechnung_zeile_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Eine eingereichte Abrechnungszeile kann nicht geloescht werden (GoBD, §302 SGB V). Korrektur: neue Einreichung (VKZ 04).';
  end if;

  if new.owner_id                is distinct from old.owner_id
  or new.business_id             is distinct from old.business_id
  or new.created_at              is distinct from old.created_at
  or new.abrechnung_id           is distinct from old.abrechnung_id
  or new.prescription_id        is distinct from old.prescription_id
  or new.kostentraeger_ik       is distinct from old.kostentraeger_ik
  or new.karten_ik              is distinct from old.karten_ik
  or new.einzel_rechnungsnummer is distinct from old.einzel_rechnungsnummer
  or new.belegnummer            is distinct from old.belegnummer
  or new.verordnungsdatum       is distinct from old.verordnungsdatum
  or new.heilmittel_position    is distinct from old.heilmittel_position
  or new.anzahl_einheiten       is distinct from old.anzahl_einheiten
  or new.leistungen             is distinct from old.leistungen
  or new.brutto_eur             is distinct from old.brutto_eur
  or new.zuzahlung_eur          is distinct from old.zuzahlung_eur
  or new.netto_eur              is distinct from old.netto_eur
  or new.herkunft               is distinct from old.herkunft
  then
    raise exception 'Eingereichte Abrechnungszeile ist festgeschrieben (GoBD). Offen bleiben nur status, absetzung_* und die Anonymisierung.';
  end if;

  if new.patient_name is not null and new.patient_name is distinct from old.patient_name then
    raise exception 'patient_name darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;
  if new.versichertennummer is not null and new.versichertennummer is distinct from old.versichertennummer then
    raise exception 'versichertennummer darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.prescriptions_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.belegnummer is null then
    return new;
  end if;

  if new.owner_id             is distinct from old.owner_id
  or new.business_id          is distinct from old.business_id
  or new.created_at           is distinct from old.created_at
  or new.belegnummer          is distinct from old.belegnummer
  or new.ausstellungsdatum    is distinct from old.ausstellungsdatum
  or new.diagnosegruppe       is distinct from old.diagnosegruppe
  or new.icd10                is distinct from old.icd10
  or new.icd10_2              is distinct from old.icd10_2
  or new.leitsymptomatik      is distinct from old.leitsymptomatik
  or new.pat_leitsymptomatik  is distinct from old.pat_leitsymptomatik
  or new.is_dringend          is distinct from old.is_dringend
  or new.hausbesuch           is distinct from old.hausbesuch
  or new.frequenz             is distinct from old.frequenz
  or new.rezeptart            is distinct from old.rezeptart
  or new.zuzahlung_befreit    is distinct from old.zuzahlung_befreit
  or new.zuzahlung_eur        is distinct from old.zuzahlung_eur
  or new.kostentraeger_ik     is distinct from old.kostentraeger_ik
  or new.arzt_id              is distinct from old.arzt_id
  or new.wagner_grad          is distinct from old.wagner_grad
  or new.nagel                is distinct from old.nagel
  or new.krankenkasse_ik      is distinct from old.krankenkasse_ik
  or new.behandlungsanlass    is distinct from old.behandlungsanlass
  or new.heilmittel           is distinct from old.heilmittel
  or new.heilmittel_position  is distinct from old.heilmittel_position
  or new.anzahl_einheiten     is distinct from old.anzahl_einheiten
  or new.doctor_lanr          is distinct from old.doctor_lanr
  or new.doctor_bsnr          is distinct from old.doctor_bsnr
  or new.rezept_typ           is distinct from old.rezept_typ
  or new.is_blanko            is distinct from old.is_blanko
  or new.is_lhb_bvb           is distinct from old.is_lhb_bvb
  or new.behandlungsbeginn    is distinct from old.behandlungsbeginn
  or new.gueltig_bis          is distinct from old.gueltig_bis
  -- 0089 (gkv-302, 27.10.2026): ergänzendes Heilmittel, Hausbesuch-Ort, Doppelbehandlung
  or new.ergaenzendes_heilmittel is distinct from old.ergaenzendes_heilmittel
  or new.ergaenzend_einheiten is distinct from old.ergaenzend_einheiten
  or new.vorrangig_einheiten  is distinct from old.vorrangig_einheiten
  or new.ergaenzend_position  is distinct from old.ergaenzend_position
  or new.hausbesuch_ort       is distinct from old.hausbesuch_ort
  or new.doppelbehandlung     is distinct from old.doppelbehandlung
  -- 0099 (Ops #202): mehrere Heilmittel je Verordnung
  or new.heilmittel_items     is distinct from old.heilmittel_items
  then
    raise exception 'Eingereichte Verordnung ist festgeschrieben (GoBD, §302 SGB V). Offen bleiben nur status/absetzung_*/storno_*/zuzahlung_kassiert_* und die Anonymisierung.';
  end if;

  if new.patient_name is not null and new.patient_name is distinct from old.patient_name then
    raise exception 'patient_name darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;
  if new.versichertennummer is not null and new.versichertennummer is distinct from old.versichertennummer then
    raise exception 'versichertennummer darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;
  if new.patient_id is not null and new.patient_id is distinct from old.patient_id then
    raise exception 'patient_id darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.trg_billing_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER fixture_zeile BEFORE UPDATE OR DELETE ON public.abrechnung_zeile FOR EACH ROW EXECUTE FUNCTION public.fn_abrechnung_zeile_festschreibung();
CREATE TRIGGER fixture_rx BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.prescriptions_festschreibung();
CREATE TRIGGER fixture_header BEFORE UPDATE ON public.abrechnung FOR EACH ROW EXECUTE FUNCTION public.trg_billing_updated_at();
\ir ../migrations/0060_abrechnung_artefakt_version.sql
\ir ../../../db/entwuerfe/physio-publikation-v1.sql
