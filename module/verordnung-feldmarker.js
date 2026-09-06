/**
 * verordnung-feldmarker.js — den Prüfbefund an das Feld schreiben, das er meint.
 *
 * Befund (Kemal, 06.09.2026)
 * ──────────────────────────
 *   „Nerelerde hata olduğunu göstersek, sadece hata var deyip bırakması bir işe
 *    yaramıyor. Hatalı olan yerlerin yanına ünlem koysun ve gerçekten hatalı
 *    olduğunu söylesin. … Neden hata olduğunu söylesin."
 *
 * Der Prüfmotor (module/verordnung-pruefung.js) weiss seit jeher, WELCHES Feld
 * ein Befund meint — jeder Befund trägt `feld` und `quelle` mit sich. Genutzt
 * wurde das nirgends: die Liste zeigte ein Ausrufezeichen, die Ergebnisliste
 * einen Absatz Text. Wer beides sah, wusste immer noch nicht, in welche Zeile
 * des Formulars er schauen soll.
 *
 * Dieses Modul schliesst genau diese Lücke — und nur sie. Es prüft nichts,
 * entscheidet nichts und kennt keine Regel; es bekommt fertige Befunde und
 * setzt sie an die Maske.
 *
 * Warum eine Tabelle und keine Namenskonvention
 * ─────────────────────────────────────────────
 * Die Feldnamen des Motors („kasseIk") und die IDs der Maske („rzPatKasseIk")
 * sind bewusst verschieden: der Motor beschreibt die VERORDNUNG, die Maske
 * beschreibt das PAPIER. Zwei Felder des Motors zeigen deshalb auf dasselbe
 * Kästchen (die Positionsnummer ist auf dem Muster 13 nicht sichtbar, sie
 * hängt am Heilmittel), und eines auf gar keines — den Behandlungsbeginn kennt
 * Muster 13 nicht, sein Befund landet beim Ausstellungsdatum, aus dem die
 * Frist gerechnet wird.
 */

/**
 * Motor-Feldname → Maske. `markiere` überschreibt, WAS eingerahmt wird (bei
 * den Leitsymptomatik-Kästchen ist das nicht das erste Kästchen, sondern die
 * ganze Reihe).
 */
const ZIEL = Object.freeze({
  versichertennummer: { id: 'rzPatVersNr' },
  kasseIk:            { id: 'rzPatKasseIk' },
  ausstellungsdatum:  { id: 'rzAusstDate' },
  // Muster 13 hat kein Feld „Behandlungsbeginn" — die Frist hängt am
  // Ausstellungsdatum, also steht der Befund dort.
  behandlungsbeginn:  { id: 'rzAusstDate' },
  arztLanr:           { id: 'rzLanr' },
  arztBsnr:           { id: 'rzBsnr' },
  icd:                { id: 'rzIcd' },
  diagnosegruppe:     { id: 'rzDg' },
  leitsymptomatik:    { id: 'rzLsA', markiere: '.m13-lsboxes' },
  heilmittel:         { id: 'rzHm' },
  // Die Positionsnummer ist ein verstecktes Feld (`rzHmPosition`); sichtbar
  // ist nur das Heilmittel, aus dessen Auswahl sie gesetzt wird.
  heilmittelPosition: { id: 'rzHm' },
  anzahl:             { id: 'rzAnzahl' },
  frequenz:           { id: 'rzFreq' },
});

/**
 * Blöcke, hinter die ein Hinweis geschrieben werden darf.
 *
 * Nicht IN das Kästchen: die Zeilen des Bogens sind Gitter und Flexreihen
 * (`.m13-diagrow`, `.m13-hmtable`), ein zusätzliches Kind darin verschöbe die
 * Spalten. Der nächstgelegene dieser Blöcke ist immer eine Stelle, an der eine
 * volle Zeile Platz hat.
 */
const ANKER = '.m13-cell, .m13-diagrow, .m13-dgrow, .m13-hmtable, .m13-freq, .m13-opts';

const KLASSE = Object.freeze({ blocker: 'vo-mark-fehler', warnung: 'vo-mark-warnung' });
const VORSATZ = Object.freeze({ blocker: 'So nicht', warnung: 'Bitte prüfen', hinweis: 'Hinweis' });
const RANG = Object.freeze({ blocker: 0, warnung: 1, hinweis: 2 });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Alle Markierungen und Hinweise aus einem Bereich entfernen.
 *
 * Wird vor jedem Setzen aufgerufen und immer dann, wenn das Urteil veraltet
 * ist. Eine stehengebliebene Markierung an einem inzwischen korrigierten Feld
 * wäre schlimmer als gar keine.
 *
 * @param {HTMLElement|Document} [wurzel=document]
 */
export function loescheMarkierungen(wurzel = document) {
  wurzel.querySelectorAll('.vo-mark-fehler, .vo-mark-warnung').forEach(el => {
    el.classList.remove('vo-mark-fehler', 'vo-mark-warnung');
    if (el.dataset.voTitelAlt !== undefined) {
      if (el.dataset.voTitelAlt) el.title = el.dataset.voTitelAlt;
      else el.removeAttribute('title');
      delete el.dataset.voTitelAlt;
    }
  });
  wurzel.querySelectorAll('[data-vo-hinweis]').forEach(el => el.remove());
}

/**
 * Befunde an die Maske setzen.
 *
 * @param {Array<{schwere:string,text:string,feld:?string,quelle:?string}>} befunde
 * @param {HTMLElement|Document} [wurzel=document]  Suchbereich für die Felder.
 * @returns {{gesetzt:number, ohneFeld:Array}}  `ohneFeld` sind die Befunde, die
 *   sich keinem Kästchen zuordnen liessen — sie stehen weiter in der
 *   Ergebnisliste und dürfen dort nicht verschwinden.
 */
export function markiereBefunde(befunde, wurzel = document) {
  loescheMarkierungen(wurzel);
  const ohneFeld = [];
  if (!Array.isArray(befunde) || !befunde.length) return { gesetzt: 0, ohneFeld };

  // Mehrere Befunde können auf denselben Block zeigen (Heilmittel und
  // Positionsnummer etwa). Sie werden zu EINEM Hinweiskasten gebündelt —
  // drei Kästen untereinander an derselben Zeile liest niemand.
  const proAnker = new Map();
  let gesetzt = 0;

  for (const b of befunde) {
    if (b?.schwere === 'hinweis') { ohneFeld.push(b); continue; }
    const ziel = ZIEL[b?.feld];
    const feldEl = ziel ? wurzel.querySelector?.(`#${ziel.id}`) || document.getElementById(ziel.id) : null;
    if (!feldEl) { ohneFeld.push(b); continue; }

    const markEl = ziel.markiere ? (feldEl.closest(ziel.markiere) || feldEl) : feldEl;
    setzeKlasse(markEl, b.schwere);
    setzeTitel(markEl, b);

    const anker = feldEl.closest(ANKER) || feldEl.parentElement;
    if (!anker) { ohneFeld.push(b); continue; }
    if (!proAnker.has(anker)) proAnker.set(anker, []);
    proAnker.get(anker).push(b);
    gesetzt++;
  }

  for (const [anker, liste] of proAnker) {
    liste.sort((a, b) => RANG[a.schwere] - RANG[b.schwere]);
    anker.insertAdjacentElement('afterend', hinweisKasten(liste));
  }

  return { gesetzt, ohneFeld };
}

/** Die schwerere Markierung gewinnt — ein Blocker bleibt ein Blocker. */
function setzeKlasse(el, schwere) {
  const klasse = KLASSE[schwere];
  if (!klasse) return;
  if (klasse === 'vo-mark-fehler') el.classList.remove('vo-mark-warnung');
  else if (el.classList.contains('vo-mark-fehler')) return;
  el.classList.add(klasse);
}

/**
 * Der Grund auch als Tooltip am Feld selbst — für den, der mit der Maus
 * darüberfährt, statt nach unten zu lesen. Der vorherige `title` wird
 * gemerkt, damit `loescheMarkierungen()` ihn zurückgeben kann.
 */
function setzeTitel(el, befund) {
  if (el.dataset.voTitelAlt === undefined) el.dataset.voTitelAlt = el.getAttribute('title') || '';
  const alt = el.title && !el.title.startsWith('⚠') ? '' : el.title;
  const neu = `⚠ ${VORSATZ[befund.schwere]}: ${befund.text}`;
  el.title = alt ? `${alt}\n${neu}` : neu;
}

function hinweisKasten(liste) {
  const kasten = document.createElement('div');
  kasten.setAttribute('data-vo-hinweis', '1');
  kasten.className = liste.some(b => b.schwere === 'blocker') ? 'vo-hinweis vo-hinweis-fehler' : 'vo-hinweis';
  kasten.innerHTML = liste.map(b => {
    const quelle = b.quelle
      ? `<span class="vo-hinweis-quelle">${esc(b.quelle)}</span>` : '';
    return `<div class="vo-hinweis-zeile${b.schwere === 'blocker' ? ' ist-fehler' : ''}">`
      + `<span class="vo-hinweis-zeichen">⚠</span>`
      + `<span><b>${VORSATZ[b.schwere]}:</b> ${esc(b.text)}${quelle}</span></div>`;
  }).join('');
  return kasten;
}
