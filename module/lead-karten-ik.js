/**
 * lead-karten-ik.js — Karten-IK am Patienten (Reform S3.8b, gkv-302 30.09.2026).
 *
 * `leads.krankenkasse_ik` = IK der Krankenkasse von der Versichertenkarte, 9 Ziffern
 * (DB-CHECK), gleiche Bedeutung wie `prescriptions.krankenkasse_ik`. Die Kostenträger-IK
 * wird am Patienten NICHT gespeichert.
 *
 * Das Feld `lead-krankenkasseIk` ist das Geschwisterfeld von `lead-krankenkasse`:
 * `attachKrankenkasseSuche` trägt dort bei einer IK-SUCHE die getippte Karten-IK ein
 * (die Namenssuche nie) und zeigt den Format-/Kostenträger-Hinweis unter dem Feld.
 * Dieses Modul ergänzt nur, was dort fehlt: Wert laden, Validierung und die Kasse-ändert-sich-Regel.
 */

import { kartenIkNormalisieren, HINWEISE } from './krankenkasse-suche.js?v=20261003e';

/**
 * Reine Validierung: liefert Fehlertext oder '' wenn gültig oder leer.
 * @param {?string} wert
 * @returns {string}
 */
export function leadKartenIkFehler(wert) {
  if (!String(wert ?? '').trim()) return '';
  return kartenIkNormalisieren(wert) ? '' : (HINWEISE?.de?.ikFormat || 'IK der Krankenkasse muss genau 9 Ziffern haben.');
}

/**
 * Prüft das Geschwisterfeld <kasseEl.id>Ik auf eine gültige Karten-IK.
 * Zeigt bei Fehler einen Inline-Fehler unter dem Feld an, setzt aria-invalid + Fokus.
 * @param {HTMLElement} kasseEl  #lead-krankenkasse
 * @returns {boolean} true = ok/leer, false = Fehler angezeigt
 */
export function pruefeLeadKartenIk(kasseEl) {
  const ikEl = kasseEl && (document.getElementById(kasseEl.id + 'Ik') || (kasseEl.id?.endsWith('Ik') ? kasseEl : null));
  if (!ikEl) return true;

  const fehler = leadKartenIkFehler(ikEl.value);
  let fehlerEl = document.getElementById(ikEl.id + 'Fehler');

  if (fehler) {
    if (!fehlerEl && typeof document !== 'undefined') {
      fehlerEl = document.createElement('div');
      fehlerEl.id = ikEl.id + 'Fehler';
      fehlerEl.setAttribute?.('role', 'alert');
      fehlerEl.style.cssText = 'font-size:11px;color:var(--danger);margin-top:2px;';
      const nach = document.getElementById(ikEl.id + 'Abweichung') ||
                   document.getElementById(ikEl.id + 'Hinweis') ||
                   ikEl;
      if (nach && typeof nach.insertAdjacentElement === 'function') {
        nach.insertAdjacentElement('afterend', fehlerEl);
      }
    }
    if (fehlerEl) fehlerEl.textContent = fehler;
    // Derselbe Formatsatz stand sonst zweimal da: attachKrankenkasseSuche schreibt ihn beim
    // change ins Hinweis-Element, dieser Fehler-Text kommt beim Speichern dazu → Hinweis leeren.
    const hinweisEl = document.getElementById(ikEl.id + 'Hinweis');
    if (hinweisEl) hinweisEl.textContent = '';
    ikEl.setAttribute?.('aria-invalid', 'true');
    ikEl.focus?.();

    if (!ikEl.dataset?.leadIkFehlerWired) {
      if (ikEl.dataset) ikEl.dataset.leadIkFehlerWired = '1';
      ikEl.addEventListener?.('input', () => {
        const el = document.getElementById(ikEl.id + 'Fehler');
        if (el) el.textContent = '';
        ikEl.removeAttribute?.('aria-invalid');
      });
    }
    return false;
  }

  if (fehlerEl) fehlerEl.textContent = '';
  ikEl.removeAttribute?.('aria-invalid');
  return true;
}

/**
 * Feld befüllen und verdrahten. Bei jedem Öffnen des Formulars aufrufen.
 *
 * Wird die Kasse von Hand geändert, gilt die alte Karten-IK nicht mehr → leeren.
 * Reihenfolge bei einer Auswahl aus der Liste (katalog-suche.js): erst `input`
 * (leert hier), dann `onSelect` (trägt bei IK-Suche die Karten-IK ein) — die
 * IK-Suche füllt das Feld also nach dem Leeren wieder, kein Kreis.
 *
 * @param {HTMLInputElement} kasseEl  #lead-krankenkasse
 * @param {?string} gespeichert       leads.krankenkasse_ik des Patienten (oder leer)
 */
export function attachLeadKartenIk(kasseEl, gespeichert) {
  const ikEl = kasseEl && document.getElementById(kasseEl.id + 'Ik');
  if (!ikEl) return;
  ikEl.value = gespeichert || '';
  const hinweis = document.getElementById(ikEl.id + 'Hinweis');
  if (hinweis) hinweis.textContent = '';
  const abweichung = document.getElementById(ikEl.id + 'Abweichung');
  if (abweichung) abweichung.textContent = '';
  const fehler = document.getElementById(ikEl.id + 'Fehler');
  if (fehler) fehler.textContent = '';
  ikEl.removeAttribute?.('aria-invalid');

  if (!ikEl.dataset?.leadIkFehlerWired) {
    if (ikEl.dataset) ikEl.dataset.leadIkFehlerWired = '1';
    ikEl.addEventListener?.('input', () => {
      const el = document.getElementById(ikEl.id + 'Fehler');
      if (el) el.textContent = '';
      ikEl.removeAttribute?.('aria-invalid');
    });
  }

  if (kasseEl.dataset?.kartenIkWired === '1') return;
  if (kasseEl.dataset) kasseEl.dataset.kartenIkWired = '1';
  kasseEl.addEventListener?.('input', () => {
    ikEl.value = '';
    const abw = document.getElementById(ikEl.id + 'Abweichung');
    if (abw) abw.textContent = '';
    const feh = document.getElementById(ikEl.id + 'Fehler');
    if (feh) feh.textContent = '';
    ikEl.removeAttribute?.('aria-invalid');
  });
}
