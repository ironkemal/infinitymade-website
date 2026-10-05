-- Migration 0063_artefakt_registriere_veroeffentlicht.sql
-- SaaS: angewandt 05.10.2026 (MCP: 20261005102742).
-- M1.16: Nachregistrierung bereits veroeffentlichter Abrechnungsdateien in der Registry (0060).
-- Zwei Zwecke:
--   1. Die Erzeugungswege (create / create-podologie / korrektur) haben die Datei schon unter einem
--      eindeutigen Pfad hochgeladen und den Header darauf zeigen lassen; sie melden sie hier an
--      (artefakt_registriere_veroeffentlicht), damit auch DTA/Auftragsdatei/Begleitzettel geschuetzt sind.
--   2. Backfill der Bestandsdateien (legacy=true, Hash NULL erlaubt, wenn der Header keinen kennt).
-- Die Funktion legt NUR Zeilen an, deren Pfad exakt der Header-Spalte der Rolle entspricht und deren Hash
-- (sofern der Header einen kennt) passt; bereits registrierte Pfade bleiben unveraendert (idempotent).
-- Sperrordnung: Owner (profiles) -> abrechnung-Header -> Registry.

CREATE OR REPLACE FUNCTION public.artefakt_registriere_veroeffentlicht(
  p_owner uuid, p_abrechnung uuid, p_items jsonb, p_legacy boolean DEFAULT false
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hdr public.abrechnung%ROWTYPE;
  it jsonb;
  v_path text; v_kind text; v_role text; v_sha text;
  v_hpfad text; v_hhash text; v_n integer := 0; v_ex public.abrechnung_artefakt_version%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'artefakt_registriere: items muss Array sein'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_owner FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_registriere: Owner unbekannt'; END IF;
  SELECT * INTO v_hdr FROM public.abrechnung WHERE id = p_abrechnung AND owner_id = p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'artefakt_registriere: Abrechnung nicht gefunden'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_path := it->>'path'; v_kind := it->>'kind'; v_role := it->>'role'; v_sha := NULLIF(it->>'sha256','');
    v_hpfad := CASE v_role WHEN 'dta' THEN v_hdr.storage_path WHEN 'auftrag' THEN v_hdr.auftragsdatei_path
      WHEN 'begleit' THEN v_hdr.begleitzettel_path WHEN 'signed' THEN v_hdr.signed_storage_path
      WHEN 'encrypted' THEN v_hdr.encrypted_storage_path END;
    v_hhash := CASE v_role WHEN 'dta' THEN v_hdr.dta_sha256 WHEN 'auftrag' THEN v_hdr.auftragsdatei_sha256
      WHEN 'signed' THEN v_hdr.signed_sha256 WHEN 'encrypted' THEN v_hdr.encrypted_sha256 ELSE NULL END;
    IF v_path IS NULL OR v_path IS DISTINCT FROM v_hpfad THEN
      RAISE EXCEPTION 'artefakt_registriere: Pfad entspricht nicht der Header-Spalte der Rolle %', v_role;
    END IF;
    IF v_hhash IS NOT NULL AND v_sha IS NOT NULL AND v_hhash IS DISTINCT FROM v_sha THEN
      RAISE EXCEPTION 'artefakt_registriere: Hash passt nicht zum Header (Rolle %)', v_role;
    END IF;
    IF v_sha IS NULL THEN v_sha := v_hhash; END IF;
    IF v_sha IS NULL AND NOT p_legacy THEN
      RAISE EXCEPTION 'artefakt_registriere: Hash fehlt (Rolle %)', v_role;
    END IF;
    SELECT * INTO v_ex FROM public.abrechnung_artefakt_version WHERE storage_path = v_path FOR UPDATE;
    IF FOUND THEN
      IF v_ex.owner_id <> p_owner OR v_ex.abrechnung_id <> p_abrechnung OR v_ex.role <> v_role THEN
        RAISE EXCEPTION 'artefakt_registriere: Pfad bereits anders registriert';
      END IF;
      CONTINUE;
    END IF;
    INSERT INTO public.abrechnung_artefakt_version
      (owner_id, abrechnung_id, storage_path, kind, role, sha256, legacy, state, upload_state, published_at)
    VALUES (p_owner, p_abrechnung, v_path, v_kind, v_role, v_sha, p_legacy OR v_sha IS NULL,
            'published', 'uploaded', now());
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.artefakt_registriere_veroeffentlicht(uuid,uuid,jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.artefakt_registriere_veroeffentlicht(uuid,uuid,jsonb,boolean) TO service_role;

-- Backfill der Bestandsdateien: je Header die aktuell referenzierten Pfade als legacy registrieren.
-- Pfade ausserhalb des Owner-Ordners (CHECK artefakt_pfad_owner) werden uebersprungen, nie geraten.
DO $backfill$
DECLARE h public.abrechnung%ROWTYPE; items jsonb;
BEGIN
  FOR h IN SELECT * FROM public.abrechnung ORDER BY created_at LOOP
    items := '[]'::jsonb;
    IF h.storage_path IS NOT NULL AND h.storage_path LIKE h.owner_id::text || '/%' THEN
      items := items || jsonb_build_object('path', h.storage_path, 'kind', 'unsigned', 'role', 'dta', 'sha256', h.dta_sha256); END IF;
    IF h.auftragsdatei_path IS NOT NULL AND h.auftragsdatei_path LIKE h.owner_id::text || '/%' THEN
      items := items || jsonb_build_object('path', h.auftragsdatei_path, 'kind', 'unsigned', 'role', 'auftrag', 'sha256', h.auftragsdatei_sha256); END IF;
    IF h.begleitzettel_path IS NOT NULL AND h.begleitzettel_path LIKE h.owner_id::text || '/%' THEN
      items := items || jsonb_build_object('path', h.begleitzettel_path, 'kind', 'unsigned', 'role', 'begleit', 'sha256', NULL); END IF;
    IF h.signed_storage_path IS NOT NULL AND h.signed_storage_path LIKE h.owner_id::text || '/%' THEN
      items := items || jsonb_build_object('path', h.signed_storage_path, 'kind', 'signed', 'role', 'signed', 'sha256', h.signed_sha256); END IF;
    IF h.encrypted_storage_path IS NOT NULL AND h.encrypted_storage_path LIKE h.owner_id::text || '/%' THEN
      items := items || jsonb_build_object('path', h.encrypted_storage_path, 'kind', 'encrypted', 'role', 'encrypted', 'sha256', h.encrypted_sha256); END IF;
    IF jsonb_array_length(items) > 0 THEN
      BEGIN
        PERFORM public.artefakt_registriere_veroeffentlicht(h.owner_id, h.id, items, true);
      EXCEPTION WHEN OTHERS THEN
        -- Ein auffaelliger Header (z. B. doppelt referenzierter Pfad) darf die Kette nicht stoppen; nie raten.
        RAISE NOTICE 'artefakt-backfill: Header % uebersprungen (%)', h.id, SQLERRM;
      END;
    END IF;
  END LOOP;
END $backfill$;
