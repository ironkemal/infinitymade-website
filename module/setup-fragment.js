// module/setup-fragment.js
// Extrahiert den Einrichtungs-Jeton aus dem URL-Fragment (K2b.11, K-19 h).
// Reine Funktion ohne DOM-Zugriff (fuer Node-Tests importierbar).

/**
 * Liest und prueft einen Einrichtungs-Jeton aus einem URL-Hash-String.
 * Erlaubt sind nur hexadezimale Zeichen (16 bis 128 Zeichen, gross/klein).
 * Bei ungueltigem oder fehlendem Hash wird null zurueckgegeben.
 *
 * @param {string|null|undefined} hash - Der Fragment-String (z. B. location.hash)
 * @returns {string|null} Der gepruefte Jeton oder null
 */
export function jetonAusHash(hash) {
  if (typeof hash !== 'string' || !hash || hash === '#') {
    return null;
  }
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let decoded;
  try {
    decoded = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  if (!/^[0-9a-f]{16,128}$/i.test(decoded)) {
    return null;
  }
  return decoded;
}

// Muss in setup.js der ERSTE Import sein: ES-Module werten Abhängigkeiten in
// Import-Reihenfolge aus, und supabase-config.js ruft schon beim Laden
// fetch('/api/config') auf (Top-Level-await). Damit das Fragment vor JEDEM
// fetch aus der Adresszeile verschwindet (guvenlik S-48 Bedingung 1), passiert
// das Lesen + replaceState hier beim Modul-Laden — nicht erst im Körper von
// setup.js. Ohne Browser (Node-Tests) nichts tun.
let gelesen = null;
if (typeof location !== 'undefined' && typeof history !== 'undefined') {
  // Erst entfernen, dann auswerten — wirft die Auswertung, ist der Hash trotzdem weg.
  const hash = location.hash;
  if (hash || location.href.endsWith('#')) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* Seite läuft ohne */ }
  }
  gelesen = jetonAusHash(hash);
}
export const fragmentJeton = gelesen;
