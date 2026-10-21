/**
 * serien-termine.js — welche Tage eine Terminserie trifft, und wie viele davon
 * überhaupt verteilt werden sollen.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Datumsrechnung stand als `computeSeriesPreview()` in `dashboard.js` und
 * las ihre fünf Eingaben direkt aus dem Formular. Damit war sie nicht prüfbar —
 * obwohl sie das Einzige ist, was bei einer Serie über zwölf Termine
 * wirklich zählt. Umzug nach der Umzingelungsregel (Konsey 2026-08-13): was
 * angefasst wird, zieht um.
 *
 * Angefasst wurde sie wegen Ops-Karte 08fa9e2c. Zwei Beschwerden aus derselben
 * Praxis, beide über dasselbe Missverständnis der Maske:
 *
 *   1. „Anzahl 3" heisst nicht „ich will jetzt drei Termine festlegen". Oft
 *      steht nur der erste fest; die anderen zwei ruft man später an. Die
 *      Maske verlangte aber alle drei und liess sonst nicht speichern.
 *   2. Neun offene Einheiten, davon sollen fünf verteilt werden (Urlaub,
 *      Feiertage). Ging nicht — entweder alle neun oder gar keine.
 *
 * Beides ist dieselbe Annahme: die Zahl der offenen Einheiten sei zugleich die
 * Zahl der Termine, die jetzt entstehen. Diese Datei trennt die zwei Zahlen.
 *
 * Keine DOM-Zugriffe hier. Die Maske liest ihre Felder und übergibt Werte.
 */

const WOCHENTAG_KURZ = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isStrictInteger(v) {
  if (typeof v === 'number') return Number.isInteger(v);
  if (typeof v === 'string') return /^\d+$/.test(v.trim());
  return false;
}

export function isValidCalendarDate(ds) {
  if (typeof ds !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false;
  const d = new Date(ds + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().substring(0, 10) === ds;
}

/** `YYYY-MM-DD` plus n Tage, wieder als `YYYY-MM-DD`. */
export function plusTage(ds, tage) {
  const d = new Date(ds + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().substring(0, 10);
}

/**
 * Der Wochentag eines Datums in Berlin.
 *
 * Nicht `getUTCDay()`: die Serie wird in Berlin gelesen, und 12:00 UTC liegt in
 * beiden Zeitzonenlagen sicher im selben Berliner Kalendertag — aber die
 * Zuordnung Tag→Wochentag muss trotzdem über Berlin laufen, sonst kippt sie an
 * den Rändern der Sommerzeit.
 */
export function wochentag(ds) {
  const probe = new Date(ds + 'T12:00:00Z');
  return WOCHENTAG_KURZ[new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(probe)];
}

/**
 * Die Termintage einer Serie.
 *
 * @param {object} args
 * @param {string} args.startDatum    `YYYY-MM-DD`
 * @param {number} args.anzahl        wie viele Termine entstehen sollen
 * @param {number} args.intervalDays  Abstand der Wochenblöcke in Tagen (7, 14, …)
 * @param {boolean} args.taeglich     `recurrence === 'daily'` — Schrittweite 1 Tag
 * @param {number[]} args.wochentage  0=So … 6=Sa; leer → der Wochentag des Starts
 * @returns {string[]} `YYYY-MM-DD`, aufsteigend
 */
export function serienDaten({
  startDatum,
  startDate,
  anzahl,
  count,
  intervalDays,
  taeglich = false,
  recurrence,
  wochentage,
  weekdays,
} = {}) {
  const rawStart = startDatum || startDate;
  if (!isValidCalendarDate(rawStart)) return [];

  const rawCount = anzahl ?? count;
  if (!isStrictInteger(rawCount)) return [];
  const zahl = parseInt(rawCount, 10);
  if (zahl < 1) return [];

  const isDaily = taeglich === true || recurrence === 'daily';
  if (isDaily) {
    return Array.from({ length: zahl }, (_, i) => plusTage(rawStart, i));
  }

  let schritt;
  const parsedStep = parseInt(intervalDays, 10);
  if (isStrictInteger(intervalDays) && parsedStep >= 7 && parsedStep <= 84 && parsedStep % 7 === 0) {
    schritt = parsedStep;
  } else if (recurrence === 'biweekly') {
    schritt = 14;
  } else {
    schritt = 7;
  }

  const rawWd = (Array.isArray(wochentage) && wochentage.length > 0)
    ? wochentage
    : (Array.isArray(weekdays) && weekdays.length > 0 ? weekdays : (wochentage ?? weekdays));

  let tage;
  if (Array.isArray(rawWd)) {
    if (rawWd.length === 0) {
      tage = [wochentag(rawStart)];
    } else {
      const allValid = rawWd.every(n => isStrictInteger(n) && Number(n) >= 0 && Number(n) <= 6);
      if (!allValid) return [];
      tage = Array.from(new Set(rawWd.map(Number))).sort((a, b) => a - b);
    }
  } else if (rawWd === undefined || rawWd === null) {
    tage = [wochentag(rawStart)];
  } else {
    return [];
  }

  const startWd = wochentag(rawStart);
  let woche = plusTage(rawStart, -startWd);
  const raus = [];
  const maxRunden = Math.max(104, zahl * 20);

  for (let runde = 0; runde < maxRunden && raus.length < zahl; runde++) {
    for (const tagNr of tage) {
      if (raus.length >= zahl) break;
      const kandidat = plusTage(woche, tagNr);
      if (wochentag(kandidat) === tagNr && kandidat >= rawStart) {
        raus.push(kandidat);
      }
    }
    woche = plusTage(woche, schritt);
  }
  return raus;
}

/**
 * Wie viele Einheiten verteilt der Serienknopf im Verordnungs-Seitenbereich?
 *
 * Sind Einheiten angehakt, gelten nur die. Ist nichts angehakt, gelten alle
 * offenen — das ist das bisherige Verhalten und bleibt der Normalfall.
 *
 * Bewusst dieselben Häkchen wie beim Kombi-Termin (`.rx-unv-cb`): ein zweiter
 * Satz Kästchen daneben wäre nicht zu unterscheiden. Damit trotzdem klar
 * bleibt, was passiert, sagt die Knopfbeschriftung die Zahl — siehe
 * `serienKnopfText()`.
 *
 * @param {Element|null} listeEl  `#bkRxUnvergebeneList`
 * @param {number} offenGesamt
 */
export function serienAnzahl(listeEl, offenGesamt) {
  const angehakt = listeEl ? listeEl.querySelectorAll('.rx-unv-cb:checked').length : 0;
  return angehakt > 0 ? angehakt : offenGesamt;
}

/** Beschriftung des Serienknopfs — nennt immer die Zahl, die gleich passiert. */
export function serienKnopfText(anzahl, nurAuswahl) {
  const einheit = anzahl === 1 ? 'Einheit' : 'Einheiten';
  return nurAuswahl
    ? `🗓 ${anzahl} ausgewählte ${einheit} als Serie verteilen`
    : `🗓 ${anzahl} offene ${einheit} als Serie verteilen`;
}

/**
 * Der Hinweis unter dem Anzahl-Feld der Terminmaske.
 *
 * Er sagt seit dem 16.09.2026 ausdrücklich, was mit dem Rest passiert, wenn
 * man NICHT verteilt. Vorher stand dort nur „N Termine — Wiederholung und
 * Wochentage stehen unter ‚Mehr Optionen'", und die Praxis las daraus, sie
 * müsse jetzt alle N Tage festlegen (Ops 08fa9e2c).
 */
export function anzahlHinweisText(anzahl, alsSerie) {
  if (anzahl <= 1) return '';
  return alsSerie
    ? `Alle ${anzahl} Termine jetzt als Serie verteilen (Wiederholung und Wochentage unter „Mehr Optionen").`
    : `Nur diesen einen Termin speichern — die übrigen ${anzahl - 1} bleiben offen und lassen sich später vergeben.`;
}

/**
 * Wochentag der Serie folgt dem Starttag, solange niemand die Kästchen selbst
 * angefasst hat. Vorher stand ohne Verordnung fest „Mo" angehakt — eine Serie
 * ab Mittwoch lief dann montags (canli-test 20.10.2026). Mit Verordnung setzt
 * `uebernimmSerienfrequenzAusRx()` die Tage ohnehin aus der Frequenz.
 *
 * @param {Document} [doc]
 */
export function verdrahteSerienStarttag(doc = globalThis.document) {
  const wrap = doc?.getElementById('bkSeriesWeekdays');
  if (!wrap) return;
  let vonHand = false;
  wrap.addEventListener('change', (e) => { if (e.isTrusted) vonHand = true; });
  const setze = () => {
    const v = doc.getElementById('bkStart')?.value;
    if (vonHand || !v || !isValidCalendarDate(v.substring(0, 10))) return;
    const tag = new Date(v.substring(0, 10) + 'T12:00:00Z').getUTCDay();
    const boxen = [...wrap.querySelectorAll('input')];
    if (boxen.filter(cb => cb.checked).length > 1) return;   // mehrere Tage = bewusst gewählt (z. B. aus der Frequenz)
    boxen.forEach(cb => { cb.checked = Number(cb.value) === tag; });
    boxen[0]?.dispatchEvent(new Event('change'));   // Vorschau nachziehen (nicht als Handeingabe gezählt)
  };
  doc.getElementById('bkSeriesToggle')?.addEventListener('change', (e) => { if (e.target.checked) { vonHand = false; setze(); uebernimmAnzahl(); } });
  doc.getElementById('bkStart')?.addEventListener('change', setze);

  // Eine Zahl, zwei Felder: „Anzahl" oben und „Anzahl der Termine" unter
  // „Mehr Optionen" liefen auseinander („Alle 6 Termine" über einer Vorschau
  // mit 3 — canli-test 20.10.2026). Beim Einschalten gilt die obere Zahl,
  // wer unten tippt, schreibt sie nach oben zurück.
  const anzahl = doc.getElementById('bkAnzahl'), serie = doc.getElementById('bkSeriesCount');
  function uebernimmAnzahl() {
    const n = parseInt(anzahl?.value, 10);
    if (!serie || !(n > 1) || String(n) === serie.value) return;
    serie.value = String(n);
    serie.dispatchEvent(new Event('input'));
  }
  serie?.addEventListener('input', (e) => {
    if (!e.isTrusted || !anzahl) return;
    const n = parseInt(serie.value, 10);
    if (n > 1 && String(n) !== anzahl.value) { anzahl.value = String(n); anzahl.dispatchEvent(new Event('input')); }
  });
}
