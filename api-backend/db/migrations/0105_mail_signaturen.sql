-- Mail-Fußzeilen: strukturierte Owner-Einstellungen, keine Patientendaten.
-- SaaS: NICHT angewandt. Vor Veröffentlichung mit GO anwenden und Live-Dumps exportieren.
-- ZAEHLER: kolon +1; uebrige Zaehler unveraendert.
ALTER TABLE public.profiles ADD COLUMN mail_signatur_einstellungen jsonb NOT NULL
  DEFAULT '{"vorlagen":[],"standard_id":""}'::jsonb
  CONSTRAINT profiles_mail_signaturen_groesse CHECK (
    jsonb_typeof(mail_signatur_einstellungen) = 'object'
    AND COALESCE(jsonb_typeof(mail_signatur_einstellungen->'vorlagen') = 'array', false)
    AND jsonb_array_length(mail_signatur_einstellungen->'vorlagen') <= 10
    AND octet_length(mail_signatur_einstellungen::text) <= 80000
  );
COMMENT ON COLUMN public.profiles.mail_signatur_einstellungen IS
  'Strukturierte Mail-Fußzeilenvorlagen der Praxis: vorlagen[] und standard_id. Kein HTML; bestehende Owner-Profil-RLS.';
