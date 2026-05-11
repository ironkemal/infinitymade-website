-- Sector-based dashboard additions (Physiotherapy)
-- 2026-05-11

-- Patient notes for physiotherapy practices (doctor notes, therapist notes, AI summary)
CREATE TABLE patient_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  doctor_notes TEXT,
  therapist_notes TEXT,
  ai_summary TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, lead_id)
);

ALTER TABLE patient_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON patient_notes FOR ALL USING (auth.uid() = owner_id);

-- Note: profiles.sector already exists (added during onboarding flow).
-- Valid sectors: barber, beauty, nails, tattoo, spa, massage, physiotherapy, gym, other
