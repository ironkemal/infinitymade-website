-- ==============================================
-- INFINITY V23 — fahrten.booking_id full UNIQUE constraint
-- 2026-05-22
--
-- v21'de partial unique index kullanılmıştı (WHERE booking_id IS NOT NULL).
-- PostgREST'in upsert(onConflict:'booking_id') partial index'le çalışmıyor:
--   ERROR 42P10: there is no unique or exclusion constraint matching the
--   ON CONFLICT specification
--
-- Sonuç: Fahrt Beenden akışı bookings'i 'fahrt_completed' state'ine geçiriyor
-- ama fahrten upsert sessizce başarısız oluyor → Fahrtenbuch boş kalıyor.
--
-- Çözüm: booking_id NOT NULL + full UNIQUE constraint. Her fahrten kaydı
-- bir booking'e bağlıdır (yasal Fahrtenbuch gereksinimi).
-- ==============================================

DROP INDEX IF EXISTS idx_fahrten_booking_uniq;

ALTER TABLE fahrten ALTER COLUMN booking_id SET NOT NULL;

ALTER TABLE fahrten ADD CONSTRAINT fahrten_booking_id_key UNIQUE (booking_id);

-- ON DELETE SET NULL artık NOT NULL ile çelişir → RESTRICT (yasal saklama)
ALTER TABLE fahrten DROP CONSTRAINT IF EXISTS fahrten_booking_id_fkey;
ALTER TABLE fahrten ADD CONSTRAINT fahrten_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
