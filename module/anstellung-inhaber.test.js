import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { urlaubsKennzahlen, arbeitstageImZeitraum } from './anstellung.js';

// Echter Dashboard-Anschluss, synthetische Daten; kein Login und kein DB-Zugriff.
const dashboard = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const anschluss = dashboard.slice(dashboard.indexOf('async function loadEmpUrlaubSection('),
  dashboard.indexOf('\nasync function deleteEmpTimeOff('));

async function laden({ offs = [], error = null, basis = {} } = {}) {
  const kpi = { innerHTML: '', textContent: '' }, liste = { innerHTML: '', textContent: '' };
  const filter = [];
  const query = { select() { return this; }, eq() { return this; },
    lte(k, v) { filter.push(['lte', k, v]); return this; },
    gte(k, v) { filter.push(['gte', k, v]); return this; },
    order() { return Promise.resolve({ data: offs, error }); } };
  const context = vm.createContext({
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2025-12-31T23:30:00Z'])); } },
    Intl, supabase: { from: () => query },
    anstellungFuerUrlaub: async () => ({ anspruch: 28, arbeitstage: new Set([1, 2, 3, 4, 5]), vorhanden: true, fehler: false, ...basis }),
    urlaubsKennzahlen, arbeitstageImZeitraum,
  });
  const fn = vm.runInContext(`${anschluss}\nloadEmpUrlaubSection`, context);
  await fn('synthetischer-mitarbeiter', { querySelector: selector => selector === '.emp-urlaub-kpi' ? kpi : liste });
  return { kpi, liste, filter };
}

test('Inhaber nutzt Berliner Jahr und Intervallüberlappung statt vollständiger Einschließung', async () => {
  const result = await laden();
  assert.deepEqual(result.filter, [
    ['lte', 'start_date', '2026-12-31T23:59:59.999+01:00'],
    ['gte', 'end_date', '2026-01-01T00:00:00+01:00'],
  ]);
});

test('Inhaber und Mitarbeiter rechnen Jahresüberhänge und überlappenden Urlaub gleich', async () => {
  const offs = [
    { id: 'a', start_date: '2025-12-29', end_date: '2026-01-05', type: 'urlaub' },
    { id: 'b', start_date: '2026-01-02', end_date: '2026-01-05', type: 'urlaub' },
    { id: 'c', start_date: '2026-12-31T14:00:00+01:00', end_date: '2027-01-05', type: 'urlaub' },
  ];
  const expected = urlaubsKennzahlen({ abwesenheiten: offs, anspruch: 28, arbeitstage: new Set([1, 2, 3, 4, 5]), jahr: 2026 });
  const { kpi } = await laden({ offs });
  assert.equal(expected.verbraucht, 4);
  assert.match(kpi.innerHTML, new RegExp(`>${expected.rest}</div>`));
  assert.match(kpi.innerHTML, new RegExp(`>${expected.verbraucht}</div>`));
});

for (const fall of [
  { error: { code: 'offline' } },
  { basis: { fehler: true } },
  { basis: { vorhanden: false } },
]) test(`Inhaber zeigt keinen erfundenen vollen Saldo: ${JSON.stringify(fall)}`, async () => {
  const { kpi } = await laden(fall);
  assert.equal(kpi.innerHTML, '');
  assert.match(kpi.textContent, /nicht verfügbar|keine Anstellungsdaten/);
});

for (const basis of [{ fehler: true }, { vorhanden: false }]) test('Abwesenheiten bleiben ohne Saldobasis sichtbar und löschbar', async () => {
  const { liste } = await laden({ basis, offs: [{ id: 'urlaub-a', start_date: '2026-02-02', end_date: '2026-02-03', type: 'urlaub' }] });
  assert.match(liste.innerHTML, /Urlaub/);
  assert.match(liste.innerHTML, /deleteEmpTimeOff/);
  assert.doesNotMatch(liste.innerHTML, / AT/);
});
