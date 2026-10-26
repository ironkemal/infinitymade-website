/**
 * shell-neu.js — App-Shell des neuen Designs (Redesign v2, PLAN-V2 V2.02 ff.).
 *
 * Geladen nur von module/neu-start.js, also nur bei <html data-design="neu">.
 * Liest den von dashboard.js gerenderten DOM (Sichtbarkeit, Rollen, Rechte stecken schon
 * darin) und legt nur das Neu-Verhalten darüber — keine zweite Sichtbarkeitslogik.
 *
 * V2.02: macht den aktiven Bereich am <html> sichtbar (data-px-panel), damit design/*.css
 * je Bereich gestalten kann. Signale aus dashboard.js: 'panel:changed' { id }, 'nav:gerendert'.
 * V2.06: Kurzlabel je Gruppe (data-kurz) für die eingeklappte Icon-Leiste und ein eigener
 * Einklappknopf unten in der Leiste, der den alten #sidebarCollapseBtn auslöst (dessen
 * Handler in dashboard.js schaltet .collapsed und localStorage sidebar_collapsed).
 * Folgt: Flyout (V2.07), Suche (V2.09), „+ Neu“ (V2.10), Schublade (V2.11).
 */
import { on } from './signal.js?v=20260813';

/** Reine Hilfe (testbar): erlaubte Panel-ID oder null. */
export function panelId(wert) {
  return typeof wert === 'string' && /^[a-z0-9-]{1,40}$/.test(wert) ? wert : null;
}

let gestartet = false;
export function start() {
  if (gestartet) return;
  gestartet = true;
  const html = document.documentElement;
  html.dataset.pxShell = 'v2';
  const setze = (id) => { const p = panelId(id); if (p) html.dataset.pxPanel = p; };
  setze(document.querySelector('.panel.active')?.id?.replace(/^panel-/, ''));
  markeInLeiste();
  kurzlabelSetzen();
  einklappKnopf();
  on('panel:changed', (d) => setze(d?.id));
  on('nav:gerendert', kurzlabelSetzen);
}

const KURZ = { uebersicht: 'Heute', termine: 'Termine', patienten: 'Patienten', abrechnung: 'Abrechn.', team: 'Praxis', einstellungen: 'Einstell.' };

/** Reine Hilfe (testbar): Kurzlabel für die Icon-Leiste, sonst gekürzte Langform. */
export function kurzlabel(gruppenId, lang = '') {
  if (KURZ[gruppenId]) return KURZ[gruppenId];
  const t = String(lang).trim();
  return t.length > 9 ? t.slice(0, 8) + '.' : t;
}

/** Bei jedem Rendern der Leiste neu (dashboard.js baut #sidebarNav jedes Mal neu auf). */
function kurzlabelSetzen() {
  document.querySelectorAll('#sidebarNav .nav-group').forEach((g) => {
    const kopf = g.querySelector('.nav-group-header');
    if (!kopf) return;
    const lang = kopf.querySelector('.nav-group-label')?.textContent || '';
    kopf.dataset.kurz = kurzlabel(g.dataset.groupId, lang);
    kopf.title = lang;
  });
  document.querySelectorAll('#sidebarNav .sidebar-item').forEach((e) => {
    if (!e.title) e.title = e.textContent.trim();
  });
}

/** Knopf unten in der Leiste; der alte, schwebende Knopf ist im Neu-Design per CSS aus. */
function einklappKnopf() {
  const leiste = document.getElementById('sidebar');
  const alt = document.getElementById('sidebarCollapseBtn');
  if (!leiste || !alt || leiste.querySelector('.px-einklappen')) return;
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'px-einklappen';
  knopf.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/><path d="m15 10-2 2 2 2"/></svg><span>Menü einklappen</span>';
  const spiegeln = () => {
    const zu = leiste.classList.contains('collapsed');
    knopf.setAttribute('aria-expanded', String(!zu));
    knopf.title = zu ? 'Menü ausklappen' : 'Menü einklappen';
    knopf.querySelector('span').textContent = knopf.title;
  };
  knopf.addEventListener('click', () => { alt.click(); spiegeln(); });
  spiegeln();
  leiste.append(knopf);
}

/** Marke oben in der Leiste (Desktop-Hülle V2.03). Kopie, damit die mobile Kopfleiste ihre behält. */
function markeInLeiste() {
  const leiste = document.getElementById('sidebar');
  const marke = document.querySelector('.topbar .brand');
  if (!leiste || !marke || leiste.querySelector('.px-leiste-marke')) return;
  const kopie = document.createElement('a');
  kopie.className = 'px-leiste-marke';
  kopie.href = marke.getAttribute('href') || '/';
  kopie.textContent = marke.textContent.trim() || 'Praxura';
  leiste.prepend(kopie);
}
