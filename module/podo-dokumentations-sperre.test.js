import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dokumentationsLage } from './podo-dokumentations-sperre.js';

const tag = (datum, codes = ['78010'], storniert_am = null) => ({ behandlungsdatum: datum, hpnr_codes: codes, storniert_am });

test('aktiv ohne Mengengrenze → frei', () => {
  assert.equal(dokumentationsLage({ status: 'aktiv' }, [], '2026-10-10').stufe, 'frei');
  assert.equal(dokumentationsLage(null, null, '2026-10-10').stufe, 'frei');
});

test('abgerechnet, storniert, archiviert → Sperre', () => {
  for (const status of ['abgerechnet', 'storniert', 'archiviert']) {
    const l = dokumentationsLage({ status, behandlungseinheiten: 6 }, [], '2026-10-10');
    assert.equal(l.stufe, 'sperre', status);
    assert.equal(l.grund, status);
  }
});

test('Menge erreicht → Sperre für einen neuen Tag, nicht für einen vorhandenen', () => {
  const beh = [tag('2026-10-01'), tag('2026-10-05')];
  const neu = dokumentationsLage({ status: 'aktiv', behandlungseinheiten: 2 }, beh, '2026-10-10');
  assert.equal(neu.stufe, 'sperre');
  assert.equal(neu.grund, 'menge');
  assert.match(neu.titel, /2 von 2/);
  assert.equal(dokumentationsLage({ status: 'aktiv', behandlungseinheiten: 2 }, beh, '2026-10-05').stufe, 'frei');
});

test('stornierte und reine Befundtage verbrauchen keine Einheit', () => {
  const beh = [tag('2026-10-01'), tag('2026-10-03', ['78010'], '2026-10-04'), tag('2026-10-05', ['78030'])];
  assert.equal(dokumentationsLage({ status: 'aktiv', behandlungseinheiten: 2 }, beh, '2026-10-10').stufe, 'frei');
});

test('abrechenbar → Warnung, aber Menge erreicht geht vor', () => {
  assert.equal(dokumentationsLage({ status: 'abrechenbar', behandlungseinheiten: 3 }, [tag('2026-10-01')], '2026-10-10').stufe, 'warnung');
  const voll = dokumentationsLage({ status: 'abrechenbar', behandlungseinheiten: 1 }, [tag('2026-10-01')], '2026-10-10');
  assert.equal(voll.grund, 'menge');
});

test('abgesetzt / Teilabsetzung → Warnung', () => {
  assert.equal(dokumentationsLage({ status: 'abgesetzt' }, [], '2026-10-10').stufe, 'warnung');
  assert.equal(dokumentationsLage({ status: 'teilabsetzung' }, [], '2026-10-10').stufe, 'warnung');
});

test('abgerechnet sperrt auch, wenn die Menge noch nicht erreicht ist', () => {
  const l = dokumentationsLage({ status: 'abgerechnet', behandlungseinheiten: 6 }, [tag('2026-10-01')], '2026-10-10');
  assert.equal(l.grund, 'abgerechnet');
  assert.match(l.text, /Support/);
});
