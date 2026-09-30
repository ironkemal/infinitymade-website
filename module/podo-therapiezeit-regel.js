/**
 * podo-therapiezeit-regel.js — Therapiezeit → Behandlungsposition bei c) Komplexbehandlung.
 *
 * Konsey S0 2b (30.09.2026) + gkv-302 (wissensbank/SPEC-RULES.md „Maßnahme ≠ Leistung", Z. 167-173;
 * Anlage 1a Podologie Teil 2, FAK Podologie Q25):
 *   Ist c) Podologische Komplexbehandlung verordnet, hängt die Position an der Therapiezeit
 *   DIESES Tages:  > 20 min → 78020 („Behandlung groß")  ·  ≤ 20 min → 78010 („klein").
 *   a)/b) sind immer 78010 (die Sperre gegen 78020 sitzt in podologie-abrechnung.js).
 * Deshalb ist die Zeit bei c) Pflicht und die Position wird daraus abgeleitet — sonst läuft die
 * Differenz später als Retaxation zurück. Die Dauer steht in `podologie_behandlungen.therapiezeit_min`
 * (smallint 1..600, NULL = nicht erfasst; Migration 0047).
 *
 * Rein, ohne DOM — node-testbar. Die Maske (podologie-abrechnung.js) ruft nur auf.
 */

/** Grenze: strikt ÜBER 20 Minuten → 78020. Genau 20 ist noch 78010. */
export const GROSS_AB_MINUTEN = 20;
export const MINUTEN_MAX = 600;   // = CHECK-Constraint podologie_behandlungen_therapiezeit_check

/**
 * Feldwert → ganze Minuten 1..600 oder null (leer/ungültig/Komma/Text).
 * @param {*} roh
 * @returns {?number}
 */
export function therapiezeitWert(roh) {
  if (roh === null || roh === undefined || String(roh).trim() === '') return null;
  const n = Number(String(roh).trim());
  return Number.isInteger(n) && n >= 1 && n <= MINUTEN_MAX ? n : null;
}

/**
 * Position aus der Therapiezeit (nur für c) gültig).
 * @returns {'78010'|'78020'|''}  '' bei fehlender/ungültiger Zeit
 */
export function positionAusTherapiezeit(minuten) {
  const m = therapiezeitWert(minuten);
  if (m === null) return '';
  return m > GROSS_AB_MINUTEN ? '78020' : '78010';
}

/** Ist die Zeit Pflicht? c) verordnet UND eine Behandlungsposition (78010/78020) angekreuzt. */
export function therapiezeitPflicht(massnahme, checks) {
  return massnahme === 'c' && (checks || []).some((c) => c === '78010' || c === '78020');
}

/**
 * Prüfung beim Speichern. Leerer String = in Ordnung.
 * @param {{massnahme:string, checks:string[], minuten:*}} p
 */
export function therapiezeitFehler({ massnahme, checks, minuten }) {
  if (!therapiezeitPflicht(massnahme, checks)) return '';
  const soll = positionAusTherapiezeit(minuten);
  if (!soll) {
    return `Bei Komplexbehandlung (c) bitte die Therapiezeit in Minuten angeben (1–${MINUTEN_MAX}) — `
      + 'daraus ergibt sich 78010 (bis 20 Minuten) oder 78020 (über 20 Minuten).';
  }
  const gewaehlt = (checks || []).filter((c) => c === '78010' || c === '78020');
  if (gewaehlt.length !== 1 || gewaehlt[0] !== soll) {
    const m = therapiezeitWert(minuten);
    return `Bei ${m} Minuten Therapiezeit ist ${soll} abzurechnen`
      + (soll === '78020' ? ' (über 20 Minuten)' : ' (bis 20 Minuten)')
      + ` — bitte ${soll === '78020' ? '78010' : '78020'} abwählen und ${soll} wählen.`;
  }
  return '';
}

/**
 * Was gespeichert wird: Minuten bei c), sonst NULL.
 * @returns {?number}
 */
export function therapiezeitFuerSpeichern(massnahme, minuten) {
  return massnahme === 'c' ? therapiezeitWert(minuten) : null;
}
