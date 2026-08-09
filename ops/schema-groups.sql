-- ============================================================================
--  Ops-Dashboard — Gruppierung (Ober-/Unteraufgaben) + Abhängigkeiten
--
--  Neden: 108 offene Karten in einer Spalte liest niemand. Ab jetzt gibt es
--  Oberaufgaben ("Themen") mit aufklappbaren Unteraufgaben, und eine Aufgabe
--  kann sagen, welche andere Aufgabe zuerst fertig sein muss.
--
--  Ausführen: Supabase (praxura-ops) → SQL Editor → alles einfügen → Run.
--  Idempotent: mehrfaches Ausführen schadet nicht.
--  ⚠️ NICHT im Produkt-Projekt (njvuclullotbksskpwgk) ausführen.
-- ============================================================================

-- Unteraufgabe → Oberaufgabe. NULL = Oberaufgabe (bzw. freie Einzelaufgabe).
-- on delete set null: Oberaufgabe löschen darf die Unteraufgaben nicht mitreißen,
-- sie rutschen dann sichtbar auf die oberste Ebene zurück.
alter table ops_todos
  add column if not exists parent_id uuid references ops_todos(id) on delete set null;

-- "Diese Aufgabe geht erst, wenn jene fertig ist." Mehrere Blocker erlaubt.
alter table ops_todos
  add column if not exists blocked_by uuid[] not null default '{}';

create index if not exists ops_todos_parent_idx on ops_todos (parent_id) where not done;

-- Zwei Ebenen genügen. Tiefer verschachtelt wird ein Board wieder unlesbar,
-- und Drag & Drop mehrdeutig.
create or replace function ops_todo_depth_guard()
returns trigger language plpgsql as $$
begin
  if new.parent_id is null then return new; end if;

  if new.parent_id = new.id then
    raise exception 'Eine Aufgabe kann nicht ihr eigenes Elternteil sein';
  end if;

  if exists (select 1 from ops_todos p
             where p.id = new.parent_id and p.parent_id is not null) then
    raise exception 'Nur zwei Ebenen: das Ziel ist selbst eine Unteraufgabe';
  end if;

  if exists (select 1 from ops_todos c where c.parent_id = new.id) then
    raise exception 'Diese Aufgabe hat Unteraufgaben und kann selbst keine werden';
  end if;

  return new;
end $$;

drop trigger if exists ops_todos_depth on ops_todos;
create trigger ops_todos_depth
before insert or update of parent_id on ops_todos
for each row execute function ops_todo_depth_guard();
