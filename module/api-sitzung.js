/**
 * api-sitzung.js — Sitzungsprüfung und lesbare Fehlertexte für Backend-Aufrufe (18.11.2026).
 *
 * Niye: Live-Test 18.11.2026 — alle Backend-Aufrufe antworteten 401 {"error":"Invalid token"},
 * obwohl der Browser eine "gültige" Sitzung hatte (expires_at in der Zukunft, Supabase-REST 200).
 * Ursache: Die Sitzung war serverseitig beendet (signOut() mit Standard-scope 'global' auf einem
 * anderen Gerät/Tab, Passwortwechsel o. ä.). PostgREST prüft nur Signatur + Ablauf des JWT und
 * antwortet weiter 200; das Backend fragt /auth/v1/user, das antwortet 403 session_not_found,
 * und auch der Refresh schlägt fehl (refresh_token_not_found). Die Seiten zeigten dann rohes JSON
 * oder "Sitzung abgelaufen" ohne Erklärung, und der Nutzer blieb in einer toten Sitzung.
 *
 * Nerede: dashboard.js installiert den Wächter direkt nach createClient; Termin-Anfragen
 * (module/anfrage-bearbeiten.js), Zahlungsjournal, Mahnwesen, Ausfall, Auswertungen, Anwesenheit
 * und Mitarbeiter-Zugang nutzen fehlertextAus/apiFehlertext statt den Rohtext anzuzeigen.
 */

export const MELDUNG_SITZUNG_BEENDET =
  'Ihre Anmeldung wurde beendet (z. B. durch Abmelden auf einem anderen Gerät). Bitte melden Sie sich neu an.';

/**
 * Fragt den Auth-Server (nicht den lokalen Speicher), ob die Sitzung noch existiert.
 * true nur bei eindeutiger Ablehnung durch Supabase; Netzwerk-/Dienstfehler zählen NICHT als beendet.
 * @param {{ getUser?: () => Promise<{ data?: { user?: unknown } | null, error?: any }> } | null | undefined} auth
 * @returns {Promise<boolean>}
 */
export async function sitzungBeendet(auth) {
  if (!auth || typeof auth.getUser !== 'function') return false;
  try {
    const { data, error } = await auth.getUser();
    if (!error) return !data?.user;
    if (error.name === 'AuthSessionMissingError') return true;
    const status = Number(error.status);
    return status === 401 || status === 403
      || error.code === 'session_not_found' || error.code === 'bad_jwt' || error.code === 'user_not_found';
  } catch {
    return false;
  }
}

/** Bekannte englische/technische Backend-Texte → Deutsch. */
const UEBERSETZT = /** @type {Record<string, string>} */ ({
  'invalid token': 'Ihre Anmeldung ist nicht mehr gültig. Bitte melden Sie sich neu an.',
  'missing bearer token': 'Nicht angemeldet. Bitte melden Sie sich neu an.',
  'profile not found': 'Ihr Profil wurde nicht gefunden. Bitte melden Sie sich neu an.',
  'forbidden': 'Keine Berechtigung für diese Aktion.',
  'not found': 'Der Eintrag wurde nicht gefunden.',
  'internal server error': 'Serverfehler. Bitte später erneut versuchen.',
  'auth check failed': 'Anmeldung konnte nicht geprüft werden. Bitte später erneut versuchen.',
});

/** @param {string} t */
const lesbar = (t) => !!t && t.length <= 300 && !/^\s*[{[<]/.test(t) && !/\bat\s+\S+\s*\(|Error:/.test(t);

/**
 * Lesbarer deutscher Text aus Status + (bereits gelesenem) Antwortkörper. Nie rohes JSON/HTML.
 * @param {number} status
 * @param {unknown} body  geparstes JSON, Text oder null
 * @param {string} [fallback]
 * @returns {string}
 */
export function fehlertextAus(status, body, fallback = 'Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.') {
  const b = /** @type {any} */ (body);
  let roh = typeof b === 'string' ? b : (typeof b?.error === 'string' ? b.error : (typeof b?.message === 'string' ? b.message : ''));
  if (typeof b === 'string') {
    try { const j = JSON.parse(b); if (typeof j?.error === 'string') roh = j.error; else if (typeof j?.message === 'string') roh = j.message; } catch { /* Text bleibt */ }
  }
  roh = roh.trim();
  const bekannt = UEBERSETZT[roh.toLowerCase()];
  if (status === 401) return bekannt || UEBERSETZT['invalid token'];
  if (b?.code === 'AUTH_UNAVAILABLE' || status === 503) return 'Dienst vorübergehend nicht erreichbar. Bitte später erneut versuchen.';
  if (bekannt) return bekannt;
  if (status >= 500) return 'Serverfehler. Bitte später erneut versuchen.';
  if (lesbar(roh)) return roh;
  if (status === 403) return UEBERSETZT.forbidden;
  return fallback;
}

/**
 * Liest eine fehlgeschlagene Response (per clone, Aufrufer kann sie weiter lesen) und liefert fehlertextAus.
 * @param {Response | { status: number, clone?: () => any, text?: () => Promise<string> }} res
 * @param {string} [fallback]
 * @returns {Promise<string>}
 */
export async function apiFehlertext(res, fallback) {
  let body = null;
  try {
    const quelle = typeof res.clone === 'function' ? res.clone() : res;
    body = typeof quelle.text === 'function' ? await quelle.text() : null;
  } catch { /* Körper nicht lesbar */ }
  return fehlertextAus(res.status, body, fallback);
}

/**
 * @param {RequestInfo | URL} input
 * @param {string} apiBase
 * @param {string} origin
 */
function istApiUrl(input, apiBase, origin) {
  try {
    const roh = typeof input === 'string' ? input : input instanceof URL ? input.href : /** @type {Request} */ (input).url;
    const ziel = new URL(roh, origin).href;
    const basis = new URL(apiBase.replace(/\/?$/, '/'), origin).href;
    return ziel.startsWith(basis) || ziel === basis.slice(0, -1);
  } catch {
    return false;
  }
}

/**
 * Wächter über fetch: antwortet das Backend (apiBase) mit 401, wird einmal beim Auth-Server
 * nachgefragt. Ist die Sitzung dort beendet → beiBeendet() genau einmal. Die Response geht
 * unverändert an den Aufrufer zurück (keine Wiederholung, kein Umgehen der Prüfung).
 * @param {{ auth: any, apiBase: string, beiBeendet: () => void, ziel?: { fetch: typeof fetch }, origin?: string }} opts
 * @returns {() => void} Deinstallieren (für Tests)
 */
export function sitzungsWaechterInstallieren({ auth, apiBase, beiBeendet, ziel = globalThis, origin }) {
  const original = ziel.fetch;
  const herkunft = origin || globalThis.location?.origin || 'http://localhost';
  /** @type {Promise<boolean> | null} */
  let pruefung = null;
  let gemeldet = false;
  /** @type {typeof fetch} */
  const bewacht = async (input, init) => {
    const res = await original.call(ziel, input, init);
    if (res.status === 401 && !gemeldet && apiBase && istApiUrl(input, apiBase, herkunft)) {
      pruefung = pruefung || sitzungBeendet(auth).finally(() => { pruefung = null; });
      if (await pruefung && !gemeldet) { gemeldet = true; try { beiBeendet(); } catch { /* Anzeige darf fetch nicht brechen */ } }
    }
    return res;
  };
  ziel.fetch = bewacht;
  return () => { if (ziel.fetch === bewacht) ziel.fetch = original; };
}
