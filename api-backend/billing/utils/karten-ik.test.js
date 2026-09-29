import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  istKartenIk,
  kartenIkFehler,
  KARTEN_IK_FEHLT_CODE,
} from './karten-ik.js';

test('istKartenIk: genau 9 Ziffern', () => {
  assert.equal(istKartenIk('108310400'), true);
  assert.equal(istKartenIk(108310400), true);

  // Ungültige Formate
  assert.equal(istKartenIk(''), false);
  assert.equal(istKartenIk(null), false);
  assert.equal(istKartenIk(undefined), false);
  assert.equal(istKartenIk('10831040'), false);        // 8 Stellen
  assert.equal(istKartenIk('1083104000'), false);      // 10 Stellen
  assert.equal(istKartenIk('108 310 400'), false);     // Leerzeichen
  assert.equal(istKartenIk('10831040a'), false);       // Buchstabe
  assert.equal(istKartenIk('abcdefghi'), false);       // Nur Buchstaben
});

test('kartenIkFehler: 9 Ziffern -> null (kein Fehler)', () => {
  const rx = { id: '12345678-abcd-1234', krankenkasse_ik: '108310400' };
  const err = kartenIkFehler(rx, { vorname: 'Max', nachname: 'Mustermann' });
  assert.equal(err, null);
});

test('kartenIkFehler: leer / fehlt -> Error mit status 422, code KARTEN_IK_FEHLT, kurzer Verordnungs-ID und Patientenname', () => {
  const rx = { id: 'abcdef12-3456-7890', krankenkasse_ik: '' };
  const np = { vorname: 'Erika', nachname: 'Musterfrau' };
  const err = kartenIkFehler(rx, np);

  assert.ok(err instanceof Error);
  assert.equal(err.status, 422);
  assert.equal(err.code, KARTEN_IK_FEHLT_CODE);
  assert.equal(err.code, 'KARTEN_IK_FEHLT');
  assert.equal(
    err.message,
    'Verordnung abcdef12 (Erika Musterfrau): IK der Krankenkasse von der Versichertenkarte fehlt — in der Verordnung eintragen.'
  );
});

test('kartenIkFehler: 8 Ziffern -> Error mit status 422', () => {
  const rx = { id: '98765432-1111', krankenkasse_ik: '10831040' }; // 8 Ziffern
  const err = kartenIkFehler(rx, { vorname: 'Hans' });

  assert.ok(err instanceof Error);
  assert.equal(err.status, 422);
  assert.equal(err.code, 'KARTEN_IK_FEHLT');
  assert.equal(
    err.message,
    'Verordnung 98765432 (Hans): IK der Krankenkasse von der Versichertenkarte fehlt — in der Verordnung eintragen.'
  );
});

test('kartenIkFehler: ohne Patientenname', () => {
  const rx = { id: '12345678-0000', krankenkasse_ik: null };
  const err = kartenIkFehler(rx);

  assert.ok(err instanceof Error);
  assert.equal(err.status, 422);
  assert.equal(err.code, 'KARTEN_IK_FEHLT');
  assert.equal(
    err.message,
    'Verordnung 12345678: IK der Krankenkasse von der Versichertenkarte fehlt — in der Verordnung eintragen.'
  );
});

test('kartenIkFehler: rx ist null oder undefined', () => {
  const err = kartenIkFehler(null);
  assert.ok(err instanceof Error);
  assert.equal(err.status, 422);
  assert.equal(err.code, 'KARTEN_IK_FEHLT');
  assert.equal(
    err.message,
    'Verordnung : IK der Krankenkasse von der Versichertenkarte fehlt — in der Verordnung eintragen.'
  );
});
