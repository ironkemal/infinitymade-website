-- ENTWURF — NICHT aktiv, nicht in api-backend/db/migrations, nicht live angewandt (GO nötig).
-- Ziel (Paket 1, Publikationsreview 07.11.2026): Physio-Publikationsartefakte dürfen NICHT per
-- Direkt-Storage-URL (createSignedUrl mit User-JWT, abrechnung-detail.js downloadAbrechnungFile)
-- geladen werden. Heute gilt nur die tenantpfadbasierte Policy "abrechnungen_owner_read" ohne
-- Freigabestatus. Zugriff läuft ausschließlich über GET /abrechnung/:id/artefakte/:versionId/download
-- (service_role, ladeArtefaktVersion prüft Registry-Status).
--
-- Pfadkonvention (Adapter-Test): <owner>/<abrechnung>/physio-v1/<generation>/<datei>
-- RESTRICTIVE Policy schneidet nur diesen Teilbaum aus; Legacy-/Podologie-Pfade unverändert.
-- Vor Aktivierung: Pfadkonvention in reserviereUndLadeHoch-Aufrufern verifizieren, onprem prüfen
-- (Box: gleiche Policy in api-backend/db/migrations ablegen), SCHEMA-RLS.sql neu erzeugen.

CREATE POLICY "abrechnungen_physio_kein_direktlesen" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT (bucket_id = 'abrechnungen' AND (storage.foldername(name))[3] = 'physio-v1'));
