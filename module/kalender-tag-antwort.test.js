import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dashboard = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const start = dashboard.indexOf('async function renderDayView(');
const source = dashboard.slice(start, dashboard.indexOf('\nasync function renderWeekView(', start));

function setup(phase = 'bookings') {
  const element = (fragment = false) => ({ fragment, children: [], dataset: {}, style: {},
    classList: { add() {} }, addEventListener() {}, closest() { return this; },
    appendChild(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes.flatMap(n => n.fragment ? n.children : [n]); },
  });
  const elements = Object.fromEntries(['dayViewDateLabel', 'dvTimeCol', 'dvColsWrap'].map(id => [id, element()]));
  let release, reached;
  const blocked = new Promise(resolve => { release = resolve; });
  const waiting = new Promise(resolve => { reached = resolve; });
  let first = true;
  const delay = async (where, value) => {
    if (first && where === phase) { first = false; reached(); await blocked; }
    return value;
  };
  const query = { select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; },
    neq() { return delay('bookings', { data: [] }); } };
  const context = vm.createContext({
    Date, document: { getElementById: id => elements[id], createElement: () => element(), createDocumentFragment: () => element(true) },
    tagesAufbau: 0, calendarView: 'day', calEmpFilter: 'all', teamMembers: [{ id: 'e', business_name: 'Test' }], currentBusiness: { id: 'A' },
    formatDateDE: d => d.toISOString().slice(0, 10), toISODate: d => d.toISOString().slice(0, 10),
    getOwnerId: () => 'o', supabase: { from: () => query }, TERMIN_SELECT: 'id',
    termineDesStandorts: rows => rows, planSpalten: async (_, { team }) => delay('plan', team),
    ladeAbwesenheiten: async () => delay('absences', []), rasterStunden: () => ({ von: 8, bis: 9 }),
    EMP_COLORS: ['#123456'], moveBooking: null, istAbwesend: () => false,
  });
  const render = vm.runInContext(`${source}\nrenderDayView`, context);
  return { context, render, waiting, release, elements,
    slot: () => elements.dvColsWrap.children[0]?.children[1]?.children[0]?.dataset.time };
}

for (const phase of ['bookings', 'plan', 'absences']) {
  test(`Tagesansicht: alte ${phase}-Antwort überschreibt keinen neueren Tag`, async () => {
    const h = setup(phase);
    const old = h.render('2026-02-02'); await h.waiting;
    await h.render('2026-02-03'); h.release(); await old;
    assert.equal(h.slot(), '2026-02-03T08:00');
    assert.equal(h.elements.dayViewDateLabel.textContent, '2026-02-03');
  });
}

test('Tagesansicht: neuer leerer Teamfilter verwirft alten Aufbau', async () => {
  const h = setup(); const old = h.render('2026-02-02'); await h.waiting;
  h.context.teamMembers = []; await h.render('2026-02-03'); h.release(); await old;
  assert.equal(h.elements.dvColsWrap.children.length, 0);
});

for (const change of [h => { h.context.currentBusiness = { id: 'B' }; }, h => { h.context.calEmpFilter = 'other'; }, h => { h.context.calendarView = 'month'; }]) {
  test('Tagesansicht: geänderter Kontext verwirft wartenden Aufbau', async () => {
    const h = setup(); const old = h.render('2026-02-02'); await h.waiting;
    change(h); h.release(); await old;
    assert.equal(h.elements.dvColsWrap.children.length, 0);
  });
}
