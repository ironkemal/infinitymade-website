-- Disposable PostgreSQL only. All fixtures, helper functions and writes roll back.
\if :{?pre_fix}
\else
\set pre_fix false
\endif
BEGIN;
SELECT set_config('test.pre_fix', :'pre_fix', true);
CREATE FUNCTION pg_temp.id(text) RETURNS uuid LANGUAGE sql IMMUTABLE AS 'SELECT md5($1)::uuid';
CREATE FUNCTION pg_temp.check_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END $$;
CREATE FUNCTION pg_temp.denied(stmt text, expected text DEFAULT '42501') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Unexpectedly accepted: %', stmt;
END $$;
INSERT INTO auth.users(id) SELECT pg_temp.id(x) FROM unnest(ARRAY['owner','foreign','denied','allowed','override','inactive','null-active','wrong-owner','missing']) x;
INSERT INTO public.profiles(id,role,owner_id,is_active)
SELECT pg_temp.id(x), CASE WHEN x IN ('owner','foreign') THEN 'owner' ELSE 'employee' END,
CASE WHEN x IN ('owner','foreign') THEN NULL WHEN x='wrong-owner' THEN pg_temp.id('foreign') ELSE pg_temp.id('owner') END,
CASE x WHEN 'inactive' THEN false WHEN 'null-active' THEN NULL ELSE true END
FROM unnest(ARRAY['owner','foreign','denied','allowed','override','inactive','null-active','wrong-owner','missing']) x
ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role, owner_id=EXCLUDED.owner_id, is_active=EXCLUDED.is_active;
INSERT INTO public.businesses(id,owner_id,business_name) VALUES
(pg_temp.id('business'),pg_temp.id('owner'),'Synthetic practice'),
(pg_temp.id('foreign-business'),pg_temp.id('foreign'),'Synthetic foreign practice');
INSERT INTO public.employee_groups(id,business_id,name) VALUES (pg_temp.id('group'),pg_temp.id('business'),'Synthetic billing');
INSERT INTO public.group_scopes(group_id,module,has_access) VALUES (pg_temp.id('group'),'abrechnung',true);
INSERT INTO public.employee_business_assignments(employee_id,business_id,group_id)
SELECT pg_temp.id(x),pg_temp.id('business'),pg_temp.id('group') FROM unnest(ARRAY['allowed','override','inactive','null-active','wrong-owner']) x;
INSERT INTO public.employee_groups(id,business_id,name) VALUES (pg_temp.id('denied-group'),pg_temp.id('business'),'Synthetic denied group');
INSERT INTO public.group_scopes(group_id,module,has_access) VALUES (pg_temp.id('denied-group'),'abrechnung',false);
INSERT INTO public.employee_business_assignments(employee_id,business_id,group_id) VALUES (pg_temp.id('denied'),pg_temp.id('business'),pg_temp.id('denied-group'));
INSERT INTO public.employee_scope_overrides(employee_id,business_id,module,has_access) VALUES
(pg_temp.id('override'),pg_temp.id('business'),'abrechnung',false);
INSERT INTO public.leads(id,owner_id,title) VALUES
(pg_temp.id('lead'),pg_temp.id('owner'),'Synthetic patient'),
(pg_temp.id('foreign-lead'),pg_temp.id('foreign'),'Synthetic foreign patient');
INSERT INTO public.services(id,owner_id,user_id,title,is_internal) VALUES
(pg_temp.id('service'),pg_temp.id('owner'),pg_temp.id('allowed'),'Synthetic internal',true),
(pg_temp.id('legacy-service'),NULL,pg_temp.id('owner'),'Synthetic legacy',false),
(pg_temp.id('foreign-service'),pg_temp.id('foreign'),pg_temp.id('owner'),'Synthetic foreign',false);
INSERT INTO public.bookings(id,owner_id,user_id,customer_name,start_time,end_time) VALUES
(pg_temp.id('booking'),pg_temp.id('owner'),pg_temp.id('allowed'),'Synthetic team','2026-12-01 10:00Z','2026-12-01 10:30Z'),
(pg_temp.id('legacy-booking'),NULL,pg_temp.id('owner'),'Synthetic legacy','2026-12-02 10:00Z','2026-12-02 10:30Z'),
(pg_temp.id('foreign-booking'),pg_temp.id('foreign'),pg_temp.id('owner'),'Synthetic foreign','2026-12-03 10:00Z','2026-12-03 10:30Z');
INSERT INTO public.invoices(id,owner_id,business_id,patient_name,total_patient,status)
SELECT pg_temp.id(x),pg_temp.id('owner'), CASE x WHEN 'invoice-null' THEN NULL WHEN 'invoice-foreign-business' THEN pg_temp.id('foreign-business') ELSE pg_temp.id('business') END,
'Synthetic invoice',100,'draft'
FROM unnest(ARRAY['invoice','invoice-null','invoice-foreign-business']) x;
INSERT INTO public.invoices(id,owner_id,business_id,patient_name,total_patient,status) VALUES
(pg_temp.id('foreign-invoice'),pg_temp.id('foreign'),pg_temp.id('foreign-business'),'Synthetic foreign invoice',100,'draft');
INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label)
SELECT owner_id,id,'zahlung',1,'bank','Synthetic bank' FROM public.invoices WHERE patient_name LIKE 'Synthetic%';
-- Re-run identical attacks against old candidate with psql -v pre_fix=true.
-- Each successful pre-fix attack is rolled back inside a subtransaction.
CREATE FUNCTION pg_temp.write_probe(stmt text, label text, code text DEFAULT '42501',
                                   invisible boolean DEFAULT false, after_sql text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE n int; old_candidate boolean := current_setting('test.pre_fix')::boolean;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF old_candidate THEN
      PERFORM pg_temp.check_true(n > 0,label || ' old candidate reproduces');
      IF after_sql IS NOT NULL THEN EXECUTE after_sql; END IF;
    ELSE
      PERFORM pg_temp.check_true(invisible AND n=0,label || ' must reject or affect zero rows');
    END IF;
    RAISE SQLSTATE 'ZX001'; -- rollback even successful malicious pre-fix writes
  EXCEPTION
    WHEN SQLSTATE 'ZX001' THEN NULL;
    WHEN OTHERS THEN
      IF NOT old_candidate AND SQLSTATE=code THEN NULL; ELSE RAISE; END IF;
  END;
  RAISE NOTICE 'PASS boundary: % (pre_fix=%)',label,old_candidate;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.id('override')::text,true);
SELECT pg_temp.write_probe(format('UPDATE public.employee_scope_overrides SET has_access=true WHERE employee_id=%L',pg_temp.id('override')),
 'override self grant','42501',true,
 'SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.invoices),''self grant opens invoice'')');
SELECT pg_temp.write_probe(format('DELETE FROM public.employee_scope_overrides WHERE employee_id=%L',pg_temp.id('override')),'delete explicit denial','42501',true);
SELECT pg_temp.write_probe(format('INSERT INTO public.employee_scope_overrides(employee_id,business_id,module,has_access) VALUES (%L,%L,%L,true)',pg_temp.id('override'),pg_temp.id('business'),'settings'),'insert self grant');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('denied')::text,true);
SELECT pg_temp.write_probe(format('UPDATE public.group_scopes SET has_access=true WHERE group_id=%L',pg_temp.id('denied-group')),
 'group self grant','42501',true,
 'SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.invoices),''group grant opens invoice'')');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('override')::text,true);
SELECT pg_temp.write_probe(format('UPDATE public.group_scopes SET has_access=false WHERE group_id=%L',pg_temp.id('group')),'change group grants','42501',true);
SELECT pg_temp.write_probe(format('DELETE FROM public.group_scopes WHERE group_id=%L',pg_temp.id('group')),'delete group grants','42501',true);
SELECT pg_temp.write_probe(format('INSERT INTO public.group_scopes(group_id,module,has_access) VALUES (%L,%L,true)',pg_temp.id('group'),'settings'),'insert group grants');
SELECT pg_temp.write_probe(format('UPDATE public.employee_groups SET name=%L WHERE id=%L','Synthetic illicit rename',pg_temp.id('group')),'change group','42501',true);
SELECT pg_temp.write_probe(format('INSERT INTO public.employee_groups(business_id,name) VALUES (%L,%L)',pg_temp.id('business'),'Synthetic illicit group'),'insert group');
-- Separate unassigned group permits DELETE reproduction without FK side effects.
RESET ROLE;
INSERT INTO public.employee_groups(id,business_id,name) VALUES (pg_temp.id('empty-group'),pg_temp.id('business'),'Synthetic empty');
SET LOCAL ROLE authenticated;
SELECT pg_temp.write_probe(format('DELETE FROM public.employee_groups WHERE id=%L',pg_temp.id('empty-group')),'delete group','42501',true);
SELECT set_config('request.jwt.claim.sub',pg_temp.id('allowed')::text,true);
SELECT pg_temp.write_probe(format('UPDATE public.invoices SET owner_id=%L,business_id=NULL WHERE id=%L',pg_temp.id('allowed'),pg_temp.id('invoice')),'employee owner transfer plus NULL business');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('inactive')::text,true);
SELECT pg_temp.write_probe(format('UPDATE public.invoices SET notes=%L WHERE id=%L','Synthetic inactive',pg_temp.id('invoice')),'inactive employee JWT','42501',true);
RESET ROLE;
SELECT set_config('test.other_payment',(SELECT id::text FROM public.rechnung_zahlungen WHERE invoice_id=pg_temp.id('invoice-null')),true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.id('allowed')::text,true);
SELECT pg_temp.write_probe(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) VALUES (%L,%L,%L,-1,%L,%L,%L)',pg_temp.id('owner'),pg_temp.id('invoice'),'storno','bank','Synthetic wrong invoice',current_setting('test.other_payment')),'cross invoice storno','23514');
-- Source UUID is deliberately known: FK checks ignore RLS, as does real guessed/leaked UUID input.
RESET ROLE;
SELECT set_config('test.foreign_payment',(SELECT id::text FROM public.rechnung_zahlungen WHERE invoice_id=pg_temp.id('foreign-invoice')),true);
SELECT set_config('test.other_payment',(SELECT id::text FROM public.rechnung_zahlungen WHERE invoice_id=pg_temp.id('invoice-null')),true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.write_probe(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) VALUES (%L,%L,%L,-1,%L,%L,%L)',pg_temp.id('owner'),pg_temp.id('invoice'),'storno','bank','Synthetic foreign reference',current_setting('test.foreign_payment')),'cross owner storno','23514');
SELECT pg_temp.write_probe(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) VALUES (%L,%L,%L,-99,%L,%L,(SELECT id FROM public.rechnung_zahlungen WHERE invoice_id=%L))',pg_temp.id('owner'),pg_temp.id('invoice'),'storno','bank','Synthetic wrong amount',pg_temp.id('invoice')),'wrong storno amount','23514');
-- A storno of another storno was accepted before; only positive originals are valid.
INSERT INTO public.rechnung_zahlungen(id,owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id)
SELECT pg_temp.id('storno-source'),owner_id,invoice_id,'storno',-betrag_eur,'bank','Synthetic valid cancel',id
FROM public.rechnung_zahlungen WHERE invoice_id=pg_temp.id('invoice');
SELECT pg_temp.write_probe(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) VALUES (%L,%L,%L,-1,%L,%L,%L)',pg_temp.id('owner'),pg_temp.id('invoice'),'storno','bank','Synthetic storno of storno',pg_temp.id('storno-source')),'storno of storno','23514');
RESET ROLE;
\if :pre_fix
ROLLBACK;
\quit
\endif
-- Owner rights management remains usable; effective rights remain readable by employees.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.id('owner')::text,true);
INSERT INTO public.employee_groups(id,business_id,name) VALUES (pg_temp.id('managed-group'),pg_temp.id('business'),'Synthetic managed');
UPDATE public.employee_groups SET name='Synthetic renamed' WHERE id=pg_temp.id('managed-group');
SELECT pg_temp.check_true((SELECT name='Synthetic renamed' FROM public.employee_groups WHERE id=pg_temp.id('managed-group')),'owner group update');
INSERT INTO public.group_scopes(group_id,module,has_access) VALUES (pg_temp.id('managed-group'),'abrechnung',false);
UPDATE public.group_scopes SET has_access=true WHERE group_id=pg_temp.id('managed-group');
SELECT pg_temp.check_true((SELECT has_access FROM public.group_scopes WHERE group_id=pg_temp.id('managed-group')),'owner scope update');
INSERT INTO public.employee_scope_overrides(employee_id,business_id,module,has_access) VALUES (pg_temp.id('denied'),pg_temp.id('business'),'abrechnung',false);
UPDATE public.employee_scope_overrides SET has_access=true WHERE employee_id=pg_temp.id('denied');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('denied')::text,true);
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.invoices WHERE owner_id=pg_temp.id('owner')),'employee gets legitimate owner grant');
INSERT INTO public.invoices(id,owner_id,business_id,patient_name) VALUES (pg_temp.id('granted-invoice'),pg_temp.id('owner'),pg_temp.id('business'),'Synthetic granted');
DELETE FROM public.invoices WHERE id=pg_temp.id('granted-invoice');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('owner')::text,true);
DELETE FROM public.employee_scope_overrides WHERE employee_id=pg_temp.id('denied');
DELETE FROM public.group_scopes WHERE group_id=pg_temp.id('managed-group');
DELETE FROM public.employee_groups WHERE id=pg_temp.id('managed-group');
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM public.employee_groups WHERE id=pg_temp.id('managed-group')),'owner management delete');
RESET ROLE;
SELECT pg_temp.check_true((SELECT NOT prosecdef AND provolatile='s' AND proconfig @> ARRAY['search_path=pg_catalog, public'] FROM pg_proc WHERE oid='public.abrechnungszugriff_erlaubt(uuid,uuid)'::regprocedure),'billing helper stable invoker pinned path');
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.abrechnungszugriff_erlaubt(uuid,uuid)','EXECUTE'),'helper anon ACL');
SELECT pg_temp.check_true(NOT has_function_privilege('authenticated','public.rechnung_zahlung_storno_referenz_pruefen()','EXECUTE') AND NOT has_function_privilege('anon','public.rechnung_zahlung_storno_referenz_pruefen()','EXECUTE'),'storno trigger ACL');
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.warteliste_referenzen_pruefen()','EXECUTE')
AND NOT has_function_privilege('authenticated','public.warteliste_referenzen_pruefen()','EXECUTE'),'trigger ACL');
SELECT pg_temp.check_true((SELECT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public'] FROM pg_proc WHERE oid='public.warteliste_referenzen_pruefen()'::regprocedure),'definer pinned search path');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.id('allowed')::text,true);
SELECT set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('allowed'),'role','authenticated')::text,true);
-- Team writes remain allowed, including internal services and user_id legacy rows.
INSERT INTO public.warteliste(id,owner_id,lead_id,service_id,matched_booking_id) VALUES
(pg_temp.id('wait'),pg_temp.id('owner'),pg_temp.id('lead'),pg_temp.id('service'),pg_temp.id('booking')),
(pg_temp.id('legacy-wait'),pg_temp.id('owner'),NULL,pg_temp.id('legacy-service'),pg_temp.id('legacy-booking')),
(pg_temp.id('null-wait'),pg_temp.id('owner'),NULL,NULL,NULL);
DO $$ DECLARE col text; target text; BEGIN
FOR col,target IN SELECT * FROM (VALUES ('lead_id','foreign-lead'),('service_id','foreign-service'),('matched_booking_id','foreign-booking')) t(c,v) LOOP
 PERFORM pg_temp.denied(format('INSERT INTO public.warteliste(owner_id,%I) VALUES (%L,%L)',col,pg_temp.id('owner'),pg_temp.id(target)),'23514');
 PERFORM pg_temp.denied(format('UPDATE public.warteliste SET %I=%L WHERE id=%L',col,pg_temp.id(target),pg_temp.id('wait')),'23514');
 PERFORM pg_temp.denied(format('INSERT INTO public.warteliste(owner_id,%I) VALUES (%L,%L)',col,pg_temp.id('owner'),pg_temp.id('missing')),'23514');
END LOOP;
END $$;
RESET ROLE;
-- Even privileged API writes cannot attach foreign references.
SET LOCAL ROLE service_role;
DO $$ DECLARE col text; target text; BEGIN
FOR col,target IN SELECT * FROM (VALUES ('lead_id','foreign-lead'),('service_id','foreign-service'),('matched_booking_id','foreign-booking')) t(c,v) LOOP
 PERFORM pg_temp.denied(format('INSERT INTO public.warteliste(owner_id,%I) VALUES (%L,%L)',col,pg_temp.id('owner'),pg_temp.id(target)),'23514');
 PERFORM pg_temp.denied(format('UPDATE public.warteliste SET %I=%L WHERE id=%L',col,pg_temp.id(target),pg_temp.id('wait')),'23514');
END LOOP;
END $$;
RESET ROLE;
-- Each branch runs with actual authenticated role and synthetic JWT identity.
SET LOCAL ROLE authenticated;
DO $$ DECLARE actor text; expected_count int; n int; new_id uuid; BEGIN
FOREACH actor IN ARRAY ARRAY['owner','denied','allowed','override','foreign','inactive','null-active','wrong-owner','missing'] LOOP
 PERFORM set_config('request.jwt.claim.sub',pg_temp.id(actor)::text,true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',pg_temp.id(actor),'role','authenticated')::text,true);
 expected_count := CASE actor WHEN 'owner' THEN 3 WHEN 'allowed' THEN 1 ELSE 0 END;
 SELECT count(*) INTO n FROM public.invoices WHERE owner_id=pg_temp.id('owner');
 PERFORM pg_temp.check_true(n=expected_count,actor || ' invoice select');
 SELECT count(*) INTO n FROM public.rechnung_zahlungen WHERE owner_id=pg_temp.id('owner');
 PERFORM pg_temp.check_true(n=expected_count + CASE WHEN actor IN ('owner','allowed') THEN 1 ELSE 0 END,actor || ' ledger select');
 UPDATE public.invoices SET notes='Synthetic update' WHERE owner_id=pg_temp.id('owner');
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM pg_temp.check_true(n=expected_count,actor || ' invoice update');
 IF actor IN ('owner','allowed') THEN
  INSERT INTO public.invoices(owner_id,business_id,patient_name,total_patient) VALUES (pg_temp.id('owner'),pg_temp.id('business'),'Synthetic write control',100) RETURNING id INTO STRICT new_id;
  -- Delete a draft with no journal, preserving existing money-lock semantics.
  DELETE FROM public.invoices WHERE id=new_id;
 ELSE
  DELETE FROM public.invoices WHERE owner_id=pg_temp.id('owner');
  GET DIAGNOSTICS n=ROW_COUNT;
  PERFORM pg_temp.check_true(n=0,actor || ' invoice delete');
  PERFORM pg_temp.denied(format('INSERT INTO public.invoices(owner_id,business_id,patient_name) VALUES (%L,%L,%L)',pg_temp.id('owner'),pg_temp.id('business'),'Synthetic denied'));
 END IF;
END LOOP;
END $$;
-- Allowed employee still cannot move invoice into unassigned/NULL business (WITH CHECK).
SELECT set_config('request.jwt.claim.sub',pg_temp.id('allowed')::text,true);
SELECT pg_temp.denied(format('INSERT INTO public.invoices(owner_id,patient_name) VALUES (%L,%L)',pg_temp.id('owner'),'Synthetic null business'));
SELECT pg_temp.denied(format('INSERT INTO public.invoices(owner_id,business_id,patient_name) VALUES (%L,%L,%L)',pg_temp.id('owner'),pg_temp.id('foreign-business'),'Synthetic foreign business'));
SELECT pg_temp.denied(format('UPDATE public.invoices SET business_id=NULL WHERE id=%L',pg_temp.id('invoice')));
SELECT pg_temp.denied(format('UPDATE public.invoices SET business_id=%L WHERE id=%L',pg_temp.id('foreign-business'),pg_temp.id('invoice')));
DO $$ DECLARE actor text; inv text; BEGIN
FOREACH actor IN ARRAY ARRAY['owner','allowed','denied','override','foreign','inactive','null-active','wrong-owner','missing'] LOOP
 PERFORM set_config('request.jwt.claim.sub',pg_temp.id(actor)::text,true);
 FOREACH inv IN ARRAY ARRAY['invoice','invoice-null','invoice-foreign-business'] LOOP
  IF actor='owner' OR (actor='allowed' AND inv='invoice') THEN
   INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label)
   VALUES (pg_temp.id('owner'),pg_temp.id(inv),'zahlung',1,'bank','Synthetic bank');
  ELSE
   PERFORM pg_temp.denied(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label) VALUES (%L,%L,%L,1,%L,%L)',pg_temp.id('owner'),pg_temp.id(inv),'zahlung','bank','Synthetic denied'));
  END IF;
 END LOOP;
END LOOP;
END $$;
-- The existing SECURITY INVOKER RPC must encounter the same RLS boundary.
SELECT set_config('request.jwt.claim.sub',pg_temp.id('denied')::text,true);
SELECT pg_temp.denied(format('SELECT public.rechnung_zahlung_buchen(%L,%L,%L,2,CURRENT_DATE,%L,%L,%L,p_zahlart=>%L)',pg_temp.id('invoice'),pg_temp.id('owner'),pg_temp.id('denied'),'bank','Synthetic bank','offen','ueberweisung'),'P0002');
SELECT set_config('request.jwt.claim.sub',pg_temp.id('allowed')::text,true);
SELECT public.rechnung_zahlung_buchen(pg_temp.id('invoice'),pg_temp.id('owner'),pg_temp.id('allowed'),2,CURRENT_DATE,'bank','Synthetic bank','offen',p_zahlart=>'ueberweisung');
SELECT pg_temp.denied(format('SELECT public.rechnung_zahlung_buchen(%L,%L,%L,1000,CURRENT_DATE,%L,%L,%L,p_zahlart=>%L)',pg_temp.id('invoice'),pg_temp.id('owner'),pg_temp.id('allowed'),'bank','Synthetic bank','offen','ueberweisung'),'23514');
DO $$ DECLARE n int; BEGIN
 UPDATE public.rechnung_zahlungen SET betrag_eur=999 WHERE invoice_id=pg_temp.id('invoice');
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM pg_temp.check_true(n=0,'ledger UPDATE invisible without permissive policy');
 DELETE FROM public.rechnung_zahlungen WHERE invoice_id=pg_temp.id('invoice');
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM pg_temp.check_true(n=0,'ledger DELETE invisible without permissive policy');
END $$;
RESET ROLE;
-- Service-role bypasses RLS, never relational storno checks or GoBD triggers.
SET LOCAL ROLE service_role;
SELECT pg_temp.denied(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) VALUES (%L,%L,%L,-1,%L,%L,%L)',pg_temp.id('owner'),pg_temp.id('invoice'),'storno','bank','Synthetic cross owner',current_setting('test.foreign_payment')),'23514');
SELECT pg_temp.denied(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) VALUES (%L,%L,%L,-1,%L,%L,%L)',pg_temp.id('owner'),pg_temp.id('invoice'),'storno','bank','Synthetic cross invoice',current_setting('test.other_payment')),'23514');
SELECT pg_temp.denied(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) VALUES (%L,%L,%L,-1,%L,%L,%L)',pg_temp.id('owner'),pg_temp.id('invoice'),'storno','bank','Synthetic missing original',pg_temp.id('missing')),'23514');
SELECT pg_temp.denied(format('INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) SELECT owner_id,invoice_id,%L,-betrag_eur,%L,%L,id FROM public.rechnung_zahlungen WHERE id=(SELECT storniert_zeile_id FROM public.rechnung_zahlungen WHERE id=%L)','storno','bank','Synthetic duplicate cancel',pg_temp.id('storno-source')),'23505');
INSERT INTO public.rechnung_zahlungen(id,owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label) VALUES (pg_temp.id('writeoff'),pg_temp.id('owner'),pg_temp.id('invoice'),'ausbuchung',5,'bank','Synthetic writeoff');
INSERT INTO public.rechnung_zahlungen(owner_id,invoice_id,art,betrag_eur,gegenkonto_code,gegenkonto_label,storniert_zeile_id) VALUES (pg_temp.id('owner'),pg_temp.id('invoice'),'storno',-5,'bank','Synthetic writeoff cancel',pg_temp.id('writeoff'));
SELECT pg_temp.check_true((SELECT sum(betrag_eur)=0 FROM public.rechnung_zahlungen WHERE id=pg_temp.id('writeoff') OR storniert_zeile_id=pg_temp.id('writeoff')),'exact writeoff cancellation');
SELECT pg_temp.denied(format('UPDATE public.rechnung_zahlungen SET betrag_eur=99 WHERE id=%L',pg_temp.id('writeoff')),'23514');
SELECT pg_temp.denied(format('DELETE FROM public.rechnung_zahlungen WHERE id=%L',pg_temp.id('writeoff')),'23514');
RESET ROLE;
-- PostgreSQL ILIKE uses literal escaped names, with no prefix wildcard.
SELECT pg_temp.check_true('100%Name' ILIKE E'100\\%Name' AND NOT ('100XName' ILIKE E'100\\%Name'),'ILIKE literal percent');
SELECT pg_temp.check_true('A_Name' ILIKE E'A\\_Name' AND NOT ('AXName' ILIKE E'A\\_Name'),'ILIKE literal underscore');
SELECT pg_temp.check_true(E'A\\Name' ILIKE E'A\\\\Name' AND NOT ('AName' ILIKE E'A\\\\Name'),'ILIKE literal backslash');
ROLLBACK;
