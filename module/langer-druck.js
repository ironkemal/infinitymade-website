/**
 * langer-druck.js — langes Drücken als Ersatz für den Doppelklick.
 *
 * Warum es das gibt
 * ─────────────────
 * Seit dem 22.08.2026 legt ein Doppelklick auf ein leeres Rasterfeld einen
 * Termin an (Wochen- und Monatsansicht). Auf einem Tablet gibt es diese Geste
 * praktisch nicht: `dblclick` feuert dort unzuverlässig, und die Praxis
 * bedient den Kalender am Empfang oft genau darauf. Ohne einen zweiten Weg
 * wäre die Funktion auf dem Gerät, auf dem sie am meisten gebraucht wird,
 * nicht erreichbar.
 *
 * Dieselbe Erkennung wird das Kontextmenü brauchen (Rechtsklick hat auf
 * Touch ebenfalls kein Gegenstück) — deshalb steht sie hier und nicht in der
 * Wochenansicht.
 *
 * Warum am Behälter und nicht am einzelnen Feld
 * ─────────────────────────────────────────────
 * Eine Woche hat 7 × 24 = 168 Rasterfelder, und sie werden bei jedem Zeichnen
 * neu gebaut. Fünf Zuhörer je Feld wären 840 Zuhörer, die bei jedem Wechsel
 * der Woche wegfallen und neu entstehen. Stattdessen hängt ein Satz Zuhörer
 * am Behälter, der stehen bleibt, und `closest()` sucht das getroffene Feld.
 */

/**
 * @param {Element}  behaelter   bleibt über Neuzeichnen hinweg bestehen
 * @param {string}   selektor    welches Kind gilt als Ziel (z. B. '.dv-slot')
 * @param {function} handler     (zielEl, ev) => void
 * @param {object}   [opt]
 * @param {number}   [opt.ms=500]          Haltedauer
 * @param {number}   [opt.toleranzPx=8]    darüber gilt es als Wischen
 * @param {boolean}  [opt.nurBeruehrung=true]  Maus auslassen (die hat dblclick)
 * @returns {function} Abmelden
 */
export function aufLangenDruck(behaelter, selektor, handler, opt = {}) {
  const { ms = 500, toleranzPx = 8, nurBeruehrung = true } = opt;
  if (!behaelter) return () => {};

  let timer = null;
  let startX = 0;
  let startY = 0;
  let ziel = null;
  let ausgeloest = false;

  const abbrechen = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    ziel = null;
  };

  const beiDruck = (ev) => {
    if (nurBeruehrung && ev.pointerType === 'mouse') return;
    const treffer = ev.target?.closest?.(selektor);
    if (!treffer || !behaelter.contains(treffer)) return;
    abbrechen();
    ziel = treffer;
    startX = ev.clientX;
    startY = ev.clientY;
    ausgeloest = false;
    timer = setTimeout(() => {
      timer = null;
      ausgeloest = true;
      const el = ziel;
      ziel = null;
      if (el) handler(el, ev);
    }, ms);
  };

  const beiBewegung = (ev) => {
    if (!timer) return;
    if (Math.abs(ev.clientX - startX) > toleranzPx || Math.abs(ev.clientY - startY) > toleranzPx) {
      abbrechen();
    }
  };

  // Nach dem Loslassen schickt der Browser noch ein `click`. Ohne diesen
  // Fänger liefe zusätzlich die Einfachklick-Handlung — in der Monatsansicht
  // also der Sprung in den Tag, direkt nach dem Öffnen der Terminmaske.
  const beiKlick = (ev) => {
    if (!ausgeloest) return;
    ausgeloest = false;
    ev.stopPropagation();
    ev.preventDefault();
  };

  behaelter.addEventListener('pointerdown', beiDruck);
  behaelter.addEventListener('pointermove', beiBewegung);
  behaelter.addEventListener('pointerup', abbrechen);
  behaelter.addEventListener('pointercancel', abbrechen);
  behaelter.addEventListener('click', beiKlick, true);

  return () => {
    abbrechen();
    behaelter.removeEventListener('pointerdown', beiDruck);
    behaelter.removeEventListener('pointermove', beiBewegung);
    behaelter.removeEventListener('pointerup', abbrechen);
    behaelter.removeEventListener('pointercancel', abbrechen);
    behaelter.removeEventListener('click', beiKlick, true);
  };
}
