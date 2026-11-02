-- Ops #251 — Reduzierung der verordneten Einheiten (Patient bricht ab, Arzt kuerzt) revisionssicher.
-- Entwurf db-ustasi (02.11.2026); gkv-302: nur der Inhaber darf korrigieren. Vorbild: zuzahlung_korrekturen.
-- Append-only Protokoll + RPC einheiten_korrigieren(), damit Protokollzeile, anzahl_einheiten und
-- Sitzungs-Bereinigung in EINER Transaktion laufen. GoBD: Sitzungen werden nie geloescht, nur 'cancelled'.
-- ZAEHLER: public_tablo +1, rls_policy +2, fonksiyon +3, trigger +3, index +3.
-- SaaS: angewandt 02.11.2026, MCP apply_migration (Kemal-Freigabe; vorher Rollback-Probe auf Live, 9 Faelle ok).

CREATE TABLE IF NOT EXISTS public.einheiten_korrekturen (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.profiles(id),
  business_id     uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id),
  heilmittel_index integer,
  alt             integer NOT NULL,
  neu             integer NOT NULL,
  grund           text NOT NULL,
  von             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  am              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT einheiten_korrekturen_neu_kleiner CHECK (neu < alt AND neu >= 0),
  CONSTRAINT einheiten_korrekturen_grund_check CHECK (length(btrim(grund)) >= 5)
);
ALTER TABLE public.einheiten_korrekturen OWNER TO postgres;
COMMENT ON TABLE public.einheiten_korrekturen IS 'GoBD-Protokoll jeder Reduzierung von prescriptions.anzahl_einheiten (nur Verringerung, nur Inhaber). Append-only. Gueltig ist prescriptions.anzahl_einheiten.';

CREATE INDEX IF NOT EXISTS idx_einheiten_korrekturen_owner ON public.einheiten_korrekturen (owner_id, am DESC);
CREATE INDEX IF NOT EXISTS idx_einheiten_korrekturen_rezept ON public.einheiten_korrekturen (prescription_id, am DESC);

CREATE OR REPLACE FUNCTION public.prevent_einheiten_korrekturen_mod()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION 'Das Einheiten-Korrekturprotokoll ist unveraenderlich (GoBD). Eine falsche Korrektur wird durch eine NEUE Korrektur richtiggestellt.';
END;
$function$;
ALTER FUNCTION public.prevent_einheiten_korrekturen_mod() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prevent_einheiten_korrekturen_mod() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.einheiten_korrekturen_mandant_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.prescriptions p
                 WHERE p.id = NEW.prescription_id AND p.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'einheiten_korrekturen: Verordnung gehoert nicht zu diesem Mandanten'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.einheiten_korrekturen_mandant_pruefen() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.einheiten_korrekturen_mandant_pruefen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_einheiten_korrekturen_mod ON public.einheiten_korrekturen;
CREATE TRIGGER trg_prevent_einheiten_korrekturen_mod BEFORE DELETE OR UPDATE ON public.einheiten_korrekturen
  FOR EACH ROW EXECUTE FUNCTION public.prevent_einheiten_korrekturen_mod();
DROP TRIGGER IF EXISTS einheiten_korrekturen_mandant_pruefen ON public.einheiten_korrekturen;
CREATE TRIGGER einheiten_korrekturen_mandant_pruefen BEFORE INSERT ON public.einheiten_korrekturen
  FOR EACH ROW EXECUTE FUNCTION public.einheiten_korrekturen_mandant_pruefen();
DROP TRIGGER IF EXISTS trg_set_business_id ON public.einheiten_korrekturen;
CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.einheiten_korrekturen
  FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();

ALTER TABLE public.einheiten_korrekturen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Einheiten-Korrekturen select scoping" ON public.einheiten_korrekturen;
CREATE POLICY "Einheiten-Korrekturen select scoping" ON public.einheiten_korrekturen
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (auth.uid() = owner_id OR auth.uid() IN (
    SELECT p.id FROM public.profiles p WHERE p.owner_id = einheiten_korrekturen.owner_id));

-- gkv-302: nur der Inhaber schreibt (kein Team-Zweig wie bei zuzahlung_korrekturen).
DROP POLICY IF EXISTS "Einheiten-Korrekturen insert owner" ON public.einheiten_korrekturen;
CREATE POLICY "Einheiten-Korrekturen insert owner" ON public.einheiten_korrekturen
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (auth.uid() = owner_id);

-- ── RPC ─────────────────────────────────────────────────────────────────────
-- SECURITY INVOKER: RLS gilt weiter (Mandantenschutz), Owner-Pruefung zusaetzlich explizit.
-- Aufruf nur mit Nutzer-JWT (auth.uid() muss der Inhaber sein); service_role ohne uid wird abgewiesen.
-- p_heilmittel_index: Pflicht bei mehreren vorrangigen Heilmitteln (heilmittel_items mit einheiten), sonst NULL.
-- Doppelbehandlung: ein Termin = zwei Einheiten (terminZiel in module/sitzung-abgleich.js). Deshalb wird
-- Einheiten NIE direkt mit der Sitzungszahl verglichen, sondern Ziel-Sitzungen = ceil(neu/2).
-- Rueckgabe: {alt, neu, abgesagt: n, termin_offen: [{session_id, session_number, booking_id}]}
--   alt/neu = Einheiten des korrigierten Heilmittels; termin_offen = NUR die Sitzungen, die zu viel sind
--   und an einem Termin haengen (nicht angefasst, der Aufrufer fragt die Praxis).
CREATE OR REPLACE FUNCTION public.einheiten_korrigieren(p_id uuid, p_neu integer, p_grund text, p_heilmittel_index integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_rx       public.prescriptions%ROWTYPE;
  v_mehrere  boolean;
  v_index    integer := 0;
  v_alt      integer;
  v_doppel   boolean;
  v_summe    integer;
  v_items    jsonb;
  v_done     integer;
  v_aktiv    integer;
  v_ziel     integer;
  v_zuviel   integer;
  v_abgesagt integer := 0;
  v_offen    jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  IF p_grund IS NULL OR length(btrim(p_grund)) < 5 THEN
    RAISE EXCEPTION 'Begruendung (mind. 5 Zeichen) erforderlich' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_rx FROM public.prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verordnung nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF v_rx.owner_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Nur der Inhaber darf Einheiten korrigieren' USING ERRCODE = '42501';
  END IF;
  IF v_rx.belegnummer IS NOT NULL THEN
    RAISE EXCEPTION 'Verordnung ist bereits eingereicht (festgeschrieben)' USING ERRCODE = 'check_violation';
  END IF;
  IF v_rx.therapie_bereich IS NULL OR v_rx.therapie_bereich NOT IN ('physio', 'ergo') THEN
    RAISE EXCEPTION 'Einheiten-Korrektur nur fuer Physio/Ergo' USING ERRCODE = 'check_violation';
  END IF;

  v_mehrere := jsonb_typeof(v_rx.heilmittel_items) = 'array'
               AND jsonb_array_length(v_rx.heilmittel_items) > 0
               AND (v_rx.heilmittel_items -> 0) ? 'einheiten';
  IF v_mehrere THEN
    IF p_heilmittel_index IS NULL OR p_heilmittel_index < 0
       OR p_heilmittel_index >= jsonb_array_length(v_rx.heilmittel_items) THEN
      RAISE EXCEPTION 'Bitte das zu korrigierende Heilmittel angeben' USING ERRCODE = '22023';
    END IF;
    v_index  := p_heilmittel_index;
    v_alt    := (v_rx.heilmittel_items -> v_index ->> 'einheiten')::integer;
    v_doppel := COALESCE((v_rx.heilmittel_items -> v_index ->> 'doppelbehandlung')::boolean, false);
  ELSE
    IF p_heilmittel_index IS NOT NULL AND p_heilmittel_index <> 0 THEN
      RAISE EXCEPTION 'Diese Verordnung hat nur ein Heilmittel' USING ERRCODE = '22023';
    END IF;
    v_alt    := COALESCE(v_rx.vorrangig_einheiten, v_rx.anzahl_einheiten);
    v_doppel := COALESCE(v_rx.doppelbehandlung, false);
  END IF;

  IF v_alt IS NULL OR p_neu IS NULL OR p_neu >= v_alt OR p_neu < 1 THEN
    RAISE EXCEPTION 'Neue Einheitenzahl muss kleiner als die bisherige und mindestens 1 sein' USING ERRCODE = '22023';
  END IF;

  v_ziel := CASE WHEN v_doppel THEN (p_neu + 1) / 2 ELSE p_neu END;

  SELECT count(*) FILTER (WHERE status = 'done'),
         count(*) FILTER (WHERE status IN ('planned', 'done'))
    INTO v_done, v_aktiv
    FROM public.prescription_sessions
   WHERE prescription_id = p_id AND COALESCE(heilmittel_index, 0) = v_index;
  IF v_ziel < v_done THEN
    RAISE EXCEPTION 'Bereits % Termine erbracht - weniger nicht moeglich', v_done USING ERRCODE = 'check_violation';
  END IF;

  -- Summe nach der Korrektur; ein ergaenzendes Heilmittel darf sie nicht ueberschreiten (HeilM-RL § 7 Abs. 5).
  v_summe := COALESCE(v_rx.anzahl_einheiten, v_alt) - v_alt + p_neu;
  IF v_rx.ergaenzend_einheiten IS NOT NULL AND v_rx.ergaenzend_einheiten > v_summe THEN
    RAISE EXCEPTION 'Das ergaenzende Heilmittel (% Einheiten) waere dann hoeher als die vorrangigen (%)',
      v_rx.ergaenzend_einheiten, v_summe USING ERRCODE = 'check_violation';
  END IF;

  -- Ueberzaehlige geplante Sitzungen OHNE Termin absagen (hoechste Nummer zuerst). Nie loeschen.
  v_zuviel := GREATEST(v_aktiv - v_ziel, 0);
  IF v_zuviel > 0 THEN
    WITH z AS (
      SELECT id FROM public.prescription_sessions
       WHERE prescription_id = p_id AND COALESCE(heilmittel_index, 0) = v_index
         AND status = 'planned' AND booking_id IS NULL
       ORDER BY session_number DESC LIMIT v_zuviel
       FOR UPDATE
    ), u AS (
      UPDATE public.prescription_sessions s SET status = 'cancelled'
        FROM z WHERE s.id = z.id RETURNING s.id
    )
    SELECT count(*) INTO v_abgesagt FROM u;
  END IF;

  IF v_mehrere THEN
    v_items := jsonb_set(v_rx.heilmittel_items, ARRAY[v_index::text, 'einheiten'], to_jsonb(p_neu));
    UPDATE public.prescriptions
       SET anzahl_einheiten = v_summe,
           heilmittel_items = v_items,
           vorrangig_einheiten = CASE WHEN v_index = 0 THEN p_neu ELSE vorrangig_einheiten END
     WHERE id = p_id;
  ELSE
    UPDATE public.prescriptions
       SET anzahl_einheiten = p_neu,
           vorrangig_einheiten = CASE WHEN vorrangig_einheiten IS NULL THEN NULL ELSE p_neu END
     WHERE id = p_id;
  END IF;

  INSERT INTO public.einheiten_korrekturen (owner_id, prescription_id, heilmittel_index, alt, neu, grund, von)
  VALUES (v_rx.owner_id, p_id, CASE WHEN v_mehrere THEN v_index END, v_alt, p_neu, btrim(p_grund), v_uid);

  -- Noch ueberzaehlig, aber an einen Termin gebunden: nicht angefasst, dem Aufrufer melden (hoechste zuerst).
  SELECT COALESCE(jsonb_agg(t ORDER BY (t ->> 'session_number')::integer), '[]'::jsonb)
    INTO v_offen
    FROM (
      SELECT jsonb_build_object('session_id', s.id, 'session_number', s.session_number, 'booking_id', s.booking_id) AS t
        FROM public.prescription_sessions s
       WHERE s.prescription_id = p_id AND COALESCE(s.heilmittel_index, 0) = v_index
         AND s.status = 'planned' AND s.booking_id IS NOT NULL
       ORDER BY s.session_number DESC
       LIMIT GREATEST(v_zuviel - v_abgesagt, 0)
    ) x;

  RETURN jsonb_build_object('alt', v_alt, 'neu', p_neu, 'abgesagt', v_abgesagt, 'termin_offen', v_offen);
END;
$function$;
ALTER FUNCTION public.einheiten_korrigieren(uuid, integer, text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.einheiten_korrigieren(uuid, integer, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.einheiten_korrigieren(uuid, integer, text, integer) TO authenticated, service_role;
