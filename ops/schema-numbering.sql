-- ============================================================================
--  Ops-Dashboard — Fortlaufende Nummer je Aufgabe
--
--  Neden: "35 numaralı todoya başla" diye referans verilebilsin diye her
--  ops_todos satırına kalıcı, kısa bir tamsayı lazım — UUID insanın
--  hatırlayıp söyleyebileceği bir şey değil.
--
--  Ausführen: Supabase (praxura-ops, farkaejociddtgqkusvm) → SQL Editor →
--  alles einfügen → Run.
--  Idempotent: mehrfaches Ausführen schadet nicht.
--  ⚠️ NICHT im Produkt-Projekt (njvuclullotbksskpwgk) ausführen.
-- ============================================================================

create sequence if not exists ops_todos_seq_no_seq;

alter table ops_todos
  add column if not exists seq_no integer;

-- Bestehende Zeilen: chronologisch nummerieren (ältestes zuerst = 1),
-- damit die Nummer mit der bekannten Historie übereinstimmt.
with ordered as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from ops_todos
  where seq_no is null
)
update ops_todos t
set seq_no = o.rn + coalesce((select max(seq_no) from ops_todos), 0)
from ordered o
where t.id = o.id;

alter table ops_todos
  alter column seq_no set not null;

-- Sequenz auf den höchsten vergebenen Wert setzen, damit neue Zeilen
-- (Ingest oder manuell) nahtlos weiterzählen statt bei 1 zu kollidieren.
select setval('ops_todos_seq_no_seq', (select max(seq_no) from ops_todos), true);

alter table ops_todos
  alter column seq_no set default nextval('ops_todos_seq_no_seq');

alter sequence ops_todos_seq_no_seq owned by ops_todos.seq_no;

create unique index if not exists ops_todos_seq_no_uidx on ops_todos (seq_no);
