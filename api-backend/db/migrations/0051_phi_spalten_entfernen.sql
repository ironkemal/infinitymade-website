-- zweistufig: Schritt 1 = e9d0286 (30.09.2026, Schreiben eingestellt) + 0049/0050 (Trigger-Bezug weg, Inhalte leer); sicher, weil kein laufendes Image die Spalten mehr schreibt (SaaS seit e9d0286 aktualisiert, keine Kundenbox — onprem + Kemal 01.10.2026).
-- Reform 3.12 Schritt (c) — ungenutzte Verschluesselungs-Spalten entfernen.
--
-- WARUM: Feldverschluesselung aufgegeben (Reform 3.12, guvenlik + db-ustasi +
--   legal-de 30.09.2026; Code e9d0286 schreibt/liest die Spalten nicht mehr).
--   grep 01.10.2026 ueber api-backend, module, Root-*.js, api/, supabase/functions:
--   nur Kommentare und Negativtests. Einziger DB-Bezug war
--   prescriptions_festschreibung() → in 0049 entfernt. Inhalte seit 0050 leer
--   (leads.*_enc waren nie befuellt). api/dsgvo.js liest prescriptions/leads mit
--   `*`, nennt keine dieser Spalten.
--
-- KURAL 4 (:beta/:stable, zwei Schritte): Schritt 1 = e9d0286 (Schreiben
--   eingestellt) + 0049/0050; dies ist Schritt 2. onprem 01.10.2026: zulaessig,
--   sobald kein laufendes Image die Spalten noch schreibt — SaaS-VPS hat seit
--   e9d0286 mehrfach neue Images gezogen (u. a. 2284323, 37b8f51); Kemal
--   01.10.2026: „Kurulu müşteri kutusu yok" → kein :stable-Kasten betroffen.
--
-- SaaS: angewandt 01.10.2026, MCP (Freigabe Kemal 01.10.2026: „Reform 3.12 c
--   migration'ını (0051, sütun ve index silme) yaz ve canlıya uygula").
-- ZAEHLER: index −2 (idx_prescriptions_phi_not_encrypted,
--   idx_leads_pii_not_encrypted, beide aus 0000_baseline). Spalten zaehlt kein
--   Zaehler.

DROP INDEX IF EXISTS public.idx_prescriptions_phi_not_encrypted;
DROP INDEX IF EXISTS public.idx_leads_pii_not_encrypted;

ALTER TABLE public.prescriptions
  DROP COLUMN IF EXISTS ocr_raw_response,
  DROP COLUMN IF EXISTS ocr_raw_enc,
  DROP COLUMN IF EXISTS icd10_enc,
  DROP COLUMN IF EXISTS phi_encrypted;

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS first_name_enc,
  DROP COLUMN IF EXISTS last_name_enc,
  DROP COLUMN IF EXISTS phone_enc,
  DROP COLUMN IF EXISTS geburtsdatum_enc,
  DROP COLUMN IF EXISTS versichertennummer_enc,
  DROP COLUMN IF EXISTS krankenkasse_enc,
  DROP COLUMN IF EXISTS pii_encrypted;
