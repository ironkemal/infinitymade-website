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

// ── behandlungenVerknuepfen: kein stilles „ok" bei 0 Treffern (KHS M2.3) ────
import { behandlungenVerknuepfen } from './rechnung-bruecke.js';

function sbStub(zurueck) {
  const aufrufe = [];
  const kette = {
    update: (w) => { aufrufe.push(['update', w]); return kette; },
    is: () => kette, in: () => kette,
    select: () => Promise.resolve(zurueck),
  };
  return { sb: { from: () => kette }, aufrufe };
}

test('Verknüpfen: alle Zeilen getroffen -> ok mit Anzahl', async () => {
  const { sb } = sbStub({ data: [{ id: 'a' }, { id: 'b' }], error: null });
  const r = await behandlungenVerknuepfen(sb, { invoiceId: 'i', behandlungIds: ['a', 'b'] });
  assert.deepEqual([r.ok, r.anzahl], [true, 2]);
});

test('Verknüpfen: RLS trifft 0 Zeilen (Mitarbeiter) -> ok:false mit deutscher Meldung', async () => {
  const { sb } = sbStub({ data: [], error: null });
  const r = await behandlungenVerknuepfen(sb, { invoiceId: 'i', behandlungIds: ['a', 'b'] });
  assert.equal(r.ok, false);
  assert.equal(r.anzahl, 0);
  assert.match(r.meldung, /0 von 2 Behandlungen/);
  assert.match(r.meldung, /Doppelt/i);
});

test('Verknüpfen: nur ein Teil getroffen -> ok:false, Zahl in der Meldung', async () => {
  const { sb } = sbStub({ data: [{ id: 'a' }], error: null });
  const r = await behandlungenVerknuepfen(sb, { invoiceId: 'i', behandlungIds: ['a', 'b', 'c'] });
  assert.equal(r.ok, false);
  assert.match(r.meldung, /1 von 3/);
});

test('Verknüpfen: Datenbankfehler -> ok:false', async () => {
  const { sb } = sbStub({ data: null, error: new Error('x') });
  const r = await behandlungenVerknuepfen(sb, { invoiceId: 'i', behandlungIds: ['a'] });
  assert.equal(r.ok, false);
});
