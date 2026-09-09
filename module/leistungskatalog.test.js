import { test } from 'node:test';
import assert from 'node:assert/strict';

import { katalogNachladen } from './leistungskatalog.js';

// Vollständige Wahrheitstabelle des Wächters — das ist der einzige Fehler-
// Kandidat: die vier Fälle, die er unterscheiden muss (Ops-Meldung, 09.09.2026,
// "Kein Leistungskatalog hinterlegt." trotz vorhandenem Katalog).

test('leerer Katalog -> muss nachladen', () => {
  assert.equal(katalogNachladen({ katalog: [], sektorHatGkvKatalog: false }), true);
});

test('leerer Katalog + Sektor mit GKV-Katalog -> muss nachladen', () => {
  assert.equal(katalogNachladen({ katalog: [], sektorHatGkvKatalog: true }), true);
});

test('nicht-leerer Katalog ohne gkv_position_nr, Sektor hat GKV-Katalog -> muss nachladen (Seed fehlt noch)', () => {
  const katalog = [{ title: 'Fußpflege', price: 30 }];
  assert.equal(katalogNachladen({ katalog, sektorHatGkvKatalog: true }), true);
});

test('nicht-leerer Katalog mit gkv_position_nr -> kein Nachladen', () => {
  const katalog = [{ title: 'Podologie', gkv_position_nr: '78010' }];
  assert.equal(katalogNachladen({ katalog, sektorHatGkvKatalog: true }), false);
});

test('nicht-leerer Katalog, Sektor ohne GKV-Katalog -> kein Nachladen', () => {
  const katalog = [{ title: 'Massage', price: 40 }];
  assert.equal(katalogNachladen({ katalog, sektorHatGkvKatalog: false }), false);
});

test('katalog undefined wird wie leer behandelt', () => {
  assert.equal(katalogNachladen({ katalog: undefined, sektorHatGkvKatalog: false }), true);
});
