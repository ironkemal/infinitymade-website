-- ============================================================================
--  Praxura Ops-Dashboard — Finance, EÜR & GoBD Schema v2.0
--  Einzelunternehmen Yavuz Kemal Demir (EÜR nach § 4 Abs. 3 EStG)
-- ============================================================================

-- ── 1. Haupt-Transaktionsregister ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_finance_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- GoBD Belegintegrität & Archivierung
    document_id VARCHAR(100),
    document_type VARCHAR(50) NOT NULL DEFAULT 'invoice', -- invoice, credit_note, cancellation, corrected_invoice, receipt
    ref_document_id UUID REFERENCES ops_finance_expenses(id) ON DELETE SET NULL,
    original_filename VARCHAR(255),
    original_file_hash VARCHAR(128),
    drive_file_id VARCHAR(255),
    drive_web_view_link TEXT,
    email_sender VARCHAR(255),
    email_subject TEXT,
    raw_ai_extraction JSONB,

    -- Duplikatkontrolle
    duplicate_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    duplicate_of_id UUID REFERENCES ops_finance_expenses(id) ON DELETE SET NULL,

    -- Datumsfelder für Zufluss-/Abflussprinzip (§ 11 EStG)
    invoice_date DATE NOT NULL,
    service_date DATE,
    due_date DATE,
    payment_date DATE,
    cash_flow_date DATE,
    tax_year VARCHAR(4) NOT NULL DEFAULT '2026',
    year_end_rule_checked BOOLEAN NOT NULL DEFAULT FALSE,

    -- Lieferanten & B2B Ausland
    vendor_name VARCHAR(255) NOT NULL,
    vendor_country VARCHAR(10) NOT NULL DEFAULT 'DE',
    vendor_vat_id VARCHAR(50),
    invoice_number VARCHAR(100),
    description TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    original_amount NUMERIC(10, 2),
    original_currency VARCHAR(10) DEFAULT 'EUR',
    exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0000,
    exchange_rate_date DATE,
    exchange_rate_source VARCHAR(50) DEFAULT 'ECB',

    -- Beträge & Steuersätze (Rechnungs-USt getrennt von § 13b)
    gross_amount NUMERIC(10, 2) NOT NULL,
    net_amount NUMERIC(10, 2) NOT NULL,
    vat_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    invoice_vat_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    invoice_vat_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    input_vat_eligible BOOLEAN NOT NULL DEFAULT TRUE,

    -- Reverse-Charge (§ 13b UStG / EU & Drittland B2B)
    reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
    reverse_charge_tax_rate NUMERIC(4, 2) NOT NULL DEFAULT 19.00,
    reverse_charge_tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    reverse_charge_input_vat_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    reverse_charge_reason VARCHAR(255),

    -- Steuerkategorie & Anlage EÜR Mapping
    tax_category VARCHAR(100) NOT NULL DEFAULT 'software_cloud',
    euer_category VARCHAR(100) NOT NULL DEFAULT 'software_cloud',
    euer_mapping_version VARCHAR(20) NOT NULL DEFAULT '2026',
    tax_form_year VARCHAR(4) NOT NULL DEFAULT '2026',
    euer_line VARCHAR(50),
    euer_kennzahl VARCHAR(50),
    vat_treatment VARCHAR(50) NOT NULL DEFAULT 'standard',
    
    -- Abzugsfähigkeit & Bewirtung (§ 4 Abs. 5 EStG)
    is_deductible BOOLEAN NOT NULL DEFAULT TRUE,
    deductible_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    deductibility_reason TEXT,

    -- Wirtschaftlicher Zweck vs. Mittelherkunft (Kemal privat ≠ Privatentnahme)
    economic_purpose VARCHAR(50) NOT NULL DEFAULT 'business', -- business, private, mixed
    funding_source VARCHAR(50) NOT NULL DEFAULT 'business_account', -- business_account, kemal_private, melih_private, other
    economic_classification VARCHAR(50) NOT NULL DEFAULT 'business_expense', -- business_expense, private_expense, private_contribution, private_withdrawal, business_income
    payer_type VARCHAR(50) NOT NULL DEFAULT 'business_account',
    paid_by VARCHAR(50) NOT NULL DEFAULT 'kemal',
    person_role VARCHAR(50) NOT NULL DEFAULT 'owner',
    business_use_pct NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    private_use_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,

    -- Anlagevermögen / GWG / AfA
    asset_treatment VARCHAR(50) NOT NULL DEFAULT 'none', -- none, gwg, afa_digital, afa_linear, asset_acquisition
    asset_type VARCHAR(100),
    immediate_depreciation_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    useful_life_months INT NOT NULL DEFAULT 0,

    -- Abonnements / Fixkosten
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_interval VARCHAR(50) NOT NULL DEFAULT 'none',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',

    -- Audit, Prüfstatus & Review Codes
    status VARCHAR(50) NOT NULL DEFAULT 'processed', -- processed, review_needed, archived
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason TEXT,
    review_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    change_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES ops_members(id) ON DELETE SET NULL
);

-- ── 2. GoBD Audit Log / Änderungsprotokoll ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_finance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID REFERENCES ops_finance_expenses(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- ocr_extracted, manual_edit, status_change, storno, duplicate_flagged
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES ops_members(id) ON DELETE SET NULL,
    changed_by_name VARCHAR(100),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_reason TEXT,
    source VARCHAR(50) NOT NULL DEFAULT 'user' -- ocr, user, system, n8n
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ops_finance_date ON ops_finance_expenses(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_finance_paydate ON ops_finance_expenses(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_finance_category ON ops_finance_expenses(tax_category);
CREATE INDEX IF NOT EXISTS idx_ops_finance_deductible ON ops_finance_expenses(is_deductible);
CREATE INDEX IF NOT EXISTS idx_ops_finance_rc ON ops_finance_expenses(reverse_charge);
CREATE INDEX IF NOT EXISTS idx_ops_finance_payer ON ops_finance_expenses(payer_type);
CREATE INDEX IF NOT EXISTS idx_ops_audit_expense ON ops_finance_audit_log(expense_id);
CREATE INDEX IF NOT EXISTS idx_ops_audit_time ON ops_finance_audit_log(changed_at DESC);

-- Automatic updated_at trigger
DROP TRIGGER IF EXISTS ops_finance_expenses_touch ON ops_finance_expenses;
CREATE TRIGGER ops_finance_expenses_touch
  BEFORE UPDATE ON ops_finance_expenses
  FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

-- RLS (Row Level Security)
ALTER TABLE ops_finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_finance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ops_finance_expenses_member_all ON ops_finance_expenses;
CREATE POLICY ops_finance_expenses_member_all ON ops_finance_expenses
  FOR ALL TO authenticated
  USING (ops_is_member()) WITH CHECK (ops_is_member());

DROP POLICY IF EXISTS ops_finance_audit_member_all ON ops_finance_audit_log;
CREATE POLICY ops_finance_audit_member_all ON ops_finance_audit_log
  FOR ALL TO authenticated
  USING (ops_is_member()) WITH CHECK (ops_is_member());

-- Realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ops_finance_expenses;
  ALTER PUBLICATION supabase_realtime ADD TABLE ops_finance_audit_log;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
