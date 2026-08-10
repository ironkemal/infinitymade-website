// Zentrale Preis- und Zuzahlungsauflösung für alle Abrechnungswege.
//
// Warum es diese Datei gibt (Aufgabe 2 der Loop-Liste "Kassieren"):
// Vorher holten die gedruckte Patientenrechnung und die §302-Datei an die Kasse
// ihre Beträge auf getrennten Wegen — die Druckrouten fragten `heilmittel_tarif`
// gar nicht ab, die §302-Route schon. Ein geänderter Tarif in der DB liess beide
// auseinanderlaufen: der Patient bekam eine Rechnung über einen anderen Betrag,
// als die Kasse gemeldet bekam. Ab jetzt ruft jeder Weg `resolvePreis()`.
//
// Entscheidung Melih, 10.08.2026: Der Katalog gewinnt. `heilmittel_tarif` bleibt
// bestehen, wird aber nur noch als optionaler Preis-Override für Physio gelesen.
// Die Zuzahlung kommt IMMER aus dem Katalog bzw. aus der 10-%-Regel — nie aus
// dem Ja/Nein-Feld `zuzahlung_pflicht`, das die exakten veröffentlichten Beträge
// verlor (Podologie 78010 = 3,52 €, nicht "irgendwie 10 %").
//
// Quellen der Preise:
//   Podologie → billing/codes/podologie_positions.js  (GKV Anlage 2, zwei Preisfenster)
//   Physio    → billing/codes/physio_positions.js     (Bundesvertrag §125, ein Preisfenster)

import { findPosition } from '../codes/physio_positions.js';
import { findPodologiePosition } from '../codes/podologie_positions.js';
import { resolvePositionZuzahlung } from '../zuzahlung/calculator.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Sucht im optionalen `heilmittel_tarif`-Abzug den für dieses Datum gültigen Satz.
 * Bewusst identisch zur bisherigen Logik in abrechnung.routes.js, damit der Umbau
 * am DB-Zweig nichts verändert.
 */
export function findTarifForDate(tariffs, positionsnummer, dateStr) {
  if (!Array.isArray(tariffs) || tariffs.length === 0) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  return tariffs.find(t => {
    if (t.position_nr !== positionsnummer) return false;
    const ab = new Date(t.gueltig_ab);
    const bis = t.gueltig_bis ? new Date(t.gueltig_bis) : null;
    return target >= ab && (!bis || target <= bis);
  }) || null;
}

/**
 * Löst Preis und Zuzahlung einer Position für ein Leistungsdatum auf.
 *
 * @param {object}  opts
 * @param {string}  opts.bereich          'podologie' | 'physiotherapie'
 * @param {string}  opts.code             gespeicherter Code ('X0501' oder '78010')
 * @param {string}  [opts.datum]          Leistungsdatum ISO. Ohne Angabe: heute bzw.
 *                                        aktuellstes Preisfenster.
 * @param {string}  [opts.abrechnungscode='22']
 * @param {Array}   [opts.tariffs]        Zeilen aus heilmittel_tarif (nur Physio)
 * @param {string}  [opts.positionsnummer] aufgelöste Nr. für den Tarif-Abgleich
 *
 * @returns {{
 *   preis_eur: number, zuzahlung_eur: number, position_frei: boolean,
 *   gefunden: boolean, quelle: string, ausserhalb_preisfenster: boolean,
 *   katalogPosition: object|null
 * }}
 */
export function resolvePreis({
  bereich,
  code,
  datum = null,
  abrechnungscode = '22',
  tariffs = null,
  positionsnummer = null,
} = {}) {
  const istPodologie = String(bereich || '').toLowerCase() === 'podologie';

  // 1. Katalogposition — sie entscheidet immer über die Zuzahlung.
  const katalogPosition = istPodologie
    ? findPodologiePosition(code, datum || undefined)
    : findPosition(code, abrechnungscode, datum);

  // 2. Preis. Für Physio darf ein DB-Tarif den Katalogpreis übersteuern
  //    (regionale Vereinbarung). Podologie kennt keinen Tarif-Override.
  let preis_eur = r2(katalogPosition?.preis ?? 0);
  let quelle = katalogPosition ? 'katalog' : 'unbekannt';

  if (!istPodologie && tariffs && datum) {
    const tarif = findTarifForDate(tariffs, positionsnummer || code, datum);
    if (tarif) {
      preis_eur = r2(tarif.preis_eur);
      quelle = 'heilmittel_tarif';
    }
  }

  // 3. Zuzahlung — immer über den Katalog.
  //    Zuzahlungsfreie Positionen bleiben frei, egal woher der Preis kam.
  //    Kam der Preis aus dem Katalog, gilt der dort veröffentlichte exakte Betrag.
  //    Hat ein DB-Tarif den Preis übersteuert, wäre dieser Betrag nicht mehr
  //    passend — dann greift die gesetzliche Regel: 10 % des tatsächlichen Preises
  //    (§ 61 SGB V). Die 10 € je Verordnung kommen nicht hier, sondern in
  //    calcAbrechnungsfallZuzahlung() obendrauf.
  const basis = resolvePositionZuzahlung(katalogPosition, preis_eur);
  let zuzahlung_eur = basis.zuzahlungUnit;
  if (!basis.positionFrei && quelle === 'heilmittel_tarif') {
    zuzahlung_eur = r2(preis_eur * 0.10);
  }

  return {
    preis_eur,
    zuzahlung_eur,
    position_frei: basis.positionFrei,
    gefunden: basis.gefunden,
    quelle,
    ausserhalb_preisfenster: !!katalogPosition?.ausserhalb_preisfenster,
    katalogPosition: katalogPosition || null,
  };
}
