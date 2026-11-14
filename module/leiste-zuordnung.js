/** Gruppenzuordnung der Seitenleiste im NEUEN Design (PLAN-V2 §3.2, Melih 12.11.2026: „nur im neuen Design").
 * Reine, DOM-freie Funktionen. nav-registry.js bleibt Autorität; der Shell-Adapter hängt nur um,
 * was im DOM vorhanden ist, und stellt beim Abschalten die Registry-Ausgabe wieder her.
 */
/** @type {Record<string, string>} */
export const ZIEL_GRUPPE = Object.freeze({
  'podologie-billing': 'uebersicht', verordnungen: 'patienten', services: 'team', fahrtenbuch: 'team', b2b: 'team', doctors: 'team', b2c: 'team',
});
/** @type {Record<string, string>} */
const ANKER = Object.freeze({ 'podologie-billing': 'overview', verordnungen: 'kunden' });
const REIHE = Object.keys(ZIEL_GRUPPE);

/**
 * @param {string} panelId
 * @returns {string | null}
 */
export const zielGruppe = (panelId) => Object.hasOwn(ZIEL_GRUPPE, panelId) ? ZIEL_GRUPPE[panelId] : null;

/**
 * @param {string} panelId
 * @returns {string | null}
 */
export const ankerNach = (panelId) => Object.hasOwn(ANKER, panelId) ? ANKER[panelId] : null;

/**
 * @typedef {Object} LeisteEintrag
 * @property {string} panel
 * @property {string} gruppe
 */

/**
 * @typedef {Object} UmzugsPlan
 * @property {string} panel
 * @property {string} von
 * @property {string} nach
 * @property {string | null} hinter
 */

/**
 * eintraege: [{panel, gruppe}] in DOM-Reihenfolge → [{panel, von, nach, hinter}] (hinter = Anker-Panel oder null = ans Ende).
 * @param {LeisteEintrag[]} eintraege
 * @returns {UmzugsPlan[]}
 */
export function planeUmzug(eintraege) {
  const gruppen = new Set(eintraege.map(e => e.gruppe));
  const vorhanden = new Set(eintraege.map(e => e.panel));
  /** @type {UmzugsPlan[]} */
  const plan = [];
  for (const panel of REIHE) {
    const e = eintraege.find(x => x.panel === panel);
    const nach = ZIEL_GRUPPE[panel];
    if (!e || e.gruppe === nach || !gruppen.has(nach)) continue;
    const anker = ankerNach(panel);
    plan.push({ panel, von: e.gruppe, nach, hinter: anker && vorhanden.has(anker) ? anker : null });
  }
  return plan;
}
