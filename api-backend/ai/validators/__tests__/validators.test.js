// Unit tests for validators. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRezept } from '../validate.js';
import { validateStandard } from '../standardRules.js';
import { validateBlanko } from '../blankoRules.js';
import { validateLhbBvb } from '../lhbBvbRules.js';
import { lookupLhbBvb, lookupBlankoShoulder, heilmittelCatalog } from '../catalog.js';

// ── catalog sanity ──────────────────────────────────────────────────────────
test('catalog: LHB/BVB has 200+ entries', () => {
  assert.ok(Object.keys(heilmittelCatalog.lhb_bvb).length > 200);
});

test('catalog: Blanko shoulder list has 50+ entries', () => {
  assert.ok(Object.keys(heilmittelCatalog.blanko_physio_shoulder).length > 50);
});

test('catalog: lookupBlankoShoulder finds M19.01 (Arthrose Schulter)', () => {
  const entry = lookupBlankoShoulder('M19.01');
  assert.ok(entry, 'M19.01 should be on Blanko shoulder list');
  assert.equal(entry.diagnosegruppe, 'EX');
});

test('catalog: lookupBlankoShoulder returns null for unrelated ICD', () => {
  assert.equal(lookupBlankoShoulder('M54.5'), null);
});

test('catalog: lookupLhbBvb finds known chronic entry', () => {
  // G80.0 (Spastische tetraplegische Zerebralparese) is on the list
  const e = lookupLhbBvb('G80.0');
  assert.ok(e, 'G80.0 should be on LHB/BVB list');
});

// ── standardRules ───────────────────────────────────────────────────────────
test('standard: valid WS prescription with 6 sessions passes', () => {
  const r = validateStandard({
    icd10: 'M54.5',
    diagnosegruppe: 'WS2',
    anzahl_einheiten: 6,
    ausstellungsdatum: '2026-05-10',
    behandlungsbeginn: '2026-05-14',
    is_dringend: false
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.blockers, []);
  assert.equal(r.computed.max_sessions, 6);
  assert.equal(r.computed.verordnung_typ, 'standard');
});

test('standard: 10 sessions on WS triggers OVER_HOECHSTMENGE blocker', () => {
  const r = validateStandard({
    icd10: 'M54.5',
    diagnosegruppe: 'WS2',
    anzahl_einheiten: 10,
    ausstellungsdatum: '2026-05-10'
  });
  assert.equal(r.ok, false);
  assert.ok(r.blockers.find(b => b.code === 'OVER_HOECHSTMENGE'));
});

test('standard: dringend prescription with begin > 14 days blocked', () => {
  const r = validateStandard({
    diagnosegruppe: 'EX',
    anzahl_einheiten: 6,
    ausstellungsdatum: '2026-05-01',
    behandlungsbeginn: '2026-05-20',  // 19 days later
    is_dringend: true
  });
  assert.ok(r.blockers.find(b => b.code === 'START_AFTER_DEADLINE'));
});

test('standard: non-dringend with begin in 25 days is OK (28 days limit)', () => {
  const r = validateStandard({
    diagnosegruppe: 'EX',
    anzahl_einheiten: 6,
    ausstellungsdatum: '2026-05-01',
    behandlungsbeginn: '2026-05-26',  // 25 days later
    is_dringend: false
  });
  assert.equal(r.blockers.find(b => b.code === 'START_AFTER_DEADLINE'), undefined);
});

test('standard: under-18 patient has Zuzahlung-befreit warning', () => {
  const r = validateStandard({
    diagnosegruppe: 'EX',
    anzahl_einheiten: 6,
    ausstellungsdatum: '2026-05-10',
    patient_geburtsdatum: '2015-03-12'
  });
  assert.ok(r.warnings.find(w => w.code === 'ZUZAHLUNG_BEFREIT'));
  assert.equal(r.computed.zuzahlung_required, false);
});

test('standard: missing Diagnosegruppe blocks', () => {
  const r = validateStandard({
    icd10: 'M54.5',
    anzahl_einheiten: 6,
    ausstellungsdatum: '2026-05-10'
  });
  assert.ok(r.blockers.find(b => b.code === 'DG_UNKNOWN'));
});

// ── blankoRules ─────────────────────────────────────────────────────────────
test('blanko: valid shoulder rezept with marker, EX, 12 sessions passes', () => {
  const r = validateBlanko({
    icd10: 'M19.01',  // Primäre Arthrose Schulter — in catalog
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-10',
    behandlungsbeginn: '2026-05-15',
    heilmittel_typ_blanko: 'weichteil_arthrose_knorpel',
    vorrangig_einheiten: 12,
    ergaenzend_einheiten: 4
  });
  assert.equal(r.ok, true, JSON.stringify(r.blockers));
  assert.equal(r.computed.verordnung_typ, 'blanko_physio_shoulder');
});

test('blanko: missing BLANKOVERORDNUNG marker is a blocker', () => {
  const r = validateBlanko({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: '',
    ausstellungsdatum: '2026-05-10'
  });
  assert.ok(r.blockers.find(b => b.code === 'BLANKO_MARKER_MISSING'));
});

test('blanko: non-EX Diagnosegruppe blocks', () => {
  const r = validateBlanko({
    icd10: 'M19.01',
    diagnosegruppe: 'WS2',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-10'
  });
  assert.ok(r.blockers.find(b => b.code === 'BLANKO_DG_NOT_EX'));
});

test('blanko: ICD not on shoulder list blocks', () => {
  const r = validateBlanko({
    icd10: 'M54.5',  // Lumbago, not shoulder
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-10'
  });
  assert.ok(r.blockers.find(b => b.code === 'NOT_ON_BLANKO_LIST'));
});

test('blanko: begin > 28 days blocks', () => {
  const r = validateBlanko({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-01',
    behandlungsbeginn: '2026-06-05'  // 35 days later
  });
  assert.ok(r.blockers.find(b => b.code === 'BLANKO_BEGIN_AFTER_28D'));
});

test('blanko: 19 vorrangig units triggers red ampel + 9% Abschlag warning', () => {
  const r = validateBlanko({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-10',
    heilmittel_typ_blanko: 'weichteil_arthrose_knorpel',
    vorrangig_einheiten: 19,
    ergaenzend_einheiten: 4
  });
  const w = r.warnings.find(x => x.code === 'BLANKO_RED_AMPEL');
  assert.ok(w);
  assert.equal(w.ampel.abschlag_percent, 9);
  assert.equal(r.computed.ampel.vorrangig.in_red, true);
});

test('blanko: bonuses computed correctly (PD + Mehraufwand, no Bedarfsdiagnostik)', () => {
  const r = validateBlanko({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-10'
  });
  assert.equal(r.computed.bonuses_eur.physiotherapeutische_diagnostik, 34.34);
  assert.equal(r.computed.bonuses_eur.mehraufwandspauschale, 55);
  assert.equal(r.computed.bonuses_eur.bedarfsdiagnostik, undefined);
  assert.equal(r.computed.total_bonuses_eur, 89.34);
});

test('blanko: with bedarfsdiagnostik flag, total bonuses = 115.10', () => {
  const r = validateBlanko({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-10',
    include_bedarfsdiagnostik: true
  });
  assert.equal(r.computed.total_bonuses_eur, 115.10);
});

test('blanko: gueltig_bis is exactly 16 weeks after ausstellung', () => {
  const r = validateBlanko({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-01-01'
  });
  assert.equal(r.computed.gueltig_bis, '2026-04-23');  // 16 weeks = 112 days
  assert.equal(r.computed.behandlungsbeginn_spaetestens, '2026-01-29');  // 28 days
});

// ── lhbBvbRules ─────────────────────────────────────────────────────────────
test('lhbBvb: ICD not on list returns blocker', () => {
  const r = validateLhbBvb({
    icd10: 'M54.5',  // standard lumbago
    diagnosegruppe: 'WS2',
    anzahl_einheiten: 30,
    ausstellungsdatum: '2026-05-10'
  });
  assert.ok(r.blockers.find(b => b.code === 'NOT_ON_LHB_BVB_LIST'));
});

test('lhbBvb: valid chronic ICD allows >6 sessions', () => {
  const r = validateLhbBvb({
    icd10: 'G80.0',  // Spastische tetraplegische Zerebralparese
    diagnosegruppe: 'ZN',
    anzahl_einheiten: 24,
    ausstellungsdatum: '2026-05-10'
  });
  // Should be ok (24 sessions over 12 weeks is plausible for ZN with 2-5x/Woche freq)
  assert.equal(r.ok, true);
  assert.equal(r.computed.exempt_from_wirtschaftlichkeitspruefung, true);
});

test('lhbBvb: Hinweis is surfaced as warning if present', () => {
  // Find any entry with a hinweis from the catalog
  const r = validateLhbBvb({
    icd10: 'B94.1',  // "längstens 1 Jahr nach Akutereignis"
    diagnosegruppe: 'ZN',
    anzahl_einheiten: 10,
    ausstellungsdatum: '2026-05-10'
  });
  if (r.computed.hinweis) {
    assert.ok(r.warnings.find(w => w.code === 'LHB_BVB_HINWEIS'));
  } else {
    // No hinweis on this entry — skip
  }
});

// ── orchestrator ────────────────────────────────────────────────────────────
test('validate: auto-routes to blanko if marker present', () => {
  const r = validateRezept({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-10'
  });
  assert.equal(r.engine, 'blanko');
});

test('validate: auto-routes to lhb_bvb if ICD is on list and no Blanko marker', () => {
  const r = validateRezept({
    icd10: 'G80.0',
    diagnosegruppe: 'ZN',
    anzahl_einheiten: 24,
    ausstellungsdatum: '2026-05-10'
  });
  assert.equal(r.engine, 'lhb_bvb');
});

test('validate: standard ICD falls through to standard engine', () => {
  const r = validateRezept({
    icd10: 'M54.5',
    diagnosegruppe: 'WS2',
    anzahl_einheiten: 6,
    ausstellungsdatum: '2026-05-10'
  });
  assert.equal(r.engine, 'standard');
});

test('validate: standard engine adds BLANKO_HINT when ICD eligible but no marker', () => {
  const r = validateRezept({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    anzahl_einheiten: 6,
    ausstellungsdatum: '2026-05-10'
  });
  assert.equal(r.engine, 'standard');
  assert.ok(r.warnings.find(w => w.code === 'BLANKO_HINT'));
});

test('validate: null payload returns INVALID_INPUT blocker', () => {
  const r = validateRezept(null);
  assert.equal(r.ok, false);
  assert.equal(r.blockers[0].code, 'INVALID_INPUT');
});
