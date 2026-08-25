/**
 * kalender-woche.js — die Wochenansicht des Terminkalenders.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Wochenansicht war bis zum 22.08.2026 eine reine Anzeige: sie zeichnete
 * Terminblöcke auf eine leere Fläche. Man konnte darin nichts anlegen, nichts
 * öffnen und nichts verschieben — für all das musste man erst in die
 * Tagesansicht wechseln. Die Rückmeldung aus der Beta-Praxis war entsprechend:
 * „Termine müssen per Doppelklick direkt auf einzelnen Tagen/Uhrzeiten in der
 * Wochenübersicht angelegt werden können."
 *
 * Dazu kam ein Fehler, der zuerst weg musste: die Zeitleiste am linken Rand
 * erbte die Zeilenhöhe der Tagesansicht (56 px), die Tagesspalten rechneten
 * aber mit 28 px. Die angezeigte Uhrzeit gehörte zu keinem Terminblock. Ein
 * Doppelklick auf eine Uhrzeit wäre damit sinnlos gewesen. Die Höhe steht
 * jetzt als `WV_SLOT_PX` in `kalender-raster.js` und als Gegenstück in
 * `dashboard.css` (`.week-view-grid .dv-slot`).
 *
 * Was dieses Modul kann und die alte Fassung nicht konnte
 * ──────────────────────────────────────────────────────
 *   1. Rasterfelder statt leerer Fläche — Doppelklick legt einen Termin an.
 *   2. Klick auf einen Terminblock öffnet den Seitenbereich. Die Blöcke hatten
 *      vorher `cursor:pointer`, aber keinen Zuhörer; ein Klick tat nichts.
 *   3. Verschieben funktioniert in der Woche. Bisher zwang `startMoveBooking`
 *      in die Tagesansicht, weil es dort die einzigen anklickbaren Felder gab.
 *
 * Das Modul kennt weder `supabase` noch den Zustand des Kalenders — beides
 * kommt als Argument herein. So bleibt es prüfbar und `dashboard.js` wächst
 * nicht (Konsey 2026-08-13).
 */

import { WV_SLOT_PX } from './kalender-raster.js?v=20260822';
import { aufLangenDruck } from './langer-druck.js?v=20260822';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/** Erster und letzter angezeigter Zeitpunkt — identisch zur Tagesansicht. */
const START_STUNDE = 8;
const END_STUNDE = 20;
const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Farbe mit Deckkraft für die Blockfläche.
 *
 * Nicht einfach `farbe + '22'`: die Mitarbeiterfarbe fällt auf
 * `var(--primary)` zurück, sobald ein Termin zu niemandem aus `teamMembers`
 * gehört (ausgeschiedener Mitarbeiter, mehr Mitarbeiter als Farben). Aus
 * `var(--primary)22` wird kein Farbwert — der Block hätte gar keine Fläche
 * mehr und wäre nur noch am linken Rand zu erkennen.
 */
export function mitDeckkraft(farbe, hexSuffix = '22', anteil = '13%') {
  return /^#[0-9a-fA-F]{6}$/.test(farbe)
    ? farbe + hexSuffix
    : `color-mix(in srgb, ${farbe} ${anteil}, transparent)`;
}

const zwei = (n) => String(n).padStart(2, '0');

/**
 * Der Langdruck-Zuhörer hängt am Behälter, der über das Neuzeichnen hinweg
 * stehen bleibt — er darf deshalb nur einmal gesetzt werden. Was er beim
 * Auslösen tun soll, ändert sich aber mit jedem Zeichnen (anderer Rückruf,
 * anderer Verschieben-Zustand). Deshalb liest er hier den jeweils letzten
 * Stand, statt selbst neu verdrahtet zu werden.
 */
let langdruckVerdrahtet = false;
let letzterStand = { onSlotDoppelklick: null, moveAktiv: false };

/** "2026-08-22" aus einem Date, ohne Zeitzonenumweg über toISOString(). */
function alsISODatum(d) {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/**
 * Montag der Woche, in der `dateStr` liegt.
 *
 * Mittags (T12:00) angesetzt und nicht um Mitternacht: an den beiden
 * Umstellungstagen der Sommerzeit kann 00:00 lokal auf den Vortag rutschen,
 * und dann zeigt die Woche einen Tag zu früh.
 */
export function montagDerWoche(dateStr) {
  const basis = new Date(dateStr + 'T12:00:00');
  const wochentag = basis.getDay(); // 0 = Sonntag
  const versatz = wochentag === 0 ? -6 : 1 - wochentag;
  const montag = new Date(basis);
  montag.setDate(basis.getDate() + versatz);
  return montag;
}

/** Die sieben Tage der Woche, Montag zuerst. */
export function wochenTage(dateStr) {
  const montag = montagDerWoche(dateStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(montag);
    d.setDate(montag.getDate() + i);
    return d;
  });
}

/** Pixelabstand vom oberen Rand für einen Zeitpunkt innerhalb des Rasters. */
export function pixelFuerMinute(minuteDesTages) {
  return ((minuteDesTages - START_STUNDE * 60) / 30) * WV_SLOT_PX;
}

/**
 * Zeichnet die Wochenansicht neu.
 *
 * @param {object} o
 * @param {object}   o.supabase
 * @param {string}   o.dateStr        Irgendein Tag der gewünschten Woche
 * @param {string}   o.ownerId
 * @param {Array}    o.teamMembers
 * @param {string}   o.calEmpFilter   Mitarbeiter-Id oder 'all'
 * @param {function} o.farbeFuer      (booking) => { flaeche, rand }
 * @param {boolean}  o.moveAktiv      Verschieben-Modus läuft
 * @param {function} o.onSlotDoppelklick ({ dateStr, timeStr, empId }) => void
 * @param {function} o.onSlotKlick       ({ timeStr, empId, slotEl, ev }) => void
 * @param {function} o.onTerminKlick     (booking) => void
 * @param {function} [o.setzeDatumsLabel] (text) => void
 */
export async function renderWoche({
  supabase,
  dateStr,
  ownerId,
  teamMembers = [],
  calEmpFilter = 'all',
  farbeFuer,
  moveAktiv = false,
  onSlotDoppelklick,
  onSlotKlick,
  onTerminKlick,
  setzeDatumsLabel,
}) {
  const tage = wochenTage(dateStr);

  const kurz = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  if (setzeDatumsLabel) setzeDatumsLabel(`${kurz(tage[0])} – ${kurz(tage[6])}`);

  const timeCol = document.getElementById('wvTimeCol');
  const colsWrap = document.getElementById('wvColsWrap');
  if (!timeCol || !colsWrap) return;
  timeCol.innerHTML = '';
  colsWrap.innerHTML = '';

  // Auf dem Tablet gibt es keinen Doppelklick — langes Drücken tut dasselbe.
  letzterStand = { onSlotDoppelklick, moveAktiv };
  if (!langdruckVerdrahtet) {
    langdruckVerdrahtet = true;
    aufLangenDruck(colsWrap, '.dv-slot', (feld) => {
      const { onSlotDoppelklick: rueckruf, moveAktiv: verschiebt } = letzterStand;
      if (verschiebt || !rueckruf || !feld.dataset.time) return;
      rueckruf({
        dateStr: feld.dataset.time.slice(0, 10),
        timeStr: feld.dataset.time,
        empId: feld.dataset.empId || null,
      });
    });
  }

  const jetzt = new Date();
  const heuteISO = alsISODatum(jetzt);
  const jetztMinute = jetzt.getHours() * 60 + jetzt.getMinutes();

  // ── Zeitleiste links ─────────────────────────────────────────────────────
  for (let h = START_STUNDE; h < END_STUNDE; h++) {
    for (let m = 0; m < 60; m += 30) {
      const feld = document.createElement('div');
      feld.className = 'dv-slot';
      const label = document.createElement('div');
      label.className = 'dv-time-label';
      label.textContent = `${zwei(h)}:${zwei(m)}`;
      feld.appendChild(label);
      timeCol.appendChild(feld);
    }
  }

  // ── Termine der Woche laden ──────────────────────────────────────────────
  const vonDatum = new Date(tage[0]);
  vonDatum.setHours(0, 0, 0, 0);
  const bisDatum = new Date(tage[6]);
  bisDatum.setHours(23, 59, 59, 999);

  const mitarbeiter = calEmpFilter === 'all'
    ? teamMembers
    : teamMembers.filter(e => e.id === calEmpFilter);
  const empIds = mitarbeiter.map(e => e.id);

  const { data: bookings } = await supabase.from('bookings')
    .select('id,user_id,service_id,start_time,end_time,customer_name,status,is_group,group_parent_id,services(title,color)')
    .eq('owner_id', ownerId)
    .gte('start_time', vonDatum.toISOString())
    .lte('start_time', bisDatum.toISOString())
    // Leere Liste würde zu einem ungültigen in.() werden.
    .in('user_id', empIds.length ? empIds : ['none'])
    .neq('status', 'cancelled');

  // Bei genau einem gewählten Mitarbeiter ist die Zuordnung eindeutig und der
  // Doppelklick kann ihn vorbelegen. Bei „Alle" bleibt das Feld in der Maske
  // leer — lieber ein Klick mehr als ein Termin still beim Falschen.
  const eindeutigerEmp = calEmpFilter !== 'all' ? calEmpFilter : null;

  // ── Sieben Tagesspalten ──────────────────────────────────────────────────
  tage.forEach(tag => {
    const tagISO = alsISODatum(tag);
    const istHeute = tagISO === heuteISO;
    const istVergangen = tagISO < heuteISO;

    const spalte = document.createElement('div');
    spalte.className = 'dv-col';
    spalte.style.minWidth = '100px';

    const kopf = document.createElement('div');
    kopf.className = 'dv-col-header';
    kopf.style.cssText = `font-size:12px;font-weight:${istHeute ? '700' : '500'};`
      + `color:${istHeute ? 'var(--primary)' : 'var(--text-muted)'};`;
    kopf.textContent = `${DAY_NAMES[tag.getDay()]} ${tag.getDate()}.${tag.getMonth() + 1}.`;
    spalte.appendChild(kopf);

    const inner = document.createElement('div');
    inner.className = 'wv-col-slots';

    // Rasterfelder. Sie liegen im normalen Fluss, die Terminblöcke schweben
    // absolut darüber — deshalb werden die Blöcke danach angehängt.
    for (let h = START_STUNDE; h < END_STUNDE; h++) {
      for (let m = 0; m < 60; m += 30) {
        const feld = document.createElement('div');
        feld.className = 'dv-slot';
        if (istVergangen || (istHeute && (h * 60 + m + 30) <= jetztMinute)) {
          feld.classList.add('dv-slot--past');
        }
        const timeStr = `${tagISO}T${zwei(h)}:${zwei(m)}`;
        feld.dataset.time = timeStr;
        if (eindeutigerEmp) feld.dataset.empId = eindeutigerEmp;

        // Einfachklick gehört dem Verschieben-Modus. Ausserhalb davon tut er
        // nichts — sonst würde jeder Klick auf dem Weg zum Doppelklick schon
        // eine Maske öffnen.
        feld.addEventListener('click', (ev) => {
          if (!moveAktiv || !onSlotKlick) return;
          onSlotKlick({ timeStr, empId: eindeutigerEmp, slotEl: feld, ev });
        });

        feld.addEventListener('dblclick', () => {
          if (moveAktiv || !onSlotDoppelklick) return;
          onSlotDoppelklick({ dateStr: tagISO, timeStr, empId: eindeutigerEmp });
        });

        inner.appendChild(feld);
      }
    }

    if (istHeute && jetztMinute >= START_STUNDE * 60 && jetztMinute < END_STUNDE * 60) {
      const linie = document.createElement('div');
      linie.className = 'dv-now-line';
      linie.style.top = pixelFuerMinute(jetztMinute) + 'px';
      inner.appendChild(linie);
    }

    const tagesTermine = (bookings || []).filter(b => b.start_time && b.start_time.startsWith(tagISO));

    tagesTermine.forEach(b => {
      const start = new Date(b.start_time);
      const ende = new Date(b.end_time || b.start_time);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endeMin = ende.getHours() * 60 + ende.getMinutes();

      const farben = farbeFuer ? farbeFuer(b) : {};
      const flaeche = farben.flaeche || 'var(--primary)';
      const rand = farben.rand || flaeche;

      const block = document.createElement('div');
      block.className = 'wv-booking-block';
      // Das Kontextmenü (module/kalender-kontextmenue.js) liest den Termin vom
      // Element. Über eine Id müsste es ihn erst wieder suchen — die Liste
      // steht aber nur hier, im Rumpf dieses Zeichenlaufs.
      block._termin = b;
      block.style.top = pixelFuerMinute(startMin) + 'px';
      block.style.height = Math.max(((endeMin - startMin) / 30) * WV_SLOT_PX, WV_SLOT_PX) + 'px';
      block.style.background = mitDeckkraft(flaeche);
      block.style.borderLeftColor = rand;
      block.title = `${b.services?.title || 'Termin'} – ${b.customer_name || ''}`;

      // Auch in der Wochenansicht: ohne Uhrzeit muss man den Block gegen die
      // Zeitleiste am Rand halten.
      const zeit = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      block.innerHTML = `<span style="font-variant-numeric:tabular-nums;opacity:0.85;">${escapeHtml(zeit)}</span> `
        + escapeHtml(b.services?.title || 'Termin');

      // Ohne stopPropagation zählt der Klick zusätzlich als Klick auf das
      // Rasterfeld darunter — im Verschieben-Modus würde der Termin dabei auf
      // sich selbst gesetzt.
      block.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (moveAktiv) return;
        if (onTerminKlick) onTerminKlick(b);
      });
      block.addEventListener('dblclick', (ev) => ev.stopPropagation());

      inner.appendChild(block);
    });

    spalte.appendChild(inner);
    colsWrap.appendChild(spalte);
  });
}
