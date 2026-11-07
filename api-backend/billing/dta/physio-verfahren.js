// Administrative billing gate, not a treatment recommendation.
// Originals: wissensbank REGISTER W-17 (§125 §6(3), §7(3a)/(4)),
// W-20 (§125a §2), W-23 (separate Blanko remuneration/LEGS 2200502).
// Structured evidence is supplied by the caller, never inferred from free text.
import { istStichtag, berlinHeute } from '../../lib/berlin-tag.js';
import { lookupBlankoShoulder } from '../../ai/validators/catalog.js';
import { verordnungsartFuer } from './zhe-kennzeichen.js';

const DAY = 86400000;
const utc = day => new Date(`${day}T00:00:00Z`);
const plusDays = (day, count) => new Date(utc(day).getTime() + count * DAY).toISOString().slice(0, 10);

// Calendar months (including end-of-month clipping), never 90/180 days.
function plusMonths(day, count) {
  const d = utc(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + count, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return target.toISOString().slice(0, 10);
}

function serviceDay(session) {
  const value = session?.datumLeistung ?? session?.done_at;
  if (istStichtag(value)) return value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)
      || !istStichtag(value.slice(0, 10)) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : berlinHeute(date);
}

/**
 * Validate actual performed dates before DTA mapping.
 * No persistence or profile-release decision is hidden in this function.
 * entlassdatum and interruption evidence must come from reviewed structured data.
 */
export function validatePhysioAbrechnung({ rx, sessions = [], entlassmanagement = null,
  entlassdatum = null, unterbrechungen = [] } = {}) {
  const errors = [], warnings = [];
  const error = (code, field, message) => errors.push({ code, field, message });
  if (!rx || typeof rx !== 'object') {
    error('PHYSIO_VERORDNUNG_FEHLT', 'verordnung', 'Verordnungsdaten fehlen.');
    return { ok: false, errors, warnings, profile: null };
  }
  if (typeof entlassmanagement !== 'boolean') error('PHYSIO_ENTLASSMERKMAL_UNGEKLAERT', 'entlassmanagement', 'Entlassmanagement muss vor Abrechnung ausdrücklich anhand der Verordnung bestätigt oder ausgeschlossen sein.');
  // Preserve the existing mapping of stored flags to the official ZHE values.
  const art = verordnungsartFuer(rx);
  const blanko = art === '05';
  if ((rx.rezept_typ === 'blanko' && !blanko)
      || (rx.rezept_typ === 'lhb_bvb' && art !== '04')
      || (rx.is_blanko === true && rx.is_lhb_bvb === true)) {
    error('PHYSIO_VERFAHREN_WIDERSPRUCH', 'rezept_typ', 'Verordnungsart und gespeicherte Verfahrensmerkmale widersprechen sich.');
  }
  const profile = blanko ? 'blanko' : entlassmanagement ? 'entlassmanagement' : art === '04' ? 'lhb_bvb' : 'standard';
  const dates = Array.isArray(sessions) ? sessions.map(serviceDay) : [];
  if (!dates.length) error('PHYSIO_LEISTUNGEN_FEHLEN', 'sessions', 'Mindestens eine erbrachte Leistung ist erforderlich.');
  if (dates.some(day => !day)) error('PHYSIO_LEISTUNGSDATUM_UNGUELTIG', 'sessions', 'Jede erbrachte Leistung benötigt einen gültigen tatsächlichen Leistungstag.');
  const validDates = dates.filter(Boolean).sort();
  const first = validDates[0], last = validDates.at(-1);
  const issued = rx.ausstellungsdatum;
  if (!istStichtag(issued)) error('PHYSIO_AUSSTELLUNGSDATUM_UNGUELTIG', 'ausstellungsdatum', 'Ein gültiges Ausstellungsdatum ist erforderlich.');
  if (first && istStichtag(issued) && first < issued) error('PHYSIO_BEGINN_VOR_AUSSTELLUNG', 'sessions', 'Der erste Leistungstag liegt vor dem Ausstellungsdatum.');
  // Until dated certificates and per-service age state are loaded by the mapper,
  // do not let its last-day/global-flag shortcut silently change the copay.
  const dob = rx.patient_geburtsdatum;
  if (first && last && istStichtag(dob)) {
    const eighteenth = `${String(Number(dob.slice(0, 4)) + 18).padStart(4, '0')}${dob.slice(4)}`;
    if (first < eighteenth && last >= eighteenth) error('PHYSIO_ZUZAHLUNG_ALTERSWECHSEL_OFFEN', 'patient_geburtsdatum', 'Volljährigkeit zwischen Leistungen: leistungsbezogene Zuzahlung und Blattgebühr müssen vor Abrechnung geklärt werden.');
  }
  if (first && last && rx.zuzahlung_befreit === true && first.slice(0, 4) !== last.slice(0, 4)) {
    error('PHYSIO_ZUZAHLUNG_JAHRESWECHSEL_OFFEN', 'zuzahlung_befreit', 'Befreite Verordnung über Jahreswechsel: gültige Befreiungsnachweise je Leistungsjahr fehlen im Abrechnungspfad.');
  }

  if (entlassmanagement) {
    if (blanko) error('PHYSIO_BLANKO_ENTLASS_UNZULAESSIG', 'rezept_typ', 'Blankoverordnung und Entlassmanagement dürfen nicht kombiniert werden.');
    if (!istStichtag(entlassdatum)) error('PHYSIO_ENTLASSDATUM_FEHLT', 'entlassdatum', 'Für Entlassmanagement ist das tatsächliche Entlassdatum erforderlich.');
    else if (first) {
      if (first < entlassdatum) error('PHYSIO_BEGINN_VOR_ENTLASSUNG', 'sessions', 'Eine Leistung liegt vor der Entlassung.');
      if (first > plusDays(entlassdatum, 7)) error('PHYSIO_ENTLASS_BEGINN_FRIST', 'sessions', 'Behandlungsbeginn später als sieben Kalendertage nach Entlassung.');
      if (last > plusDays(entlassdatum, 12)) error('PHYSIO_ENTLASS_ENDE_FRIST', 'sessions', 'Leistung später als zwölf Kalendertage nach Entlassung.');
    }
  } else if (first && istStichtag(issued)) {
    const limit = plusDays(issued, rx.is_dringend === true ? 14 : 28);
    if (first > limit) error('PHYSIO_BEGINN_FRIST', 'sessions', `Behandlungsbeginn nach der maßgeblichen Frist (${limit}).`);
  }

  if (blanko) {
    if (rx.diagnosegruppe !== 'EX' || !lookupBlankoShoulder(rx.icd10)) error('PHYSIO_BLANKO_INDIKATION', 'icd10', 'Die hinterlegte Blanko-Schulterindikation und Diagnosegruppe EX müssen vorliegen.');
    if (istStichtag(issued) && last && last > plusDays(issued, 16 * 7)) error('PHYSIO_BLANKO_GUELTIGKEIT', 'sessions', 'Leistung außerhalb der maximalen 16 Wochen ab Verordnungsdatum.');
    // No automatic use of the §125 standard prices/LEGS for §125a.
    error('PHYSIO_BLANKO_TAXIERUNG_UNGEPRUEFT', 'rezept_typ', 'Die eigenständige Blanko-Taxierung (LEGS 2200502, Vergütung und Ampel sowie Wiederaufnahme) ist noch nicht unabhängig freigegeben.');
  } else if (!entlassmanagement && first) {
    const count = Number(rx.anzahl_einheiten);
    if (!Number.isInteger(count) || count <= 0) error('PHYSIO_VERORDNETE_MENGE_FEHLT', 'anzahl_einheiten', 'Die tatsächlich verordnete Behandlungseinheitenzahl ist erforderlich.');
    else if (last > plusMonths(first, count <= 6 ? 3 : 6)) error('PHYSIO_VERORDNUNG_ABGELAUFEN', 'sessions', 'Leistung nach der vertraglichen Gültigkeit von drei beziehungsweise sechs Kalendermonaten.');
    for (let i = 1; i < validDates.length; i++) {
      const from = validDates[i - 1], to = validDates[i];
      if ((utc(to) - utc(from)) / DAY <= 14) continue;
      const evidence = Array.isArray(unterbrechungen) && unterbrechungen.some(item => item?.von === from && item?.bis === to
        && ['T', 'K', 'F'].includes(item.grund) && item.dokumentiert === true);
      if (!evidence) error('PHYSIO_UNTERBRECHUNG_NACHWEIS_FEHLT', 'unterbrechungen', `Unterbrechung ${from} bis ${to}: dokumentierter Grund T/K/F erforderlich.`);
    }
  }
  return { ok: errors.length === 0, errors, warnings, profile,
    verordnungsart: art, erforderlicherLegs: blanko ? '2200502' : null,
    ersterLeistungstag: first ?? null, letzterLeistungstag: last ?? null };
}
