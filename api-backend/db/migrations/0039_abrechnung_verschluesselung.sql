-- §302-Echtbetrieb, Schritt 1.3 D (ABRECHNUNG_ECHTBETRIEB_PLAN.md) —
-- Persistenz des CMS-EnvelopedData-Verschlüsselungsergebnisses auf `abrechnung`.
--
-- SaaS: angewendet 22.09.2026, MCP.
--
-- FACHLICHER GRUND (O-131, Kaltprüfung 21.09.2026):
--   verarbeiteVerschluesselungsSchritt() (abrechnung.routes.js) erzeugte die
--   verschlüsselte Datei und gab das Ergebnis nur im HTTP-Response von
--   /upload-signed zurück — nirgends gespeichert. Nach einem Seiten-Reload
--   wusste niemand mehr, ob eine verschlüsselte Datei existiert; der Download-
--   Button (module/abrechnung-detail.js) bot deshalb ausschließlich die
--   UNVERSCHLÜSSELTE signierte Datei an, und ein Verschlüsselungsfehler
--   (fehlendes Zertifikat/Trust-Anchor) blieb dem Praxisinhaber unsichtbar.
--
-- SPALTENWAHL (db-ustasi 22.09.2026):
--   Fünf Spalten statt JSON — dasselbe Muster wie die bereits vorhandene
--   signed_*-Gruppe (signed_storage_path/signed_sha256/signed_at/
--   signed_by_cert_thumbprint), nicht eine vierte Schreibweise desselben
--   Konzepts. Kein separates `verschluesselt boolean` — das wäre eine zweite
--   Wahrheitsquelle für dieselbe Information wie `encrypted_storage_path
--   IS NOT NULL` und würde zwangsläufig auseinanderlaufen; der Zustand ist aus
--   den vier übrigen Spalten ableitbar:
--     path NULL + hinweis NULL  -> noch nicht versucht
--     path NULL + hinweis gesetzt -> versucht, fehlgeschlagen (Grund im Hinweis)
--     path gesetzt              -> erfolgreich (hinweis NULL)
--   `verschluesselt_fuer_fingerprint` hält den Fingerprint des zum
--   Verschlüsselungszeitpunkt genutzten Empfängerzertifikats
--   (empfaenger_zertifikate.fingerprint_sha256) — Annahmestellen-Zertifikate
--   rotieren; ohne diese Spalte ist "mit welchem Schlüssel wurde diese Datei
--   verschlüsselt, kann die Kasse sie noch öffnen" nach einer Rotation nicht
--   mehr beantwortbar. Gleicher Zweck wie signed_by_cert_thumbprint, nur für
--   den Empfänger statt den Absender.
--
-- SCHREIBREGEL (bindend für den Anwendungscode, nicht nur diese Migration):
--   Alle fünf Spalten werden bei JEDEM Lauf von upload-signed als EINE Gruppe
--   neu geschrieben — Erfolg füllt path/sha256/am/fingerprint und setzt
--   hinweis auf NULL, jeder Fehlschlag setzt path/sha256/am/fingerprint auf
--   NULL und schreibt den Hinweis. Grund: /upload-signed ist wiederholbar
--   (Storage-Upload läuft mit upsert:true). Würde bei einer erneuten Signierung
--   nur bei Erfolg geschrieben, bliebe nach einem fehlgeschlagenen zweiten Lauf
--   die verschlüsselte Datei des ERSTEN Laufs als scheinbar aktuell stehen,
--   obwohl sie zur neuen Signatur nicht mehr passt (encrypted_sha256 würde
--   nicht mehr zu signed_sha256 gehören).
--
-- RICHTIGSTELLUNG zu 0034 (abrechnung_uebermittlung.sql):
--   Dort steht, `abrechnung` sei durch einen GoBD-Festschreibungs-Trigger vor
--   nachträglichen UPDATEs geschützt. Das ist auf DB-Ebene nicht der Fall
--   (geprüft: nur `abrechnung_updated_at` und `trg_set_business_id` existieren
--   als Trigger auf dieser Tabelle) — die signed_*-Gruppe wird schon heute
--   nachträglich per UPDATE befüllt. Kein Handlungsbedarf hier, nur Vermerk
--   für die nächste Person, die aus diesem Satz schließt, eine neue Spalte
--   brauche zwingend eine eigene Tabelle.
--
-- SICHERHEIT & COMPLIANCE:
--   • Kein DSGVO-Eintrag nötig: `abrechnung` ist bewusst nicht in api/dsgvo.js
--     (§302/§304-Aufbewahrungspflicht), Pfad + SHA-256 + Fingerprint sind kein
--     Personenbezug.
--   • verschluesselung_hinweis darf laut PHI-Regel (Ö5) keinen Rohdateiinhalt
--     und keine Patientendaten enthalten — die heutigen Hinweistexte im Code
--     sind rein strukturell (z. B. "kein Verschlüsselungszertifikat vorhanden").
--   • Keine neue RLS-Policy nötig — die Spalten erben die Policy der Tabelle.
--
-- ZAEHLER: +0 Tabellen, +5 Spalten, +0 Policy, +0 Index, +0 Funktion, +0 Trigger.

ALTER TABLE public.abrechnung
  ADD COLUMN IF NOT EXISTS encrypted_storage_path text,
  ADD COLUMN IF NOT EXISTS encrypted_sha256 text,
  ADD COLUMN IF NOT EXISTS verschluesselt_am timestamptz,
  ADD COLUMN IF NOT EXISTS verschluesselt_fuer_fingerprint text,
  ADD COLUMN IF NOT EXISTS verschluesselung_hinweis text;

COMMENT ON COLUMN public.abrechnung.encrypted_storage_path IS
  'Storage-Pfad der CMS-EnvelopedData-Datei (.dta.enc.p7m). NULL = noch nicht verschlüsselt oder letzter Versuch fehlgeschlagen.';
COMMENT ON COLUMN public.abrechnung.encrypted_sha256 IS
  'SHA-256 der verschlüsselten Datei (verschluesselte Bytes, nicht die Signatur). Analog zu signed_sha256/dta_sha256.';
COMMENT ON COLUMN public.abrechnung.verschluesselt_am IS
  'Zeitstempel des letzten erfolgreichen Verschlüsselungslaufs. Analog zu signed_at.';
COMMENT ON COLUMN public.abrechnung.verschluesselt_fuer_fingerprint IS
  'SHA-256-Fingerprint des Empfängerzertifikats (empfaenger_zertifikate.fingerprint_sha256), mit dem diese Datei verschlüsselt wurde — nötig, um nach einer Zertifikatsrotation zu erkennen, mit welchem Schlüssel eine ältere Datei verschlüsselt ist.';
COMMENT ON COLUMN public.abrechnung.verschluesselung_hinweis IS
  'Klartext-Status/Fehlermeldung des letzten Verschlüsselungsversuchs für die UI (NULL bei Erfolg). Darf laut Ö5 keine Patientendaten enthalten.';
