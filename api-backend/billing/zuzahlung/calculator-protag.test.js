import test from 'node:test';
import assert from 'node:assert/strict';

import { calcAbrechnungsfallZuzahlungProTag } from './calculator.js';

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
