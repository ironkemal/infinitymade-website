-- ============================================================================
--  Praxura Ops-Dashboard — Finance & EÜR Schema (German Tax & GoBD Compliant)
--  Einzelunternehmen Yavuz Kemal Demir
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops_finance_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- GoBD Document & Archival Integrity
    document_id VARCHAR(100),
    original_filename VARCHAR(255),
    original_file_hash VARCHAR(128),
    drive_file_id VARCHAR(255),
    drive_web_view_link TEXT,
    email_sender VARCHAR(255),
    email_subject TEXT,
    raw_ai_extraction JSONB,

    -- Cash-basis Accounting Dates (§ 11 EStG)
    invoice_date DATE NOT NULL,
    service_date DATE,
    due_date DATE,
    payment_date DATE,

    -- Vendor / B2B Information
    vendor_name VARCHAR(255) NOT NULL,
    vendor_country VARCHAR(10) NOT NULL DEFAULT 'DE',
    vendor_vat_id VARCHAR(50),
    invoice_number VARCHAR(100),
    description TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0000,

    -- Financial Amounts & German Tax / Vorsteuer
    gross_amount NUMERIC(10, 2) NOT NULL,
    net_amount NUMERIC(10, 2) NOT NULL,
    vat_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    input_vat_eligible BOOLEAN NOT NULL DEFAULT TRUE,

    -- Reverse-Charge (§ 13b UStG / B2B International)
    reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
    reverse_charge_reason VARCHAR(255),
    output_vat_13b NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    input_vat_13b NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

    -- Tax Category & Anlage EÜR Mapping
    tax_category VARCHAR(100) NOT NULL DEFAULT 'software_cloud',
    euer_category VARCHAR(100) NOT NULL DEFAULT 'software_cloud',
    euer_mapping_version VARCHAR(20) NOT NULL DEFAULT '2026',
    vat_treatment VARCHAR(50) NOT NULL DEFAULT 'standard',
    is_deductible BOOLEAN NOT NULL DEFAULT TRUE, -- false for private expenses

    -- Fixed / Subscription Heuristics
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_interval VARCHAR(50) NOT NULL DEFAULT 'none',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',

    -- Payer & Attribution (Einzelunternehmen Kemal vs. Melih Private)
    payer_type VARCHAR(50) NOT NULL DEFAULT 'business_account', -- business_account, kemal_private, melih_private, other
    paid_by VARCHAR(50) NOT NULL DEFAULT 'kemal',
    person_role VARCHAR(50) NOT NULL DEFAULT 'owner',
    business_use_pct NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    private_use_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,

    -- Asset / GWG / AfA Treatment
    asset_treatment VARCHAR(50) NOT NULL DEFAULT 'none', -- none, gwg, afa_digital, afa_linear
    useful_life_months INT NOT NULL DEFAULT 0,

    -- Audit, Validation & Review Trail
    status VARCHAR(50) NOT NULL DEFAULT 'processed', -- processed, review_needed, archived
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    change_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES ops_members(id) ON DELETE SET NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ops_finance_date ON ops_finance_expenses(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_finance_paydate ON ops_finance_expenses(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_finance_category ON ops_finance_expenses(tax_category);
CREATE INDEX IF NOT EXISTS idx_ops_finance_deductible ON ops_finance_expenses(is_deductible);
CREATE INDEX IF NOT EXISTS idx_ops_finance_rc ON ops_finance_expenses(reverse_charge);
CREATE INDEX IF NOT EXISTS idx_ops_finance_payer ON ops_finance_expenses(payer_type);

-- Automatic updated_at trigger
DROP TRIGGER IF EXISTS ops_finance_expenses_touch ON ops_finance_expenses;
CREATE TRIGGER ops_finance_expenses_touch
  BEFORE UPDATE ON ops_finance_expenses
  FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

-- RLS (Row Level Security)
ALTER TABLE ops_finance_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ops_finance_expenses_member_all ON ops_finance_expenses;
CREATE POLICY ops_finance_expenses_member_all ON ops_finance_expenses
  FOR ALL TO authenticated
  USING (ops_is_member()) WITH CHECK (ops_is_member());

-- Realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ops_finance_expenses;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
