-- Test zu 0120_rechnungsrechte_teil1.sql. Nur Wegwerf-PostgreSQL, alles synthetisch, am Ende ROLLBACK.
-- Gilt für den Stand nach 0120 UND nach 0121 (Modulrecht): beide Mitarbeiter hängen an einer Praxis mit Gruppe, die 'abrechnung' erlaubt,
-- die Rechnungen tragen business_id — so entscheidet allein is_active über den Unterschied.
-- Aufruf in der Vollkette: psql -v ON_ERROR_STOP=1 -f rechnungsrechte-teil1.test.sql
BEGIN;
CREATE FUNCTION pg_temp.id(text) RETURNS uuid LANGUAGE sql IMMUTABLE AS 'SELECT md5($1)::uuid';
CREATE FUNCTION pg_temp.ok(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END $$;
CREATE FUNCTION pg_temp.err(stmt text, code text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code THEN RAISE NOTICE 'PASS: %', label; RETURN; END IF;
    RAISE EXCEPTION 'FAIL: % (erwartet %, bekommen % %)', label, code, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL: % (wurde angenommen)', label;
END $$;
CREATE FUNCTION pg_temp.als(who text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(who)::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(who), 'role', 'authenticated')::text, true);
END $$;

INSERT INTO auth.users(id) SELECT pg_temp.id(x) FROM unnest(ARRAY['owner','foreign','aktiv','inaktiv']) x;
INSERT INTO public.profiles(id, role, owner_id, is_active)
SELECT pg_temp.id(x), CASE WHEN x IN ('owner','foreign') THEN 'owner' ELSE 'employee' END,
       CASE WHEN x IN ('owner','foreign') THEN NULL ELSE pg_temp.id('owner') END, x <> 'inaktiv'
FROM unnest(ARRAY['owner','foreign','aktiv','inaktiv']) x
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, owner_id = EXCLUDED.owner_id, is_active = EXCLUDED.is_active;
INSERT INTO public.businesses(id, owner_id, business_name) VALUES (pg_temp.id('biz'), pg_temp.id('owner'), 'Synthetic practice');
INSERT INTO public.employee_groups(id, business_id, name) VALUES (pg_temp.id('grp'), pg_temp.id('biz'), 'Synthetic billing');
INSERT INTO public.group_scopes(group_id, module, has_access) VALUES (pg_temp.id('grp'), 'abrechnung', true);
INSERT INTO public.employee_business_assignments(employee_id, business_id, group_id) SELECT pg_temp.id(x), pg_temp.id('biz'), pg_temp.id('grp') FROM unnest(ARRAY['aktiv','inaktiv']) x;
INSERT INTO public.leads(id, owner_id, title) VALUES (pg_temp.id('lead'), pg_temp.id('owner'), 'Synthetic'), (pg_temp.id('f-lead'), pg_temp.id('foreign'), 'Synthetic foreign');
INSERT INTO public.services(id, owner_id, user_id, title, is_internal) VALUES
  (pg_temp.id('svc'), pg_temp.id('owner'), pg_temp.id('aktiv'), 'Synthetic', true),
  (pg_temp.id('svc-legacy'), NULL, pg_temp.id('owner'), 'Synthetic legacy', false),
  (pg_temp.id('f-svc'), pg_temp.id('foreign'), pg_temp.id('owner'), 'Synthetic foreign', false);
INSERT INTO public.bookings(id, owner_id, user_id, customer_name, start_time, end_time) VALUES
  (pg_temp.id('bk'), pg_temp.id('owner'), pg_temp.id('aktiv'), 'Synthetic', '2026-12-01 10:00Z', '2026-12-01 10:30Z'),
  (pg_temp.id('bk-legacy'), NULL, pg_temp.id('owner'), 'Synthetic legacy', '2026-12-02 10:00Z', '2026-12-02 10:30Z'),
  (pg_temp.id('f-bk'), pg_temp.id('foreign'), pg_temp.id('owner'), 'Synthetic foreign', '2026-12-03 10:00Z', '2026-12-03 10:30Z');
INSERT INTO public.invoices(id, owner_id, business_id, patient_name, total_patient, status) VALUES
  (pg_temp.id('inv'), pg_temp.id('owner'), pg_temp.id('biz'), 'Synthetic invoice', 100, 'draft'),
  (pg_temp.id('inv2'), pg_temp.id('owner'), pg_temp.id('biz'), 'Synthetic invoice 2', 100, 'draft'),
  (pg_temp.id('f-inv'), pg_temp.id('foreign'), NULL, 'Synthetic foreign invoice', 100, 'draft');
INSERT INTO public.rechnung_zahlungen(id, owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label) VALUES
  (pg_temp.id('z1'), pg_temp.id('owner'), pg_temp.id('inv'), 'zahlung', 10, 'bank', 'Synthetic'),
  (pg_temp.id('z2'), pg_temp.id('owner'), pg_temp.id('inv2'), 'zahlung', 5, 'bank', 'Synthetic'),
  (pg_temp.id('fz'), pg_temp.id('foreign'), pg_temp.id('f-inv'), 'zahlung', 7, 'bank', 'Synthetic');

-- ── Inaktive Mitarbeiter ──────────────────────────────────────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.als('aktiv');
DO $$ DECLARE n int; BEGIN
  UPDATE public.invoices SET notes = 'x' WHERE owner_id = pg_temp.id('owner'); GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.ok(n = 2, 'aktiver Mitarbeiter ändert die Rechnungen seiner Praxis (2)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.rechnung_zahlungen WHERE owner_id = pg_temp.id('owner')) = 2, 'aktiver Mitarbeiter liest das Journal seiner Praxis');
END $$;
SELECT pg_temp.als('inaktiv');
DO $$ DECLARE n int; BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices WHERE owner_id = pg_temp.id('owner')) = 0, 'inaktiver Mitarbeiter sieht keine Rechnung');
  UPDATE public.invoices SET notes = 'y' WHERE owner_id = pg_temp.id('owner'); GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.ok(n = 0, 'inaktiver Mitarbeiter ändert keine Rechnung (0 Zeilen)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.rechnung_zahlungen WHERE owner_id = pg_temp.id('owner')) = 0, 'inaktiver Mitarbeiter sieht das Journal nicht');
END $$;
SELECT pg_temp.err(format('INSERT INTO public.invoices(owner_id, business_id, patient_name) VALUES (%L, %L, %L)', pg_temp.id('owner'), pg_temp.id('biz'), 'Synthetic denied'), '42501', 'inaktiver Mitarbeiter legt keine Rechnung an');
SELECT pg_temp.err(format('INSERT INTO public.rechnung_zahlungen(owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label) VALUES (%L, %L, ''zahlung'', 1, ''bank'', ''x'')', pg_temp.id('owner'), pg_temp.id('inv')), '42501', 'inaktiver Mitarbeiter bucht keine Zahlung');
SELECT pg_temp.als('owner');
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices WHERE owner_id = pg_temp.id('owner')) = 2, 'Inhaber sieht seine Rechnungen unverändert');
END $$;
RESET ROLE;

-- ── Storno-Referenz (als aktiver Mitarbeiter UND als service_role) ─────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.als('aktiv');
SELECT pg_temp.err(format('INSERT INTO public.rechnung_zahlungen(owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label, storniert_zeile_id) VALUES (%L, %L, ''storno'', -5, ''bank'', ''x'', %L)', pg_temp.id('owner'), pg_temp.id('inv'), pg_temp.id('z2')), '23514', 'Storno einer Zahlung einer ANDEREN Rechnung wird abgelehnt');
SELECT pg_temp.err(format('INSERT INTO public.rechnung_zahlungen(owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label, storniert_zeile_id) VALUES (%L, %L, ''storno'', -7, ''bank'', ''x'', %L)', pg_temp.id('owner'), pg_temp.id('inv'), pg_temp.id('fz')), '23514', 'Storno einer fremden Zahlung wird abgelehnt');
SELECT pg_temp.err(format('INSERT INTO public.rechnung_zahlungen(owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label, storniert_zeile_id) VALUES (%L, %L, ''storno'', -1, ''bank'', ''x'', %L)', pg_temp.id('owner'), pg_temp.id('inv'), pg_temp.id('z1')), '23514', 'Storno mit falschem Betrag wird abgelehnt');
SELECT pg_temp.err(format('INSERT INTO public.rechnung_zahlungen(owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label, storniert_zeile_id) VALUES (%L, %L, ''storno'', -10, ''bank'', ''x'', %L)', pg_temp.id('owner'), pg_temp.id('inv'), gen_random_uuid()), '23514', 'Storno mit unbekannter Zeile wird abgelehnt (vor dem Fremdschlüssel)');
INSERT INTO public.rechnung_zahlungen(id, owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label, storniert_zeile_id)
  VALUES (pg_temp.id('s1'), pg_temp.id('owner'), pg_temp.id('inv'), 'storno', -10, 'bank', 'Synthetic', pg_temp.id('z1'));
SELECT pg_temp.ok((SELECT betrag_eur FROM public.rechnung_zahlungen WHERE id = pg_temp.id('s1')) = -10, 'korrekter Storno (gleiche Rechnung, voller Betrag) wird angenommen');
SELECT pg_temp.err(format('INSERT INTO public.rechnung_zahlungen(owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label, storniert_zeile_id) VALUES (%L, %L, ''storno'', -10, ''bank'', ''x'', %L)', pg_temp.id('owner'), pg_temp.id('inv'), pg_temp.id('z1')), '23505', 'doppeltes Storno bleibt 23505 (eindeutiger Index, nicht der Trigger)');
SELECT pg_temp.err(format('INSERT INTO public.rechnung_zahlungen(owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label, storniert_zeile_id) VALUES (%L, %L, ''storno'', 10, ''bank'', ''x'', %L)', pg_temp.id('owner'), pg_temp.id('inv'), pg_temp.id('s1')), '23514', 'Storno eines Storno wird abgelehnt');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.err(format('INSERT INTO public.rechnung_zahlungen(owner_id, invoice_id, art, betrag_eur, gegenkonto_code, gegenkonto_label, storniert_zeile_id) VALUES (%L, %L, ''storno'', -7, ''bank'', ''x'', %L)', pg_temp.id('owner'), pg_temp.id('inv2'), pg_temp.id('fz')), '23514', 'auch service_role kann keine fremde Zahlung stornieren');
RESET ROLE;

-- ── Warteliste-Referenzen (Mitarbeiter und service_role) ───────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.als('aktiv');
INSERT INTO public.warteliste(id, owner_id, lead_id, service_id, matched_booking_id) VALUES
  (pg_temp.id('w1'), pg_temp.id('owner'), pg_temp.id('lead'), pg_temp.id('svc'), pg_temp.id('bk')),
  (pg_temp.id('w2'), pg_temp.id('owner'), NULL, pg_temp.id('svc-legacy'), pg_temp.id('bk-legacy')),
  (pg_temp.id('w3'), pg_temp.id('owner'), NULL, NULL, NULL);
SELECT pg_temp.ok((SELECT count(*) FROM public.warteliste WHERE owner_id = pg_temp.id('owner')) = 3, 'eigene und Legacy-Verweise werden angenommen');
UPDATE public.warteliste SET status = 'cancelled' WHERE id = pg_temp.id('w1');
SELECT pg_temp.ok((SELECT status FROM public.warteliste WHERE id = pg_temp.id('w1')) = 'cancelled', 'Status-Update ohne Verweisänderung bleibt frei');
DO $$ DECLARE col text; ziel text; BEGIN
  FOR col, ziel IN SELECT * FROM (VALUES ('lead_id','f-lead'),('service_id','f-svc'),('matched_booking_id','f-bk')) t(c, v) LOOP
    PERFORM pg_temp.err(format('INSERT INTO public.warteliste(owner_id, %I) VALUES (%L, %L)', col, pg_temp.id('owner'), pg_temp.id(ziel)), '23514', 'INSERT mit fremdem ' || col);
    PERFORM pg_temp.err(format('UPDATE public.warteliste SET %I = %L WHERE id = %L', col, pg_temp.id(ziel), pg_temp.id('w3')), '23514', 'UPDATE auf fremdes ' || col);
    PERFORM pg_temp.err(format('INSERT INTO public.warteliste(owner_id, %I) VALUES (%L, %L)', col, pg_temp.id('owner'), gen_random_uuid()), '23514', 'INSERT mit unbekanntem ' || col || ' (vor dem Fremdschlüssel)');
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE col text; ziel text; BEGIN
  FOR col, ziel IN SELECT * FROM (VALUES ('lead_id','f-lead'),('service_id','f-svc'),('matched_booking_id','f-bk')) t(c, v) LOOP
    PERFORM pg_temp.err(format('INSERT INTO public.warteliste(owner_id, %I) VALUES (%L, %L)', col, pg_temp.id('owner'), pg_temp.id(ziel)), '23514', 'service_role: INSERT mit fremdem ' || col);
  END LOOP;
END $$;
RESET ROLE;
-- ON DELETE SET NULL (Verweis wird NULL) muss durchlaufen
DELETE FROM public.leads WHERE id = pg_temp.id('lead');
SELECT pg_temp.ok((SELECT lead_id IS NULL FROM public.warteliste WHERE id = pg_temp.id('w1')), 'Löschen des Patienten setzt den Wartelisten-Verweis auf NULL (Trigger blockiert nicht)');

-- ── Rechte der Triggerfunktionen ──────────────────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.rechnung_zahlung_storno_referenz_pruefen()', 'EXECUTE')
              AND NOT has_function_privilege('authenticated', 'public.rechnung_zahlung_storno_referenz_pruefen()', 'EXECUTE'), 'Storno-Trigger: kein EXECUTE für anon/authenticated');
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.warteliste_referenzen_pruefen()', 'EXECUTE')
              AND NOT has_function_privilege('authenticated', 'public.warteliste_referenzen_pruefen()', 'EXECUTE'), 'Wartelisten-Trigger: kein EXECUTE für anon/authenticated');
SELECT pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public'] FROM pg_proc WHERE oid = 'public.warteliste_referenzen_pruefen()'::regprocedure), 'Wartelisten-Trigger: DEFINER mit festem search_path');
ROLLBACK;
