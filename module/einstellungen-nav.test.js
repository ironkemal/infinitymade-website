import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navEintraege } from './einstellungen-nav.js';

test('navEintraege: Gruppenköpfe nur vor sichtbaren Abschnitten, unsichtbare und titellose fallen weg', () => {
  const z = [
    { gruppe: 'Allgemein', id: 'a', titel: 'Profil', sichtbar: true },
    { gruppe: 'Allgemein', id: 'b', titel: 'Ausfallgebühr', sichtbar: false },
    { gruppe: 'Abrechnung', id: 'c', titel: '', sichtbar: true },
    { gruppe: 'Abrechnung', id: 'd', titel: 'Rechnungsdaten', sichtbar: true },
    { gruppe: 'Leer', id: 'e', titel: 'X', sichtbar: false },
  ];
  assert.deepEqual(navEintraege(z), [
    { art: 'gruppe', titel: 'Allgemein' }, { art: 'abschnitt', id: 'a', titel: 'Profil' },
    { art: 'gruppe', titel: 'Abrechnung' }, { art: 'abschnitt', id: 'd', titel: 'Rechnungsdaten' },
  ]);
  assert.deepEqual(navEintraege(null), []);
});
