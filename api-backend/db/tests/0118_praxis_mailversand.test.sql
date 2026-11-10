-- 0118: praxis_mailversand — nur service_role, CHECKs, Trigger, CASCADE.
-- Only disposable PostgreSQL after the complete migration chain (0000..0118+); never a live database.
-- Synthetic fixtures, everything rolled back. smtp_passwort ist ein synthetischer Bytewert, kein echtes Chiffrat.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.ok(c boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF c IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END $$;
CREATE FUNCTION pg_temp.err(q text, code text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean := false; BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> code THEN RAISE EXCEPTION 'FAIL: % expected %, got %: %', label, code, SQLSTATE, SQLERRM; END IF;
    caught := true;
  END;
  PERFORM pg_temp.ok(caught, label);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean,text), pg_temp.err(text,text,text) TO service_role, authenticated, anon;

INSERT INTO auth.users(id) VALUES ('b1111111-1111-4111-8111-111111111111');
UPDATE public.profiles SET role='owner', is_active=true WHERE id='b1111111-1111-4111-8111-111111111111';

SELECT pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.praxis_mailversand'::regclass), 'RLS an');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='praxis_mailversand'), 'keine Policy');
SELECT pg_temp.ok(NOT has_table_privilege('authenticated','public.praxis_mailversand','SELECT'), 'authenticated darf nicht lesen');
SELECT pg_temp.ok(NOT has_table_privilege('anon','public.praxis_mailversand','SELECT'), 'anon darf nicht lesen');
SELECT pg_temp.ok(has_table_privilege('service_role','public.praxis_mailversand','INSERT,UPDATE,DELETE,SELECT'), 'service_role darf schreiben');

SET LOCAL ROLE service_role;
INSERT INTO public.praxis_mailversand(owner_id, modus, preset, smtp_host, smtp_port, smtp_sicherheit, smtp_benutzer, smtp_passwort, absender_email)
  VALUES ('b1111111-1111-4111-8111-111111111111','smtp','ionos','smtp.ionos.de',465,'ssl','p@example.invalid','\x00ff'::bytea,'p@example.invalid');
SELECT pg_temp.ok((SELECT status FROM public.praxis_mailversand WHERE owner_id='b1111111-1111-4111-8111-111111111111')='nicht_eingerichtet', 'Status-Default');
SELECT pg_temp.err($q$UPDATE public.praxis_mailversand SET modus='pop3'$q$, '23514', 'unbekannter Modus abgelehnt');
SELECT pg_temp.err($q$UPDATE public.praxis_mailversand SET smtp_port=70000$q$, '23514', 'Port ausserhalb abgelehnt');
SELECT pg_temp.err($q$UPDATE public.praxis_mailversand SET letzter_fehler_code='550 rejected <a@b.de>'$q$, '23514', 'Rohmeldung als Fehlercode abgelehnt');
SELECT pg_temp.err($q$UPDATE public.praxis_mailversand SET smtp_passwort=NULL$q$, '23514', 'smtp ohne Passwort abgelehnt');
UPDATE public.praxis_mailversand SET modus='aus', smtp_passwort=NULL, updated_at='2000-01-01';
SELECT pg_temp.ok((SELECT updated_at > '2001-01-01' FROM public.praxis_mailversand), 'Trigger setzt updated_at');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.err($q$SELECT * FROM public.praxis_mailversand$q$, '42501', 'Browser-Rolle: kein Lesezugriff');
RESET ROLE;

DELETE FROM public.profiles WHERE id='b1111111-1111-4111-8111-111111111111';
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.praxis_mailversand WHERE owner_id='b1111111-1111-4111-8111-111111111111'), 'CASCADE mit profiles');
ROLLBACK;
