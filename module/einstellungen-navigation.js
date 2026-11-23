/**
 * einstellungen-navigation.js — Seitennavigation für Einstellungen (Pflichtpunkt 8, Box-Test 22.11.2026).
 *
 * Warum: Einstellungen waren 25+ Abschnitte in fünf Gruppen untereinander; Inhaber fanden „System“,
 * „DATEV“ oder „Impressum“ nur durch Scrollen. Melih (22.11.): altes Design auf main, linke Navigation,
 * am Handy eine Auswahlliste.
 *
 * Bewusst KEIN Umbau des HTML: die vorhandenen Abschnitte bleiben, wo sie sind, und werden nur gefiltert
 * (Attribut data-einst-aus). Die eigenen hidden-/display-Schalter der Module (Inhaber-only, Box-only,
 * Fachbereich) bleiben unangetastet — eine Kategorie erscheint nur, wenn mindestens einer ihrer
 * Abschnitte nach diesen Regeln sichtbar wäre. Unbekannte (neue) Abschnitte landen in „Allgemein“,
 * gehen also nie verloren.
 */

/** @typedef {{ id: string, label: string }} Kategorie */

/** @type {Kategorie[]} Reihenfolge = Reihenfolge in der Navigation */
export const KATEGORIEN = [
  { id: 'allgemein', label: 'Allgemein' },
  { id: 'recht', label: 'Impressum & Datenschutz' },
  { id: 'team', label: 'Mitarbeiter & Rechte' },
  { id: 'standorte', label: 'Standorte' },
  { id: 'dokumente', label: 'Dokumente & Kommunikation' },
  { id: 'datev', label: 'DATEV-Export' },
  { id: 'abrechnung', label: 'Abrechnung' },
  { id: 'rechnung', label: 'Rechnung' },
  { id: 'ki', label: 'KI-Unterstützung' },
  { id: 'system', label: 'System' },
  { id: 'konto', label: 'Konto' },
];

/** Abschnitts-ID → Kategorie. */
const NACH_ID = {
  settingsProfileSection: 'allgemein',
  settingsBrandingSection: 'allgemein',
  settingsTerminerinnerungSection: 'allgemein',
  settingsAusfallSection: 'allgemein',
  settingsLegendeSection: 'allgemein',
  settingsRechtslinksSection: 'recht',
  settingsDsgvoSection: 'recht',
  settingsQuellenSection: 'recht',
  settingsMitarbeiterAppSection: 'team',
  settingsTeamLinkSection: 'team',
  settingsBusinessesSection: 'standorte',
  settingsDataSharingSection: 'standorte',
  aerzteSection: 'dokumente',
  settingsFaxSection: 'dokumente',
  settingsFormulareSection: 'dokumente',
  settingsMailversandSection: 'dokumente',
  settingsDatevSection: 'datev',
  settingsKontenSection: 'datev',
  settingsAbrechnungSection: 'abrechnung',
  settingsTiSection: 'abrechnung',
  settingsPreisstufenSection: 'abrechnung',
  settingsBillingSection: 'rechnung',
  settingsKiSection: 'ki',
  settingsSystemSection: 'system',
  settingsAccountSection: 'konto',
};

/** Abschnitte ohne ID, erkannt am data-i18n-Schlüssel ihres Titels. */
const NACH_TITEL = {
  set_integrations: 'allgemein',
  features_title: 'konto',
  set_password: 'konto',
};

const SPEICHER = 'praxura.einstellungen.kategorie';
const TEAM_LINK_ID = 'settingsTeamLinkSection';

/**
 * @param {{ id?: string, titelSchluessel?: string|null }} abschnitt
 * @returns {string} Kategorie-ID
 */
export function kategorieVon({ id, titelSchluessel }) {
  if (id && Object.prototype.hasOwnProperty.call(NACH_ID, id)) return /** @type {Record<string,string>} */ (NACH_ID)[id];
  if (titelSchluessel && Object.prototype.hasOwnProperty.call(NACH_TITEL, titelSchluessel)) return /** @type {Record<string,string>} */ (NACH_TITEL)[titelSchluessel];
  return 'allgemein';
}

/**
 * Welche Kategorien haben mindestens einen sichtbaren Abschnitt? Reihenfolge wie KATEGORIEN.
 * @param {Array<{ kategorie: string, sichtbar: boolean }>} abschnitte
 * @returns {Kategorie[]}
 */
export function sichtbareKategorien(abschnitte) {
  const mit = new Set(abschnitte.filter((a) => a.sichtbar).map((a) => a.kategorie));
  return KATEGORIEN.filter((k) => mit.has(k.id));
}

/**
 * Gewählte Kategorie bestimmen: Wunsch, wenn sichtbar; sonst die erste sichtbare.
 * @param {string|null|undefined} wunsch @param {Kategorie[]} sichtbar
 */
export function aktiveKategorie(wunsch, sichtbar) {
  if (wunsch && sichtbar.some((k) => k.id === wunsch)) return wunsch;
  return sichtbar[0]?.id || 'allgemein';
}

/** @param {HTMLElement} sec */
function vonModulSichtbar(sec) {
  return !sec.hidden && sec.style.display !== 'none';
}

/** @param {HTMLElement} sec */
function abschnittInfo(sec) {
  const titel = sec.querySelector('.settings-section-title');
  return { id: sec.id || '', titelSchluessel: titel?.getAttribute('data-i18n') || null };
}

/** @type {null | { zeige: (kategorie: string) => void, zeigeAbschnitt: (id: string) => void, aktualisiere: () => void }} */
let instanz = null;

/**
 * Einmal montieren; weitere Aufrufe aktualisieren nur.
 * @param {{ doc?: Document, istOwner?: () => boolean, wechslePanel?: (id: string) => unknown, speicher?: Storage|null }} [deps]
 */
export function mountEinstellungenNavigation(deps = {}) {
  if (instanz) { instanz.aktualisiere(); return instanz; }
  const doc = deps.doc || document;
  const panel = doc.getElementById('panel-settings');
  const inhalt = panel?.querySelector('.settings-sections');
  if (!panel || !inhalt) return null;
  /** @type {Storage|null} */
  let speicher = null;
  try { speicher = deps.speicher === undefined ? globalThis.localStorage : deps.speicher; } catch { speicher = null; }
  const lies = () => { try { return speicher?.getItem(SPEICHER) || null; } catch { return null; } };
  const merke = (/** @type {string} */ k) => { try { speicher?.setItem(SPEICHER, k); } catch { /* privater Modus */ } };

  // „Mitarbeiter & Rechte“: Rechte stehen im Team-Bereich — hier nur der Weg dorthin (kein zweites Formular).
  if (deps.wechslePanel && !doc.getElementById(TEAM_LINK_ID)) {
    const sec = doc.createElement('div');
    sec.className = 'settings-section';
    sec.id = TEAM_LINK_ID;
    sec.hidden = !(deps.istOwner?.() ?? false);
    const titel = doc.createElement('div');
    titel.className = 'settings-section-title';
    titel.textContent = 'Mitarbeiter & Berechtigungen';
    const body = doc.createElement('div');
    body.className = 'settings-section-body';
    const p = doc.createElement('p');
    p.className = 'form-hint';
    p.style.margin = '0 0 10px';
    p.textContent = 'Mitarbeiter anlegen, Standorte zuordnen und Rechte vergeben Sie im Bereich „Team“.';
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Team & Berechtigungen öffnen';
    btn.addEventListener('click', () => { void deps.wechslePanel?.('team'); });
    body.append(p, btn);
    sec.append(titel, body);
    (doc.getElementById('settingsMitarbeiterAppSection') || inhalt.lastElementChild || inhalt).after(sec);
  }

  const layout = doc.createElement('div');
  layout.className = 'einst-layout';
  const nav = doc.createElement('nav');
  nav.className = 'einst-nav';
  nav.setAttribute('aria-label', 'Bereiche der Einstellungen');
  const liste = doc.createElement('div');
  liste.className = 'einst-nav-liste';
  liste.setAttribute('role', 'tablist');
  const auswahl = doc.createElement('select');
  auswahl.className = 'form-input einst-nav-auswahl';
  auswahl.setAttribute('aria-label', 'Bereich der Einstellungen wählen');
  nav.append(liste, auswahl);
  inhalt.before(layout);
  layout.append(nav, inhalt);
  inhalt.classList.add('einst-filter-aktiv');

  let aktiv = lies() || 'allgemein';
  let signatur = '';

  const abschnitte = () => /** @type {HTMLElement[]} */ ([...inhalt.querySelectorAll('.settings-section')]);

  const anwenden = () => {
    const alle = abschnitte().map((sec) => ({ sec, kategorie: kategorieVon(abschnittInfo(sec)), sichtbar: vonModulSichtbar(sec) }));
    const sichtbar = sichtbareKategorien(alle);
    aktiv = aktiveKategorie(aktiv, sichtbar);
    for (const a of alle) a.sec.toggleAttribute('data-einst-aus', a.kategorie !== aktiv);
    for (const g of /** @type {HTMLElement[]} */ ([...inhalt.querySelectorAll('.settings-group')])) {
      const zeigt = [...g.querySelectorAll('.settings-section')].some((s) => !s.hasAttribute('data-einst-aus') && vonModulSichtbar(/** @type {HTMLElement} */ (s)));
      g.toggleAttribute('data-einst-leer', !zeigt);
    }
    const neu = sichtbar.map((k) => k.id).join(',') + '|' + aktiv;
    if (neu === signatur) return;
    signatur = neu;
    liste.replaceChildren(...sichtbar.map((k) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'einst-nav-eintrag';
      b.setAttribute('role', 'tab');
      b.dataset.kategorie = k.id;
      b.setAttribute('aria-selected', String(k.id === aktiv));
      b.textContent = k.label;
      b.addEventListener('click', () => zeige(k.id));
      return b;
    }));
    auswahl.replaceChildren(...sichtbar.map((k) => new Option(k.label, k.id, false, k.id === aktiv)));
  };

  /** @param {string} k */
  const zeige = (k) => { aktiv = k; merke(k); signatur = ''; anwenden(); };
  auswahl.addEventListener('change', () => zeige(auswahl.value));

  /** @param {string} id */
  const zeigeAbschnitt = (id) => {
    const sec = doc.getElementById(id);
    const ziel = sec?.closest('.settings-section') || sec;
    if (!ziel) return;
    const k = kategorieVon(abschnittInfo(/** @type {HTMLElement} */ (ziel)));
    if (k !== aktiv) { aktiv = k; signatur = ''; anwenden(); }
  };

  // Module schalten Abschnitte nach dem Laden ein/aus oder hängen neue an → Navigation nachziehen.
  let geplant = false;
  const beobachter = new (doc.defaultView || globalThis).MutationObserver(() => {
    if (geplant) return;
    geplant = true;
    queueMicrotask(() => { geplant = false; anwenden(); });
  });
  beobachter.observe(inhalt, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style'] });

  anwenden();
  instanz = { zeige, zeigeAbschnitt, aktualisiere: anwenden };
  return instanz;
}

/** Für gehZuEinstellung: vor dem Scrollen die passende Kategorie öffnen. @param {string} id */
export function einstellungenZeigeAbschnitt(id) {
  instanz?.zeigeAbschnitt(id);
}

/** Nur für Tests. */
export function _zuruecksetzen() { instanz = null; }
