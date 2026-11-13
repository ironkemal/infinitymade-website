/** Patient-only adaptation of confirmed kopf-suche.js to the current shared picker.
 * The caller supplies the existing scoped cache/matcher/label/opener; no own query.
 * Current picker has refresh/close, not the older design checkout's invalidate API.
 */
import { attachPatientSearch } from '../patient-suche.js?v=20260906';
import { createDokumentSuche, dokumenteErlaubt, dokumentHinweis, dokumentScopeKey, mitFehlerMelder } from './kopf-dokumente.js?v=20261114v209c';
import { ladeAktiveVerordnungen } from './verordnung-uebersicht.js?v=20261021f';

const ART_TEXT = { patient: 'Patient', verordnung: 'Verordnung', rechnung: 'Rechnung' };
const ART_PLATZ = { patient: 'Patient suchen', verordnung: 'Verordnung suchen (Nummer oder Name)', rechnung: 'Rechnung suchen (Nummer oder Name)' };
const ART_ARIA = { patient: 'Patient suchen (Name, Geburtsdatum oder Telefon)', verordnung: 'Verordnung suchen (Belegnummer oder Patientenname)', rechnung: 'Rechnung suchen (Rechnungsnummer oder Patientenname)' };

export function montierePatientensuche(k, aktiv) {
  const links = document.querySelector('.topbar .topbar-left');
  if (!links || !['ensureLeadsCache', 'patientMatchesQuery', 'displayNameWithBirth', 'oeffnePatient'].every(name => typeof k?.[name] === 'function')) return null;
  const erlaubt = () => aktiv() && !!document.querySelector('#sidebarNav .sidebar-item[data-panel="kunden"]:not([hidden])');
  const wrap = document.createElement('div'); wrap.className = 'px-suche'; wrap.setAttribute('role', 'search');
  wrap.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const feld = document.createElement('input'); feld.type = 'search'; feld.id = 'pxSuche'; feld.className = 'px-suche-feld';
  feld.placeholder = 'Patient suchen'; feld.setAttribute('aria-label', 'Patient suchen (Name, Geburtsdatum oder Telefon)'); feld.setAttribute('aria-keyshortcuts', '/');
  const taste = document.createElement('kbd'); taste.className = 'px-suche-taste'; taste.textContent = '/'; taste.setAttribute('aria-hidden', 'true');
  // V2.09b (13.11.2026): Inhaberin kann zusätzlich Verordnungen/Rechnungen suchen (module/kopf-dokumente.js).
  // Auswahl und Quellen gibt es nur für die Inhaberin; sonst ist die Auswahl nicht im DOM und es gibt keinen Read.
  const hinweis = document.createElement('div'); hinweis.className = 'px-suche-hinweis'; hinweis.setAttribute('role', 'status'); hinweis.setAttribute('aria-live', 'polite');
  wrap.append(feld, taste, hinweis); links.append(wrap);
  const dok = typeof k.dokumente?.kontext === 'function' ? k.dokumente : null;
  const inLeiste = id => !!document.querySelector(`#sidebarNav .sidebar-item[data-panel="${id}"]:not([hidden])`);
  const dokKontext = () => ({ ...(dok?.kontext() || {}), design: aktiv() ? 'neu' : 'alt', verordnungenErlaubt: inLeiste('verordnungen'), rechnungenErlaubt: inLeiste('rechnungen') });
  const doks = dok ? createDokumentSuche({ kontext: dokKontext,
    // Fehler je Topf macht der gemeinsame Lader still zu []; der Melder macht daraus „nicht verfügbar“ (guvenlik 13.11.).
    ladeVerordnungen: async kk => { const m = mitFehlerMelder(kk.supabase); const rows = await ladeAktiveVerordnungen(m.client, { ownerId: kk.ownerId, nurAktive: false }); return m.fehler() ? null : rows; },
    ladeRechnungen: () => dok.ladeRechnungen(), oeffneRechnung: dok.oeffneRechnung, oeffneVerordnung: dok.oeffneVerordnung }) : null;
  // geladenKey: Kontext des letzten erfolgreichen Dokumentladens, oder das Symbol des gerade laufenden Ladens
  // (verhindert Doppelläufe aus Wechsel + Fokus + Öffnen). stand: letzter gültiger Bestand je Art — ein veralteter Lauf
  // (Art gewechselt, neuere Suche) liefert diesen statt [] zurück und überschreibt so nie den neueren Stand im Picker.
  let art = 'patient', geladenKey = null, stand = { art: null, zeilen: [] };
  // Nur Zeilen der aktuellen Art UND des aktuellen Kontexts (nach Standort-/Freigabewechsel nichts Altes zeigen).
  const behalte = () => {
    if (stand.art !== art) return [];
    const key = art === 'patient' ? null : dokumentScopeKey(dokKontext());
    return stand.zeilen.filter(z => !z.scopeKey || z.scopeKey === key);
  };
  const artWahl = document.createElement('select'); artWahl.className = 'px-suche-art'; artWahl.setAttribute('aria-label', 'Suchbereich');
  function wechsleArt(neu) {
    if (neu === art) return;
    art = neu; artWahl.value = neu; feld.value = ''; feld.placeholder = ART_PLATZ[neu]; feld.setAttribute('aria-label', ART_ARIA[neu]);
    hinweis.textContent = ''; geladenKey = null; doks?.invalide(); picker.close(); wrap.querySelector('.patient-search-list')?.replaceChildren();
    // Patienten: sofort aus dem vorhandenen Cache. Dokumente: erst beim Fokus (ein Lauf, nicht bei jedem Umschalten).
    if (neu === 'patient') picker.refresh();
  }
  function artenSetzen() {
    const arten = ['patient', ...(doks && erlaubt() ? ['verordnung', 'rechnung'].filter(a => dokumenteErlaubt(dokKontext(), a)) : [])];
    if ([...artWahl.options].map(o => o.value).join() !== arten.join()) artWahl.replaceChildren(...arten.map(a => new Option(ART_TEXT[a], a)));
    if (arten.length > 1) { if (!artWahl.isConnected) feld.before(artWahl); } else artWahl.remove();
    if (!arten.includes(art)) wechsleArt('patient'); else artWahl.value = art;
  }
  artWahl.addEventListener('change', () => {
    wechsleArt(artWahl.value); ansage.textContent = `Suche in: ${ART_TEXT[art]}`;
    // Fokus schon im Feld (kein focus-Ereignis): Dokumente hier laden, sonst übernimmt der Fokus-Zuhörer.
    if (document.activeElement === feld) { if (art !== 'patient') picker.refresh(); } else feld.focus();
  });
  const picker = attachPatientSearch(feld, {
    containerEl: wrap, emptyLimit: 8, emptyText: 'Keine Treffer im geladenen Bestand',
    loadLeads: async () => {
      if (!erlaubt()) return [];
      if (art !== 'patient') {
        const a = art, key = dokumentScopeKey(dokKontext()), lauf = Symbol('laedt'); geladenKey = lauf;
        const r = await doks.laden(a);
        const eigen = geladenKey === lauf;
        if (a !== art || !erlaubt() || r.status === 'veraltet') { if (eigen) geladenKey = null; return erlaubt() ? behalte() : []; }
        if (eigen) geladenKey = r.status === 'ok' ? key : null;
        hinweis.textContent = dokumentHinweis(a, r);
        stand = { art: a, zeilen: r.status === 'ok' ? r.zeilen : [] };
        return stand.zeilen;
      }
      const rows = await k.ensureLeadsCache();
      if (!erlaubt()) return [];
      if (art !== 'patient') return behalte();
      stand = { art: 'patient', zeilen: [...(rows || [])] }; return stand.zeilen;
    },
    // Dokumenttreffer tragen `art`; so passt jede Zeile zu ihrer eigenen Quelle, auch wenn die Auswahl währenddessen wechselt.
    matches: (row, query) => erlaubt() && (row.art ? art === row.art && row.suchtext.includes(query) : art === 'patient' && k.patientMatchesQuery(row, query)),
    labelOf: row => row.art ? row.label : k.displayNameWithBirth(row),
    onSelect: row => {
      if (!erlaubt()) return; feld.value = ''; feld.blur(); oeffne(false);
      if (row.art) doks?.oeffnen(row); else k.oeffnePatient(row.id);
    },
  });
  // Kontext seit dem letzten Laden geändert (Standort, Freigabe, Leiste): Treffer verwerfen, frisch laden.
  feld.addEventListener('focus', () => { if (art !== 'patient' && typeof geladenKey !== 'symbol' && geladenKey !== dokumentScopeKey(dokKontext())) picker.refresh(); });
  // A11y (web-barrierefreiheit 13.11.2026): Der gemeinsame Picker (patient-suche.js) setzt keine ARIA-Rollen. Für die
  // Kopfleiste hier nachgezogen, ohne den Picker zu ändern: Combobox/Listbox/Option, aktive Zeile, Trefferzahl-Ansage.
  const ansage = document.createElement('div'); ansage.className = 'px-suche-ansage'; ansage.setAttribute('role', 'status'); ansage.setAttribute('aria-live', 'polite');
  wrap.append(ansage);
  const liste = wrap.querySelector('.patient-search-list');
  if (liste) {
    liste.id = liste.id || 'pxSucheListe'; liste.setAttribute('role', 'listbox'); liste.setAttribute('aria-label', 'Treffer');
    feld.setAttribute('role', 'combobox'); feld.setAttribute('aria-autocomplete', 'list'); feld.setAttribute('aria-controls', liste.id); feld.setAttribute('aria-expanded', 'false');
    let ansageTimer = null;
    const ariaNachziehen = () => {
      const offen = !liste.hidden; feld.setAttribute('aria-expanded', String(offen));
      const treffer = [...liste.querySelectorAll('li[data-id]')];
      // Wählbar sind Treffer und Aktionszeilen (data-action, per Tastatur erreichbar); nur der Leerhinweis ist gesperrt.
      [...liste.querySelectorAll('li[data-id], li[data-action]')].forEach((li, i) => { li.setAttribute('role', 'option'); li.id = `pxSucheTreffer${i}`; li.setAttribute('aria-selected', String(li.classList.contains('active'))); });
      for (const li of liste.querySelectorAll('li:not([data-id]):not([data-action])')) { li.setAttribute('role', 'option'); li.setAttribute('aria-disabled', 'true'); }
      const aktivLi = liste.querySelector('li.active[data-id], li.active[data-action]');
      if (offen && aktivLi) feld.setAttribute('aria-activedescendant', aktivLi.id); else feld.removeAttribute('aria-activedescendant');
      clearTimeout(ansageTimer);
      ansageTimer = setTimeout(() => { if (!offen) return; const text = treffer.length ? `${treffer.length} Treffer` : 'Keine Treffer'; if (ansage.textContent !== text) ansage.textContent = text; }, 400);
    };
    // Nur hidden/class beobachten: die hier gesetzten Attribute (role, id, aria-*) lösen den Beobachter nicht erneut aus.
    new MutationObserver(ariaNachziehen).observe(liste, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  // V2.12b (Melih 13.11.2026): Unter 900 px ist das Feld per CSS aus. Eine Lupe in der Kopfleiste klappt dasselbe Feld
  // (gleicher Picker, gleicher Cache, keine neue Abfrage) als Zeile unter der Kopfleiste auf. Ablauf wie kopf-menue.js:
  // Escape/Auswahl/Fokus raus schließt, Fokus zurück auf die Lupe. Sichtbar nur unter data-design="neu" (design/shell.css).
  const schmal = window.matchMedia('(max-width: 899px)');
  const knopf = document.createElement('button'); knopf.type = 'button'; knopf.className = 'px-suche-knopf'; knopf.hidden = true;
  knopf.setAttribute('aria-label', 'Suche'); knopf.setAttribute('aria-controls', 'pxSuche'); knopf.setAttribute('aria-expanded', 'false');
  knopf.innerHTML = wrap.querySelector('svg').outerHTML.replace(/width="16" height="16"/, 'width="20" height="20"');
  links.append(knopf);
  function oeffne(an, fokusZurueck = false) {
    const war = wrap.hasAttribute('data-offen');
    wrap.toggleAttribute('data-offen', an); knopf.setAttribute('aria-expanded', String(an));
    if (!an && war) { picker.close(); if (fokusZurueck && knopf.getClientRects().length) knopf.focus(); }
  }
  knopf.addEventListener('click', () => { if (!erlaubt()) return; const an = !wrap.hasAttribute('data-offen'); oeffne(an); if (an) feld.focus(); });
  // Am Feld selbst lauschen: patient-suche.js stoppt Escape (stopPropagation), document sähe es nicht.
  feld.addEventListener('keydown', event => { if (event.key === 'Escape' && wrap.hasAttribute('data-offen')) oeffne(false, true); });
  wrap.addEventListener('focusout', event => { if (wrap.hasAttribute('data-offen') && !wrap.contains(event.relatedTarget) && event.relatedTarget !== knopf) oeffne(false); });
  schmal.addEventListener('change', () => oeffne(false));
  document.addEventListener('keydown', event => {
    const zu = !wrap.getClientRects().length, perKnopf = zu && schmal.matches && !!knopf.getClientRects().length;
    if (!erlaubt() || (zu && !perKnopf) || event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || event.isComposing) return;
    const target = document.activeElement;
    if (target?.matches('input,textarea,select') || target?.isContentEditable) return;
    if ([...document.querySelectorAll('.modal-overlay,dialog[open]')].some(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')) return;
    event.preventDefault(); if (perKnopf) oeffne(true); feld.focus();
  });
  return {
    wrap,
    aktualisieren() {
      wrap.hidden = !erlaubt(); knopf.hidden = wrap.hidden;
      artenSetzen();
      if (wrap.hidden) { oeffne(false); picker.close(); feld.value = ''; hinweis.textContent = ''; wrap.querySelector('.patient-search-list')?.replaceChildren(); }
    },
    // An explicit source-cache invalidation can reuse the current public picker API.
    auffrischen: () => erlaubt() ? picker.refresh() : Promise.resolve(),
  };
}
