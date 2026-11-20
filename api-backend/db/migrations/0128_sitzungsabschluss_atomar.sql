-- SaaS: ausstehend (Freigabe erforderlich). Lokal versioniert und geprüft.
-- Setzt 0124 voraus und stellt die Transaktion für die Abschlussroute bereit.
CREATE FUNCTION public.sitzung_abschliessen(p_booking_id uuid, p_startzeit timestamptz, p_notiz text)
RETURNS uuid[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  mandant uuid := public.auth_tenant_id();
  termin public.bookings%ROWTYPE;
  rx public.prescriptions%ROWTYPE;
  rx_ids uuid[];
  items jsonb;
  verarbeitet uuid[] := '{}';
  rx_id uuid;
  erbracht integer;
  offen integer;
  weitere integer;
  faellig boolean;
  max_ergaenzend integer;
  beginn date;
  soll_status text;
  soll_abrechnung text;
  soll_beginn date;
BEGIN
  IF mandant IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='PT401', MESSAGE='ANMELDUNG';
  END IF;
  SELECT * INTO termin FROM public.bookings WHERE id=p_booking_id
    AND (owner_id=mandant OR (owner_id IS NULL AND user_id=auth.uid())) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='TERMIN_FEHLT'; END IF;
  IF termin.start_time IS DISTINCT FROM p_startzeit OR p_startzeit IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='TERMIN_GEAENDERT';
  END IF;
  IF termin.start_time > statement_timestamp() THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='ZUKUNFT'; END IF;
  IF termin.status IS NULL OR termin.status NOT IN ('confirmed','completed') OR termin.no_show THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='STATUS'; END IF;
  IF termin.is_group AND termin.group_parent_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='GRUPPE'; END IF;
  IF termin.verordnung_id IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='PODO'; END IF;
  IF termin.hausbesuch AND coalesce(termin.fahrt_status,'') NOT IN ('fahrt_arrived','fahrt_return_pending','fahrt_completed') THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='FAHRT';
  END IF;

  PERFORM id FROM public.prescription_sessions WHERE booking_id=termin.id ORDER BY id FOR UPDATE;
  SELECT array_agg(DISTINCT prescription_id ORDER BY prescription_id) INTO rx_ids
    FROM public.prescription_sessions WHERE booking_id=termin.id;
  IF rx_ids IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='KEINE_SITZUNG'; END IF;

  FOREACH rx_id IN ARRAY rx_ids LOOP
    SELECT * INTO rx FROM public.prescriptions WHERE id=rx_id AND owner_id=mandant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='VERORDNUNG_FEHLT'; END IF;
    IF rx.status='parsed' THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='ENTWURF'; END IF;
    IF rx.therapie_bereich='podo' THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='PODO'; END IF;
    IF EXISTS (SELECT FROM public.prescription_sessions WHERE booking_id=termin.id AND prescription_id=rx.id
      AND (status NOT IN ('planned','done') OR (status='planned' AND rx.status IN ('billed','cancelled')))) THEN
      RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='STATUS';
    END IF;
    IF rx.status IN ('billed','cancelled') THEN CONTINUE; END IF;

    UPDATE public.prescription_sessions SET status='done', done_at=termin.start_time,
      notes=coalesce(nullif(p_notiz,''),notes)
      WHERE booking_id=termin.id AND prescription_id=rx.id AND status='planned';
    IF EXISTS (SELECT FROM public.prescription_sessions WHERE booking_id=termin.id AND prescription_id=rx.id AND status<>'done') THEN
      RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='STATUS';
    END IF;
    SELECT count(*) FILTER (WHERE status='done'), count(*) FILTER (WHERE status='planned' AND booking_id IS NOT NULL),
      count(*) FILTER (WHERE status='done' AND ergaenzend_erbracht),
      min((done_at AT TIME ZONE 'Europe/Berlin')::date) FILTER (WHERE status='done')
      INTO erbracht, offen, weitere, beginn FROM public.prescription_sessions WHERE prescription_id=rx.id;
    IF rx.ergaenzend_position IS NOT NULL THEN
      max_ergaenzend := coalesce(nullif(rx.ergaenzend_einheiten,0),nullif(rx.vorrangig_einheiten,0),rx.anzahl_einheiten,0);
      UPDATE public.prescription_sessions SET ergaenzend_erbracht=true
        WHERE id IN (SELECT id FROM public.prescription_sessions
          WHERE prescription_id=rx.id AND booking_id=termin.id AND status='done' AND NOT ergaenzend_erbracht
          ORDER BY session_number LIMIT greatest(0,max_ergaenzend-weitere));
    END IF;

    items := CASE WHEN jsonb_typeof(rx.heilmittel_items) = 'array' THEN rx.heilmittel_items ELSE '[]'::jsonb END;
    IF EXISTS (SELECT FROM jsonb_array_elements(items) it WHERE it->>'einheiten' IS NOT NULL) THEN
      SELECT sum(ceil((it->>'einheiten')::numeric / CASE WHEN it->>'doppelbehandlung'='true' THEN 2 ELSE 1 END))
        INTO weitere FROM jsonb_array_elements(items) it WHERE it->>'einheiten' ~ '^[0-9]+$';
    ELSE
      weitere := ceil(rx.anzahl_einheiten::numeric / CASE WHEN rx.doppelbehandlung THEN 2 ELSE 1 END);
    END IF;
    faellig := offen=0 AND erbracht >= coalesce(weitere,0);
    soll_beginn := CASE WHEN rx.therapie_bereich='physio' THEN least(rx.behandlungsbeginn,beginn) ELSE rx.behandlungsbeginn END;
    soll_status := CASE WHEN rx.status IN ('confirmed','in_therapy') THEN CASE WHEN faellig THEN 'completed' ELSE 'in_therapy' END ELSE rx.status END;
    soll_abrechnung := CASE WHEN faellig AND rx.abrechnung_status IS NULL AND rx.abrechnung_status_manuell_am IS NULL THEN 'bereit' ELSE rx.abrechnung_status END;
    IF (soll_beginn,soll_status,soll_abrechnung) IS DISTINCT FROM (rx.behandlungsbeginn,rx.status,rx.abrechnung_status) THEN
      UPDATE public.prescriptions SET behandlungsbeginn=soll_beginn, status=soll_status, abrechnung_status=soll_abrechnung WHERE id=rx.id;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='VERORDNUNG_FEHLT'; END IF;
    END IF;
    verarbeitet := array_append(verarbeitet,rx.id);
  END LOOP;

  IF termin.status <> 'completed' OR (termin.hausbesuch AND termin.fahrt_status='fahrt_arrived') THEN
    UPDATE public.bookings SET status='completed',
      fahrt_status=CASE WHEN hausbesuch AND fahrt_status='fahrt_arrived' THEN 'fahrt_return_pending' ELSE fahrt_status END
      WHERE id=termin.id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='TERMIN_GEAENDERT'; END IF;
  END IF;
  RETURN verarbeitet;
END;
$$;
REVOKE ALL ON FUNCTION public.sitzung_abschliessen(uuid,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sitzung_abschliessen(uuid,timestamptz,text) TO authenticated;
