// § 302 SGB V — Tests für zuzahlungsforderung-ursprung.js
//
// Ausführen: node --test api-backend/billing/dta/zuzahlungsforderung-ursprung.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDtaFile } from './builder.js';
import { podoFixture, physioFixture } from './fixtures.js';
import {
  parseOriginalDtaMessage,
  unescapeEdifact,
  komponentenTrennen,
  parseGermanAmount,
  toIsoDate,
  sha256Hex,
} from './zuzahlungsforderung-ursprung.js';

const TEST_OWNER_ID = '11111111-1111-4111-8111-111111111111';
const TEST_PATIENT_ID = '22222222-2222-4222-8222-222222222222';

const AUDIT_DATE = '2026-09-15';
const AUDIT_INSTANT = '2026-09-15T10:00:00.000Z'; // 12:00:00 MESZ am gleichen Berliner Tag

function makeValidProofKZ1({
  art = 'belastungsgrenze62',
  referenz = 'BEFR-2026-001',
  gueltigAb = '2026-01-01',
  gueltigBis = '2026-12-31',
  geprueftAm = AUDIT_DATE,
  geprueftZeitpunkt = AUDIT_INSTANT,
  prueferId = TEST_OWNER_ID,
  patientId = TEST_PATIENT_ID,
  kostentraegerIk = '101000000',
  bestaetigt = true,
} = {}) {
  return {
    art,
    referenz,
    gueltigAb,
    gueltigBis,
    geprueftAm,
    geprueftZeitpunkt,
    prueferId,
    patientId,
    kostentraegerIk,
    bestaetigt,
  };
}

function makeValidProofKZ2({
  art = 'zahlungsaufforderung43c',
  referenz = 'MAHN-2026-09-01',
  geprueftAm = AUDIT_DATE,
  geprueftZeitpunkt = AUDIT_INSTANT,
  prueferId = TEST_OWNER_ID,
  patientId = TEST_PATIENT_ID,
  kostentraegerIk = '101000000',
  bestaetigt = true,
  versandDatum = AUDIT_DATE,
  versandArt = 'post',
  nachweisBeigefuegtBestaetigt = true,
  erfolgloserEinzugBestaetigt = true,
} = {}) {
  return {
    art,
    referenz,
    geprueftAm,
    geprueftZeitpunkt,
    prueferId,
    patientId,
    kostentraegerIk,
    bestaetigt,
    versandDatum,
    versandArt,
    nachweisBeigefuegtBestaetigt,
    erfolgloserEinzugBestaetigt,
  };
}

function makeValidProofKZ5({
  art = 'statuswechsel_jahreswechsel',
  referenz = 'STATUS-2026-X1',
  gueltigAb = '2026-01-01',
  gueltigBis = '2026-08-25',
  statusWechselDatum = '2026-08-26',
  zahlungsaufforderungReferenz = 'MAHN-2026-08-44',
  zahlungsaufforderungDatum = '2026-08-27',
  originalAbzugBestaetigt = true,
  geprueftAm = AUDIT_DATE,
  geprueftZeitpunkt = AUDIT_INSTANT,
  prueferId = TEST_OWNER_ID,
  patientId = TEST_PATIENT_ID,
  kostentraegerIk = '101000000',
  bestaetigt = true,
} = {}) {
  return {
    art,
    referenz,
    gueltigAb,
    gueltigBis,
    statusWechselDatum,
    zahlungsaufforderungReferenz,
    zahlungsaufforderungDatum,
    originalAbzugBestaetigt,
    geprueftAm,
    geprueftZeitpunkt,
    prueferId,
    patientId,
    kostentraegerIk,
    bestaetigt,
  };
}

test('1. EDIFACT-Hilfsfunktionen: Entwertung, Trennung und strikte Kalenderprüfung', () => {
  // Entwertung
  assert.equal(unescapeEdifact('Müller?+Sohn'), 'Müller+Sohn');
  assert.equal(unescapeEdifact('Fragezeichen??'), 'Fragezeichen?');
  assert.equal(unescapeEdifact('Komma?,getrennt'), 'Komma,getrennt');
  assert.equal(unescapeEdifact('Doppelpunkt?:test'), 'Doppelpunkt:test');
  assert.equal(unescapeEdifact("Apostroph?'test"), "Apostroph'test");
  assert.equal(unescapeEdifact(''), '');
  assert.equal(unescapeEdifact(null), '');

  // Komponenten-Trennung
  assert.deepEqual(komponentenTrennen('A:B:C').map(unescapeEdifact), ['A', 'B', 'C']);
  assert.deepEqual(komponentenTrennen('A?:B:C').map(unescapeEdifact), ['A:B', 'C']);
  assert.deepEqual(komponentenTrennen('Single').map(unescapeEdifact), ['Single']);

  // Betragsparsing
  assert.equal(parseGermanAmount('28,90'), 28.90);
  assert.equal(parseGermanAmount('0,00'), 0);
  assert.equal(parseGermanAmount('10'), 10.00);
  assert.equal(parseGermanAmount('-5,50'), -5.50);
  assert.ok(Number.isNaN(parseGermanAmount('')));
  assert.ok(Number.isNaN(parseGermanAmount(null)));
  assert.throws(() => parseGermanAmount('abc'), (err) => err.status === 422);

  // Datum & Kalenderprüfung
  assert.equal(toIsoDate('20260828'), '2026-08-28');
  assert.equal(toIsoDate('2026-08-28'), '2026-08-28');
  assert.equal(toIsoDate(''), '');
  assert.equal(toIsoDate(null), '');
  // Feb 31 wird strikt abgewiesen
  assert.throws(() => toIsoDate('20260231'), (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'INVALID_CALENDAR_DATE');
    return true;
  });
  assert.throws(() => toIsoDate('2026-02-31'), (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'INVALID_CALENDAR_DATE');
    return true;
  });
});

test('2. Roundtrip Builder -> Parser -> VKZ03 Builder mit allen Snapshot-Pflichtfeldern und Hash', () => {
  const f = structuredClone(podoFixture);
  f.absender.ik = '800000000';
  f.empfaenger.ik = '108310400';
  f.prescriptions[0].verordnung.kostentraegerIk = '108310400';
  f.prescriptions[0].verordnung.krankenkasseIk = '108310400';

  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const sourceHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: '108310400',
    dta_sha256: hash,
    owner_id: TEST_OWNER_ID,
  };
  const sourceZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    kostentraeger_ik: '108310400',
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  const parsed = parseOriginalDtaMessage({
    dtaContent: Buffer.from(built.content, 'latin1'),
    expectedSha256: hash,
    sourceHeader,
    sourceZeile,
    reason: 'KZ2',
    currentSenderIk: '800000000',
    nachweisPruefung: makeValidProofKZ2({ kostentraegerIk: '108310400' }),
    verifiedSourcePatientId: TEST_PATIENT_ID,
  });

  assert.equal(parsed.reason, 'KZ2');
  assert.equal(parsed.claimAmount, 12.89);
  assert.equal(parsed.prozClaim, 2.89);
  assert.equal(parsed.pauschClaim, 10.00);
  assert.equal(parsed.ursprung.senderIk, '800000000');
  assert.equal(parsed.ursprung.sammelRechnungsnummer, f.rechnung.sammelRechnungsnummer);
  assert.equal(parsed.ursprung.belegnummer, f.prescriptions[0].patient.belegnummer);

  // VKZ 03 Builder-Roundtrip
  const vkz03 = buildDtaFile({
    preflight: false,
    absender: f.absender,
    empfaenger: f.empfaenger,
    rechnung: {
      sammelRechnungsnummer: 'R2026-W40-001',
      einzelRechnungsnummer: '0',
      datum: new Date('2026-10-02'),
      datennummer: 1,
      rechnungsart: '1',
    },
    prescriptions: [parsed.prescription],
    kind: 'echt',
    vkz: '03',
    transfernummer: 1,
    rechnungssteller: {
      name: f.absender.name,
      telefon: '0224112345',
    },
  });

  assert.ok(vkz03.content.includes("FKT+03+"));
  assert.ok(vkz03.content.includes("URI+800000000+"));
  assert.ok(vkz03.content.includes("GZF+12,89+2,89+10,00'"));
});

test('3. Negativtest optionalhash: Fehlende oder ungültige SHA-256 Prüfsumme wird abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
  };

  // Ohne expectedSha256
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'DTA_HASH_REQUIRED');
    assert.equal(err.status, 422);
    return true;
  });

  // Ungültiger Hash (nicht 64 Hex-Zeichen)
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: 'nicht-64-hex',
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'DTA_HASH_REQUIRED');
    assert.equal(err.status, 422);
    return true;
  });

  // Abweichender Hash
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: '0000000000000000000000000000000000000000000000000000000000000000',
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'DTA_HASH_MISMATCH');
    assert.equal(err.status, 422);
    return true;
  });
});

test('4. Negativtest missinginvoice: Fehlende Rechnungsnummer im Header wird abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: '', // Leer!
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'MISSING_INVOICE_NUMBER');
    assert.equal(err.status, 422);
    return true;
  });
});

test('5. Negativtest KVNR: Fehlende KVNR im Beleg wird abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: '', // Leer!
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'MISSING_KVNR');
    assert.equal(err.status, 422);
    return true;
  });
});

test('6. Negativtest Feb31: Ungültiges Kalenderdatum in DTA wird strikt mit 422 abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  // Rechnungsdatum im REC auf 2026-02-31 manipulieren
  const badDta = built.content.replace("20260828+1'", "20260231+1'");
  const hash = sha256Hex(Buffer.from(badDta, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(badDta, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: '2026-02-31',
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'INVALID_CALENDAR_DATE');
    assert.equal(err.status, 422);
    return true;
  });
});

test('7. Negativtest negativeprice: Nicht-positiver Einzelbetrag in EHE wird mit 422 abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  // EHE Einzelbetrag von 28,90 auf -28,90 manipulieren (in EHE)
  const badDta = built.content.replace("+1,00+28,90+", "+1,00+-28,90+");
  const hash = sha256Hex(Buffer.from(badDta, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(badDta, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'INVALID_AMOUNT');
    assert.equal(err.status, 422);
    return true;
  });
});

test('8. Negativtest missingBES: Unvollständiges BES-Segment wird mit 422 abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  // BES verstümmeln: Pauschale und Prozent fehlen (nur Brutto)
  const badDta = built.content.replace("BES+28,90+12,89+2,89+10,00'", "BES+28,90'");
  const hash = sha256Hex(Buffer.from(badDta, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(badDta, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'INVALID_BES_SEGMENT');
    assert.equal(err.status, 422);
    return true;
  });
});

test('9. Negativtest money mismatch: Abweichung zwischen Schnappschuss und DTA wird abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 30.00, // Weicht von 28,90 ab!
        zuzahlung_eur: 12.89,
        netto_eur: 17.11,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'SNAPSHOT_MONEY_MISMATCH');
    assert.equal(err.status, 422);
    return true;
  });
});

test('10. Negativtest removedEHEcopay: Fehlender EHE-Zuzahlungsbetrag wird mit 422 abgewiesen (kein 10% Erfinden)', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  // Feld 6 im EHE entfernen: +20260828+2,89' -> +20260828+'
  const badDta = built.content.replace("+20260828+2,89'", "+20260828+'");
  const hash = sha256Hex(Buffer.from(badDta, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(badDta, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'MISSING_EHE_COPAY');
    assert.equal(err.status, 422);
    return true;
  });
});

test('11. Negativtest secondDIAtext: Zweiter Diagnosetext wird mit UNSUPPORTED_ORIGINAL_SEGMENT abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  // Zweites DIA-Segment mit Diagnosetext einfügen und UNT-Segmentzähler um 1 erhöhen
  const badDta = built.content
    .replace("DIA+E11.40'", "DIA+E11.40+Erster Text'DIA+E11.41+Zweiter Text'")
    .replace("UNT+000010", "UNT+000011");
  const hash = sha256Hex(Buffer.from(badDta, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(badDta, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'UNSUPPORTED_ORIGINAL_SEGMENT');
    assert.equal(err.status, 422);
    assert.match(err.message, /Mehrere Diagnosetexte/);
    return true;
  });
});

test('12. Negativtest multipleTXT: Mehrere TXT-Segmente zu einer EHE werden mit 422 abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  // Nach EHE zwei TXT-Segmente einfügen und UNT-Segmentzähler um 2 erhöhen
  const badDta = built.content
    .replace(
      "EHE+71:00501+78010+1,00+28,90+20260828+2,89'",
      "EHE+71:00501+78010+1,00+28,90+20260828+2,89'TXT+Hinweis 1'TXT+Hinweis 2'"
    )
    .replace("UNT+000010", "UNT+000012");
  const hash = sha256Hex(Buffer.from(badDta, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(badDta, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
    });
  }, (err) => {
    assert.equal(err.code, 'UNSUPPORTED_ORIGINAL_SEGMENT');
    assert.equal(err.status, 422);
    assert.match(err.message, /Mehrere TXT-Segmente/);
    return true;
  });
});

test('13. Negativtest partialindices: Teilselektionen bei KZ1 und KZ2 werden strikt abgewiesen', () => {
  const f = structuredClone(physioFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
    owner_id: TEST_OWNER_ID,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 135.00,
    zuzahlung_eur: 23.50,
    netto_eur: 111.50,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  // KZ2 mit nur 3 von 6 Positionen
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      selectedSessionIndices: [0, 1, 2],
      nachweisPruefung: makeValidProofKZ2({ kostentraegerIk: f.prescriptions[0].verordnung.kostentraegerIk }),
      verifiedSourcePatientId: TEST_PATIENT_ID,
    });
  }, (err) => {
    assert.equal(err.code, 'PARTIAL_SELECTION_REJECTED');
    assert.equal(err.status, 422);
    return true;
  });

  // KZ1 mit nur 1 von 6 Positionen
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ1',
      selectedSessionIndices: [0],
      nachweisPruefung: makeValidProofKZ1({
        gueltigAb: '2026-05-01',
        gueltigBis: '2026-05-31',
        kostentraegerIk: f.prescriptions[0].verordnung.kostentraegerIk,
      }),
      verifiedSourcePatientId: TEST_PATIENT_ID,
    });
  }, (err) => {
    assert.equal(err.code, 'PARTIAL_SELECTION_REJECTED');
    assert.equal(err.status, 422);
    return true;
  });
});

test('14. Negativtest falseproof: Unbestätigter oder fehlerhafter Nachweis wird abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
    owner_id: TEST_OWNER_ID,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  // bestaetigt=false
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ1',
      nachweisPruefung: makeValidProofKZ1({ bestaetigt: false }),
    });
  }, (err) => {
    assert.equal(err.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');
    assert.equal(err.status, 422);
    return true;
  });

  // Falsche Nachweisart
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ1',
      nachweisPruefung: makeValidProofKZ1({ art: 'falsche_art' }),
    });
  }, (err) => {
    assert.equal(err.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');
    assert.equal(err.status, 422);
    return true;
  });
});

test('15. Negativtest periodgap: Behandlungsdatum außerhalb des Befreiungszeitraums wird abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  // Leistung ist am 2026-08-28; Nachweis gilt nur bis 2026-08-27
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
        owner_id: TEST_OWNER_ID,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
        patient_id: TEST_PATIENT_ID,
        owner_id: TEST_OWNER_ID,
      },
      reason: 'KZ1',
      nachweisPruefung: makeValidProofKZ1({ gueltigAb: '2026-01-01', gueltigBis: '2026-08-27' }),
    });
  }, (err) => {
    assert.equal(err.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');
    assert.equal(err.status, 422);
    assert.match(err.message, /liegt außerhalb des verifizierten Befreiungszeitraums/);
    return true;
  });
});

test('16. Negativtest wrongpatientIK: Falsche Patienten-ID oder Kostenträger-IK im Nachweis wird abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
    owner_id: TEST_OWNER_ID,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  // Abweichende Patienten-ID
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ1',
      nachweisPruefung: makeValidProofKZ1({ patientId: '33333333-3333-4333-8333-333333333333' }),
    });
  }, (err) => {
    assert.equal(err.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');
    assert.equal(err.status, 422);
    assert.match(err.message, /Patienten-ID/);
    return true;
  });

  // Abweichende Kostenträger-IK
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ1',
      nachweisPruefung: makeValidProofKZ1({ kostentraegerIk: '999999999' }),
    });
  }, (err) => {
    assert.equal(err.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');
    assert.equal(err.status, 422);
    assert.match(err.message, /Kostenträger-IK/);
    return true;
  });
});

test('17. Negativtest auditor: Ungültige Prüfer-ID oder zukünftiger Prüfzeitpunkt wird abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
    owner_id: TEST_OWNER_ID,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  // Nicht-UUID als Prüfer-ID
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ1',
      nachweisPruefung: makeValidProofKZ1({ prueferId: 'keine-uuid' }),
    });
  }, (err) => {
    assert.equal(err.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');
    assert.equal(err.status, 422);
    return true;
  });

  // Zukünftiges Datum
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ1',
      nachweisPruefung: makeValidProofKZ1({
        geprueftAm: '2099-01-01',
        geprueftZeitpunkt: '2099-01-01T10:00:00.000Z',
      }),
    });
  }, (err) => {
    assert.equal(err.code, 'EXEMPTION_EVIDENCE_UNVERIFIED');
    assert.equal(err.status, 422);
    assert.match(err.message, /Zukunft/);
    return true;
  });
});

test('18. Negativtest KZ5selectedwithoutproof: KZ5 ohne Nachweis wird strikt abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
        owner_id: TEST_OWNER_ID,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
        patient_id: TEST_PATIENT_ID,
        owner_id: TEST_OWNER_ID,
      },
      reason: 'KZ5',
      selectedSessionIndices: [0],
      // Kein nachweisPruefung!
    });
  }, (err) => {
    assert.equal(err.code, 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED');
    assert.equal(err.status, 422);
    return true;
  });
});

test('19. Positivtest KZ1 mit vollständigem manuellem Nachweis (belastungsgrenze62)', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const parsed = parseOriginalDtaMessage({
    dtaContent: Buffer.from(built.content, 'latin1'),
    expectedSha256: hash,
    sourceHeader: {
      rechnungsnummer: f.rechnung.sammelRechnungsnummer,
      rechnungsdatum: f.rechnung.datum,
      kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      owner_id: TEST_OWNER_ID,
    },
    sourceZeile: {
      einzel_rechnungsnummer: '0',
      belegnummer: f.prescriptions[0].patient.belegnummer,
      versichertennummer: f.prescriptions[0].patient.kvnr,
      verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
      brutto_eur: 28.90,
      zuzahlung_eur: 12.89,
      netto_eur: 16.01,
      patient_id: TEST_PATIENT_ID,
      owner_id: TEST_OWNER_ID,
    },
    reason: 'KZ1',
    nachweisPruefung: makeValidProofKZ1({
      gueltigAb: '2026-01-01',
      gueltigBis: '2026-12-31',
    }),
  });

  assert.equal(parsed.reason, 'KZ1');
  assert.equal(parsed.prescription.verordnung.zuzahlungskennzeichen, '1');
  assert.equal(parsed.claimAmount, 12.89);
  assert.equal(parsed.prozClaim, 2.89);
  assert.equal(parsed.pauschClaim, 10.00);
});

test('20. Positivtest KZ5 mit vollständigem manuellem Nachweis (statuswechsel_jahreswechsel)', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const proof = makeValidProofKZ5({
    gueltigAb: '2026-01-01',
    gueltigBis: '2026-08-25',
    statusWechselDatum: '2026-08-26',
    zahlungsaufforderungReferenz: 'ZA-2026-08-001',
    zahlungsaufforderungDatum: '2026-08-27',
  });

  const parsed = parseOriginalDtaMessage({
    dtaContent: Buffer.from(built.content, 'latin1'),
    expectedSha256: hash,
    sourceHeader: {
      rechnungsnummer: f.rechnung.sammelRechnungsnummer,
      rechnungsdatum: f.rechnung.datum,
      kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
      owner_id: TEST_OWNER_ID,
    },
    sourceZeile: {
      einzel_rechnungsnummer: '0',
      belegnummer: f.prescriptions[0].patient.belegnummer,
      versichertennummer: f.prescriptions[0].patient.kvnr,
      verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
      brutto_eur: 28.90,
      zuzahlung_eur: 12.89,
      netto_eur: 16.01,
      patient_id: TEST_PATIENT_ID,
      owner_id: TEST_OWNER_ID,
    },
    reason: 'KZ5',
    selectedSessionIndices: [0], // Position 0 ist am 2026-08-28 (> 2026-08-26)
    nachweisPruefung: proof,
  });

  assert.equal(parsed.reason, 'KZ5');
  assert.equal(parsed.prescription.verordnung.zuzahlungskennzeichen, '5');
  assert.equal(parsed.claimAmount, 12.89);
  assert.equal(parsed.prozClaim, 2.89);
  assert.equal(parsed.pauschClaim, 10.00);
});

test('21. Ursprungsrechnung mit VKZ ungleich 01 wird strikt abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const modifiedContent = built.content.replace("FKT+01++123456789+101000000+101000000'", "FKT+02++123456789+101000000+101000000'");
  const hash = sha256Hex(Buffer.from(modifiedContent, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(modifiedContent, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: '101000000',
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
      },
      reason: 'KZ2',
      currentSenderIk: f.absender.ik,
    });
  }, (err) => {
    assert.equal(err.code, 'INVALID_ORIGINAL_VKZ');
    assert.equal(err.status, 422);
    assert.match(err.message, /VKZ 01 zulässig/);
    return true;
  });
});

test('22. Strikte Mengen- und Betragsvalidierung (keine nicht-positive Menge)', () => {
  const rawBadAnzahl = "UNB+UNOC:3+800000000+108310400+261002:1200+00001++B'UNH+000001+SLLA:21:0:0'FKT+01++800000000+108310400+108310400'REC+R2026-W40-001:0+20261001+1'INV+X123456789+10000+00+B001'NAD+Muster+Max+19800101+Musterweg 1+80331+München+D'ZHE+999999999+999999999+20260901+3+WS+01+++++0+0+0000++0+1+1'DIA+M54.5'EHE+22:00000+20501+0+50,00+20260905+5,00'BES+50,00+15,00+5,00+10,00'UNT+000010+000001'UNZ+000001+00001'";
  const hash = sha256Hex(Buffer.from(rawBadAnzahl, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(rawBadAnzahl, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: 'R2026-W40-001',
        rechnungsdatum: '2026-10-01',
        kostentraeger_ik: '108310400',
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: 'B001',
        versichertennummer: 'X123456789',
        verordnungsdatum: '2026-09-01',
        brutto_eur: 50.00,
        zuzahlung_eur: 15.00,
        netto_eur: 35.00,
      },
      reason: 'KZ2',
      currentSenderIk: '800000000',
    });
  }, (err) => {
    assert.equal(err.code, 'INVALID_AMOUNT');
    assert.match(err.message, /nicht-positive Menge/);
    return true;
  });
});

test('23. Mehrere Tarife in einer Verordnung werden strikt abgewiesen', () => {
  const rawMultiTarif = "UNB+UNOC:3+800000000+108310400+261002:1200+00001++B'UNH+000001+SLLA:21:0:0'FKT+01++800000000+108310400+108310400'REC+R2026-W40-001:0+20261001+1'INV+X123456789+10000+00+B001'NAD+Muster+Max+19800101+Musterweg 1+80331+München+D'ZHE+999999999+999999999+20260901+3+WS+01+++++0+0+0000++0+1+1'DIA+M54.5'EHE+22:00001+20501+1,00+25,00+20260905+2,50'EHE+22:00002+20502+1,00+25,00+20260906+2,50'BES+50,00+15,00+5,00+10,00'UNT+000011+000001'UNZ+000001+00001'";
  const hash = sha256Hex(Buffer.from(rawMultiTarif, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(rawMultiTarif, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: 'R2026-W40-001',
        rechnungsdatum: '2026-10-01',
        kostentraeger_ik: '108310400',
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: 'B001',
        versichertennummer: 'X123456789',
        verordnungsdatum: '2026-09-01',
        brutto_eur: 50.00,
        zuzahlung_eur: 15.00,
        netto_eur: 35.00,
      },
      reason: 'KZ2',
      currentSenderIk: '800000000',
    });
  }, (err) => {
    assert.equal(err.code, 'MULTIPLE_TARIFFS_NOT_SUPPORTED');
    return true;
  });
});

test('24. Negativtest sourceconflict owner: Abweichende Inhaber-IDs in Ursprungskopf und Zeile werden abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
        owner_id: TEST_OWNER_ID,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
        patient_id: TEST_PATIENT_ID,
        owner_id: '99999999-9999-4999-8999-999999999999', // Konflikt!
      },
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2(),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.match(err.message, /Widersprüchliche Inhaber/);
    return true;
  });
});

test('25. Negativtest sourceconflict patient: Abweichende Patienten-IDs zwischen Zeile und verifiedSourcePatientId werden abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
        owner_id: TEST_OWNER_ID,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
        patient_id: TEST_PATIENT_ID,
        owner_id: TEST_OWNER_ID,
      },
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2(),
      verifiedSourcePatientId: '88888888-8888-4888-8888-888888888888', // Konflikt mit TEST_PATIENT_ID!
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.match(err.message, /Widersprüchliche Patienten-IDs/);
    return true;
  });
});

test('26. Negativtest duplicate indices: Doppelte Sitzungsindizes werden strikt abgewiesen (kein stilles Entdoppeln)', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
        owner_id: TEST_OWNER_ID,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
        patient_id: TEST_PATIENT_ID,
        owner_id: TEST_OWNER_ID,
      },
      reason: 'KZ2',
      selectedSessionIndices: [0, 0], // Doppelt!
      nachweisPruefung: makeValidProofKZ2(),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'DUPLICATE_SESSION_INDICES');
    return true;
  });
});

test('27. Negativtest missingproof2: Grund 2 ohne Nachweis wird mit PAYMENT_DEMAND_EVIDENCE_UNVERIFIED abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: {
        rechnungsnummer: f.rechnung.sammelRechnungsnummer,
        rechnungsdatum: f.rechnung.datum,
        kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
        owner_id: TEST_OWNER_ID,
      },
      sourceZeile: {
        einzel_rechnungsnummer: '0',
        belegnummer: f.prescriptions[0].patient.belegnummer,
        versichertennummer: f.prescriptions[0].patient.kvnr,
        verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
        brutto_eur: 28.90,
        zuzahlung_eur: 12.89,
        netto_eur: 16.01,
        patient_id: TEST_PATIENT_ID,
        owner_id: TEST_OWNER_ID,
      },
      reason: 'KZ2',
      // Kein nachweisPruefung!
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED');
    return true;
  });
});

test('28. Negativtest proof2keys: Unerwartete oder fehlende Schlüssel bei Grund 2 werden abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
    owner_id: TEST_OWNER_ID,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  // Unerwarteter Schlüssel (gueltigAb darf bei Grund 2 nicht existieren)
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: {
        ...makeValidProofKZ2(),
        gueltigAb: '2026-01-01',
      },
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED');
    assert.match(err.message, /Unerwarteter Schlüssel/);
    return true;
  });

  // Fehlender Pflichtschlüssel (versandArt fehlt)
  const proofWithoutVersandArt = makeValidProofKZ2();
  delete proofWithoutVersandArt.versandArt;
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: proofWithoutVersandArt,
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED');
    assert.match(err.message, /Pflichtfeld "versandArt" im Nachweisobjekt fehlt/);
    return true;
  });
});

test('29. Negativtest Grund-2-Felder: Ungültige versandArt, Versand nach Prüfung und unbestätigte Flags werden abgewiesen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
    owner_id: TEST_OWNER_ID,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  // Ungültige versandArt ('brieftaube')
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({ versandArt: 'brieftaube' }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED');
    assert.match(err.message, /Ungültige Versandart/);
    return true;
  });

  // Versand darf nicht nach dem Prüftag liegen; frühere Versandtage sind zulässig.
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({ versandDatum: '2026-09-16', geprueftAm: '2026-09-15' }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED');
    assert.match(err.message, /darf nicht nach dem Prüfdatum/);
    return true;
  });

  // nachweisBeigefuegtBestaetigt = false
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({ nachweisBeigefuegtBestaetigt: false }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED');
    assert.match(err.message, /Beifügung des Nachweises/);
    return true;
  });

  // erfolgloserEinzugBestaetigt = false
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({ erfolgloserEinzugBestaetigt: false }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED');
    assert.match(err.message, /erfolglose Einzug/);
    return true;
  });
});

test('30. Strikte Nachweis-String-Validierung: Datumsstrings und 9-stellige IK-Prüfung', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
    owner_id: TEST_OWNER_ID,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  // Nicht 9-stellige IK (z.B. '1010')
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({ kostentraegerIk: '1010' }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.match(err.message, /9-stelliger Ziffernstring/);
    return true;
  });

  // Numerische IK statt String
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({ kostentraegerIk: 101000000 }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.match(err.message, /9-stelliger Ziffernstring/);
    return true;
  });

  // Feb 31 im Nachweisdatum
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({
        geprueftAm: '2026-02-31',
        geprueftZeitpunkt: '2026-02-31T10:00:00.000Z',
        versandDatum: '2026-02-31',
      }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.match(err.message, /kein gültiger ISO-Kalendertag/);
    return true;
  });
});

test('31. Zeitstempel-, Zeitzonen- und 24h-Guard-Regressionen', () => {
  const f = structuredClone(podoFixture);
  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const baseHeader = {
    rechnungsnummer: f.rechnung.sammelRechnungsnummer,
    rechnungsdatum: f.rechnung.datum,
    kostentraeger_ik: f.prescriptions[0].verordnung.kostentraegerIk,
    owner_id: TEST_OWNER_ID,
  };
  const baseZeile = {
    einzel_rechnungsnummer: '0',
    belegnummer: f.prescriptions[0].patient.belegnummer,
    versichertennummer: f.prescriptions[0].patient.kvnr,
    verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
    brutto_eur: 28.90,
    zuzahlung_eur: 12.89,
    netto_eur: 16.01,
    patient_id: TEST_PATIENT_ID,
    owner_id: TEST_OWNER_ID,
  };

  // Zeitzonen-Mismatch: 2026-09-14T23:30:00.000Z ist in Berlin (MESZ = UTC+2) bereits der 2026-09-15
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({
        geprueftAm: '2026-09-14',
        geprueftZeitpunkt: '2026-09-14T23:30:00.000Z',
        versandDatum: '2026-09-14',
      }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.match(err.message, /stimmt nicht mit dem Prüfdatum/);
    return true;
  });

  // 24h Guard: Stunde 25
  assert.throws(() => {
    parseOriginalDtaMessage({
      dtaContent: Buffer.from(built.content, 'latin1'),
      expectedSha256: hash,
      sourceHeader: baseHeader,
      sourceZeile: baseZeile,
      reason: 'KZ2',
      nachweisPruefung: makeValidProofKZ2({
        geprueftAm: '2026-09-15',
        geprueftZeitpunkt: '2026-09-15T25:00:00.000Z',
        versandDatum: '2026-09-15',
      }),
    });
  }, (err) => {
    assert.equal(err.status, 422);
    assert.match(err.message, /24h-Guard/);
    return true;
  });
});

test('32. Positivtest Grund 2: Roundtrip Builder -> Parser -> VKZ03 Builder mit tatsächlichem buildDtaFile', () => {
  const f = structuredClone(podoFixture);
  f.absender.ik = '800000000';
  f.empfaenger.ik = '108310400';
  f.prescriptions[0].verordnung.kostentraegerIk = '108310400';
  f.prescriptions[0].verordnung.krankenkasseIk = '108310400';

  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const parsed = parseOriginalDtaMessage({
    dtaContent: Buffer.from(built.content, 'latin1'),
    expectedSha256: hash,
    sourceHeader: {
      rechnungsnummer: f.rechnung.sammelRechnungsnummer,
      rechnungsdatum: f.rechnung.datum,
      kostentraeger_ik: '108310400',
      owner_id: TEST_OWNER_ID,
    },
    sourceZeile: {
      einzel_rechnungsnummer: '0',
      belegnummer: f.prescriptions[0].patient.belegnummer,
      versichertennummer: f.prescriptions[0].patient.kvnr,
      verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
      kostentraeger_ik: '108310400',
      brutto_eur: 28.90,
      zuzahlung_eur: 12.89,
      netto_eur: 16.01,
      patient_id: TEST_PATIENT_ID,
      owner_id: TEST_OWNER_ID,
    },
    reason: '2',
    currentSenderIk: '800000000',
    nachweisPruefung: makeValidProofKZ2({ kostentraegerIk: '108310400' }),
    verifiedSourcePatientId: TEST_PATIENT_ID,
  });

  assert.equal(parsed.reason, 'KZ2');
  assert.equal(parsed.prescription.verordnung.zuzahlungskennzeichen, '2');
  assert.equal(parsed.claimAmount, 12.89);

  const vkz03 = buildDtaFile({
    preflight: false,
    absender: f.absender,
    empfaenger: f.empfaenger,
    rechnung: {
      sammelRechnungsnummer: 'R2026-W40-002',
      einzelRechnungsnummer: '0',
      datum: new Date('2026-10-02'),
      datennummer: 2,
      rechnungsart: '1',
    },
    prescriptions: [parsed.prescription],
    kind: 'echt',
    vkz: '03',
    transfernummer: 2,
    rechnungssteller: {
      name: f.absender.name,
      telefon: '0224112345',
    },
  });

  assert.ok(vkz03.content.includes("FKT+03+"));
  assert.ok(vkz03.content.includes("URI+800000000+"));
  assert.ok(vkz03.content.includes("GZF+12,89+2,89+10,00'"));
});

test('33. Positivtest Grund 1: Roundtrip Builder -> Parser -> VKZ03 Builder mit tatsächlichem buildDtaFile', () => {
  const f = structuredClone(podoFixture);
  f.absender.ik = '800000000';
  f.empfaenger.ik = '108310400';
  f.prescriptions[0].verordnung.kostentraegerIk = '108310400';
  f.prescriptions[0].verordnung.krankenkasseIk = '108310400';

  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const parsed = parseOriginalDtaMessage({
    dtaContent: Buffer.from(built.content, 'latin1'),
    expectedSha256: hash,
    sourceHeader: {
      rechnungsnummer: f.rechnung.sammelRechnungsnummer,
      rechnungsdatum: f.rechnung.datum,
      kostentraeger_ik: '108310400',
      owner_id: TEST_OWNER_ID,
    },
    sourceZeile: {
      einzel_rechnungsnummer: '0',
      belegnummer: f.prescriptions[0].patient.belegnummer,
      versichertennummer: f.prescriptions[0].patient.kvnr,
      verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
      kostentraeger_ik: '108310400',
      brutto_eur: 28.90,
      zuzahlung_eur: 12.89,
      netto_eur: 16.01,
      patient_id: TEST_PATIENT_ID,
      owner_id: TEST_OWNER_ID,
    },
    reason: 'KZ1',
    currentSenderIk: '800000000',
    nachweisPruefung: makeValidProofKZ1({
      kostentraegerIk: '108310400',
      gueltigAb: '2026-01-01',
      gueltigBis: '2026-12-31',
    }),
    verifiedSourcePatientId: TEST_PATIENT_ID,
  });

  assert.equal(parsed.reason, 'KZ1');
  assert.equal(parsed.prescription.verordnung.zuzahlungskennzeichen, '1');

  const vkz03 = buildDtaFile({
    preflight: false,
    absender: f.absender,
    empfaenger: f.empfaenger,
    rechnung: {
      sammelRechnungsnummer: 'R2026-W40-003',
      einzelRechnungsnummer: '0',
      datum: new Date('2026-10-02'),
      datennummer: 3,
      rechnungsart: '1',
    },
    prescriptions: [parsed.prescription],
    kind: 'echt',
    vkz: '03',
    transfernummer: 3,
    rechnungssteller: {
      name: f.absender.name,
      telefon: '0224112345',
    },
  });

  assert.ok(vkz03.content.includes("FKT+03+"));
  assert.ok(vkz03.content.includes("URI+800000000+"));
  assert.ok(vkz03.content.includes("GZF+12,89+2,89+10,00'"));
});

test('34. Positivtest Grund 5: Roundtrip Builder -> Parser -> VKZ03 Builder mit tatsächlichem buildDtaFile', () => {
  const f = structuredClone(podoFixture);
  f.absender.ik = '800000000';
  f.empfaenger.ik = '108310400';
  f.prescriptions[0].verordnung.kostentraegerIk = '108310400';
  f.prescriptions[0].verordnung.krankenkasseIk = '108310400';

  const built = buildDtaFile(f);
  const hash = sha256Hex(Buffer.from(built.content, 'latin1'));

  const parsed = parseOriginalDtaMessage({
    dtaContent: Buffer.from(built.content, 'latin1'),
    expectedSha256: hash,
    sourceHeader: {
      rechnungsnummer: f.rechnung.sammelRechnungsnummer,
      rechnungsdatum: f.rechnung.datum,
      kostentraeger_ik: '108310400',
      owner_id: TEST_OWNER_ID,
    },
    sourceZeile: {
      einzel_rechnungsnummer: '0',
      belegnummer: f.prescriptions[0].patient.belegnummer,
      versichertennummer: f.prescriptions[0].patient.kvnr,
      verordnungsdatum: f.prescriptions[0].verordnung.ausstellungsdatum,
      kostentraeger_ik: '108310400',
      brutto_eur: 28.90,
      zuzahlung_eur: 12.89,
      netto_eur: 16.01,
      patient_id: TEST_PATIENT_ID,
      owner_id: TEST_OWNER_ID,
    },
    reason: '5',
    selectedSessionIndices: [0],
    currentSenderIk: '800000000',
    nachweisPruefung: makeValidProofKZ5({
      kostentraegerIk: '108310400',
      gueltigAb: '2026-01-01',
      gueltigBis: '2026-08-25',
      statusWechselDatum: '2026-08-26',
      zahlungsaufforderungReferenz: 'ZA-2026-08-001',
      zahlungsaufforderungDatum: '2026-08-27',
    }),
    verifiedSourcePatientId: TEST_PATIENT_ID,
  });

  assert.equal(parsed.reason, 'KZ5');
  assert.equal(parsed.prescription.verordnung.zuzahlungskennzeichen, '5');

  const vkz03 = buildDtaFile({
    preflight: false,
    absender: f.absender,
    empfaenger: f.empfaenger,
    rechnung: {
      sammelRechnungsnummer: 'R2026-W40-004',
      einzelRechnungsnummer: '0',
      datum: new Date('2026-10-02'),
      datennummer: 4,
      rechnungsart: '1',
    },
    prescriptions: [parsed.prescription],
    kind: 'echt',
    vkz: '03',
    transfernummer: 4,
    rechnungssteller: {
      name: f.absender.name,
      telefon: '0224112345',
    },
  });

  assert.ok(vkz03.content.includes("FKT+03+"));
  assert.ok(vkz03.content.includes("URI+800000000+"));
  assert.ok(vkz03.content.includes("GZF+12,89+2,89+10,00'"));
});
