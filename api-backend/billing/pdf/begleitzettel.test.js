// Begleitzettel — einer je Gesamtrechnung (Ops #283, T12).
//   node --test api-backend/billing/pdf/begleitzettel.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderBegleitzettel, renderBegleitzettelBundle } from './begleitzettel.template.js';
import { buildDtaFile } from '../dta/builder.js';
import { podoFixture } from '../dta/fixtures.js';

const praxis = {
  name: 'Podologie am Markt', strasse: 'Marktplatz 3',
  plz_ort: '53721 Siegburg', telefon: '02241 000', ik: '123456789',
};

const blattFuer = (nr, kartenIk, brutto, belege) => ({
  praxis,
  abrechnung: {
    dateiname: 'EHK5678900000024',
    rechnungsnummer: `R2026-W35-002:${nr}`,
    datum: '2026-08-28',
    abrechnungsmonat: '202608',
    prescription_count: belege.length,
    total_brutto: brutto, total_zuzahlung: 0, total_netto: brutto,
    krankenkasse_name: `Kasse ${kartenIk}`,
    krankenkasse_ik: kartenIk,
    kostentraeger_name: 'AOK Musterland',
    kostentraeger_ik: '101000000',
  },
  belege,
});

const beleg = (nr, name) => ({
  belegnummer: nr, patient_nachname: name, patient_vorname: 'Erika',
  verordnungsdatum: '2026-08-20', brutto: '100.00',
});

const zaehle = (html, muster) => (html.match(muster) || []).length;

// --- T12 ------------------------------------------------------------------

test('T12: die Zahl der Blaetter entspricht der Zahl der Gesamtrechnungen', () => {
  for (const anzahl of [1, 2, 3, 5]) {
    const blaetter = Array.from({ length: anzahl }, (_, i) =>
      blattFuer(i + 1, `10100000${i}`, 100, [beleg(`000001${i}`, 'Schulz')]));
    const html = renderBegleitzettelBundle({ blaetter, dateiname: 'EHK5678900000024' });

    assert.equal(zaehle(html, /<section class="blatt">/g), anzahl,
      `${anzahl} Gesamtrechnungen muessen ${anzahl} Blaetter ergeben`);
    assert.equal(zaehle(html, /Begleitzettel zur Gesamtrechnung/g), anzahl);
    // Genau EIN Dokumentrahmen, egal wie viele Blaetter.
    assert.equal(zaehle(html, /<!DOCTYPE html>/g), 1);
    assert.equal(zaehle(html, /<div class="no-print">/g), 1);
  }
});

test('T12b: jedes Blatt traegt SEINE Karten-IK und SEINE Rechnungsnummer', () => {
  const html = renderBegleitzettelBundle({
    dateiname: 'EHK5678900000024',
    blaetter: [
      blattFuer(1, '101000001', 100, [beleg('0000010', 'Schulz')]),
      blattFuer(2, '101000002', 40,  [beleg('0000011', 'Brandt')]),
    ],
  });

  assert.ok(html.includes('R2026-W35-002:1'));
  assert.ok(html.includes('R2026-W35-002:2'));
  assert.ok(html.includes('Gesamtrechnung 1 von 2'));
  assert.ok(html.includes('Gesamtrechnung 2 von 2'));

  // Der eigentliche Punkt: kein Blatt darf die IK, die Nummer oder den Beleg
  // des anderen tragen. Ein Zettel, der beide nennt, macht die Zuordnung
  // kaputt, fuer die er da ist.
  const blaetter = html.split('<section class="blatt">').slice(1);
  assert.equal(blaetter.length, 2);

  assert.ok(blaetter[0].includes('101000001') && !blaetter[0].includes('101000002'));
  assert.ok(blaetter[1].includes('101000002') && !blaetter[1].includes('101000001'));
  assert.ok(blaetter[0].includes(':1') && !blaetter[0].includes('R2026-W35-002:2'));
  assert.ok(blaetter[1].includes('R2026-W35-002:2') && !blaetter[1].includes('R2026-W35-002:1'));
  assert.ok(blaetter[0].includes('Schulz') && !blaetter[0].includes('Brandt'));
  assert.ok(blaetter[1].includes('Brandt') && !blaetter[1].includes('Schulz'));

  // Der Kostentraeger ist dagegen fuer beide derselbe.
  for (const b of blaetter) assert.ok(b.includes('101000000'));
});

test('T12c: Karten-IK und Kostentraeger-IK stehen getrennt und beschriftet', () => {
  const html = renderBegleitzettel(blattFuer(1, '101000001', 100, [beleg('0000010', 'Schulz')]));
  assert.ok(html.includes('IK der Krankenkasse (KV-Karte)'), 'Karten-IK muss so beschriftet sein');
  assert.ok(html.includes('Rechnungsempfänger (Kostenträger)'), 'Kostentraeger-Block fehlt');
  assert.ok(html.includes('101000001'), 'Karten-IK fehlt');
  assert.ok(html.includes('101000000'), 'Kostentraeger-IK fehlt');
});

test('T12d: die Adresse der Datenannahmestelle steht NICHT auf dem Zettel', () => {
  // Urbelege gehen zur Papierannahmestelle (Verknuepfungsart 09), nicht zur
  // Datenannahmestelle (02/03). Lieber kein Feld als ein falsch adressiertes.
  const html = renderBegleitzettel(blattFuer(1, '101000001', 100, [beleg('0000010', 'Schulz')]));
  assert.ok(!html.includes('Empfänger (Datenannahmestelle)'),
    'der alte DAS-Adressblock muss weg sein');
});

test('T12e: ein einzelnes Blatt bekommt keinen Seitenzaehler', () => {
  const html = renderBegleitzettelBundle({
    blaetter: [blattFuer(1, '101000001', 100, [beleg('0000010', 'Schulz')])],
  });
  assert.equal(zaehle(html, /<section class="blatt">/g), 1);
  assert.ok(!html.includes('von 1'), 'bei einer Gesamtrechnung ist ein Zaehler nur Laerm');
});

// --- Verzahnung mit dem Builder -------------------------------------------

test('T12f: dta.gruppen speist die Blaetter eins zu eins', () => {
  // Derselbe Aufbau wie in abrechnung.routes.js: Belege in Eingabereihenfolge,
  // die Gruppen zeigen per Index dorthin.
  const basis = structuredClone(podoFixture);
  const rezept = basis.prescriptions[0];
  const mk = (bel, kartenIk, betrag) => {
    const p = structuredClone(rezept);
    p.patient.belegnummer = bel;
    p.verordnung.kostentraegerIk = '101000000';
    p.verordnung.krankenkasseIk  = kartenIk;
    p.sessions = [{ positionsnummer: '78010', datumLeistung: '2026-08-28', anzahl: 1, einzelbetrag: betrag }];
    return p;
  };
  const prescriptions = [
    mk('0000010', '101000001', 100),
    mk('0000011', '101000002', 40),
    mk('0000012', '101000001', 10),
  ];
  const dta = buildDtaFile({ ...basis, prescriptions });
  const belege = prescriptions.map(p => beleg(p.patient.belegnummer, 'Schulz'));

  const blaetter = dta.gruppen.map(g => ({
    praxis,
    abrechnung: {
      dateiname: dta.filename,
      rechnungsnummer: `R2026-W35-002:${g.einzelRechnungsnummer}`,
      datum: '2026-08-28', abrechnungsmonat: '202608',
      prescription_count: g.prescriptionCount,
      total_brutto: g.totals.brutto, total_zuzahlung: g.totals.gesZuzahlung,
      total_netto: g.totals.netto,
      krankenkasse_name: 'Kasse', krankenkasse_ik: g.kartenIk,
      kostentraeger_name: 'AOK Musterland', kostentraeger_ik: g.kostentraegerIk,
    },
    belege: g.prescriptionIndices.map(i => belege[i]),
  }));

  const html = renderBegleitzettelBundle({ blaetter, dateiname: dta.filename });

  assert.equal(dta.gruppen.length, 2);
  assert.equal(zaehle(html, /<section class="blatt">/g), 2);

  const teile = html.split('<section class="blatt">').slice(1);
  // Gruppe 1: zwei Belege (Index 0 und 2), Gruppe 2: einer.
  assert.ok(teile[0].includes('0000010') && teile[0].includes('0000012'));
  assert.ok(!teile[0].includes('0000011'), 'der Beleg der anderen Kasse darf nicht mitwandern');
  assert.ok(teile[1].includes('0000011'));
  // Summen je Gruppe, nicht der Dateibetrag von 150.
  assert.ok(teile[0].includes('110,00'));
  assert.ok(teile[1].includes('40,00'));
  assert.ok(!html.includes('150,00'), 'die Dateisumme gehoert auf keinen Begleitzettel');
});
