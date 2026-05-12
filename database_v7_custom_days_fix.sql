-- Fix: custom_days tablosunda user_id kalmisti, upsert onConflict: owner_id,date calismiyordu
ALTER TABLE custom_days DROP COLUMN IF EXISTS user_id;
DROP INDEX IF EXISTS custom_days_owner_id_date_idx;
ALTER TABLE custom_days ADD CONSTRAINT custom_days_owner_id_date_key UNIQUE (owner_id, date);
