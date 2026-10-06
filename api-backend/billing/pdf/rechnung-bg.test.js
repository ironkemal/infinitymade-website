import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRechnung } from './rechnung.template.js';

const basis = {
  praxis: { name: 'Praxis Nord', strasse: 'Weg 1', plz_ort: '12345 Ort', telefon: '1', ik: '123456789', steuernummer: '1/2/3' },
  patient: { vorname: 'Anna', nachname: 'Muster', strasse: 'Str. 2', plz: '54321', ort: 'Stadt', geburtsdatum: '1970-03-08', kvnr: 'A123' },
  verordnung: { ausstellungsdatum: '2026-09-16', krankenkasse: 'AOK X', icd10: 'E11.74' },
  rechnung: { nummer: 'RE-1', datum: '2026-10-06', faelligkeit: '2026-10-20', kvnr: 'A123' },
  sessions: [{ datum: '2026-09-20', position: '78020', bezeichnung: 'Behandlung', brutto: 40 }],
  totals: { brutto: 40, netto: 40, gesamt: 40 },
};
const bg = { traeger_name: 'BG <Holz>', traeger_anschrift: 'Musterstr. 1\n12345 Musterstadt', unfalltag: '2026-09-15', aktenzeichen: 'AZ 1/26' };

test('BG-Rechnung: Empfänger ist der UV-Träger, nicht der Patient', () => {
  const h = renderRechnung({ ...basis, type: 'rechnung_bg', rechnung: { ...basis.rechnung, bg } });
  const box = h.slice(h.indexOf('Rechnungsempfänger'), h.indexOf('invoice-meta">'));
  assert.match(box, /BG &lt;Holz&gt;/, 'Träger escaped');
  assert.match(box, /Musterstr\. 1<br>12345 Musterstadt/);
  assert.doesNotMatch(box, /Anna|Muster</, 'Patient steht nicht im Empfängerfeld');
});

test('BG-Rechnung: Bezug (Versicherte Person, Unfalltag, Aktenzeichen), keine Kasse/KVNR/Diagnose', () => {
  const h = renderRechnung({ ...basis, type: 'rechnung_bg', rechnung: { ...basis.rechnung, bg } });
  assert.match(h, /Versicherte Person<\/dt><dd>Anna Muster \(geb\. 08\.03\.1970\)/);
  assert.match(h, /Unfalltag<\/dt><dd>15\.09\.2026/);
  assert.match(h, /Aktenzeichen<\/dt><dd>AZ 1\/26/);
  assert.doesNotMatch(h, /Krankenkasse|KVNR|AOK X|E11\.74/);
});

test('BG-Rechnung ohne bg-Daten fällt auf das alte Verhalten zurück (Patient als Empfänger)', () => {
  const h = renderRechnung({ ...basis, type: 'rechnung_bg' });
  assert.match(h, /Anna Muster/);
});

test('Privatrechnung bleibt unverändert', () => {
  const h = renderRechnung({ ...basis, type: 'rechnung_privat' });
  assert.match(h, /Krankenkasse/);
  assert.doesNotMatch(h, /Unfalltag/);
});
