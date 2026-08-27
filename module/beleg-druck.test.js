import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fehlendePflichtangaben, istRechnungsartig, belegDruckUrl } from './beleg-druck.js';

// --- fehlendePflichtangaben --------------------------------------------------
// Wörtlich die Regel des Servers (§ 14 Abs. 4 UStG). Weicht eine Seite ab,
// blockiert entweder der Server einen durchgelassenen Druck oder das Dashboard
// warnt ohne Anlass — genau die beiden Fehler, die diese Änderung behebt.

test('vollständiges Profil hat keine fehlenden Angaben', () => {
  assert.deepEqual(fehlendePflichtangaben({ iban: 'DE12', steuernummer: '220/5070/0815' }), []);
});

test('USt-IdNr. allein genügt — Steuernummer ist dann nicht nötig', () => {
  assert.deepEqual(fehlendePflichtangaben({ iban: 'DE12', ust_id: 'DE123456789' }), []);
});

test('fehlende IBAN wird benannt', () => {
  assert.deepEqual(fehlendePflichtangaben({ steuernummer: '220/5070/0815' }), ['Bankverbindung (IBAN)']);
});

test('weder Steuernummer noch USt-IdNr. fehlt als eine Angabe', () => {
  assert.deepEqual(fehlendePflichtangaben({ iban: 'DE12' }), ['Steuernummer oder USt-IdNr.']);
});

test('leeres Profil meldet beides, kippt aber nicht', () => {
  assert.equal(fehlendePflichtangaben({}).length, 2);
  assert.equal(fehlendePflichtangaben(null).length, 2);
});

// Leerstring ist kein Wert: ein geleertes Eingabefeld speichert '' und würde
// sonst als „vorhanden" durchgehen.
test('Leerstrings zählen nicht als Angabe', () => {
  assert.equal(fehlendePflichtangaben({ iban: '', steuernummer: '', ust_id: '' }).length, 2);
});

// --- istRechnungsartig -------------------------------------------------------

test('die vier Rechnungsarten des Servers sind rechnungsartig', () => {
  for (const t of ['rechnung_privat', 'rechnung_selbstzahler', 'rechnung_sonder', 'rechnung_bg']) {
    assert.equal(istRechnungsartig(t), true, t);
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
