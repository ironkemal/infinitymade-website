// Ist die Zuzahlung eines Rezepts bezahlt?
//
// Diese Frage wird an mehreren Stellen gestellt (Mahnwesen, Statistik, Oberfläche)
// und muss überall dieselbe Antwort geben. Vorher gab es zwei widersprüchliche
// Definitionen, wodurch dasselbe Rezept in der Statistik als offen und im
// Mahnwesen als bezahlt gelten konnte.
//
// Zwei Signale, in dieser Reihenfolge:
//
//   1. Der Kassenbuch-Saldo. Maßgeblich, sobald überhaupt Belege existieren.
//      Stornos liegen mit negativem Betrag in der Tabelle und rechnen sich damit
//      von selbst gegen.
//   2. Der Vermerk `zuzahlung_kassiert_am` am Rezept. Nötig für Altbestand: bis
//      August 2026 schrieb der Kassieren-Knopf im Termin-Panel nur diesen Vermerk
//      und legte KEINEN Beleg an. Ohne diesen Rückfall würde jede damals
//      kassierte Zuzahlung nach dem Umbau wieder als offen gelten — und der
//      Patient bekäme eine Mahnung für Geld, das er längst bezahlt hat.
//
// Der Vermerk wird beim Stornieren zurückgesetzt, ist also kein Dauerstempel.

/**
 * @param {object} opts
 * @param {number} opts.zuzahlungEur  Geforderter Betrag laut Rezept
 * @param {string|null} opts.kassiertAm  prescriptions.zuzahlung_kassiert_am
 * @param {number} opts.saldo  Summe aller Kassenbuch-Belege zu diesem Rezept
 *                             (zuzahlung positiv, storno negativ)
 * @returns {boolean}
 */
export function istZuzahlungBezahlt({ zuzahlungEur, kassiertAm, saldo }) {
  const soll = Number(zuzahlungEur) || 0;
  const ist  = Number(saldo) || 0;

  // Voll bezahlt laut Kassenbuch. Toleranz von einem halben Cent gegen
  // Rundungsreste aus alten Belegen — bewusst kleiner als ein Cent, damit eine
  // echte Restforderung von 0,01 € nicht als bezahlt durchgeht.
  if (soll > 0 && ist >= soll - 0.005) return true;

  // Teilzahlung: der Rest ist weiter offen und darf gemahnt werden.
  // Auch ein negativer Saldo (Storno ohne Originalbeleg) landet hier.
  if (ist !== 0) return false;

  // Kein Beleg vorhanden → Altbestand über den Vermerk am Rezept.
  return !!kassiertAm;
}

/**
 * Baut aus Kassenbuch-Zeilen die Saldo-Zuordnung Rezept-ID → Betrag.
 *
 * @param {Array<{prescription_id: string|null, amount_eur: number|string}>} belege
 * @returns {Map<string, number>}
 */
export function saldoJeRezept(belege) {
  const saldo = new Map();
  for (const b of (belege || [])) {
    if (!b.prescription_id) continue;
    saldo.set(b.prescription_id, (saldo.get(b.prescription_id) || 0) + Number(b.amount_eur || 0));
  }
  return saldo;
}
