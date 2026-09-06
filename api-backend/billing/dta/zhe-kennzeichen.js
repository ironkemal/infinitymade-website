/**
 * zhe-kennzeichen.js — zwei ZHE-Felder, die aus unseren Spalten abgeleitet
 * werden statt gespeichert zu sein.
 *
 * Beide standen bisher an je zwei Stellen in `abrechnung.routes.js` fest
 * verdrahtet, und beide waren an beiden Stellen falsch. Ein fester Wert im
 * Rumpf einer Zuordnungsfunktion sieht harmlos aus — genau deshalb hat ihn
 * niemand gegen die Schluesseltabelle gehalten.
 */

import { VERORDNUNGSART_HEILMITTEL } from '../codes/anlage3_v22.js';

/**
 * Kennzeichen Verordnungsart bei Heilmitteln — Anlage 3 TP5 V21, § 8.1.12.
 *
 * Die Schluesseltabelle sagt woertlich: „01 = nicht belegt", „02 = nicht
 * belegt", „10 = nicht belegt", „11 = nicht belegt". Belegt sind nur
 *
 *   03  § 7 Abs. 1-5 HeilM-RL — orientierende Behandlungsmenge (Regelfall)
 *   04  § 7 Abs. 6 HeilM-RL   — besonderer Verordnungsbedarf / langfristiger
 *                               Heilmittelbedarf bis zu 12 Wochen
 *   05  § 13a HeilM-RL        — Blankoverordnung
 *
 * Was vorher hier stand, hatte zwei verschieden schlimme Folgen:
 *
 *   '01' / '02'  Der Preflight (V:01004) laesst sie nicht durch, die Datei
 *                wird gar nicht erst erzeugt. Laut, aber ehrlich — und der
 *                Grund, warum die Podologie ueberhaupt nicht abrechnen konnte
 *                (dort stand '01' fest im Rumpf).
 *   Blanko '04'  Kommt durch den Preflight, behauptet der Kasse gegenueber
 *                aber „langfristiger Heilmittelbedarf" statt
 *                „Blankoverordnung". Ein stiller Falschwert, die gefaehrlichere
 *                Sorte: die Datei wird angenommen und ist trotzdem unwahr.
 *
 * Reihenfolge ist Absicht: eine Blankoverordnung ist zuerst eine
 * Blankoverordnung. Waeren beide Haken gesetzt, gewinnt § 13a.
 *
 * @param {{is_blanko?:boolean, is_lhb_bvb?:boolean}} rx
 * @returns {'03'|'04'|'05'}
 */
export function verordnungsartFuer(rx) {
  if (rx?.is_blanko)  return '05';
  if (rx?.is_lhb_bvb) return '04';
  return '03';
}

/**
 * Heilmittel-Bereich im ZHE-Segment — Anlage 1 TP5 V21, Kap. 5.5.3.3, S. 71.
 *
 *   1 = Physiotherapie
 *   2 = Podologische Therapie
 *   3 = Stimm-, Sprech-, Sprach- und Schlucktherapie
 *   4 = Ergotherapie
 *   5 = Ernaehrungstherapie
 *
 * Die Podologie schickte bisher '5' — das ist Ernaehrungstherapie. Und der
 * gemeinsame Mapper schrieb fuer JEDEN Fachbereich '1', also auch fuer Ergo
 * und Logo, obwohl er den Sektor als Parameter schon bekam.
 *
 * Ernaehrungstherapie hat bei uns keinen Schluessel, weil wir sie nicht
 * anbieten (CLAUDE.md: Physio · Ergo · Logo · Podo). Taucht sie eines Tages
 * auf, faellt sie hier auf und nicht erst bei der Kasse.
 *
 * @param {string} sector  Wert aus `profiles.sector`
 * @returns {'1'|'2'|'3'|'4'}
 */
export function heilmittelBereichFuer(sector) {
  switch (sector) {
    case 'podologie':   return '2';
    case 'logopaedie':  return '3';
    case 'ergotherapie': return '4';
    // Unbekannt wie Physio zu behandeln ist die Linie, die `legsFuerSector()`
    // schon zieht — beide muessen dieselbe Annahme treffen, sonst passen
    // Abrechnungscode und Heilmittel-Bereich in derselben Datei nicht zusammen.
    default:            return '1';
  }
}

/** Nur fuer Tests und Aufrufer, die den Klartext anzeigen wollen. */
export function verordnungsartText(schluessel) {
  return VERORDNUNGSART_HEILMITTEL[schluessel] || null;
}
