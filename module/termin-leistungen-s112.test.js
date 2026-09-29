// S1.12 (29.09.2026): Befundungsvorschlag ist ein ungehaktes Kaestchen, keine
// Zeile. Seriendreh: 78040 nur am ersten Termin, nie mit 78030 zusammen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  neueZeile, gesamtDauer, fuegeZeileHinzu, mitBefundungsvorschlag,
  vorschlagText, zeilenFuerTermin, raeumeAngenommenenVorschlag,
  speichereLeistungen, mountTerminLeistungen, setzeLeistungen,
} from './termin-leistungen.js';

const DIENSTE = [
  { id: 's-beh-kl', gkv_position_nr: '78010', duration_minutes: 35 },
  { id: 's-beh-gr', gkv_position_nr: '78020', duration_minutes: 50 },
  { id: 's-bef',    gkv_position_nr: '78030', duration_minutes: null },
  { id: 's-eing',   gkv_position_nr: '78040', duration_minutes: 20 },
  { id: 's-nsp',    gkv_position_nr: '78610', duration_minutes: 45 },
];

test('neuer Patient: Eingangsbefundung ist Vorschlag, KEINE Zeile', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-gr')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(r.zeilen.length, 1);
  assert.deepEqual(r.vorschlag, { serviceId: 's-eing', code: '78040', angenommen: false });
  assert.match(r.rueckfrage, /01\.11\.2023/);
});

test('ungehakter Vorschlag verlaengert den Block nicht, gehakt schon', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-gr')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(gesamtDauer(r.zeilen, DIENSTE), 50);
  const gehakt = fuegeZeileHinzu(r.zeilen, r.vorschlag.serviceId);
  assert.equal(gesamtDauer(gehakt, DIENSTE), 70);
  assert.equal(gehakt[1].auto, false, 'gehakt = normale Anwenderauswahl');
});

test('laufende Serie: Vorschlag ist 78030', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-kl')], dienste: DIENSTE, datum: '2026-09-03',
    behandlungen: [{ behandlungsdatum: '2026-08-04', hpnr_codes: ['78030', '78010'] }],
  });
  assert.equal(r.zeilen.length, 1);
  assert.equal(r.vorschlag.serviceId, 's-bef');
});

test('Nagelspange: weder Zeile noch Vorschlag', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-nsp')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(r.zeilen.length, 1);
  assert.equal(r.vorschlag, null);
});

test('Hinweis: Datum TT.MM.JJJJ, eingeplant/dokumentiert, nie "abgerechnet"', () => {
  const geplant = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-kl')], dienste: DIENSTE, datum: '2026-10-05',
    behandlungen: [{ behandlungsdatum: '2026-09-28', hpnr_codes: ['78040', '78010'], geplant: true }],
  });
  assert.match(geplant.hinweis, /am 28\.09\.2026 bereits eingeplant/);
  assert.doesNotMatch(geplant.hinweis, /abgerechnet/);

  const doku = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-kl')], dienste: DIENSTE, datum: '2026-10-05',
    behandlungen: [{ behandlungsdatum: '2026-09-28', hpnr_codes: ['78040', '78010'] }],
  });
  assert.match(doku.hinweis, /am 28\.09\.2026 bereits dokumentiert/);
  assert.doesNotMatch(doku.hinweis, /abgerechnet/);
});

test('bereits von Hand gewaehlt: Vorschlag steht als angenommen da', () => {
  const r = mitBefundungsvorschlag({
    zeilen: [neueZeile('s-beh-gr'), neueZeile('s-eing')], dienste: DIENSTE, behandlungen: [], datum: '2026-09-03',
  });
  assert.equal(r.grund, 'schon_gewaehlt');
  assert.equal(r.vorschlag.angenommen, true);
});

test('vorschlagText: Einzeltermin und Serie', () => {
  assert.equal(vorschlagText('78030'), 'Vorschlag: Befundung (78030) übernehmen');
  assert.equal(vorschlagText('78030', { serie: true }), 'Befundung (78030) in alle Serientermine übernehmen');
  assert.equal(vorschlagText('78040'), 'Vorschlag: Podologische Eingangsbefundung (78040) übernehmen');
  assert.match(vorschlagText('78040', { serie: true }), /nur am ersten Serientermin/);
  assert.match(vorschlagText('78040', { minuten: 20 }), /\(\+20 Min\.\)$/);
});

test('zeilenFuerTermin: 78040 nur am ersten Termin', () => {
  const z = [neueZeile('s-beh-gr'), neueZeile('s-eing')];
  assert.deepEqual(zeilenFuerTermin(z, 0, DIENSTE).map(x => x.serviceId), ['s-beh-gr', 's-eing']);
  assert.deepEqual(zeilenFuerTermin(z, 1, DIENSTE).map(x => x.serviceId), ['s-beh-gr']);
  assert.deepEqual(zeilenFuerTermin(z, 5, DIENSTE).map(x => x.serviceId), ['s-beh-gr']);
});

test('zeilenFuerTermin: 78040 und 78030 nie am selben Termin', () => {
  const z = [neueZeile('s-beh-gr'), neueZeile('s-eing'), neueZeile('s-bef')];
  assert.deepEqual(zeilenFuerTermin(z, 0, DIENSTE).map(x => x.serviceId), ['s-beh-gr', 's-eing']);
  assert.deepEqual(zeilenFuerTermin(z, 1, DIENSTE).map(x => x.serviceId), ['s-beh-gr', 's-bef']);
  assert.equal(z.length, 3, 'Eingabe unberuehrt');
});

test('raeumeAngenommenenVorschlag: gehakte Zeile faellt mit dem Vorschlag weg', () => {
  const z = [neueZeile('s-beh-gr'), neueZeile('s-eing')];
  const alt = { serviceId: 's-eing', code: '78040', angenommen: true };
  assert.equal(raeumeAngenommenenVorschlag(z, alt, null).length, 1);
  assert.equal(raeumeAngenommenenVorschlag(z, alt, { serviceId: 's-eing' }).length, 2);
  assert.equal(raeumeAngenommenenVorschlag(z, null, null).length, 2);
});

function fakeMaske() {
  const els = {
    bkService: { value: 's-beh-gr', addEventListener: () => {} },
    bkMenge: { value: '1', addEventListener: () => {} },
  };
  globalThis.document = { getElementById: (id) => els[id] || null };
}
function fakeSupabase() {
  const upserts = [];
  const kette = {
    upsert: (zeilen) => { upserts.push(zeilen); return Promise.resolve({ error: null }); },
    delete: () => kette,
    in: () => kette,
    not: () => Promise.resolve({ error: null }),
  };
  return { supabase: { from: () => kette }, upserts };
}

test('speichern (Serie): 78040 nur am ersten Termin, nie mit 78030', async () => {
  fakeMaske();
  const { supabase, upserts } = fakeSupabase();
  mountTerminLeistungen({ supabase, getOwnerId: () => 'o', getServices: () => DIENSTE });
  setzeLeistungen(['s-beh-gr', 's-eing', 's-bef']);
  await speichereLeistungen(['b-1', 'b-2', 'b-3']);
  const je = id => upserts[0].filter(z => z.booking_id === id).map(z => z.service_id);
  assert.deepEqual(je('b-1'), ['s-beh-gr', 's-eing']);
  assert.deepEqual(je('b-2'), ['s-beh-gr', 's-bef']);
  assert.deepEqual(je('b-3'), ['s-beh-gr', 's-bef']);
});

test('speichern ohne Haekchen: keine Befundung an keinem Termin', async () => {
  fakeMaske();
  const { supabase, upserts } = fakeSupabase();
  mountTerminLeistungen({ supabase, getOwnerId: () => 'o', getServices: () => DIENSTE });
  setzeLeistungen(['s-beh-gr']);
  await speichereLeistungen(['b-1', 'b-2']);
  assert.ok(upserts[0].every(z => z.service_id === 's-beh-gr'));
});
