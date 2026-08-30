/**
 * leistung-farbwahl.js — Farbe einer Leistung wählen.
 *
 * Warum es das gibt
 * ─────────────────
 * `services.color` gibt es seit jeher in der Datenbank, mit dem Vorgabewert
 * `#22c55e`. Gepflegt werden konnte die Spalte aber nie: das Feld `srvColor`
 * in der Leistungsmaske war ein `type="hidden"` mit festem Wert, und der
 * Speichern-Pfad schrieb `color` nicht einmal mit. Die Spalte stand also da
 * und war für jede Leistung grün.
 *
 * Das fiel erst auf, als der Kalender ab dem 22.08.2026 nach Leistung färben
 * sollte (Beta-Rückmeldung „Leistungen müssen farblich unterscheidbar sein").
 * Ohne diese Maske wäre die neue Färbung wirkungslos gewesen — alles grün,
 * genau wie vorher.
 *
 * Warum Farbfelder und nicht nur ein Farbwähler
 * ─────────────────────────────────────────────
 * Ein reiner `<input type="color">` verführt zu zwanzig Grüntönen, die im
 * 28 Pixel hohen Wochenblock niemand auseinanderhält. Die Vorauswahl bietet
 * acht Farben an, die sich sicher unterscheiden; der Farbwähler daneben bleibt
 * für Sonderfälle.
 */

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/**
 * Hängt die Farbfelder in einen Behälter und hält sie mit dem Eingabefeld
 * gleich — in beide Richtungen.
 *
 * @param {object} o
 * @param {Element} o.behaelter  Wohin die Felder kommen
 * @param {HTMLInputElement} o.eingabe  Das `type="color"`-Feld
 * @param {string[]} o.farben
 * @returns {{setze: (farbe: string) => void}} `setze` für „Leistung bearbeiten"
 */
export function mountFarbwahl({ behaelter, eingabe, farben = [] }) {
  if (!behaelter || !eingabe) return { setze: () => {} };

  behaelter.innerHTML = farben.map(f =>
    `<button type="button" class="srv-farbfeld" data-farbe="${escapeHtml(f)}"`
    + ` style="background:${escapeHtml(f)}" aria-label="Farbe ${escapeHtml(f)}"></button>`
  ).join('');

  const markiere = (farbe) => {
    const wert = String(farbe || '').toLowerCase();
    behaelter.querySelectorAll('.srv-farbfeld').forEach(el => {
      const treffer = el.dataset.farbe.toLowerCase() === wert;
      el.classList.toggle('srv-farbfeld--aktiv', treffer);
      el.setAttribute('aria-pressed', treffer ? 'true' : 'false');
    });
  };

  behaelter.addEventListener('click', (ev) => {
    const feld = ev.target.closest('.srv-farbfeld');
    if (!feld) return;
    eingabe.value = feld.dataset.farbe;
    markiere(eingabe.value);
  });

  // Auch die andere Richtung: wer den Farbwähler benutzt, soll sehen, dass
  // keines der Vorschlagsfelder mehr gilt.
  eingabe.addEventListener('input', () => markiere(eingabe.value));

  markiere(eingabe.value);

  return {
    setze: (farbe) => {
      eingabe.value = farbe || farben[0] || '#22c55e';
      markiere(eingabe.value);
    },
  };
}

/**
 * Dieselbe Farbwahl gibt es zweimal auf der Leistungsseite: einmal für eigene
 * Leistungen, einmal für GKV-Leistungen. Beide dürfen nur einmal aufgebaut
 * werden — sonst hängen nach dem zweiten Öffnen zwei Zuhörer an denselben
 * Feldern und jeder Klick zählt doppelt.
 *
 * Der Zwischenspeicher liegt deshalb hier und nicht als zwei fast gleiche
 * Hilfsfunktionen im Dashboard.
 */
const _gebaut = new Map();

export function farbwahlFuer(schluessel, optionen) {
  if (!_gebaut.has(schluessel)) _gebaut.set(schluessel, mountFarbwahl(optionen));
  return _gebaut.get(schluessel);
}
