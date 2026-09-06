import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  alsDeutschesDatum, ocrAlsVerordnung, ocrAlsPatientkopf, ocrAlsPatientensuche,
  patientAbgleichAusOcr, alsIsoDatum,
} from './verordnung-aus-ocr.js?v=20260906';

/** So sieht eine Antwort von /rezept/upload aus (gekuerzt, aber echt geformt). */
const GELESEN = {
  patient: {
    first_name: 'Anna', last_name: 'Bauer', geburtsdatum: '1975-03-08',
    versichertennummer: 'a 123456789', krankenkasse: 'AOK Rheinland/Hamburg',
    kostentraeger_ik: '104212505', versichertenstatus: '10000',
    street: 'Hauptstr. 5', plz: '53721', city: 'Siegburg',
  },
  arzt: { name: 'Dr. Meier', ausstellungsdatum: '2026-09-01', lanr: '123456789', bsnr: '987654321' },
  rezept: {
    icd10: 'E11.40', icd10_2: 'I70.24', diagnose_text: 'Diabetisches Fußsyndrom',
    diagnosegruppe: 'DF', therapiebereich: 'podo',
    heilmittel: 'Podologische Komplexbehandlung', heilmittel_position: '78020',
    heilmittel_feld_text: 'Pod. Komplexbeh.',
    anzahl_einheiten: 6, frequenz: '1x wöchentlich',
    ergaenzendes_heilmittel: 'Hornhautabtragung', anzahl_ergaenzend: 2,
    therapieziele: 'Druckentlastung, Wundprophylaxe',
    leitsymptomatik: 'a', pat_leitsymptomatik: null,
    is_dringend: true, hausbesuch: false, is_blanko: false, is_lhb_bvb: false,
    zuzahlung_befreit: true, bericht_angefordert: false,
    unterschrift_vorhanden: true, signature_confidence: 'high',
  },
};

test('Datum kommt in der Schreibweise des Papiers an', () => {
  assert.equal(alsDeutschesDatum('1975-03-08'), '08.03.1975');
  assert.equal(alsDeutschesDatum(''), '');
  assert.equal(alsDeutschesDatum(null), '');
  // Unlesbares bleibt stehen — lieber der Rohwert als ein leeres Feld.
  assert.equal(alsDeutschesDatum('08.03.1975'), '08.03.1975');
});

test('die Verordnung kommt in den Spaltennamen der Tabelle an', () => {
  const rx = ocrAlsVerordnung(GELESEN);
  assert.equal(rx.ausstellungsdatum, '2026-09-01');
  assert.equal(rx.doctor_lanr, '123456789');
  assert.equal(rx.doctor_bsnr, '987654321');
  assert.deepEqual(rx.aerzte, { arzt_name: 'Dr. Meier' });
  assert.equal(rx.icd10, 'E11.40');
  assert.equal(rx.icd10_2, 'I70.24');
  assert.equal(rx.diagnosegruppe, 'DF');
  assert.equal(rx.therapie_bereich, 'podo', 'therapiebereich → therapie_bereich');
  assert.equal(rx.diagnose_freitext, 'Diabetisches Fußsyndrom', 'diagnose_text → diagnose_freitext');
  assert.equal(rx.ergaenzend_einheiten, 2, 'anzahl_ergaenzend → ergaenzend_einheiten');
  assert.equal(rx.anzahl_einheiten, 6);
  assert.equal(rx.frequenz, '1x wöchentlich');
  assert.equal(rx.bericht_status, 'offen', 'ohne Angabe der Vorgabewert');
});

test('Therapieziele werden zu den Hinweisen — wie im Speicherweg', () => {
  // Es gibt keine Spalte `therapieziele`; api-backend/server.js:2493 schreibt
  // sie nach `hinweise`. Zwei Regeln dafuer waeren der alte Fehler.
  assert.equal(ocrAlsVerordnung(GELESEN).hinweise, 'Druckentlastung, Wundprophylaxe');
});

test('der Patient bleibt offen — das entscheidet der Abgleich', () => {
  assert.equal(ocrAlsVerordnung(GELESEN).patient_id, null);
});

test('Ankreuzfelder kommen als echtes ja/nein an, nie als undefined', () => {
  const leer = ocrAlsVerordnung({ rezept: {} });
  for (const feld of ['is_dringend', 'hausbesuch', 'is_blanko', 'is_lhb_bvb',
                      'zuzahlung_befreit', 'bericht_angefordert']) {
    assert.equal(leer[feld], false, feld);
  }
  const voll = ocrAlsVerordnung(GELESEN);
  assert.equal(voll.is_dringend, true);
  assert.equal(voll.zuzahlung_befreit, true);
});

test('nichts gelesen heisst leere Felder, kein Absturz', () => {
  for (const eingabe of [null, undefined, {}, { patient: null, arzt: null, rezept: null }]) {
    const rx = ocrAlsVerordnung(eingabe);
    assert.equal(rx.icd10, null);
    assert.equal(rx.aerzte, null);
    assert.equal(rx.bericht_status, 'offen');
    assert.deepEqual(ocrAlsPatientkopf(eingabe).rzPatName, '');
  }
});

test('der Patientenkopf traegt die Felder der Maske', () => {
  const kopf = ocrAlsPatientkopf(GELESEN);
  assert.equal(kopf.rzPatVorname, 'Anna');
  assert.equal(kopf.rzPatName, 'Bauer');
  assert.equal(kopf.rzPatGeb, '08.03.1975', 'im Kopf steht das Datum deutsch');
  assert.equal(kopf.rzPatOrt, '53721 Siegburg', 'PLZ und Ort in einem Feld');
  assert.equal(kopf.rzPatStrasse, 'Hauptstr. 5');
  assert.equal(kopf.rzPatKasse, 'AOK Rheinland/Hamburg');
  assert.equal(kopf.rzPatKasseIk, '104212505');
});

test('ohne erkanntes IK bleibt das Feld dem Aufrufer ueberlassen', () => {
  const ohne = ocrAlsPatientkopf({ patient: { krankenkasse: 'BARMER' } });
  assert.equal('rzPatKasseIk' in ohne, false, 'nicht mit Leerwert ueberschreiben');
});

test('die Suchangaben stehen ISO da, nicht deutsch', () => {
  const s = ocrAlsPatientensuche(GELESEN);
  assert.equal(s.geburtsdatum, '1975-03-08', 'gesucht wird mit dem ISO-Datum');
  assert.equal(s.last_name, 'Bauer');
  assert.equal(s.versichertennummer, 'A123456789', 'Grossbuchstabe, keine Leerzeichen');
});

test('leere Suchangaben sind null, nicht der leere Text', () => {
  // `''` wuerde in einer Abfrage auf Gleichheit pruefen und nichts finden;
  // `null` sagt dem Abgleich, dass dieser Schluessel fehlt.
  const s = ocrAlsPatientensuche({ patient: { first_name: '   ', last_name: 'Bauer' } });
  assert.equal(s.first_name, null);
  assert.equal(s.geburtsdatum, null);
  assert.equal(s.versichertennummer, null);
  assert.equal(s.last_name, 'Bauer');
});

// ── Patientenabgleich ──────────────────────────────────────────────────────

const AKTE = [
  { id: 'a', first_name: 'Anna', last_name: 'Bauer', geburtsdatum: '1975-03-08',
    versichertennummer: 'A123456789' },
  // Namensvetter: gleicher Nachname UND gleicher Geburtstag, andere Person.
  { id: 'b', first_name: 'Arno', last_name: 'Bauer', geburtsdatum: '1975-03-08',
    versichertennummer: 'B987654321' },
  { id: 'c', first_name: 'Cem', last_name: 'Demir', geburtsdatum: '1990-01-02',
    versichertennummer: null },
  // Altbestand: Geburtsdatum nur in metadata.
  { id: 'd', first_name: 'Dora', last_name: 'Ege', metadata: { geburtsdatum: '1960-12-24' } },
];

const abgleich = (k) => patientAbgleichAusOcr(k, AKTE);

test('Versichertennummer schlaegt alles — auch die Schreibweise', () => {
  const r = abgleich({ versichertennummer: 'a 123 456 789' });
  assert.equal(r.status, 'gefunden');
  assert.equal(r.kandidaten[0].id, 'a');
});

test('unbekannte Versichertennummer faellt auf Geburtsdatum + Name zurueck', () => {
  // Die Nummer fehlt in der Akte — das heisst nicht, dass es den Patienten
  // nicht gibt.
  const r = abgleich({ versichertennummer: 'Z999999999', last_name: 'Demir',
                       first_name: 'Cem', geburtsdatum: '1990-01-02' });
  assert.equal(r.status, 'gefunden');
  assert.equal(r.kandidaten[0].id, 'c');
});

test('Geburtsdatum + voller Name trifft den richtigen Namensvetter', () => {
  const r = abgleich({ first_name: 'Arno', last_name: 'Bauer', geburtsdatum: '1975-03-08' });
  assert.equal(r.status, 'gefunden');
  assert.equal(r.kandidaten[0].id, 'b');
});

test('fehlender Vorname macht die Suche NICHT weiter — er macht sie mehrdeutig', () => {
  // Genau hier setzt der heutige Speicherweg `ilike '%'` ein und nimmt den
  // ersten Treffer. Zwei Menschen, ein Befund: der Mensch entscheidet.
  const r = abgleich({ last_name: 'Bauer', geburtsdatum: '1975-03-08' });
  assert.equal(r.status, 'mehrdeutig');
  assert.equal(r.kandidaten.length, 2);
});

test('Schreibweise entscheidet nicht', () => {
  const r = abgleich({ first_name: 'aNNa', last_name: '  BAUER ', geburtsdatum: '1975-03-08' });
  assert.equal(r.status, 'gefunden');
  assert.equal(r.kandidaten[0].id, 'a');
});

test('Altbestand mit Geburtsdatum in metadata wird gefunden', () => {
  const r = abgleich({ first_name: 'Dora', last_name: 'Ege', geburtsdatum: '1960-12-24' });
  assert.equal(r.status, 'gefunden');
  assert.equal(r.kandidaten[0].id, 'd');
});

test('niemand passt → neu', () => {
  const r = abgleich({ first_name: 'Neu', last_name: 'Person', geburtsdatum: '2000-01-01' });
  assert.equal(r.status, 'neu');
  assert.deepEqual(r.kandidaten, []);
});

test('ohne Geburtsdatum traegt der Name nur, wenn er eindeutig ist', () => {
  assert.equal(abgleich({ first_name: 'Cem', last_name: 'Demir' }).status, 'gefunden');
  assert.equal(abgleich({ last_name: 'Bauer' }).status, 'mehrdeutig');
});

test('gar nichts gelesen ist nicht „neu" — das waere eine Behauptung zu viel', () => {
  const r = abgleich({ first_name: null, last_name: null, geburtsdatum: null, versichertennummer: null });
  assert.equal(r.status, 'unbekannt');
  assert.deepEqual(r.kandidaten, []);
});

test('leere Akte: alles ist neu, nichts stuerzt ab', () => {
  const r = patientAbgleichAusOcr({ last_name: 'Bauer', geburtsdatum: '1975-03-08' }, []);
  assert.equal(r.status, 'neu');
  assert.equal(patientAbgleichAusOcr({ last_name: 'X' }, null).status, 'neu');
});

test('die Kette OCR → Suche → Abgleich passt zusammen', () => {
  // Der eigentliche Beweis: was ocrAlsPatientensuche liefert, muss der
  // Abgleich ohne Umformung verstehen.
  const r = patientAbgleichAusOcr(ocrAlsPatientensuche(GELESEN), AKTE);
  assert.equal(r.status, 'gefunden');
  assert.equal(r.kandidaten[0].id, 'a');
});

test('deutsches Datum zurueck nach ISO — der eigene Leser, nicht new Date()', () => {
  assert.equal(alsIsoDatum('08.03.1975'), '1975-03-08');
  assert.equal(alsIsoDatum('8.3.1975'), '1975-03-08', 'auch ohne fuehrende Null');
  assert.equal(alsIsoDatum('1975-03-08'), '1975-03-08', 'ISO bleibt ISO');
  // `new Date('08.03.1975')` waere der 3. AUGUST — Monat und Tag vertauscht.
  // Deshalb steht hier ein eigener Leser und nicht alsISODatum().
  assert.notEqual(alsIsoDatum('08.03.1975'), '1975-08-03');
});

test('halb gelesenes Datum ist schlimmer als gar keins', () => {
  for (const kaputt of ['', null, undefined, 'xx', '32.01.1975', '01.13.1975', '1.1.75']) {
    assert.equal(alsIsoDatum(kaputt), '', String(kaputt));
  }
});

test('Hin und zurueck ergibt wieder dasselbe', () => {
  assert.equal(alsIsoDatum(alsDeutschesDatum('1975-03-08')), '1975-03-08');
});
