-- ============================================================================
--  Praxura Cockpit — RBAC, Kunden 360°, Billing & Alerts Schema
--
--  ⚠️ AUSSCHLIESSLICH im separaten Ops-Supabase-Projekt `farkaejociddtgqkusvm`
--     (`praxura-ops`) ausführen! NIEMALS im Produkt-Projekt ausführen!
--  Idempotent: mehrfaches Ausführen ist sicher und verändert keine Bestandsdaten.
-- ============================================================================

BEGIN;

-- ── 0. Gemeinsamer updated_at-Trigger (falls noch nicht vorhanden) ───────────
create or replace function ops_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── 1. ops_members: Rollen, Aktiv-Flag, Sprache ─────────────────────────────
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ops_members'
      and column_name = 'role'
  ) then
    alter table public.ops_members
      add column role text not null default 'founder'
        check (role in ('founder','tech','support','sales'));
  end if;

  alter table public.ops_members
    alter column role set default 'support';
end $$;

alter table ops_members
  add column if not exists is_active boolean not null default true;

alter table ops_members
  add column if not exists preferred_lang text not null default 'de'
    check (preferred_lang in ('de','tr','en'));

-- ── 2. RBAC-Helfer (SECURITY DEFINER, feste search_path) ────────────────────
create or replace function ops_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from ops_members
    where id = auth.uid()
      and is_active = true
  );
$$;

create or replace function ops_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from ops_members
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function ops_has_role(allowed text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from ops_members
    where id = auth.uid()
      and is_active = true
      and role = any(allowed)
  );
$$;

-- ── 3. ops_members Update-Schutz: Selbst-Sprache vs. Founder-Rechte ─────────
create or replace function ops_members_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL Editor / service_role ohne auth.uid() darf alles
  if auth.uid() is null then
    return new;
  end if;

  if not ops_has_role(ARRAY['founder']) then
    if new.id is distinct from auth.uid()
       or (to_jsonb(new) - 'preferred_lang') is distinct from (to_jsonb(old) - 'preferred_lang')
    then
      raise exception 'Only preferred_lang may be updated by non-founders';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists ops_members_guard_upd on ops_members;
create trigger ops_members_guard_upd
  before update on ops_members
  for each row execute function ops_members_guard_update();

drop policy if exists ops_members_read on ops_members;
create policy ops_members_read on ops_members
  for select to authenticated
  using (ops_is_member());

drop policy if exists ops_members_self_lang_update on ops_members;
create policy ops_members_self_lang_update on ops_members
  for update to authenticated
  using (id = auth.uid() and ops_is_member())
  with check (id = auth.uid() and ops_is_member());

drop policy if exists ops_members_founder_update on ops_members;
create policy ops_members_founder_update on ops_members
  for update to authenticated
  using (ops_has_role(ARRAY['founder']))
  with check (ops_has_role(ARRAY['founder']));

-- ── 4. Finanzen-RLS auf Founder eingrenzen ──────────────────────────────────
do $$
begin
  if to_regclass('public.ops_finance_expenses') is not null then
    drop policy if exists ops_finance_expenses_member_all on ops_finance_expenses;
    drop policy if exists ops_finance_expenses_founder_all on ops_finance_expenses;
    create policy ops_finance_expenses_founder_all on ops_finance_expenses
      for all to authenticated
      using (ops_has_role(ARRAY['founder']))
      with check (ops_has_role(ARRAY['founder']));
  end if;

  if to_regclass('public.ops_finance_audit_log') is not null then
    drop policy if exists ops_finance_audit_member_all on ops_finance_audit_log;
    drop policy if exists ops_finance_audit_founder_all on ops_finance_audit_log;
    create policy ops_finance_audit_founder_all on ops_finance_audit_log
      for all to authenticated
      using (ops_has_role(ARRAY['founder']))
      with check (ops_has_role(ARRAY['founder']));
  end if;
end $$;

-- ── 4b. Fahrtenbuch-RLS auf Founder eingrenzen ──────────────────────────────
do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array[
    'ops_fahrtenbuch_vehicles',
    'ops_fahrtenbuch_entries',
    'ops_fahrtenbuch_costs'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I enable row level security', tbl);
      for pol in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = tbl
      loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
      end loop;
      execute format(
        'create policy founder_only on public.%I for all to authenticated using (ops_has_role(ARRAY[''founder''])) with check (ops_has_role(ARRAY[''founder'']))',
        tbl
      );
    end if;
  end loop;
end $$;

-- ── 5. ops_customers (B2B Praxen — SaaS & On-Prem Boxen, KEIN PHI) ──────────
create table if not exists ops_customers (
  id                   uuid primary key default gen_random_uuid(),
  display_name         text not null check (length(trim(display_name)) > 0),
  tenant_id            uuid unique,
  box_name             text unique,
  deployment_mode      text not null default 'saas'
                         check (deployment_mode in ('saas','box','hybrid')),
  fachbereich          text not null default 'podologie'
                         check (fachbereich in ('podologie','physiotherapie','ergotherapie','logopaedie','interdisziplinaer')),
  lifecycle_stage      text not null default 'lead'
                         check (lifecycle_stage in ('lead','demo','onboarding','aktiv','risiko','gekuendigt')),
  contact_name         text,
  contact_email        text,
  contact_phone        text,
  avv_signed           boolean not null default false,
  avv_signed_at        date,
  itsg_cert_expires_at date,
  onboarding_checklist jsonb not null default '{}'::jsonb,
  notes                text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists ops_customers_stage_idx on ops_customers (lifecycle_stage);
create index if not exists ops_customers_mode_idx  on ops_customers (deployment_mode);
create index if not exists ops_customers_cert_idx  on ops_customers (itsg_cert_expires_at)
  where itsg_cert_expires_at is not null;

drop trigger if exists ops_customers_touch on ops_customers;
create trigger ops_customers_touch
  before update on ops_customers
  for each row execute function ops_touch_updated_at();

create or replace function ops_customers_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL Editor / service_role ohne auth.uid() darf alles
  if auth.uid() is null then
    return new;
  end if;

  if ops_has_role(ARRAY['founder','sales','tech']) then
    return new;
  end if;

  if ops_has_role(ARRAY['support']) then
    if (to_jsonb(new) - 'notes' - 'updated_at') is distinct from (to_jsonb(old) - 'notes' - 'updated_at') then
      raise exception 'Only notes may be updated by support';
    end if;
    return new;
  end if;

  raise exception 'Customer updates not allowed for role';
end $$;

drop trigger if exists ops_customers_guard_upd on ops_customers;
create trigger ops_customers_guard_upd
  before update on ops_customers
  for each row execute function ops_customers_guard_update();

alter table ops_customers enable row level security;

drop policy if exists ops_customers_select on ops_customers;
create policy ops_customers_select on ops_customers
  for select to authenticated
  using (ops_is_member());

drop policy if exists ops_customers_insert on ops_customers;
create policy ops_customers_insert on ops_customers
  for insert to authenticated
  with check (ops_has_role(ARRAY['founder','sales','tech']));

drop policy if exists ops_customers_update on ops_customers;
create policy ops_customers_update on ops_customers
  for update to authenticated
  using (ops_has_role(ARRAY['founder','sales','tech','support']))
  with check (ops_has_role(ARRAY['founder','sales','tech','support']));

drop policy if exists ops_customers_delete on ops_customers;
create policy ops_customers_delete on ops_customers
  for delete to authenticated
  using (ops_has_role(ARRAY['founder']));

-- ── 6. ops_customer_billing (Vertrag / Stripe / Pilot — nur Founder & Sales)
create table if not exists ops_customer_billing (
  customer_id          uuid primary key references ops_customers(id) on delete cascade,
  billing_mode         text not null default 'pilot_frei'
                         check (billing_mode in ('stripe','rechnung','pilot_frei')),
  stripe_customer_id   text,
  plan_label           text,
  contract_monthly_eur numeric(10,2),
  setup_fee_eur        numeric(10,2),
  payment_status       text not null default 'ok'
                         check (payment_status in ('ok','trial','past_due','paused','canceled')),
  notes                text not null default '',
  updated_at           timestamptz not null default now()
);

drop trigger if exists ops_customer_billing_touch on ops_customer_billing;
create trigger ops_customer_billing_touch
  before update on ops_customer_billing
  for each row execute function ops_touch_updated_at();

alter table ops_customer_billing enable row level security;

drop policy if exists ops_customer_billing_all on ops_customer_billing;
create policy ops_customer_billing_all on ops_customer_billing
  for all to authenticated
  using (ops_has_role(ARRAY['founder','sales']))
  with check (ops_has_role(ARRAY['founder','sales']));

-- ── 7. ops_alerts (Handlungsbedarf — Founder, Tech, Support bei ticket_urgent)
create table if not exists ops_alerts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null
                check (kind in ('azure_abgleich','budget','box_offline','ticket_urgent','cert_expiry','system')),
  severity    text not null default 'warn'
                check (severity in ('info','warn','critical')),
  title       text not null check (length(trim(title)) > 0),
  details     jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references ops_members(id) on delete set null,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists ops_alerts_open_idx on ops_alerts (created_at desc)
  where resolved_at is null;

alter table ops_alerts enable row level security;

drop policy if exists ops_alerts_select on ops_alerts;
create policy ops_alerts_select on ops_alerts
  for select to authenticated
  using (
    ops_has_role(ARRAY['founder','tech'])
    or (ops_has_role(ARRAY['support']) and kind = 'ticket_urgent')
  );

drop policy if exists ops_alerts_insert on ops_alerts;
create policy ops_alerts_insert on ops_alerts
  for insert to authenticated
  with check (
    ops_has_role(ARRAY['founder','tech'])
    or (ops_has_role(ARRAY['support']) and kind = 'ticket_urgent')
  );

drop policy if exists ops_alerts_update on ops_alerts;
create policy ops_alerts_update on ops_alerts
  for update to authenticated
  using (
    ops_has_role(ARRAY['founder','tech'])
    or (ops_has_role(ARRAY['support']) and kind = 'ticket_urgent')
  )
  with check (
    ops_has_role(ARRAY['founder','tech'])
    or (ops_has_role(ARRAY['support']) and kind = 'ticket_urgent')
  );

drop policy if exists ops_alerts_delete on ops_alerts;
create policy ops_alerts_delete on ops_alerts
  for delete to authenticated
  using (ops_has_role(ARRAY['founder']));

COMMIT;
