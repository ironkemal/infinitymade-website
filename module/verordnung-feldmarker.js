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
 * 10.09.2026 (Kemal): der Hinweiskasten stand fest im Formularfluss — er
 * schob bei jedem Treffer die Zeilen darunter nach unten. Jetzt sitzt an der
 * Stelle nur ein kleines Ausrufezeichen (`.vo-mark-icon`); der Text kommt
 * per Klick als `position:fixed`-Layer (`.vo-popover`) obendrauf, verschiebt
 * nichts und schliesst über das × oder erneutes Klicken auf dasselbe Icon.
 * Die Seite, auf der das Popover aufgeht, richtet sich nach dem Platz um den
 * ANKER (die ganze Zelle/Zeile, nicht nur das Icon an ihrer Ecke): die Seite
 * mit mehr Raum gewinnt, oben nur, wenn unten nicht reicht — damit es nie
 * über dem Feld liegt, das man gerade korrigiert (siehe `positioniertPopover`).
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

// Offene Popover leben in document.body, ausserhalb jeder `wurzel` — ihre
// eigene Buchhaltung, damit `loescheMarkierungen()` sie unabhängig vom
// übergebenen Bereich immer mitschliesst (ein stehengebliebenes Popover über
// einem inzwischen neu geprüften Feld wäre eine falsche Auskunft).
const offenePopovers = new Map(); // icon → { schliessen }

function schliesseAllePopovers() {
  for (const { schliessen } of offenePopovers.values()) schliessen();
  offenePopovers.clear();
}

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
  schliesseAllePopovers();
  wurzel.querySelectorAll('.vo-mark-fehler, .vo-mark-warnung').forEach(el => {
    el.classList.remove('vo-mark-fehler', 'vo-mark-warnung');
    if (el.dataset.voTitelAlt !== undefined) {
      if (el.dataset.voTitelAlt) el.title = el.dataset.voTitelAlt;
      else el.removeAttribute('title');
      delete el.dataset.voTitelAlt;
    }
  });
  // Icons setzen ihren Anker (die Zeile/Zelle) auf `position:relative`, damit
  // sie an dessen Ecke haften, ohne den Fluss zu verschieben — hier wird das
  // zurückgenommen, sonst bliebe eine unsichtbare, aber dauerhafte Änderung.
  wurzel.querySelectorAll('[data-vo-positioniert]').forEach(el => {
    el.style.position = el.dataset.voPositionAlt || '';
    delete el.dataset.voPositionAlt;
    delete el.dataset.voPositioniert;
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
    erzeugeIcon(anker, liste);
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

/**
 * Ein Ausrufezeichen an die Ecke des Ankers setzen. Der Anker braucht dafür
 * einen Positionierungskontext — hat er keinen eigenen (die meisten Zeilen
 * des Bogens sind Grid-/Flexblöcke ohne `position`), wird er auf `relative`
 * gesetzt und das in `data-vo-positioniert` vermerkt, damit
 * `loescheMarkierungen()` es zurücknehmen kann.
 */
function erzeugeIcon(anker, liste) {
  const schwer = liste.some(b => b.schwere === 'blocker') ? 'blocker' : 'warnung';
  // CSS kennt `.vo-mark-icon-fehler`/`-warnung` (dieselbe Namensgebung wie
  // `KLASSE` oben) — nicht `-blocker`, das Feld-Schweregrad-Wort.
  const icon = document.createElement('button');
  icon.type = 'button';
  icon.className = `vo-mark-icon vo-mark-icon-${schwer === 'blocker' ? 'fehler' : 'warnung'}`;
  icon.setAttribute('data-vo-hinweis', '1');
  icon.setAttribute('aria-label',
    `${VORSATZ[schwer]} — ${liste.length} Punkt${liste.length > 1 ? 'e' : ''} zu diesem Feld`);
  icon.textContent = '!';
  icon.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    togglePopover(icon, anker, liste);
  });

  if (getComputedStyle(anker).position === 'static') {
    anker.dataset.voPositionAlt = anker.style.position || '';
    anker.dataset.voPositioniert = '1';
    anker.style.position = 'relative';
  }
  anker.appendChild(icon);
}

/** Popover für ein Icon auf-/zuklappen. Ein zweiter Klick auf dasselbe Icon schliesst es wieder. */
function togglePopover(icon, anker, liste) {
  const bestehend = offenePopovers.get(icon);
  if (bestehend) { bestehend.schliessen(); return; }

  const pop = document.createElement('div');
  pop.className = liste.some(b => b.schwere === 'blocker') ? 'vo-popover vo-popover-fehler' : 'vo-popover';
  pop.innerHTML = `<button type="button" class="vo-popover-schliessen" aria-label="Schliessen">×</button>`
    + liste.map(b => {
      const quelle = b.quelle ? `<span class="vo-hinweis-quelle">${esc(b.quelle)}</span>` : '';
      return `<div class="vo-popover-zeile${b.schwere === 'blocker' ? ' ist-fehler' : ''}">`
        + `<b>${VORSATZ[b.schwere]}:</b> ${esc(b.text)}${quelle}</div>`;
    }).join('');

  document.body.appendChild(pop);
  const neuPositionieren = () => positioniertPopover(pop, anker);
  neuPositionieren();

  const schliessen = () => {
    pop.remove();
    window.removeEventListener('scroll', neuPositionieren, true);
    window.removeEventListener('resize', neuPositionieren);
    icon.classList.remove('ist-offen');
    offenePopovers.delete(icon);
  };
  pop.querySelector('.vo-popover-schliessen').addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    schliessen();
  });
  // Scrollt der Bogen (Modal-Body) weiter, muss das fixe Popover mitziehen —
  // sonst hängt es irgendwann neben einem ganz anderen Feld.
  window.addEventListener('scroll', neuPositionieren, true);
  window.addEventListener('resize', neuPositionieren);

  icon.classList.add('ist-offen');
  offenePopovers.set(icon, { schliessen });
}

/**
 * Seite wählen, auf der das Popover aufgeht: immer ausserhalb des ANKERS
 * (der ganzen Zelle/Zeile, nicht nur des kleinen Icons an ihrer Ecke) —
 * sonst verdeckt es genau das Feld, das gerade korrigiert werden soll, und
 * das Weiterarbeiten bei offenem Popover (der ganze Sinn der Sache) wäre hin.
 *
 * 10.09.2026-Nachschlag (Kemal): mit dem Icon selbst statt des Ankers als
 * Bezugspunkt lag die Grenze GENAU an der Feldkante — ein schmales Feld
 * (z.B. das Datum in seiner Dreier-Zeile) hatte das Popover dann direkt
 * über sich. Massgeblich ist jetzt der ganze Anker, und die Seite fällt auf
 * die, mit mehr Platz — nicht stur auf die linke/rechte Bildschirmhälfte.
 */
function positioniertPopover(pop, anker) {
  const ar = anker.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const rand = 8;
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;

  const platzLinks = ar.left;
  const platzRechts = vw - ar.right;
  const oeffnetRechts = platzRechts >= platzLinks;
  let left = oeffnetRechts ? ar.right + rand : ar.left - rand - pw;
  left = Math.max(rand, Math.min(left, vw - pw - rand));

  const platzOben = ar.top;
  const platzUnten = vh - ar.bottom;
  const oeffnetOben = platzUnten < ph + rand && platzOben > platzUnten;
  let top = oeffnetOben ? ar.top - ph - rand : ar.bottom + rand;
  top = Math.max(rand, Math.min(top, vh - ph - rand));

  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}
