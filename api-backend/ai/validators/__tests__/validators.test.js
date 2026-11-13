// Unit tests for validators. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRezept } from '../validate.js';
import { validateStandard } from '../standardRules.js';
import { validateBlanko } from '../blankoRules.js';
import { validateLhbBvb } from '../lhbBvbRules.js';
import { lookupLhbBvb, lookupBlankoShoulder, heilmittelCatalog } from '../catalog.js';
import {
  FRIST_TAGE,
  parseIsoDatum,
  addDays,
  daysBetween,
  spaetesterBeginn,
  pruefeBehandlungsbeginn
} from '../fristen.js';

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

// ── MDR-Hinweis (WARNUNG, kein Blocker) ─────────────────────────────────────
// Höchstmengen- und Gültigkeitsprüfung sind bewusst `warnings`, NICHT `blockers`:
// die Software trifft keine klinische Entscheidung, sie bereitet die Abrechnung vor.
// Über einen ärztlich genehmigten Ausnahmefall (BVB/LHB) bzw. eine verspätet
// begonnene Verordnung entscheidet die behandelnde Fachkraft — siehe Kommentare in
// standardRules.js und den offenen Punkt "MDR-Schwelle" in
// compliance/LEGAL_DECISIONS.md. Diese Tests dürfen NICHT auf `blockers` umgestellt
// werden, ohne dass diese Rechtsfrage vorher entschieden ist.
test('standard: 10 sessions on WS yields OVER_HOECHSTMENGE warning (not a blocker)', () => {
  const r = validateStandard({
    icd10: 'M54.5',
    diagnosegruppe: 'WS2',
    anzahl_einheiten: 10,
    ausstellungsdatum: '2026-05-10'
  });
  assert.ok(r.warnings.find(w => w.code === 'OVER_HOECHSTMENGE'), JSON.stringify(r.warnings));
  assert.equal(r.blockers.find(b => b.code === 'OVER_HOECHSTMENGE'), undefined);
  // Nur ein Hinweis → die Verordnung bleibt abrechenbar.
  assert.equal(r.ok, true);
  const w = r.warnings.find(w => w.code === 'OVER_HOECHSTMENGE');
  assert.equal(w.requires_confirmation, true);
  assert.equal(w.max_allowed, 6);
  assert.equal(w.requested, 10);
});

test('standard: dringend prescription with begin > 14 days yields START_AFTER_DEADLINE warning', () => {
  const r = validateStandard({
    diagnosegruppe: 'EX',
    anzahl_einheiten: 6,
    ausstellungsdatum: '2026-05-01',
    behandlungsbeginn: '2026-05-20',  // 19 days later
    is_dringend: true
  });
  assert.ok(r.warnings.find(w => w.code === 'START_AFTER_DEADLINE'), JSON.stringify(r.warnings));
  assert.equal(r.blockers.find(b => b.code === 'START_AFTER_DEADLINE'), undefined);
  // 14-Tage-Frist bei "dringendem Behandlungsbedarf" → spätester Start 15.05.2026.
  assert.equal(r.warnings.find(w => w.code === 'START_AFTER_DEADLINE').latest_allowed, '2026-05-15');
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

// ── Blanko scope guard (Ratsbeschluss 2026-08-05) ───────────────────────────
test('guard: podologisches Rezept mit Blanko-Typ liefert genau EINEN Blocker', () => {
  const r = validateRezept({
    rezept_typ: 'blanko',
    icd10: 'E11.74',
    diagnosegruppe: 'DF',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-08-05'
  });
  assert.equal(r.ok, false);
  assert.equal(r.engine, 'blanko');
  assert.equal(r.blockers.length, 1, JSON.stringify(r.blockers));
  assert.equal(r.blockers[0].code, 'BLANKO_NICHT_VERFUEGBAR');
  assert.ok(r.blockers[0].msg.includes('Podologie'));
  assert.equal(r.blockers.find(b => b.code === 'NOT_ON_BLANKO_LIST'), undefined);
  assert.equal(r.blockers.find(b => b.code === 'BLANKO_DG_NOT_EX'), undefined);
});

test('guard: greift auch ohne rezept_typ, allein über den BLANKOVERORDNUNG-Marker', () => {
  const r = validateRezept({
    icd10: 'E11.74',
    diagnosegruppe: 'DF',
    heilmittel_feld_text: 'Blankoverordnung Podologie',
    ausstellungsdatum: '2026-08-05'
  });
  assert.equal(r.engine, 'blanko');
  assert.equal(r.blockers.length, 1);
  assert.equal(r.blockers[0].code, 'BLANKO_NICHT_VERFUEGBAR');
});

test('guard: gültige Physio-Schulter-Blanko läuft weiterhin durch die Engine', () => {
  const r = validateRezept({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-05-10',
    behandlungsbeginn: '2026-05-15'
  });
  assert.equal(r.engine, 'blanko');
  assert.equal(r.ok, true, JSON.stringify(r.blockers));
  assert.equal(r.computed.verordnung_typ, 'blanko_physio_shoulder');
});

test('blanko: keine Bonusbeträge, solange Blocker vorliegen', () => {
  const r = validateBlanko({
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: '',   // Marker fehlt → Blocker
    ausstellungsdatum: '2026-05-10'
  });
  assert.equal(r.ok, false);
  assert.equal(r.computed.bonuses_eur, null);
  assert.equal(r.computed.total_bonuses_eur, null);
  assert.equal(r.computed.gueltig_bis, '2026-08-30');  // übrige computed-Felder bleiben gefüllt
});

test('validate: null payload returns INVALID_INPUT blocker', () => {
  const r = validateRezept(null);
  assert.equal(r.ok, false);
  assert.equal(r.blockers[0].code, 'INVALID_INPUT');
});

// ── ICD <-> Diagnosegruppe (Podologie) ──────────────────────────────────────
// Geraet: standardRules + icdDgRules + catalog (getIcdDgRules).
// Alle tests nutzen validateStandard damit DG_UNKNOWN und ICD-Pruefung zusammen laufen.

const PODO_BASE = {
  anzahl_einheiten: 6,
  ausstellungsdatum: '2026-08-10'
};

// ── DG_UNKNOWN nicht mehr fuer Podologie-DGs ────────────────────────────────

test('podo: DF loest kein DG_UNKNOWN aus', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'DF', icd10: 'E11.74' });
  assert.equal(r.blockers.find(b => b.code === 'DG_UNKNOWN'), undefined, JSON.stringify(r.blockers));
});

test('podo: NF loest kein DG_UNKNOWN aus', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'NF', icd10: 'G60.0' });
  assert.equal(r.blockers.find(b => b.code === 'DG_UNKNOWN'), undefined, JSON.stringify(r.blockers));
});

test('podo: QF loest kein DG_UNKNOWN aus', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'QF', icd10: 'G82.02' });
  assert.equal(r.blockers.find(b => b.code === 'DG_UNKNOWN'), undefined, JSON.stringify(r.blockers));
});

test('podo: UI1 loest kein DG_UNKNOWN aus', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'UI1', icd10: 'L60.0' });
  assert.equal(r.blockers.find(b => b.code === 'DG_UNKNOWN'), undefined, JSON.stringify(r.blockers));
});

test('podo: UI2 loest kein DG_UNKNOWN aus', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'UI2', icd10: 'L60.0' });
  assert.equal(r.blockers.find(b => b.code === 'DG_UNKNOWN'), undefined, JSON.stringify(r.blockers));
});

// ── ICD-Matching: sauber, keine ICD-Warnung ─────────────────────────────────

test('podo: DF + E11.74 => sauber, keine ICD-Warnung', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'DF', icd10: 'E11.74' });
  assert.equal(r.blockers.find(b => b.code === 'DG_UNKNOWN'), undefined, 'kein DG_UNKNOWN');
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG'), undefined);
});

test('podo: DF + E11.40 => sauber (Neuropathie-Code)', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'DF', icd10: 'E11.40' });
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG'), undefined);
});

test('podo: QF + G82.02 => sauber', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'QF', icd10: 'G82.02' });
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), undefined, JSON.stringify(r.warnings));
});

test('podo: UI1 + L60.0 => sauber', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'UI1', icd10: 'L60.0' });
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), undefined);
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG'), undefined);
});

test('podo: DF + E11.74, I10 => sauber (Nebendiagnose unschaedlich)', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'DF', icd10: 'E11.74, I10' });
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG'), undefined);
});

// ── ICD-Matching: Warnung erwartet ──────────────────────────────────────────

// Seit 0047 (30.09.2026) sind DF/NF/QF wie UI1/UI2 hard_before_dta: ohne
// Diagnosetext STRENG (Blocker erst im DTA-Preflight, hier weiter nur Warnung),
// mit Diagnosetext die weiche Warnung (Freitext kann den ICD heilen, gkv-302).
test('podo: NF + G63.2 => ICD_DG_MISMATCH_STRENG ohne Diagnosetext (G63.2 gehoert zu DF)', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'NF', icd10: 'G63.2' });
  const w = r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG');
  assert.ok(w, 'ICD_DG_MISMATCH_STRENG erwartet: ' + JSON.stringify(r.warnings));
  assert.equal(r.blockers.find(b => b.code.startsWith('ICD_DG_MISMATCH')), undefined);
  assert.equal(r.ok, true); // Speichern bleibt erlaubt
});

test('podo: NF + G63.2 + Diagnosetext => weiche ICD_DG_MISMATCH Warnung', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'NF', icd10: 'G63.2', diagnose_freitext: 'Polyneuropathie unklarer Genese' });
  assert.ok(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG'), undefined);
});

test('podo: QF + G82.60! => ICD_DG_MISMATCH_STRENG (Ausrufezeichenkode ist excluded)', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'QF', icd10: 'G82.60!' });
  const w = r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG');
  assert.ok(w, 'ICD_DG_MISMATCH_STRENG erwartet: ' + JSON.stringify(r.warnings));
  assert.equal(r.blockers.find(b => b.code.startsWith('ICD_DG_MISMATCH')), undefined);
});

test('podo: UI1 + M20.1 => ICD_DG_MISMATCH_STRENG, kein Blocker', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'UI1', icd10: 'M20.1' });
  const w = r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG');
  assert.ok(w, 'ICD_DG_MISMATCH_STRENG erwartet: ' + JSON.stringify(r.warnings));
  // Kein Blocker -- die Sperre erfolgt erst vor der DTA-Erzeugung
  assert.equal(r.blockers.find(b => b.code === 'ICD_DG_MISMATCH_STRENG'), undefined);
  assert.equal(r.ok, true);
});

// ── Kein ICD angegeben => keine ICD-Warnung ──────────────────────────────────

test('podo: DF ohne ICD => keine ICD-Warnung', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'DF' });
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), undefined);
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG'), undefined);
});

// ── Suffix -a/-b/-c wird wie Stammkuerzel behandelt ─────────────────────────

test('podo: DF-a wird wie DF behandelt -- kein DG_UNKNOWN', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'DF-a', icd10: 'E11.74' });
  assert.equal(r.blockers.find(b => b.code === 'DG_UNKNOWN'), undefined, JSON.stringify(r.blockers));
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), undefined);
});

// ── Physio-DG: kein ICD-Pool, kein ICD_DG_MISMATCH ─────────────────────────

test('physio: WS2 mit beliebigem ICD => keine ICD-DG-Warnung', () => {
  const r = validateStandard({ ...PODO_BASE, diagnosegruppe: 'WS2', icd10: 'E11.74' });
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH'), undefined);
  assert.equal(r.warnings.find(w => w.code === 'ICD_DG_MISMATCH_STRENG'), undefined);
});

// ── Engine-Routing Podologie (Paket A: kein Auto-Routing in lhb_bvb, kein LHB_HINT) ─

test('validate: NF + G60.0 (6 Einheiten) bleibt in standard ohne DG_MISMATCH_LHB und ohne LHB_HINT', () => {
  const r = validateRezept({ ...PODO_BASE, diagnosegruppe: 'NF', icd10: 'G60.0', anzahl_einheiten: 6 });
  assert.equal(r.engine, 'standard');
  assert.equal(r.ok, true);
  assert.equal(r.warnings.find(w => w.code === 'DG_MISMATCH_LHB'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'LHB_HINT'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'OVER_HOECHSTMENGE'), undefined, JSON.stringify(r.warnings));
});

test('validate: NF + G60.0 (7 Einheiten) bleibt in standard und meldet OVER_HOECHSTMENGE ohne LHB_HINT', () => {
  const r = validateRezept({ ...PODO_BASE, diagnosegruppe: 'NF', icd10: 'G60.0', anzahl_einheiten: 7 });
  assert.equal(r.engine, 'standard');
  assert.ok(r.warnings.find(w => w.code === 'OVER_HOECHSTMENGE'), JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'DG_MISMATCH_LHB'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'LHB_HINT'), undefined, JSON.stringify(r.warnings));
});

test('validate: QF + Q05.9 (6 Einheiten) bleibt in standard ohne DG_MISMATCH_LHB und ohne LHB_HINT', () => {
  const r = validateRezept({ ...PODO_BASE, diagnosegruppe: 'QF', icd10: 'Q05.9', anzahl_einheiten: 6 });
  assert.equal(r.engine, 'standard');
  assert.equal(r.ok, true);
  assert.equal(r.warnings.find(w => w.code === 'DG_MISMATCH_LHB'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'LHB_HINT'), undefined, JSON.stringify(r.warnings));
});

test('validate: DF-a + G60.0 wird als Podologie erkannt (standard, kein DG_MISMATCH_LHB, kein LHB_HINT)', () => {
  const r = validateRezept({ ...PODO_BASE, diagnosegruppe: 'DF-a', icd10: 'G60.0', anzahl_einheiten: 6 });
  assert.equal(r.engine, 'standard');
  assert.equal(r.warnings.find(w => w.code === 'DG_MISMATCH_LHB'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'LHB_HINT'), undefined, JSON.stringify(r.warnings));
});

test('validate: UI 1 (mit Leerzeichen) + G60.0 wird als Podologie normalisiert (standard, kein LHB_HINT)', () => {
  const r = validateRezept({ ...PODO_BASE, diagnosegruppe: 'UI 1', icd10: 'G60.0', anzahl_einheiten: 6 });
  assert.equal(r.engine, 'standard');
  assert.equal(r.warnings.find(w => w.code === 'DG_MISMATCH_LHB'), undefined, JSON.stringify(r.warnings));
  assert.equal(r.warnings.find(w => w.code === 'LHB_HINT'), undefined, JSON.stringify(r.warnings));
});

test('validate: fehlende Diagnosegruppe + G60.0 bleibt in standard mit DG_UNKNOWN, ohne LHB_HINT', () => {
  for (const leerDg of [undefined, null, '', '   ']) {
    const r = validateRezept({ ...PODO_BASE, diagnosegruppe: leerDg, icd10: 'G60.0', anzahl_einheiten: 6 });
    assert.equal(r.engine, 'standard');
    assert.equal(r.ok, false);
    assert.ok(r.blockers.find(b => b.code === 'DG_UNKNOWN'), JSON.stringify(r.blockers));
    assert.equal(r.warnings.find(w => w.code === 'DG_MISMATCH_LHB'), undefined, JSON.stringify(r.warnings));
    assert.equal(r.warnings.find(w => w.code === 'LHB_HINT'), undefined, JSON.stringify(r.warnings));
  }
});

test('validate: explizites rezept_typ lhb_bvb bleibt unverändert, Physio LHB_HINT bleibt bei standard aktiv', () => {
  const rExplizit = validateRezept({ ...PODO_BASE, rezept_typ: 'lhb_bvb', diagnosegruppe: 'NF', icd10: 'G60.0' });
  assert.equal(rExplizit.engine, 'lhb_bvb');

  const rPhysioStd = validateRezept({ ...PODO_BASE, rezept_typ: 'standard', diagnosegruppe: 'ZN', icd10: 'G10' });
  assert.equal(rPhysioStd.engine, 'standard');
  assert.ok(rPhysioStd.warnings.find(w => w.code === 'LHB_HINT'), JSON.stringify(rPhysioStd.warnings));
});

// ── Paket B: Gemeinsamer Fristen-Helfer + LHB/BVB + Blanko Fristprüfung ──────
test('fristen: parseIsoDatum, addDays, daysBetween, spaetesterBeginn (§ 15 HeilM-RL)', () => {
  assert.equal(FRIST_TAGE.normal, 28);
  assert.equal(FRIST_TAGE.dringend, 14);

  const d = parseIsoDatum('2026-03-02');
  assert.ok(d instanceof Date);
  assert.equal(d.toISOString().slice(0, 10), '2026-03-02');
  assert.equal(parseIsoDatum(''), null);
  assert.equal(parseIsoDatum('kein-datum'), null);
  assert.equal(parseIsoDatum(null), null);

  assert.equal(addDays(d, 14).toISOString().slice(0, 10), '2026-03-16');
  assert.equal(addDays(d, 28).toISOString().slice(0, 10), '2026-03-30');
  assert.equal(daysBetween(d, addDays(d, -1)), -1);
  assert.equal(daysBetween(d, addDays(d, 14)), 14);

  assert.equal(spaetesterBeginn('2026-03-02', false)?.toISOString().slice(0, 10), '2026-03-30');
  assert.equal(spaetesterBeginn('2026-03-02', true)?.toISOString().slice(0, 10), '2026-03-16');
  assert.equal(spaetesterBeginn(d, true)?.toISOString().slice(0, 10), '2026-03-16');
  assert.equal(spaetesterBeginn(null, true), null);

  const p = pruefeBehandlungsbeginn({
    ausstellungsdatum: '2026-03-02',
    behandlungsbeginn: '2026-03-17',
    isDringend: true
  });
  assert.equal(p.latestStartIso, '2026-03-16');
  assert.equal(p.blockers.length, 0);
  assert.equal(p.warnings.length, 1);
  assert.equal(p.warnings[0].code, 'START_AFTER_DEADLINE');
  assert.equal(p.warnings[0].requires_confirmation, true);
});

test('lhbBvb (LHB-021/022): Beginn am 29. Tag warnt, Tag 28 ok, Beginn vor Ausstellung blockiert', () => {
  const base = {
    icd10: 'G10',
    diagnosegruppe: 'ZN',
    anzahl_einheiten: 20,
    ausstellungsdatum: '2026-03-02'
  };

  const rTag28 = validateRezept({ ...base, behandlungsbeginn: '2026-03-30' });
  assert.equal(rTag28.engine, 'lhb_bvb');
  assert.equal(rTag28.ok, true);
  assert.equal(rTag28.computed.latest_start_date, '2026-03-30');
  assert.ok(!rTag28.warnings.find(w => w.code === 'START_AFTER_DEADLINE'));

  const rTag29 = validateRezept({ ...base, behandlungsbeginn: '2026-03-31' });
  assert.equal(rTag29.engine, 'lhb_bvb');
  assert.equal(rTag29.ok, true);
  const lateWarn = rTag29.warnings.find(w => w.code === 'START_AFTER_DEADLINE');
  assert.ok(lateWarn, JSON.stringify(rTag29.warnings));
  assert.equal(lateWarn.field, 'behandlungsbeginn');
  assert.equal(lateWarn.latest_allowed, '2026-03-30');
  assert.equal(lateWarn.requires_confirmation, true);

  const rVorher = validateRezept({ ...base, behandlungsbeginn: '2026-03-01' });
  assert.equal(rVorher.engine, 'lhb_bvb');
  assert.equal(rVorher.ok, false);
  const beforeBlocker = rVorher.blockers.find(b => b.code === 'START_BEFORE_AUSSTELLUNG');
  assert.ok(beforeBlocker, JSON.stringify(rVorher.blockers));
  assert.equal(beforeBlocker.field, 'behandlungsbeginn');
});

test('lhbBvb: is_dringend verkürzt Frist auf 14 Tage (Grenze Tag 14 vs. Tag 15)', () => {
  const base = {
    icd10: 'G10',
    diagnosegruppe: 'ZN',
    anzahl_einheiten: 20,
    ausstellungsdatum: '2026-03-02',
    is_dringend: true
  };

  const rTag14 = validateLhbBvb({ ...base, behandlungsbeginn: '2026-03-16' });
  assert.equal(rTag14.ok, true);
  assert.equal(rTag14.computed.latest_start_date, '2026-03-16');
  assert.ok(!rTag14.warnings.find(w => w.code === 'START_AFTER_DEADLINE'));

  const rTag15 = validateLhbBvb({ ...base, behandlungsbeginn: '2026-03-17' });
  assert.equal(rTag15.ok, true);
  const lateWarn = rTag15.warnings.find(w => w.code === 'START_AFTER_DEADLINE');
  assert.ok(lateWarn, JSON.stringify(rTag15.warnings));
  assert.equal(lateWarn.latest_allowed, '2026-03-16');
  assert.equal(lateWarn.requires_confirmation, true);
});

test('blanko (BLK-006): is_dringend verkürzt spätesten Beginn auf 14 Tage (Tag 14 ok vs. Tag 15 Blocker)', () => {
  const base = {
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    icd10: 'M19.01',
    diagnosegruppe: 'EX',
    ausstellungsdatum: '2026-03-02',
    is_dringend: true
  };

  const rTag14 = validateRezept({ ...base, behandlungsbeginn: '2026-03-16' });
  assert.equal(rTag14.engine, 'blanko');
  assert.equal(rTag14.ok, true);
  assert.equal(rTag14.computed.behandlungsbeginn_spaetestens, '2026-03-16');
  assert.ok(rTag14.computed.bonuses_eur !== null);

  const rTag15 = validateRezept({ ...base, behandlungsbeginn: '2026-03-17' });
  assert.equal(rTag15.engine, 'blanko');
  assert.equal(rTag15.ok, false);
  assert.equal(rTag15.computed.behandlungsbeginn_spaetestens, '2026-03-16');
  const lateBlocker = rTag15.blockers.find(b => b.code === 'BLANKO_BEGIN_AFTER_28D');
  assert.ok(lateBlocker, JSON.stringify(rTag15.blockers));
  assert.equal(lateBlocker.latest_allowed, '2026-03-16');
  assert.equal(rTag15.computed.bonuses_eur, null);
  assert.equal(rTag15.computed.total_bonuses_eur, null);

  const rVorher = validateBlanko({ ...base, behandlungsbeginn: '2026-03-01' });
  assert.equal(rVorher.ok, false);
  assert.ok(rVorher.blockers.find(b => b.code === 'START_BEFORE_AUSSTELLUNG'), JSON.stringify(rVorher.blockers));
  assert.equal(rVorher.computed.bonuses_eur, null);
  assert.equal(rVorher.computed.total_bonuses_eur, null);
});

// ── Paket C: Katalog-Parser, Wildcard-Lookup, DG_MISMATCH_LHB ────────────────
test('catalog (Paket C): Trim, Kleinschreibung, Wildcards (M75.1, S42.00, G35.10, H81.0), G73.6* und Exakt-Vorrang', () => {
  // Blanko Schulter-Wildcards
  const m75 = lookupBlankoShoulder('  m75.1 ');
  assert.ok(m75, 'm75.1 muss auf M75.- matchen');
  assert.equal(m75.diagnosegruppe, 'EX');

  const s42 = lookupBlankoShoulder(' s42.00 ');
  assert.ok(s42, 's42.00 muss auf S42.0- matchen');
  assert.equal(s42.diagnosegruppe, 'EX');
  assert.equal(lookupBlankoShoulder('S42.0 -')?.diagnosegruppe, 'EX');
  assert.equal(lookupBlankoShoulder('S42.10')?.diagnosegruppe, 'EX');
  assert.equal(lookupBlankoShoulder('S42.21')?.diagnosegruppe, 'EX');
  assert.equal(lookupBlankoShoulder('S42.4'), null);

  // LHB/BVB 4-stellige und 3-stellige Wildcards + Trim/Lowercase
  const g35 = lookupLhbBvb('  g35.10  ');
  assert.ok(g35, 'g35.10 muss auf G35.1- matchen');
  assert.deepEqual(g35.diagnosegruppen, ['ZN', 'EN1', 'EN2', 'SC', 'ST1', 'SP5', 'SP6']);

  const h81 = lookupLhbBvb('h81.0');
  assert.ok(h81, 'h81.0 muss auf H81.- matchen');
  assert.match(h81.hinweis || '', /70\. Lebensjahr/);

  // Sternchen-ICD (G73.6*) und Range vs. Exakt-Vorrang (C71.0 vs. C50.9)
  assert.ok(lookupLhbBvb('G73.6'));
  assert.ok(lookupLhbBvb(' g73.6* '));
  const c71 = lookupLhbBvb('C71.0');
  assert.ok(c71?.diagnosegruppen.includes('ZN'), 'Exaktes C71.0 hat Vorrang vor C00-C97');
  const c50 = lookupLhbBvb('c50.9');
  assert.deepEqual(c50?.diagnosegruppen, ['LY']);
  assert.equal(lookupLhbBvb('C98.0'), null);
  assert.equal(lookupLhbBvb('M750'), null);
});

test('catalog (Paket C): KBV-Diagnoseliste vollständig & frei von Nachbarzeilen-Leckage', () => {
  assert.equal(Object.keys(heilmittelCatalog.lhb_bvb).length, 416);
  assert.equal(Object.keys(heilmittelCatalog.blanko_physio_shoulder).length, 65);

  const g60 = lookupLhbBvb('G60.0');
  assert.deepEqual(g60.diagnosegruppen, ['WS', 'EX', 'PN', 'SB2', 'EN3', 'SP3']);
  assert.equal(g60.hinweis, null);

  const q66 = lookupLhbBvb('Q66.0');
  assert.deepEqual(q66.diagnosegruppen, ['EX', 'SB2']);

  assert.equal(lookupLhbBvb('G61.0').hinweis, null);
  assert.match(lookupLhbBvb('G61.8').hinweis || '', /CIDP/);
  assert.equal(lookupLhbBvb('R15').hinweis, 'ab vollendetem 70. Lebensjahr');

  // Zweit-ICDs bei Doppelcodes bleiben strukturiert erhalten
  assert.deepEqual(lookupLhbBvb('M47.9-').second_icds, ['G99.2', 'G55.2']);
  assert.deepEqual(lookupBlankoShoulder('M24.41').second_icds, [null, 'Z98.88']);
});

test('lhbBvb (Paket C / gkv-302): DG_MISMATCH_LHB steuert Höchstmenge & Standard-computed-Felder', () => {
  // Unbekannte DG SB1 (nicht in diagnosegruppen.json): KEIN 6er-Fallback, KEINE OVER_HOECHSTMENGE
  const rUnknownDg = validateLhbBvb({
    icd10: 'Q66.0',
    diagnosegruppe: 'SB1',
    anzahl_einheiten: 10,
    ausstellungsdatum: '2026-03-02'
  });
  assert.ok(rUnknownDg.warnings.find(w => w.code === 'DG_MISMATCH_LHB'));
  assert.equal(rUnknownDg.warnings.find(w => w.code === 'OVER_HOECHSTMENGE'), undefined);
  assert.equal(rUnknownDg.warnings.find(w => w.code === 'OVER_12_WEEKS_HEURISTIC'), undefined);
  assert.equal(rUnknownDg.computed.exempt_from_wirtschaftlichkeitspruefung, false);
  assert.equal(rUnknownDg.computed.verordnung_typ, 'standard');
  assert.equal(rUnknownDg.computed.max_weeks_per_verordnung, null);
  assert.equal(rUnknownDg.computed.regulation_source, 'HeilM-RL § 7 Abs. 5 / § 8 Abs. 2 S. 1');

  // Bekannte Physio-DG CS (Regelhöchstmenge 6) bei 40 Einheiten: OVER_HOECHSTMENGE, aber KEINE OVER_12_WEEKS_HEURISTIC
  const rKnownDg = validateLhbBvb({
    icd10: 'G60.0',
    diagnosegruppe: 'CS',
    anzahl_einheiten: 40,
    ausstellungsdatum: '2026-03-02'
  });
  assert.ok(rKnownDg.warnings.find(w => w.code === 'DG_MISMATCH_LHB'));
  const overHm = rKnownDg.warnings.find(w => w.code === 'OVER_HOECHSTMENGE');
  assert.ok(overHm, JSON.stringify(rKnownDg.warnings));
  assert.equal(overHm.max_allowed, 6);
  assert.equal(overHm.requested, 40);
  assert.equal(rKnownDg.warnings.find(w => w.code === 'OVER_12_WEEKS_HEURISTIC'), undefined);
  assert.equal(rKnownDg.computed.exempt_from_wirtschaftlichkeitspruefung, false);
  assert.equal(rKnownDg.computed.verordnung_typ, 'standard');
  assert.equal(rKnownDg.computed.max_weeks_per_verordnung, null);
  assert.equal(rKnownDg.computed.regulation_source, 'HeilM-RL § 7 Abs. 5 / § 8 Abs. 2 S. 1');
});

test('blanko (Paket C): NOT_ON_BLANKO_LIST nennt tatsächliche Kataloggröße (65)', () => {
  const r = validateBlanko({
    icd10: 'M54.5',
    diagnosegruppe: 'EX',
    heilmittel_feld_text: 'BLANKOVERORDNUNG',
    ausstellungsdatum: '2026-03-02'
  });
  const blk = r.blockers.find(b => b.code === 'NOT_ON_BLANKO_LIST');
  assert.ok(blk);
  assert.match(blk.msg, /65 zulässige EX-Diagnosen/);
  assert.doesNotMatch(blk.msg, /114/);
});



