/**
 * termin-leistungen.js — mehrere Leistungen an einem Termin.
 *
 * Ops-Karte 235. Beta-1 (Podologe), 31.08.2026:
 *
 *   „Genau, wenn man es nicht vollstopfen will, kann man auch einfach nur [ein]
 *    Pluszeichen drücken. Dann kommt noch ein Tab, kann man noch [eins wählen]
 *    … und die Anzahl"
 *
 * In der Podologie ist die Kombination der Normalfall, nicht die Ausnahme:
 * podologische Behandlung + Eingangsbefundung, oder Behandlung + Befundung.
 * Bis heute nahm die Terminmaske genau eine Leistung (`#bkService`, ein
 * einzelnes `<select>`), also wurden entweder zwei Termine angelegt oder die
 * zweite Leistung hinterher von Hand in die Abrechnung getippt.
 *
 * ── Warum hier nur die Rechnerei steht ──────────────────────────────────────
 * Diese Datei enthaelt bewusst KEIN DOM. Sie ist das Modell hinter den Zeilen:
 * hinzufuegen, entfernen, aendern, Dauer summieren, Befundung vorschlagen. So
 * laesst sich jede Regel mit `node --test` pruefen — und an diesen Zeilen haengt
 * die Slotlaenge, also die Frage, ob zwei Termine aufeinander fallen.
 * Die Darstellung liegt beim Aufrufer.
 *
 * ── Die erste Zeile ist `#bkService` ────────────────────────────────────────
 * Absichtlich: `bookings.service_id` bleibt die Hauptleistung, und die rund
 * fuenfzehn Stellen in `dashboard.js`, die `#bkService` lesen (Kalenderfarbe,
 * Dauer, Qualifikationspruefung, Serienvorschau), lesen weiter dasselbe Feld.
 * Zusatzzeilen kommen daneben. Wer stattdessen alles auf ein neues Feld
 * umgestellt haette, haette fuenfzehn Aufrufer gleichzeitig anfassen muessen.
 */

import { befundungFuerLeistung } from './eingangsbefundung-regel.js?v=20260903';

/** Fallback-Dauer, wenn eine Leistung keine `duration_minutes` fuehrt. */
export const STANDARD_DAUER_MIN = 30;

/** Obergrenze je Zeile — schuetzt vor einem verrutschten Tastendruck. */
export const MAX_ANZAHL = 20;

/**
 * Eine leere Zeile.
 * @param {?string} serviceId
 * @returns {{serviceId:?string, anzahl:number, auto:boolean, grund:string}}
 *   `auto` merkt sich, dass die Zeile vorgeschlagen und nicht von Hand gewaehlt
 *   wurde — nur solche Zeilen darf ein neuer Vorschlag wieder wegraeumen.
 */
export function neueZeile(serviceId = null) {
  return { serviceId: serviceId || null, anzahl: 1, auto: false, grund: '' };
}

/**
 * Gesamtdauer eines Termins in Minuten.
 *
 * Jede Zeile zaehlt mit ihrer Anzahl. Der Block im Kalender ist genau so lang —
 * und weil die Doppelbuchungssperre in der Datenbank (`no_overlapping_bookings`,
 * EXCLUDE USING gist ueber `tstzrange(start_time, end_time)`) auf `end_time`
 * schaut, entscheidet diese Summe mit darueber, ob zwei Termine kollidieren.
 * Eine zu klein gerechnete Summe legt den naechsten Patienten in dieselbe
 * Viertelstunde.
 *
 * @param {Array<{serviceId:?string, anzahl:number}>} zeilen
 * @param {Array<{id:string, duration_minutes:?number}>} dienste  servicesCache
 * @returns {number} Minuten, mindestens `STANDARD_DAUER_MIN`
 */
export function gesamtDauer(zeilen, dienste) {
  const summe = (zeilen || []).reduce((acc, z) => {
    if (!z || !z.serviceId) return acc;
    const srv = (dienste || []).find(d => d && d.id === z.serviceId);
    const dauer = Number.parseInt(srv?.duration_minutes, 10);
    const je = Number.isFinite(dauer) && dauer > 0 ? dauer : STANDARD_DAUER_MIN;
    return acc + je * begrenzeAnzahl(z.anzahl);
  }, 0);
  return summe > 0 ? summe : STANDARD_DAUER_MIN;
}

/** Anzahl auf 1..MAX_ANZAHL ziehen; alles Unlesbare wird 1. */
export function begrenzeAnzahl(wert) {
  const n = Number.parseInt(wert, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_ANZAHL);
}

/**
 * Zeile hinzufuegen — aber dieselbe Leistung nicht zweimal.
 *
 * Wer zweimal dieselbe Leistung waehlt, meint „zweimal", nicht „zwei Zeilen":
 * die Abrechnung fuehrt je Position eine Menge, keine Wiederholung. Also wird
 * die Anzahl der vorhandenen Zeile erhoeht statt eine zweite anzulegen.
 *
 * @param {Array} zeilen
 * @param {?string} serviceId
 * @returns {Array} neue Liste (die Eingabe bleibt unberuehrt)
 */
export function fuegeZeileHinzu(zeilen, serviceId = null) {
  const liste = (zeilen || []).map(z => ({ ...z }));
  if (serviceId) {
    const vorhanden = liste.find(z => z.serviceId === serviceId);
    if (vorhanden) {
      vorhanden.anzahl = begrenzeAnzahl(vorhanden.anzahl + 1);
      vorhanden.auto = false;   // von Hand bestaetigt
      return liste;
    }
  }
  liste.push(neueZeile(serviceId));
  return liste;
}

/**
 * Zeile entfernen. Die erste Zeile bleibt immer stehen — sie ist
 * `#bkService`, und `service_id` ist Pflicht.
 *
 * @param {Array} zeilen
 * @param {number} index
 * @returns {Array}
 */
export function entferneZeile(zeilen, index) {
  const liste = (zeilen || []).map(z => ({ ...z }));
  if (index <= 0 || index >= liste.length) return liste;
  liste.splice(index, 1);
  return liste;
}

/**
 * Welche HPNR traegt eine Leistung? `services.gkv_position_nr`, sonst `code`.
 *
 * Zwei Felder, weil die Beta-Praxen beides fuehren: der GKV-Katalog schreibt
 * `gkv_position_nr`, aeltere Handanlagen nur `code`. Wer nur eines liest,
 * bekommt bei der Haelfte der Saetze nichts.
 */
export function hpnrVonDienst(srv) {
  return String(srv?.gkv_position_nr || srv?.code || '').trim();
}

/**
 * Soll unter die Hauptleistung eine Befundung vorgeschlagen werden?
 *
 * Das ist der Telefonablauf aus Karte 221: Patient ruft an, Leistung wird
 * gewaehlt, und bei einem neuen Patienten soll die Befundung von selbst
 * darunter stehen. WELCHE Befundung — und ob ueberhaupt eine — entscheidet
 * `befundungFuerLeistung()`; im Nagelzweig UI1/UI2 kommt bewusst keine
 * (Beta-1: „beim Nagel gibt es das nicht"). Fundstellen dort.
 *
 * Diese Funktion uebersetzt die Antwort nur in eine Zeile: sie sucht die
 * Leistung, die diese HPNR traegt. Findet sie keine, gibt es keinen Vorschlag,
 * sondern einen Hinweis — eine Position, die die Praxis gar nicht eingerichtet
 * hat, laesst sich nicht buchen.
 *
 * @param {object} opt
 * @param {Array}  opt.zeilen        aktuelle Zeilen (Zeile 0 = Hauptleistung)
 * @param {Array}  opt.dienste       servicesCache
 * @param {Array}  [opt.behandlungen] `podologie_behandlungen` des Patienten
 * @param {string} opt.datum         `YYYY-MM-DD`
 * @param {boolean} [opt.selbstzahler]
 * @param {?boolean} [opt.podologieVor2023]
 * @param {?Array<string>} [opt.diagnosegruppen] Katalogzeile der Hauptleistung
 * @returns {{zeilen:Array, hinweis:string, rueckfrage:?string, grund:string}}
 *   `zeilen` ist die neue Liste — mit, ohne oder mit ausgetauschter
 *   Vorschlagszeile. Von Hand gewaehlte Zeilen bleiben unangetastet.
 */
export function mitBefundungsvorschlag({
  zeilen,
  dienste,
  behandlungen = [],
  datum,
  selbstzahler = false,
  podologieVor2023 = null,
  diagnosegruppen = null,
}) {
  // Alte Vorschlaege raeumen, von Hand gewaehlte Zeilen behalten.
  const liste = (zeilen || []).map(z => ({ ...z })).filter((z, i) => i === 0 || !z.auto);

  const haupt = liste[0];
  const hauptDienst = (dienste || []).find(d => d && d.id === haupt?.serviceId);
  if (!hauptDienst) return { zeilen: liste, hinweis: '', rueckfrage: null, grund: 'keine_leistung' };

  const urteil = befundungFuerLeistung({
    hpnr: hpnrVonDienst(hauptDienst),
    behandlungen,
    datum,
    selbstzahler,
    podologieVor2023,
    diagnosegruppen,
  });

  if (!urteil.code) {
    return { zeilen: liste, hinweis: urteil.hinweis, rueckfrage: null, grund: urteil.grund };
  }

  // Steht die Position schon von Hand in der Liste, wird nichts doppelt gesetzt.
  const schonDrin = liste.some(z => {
    const d = (dienste || []).find(x => x && x.id === z.serviceId);
    return hpnrVonDienst(d) === urteil.code;
  });
  if (schonDrin) {
    return { zeilen: liste, hinweis: '', rueckfrage: urteil.rueckfrage, grund: 'schon_gewaehlt' };
  }

  const befundDienst = (dienste || []).find(d => hpnrVonDienst(d) === urteil.code);
  if (!befundDienst) {
    return {
      zeilen: liste,
      hinweis: `Die Befundung ${urteil.code} ist als Leistung noch nicht eingerichtet — `
             + 'bitte in den Einstellungen anlegen, sonst fehlt sie auf der Abrechnung.',
      rueckfrage: urteil.rueckfrage,
      grund: 'leistung_fehlt',
    };
  }

  liste.push({ serviceId: befundDienst.id, anzahl: 1, auto: true, grund: urteil.grund });
  return { zeilen: liste, hinweis: urteil.hinweis, rueckfrage: urteil.rueckfrage, grund: urteil.grund };
}
