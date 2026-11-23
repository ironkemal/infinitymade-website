/**
 * gehaerteter-json-store.js — kleine JSON-Dateien sicher lesen/schreiben (Phase 7b, 23.11.2026).
 *
 * Warum: Für die KI-Aufgaben-Sperre brauchte es dieselbe Härtung wie bei der KI-Freischaltung
 * (ai/ki-einwilligung.js createOwnerDecisionStore): Verzeichnis 0700 und kein Symlink, Datei 0600,
 * O_NOFOLLOW, Größenlimit, atomares Schreiben über eine Zufalls-Tempdatei. fonksiyon-ustasi: Kern
 * herauslösen statt zu kopieren. ki-einwilligung.js bleibt vorerst unverändert (sicherheitskritisch,
 * eigener Umstellungsschritt) — Kandidat zum Nachziehen.
 *
 * Fehler werden nie geworfen beim Lesen: Ergebnis sagt `fehlt` | `ok` | `fehler` (+ grund), der Aufrufer
 * entscheidet fail-closed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,120}$/i;

/** @param {string} verzeichnis */
function verzeichnisSicher(verzeichnis) {
  const st = fs.lstatSync(verzeichnis);
  return st.isDirectory() && !st.isSymbolicLink() && (st.mode & 0o777) === 0o700;
}

/**
 * @param {string} verzeichnis @param {string} datei @param {{ maxBytes?: number }} [o]
 * @returns {{ status: 'fehlt' } | { status: 'ok', data: any } | { status: 'fehler', grund: string }}
 */
export function liesJsonDatei(verzeichnis, datei, { maxBytes = 2048 } = {}) {
  if (!NAME_RE.test(datei)) return { status: 'fehler', grund: 'UNGUELTIGER_NAME' };
  const pfad = path.join(verzeichnis, datei);
  try {
    if (!fs.existsSync(pfad)) {
      // Fehlt auch nach lstat (kein toter Symlink)?
      try { fs.lstatSync(pfad); return { status: 'fehler', grund: 'SYMLINK' }; } catch { return { status: 'fehlt' }; }
    }
    if (!verzeichnisSicher(verzeichnis)) return { status: 'fehler', grund: 'UNSICHERES_VERZEICHNIS' };
    const st = fs.lstatSync(pfad);
    if (!st.isFile() || st.isSymbolicLink()) return { status: 'fehler', grund: 'KEINE_DATEI' };
    if ((st.mode & 0o777) !== 0o600) return { status: 'fehler', grund: 'RECHTE' };
    if (st.size > maxBytes) return { status: 'fehler', grund: 'ZU_GROSS' };
    let fd;
    try {
      fd = fs.openSync(pfad, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const offen = fs.fstatSync(fd);
      if (!offen.isFile() || offen.size > maxBytes || (offen.mode & 0o777) !== 0o600) return { status: 'fehler', grund: 'GEAENDERT' };
      const roh = fs.readFileSync(fd, 'utf8');
      return { status: 'ok', data: JSON.parse(roh) };
    } finally { if (fd !== undefined) fs.closeSync(fd); }
  } catch {
    return { status: 'fehler', grund: 'LESEFEHLER' };
  }
}

/**
 * Schreibt atomar (Tempdatei 0600 → rename). Wirft bei Fehlern.
 * @param {string} verzeichnis @param {string} datei @param {unknown} objekt @param {{ maxBytes?: number }} [o]
 */
export function schreibeJsonDatei(verzeichnis, datei, objekt, { maxBytes = 2048 } = {}) {
  if (!NAME_RE.test(datei)) throw new Error('Ungültiger Dateiname');
  const text = JSON.stringify(objekt, null, 2);
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('Datensatz zu groß');
  fs.mkdirSync(verzeichnis, { recursive: true, mode: 0o700 });
  if (!verzeichnisSicher(verzeichnis)) throw new Error('Unsicheres Verzeichnis');
  const pfad = path.join(verzeichnis, datei);
  try { const alt = fs.lstatSync(pfad); if (!alt.isFile() || alt.isSymbolicLink()) throw new Error('Zieldatei ist keine reguläre Datei'); } catch (e) { if (/** @type {any} */ (e)?.code !== 'ENOENT') throw e; }
  const tmp = path.join(verzeichnis, `.${datei}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    fs.writeSync(fd, text);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(tmp, pfad);
    fs.chmodSync(pfad, 0o600);
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* aufräumen best effort */ }
    throw e;
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}
