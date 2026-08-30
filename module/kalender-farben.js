/**
 * kalender-farben.js — welche Farbe ein Terminblock bekommt.
 *
 * Warum es das gibt
 * ─────────────────
 * Der Kalender färbte bis zum 22.08.2026 überall nach **Mitarbeiter**
 * (`EMP_COLORS`). Die Praxis will aber auf einen Blick sehen, *was* stattfindet,
 * nicht *wer* es macht — Rückmeldung aus der Beta: „Leistungen bzw. Termintypen
 * müssen farblich unterscheidbar sein."
 *
 * Der Haken daran, und der Grund für dieses Modul: in Wochen- und
 * Monatsansicht ist die Farbe die **einzige** Mitarbeiterunterscheidung. Dort
 * sind die Spalten Tage, nicht Personen. Färbt man einfach nach Leistung um,
 * verliert man diese Information ersatzlos.
 *
 * Deshalb tragen die Blöcke jetzt beides:
 *
 *     Fläche      = Leistungsfarbe   (services.color)
 *     linker Rand = Mitarbeiterfarbe (EMP_COLORS)
 *
 * In der Tagesansicht ist der Rand Redundanz — dort trennen bereits die
 * Spalten nach Mitarbeiter. Er bleibt trotzdem, damit alle drei Ansichten
 * dieselbe Sprache sprechen.
 *
 * Rückfall: hat eine Leistung keine Farbe (oder hängt am Termin gar keine
 * Leistung), färbt die Fläche wie früher nach Mitarbeiter. Nie „unsichtbar".
 */

/**
 * Farbe mit Deckkraft für die Blockfläche.
 *
 * Nicht einfach `farbe + '22'`: die Mitarbeiterfarbe fällt auf
 * `var(--primary)` zurück, sobald ein Termin zu niemandem aus `teamMembers`
 * gehört (ausgeschiedener Mitarbeiter, mehr Mitarbeiter als Farben). Aus
 * `var(--primary)22` wird kein Farbwert — der Block hätte gar keine Fläche
 * mehr und wäre nur noch am linken Rand zu erkennen.
 *
 * Dreistellige Kurzform (`#abc`) geht bewusst denselben Weg: `#abc` + `22`
 * ergäbe `#abc22`, also eine völlig andere Farbe.
 */
export function mitDeckkraft(farbe, hexSuffix = '22', anteil = '13%') {
  return /^#[0-9a-fA-F]{6}$/.test(farbe)
    ? farbe + hexSuffix
    : `color-mix(in srgb, ${farbe} ${anteil}, transparent)`;
}

/**
 * Fläche und Rand für einen Termin.
 *
 * @param {object} termin
 * @param {object} o
 * @param {Array}  o.teamMembers
 * @param {Array}  o.empFarben        EMP_COLORS
 * @param {Map}    [o.leistungFarben] service_id -> color, für Ansichten, die
 *                                    `services(color)` nicht mitladen
 * @returns {{flaeche: string, rand: string, quelle: 'leistung'|'mitarbeiter'}}
 */
export function terminFarben(termin, { teamMembers = [], empFarben = [], leistungFarben = null } = {}) {
  const idx = teamMembers.findIndex(e => e.id === termin?.user_id);
  const mitarbeiter = (idx >= 0 && empFarben.length)
    ? empFarben[idx % empFarben.length]
    : 'var(--primary)';

  const leistung = termin?.services?.color
    || (leistungFarben && termin?.service_id ? leistungFarben.get(termin.service_id) : null)
    || null;

  return {
    flaeche: leistung || mitarbeiter,
    rand: mitarbeiter,
    quelle: leistung ? 'leistung' : 'mitarbeiter',
  };
}

/**
 * Die Standardfarben für den Farbwähler in der Leistungsmaske.
 *
 * Bewusst wenige und gut unterscheidbare: eine Praxis mit zwanzig Leistungen
 * braucht keine zwanzig Farben, sondern eine Handvoll, die man im Vorbeigehen
 * auseinanderhält. Wer eine eigene will, nimmt das Farbfeld daneben.
 */
export const LEISTUNG_FARBEN = [
  '#22c55e', '#3b82f6', '#f59e0b', '#a855f7',
  '#ef4444', '#14b8a6', '#ec4899', '#64748b',
];
