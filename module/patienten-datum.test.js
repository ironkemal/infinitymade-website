import test from 'node:test';
import assert from 'node:assert/strict';
import { datumDe } from './datum.js';

test('datumDe: normalisiert Geburtsdatum auf TT.MM.JJJJ (Patientenakte)', () => {
  // ISO-Datum aus der DB
  assert.equal(datumDe('1942-02-02'), '02.02.1942');
  // Bereits deutsches Format mit einstelligen Ziffern (der Fehler: "2.2.1942")
  assert.equal(datumDe('2.2.1942'), '02.02.1942');
  assert.equal(datumDe('02.02.1942'), '02.02.1942');
  assert.equal(datumDe('9.1.1965'), '09.01.1965');
  // Leerstring und ungültig
  assert.equal(datumDe('', '—'), '—');
  assert.equal(datumDe(null, '—'), '—');
});

test('datumDe: formatiert Kiosk-Datum auf TT.MM.JJJJ (Kiosk / Tablet)', () => {
  // Canlı test: Kiosk "2.11.2026" -> "02.11.2026"
  const kioskTag = new Date(2026, 10, 2, 10, 0); // 2. November 2026
  assert.equal(datumDe(kioskTag), '02.11.2026');
  assert.equal(datumDe('2026-11-02'), '02.11.2026');
  assert.equal(datumDe('2.11.2026'), '02.11.2026');
});
