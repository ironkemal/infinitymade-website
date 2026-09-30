/**
 * anamnese-rozet.js — die Warn-Rozets der Podologie-Anamnese als HTML (rein, ohne DOM).
 *
 * Wo sie stehen dürfen (legal-de 30.09.2026, Art. 9 DSGVO / § 203 StGB): NUR in
 * Patientenakte-Kopf und Tagesbehandlung — beides Bildschirme, die die Podologin vor sich hat.
 * NICHT in Kalender/Terminliste, E-Mail, PDF/Export, Abrechnung. Wer hier einen weiteren
 * Aufrufer einbaut, ändert diese Entscheidung — vorher `legal-de` fragen.
 *
 * Quelle der Rozets ist ausschließlich die gültige Podo-Anamnese (`felder`), nie
 * `pat_fussbefund.befund.risiken`. Eine Infektion erscheint nur als neutrales „Hygiene".
 */

import { rozetsAusFelder, begrenzeRozets, ROZET_MAX } from './anamnese-formulare.js?v=20261001r';

/**
 * @param {?object} row   gültige Podo-Anamnese (`felder`, `geprueft_am`) oder null
 * @param {(s:string)=>string} esc
 * @param {{max?:number}} [opt]
 * @returns {string} leer, wenn es nichts zu warnen gibt
 */
export function rozetHtml(row, esc, opt = {}) {
  if (!row) return '';
  const liste = rozetsAusFelder(row.felder || {});
  if (!liste.length) return '';
  const { sichtbar, mehr } = begrenzeRozets(liste, opt.max || ROZET_MAX);
  const alle = liste.map((r) => r.label).join(' · ');
  const chips = sichtbar.map((r) =>
    `<span class="anam-rozet anam-rozet--${r.stufe}" title="${esc(r.label)}">${esc(r.label)}</span>`).join('');
  const rest = mehr ? `<span class="anam-rozet anam-rozet--mehr" title="${esc(alle)}">+${mehr}</span>` : '';
  // Ein Tipp auf „ungeprüft" bestätigt (UPDATE nur geprueft_am/geprueft_von) — delegierter
  // Klick in module/anamnese.js (`[data-anamnese-pruefen]`), kein Inline-Handler.
  const titel = 'Vom Patienten angegeben, von der Praxis noch nicht bestätigt — Tippen bestätigt';
  const ungeprueft = row.geprueft_am
    ? ''
    : (opt.pruefbar !== false && row.id
      ? `<button type="button" class="anam-rozet-ungeprueft" data-anamnese-pruefen="${esc(String(row.id))}" title="${esc(titel)}">ungeprüft</button>`
      : `<span class="anam-rozet-ungeprueft" title="${esc(titel)}">ungeprüft</span>`);
  return `<span class="anam-rozets" data-anamnese-id="${esc(String(row.id || ''))}">${chips}${rest}${ungeprueft}</span>`;
}
