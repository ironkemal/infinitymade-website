import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMuster13Barcode, PARSER_VERSION, BARCODE_FORMAT } from './rezept-barcode.js';
import { escapeEdifact, freitext, buildSegment } from '../api-backend/billing/dta/encoding.js';

/**
 * Erzeugt einen gültigen 33-Felder-Barcode-Text.
 * Einzelne Felder können per Index (0-basiert) überschrieben werden.
 */
function erstelleBarcode(overrides = {}) {
  // 33 Standard-Felder (1-basiert 01 bis 33)
  const f = [
    '13',                           // 01 Formularcode
    '',                             // 02 Formularcodeergänzung
    '10',                           // 03 Versionsnummer
    'Mustermann',                   // 04 Nachname
    'Erika',                        // 05 Vorname
    '19750308',                     // 06 Geburtsdatum
    '20281231',                     // 07 Versicherungsschutz Ende
    '104212505',                    // 08 Kostenträgerkennung (Karten-IK)
    'A123456780',                   // 09 Versicherten-ID (valide Prüfziffer)
    '1',                            // 10 Versichertenart
    '00',                           // 11 Besondere Personengruppe
    '00',                           // 12 DMP-Kennzeichnung
    '123456789',                    // 13 BSNR
    '987654321',                    // 14 LANR
    '20261001',                     // 15 Ausstellungsdatum
    '2',                            // 16 Heilmittelart (2 = Podologie)
    'E11.74 G',                     // 17 ICD-10
    'L60.0 G',                      // 18 Zweiter ICD-10
    'DF',                           // 19 Diagnosegruppe
    'a',                            // 20 Leitsymptomatik
    '',                             // 21 patientenindividuelle Leitsymptomatik
    'Podologische Behandlung (groß)', // 22 Heilmittel
    '6',                            // 23 Einheiten
    '',                             // 24 Zweites Heilmittel
    '',                             // 25 Einheiten Zweites Heilmittel
    '',                             // 26 Drittes Heilmittel
    '',                             // 27 Einheiten Drittes Heilmittel
    '',                             // 28 Ergänzendes Heilmittel
    '',                             // 29 Einheiten Ergänzendes Heilmittel
    '1-2x wöchentl.',               // 30 Therapiefrequenz
    '1',                            // 31 Therapiebericht
    '1',                            // 32 Hausbesuch
    '',                             // 33 Dringlicher Behandlungsbedarf (1 oder leer)
  ];

  for (const [idx, val] of Object.entries(overrides)) {
    f[Number(idx)] = val;
  }
  return f.join('\t');
}

test('parseMuster13Barcode: Vollständiger gültiger Barcode wird korrekt geparst', () => {
  const barcode = erstelleBarcode();
  const res = parseMuster13Barcode(barcode);

  assert.equal(res.quelle, 'barcode');
  assert.equal(res.format, BARCODE_FORMAT);
  assert.equal(res.parser_version, PARSER_VERSION);

  // Patient
  assert.equal(res.parsed.patient.first_name, 'Erika');
  assert.equal(res.parsed.patient.last_name, 'Mustermann');
  assert.equal(res.parsed.patient.geburtsdatum, '1975-03-08');
  assert.equal(res.parsed.patient.versichertennummer, 'A123456780');
  assert.equal(res.parsed.patient.versichertenstatus, '1');
  assert.equal(res.parsed.patient.krankenkasse_ik, '104212505');

  // Arzt
  assert.equal(res.parsed.arzt.bsnr, '123456789');
  assert.equal(res.parsed.arzt.lanr, '987654321');
  assert.equal(res.parsed.arzt.ausstellungsdatum, '2026-10-01');

  // Rezept
  assert.equal(res.parsed.rezept.therapiebereich, 'podo');
  assert.equal(res.parsed.rezept.heilmittel, 'Podologische Behandlung (groß)');
  assert.equal(res.parsed.rezept.anzahl_einheiten, 6);
  assert.equal(res.parsed.rezept.heilmittel_position, '78020');
  assert.equal(res.parsed.rezept.icd10, 'E11.74 G');
  assert.equal(res.parsed.rezept.icd10_2, 'L60.0 G');
  assert.equal(res.parsed.rezept.diagnosegruppe, 'DF');
  assert.equal(res.parsed.rezept.leitsymptomatik, 'a');
  assert.equal(res.parsed.rezept.frequenz, '1-2x wöchentl.');
  assert.equal(res.parsed.rezept.hausbesuch, true);
  assert.equal(res.parsed.rezept.bericht_angefordert, true);
  assert.equal(res.parsed.rezept.is_dringend, false);
  assert.equal(res.parsed.rezept.unterschrift_vorhanden, null);
  assert.equal(res.parsed.rezept.signature_confidence, null);

  assert.deepEqual(res.heilmittelItems, [{ text: 'Podologische Behandlung (groß)', einheiten: 6 }]);
});

test('parseMuster13Barcode: Leeres Feld 33 (nicht dringend) endet legitim mit TAB', () => {
  const barcode = erstelleBarcode({ 32: '' });
  assert.ok(barcode.endsWith('\t'), 'Barcode muss mit TAB vor leerem Feld 33 enden');

  const res = parseMuster13Barcode(barcode);
  assert.equal(res.parsed.rezept.is_dringend, false);
});

test('parseMuster13Barcode: Teilweises Geburtsdatum setzt null und Hinweis', () => {
  // 00000000
  const r1 = parseMuster13Barcode(erstelleBarcode({ 5: '00000000' }));
  assert.equal(r1.parsed.patient.geburtsdatum, null);
  assert.match(r1.hinweise[0], /00000000/);

  // YYYY0000
  const r2 = parseMuster13Barcode(erstelleBarcode({ 5: '19800000' }));
  assert.equal(r2.parsed.patient.geburtsdatum, null);
  assert.match(r2.hinweise[0], /Geburtsjahr/);

  // YYYYMM00
  const r3 = parseMuster13Barcode(erstelleBarcode({ 5: '19800500' }));
  assert.equal(r3.parsed.patient.geburtsdatum, null);
  assert.match(r3.hinweise[0], /keinen Tag/);

  // Echtes Schaltjahr 2000-02-29
  const r4 = parseMuster13Barcode(erstelleBarcode({ 5: '20000229' }));
  assert.equal(r4.parsed.patient.geburtsdatum, '2000-02-29');

  // Kein Schaltjahr 2001-02-29 wirft
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 5: '20010229' })), /Geburtsdatum/);
});

test('parseMuster13Barcode: Fehlender Hausbesuch setzt null und Hinweis', () => {
  const r = parseMuster13Barcode(erstelleBarcode({ 31: '' }));
  assert.equal(r.parsed.rezept.hausbesuch, null);
  assert.match(r.hinweise[0], /Hausbesuch fehlt/);
});

test('parseMuster13Barcode: Pflichtfelder Patient werfen ohne PII', () => {
  // Fehlender Nachname
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: '' })), (err) => {
    assert.match(err.message, /Nachname/);
    assert.doesNotMatch(err.message, /Mustermann/);
    return true;
  });

  // Fehlender Vorname
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 4: '' })), (err) => {
    assert.match(err.message, /Vorname/);
    return true;
  });
});

test('parseMuster13Barcode: Sektor 1 (Physio) wird in v1 Podologie abgewiesen', () => {
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 15: '1' })), /Podologie-Verordnungen/);
});

test('parseMuster13Barcode: Mehrere Heilmittelzeilen oder Ergänzung führen zu Fail-Closed', () => {
  // Zweite Zeile befüllt
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 23: 'Zweites Heilmittel', 24: '6' })),
    /Mehrere Heilmittelzeilen/);

  // Ergänzendes Heilmittel befüllt
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 27: 'Warmpackung', 28: '6' })),
    /Mehrere Heilmittelzeilen/);

  // 0 Einheiten
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 22: '0' })),
    /größer als 0/);
});

test('parseMuster13Barcode: Falsche Feldanzahl oder Überlänge wird abgewiesen', () => {
  // 32 Felder (ein TAB zu wenig)
  const zuWenig = erstelleBarcode().split('\t').slice(0, 32).join('\t');
  assert.throws(() => parseMuster13Barcode(zuWenig), /Unerwartete Feldanzahl/);

  // 34 Felder
  const zuViel = erstelleBarcode() + '\tEXTRA';
  assert.throws(() => parseMuster13Barcode(zuViel), /Unerwartete Feldanzahl/);

  // Gesamtlänge über 457
  const zuLang = erstelleBarcode({ 3: 'A'.repeat(45), 21: 'B'.repeat(51), 23: 'C'.repeat(51) }) + 'X'.repeat(400);
  assert.throws(() => parseMuster13Barcode(zuLang), /maximale Gesamtlänge/);
});

test('parseMuster13Barcode: Feldlängenprüfung vor dem Trimmen greift', () => {
  // Nachname mit 46 Zeichen inklusive Leerzeichen am Ende
  const nachnameZuLang = 'Mustermann' + ' '.repeat(36); // Länge 46 > 45
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: nachnameZuLang })),
    /maximal zulässige Feldlänge/);
});

test('Numerische Rohfelder tolerieren keine Leerzeichen, unbelegte Angaben bleiben unbekannt', () => {
  for(const index of [6,7,9,10,11,12,13,14,15,20,22,24,26,28,30,31,32]) {
    assert.throws(()=>parseMuster13Barcode(erstelleBarcode({[index]:' '})), /Numerisches/);
  }
  assert.throws(()=>parseMuster13Barcode(erstelleBarcode({22:' 6'})), /Numerisches/);
  const r=parseMuster13Barcode(erstelleBarcode());
  assert.equal(r.parsed.rezept.zuzahlung_befreit,null);
  assert.equal(r.parsed.rezept.is_lhb_bvb,null);
  assert.ok(r.hinweise.some(text=>/Zuzahlungsbefreiung/.test(text)));
  const individual=parseMuster13Barcode(erstelleBarcode({20:'1'}));
  assert.equal(individual.parsed.rezept.pat_leitsymptomatik,null);
  assert.ok(individual.hinweise.some(text=>/Leitsymptomatik angekreuzt/.test(text)));
});

test('parseMuster13Barcode: Steuerzeichen und HTML-Tags werden abgewiesen', () => {
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Muster\nmann' })), /Steuerzeichen/);
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Muster\rmann' })), /Steuerzeichen/);
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: '<script>alert(1)</script>' })), /HTML/);
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name >' })), /HTML/);
});

test('parseMuster13Barcode: ISO 8859-15 Zeichensatzprüfung schließt ersetzte Latin-1-Zeichen aus', () => {
  // Gültige ISO 8859-15 Sonderzeichen
  const gut = erstelleBarcode({ 3: 'Müller-Groß', 4: 'Renée €' });
  const res = parseMuster13Barcode(gut);
  assert.equal(res.parsed.patient.last_name, 'Müller-Groß');

  // Die 8 ersetzten Latin-1-Zeichen werden abgewiesen:
  // A4 = ¤ (Currency sign)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name\u00A4' })), /ISO 8859-15/);
  // A6 = ¦ (Broken bar)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name\u00A6' })), /ISO 8859-15/);
  // A8 = ¨ (Diaeresis)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name\u00A8' })), /ISO 8859-15/);
  // B4 = ´ (Acute accent)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name\u00B4' })), /ISO 8859-15/);
  // B8 = ¸ (Cedilla)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name\u00B8' })), /ISO 8859-15/);
  // BC = ¼ (One quarter)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name\u00BC' })), /ISO 8859-15/);
  // BD = ½ (One half)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name\u00BD' })), /ISO 8859-15/);
  // BE = ¾ (Three quarters)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 3: 'Name\u00BE' })), /ISO 8859-15/);
});

test('parseMuster13Barcode: KVNR Prüfziffer wird validiert', () => {
  // A123456780 ist rechnerisch gültig
  const r1 = parseMuster13Barcode(erstelleBarcode({ 8: 'A123456780' }));
  assert.equal(r1.parsed.patient.versichertennummer, 'A123456780');

  // A123456789 ist rechnerisch ungültig (falsche Prüfziffer)
  assert.throws(() => parseMuster13Barcode(erstelleBarcode({ 8: 'A123456789' })),
    /Prüfziffer/);

  // Altes Format <= 12 alphanumerisch bleibt stehen
  const r2 = parseMuster13Barcode(erstelleBarcode({ 8: '12345678' }));
  assert.equal(r2.parsed.patient.versichertennummer, '12345678');
});

// ── EDIFACT Once-Escaping Test mit bestehender API ──────────────────────────

test('EDIFACT: Rohdaten mit Sonderzeichen werden durch freitext() und buildSegment() genau einmal escaped', () => {
  // Ein roher Verordnungstext mit Apostroph, Plus, Doppelpunkt, Fragezeichen und Komma
  const rohText = "Behandlung, groß: 100% + Zusatz? Nein'";

  // In buildSegment() wird freitext() mit escapeEdifact(..., { komma: true }) aufgerufen
  const seg = buildSegment('ZHE', ['01', freitext(rohText)]);

  // Erwartete Entwertung:
  // ? -> ??
  // ' -> ?'
  // + -> ?+
  // : -> ?:
  // , -> ?,
  // buildSegment schließt das Segment mit einem echten ' ab.
  const erwartetInhalt = "Behandlung?, groß?: 100% ?+ Zusatz?? Nein?'";
  assert.equal(seg, `ZHE+01+${erwartetInhalt}'`);

  // Gegenprobe: Würde der Text vorher vor-escaped (' -> ?'), entstünde eine fehlerhafte Doppel-Entwertung
  const vorEscaped = escapeEdifact(rohText, { komma: true });
  const doppeltEscaped = escapeEdifact(vorEscaped, { komma: true });
  assert.notEqual(vorEscaped, doppeltEscaped, 'Mehrfaches Escaping verändert die Nutzdaten ungewollt');
  const parsed=parseMuster13Barcode(erstelleBarcode({3:"O'Neil:+?"}));
  assert.equal(parsed.parsed.patient.last_name,"O'Neil:+?");
  assert.equal(buildSegment('NAD',[parsed.parsed.patient.last_name]),"NAD+O?'Neil?:?+??'");
});
