// § 302 DTA-Dateinamen per ITSG (Anhang 1 zur Anlage 1 TP5, Kapitel 4
// "Datenübermittlung", Stand 31.08.2017, anzuwenden ab 01.09.2017).
//
// Zwei GETRENNTE Namen, keine Variante desselben Strings — das war der Fehler
// bis 10.09.2026 (gkv-302 Audit): ein einziger 16-stelliger `EHK`/`EHM`-String
// wurde sowohl als UNB-Anwendungsreferenz ALS AUCH als Storage-/Downloadname
// verwendet. Dieses Schema kommt in keiner §302-Spezifikation vor — der
// Empfänger hätte die ersten 11 Stellen als logischen Dateinamen gelesen und
// dabei mitten in der laufenden Nummer abgeschnitten.
//
// Logischer Dateiname (§4.2) — 11 Stellen, geht in UNB 0026 (Anwendungs-
// referenz) UND in die Auftragsdatei (Feld "Dateiname"), für ALLE
// Übertragungsmedien identisch:
//   Stellen 1–2:   "SL" (Sonstige Leistungserbringer)
//   Stellen 3–8:   Stellen 3 bis 8 des Absender-IK (6 Ziffern)
//   Stelle 9:      "S" (Selbstabrechner) oder "A" (Abrechnungsstelle)
//   Stellen 10–11: zweistelliger Abrechnungsmonat (z.B. "02" für Februar) —
//                  der Monat, in dem die Datei erstellt wird (Wortlaut der
//                  Spezifikation nennt keinen Leistungszeitraum).
//
// Physikalischer Dateiname (§4.3) — 8 Stellen, in der Auftragsdatei
// angegeben. HIER, nicht im logischen Namen, steckt die Test/Echt-Unter-
// scheidung:
//   Stelle 1:      "E" (Echtdaten) oder "T" (Testdaten) — Erprobung zählt als
//                  "T", die Unterscheidung Test/Erprobung steckt in UNB 0035
//                  (Testkennzeichen), nicht im Dateinamen.
//   Stellen 2–4:   "SOL" (Sonstige Leistungserbringer)
//   Stelle 5:      "0"
//   Stellen 6–8:   dreistellige Transfernummer (1–999)
//
// Referenzen:
//   wissensbank/gemeinsam/302-tp5/Anhang_01_Anlage_1_TP5_Kapitel_4_Datenuebermittlung_20170831.txt
//   Bindend gemacht durch Anlage 1 TP5 V21 (UNB 0026 verweist ausdrücklich
//   auf diesen Anhang).

/**
 * @param {object} opts
 * @param {string} opts.absenderIk        9-stelliges Institutionskennzeichen
 * @param {'S'|'A'} [opts.rolle]          'S' = Selbstabrechner (Standard —
 *   Praxura ist kein Abrechnungsdienstleister, die Praxis meldet unter
 *   eigener IK), 'A' nur für eine Abrechnungsstelle mit eigener IK.
 * @param {number} opts.abrechnungsmonat  1–12, der Monat der Dateierstellung
 */
export function buildLogischerDateiname({ absenderIk, rolle = 'S', abrechnungsmonat }) {
  const ik = String(absenderIk || '');
  if (!/^\d{9}$/.test(ik)) {
    throw new Error('absenderIk must be a 9-digit Institutionskennzeichen');
  }
  if (rolle !== 'S' && rolle !== 'A') {
    throw new Error("rolle must be 'S' (Selbstabrechner) or 'A' (Abrechnungsstelle)");
  }
  const monat = Number(abrechnungsmonat);
  if (!Number.isInteger(monat) || monat < 1 || monat > 12) {
    throw new Error('abrechnungsmonat must be an integer in [1, 12]');
  }
  // "Stellen 3 bis 8 des Absender-IK" — 1-indiziert, also Zeichen 3..8 ==
  // slice(2, 8) im 0-indizierten String.
  return `SL${ik.slice(2, 8)}${rolle}${String(monat).padStart(2, '0')}`;
}

/**
 * @param {object} opts
 * @param {'echt'|'test'|'erprobung'} [opts.kind]  'erprobung' zählt als
 *   Testdaten ("T") — §4.3 kennt nur E/T, die Erprobungsphase unterscheidet
 *   sich über UNB 0035, nicht über den Dateinamen.
 * @param {number} opts.transfernummer    1–999, fortlaufend je Absender
 */
export function buildPhysikalischerDateiname({ kind = 'echt', transfernummer }) {
  const t = Number(transfernummer);
  if (!Number.isInteger(t) || t < 1 || t > 999) {
    throw new Error('transfernummer must be an integer in [1, 999]');
  }
  const echtBuchstabe = kind === 'echt' ? 'E' : 'T';
  return `${echtBuchstabe}SOL0${String(t).padStart(3, '0')}`;
}

// Encrypted/signed variant: same (physikalischer) basename + .p7m
export function buildEncryptedFilename(base) {
  return `${base}.dta.p7m`;
}
