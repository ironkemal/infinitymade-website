-- Migration 0069_praxis_stempel_branding.sql
-- SaaS: angewandt 06.10.2026 (MCP: 20261006085620).
-- KHS M2.4 / PE-006, guvenlik S-47 (05.10.2026), legal-de F4/F7:
--  (1) profiles.praxis_stempel_path — PFAD (keine URL) des digitalen Praxisstempels im privaten Bucket `praxis-stempel`.
--  (2) profiles.praxis_inhaber — buergerlicher Inhabername (§ 14 Abs. 4 Nr. 1 UStG, Einzelpraxis); bisher kein Feld.
--  (3) Bucket `praxis-stempel`: PRIVAT, 512 KB, nur PNG/JPEG (kein SVG), Pfad `<owner_id>/stempel.png`.
--      Schreiben/Loeschen: nur der Owner in seinen EIGENEN Ordner (nicht das avatars-Muster „Owner schreibt in Mitarbeiter-Ordner").
--      Lesen: die Praxis (Owner + Mitarbeiter, ueber auth_tenant_id()); anon nie.
-- Der Stempel ist rechtlich optional (legal-de) und kein Geheimnis, aber eine Faelschungshilfe — deshalb nie unter einer oeffentlichen URL;
-- Belege betten ihn beim Erzeugen ein (Data-URL), er steht nie als URL im Dokument.
-- Policies liegen im Schema `storage` -> Schema-Zaehler (nur `public`) unveraendert; zwei nullable Spalten sind zaehlerneutral.
-- Box: Buckets entstehen NUR ueber diese Kette (STORAGE_BACKEND=file); `DO UPDATE` setzt die Limits auch bei vorhandenem Bucket.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS praxis_stempel_path text,
  ADD COLUMN IF NOT EXISTS praxis_inhaber text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_praxis_inhaber_laenge_check CHECK (praxis_inhaber IS NULL OR char_length(praxis_inhaber) <= 200),
  ADD CONSTRAINT profiles_praxis_stempel_path_check CHECK (praxis_stempel_path IS NULL OR praxis_stempel_path ~ '^[0-9a-f-]{36}/stempel\.(png|jpg)$');

COMMENT ON COLUMN public.profiles.praxis_stempel_path IS 'Pfad des Praxisstempels im privaten Bucket praxis-stempel (<owner_id>/stempel.png|jpg). Nie eine URL. Nur die Owner-Zeile zaehlt (Belege lesen ownerProfile).';
COMMENT ON COLUMN public.profiles.praxis_inhaber IS 'Buergerlicher Name der Inhaberin/des Inhabers fuer Rechnungen (§ 14 Abs. 4 Nr. 1 UStG, Einzelpraxis).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('praxis-stempel', 'praxis-stempel', false, 524288, '{image/png,image/jpeg}'::text[])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 524288, allowed_mime_types = '{image/png,image/jpeg}'::text[];

DROP POLICY IF EXISTS praxis_stempel_read ON storage.objects;
CREATE POLICY praxis_stempel_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (bucket_id = 'praxis-stempel' AND (storage.foldername(name))[1] = (public.auth_tenant_id())::text);

DROP POLICY IF EXISTS praxis_stempel_owner_insert ON storage.objects;
CREATE POLICY praxis_stempel_owner_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'praxis-stempel' AND (storage.foldername(name))[1] = (auth.uid())::text
              AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'owner'));

DROP POLICY IF EXISTS praxis_stempel_owner_update ON storage.objects;
CREATE POLICY praxis_stempel_owner_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (bucket_id = 'praxis-stempel' AND (storage.foldername(name))[1] = (auth.uid())::text
         AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'owner'))
  WITH CHECK (bucket_id = 'praxis-stempel' AND (storage.foldername(name))[1] = (auth.uid())::text
              AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'owner'));

DROP POLICY IF EXISTS praxis_stempel_owner_delete ON storage.objects;
CREATE POLICY praxis_stempel_owner_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'praxis-stempel' AND (storage.foldername(name))[1] = (auth.uid())::text
         AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'owner'));
