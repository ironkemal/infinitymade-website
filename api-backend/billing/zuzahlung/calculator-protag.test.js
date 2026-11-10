import test from 'node:test';
import assert from 'node:assert/strict';

import { calcAbrechnungsfallZuzahlungProTag, isBefreit, isUnter18 } from './calculator.js';

const sitz = (datum) => ({ datum, preis_eur: 20, zuzahlung_eur_position: 2 });
test('je Tag: Geburtstag mitten in der Verordnung — Tage davor frei, danach 10 %, Pauschale entfaellt (erster Tag frei)', () => {
  const r = calcAbrechnungsfallZuzahlungProTag({
    sessions: [sitz('2026-11-01'), sitz('2026-11-02'), sitz('2026-11-10')],
    patient: { geburtsdatum: '2008-11-02' },
  });
  assert.equal(r.tage[0].befreiungsgrund, 'unter_18');
  assert.equal(r.tage[1].befreiungsgrund, null);
  assert.equal(r.prozZuzahlung, 4);
  assert.equal(r.pauschZuzahlung, 0);
  assert.equal(r.gesZuzahlung, 4);
});
test('je Tag: unterjaehrige Befreiung ab Datum — Pauschale am (pflichtigen) ersten Tag, danach frei', () => {
  const r = calcAbrechnungsfallZuzahlungProTag({
    sessions: [sitz('2026-03-01'), sitz('2026-03-20')],
    patient: { geburtsdatum: '1980-01-01', befreiungen: [{ jahr: 2026, befreit_ab: '2026-03-10', befreit_bis: null }] },
  });
  assert.equal(r.tage[0].befreiungsgrund, null);
  assert.equal(r.tage[1].befreiungsgrund, 'befreiungsausweis');
  assert.equal(r.prozZuzahlung, 2);
  assert.equal(r.pauschZuzahlung, 10);
  assert.equal(r.gesZuzahlung, 12);
});
test('je Tag: nie ueber Brutto der pflichtigen Tage; ganz frei -> 0 mit Grund', () => {
  const klein = calcAbrechnungsfallZuzahlungProTag({ sessions: [{ datum: '2026-05-01', preis_eur: 5, zuzahlung_eur_position: 0.5 }], patient: {} });
  assert.equal(klein.gesZuzahlung, 5);
  const frei = calcAbrechnungsfallZuzahlungProTag({ sessions: [sitz('2026-05-01')], patient: { befreit_im_jahr: true } });
  assert.equal(frei.gesZuzahlung, 0);
  assert.equal(frei.befreiungsgrund, 'befreiungsausweis');
});
test('je Tag: fehlender Leistungstag wirft, privat unveraendert', () => {
  assert.throws(() => calcAbrechnungsfallZuzahlungProTag({ sessions: [{ preis_eur: 20 }], patient: {} }), /Leistungstag/);
  assert.equal(calcAbrechnungsfallZuzahlungProTag({ sessions: [], patient: { insurance_type: 'privat' } }).grund, 'privat');
});

test('Befreiung umfasst beide Nachweisgrenzen und endet erst am Folgetag', () => {
  const nachweise = [{ jahr: 2026, befreit_ab: '2026-03-10', befreit_bis: '2026-03-20' }];
  assert.equal(isBefreit(nachweise, 2026, '2026-03-09'), false);
  assert.equal(isBefreit(nachweise, 2026, '2026-03-10'), true);
  assert.equal(isBefreit(nachweise, 2026, '2026-03-20'), true);
  assert.equal(isBefreit(nachweise, 2026, new Date('2026-03-20T22:59:59Z')), true);
  assert.equal(isBefreit(nachweise, 2026, new Date('2026-03-20T23:00:00Z')), false);
  assert.equal(isBefreit(nachweise, 2026, '2026-03-21'), false);
  const r = calcAbrechnungsfallZuzahlungProTag({
    sessions: [sitz('2026-03-20'), sitz('2026-03-21')], patient: { befreiungen: nachweise },
  });
  assert.deepEqual(r.tage.map(t => t.zuzahlung), [0, 2]);
});

test('Leistungstage sind echte Kalenderdaten; Schaltjahr bleibt erlaubt', () => {
  for (const datum of ['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', 20261110]) {
    assert.throws(() => calcAbrechnungsfallZuzahlungProTag({ sessions: [sitz(datum)], patient: {} }), /Leistungstag/);
  }
  assert.equal(calcAbrechnungsfallZuzahlungProTag({ sessions: [sitz('2024-02-29')], patient: {} }).brutto, 20);
});

test('Befreiungsnachweise mit ungültigen oder vertauschten Grenzen sperren Berechnung', () => {
  for (const grenzen of [
    { befreit_ab: '2026-02-30', befreit_bis: null },
    { befreit_ab: null, befreit_bis: null },
    { befreit_ab: '2026-03-10', befreit_bis: '2026-02-30' },
    { befreit_ab: '2026-03-20', befreit_bis: '2026-03-10' },
  ]) {
    assert.throws(() => isBefreit([{ jahr: 2026, ...grenzen }], 2026, '2026-03-15'), /Befreiungsnachweis/);
  }
});

test('Befreiungsjahr folgt Berliner Leistungstag statt UTC-Vortag', () => {
  const b = [{ jahr: 2027, befreit_ab: '2027-01-01', befreit_bis: '2027-12-31' }];
  assert.equal(isBefreit(b, 2027, new Date('2026-12-31T23:30:00Z')), true);
  assert.equal(isBefreit(b, 2026, new Date('2026-12-31T23:30:00Z')), false);
});

test('Volljährigkeit folgt Kalendergeburtstag und Berliner Tag bei echten Zeitpunkten', () => {
  assert.equal(isUnter18('2008-11-02', '2026-11-01'), true);
  assert.equal(isUnter18('2008-11-02', '2026-11-02'), false);
  assert.equal(isUnter18('2008-11-02', new Date('2026-11-01T22:59:59Z')), true);
  assert.equal(isUnter18('2008-11-02', new Date('2026-11-01T23:00:00Z')), false);
  assert.equal(isUnter18('2008-02-29', '2026-02-28'), true);
  assert.equal(isUnter18('2008-02-29', '2026-03-01'), false);
});

test('Befreiungsprüfung normalisiert keine ungültigen Stichtage oder Zeitstempelstrings', () => {
  const b = [{ jahr: 2026, befreit_ab: '2026-03-01', befreit_bis: '2026-03-31' }];
  for (const ref of ['2026-02-30', '2026-02-30T12:00:00Z', '2026-03-15T12:00:00Z', null, new Date(NaN)]) {
    assert.throws(() => isBefreit(b, 2026, ref), /Leistungstag/);
  }
});

test('Tagesberechnung verwirft ungültige Preise statt sie in null Euro umzuwandeln', () => {
  for (const preis_eur of [undefined, null, '', 'abc', false, -1, 0, NaN, Infinity, '1e2', 1.001, 10_000_000_000]) {
    assert.throws(() => calcAbrechnungsfallZuzahlungProTag({
      sessions: [{ ...sitz('2026-03-15'), preis_eur }], patient: {},
    }), /Leistungsbetrag/);
  }
});

test('Tagesberechnung blockiert ungültige Positionszuzahlung und Gesamtüberlauf', () => {
  for (const zuzahlung_eur_position of [-1, 21, false, NaN, Infinity, '1e1', 1.001]) {
    assert.throws(() => calcAbrechnungsfallZuzahlungProTag({
      sessions: [{ ...sitz('2026-03-15'), zuzahlung_eur_position }], patient: {},
    }), /Positionszuzahlung/);
  }
  assert.throws(() => calcAbrechnungsfallZuzahlungProTag({
    sessions: [1, 2].map(() => ({ datum: '2026-03-15', preis_eur: 6_000_000_000, zuzahlung_eur_position: 0 })), patient: {},
  }), /Gesamtbetrag/);
  const ok = calcAbrechnungsfallZuzahlungProTag({
    sessions: [{ datum: '2026-03-15', preis_eur: '20.00', zuzahlung_eur_position: '2.00' }], patient: {},
  });
  assert.equal(ok.brutto, 20);
  assert.equal(ok.gesZuzahlung, 12);
});
