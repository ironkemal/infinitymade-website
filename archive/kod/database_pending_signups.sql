-- Onboarding: temporary storage for signup data until Stripe checkout completes
-- The password column stores the plaintext password ONLY until the webhook
-- processes the checkout; it is deleted immediately after user creation.

CREATE TABLE IF NOT EXISTS pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  onboarding_data JSONB NOT NULL DEFAULT '{}',
  stripe_checkout_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup after 24 hours (optional safety net)
-- You can add a pg_cron job later if needed.

-- Disable RLS so service-role API can insert/delete freely
ALTER TABLE pending_signups DISABLE ROW LEVEL SECURITY;
