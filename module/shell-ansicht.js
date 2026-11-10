/** Auth-nachgelagerter Adapter der bestätigten Shell. Originalnavigation bleibt Autorität.
 * Keine Datenabfrage, keine neue Rechtepolitik, kein Startseiten-/Formular-Autostart.
 * `uid`, `rolle`, `scope`, `name` sind Getter des aktuell geprüften Appkontexts.
 * Scopeabweichung sperrt den Adapter bis zum nächsten Seitenstart.
 */
import { verdrahteFlyout, kopfRollen, schliesseFlyout } from './leiste-flyout.js?v=20261110p01shell';
import { verdrahteProfil, profilAuffrischen } from './kopf-profil.js?v=20261110p01shell';
import { verdrahteNeu } from './kopf-neu.js?v=20261110p01shell';
import { verdrahteSchublade } from './schublade-neu.js?v=20261110p01shell';
import { montierePatientensuche } from './kopf-suche-ansicht.js?v=20261110p01shell';

const KURZ = { uebersicht: 'Heute', termine: 'Termine', patienten: 'Patienten', abrechnung: 'Abrechn.', team: 'Praxis', einstellungen: 'Einstell.' };
let instanz = null;

export function montiereShellansicht(k) {
  if (instanz) return instanz;
  const html = document.documentElement, nav = document.getElementById('sidebarNav');
  const leiste = document.getElementById('sidebar'), main = document.getElementById('mainArea');
  if (!nav || !leiste || !main || !k?.uid?.() || !['owner', 'employee'].includes(k.rolle?.()) || !k.scope?.()) return null;
  const scope = String(k.scope());
  const uid = String(k.uid()), rolle = k.rolle();
  let gesperrt = false;
  const aktiv = () => !gesperrt && html.dataset.design === 'neu' && String(k.uid?.()) === uid && k.rolle?.() === rolle && String(k.scope?.()) === scope;
  const originale = new Map();
  const merke = node => {
    if (!originale.has(node)) originale.set(node, { title: node.getAttribute('title'), kurz: node.getAttribute('data-kurz'), label: node.matches('[data-panel="overview"]') ? node.querySelector(':scope > span:not(.icon):not(.nav-badge)')?.textContent : null });
  };
  const brand = document.querySelector('.topbar .brand');
  const marke = document.createElement('a');
  marke.className = 'px-leiste-marke'; marke.href = brand?.getAttribute('href') || '/';
  marke.textContent = brand?.textContent.trim() || 'Praxura'; leiste.prepend(marke);
  const einklappen = document.createElement('button');
  einklappen.type = 'button'; einklappen.className = 'px-einklappen';
  einklappen.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/><path d="m15 10-2 2 2 2"/></svg><span>Menü einklappen</span>';
  einklappen.addEventListener('click', () => { if (aktiv()) document.getElementById('sidebarCollapseBtn')?.click(); });
  leiste.append(einklappen);
  verdrahteFlyout(aktiv);
  const profil = verdrahteProfil(() => k.name?.() || '', aktiv);
  const neu = verdrahteNeu(aktiv);
  const schublade = verdrahteSchublade(aktiv);
  const suche = montierePatientensuche(k.suche, aktiv);
  const widgets = [marke, einklappen, profil?.wrap, neu?.wrap].filter(Boolean);

  function aktualisieren() {
    if (String(k.uid?.()) !== uid || k.rolle?.() !== rolle || String(k.scope?.()) !== scope) gesperrt = true;
    const an = aktiv();
    if (an) html.dataset.pxShell = 'v2'; else delete html.dataset.pxShell;
    html.classList.toggle('px-profil-bereit', an && !!profil);
    html.classList.toggle('px-neu-bereit', an && !!neu);
    for (const node of widgets) node.hidden = !an;
    if (!an) { profil?.schliesse(); neu?.schliesse(); schliesseFlyout(); }
    for (const node of nav.querySelectorAll('.nav-group-header, .sidebar-item')) {
      merke(node);
      if (an) {
        if (node.matches('.nav-group-header')) {
          const lang = node.querySelector('.nav-group-label')?.textContent?.trim() || '';
          node.dataset.kurz = KURZ[node.closest('.nav-group')?.dataset.groupId] || (lang.length > 9 ? lang.slice(0, 8) + '.' : lang);
          node.title = lang;
        } else {
          if (node.dataset.panel === 'overview') {
            const label = node.querySelector(':scope > span:not(.icon):not(.nav-badge)');
            if (label && label.textContent !== 'Start') label.textContent = 'Start';
          }
          if (!node.title) node.title = node.textContent.trim();
        }
      } else {
        const original = originale.get(node);
        for (const [attr, value] of [['title', original.title], ['data-kurz', original.kurz]]) {
          if (value === null) node.removeAttribute(attr); else node.setAttribute(attr, value);
        }
        if (original.label !== null && original.label !== undefined) {
          const label = node.querySelector(':scope > span:not(.icon):not(.nav-badge)');
          if (label && label.textContent !== original.label) label.textContent = original.label;
        }
      }
    }
    const zu = leiste.classList.contains('collapsed');
    einklappen.setAttribute('aria-expanded', String(!zu));
    einklappen.title = zu ? 'Menü ausklappen' : 'Menü einklappen';
    einklappen.querySelector('span').textContent = einklappen.title;
    kopfRollen(); schublade?.aktualisieren(); profilAuffrischen();
    suche?.aktualisieren();
    const panel = document.querySelector('.panel.active')?.id.replace(/^panel-/, '');
    if (an && /^[a-z0-9-]{1,40}$/.test(panel || '')) html.dataset.pxPanel = panel;
    else delete html.dataset.pxPanel;
  }
  const designObserver = new MutationObserver(aktualisieren);
  designObserver.observe(html, { attributes: true, attributeFilter: ['data-design'] });
  const navObserver = new MutationObserver(() => { schliesseFlyout(); aktualisieren(); });
  navObserver.observe(nav, { childList: true, subtree: true });
  const sidebarObserver = new MutationObserver(aktualisieren);
  sidebarObserver.observe(leiste, { attributes: true, attributeFilter: ['class'] });
  const panelObserver = new MutationObserver(() => { schliesseFlyout(); aktualisieren(); });
  main.querySelectorAll('.panel').forEach(panel => panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] }));
  instanz = { aktualisieren, patientenAuffrischen: () => suche?.auffrischen(), deaktivieren() { gesperrt = true; aktualisieren(); } };
  aktualisieren();
  return instanz;
}
