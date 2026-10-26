/**
 * leiste-flyout.js — Gruppen-Flyout der eingeklappten Leiste (Redesign v2, PLAN-V2 V2.07).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js). Eingeklappt (≥ 1025 px, .sidebar.collapsed)
 * öffnet ein Klick auf einen Gruppenkopf ein schwebendes Feld rechts daneben mit den Einträgen
 * der Gruppe. Die Einträge sind Stellvertreter: ein Klick löst den Original-Eintrag in #sidebarNav
 * aus — Sichtbarkeit, Rechte und switchPanel bleiben bei dashboard.js, hier gibt es keine zweite Logik.
 *
 * Bedienung: Klick/Tippen (kein Hover nötig), Enter/Leertaste am Kopf, Pfeiltasten im Feld,
 * Escape schließt und gibt den Fokus an den Kopf zurück, Klick außerhalb oder Fokus raus schließt.
 * Muster wie module/kalender-kontextmenue.js: erst Lage setzen, dann einhängen, Fokus ohne Scroll.
 */

const RAND = 8;
const ABSTAND = 8;

/** Reine Hilfe (testbar): Lage des Feldes neben dem Kopf, im Fenster geklemmt. */
export function flyoutLage(kopf, leiste, hoehe, fensterHoehe) {
  const left = Math.round(leiste.right + ABSTAND);
  const maxTop = Math.max(RAND, fensterHoehe - hoehe - RAND);
  const top = Math.round(Math.min(Math.max(RAND, kopf.top), maxTop));
  return { left, top };
}

let feld = null;
let offenerKopf = null;

const istEingeklappt = () => {
  const leiste = document.getElementById('sidebar');
  return !!leiste && leiste.classList.contains('collapsed') && window.matchMedia('(min-width: 1025px)').matches;
};

export function schliesseFlyout({ fokusZurueck = false } = {}) {
  if (!feld) return;
  feld.remove();
  feld = null;
  if (offenerKopf) {
    offenerKopf.setAttribute('aria-expanded', 'false');
    if (fokusZurueck) offenerKopf.focus({ preventScroll: true });
  }
  offenerKopf = null;
}

function eintraege() {
  return feld ? [...feld.querySelectorAll('.px-flyout-eintrag')] : [];
}

function bewege(schritt) {
  const liste = eintraege();
  if (!liste.length) return;
  const jetzt = liste.indexOf(document.activeElement);
  const ziel = jetzt === -1 ? (schritt > 0 ? 0 : liste.length - 1) : (jetzt + schritt + liste.length) % liste.length;
  liste[ziel].focus({ preventScroll: true });
}

function oeffne(gruppe, kopf) {
  schliesseFlyout();
  const originale = [...gruppe.querySelectorAll('.nav-group-items .sidebar-item')];
  if (!originale.length) return;

  const neu = document.createElement('div');
  neu.className = 'px-flyout';
  neu.setAttribute('role', 'menu');
  neu.id = 'pxFlyout';
  const titel = kopf.querySelector('.nav-group-label')?.textContent?.trim() || '';
  neu.setAttribute('aria-label', titel);
  const ueberschrift = document.createElement('div');
  ueberschrift.className = 'px-flyout-titel';
  ueberschrift.textContent = titel;
  neu.appendChild(ueberschrift);

  for (const orig of originale) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'px-flyout-eintrag' + (orig.classList.contains('active') ? ' active' : '');
    knopf.setAttribute('role', 'menuitem');
    if (orig.classList.contains('active')) knopf.setAttribute('aria-current', 'page');
    const symbol = orig.querySelector('.icon');
    if (symbol) knopf.appendChild(symbol.cloneNode(true));
    const text = document.createElement('span');
    text.textContent = orig.querySelector(':scope > span:not(.icon):not(.nav-badge)')?.textContent?.trim() || orig.textContent.trim();
    knopf.appendChild(text);
    const zahl = orig.querySelector('.nav-badge');
    if (zahl && zahl.style.display !== 'none' && zahl.textContent.trim()) {
      const z = zahl.cloneNode(true);
      z.removeAttribute('id');
      knopf.appendChild(z);
    }
    knopf.addEventListener('click', () => { schliesseFlyout(); orig.click(); });
    neu.appendChild(knopf);
  }

  neu.style.visibility = 'hidden';
  neu.style.left = '0px';
  neu.style.top = '0px';
  document.body.appendChild(neu);
  const lage = flyoutLage(kopf.getBoundingClientRect(), document.getElementById('sidebar').getBoundingClientRect(),
    neu.getBoundingClientRect().height, window.innerHeight);
  neu.style.left = lage.left + 'px';
  neu.style.top = lage.top + 'px';
  neu.style.visibility = '';

  feld = neu;
  offenerKopf = kopf;
  kopf.setAttribute('aria-expanded', 'true');
  kopf.setAttribute('aria-controls', 'pxFlyout');
  (neu.querySelector('.px-flyout-eintrag.active') || eintraege()[0])?.focus({ preventScroll: true });
}

let verdrahtet = false;
/** Einmal verdrahten; #sidebarNav wird von dashboard.js neu gebaut, darum Ereignis-Delegation. */
export function verdrahteFlyout() {
  if (verdrahtet) return;
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  verdrahtet = true;

  // Capture-Phase: vor dem Klapp-Handler von dashboard.js (am Kopf), damit eingeklappt nichts aufklappt.
  nav.addEventListener('click', (e) => {
    const kopf = e.target.closest('.nav-group-header');
    if (!kopf || !istEingeklappt()) return;
    e.stopPropagation();
    e.preventDefault();
    if (offenerKopf === kopf) { schliesseFlyout(); return; }
    oeffne(kopf.closest('.nav-group'), kopf);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!feld) return;
    if (e.key === 'Escape') { e.preventDefault(); schliesseFlyout({ fokusZurueck: true }); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bewege(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); bewege(-1); }
    else if (e.key === 'Home') { e.preventDefault(); eintraege()[0]?.focus({ preventScroll: true }); }
    else if (e.key === 'End') { e.preventDefault(); eintraege().at(-1)?.focus({ preventScroll: true }); }
  });
  document.addEventListener('pointerdown', (e) => {
    if (feld && !feld.contains(e.target) && !offenerKopf?.contains(e.target)) schliesseFlyout();
  }, true);
  document.addEventListener('focusin', (e) => {
    if (feld && !feld.contains(e.target) && e.target !== offenerKopf) schliesseFlyout();
  });
  // Breite über/unter 1025 px: Rollen der Köpfe neu (schließt ausgeklappt auch das Feld).
  window.matchMedia('(min-width: 1025px)').addEventListener('change', () => kopfRollen());
}

/** Eingeklappt sind Gruppenköpfe Menüknöpfe; ausgeklappt nicht. Bei jedem Rendern und Umschalten. */
export function kopfRollen() {
  const zu = istEingeklappt();
  document.querySelectorAll('#sidebarNav .nav-group-header').forEach((k) => {
    if (zu) { k.setAttribute('aria-haspopup', 'menu'); if (k !== offenerKopf) k.setAttribute('aria-expanded', 'false'); }
    else { k.removeAttribute('aria-haspopup'); k.removeAttribute('aria-expanded'); k.removeAttribute('aria-controls'); }
  });
  if (!zu) schliesseFlyout();
}
