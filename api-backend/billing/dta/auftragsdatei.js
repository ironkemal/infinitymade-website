// § 302 SGB V — Auftragsdatei (Auftragssatz Version 1.0), GGT Anlage 2.
//
// Warum das existiert: eine Nutzdatendatei (SLGA/SLLA, siehe builder.js) geht
// nie allein. Anhang 2 zur Anlage 1 TP5, §3.1 (Prüfstufe 1) verlangt, dass die
// Dateien "paarweise, d.h. Auftragsdatei und zugehörige Nutzdatei übermittelt"
// werden — fehlt die Auftragsdatei, wird bei der Datenannahmestelle bereits in
// der ersten Prüfstufe abgelehnt ("physikalische Lesbarkeit" + Paarigkeit).
//
// Format: EIN fester Satz von exakt 348 Byte, ISO 8859-1 (latin1), ohne
// Zeilenende. Quelle: wissensbank/gemeinsam/302-tp5/GGT_Anlage_02_Auftragsdatei.txt
// (Gültig ab 01.01.2025, Stand 10.10.2024) — Teil 1 "Allgemeine Beschreibung
// der Krankenkassen-Kommunikation" (Stellen 1-274) + Teil 2 "Bandverarbeitung"
// (211-226, überschneidet sich mit obiger Zählung nur scheinbar: die Felder
// aus Teil 2/3/4 liegen HINTER Stelle 274, siehe Tabelle unten — die Summe
// aller Feldlängen wurde gegen "LÄNGE_AUFTRAG = 00000348" geprüft und ergibt
// exakt 348).
//
// Kapsam (Konsey 2026-09-17, konsey/tutanak/2026-09-17-itsg-datenannahmestelle-test-yolu.md):
// NUR Erzeugung. Verschlüsselung (CMS EnvelopedData), Signatur und die
// tatsächliche Übermittlung an eine Datenannahmestelle sind bewusst NICHT
// Teil dieser Datei — VERSCHLÜSSELUNGSART/ELEKTRONISCHE_UNTERSCHRIFT stehen
// deshalb fest auf "00"/"00" (keine).

const ISO_8859_1_KENNUNG = 'I1';

// --- Feld-Helfer ------------------------------------------------------------
// Numerisches Feld: rechtsbündig, mit führenden Nullen aufgefüllt (Default-
// Wert-Regel aus GGT Anlage 2 §1.1 für Feldtyp N).
function n(value, len) {
  const s = String(value ?? '');
  if (!/^\d*$/.test(s)) {
    throw new Error(`numeric field expects only digits, got "${s}"`);
  }
  if (s.length > len) {
    throw new Error(`numeric field overflow: "${s}" (${s.length}) > ${len} Stellen`);
  }
  return s.padStart(len, '0');
}

// Alphanumerisches Feld: linksbündig, mit Leerzeichen aufgefüllt (Default-
// Wert-Regel aus GGT Anlage 2 §1.1 für Feldtyp A/AN). Kein stilles Abschneiden
// — ein zu langer Wert ist ein Programmierfehler, kein Datenproblem.
function an(value, len) {
  const s = String(value ?? '');
  if (s.length > len) {
    throw new Error(`alphanumeric field overflow: "${s}" (${s.length}) > ${len} Stellen`);
  }
  return s.padEnd(len, ' ');
}

const leer = (len) => ' '.repeat(len);

// DATUM_ERSTELLUNG braucht "JJJJMMTThhmmss" (14-stellig) — dieselbe UTC-
// Konvention wie `encoding.js#fmtDate`, nur mit Uhrzeit. Bewusst NICHT in
// encoding.js verschoben: dort wird nur YYYYMMDD gebraucht, ein zusätzlicher
// Export dort hätte keinen zweiten Aufrufer und würde die bestehenden Tests
// dieser Datei unnötig berühren.
function fmtDateTime14(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`invalid erstellungsdatum: "${d}"`);
  }
  const y  = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  const h  = String(dt.getUTCHours()).padStart(2, '0');
  const mi = String(dt.getUTCMinutes()).padStart(2, '0');
  const se = String(dt.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${da}${h}${mi}${se}`;
}

/**
 * Baut die Auftragsdatei (Auftragssatz Version 1.0) für eine Nutzdatendatei
 * nach § 294 ff. SGB V, Verfahrenskennung "SOL" (Sonstige Leistungserbringer —
 * GGT Anlage 4 §1.3).
 *
 * @param {object} opts
 * @param {string} opts.absenderIk           9-stelliges Absender-IK
 *   (Selbstabrechner — Praxura ist kein Abrechnungsdienstleister, die Praxis
 *   meldet unter eigener IK, siehe filename.js).
 * @param {string} opts.empfaengerIk         9-stelliges IK der
 *   Datenannahmestelle (= EMPFÄNGER_NUTZER, entschlüsselungsbefugt gemäß
 *   Kostenträgerdatei).
 * @param {string} opts.logischerDateiname   11-stelliger Name aus
 *   `filename.js#buildLogischerDateiname()` — MUSS identisch zur
 *   UNB-Anwendungsreferenz der zugehörigen Nutzdatei sein (Anhang 1 §4.2,
 *   GGT Anlage 2 Kap. 3.1 „Dateinamen").
 * @param {Date|string} opts.erstellungsdatum  Erstellungszeitpunkt der
 *   Nutzdatendatei (aus der die 14-stellige DATUM_ERSTELLUNG wird).
 * @param {number} opts.transfernummer       1–999 — DERSELBE Zähler wie in
 *   `filename.js#buildPhysikalischerDateiname()` (Anhang 1 §4.3).
 * @param {number} opts.nutzdateiByteLength  Byte-Länge der unverschlüsselten,
 *   unkomprimierten Nutzdatendatei (DATEIGRÖSSE_NUTZDATEN).
 * @param {'echt'|'test'|'erprobung'} [opts.kind='echt']  Wie in
 *   filename.js/builder.js — 'erprobung' zählt wie 'test' als Testdaten ("T"),
 *   die Unterscheidung Test/Erprobung steckt im UNB-Testindikator, nicht hier.
 * @param {number} [opts.uebertragungByteLength]  Byte-Länge NACH
 *   Verschlüsselung/Signatur/Komprimierung. Default = nutzdateiByteLength,
 *   weil heute keine dieser drei Transformationen angewendet wird.
 * @returns {string} exakt 348 Zeichen, ISO 8859-1.
 */
export function buildAuftragsdatei({
  absenderIk,
  empfaengerIk,
  logischerDateiname,
  erstellungsdatum,
  transfernummer,
  nutzdateiByteLength,
  kind = 'echt',
  uebertragungByteLength,
}) {
  if (!/^\d{9}$/.test(String(absenderIk || ''))) {
    throw new Error('absenderIk must be a 9-digit Institutionskennzeichen');
  }
  if (!/^\d{9}$/.test(String(empfaengerIk || ''))) {
    throw new Error('empfaengerIk must be a 9-digit Institutionskennzeichen');
  }
  if (!logischerDateiname || String(logischerDateiname).length !== 11) {
    throw new Error('logischerDateiname must be an 11-character string (see filename.js)');
  }
  const tnr = Number(transfernummer);
  if (!Number.isInteger(tnr) || tnr < 1 || tnr > 999) {
    throw new Error('transfernummer must be an integer in [1, 999]');
  }
  if (kind !== 'echt' && kind !== 'test' && kind !== 'erprobung') {
    throw new Error("kind must be 'echt', 'test' or 'erprobung'");
  }
  const groesseNutz = Number(nutzdateiByteLength);
  if (!Number.isInteger(groesseNutz) || groesseNutz < 0) {
    throw new Error('nutzdateiByteLength must be a non-negative integer');
  }
  const groesseUebertragung = uebertragungByteLength == null
    ? groesseNutz
    : Number(uebertragungByteLength);
  if (!Number.isInteger(groesseUebertragung) || groesseUebertragung < 0) {
    throw new Error('uebertragungByteLength must be a non-negative integer');
  }

  // Stelle 20: 'E' nur für Echtdaten. 'erprobung' zählt wie 'test' als 'T'
  // (Anhang 2 Kap. 9, §5/§6: die Test/Erprobung-Unterscheidung liegt im
  // UNB-Testindikator, nicht im Dateinamen bzw. hier im Auftragssatz).
  const echtBuchstabe = kind === 'echt' ? 'E' : 'T';
  const verfahrenKennung = `${echtBuchstabe}SOL0`; // Stellen 20-24, 5 Zeichen

  const felder = [
    an('500000', 6),                               //  1 IDENTIFIKATOR         01-06
    an('01', 2),                                    //  2 VERSION               07-08
    an('00000348', 8),                              //  3 LÄNGE_AUFTRAG         09-16
    n('0', 3),                                      //  4 SEQUENZ_NR            17-19 (keine Teillieferung)
    an(verfahrenKennung, 5),                        //  5 VERFAHREN_KENNUNG     20-24
    n(String(tnr), 3),                              //  6 TRANSFER_NUMMER       25-27
    leer(5),                                        //  7 VERFAHREN_KENNUNG_SPEZIFIKATION 28-32
    an(absenderIk, 15),                              //  8 ABSENDER_EIGNER       33-47
    an(absenderIk, 15),                              //  9 ABSENDER_PHYSIKALISCH 48-62 (Direktversand, kein RZ dazwischen)
    an(empfaengerIk, 15),                            // 10 EMPFÄNGER_NUTZER      63-77
    an(empfaengerIk, 15),                            // 11 EMPFÄNGER_PHYSIKALISCH 78-92 (Direktversand)
    n('0', 6),                                      // 12 FEHLER_NUMMER         93-98
    n('0', 6),                                      // 13 FEHLER_MASSNAHME      99-104
    an(logischerDateiname, 11),                      // 14 DATEINAME            105-115
    n(fmtDateTime14(erstellungsdatum), 14),          // 15 DATUM_ERSTELLUNG     116-129
    n('0', 14),                                     // 16 DATUM_ÜBERTRAGUNG_GESENDET       130-143 (noch nicht übermittelt)
    n('0', 14),                                     // 17 DATUM_ÜBERTRAGUNG_EMPFANGEN_START 144-157
    n('0', 14),                                     // 18 DATUM_ÜBERTRAGUNG_EMPFANGEN_ENDE  158-171
    an('000000', 6),                                // 19 DATEIVERSION          172-177 (ungenutzt lt. Spezifikation)
    an('0', 1),                                      // 20 KORREKTUR            178     (ungenutzt lt. Spezifikation)
    n(String(groesseNutz), 12),                      // 21 DATEIGRÖSSE_NUTZDATEN 179-190
    n(String(groesseUebertragung), 12),              // 22 DATEIGRÖSSE_ÜBERTRAGUNG 191-202
    an(ISO_8859_1_KENNUNG, 2),                       // 23 ZEICHENSATZ          203-204
    an('00', 2),                                     // 24 KOMPRIMIERUNG        205-206 (keine)
    an('00', 2),                                     // 25 VERSCHLÜSSELUNGSART  207-208 (keine — Kapsam dışı, s. o.)
    an('00', 2),                                     // 26 ELEKTRONISCHE_UNTERSCHRIFT 209-210 (keine — nur 00+00 oder 03+03 zulässig)
    leer(3),                                         // 27 SATZFORMAT           211-213 (DFÜ: Leerzeichen)
    an('00000', 5),                                  // 28 SATZLÄNGE            214-218 (DFÜ: Konstante)
    an('00000000', 8),                               // 29 BLOCKLÄNGE           219-226 (DFÜ: Konstante)
    ' ',                                             // 30 Status               227     (Anlieferung durch Abrechnungssystem: Leerzeichen)
    n('0', 2),                                       // 31 Wiederholung         228-229
    n('0', 1),                                       // 32 Übertragungsweg      230
    n('0', 10),                                      // 33 Verzögerter Versand  231-240
    n('0', 6),                                       // 34 Info und Fehlerfelder 241-246
    leer(28),                                        // 35 Variables Info-Feld  247-274
    leer(44),                                        // 36 E-MAIL-ADRESSE ABSENDER 275-318 (optional, hier ungenutzt)
    leer(30),                                        // 37 DATEI_BEZEICHNUNG    319-348 (optional, hier ungenutzt)
  ];

  const satz = felder.join('');
  if (satz.length !== 348) {
    // Verteidigungslinie gegen einen Implementierungsfehler in dieser Datei —
    // keine Spezifikationsverletzung, sondern ein Selbsttest.
    throw new Error(`internal error: Auftragssatz length ${satz.length} !== 348`);
  }
  return satz;
}
