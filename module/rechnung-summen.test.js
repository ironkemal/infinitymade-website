import test from 'node:test';
import assert from 'node:assert/strict';
import { rechnungsSummen, summenAnzeige, typKennzeichen } from './rechnung-summen.js';

const zeilen = [{ quantity: 2, unit_price: 51.92 }];

test('Privat/Selbstzahler/BG: kein Zuzahlungsabzug, zu zahlen = Zwischensumme (auch wenn die versteckten Felder 10/10 enthalten)', () => {
  for (const typ of ['privat', 'selbstzahler', 'bg']) {
    const r = rechnungsSummen(zeilen, typ, '10', '10');
    assert.equal(r.sub, 103.84, typ);
    assert.equal(r.eigenPct, 0, typ);
    assert.equal(r.eigenEur, 0, typ);
    assert.equal(r.kasse, 0, typ);
    assert.equal(r.total, 103.84, typ);
  }
});

test('GKV und ohne Typ: Eigenanteil + Kassenzuzahlung wie bisher', () => {
  for (const typ of ['gkv', null, undefined, '']) {
    const r = rechnungsSummen([{ quantity: 1, unit_price: 100 }], typ, '10', '10');
    assert.equal(r.eigenEur, 10);
    assert.equal(r.kasse, 10);
    assert.equal(r.total, 20);
  }
});

test('Leere/ungültige Eingaben werden 0, nie NaN', () => {
  const r = rechnungsSummen([{ unit_price: 5 }], 'gkv', '', 'abc');
  assert.deepEqual([r.sub, r.eigenPct, r.eigenEur, r.kasse, r.total], [5, 0, 0, 0, 0]);
  assert.equal(rechnungsSummen([], 'privat', '', '').total, 0);
});

test('Anzeige in der Rechnungsansicht: Privat/Selbstzahler ohne Kassenzeilen, BG mit Empfänger-Beschriftung', () => {
  const p = summenAnzeige({ invoice_type: 'privat', kassenzuzahlung: 0 });
  assert.deepEqual([p.eigenZeigen, p.kasseZeigen, p.label], [false, false, 'Rechnungsbetrag']);
  assert.equal(summenAnzeige({ invoice_type: 'selbstzahler' }).label, 'Rechnungsbetrag');
  const b = summenAnzeige({ invoice_type: 'bg' });
  assert.deepEqual([b.eigenZeigen, b.kasseZeigen], [false, false]);
  assert.match(b.label, /Unfallversicherungsträger/);
  assert.doesNotMatch(b.label, /Patient/);
});

test('Anzeige: GKV-Zuzahlungsrechnung und Altrechnungen bleiben wie bisher „Zu zahlen (Patient)“ mit Kassenzeilen', () => {
  for (const inv of [{ invoice_type: 'gkv', kassenzuzahlung: 10 }, { invoice_type: null, kassenzuzahlung: 0 }, {}]) {
    const a = summenAnzeige(inv);
    assert.deepEqual([a.eigenZeigen, a.kasseZeigen, a.label], [true, true, 'Zu zahlen (Patient)']);
  }
});

test('Kennzeichen der Rechnungsliste', () => {
  assert.equal(typKennzeichen('gkv'), 'GKV');
  assert.equal(typKennzeichen('bg'), 'BG');
  assert.equal(typKennzeichen('selbstzahler'), 'Selbstzahler');
  assert.equal(typKennzeichen('privat'), 'Privat');
  assert.equal(typKennzeichen('irgendwas'), 'Privat');
});
