import { test } from 'node:test';
import assert from 'node:assert/strict';
import { physioLeistungszeilen } from './physio-leistungszeilen.js';

const rx = { id: 'rx-1', heilmittel_position: 'X0501', anzahl_einheiten: 6 };
const s = (id, extra = {}) => ({ id, done_at: `2026-11-0${id}T09:00:00Z`, ...extra });

test('nur vorrangig: eine Zeile je Sitzung, Anzahl 1', () => {
  const z = physioLeistungszeilen(rx, [s('1'), s('2')]);
  assert.deepEqual(z.map(x => [x.code, x.anzahl, x.art]), [['X0501', 1, 'vorrangig'], ['X0501', 1, 'vorrangig']]);
});

test('Doppelbehandlung: Anzahl 2 in EINER Zeile', () => {
  const z = physioLeistungszeilen({ ...rx, doppelbehandlung: true }, [s('1')]);
  assert.equal(z.length, 1);
  assert.equal(z[0].anzahl, 2);
});

test('ergänzend: eigene Zeile am selben Tag, nie doppelt', () => {
  const z = physioLeistungszeilen({ ...rx, doppelbehandlung: true, ergaenzend_position: 'X1302', ergaenzend_einheiten: 6 },
    [s('1', { ergaenzend_erbracht: true })]);
  assert.deepEqual(z.map(x => [x.code, x.anzahl, x.art, x.done_at]), [
    ['X0501', 2, 'vorrangig', '2026-11-01T09:00:00Z'], ['X1302', 1, 'ergaenzend', '2026-11-01T09:00:00Z']]);
});

test('ergänzend ohne Position → 422', () => {
  assert.throws(() => physioLeistungszeilen(rx, [s('1', { ergaenzend_erbracht: true })]), e => e.code === 'ERGAENZEND_POSITION_FEHLT' && e.status === 422);
});

test('ergänzend über verordneter Menge → 422', () => {
  const r = { ...rx, ergaenzend_position: 'X1302', ergaenzend_einheiten: 1 };
  assert.throws(() => physioLeistungszeilen(r, [s('1', { ergaenzend_erbracht: true }), s('2', { ergaenzend_erbracht: true })]),
    e => e.code === 'ERGAENZEND_UEBER_MENGE');
});

test('Hausbesuch: Pauschale nur an Tagen mit Hausbesuch-Termin, Ort entscheidet', () => {
  const r = { ...rx, hausbesuch: true, hausbesuch_ort: 'soziale_einrichtung' };
  const z = physioLeistungszeilen(r, [s('1', { bookings: { hausbesuch: true } }), s('2', { bookings: { hausbesuch: false } })]);
  assert.deepEqual(z.filter(x => x.art === 'hausbesuch').map(x => [x.sessionId, x.code]), [['1', 'X9951']]);
});

test('Hausbesuch ohne Ort (Altbestand) → häuslich X9950', () => {
  const z = physioLeistungszeilen({ ...rx, hausbesuch: true }, [s('1', { bookings: { hausbesuch: true } })]);
  assert.equal(z.find(x => x.art === 'hausbesuch').code, 'X9950');
});

test('Hausbesuch-Termin, Verordnung ohne „Hausbesuch: ja" → keine Pauschale', () => {
  const z = physioLeistungszeilen({ ...rx, hausbesuch: false }, [s('1', { bookings: { hausbesuch: true } })]);
  assert.equal(z.some(x => x.art === 'hausbesuch'), false);
});

test('Doppelbehandlung bei ungerader Menge: letzte Sitzung nur Anzahl 1', () => {
  const z = physioLeistungszeilen({ ...rx, anzahl_einheiten: 7, doppelbehandlung: true }, [s('1'), s('2'), s('3'), s('4')]);
  assert.deepEqual(z.map(x => x.anzahl), [2, 2, 2, 1]);
});
