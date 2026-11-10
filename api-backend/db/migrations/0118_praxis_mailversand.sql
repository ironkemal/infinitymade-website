-- 0118_praxis_mailversand.sql — Postfach der Praxis fuer Patientenmails (AUFTRAG-MAILVERSAND, Kemal 09.11.2026).
--
-- WAS: neue Tabelle praxis_mailversand (eine Zeile je Inhaber): SMTP-Zugang aus Einstellungen → E-Mail-Versand,
--      Passwort AES-256-GCM-verschluesselt (api-backend/lib/phi-encrypt.js, bytea im Hex-Eingabeformat),
--      Verbindungsstatus + letzter Test. Trigger set_updated_at (Muster profiles_updated_at).
-- WARUM: Mail wird nicht mehr bei der Installation gefragt, sondern spaeter optional in der Oberflaeche verbunden.
--      Ein Ort fuer alle Absender (lib/mail.js mailKanal: Einstellung → SMTP_* → kein). NICHT in profiles:
--      der Inhaber liest seine Profilzeile im Browser, das Passwort ginge mit (guvenlik S-42). db-ustasi 09.11.2026.
-- Spalten: smtp_passwort / oauth_refresh_token enden auf _passwort/_token → dsgvo/export.js GEHEIM maskiert sie
--      in der Auskunft. modus 'microsoft_oauth' + oauth_refresh_token sind fuer Phase 2 (Geraetecode) schon da,
--      damit die keine neue Migration braucht; 'gmail_oauth' nur SaaS (Token bleibt in Vault, get/set/clear_gmail_token).
-- Zugriff: RLS an, KEINE Policy, keine Rechte fuer anon/authenticated — nur api-backend/routes/mailversand.js
--      (service_role). Muster 0114. Loeschung: dsgvo/loeschen.js loescht explizit (profiles wird nur anonymisiert,
--      die CASCADE greift bei der DSGVO-Loeschung nie).
-- Expand-only (K4): neue Tabelle, :stable kennt sie nicht und liest sie nicht; lib/mail.js behandelt eine fehlende
--      Tabelle wie "keine Einstellung".
-- ZAEHLER: tablo +1, index +1 (PK), trigger +1, fonksiyon +0, rls_policy +0 (RLS an, keine Policy).
-- SaaS: angewandt 10.11.2026, Supabase Management-API (Melih GO 10.11., BEGIN/COMMIT, Ledger 20261110153600, Katalog geprueft:
--      RLS an, 0 Policies, Rechte nur service_role + Eigentuemer, 16 Spalten, 1 Trigger, 1 Index).

CREATE TABLE public.praxis_mailversand (
  owner_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  modus               text NOT NULL DEFAULT 'aus' CHECK (modus IN ('aus', 'smtp', 'gmail_oauth', 'microsoft_oauth')),
  preset              text CHECK (preset IS NULL OR preset ~ '^[a-z0-9_]{1,32}$'),
  smtp_host           text CHECK (smtp_host IS NULL OR length(smtp_host) <= 253),
  smtp_port           integer CHECK (smtp_port IS NULL OR smtp_port BETWEEN 1 AND 65535),
  smtp_sicherheit     text CHECK (smtp_sicherheit IS NULL OR smtp_sicherheit IN ('ssl', 'starttls')),
  smtp_benutzer       text CHECK (smtp_benutzer IS NULL OR length(smtp_benutzer) <= 254),
  smtp_passwort       bytea,
  oauth_refresh_token bytea,
  absender_email      text CHECK (absender_email IS NULL OR length(absender_email) <= 254),
  absender_name       text CHECK (absender_name IS NULL OR length(absender_name) <= 120),
  status              text NOT NULL DEFAULT 'nicht_eingerichtet' CHECK (status IN ('nicht_eingerichtet', 'verbunden', 'unterbrochen')),
  letzter_test_at     timestamptz,
  letzter_test_ok     boolean,
  -- Nur nodemailer-Codes (EAUTH, ETIMEDOUT …) — nie die Rohmeldung des Mailservers (kann Adressen enthalten).
  letzter_fehler_code text CHECK (letzter_fehler_code IS NULL OR letzter_fehler_code ~ '^[A-Za-z0-9_]{1,64}$'),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (modus <> 'smtp' OR (smtp_host IS NOT NULL AND smtp_port IS NOT NULL AND smtp_sicherheit IS NOT NULL AND smtp_passwort IS NOT NULL))
);
COMMENT ON TABLE public.praxis_mailversand IS
  $$Postfach der Praxis (0118, Einstellungen → E-Mail-Versand). Passwort/Token verschluesselt, nur service_role. Kein Mailinhalt, keine Empfaenger.$$;
ALTER TABLE public.praxis_mailversand ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.praxis_mailversand FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.praxis_mailversand TO service_role;

CREATE TRIGGER praxis_mailversand_updated_at BEFORE UPDATE ON public.praxis_mailversand
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
