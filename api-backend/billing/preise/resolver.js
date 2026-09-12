// Zentrale Preis- und Zuzahlungsauflösung für alle Abrechnungswege.
//
// Warum es diese Datei gibt (Aufgabe 2 der Loop-Liste "Kassieren"):
// Vorher holten die gedruckte Patientenrechnung und die §302-Datei an die Kasse
// ihre Beträge auf getrennten Wegen — die Druckrouten fragten `heilmittel_tarif`
// gar nicht ab, die §302-Route schon. Ein geänderter Tarif in der DB liess beide
// auseinanderlaufen: der Patient bekam eine Rechnung über einen anderen Betrag,
// als die Kasse gemeldet bekam. Ab jetzt ruft jeder Weg `resolvePreis()`.
//
// Entscheidung Melih, 10.08.2026: Der Katalog gewinnt.
//
// 13.09.2026 (gkv-302-Review, O-96): `heilmittel_tarif` als Preis-Override
// ENTFERNT. Der Code widersprach der eigenen Entscheidung oben — ein DB-Tarif
// übersteuerte den Katalogpreis, sobald einer vorlag, und lag praktisch immer
// vor (16 Bundesländer × alle Positionen geseedet). Grund für die Entfernung,
// nicht nur Aufräumen: Anlage 2 zum Vertrag § 125 Abs. 1 SGB V Physiotherapie
// kennt KEINE Bundesland-Dimension — bundesweit ein einziger "Preis in Euro"
// (Lesefassung gültig ab 01.01.2026, Teil A; der Begriff "Bundesland" kommt im
// gesamten Dokument nicht vor). Die Tabelle trug seit ihrer Erzeugung
// (26.05.2026, `seed_tarifs.js`) für alle 16 Länder denselben Wert — keine
// echte Regionalisierung, nur eine zweite Kopie desselben Preises.
// `gueltig_bis` stand dabei unbefristet (NULL) und die Seed-Datei lief nie
// wieder — das nächste reale Preisfenster (frühestens 01.01.2027, Anlage 2
// Teil B (7)/(9)) hätte die DB-Zeile NICHT verdrängt: die §302-Datei hätte
// weiter den 2026er-Preis getragen, still, ohne Fehler. Die automatische
// GKV-Preisprüfung (Ops-Karte #213, preise_autoupdate.mjs) hatte Physio
// deshalb schon vorsorglich auf `autoWrite:false` stehen — mit dieser
// Entfernung kann sie wieder scharf geschaltet werden.
//
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
 * Löst Preis und Zuzahlung einer Position für ein Leistungsdatum auf.
 *
 * @param {object}  opts
 * @param {string}  opts.bereich          'podologie' | 'physiotherapie'
 * @param {string}  opts.code             gespeicherter Code ('X0501' oder '78010')
 * @param {string}  [opts.datum]          Leistungsdatum ISO. Ohne Angabe: heute bzw.
 *                                        aktuellstes Preisfenster.
 * @param {string}  [opts.abrechnungscode='22']
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
} = {}) {
  const istPodologie = String(bereich || '').toLowerCase() === 'podologie';

  // 1. Katalogposition — sie entscheidet immer über Preis UND Zuzahlung.
  const katalogPosition = istPodologie
    ? findPodologiePosition(code, datum || undefined)
    : findPosition(code, abrechnungscode, datum);

  const preis_eur = r2(katalogPosition?.preis ?? 0);
  const quelle = katalogPosition ? 'katalog' : 'unbekannt';

  // 2. Zuzahlung — immer über den Katalog. Zuzahlungsfreie Positionen
  //    bleiben frei; der veröffentlichte exakte Betrag gilt, solange die
  //    Position gefunden wurde. Nur wenn sie es NICHT wurde (gefunden:false),
  //    greift in resolvePositionZuzahlung() das gesetzliche Netz: 10 % des
  //    Preises (§ 61 SGB V) — kein Übersteuerungsfall mehr, sondern der einzig
  //    verbliebene "kein Katalogeintrag"-Fall (billing/zuzahlung/calculator.js).
  const basis = resolvePositionZuzahlung(katalogPosition, preis_eur);
  const zuzahlung_eur = basis.zuzahlungUnit;

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
