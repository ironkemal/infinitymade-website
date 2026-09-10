-- Migration: Add owner_id to working_hours + custom_days and fix RLS for owner-managed teams

-- 1. WORKING_HOURS: add owner_id column
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users;

-- Backfill owner_id from user_id (owner = user_id for existing records)
UPDATE working_hours SET owner_id = user_id WHERE owner_id IS NULL;

-- 2. CUSTOM_DAYS: add owner_id column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_days' AND column_name = 'owner_id') THEN
    ALTER TABLE custom_days ADD COLUMN owner_id UUID REFERENCES auth.users;
    UPDATE custom_days SET owner_id = user_id WHERE owner_id IS NULL;
  END IF;
END $$;

-- 3. Drop old restrictive RLS policies on working_hours
DROP POLICY IF EXISTS "Kullanıcılar kendi saatlerini yönetebilir" ON working_hours;

-- 4. New working_hours policies: user sees own, owner sees + manages team
CREATE POLICY "working_hours_user_access" ON working_hours FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "working_hours_owner_select" ON working_hours FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "working_hours_owner_modify" ON working_hours FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

-- 5. Update RLS on custom_days if needed
DROP POLICY IF EXISTS "Kullanıcılar kendi günlerini yönetebilir" ON custom_days;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'custom_days') THEN
    CREATE POLICY IF NOT EXISTS "custom_days_user_access" ON custom_days FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY IF NOT EXISTS "custom_days_owner_select" ON custom_days FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
    );
    CREATE POLICY IF NOT EXISTS "custom_days_owner_modify" ON custom_days FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
    );
  END IF;
END $$;
