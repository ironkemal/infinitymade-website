// § 302 — Gesamtrechnungs-Gruppierung je Karten-IK (Ops #283).
//   node --test api-backend/billing/dta/gesamtrechnung.test.js
//
// Worum es geht: eine DTA-Datei gilt genau einer Datenannahmestelle und einer
// Kassenart (Anlage 1 TP5 V21, Kap. 5.3.1). Innerhalb dieser Datei ist jede
// Karten-IK eine eigene Gesamtrechnung mit eigener SLGA und eigenen
// GES-Summen. Vorher nahm der Builder prescriptions[0] fuer die ganze Datei
// und rechnete die GES ueber alle Rezepte — bei zwei Karten-IK sah jede Kasse
// die Summe der anderen mit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildDtaFile } from './builder.js';
import { buildSLGA_FKT } from './segments.js';
import { physioFixture, podoFixture } from './fixtures.js';

const HIER = dirname(fileURLToPath(import.meta.url));

// --- Hilfen ---------------------------------------------------------------

const segmente = (inhalt) => inhalt.split("'").slice(0, -1).map(s => s.trim()).filter(Boolean);

// Zerlegt den Datenstrom in Nachrichten: [{ art, segmente[] }]
function nachrichten(inhalt) {
  const out = [];
  let aktuell = null;
  for (const seg of segmente(inhalt)) {
    if (seg.startsWith('UNH+')) {
      aktuell = { art: seg.split('+')[2].split(':')[0], segmente: [] };
      continue;
    }
    if (seg.startsWith('UNT+')) { out.push(aktuell); aktuell = null; continue; }
    if (aktuell) aktuell.segmente.push(seg);
  }
  return out;
}

const felder = (seg) => seg.split('+');
const gesZeilen = (nachricht) => nachricht.segmente.filter(s => s.startsWith('GES+')).map(felder);
const fktVon    = (nachricht) => felder(nachricht.segmente.find(s => s.startsWith('FKT+')));
const recVon    = (nachricht) => felder(nachricht.segmente.find(s => s.startsWith('REC+')));

// Zwei Rezepte, EIN Kostenträger, ZWEI Karten-IK. Unterschiedliche Betraege,
// damit eine Vermischung der Summen sofort sichtbar wird (100,00 vs. 40,00 —
// waere der alte Fehler noch da, stuende in beiden GES 140,00).
function zweiKartenIk() {
  const basis = structuredClone(podoFixture);
  const rezept = basis.prescriptions[0];

  const a = structuredClone(rezept);
  a.patient.belegnummer = '0000010';
  a.verordnung.kostentraegerIk = '101000000';
  a.verordnung.krankenkasseIk  = '101000001';
  a.sessions = [{ positionsnummer: '78010', datumLeistung: '2026-08-28', anzahl: 1, einzelbetrag: 100.00 }];

  const b = structuredClone(rezept);
  b.patient.belegnummer = '0000011';
  b.patient.nachname = 'Brandt';
  b.verordnung.kostentraegerIk = '101000000';
  b.verordnung.krankenkasseIk  = '101000002';
  b.sessions = [{ positionsnummer: '78010', datumLeistung: '2026-08-29', anzahl: 1, einzelbetrag: 40.00 }];

  return { ...basis, prescriptions: [a, b] };
}

// --- T8: Regression. Zuerst, weil alles andere wertlos ist, wenn der heutige
//         Ein-Kassen-Fall sich veraendert hat. Die Golden-Dateien stammen aus
//         dem Commit VOR dem Umbau und werden nicht neu erzeugt.
// -------------------------------------------------------------------------

for (const [name, fixture] of [['physio', physioFixture], ['podo', podoFixture]]) {
  test(`T8 ${name}: Ein-Kassen-Fall bleibt zeichengleich zum Stand vor dem Umbau`, () => {
    const r = buildDtaFile(structuredClone(fixture));
    const goldEdi  = readFileSync(join(HIER, '__golden__', `${name}.edi`), 'latin1');
    const goldMeta = JSON.parse(readFileSync(join(HIER, '__golden__', `${name}.json`), 'utf8'));

    assert.equal(r.content, goldEdi, 'DTA-Inhalt weicht vom eingefrorenen Stand ab');
    assert.equal(r.filename,     goldMeta.filename);
    assert.equal(r.segmentCount, goldMeta.segmentCount);
    assert.equal(r.messageCount, goldMeta.messageCount);
    assert.equal(r.byteLength,   goldMeta.byteLength);
    assert.deepEqual(r.totals,   goldMeta.totals);
  });
}

test('T8b: der Ein-Kassen-Fall meldet genau eine Gesamtrechnung', () => {
  const r = buildDtaFile(structuredClone(podoFixture));
  assert.equal(r.gruppen.length, 1);
  assert.equal(r.gruppen[0].kartenIk, '101000000');
  assert.equal(r.gruppen[0].prescriptionCount, 1);
});

// --- T1: zwei Karten-IK, ohne Sammelrechnung ------------------------------

test('T1: zwei Karten-IK ergeben zwei SLGA + zwei SLLA, jede GES nur ihre eigene Gruppe', () => {
  const r = buildDtaFile(zweiKartenIk());
  const msgs = nachrichten(r.content);

  assert.deepEqual(msgs.map(m => m.art), ['SLGA', 'SLLA', 'SLGA', 'SLLA'],
    'Reihenfolge muss SLGA + zugehoerige SLLA je Gesamtrechnung sein');
  assert.equal(r.messageCount, 4);
  assert.ok(r.content.endsWith("UNZ+4+00024'"), 'UNZ zaehlt alle vier Nachrichten: ' + r.content.slice(-20));

  const slgaA = msgs[0], slgaB = msgs[2];

  // FKT Feld 5 traegt die Karten-IK der jeweiligen Gruppe.
  assert.equal(fktVon(slgaA)[5], '101000001');
  assert.equal(fktVon(slgaB)[5], '101000002');
  // Feld 4 bleibt bei beiden der gemeinsame Kostenträger.
  assert.equal(fktVon(slgaA)[4], '101000000');
  assert.equal(fktVon(slgaB)[4], '101000000');

  // Der Kern: die GES-Summen duerfen sich nicht vermischen.
  // GES+<Status>+<Rechnungsbetrag>+<Brutto>+<Zuzahlung>
  const gesA = gesZeilen(slgaA).find(f => f[1] === '00');
  const gesB = gesZeilen(slgaB).find(f => f[1] === '00');
  assert.equal(gesA[3], '100,00', 'Gruppe A darf nur ihre eigenen 100,00 melden');
  assert.equal(gesB[3], '40,00',  'Gruppe B darf nur ihre eigenen 40,00 melden');
  assert.equal(gesA[2], '100,00');
  assert.equal(gesB[2], '40,00');

  // Die Dateisumme steht in KEINEM GES-Segment.
  for (const m of msgs.filter(m => m.art === 'SLGA')) {
    for (const f of gesZeilen(m)) {
      assert.notEqual(f[3], '140,00', 'Dateisumme darf in keiner GES-Zeile auftauchen');
    }
  }
  // ... sondern nur im Rueckgabewert, fuer abrechnung-Zeile und Begleitzettel.
  assert.equal(r.totals.brutto, 140.00);

  // Ohne Sammelrechnung bleibt die Einzelrechnungsnummer '0'.
  assert.equal(recVon(slgaA)[1], 'R2026-W35-002:0');
  assert.equal(recVon(slgaB)[1], 'R2026-W35-002:0');
});

// --- T2 / T6: Sammelrechnung ----------------------------------------------
//
// Der Weg ist gebaut, aber im Produktivpfad abgeschaltet. Getestet wird er
// trotzdem: ungetesteter schlafender Code ist beim Aufwecken kaputt.

test('T2: Sammelrechnung — Sammel-SLGA ohne UST, FKT Feld2=J und Feld5 leer, Einzelnummern 1,2', () => {
  const r = buildDtaFile({
    ...zweiKartenIk(),
    sammelrechnung: true,
    rechnung: { ...zweiKartenIk().rechnung, rechnungsart: '3' },
    ust: { steuernummer: 'DE123456789', ustBefreit: true },
  });
  const msgs = nachrichten(r.content);

  assert.deepEqual(msgs.map(m => m.art), ['SLGA', 'SLGA', 'SLLA', 'SLGA', 'SLLA'],
    'Sammel-SLGA zuerst, dann je Gesamtrechnung SLGA + SLLA');

  const sammel = msgs[0];
  const fkt = fktVon(sammel);
  assert.equal(fkt[2], 'J',  'FKT Feld 2 muss J sein');
  assert.equal(fkt[5], '',   'FKT Feld 5 (IK der Krankenkasse) muss in der Sammel-SLGA leer sein');
  assert.equal(fkt[4], '101000000');
  assert.ok(!sammel.segmente.some(s => s.startsWith('UST+')),
    'UST gehoert nicht in die Sammelrechnungs-SLGA');

  // Die Gesamtrechnungs-SLGA darf das UST dagegen fuehren.
  assert.ok(msgs[1].segmente.some(s => s.startsWith('UST+')));

  // Einzelrechnungsnummern zaehlen je Gesamtrechnung hoch ...
  assert.equal(recVon(msgs[1])[1], 'R2026-W35-002:1');
  assert.equal(recVon(msgs[3])[1], 'R2026-W35-002:2');
  // ... und die SLLA traegt dieselbe Nummer wie ihre SLGA.
  assert.equal(recVon(msgs[2])[1], 'R2026-W35-002:1');
  assert.equal(recVon(msgs[4])[1], 'R2026-W35-002:2');

  assert.deepEqual(r.gruppen.map(g => g.einzelRechnungsnummer), ['1', '2']);
});

test('T6: die GES der Sammel-SLGA ist die Summe der GES ihrer Gesamtrechnungen', () => {
  const r = buildDtaFile({ ...zweiKartenIk(), sammelrechnung: true });
  const msgs = nachrichten(r.content);
  const betrag = (s) => Number(s.replace('.', '').replace(',', '.'));

  const sammelGes = gesZeilen(msgs[0]).find(f => f[1] === '00');
  const teilGes   = [msgs[1], msgs[3]].map(m => gesZeilen(m).find(f => f[1] === '00'));

  for (const feld of [2, 3]) {   // Rechnungsbetrag, Bruttobetrag
    assert.equal(
      betrag(sammelGes[feld]),
      +teilGes.reduce((a, f) => a + betrag(f[feld]), 0).toFixed(2),
      `GES-Feld ${feld} der Sammel-SLGA muss die Summe der Gesamtrechnungen sein`
    );
  }
  assert.equal(betrag(sammelGes[3]), 140.00);
});

// --- T3 / T4: Kreuzpruefung im Segmentbauer -------------------------------

test('T3: Sammelrechnung=J mit gefuellter Krankenkassen-IK wird abgewiesen', () => {
  assert.throws(() => buildSLGA_FKT({
    vkz: '01', sammelrechnung: 'J',
    ikLeistungserbringer: '123456789', ikKostentraeger: '101000000',
    ikKrankenkasse: '101000001', ikAbsenderDatei: '123456789',
  }), /Sammelrechnungs-SLGA.*LEER/s);
});

test('T4: Gesamtrechnungs-SLGA ohne Krankenkassen-IK wird abgewiesen', () => {
  assert.throws(() => buildSLGA_FKT({
    vkz: '01', sammelrechnung: '',
    ikLeistungserbringer: '123456789', ikKostentraeger: '101000000',
    ikKrankenkasse: '', ikAbsenderDatei: '123456789',
  }), /Gesamtrechnungs-SLGA.*Mussfeld/s);
});

test('T4b: ein anderer Wert als "" oder "J" wird abgewiesen', () => {
  assert.throws(() => buildSLGA_FKT({
    vkz: '01', sammelrechnung: 'N',
    ikLeistungserbringer: '123456789', ikKostentraeger: '101000000',
    ikKrankenkasse: '101000001', ikAbsenderDatei: '123456789',
  }), /ungültig/);
});

// --- T5: Dateieinheit DAV × Kassenart -------------------------------------

test('T5: zwei Datenannahmestellen in einer Datei werden abgewiesen', () => {
  const f = zweiKartenIk();
  f.prescriptions[0].verordnung.davIk = '660500345';
  f.prescriptions[1].verordnung.davIk = '661430035';
  assert.throws(() => buildDtaFile(f), /mehrere Datenannahmestellen/);
});

test('T5b: zwei Kassenarten in einer Datei werden abgewiesen', () => {
  const f = zweiKartenIk();
  f.prescriptions[0].verordnung.kassenart = 'AO';
  f.prescriptions[1].verordnung.kassenart = 'EK';
  assert.throws(() => buildDtaFile(f), /mehrere Kassenarten/);
});

test('T5c: ein Rezept, das der uebergebenen Dateieinheit widerspricht, wird abgewiesen', () => {
  const f = zweiKartenIk();
  f.prescriptions[0].verordnung.davIk = '660500345';
  f.prescriptions[1].verordnung.davIk = '660500345';
  assert.doesNotThrow(() => buildDtaFile({ ...f, davIk: '660500345', kassenart: 'AO' }));
  assert.throws(() => buildDtaFile({ ...f, davIk: '661430035', kassenart: 'AO' }),
    /mehrere Datenannahmestellen/);
});

// --- T7: Begleitzettel-Grundlage ------------------------------------------
//
// Den Begleitzettel selbst erzeugt abrechnung.routes.js. Geprueft wird hier,
// dass der Builder die dafuer noetige Aufstellung liefert: eine Zeile je
// Gesamtrechnung mit der Karten-IK DIESER Gruppe.

test('T7: gruppen liefert eine Zeile je Gesamtrechnung mit korrekter Karten-IK', () => {
  const r = buildDtaFile(zweiKartenIk());
  const anzahlSlga = nachrichten(r.content).filter(m => m.art === 'SLGA').length;

  assert.equal(r.gruppen.length, anzahlSlga);
  assert.deepEqual(r.gruppen.map(g => g.kartenIk), ['101000001', '101000002']);
  assert.deepEqual(r.gruppen.map(g => g.kostentraegerIk), ['101000000', '101000000']);
  assert.deepEqual(r.gruppen.map(g => g.totals.brutto), [100.00, 40.00]);
  assert.deepEqual(r.gruppen.map(g => g.prescriptionIndices), [[0], [1]]);

  // Jedes Rezept taucht in genau einer Gruppe auf, und die Indizes zeigen
  // weiterhin in das unveraenderte Eingabe-Array.
  const alle = r.gruppen.flatMap(g => g.prescriptionIndices).sort();
  assert.deepEqual(alle, [0, 1]);
});

test('T7b: Rezepte derselben Karten-IK bleiben in Eingabereihenfolge in einer Gruppe', () => {
  const f = zweiKartenIk();
  const drittes = structuredClone(f.prescriptions[0]);
  drittes.patient.belegnummer = '0000012';
  drittes.sessions = [{ positionsnummer: '78010', datumLeistung: '2026-08-30', anzahl: 1, einzelbetrag: 10.00 }];
  f.prescriptions = [f.prescriptions[0], f.prescriptions[1], drittes];   // A, B, A

  const r = buildDtaFile(f);
  assert.equal(r.gruppen.length, 2);
  assert.deepEqual(r.gruppen[0].prescriptionIndices, [0, 2]);
  assert.deepEqual(r.gruppen[1].prescriptionIndices, [1]);
  assert.equal(r.gruppen[0].totals.brutto, 110.00);
  assert.equal(r.gruppen[1].totals.brutto, 40.00);
  assert.equal(r.totals.brutto, 150.00);
  assert.equal(r.messageCount, 5);   // 2 SLGA + 3 SLLA
});
