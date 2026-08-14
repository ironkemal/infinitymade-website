/**
 * kvnr.js — Prüfung der Krankenversichertennummer (KVNR).
 *
 * Warum es das gibt
 * ─────────────────
 * Eine falsch abgetippte Versichertennummer merkt niemand beim Anlegen des
 * Patienten. Sie fällt Wochen später auf, wenn die Kasse den ganzen Beleg
 * absetzt — und dann kostet die Korrektur ein Vielfaches. Der Tippfehler ist
 * aber schon beim Eintippen erkennbar: die letzte Stelle der KVNR ist eine
 * Prüfziffer über die vorangehenden.
 *
 * Aufbau (unveränderbare KVNR nach § 290 SGB V):
 *
 *     A 1 2 3 4 5 6 7 8 9
 *     │ └──── 8 Ziffern ──┘ └ Prüfziffer
 *     └ Großbuchstabe A–Z
 *
 *     Feldlänge in der §302-Datei: 10 AN
 *     (Anlage 1 TP5 V21, Segment NAD/Versichertennummer — siehe
 *      Handbücher/Anhang_05_Anlage_1_TP5_20260401.txt, Zeile 435)
 *
 * Prüfziffer: der Buchstabe wird durch seine zweistellige Position im Alphabet
 * ersetzt (A→01 … Z→26), das ergibt mit den acht Ziffern zehn Stellen. Diese
 * werden abwechselnd mit 1 und 2 multipliziert (beginnend mit 1); Produkte über
 * 9 werden quersummiert (also −9). Die Summe modulo 10 ist die Prüfziffer.
 *
 * Warum das Ergebnis NICHT blockiert
 * ──────────────────────────────────
 * Diese Datei liefert einen Hinweis, keine Sperre. Wäre die Prüfung ein Tor,
 * würde jeder Fehler in dieser Datei — oder jeder Sonderfall, den wir nicht
 * kennen — einen echten Patienten an der Anlage hindern. Das Haus hat dafür
 * eine Regel: in der Maske wird gewarnt, hart gesperrt wird erst unmittelbar
 * vor der Einreichung bei der Kasse (siehe abrechnung.routes.js).
 */

'use strict';

const MUSTER = /^[A-Z]\d{9}$/;

/**
 * @param {string} eingabe
 * @returns {{ok: boolean, code: 'leer'|'format'|'pruefziffer'|null, hinweis: string, normalisiert: string}}
 */
export function pruefeKvnr(eingabe) {
  const roh = String(eingabe ?? '').replace(/\s+/g, '').toUpperCase();

  if (!roh) {
    return { ok: true, code: null, hinweis: '', normalisiert: '' };
  }

  if (!MUSTER.test(roh)) {
    return {
      ok: false,
      code: 'format',
      hinweis: 'Die Versichertennummer besteht aus einem Buchstaben und neun Ziffern (z. B. A123456789).',
      normalisiert: roh,
    };
  }

  const erwartet = pruefziffer(roh);
  if (erwartet !== Number(roh[9])) {
    return {
      ok: false,
      code: 'pruefziffer',
      hinweis: 'Die Nummer ergibt rechnerisch keine gültige Versichertennummer — bitte mit der eGK vergleichen.',
      normalisiert: roh,
    };
  }

  return { ok: true, code: null, hinweis: '', normalisiert: roh };
}

/**
 * Prüfziffer der ersten neun Stellen (Buchstabe + 8 Ziffern).
 * @param {string} kvnr mindestens 9 Zeichen, bereits in Großbuchstaben
 * @returns {number} 0–9
 */
export function pruefziffer(kvnr) {
  const pos = kvnr.charCodeAt(0) - 64;                  // A=1 … Z=26
  const stellen = String(pos).padStart(2, '0') + kvnr.slice(1, 9);

  let summe = 0;
  for (let i = 0; i < stellen.length; i++) {
    let wert = Number(stellen[i]) * (i % 2 === 0 ? 1 : 2);
    if (wert > 9) wert -= 9;                            // Quersumme zweistelliger Produkte
    summe += wert;
  }
  return summe % 10;
}

/**
 * Hängt die Prüfung an ein Eingabefeld. Zeigt den Hinweis unter dem Feld an
 * und färbt den Rahmen — blockiert nichts.
 *
 * @param {HTMLInputElement} inputEl
 * @param {{hinweisEl?: HTMLElement}} [opts]
 */
export function attachKvnrPruefung(inputEl, opts = {}) {
  if (!inputEl || inputEl.dataset.kvnrWired === '1') return;
  inputEl.dataset.kvnrWired = '1';

  let hinweisEl = opts.hinweisEl;
  if (!hinweisEl) {
    hinweisEl = document.createElement('p');
    hinweisEl.className = 'form-hint';
    hinweisEl.style.cssText = 'margin:4px 0 0;font-size:12px;color:#c2410c;';
    hinweisEl.hidden = true;
    inputEl.insertAdjacentElement('afterend', hinweisEl);
  }

  const pruefen = () => {
    const r = pruefeKvnr(inputEl.value);
    hinweisEl.textContent = r.hinweis;
    hinweisEl.hidden = r.ok;
    inputEl.style.borderColor = r.ok ? '' : '#c2410c';
  };

  // Erst beim Verlassen des Feldes: eine Warnung nach dem zweiten Zeichen
  // wäre nur Lärm, weil jede unfertige Eingabe ungültig ist.
  inputEl.addEventListener('blur', pruefen);
  inputEl.addEventListener('input', () => {
    if (!hinweisEl.hidden) pruefen();   // sichtbaren Fehler sofort auflösen
  });
}
