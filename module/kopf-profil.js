/**
 * kopf-profil.js — Profilmenü in der Kopfleiste des neuen Designs (Redesign v2, PLAN-V2 V2.08).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js). Ersetzt sichtbar „Abmelden“ und den
 * Admin-Link: ein runder Knopf mit Initialen öffnet ein Menü. Die Einträge lösen die Originale aus
 * (#logoutBtn, #topbarAdminLink, Leisteneintrag „Einstellungen“) — Abmelde-Logik, Admin-Prüfung
 * und Rechte bleiben in dashboard.js. Die Originale versteckt design/shell.css erst, wenn dieses
 * Modul steht (Klasse px-profil-bereit am <html>), damit es nie keinen Abmeldeweg gibt.
 * Menü-Mechanik (Öffnen, Tastatur, Außenklick) seit V2.10 in module/kopf-menue.js.
 */
import { kopfMenue } from './kopf-menue.js?v=20261026s211';

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
let nameQuelle = () => '';

const sichtbar = (el) => !!el && el.style.display !== 'none' && !el.hidden;

function fuellen({ menue, eintrag }) {
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

  const m = kopfMenue({ klasse: 'px-profil', id: 'pxProfilMenue', fuellen });
  knopf = m.knopf;
  rechts.insertBefore(m.wrap, abmelden);
  profilAuffrischen();

  // Erst jetzt die Originale verstecken: es gibt immer einen Abmeldeweg.
  document.documentElement.classList.add('px-profil-bereit');
}
