-- S-24 (mittel): naechste_nummer(p_owner uuid, p_kreis text, p_jahr integer) ist
-- SECURITY DEFINER, nimmt den Mandanten als Argument entgegen und prueft ihn
-- nicht gegen auth.uid() -- dasselbe Muster wie S-01/S-02 (0001), nur schreibend
-- statt lesend. Sie zaehlt public.nummernkreise per INSERT .. ON CONFLICT DO
-- UPDATE hoch (lueckenlose Belegnummer, Beleg/Mahnung/Ausfallrechnung, GoBD).
-- Ein Aufruf mit fremder owner_id ueber /rest/v1/rpc/naechste_nummer verbraucht
-- eine Nummer einer fremden Praxis und reisst deren lueckenlose Nummerierung
-- (§ 146 Abs. 4 AO / GoBD) von aussen auf.
--
-- Derselbe Fund, niedriger, fuer naechste_verordnungsnummer(p_owner uuid,
-- p_lead uuid): liest nur (zaehlt gegen prescriptions), verraet aber die
-- laufende Verordnungsnummer eines fremden Patienten.
--
-- Beide werden im Code nirgends direkt aufgerufen (kein .rpc('naechste_nummer'
-- | 'naechste_verordnungsnummer', ...) in *.js/*.html/*.mjs). Der einzige
-- Aufrufer ist der Trigger set_invoice_nummer() -- selbst SECURITY DEFINER,
-- ruft also als Funktionsbesitzer auf. anon/authenticated brauchen EXECUTE auf
-- keinem Weg.

REVOKE EXECUTE ON FUNCTION public.naechste_nummer(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.naechste_nummer(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.naechste_nummer(uuid, text, integer) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.naechste_verordnungsnummer(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.naechste_verordnungsnummer(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.naechste_verordnungsnummer(uuid, uuid) FROM authenticated;

-- service_role behaelt EXECUTE (Baseline-GRANT bleibt stehen); der eigentliche
-- Aufruf laeuft ohnehin ueber den SECURITY-DEFINER-Trigger als Funktionsbesitzer,
-- nicht ueber eine Rolle.
