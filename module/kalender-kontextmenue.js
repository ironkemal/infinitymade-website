/**
 * kalender-kontextmenue.js — Rechtsklick auf einen Termin im Kalender.
 *
 * Warum es das gibt
 * ─────────────────
 * Eine Statusänderung kostete bisher drei Schritte: Termin anklicken,
 * Seitenbereich rechts aufgehen lassen, dort den Knopf suchen. Am Empfang
 * passiert das den ganzen Tag — „ist gekommen", „ist nicht gekommen",
 * „verschoben". Die Rückmeldung aus der Beta-Praxis (22.08.2026) war deshalb:
 * Schnellauswahl direkt auf dem Termin.
 *
 * Was dieses Modul NICHT tut
 * ──────────────────────────
 * Es ändert keinen Status. Es zeigt nur, was möglich ist, und ruft dann die
 * Funktion, die es schon gibt. Das ist Absicht: dieselbe Handlung zweimal zu
 * schreiben ist in diesem Projekt der teuerste Fehler (siehe
 * `funktionen/README.md` — Fußbefund an zwei Stellen gespeichert, Zuzahlung
 * über vier Wege). Die vier Handlungen leben weiter in `dashboard.js`:
 *
 *   wahrgenommen      → handleTerminStarten()      (Sitzungsnotiz, Sitzung 'done',
 *                                                    danach Anamnese/Notizen)
 *   nicht erschienen  → handlePatientNichtErschienen()
 *   verschieben       → startMoveBooking(b)
 *   abgesagt          → absageTerminMitGrund(b)
 *
 * ⚠️ „Wahrgenommen" heisst hier NICHT `bookings.status = 'completed'`. Was am
 * Ende Geld wird, ist `prescription_sessions.status = 'done'` — daraus baut
 * `api-backend/billing/api/abrechnung.routes.js` die §302-Positionen, und
 * `module/sitzungsfortschritt.js` entscheidet damit, ob die Verordnung
 * abrechnungsbereit wird. `bookings.status` setzt der Seitenbereich nebenbei
 * selbst, wenn der Termin vorbei ist. Wer hier eine Abkürzung nimmt und nur
 * den Terminstatus schreibt, baut einen Kalender, der richtig aussieht, und
 * eine Abrechnung, die nie kommt.
 */

import { aufLangenDruck } from './langer-druck.js?v=20260822';

/** Behälter der drei Ansichten. Sie bleiben über das Neuzeichnen bestehen. */
const BEHAELTER_IDS = ['dvColsWrap', 'wvColsWrap', 'monthGrid'];

/** Was als „Termin" gilt — in allen drei Ansichten. */
export const TERMIN_SELEKTOR = '.dv-booking-block, .wv-booking-block, .month-event-pill';

/**
 * Die Einträge für einen Termin.
 *
 * Ausgelagert und exportiert, damit die Regeln prüfbar sind, ohne ein DOM zu
 * bauen. `deaktiviert` statt Weglassen: ein Menü, dessen Einträge je nach
 * Termin die Plätze tauschen, trifft man nicht mehr blind.
 */
export function eintraegeFuer(termin) {
  const status = termin?.status || 'confirmed';
  const offen = status === 'confirmed';

  // Gruppentermine: die Handlungen betreffen die Kinder-Buchungen, nicht den
  // Kopf. Bis das geklärt ist, führt hier nur der Weg ins Panel.
  if (termin?.is_group && !termin?.group_parent_id) {
    return [{ id: 'oeffnen', label: 'Termin öffnen' }];
  }

  return [
    { id: 'wahrgenommen', label: 'Termin wahrgenommen', deaktiviert: !offen },
    { id: 'nicht_erschienen', label: 'Patient nicht erschienen', deaktiviert: !offen },
    { id: 'verschieben', label: 'Verschieben', deaktiviert: !offen },
    { id: 'trenner' },
    { id: 'oeffnen', label: 'Termin öffnen' },
    { id: 'absagen', label: 'Absagen / stornieren', gefahr: true },
  ];
}

let menueEl = null;
let offenerTermin = null;
/** Die Zuhörer an `document` und `window` dürfen sich nicht vervielfachen. */
let globalVerdrahtet = false;

function schliesse() {
  if (!menueEl) return;
  menueEl.remove();
  menueEl = null;
  offenerTermin = null;
}

function eintraegeElemente() {
  return menueEl ? [...menueEl.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')] : [];
}

function bewege(schritt) {
  const items = eintraegeElemente();
  if (!items.length) return;
  const jetzt = items.indexOf(document.activeElement);
  const ziel = jetzt === -1
    ? (schritt > 0 ? 0 : items.length - 1)
    : (jetzt + schritt + items.length) % items.length;
  items[ziel].focus();
}

/**
 * Öffnet das Menü an einem Bildschirmpunkt.
 *
 * Die Position wird erst nach dem Einhängen geprüft: vorher kennt niemand die
 * Höhe des Menüs, und am unteren Bildschirmrand stünde es sonst zur Hälfte
 * ausserhalb.
 */
function oeffne(termin, x, y, aktionen) {
  schliesse();
  offenerTermin = termin;

  const menue = document.createElement('div');
  menue.className = 'kal-kontextmenue';
  menue.setAttribute('role', 'menu');
  menue.tabIndex = -1;

  for (const eintrag of eintraegeFuer(termin)) {
    if (eintrag.id === 'trenner') {
      const linie = document.createElement('div');
      linie.className = 'kal-kontextmenue-trenner';
      menue.appendChild(linie);
      continue;
    }
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'kal-kontextmenue-eintrag' + (eintrag.gefahr ? ' kal-kontextmenue-eintrag--gefahr' : '');
    knopf.setAttribute('role', 'menuitem');
    knopf.textContent = eintrag.label;
    if (eintrag.deaktiviert) {
      knopf.disabled = true;
      knopf.setAttribute('aria-disabled', 'true');
    } else {
      knopf.addEventListener('click', () => {
        const t = offenerTermin;
        schliesse();
        fuehreAus(eintrag.id, t, aktionen);
      });
    }
    menue.appendChild(knopf);
  }

  document.body.appendChild(menue);
  menueEl = menue;

  const kasten = menue.getBoundingClientRect();
  const rand = 8;
  const links = Math.max(rand, Math.min(x, window.innerWidth - kasten.width - rand));
  const oben = Math.max(rand, Math.min(y, window.innerHeight - kasten.height - rand));
  menue.style.left = links + 'px';
  menue.style.top = oben + 'px';

  const erster = eintraegeElemente()[0];
  (erster || menue).focus();
}

function fuehreAus(id, termin, aktionen) {
  if (!termin) return;
  const fn = {
    wahrgenommen: aktionen.wahrgenommen,
    nicht_erschienen: aktionen.nichtErschienen,
    verschieben: aktionen.verschieben,
    absagen: aktionen.absagen,
    oeffnen: aktionen.oeffnen,
  }[id];
  if (fn) fn(termin);
}

/**
 * Hängt das Kontextmenü an alle drei Kalenderansichten.
 *
 * Einmal beim Start aufrufen. Die Zuhörer sitzen an den Behältern, nicht an den
 * Terminblöcken — die werden bei jedem Zeichnen neu gebaut.
 *
 * @param {object} aktionen
 * @param {function} aktionen.wahrgenommen     (booking) => void
 * @param {function} aktionen.nichtErschienen  (booking) => void
 * @param {function} aktionen.verschieben      (booking) => void
 * @param {function} aktionen.absagen          (booking) => void
 * @param {function} aktionen.oeffnen          (booking) => void
 * @param {function} [aktionen.terminAus]      (el) => booking|null
 */
export function verdrahteKontextmenue(aktionen) {
  const terminAus = aktionen.terminAus || ((el) => el?._termin || null);

  for (const id of BEHAELTER_IDS) {
    const behaelter = document.getElementById(id);
    if (!behaelter || behaelter.dataset.kontextmenue) continue;
    behaelter.dataset.kontextmenue = '1';

    behaelter.addEventListener('contextmenu', (ev) => {
      const el = ev.target?.closest?.(TERMIN_SELEKTOR);
      // Nur auf einem Termin. Auf der freien Fläche bleibt das Menü des
      // Browsers erreichbar — es dem Nutzer überall wegzunehmen wäre
      // übergriffig.
      if (!el) return;
      const termin = terminAus(el);
      if (!termin) return;
      ev.preventDefault();
      oeffne(termin, ev.clientX, ev.clientY, aktionen);
    });

    // Touch: Rechtsklick hat dort kein Gegenstück.
    aufLangenDruck(behaelter, TERMIN_SELEKTOR, (el) => {
      const termin = terminAus(el);
      if (!termin) return;
      const k = el.getBoundingClientRect();
      oeffne(termin, k.left + k.width / 2, k.top + k.height / 2, aktionen);
    });
  }

  if (globalVerdrahtet) return;
  globalVerdrahtet = true;

  // Schliessen: alles, was den Bezug zum Termin verliert.
  document.addEventListener('pointerdown', (ev) => {
    if (menueEl && !menueEl.contains(ev.target)) schliesse();
  }, true);
  window.addEventListener('resize', schliesse);
  window.addEventListener('blur', schliesse);
  // Beim Scrollen wandert der Termin weg, das Menü bliebe stehen.
  window.addEventListener('scroll', schliesse, true);

  document.addEventListener('keydown', (ev) => {
    if (!menueEl) return;
    if (ev.key === 'Escape') { ev.preventDefault(); schliesse(); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); bewege(1); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); bewege(-1); }
  });
}

/** Nur für Tests. */
export const _intern = { schliesse, istOffen: () => !!menueEl };
