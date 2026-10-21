import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fehlendePflichtangaben, istRechnungsartig, belegDruckUrl } from './beleg-druck.js';

// --- fehlendePflichtangaben --------------------------------------------------
// Zuzahlungsbeleg = Kleinbetragsrechnung (§ 33 UStDV, legal-de 21.10.2026): Name + Anschrift
// Pflicht; Steuernummer erst über 250 €; IBAN nie. Wörtlich die Regel des Servers.
const VOLL = { business_name: 'Praxis Muster', street: 'Hauptstr. 1', zip: '53721', city: 'Siegburg' };

test('Name + Anschrift genügen — ohne IBAN und Steuernummer', () => {
  assert.deepEqual(fehlendePflichtangaben(VOLL), []);
});

test('fehlender Name und unvollständige Anschrift werden benannt', () => {
  assert.deepEqual(fehlendePflichtangaben({ ...VOLL, business_name: '', zip: '' }), ['Praxisname', 'Praxisanschrift (Straße, PLZ, Ort)']);
  assert.equal(fehlendePflichtangaben(null).length, 2);
});

test('über 250 € kommt Steuernummer oder USt-IdNr. dazu', () => {
  assert.deepEqual(fehlendePflichtangaben(VOLL, { betrag: 250 }), []);
  assert.deepEqual(fehlendePflichtangaben(VOLL, { betrag: 250.01 }), ['Steuernummer oder USt-IdNr. (Beleg über 250 €)']);
  assert.deepEqual(fehlendePflichtangaben({ ...VOLL, ust_id: 'DE123456789' }, { betrag: 300 }), []);
});

// --- istRechnungsartig -------------------------------------------------------

test('alte RE-Rechnungsarten sind nicht mehr rechnungsartig (abgelöst durch Rechnungs-Editor)', () => {
  for (const t of ['rechnung_privat', 'rechnung_selbstzahler', 'rechnung_sonder', 'rechnung_bg']) {
    assert.equal(istRechnungsartig(t), false, t);
  }
});

// Trotz des Namens „Quittung": Fälligkeit + Bankzeile machen sie zur Rechnung,
// der Server prüft sie deshalb auf eigener Route immer.
test('die Zuzahlungsrechnung ist rechnungsartig', () => {
  assert.equal(istRechnungsartig('quittung_zuzahlung'), true);
});

test('Quittungen ohne Rechnungscharakter sind es nicht', () => {
  assert.equal(istRechnungsartig('quittung_rzg'), false);
  assert.equal(istRechnungsartig(undefined), false);
});

// --- belegDruckUrl -----------------------------------------------------------

test('Zuzahlungsrechnung geht auf ihre eigene Route', () => {
  const u = belegDruckUrl({ api: '/api', rxId: 'r1', typ: 'quittung_zuzahlung', token: 'tok' });
  assert.equal(u, '/api/billing/prescription/r1/zuzahlungsrechnung?token=tok');
});

test('print=1 nur wenn gedruckt werden soll', () => {
  assert.match(belegDruckUrl({ api: '/api', rxId: 'r1', typ: 'quittung_zuzahlung', token: 't', drucken: true }), /&print=1$/);
});

test('alle anderen Arten gehen auf /rechnung mit type', () => {
  const u = belegDruckUrl({ api: '/api', rxId: 'r1', typ: 'rechnung_privat', token: 'tok' });
  assert.equal(u, '/api/billing/prescription/r1/rechnung?type=rechnung_privat&token=tok');
});

// Das Token ist ein JWT und kann '+' und '/' enthalten — unkodiert bricht der
// Query-String und der Server antwortet 401 statt zu drucken.
test('Token wird kodiert', () => {
  const u = belegDruckUrl({ api: '/api', rxId: 'r1', typ: 'quittung_zuzahlung', token: 'a+b/c=' });
  assert.match(u, /token=a%2Bb%2Fc%3D/);
});
