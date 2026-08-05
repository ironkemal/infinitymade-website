--
-- PostgreSQL database dump
--

\restrict rtGHPDvRqFGzlhbzAKxMw1lutm99F9jPGPUHxk1oA83k985Xnd7deAiSKJfbeUy

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: add_credits(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_credits(p_user_id uuid, p_credits integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_credits = -1 THEN
    UPDATE user_credits SET is_unlimited = true, updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO user_credits (user_id, credits) VALUES (p_user_id, p_credits)
    ON CONFLICT (user_id) DO UPDATE
    SET credits = user_credits.credits + p_credits, updated_at = now();
  END IF;
END;
$$;


--
-- Name: admin_db_size_breakdown(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_db_size_breakdown() RETURNS TABLE(table_name text, size_bytes bigint, row_estimate bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select
    c.relname::text,
    pg_total_relation_size(c.oid)::bigint,
    c.reltuples::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;


--
-- Name: admin_db_total_size(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_db_total_size() RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select pg_database_size(current_database())::bigint;
$$;


--
-- Name: admin_top_tenants_by_rows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_top_tenants_by_rows() RETURNS TABLE(owner_id uuid, business_name text, email text, total_rows bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  with sums as (
    select owner_id, count(*)::bigint as n from public.bookings where owner_id is not null group by owner_id
    union all
    select owner_id, count(*) from public.leads where owner_id is not null group by owner_id
    union all
    select owner_id, count(*) from public.email_logs where owner_id is not null group by owner_id
    union all
    select business_id as owner_id, count(*) from public.messages where business_id is not null group by business_id
    union all
    select owner_id, count(*) from public.anamnese where owner_id is not null group by owner_id
    union all
    select owner_id, count(*) from public.prescriptions where owner_id is not null group by owner_id
    union all
    select owner_id, count(*) from public.invoices where owner_id is not null group by owner_id
  ), agg as (
    select owner_id, sum(n)::bigint as total_rows from sums group by owner_id
  )
  select a.owner_id, p.business_name, p.email, a.total_rows
  from agg a
  left join public.profiles p on p.id = a.owner_id
  order by a.total_rows desc
  limit 20;
$$;


--
-- Name: auth_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(p.owner_id, p.id)
  FROM profiles p
  WHERE p.id = auth.uid();
$$;


--
-- Name: business_get_secret(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.business_get_secret(p_user_id uuid, p_secret_kind text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $_$
DECLARE
  v_secret_id UUID;
  v_secret_value TEXT;
  v_column_name TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Permission denied: cannot read secret of another business';
  END IF;

  IF p_secret_kind NOT IN ('cal_api_key','whatsapp_access_token') THEN
    RAISE EXCEPTION 'Invalid secret kind: %', p_secret_kind;
  END IF;

  v_column_name := p_secret_kind || '_secret_id';

  EXECUTE format('SELECT %I FROM public.profiles WHERE id = $1', v_column_name)
    INTO v_secret_id
    USING p_user_id;

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret_value
    FROM vault.decrypted_secrets
    WHERE id = v_secret_id;

  RETURN v_secret_value;
END;
$_$;


--
-- Name: business_lookup_for_inbound(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.business_lookup_for_inbound(p_whatsapp_phone_number_id text) RETURNS TABLE(business_id uuid, business_name text, sector text, city text, language text, is_active boolean, cal_api_key text, cal_username text, whatsapp_access_token text, whatsapp_waba_id text, working_hours jsonb, faq jsonb, message_templates jsonb, system_prompt text, services jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.business_name,
    p.sector,
    p.city,
    p.language,
    p.is_active,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p.cal_api_key_secret_id),
    p.cal_username,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p.whatsapp_access_token_secret_id),
    p.whatsapp_waba_id,
    p.working_hours,
    p.faq,
    p.message_templates,
    p.system_prompt,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'duration_minutes', s.duration_minutes,
        'price_eur', s.price_eur,
        'cal_event_type_id', s.cal_event_type_id,
        'follow_up_days', s.follow_up_days
      ) ORDER BY s.display_order)
       FROM public.business_services s
       WHERE s.business_id = p.id AND s.is_active = TRUE),
      '[]'::jsonb
    )
  FROM public.profiles p
  WHERE p.whatsapp_phone_number_id = p_whatsapp_phone_number_id
    AND p.is_active = TRUE
  LIMIT 1;
END;
$$;


--
-- Name: business_lookup_for_twilio(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.business_lookup_for_twilio(p_to_number text) RETURNS TABLE(business_id uuid, business_name text, sector text, city text, language text, is_active boolean, cal_api_key text, cal_username text, whatsapp_number text, whatsapp_access_token text, whatsapp_waba_id text, working_hours jsonb, faq jsonb, message_templates jsonb, system_prompt text, services jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $$
DECLARE
  v_clean_number TEXT;
BEGIN
  v_clean_number := REPLACE(REPLACE(REPLACE(p_to_number, 'whatsapp:', ''), ' ', ''), '-', '');

  RETURN QUERY
  SELECT
    p.id,
    p.business_name,
    p.sector,
    p.city,
    p.language,
    p.is_active,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p.cal_api_key_secret_id),
    p.cal_username,
    p.whatsapp_number,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p.whatsapp_access_token_secret_id),
    p.whatsapp_waba_id,
    p.working_hours,
    p.faq,
    p.message_templates,
    p.system_prompt,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'duration_minutes', s.duration_minutes,
        'price_eur', s.price_eur,
        'cal_event_type_id', s.cal_event_type_id,
        'follow_up_days', s.follow_up_days
      ) ORDER BY s.display_order)
       FROM public.business_services s
       WHERE s.business_id = p.id AND s.is_active = TRUE),
      '[]'::jsonb
    )
  FROM public.profiles p
  WHERE p.whatsapp_number = v_clean_number
    AND p.is_active = TRUE
  LIMIT 1;
END;
$$;


--
-- Name: business_save_secret(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.business_save_secret(p_user_id uuid, p_secret_kind text, p_secret_value text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $_$
DECLARE
  v_secret_id UUID;
  v_existing_id UUID;
  v_column_name TEXT;
BEGIN
  -- Owner check (skip for service_role)
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Permission denied: cannot save secret for another business';
  END IF;

  IF p_secret_kind NOT IN ('cal_api_key','whatsapp_access_token') THEN
    RAISE EXCEPTION 'Invalid secret kind: %', p_secret_kind;
  END IF;

  v_column_name := p_secret_kind || '_secret_id';

  EXECUTE format('SELECT %I FROM public.profiles WHERE id = $1', v_column_name)
    INTO v_existing_id
    USING p_user_id;

  IF v_existing_id IS NOT NULL THEN
    UPDATE vault.secrets
      SET secret = p_secret_value,
          updated_at = NOW()
      WHERE id = v_existing_id;
    RETURN v_existing_id;
  ELSE
    v_secret_id := vault.create_secret(
      p_secret_value,
      'business:' || p_user_id::text || ':' || p_secret_kind,
      'Secret for business ' || p_user_id::text || ' kind ' || p_secret_kind
    );

    EXECUTE format('UPDATE public.profiles SET %I = $1 WHERE id = $2', v_column_name)
      USING v_secret_id, p_user_id;

    RETURN v_secret_id;
  END IF;
END;
$_$;


--
-- Name: clear_gmail_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_gmail_token(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = 'gmail_token:' || p_user_id::text;
END;
$$;


--
-- Name: confirm_referral_and_create_series(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_referral_and_create_series(p_draft_id uuid, p_lead_id uuid, p_confirmed_by uuid) RETURNS TABLE(success boolean, message text, booking_series_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_draft RECORD;
  v_lead RECORD;
  v_service_id UUID;
  v_series_id UUID;
BEGIN
  SELECT * INTO v_draft FROM referral_drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Draft not found', NULL::UUID;
    RETURN;
  END IF;
  IF v_draft.is_confirmed THEN
    RETURN QUERY SELECT false, 'Already confirmed', v_draft.booking_series_id;
    RETURN;
  END IF;
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Patient not found', NULL::UUID;
    RETURN;
  END IF;
  SELECT id INTO v_service_id FROM services 
  WHERE user_id = v_draft.owner_id 
  AND (title ILIKE '%physio%' OR title ILIKE '%therapie%' OR title ILIKE '%fyzio%')
  LIMIT 1;
  IF v_service_id IS NULL THEN
    SELECT id INTO v_service_id FROM services 
    WHERE user_id = v_draft.owner_id
    LIMIT 1;
  END IF;
  IF v_service_id IS NULL THEN
    RETURN QUERY SELECT false, 'No service found', NULL::UUID;
    RETURN;
  END IF;
  INSERT INTO booking_series (
    owner_id, lead_id, service_id, total_sessions, completed_sessions,
    status, source_type, source_id, created_by
  ) VALUES (
    v_draft.owner_id, p_lead_id, v_service_id, v_draft.seans_sayisi, 0,
    'active', 'referral_draft', p_draft_id, p_confirmed_by
  ) RETURNING id INTO v_series_id;
  UPDATE referral_drafts SET
    is_confirmed = true, status = 'approved', lead_id = p_lead_id,
    confirmed_at = NOW(), confirmed_by = p_confirmed_by,
    booking_series_id = v_series_id, updated_at = NOW()
  WHERE id = p_draft_id;
  RETURN QUERY SELECT true, 'Referral confirmed and series created', v_series_id;
END;
$$;


--
-- Name: delete_expired_accounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_expired_accounts() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM profiles
    WHERE deletion_scheduled_at IS NOT NULL
      AND deletion_scheduled_at <= NOW()
      AND plan_status IN ('canceled', 'expired')
  LOOP
    UPDATE profiles SET
      business_name           = '[gelöscht]',
      owner_first_name        = '[gelöscht]',
      owner_last_name         = '[gelöscht]',
      street                  = NULL, house_number = NULL, zip = NULL,
      city                    = NULL, phone = NULL, avatar_url = NULL,
      booking_slug            = NULL, iban = NULL, bic = NULL,
      bank_name               = NULL, ik_number = NULL, steuernummer = NULL,
      b2b_gmail_refresh_token = NULL, deletion_scheduled_at = NULL,
      plan_status             = 'deleted'
    WHERE id = r.id;
    DELETE FROM bookings              WHERE owner_id = r.id;
    DELETE FROM leads                 WHERE owner_id = r.id;
    DELETE FROM prescriptions         WHERE owner_id = r.id;
    DELETE FROM prescription_sessions WHERE owner_id = r.id;
    DELETE FROM services              WHERE owner_id = r.id;
    DELETE FROM working_hours         WHERE owner_id = r.id;
    DELETE FROM businesses            WHERE owner_id = r.id;
  END LOOP;
END;
$$;


--
-- Name: find_owner_id_by_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_owner_id_by_code(p_code text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.profiles WHERE upper(company_code) = upper(p_code) LIMIT 1;
$$;


--
-- Name: find_patient_by_name_and_birth(text, text, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_patient_by_name_and_birth(p_vorname text, p_nachname text, p_geburtsdatum date, p_owner_id uuid) RETURNS TABLE(id uuid, first_name text, last_name text, geburtsdatum date, phone text, email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id, l.first_name, l.last_name,
    (l.metadata->>'geburtsdatum')::DATE AS geburtsdatum,
    l.phone, l.email
  FROM leads l
  WHERE 
    l.owner_id = p_owner_id
    AND (
      (LOWER(l.first_name) = LOWER(p_vorname) AND LOWER(l.last_name) = LOWER(p_nachname))
      OR
      (LOWER(l.first_name) LIKE LOWER('%' || p_vorname || '%') 
       AND LOWER(l.last_name) LIKE LOWER('%' || p_nachname || '%'))
    )
    AND (
      p_geburtsdatum IS NULL 
      OR (l.metadata->>'geburtsdatum')::DATE = p_geburtsdatum
    )
  LIMIT 5;
END;
$$;


--
-- Name: fn_befreiung_backfill_prescriptions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_befreiung_backfill_prescriptions() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  v_patient_id := COALESCE(NEW.patient_id, OLD.patient_id);
  IF v_patient_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE prescriptions
  SET zuzahlung_befreit = fn_is_patient_befreit(
    patient_id,
    COALESCE(ausstellungsdatum, CURRENT_DATE)
  )
  WHERE patient_id = v_patient_id
    AND abrechnung_id IS NULL;
  RETURN NULL;
END;
$$;


--
-- Name: fn_check_booking_closed_day(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_check_booking_closed_day() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_closed_days INTEGER[];
  v_dow INTEGER;
BEGIN
  IF NEW.business_id IS NULL THEN RETURN NEW; END IF;
  SELECT closed_days INTO v_closed_days FROM public.businesses WHERE id = NEW.business_id;
  IF v_closed_days IS NULL OR array_length(v_closed_days, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  -- Berlin saatine göre gün hesapla
  v_dow := EXTRACT(DOW FROM (NEW.start_time AT TIME ZONE 'Europe/Berlin'))::INTEGER;
  IF v_dow = ANY (v_closed_days) THEN
    RAISE EXCEPTION 'Geschäft ist an diesem Tag geschlossen (closed_days check)' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: fn_is_patient_befreit(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_is_patient_befreit(p_patient_id uuid, p_datum date) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM zuzahlung_befreiung
    WHERE patient_id = p_patient_id
      AND befreit_ab <= p_datum
      AND (befreit_bis IS NULL OR befreit_bis >= p_datum)
  );
$$;


--
-- Name: fn_prescriptions_set_befreit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_prescriptions_set_befreit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.zuzahlung_befreit := fn_is_patient_befreit(
    NEW.patient_id,
    COALESCE(NEW.ausstellungsdatum, CURRENT_DATE)
  );
  RETURN NEW;
END;
$$;


--
-- Name: get_default_business(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_default_business(p_user uuid) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT b.id
    FROM public.businesses b
    JOIN public.profiles p ON p.id = p_user
   WHERE b.owner_id = COALESCE(p.owner_id, p.id)
     AND b.is_default
   LIMIT 1
$$;


--
-- Name: get_gmail_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_gmail_token(p_user_id uuid) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $$
  SELECT decrypted_secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'gmail_token:' || p_user_id::text
  LIMIT 1;
$$;


--
-- Name: get_my_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_permissions(p_business_id uuid) RETURNS TABLE(module text, has_access boolean)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  -- Owner kontrol: kendi business'sa tüm modüllere erişim
  owner_check AS (
    SELECT EXISTS (
      SELECT 1 FROM public.businesses b
      JOIN me ON TRUE
      WHERE b.id = p_business_id AND b.owner_id = me.uid
    ) AS is_owner
  ),
  -- Employee için grup scope
  group_modules AS (
    SELECT gs.module, gs.has_access
    FROM public.employee_business_assignments eba
    JOIN public.group_scopes gs ON gs.group_id = eba.group_id
    JOIN me ON TRUE
    WHERE eba.employee_id = me.uid AND eba.business_id = p_business_id
  ),
  -- Bireysel override
  override_modules AS (
    SELECT module, has_access
    FROM public.employee_scope_overrides
    JOIN me ON TRUE
    WHERE employee_id = me.uid AND business_id = p_business_id
  )
  -- Önce override, sonra grup
  SELECT
    COALESCE(o.module, g.module) AS module,
    CASE
      WHEN (SELECT is_owner FROM owner_check) THEN TRUE
      ELSE COALESCE(o.has_access, g.has_access, FALSE)
    END AS has_access
  FROM group_modules g
  FULL OUTER JOIN override_modules o ON o.module = g.module
  WHERE COALESCE(o.module, g.module) IS NOT NULL

  UNION ALL

  -- Owner ise: tüm bilinen modülleri TRUE döndür
  SELECT m AS module, TRUE AS has_access
  FROM UNNEST(ARRAY['dashboard','calendar','customers','services','hours','team',
                    'notes','anamnese','prescriptions','abrechnung','fahrtenbuch',
                    'b2b','b2c','feedback','settings']) AS m
  WHERE (SELECT is_owner FROM owner_check)
$$;


--
-- Name: FUNCTION get_my_permissions(p_business_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_permissions(p_business_id uuid) IS 'Returns module→has_access map for current user in given business. Owner gets all modules TRUE.';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: normalize_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_phone(p text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
declare
  cleaned text;
begin
  if p is null then return null; end if;
  cleaned := regexp_replace(p, '[^0-9+]', '', 'g');
  if cleaned like '+%' then return cleaned; end if;
  if cleaned like '00%' then return '+' || substring(cleaned from 3); end if;
  if cleaned like '0%' then return '+49' || substring(cleaned from 2); end if;
  if length(cleaned) = 11 and cleaned like '49%' then return '+' || cleaned; end if;
  if length(cleaned) >= 10 then return '+' || cleaned; end if;
  return cleaned;
end;
$$;


--
-- Name: notify_feedback_telegram(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_feedback_telegram() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://n8n.infinitymade.de/webhook/feedback-notify',
    body    := json_build_object(
      'record', json_build_object(
        'type',        NEW.type,
        'priority',    NEW.priority,
        'title',       NEW.title,
        'description', NEW.description,
        'created_at',  NEW.created_at
      )
    )::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;


--
-- Name: notify_new_referral_draft(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_referral_draft() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM pg_notify(
    'new_referral_draft',
    json_build_object(
      'id', NEW.id,
      'owner_id', NEW.owner_id,
      'patient_name', NEW.patient_vorname || ' ' || NEW.patient_nachname,
      'seans_sayisi', NEW.seans_sayisi,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$;


--
-- Name: pending_signup_consume(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pending_signup_consume(p_pending_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault', 'pg_catalog'
    AS $$
DECLARE
  v_secret_id uuid;
  v_pw text;
BEGIN
  SELECT password_secret_id INTO v_secret_id FROM public.pending_signups WHERE id = p_pending_id;
  IF v_secret_id IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_pw FROM vault.decrypted_secrets WHERE id = v_secret_id;
  RETURN v_pw;
END;
$$;


--
-- Name: pending_signup_delete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pending_signup_delete(p_pending_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault', 'pg_catalog'
    AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT password_secret_id INTO v_secret_id FROM public.pending_signups WHERE id = p_pending_id;
  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
  DELETE FROM public.pending_signups WHERE id = p_pending_id;
END;
$$;


--
-- Name: pending_signup_store(text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pending_signup_store(p_email text, p_onboarding jsonb, p_password text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault', 'pg_catalog'
    AS $$
DECLARE
  v_old RECORD;
  v_secret_id uuid;
  v_id uuid;
BEGIN
  FOR v_old IN SELECT id, password_secret_id FROM public.pending_signups WHERE email = p_email LOOP
    IF v_old.password_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = v_old.password_secret_id;
    END IF;
  END LOOP;
  DELETE FROM public.pending_signups WHERE email = p_email;

  v_secret_id := vault.create_secret(
    p_password,
    'pending_pw:' || p_email || ':' || gen_random_uuid()::text,
    'Temporary signup password (pre-payment)'
  );

  INSERT INTO public.pending_signups (email, onboarding_data, password_secret_id)
  VALUES (p_email, p_onboarding, v_secret_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: prevent_belegliste_mod(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_belegliste_mod() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'GoBD Belegliste ist unveränderlich. UPDATE und DELETE Operationen sind gesetzlich verboten!';
END; $$;


--
-- Name: seed_default_groups_for_business(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_groups_for_business() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_mit_id UUID;
  v_sek_id UUID;
  modules_mit TEXT[] := ARRAY['dashboard','calendar','customers','services','hours','notes','anamnese','prescriptions','team'];
  modules_sek TEXT[] := ARRAY['dashboard','calendar','customers','services','hours','b2c','team'];
  m TEXT;
BEGIN
  INSERT INTO public.employee_groups (business_id, name, is_default)
  VALUES (NEW.id, 'Mitarbeiter', TRUE)
  ON CONFLICT (business_id, name) DO NOTHING
  RETURNING id INTO v_mit_id;
  IF v_mit_id IS NULL THEN
    SELECT id INTO v_mit_id FROM public.employee_groups WHERE business_id = NEW.id AND name = 'Mitarbeiter';
  END IF;
  FOREACH m IN ARRAY modules_mit LOOP
    INSERT INTO public.group_scopes (group_id, module, has_access)
    VALUES (v_mit_id, m, TRUE)
    ON CONFLICT (group_id, module) DO NOTHING;
  END LOOP;

  INSERT INTO public.employee_groups (business_id, name, is_default)
  VALUES (NEW.id, 'Sekreter', TRUE)
  ON CONFLICT (business_id, name) DO NOTHING
  RETURNING id INTO v_sek_id;
  IF v_sek_id IS NULL THEN
    SELECT id INTO v_sek_id FROM public.employee_groups WHERE business_id = NEW.id AND name = 'Sekreter';
  END IF;
  FOREACH m IN ARRAY modules_sek LOOP
    INSERT INTO public.group_scopes (group_id, module, has_access)
    VALUES (v_sek_id, m, TRUE)
    ON CONFLICT (group_id, module) DO NOTHING;
  END LOOP;

  RETURN NEW;
END $$;


--
-- Name: set_bookings_business_id_default(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_bookings_business_id_default() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner UUID;
  v_resolved UUID;
BEGIN
  IF NEW.business_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_owner := COALESCE(NEW.owner_id, auth.uid());
  IF v_owner IS NULL THEN RETURN NEW; END IF;

  -- 1) Önce: employee'nin owner'in default business'inde atamasi varsa onu kullan
  IF NEW.user_id IS NOT NULL THEN
    SELECT eba.business_id INTO v_resolved
      FROM public.employee_business_assignments eba
      JOIN public.businesses b ON b.id = eba.business_id
     WHERE eba.employee_id = NEW.user_id
       AND b.owner_id = v_owner
       AND b.is_default
     LIMIT 1;
  END IF;

  -- 2) Default'a atanmamissa employee'nin owner altindaki herhangi bir atamasini kullan
  IF v_resolved IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT eba.business_id INTO v_resolved
      FROM public.employee_business_assignments eba
      JOIN public.businesses b ON b.id = eba.business_id
     WHERE eba.employee_id = NEW.user_id
       AND b.owner_id = v_owner
     ORDER BY b.is_default DESC, b.created_at ASC
     LIMIT 1;
  END IF;

  -- 3) Son care: owner'in default business'i
  IF v_resolved IS NULL THEN
    SELECT id INTO v_resolved
      FROM public.businesses
     WHERE owner_id = v_owner AND is_default
     LIMIT 1;
  END IF;

  NEW.business_id := v_resolved;
  RETURN NEW;
END $$;


--
-- Name: set_business_id_default(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_business_id_default() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_owner UUID;
BEGIN
  IF NEW.business_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) owner_id kolonu varsa onu kullan
  BEGIN
    EXECUTE format('SELECT ($1).owner_id') INTO v_owner USING NEW;
  EXCEPTION WHEN OTHERS THEN
    v_owner := NULL;
  END;

  -- 2) yoksa auth.uid()
  IF v_owner IS NULL THEN
    v_owner := auth.uid();
  END IF;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.id INTO NEW.business_id
    FROM public.businesses b
    JOIN public.profiles p ON p.id = v_owner
   WHERE b.owner_id = COALESCE(p.owner_id, p.id)
     AND b.is_default
   LIMIT 1;

  RETURN NEW;
END $_$;


--
-- Name: FUNCTION set_business_id_default(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_business_id_default() IS 'BEFORE INSERT trigger: if business_id is NULL, auto-resolve from owner_id or auth.uid() via get_default_business logic';


--
-- Name: set_gmail_token(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_gmail_token(p_user_id uuid, p_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $$
BEGIN
  -- Remove existing secret for this user if present
  DELETE FROM vault.secrets WHERE name = 'gmail_token:' || p_user_id::text;
  -- Store new token
  PERFORM vault.create_secret(p_token, 'gmail_token:' || p_user_id::text, 'Gmail refresh token for user ' || p_user_id::text);
END;
$$;


--
-- Name: set_next_beleg_nr(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_next_beleg_nr() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE next_nr BIGINT;
BEGIN
  SELECT COALESCE(MAX(beleg_nr), 0) + 1 INTO next_nr FROM public.belegliste WHERE owner_id = NEW.owner_id;
  NEW.beleg_nr := next_nr; RETURN NEW;
END; $$;


--
-- Name: set_next_mahnung_nr(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_next_mahnung_nr() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE next_nr BIGINT;
BEGIN
  SELECT COALESCE(MAX(mahnung_nr), 0) + 1 INTO next_nr
    FROM public.mahnungen WHERE owner_id = NEW.owner_id;
  NEW.mahnung_nr := next_nr;
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at_now(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_now() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_warteliste_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_warteliste_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: sync_leads_location(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_leads_location() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng::float, NEW.lat::float), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_profiles_clinic_location(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profiles_clinic_location() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.clinic_lat IS NOT NULL AND NEW.clinic_lng IS NOT NULL THEN
    NEW.clinic_location := ST_SetSRID(ST_MakePoint(NEW.clinic_lng::float, NEW.clinic_lat::float), 4326)::geography;
  ELSE
    NEW.clinic_location := NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;


--
-- Name: trg_billing_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_billing_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: trg_normalize_booking_phone_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_normalize_booking_phone_fn() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  NEW.customer_phone_normalized := normalize_phone(NEW.customer_phone);
  return NEW;
end;
$$;


--
-- Name: trg_normalize_lead_phone_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_normalize_lead_phone_fn() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  NEW.phone_normalized := normalize_phone(NEW.phone);
  return NEW;
end;
$$;


--
-- Name: trg_prescriptions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_prescriptions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_attendance_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_attendance_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: whoami(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.whoami() RETURNS jsonb
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$ SELECT jsonb_build_object('current_user', current_user, 'role', current_setting('request.jwt.claim.role', true), 'all_claims', current_setting('request.jwt.claims', true)); $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: abrechnung; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT abrechnung_status_check CHECK ((status = ANY (ARRAY['erstellt'::text, 'heruntergeladen'::text, 'gesendet'::text, 'accepted'::text, 'rejected'::text, 'paid'::text])))
);


--
-- Name: accommodations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accommodations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    address text,
    location public.geography(Point,4326),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: aerzte; Type: TABLE; Schema: public; Owner: -
--

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
    business_id uuid
);


--
-- Name: ai_audit_log; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: anamnese; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT anamnese_beschwerde_verlauf_check CHECK ((beschwerde_verlauf = ANY (ARRAY['konstant'::text, 'zunehmend'::text, 'abnehmend'::text, 'wechselnd'::text]))),
    CONSTRAINT anamnese_schmerz_skala_check CHECK (((schmerz_skala >= 0) AND (schmerz_skala <= 10)))
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    job_text text NOT NULL,
    cv_text text NOT NULL,
    anschreiben text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    business_id uuid,
    date date NOT NULL,
    check_in_at timestamp with time zone,
    check_out_at timestamp with time zone,
    check_in_valid boolean DEFAULT false NOT NULL,
    status text DEFAULT 'present'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'late'::text, 'incomplete'::text, 'absent'::text])))
);


--
-- Name: b2b_contacts; Type: TABLE; Schema: public; Owner: -
--

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
    business_id uuid,
    CONSTRAINT b2b_contacts_status_check CHECK ((status = ANY (ARRAY['prospect'::text, 'contacted'::text, 'partner'::text, 'inactive'::text])))
);


--
-- Name: belegliste; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT belegliste_type_check CHECK ((type = ANY (ARRAY['zuzahlung'::text, 'barverkauf'::text, 'storno'::text])))
);


--
-- Name: booking_requests; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT booking_requests_notizen_check CHECK ((char_length(notizen) <= 500)),
    CONSTRAINT booking_requests_payment_type_check CHECK ((payment_type = ANY (ARRAY['gkv'::text, 'pkv'::text, 'selbstzahler'::text, 'bg'::text]))),
    CONSTRAINT booking_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text]))),
    CONSTRAINT booking_requests_verordnung_typ_check CHECK ((verordnung_typ = ANY (ARRAY['erst'::text, 'folge'::text])))
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    CONSTRAINT bookings_fahrt_status_check CHECK ((fahrt_status = ANY (ARRAY['fahrt_started'::text, 'fahrt_arrived'::text, 'fahrt_return_pending'::text, 'fahrt_completed'::text]))),
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'completed'::text, 'pending'::text, 'no_show'::text])))
);


--
-- Name: TABLE bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bookings IS 'RLS: user_id (employee self-access) + owner_id (owner and team access) policies both active.';


--
-- Name: breaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.breaks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    business_id uuid,
    CONSTRAINT breaks_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: business_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30 NOT NULL,
    price_eur numeric(10,2),
    follow_up_days integer DEFAULT 30,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

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
    closed_days integer[] DEFAULT ARRAY[]::integer[]
);


--
-- Name: COLUMN businesses.closed_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.closed_days IS 'Haftanın kapalı günleri. JS getDay() konvansiyonu: 0=Pazar, 1=Pzt, ..., 6=Cumartesi. Boş array = her gün açık.';


--
-- Name: calendar_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_integrations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    access_token text,
    refresh_token text,
    calendar_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    business_id uuid,
    CONSTRAINT calendar_integrations_provider_check CHECK ((provider = ANY (ARRAY['google'::text, 'apple'::text])))
);


--
-- Name: chatbot_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_usage (
    id bigint NOT NULL,
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


--
-- Name: chatbot_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.chatbot_usage ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.chatbot_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: consent_log; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: TABLE consent_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.consent_log IS 'DSGVO/TTDSG consent audit trail. Required to prove pre-processing consent (AVV/AGB/Datenschutz).';


--
-- Name: custom_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_days (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    owner_id uuid,
    date date NOT NULL,
    type text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    start_time time without time zone,
    end_time time without time zone,
    business_id uuid,
    CONSTRAINT custom_days_type_check CHECK ((type = ANY (ARRAY['closed'::text, 'holiday'::text, 'special'::text])))
);


--
-- Name: data_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_access_log (
    id bigint NOT NULL,
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


--
-- Name: TABLE data_access_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_access_log IS 'DSGVO Art. 32 access audit trail. 12 month retention.';


--
-- Name: data_access_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.data_access_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: data_access_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.data_access_log_id_seq OWNED BY public.data_access_log.id;


--
-- Name: data_sharing_settings; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: TABLE data_sharing_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_sharing_settings IS 'Per-owner toggle: which data categories are shared across all Standorte (true) vs separate per business (false). Missing row = all false (separate).';


--
-- Name: demo_bookings; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: diagnosegruppen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnosegruppen (
    code text NOT NULL,
    label text NOT NULL,
    untergruppen text[],
    icd10_codes text[],
    icd10_pflicht text,
    befundung_erlaubt boolean DEFAULT true,
    nagelspange_erlaubt boolean DEFAULT false,
    lokalisation_pflicht boolean DEFAULT false
);


--
-- Name: document_vorlagen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_vorlagen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    business_id uuid,
    vorlage_type text NOT NULL,
    name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    content_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_vorlagen_vorlage_type_check CHECK ((vorlage_type = ANY (ARRAY['quittung_zuzahlung'::text, 'rechnung_bg'::text, 'rechnung_privat'::text, 'rechnung_eigenanteil'::text, 'rechnung_selbstzahler'::text, 'rechnung_sonder'::text, 'rezeptvorderseite'::text, 'rzg_quittung'::text])))
);


--
-- Name: dta_schluessel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dta_schluessel (
    id bigint NOT NULL,
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


--
-- Name: dta_schluessel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dta_schluessel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dta_schluessel_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dta_schluessel_id_seq OWNED BY public.dta_schluessel.id;


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

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
    business_id uuid,
    CONSTRAINT email_logs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: employee_business_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_business_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    business_id uuid NOT NULL,
    group_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_scope_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_scope_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    business_id uuid NOT NULL,
    module text NOT NULL,
    has_access boolean NOT NULL
);


--
-- Name: employee_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_services (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    service_id uuid NOT NULL,
    business_id uuid
);


--
-- Name: fahrten; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: fahrten_monthly_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fahrten_monthly_summary WITH (security_invoker='on') AS
 SELECT owner_id,
    user_id,
    vehicle_id,
    kennzeichen_snapshot,
    kind_snapshot,
    date_trunc('month'::text, fahrt_started_at) AS month,
    count(*) AS trips,
    sum(COALESCE(distance_km, 0)) AS total_km,
    (sum(
        CASE
            WHEN ((fahrt_ended_at IS NOT NULL) AND (fahrt_started_at IS NOT NULL)) THEN (EXTRACT(epoch FROM (fahrt_ended_at - fahrt_started_at)) / (60)::numeric)
            ELSE (0)::numeric
        END))::integer AS total_minutes
   FROM public.fahrten f
  WHERE (end_km IS NOT NULL)
  GROUP BY owner_id, user_id, vehicle_id, kennzeichen_snapshot, kind_snapshot, (date_trunc('month'::text, fahrt_started_at));


--
-- Name: feedbacks; Type: TABLE; Schema: public; Owner: -
--

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
    business_id uuid,
    CONSTRAINT feedbacks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT feedbacks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]))),
    CONSTRAINT feedbacks_type_check CHECK ((type = ANY (ARRAY['bug'::text, 'feature_request'::text, 'feedback'::text, 'support'::text])))
);


--
-- Name: fußstatus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."fußstatus" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    patient_name text,
    aufnahmedatum date DEFAULT CURRENT_DATE NOT NULL,
    wagner_grad smallint,
    seite text,
    befunde jsonb,
    foto_urls text[],
    notizen text,
    created_at timestamp with time zone DEFAULT now(),
    patient_id uuid,
    CONSTRAINT "fußstatus_seite_check" CHECK ((seite = ANY (ARRAY['links'::text, 'rechts'::text, 'beide'::text]))),
    CONSTRAINT "fußstatus_wagner_grad_check" CHECK (((wagner_grad >= 0) AND (wagner_grad <= 5)))
);


--
-- Name: group_scopes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_scopes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    module text NOT NULL,
    has_access boolean DEFAULT true NOT NULL
);


--
-- Name: heilmittel_catalog; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: heilmittel_position; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: heilmittel_tarif; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.heilmittel_tarif (
    id bigint NOT NULL,
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


--
-- Name: heilmittel_tarif_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.heilmittel_tarif_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: heilmittel_tarif_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.heilmittel_tarif_id_seq OWNED BY public.heilmittel_tarif.id;


--
-- Name: icd10_titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icd10_titles (
    code text NOT NULL,
    titel text NOT NULL,
    kapitel smallint,
    ebene smallint
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT invoices_invoice_type_check CHECK ((invoice_type = ANY (ARRAY['gkv'::text, 'privat'::text]))),
    CONSTRAINT invoices_payment_method_check CHECK ((payment_method = ANY (ARRAY['bar'::text, 'karte'::text, 'lastschrift'::text, 'ueberweisung'::text, 'sonstiges'::text]))),
    CONSTRAINT invoices_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text]))),
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN invoices.prescription_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.invoices.prescription_id IS 'Linked Muster-13/Blanko prescription (multi-prescription patients). Set automatically when invoice is created from a physio workflow.';


--
-- Name: COLUMN invoices.invoice_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.invoices.invoice_type IS 'gkv = GKV Abrechnung (fixed tariff + Zuzahlung), privat = Privatrechnung (practice prices, no Zuzahlung)';


--
-- Name: kostentraeger; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT kostentraeger_payer_type_check CHECK ((payer_type = ANY (ARRAY['gkv'::text, 'sonst'::text, 'privat'::text])))
);


--
-- Name: krankenkassen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.krankenkassen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    abbreviation text,
    type text DEFAULT 'gesetzlich'::text,
    created_at timestamp with time zone DEFAULT now(),
    ik_number text
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

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
    location public.geography(Point,4326),
    distance_km numeric(6,2),
    duration_min integer,
    route_calculated_at timestamp with time zone,
    lat numeric(9,6),
    lng numeric(9,6),
    business_id uuid,
    insurance_type text,
    CONSTRAINT leads_geschlecht_check CHECK ((geschlecht = ANY (ARRAY['m'::text, 'f'::text, 'd'::text]))),
    CONSTRAINT leads_insurance_type_check CHECK ((insurance_type = ANY (ARRAY['gkv'::text, 'privat'::text]))),
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'booked'::text, 'won'::text, 'lost'::text])))
);


--
-- Name: COLUMN leads.insurance_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.insurance_type IS 'gkv = gesetzlich versichert (fixed tariff prices), privat = privatversichert (practice-set prices)';


--
-- Name: mahnungen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mahnungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    patient_id uuid,
    mahnung_nr bigint NOT NULL,
    level smallint NOT NULL,
    amount_eur numeric(10,2) NOT NULL,
    original_faelligkeit date NOT NULL,
    neue_faelligkeit date NOT NULL,
    sent_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    status text DEFAULT 'offen'::text NOT NULL,
    notes text,
    CONSTRAINT mahnungen_level_check CHECK (((level >= 1) AND (level <= 3))),
    CONSTRAINT mahnungen_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'bezahlt'::text, 'abgeschrieben'::text])))
);


--
-- Name: messreihen; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messreihen_typ_check CHECK ((typ = ANY (ARRAY['VAS'::text, 'ROM'::text, 'kraft'::text, 'custom'::text])))
);


--
-- Name: patient_notes; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: pending_employee_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_employee_registrations (
    email text NOT NULL,
    owner_id uuid,
    anrede text,
    full_name text,
    working_hours jsonb,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval)
);


--
-- Name: pending_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    onboarding_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    stripe_checkout_session_id text,
    created_at timestamp with time zone DEFAULT now(),
    password_secret_id uuid
);


--
-- Name: podologie_behandlungen; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: prescription_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prescription_id uuid NOT NULL,
    booking_id uuid,
    session_number integer NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    done_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    notes text,
    heilmittel_index integer DEFAULT 0,
    CONSTRAINT prescription_sessions_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'done'::text, 'cancelled'::text, 'no_show'::text])))
);


--
-- Name: COLUMN prescription_sessions.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.prescription_sessions.notes IS 'Per-session therapist notes entered when marking session done';


--
-- Name: prescription_validations; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: COLUMN prescription_validations.overridden_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.prescription_validations.overridden_rules IS 'Array of rule codes (e.g. OVER_HOECHSTMENGE) that were active when therapist clicked proceed_anyway.';


--
-- Name: COLUMN prescription_validations.proceed_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.prescription_validations.proceed_reason IS 'Free-text reason supplied by therapist when overriding validation warnings. Required for DSGVO audit trail.';


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

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
    ocr_raw_response jsonb,
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
    CONSTRAINT prescriptions_abrechnung_status_check CHECK ((abrechnung_status = ANY (ARRAY['bereit'::text, 'in_abrechnung'::text, 'gesendet'::text, 'accepted'::text, 'rejected'::text, 'paid'::text]))),
    CONSTRAINT prescriptions_bericht_status_check CHECK ((bericht_status = ANY (ARRAY['offen'::text, 'in_arbeit'::text, 'erledigt'::text]))),
    CONSTRAINT prescriptions_rezept_typ_check CHECK ((rezept_typ = ANY (ARRAY['standard'::text, 'blanko'::text, 'lhb_bvb'::text, 'kassen'::text, 'privat'::text]))),
    CONSTRAINT prescriptions_signature_confidence_check CHECK ((signature_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT prescriptions_status_check CHECK ((status = ANY (ARRAY['parsed'::text, 'confirmed'::text, 'in_therapy'::text, 'completed'::text, 'billed'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN prescriptions.leitsymptomatik; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.prescriptions.leitsymptomatik IS '§302 Heilmittel Leitsymptomatik: 4-char a/b/c/d (each 0|1), e.g. 1010; 0000 requires free-text patientenLeitsymptomatik';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

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
    clinic_location public.geography(Point,4326),
    clinic_geocoded_at timestamp with time zone,
    clinic_lat numeric(9,6),
    clinic_lng numeric(9,6),
    avv_accepted_at timestamp with time zone,
    agb_accepted_at timestamp with time zone,
    deletion_scheduled_at timestamp with time zone,
    deletion_consent_at timestamp with time zone,
    deletion_consent_ip text,
    tablet_kiosk_pin text,
    praxis_logo_url text,
    invoice_footer_text text,
    urlaub_jahrestage integer DEFAULT 30,
    booking_auto_approve boolean DEFAULT false,
    booking_auto_approve_types text[] DEFAULT '{}'::text[],
    booking_request_link_enabled boolean DEFAULT true,
    CONSTRAINT profiles_anrede_check CHECK ((anrede = ANY (ARRAY['Herr'::text, 'Frau'::text, 'Divers'::text]))),
    CONSTRAINT profiles_billing_check CHECK ((billing = ANY (ARRAY['monthly'::text, 'annual'::text]))),
    CONSTRAINT profiles_billing_interval_check CHECK (((billing_interval = ANY (ARRAY['month'::text, 'year'::text])) OR (billing_interval IS NULL))),
    CONSTRAINT profiles_onboarding_step_check CHECK ((onboarding_step = ANY (ARRAY['account'::text, 'business'::text, 'owner'::text, 'services'::text, 'hours'::text, 'whatsapp'::text, 'templates'::text, 'plan'::text, 'done'::text]))),
    CONSTRAINT profiles_plan_check CHECK ((plan = ANY (ARRAY['starter'::text, 'professional'::text, 'klinik'::text, 'mitarbeiter'::text, 'enterprise'::text]))),
    CONSTRAINT profiles_plan_status_check CHECK ((plan_status = ANY (ARRAY['pending'::text, 'trial'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'expired'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'employee'::text]))),
    CONSTRAINT profiles_sector_check CHECK (((sector IS NULL) OR (sector = ANY (ARRAY['barber'::text, 'beauty'::text, 'nails'::text, 'tattoo'::text, 'spa'::text, 'gym'::text, 'massage'::text, 'physiotherapy'::text, 'praxis'::text, 'other'::text, 'podologie'::text, 'logopaedie'::text, 'ergotherapie'::text]))))
);


--
-- Name: COLUMN profiles.plan; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.plan IS 'Subscription plan: starter | professional | klinik | enterprise (multi-business)';


--
-- Name: COLUMN profiles.booking_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.booking_slug IS 'DEPRECATED 2026-05-22: moved to businesses.booking_slug. Kept for migration grace period.';


--
-- Name: COLUMN profiles.ik_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.ik_number IS 'Institutionskennzeichen (9-stellig, ARGE-IK) — für §302 SGB V Abrechnung über DMRZ';


--
-- Name: COLUMN profiles.tax_exempt_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.tax_exempt_note IS 'e.g. "Gemäß §4 Nr. 14 UStG umsatzsteuerfrei" for physio practices.';


--
-- Name: profiles_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profiles_public WITH (security_invoker='true') AS
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
   FROM public.profiles;


--
-- Name: referral_drafts; Type: TABLE; Schema: public; Owner: -
--

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
    business_id uuid,
    CONSTRAINT referral_drafts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: scraper_data; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    CONSTRAINT services_required_certificate_check CHECK ((required_certificate = ANY (ARRAY['MT'::text, 'MLD'::text, 'KGG'::text])))
);


--
-- Name: COLUMN services.is_internal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.is_internal IS 'Internal admin-only services (e.g. Blanko PD, Mehraufwand). Hidden from customer-facing pickers; visible in Dienstleistungen for tariff editing.';


--
-- Name: COLUMN services.gkv_position_nr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.gkv_position_nr IS 'Positionsnummer aus §125 SGB V Bundesvertrag (z.B. X0501=KG, X1201=MT). Links to heilmittel_tarif.';


--
-- Name: terapeut_zertifikat; Type: TABLE; Schema: public; Owner: -
--

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
    business_id uuid
);


--
-- Name: therapist_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    certificate text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT therapist_certificates_certificate_check CHECK ((certificate = ANY (ARRAY['MT'::text, 'MLD'::text, 'KGG'::text])))
);


--
-- Name: time_offs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_offs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    approved_at timestamp with time zone,
    CONSTRAINT time_offs_type_check CHECK ((type = ANY (ARRAY['urlaub'::text, 'krank'::text, 'frei'::text, 'elternzeit'::text])))
);


--
-- Name: trip_history; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: trip_plans; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: ueberweisungen; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: user_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    credits integer DEFAULT 2 NOT NULL,
    is_unlimited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    preference_key text NOT NULL,
    preference_value text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_preferences IS 'Per-user UI prefs. Keys: selected_business (UUID), calendar_view (daily|weekly|monthly), employee_filter (UUID|all)';


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

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
    business_id uuid,
    CONSTRAINT vehicles_kind_check CHECK ((kind = ANY (ARRAY['privat'::text, 'gewerblich'::text])))
);


--
-- Name: verordnungen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verordnungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    patient_name text,
    ausstellungsdatum date NOT NULL,
    diagnosegruppe text,
    icd10 text[],
    leitsymptomatik text,
    behandlungseinheiten integer,
    therapiefrequenz text,
    hausbesuch boolean DEFAULT false,
    therapiebericht boolean DEFAULT false,
    dringend boolean DEFAULT false,
    behandlungsstart date,
    status text DEFAULT 'aktiv'::text,
    notizen text,
    created_at timestamp with time zone DEFAULT now(),
    rezeptart text DEFAULT 'kassen'::text NOT NULL,
    beginn_spaetestens date,
    heilmittel_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    wagner_grad smallint,
    lead_id uuid,
    versichertennummer text,
    arzt_id uuid,
    kostentraeger_ik text,
    zuzahlung_befreit boolean DEFAULT false,
    CONSTRAINT verordnungen_status_check CHECK ((status = ANY (ARRAY['aktiv'::text, 'abrechenbar'::text, 'abgerechnet'::text, 'archiviert'::text]))),
    CONSTRAINT verordnungen_wagner_grad_check CHECK (((wagner_grad >= 0) AND (wagner_grad <= 5)))
);


--
-- Name: COLUMN verordnungen.rezeptart; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verordnungen.rezeptart IS 'Reçete türü: kassen | privat | bg | selbstzahler';


--
-- Name: COLUMN verordnungen.beginn_spaetestens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verordnungen.beginn_spaetestens IS 'ausstellungsdatum + 14 (dringend) veya + 28 gün — kayıt sırasında hesaplanır';


--
-- Name: COLUMN verordnungen.heilmittel_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verordnungen.heilmittel_items IS 'Dinamik hizmet listesi: [{code, bezeichnung, anzahl}]';


--
-- Name: warteliste; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT warteliste_priority_check CHECK (((priority >= 1) AND (priority <= 3))),
    CONSTRAINT warteliste_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'matched'::text, 'cancelled'::text])))
);


--
-- Name: working_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.working_hours (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    owner_id uuid,
    business_id uuid,
    CONSTRAINT working_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: zaa_fehler; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zaa_fehler (
    id bigint NOT NULL,
    abrechnung_id uuid NOT NULL,
    prescription_id uuid,
    fehler_code text NOT NULL,
    fehler_text text,
    uebersetzung text,
    loesung_hint text,
    status text DEFAULT 'offen'::text NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT zaa_fehler_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'in_bearbeitung'::text, 'behoben'::text, 'ignoriert'::text])))
);


--
-- Name: zaa_fehler_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zaa_fehler_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zaa_fehler_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zaa_fehler_id_seq OWNED BY public.zaa_fehler.id;


--
-- Name: zuzahlung_befreiung; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zuzahlung_befreiung (
    id bigint NOT NULL,
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


--
-- Name: zuzahlung_befreiung_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zuzahlung_befreiung_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zuzahlung_befreiung_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zuzahlung_befreiung_id_seq OWNED BY public.zuzahlung_befreiung.id;


--
-- Name: data_access_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_access_log ALTER COLUMN id SET DEFAULT nextval('public.data_access_log_id_seq'::regclass);


--
-- Name: dta_schluessel id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dta_schluessel ALTER COLUMN id SET DEFAULT nextval('public.dta_schluessel_id_seq'::regclass);


--
-- Name: heilmittel_tarif id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heilmittel_tarif ALTER COLUMN id SET DEFAULT nextval('public.heilmittel_tarif_id_seq'::regclass);


--
-- Name: zaa_fehler id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zaa_fehler ALTER COLUMN id SET DEFAULT nextval('public.zaa_fehler_id_seq'::regclass);


--
-- Name: zuzahlung_befreiung id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zuzahlung_befreiung ALTER COLUMN id SET DEFAULT nextval('public.zuzahlung_befreiung_id_seq'::regclass);


--
-- Name: abrechnung abrechnung_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abrechnung
    ADD CONSTRAINT abrechnung_pkey PRIMARY KEY (id);


--
-- Name: accommodations accommodations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accommodations
    ADD CONSTRAINT accommodations_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);


--
-- Name: aerzte aerzte_owner_id_arzt_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aerzte
    ADD CONSTRAINT aerzte_owner_id_arzt_name_key UNIQUE (owner_id, arzt_name);


--
-- Name: aerzte aerzte_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aerzte
    ADD CONSTRAINT aerzte_pkey PRIMARY KEY (id);


--
-- Name: ai_audit_log ai_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_audit_log
    ADD CONSTRAINT ai_audit_log_pkey PRIMARY KEY (id);


--
-- Name: anamnese anamnese_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anamnese
    ADD CONSTRAINT anamnese_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: b2b_contacts b2b_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.b2b_contacts
    ADD CONSTRAINT b2b_contacts_pkey PRIMARY KEY (id);


--
-- Name: belegliste belegliste_owner_id_beleg_nr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belegliste
    ADD CONSTRAINT belegliste_owner_id_beleg_nr_key UNIQUE (owner_id, beleg_nr);


--
-- Name: belegliste belegliste_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belegliste
    ADD CONSTRAINT belegliste_pkey PRIMARY KEY (id);


--
-- Name: booking_requests booking_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: breaks breaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaks
    ADD CONSTRAINT breaks_pkey PRIMARY KEY (id);


--
-- Name: business_services business_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_services
    ADD CONSTRAINT business_services_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_booking_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_booking_slug_key UNIQUE (booking_slug);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: calendar_integrations calendar_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_pkey PRIMARY KEY (id);


--
-- Name: calendar_integrations calendar_integrations_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_user_id_provider_key UNIQUE (user_id, provider);


--
-- Name: chatbot_usage chatbot_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_usage
    ADD CONSTRAINT chatbot_usage_pkey PRIMARY KEY (id);


--
-- Name: consent_log consent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_log
    ADD CONSTRAINT consent_log_pkey PRIMARY KEY (id);


--
-- Name: custom_days custom_days_owner_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_days
    ADD CONSTRAINT custom_days_owner_id_date_key UNIQUE (owner_id, date);


--
-- Name: custom_days custom_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_days
    ADD CONSTRAINT custom_days_pkey PRIMARY KEY (id);


--
-- Name: data_access_log data_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_access_log
    ADD CONSTRAINT data_access_log_pkey PRIMARY KEY (id);


--
-- Name: data_sharing_settings data_sharing_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sharing_settings
    ADD CONSTRAINT data_sharing_settings_pkey PRIMARY KEY (owner_id);


--
-- Name: demo_bookings demo_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_bookings
    ADD CONSTRAINT demo_bookings_pkey PRIMARY KEY (id);


--
-- Name: diagnosegruppen diagnosegruppen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosegruppen
    ADD CONSTRAINT diagnosegruppen_pkey PRIMARY KEY (code);


--
-- Name: document_vorlagen document_vorlagen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vorlagen
    ADD CONSTRAINT document_vorlagen_pkey PRIMARY KEY (id);


--
-- Name: dta_schluessel dta_schluessel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dta_schluessel
    ADD CONSTRAINT dta_schluessel_pkey PRIMARY KEY (id);


--
-- Name: dta_schluessel dta_schluessel_schluessel_typ_code_source_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dta_schluessel
    ADD CONSTRAINT dta_schluessel_schluessel_typ_code_source_version_key UNIQUE (schluessel_typ, code, source_version);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: employee_business_assignments employee_business_assignments_employee_id_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_business_assignments
    ADD CONSTRAINT employee_business_assignments_employee_id_business_id_key UNIQUE (employee_id, business_id);


--
-- Name: employee_business_assignments employee_business_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_business_assignments
    ADD CONSTRAINT employee_business_assignments_pkey PRIMARY KEY (id);


--
-- Name: employee_groups employee_groups_business_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_groups
    ADD CONSTRAINT employee_groups_business_id_name_key UNIQUE (business_id, name);


--
-- Name: employee_groups employee_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_groups
    ADD CONSTRAINT employee_groups_pkey PRIMARY KEY (id);


--
-- Name: employee_scope_overrides employee_scope_overrides_employee_id_business_id_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_scope_overrides
    ADD CONSTRAINT employee_scope_overrides_employee_id_business_id_module_key UNIQUE (employee_id, business_id, module);


--
-- Name: employee_scope_overrides employee_scope_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_scope_overrides
    ADD CONSTRAINT employee_scope_overrides_pkey PRIMARY KEY (id);


--
-- Name: employee_services employee_services_employee_id_service_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_services
    ADD CONSTRAINT employee_services_employee_id_service_id_key UNIQUE (employee_id, service_id);


--
-- Name: employee_services employee_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_services
    ADD CONSTRAINT employee_services_pkey PRIMARY KEY (id);


--
-- Name: fahrten fahrten_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fahrten
    ADD CONSTRAINT fahrten_booking_id_key UNIQUE (booking_id);


--
-- Name: fahrten fahrten_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fahrten
    ADD CONSTRAINT fahrten_pkey PRIMARY KEY (id);


--
-- Name: feedbacks feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_pkey PRIMARY KEY (id);


--
-- Name: fußstatus fußstatus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."fußstatus"
    ADD CONSTRAINT "fußstatus_pkey" PRIMARY KEY (id);


--
-- Name: group_scopes group_scopes_group_id_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_scopes
    ADD CONSTRAINT group_scopes_group_id_module_key UNIQUE (group_id, module);


--
-- Name: group_scopes group_scopes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_scopes
    ADD CONSTRAINT group_scopes_pkey PRIMARY KEY (id);


--
-- Name: heilmittel_catalog heilmittel_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heilmittel_catalog
    ADD CONSTRAINT heilmittel_catalog_pkey PRIMARY KEY (hpnr);


--
-- Name: heilmittel_position heilmittel_position_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heilmittel_position
    ADD CONSTRAINT heilmittel_position_pkey PRIMARY KEY (positionsnummer);


--
-- Name: heilmittel_tarif heilmittel_tarif_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heilmittel_tarif
    ADD CONSTRAINT heilmittel_tarif_pkey PRIMARY KEY (id);


--
-- Name: icd10_titles icd10_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icd10_titles
    ADD CONSTRAINT icd10_titles_pkey PRIMARY KEY (code);


--
-- Name: invoices invoices_owner_invoice_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_owner_invoice_number_unique UNIQUE (owner_id, invoice_number);


--
-- Name: CONSTRAINT invoices_owner_invoice_number_unique ON invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT invoices_owner_invoice_number_unique ON public.invoices IS 'Prevents duplicate invoice numbers per tenant (GoBD sequential uniqueness); NULL invoice_number allowed for drafts (Postgres treats NULLs as distinct).';


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: kostentraeger kostentraeger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kostentraeger
    ADD CONSTRAINT kostentraeger_pkey PRIMARY KEY (ik);


--
-- Name: krankenkassen krankenkassen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.krankenkassen
    ADD CONSTRAINT krankenkassen_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: mahnungen mahnungen_owner_id_mahnung_nr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mahnungen
    ADD CONSTRAINT mahnungen_owner_id_mahnung_nr_key UNIQUE (owner_id, mahnung_nr);


--
-- Name: mahnungen mahnungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mahnungen
    ADD CONSTRAINT mahnungen_pkey PRIMARY KEY (id);


--
-- Name: messreihen messreihen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messreihen
    ADD CONSTRAINT messreihen_pkey PRIMARY KEY (id);


--
-- Name: bookings no_overlapping_bookings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (user_id WITH =, tstzrange(start_time, end_time, '[)'::text) WITH &&) WHERE (((status = 'confirmed'::text) AND (group_parent_id IS NULL)));


--
-- Name: patient_notes patient_notes_owner_id_lead_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notes
    ADD CONSTRAINT patient_notes_owner_id_lead_id_key UNIQUE (owner_id, lead_id);


--
-- Name: patient_notes patient_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notes
    ADD CONSTRAINT patient_notes_pkey PRIMARY KEY (id);


--
-- Name: patients patients_owner_id_nachname_geburtsdatum_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_owner_id_nachname_geburtsdatum_key UNIQUE (owner_id, nachname, geburtsdatum);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: pending_employee_registrations pending_employee_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_employee_registrations
    ADD CONSTRAINT pending_employee_registrations_pkey PRIMARY KEY (email);


--
-- Name: pending_signups pending_signups_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_signups
    ADD CONSTRAINT pending_signups_email_key UNIQUE (email);


--
-- Name: pending_signups pending_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_signups
    ADD CONSTRAINT pending_signups_pkey PRIMARY KEY (id);


--
-- Name: podologie_behandlungen podologie_behandlungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.podologie_behandlungen
    ADD CONSTRAINT podologie_behandlungen_pkey PRIMARY KEY (id);


--
-- Name: prescription_sessions prescription_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_sessions
    ADD CONSTRAINT prescription_sessions_pkey PRIMARY KEY (id);


--
-- Name: prescription_sessions prescription_sessions_prescription_id_session_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_sessions
    ADD CONSTRAINT prescription_sessions_prescription_id_session_number_key UNIQUE (prescription_id, session_number);


--
-- Name: prescription_validations prescription_validations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_validations
    ADD CONSTRAINT prescription_validations_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_booking_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_booking_slug_unique UNIQUE (booking_slug);


--
-- Name: profiles profiles_company_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_company_code_key UNIQUE (company_code);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: referral_drafts referral_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_drafts
    ADD CONSTRAINT referral_drafts_pkey PRIMARY KEY (id);


--
-- Name: scraper_data scraper_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_data
    ADD CONSTRAINT scraper_data_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: terapeut_zertifikat terapeut_zertifikat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapeut_zertifikat
    ADD CONSTRAINT terapeut_zertifikat_pkey PRIMARY KEY (owner_id);


--
-- Name: therapist_certificates therapist_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_certificates
    ADD CONSTRAINT therapist_certificates_pkey PRIMARY KEY (id);


--
-- Name: therapist_certificates therapist_certificates_profile_id_certificate_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_certificates
    ADD CONSTRAINT therapist_certificates_profile_id_certificate_key UNIQUE (profile_id, certificate);


--
-- Name: time_offs time_offs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_offs
    ADD CONSTRAINT time_offs_pkey PRIMARY KEY (id);


--
-- Name: trip_history trip_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_history
    ADD CONSTRAINT trip_history_pkey PRIMARY KEY (id);


--
-- Name: trip_plans trip_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_plans
    ADD CONSTRAINT trip_plans_pkey PRIMARY KEY (id);


--
-- Name: ueberweisungen ueberweisungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ueberweisungen
    ADD CONSTRAINT ueberweisungen_pkey PRIMARY KEY (id);


--
-- Name: user_credits user_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credits
    ADD CONSTRAINT user_credits_pkey PRIMARY KEY (id);


--
-- Name: user_credits user_credits_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credits
    ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_preference_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_preference_key_key UNIQUE (user_id, preference_key);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: verordnungen verordnungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verordnungen
    ADD CONSTRAINT verordnungen_pkey PRIMARY KEY (id);


--
-- Name: warteliste warteliste_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warteliste
    ADD CONSTRAINT warteliste_pkey PRIMARY KEY (id);


--
-- Name: working_hours working_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.working_hours
    ADD CONSTRAINT working_hours_pkey PRIMARY KEY (id);


--
-- Name: working_hours working_hours_user_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.working_hours
    ADD CONSTRAINT working_hours_user_id_day_of_week_key UNIQUE (user_id, day_of_week);


--
-- Name: zaa_fehler zaa_fehler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zaa_fehler
    ADD CONSTRAINT zaa_fehler_pkey PRIMARY KEY (id);


--
-- Name: zuzahlung_befreiung zuzahlung_befreiung_patient_id_jahr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zuzahlung_befreiung
    ADD CONSTRAINT zuzahlung_befreiung_patient_id_jahr_key UNIQUE (patient_id, jahr);


--
-- Name: zuzahlung_befreiung zuzahlung_befreiung_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zuzahlung_befreiung
    ADD CONSTRAINT zuzahlung_befreiung_pkey PRIMARY KEY (id);


--
-- Name: chatbot_usage_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chatbot_usage_created_at_idx ON public.chatbot_usage USING btree (created_at DESC);


--
-- Name: chatbot_usage_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chatbot_usage_owner_id_idx ON public.chatbot_usage USING btree (owner_id) WHERE (owner_id IS NOT NULL);


--
-- Name: consent_log_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_log_pending_idx ON public.consent_log USING btree (pending_id);


--
-- Name: consent_log_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consent_log_user_idx ON public.consent_log USING btree (user_id);


--
-- Name: data_access_log_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_access_log_occurred_idx ON public.data_access_log USING btree (occurred_at DESC);


--
-- Name: data_access_log_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_access_log_owner_idx ON public.data_access_log USING btree (owner_id, occurred_at DESC);


--
-- Name: data_access_log_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_access_log_resource_idx ON public.data_access_log USING btree (resource, resource_id);


--
-- Name: data_access_log_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_access_log_user_idx ON public.data_access_log USING btree (user_id, occurred_at DESC);


--
-- Name: demo_bookings_slot_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX demo_bookings_slot_unique ON public.demo_bookings USING btree (booking_date, booking_time) WHERE (status = 'confirmed'::text);


--
-- Name: demo_bookings_token_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX demo_bookings_token_unique ON public.demo_bookings USING btree (reschedule_token);


--
-- Name: icd10_titles_code_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX icd10_titles_code_trgm ON public.icd10_titles USING gin (code public.gin_trgm_ops);


--
-- Name: icd10_titles_titel_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX icd10_titles_titel_trgm ON public.icd10_titles USING gin (titel public.gin_trgm_ops);


--
-- Name: idx_abrechnung_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abrechnung_business ON public.abrechnung USING btree (business_id);


--
-- Name: idx_abrechnung_kostentraeger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abrechnung_kostentraeger ON public.abrechnung USING btree (kostentraeger_ik, created_at DESC);


--
-- Name: idx_abrechnung_owner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abrechnung_owner_status ON public.abrechnung USING btree (owner_id, status, created_at DESC);


--
-- Name: idx_aerzte_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aerzte_business ON public.aerzte USING btree (business_id);


--
-- Name: idx_aerzte_lanr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aerzte_lanr ON public.aerzte USING btree (owner_id, lanr) WHERE (lanr IS NOT NULL);


--
-- Name: idx_aerzte_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aerzte_owner ON public.aerzte USING btree (owner_id);


--
-- Name: idx_ai_audit_task_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_task_created ON public.ai_audit_log USING btree (task, created_at DESC);


--
-- Name: idx_ai_audit_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_tenant_created ON public.ai_audit_log USING btree (tenant_id, created_at DESC);


--
-- Name: idx_anamnese_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anamnese_business ON public.anamnese USING btree (business_id);


--
-- Name: idx_anamnese_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anamnese_patient ON public.anamnese USING btree (patient_id);


--
-- Name: idx_attendance_business_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_business_date ON public.attendance USING btree (business_id, date DESC);


--
-- Name: idx_attendance_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_employee_date ON public.attendance USING btree (employee_id, date DESC);


--
-- Name: idx_attendance_owner_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_owner_date ON public.attendance USING btree (owner_id, date DESC);


--
-- Name: idx_b2b_contacts_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_b2b_contacts_business ON public.b2b_contacts USING btree (business_id);


--
-- Name: idx_b2b_contacts_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_b2b_contacts_owner ON public.b2b_contacts USING btree (owner_id);


--
-- Name: idx_befreiung_patient_jahr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_befreiung_patient_jahr ON public.zuzahlung_befreiung USING btree (patient_id, jahr);


--
-- Name: idx_belegliste_owner_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_belegliste_owner_time ON public.belegliste USING btree (owner_id, created_at DESC);


--
-- Name: idx_bookings_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_business ON public.bookings USING btree (business_id);


--
-- Name: idx_bookings_group_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_group_parent_id ON public.bookings USING btree (group_parent_id);


--
-- Name: idx_bookings_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_lead_id ON public.bookings USING btree (lead_id);


--
-- Name: idx_bookings_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_owner ON public.bookings USING btree (owner_id);


--
-- Name: idx_bookings_owner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_owner_status ON public.bookings USING btree (owner_id, status);


--
-- Name: idx_bookings_phone_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_phone_norm ON public.bookings USING btree (customer_phone_normalized) WHERE (customer_phone_normalized IS NOT NULL);


--
-- Name: idx_bookings_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_service ON public.bookings USING btree (service_id);


--
-- Name: idx_bookings_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_start ON public.bookings USING btree (start_time);


--
-- Name: idx_bookings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_user ON public.bookings USING btree (user_id);


--
-- Name: idx_bookings_user_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_user_start ON public.bookings USING btree (user_id, start_time);


--
-- Name: idx_breaks_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_breaks_business ON public.breaks USING btree (business_id);


--
-- Name: idx_breaks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_breaks_user ON public.breaks USING btree (user_id);


--
-- Name: idx_business_services_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_services_active ON public.business_services USING btree (business_id, is_active) WHERE (is_active = true);


--
-- Name: idx_business_services_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_services_business_id ON public.business_services USING btree (business_id);


--
-- Name: idx_businesses_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_owner ON public.businesses USING btree (owner_id);


--
-- Name: idx_businesses_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_slug ON public.businesses USING btree (booking_slug);


--
-- Name: idx_calendar_integrations_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_integrations_business ON public.calendar_integrations USING btree (business_id);


--
-- Name: idx_chatbot_usage_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_usage_business ON public.chatbot_usage USING btree (business_id);


--
-- Name: idx_custom_days_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_days_business ON public.custom_days USING btree (business_id);


--
-- Name: idx_custom_days_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_days_owner ON public.custom_days USING btree (owner_id);


--
-- Name: idx_eba_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eba_business ON public.employee_business_assignments USING btree (business_id);


--
-- Name: idx_eba_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eba_employee ON public.employee_business_assignments USING btree (employee_id);


--
-- Name: idx_email_logs_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_business ON public.email_logs USING btree (business_id);


--
-- Name: idx_email_logs_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_contact ON public.email_logs USING btree (contact_id);


--
-- Name: idx_email_logs_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_owner ON public.email_logs USING btree (owner_id);


--
-- Name: idx_employee_groups_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_groups_business ON public.employee_groups USING btree (business_id);


--
-- Name: idx_employee_services_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_services_business ON public.employee_services USING btree (business_id);


--
-- Name: idx_employee_services_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_services_employee ON public.employee_services USING btree (employee_id);


--
-- Name: idx_employee_services_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_services_service ON public.employee_services USING btree (service_id);


--
-- Name: idx_eso_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eso_lookup ON public.employee_scope_overrides USING btree (employee_id, business_id);


--
-- Name: idx_fahrten_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fahrten_business ON public.fahrten USING btree (business_id);


--
-- Name: idx_fahrten_owner_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fahrten_owner_user ON public.fahrten USING btree (owner_id, user_id, fahrt_started_at DESC);


--
-- Name: idx_feedbacks_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_business ON public.feedbacks USING btree (business_id);


--
-- Name: idx_feedbacks_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_owner ON public.feedbacks USING btree (owner_id);


--
-- Name: idx_group_scopes_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_scopes_group ON public.group_scopes USING btree (group_id);


--
-- Name: idx_invoices_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_business ON public.invoices USING btree (business_id);


--
-- Name: idx_invoices_invoice_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_invoice_type ON public.invoices USING btree (owner_id, invoice_type) WHERE (invoice_type IS NOT NULL);


--
-- Name: idx_invoices_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_owner ON public.invoices USING btree (owner_id);


--
-- Name: idx_invoices_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_patient ON public.invoices USING btree (patient_id);


--
-- Name: idx_invoices_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_prescription ON public.invoices USING btree (prescription_id) WHERE (prescription_id IS NOT NULL);


--
-- Name: idx_kostentraeger_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kostentraeger_active ON public.kostentraeger USING btree (active, payer_type) WHERE (active = true);


--
-- Name: idx_kostentraeger_das; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kostentraeger_das ON public.kostentraeger USING btree (das_ik) WHERE (das_ik IS NOT NULL);


--
-- Name: idx_leads_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_business ON public.leads USING btree (business_id);


--
-- Name: idx_leads_insurance_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_insurance_type ON public.leads USING btree (insurance_type) WHERE (insurance_type IS NOT NULL);


--
-- Name: idx_leads_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_location ON public.leads USING gist (location);


--
-- Name: idx_leads_name_dob; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_name_dob ON public.leads USING btree (owner_id, lower(COALESCE(first_name, ''::text)), lower(COALESCE(last_name, ''::text)), geburtsdatum);


--
-- Name: idx_leads_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_owner ON public.leads USING btree (owner_id, created_at DESC);


--
-- Name: idx_leads_owner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_owner_status ON public.leads USING btree (owner_id, status);


--
-- Name: idx_leads_phone_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_phone_norm ON public.leads USING btree (phone_normalized) WHERE (phone_normalized IS NOT NULL);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_mahnungen_owner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mahnungen_owner_status ON public.mahnungen USING btree (owner_id, status, sent_at DESC);


--
-- Name: idx_mahnungen_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mahnungen_prescription ON public.mahnungen USING btree (prescription_id);


--
-- Name: idx_messreihen_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messreihen_lead ON public.messreihen USING btree (lead_id, gemessen_am);


--
-- Name: idx_messreihen_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messreihen_owner ON public.messreihen USING btree (owner_id);


--
-- Name: idx_patient_notes_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_notes_business ON public.patient_notes USING btree (business_id);


--
-- Name: idx_patient_notes_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_notes_lead ON public.patient_notes USING btree (lead_id);


--
-- Name: idx_position_bereich; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_position_bereich ON public.heilmittel_position USING btree (heilmittel_bereich, active);


--
-- Name: idx_position_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_position_template ON public.heilmittel_position USING btree (template_x);


--
-- Name: idx_prescription_sessions_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescription_sessions_prescription ON public.prescription_sessions USING btree (prescription_id, session_number);


--
-- Name: idx_prescription_validations_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescription_validations_prescription ON public.prescription_validations USING btree (prescription_id, created_at DESC);


--
-- Name: idx_prescriptions_abrechnung; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_abrechnung ON public.prescriptions USING btree (abrechnung_id) WHERE (abrechnung_id IS NOT NULL);


--
-- Name: idx_prescriptions_bericht_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_bericht_status ON public.prescriptions USING btree (bericht_angefordert, bericht_status);


--
-- Name: idx_prescriptions_billing_ready; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_billing_ready ON public.prescriptions USING btree (owner_id, abrechnung_status) WHERE (abrechnung_status = 'bereit'::text);


--
-- Name: idx_prescriptions_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_business ON public.prescriptions USING btree (business_id);


--
-- Name: idx_prescriptions_owner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_owner_status ON public.prescriptions USING btree (owner_id, status, created_at DESC);


--
-- Name: idx_prescriptions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_patient ON public.prescriptions USING btree (patient_id, created_at DESC);


--
-- Name: idx_profiles_booking_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_booking_slug ON public.profiles USING btree (booking_slug);


--
-- Name: idx_profiles_clinic_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_clinic_location ON public.profiles USING gist (clinic_location);


--
-- Name: idx_profiles_deletion_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_deletion_scheduled ON public.profiles USING btree (deletion_scheduled_at) WHERE (deletion_scheduled_at IS NOT NULL);


--
-- Name: idx_profiles_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_is_active ON public.profiles USING btree (is_active);


--
-- Name: idx_profiles_plan_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_plan_status ON public.profiles USING btree (plan_status);


--
-- Name: idx_profiles_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_sector ON public.profiles USING btree (sector);


--
-- Name: idx_profiles_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_stripe_customer ON public.profiles USING btree (stripe_customer_id);


--
-- Name: idx_profiles_stripe_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_stripe_subscription ON public.profiles USING btree (stripe_subscription_id);


--
-- Name: idx_profiles_whatsapp_phone_number_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_whatsapp_phone_number_id ON public.profiles USING btree (whatsapp_phone_number_id) WHERE (whatsapp_phone_number_id IS NOT NULL);


--
-- Name: idx_referral_drafts_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_drafts_business ON public.referral_drafts USING btree (business_id);


--
-- Name: idx_referral_drafts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_drafts_created_at ON public.referral_drafts USING btree (created_at DESC);


--
-- Name: idx_referral_drafts_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_drafts_lead_id ON public.referral_drafts USING btree (lead_id);


--
-- Name: idx_referral_drafts_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_drafts_owner_id ON public.referral_drafts USING btree (owner_id);


--
-- Name: idx_referral_drafts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_drafts_status ON public.referral_drafts USING btree (status);


--
-- Name: idx_schluessel_bereich; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schluessel_bereich ON public.dta_schluessel USING btree (leistungsbereich) WHERE (leistungsbereich IS NOT NULL);


--
-- Name: idx_schluessel_typ; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schluessel_typ ON public.dta_schluessel USING btree (schluessel_typ, active);


--
-- Name: idx_scraper_data_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_data_business ON public.scraper_data USING btree (business_id);


--
-- Name: idx_scraper_data_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_data_created ON public.scraper_data USING btree (created_at DESC);


--
-- Name: idx_scraper_data_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_data_owner ON public.scraper_data USING btree (owner_id);


--
-- Name: idx_services_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_business ON public.services USING btree (business_id);


--
-- Name: idx_services_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_owner ON public.services USING btree (owner_id);


--
-- Name: idx_services_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_user ON public.services USING btree (user_id);


--
-- Name: idx_tarif_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarif_active ON public.heilmittel_tarif USING btree (bundesland, position_nr) WHERE (gueltig_bis IS NULL);


--
-- Name: idx_tarif_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarif_lookup ON public.heilmittel_tarif USING btree (bundesland, kostentraeger_ik, position_nr, gueltig_ab DESC);


--
-- Name: idx_terapeut_zertifikat_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terapeut_zertifikat_business ON public.terapeut_zertifikat USING btree (business_id);


--
-- Name: idx_time_offs_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_offs_business ON public.time_offs USING btree (business_id);


--
-- Name: idx_time_offs_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_offs_employee ON public.time_offs USING btree (employee_id);


--
-- Name: idx_ueberweisungen_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ueberweisungen_business ON public.ueberweisungen USING btree (business_id);


--
-- Name: idx_ueberweisungen_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ueberweisungen_lead ON public.ueberweisungen USING btree (lead_id);


--
-- Name: idx_ueberweisungen_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ueberweisungen_owner ON public.ueberweisungen USING btree (owner_id);


--
-- Name: idx_user_preferences_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_preferences_user ON public.user_preferences USING btree (user_id);


--
-- Name: idx_vehicles_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_business ON public.vehicles USING btree (business_id);


--
-- Name: idx_vehicles_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_created_by ON public.vehicles USING btree (created_by);


--
-- Name: idx_vehicles_owner_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_owner_kind ON public.vehicles USING btree (owner_id, kind);


--
-- Name: idx_verordnungen_arzt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verordnungen_arzt_id ON public.verordnungen USING btree (arzt_id);


--
-- Name: idx_verordnungen_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verordnungen_lead_id ON public.verordnungen USING btree (lead_id);


--
-- Name: idx_warteliste_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warteliste_owner ON public.warteliste USING btree (owner_id);


--
-- Name: idx_warteliste_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warteliste_status ON public.warteliste USING btree (owner_id, status);


--
-- Name: idx_working_hours_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_working_hours_business ON public.working_hours USING btree (business_id);


--
-- Name: idx_working_hours_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_working_hours_owner ON public.working_hours USING btree (owner_id);


--
-- Name: idx_working_hours_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_working_hours_user ON public.working_hours USING btree (user_id);


--
-- Name: idx_zaa_fehler_abrechnung; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zaa_fehler_abrechnung ON public.zaa_fehler USING btree (abrechnung_id, status);


--
-- Name: idx_zaa_fehler_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zaa_fehler_prescription ON public.zaa_fehler USING btree (prescription_id) WHERE (prescription_id IS NOT NULL);


--
-- Name: idx_zertifikat_expiring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zertifikat_expiring ON public.terapeut_zertifikat USING btree (cert_valid_to) WHERE (cert_valid_to IS NOT NULL);


--
-- Name: idx_zuzahlung_befreiung_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zuzahlung_befreiung_business ON public.zuzahlung_befreiung USING btree (business_id);


--
-- Name: uniq_businesses_default_per_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_businesses_default_per_owner ON public.businesses USING btree (owner_id) WHERE (is_default = true);


--
-- Name: uniq_default_vorlage; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_default_vorlage ON public.document_vorlagen USING btree (owner_id, vorlage_type) WHERE (is_default = true);


--
-- Name: abrechnung abrechnung_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER abrechnung_updated_at BEFORE UPDATE ON public.abrechnung FOR EACH ROW EXECUTE FUNCTION public.trg_billing_updated_at();


--
-- Name: business_services business_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER business_services_updated_at BEFORE UPDATE ON public.business_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: businesses businesses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: kostentraeger kostentraeger_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER kostentraeger_updated_at BEFORE UPDATE ON public.kostentraeger FOR EACH ROW EXECUTE FUNCTION public.trg_billing_updated_at();


--
-- Name: prescriptions prescriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.trg_prescriptions_updated_at();


--
-- Name: profiles profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: vehicles set_timestamp_vehicles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_vehicles BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();


--
-- Name: attendance trg_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_attendance_updated_at();


--
-- Name: zuzahlung_befreiung trg_befreiung_backfill_prescriptions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_befreiung_backfill_prescriptions AFTER INSERT OR DELETE OR UPDATE ON public.zuzahlung_befreiung FOR EACH ROW EXECUTE FUNCTION public.fn_befreiung_backfill_prescriptions();


--
-- Name: bookings trg_check_booking_closed_day; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_booking_closed_day BEFORE INSERT OR UPDATE OF start_time, business_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.fn_check_booking_closed_day();


--
-- Name: feedbacks trg_feedback_telegram; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_feedback_telegram AFTER INSERT ON public.feedbacks FOR EACH ROW EXECUTE FUNCTION public.notify_feedback_telegram();


--
-- Name: bookings trg_normalize_booking_phone; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_normalize_booking_phone BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_booking_phone_fn();


--
-- Name: leads trg_normalize_lead_phone; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_normalize_lead_phone BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_lead_phone_fn();


--
-- Name: prescriptions trg_prescriptions_set_befreit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prescriptions_set_befreit BEFORE INSERT OR UPDATE OF patient_id, ausstellungsdatum ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.fn_prescriptions_set_befreit();


--
-- Name: belegliste trg_prevent_belegliste_mod; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_belegliste_mod BEFORE DELETE OR UPDATE ON public.belegliste FOR EACH ROW EXECUTE FUNCTION public.prevent_belegliste_mod();


--
-- Name: businesses trg_seed_default_groups; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_seed_default_groups AFTER INSERT ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.seed_default_groups_for_business();


--
-- Name: belegliste trg_set_beleg_nr; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_beleg_nr BEFORE INSERT ON public.belegliste FOR EACH ROW WHEN (((new.beleg_nr IS NULL) OR (new.beleg_nr = 0))) EXECUTE FUNCTION public.set_next_beleg_nr();


--
-- Name: abrechnung trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.abrechnung FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: aerzte trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.aerzte FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: anamnese trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.anamnese FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: b2b_contacts trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.b2b_contacts FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: bookings trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_bookings_business_id_default();


--
-- Name: breaks trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.breaks FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: calendar_integrations trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.calendar_integrations FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: chatbot_usage trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.chatbot_usage FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: custom_days trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.custom_days FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: email_logs trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.email_logs FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: employee_services trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.employee_services FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: fahrten trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.fahrten FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: feedbacks trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.feedbacks FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: invoices trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: leads trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: patient_notes trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.patient_notes FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: prescriptions trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: referral_drafts trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.referral_drafts FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: scraper_data trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.scraper_data FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: services trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: terapeut_zertifikat trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.terapeut_zertifikat FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: time_offs trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.time_offs FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: ueberweisungen trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.ueberweisungen FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: vehicles trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: working_hours trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.working_hours FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: zuzahlung_befreiung trg_set_business_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.zuzahlung_befreiung FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();


--
-- Name: mahnungen trg_set_mahnung_nr; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_mahnung_nr BEFORE INSERT ON public.mahnungen FOR EACH ROW WHEN (((new.mahnung_nr IS NULL) OR (new.mahnung_nr = 0))) EXECUTE FUNCTION public.set_next_mahnung_nr();


--
-- Name: leads trg_sync_leads_location; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_leads_location BEFORE INSERT OR UPDATE OF lat, lng ON public.leads FOR EACH ROW EXECUTE FUNCTION public.sync_leads_location();


--
-- Name: profiles trg_sync_profiles_clinic_location; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_profiles_clinic_location BEFORE INSERT OR UPDATE OF clinic_lat, clinic_lng ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profiles_clinic_location();


--
-- Name: warteliste trg_warteliste_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_warteliste_updated_at BEFORE UPDATE ON public.warteliste FOR EACH ROW EXECUTE FUNCTION public.set_warteliste_updated_at();


--
-- Name: referral_drafts trigger_notify_new_referral_draft; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_new_referral_draft AFTER INSERT ON public.referral_drafts FOR EACH ROW EXECUTE FUNCTION public.notify_new_referral_draft();


--
-- Name: referral_drafts update_referral_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_referral_drafts_updated_at BEFORE UPDATE ON public.referral_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: terapeut_zertifikat zertifikat_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zertifikat_updated_at BEFORE UPDATE ON public.terapeut_zertifikat FOR EACH ROW EXECUTE FUNCTION public.trg_billing_updated_at();


--
-- Name: abrechnung abrechnung_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abrechnung
    ADD CONSTRAINT abrechnung_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: abrechnung abrechnung_kostentraeger_ik_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abrechnung
    ADD CONSTRAINT abrechnung_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES public.kostentraeger(ik);


--
-- Name: abrechnung abrechnung_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abrechnung
    ADD CONSTRAINT abrechnung_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: accommodations accommodations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accommodations
    ADD CONSTRAINT accommodations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: aerzte aerzte_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aerzte
    ADD CONSTRAINT aerzte_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: aerzte aerzte_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aerzte
    ADD CONSTRAINT aerzte_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: ai_audit_log ai_audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_audit_log
    ADD CONSTRAINT ai_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_audit_log ai_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_audit_log
    ADD CONSTRAINT ai_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: anamnese anamnese_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anamnese
    ADD CONSTRAINT anamnese_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: anamnese anamnese_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anamnese
    ADD CONSTRAINT anamnese_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: anamnese anamnese_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anamnese
    ADD CONSTRAINT anamnese_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: anamnese anamnese_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anamnese
    ADD CONSTRAINT anamnese_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.leads(id);


--
-- Name: anamnese anamnese_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anamnese
    ADD CONSTRAINT anamnese_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: b2b_contacts b2b_contacts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.b2b_contacts
    ADD CONSTRAINT b2b_contacts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: b2b_contacts b2b_contacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.b2b_contacts
    ADD CONSTRAINT b2b_contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: belegliste belegliste_abrechnung_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belegliste
    ADD CONSTRAINT belegliste_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES public.abrechnung(id) ON DELETE SET NULL;


--
-- Name: belegliste belegliste_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belegliste
    ADD CONSTRAINT belegliste_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: belegliste belegliste_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belegliste
    ADD CONSTRAINT belegliste_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: belegliste belegliste_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belegliste
    ADD CONSTRAINT belegliste_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: belegliste belegliste_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.belegliste
    ADD CONSTRAINT belegliste_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.profiles(id);


--
-- Name: booking_requests booking_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: booking_requests booking_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: booking_requests booking_requests_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_group_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_group_parent_id_fkey FOREIGN KEY (group_parent_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: bookings bookings_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: bookings bookings_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: breaks breaks_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaks
    ADD CONSTRAINT breaks_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: breaks breaks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.breaks
    ADD CONSTRAINT breaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: business_services business_services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_services
    ADD CONSTRAINT business_services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: businesses businesses_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: calendar_integrations calendar_integrations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: calendar_integrations calendar_integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: chatbot_usage chatbot_usage_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_usage
    ADD CONSTRAINT chatbot_usage_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: chatbot_usage chatbot_usage_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_usage
    ADD CONSTRAINT chatbot_usage_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: consent_log consent_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_log
    ADD CONSTRAINT consent_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: custom_days custom_days_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_days
    ADD CONSTRAINT custom_days_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: custom_days custom_days_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_days
    ADD CONSTRAINT custom_days_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: data_sharing_settings data_sharing_settings_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sharing_settings
    ADD CONSTRAINT data_sharing_settings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: document_vorlagen document_vorlagen_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vorlagen
    ADD CONSTRAINT document_vorlagen_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: document_vorlagen document_vorlagen_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vorlagen
    ADD CONSTRAINT document_vorlagen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: email_logs email_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: email_logs email_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.b2b_contacts(id) ON DELETE SET NULL;


--
-- Name: email_logs email_logs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: employee_business_assignments employee_business_assignments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_business_assignments
    ADD CONSTRAINT employee_business_assignments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employee_business_assignments employee_business_assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_business_assignments
    ADD CONSTRAINT employee_business_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: employee_business_assignments employee_business_assignments_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_business_assignments
    ADD CONSTRAINT employee_business_assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.employee_groups(id) ON DELETE SET NULL;


--
-- Name: employee_groups employee_groups_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_groups
    ADD CONSTRAINT employee_groups_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employee_scope_overrides employee_scope_overrides_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_scope_overrides
    ADD CONSTRAINT employee_scope_overrides_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employee_scope_overrides employee_scope_overrides_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_scope_overrides
    ADD CONSTRAINT employee_scope_overrides_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: employee_services employee_services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_services
    ADD CONSTRAINT employee_services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employee_services employee_services_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_services
    ADD CONSTRAINT employee_services_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES auth.users(id);


--
-- Name: employee_services employee_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_services
    ADD CONSTRAINT employee_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: fahrten fahrten_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fahrten
    ADD CONSTRAINT fahrten_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: fahrten fahrten_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fahrten
    ADD CONSTRAINT fahrten_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: fahrten fahrten_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fahrten
    ADD CONSTRAINT fahrten_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: fahrten fahrten_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fahrten
    ADD CONSTRAINT fahrten_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: fahrten fahrten_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fahrten
    ADD CONSTRAINT fahrten_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: feedbacks feedbacks_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;


--
-- Name: feedbacks feedbacks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: feedbacks feedbacks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: fußstatus fußstatus_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."fußstatus"
    ADD CONSTRAINT "fußstatus_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: fußstatus fußstatus_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."fußstatus"
    ADD CONSTRAINT "fußstatus_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: group_scopes group_scopes_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_scopes
    ADD CONSTRAINT group_scopes_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.employee_groups(id) ON DELETE CASCADE;


--
-- Name: heilmittel_tarif heilmittel_tarif_kostentraeger_ik_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heilmittel_tarif
    ADD CONSTRAINT heilmittel_tarif_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES public.kostentraeger(ik) ON DELETE CASCADE;


--
-- Name: invoices invoices_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: invoices invoices_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.leads(id);


--
-- Name: invoices invoices_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL;


--
-- Name: leads leads_arzt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_arzt_id_fkey FOREIGN KEY (arzt_id) REFERENCES public.aerzte(id);


--
-- Name: leads leads_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: leads leads_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mahnungen mahnungen_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mahnungen
    ADD CONSTRAINT mahnungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mahnungen mahnungen_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mahnungen
    ADD CONSTRAINT mahnungen_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: mahnungen mahnungen_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mahnungen
    ADD CONSTRAINT mahnungen_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: messreihen messreihen_erfasst_von_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messreihen
    ADD CONSTRAINT messreihen_erfasst_von_fkey FOREIGN KEY (erfasst_von) REFERENCES public.profiles(id);


--
-- Name: messreihen messreihen_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messreihen
    ADD CONSTRAINT messreihen_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: messreihen messreihen_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messreihen
    ADD CONSTRAINT messreihen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messreihen messreihen_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messreihen
    ADD CONSTRAINT messreihen_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL;


--
-- Name: patient_notes patient_notes_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notes
    ADD CONSTRAINT patient_notes_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: patient_notes patient_notes_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notes
    ADD CONSTRAINT patient_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: patient_notes patient_notes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notes
    ADD CONSTRAINT patient_notes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: patients patients_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: podologie_behandlungen podologie_behandlungen_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.podologie_behandlungen
    ADD CONSTRAINT podologie_behandlungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: podologie_behandlungen podologie_behandlungen_verordnung_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.podologie_behandlungen
    ADD CONSTRAINT podologie_behandlungen_verordnung_id_fkey FOREIGN KEY (verordnung_id) REFERENCES public.verordnungen(id) ON DELETE SET NULL;


--
-- Name: prescription_sessions prescription_sessions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_sessions
    ADD CONSTRAINT prescription_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: prescription_sessions prescription_sessions_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_sessions
    ADD CONSTRAINT prescription_sessions_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescription_validations prescription_validations_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_validations
    ADD CONSTRAINT prescription_validations_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescription_validations prescription_validations_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_validations
    ADD CONSTRAINT prescription_validations_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES auth.users(id);


--
-- Name: prescriptions prescriptions_abrechnung_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES public.abrechnung(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_arzt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_arzt_id_fkey FOREIGN KEY (arzt_id) REFERENCES public.aerzte(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);


--
-- Name: prescriptions prescriptions_kostentraeger_ik_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_kostentraeger_ik_fkey FOREIGN KEY (kostentraeger_ik) REFERENCES public.kostentraeger(ik);


--
-- Name: prescriptions prescriptions_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: referral_drafts referral_drafts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_drafts
    ADD CONSTRAINT referral_drafts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: referral_drafts referral_drafts_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_drafts
    ADD CONSTRAINT referral_drafts_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);


--
-- Name: referral_drafts referral_drafts_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_drafts
    ADD CONSTRAINT referral_drafts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: referral_drafts referral_drafts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_drafts
    ADD CONSTRAINT referral_drafts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: scraper_data scraper_data_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_data
    ADD CONSTRAINT scraper_data_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: scraper_data scraper_data_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_data
    ADD CONSTRAINT scraper_data_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: services services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: services services_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: services services_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: terapeut_zertifikat terapeut_zertifikat_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapeut_zertifikat
    ADD CONSTRAINT terapeut_zertifikat_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: terapeut_zertifikat terapeut_zertifikat_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapeut_zertifikat
    ADD CONSTRAINT terapeut_zertifikat_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: therapist_certificates therapist_certificates_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_certificates
    ADD CONSTRAINT therapist_certificates_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_certificates therapist_certificates_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_certificates
    ADD CONSTRAINT therapist_certificates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: time_offs time_offs_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_offs
    ADD CONSTRAINT time_offs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: time_offs time_offs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_offs
    ADD CONSTRAINT time_offs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: time_offs time_offs_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_offs
    ADD CONSTRAINT time_offs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: time_offs time_offs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_offs
    ADD CONSTRAINT time_offs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: trip_history trip_history_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_history
    ADD CONSTRAINT trip_history_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.trip_plans(id) ON DELETE CASCADE;


--
-- Name: trip_history trip_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_history
    ADD CONSTRAINT trip_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trip_plans trip_plans_accommodation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_plans
    ADD CONSTRAINT trip_plans_accommodation_id_fkey FOREIGN KEY (accommodation_id) REFERENCES public.accommodations(id);


--
-- Name: trip_plans trip_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_plans
    ADD CONSTRAINT trip_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ueberweisungen ueberweisungen_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ueberweisungen
    ADD CONSTRAINT ueberweisungen_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: ueberweisungen ueberweisungen_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ueberweisungen
    ADD CONSTRAINT ueberweisungen_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: ueberweisungen ueberweisungen_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ueberweisungen
    ADD CONSTRAINT ueberweisungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: user_credits user_credits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credits
    ADD CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: verordnungen verordnungen_arzt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verordnungen
    ADD CONSTRAINT verordnungen_arzt_id_fkey FOREIGN KEY (arzt_id) REFERENCES public.aerzte(id) ON DELETE SET NULL;


--
-- Name: verordnungen verordnungen_diagnosegruppe_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verordnungen
    ADD CONSTRAINT verordnungen_diagnosegruppe_fkey FOREIGN KEY (diagnosegruppe) REFERENCES public.diagnosegruppen(code);


--
-- Name: verordnungen verordnungen_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verordnungen
    ADD CONSTRAINT verordnungen_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: verordnungen verordnungen_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verordnungen
    ADD CONSTRAINT verordnungen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: warteliste warteliste_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warteliste
    ADD CONSTRAINT warteliste_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: warteliste warteliste_matched_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warteliste
    ADD CONSTRAINT warteliste_matched_booking_id_fkey FOREIGN KEY (matched_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: warteliste warteliste_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warteliste
    ADD CONSTRAINT warteliste_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: warteliste warteliste_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warteliste
    ADD CONSTRAINT warteliste_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: working_hours working_hours_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.working_hours
    ADD CONSTRAINT working_hours_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: working_hours working_hours_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.working_hours
    ADD CONSTRAINT working_hours_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: working_hours working_hours_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.working_hours
    ADD CONSTRAINT working_hours_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: zaa_fehler zaa_fehler_abrechnung_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zaa_fehler
    ADD CONSTRAINT zaa_fehler_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES public.abrechnung(id) ON DELETE CASCADE;


--
-- Name: zaa_fehler zaa_fehler_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zaa_fehler
    ADD CONSTRAINT zaa_fehler_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL;


--
-- Name: zuzahlung_befreiung zuzahlung_befreiung_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zuzahlung_befreiung
    ADD CONSTRAINT zuzahlung_befreiung_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: zuzahlung_befreiung zuzahlung_befreiung_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zuzahlung_befreiung
    ADD CONSTRAINT zuzahlung_befreiung_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: zuzahlung_befreiung zuzahlung_befreiung_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zuzahlung_befreiung
    ADD CONSTRAINT zuzahlung_befreiung_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: krankenkassen Allow authenticated read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read" ON public.krankenkassen FOR SELECT TO authenticated USING (true);


--
-- Name: employee_services Authenticated operations employee services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated operations employee services" ON public.employee_services USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: time_offs Authenticated operations time offs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated operations time offs" ON public.time_offs USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: belegliste Belegliste insert scoping; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Belegliste insert scoping" ON public.belegliste FOR INSERT WITH CHECK (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = belegliste.owner_id)))));


--
-- Name: belegliste Belegliste select scoping; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Belegliste select scoping" ON public.belegliste FOR SELECT USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = belegliste.owner_id)))));


--
-- Name: bookings Employees can delete bookings for their owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can delete bookings for their owner" ON public.bookings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.owner_id = bookings.owner_id)))));


--
-- Name: bookings Employees can insert bookings for their owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can insert bookings for their owner" ON public.bookings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.owner_id = bookings.owner_id)))));


--
-- Name: breaks Employees can see owner breaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can see owner breaks" ON public.breaks FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.owner_id = breaks.user_id))))));


--
-- Name: bookings Employees can update bookings for their owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update bookings for their owner" ON public.bookings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.owner_id = bookings.owner_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.owner_id = bookings.owner_id)))));


--
-- Name: bookings Employees can view team bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view team bookings" ON public.bookings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.owner_id = bookings.owner_id)))));


--
-- Name: bookings Kullanıcılar kendi aldıkları randevuları görebilir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Kullanıcılar kendi aldıkları randevuları görebilir" ON public.bookings USING ((auth.uid() = user_id));


--
-- Name: services Kullanıcılar kendi hizmetlerini ekleyebilir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Kullanıcılar kendi hizmetlerini ekleyebilir" ON public.services FOR INSERT WITH CHECK (((auth.uid() = user_id) OR (auth.uid() = owner_id)));


--
-- Name: services Kullanıcılar kendi hizmetlerini silebilir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Kullanıcılar kendi hizmetlerini silebilir" ON public.services FOR DELETE USING (((auth.uid() = user_id) OR (auth.uid() = owner_id)));


--
-- Name: calendar_integrations Kullanıcılar sadece kendi tokenlarını görebilir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Kullanıcılar sadece kendi tokenlarını görebilir" ON public.calendar_integrations USING ((auth.uid() = user_id));


--
-- Name: business_services Owner can delete services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can delete services" ON public.business_services FOR DELETE USING ((auth.uid() = business_id));


--
-- Name: business_services Owner can insert services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can insert services" ON public.business_services FOR INSERT WITH CHECK ((auth.uid() = business_id));


--
-- Name: business_services Owner can update services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can update services" ON public.business_services FOR UPDATE USING ((auth.uid() = business_id));


--
-- Name: business_services Owner can view services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can view services" ON public.business_services FOR SELECT USING ((auth.uid() = business_id));


--
-- Name: warteliste Owner zugriff auf warteliste; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner zugriff auf warteliste" ON public.warteliste USING ((owner_id = auth.uid()));


--
-- Name: bookings Owners can update team bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update team bookings" ON public.bookings FOR UPDATE USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: bookings Owners can view team bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view team bookings" ON public.bookings FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: profiles Profiles tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles tenant read" ON public.profiles FOR SELECT USING (((id = auth.uid()) OR (owner_id = auth.uid()) OR (id = public.auth_tenant_id()) OR (owner_id = public.auth_tenant_id())));


--
-- Name: businesses Public booking lookup businesses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public booking lookup businesses" ON public.businesses FOR SELECT USING (((auth.uid() IS NULL) AND (booking_slug IS NOT NULL)));


--
-- Name: profiles Public booking lookup profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public booking lookup profiles" ON public.profiles FOR SELECT USING (((auth.uid() IS NULL) AND (booking_slug IS NOT NULL) AND (accepts_bookings = true)));


--
-- Name: employee_services Public read employee services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read employee services" ON public.employee_services FOR SELECT USING (true);


--
-- Name: services Public read services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);


--
-- Name: time_offs Public read time offs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read time offs" ON public.time_offs FOR SELECT USING (true);


--
-- Name: working_hours Public read working hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read working hours" ON public.working_hours FOR SELECT USING (true);


--
-- Name: referral_drafts Users can delete own referral drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own referral drafts" ON public.referral_drafts FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: applications Users can insert own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own applications" ON public.applications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: referral_drafts Users can insert own referral drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own referral drafts" ON public.referral_drafts FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: breaks Users can manage own breaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own breaks" ON public.breaks USING ((user_id = auth.uid()));


--
-- Name: applications Users can read own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own applications" ON public.applications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_credits Users can read own credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own credits" ON public.user_credits FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: referral_drafts Users can update own referral drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own referral drafts" ON public.referral_drafts FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: referral_drafts Users can view own referral drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own referral drafts" ON public.referral_drafts FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: accommodations Users manage own accommodations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own accommodations" ON public.accommodations USING ((auth.uid() = user_id));


--
-- Name: trip_history Users manage own history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own history" ON public.trip_history USING ((auth.uid() = user_id));


--
-- Name: trip_plans Users manage own plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own plans" ON public.trip_plans USING ((auth.uid() = user_id));


--
-- Name: profiles Users manage own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own profile" ON public.profiles USING ((auth.uid() = id));


--
-- Name: abrechnung; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abrechnung ENABLE ROW LEVEL SECURITY;

--
-- Name: abrechnung abrechnung_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY abrechnung_owner_all ON public.abrechnung USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = abrechnung.owner_id)))));


--
-- Name: accommodations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: aerzte; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aerzte ENABLE ROW LEVEL SECURITY;

--
-- Name: aerzte aerzte_delete_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aerzte_delete_owner ON public.aerzte FOR DELETE USING ((auth.uid() = owner_id));


--
-- Name: aerzte aerzte_insert_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aerzte_insert_owner ON public.aerzte FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: aerzte aerzte_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aerzte_select_owner ON public.aerzte FOR SELECT USING (((auth.uid() = owner_id) OR (owner_id IN ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'employee'::text))))));


--
-- Name: aerzte aerzte_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aerzte_update_owner ON public.aerzte FOR UPDATE USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: ai_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_audit_log ai_audit_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_audit_select_own ON public.ai_audit_log FOR SELECT USING ((auth.uid() = tenant_id));


--
-- Name: anamnese; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anamnese ENABLE ROW LEVEL SECURITY;

--
-- Name: anamnese anamnese_owner_and_team_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anamnese_owner_and_team_delete ON public.anamnese FOR DELETE USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: anamnese anamnese_owner_and_team_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anamnese_owner_and_team_insert ON public.anamnese FOR INSERT WITH CHECK (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: anamnese anamnese_owner_and_team_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anamnese_owner_and_team_select ON public.anamnese FOR SELECT USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: anamnese anamnese_owner_and_team_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anamnese_owner_and_team_update ON public.anamnese FOR UPDATE USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))))) WITH CHECK (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: demo_bookings anon can insert demo_bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon can insert demo_bookings" ON public.demo_bookings FOR INSERT TO anon WITH CHECK (true);


--
-- Name: pending_employee_registrations anon_insert_pending_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert_pending_employee ON public.pending_employee_registrations FOR INSERT WITH CHECK (true);


--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: demo_bookings authenticated can select demo_bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can select demo_bookings" ON public.demo_bookings FOR SELECT TO authenticated USING (true);


--
-- Name: b2b_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.b2b_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: zuzahlung_befreiung befreiung_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY befreiung_owner_all ON public.zuzahlung_befreiung USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = zuzahlung_befreiung.owner_id)))));


--
-- Name: belegliste; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.belegliste ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings bookings_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_owner_read ON public.bookings USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = bookings.owner_id)))));


--
-- Name: breaks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;

--
-- Name: business_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_services ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses businesses_delete_owner_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_delete_owner_only ON public.businesses FOR DELETE USING ((auth.uid() = owner_id));


--
-- Name: businesses businesses_insert_owner_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_insert_owner_only ON public.businesses FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: businesses businesses_select_owner_or_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_select_owner_or_employee ON public.businesses FOR SELECT USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = businesses.owner_id)))));


--
-- Name: businesses businesses_update_owner_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_update_owner_only ON public.businesses FOR UPDATE USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: calendar_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: chatbot_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chatbot_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_days ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_days custom_days_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_days_owner_all ON public.custom_days USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: custom_days custom_days_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_days_public_read ON public.custom_days FOR SELECT USING (true);


--
-- Name: data_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: data_sharing_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_sharing_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: demo_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnosegruppen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diagnosegruppen ENABLE ROW LEVEL SECURITY;

--
-- Name: document_vorlagen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_vorlagen ENABLE ROW LEVEL SECURITY;

--
-- Name: data_sharing_settings dss_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dss_insert ON public.data_sharing_settings FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: data_sharing_settings dss_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dss_select ON public.data_sharing_settings FOR SELECT USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: data_sharing_settings dss_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dss_update ON public.data_sharing_settings FOR UPDATE USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: dta_schluessel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dta_schluessel ENABLE ROW LEVEL SECURITY;

--
-- Name: dta_schluessel dta_schluessel_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dta_schluessel_read_all ON public.dta_schluessel FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: employee_business_assignments eba_delete_owner_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eba_delete_owner_only ON public.employee_business_assignments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = employee_business_assignments.business_id) AND (b.owner_id = auth.uid())))));


--
-- Name: employee_business_assignments eba_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eba_select ON public.employee_business_assignments FOR SELECT USING (((employee_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = employee_business_assignments.business_id) AND (b.owner_id = auth.uid()))))));


--
-- Name: employee_business_assignments eba_update_owner_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eba_update_owner_only ON public.employee_business_assignments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = employee_business_assignments.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = employee_business_assignments.business_id) AND (b.owner_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = employee_business_assignments.employee_id) AND (p.owner_id = auth.uid()))))));


--
-- Name: employee_business_assignments eba_write_owner_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eba_write_owner_only ON public.employee_business_assignments FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = employee_business_assignments.business_id) AND (b.owner_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = employee_business_assignments.employee_id) AND (p.owner_id = auth.uid()))))));


--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_business_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_business_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_groups employee_groups_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_groups_owner_all ON public.employee_groups USING ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = employee_groups.business_id) AND ((b.owner_id = auth.uid()) OR (auth.uid() IN ( SELECT profiles.id
           FROM public.profiles
          WHERE (profiles.owner_id = b.owner_id))))))));


--
-- Name: attendance employee_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_insert_own ON public.attendance FOR INSERT WITH CHECK (((auth.uid() = employee_id) AND (date = CURRENT_DATE)));


--
-- Name: attendance employee_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_read_own ON public.attendance FOR SELECT USING ((auth.uid() = employee_id));


--
-- Name: employee_scope_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_scope_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_services ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance employee_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_update_own ON public.attendance FOR UPDATE USING ((auth.uid() = employee_id)) WITH CHECK ((auth.uid() = employee_id));


--
-- Name: employee_scope_overrides eso_owner_or_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eso_owner_or_self ON public.employee_scope_overrides USING (((employee_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE ((b.id = employee_scope_overrides.business_id) AND (b.owner_id = auth.uid()))))));


--
-- Name: fahrten; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fahrten ENABLE ROW LEVEL SECURITY;

--
-- Name: fahrten fahrten delete policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "fahrten delete policy" ON public.fahrten FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: fahrten fahrten insert policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "fahrten insert policy" ON public.fahrten FOR INSERT WITH CHECK (((user_id = auth.uid()) AND ((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.owner_id = fahrten.owner_id)))))));


--
-- Name: fahrten fahrten select policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "fahrten select policy" ON public.fahrten FOR SELECT USING (((owner_id = auth.uid()) OR (user_id = auth.uid())));


--
-- Name: fahrten fahrten update policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "fahrten update policy" ON public.fahrten FOR UPDATE USING (((user_id = auth.uid()) OR (owner_id = auth.uid()))) WITH CHECK (((user_id = auth.uid()) OR (owner_id = auth.uid())));


--
-- Name: feedbacks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

--
-- Name: feedbacks feedbacks_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedbacks_insert_own ON public.feedbacks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: feedbacks feedbacks_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedbacks_select_own ON public.feedbacks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: feedbacks feedbacks_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedbacks_update_own ON public.feedbacks FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: fußstatus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."fußstatus" ENABLE ROW LEVEL SECURITY;

--
-- Name: group_scopes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_scopes ENABLE ROW LEVEL SECURITY;

--
-- Name: group_scopes group_scopes_via_group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY group_scopes_via_group ON public.group_scopes USING ((group_id IN ( SELECT eg.id
   FROM (public.employee_groups eg
     JOIN public.businesses b ON ((b.id = eg.business_id)))
  WHERE ((b.owner_id = auth.uid()) OR (auth.uid() IN ( SELECT profiles.id
           FROM public.profiles
          WHERE (profiles.owner_id = b.owner_id)))))));


--
-- Name: heilmittel_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.heilmittel_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: heilmittel_position; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.heilmittel_position ENABLE ROW LEVEL SECURITY;

--
-- Name: heilmittel_position heilmittel_position_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY heilmittel_position_read_all ON public.heilmittel_position FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: heilmittel_tarif; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.heilmittel_tarif ENABLE ROW LEVEL SECURITY;

--
-- Name: heilmittel_tarif heilmittel_tarif_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY heilmittel_tarif_read_all ON public.heilmittel_tarif FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: icd10_titles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icd10_titles ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: kostentraeger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kostentraeger ENABLE ROW LEVEL SECURITY;

--
-- Name: kostentraeger kostentraeger_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kostentraeger_read_all ON public.kostentraeger FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: krankenkassen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.krankenkassen ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: mahnungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mahnungen ENABLE ROW LEVEL SECURITY;

--
-- Name: mahnungen mahnungen_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mahnungen_insert ON public.mahnungen FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: mahnungen mahnungen_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mahnungen_select ON public.mahnungen FOR SELECT USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = mahnungen.owner_id)))));


--
-- Name: mahnungen mahnungen_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mahnungen_update ON public.mahnungen FOR UPDATE USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: messreihen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messreihen ENABLE ROW LEVEL SECURITY;

--
-- Name: messreihen messreihen_owner_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messreihen_owner_access ON public.messreihen USING (((owner_id = auth.uid()) OR (owner_id IN ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: data_access_log owner reads own access log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner reads own access log" ON public.data_access_log FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: patients owner sees own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner sees own patients" ON public.patients USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = patients.owner_id)))));


--
-- Name: booking_requests owner sees own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner sees own requests" ON public.booking_requests USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = booking_requests.owner_id)))));


--
-- Name: email_logs owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_all ON public.email_logs USING (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.owner_id = email_logs.owner_id)))))) WITH CHECK (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.owner_id = email_logs.owner_id))))));


--
-- Name: invoices owner_and_employee_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_and_employee_invoices ON public.invoices USING (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.owner_id = invoices.owner_id)))))) WITH CHECK (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.owner_id = invoices.owner_id))))));


--
-- Name: podologie_behandlungen owner_behandlungen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_behandlungen ON public.podologie_behandlungen USING ((owner_id = auth.uid()));


--
-- Name: b2b_contacts owner_crud_b2b_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_crud_b2b_contacts ON public.b2b_contacts USING (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.owner_id = b2b_contacts.owner_id)))))) WITH CHECK (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.owner_id = b2b_contacts.owner_id))))));


--
-- Name: scraper_data owner_crud_scraper_data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_crud_scraper_data ON public.scraper_data USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: fußstatus owner_fußstatus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner_fußstatus" ON public."fußstatus" USING ((owner_id = auth.uid()));


--
-- Name: patient_notes owner_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_only ON public.patient_notes USING ((auth.uid() = owner_id));


--
-- Name: attendance owner_read_team; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read_team ON public.attendance FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: attendance owner_update_team; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_update_team ON public.attendance FOR UPDATE USING ((auth.uid() = owner_id));


--
-- Name: verordnungen owner_verordnungen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_verordnungen ON public.verordnungen USING ((owner_id = auth.uid()));


--
-- Name: patient_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_employee_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pending_employee_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_signups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: podologie_behandlungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.podologie_behandlungen ENABLE ROW LEVEL SECURITY;

--
-- Name: prescription_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescription_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: prescription_sessions prescription_sessions_via_prescription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prescription_sessions_via_prescription ON public.prescription_sessions USING ((prescription_id IN ( SELECT prescriptions.id
   FROM public.prescriptions
  WHERE ((prescriptions.owner_id = auth.uid()) OR (auth.uid() IN ( SELECT profiles.id
           FROM public.profiles
          WHERE (profiles.owner_id = prescriptions.owner_id)))))));


--
-- Name: prescription_validations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescription_validations ENABLE ROW LEVEL SECURITY;

--
-- Name: prescription_validations prescription_validations_via_prescription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prescription_validations_via_prescription ON public.prescription_validations USING ((prescription_id IN ( SELECT prescriptions.id
   FROM public.prescriptions
  WHERE ((prescriptions.owner_id = auth.uid()) OR (auth.uid() IN ( SELECT profiles.id
           FROM public.profiles
          WHERE (profiles.owner_id = prescriptions.owner_id)))))));


--
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: prescriptions prescriptions_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prescriptions_owner_all ON public.prescriptions USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = prescriptions.owner_id)))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnosegruppen read_only_reference; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_only_reference ON public.diagnosegruppen FOR SELECT TO authenticated, anon USING (true);


--
-- Name: heilmittel_catalog read_only_reference; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_only_reference ON public.heilmittel_catalog FOR SELECT TO authenticated, anon USING (true);


--
-- Name: icd10_titles read_only_reference; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_only_reference ON public.icd10_titles FOR SELECT TO authenticated, anon USING (true);


--
-- Name: referral_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_data ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: services services_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_update ON public.services FOR UPDATE USING (((auth.uid() = user_id) OR (auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.owner_id = services.owner_id) AND (profiles.role = 'employee'::text))))));


--
-- Name: leads team delete leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team delete leads" ON public.leads FOR DELETE TO authenticated USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: leads team insert leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: leads team update leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team update leads" ON public.leads FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: leads team view leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team view leads" ON public.leads FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: terapeut_zertifikat; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.terapeut_zertifikat ENABLE ROW LEVEL SECURITY;

--
-- Name: therapist_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.therapist_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: therapist_certificates therapist_certificates_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY therapist_certificates_delete ON public.therapist_certificates FOR DELETE USING (((auth.uid() = owner_id) OR (auth.uid() = profile_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = therapist_certificates.owner_id)))));


--
-- Name: therapist_certificates therapist_certificates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY therapist_certificates_insert ON public.therapist_certificates FOR INSERT WITH CHECK (((auth.uid() = owner_id) OR (auth.uid() = profile_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = therapist_certificates.owner_id)))));


--
-- Name: therapist_certificates therapist_certificates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY therapist_certificates_select ON public.therapist_certificates FOR SELECT USING (((auth.uid() = owner_id) OR (auth.uid() = profile_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = therapist_certificates.owner_id)))));


--
-- Name: time_offs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_offs ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_history ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: ueberweisungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ueberweisungen ENABLE ROW LEVEL SECURITY;

--
-- Name: ueberweisungen ueberweisungen_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ueberweisungen_delete ON public.ueberweisungen FOR DELETE USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: ueberweisungen ueberweisungen_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ueberweisungen_insert ON public.ueberweisungen FOR INSERT WITH CHECK (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: ueberweisungen ueberweisungen_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ueberweisungen_select ON public.ueberweisungen FOR SELECT USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: ueberweisungen ueberweisungen_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ueberweisungen_update ON public.ueberweisungen FOR UPDATE USING (((owner_id = auth.uid()) OR (owner_id = ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: user_credits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_employee_registrations user_delete_own_pending_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_delete_own_pending_employee ON public.pending_employee_registrations FOR DELETE USING ((email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text));


--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences user_preferences_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_preferences_self ON public.user_preferences USING ((user_id = auth.uid()));


--
-- Name: pending_employee_registrations user_select_own_pending_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_select_own_pending_employee ON public.pending_employee_registrations FOR SELECT USING ((email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text));


--
-- Name: admin_users users can check own admin status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can check own admin status" ON public.admin_users FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: consent_log users read own consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own consents" ON public.consent_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles vehicles delete policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vehicles delete policy" ON public.vehicles FOR DELETE USING (((owner_id = auth.uid()) OR ((kind = 'privat'::text) AND (created_by = auth.uid()))));


--
-- Name: vehicles vehicles insert policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vehicles insert policy" ON public.vehicles FOR INSERT WITH CHECK (((created_by = auth.uid()) AND ((owner_id = auth.uid()) OR ((kind = 'privat'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.owner_id = vehicles.owner_id))))))));


--
-- Name: vehicles vehicles select policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vehicles select policy" ON public.vehicles FOR SELECT USING (((owner_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.owner_id = vehicles.owner_id)))) AND ((kind = 'gewerblich'::text) OR (created_by = auth.uid())))));


--
-- Name: vehicles vehicles update policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vehicles update policy" ON public.vehicles FOR UPDATE USING (((owner_id = auth.uid()) OR ((kind = 'privat'::text) AND (created_by = auth.uid())))) WITH CHECK (((owner_id = auth.uid()) OR ((kind = 'privat'::text) AND (created_by = auth.uid()))));


--
-- Name: verordnungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verordnungen ENABLE ROW LEVEL SECURITY;

--
-- Name: document_vorlagen vorlagen_owner_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vorlagen_owner_access ON public.document_vorlagen USING (((owner_id = auth.uid()) OR (owner_id IN ( SELECT profiles.owner_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'employee'::text))))));


--
-- Name: warteliste; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warteliste ENABLE ROW LEVEL SECURITY;

--
-- Name: working_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: working_hours working_hours_owner_modify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY working_hours_owner_modify ON public.working_hours USING (((auth.uid() = user_id) OR (auth.uid() = owner_id))) WITH CHECK (((auth.uid() = user_id) OR (auth.uid() = owner_id)));


--
-- Name: working_hours working_hours_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY working_hours_owner_select ON public.working_hours FOR SELECT USING (((auth.uid() = user_id) OR (auth.uid() = owner_id)));


--
-- Name: zaa_fehler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zaa_fehler ENABLE ROW LEVEL SECURITY;

--
-- Name: zaa_fehler zaa_fehler_via_abrechnung; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zaa_fehler_via_abrechnung ON public.zaa_fehler USING ((abrechnung_id IN ( SELECT abrechnung.id
   FROM public.abrechnung
  WHERE ((abrechnung.owner_id = auth.uid()) OR (auth.uid() IN ( SELECT profiles.id
           FROM public.profiles
          WHERE (profiles.owner_id = abrechnung.owner_id)))))));


--
-- Name: terapeut_zertifikat zertifikat_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zertifikat_owner_all ON public.terapeut_zertifikat USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.owner_id = terapeut_zertifikat.owner_id)))));


--
-- Name: zuzahlung_befreiung; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zuzahlung_befreiung ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION add_credits(p_user_id uuid, p_credits integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_credits(p_user_id uuid, p_credits integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_credits(p_user_id uuid, p_credits integer) TO service_role;


--
-- Name: FUNCTION admin_db_size_breakdown(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_db_size_breakdown() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_db_size_breakdown() TO service_role;


--
-- Name: FUNCTION admin_db_total_size(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_db_total_size() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_db_total_size() TO service_role;


--
-- Name: FUNCTION admin_top_tenants_by_rows(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_top_tenants_by_rows() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_top_tenants_by_rows() TO service_role;


--
-- Name: FUNCTION auth_tenant_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.auth_tenant_id() TO authenticated;
GRANT ALL ON FUNCTION public.auth_tenant_id() TO service_role;


--
-- Name: FUNCTION business_get_secret(p_user_id uuid, p_secret_kind text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.business_get_secret(p_user_id uuid, p_secret_kind text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.business_get_secret(p_user_id uuid, p_secret_kind text) TO authenticated;
GRANT ALL ON FUNCTION public.business_get_secret(p_user_id uuid, p_secret_kind text) TO service_role;


--
-- Name: FUNCTION business_lookup_for_inbound(p_whatsapp_phone_number_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.business_lookup_for_inbound(p_whatsapp_phone_number_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.business_lookup_for_inbound(p_whatsapp_phone_number_id text) TO service_role;


--
-- Name: FUNCTION business_lookup_for_twilio(p_to_number text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.business_lookup_for_twilio(p_to_number text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.business_lookup_for_twilio(p_to_number text) TO service_role;


--
-- Name: FUNCTION business_save_secret(p_user_id uuid, p_secret_kind text, p_secret_value text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.business_save_secret(p_user_id uuid, p_secret_kind text, p_secret_value text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.business_save_secret(p_user_id uuid, p_secret_kind text, p_secret_value text) TO authenticated;
GRANT ALL ON FUNCTION public.business_save_secret(p_user_id uuid, p_secret_kind text, p_secret_value text) TO service_role;


--
-- Name: FUNCTION clear_gmail_token(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.clear_gmail_token(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION confirm_referral_and_create_series(p_draft_id uuid, p_lead_id uuid, p_confirmed_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_referral_and_create_series(p_draft_id uuid, p_lead_id uuid, p_confirmed_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_referral_and_create_series(p_draft_id uuid, p_lead_id uuid, p_confirmed_by uuid) TO service_role;


--
-- Name: FUNCTION delete_expired_accounts(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_expired_accounts() TO service_role;


--
-- Name: FUNCTION find_owner_id_by_code(p_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.find_owner_id_by_code(p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.find_owner_id_by_code(p_code text) TO authenticated;
GRANT ALL ON FUNCTION public.find_owner_id_by_code(p_code text) TO service_role;


--
-- Name: FUNCTION find_patient_by_name_and_birth(p_vorname text, p_nachname text, p_geburtsdatum date, p_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.find_patient_by_name_and_birth(p_vorname text, p_nachname text, p_geburtsdatum date, p_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.find_patient_by_name_and_birth(p_vorname text, p_nachname text, p_geburtsdatum date, p_owner_id uuid) TO service_role;


--
-- Name: FUNCTION fn_befreiung_backfill_prescriptions(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_befreiung_backfill_prescriptions() TO anon;
GRANT ALL ON FUNCTION public.fn_befreiung_backfill_prescriptions() TO authenticated;
GRANT ALL ON FUNCTION public.fn_befreiung_backfill_prescriptions() TO service_role;


--
-- Name: FUNCTION fn_check_booking_closed_day(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_check_booking_closed_day() TO anon;
GRANT ALL ON FUNCTION public.fn_check_booking_closed_day() TO authenticated;
GRANT ALL ON FUNCTION public.fn_check_booking_closed_day() TO service_role;


--
-- Name: FUNCTION fn_is_patient_befreit(p_patient_id uuid, p_datum date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_is_patient_befreit(p_patient_id uuid, p_datum date) TO anon;
GRANT ALL ON FUNCTION public.fn_is_patient_befreit(p_patient_id uuid, p_datum date) TO authenticated;
GRANT ALL ON FUNCTION public.fn_is_patient_befreit(p_patient_id uuid, p_datum date) TO service_role;


--
-- Name: FUNCTION fn_prescriptions_set_befreit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_prescriptions_set_befreit() TO anon;
GRANT ALL ON FUNCTION public.fn_prescriptions_set_befreit() TO authenticated;
GRANT ALL ON FUNCTION public.fn_prescriptions_set_befreit() TO service_role;


--
-- Name: FUNCTION get_default_business(p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_default_business(p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_default_business(p_user uuid) TO service_role;


--
-- Name: FUNCTION get_gmail_token(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_gmail_token(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_my_permissions(p_business_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_permissions(p_business_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_permissions(p_business_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION normalize_phone(p text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.normalize_phone(p text) TO anon;
GRANT ALL ON FUNCTION public.normalize_phone(p text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_phone(p text) TO service_role;


--
-- Name: FUNCTION notify_feedback_telegram(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_feedback_telegram() TO anon;
GRANT ALL ON FUNCTION public.notify_feedback_telegram() TO authenticated;
GRANT ALL ON FUNCTION public.notify_feedback_telegram() TO service_role;


--
-- Name: FUNCTION notify_new_referral_draft(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_new_referral_draft() TO anon;
GRANT ALL ON FUNCTION public.notify_new_referral_draft() TO authenticated;
GRANT ALL ON FUNCTION public.notify_new_referral_draft() TO service_role;


--
-- Name: FUNCTION pending_signup_consume(p_pending_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pending_signup_consume(p_pending_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pending_signup_consume(p_pending_id uuid) TO service_role;


--
-- Name: FUNCTION pending_signup_delete(p_pending_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pending_signup_delete(p_pending_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pending_signup_delete(p_pending_id uuid) TO service_role;


--
-- Name: FUNCTION pending_signup_store(p_email text, p_onboarding jsonb, p_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pending_signup_store(p_email text, p_onboarding jsonb, p_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pending_signup_store(p_email text, p_onboarding jsonb, p_password text) TO service_role;


--
-- Name: FUNCTION prevent_belegliste_mod(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_belegliste_mod() TO anon;
GRANT ALL ON FUNCTION public.prevent_belegliste_mod() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_belegliste_mod() TO service_role;


--
-- Name: FUNCTION seed_default_groups_for_business(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.seed_default_groups_for_business() TO anon;
GRANT ALL ON FUNCTION public.seed_default_groups_for_business() TO authenticated;
GRANT ALL ON FUNCTION public.seed_default_groups_for_business() TO service_role;


--
-- Name: FUNCTION set_bookings_business_id_default(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_bookings_business_id_default() TO anon;
GRANT ALL ON FUNCTION public.set_bookings_business_id_default() TO authenticated;
GRANT ALL ON FUNCTION public.set_bookings_business_id_default() TO service_role;


--
-- Name: FUNCTION set_business_id_default(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_business_id_default() TO anon;
GRANT ALL ON FUNCTION public.set_business_id_default() TO authenticated;
GRANT ALL ON FUNCTION public.set_business_id_default() TO service_role;


--
-- Name: FUNCTION set_gmail_token(p_user_id uuid, p_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_gmail_token(p_user_id uuid, p_token text) TO service_role;


--
-- Name: FUNCTION set_next_beleg_nr(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_next_beleg_nr() TO anon;
GRANT ALL ON FUNCTION public.set_next_beleg_nr() TO authenticated;
GRANT ALL ON FUNCTION public.set_next_beleg_nr() TO service_role;


--
-- Name: FUNCTION set_next_mahnung_nr(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_next_mahnung_nr() TO anon;
GRANT ALL ON FUNCTION public.set_next_mahnung_nr() TO authenticated;
GRANT ALL ON FUNCTION public.set_next_mahnung_nr() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION set_updated_at_now(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at_now() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at_now() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at_now() TO service_role;


--
-- Name: FUNCTION set_warteliste_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_warteliste_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_warteliste_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_warteliste_updated_at() TO service_role;


--
-- Name: FUNCTION sync_leads_location(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_leads_location() TO anon;
GRANT ALL ON FUNCTION public.sync_leads_location() TO authenticated;
GRANT ALL ON FUNCTION public.sync_leads_location() TO service_role;


--
-- Name: FUNCTION sync_profiles_clinic_location(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_profiles_clinic_location() TO anon;
GRANT ALL ON FUNCTION public.sync_profiles_clinic_location() TO authenticated;
GRANT ALL ON FUNCTION public.sync_profiles_clinic_location() TO service_role;


--
-- Name: FUNCTION touch_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.touch_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_updated_at() TO service_role;


--
-- Name: FUNCTION trg_billing_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_billing_updated_at() TO anon;
GRANT ALL ON FUNCTION public.trg_billing_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.trg_billing_updated_at() TO service_role;


--
-- Name: FUNCTION trg_normalize_booking_phone_fn(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_normalize_booking_phone_fn() TO anon;
GRANT ALL ON FUNCTION public.trg_normalize_booking_phone_fn() TO authenticated;
GRANT ALL ON FUNCTION public.trg_normalize_booking_phone_fn() TO service_role;


--
-- Name: FUNCTION trg_normalize_lead_phone_fn(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_normalize_lead_phone_fn() TO anon;
GRANT ALL ON FUNCTION public.trg_normalize_lead_phone_fn() TO authenticated;
GRANT ALL ON FUNCTION public.trg_normalize_lead_phone_fn() TO service_role;


--
-- Name: FUNCTION trg_prescriptions_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_prescriptions_updated_at() TO anon;
GRANT ALL ON FUNCTION public.trg_prescriptions_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.trg_prescriptions_updated_at() TO service_role;


--
-- Name: FUNCTION update_attendance_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_attendance_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_attendance_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_attendance_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION whoami(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.whoami() TO anon;
GRANT ALL ON FUNCTION public.whoami() TO authenticated;
GRANT ALL ON FUNCTION public.whoami() TO service_role;


--
-- Name: TABLE abrechnung; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.abrechnung TO anon;
GRANT ALL ON TABLE public.abrechnung TO authenticated;
GRANT ALL ON TABLE public.abrechnung TO service_role;


--
-- Name: TABLE accommodations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accommodations TO anon;
GRANT ALL ON TABLE public.accommodations TO authenticated;
GRANT ALL ON TABLE public.accommodations TO service_role;


--
-- Name: TABLE admin_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_users TO anon;
GRANT ALL ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;


--
-- Name: TABLE aerzte; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.aerzte TO anon;
GRANT ALL ON TABLE public.aerzte TO authenticated;
GRANT ALL ON TABLE public.aerzte TO service_role;


--
-- Name: TABLE ai_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_audit_log TO anon;
GRANT ALL ON TABLE public.ai_audit_log TO authenticated;
GRANT ALL ON TABLE public.ai_audit_log TO service_role;


--
-- Name: TABLE anamnese; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.anamnese TO anon;
GRANT ALL ON TABLE public.anamnese TO authenticated;
GRANT ALL ON TABLE public.anamnese TO service_role;


--
-- Name: TABLE applications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.applications TO anon;
GRANT ALL ON TABLE public.applications TO authenticated;
GRANT ALL ON TABLE public.applications TO service_role;


--
-- Name: TABLE attendance; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.attendance TO anon;
GRANT ALL ON TABLE public.attendance TO authenticated;
GRANT ALL ON TABLE public.attendance TO service_role;


--
-- Name: TABLE b2b_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.b2b_contacts TO anon;
GRANT ALL ON TABLE public.b2b_contacts TO authenticated;
GRANT ALL ON TABLE public.b2b_contacts TO service_role;


--
-- Name: TABLE belegliste; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.belegliste TO anon;
GRANT ALL ON TABLE public.belegliste TO authenticated;
GRANT ALL ON TABLE public.belegliste TO service_role;


--
-- Name: TABLE booking_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_requests TO anon;
GRANT ALL ON TABLE public.booking_requests TO authenticated;
GRANT ALL ON TABLE public.booking_requests TO service_role;


--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bookings TO anon;
GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;


--
-- Name: TABLE breaks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.breaks TO anon;
GRANT ALL ON TABLE public.breaks TO authenticated;
GRANT ALL ON TABLE public.breaks TO service_role;


--
-- Name: TABLE business_services; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.business_services TO anon;
GRANT ALL ON TABLE public.business_services TO authenticated;
GRANT ALL ON TABLE public.business_services TO service_role;


--
-- Name: TABLE businesses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.businesses TO anon;
GRANT ALL ON TABLE public.businesses TO authenticated;
GRANT ALL ON TABLE public.businesses TO service_role;


--
-- Name: TABLE calendar_integrations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.calendar_integrations TO anon;
GRANT ALL ON TABLE public.calendar_integrations TO authenticated;
GRANT ALL ON TABLE public.calendar_integrations TO service_role;


--
-- Name: TABLE chatbot_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chatbot_usage TO anon;
GRANT ALL ON TABLE public.chatbot_usage TO authenticated;
GRANT ALL ON TABLE public.chatbot_usage TO service_role;


--
-- Name: SEQUENCE chatbot_usage_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.chatbot_usage_id_seq TO anon;
GRANT ALL ON SEQUENCE public.chatbot_usage_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chatbot_usage_id_seq TO service_role;


--
-- Name: TABLE consent_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.consent_log TO anon;
GRANT ALL ON TABLE public.consent_log TO authenticated;
GRANT ALL ON TABLE public.consent_log TO service_role;


--
-- Name: TABLE custom_days; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.custom_days TO anon;
GRANT ALL ON TABLE public.custom_days TO authenticated;
GRANT ALL ON TABLE public.custom_days TO service_role;


--
-- Name: TABLE data_access_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_access_log TO anon;
GRANT ALL ON TABLE public.data_access_log TO authenticated;
GRANT ALL ON TABLE public.data_access_log TO service_role;


--
-- Name: SEQUENCE data_access_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.data_access_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.data_access_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.data_access_log_id_seq TO service_role;


--
-- Name: TABLE data_sharing_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_sharing_settings TO anon;
GRANT ALL ON TABLE public.data_sharing_settings TO authenticated;
GRANT ALL ON TABLE public.data_sharing_settings TO service_role;


--
-- Name: TABLE demo_bookings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.demo_bookings TO anon;
GRANT ALL ON TABLE public.demo_bookings TO authenticated;
GRANT ALL ON TABLE public.demo_bookings TO service_role;


--
-- Name: TABLE diagnosegruppen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.diagnosegruppen TO anon;
GRANT ALL ON TABLE public.diagnosegruppen TO authenticated;
GRANT ALL ON TABLE public.diagnosegruppen TO service_role;


--
-- Name: TABLE document_vorlagen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_vorlagen TO anon;
GRANT ALL ON TABLE public.document_vorlagen TO authenticated;
GRANT ALL ON TABLE public.document_vorlagen TO service_role;


--
-- Name: TABLE dta_schluessel; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dta_schluessel TO anon;
GRANT ALL ON TABLE public.dta_schluessel TO authenticated;
GRANT ALL ON TABLE public.dta_schluessel TO service_role;


--
-- Name: SEQUENCE dta_schluessel_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.dta_schluessel_id_seq TO anon;
GRANT ALL ON SEQUENCE public.dta_schluessel_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.dta_schluessel_id_seq TO service_role;


--
-- Name: TABLE email_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_logs TO anon;
GRANT ALL ON TABLE public.email_logs TO authenticated;
GRANT ALL ON TABLE public.email_logs TO service_role;


--
-- Name: TABLE employee_business_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_business_assignments TO anon;
GRANT ALL ON TABLE public.employee_business_assignments TO authenticated;
GRANT ALL ON TABLE public.employee_business_assignments TO service_role;


--
-- Name: TABLE employee_groups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_groups TO anon;
GRANT ALL ON TABLE public.employee_groups TO authenticated;
GRANT ALL ON TABLE public.employee_groups TO service_role;


--
-- Name: TABLE employee_scope_overrides; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_scope_overrides TO anon;
GRANT ALL ON TABLE public.employee_scope_overrides TO authenticated;
GRANT ALL ON TABLE public.employee_scope_overrides TO service_role;


--
-- Name: TABLE employee_services; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_services TO anon;
GRANT ALL ON TABLE public.employee_services TO authenticated;
GRANT ALL ON TABLE public.employee_services TO service_role;


--
-- Name: TABLE fahrten; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fahrten TO anon;
GRANT ALL ON TABLE public.fahrten TO authenticated;
GRANT ALL ON TABLE public.fahrten TO service_role;


--
-- Name: TABLE fahrten_monthly_summary; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.fahrten_monthly_summary TO anon;
GRANT ALL ON TABLE public.fahrten_monthly_summary TO authenticated;
GRANT ALL ON TABLE public.fahrten_monthly_summary TO service_role;


--
-- Name: TABLE feedbacks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.feedbacks TO anon;
GRANT ALL ON TABLE public.feedbacks TO authenticated;
GRANT ALL ON TABLE public.feedbacks TO service_role;


--
-- Name: TABLE "fußstatus"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public."fußstatus" TO anon;
GRANT ALL ON TABLE public."fußstatus" TO authenticated;
GRANT ALL ON TABLE public."fußstatus" TO service_role;


--
-- Name: TABLE group_scopes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.group_scopes TO anon;
GRANT ALL ON TABLE public.group_scopes TO authenticated;
GRANT ALL ON TABLE public.group_scopes TO service_role;


--
-- Name: TABLE heilmittel_catalog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.heilmittel_catalog TO anon;
GRANT ALL ON TABLE public.heilmittel_catalog TO authenticated;
GRANT ALL ON TABLE public.heilmittel_catalog TO service_role;


--
-- Name: TABLE heilmittel_position; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.heilmittel_position TO anon;
GRANT ALL ON TABLE public.heilmittel_position TO authenticated;
GRANT ALL ON TABLE public.heilmittel_position TO service_role;


--
-- Name: TABLE heilmittel_tarif; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.heilmittel_tarif TO anon;
GRANT ALL ON TABLE public.heilmittel_tarif TO authenticated;
GRANT ALL ON TABLE public.heilmittel_tarif TO service_role;


--
-- Name: SEQUENCE heilmittel_tarif_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.heilmittel_tarif_id_seq TO anon;
GRANT ALL ON SEQUENCE public.heilmittel_tarif_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.heilmittel_tarif_id_seq TO service_role;


--
-- Name: TABLE icd10_titles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.icd10_titles TO anon;
GRANT ALL ON TABLE public.icd10_titles TO authenticated;
GRANT ALL ON TABLE public.icd10_titles TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoices TO anon;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


--
-- Name: TABLE kostentraeger; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.kostentraeger TO anon;
GRANT ALL ON TABLE public.kostentraeger TO authenticated;
GRANT ALL ON TABLE public.kostentraeger TO service_role;


--
-- Name: TABLE krankenkassen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.krankenkassen TO anon;
GRANT ALL ON TABLE public.krankenkassen TO authenticated;
GRANT ALL ON TABLE public.krankenkassen TO service_role;


--
-- Name: TABLE leads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leads TO anon;
GRANT ALL ON TABLE public.leads TO authenticated;
GRANT ALL ON TABLE public.leads TO service_role;


--
-- Name: TABLE mahnungen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mahnungen TO anon;
GRANT ALL ON TABLE public.mahnungen TO authenticated;
GRANT ALL ON TABLE public.mahnungen TO service_role;


--
-- Name: TABLE messreihen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messreihen TO anon;
GRANT ALL ON TABLE public.messreihen TO authenticated;
GRANT ALL ON TABLE public.messreihen TO service_role;


--
-- Name: TABLE patient_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.patient_notes TO anon;
GRANT ALL ON TABLE public.patient_notes TO authenticated;
GRANT ALL ON TABLE public.patient_notes TO service_role;


--
-- Name: TABLE patients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.patients TO anon;
GRANT ALL ON TABLE public.patients TO authenticated;
GRANT ALL ON TABLE public.patients TO service_role;


--
-- Name: TABLE pending_employee_registrations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pending_employee_registrations TO anon;
GRANT ALL ON TABLE public.pending_employee_registrations TO authenticated;
GRANT ALL ON TABLE public.pending_employee_registrations TO service_role;


--
-- Name: TABLE pending_signups; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.pending_signups TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.pending_signups TO authenticated;
GRANT ALL ON TABLE public.pending_signups TO service_role;


--
-- Name: TABLE podologie_behandlungen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.podologie_behandlungen TO anon;
GRANT ALL ON TABLE public.podologie_behandlungen TO authenticated;
GRANT ALL ON TABLE public.podologie_behandlungen TO service_role;


--
-- Name: TABLE prescription_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.prescription_sessions TO anon;
GRANT ALL ON TABLE public.prescription_sessions TO authenticated;
GRANT ALL ON TABLE public.prescription_sessions TO service_role;


--
-- Name: TABLE prescription_validations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.prescription_validations TO anon;
GRANT ALL ON TABLE public.prescription_validations TO authenticated;
GRANT ALL ON TABLE public.prescription_validations TO service_role;


--
-- Name: TABLE prescriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.prescriptions TO anon;
GRANT ALL ON TABLE public.prescriptions TO authenticated;
GRANT ALL ON TABLE public.prescriptions TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE profiles_public; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.profiles_public TO anon;
GRANT SELECT,MAINTAIN ON TABLE public.profiles_public TO authenticated;
GRANT ALL ON TABLE public.profiles_public TO service_role;


--
-- Name: TABLE referral_drafts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.referral_drafts TO anon;
GRANT ALL ON TABLE public.referral_drafts TO authenticated;
GRANT ALL ON TABLE public.referral_drafts TO service_role;


--
-- Name: TABLE scraper_data; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.scraper_data TO anon;
GRANT ALL ON TABLE public.scraper_data TO authenticated;
GRANT ALL ON TABLE public.scraper_data TO service_role;


--
-- Name: TABLE services; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;


--
-- Name: TABLE terapeut_zertifikat; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.terapeut_zertifikat TO anon;
GRANT ALL ON TABLE public.terapeut_zertifikat TO authenticated;
GRANT ALL ON TABLE public.terapeut_zertifikat TO service_role;


--
-- Name: TABLE therapist_certificates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.therapist_certificates TO anon;
GRANT ALL ON TABLE public.therapist_certificates TO authenticated;
GRANT ALL ON TABLE public.therapist_certificates TO service_role;


--
-- Name: TABLE time_offs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.time_offs TO anon;
GRANT ALL ON TABLE public.time_offs TO authenticated;
GRANT ALL ON TABLE public.time_offs TO service_role;


--
-- Name: TABLE trip_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_history TO anon;
GRANT ALL ON TABLE public.trip_history TO authenticated;
GRANT ALL ON TABLE public.trip_history TO service_role;


--
-- Name: TABLE trip_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_plans TO anon;
GRANT ALL ON TABLE public.trip_plans TO authenticated;
GRANT ALL ON TABLE public.trip_plans TO service_role;


--
-- Name: TABLE ueberweisungen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ueberweisungen TO anon;
GRANT ALL ON TABLE public.ueberweisungen TO authenticated;
GRANT ALL ON TABLE public.ueberweisungen TO service_role;


--
-- Name: TABLE user_credits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_credits TO anon;
GRANT ALL ON TABLE public.user_credits TO authenticated;
GRANT ALL ON TABLE public.user_credits TO service_role;


--
-- Name: TABLE user_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_preferences TO anon;
GRANT ALL ON TABLE public.user_preferences TO authenticated;
GRANT ALL ON TABLE public.user_preferences TO service_role;


--
-- Name: TABLE vehicles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicles TO anon;
GRANT ALL ON TABLE public.vehicles TO authenticated;
GRANT ALL ON TABLE public.vehicles TO service_role;


--
-- Name: TABLE verordnungen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.verordnungen TO anon;
GRANT ALL ON TABLE public.verordnungen TO authenticated;
GRANT ALL ON TABLE public.verordnungen TO service_role;


--
-- Name: TABLE warteliste; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warteliste TO anon;
GRANT ALL ON TABLE public.warteliste TO authenticated;
GRANT ALL ON TABLE public.warteliste TO service_role;


--
-- Name: TABLE working_hours; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.working_hours TO anon;
GRANT ALL ON TABLE public.working_hours TO authenticated;
GRANT ALL ON TABLE public.working_hours TO service_role;


--
-- Name: TABLE zaa_fehler; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.zaa_fehler TO anon;
GRANT ALL ON TABLE public.zaa_fehler TO authenticated;
GRANT ALL ON TABLE public.zaa_fehler TO service_role;


--
-- Name: SEQUENCE zaa_fehler_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.zaa_fehler_id_seq TO anon;
GRANT ALL ON SEQUENCE public.zaa_fehler_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.zaa_fehler_id_seq TO service_role;


--
-- Name: TABLE zuzahlung_befreiung; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.zuzahlung_befreiung TO anon;
GRANT ALL ON TABLE public.zuzahlung_befreiung TO authenticated;
GRANT ALL ON TABLE public.zuzahlung_befreiung TO service_role;


--
-- Name: SEQUENCE zuzahlung_befreiung_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.zuzahlung_befreiung_id_seq TO anon;
GRANT ALL ON SEQUENCE public.zuzahlung_befreiung_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.zuzahlung_befreiung_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict rtGHPDvRqFGzlhbzAKxMw1lutm99F9jPGPUHxk1oA83k985Xnd7deAiSKJfbeUy

