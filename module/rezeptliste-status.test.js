// Nachtrag Fund 6 (17.11.2026): die Rezepttabelle (loadPatRxTable) zeigte in_therapy/cancelled roh.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { verordnungStatusInfo } from './abrechnungsstatus.js';

const quelle = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const start = quelle.indexOf('    const sc = statusColors[rx.status]');
const zeile = quelle.slice(start, quelle.indexOf('\n', start));

test('Rezepttabelle: unbekannte Schlüssel bekommen das deutsche Etikett', () => {
  for (const [status, soll] of [['in_therapy', 'In Behandlung'], ['cancelled', 'Storniert']]) {
    const ctx = { statusColors: {}, rx: { status }, verordnungStatusInfo };
    vm.runInNewContext(`${zeile}\nthis.ergebnis = sc;`, ctx);
    assert.equal(ctx.ergebnis.label, soll);
  }
});
