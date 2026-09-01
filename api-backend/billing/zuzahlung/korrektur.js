// Zuzahlung nachtraeglich korrigieren — die Regeln, ohne Datenbank und ohne HTTP.
//
// Der Fall (Ops-Karte 31.08.2026, Beta-1): der Patient bricht nach 3 von 6
// Einheiten ab. Der geforderte Betrag steht weiter auf dem Wert fuer 6.
//
// Drei Dinge sollen moeglich sein — und genau drei:
//   1. die Einheitenzahl senken (der Betrag folgt der Rechnung)
//   2. den Betrag von Hand ueberschreiben (die Rechnung folgt dem Menschen)
//   3. zuviel Gezahltes als Guthaben stehen lassen
//
// Was hier bewusst NICHT passiert: rechnen. Der Betrag kommt aus
// `calcAbrechnungsfallZuzahlung()` — es gibt genau eine Zuzahlungsrechnung, und
// das ist nicht diese Datei. Hier steht nur, was erlaubt ist und was aus einem
// gesenkten Soll folgt.

const r2 = (v) => Math.round((+v + Number.EPSILON) * 100) / 100;

/** Gruende, die eine Korrektur tragen duerfen. Muss zum CHECK der Tabelle passen. */
export const KORREKTUR_GRUENDE = [
  'abbruch',
  'korrektur_soll',
  'guthaben_verrechnung',
  'befreiung_nachgereicht',
  'sonstiges',
];

/**
 * Darf der Zuzahlungsbetrag dieser Verordnung noch geaendert werden?
 *
 * Muss Zeichen fuer Zeichen dieselbe Antwort geben wie `korrekturErlaubt()` in
 * `module/zuzahlung-rechnen.js`. Die Oberflaeche versteckt den Knopf, dieser
 * Riegel haelt ihn — verlassen wird sich auf den Riegel.
 *
 *   1. `belegnummer` gesetzt ⇒ die Verordnung steckt in einer eingereichten
 *      DTA-Datei. Die Nummer wird bei der Erzeugung einmal vergeben und nie
 *      wieder angefasst (Anlage 1 TP5 V21 Kap. 7.3). Ab hier laeuft jede
 *      Aenderung ueber das Korrekturverfahren, nicht ueber dieses Formular.
 *   2. `abrechnung_status` ausserhalb von 'bereit' ⇒ steckt gerade in einer
 *      Abrechnung. Gleiches Tor wie beim Positionswechsel (409).
 *
 * `abrechnung_id` ist ABSICHTLICH kein Kriterium: nach einer Kassenabsetzung
 * wird der Status auf 'bereit' zurueckgesetzt, die `abrechnung_id` aber stehen
 * gelassen. Ein Riegel darauf sperrte genau die Rezepte, die man dann anfassen
 * muss.
 *
 * @param {object} rx  {belegnummer, abrechnung_status}
 * @returns {{erlaubt: boolean, grund: string|null, status: number}}
 */
export function korrekturErlaubt(rx) {
  if (!rx) return { erlaubt: false, grund: 'Verordnung nicht gefunden.', status: 404 };
  if (rx.belegnummer) {
    return {
      erlaubt: false,
      status: 409,
      grund: `Diese Verordnung wurde bereits an die Kasse uebermittelt (Beleg ${rx.belegnummer}). `
        + 'Der Betrag ist festgeschrieben; eine Aenderung laeuft ueber das Korrekturverfahren.',
    };
  }
  const st = rx.abrechnung_status;
  if (st && st !== 'bereit') {
    return {
      erlaubt: false,
      status: 409,
      grund: `Diese Verordnung steckt bereits in einer Abrechnung (Status "${st}"). `
        + 'Bitte zuerst aus der Abrechnung nehmen.',
    };
  }
  return { erlaubt: true, grund: null, status: 200 };
}

/**
 * Pruefung der Eingaben, bevor irgendetwas geschrieben wird.
 *
 * Die Begruendung ist Pflicht — das ist der ganze Unterschied zwischen einer
 * Korrektur und einem stillen Ueberschreiben. Die Datenbank verlangt sie
 * ebenfalls (CHECK), hier kommt sie nur frueher und mit einem lesbaren Satz.
 *
 * @param {object} eingabe
 * @param {number|null} [eingabe.einheiten]  Neue Einheitenzahl (Faehigkeit 1)
 * @param {number|null} [eingabe.betrag]     Betrag von Hand (Faehigkeit 2)
 * @param {string} eingabe.grund
 * @param {string} eingabe.grundCode
 * @returns {{ok: boolean, fehler: string|null}}
 */
export function pruefeEingabe({ einheiten = null, betrag = null, grund, grundCode }) {
  if (einheiten == null && betrag == null) {
    return { ok: false, fehler: 'Weder eine neue Einheitenzahl noch ein Betrag angegeben.' };
  }
  if (einheiten != null && (!Number.isInteger(einheiten) || einheiten < 0)) {
    return { ok: false, fehler: 'Die Einheitenzahl muss eine ganze Zahl ab 0 sein.' };
  }
  if (betrag != null && (!Number.isFinite(betrag) || betrag < 0)) {
    return { ok: false, fehler: 'Der Betrag darf nicht negativ sein.' };
  }
  if (!KORREKTUR_GRUENDE.includes(grundCode)) {
    return { ok: false, fehler: `Unbekannter Korrekturgrund "${grundCode}".` };
  }
  if (!grund || String(grund).trim().length < 3) {
    return { ok: false, fehler: 'Bitte kurz begruenden, warum der Betrag geaendert wird.' };
  }
  return { ok: true, fehler: null };
}

/**
 * Was folgt aus dem neuen Soll?
 *
 * `saldo` ist die Summe der Kassenbuch-Belege dieses Rezepts (Zuzahlungen
 * positiv, Stornos negativ, `saldoJeRezept()`). Sinkt das Soll unter das, was
 * schon bezahlt wurde, entsteht die Differenz als Guthaben. Liegt es darueber,
 * bleibt eine Restforderung — die ist Sache des Mahnwesens und wird hier nur
 * benannt, nicht behandelt.
 *
 * @param {object} opts
 * @param {number} opts.altBetrag
 * @param {number} opts.neuBetrag
 * @param {number} opts.saldo
 * @returns {{altBetrag:number, neuBetrag:number, differenz:number,
 *            guthaben:number, restforderung:number, aenderung:boolean}}
 */
export function folgenDerKorrektur({ altBetrag, neuBetrag, saldo }) {
  const alt = r2(Number(altBetrag) || 0);
  const neu = r2(Number(neuBetrag) || 0);
  const ist = r2(Number(saldo) || 0);

  const ueberzahlt = r2(ist - neu);
  return {
    altBetrag: alt,
    neuBetrag: neu,
    differenz: r2(neu - alt),
    guthaben: ueberzahlt > 0 ? ueberzahlt : 0,
    restforderung: ueberzahlt < 0 ? r2(-ueberzahlt) : 0,
    aenderung: alt !== neu,
  };
}

/**
 * Wieviel von einem Guthaben laesst sich auf eine Verordnung anrechnen?
 *
 * Nie mehr als noch offen ist und nie mehr, als die Zielverordnung ueberhaupt
 * fordert — sonst entstuende dort ein negatives Soll, also ein zweites Guthaben
 * aus dem ersten.
 *
 * @param {object} opts
 * @param {number} opts.rest       zuzahlung_guthaben.rest_eur
 * @param {number} opts.zielSoll   prescriptions.zuzahlung_eur der Zielverordnung
 * @returns {{betrag:number, neuesZielSoll:number, neuerRest:number}}
 */
export function verrechnungsBetrag({ rest, zielSoll }) {
  const r = Math.max(0, r2(Number(rest) || 0));
  const z = Math.max(0, r2(Number(zielSoll) || 0));
  const betrag = r2(Math.min(r, z));
  return {
    betrag,
    neuesZielSoll: r2(z - betrag),
    neuerRest: r2(r - betrag),
  };
}
