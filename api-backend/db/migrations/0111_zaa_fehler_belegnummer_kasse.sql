-- ZAA: rohe Belegnummer der Kasse mitspeichern (06.11.2026).
--
-- WAS: (1) neue Spalte zaa_fehler.belegnummer_kasse (nullable);
--      (2) zaa_fehler_anwenden schreibt sie aus p_fehler[].belegnummer_kasse mit. Signatur unveraendert.
-- WARUM: Die Kasse meldet Fehler je Belegnummer. Bisher wurde die Nummer nur in prescription_id uebersetzt
--      und dann verworfen (api-backend/billing/zaa/anwenden.js). Fehler, deren Beleg keiner Verordnung zugeordnet
--      werden konnte, waren danach nicht mehr nachverfolgbar — genau die, die die Praxis von Hand pruefen muss.
--      Die Korrekturrechnung braucht die urspruengliche Belegnummer (Anlage 1 TP5 V21 Kap. 7, URI-Segment).
--      Entscheidung gkv-302, 06.11.2026.
-- Expand-only: :stable sendet den Schluessel nicht, die Spalte bleibt dort NULL. Rueckfall auf die alte Funktion
--      verliert nur die neue Spalte, sonst nichts.
-- Grants: CREATE OR REPLACE behaelt Owner und Grants; REVOKE/GRANT wie in 0061 trotzdem wiederholt (idempotent),
--      damit eine neue Box denselben Stand hat, auch wenn die Funktion dort frisch entsteht.
-- ZAEHLER: fonksiyon +0, trigger +0, index +0, tablo +0, rls_policy +0; neue Spalte zaa_fehler.belegnummer_kasse.
-- SaaS: angewandt 06.11.2026, Supabase MCP apply_migration (Kemal GO 06.11., Spalte + Funktionsrechte danach geprüft).

ALTER TABLE public.zaa_fehler
  ADD COLUMN IF NOT EXISTS belegnummer_kasse text;

CREATE OR REPLACE FUNCTION public.zaa_fehler_anwenden(p_owner uuid, p_abrechnung uuid, p_expected_updated_at text, p_fehler jsonb, p_gruende jsonb, p_vord_status text, p_datum date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_hdr public.abrechnung%ROWTYPE;
  g jsonb;
  v_zeilen int := 0;
  n int;
BEGIN
  IF jsonb_typeof(p_fehler) <> 'array' OR jsonb_array_length(p_fehler) = 0 THEN
    RAISE EXCEPTION 'zaa_fehler_anwenden: leere Fehlerliste';
  END IF;
  IF jsonb_typeof(p_gruende) <> 'array' THEN
    RAISE EXCEPTION 'zaa_fehler_anwenden: gruende muss Array sein';
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_owner AND is_active IS TRUE FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'zaa_fehler_anwenden: Owner nicht aktiv'; END IF;
  SELECT * INTO v_hdr FROM public.abrechnung WHERE id = p_abrechnung AND owner_id = p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'zaa_fehler_anwenden: Abrechnung nicht gefunden'; END IF;
  IF v_hdr.updated_at IS DISTINCT FROM p_expected_updated_at::timestamptz THEN
    RETURN jsonb_build_object('konflikt', true);
  END IF;

  DELETE FROM public.zaa_fehler WHERE abrechnung_id = p_abrechnung;
  INSERT INTO public.zaa_fehler (abrechnung_id, prescription_id, fehler_code, fehler_text, uebersetzung, loesung_hint, status, belegnummer_kasse)
  SELECT p_abrechnung, NULLIF(e->>'prescription_id','')::uuid, e->>'fehler_code', e->>'fehler_text',
         e->>'uebersetzung', e->>'loesung_hint', 'offen', left(NULLIF(e->>'belegnummer_kasse',''), 64)
    FROM jsonb_array_elements(p_fehler) e;

  UPDATE public.abrechnung
     SET status = 'rejected', rejected_count = jsonb_array_length(p_gruende), zaa_uploaded_at = now()
   WHERE id = p_abrechnung;

  FOR g IN SELECT * FROM jsonb_array_elements(p_gruende) LOOP
    UPDATE public.prescriptions
       SET abrechnung_status = p_vord_status, absetzung_grund = left(g->>'grund', 2000), absetzung_am = p_datum
     WHERE id = (g->>'prescription_id')::uuid AND owner_id = p_owner;
    UPDATE public.abrechnung_zeile
       SET status = 'abgesetzt', absetzung_grund = left(g->>'grund', 2000), absetzung_am = p_datum
     WHERE abrechnung_id = p_abrechnung AND prescription_id = (g->>'prescription_id')::uuid;
    GET DIAGNOSTICS n = ROW_COUNT;
    v_zeilen := v_zeilen + n;
  END LOOP;

  RETURN jsonb_build_object('konflikt', false, 'zeilen', v_zeilen, 'fehler', jsonb_array_length(p_fehler));
END $function$;

REVOKE ALL ON FUNCTION public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date) TO service_role;
