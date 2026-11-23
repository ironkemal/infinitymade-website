/**
 * realtime-status.js — ruhige Meldung bei unterbrochener Live-Aktualisierung (Box-Test 22.11.2026, Befund 4).
 *
 * Warum: Der Termin-Kanal (dashboard.js, bookings-realtime) lief mit .subscribe() ohne Statusrückmeldung.
 * supabase-js verbindet sich selbst neu, aber Änderungen WÄHREND der Unterbrechung werden nicht nachgeliefert —
 * danach zeigte der Kalender still einen veralteten Stand. Jetzt:
 * - CHANNEL_ERROR / TIMED_OUT → nach VERZOEGERUNG_MS ein kleines Band „wird wiederhergestellt“ (kein Flackern bei kurzen Aussetzern)
 * - SUBSCRIBED nach einer Unterbrechung → Band weg + einmal nachladen
 * - CLOSED bleibt still: das löst der Kiosk absichtlich aus (Kanal beim Patiententablett geschlossen).
 */

export const VERZOEGERUNG_MS = 5000;
const BAND_ID = 'realtimeUnterbrochenBand';

/**
 * @param {{ nachholen: () => void, doc?: Document, setTimeoutImpl?: typeof setTimeout, clearTimeoutImpl?: typeof clearTimeout }} o
 * @returns {(status: string) => void}  an channel.subscribe(...) übergeben
 */
export function kanalStatusBehandler({ nachholen, doc = document, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout }) {
  let unterbrochen = false;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let uhr = null;
  const band = () => {
    if (doc.getElementById(BAND_ID)) return;
    const el = doc.createElement('div');
    el.id = BAND_ID;
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9998;padding:8px 14px;border-radius:8px;'
      + 'background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);box-shadow:0 4px 16px rgba(0,0,0,.18);font-size:13px;';
    el.textContent = 'Live-Aktualisierung unterbrochen — wird wiederhergestellt …';
    doc.body.appendChild(el);
  };
  return (status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      unterbrochen = true;
      if (!uhr) uhr = setTimeoutImpl(() => { uhr = null; if (unterbrochen) band(); }, VERZOEGERUNG_MS);
      return;
    }
    if (status === 'SUBSCRIBED') {
      if (uhr) { clearTimeoutImpl(uhr); uhr = null; }
      doc.getElementById(BAND_ID)?.remove();
      if (unterbrochen) { unterbrochen = false; try { nachholen(); } catch { /* Nachladen ist Zusatz */ } }
    }
  };
}
