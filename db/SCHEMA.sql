-- ============================================================================
-- SCHEMA.sql — Database Structural Schema Definition
-- PURPOSE: Catalog definitions for enums, domains, composites, sequences, tables, constraints, and views.
--
-- ENVIRONMENT:        saas njvuclullotbksskpwgk
-- LAST MIGRATION:     20261005194119 prescriptions_clientrechte_0066
-- EXPORTED AT:        2026-10-03T19:36:25.349Z
-- ERZEUGT AM:         2026-10-03 (Teilaktualisierung 2026-10-05)
-- POSTGRESQL VERSION: 17.6
--
-- COUNTS SUMMARY (SCOPE: schema-zaehler.js):
--   public_tables:       96
--   table_columns:       1380
--   view_columns:        37
--   matview_columns:     0
--   rls_policies:        168
--   functions:           103
--   triggers:            91
--   indexes:             335
--   auth_triggers:       1
--   publication_tables:  8
--   extensions:          9
--   rls_disabled_tables: 1
--
-- TEILAKTUALISIERUNG 05.10.2026: Migrationen 0060-0066 handgepflegt aus den angewandten Definitionen (ACL-Zeilen der neuen Objekte noch nicht im Export);
-- vollstaendiger Metadatenexport (tools/schema-export-katalog.sql + schema-dokumente.mjs) steht aus.
--
-- CAUTION / HINWEIS:
-- This document is a deterministic structural documentation snapshot.
-- It is NOT guaranteed to be standalone restore-executable in one single pass
-- due to circular dependencies, catalog constraints, and external state.
-- ============================================================================
-- ----------------------------------------------------------------------------
-- EXTENSIONS INVENTORY
-- ----------------------------------------------------------------------------
-- Extension: btree_gist (version: 1.7, schema: public)
-- Extension: pg_net (version: 0.20.0, schema: extensions)
-- Extension: pg_stat_statements (version: 1.11, schema: extensions)
-- Extension: pg_trgm (version: 1.6, schema: public)
-- Extension: pgcrypto (version: 1.3, schema: extensions)
-- Extension: plpgsql (version: 1.0, schema: pg_catalog)
-- Extension: postgis (version: 3.3.7, schema: public)
-- Extension: supabase_vault (version: 0.3.1, schema: vault)
-- Extension: uuid-ossp (version: 1.1, schema: extensions)

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
-- (no enums defined)

-- ----------------------------------------------------------------------------
-- DOMAINS
-- ----------------------------------------------------------------------------
-- (no domains defined)

-- ----------------------------------------------------------------------------
-- COMPOSITE TYPES
-- ----------------------------------------------------------------------------
-- [EXTENSION OWNED] Type public.geometry_dump (owned by extension)

-- [EXTENSION OWNED] Type public.valid_detail (owned by extension)

-- ----------------------------------------------------------------------------
-- SEQUENCES
-- ----------------------------------------------------------------------------
-- Sequence public.chatbot_usage_id_seq (identity-owned for public.chatbot_usage.id, AS bigint, START WITH 1, INCREMENT BY 1, MINVALUE 1, MAXVALUE 9223372036854775807, CACHE 1, NO CYCLE)

CREATE SEQUENCE public.data_access_log_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;
ALTER SEQUENCE public.data_access_log_id_seq OWNED BY public.data_access_log.id;
ALTER SEQUENCE public.data_access_log_id_seq OWNER TO postgres;

CREATE SEQUENCE public.dta_schluessel_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;
ALTER SEQUENCE public.dta_schluessel_id_seq OWNED BY public.dta_schluessel.id;
ALTER SEQUENCE public.dta_schluessel_id_seq OWNER TO postgres;

-- Sequence public.fahrten_aenderungen_id_seq (identity-owned for public.fahrten_aenderungen.id, AS bigint, START WITH 1, INCREMENT BY 1, MINVALUE 1, MAXVALUE 9223372036854775807, CACHE 1, NO CYCLE)

CREATE SEQUENCE public.heilmittel_tarif_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;
ALTER SEQUENCE public.heilmittel_tarif_id_seq OWNED BY public.heilmittel_tarif.id;
ALTER SEQUENCE public.heilmittel_tarif_id_seq OWNER TO postgres;

-- Sequence public.kostentraeger_annahmestellen_id_seq (identity-owned for public.kostentraeger_annahmestellen.id, AS bigint, START WITH 1, INCREMENT BY 1, MINVALUE 1, MAXVALUE 9223372036854775807, CACHE 1, NO CYCLE)

-- Sequence public.kostentraeger_anschriften_id_seq (identity-owned for public.kostentraeger_anschriften.id, AS bigint, START WITH 1, INCREMENT BY 1, MINVALUE 1, MAXVALUE 9223372036854775807, CACHE 1, NO CYCLE)

-- Sequence public.podologie_empfangsnachweise_event_seq_seq (identity-owned for public.podologie_empfangsnachweise.event_seq, AS bigint, START WITH 1, INCREMENT BY 1, MINVALUE 1, MAXVALUE 9223372036854775807, CACHE 1, NO CYCLE)

-- Sequence public.prescription_documents_id_seq (identity-owned for public.prescription_documents.id, AS bigint, START WITH 1, INCREMENT BY 1, MINVALUE 1, MAXVALUE 9223372036854775807, CACHE 1, NO CYCLE)

CREATE SEQUENCE public.zaa_fehler_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;
ALTER SEQUENCE public.zaa_fehler_id_seq OWNED BY public.zaa_fehler.id;
ALTER SEQUENCE public.zaa_fehler_id_seq OWNER TO postgres;

CREATE SEQUENCE public.zuzahlung_befreiung_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;
ALTER SEQUENCE public.zuzahlung_befreiung_id_seq OWNED BY public.zuzahlung_befreiung.id;
ALTER SEQUENCE public.zuzahlung_befreiung_id_seq OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- TABLES & CONSTRAINTS
-- ----------------------------------------------------------------------------
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
--   FK business_id -> businesses(id)
--   FK kostentraeger_ik -> kostentraeger(ik)
--   FK owner_id -> auth.users(id)
--   FK zuzahlungsforderung_ursprung_id -> abrechnung_zeile(id)
ALTER TABLE ONLY public.abrechnung OWNER TO postgres;
COMMENT ON COLUMN public.abrechnung.auftragsdatei_path IS 'Storage-Pfad der Auftragsdatei (Auftragssatz 348 Byte, GGT Anlage 2). Liegt neben der .dta — die beiden gehen nur PAARWEISE raus (Anhang 2 Kap. 9 § 3.1, Pruefstufe 1).';
COMMENT ON COLUMN public.abrechnung.auftragsdatei_size IS 'Byte-Laenge der Auftragsdatei. Heute immer 348; als Spalte gefuehrt, damit ein Formatfehler auffaellt, ohne die Datei zu laden.';
COMMENT ON COLUMN public.abrechnung.dta_sha256 IS 'SHA-256 der unsignierten Nutzdatendatei, hex. Beweismittel: welche Bytes wurden erzeugt (guvenlik Ö1). Kein Personenbezug.';
COMMENT ON COLUMN public.abrechnung.auftragsdatei_sha256 IS 'SHA-256 der Auftragsdatei, hex.';
COMMENT ON COLUMN public.abrechnung.signed_sha256 IS 'SHA-256 des signierten PKCS#7-Payloads (.p7m), hex. Wird beim Upload der Browser-Signatur gesetzt.';
COMMENT ON COLUMN public.abrechnung.betriebsart IS 'Betriebsart, mit der DIESE Datei erzeugt wurde: test | erprobung | echt. Kopie aus terapeut_zertifikat.betriebsart zum Erzeugungszeitpunkt — die Einstellung kann sich spaeter aendern, die Datei nicht. NULL = vor Einfuehrung erzeugt (faktisch test).';
COMMENT ON COLUMN public.abrechnung.datenaustauschreferenz IS 'Der 5-stellige UNB-0020-Wert DIESER Datei, wie vergeben. Nicht neu berechnen — er ist bei der Kasse hinterlegt.';
COMMENT ON COLUMN public.abrechnung.transfernummer IS 'Die 0..999-Transfernummer DIESER Datei (Stellen 6-8 des physikalischen Dateinamens; Wertebereich aus GGT Anlage 2, Feld TRANSFER_NUMMER: ab 999 wieder auf 0). Ein wiederholter Sendeversuch nimmt dieselbe Nummer (Anhang 1 § 4.3).';
COMMENT ON COLUMN public.abrechnung.empfaenger_ik IS 'IK der Datenannahmestelle, an die diese Datei geht. Bisher nur fluechtig in der Route bekannt; der Zaehler laeuft je (Absender-IK, Empfaenger-IK) und ohne diese Spalte ist im Nachhinein nicht mehr feststellbar, welche Folge die Datei fortgeschrieben hat.';
COMMENT ON COLUMN public.abrechnung.verwerfungsgrund IS 'Fehlercode bzw. gekürzte, PHI-freie Begründung, weshalb dieser Abrechnungsversuch nach Vergabe von Datenaustauschreferenz und Transfernummer verworfen wurde. Erklärt Lücken im Nummernkreis (GoBD).';
COMMENT ON COLUMN public.abrechnung.encrypted_storage_path IS 'Storage-Pfad der CMS-EnvelopedData-Datei (.dta.enc.p7m). NULL = noch nicht verschlüsselt oder letzter Versuch fehlgeschlagen.';
COMMENT ON COLUMN public.abrechnung.encrypted_sha256 IS 'SHA-256 der verschlüsselten Datei (verschluesselte Bytes, nicht die Signatur). Analog zu signed_sha256/dta_sha256.';
COMMENT ON COLUMN public.abrechnung.verschluesselt_am IS 'Zeitstempel des letzten erfolgreichen Verschlüsselungslaufs. Analog zu signed_at.';
COMMENT ON COLUMN public.abrechnung.verschluesselt_fuer_fingerprint IS 'SHA-256-Fingerprint des Empfängerzertifikats (empfaenger_zertifikate.fingerprint_sha256), mit dem diese Datei verschlüsselt wurde — nötig, um nach einer Zertifikatsrotation zu erkennen, mit welchem Schlüssel eine ältere Datei verschlüsselt ist.';
COMMENT ON COLUMN public.abrechnung.verschluesselung_hinweis IS 'Klartext-Status/Fehlermeldung des letzten Verschlüsselungsversuchs für die UI (NULL bei Erfolg). Darf laut Ö5 keine Patientendaten enthalten.';

ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_betriebsart_chk CHECK (betriebsart IS NULL OR (betriebsart = ANY (ARRAY['test'::text, 'erprobung'::text, 'echt'::text])));

ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik);

ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.abrechnung
  ADD CONSTRAINT abrechnung_zuzahlungsforderung_ursprung_fk FOREIGN KEY (zuzahlungsforderung_ursprung_id) REFERENCES abrechnung_zeile(id) ON DELETE RESTRICT;

CREATE TABLE public.abrechnung_artefakt_freeze (
  owner_id uuid NOT NULL,
  frozen_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK owner_id -> users(id)
ALTER TABLE ONLY public.abrechnung_artefakt_freeze OWNER TO postgres;
COMMENT ON TABLE public.abrechnung_artefakt_freeze IS 'Owner-Freeze (DSGVO-Loeschlauf): keine neuen Reservierungen';

ALTER TABLE ONLY public.abrechnung_artefakt_freeze
  ADD CONSTRAINT abrechnung_artefakt_freeze_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_artefakt_freeze
  ADD CONSTRAINT abrechnung_artefakt_freeze_pkey PRIMARY KEY (owner_id);

CREATE TABLE public.abrechnung_artefakt_version (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  abrechnung_id uuid NOT NULL,
  storage_path text NOT NULL,
  kind text NOT NULL,
  role text NOT NULL,
  sha256 text,
  legacy boolean DEFAULT false NOT NULL,
  state text DEFAULT 'reserved'::text NOT NULL,
  upload_state text DEFAULT 'pending'::text NOT NULL,
  claim_token uuid,
  claim_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  published_at timestamp with time zone,
  retired_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK abrechnung_id -> abrechnung(id)
--   FK owner_id -> users(id)
ALTER TABLE ONLY public.abrechnung_artefakt_version OWNER TO postgres;
COMMENT ON TABLE public.abrechnung_artefakt_version IS 'Registry aller Dateien im Bucket abrechnungen (M1.16); schuetzt Dateien vor Loeschung, ersetzt keine Rechnungs-Zustandsmaschine';

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT abrechnung_artefakt_version_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT abrechnung_artefakt_version_kind_check CHECK (kind = ANY (ARRAY['unsigned'::text, 'signed'::text, 'encrypted'::text]));

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT abrechnung_artefakt_version_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT abrechnung_artefakt_version_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT abrechnung_artefakt_version_role_check CHECK (role = ANY (ARRAY['dta'::text, 'auftrag'::text, 'begleit'::text, 'signed'::text, 'encrypted'::text]));

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT abrechnung_artefakt_version_sha256_check CHECK (sha256 ~ '^[0-9a-f]{64}$'::text);

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT abrechnung_artefakt_version_state_check CHECK (state = ANY (ARRAY['reserved'::text, 'published'::text, 'retire_pending'::text, 'retired'::text]));

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT abrechnung_artefakt_version_upload_state_check CHECK (upload_state = ANY (ARRAY['pending'::text, 'uploaded'::text, 'upload_failed'::text]));

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT artefakt_hash_pflicht CHECK (legacy OR sha256 IS NOT NULL);

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT artefakt_pfad_eindeutig UNIQUE (storage_path);

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT artefakt_pfad_owner CHECK (storage_path ~~ (owner_id::text || '/%'::text));

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT artefakt_pfad_sauber CHECK (storage_path !~ '(^|/)\.\.(/|$)'::text AND storage_path !~ '//'::text);

ALTER TABLE ONLY public.abrechnung_artefakt_version
  ADD CONSTRAINT artefakt_rolle_kind CHECK (role = ANY (ARRAY['dta'::text, 'auftrag'::text, 'begleit'::text]) AND kind = 'unsigned'::text OR role = 'signed'::text AND kind = 'signed'::text OR role = 'encrypted'::text AND kind = 'encrypted'::text);

CREATE TABLE public.abrechnung_uebermittlung (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  abrechnung_id uuid,
  antwort_auf uuid,
  richtung text NOT NULL,
  physikalischer_dateiname text NOT NULL,
  erstellt_am timestamp with time zone NOT NULL,
  laufende_nummer integer,
  transfernummer integer,
  partner_ik text NOT NULL,
  partner_name text,
  begonnen_am timestamp with time zone DEFAULT now() NOT NULL,
  beendet_am timestamp with time zone,
  dateigroesse_bytes bigint,
  verarbeitungshinweise text,
  verarbeitungskennzeichen text,
  fehlerstatus text DEFAULT 'offen'::text NOT NULL,
  fehlertext text,
  uebertragungsweg text,
  sha256 text,
  betriebsart text,
  absender_ik text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--   FK abrechnung_id -> abrechnung(id)
--   FK antwort_auf -> abrechnung_uebermittlung(id)
--   FK business_id -> businesses(id)
--   FK created_by -> auth.users(id)
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.abrechnung_uebermittlung OWNER TO postgres;
COMMENT ON TABLE public.abrechnung_uebermittlung IS 'Gesetzliche Uebermittlungsdokumentation des Datenaustauschs gemaess § 302 SGB V, Anlage 1 TP5 Kap. 3(2) und Anhang 1 § 4.5(2). Mindestens 2 Jahre Aufbewahrungspflicht. Striktes PHI-Verbot.';

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abr_uebermittlung_betriebsart_chk CHECK (betriebsart IS NULL OR (betriebsart = ANY (ARRAY['test'::text, 'erprobung'::text, 'echt'::text])));

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abr_uebermittlung_fehlerstatus_chk CHECK (fehlerstatus = ANY (ARRAY['offen'::text, 'ok'::text, 'fehler'::text, 'abgebrochen'::text]));

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abr_uebermittlung_richtung_chk CHECK (richtung = ANY (ARRAY['senden'::text, 'empfangen'::text]));

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abr_uebermittlung_weg_chk CHECK (uebertragungsweg IS NULL OR (uebertragungsweg = ANY (ARRAY['portal'::text, 'dfue'::text, 'mail'::text, 'datentraeger'::text, 'papier'::text])));

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abrechnung_uebermittlung_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abrechnung_uebermittlung_antwort_auf_fkey FOREIGN KEY (antwort_auf) REFERENCES abrechnung_uebermittlung(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abrechnung_uebermittlung_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abrechnung_uebermittlung_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abrechnung_uebermittlung_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_uebermittlung
  ADD CONSTRAINT abrechnung_uebermittlung_pkey PRIMARY KEY (id);

CREATE TABLE public.abrechnung_zahlung (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  abrechnung_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  einzel_rechnungsnummer text,
  art text DEFAULT 'zahlung'::text NOT NULL,
  betrag_eur numeric(10,2) NOT NULL,
  datum date NOT NULL,
  zahlungsavis text,
  notiz text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--   FK abrechnung_id -> abrechnung(id)
--   FK business_id -> businesses(id)
--   FK created_by -> auth.users(id)
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.abrechnung_zahlung OWNER TO postgres;

ALTER TABLE ONLY public.abrechnung_zahlung
  ADD CONSTRAINT abrechnung_zahlung_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_zahlung
  ADD CONSTRAINT abrechnung_zahlung_art_check CHECK (art = ANY (ARRAY['zahlung'::text, 'ruecklastschrift'::text, 'abschreibung'::text, 'korrektur'::text]));

ALTER TABLE ONLY public.abrechnung_zahlung
  ADD CONSTRAINT abrechnung_zahlung_betrag_check CHECK (betrag_eur <> 0::numeric);

ALTER TABLE ONLY public.abrechnung_zahlung
  ADD CONSTRAINT abrechnung_zahlung_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abrechnung_zahlung
  ADD CONSTRAINT abrechnung_zahlung_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abrechnung_zahlung
  ADD CONSTRAINT abrechnung_zahlung_grund_check CHECK (art = 'zahlung'::text OR length(btrim(COALESCE(notiz, ''::text))) >= 3);

ALTER TABLE ONLY public.abrechnung_zahlung
  ADD CONSTRAINT abrechnung_zahlung_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_zahlung
  ADD CONSTRAINT abrechnung_zahlung_pkey PRIMARY KEY (id);

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
--   FK abrechnung_id -> abrechnung(id)
--   FK business_id -> businesses(id)
--   FK owner_id -> profiles(id)
--   FK prescription_id -> prescriptions(id)
ALTER TABLE ONLY public.abrechnung_zeile OWNER TO postgres;

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_absetzung_betrag CHECK (absetzung_eur >= 0::numeric AND (herkunft = 'rekonstruiert'::text OR absetzung_eur <= netto_eur));

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_absetzung_grund CHECK (absetzung_eur = 0::numeric OR btrim(COALESCE(absetzung_grund, ''::text)) <> ''::text);

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_herkunft_check CHECK (herkunft = ANY (ARRAY['einreichung'::text, 'rekonstruiert'::text]));

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abrechnung_zeile
  ADD CONSTRAINT abrechnung_zeile_status_check CHECK (status = ANY (ARRAY['eingereicht'::text, 'akzeptiert'::text, 'abgesetzt'::text, 'teilabgesetzt'::text, 'nachgereicht'::text]));

CREATE TABLE public.accommodations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  name text NOT NULL,
  address text,
  location geography(Point,4326),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
--   FK user_id -> profiles(id)
ALTER TABLE ONLY public.accommodations OWNER TO postgres;

ALTER TABLE ONLY public.accommodations
  ADD CONSTRAINT accommodations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accommodations
  ADD CONSTRAINT accommodations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE TABLE public.admin_users (
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text
);
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.admin_users OWNER TO postgres;

ALTER TABLE ONLY public.admin_users
  ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.admin_users
  ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

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
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.aerzte OWNER TO postgres;
COMMENT ON TABLE public.aerzte IS 'Ärzte-Register je Inhaber (owner_id). Wird beim Erfassen einer Verordnung automatisch befüllt: LANR-Treffer -> vorhandenen Datensatz anreichern, sonst neu anlegen. Grundlage der Arzt-Auswertung (welcher Arzt überweist wie viel).';
COMMENT ON COLUMN public.aerzte.arzt_nummer IS 'VERALTET (2026-08-10). War doppelt belegt (Telefon in der Maske, LANR-Fallback in der DTA-Erzeugung). Daten nach telefon/praxis_name/lanr migriert. Nicht mehr lesen oder schreiben — Ersatz: lanr, bsnr, telefon, praxis_name.';
COMMENT ON COLUMN public.aerzte.lanr IS 'Lebenslange Arztnummer, 9-stellig. Stabiler Identitätsschlüssel: bleibt bei Namensänderung (Heirat) und Praxiswechsel gleich. Primäres Matching-Kriterium.';
COMMENT ON COLUMN public.aerzte.bsnr IS 'Betriebsstättennummer, 9-stellig. Ortsgebunden — ändert sich beim Praxiswechsel des Arztes. NICHT als Identitätsschlüssel verwenden.';
COMMENT ON COLUMN public.aerzte.business_id IS 'Standort, an dem der Arzt zuerst erfasst wurde. Rein informativ — das Register ist owner-weit und wird NICHT nach business_id gefiltert.';
COMMENT ON COLUMN public.aerzte.quelle IS 'Herkunft: ocr (KI-Rezeptscan), rezept (manuelle Rezepterfassung), verordnung (Podologie), manuell (Ärzte-Verwaltung), import.';

ALTER TABLE ONLY public.aerzte
  ADD CONSTRAINT aerzte_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.aerzte
  ADD CONSTRAINT aerzte_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.aerzte
  ADD CONSTRAINT aerzte_pkey PRIMARY KEY (id);

CREATE TABLE public.ai_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid,
  task text NOT NULL,
  model text,
  deployment text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  status text NOT NULL,
  error text,
  dry_run boolean DEFAULT false,
  request_hash text,
  created_at timestamp with time zone DEFAULT now()
);
--   FK tenant_id -> auth.users(id)
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.ai_audit_log OWNER TO postgres;

ALTER TABLE ONLY public.ai_audit_log
  ADD CONSTRAINT ai_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_audit_log
  ADD CONSTRAINT ai_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_audit_log
  ADD CONSTRAINT ai_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE public.anamnese (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  aufnahmedatum date DEFAULT CURRENT_DATE,
  hauptbeschwerde text,
  beschwerde_seit text,
  beschwerde_verlauf text,
  schmerz_skala smallint,
  schmerz_art text,
  vorerkrankungen text,
  operationen text,
  medikamente text,
  allergien text,
  beruf text,
  sport text,
  raucher boolean,
  diagnose text,
  arzt_name text,
  arzt_nummer text,
  rezept_sitzungen smallint,
  hausbesuch boolean DEFAULT false,
  besondere_wuensche text,
  notizen text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  business_id uuid,
  fachbereich text DEFAULT 'physio'::text NOT NULL,
  felder jsonb DEFAULT '{}'::jsonb NOT NULL,
  form_version smallint DEFAULT 1 NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  ist_aktuell boolean DEFAULT true NOT NULL,
  quelle text DEFAULT 'praxis'::text NOT NULL,
  geprueft_am timestamp with time zone,
  geprueft_von uuid,
  uebernommen_von uuid
);
--   FK business_id -> businesses(id)
--   FK created_by -> auth.users(id)
--   FK geprueft_von -> auth.users(id)
--   FK owner_id -> auth.users(id)
--   FK patient_id -> leads(id)
--   FK uebernommen_von -> anamnese(id)
--   FK updated_by -> auth.users(id)
ALTER TABLE ONLY public.anamnese OWNER TO postgres;
COMMENT ON COLUMN public.anamnese.fachbereich IS 'Formular je Fachbereich (physio|podo|ergo|logo). Alt-Zeilen vor 0047 = physio.';
COMMENT ON COLUMN public.anamnese.felder IS 'Fachspezifische Antworten; Schluessel definiert module/anamnese-formulare.js je form_version.';
COMMENT ON COLUMN public.anamnese.ist_aktuell IS 'Vergibt anamnese_versionieren(). Leser brauchen .eq(''ist_aktuell'', true).';
COMMENT ON COLUMN public.anamnese.quelle IS 'praxis = von der Praxis erfasst (geprueft beim Speichern); kiosk = Selbstauskunft, ungeprueft bis geprueft_am.';

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_beschwerde_verlauf_check CHECK (beschwerde_verlauf = ANY (ARRAY['konstant'::text, 'zunehmend'::text, 'abnehmend'::text, 'wechselnd'::text]));

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_fachbereich_check CHECK (fachbereich = ANY (ARRAY['physio'::text, 'podo'::text, 'ergo'::text, 'logo'::text]));

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_geprueft_von_fkey FOREIGN KEY (geprueft_von) REFERENCES auth.users(id);

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id);

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_quelle_check CHECK (quelle = ANY (ARRAY['praxis'::text, 'kiosk'::text]));

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_schmerz_skala_check CHECK (schmerz_skala >= 0 AND schmerz_skala <= 10);

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_uebernommen_von_fkey FOREIGN KEY (uebernommen_von) REFERENCES anamnese(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anamnese
  ADD CONSTRAINT anamnese_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);

CREATE TABLE public.applications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  job_text text NOT NULL,
  cv_text text NOT NULL,
  anschreiben text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.applications OWNER TO postgres;

ALTER TABLE ONLY public.applications
  ADD CONSTRAINT applications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.applications
  ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE public.attendance (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  employee_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  date date NOT NULL,
  check_in_at timestamp with time zone,
  check_out_at timestamp with time zone,
  check_in_valid boolean DEFAULT false,
  status text DEFAULT 'present'::text NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK business_id -> businesses(id)
--   FK employee_id -> profiles(id)
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.attendance OWNER TO postgres;
COMMENT ON COLUMN public.attendance.check_in_valid IS 'true = im 150-m-Umkreis, false = ausserhalb, NULL = nicht geprueft (Schalter aus, kein Standort, keine Praxiskoordinate).';

ALTER TABLE ONLY public.attendance
  ADD CONSTRAINT attendance_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.attendance
  ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);

ALTER TABLE ONLY public.attendance
  ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attendance
  ADD CONSTRAINT attendance_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attendance
  ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attendance
  ADD CONSTRAINT attendance_status_check CHECK (status = ANY (ARRAY['present'::text, 'late'::text, 'incomplete'::text, 'absent'::text]));

CREATE TABLE public.aufbewahrung_sperre (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  patient_id uuid,
  kategorie text NOT NULL,
  gesperrt_am timestamp with time zone DEFAULT now() NOT NULL,
  gesperrt_bis date NOT NULL,
  grundlage text NOT NULL,
  vorgang_id uuid
);
--   FK owner_id -> profiles(id)
--   FK patient_id -> leads(id)
ALTER TABLE ONLY public.aufbewahrung_sperre OWNER TO postgres;
COMMENT ON TABLE public.aufbewahrung_sperre IS 'Sperrvermerk Art. 17 Abs. 3 lit. b / Art. 18 DSGVO: aufbewahrungspflichtige Unterlagen bleiben gesperrt bis gesperrt_bis (frühestens). patient_id NULL = ganzes Konto (Fall B). Nur service_role. KHS K1.4, 02.10.2026.';

ALTER TABLE ONLY public.aufbewahrung_sperre
  ADD CONSTRAINT aufbewahrung_sperre_eindeutig UNIQUE NULLS NOT DISTINCT (owner_id, patient_id, kategorie);

ALTER TABLE ONLY public.aufbewahrung_sperre
  ADD CONSTRAINT aufbewahrung_sperre_kategorie_check CHECK (kategorie = ANY (ARRAY['behandlung'::text, 'einwilligung'::text, 'beleg'::text, 'grundaufzeichnung'::text, 'geschaeftsbrief'::text]));

ALTER TABLE ONLY public.aufbewahrung_sperre
  ADD CONSTRAINT aufbewahrung_sperre_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.aufbewahrung_sperre
  ADD CONSTRAINT aufbewahrung_sperre_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.aufbewahrung_sperre
  ADD CONSTRAINT aufbewahrung_sperre_pkey PRIMARY KEY (id);

CREATE TABLE public.ausfallrechnungen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  booking_id uuid,
  patient_id uuid,
  rechnung_nr bigint NOT NULL,
  reason text DEFAULT 'no_show'::text NOT NULL,
  amount_eur numeric(10,2) NOT NULL,
  leistung_datum timestamp with time zone,
  service_name text,
  status text DEFAULT 'offen'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid,
  bezahlt_at timestamp with time zone
);
--   FK booking_id -> bookings(id)
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
--   FK patient_id -> leads(id)
ALTER TABLE ONLY public.ausfallrechnungen OWNER TO postgres;
COMMENT ON TABLE public.ausfallrechnungen IS 'Private Ausfallhonorar-Rechnungen (Schadensersatz, umsatzsteuerfrei) für No-Shows und kurzfristige Absagen. Nicht GKV-relevant.';

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_amount_check CHECK (amount_eur > 0::numeric);

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_owner_id_rechnung_nr_key UNIQUE (owner_id, rechnung_nr);

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_reason_check CHECK (reason = ANY (ARRAY['no_show'::text, 'late_cancel'::text]));

ALTER TABLE ONLY public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_status_check CHECK (status = ANY (ARRAY['offen'::text, 'bezahlt'::text, 'storniert'::text, 'abgeschrieben'::text]));

CREATE TABLE public.b2b_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  company_name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  website text,
  status text DEFAULT 'prospect'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  source text,
  name text,
  category text,
  city text,
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.b2b_contacts OWNER TO postgres;

ALTER TABLE ONLY public.b2b_contacts
  ADD CONSTRAINT b2b_contacts_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.b2b_contacts
  ADD CONSTRAINT b2b_contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.b2b_contacts
  ADD CONSTRAINT b2b_contacts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.b2b_contacts
  ADD CONSTRAINT b2b_contacts_status_check CHECK (status = ANY (ARRAY['prospect'::text, 'contacted'::text, 'partner'::text, 'inactive'::text]));

CREATE TABLE public.belegliste (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  beleg_nr bigint NOT NULL,
  type text NOT NULL,
  amount_eur numeric(10,2) NOT NULL,
  patient_id uuid,
  prescription_id uuid,
  abrechnung_id uuid,
  reference_text text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid,
  storno_reason text,
  zahlart text,
  invoice_id uuid
);
--   FK abrechnung_id -> abrechnung(id)
--   FK created_by -> auth.users(id)
--   FK invoice_id -> invoices(id)
--   FK owner_id -> profiles(id)
--   FK patient_id -> leads(id)
--   FK prescription_id -> prescriptions(id)
ALTER TABLE ONLY public.belegliste OWNER TO postgres;
COMMENT ON COLUMN public.belegliste.zahlart IS 'Zahlungsart des Belegs: bar | ec | ueberweisung | sonstiges. NULL = Altbeleg vor v32.';
COMMENT ON COLUMN public.belegliste.invoice_id IS 'Bei type IN (''rechnung'',''storno''): die bar bezahlte Privatrechnung bzw. deren Gegenbuchung. Die Storno-Zeile braucht die Referenz ebenso, sonst ist der Kassenbuch-Saldo je Rechnung nicht rechenbar (Muster: prescription_id in saldoJeRezept). Bewusst KEIN CHECK darauf. Bank/EC erzeugen keine Beleglisten-Zeile, Ausbuchungen nie (kein Geldfluss).';

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_owner_id_beleg_nr_key UNIQUE (owner_id, beleg_nr);

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_type_check CHECK (type = ANY (ARRAY['zuzahlung'::text, 'barverkauf'::text, 'storno'::text, 'ausfall'::text, 'rechnung'::text]));

ALTER TABLE ONLY public.belegliste
  ADD CONSTRAINT belegliste_zahlart_check CHECK (zahlart IS NULL OR (zahlart = ANY (ARRAY['bar'::text, 'ec'::text, 'ueberweisung'::text, 'sonstiges'::text, 'paypal'::text])));

CREATE TABLE public.betriebsart_empfaenger (
  owner_id uuid NOT NULL,
  empfaenger_ik text NOT NULL,
  betriebsart text DEFAULT 'test'::text NOT NULL,
  zulassung_referenz text,
  zulassung_datum date,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid
);
--   FK owner_id -> auth.users(id)
--   FK updated_by -> profiles(id)
ALTER TABLE ONLY public.betriebsart_empfaenger OWNER TO postgres;
COMMENT ON TABLE public.betriebsart_empfaenger IS 'Ausnahmen der §302-Betriebsart je Paar (Praxis-Inhaber × Datenannahmestelle). Anlage 1 TP5 V21 Kap. 2 (1)(2), Kap. 3 (1) + Kap. 8, Anhang 2 zur Anlage 1 Kap. 9 § 1/§ 5/§ 6. Ohne Zeile gilt der Vorgabewert aus terapeut_zertifikat.';
COMMENT ON COLUMN public.betriebsart_empfaenger.empfaenger_ik IS 'Institutionskennzeichen der Datenannahmestelle (Empfaenger der Abrechnungsdatei).';
COMMENT ON COLUMN public.betriebsart_empfaenger.betriebsart IS 'test | erprobung | echt — steuert UNB-Testindikator (0/1/2) und Dateinamen (T/T/E) fuer diese Datenannahmestelle. Ueberschreibt terapeut_zertifikat.betriebsart.';
COMMENT ON COLUMN public.betriebsart_empfaenger.zulassung_referenz IS 'Aktenzeichen/Referenz der Zulassung zum Echtverfahren fuer diese Datenannahmestelle. Erteilt die KRANKENKASSE, nicht die Datenannahmestelle. Pflicht bei betriebsart echt.';
COMMENT ON COLUMN public.betriebsart_empfaenger.zulassung_datum IS 'Datum der schriftlichen Zulassung zum Echtverfahren fuer diese Datenannahmestelle.';

ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_betriebsart_chk CHECK (betriebsart = ANY (ARRAY['test'::text, 'erprobung'::text, 'echt'::text]));

ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_echt_braucht_zulassung_chk CHECK (betriebsart <> 'echt'::text OR btrim(COALESCE(zulassung_referenz, ''::text)) <> ''::text AND zulassung_datum IS NOT NULL);

ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_pkey PRIMARY KEY (owner_id, empfaenger_ik);

ALTER TABLE ONLY public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

CREATE TABLE public.booking_leistungen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  booking_id uuid NOT NULL,
  service_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  anzahl smallint DEFAULT 1 NOT NULL,
  sort_order smallint DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK booking_id -> bookings(id)
--   FK owner_id -> profiles(id)
--   FK service_id -> services(id)
ALTER TABLE ONLY public.booking_leistungen OWNER TO postgres;
COMMENT ON TABLE public.booking_leistungen IS 'Leistungen eines Termins. Zeile mit sort_order 0 ist die Hauptleistung und wird per Trigger nach bookings.service_id gespiegelt. Ops-Karte 235.';

ALTER TABLE ONLY public.booking_leistungen
  ADD CONSTRAINT booking_leistungen_anzahl_check CHECK (anzahl >= 1 AND anzahl <= 20);

ALTER TABLE ONLY public.booking_leistungen
  ADD CONSTRAINT booking_leistungen_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.booking_leistungen
  ADD CONSTRAINT booking_leistungen_booking_id_service_id_key UNIQUE (booking_id, service_id);

ALTER TABLE ONLY public.booking_leistungen
  ADD CONSTRAINT booking_leistungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id);

ALTER TABLE ONLY public.booking_leistungen
  ADD CONSTRAINT booking_leistungen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.booking_leistungen
  ADD CONSTRAINT booking_leistungen_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT;

CREATE TABLE public.booking_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  patient_id uuid,
  employee_id uuid,
  service_id uuid,
  payment_type text NOT NULL,
  preferred_date date,
  preferred_time time without time zone,
  session_count integer DEFAULT 1,
  krankenkasse text,
  arzt_name text,
  verordnung_datum date,
  icd10_diagnose text,
  behandlungsart text,
  verordnung_sitzungen integer,
  frequenz text,
  verordnung_typ text,
  doppelbehandlung boolean DEFAULT false,
  pkv_versicherung text,
  arzt_ueberweisung boolean DEFAULT false,
  arzt_ueberweisung_name text,
  bg_aktenzeichen text,
  bg_name text,
  unfalldatum date,
  durchgangsarzt text,
  notizen text,
  status text DEFAULT 'pending'::text,
  auto_approved boolean DEFAULT false,
  booking_id uuid,
  dsgvo_consent boolean DEFAULT false NOT NULL,
  consent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  diagnosegruppe text,
  alternativ_termine jsonb,
  alternativ_angeboten_at timestamp with time zone,
  booking_ids jsonb
);
--   FK employee_id -> profiles(id)
--   FK owner_id -> profiles(id)
--   FK patient_id -> patients(id)
--   FK service_id -> services(id)
ALTER TABLE ONLY public.booking_requests OWNER TO postgres;
COMMENT ON COLUMN public.booking_requests.diagnosegruppe IS 'Diagnosegruppe aus dem Heilmittelkatalog (z. B. WS2, EX3, SP6), vom Patienten aus dem Rezept übernommen. Optional.';
COMMENT ON COLUMN public.booking_requests.alternativ_termine IS 'Der Praxis angebotene Ersatztermine: [{date,time,employee_id}]. Der Patient nimmt einen davon per Link aus der E-Mail an.';
COMMENT ON COLUMN public.booking_requests.alternativ_angeboten_at IS 'Wann das Gegenangebot verschickt wurde. NULL = kein Gegenangebot offen. Geht auch in das HMAC der Annehmen-Links ein, damit ein zweites Angebot die Links des ersten entwertet.';
COMMENT ON COLUMN public.booking_requests.booking_ids IS 'Alle aus dieser Anfrage entstandenen Termine (auch die Folgetermine einer Serie). Wird beim Stornieren gebraucht.';

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id);

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_notizen_check CHECK (char_length(notizen) <= 500);

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_payment_type_check CHECK (payment_type = ANY (ARRAY['gkv'::text, 'pkv'::text, 'selbstzahler'::text, 'bg'::text]));

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text]));

ALTER TABLE ONLY public.booking_requests
  ADD CONSTRAINT booking_requests_verordnung_typ_check CHECK (verordnung_typ = ANY (ARRAY['erst'::text, 'folge'::text]));

CREATE TABLE public.booking_status_korrekturen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  booking_id uuid NOT NULL,
  alter_status text NOT NULL,
  neuer_status text NOT NULL,
  grund text NOT NULL,
  geaendert_von uuid,
  geaendert_am timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--   FK booking_id -> bookings(id)
--   FK geaendert_von -> auth.users(id)
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.booking_status_korrekturen OWNER TO postgres;

ALTER TABLE ONLY public.booking_status_korrekturen
  ADD CONSTRAINT booking_status_korrekturen_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.booking_status_korrekturen
  ADD CONSTRAINT booking_status_korrekturen_geaendert_von_fkey FOREIGN KEY (geaendert_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.booking_status_korrekturen
  ADD CONSTRAINT booking_status_korrekturen_grund_check CHECK (length(btrim(grund)) >= 3);

ALTER TABLE ONLY public.booking_status_korrekturen
  ADD CONSTRAINT booking_status_korrekturen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.booking_status_korrekturen
  ADD CONSTRAINT booking_status_korrekturen_pkey PRIMARY KEY (id);

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
  no_show_session_links jsonb DEFAULT '[]'::jsonb NOT NULL
);
--   FK business_id -> businesses(id)
--   FK group_parent_id -> bookings(id)
--   FK lead_id -> leads(id)
--   FK owner_id -> auth.users(id)
--   FK service_id -> services(id)
--   FK user_id -> auth.users(id)
--   FK vehicle_id -> vehicles(id)
--   FK verordnung_id -> prescriptions(id)
ALTER TABLE ONLY public.bookings OWNER TO postgres;
COMMENT ON TABLE public.bookings IS 'RLS: user_id (employee self-access) + owner_id (owner and team access) policies both active.';
COMMENT ON COLUMN public.bookings.verordnung_id IS 'Podologie-Topf: zu welcher `verordnungen`-Zeile gehoert dieser Termin. NIEMALS eine prescriptions.id — der Physio-Topf verknuepft ueber prescription_sessions.booking_id.';
COMMENT ON COLUMN public.bookings.dauer_quelle IS 'Herkunft der Termindauer. NULL = nicht erfasst (Altbestand, Backend-Wege). ''vorschlag'' = Vorschlag unveraendert uebernommen. ''manuell'' = im Dauer-Feld von Hand eingetippt/geaendert — NUR diese Zeilen speisen gelernteDauer() in module/termin-dauer.js. ''serie'' = aus einem Serien-/Batch-Lauf uebernommen, zaehlt nicht als Beleg.';
COMMENT ON COLUMN public.bookings.cancelled_at IS 'Zeitpunkt der Absage ab #192; bei vorher bereits abgesagten Terminen unbekannt (NULL).';
COMMENT ON COLUMN public.bookings.cancelled_session_links IS 'Historische Zuordnung geplanter Sitzungen, die bei Absage wieder freigegeben wurden. Kein Sitzungszähler.';
COMMENT ON COLUMN public.bookings.no_show_session_links IS 'Rückfahrkarte: geplante prescription_sessions, die beim no_show freigegeben wurden. Kein Sitzungszähler. Gegenstück zu cancelled_session_links (#192), aber vom Anwendungscode geschrieben.';

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_dauer_quelle_check CHECK (dauer_quelle IS NULL OR (dauer_quelle = ANY (ARRAY['vorschlag'::text, 'manuell'::text, 'serie'::text])));

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_fahrt_status_check CHECK (fahrt_status = ANY (ARRAY['fahrt_started'::text, 'fahrt_arrived'::text, 'fahrt_return_pending'::text, 'fahrt_completed'::text]));

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_group_parent_id_fkey FOREIGN KEY (group_parent_id) REFERENCES bookings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id);

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'completed'::text, 'pending'::text, 'no_show'::text]));

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_verordnung_id_fkey FOREIGN KEY (verordnung_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (user_id WITH =, tstzrange(start_time, end_time, '[)'::text) WITH &&) WHERE (status = 'confirmed'::text AND group_parent_id IS NULL);

CREATE TABLE public.breaks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK user_id -> profiles(id)
ALTER TABLE ONLY public.breaks OWNER TO postgres;

ALTER TABLE ONLY public.breaks
  ADD CONSTRAINT breaks_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.breaks
  ADD CONSTRAINT breaks_day_of_week_check CHECK (day_of_week >= 0 AND day_of_week <= 6);

ALTER TABLE ONLY public.breaks
  ADD CONSTRAINT breaks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.breaks
  ADD CONSTRAINT breaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

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
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.businesses OWNER TO postgres;
COMMENT ON COLUMN public.businesses.closed_days IS 'Haftanın kapalı günleri. JS getDay() konvansiyonu: 0=Pazar, 1=Pzt, ..., 6=Cumartesi. Boş array = her gün açık.';
COMMENT ON COLUMN public.businesses.ausfall_enabled IS 'Ausfallgebühr aktiv: bei No-Show/kurzfristiger Absage kann eine private Ausfallrechnung erstellt werden';
COMMENT ON COLUMN public.businesses.ausfall_cutoff_hours IS 'Absagefrist in Stunden — spätere Absagen gelten als Ausfall';
COMMENT ON COLUMN public.businesses.ausfall_hinweis IS 'Eigener Hinweistext auf der Ausfallrechnung (z.B. Verweis auf die Ausfallvereinbarung)';

ALTER TABLE ONLY public.businesses
  ADD CONSTRAINT businesses_ausfall_mode_check CHECK (ausfall_mode = ANY (ARRAY['fixed'::text, 'percent'::text]));

ALTER TABLE ONLY public.businesses
  ADD CONSTRAINT businesses_booking_slug_key UNIQUE (booking_slug);

ALTER TABLE ONLY public.businesses
  ADD CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.businesses
  ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);

CREATE TABLE public.calendar_integrations (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  calendar_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.calendar_integrations OWNER TO postgres;

ALTER TABLE ONLY public.calendar_integrations
  ADD CONSTRAINT calendar_integrations_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_integrations
  ADD CONSTRAINT calendar_integrations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.calendar_integrations
  ADD CONSTRAINT calendar_integrations_provider_check CHECK (provider = ANY (ARRAY['google'::text, 'apple'::text]));

ALTER TABLE ONLY public.calendar_integrations
  ADD CONSTRAINT calendar_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.calendar_integrations
  ADD CONSTRAINT calendar_integrations_user_id_provider_key UNIQUE (user_id, provider);

CREATE TABLE public.chatbot_usage (
  id bigint GENERATED BY DEFAULT AS IDENTITY (START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  owner_id uuid,
  origin text,
  session_id text,
  model text,
  deployment text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_eur numeric(10,6),
  off_topic boolean,
  status text,
  error text,
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.chatbot_usage OWNER TO postgres;

ALTER TABLE ONLY public.chatbot_usage
  ADD CONSTRAINT chatbot_usage_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chatbot_usage
  ADD CONSTRAINT chatbot_usage_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chatbot_usage
  ADD CONSTRAINT chatbot_usage_pkey PRIMARY KEY (id);

CREATE TABLE public.consent_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  pending_id uuid,
  consent_type text NOT NULL,
  version text NOT NULL,
  ip_address inet,
  user_agent text,
  accepted_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK user_id -> profiles(id)
ALTER TABLE ONLY public.consent_log OWNER TO postgres;
COMMENT ON TABLE public.consent_log IS 'DSGVO/TTDSG consent audit trail. Required to prove pre-processing consent (AVV/AGB/Datenschutz).';

ALTER TABLE ONLY public.consent_log
  ADD CONSTRAINT consent_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.consent_log
  ADD CONSTRAINT consent_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

CREATE TABLE public.custom_days (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  owner_id uuid,
  date date NOT NULL,
  type text NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  start_time time without time zone,
  end_time time without time zone,
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.custom_days OWNER TO postgres;

ALTER TABLE ONLY public.custom_days
  ADD CONSTRAINT custom_days_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.custom_days
  ADD CONSTRAINT custom_days_owner_id_date_key UNIQUE (owner_id, date);

ALTER TABLE ONLY public.custom_days
  ADD CONSTRAINT custom_days_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.custom_days
  ADD CONSTRAINT custom_days_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.custom_days
  ADD CONSTRAINT custom_days_type_check CHECK (type = ANY (ARRAY['closed'::text, 'holiday'::text, 'special'::text]));

CREATE TABLE public.data_access_log (
  id bigint DEFAULT nextval('data_access_log_id_seq'::regclass) NOT NULL,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  owner_id uuid,
  business_id uuid,
  ip inet,
  user_agent text,
  method text NOT NULL,
  path text NOT NULL,
  resource text,
  resource_id text,
  action text,
  status_code integer,
  duration_ms integer,
  metadata jsonb
);
ALTER TABLE ONLY public.data_access_log OWNER TO postgres;
COMMENT ON TABLE public.data_access_log IS 'DSGVO Art. 32 access audit trail. 12 month retention.';

ALTER TABLE ONLY public.data_access_log
  ADD CONSTRAINT data_access_log_pkey PRIMARY KEY (id);

CREATE TABLE public.data_sharing_settings (
  owner_id uuid NOT NULL,
  patients boolean DEFAULT false NOT NULL,
  services boolean DEFAULT false NOT NULL,
  activities boolean DEFAULT false NOT NULL,
  finance boolean DEFAULT false NOT NULL,
  appointments boolean DEFAULT false NOT NULL,
  network boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.data_sharing_settings OWNER TO postgres;
COMMENT ON TABLE public.data_sharing_settings IS 'Per-owner toggle: which data categories are shared across all Standorte (true) vs separate per business (false). Missing row = all false (separate).';

ALTER TABLE ONLY public.data_sharing_settings
  ADD CONSTRAINT data_sharing_settings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.data_sharing_settings
  ADD CONSTRAINT data_sharing_settings_pkey PRIMARY KEY (owner_id);

CREATE TABLE public.datenaustausch_zaehler (
  absender_ik text NOT NULL,
  empfaenger_ik text NOT NULL,
  owner_id uuid,
  letzte_referenz bigint DEFAULT 0 NOT NULL,
  letzte_transfernummer integer DEFAULT 0 NOT NULL,
  aktualisiert_am timestamp with time zone DEFAULT now() NOT NULL
);
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.datenaustausch_zaehler OWNER TO postgres;
COMMENT ON TABLE public.datenaustausch_zaehler IS 'Dauerhafte §302-Zaehler je Paar (Absender-IK, Empfaenger-IK). Wird ausschliesslich ueber die drei SECURITY-DEFINER-Funktionen unten angefasst — kein Client, kein PostgREST.';
COMMENT ON COLUMN public.datenaustausch_zaehler.owner_id IS 'Herkunftsvermerk, nicht Teil des Schluessels: fortlaufend ist die Folge je IK-Paar, nicht je Konto. Fällt das Profil weg, bleibt der Zählerstand per ON DELETE SET NULL stehen (die Folge an der IK darf nie zurueckgehen).';
COMMENT ON COLUMN public.datenaustausch_zaehler.letzte_referenz IS 'Monoton, ohne Jahresruecksetzung, ohne Obergrenze. Der 5-stellige UNB-Wert entsteht daraus erst bei der Ausgabe (((n-1) %% 99999) + 1) — so ueberlaeuft das SPEZIFIKATIONSFELD bei 99999, die HISTORIE aber nicht.';
COMMENT ON COLUMN public.datenaustausch_zaehler.letzte_transfernummer IS 'Eigener Zaehler, 0..999 im Kreis (GGT Anlage 2, Feld TRANSFER_NUMMER: ab 999 wieder auf 0). Ausdruecklich ohne Bezug zur Datenaustauschreferenz (Anhang 1 § 4.3).';

ALTER TABLE ONLY public.datenaustausch_zaehler
  ADD CONSTRAINT datenaustausch_zaehler_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.datenaustausch_zaehler
  ADD CONSTRAINT datenaustausch_zaehler_pkey PRIMARY KEY (absender_ik, empfaenger_ik);

CREATE TABLE public.demo_bookings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  company text,
  message text,
  booking_date date NOT NULL,
  booking_time text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'confirmed'::text NOT NULL,
  reschedule_token uuid DEFAULT gen_random_uuid() NOT NULL,
  google_event_id text
);
ALTER TABLE ONLY public.demo_bookings OWNER TO postgres;

ALTER TABLE ONLY public.demo_bookings
  ADD CONSTRAINT demo_bookings_pkey PRIMARY KEY (id);

CREATE TABLE public.diagnosegruppen (
  code text NOT NULL,
  label text NOT NULL,
  untergruppen text[],
  icd10_codes text[],
  icd10_pflicht text,
  befundung_erlaubt boolean DEFAULT true,
  nagelspange_erlaubt boolean DEFAULT false,
  lokalisation_pflicht boolean DEFAULT false,
  bereich text,
  indikation text,
  leitsymptomatik text,
  hoechstmenge integer,
  icd_ranges text[],
  sort integer DEFAULT 0,
  aktiv boolean DEFAULT true,
  icd_accept jsonb DEFAULT '[]'::jsonb NOT NULL,
  icd_exclude jsonb DEFAULT '[]'::jsonb NOT NULL,
  icd_auto_select jsonb DEFAULT '[]'::jsonb NOT NULL,
  icd_accept_unsicher jsonb DEFAULT '[]'::jsonb NOT NULL,
  icd_enforcement text DEFAULT 'warn'::text NOT NULL
);
ALTER TABLE ONLY public.diagnosegruppen OWNER TO postgres;

ALTER TABLE ONLY public.diagnosegruppen
  ADD CONSTRAINT diagnosegruppen_pkey PRIMARY KEY (code);

CREATE TABLE public.document_vorlagen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  vorlage_type text NOT NULL,
  name text NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  content_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK business_id -> businesses(id)
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.document_vorlagen OWNER TO postgres;

ALTER TABLE ONLY public.document_vorlagen
  ADD CONSTRAINT document_vorlagen_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_vorlagen
  ADD CONSTRAINT document_vorlagen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.document_vorlagen
  ADD CONSTRAINT document_vorlagen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.document_vorlagen
  ADD CONSTRAINT document_vorlagen_vorlage_type_check CHECK (vorlage_type = ANY (ARRAY['quittung_zuzahlung'::text, 'rechnung_bg'::text, 'rechnung_privat'::text, 'rechnung_eigenanteil'::text, 'rechnung_selbstzahler'::text, 'rechnung_sonder'::text, 'rezeptvorderseite'::text, 'rzg_quittung'::text, 'rechnung_ausfall'::text]));

CREATE TABLE public.dta_schluessel (
  id bigint DEFAULT nextval('dta_schluessel_id_seq'::regclass) NOT NULL,
  schluessel_typ text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  leistungsbereich text,
  notes text,
  source_version text DEFAULT 'Anlage 3 V22'::text NOT NULL,
  valid_from date,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.dta_schluessel OWNER TO postgres;

ALTER TABLE ONLY public.dta_schluessel
  ADD CONSTRAINT dta_schluessel_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dta_schluessel
  ADD CONSTRAINT dta_schluessel_schluessel_typ_code_source_version_key UNIQUE (schluessel_typ, code, source_version);

CREATE TABLE public.email_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  contact_id uuid,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'sent'::text NOT NULL,
  gmail_thread_id text,
  created_at timestamp with time zone DEFAULT now(),
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK contact_id -> b2b_contacts(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.email_logs OWNER TO postgres;

ALTER TABLE ONLY public.email_logs
  ADD CONSTRAINT email_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_logs
  ADD CONSTRAINT email_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES b2b_contacts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_logs
  ADD CONSTRAINT email_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_logs
  ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_logs
  ADD CONSTRAINT email_logs_status_check CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'failed'::text]));

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
ALTER TABLE ONLY public.empfaenger_zertifikate OWNER TO postgres;
COMMENT ON TABLE public.empfaenger_zertifikate IS 'Öffentliche X.509-Verschlüsselungszertifikate der Annahmestellen (ITSG/GKV) zur Erzeugung von CMS EnvelopedData (§302 SECON). Globale Referenztabelle wie kostentraeger_anschriften; Befüllung nur per Admin-Ladescript.';
COMMENT ON COLUMN public.empfaenger_zertifikate.ik IS 'Institutionskennzeichen (IK) der Datenannahmestelle (9-stellig).';
COMMENT ON COLUMN public.empfaenger_zertifikate.zertifikat_der IS 'Vollständiges X.509v3-Zertifikat in binärer DER-Kodierung.';
COMMENT ON COLUMN public.empfaenger_zertifikate.fingerprint_sha256 IS 'SHA-256-Fingerprint des DER-Zertifikats (hexadezimal, mit ITSG-Veröffentlichung abgeglichen).';
COMMENT ON COLUMN public.empfaenger_zertifikate.gueltig_von IS 'Gültigkeitsbeginn des Zertifikats (notBefore).';
COMMENT ON COLUMN public.empfaenger_zertifikate.gueltig_bis IS 'Gültigkeitsende des Zertifikats (notAfter).';
COMMENT ON COLUMN public.empfaenger_zertifikate.quelle IS 'Herkunftsnachweis (z. B. ITSG Trust Center Annahmeliste annahme-rsa4096.key).';
COMMENT ON COLUMN public.empfaenger_zertifikate.quelle_datum IS 'Datum des Abgleichs bzw. der Veröffentlichung der Quelle.';
COMMENT ON COLUMN public.empfaenger_zertifikate.onaylayan IS 'Signaturprüfer / Administrator-Pseudonym (CLAUDE.md: keine Personennamen, nur Rollen-/Kürzel).';
COMMENT ON COLUMN public.empfaenger_zertifikate.hochgeladen_am IS 'Zeitstempel des Datenbank-Imports.';

ALTER TABLE ONLY public.empfaenger_zertifikate
  ADD CONSTRAINT empfaenger_zertifikate_pkey PRIMARY KEY (ik);

CREATE TABLE public.employee_business_assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  employee_id uuid NOT NULL,
  business_id uuid NOT NULL,
  group_id uuid,
  created_at timestamp with time zone DEFAULT now()
);
--   FK business_id -> businesses(id)
--   FK employee_id -> profiles(id)
--   FK group_id -> employee_groups(id)
ALTER TABLE ONLY public.employee_business_assignments OWNER TO postgres;

ALTER TABLE ONLY public.employee_business_assignments
  ADD CONSTRAINT employee_business_assignments_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_business_assignments
  ADD CONSTRAINT employee_business_assignments_employee_id_business_id_key UNIQUE (employee_id, business_id);

ALTER TABLE ONLY public.employee_business_assignments
  ADD CONSTRAINT employee_business_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_business_assignments
  ADD CONSTRAINT employee_business_assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES employee_groups(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.employee_business_assignments
  ADD CONSTRAINT employee_business_assignments_pkey PRIMARY KEY (id);

CREATE TABLE public.employee_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
--   FK business_id -> businesses(id)
ALTER TABLE ONLY public.employee_groups OWNER TO postgres;

ALTER TABLE ONLY public.employee_groups
  ADD CONSTRAINT employee_groups_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_groups
  ADD CONSTRAINT employee_groups_business_id_name_key UNIQUE (business_id, name);

ALTER TABLE ONLY public.employee_groups
  ADD CONSTRAINT employee_groups_pkey PRIMARY KEY (id);

CREATE TABLE public.employee_scope_overrides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  employee_id uuid NOT NULL,
  business_id uuid NOT NULL,
  module text NOT NULL,
  has_access boolean NOT NULL
);
--   FK business_id -> businesses(id)
--   FK employee_id -> profiles(id)
ALTER TABLE ONLY public.employee_scope_overrides OWNER TO postgres;

ALTER TABLE ONLY public.employee_scope_overrides
  ADD CONSTRAINT employee_scope_overrides_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_scope_overrides
  ADD CONSTRAINT employee_scope_overrides_employee_id_business_id_module_key UNIQUE (employee_id, business_id, module);

ALTER TABLE ONLY public.employee_scope_overrides
  ADD CONSTRAINT employee_scope_overrides_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_scope_overrides
  ADD CONSTRAINT employee_scope_overrides_pkey PRIMARY KEY (id);

CREATE TABLE public.employee_services (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  employee_id uuid NOT NULL,
  service_id uuid NOT NULL,
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK employee_id -> auth.users(id)
--   FK service_id -> services(id)
ALTER TABLE ONLY public.employee_services OWNER TO postgres;

ALTER TABLE ONLY public.employee_services
  ADD CONSTRAINT employee_services_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.employee_services
  ADD CONSTRAINT employee_services_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.employee_services
  ADD CONSTRAINT employee_services_employee_id_service_id_key UNIQUE (employee_id, service_id);

ALTER TABLE ONLY public.employee_services
  ADD CONSTRAINT employee_services_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.employee_services
  ADD CONSTRAINT employee_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

CREATE TABLE public.fahrten (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  lead_id uuid,
  vehicle_id uuid,
  kennzeichen_snapshot text,
  kind_snapshot text,
  start_km integer,
  end_km integer,
  distance_km integer GENERATED ALWAYS AS (
CASE
    WHEN ((end_km IS NOT NULL) AND (end_km >= start_km)) THEN (end_km - start_km)
    ELSE NULL::integer
END) STORED,
  estimated_duration_min integer,
  fahrt_started_at timestamp with time zone DEFAULT now() NOT NULL,
  fahrt_arrived_at timestamp with time zone,
  fahrt_ended_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  business_id uuid,
  zweck text,
  abfahrtsort text,
  zielort text
);
--   FK booking_id -> bookings(id)
--   FK business_id -> businesses(id)
--   FK lead_id -> leads(id)
--   FK user_id -> auth.users(id)
--   FK vehicle_id -> vehicles(id)
ALTER TABLE ONLY public.fahrten OWNER TO postgres;

ALTER TABLE ONLY public.fahrten
  ADD CONSTRAINT fahrten_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fahrten
  ADD CONSTRAINT fahrten_booking_id_key UNIQUE (booking_id);

ALTER TABLE ONLY public.fahrten
  ADD CONSTRAINT fahrten_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fahrten
  ADD CONSTRAINT fahrten_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fahrten
  ADD CONSTRAINT fahrten_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fahrten
  ADD CONSTRAINT fahrten_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fahrten
  ADD CONSTRAINT fahrten_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

CREATE TABLE public.fahrten_aenderungen (
  id bigint GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1) NOT NULL,
  fahrt_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  fahrer_id uuid,
  op text NOT NULL,
  alt jsonb NOT NULL,
  neu jsonb,
  geaendert_von uuid,
  geaendert_am timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.fahrten_aenderungen OWNER TO postgres;
COMMENT ON TABLE public.fahrten_aenderungen IS 'Fahrtenbuch-Änderungsprotokoll (BMF 18.11.2009): nachträgliche Änderungen abgeschlossener Fahrten und jede Löschung mit altem/neuem Wert, Benutzer, Zeit. Append-only, nur per Trigger beschrieben; ohne FK, damit die Spur Fahrt und Konto überlebt.';

ALTER TABLE ONLY public.fahrten_aenderungen
  ADD CONSTRAINT fahrten_aenderungen_op_check CHECK (op = ANY (ARRAY['UPDATE'::text, 'DELETE'::text]));

ALTER TABLE ONLY public.fahrten_aenderungen
  ADD CONSTRAINT fahrten_aenderungen_pkey PRIMARY KEY (id);

CREATE TABLE public.feedbacks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  owner_id uuid,
  type text DEFAULT 'feedback'::text NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'open'::text NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK owner_id -> profiles(id)
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.feedbacks OWNER TO postgres;

ALTER TABLE ONLY public.feedbacks
  ADD CONSTRAINT feedbacks_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.feedbacks
  ADD CONSTRAINT feedbacks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.feedbacks
  ADD CONSTRAINT feedbacks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.feedbacks
  ADD CONSTRAINT feedbacks_priority_check CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]));

ALTER TABLE ONLY public.feedbacks
  ADD CONSTRAINT feedbacks_status_check CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]));

ALTER TABLE ONLY public.feedbacks
  ADD CONSTRAINT feedbacks_type_check CHECK (type = ANY (ARRAY['bug'::text, 'feature_request'::text, 'feedback'::text, 'support'::text]));

ALTER TABLE ONLY public.feedbacks
  ADD CONSTRAINT feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE public.group_scopes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  module text NOT NULL,
  has_access boolean DEFAULT true NOT NULL
);
--   FK group_id -> employee_groups(id)
ALTER TABLE ONLY public.group_scopes OWNER TO postgres;

ALTER TABLE ONLY public.group_scopes
  ADD CONSTRAINT group_scopes_group_id_fkey FOREIGN KEY (group_id) REFERENCES employee_groups(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_scopes
  ADD CONSTRAINT group_scopes_group_id_module_key UNIQUE (group_id, module);

ALTER TABLE ONLY public.group_scopes
  ADD CONSTRAINT group_scopes_pkey PRIMARY KEY (id);

CREATE TABLE public.heilmittel_catalog (
  hpnr text NOT NULL,
  leistung text NOT NULL,
  leistungsart text,
  heilmittelbereich text DEFAULT 'Podologie'::text NOT NULL,
  grundlage text,
  verguetung_gkv numeric(8,2),
  gueltig_ab date NOT NULL,
  gueltig_bis date DEFAULT '9999-12-31'::date NOT NULL,
  aktiv boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.heilmittel_catalog OWNER TO postgres;
COMMENT ON TABLE public.heilmittel_catalog IS 'VERALTET / UNBENUTZT (Stand 2026-07-26). Enthält abgelöste Ross-Fraser-Positionen als unbegrenzt gültig. Auswahlquelle ist heilmittel_katalog.';

ALTER TABLE ONLY public.heilmittel_catalog
  ADD CONSTRAINT heilmittel_catalog_pkey PRIMARY KEY (hpnr);

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
ALTER TABLE ONLY public.heilmittel_katalog OWNER TO postgres;
COMMENT ON TABLE public.heilmittel_katalog IS 'Generiert aus api-backend/billing/codes/*.js via sync_heilmittel_katalog.js. Nicht von Hand bearbeiten — Änderungen gehen in die Codedateien.';

ALTER TABLE ONLY public.heilmittel_katalog
  ADD CONSTRAINT heilmittel_katalog_pkey PRIMARY KEY (bereich, code, gueltig_ab);

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
ALTER TABLE ONLY public.heilmittel_position OWNER TO postgres;
COMMENT ON TABLE public.heilmittel_position IS 'VERALTET / UNBENUTZT (Stand 2026-07-26). Auswahlquelle ist heilmittel_katalog.';

ALTER TABLE ONLY public.heilmittel_position
  ADD CONSTRAINT heilmittel_position_pkey PRIMARY KEY (positionsnummer);

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
--   FK kostentraeger_ik -> kostentraeger(ik)
ALTER TABLE ONLY public.heilmittel_tarif OWNER TO postgres;

ALTER TABLE ONLY public.heilmittel_tarif
  ADD CONSTRAINT heilmittel_tarif_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik) ON DELETE CASCADE;

ALTER TABLE ONLY public.heilmittel_tarif
  ADD CONSTRAINT heilmittel_tarif_pkey PRIMARY KEY (id);

CREATE TABLE public.icd_sector_ranges (
  bereich text NOT NULL,
  gte text NOT NULL,
  lt text NOT NULL,
  label text,
  sort integer DEFAULT 0
);
ALTER TABLE ONLY public.icd_sector_ranges OWNER TO postgres;

ALTER TABLE ONLY public.icd_sector_ranges
  ADD CONSTRAINT icd_sector_ranges_pkey PRIMARY KEY (bereich, gte, lt);

CREATE TABLE public.icd10_titles (
  code text NOT NULL,
  titel text NOT NULL,
  kapitel smallint,
  ebene smallint,
  terminal boolean,
  code_plain text,
  gruppe text
);
ALTER TABLE ONLY public.icd10_titles OWNER TO postgres;

ALTER TABLE ONLY public.icd10_titles
  ADD CONSTRAINT icd10_titles_pkey PRIMARY KEY (code);

CREATE TABLE public.invoices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  patient_id uuid,
  patient_name text NOT NULL,
  line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
  subtotal numeric(10,2),
  eigenanteil_pct numeric(5,2) DEFAULT 0,
  eigenanteil_eur numeric(10,2) DEFAULT 0,
  kassenzuzahlung numeric(10,2) DEFAULT 0,
  total_patient numeric(10,2),
  status text DEFAULT 'draft'::text,
  invoice_number text,
  issued_at date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  prescription_id uuid,
  business_id uuid,
  payment_status text DEFAULT 'pending'::text,
  payment_method text,
  paid_at timestamp with time zone,
  lead_id uuid,
  invoice_type text,
  verordnung_id uuid,
  steuer_status text,
  tax_summary jsonb DEFAULT '[]'::jsonb NOT NULL,
  netto_gesamt numeric(10,2),
  steuer_gesamt numeric(10,2),
  brutto_gesamt numeric(10,2),
  steuerhinweis_text text,
  steuernummer_snapshot text,
  ust_id_snapshot text,
  leistung_von date,
  leistung_bis date,
  rechnung_nr bigint,
  storno_grund text,
  storno_am date
);
--   FK business_id -> businesses(id)
--   FK lead_id -> leads(id)
--   FK owner_id -> auth.users(id)
--   FK patient_id -> leads(id)
--   FK prescription_id -> prescriptions(id)
--   FK verordnung_id -> prescriptions(id)
ALTER TABLE ONLY public.invoices OWNER TO postgres;
COMMENT ON COLUMN public.invoices.prescription_id IS 'Linked Muster-13/Blanko prescription (multi-prescription patients). Set automatically when invoice is created from a physio workflow.';
COMMENT ON COLUMN public.invoices.invoice_type IS 'gkv = GKV Abrechnung (fixed tariff + Zuzahlung), privat = Privatrechnung (practice prices, no Zuzahlung)';
COMMENT ON COLUMN public.invoices.verordnung_id IS 'Podologie-Verordnung (verordnungen.id). Gegenstueck zu prescription_id fuer den Physio/Ergo/Logo-Topf. Es ist immer hoechstens eines von beiden gesetzt.';
COMMENT ON COLUMN public.invoices.tax_summary IS 'Eingefrorene Aufschluesselung je Steuersatz/Befreiung (§ 14 Abs. 4 Nr. 7 UStG): [{satz, grund, netto, steuer, brutto}].';
COMMENT ON COLUMN public.invoices.steuerhinweis_text IS 'Wortlaut des gedruckten Steuerhinweises, eingefroren. Nicht zur Druckzeit aus profiles lesen — sonst druckt dieselbe Rechnung in zwei Jahren anders (GoBD Rz. 107 ff., § 146 Abs. 4 AO).';
COMMENT ON COLUMN public.invoices.steuernummer_snapshot IS 'Steuernummer der Praxis zum Zeitpunkt der Rechnungsstellung (Snapshot, § 14 Abs. 4 Nr. 2 UStG).';

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_ein_verordnungsbezug CHECK (prescription_id IS NULL OR verordnung_id IS NULL);

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_invoice_type_check CHECK (invoice_type IS NULL OR (invoice_type = ANY (ARRAY['gkv'::text, 'privat'::text, 'selbstzahler'::text, 'bg'::text])));

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_owner_invoice_number_unique UNIQUE (owner_id, invoice_number);
COMMENT ON CONSTRAINT invoices_owner_invoice_number_unique ON public.invoices IS 'Prevents duplicate invoice numbers per tenant (GoBD sequential uniqueness); NULL invoice_number allowed for drafts (Postgres treats NULLs as distinct).';

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id);

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_payment_method_check CHECK (payment_method = ANY (ARRAY['bar'::text, 'karte'::text, 'lastschrift'::text, 'ueberweisung'::text, 'sonstiges'::text]));

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_payment_status_check CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text]));

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_status_check CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'paid'::text, 'cancelled'::text]));

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_steuer_status_check CHECK (steuer_status IS NULL OR (steuer_status = ANY (ARRAY['regel'::text, 'kleinunternehmer'::text])));

ALTER TABLE ONLY public.invoices
  ADD CONSTRAINT invoices_verordnung_id_fkey FOREIGN KEY (verordnung_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

CREATE TABLE public.kiosk_pins (
  user_id uuid NOT NULL,
  pin_hash text NOT NULL,
  failed_attempts integer DEFAULT 0 NOT NULL,
  locked_until timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK user_id -> profiles(id)
ALTER TABLE ONLY public.kiosk_pins OWNER TO postgres;
COMMENT ON TABLE public.kiosk_pins IS 'Kiosk-PIN als scrypt-Hash (Node crypto.scrypt, keine externe Abhaengigkeit). Kein RLS-Policy = kein Zugriff fuer anon/authenticated; Pruefung laeuft ausschliesslich ueber api-backend POST /api/kiosk/pin/verify.';

ALTER TABLE ONLY public.kiosk_pins
  ADD CONSTRAINT kiosk_pins_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.kiosk_pins
  ADD CONSTRAINT kiosk_pins_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

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
ALTER TABLE ONLY public.kostentraeger OWNER TO postgres;
COMMENT ON COLUMN public.kostentraeger.das_ik IS 'VERALTET - nicht mehr lesen. Eine einzelne DAS-IK ist fachlich falsch: die Datenannahmestelle haengt von Abrechnungscode UND Bundesland ab. Quelle ist kostentraeger_annahmestellen.';
COMMENT ON COLUMN public.kostentraeger.abrechnender_kt_ik IS 'VKG-Verknuepfungsart 01: IK der Versichertenkarte -> abrechnender Kostentraeger. NULL = dieser IK rechnet selbst ab.';

ALTER TABLE ONLY public.kostentraeger
  ADD CONSTRAINT kostentraeger_datensatz_status_check CHECK (datensatz_status = ANY (ARRAY['echt'::text, 'mock_unbestaetigt'::text]));

ALTER TABLE ONLY public.kostentraeger
  ADD CONSTRAINT kostentraeger_payer_type_check CHECK (payer_type = ANY (ARRAY['gkv'::text, 'sonst'::text, 'privat'::text]));

ALTER TABLE ONLY public.kostentraeger
  ADD CONSTRAINT kostentraeger_pkey PRIMARY KEY (ik);

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
--   FK kostentraeger_ik -> kostentraeger(ik)
ALTER TABLE ONLY public.kostentraeger_annahmestellen OWNER TO postgres;
COMMENT ON TABLE public.kostentraeger_annahmestellen IS 'VKG-Segmente der TP5-Kostentraegerdatei. Aufloesung "wohin sende ich die 302-Datei" = (kostentraeger_ik, abrechnungscode, art_datenlieferung, bundesland).';
COMMENT ON COLUMN public.kostentraeger_annahmestellen.verknuepfungsart IS '01=Verweis auf abrechnenden Kostentraeger · 02=DAS ohne Entschluesselungsbefugnis · 03=DAS mit Entschluesselungsbefugnis · 09=Papierannahmestelle (Anhang 3 Anlage 1 TP5, Abschnitt 5)';
COMMENT ON COLUMN public.kostentraeger_annahmestellen.abrechnungscode IS 'Schluessel Abrechnungscode, Anhang 3 Anlage 1 TP5 §8.14. Fuer uns: 71=Podologen · 72=Med. Fusspfleger · 20=Gruppenschluessel Heilmittelerbringer (21-29) · 00=Sammelschluessel · 99=Sonderschluessel.';
COMMENT ON COLUMN public.kostentraeger_annahmestellen.art_datenlieferung IS 'Nur 07 oder 30 sind fuer elektronische Abrechnung gueltig (Abschnitt 5.2). 21/24/26/28/29 gehoeren zu Papierannahmestellen.';
COMMENT ON COLUMN public.kostentraeger_annahmestellen.valid_from IS 'Erster Tag, an dem diese VKG-Zeile gilt (inklusive). NULL = von Anfang an. Wird beim Nachladen NIE ueberschrieben (sonst stuende eine heute gueltige Zeile ohne Empfaenger da).';
COMMENT ON COLUMN public.kostentraeger_annahmestellen.valid_to IS 'Letzter Tag, an dem diese VKG-Zeile gilt (inklusive). NULL = offen. Faellt der Schluessel im neuen Kostentraegerdatei-Stand weg: gueltigAb der neuen Ausgabe minus 1 Tag. Kehrt er zurueck: wieder NULL.';

ALTER TABLE ONLY public.kostentraeger_annahmestellen
  ADD CONSTRAINT kostentraeger_annahmestellen_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik) ON DELETE CASCADE;

ALTER TABLE ONLY public.kostentraeger_annahmestellen
  ADD CONSTRAINT kostentraeger_annahmestellen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kostentraeger_annahmestellen
  ADD CONSTRAINT kostentraeger_annahmestellen_uniq UNIQUE (kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland);

CREATE TABLE public.kostentraeger_anschriften (
  id bigint GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1) NOT NULL,
  kostentraeger_ik text NOT NULL,
  art text NOT NULL,
  plz text DEFAULT ''::text NOT NULL,
  ort text DEFAULT ''::text NOT NULL,
  strasse text DEFAULT ''::text NOT NULL,
  quelle text,
  quelle_stand date,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  valid_from date,
  valid_to date
);
--   FK kostentraeger_ik -> kostentraeger(ik)
ALTER TABLE ONLY public.kostentraeger_anschriften OWNER TO postgres;
COMMENT ON TABLE public.kostentraeger_anschriften IS 'Postanschriften der Kostentraeger und Papierannahmestellen aus dem ANS-Segment der Kostentraegerdatei (Anhang 03 V10 § 7, Richtlinien § 2(1)/§ 4). Kindtabelle, da wie VKG wiederholbar (Haus, Postfach, Grosskunde). Auswahl erfolgt leseseitig via waehlePostanschrift().';
COMMENT ON COLUMN public.kostentraeger_anschriften.kostentraeger_ik IS 'Institutionskennzeichen des Kostentraegers bzw. der Papierannahmestelle (Fremdschluessel auf kostentraeger.ik).';
COMMENT ON COLUMN public.kostentraeger_anschriften.art IS 'Art der Anschrift gemaess Anhang 03 V10 § 7: ''1'' = Hausanschrift, ''2'' = Postfach, ''3'' = Grosskunde.';
COMMENT ON COLUMN public.kostentraeger_anschriften.quelle IS 'Dateiname der Kostentraegerdatei, aus der dieser Datensatz stammt (z. B. AO05Q326_KE3.txt).';
COMMENT ON COLUMN public.kostentraeger_anschriften.quelle_stand IS 'Gueltigkeitsstichtag der Quelldatei gemaess Herausgeber / VDT-Segment.';
COMMENT ON COLUMN public.kostentraeger_anschriften.valid_from IS 'Erster Tag, an dem diese ANS-Zeile gilt (inklusive). NULL = von Anfang an.';
COMMENT ON COLUMN public.kostentraeger_anschriften.valid_to IS 'Letzter Tag, an dem diese ANS-Zeile gilt (inklusive). NULL = offen.';

ALTER TABLE ONLY public.kostentraeger_anschriften
  ADD CONSTRAINT kostentraeger_anschriften_art_chk CHECK (art = ANY (ARRAY['1'::text, '2'::text, '3'::text]));

ALTER TABLE ONLY public.kostentraeger_anschriften
  ADD CONSTRAINT kostentraeger_anschriften_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik) ON DELETE CASCADE;

ALTER TABLE ONLY public.kostentraeger_anschriften
  ADD CONSTRAINT kostentraeger_anschriften_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kostentraeger_anschriften
  ADD CONSTRAINT kostentraeger_anschriften_uniq UNIQUE (kostentraeger_ik, art, plz, ort, strasse);

CREATE TABLE public.krankenkassen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  abbreviation text,
  type text DEFAULT 'gesetzlich'::text,
  created_at timestamp with time zone DEFAULT now(),
  ik_number text
);
ALTER TABLE ONLY public.krankenkassen OWNER TO postgres;

ALTER TABLE ONLY public.krankenkassen
  ADD CONSTRAINT krankenkassen_pkey PRIMARY KEY (id);

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
  location geography(Point,4326),
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
  krankenkasse_ik text
);
--   FK arzt_id -> aerzte(id)
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.leads OWNER TO postgres;
COMMENT ON COLUMN public.leads.phone IS 'Festnetz / Hauptnummer. Buchungsabgleich laeuft ueber phone_normalized.';
COMMENT ON COLUMN public.leads.geschlecht IS 'Geschlecht des Patienten. Erlaubt: m = maennlich, f = weiblich, d = divers (§22 Abs.3 PStG). NULL = keine Angabe und der Normalfall. ACHTUNG: NICHT "w" fuer weiblich — der CHECK leads_geschlecht_check laesst nur m/f/d durch. Schreibpfade normalisieren ueber module/geschlecht.js (Frontend) bzw. api-backend/lib/geschlecht.js (Backend).';
COMMENT ON COLUMN public.leads.insurance_type IS 'gkv = gesetzlich versichert (fixed tariff prices), privat = privatversichert (practice-set prices)';
COMMENT ON COLUMN public.leads.ausfallvereinbarung_am IS 'Datum, an dem der Patient die Ausfallvereinbarung unterschrieben hat. NULL = liegt nicht vor bzw. nicht erfasst; die Ausfallrechnung wird dann nur mit Warnhinweis erstellt.';
COMMENT ON COLUMN public.leads.handy IS 'Mobilnummer. Zweitnummer neben phone, seit 14.08.2026 getrennt gefuehrt.';
COMMENT ON COLUMN public.leads.patientennummer IS 'Fortlaufende Nummer je Praxis, ab 1. Vergabe durch Trigger vergebe_patientennummer().';
COMMENT ON COLUMN public.leads.podologie_altbestand_vor_2023 IS 'NULL = noch nicht gefragt/unbekannt. true/false = Patient hat vor dem 01.11.2023 erstmals podologische Behandlung begonnen (HPNR 78040 Aenderungsvereinbarung 20.10.2023). Ops #244.';
COMMENT ON COLUMN public.leads.podologie_altbestand_beantwortet_am IS 'Wann die Altbestand-Frage beantwortet wurde — dient als Beleg gegenueber der Kasse, ein fluechtiger Dialog reicht laut SPEC-RULES.md nicht. Ops #244.';
COMMENT ON COLUMN public.leads.krankenkasse_ik IS 'IK der Krankenkasse von der Versichertenkarte des Patienten (Karten-IK, §302 Anlage 1 TP5 V21 § 5.5.3.1). Gleiche Bedeutung wie prescriptions.krankenkasse_ik, NICHT die Kostentraeger-IK. Vorbelegung fuer neue Verordnungen. NULL = nicht erfasst.';

ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_arzt_id_fkey FOREIGN KEY (arzt_id) REFERENCES aerzte(id);

ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_geschlecht_check CHECK (geschlecht = ANY (ARRAY['m'::text, 'f'::text, 'd'::text]));

ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_insurance_type_check CHECK (insurance_type = ANY (ARRAY['gkv'::text, 'privat'::text]));

ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_krankenkasse_ik_format CHECK (krankenkasse_ik IS NULL OR krankenkasse_ik ~ '^[0-9]{9}$'::text);

ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leads
  ADD CONSTRAINT leads_status_check CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'booked'::text, 'won'::text, 'lost'::text]));

CREATE TABLE public.mahnungen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  prescription_id uuid,
  patient_id uuid,
  mahnung_nr bigint NOT NULL,
  level smallint NOT NULL,
  amount_eur numeric(10,2) NOT NULL,
  original_faelligkeit date NOT NULL,
  neue_faelligkeit date NOT NULL,
  sent_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  status text DEFAULT 'offen'::text NOT NULL,
  notes text,
  ausfallrechnung_id uuid
);
--   FK ausfallrechnung_id -> ausfallrechnungen(id)
--   FK owner_id -> profiles(id)
--   FK patient_id -> leads(id)
--   FK prescription_id -> prescriptions(id)
ALTER TABLE ONLY public.mahnungen OWNER TO postgres;
COMMENT ON COLUMN public.mahnungen.ausfallrechnung_id IS 'Gemahnte Ausfallrechnung. Genau eines von prescription_id / ausfallrechnung_id ist gesetzt (CHECK mahnungen_genau_eine_quelle).';

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_ausfallrechnung_id_fkey FOREIGN KEY (ausfallrechnung_id) REFERENCES ausfallrechnungen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_genau_eine_quelle CHECK (num_nonnulls(prescription_id, ausfallrechnung_id) = 1);

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_level_check CHECK (level >= 1 AND level <= 3);

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_owner_id_mahnung_nr_key UNIQUE (owner_id, mahnung_nr);

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mahnungen
  ADD CONSTRAINT mahnungen_status_check CHECK (status = ANY (ARRAY['offen'::text, 'bezahlt'::text, 'abgeschrieben'::text]));

CREATE TABLE public.messreihen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  prescription_id uuid,
  typ text NOT NULL,
  koerperteil text,
  wert numeric(6,2) NOT NULL,
  einheit text DEFAULT 'Punkte'::text NOT NULL,
  gemessen_am timestamp with time zone DEFAULT now() NOT NULL,
  notiz text,
  erfasst_von uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK erfasst_von -> profiles(id)
--   FK lead_id -> leads(id)
--   FK owner_id -> profiles(id)
--   FK prescription_id -> prescriptions(id)
ALTER TABLE ONLY public.messreihen OWNER TO postgres;

ALTER TABLE ONLY public.messreihen
  ADD CONSTRAINT messreihen_erfasst_von_fkey FOREIGN KEY (erfasst_von) REFERENCES profiles(id);

ALTER TABLE ONLY public.messreihen
  ADD CONSTRAINT messreihen_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.messreihen
  ADD CONSTRAINT messreihen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.messreihen
  ADD CONSTRAINT messreihen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.messreihen
  ADD CONSTRAINT messreihen_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.messreihen
  ADD CONSTRAINT messreihen_typ_check CHECK (typ = ANY (ARRAY['VAS'::text, 'ROM'::text, 'kraft'::text, 'custom'::text]));

CREATE TABLE public.module_visibility (
  module_id text NOT NULL,
  sector text NOT NULL,
  role text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid
);
ALTER TABLE ONLY public.module_visibility OWNER TO postgres;

ALTER TABLE ONLY public.module_visibility
  ADD CONSTRAINT module_visibility_pkey PRIMARY KEY (module_id, sector, role);

ALTER TABLE ONLY public.module_visibility
  ADD CONSTRAINT module_visibility_role_check CHECK (role = ANY (ARRAY['owner'::text, 'employee'::text]));

CREATE TABLE public.nummernkreise (
  owner_id uuid NOT NULL,
  kreis text NOT NULL,
  jahr integer NOT NULL,
  last_nr bigint DEFAULT 0 NOT NULL
);
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.nummernkreise OWNER TO postgres;

ALTER TABLE ONLY public.nummernkreise
  ADD CONSTRAINT nummernkreise_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.nummernkreise
  ADD CONSTRAINT nummernkreise_pkey PRIMARY KEY (owner_id, kreis, jahr);

CREATE TABLE public.pat_fussbefund (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
  befund jsonb DEFAULT '{}'::jsonb NOT NULL,
  markierungen jsonb DEFAULT '[]'::jsonb NOT NULL,
  notiz text,
  erfasst_von uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  booking_id uuid,
  uebernommen_von uuid,
  eintrag_id uuid NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  ist_aktuell boolean DEFAULT true NOT NULL,
  serie_id uuid NOT NULL,
  serie_farbe text,
  wagner_grad smallint
);
--   FK booking_id -> bookings(id)
--   FK lead_id -> leads(id)
--   FK uebernommen_von -> pat_fussbefund(id)
ALTER TABLE ONLY public.pat_fussbefund OWNER TO postgres;
COMMENT ON COLUMN public.pat_fussbefund.booking_id IS 'Termin, zu dem dieser Befund gehört. NULL = ohne Termin erfasst.';
COMMENT ON COLUMN public.pat_fussbefund.uebernommen_von IS 'Befund, aus dem dieser als Kopie hervorgegangen ist (nur Herkunft, keine Bindung).';
COMMENT ON COLUMN public.pat_fussbefund.eintrag_id IS 'Korrekturkette: alle Versionen DESSELBEN Befunds. Erste Version traegt die eigene id.';
COMMENT ON COLUMN public.pat_fussbefund.version IS 'Laufende Nummer innerhalb des Eintrags. Wird vom Trigger vergeben, nie vom Client.';
COMMENT ON COLUMN public.pat_fussbefund.ist_aktuell IS 'Juengste Version des Eintrags. Genau eine je eintrag_id.';
COMMENT ON COLUMN public.pat_fussbefund.serie_id IS 'Farbgruppe ueber Termine hinweg. Wird bei der Uebernahme geerbt.';
COMMENT ON COLUMN public.pat_fussbefund.serie_farbe IS 'Farbe der Serie als KOPIE in der Zeile — wie markierungen die Legende kopieren.';
COMMENT ON COLUMN public.pat_fussbefund.wagner_grad IS 'Wagner-Grad 0-5 (diabetisches Fusssyndrom). NULL = nicht erhoben.';

ALTER TABLE ONLY public.pat_fussbefund
  ADD CONSTRAINT pat_fussbefund_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pat_fussbefund
  ADD CONSTRAINT pat_fussbefund_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pat_fussbefund
  ADD CONSTRAINT pat_fussbefund_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pat_fussbefund
  ADD CONSTRAINT pat_fussbefund_uebernommen_von_fkey FOREIGN KEY (uebernommen_von) REFERENCES pat_fussbefund(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pat_fussbefund
  ADD CONSTRAINT pat_fussbefund_wagner_grad_check CHECK (wagner_grad IS NULL OR wagner_grad >= 0 AND wagner_grad <= 5);

CREATE TABLE public.patient_consents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  patient_id uuid NOT NULL,
  consent_type text NOT NULL,
  text_version text NOT NULL,
  text_sha256 text NOT NULL,
  text_snapshot text NOT NULL,
  signature_path text,
  signed_name text,
  consented_at timestamp with time zone DEFAULT now() NOT NULL,
  captured_by_user_id uuid,
  device_label text,
  revoked_at timestamp with time zone,
  revoke_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK business_id -> businesses(id)
--   FK captured_by_user_id -> profiles(id)
--   FK owner_id -> profiles(id)
--   FK patient_id -> leads(id)
ALTER TABLE ONLY public.patient_consents OWNER TO postgres;
COMMENT ON TABLE public.patient_consents IS 'Digitale Patienten-Einwilligungen (einfache elektronische Signatur). Aufbewahrung 10 Jahre (§630f Abs. 3 BGB). Bewusst OHNE ip_address. Nicht mit consent_log verwechseln — das ist die B2B-Seite (Praxisinhaber).';
COMMENT ON COLUMN public.patient_consents.text_snapshot IS 'Vollstaendiger unterschriebener Text zum Zeitpunkt der Unterschrift. Unveraenderlich — Aenderungen an der Vorlage duerfen den Nachweis nicht beruehren.';

ALTER TABLE ONLY public.patient_consents
  ADD CONSTRAINT patient_consents_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.patient_consents
  ADD CONSTRAINT patient_consents_captured_by_user_id_fkey FOREIGN KEY (captured_by_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.patient_consents
  ADD CONSTRAINT patient_consents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.patient_consents
  ADD CONSTRAINT patient_consents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.patient_consents
  ADD CONSTRAINT patient_consents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.patient_consents
  ADD CONSTRAINT patient_consents_sha_chk CHECK (text_sha256 ~ '^[0-9a-f]{64}$'::text);

ALTER TABLE ONLY public.patient_consents
  ADD CONSTRAINT patient_consents_type_chk CHECK (consent_type = ANY (ARRAY['behandlungsvertrag'::text, 'datenschutz'::text, 'selbstzahler'::text, 'foto'::text]));

CREATE TABLE public.patient_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  doctor_notes text,
  therapist_notes text,
  ai_summary text,
  status text DEFAULT 'draft'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK lead_id -> leads(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.patient_notes OWNER TO postgres;

ALTER TABLE ONLY public.patient_notes
  ADD CONSTRAINT patient_notes_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.patient_notes
  ADD CONSTRAINT patient_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.patient_notes
  ADD CONSTRAINT patient_notes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.patient_notes
  ADD CONSTRAINT patient_notes_owner_id_lead_id_key UNIQUE (owner_id, lead_id);

ALTER TABLE ONLY public.patient_notes
  ADD CONSTRAINT patient_notes_pkey PRIMARY KEY (id);

CREATE TABLE public.patients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  vorname text NOT NULL,
  nachname text NOT NULL,
  geburtsdatum date NOT NULL,
  email text,
  telefon text,
  created_at timestamp with time zone DEFAULT now()
);
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.patients OWNER TO postgres;

ALTER TABLE ONLY public.patients
  ADD CONSTRAINT patients_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.patients
  ADD CONSTRAINT patients_owner_id_nachname_geburtsdatum_key UNIQUE (owner_id, nachname, geburtsdatum);

ALTER TABLE ONLY public.patients
  ADD CONSTRAINT patients_pkey PRIMARY KEY (id);

CREATE TABLE public.pending_signups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  onboarding_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  stripe_checkout_session_id text,
  created_at timestamp with time zone DEFAULT now(),
  password_secret_id uuid
);
ALTER TABLE ONLY public.pending_signups OWNER TO postgres;

ALTER TABLE ONLY public.pending_signups
  ADD CONSTRAINT pending_signups_email_key UNIQUE (email);

ALTER TABLE ONLY public.pending_signups
  ADD CONSTRAINT pending_signups_pkey PRIMARY KEY (id);

CREATE TABLE public.podologie_behandlungen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid,
  verordnung_id uuid,
  behandlungsdatum date NOT NULL,
  hpnr_codes text[],
  diagnosegruppe text,
  lokalisation text,
  notizen text,
  betrag_gkv numeric(8,2),
  created_at timestamp with time zone DEFAULT now(),
  invoice_id uuid,
  employee_id uuid,
  storniert_am timestamp with time zone,
  storniert_von uuid,
  storno_grund text,
  therapiezeit_min smallint
);
--   FK employee_id -> profiles(id)
--   FK invoice_id -> invoices(id)
--   FK owner_id -> profiles(id)
--   FK storniert_von -> profiles(id)
--   FK verordnung_id -> prescriptions(id)
ALTER TABLE ONLY public.podologie_behandlungen OWNER TO postgres;
COMMENT ON COLUMN public.podologie_behandlungen.invoice_id IS 'Gesetzt, sobald die Sitzung auf einer Rechnung steht. Verhindert Doppelabrechnung und traegt die Vorauswahl der Bruecke.';
COMMENT ON COLUMN public.podologie_behandlungen.employee_id IS 'Wer die Behandlung durchgefuehrt hat. NULL bei Altbestand oder wenn der Owner selbst behandelt hat. Ops #252.';
COMMENT ON COLUMN public.podologie_behandlungen.storniert_am IS 'Zeitpunkt der Stornierung. NULL = wirksame Behandlung. Gesetzt statt geloescht (§ 630f Abs. 1 S. 2 BGB): die Zeile bleibt lesbar, zaehlt aber nicht mehr — weder fuer die Einmaligkeitssperre noch fuer die §302-Datei.';
COMMENT ON COLUMN public.podologie_behandlungen.storniert_von IS 'Wer storniert hat. ON DELETE SET NULL, damit das Loeschen eines Mitarbeiterkontos nicht an dieser Zeile haengenbleibt.';
COMMENT ON COLUMN public.podologie_behandlungen.storno_grund IS 'Warum storniert wurde. Pflichtangabe — das "warum/wann erkennbar" ist der eigentliche Inhalt von § 630f Abs. 1 S. 2 BGB, ohne Grund ist die Stornierung dokumentarisch wertlos.';
COMMENT ON COLUMN public.podologie_behandlungen.therapiezeit_min IS 'Dokumentierte Therapiezeit in Minuten (78020 Komplexbehandlung: > 20). NULL = nicht erfasst.';

ALTER TABLE ONLY public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id);

ALTER TABLE ONLY public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_storniert_von_fkey FOREIGN KEY (storniert_von) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_storno_grund_chk CHECK (storniert_am IS NULL OR btrim(COALESCE(storno_grund, ''::text)) <> ''::text);

ALTER TABLE ONLY public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_therapiezeit_check CHECK (therapiezeit_min IS NULL OR therapiezeit_min >= 1 AND therapiezeit_min <= 600);

ALTER TABLE ONLY public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_verordnung_id_fkey FOREIGN KEY (verordnung_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

CREATE TABLE public.podologie_empfangsnachweise (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_seq bigint GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1) NOT NULL,
  owner_id uuid NOT NULL,
  behandlung_id uuid NOT NULL,
  behandlungsdatum date NOT NULL,
  hpnr_code text NOT NULL,
  therapeuteninitialen text,
  status text NOT NULL,
  geprueft_von uuid NOT NULL,
  geprueft_am timestamp with time zone NOT NULL,
  dokument_id bigint,
  grund text,
  vorgaenger_id uuid
);
--   FK behandlung_id -> podologie_behandlungen(id)
--   FK vorgaenger_id -> podologie_empfangsnachweise(id)
ALTER TABLE ONLY public.podologie_empfangsnachweise OWNER TO postgres;

ALTER TABLE ONLY public.podologie_empfangsnachweise
  ADD CONSTRAINT podologie_empfangsnachweise_behandlung_id_fkey FOREIGN KEY (behandlung_id) REFERENCES podologie_behandlungen(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.podologie_empfangsnachweise
  ADD CONSTRAINT podologie_empfangsnachweise_event_seq_key UNIQUE (event_seq);

ALTER TABLE ONLY public.podologie_empfangsnachweise
  ADD CONSTRAINT podologie_empfangsnachweise_hpnr_code_check CHECK (hpnr_code = '78040'::text);

ALTER TABLE ONLY public.podologie_empfangsnachweise
  ADD CONSTRAINT podologie_empfangsnachweise_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.podologie_empfangsnachweise
  ADD CONSTRAINT podologie_empfangsnachweise_status_check CHECK (status = ANY (ARRAY['bestaetigt'::text, 'widerrufen'::text]));

ALTER TABLE ONLY public.podologie_empfangsnachweise
  ADD CONSTRAINT podologie_empfangsnachweise_vorgaenger_id_fkey FOREIGN KEY (vorgaenger_id) REFERENCES podologie_empfangsnachweise(id) ON DELETE RESTRICT;

CREATE TABLE public.praxura_migrations (
  version text NOT NULL,
  name text NOT NULL,
  checksum text NOT NULL,
  applied_at timestamp with time zone DEFAULT now() NOT NULL,
  duration_ms integer,
  app_version text
);
ALTER TABLE ONLY public.praxura_migrations OWNER TO postgres;
COMMENT ON TABLE public.praxura_migrations IS 'Buch der Schemakette. Geschrieben von api-backend/db/migrate.js. Eine Zeile = eine angewandte Migrationsdatei. Entwurf: onprem/SCHEMA-VERTEILUNG.md 4.5. Nicht verwechseln mit supabase_migrations.schema_migrations.';

ALTER TABLE ONLY public.praxura_migrations
  ADD CONSTRAINT praxura_migrations_pkey PRIMARY KEY (version);

CREATE TABLE public.praxura_setup (
  id smallint DEFAULT 1 NOT NULL,
  angelegt_am timestamp with time zone DEFAULT now() NOT NULL,
  token_sha256 text,
  verbraucht_am timestamp with time zone,
  owner_user_id uuid,
  abgeschlossen_am timestamp with time zone,
  schritte jsonb DEFAULT '{}'::jsonb NOT NULL
);
--   FK owner_user_id -> auth.users(id)
ALTER TABLE ONLY public.praxura_setup OWNER TO postgres;
COMMENT ON TABLE public.praxura_setup IS 'Eine Zeile je Box: ist der SETUP_TOKEN aus install.sh schon gegen den ersten Owner eingetauscht worden? Kein Produktdatensatz. Im SaaS vorhanden, aber unberuehrt (Tor ist die Umgebungsvariable SETUP_TOKEN, nicht diese Tabelle). Seit 0005 (11.09.2026), Faz 2.2.';
COMMENT ON COLUMN public.praxura_setup.token_sha256 IS 'SHA-256 des verbrauchten Tokens, hex. Nie der Klartext. Erst beim Verbrauch gesetzt.';
COMMENT ON COLUMN public.praxura_setup.verbraucht_am IS 'Gesetzt beim Anlegen des ersten Owners (Schritt 5), per UPDATE … WHERE verbraucht_am IS NULL.';
COMMENT ON COLUMN public.praxura_setup.owner_user_id IS 'auth.users.id des angelegten Inhabers. NULL heisst nicht "unverbraucht" (FK ON DELETE SET NULL).';
COMMENT ON COLUMN public.praxura_setup.abgeschlossen_am IS 'Ende des Assistenten (Schritt 8). verbraucht_am gesetzt + abgeschlossen_am NULL = Assistent unfertig.';
COMMENT ON COLUMN public.praxura_setup.schritte IS 'Nur Zustand der Assistenten-Schritte. KEINE Geheimnisse, keine Patientendaten.';

ALTER TABLE ONLY public.praxura_setup
  ADD CONSTRAINT praxura_setup_abschluss_nach_verbrauch CHECK (abgeschlossen_am IS NULL OR verbraucht_am IS NOT NULL);

ALTER TABLE ONLY public.praxura_setup
  ADD CONSTRAINT praxura_setup_id_check CHECK (id = 1);

ALTER TABLE ONLY public.praxura_setup
  ADD CONSTRAINT praxura_setup_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.praxura_setup
  ADD CONSTRAINT praxura_setup_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.praxura_setup
  ADD CONSTRAINT praxura_setup_verbrauch_vollstaendig CHECK (verbraucht_am IS NULL AND token_sha256 IS NULL AND owner_user_id IS NULL OR verbraucht_am IS NOT NULL AND token_sha256 IS NOT NULL);

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
--   FK owner_id -> auth.users(id)
--   FK prescription_id -> prescriptions(id)
--   FK uploaded_by -> auth.users(id)
ALTER TABLE ONLY public.prescription_documents OWNER TO postgres;
COMMENT ON TABLE public.prescription_documents IS 'Nachweise/Anhänge zu einer Verordnung (Befreiungsausweis, LHB-Genehmigung, korrigierte Verordnung, Therapiebericht)';

ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_art_check CHECK (art = ANY (ARRAY['befreiungsausweis'::text, 'lhb_genehmigung'::text, 'korrigierte_verordnung'::text, 'therapiebericht'::text, 'sonstiges'::text]));

ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prescription_documents
  ADD CONSTRAINT prescription_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE public.prescription_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  prescription_id uuid NOT NULL,
  booking_id uuid,
  session_number integer NOT NULL,
  status text DEFAULT 'planned'::text NOT NULL,
  done_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  notes text,
  heilmittel_index integer DEFAULT 0
);
--   FK booking_id -> bookings(id)
--   FK prescription_id -> prescriptions(id)
ALTER TABLE ONLY public.prescription_sessions OWNER TO postgres;
COMMENT ON COLUMN public.prescription_sessions.notes IS 'Per-session therapist notes entered when marking session done';

ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_prescription_id_session_number_key UNIQUE (prescription_id, session_number);

ALTER TABLE ONLY public.prescription_sessions
  ADD CONSTRAINT prescription_sessions_status_check CHECK (status = ANY (ARRAY['planned'::text, 'done'::text, 'cancelled'::text, 'no_show'::text]));

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
--   FK prescription_id -> prescriptions(id)
--   FK validated_by -> auth.users(id)
ALTER TABLE ONLY public.prescription_validations OWNER TO postgres;
COMMENT ON COLUMN public.prescription_validations.overridden_rules IS 'Array of rule codes (e.g. OVER_HOECHSTMENGE) that were active when therapist clicked proceed_anyway.';
COMMENT ON COLUMN public.prescription_validations.proceed_reason IS 'Free-text reason supplied by therapist when overriding validation warnings. Required for DSGVO audit trail.';

ALTER TABLE ONLY public.prescription_validations
  ADD CONSTRAINT prescription_validations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prescription_validations
  ADD CONSTRAINT prescription_validations_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prescription_validations
  ADD CONSTRAINT prescription_validations_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES auth.users(id);

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
  bg_einverstaendnis_am date
);
--   FK abrechnung_id -> abrechnung(id)
--   FK abrechnung_status_manuell_von -> auth.users(id)
--   FK arzt_id -> aerzte(id)
--   FK business_id -> businesses(id)
--   FK confirmed_by -> auth.users(id)
--   FK kostentraeger_ik -> kostentraeger(ik)
--   FK owner_id -> auth.users(id)
--   FK patient_id -> leads(id)
--   FK zuzahlung_kassiert_von -> auth.users(id)
ALTER TABLE ONLY public.prescriptions OWNER TO postgres;
COMMENT ON COLUMN public.prescriptions.abrechnung_status IS 'Abrechnungsachse. Schluessel zur alten verordnungen.status: aktiv=NULL, abrechenbar=bereit, abgerechnet=gesendet, abgesetzt=rejected; teilabsetzung/storniert/archiviert unveraendert.';
COMMENT ON COLUMN public.prescriptions.leitsymptomatik IS '§302 Heilmittel Leitsymptomatik: 4-char a/b/c/d (each 0|1), e.g. 1010; 0000 requires free-text patientenLeitsymptomatik';
COMMENT ON COLUMN public.prescriptions.diagnose_freitext IS 'Muster 13: Freitext-Diagnose neben ICD-10 (z. B. "Unguis incarnatus rechts")';
COMMENT ON COLUMN public.prescriptions.ergaenzendes_heilmittel IS 'Muster 13: Ergänzendes Heilmittel (Freitext)';
COMMENT ON COLUMN public.prescriptions.therapie_bereich IS 'Muster 13: angekreuzter Therapiebereich (physio|podo|stimme|ergo|ernaehrung)';
COMMENT ON COLUMN public.prescriptions.hinweise IS 'Muster 13: ggf. Therapieziele / weitere med. Befunde und Hinweise';
COMMENT ON COLUMN public.prescriptions.icd10_2 IS 'Zweiter behandlungsrelevanter ICD-10-Code (Muster 13, 2. Diagnose)';
COMMENT ON COLUMN public.prescriptions.zuzahlung_kassiert_am IS 'Zeitpunkt der Vereinnahmung der gesetzlichen Zuzahlung. NULL = offen. Einmal je Verordnung (nicht je Sitzung).';
COMMENT ON COLUMN public.prescriptions.zuzahlung_zahlart IS 'Zahlungsart, mit der die Zuzahlung kassiert wurde. Gehört zu zuzahlung_kassiert_am/_von.';
COMMENT ON COLUMN public.prescriptions.patient_name IS 'Freitextname vom Anlagezeitpunkt (aus verordnungen uebernommen 09.2026). NICHT fuer die Abrechnung verwenden — der Name kommt immer aus leads.';
COMMENT ON COLUMN public.prescriptions.rezeptart IS 'Zahlerachse: kassen|privat|selbstzahler. NICHT mit rezept_typ verwechseln — das ist die Formachse (standard|blanko|lhb_bvb).';
COMMENT ON COLUMN public.prescriptions.notizen IS 'Interne Notiz der Praxis. Gegenstueck: hinweise = Therapieziel vom Arzt (aus dem gescannten Muster 13).';
COMMENT ON COLUMN public.prescriptions.nagel IS 'Nagelspange: behandelter Zehennagel dieser Verordnung, Schreibweise nach § 3b Satz 5 Aenderungsvereinbarung 16.06.2025 ("U1 links" .. "U5 rechts"). Nur bei diagnosegruppe UI1/UI2 gefuellt. Haelt die Behandlungsserie ueber mehrere Verordnungen zusammen (§ 3b lit. a).';
COMMENT ON COLUMN public.prescriptions.krankenkasse_ik IS 'IK der Krankenkasse von der Versichertenkarte (Karten-IK, §302 Anlage 1 TP5 V21 § 5.5.3.1), 9 Ziffern. NICHT die Kostentraeger-IK: kostentraeger_ik wird serverseitig immer aus diesem Wert abgeleitet (Kostentraegerdatei). Im DTA Mussfeld (V:01017) - kein Rueckfall auf kostentraeger_ik, ohne Karten-IK lehnt der Bau ab (KARTEN_IK_FEHLT). NULL = noch nicht erfasst, Verordnung nicht abrechnungsbereit.';

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_abrechnung_status_check CHECK (abrechnung_status IS NULL OR (abrechnung_status = ANY (ARRAY['bereit'::text, 'in_abrechnung'::text, 'gesendet'::text, 'accepted'::text, 'rejected'::text, 'paid'::text, 'teilabsetzung'::text, 'storniert'::text, 'archiviert'::text])));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_abrechnung_status_manuell_von_fkey FOREIGN KEY (abrechnung_status_manuell_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_absetzung_betrag_check CHECK (absetzung_betrag IS NULL OR absetzung_betrag > 0::numeric AND (abrechnung_status = ANY (ARRAY['teilabsetzung'::text, 'rejected'::text])));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_arzt_id_fkey FOREIGN KEY (arzt_id) REFERENCES aerzte(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_bericht_status_check CHECK (bericht_status = ANY (ARRAY['offen'::text, 'in_arbeit'::text, 'erledigt'::text]));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES kostentraeger(ik);

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_krankenkasse_ik_format CHECK (krankenkasse_ik IS NULL OR krankenkasse_ik ~ '^[0-9]{9}$'::text);

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_nagel_check CHECK (nagel IS NULL OR (nagel = ANY (ARRAY['U1 links'::text, 'U2 links'::text, 'U3 links'::text, 'U4 links'::text, 'U5 links'::text, 'U1 rechts'::text, 'U2 rechts'::text, 'U3 rechts'::text, 'U4 rechts'::text, 'U5 rechts'::text])));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_quelle_check CHECK (quelle = ANY (ARRAY['papier'::text, 'ocr'::text, 'evo'::text]));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_rezept_typ_check CHECK (rezept_typ = ANY (ARRAY['standard'::text, 'blanko'::text, 'lhb_bvb'::text, 'kassen'::text, 'privat'::text]));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_rezeptart_check CHECK (rezeptart IS NULL OR (rezeptart = ANY (ARRAY['kassen'::text, 'privat'::text, 'selbstzahler'::text, 'bg'::text])));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_bg_laengen_check CHECK (((bg_traeger_name IS NULL) OR (char_length(bg_traeger_name) <= 200)) AND ((bg_traeger_anschrift IS NULL) OR (char_length(bg_traeger_anschrift) <= 500)) AND ((bg_aktenzeichen IS NULL) OR (char_length(bg_aktenzeichen) <= 80)) AND ((bg_kostenzusage_zeichen IS NULL) OR (char_length(bg_kostenzusage_zeichen) <= 80)));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_signature_confidence_check CHECK (signature_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_status_check CHECK (status = ANY (ARRAY['parsed'::text, 'confirmed'::text, 'in_therapy'::text, 'completed'::text, 'billed'::text, 'cancelled'::text]));

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_teilabsetzung_braucht_betrag CHECK (abrechnung_status IS DISTINCT FROM 'teilabsetzung'::text OR absetzung_betrag IS NOT NULL);

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_wagner_grad_check CHECK (wagner_grad IS NULL OR wagner_grad >= 0 AND wagner_grad <= 5);

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_kassiert_von_fkey FOREIGN KEY (zuzahlung_kassiert_von) REFERENCES auth.users(id);

ALTER TABLE ONLY public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_zahlart_check CHECK (zuzahlung_zahlart IS NULL OR (zuzahlung_zahlart = ANY (ARRAY['bar'::text, 'ec'::text, 'ueberweisung'::text, 'sonstiges'::text, 'paypal'::text])));

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
  clinic_location geography(Point,4326),
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
  gps_checkin_pruefen boolean DEFAULT false NOT NULL
);
--   FK id -> auth.users(id)
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.profiles OWNER TO postgres;
COMMENT ON COLUMN public.profiles.plan IS 'Subscription plan: starter | professional | klinik | enterprise (multi-business)';
COMMENT ON COLUMN public.profiles.booking_slug IS 'DEPRECATED 2026-05-22: moved to businesses.booking_slug. Kept for migration grace period.';
COMMENT ON COLUMN public.profiles.ik_number IS 'Institutionskennzeichen (9-stellig, ARGE-IK) — für §302 SGB V Abrechnung über DMRZ';
COMMENT ON COLUMN public.profiles.tax_exempt_note IS 'e.g. "Gemäß §4 Nr. 14 UStG umsatzsteuerfrei" for physio practices.';
COMMENT ON COLUMN public.profiles.fussbefund_legende IS 'Praxiseigene Legende der Fußgrafik: [{id,symbol,color,label}]. Leer = Standard.';
COMMENT ON COLUMN public.profiles.tablet_kiosk_pin_set IS 'Kiosk-PIN hinterlegt? Wird ausschliesslich vom Backend (service_role) gepflegt.';
COMMENT ON COLUMN public.profiles.selbstzahler_stufen IS 'Ops #266: benannte Selbstzahler-Preisstufen des Owners, [{id,name,betrag_eur}]. Eingabehelfer bei der Rechnungserfassung — der berechnete Betrag wird in invoices.line_items festgeschrieben, nicht die Stufe.';
COMMENT ON COLUMN public.profiles.buchungskonten IS 'Owner-gepflegter Kontenrahmen: [{code,label,aktiv}] — Form und Normalisierung in module/buchungskonten.js. Leer = Modul-Standard (1000 Kasse, 1100 Postbank, 1200 Bank, 1210 Bank 2, 8700 Erloesschmaelerung, 4900 Teilabsetzung). Gebuchte Zeilen referenzieren NICHT hierher, sie speichern code+label als Snapshot (GoBD Rz. 107).';
COMMENT ON COLUMN public.profiles.gps_checkin_pruefen IS 'Owner-Einstellung: beim Check-in einmalig pruefen, ob der Mitarbeiter im 150-m-Umkreis der Praxis ist. Gespeichert wird nur das Ergebnis, nie Koordinaten. Standard aus.';

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
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_onboarding_step_check CHECK (onboarding_step = ANY (ARRAY['account'::text, 'business'::text, 'billing'::text, 'owner'::text, 'services'::text, 'hours'::text, 'whatsapp'::text, 'templates'::text, 'plan'::text, 'done'::text]));

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id);

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan = ANY (ARRAY['starter'::text, 'professional'::text, 'klinik'::text, 'mitarbeiter'::text, 'enterprise'::text]));

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_plan_status_check CHECK (plan_status = ANY (ARRAY['pending'::text, 'trial'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'expired'::text, 'deleted'::text]));

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['owner'::text, 'employee'::text]));

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_sector_check CHECK (sector IS NULL OR (sector = ANY (ARRAY['barber'::text, 'beauty'::text, 'nails'::text, 'tattoo'::text, 'spa'::text, 'gym'::text, 'massage'::text, 'physiotherapy'::text, 'praxis'::text, 'other'::text, 'podologie'::text, 'logopaedie'::text, 'ergotherapie'::text])));

CREATE TABLE public.rechnung_zahlungen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  art text NOT NULL,
  betrag_eur numeric(10,2) NOT NULL,
  zahlungsdatum date DEFAULT CURRENT_DATE NOT NULL,
  gegenkonto_code text NOT NULL,
  gegenkonto_label text NOT NULL,
  storniert_zeile_id uuid,
  bemerkung text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid
);
--   FK created_by -> profiles(id)
--   FK invoice_id -> invoices(id)
--   FK owner_id -> profiles(id)
--   FK storniert_zeile_id -> rechnung_zahlungen(id)
ALTER TABLE ONLY public.rechnung_zahlungen OWNER TO postgres;
COMMENT ON TABLE public.rechnung_zahlungen IS 'Append-only Zahlungshistorie zu invoices (Privatrechnung). Der beglichene Betrag ist sum(betrag_eur), nicht invoices.payment_status - der ist nur Cache. UPDATE/DELETE per Trigger gesperrt (GoBD).';

ALTER TABLE ONLY public.rechnung_zahlungen
  ADD CONSTRAINT rechnung_zahlungen_art_check CHECK (art = ANY (ARRAY['zahlung'::text, 'ausbuchung'::text, 'storno'::text]));

ALTER TABLE ONLY public.rechnung_zahlungen
  ADD CONSTRAINT rechnung_zahlungen_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.rechnung_zahlungen
  ADD CONSTRAINT rechnung_zahlungen_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.rechnung_zahlungen
  ADD CONSTRAINT rechnung_zahlungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.rechnung_zahlungen
  ADD CONSTRAINT rechnung_zahlungen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rechnung_zahlungen
  ADD CONSTRAINT rechnung_zahlungen_storniert_zeile_id_fkey FOREIGN KEY (storniert_zeile_id) REFERENCES rechnung_zahlungen(id);

ALTER TABLE ONLY public.rechnung_zahlungen
  ADD CONSTRAINT rechnung_zahlungen_storno_bezug CHECK ((art = 'storno'::text) = (storniert_zeile_id IS NOT NULL));

ALTER TABLE ONLY public.rechnung_zahlungen
  ADD CONSTRAINT rechnung_zahlungen_vorzeichen CHECK (art = 'storno'::text AND betrag_eur < 0::numeric OR art <> 'storno'::text AND betrag_eur > 0::numeric);

CREATE TABLE public.referral_drafts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  lead_id uuid,
  raw_ai_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  patient_vorname text,
  patient_nachname text,
  patient_geburtsdatum date,
  seans_sayisi integer,
  tedavi_turu text,
  hausbesuch boolean DEFAULT false,
  diagnose text,
  arzt_name text,
  image_url text,
  is_confirmed boolean DEFAULT false,
  status text DEFAULT 'pending'::text,
  confirmed_at timestamp with time zone,
  confirmed_by uuid,
  booking_series_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK confirmed_by -> auth.users(id)
--   FK lead_id -> leads(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.referral_drafts OWNER TO postgres;

ALTER TABLE ONLY public.referral_drafts
  ADD CONSTRAINT referral_drafts_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.referral_drafts
  ADD CONSTRAINT referral_drafts_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.referral_drafts
  ADD CONSTRAINT referral_drafts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id);

ALTER TABLE ONLY public.referral_drafts
  ADD CONSTRAINT referral_drafts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.referral_drafts
  ADD CONSTRAINT referral_drafts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.referral_drafts
  ADD CONSTRAINT referral_drafts_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));

CREATE TABLE public.scraper_data (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  name text,
  company_name text,
  category text,
  city text,
  phone text,
  email text,
  website text,
  notes text,
  status text DEFAULT 'new'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.scraper_data OWNER TO postgres;

ALTER TABLE ONLY public.scraper_data
  ADD CONSTRAINT scraper_data_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.scraper_data
  ADD CONSTRAINT scraper_data_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.scraper_data
  ADD CONSTRAINT scraper_data_pkey PRIMARY KEY (id);

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
  kostentraeger_typ text
);
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.services OWNER TO postgres;
COMMENT ON COLUMN public.services.is_internal IS 'Internal admin-only services (e.g. Blanko PD, Mehraufwand). Hidden from customer-facing pickers; visible in Dienstleistungen for tariff editing.';
COMMENT ON COLUMN public.services.gkv_position_nr IS 'Positionsnummer aus §125 SGB V Bundesvertrag (z.B. X0501=KG, X1201=MT). Links to heilmittel_tarif.';

ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_kostentraeger_typ_check CHECK (kostentraeger_typ IS NULL OR (kostentraeger_typ = ANY (ARRAY['gkv'::text, 'privat'::text, 'selbstzahler'::text, 'bg'::text])));

ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_required_certificate_check CHECK (required_certificate = ANY (ARRAY['MT'::text, 'MLD'::text, 'KGG'::text]));

ALTER TABLE ONLY public.services
  ADD CONSTRAINT services_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

/* [EXTENSION OWNED - NON-EXECUTABLE]
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL,
  auth_name character varying(256),
  auth_srid integer,
  srtext character varying(2048),
  proj4text character varying(2048)
);
ALTER TABLE ONLY public.spatial_ref_sys OWNER TO supabase_admin;

ALTER TABLE ONLY public.spatial_ref_sys
  ADD CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid);

ALTER TABLE ONLY public.spatial_ref_sys
  ADD CONSTRAINT spatial_ref_sys_srid_check CHECK (srid > 0 AND srid <= 998999);

*/

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
--   FK betriebsart_geaendert_von -> profiles(id)
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.terapeut_zertifikat OWNER TO postgres;
COMMENT ON COLUMN public.terapeut_zertifikat.betriebsart IS 'test | erprobung | echt — steuert UNB-Testindikator (0/1/2) und den ersten Buchstaben des physikalischen Dateinamens (T/T/E). Vorgabe test. Umgestellt wird ausschliesslich vom Inhaber ueber die Oberflaeche, nie per Umgebungsvariable (onprem O-117).';
COMMENT ON COLUMN public.terapeut_zertifikat.zulassung_referenz IS 'Aktenzeichen/Referenz der Zulassung zum Echtverfahren. Erteilt die KRANKENKASSE, nicht die Datenannahmestelle. Pflicht, bevor betriebsart auf echt gehen darf.';
COMMENT ON COLUMN public.terapeut_zertifikat.zulassung_datum IS 'Datum der schriftlichen Zulassung zum Echtverfahren.';

ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_betriebsart_chk CHECK (betriebsart = ANY (ARRAY['test'::text, 'erprobung'::text, 'echt'::text]));

ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_betriebsart_geaendert_von_fkey FOREIGN KEY (betriebsart_geaendert_von) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_echt_braucht_zulassung_chk CHECK (betriebsart <> 'echt'::text OR btrim(COALESCE(zulassung_referenz, ''::text)) <> ''::text AND zulassung_datum IS NOT NULL);

ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_pkey PRIMARY KEY (owner_id);

CREATE TABLE public.therapist_certificates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  certificate text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--   FK owner_id -> profiles(id)
--   FK profile_id -> profiles(id)
ALTER TABLE ONLY public.therapist_certificates OWNER TO postgres;

ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_certificate_check CHECK (certificate = ANY (ARRAY['MT'::text, 'MLD'::text, 'KGG'::text]));

ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_profile_id_certificate_key UNIQUE (profile_id, certificate);

ALTER TABLE ONLY public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE TABLE public.time_offs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  employee_id uuid NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  business_id uuid,
  type text DEFAULT 'urlaub'::text,
  owner_id uuid,
  note text,
  approved_by uuid,
  approved_at timestamp with time zone
);
--   FK approved_by -> profiles(id)
--   FK business_id -> businesses(id)
--   FK employee_id -> profiles(id)
--   FK owner_id -> profiles(id)
ALTER TABLE ONLY public.time_offs OWNER TO postgres;

ALTER TABLE ONLY public.time_offs
  ADD CONSTRAINT time_offs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.time_offs
  ADD CONSTRAINT time_offs_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.time_offs
  ADD CONSTRAINT time_offs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.time_offs
  ADD CONSTRAINT time_offs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.time_offs
  ADD CONSTRAINT time_offs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.time_offs
  ADD CONSTRAINT time_offs_type_check CHECK (type = ANY (ARRAY['urlaub'::text, 'krank'::text, 'frei'::text, 'elternzeit'::text]));

CREATE TABLE public.trip_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  plan_id uuid,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  stops_visited integer DEFAULT 0,
  total_stops integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
--   FK plan_id -> trip_plans(id)
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.trip_history OWNER TO postgres;

ALTER TABLE ONLY public.trip_history
  ADD CONSTRAINT trip_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.trip_history
  ADD CONSTRAINT trip_history_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES trip_plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trip_history
  ADD CONSTRAINT trip_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE public.trip_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  accommodation_id uuid,
  title text,
  city text,
  country text,
  duration_hours numeric,
  transport_mode text,
  status text DEFAULT 'draft'::text,
  plan_data jsonb,
  total_cost_min numeric,
  total_cost_max numeric,
  currency text DEFAULT 'EUR'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
--   FK accommodation_id -> accommodations(id)
--   FK user_id -> profiles(id)
ALTER TABLE ONLY public.trip_plans OWNER TO postgres;

ALTER TABLE ONLY public.trip_plans
  ADD CONSTRAINT trip_plans_accommodation_id_fkey FOREIGN KEY (accommodation_id) REFERENCES accommodations(id);

ALTER TABLE ONLY public.trip_plans
  ADD CONSTRAINT trip_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.trip_plans
  ADD CONSTRAINT trip_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE TABLE public.ueberweisungen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  image_url text,
  arzt_name text,
  notiz text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK lead_id -> leads(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.ueberweisungen OWNER TO postgres;

ALTER TABLE ONLY public.ueberweisungen
  ADD CONSTRAINT ueberweisungen_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ueberweisungen
  ADD CONSTRAINT ueberweisungen_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id);

ALTER TABLE ONLY public.ueberweisungen
  ADD CONSTRAINT ueberweisungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.ueberweisungen
  ADD CONSTRAINT ueberweisungen_pkey PRIMARY KEY (id);

CREATE TABLE public.user_credits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  credits integer DEFAULT 2 NOT NULL,
  is_unlimited boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.user_credits OWNER TO postgres;

ALTER TABLE ONLY public.user_credits
  ADD CONSTRAINT user_credits_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_credits
  ADD CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_credits
  ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);

CREATE TABLE public.user_preferences (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  preference_key text NOT NULL,
  preference_value text,
  updated_at timestamp with time zone DEFAULT now()
);
--   FK user_id -> profiles(id)
ALTER TABLE ONLY public.user_preferences OWNER TO postgres;
COMMENT ON TABLE public.user_preferences IS 'Per-user UI prefs. Keys: selected_business (UUID), calendar_view (daily|weekly|monthly), employee_filter (UUID|all)';

ALTER TABLE ONLY public.user_preferences
  ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_preferences
  ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_preferences
  ADD CONSTRAINT user_preferences_user_id_preference_key_key UNIQUE (user_id, preference_key);

CREATE TABLE public.vehicles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  created_by uuid NOT NULL,
  kind text NOT NULL,
  kennzeichen text NOT NULL,
  label text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK created_by -> auth.users(id)
--   FK owner_id -> auth.users(id)
ALTER TABLE ONLY public.vehicles OWNER TO postgres;

ALTER TABLE ONLY public.vehicles
  ADD CONSTRAINT vehicles_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicles
  ADD CONSTRAINT vehicles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicles
  ADD CONSTRAINT vehicles_kind_check CHECK (kind = ANY (ARRAY['privat'::text, 'gewerblich'::text]));

ALTER TABLE ONLY public.vehicles
  ADD CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicles
  ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);

CREATE TABLE public.warteliste (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  lead_id uuid,
  service_id uuid,
  preferred_days jsonb DEFAULT '[]'::jsonb,
  preferred_time_from time without time zone,
  preferred_time_to time without time zone,
  notes text,
  priority smallint DEFAULT 1,
  status text DEFAULT 'waiting'::text NOT NULL,
  matched_booking_id uuid,
  notified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--   FK lead_id -> leads(id)
--   FK matched_booking_id -> bookings(id)
--   FK owner_id -> auth.users(id)
--   FK service_id -> services(id)
ALTER TABLE ONLY public.warteliste OWNER TO postgres;

ALTER TABLE ONLY public.warteliste
  ADD CONSTRAINT warteliste_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.warteliste
  ADD CONSTRAINT warteliste_matched_booking_id_fkey FOREIGN KEY (matched_booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.warteliste
  ADD CONSTRAINT warteliste_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.warteliste
  ADD CONSTRAINT warteliste_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.warteliste
  ADD CONSTRAINT warteliste_priority_check CHECK (priority >= 1 AND priority <= 3);

ALTER TABLE ONLY public.warteliste
  ADD CONSTRAINT warteliste_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.warteliste
  ADD CONSTRAINT warteliste_status_check CHECK (status = ANY (ARRAY['waiting'::text, 'matched'::text, 'cancelled'::text]));

CREATE TABLE public.working_hours (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  owner_id uuid,
  business_id uuid
);
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
--   FK user_id -> auth.users(id)
ALTER TABLE ONLY public.working_hours OWNER TO postgres;

ALTER TABLE ONLY public.working_hours
  ADD CONSTRAINT working_hours_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.working_hours
  ADD CONSTRAINT working_hours_day_of_week_check CHECK (day_of_week >= 0 AND day_of_week <= 6);

ALTER TABLE ONLY public.working_hours
  ADD CONSTRAINT working_hours_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.working_hours
  ADD CONSTRAINT working_hours_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.working_hours
  ADD CONSTRAINT working_hours_user_id_day_of_week_key UNIQUE (user_id, day_of_week);

ALTER TABLE ONLY public.working_hours
  ADD CONSTRAINT working_hours_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

CREATE TABLE public.zaa_fehler (
  id bigint DEFAULT nextval('zaa_fehler_id_seq'::regclass) NOT NULL,
  abrechnung_id uuid NOT NULL,
  prescription_id uuid,
  fehler_code text NOT NULL,
  fehler_text text,
  uebersetzung text,
  loesung_hint text,
  status text DEFAULT 'offen'::text NOT NULL,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
--   FK abrechnung_id -> abrechnung(id)
--   FK prescription_id -> prescriptions(id)
ALTER TABLE ONLY public.zaa_fehler OWNER TO postgres;

ALTER TABLE ONLY public.zaa_fehler
  ADD CONSTRAINT zaa_fehler_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES abrechnung(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.zaa_fehler
  ADD CONSTRAINT zaa_fehler_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.zaa_fehler
  ADD CONSTRAINT zaa_fehler_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zaa_fehler
  ADD CONSTRAINT zaa_fehler_status_check CHECK (status = ANY (ARRAY['offen'::text, 'in_bearbeitung'::text, 'behoben'::text, 'ignoriert'::text]));

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
--   FK business_id -> businesses(id)
--   FK owner_id -> auth.users(id)
--   FK patient_id -> leads(id)
ALTER TABLE ONLY public.zuzahlung_befreiung OWNER TO postgres;

ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_patient_id_jahr_key UNIQUE (patient_id, jahr);

ALTER TABLE ONLY public.zuzahlung_befreiung
  ADD CONSTRAINT zuzahlung_befreiung_pkey PRIMARY KEY (id);

CREATE TABLE public.zuzahlung_guthaben (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  patient_id uuid NOT NULL,
  quelle_prescription_id uuid,
  quelle_verordnung_id uuid,
  betrag_eur numeric(10,2) NOT NULL,
  rest_eur numeric(10,2) NOT NULL,
  status text DEFAULT 'offen'::text NOT NULL,
  notiz text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--   FK created_by -> auth.users(id)
--   FK owner_id -> profiles(id)
--   FK patient_id -> leads(id)
--   FK quelle_prescription_id -> prescriptions(id)
--   FK quelle_verordnung_id -> prescriptions(id)
ALTER TABLE ONLY public.zuzahlung_guthaben OWNER TO postgres;
COMMENT ON TABLE public.zuzahlung_guthaben IS 'Zuviel gezahlte Zuzahlung, die auf eine spaetere Verordnung angerechnet wird. Entsteht, wenn das Soll nach einer Korrektur unter den bereits kassierten Betrag faellt.';

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_betrag_eur_check CHECK (betrag_eur > 0::numeric);

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_ein_bezug CHECK (NOT (quelle_prescription_id IS NOT NULL AND quelle_verordnung_id IS NOT NULL));

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_quelle_prescription_id_fkey FOREIGN KEY (quelle_prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_quelle_verordnung_id_fkey FOREIGN KEY (quelle_verordnung_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_rest_eur_check CHECK (rest_eur >= 0::numeric);

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_rest_hoechstens_betrag CHECK (rest_eur <= betrag_eur);

ALTER TABLE ONLY public.zuzahlung_guthaben
  ADD CONSTRAINT zuzahlung_guthaben_status_check CHECK (status = ANY (ARRAY['offen'::text, 'teilweise_verrechnet'::text, 'verrechnet'::text, 'ausgezahlt'::text, 'verfallen'::text]));

CREATE TABLE public.zuzahlung_korrekturen (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  patient_id uuid,
  prescription_id uuid,
  verordnung_id uuid,
  alt_betrag_eur numeric(10,2),
  neu_betrag_eur numeric(10,2) NOT NULL,
  alt_einheiten integer,
  neu_einheiten integer,
  grund_code text NOT NULL,
  grund text NOT NULL,
  guthaben_id uuid,
  erfasst_von uuid,
  erfasst_am timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--   FK erfasst_von -> auth.users(id)
--   FK guthaben_id -> zuzahlung_guthaben(id)
--   FK owner_id -> profiles(id)
--   FK patient_id -> leads(id)
--   FK prescription_id -> prescriptions(id)
--   FK verordnung_id -> prescriptions(id)
ALTER TABLE ONLY public.zuzahlung_korrekturen OWNER TO postgres;
COMMENT ON TABLE public.zuzahlung_korrekturen IS 'GoBD-Protokoll jeder Aenderung am geforderten Zuzahlungsbetrag: wer, wann, alter Wert, neuer Wert, Grund. Append-only. Der GUELTIGE Betrag steht weiterhin in prescriptions.zuzahlung_eur — diese Tabelle ist das Gedaechtnis, nicht die Wahrheit.';

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_ein_bezug CHECK (NOT (prescription_id IS NOT NULL AND verordnung_id IS NOT NULL));

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_erfasst_von_fkey FOREIGN KEY (erfasst_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_grund_check CHECK (length(btrim(grund)) >= 3);

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_grund_code_check CHECK (grund_code = ANY (ARRAY['abbruch'::text, 'korrektur_soll'::text, 'guthaben_verrechnung'::text, 'befreiung_nachgereicht'::text, 'sonstiges'::text]));

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_guthaben_id_fkey FOREIGN KEY (guthaben_id) REFERENCES zuzahlung_guthaben(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_neu_betrag_eur_check CHECK (neu_betrag_eur >= 0::numeric);

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_neu_einheiten_check CHECK (neu_einheiten IS NULL OR neu_einheiten >= 0);

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.zuzahlung_korrekturen
  ADD CONSTRAINT zuzahlung_korrekturen_verordnung_id_fkey FOREIGN KEY (verordnung_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- VIEWS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.fahrten_monthly_summary WITH (security_invoker=on) AS
SELECT owner_id,
    user_id,
    vehicle_id,
    kennzeichen_snapshot,
    kind_snapshot,
    date_trunc('month'::text, fahrt_started_at) AS month,
    count(*) AS trips,
    sum(COALESCE(distance_km, 0)) AS total_km,
    sum(
        CASE
            WHEN fahrt_ended_at IS NOT NULL AND fahrt_started_at IS NOT NULL THEN EXTRACT(epoch FROM fahrt_ended_at - fahrt_started_at) / 60::numeric
            ELSE 0::numeric
        END)::integer AS total_minutes
   FROM fahrten f
  WHERE end_km IS NOT NULL
  GROUP BY owner_id, user_id, vehicle_id, kennzeichen_snapshot, kind_snapshot, (date_trunc('month'::text, fahrt_started_at));
ALTER VIEW public.fahrten_monthly_summary OWNER TO postgres;

-- [EXTENSION OWNED] View public.geography_columns (owned by extension)

-- [EXTENSION OWNED] View public.geometry_columns (owned by extension)

CREATE OR REPLACE VIEW public.kostentraeger_auswahl WITH (security_invoker=true) AS
SELECT ik,
    name,
    kurzname,
    abrechnender_kt_ik
   FROM kostentraeger kt
  WHERE datensatz_status = 'echt'::text AND active IS TRUE AND payer_type = 'gkv'::text AND (valid_from IS NULL OR valid_from <= (now() AT TIME ZONE 'Europe/Berlin'::text)::date) AND (valid_to IS NULL OR valid_to >= (now() AT TIME ZONE 'Europe/Berlin'::text)::date) AND (abrechnender_kt_ik IS NOT NULL OR (EXISTS ( SELECT 1
           FROM kostentraeger_annahmestellen ka
          WHERE ka.kostentraeger_ik = kt.ik AND (ka.valid_from IS NULL OR ka.valid_from <= (now() AT TIME ZONE 'Europe/Berlin'::text)::date) AND (ka.valid_to IS NULL OR ka.valid_to >= (now() AT TIME ZONE 'Europe/Berlin'::text)::date))));
ALTER VIEW public.kostentraeger_auswahl OWNER TO postgres;
COMMENT ON VIEW public.kostentraeger_auswahl IS 'Auswahlsicht fuer die IK-Suche im Kassenfeld (Ops #300): nur echte, aktive, heute gueltige GKV-Kostentraeger mit mindestens einem VKG -- ohne Rechenzentren und Abrechnungsstellen. ik = Karten-IK (was auf Muster 13 steht), abrechnender_kt_ik = IK, bei der abgerechnet wird (NULL = die Zeile rechnet selbst ab). security_invoker: erbt die RLS von kostentraeger, nur authenticated.';

CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker=true) AS
SELECT id,
    business_name,
    owner_first_name,
    owner_last_name,
    accepts_bookings,
    role,
    owner_id,
    booking_slug,
    avatar_url,
    anrede
   FROM profiles
  WHERE NOT (role = 'employee'::text AND is_active IS FALSE);
ALTER VIEW public.profiles_public OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- MATERIALIZED VIEWS
-- ----------------------------------------------------------------------------
-- (no materialized views defined)
