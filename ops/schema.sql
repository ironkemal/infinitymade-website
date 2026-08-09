-- ============================================================================
--  Praxura Ops-Dashboard — Schema
--  Ayrı Supabase projesinde çalışır (praxura-ops). ÜRÜN projesine kurma —
--  orada hasta verisi var, iç araç verisiyle karışmamalı.
--
--  Kurulum: Supabase → SQL Editor → bu dosyanın tamamını çalıştır.
-- ============================================================================

-- ── Üyeler ──────────────────────────────────────────────────────────────────
-- auth.users ile 1:1. Kayıt kapalı; hesapları Supabase panelinden elle açıyoruz,
-- sonra buraya karşılık gelen satırı ekliyoruz (aşağıda seed var).

create table if not exists ops_members (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  display_name text not null,
  color        text not null default '#6b7280',  -- kolon/avatar rengi
  created_at   timestamptz not null default now()
);

-- Oturumdaki kullanıcı üye mi? Tüm RLS politikaları bunu kullanır.
-- security definer: politika içinden ops_members'ı okurken sonsuz döngüye girmesin.
create or replace function ops_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from ops_members where id = auth.uid());
$$;

-- ── To-Do ───────────────────────────────────────────────────────────────────
-- assignee null  = ortak havuz (orta kolon)
-- assignee uuid  = o kişinin kolonu

create table if not exists ops_todos (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) > 0),
  notes        text,
  assignee     uuid references ops_members(id) on delete set null,
  done         boolean not null default false,
  done_at      timestamptz,
  done_by      uuid references ops_members(id) on delete set null,
  priority     text not null default 'normal' check (priority in ('hoch','normal','niedrig')),
  -- Kategori: pano filtresi. 50+ madde tek kolonda okunmuyor, ayrım buradan.
  category     text,
  -- Görev nereden geldi: elle mi eklendi, Claude toplantı notundan mı çıkardı
  source       text not null default 'manuell' check (source in ('manuell','claude')),
  meeting_date date,                     -- claude kaynaklıysa hangi toplantıdan
  sort_order   double precision not null default 0,   -- kolon içi sıra (sürükle-bırak)
  created_by   uuid references ops_members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Gruppierung + Abhängigkeiten. Bei bestehenden Projekten liefert
-- schema-groups.sql dieselben Spalten nach (create table if not exists greift dort nicht).
alter table ops_todos
  add column if not exists parent_id uuid references ops_todos(id) on delete set null;
alter table ops_todos
  add column if not exists blocked_by uuid[] not null default '{}';

create index if not exists ops_todos_board_idx on ops_todos (done, assignee, sort_order);
create index if not exists ops_todos_parent_idx on ops_todos (parent_id) where not done;
create index if not exists ops_todos_cat_idx on ops_todos (category) where not done;
create index if not exists ops_todos_done_at_idx on ops_todos (done_at desc) where done;

-- ── Wissensbank ─────────────────────────────────────────────────────────────

create table if not exists ops_wissen (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  body        text not null default '',          -- markdown
  tags        text[] not null default '{}',
  -- Ekler: [{path,name,size,type}] — dosyanın kendisi Storage'ın 'wissen' bucket'ında
  attachments jsonb not null default '[]'::jsonb,
  created_by  uuid references ops_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Tam metin arama: 150 nottan sonra aramasız bir bilgi bankası ölü yüktür.
  search      tsvector generated always as (
                to_tsvector('german', coalesce(title,'') || ' ' || coalesce(body,''))
              ) stored
);

create index if not exists ops_wissen_search_idx on ops_wissen using gin (search);
create index if not exists ops_wissen_tags_idx   on ops_wissen using gin (tags);

-- ── Entscheidungen ──────────────────────────────────────────────────────────
-- "Bunu neden böyle yaptık" kaydı. Ortaklıkta en çok unutulan şey.

create table if not exists ops_decisions (
  id            uuid primary key default gen_random_uuid(),
  decided_on    date not null default current_date,
  title         text not null check (length(trim(title)) > 0),
  decision      text not null default '',   -- ne karar verdik
  rationale     text not null default '',   -- neden
  alternatives  text not null default '',   -- neyi elediğimiz
  status        text not null default 'aktiv' check (status in ('aktiv','revidiert','verworfen')),
  agreed_by     text[] not null default '{}',  -- ['kemal','melih']
  created_by    uuid references ops_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ops_decisions_date_idx on ops_decisions (decided_on desc);

-- ── Meetings ────────────────────────────────────────────────────────────────

create table if not exists ops_meetings (
  id            uuid primary key default gen_random_uuid(),
  meeting_date  date not null,
  title         text not null default '',
  notes_md      text not null default '',   -- ham not (yapıştırılan)
  summary_md    text not null default '',   -- Claude özeti
  created_by    uuid references ops_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists ops_meetings_date_idx on ops_meetings (meeting_date);

-- ── updated_at otomatiği ────────────────────────────────────────────────────

create or replace function ops_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ops_todos','ops_wissen','ops_decisions','ops_meetings'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format(
      'create trigger %I_touch before update on %I
       for each row execute function ops_touch_updated_at()', t, t);
  end loop;
end $$;

-- done işaretlenince done_at otomatik dolsun / geri alınınca temizlensin.
create or replace function ops_todo_done_stamp()
returns trigger language plpgsql as $$
begin
  if new.done and not coalesce(old.done, false) then
    new.done_at = now();
    new.done_by = auth.uid();
  elsif not new.done and coalesce(old.done, false) then
    new.done_at = null;
    new.done_by = null;
  end if;
  return new;
end $$;

drop trigger if exists ops_todos_done_stamp on ops_todos;
create trigger ops_todos_done_stamp before update on ops_todos
for each row execute function ops_todo_done_stamp();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Model basit ve bilinçli: üye olan her şeyi görür ve düzenler. İki kişilik bir
-- ortaklıkta kişi-bazlı kısıtlama sadece engel olur. Asıl kapı üyelik kapısıdır:
-- Supabase panelinde "Enable signup" KAPALI olmalı, yoksa herkes üye olabilir.

alter table ops_members   enable row level security;
alter table ops_todos     enable row level security;
alter table ops_wissen    enable row level security;
alter table ops_decisions enable row level security;
alter table ops_meetings  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ops_todos','ops_wissen','ops_decisions','ops_meetings'] loop
    execute format('drop policy if exists %I_member_all on %I', t, t);
    execute format(
      'create policy %I_member_all on %I
       for all to authenticated
       using (ops_is_member()) with check (ops_is_member())', t, t);
  end loop;
end $$;

-- Üye listesi: üyeler birbirini görür (kolon başlıkları, atama menüsü için),
-- ama satır ekleyip silemez — bunu sadece service_role / SQL editor yapar.
drop policy if exists ops_members_read on ops_members;
create policy ops_members_read on ops_members
  for select to authenticated using (ops_is_member());

-- ── Storage: Wissensbank ekleri ─────────────────────────────────────────────
-- Bucket private; dosyalar imzalı kısa ömürlü bağlantıyla açılır.

insert into storage.buckets (id, name, public)
values ('wissen', 'wissen', false)
on conflict (id) do nothing;

drop policy if exists wissen_read   on storage.objects;
drop policy if exists wissen_write  on storage.objects;
drop policy if exists wissen_delete on storage.objects;

create policy wissen_read on storage.objects
  for select to authenticated using (bucket_id = 'wissen' and ops_is_member());
create policy wissen_write on storage.objects
  for insert to authenticated with check (bucket_id = 'wissen' and ops_is_member());
create policy wissen_delete on storage.objects
  for delete to authenticated using (bucket_id = 'wissen' and ops_is_member());

-- ── Realtime ────────────────────────────────────────────────────────────────
-- İkiniz aynı anda açıkken değişiklik karşı tarafta anında görünsün.
do $$
begin
  alter publication supabase_realtime add table ops_todos;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table ops_wissen;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table ops_decisions;
exception when duplicate_object then null; end $$;

-- ============================================================================
--  SEED — hesapları açtıktan SONRA çalıştır
--  Supabase → Authentication → Add user ile iki hesabı aç, sonra:
-- ============================================================================
-- insert into ops_members (id, email, display_name, color)
-- select u.id, u.email, m.name, m.color
-- from auth.users u
-- join (values
--   ('demiryavuzkemal@gmail.com', 'Kemal', '#c9a227'),
--   ('melihk.6106@gmail.com',     'Melih', '#4f8ef7')
-- ) as m(email, name, color) on m.email = u.email
-- on conflict (id) do update
--   set email = excluded.email,
--       display_name = excluded.display_name,
--       color = excluded.color;
