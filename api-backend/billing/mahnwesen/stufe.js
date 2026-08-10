// Mahnstufen-Logik (Loop-Liste "Kassieren", Aufgabe 9d).
//
// Bisher bestimmte der Aufrufer die Stufe frei — Stufe 3 ("letzte Mahnung",
// kündigt das Inkassobüro an) liess sich als ALLERERSTE Mahnung verschicken,
// ohne dass der Patient je eine Zahlungserinnerung bekommen hatte. Die Stufe
// wird jetzt gegen die Historie geprüft.
//
// Stufen: 1 = Zahlungserinnerung, 2 = 1. Mahnung, 3 = 2. Mahnung (letzte).
//
// Reine Funktionen ohne DB-Zugriff, damit sie testbar sind.

export const MAX_STUFE = 3;

/** Tage bis zur neuen Fälligkeit je Stufe. */
export const LEVEL_DAYS = { 1: 14, 2: 10, 3: 7 };

/**
 * Nächste zulässige Mahnstufe aus der Historie.
 * @param {Array<{level:number}>} bisherige  bereits verschickte Mahnungen
 * @returns {number|null} null, wenn Stufe 3 schon verschickt wurde
 */
export function naechsteStufe(bisherige = []) {
  const hoechste = (bisherige || []).reduce(
    (max, m) => Math.max(max, Number(m?.level) || 0), 0);
  if (hoechste >= MAX_STUFE) return null;
  return hoechste + 1;
}

/**
 * Prüft eine gewünschte Stufe gegen die Historie.
 *
 * @param {number} gewuenscht
 * @param {Array<{level:number}>} bisherige
 * @returns {{ ok: boolean, stufe: number|null, fehler: string|null }}
 */
export function pruefeStufe(gewuenscht, bisherige = []) {
  const naechste = naechsteStufe(bisherige);

  if (naechste === null) {
    return {
      ok: false, stufe: null,
      fehler: 'Für diese Forderung wurde bereits die letzte Mahnung (Stufe 3) verschickt.',
    };
  }

  const lvl = parseInt(gewuenscht, 10);
  if (![1, 2, 3].includes(lvl)) {
    return { ok: false, stufe: null, fehler: 'Mahnstufe muss 1, 2 oder 3 sein.' };
  }

  if (lvl > naechste) {
    return {
      ok: false, stufe: null,
      fehler: `Mahnstufe ${lvl} ist noch nicht an der Reihe — als nächstes folgt Stufe ${naechste}.`,
    };
  }

  // Eine niedrigere Stufe erneut zu schicken ist erlaubt (z.B. zweite
  // Zahlungserinnerung, weil die erste nachweislich nicht ankam). Nur das
  // Überspringen nach oben wird verhindert.
  return { ok: true, stufe: lvl, fehler: null };
}
