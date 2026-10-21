import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ausfallFaelligAm, gespeicherteAusfallFaelligkeit, ausfallIstFaellig } from './faelligkeit.js';
import { renderAusfallrechnung } from '../pdf/ausfallrechnung.template.js';

test('Berliner Rechnungsdatum und Kalendertage bleiben über Sommerzeit stabil', () => {
  assert.equal(ausfallFaelligAm('2026-03-28T23:30:00Z', 1), '2026-03-30');
  assert.equal(ausfallFaelligAm('2026-10-24T22:30:00Z', 1), '2026-10-26');
});
test('Ungültige Vorlagenwerte ergeben sichere 14 Kalendertage', () => {
  for (const days of [0, -2, 1.5, Infinity, 'abc', Number.MAX_SAFE_INTEGER, null]) {
    assert.equal(ausfallFaelligAm('2026-01-01T12:00:00Z', days), '2026-01-15');
  }
  assert.equal(ausfallFaelligAm('2026-01-01T12:00:00Z', '30'), '2026-01-31');
});
test('Altbelege und ungültige Datumswerte werden nie automatisch gemahnt', () => {
  for (const faellig_am of [null, undefined, '2026-02-30', 'garbage']) {
    assert.equal(gespeicherteAusfallFaelligkeit({ faellig_am }), null);
    assert.equal(ausfallIstFaellig({ faellig_am }), false);
  }
});
test('Überfällig erst nach Ende des Berliner Fälligkeitstages', () => {
  const row = { faellig_am: '2026-01-15' };
  assert.equal(ausfallIstFaellig(row, new Date('2026-01-15T22:59:59Z')), false);
  assert.equal(ausfallIstFaellig(row, new Date('2026-01-15T23:00:00Z')), true);
});
test('Explizite Fälligkeit gewinnt gegen geänderte Rechnungsvorlage', () => {
  for (const days of [5, 30, 90]) {
    const html = renderAusfallrechnung({ rechnung: { datum: '2026-01-01', faelligkeit: '2026-01-15' }, vorlage: { zahlungsziel_tage: days } });
    assert.match(html, /15\.1\.2026/);
    assert.doesNotMatch(html, /31\.1\.2026/);
  }
});
