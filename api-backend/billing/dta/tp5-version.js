// § 302 SGB V — Zentrale Versionssteuerung Anlage 1 TP5 (V21 → V22).
//
// Amtliche Quelle:
//   wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V22_20260521.txt (Stand 21.05.2026)
//   - Deckblatt: "Anzuwenden ab: 01.02.2027"
//   - Deckblatt: "Version 21 verliert Gültigkeit: 30.04.2027"
//   - Kap. 5.4 (UNH S009): SLGA:22:0:0 / SLLA:22:0:0 (ab 01.02.2027)
//   - Kap. 0 Historie + Kap. 5.5.3.3 (SLLA: B Heilmittel):
//     Alle fachlichen Änderungen in V22 betreffen ausschließlich Abschnitt 5.5.3.7
//     (Hebammen, § 301a SGB V). Heilmittel (SLLA: B) und SLGA sind inhaltlich
//     unverändert gegenüber V21; Anlage 3 V22 und Anhang 03 V10 betreffen bei
//     Heilmitteln ebenfalls keine Felder (nur Haushaltshilfe C0–C4).
//
// WICHTIG: Vor dem 01.02.2027 führt "22" zu Dateiablehnung; ab dem 01.05.2027
// führt "21" zu Dateiablehnung. Vom 01.02.2027 bis 30.04.2027 läuft die
// amtliche 3-monatige Übergangsfrist (beide Versionen zulässig).

import { berlinHeute, istStichtag } from '../../lib/berlin-tag.js';

/** Amtlicher Anwendungsbeginn Anlage 1 TP5 Version 22 (Deckblatt Stand 21.05.2026). */
export const TP5_V22_AB = '2027-02-01';

/** Letzter gültiger Tag für Anlage 1 TP5 Version 21 (Übergangsfrist Ende). */
export const TP5_V21_BIS = '2027-04-30';

/** Unterstützte UNH-Versionsnummern (SLGA/SLLA). */
export const TP5_UNTERSTUETZTE_VERSIONEN = Object.freeze(['21', '22']);

/**
 * Normalisiert ein Datum ('YYYY-MM-DD' oder Date/Timestamp) auf einen Berliner Kalendertag.
 * @param {string | Date | null | undefined} datum
 * @returns {string | null}
 */
function alsStichtagIso(datum) {
  if (!datum) return null;
  if (typeof datum === 'string') {
    const s = datum.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return istStichtag(s) ? s : null;
    if (/^\d{8}$/.test(s)) {
      const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      return istStichtag(iso) ? iso : null;
    }
  }
  const d = datum instanceof Date ? datum : new Date(datum);
  if (Number.isNaN(d.getTime())) return null;
  return berlinHeute(d);
}

/**
 * Ermittelt die zu erzeugende TP5-Versionsnummer ('21' oder '22') anhand des
 * Rechnungs-/Erstellungsdatums. Garantiert keine vorzeitige V22-Ausgabe vor 01.02.2027.
 *
 * @param {string | Date | null | undefined} stichtag
 * @returns {'21' | '22'}
 */
export function tp5VersionFuerDatum(stichtag) {
  const iso = alsStichtagIso(stichtag);
  if (!iso) return '21';
  return iso >= TP5_V22_AB ? '22' : '21';
}

/**
 * Prüft, ob eine gegebene UNH-Versionsnummer am angegebenen Stichtag (UNB-Erstellungsdatum)
 * laut GKV-SV-Übergangsregelung zulässig ist.
 *
 * - < 2027-02-01: nur '21'
 * - 2027-02-01 .. 2027-04-30: '21' und '22' (Übergangsfrist)
 * - > 2027-04-30: nur '22'
 *
 * @param {string | null | undefined} version
 * @param {string | Date | null | undefined} stichtag
 * @returns {boolean}
 */
export function tp5VersionZulaessig(version, stichtag) {
  const v = String(version || '').trim();
  if (!TP5_UNTERSTUETZTE_VERSIONEN.includes(v)) return false;
  const iso = alsStichtagIso(stichtag);
  if (!iso) return v === '21';
  if (iso < TP5_V22_AB) return v === '21';
  if (iso <= TP5_V21_BIS) return v === '21' || v === '22';
  return v === '22';
}
