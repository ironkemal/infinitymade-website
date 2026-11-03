// Standort-Filter im Kalender (Physio-Pilot S6 / M4d, 01.11.2026). Liest employee_standort_plan
// ueber den Client (RLS: Inhaber sieht alles, Mitarbeiter nur eigene Zeilen).
// Die Tabelle ist per Migration 0097 nur Entwurf und kann live FEHLEN: Fehler, fehlende Tabelle,
// leeres Ergebnis -> Spalten unveraendert (altes Verhalten), ohne Toast und ohne Konsolenmeldung.
// Nach einem Fehler wird nicht erneut angefragt (kein Request je Kalender-Aufbau).
// Der Plan blendet nur AUS, er fuegt nie Spalten hinzu (Zuordnung bleibt Obergrenze).
import { istAmStandort } from './standort-plan-regel.js?v=20261102a';

const SPERRE_FEHLT_MS = 10 * 60 * 1000;
const SPERRE_FEHLER_MS = 60 * 1000;
let gesperrtBis = 0;

/** Gespeicherter Terminstandort, unabhängig vom später geänderten Einsatzplan. NULL bleibt praxisweit. */
export function termineDesStandorts(termine, businessId) {
  if (!businessId) return termine;
  return termine.filter(t => !t.business_id || t.business_id === businessId);
}

export function _planSperreZuruecksetzen() { gesperrtBis = 0; }

function tabelleFehlt(error) {
  return /42P01|PGRST205|does not exist|schema cache/i.test(`${error?.code || ''} ${error?.message || ''}`);
}

export async function ladeStandortPlan(supabase, { ownerId, employeeIds }, jetzt = Date.now()) {
  if (!supabase || !ownerId || !Array.isArray(employeeIds) || !employeeIds.length) return [];
  if (jetzt < gesperrtBis) return [];
  try {
    const { data, error } = await supabase
      .from('employee_standort_plan')
      .select('employee_id,business_id,weekday,datum,gueltig_ab')
      .eq('owner_id', ownerId)
      .in('employee_id', employeeIds);
    if (error) {
      gesperrtBis = jetzt + (tabelleFehlt(error) ? SPERRE_FEHLT_MS : SPERRE_FEHLER_MS);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch {
    gesperrtBis = jetzt + SPERRE_FEHLER_MS;
    return [];
  }
}

/**
 * Rein: Teamspalten fuer einen Tag am Standort. Ein Mitarbeiter bleibt sichtbar, wenn der Plan ihn dort
 * vorsieht ODER er an dem Tag dort schon einen Termin hat (nichts Gebuchtes verschwindet).
 * Kein Plan oder kein Standort -> unveraenderte Liste. Ein verifizierter Plan darf alle Spalten ausblenden.
 */
export function spaltenNachPlan(team, zeilen, datum, standortId, bookings = []) {
  if (!Array.isArray(team) || !standortId || !Array.isArray(zeilen) || !zeilen.length) return team;
  const mitTermin = new Set(termineDesStandorts(bookings || [], standortId).map((b) => b && b.user_id));
  const alle = [standortId];
  const sicht = team.filter((e) => mitTermin.has(e.id) || istAmStandort(zeilen, e.id, datum, standortId, alle));
  return sicht;
}

/** Einzeiler fuer dashboard.js: laedt den Plan und filtert die Spalten. */
export async function planSpalten(supabase, { team, bookings, datum, businessId, ownerId }) {
  if (!businessId || !Array.isArray(team) || !team.length) return team;
  const zeilen = await ladeStandortPlan(supabase, { ownerId, employeeIds: team.map((e) => e.id) });
  return spaltenNachPlan(team, zeilen, datum, businessId, bookings);
}
