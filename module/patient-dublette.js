/**
 * patient-dublette.js — Ist dieser Patient schon da?
 *
 * Eine Regel für den Patienten-Import (20.10.2026). Sie folgt der Regel aus
 * `POST /api/rezept/confirm` (server.js): gleicher Nachname, Vorname und
 * Geburtsdatum — dazu die Versichertennummer, wo beide eine haben.
 * Ein eindeutiger Index ginge nicht: live sind KVNR schon doppelt und
 * vielen Patienten fehlt das Geburtsdatum (db-ustasi, 20.10.2026).
 *
 * ⚠️ Schnellerfassung (dashboard.js), rezept/confirm und booking/create haben
 * je eine eigene Regel. Zusammenführen ist offen — fonksiyon-ustasi, Kemal
 * entscheidet. Diese Datei ist der Ort, an dem sie zusammenlaufen sollen.
 */

const klein = (s) => String(s ?? '').trim().toLocaleLowerCase('de-DE');

/** Schlüssel aus Name + Geburtsdatum, oder null wenn etwas fehlt. */
export function nameGeburtSchluessel(p) {
  const nach = klein(p?.last_name), vor = klein(p?.first_name), geb = p?.geburtsdatum || p?.metadata?.geburtsdatum;
  return nach && vor && geb ? `${nach}|${vor}|${geb}` : null;
}

function kvnr(p) {
  const k = String(p?.versichertennummer ?? '').replace(/\s+/g, '').toUpperCase();
  return k || null;
}

/**
 * Sucht einen passenden Patienten.
 * @param {object} p neuer Patient (leads-Felder)
 * @param {object[]} bestehende vorhandene leads
 * @returns {object|null} der gefundene Patient
 */
export function findePatientDublette(p, bestehende) {
  const k = kvnr(p);
  const s = nameGeburtSchluessel(p);
  if (!k && !s) return null;
  for (const b of bestehende || []) {
    if (k && kvnr(b) === k) return b;
    if (s && nameGeburtSchluessel(b) === s) return b;
  }
  return null;
}
