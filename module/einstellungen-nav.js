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

const zustaende = new WeakMap();

function markiere(zustand, id) {
  zustand.nav.querySelectorAll('.px-abschnitt').forEach((a) => {
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
  abschnittsNavAufbauen({ panel, inhalt, ariaLabel: 'Abschnitte der Einstellungen', lesen: () => lesen(panel) });
}

/** Ein Scrollspy pro Formular; vorhandene Felder und Speicherwege bleiben unverändert. */
export function abschnittsNavAufbauen({ panel, inhalt, ariaLabel, lesen: leseEintraege }) {
  let zustand = zustaende.get(panel);
  if (!zustand) {
    const nav = document.createElement('nav');
    nav.className = 'px-abschnitte';
    nav.setAttribute('aria-label', ariaLabel);
    inhalt.before(nav);
    panel.classList.add('px-mit-abschnitten');
    zustand = { nav, festBis: 0, beobachter: null, lesen: leseEintraege };
    zustaende.set(panel, zustand);
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('.px-abschnitt');
      if (!a) return;
      e.preventDefault();
      const ziel = [...panel.querySelectorAll('[id]')].find(el => el.id === a.dataset.ziel);
      if (!ziel) return;
      const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      ziel.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
      markiere(zustand, a.dataset.ziel);
      zustand.festBis = Date.now() + 1200;
      ziel.setAttribute('tabindex', '-1');
      ziel.focus({ preventScroll: true });
    });
  }
  zustand.lesen = leseEintraege;
  const eintraege = leseEintraege();
  zustand.nav.hidden = !eintraege.some(e => e.art === 'abschnitt');
  zustand.nav.innerHTML = eintraege.map((e) => (e.art === 'gruppe'
    ? `<div class="px-abschnitt-gruppe">${e.titel.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</div>`
    : `<a href="#${e.id}" class="px-abschnitt" data-ziel="${e.id}">${e.titel.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</a>`)).join('');

  zustand.beobachter?.disconnect();
  zustand.beobachter = new IntersectionObserver((liste) => {
    const sichtbare = liste.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (sichtbare[0] && Date.now() > zustand.festBis) markiere(zustand, sichtbare[0].target.id);
  }, { rootMargin: '-80px 0px -60% 0px' });
  eintraege.filter((e) => e.art === 'abschnitt').forEach((e) => { const el = [...panel.querySelectorAll('[id]')].find(el => el.id === e.id); if (el) zustand.beobachter.observe(el); });
  const erster = eintraege.find((e) => e.art === 'abschnitt');
  if (erster) markiere(zustand, erster.id);
}

/** Bestehenden Formular-Archetyp auf Anamnese, Leistungen und Arbeitszeiten anwenden. */
export function formularNavAufbauen(id) {
  if (!['anamnese', 'services', 'hours'].includes(id)) return;
  const panel = document.getElementById('panel-' + id);
  if (!panel) return;
  let inhalt = panel.querySelector(':scope > .px-formular-inhalt');
  if (!inhalt) {
    inhalt = document.createElement('div');
    inhalt.className = 'px-formular-inhalt';
    const kinder = [...panel.children].filter(el => !el.classList.contains('panel-header'));
    panel.appendChild(inhalt);
    kinder.forEach(el => inhalt.appendChild(el));
    panel.classList.add('px-formular-nav');
  }
  const leseEintraege = () => {
    const selektor = id === 'anamnese' ? '#anamPhysioForm > .card, #anamDynForm .anam-gruppe[data-gruppe]'
      : id === 'services' ? '#gkvCatalogSection, #servicesGrid .srv-gruppe[data-typ], #gkvServiceForm, #addServiceForm'
        : '#hoursStandortSection, #hoursGrid, .hours-calendar-section';
    const zeilen = [...inhalt.querySelectorAll(selektor)].map((el, index) => {
      if (!el.id) {
        let nummer = index;
        while (document.getElementById('px-formular-' + id + '-' + nummer)) nummer++;
        el.id = 'px-formular-' + id + '-' + nummer;
      }
      const titel = el.querySelector('h3, h4, .hours-standort-header > span')?.textContent?.trim()
        || (el.id === 'hoursGrid' ? 'Wochenarbeitszeiten' : el.classList.contains('hours-calendar-section') ? 'Sondertage' : '');
      const istSichtbar = !!el.getClientRects().length && !el.closest('[hidden], [inert]') && getComputedStyle(el).visibility !== 'hidden';
      return { id: el.id, titel, sichtbar: istSichtbar };
    });
    return navEintraege(zeilen);
  };
  const aufbauen = () => abschnittsNavAufbauen({ panel, inhalt, ariaLabel: 'Abschnitte: ' + (panel.querySelector('h2')?.textContent || id), lesen: leseEintraege });
  aufbauen();
  const zustand = zustaende.get(panel);
  if (!zustand.quellenBeobachter) {
    let geplant = false;
    zustand.quellenBeobachter = new MutationObserver(records => {
      if (geplant || records.every(r => zustand.nav.contains(r.target))) return;
      geplant = true;
      queueMicrotask(() => { geplant = false; aufbauen(); });
    });
    zustand.quellenBeobachter.observe(inhalt, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style'] });
  }
}
