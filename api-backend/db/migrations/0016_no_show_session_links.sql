-- Ops-Karte a8186cb8 — „Patient nicht erschienen" gab die Einheit nie frei.
--
-- Problem
-- ───────
-- Beim no_show blieb `prescription_sessions.booking_id` am Termin stehen. Die
-- Einheit galt damit weiter als „vergeben": die Verordnung zeigte 3/6, obwohl
-- nur 2 Einheiten erbracht waren, und die ausgefallene Einheit tauchte nie
-- wieder in der Liste der offenen Einheiten auf. Ein Nachholtermin liess sich
-- nur anlegen, indem man den Zähler ignorierte.
--
-- Entscheidung (Nutzer, 14.09.2026): beim no_show wird `booking_id` auf NULL
-- gesetzt und die Zeile wieder auf 'planned' — die Einheit wurde nicht
-- erbracht, sie gehört zurück in den Topf. Die Spur des Ausfalls bleibt am
-- TERMIN (`bookings.status='no_show'`, `no_show`, `no_show_noted_at`,
-- `cancellation_reason`), nicht an der Sitzungszeile.
--
-- Warum diese Spalte
-- ──────────────────
-- Es gibt den Rückweg: module/booking-status-korrektur.js `korrigiereNoShow()`
-- („der Patient war doch da"). Der fand seine Sitzungszeile über
-- `.eq('booking_id', …)`. Nach der Freigabe findet er dort nichts mehr — die
-- erbrachte Einheit ginge lautlos verloren. Diese Spalte ist die Rückfahrkarte:
-- sie merkt sich, welche Zeilen an diesem Termin hingen.
--
-- Warum NICHT `cancelled_session_links` (#192, 08.09.2026)
-- ───────────────────────────────────────────────────────
-- Dieselbe Idee, aber jene Spalte gehört dem Trigger
-- `codex_192_booking_before_write()`: er setzt bei JEDEM UPDATE
-- `NEW.cancelled_session_links := OLD.cancelled_session_links` und hängt nur bei
-- `status='cancelled'` etwas an. Ein vom Client mitgeschickter Wert wird also
-- verworfen — für no_show ist die Spalte unbeschreibbar. Der Trigger wird
-- bewusst NICHT angefasst: er hält die Absage-Invarianten (Reaktivierungssperre,
-- Gruppenabsage, laufende Fahrt) zusammen; ein Umbau dort riskiert ein Feature,
-- das nichts mit dieser Karte zu tun hat. Stattdessen eine additive Spalte, die
-- der Client selbst füllt.
--
-- Form ist absichtlich identisch zu `cancelled_session_links`:
--   [{session_id, prescription_id, session_number, heilmittel_index}, …]
-- Kein Sitzungszähler, keine Abrechnungsquelle — die Wahrheit steht weiterhin
-- in `prescription_sessions`.
--
-- ZAEHLER: unveraendert (nur eine Spalte — kein Tabelle/Policy/Funktion/
--          Trigger/Index, keine storage.*/auth.*-Aenderung).
-- SaaS: uygulandı 14.09.2026, MCP (db-ustasi ikinci-göz: trigger/index/RLS temiz,
--       backfill 2 booking + 2 Sitzungszeile, 0 'done' berührt).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS no_show_session_links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bookings.no_show_session_links IS
  'Rückfahrkarte: geplante prescription_sessions, die beim no_show freigegeben wurden. Kein Sitzungszähler. Gegenstück zu cancelled_session_links (#192), aber vom Anwendungscode geschrieben.';

-- Altbestand: Termine, die vor dieser Migration als no_show markiert wurden,
-- halten ihre Einheiten bis heute fest. Genau die Zahlen, über die die Karte
-- geschrieben wurde. Erst die Momentaufnahme, dann die Freigabe — in dieser
-- Reihenfolge ist der Schritt umkehrbar.
--
-- Bewusst NUR Zeilen in 'planned'/'no_show': eine Zeile auf 'done' wurde
-- abgehakt (und ist womöglich schon abgerechnet); die wird hier nicht angefasst.
WITH schnappschuss AS (
  SELECT s.booking_id,
         jsonb_agg(jsonb_build_object(
           'session_id',       s.id,
           'prescription_id',  s.prescription_id,
           'session_number',   s.session_number,
           'heilmittel_index', s.heilmittel_index
         ) ORDER BY s.session_number) AS links
  FROM public.prescription_sessions s
  JOIN public.bookings b ON b.id = s.booking_id
  WHERE b.status = 'no_show'
    AND s.status IN ('planned', 'no_show')
  GROUP BY s.booking_id
)
UPDATE public.bookings b
SET no_show_session_links = b.no_show_session_links || schnappschuss.links
FROM schnappschuss
WHERE b.id = schnappschuss.booking_id;

UPDATE public.prescription_sessions s
SET booking_id = NULL, status = 'planned'
FROM public.bookings b
WHERE b.id = s.booking_id
  AND b.status = 'no_show'
  AND s.status IN ('planned', 'no_show');
