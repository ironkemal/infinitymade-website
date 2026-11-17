import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefePatientPflicht } from './patient-pflichtfelder.js';

const heute = new Date('2026-11-17T10:00:00');

test('Fund 1: Geburtsdatum in der Zukunft wird abgelehnt', () => {
  assert.match(pruefePatientPflicht({ geburtsdatum: '2030-01-01', versicherungsart: 'gkv', praxis: true, heute }), /Zukunft/);
});

test('Fund 1: Geburtsdatum vor 1900 wird abgelehnt', () => {
  assert.match(pruefePatientPflicht({ geburtsdatum: '1899-12-31', versicherungsart: 'gkv', praxis: true, heute }), /prüfen/);
});

test('Fund 1: Versicherungsart ist in der Praxis Pflicht', () => {
  assert.match(pruefePatientPflicht({ geburtsdatum: '1975-04-12', versicherungsart: undefined, praxis: true, heute }), /Versicherungsart/);
  assert.equal(pruefePatientPflicht({ geburtsdatum: '1975-04-12', versicherungsart: 'privat', praxis: true, heute }), null);
  assert.equal(pruefePatientPflicht({ geburtsdatum: '1975-04-12', versicherungsart: null, praxis: false, heute }), null);
});

test('leeres und heutiges Geburtsdatum', () => {
  assert.match(pruefePatientPflicht({ geburtsdatum: '', versicherungsart: 'gkv', praxis: true, heute }), /erforderlich/);
  assert.equal(pruefePatientPflicht({ geburtsdatum: '2026-11-17', versicherungsart: 'gkv', praxis: true, heute }), null);
});

// P1-7 Nachtrag (17.11.2026): Schnellerfassung nahm 2030 als Geburtsdatum an.
test('Schnellerfassung prüft ein angegebenes Geburtsdatum', async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const quelle = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  const start = quelle.indexOf("    const geburt = document.getElementById('sfGeburt')");
  const zeile = quelle.slice(start, quelle.indexOf('\n', start));
  for (const [wert, sollFehler] of [['2030-01-01', true], ['1975-04-12', false], ['', false]]) {
    const errorEl = { textContent: '', style: {} };
    const ctx = { errorEl, pruefePatientPflicht, document: { getElementById: () => ({ value: wert, focus() {} }) } };
    vm.runInNewContext(`(() => {\n${zeile}\n})()`, ctx);
    assert.equal(!!errorEl.textContent, sollFehler, wert);
  }
});
