import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../ops/board.js', import.meta.url), 'utf8');
function declaration(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start).match(/^[\s\S]*?\n\}/)[0];
}

function fixture(groupColumns = true) {
  const task = { id: 'task', title: 'Synthetische Aufgabe', notes: 'Vorherige Notiz', assignee: null,
    priority: 'normal', category: 'Technik', parent_id: null, blocked_by: ['closed', 'open'] };
  const todos = [task,
    { id: 'closed', title: 'Erledigte Voraussetzung', done: true },
    { id: 'open', title: 'Offene Voraussetzung', done: false },
    { id: 'unused-closed', title: 'Andere erledigte Aufgabe', done: true },
    { id: 'child', title: 'Eigenes Kind', parent_id: 'task', done: false },
  ];
  const fields = {};
  const context = vm.createContext({ todos, state: { members: [] }, hasGroupCols: groupColumns,
    kidsOf: id => todos.filter(t => t.parent_id === id),
    esc: s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
    $: selector => fields[selector], toast() { throw new Error('Unexpected toast'); },
  });
  vm.runInContext(['todoForm', 'categoryList', 'readForm'].map(declaration).join('\n'), context);
  const html = context.todoForm(task);
  const blockHtml = html.match(/<select id="f_block"[\s\S]*?<\/select>/)?.[0] || '';
  const options = [...blockHtml.matchAll(/<option value="([^"]*)"([^>]*)>/g)]
    .map(([, value, attributes]) => ({ value, selected: /\bselected\b/.test(attributes) }));
  for (const [id, value] of Object.entries({ title: task.title, notes: 'Ergänzte Notiz', assignee: '',
    prio: task.priority, cat: task.category, parent: '' })) fields[`#f_${id}`] = { value };
  fields['#f_block'] = { selectedOptions: options.filter(o => o.selected) };
  return { task, context, fields, options, html };
}

test('Notizformular erhält bereits gewählte erledigte Voraussetzungen', () => {
  const f = fixture();
  assert.deepEqual(f.options.filter(o => o.selected).map(o => o.value), f.task.blocked_by);
  const payload = JSON.parse(JSON.stringify(f.context.readForm()));
  assert.deepEqual(payload, { title: f.task.title, notes: 'Ergänzte Notiz', assignee: null,
    priority: 'normal', category: 'Technik', parent_id: null, blocked_by: ['closed', 'open'] });
  for (const field of ['id', 'seq_no', 'done', 'done_at', 'done_by', 'created_by', 'sort_order', 'source'])
    assert.equal(Object.hasOwn(payload, field), false, `${field} gehört nicht in den Formularpatch`);
});

test('neue erledigte Blocker, Selbstverweise und eigene Kinder bleiben ausgeschlossen', () => {
  const f = fixture();
  const ids = f.options.map(o => o.value);
  assert.ok(ids.includes('open'));
  for (const id of ['unused-closed', 'task', 'child']) assert.ok(!ids.includes(id), id);
});

test('bestehende Voraussetzungen lassen sich bewusst abwählen', () => {
  const f = fixture();
  f.fields['#f_block'].selectedOptions = [];
  assert.deepEqual(Array.from(f.context.readForm().blocked_by), []);
});

test('Legacy ohne Gruppenspalten schreibt weder Parent noch Voraussetzungen', () => {
  const f = fixture(false);
  assert.ok(!f.html.includes('id="f_block"'));
  const payload = f.context.readForm();
  assert.equal(Object.hasOwn(payload, 'parent_id'), false);
  assert.equal(Object.hasOwn(payload, 'blocked_by'), false);
});
