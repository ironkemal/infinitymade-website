/**
 * plz.js — Ort aus der Postleitzahl.
 *
 * Warum es das gibt
 * ─────────────────
 * Im Beta-Gespräch (12.08.2026) fragte Nausad, ob der Ort nicht automatisch
 * kommen kann, wenn er die Postleitzahl tippt — sowohl in der Patienten- als
 * auch in der Arztmaske. Bei jedem Neupatienten sind das zwei Felder statt
 * eines, und der Ort ist die Angabe, die am häufigsten falsch geschrieben in
 * der Akte landet.
 *
 * Warum kein Adressdienst
 * ───────────────────────
 * Im Gespräch fiel „Adresse von Google". Das geht hier aus zwei Gründen nicht:
 *
 *   1. G8 (CLAUDE.md): keine neuen Cloud-Abhängigkeiten. Die On-Premise-
 *      Version muss ohne Internet vollständig funktionieren.
 *   2. Jede Abfrage wäre eine Übermittlung einer Patientenadresse an einen
 *      Dritten — ohne Auftragsverarbeitungsvertrag und ohne Rechtsgrundlage.
 *
 * Die deutschen Postleitzahlen sind ein feststehender Datenbestand. Eine
 * Datei genügt, und sie funktioniert im Flugzeugmodus genauso.
 *
 * Daten: `module/plz-orte.json`, erzeugt von `tools/plz-orte.mjs`
 *        (Quelle GeoNames via zauberware, CC BY 4.0 — Attribution steht in
 *        der Datei selbst). NICHT von Hand bearbeiten.
 *
 * Geladen wird erst beim ersten Nachschlagen: die Datei ist ~285 KB und die
 * meisten Sitzungen legen keinen neuen Patienten an.
 */

'use strict';

let daten = null;
let ladend = null;

/** @returns {Promise<Record<string, string|string[]>>} */
async function laden() {
  if (daten) return daten;
  if (ladend) return ladend;
  ladend = fetch(new URL('./plz-orte.json', import.meta.url))
    .then(r => r.json())
    .then(j => { daten = j.orte || {}; return daten; })
    .catch(e => {
      // Kein Ort ist besser als ein falscher: schlaegt das Laden fehl, bleibt
      // das Feld einfach leer und der Anwender tippt wie bisher.
      console.warn('[plz] Tabelle nicht ladbar:', e);
      daten = {};
      return daten;
    });
  return ladend;
}

/**
 * @param {string} plz
 * @returns {Promise<string[]>} 0 = unbekannt · 1 = eindeutig · >1 = mehrere Orte
 */
export async function orteZu(plz) {
  const key = String(plz || '').trim();
  if (!/^\d{5}$/.test(key)) return [];
  const tabelle = await laden();
  const treffer = tabelle[key];
  if (!treffer) return [];
  return Array.isArray(treffer) ? treffer : [treffer];
}

/**
 * Hängt die Ergänzung an ein PLZ-Feld.
 *
 * Verhalten mit Absicht zurückhaltend:
 *   • Ist der Ort eindeutig und das Ortsfeld leer → wird gesetzt.
 *   • Ist das Ortsfeld schon gefüllt → wird NICHT überschrieben. Ein
 *     Postleitzahlgebiet kann mehrere Gemeinden umfassen, und der Patient
 *     weiss besser als die Tabelle, wo er wohnt.
 *   • Gibt es mehrere Orte → erscheint eine Auswahlliste unter dem Feld,
 *     nichts wird automatisch gesetzt.
 *
 * @param {HTMLInputElement} plzEl
 * @param {HTMLInputElement} ortEl
 */
export function attachPlzOrt(plzEl, ortEl) {
  if (!plzEl || !ortEl || plzEl.dataset.plzWired === '1') return;
  plzEl.dataset.plzWired = '1';

  let box = null;
  const boxZu = () => { if (box) { box.remove(); box = null; } };

  const zeigeAuswahl = (orte) => {
    boxZu();
    box = document.createElement('div');
    box.style.cssText = 'margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;';
    box.innerHTML = orte.map(o =>
      `<button type="button" class="btn-ghost btn-sm" data-ort="${o.replace(/"/g, '&quot;')}"
         style="font-size:12px;padding:3px 9px;">${o.replace(/</g, '&lt;')}</button>`
    ).join('');
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-ort]');
      if (!b) return;
      ortEl.value = b.dataset.ort;
      ortEl.dispatchEvent(new Event('input', { bubbles: true }));
      boxZu();
    });
    plzEl.insertAdjacentElement('afterend', box);
  };

  const pruefen = async () => {
    boxZu();
    const orte = await orteZu(plzEl.value);
    if (!orte.length) return;
    if (orte.length === 1) {
      if (!ortEl.value.trim()) {
        ortEl.value = orte[0];
        ortEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    zeigeAuswahl(orte);
  };

  // Auf `input`, sobald fünf Stellen stehen — nicht erst beim Verlassen des
  // Feldes: der Anwender springt nach der PLZ direkt in das Ortsfeld und
  // faende es sonst leer vor und tippte los.
  plzEl.addEventListener('input', () => {
    if (/^\d{5}$/.test(plzEl.value.trim())) pruefen();
    else boxZu();
  });
  plzEl.addEventListener('blur', () => setTimeout(boxZu, 200));   // Klick auf Vorschlag zulassen
}
