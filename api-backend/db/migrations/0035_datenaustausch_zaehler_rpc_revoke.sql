-- Sicherheitskorrektur zu 0029 — dieselbe Klasse wie 0001 und 0002, dritter Fall.
--
-- BEFUND (Advisor-Lints 0028/0029, 20.09.2026, unmittelbar nach dem Anwenden
-- von 0026-0034): die drei SECURITY-DEFINER-Funktionen aus 0029 sind ueber
-- POST /rest/v1/rpc/<name> fuer `anon` UND `authenticated` aufrufbar.
--
--   naechste_datenaustauschreferenz(uuid, text, text)
--   naechste_transfernummer(uuid, text, text)
--   datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer)
--
-- Live gemessen (pg_proc.proacl), VOR dieser Migration:
--   {postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--
-- WARUM DAS SCHLIMM IST. Der Mandant kommt bei allen dreien als ARGUMENT
-- (`p_owner`, `p_absender_ik`, `p_empfaenger_ik`) und wird NICHT gegen
-- auth.uid() geprueft — SECURITY DEFINER haengt RLS ohnehin aus. Wer die
-- Funktion aufrufen darf, darf also die Nummernfolge einer FREMDEN Praxis
-- weiterdrehen: `naechste_*` springt die Datenaustauschreferenz vor,
-- `_vorstellen` setzt sie auf einen beliebigen Wert. Und aus derselben Nummer
-- entsteht ueber buildSammelRechnungsnummer() auch die RECHNUNGSNUMMER — es
-- beisst damit nicht nur die §302-Seite (Korrekturverfahren, Kap. 7.2),
-- sondern auch die GoBD-Seite. Exakt der Angriffsweg von S-24.
--
-- ⚠️ WARUM 0029 DAS NICHT VERHINDERT HAT — und das ist der eigentliche Fund,
--    nicht der fehlende REVOKE:
--    0029 enthielt sehr wohl `REVOKE EXECUTE ... FROM PUBLIC`, und das hat auch
--    gewirkt (der Eintrag `=X/postgres` fehlt in der Messung oben). Die Rechte
--    von `anon` und `authenticated` kommen hier aber NICHT ueber PUBLIC,
--    sondern als EIGENE Grants — aus ALTER DEFAULT PRIVILEGES. Gegenprobe,
--    live aus pg_default_acl (defaclobjtype='f', Schema public, Grantor
--    postgres):
--      {postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--    Supabase vergibt also auf JEDE neu angelegte Funktion in `public`
--    automatisch explizites EXECUTE an anon und authenticated. Ein REVOKE
--    FROM PUBLIC nimmt einem EINZELNEN Grantee nichts weg (derselbe Satz steht
--    schon im Kopf von 0001, nur in die andere Richtung gelesen).
--
--    ⚠️ Damit ist die Lehre aus 0024 ("der eigentliche Befund war nicht der
--    anon-GRANT, sondern PUBLIC") nur die HALBE Wahrheit. Beide Wege existieren:
--      • Bestandsfunktionen tragen oft `=X/postgres` (PUBLIC) — 0024.
--      • NEU angelegte Funktionen tragen explizite anon/authenticated-Grants
--        aus den Default Privileges — dieser Fall.
--    Wer nur eines von beiden schliesst, schliesst nichts. Deshalb revoked
--    diese Datei aus ALLEN DREI Quellen, wie 0001 und 0002 es tun.
--
-- ⚠️ tools/check-security-definer-grants.mjs hat NICHT versagt, weil die
--    Funktionen fehlten — sie stehen seit 0029 alle drei auf der PROTECTED-
--    Liste. Das Pruefmuster verlangte nur `... FROM ... PUBLIC`, und genau das
--    stand in 0029 ja drin. Das Tor war also gruen und trotzdem offen. Im
--    selben Commit verlangt das Muster jetzt zusaetzlich `anon` und
--    `authenticated`.
--
-- KEIN AUFRUFER VERLIERT ETWAS. Nachgeprueft (grep ueber *.js/*.mjs/*.html):
--   naechste_datenaustauschreferenz / naechste_transfernummer — genau ein
--     Aufrufer, vergebeNummern() in billing/api/abrechnung.routes.js:116-117,
--     ueber den service-role-Client (Zeile 55: SUPABASE_SERVICE_ROLE_KEY).
--   datenaustausch_zaehler_vorstellen — heute GAR KEIN Aufrufer; sie ist der
--     Heilungsweg fuer Umzug/restore (O-115) und wird von Hand bzw. vom
--     Migrationslauf benutzt, beides nicht als anon.
--   Kein Frontend-, kein PostgREST-, kein anon-Aufruf.
--
-- ZWEITER TEIL — DREI TRIGGERFUNKTIONEN, die gegen 0024 zurueckgefallen sind.
--   0024 hat EXECUTE fuer PUBLIC/anon/authenticated auf ALLEN Triggerfunktionen
--   in `public` entzogen, mit der Begruendung: eine Funktion mit RETURNS
--   trigger ist Innenleben der Tabelle und hat in der exponierten API nichts
--   verloren. Die drei am 20.09.2026 neu entstandenen Triggerfunktionen tragen
--   die Rechte trotzdem wieder:
--     podologie_behandlungen_festschreibung()      (0026)
--     podologie_behandlungen_kein_delete()         (0026)
--     fn_abrechnung_uebermittlung_festschreibung() (0034)
--   Bei den ersten beiden steht der GRANT sogar ausdruecklich in 0026 — aus
--   einem alten Dump uebernommen, vor 0024 war das der uebliche Zuschnitt.
--   Bei der dritten kommen sie aus den Default Privileges.
--   ⚠️ Das ist der KLEINERE Teil dieser Datei: PostgREST stellt Funktionen mit
--   RETURNS trigger gar nicht als RPC bereit, ein direkter Angriffsweg besteht
--   also nicht. Sie stehen hier trotzdem drin, weil eine Regel, die nach zwei
--   Wochen still wieder aufgeht, keine Regel ist — und weil der naechste
--   Leser sonst aus `anon=X` schliesst, 0024 sei zurueckgenommen worden.
--   ★ Die Trigger laufen unveraendert weiter: PostgreSQL prueft EXECUTE auf
--   Triggerfunktionen bei CREATE TRIGGER, nicht bei jedem Feuern. Das wurde am
--   17.09.2026 fuer 0024 live in einer zurueckgerollten Transaktion bewiesen
--   (siehe Kopf von db/SCHEMA-RLS.sql) — hier wird dieselbe Mechanik benutzt,
--   nicht eine neue Annahme.
--
-- ZAEHLER: counter-neutral. Diese Datei aendert ausschliesslich EXECUTE-ACLs —
--          keine Tabelle, keine Spalte, keine Policy, kein Index, kein Trigger,
--          keine Funktion. Keiner der zehn Zaehler in
--          api-backend/db/schema-zaehler.js liest ACLs (dieselbe Herleitung wie
--          _hinweis_0024 in erwartete-zaehler.json).

-- --------------------------------------------------------------------------
-- 1) Die drei SECURITY-DEFINER-Zaehlerfunktionen (0029)
--    Muster wortgleich zu 0002_nummernkreis_rpc_revoke.sql.
-- --------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.naechste_transfernummer(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.naechste_transfernummer(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.naechste_transfernummer(uuid, text, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) FROM authenticated;

-- service_role behaelt EXECUTE. Der GRANT steht bereits in 0029; er wird hier
-- wiederholt, damit die Datei fuer sich allein lesbar ist und ein spaeteres
-- DROP+CREATE der Funktionen nicht versehentlich den Backend-Pfad kappt.
GRANT EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.naechste_transfernummer(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) TO service_role;

-- --------------------------------------------------------------------------
-- 2) Die drei neuen Triggerfunktionen — zurueck auf den Stand von 0024
-- --------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.podologie_behandlungen_festschreibung() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.podologie_behandlungen_festschreibung() FROM anon;
REVOKE EXECUTE ON FUNCTION public.podologie_behandlungen_festschreibung() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.podologie_behandlungen_kein_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.podologie_behandlungen_kein_delete() FROM anon;
REVOKE EXECUTE ON FUNCTION public.podologie_behandlungen_kein_delete() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_abrechnung_uebermittlung_festschreibung() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_abrechnung_uebermittlung_festschreibung() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_abrechnung_uebermittlung_festschreibung() FROM authenticated;
