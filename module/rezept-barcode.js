/**
 * rezept-barcode.js — KBV-BFB-konformer Barcode-Parser für Muster 13 (Muster 13/E).
 *
 * Spezifikation:
 * - KBV ITA VGEX Technisches Handbuch Blankoformularbedruckung (BFB) Version 4.80 (13. Mai 2026),
 *   § 2.4 (Dynamische Erzeugung des Barcodes, TAB-Trenner),
 *   § 2.10 (Zeichensatz ISO 8859-15),
 *   § 3.11.1 (Barcode Inhalt Muster 13/E, Version 10, 33 Felder, max. Gesamtlänge 425 + 32 Tabs = 457).
 *
 * Sicherheits- und Datenschutzregeln:
 * - Reines Modul: Kein DOM, kein Netzwerk.
 * - Keine Patienten- oder Formulardaten (PII / Payload) in Fehlermeldungen — nur generische deutsche Fehler.
 * - Strikter Zeichensatz: Nur ASCII druckbar und ISO 8859-15 graphische Zeichen; TAB als einziger Trenner.
 *   Die in ISO 8859-15 gegenüber Latin-1 ersetzten Währungs-/Sonderzeichen (A4, A6, A8, B4, B8, BC, BD, BE)
 *   sind explizit ausgeschlossen; deren 8 Nachfolger (€, Š, š, Ž, ž, Œ, œ, Ÿ) sind erlaubt.
 * - Steuerzeichen, HTML-Tags und Injektionszeichen werden strikt abgewiesen.
 * - Exakt 33 Felder: Vor dem Trimmen wird für alle 33 Felder die maximal zulässige Feldlänge geprüft.
 * - Ein leeres Feld 33 führt legitim zu einem abschließenden TAB — dies ist die Pflicht-Trennsequenz.
 * - Fail-closed: Mehrere Heilmittelzeilen oder ergänzendes Heilmittel führen bei Podologie (v1)
 *   zum Abbruch mit Verweis auf manuelle Erfassung.
 */

'use strict';

import { pruefeKvnr } from './kvnr.js?v=20260814';
import { podologiePositionFuerText } from './podologie-heilmittel-position.js';

export const PARSER_VERSION = 'KBV-BFB-4.80-M13-10';
export const BARCODE_FORMAT = 'PDF417';
export const BARCODE_QUELLE = 'barcode';

// ISO 8859-15 Zeichensatz (inkl. TAB 0x09 und Leerzeichen 0x20):
// \x20-\x7E: ASCII druckbar
// Latin-1-Bereiche ohne die 8 ersetzten Zeichen (A4=¤, A6=¦, A8=¨, B4=´, B8=¸, BC=¼, BD=½, BE=¾):
// \u00A0-\u00A3, \u00A5, \u00A7, \u00A9-\u00B3, \u00B5-\u00B7, \u00B9-\u00BB, \u00BF-\u00FF
// Die 8 ISO 8859-15-Ersatzzeichen:
// \u0152 (Œ), \u0153 (œ), \u0160 (Š), \u0161 (š), \u017D (Ž), \u017E (ž), \u0178 (Ÿ), \u20AC (€)
const ISO_8859_15_REGEX = /^[\t\x20-\x7E\u00A0-\u00A3\u00A5\u00A7\u00A9-\u00B3\u00B5-\u00B7\u00B9-\u00BB\u00BF-\u00FF\u0152\u0153\u0160\u0161\u017D\u017E\u0178\u20AC]*$/;

// Maximale Gesamtlänge laut KBV-Vorgabe (425 Zeichen Nutzdaten + 32 TABs)
const MAX_BARCODE_LAENGE = 457;

// Maximal zulässige Feldlängen (vor dem Trimmen) für alle 33 Felder
const MAX_FELD_LAENGEN = Object.freeze([
  2,  // 01 Formularcode
  1,  // 02 Formularcodeergänzung
  2,  // 03 Versionsnummer
  45, // 04 Nachname
  45, // 05 Vorname
  8,  // 06 Geburtsdatum
  8,  // 07 Versicherungsschutz Ende
  9,  // 08 Kostenträgerkennung
  12, // 09 Versicherten-ID
  1,  // 10 Versichertenart
  2,  // 11 Besondere Personengruppe
  2,  // 12 DMP-Kennzeichnung
  9,  // 13 BSNR
  9,  // 14 LANR
  8,  // 15 Ausstellungsdatum
  1,  // 16 Heilmittelart
  10, // 17 ICD-10
  10, // 18 ICD-10-2
  3,  // 19 Diagnosegruppe
  3,  // 20 Leitsymptomatik
  1,  // 21 patientenindividuelle Leitsymptomatik
  51, // 22 Erstes Heilmittel
  3,  // 23 Einheiten Erstes Heilmittel
  51, // 24 Zweites Heilmittel
  3,  // 25 Einheiten Zweites Heilmittel
  51, // 26 Drittes Heilmittel
  3,  // 27 Einheiten Drittes Heilmittel
  51, // 28 Ergänzendes Heilmittel
  3,  // 29 Einheiten Ergänzendes Heilmittel
  15, // 30 Therapiefrequenz
  1,  // 31 Therapiebericht
  1,  // 32 Hausbesuch
  1,  // 33 Dringlicher Behandlungsbedarf
]);

/**
 * Prüft und formatiert ein achtstelliges Datum (JJJJMMTT).
 * Liefert das ISO-Format 'YYYY-MM-DD' oder null bei ungültigem Kalenderdatum.
 */
function parseKalenderdatum(datumStr) {
  if (!/^\d{8}$/.test(datumStr)) return null;
  const y = parseInt(datumStr.slice(0, 4), 10);
  const m = parseInt(datumStr.slice(4, 6), 10);
  const d = parseInt(datumStr.slice(6, 8), 10);
  if (y < 1880 || y > 2100 || m < 1 || m > 12 || d < 1) return null;

  const istSchaltjahr = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  const tageImMonat = [31, istSchaltjahr ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d > tageImMonat[m - 1]) return null;

  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/**
 * Parst und validiert den dekodierten Text eines Muster-13-PDF417-Barcodes.
 *
 * @param {string} text  Dekodierter Barcode-Inhalt
 * @returns {{
 *   parsed: {
 *     patient: {
 *       first_name: string|null,
 *       last_name: string|null,
 *       geburtsdatum: string|null,
 *       versichertennummer: string|null,
 *       versichertenstatus: string|null,
 *       krankenkasse_ik: string|null
 *     },
 *     arzt: {
 *       bsnr: string|null,
 *       lanr: string|null,
 *       ausstellungsdatum: string|null
 *     },
 *     rezept: {
 *       therapiebereich: 'podo',
 *       heilmittel: string|null,
 *       heilmittel_feld_text: string|null,
 *       anzahl_einheiten: number|null,
 *       icd10: string|null,
 *       icd10_2: string|null,
 *       diagnosegruppe: string|null,
 *       leitsymptomatik: string|null,
 *       pat_leitsymptomatik: string|null,
 *       frequenz: string|null,
 *       is_dringend: boolean,
 *       hausbesuch: boolean|null,
 *       bericht_angefordert: boolean,
 *       ergaenzendes_heilmittel: string|null,
 *       anzahl_ergaenzend: number|null,
 *       heilmittel_position: string|null,
 *       is_blanko: boolean,
 *       is_lhb_bvb: null,
 *       zuzahlung_befreit: null,
 *       diagnose_text: string|null,
 *       therapieziele: string|null,
 *       unterschrift_vorhanden: null,
 *       signature_confidence: null
 *     }
 *   },
 *   quelle: 'barcode',
 *   format: 'PDF417',
 *   parser_version: 'KBV-BFB-4.80-M13-10',
 *   hinweise: string[],
 *   heilmittelItems: Array<{ text: string, einheiten: number }>
 * }}
 */
export function parseMuster13Barcode(text) {
  if (typeof text !== 'string') {
    throw new Error('Ungültiger Barcode-Inhalt: Text erwartet');
  }

  if (text.length > MAX_BARCODE_LAENGE) {
    throw new Error('Barcode-Inhalt überschreitet die maximale Gesamtlänge');
  }

  // Steuerzeichen ablehnen (nur TAB 0x09 ist als Feldtrenner erlaubt)
  if (/[\x00-\x08\x0A-\x1F\x7F-\x9F]/.test(text)) {
    throw new Error('Barcode enthält unzulässige Steuerzeichen');
  }

  // HTML-Tags und Injektionszeichen strikt abweisen
  if (/[<>]/.test(text)) {
    throw new Error('Barcode enthält unzulässige HTML- oder Injektionszeichen');
  }

  // ISO 8859-15 Zeichensatzprüfung (mit Ausschluss der 8 ersetzten Latin-1-Zeichen)
  if (!ISO_8859_15_REGEX.test(text)) {
    throw new Error('Barcode enthält Zeichen außerhalb des zulässigen Zeichensatzes (ISO 8859-15)');
  }

  const fields = text.split('\t');
  if (fields.length !== 33) {
    throw new Error('Ungültiges Barcode-Format: Unerwartete Feldanzahl');
  }

  // Strikte Längenprüfung vor dem Trimmen für alle 33 Felder
  for (let i = 0; i < 33; i++) {
    if (fields[i].length > MAX_FELD_LAENGEN[i]) {
      throw new Error('Barcode-Feld überschreitet maximal zulässige Feldlänge');
    }
  }
  // KBV type n means raw digits, not a trimmed textual number.
  for(const index of [0,2,5,6,7,9,10,11,12,13,14,15,20,22,24,26,28,30,31,32]) {
    if(!/^\d*$/.test(fields[index])) throw new Error('Numerisches Barcode-Feld enthält unzulässige Zeichen');
  }

  const hinweise = [];

  // Feld 01: Formularcode (2 n = '13')
  if (fields[0] !== '13') {
    throw new Error('Ungültiger Formularcode: Nur Muster 13 wird unterstützt');
  }

  // Feld 02: Formularcodeergänzung (a <= 1, optional / blank zulässig)
  // Länge bereits <= 1 geprüft

  // Feld 03: Versionsnummer (2 n = '10')
  if (fields[2] !== '10') {
    throw new Error('Nicht unterstützte Formularversion: Version 10 erwartet');
  }

  // Feld 04: Nachname (<= 45 a, Pflichtfeld)
  const nachname = fields[3].trim();
  if (!nachname) {
    throw new Error('Nachname des Patienten fehlt');
  }

  // Feld 05: Vorname (<= 45 a, Pflichtfeld)
  const vorname = fields[4].trim();
  if (!vorname) {
    throw new Error('Vorname des Patienten fehlt');
  }

  // Feld 06: Geburtsdatum (8 n: JJJJMMTT, JJJJMM00, JJJJ0000, 00000000)
  const gebRoh = fields[5].trim();
  if (!/^\d{8}$/.test(gebRoh)) {
    throw new Error('Ungültiges Geburtsdatum-Format');
  }
  let geburtsdatum = null;
  if (gebRoh === '00000000') {
    hinweise.push('Geburtsdatum im Barcode ist unvollständig (00000000). Bitte manuell ergänzen.');
  } else if (gebRoh.endsWith('0000')) {
    const y = parseInt(gebRoh.slice(0, 4), 10);
    if (y < 1880 || y > 2100) throw new Error('Ungültiges Geburtsjahr');
    hinweise.push('Geburtsdatum im Barcode enthält nur das Geburtsjahr. Bitte manuell ergänzen.');
  } else if (gebRoh.endsWith('00')) {
    const y = parseInt(gebRoh.slice(0, 4), 10);
    const m = parseInt(gebRoh.slice(4, 6), 10);
    if (y < 1880 || y > 2100 || m < 1 || m > 12) throw new Error('Ungültiger Geburtsmonat');
    hinweise.push('Geburtsdatum im Barcode enthält keinen Tag. Bitte manuell ergänzen.');
  } else {
    geburtsdatum = parseKalenderdatum(gebRoh);
    if (!geburtsdatum) {
      throw new Error('Ungültiges Geburtsdatum');
    }
  }

  // Feld 07: Versicherungsschutz Ende (8 n optional full JJJJMMTT)
  const versEndeRoh = fields[6].trim();
  if (versEndeRoh) {
    if (!/^\d{8}$/.test(versEndeRoh) || !parseKalenderdatum(versEndeRoh)) {
      throw new Error('Ungültiges Datum für Ende des Versicherungsschutzes');
    }
  }

  // Feld 08: Kostenträgerkennung (9 n, Karten-IK)
  const kartenIk = fields[7].trim();
  if (!/^\d{9}$/.test(kartenIk)) {
    throw new Error('Kostenträgerkennung (Karten-IK) muss genau 9 Ziffern lang sein');
  }

  // Feld 09: Versicherten-ID (<= 12 a)
  let versichertennummer = null;
  const kvnrRoh = fields[8].trim().toUpperCase();
  if (kvnrRoh) {
    if (/^[A-Z]\d{9}$/.test(kvnrRoh)) {
      const pruefung = pruefeKvnr(kvnrRoh);
      if (!pruefung.ok) {
        throw new Error('Prüfziffer der Versichertennummer rechnerisch ungültig');
      }
      versichertennummer = kvnrRoh;
    } else if (/^[A-Z0-9]{1,12}$/.test(kvnrRoh)) {
      versichertennummer = kvnrRoh;
    } else {
      throw new Error('Versichertennummer enthält unzulässige Zeichen');
    }
  }

  // Feld 10: Versichertenart (1 n, 1/3/5, optional)
  const statusRoh = fields[9].trim();
  let versichertenstatus = null;
  if (statusRoh) {
    if (!['1', '3', '5'].includes(statusRoh)) {
      throw new Error('Ungültige Versichertenart: 1, 3 oder 5 erwartet');
    }
    versichertenstatus = statusRoh;
  }

  // Feld 11: Besondere Personengruppe (2 n: 00, 04, 06, 07, 08, 09, optional)
  const gruppeRoh = fields[10].trim();
  if (gruppeRoh && !['00', '04', '06', '07', '08', '09'].includes(gruppeRoh)) {
    throw new Error('Ungültige Besondere Personengruppe');
  }

  // Feld 12: DMP-Kennzeichnung (2 n: 00..13 oder 30..58, optional)
  const dmpRoh = fields[11].trim();
  if (dmpRoh) {
    if (!/^\d{2}$/.test(dmpRoh)) throw new Error('Ungültige DMP-Kennzeichnung');
    const dmp = parseInt(dmpRoh, 10);
    if (!((dmp >= 0 && dmp <= 13) || (dmp >= 30 && dmp <= 58))) {
      throw new Error('Ungültige DMP-Kennzeichnung');
    }
  }

  // Feld 13: (Neben-)Betriebsstättennummer (9 n, optional)
  const bsnrRoh = fields[12].trim();
  let bsnr = null;
  if (bsnrRoh) {
    if (!/^\d{9}$/.test(bsnrRoh)) throw new Error('Betriebsstättennummer muss 9 Ziffern lang sein');
    bsnr = bsnrRoh;
  }

  // Feld 14: LANR (9 n, optional)
  const lanrRoh = fields[13].trim();
  let lanr = null;
  if (lanrRoh) {
    if (!/^\d{9}$/.test(lanrRoh)) throw new Error('LANR muss 9 Ziffern lang sein');
    lanr = lanrRoh;
  }

  // Feld 15: Ausstellungsdatum (8 n JJJJMMTT, Pflichtfeld)
  const ausstRoh = fields[14].trim();
  const ausstellungsdatum = parseKalenderdatum(ausstRoh);
  if (!ausstellungsdatum) {
    throw new Error('Ungültiges oder unvollständiges Ausstellungsdatum');
  }

  // Feld 16: Heilmittelart (1 n, 1..5 — für v1 M3 nur 2 = Podologie zulässig)
  const sektor = fields[15].trim();
  if (sektor !== '2') {
    throw new Error('Nur Podologie-Verordnungen (Heilmittelart 2) werden unterstützt');
  }

  // Feld 17: ICD-10-GM-Code (<= 10 a)
  let icd10 = null;
  const icd1Roh = fields[16].trim();
  if (icd1Roh) {
    if (!/^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?(\s+[GVZA](\s+[RLB])?)?$/.test(icd1Roh)) {
      throw new Error('Ungültiges Format für ersten ICD-10-Code');
    }
    icd10 = icd1Roh;
  }

  // Feld 18: Zweiter ICD-10-GM-Code (<= 10 a)
  let icd10_2 = null;
  const icd2Roh = fields[17].trim();
  if (icd2Roh) {
    if (!/^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?(\s+[GVZA](\s+[RLB])?)?$/.test(icd2Roh)) {
      throw new Error('Ungültiges Format für zweiten ICD-10-Code');
    }
    icd10_2 = icd2Roh;
  }

  // Feld 19: Diagnosegruppe (<= 3 a)
  let diagnosegruppe = null;
  const dgRoh = fields[18].trim();
  if (dgRoh) {
    if (!/^[A-Z0-9]{1,3}$/.test(dgRoh)) {
      throw new Error('Ungültiges Format für Diagnosegruppe');
    }
    diagnosegruppe = dgRoh;
  }

  // Feld 20: Leitsymptomatik (<= 3 a: a, b, c, ab, bc, ac, abc)
  let leitsymptomatik = null;
  const lsRoh = fields[19].trim().toLowerCase();
  if (lsRoh) {
    if (!['a', 'b', 'c', 'ab', 'bc', 'ac', 'abc'].includes(lsRoh)) {
      throw new Error('Ungültige Leitsymptomatik');
    }
    leitsymptomatik = lsRoh;
  }

  // Feld 21: patientenindividuelle Leitsymptomatik (1 n = 1 oder leer)
  let pat_leitsymptomatik = null;
  const patLs = fields[20].trim();
  if (patLs === '1') {
    // This is a checkbox marker, not the clinical free text expected by the mask.
    hinweise.push('Patientenindividuelle Leitsymptomatik angekreuzt. Bitte den Text vom Papier ergänzen.');
  } else if (patLs !== '') {
    throw new Error('Ungültiger Wert für patientenindividuelle Leitsymptomatik');
  }

  // Felder 22 bis 29: Heilmittelzeilen & Behandlungseinheiten
  // In Podologie gibt es keine Aufteilung auf mehrere vorrangige Heilmittel und kein ergänzendes Heilmittel (§ 12 Abs. 2 HeilM-RL).
  // Mehrere befüllte Zeilen müssen geschlossen abgewiesen werden (fail-closed -> manuelle Erfassung).
  const f24 = fields[23].trim();
  const f25 = fields[24].trim();
  const f26 = fields[25].trim();
  const f27 = fields[26].trim();
  const f28 = fields[27].trim();
  const f29 = fields[28].trim();
  if (f24 || f25 || f26 || f27 || f28 || f29) {
    throw new Error('Mehrere Heilmittelzeilen oder ergänzendes Heilmittel in Podologie nicht zulässig');
  }

  const f22 = fields[21].trim();
  const f23 = fields[22].trim();
  if (!f22) {
    throw new Error('Heilmittel fehlt');
  }
  if (!f23 || !/^\d{1,3}$/.test(f23)) {
    throw new Error('Ungültige Anzahl von Behandlungseinheiten');
  }
  const einheiten = parseInt(f23, 10);
  if (einheiten <= 0) {
    throw new Error('Behandlungseinheiten müssen größer als 0 sein');
  }

  const heilmittel = f22;
  const heilmittel_feld_text = f22;
  const anzahl_einheiten = einheiten;
  const heilmittel_position = podologiePositionFuerText(f22);
  if(!heilmittel_position) hinweise.push('Heilmittelposition nicht eindeutig. Bitte passende Position von Hand wählen.');
  const heilmittelItems = [{ text: f22, einheiten }];

  // Feld 30: Therapiefrequenz (<= 15 a, optional)
  let frequenz = null;
  if (fields[29].trim()) {
    frequenz = fields[29].trim();
  }

  // Feld 31: Therapiebericht (1 n = 1 oder leer)
  let bericht_angefordert = false;
  const bericht = fields[30].trim();
  if (bericht === '1') {
    bericht_angefordert = true;
  } else if (bericht !== '') {
    throw new Error('Ungültiger Wert für Therapiebericht');
  }

  // Feld 32: Hausbesuch (1 n = 0, 1 oder leer)
  // Fehlt die Angabe, darf nicht fälschlich "false" behauptet werden.
  let hausbesuch = null;
  const hb = fields[31].trim();
  if (hb === '1') {
    hausbesuch = true;
  } else if (hb === '0') {
    hausbesuch = false;
  } else if (hb === '') {
    hausbesuch = null;
    hinweise.push('Angabe zum Hausbesuch fehlt im Barcode. Bitte manuell bestätigen.');
  } else {
    throw new Error('Ungültiger Wert für Hausbesuch');
  }

  // Feld 33: Dringlicher Behandlungsbedarf innerhalb von 14 Tagen (1 n = 1 oder leer)
  let is_dringend = false;
  const dringend = fields[32].trim();
  if (dringend === '1') {
    is_dringend = true;
  } else if (dringend !== '') {
    throw new Error('Ungültiger Wert für dringlichen Behandlungsbedarf');
  }
  hinweise.push('Zuzahlungsbefreiung, langfristiger Heilmittelbedarf und besondere Verordnungsbedarfe stehen nicht im Barcode. Bitte am Papier prüfen.');

  return {
    parsed: {
      patient: {
        first_name: vorname,
        last_name: nachname,
        geburtsdatum,
        versichertennummer,
        versichertenstatus,
        krankenkasse_ik: kartenIk,
      },
      arzt: {
        bsnr,
        lanr,
        ausstellungsdatum,
      },
      rezept: {
        therapiebereich: 'podo',
        heilmittel,
        heilmittel_feld_text,
        anzahl_einheiten,
        icd10,
        icd10_2,
        diagnosegruppe,
        leitsymptomatik,
        pat_leitsymptomatik,
        frequenz,
        is_dringend,
        hausbesuch,
        bericht_angefordert,
        ergaenzendes_heilmittel: null,
        anzahl_ergaenzend: null,
        heilmittel_position,
        is_blanko: false,
        is_lhb_bvb: null,
        zuzahlung_befreit: null,
        diagnose_text: null,
        therapieziele: null,
        unterschrift_vorhanden: null,
        signature_confidence: null,
      },
    },
    quelle: BARCODE_QUELLE,
    format: BARCODE_FORMAT,
    parser_version: PARSER_VERSION,
    hinweise,
    heilmittelItems,
  };
}
