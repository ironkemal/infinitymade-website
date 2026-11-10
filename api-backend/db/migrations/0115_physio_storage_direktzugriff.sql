-- 0115_physio_storage_direktzugriff.sql — physio-v1-Artefakte nicht per Direkt-Storage-URL lesbar (07.11.2026).
--
-- WAS: eine RESTRICTIVE SELECT-Policy auf storage.objects fuer `authenticated`. Im Bucket `abrechnungen`
--      ist der Teilbaum <owner>/<abrechnung>/physio-v1/<generation>/<datei> nur lesbar, wenn
--      public.physio_storage_readable(name) (0113) zustimmt: Kopf published, Registry-Zeile published,
--      aktuelle Generation, Owner oder Team des Owners. Vorbereitete, abgebrochene und unregistrierte
--      Dateien sind damit per createSignedUrl/Direktlesen mit User-JWT nicht erreichbar.
-- WARUM: Publikationsreview 07.11.2026, Paket 1. Bisher galt nur die pfadbasierte permissive Policy
--      abrechnungen_owner_read (Baseline) ohne Freigabestatus. Entwurf db/entwuerfe/physio-storage-direktzugriff.sql,
--      Melih GO 07.11.2026.
-- ZUSAMMENGEFUEHRT statt gedoppelt: keine zweite Lesbarkeitsfunktion, die Policy ruft die vorhandene
--      physio_storage_readable(text) aus 0113 (EXECUTE fuer authenticated dort bereits vergeben).
-- Korrektur gegenueber dem Entwurf: der Entwurf schrieb NOT (bucket_id = 'abrechnungen' AND
--      (storage.foldername(name))[3] = 'physio-v1'). Bei Pfaden mit weniger als drei Ordnern ist [3] NULL,
--      NOT (true AND NULL) = NULL, und RLS behandelt NULL als "nein" — Bestandsdateien wie
--      <owner>/<abrechnung>/datei.dta waeren fuer alle unlesbar geworden. Hier IS DISTINCT FROM: nur der
--      physio-v1-Teilbaum ist betroffen, Legacy-/Podologie-Pfade bleiben exakt wie vorher.
-- RESTRICTIVE = UND-verknuepft mit den permissiven Policies: kann Zugriff nur entziehen, nie erweitern.
--      service_role (Backend-Download GET /abrechnung/:id/artefakte/:versionId/download) umgeht RLS und ist
--      unberuehrt. `anon` bleibt aussen vor: die permissive Policy laesst anon ohnehin nicht zu, und eine
--      Policy fuer anon wuerde fuer JEDE anon-Storage-Abfrage EXECUTE auf die Funktion verlangen.
-- Nicht Teil dieser Datei: Ersetzen von abrechnungen_owner_read durch physio_storage_readable fuer den
--      ganzen Bucket (Legacy-Abgleich noetig, 0113-Kopf "STORAGE ACTIVATION CONTRACT").
-- Ausserhalb public (Kural 6): Storage-Policies zaehlen in keinem schema-zaehler-Wert (rls_policy zaehlt nur
--      public). Trotzdem in frischer Box-naher DB gemessen, siehe erwartete-zaehler.json _hinweis_0112_0115.
-- Bereits ausgestellte signierte URLs bleiben bis Ablauf gueltig (Storage prueft beim Signieren).
-- SaaS: angewandt 10.11.2026, Supabase Management-API (SQL) + Ledger-Eintrag supabase_migrations
--      (Gate O-129 laesst diese Zeile absichtlich nicht durch.)

DROP POLICY IF EXISTS abrechnungen_physio_direktlesen ON storage.objects;
CREATE POLICY abrechnungen_physio_direktlesen ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id IS DISTINCT FROM 'abrechnungen'
    OR (storage.foldername(name))[3] IS DISTINCT FROM 'physio-v1'
    OR public.physio_storage_readable(name)
  );
