// Kostenträgerdatei (TP5, EDIFACT) korrekt dekodieren.
//
// Warum das hier steht (30.09.2026, wissensbank W-01 Punkt 9): die vier Q4/2026-
// Dateien liegen byte-genau vom Herausgeber vor — ISO-8859-1 (UNB "UNOC:3"),
// CRLF. Die sieben älteren Dateien sind UTF-8/LF (per Copy-Paste entstanden).
// `readFileSync(pfad, 'utf8')` macht aus jedem Umlaut der Latin-1-Dateien
// U+FFFD; Datensatz-, IK- und VKG-Zahlen bleiben dabei GLEICH (der Zählertest
// merkt nichts), nur die Kassennamen sind kaputt — und gingen so in die DB.
//
// Regel: der UNB-Zeichensatz allein reicht NICHT — die sieben älteren Dateien
// tragen im Kopf ebenfalls "UNOC:3", sind aber UTF-8 (Copy-Paste). Deshalb:
// erst strikt als UTF-8 lesen; scheitert das (ungültige Bytefolge = echte
// Latin-1-Umlaute) und der Kopf sagt UNOC:3, dann latin1. Sonst Fehler statt
// still kaputter Namen. (Eine Latin-1-Datei ohne Umlaute ist in beiden
// Lesarten identisch, ein Latin-1-Umlaut ist nie gültiges UTF-8.)

import { readFileSync } from 'node:fs';

/** Zeichensatz-Kennung aus dem UNB-Segment ("UNB+UNOC:3+…") lesen. */
export function unbZeichensatz(bytes) {
  // Kopf ist ASCII; die ersten 200 Bytes reichen sicher für UNA + UNB.
  const kopf = Buffer.from(bytes.subarray(0, 200)).toString('latin1');
  const m = kopf.match(/UNB\+(UNO[A-Z]):(\d+)/);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * @param {Buffer|Uint8Array} bytes Rohbytes der Datei
 * @returns {string} dekodierter Text
 */
export function dekodiereKostentraegerDatei(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    const satz = unbZeichensatz(buf);
    if (satz === 'UNOC:3') return buf.toString('latin1');
    throw new Error(
      `Kostenträgerdatei: weder gültiges UTF-8 noch UNOC:3 (Zeichensatz ${satz || 'unbekannt'}) — Kodierung prüfen`
    );
  }
}

export function leseKostentraegerDatei(pfad) {
  return dekodiereKostentraegerDatei(readFileSync(pfad));
}
