// § 302 SGB V Preflight Validator
//
// Run before uploading a DTA file to DMRZ / Datenannahmestelle.
// Mirrors the ~30 most common DMRZ rejection rules so the practice doesn't
// waste a submission cycle on trivial format errors.
//
// IMPORTANT: passing preflight is NOT a guarantee of acceptance. The real
// Annahmestelle additionally verifies:
//   - IK validity against the live Kostenträgerdatei (we can't replicate without daily refresh)
//   - ITSG digital signature (Sprint 9-10)
//   - Cross-file uniqueness (Datennummer per IK pair across all time)
// But it catches everything that's deterministic from the file content alone.
//
// Returns: { ok: boolean, errors: [{code, severity, where, message}], warnings: [...] }

import {
  VERARBEITUNGSKENNZEICHEN,
  VERORDNUNGSART_HEILMITTEL,
  ZUZAHLUNGSKENNZEICHEN,
  TARIFBEREICH,
  ABRECHNUNGSCODE,
} from '../codes/anlage3_v22.js';

// ---------------------------------------------------------------------------
// Atomic field validators
// ---------------------------------------------------------------------------

// IK Prüfziffer per ARGE-IK spec (Modulo 10 algorithm):
//   - Position 1-2: Klassifikation (10..69 = Kostenträger, 80..99 = Leistungserbringer, 70..79 = Sonstige)
//   - Position 3-8: laufende Nummer
//   - Position 9:   Prüfziffer
// Algorithm: digits at pos 3..8 multiplied by [2,1,2,1,2,1]; cross-sum
// of products; sum mod 10 must equal Prüfziffer.
export function isValidIkChecksum(ik) {
  if (!/^\d{9}$/.test(ik)) return false;
  const weights = [2, 1, 2, 1, 2, 1];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    const prod = Number(ik[i + 2]) * weights[i];
    sum += prod >= 10 ? (prod - 9) : prod;  // digit-sum of product
  }
  return (sum % 10) === Number(ik[8]);
}

export function ikKlassifikation(ik) {
  if (!/^\d{9}$/.test(ik)) return null;
  const pre = Number(ik.slice(0, 2));
  if (pre >= 10 && pre <= 69) return 'kostentraeger';
  if (pre >= 70 && pre <= 79) return 'sonstige';
  if (pre >= 80 && pre <= 99) return 'leistungserbringer';
  return null;
}

// KVNR (Krankenversichertennummer, lebenslang): 1 capital letter + 9 digits.
// Last digit is Prüfziffer (Modulo 10 on letter-coded value, but DMRZ accepts
// format-only check from upstream — we mirror that).
export function isValidKvnr(kvnr) {
  return /^[A-Z]\d{9}$/.test(kvnr || '');
}

// Versichertenstatus: 5 chars, first digit 1/3/5/9 (Mitglied/Familie/Rentner/sonst).
export function isValidVersichertenstatus(vs) {
  return /^[1359]\d{4}$/.test(vs || '');
}

// LANR (Lebenslange Arztnummer): 9 digits, last digit Prüfziffer.
// 999999900 = dummy used when LANR unknown (allowed by §302).
export function isValidLanr(lanr) {
  if (lanr === '999999900') return true;
  if (!/^\d{9}$/.test(lanr || '')) return false;
  // Mod-10 check: pos 1-6 with alternating weights 4,9,4,9,4,9 (KBV spec)
  const weights = [4, 9, 4, 9, 4, 9];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    const prod = Number(lanr[i]) * weights[i];
    sum += prod;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(lanr[6]);  // Fachgruppe at pos 8-9 not part of checksum
}

// BSNR (Betriebsstättennummer): 9 digits, dummy 999999999 allowed.
export function isValidBsnr(bsnr) {
  return /^\d{9}$/.test(bsnr || '');
}

// ICD-10-GM: letter + 2 digits + optional .digit-or-letter + optional G/V/Z/A modifier.
export function isValidIcd10(code) {
  if (!code) return false;
  return /^[A-Z]\d{2}(\.[0-9A-Z]{1,2})?[GVZALR]?$/.test(code.trim());
}

// Diagnosegruppe (Heilmittelkatalog): 2-4 chars (e.g. WS1, WS2, EX2a, PN, AT3).
export function isValidDiagnosegruppe(g) {
  return /^[A-Z]{1,3}\d?[a-z]?$/.test(g || '') && g.length >= 2 && g.length <= 4;
}

// Tarifkennzeichen: 5 chars, pos 1-2 = valid Tarifbereich, pos 3-5 = Sondertarif.
export function isValidTarifkennzeichen(tk) {
  if (!/^[A-Z0-9]{5}$/.test(tk || '')) return false;
  return Boolean(TARIFBEREICH[tk.slice(0, 2)]);
}

export function isValidPositionsnummer(pn) {
  return /^\d{5}$/.test(pn || '');
}

// German PLZ: 5 digits.
export function isValidPlz(plz) {
  return /^\d{5}$/.test(plz || '');
}

// Datum: YYYY-MM-DD or Date object; must be a real, parseable date.
function parseDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Builders for error rows
// ---------------------------------------------------------------------------

const E = (errors, code, where, message) => errors.push({ code, severity: 'error', where, message });
const W = (warnings, code, where, message) => warnings.push({ code, severity: 'warning', where, message });

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function preflight(input) {
  const errors = [];
  const warnings = [];

  // -------- file-level --------
  if (!input.absender?.ik) E(errors, 'F:01001', 'absender.ik', 'Absender-IK fehlt');
  else {
    if (!/^\d{9}$/.test(input.absender.ik)) E(errors, 'F:01002', 'absender.ik', 'Absender-IK muss 9 Ziffern haben');
    else {
      if (!isValidIkChecksum(input.absender.ik)) E(errors, 'F:01003', 'absender.ik', 'Absender-IK Prüfziffer ungültig');
      if (ikKlassifikation(input.absender.ik) !== 'leistungserbringer')
        W(warnings, 'F:01004', 'absender.ik', 'Absender-IK Klassifikation ist nicht Leistungserbringer (80-99)');
    }
  }

  if (!input.empfaenger?.ik) E(errors, 'F:02001', 'empfaenger.ik', 'Empfänger-IK fehlt');
  else if (!/^\d{9}$/.test(input.empfaenger.ik)) E(errors, 'F:02002', 'empfaenger.ik', 'Empfänger-IK muss 9 Ziffern haben');
  else if (!isValidIkChecksum(input.empfaenger.ik)) E(errors, 'F:02003', 'empfaenger.ik', 'Empfänger-IK Prüfziffer ungültig');

  if (!input.rechnung?.sammelRechnungsnummer)
    E(errors, 'F:03001', 'rechnung.sammelRechnungsnummer', 'Sammelrechnungsnummer fehlt');
  else if (input.rechnung.sammelRechnungsnummer.length > 14)
    E(errors, 'F:03002', 'rechnung.sammelRechnungsnummer', 'Sammelrechnungsnummer max. 14 Zeichen');

  if (!input.rechnung?.datennummer || input.rechnung.datennummer < 1)
    E(errors, 'F:03003', 'rechnung.datennummer', 'Datennummer fehlt oder < 1');
  else if (input.rechnung.datennummer > 99999)
    E(errors, 'F:03004', 'rechnung.datennummer', 'Datennummer überschreitet 5-stelligen Wertebereich');

  const rechnungsDatum = parseDate(input.rechnung?.datum);
  if (input.rechnung?.datum && !rechnungsDatum)
    E(errors, 'F:03005', 'rechnung.datum', 'Rechnungsdatum nicht parsebar');

  if (input.vkz && !VERARBEITUNGSKENNZEICHEN[input.vkz])
    E(errors, 'F:04001', 'vkz', `VKZ "${input.vkz}" unbekannt`);

  if (!Array.isArray(input.prescriptions) || input.prescriptions.length === 0) {
    E(errors, 'F:05001', 'prescriptions', 'Mindestens ein Rezept erforderlich');
    return { ok: false, errors, warnings };
  }

  // -------- per-prescription --------
  const seenBelegnummern = new Set();
  let totalBrutto = 0, totalZuzahlung = 0;

  input.prescriptions.forEach((p, i) => {
    const at = `prescription[${i}]`;

    // Patient
    if (!isValidKvnr(p.patient?.kvnr))
      E(errors, 'P:01001', `${at}.patient.kvnr`, `KVNR ungültig (erwartet: 1 Buchstabe + 9 Ziffern, ist: "${p.patient?.kvnr}")`);
    if (!isValidVersichertenstatus(p.patient?.versichertenstatus))
      E(errors, 'P:01002', `${at}.patient.versichertenstatus`, `Versichertenstatus ungültig (5 Ziffern, beginnt mit 1/3/5/9)`);
    if (!p.patient?.nachname) E(errors, 'P:01003', `${at}.patient.nachname`, 'Nachname fehlt');
    if (!p.patient?.vorname)  E(errors, 'P:01004', `${at}.patient.vorname`, 'Vorname fehlt');
    if (!parseDate(p.patient?.geburtsdatum))
      E(errors, 'P:01005', `${at}.patient.geburtsdatum`, 'Geburtsdatum ungültig');
    if (!p.patient?.belegnummer)
      E(errors, 'P:01006', `${at}.patient.belegnummer`, 'Belegnummer fehlt (Muss-Feld in INV)');
    else if (seenBelegnummern.has(p.patient.belegnummer))
      E(errors, 'P:01007', `${at}.patient.belegnummer`, `Belegnummer "${p.patient.belegnummer}" doppelt im selben Sammel`);
    else seenBelegnummern.add(p.patient.belegnummer);

    if (p.patient?.plz && !isValidPlz(p.patient.plz))
      W(warnings, 'P:01008', `${at}.patient.plz`, 'PLZ ist nicht 5-stellig (nur bei DE Pflicht)');

    // Doctor (optional in §302 — dummy 999999900/999999999 allowed)
    if (p.doctor?.lanr && !isValidLanr(p.doctor.lanr))
      E(errors, 'D:01001', `${at}.doctor.lanr`, `LANR "${p.doctor.lanr}" Prüfziffer/Format ungültig`);
    if (p.doctor?.bsnr && !isValidBsnr(p.doctor.bsnr))
      E(errors, 'D:01002', `${at}.doctor.bsnr`, `BSNR "${p.doctor.bsnr}" muss 9 Ziffern haben`);

    // Verordnung
    const v = p.verordnung || {};
    const ausstellung = parseDate(v.ausstellungsdatum);
    if (!ausstellung)
      E(errors, 'V:01001', `${at}.verordnung.ausstellungsdatum`, 'Ausstellungsdatum ungültig');

    if (!isValidIcd10(v.icd10))
      E(errors, 'V:01002', `${at}.verordnung.icd10`, `ICD-10 "${v.icd10}" ungültiges Format`);

    if (!isValidDiagnosegruppe(v.diagnosegruppe))
      E(errors, 'V:01003', `${at}.verordnung.diagnosegruppe`, `Diagnosegruppe "${v.diagnosegruppe}" ungültig`);

    if (!VERORDNUNGSART_HEILMITTEL[v.verordnungsart])
      E(errors, 'V:01004', `${at}.verordnung.verordnungsart`, `Verordnungsart "${v.verordnungsart}" nicht 03/04/05`);

    if (!ZUZAHLUNGSKENNZEICHEN[v.zuzahlungskennzeichen])
      E(errors, 'V:01005', `${at}.verordnung.zuzahlungskennzeichen`, `Zuzahlungskennzeichen "${v.zuzahlungskennzeichen}" ungültig`);

    if (!v.leitsymptomatik)
      E(errors, 'V:01006', `${at}.verordnung.leitsymptomatik`, 'Leitsymptomatik fehlt');

    if (!v.therapiefrequenz)
      E(errors, 'V:01007', `${at}.verordnung.therapiefrequenz`, 'Therapiefrequenz fehlt');

    if (v.kostentraegerIk && !isValidIkChecksum(v.kostentraegerIk))
      E(errors, 'V:01008', `${at}.verordnung.kostentraegerIk`, 'Kostenträger-IK Prüfziffer ungültig');

    if (v.berichtAngefordert && v.berichtStatus !== 'erledigt') {
      E(errors, 'V:01009', `${at}.verordnung`, `Therapiebericht angefordert aber ausstehend (Status: "${v.berichtStatus || 'offen'}")`);
    }


    // Tarif
    const t = p.tarif || {};
    const ac = t.abrechnungscode || '22';
    if (!ABRECHNUNGSCODE[ac])
      E(errors, 'T:01001', `${at}.tarif.abrechnungscode`, `Abrechnungscode "${ac}" unbekannt`);
    else if (ABRECHNUNGSCODE[ac].leistungsbereich !== 'B')
      E(errors, 'T:01002', `${at}.tarif.abrechnungscode`, `Abrechnungscode "${ac}" nicht Leistungsbereich B (Heilmittel)`);
    if (!isValidTarifkennzeichen(t.tarifkennzeichen))
      E(errors, 'T:01003', `${at}.tarif.tarifkennzeichen`, `Tarifkennzeichen "${t.tarifkennzeichen}" ungültig (5 Zeichen, gültiger Tarifbereich)`);

    // Sessions
    if (!Array.isArray(p.sessions) || p.sessions.length === 0) {
      E(errors, 'S:01001', `${at}.sessions`, 'Mindestens eine Leistung erforderlich');
    } else {
      let pBrutto = 0, pZu = 0;
      p.sessions.forEach((s, j) => {
        const sat = `${at}.sessions[${j}]`;
        if (!isValidPositionsnummer(s.positionsnummer))
          E(errors, 'S:01002', `${sat}.positionsnummer`, `Positionsnummer "${s.positionsnummer}" muss 5 Ziffern haben`);

        const sDate = parseDate(s.datumLeistung);
        if (!sDate)
          E(errors, 'S:01003', `${sat}.datumLeistung`, 'Leistungsdatum ungültig');
        else {
          // Leistung darf nicht vor Ausstellung liegen
          if (ausstellung && sDate < ausstellung)
            E(errors, 'S:01004', `${sat}.datumLeistung`, 'Leistungsdatum liegt vor Ausstellungsdatum');
          // Leistung darf nicht in der Zukunft liegen
          if (sDate > new Date())
            E(errors, 'S:01005', `${sat}.datumLeistung`, 'Leistungsdatum liegt in der Zukunft');
          // Rechnungsdatum muss >= letztes Leistungsdatum sein
          if (rechnungsDatum && sDate > rechnungsDatum)
            E(errors, 'S:01006', `${sat}.datumLeistung`, 'Leistungsdatum nach Rechnungsdatum');
        }

        const betrag = Number(s.einzelbetrag);
        if (!Number.isFinite(betrag) || betrag <= 0)
          E(errors, 'S:01007', `${sat}.einzelbetrag`, `Einzelbetrag "${s.einzelbetrag}" ungültig (> 0 erwartet)`);
        if (betrag > 9999.99)
          W(warnings, 'S:01008', `${sat}.einzelbetrag`, 'Einzelbetrag > 9.999,99 € — auffällig hoch');

        const anzahl = Number(s.anzahl || 1);
        pBrutto += betrag * anzahl;
        if (v.zuzahlungskennzeichen === '0') {
          const zu = Number(s.zuzahlungProPos != null ? s.zuzahlungProPos : betrag * 0.10);
          pZu += zu * anzahl;
        }
      });

      // Zuzahlung-Plausibilität: prozZuzahlung ≈ 10% Brutto (± 1ct pro Position toleriert)
      if (v.zuzahlungskennzeichen === '0') {
        const expected = pBrutto * 0.10;
        const tolerance = 0.01 * p.sessions.length;
        if (Math.abs(pZu - expected) > tolerance + 0.005)
          W(warnings, 'S:01009', `${at}.sessions`,
            `Zuzahlung-Summe ${pZu.toFixed(2)} € weicht von 10% Brutto (${expected.toFixed(2)} €) ab`);
      }

      totalBrutto += pBrutto;
      totalZuzahlung += Math.min(pBrutto, pZu + 10);  // 10€ Pauschal-Cap
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    totals: {
      brutto: +totalBrutto.toFixed(2),
      zuzahlung: +totalZuzahlung.toFixed(2),
      netto: +(totalBrutto - totalZuzahlung).toFixed(2),
    },
  };
}

// Convenience: throw if preflight fails. Use in build pipeline.
export function assertPreflight(input) {
  const r = preflight(input);
  if (!r.ok) {
    const summary = r.errors.slice(0, 5).map(e => `[${e.code}] ${e.where}: ${e.message}`).join('\n  ');
    const more = r.errors.length > 5 ? `\n  ... +${r.errors.length - 5} weitere` : '';
    const err = new Error(`Preflight failed (${r.errors.length} errors):\n  ${summary}${more}`);
    err.preflight = r;
    throw err;
  }
  return r;
}
