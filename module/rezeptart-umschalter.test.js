import test from 'node:test';
import assert from 'node:assert/strict';
import { wendeArtAn, GKV_ZU_KLASSE } from './rezeptart-umschalter.js';

function fakeWrap() {
  const klassen = new Set();
  return {
    dataset: {},
    classList: {
      toggle: (k, an) => { if (an) klassen.add(k); else klassen.delete(k); },
      contains: (k) => klassen.has(k),
    },
  };
}

test('Kasse: Attribut kassen, GKV-Block offen', () => {
  const w = fakeWrap();
  assert.equal(wendeArtAn(w, 'kassen'), 'kassen');
  assert.equal(w.dataset.rezeptart, 'kassen');
  assert.equal(w.classList.contains(GKV_ZU_KLASSE), false);
});

test('Privat/Selbstzahler/BG: GKV-Block zu (eingeklappt), Attribut gesetzt', () => {
  for (const a of ['privat', 'selbstzahler', 'bg']) {
    const w = fakeWrap();
    wendeArtAn(w, a);
    assert.equal(w.dataset.rezeptart, a);
    assert.equal(w.classList.contains(GKV_ZU_KLASSE), true, a);
  }
});

test('Aufklappen bleibt erhalten, solange nicht auf Kasse zurückgeschaltet wird', () => {
  const w = fakeWrap();
  w.dataset.gkvOffen = '1';
  wendeArtAn(w, 'privat');
  assert.equal(w.classList.contains(GKV_ZU_KLASSE), false);
  wendeArtAn(w, 'kassen');
  assert.equal(w.dataset.gkvOffen, undefined, 'Rückschaltung auf Kasse setzt die Aufklapp-Wahl zurück');
});

test('gkv/NULL werden zu kassen normalisiert', () => {
  const w = fakeWrap();
  assert.equal(wendeArtAn(w, 'gkv'), 'kassen');
  assert.equal(wendeArtAn(w, null), 'kassen');
});
