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

test('Multi-Heilmittel: X0501x6 + X1201x6 gemischte Sitzungen mit Doppelbehandlung nur im 2. Item', () => {
  const multiRx = {
    id: 'rx-multi-1',
    heilmittel: 'KG',
    heilmittel_position: 'X0501',
    anzahl_einheiten: 12,
    heilmittel_items: [
      { code: 'X0501', bezeichnung: 'KG', einheiten: 6, doppelbehandlung: false },
      { code: 'X1201', bezeichnung: 'MT', einheiten: 6, doppelbehandlung: true },
    ],
  };

  // 6 Sitzungen für X0501 (heilmittel_index 0) mit Anzahl 1
  // 3 Sitzungen für X1201 (heilmittel_index 1) mit Anzahl 2 (Doppelbehandlung)
  // Gemischt angeordnet:
  const sessions = [
    s('1', { heilmittel_index: 0 }),
    s('2', { heilmittel_index: 1 }),
    s('3', { heilmittel_index: 0 }),
    s('4', { heilmittel_index: 1 }),
    s('5', { heilmittel_index: 0 }),
    s('6', { heilmittel_index: 0 }),
    s('7', { heilmittel_index: 1 }),
    s('8', { heilmittel_index: 0 }),
    s('9', { heilmittel_index: 0 }),
  ];

  const z = physioLeistungszeilen(multiRx, sessions);
  assert.equal(z.length, 9);

  // Überprüfe jede Zeile
  assert.deepEqual(z.map(x => [x.sessionId, x.code, x.anzahl, x.art]), [
    ['1', 'X0501', 1, 'vorrangig'],
    ['2', 'X1201', 2, 'vorrangig'],
    ['3', 'X0501', 1, 'vorrangig'],
    ['4', 'X1201', 2, 'vorrangig'],
    ['5', 'X0501', 1, 'vorrangig'],
    ['6', 'X0501', 1, 'vorrangig'],
    ['7', 'X1201', 2, 'vorrangig'],
    ['8', 'X0501', 1, 'vorrangig'],
    ['9', 'X0501', 1, 'vorrangig'],
  ]);

  // Summen je Position:
  const x0501Sum = z.filter(x => x.code === 'X0501').reduce((sum, x) => sum + x.anzahl, 0);
  const x1201Sum = z.filter(x => x.code === 'X1201').reduce((sum, x) => sum + x.anzahl, 0);
  assert.equal(x0501Sum, 6);
  assert.equal(x1201Sum, 6);
});

test('Multi-Heilmittel: HEILMITTEL_UEBER_MENGE wenn erbrachte > verordnet für ein Item', () => {
  const multiRx = {
    id: 'rx-multi-2',
    heilmittel_items: [
      { code: 'X0501', einheiten: 2, doppelbehandlung: false },
      { code: 'X1201', einheiten: 2, doppelbehandlung: false },
    ],
  };

  // 3 Sitzungen mit index 0, obwohl nur 2 Einheiten verordnet
  const sessions = [
    s('1', { heilmittel_index: 0 }),
    s('2', { heilmittel_index: 0 }),
    s('3', { heilmittel_index: 0 }),
  ];

  assert.throws(
    () => physioLeistungszeilen(multiRx, sessions),
    e => e.code === 'HEILMITTEL_UEBER_MENGE' && e.status === 422
  );
});

test('Multi-Heilmittel: HEILMITTEL_INDEX_UNBEKANNT wenn Sitzungsindex außerhalb der Items liegt', () => {
  const multiRx = {
    id: 'rx-multi-3',
    heilmittel_items: [
      { code: 'X0501', einheiten: 6, doppelbehandlung: false },
    ],
  };

  const sessions = [
    s('1', { heilmittel_index: 5 }), // Index 5 existiert nicht
  ];

  assert.throws(
    () => physioLeistungszeilen(multiRx, sessions),
    e => e.code === 'HEILMITTEL_INDEX_UNBEKANNT' && e.status === 422
  );
});
