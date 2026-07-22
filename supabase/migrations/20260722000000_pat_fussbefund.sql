-- Podologischer Fußbefund (digitale Fußanalysekarte)
-- Mirrors the messreihen ownership/RLS pattern: owner_id + lead_id, one row per Befund (Verlauf).
-- befund = alle Checkbox/Select-Felder als JSONB; markierungen = Marker auf den Fußdiagrammen.

create table if not exists public.pat_fussbefund (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null,
  lead_id      uuid not null,
  erstellt_am  timestamptz not null default now(),        -- Befund-Datum (Ersttermin/Folgetermin), editierbar
  befund       jsonb not null default '{}'::jsonb,         -- Deformitäten, Risiken, Haut, Zehen/Nägel ...
  markierungen jsonb not null default '[]'::jsonb,         -- [{view,foot,x,y,type,color,label}]
  notiz        text,
  erfasst_von  uuid,
  created_at   timestamptz not null default now()
);

create index if not exists pat_fussbefund_lead_idx
  on public.pat_fussbefund (lead_id, erstellt_am desc);
create index if not exists pat_fussbefund_owner_idx
  on public.pat_fussbefund (owner_id);

alter table public.pat_fussbefund enable row level security;

-- Identisch zu messreihen_owner_access: Owner + verknüpfte Mitarbeiter.
drop policy if exists pat_fussbefund_owner_access on public.pat_fussbefund;
create policy pat_fussbefund_owner_access on public.pat_fussbefund
  for all
  using (
    owner_id = auth.uid()
    or owner_id in (select profiles.owner_id from public.profiles where profiles.id = auth.uid())
  )
  with check (
    owner_id = auth.uid()
    or owner_id in (select profiles.owner_id from public.profiles where profiles.id = auth.uid())
  );
