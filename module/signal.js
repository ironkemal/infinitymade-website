/**
 * signal.js — THE data-change bus for the whole frontend.
 *
 * Warum es das gibt
 * ─────────────────
 * Bis heute musste nach jedem Schreibvorgang die Oberfläche VON HAND
 * nachgezogen werden: `getElementById` suchen, `innerHTML` setzen, die
 * passende `refresh*`-Funktion nicht vergessen. `dashboard.js` enthält
 * 2.097 `getElementById`-Aufrufe — jeder davon ist eine Stelle, an der
 * man das Nachziehen vergessen KANN. Genau daraus entsteht der mit
 * Abstand häufigste Fehler des Produkts:
 *
 *     "Ich habe gespeichert, aber auf dem Bildschirm steht noch das Alte."
 *
 * Ein Framework löst das über einen State-Layer. Wir bleiben bei Vanilla
 * (Konsey-Beschluss 2026-08-13, siehe
 * `konsey/tutanak/2026-08-13-frontend-mimari-katman.md`), also übernimmt
 * diese Datei genau diese eine Aufgabe — und sonst nichts:
 *
 *     Wer schreibt, MELDET.   Wer anzeigt, HÖRT ZU.
 *
 * Die schreibende Stelle muss nicht mehr wissen, welche Panels es gibt.
 * Ein neues Panel abonniert einfach das Thema und ist ab sofort aktuell.
 *
 * Bewusst NICHT enthalten
 * ───────────────────────
 * Kein State-Store, kein Rendering, kein Virtual DOM, keine Abhängigkeit.
 * Reines Publish/Subscribe. Der Beschluss verlangt ausdrücklich ein
 * kleines, prüfbares Stück Code statt einer neuen Bibliothek — es muss
 * auch in der On-Premise-Version ohne Internet laufen.
 *
 * Themen-Konvention:  '<tabelle>:<ereignis>'
 *     'bookings:changed'  ·  'profiles:changed'  ·  'verordnungen:changed'
 * Tabellenname = DB-Wahrheit (Achtung: Patienten liegen in `leads`,
 * siehe `db/README.md`).
 *
 * Verwendung
 * ──────────
 *     import { on, emit } from './module/signal.js?v=20260813';
 *
 *     // Anzeigende Seite — einmal beim Aufbau registrieren:
 *     on('bookings:changed', () => refreshBookingViews());
 *
 *     // Schreibende Seite — direkt nach dem erfolgreichen Schreiben:
 *     await supabase.from('bookings').insert(row);
 *     emit('bookings:changed', { id: row.id });
 *
 * Warum `emit()` nicht sofort ausführt
 * ────────────────────────────────────
 * Ein Speichervorgang meldet oft mehrfach (Termin + Patient + Zähler).
 * Würde jede Meldung sofort feuern, liefe `refreshBookingViews()`
 * dreimal — drei Datenbankrunden für dasselbe Ergebnis. Deshalb werden
 * Meldungen desselben Themas innerhalb eines Ticks zu EINEM Aufruf
 * zusammengefasst. Wer die Ausnahme braucht: `emitSync()`.
 */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/** @type {Map<string, any>} Themen, die in diesem Tick noch feuern müssen. */
const pending = new Map();

let flushScheduled = false;

/** Auf true setzen, um jede Meldung in der Konsole mitzulesen. */
export let debug = false;

/** @param {boolean} on */
export function setDebug(on) { debug = !!on; }

/**
 * Abonniert ein Thema.
 * @param {string} topic
 * @param {(detail?: any) => void} handler
 * @returns {() => void} Abmelde-Funktion
 */
export function on(topic, handler) {
  if (typeof topic !== 'string' || !topic) throw new TypeError('signal.on: topic muss ein nicht-leerer String sein');
  if (typeof handler !== 'function') throw new TypeError('signal.on: handler muss eine Funktion sein');

  let set = listeners.get(topic);
  if (!set) { set = new Set(); listeners.set(topic, set); }
  set.add(handler);

  return () => off(topic, handler);
}

/**
 * Abonniert ein Thema für genau eine Meldung.
 * @param {string} topic
 * @param {(detail?: any) => void} handler
 * @returns {() => void} Abmelde-Funktion
 */
export function once(topic, handler) {
  const unsubscribe = on(topic, (detail) => { unsubscribe(); handler(detail); });
  return unsubscribe;
}

/**
 * Meldet ab. Ohne `handler` werden ALLE Zuhörer des Themas entfernt.
 * @param {string} topic
 * @param {Function} [handler]
 */
export function off(topic, handler) {
  const set = listeners.get(topic);
  if (!set) return;
  if (handler) set.delete(handler); else set.clear();
  if (!set.size) listeners.delete(topic);
}

/**
 * Meldet eine Datenänderung. Zuhörer laufen am Ende des aktuellen Ticks;
 * mehrfache Meldungen desselben Themas werden zu einem Aufruf verdichtet
 * (der zuletzt übergebene `detail` gewinnt).
 * @param {string} topic
 * @param {any} [detail]
 */
export function emit(topic, detail) {
  if (typeof topic !== 'string' || !topic) throw new TypeError('signal.emit: topic muss ein nicht-leerer String sein');
  if (debug) console.debug('[signal] emit', topic, detail);

  pending.set(topic, detail);

  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flush);
  }
}

/**
 * Wie `emit()`, aber sofort — ohne Verdichtung. Nur nutzen, wenn der
 * Aufrufer sich darauf verlässt, dass die Oberfläche in derselben Zeile
 * schon nachgezogen ist. Im Normalfall `emit()` verwenden.
 * @param {string} topic
 * @param {any} [detail]
 */
export function emitSync(topic, detail) {
  if (debug) console.debug('[signal] emitSync', topic, detail);
  deliver(topic, detail);
}

function flush() {
  flushScheduled = false;
  const batch = [...pending.entries()];
  pending.clear();
  for (const [topic, detail] of batch) deliver(topic, detail);
}

/**
 * Ein defekter Zuhörer darf die anderen nicht mitreißen: Fehler werden
 * gemeldet, aber verschluckt. Sonst würde ein Panel mit Fehler dafür
 * sorgen, dass alle anderen Panels veraltet stehen bleiben — also genau
 * der Fehler, den diese Datei verhindern soll.
 */
function deliver(topic, detail) {
  const set = listeners.get(topic);
  if (!set || !set.size) {
    if (debug) console.debug('[signal] kein Zuhörer für', topic);
    return;
  }
  for (const handler of [...set]) {
    try {
      handler(detail);
    } catch (err) {
      console.error(`[signal] Zuhörer für "${topic}" ist gescheitert:`, err);
      if (typeof window !== 'undefined' && window.Sentry?.captureException) {
        window.Sentry.captureException(err, { tags: { signal_topic: topic } });
      }
    }
  }
}

/**
 * Nur für Tests und Fehlersuche — meldet alles ab.
 */
export function _reset() {
  listeners.clear();
  pending.clear();
  flushScheduled = false;
}

/**
 * Nur für Fehlersuche: welche Themen hat gerade wie viele Zuhörer.
 * @returns {Record<string, number>}
 */
export function _inspect() {
  const out = {};
  for (const [topic, set] of listeners) out[topic] = set.size;
  return out;
}
