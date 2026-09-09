-- ==============================================
-- INFINITY V16 — Patient documents bucket
-- 2026-05-19
--
-- Private bucket for patient-bound files (Zuzahlungs-Befreiungsbescheinigung
-- to start, future: ID scans, consent forms, etc.).
-- Owner + employees can CRUD their own owner-scoped paths.
-- ==============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('patient-documents', 'patient-documents', FALSE, 5 * 1024 * 1024,
        ARRAY['application/pdf','image/png','image/jpeg','image/jpg','image/webp','application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Path layout: {ownerId}/{leadId}/{filename}
DROP POLICY IF EXISTS "patient_documents_owner_all" ON storage.objects;
CREATE POLICY "patient_documents_owner_all" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'patient-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT owner_id FROM profiles WHERE id = auth.uid() AND owner_id IS NOT NULL
      )
    )
  )
  WITH CHECK (
    bucket_id = 'patient-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT owner_id FROM profiles WHERE id = auth.uid() AND owner_id IS NOT NULL
      )
    )
  );
