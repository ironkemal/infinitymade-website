// § 302 — Auftragsdatei (Auftragssatz Version 1.0, GGT Anlage 2).
//   node --test api-backend/billing/dta/auftragsdatei.test.js
//
// Quelle der Feldpositionen: wissensbank/gemeinsam/302-tp5/GGT_Anlage_02_Auftragsdatei.txt
// (Gültig ab 01.01.2025, Stand 10.10.2024). Positionen sind 1-indexed in der
// Spezifikation; hier wird mit `slice(start-1, end)` (0-indexed, exklusives Ende) geprüft.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildAuftragsdatei } from './auftragsdatei.js';
import { buildPhysikalischerDateiname } from './filename.js';
import { buildDtaFile } from './builder.js';
import { physioFixture, podoFixture } from './fixtures.js';

const BASIS = {
  absenderIk:          '123456789',
  empfaengerIk:         '987654321',
  logischerDateiname:  'SL345678S05',
  erstellungsdatum:    '2026-05-18T08:30:15Z',
  transfernummer:      7,
  nutzdateiByteLength: 1234,
  kind:                'echt',
};

// Stellen sind 1-indexed & inklusiv, wie in der Spezifikation angegeben.
const feld = (satz, von, bis) => satz.slice(von - 1, bis);

test('Auftragssatz ist exakt 348 Zeichen lang', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(satz.length, 348);
});

test('feste Kopf-Felder: IDENTIFIKATOR, VERSION, LÄNGE_AUFTRAG', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 1, 6), '500000');
  assert.equal(feld(satz, 7, 8), '01');
  assert.equal(feld(satz, 9, 16), '00000348');
});

test('SEQUENZ_NR ist "000" (keine Teillieferung)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 17, 19), '000');
});

test('VERFAHREN_KENNUNG: Echtdaten -> ESOL0', () => {
  const satz = buildAuftragsdatei({ ...BASIS, kind: 'echt' });
  assert.equal(feld(satz, 20, 24), 'ESOL0');
});

test('VERFAHREN_KENNUNG: Testdaten -> TSOL0', () => {
  const satz = buildAuftragsdatei({ ...BASIS, kind: 'test' });
  assert.equal(feld(satz, 20, 24), 'TSOL0');
});

test('VERFAHREN_KENNUNG: Erprobung zaehlt wie Testdaten -> TSOL0', () => {
  // Anhang 2 zur Anlage 1 TP5, Kap. 9 §5/§6: Erprobung wird wie Testdaten
  // gekennzeichnet ("TSOL"), die eigentliche Unterscheidung Test/Erprobung
  // liegt im UNB-Testindikator (0 vs. 1), nicht im Dateinamen/Auftragssatz.
  const satz = buildAuftragsdatei({ ...BASIS, kind: 'erprobung' });
  assert.equal(feld(satz, 20, 24), 'TSOL0');
});

test('TRANSFER_NUMMER: 3-stellig, rechtsbündig mit Nullen', () => {
  const satz = buildAuftragsdatei({ ...BASIS, transfernummer: 7 });
  assert.equal(feld(satz, 25, 27), '007');
});

test('TRANSFER_NUMMER: dreistellig ohne Überlauf', () => {
  const satz = buildAuftragsdatei({ ...BASIS, transfernummer: 999 });
  assert.equal(feld(satz, 25, 27), '999');
});

test('VERFAHREN_KENNUNG_SPEZIFIKATION ist leer (5 Leerzeichen)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 28, 32), '     ');
});

test('ABSENDER_EIGNER und ABSENDER_PHYSIKALISCH tragen dieselbe IK (Direktversand)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 33, 47), '123456789      ');
  assert.equal(feld(satz, 48, 62), '123456789      ');
});

test('EMPFÄNGER_NUTZER und EMPFÄNGER_PHYSIKALISCH tragen dieselbe IK (Direktversand)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 63, 77), '987654321      ');
  assert.equal(feld(satz, 78, 92), '987654321      ');
});

test('FEHLER_NUMMER und FEHLER_MASSNAHME sind "000000" (Erstversand, keine Rückmeldung)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 93, 98), '000000');
  assert.equal(feld(satz, 99, 104), '000000');
});

test('DATEINAME entspricht exakt dem logischen Dateinamen der Nutzdatei', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 105, 115), 'SL345678S05');
});

test('DATUM_ERSTELLUNG: YYYYMMDDhhmmss aus erstellungsdatum (UTC)', () => {
  const satz = buildAuftragsdatei({ ...BASIS, erstellungsdatum: '2026-05-18T08:30:15Z' });
  assert.equal(feld(satz, 116, 129), '20260518083015');
});

test('DATUM_ÜBERTRAGUNG_* Felder sind Nullen (noch nicht übermittelt — Kapsam dışı)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 130, 143), '00000000000000');
  assert.equal(feld(satz, 144, 157), '00000000000000');
  assert.equal(feld(satz, 158, 171), '00000000000000');
});

test('DATEIVERSION und KORREKTUR sind konstant (laut Spezifikation ungenutzt)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 172, 177), '000000');
  assert.equal(feld(satz, 178, 178), '0');
});

test('DATEIGRÖSSE_NUTZDATEN und DATEIGRÖSSE_ÜBERTRAGUNG sind gleich (keine Verschlüsselung/Kompression)', () => {
  const satz = buildAuftragsdatei({ ...BASIS, nutzdateiByteLength: 4096 });
  assert.equal(feld(satz, 179, 190), '000000004096');
  assert.equal(feld(satz, 191, 202), '000000004096');
});

test('uebertragungByteLength kann abweichend gesetzt werden', () => {
  const satz = buildAuftragsdatei({ ...BASIS, nutzdateiByteLength: 1000, uebertragungByteLength: 800 });
  assert.equal(feld(satz, 179, 190), '000000001000');
  assert.equal(feld(satz, 191, 202), '000000000800');
});

test('ZEICHENSATZ ist I1 (ISO 8859-1)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 203, 204), 'I1');
});

test('KOMPRIMIERUNG, VERSCHLÜSSELUNGSART, ELEKTRONISCHE_UNTERSCHRIFT sind "keine" (00)', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 205, 206), '00');
  assert.equal(feld(satz, 207, 208), '00');
  assert.equal(feld(satz, 209, 210), '00');
});

test('Bandverarbeitungs-Felder tragen die DFÜ-Konstanten', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 211, 213), '   ');
  assert.equal(feld(satz, 214, 218), '00000');
  assert.equal(feld(satz, 219, 226), '00000000');
});

test('KKS- und RZ-spezifische Felder sind mit Default-Werten gefüllt', () => {
  const satz = buildAuftragsdatei(BASIS);
  assert.equal(feld(satz, 227, 227), ' ');
  assert.equal(feld(satz, 228, 229), '00');
  assert.equal(feld(satz, 230, 230), '0');
  assert.equal(feld(satz, 231, 240), '0000000000');
  assert.equal(feld(satz, 241, 246), '000000');
  assert.equal(feld(satz, 247, 274), ' '.repeat(28));
  assert.equal(feld(satz, 275, 318), ' '.repeat(44));
  assert.equal(feld(satz, 319, 348), ' '.repeat(30));
});

// --- Validierung -------------------------------------------------------

test('wirft bei ungültiger absenderIk', () => {
  assert.throws(() => buildAuftragsdatei({ ...BASIS, absenderIk: '12345' }));
});

test('wirft bei ungültiger empfaengerIk', () => {
  assert.throws(() => buildAuftragsdatei({ ...BASIS, empfaengerIk: 'ABCDEFGHI' }));
});

test('wirft bei logischerDateiname mit falscher Länge', () => {
  assert.throws(() => buildAuftragsdatei({ ...BASIS, logischerDateiname: 'ZUKURZ' }));
});

test('wirft bei transfernummer außerhalb [0, 999]', () => {
  assert.throws(() => buildAuftragsdatei({ ...BASIS, transfernummer: -1 }));
  assert.throws(() => buildAuftragsdatei({ ...BASIS, transfernummer: 1000 }));
});

test('transfernummer: 0 erzeugt im Auftragssatz an den Stellen 25–27 "000"', () => {
  const satz = buildAuftragsdatei({ ...BASIS, transfernummer: 0 });
  assert.equal(feld(satz, 25, 27), '000');
});

test('buildPhysikalischerDateiname mit transfernummer 0 erzeugt TSOL0000 bzw. ESOL0000', () => {
  assert.equal(buildPhysikalischerDateiname({ kind: 'test', transfernummer: 0 }), 'TSOL0000');
  assert.equal(buildPhysikalischerDateiname({ kind: 'echt', transfernummer: 0 }), 'ESOL0000');
});

test('wirft bei ungültigem kind', () => {
  assert.throws(() => buildAuftragsdatei({ ...BASIS, kind: 'unbekannt' }));
});

test('wirft bei negativer nutzdateiByteLength', () => {
  assert.throws(() => buildAuftragsdatei({ ...BASIS, nutzdateiByteLength: -1 }));
});

// --- Integration mit builder.js -----------------------------------------

test('buildDtaFile() liefert eine 348-stellige auftragsdatei mit demselben logischen Namen', () => {
  const dta = buildDtaFile(physioFixture);
  assert.equal(typeof dta.auftragsdatei, 'string');
  assert.equal(dta.auftragsdatei.length, 348);
  assert.equal(feld(dta.auftragsdatei, 105, 115), dta.logischerDateiname);
});

test('buildDtaFile() Auftragsdatei traegt die Nutzdatei-Groesse (podoFixture)', () => {
  const dta = buildDtaFile(podoFixture);
  const groesse = feld(dta.auftragsdatei, 179, 190);
  assert.equal(Number(groesse), dta.byteLength);
});

test('buildDtaFile() ohne transfernummer wirft (Notweg entfernt)', () => {
  const f = structuredClone(physioFixture);
  delete f.transfernummer;
  assert.throws(() => buildDtaFile(f), /transfernummer must be an integer in \[0, 999\]/);
});

test('buildDtaFile() mit transfernummer 0 erzeugt TSOL0000 bzw. ESOL0000', () => {
  const fTest = { ...physioFixture, kind: 'test', transfernummer: 0 };
  const dtaTest = buildDtaFile(fTest);
  assert.equal(dtaTest.filename, 'TSOL0000');

  const fEcht = { ...physioFixture, kind: 'echt', transfernummer: 0 };
  const dtaEcht = buildDtaFile(fEcht);
  assert.equal(dtaEcht.filename, 'ESOL0000');
});

test('buildDtaFile() mit transfernummer 1000 oder -1 wirft', () => {
  assert.throws(() => buildDtaFile({ ...physioFixture, transfernummer: 1000 }), /transfernummer must be an integer in \[0, 999\]/);
  assert.throws(() => buildDtaFile({ ...physioFixture, transfernummer: -1 }), /transfernummer must be an integer in \[0, 999\]/);
});
