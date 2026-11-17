// Debug-Ausgaben nur auf Wunsch (QA TEST-Physio 17.11.2026, Fund 10): dashboard.js schrieb bei
// jeder Navigation „[renderSidebar] …", „[init] … ok" und „[boot] …" in die Konsole — teils mit
// ganzen Profilobjekten. Einschalten im Browser: localStorage.setItem('praxura_debug', '1').
// console.error/warn bleiben unverändert (Sentry und Fehlersuche brauchen sie).

/** @returns {boolean} */
export function debugAn() {
  try { return globalThis.localStorage?.getItem('praxura_debug') === '1'; } catch { return false; }
}

/** console.log hinter dem Schalter. @param {...unknown} args */
export function dbg(...args) {
  if (debugAn()) console.log(...args);
}
