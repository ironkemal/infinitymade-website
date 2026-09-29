import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadGeburtsdatum, leadHausbesuch, leadMetadataZusammenfuehren } from './lead-felder.js';

test('Geburtsdatum: Spalte gewinnt, sonst metadata, sonst null', () => {
  assert.equal(leadGeburtsdatum({ geburtsdatum: '1980-01-02', metadata: { geburtsdatum: '1990-01-01' } }), '1980-01-02');
  assert.equal(leadGeburtsdatum({ geburtsdatum: null, metadata: { geburtsdatum: '1990-01-01' } }), '1990-01-01');
  assert.equal(leadGeburtsdatum({ geburtsdatum: '', metadata: {} }), null);
  assert.equal(leadGeburtsdatum(null), null);
});

test('Hausbesuch: true aus Spalte oder metadata', () => {
  assert.equal(leadHausbesuch({ hausbesuch: true }), true);
  assert.equal(leadHausbesuch({ hausbesuch: false, metadata: { hausbesuch: true } }), true);
  assert.equal(leadHausbesuch({ hausbesuch: null, metadata: { hausbesuch: true } }), true);
  assert.equal(leadHausbesuch({ hausbesuch: false, metadata: { hausbesuch: false } }), false);
  assert.equal(leadHausbesuch({}), false);
  assert.equal(leadHausbesuch(undefined), false);
});

test('Merge: unbekannte Schluessel bleiben, Formschluessel werden ersetzt/geleert', () => {
  const alt = { versichertennummer: 'A123456789', krankenkasse: 'AOK', geburtsdatum: '1990-01-01', hausbesuch: true };
  const neu = leadMetadataZusammenfuehren(alt, { krankenkasse: null, versichertenstatus: '10000' }, ['geburtsdatum', 'hausbesuch']);
  assert.deepEqual(neu, { versichertennummer: 'A123456789', versichertenstatus: '10000' });
});

test('Merge: leeres Ergebnis wird null, Eingabe wird nicht veraendert', () => {
  const alt = { geburtsdatum: '1990-01-01' };
  assert.equal(leadMetadataZusammenfuehren(alt, {}, ['geburtsdatum']), null);
  assert.deepEqual(alt, { geburtsdatum: '1990-01-01' });
  assert.equal(leadMetadataZusammenfuehren(null, {}), null);
  assert.deepEqual(leadMetadataZusammenfuehren(null, { a: 1 }), { a: 1 });
});
