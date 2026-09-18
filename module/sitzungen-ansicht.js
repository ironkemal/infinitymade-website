/**
 * sitzungen-ansicht.js — „Unvergebene" und „Termine" als Umschalter statt nebeneinander.
 *
 * Warum es das gibt
 * ─────────────────
 * Im Block „Aktive Verordnung" des Seitenbereichs standen beide Listen als
 * zwei Spalten nebeneinander. Das Panel ist 440 px breit; abzüglich Rand und
 * Innenabstand blieben je Spalte rund 190 px für eine Zeile aus Kästchen,
 * Nummer, Kürzel, Heilmittelname und Ziehgriff. Der Name war praktisch immer
 * abgeschnitten — „Podologische Kompl…" —, und genau der Name ist das, was
 * man vergibt.
 *
 *   Kemal, 31.08.2026: „Also: gesamte Seite unvergeben oder gesamte Seite
 *   vergeben, nicht beide nebeneinander, dass du eine Größe hast. Also …
 *   dass du ändern kannst: vergeben / nicht vergeben."
 *
 * Also: eine Liste, volle Panelbreite, und ein Umschalter darüber. Die Zahlen
 * stehen im Umschalter selbst — man sieht auch dann, wie viel offen ist, wenn
 * gerade die andere Seite zu sehen ist. Damit bleibt der Blick, den die zwei
 * Spalten geben sollten, erhalten, ohne den Platz zu kosten.
 *
 * Voreinstellung
 * ──────────────
 * „Unvergebene" — das ist die Liste, mit der man arbeitet (auf den Kalender
 * ziehen). Ist nichts mehr offen, wäre sie eine leere Seite mit einem Haken;
 * dann öffnet der Umschalter gleich auf „Termine". Eine getroffene Wahl
 * überlebt das Neuzeichnen (Blättern zwischen Verordnungen, Drag & Drop),
 * solange die gewählte Seite noch etwas zeigt.
 *
 * Was hier NICHT passiert
 * ───────────────────────
 * Kein Laden, kein Schreiben, kein Zeichnen der Zeilen. Diese Datei schaltet
 * nur um. Die Zeilen baut weiterhin `loadRxSessionsPanel` in dashboard.js.
 */

const TABS = [
  { ziel: 'unvergeben', box: 'bkRxUnvergebeneBox', label: 'Unvergebene' },
  { ziel: 'vergeben',   box: 'bkRxVergebeneBox',   label: 'Termine' },
];

/** Zuletzt gewählte Seite — überlebt das Neuzeichnen, nicht den Seitenwechsel. */
let gewaehlt = 'unvergeben';

/**
 * Der zuletzt GEZEICHNETE Stand (19.09.2026, Bug-Fix). `verdrahteSitzungsUmschalter()`
 * bindet den Klick-Listener bewusst nur EINMAL je Sitzung (siehe dort). Vorher
 * bekam er dafür eine `standLesen`-Closure als Argument und rief die beim Klick
 * auf — aber jeder Patient/Termin baut beim Neuzeichnen eine NEUE Closure mit
 * seinen eigenen Zahlen, und ein einmal gebundener Listener sieht nur die vom
 * ALLERERSTEN Aufruf der Sitzung. Jeder Klick zeigte darum für den Rest der
 * Sitzung die Zahlen des ersten je geöffneten Patienten — bei zwei Aufrufern
 * (Physio/Ergo/Logo hier, Podologie in `podo-einheiten.js`, gleiches Panel)
 * je nachdem sogar die Zahlen der falschen Fachrichtung.
 * Fix: `zeigeSitzungsSeiten()` merkt sich den Stand, mit dem es zuletzt
 * gezeichnet hat; der Listener liest diese Variable statt einer Closure.
 */
let letzterStand = { offen: 0, vergeben: 0 };

/**
 * Die Regel allein — ohne DOM, damit sie prüfbar bleibt.
 *
 * @param {{wunsch:string, offen:number, vergeben:number}} stand
 * @returns {'unvergeben'|'vergeben'}
 */
export function waehleSeite({ wunsch, offen, vergeben }) {
  const leer = { unvergeben: (offen || 0) === 0, vergeben: (vergeben || 0) === 0 };
  const ziel = (wunsch === 'vergeben' || wunsch === 'unvergeben') ? wunsch : 'unvergeben';
  // Die gewünschte Seite gewinnt, solange sie etwas zeigt. Sonst die andere —
  // aber nur, wenn die überhaupt etwas hat: sind beide leer, bleibt es bei der
  // Voreinstellung, statt den Nutzer wortlos woandershin zu schieben.
  if (!leer[ziel]) return ziel;
  const andere = ziel === 'unvergeben' ? 'vergeben' : 'unvergeben';
  return leer[andere] ? ziel : andere;
}

/**
 * Zeichnet den Umschalter und zeigt die passende Seite.
 *
 * @param {{offen:number, vergeben:number}} stand  Anzahl der Einträge je Seite
 */
export function zeigeSitzungsSeiten({ offen = 0, vergeben = 0 } = {}) {
  letzterStand = { offen, vergeben };
  const leiste = document.getElementById('bkRxSitzungTabs');
  if (!leiste) return;

  gewaehlt = waehleSeite({ wunsch: gewaehlt, offen, vergeben });
  const anzahl = { unvergeben: offen, vergeben };

  TABS.forEach(({ ziel, box, label }) => {
    const knopf = leiste.querySelector(`[data-ziel="${ziel}"]`);
    const flaeche = document.getElementById(box);
    const aktiv = ziel === gewaehlt;
    if (knopf) {
      knopf.textContent = `${label} (${anzahl[ziel]})`;
      knopf.setAttribute('aria-selected', String(aktiv));
      knopf.classList.toggle('is-active', aktiv);
    }
    if (flaeche) flaeche.hidden = !aktiv;
  });
}

/**
 * Verdrahtet die beiden Knöpfe. Einmal je Sitzung — `zeigeSitzungsSeiten`
 * übernimmt danach jedes Neuzeichnen. Braucht kein Argument mehr (19.09.2026):
 * der Klick-Handler liest `letzterStand`, den `zeigeSitzungsSeiten()` bei
 * jedem Aufruf hinterlässt — nicht mehr eine Closure vom Zeitpunkt des
 * Verdrahtens.
 */
export function verdrahteSitzungsUmschalter() {
  const leiste = document.getElementById('bkRxSitzungTabs');
  if (!leiste || leiste.dataset.umschalterWired === '1') return;
  leiste.dataset.umschalterWired = '1';

  leiste.addEventListener('click', (e) => {
    const knopf = e.target.closest('[data-ziel]');
    if (!knopf) return;
    gewaehlt = knopf.dataset.ziel;
    zeigeSitzungsSeiten(letzterStand);
  });
}

/** Nur für Tests: Auswahl zurücksetzen. */
export function _setzeSeiteZurueck() { gewaehlt = 'unvergeben'; }
