-- Fix: çalışanlar kendi working_hours kayıtlarını ekleyip güncelleyemiyordu
-- (sadece SELECT policy'si vardı, INSERT/UPDATE eksikti)

DROP POLICY IF EXISTS "working_hours_user_insert" ON working_hours;
DROP POLICY IF EXISTS "working_hours_user_update" ON working_hours;
DROP POLICY IF EXISTS "working_hours_user_modify" ON working_hours;

CREATE POLICY "working_hours_user_modify" ON working_hours
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
