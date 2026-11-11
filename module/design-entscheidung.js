/**
 * design-entscheidung.js — wann gilt das neue Design? (Redesign Phase 2, Aktivierungsvertrag 10.11.2026)
 *
 * Auswertung (Fail-closed, jeder Fehler = Alt):
 *   1. Wunsch „alt" (?design=alt) → Alt.
 *   2. Lokale Vorschau (nur wenn /api/config `designVorschau:true`, das liefert allein dev_server.cjs)
 *      und Wunsch „neu" → Neu.
 *   3. Sonst fragt der Server (GET /design/entscheidung, verifizierte Sitzung) → nur `neu === true` gilt.
 * Query und localStorage sind unverbindliche Wünsche, nie eine Freigabe. Das Design erteilt keine Rechte.
 * Antworten, die zu einer anderen Sitzung gehören (Nutzerwechsel während des Wartens), werden verworfen.
 */

/** Rein, testbar. */
export function entscheideDesign({ wunsch, vorschau, serverNeu }) {
  if (wunsch === 'alt') return 'alt';
  if (vorschau === true && wunsch === 'neu') return 'neu';
  return serverNeu === true ? 'neu' : 'alt';
}

/** Server fragen; jeder Fehler (Netz, Status, JSON, Timeout, falscher Typ) → false. */
export async function frageServer({ apiBase, token, fetchFn = globalThis.fetch, timeoutMs = 5000 }) {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), timeoutMs);
  try {
    const t = await token();
    if (!t) return false;
    const r = await fetchFn(`${apiBase}/design/entscheidung`, {
      headers: { Authorization: `Bearer ${t}` }, cache: 'no-store', signal: abbruch.signal,
    });
    if (!r.ok) return false;
    return (await r.json())?.neu === true;
  } catch { return false; } finally { clearTimeout(uhr); }
}

/** Entscheidet und setzt/entfernt `data-design` am <html>. Gibt 'neu' | 'alt' zurück. */
export async function setzeDesign({ wunsch, vorschau, apiBase, token, aktuell, fetchFn, wurzel = globalThis.document?.documentElement }) {
  const uid = aktuell?.();
  let serverNeu = false;
  if (wunsch !== 'alt' && !(vorschau === true && wunsch === 'neu')) {
    serverNeu = await frageServer({ apiBase, token, fetchFn });
  }
  const ergebnis = aktuell && aktuell() !== uid ? 'alt' : entscheideDesign({ wunsch, vorschau, serverNeu });
  if (wurzel) {
    if (ergebnis === 'neu') wurzel.setAttribute('data-design', 'neu'); else wurzel.removeAttribute('data-design');
  }
  return ergebnis;
}
