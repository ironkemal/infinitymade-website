-- v29: Warteliste (Bekleme Listesi) — Cancellation waiting list for services.
--
-- Patients who want an appointment but none is currently available are placed
-- on the waiting list.  When a booking is cancelled, matched_booking_id links
-- the waiting-list entry to the newly freed slot.
--
-- Status flow: waiting → matched | cancelled
-- Priority:    1 = Niedrig (low), 2 = Mittel (medium), 3 = Hoch (high)

create table if not exists public.warteliste (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  lead_id             uuid references public.leads(id) on delete set null,
  service_id          uuid references public.services(id) on delete set null,
  preferred_days      jsonb default '[]'::jsonb, -- e.g. ["Mo","Di","Mi","Do","Fr","Sa"]
  preferred_time_from time,
  preferred_time_to   time,
  notes               text,
  priority            smallint default 1 check (priority between 1 and 3),
  status              text not null default 'waiting'
                      check (status in ('waiting','matched','cancelled')),
  matched_booking_id  uuid references public.bookings(id) on delete set null,
  notified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Row-Level Security: owner only
alter table public.warteliste enable row level security;

create policy "Owner zugriff auf warteliste" on public.warteliste
  for all using (owner_id = auth.uid());

-- Indexes
create index if not exists idx_warteliste_owner
  on public.warteliste(owner_id);

create index if not exists idx_warteliste_status
  on public.warteliste(owner_id, status);

-- Auto-update updated_at on row change
create or replace function set_warteliste_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_warteliste_updated_at on public.warteliste;
create trigger trg_warteliste_updated_at
  before update on public.warteliste
  for each row execute function set_warteliste_updated_at();
