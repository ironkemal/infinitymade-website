// Gemeinsame Konsolenregel für Browser-Proben (Box-Test 22.11.2026, Befund 2):
// „Ein Test soll fehlschlagen, wenn Konsolenfehler auftauchen.“
// Wertet console.error UND pageerror. Gewollte Meldungen nur mit Allowlist-Eintrag + Grund — kein Pauschal-Ignore.
// Abgesichert durch tools/probe-konsole.test.js: jede Probe im npm-Skript „probe“ muss beides werten.

/**
 * @param {import('playwright').Page} page
 * @param {{ erlaubt?: Array<{ muster: RegExp, grund: string }> }} [o]
 * @returns {{ fehler: string[], erlaubtGesehen: string[] }}
 */
export function konsoleBeobachten(page, { erlaubt = [] } = {}) {
  for (const e of erlaubt) {
    if (!(e.muster instanceof RegExp) || typeof e.grund !== 'string' || e.grund.trim().length < 10) {
      throw new Error('Konsolen-Allowlist braucht muster (RegExp) und einen Grund (≥ 10 Zeichen)');
    }
  }
  /** @type {string[]} */ const fehler = [];
  /** @type {string[]} */ const erlaubtGesehen = [];
  const pruefe = (/** @type {string} */ text) => {
    const treffer = erlaubt.find(e => e.muster.test(text));
    (treffer ? erlaubtGesehen : fehler).push(text.slice(0, 300));
  };
  page.on('console', m => { if (m.type() === 'error') pruefe(m.text()); });
  page.on('pageerror', e => pruefe(`pageerror: ${e.message}`));
  return { fehler, erlaubtGesehen };
}

/**
 * Am Ende der Probe aufrufen: druckt die Fehler und setzt process.exitCode = 1.
 * @param {{ fehler: string[] }} beobachtung @param {string} name
 * @returns {boolean} true = sauber
 */
export function konsoleAuswerten(beobachtung, name) {
  if (!beobachtung.fehler.length) return true;
  console.error(`FAIL ${name}: ${beobachtung.fehler.length} Konsolenfehler`);
  for (const f of beobachtung.fehler.slice(0, 10)) console.error('  ' + f);
  process.exitCode = 1;
  return false;
}
