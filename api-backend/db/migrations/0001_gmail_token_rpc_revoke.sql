-- S-01/S-02/S-19: get_gmail_token/set_gmail_token/clear_gmail_token wurden mit
-- CREATE FUNCTION angelegt und tragen dadurch das Postgres-Standardrecht
-- EXECUTE fuer PUBLIC (also auch anon und authenticated). Alle drei sind
-- SECURITY DEFINER, lesen/schreiben vault.decrypted_secrets und enthalten
-- keine auth.uid()-Pruefung im Funktionskoerper. Aufrufer im Code ist
-- ausschliesslich api-backend/server.js ueber den service_role-Client
-- (supabase.rpc('set_gmail_token'|'get_gmail_token'|'clear_gmail_token', ...)) --
-- kein Frontend-Aufruf, kein Grund fuer PUBLIC/anon/authenticated ueberhaupt
-- EXECUTE zu haben.

REVOKE EXECUTE ON FUNCTION public.get_gmail_token(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_gmail_token(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_gmail_token(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.set_gmail_token(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_gmail_token(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_gmail_token(uuid, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.clear_gmail_token(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_gmail_token(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_gmail_token(uuid) FROM authenticated;

-- service_role behaelt EXECUTE (bereits ueber GRANT ALL ... TO service_role
-- in der Baseline gesetzt, REVOKE FROM PUBLIC nimmt es einem einzelnen Grantee
-- nicht weg).
