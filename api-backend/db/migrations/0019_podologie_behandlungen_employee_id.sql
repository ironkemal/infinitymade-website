-- Ops-Karte #252 — `podologie_behandlungen` hat keine Spalte fuer den
-- behandelnden Mitarbeiter (Sicherheitsagent-Fund, blockiert RLS-Ausbau).
--
-- Spaltenname `employee_id` statt `behandler_id` — folgt der im Projekt
-- etablierten Konvention (bookings.employee_id u.a., fuenf+ Tabellen mit
-- demselben Namen). Nullable: Altbestand-Zeilen und vom Owner selbst
-- durchgefuehrte Behandlungen (Owner ist kein "employee", profiles.role =
-- 'owner' in derselben Tabelle) bleiben legitim leer.
--
-- Schreibpunkt: module/podologie-abrechnung.js:773-781 (einziger INSERT).
-- db-ustasi-Konsultation: 2026-09-17.
--
-- ZAEHLER: unveraendert (nur eine Spalte + FK — kein Tabelle/Policy/Funktion/
--          Trigger/Index, keine storage.*/auth.*-Aenderung).

ALTER TABLE public.podologie_behandlungen
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.podologie_behandlungen.employee_id IS
  'Wer die Behandlung durchgefuehrt hat. NULL bei Altbestand oder wenn der Owner selbst behandelt hat. Ops #252.';
