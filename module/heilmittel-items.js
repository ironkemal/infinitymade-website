/**
 * heilmittel-items.js — Lesehelfer für `prescriptions.heilmittel_items`.
 *
 * `heilmittel_items` ist die podologische Ablage der verordneten Positionen:
 * eine jsonb-Liste `[{code, bezeichnung, anzahl, massnahme}]`. Der podologische
 * Zweig führt Heilmittel-Klartext UND Positionsnummer AUSSCHLIESSLICH dort —
 * die Spalten `heilmittel` und `heilmittel_position` bleiben leer.
 *
 * Blattmodul mit Absicht: keine eigenen Importe, damit `verordnung-maske.js`,
 * `verordnung-pruefung.js` und `module/rezeptinfo-geld.js` (Terminpanel) sich
 * hier treffen, statt einer der drei die anderen zu importieren.
 * Vorher `erstePositionAusItems`/`heilmittelAusItems` zweimal, zeichengleich,
 * in Maske und Prüfung — hierher zusammengezogen (Ops #277, 09.09.2026).
 */

/**
 * Erste Position aus `heilmittel_items` (jsonb: `[{code, bezeichnung, anzahl,
 * massnahme}]`, siehe verordnung-detail.js) — der podologische Zweig führt die
 * Position dort, nicht in der Spalte `heilmittel_position`.
 */
export function erstePositionAusItems(items) {
  if (!Array.isArray(items) || !items.length) return '';
  const erste = items[0];
  return (typeof erste === 'string' ? erste : erste?.code) || '';
}

/**
 * Der Klartext des verordneten Heilmittels aus `heilmittel_items`.
 *
 * Die podologische Maske schreibt das verordnete Heilmittel AUSSCHLIESSLICH
 * dorthin; die Spalte `heilmittel` bleibt dann leer. Ohne diesen Rückgriff
 * meldete die Prüfung „Verordnetes Heilmittel fehlt" bei jeder Verordnung, die
 * über die Podologie-Abrechnung angelegt wurde — ein Blocker über eine
 * vollständig ausgefüllte Verordnung.
 */
export function heilmittelAusItems(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return items
    .map(i => (typeof i === 'string' ? i : (i?.bezeichnung || i?.code || '')))
    .filter(Boolean)
    .join(' · ');
}
