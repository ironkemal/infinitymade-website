// Pflichtfelder beim Speichern eines Patienten (Dialog „Neuer Patient" / „Patient bearbeiten").
//
// QA TEST-Physio 17.11.2026, Fund 1: „Versicherungsart *" war als Pflicht markiert, wurde aber
// nie geprüft, und ein Geburtsdatum 01.01.2030 ging durch. Die Datumsregel (nicht vor 1900,
// nicht in der Zukunft) gibt es schon im Termin-Widget — hier wiederverwendet, nur der Text
// spricht die Praxis an statt den Patienten.
import { validateBirthDate, validateContact } from '../widget/booking-widget.logic.js?v=20261012';

/**
 * @param {object} p
 * @param {string} p.geburtsdatum      Wert des <input type="date"> ('YYYY-MM-DD' oder '')
 * @param {string|null|undefined} p.versicherungsart  'gkv' | 'privat' | leer
 * @param {boolean} p.praxis           Heilmittel-Praxis (nur dort ist die Versicherungsart sichtbar)
 * @param {Date} [p.heute]
 * @returns {string|null} Fehlermeldung oder null
 */
export function pruefePatientPflicht({ geburtsdatum, versicherungsart, praxis, heute = new Date() }) {
  if (!geburtsdatum) return 'Geburtsdatum ist erforderlich.';
  const fehler = validateBirthDate(geburtsdatum, heute);
  if (fehler) {
    if (geburtsdatum > '1900-01-01' && /Zukunft/.test(fehler)) return 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
    return 'Bitte das Geburtsdatum prüfen (nicht vor 1900).';
  }
  if (praxis && versicherungsart !== 'gkv' && versicherungsart !== 'privat') {
    return 'Bitte die Versicherungsart wählen (GKV oder privat).';
  }
  return null;
}

export function patientKontaktFehler(plz, email) {
  if (plz && !/^\d{5}$/.test(plz)) return 'Bitte eine fünfstellige Postleitzahl eingeben.';
  return validateContact(email, '').email;
}
