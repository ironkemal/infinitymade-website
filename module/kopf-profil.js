/**
 * kopf-profil.js — Profilmenü in der Kopfleiste des neuen Designs (Redesign v2, PLAN-V2 V2.08).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js). Ersetzt sichtbar „Abmelden“ und den
 * Admin-Link: ein runder Knopf mit Initialen öffnet ein Menü. Die Einträge lösen die Originale aus
 * (#logoutBtn, #topbarAdminLink, Leisteneintrag „Einstellungen“) — Abmelde-Logik, Admin-Prüfung
 * und Rechte bleiben in dashboard.js. Die Originale versteckt design/shell.css erst, wenn dieses
 * Modul steht (Klasse px-profil-bereit am <html>), damit es nie keinen Abmeldeweg gibt.
 */

/** Reine Hilfe (testbar): bis zu zwei Initialen aus einem Namen oder einer E-Mail. */
export function initialen(name) {
  const t = String(name || '').trim();
  if (!t) return '';
  const basis = t.includes('@') ? t.split('@')[0].replace(/[._-]+/g, ' ') : t;
  const teile = basis.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (!teile.length) return '';
  const erst = (w) => w.match(/\p{L}/u)[0].toUpperCase();
  return teile.length === 1 ? erst(teile[0]) : erst(teile[0]) + erst(teile.at(-1));
}

const SYMBOL = {
  einstellungen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  abmelden: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
};

let knopf = null;
let menue = null;
let nameQuelle = () => '';

const sichtbar = (el) => !!el && el.style.display !== 'none' && !el.hidden;

function schliesse({ fokusZurueck = false } = {}) {
  if (!menue || menue.hidden) return;
  menue.hidden = true;
  knopf.setAttribute('aria-expanded', 'false');
  if (fokusZurueck) knopf.focus({ preventScroll: true });
}

function eintrag(text, symbol, handeln, href) {
  const el = document.createElement(href ? 'a' : 'button');
  el.className = 'px-profil-eintrag';
  el.setAttribute('role', 'menuitem');
  if (href) el.href = href; else el.type = 'button';
  el.innerHTML = symbol;
  const s = document.createElement('span');
  s.textContent = text;
  el.appendChild(s);
  el.addEventListener('click', (e) => { schliesse(); handeln?.(e); });
  return el;
}

function fuellen() {
  menue.replaceChildren();
  const name = nameQuelle();
  const kopf = document.createElement('div');
  kopf.className = 'px-profil-kopf';
  const stark = document.createElement('strong');
  stark.textContent = name || 'Angemeldet';
  kopf.append(stark, document.createTextNode(document.getElementById('bizName')?.textContent?.trim() || ''));
  menue.appendChild(kopf);

  const einstellungen = document.querySelector('#sidebarNav .sidebar-item[data-panel="settings"]');
  if (einstellungen) menue.appendChild(eintrag('Einstellungen', SYMBOL.einstellungen, () => einstellungen.click()));
  const admin = document.getElementById('topbarAdminLink');
  if (sichtbar(admin)) menue.appendChild(eintrag('Admin', SYMBOL.admin, null, admin.getAttribute('href')));
  const abmelden = document.getElementById('logoutBtn');
  if (abmelden) menue.appendChild(eintrag('Abmelden', SYMBOL.abmelden, () => abmelden.click()));
}

/** Kürzel im Knopf auffrischen (Name kommt nach dem Laden des Profils). */
export function profilAuffrischen() {
  if (!knopf) return;
  const name = nameQuelle();
  const kurz = initialen(name);
  if (kurz) knopf.textContent = kurz; else knopf.innerHTML = SYMBOL.person;
  knopf.setAttribute('aria-label', name ? `Profil: ${name}` : 'Profil');
}

/** Einmal einhängen. `liesName` liefert den Anzeigenamen der angemeldeten Person (oder ''). */
export function verdrahteProfil(liesName) {
  if (knopf) return;
  const rechts = document.querySelector('.topbar .topbar-right');
  const abmelden = document.getElementById('logoutBtn');
  if (!rechts || !abmelden) return;
  if (typeof liesName === 'function') nameQuelle = () => { try { return String(liesName() || '').trim(); } catch { return ''; } };

  const wrap = document.createElement('div');
  wrap.className = 'px-profil-wrap';
  knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'px-profil';
  knopf.setAttribute('aria-haspopup', 'menu');
  knopf.setAttribute('aria-expanded', 'false');
  knopf.setAttribute('aria-controls', 'pxProfilMenue');
  menue = document.createElement('div');
  menue.className = 'px-profil-menue';
  menue.id = 'pxProfilMenue';
  menue.setAttribute('role', 'menu');
  menue.hidden = true;
  wrap.append(knopf, menue);
  rechts.insertBefore(wrap, abmelden);
  profilAuffrischen();

  knopf.addEventListener('click', () => {
    if (!menue.hidden) { schliesse(); return; }
    fuellen();
    menue.hidden = false;
    knopf.setAttribute('aria-expanded', 'true');
    menue.querySelector('.px-profil-eintrag')?.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => {
    if (menue.hidden) return;
    const liste = [...menue.querySelectorAll('.px-profil-eintrag')];
    const i = liste.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); schliesse({ fokusZurueck: true }); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); liste[(i + 1) % liste.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); liste[(i - 1 + liste.length) % liste.length]?.focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) schliesse(); }, true);
  document.addEventListener('focusin', (e) => { if (!wrap.contains(e.target)) schliesse(); });

  // Erst jetzt die Originale verstecken: es gibt immer einen Abmeldeweg.
  document.documentElement.classList.add('px-profil-bereit');
}
