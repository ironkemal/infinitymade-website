/**
 * verordnung-speichern-hinweise.js — ICD-Hinweise im Bestätigungsdialog „Verordnung speichern?".
 *
 * Herkunft: Reform P3-3 (30.09.2026). Die Maske zeigt „ICD-Code ist nicht endständig"
 * (katalog-suche.js `gespeicherterKodeHinweis`) unter dem Feld, der Speichern-Dialog
 * (`saveRezept()` in dashboard.js) listete ihn aber nicht — E11.7 ging ohne Wort durch.
 * Hier steht nur das Zusammenführen: Katalog-Hinweis (Kode allein) und Motor-Befund
 * `ICD_NICHT_ENDSTAENDIG` (Kode + Diagnosegruppe, nennt passende Unterkodes) sind
 * dieselbe Aussage — sie erscheinen nie doppelt, der genauere Satz gewinnt.
 * Blockiert nichts (Dialog bleibt „Trotzdem speichern").
 */

import { gespeicherterKodeHinweis } from '../katalog-suche.js?v=20261001a';
import { pruefeVerordnung } from './verordnung-pruefung.js?v=20261001h';
import { regelsatzLaden } from './verordnung-regelsatz-cache.js?v=20261001e';

export const ARZT_KORREKTUR = 'Korrektur nur durch den Arzt (neue Unterschrift + Datum).';

/**
 * Reine Regel: Katalog-Hinweise und Motor-Befunde zu EINER Liste ohne Doppelung.
 * @param {string[]} generische  Sätze aus gespeicherterKodeHinweis (je Feld, ggf. gleich)
 * @param {string[]} befundTexte Texte der ICD_NICHT_ENDSTAENDIG-Befunde
 * @returns {string[]}
 */
export function icdHinweiseZusammen(generische = [], befundTexte = []) {
  const spezifisch = [...new Set(befundTexte.filter(Boolean))];
  if (spezifisch.length) return spezifisch.map(t => `${t} ${ARZT_KORREKTUR}`);
  return [...new Set(generische.filter(Boolean))];
}

const ersterKode = s => String(s || '').trim().split(/[\s–]/)[0];

/**
 * @param {object} supabase
 * @param {{bereich:string, icdFelder:string[], dg?:string}} p  Feldwerte der Maske
 * @returns {Promise<string[]>} Hinweissätze (leer = nichts zu melden); wirft nie
 */
export async function icdSpeicherHinweise(supabase, { bereich, icdFelder = [], dg = '' } = {}) {
  try {
    const felder = icdFelder.filter(f => ersterKode(f));
    if (!felder.length) return [];
    const generische = await Promise.all(felder.map(f => gespeicherterKodeHinweis(supabase, f, bereich || null)));
    let befundTexte = [];
    if (String(dg || '').trim()) {
      const satz = await regelsatzLaden(supabase, bereich);
      if (satz) {
        const r = pruefeVerordnung({ bereich, icd: felder.map(ersterKode), diagnosegruppe: dg }, satz);
        befundTexte = r.befunde.filter(b => b.code === 'ICD_NICHT_ENDSTAENDIG').map(b => b.text);
      }
    }
    return icdHinweiseZusammen(generische, befundTexte);
  } catch (e) {
    console.warn('[verordnung-speichern-hinweise]', e);
    return [];
  }
}
