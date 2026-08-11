-- ============================================================================
--  Ops-Dashboard — Audit-Trail für Aufgaben (die "Falle")
--
--  Warum: Zuweisungen auf dem Board verschwinden gelegentlich von selbst und
--  niemand kann hinterher sagen, wer oder was sie entfernt hat. Ohne Vorfall
--  lässt sich die Ursache nicht finden — also protokollieren wir ab jetzt jede
--  Änderung an assignee / parent_id / done sowie jedes Löschen einer Aufgabe.
--  Beim nächsten Auftreten steht im Protokoll, wer es wann getan hat.
--
--  Ausführen: Supabase → Ops-Projekt `farkaejociddtgqkusvm` (praxura-ops) →
--  SQL Editor → alles einfügen → Run. Danach der Kontrollblock am Dateiende.
--  Idempotent: mehrfaches Ausführen schadet nicht, keine Bestandsdaten werden
--  verändert, es wird nichts gelöscht.
--  ⚠️ NICHT im Produkt-Projekt (njvuclullotbksskpwgk) ausführen — dort liegen
--     Patientendaten, das Ops-Werkzeug hat dort nichts zu suchen.
-- ============================================================================

-- ── Protokolltabelle ────────────────────────────────────────────────────────
-- Bewusst OHNE Fremdschlüssel auf ops_todos: wird eine Aufgabe gelöscht, muss
-- ihre Spur erhalten bleiben — sonst löscht sich der interessanteste Fall selbst.
-- todo_title wird mitgeschrieben, damit man die Zeile auch dann noch versteht.

create table if not exists ops_todos_audit (
  id          bigserial primary key,
  todo_id     uuid not null,
  todo_title  text,
  field       text not null,          -- 'assignee' | 'parent_id' | 'done' | 'row_deleted'
  old_value   text,
  new_value   text,
  changed_by  uuid,                   -- auth.uid() des Verursachers, NULL = service_role/SQL-Editor
  changed_at  timestamptz not null default now()
);

create index if not exists ops_todos_audit_todo_idx on ops_todos_audit (todo_id, changed_at desc);
create index if not exists ops_todos_audit_time_idx on ops_todos_audit (changed_at desc);

-- ── Trigger: Änderungen ─────────────────────────────────────────────────────
-- security definer, damit der Eintrag auch dann entsteht, wenn der Schreibende
-- selbst kein Recht auf die Protokolltabelle hat. Niemand soll die eigene Spur
-- unterdrücken können.

create or replace function ops_todos_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if new.assignee is distinct from old.assignee then
    insert into ops_todos_audit (todo_id, todo_title, field, old_value, new_value, changed_by)
    values (old.id, old.title, 'assignee', old.assignee::text, new.assignee::text, actor);
  end if;

  if new.parent_id is distinct from old.parent_id then
    insert into ops_todos_audit (todo_id, todo_title, field, old_value, new_value, changed_by)
    values (old.id, old.title, 'parent_id', old.parent_id::text, new.parent_id::text, actor);
  end if;

  if new.done is distinct from old.done then
    insert into ops_todos_audit (todo_id, todo_title, field, old_value, new_value, changed_by)
    values (old.id, old.title, 'done', old.done::text, new.done::text, actor);
  end if;

  return null;   -- after-Trigger: Rückgabewert wird nicht verwendet
end $$;

drop trigger if exists ops_todos_audit_upd on ops_todos;
create trigger ops_todos_audit_upd
after update on ops_todos
for each row execute function ops_todos_audit_log();

-- ── Trigger: Löschen ────────────────────────────────────────────────────────
-- Eine gelöschte Aufgabe sieht auf dem Board genauso aus wie eine verlorene
-- Zuweisung ("die Karte ist weg"). Deshalb wird auch das protokolliert.

create or replace function ops_todos_audit_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into ops_todos_audit (todo_id, todo_title, field, old_value, new_value, changed_by)
  values (old.id, old.title, 'row_deleted', old.assignee::text, null, auth.uid());
  return null;
end $$;

drop trigger if exists ops_todos_audit_del on ops_todos;
create trigger ops_todos_audit_del
after delete on ops_todos
for each row execute function ops_todos_audit_del();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Mitglieder dürfen lesen. Schreiben darf niemand direkt — Einträge entstehen
-- ausschließlich über die Trigger oben.

alter table ops_todos_audit enable row level security;

drop policy if exists ops_todos_audit_read on ops_todos_audit;
create policy ops_todos_audit_read on ops_todos_audit
  for select to authenticated using (ops_is_member());

-- ============================================================================
--  KONTROLLBLOCK — direkt nach dem Run separat ausführen
--
--  Muss eine einzige Zeile mit fünfmal `true` liefern. Zeigt eine Spalte
--  `false`, ist das Skript nicht sauber durchgelaufen.
-- ============================================================================

-- select
--   to_regclass('public.ops_todos_audit') is not null                      as tabelle_da,
--   to_regproc('public.ops_todos_audit_log') is not null                   as funktion_update_da,
--   to_regproc('public.ops_todos_audit_del') is not null                   as funktion_delete_da,
--   exists (select 1 from pg_trigger
--            where tgrelid = 'ops_todos'::regclass
--              and tgname = 'ops_todos_audit_upd')                         as trigger_update_da,
--   exists (select 1 from pg_trigger
--            where tgrelid = 'ops_todos'::regclass
--              and tgname = 'ops_todos_audit_del')                         as trigger_delete_da;

-- ============================================================================
--  FUNKTIONSTEST — im Pano eine Karte in eine andere Spalte ziehen, dann:
--  Es muss mindestens eine Zeile erscheinen. Kommt nichts, greift der Trigger
--  nicht (oder die Karte wurde nicht wirklich verschoben).
-- ============================================================================

-- select changed_at, todo_title, field, old_value, new_value
--   from ops_todos_audit
--  order by changed_at desc
--  limit 10;

-- ============================================================================
--  AUSWERTUNG BEIM NÄCHSTEN VORFALL
--  Wer hat zuletzt Zuweisungen entfernt (Zuweisung → Gemeinsam)?
-- ============================================================================

-- select a.changed_at, a.todo_title,
--        m_old.display_name as war_bei,
--        m_who.display_name as geaendert_von
--   from ops_todos_audit a
--   left join ops_members m_old on m_old.id = a.old_value::uuid
--   left join ops_members m_who on m_who.id = a.changed_by
--  where a.field = 'assignee' and a.new_value is null
--  order by a.changed_at desc
--  limit 50;

--  `geaendert_von` IS NULL bedeutet: nicht aus dem Board heraus geändert, sondern
--  mit service_role bzw. direkt im SQL-Editor (z. B. ops/tools/ingest.mjs oder
--  regroup.mjs). Genau das wäre der Hinweis auf ein Skript als Ursache statt auf
--  einen Klick — und damit die eigentliche Antwort auf die offene Frage.
-- ============================================================================
