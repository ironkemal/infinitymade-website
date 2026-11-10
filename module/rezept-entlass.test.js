import test from 'node:test';
import assert from 'node:assert/strict';
import { entlassFelderAusFormular, entlassFeldHtml, merkmalZuAuswahl, entlassMaskeAktualisieren, entlassNutzlastAusMaske } from './rezept-entlass.js';
import { entlassFelderAusRezept } from '../api-backend/lib/rezept-felder.js';

const an = { schemaAktiv: true };

test('Schema aus: keine Felder, kein HTML (Alt-Verhalten)', () => {
  assert.deepEqual(entlassFelderAusFormular({ auswahl: 'ja', datum: '2026-11-01' }), { ok: true, felder: {} });
  assert.equal(entlassFeldHtml({ entlassmanagement: true }), '');
});

test('Roundtrip: jedes Formularergebnis besteht die Serverprüfung', () => {
  for (const werte of [
    { auswahl: 'ja', datum: '2026-11-01' }, { auswahl: 'nein', datum: '' }, { auswahl: '', datum: '2026-11-01' },
  ]) {
    const r = entlassFelderAusFormular(werte, an);
    assert.equal(r.ok, true);
    assert.deepEqual(entlassFelderAusRezept(r.felder), r.felder);
  }
});

test('Ja ohne/mit kaputtem Datum und Blanko+Ja werden abgelehnt; ungeprüft bleibt null, nie false', () => {
  assert.equal(entlassFelderAusFormular({ auswahl: 'ja', datum: '' }, an).ok, false);
  assert.equal(entlassFelderAusFormular({ auswahl: 'ja', datum: '2026-13-45' }, an).ok, false);
  assert.equal(entlassFelderAusFormular({ auswahl: 'ja', datum: '2026-11-01' }, { ...an, istBlanko: true }).ok, false);
  assert.equal(entlassFelderAusFormular({ auswahl: '', datum: '' }, an).felder.entlassmanagement, null);
});

test('HTML: gespeicherter Stand wird abgebildet, Datum nur bei Ja aktiv', () => {
  assert.equal(merkmalZuAuswahl(null), '');
  assert.match(entlassFeldHtml({ entlassmanagement: true, entlassungsdatum: '2026-11-01' }, an), /value="2026-11-01"/);
  assert.match(entlassFeldHtml({ entlassmanagement: false }, an), /disabled/);
});

function fakeDoc() {
  const els = { rzEntlassWrap: { innerHTML: '', hidden: true, dataset: {} }, rzEntlass: { value: '', addEventListener() {} }, rzEntlassDatum: { value: '', disabled: true } };
  return { els, getElementById: id => els[id] ?? null };
}
const fakeDb = (antwort) => ({ from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => antwort, limit: async () => antwort };
  return q;
} });

test('Maske: Schema fehlt (42703) -> versteckt, keine Felder in der Nutzlast', async () => {
  const d = fakeDoc();
  assert.equal(await entlassMaskeAktualisieren(d, fakeDb({ data: null, error: { code: '42703' } }), { bereich: 'physio' }), false);
  assert.equal(d.els.rzEntlassWrap.hidden, true);
  assert.deepEqual(entlassNutzlastAusMaske(d), {});
});

test('Maske: nur Physio; Podologie bleibt leer', async () => {
  const d = fakeDoc();
  assert.equal(await entlassMaskeAktualisieren(d, fakeDb({ data: [{}], error: null }), { bereich: 'podo' }), false);
  assert.equal(d.els.rzEntlassWrap.hidden, true);
});

test('Maske: Praxis-Sektor physiotherapy zaehlt als physio (erstes Oeffnen)', async () => {
  const d = fakeDoc();
  const ok = await entlassMaskeAktualisieren(d, fakeDb({ data: [], error: null }), { bereich: 'physiotherapy' });
  assert.equal(ok, true);
  assert.equal(d.els.rzEntlassWrap.hidden, false);
});

test('Maske: Bearbeiten laedt gespeicherten Stand; Nutzlast-Paar besteht die Serverpruefung', async () => {
  const d = fakeDoc();
  const ok = await entlassMaskeAktualisieren(d, fakeDb({ data: { entlassmanagement: true, entlassungsdatum: '2026-11-01' }, error: null }), { rxId: 'r1', bereich: 'physio' });
  assert.equal(ok, true);
  assert.equal(d.els.rzEntlassWrap.hidden, false);
  assert.match(d.els.rzEntlassWrap.innerHTML, /value="2026-11-01"/);
  // Markup-IDs muessen zu den getElementById-Abfragen passen (live-Fund 10.11.: rx* vs rz*)
  assert.match(d.els.rzEntlassWrap.innerHTML, /id="rzEntlass"/);
  assert.match(d.els.rzEntlassWrap.innerHTML, /id="rzEntlassDatum"/);
  d.els.rzEntlass.value = 'ja'; d.els.rzEntlassDatum.value = '2026-11-01';
  const felder = entlassNutzlastAusMaske(d);
  assert.deepEqual(entlassFelderAusRezept(felder), felder);
  d.els.rzEntlass.value = '';
  assert.deepEqual(entlassNutzlastAusMaske(d), { entlassmanagement: null, entlassungsdatum: null });
});

test('Nutzlast: Ja ohne Datum und Ja+Blanko werden unvollstaendig gesendet -> Server lehnt ab (kein stilles Speichern)', async () => {
  const d = fakeDoc();
  await entlassMaskeAktualisieren(d, fakeDb({ data: [{}], error: null }), { bereich: 'physio' });
  d.els.rzEntlass.value = 'ja';
  const f1 = entlassNutzlastAusMaske(d);
  assert.throws(() => entlassFelderAusRezept(f1), e => e.code === 'ENTLASSDATEN_UNGUELTIG');
  d.els.rzEntlassDatum.value = '2026-11-01';
  const f2 = entlassNutzlastAusMaske(d, { istBlanko: true });
  assert.throws(() => entlassFelderAusRezept(f2), e => e.code === 'ENTLASSDATEN_UNGUELTIG');
});

test('Veraltete Antwort (zweiter Aufruf gestartet) zeichnet nicht', async () => {
  const d = fakeDoc();
  let freigeben;
  const langsam = { from: () => { const q = { select: () => q, eq: () => q, maybeSingle: () => new Promise(r => { freigeben = () => r({ data: { entlassmanagement: false, entlassungsdatum: null }, error: null }); }), limit: async () => ({ data: [{}], error: null }) }; return q; } };
  const erste = entlassMaskeAktualisieren(d, langsam, { rxId: 'r1', bereich: 'physio' });
  await entlassMaskeAktualisieren(d, fakeDb({ data: [{}], error: null }), { bereich: 'physio' });
  freigeben();
  assert.equal(await erste, false);
});
