import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leseCsv, ordneSpaltenZu, leseDatum, zeileZuPatient, pruefeImport, insertDatensatz, fehlendePflicht, VORLAGE_CSV } from './patienten-import.js';
import { findePatientDublette } from './patient-dublette.js';

test('leseCsv: Semikolon, Anführungszeichen, BOM, CRLF, Umbruch im Feld', () => {
  const z = leseCsv('﻿Name;Bemerkung\r\n"Müller; Anna";"sagt ""hallo""\nzweite Zeile"\r\n\r\n');
  assert.deepEqual(z, [['Name', 'Bemerkung'], ['Müller; Anna', 'sagt "hallo"\nzweite Zeile']]);
});

test('leseCsv: Komma und Tab werden erkannt', () => {
  assert.deepEqual(leseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(leseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
});

test('ordneSpaltenZu: deutsche Überschriften mit Umlaut/Leerzeichen', () => {
  const z = ordneSpaltenZu(['Nachname', 'Vorname', 'Geb.-Datum', 'Straße', 'E-Mail', 'Pat.-Nr.']);
  assert.equal(z.nachname, 0); assert.equal(z.vorname, 1); assert.equal(z.geburtsdatum, 2);
  assert.equal(z.strasse, 3); assert.equal(z.email, 4); assert.equal(z.altsystem_nr, 5);
});

test('leseDatum: Formate und Unsinn', () => {
  assert.equal(leseDatum('01.02.1950'), '1950-02-01');
  assert.equal(leseDatum('1.2.1950'), '1950-02-01');
  assert.equal(leseDatum('1950-02-01'), '1950-02-01');
  assert.equal(leseDatum('01.02.50'), '1950-02-01');
  assert.equal(leseDatum('31.02.1950'), null);
  assert.equal(leseDatum('morgen'), null);
  assert.equal(leseDatum('01.01.2999'), null);
});

test('zeileZuPatient: Vollname „Nachname, Vorname", PLZ+Ort in einer Spalte, Geschlecht w', () => {
  const zuo = ordneSpaltenZu(['Patient', 'Geburtsdatum', 'Ort', 'Geschlecht', 'IK']);
  const { patient, fehler, hinweise } = zeileZuPatient(['Muster, Erika', '01.02.1950', '53721 Siegburg', 'w', '104212505'], zuo);
  assert.deepEqual(fehler, []);
  assert.equal(patient.last_name, 'Muster'); assert.equal(patient.first_name, 'Erika');
  assert.equal(patient.title, 'Erika Muster');
  assert.equal(patient.plz, '53721'); assert.equal(patient.city, 'Siegburg');
  assert.equal(patient.geschlecht, 'f');
  assert.equal(patient.krankenkasse_ik, '104212505');
  assert.equal(patient.insurance_type, 'gkv');
  assert.deepEqual(hinweise, []);
});

test('zeileZuPatient: fehlendes Geburtsdatum ist Fehler, kaputte IK nur Hinweis', () => {
  const zuo = ordneSpaltenZu(['Nachname', 'Vorname', 'Geburtsdatum', 'IK', 'E-Mail']);
  const r = zeileZuPatient(['Muster', 'Erika', '', '12', 'keine-mail'], zuo);
  assert.deepEqual(r.fehler, ['Geburtsdatum fehlt']);
  assert.equal(r.patient.krankenkasse_ik, null);
  assert.equal(r.patient.email, null);
  assert.equal(r.hinweise.length, 2);
});

test('pruefeImport: neu / vorhanden / doppelt in Datei / fehlerhaft', () => {
  const bestehende = [{ first_name: 'Erika', last_name: 'Muster', geburtsdatum: '1950-02-01' }];
  const csv = 'Nachname;Vorname;Geburtsdatum\nMuster;Erika;01.02.1950\nNeu;Hans;03.04.1960\nneu;hans;1960-04-03\nOhne;Datum;\n';
  const e = pruefeImport(csv, bestehende);
  assert.deepEqual(e.fehltSpalte, []);
  assert.equal(e.neu, 1); assert.equal(e.dubletten, 2); assert.equal(e.fehlerhaft, 1);
  assert.equal(e.zeilen[0].dublette, 'vorhanden');
  assert.match(e.zeilen[2].dublette, /Zeile 3/);
});

test('pruefeImport: fehlende Pflichtspalte wird gemeldet', () => {
  assert.deepEqual(pruefeImport('Nachname;Vorname\nA;B', []).fehltSpalte, ['Geburtsdatum']);
});

test('Vorlage lässt sich selbst fehlerfrei importieren', () => {
  const e = pruefeImport(VORLAGE_CSV, []);
  assert.equal(e.neu, 1);
  assert.deepEqual(e.zeilen[0].hinweise, []);
});

test('insertDatensatz: Altsystem-Nr in metadata, nie in patientennummer', () => {
  const zuo = ordneSpaltenZu(['Nachname', 'Vorname', 'Geburtsdatum', 'Patientennummer']);
  const d = insertDatensatz(zeileZuPatient(['A', 'B', '01.01.1970', '4711'], zuo), 'owner-1', 'batch-1');
  assert.equal(d.owner_id, 'owner-1');
  assert.equal(d.metadata.altsystem_nr, '4711');
  assert.equal(d.metadata.import_batch, 'batch-1');
  assert.equal('patientennummer' in d, false);
});

test('findePatientDublette: KVNR schlägt Name', () => {
  const b = [{ id: 1, first_name: 'X', last_name: 'Y', versichertennummer: 'A123456780' }];
  assert.equal(findePatientDublette({ first_name: 'Erika', last_name: 'Muster', versichertennummer: 'a123456780' }, b)?.id, 1);
  assert.equal(findePatientDublette({ first_name: 'Erika', last_name: 'Muster' }, b), null);
});

test('Zuordnung von Hand: abweichende Überschriften, Hausnummer getrennt', () => {
  const csv = 'Pat-Name;Geb.;Str.;Hausnr;Kuerzel\nMuster, Erika;01.02.1950;Hauptstraße;1;XY\n';
  const auto = ordneSpaltenZu(leseCsv(csv)[0]);
  assert.equal(auto.vollname, 0); assert.equal(auto.geburtsdatum, 1);
  const e = pruefeImport(csv, [], { vollname: 0, geburtsdatum: 1, strasse: 2, hausnummer: 3, notizen: 4 });
  assert.equal(e.neu, 1);
  assert.equal(e.zeilen[0].patient.street, 'Hauptstraße 1');
  assert.equal(e.zeilen[0].patient.notes, 'XY');
});

test('fehlendePflicht: Name komplett ersetzt Vor- und Nachname', () => {
  assert.deepEqual(fehlendePflicht({ vollname: 0, geburtsdatum: 1 }), []);
  assert.deepEqual(fehlendePflicht({ nachname: 0 }), ['Geburtsdatum']);
  assert.deepEqual(fehlendePflicht({}), ['Nachname', 'Vorname', 'Geburtsdatum']);
});
