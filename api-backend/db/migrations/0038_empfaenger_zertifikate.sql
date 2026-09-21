-- §302-Echtbetrieb, Schritt 1.3 C (ABRECHNUNG_ECHTBETRIEB_PLAN.md) —
-- Öffentliche X.509-Verschlüsselungszertifikate der Annahmestellen (Empfänger)
-- als globale Referenztabelle.
--
-- FACHLICHER GRUND (GGT Anlage 16 §5.1, SECON):
--   Die Verschlüsselung der §302-Nutzdaten als CMS EnvelopedData erfolgt mit dem
--   öffentlichen Schlüssel der zuständigen Datenannahmestelle (Verknüpfungsart 02/03).
--   Im Gegensatz zu `terapeut_zertifikat` (das Metadaten des eigenen Absender-
--   Signaturschlüssels hält) werden hier die echten X.509-Zertifikate (DER-Bytes)
--   der Annahmestellen gespeichert.
--   Es handelt sich um reine Referenzdaten ohne Personenbezug (kein Mandantenfilter,
--   kein owner_id, gleiches Muster wie `kostentraeger_anschriften`).
--
-- FUNDSTELLEN:
--   • GGT Anlage 16 (Security-Schnittstelle SECON), Stand 02.09.2025, gültig ab 01.01.2026:
--     Kapitel 2.1.4 (RSAES-OAEP 4096 Bit), Kapitel 3.2.2 (EnvelopedData),
--     Kapitel 4.6 (Schlüsselverzeichnisse / Annahmeliste).
--   • Richtlinien nach § 302 Abs. 2 SGB V: Datenannahmestellen-Identifikation über IK.
--
-- SICHERHEIT & COMPLIANCE:
--   • RLS ist aktiv: Authentifizierte Nutzer dürfen nur LESEN (SELECT).
--   • Schreibrechte (INSERT / UPDATE) ausschließlich über service_role (Admin-Ladescript).
--   • Kein öffentlicher HTTP-Upload-Endpunkt (G8-Regel).
--   • Nicht in `api/dsgvo.js` — öffentliche Institutions-Zertifikate ohne Personenbezug.
--
-- ZAEHLER: +1 Tabelle, +1 Policy, +1 Index (Primaerschluessel), +0 Funktion, +0 Trigger.

CREATE TABLE public.empfaenger_zertifikate (
  ik                text NOT NULL PRIMARY KEY,
  zertifikat_der    bytea NOT NULL,
  fingerprint_sha256 text NOT NULL,
  gueltig_von       date NOT NULL,
  gueltig_bis       date NOT NULL,
  quelle            text NOT NULL,
  quelle_datum      date NOT NULL,
  onaylayan         text NOT NULL,
  hochgeladen_am    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.empfaenger_zertifikate IS
  'Öffentliche X.509-Verschlüsselungszertifikate der Annahmestellen (ITSG/GKV) zur Erzeugung von CMS EnvelopedData (§302 SECON). Globale Referenztabelle wie kostentraeger_anschriften; Befüllung nur per Admin-Ladescript.';
COMMENT ON COLUMN public.empfaenger_zertifikate.ik IS
  'Institutionskennzeichen (IK) der Datenannahmestelle (9-stellig).';
COMMENT ON COLUMN public.empfaenger_zertifikate.zertifikat_der IS
  'Vollständiges X.509v3-Zertifikat in binärer DER-Kodierung.';
COMMENT ON COLUMN public.empfaenger_zertifikate.fingerprint_sha256 IS
  'SHA-256-Fingerprint des DER-Zertifikats (hexadezimal, mit ITSG-Veröffentlichung abgeglichen).';
COMMENT ON COLUMN public.empfaenger_zertifikate.gueltig_von IS
  'Gültigkeitsbeginn des Zertifikats (notBefore).';
COMMENT ON COLUMN public.empfaenger_zertifikate.gueltig_bis IS
  'Gültigkeitsende des Zertifikats (notAfter).';
COMMENT ON COLUMN public.empfaenger_zertifikate.quelle IS
  'Herkunftsnachweis (z. B. ITSG Trust Center Annahmeliste annahme-rsa4096.key).';
COMMENT ON COLUMN public.empfaenger_zertifikate.quelle_datum IS
  'Datum des Abgleichs bzw. der Veröffentlichung der Quelle.';
COMMENT ON COLUMN public.empfaenger_zertifikate.onaylayan IS
  'Signaturprüfer / Administrator-Pseudonym (CLAUDE.md: keine Personennamen, nur Rollen-/Kürzel).';
COMMENT ON COLUMN public.empfaenger_zertifikate.hochgeladen_am IS
  'Zeitstempel des Datenbank-Imports.';

ALTER TABLE public.empfaenger_zertifikate ENABLE ROW LEVEL SECURITY;

CREATE POLICY empfaenger_zertifikate_read_all ON public.empfaenger_zertifikate
  FOR SELECT USING (auth.role() = 'authenticated');
