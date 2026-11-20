-- SaaS: ausstehend (Freigabe erforderlich). Lokal versioniert und geprüft.
-- Entwürfe bleiben ohne buchbare Einheiten. Beim Bestätigen entsteht der
-- erste Sitzungsplan in derselben Transaktion, auch ohne Browser-Nacharbeit.
CREATE FUNCTION public.physio_sitzungsplan_initialisieren(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  rx public.prescriptions%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO rx FROM public.prescriptions WHERE id = p_id
    AND therapie_bereich = 'physio' AND status IN ('confirmed','in_therapy')
    AND abrechnung_status IS NULL
    AND belegnummer IS NULL AND abrechnung_id IS NULL FOR UPDATE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM public.prescription_sessions WHERE prescription_id = p_id) THEN
    RETURN;
  END IF;
  items := CASE WHEN jsonb_typeof(rx.heilmittel_items) = 'array' THEN rx.heilmittel_items ELSE '[]'::jsonb END;
  IF NOT EXISTS (SELECT FROM jsonb_array_elements(items) item WHERE item->>'einheiten' IS NOT NULL) THEN
    items := jsonb_build_array(jsonb_build_object('einheiten', rx.anzahl_einheiten, 'doppelbehandlung', rx.doppelbehandlung));
  END IF;
  INSERT INTO public.prescription_sessions(prescription_id, session_number, heilmittel_index)
  SELECT p_id, row_number() OVER (ORDER BY platz, n), platz - 1
  FROM jsonb_array_elements(items) WITH ORDINALITY AS zeile(item, platz)
  CROSS JOIN LATERAL generate_series(1, CASE WHEN item->>'einheiten' ~ '^[0-9]{1,6}$'
    THEN ceil((item->>'einheiten')::numeric /
      CASE WHEN item->>'doppelbehandlung' = 'true' THEN 2 ELSE 1 END)::integer ELSE 0 END) n
  ON CONFLICT (prescription_id, session_number) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.physio_sitzungsplan_initialisieren(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.physio_sitzungsplan_initialisieren(uuid) TO authenticated, service_role;

CREATE FUNCTION public.physio_sitzungsplan_nach_bestaetigung()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM public.physio_sitzungsplan_initialisieren(NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER physio_sitzungsplan_nach_bestaetigung
AFTER INSERT OR UPDATE OF status ON public.prescriptions FOR EACH ROW
WHEN (NEW.therapie_bereich = 'physio' AND NEW.status IN ('confirmed','in_therapy'))
EXECUTE FUNCTION public.physio_sitzungsplan_nach_bestaetigung();

-- Erst der erfolgreiche Terminabschluss bestätigt das erbrachte Leistungsdatum.
CREATE FUNCTION public.physio_beginn_nach_terminabschluss()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.prescriptions rx SET behandlungsbeginn = tage.beginn
  FROM (
    SELECT s.prescription_id, min((s.done_at AT TIME ZONE 'Europe/Berlin')::date) AS beginn
    FROM public.prescription_sessions s
    WHERE s.booking_id = NEW.id AND s.status = 'done'
    GROUP BY s.prescription_id
  ) tage
  WHERE rx.id = tage.prescription_id AND rx.therapie_bereich = 'physio'
    AND rx.status IN ('confirmed','in_therapy') AND tage.beginn IS NOT NULL
    AND (rx.behandlungsbeginn IS NULL OR rx.behandlungsbeginn > tage.beginn);
  RETURN NEW;
END;
$$;
CREATE TRIGGER physio_beginn_nach_terminabschluss AFTER UPDATE OF status ON public.bookings
FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.physio_beginn_nach_terminabschluss();
