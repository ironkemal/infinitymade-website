-- Kiosk-Modus Härtung (P1) — Konsey 2026-08-14
-- konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md
--
-- Warum: profiles.tablet_kiosk_pin lag im Klartext und wurde clientseitig
-- verglichen (dashboard.js:22858). Zusätzlich hat "PIN vergessen?" den PIN
-- ohne jede Prüfung auf NULL gesetzt. Beides ist eine Art. 32 Abs. 1
-- TOM-Unzulänglichkeit (compliance/LEGAL_DECISIONS.md, 2026-08-14).
--
-- Bewusster Preis: bestehende PINs werden ungültig, Inhaber legen neu an.

BEGIN;

-- 1) Klartext-Spalte ersatzlos entfernen.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS tablet_kiosk_pin;

-- 2) Der Client darf wissen OB ein PIN gesetzt ist — nicht welcher.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tablet_kiosk_pin_set boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.tablet_kiosk_pin_set IS
  'Kiosk-PIN hinterlegt? Wird ausschliesslich vom Backend (service_role) gepflegt.';

-- 3) Hash-Tresor. Bewusst OHNE RLS-Policy: nur service_role (Backend) kommt ran.
--    Ein scrypt-Hash eines 4-stelligen PINs waere im Client in Millisekunden
--    durchprobiert (10.000 Kandidaten) — der Hash darf den Server nie verlassen.
CREATE TABLE IF NOT EXISTS public.kiosk_pins (
  user_id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash        text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kiosk_pins IS
  'Kiosk-PIN als scrypt-Hash (Node crypto.scrypt, keine externe Abhaengigkeit). '
  'Kein RLS-Policy = kein Zugriff fuer anon/authenticated; '
  'Pruefung laeuft ausschliesslich ueber api-backend POST /api/kiosk/pin/verify.';

ALTER TABLE public.kiosk_pins ENABLE ROW LEVEL SECURITY;
-- Keine Policy ist Absicht: PostgREST liefert damit fuer anon/authenticated
-- garantiert nichts aus. service_role umgeht RLS.
REVOKE ALL ON public.kiosk_pins FROM anon, authenticated;

COMMIT;
