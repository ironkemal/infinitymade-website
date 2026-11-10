-- 0114_zaa_import_idempotenz.sql — ZAA-Datei zweimal hochgeladen aendert nichts (07.11.2026).
--
-- WAS: (1) neue Tabelle zaa_import (abrechnung_id, sha256) = "diese Datei ist fuer diese Abrechnung angewandt";
--      (2) zaa_fehler_anwenden bekommt den optionalen 8. Parameter p_sha256 text DEFAULT NULL.
-- WARUM: zaa_fehler_anwenden (0061/0111) ersetzt den Fehlerbestand vollstaendig; ein wiederholter Upload derselben
--      Datei verschob bisher absetzung_am / zaa_uploaded_at. Mit Hash wird die Wiederholung erkannt und ausgelassen.
--      Eine ANDERE (spaetere) ZAA-Datei wird weiter normal angewandt. Entwurf db/entwuerfe/zaa-import-idempotenz.sql,
--      Melih GO 07.11.2026. Backend: billing/zaa/anwenden.js sendet p_sha256 nur bei idempotenz=true (Flag, Standard aus).
-- Signatur: alte 7-Parameter-Funktion wird im selben Transaktionsschritt ersetzt (DROP + CREATE), sonst waere ein
--      7-Argument-Aufruf ueber PostgREST mehrdeutig. :stable ruft mit 7 benannten Argumenten -> trifft die neue
--      Funktion ueber den DEFAULT, Verhalten unveraendert (p_sha256 NULL = alter Pfad). Kural 4 erfuellt.
-- Abweichung vom Entwurf: service_role bekommt nur SELECT (Auskunft), kein INSERT — eine Zeile darf nur
--      zusammen mit der Anwendung entstehen (SECURITY DEFINER-RPC), sonst liesse sich eine Datei als
--      "angewandt" markieren, ohne dass etwas angewandt wurde.
-- ZAEHLER: tablo +1, index +1 (PK), fonksiyon +0 (−1/+1), trigger +0, rls_policy +0 (RLS an, keine Policy:
--      kein Browserzugriff). Gemessen siehe erwartete-zaehler.json _hinweis_0112_0115.
-- SaaS: angewandt 10.11.2026, Supabase Management-API (SQL) + Ledger-Eintrag supabase_migrations
--      (Gate O-129 laesst diese Zeile absichtlich nicht durch.)

CREATE TABLE public.zaa_import (
  abrechnung_id uuid NOT NULL REFERENCES public.abrechnung(id) ON DELETE CASCADE,
  sha256        text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  angewendet_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (abrechnung_id, sha256)
);
COMMENT ON TABLE public.zaa_import IS
  $$ZAA-Idempotenz (0114): SHA-256 der Kassenrueckmeldungsdatei je Abrechnung, geschrieben nur von zaa_fehler_anwenden. Kein Dateiinhalt, keine Patientendaten.$$;
ALTER TABLE public.zaa_import ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.zaa_import FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.zaa_import TO service_role;

DROP FUNCTION public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date);

CREATE FUNCTION public.zaa_fehler_anwenden(p_owner uuid, p_abrechnung uuid, p_expected_updated_at text, p_fehler jsonb, p_gruende jsonb, p_vord_status text, p_datum date, p_sha256 text DEFAULT NULL)
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

  -- 0114: gleiche Datei fuer dieselbe Abrechnung schon angewandt -> nichts aendern.
  IF p_sha256 IS NOT NULL THEN
    IF p_sha256 !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'zaa_fehler_anwenden: ungueltiger Datei-Hash' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.zaa_import WHERE abrechnung_id = p_abrechnung AND sha256 = p_sha256) THEN
      RETURN jsonb_build_object('konflikt', false, 'wiederholt', true);
    END IF;
    INSERT INTO public.zaa_import (abrechnung_id, sha256) VALUES (p_abrechnung, p_sha256);
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

REVOKE ALL ON FUNCTION public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date,text) TO service_role;
