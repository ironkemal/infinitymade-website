/**
 * schublade-neu.js — Menü-Schublade unter 1025 px im neuen Design (PLAN-V2 V2.11).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js). Öffnen/Schließen bleibt bei dashboard.js
 * (openSidebar/closeSidebar schalten #sidebar.open und #sidebarOverlay.visible, switchPanel schließt).
 * Dieses Modul beobachtet nur die Klasse und legt das Bedienverhalten darüber:
 *  - offen: Inhalt (#mainArea) `inert`, Fokus auf den aktiven bzw. ersten Eintrag, Tab bleibt
 *    zwischen Menüknopf und Leiste, Escape schließt und gibt den Fokus an den Menüknopf zurück;
 *  - geschlossen: Leiste `inert` (sie liegt außerhalb des Bildes und war bisher per Tab erreichbar);
 *  - Menüknopf mit aria-expanded/aria-controls.
 * R-01 (Leiste bleibt bei „Bewegung reduzieren“ offen) löst design/shell.css über `translate`.
 * Ab 1025 px greift nichts davon (Leiste ist dort fester Teil der Hülle).
 */

import { naechsterIndex } from './kopf-menue.js?v=20261026s212';

const SCHMAL = '(max-width: 1024px)';

/** Reine Hilfe (testbar): Zustand der Schublade aus Breite und Klasse. */
export function schubladenZustand(schmal, offen) {
  if (!schmal) return { leisteInert: false, inhaltInert: false, expanded: null };
  return { leisteInert: !offen, inhaltInert: offen, expanded: offen ? 'true' : 'false' };
}

const fokussierbar = (wurzel) => [...wurzel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
  .filter((el) => !el.hidden && el.offsetParent !== null);

let warOffen = false;

function anwenden() {
  const leiste = document.getElementById('sidebar');
  const inhalt = document.getElementById('mainArea');
  const knopf = document.getElementById('hamburger');
  if (!leiste || !inhalt) return;
  const schmal = window.matchMedia(SCHMAL).matches;
  const offen = leiste.classList.contains('open');
  const z = schubladenZustand(schmal, offen);
  leiste.inert = z.leisteInert;
  inhalt.inert = z.inhaltInert;
  if (knopf) {
    if (z.expanded === null) { knopf.removeAttribute('aria-expanded'); knopf.removeAttribute('aria-controls'); }
    else { knopf.setAttribute('aria-expanded', z.expanded); knopf.setAttribute('aria-controls', 'sidebar'); }
  }
  const jetztOffen = schmal && offen;
  if (jetztOffen && !warOffen) {
    // Nach dem Einblenden: aktiver Eintrag, sonst der erste.
    requestAnimationFrame(() => {
      const ziel = leiste.querySelector('.sidebar-item.active:not([hidden])') || fokussierbar(leiste)[0];
      ziel?.focus({ preventScroll: true });
      ziel?.scrollIntoView?.({ block: 'nearest' });
    });
  } else if (!jetztOffen && warOffen && leiste.contains(document.activeElement)) {
    knopf?.focus({ preventScroll: true });
  }
  warOffen = jetztOffen;
}

let verdrahtet = false;
/** Einmal verdrahten (shell-neu.js start). */
export function verdrahteSchublade() {
  if (verdrahtet) return;
  const leiste = document.getElementById('sidebar');
  if (!leiste) return;
  verdrahtet = true;
  new MutationObserver(anwenden).observe(leiste, { attributes: true, attributeFilter: ['class'] });
  window.matchMedia(SCHMAL).addEventListener('change', anwenden);

  document.addEventListener('keydown', (e) => {
    if (!warOffen) return;
    const knopf = document.getElementById('hamburger');
    if (e.key === 'Escape') {
      e.preventDefault();
      document.getElementById('sidebarOverlay')?.click();   // closeSidebar() in dashboard.js
      knopf?.focus({ preventScroll: true });
    } else if (e.key === 'Tab') {
      // Fokus bleibt in Menüknopf + Leiste (Inhalt ist inert, dahinter käme die Browserleiste).
      const kette = [knopf, ...fokussierbar(leiste)].filter(Boolean);
      const i = kette.indexOf(document.activeElement);
      if (i === -1) return;
      // Immer selbst weiterreichen: nach dem Menüknopf stünde im DOM erst die Kopfleiste.
      e.preventDefault();
      kette[naechsterIndex(i, e.shiftKey ? -1 : 1, kette.length)].focus({ preventScroll: true });
    }
  });
  anwenden();
}
