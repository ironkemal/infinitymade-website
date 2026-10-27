/**
 * einstellungen-nav.js — Abschnittsnavigation der Einstellungen im neuen Design (PLAN-V2 V4.02,
 * Archetyp „Formular mit Abschnittsnavigation“).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js). Liest die vorhandenen
 * .settings-group / .settings-section aus #panel-settings und baut links eine mitlaufende Liste.
 * Nur sichtbare Abschnitte (dashboard.js blendet je Rolle/Plan/Fachbereich per hidden bzw.
 * style.display aus) — die Liste wird bei jedem Öffnen des Bereichs neu gebaut. Klick scrollt zum
 * Abschnitt; der gerade sichtbare Abschnitt wird markiert. Inhalte und Speichern bleiben unverändert.
 */

/** Reine Hilfe (testbar): Einträge aus { gruppe, id, titel, sichtbar }-Zeilen; leere Gruppen fallen weg. */
export function navEintraege(zeilen) {
  const out = [];
  let letzteGruppe = null;
  for (const z of zeilen || []) {
    if (!z?.sichtbar || !z.id || !String(z.titel || '').trim()) continue;
    if (z.gruppe && z.gruppe !== letzteGruppe) { out.push({ art: 'gruppe', titel: z.gruppe }); letzteGruppe = z.gruppe; }
    out.push({ art: 'abschnitt', id: z.id, titel: String(z.titel).trim() });
  }
  return out;
}

const sichtbar = (el) => !!el && !el.hidden && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';

function lesen(panel) {
  const zeilen = [];
  panel.querySelectorAll('.settings-section[id]').forEach((sek) => {
    const gruppe = sek.closest('.settings-group')?.querySelector('.settings-group-label')?.textContent?.trim() || '';
    const titel = sek.querySelector('.settings-section-title')?.textContent || '';
    zeilen.push({ gruppe, id: sek.id, titel, sichtbar: sichtbar(sek) && sichtbar(sek.closest('.settings-group') || sek) });
  });
  return navEintraege(zeilen);
}

let nav = null;
let beobachter = null;
let festBis = 0; // nach Klick die Markierung kurz halten (Beobachter zieht sonst nach)

function markiere(id) {
  nav?.querySelectorAll('.px-abschnitt').forEach((a) => {
    const aktiv = a.dataset.ziel === id;
    a.classList.toggle('aktiv', aktiv);
    if (aktiv) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
}

/** Navigation (neu) aufbauen; bei jedem Öffnen der Einstellungen aufrufen. */
export function einstellungenNavAufbauen() {
  const panel = document.getElementById('panel-settings');
  const inhalt = panel?.querySelector('.settings-sections');
  if (!panel || !inhalt) return;
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'px-abschnitte';
    nav.setAttribute('aria-label', 'Abschnitte der Einstellungen');
    inhalt.before(nav);
    panel.classList.add('px-mit-abschnitten');
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('.px-abschnitt');
      if (!a) return;
      e.preventDefault();
      const ziel = document.getElementById(a.dataset.ziel);
      if (!ziel) return;
      const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      ziel.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
      markiere(a.dataset.ziel);
      festBis = Date.now() + 1200;
      ziel.setAttribute('tabindex', '-1');
      ziel.focus({ preventScroll: true });
    });
  }
  const eintraege = lesen(panel);
  nav.innerHTML = eintraege.map((e) => (e.art === 'gruppe'
    ? `<div class="px-abschnitt-gruppe">${e.titel.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</div>`
    : `<a href="#${e.id}" class="px-abschnitt" data-ziel="${e.id}">${e.titel.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</a>`)).join('');

  beobachter?.disconnect();
  beobachter = new IntersectionObserver((liste) => {
    const sichtbare = liste.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (sichtbare[0] && Date.now() > festBis) markiere(sichtbare[0].target.id);
  }, { rootMargin: '-80px 0px -60% 0px' });
  eintraege.filter((e) => e.art === 'abschnitt').forEach((e) => { const el = document.getElementById(e.id); if (el) beobachter.observe(el); });
  const erster = eintraege.find((e) => e.art === 'abschnitt');
  if (erster) markiere(erster.id);
}
