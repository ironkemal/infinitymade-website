import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istBerichtOffen, istHarterRiegel, checkPrescriptionCompliance } from './abrechnung-freigabe.js';

// --- istBerichtOffen ---------------------------------------------------------
// Offen ist nur die Kombination „Kreuz gesetzt, aber kein Bericht geschrieben".

test('Kreuz gesetzt und Bericht nicht erledigt gilt als offen', () => {
  assert.equal(istBerichtOffen({ bericht_angefordert: true, bericht_status: 'offen' }), true);
  assert.equal(istBerichtOffen({ bericht_angefordert: true, bericht_status: 'in_arbeit' }), true);
});

test('erledigter Bericht ist nicht offen', () => {
  assert.equal(istBerichtOffen({ bericht_angefordert: true, bericht_status: 'erledigt' }), false);
});

// Ohne Kreuz ist der Bericht laut Podologie §125 Anlage 3 d) gar nicht
// erforderlich — dann darf auch nichts nachgefragt werden.
test('ohne Kreuz ist nichts offen, egal welcher Status', () => {
  assert.equal(istBerichtOffen({ bericht_angefordert: false, bericht_status: 'offen' }), false);
});

test('fehlendes Rezept kippt nicht', () => {
  assert.equal(istBerichtOffen(null), false);
  assert.equal(istBerichtOffen({}), false);
});

// --- istHarterRiegel ---------------------------------------------------------
// Der Kern der Änderung: der fehlende Therapiebericht ist KEIN harter Riegel
// mehr, Zertifikat und 14-Tage-Unterbrechung bleiben es.

test('fehlender Therapiebericht allein sperrt nicht mehr', () => {
  assert.equal(istHarterRiegel({ isReportMissing: true, missingCert: false, has14DayGap: false }), false);
});

test('fehlendes Zertifikat bleibt ein Riegel', () => {
  assert.equal(istHarterRiegel({ isReportMissing: false, missingCert: true, has14DayGap: false }), true);
});

// § 16 Abs. 4 HeilM-RL — die Unterbrechung macht die Verordnung ungueltig,
// das laesst sich nicht mit einer Begruendung heilen.
test('14-Tage-Unterbrechung bleibt ein Riegel', () => {
  assert.equal(istHarterRiegel({ isReportMissing: false, missingCert: false, has14DayGap: true }), true);
});

test('ohne Befunde kein Riegel', () => {
  assert.equal(istHarterRiegel({}), false);
  assert.equal(istHarterRiegel(null), false);
});

// --- checkPrescriptionCompliance --------------------------------------------
const sitzung = (datum) => ({ status: 'done', done_at: datum, bookings: {} });

test('Rezept ohne Sitzungen meldet keine Unterbrechung', () => {
  const issues = checkPrescriptionCompliance({ prescription_sessions: [] }, null);
  assert.equal(issues.has14DayGap, false);
  assert.equal(issues.missingCert, false);
});

test('genau 14 Tage Abstand sind noch in Ordnung', () => {
  const issues = checkPrescriptionCompliance(
    { prescription_sessions: [sitzung('2026-08-01T09:00:00Z'), sitzung('2026-08-15T09:00:00Z')] }, null);
  assert.equal(issues.has14DayGap, false);
});

test('15 Tage Abstand schlagen an', () => {
  const issues = checkPrescriptionCompliance(
    { prescription_sessions: [sitzung('2026-08-01T09:00:00Z'), sitzung('2026-08-16T09:00:00Z')] }, null);
  assert.equal(issues.has14DayGap, true);
  assert.equal(issues.gapDays, 15);
});

// Nur erbrachte Sitzungen zaehlen — ein abgesagter Termin dazwischen darf
// keine Luecke vortaeuschen und auch keine zudecken.
test('nicht erbrachte Sitzungen zaehlen nicht mit', () => {
  const issues = checkPrescriptionCompliance({
    prescription_sessions: [
      sitzung('2026-08-01T09:00:00Z'),
      { status: 'cancelled', done_at: '2026-08-10T09:00:00Z', bookings: {} },
      sitzung('2026-08-16T09:00:00Z'),
    ],
  }, null);
  assert.equal(issues.has14DayGap, true);
});

test('fehlendes Zertifikat wird am Behandlungstag erkannt', () => {
  const rx = {
    prescription_sessions: [{
      status: 'done',
      done_at: '2026-08-01T09:00:00Z',
      bookings: { user_id: 'therapeut-1', services: { required_certificate: 'MLD' } },
    }],
  };
  assert.equal(checkPrescriptionCompliance(rx, new Map()).missingCert, true);
  assert.equal(checkPrescriptionCompliance(rx, new Map([['therapeut-1', new Set(['MLD'])]])).missingCert, false);
  assert.equal(checkPrescriptionCompliance(rx, new Map([['therapeut-1', new Set(['KGG'])]])).missingCert, true);
});

test('isReportMissing spiegelt istBerichtOffen', () => {
  assert.equal(
    checkPrescriptionCompliance({ bericht_angefordert: true, bericht_status: 'offen', prescription_sessions: [] }, null).isReportMissing,
    true);
});
