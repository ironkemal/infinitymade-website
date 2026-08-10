// Tests für die zentrale Preisauflösung.
//   node api-backend/billing/preise/resolver.test.js
import { resolvePreis, findTarifForDate } from './resolver.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('preise/resolver');

// ---------------------------------------------------------------- Podologie
test('Podologie 78010 im Fenster 2025 → 35,16 € / 3,52 €', () => {
  const r = resolvePreis({ bereich: 'podologie', code: '78010', datum: '2026-01-15' });
  assert.equal(r.preis_eur, 35.16);
  assert.equal(r.zuzahlung_eur, 3.52);
  assert.equal(r.position_frei, false);
  assert.equal(r.quelle, 'katalog');
});

test('Podologie 78010 im Fenster 2026 → 36,10 € / 3,61 €', () => {
  const r = resolvePreis({ bereich: 'podologie', code: '78010', datum: '2026-08-10' });
  assert.equal(r.preis_eur, 36.10);
  assert.equal(r.zuzahlung_eur, 3.61);
});

test('Podologie 78020 wechselt zum 01.07.2026 (50,55 → 51,92)', () => {
  assert.equal(resolvePreis({ bereich: 'podologie', code: '78020', datum: '2026-06-30' }).preis_eur, 50.55);
  assert.equal(resolvePreis({ bereich: 'podologie', code: '78020', datum: '2026-07-01' }).preis_eur, 51.92);
});

test('Podologie 78530 Therapiebericht ist zuzahlungsfrei', () => {
  const r = resolvePreis({ bereich: 'podologie', code: '78530', datum: '2026-08-10' });
  assert.equal(r.position_frei, true);
  assert.equal(r.zuzahlung_eur, 0);
});

test('Podologie: Tarif-Override wird ignoriert (kein Tarif für Podologie)', () => {
  const tariffs = [{ position_nr: '78010', preis_eur: 99, gueltig_ab: '2020-01-01', gueltig_bis: null }];
  const r = resolvePreis({ bereich: 'podologie', code: '78010', datum: '2026-08-10', tariffs, positionsnummer: '78010' });
  assert.equal(r.preis_eur, 36.10);
  assert.equal(r.quelle, 'katalog');
});

// ------------------------------------------------------------------- Physio
test('Physio X0501 aus dem Katalog → 29,63 € / 2,96 €', () => {
  const r = resolvePreis({ bereich: 'physiotherapie', code: 'X0501', datum: '2026-08-10' });
  assert.equal(r.preis_eur, 29.63);
  assert.equal(r.zuzahlung_eur, 2.96);
  assert.equal(r.quelle, 'katalog');
});

test('Physio: aufgelöster Code 20501 findet dieselbe Position', () => {
  const a = resolvePreis({ bereich: 'physiotherapie', code: 'X0501', datum: '2026-08-10' });
  const b = resolvePreis({ bereich: 'physiotherapie', code: '20501', datum: '2026-08-10' });
  assert.equal(a.preis_eur, b.preis_eur);
  assert.equal(a.zuzahlung_eur, b.zuzahlung_eur);
});

test('Physio X0708 KG-ZNS Kinder ist zuzahlungsfrei', () => {
  const r = resolvePreis({ bereich: 'physiotherapie', code: 'X0708', datum: '2026-08-10' });
  assert.equal(r.position_frei, true);
  assert.equal(r.zuzahlung_eur, 0);
});

test('Physio: DB-Tarif übersteuert den Preis, Zuzahlung wird 10 % davon', () => {
  const tariffs = [{ position_nr: '20501', preis_eur: 40.00, gueltig_ab: '2026-01-01', gueltig_bis: null }];
  const r = resolvePreis({
    bereich: 'physiotherapie', code: 'X0501', datum: '2026-08-10',
    tariffs, positionsnummer: '20501',
  });
  assert.equal(r.preis_eur, 40.00);
  assert.equal(r.zuzahlung_eur, 4.00);
  assert.equal(r.quelle, 'heilmittel_tarif');
});

test('Physio: DB-Tarif macht eine zuzahlungsfreie Position NICHT zuzahlungspflichtig', () => {
  const tariffs = [{ position_nr: '20708', preis_eur: 60.00, gueltig_ab: '2026-01-01', gueltig_bis: null }];
  const r = resolvePreis({
    bereich: 'physiotherapie', code: 'X0708', datum: '2026-08-10',
    tariffs, positionsnummer: '20708',
  });
  assert.equal(r.preis_eur, 60.00);
  assert.equal(r.position_frei, true);
  assert.equal(r.zuzahlung_eur, 0, 'zuzahlungsfrei bleibt zuzahlungsfrei');
});

test('Physio: Tarif ausserhalb seines Datumsfensters greift nicht', () => {
  const tariffs = [{ position_nr: '20501', preis_eur: 40.00, gueltig_ab: '2027-01-01', gueltig_bis: null }];
  const r = resolvePreis({
    bereich: 'physiotherapie', code: 'X0501', datum: '2026-08-10',
    tariffs, positionsnummer: '20501',
  });
  assert.equal(r.preis_eur, 29.63);
  assert.equal(r.quelle, 'katalog');
});

test('Physio: Datum vor dem Preisfenster wird markiert, liefert aber einen Preis', () => {
  const r = resolvePreis({ bereich: 'physiotherapie', code: 'X0501', datum: '2025-12-01' });
  assert.equal(r.ausserhalb_preisfenster, true);
  assert.equal(r.preis_eur, 29.63, 'Abrechnung bleibt bedienbar');
});

test('Physio: Datum im Fenster ist nicht markiert', () => {
  const r = resolvePreis({ bereich: 'physiotherapie', code: 'X0501', datum: '2026-08-10' });
  assert.equal(r.ausserhalb_preisfenster, false);
});

// ------------------------------------------------------------- Sonderfälle
test('Unbekannter Code → 0 €, gefunden=false, quelle=unbekannt', () => {
  const r = resolvePreis({ bereich: 'physiotherapie', code: 'X9999', datum: '2026-08-10' });
  assert.equal(r.preis_eur, 0);
  assert.equal(r.gefunden, false);
  assert.equal(r.quelle, 'unbekannt');
  assert.equal(r.katalogPosition, null);
});

test('Ohne Datum gilt das aktuellste Preisfenster', () => {
  const r = resolvePreis({ bereich: 'physiotherapie', code: 'X0501' });
  assert.equal(r.preis_eur, 29.63);
  assert.equal(r.ausserhalb_preisfenster, false);
});

test('Druckweg und §302-Weg liefern denselben Betrag (Kern der Aufgabe)', () => {
  const args = { bereich: 'podologie', code: '78020', datum: '2026-08-10' };
  const druck = resolvePreis({ ...args, abrechnungscode: '22' });
  const dta   = resolvePreis({ ...args, abrechnungscode: '71' });
  assert.equal(druck.preis_eur, dta.preis_eur);
  assert.equal(druck.zuzahlung_eur, dta.zuzahlung_eur);
});

// ------------------------------------------------------- findTarifForDate
test('findTarifForDate: leere/fehlende Liste → null', () => {
  assert.equal(findTarifForDate(null, '20501', '2026-08-10'), null);
  assert.equal(findTarifForDate([], '20501', '2026-08-10'), null);
});

test('findTarifForDate: offenes Ende (gueltig_bis null) trifft', () => {
  const tariffs = [{ position_nr: '20501', preis_eur: 40, gueltig_ab: '2026-01-01', gueltig_bis: null }];
  assert.ok(findTarifForDate(tariffs, '20501', '2030-01-01'));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
