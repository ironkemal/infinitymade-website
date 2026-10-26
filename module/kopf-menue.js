/**
 * kopf-menue.js — Mechanik der Knopf-Menüs in der Kopfleiste des neuen Designs (Redesign v2).
 *
 * Gemeinsam für das Profilmenü (module/kopf-profil.js, V2.08) und „+ Neu“ (module/kopf-neu.js,
 * V2.10), damit Öffnen/Schließen/Tastatur nicht zweimal geschrieben werden. Ein Menü = Knopf mit
 * aria-haspopup + Feld role="menu". Inhalt baut der Aufrufer bei jedem Öffnen neu (`fuellen`),
 * damit Rechte und Sichtbarkeit (aus dashboard.js) immer frisch gelesen werden.
 * Bedienung: Klick/Enter öffnet und fokussiert den ersten Eintrag, Pfeile/Pos1/Ende wandern,
 * Escape schließt mit Fokus zurück, Klick außerhalb oder Fokus raus schließt.
 */

/** Reine Hilfe (testbar): nächster Index beim Wandern mit Pfeiltasten (rundum). */
export function naechsterIndex(jetzt, schritt, anzahl) {
  if (!anzahl) return -1;
  if (jetzt < 0) return schritt > 0 ? 0 : anzahl - 1;
  return (jetzt + schritt + anzahl) % anzahl;
}

/**
 * @param {object} o
 * @param {string} o.klasse        Grundklasse, z. B. 'px-profil' → Hülle `${klasse}-wrap`, Feld `${klasse}-menue`, Einträge `${klasse}-eintrag`
 * @param {string} o.id            id des Feldes (für aria-controls)
 * @param {(api) => void} o.fuellen  baut den Inhalt; api.eintrag(text, symbolHtml, handeln, href?) liefert einen Eintrag
 * @returns {{ wrap: HTMLElement, knopf: HTMLButtonElement, menue: HTMLElement, schliesse: Function }}
 */
export function kopfMenue({ klasse, id, fuellen }) {
  const wrap = document.createElement('div');
  wrap.className = `${klasse}-wrap`;
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = klasse;
  knopf.setAttribute('aria-haspopup', 'menu');
  knopf.setAttribute('aria-expanded', 'false');
  knopf.setAttribute('aria-controls', id);
  const menue = document.createElement('div');
  menue.className = `${klasse}-menue`;
  menue.id = id;
  menue.setAttribute('role', 'menu');
  menue.hidden = true;
  wrap.append(knopf, menue);

  const eintraege = () => [...menue.querySelectorAll(`.${klasse}-eintrag`)];

  function schliesse({ fokusZurueck = false } = {}) {
    if (menue.hidden) return;
    menue.hidden = true;
    knopf.setAttribute('aria-expanded', 'false');
    if (fokusZurueck) knopf.focus({ preventScroll: true });
  }

  function eintrag(text, symbol, handeln, href) {
    const el = document.createElement(href ? 'a' : 'button');
    el.className = `${klasse}-eintrag`;
    el.setAttribute('role', 'menuitem');
    if (href) el.href = href; else el.type = 'button';
    el.innerHTML = symbol || '';
    const s = document.createElement('span');
    s.textContent = text;
    el.appendChild(s);
    el.addEventListener('click', (e) => { schliesse(); handeln?.(e); });
    return el;
  }

  knopf.addEventListener('click', () => {
    if (!menue.hidden) { schliesse(); return; }
    menue.replaceChildren();
    fuellen({ menue, eintrag });
    if (!eintraege().length) return;
    menue.hidden = false;
    knopf.setAttribute('aria-expanded', 'true');
    eintraege()[0].focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => {
    if (menue.hidden) return;
    const liste = eintraege();
    const i = liste.indexOf(document.activeElement);
    let ziel = -2;
    if (e.key === 'Escape') { e.preventDefault(); schliesse({ fokusZurueck: true }); return; }
    if (e.key === 'ArrowDown') ziel = naechsterIndex(i, 1, liste.length);
    else if (e.key === 'ArrowUp') ziel = naechsterIndex(i, -1, liste.length);
    else if (e.key === 'Home') ziel = 0;
    else if (e.key === 'End') ziel = liste.length - 1;
    if (ziel < -1) return;
    e.preventDefault();
    liste[ziel]?.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) schliesse(); }, true);
  document.addEventListener('focusin', (e) => { if (!wrap.contains(e.target)) schliesse(); });

  return { wrap, knopf, menue, schliesse };
}
