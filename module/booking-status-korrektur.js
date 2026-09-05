import { emit } from './signal.js?v=20260813';

/**
 * booking-status-korrektur.js — nachträgliche bookings.status-Korrektur
 * (Ops #270, Beta-2 05.09.2026).
 *
 * Reiner Rückweg: die Vorwärtsrichtung (jemanden als no_show markieren)
 * gibt es längst (`handlePatientNichtErschienen()` in dashboard.js) und
 * funktioniert unabhängig vom aktuellen Status jederzeit. Was fehlte, war
 * der Weg zurück — der Patient ist doch noch gekommen, oder es war ein
 * Fehlklick. Deshalb hier bewusst schmal: nur no_show -> completed, kein
 * allgemeiner Statuseditor.
 *
 * Zwei Regeln aus dem Ops-Ticket:
 *  1. Jede Korrektur landet append-only in `booking_status_korrekturen`
 *     (GoBD-Muster wie `zuzahlung_korrekturen` — DB-Trigger blockt UPDATE/
 *     DELETE, hier gibt es also gar keinen Versuchungspunkt für "einfach
 *     überschreiben"). `bookings.start_time`/`end_time` werden nie angefasst.
 *  2. Ist die zugehörige Verordnung schon bei der Kasse eingereicht, ist
 *     dieser freie Weg gesperrt — Korrektur läuft dann über den
 *     bestehenden `module/abrechnungsstatus.js`-Dialog.
 *
 * Bewusst KEIN Bestätigungsdialog und KEIN Pflicht-Freitext: der
 * Podologie-Alltag braucht das mehrmals pro Woche reibungslos (Vorgabe aus
 * dem Ticket). `grund` wird deshalb automatisch aus altem/neuem Status
 * gebildet — das erfüllt die NOT-NULL-Prüfung der Tabelle, ohne dass
 * jemand tippen muss.
 */

// Podologie zählt Einheiten über `bookings.verordnung_id` + eigene
// Leistungsnachweise (podologie_behandlungen), Physio/Ergo/Logo über
// `prescriptions.abrechnung_status`. Zwei Vokabulare, siehe
// module/abrechnungsstatus.js — deshalb eine Blacklist der "raus"-Werte
// statt einer Whitelist, die beide Vokabulare kennen müsste.
const EINGEREICHT_STATUS = new Set([
  'abgerechnet', 'teilabsetzung', 'abgesetzt',   // Podologie
  'billed', 'rejected',                           // Physio/Ergo/Logo
]);

/**
 * Ist die Verordnung hinter diesem Termin schon bei der Kasse eingereicht?
 * `null` als prescriptionId heisst: kein Fund, gilt als nicht gesperrt —
 * ein Termin ohne verknüpfte Verordnung kann nichts falsch abrechnen.
 */
export async function pruefeAbrechnungssperre(supabase, booking) {
  let prescriptionId = booking.verordnung_id || null;
  if (!prescriptionId) {
    const ps = Array.isArray(booking.prescription_sessions) ? booking.prescription_sessions[0] : null;
    prescriptionId = ps?.prescription_id || ps?.prescriptions?.id || null;
  }
  if (!prescriptionId) return { gesperrt: false };

  const { data, error } = await supabase
    .from('prescriptions')
    .select('abrechnung_status')
    .eq('id', prescriptionId)
    .maybeSingle();
  if (error || !data) return { gesperrt: false };
  return { gesperrt: EINGEREICHT_STATUS.has(data.abrechnung_status), status: data.abrechnung_status };
}

/**
 * Setzt `bookings.status` zurück auf 'completed' und schreibt die
 * Korrektur fest. `ctx` = { supabase, showToast }.
 * @returns {Promise<boolean>} true bei Erfolg
 */
export async function korrigiereNoShow(ctx, booking) {
  const { supabase, showToast } = ctx;

  const sperre = await pruefeAbrechnungssperre(supabase, booking);
  if (sperre.gesperrt) {
    showToast(
      'Diese Verordnung ist schon bei der Kasse eingereicht — Korrektur nur über „Verordnungen" → Abrechnungsstatus.',
      'error'
    );
    return false;
  }

  const alterStatus = booking.status;
  const neuerStatus = 'completed';

  const { error: bkErr } = await supabase.from('bookings')
    .update({ status: neuerStatus }).eq('id', booking.id);
  if (bkErr) { showToast('Fehler: ' + bkErr.message, 'error'); return false; }

  // Physio/Ergo/Logo: die Sitzungszeile zieht mit, sonst zaehlt die
  // Verordnung die Behandlung weiterhin nicht mit (siehe
  // handlePatientNichtErschienen() fuer dieselbe Kopplung in Gegenrichtung).
  await supabase.from('prescription_sessions').update({ status: 'done' }).eq('booking_id', booking.id);

  const { data: sess } = await supabase.auth.getSession();
  const { error: logErr } = await supabase.from('booking_status_korrekturen').insert({
    owner_id: booking.owner_id,
    booking_id: booking.id,
    alter_status: alterStatus,
    neuer_status: neuerStatus,
    grund: `Korrektur: ${alterStatus} → ${neuerStatus}`,
    geaendert_von: sess?.session?.user?.id || null,
  });
  if (logErr) console.error('[korrigiereNoShow] Korrekturprotokoll fehlgeschlagen', logErr);

  booking.status = neuerStatus;
  emit('bookings:changed', { id: booking.id });
  showToast('Status korrigiert ✓', 'success');
  return true;
}

/**
 * Kalender + Tagesübersicht nach einer Statusänderung nachziehen. Stand bis
 * 05.09.2026 als dieselben 4 Zeilen in dashboard.js an zwei Stellen
 * (No-Show setzen + korrigieren) — jetzt eine Funktion, hierher gezogen statt
 * lokal verdoppelt (dashboard.js wächst nicht, Konsey 2026-08-13).
 */
export async function kalenderNeuLaden({ calendar, activePanel, loadTodayBookings, renderCalendarView }) {
  if (calendar) { await calendar.reloadMonth(); calendar.refresh(); }
  if (activePanel === 'overview') await loadTodayBookings();
  if (activePanel === 'calendar') await renderCalendarView();
}
