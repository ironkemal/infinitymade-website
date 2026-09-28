/**
 * arbeitszeit-pruefung.js — Termin außerhalb der Arbeitszeit: warnen statt blockieren.
 *
 * Ops #307: Beta-1 erfasst Verordnungen abends gesammelt, oft nach Feierabend.
 * Der harte `return` beim Speichern brach genau in dieser Situation live im
 * Meeting ab (01:41:17) — kein Ausweg, Sitzung musste beendet werden. Die
 * beiden anderen Regeln im selben Speicherpfad (Vergangenheit, Frequenz)
 * fragen "trotzdem eintragen?" statt abzubrechen — dasselbe Muster gilt jetzt
 * auch hier.
 *
 * Reine Funktion, kein DOM/Supabase — dashboard.js holt `wh` selbst
 * (`working_hours` für user_id+day_of_week) und ruft dies nur zur Bewertung.
 */

/**
 * @param {{start_time:string, end_time:string}[]} wh  aktive working_hours-Zeilen für den Wochentag
 * @param {Date} startDate  gewählter Termin-Zeitpunkt
 * @returns {{titel:string, meldung:string, notiz:string}|null}
 *          null = innerhalb der Arbeitszeit, keine Warnung nötig.
 */
export function pruefeArbeitszeit({ wh, startDate }) {
  if (!wh || wh.length === 0) {
    return {
      titel: 'Außerhalb der Arbeitszeit',
      meldung: 'Dieser Tag ist kein Arbeitstag für den gewählten Mitarbeiter. Möchten Sie den Termin trotzdem eintragen?',
      notiz: '⚠️ Außerhalb der Arbeitszeit gespeichert (kein Arbeitstag)',
    };
  }

  const hhmm = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
  const withinAny = wh.some(w => hhmm >= w.start_time.substring(0, 5) && hhmm < w.end_time.substring(0, 5));
  if (withinAny) return null;

  const ranges = wh.map(w => `${w.start_time.substring(0, 5)}–${w.end_time.substring(0, 5)}`).join(', ');
  return {
    titel: 'Außerhalb der Arbeitszeit',
    meldung: `Uhrzeit liegt außerhalb der Arbeitszeit (${ranges}). Möchten Sie den Termin trotzdem eintragen?`,
    notiz: `⚠️ Außerhalb der Arbeitszeit gespeichert (${ranges})`,
  };
}
