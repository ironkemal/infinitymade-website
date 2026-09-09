-- v28: Therapist Certificates (Qualifikationen)
-- Add specialized billing qualifications to services and therapist records (profiles)

-- Add required certificate column to services
ALTER TABLE public.services 
  ADD COLUMN IF NOT EXISTS required_certificate TEXT CHECK (required_certificate IN ('MT', 'MLD', 'KGG'));

-- Create table to map profiles/employees to certificates/qualifications
CREATE TABLE IF NOT EXISTS public.therapist_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  certificate TEXT NOT NULL CHECK (certificate IN ('MT', 'MLD', 'KGG')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(profile_id, certificate)
);

-- Enable RLS
ALTER TABLE public.therapist_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_certificates_select" ON public.therapist_certificates FOR SELECT
  USING (
    auth.uid() = owner_id
    OR auth.uid() = profile_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = therapist_certificates.owner_id)
  );

CREATE POLICY "therapist_certificates_insert" ON public.therapist_certificates FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id 
    OR auth.uid() = profile_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = therapist_certificates.owner_id)
  );

CREATE POLICY "therapist_certificates_delete" ON public.therapist_certificates FOR DELETE
  USING (
    auth.uid() = owner_id 
    OR auth.uid() = profile_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = therapist_certificates.owner_id)
  );
