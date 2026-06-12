-- Migration v30: GKV vs Privat Ayrımı — Temel DB Değişiklikleri
-- 2026-06-12
-- Sprint 1 of the GKV/Privat billing split implementation.

-- 1. leads: hasta sigorta tipi
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS insurance_type TEXT
    CHECK (insurance_type IN ('gkv', 'privat'));

COMMENT ON COLUMN leads.insurance_type IS
  'gkv = gesetzlich versichert (fixed tariff prices), privat = privatversichert (practice-set prices)';

-- 2. services: GKV Positionsnummer bağlantısı
--    gkv_position_nr: physio_positions.js'deki x kodu (ör: X0501, X1201)
--    Bu alandan heilmittel_tarif'e join yapılarak GKV fiyatı çekilir.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS gkv_position_nr TEXT;

COMMENT ON COLUMN services.gkv_position_nr IS
  'Positionsnummer aus §125 SGB V Bundesvertrag (z.B. X0501=KG, X1201=MT). Links to heilmittel_tarif.';

-- 3. invoices: fatura tipi
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type TEXT
    CHECK (invoice_type IN ('gkv', 'privat'));

COMMENT ON COLUMN invoices.invoice_type IS
  'gkv = GKV Abrechnung (fixed tariff + Zuzahlung), privat = Privatrechnung (practice prices, no Zuzahlung)';

-- 4. Index: leads insurance_type
CREATE INDEX IF NOT EXISTS idx_leads_insurance_type
  ON leads (insurance_type)
  WHERE insurance_type IS NOT NULL;

-- 5. Index: invoice_type + owner
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type
  ON invoices (owner_id, invoice_type)
  WHERE invoice_type IS NOT NULL;
