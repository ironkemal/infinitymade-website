-- Test zu 0121_rechnungen_modulrecht.sql: Altbestand-Freigabe (Option A) + Wirkung auf Rechnungen. Nur Wegwerf-PostgreSQL, synthetisch, ROLLBACK.
-- Die beiden INSERT-Statements in Abschnitt 1 sind wörtlich dieselben wie in 0121 (1); die Migration lief in der Kette schon auf leeren Tabellen.
BEGIN;
CREATE FUNCTION pg_temp.id(text) RETURNS uuid LANGUAGE sql IMMUTABLE AS 'SELECT md5($1)::uuid';
CREATE FUNCTION pg_temp.ok(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END $$;
CREATE FUNCTION pg_temp.als(who text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(who)::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(who), 'role', 'authenticated')::text, true);
END $$;

INSERT INTO auth.users(id) SELECT pg_temp.id(x) FROM unnest(ARRAY['owner','e-gruppe','e-verweigert','e-ohnegruppe','e-override-nein','e-fremd']) x;
INSERT INTO public.profiles(id, role, owner_id, is_active)
SELECT pg_temp.id(x), CASE WHEN x = 'owner' THEN 'owner' ELSE 'employee' END, CASE WHEN x = 'owner' THEN NULL ELSE pg_temp.id('owner') END, true
FROM unnest(ARRAY['owner','e-gruppe','e-verweigert','e-ohnegruppe','e-override-nein','e-fremd']) x
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, owner_id = EXCLUDED.owner_id, is_active = EXCLUDED.is_active;
INSERT INTO public.businesses(id, owner_id, business_name) VALUES (pg_temp.id('biz'), pg_temp.id('owner'), 'Synthetic practice');
INSERT INTO public.employee_groups(id, business_id, name) VALUES
  (pg_temp.id('g-offen'), pg_temp.id('biz'), 'Synthetic ohne Zeile'),
  (pg_temp.id('g-nein'),  pg_temp.id('biz'), 'Synthetic verweigert'),
  (pg_temp.id('g-os'),    pg_temp.id('biz'), 'Synthetic override nein');
INSERT INTO public.group_scopes(group_id, module, has_access) VALUES (pg_temp.id('g-nein'), 'abrechnung', false), (pg_temp.id('g-offen'), 'calendar', true);
INSERT INTO public.employee_business_assignments(employee_id, business_id, group_id) VALUES
  (pg_temp.id('e-gruppe'),       pg_temp.id('biz'), pg_temp.id('g-offen')),
  (pg_temp.id('e-verweigert'),   pg_temp.id('biz'), pg_temp.id('g-nein')),
  (pg_temp.id('e-ohnegruppe'),   pg_temp.id('biz'), NULL),
  (pg_temp.id('e-override-nein'), pg_temp.id('biz'), pg_temp.id('g-os'));
INSERT INTO public.employee_scope_overrides(employee_id, business_id, module, has_access) VALUES (pg_temp.id('e-override-nein'), pg_temp.id('biz'), 'abrechnung', false);
INSERT INTO public.invoices(id, owner_id, business_id, patient_name, total_patient, status) VALUES (pg_temp.id('inv'), pg_temp.id('owner'), pg_temp.id('biz'), 'Synthetic invoice', 100, 'draft');

-- ── 1. Altbestand-Freigabe (wörtlich aus 0121 (1)) ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.group_scopes (group_id, module, has_access)
SELECT g.id, 'abrechnung', true
  FROM public.employee_groups g
 WHERE NOT EXISTS (SELECT 1 FROM public.group_scopes s WHERE s.group_id = g.id AND s.module = 'abrechnung');

INSERT INTO public.employee_scope_overrides (employee_id, business_id, module, has_access)
SELECT eba.employee_id, eba.business_id, 'abrechnung', true
  FROM public.employee_business_assignments eba
 WHERE eba.group_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.employee_scope_overrides o
                    WHERE o.employee_id = eba.employee_id AND o.business_id = eba.business_id AND o.module = 'abrechnung');

SELECT pg_temp.ok((SELECT has_access FROM public.group_scopes WHERE group_id = pg_temp.id('g-offen') AND module = 'abrechnung'), 'Gruppe ohne Zeile bekommt das Recht');
SELECT pg_temp.ok((SELECT NOT has_access FROM public.group_scopes WHERE group_id = pg_temp.id('g-nein') AND module = 'abrechnung'), 'ausdrückliche Verweigerung der Gruppe bleibt');
SELECT pg_temp.ok((SELECT has_access FROM public.employee_scope_overrides WHERE employee_id = pg_temp.id('e-ohnegruppe') AND module = 'abrechnung'), 'Zuordnung ohne Gruppe bekommt Einzelfreigabe');
SELECT pg_temp.ok((SELECT NOT has_access FROM public.employee_scope_overrides WHERE employee_id = pg_temp.id('e-override-nein') AND module = 'abrechnung'), 'bestehende Einzel-Verweigerung bleibt');
SELECT pg_temp.ok((SELECT count(*) FROM public.employee_scope_overrides WHERE employee_id = pg_temp.id('e-override-nein') AND module = 'abrechnung') = 1, 'keine doppelte Einzelzeile');

-- zweiter Lauf ändert nichts (idempotent)
DO $$ DECLARE a int; b int; BEGIN
  SELECT count(*) INTO a FROM public.group_scopes WHERE module = 'abrechnung';
  SELECT count(*) INTO b FROM public.employee_scope_overrides WHERE module = 'abrechnung';
  INSERT INTO public.group_scopes (group_id, module, has_access)
    SELECT g.id, 'abrechnung', true FROM public.employee_groups g
     WHERE NOT EXISTS (SELECT 1 FROM public.group_scopes s WHERE s.group_id = g.id AND s.module = 'abrechnung');
  INSERT INTO public.employee_scope_overrides (employee_id, business_id, module, has_access)
    SELECT eba.employee_id, eba.business_id, 'abrechnung', true FROM public.employee_business_assignments eba
     WHERE eba.group_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.employee_scope_overrides o WHERE o.employee_id = eba.employee_id AND o.business_id = eba.business_id AND o.module = 'abrechnung');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.group_scopes WHERE module = 'abrechnung') = a AND (SELECT count(*) FROM public.employee_scope_overrides WHERE module = 'abrechnung') = b, 'zweiter Lauf ist ein No-op');
END $$;

-- ── 2. Wirkung auf Rechnungen (echte Rolle authenticated) ─────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
DO $$ DECLARE w text; erwartet boolean; n int; BEGIN
  FOREACH w IN ARRAY ARRAY['owner','e-gruppe','e-verweigert','e-ohnegruppe','e-override-nein','e-fremd'] LOOP
    PERFORM pg_temp.als(w);
    erwartet := w IN ('owner','e-gruppe','e-ohnegruppe');
    SELECT count(*) INTO n FROM public.invoices WHERE id = pg_temp.id('inv');
    PERFORM pg_temp.ok((n = 1) = erwartet, w || ': Rechnung sichtbar = ' || erwartet);
    UPDATE public.invoices SET notes = 'x' WHERE id = pg_temp.id('inv'); GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM pg_temp.ok((n = 1) = erwartet, w || ': Rechnung änderbar = ' || erwartet);
  END LOOP;
END $$;
-- Hilfsfunktion nur für den Aufrufer selbst
SELECT pg_temp.als('e-gruppe');
SELECT pg_temp.ok(public.abrechnungszugriff_erlaubt(pg_temp.id('e-gruppe'), pg_temp.id('biz')), 'Helfer: Aufrufer mit Recht → true');
SELECT pg_temp.ok(NOT public.abrechnungszugriff_erlaubt(pg_temp.id('e-ohnegruppe'), pg_temp.id('biz')), 'Helfer: fremdes p_user → immer false (auch wenn dieses Profil Recht hätte)');
RESET ROLE;
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.abrechnungszugriff_erlaubt(uuid,uuid)', 'EXECUTE'), 'Helfer: kein EXECUTE für anon');
SELECT pg_temp.ok(has_function_privilege('authenticated', 'public.abrechnungszugriff_erlaubt(uuid,uuid)', 'EXECUTE'), 'Helfer: EXECUTE für authenticated (Policy braucht ihn)');
ROLLBACK;
