-- v25: AVV + AGB consent log (DSGVO Art. 28 / TTDSG audit trail)
-- Every onboarding completion writes one row with IP + timestamp + version.
-- Required for legal proof that customer accepted DPA before processing began.

create table if not exists public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  pending_id uuid,                          -- if accepted before signup completed
  consent_type text not null,               -- 'agb' | 'avv' | 'datenschutz' | 'widerruf'
  version text not null,                    -- doc version, e.g. '2026-05-23'
  ip_address inet,
  user_agent text,
  accepted_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists consent_log_user_idx on public.consent_log(user_id);
create index if not exists consent_log_pending_idx on public.consent_log(pending_id);

-- RLS: only service_role writes; owners can read their own consents (DSAR)
alter table public.consent_log enable row level security;

drop policy if exists "users read own consents" on public.consent_log;
create policy "users read own consents" on public.consent_log
  for select using (auth.uid() = user_id);

-- Add aggregate flags to profiles for fast lookup
alter table public.profiles
  add column if not exists avv_accepted_at timestamptz,
  add column if not exists agb_accepted_at timestamptz;

comment on table public.consent_log is
  'DSGVO/TTDSG consent audit trail. Required to prove pre-processing consent (AVV/AGB/Datenschutz).';
