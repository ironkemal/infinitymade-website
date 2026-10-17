-- SaaS: angewandt 17.10.2026 (MCP: 20261017202847, Freigabe Melih 17.10.2026; Grants/ACL und Spalte live geprüft, Pflichtberater db-ustasi + onprem: GO)
-- Atomare manuelle Bestätigung: keine Kalendertermine ohne bestätigte Anfrage.
-- Nur Backend-Service-Rolle; keine Browser-RPC und kein nichtatomarer Fallback.
CREATE OR REPLACE FUNCTION public.approve_booking_request_atomic(
  p_request_id uuid, p_owner_id uuid, p_actor_id uuid,
  p_expected_updated_at timestamptz, p_employee_id uuid,
  p_changes jsonb, p_bookings jsonb, p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.booking_requests%ROWTYPE;
  v_row jsonb;
  v_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_service_id uuid;
BEGIN
  IF p_actor_id IS DISTINCT FROM p_owner_id OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_owner_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Nur Praxisinhaber dürfen bestätigen' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_request FROM public.booking_requests
    WHERE id = p_request_id AND owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anfrage nicht gefunden' USING ERRCODE = '40001';
  END IF;
  IF v_request.status IS DISTINCT FROM 'pending'
     OR v_request.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Anfrage wurde inzwischen bearbeitet' USING ERRCODE = '40001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_employee_id
    AND (id = p_owner_id OR owner_id = p_owner_id)) THEN
    RAISE EXCEPTION 'Fremder Therapeut' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k WHERE k NOT IN
       ('preferred_date','preferred_time','service_id','session_count','verordnung_sitzungen','notizen'))
     OR jsonb_typeof(p_bookings) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_bookings) NOT BETWEEN 1 AND 99 THEN
    RAISE EXCEPTION 'Ungültige Terminplanung' USING ERRCODE = '22023';
  END IF;
  v_service_id := CASE WHEN p_changes ? 'service_id'
    THEN (p_changes->>'service_id')::uuid ELSE v_request.service_id END;
  IF v_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.services WHERE id = v_service_id
      AND (owner_id = p_owner_id OR user_id = p_owner_id)
  ) THEN
    RAISE EXCEPTION 'Fremde Leistung' USING ERRCODE = '42501';
  END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_bookings) LOOP
    IF (v_row->>'owner_id')::uuid IS DISTINCT FROM p_owner_id
      OR (v_row->>'user_id')::uuid IS DISTINCT FROM p_employee_id
      OR (v_row->>'service_id')::uuid IS DISTINCT FROM v_service_id
      OR (v_row->>'end_time')::timestamptz <= (v_row->>'start_time')::timestamptz
      OR v_row->>'start_time' IS NULL OR v_row->>'end_time' IS NULL THEN
      RAISE EXCEPTION 'Ungültiger Termin' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.bookings(user_id, owner_id, service_id, customer_name, start_time, end_time, status)
      VALUES (p_employee_id, p_owner_id, v_service_id, v_row->>'customer_name',
        (v_row->>'start_time')::timestamptz, (v_row->>'end_time')::timestamptz, 'confirmed')
      RETURNING id INTO v_id;
    v_ids := v_ids || jsonb_build_array(v_id);
  END LOOP;
  UPDATE public.booking_requests SET
    employee_id = p_employee_id, status = 'approved',
    booking_id = (v_ids->>0)::uuid, booking_ids = v_ids,
    preferred_date = CASE WHEN p_changes ? 'preferred_date' THEN (p_changes->>'preferred_date')::date ELSE preferred_date END,
    preferred_time = CASE WHEN p_changes ? 'preferred_time' THEN (p_changes->>'preferred_time')::time ELSE preferred_time END,
    service_id = v_service_id,
    session_count = CASE WHEN p_changes ? 'session_count' THEN (p_changes->>'session_count')::integer ELSE session_count END,
    verordnung_sitzungen = CASE WHEN p_changes ? 'verordnung_sitzungen' THEN (p_changes->>'verordnung_sitzungen')::integer ELSE verordnung_sitzungen END,
    notizen = CASE WHEN p_changes ? 'notizen' THEN p_changes->>'notizen' ELSE notizen END,
    updated_at = now()
    WHERE id = p_request_id AND owner_id = p_owner_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anfrage wurde inzwischen bearbeitet' USING ERRCODE = '40001';
  END IF;
  RETURN COALESCE(p_result, '{}'::jsonb) || jsonb_build_object(
    'booking_id', v_ids->0, 'booking_ids', v_ids, 'sessions_created', jsonb_array_length(v_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.approve_booking_request_atomic(uuid,uuid,uuid,timestamptz,uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_booking_request_atomic(uuid,uuid,uuid,timestamptz,uuid,jsonb,jsonb,jsonb) TO service_role;
