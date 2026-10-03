// § 302 SGB V — Zuzahlungsforderung (VKZ 03) Ursprungsdaten-Parser
//
// Referenz: Anlage 1 TP5 V21 (15.01.2026, anwendbar ab 01.10.2025)
//   - Kap. 7.2 Grundsätze des Korrekturverfahrens
//   - Kap. 7.3 Rahmenbedingungen & URI-Segment
//   - Kap. 7.4.2 Zuzahlungsforderung (VKZ 03)
//     - 7.4.2.1 KZ2: Nicht gezahlt trotz Zahlungsaufforderung (§ 43c SGB V)
//     - 7.4.2.2 KZ1: Nachträgliche Befreiung
//     - 7.4.2.3 KZ5: Jahresübergang (befreit -> pflichtig)
//   - Kap. 5.5.2 / 5.5.3.3: GZF statt BES, GES-Berechnungsregeln für VKZ 03
//
// Warum dieser Parser:
// abrechnung_zeile ist ein vereinfachter Schnappschuss für die Praxisansicht;
// historische Identitätsdaten (Versichertenstatus, Arzt-LANR/BSNR, Diagnosen,
// ZHE-Merkmale, genaue EHE-Sitzungsstruktur, Geburtsdatum, Adresse) liegen
// unverkürzt NUR in der originalen, unveränderlichen DTA-Datei.
// Um eine rechtssichere Zuzahlungsforderung (VKZ 03) nach § 302 zu erzeugen,
// wird die hash-verifizierte Ursprungs-DTA geladen und die exakte SLLA-Nachricht
// extrahiert. Kein Rückfall auf heutige Katalogpreise oder lebende Verordnungsdaten.

import { createHash } from 'node:crypto';
import { segmenteTrennen, felderTrennen, pruefeDatenstrom } from './preflight.js';
import { berlinHeute, istStichtag } from '../../lib/berlin-tag.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UTC_Z_TIMESTAMP_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/;

const ALLOWED_KEYS_KZ1 = new Set([
  'art',
  'referenz',
  'gueltigAb',
  'gueltigBis',
  'geprueftAm',
  'geprueftZeitpunkt',
  'prueferId',
  'patientId',
  'kostentraegerIk',
  'bestaetigt',
]);

const ALLOWED_KEYS_KZ2 = new Set([
  'art',
  'referenz',
  'geprueftAm',
  'geprueftZeitpunkt',
  'prueferId',
  'patientId',
  'kostentraegerIk',
  'bestaetigt',
  'versandDatum',
  'versandArt',
  'nachweisBeigefuegtBestaetigt',
  'erfolgloserEinzugBestaetigt',
]);

const ALLOWED_KEYS_KZ5 = new Set([
  'art',
  'referenz',
  'gueltigAb',
  'gueltigBis',
  'geprueftAm',
  'geprueftZeitpunkt',
  'prueferId',
  'patientId',
  'kostentraegerIk',
  'bestaetigt',
  'statusWechselDatum',
  'zahlungsaufforderungReferenz',
  'zahlungsaufforderungDatum',
  'originalAbzugBestaetigt',
]);

export function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Trennt Teil-Elemente (Komponenten) eines EDIFACT-Feldes anhand des Doppelpunkts (:).
 * Entwertungszeichen (?) wird beachtet: `?:` ist kein Trenner.
 *
 * @param {string} feld
 * @returns {string[]} Komponenten (noch mit Entwertungszeichen)
 */
export function komponentenTrennen(feld) {
  const out = [];
  let akt = '';
  const s = String(feld ?? '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '?') {
      akt += c + (s[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === ':') {
      out.push(akt);
      akt = '';
      continue;
    }
    akt += c;
  }
  out.push(akt);
  return out;
}

/**
 * Löst EDIFACT-Entwertungszeichen (?) auf.
 * Darf erst NACH allen Trennschritten (Segmente -> Felder -> Komponenten) aufgerufen werden.
 *
 * @param {string} val
 * @returns {string}
 */
export function unescapeEdifact(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '?') {
      if (i + 1 < s.length) {
        out += s[i + 1];
        i++;
      }
    } else {
      out += s[i];
    }
  }
  return out;
}

/**
 * Parst einen deutschen Betragsstring (z. B. "28,90" oder "1,00") in eine Gleitkommazahl (auf 2 Nachkommastellen gerundet).
 * Unterstützt vorzeichenbehaftete Beträge; wirft Fehler bei syntaktisch ungültigem oder nicht-endlichem Wert.
 *
 * @param {string|number} val
 * @returns {number}
 */
export function parseGermanAmount(val) {
  if (val === null || val === undefined || val === '') return NaN;
  const s = String(val).trim();
  if (!/^-?[0-9]+(,[0-9]{1,2})?$/.test(s)) {
    const err = new Error('Ungültiges Währungsformat im DTA (erwartet: 0,00 oder 0): ' + val);
    err.status = 422;
    err.code = 'INVALID_AMOUNT_FORMAT';
    throw err;
  }
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n)) {
    const err = new Error('Betrag ist nicht endlich: ' + val);
    err.status = 422;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  return Math.round(n * 100) / 100;
}

/**
 * Konvertiert ein 8-stelliges EDIFACT-Datum YYYYMMDD oder ISO YYYY-MM-DD in ISO-Format YYYY-MM-DD.
 * Führt eine strikte Kalender-Rundlaufprüfung durch (z. B. 31. Februar wird abgewiesen).
 *
 * @param {string} d
 * @returns {string}
 */
export function toIsoDate(d) {
  if (d === null || d === undefined || d === '') return '';
  const s = String(d).trim();
  let iso = s;
  if (/^\d{8}$/.test(s)) {
    iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  if (!istStichtag(iso)) {
    const err = new Error(`Ungültiges Kalenderdatum (Format oder Rundlaufprüfung fehlgeschlagen): "${d}".`);
    err.status = 422;
    err.code = 'INVALID_CALENDAR_DATE';
    throw err;
  }
  return iso;
}

/**
 * Parst eine originale DTA-Datei, validiert ihre Prüfsumme und Syntax,
 * sucht die exakt passende SLLA-Nachricht für die angegebene Ursprungszeile
 * und rekonstruiert daraus die Eingabestruktur für eine Zuzahlungsforderung (VKZ 03).
 *
 * @param {object} params
 * @param {Buffer|string} params.dtaContent - DTA-Inhalt (Buffer oder Latin1-String)
 * @param {string} params.expectedSha256 - Erwartete SHA-256-Prüfsumme (64 Hex-Zeichen, zwingend erforderlich)
 * @param {object} params.sourceHeader - Ursprungskopf (abrechnung-Zeile)
 * @param {object} params.sourceZeile - Ursprungsbeleg (abrechnung_zeile)
 * @param {string} params.reason - 'KZ1' | 'KZ2' | 'KZ5' | '1' | '2' | '5'
 * @param {number[]} [params.selectedSessionIndices] - Ausgewählte Sitzungsindizes
 * @param {string} [params.currentSenderIk] - Zertifikats-IK der Praxis (zur Absicherung gegen IK-Wechsel)
 * @param {object} [params.nachweisPruefung] - Expliziter, auditierter Nachweis (Pflicht für KZ1 und KZ5)
 * @param {string} [params.verifiedSourcePatientId] - Verifizierte Patienten-UUID aus der Route
 * @param {string} [params.sourcePatientId] - Alternative Patienten-UUID
 * @returns {object} { prescription, claimAmount, prozClaim, pauschClaim, ursprung, reason, selectedSessions }
 */
export function parseOriginalDtaMessage({
  dtaContent,
  expectedSha256,
  sourceHeader,
  sourceZeile,
  reason,
  selectedSessionIndices = null,
  currentSenderIk = null,
  nachweisPruefung = null,
  verifiedSourcePatientId = null,
  sourcePatientId = null,
}) {
  // 1. Zwingende SHA-256 Prüfsumme prüfen (vor Dekodierung)
  if (!expectedSha256 || typeof expectedSha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(expectedSha256.trim())) {
    const err = new Error('Erwartete SHA-256-Prüfsumme (64 Hex-Zeichen) ist zwingend erforderlich.');
    err.status = 422;
    err.code = 'DTA_HASH_REQUIRED';
    throw err;
  }

  // Primitive Buffer- oder Latin1-String-Prüfung
  let rawBuffer = null;
  if (Buffer.isBuffer(dtaContent)) {
    rawBuffer = dtaContent;
  } else if (typeof dtaContent === 'string') {
    rawBuffer = Buffer.from(dtaContent, 'latin1');
  } else {
    const err = new Error('Ungültiger DTA-Inhalt: Buffer oder Latin1-String erforderlich.');
    err.status = 422;
    err.code = 'INVALID_DTA_CONTENT';
    throw err;
  }

  const actualHash = sha256Hex(rawBuffer);
  if (actualHash.toLowerCase() !== expectedSha256.toLowerCase().trim()) {
    const err = new Error(
      `Prüfsummenfehler der Ursprungsdatei: SHA-256 (${actualHash}) stimmt nicht mit dem gespeicherten Hash (${expectedSha256}) überein.`
    );
    err.status = 422;
    err.code = 'DTA_HASH_MISMATCH';
    throw err;
  }

  // 2. Grund normalisieren
  const normReason = String(reason || '').trim().toUpperCase();
  let canonicalReason = null;
  if (['KZ2', '2', 'NICHT_GEZAHLT', 'MAHNUNG', 'VERWEIGERT'].includes(normReason)) canonicalReason = 'KZ2';
  else if (['KZ1', '1', 'BEFREIT', 'BEFREIUNG'].includes(normReason)) canonicalReason = 'KZ1';
  else if (['KZ5', '5', 'JAHRESWECHSEL', 'JAHRESUEBERGANG'].includes(normReason)) canonicalReason = 'KZ5';
  else {
    const err = new Error(
      `Ungültiger Grund für Zuzahlungsforderung: "${reason}". ` +
      `Zulässig sind KZ1 / 1 (nachträgliche Befreiung), KZ2 / 2 (Zahlungsverweigerung trotz Mahnung nach §43c SGB V) oder KZ5 / 5 (Jahresübergang).`
    );
    err.status = 400;
    err.code = 'INVALID_REASON';
    throw err;
  }

  // 3. Pflichtfelder in sourceHeader und sourceZeile validieren (keine Wildcards zulässig)
  if (!sourceHeader || typeof sourceHeader !== 'object') {
    const err = new Error('Ursprungskopf (sourceHeader) fehlt oder ist ungültig.');
    err.status = 422;
    err.code = 'MISSING_SOURCE_HEADER';
    throw err;
  }
  if (!sourceZeile || typeof sourceZeile !== 'object') {
    const err = new Error('Ursprungsbeleg (sourceZeile) fehlt oder ist ungültig.');
    err.status = 422;
    err.code = 'MISSING_SOURCE_ZEILE';
    throw err;
  }

  const expectedSammel = String(sourceHeader.rechnungsnummer || '').trim();
  if (!expectedSammel) {
    const err = new Error('Rechnungsnummer im Ursprungskopf (sourceHeader.rechnungsnummer) ist zwingend erforderlich.');
    err.status = 422;
    err.code = 'MISSING_INVOICE_NUMBER';
    throw err;
  }

  const expectedBeleg = String(sourceZeile.belegnummer || '').trim();
  if (!expectedBeleg) {
    const err = new Error('Belegnummer im Ursprungsbeleg (sourceZeile.belegnummer) ist zwingend erforderlich.');
    err.status = 422;
    err.code = 'MISSING_BELEGNUMMER';
    throw err;
  }

  const expectedVersNr = String(sourceZeile.versichertennummer || '').trim();
  if (!expectedVersNr) {
    const err = new Error('Versichertennummer (KVNR) im Ursprungsbeleg ist zwingend erforderlich.');
    err.status = 422;
    err.code = 'MISSING_KVNR';
    throw err;
  }

  const expectedEinzel = String(sourceZeile.einzel_rechnungsnummer ?? '0').trim();

  const expectedVerordnungsdatum = sourceZeile.verordnungsdatum ? toIsoDate(sourceZeile.verordnungsdatum) : null;
  const expectedRechnungsdatum = (sourceHeader.rechnungsdatum || sourceHeader.datum) ? toIsoDate(sourceHeader.rechnungsdatum || sourceHeader.datum) : null;
  if (!expectedVerordnungsdatum && !expectedRechnungsdatum) {
    const err = new Error('Mindestens ein gültiges Kalenderdatum (sourceZeile.verordnungsdatum oder sourceHeader.rechnungsdatum) ist für den eindeutigen Abgleich erforderlich.');
    err.status = 422;
    err.code = 'MISSING_DATE';
    throw err;
  }

  // Abgleich mit Schnappschuss-Finanzdaten der abrechnung_zeile (exakte Cents, keine Schätzung)
  if (
    sourceZeile.brutto_eur === undefined || sourceZeile.brutto_eur === null ||
    sourceZeile.zuzahlung_eur === undefined || sourceZeile.zuzahlung_eur === null ||
    sourceZeile.netto_eur === undefined || sourceZeile.netto_eur === null
  ) {
    const err = new Error('Ursprungsbeleg enthält unvollständige Finanzdaten (brutto_eur, zuzahlung_eur, netto_eur erforderlich).');
    err.status = 422;
    err.code = 'MISSING_SNAPSHOT_MONEY';
    throw err;
  }

  const snapBrutto = Number(sourceZeile.brutto_eur);
  const snapZuzahlung = Number(sourceZeile.zuzahlung_eur);
  const snapNetto = Number(sourceZeile.netto_eur);
  if (!Number.isFinite(snapBrutto) || !Number.isFinite(snapZuzahlung) || !Number.isFinite(snapNetto)) {
    const err = new Error('Nicht-endliche Beträge im Schnappschuss der Ursprungszeile.');
    err.status = 422;
    err.code = 'INVALID_SNAPSHOT_MONEY';
    throw err;
  }
  const snapBruttoCents = Math.round(snapBrutto * 100);
  const snapZuzahlungCents = Math.round(snapZuzahlung * 100);
  const snapNettoCents = Math.round(snapNetto * 100);
  if (snapBruttoCents - snapZuzahlungCents !== snapNettoCents) {
    const err = new Error(
      `Inkonsistente Schnappschuss-Beträge: Brutto (${snapBrutto.toFixed(2)}) - Zuzahlung (${snapZuzahlung.toFixed(2)}) != Netto (${snapNetto.toFixed(2)}).`
    );
    err.status = 422;
    err.code = 'SNAPSHOT_MONEY_INCONSISTENT';
    throw err;
  }

  // 4. Dekodierung nach Latin-1 und Syntaxprüfung
  const dtaText = rawBuffer.toString('latin1');
  let pruefErgebnis = null;
  try {
    pruefErgebnis = pruefeDatenstrom(dtaText);
  } catch (e) {
    const err = new Error(`Ursprungs-DTA-Datei ist syntaktisch beschädigt: ${e.message}`);
    err.status = 422;
    err.code = 'DTA_SYNTAX_ERROR';
    throw err;
  }

  if (!pruefErgebnis || typeof pruefErgebnis.segmente !== 'number' || pruefErgebnis.segmente <= 0 || typeof pruefErgebnis.nachrichten !== 'number' || pruefErgebnis.nachrichten <= 0) {
    const err = new Error('Ursprungs-DTA-Datei enthält keine gültigen EDIFACT-Nachrichten oder Segmente.');
    err.status = 422;
    err.code = 'DTA_SYNTAX_ERROR';
    throw err;
  }

  // 5. Segmente trennen und Nachrichten gruppieren
  const rawSegmente = segmenteTrennen(dtaText);
  const messages = [];
  let currentMsg = null;

  for (const seg of rawSegmente) {
    const rawFields = felderTrennen(seg);
    const tag = rawFields[0];

    if (tag === 'UNH') {
      const unhComponents = komponentenTrennen(rawFields[2] || '');
      const msgType = unhComponents[0] || '';
      const msgVersion = unhComponents[1] || '';
      currentMsg = {
        ref: unescapeEdifact(rawFields[1] || ''),
        type: msgType,
        version: msgVersion,
        segments: [],
      };
      continue;
    }

    if (tag === 'UNT') {
      if (currentMsg) {
        messages.push(currentMsg);
        currentMsg = null;
      }
      continue;
    }

    if (currentMsg) {
      currentMsg.segments.push({
        raw: seg,
        tag,
        fields: rawFields,
      });
    }
  }

  // 6. SLLA-Nachrichten filtern und strikt abgleichen
  const sllaMessages = messages.filter(m => m.type === 'SLLA');
  if (sllaMessages.length === 0) {
    const err = new Error('Die Ursprungs-DTA-Datei enthält keine SLLA-Abrechnungsfälle.');
    err.status = 422;
    err.code = 'NO_SLLA_MESSAGES';
    throw err;
  }

  const matched = [];

  for (const msg of sllaMessages) {
    if (msg.version && msg.version !== '21') {
      const err = new Error(
        `Nicht unterstützte SLLA-Version in Ursprungsdatei: "${msg.version}". Unterstützt wird Version 21.`
      );
      err.status = 422;
      err.code = 'UNSUPPORTED_VERSION';
      throw err;
    }

    const recSeg = msg.segments.find(s => s.tag === 'REC');
    const invSeg = msg.segments.find(s => s.tag === 'INV');
    const zheSeg = msg.segments.find(s => s.tag === 'ZHE');

    if (!recSeg || !invSeg || !zheSeg) continue;

    const recKomps = komponentenTrennen(recSeg.fields[1] || '').map(unescapeEdifact);
    const msgSammel = String(recKomps[0] || '').trim();
    const msgEinzel = String(recKomps[1] ?? '0').trim();
    const msgRechnungsdatum = toIsoDate(unescapeEdifact(recSeg.fields[2] || ''));

    const msgBeleg = unescapeEdifact(invSeg.fields[4] || '').trim();
    const msgVersNr = unescapeEdifact(invSeg.fields[1] || '').trim();
    const msgVerordnungsdatum = toIsoDate(unescapeEdifact(zheSeg.fields[3] || ''));

    const sammelMatch = msgSammel === expectedSammel;
    const einzelMatch = msgEinzel === expectedEinzel;
    const belegMatch = msgBeleg === expectedBeleg;
    const versMatch = msgVersNr === expectedVersNr;
    const dateMatch =
      (!expectedVerordnungsdatum || msgVerordnungsdatum === expectedVerordnungsdatum) &&
      (!expectedRechnungsdatum || msgRechnungsdatum === expectedRechnungsdatum);

    if (sammelMatch && einzelMatch && belegMatch && versMatch && dateMatch) {
      matched.push({ msg, recKomps, invSeg });
    }
  }

  if (matched.length === 0) {
    const err = new Error(
      `Ursprungsbeleg (Beleg-Nr. "${expectedBeleg}", Einzel-Rechnungs-Nr. "${expectedEinzel}", KVNR "${expectedVersNr}") ` +
      `in der Ursprungs-DTA-Datei nicht gefunden.`
    );
    err.status = 404;
    err.code = 'ORIGINAL_LINE_NOT_FOUND';
    throw err;
  }

  if (matched.length > 1) {
    const err = new Error(
      `Mehrdeutiger Ursprungsbeleg in der DTA-Datei: Es wurden ${matched.length} übereinstimmende SLLA-Nachrichten gefunden.`
    );
    err.status = 422;
    err.code = 'AMBIGUOUS_ORIGINAL_LINE';
    throw err;
  }

  const { msg: targetMsg, recKomps, invSeg } = matched[0];
  const segs = targetMsg.segments;

  // 7. Struktur- und Pflichtsegmentprüfung
  const fktSegs = segs.filter(s => s.tag === 'FKT');
  const recSegs = segs.filter(s => s.tag === 'REC');
  const invSegs = segs.filter(s => s.tag === 'INV');
  const nadSegs = segs.filter(s => s.tag === 'NAD');
  const zheSegs = segs.filter(s => s.tag === 'ZHE');
  const besSegs = segs.filter(s => s.tag === 'BES');
  const uriSeg = segs.find(s => s.tag === 'URI');
  const gzfSeg = segs.find(s => s.tag === 'GZF');

  if (
    fktSegs.length !== 1 || recSegs.length !== 1 || invSegs.length !== 1 ||
    nadSegs.length !== 1 || zheSegs.length !== 1 || besSegs.length !== 1
  ) {
    const err = new Error(
      `Ungültige Pflichtsegmentanzahl in Ursprungs-SLLA-Nachricht: ` +
      `FKT=${fktSegs.length}, REC=${recSegs.length}, INV=${invSegs.length}, ` +
      `NAD=${nadSegs.length}, ZHE=${zheSegs.length}, BES=${besSegs.length}. Genau 1 je Pflichtsegment erforderlich.`
    );
    err.status = 422;
    err.code = 'INVALID_SEGMENT_COUNT';
    throw err;
  }

  const fktSeg = fktSegs[0];
  const recSeg = recSegs[0];
  const nadSeg = nadSegs[0];
  const zheSeg = zheSegs[0];
  const besSeg = besSegs[0];

  const origVkz = unescapeEdifact(fktSeg.fields[1] || '').trim();
  if (origVkz !== '01') {
    const err = new Error(
      `Die Ursprungsrechnung hat Verarbeitungskennzeichen "${origVkz}". Eine Zuzahlungsforderung (VKZ 03) ist nur auf Erstrechnungen mit VKZ 01 zulässig.`
    );
    err.status = 422;
    err.code = 'INVALID_ORIGINAL_VKZ';
    throw err;
  }

  if (uriSeg) {
    const err = new Error('Die Ursprungsrechnung VKZ 01 enthält ein unzulässiges URI-Segment.');
    err.status = 422;
    err.code = 'INVALID_ORIGINAL_SEGMENT';
    throw err;
  }

  if (gzfSeg) {
    const err = new Error('Die Ursprungsrechnung enthält ein GZF-Segment; eine Erstrechnung muss BES tragen.');
    err.status = 422;
    err.code = 'INVALID_ORIGINAL_SEGMENT';
    throw err;
  }

  const origSenderIk = unescapeEdifact(fktSeg.fields[3] || '').trim();
  if (!origSenderIk) {
    const err = new Error('Absender-IK (FKT Feld 3) in der Ursprungsnachricht fehlt.');
    err.status = 422;
    err.code = 'MISSING_SENDER_IK';
    throw err;
  }

  if (currentSenderIk && String(currentSenderIk).trim() !== origSenderIk) {
    const err = new Error(
      `Die IK der Praxis (${currentSenderIk}) weicht von der ursprünglichen Leistungserbringer-IK (${origSenderIk}) ab. ` +
      `Ein stiller IK-Wechsel im Korrekturverfahren ist nicht zulässig (Anlage 1 TP5 V21, Kap. 7.2).`
    );
    err.status = 422;
    err.code = 'IK_MISMATCH';
    throw err;
  }

  const origKostentraegerIk = unescapeEdifact(fktSeg.fields[4] || '').trim();
  const origKrankenkasseIk = unescapeEdifact(fktSeg.fields[5] || '').trim();

  const expectedKtIk = String(sourceHeader.kostentraeger_ik || '').trim();
  if (!expectedKtIk) {
    const err = new Error('Kostenträger-IK im Ursprungskopf fehlt.');
    err.status = 422;
    err.code = 'MISSING_KOSTENTRAEGER_IK';
    throw err;
  }
  if (expectedKtIk !== origKostentraegerIk) {
    const err = new Error(
      `Kostenträger-IK in DTA (${origKostentraegerIk}) stimmt nicht mit Abrechnungskopf (${expectedKtIk}) überein.`
    );
    err.status = 422;
    err.code = 'KOSTENTRAEGER_IK_MISMATCH';
    throw err;
  }

  // 8. Segmente validieren und extrahieren
  const ALLOWED_TAGS = new Set(['FKT', 'REC', 'INV', 'NAD', 'IMG', 'EVO', 'EHE', 'TXT', 'MWS', 'ZHE', 'DIA', 'SKZ', 'BES']);
  for (const s of segs) {
    if (!ALLOWED_TAGS.has(s.tag)) {
      const err = new Error(`Nicht unterstütztes oder unbekanntes Segment "${s.tag}" in der Ursprungs-SLLA-Nachricht.`);
      err.status = 422;
      err.code = 'UNKNOWN_SEGMENT';
      throw err;
    }
  }

  // REC-Felder
  const origSammelRechnungsnummer = recKomps[0] || '';
  const origEinzelRechnungsnummer = recKomps[1] || '0';
  const origRechnungsdatum = toIsoDate(unescapeEdifact(recSeg.fields[2] || ''));
  const origRechnungsart = unescapeEdifact(recSeg.fields[3] || '1');

  // INV-Felder
  const versichertennummer = unescapeEdifact(invSeg.fields[1] || '').trim();
  const versichertenstatus = unescapeEdifact(invSeg.fields[2] || '').trim();
  if (!versichertenstatus) {
    const err = new Error('Versichertenstatus im INV-Segment der Ursprungsdatei fehlt.');
    err.status = 422;
    err.code = 'MISSING_MANDATORY_FIELD';
    throw err;
  }
  const beleginformation = unescapeEdifact(invSeg.fields[3] || '');
  const belegnummer = unescapeEdifact(invSeg.fields[4] || '').trim();
  const kennzeichenBesondereVersorgung = unescapeEdifact(invSeg.fields[5] || '');

  // NAD-Felder
  let nachname = '';
  let vorname = '';
  let geburtsdatum = '';
  let strasse = '';
  let plz = '';
  let ort = '';
  let laenderkennzeichen = '';

  const f3 = unescapeEdifact(nadSeg.fields[3] || '').trim();
  const f4 = unescapeEdifact(nadSeg.fields[4] || '').trim();

  if (/^\d{8}$/.test(f3)) {
    nachname = unescapeEdifact(nadSeg.fields[1] || '');
    vorname = unescapeEdifact(nadSeg.fields[2] || '');
    geburtsdatum = toIsoDate(f3);
    strasse = unescapeEdifact(nadSeg.fields[4] || '');
    plz = unescapeEdifact(nadSeg.fields[5] || '');
    ort = unescapeEdifact(nadSeg.fields[6] || '');
    laenderkennzeichen = unescapeEdifact(nadSeg.fields[7] || '');
  } else if (/^\d{8}$/.test(f4)) {
    nachname = unescapeEdifact(nadSeg.fields[2] || '');
    vorname = unescapeEdifact(nadSeg.fields[3] || '');
    geburtsdatum = toIsoDate(f4);
    strasse = unescapeEdifact(nadSeg.fields[5] || '');
    plz = unescapeEdifact(nadSeg.fields[6] || '');
    ort = unescapeEdifact(nadSeg.fields[7] || '');
    laenderkennzeichen = unescapeEdifact(nadSeg.fields[8] || '');
  } else {
    nachname = unescapeEdifact(nadSeg.fields[1] || '');
    vorname = unescapeEdifact(nadSeg.fields[2] || '');
    geburtsdatum = toIsoDate(f3);
    strasse = unescapeEdifact(nadSeg.fields[4] || '');
    plz = unescapeEdifact(nadSeg.fields[5] || '');
    ort = unescapeEdifact(nadSeg.fields[6] || '');
    laenderkennzeichen = unescapeEdifact(nadSeg.fields[7] || '');
  }

  // IMG (optional, exakte Feldanzahl = 3 Datenfelder: Jahr, Monat, IK)
  const imgSeg = segs.find(s => s.tag === 'IMG');
  let imageLink = null;
  if (imgSeg) {
    if (imgSeg.fields.length !== 4) {
      const err = new Error(`Ungültige Feldanzahl im IMG-Segment: genau 3 Datenfelder erforderlich.`);
      err.status = 422;
      err.code = 'INVALID_SEGMENT_SHAPE';
      throw err;
    }
    const abrechnungsjahr = unescapeEdifact(imgSeg.fields[1] || '').trim();
    const abrechnungsmonat = unescapeEdifact(imgSeg.fields[2] || '').trim();
    const ikStelle = unescapeEdifact(imgSeg.fields[3] || '').trim();
    if (!abrechnungsjahr || !abrechnungsmonat || !ikStelle) {
      const err = new Error('Unvollständiges IMG-Segment: Abrechnungsjahr, Abrechnungsmonat oder IK fehlen.');
      err.status = 422;
      err.code = 'INVALID_SEGMENT_SHAPE';
      throw err;
    }
    imageLink = { abrechnungsjahr, abrechnungsmonat, ikStelle };
  }

  // EVO (optional, exakte Feldanzahl = 1 Datenfeld: eVO-ID)
  const evoSeg = segs.find(s => s.tag === 'EVO');
  let evoId = null;
  if (evoSeg) {
    if (evoSeg.fields.length !== 2) {
      const err = new Error(`Ungültige Feldanzahl im EVO-Segment: genau 1 Datenfeld erforderlich.`);
      err.status = 422;
      err.code = 'INVALID_SEGMENT_SHAPE';
      throw err;
    }
    evoId = unescapeEdifact(evoSeg.fields[1] || '').trim();
    if (!evoId) {
      const err = new Error('Leeres EVO-Segment.');
      err.status = 422;
      err.code = 'INVALID_SEGMENT_SHAPE';
      throw err;
    }
  }

  // SKZ (optional, exakte Feldanzahl = 3 Datenfelder: Kennzeichen, Datum, Art)
  const skzSeg = segs.find(s => s.tag === 'SKZ');
  let genehmigung = null;
  if (skzSeg) {
    if (skzSeg.fields.length !== 4) {
      const err = new Error(`Ungültige Feldanzahl im SKZ-Segment: genau 3 Datenfelder erforderlich.`);
      err.status = 422;
      err.code = 'INVALID_SEGMENT_SHAPE';
      throw err;
    }
    const kennzeichen = unescapeEdifact(skzSeg.fields[1] || '').trim();
    const datum = toIsoDate(unescapeEdifact(skzSeg.fields[2] || ''));
    const art = unescapeEdifact(skzSeg.fields[3] || '').trim();
    if (!kennzeichen || !datum || !art) {
      const err = new Error('Unvollständiges SKZ-Segment: Kennzeichen, Datum oder Art fehlen.');
      err.status = 422;
      err.code = 'INVALID_SEGMENT_SHAPE';
      throw err;
    }
    genehmigung = { kennzeichen, datum, art };
  }

  // ZHE-Felder (Mussfelder strikt prüfen, keine historischen Fallbacks auf 1 oder 999999999)
  const bsnr = unescapeEdifact(zheSeg.fields[1] || '').trim();
  const lanr = unescapeEdifact(zheSeg.fields[2] || '').trim();
  if (!bsnr || !lanr) {
    const err = new Error('BSNR oder LANR im ZHE-Segment der Ursprungsdatei fehlen.');
    err.status = 422;
    err.code = 'MISSING_MANDATORY_FIELD';
    throw err;
  }

  const ausstellungsdatum = toIsoDate(unescapeEdifact(zheSeg.fields[3] || ''));
  if (!ausstellungsdatum) {
    const err = new Error('Ausstellungsdatum im ZHE-Segment der Ursprungsdatei fehlt.');
    err.status = 422;
    err.code = 'MISSING_MANDATORY_FIELD';
    throw err;
  }

  const origZuzahlungskennzeichen = unescapeEdifact(zheSeg.fields[4] || '').trim();
  if (!origZuzahlungskennzeichen) {
    const err = new Error('Zuzahlungskennzeichen im ZHE-Segment der Ursprungsdatei fehlt.');
    err.status = 422;
    err.code = 'MISSING_MANDATORY_FIELD';
    throw err;
  }

  const diagnosegruppe = unescapeEdifact(zheSeg.fields[5] || '').trim();
  const verordnungsart = unescapeEdifact(zheSeg.fields[6] || '').trim();
  const verordnungsbesonderheiten = unescapeEdifact(zheSeg.fields[7] || '');
  const unfallkennzeichen = unescapeEdifact(zheSeg.fields[8] || '');
  const bvgSonstigesSer = unescapeEdifact(zheSeg.fields[9] || '');
  const therapieberichtAngefordert = unescapeEdifact(zheSeg.fields[11] || '') === '1';
  const hausbesuch = unescapeEdifact(zheSeg.fields[12] || '');
  const leitsymptomatik = unescapeEdifact(zheSeg.fields[13] || '');
  const patLeitsymptomatik = unescapeEdifact(zheSeg.fields[14] || '');
  const dringend = unescapeEdifact(zheSeg.fields[15] || '') === '1';

  const heilmittelBereich = unescapeEdifact(zheSeg.fields[16] || '').trim();
  const therapiefrequenz = unescapeEdifact(zheSeg.fields[17] || '').trim();
  if (!heilmittelBereich || !therapiefrequenz) {
    const err = new Error('Heilmittelbereich oder Therapiefrequenz im ZHE-Segment der Ursprungsdatei fehlen.');
    err.status = 422;
    err.code = 'MISSING_MANDATORY_FIELD';
    throw err;
  }

  // DIA-Felder (1..n)
  const diaSegs = segs.filter(s => s.tag === 'DIA');
  if (diaSegs.length === 0) {
    const err = new Error('Kein DIA-Segment in der Ursprungs-SLLA-Nachricht vorhanden.');
    err.status = 422;
    err.code = 'MISSING_MANDATORY_SEGMENT';
    throw err;
  }

  const icd10Liste = [];
  const textListe = [];
  let artDerDiagnose = null;

  for (const d of diaSegs) {
    let art = null;
    let kode = '';
    let txt = '';

    if (d.fields.length >= 4) {
      art = unescapeEdifact(d.fields[1] || '').trim();
      kode = unescapeEdifact(d.fields[2] || '').trim();
      txt = unescapeEdifact(d.fields[3] || '').trim();
    } else if (d.fields.length === 3) {
      const f1 = unescapeEdifact(d.fields[1] || '').trim();
      const f2 = unescapeEdifact(d.fields[2] || '').trim();
      if (/^\d$/.test(f1) && f2 && !/^\d$/.test(f2)) {
        art = f1;
        kode = f2;
      } else {
        kode = f1;
        txt = f2;
      }
    } else if (d.fields.length === 2) {
      kode = unescapeEdifact(d.fields[1] || '').trim();
    }

    if (art && !artDerDiagnose) artDerDiagnose = art;
    if (kode) icd10Liste.push(kode);
    if (txt) textListe.push(txt);
  }

  if (textListe.length > 1) {
    const err = new Error(
      'Mehrere Diagnosetexte in DIA-Segmenten der Ursprungsdatei werden vom VKZ-03-Builder nicht unterstützt ' +
      '(zweiter Diagnosetext ginge verloren).'
    );
    err.status = 422;
    err.code = 'UNSUPPORTED_ORIGINAL_SEGMENT';
    throw err;
  }

  const diagnosetext = textListe[0] || '';

  if (icd10Liste.length === 0 && !diagnosetext) {
    const err = new Error('Mindestens ein Diagnoseschlüssel oder Diagnosetext im DIA-Segment erforderlich.');
    err.status = 422;
    err.code = 'INVALID_DIA_SEGMENT';
    throw err;
  }

  // EHE (+ TXT, MWS) extrahieren
  const allSessions = [];
  let currentSession = null;
  let tarifData = null;

  for (const s of segs) {
    if (s.tag === 'EHE') {
      const eheKomps = komponentenTrennen(s.fields[1] || '').map(unescapeEdifact);
      const abrechnungscode = (eheKomps[0] || '').trim();
      const tarifkennzeichen = (eheKomps[1] || '').trim();
      if (!abrechnungscode || !tarifkennzeichen) {
        const err = new Error('Abrechnungscode oder Tarifkennzeichen im EHE-Segment fehlen.');
        err.status = 422;
        err.code = 'MISSING_MANDATORY_FIELD';
        throw err;
      }

      if (!tarifData) {
        tarifData = { abrechnungscode, tarifkennzeichen };
      } else if (tarifData.tarifkennzeichen !== tarifkennzeichen || tarifData.abrechnungscode !== abrechnungscode) {
        const err = new Error(
          `Mehrere unterschiedliche Tarife (${tarifData.abrechnungscode}:${tarifData.tarifkennzeichen} vs. ${abrechnungscode}:${tarifkennzeichen}) ` +
          `innerhalb eines Belegs in der Ursprungs-DTA werden für Zuzahlungsforderungen nicht unterstützt.`
        );
        err.status = 422;
        err.code = 'MULTIPLE_TARIFFS_NOT_SUPPORTED';
        throw err;
      }

      const positionsnummer = unescapeEdifact(s.fields[2] || '').trim();
      if (!positionsnummer) {
        const err = new Error('EHE-Segment ohne Positionsnummer gefunden.');
        err.status = 422;
        err.code = 'MISSING_MANDATORY_FIELD';
        throw err;
      }

      const anzahlRaw = unescapeEdifact(s.fields[3] || '').trim();
      if (!anzahlRaw) {
        const err = new Error(`EHE-Position ${positionsnummer}: Fehlende Mengenangabe.`);
        err.status = 422;
        err.code = 'MISSING_MANDATORY_FIELD';
        throw err;
      }
      const anzahl = parseGermanAmount(anzahlRaw);
      if (Number.isNaN(anzahl) || anzahl <= 0) {
        const err = new Error(`EHE-Position ${positionsnummer}: Ungültige oder nicht-positive Menge "${anzahlRaw}".`);
        err.status = 422;
        err.code = 'INVALID_AMOUNT';
        throw err;
      }

      const betragRaw = unescapeEdifact(s.fields[4] || '').trim();
      if (!betragRaw) {
        const err = new Error(`EHE-Position ${positionsnummer}: Fehlender Einzelbetrag.`);
        err.status = 422;
        err.code = 'MISSING_MANDATORY_FIELD';
        throw err;
      }
      const einzelbetrag = parseGermanAmount(betragRaw);
      if (Number.isNaN(einzelbetrag) || einzelbetrag <= 0) {
        const err = new Error(`EHE-Position ${positionsnummer}: Ungültiger oder nicht-positiver Einzelbetrag "${betragRaw}".`);
        err.status = 422;
        err.code = 'INVALID_AMOUNT';
        throw err;
      }

      const datumLeistungRaw = unescapeEdifact(s.fields[5] || '').trim();
      const datumLeistung = toIsoDate(datumLeistungRaw);
      if (!datumLeistung) {
        const err = new Error(`EHE-Position ${positionsnummer}: Ungültiges Leistungsdatum "${datumLeistungRaw}".`);
        err.status = 422;
        err.code = 'INVALID_CALENDAR_DATE';
        throw err;
      }

      // Historischer Zuzahlungsbetrag pro Position: Feld 6 muss zwingend vorhanden sein
      const zuzahlungFeld = s.fields[6];
      if (zuzahlungFeld === undefined || zuzahlungFeld === null || String(zuzahlungFeld).trim() === '') {
        const err = new Error(`EHE-Position ${positionsnummer}: Fehlender Zuzahlungsbetrag (Feld 6).`);
        err.status = 422;
        err.code = 'MISSING_EHE_COPAY';
        throw err;
      }
      const zuzahlungProPos = parseGermanAmount(unescapeEdifact(zuzahlungFeld));
      if (Number.isNaN(zuzahlungProPos) || zuzahlungProPos < 0) {
        const err = new Error(`EHE-Position ${positionsnummer}: Ungültiger oder negativer Zuzahlungsbetrag "${zuzahlungFeld}".`);
        err.status = 422;
        err.code = 'INVALID_AMOUNT';
        throw err;
      }

      const kilometer = unescapeEdifact(s.fields[7] || '');

      currentSession = {
        positionsnummer,
        datumLeistung,
        anzahl,
        einzelbetrag,
        zuzahlungProPos,
        kilometer,
        text: '',
        hasTxt: false,
        mwsSatz: null,
        mwsBetrag: null,
        hasMws: false,
      };
      allSessions.push(currentSession);
      continue;
    }

    if (s.tag === 'TXT') {
      if (!currentSession) {
        const err = new Error('TXT-Segment ohne vorhergehendes EHE-Segment.');
        err.status = 422;
        err.code = 'ORPHANED_TXT_SEGMENT';
        throw err;
      }
      if (currentSession.hasTxt) {
        const err = new Error(
          'Mehrere TXT-Segmente zu einer EHE-Leistungsposition werden vom VKZ-03-Builder nicht unterstützt ' +
          '(weitere TXT-Segmente gingen verloren).'
        );
        err.status = 422;
        err.code = 'UNSUPPORTED_ORIGINAL_SEGMENT';
        throw err;
      }
      if (s.fields.length !== 2) {
        const err = new Error(`Ungültige Feldanzahl im TXT-Segment: genau 1 Datenfeld erforderlich.`);
        err.status = 422;
        err.code = 'INVALID_SEGMENT_SHAPE';
        throw err;
      }
      currentSession.text = unescapeEdifact(s.fields[1] || '');
      currentSession.hasTxt = true;
      continue;
    }

    if (s.tag === 'MWS') {
      if (!currentSession) {
        const err = new Error('MWS-Segment ohne vorhergehendes EHE-Segment.');
        err.status = 422;
        err.code = 'ORPHANED_MWS_SEGMENT';
        throw err;
      }
      if (currentSession.hasMws) {
        const err = new Error(
          'Mehrere MWS-Segmente zu einer EHE-Leistungsposition werden vom VKZ-03-Builder nicht unterstützt.'
        );
        err.status = 422;
        err.code = 'UNSUPPORTED_ORIGINAL_SEGMENT';
        throw err;
      }
      if (s.fields.length !== 3) {
        const err = new Error(`Ungültige Feldanzahl im MWS-Segment: genau 2 Datenfelder erforderlich.`);
        err.status = 422;
        err.code = 'INVALID_SEGMENT_SHAPE';
        throw err;
      }
      const satz = parseGermanAmount(unescapeEdifact(s.fields[1] || ''));
      const betrag = parseGermanAmount(unescapeEdifact(s.fields[2] || ''));
      if (Number.isNaN(satz) || satz < 0 || Number.isNaN(betrag) || betrag < 0) {
        const err = new Error('Ungültiger Steuersatz oder Steuerbetrag im MWS-Segment.');
        err.status = 422;
        err.code = 'INVALID_AMOUNT';
        throw err;
      }
      currentSession.mwsSatz = satz;
      currentSession.mwsBetrag = betrag;
      currentSession.hasMws = true;
      continue;
    }
  }

  if (allSessions.length === 0) {
    const err = new Error('Keine EHE-Leistungspositionen in der Ursprungs-SLLA-Nachricht gefunden.');
    err.status = 422;
    err.code = 'NO_ORIGINAL_SESSIONS';
    throw err;
  }

  if (selectedSessionIndices !== null && selectedSessionIndices !== undefined) {
    if (!Array.isArray(selectedSessionIndices)) {
      const err = new Error('selectedSessionIndices muss ein Array von Indizes sein.');
      err.status = 422;
      err.code = 'INVALID_SESSION_INDEX';
      throw err;
    }
    const seenIndices = new Set();
    for (const idx of selectedSessionIndices) {
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= allSessions.length) {
        const err = new Error(`Ungültiger Sitzungsindex in selectedSessionIndices: ${idx}.`);
        err.status = 422;
        err.code = 'INVALID_SESSION_INDEX';
        throw err;
      }
      if (seenIndices.has(idx)) {
        const err = new Error(`Doppelte Sitzungsindizes in selectedSessionIndices sind unzulässig: Index ${idx} mehrfach angegeben.`);
        err.status = 422;
        err.code = 'DUPLICATE_SESSION_INDICES';
        throw err;
      }
      seenIndices.add(idx);
    }
  }

  // 9. BES-Werte exakt parsen (Pflichtfelder 1..4 müssen explizit vorhanden sein, kein || 0,00)
  if (besSeg.fields.length < 5 || besSeg.fields.length > 6) {
    const err = new Error(
      `Ungültige Feldanzahl im BES-Segment: ${besSeg.fields.length - 1} Felder vorhanden. Genau 4 oder 5 Datenfelder erforderlich.`
    );
    err.status = 422;
    err.code = 'INVALID_BES_SEGMENT';
    throw err;
  }

  for (let i = 1; i <= 4; i++) {
    const rawVal = besSeg.fields[i];
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
      const err = new Error(`Pflichtfeld ${i} im BES-Segment fehlt oder ist leer.`);
      err.status = 422;
      err.code = 'INVALID_BES_SEGMENT';
      throw err;
    }
  }

  const originalBrutto = parseGermanAmount(unescapeEdifact(besSeg.fields[1]));
  const originalGesZuzahlung = parseGermanAmount(unescapeEdifact(besSeg.fields[2]));
  const originalProzZuzahlung = parseGermanAmount(unescapeEdifact(besSeg.fields[3]));
  const originalPauschZuzahlung = parseGermanAmount(unescapeEdifact(besSeg.fields[4]));

  if (Number.isNaN(originalBrutto) || originalBrutto <= 0) {
    const err = new Error('Ungültiger oder nicht-positiver Bruttobetrag im BES-Segment.');
    err.status = 422;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  if (Number.isNaN(originalGesZuzahlung) || originalGesZuzahlung < 0 ||
      Number.isNaN(originalProzZuzahlung) || originalProzZuzahlung < 0 ||
      Number.isNaN(originalPauschZuzahlung) || originalPauschZuzahlung < 0) {
    const err = new Error('Ungültige oder negative Zuzahlungsbeträge im BES-Segment.');
    err.status = 422;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  // Exakte Rekonstruktionsprüfungen:
  // 1. gross == sum(all EHE price * qty)
  let calcBrutto = 0;
  for (const s of allSessions) {
    calcBrutto += s.einzelbetrag * s.anzahl;
  }
  calcBrutto = Math.round(calcBrutto * 100) / 100;
  if (Math.round(calcBrutto * 100) !== Math.round(originalBrutto * 100)) {
    const err = new Error(`BES-Bruttosumme (${originalBrutto.toFixed(2)} €) stimmt nicht mit der Summe der EHE-Positionen (${calcBrutto.toFixed(2)} €) überein.`);
    err.status = 422;
    err.code = 'GROSS_MISMATCH';
    throw err;
  }

  // 2. Summe der expliziten EHE-Zuzahlungen muss exakt mit originalProzZuzahlung übereinstimmen
  let calcProz = 0;
  for (const s of allSessions) {
    calcProz += s.zuzahlungProPos * s.anzahl;
  }
  calcProz = Math.round(calcProz * 100) / 100;
  if (Math.round(calcProz * 100) !== Math.round(originalProzZuzahlung * 100)) {
    const err = new Error(
      `Summe der EHE-Zuzahlungsbeträge (${calcProz.toFixed(2)} €) stimmt nicht mit der prozentualen Zuzahlung im BES-Segment (${originalProzZuzahlung.toFixed(2)} €) überein.`
    );
    err.status = 422;
    err.code = 'COPAY_SUM_MISMATCH';
    throw err;
  }

  // 3. Pauschale: pausch == Math.min(10, gross - proz) nur für KZ3 zulässig; bei anderen kein ungeprüfter Anspruch
  if (origZuzahlungskennzeichen === '3') {
    const expectedPausch = Math.round(Math.min(10, Math.max(0, originalBrutto - originalProzZuzahlung)) * 100) / 100;
    if (Math.round(originalPauschZuzahlung * 100) !== Math.round(expectedPausch * 100)) {
      const err = new Error(
        `BES-Pauschale (${originalPauschZuzahlung.toFixed(2)} €) stimmt nicht mit gesetzlicher Zuzahlung (erwartet: ${expectedPausch.toFixed(2)} €) überein.`
      );
      err.status = 422;
      err.code = 'PAUSCHALE_MISMATCH';
      throw err;
    }
  } else {
    if (originalPauschZuzahlung > 0) {
      const err = new Error(`Pauschale Zuzahlung im BES-Segment ist bei ursprünglichem Kennzeichen "${origZuzahlungskennzeichen}" nicht zulässig.`);
      err.status = 422;
      err.code = 'UNPROVEN_COPAY_CLAIM';
      throw err;
    }
  }

  // 4. Gesamtzuzahlung == proz + pausch
  if (Math.round((originalProzZuzahlung + originalPauschZuzahlung) * 100) !== Math.round(originalGesZuzahlung * 100)) {
    const err = new Error(
      `BES-Gesamtzuzahlung (${originalGesZuzahlung.toFixed(2)} €) stimmt nicht mit Summe aus Prozent- (${originalProzZuzahlung.toFixed(2)} €) und Pauschalbetrag (${originalPauschZuzahlung.toFixed(2)} €) überein.`
    );
    err.status = 422;
    err.code = 'COPAY_SUM_MISMATCH';
    throw err;
  }

  // 5. Geldabstimmung mit dem Schnappschuss (abrechnung_zeile)
  if (
    snapBruttoCents !== Math.round(originalBrutto * 100) ||
    snapZuzahlungCents !== Math.round(originalGesZuzahlung * 100) ||
    snapNettoCents !== Math.round((originalBrutto - originalGesZuzahlung) * 100)
  ) {
    const err = new Error(
      `Geldbeträge im Schnappschuss (Brutto: ${snapBrutto.toFixed(2)} €, Zuzahlung: ${snapZuzahlung.toFixed(2)} €, Netto: ${snapNetto.toFixed(2)} €) ` +
      `stimmen nicht exakt mit der Ursprungs-DTA überein (Brutto: ${originalBrutto.toFixed(2)} €, Zuzahlung: ${originalGesZuzahlung.toFixed(2)} €).`
    );
    err.status = 422;
    err.code = 'SNAPSHOT_MONEY_MISMATCH';
    throw err;
  }

  // 10. Auditierter Nachweis & Zuzahlungskennzeichen für VKZ 03
  if (originalGesZuzahlung <= 0) {
    const err = new Error(
      'In der Ursprungsrechnung wurde keine Zuzahlung abgezogen (Zuzahlungsbetrag ist 0,00 €). ' +
      'Eine Zuzahlungsforderung ist nicht möglich.'
    );
    err.status = 422;
    err.code = 'NO_ORIGINAL_COPAYMENT';
    throw err;
  }

  const today = berlinHeute();

  function validateCommonProof(proof, expectedArt, unverifiedCode) {
    if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
      const err = new Error('Fehlender Nachweis für die Zuzahlungsforderung.');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    // SQL-Allowlist für Schlüssel
    let allowedKeys;
    if (expectedArt === 'belastungsgrenze62') {
      allowedKeys = ALLOWED_KEYS_KZ1;
    } else if (expectedArt === 'zahlungsaufforderung43c') {
      allowedKeys = ALLOWED_KEYS_KZ2;
    } else if (expectedArt === 'statuswechsel_jahreswechsel') {
      allowedKeys = ALLOWED_KEYS_KZ5;
    } else {
      const err = new Error(`Unbekannte Nachweisart: "${expectedArt}".`);
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    const proofKeys = Object.keys(proof);
    for (const k of proofKeys) {
      if (!allowedKeys.has(k)) {
        const err = new Error(`Unerwarteter Schlüssel "${k}" im Nachweisobjekt (gemäß SQL-Allowlist).`);
        err.status = 422;
        err.code = unverifiedCode;
        throw err;
      }
    }
    for (const k of allowedKeys) {
      if (!(k in proof)) {
        const err = new Error(`Pflichtfeld "${k}" im Nachweisobjekt fehlt.`);
        err.status = 422;
        err.code = unverifiedCode;
        throw err;
      }
    }

    if (proof.art !== expectedArt) {
      const err = new Error(`Ungültige Nachweisart: "${proof.art}". Erwartet: "${expectedArt}".`);
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    if (
      typeof proof.referenz !== 'string' ||
      !proof.referenz ||
      proof.referenz.trim() !== proof.referenz ||
      proof.referenz.length > 240
    ) {
      const err = new Error('Ungültige Nachweisreferenz (nicht-leer, getrimmt, maximal 240 Zeichen erforderlich).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    let ab = null;
    let bis = null;
    if (expectedArt !== 'zahlungsaufforderung43c') {
      if (
        typeof proof.gueltigAb !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(proof.gueltigAb) ||
        !istStichtag(proof.gueltigAb)
      ) {
        const err = new Error(`Ungültiges Beginn-Datum (gueltigAb) im Nachweis: "${proof.gueltigAb}".`);
        err.status = 422;
        err.code = unverifiedCode;
        throw err;
      }
      if (
        typeof proof.gueltigBis !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(proof.gueltigBis) ||
        !istStichtag(proof.gueltigBis)
      ) {
        const err = new Error(`Ungültiges Ende-Datum (gueltigBis) im Nachweis: "${proof.gueltigBis}".`);
        err.status = 422;
        err.code = unverifiedCode;
        throw err;
      }
      ab = proof.gueltigAb;
      bis = proof.gueltigBis;
      if (ab > bis) {
        const err = new Error(`Ungültiger Nachweiszeitraum: gueltigAb (${ab}) muss vor oder gleich gueltigBis (${bis}) liegen.`);
        err.status = 422;
        err.code = unverifiedCode;
        throw err;
      }
    }

    if (
      typeof proof.geprueftAm !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(proof.geprueftAm) ||
      !istStichtag(proof.geprueftAm)
    ) {
      const err = new Error(`Prüfdatum (${proof.geprueftAm}) ist kein gültiger ISO-Kalendertag (YYYY-MM-DD).`);
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    const geprueftAm = proof.geprueftAm;
    if (geprueftAm > today) {
      const err = new Error(`Prüfdatum (${proof.geprueftAm}) ist ungültig oder liegt in der Zukunft (heutiger Berliner Tag: ${today}).`);
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    // Strikte UTC-Z-Zeitstempel-Prüfung (SQL-Vertrag)
    if (typeof proof.geprueftZeitpunkt !== 'string' || !UTC_Z_TIMESTAMP_REGEX.test(proof.geprueftZeitpunkt)) {
      const err = new Error('Ungültiger Prüfzeitpunkt (strikter UTC-Z-Zeitstempel erforderlich).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    const datePart = proof.geprueftZeitpunkt.slice(0, 10);
    if (!istStichtag(datePart)) {
      const err = new Error(`Ungültiger Kalendertag im Prüfzeitpunkt: "${datePart}".`);
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    const hh = Number(proof.geprueftZeitpunkt.slice(11, 13));
    const mm = Number(proof.geprueftZeitpunkt.slice(14, 16));
    const ss = Number(proof.geprueftZeitpunkt.slice(17, 19));
    if (hh > 23 || mm > 59 || ss > 59) {
      const err = new Error('Ungültige Uhrzeit im Prüfzeitpunkt (24h-Guard fehlgeschlagen).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    const checkTs = new Date(proof.geprueftZeitpunkt);
    if (Number.isNaN(checkTs.getTime())) {
      const err = new Error('Ungültiger Prüfzeitpunkt (nicht parsebar).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    // Keine zukünftigen Zeitstempel zulassen (strikte Prüfung ohne Toleranz)
    if (checkTs.getTime() > Date.now()) {
      const err = new Error('Prüfzeitpunkt darf nicht in der Zukunft liegen.');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    // Tagesgleichheit in Berliner Zeit
    const checkDayBerlin = berlinHeute(checkTs);
    if (checkDayBerlin !== geprueftAm) {
      const err = new Error(
        `Prüfzeitpunkt (${checkDayBerlin} Berliner Zeit) stimmt nicht mit dem Prüfdatum (${geprueftAm}) überein.`
      );
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    if (!proof.prueferId || typeof proof.prueferId !== 'string' || !UUID_REGEX.test(proof.prueferId.trim())) {
      const err = new Error('Ungültige Prüfer-ID (UUID erforderlich).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    // Mandanten-/Inhaber-Bindung (Pflichtfeld in Ursprungsdaten, darf niemals übersprungen werden)
    const headerOwnerId = sourceHeader?.owner_id ?? sourceHeader?.ownerId;
    const zeileOwnerId = sourceZeile?.owner_id ?? sourceZeile?.ownerId;

    if (!headerOwnerId && !zeileOwnerId) {
      const err = new Error('Ursprungsdaten enthalten keine gültige Mandanten- bzw. Inhaber-ID (owner_id UUID).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    if (headerOwnerId && (typeof headerOwnerId !== 'string' || !UUID_REGEX.test(headerOwnerId.trim()))) {
      const err = new Error('Ungültige Mandanten- bzw. Inhaber-ID im Ursprungskopf (owner_id UUID erforderlich).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    if (zeileOwnerId && (typeof zeileOwnerId !== 'string' || !UUID_REGEX.test(zeileOwnerId.trim()))) {
      const err = new Error('Ungültige Mandanten- bzw. Inhaber-ID in der Ursprungszeile (owner_id UUID erforderlich).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    if (headerOwnerId && zeileOwnerId && headerOwnerId.trim().toLowerCase() !== zeileOwnerId.trim().toLowerCase()) {
      const err = new Error('Widersprüchliche Inhaber/Mandanten-IDs in Ursprungskopf und Ursprungszeile.');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    const resolvedOwnerId = (headerOwnerId || zeileOwnerId).trim().toLowerCase();
    if (proof.prueferId.trim().toLowerCase() !== resolvedOwnerId) {
      const err = new Error('Prüfer-ID stimmt nicht mit dem Inhaber/Mandanten der Ursprungsdaten überein.');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    // Patienten-Bindung (Pflichtfeld in Ursprungsdaten, darf niemals übersprungen werden)
    if (!proof.patientId || typeof proof.patientId !== 'string' || !UUID_REGEX.test(proof.patientId.trim())) {
      const err = new Error('Ungültige Patienten-ID im Nachweis (UUID erforderlich).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    const patientCandidates = [
      { name: 'sourceZeile.patient_id', val: sourceZeile?.patient_id },
      { name: 'sourceZeile.patientId', val: sourceZeile?.patientId },
      { name: 'verifiedSourcePatientId', val: verifiedSourcePatientId },
      { name: 'sourcePatientId', val: sourcePatientId },
    ].filter(c => c.val !== undefined && c.val !== null && c.val !== '');

    if (patientCandidates.length === 0) {
      const err = new Error('Ursprungsdaten enthalten keine gültige Patienten-ID (patient_id UUID).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    for (const c of patientCandidates) {
      if (typeof c.val !== 'string' || !UUID_REGEX.test(c.val.trim())) {
        const err = new Error(`Ungültige Patienten-ID in ${c.name} (UUID erforderlich).`);
        err.status = 422;
        err.code = unverifiedCode;
        throw err;
      }
    }

    const firstPatient = patientCandidates[0].val.trim().toLowerCase();
    for (const c of patientCandidates) {
      if (c.val.trim().toLowerCase() !== firstPatient) {
        const err = new Error(`Widersprüchliche Patienten-IDs in Ursprungsdaten: ${c.name} stimmt nicht überein.`);
        err.status = 422;
        err.code = unverifiedCode;
        throw err;
      }
    }

    if (proof.patientId.trim().toLowerCase() !== firstPatient) {
      const err = new Error('Patienten-ID im Nachweis stimmt nicht mit dem Ursprungsbeleg überein.');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    if (
      typeof proof.kostentraegerIk !== 'string' ||
      !/^\d{9}$/.test(proof.kostentraegerIk)
    ) {
      const err = new Error(`Ungültige Kostenträger-IK im Nachweis: "${proof.kostentraegerIk}" (9-stelliger Ziffernstring erforderlich).`);
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    if (proof.kostentraegerIk !== origKostentraegerIk) {
      const err = new Error(`Kostenträger-IK im Nachweis (${proof.kostentraegerIk}) stimmt nicht mit der DTA (${origKostentraegerIk}) überein.`);
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    if (proof.bestaetigt !== true) {
      const err = new Error('Der Nachweis muss explizit bestätigt sein (bestaetigt=true).');
      err.status = 422;
      err.code = unverifiedCode;
      throw err;
    }

    return { ab, bis, geprueftAm };
  }

  let newZuzahlungskennzeichen = '2';
  let claimAmount = originalGesZuzahlung;
  let prozClaim = originalProzZuzahlung;
  let pauschClaim = originalPauschZuzahlung;
  let finalSessions = allSessions.slice();

  if (canonicalReason === 'KZ2') {
    // Versicherter verweigert Zahlung trotz Aufforderung (§ 43c SGB V)
    newZuzahlungskennzeichen = '2';

    // Keine Teilselektion für Grund 2 zulässig
    if (Array.isArray(selectedSessionIndices)) {
      const canonicalIndices = allSessions.map((_, i) => i);
      if (
        selectedSessionIndices.length !== canonicalIndices.length ||
        !selectedSessionIndices.slice().sort((a, b) => a - b).every((idx, i) => idx === canonicalIndices[i])
      ) {
        const err = new Error('Für Grund 2 werden keine Teilselektionen unterstützt. Es müssen alle Positionen abgerechnet werden.');
        err.status = 422;
        err.code = 'PARTIAL_SELECTION_REJECTED';
        throw err;
      }
    }

    validateCommonProof(nachweisPruefung, 'zahlungsaufforderung43c', 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED');

    // Zusatzfelder für Grund 2
    if (
      typeof nachweisPruefung.versandDatum !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(nachweisPruefung.versandDatum) ||
      !istStichtag(nachweisPruefung.versandDatum)
    ) {
      const err = new Error(`Ungültiges Versanddatum (${nachweisPruefung.versandDatum}).`);
      err.status = 422;
      err.code = 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED';
      throw err;
    }

    if (nachweisPruefung.versandDatum > today) {
      const err = new Error(`Versanddatum (${nachweisPruefung.versandDatum}) darf nicht in der Zukunft liegen.`);
      err.status = 422;
      err.code = 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED';
      throw err;
    }

    if (nachweisPruefung.versandDatum > nachweisPruefung.geprueftAm) {
      const err = new Error(`Versanddatum (${nachweisPruefung.versandDatum}) darf nicht nach dem Prüfdatum (${nachweisPruefung.geprueftAm}) liegen.`);
      err.status = 422;
      err.code = 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED';
      throw err;
    }

    const validVersandArten = ['post', 'elektronisch', 'persoenlich'];
    if (!validVersandArten.includes(nachweisPruefung.versandArt)) {
      const err = new Error(`Ungültige Versandart: "${nachweisPruefung.versandArt}". Zulässig sind: post, elektronisch, persoenlich.`);
      err.status = 422;
      err.code = 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED';
      throw err;
    }

    if (nachweisPruefung.nachweisBeigefuegtBestaetigt !== true) {
      const err = new Error('Die Beifügung des Nachweises muss bestätigt sein (nachweisBeigefuegtBestaetigt=true).');
      err.status = 422;
      err.code = 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED';
      throw err;
    }

    if (nachweisPruefung.erfolgloserEinzugBestaetigt !== true) {
      const err = new Error('Der erfolglose Einzug muss bestätigt sein (erfolgloserEinzugBestaetigt=true).');
      err.status = 422;
      err.code = 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED';
      throw err;
    }
  } else if (canonicalReason === 'KZ1') {
    // Nachträgliche Befreiung (§ 62 SGB V)
    newZuzahlungskennzeichen = '1';

    // Keine Teilselektion für Grund 1 zulässig
    if (Array.isArray(selectedSessionIndices)) {
      const canonicalIndices = allSessions.map((_, i) => i);
      if (
        selectedSessionIndices.length !== canonicalIndices.length ||
        !selectedSessionIndices.slice().sort((a, b) => a - b).every((idx, i) => idx === canonicalIndices[i])
      ) {
        const err = new Error('Für Grund 1 werden keine Teilselektionen unterstützt. Es müssen alle Positionen abgerechnet werden.');
        err.status = 422;
        err.code = 'PARTIAL_SELECTION_REJECTED';
        throw err;
      }
    }

    const { ab, bis } = validateCommonProof(nachweisPruefung, 'belastungsgrenze62', 'EXEMPTION_EVIDENCE_UNVERIFIED');

    // Alle EHE-Behandlungsdaten müssen innerhalb des Befreiungszeitraums liegen
    for (const s of allSessions) {
      if (s.datumLeistung < ab || s.datumLeistung > bis) {
        const err = new Error(
          `Behandlungsdatum ${s.datumLeistung} liegt außerhalb des verifizierten Befreiungszeitraums (${ab} bis ${bis}).`
        );
        err.status = 422;
        err.code = 'EXEMPTION_EVIDENCE_UNVERIFIED';
        throw err;
      }
    }
  } else if (canonicalReason === 'KZ5') {
    // Jahresübergang (von befreit nach pflichtig)
    newZuzahlungskennzeichen = '5';

    const { ab, bis } = validateCommonProof(nachweisPruefung, 'statuswechsel_jahreswechsel', 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED');

    // Zusatzfelder für Grund 5
    if (!nachweisPruefung.statusWechselDatum) {
      const err = new Error('Statuswechseldatum (statusWechselDatum) ist für Grund 5 zwingend erforderlich.');
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    if (
      typeof nachweisPruefung.statusWechselDatum !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(nachweisPruefung.statusWechselDatum) ||
      !istStichtag(nachweisPruefung.statusWechselDatum)
    ) {
      const err = new Error(`Statuswechseldatum (${nachweisPruefung.statusWechselDatum}) ist kein gültiger ISO-Kalendertag.`);
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    const statusChange = nachweisPruefung.statusWechselDatum;
    if (statusChange > today) {
      const err = new Error(`Statuswechseldatum (${statusChange}) darf nicht in der Zukunft liegen (heutiger Berliner Tag: ${today}).`);
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    if (statusChange <= bis) {
      const err = new Error(`Statuswechseldatum (${statusChange}) muss nach dem Ende der vorherigen Befreiung (${bis}) liegen.`);
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    if (
      typeof nachweisPruefung.zahlungsaufforderungReferenz !== 'string' ||
      !nachweisPruefung.zahlungsaufforderungReferenz ||
      nachweisPruefung.zahlungsaufforderungReferenz.trim() !== nachweisPruefung.zahlungsaufforderungReferenz ||
      nachweisPruefung.zahlungsaufforderungReferenz.length > 240
    ) {
      const err = new Error('Ungültige Zahlungsaufforderungsreferenz für Jahresübergang (nicht-leer, getrimmt, maximal 240 Zeichen).');
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    if (!nachweisPruefung.zahlungsaufforderungDatum) {
      const err = new Error('Datum der Zahlungsaufforderung ist für Grund 5 zwingend erforderlich.');
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    if (
      typeof nachweisPruefung.zahlungsaufforderungDatum !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(nachweisPruefung.zahlungsaufforderungDatum) ||
      !istStichtag(nachweisPruefung.zahlungsaufforderungDatum)
    ) {
      const err = new Error(`Datum der Zahlungsaufforderung (${nachweisPruefung.zahlungsaufforderungDatum}) ist kein gültiger ISO-Kalendertag.`);
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    const aufforderungDatum = nachweisPruefung.zahlungsaufforderungDatum;
    if (aufforderungDatum < statusChange) {
      const err = new Error(`Zahlungsaufforderungsdatum (${aufforderungDatum}) darf nicht vor dem Statuswechseldatum (${statusChange}) liegen.`);
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    if (aufforderungDatum > nachweisPruefung.geprueftAm) {
      const err = new Error(`Zahlungsaufforderungsdatum (${aufforderungDatum}) darf nicht nach dem Nachweisdatum (${nachweisPruefung.geprueftAm}) liegen.`);
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    if (aufforderungDatum > today) {
      const err = new Error(`Zahlungsaufforderungsdatum (${aufforderungDatum}) darf nicht in der Zukunft liegen (heutiger Berliner Tag: ${today}).`);
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }
    if (nachweisPruefung.originalAbzugBestaetigt !== true) {
      const err = new Error('Der ursprüngliche Kassenabzug muss bestätigt sein (originalAbzugBestaetigt=true).');
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }

    if (!Array.isArray(selectedSessionIndices) || selectedSessionIndices.length === 0) {
      const err = new Error('Für Jahresübergang (Grund 5) müssen die betroffenen Positionsindizes explizit übergeben werden.');
      err.status = 422;
      err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
      throw err;
    }

    const positiveIndices = [];
    for (let i = 0; i < allSessions.length; i++) {
      if (allSessions[i].zuzahlungProPos > 0) {
        positiveIndices.push(i);
      }
    }

    if (positiveIndices.length === 0) {
      const err = new Error('Keine ursprünglich zuzahlungspflichtigen Positionen im Beleg gefunden.');
      err.status = 422;
      err.code = 'NO_ORIGINAL_COPAYMENT';
      throw err;
    }

    // Exakte Selektion aller positiven Positionen erforderlich (keine Teil-Pauschalenallokation oder Teilmengen)
    const sortedSelected = selectedSessionIndices.slice().sort((a, b) => a - b);
    if (sortedSelected.length !== positiveIndices.length || !sortedSelected.every((idx, i) => idx === positiveIndices[i])) {
      const err = new Error(
        `Für Grund 5 müssen exakt alle ${positiveIndices.length} ursprünglich zuzahlungspflichtigen Positionen ausgewählt werden. Teilselektionen werden nicht unterstützt.`
      );
      err.status = 422;
      err.code = 'PARTIAL_SELECTION_REJECTED';
      throw err;
    }

    // Datumsprüfung der ausgewählten Positionen: alle müssen >= statusChange und > bis liegen
    for (const idx of sortedSelected) {
      const s = allSessions[idx];
      if (s.datumLeistung < statusChange || s.datumLeistung <= bis) {
        const err = new Error(
          `Position ${s.positionsnummer} am ${s.datumLeistung} liegt vor dem Statuswechseldatum (${statusChange}) oder innerhalb der vorherigen Befreiung.`
        );
        err.status = 422;
        err.code = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';
        throw err;
      }
    }
  }

  // 11. Rekonstruiertes Rezeptobjekt für den Builder
  const prescription = {
    patient: {
      kvnr: versichertennummer,
      versichertenstatus,
      nachname,
      vorname,
      geburtsdatum,
      strasse,
      plz,
      ort,
      laenderkennzeichen,
      belegnummer,
      beleginformation,
      kennzeichenBesondereVersorgung,
    },
    doctor: {
      lanr,
      bsnr,
    },
    verordnung: {
      ausstellungsdatum,
      icd10: icd10Liste[0] || '',
      icd10Liste,
      diagnosetext,
      artDerDiagnose: artDerDiagnose || undefined,
      diagnosegruppe,
      verordnungsart,
      verordnungsbesonderheiten,
      unfallkennzeichen,
      bvgSonstigesSer,
      therapieberichtAngefordert,
      hausbesuch,
      leitsymptomatik,
      patLeitsymptomatik,
      dringend,
      heilmittelBereich,
      therapiefrequenz,
      zuzahlungskennzeichen: newZuzahlungskennzeichen,
      kostentraegerIk: origKostentraegerIk,
      krankenkasseIk: origKrankenkasseIk,
      genehmigung,
      evoId,
      imageLink,
    },
    tarif: tarifData,
    sessions: finalSessions,
    urspruenglich: {
      ikLeistungserbringer: origSenderIk,
      sammelRechnungsnummer: origSammelRechnungsnummer,
      einzelRechnungsnummer: origEinzelRechnungsnummer,
      rechnungsdatum: origRechnungsdatum,
      belegnummer,
      origIkLeistungserbringer: origSenderIk,
      origSammelRechnungsnummer: origSammelRechnungsnummer,
      origEinzelRechnungsnummer: origEinzelRechnungsnummer,
      origRechnungsdatum,
      origBelegnummer: belegnummer,
    },
  };

  return {
    prescription,
    claimAmount,
    prozClaim,
    pauschClaim,
    ursprung: {
      senderIk: origSenderIk,
      kostentraegerIk: origKostentraegerIk,
      krankenkasseIk: origKrankenkasseIk,
      sammelRechnungsnummer: origSammelRechnungsnummer,
      einzelRechnungsnummer: origEinzelRechnungsnummer,
      rechnungsdatum: origRechnungsdatum,
      belegnummer,
      originalBrutto,
      originalGesZuzahlung,
      originalProzZuzahlung,
      originalPauschZuzahlung,
    },
    reason: canonicalReason,
    selectedSessions: finalSessions,
  };
}
