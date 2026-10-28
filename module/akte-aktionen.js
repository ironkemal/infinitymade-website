/**
 * V7.02: Akte → vorhandene Doku-Formulare mit aktuellem Patienten.
 * Besitzt ausschließlich Aktionszeilen und Listener, keine Fachqueries/Writer.
 * Rechtepolitik und Patientenauswahl bleiben beim aufrufenden Dashboard.
 */
const AKTIONEN = [
  { art: 'anamnese', panel: 'pdPanelAnamnese', recht: 'anamnese', text: 'Anamnese bearbeiten' },
  { art: 'notizen', panel: 'pdPanelNotes', recht: 'notes', text: 'Notiz schreiben' },
  { art: 'fussbefund', panel: 'pdPanelFussbefund', recht: 'abrechnung', text: 'Fußbefund erfassen', podo: true },
];

function kontextSchluessel(k) {
  if (!k || !['owner', 'employee'].includes(k.role) || !k.uid || !k.ownerId || !k.leadId) return null;
  return JSON.stringify([k.role, k.uid, k.ownerId, k.leadId, k.businessId, k.sharing, k.sector]);
}

/**
 * Nach setzeAkteReiter montieren; Zeilen bleiben außerhalb überschreibbarer Inhalte.
 * kontext(): {role,uid,ownerId,leadId,businessId,sharing,sector}; darf(recht): boolean.
 * oeffnen(art, leadId) verwendet vorhandenen Öffner; fehler() zeigt festen Hinweis.
 * Snapshot beim Klick erneut prüfen, bevor oeffnen Modal/Vorwahl verändert.
 */
export function montiereAkteAktionen({ kontext, darf, oeffnen, fehler }, doc = document) {
  for (const zeile of doc.querySelectorAll('.px-akte-aktionen')) zeile.remove();
  if (doc.documentElement.dataset.design !== 'neu') return;
  let snapshot;
  try { snapshot = kontext(); } catch { return; }
  const schluessel = kontextSchluessel(snapshot);
  if (!schluessel) return;
  const erlaubt = recht => { try { return darf(recht) === true; } catch { return false; } };
  let laeuft = false;
  for (const a of AKTIONEN) {
    const panel = doc.getElementById(a.panel);
    if (!panel || !erlaubt(a.recht) || (a.podo && snapshot.sector !== 'podologie')) continue;
    const zeile = doc.createElement('div'); zeile.className = 'px-akte-aktionen';
    const knopf = doc.createElement('button'); knopf.type = 'button';
    knopf.className = 'btn-outline-sm'; knopf.textContent = a.text;
    knopf.addEventListener('click', async () => {
      let aktuell;
      try { aktuell = kontext(); } catch { return; }
      if (laeuft || !knopf.isConnected || doc.documentElement.dataset.design !== 'neu'
        || schluessel !== kontextSchluessel(aktuell) || !erlaubt(a.recht)) return;
      laeuft = true; knopf.disabled = true;
      try { await oeffnen(a.art, snapshot.leadId); }
      catch { fehler?.(); }
      finally { laeuft = false; if (knopf.isConnected) knopf.disabled = false; }
    });
    zeile.append(knopf); panel.prepend(zeile);
  }
}
