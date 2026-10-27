import { statusAusTopf } from './verordnung-topf.js?v=20260930c';
import { emit } from './signal.js?v=20260813';
import { rebindeNoShowSitzungen } from './termin-nicht-erschienen.js?v=20261027p';

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

// Nur offene, bekannte Zustände dürfen Behandlungen zurückbuchen. Unbekannte
// Werte dürfen nicht über statusAusTopf()s Anzeige-Fallback zu „aktiv“ werden.
const OFFENE_STATUS = new Set([null, '', 'aktiv', 'abrechenbar', 'bereit']);

/** Prüft alle aktuellen Verknüpfungen; Lesefehler sperren vor jedem Schreibzugriff. */
export async function pruefeAbrechnungssperre(supabase, booking) {
  try {
    if (!booking?.id) throw new Error('Termin fehlt.');
    let abfrage = supabase.from('bookings')
      .select('id, owner_id, status, start_time, verordnung_id, no_show_session_links').eq('id', booking.id);
    if (booking.owner_id) abfrage = abfrage.eq('owner_id', booking.owner_id);
    const { data: aktuell, error: terminFehler } = await abfrage.maybeSingle();
    if (terminFehler || !aktuell) throw new Error('Termin konnte nicht geprüft werden.');
    const ids = new Set();
    if (aktuell.verordnung_id) ids.add(aktuell.verordnung_id);
    const { data: sitzungen, error: sitzungsFehler } = await supabase
      .from('prescription_sessions').select('id, prescription_id').eq('booking_id', booking.id);
    if (sitzungsFehler || !Array.isArray(sitzungen)) throw new Error('Sitzungen konnten nicht geprüft werden.');
    for (const s of sitzungen) {
      if (!s.prescription_id) throw new Error('Verknüpfte Verordnung fehlt.');
      ids.add(s.prescription_id);
    }
    const links = aktuell.no_show_session_links;
    if (links != null && !Array.isArray(links)) throw new Error('Sitzungsverknüpfungen sind ungültig.');
    const sessionIds = [...new Set((links || []).map(l => l?.session_id))];
    if (sessionIds.some(id => !id)) throw new Error('Sitzungsverknüpfung fehlt.');
    if (sessionIds.length) {
      const { data: freigegebene, error } = await supabase.from('prescription_sessions')
        .select('id, prescription_id').in('id', sessionIds);
      if (error || !Array.isArray(freigegebene)
          || sessionIds.some(id => !freigegebene.some(s => s.id === id && s.prescription_id))) {
        throw new Error('Freigegebene Sitzungen konnten nicht geprüft werden.');
      }
      const rezepte = new Map(freigegebene.map(s => [s.id, s.prescription_id]));
      for (const l of links) {
        if (l.prescription_id) ids.add(l.prescription_id);
        ids.add(rezepte.get(l.session_id));
      }
      // Rückbindung und Fortschrittsprüfung verwenden ebenfalls den frischen FK.
      aktuell.no_show_session_links = links.map(l => ({ ...l, prescription_id: rezepte.get(l.session_id) }));
    }
    for (const id of ids) {
      let rezeptAbfrage = supabase.from('prescriptions').select('abrechnung_status').eq('id', id);
      if (aktuell.owner_id) rezeptAbfrage = rezeptAbfrage.eq('owner_id', aktuell.owner_id);
      const { data, error } = await rezeptAbfrage.maybeSingle();
      if (error || !data) throw new Error('Verknüpfte Verordnung konnte nicht geprüft werden.');
      const status = data.abrechnung_status ?? null;
      if (!OFFENE_STATUS.has(status) || !['aktiv', 'abrechenbar'].includes(statusAusTopf(status))) {
        return { gesperrt: true, status };
      }
    }
    return { gesperrt: false, booking: aktuell };
  } catch (error) {
    return { gesperrt: true, fehler: error?.message || 'Abrechnungsprüfung fehlgeschlagen.' };
  }
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
      sperre.fehler || 'Diese Verordnung ist für freie Korrekturen gesperrt — bitte „Verordnungen" → Abrechnungsstatus prüfen.',
      'error'
    );
    return false;
  }

  const aktuelleBuchung = sperre.booking;
  if (aktuelleBuchung.status !== 'no_show') {
    showToast('Termin ist nicht mehr als nicht erschienen markiert. Bitte neu laden.', 'error');
    return false;
  }
  const alterStatus = aktuelleBuchung.status;
  const neuerStatus = 'completed';

  const { error: bkErr } = await supabase.from('bookings')
    .update({ status: neuerStatus }).eq('id', booking.id);
  if (bkErr) { showToast('Fehler: ' + bkErr.message, 'error'); return false; }

  // Physio/Ergo/Logo: die Sitzungszeile zieht mit, sonst zaehlt die
  // Verordnung die Behandlung weiterhin nicht mit (siehe
  // markiereNichtErschienen() fuer dieselbe Kopplung in Gegenrichtung).
  //
  // Zwei Wege, weil es zwei Datenstaende gibt:
  //  1. Zeilen, die noch AM Termin haengen — Altbestand vor dem 14.09.2026 und
  //     der Notfallpfad ohne Rueckfahrkarte.
  //  2. Seit 14.09.2026 gibt das no_show die Einheit frei (booking_id = NULL).
  //     Diese Zeile findet `.eq('booking_id', …)` nicht mehr; sie steht in
  //     `bookings.no_show_session_links`. Ohne Schritt 2 waere die Korrektur
  //     stillschweigend wirkungslos — der Termin stuende auf `completed`, die
  //     Einheit bliebe unerbracht.
  // done_at = Leistungsdatum der Abrechnung (Mapper fiel ohne es auf das Ausstellungsdatum zurück).
  await supabase.from('prescription_sessions')
    .update({ status: 'done', done_at: aktuelleBuchung.start_time || new Date().toISOString() })
    .eq('booking_id', booking.id);
  await rebindeNoShowSitzungen(supabase, aktuelleBuchung);

  const { data: sess } = await supabase.auth.getSession();
  const { error: logErr } = await supabase.from('booking_status_korrekturen').insert({
    owner_id: aktuelleBuchung.owner_id,
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
