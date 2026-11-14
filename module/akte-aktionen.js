/**
 * V7.02: Akte → vorhandene Doku-Formulare mit aktuellem Patienten (nur Design „neu“).
 * Herkunft: Rettungsbranch 4024addc (module/akte-aktionen.js), auf main angepasst (V7.02p, 14.11.2026).
 * Besitzt ausschließlich Aktionszeilen und Listener, keine Abfragen/Schreibwege; ruft nur vorhandene Öffner auf.
 * Auflagen guvenlik (14.11.2026):
 *  1. Rechte kommen aus derselben Zuordnung wie der Panelwechsel (SIDEBAR_TO_MODULE + hasModuleAccess):
 *     darfPanel(panelId) bildet die switchPanel-Prüfung ab. Anamnese → Panel anamnese, Fußbefund → fussstatus
 *     (Recht anamnese, nicht abrechnung), Notiz → notizen.
 *  2. Ein Knopf öffnet nichts, wenn der Panelwechsel verweigert würde (beim Montieren und beim Klick geprüft,
 *     Kontext-Schnappschuss wie in der Quelle).
 *  3. „Notiz schreiben“ nur für Inhaber (Datenbank-Policy erlaubt Angestellten keine Notizen).
 *  4. Keine neuen Abfragen/Schreibwege.
 */
const AKTIONEN = [
  { art: 'anamnese', panel: 'pdPanelAnamnese', ziel: 'anamnese', text: 'Anamnese bearbeiten' },
  { art: 'notizen', panel: 'pdPanelNotes', ziel: 'notizen', text: 'Notiz schreiben', nurOwner: true },
  { art: 'fussbefund', panel: 'pdPanelFussbefund', ziel: 'fussstatus', text: 'Fußbefund erfassen', podo: true },
];

function kontextSchluessel(k) {
  if (!k || !['owner', 'employee'].includes(k.role) || !k.uid || !k.ownerId || !k.leadId) return null;
  return JSON.stringify([k.role, k.uid, k.ownerId, k.leadId, k.businessId, k.sharing, k.sector]);
}

/**
 * Nach setzeAkteReiter montieren.
 * kontext(): {role,uid,ownerId,leadId,businessId,sharing,sector}; darfPanel(panelId): boolean (wie switchPanel).
 * oeffnen(art, leadId) verwendet vorhandenen Öffner; fehler() zeigt festen Hinweis.
 */
let designWache = null;
/** Wechsel auf Alt bei offener Akte: Knöpfe sofort entfernen (sonst stünden sie ungestylt im Alt-Design). */
function wacheDesign(doc) {
  if (designWache || typeof MutationObserver === 'undefined') return;
  designWache = new MutationObserver(() => {
    if (doc.documentElement.dataset.design !== 'neu') for (const zeile of doc.querySelectorAll('.px-akte-aktionen')) zeile.remove();
  });
  designWache.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-design'] });
}

export function montiereAkteAktionen({ kontext, darfPanel, oeffnen, fehler }, doc = document) {
  for (const zeile of doc.querySelectorAll('.px-akte-aktionen')) zeile.remove();
  if (doc.documentElement.dataset.design !== 'neu') return;
  wacheDesign(doc);
  let snapshot;
  try { snapshot = kontext(); } catch { return; }
  const schluessel = kontextSchluessel(snapshot);
  if (!schluessel) return;
  const erlaubt = a => {
    if (a.nurOwner && snapshot.role !== 'owner') return false;
    try { return darfPanel(a.ziel) === true; } catch { return false; }
  };
  let laeuft = false;
  for (const a of AKTIONEN) {
    const panel = doc.getElementById(a.panel);
    if (!panel || !erlaubt(a) || (a.podo && snapshot.sector !== 'podologie')) continue;
    const zeile = doc.createElement('div'); zeile.className = 'px-akte-aktionen';
    const knopf = doc.createElement('button'); knopf.type = 'button';
    knopf.className = 'btn-outline-sm'; knopf.textContent = a.text;
    knopf.addEventListener('click', async () => {
      let aktuell;
      try { aktuell = kontext(); } catch { return; }
      if (laeuft || !knopf.isConnected || doc.documentElement.dataset.design !== 'neu'
        || schluessel !== kontextSchluessel(aktuell) || !erlaubt(a)) return;
      laeuft = true; knopf.disabled = true;
      try { await oeffnen(a.art, snapshot.leadId); }
      catch { fehler?.(); }
      finally { laeuft = false; if (knopf.isConnected) knopf.disabled = false; }
    });
    zeile.append(knopf); panel.prepend(zeile);
  }
}
