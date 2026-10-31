-- Fax = Fax-to-Mail (onprem O-231): Die Praxis hinterlegt das Adressmuster ihres Fax-Providers,
-- z. B. "{nummer}@fax.provider.de". Versand nur ueber die eigene SMTP-Anbindung der Box.
-- :stable/:beta-sicher: eine nullable Spalte.
-- SaaS: angewandt 31.10.2026, MCP.
-- ZAEHLER: alles 0 (nullable Spalte + CHECK).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fax_mail_muster text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_fax_mail_muster_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_fax_mail_muster_check CHECK (
  fax_mail_muster IS NULL OR (
    length(fax_mail_muster) <= 200
    AND fax_mail_muster ~ '^[A-Za-z0-9._+-]*\{nummer\}[A-Za-z0-9._+-]*@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$'
  )
);
COMMENT ON COLUMN public.profiles.fax_mail_muster IS 'Fax-to-Mail Adressmuster mit genau einem {nummer}-Platzhalter vor dem @ (O-231).';
