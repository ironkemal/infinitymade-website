import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navEintraege } from './formular-abschnitte.js';

const z = (gruppe, id, titel, sichtbar = true) => ({ gruppe, id, titel, sichtbar });

test('Gruppen werden einmal je Folge ausgegeben, Abschnitte dahinter', () => {
  assert.deepEqual(navEintraege([z('Allgemein', 'a', 'Profil'), z('Allgemein', 'b', 'Zeiten'), z('Finanzen', 'c', 'Preise')]), [
    { art: 'gruppe', titel: 'Allgemein' }, { art: 'abschnitt', id: 'a', titel: 'Profil' }, { art: 'abschnitt', id: 'b', titel: 'Zeiten' },
    { art: 'gruppe', titel: 'Finanzen' }, { art: 'abschnitt', id: 'c', titel: 'Preise' }]);
});
test('Unsichtbare, id- und titellose Zeilen fallen weg', () => {
  assert.deepEqual(navEintraege([z('G', 'a', 'A', false), z('G', '', 'B'), z('G', 'c', '  '), z('G', 'd', ' D ')]),
    [{ art: 'gruppe', titel: 'G' }, { art: 'abschnitt', id: 'd', titel: 'D' }]);
});
test('Gruppe ohne sichtbare Abschnitte fällt weg', () => {
  assert.deepEqual(navEintraege([z('Leer', 'a', 'A', false), z('Voll', 'b', 'B')]),
    [{ art: 'gruppe', titel: 'Voll' }, { art: 'abschnitt', id: 'b', titel: 'B' }]);
});
test('Ohne Gruppe: nur Abschnitte; null/leer sicher', () => {
  assert.deepEqual(navEintraege([z('', 'a', 'A')]), [{ art: 'abschnitt', id: 'a', titel: 'A' }]);
  assert.deepEqual(navEintraege(null), []);
  assert.deepEqual(navEintraege([null, undefined]), []);
});
