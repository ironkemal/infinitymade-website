/**
 * lead-felder.js — Geburtsdatum und Hausbesuch eines Patienten (leads).
 *
 * Reform S3.1 (29.09.2026): Beide Werte haben eine eigene Spalte
 * (leads.geburtsdatum, leads.hausbesuch), wurden aber von Formular,
 * Schnellerfassung und Backend nur in metadata geschrieben; Leser griffen
 * je nach Stelle auf das eine oder das andere zu. Ab jetzt schreiben alle
 * in die Spalte, gelesen wird hier zentral mit Rueckfall auf metadata
 * (Altbestand).
 */

// Spalte gewinnt; Leerstring/null faellt auf metadata zurueck.
export function leadGeburtsdatum(lead) {
  return lead?.geburtsdatum || lead?.metadata?.geburtsdatum || null;
}

// Die Spalte hat DEFAULT false: alte Zeilen tragen false in der Spalte und
// true in metadata. Deshalb reicht ein true aus einer der beiden Quellen.
export function leadHausbesuch(lead) {
  return lead?.hausbesuch === true || lead?.metadata?.hausbesuch === true;
}

/**
 * Fuehrt metadata beim Speichern zusammen, statt es neu aufzubauen.
 * bestehend: aktuelle lead.metadata (oder null)
 * formAnteil: Schluessel, die das Formular verwaltet; null/undefined/'' = leeren
 * entferne: Schluessel, die jetzt in einer Spalte stehen (Altlast loeschen)
 * Unbekannte Schluessel (z. B. OCR-Felder) bleiben erhalten.
 * Gibt null zurueck, wenn nichts uebrig bleibt.
 */
export function leadMetadataZusammenfuehren(bestehend, formAnteil, entferne = []) {
  const out = { ...(bestehend && typeof bestehend === 'object' ? bestehend : {}) };
  for (const k of entferne) delete out[k];
  for (const [k, v] of Object.entries(formAnteil || {})) {
    if (v === null || v === undefined || v === '') delete out[k];
    else out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
