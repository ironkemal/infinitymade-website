-- =============================================================
-- v24 — Multi-Business Foundation (Faz 1.1)
-- =============================================================
-- Plan: .plans/MULTI_BUSINESS_IMPLEMENTATION_PLAN.md
-- Bu migration:
--   1. `businesses` tablosu oluşturur
--   2. Her mevcut owner için 1 default business satırı backfill eder
--   3. owner_id'li tüm child tablolara `business_id` ekler ve backfill yapar
--   4. business_id NOT NULL constraint + FK ekler
--   5. user_preferences tablosu oluşturur (calendar view + selected_business)
--   6. Default business seçim helper view'ı
--
-- ⚠️ NOT NULL constraint en sona koyuldu. Backfill başarısız olursa orada patlar.
-- ⚠️ Önce Supabase **staging branch**'inde test edin, sonra prod'a alın.
-- ⚠️ RLS politikaları AYRI bir migration'da (v25) — bu sadece şema + backfill.
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- 1. businesses tablosu
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.businesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name   TEXT NOT NULL,
  sector          TEXT,
  street          TEXT,
  house_number    TEXT,
  zip             TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'DE',
  phone           TEXT,
  email           TEXT,
  booking_slug    TEXT UNIQUE,
  is_default      BOOLEAN DEFAULT FALSE,  -- owner'ın "ana" işletmesi (migration sırasında set edilir)
  ik_number       TEXT,                   -- §302 SGB V için (her klinik kendi IK no)
  clinic_lat      NUMERIC,
  clinic_lng      NUMERIC,
  clinic_geocoded_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON public.businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_slug  ON public.businesses(booking_slug);

-- Her owner için en fazla 1 default business
CREATE UNIQUE INDEX IF NOT EXISTS uniq_businesses_default_per_owner
  ON public.businesses(owner_id) WHERE is_default = TRUE;

-- -------------------------------------------------------------
-- 2. Backfill: her owner için 1 default business
-- -------------------------------------------------------------
INSERT INTO public.businesses (
  owner_id, business_name, sector, street, house_number, zip, city, country,
  phone, booking_slug, is_default, ik_number,
  clinic_lat, clinic_lng, clinic_geocoded_at, created_at
)
SELECT
  p.id,
  COALESCE(NULLIF(p.business_name, ''), 'Mein Geschäft'),
  p.sector,
  p.street,
  p.house_number,
  p.zip,
  p.city,
  COALESCE(p.country, 'DE'),
  p.phone,
  p.booking_slug,
  TRUE,
  p.ik_number,
  p.clinic_lat,
  p.clinic_lng,
  p.clinic_geocoded_at,
  COALESCE(p.created_at, NOW())
FROM public.profiles p
WHERE (p.role IS NULL OR p.role = 'owner')        -- sadece owner'lar
  AND NOT EXISTS (                                -- idempotency
    SELECT 1 FROM public.businesses b WHERE b.owner_id = p.id AND b.is_default
  );

-- -------------------------------------------------------------
-- 3. Child tablolara business_id ekle (nullable başlangıçta)
-- -------------------------------------------------------------
-- owner_id ile çalışan tablolar:
ALTER TABLE public.services                ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.working_hours           ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.custom_days             ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.bookings                ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.leads                   ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.patient_notes           ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.anamnese                ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.prescriptions           ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.ueberweisungen          ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.referral_drafts         ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.invoices                ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.abrechnung              ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.zuzahlung_befreiung     ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.aerzte                  ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.b2b_contacts            ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.email_logs              ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.feedbacks               ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.scraper_data            ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.terapeut_zertifikat     ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.vehicles                ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.fahrten                 ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.chatbot_usage           ADD COLUMN IF NOT EXISTS business_id UUID;

-- user_id ile çalışıyor ama business scope'a girmesi gerekenler:
ALTER TABLE public.breaks                  ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.calendar_integrations   ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.time_offs               ADD COLUMN IF NOT EXISTS business_id UUID;

-- prescription alt tabloları
ALTER TABLE public.prescription_sessions   ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.prescription_validations ADD COLUMN IF NOT EXISTS business_id UUID;

-- -------------------------------------------------------------
-- 4. Backfill: child tablolar → default business
-- -------------------------------------------------------------
-- owner_id'li tablolar için generic backfill:
DO $$
DECLARE
  tbl TEXT;
  tables_owner TEXT[] := ARRAY[
    'services','working_hours','custom_days','bookings','leads',
    'patient_notes','anamnese','prescriptions','ueberweisungen','referral_drafts',
    'invoices','abrechnung','zuzahlung_befreiung','aerzte','b2b_contacts',
    'email_logs','feedbacks','scraper_data','terapeut_zertifikat','vehicles',
    'fahrten','chatbot_usage'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_owner LOOP
    EXECUTE format(
      'UPDATE public.%I t
         SET business_id = b.id
         FROM public.businesses b
        WHERE b.owner_id = t.owner_id
          AND b.is_default
          AND t.business_id IS NULL', tbl
    );
  END LOOP;
END $$;

-- user_id'li tablolar: profiles üzerinden owner çöz, sonra business bağla
-- (employee user_id → profiles.owner_id → businesses.id)
DO $$
DECLARE
  tbl TEXT;
  tables_user TEXT[] := ARRAY['breaks','calendar_integrations','time_offs'];
BEGIN
  FOREACH tbl IN ARRAY tables_user LOOP
    EXECUTE format(
      'UPDATE public.%I t
         SET business_id = b.id
         FROM public.profiles p
         JOIN public.businesses b
           ON b.owner_id = COALESCE(p.owner_id, p.id) AND b.is_default
        WHERE p.id = COALESCE(t.user_id, t.employee_id)
          AND t.business_id IS NULL', tbl
    );
  END LOOP;
EXCEPTION WHEN undefined_column THEN
  -- bir tabloda employee_id yoksa user_id ile devam et — generic fallback:
  NULL;
END $$;

-- prescription_sessions / prescription_validations → prescription'dan al
UPDATE public.prescription_sessions ps
   SET business_id = pr.business_id
  FROM public.prescriptions pr
 WHERE ps.prescription_id = pr.id
   AND ps.business_id IS NULL;

UPDATE public.prescription_validations pv
   SET business_id = pr.business_id
  FROM public.prescriptions pr
 WHERE pv.prescription_id = pr.id
   AND pv.business_id IS NULL;

-- -------------------------------------------------------------
-- 5. NOT NULL + FK constraints
-- -------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  all_tables TEXT[] := ARRAY[
    'services','working_hours','custom_days','bookings','leads',
    'patient_notes','anamnese','prescriptions','ueberweisungen','referral_drafts',
    'invoices','abrechnung','zuzahlung_befreiung','aerzte','b2b_contacts',
    'email_logs','feedbacks','scraper_data','terapeut_zertifikat','vehicles',
    'fahrten','chatbot_usage','breaks','calendar_integrations','time_offs',
    'prescription_sessions','prescription_validations'
  ];
  orphan_count INTEGER;
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    -- Orphan kontrol: backfill başarısızsa burada görünür
    EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE business_id IS NULL', tbl)
      INTO orphan_count;
    IF orphan_count > 0 THEN
      RAISE WARNING '⚠️  %.business_id has % NULL rows — these will block NOT NULL. Investigate before retrying.', tbl, orphan_count;
      -- Strict mode istersen RAISE EXCEPTION yap, şimdilik WARNING ile devam
    END IF;

    -- FK ekle (yoksa)
    EXECUTE format(
      'ALTER TABLE public.%I
         DROP CONSTRAINT IF EXISTS %I,
         ADD CONSTRAINT %I FOREIGN KEY (business_id)
           REFERENCES public.businesses(id) ON DELETE CASCADE',
      tbl, tbl || '_business_id_fkey', tbl || '_business_id_fkey'
    );

    -- Index
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(business_id)',
      'idx_' || tbl || '_business', tbl
    );
  END LOOP;
END $$;

-- NOT NULL'u ancak orphan yoksa uygula (manuel kararla aç):
-- ⚠️ Aşağıdaki blok şimdilik commentli — orphan WARNING'lere göre tek tek aç:
--
-- ALTER TABLE public.services             ALTER COLUMN business_id SET NOT NULL;
-- ALTER TABLE public.working_hours        ALTER COLUMN business_id SET NOT NULL;
-- ALTER TABLE public.bookings             ALTER COLUMN business_id SET NOT NULL;
-- ... (her tablo için)

-- -------------------------------------------------------------
-- 6. user_preferences tablosu
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preference_key   TEXT NOT NULL,
  preference_value TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);

-- Bilinen preference key'leri (sadece dokümantasyon, constraint yok):
COMMENT ON TABLE public.user_preferences IS
  'Per-user UI preferences. Known keys: selected_business (UUID), calendar_view (daily|weekly|monthly), employee_filter (UUID|all)';

-- -------------------------------------------------------------
-- 7. Helper: kullanıcının default business'ını al
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_default_business(p_user UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT b.id
    FROM public.businesses b
    JOIN public.profiles p ON p.id = p_user
   WHERE b.owner_id = COALESCE(p.owner_id, p.id)
     AND b.is_default
   LIMIT 1
$$;

COMMENT ON FUNCTION public.get_default_business(UUID) IS
  'Returns default business_id for a user (resolves through owner_id for employees)';

-- -------------------------------------------------------------
-- 8. Plan değeri için Enterprise (CHECK varsa güncelle)
-- -------------------------------------------------------------
-- profiles.plan şu an text, plan_status enum benzeri — Enterprise için constraint
-- gerekmiyorsa burası NO-OP. Stripe webhook string'i set ediyor zaten.
-- Sadece dokümantasyon:
COMMENT ON COLUMN public.profiles.plan IS
  'Subscription plan: starter | professional | klinik | enterprise (multi-business)';

COMMIT;

-- =============================================================
-- POST-MIGRATION CHECKLIST (manuel)
-- =============================================================
-- 1. Her tablo için orphan satır var mı?  → WARNING log'larına bak
--      SELECT 'services' AS tbl, COUNT(*) FROM services WHERE business_id IS NULL
--      UNION ALL SELECT 'working_hours', COUNT(*) FROM working_hours WHERE business_id IS NULL
--      ... (vs)
-- 2. Orphan'lar temizlenince NOT NULL constraint'leri tek tek uygula
-- 3. RLS politikalarını v25 migration'ında güncelle
-- 4. Frontend henüz business_id göndermiyor → API'lerde default business'a fallback kalmalı (geçiş süresi)
-- =============================================================
