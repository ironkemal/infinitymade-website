import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePhysioAbrechnung } from './physio-verfahren.js';

const rx = { ausstellungsdatum: '2026-01-01', anzahl_einheiten: 6 };
const run = (days, extra = {}, opts = {}) => validatePhysioAbrechnung({ rx: { ...rx, ...extra }, sessions: days.map(datumLeistung => ({ datumLeistung })), entlassmanagement: false, ...opts });
const has = (result, code) => result.errors.some(e => e.code === code);

test('Standard starts on day28; day29 blocked; urgent day14/day15', () => {
  assert.equal(run(['2026-01-29']).ok, true);
  assert.equal(has(run(['2026-01-30']), 'PHYSIO_BEGINN_FRIST'), true);
  assert.equal(run(['2026-01-15'], { is_dringend: true }).ok, true);
  assert.equal(has(run(['2026-01-16'], { is_dringend: true }), 'PHYSIO_BEGINN_FRIST'), true);
});

test('Calendar-month validity clips Jan31 to Apr30, never adds90 days', () => {
  const extra = { ausstellungsdatum: '2026-01-10' };
  const evidence = [{ von: '2026-01-31', bis: '2026-04-30', grund: 'K', dokumentiert: true }];
  assert.equal(run(['2026-01-31', '2026-04-30'], extra, { unterbrechungen: evidence }).ok, true);
  assert.equal(has(run(['2026-01-31', '2026-05-01'], extra), 'PHYSIO_VERORDNUNG_ABGELAUFEN'), true);
  assert.equal(has(run(['2026-01-31', '2026-05-01'], { ...extra, anzahl_einheiten: 7 }), 'PHYSIO_VERORDNUNG_ABGELAUFEN'), false);
});

test('Documented T/K/F permits >14 day pause; unproved or free-text reason does not', () => {
  for (const grund of ['T', 'K', 'F']) assert.equal(run(['2026-01-02', '2026-01-20'], {}, { unterbrechungen: [{ von: '2026-01-02', bis: '2026-01-20', grund, dokumentiert: true }] }).ok, true);
  assert.equal(has(run(['2026-01-02', '2026-01-20']), 'PHYSIO_UNTERBRECHUNG_NACHWEIS_FEHLT'), true);
  assert.equal(has(run(['2026-01-02', '2026-01-20'], {}, { unterbrechungen: [{ von: '2026-01-02', bis: '2026-01-20', grund: 'Urlaub', dokumentiert: true }] }), 'PHYSIO_UNTERBRECHUNG_NACHWEIS_FEHLT'), true);
});

test('Discharge dates use actual discharge day, start7/end12 boundaries', () => {
  const opts = { entlassmanagement: true, entlassdatum: '2026-01-10' };
  assert.equal(run(['2026-01-17', '2026-01-22'], {}, opts).ok, true);
  assert.equal(has(run(['2026-01-18'], {}, opts), 'PHYSIO_ENTLASS_BEGINN_FRIST'), true);
  assert.equal(has(run(['2026-01-17', '2026-01-23'], {}, opts), 'PHYSIO_ENTLASS_ENDE_FRIST'), true);
  assert.equal(has(run(['2026-01-17'], {}, { entlassmanagement: true }), 'PHYSIO_ENTLASSDATUM_FEHLT'), true);
});

test('Blanko cannot silently use standard tariff; long pause allowed within112 days', () => {
  const blanko = { is_blanko: true, diagnosegruppe: 'EX', icd10: 'M75.1' };
  const r = run(['2026-01-02', '2026-04-23'], blanko);
  assert.equal(r.verordnungsart, '05');
  assert.equal(r.erforderlicherLegs, '2200502');
  assert.equal(has(r, 'PHYSIO_UNTERBRECHUNG_NACHWEIS_FEHLT'), false);
  assert.equal(has(r, 'PHYSIO_BLANKO_GUELTIGKEIT'), false);
  assert.equal(has(r, 'PHYSIO_BLANKO_TAXIERUNG_UNGEPRUEFT'), true);
  assert.equal(has(run(['2026-01-02', '2026-04-24'], blanko), 'PHYSIO_BLANKO_GUELTIGKEIT'), true);
});

test('LHB/BVB preserves ZHE04 and does not infer ordinary maximum quantity', () => {
  const r = run(['2026-01-02'], { is_lhb_bvb: true, anzahl_einheiten: 24 });
  assert.equal(r.ok, true);
  assert.equal(r.profile, 'lhb_bvb');
  assert.equal(r.verordnungsart, '04');
});

test('Invalid dates rejected; timestamp uses Berlin day at midnight boundary', () => {
  assert.equal(has(run(['2026-02-30']), 'PHYSIO_LEISTUNGSDATUM_UNGUELTIG'), true);
  const r = validatePhysioAbrechnung({ rx, entlassmanagement: false, sessions: [{ done_at: '2026-01-28T23:30:00Z' }] });
  assert.equal(r.ersterLeistungstag, '2026-01-29');
  assert.equal(r.ok, true);
});

test('Copay transition blocks only unresolved affected cases', () => {
  assert.equal(has(run(['2026-01-02', '2026-01-10'], { patient_geburtsdatum: '2008-01-05' }), 'PHYSIO_ZUZAHLUNG_ALTERSWECHSEL_OFFEN'), true);
  const extra = { ausstellungsdatum: '2025-12-01', zuzahlung_befreit: true };
  assert.equal(has(run(['2025-12-20', '2026-01-02'], extra), 'PHYSIO_ZUZAHLUNG_JAHRESWECHSEL_OFFEN'), true);
  assert.equal(run(['2025-12-20', '2026-01-02'], { ...extra, zuzahlung_befreit: false }).ok, true);
});

test('Unknown discharge status never defaults to standard billing', () => {
  const r = validatePhysioAbrechnung({ rx, sessions: [{ datumLeistung: '2026-01-02' }] });
  assert.equal(has(r, 'PHYSIO_ENTLASSMERKMAL_UNGEKLAERT'), true);
  assert.equal(r.ok, false);
});
