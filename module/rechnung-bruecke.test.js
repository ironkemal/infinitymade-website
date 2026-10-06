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

// ── M2.7: patientenverständlicher Zeilentext (PE-006 C) ─────────────────────
import { zeilenAusBehandlungen } from './rechnung-bruecke.js';

test('Privatzeile 78020/78010 ohne eigene Leistung: Klartext statt „groß/klein", nie „Komplexbehandlung"', () => {
  const beh = [{ behandlungsdatum: '2026-09-20', hpnr_codes: ['78020', '78010'] }];
  const katalog = [{ code: '78020', title: 'Podologische Behandlung (groß)' }, { code: '78010', title: 'Podologische Behandlung (klein)' }];
  const { zeilen } = zeilenAusBehandlungen(beh, { verordnung: { rezeptart: 'privat' }, services: [], katalogPodo: katalog });
  assert.equal(zeilen[0].title, 'Podologische Behandlung (Hornhaut und Nägel), Therapiezeit über 20 Minuten');
  assert.equal(zeilen[1].title, 'Podologische Behandlung (Hornhaut und Nägel), Therapiezeit bis 20 Minuten');
  assert.ok(zeilen.every(z => !/Komplex/.test(z.title)));
});

test('Eigene Leistung der Praxis hat Vorrang vor dem Klartext', () => {
  const beh = [{ behandlungsdatum: '2026-09-20', hpnr_codes: ['78020'] }];
  const services = [{ gkv_position_nr: '78020', title: 'Meine große Behandlung', price: 60 }];
  const { zeilen } = zeilenAusBehandlungen(beh, { verordnung: {}, services, katalogPodo: [] });
  assert.equal(zeilen[0].title, 'Meine große Behandlung');
});

test('Andere Kodes behalten den Katalogtitel', () => {
  const beh = [{ behandlungsdatum: '2026-09-20', hpnr_codes: ['78030'] }];
  const { zeilen } = zeilenAusBehandlungen(beh, { verordnung: {}, services: [], katalogPodo: [{ code: '78030', title: 'Podologische Befundung' }] });
  assert.equal(zeilen[0].title, 'Podologische Befundung');
});
