/**
 * termin-dauer.js — das Dauer-Feld der Terminmaske: ein Zahlenfeld statt Radio-Pillen.
 *
 * Beta-Feedback, 03.09.2026: „wir wollen das nicht als Checkbox — da soll eine
 * offene Box sein, die Schätzung kommt automatisch rein, aber man kann sie
 * überschreiben. Und wenn wir die vorherigen Eingaben für die Leistung
 * merken könnten, wäre die erste Schätzung sowieso egal."
 *
 * Vorher war `#bkDurationOptions` ein Satz Radiobuttons: `updateBkDuration()`
 * in dashboard.js baute sie aus `price_config.durations`, bei mehreren
 * Leistungen schrieb `aktualisiereDauer()` (termin-leistungen.js) die Summe
 * hinein, dazwischen ein MutationObserver als Schiedsrichter — der stand da,
 * weil das Zusammenspiel schon einmal eine Endlosschleife erzeugt hat.
 * Sieben Stellen lasen `input[type=radio]:checked` direkt.
 *
 * Jetzt gibt es ein einziges Feld (`#bkDurationValue`) und einen einzigen
 * Zugriffsweg: `leseDauer()` / `setzeDauer()`. Kein innerHTML-Ersatz mehr,
 * also auch kein MutationObserver-Bedarf mehr — die Endlosschleife ist mit
 * der Ursache verschwunden, nicht nur mit dem Schiedsrichter.
 *
 * ── Woher die Schätzung kommt, zweite Runde (03.09.2026) ───────────────────
 * Erste Fassung lernte aus `end_time - start_time`. Falscher Ansatz: Termine
 * starten und enden im Betrieb automatisch (kein Checkout), `end_time` ist
 * hier IMMER genau das, was beim Anlegen im Dauer-Feld stand — egal ob die
 * anwesende Person es sich angesehen und bewusst so gelassen hat oder ob es
 * einfach der Vorschlag war, an dem niemand etwas geaendert hat. Ohne
 * Unterscheidung lernt die Funktion aus ihrer eigenen letzten Ausgabe — ein
 * falscher erster Vorschlag haette sich selbst bestaetigt.
 *
 * Deshalb schreibt der Speicherpfad jetzt `bookings.dauer_quelle` mit
 * ('vorschlag' | 'manuell' | 'serie' | NULL, siehe db/REGISTER.md → bookings).
 * `manuell` heisst: in DIESER Maskensitzung wurde das Feld tatsaechlich per
 * Tastatur angefasst (`_beruehrt` unten), nicht nur ein Vorschlag akzeptiert.
 * `gelernteDauer()` liest nur `manuell` — das ist die einzige Stelle im System,
 * an der ein Mensch eine Dauer bewusst entschieden hat.
 *
 * `_beruehrt` merkt sich das nur fuer die aktuell offene Maske. Beim
 * Bearbeiten eines bestehenden Termins uebernimmt `uebernehmeDauerQuelle()`
 * den gespeicherten Wert, damit ein Speichern ohne Beruehren der Dauer eine
 * fruehere `manuell`-Markierung nicht verliert.
 */

/** Fallback-Dauer, wenn weder Historie noch price_config etwas hergeben. */
export const STANDARD_DAUER_MIN = 30;

/** Wie viele vergangene Einzeltermine hoechstens in den Median einfliessen. */
const HISTORIE_LIMIT = 8;

/**
 * Mindestzahl manueller Eintraege, bevor der Median als Vorschlag gilt.
 * Unter drei Werten ist „Median" nur ein einzelner Zufallstreffer — und wer
 * eine Leistung immer nur bei schwierigen Faellen laenger einplant, wuerde
 * mit einem einzigen Ausreisser gleich allen anderen die falsche Zahl
 * vorschlagen (Einwand db-ustasi, 03.09.2026).
 */
const MINDEST_STICHPROBE = 3;

/** Wurde das Dauer-Feld in der aktuell offenen Maske von Hand angefasst? */
let _beruehrt = false;

/** Zuhoerer einmalig einhaengen. Wird aus dashboard.js gerufen (wie mountTerminLeistungen). */
export function mountTerminDauer() {
  document.getElementById('bkDurationValue')?.addEventListener('input', () => {
    _beruehrt = true;
  });
}

/** Aktueller Wert des Dauer-Felds, in Minuten (0, wenn leer/ungueltig). */
export function leseDauer() {
  const el = document.getElementById('bkDurationValue');
  const n = parseInt(el?.value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Dauer-Feld setzen und die Gruppe sichtbar machen. Zaehlt als neuer
 * Vorschlag — setzt `_beruehrt` zurueck. Wer danach eine gespeicherte
 * `manuell`-Markierung uebernehmen will, ruft `uebernehmeDauerQuelle()` DANACH.
 *
 * @param {number} minuten
 * @param {string} [hinweis]  z.B. „aus 5 bisherigen Terminen" — steht klein unter dem Feld.
 */
export function setzeDauer(minuten, hinweis = '') {
  const el = document.getElementById('bkDurationValue');
  const gruppe = document.getElementById('bkDurationGroup');
  if (!el) return;
  el.value = minuten > 0 ? String(minuten) : '';
  _beruehrt = false;
  if (gruppe) gruppe.hidden = false;
  const hinweisEl = document.getElementById('bkDurationHinweis');
  if (hinweisEl) {
    hinweisEl.textContent = hinweis;
    hinweisEl.hidden = !hinweis;
  }
}

/** Beim Oeffnen einer leeren Maske (neuer Termin ohne Vorauswahl) zuruecksetzen. */
export function setzeDauerQuelleZurueck() {
  _beruehrt = false;
}

/**
 * Beim Bearbeiten eines bestehenden Termins: dessen gespeicherten Ursprung
 * uebernehmen. Nur `'manuell'` zaehlt — alles andere (`'vorschlag'`, `'serie'`,
 * NULL/unbekannt) bleibt „noch nicht bewusst entschieden".
 * @param {?string} bestehendeQuelle  `booking.dauer_quelle` aus der DB.
 */
export function uebernehmeDauerQuelle(bestehendeQuelle) {
  _beruehrt = bestehendeQuelle === 'manuell';
}

/**
 * Fuer den Speicherpfad: was in `bookings.dauer_quelle` landet.
 * @returns {'manuell'|'vorschlag'}
 */
export function dauerQuelle() {
  return _beruehrt ? 'manuell' : 'vorschlag';
}

function median(werte) {
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2
    ? sortiert[mitte]
    : Math.round((sortiert[mitte - 1] + sortiert[mitte]) / 2);
}

/**
 * Median der letzten TATSAECHLICH von Hand eingegebenen Dauern fuer genau
 * diese Leistung — oder `null`, wenn (noch) nicht genug davon da sind.
 *
 * @param {{supabase:object, ownerId:string, serviceId:string}} deps
 * @returns {Promise<?{minuten:number, anzahl:number}>}
 */
export async function gelernteDauer({ supabase, ownerId, serviceId }) {
  if (!supabase || !ownerId || !serviceId) return null;

  // Doppelt so viel wie das Limit ziehen: Kombi-Termine (mehr als eine Zeile
  // in booking_leistungen) fallen gleich wieder raus, sonst waere die
  // Stichprobe bei aktiven Kombi-Nutzern zu duenn.
  const { data: buchungen } = await supabase.from('bookings')
    .select('id, start_time, end_time')
    .eq('owner_id', ownerId)
    .eq('service_id', serviceId)
    .eq('dauer_quelle', 'manuell')
    .eq('hausbesuch', false)
    .eq('is_group', false)
    .is('group_parent_id', null)
    .in('status', ['confirmed', 'completed'])
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false })
    .limit(HISTORIE_LIMIT * 2);
  if (!buchungen?.length) return null;

  const ids = buchungen.map(b => b.id);
  const { data: zeilen } = await supabase.from('booking_leistungen')
    .select('booking_id')
    .in('booking_id', ids);
  const anzahlProTermin = {};
  (zeilen || []).forEach(z => {
    anzahlProTermin[z.booking_id] = (anzahlProTermin[z.booking_id] || 0) + 1;
  });
  // Termine ohne eigene booking_leistungen-Zeile sind aeltere Einzeltermine
  // (Tabelle seit 03.09.2026) — zaehlen als eine Leistung, nicht als Kombi.

  const einzeln = buchungen
    .filter(b => (anzahlProTermin[b.id] || 1) <= 1)
    .slice(0, HISTORIE_LIMIT);
  if (einzeln.length < MINDEST_STICHPROBE) return null;

  const dauern = einzeln
    .map(b => Math.round((new Date(b.end_time) - new Date(b.start_time)) / 60000))
    .filter(d => d > 0 && d < 600); // >10h ist ein Datenfehler, kein Termin
  if (dauern.length < MINDEST_STICHPROBE) return null;

  return { minuten: median(dauern), anzahl: dauern.length };
}
