-- ============================================================================
--  Praxura Ops-Dashboard — Finance & EÜR Schema
--  Ayrı Supabase projesinde çalışır (praxura-ops / farkaejociddtgqkusvm).
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops_finance_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    invoice_date DATE NOT NULL,
    due_date DATE,
    vendor_name VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(100),
    description TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    gross_amount NUMERIC(10, 2) NOT NULL,
    net_amount NUMERIC(10, 2),
    vat_rate NUMERIC(4, 2) DEFAULT 0.00, -- 0.00, 7.00, 19.00
    vat_amount NUMERIC(10, 2) DEFAULT 0.00,
    euer_category VARCHAR(100) NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_interval VARCHAR(50) NOT NULL DEFAULT 'none', -- 'monthly', 'yearly', 'quarterly', 'none'
    payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer', -- 'credit_card', 'paypal', 'bank_transfer', 'direct_debit'
    drive_file_id VARCHAR(255),
    drive_web_view_link TEXT,
    email_sender VARCHAR(255),
    email_subject TEXT,
    raw_ai_extraction JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'processed', -- 'processed', 'review_needed', 'archived'
    created_by UUID REFERENCES ops_members(id) ON DELETE SET NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ops_finance_date ON ops_finance_expenses(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_finance_category ON ops_finance_expenses(euer_category);
CREATE INDEX IF NOT EXISTS idx_ops_finance_recurring ON ops_finance_expenses(is_recurring);
CREATE INDEX IF NOT EXISTS idx_ops_finance_vendor ON ops_finance_expenses(vendor_name);
CREATE INDEX IF NOT EXISTS idx_ops_finance_status ON ops_finance_expenses(status);

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
