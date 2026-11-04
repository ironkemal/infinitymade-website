// Liest employee_standort_plan fuer den Standort-Filter (Physio-Pilot S6 / M4d, 01.11.2026).
// Die Tabelle ist per Migration 0097 nur Entwurf und kann live FEHLEN. Darum gilt hier ausnahmslos:
// Fehler, fehlende Tabelle, leeres Ergebnis -> [] = altes Verhalten (kein Filter), ohne Meldung.
// Nach einem Fehler wird die Tabelle eine Weile nicht erneut angefragt (kein Request je Slot-Aufruf).
// Der Plan darf die Zuordnung (employee_business_assignments) nie ERWEITERN: Aufrufer pruefen nur
// "Plan erlaubt es" und lassen alles andere wie bisher; alleStandortIds = [angefragter Standort].

import { imZeitfenster, zeitInMinuten } from './standort-plan.js';

const SPERRE_FEHLT_MS = 10 * 60 * 1000;
const SPERRE_FEHLER_MS = 60 * 1000;
let gesperrtBis = 0;

export function _planSperreZuruecksetzen() { gesperrtBis = 0; }

function tabelleFehlt(error) {
  const t = `${error?.code || ''} ${error?.message || ''}`;
  return /42P01|PGRST205|does not exist|schema cache/i.test(t);
}

/** @returns {Promise<Array<{employee_id:string,business_id:string,weekday:?number,datum:?string}>>} */
export async function ladeStandortPlan(supabase, { ownerId, employeeIds }, jetzt = Date.now()) {
  if (!supabase || !ownerId || !Array.isArray(employeeIds) || !employeeIds.length) return [];
  if (jetzt < gesperrtBis) return [];
  try {
    const { data, error } = await supabase
      .from('employee_standort_plan')
      .select('employee_id,business_id,weekday,datum,gueltig_ab,von,bis')
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
 * true = Mitarbeiter darf an diesem Tag (und, mit `zeit`, in diesem Zeitraum) an diesem Standort eingeplant werden.
 * Ohne Plan/Standort immer true. `zeit` = { start: 'HH:MM' | vonMin, dauerMin } in Berliner Ortszeit (0109 Zeitfenster).
 */
export function planErlaubt(zeilen, employeeId, datum, standortId, zeit = null) {
  if (!standortId || !Array.isArray(zeilen) || !zeilen.length) return true;
  const von = !zeit ? null : Number.isFinite(zeit.vonMin) ? zeit.vonMin : zeitInMinuten(zeit.start);
  const bis = von !== null && Number.isFinite(Number(zeit.dauerMin)) ? von + Number(zeit.dauerMin) : null;
  return imZeitfenster(zeilen, employeeId, datum, standortId, von, bis, [standortId]);
}

