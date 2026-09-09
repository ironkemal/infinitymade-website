/**
 * abrechnung-ansicht.js — der Umschalter zwischen den drei Ansichten des
 * gemeinsamen §302-Bildschirms: Einstieg (zwei Knöpfe) · Neu (Kassen-Auswahl)
 * · Bisherige (Archiv, obere/untere Hälfte).
 *
 * Warum eine eigene, kleine Datei statt eines bestehenden Umschalters
 * ─────────────────────────────────────────────────────────────────────
 * `ABRECHNUNG_BILDSCHIRM_PLAN.md` (Phase 0.3) verbietet ausdrücklich zwei
 * Dinge: `setWizardStep()` (dashboard.js) weiterzuverwenden — die gehört zum
 * 4-Stufen-Assistenten von Physio/Ergo/Logo und schreibt in `_abState`, eine
 * andere Sache als „welche der drei Ansichten ist gerade offen" — und einen
 * SIEBTEN handgeschriebenen Umschalter zu eröffnen. Im Code gab es beim
 * Zählen (08.09.2026) bereits sechs eigenständige Auf/Zu-Schalter
 * (Patientenakte-Reiter, Team-Detail, Fahrtenbuch, Termin-Anfragen,
 * Sitzungen, der §302-Assistent selbst). Diese Datei ist die erste, die für
 * genau EINEN Bildschirm gebaut ist und nicht mehr — kein allgemeines
 * Tab-Framework, das wäre eine Abstraktion, die niemand sonst braucht.
 *
 * Anders als `verdrahteSitzungsUmschalter()` (`sitzungen-ansicht.js`) trifft
 * dieser Umschalter KEINE automatische Vorauswahl anhand von Zahlen — der
 * Auftrag verlangt ausdrücklich, dass der Einstieg immer zuerst erscheint
 * ("ilk başta sana iki seçenek sunacak"), nicht dass er bei leerer Liste
 * übersprungen wird.
 *
 * Verdrahtet wird das Markup erst in Phase 1 — diese Datei ist Unterbau ohne
 * sichtbares Verhalten, solange `dashboard.html` noch keine
 * `data-ab-ansicht`/`data-ab-goto`-Attribute trägt.
 */

/** Die drei gültigen Ansichten. Reihenfolge ist die natürliche Rückwärts-Route. */
export const AB_ANSICHTEN = ['einstieg', 'neu', 'bisherige'];

let aktuell = 'einstieg';

/**
 * Reine Prüfung: ist `ziel` eine gültige Ansicht? Unbekanntes fällt auf den
 * Einstieg zurück — der ist immer sicher zu zeigen, jede andere Ansicht
 * braucht Daten, die beim Zurückfallen nicht garantiert geladen sind.
 * @param {string} ziel
 * @returns {string}
 */
export function normalisiereAnsicht(ziel) {
  return AB_ANSICHTEN.includes(ziel) ? ziel : 'einstieg';
}

/** Aktuell sichtbare Ansicht. */
export function aktuelleAbrechnungAnsicht() {
  return aktuell;
}

/**
 * Zeigt eine Ansicht und blendet die anderen aus.
 * Elemente werden über `[data-ab-ansicht]` gefunden; passt der Wert nicht
 * zur Zielansicht, bekommen sie `hidden` gesetzt (Projektkonvention: `hidden`
 * togglen, nicht `style.display`).
 * @param {string} ziel
 */
export function zeigeAbrechnungAnsicht(ziel) {
  aktuell = normalisiereAnsicht(ziel);
  document.querySelectorAll('[data-ab-ansicht]').forEach(el => {
    el.hidden = el.dataset.abAnsicht !== aktuell;
  });
  return aktuell;
}

/**
 * Verdrahtet Klicks auf `[data-ab-goto]` innerhalb von `root` per
 * Event-Delegation — einmal je Sitzung, wie `verdrahteSitzungsUmschalter()`.
 * @param {ParentNode} [root=document]
 */
export function wireAbrechnungAnsicht(root = document) {
  if (!root || root.dataset?.abAnsichtWired === '1') return;
  if (root.dataset) root.dataset.abAnsichtWired = '1';

  root.addEventListener('click', (e) => {
    const knopf = e.target.closest('[data-ab-goto]');
    if (!knopf) return;
    zeigeAbrechnungAnsicht(knopf.dataset.abGoto);
  });
}

/** Nur für Tests: Zustand zurücksetzen. */
export function _setzeAbrechnungAnsichtZurueck() {
  aktuell = 'einstieg';
}
