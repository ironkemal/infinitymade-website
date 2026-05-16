// Blankoverordnung rules (Physiotherapie, Schulter-Diagnosen, seit 1.11.2024).
//
// Key constraints:
//   - 16 Wochen Gültigkeit ab Ausstellungsdatum
//   - Behandlungsbeginn innerhalb 28 Tage ab Ausstellung
//   - ICD muss auf der Blanko-Schulterliste (114 EX-Diagnosen) sein
//   - Diagnosegruppe immer EX
//   - "BLANKOVERORDNUNG" muss im Feld "Heilmittel nach Maßgabe des Kataloges" stehen
//   - Keine Höchstmenge, ABER Ampelsystem mit 9% Vergütungsabschlag in der roten Zone
//   - Zusätzliche Vergütung: +34.34€ PD (verpflichtend) + 25.76€ Bedarfsdiagnostik (max 1x)
//     + 55€ Mehraufwandspauschale (pro Verordnung)

import { lookupBlankoShoulder, BLANKO_AMPEL, BLANKO_VERGUETUNG } from './catalog.js';

const GUELTIG_WOCHEN = 16;
const BEGIN_DEADLINE_TAGE = 28;
const ROTE_AMPEL_ABSCHLAG_PERCENT = 9;

function parseDate(s) {
  if (!s) return null;
  // Force UTC midnight to avoid timezone off-by-one in toISOString().slice()
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}
function addDays(d, days) {
  return new Date(d.getTime() + days * 86400000);
}

function classifyAmpel({ heilmittel_typ, vorrangig_einheiten, ergaenzend_einheiten }) {
  // heilmittel_typ ∈ {"weichteil_arthrose_knorpel", "fraktur"}
  const cfg = BLANKO_AMPEL[heilmittel_typ] || BLANKO_AMPEL.weichteil_arthrose_knorpel;
  const vorrang = Number(vorrangig_einheiten) || 0;
  const ergaenz = Number(ergaenzend_einheiten) || 0;
  const vorrangRot = vorrang >= cfg.vorrangig.rot_ab;
  const ergaenzRot = ergaenz >= cfg.ergaenzend.rot_ab;
  return {
    in_red_zone: vorrangRot || ergaenzRot,
    vorrangig: { count: vorrang, threshold_rot: cfg.vorrangig.rot_ab, in_red: vorrangRot },
    ergaenzend: { count: ergaenz, threshold_rot: cfg.ergaenzend.rot_ab, in_red: ergaenzRot },
    abschlag_percent: (vorrangRot || ergaenzRot) ? ROTE_AMPEL_ABSCHLAG_PERCENT : 0
  };
}

export function validateBlanko(rezept) {
  const warnings = [];
  const blockers = [];

  // Mandatory Blanko marker check
  const markerOk = (rezept.heilmittel_feld_text || '').toUpperCase().includes('BLANKOVERORDNUNG');
  if (!markerOk) {
    blockers.push({
      code: 'BLANKO_MARKER_MISSING',
      msg: 'Im Feld "Heilmittel nach Maßgabe des Kataloges" muss "BLANKOVERORDNUNG" eingetragen sein. Ohne diese Kennzeichnung ist die Verordnung nicht als Blankoverordnung gültig.',
      field: 'heilmittel_feld_text',
      regulation: 'Rahmenvertrag § 125a SGB V — Anlage Muster 13 Kennzeichnung'
    });
  }

  // ICD must be on Blanko shoulder list
  const blankoEntry = lookupBlankoShoulder(rezept.icd10);
  if (!blankoEntry) {
    blockers.push({
      code: 'NOT_ON_BLANKO_LIST',
      msg: `ICD-10 ${rezept.icd10} ist nicht auf der Blanko-Schulterliste (114 zulässige EX-Diagnosen seit 1.11.2024). Bitte als Standardverordnung ausstellen.`,
      field: 'icd10',
      regulation: 'KBV Diagnoseliste Blankoverordnung Physiotherapie Stand 2026-01-01'
    });
  }

  // Diagnosegruppe MUST be EX
  if (rezept.diagnosegruppe && rezept.diagnosegruppe !== 'EX') {
    blockers.push({
      code: 'BLANKO_DG_NOT_EX',
      msg: `Bei Blankoverordnung Physiotherapie ist nur Diagnosegruppe EX zulässig. Angegeben: ${rezept.diagnosegruppe}.`,
      field: 'diagnosegruppe'
    });
  }

  // Ausstellungsdatum & deadlines
  const ausstellung = parseDate(rezept.ausstellungsdatum);
  if (!ausstellung) {
    blockers.push({
      code: 'AUSSTELLUNGSDATUM_INVALID',
      msg: 'Ausstellungsdatum fehlt oder ist ungültig.',
      field: 'ausstellungsdatum'
    });
  }

  const latestBeginDate = ausstellung ? addDays(ausstellung, BEGIN_DEADLINE_TAGE) : null;
  const validityEnd = ausstellung ? addDays(ausstellung, GUELTIG_WOCHEN * 7) : null;

  if (ausstellung && rezept.behandlungsbeginn) {
    const begin = parseDate(rezept.behandlungsbeginn);
    if (begin && latestBeginDate && begin > latestBeginDate) {
      blockers.push({
        code: 'BLANKO_BEGIN_AFTER_28D',
        msg: `Bei Blankoverordnung muss die Behandlung innerhalb von 28 Tagen nach Ausstellung beginnen. Geplant: ${rezept.behandlungsbeginn}, Frist: ${latestBeginDate.toISOString().slice(0,10)}.`,
        field: 'behandlungsbeginn',
        latest_allowed: latestBeginDate.toISOString().slice(0,10),
        regulation: 'NOVENTI-Leitfaden Blankoverordnung Physiotherapie'
      });
    }
  }

  // Ampelsystem evaluation (only if user provided session counts)
  let ampel = null;
  if (rezept.heilmittel_typ_blanko) {
    ampel = classifyAmpel({
      heilmittel_typ: rezept.heilmittel_typ_blanko,
      vorrangig_einheiten: rezept.vorrangig_einheiten,
      ergaenzend_einheiten: rezept.ergaenzend_einheiten
    });
    if (ampel.in_red_zone) {
      warnings.push({
        code: 'BLANKO_RED_AMPEL',
        msg: `Behandlungsvolumen liegt in der roten Zone des Ampelsystems → ${ROTE_AMPEL_ABSCHLAG_PERCENT}% Vergütungsabschlag. ${ampel.vorrangig.in_red ? `Vorrangiges Heilmittel (${ampel.vorrangig.count} ≥ ${ampel.vorrangig.threshold_rot}). ` : ''}${ampel.ergaenzend.in_red ? `Ergänzendes Heilmittel (${ampel.ergaenzend.count} ≥ ${ampel.ergaenzend.threshold_rot}).` : ''}`,
        field: 'anzahl_einheiten',
        ampel
      });
    }
  }

  // Automatic billing bonuses
  const bonuses = {
    physiotherapeutische_diagnostik: BLANKO_VERGUETUNG.physiotherapeutische_diagnostik,
    mehraufwandspauschale: BLANKO_VERGUETUNG.mehraufwandspauschale
  };
  // Bedarfsdiagnostik is optional (max 1x), only if therapist flags it
  if (rezept.include_bedarfsdiagnostik) {
    bonuses.bedarfsdiagnostik = BLANKO_VERGUETUNG.bedarfsdiagnostik;
  }
  const total_bonuses_eur = Object.values(bonuses).reduce((a, b) => a + b, 0);

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
    computed: {
      verordnung_typ: 'blanko_physio_shoulder',
      blanko_diagnose: blankoEntry?.diagnose || null,
      gueltig_bis: validityEnd ? validityEnd.toISOString().slice(0,10) : null,
      behandlungsbeginn_spaetestens: latestBeginDate ? latestBeginDate.toISOString().slice(0,10) : null,
      gueltig_wochen: GUELTIG_WOCHEN,
      ampel,
      bonuses_eur: bonuses,
      total_bonuses_eur: Number(total_bonuses_eur.toFixed(2)),
      zuzahlung_required: true,
      zuzahlung_percent: 10,
      zuzahlung_eur_per_blatt: 10,
      regulation_source: '§§ 73 Abs. 10, 125a SGB V — Blankoverordnung Physiotherapie (seit 1.11.2024)'
    }
  };
}
