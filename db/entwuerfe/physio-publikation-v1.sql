-- LOCAL DRAFT ONLY. Not in migration chain; no activation/backfill.
-- Requires repository schema through 0111 and registry 0060/0063.
-- VKZ01 / physio / complete original bill only. No correction, partial bill,
-- Blanko, VKZ02/04/10. SQL validates persistence, not the TA1 clinical rules.
-- Lock contract: catalog shared -> owner -> header -> targeted NOWAIT FK/Rx rows
-- -> registry. Tenant writers guard old/new owners before changing stored state.
-- Catalog writers take exclusive BEFORE STATEMENT, never owner. Mixed catalog /
-- tenant write transactions are rejected (compatibility boundary). No tenant-wide
-- table locks. A busy old source writer causes a retry, never a waiting FK cycle.
-- Caller is authenticated backend service_role; owner must come from auth middleware.
-- Readback receipt is a trusted backend assertion; SQL cannot inspect Storage bytes.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN physio_source_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.abrechnung
 ADD COLUMN publication_protocol text,
 ADD COLUMN publication_state text,
 ADD COLUMN publication_key text,
 ADD COLUMN publication_payload jsonb,
 ADD COLUMN publication_payload_sha256 text,
 ADD COLUMN publication_input_sha256 text,
 ADD COLUMN publication_generation bigint,
 ADD COLUMN publication_lease_until timestamptz,
 ADD COLUMN publication_package_sha256 text,
 ADD COLUMN publication_result jsonb,
 ADD COLUMN publication_at timestamptz,
 ADD CONSTRAINT physio_publication_shape CHECK (
  (publication_protocol IS NULL AND publication_state IS NULL AND publication_key IS NULL
   AND publication_payload IS NULL AND publication_payload_sha256 IS NULL
   AND publication_input_sha256 IS NULL AND publication_generation IS NULL
   AND publication_lease_until IS NULL AND publication_package_sha256 IS NULL
   AND publication_result IS NULL AND publication_at IS NULL)
  OR (publication_protocol IS NOT NULL AND publication_protocol='physio-v1'
   AND publication_state IS NOT NULL AND publication_state IN ('preparing','published','aborted')
   AND publication_key IS NOT NULL AND publication_key ~ '^[A-Za-z0-9_-]{16,128}$'
   AND publication_payload IS NOT NULL AND jsonb_typeof(publication_payload)='object'
   AND publication_payload_sha256 IS NOT NULL AND publication_payload_sha256 ~ '^[0-9a-f]{64}$'
   AND publication_input_sha256 IS NOT NULL AND publication_input_sha256 ~ '^[0-9a-f]{64}$'
   AND publication_generation IS NOT NULL AND publication_generation>0
   AND publication_lease_until IS NOT NULL
   AND (publication_package_sha256 IS NULL OR publication_package_sha256 ~ '^[0-9a-f]{64}$')
   AND verarbeitungskennzeichen IS NOT DISTINCT FROM '01'
   AND ((publication_state='published')=(publication_result IS NOT NULL AND publication_at IS NOT NULL))));
CREATE UNIQUE INDEX physio_publication_owner_key ON public.abrechnung(owner_id,publication_key)
 WHERE publication_key IS NOT NULL;
ALTER TABLE public.abrechnung_artefakt_version
 ADD COLUMN execution_generation bigint,
 ADD COLUMN readback_sha256 text,
 ADD COLUMN readback_bytes bigint,
 ADD COLUMN readback_package_sha256 text,
 ADD COLUMN readback_at timestamptz,
 ADD CONSTRAINT physio_readback_shape CHECK (
  (readback_at IS NULL AND readback_sha256 IS NULL AND readback_bytes IS NULL AND readback_package_sha256 IS NULL)
  OR (readback_at IS NOT NULL AND execution_generation IS NOT NULL
   AND readback_sha256 IS NOT NULL AND readback_sha256=sha256
   AND readback_bytes IS NOT NULL AND readback_bytes>0
   AND readback_package_sha256 IS NOT NULL AND readback_package_sha256 ~ '^[0-9a-f]{64}$'));
CREATE TABLE public.prescription_session_abrechnungsanspruch (
 prescription_session_id uuid PRIMARY KEY REFERENCES public.prescription_sessions(id) ON DELETE RESTRICT,
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE RESTRICT,
 abrechnung_zeile_id uuid NOT NULL REFERENCES public.abrechnung_zeile(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE public.prescription_session_abrechnungsanspruch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prescription_session_abrechnungsanspruch FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.prescription_session_abrechnungsanspruch TO service_role;
-- No browser SELECT added yet: complete feature activation includes its UI/access contract.

CREATE FUNCTION public.physio_v1_hash(p_value jsonb) RETURNS text
 LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_value::text,'UTF8')),'hex') $$;

-- Global advisory namespace is explicit and reserved for this protocol only.
-- No caller-controlled GUC can skip a lock or guard. Inspect owned lock modes to
-- reject mixed write transactions; never use a flag as an authorization bypass.
CREATE FUNCTION public.physio_v1_catalog_shared() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'
  AND classid=827001::oid AND objid=1::oid AND objsubid=2 AND mode='ExclusiveLock') THEN
  RAISE EXCEPTION 'PHYSIO_MIXED_CATALOG_TENANT' USING ERRCODE='40001'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock_shared(827001,1);
END $$;
CREATE FUNCTION public.physio_v1_catalog_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'
  AND classid=827001::oid AND objid=1::oid AND objsubid=2 AND mode='ShareLock') THEN
  RAISE EXCEPTION 'PHYSIO_MIXED_TENANT_CATALOG' USING ERRCODE='40001'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(827001,1);
 RETURN NULL;
END $$;
-- Acquire shared/catalog mixed-write gate before executor takes ANY source row
-- lock. A row-only gate would allow catalog->tenant lock inversion first.
CREATE FUNCTION public.physio_v1_tenant_statement_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM public.physio_v1_catalog_shared(); RETURN NULL; END $$;
CREATE FUNCTION public.physio_v1_no_truncate() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'PHYSIO_SOURCE_TRUNCATE_FORBIDDEN' USING ERRCODE='42501'; END $$;
CREATE FUNCTION public.physio_v1_revision_no_client() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.physio_source_revision IS DISTINCT FROM OLD.physio_source_revision
  AND current_user IN ('anon','authenticated','service_role') THEN
  RAISE EXCEPTION 'PHYSIO_REVISION_RPC_ONLY' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physio_v1_revision_client BEFORE UPDATE OF physio_source_revision ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.physio_v1_revision_no_client();

CREATE FUNCTION public.physio_v1_source_owners(p_table text,p_row jsonb) RETURNS uuid[]
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid[]:='{}'; u uuid; x uuid;
BEGIN
 IF p_row IS NULL THEN RETURN a; END IF;
 IF p_table='profiles' THEN
  a:=ARRAY[coalesce((p_row->>'owner_id')::uuid,(p_row->>'id')::uuid)];
 ELSIF p_table='prescription_sessions' THEN
  SELECT owner_id INTO u FROM public.prescriptions WHERE id=(p_row->>'prescription_id')::uuid;
  IF u IS NULL THEN RAISE EXCEPTION 'PHYSIO_SESSION_OWNER_MISSING' USING ERRCODE='23503'; END IF;
  a:=ARRAY[u];
 ELSIF p_table IN ('bookings','services') THEN
  IF p_row->>'owner_id' IS NOT NULL THEN a:=array_append(a,(p_row->>'owner_id')::uuid); END IF;
  SELECT coalesce(owner_id,id) INTO u FROM public.profiles WHERE id=(p_row->>'user_id')::uuid;
  IF u IS NOT NULL THEN a:=array_append(a,u); END IF;
  IF p_table='bookings' AND p_row->>'verordnung_id' IS NOT NULL THEN
   SELECT owner_id INTO x FROM public.prescriptions WHERE id=(p_row->>'verordnung_id')::uuid;
   IF x IS NOT NULL THEN a:=array_append(a,x); END IF;
  END IF;
 ELSE a:=ARRAY[(p_row->>'owner_id')::uuid]; END IF;
 SELECT coalesce(array_agg(DISTINCT q ORDER BY q),'{}'::uuid[]) INTO a FROM unnest(a) q WHERE q IS NOT NULL;
 IF cardinality(a)=0 THEN RAISE EXCEPTION 'PHYSIO_SOURCE_OWNER_MISSING' USING ERRCODE='23503'; END IF;
 RETURN a;
END $$;

CREATE FUNCTION public.physio_v1_tenant_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o jsonb; n jsonb; owners uuid[]; again uuid[]; u uuid; self_owner boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN o:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN n:=to_jsonb(NEW); END IF;
 -- Internal revision bump must not recurse. A separate invoker trigger rejects
 -- direct client changes to this column; this is not a client-settable flag.
 IF TG_TABLE_NAME='profiles' AND TG_OP='UPDATE'
  AND (n-ARRAY['physio_source_revision','updated_at']) IS NOT DISTINCT FROM (o-ARRAY['physio_source_revision','updated_at']) THEN
  RETURN NEW;
 END IF;
 PERFORM public.physio_v1_catalog_shared();
 SELECT array_agg(DISTINCT x ORDER BY x) INTO owners FROM unnest(
  public.physio_v1_source_owners(TG_TABLE_NAME,o)||public.physio_v1_source_owners(TG_TABLE_NAME,n)) x;
 FOREACH u IN ARRAY owners LOOP
  self_owner:=TG_TABLE_NAME='profiles' AND coalesce(n->>'id',o->>'id')=u::text;
  IF NOT (self_owner AND TG_OP='INSERT') THEN
   BEGIN
    PERFORM 1 FROM public.profiles WHERE id=u FOR NO KEY UPDATE NOWAIT;
   EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION 'PHYSIO_SOURCE_OWNER_BUSY' USING ERRCODE='40001';
   END;
   IF NOT FOUND THEN RAISE EXCEPTION 'PHYSIO_SOURCE_OWNER_MISSING' USING ERRCODE='23503'; END IF;
  END IF;
 END LOOP;
 -- A parent/profile reassignment may have committed while the original row was
 -- located. Never write under a stale owner mapping; re-evaluate after locks.
 SELECT array_agg(DISTINCT x ORDER BY x) INTO again FROM unnest(
  public.physio_v1_source_owners(TG_TABLE_NAME,o)||public.physio_v1_source_owners(TG_TABLE_NAME,n)) x;
 IF again IS DISTINCT FROM owners THEN RAISE EXCEPTION 'PHYSIO_SOURCE_OWNER_CHANGED' USING ERRCODE='40001'; END IF;
 IF TG_TABLE_NAME='prescription_sessions' THEN
  IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.prescription_session_abrechnungsanspruch WHERE prescription_session_id=(o->>'id')::uuid) THEN
   RAISE EXCEPTION 'PHYSIO_CLAIMED_SESSION_FROZEN' USING ERRCODE='55000'; END IF;
 END IF;
 FOREACH u IN ARRAY owners LOOP
  self_owner:=TG_TABLE_NAME='profiles' AND coalesce(n->>'id',o->>'id')=u::text;
  IF self_owner THEN
   IF TG_OP<>'DELETE' THEN NEW.physio_source_revision:=coalesce(OLD.physio_source_revision,0)+1; END IF;
  ELSE
   UPDATE public.profiles SET physio_source_revision=physio_source_revision+1 WHERE id=u;
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','prescriptions','prescription_sessions','leads','aerzte',
  'bookings','services','therapist_certificates','zuzahlung_befreiung','prescription_documents',
  'terapeut_zertifikat','betriebsart_empfaenger','businesses'] LOOP
  EXECUTE format('CREATE TRIGGER physio_v1_source_statement BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.physio_v1_tenant_statement_guard()',t);
  EXECUTE format('CREATE TRIGGER physio_v1_source BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.physio_v1_tenant_guard()',t);
  EXECUTE format('CREATE TRIGGER physio_v1_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.physio_v1_no_truncate()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['heilmittel_katalog','heilmittel_position','heilmittel_tarif',
  'kostentraeger','kostentraeger_annahmestellen','krankenkassen','empfaenger_zertifikate'] LOOP
  EXECUTE format('CREATE TRIGGER physio_v1_catalog BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.physio_v1_catalog_guard()',t);
 END LOOP;
END $$;

-- Digest only; selected owner/Rx/dependents and relevant price-position suffixes.
-- Owner revision catches every source mutation, including INSERT/DELETE phantoms
-- and restoration of the old values. Same-owner unrelated edits conservatively
-- invalidate the draft; a different owner's writes do not touch this revision.
CREATE FUNCTION public.physio_v1_input_hash(p_owner uuid,p_payload jsonb) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n text; a jsonb; s jsonb:='{}'; w text; cols text[];
 rx uuid[]; patients uuid[]; doctors uuid[]; v_booking_ids uuid[]; serviceids uuid[]; therapists uuid[]; codes text[];
BEGIN
 PERFORM public.physio_v1_owner(p_owner);
 SELECT array_agg(x::uuid) INTO rx FROM jsonb_array_elements_text(p_payload->'prescription_ids') x;
 -- Fail closed on the complete dependency chain. UUID FKs alone do not prove
 -- tenant ownership; otherwise a B-service edit would bypass A's revision.
 IF coalesce(cardinality(rx),0)=0 OR cardinality(rx)<>(SELECT count(*) FROM public.prescriptions WHERE id=ANY(rx) AND owner_id=p_owner)
  OR EXISTS(SELECT 1 FROM public.prescriptions r WHERE r.id=ANY(rx) AND (
   (r.patient_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leads l WHERE l.id=r.patient_id AND l.owner_id=p_owner)) OR
   (r.arzt_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.aerzte a WHERE a.id=r.arzt_id AND a.owner_id=p_owner)) OR
   (r.business_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=r.business_id AND b.owner_id=p_owner))))
  OR EXISTS(SELECT 1 FROM public.prescription_sessions s WHERE s.prescription_id=ANY(rx) AND s.booking_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.bookings b JOIN public.profiles p ON p.id=b.user_id
    WHERE b.id=s.booking_id AND coalesce(p.owner_id,p.id)=p_owner
     AND (b.owner_id IS NULL OR b.owner_id=p_owner)
     AND (b.service_id IS NULL OR EXISTS(SELECT 1 FROM public.services v
      LEFT JOIN public.profiles vp ON vp.id=v.user_id WHERE v.id=b.service_id
       AND (v.owner_id IS NULL OR v.owner_id=p_owner)
       AND (v.user_id IS NULL OR coalesce(vp.owner_id,vp.id)=p_owner)
       AND (v.owner_id=p_owner OR coalesce(vp.owner_id,vp.id)=p_owner))))) THEN
  RAISE EXCEPTION 'PHYSIO_DEPENDENCY_OWNER_MISMATCH' USING ERRCODE='40001';
 END IF;
 SELECT array_agg(patient_id),array_agg(arzt_id) INTO patients,doctors FROM public.prescriptions WHERE owner_id=p_owner AND id=ANY(rx);
 SELECT array_agg(booking_id) INTO v_booking_ids FROM public.prescription_sessions WHERE prescription_id=ANY(rx);
 SELECT array_agg(service_id),array_agg(user_id) INTO serviceids,therapists FROM public.bookings WHERE id=ANY(v_booking_ids);
 SELECT array_agg(DISTINCT right(c,4)) INTO codes FROM (
  SELECT unnest(ARRAY[heilmittel_position,ergaenzend_position,'X9950','X9951','X9922']) c FROM public.prescriptions WHERE owner_id=p_owner AND id=ANY(rx)
  UNION ALL SELECT trim(both '"' from j::text) FROM public.prescriptions r,
   LATERAL jsonb_path_query(r.heilmittel_items,'$.** ? (@.type() == "string")') j
   WHERE r.owner_id=p_owner AND r.id=ANY(rx)) q WHERE c ~ '^[X0-9][0-9]{4}$';
 FOREACH n IN ARRAY ARRAY['profiles','prescriptions','prescription_sessions','leads','aerzte',
  'bookings','services','therapist_certificates','zuzahlung_befreiung','prescription_documents',
  'heilmittel_katalog','heilmittel_position','heilmittel_tarif','kostentraeger',
  'kostentraeger_annahmestellen','krankenkassen','terapeut_zertifikat',
  'betriebsart_empfaenger','empfaenger_zertifikate','businesses'] LOOP
  w:=CASE n
   WHEN 'profiles' THEN 't.id=$1 OR (t.id=ANY($8) AND t.owner_id=$1)'
   WHEN 'prescriptions' THEN 't.owner_id=$1 AND t.id=ANY($2)'
   WHEN 'prescription_sessions' THEN 't.prescription_id=ANY($2)'
   WHEN 'leads' THEN 't.owner_id=$1 AND t.id=ANY($3)'
   WHEN 'aerzte' THEN 't.owner_id=$1 AND t.id=ANY($4)'
   WHEN 'bookings' THEN 't.id=ANY($5)'
   WHEN 'services' THEN 't.id=ANY($6)'
   WHEN 'therapist_certificates' THEN 't.owner_id=$1 AND t.profile_id=ANY($8)'
   WHEN 'zuzahlung_befreiung' THEN 't.owner_id=$1 AND t.patient_id=ANY($3)'
   WHEN 'prescription_documents' THEN 't.owner_id=$1 AND t.prescription_id=ANY($2)'
   WHEN 'heilmittel_katalog' THEN 't.bereich=''physio'' AND right(t.code,4)=ANY($7)'
   WHEN 'heilmittel_position' THEN 'right(t.positionsnummer,4)=ANY($7)'
   WHEN 'heilmittel_tarif' THEN 'right(t.position_nr,4)=ANY($7) AND (t.kostentraeger_ik IS NULL OR t.kostentraeger_ik=$9)'
   WHEN 'kostentraeger' THEN 't.ik IN ($9,$10)'
   WHEN 'kostentraeger_annahmestellen' THEN 't.kostentraeger_ik=$9'
   WHEN 'krankenkassen' THEN 'EXISTS(SELECT 1 FROM public.prescriptions r WHERE r.id=ANY($2) AND r.owner_id=$1 AND r.krankenkasse_ik=t.ik_number)'
   WHEN 'terapeut_zertifikat' THEN 't.owner_id=$1'
   WHEN 'betriebsart_empfaenger' THEN 't.owner_id=$1 AND t.empfaenger_ik=$10'
   WHEN 'empfaenger_zertifikate' THEN 't.ik=$10'
   WHEN 'businesses' THEN 't.owner_id=$1 AND t.id=$11' END;
  cols:=CASE n
   WHEN 'profiles' THEN ARRAY['id','owner_id','physio_source_revision','is_active','role','business_name','sector','street','house_number','zip','city','phone','bundesland']
   WHEN 'prescriptions' THEN ARRAY['id','owner_id','patient_id','arzt_id','status','rezept_typ','rezeptart','therapie_bereich','ausstellungsdatum','behandlungsbeginn','icd10','icd10_2','diagnosegruppe','heilmittel','heilmittel_position','heilmittel_items','anzahl_einheiten','frequenz','is_dringend','hausbesuch','is_blanko','is_lhb_bvb','hausbesuch_ort','doppelbehandlung','ergaenzend_position','ergaenzend_einheiten','vorrangig_einheiten','doctor_lanr','doctor_bsnr','leitsymptomatik','pat_leitsymptomatik','zuzahlung_eur','zuzahlung_befreit','kostentraeger_ik','krankenkasse_ik','abrechnung_status','abrechnung_id','belegnummer','verordnungsnummer','business_id','bericht_angefordert','bericht_status','gueltig_bis']
   WHEN 'prescription_sessions' THEN ARRAY['id','prescription_id','booking_id','session_number','status','done_at','heilmittel_index','ergaenzend_erbracht']
   WHEN 'leads' THEN ARRAY['id','owner_id','first_name','last_name','geburtsdatum','versichertennummer','versichertenstatus','krankenkasse','patientennummer','street','plz','city']
   WHEN 'aerzte' THEN ARRAY['id','owner_id','lanr','bsnr','arzt_name']
   WHEN 'bookings' THEN ARRAY['id','user_id','service_id','hausbesuch','status','start_time','end_time']
   WHEN 'prescription_documents' THEN ARRAY['id','owner_id','prescription_id','art','storage_path','groesse_bytes','created_at']
   WHEN 'empfaenger_zertifikate' THEN ARRAY['ik','fingerprint_sha256','gueltig_von','gueltig_bis']
   ELSE NULL END;
  EXECUTE format('SELECT coalesce(jsonb_agg(v ORDER BY v::text),''[]''::jsonb) FROM (SELECT CASE WHEN $12::text[] IS NULL THEN to_jsonb(t) ELSE (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(t)) WHERE key=ANY($12)) END v FROM public.%I t WHERE %s) q',n,w)
   INTO a USING p_owner,rx,patients,doctors,v_booking_ids,serviceids,codes,therapists,p_payload->>'kostentraeger_ik',p_payload->>'empfaenger_ik',(p_payload->>'business_id')::uuid,cols;
  s:=s||jsonb_build_object(n,a);
 END LOOP;
 RETURN public.physio_v1_hash(s);
END $$;

CREATE FUNCTION public.physio_v1_owner(p_owner uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.physio_v1_catalog_shared();
 PERFORM 1 FROM public.profiles WHERE id=p_owner AND is_active IS TRUE FOR NO KEY UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.abrechnung_artefakt_freeze WHERE owner_id=p_owner) THEN
  RAISE EXCEPTION 'PHYSIO_OWNER_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 BEGIN
  PERFORM 1 FROM auth.users WHERE id=p_owner FOR KEY SHARE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'PHYSIO_AUTH_SOURCE_BUSY' USING ERRCODE='40001'; END;
END $$;

-- Trigger-visible protocol check must bypass header RLS; otherwise a hidden
-- preparing header could look absent to an INSERT trigger on abrechnung_zeile.
CREATE FUNCTION public.physio_v1_is_protocol_header(p_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.abrechnung WHERE id=p_id AND publication_protocol='physio-v1') $$;

CREATE FUNCTION public.physio_v1_guard() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
DECLARE h public.abrechnung%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='abrechnung_zeile' THEN
  IF public.physio_v1_is_protocol_header(NEW.abrechnung_id) THEN
   IF current_user IN ('anon','authenticated','service_role') THEN
    RAISE EXCEPTION 'PHYSIO_LINE_RPC_REQUIRED' USING ERRCODE='42501'; END IF;
   SELECT * INTO h FROM public.abrechnung WHERE id=NEW.abrechnung_id FOR UPDATE;
   IF h.publication_state<>'preparing' THEN RAISE EXCEPTION 'PHYSIO_LINE_NOT_PREPARING'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='prescription_session_abrechnungsanspruch' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'PHYSIO_CLAIM_IMMUTABLE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.prescription_sessions s JOIN public.prescriptions r ON r.id=s.prescription_id
    JOIN public.abrechnung_zeile z ON z.id=NEW.abrechnung_zeile_id
    WHERE s.id=NEW.prescription_session_id AND r.id=NEW.prescription_id AND r.owner_id=NEW.owner_id
      AND z.owner_id=NEW.owner_id AND z.prescription_id=r.id) THEN
   RAISE EXCEPTION 'PHYSIO_CLAIM_SCOPE'; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='abrechnung' THEN
  IF TG_OP='DELETE' THEN
   IF OLD.publication_protocol IS NOT NULL THEN RAISE EXCEPTION 'PHYSIO_HEADER_RETAIN'; END IF;
   RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.publication_protocol IS NOT NULL THEN
   IF ROW(NEW.publication_protocol,NEW.owner_id,NEW.publication_key,NEW.publication_payload,
    NEW.publication_payload_sha256,NEW.publication_input_sha256,NEW.rechnungsnummer,
    NEW.datenaustauschreferenz,NEW.transfernummer,NEW.empfaenger_ik,NEW.kostentraeger_ik,
    NEW.betriebsart,NEW.business_id,NEW.verarbeitungskennzeichen)
    IS DISTINCT FROM ROW(OLD.publication_protocol,OLD.owner_id,OLD.publication_key,OLD.publication_payload,
    OLD.publication_payload_sha256,OLD.publication_input_sha256,OLD.rechnungsnummer,
    OLD.datenaustauschreferenz,OLD.transfernummer,OLD.empfaenger_ik,OLD.kostentraeger_ik,
    OLD.betriebsart,OLD.business_id,OLD.verarbeitungskennzeichen) THEN
    RAISE EXCEPTION 'PHYSIO_REQUEST_IMMUTABLE'; END IF;
   IF OLD.publication_state='published' AND
    (to_jsonb(NEW)-ARRAY['updated_at','status','signed_storage_path','signed_sha256','signed_at',
     'signed_by_cert_thumbprint','encrypted_storage_path','encrypted_sha256','verschluesselt_am',
     'verschluesselt_fuer_fingerprint','verschluesselung_hinweis','paid_at','zaa_uploaded_at','rejected_count'])
     IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','status','signed_storage_path','signed_sha256','signed_at',
     'signed_by_cert_thumbprint','encrypted_storage_path','encrypted_sha256','verschluesselt_am',
     'verschluesselt_fuer_fingerprint','verschluesselung_hinweis','paid_at','zaa_uploaded_at','rejected_count']) THEN
    RAISE EXCEPTION 'PHYSIO_PUBLICATION_IMMUTABLE'; END IF;
   IF OLD.publication_state='aborted' AND to_jsonb(NEW)-'updated_at' IS DISTINCT FROM to_jsonb(OLD)-'updated_at' THEN
    RAISE EXCEPTION 'PHYSIO_ABORT_TERMINAL'; END IF;
  END IF;
  IF NEW.publication_protocol IS NOT NULL AND current_user IN ('anon','authenticated','service_role') THEN
   RAISE EXCEPTION 'PHYSIO_RPC_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 -- Registry: bind every new version of a protocol header to current generation.
 SELECT * INTO h FROM public.abrechnung WHERE id=NEW.abrechnung_id;
 IF TG_OP='INSERT' AND h.publication_protocol='physio-v1' AND NEW.kind IN ('signed','encrypted') THEN
  IF h.publication_state<>'published' THEN RAISE EXCEPTION 'PHYSIO_FOLLOWUP_NOT_PUBLISHED'; END IF;
  NEW.execution_generation:=h.publication_generation;
 ELSIF TG_OP='INSERT' AND h.publication_protocol='physio-v1' THEN
  IF h.publication_state<>'preparing' OR h.publication_lease_until<=clock_timestamp() THEN
   RAISE EXCEPTION 'PHYSIO_UPLOAD_NOT_PREPARING'; END IF;
  IF NEW.storage_path NOT LIKE h.owner_id::text||'/'||h.id::text||'/physio-v1/'||h.publication_generation::text||'/%' THEN
   RAISE EXCEPTION 'PHYSIO_GENERATION_PATH'; END IF;
  NEW.execution_generation:=h.publication_generation;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.execution_generation IS DISTINCT FROM OLD.execution_generation OR
    (OLD.readback_at IS NOT NULL AND ROW(NEW.readback_sha256,NEW.readback_bytes,NEW.readback_package_sha256,NEW.readback_at)
     IS DISTINCT FROM ROW(OLD.readback_sha256,OLD.readback_bytes,OLD.readback_package_sha256,OLD.readback_at)) THEN
   RAISE EXCEPTION 'PHYSIO_RECEIPT_IMMUTABLE'; END IF;
  IF NEW.state='published' AND OLD.state<>'published' AND h.publication_protocol='physio-v1' AND NEW.kind='unsigned'
    AND (NEW.execution_generation IS DISTINCT FROM h.publication_generation OR NEW.readback_at IS NULL
     OR NEW.readback_package_sha256 IS DISTINCT FROM h.publication_package_sha256) THEN
   RAISE EXCEPTION 'PHYSIO_UNVERIFIED_PUBLICATION'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physio_v1_line BEFORE INSERT ON public.abrechnung_zeile
 FOR EACH ROW EXECUTE FUNCTION public.physio_v1_guard();
CREATE TRIGGER physio_v1_header BEFORE INSERT OR UPDATE OR DELETE ON public.abrechnung
 FOR EACH ROW EXECUTE FUNCTION public.physio_v1_guard();
CREATE TRIGGER physio_v1_registry BEFORE INSERT OR UPDATE ON public.abrechnung_artefakt_version
 FOR EACH ROW EXECUTE FUNCTION public.physio_v1_guard();
CREATE TRIGGER physio_v1_claim BEFORE INSERT OR UPDATE OR DELETE ON public.prescription_session_abrechnungsanspruch
 FOR EACH ROW EXECUTE FUNCTION public.physio_v1_guard();
-- TRUNCATE is unavailable to all application roles by explicit REVOKE above.

CREATE FUNCTION public.abrechnung_idempotency_reserve(p_owner uuid,p_key text,p_payload jsonb,p_expected_input text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h public.abrechnung%ROWTYPE; v_hash text; v_input text; rx uuid[]; ss uuid[];
 v_abs text; v_mode text; v_ref bigint; v_transfer integer; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{16,128}$' OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
  OR p_payload->>'vkz' IS DISTINCT FROM '01' OR p_payload->>'bereich' IS DISTINCT FROM 'physio'
  OR jsonb_typeof(p_payload->'prescription_ids') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_payload->'session_ids') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'PHYSIO_REQUEST_INVALID' USING ERRCODE='22023'; END IF;
 v_hash:=public.physio_v1_hash(p_payload);
 PERFORM public.physio_v1_owner(p_owner);
 SELECT * INTO h FROM public.abrechnung WHERE owner_id=p_owner AND publication_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF h.publication_payload_sha256<>v_hash OR (p_expected_input IS NOT NULL AND p_expected_input<>h.publication_input_sha256) THEN
   RAISE EXCEPTION 'PHYSIO_KEY_PAYLOAD_CONFLICT' USING ERRCODE='40001'; END IF;
  IF h.publication_state='published' THEN RETURN h.publication_result||jsonb_build_object('worker_granted',false); END IF;
  IF h.publication_state='aborted' THEN RETURN jsonb_build_object('state','aborted','abrechnungId',h.id,'worker_granted',false); END IF;
  IF h.publication_lease_until>v_now THEN
   RETURN jsonb_build_object('state','preparing','worker_granted',false,'abrechnungId',h.id,'generation',h.publication_generation,
    'input_sha256',h.publication_input_sha256,'updated_at',h.updated_at::text,'lease_until',h.publication_lease_until); END IF;
  v_input:=public.physio_v1_input_hash(p_owner,p_payload);
  IF v_input<>h.publication_input_sha256 THEN RAISE EXCEPTION 'PHYSIO_INPUT_CHANGED' USING ERRCODE='40001'; END IF;
  UPDATE public.abrechnung SET publication_generation=publication_generation+1,
   publication_lease_until=v_now+interval '5 minutes',publication_package_sha256=NULL WHERE id=h.id RETURNING * INTO h;
 ELSE
  v_input:=public.physio_v1_input_hash(p_owner,p_payload);
  IF p_expected_input IS NOT NULL AND p_expected_input<>v_input THEN RAISE EXCEPTION 'PHYSIO_INPUT_CHANGED' USING ERRCODE='40001'; END IF;
  SELECT array_agg(x::uuid ORDER BY x) INTO rx FROM jsonb_array_elements_text(p_payload->'prescription_ids') x;
  SELECT array_agg(x::uuid ORDER BY x) INTO ss FROM jsonb_array_elements_text(p_payload->'session_ids') x;
  IF coalesce(cardinality(rx),0)=0 OR coalesce(cardinality(ss),0)=0
   OR cardinality(rx)<>(SELECT count(DISTINCT x) FROM unnest(rx) x)
   OR cardinality(ss)<>(SELECT count(DISTINCT x) FROM unnest(ss) x)
   OR cardinality(rx)<>(SELECT count(*) FROM public.prescriptions r WHERE r.id=ANY(rx)
    AND r.owner_id=p_owner AND r.therapie_bereich='physio' AND r.rezeptart='kassen'
    AND r.status<>'parsed' AND coalesce(r.abrechnung_status,'bereit')='bereit' AND r.abrechnung_id IS NULL
    AND NOT coalesce(r.is_blanko,false) AND r.rezept_typ='standard'
    AND r.kostentraeger_ik=p_payload->>'kostentraeger_ik')
   OR cardinality(ss)<>(SELECT count(*) FROM public.prescription_sessions s WHERE s.id=ANY(ss)
     AND s.prescription_id=ANY(rx) AND s.status='done' AND s.done_at IS NOT NULL)
   OR EXISTS(SELECT 1 FROM public.prescription_sessions s WHERE s.prescription_id=ANY(rx)
     AND (s.status='planned' OR (s.status='done' AND NOT s.id=ANY(ss))))
   OR EXISTS(SELECT 1 FROM unnest(rx) r WHERE NOT EXISTS(SELECT 1 FROM public.prescription_sessions s WHERE s.prescription_id=r AND s.id=ANY(ss)))
   OR EXISTS(SELECT 1 FROM public.prescription_session_abrechnungsanspruch WHERE prescription_session_id=ANY(ss)) THEN
   RAISE EXCEPTION 'PHYSIO_SOURCE_SCOPE_OR_CLAIM' USING ERRCODE='40001'; END IF;
  IF p_payload->>'business_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=(p_payload->>'business_id')::uuid AND b.owner_id=p_owner) THEN
   RAISE EXCEPTION 'PHYSIO_BUSINESS_SCOPE' USING ERRCODE='42501'; END IF;
  SELECT ik_nummer,betriebsart INTO v_abs,v_mode FROM public.terapeut_zertifikat WHERE owner_id=p_owner;
  IF v_abs IS NULL OR p_payload->>'empfaenger_ik' IS NULL THEN RAISE EXCEPTION 'PHYSIO_RECIPIENT_REQUIRED'; END IF;
  SELECT coalesce((SELECT betriebsart FROM public.betriebsart_empfaenger WHERE owner_id=p_owner AND empfaenger_ik=p_payload->>'empfaenger_ik'),v_mode) INTO v_mode;
  v_ref:=public.naechste_datenaustauschreferenz(p_owner,v_abs,p_payload->>'empfaenger_ik');
  v_transfer:=public.naechste_transfernummer(p_owner,v_abs,p_payload->>'empfaenger_ik');
  INSERT INTO public.abrechnung(owner_id,business_id,kostentraeger_ik,empfaenger_ik,status,verarbeitungskennzeichen,
   datenaustauschreferenz,transfernummer,rechnungsnummer,betriebsart,publication_protocol,publication_state,
   publication_key,publication_payload,publication_payload_sha256,publication_input_sha256,publication_generation,publication_lease_until)
  VALUES(p_owner,(p_payload->>'business_id')::uuid,p_payload->>'kostentraeger_ik',p_payload->>'empfaenger_ik','erstellt','01',
   v_ref,v_transfer,'R'||to_char(v_now AT TIME ZONE 'Europe/Berlin','IYYY')||'-W'||to_char(v_now AT TIME ZONE 'Europe/Berlin','IW')||'-'||lpad(v_ref::text,greatest(3,length(v_ref::text)),'0'),v_mode,
   'physio-v1','preparing',p_key,p_payload,v_hash,v_input,1,v_now+interval '5 minutes') RETURNING * INTO h;
 END IF;
 RETURN jsonb_build_object('state','preparing','worker_granted',true,'abrechnungId',h.id,'generation',h.publication_generation,
  'input_sha256',h.publication_input_sha256,'updated_at',h.updated_at::text,'lease_until',h.publication_lease_until,
  'rechnungsnummer',h.rechnungsnummer,'datenaustauschreferenz',h.datenaustauschreferenz,'transfernummer',h.transfernummer);
END $$;

-- BOOL compatibility retained. Every receipt UPDATEs the header and changes
-- its exact updated_at through the existing trigger. After ALL true receipts,
-- backend MUST owner/id-scope SELECT updated_at,publication_generation,
-- publication_package_sha256 and pass that unchanged timestamp string to final.
-- Never reuse reserveCAS, truncate precision, or skip CAS. Packagehash comes
-- from physio_v1_hash(jsonb) RPC and must match this stored packagehash.
CREATE FUNCTION public.physio_artefakt_readback(p_owner uuid,p_id uuid,p_generation bigint,p_sha256 text,p_bytes bigint,p_package_sha256 text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h public.abrechnung%ROWTYPE; r public.abrechnung_artefakt_version%ROWTYPE;
BEGIN
 PERFORM public.physio_v1_owner(p_owner);
 SELECT * INTO r FROM public.abrechnung_artefakt_version WHERE id=p_id AND owner_id=p_owner;
 IF NOT FOUND THEN RAISE EXCEPTION 'PHYSIO_ARTIFACT_SCOPE' USING ERRCODE='42501'; END IF;
 SELECT * INTO h FROM public.abrechnung WHERE id=r.abrechnung_id AND owner_id=p_owner FOR UPDATE;
 SELECT * INTO r FROM public.abrechnung_artefakt_version WHERE id=p_id FOR UPDATE;
 IF h.publication_protocol IS DISTINCT FROM 'physio-v1' OR h.publication_state<>'preparing'
  OR h.publication_generation IS DISTINCT FROM p_generation OR r.execution_generation IS DISTINCT FROM p_generation
  OR h.publication_lease_until<=clock_timestamp() OR r.state<>'reserved' OR r.upload_state<>'uploaded'
  OR p_sha256 IS NULL OR r.sha256 IS DISTINCT FROM p_sha256 OR p_bytes IS NULL OR p_bytes<=0
  OR p_package_sha256 IS NULL OR p_package_sha256 !~ '^[0-9a-f]{64}$'
  OR (h.publication_package_sha256 IS NOT NULL AND h.publication_package_sha256<>p_package_sha256) THEN
  RAISE EXCEPTION 'PHYSIO_READBACK_INVALID' USING ERRCODE='40001'; END IF;
 IF r.readback_at IS NOT NULL THEN
  IF ROW(r.readback_sha256,r.readback_bytes,r.readback_package_sha256) IS DISTINCT FROM ROW(p_sha256,p_bytes,p_package_sha256) THEN
   RAISE EXCEPTION 'PHYSIO_READBACK_CONFLICT'; END IF;
  RETURN true;
 END IF;
 UPDATE public.abrechnung SET publication_package_sha256=p_package_sha256 WHERE id=h.id;
 UPDATE public.abrechnung_artefakt_version SET readback_sha256=p_sha256,readback_bytes=p_bytes,
  readback_package_sha256=p_package_sha256,readback_at=clock_timestamp() WHERE id=p_id;
 RETURN true;
END $$;

-- Package = {dateiname,dta_segment_count,lines:[{prescription_id,belegnummer,
-- einzel_rechnungsnummer,sort_order,patient_name,versichertennummer,
-- verordnungsdatum,heilmittel_position,anzahl_einheiten,brutto_cents,
-- zuzahlung_cents,leistungen:[{session_id,positionsnummer,anzahl,einzelbetrag_cents,...}]}]}.
-- All primary/supplementary components of a session share one session_id.
-- Manifest = [{id,role,path,sha256,bytes}] exactly dta/auftrag/begleit.
CREATE FUNCTION public.abrechnung_physio_finalize(p_owner uuid,p_abrechnung uuid,p_key text,p_payload_sha256 text,
 p_input_sha256 text,p_generation bigint,p_expected_updated_at text,p_package jsonb,p_manifest jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h public.abrechnung%ROWTYPE; r public.abrechnung_artefakt_version%ROWTYPE; it jsonb; ln jsonb; comp jsonb;
 rx uuid[]; ss uuid[]; seen_rx uuid[]:='{}'; seen_ss uuid[]:='{}'; line_ss uuid[]; rid uuid; zid uuid;
 v_input text; ph text; b bigint; z bigint; total_b bigint:=0;total_z bigint:=0; calc_b bigint; v_result jsonb;
BEGIN
 PERFORM public.physio_v1_owner(p_owner);
 SELECT * INTO h FROM public.abrechnung WHERE id=p_abrechnung AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PHYSIO_HEADER_SCOPE' USING ERRCODE='42501'; END IF;
 IF h.publication_protocol IS DISTINCT FROM 'physio-v1' OR h.publication_key IS DISTINCT FROM p_key
  OR h.publication_payload_sha256 IS DISTINCT FROM p_payload_sha256 OR h.publication_input_sha256 IS DISTINCT FROM p_input_sha256 THEN
  RAISE EXCEPTION 'PHYSIO_BINDING_CONFLICT' USING ERRCODE='40001'; END IF;
 IF h.publication_state='published' THEN RETURN h.publication_result||jsonb_build_object('worker_granted',false); END IF;
 IF h.publication_state<>'preparing' OR h.publication_generation IS DISTINCT FROM p_generation
  OR h.publication_lease_until<=clock_timestamp() OR h.updated_at IS DISTINCT FROM p_expected_updated_at::timestamptz THEN
  RAISE EXCEPTION 'PHYSIO_GENERATION_OR_CAS_CONFLICT' USING ERRCODE='40001'; END IF;
 BEGIN
  PERFORM 1 FROM public.prescriptions WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(h.publication_payload->'prescription_ids')) ORDER BY id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.prescription_sessions WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(h.publication_payload->'session_ids')) ORDER BY id FOR KEY SHARE NOWAIT;
  PERFORM 1 FROM public.businesses WHERE id=h.business_id FOR KEY SHARE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN
  RAISE EXCEPTION 'PHYSIO_SOURCE_ROW_BUSY' USING ERRCODE='40001';
 END;
 IF EXISTS(SELECT 1 FROM public.abrechnung_zeile WHERE abrechnung_id=h.id) THEN RAISE EXCEPTION 'PHYSIO_EXISTING_LINES'; END IF;
 v_input:=public.physio_v1_input_hash(p_owner,h.publication_payload);
 IF v_input<>h.publication_input_sha256 THEN RAISE EXCEPTION 'PHYSIO_INPUT_CHANGED' USING ERRCODE='40001'; END IF;
 ph:=public.physio_v1_hash(p_package);
 IF ph IS NULL OR ph IS DISTINCT FROM h.publication_package_sha256 OR jsonb_typeof(p_package->'lines') IS DISTINCT FROM 'array'
  OR nullif(btrim(p_package->>'dateiname'),'') IS NULL
  OR coalesce((p_package->>'dta_segment_count')::integer,0)<=0
  OR jsonb_typeof(p_manifest) IS DISTINCT FROM 'array' OR jsonb_array_length(p_manifest)<>3
  OR (SELECT count(DISTINCT x->>'role') FROM jsonb_array_elements(p_manifest) x WHERE x->>'role' IN ('dta','auftrag','begleit'))<>3 THEN
  RAISE EXCEPTION 'PHYSIO_MANIFEST_OR_PACKAGE_INVALID' USING ERRCODE='22023'; END IF;
 FOR it IN SELECT x FROM jsonb_array_elements(p_manifest) x ORDER BY x->>'id' LOOP
  SELECT * INTO r FROM public.abrechnung_artefakt_version WHERE id=(it->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR r.owner_id<>p_owner OR r.abrechnung_id<>h.id OR r.execution_generation IS DISTINCT FROM p_generation
   OR r.state<>'reserved' OR r.upload_state<>'uploaded' OR r.kind<>'unsigned'
   OR r.role IS DISTINCT FROM it->>'role' OR r.storage_path IS DISTINCT FROM it->>'path'
   OR r.sha256 IS DISTINCT FROM it->>'sha256' OR r.readback_sha256 IS DISTINCT FROM r.sha256
   OR r.readback_bytes IS DISTINCT FROM (it->>'bytes')::bigint OR r.readback_at IS NULL
   OR (r.role='auftrag' AND r.readback_bytes<>348)
   OR r.readback_package_sha256 IS DISTINCT FROM ph THEN RAISE EXCEPTION 'PHYSIO_ARTIFACT_NOT_VERIFIED'; END IF;
 END LOOP;
 SELECT array_agg(x::uuid ORDER BY x) INTO rx FROM jsonb_array_elements_text(h.publication_payload->'prescription_ids') x;
 SELECT array_agg(x::uuid ORDER BY x) INTO ss FROM jsonb_array_elements_text(h.publication_payload->'session_ids') x;
 IF EXISTS(SELECT 1 FROM public.prescription_session_abrechnungsanspruch WHERE prescription_session_id=ANY(ss)) THEN
  RAISE EXCEPTION 'PHYSIO_SESSION_CLAIM_CONFLICT' USING ERRCODE='23505'; END IF;
 FOR ln IN SELECT x FROM jsonb_array_elements(p_package->'lines') x LOOP
  rid:=(ln->>'prescription_id')::uuid;
  IF rid IS NULL OR NOT rid=ANY(rx) OR rid=ANY(seen_rx) OR jsonb_typeof(ln->'leistungen') IS DISTINCT FROM 'array'
   OR jsonb_array_length(ln->'leistungen')=0 THEN RAISE EXCEPTION 'PHYSIO_LINE_SCOPE'; END IF;
  seen_rx:=array_append(seen_rx,rid);
  b:=(ln->>'brutto_cents')::bigint; z:=(ln->>'zuzahlung_cents')::bigint; calc_b:=0; line_ss:='{}';
  FOR comp IN SELECT x FROM jsonb_array_elements(ln->'leistungen') x LOOP
   IF NOT EXISTS(SELECT 1 FROM public.prescription_sessions s WHERE s.id=(comp->>'session_id')::uuid AND s.id=ANY(ss) AND s.prescription_id=rid AND s.status='done')
    OR comp->>'positionsnummer' IS NULL OR (comp->>'anzahl')::integer IS NULL OR (comp->>'anzahl')::integer<=0
    OR comp->>'einzelbetrag_cents' IS NULL OR (comp->>'einzelbetrag_cents')::bigint<0 THEN RAISE EXCEPTION 'PHYSIO_COMPONENT_INVALID'; END IF;
   calc_b:=calc_b+(comp->>'anzahl')::integer*(comp->>'einzelbetrag_cents')::bigint;
   IF NOT (comp->>'session_id')::uuid=ANY(line_ss) THEN line_ss:=array_append(line_ss,(comp->>'session_id')::uuid); END IF;
  END LOOP;
  IF b IS NULL OR z IS NULL OR b<0 OR z<0 OR z>b OR b<>calc_b OR nullif(btrim(ln->>'belegnummer'),'') IS NULL
   OR nullif(btrim(ln->>'einzel_rechnungsnummer'),'') IS NULL THEN RAISE EXCEPTION 'PHYSIO_LINE_TOTAL_OR_NUMBER'; END IF;
  IF EXISTS(SELECT 1 FROM public.prescriptions WHERE id=rid AND belegnummer IS NOT NULL AND belegnummer IS DISTINCT FROM ln->>'belegnummer') THEN
   RAISE EXCEPTION 'PHYSIO_BELEG_FROZEN'; END IF;
  IF EXISTS(SELECT 1 FROM public.prescriptions WHERE id=rid AND bericht_angefordert AND bericht_status<>'erledigt') THEN
   IF nullif(btrim(h.publication_payload->'bericht_override'->>rid::text),'') IS NULL THEN RAISE EXCEPTION 'PHYSIO_REPORT_MISSING'; END IF;
   INSERT INTO public.prescription_validations(prescription_id,engine,input_snapshot,result,ok,blockers_count,proceeded_anyway,validated_by,overridden_rules,proceed_reason)
    SELECT rid,'abrechnung-freigabe',jsonb_build_object('bericht_angefordert',bericht_angefordert,'bericht_status',bericht_status),
     jsonb_build_object('abrechnung_id',h.id),false,1,true,p_owner,ARRAY['THERAPIEBERICHT_FEHLT'],left(h.publication_payload->'bericht_override'->>rid::text,500)
    FROM public.prescriptions WHERE id=rid;
  END IF;
  INSERT INTO public.abrechnung_zeile(abrechnung_id,owner_id,business_id,prescription_id,kostentraeger_ik,karten_ik,
   einzel_rechnungsnummer,sort_order,belegnummer,patient_name,versichertennummer,verordnungsdatum,therapie_bereich,
   heilmittel_position,anzahl_einheiten,leistungen,brutto_eur,zuzahlung_eur,netto_eur)
   SELECT h.id,p_owner,h.business_id,rid,h.kostentraeger_ik,krankenkasse_ik,ln->>'einzel_rechnungsnummer',
    (ln->>'sort_order')::smallint,ln->>'belegnummer',ln->>'patient_name',ln->>'versichertennummer',
    (ln->>'verordnungsdatum')::date,'physio',ln->>'heilmittel_position',(ln->>'anzahl_einheiten')::integer,
    ln->'leistungen',b/100.0,z/100.0,(b-z)/100.0 FROM public.prescriptions WHERE id=rid RETURNING id INTO zid;
  INSERT INTO public.prescription_session_abrechnungsanspruch(prescription_session_id,owner_id,prescription_id,abrechnung_zeile_id)
   SELECT x,p_owner,rid,zid FROM unnest(line_ss) x;
  seen_ss:=seen_ss||line_ss; total_b:=total_b+b;total_z:=total_z+z;
  UPDATE public.prescriptions SET belegnummer=ln->>'belegnummer',abrechnung_id=h.id,abrechnung_status='in_abrechnung',status='billed' WHERE id=rid;
 END LOOP;
 IF cardinality(seen_rx)<>cardinality(rx) OR cardinality(seen_ss)<>cardinality(ss)
  OR NOT seen_ss @> ss OR NOT ss @> seen_ss THEN RAISE EXCEPTION 'PHYSIO_INCOMPLETE_MAPPING'; END IF;
 FOR it IN SELECT x FROM jsonb_array_elements(p_manifest) x LOOP
  UPDATE public.abrechnung_artefakt_version SET state='published',published_at=clock_timestamp() WHERE id=(it->>'id')::uuid;
 END LOOP;
 v_result:=jsonb_build_object('ok',true,'state','published','worker_granted',false,'abrechnungId',h.id,'rechnungsnummer',h.rechnungsnummer,
  'prescriptionCount',cardinality(rx),'zeilenGespeichert',cardinality(rx));
 UPDATE public.abrechnung SET
  storage_path=(SELECT x->>'path' FROM jsonb_array_elements(p_manifest) x WHERE x->>'role'='dta'),
  dta_sha256=(SELECT x->>'sha256' FROM jsonb_array_elements(p_manifest) x WHERE x->>'role'='dta'),
  dta_file_size=(SELECT (x->>'bytes')::integer FROM jsonb_array_elements(p_manifest) x WHERE x->>'role'='dta'),
  auftragsdatei_path=(SELECT x->>'path' FROM jsonb_array_elements(p_manifest) x WHERE x->>'role'='auftrag'),
  auftragsdatei_sha256=(SELECT x->>'sha256' FROM jsonb_array_elements(p_manifest) x WHERE x->>'role'='auftrag'),
  auftragsdatei_size=(SELECT (x->>'bytes')::integer FROM jsonb_array_elements(p_manifest) x WHERE x->>'role'='auftrag'),
  begleitzettel_path=(SELECT x->>'path' FROM jsonb_array_elements(p_manifest) x WHERE x->>'role'='begleit'),
  dateiname=p_package->>'dateiname',dta_segment_count=(p_package->>'dta_segment_count')::integer,
  prescription_count=cardinality(rx),total_eur=total_b/100.0,zuzahlung_total=total_z/100.0,
  publication_state='published',publication_at=clock_timestamp(),publication_result=v_result WHERE id=h.id;
 RETURN v_result;
END $$;

-- Explicit legacy allowlist only; deliberately EMPTY, no guessed backfill.
CREATE TABLE public.physio_storage_legacy_allowlist (
 storage_path text PRIMARY KEY,owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 abrechnung_id uuid NOT NULL REFERENCES public.abrechnung(id) ON DELETE RESTRICT,
 reviewed_at timestamptz NOT NULL,reason text NOT NULL CHECK(length(reason)>0));
ALTER TABLE public.physio_storage_legacy_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.physio_storage_legacy_allowlist FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.physio_storage_readable(p_path text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.abrechnung h
 WHERE (h.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.owner_id=h.owner_id))
 AND ((h.publication_protocol IS NULL AND (
   EXISTS(SELECT 1 FROM public.abrechnung_artefakt_version r WHERE r.abrechnung_id=h.id AND r.owner_id=h.owner_id AND r.storage_path=p_path AND r.state='published')
   OR EXISTS(SELECT 1 FROM public.physio_storage_legacy_allowlist l WHERE l.abrechnung_id=h.id AND l.owner_id=h.owner_id AND l.storage_path=p_path)))
 OR (h.publication_protocol='physio-v1' AND h.publication_state='published' AND
   EXISTS(SELECT 1 FROM public.abrechnung_artefakt_version r WHERE r.abrechnung_id=h.id AND r.owner_id=h.owner_id
    AND r.storage_path=p_path AND r.state='published' AND r.execution_generation=h.publication_generation)))) $$;

-- Application-write/execute grants: only explicitly listed service RPCs.
DO $$ DECLARE n regprocedure; BEGIN
 FOR n IN SELECT p.oid::regprocedure FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND (p.proname LIKE 'physio_v1_%' OR p.proname IN
  ('abrechnung_idempotency_reserve','physio_artefakt_readback','abrechnung_physio_finalize','physio_storage_readable')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',n);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.abrechnung_idempotency_reserve(uuid,text,jsonb,text),
 public.physio_artefakt_readback(uuid,uuid,bigint,text,bigint,text),
 public.abrechnung_physio_finalize(uuid,uuid,text,text,text,bigint,text,jsonb,jsonb) TO service_role;
-- Package digest is computed by PostgreSQL, not JSON.stringify. Only trusted
-- backend may submit the semantic package to this hash RPC; no browser grant.
GRANT EXECUTE ON FUNCTION public.physio_v1_hash(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.physio_storage_readable(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.physio_v1_is_protocol_header(uuid) TO authenticated,service_role;
COMMIT;

-- STORAGE ACTIVATION CONTRACT (INTENTIONALLY NOT EXECUTED HERE):
-- In a separate approved upgrade transaction, inventory ALL permissive SELECT/ALL
-- policies on storage.objects. Replace abrechnungen_owner_read; an added permissive
-- policy alone is unsafe (OR semantics). Target USING for abrechnungen:
-- bucket_id='abrechnungen' AND public.physio_storage_readable(name).
-- Retain unrelated buckets; reject unknown/unregistered paths. Before switching,
-- reconcile legacy published registry + reviewed allowlist; no wildcard/date fallback.
-- Existing signed URLs remain valid until expiry. New preparation must never mint one.
-- Backend service_role downloads independently require published manifest scope.
-- Header/list RLS must hide preparing protocol rows before feature activation.
-- Existing generic artefakt_publish/reg registration must not be used by new create.
-- Package is trusted backend semantic output bound to readback receipts: SHA256
-- proves byte identity, not correspondence of DTA content to line arithmetic.
-- Missing catalogue/schema capabilities must fail closed. No live/production claim.

-- RELEASE BLOCKERS: independent review; real full-chain FK/audit/trigger tests;
-- mixed catalog/tenant write transaction compatibility and tenant-level retry load; Storage RLS
-- activation reconciliation; api-backend/dsgvo/klassifikation.js + loeschen.js
-- export/category coverage and a legally approved eventual claim retention/purge
-- procedure. RESTRICT/nondelete is interim protection, not unlimited PHI retention.
