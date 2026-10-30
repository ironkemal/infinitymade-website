-- KG-ZNS als Zertifikatspositionen (Physio/PILOT-PLAN.md K2, 30.10.2026).
--
-- WAS: services.required_certificate und therapist_certificates.certificate kennen
--      fünf weitere Werte. Nur Erweiterung der Liste: bestehende Zeilen bleiben gültig,
--      alter Code kennt die neuen Werte bloß nicht (:beta/:stable unkritisch).
-- WARUM je Methode ein Wert: die Prüfung ist reine Gleichheit, und die Position hängt an
--      der Methode (Anlage 1 Physio: Weiterbildung "in dem betreffenden Bereich (Bobath,
--      Vojta oder PNF)"; Anlage 7 Fassung 21.07.2021 Nr. 3-7). Ein Sammelwert "KG-ZNS"
--      würde einen Bobath-Therapeuten bei X0711/X0712 fälschlich durchwinken (gkv-302).
--      Kinder deckt Erwachsene derselben Methode, nie umgekehrt: das löst die Oberfläche
--      über eine zweite Zeile (module/physio-katalog-migration.js), nicht der Constraint.
--
-- SaaS: angewandt 30.10.2026, MCP.

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_required_certificate_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_required_certificate_check CHECK (required_certificate = ANY (ARRAY[
    'MT'::text, 'MLD'::text, 'KGG'::text,
    'ZNS-BOBATH'::text, 'ZNS-VOJTA'::text, 'ZNS-PNF'::text, 'ZNS-K-BOBATH'::text, 'ZNS-K-VOJTA'::text]));

ALTER TABLE public.therapist_certificates
  DROP CONSTRAINT IF EXISTS therapist_certificates_certificate_check;
ALTER TABLE public.therapist_certificates
  ADD CONSTRAINT therapist_certificates_certificate_check CHECK (certificate = ANY (ARRAY[
    'MT'::text, 'MLD'::text, 'KGG'::text,
    'ZNS-BOBATH'::text, 'ZNS-VOJTA'::text, 'ZNS-PNF'::text, 'ZNS-K-BOBATH'::text, 'ZNS-K-VOJTA'::text]));
