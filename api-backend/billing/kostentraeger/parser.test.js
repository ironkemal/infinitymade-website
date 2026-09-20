// Standalone smoke test for kostentraeger parser + mock dataset.
//   node api-backend/billing/kostentraeger/parser.test.js

import {
  KOSTENTRAEGER_MOCK,
  routeToDatenannahmestelle,
  parseKostentraegerDatei,
  toUpsertRows,
  waehlePostanschrift,
} from './parser.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const ECHT_DIR = join(HIER, '..', '..', '..', 'wissensbank', 'gemeinsam', 'kostentraeger');
const ECHT_DATEIEN = [
  'AO05Q326_KE3.txt', 'BK05Q326_KE1.txt', 'IK05Q326_KE1.txt', 'BN050526_KE0.txt',
  'LK05Q226_KE0.txt', 'EK05Q226_KE0.txt', 'EK05Q426_KE0.txt',
];

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('kostentraeger.mock');

test('mock has >= 10 KK', () => {
  assert.ok(KOSTENTRAEGER_MOCK.length >= 10);
});

test('every mock entry has IK + name + das_ik', () => {
  for (const k of KOSTENTRAEGER_MOCK) {
    assert.match(k.ik, /^\d{9}$/, `bad IK: ${k.ik}`);
    assert.ok(k.name);
    assert.match(k.das_ik, /^\d{9}$/, `bad DAS-IK: ${k.das_ik}`);
  }
});

test('keine zwei Kassen teilen sich dieselbe IK', () => {
  const seen = new Map();
  for (const k of KOSTENTRAEGER_MOCK) {
    const vorher = seen.get(k.ik);
    assert.ok(!vorher, `IK ${k.ik} doppelt vergeben: "${vorher}" und "${k.name}"`);
    seen.set(k.ik, k.name);
  }
});

test('routeToDatenannahmestelle TK → vdek', () => {
  const r = routeToDatenannahmestelle('101575519');
  assert.equal(r.ok, true);
  assert.equal(r.das_ik, '108036123');
});

test('routeToDatenannahmestelle BAHN-BKK → Davaso (2026 switch)', () => {
  const r = routeToDatenannahmestelle('101317994');
  assert.equal(r.das_ik, '661430035');
  assert.match(r.das_kontakt, /davaso/i);
});

test('routeToDatenannahmestelle unknown IK returns error', () => {
  const r = routeToDatenannahmestelle('999999999');
  assert.equal(r.ok, false);
});

console.log('kostentraeger.parser');

test('parses minimal IDK/VDT/VKG/NAM round-trip', () => {
  const sample =
    "UNA:+,? '" +
    "IDK+107436001+01+AOK Rheinland/Hamburg'" +
    "VDT+20260101+99991231'" +
    "VKG+02+660500345+5++30'" +
    "IDK+101575519+01+Techniker Krankenkasse'" +
    "VDT+20260101'" +
    "VKG+02+108036123+5++30'";
  const records = parseKostentraegerDatei(sample);
  assert.equal(records.length, 2);
  assert.equal(records[0].ik, '107436001');
  assert.equal(records[0].name, 'AOK Rheinland/Hamburg');
  assert.equal(records[0].valid_from, '20260101');
  assert.equal(records[0].datenannahmestellen[0].partner_ik, '660500345');
  assert.equal(records[0].datenannahmestellen[0].art_datenlieferung, '30');
  assert.equal(records[1].ik, '101575519');
});

test('VKG-Feldreihenfolge stimmt mit einer echten Zeile aus der Kostenträgerdatei (Anhang 03 V10 §7.2)', () => {
  // Aus AO05Q326_KE3.txt, IDK+100395611 (AOK Nordost Region Meckl.-Vorp.) —
  // gegen `kostentraeger_annahmestellen` verifiziert (db-ustasi, 06.09.2026).
  const sample =
    "UNA:+,? '" +
    "IDK+100395611+02+AOK Nordost Region Meckl.-Vorp'" +
    "VDT+20171001'" +
    "VKG+02+100295017+5++07++01++00'";
  const records = parseKostentraegerDatei(sample);
  const vkg = records[0].datenannahmestellen[0];
  assert.equal(vkg.verknuepfungsart, '02');
  assert.equal(vkg.partner_ik, '100295017');
  assert.equal(vkg.leistungserbringergruppe, '5');
  assert.equal(vkg.abrechnungsstelle_ik, null);
  assert.equal(vkg.art_datenlieferung, '07');
  assert.equal(vkg.uebermittlungsmedium, null);
  assert.equal(vkg.bundesland, '01');
  assert.equal(vkg.abrechnungscode, '00');
});

test('toUpsertRows shape matches kostentraeger DB schema', () => {
  const rows = toUpsertRows();
  assert.ok(rows.length === KOSTENTRAEGER_MOCK.length);
  const tk = rows.find(r => r.name === 'Techniker Krankenkasse (TK)');
  assert.deepEqual(Object.keys(tk).sort(),
    ['active','das_ik','ik','name','payer_type','region','valid_from','valid_to'].sort());
});

test('Segmente auf eigener Zeile (wie in der echten Datei) werden genauso geparst wie eine Zeile', () => {
  // Der Bug vom 05.09.2026: das Inline-Beispiel oben hat keine Zeilenumbrueche,
  // die echte Kostentraegerdatei einen nach jedem Terminator. Ohne den Fix in
  // parseKostentraegerDatei() landet der Umbruch im Tag des naechsten Segments
  // ("\nIDK" statt "IDK"), keine einzige case-Klausel trifft, 0 Datensaetze.
  const mitZeilenumbruch =
    "UNA:+,? '\n" +
    "IDK+107436001+01+AOK Rheinland/Hamburg'\n" +
    "VDT+20260101+99991231'\n" +
    "VKG+02+660500345+5'\n";
  const records = parseKostentraegerDatei(mitZeilenumbruch);
  assert.equal(records.length, 1, 'Zeilenumbrueche zwischen Segmenten duerfen keine Datensaetze verschlucken');
  assert.equal(records[0].ik, '107436001');
  assert.equal(records[0].datenannahmestellen[0].partner_ik, '660500345');
});

// ── ANS-Segment und waehlePostanschrift ──────────────────────────────────────

console.log('kostentraeger.parser.ANS');

test('ANS: drei Adressarten werden korrekt geparst', () => {
  // Echte Beispiele aus IK05Q326_KE1.txt (IQVIA HSS / IKK).
  const sample =
    "UNA:+,? '" +
    "IDK+661430035+99+IQVIA HSS'" +
    "NAM+01+IQVIA+Health System Services GmbH'" +
    "ANS+1+04425+Taucha+Gaertnerweg 12'" +
    "ANS+3+04310+Leipzig'";
  const records = parseKostentraegerDatei(sample);
  assert.equal(records[0].anschriften.length, 2);

  const haus = records[0].anschriften[0];
  assert.equal(haus.art, '1');
  assert.equal(haus.plz, '04425');
  assert.equal(haus.ort, 'Taucha');
  assert.equal(haus.strasse, 'Gaertnerweg 12');

  const gross = records[0].anschriften[1];
  assert.equal(gross.art, '3');
  assert.equal(gross.plz, '04310');
  assert.equal(gross.ort, 'Leipzig');
  assert.equal(gross.strasse, '', 'Grosskundeanschrift ohne Strassenfeld → leerer String');
});

test('ANS: Postfach-Anschrift (Art 2) ohne Strasse wird korrekt eingelesen', () => {
  const sample =
    "UNA:+,? '" +
    "IDK+100202549+99+IKK'" +
    "ANS+2+42100+Wuppertal'";
  const [rec] = parseKostentraegerDatei(sample);
  assert.equal(rec.anschriften.length, 1);
  assert.equal(rec.anschriften[0].art, '2');
  assert.equal(rec.anschriften[0].strasse, '');
});

test('ANS: kein ANS-Segment → anschriften ist leeres Array', () => {
  const sample =
    "UNA:+,? '" +
    "IDK+107436001+01+AOK Rheinland/Hamburg'" +
    "VKG+02+660500345+5++30'";
  const [rec] = parseKostentraegerDatei(sample);
  assert.deepEqual(rec.anschriften, []);
});

test('NAM: namensteile enthaelt alle Namenszeilen (vollstaendiger Firmenname)', () => {
  const sample =
    "UNA:+,? '" +
    "IDK+661430035+99+IQVIA HSS'" +
    "NAM+01+IQVIA+Health System Services GmbH'";
  const [rec] = parseKostentraegerDatei(sample);
  assert.ok(Array.isArray(rec.namensteile));
  assert.ok(rec.namensteile.includes('IQVIA'));
  assert.ok(rec.namensteile.includes('Health System Services GmbH'));
});

console.log('kostentraeger.parser.waehlePostanschrift');

test('waehlePostanschrift: Hausanschrift (1) hat Vorrang vor Postfach und Grosskunde', () => {
  const anschriften = [
    { art: '3', plz: '04310', ort: 'Leipzig', strasse: '' },
    { art: '1', plz: '04425', ort: 'Taucha', strasse: 'Gaertnerweg 12' },
    { art: '2', plz: '42100', ort: 'Wuppertal', strasse: '' },
  ];
  const a = waehlePostanschrift(anschriften);
  assert.equal(a.art, '1', 'Hausanschrift muss bevorzugt werden');
  assert.equal(a.plz, '04425');
});

test('waehlePostanschrift: Postfach (2) vor Grosskundeanschrift (3)', () => {
  const anschriften = [
    { art: '3', plz: '04310', ort: 'Leipzig', strasse: '' },
    { art: '2', plz: '42100', ort: 'Wuppertal', strasse: '' },
  ];
  const a = waehlePostanschrift(anschriften);
  assert.equal(a.art, '2', 'Postfach muss Grosskundeanschrift schlagen');
});

test('waehlePostanschrift: nur Grosskundeanschrift → gibt sie zurueck', () => {
  const a = waehlePostanschrift([{ art: '3', plz: '04310', ort: 'Leipzig', strasse: '' }]);
  assert.equal(a.art, '3');
});

test('waehlePostanschrift: leere Liste → null', () => {
  assert.equal(waehlePostanschrift([]), null);
  assert.equal(waehlePostanschrift(null), null);
  assert.equal(waehlePostanschrift(undefined), null);
});

// ── Gegen die echte Kostenträgerdatei (Ops-Kart #264, wissensbank Kart W-01) ──
//
// 1.329 Datensätze / 1.043 eindeutige IK ist die von wissensbank per Websuche
// gegen die Herausgeberseite verifizierte Zielzahl (IDK-Segmente gezaehlt,
// UNZ-Summen gegengeprueft). Weicht diese Zahl ab, ist entweder eine der 7
// Dateien beim naechsten Quartalswechsel unvollstaendig ersetzt worden, oder
// der Parser hat sich veraendert — beides soll hier auffallen, nicht erst
// beim DB-Import.
test('echte Kostenträgerdatei (7 Kassenart-Dateien): 1.329 Datensätze / 1.043 eindeutige IK', () => {
  let gesamt = 0;
  const iks = new Set();
  for (const datei of ECHT_DATEIEN) {
    const text = readFileSync(join(ECHT_DIR, datei), 'utf8');
    const records = parseKostentraegerDatei(text);
    for (const r of records) {
      assert.match(r.ik, /^\d{9}$/, `${datei}: unplausible IK "${r.ik}"`);
      assert.ok(r.name, `${datei}: Datensatz ohne Name (IK ${r.ik})`);
      assert.ok(Array.isArray(r.anschriften), `${datei}: anschriften-Feld fehlt`);
      iks.add(r.ik);
    }
    gesamt += records.length;
  }
  assert.equal(gesamt, 1329);
  assert.equal(iks.size, 1043);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
