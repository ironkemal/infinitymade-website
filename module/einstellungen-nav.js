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

/* ──────────────────────────────────────────────────────────────────────────────────────────────
 * Kategorie-Modus (altes Design auf main, Pflichtpunkt 8, Box-Test 22.11.2026 — Melih: „übersichtlich
 * wie die Einstellungen der Claude-Desktop-App“). Ergänzt die Datei aus redesign/praxura-v9-abnahme,
 * ohne einstellungenNavAufbauen() zu verändern (shell-neu.js ruft weiter ohne Argument auf).
 *
 * - Bereiche = .settings-group[data-einst] in dashboard.html (dort umgehängt). Links die Bereiche, rechts
 *   NUR der gewählte Bereich. Bereiche ohne sichtbaren Abschnitt (Rolle/Box/Fachbereich blenden per
 *   hidden bzw. style.display aus) erscheinen nicht — „System“ also nur für Inhaber auf der Box.
 * - Suche „Einstellungen durchsuchen“ filtert über alle Bereiche nach Abschnittstitel.
 * - Deep-Link #settings/<bereich> (fügt sich ins Panel-Routing ein); am Handy Auswahlliste statt Seitenleiste (CSS .einst-*).
 * - Per JS angehängte Abschnitte werden ihrem Bereich zugeordnet (DOM-Umzug, Handler bleiben).
 * ────────────────────────────────────────────────────────────────────────────────────────────── */

/** Per JS erzeugte Abschnitte → Bereich (die erzeugenden Module hängen sie an alte Anker). */
export const NACHGELADEN = {
  settingsRechtslinksSection: 'recht',
  settingsMitarbeiterAppSection: 'team',
  settingsTeamLinkSection: 'team',
  settingsFaxSection: 'dokumente',
  settingsFormulareSection: 'dokumente',
  settingsMailversandSection: 'dokumente',
};
const HASH = '#settings/'; // Panel-Routing (panel-verlauf.js) nutzt den Teil vor „/“
const SPEICHER = 'praxura.einstellungen.bereich';

/** Reine Hilfe: sichtbare Bereiche aus { slug, titel, sichtbareAbschnitte }-Zeilen. */
export function bereicheAus(zeilen) {
  return (zeilen || []).filter((z) => z?.slug && z.sichtbareAbschnitte > 0).map((z) => ({ slug: z.slug, titel: String(z.titel || z.slug).trim() }));
}

/** Reine Hilfe: gewünschten Bereich nur, wenn sichtbar; sonst der erste. */
export function bereichWaehlen(wunsch, bereiche) {
  return (wunsch && bereiche.some((b) => b.slug === wunsch)) ? wunsch : (bereiche[0]?.slug || null);
}

/** Reine Hilfe: passt der Abschnittstitel zur Suche? (Groß/klein, Umlaute egal) */
export function trifftSuche(titel, suche) {
  const norm = (t) => String(t || '').toLocaleLowerCase('de-DE').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').trim();
  const q = norm(suche);
  return !q || norm(titel).includes(q);
}

/** @param {string} h */
export function bereichAusHash(h) {
  return typeof h === 'string' && h.startsWith(HASH) ? decodeURIComponent(h.slice(HASH.length)).replace(/[^a-z0-9-]/g, '') || null : null;
}

let kat = null; // Zustand des Kategorie-Modus

const modulSichtbar = (el) => !!el && !el.hidden && el.style.display !== 'none';

/**
 * Kategorie-Modus aufbauen bzw. aktualisieren. Bei jedem Öffnen der Einstellungen aufrufen.
 * @param {{ istOwner?: () => boolean, wechslePanel?: (id: string) => unknown, doc?: Document }} [o]
 */
export function einstellungenKategorienAufbauen(o = {}) {
  const doc = o.doc || document;
  const panel = doc.getElementById('panel-settings');
  const inhalt = panel?.querySelector('.settings-sections');
  if (!panel || !inhalt) return null;
  const gruppe = (slug) => inhalt.querySelector(`.settings-group[data-einst="${slug}"]`);

  if (!kat) {
    // „Mitarbeiter & Rechte“: Rechte stehen im Team-Bereich — hier der Weg dorthin, kein zweites Formular.
    if (o.wechslePanel && !doc.getElementById('settingsTeamLinkSection')) {
      const sec = doc.createElement('div');
      sec.className = 'settings-section'; sec.id = 'settingsTeamLinkSection';
      sec.innerHTML = '<div class="settings-section-title">Mitarbeiter &amp; Berechtigungen</div><div class="settings-section-body">'
        + '<p class="form-hint" style="margin:0 0 10px;">Mitarbeiter anlegen, Standorte zuordnen und Rechte vergeben Sie im Bereich „Team“.</p>'
        + '<button type="button" class="btn btn-secondary">Team &amp; Berechtigungen öffnen</button></div>';
      sec.querySelector('button').addEventListener('click', () => { void o.wechslePanel?.('team'); });
      gruppe('team')?.append(sec);
    }
    const layout = doc.createElement('div'); layout.className = 'einst-layout';
    const nav = doc.createElement('nav'); nav.className = 'einst-nav'; nav.setAttribute('aria-label', 'Bereiche der Einstellungen');
    const suche = doc.createElement('input');
    suche.type = 'search'; suche.className = 'form-input einst-suche'; suche.placeholder = 'Einstellungen durchsuchen';
    suche.setAttribute('aria-label', 'Einstellungen durchsuchen');
    const liste = doc.createElement('div'); liste.className = 'einst-nav-liste';
    const auswahl = doc.createElement('select'); auswahl.className = 'form-input einst-nav-auswahl';
    auswahl.setAttribute('aria-label', 'Bereich der Einstellungen wählen');
    const leer = doc.createElement('p'); leer.className = 'form-hint einst-leer'; leer.hidden = true;
    leer.textContent = 'Keine Einstellung passt zur Suche.';
    nav.append(suche, liste, auswahl);
    inhalt.before(layout); layout.append(nav, inhalt); inhalt.before(leer);
    inhalt.classList.add('einst-filter-aktiv');
    let gemerkt = null; try { gemerkt = globalThis.localStorage?.getItem(SPEICHER) || null; } catch { /* privater Modus */ }
    kat = { doc, inhalt, liste, auswahl, suche, leer, aktiv: bereichAusHash(globalThis.location?.hash) || gemerkt, signatur: '', geplant: false };
    liste.addEventListener('click', (e) => { const b = e.target.closest('[data-bereich]'); if (b) zeigeBereich(b.dataset.bereich, { fokus: true }); });
    auswahl.addEventListener('change', () => zeigeBereich(auswahl.value));
    suche.addEventListener('input', () => { kat.signatur = ''; anwenden(); });
    globalThis.addEventListener?.('hashchange', () => { const h = bereichAusHash(globalThis.location?.hash); if (h) zeigeBereich(h); });
    const beob = new (doc.defaultView || globalThis).MutationObserver(() => {
      if (kat.geplant) return; kat.geplant = true;
      queueMicrotask(() => { kat.geplant = false; anwenden(); });
    });
    beob.observe(inhalt, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style'] });
  }
  anwenden();
  return kat;
}

function nachgeladeneEinordnen() {
  for (const [id, slug] of Object.entries(NACHGELADEN)) {
    const sec = kat.doc.getElementById(id);
    const ziel = kat.inhalt.querySelector(`.settings-group[data-einst="${slug}"]`);
    if (sec && ziel && sec.parentElement !== ziel) ziel.append(sec);
  }
}

function anwenden() {
  if (!kat) return;
  nachgeladeneEinordnen();
  const q = kat.suche.value;
  const gruppen = [...kat.inhalt.querySelectorAll('.settings-group[data-einst]')];
  const zeilen = gruppen.map((g) => {
    const secs = [...g.querySelectorAll(':scope > .settings-section')];
    return { g, slug: g.dataset.einst, titel: g.querySelector('.settings-group-label')?.textContent, secs, sichtbareAbschnitte: secs.filter(modulSichtbar).length };
  });
  const bereiche = bereicheAus(zeilen);
  kat.aktiv = bereichWaehlen(kat.aktiv, bereiche);
  let treffer = 0;
  for (const z of zeilen) {
    let zeigt = 0;
    for (const s of z.secs) {
      const titel = s.querySelector('.settings-section-title')?.textContent || '';
      const an = q.trim() ? trifftSuche(titel, q) : z.slug === kat.aktiv;
      s.toggleAttribute('data-einst-aus', !an);
      if (an && modulSichtbar(s)) zeigt++;
    }
    z.g.toggleAttribute('data-einst-leer', zeigt === 0);
    // In der Suche den Bereichsnamen über den Treffern zeigen, sonst nicht (die Navigation nennt ihn).
    z.g.toggleAttribute('data-einst-suche', !!q.trim());
    treffer += zeigt;
  }
  kat.leer.hidden = !q.trim() || treffer > 0;
  const sig = bereiche.map((b) => b.slug).join(',') + '|' + kat.aktiv + '|' + (q.trim() ? 's' : '');
  if (sig === kat.signatur) return;
  kat.signatur = sig;
  kat.liste.replaceChildren(...bereiche.map((b) => {
    const el = kat.doc.createElement('a');
    el.className = 'einst-nav-eintrag'; el.href = HASH + b.slug; el.dataset.bereich = b.slug; el.textContent = b.titel;
    if (!q.trim() && b.slug === kat.aktiv) el.setAttribute('aria-current', 'page');
    el.addEventListener('click', (e) => e.preventDefault());
    return el;
  }));
  kat.auswahl.replaceChildren(...bereiche.map((b) => new Option(b.titel, b.slug, false, b.slug === kat.aktiv)));
}

/** @param {string} slug @param {{ fokus?: boolean }} [o] */
function zeigeBereich(slug, o = {}) {
  if (!kat) return;
  kat.aktiv = slug; kat.suche.value = ''; kat.signatur = '';
  try { globalThis.localStorage?.setItem(SPEICHER, slug); } catch { /* privater Modus */ }
  try { if (globalThis.location && globalThis.history && globalThis.location.hash !== HASH + slug) globalThis.history.replaceState(null, '', HASH + slug); } catch { /* file:// o. ä. */ }
  anwenden();
  if (o.fokus) kat.inhalt.querySelector(`.settings-group[data-einst="${slug}"] .settings-section:not([data-einst-aus]) .settings-section-title`)?.scrollIntoView?.({ block: 'nearest' });
}

/** Für gehZuEinstellung (dashboard.js): Bereich des Abschnitts öffnen, bevor gescrollt wird. @param {string} id */
export function einstellungenZeigeAbschnitt(id) {
  if (!kat) return;
  const el = kat.doc.getElementById(id);
  const slug = el?.closest('.settings-group[data-einst]')?.dataset.einst || NACHGELADEN[id];
  if (slug) zeigeBereich(slug);
}

/** Nur für Tests. */
export function _kategorienZuruecksetzen() { kat = null; }
