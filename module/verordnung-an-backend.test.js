import { test } from 'node:test';
import assert from 'node:assert/strict';

import { verordnungFuerBackend, trennePlzOrt } from './verordnung-an-backend.js?v=20260906';
import { ocrAlsVerordnung, ocrAlsPatientkopf } from './verordnung-aus-ocr.js?v=20260906';

/** So sieht `nutzlastAusMaske()` aus (gekuerzt, aber echt geformt). */
const NUTZLAST = {
  patient_id: 'lead-1',
  ausstellungsdatum: '2026-09-01',
  doctor_lanr: '123456789',
  doctor_bsnr: '987654321',
  icd10: 'E11.40',
  diagnosegruppe: 'DF',
  diagnose_freitext: 'Diabetisches Fußsyndrom',
  therapie_bereich: 'podo',
  heilmittel: 'Podologische Komplexbehandlung',
  heilmittel_position: '78020',
  anzahl_einheiten: 6,
  ergaenzendes_heilmittel: 'Hornhautabtragung',
  ergaenzend_einheiten: 2,
  frequenz: '1x wöchentlich',
  hinweise: 'Druckentlastung',
  zuzahlung_eur: 10,
  is_dringend: true,
  hausbesuch: false,
  bericht_status: 'offen',
  nagel: 'U1 links',
  wagner_grad: 2,
  behandlungsanlass: 'Podologische Komplexbehandlung',
};

const KOPF = {
  rzPatVorname: 'Anna', rzPatName: 'Bauer', rzPatGeb: '08.03.1975',
  rzPatVersNr: 'A123456789', rzPatStatus: '10000',
  rzPatKasse: 'AOK Rheinland/Hamburg', rzPatKasseIk: '104212505',
  rzPatStrasse: 'Hauptstr. 5', rzPatOrt: '53721 Siegburg',
  rzArztName: 'Dr. Meier',
};

test('PLZ und Ort werden wieder getrennt', () => {
  assert.deepEqual(trennePlzOrt('53721 Siegburg'), { plz: '53721', city: 'Siegburg' });
  assert.deepEqual(trennePlzOrt('53721 Sankt Augustin'), { plz: '53721', city: 'Sankt Augustin' });
});

test('ohne PLZ wird nichts erfunden', () => {
  assert.deepEqual(trennePlzOrt('Siegburg'), { plz: null, city: 'Siegburg' });
  assert.deepEqual(trennePlzOrt(''), { plz: null, city: null });
  assert.deepEqual(trennePlzOrt(null), { plz: null, city: null });
  // Vierstellig ist keine deutsche PLZ — dann lieber alles als Ort.
  assert.deepEqual(trennePlzOrt('5372 Ort'), { plz: null, city: '5372 Ort' });
});

test('der Rumpf trägt die Entscheidung der Maske', () => {
  const b = verordnungFuerBackend({ nutzlast: NUTZLAST, patientFelder: KOPF });
  assert.equal(b.patient_id, 'lead-1');
  assert.equal(b.patient_neu, false);
  assert.equal(b.proceed_anyway, false);
});

test('„Neuer Patient" kommt als Flagge mit, nicht als leere id', () => {
  const b = verordnungFuerBackend({
    nutzlast: { ...NUTZLAST, patient_id: null }, patientFelder: KOPF, patientNeu: true,
  });
  assert.equal(b.patient_id, null);
  assert.equal(b.patient_neu, true, 'sonst sucht der Server doch wieder selbst');
  // Und die Angaben zum Anlegen müssen dabei sein.
  assert.equal(b.parsed.patient.first_name, 'Anna');
  assert.equal(b.parsed.patient.geburtsdatum, '1975-03-08');
});

test('das Geburtsdatum wird zurück nach ISO gedreht', () => {
  const b = verordnungFuerBackend({ nutzlast: NUTZLAST, patientFelder: KOPF });
  assert.equal(b.parsed.patient.geburtsdatum, '1975-03-08');
  assert.notEqual(b.parsed.patient.geburtsdatum, '1975-08-03', 'nicht Monat/Tag vertauscht');
});

test('der Patientenblock ist vollständig', () => {
  const p = verordnungFuerBackend({ nutzlast: NUTZLAST, patientFelder: KOPF }).parsed.patient;
  assert.equal(p.name, 'Anna Bauer');
  assert.equal(p.versichertennummer, 'A123456789');
  assert.equal(p.krankenkasse, 'AOK Rheinland/Hamburg');
  assert.equal(p.kostentraeger_ik, '104212505');
  assert.equal(p.street, 'Hauptstr. 5');
  assert.equal(p.plz, '53721');
  assert.equal(p.city, 'Siegburg');
});

test('der Arzt kommt aus Kopf und Nutzlast zusammen', () => {
  const a = verordnungFuerBackend({ nutzlast: NUTZLAST, patientFelder: KOPF }).parsed.arzt;
  assert.deepEqual(a, {
    name: 'Dr. Meier', ausstellungsdatum: '2026-09-01',
    lanr: '123456789', bsnr: '987654321',
  });
});

test('die podologischen Angaben gehen mit', () => {
  const r = verordnungFuerBackend({ nutzlast: NUTZLAST, patientFelder: KOPF }).parsed.rezept;
  assert.equal(r.nagel, 'U1 links');
  assert.equal(r.wagner_grad, 2);
  assert.equal(r.behandlungsanlass, 'Podologische Komplexbehandlung');
});

test('Hinweise gehen als Therapieziele zurück — der Weg, den sie gekommen sind', () => {
  const r = verordnungFuerBackend({ nutzlast: NUTZLAST, patientFelder: KOPF }).parsed.rezept;
  assert.equal(r.therapieziele, 'Druckentlastung');
});

test('der Beleg des Scans reist mit', () => {
  const b = verordnungFuerBackend({
    nutzlast: NUTZLAST, patientFelder: KOPF,
    scan: { storage_path: 'rezepte/abc.jpg', ocr_confidence: 0.87 },
  });
  assert.equal(b.storage_path, 'rezepte/abc.jpg');
});

test('von Hand getippt heisst kein Beleg — und das ist erlaubt', () => {
  const b = verordnungFuerBackend({ nutzlast: NUTZLAST, patientFelder: KOPF });
  assert.equal(b.storage_path, null);
});

test('leere Eingabe stürzt nicht ab', () => {
  const b = verordnungFuerBackend();
  assert.equal(b.patient_id, null);
  assert.equal(b.parsed.patient.first_name, null);
  assert.equal(b.parsed.rezept.bericht_status, 'offen');
  assert.equal(b.parsed.rezept.is_dringend, false);
});

test('Rundreise: OCR → Maske → zurück zum Server verliert nichts Wesentliches', () => {
  // Der eigentliche Beweis der Zusammenlegung: was aus dem Scan kam, muss den
  // Weg durch die Maske überleben und in derselben Sprache zurückkommen.
  const gelesen = {
    patient: {
      first_name: 'Anna', last_name: 'Bauer', geburtsdatum: '1975-03-08',
      versichertennummer: 'A123456789', krankenkasse: 'AOK', kostentraeger_ik: '104212505',
      street: 'Hauptstr. 5', plz: '53721', city: 'Siegburg',
    },
    arzt: { name: 'Dr. Meier', ausstellungsdatum: '2026-09-01', lanr: '123456789', bsnr: '987654321' },
    rezept: {
      icd10: 'E11.40', diagnosegruppe: 'DF', heilmittel: 'Podologische Komplexbehandlung',
      anzahl_einheiten: 6, frequenz: '1x wöchentlich', therapieziele: 'Druckentlastung',
      is_dringend: true,
    },
  };

  const inDerMaske = ocrAlsVerordnung(gelesen);
  const kopf = ocrAlsPatientkopf(gelesen);
  kopf.rzArztName = gelesen.arzt.name;
  // Was die Maske sonst noch beisteuert:
  inDerMaske.doctor_lanr = gelesen.arzt.lanr;
  inDerMaske.doctor_bsnr = gelesen.arzt.bsnr;

  const zurueck = verordnungFuerBackend({ nutzlast: inDerMaske, patientFelder: kopf,
                                          patientNeu: true }).parsed;

  assert.equal(zurueck.patient.geburtsdatum, gelesen.patient.geburtsdatum);
  assert.equal(zurueck.patient.plz, gelesen.patient.plz);
  assert.equal(zurueck.patient.city, gelesen.patient.city);
  assert.equal(zurueck.arzt.ausstellungsdatum, gelesen.arzt.ausstellungsdatum);
  assert.equal(zurueck.rezept.icd10, gelesen.rezept.icd10);
  assert.equal(zurueck.rezept.anzahl_einheiten, gelesen.rezept.anzahl_einheiten);
  assert.equal(zurueck.rezept.frequenz, gelesen.rezept.frequenz);
  assert.equal(zurueck.rezept.therapieziele, gelesen.rezept.therapieziele);
  assert.equal(zurueck.rezept.is_dringend, true);
});
