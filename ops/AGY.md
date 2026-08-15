# AGY.md - Operations & Finance Accounting Agent Configuration

## 1. Project Overview & Business Context
- **Business Owner:** Yavuz Kemal Demir
- **Business Type:** Kleingewerbe (Germany)
- **Accounting Method:** Einnahmen-Überschuss-Rechnung (EÜR) / Cash-basis accounting
- **Currency & Locale:** EUR (€), German formatting (`DD.MM.YYYY`, `1.234,56 €`)
- **System Purpose:** Fully automated invoice parsing via email, Google Drive PDF archiving, Supabase database tracking, and integration into the existing `ops` administrative dashboard for real-time expense monitoring and Anlage EÜR (Elster) tax filing preparation.

---

## 2. Critical Safety & Workspace Rules (Strict Isolation)
1. **Workspace Boundary:** 
   - Work strictly within the current `ops` directory. Never access, create, or alter files outside this directory.
2. **Preservation of Existing Code:**
   - **DO NOT delete, overwrite, rename, or break existing files** (e.g., `index.html`, `app.js`, `board.js`, `config.js`, existing SQL schema files).
   - All additions must be strictly additive and modular (e.g., dedicated files like `finance.js`, `finance_view.js`, `finance_schema.sql`, or isolated tab/module extensions inside the existing admin UI).
   - Do NOT drop, alter, or modify existing database tables in Supabase. Use dedicated, newly created tables with clear prefixing (`ops_finance_*`).
3. **Interactive Clarifications & AntiGravity MCP:**
   - If any API credentials, MCP configurations (n8n MCP, Supabase MCP, Google Drive tokens), webhook URLs, or structural details are missing or ambiguous, **prompt and ask the user directly in the terminal** before proceeding.

---

## 3. System Architecture & End-to-End Workflow

```
[Inbound Invoice Email]
         │
         ▼
[n8n Workflow (Local Docker + MCP)]
   ├── 1. IMAP / Mail Trigger (Watches dedicated inbox)
   ├── 2. Extract PDF attachment & sender metadata
   ├── 3. Upload & organize PDF into Google Drive (Store File ID & Web Link)
   ├── 4. AI Vision Agent (Gemini): Parse document into structured JSON
   └── 5. Supabase Node: Insert record into `ops_finance_expenses`
         │
         ▼
[Ops Dashboard Integration (Vercel / Subdomain)]
   ├── Real-time expense list & monthly/annual cash-out breakdown
   ├── Recurring subscriptions & fixed operational costs tracker
   ├── German Tax / Anlage EÜR category aggregation
   ├── Direct links to stored Google Drive invoice PDFs
   └── Export ready-to-file EÜR summary (CSV/JSON) for Elster filing
```

---

## 4. Database Schema (Supabase / PostgreSQL)

Create and use the following isolated table without touching any existing tables:

```sql
-- Dedicated expenses table for ops finance module
CREATE TABLE IF NOT EXISTS ops_finance_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invoice_date DATE NOT NULL,
    due_date DATE,
    vendor_name VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(100),
    description TEXT,
    currency VARCHAR(10) DEFAULT 'EUR',
    gross_amount NUMERIC(10, 2) NOT NULL,
    net_amount NUMERIC(10, 2),
    vat_rate NUMERIC(4, 2) DEFAULT 0.00, -- e.g. 0.00, 7.00, 19.00
    vat_amount NUMERIC(10, 2) DEFAULT 0.00,
    euer_category VARCHAR(100) NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_interval VARCHAR(50) DEFAULT 'none', -- 'monthly', 'yearly', 'quarterly', 'none'
    payment_method VARCHAR(50) DEFAULT 'bank_transfer', -- 'credit_card', 'paypal', 'bank_transfer', 'direct_debit'
    drive_file_id VARCHAR(255),
    drive_web_view_link TEXT,
    email_sender VARCHAR(255),
    email_subject TEXT,
    raw_ai_extraction JSONB,
    status VARCHAR(50) DEFAULT 'processed' -- 'processed', 'review_needed', 'archived'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ops_finance_date ON ops_finance_expenses(invoice_date);
CREATE INDEX IF NOT EXISTS idx_ops_finance_category ON ops_finance_expenses(euer_category);
CREATE INDEX IF NOT EXISTS idx_ops_finance_recurring ON ops_finance_expenses(is_recurring);
```

---

## 5. German Tax Compliance & Anlage EÜR Mapping
The AI Agent and n8n extractor must map every expense to one of the following German tax categories:

| Category Key | German Label | Description & Examples |
| :--- | :--- | :--- |
| `software_cloud` | **Software & Cloud-Dienste** | SaaS subscriptions, hosting, Vercel, Supabase, domains, AI tools, APIs |
| `telecom_internet` | **Telekommunikation & Internet** | Phone bills, mobile contracts, broadband operational share |
| `office_supplies` | **Büromaterial & Arbeitsmittel** | Stationery, toner, printer paper, small tools |
| `gwg_assets` | **GWG (Geringwertige Wirtschaftsgüter)** | Hardware & equipment (net price <= 800 €): keyboard, mouse, monitors, headphones |
| `travel_mobility` | **Reise- & Fahrtkosten** | Public transit tickets, Deutsche Bahn, client visit fuel/mileage |
| `education_training`| **Fortbildung & Fachliteratur** | Professional courses, technical books, certifications |
| `marketing_sales` | **Marketing & Vertrieb** | Online advertising (Google/Meta), promotions, flyers, branding |
| `bank_fees` | **Bank- & Nebenkosten des Geldverkehrs** | Account management fees, transaction fees, payment gateway cuts |
| `other_operational` | **Sonstige Betriebsausgaben** | Miscellaneous eligible business expenses |

---

## 6. AI Agent Invoice Parsing Contract (Structured JSON)
When Gemini processes an invoice document, it must output the exact JSON structure below:

```json
{
  "vendor_name": "Adobe Systems Software Ireland Ltd",
  "invoice_number": "IE12345678",
  "invoice_date": "2026-08-10",
  "due_date": "2026-08-20",
  "gross_amount": 19.99,
  "net_amount": 16.80,
  "vat_rate": 19.00,
  "vat_amount": 3.19,
  "currency": "EUR",
  "euer_category": "Software & Cloud-Dienste",
  "is_recurring": true,
  "recurring_interval": "monthly",
  "payment_method": "credit_card",
  "description_summary": "Monthly Creative Cloud All Apps Subscription",
  "confidence_score": 0.98,
  "needs_manual_review": false
}
```

---

## 7. Frontend Integration Guidelines for `ops`
- **Non-Destructive UI Mounting:**
  - Add a dedicated navigation item/tab: `Finanzen / EÜR` inside the existing navigation structure.
  - Implement the view inside a dedicated modular script (e.g., `js/finance.js` or component) loaded conditionally or registered into `app.js` without altering existing board logic.
- **Core Dashboard Features:**
  1. **KPI Summary Cards:** Current Month Total Spend, Projected Annual Spend, Active Subscriptions Count, Estimated Deductible VAT (Vorsteuer).
  2. **Anlage EÜR Cost Breakdown:** Visual bar/doughnut chart by tax category.
  3. **Transactions Table:** Fast search by vendor, filter by date range/category, toggle for recurring items, and direct "Rechnung öffnen" (Google Drive PDF) action buttons.
  4. **Elster Tax Export:** Single-click export button producing a categorized German tax year summary (CSV & JSON) formatted for direct entry into Elster.

---

## 8. AntiGravity Agent Execution Protocol
When the terminal AI coding agent starts:
1. **Analyze Existing Structure:** Read `index.html`, `config.js`, and `app.js` to detect existing coding patterns, styling conventions (Tailwind/CSS), and Supabase client initialization.
2. **Prompt for Missing Configs:** If Supabase keys, n8n webhook URLs, or Google Drive folder targets are not found in the environment/config, immediately prompt the user in the terminal.
3. **Incremental Implementation:**
   - Step 1: Create `finance_schema.sql` (if migrations are managed via file).
   - Step 2: Create `finance.js` module handling Supabase fetching, calculations, and UI rendering.
   - Step 3: Integrate the finance tab cleanly into the existing layout without modifying unrelated functionality.
   - Step 4: Validate n8n webhook payload compatibility.
