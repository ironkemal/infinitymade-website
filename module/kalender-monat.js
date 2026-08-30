/**
 * kalender-monat.js — die Monatsübersicht des Terminkalenders.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Monatsansicht konnte bis zum 22.08.2026 genau eines: auf einen Tag
 * klicken und in die Tagesansicht springen. Anlegen ging nicht, und die
 * Termin-Pillen waren nicht anklickbar — man sah, dass etwas da ist, kam aber
 * nicht heran.
 *
 * Zwei Gesten auf derselben Kachel
 * ────────────────────────────────
 * Einfachklick springt in den Tag (so war es immer, das sitzt in den Fingern),
 * Doppelklick legt einen Termin an. Beides auf demselben Element geht nur mit
 * einer kleinen Verzögerung: ohne sie wäre die Monatsansicht beim Doppelklick
 * schon weg, bevor der zweite Klick ankommt. Der Timer lebt hier im Modul und
 * nicht als globale Variable in `dashboard.js` — er gehört niemandem sonst.
 *
 * Der Monat kennt keine Uhrzeit. Der Doppelklick setzt deshalb 09:00 als
 * sichtbaren Startwert, den man ändert — geraten wird nichts.
 *
 * Konsey 2026-08-13: neuer Code kommt in ein eigenes Modul.
 */

import { aufLangenDruck } from './langer-druck.js?v=20260822';

const MONATE_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Wie viele Termine je Kachel gezeigt werden, bevor „+N" erscheint. */
const MAX_PILLEN = 3;

/** Wartezeit, in der ein zweiter Klick den Sprung noch abfangen kann. */
export const SPRUNG_VERZOEGERUNG_MS = 250;

const zwei = (n) => String(n).padStart(2, '0');

/** "2026-08-22" aus einem Date, lokal — nicht über toISOString(). */
function alsISODatum(d) {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/**
 * Die Kacheln eines Monats, Montag zuerst, vorne und hinten mit den Tagen der
 * Nachbarmonate aufgefüllt, bis volle Wochen entstehen.
 *
 * Ausgelagert und exportiert, weil hier die Fehler sitzen, die man im
 * Bildschirmfoto nicht sieht: der Sonntag als Wochenstart, der 1. eines
 * Monats, der auf einen Sonntag fällt, und die sechste Zeile im März.
 */
export function monatsKacheln(year, month) {
  const ersterTag = new Date(year, month, 1);
  // getDay(): 0 = Sonntag. Umrechnen auf Montag = 0.
  const startVersatz = (ersterTag.getDay() + 6) % 7;

  const tageImMonat = new Date(year, month + 1, 0).getDate();
  const tageVormonat = new Date(year, month, 0).getDate();

  const kacheln = [];
  for (let i = 0; i < startVersatz; i++) {
    kacheln.push({
      date: new Date(year, month - 1, tageVormonat - startVersatz + i + 1),
      otherMonth: true,
    });
  }
  for (let d = 1; d <= tageImMonat; d++) {
    kacheln.push({ date: new Date(year, month, d), otherMonth: false });
  }
  while (kacheln.length % 7 !== 0) {
    kacheln.push({
      date: new Date(year, month + 1, kacheln.length - tageImMonat - startVersatz + 1),
      otherMonth: true,
    });
  }
  return kacheln;
}

let sprungTimer = null;
let langdruckVerdrahtet = false;
let letzterStand = { onTagDoppelklick: null };

/** Bricht einen wartenden Sprung ab — der Doppelklick hat gewonnen. */
function sprungAbbrechen() {
  if (sprungTimer) { clearTimeout(sprungTimer); sprungTimer = null; }
}

/**
 * Zeichnet die Monatsansicht neu.
 *
 * @param {object} o
 * @param {object}   o.supabase
 * @param {number}   o.year
 * @param {number}   o.month           0-basiert, wie bei Date
 * @param {string}   o.ownerId
 * @param {Array}    o.teamMembers
 * @param {string}   o.calEmpFilter
 * @param {function} o.farbeFuer       (booking) => { flaeche, rand }
 * @param {function} o.onTagEinfachklick (date) => void
 * @param {function} o.onTagDoppelklick  ({ dateStr, date }) => void
 * @param {function} o.onTerminKlick     (booking) => void
 * @param {function} [o.setzeDatumsLabel] (text) => void
 */
export async function renderMonat({
  supabase,
  year,
  month,
  ownerId,
  teamMembers = [],
  calEmpFilter = 'all',
  farbeFuer,
  onTagEinfachklick,
  onTagDoppelklick,
  onTerminKlick,
  setzeDatumsLabel,
}) {
  const header = document.getElementById('monthGridHeader');
  const grid = document.getElementById('monthGrid');
  if (!header || !grid) return;

  header.innerHTML = WOCHENTAGE.map(d => `<div>${d}</div>`).join('');

  // Auf dem Tablet gibt es keinen Doppelklick. Der Zuhörer hängt am Raster,
  // das über das Neuzeichnen hinweg bestehen bleibt.
  letzterStand = { onTagDoppelklick };
  if (!langdruckVerdrahtet) {
    langdruckVerdrahtet = true;
    aufLangenDruck(grid, '.month-cell', (zelle, ev) => {
      // Auf einer Pille gehört der lange Druck dem Kontextmenü.
      if (ev.target?.closest?.('.month-event-pill')) return;
      sprungAbbrechen();
      const rueckruf = letzterStand.onTagDoppelklick;
      if (rueckruf && zelle.dataset.datum) {
        rueckruf({ dateStr: zelle.dataset.datum, date: new Date(zelle.dataset.datum + 'T12:00:00') });
      }
    });
  }

  const kacheln = monatsKacheln(year, month);
  const heute = alsISODatum(new Date());

  const mitarbeiter = calEmpFilter === 'all'
    ? teamMembers
    : teamMembers.filter(e => e.id === calEmpFilter);
  const empIds = mitarbeiter.map(e => e.id);

  const { data: bookings } = await supabase.from('bookings')
    .select('id,user_id,service_id,start_time,customer_name,status,is_group,group_parent_id,services(title,color)')
    .eq('owner_id', ownerId)
    .gte('start_time', new Date(year, month, 1).toISOString())
    .lte('start_time', new Date(year, month + 1, 0, 23, 59, 59).toISOString())
    // Leere Liste würde zu einem ungültigen in.() werden.
    .in('user_id', empIds.length ? empIds : ['none'])
    .neq('status', 'cancelled');

  if (setzeDatumsLabel) setzeDatumsLabel(`${MONATE_DE[month]} ${year}`);

  grid.innerHTML = '';

  kacheln.forEach(({ date, otherMonth }) => {
    const ds = alsISODatum(date);

    const zelle = document.createElement('div');
    zelle.className = 'month-cell'
      + (otherMonth ? ' month-cell--other-month' : '')
      + (ds === heute ? ' month-cell--today' : '');
    zelle.dataset.datum = ds;

    const tagesZahl = document.createElement('div');
    tagesZahl.className = 'month-cell-day';
    tagesZahl.textContent = String(date.getDate());
    zelle.appendChild(tagesZahl);

    const wrap = document.createElement('div');
    wrap.className = 'month-cell-events';

    const tagesTermine = (bookings || []).filter(b => b.start_time && b.start_time.startsWith(ds));

    tagesTermine.slice(0, MAX_PILLEN).forEach(b => {
      const farben = farbeFuer ? farbeFuer(b) : {};
      const pille = document.createElement('div');
      pille.className = 'month-event-pill';
      // Das Kontextmenü liest den Termin vom Element.
      pille._termin = b;
      pille.style.backgroundColor = farben.flaeche || 'var(--primary)';
      // Der Rand trägt den Mitarbeiter — in dieser Ansicht die einzige Stelle,
      // an der er überhaupt noch abzulesen ist.
      pille.style.borderLeft = `3px solid ${farben.rand || farben.flaeche || 'var(--primary)'}`;
      pille.textContent = b.services?.title || b.customer_name || 'Termin';
      // Die Pille zeigt einen konkreten Termin — dann soll sie ihn auch öffnen,
      // statt nur in den Tag zu springen.
      pille.addEventListener('click', (ev) => {
        ev.stopPropagation();
        sprungAbbrechen();
        if (onTerminKlick) onTerminKlick(b);
      });
      pille.addEventListener('dblclick', (ev) => ev.stopPropagation());
      wrap.appendChild(pille);
    });

    if (tagesTermine.length > MAX_PILLEN) {
      const mehr = document.createElement('div');
      mehr.className = 'month-cell-more';
      mehr.textContent = `+${tagesTermine.length - MAX_PILLEN}`;
      wrap.appendChild(mehr);
    }

    zelle.appendChild(wrap);

    zelle.addEventListener('click', () => {
      sprungAbbrechen();
      sprungTimer = setTimeout(() => {
        sprungTimer = null;
        if (onTagEinfachklick) onTagEinfachklick(date);
      }, SPRUNG_VERZOEGERUNG_MS);
    });

    zelle.addEventListener('dblclick', () => {
      sprungAbbrechen();
      if (onTagDoppelklick) onTagDoppelklick({ dateStr: ds, date });
    });

    grid.appendChild(zelle);
  });
}
