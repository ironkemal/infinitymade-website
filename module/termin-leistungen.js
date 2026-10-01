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
 * ── Zwei Haelften, und die Trennung ist Absicht ─────────────────────────────
 * OBEN steht das Modell, ohne eine Zeile DOM: hinzufuegen, entfernen, aendern,
 * Dauer summieren, Befundung vorschlagen. Es laesst sich mit `node --test`
 * pruefen, und das muss es — an diesen Zeilen haengt die Slotlaenge und damit
 * die Frage, ob zwei Termine aufeinander fallen.
 *
 * UNTEN, ab „Die Maske", steht die Verdrahtung: Zeilen zeichnen, Ereignisse,
 * die Abfrage der Patientenhistorie, das Speichern. Wer eine Regel aendern
 * will, aendert oben; wer am Aussehen dreht, unten.
 *
 * ── Die erste Zeile ist `#bkService` ────────────────────────────────────────
 * Absichtlich: `bookings.service_id` bleibt die Hauptleistung, und die rund
 * fuenfzehn Stellen in `dashboard.js`, die `#bkService` lesen (Kalenderfarbe,
 * Dauer, Qualifikationspruefung, Serienvorschau), lesen weiter dasselbe Feld.
 * Zusatzzeilen kommen daneben. Wer stattdessen alles auf ein neues Feld
 * umgestellt haette, haette fuenfzehn Aufrufer gleichzeitig anfassen muessen.
 */

import { befundungFuerLeistung, IST_BEFUNDUNG } from './eingangsbefundung-regel.js?v=20261003a';
import { geplanteAlsBehandlungen, positionVon } from './podo-geplant.js?v=20260918';
import { setzeDauer } from './termin-dauer.js?v=20260903b';
import { alsISODatum } from './datum.js?v=20261001a';
import { befundGrundText } from './podo-vorbelegung-grund.js?v=20261001i';

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
 * Rohsumme der Zeilen in Minuten — OHNE die Untergrenze von `gesamtDauer()`.
 *
 * Eine Befundpauschale (78030/78040, `IST_BEFUNDUNG`) ohne eigene Dauer zaehlt
 * 0 Minuten (S3.11, 29.09.2026): sie ist keine eigene Behandlungszeit, sie
 * wird im selben Termin miterledigt (Beschluss 05.09.2026). Frueher zaehlte sie
 * den Standard von 30 Minuten und machte aus 35 Minuten Behandlung einen
 * 65-Minuten-Block. Fuehrt die Praxis fuer die Befundung selbst eine Dauer,
 * gilt diese. Alle anderen Leistungen ohne Dauer bleiben beim Standard.
 */
export function zeilenMinuten(zeilen, dienste) {
  return (zeilen || []).reduce((acc, z) => {
    if (!z || !z.serviceId) return acc;
    const srv = (dienste || []).find(d => d && d.id === z.serviceId);
    const dauer = Number.parseInt(srv?.duration_minutes, 10);
    if (Number.isFinite(dauer) && dauer > 0) return acc + dauer * begrenzeAnzahl(z.anzahl);
    const je = IST_BEFUNDUNG.has(hpnrVonDienst(srv)) ? 0 : STANDARD_DAUER_MIN;
    return acc + je * begrenzeAnzahl(z.anzahl);
  }, 0);
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
  const summe = zeilenMinuten(zeilen, dienste);
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
 * Die Leistung EINER Zeile aendern — und dabei dieselbe Regel anwenden wie
 * beim Hinzufuegen: dieselbe Leistung nicht zweimal.
 *
 * `fuegeZeileHinzu()` hatte diese Sperre von Anfang an, der Aenderungsweg
 * nicht. Wer also eine zweite Zeile aufmachte und dort die Leistung waehlte,
 * die oben schon stand — in der Podologie genau der haeufige Fall, weil die
 * Software die Eingangsbefundung von selbst vorschlaegt und der Anwender sie
 * daneben noch einmal von Hand waehlt —, bekam zwei identische Zeilen. Der
 * Kalenderblock wurde dadurch zu lang, und beim Speichern schlug
 * `UNIQUE (booking_id, service_id)` zu.
 *
 * Zusammengelegt wird immer auf die WEITER OBEN stehende Zeile, die untere
 * faellt weg. Damit kann Zeile 0 (`#bkService`) nie verschwinden.
 *
 * @param {Array} zeilen
 * @param {number} index
 * @param {?string} serviceId
 * @returns {Array} neue Liste (die Eingabe bleibt unberuehrt)
 */
export function setzeZeilenService(zeilen, index, serviceId) {
  const liste = (zeilen || []).map(z => ({ ...z }));
  if (!liste[index]) return liste;

  if (!serviceId) {
    liste[index].serviceId = null;
    liste[index].auto = false;
    return liste;
  }

  const andere = liste.findIndex((z, i) => i !== index && z.serviceId === serviceId);
  if (andere === -1) {
    liste[index].serviceId = serviceId;
    liste[index].auto = false;   // von Hand bestaetigt, kein Vorschlag mehr
    return liste;
  }

  const bleibt = Math.min(andere, index);
  const geht   = Math.max(andere, index);
  liste[bleibt].serviceId = serviceId;
  liste[bleibt].anzahl = begrenzeAnzahl(liste[andere].anzahl + liste[index].anzahl);
  liste[bleibt].auto = false;
  liste.splice(geht, 1);
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
  return positionVon(srv);   // eine Definition — module/podo-geplant.js
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
 * @returns {{zeilen:Array, hinweis:string, rueckfrage:?string, grund:string,
 *   vorschlag:?{serviceId:string, code:string, angenommen:boolean}}}
 *   `zeilen` ist die Liste OHNE Vorschlagszeile (S1.12, 29.09.2026): die
 *   Befundpauschale ist ein VORSCHLAG neben der Liste, keine Zeile darin —
 *   frueher wurde sie als `auto:true`-Zeile mitgespeichert, und jeder
 *   Serientermin bekam 78030 (bei neuem Patienten sogar 78040). Der Vorschlag
 *   (`vorschlag`) wird erst durch das Haekchen der Anwenderin zur Zeile
 *   (Beschluss 05.09.2026: „vorgeschlagen, ungehakt"). `angenommen` = die
 *   Position steht schon von Hand in der Liste.
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
  if (!hauptDienst) return { zeilen: liste, hinweis: '', rueckfrage: null, grund: 'keine_leistung', vorschlag: null };

  const urteil = befundungFuerLeistung({
    hpnr: hpnrVonDienst(hauptDienst),
    behandlungen,
    datum,
    selbstzahler,
    podologieVor2023,
    diagnosegruppen,
  });

  if (!urteil.code) {
    return { zeilen: liste, hinweis: urteil.hinweis, rueckfrage: null, grund: urteil.grund, vorschlag: null };
  }

  // Steht die Position schon von Hand in der Liste, wird nichts doppelt gesetzt.
  const schonDrin = liste.some(z => {
    const d = (dienste || []).find(x => x && x.id === z.serviceId);
    return hpnrVonDienst(d) === urteil.code;
  });
  if (schonDrin) {
    const schon = liste.find((z, i) => i > 0
      && hpnrVonDienst((dienste || []).find(x => x && x.id === z.serviceId)) === urteil.code);
    return {
      zeilen: liste, hinweis: '', rueckfrage: urteil.rueckfrage, grund: 'schon_gewaehlt',
      vorschlag: schon ? { serviceId: schon.serviceId, code: urteil.code, angenommen: true } : null,
    };
  }

  const befundDienst = (dienste || []).find(d => hpnrVonDienst(d) === urteil.code);
  if (!befundDienst) {
    return {
      zeilen: liste,
      hinweis: `Die Befundung ${urteil.code} ist als Leistung noch nicht eingerichtet — `
             + 'bitte in den Einstellungen anlegen, sonst fehlt sie auf der Abrechnung.',
      rueckfrage: urteil.rueckfrage,
      grund: 'leistung_fehlt',
      vorschlag: null,
    };
  }

  return {
    zeilen: liste, hinweis: urteil.hinweis, rueckfrage: urteil.rueckfrage, grund: urteil.grund,
    vorschlag: { serviceId: befundDienst.id, code: urteil.code, angenommen: false },
  };
}

/**
 * Text neben dem Haekchen des Befundungsvorschlags.
 *
 * @param {string} code    `78030` oder `78040`
 * @param {{serie?:boolean, minuten?:number, grund?:string}} [opt]
 *   `serie`: die Maske legt mehrere Termine an. 78030 gilt dann nur, wenn die
 *   Anwenderin es fuer ALLE Serientermine haekt; 78040 nie fuer mehr als den
 *   ersten (`zeilenFuerTermin`).
 *   `grund`: Schluessel aus `befundungFuerLeistung()` — der Text sagt, WARUM
 *   diese Befundung vorgeschlagen ist (Konsey 30.09.2026, 2b).
 */
export function vorschlagText(code, { serie = false, minuten = 0, grund = '' } = {}) {
  const dauer = minuten > 0 ? ` (+${minuten} Min.)` : '';
  const warum = befundGrundText(grund);
  const zusatz = warum ? ` — Grund: ${warum}` : '';
  if (code === '78040') {
    return 'Vorschlag: Podologische Eingangsbefundung (78040) übernehmen'
      + (serie ? ' — nur am ersten Serientermin' : '') + dauer + zusatz;
  }
  return (serie
    ? `Befundung (${code}) in alle Serientermine übernehmen${dauer}`
    : `Vorschlag: Befundung (${code}) übernehmen${dauer}`) + zusatz;
}

/**
 * Welche Zeilen bekommt der Termin Nr. `index` einer Serie (0 = erster)?
 *
 *   - 78040 hoechstens EINMAL: nur der erste Termin (`index === 0`) darf sie
 *     tragen, auch wenn die Anwenderin sie von Hand gewaehlt hat.
 *     Anlage 1a Teil 1 Nr. 2 + Teil 2 Ziff. 4.1: einmalig.
 *   - 78040 und 78030 nie am selben Termin: hat der Termin 78040, faellt 78030
 *     weg (Regel im Backend: `befundpauschale-regeln.js`).
 *
 * @returns {Array} neue Liste, Eingabe bleibt unberuehrt
 */
export function zeilenFuerTermin(zeilen, index, dienste) {
  const hpnr = z => hpnrVonDienst((dienste || []).find(d => d && d.id === z?.serviceId));
  let liste = (zeilen || []).map(z => ({ ...z }));
  if (index > 0) liste = liste.filter(z => hpnr(z) !== '78040');
  if (liste.some(z => hpnr(z) === '78040')) liste = liste.filter(z => hpnr(z) !== '78030');
  return liste;
}

/**
 * Hat sich der Vorschlag geaendert oder ist er entfallen, verschwindet auch die
 * dafuer gehaekte Zeile — sie stand nur wegen der alten Grundlage da (anderer
 * Patient, Nagelleistung, Selbstzahler). Andere Handzeilen bleiben.
 */
export function raeumeAngenommenenVorschlag(zeilen, alt, neu) {
  const liste = (zeilen || []).map(z => ({ ...z }));
  if (!alt || (neu && neu.serviceId === alt.serviceId)) return liste;
  return liste.filter((z, i) => i === 0 || z.serviceId !== alt.serviceId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Die Maske. Ab hier DOM — alles darueber ist geprueft, alles hier ist Draht.
//
// Zeile 0 ist `#bkService` + `#bkMenge` und bleibt, wo sie war. Zusatzzeilen
// entstehen in `#bkLeistungExtra` und tragen dieselben Optionen, geklont aus
// `#bkService` — dann muss dieses Modul nicht wissen, wie dashboard.js die
// Liste zusammenstellt (GKV-Gruppe, private Gruppe, Mitarbeiterfilter).
// ─────────────────────────────────────────────────────────────────────────────

let ctx = null;
/** Zusatzzeilen; Zeile 0 lebt im DOM und wird bei Bedarf gelesen. */
let _extra = [];
/** Steht im Dauer-Feld gerade eine von hier gerechnete Kombi-Summe? */
let _kombiDauerGesetzt = false;
/** Aktueller Befundungsvorschlag (nur Anzeige, keine Zeile); `null` = keiner. */
let _vorschlag = null;
/** Schluessel, WARUM der Vorschlag steht (`befundungFuerLeistung().grund`). */
let _vorschlagGrund = '';

/** Alle Zeilen: Zeile 0 aus dem DOM, danach die Zusatzzeilen. */
export function leseLeistungen() {
  const haupt = document.getElementById('bkService')?.value || null;
  const menge = begrenzeAnzahl(document.getElementById('bkMenge')?.value);
  return [{ serviceId: haupt || null, anzahl: menge, auto: false, grund: '' },
          ..._extra.map(z => ({ ...z }))];
}

/**
 * Eine ganze Zeilenliste uebernehmen.
 *
 * Zeile 0 lebt im DOM (`#bkService` + `#bkMenge`), der Rest in `_extra`. Wer
 * das vergisst, verliert stillschweigend die Menge der Hauptleistung: legt
 * `setzeZeilenService()` zwei Zeilen auf Zeile 0 zusammen, steht die neue
 * Anzahl im Modell, aber `#bkMenge` zeigt weiter die alte — und gespeichert
 * wird, was im Feld steht.
 *
 * @param {Array} alle  vollstaendige Liste, Zeile 0 zuerst
 */
function uebernehmeZeilen(alle) {
  const liste = alle || [];
  const menge = document.getElementById('bkMenge');
  if (menge && liste[0]) menge.value = String(begrenzeAnzahl(liste[0].anzahl));
  _extra = liste.slice(1).map(z => ({ ...z }));
}

/**
 * Zeilen von aussen setzen — der Weg aus dem Seitenbereich, wenn mehrere
 * Sitzungen einer Verordnung zusammen auf den Kalender gezogen werden.
 * Die erste Leistung bleibt `#bkService` (dashboard.js hat sie schon gesetzt),
 * der Rest wird zu Zusatzzeilen.
 */
export function setzeLeistungen(serviceIds) {
  const ids = (serviceIds || []).filter(Boolean);
  _extra = ids.slice(1).map(id => ({ serviceId: id, anzahl: 1, auto: false, grund: '' }));
  zeichneZeilen();
  aktualisiereDauer();
}

/**
 * Die gespeicherten Zeilen eines Termins holen.
 *
 * Ohne diesen Weg war das Speichern ein Datenverlust: die Maske startet leer,
 * `speichereLeistungen()` loescht erst alles und schreibt dann, was sie sieht —
 * wer einen zweizeiligen Termin oeffnete und nur die Uhrzeit aendert, verlor die
 * zweite Leistung wortlos. Zeile 0 setzt dashboard.js ohnehin (`#bkService`),
 * hier kommen die uebrigen dazu.
 *
 * @param {string} bookingId
 */
export async function ladeLeistungen(bookingId) {
  if (!ctx?.supabase || !bookingId) return;
  const { data } = await ctx.supabase
    .from('booking_leistungen')
    .select('service_id, anzahl, sort_order')
    .eq('booking_id', bookingId)
    .order('sort_order', { ascending: true });
  _extra = (data || []).slice(1).map(z => ({
    serviceId: z.service_id, anzahl: begrenzeAnzahl(z.anzahl), auto: false, grund: '',
  }));
  const menge = document.getElementById('bkMenge');
  if (menge && data?.length) menge.value = String(begrenzeAnzahl(data[0].anzahl));
  zeichneZeilen();
  aktualisiereDauer();
}

/** Beim Oeffnen der Maske: alles zurueck auf eine Zeile. */
export function setzeLeistungenZurueck() {
  _extra = [];
  _vorschlag = null;
  _kombiDauerGesetzt = false;
  const menge = document.getElementById('bkMenge');
  if (menge) menge.value = '1';
  zeichneZeilen();
  zeigeHinweis('');
}

/**
 * Die Zeilen eines oder mehrerer Termine speichern.
 *
 * Erst schreiben, dann aufraeumen — nicht umgekehrt. Bis zum 04.09.2026 stand
 * hier ein `delete` ueber den ganzen Termin und danach ein `insert`. Scheiterte
 * der zweite Schritt (Netz weg, RLS, oder eine doppelte Zeile gegen
 * `UNIQUE (booking_id, service_id)`), war der Termin danach OHNE Leistungen —
 * und das faellt nicht auf: die Terminmaske zeigt dann eine Zeile, und die
 * podologische Abrechnung (`module/podologie-abrechnung.js`, liest
 * `booking_leistungen(services(gkv_position_nr))`) sieht den Termin als leer.
 * Ein `upsert` kann nichts wegnehmen; scheitert das nachfolgende Aufraeumen,
 * bleibt hoechstens eine Zeile zu viel stehen — sichtbar und behebbar.
 *
 * `bookings.service_id` steht ausserdem im Speicher-Payload von dashboard.js
 * und wird gleich darauf von trg_booking_hauptleistung aus Zeile 0
 * ueberschrieben — dasselbe Ergebnis, der Payload ist der Rueckfall.
 *
 * Zweiter Aufrufer seit S1.10 (canli-test 29.09.2026, P1): eine KI-Serie oder
 * ein manueller Serienbatch legt mehrere Termine in einem Rutsch an
 * (`api-backend/server.js` `/booking/batch-create` bzw.
 * `/booking/batch-create-explicit`) und schrieb dabei nie eine
 * `booking_leistungen`-Zeile — nur der Einzelweg (`bkSaveBtn`) tat es. Bei
 * einer ID bleibt das Verhalten exakt das alte; bei mehreren bekommt JEDER
 * Termin dieselben Zeilen (dieselbe Kombination steckt hinter jedem Slot der
 * Serie).
 *
 * @param {string|Array<string>} bookingIdOrIds
 * @returns {Promise<{ok:boolean, error:?string}>}
 */
export async function speichereLeistungen(bookingIdOrIds) {
  if (!ctx) return { ok: false, error: 'kein Termin' };
  const ids = (Array.isArray(bookingIdOrIds) ? bookingIdOrIds : [bookingIdOrIds]).filter(Boolean);
  if (!ids.length) return { ok: false, error: 'kein Termin' };

  const zeilen = leseLeistungen().filter(z => z.serviceId);
  if (!zeilen.length) return { ok: false, error: 'keine Leistung' };

  // Je Termin eigene Zeilen: 78040 nur am ersten Serientermin, nie mit 78030
  // zusammen (zeilenFuerTermin, S1.12).
  const dienste = ctx.getServices?.() || [];
  const reihen = ids.flatMap((bookingId, idx) => zeilenFuerTermin(zeilen, idx, dienste).map((z, i) => ({
    booking_id: bookingId,
    service_id: z.serviceId,
    owner_id: ctx.getOwnerId(),
    anzahl: begrenzeAnzahl(z.anzahl),
    sort_order: i,
  })));

  const { error } = await ctx.supabase.from('booking_leistungen')
    .upsert(reihen, { onConflict: 'booking_id,service_id' });
  if (error) return { ok: false, error: error.message };

  // Was der Anwender weggenommen hat, faellt jetzt weg — und nur das.
  const bleiben = [...new Set(reihen.map(r => r.service_id))].map(id => `"${id}"`).join(',');
  const { error: delErr } = await ctx.supabase.from('booking_leistungen')
    .delete().in('booking_id', ids).not('service_id', 'in', `(${bleiben})`);
  return delErr ? { ok: false, error: delErr.message } : { ok: true, error: null };
}

/**
 * `speichereLeistungen()` fuer eine ganze Liste frisch angelegter Termine
 * (Serie/KI-Batch), inklusive der Fehlermeldung, die sonst an jeder
 * Aufrufstelle einzeln stuende. Leere Liste ist kein Fehler, nur nichts zu tun
 * — ein Serienbatch, bei dem jeder Slot in einen Konflikt lief, hat `created`
 * leer und keine Leistungen zu schreiben.
 *
 * @param {Array<{id:string}>} created  Antwort von batch-create / batch-create-explicit
 * @param {{showToast:?function}} [opt]
 * @returns {Promise<{ok:boolean, error:?string}>}
 */
export async function speichereLeistungenFuerErstellte(created, { showToast } = {}) {
  const ids = (created || []).map(c => c?.id).filter(Boolean);
  if (!ids.length) return { ok: true, error: null };
  const lg = await speichereLeistungen(ids);
  if (!lg.ok) showToast?.(`Leistungen nicht gespeichert: ${lg.error}`, 'error');
  return lg;
}

/** Zusatzzeilen zeichnen. Optionen werden aus `#bkService` geklont. */
function zeichneZeilen() {
  const wrap = document.getElementById('bkLeistungExtra');
  const quelle = document.getElementById('bkService');
  if (!wrap || !quelle) return;

  wrap.innerHTML = '';
  _extra.forEach((z, i) => {
    const reihe = document.createElement('div');
    reihe.style.cssText = 'display:flex;gap:8px;align-items:flex-start;';
    reihe.dataset.index = String(i + 1);

    const sel = document.createElement('select');
    sel.className = 'form-select';
    sel.style.cssText = 'flex:1;min-width:0;';
    sel.innerHTML = quelle.innerHTML;
    sel.value = z.serviceId || '';
    sel.dataset.rolle = 'leistung';

    const menge = document.createElement('input');
    menge.className = 'form-input';
    menge.type = 'number'; menge.min = '1'; menge.max = String(MAX_ANZAHL);
    menge.value = String(begrenzeAnzahl(z.anzahl));
    menge.title = 'Menge dieser Position in diesem Termin';
    menge.style.cssText = 'width:74px;flex:0 0 auto;text-align:center;';
    menge.dataset.rolle = 'menge';

    const weg = document.createElement('button');
    weg.type = 'button';
    weg.className = 'btn-ghost';
    weg.textContent = '✕';
    weg.title = 'Leistung entfernen';
    weg.style.cssText = 'flex:0 0 auto;padding:6px 10px;';
    weg.dataset.rolle = 'entfernen';

    // Eine vorgeschlagene Zeile sieht anders aus als eine gewaehlte — sonst
    // weiss der Podologe nicht, was die Software von sich aus getan hat.
    if (z.auto) {
      reihe.style.cssText += 'border-left:2px solid var(--accent,#b1891b);padding-left:8px;';
      sel.title = 'Von der Software vorgeschlagen — Auswahl ändern hebt den Vorschlag auf.';
    }

    reihe.append(sel, menge, weg);
    wrap.appendChild(reihe);
  });
  zeichneVorschlag();
}

/** Legt die Maske gerade eine Serie an? (Toggle an, kein bestehender Termin.) */
function serieAktiv() {
  return !!document.getElementById('bkSeriesToggle')?.checked
      && !document.getElementById('bk-id')?.value;
}

/**
 * Der Befundungsvorschlag: ein ungehaktes Kaestchen UNTER der Liste. Erst das
 * Haekchen macht daraus eine Zeile — und damit Dauer und Speicherung.
 */
function zeichneVorschlag() {
  const anker = document.getElementById('bkLeistungHinweis') || document.getElementById('bkLeistungExtra');
  if (!anker?.parentNode || typeof document.createElement !== 'function') return;
  let el = document.getElementById('bkLeistungVorschlag');
  if (!_vorschlag) { if (el) el.hidden = true; return; }
  if (!el) {
    el = document.createElement('label');
    el.id = 'bkLeistungVorschlag';
    el.style.cssText = 'display:flex;gap:8px;align-items:center;cursor:pointer;color:var(--text-main);font-size:.9rem;';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => {
      if (!_vorschlag) return;
      const id = _vorschlag.serviceId;
      _extra = box.checked
        ? fuegeZeileHinzu(leseLeistungen(), id).slice(1)
        : _extra.filter(z => z.serviceId !== id);
      zeichneZeilen();
      aktualisiereDauer();
    });
    const text = document.createElement('span');
    el.append(box, text);
    anker.parentNode.insertBefore(el, anker);
  }
  const minuten = zeilenMinuten([neueZeile(_vorschlag.serviceId)], ctx?.getServices?.() || []);
  el.hidden = false;
  el.querySelector('input').checked = _extra.some(z => z.serviceId === _vorschlag.serviceId);
  el.querySelector('span').textContent = vorschlagText(_vorschlag.code, { serie: serieAktiv(), minuten, grund: _vorschlagGrund });
}

function zeigeHinweis(text, rueckfrage = null) {
  const el = document.getElementById('bkLeistungHinweis');
  if (!el) return;
  const stuecke = [text, rueckfrage].filter(Boolean);
  el.textContent = stuecke.join(' — ');
  el.hidden = stuecke.length === 0;
}

/**
 * Dauer neu rechnen und ins Dauer-Feld schreiben.
 *
 * Bei einer einzigen Zeile bleibt `updateBkDuration()` aus dashboard.js
 * zustaendig — dort haengt die gelernte Dauer bzw. die Preisstufen aus
 * `price_config`. Erst ab zwei Zeilen uebernimmt die Summe, ueber
 * `setzeDauer()` aus module/termin-dauer.js — demselben Weg, den der
 * Speicherpfad ohnehin liest.
 *
 * Seit der Umstellung auf ein einzelnes Zahlenfeld (03.09.2026, Beta-Feedback
 * „keine Checkboxen") gibt es kein innerHTML mehr zu ersetzen und damit auch
 * keinen Beobachter-Bedarf mehr — die fruehere Endlosschleife (schreiben →
 * MutationObserver → schreiben) entfiel mit ihrer Ursache.
 */
function aktualisiereDauer() {
  const zeilen = leseLeistungen().filter(z => z.serviceId);

  // Von mehreren Zeilen auf eine gefallen — Vorschlag weggeraeumt, Leistung
  // gewechselt, Selbstzahler gedrueckt. Im Feld steht dann noch die Summe
  // MIT der verschwundenen Zeile, und niemand raeumt sie weg: dashboard.js'
  // updateBkDuration() hatte im selben Durchgang schon abgelehnt, weil zu
  // ihrem Zeitpunkt noch zwei Zeilen standen (`istKombinierterTermin()`),
  // und die Bedingung unten schwieg ab da ebenfalls. Ergebnis war ein
  // Termin, der 70 Minuten blockte, wo 50 drinstanden.
  //
  // Aufgeraeumt wird nur, was hier auch gesetzt wurde: `_kombiDauerGesetzt`
  // haelt genau das fest. Ohne diese Bedingung wuerde die gelernte Dauer aus
  // `price_config` beim ersten Zeichnen von der blossen Summe ueberschrieben.
  // Bei null Zeilen wird geschwiegen — dort blendet updateBkDuration() die
  // ganze Gruppe aus, und `setzeDauer()` holte sie zurueck.
  if (zeilen.length < 2) {
    if (zeilen.length === 1 && _kombiDauerGesetzt) {
      _kombiDauerGesetzt = false;
      // Ab hier ist wieder dashboard.js zustaendig: dort haengen die gelernte
      // Dauer („aus N bisherigen Terminen") und die Preisstufen aus
      // `price_config`. Die blosse Katalogdauer waere ein Rueckschritt — die
      // Praxis, die fuer diese Leistung 55 statt 50 Minuten gelernt hat,
      // bekaeme wieder 50. Nur wenn niemand zustaendig ist (Probe, Test),
      // wird die Summe selbst geschrieben.
      if (typeof ctx?.aufEinzelDauer === 'function') ctx.aufEinzelDauer(zeilen[0].serviceId);
      else setzeDauer(gesamtDauer(zeilen, ctx?.getServices?.() || []), '');
    }
    return;
  }

  const minuten = gesamtDauer(zeilen, ctx?.getServices?.() || []);
  _kombiDauerGesetzt = true;
  setzeDauer(minuten, 'kombiniert');
}

/** Historie des gewaehlten Patienten — Grundlage des Befundungsvorschlags. */
async function patientenBehandlungen() {
  const leadId = document.getElementById('bkCustomerId')?.value || '';
  if (!ctx?.supabase || !leadId) return [];
  // Seit 04.09.2026 EIN Verordnungstopf (`prescriptions`, therapie_bereich =
  // 'podo') — vorher eine eigene Tabelle `verordnungen`.
  const { data: vords } = await ctx.supabase.from('prescriptions')
    .select('id').eq('owner_id', ctx.getOwnerId()).eq('patient_id', leadId)
    .eq('therapie_bereich', 'podo');
  const { data: behs } = vords?.length ? await ctx.supabase.from('podologie_behandlungen')
    .select('behandlungsdatum, hpnr_codes')
    .eq('owner_id', ctx.getOwnerId())
    .is('storniert_am', null)          // stornierte Behandlungen zaehlen nicht (Migration 0026)
    .in('verordnung_id', vords.map(v => v.id)) : { data: [] };
  // Dazu die GEPLANTEN Termine (noch nicht dokumentiert): sonst bekommt jeder
  // im Voraus gebuchte Termin einer Serie dieselbe Antwort „noch keine
  // Behandlung → 78040" — siehe geplanteAlsBehandlungen() (module/podo-einheiten.js).
  const { data: geplant } = await ctx.supabase.from('bookings')
    .select('id, start_time, status, no_show, services(gkv_position_nr, code), booking_leistungen(services(gkv_position_nr, code))')
    .eq('owner_id', ctx.getOwnerId()).eq('lead_id', leadId).neq('status', 'cancelled');
  const eigene = document.getElementById('bk-id')?.value || '';
  return [...(behs || []), ...geplanteAlsBehandlungen(geplant, { ohneId: eigene })];
}

/** Befundung vorschlagen — der Telefonablauf aus Karte 221. */
export async function schlageBefundungVor() {
  if (!ctx) return;
  const datum = (document.getElementById('bkStart')?.value || '').slice(0, 10)
             || alsISODatum(new Date());
  const behandlungen = await patientenBehandlungen();
  const selbstzahler = document.getElementById('bkIsSelbstzahler')?.value === '1';

  const ergebnis = mitBefundungsvorschlag({
    zeilen: leseLeistungen(),
    dienste: ctx.getServices?.() || [],
    behandlungen, datum, selbstzahler,
  });

  // Eine fuer den alten Vorschlag gehaekte Zeile faellt mit ihm weg.
  _extra = raeumeAngenommenenVorschlag(ergebnis.zeilen, _vorschlag, ergebnis.vorschlag).slice(1);
  _vorschlag = ergebnis.vorschlag;
  _vorschlagGrund = ergebnis.grund || '';
  zeichneZeilen();
  aktualisiereDauer();
  zeigeHinweis(ergebnis.hinweis, ergebnis.rueckfrage);
}

/**
 * Verdrahtung. Wird einmal aus dashboard.js gerufen.
 *
 * @param {object} deps  { supabase, getOwnerId, getServices, aufEinzelDauer }
 */
export function mountTerminLeistungen(deps) {
  ctx = deps;

  document.getElementById('bkLeistungAdd')?.addEventListener('click', () => {
    const alle = fuegeZeileHinzu(leseLeistungen());
    _extra = alle.slice(1);
    zeichneZeilen();
    aktualisiereDauer();
  });

  document.getElementById('bkLeistungExtra')?.addEventListener('change', e => {
    const reihe = e.target.closest('[data-index]');
    if (!reihe) return;
    const i = Number(reihe.dataset.index) - 1;
    if (!_extra[i]) return;
    if (e.target.dataset.rolle === 'leistung') {
      // ueber das Modell, nicht per Zuweisung: waehlt der Anwender hier die
      // Leistung, die schon oben steht, werden die Zeilen zusammengelegt.
      uebernehmeZeilen(setzeZeilenService(leseLeistungen(), i + 1, e.target.value || null));
    } else if (e.target.dataset.rolle === 'menge') {
      _extra[i].anzahl = begrenzeAnzahl(e.target.value);
    }
    zeichneZeilen();
    aktualisiereDauer();
  });

  document.getElementById('bkLeistungExtra')?.addEventListener('click', e => {
    if (e.target.dataset.rolle !== 'entfernen') return;
    const i = Number(e.target.closest('[data-index]')?.dataset.index || 0);
    _extra = entferneZeile(leseLeistungen(), i).slice(1);
    zeichneZeilen();
    aktualisiereDauer();
  });

  document.getElementById('bkMenge')?.addEventListener('input', aktualisiereDauer);
  // Der Vorschlagstext haengt davon ab, ob eine Serie angelegt wird.
  document.getElementById('bkSeriesToggle')?.addEventListener('change', zeichneVorschlag);

  // Gruppentermine bleiben einzeilig — und das ist kein Versaeumnis.
  // Die Kind-Synchronisierung in dashboard.js schreibt ueber
  // `.eq('group_parent_id', …)` nur Felder der Buchung und kopiert diese
  // Zeilen NICHT mit; der Elterntermin truege dann „78010+78030", die Kinder
  // nur „78010". Dazu kommt, dass Kinder vom no_overlapping_bookings-EXCLUDE
  // ausgenommen sind, laengere Bloecke dort also ungebremst kollidieren.
  // Lieber die Kombination hier zumachen als eine stille Abweichung erzeugen.
  const gruppe = document.getElementById('bkIsGroup');
  const knopfAdd = document.getElementById('bkLeistungAdd');
  function pruefeGruppenmodus() {
    const an = !!gruppe?.checked;
    if (knopfAdd) knopfAdd.hidden = an;
    if (an && _extra.length) {
      _extra = [];
      zeichneZeilen();
      zeigeHinweis('Gruppentermine tragen genau eine Leistung.');
    }
  }
  gruppe?.addEventListener('change', pruefeGruppenmodus);
  pruefeGruppenmodus();

  // Beim Oeffnen der Maske zuruecksetzen. Bewusst hier und nicht in
  // dashboard.js: die Datei darf nicht wachsen (tools/check-dashboard-size.sh),
  // und ein vergessener Aufruf haette die Zeilen des vorigen Patienten in den
  // naechsten Termin getragen — still und teuer.
  const modal = document.getElementById('bookingModal');
  if (modal && typeof MutationObserver === 'function') {
    let warOffen = !modal.hidden;
    new MutationObserver(() => {
      const offen = !modal.hidden;
      if (offen && !warOffen) {
        setzeLeistungenZurueck();
        // Bestehender Termin: seine Zeilen nachladen. Sonst zeigt die Maske
        // eine Zeile, und das Speichern macht daraus die Wahrheit.
        const id = document.getElementById('bk-id')?.value || '';
        if (id) ladeLeistungen(id);
      }
      warOffen = offen;
    }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  }

  // Kurze Verzoegerung, damit dashboard.js' eigener Zuhoerer am selben Feld
  // (updateBkDuration()) zuerst die Einzel-Schaetzung fuer die neue Leistung
  // ins Dauer-Feld schreibt, bevor hier ueber eine zweite Zeile entschieden
  // wird. Falls die Reihenfolge doch einmal kippt, greift zusaetzlich
  // `istKombinierterTermin()` in dashboard.js — die schreibt dann gar nicht erst.
  document.getElementById('bkService')?.addEventListener('change', () => {
    setTimeout(() => { schlageBefundungVor(); }, 60);
  });
  document.getElementById('bkCustomerId')?.addEventListener('change', () => {
    schlageBefundungVor();
  });

  // Selbstzahler-Knopf, Verordnungskarte und „Abwaehlen" aendern die
  // Grundlage des Vorschlags, ohne dass Leistung oder Patient wechseln —
  // an keinem dieser drei haengt bisher ein Zuhoerer. Folge: wer Patient und
  // Leistung waehlt und ERST DANN merkt, dass keine Verordnung vorliegt,
  // behielt die vorgeschlagene Eingangsbefundung in der Maske. Das ist eine
  // GKV-Position (78040) an einem Termin ohne Kasse; sie wurde beim Speichern
  // zu einer echten Leistungszeile. `befundungFuerLeistung()` weist den Fall
  // laengst ab (`nichts('selbstzahler')`) — sie wurde nur nie neu gefragt.
  //
  // Delegation am Modal statt am Knopf: dashboard.js ersetzt
  // #bkSelbstzahlerBtn und #bkVeroDeselect bei jedem prefill durch einen
  // cloneNode-Klon, und die Karten in #bkVeroCards entstehen erst beim Laden
  // des Patienten. Ein direkt gehaengter Zuhoerer waere nach dem ersten
  // prefill weg.
  //
  // Dieselben 60 ms wie oben: der Zuhoerer am Element setzt
  // `bkIsSelbstzahler` bzw. `bkSelectedRxId`, und der Vorschlag liest sie.
  document.getElementById('bookingModal')?.addEventListener('click', (e) => {
    if (!e.target.closest('#bkSelbstzahlerBtn, #bkVeroDeselect, .bk-vero-card')) return;
    setTimeout(() => { schlageBefundungVor(); }, 60);
  });

  // Der fruehere MutationObserver hier (Beobachter auf `#bkDurationOptions`,
  // um eine zu spaete Einzel-Schaetzung aus dashboard.js zurueckzuholen)
  // entfiel mit dem Umbau auf das Zahlenfeld: `updateBkDuration()` in
  // dashboard.js prueft jetzt selbst vor jedem Schreiben, ob hier schon
  // mehr als eine Leistungszeile steht, und laesst das Feld dann in Ruhe.
}
