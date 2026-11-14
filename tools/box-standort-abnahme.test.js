// Lokale synthetische M3/M4-Abnahme. Kein Box-Stack, keine RLS-/Kundenbox-Abnahme.
// Ausfuehren: node --test tools/box-standort-abnahme.test.js
// Kein Netzwerk, keine echten Daten, keine persistenten Schreibzugriffe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ladeStandortPlan, planErlaubt, _planSperreZuruecksetzen as resetBackend } from '../api-backend/lib/standort-plan-laden.js';
import { planSpalten, _planSperreZuruecksetzen as resetFrontend } from '../module/standort-plan-laden.js';

const dashboard = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
/** @param {string} name */
function funktion(name) {
  const start = dashboard.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Produktionsfunktion ${name} vorhanden`);
  return dashboard.slice(start, dashboard.indexOf('\n}\n', start) + 2);
}

// Adapter fuer isolierte synthetische Zeilen; keine Behauptung ueber PostgreSQL oder RLS.
function standortForm({ box = true, bestaetigt = true } = {}) {
  /** @type {any[]} */
  const rows = [];
  /** @type {any[][]} */
  const toasts = [];
  /** @type {((ev: { preventDefault: () => void }) => Promise<void>) | undefined} */
  let submit;
  let bestaetigungen = 0;
  const form = { addEventListener: (/** @type {string} */ event, /** @type {(ev: { preventDefault: () => void }) => Promise<void>} */ fn) => { assert.equal(event, 'submit'); submit = fn; } };
  const modal = { hidden: false, querySelectorAll: () => [] };
  const fields = Object.fromEntries(['Id', 'Name', 'Street', 'HouseNumber', 'Zip', 'City', 'Phone', 'Slug'].map(k => ['bizForm' + k, { value: '' }]));
  const context = vm.createContext({
    IST_KUTU: box, ENTERPRISE_PLANS: new Set(['enterprise']), ownerProfile: null,
    currentProfile: { role: 'owner', plan: 'professional', plan_status: 'active', sector: 'physiotherapy' },
    currentSession: { user: { id: 'synthetic-owner' } }, myBusinesses: rows,
    document: { getElementById: (/** @type {string} */ id) => id === 'businessForm' ? form : id === 'businessModal' ? modal : fields[id] },
    supabase: { from(/** @type {string} */ table) {
      assert.equal(table, 'businesses');
      return {
        insert(/** @type {Record<string, any>} */ payload) { return { select: () => ({ single: async () => {
          const row = { ...payload, id: `synthetic-location-${rows.length + 1}` };
          rows.push(row); return { data: row, error: null };
        } }) }; },
        select: () => ({ eq: (/** @type {string} */ key, /** @type {string} */ value) => {
          assert.equal(key, 'owner_id'); assert.equal(value, 'synthetic-owner');
          /** @type {{ order: () => any, then: (resolve: (val: { data: any[], error: null }) => void) => void }} */
          const query = { order: () => query, then: resolve => resolve({ data: rows.slice(), error: null }) };
          return query;
        } }),
      };
    } },
    showConfirmModal: async () => { bestaetigungen++; return bestaetigt; },
    showToast: (/** @type {any[]} */ ...args) => toasts.push(args), t: (/** @type {string} */ key) => key,
    renderBizSwitcher() {}, renderBusinessesSection() {},
  });
  vm.runInContext(funktion('isEnterprise') + '\n' + funktion('wireBusinessModal') + '\nwireBusinessModal();', context);
  return {
    rows, toasts, context, modal,
    bestaetigungen: () => bestaetigungen,
    async anlegen(/** @type {string} */ name) {
      fields.bizFormName.value = name;
      modal.hidden = false;
      if (!submit) throw new Error('submit handler not registered');
      await submit({ preventDefault() {} });
    },
  };
}

test('Box: Professional legt ersten und zweiten Teststandort an; Wiederholung startet leer', async () => {
  for (let lauf = 0; lauf < 2; lauf++) {
    const h = standortForm();
    assert.equal(vm.runInContext('isEnterprise()', h.context), true);
    await h.anlegen('Teststandort A');
    assert.equal(h.rows.length, 1);
    assert.equal(h.rows[0].is_default, true);
    assert.equal(h.rows[0].owner_id, 'synthetic-owner');
    assert.equal(h.bestaetigungen(), 0);
    await h.anlegen('Teststandort B');
    assert.equal(h.rows.length, 2);
    assert.equal(h.rows[1].is_default, false);
    assert.equal(h.bestaetigungen(), 1);
    assert.equal(h.modal.hidden, true);
  }
});

test('Box: abgelehnte Rechtsperson-Bestaetigung verhindert zweiten Insert', async () => {
  const h = standortForm({ bestaetigt: false });
  await h.anlegen('Teststandort A');
  await h.anlegen('Teststandort B');
  assert.equal(h.rows.length, 1);
  assert.equal(h.bestaetigungen(), 1);
  assert.equal(h.modal.hidden, false);
});

test('SaaS Professional: Box-Freigabe erweitert keine Tarifrechte', async () => {
  const h = standortForm({ box: false });
  assert.equal(vm.runInContext('isEnterprise()', h.context), false);
  await h.anlegen('Teststandort A');
  await h.anlegen('Teststandort B');
  assert.equal(h.rows.length, 1);
  assert.equal(h.bestaetigungen(), 0);
  const lastToast = h.toasts.at(-1);
  assert.ok(lastToast);
  assert.match(lastToast[0], /Enterprise/);
});

const team = [{ id: 'employee-1' }, { id: 'employee-2' }];
const plan = [
  { owner_id: 'owner-A', employee_id: 'employee-1', business_id: 'location-A', weekday: 1, datum: null, gueltig_ab: null },
  { owner_id: 'owner-A', employee_id: 'employee-1', business_id: 'location-B', weekday: 1, datum: null, gueltig_ab: '2026-11-09' },
  { owner_id: 'owner-A', employee_id: 'employee-1', business_id: 'location-A', weekday: null, datum: '2026-11-16', gueltig_ab: null },
  // Selbst bei gleichem Mitarbeiter-Schluessel darf fremder Mandant den Plan nicht beeinflussen.
  { owner_id: 'owner-B', employee_id: 'employee-1', business_id: 'foreign-location', weekday: 1, datum: null, gueltig_ab: '2026-11-02' },
  { owner_id: 'owner-A', employee_id: 'unassigned', business_id: 'location-B', weekday: 1, datum: null, gueltig_ab: null },
];
/** @param {{ error?: { code?: string, message?: string } | null }} [opts] */
function planAdapter({ error = null } = {}) {
  /** @type {Array<{ owner: string | undefined, ids: string[] }>} */
  const calls = [];
  return { calls, from(/** @type {string} */ table) {
    assert.equal(table, 'employee_standort_plan');
    /** @type {string | undefined} */
    let owner;
    return {
      select(/** @type {string} */ columns) { assert.ok(columns.split(',').includes('gueltig_ab')); return this; },
      eq(/** @type {string} */ key, /** @type {string} */ value) { assert.equal(key, 'owner_id'); owner = value; return this; },
      async in(/** @type {string} */ key, /** @type {string[]} */ ids) {
        assert.equal(key, 'employee_id');
        assert.equal(owner, 'owner-A', 'Ownerfilter muss vor Ausfuehrung gesetzt sein');
        calls.push({ owner, ids: ids.slice() });
        return { data: error ? null : plan.filter(row => row.owner_id === owner && ids.includes(row.employee_id)), error };
      },
    };
  } };
}

for (const [datum, erlaubt] of [['2026-11-02', 'location-A'], ['2026-11-09', 'location-B'], ['2026-11-16', 'location-A']]) {
  test(`Frontend und Backend: Wochenversion/Einzeltag ${datum} nur ${erlaubt}`, async () => {
    resetBackend(); resetFrontend();
    const db = planAdapter();
    /** @type {any} */
    const supabaseMock = db;
    /** @type {Array<import('../api-backend/lib/standort-plan.js').StandortPlanZeile & { owner_id?: string }>} */
    const zeilen = await ladeStandortPlan(supabaseMock, { ownerId: 'owner-A', employeeIds: team.map(e => e.id) });
    assert.equal(zeilen.some(row => row.owner_id !== 'owner-A' || row.employee_id === 'unassigned'), false);
    for (const standort of ['location-A', 'location-B']) {
      const backend = planErlaubt(zeilen, 'employee-1', datum, standort);
      const frontend = await planSpalten(db, { team, bookings: [], datum, businessId: standort, ownerId: 'owner-A' });
      assert.equal(backend, standort === erlaubt);
      assert.equal(frontend.some(e => e.id === 'employee-1'), backend);
      assert.equal(frontend.some(e => e.id === 'unassigned'), false, 'Plan erweitert zugeordnetes Team nie');
    }
  });
}

test('Vorhandene Buchung bleibt sichtbar, obwohl Plan neuen Slot dort sperrt', async () => {
  resetBackend(); resetFrontend();
  const db = planAdapter();
  const zeilen = await ladeStandortPlan(/** @type {any} */ (db), { ownerId: 'owner-A', employeeIds: team.map(e => e.id) });
  assert.equal(planErlaubt(zeilen, 'employee-1', '2026-11-09', 'location-A'), false);
  const sichtbar = await planSpalten(db, { team, bookings: [{ user_id: 'employee-1' }], datum: '2026-11-09', businessId: 'location-A', ownerId: 'owner-A' });
  assert.deepEqual(sichtbar, team);
});

test('Alte Box ohne Plantabelle: begrenzter Fallback und Erholung nach Sperrzeit', async () => {
  resetBackend(); resetFrontend();
  const fehlend = planAdapter({ error: { code: '42P01' } });
  for (let lauf = 0; lauf < 2; lauf++) {
    const z = await ladeStandortPlan(/** @type {any} */ (fehlend), { ownerId: 'owner-A', employeeIds: ['employee-1'] }, 1000);
    assert.equal(planErlaubt(z, 'employee-1', '2026-11-09', 'location-A'), true);
  }
  assert.equal(fehlend.calls.length, 1);
  const gesund = planAdapter();
  const z = await ladeStandortPlan(/** @type {any} */ (gesund), { ownerId: 'owner-A', employeeIds: ['employee-1'] }, 601001);
  assert.equal(planErlaubt(z, 'employee-1', '2026-11-09', 'location-A'), false);
  const unveraendert = await planSpalten(fehlend, { team, datum: '2026-11-09', businessId: 'location-A', ownerId: 'owner-A' });
  assert.equal(unveraendert, team);
});
