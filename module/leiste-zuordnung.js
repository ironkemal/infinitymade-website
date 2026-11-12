/** Gruppenzuordnung der Seitenleiste im NEUEN Design (PLAN-V2 §3.2, Melih 12.11.2026: „nur im neuen Design").
 * Reine, DOM-freie Funktionen. nav-registry.js bleibt Autorität; der Shell-Adapter hängt nur um,
 * was im DOM vorhanden ist, und stellt beim Abschalten die Registry-Ausgabe wieder her.
 */
export const ZIEL_GRUPPE = Object.freeze({
  'podologie-billing': 'uebersicht', verordnungen: 'patienten', services: 'team', fahrtenbuch: 'team', b2b: 'team', doctors: 'team', b2c: 'team',
});
const ANKER = Object.freeze({ 'podologie-billing': 'overview', verordnungen: 'kunden' });
const REIHE = Object.keys(ZIEL_GRUPPE);

export const zielGruppe = (panelId) => Object.hasOwn(ZIEL_GRUPPE, panelId) ? ZIEL_GRUPPE[panelId] : null;
export const ankerNach = (panelId) => Object.hasOwn(ANKER, panelId) ? ANKER[panelId] : null;

/** eintraege: [{panel, gruppe}] in DOM-Reihenfolge → [{panel, von, nach, hinter}] (hinter = Anker-Panel oder null = ans Ende). */
export function planeUmzug(eintraege) {
  const gruppen = new Set(eintraege.map(e => e.gruppe));
  const vorhanden = new Set(eintraege.map(e => e.panel));
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
