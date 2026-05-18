// § 302 SGB V — Anlage 1 V21 segment builders.
//
// Reference: Anlage_1_TP5_V21_20260115.pdf
//   - §5.5.2  SLGA Nutzsegmente            (p.30-38)
//   - §5.5.3.1 SLLA Basis-Segmente         (p.39-48)
//   - §5.5.3.3 SLLA Heilmittel-spezifisch  (p.63-75)
//
// Code lists referenced: Anlage_3_TP5_V22_20260218.pdf §8.x
//
// Conventions:
//   - Each builder returns an ARRAY of segment lines (mostly length 1; SLGA
//     GES helper returns one per status row).
//   - Trailing empty Kann-fields are dropped by buildSegment automatically.
//   - Empty Kann-fields in the middle MUST be passed as '' to keep their `+`.

import { buildSegment, fmtAmount, fmtDate } from './encoding.js';

// ===========================================================================
// SLGA segments — §5.5.2
// ===========================================================================

// FKT (SLGA) — §5.5.2 p.31-32
// Fields: VKZ, Sammelrechnung(K), IK-LE/RS, IK-KT, IK-KK(K), IK-Absender
export function buildSLGA_FKT({
  vkz = '01',
  sammelrechnung = '',           // 'J' for Sammelrechnung-SLGA, else ''
  ikLeistungserbringer,          // = Rechnungssteller for Gesamtrechnungs-SLGA
  ikKostentraeger,
  ikKrankenkasse = '',           // M for Gesamtrechnungs-SLGA, '' for Sammel
  ikAbsenderDatei,               // = UNB.Absender
}) {
  return [buildSegment('FKT', [
    vkz,
    sammelrechnung,
    ikLeistungserbringer,
    ikKostentraeger,
    ikKrankenkasse,
    ikAbsenderDatei,
  ])];
}

// REC (SLGA) — §5.5.2 p.32-34
// Rechnungsnummer is composite Sammel:Einzel; Einzel='0' if unused.
export function buildSLGA_REC({
  sammelRechnungsnummer,
  einzelRechnungsnummer = '0',
  rechnungsdatum,
  rechnungsart = '1',             // Anlage 3 §8.1.4
}) {
  return [buildSegment('REC', [
    [sammelRechnungsnummer, einzelRechnungsnummer],
    fmtDate(rechnungsdatum),
    rechnungsart,
  ])];
}

// UST (SLGA) — §5.5.2 p.34, K, NOT in Sammelrechnungs-SLGA
export function buildSLGA_UST({ steuernummer, ustBefreit }) {
  return [buildSegment('UST', [
    steuernummer,
    ustBefreit ? 'J' : '',
  ])];
}

// SKO (SLGA) — §5.5.2 p.35, K, max 9
export function buildSLGA_SKO({ skontoProzent, zahlungszielTage }) {
  return [buildSegment('SKO', [
    fmtAmount(skontoProzent),
    String(zahlungszielTage),
  ])];
}

// GES (SLGA) — §5.5.2 p.35-37. M, min 2 max 9. Status '00' first then per-VS.
// Fields: Status(n2), Gesamtrechnungsbetrag, Gesamtbruttobetrag, GesZuzahlung(K)
export function buildSLGA_GES(rows) {
  // rows: [{ status, rechnungsbetrag, brutto, zuzahlung }]
  return rows.map(r => buildSegment('GES', [
    String(r.status).padStart(2, '0'),
    fmtAmount(r.rechnungsbetrag),
    fmtAmount(r.brutto),
    r.zuzahlung != null ? fmtAmount(r.zuzahlung) : '',
  ]));
}

// NAM (SLGA) — §5.5.2 p.37-38. M, 1.
export function buildSLGA_NAM({ name1, name2 = '', name3 = '', name4 = '' }) {
  return [buildSegment('NAM', [name1, name2, name3, name4])];
}

// ===========================================================================
// SLLA Basis-Segmente — §5.5.3.1
// ===========================================================================

// FKT (SLLA) — §5.5.3.1 p.41
// Fields: VKZ, Freifeld(K, leer), IK-LE, IK-KT, IK-KK, IK-Rechnungssteller(K)
export function buildSLLA_FKT({
  vkz = '01',
  ikLeistungserbringer,
  ikKostentraeger,
  ikKrankenkasse,
  ikRechnungssteller = '',
}) {
  return [buildSegment('FKT', [
    vkz,
    '',                            // Freifeld
    ikLeistungserbringer,
    ikKostentraeger,
    ikKrankenkasse,
    ikRechnungssteller,
  ])];
}

// REC (SLLA) — §5.5.3.1 p.42-44. Identical shape to SLGA-REC.
export const buildSLLA_REC = buildSLGA_REC;

// INV (SLLA) — §5.5.3.1 p.44-45
// Fields: VersNr(K), VersStatus(K), Beleginfo(K), Belegnummer(M), Besond.Vers.(K)
export function buildSLLA_INV({
  versichertennummer = '',
  versichertenstatus = '',
  beleginformation = '',         // Anlage 3 §8.1.18
  belegnummer,                   // M
  kennzeichenBesondereVersorgung = '',
}) {
  return [buildSegment('INV', [
    versichertennummer,
    versichertenstatus,
    beleginformation,
    belegnummer,
    kennzeichenBesondereVersorgung,
  ])];
}

// URI (SLLA) — §5.5.3.1 p.46-47. M when VKZ ≠ '01'.
export function buildSLLA_URI({
  origIkLeistungserbringer,
  origSammelRechnungsnummer,
  origEinzelRechnungsnummer = '0',
  origRechnungsdatum,
  origBelegnummer,
}) {
  return [buildSegment('URI', [
    origIkLeistungserbringer,
    [origSammelRechnungsnummer, origEinzelRechnungsnummer],
    fmtDate(origRechnungsdatum),
    origBelegnummer,
  ])];
}

// NAD (SLLA) — §5.5.3.1 p.47-48. 7 separate fields. No 'geschlecht'.
export function buildSLLA_NAD({
  nachname,
  vorname,
  geburtsdatum,
  strasse = '',
  plz = '',
  ort = '',
  laenderkennzeichen = '',
}) {
  return [buildSegment('NAD', [
    nachname,
    vorname,
    fmtDate(geburtsdatum),
    strasse,
    plz,
    ort,
    laenderkennzeichen,
  ])];
}

// IMG (SLLA) — §5.5.3.1 p.48. K, 0..1.
export function buildSLLA_IMG({ abrechnungsjahr, abrechnungsmonat, ikStelle }) {
  return [buildSegment('IMG', [
    String(abrechnungsjahr),
    String(abrechnungsmonat).padStart(2, '0'),
    ikStelle,
  ])];
}

// EVO (SLLA) — §5.5.3.1 p.48. K, single field = eVO-ID.
export function buildSLLA_EVO({ evoId }) {
  return [buildSegment('EVO', [evoId])];
}

// ===========================================================================
// SLLA Heilmittel-spezifische Segmente — §5.5.3.3
// ===========================================================================

// EHE (SLLA-B) — §5.5.3.3 p.65-67
// Fields:
//   1 Leistungserbringergruppe (DEG abrechnungscode:tarifkennzeichen)
//   2 Abrechnungspositionsnummer (5-stellig, Anlage 3 §8.2.1)
//   3 Anzahl/Menge (n..4,2)
//   4 Einzelbetrag (n..10,2)
//   5 Datum der Leistungserbringung
//   6 Betrag der Zuzahlung (K)
//   7 Gefahrene Kilometer (K)
export function buildSLLA_EHE({
  abrechnungscode = '22',         // §8.1.5.1
  tarifkennzeichen,               // §8.1.5.2, 5-stellig
  positionsnummer,                // §8.2.1, an..5
  anzahl = 1,
  einzelbetrag,
  datumLeistung,
  zuzahlung = '',                 // per position
  kilometer = '',
}) {
  return [buildSegment('EHE', [
    [abrechnungscode, tarifkennzeichen],
    positionsnummer,
    fmtAmount(anzahl),
    fmtAmount(einzelbetrag),
    fmtDate(datumLeistung),
    zuzahlung === '' ? '' : fmtAmount(zuzahlung),
    kilometer === '' ? '' : String(kilometer),
  ])];
}

// TXT (SLLA-B) — §5.5.3.3 p.67. K, 0..1 per EHE.
export function buildSLLA_TXT({ text }) {
  return [buildSegment('TXT', [text])];
}

// MWS (SLLA-B) — §5.5.3.3 p.67-68. K, 0..1 per EHE.
export function buildSLLA_MWS({ satz, betrag }) {
  return [buildSegment('MWS', [fmtAmount(satz), fmtAmount(betrag)])];
}

// ZHE (SLLA-B) — §5.5.3.3 p.68-72. M, 1 per INV. Verordnung & Therapy data.
export function buildSLLA_ZHE({
  bsnr,                          // M, '999999999' if leer
  lanr,                          // M, '999999999' if leer
  verordnungsdatum,              // M
  zuzahlungskennzeichen,         // M, Anlage 3 §8.1.3
  diagnosegruppe,                // M, '9999' if leer
  verordnungsartHeilmittel,      // M, §8.1.12 (n2)
  verordnungsbesonderheiten = '',// K, §8.1.11
  unfallkennzeichen = '',        // K, §8.1.2
  bvgSonstigesSer = '',          // K, §8.1.2.1
  // field 10 Behandlungsbeginn — no longer used, always empty
  therapieberichtAngefordert = '', // K
  hausbesuch = '',                 // K
  leitsymptomatik,                 // M, an4 (Stellen a/b/c/d each 0|1)
  patientenLeitsymptomatik = '',   // K, M if d=1 or leitsymptomatik='0000'
  dringlicherBehandlungsbedarf,    // M, n1
  heilmittelBereich = '',          // K
  therapiefrequenz,                // M, n1
}) {
  return [buildSegment('ZHE', [
    bsnr,
    lanr,
    fmtDate(verordnungsdatum),
    String(zuzahlungskennzeichen),
    diagnosegruppe,
    String(verordnungsartHeilmittel).padStart(2, '0'),
    verordnungsbesonderheiten,
    unfallkennzeichen,
    bvgSonstigesSer,
    '',                          // field 10 Behandlungsbeginn (obsolete)
    therapieberichtAngefordert,
    hausbesuch,
    leitsymptomatik,
    patientenLeitsymptomatik,
    String(dringlicherBehandlungsbedarf),
    heilmittelBereich,
    String(therapiefrequenz),
  ])];
}

// DIA (SLLA-B) — §5.5.3.3 p.72. M, 1..n per ZHE for Heilmittel.
// Either icd10 OR text must be filled.
export function buildSLLA_DIA({ icd10 = '', text = '' }) {
  return [buildSegment('DIA', [icd10, text])];
}

// SKZ (SLLA-B) — §5.5.3.3 p.72-73. K, 0..1 per ZHE. Kostenzusage data.
export function buildSLLA_SKZ({
  genehmigungskennzeichen,
  genehmigungsdatum,
  artGenehmigung,                // §8.1.17, an2
}) {
  return [buildSegment('SKZ', [
    genehmigungskennzeichen,
    fmtDate(genehmigungsdatum),
    artGenehmigung,
  ])];
}

// BES (SLLA-B) — §5.5.3.3 p.73-74. M for VKZ 01/02/04/10.
// Fields:
//   1 Gesamtbetrag Brutto                          (M)
//   2 Gesamtbetrag gesetzliche Zuzahlung           (K, = 3 + 4)
//   3 Gesamtbetrag prozentuale Zuzahlung           (K)
//   4 pauschaler Zuzahlungsbetrag                  (K, 10€ cap)
//   5 Pauschale Korrekturabzug                     (K, VKZ 04 only)
export function buildSLLA_BES({
  brutto,
  gesZuzahlung = '',
  prozZuzahlung = '',
  pauschZuzahlung = '',
  pauschKorrektur = '',
}) {
  return [buildSegment('BES', [
    fmtAmount(brutto),
    gesZuzahlung === '' ? '' : fmtAmount(gesZuzahlung),
    prozZuzahlung === '' ? '' : fmtAmount(prozZuzahlung),
    pauschZuzahlung === '' ? '' : fmtAmount(pauschZuzahlung),
    pauschKorrektur === '' ? '' : fmtAmount(pauschKorrektur),
  ])];
}

// GZF (SLLA-B) — §5.5.3.3 p.74-75. M for VKZ 03 ONLY (replaces BES).
export function buildSLLA_GZF({
  gesZuzahlungForderung,
  prozZuzahlungForderung = '',
  pauschZuzahlungForderung = '',
}) {
  return [buildSegment('GZF', [
    fmtAmount(gesZuzahlungForderung),
    prozZuzahlungForderung === '' ? '' : fmtAmount(prozZuzahlungForderung),
    pauschZuzahlungForderung === '' ? '' : fmtAmount(pauschZuzahlungForderung),
  ])];
}
