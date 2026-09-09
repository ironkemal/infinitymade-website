-- ==============================================
-- INFINITY V15 — Abrechnung storage bucket + RLS
-- 2026-05-19
--
-- Creates the "abrechnungen" private bucket holding DTA files and
-- Begleitzettel HTML. Owner-scoped read; service_role writes.
-- ==============================================

-- 1. Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('abrechnungen', 'abrechnungen', FALSE, 10 * 1024 * 1024,
        ARRAY['application/octet-stream', 'text/html', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies on storage.objects for this bucket.
--    Path layout: {ownerId}/{YYYY}/{MM}/{abrechnungId}/{filename}
--    Owners & their employees read; only service_role writes.

DROP POLICY IF EXISTS "abrechnungen_owner_read" ON storage.objects;
CREATE POLICY "abrechnungen_owner_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'abrechnungen'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT owner_id FROM profiles WHERE id = auth.uid() AND owner_id IS NOT NULL
      )
    )
  );

-- Writes are done only via the service-role backend (POST /api/billing/...).
-- No INSERT/UPDATE/DELETE policy for authenticated users → service_role only.
