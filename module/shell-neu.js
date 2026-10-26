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
 * V2.07: Gruppen-Flyout der eingeklappten Leiste (module/leiste-flyout.js).
 * V2.08: Profilmenü in der Kopfleiste (module/kopf-profil.js). Ohne Namen: Personensymbol —
 *   #welcomeText taugt nicht als Quelle (zeigt bei Angestellten den Inhabernamen, R-15);
 *   den eigenen Namen liefert später die Startseite (V6.F) über verdrahteProfil(liesName).
 * V2.09: Patientensuche in der Kopfleiste (module/kopf-suche.js), Kontext aus neu-start.js.
 * V2.10: „+ Neu“ (module/kopf-neu.js); Menü-Mechanik gemeinsam in module/kopf-menue.js.
 * V6.F01: Startseite „Heute“ (module/startseite-neu.js) im Bereich overview.
 * V3.W: keine Emojis in der Oberfläche (module/ohne-emoji.js), Melih 26.10.2026.
 * Folgt: Schublade (V2.11).
 */
import { on } from './signal.js?v=20260813';
import { verdrahteFlyout, kopfRollen, schliesseFlyout } from './leiste-flyout.js?v=20261026s218';
import { verdrahteProfil } from './kopf-profil.js?v=20261026s212';
import { verdrahteNeu } from './kopf-neu.js?v=20261026s212';
import { verdrahteStartseite } from './startseite-neu.js?v=20261026s218';
import { emojisAus } from './ohne-emoji.js?v=20261026s217';
import { verdrahteSuche, sucheSichtbarkeit } from './kopf-suche.js?v=20261026s210';

/** Reine Hilfe (testbar): erlaubte Panel-ID oder null. */
export function panelId(wert) {
  return typeof wert === 'string' && /^[a-z0-9-]{1,40}$/.test(wert) ? wert : null;
}

let gestartet = false;
export function start({ kontext } = {}) {
  if (gestartet) return;
  gestartet = true;
  const html = document.documentElement;
  html.dataset.pxShell = 'v2';
  emojisAus();
  const setze = (id) => { const p = panelId(id); if (p) html.dataset.pxPanel = p; };
  setze(document.querySelector('.panel.active')?.id?.replace(/^panel-/, ''));
  markeInLeiste();
  kurzlabelSetzen();
  einklappKnopf();
  verdrahteFlyout();
  verdrahteProfil();
  verdrahteSuche(kontext);
  verdrahteNeu();
  verdrahteStartseite(kontext);
  kopfRollen();
  on('panel:changed', (d) => { setze(d?.id); schliesseFlyout(); });
  on('nav:gerendert', () => { kurzlabelSetzen(); kopfRollen(); sucheSichtbarkeit(); });
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
  // V6.F02 (E8): „Dashboard“ heißt im Neu-Design „Start“; „Überblick“ geht in der Startseite auf
  // (Menüzeile versteckt, Registry-Zeile bleibt; erreichbar über die Startseite).
  const start = document.querySelector('#sidebarNav .sidebar-item[data-panel="overview"] > span:not(.icon):not(.nav-badge)');
  if (start) start.textContent = 'Start';
  // E7/V2.05: Anamnese, Fußbefund, Notizen stehen als Reiter in der Patientenakte (Seitenpanel, V4.01);
  // ihre Menüzeilen sind im Neu-Design aus. Die Bereiche bleiben (Kalender springt z. B. in den Fußbefund).
  for (const id of ['ueberblick', 'anamnese', 'fussstatus', 'notizen']) {
    const zeile = document.querySelector(`#sidebarNav .sidebar-item[data-panel="${id}"]`);
    if (zeile) zeile.hidden = true;
  }
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
  knopf.addEventListener('click', () => alt.click());
  spiegeln();
  // R-20 (Codex, V2.06): Die Shell lädt per import() und kann vor oder nach der Wiederherstellung
  // von sidebar_collapsed in dashboard.js starten. Darum nicht nur beim Start/Klick spiegeln,
  // sondern jede Klassenänderung an der Leiste beobachten.
  new MutationObserver(() => { spiegeln(); kopfRollen(); }).observe(leiste, { attributes: true, attributeFilter: ['class'] });
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
