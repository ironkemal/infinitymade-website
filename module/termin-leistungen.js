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
/** Verhindert, dass die eigene Dauer-Schreibung sich selbst wieder anstoesst. */
let _schreibtDauer = false;

/** Alle Zeilen: Zeile 0 aus dem DOM, danach die Zusatzzeilen. */
export function leseLeistungen() {
  const haupt = document.getElementById('bkService')?.value || null;
  const menge = begrenzeAnzahl(document.getElementById('bkMenge')?.value);
  return [{ serviceId: haupt || null, anzahl: menge, auto: false, grund: '' },
          ..._extra.map(z => ({ ...z }))];
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

/** Beim Oeffnen der Maske: alles zurueck auf eine Zeile. */
export function setzeLeistungenZurueck() {
  _extra = [];
  const menge = document.getElementById('bkMenge');
  if (menge) menge.value = '1';
  zeichneZeilen();
  zeigeHinweis('');
}

/**
 * Die Zeilen dieses Termins speichern.
 *
 * Erst loeschen, dann schreiben — beim Bearbeiten eines Termins kann eine Zeile
 * weggefallen sein, und ein reines Upsert liesse sie stehen. `service_id` auf
 * `bookings` wird NICHT geschrieben: das erledigt trg_booking_hauptleistung
 * aus der Zeile mit sort_order 0. Zwei Schreiber auf dasselbe Feld waeren zwei
 * Wahrheiten.
 *
 * @param {string} bookingId
 * @returns {Promise<{ok:boolean, error:?string}>}
 */
export async function speichereLeistungen(bookingId) {
  if (!ctx || !bookingId) return { ok: false, error: 'kein Termin' };
  const zeilen = leseLeistungen().filter(z => z.serviceId);
  if (!zeilen.length) return { ok: false, error: 'keine Leistung' };

  const { error: delErr } = await ctx.supabase
    .from('booking_leistungen').delete().eq('booking_id', bookingId);
  if (delErr) return { ok: false, error: delErr.message };

  const { error } = await ctx.supabase.from('booking_leistungen').insert(
    zeilen.map((z, i) => ({
      booking_id: bookingId,
      service_id: z.serviceId,
      owner_id: ctx.getOwnerId(),
      anzahl: begrenzeAnzahl(z.anzahl),
      sort_order: i,
    })),
  );
  return error ? { ok: false, error: error.message } : { ok: true, error: null };
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
}

function zeigeHinweis(text, rueckfrage = null) {
  const el = document.getElementById('bkLeistungHinweis');
  if (!el) return;
  const stuecke = [text, rueckfrage].filter(Boolean);
  el.textContent = stuecke.join(' — ');
  el.hidden = stuecke.length === 0;
}

/**
 * Dauer neu rechnen und in die Dauerauswahl schreiben.
 *
 * Bei einer einzigen Zeile bleibt `updateBkDuration()` aus dashboard.js
 * zustaendig — dort haengen die Preisstufen aus `price_config`. Erst ab zwei
 * Zeilen uebernimmt die Summe, in derselben Form, die der Speicherpfad ohnehin
 * liest (das angehakte Radio in `#bkDurationOptions`).
 */
function aktualisiereDauer() {
  const zeilen = leseLeistungen().filter(z => z.serviceId);
  if (zeilen.length < 2) return;

  const optionen = document.getElementById('bkDurationOptions');
  const gruppe = document.getElementById('bkDurationGroup');
  if (!optionen) return;

  const minuten = gesamtDauer(zeilen, ctx?.getServices?.() || []);
  _schreibtDauer = true;
  optionen.innerHTML = `<label class="bk-dur-option">
    <input type="radio" name="bkDuration" value="${minuten}" checked>
    <span>${minuten} Min (kombiniert)</span>
  </label>`;
  if (gruppe) gruppe.hidden = false;
  window._selectedBkDuration = minuten;
  _schreibtDauer = false;
}

/** Historie des gewaehlten Patienten — Grundlage des Befundungsvorschlags. */
async function patientenBehandlungen() {
  const leadId = document.getElementById('bkCustomerId')?.value || '';
  if (!ctx?.supabase || !leadId) return [];
  const { data: vords } = await ctx.supabase.from('verordnungen')
    .select('id').eq('owner_id', ctx.getOwnerId()).eq('lead_id', leadId);
  if (!vords?.length) return [];
  const { data: behs } = await ctx.supabase.from('podologie_behandlungen')
    .select('behandlungsdatum, hpnr_codes')
    .eq('owner_id', ctx.getOwnerId())
    .in('verordnung_id', vords.map(v => v.id));
  return behs || [];
}

/** Befundung vorschlagen — der Telefonablauf aus Karte 221. */
async function schlageBefundungVor() {
  if (!ctx) return;
  const datum = (document.getElementById('bkStart')?.value || '').slice(0, 10)
             || new Date().toISOString().slice(0, 10);
  const behandlungen = await patientenBehandlungen();
  const selbstzahler = document.getElementById('bkIsSelbstzahler')?.value === '1';

  const ergebnis = mitBefundungsvorschlag({
    zeilen: leseLeistungen(),
    dienste: ctx.getServices?.() || [],
    behandlungen, datum, selbstzahler,
  });

  _extra = ergebnis.zeilen.slice(1);
  zeichneZeilen();
  aktualisiereDauer();
  zeigeHinweis(ergebnis.hinweis, ergebnis.rueckfrage);
}

/**
 * Verdrahtung. Wird einmal aus dashboard.js gerufen.
 *
 * @param {object} deps  { supabase, getOwnerId, getServices }
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
      _extra[i].serviceId = e.target.value || null;
      _extra[i].auto = false;   // von Hand bestaetigt, kein Vorschlag mehr
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
      if (offen && !warOffen) setzeLeistungenZurueck();
      warOffen = offen;
    }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  }

  // Nach dashboard.js laufen: dessen Zuhoerer am selben Feld ruft
  // updateBkDuration() und schreibt `#bkDurationOptions` neu, teils verzoegert.
  // Wer hier sofort rechnet, wird gleich darauf ueberschrieben.
  document.getElementById('bkService')?.addEventListener('change', () => {
    setTimeout(() => { schlageBefundungVor(); }, 60);
  });
  document.getElementById('bkCustomerId')?.addEventListener('change', () => {
    schlageBefundungVor();
  });

  // Falls dashboard.js die Dauer spaeter noch einmal neu setzt (Preisstufen
  // einer einzelnen Leistung), die Summe zurueckholen — sonst buchte die Maske
  // zwei Leistungen und blockte die Zeit fuer eine.
  const optionen = document.getElementById('bkDurationOptions');
  if (optionen && typeof MutationObserver === 'function') {
    new MutationObserver(() => {
      if (_schreibtDauer) return;
      if (leseLeistungen().filter(z => z.serviceId).length > 1) aktualisiereDauer();
    }).observe(optionen, { childList: true });
  }
}
