-- Migration 0060_abrechnung_artefakt_version.sql
-- SaaS: angewandt 05.10.2026 (MCP: 20261004223447).
-- M1.16 Artefakt-Registry: jede Datei im Bucket `abrechnungen` bekommt einen
-- unveraenderlichen Registry-Eintrag (Pfad/Owner/Abrechnung/Hash/Art/Rolle) und
-- einen Lebenszyklus reserved -> published -> retire_pending -> retired.
-- Die Registry SCHUETZT Dateien (DSGVO-Loeschlauf, Orphan-Bereinigung); sie
-- ersetzt keine Rechnungs-Zustandsmaschine (Header-CAS bleibt in `abrechnung`).
-- Sperrordnung: Owner-Zeile (profiles) -> abrechnung-Header -> Registry-Zeilen.
-- Client: nur Lesen (Owner-RLS). Alle Schreib-RPCs nur service_role.
-- Laufende Reservierungen werden NIE per Timeout geloescht.
-- Verschluesselte und signierte Dateien werden nie ausgemustert (kein automatischer Purge).
-- CAS ueber abrechnung.updated_at (trg_billing_updated_at setzt NOW() = Transaktionsbeginn;
-- zwei Transaktionen haben verschiedene Werte, Mikrosekunden bleiben erhalten).
-- Bestandsdateien: legacy=true, sha256 NULL erlaubt (3 DTA ohne Hash, Begleitzettel ohne Hash-Spalte).


CREATE TABLE public.abrechnung_artefakt_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  abrechnung_id uuid NOT NULL REFERENCES public.abrechnung(id) ON DELETE RESTRICT,
  storage_path  text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('unsigned','signed','encrypted')),
  role          text NOT NULL CHECK (role IN ('dta','auftrag','begleit','signed','encrypted')),
  sha256        text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  legacy        boolean NOT NULL DEFAULT false,
  state         text NOT NULL DEFAULT 'reserved'
                CHECK (state IN ('reserved','published','retire_pending','retired')),
  upload_state  text NOT NULL DEFAULT 'pending'
                CHECK (upload_state IN ('pending','uploaded','upload_failed')),
  claim_token   uuid,
  claim_error   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  retired_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artefakt_pfad_owner CHECK (storage_path LIKE owner_id::text || '/%'),
  CONSTRAINT artefakt_rolle_kind CHECK (
    (role IN ('dta','auftrag','begleit') AND kind = 'unsigned') OR
    (role = 'signed' AND kind = 'signed') OR
    (role = 'encrypted' AND kind = 'encrypted')
  ),
  CONSTRAINT artefakt_hash_pflicht CHECK (legacy OR sha256 IS NOT NULL),
  CONSTRAINT artefakt_pfad_sauber CHECK (storage_path !~ '(^|/)\.\.(/|$)' AND storage_path !~ '//'),
  CONSTRAINT artefakt_pfad_eindeutig UNIQUE (storage_path)
);

CREATE INDEX artefakt_version_abrechnung_idx
  ON public.abrechnung_artefakt_version (owner_id, abrechnung_id, state);

-- Freeze-Marker: nach Freeze keine NEUEN Reservierungen (bereits reservierte
-- Uploads duerfen abgeschlossen werden).
CREATE TABLE public.abrechnung_artefakt_freeze (
  owner_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  frozen_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.artefakt_version_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id
     OR NEW.abrechnung_id <> OLD.abrechnung_id OR NEW.storage_path <> OLD.storage_path
     OR NEW.kind <> OLD.kind OR NEW.role <> OLD.role OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.legacy <> OLD.legacy
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'artefakt_version: Identitaetsfelder sind unveraenderlich';
  END IF;
  IF NEW.state <> OLD.state AND NOT (
       (OLD.state = 'reserved'       AND NEW.state IN ('published','retire_pending')) OR
       (OLD.state = 'published'      AND NEW.state = 'retire_pending') OR
       (OLD.state = 'retire_pending' AND NEW.state = 'retired')) THEN
    RAISE EXCEPTION 'artefakt_version: Uebergang % -> % nicht erlaubt', OLD.state, NEW.state;
  END IF;
  IF NEW.upload_state <> OLD.upload_state AND OLD.upload_state <> 'pending' THEN
    RAISE EXCEPTION 'artefakt_version: upload_state ist nach Abschluss endgueltig';
  END IF;
  IF NEW.state = 'published' AND NEW.upload_state <> 'uploaded' THEN
    RAISE EXCEPTION 'artefakt_version: published nur nach erfolgreichem Upload';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER artefakt_version_guard_trg
  BEFORE UPDATE ON public.abrechnung_artefakt_version
  FOR EACH ROW EXECUTE FUNCTION public.artefakt_version_guard();

CREATE OR REPLACE FUNCTION public.artefakt_version_no_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'artefakt_version: Zeilen werden nie geloescht (retire statt delete)';
END $$;

CREATE TRIGGER artefakt_version_no_delete_trg
  BEFORE DELETE ON public.abrechnung_artefakt_version
  FOR EACH ROW EXECUTE FUNCTION public.artefakt_version_no_delete();

CREATE TRIGGER artefakt_version_no_truncate_trg
  BEFORE TRUNCATE ON public.abrechnung_artefakt_version
  FOR EACH STATEMENT EXECUTE FUNCTION public.artefakt_version_no_delete();

ALTER TABLE public.abrechnung_artefakt_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abrechnung_artefakt_freeze  ENABLE ROW LEVEL SECURITY;

CREATE POLICY artefakt_version_owner_select ON public.abrechnung_artefakt_version
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

REVOKE ALL ON public.abrechnung_artefakt_version FROM anon, authenticated;
REVOKE ALL ON public.abrechnung_artefakt_freeze  FROM anon, authenticated;
GRANT SELECT ON public.abrechnung_artefakt_version TO authenticated;
-- Lebenszyklus nur ueber die RPCs (SECURITY DEFINER schreibt als Funktionsowner).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.abrechnung_artefakt_version FROM service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.abrechnung_artefakt_freeze  FROM service_role;
GRANT SELECT ON public.abrechnung_artefakt_version, public.abrechnung_artefakt_freeze TO service_role;
COMMENT ON TABLE public.abrechnung_artefakt_version IS 'Registry aller Dateien im Bucket abrechnungen (M1.16); schuetzt Dateien vor Loeschung, ersetzt keine Rechnungs-Zustandsmaschine';
COMMENT ON TABLE public.abrechnung_artefakt_freeze IS 'Owner-Freeze (DSGVO-Loeschlauf): keine neuen Reservierungen';

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- Owner aktiv + gesperrt? Sperrt die Owner-Zeile (Lock 1).
CREATE OR REPLACE FUNCTION public.artefakt_reserve(
  p_owner uuid, p_abrechnung uuid, p_path text, p_kind text, p_role text, p_sha256 text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_owner AND is_active IS TRUE FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_reserve: Owner nicht aktiv'; END IF;
  IF EXISTS (SELECT 1 FROM public.abrechnung_artefakt_freeze WHERE owner_id = p_owner) THEN
    RAISE EXCEPTION 'artefakt_reserve: Owner eingefroren';
  END IF;
  PERFORM 1 FROM public.abrechnung WHERE id = p_abrechnung AND owner_id = p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_reserve: Abrechnung gehoert nicht zum Owner'; END IF;
  INSERT INTO public.abrechnung_artefakt_version
    (owner_id, abrechnung_id, storage_path, kind, role, sha256)
  VALUES (p_owner, p_abrechnung, p_path, p_kind, p_role, p_sha256)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.artefakt_upload_done(
  p_owner uuid, p_id uuid, p_ok boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_owner FOR NO KEY UPDATE;
  UPDATE public.abrechnung_artefakt_version
     SET upload_state = CASE WHEN p_ok THEN 'uploaded' ELSE 'upload_failed' END
   WHERE id = p_id AND owner_id = p_owner AND state = 'reserved' AND upload_state = 'pending';
  RETURN FOUND;
END $$;

-- Atomar: Registry published + Header-Patch unter NULL-aware CAS (updated_at in
-- Mikrosekunden als Text). Nur kontrollierte Patchfelder. Gibt true/false zurueck;
-- false = Versionskonflikt (Aufrufer loescht NICHT, Zeile bleibt reserved).
CREATE OR REPLACE FUNCTION public.artefakt_publish(
  p_owner uuid, p_id uuid, p_expected_updated_at text, p_patch jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reg public.abrechnung_artefakt_version%ROWTYPE;
  k text;
  v_allowed text[] := ARRAY['status','storage_path','dta_sha256','signed_storage_path','signed_sha256',
    'signed_at','signed_by_cert_thumbprint','encrypted_storage_path','encrypted_sha256','verschluesselt_am',
    'verschluesselt_fuer_fingerprint','verschluesselung_hinweis','auftragsdatei_path','auftragsdatei_sha256',
    'begleitzettel_path'];
  v_hdr public.abrechnung%ROWTYPE;
  v_new public.abrechnung%ROWTYPE;
  v_pfad text; v_hash text; v_hashfeld boolean;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_owner AND is_active IS TRUE FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_publish: Owner nicht aktiv'; END IF;
  SELECT * INTO v_reg FROM public.abrechnung_artefakt_version
   WHERE id = p_id AND owner_id = p_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_publish: unbekannte Version'; END IF;
  SELECT * INTO v_hdr FROM public.abrechnung
   WHERE id = v_reg.abrechnung_id AND owner_id = p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_publish: Abrechnung fehlt'; END IF;
  SELECT * INTO v_reg FROM public.abrechnung_artefakt_version WHERE id = p_id FOR UPDATE;
  IF v_reg.state <> 'reserved' OR v_reg.upload_state <> 'uploaded' THEN
    RAISE EXCEPTION 'artefakt_publish: Version nicht publizierbar (state=%, upload=%)', v_reg.state, v_reg.upload_state;
  END IF;
  IF v_hdr.updated_at IS DISTINCT FROM p_expected_updated_at::timestamptz THEN
    RETURN false;
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (k = ANY (v_allowed)) THEN RAISE EXCEPTION 'artefakt_publish: Patchfeld % nicht erlaubt', k; END IF;
  END LOOP;
  v_new := jsonb_populate_record(v_hdr, p_patch);
  -- Patch muss die zur Rolle gehoerende Header-Spalte auf genau diese Registry-Zeile setzen.
  v_pfad := CASE v_reg.role WHEN 'dta' THEN v_new.storage_path WHEN 'auftrag' THEN v_new.auftragsdatei_path
    WHEN 'begleit' THEN v_new.begleitzettel_path WHEN 'signed' THEN v_new.signed_storage_path
    ELSE v_new.encrypted_storage_path END;
  v_hash := CASE v_reg.role WHEN 'dta' THEN v_new.dta_sha256 WHEN 'auftrag' THEN v_new.auftragsdatei_sha256
    WHEN 'signed' THEN v_new.signed_sha256 WHEN 'encrypted' THEN v_new.encrypted_sha256 ELSE NULL END;
  v_hashfeld := v_reg.role <> 'begleit';
  IF v_pfad IS DISTINCT FROM v_reg.storage_path THEN
    RAISE EXCEPTION 'artefakt_publish: Patch zeigt nicht auf die Registry-Version';
  END IF;
  IF v_hashfeld AND v_hash IS DISTINCT FROM v_reg.sha256 THEN
    RAISE EXCEPTION 'artefakt_publish: Hash passt nicht zur Registry-Version';
  END IF;
  -- Alle anderen Pfadfelder im Ergebnis muessen unveraendert oder published-registriert sein.
  IF v_hdr.status IN ('gesendet','accepted','rejected','paid')
     AND (v_new.storage_path IS DISTINCT FROM v_hdr.storage_path
          OR v_new.auftragsdatei_path IS DISTINCT FROM v_hdr.auftragsdatei_path
          OR v_new.begleitzettel_path IS DISTINCT FROM v_hdr.begleitzettel_path
          OR v_new.encrypted_storage_path IS DISTINCT FROM v_hdr.encrypted_storage_path) THEN
    RAISE EXCEPTION 'artefakt_publish: Pfadaenderung nach Versand nicht erlaubt';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY[v_new.storage_path, v_new.auftragsdatei_path, v_new.begleitzettel_path,
        v_new.signed_storage_path, v_new.encrypted_storage_path]) pf
      WHERE pf IS NOT NULL AND pf <> v_reg.storage_path
        AND pf NOT IN (v_hdr.storage_path, v_hdr.auftragsdatei_path, v_hdr.begleitzettel_path,
                       v_hdr.signed_storage_path, v_hdr.encrypted_storage_path)
        AND NOT EXISTS (SELECT 1 FROM public.abrechnung_artefakt_version r
              WHERE r.storage_path = pf AND r.owner_id = p_owner AND r.abrechnung_id = v_reg.abrechnung_id
                AND r.state = 'published')) THEN
    RAISE EXCEPTION 'artefakt_publish: unregistrierter Pfad im Patch';
  END IF;
  UPDATE public.abrechnung SET
    status = v_new.status, storage_path = v_new.storage_path, dta_sha256 = v_new.dta_sha256,
    signed_storage_path = v_new.signed_storage_path, signed_sha256 = v_new.signed_sha256,
    signed_at = v_new.signed_at, signed_by_cert_thumbprint = v_new.signed_by_cert_thumbprint,
    encrypted_storage_path = v_new.encrypted_storage_path, encrypted_sha256 = v_new.encrypted_sha256,
    verschluesselt_am = v_new.verschluesselt_am,
    verschluesselt_fuer_fingerprint = v_new.verschluesselt_fuer_fingerprint,
    verschluesselung_hinweis = v_new.verschluesselung_hinweis,
    auftragsdatei_path = v_new.auftragsdatei_path, auftragsdatei_sha256 = v_new.auftragsdatei_sha256,
    begleitzettel_path = v_new.begleitzettel_path
   WHERE id = v_hdr.id;
  UPDATE public.abrechnung_artefakt_version
     SET state = 'published', published_at = now() WHERE id = p_id;
  RETURN true;
END $$;

-- Dauerhafter Claim: genau ein Token pro Pfad; Wiederholung liefert dasselbe Token.
-- Nie ausmusterbar: encrypted; signed nur als gescheiterter Upload; reservierte Uploads
-- die laufen oder fertig hochgeladen auf Publish warten; unsignierte DTA nur nach
-- veroeffentlichter, im Header referenzierter Signatur.
CREATE OR REPLACE FUNCTION public.artefakt_retire_claim(
  p_owner uuid, p_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reg public.abrechnung_artefakt_version%ROWTYPE;
  v_hdr public.abrechnung%ROWTYPE;
  v_aid uuid; v_tok uuid;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_owner FOR NO KEY UPDATE;
  SELECT abrechnung_id INTO v_aid FROM public.abrechnung_artefakt_version WHERE id = p_id AND owner_id = p_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_retire_claim: unbekannte Version'; END IF;
  SELECT * INTO v_hdr FROM public.abrechnung WHERE id = v_aid AND owner_id = p_owner FOR UPDATE;
  SELECT * INTO v_reg FROM public.abrechnung_artefakt_version WHERE id = p_id FOR UPDATE;
  IF v_reg.state = 'retired' THEN RETURN NULL; END IF;
  IF v_reg.state = 'retire_pending' THEN RETURN v_reg.claim_token; END IF;
  IF v_reg.role = 'encrypted' THEN RAISE EXCEPTION 'artefakt_retire_claim: verschluesselte Dateien bleiben erhalten'; END IF;
  IF v_reg.state = 'reserved' AND v_reg.upload_state <> 'upload_failed' THEN
    RAISE EXCEPTION 'artefakt_retire_claim: Upload laeuft oder wartet auf Publish';
  END IF;
  IF v_reg.role = 'signed' AND NOT (v_reg.state = 'reserved' AND v_reg.upload_state = 'upload_failed') THEN
    RAISE EXCEPTION 'artefakt_retire_claim: Signaturhistorie bleibt erhalten';
  END IF;
  IF v_reg.state = 'published' AND v_hdr.status NOT IN ('erstellt','verworfen') THEN
    RAISE EXCEPTION 'artefakt_retire_claim: nach Versand nicht erlaubt (Aufbewahrung)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.aufbewahrung_sperre WHERE owner_id = p_owner AND kategorie = 'beleg') THEN
    RAISE EXCEPTION 'artefakt_retire_claim: Aufbewahrungssperre aktiv';
  END IF;
  IF v_reg.role = 'dta' AND v_reg.state = 'published' AND NOT EXISTS (
       SELECT 1 FROM public.abrechnung_artefakt_version s
        WHERE s.abrechnung_id = v_reg.abrechnung_id AND s.role = 'signed' AND s.state = 'published'
          AND s.storage_path = v_hdr.signed_storage_path) THEN
    RAISE EXCEPTION 'artefakt_retire_claim: keine veroeffentlichte Signatur';
  END IF;
  IF v_reg.storage_path IN (COALESCE(v_hdr.storage_path,''), COALESCE(v_hdr.signed_storage_path,''),
       COALESCE(v_hdr.encrypted_storage_path,''), COALESCE(v_hdr.auftragsdatei_path,''),
       COALESCE(v_hdr.begleitzettel_path,'')) THEN
    RAISE EXCEPTION 'artefakt_retire_claim: Pfad noch referenziert';
  END IF;
  v_tok := gen_random_uuid();
  UPDATE public.abrechnung_artefakt_version
     SET state = 'retire_pending', claim_token = v_tok, claim_error = NULL WHERE id = p_id;
  RETURN v_tok;
END $$;

CREATE OR REPLACE FUNCTION public.artefakt_retire_done(
  p_owner uuid, p_id uuid, p_token uuid, p_error text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_owner FOR NO KEY UPDATE;
  IF p_error IS NOT NULL THEN
    UPDATE public.abrechnung_artefakt_version SET claim_error = left(p_error, 500)
     WHERE id = p_id AND owner_id = p_owner AND state = 'retire_pending' AND claim_token = p_token;
    RETURN false;
  END IF;
  UPDATE public.abrechnung_artefakt_version SET state = 'retired', retired_at = now()
   WHERE id = p_id AND owner_id = p_owner AND state = 'retire_pending' AND claim_token = p_token;
  RETURN FOUND;
END $$;

-- Strikt true oder Exception; verhindert nur NEUE Reservierungen.
CREATE OR REPLACE FUNCTION public.artefakt_owner_freeze(p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_owner FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_owner_freeze: Owner unbekannt'; END IF;
  INSERT INTO public.abrechnung_artefakt_freeze (owner_id) VALUES (p_owner) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.artefakt_owner_unfreeze(p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_owner FOR NO KEY UPDATE;
  DELETE FROM public.abrechnung_artefakt_freeze WHERE owner_id = p_owner;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.artefakt_owner_unfreeze(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.artefakt_owner_unfreeze(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.artefakt_reserve(uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.artefakt_upload_done(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.artefakt_publish(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.artefakt_retire_claim(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.artefakt_retire_done(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.artefakt_owner_freeze(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.artefakt_reserve(uuid,uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.artefakt_upload_done(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.artefakt_publish(uuid,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.artefakt_retire_claim(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.artefakt_retire_done(uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.artefakt_owner_freeze(uuid) TO service_role;

