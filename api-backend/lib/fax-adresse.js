// Adressmuster und Normalisierung für Fax-to-Mail (onprem O-231).
// Reine Funktionen ohne I/O, synchron und seiteneffektfrei.

export const FAX_MUSTER_RE = /^[A-Za-z0-9._+-]*\{nummer\}[A-Za-z0-9._+-]*@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

/**
 * Prüft das Adressmuster eines Fax-Dienstes (z. B. {nummer}@fax.provider.de).
 * Dasselbe Regex steht als CHECK in Migration 0094.
 * @param {string} muster
 * @returns {{ ok: true, muster: string } | { ok: false, fehler: string }}
 */
export function pruefeFaxMuster(muster) {
  if (typeof muster !== 'string') {
    return { ok: false, fehler: 'Bitte ein Fax-Adressmuster angeben.' };
  }
  const m = muster.trim();
  if (!m) {
    return { ok: false, fehler: 'Bitte ein Fax-Adressmuster angeben.' };
  }
  if (m.length > 200) {
    return { ok: false, fehler: 'Das Fax-Adressmuster darf maximal 200 Zeichen lang sein.' };
  }
  const vorkommen = (m.match(/\{nummer\}/g) || []).length;
  if (vorkommen === 0) {
    return { ok: false, fehler: 'Das Adressmuster muss den Platzhalter {nummer} enthalten.' };
  }
  if (vorkommen > 1) {
    return { ok: false, fehler: 'Das Adressmuster darf den Platzhalter {nummer} nur genau einmal enthalten.' };
  }
  if (!m.includes('@')) {
    return { ok: false, fehler: 'Das Adressmuster muss ein @-Zeichen enthalten.' };
  }
  const teile = m.split('@');
  if (teile.length !== 2) {
    return { ok: false, fehler: 'Das Adressmuster darf nur genau ein @-Zeichen enthalten.' };
  }
  const domain = teile[1];
  if (!/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(domain) || domain.startsWith('.') || domain.endsWith('.')) {
    return { ok: false, fehler: 'Bitte eine gültige Domain nach dem @ angeben.' };
  }
  if (!FAX_MUSTER_RE.test(m)) {
    return { ok: false, fehler: 'Ungültiges Fax-Adressmuster (z. B. {nummer}@fax.provider.de).' };
  }
  return { ok: true, muster: m };
}

/**
 * Normalisiert eine Faxnummer auf reine Ziffern.
 * Führendes '+' wird zu '00', danach alle Nicht-Ziffern entfernt.
 * Gültige Länge: 6 bis 20 Ziffern, sonst null.
 * @param {string|number} roh
 * @returns {string|null}
 */
export function faxNummerNormalisieren(roh) {
  if (typeof roh !== 'string' && typeof roh !== 'number') return null;
  const s = String(roh).trim();
  if (!s) return null;
  const mitNullen = s.startsWith('+') ? '00' + s.slice(1) : s;
  const ziffern = mitNullen.replace(/\D/g, '');
  if (ziffern.length < 6 || ziffern.length > 20) return null;
  return ziffern;
}

/**
 * Ersetzt den Platzhalter {nummer} im Muster durch die normalisierte Faxnummer.
 * Führt danach eine strikte Sicherheitsprüfung durch:
 * keine CR/LF/Leerzeichen/Komma/Semikolon/< / >, genau ein @, gültige Domain.
 * Bei jedem Zweifel null.
 * @param {string} muster
 * @param {string|number} nummerRoh
 * @returns {string|null}
 */
export function baueFaxAdresse(muster, nummerRoh) {
  const p = pruefeFaxMuster(muster);
  if (!p.ok) return null;
  const nummer = faxNummerNormalisieren(nummerRoh);
  if (!nummer) return null;
  const adresse = p.muster.replace('{nummer}', nummer);
  if (/[\r\n\s,;<>{}]/.test(adresse)) return null;
  const teile = adresse.split('@');
  if (teile.length !== 2) return null;
  const [lokal, domain] = teile;
  if (!lokal || !domain) return null;
  if (!/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(domain)) return null;
  return adresse;
}
