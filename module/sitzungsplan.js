/**
 * sitzungsplan.js — was laeuft an welchem Behandlungstag dieser Verordnung mit?
 *
 * Anlass (Kemal, 14.09.2026)
 * ─────────────────────────
 *   „genelde erstbefund sonra normal befund kalan her hizmette oluyor"
 *
 * Gemeint ist der Ablauf einer podologischen Serie: am ERSTEN Behandlungstag
 * laeuft die Eingangsbefundung (78040) mit, an JEDEM weiteren die Befundung
 * (78030). Das stand bisher nur in `wissensbank/SPEC-RULES.md` als Tabelle und
 * war in der Verordnungsmaske nirgends zu sehen — der Podologe tippt eine
 * Verordnung ueber 6 Einheiten ein und erfaehrt erst in der Abrechnung, welche
 * Befundpositionen dazugehoeren.
 *
 * Dieses Modul rechnet daraus eine Vorschau. Es ist eine ANZEIGE, kein
 * Schreibweg: hier entsteht keine Abrechnungszeile und kein Kaestchen wird
 * gesetzt. Gesetzt werden die Positionen weiterhin allein in der
 * Podologie-Abrechnung (`module/podologie-abrechnung.js`), wo alle Sperren
 * mitlaufen. Eine Vorschau, die nebenbei schreibt, waere ein zweiter
 * Schreibweg — genau das, was die Zusammenlegung vom 06.09.2026 beseitigt hat.
 *
 * Keine eigene Regel
 * ──────────────────
 * Die Entscheidung „78040 oder 78030 oder nichts" faellt ausschliesslich in
 * `befundungFuerLeistung()` (module/eingangsbefundung-regel.js), samt ihrer
 * Fundstellen. Hier wird sie nur auf N Sitzungen ausgerollt. Wer die Regel
 * aendern will, aendert sie dort — sonst sagen Vorschau und Abrechnung
 * verschiedene Dinge, und das ist schlimmer als gar keine Vorschau.
 *
 * Die Tabelle, die hier umgesetzt wird (SPEC-RULES.md → „Podologie: 6
 * seanslık serinin hangi Termin'ine hangi befundung"):
 *
 *   Patient zum ersten Mal in Podologie   Termin 1: 78040 + Behandlung
 *   (und erstmalig ab 01.11.2023)         Termin 2-N: 78030 + Behandlung
 *
 *   Patient schon bekannt / 78040 weg     Termin 1-N: 78030 + Behandlung
 *
 * ⚠️ Warum die Behandlung als „78010/78020" und nicht als eine Nummer
 * dasteht: welche der beiden es wird, haengt an der Therapiezeit (78020 „gross"
 * erst ueber 20 Minuten, FAK Podologie Q25) und entscheidet sich am
 * Behandlungstag, nicht bei der Verordnung. Bei Leitsymptomatik a)/b) ist die
 * Nummer dagegen nie strittig (immer 78010, FAK Q25) — `verordnung-podo.js`
 * traegt sie deshalb seit 18.09.2026 dort in `rzHmPosition` ein. Nur c)
 * „Podologische Komplexbehandlung" bleibt dort bewusst leer, aus genau diesem
 * Grund: „Ein leeres Feld ist besser als eine falsche Nummer."
 */

import { befundungFuerLeistung } from './eingangsbefundung-regel.js?v=20260914';
export { dgWurzel } from './verordnung-regeln.js?v=20260918';
import { dgWurzel } from './verordnung-regeln.js?v=20260918';

/**
 * Stellvertretende Behandlungsposition je Diagnosegruppe — nur, um
 * `befundungFuerLeistung()` den richtigen Zweig zu zeigen.
 *
 * Fuer DF/NF/QF ist das unkritisch: die Regel behandelt 78010 und 78020
 * identisch (beide stehen in ihrer Menge `DFNFQF_BEHANDLUNG`), also liefert
 * jede von beiden dasselbe Urteil. Fuer UI1/UI2 genuegt irgendeine
 * Nagelposition; zusaetzlich wird die Diagnosegruppe selbst mitgegeben, die
 * laut Regel Vorrang vor der festen Positionsliste hat.
 */
export const POD_DG_BEHANDLUNG = Object.freeze({
  DF: '78010', NF: '78010', QF: '78010', UI1: '78610', UI2: '78610',
});

/** Klartext der Behandlung in der Vorschau — siehe Kopf, zwei Nummern mit Absicht. */
const BEHANDLUNG_TEXT = 'Behandlung (78010/78020)';

/** Diagnosegruppen mit Befundungszweig DF/NF/QF. */
const DFNFQF = ['DF', 'NF', 'QF'];

/**
 * Beschriftung einer Sitzungsspanne. Eine einzelne Sitzung bekommt keine
 * Spanne — „Sitzung 2–2" liest sich wie ein Fehler.
 */
function spanne(von, bis) {
  return von === bis ? `Sitzung ${von}` : `Sitzung ${von}–${bis}`;
}

/**
 * Der Sitzungsplan zu einer Verordnung.
 *
 * Reine Rechnung, kein DOM und keine Abfrage — die Historie wird
 * hereingereicht, damit sie pruefbar bleibt (dasselbe Muster wie
 * `darf78040`/`befundungFuerLeistung`).
 *
 * @param {object} opt
 * @param {?string} opt.diagnosegruppe   z. B. `'DF'` oder `'DF-a'`
 * @param {*}       opt.anzahl           verordnete Behandlungseinheiten
 * @param {Array}   [opt.behandlungen]   alle `podologie_behandlungen` des
 *        Patienten ueber ALLE Verordnungen; leer = neuer Patient
 * @param {string}  opt.datum            geplanter erster Behandlungstag `YYYY-MM-DD`
 * @param {boolean} [opt.selbstzahler]
 * @param {?boolean} [opt.podologieVor2023]  war der Patient schon vor dem
 *        01.11.2023 in podologischer Behandlung? `null` = nicht beantwortet
 * @returns {{anwendbar:boolean, grund:string, zeilen:Array<{titel:string,
 *           codes:Array<string>, text:string}>, hinweis:string,
 *           rueckfrage:?string}}
 *   `anwendbar:false` heisst: es gibt nichts zu zeigen (kein podologischer
 *   Zweig, keine Menge). `zeilen` leer bei gesetztem `hinweis` heisst: wir
 *   sagen etwas, aber planen nichts — so im Nagelzweig.
 */
export function sitzungsplan({
  diagnosegruppe,
  anzahl,
  behandlungen = [],
  datum,
  selbstzahler = false,
  podologieVor2023 = null,
} = {}) {
  const leer = (grund, hinweis = '', rueckfrage = null) => ({
    anwendbar: false, grund, zeilen: [], hinweis, rueckfrage,
  });

  const root = dgWurzel(diagnosegruppe);
  if (!root || !POD_DG_BEHANDLUNG[root]) return leer('kein_podologie_zweig');

  const urteil = befundungFuerLeistung({
    hpnr: POD_DG_BEHANDLUNG[root],
    behandlungen,
    datum,
    selbstzahler,
    podologieVor2023,
    diagnosegruppen: [root],
  });

  // Nagelzweig UI1/UI2: die Regel schlaegt hier bewusst nichts vor — ob eine
  // Nagelspangen-Serie beginnt, entscheidet die Praxis (§ 3b lit. a). Ihr
  // Hinweistext wird unveraendert durchgereicht, nicht neu formuliert.
  if (!DFNFQF.includes(root)) {
    return { anwendbar: true, grund: urteil.grund, zeilen: [], hinweis: urteil.hinweis, rueckfrage: null };
  }

  const n = Number.parseInt(anzahl, 10);
  if (!Number.isFinite(n) || n < 1) {
    return leer('keine_menge', urteil.hinweis, urteil.rueckfrage);
  }

  // Selbstzahler o. ae.: keine GKV-Position, also auch kein Plan.
  if (!urteil.code) {
    return { anwendbar: true, grund: urteil.grund, zeilen: [], hinweis: urteil.hinweis, rueckfrage: null };
  }

  const zeilen = [];

  if (urteil.code === '78040') {
    // 78040 gehoert VOR die erste Abgabe und darf am selben Tag daneben
    // stehen; 78030 entfaellt an genau diesem Tag (Anlage 1a Teil 2 Ziff. 4.1).
    zeilen.push({
      titel: spanne(1, 1),
      codes: ['78040'],
      text: `Eingangsbefundung (78040) + ${BEHANDLUNG_TEXT} — die Befundung (78030) entfällt an diesem Tag.`,
    });
    if (n > 1) {
      zeilen.push({
        titel: spanne(2, n),
        codes: ['78030'],
        text: `Befundung (78030) + ${BEHANDLUNG_TEXT} — vor jeder weiteren Behandlung.`,
      });
    }
  } else {
    // 78030 an jedem Behandlungstag. Warum hier kein 78040 mehr steht, sagt
    // der Hinweis der Regel (schon abgerechnet / nicht mehr die erste
    // Behandlung / Altbestand vor dem 01.11.2023).
    zeilen.push({
      titel: spanne(1, n),
      codes: ['78030'],
      text: `Befundung (78030) + ${BEHANDLUNG_TEXT} — vor jeder Behandlung.`,
    });
  }

  return {
    anwendbar: true,
    grund: urteil.grund,
    zeilen,
    hinweis: urteil.hinweis,
    rueckfrage: urteil.rueckfrage,
  };
}
