import test from 'node:test';
import assert from 'node:assert/strict';
import { istPrivatRezeptart, zahlertypAusRezeptart, starteRechnungAusVerordnung } from './rechnung-bruecke.js';

test('zahlertyp: selbstzahler und bg eigene Typen, sonst privat', () => {
  assert.equal(zahlertypAusRezeptart('selbstzahler'), 'selbstzahler');
  assert.equal(zahlertypAusRezeptart('bg'), 'bg');
  assert.equal(zahlertypAusRezeptart('privat'), 'privat');
  assert.equal(zahlertypAusRezeptart(undefined), 'privat');
});

test('Nicht-Kasse-Arten gelten als privat-Art, Kasse nicht', () => {
  for (const a of ['privat', 'selbstzahler', 'bg']) assert.equal(istPrivatRezeptart(a), true, a);
  assert.equal(istPrivatRezeptart('kassen'), false);
  assert.equal(istPrivatRezeptart(null), false);
});

test('BG ohne Träger/Anschrift/Unfalltag: keine Rechnung, Fehlermeldung nennt die Lücken', async () => {
  const meldungen = [];
  let editorGeoeffnet = false;
  await starteRechnungAusVerordnung({
    sb: null, ownerId: 'o', verordnung: { id: 'v', rezeptart: 'bg', bg_traeger_name: 'BG' },
    services: [], katalogPodo: [], switchPanel: () => {}, openInvEditor: async () => { editorGeoeffnet = true; },
    setzeEntwurf: () => {}, toast: (t, art) => meldungen.push([t, art]),
  });
  assert.equal(editorGeoeffnet, false);
  assert.equal(meldungen.length, 1);
  assert.equal(meldungen[0][1], 'error');
  assert.match(meldungen[0][0], /UV-Träger \(Anschrift\)/);
  assert.match(meldungen[0][0], /Unfalltag/);
  assert.doesNotMatch(meldungen[0][0], /UV-Träger \(Name\)/);
});
