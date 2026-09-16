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

/** `YYYY-MM-DD` plus n Tage, wieder als `YYYY-MM-DD`. */
function plusTage(ds, tage) {
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
function wochentag(ds) {
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
export function serienDaten({ startDatum, anzahl, intervalDays = 7, taeglich = false, wochentage = [] }) {
  const zahl = parseInt(anzahl, 10) || 0;
  if (!startDatum || zahl < 1) return [];

  const schritt = taeglich ? 1 : (parseInt(intervalDays, 10) || 7);
  const tage = wochentage.length ? [...new Set(wochentage)] : [wochentag(startDatum)];
  tage.sort((a, b) => a - b);

  // „täglich" heisst jeden Tag — und nur hier weicht diese Datei bewusst von
  // der alten `computeSeriesPreview()` ab. Die lief auch bei „täglich" durch
  // die Wochentag-Schleife und zeigte deshalb WÖCHENTLICHE Tage an, während
  // `batch-create` anschliessend wirklich Tag für Tag anlegte. Die Vorschau log
  // also genau in dem Fall, in dem sie am meisten Termine ankündigt. Die
  // Wochentag-Kästchen sind bei „täglich" ohnehin ausgeblendet
  // (`bkSeriesWeekdayWrap`), ihr Inhalt ist dort ein Rest von vorher.
  if (taeglich) {
    return Array.from({ length: zahl }, (_, i) => plusTage(startDatum, i));
  }

  // Ausgangspunkt ist der Sonntag der Startwoche — von dort werden die
  // angekreuzten Wochentage abgezählt.
  //
  // ⚠️ Damit kann der erste Treffer VOR dem Startdatum liegen (Start Mittwoch,
  // angekreuzt ist Montag). Das sieht nach einem Fehler aus und wird hier
  // trotzdem NICHT gefiltert: `POST /api/booking/batch-create` rechnet Zeile
  // für Zeile dasselbe (api-backend/server.js). Würde die Vorschau hier
  // aufräumen, zeigte sie andere Tage, als gleich darauf angelegt werden — und
  // eine Vorschau, der man nicht glauben kann, ist schlimmer als gar keine.
  // Wenn das geändert wird, dann an beiden Stellen zugleich.
  //
  // Zweiter bekannter Unterschied, ebenfalls unverändert übernommen: der Server
  // fügt den Wochentag des Starts der Menge IMMER hinzu, die Vorschau nicht.
  let woche = plusTage(startDatum, -wochentag(startDatum));
  const raus = [];
  // Obergrenze statt `while (true)`: ein Wochentag, der nie trifft, liesse die
  // Schleife ewig laufen — im Browser heisst das eingefrorene Maske ohne
  // Fehlermeldung. Zwei Jahre reichen für jede Verordnung.
  for (let runde = 0; runde < 104 && raus.length < zahl; runde++) {
    for (const tagNr of tage) {
      if (raus.length >= zahl) break;
      const kandidat = plusTage(woche, tagNr);
      if (wochentag(kandidat) === tagNr) raus.push(kandidat);
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
