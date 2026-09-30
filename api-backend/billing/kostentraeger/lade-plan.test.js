// Umschaltlogik Q3 -> Q4 (W-01 #10/#11): Datum entscheidet, nichts wird hart gelöscht.
import test from 'node:test';
import assert from 'node:assert/strict';
import { waehleAusgaben, planKostentraeger, planKind, besteJeIk, tagDavor, vdtZuIso, sollZeilen, adim2Sperre, VKG_SCHLUESSEL, ANS_SCHLUESSEL } from './lade-plan.js';

const AUSGABEN = [
  { datei: 'AO05Q326_KE3.txt', gueltigAb: '2026-07-27' },
  { datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-10-01' },
  { datei: 'EK05Q226_KE0.txt', gueltigAb: '2026-04-01' },
  { datei: 'EK05Q426_KE1.txt', gueltigAb: '2026-10-01' },
  { datei: 'BN050526_KE0.txt', gueltigAb: '2026-05-01' },
];

test('waehleAusgaben: vor dem Stichtag alte Ausgabe gültig, neue nur "kommend"', () => {
  const r = waehleAusgaben(AUSGABEN, '2026-09-30');
  assert.deepEqual(r.aktiv.map(a => a.datei).sort(), ['AO05Q326_KE3.txt', 'BN050526_KE0.txt', 'EK05Q226_KE0.txt']);
  assert.deepEqual(r.kommend.map(a => a.datei).sort(), ['AO05Q426_KE0.txt', 'EK05Q426_KE1.txt']);
});

test('waehleAusgaben: am 01.10. wechselt es von selbst', () => {
  const r = waehleAusgaben(AUSGABEN, '2026-10-01');
  assert.deepEqual(r.aktiv.map(a => a.datei).sort(), ['AO05Q426_KE0.txt', 'BN050526_KE0.txt', 'EK05Q426_KE1.txt']);
  assert.equal(r.kommend.length, 0);
});

test('waehleAusgaben: Kassenart ohne gültige Ausgabe wird gemeldet', () => {
  assert.deepEqual(waehleAusgaben(AUSGABEN, '2026-01-01').ohneGueltige.sort(), ['AO', 'BN', 'EK']);
});

test('Datums-Hilfen', () => {
  assert.equal(vdtZuIso('20260930'), '2026-09-30');
  assert.equal(vdtZuIso(null), null);
  assert.equal(tagDavor('2026-10-01'), '2026-09-30');
  assert.equal(tagDavor('2026-01-01'), '2025-12-31');
});

const rec = (ik, extra = {}) => ({ ik, name: 'K' + ik, namensteile: ['Kasse', ik], valid_from: '19950801', valid_to: null, datenannahmestellen: [], anschriften: [], ...extra });
const dbz = (ik, extra = {}) => ({ ik, name: `Kasse ${ik}`, kurzname: 'K' + ik, valid_from: '1995-08-01', valid_to: null, abrechnender_kt_ik: null, ist_abrechnender_kt: true, quelle: 'AO05Q326_KE3.txt', quelle_stand: '2026-07-27', datensatz_status: 'echt', ...extra });

test('Vorlauf VOR dem Stichtag: Enddaten der kommenden Ausgabe + entfallene IK werden datiert, nichts sonst', () => {
  const alt = { ausgabe: AUSGABEN[0], records: [rec('111'), rec('222'), rec('333')] };
  const neu = { ausgabe: AUSGABEN[1], records: [rec('111'), rec('222', { valid_to: '20260930' })] }; // 333 entfällt
  const db = [dbz('111'), dbz('222'), dbz('333'), dbz('999', { datensatz_status: 'mock_unbestaetigt', quelle: null })];
  const p = planKostentraeger({ dbZeilen: db, aktiv: [alt], kommend: [neu], stichtag: '2026-09-30' });
  assert.equal(p.inserts.length, 0);
  const byIk = Object.fromEntries(p.patches.map(x => [x.ik, x.patch]));
  assert.deepEqual(byIk['222'], { valid_to: '2026-09-30' });
  assert.deepEqual(byIk['333'], { valid_to: '2026-09-30' }); // Tag vor gültig-ab der Nachfolgeausgabe
  assert.ok(!byIk['111'], 'unveränderte IK bleibt unberührt');
  assert.ok(!byIk['999'], 'Mock-Zeile nie anfassen');
});

test('Wegfall ist nie ein DELETE und überschreibt kein früheres Ende', () => {
  const neu = { ausgabe: AUSGABEN[1], records: [rec('111')] };
  const db = [dbz('111'), dbz('333', { valid_to: '2026-06-30' })];
  const p = planKostentraeger({ dbZeilen: db, aktiv: [neu], kommend: [], stichtag: '2026-10-01' });
  assert.ok(!p.patches.some(x => x.ik === '333'), 'früheres Ende 30.06. bleibt');
});

test('historischer Doppelsatz in anderer Datei beendet die aktive IK NICHT (besteJeIk)', () => {
  const bk = { ausgabe: { datei: 'BK05Q426_KE0.txt', gueltigAb: '2026-10-01' }, records: [rec('555', { valid_to: '20170331' })] };
  const ek = { ausgabe: { datei: 'EK05Q426_KE1.txt', gueltigAb: '2026-10-01' }, records: [rec('555')] };
  assert.equal(besteJeIk([bk, ek]).get('555').r.valid_to, null);
  assert.equal(besteJeIk([ek, bk]).get('555').r.valid_to, null);
  const db = [dbz('555', { quelle: 'EK05Q226_KE0.txt' })];
  const p = planKostentraeger({ dbZeilen: db, aktiv: [{ ausgabe: AUSGABEN[2], records: [rec('555')] }], kommend: [bk, ek], stichtag: '2026-09-30' });
  assert.ok(!p.patches.some(x => 'valid_to' in x.patch));
});

test('neue IK wird eingefügt, valid_from aus der Datei; bestehende bekommt kein valid_from', () => {
  const neu = { ausgabe: AUSGABEN[1], records: [rec('111', { valid_from: '20261001' }), rec('777', { valid_from: '20261001' })] };
  const p = planKostentraeger({ dbZeilen: [dbz('111')], aktiv: [neu], kommend: [], stichtag: '2026-10-01' });
  assert.equal(p.inserts.length, 1);
  assert.equal(p.inserts[0].valid_from, '2026-10-01');
  assert.ok(!p.patches.some(x => 'valid_from' in x.patch));
});

const vkgDb = (ik, partner, id, extra = {}) => ({ id, kostentraeger_ik: ik, verknuepfungsart: '09', partner_ik: partner, abrechnungscode: '71', art_datenlieferung: '28', uebermittlungsmedium: '6', bundesland: '', leistungserbringergruppe: '', quelle: 'AO05Q326_KE3.txt', quelle_stand: '2026-07-27', valid_from: null, valid_to: null, ...extra });
const vkgSoll = (ik, partner, extra = {}) => {
  const z = { kostentraeger_ik: ik, verknuepfungsart: '09', partner_ik: partner, abrechnungscode: '71', art_datenlieferung: '28', uebermittlungsmedium: '6', bundesland: '', leistungserbringergruppe: '', quelle: 'AO05Q426_KE0.txt', quelle_stand: '2026-10-01', valid_from: '2026-10-01', ...extra };
  return [VKG_SCHLUESSEL.map(f => z[f]).join('|'), z];
};
const VERGLEICH = ['quelle', 'quelle_stand', 'leistungserbringergruppe'];

test('planKind Q3->Q4: veralteter Schlüssel wird NICHT gelöscht, sondern bekommt valid_to = Tag vor gültig-ab', () => {
  const dbZeilen = [vkgDb('108310400', '108916709', 1), vkgDb('108310400', '108910008', 2, { quelle: 'X' }), vkgDb('108916709', '108916709', 3)];
  const soll = new Map([vkgSoll('108310400', '108910008')]);
  const p = planKind({ dbZeilen, soll, felder: VKG_SCHLUESSEL, vergleich: VERGLEICH });
  assert.deepEqual(p.closes, [{ id: 1, valid_to: '2026-09-30' }]); // alter Partner
  assert.equal(p.inserts.length, 0);
  assert.equal(p.updates.length, 1); // Bestand bekommt neue Quelle
  assert.ok(!p.closes.some(c => c.id === 3), 'Zeile der entfallenen IK bleibt unberührt');
  assert.ok(!('deletes' in p), 'es gibt keinen DELETE-Pfad mehr');
});

test('planKind: valid_from geht NICHT in den Update-Payload (sonst heute ohne Empfänger)', () => {
  const dbZeilen = [vkgDb('108310400', '108910008', 2, { quelle: 'X' })];
  const soll = new Map([vkgSoll('108310400', '108910008')]);
  const p = planKind({ dbZeilen, soll, felder: VKG_SCHLUESSEL, vergleich: VERGLEICH });
  assert.equal(p.updates.length, 1);
  assert.ok(!('valid_from' in p.updates[0]), 'valid_from nie im Update');
  assert.ok(!('valid_to' in p.updates[0]), 'valid_to nur bei reopen');
  assert.equal(p.updates[0].quelle_stand, '2026-10-01');
});

test('planKind: neuer Schlüssel wird mit valid_from = gültig-ab eingefügt (ohne valid_to)', () => {
  const soll = new Map([vkgSoll('108310400', '108910008')]);
  const p = planKind({ dbZeilen: [vkgDb('108310400', '108916709', 1)], soll, felder: VKG_SCHLUESSEL, vergleich: VERGLEICH });
  assert.equal(p.inserts.length, 1);
  assert.equal(p.inserts[0].valid_from, '2026-10-01');
  assert.ok(!('valid_to' in p.inserts[0]));
});

test('planKind: geschlossener Schlüssel kehrt zurück -> valid_to = NULL, weiterhin ohne valid_from', () => {
  const dbZeilen = [vkgDb('108310400', '108910008', 2, { valid_to: '2026-06-30' })];
  const soll = new Map([vkgSoll('108310400', '108910008', { quelle: 'AO05Q326_KE3.txt', quelle_stand: '2026-07-27' })]);
  const p = planKind({ dbZeilen, soll, felder: VKG_SCHLUESSEL, vergleich: VERGLEICH });
  assert.equal(p.reopens.length, 1);
  assert.equal(p.reopens[0].valid_to, null);
  assert.ok(!('valid_from' in p.reopens[0]));
  assert.equal(p.updates.length, 0);
  assert.equal(p.closes.length, 0);
});

test('planKind: bereits früher geschlossene Zeile wird nicht verlängert oder erneut angefasst', () => {
  const dbZeilen = [vkgDb('108310400', '108916709', 1, { valid_to: '2026-06-30' }), vkgDb('108310400', '108916710', 5, { valid_to: '2026-09-30' })];
  const soll = new Map([vkgSoll('108310400', '108910008')]);
  const p = planKind({ dbZeilen, soll, felder: VKG_SCHLUESSEL, vergleich: VERGLEICH });
  assert.equal(p.closes.length, 0, 'valid_to <= neuer Endtag bleibt');
});

test('planKind: ein späteres valid_to (nach dem neuen Endtag) wird auf den Endtag gekürzt', () => {
  const dbZeilen = [vkgDb('108310400', '108916709', 1, { valid_to: '2026-12-31' })];
  const soll = new Map([vkgSoll('108310400', '108910008')]);
  const p = planKind({ dbZeilen, soll, felder: VKG_SCHLUESSEL, vergleich: VERGLEICH });
  assert.deepEqual(p.closes, [{ id: 1, valid_to: '2026-09-30' }]);
});

test('planKind: Anschriften laufen über denselben Pfad (ANS_SCHLUESSEL)', () => {
  const ansDb = (id, plz, extra = {}) => ({ id, kostentraeger_ik: '108310400', art: '1', plz, ort: 'X', strasse: 'S', quelle: 'AO05Q326_KE3.txt', quelle_stand: '2026-07-27', valid_from: null, valid_to: null, ...extra });
  const neu = { kostentraeger_ik: '108310400', art: '1', plz: '22222', ort: 'X', strasse: 'S', quelle: 'AO05Q426_KE0.txt', quelle_stand: '2026-10-01', valid_from: '2026-10-01' };
  const soll = new Map([[ANS_SCHLUESSEL.map(f => neu[f]).join('|'), neu]]);
  const p = planKind({ dbZeilen: [ansDb(1, '11111')], soll, felder: ANS_SCHLUESSEL, vergleich: ['quelle', 'quelle_stand'] });
  assert.equal(p.inserts.length, 1);
  assert.deepEqual(p.closes, [{ id: 1, valid_to: '2026-09-30' }]);
});

test('sollZeilen: Sollzeilen tragen valid_from = gültig-ab der Ausgabe (nur für INSERT)', () => {
  const ausgabe = { datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-10-01' };
  const records = [{ ik: '111', datenannahmestellen: [{ verknuepfungsart: '03', partner_ik: '222', abrechnungscode: '71', art_datenlieferung: '07' }], anschriften: [{ art: '1', plz: '1', ort: 'o', strasse: 's' }] }];
  const { vkg, ans } = sollZeilen([{ ausgabe, records }]);
  assert.equal([...vkg.values()][0].valid_from, '2026-10-01');
  assert.equal([...ans.values()][0].valid_from, '2026-10-01');
});

test('adim2Sperre: Stichtag nach heute wird verweigert, heute/Vergangenheit erlaubt', () => {
  assert.match(adim2Sperre('2026-10-01', '2026-09-30'), /O-139 Adim 2/);
  assert.equal(adim2Sperre('2026-09-30', '2026-09-30'), null);
  assert.equal(adim2Sperre('2026-01-01', '2026-09-30'), null);
});
