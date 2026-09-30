// ICD-10-GM: Bindestrich am Ende ("E11.7-", Katalogform nicht endständiger Kodes)
// ist laut §302-Klarstellung KEIN Bestandteil des Kodes im DTA-Datenstrom
// (gkv-302 30.09.2026, ICD-10-GM 2026 Metadaten Feld 7 "Schlüsselnummer ohne Strich").

/**
 * Entfernt nachgestellte Bindestriche eines ICD-10-Kodes.
 * Behält Groß-/Kleinschreibung und alle anderen Zeichen unverändert bei.
 *
 * @param {?string} code
 * @returns {string}
 */
export function icdOhneStrich(code) {
  // „E11.-" (dreistellige Kategorie): Punkt + Strich fallen zusammen weg -> „E11".
  return String(code ?? '').trim().replace(/\.?-+$/, '');
}

/**
 * Erzeugt für die Datenbankabfrage (icd10_titles) sowohl die bindestrichfreie
 * als auch die mit Bindestrich versehene Katalogform je Kode.
 *
 * @param {string[]} kodes
 * @returns {string[]}
 */
export function icdAbfrageKodes(kodes) {
  if (!Array.isArray(kodes)) return [];
  const ks = [...new Set(kodes.map(icdOhneStrich).filter(Boolean))];
  return [...new Set([...ks, ...ks.map(k => `${k}-`), ...ks.filter(k => !k.includes('.')).map(k => `${k}.-`)])];
}

/**
 * Baut aus DB-Zeilen von icd10_titles eine Map { [dashFreeCode]: terminal }.
 * Gibt es für denselben Kode sowohl eine Zeile mit als auch ohne Bindestrich,
 * gewinnt terminal === false (nicht endständig hat Vorrang).
 *
 * @param {Array<{code: string, terminal: boolean}>} rows
 * @returns {Record<string, boolean>}
 */
export function icdTerminalMap(rows) {
  const map = {};
  if (!Array.isArray(rows)) return map;
  for (const r of rows) {
    if (!r || r.code == null) continue;
    const clean = icdOhneStrich(r.code);
    if (!clean) continue;
    if (!(clean in map) || r.terminal === false) {
      map[clean] = r.terminal === false ? false : r.terminal;
    }
  }
  return map;
}
