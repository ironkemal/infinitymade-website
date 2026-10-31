/**
 * api-fehler.js — lesbarer Fehlertext aus einer fehlgeschlagenen API-Antwort.
 *
 * Mehrere Billing-Aufrufe warfen `await res.text()` direkt in die Oberfläche:
 * Anwender sahen rohes JSON (`{"error":"…"}`) in Statistik und Mahnwesen.
 */
const STANDARD = 'Die Daten konnten nicht geladen werden.';

export function fehlerTextAusAntwort(rohtext, ersatz = STANDARD) {
  const text = String(rohtext ?? '').trim();
  if (!text) return ersatz;
  try {
    const daten = JSON.parse(text);
    const meldung = daten?.error?.message ?? daten?.error ?? daten?.message;
    return typeof meldung === 'string' && meldung.trim() ? meldung.trim() : ersatz;
  } catch {
    // HTML-Fehlerseiten eines Proxys gehören nicht in die Oberfläche.
    return /^</.test(text) ? ersatz : text;
  }
}

export async function apiFehlerText(res, ersatz = STANDARD) {
  try { return fehlerTextAusAntwort(await res.text(), ersatz); } catch { return ersatz; }
}
