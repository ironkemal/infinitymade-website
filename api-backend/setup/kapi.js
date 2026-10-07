// K2b.7a (07.10.2026) — EIN Tor vor dem ganzen Einrichtungs-Router.
//
// Vorher prüfte jede Route selbst, ob die Einrichtung abgeschlossen ist — und
// /test-smtp tat es nicht (nur Jeton). Wer nach dem Abschluss den Jeton aus
// .env/Verlauf kannte, konnte also weiter Testmails auslösen, und jede später
// hinzugefügte Route wäre ohne eigene Zeile offen gewesen (guvenlik S-50 Weg 2,
// onprem O-161 K2b.7 Bedingung 1). Jetzt: router.use ganz oben.
//
//  - abgeschlossen_am gesetzt → alles außer GET /status 410.
//  - Jeton älter als 14 Tage (SETUP_TOKEN_SEIT, Unix-Sekunden, von install.sh)
//    → 410 + Hinweis auf `install.sh --neuer-jeton`. SEIT leer/ungültig (alte
//    Box vor K2b.7a) → kein Ablauf.
//
// Reihenfolge: zuerst abgeschlossen (endgültig), dann Ablauf. DB-Fehler in
// istAbgeschlossen() gilt als "nicht abgeschlossen" (fail-open wie bisher) —
// eine halb eingerichtete Box soll durch einen DB-Hicks nicht gesperrt werden;
// der Jeton bleibt dann die Prüfung jeder Route.

export const JETON_GUELTIG_TAGE = 14;
const JETON_GUELTIG_MS = JETON_GUELTIG_TAGE * 24 * 60 * 60 * 1000;

export function jetonAbgelaufen(seitRoh, jetztMs = Date.now()) {
  if (seitRoh === undefined || seitRoh === null || String(seitRoh).trim() === '') return false;
  const seit = Number(String(seitRoh).trim());
  if (!Number.isFinite(seit) || seit <= 0) return false;
  return jetztMs - seit * 1000 > JETON_GUELTIG_MS;
}

export function setupKapisi({ istAbgeschlossen, seit = () => process.env.SETUP_TOKEN_SEIT, jetzt = () => Date.now() }) {
  return async function setupKapi(req, res, next) {
    if (req.method === 'GET' && req.path === '/status') return next();
    try {
      if (await istAbgeschlossen()) {
        return res.status(410).json({ error: 'Bereits eingerichtet' });
      }
    } catch {
      // wie istAbgeschlossen() selbst: im Zweifel nicht "für immer zu"
    }
    if (jetonAbgelaufen(seit(), jetzt())) {
      return res.status(410).json({
        error: 'Der Einrichtungslink ist abgelaufen.',
        abgelaufen: true,
        hinweis: 'Auf dem Server: sudo bash install.sh --neuer-jeton',
      });
    }
    next();
  };
}
