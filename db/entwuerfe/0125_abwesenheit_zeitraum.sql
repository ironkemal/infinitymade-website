-- Prüft neue und geänderte Einträge. Historische Einträge bleiben erhalten.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.time_offs'::regclass AND conname = 'time_offs_zeitraum') THEN
    ALTER TABLE public.time_offs ADD CONSTRAINT time_offs_zeitraum CHECK (end_date >= start_date) NOT VALID;
  END IF;
END;
$$;
