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
 * Dieses Modul ergänzt nur, was dort fehlt: Wert laden und die Kasse-ändert-sich-Regel.
 */

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
  if (kasseEl.dataset.kartenIkWired === '1') return;
  kasseEl.dataset.kartenIkWired = '1';
  kasseEl.addEventListener('input', () => { ikEl.value = ''; });
}
