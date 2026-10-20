/**
 * kalender-auswahl.js — der geöffnete Termin bleibt im Kalender markiert.
 *
 * Warum es das gibt
 * ─────────────────
 * Ein Klick auf einen Terminblock öffnet rechts den Seitenbereich, aber der
 * Block selbst sah danach aus wie alle anderen. Bei sechs Terminen am
 * Vormittag musste man den Namen im Panel mit dem Raster abgleichen, um zu
 * wissen, wovon das Panel gerade spricht. Der freigegebene Kalender-Entwurf
 * (Kemal, 20.10.2026) markiert deshalb den geöffneten Termin.
 *
 * Drei Stolpersteine, die dieses Modul abfängt
 * ────────────────────────────────────────────
 *  1. Alle drei Blockarten rufen beim Klick `stopPropagation()` (dashboard.js,
 *     kalender-woche.js, kalender-monat.js). Ein normaler Klick-Listener am
 *     Dokument hört davon nichts — er hängt deshalb in der Capture-Phase.
 *  2. Realtime und Speichern zeichnen die Ansichten neu; die Blöcke werden
 *     ersetzt und die Klasse geht verloren. Gemerkt wird darum die Termin-Id,
 *     und nach jedem Neuzeichnen wird sie wieder angelegt.
 *  3. Für das Schliessen des Seitenbereichs gibt es kein Signal
 *     (`closeBkActionPanel` in dashboard.js sendet nichts). Statt dashboard.js
 *     zu vergrössern, beobachtet das Modul `display`/`hidden` des Panels —
 *     dieselbe Regel wie `isBkActionOpen()` dort.
 *
 * Aussehen: `.termin-gewaehlt` in dashboard-feinschliff.css.
 */

export const AUSWAHL_KLASSE = 'termin-gewaehlt';

/** Ist der Seitenbereich sichtbar? Gleiche Regel wie isBkActionOpen(). */
export function panelOffen(el) {
  return !!el && el.style.display !== 'none' && !el.hidden;
}

/**
 * Markiert genau die Blöcke des Termins `id` und nimmt die Markierung
 * überall sonst weg. Gibt die Zahl der markierten Blöcke zurück.
 */
export function markiere(bloecke, id) {
  let treffer = 0;
  for (const el of bloecke) {
    const an = id != null && el?._termin?.id === id;
    el.classList.toggle(AUSWAHL_KLASSE, an);
    if (an) treffer += 1;
  }
  return treffer;
}

/**
 * Einmal aufrufen, wenn die Kalenderbehälter im DOM stehen.
 * `selektor` und `behaelterIds` kommen aus kalender-kontextmenue.js, damit es
 * nur EINE Liste dessen gibt, was als Termin zählt.
 */
export function verdrahteAuswahl({ selektor, behaelterIds, panelId = 'bkActionModal' }) {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.body.dataset.terminAuswahl) return;
  document.body.dataset.terminAuswahl = '1';

  let gewaehlt = null;
  const anwenden = () => markiere(document.querySelectorAll(selektor), gewaehlt);

  document.addEventListener('click', (ev) => {
    const el = ev.target?.closest?.(selektor);
    if (!el || !el._termin) return;
    gewaehlt = el._termin.id;
    anwenden();
  }, true);

  // Nur childList: das Setzen der Klasse selbst löst den Beobachter nicht aus.
  const neuGezeichnet = new MutationObserver(() => { if (gewaehlt != null) anwenden(); });
  for (const id of behaelterIds) {
    const behaelter = document.getElementById(id);
    if (behaelter) neuGezeichnet.observe(behaelter, { childList: true, subtree: true });
  }

  const panel = document.getElementById(panelId);
  if (panel) {
    new MutationObserver(() => {
      if (gewaehlt != null && !panelOffen(panel)) {
        gewaehlt = null;
        anwenden();
      }
    }).observe(panel, { attributes: true, attributeFilter: ['style', 'hidden'] });
  }
}
