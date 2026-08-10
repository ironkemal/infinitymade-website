-- v34 — Gegenangebot zur Terminanfrage
--
-- Warum: Passt der Wunschtermin nicht, blieb der Praxis bisher nur die Absage.
-- Jetzt kann sie 2–3 freie Zeiten anbieten; der Patient nimmt eine davon per Klick
-- in der E-Mail an.
--
-- Bewusst KEIN neuer Status: solange der Patient nicht geantwortet hat, ist die
-- Anfrage weiterhin offen ('pending'). Das erspart eine Änderung an der
-- Status-Constraint und einen vierten Reiter in der Oberfläche — und es ist
-- inhaltlich richtig, denn entschieden ist noch nichts.
--
-- Format von alternativ_termine (Array, 2–3 Einträge):
--   [{"date":"2026-09-15","time":"09:00","employee_id":"<uuid>"}, ...]
--
-- ⚠️ Vor dem Deploy im Supabase SQL-Editor ausführen (Projekt njvuclullotbksskpwgk).

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS alternativ_termine jsonb,
  ADD COLUMN IF NOT EXISTS alternativ_angeboten_at timestamp with time zone;

COMMENT ON COLUMN public.booking_requests.alternativ_termine IS
  'Der Praxis angebotene Ersatztermine: [{date,time,employee_id}]. Der Patient nimmt einen davon per Link aus der E-Mail an.';
COMMENT ON COLUMN public.booking_requests.alternativ_angeboten_at IS
  'Wann das Gegenangebot verschickt wurde. NULL = kein Gegenangebot offen.';
