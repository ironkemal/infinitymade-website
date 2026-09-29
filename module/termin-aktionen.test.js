// waehleVerordnungFuerPanel() — Regression vom 19.09.2026.
//
// Zwei Bugs in einer Sitzung, beide in derselben Funktion, keiner davon von
// einem Test gefangen (die Datei hatte bis dahin gar keinen). Kurzfassung:
// `liste` schliesst Podologie bewusst aus (sie fuettert das Physio-Einheiten-
// Hauptbuch, das Podologie nicht fuehrt) — aber dieselbe `liste` diente auch
// dazu, eine ANGEFORDERTE Verordnung (Klick auf eine Karte in
// "Aktive Verordnungen") zu verifizieren. Eine Podologie-Anforderung konnte
// darin nie stehen, also fiel jeder Kartenklick lautlos auf die ohnehin schon
// verknuepfte Verordnung zurueck — bei einem reinen Podologie-Patienten sogar
// schon VOR dem Fix-Versuch, weil `liste` dann leer ist und die Funktion
// (im ersten Fix-Anlauf) davor mit `return leer` abbrach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  waehleVerordnungFuerPanel, frequenzErkannt, normalisierePodoFrequenz,
  verteileOffeneSitzungen, uebernimmSerienfrequenzAusRx,
} from './termin-aktionen.js';

/**
 * Minimaler Supabase-Ersatz. Thenable statt eines festen Terminal-Aufrufs,
 * weil `waehleVerordnungFuerPanel` je nach Tabelle unterschiedlich terminiert
 * (`.limit()`, `.maybeSingle()`, oder direkt nach `.eq()`).
 *
 * @param {object} stand
 * @param {object[]} stand.liste           Antwort der Physio/Ergo/Logo-Liste
 * @param {(id:string) => object|null} [stand.direkt]  Antwort des Direkt-Lookups nach id
 * @param {number} [stand.count]           Antwort der `prescription_sessions`-Zählung
 */
function fakeSupabase({ liste = [], direkt = () => null, count = 0 } = {}) {
  const rufe = [];
  function baueBuilder(tabelle) {
    const filter = {};
    const api = {
      select: () => api,
      not: () => api,
      or: () => api,
      order: () => api,
      limit: () => Promise.resolve({ data: liste, error: null }),
      eq: (spalte, wert) => { filter[spalte] = wert; return api; },
      maybeSingle: () => {
        rufe.push({ tabelle, filter: { ...filter }, art: 'maybeSingle' });
        return Promise.resolve({ data: direkt(filter.id), error: null });
      },
      then: (resolve, reject) => {
        // Nur `prescription_sessions` wird ohne Terminal-Aufruf awaited
        // (`.eq('status','done')` ist der letzte Aufruf vor `await`).
        rufe.push({ tabelle, filter: { ...filter }, art: 'count' });
        return Promise.resolve({ count, error: null }).then(resolve, reject);
      },
    };
    return api;
  }
  return { from: (tabelle) => baueBuilder(tabelle), rufe };
}

test('Podologie-Patient ohne Physio-Verordnungen: Kartenklick wird trotz leerer liste gefunden', () => {
  return (async () => {
    const podoRx = { id: 'podo-neu', patient_id: 'pat-1', heilmittel: null, anzahl_einheiten: 3, therapie_bereich: 'podo' };
    // liste: leer — der Patient hat KEINE Physio/Ergo/Logo-Verordnung (Normalfall
    // in der Podologie). Genau das brach im ersten Fix-Anlauf vorzeitig ab.
    const sb = fakeSupabase({ liste: [], direkt: (id) => (id === 'podo-neu' ? podoRx : null), count: 0 });
    const stand = await waehleVerordnungFuerPanel({
      supabase: sb,
      booking: { lead_id: 'pat-1' },
      verknuepfteSession: null,
      gewuenschteRxId: 'podo-neu',
    });
    assert.equal(stand.rx?.id, 'podo-neu', 'die angeklickte Podologie-Karte muss gewinnen, nicht `leer`');
  })();
});

test('Podologie-Kartenklick übersteuert die am Termin verknüpfte Verordnung', () => {
  return (async () => {
    const alteVerknuepfte = { id: 'alt-verknuepft', patient_id: 'pat-1', therapie_bereich: 'podo' };
    const neueKarte = { id: 'podo-b', patient_id: 'pat-1', heilmittel: 'Komplexbehandlung', therapie_bereich: 'podo' };
    const sb = fakeSupabase({ liste: [], direkt: (id) => (id === 'podo-b' ? neueKarte : null), count: 0 });
    const stand = await waehleVerordnungFuerPanel({
      supabase: sb,
      booking: { lead_id: 'pat-1' },
      verknuepfteSession: { prescriptions: alteVerknuepfte },
      gewuenschteRxId: 'podo-b',
    });
    assert.equal(stand.rx?.id, 'podo-b',
      'ein expliziter Kartenklick muss gewinnen — vorher blieb es bei `alt-verknuepft`, egal welche Karte man klickte');
  })();
});

test('Physio-Verordnung wird weiterhin direkt aus liste gefunden — kein unnötiger Zweit-Lookup', () => {
  return (async () => {
    const physioRx = { id: 'physio-1', patient_id: 'pat-1', therapie_bereich: null };
    const sb = fakeSupabase({ liste: [physioRx], direkt: () => { throw new Error('haette nicht aufgerufen werden duerfen'); } });
    const stand = await waehleVerordnungFuerPanel({
      supabase: sb,
      booking: { lead_id: 'pat-1' },
      verknuepfteSession: null,
      gewuenschteRxId: 'physio-1',
    });
    assert.equal(stand.rx?.id, 'physio-1');
    assert.deepEqual(stand.liste, [physioRx]);
  })();
});

test('ohne Wunsch bleibt es bei der am Termin verknüpften Verordnung (Normalfall)', () => {
  return (async () => {
    const verknuepft = { id: 'verknuepft-1', patient_id: 'pat-1', therapie_bereich: null };
    const sb = fakeSupabase({ liste: [verknuepft] });
    const stand = await waehleVerordnungFuerPanel({
      supabase: sb,
      booking: { lead_id: 'pat-1' },
      verknuepfteSession: { prescriptions: verknuepft },
      gewuenschteRxId: null,
    });
    assert.equal(stand.rx?.id, 'verknuepft-1');
  })();
});

test('ohne Patientenbezug (weder verknüpft noch angefragt) bleibt es leer', () => {
  return (async () => {
    const sb = fakeSupabase({ liste: [] });
    const stand = await waehleVerordnungFuerPanel({
      supabase: sb,
      booking: {},
      verknuepfteSession: null,
      gewuenschteRxId: null,
    });
    assert.equal(stand.rx, null);
    assert.deepEqual(stand.liste, []);
  })();
});

// ═══════════════════════════════════════════════════════════════════════════
// S1.8-Nachbesserung (29.09.2026, podoloji-Denetim): Frequenz podologischer
// Verordnungen wird vor der Serienplanung geprüft — unerkannter Freitext fiel
// bisher lautlos auf "1x pro Woche" (frequenzToSeries, dashboard.js).
// ═══════════════════════════════════════════════════════════════════════════

test('frequenzErkannt: die drei Regeln — täglich, N pro Woche, N(–M) Wochen', () => {
  for (const t of [
    'Täglich', '2x täglich', '3x pro Woche', '1–2x pro Woche',
    '1x alle 4 Wochen', '1x alle 4–6 Wochen', 'Flex (1–8 Wochen)', 'alle 4-6 wochen',
  ]) assert.equal(frequenzErkannt(t), true, t);
});

test('frequenzErkannt: die im Prod-Fund genannten Freitexte bleiben UNERKANNT', () => {
  for (const t of ['4–6 wöchig', 'monatlich', 'alle 4-6 Wo.', '', null, undefined]) {
    assert.equal(frequenzErkannt(t), false, String(t));
  }
});

test('normalisierePodoFrequenz: erkannte Frequenz bleibt unverändert, kein Hinweis', () => {
  const r = normalisierePodoFrequenz('1x alle 4–6 Wochen');
  assert.equal(r.frequenz, '1x alle 4–6 Wochen');
  assert.equal(r.hinweis, null);
});

test('normalisierePodoFrequenz: leer -> Standard + Hinweis ohne Rohwert', () => {
  const r = normalisierePodoFrequenz('');
  assert.equal(r.frequenz, '1x alle 4 Wochen');
  assert.match(r.hinweis, /nicht erkannt/);
  assert.match(r.hinweis, /1x alle 4 Wochen/);
});

test('normalisierePodoFrequenz: unerkannter Freitext -> Standard + Hinweis MIT Rohwert', () => {
  const r = normalisierePodoFrequenz('4–6 wöchig');
  assert.equal(r.frequenz, '1x alle 4 Wochen');
  assert.match(r.hinweis, /4–6 wöchig/, 'der ursprüngliche Text muss in der Meldung stehen');
});

// ── verteileOffeneSitzungen: Frequenz + Hausbesuch nur für Podologie ─────────

function fakePresetLauf() {
  // `verteileOffeneSitzungen` schreibt `window._physioFlow` (Brücke zur
  // Serienplanung) — im Node-Testlauf existiert `window` sonst nicht.
  globalThis.window = globalThis;
  const toasts = [];
  const serien = [];
  return {
    toasts, serien,
    deps: {
      patientId: 'pat-1',
      schliessePanel: () => {},
      starteSerienplanung: async (preset) => { serien.push(preset); },
      toast: (msg, art) => toasts.push({ msg, art }),
    },
  };
}

test('verteileOffeneSitzungen: Podologie, Frequenz fehlt -> Standard im Preset + Warn-Toast', async () => {
  const { toasts, serien, deps } = fakePresetLauf();
  await verteileOffeneSitzungen({
    rx: { id: 'rx-1', therapie_bereich: 'podo', frequenz: '', heilmittel: 'Hornhautabtragung' },
    offen: 3, booking: {}, ...deps,
  });
  assert.equal(serien[0].frequenz, '1x alle 4 Wochen');
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].art, 'warning');
});

test('verteileOffeneSitzungen: Podologie, erkannte Frequenz -> unverändert, kein Toast', async () => {
  const { toasts, serien, deps } = fakePresetLauf();
  await verteileOffeneSitzungen({
    rx: { id: 'rx-1', therapie_bereich: 'podo', frequenz: '1x alle 6 Wochen', heilmittel: 'x' },
    offen: 2, booking: {}, ...deps,
  });
  assert.equal(serien[0].frequenz, '1x alle 6 Wochen');
  assert.deepEqual(toasts, []);
});

test('verteileOffeneSitzungen: Physio/Ergo/Logo (therapie_bereich != podo) -> keine Normalisierung, kein Toast', async () => {
  const { toasts, serien, deps } = fakePresetLauf();
  await verteileOffeneSitzungen({
    rx: { id: 'rx-1', therapie_bereich: null, frequenz: '4–6 wöchig', heilmittel: 'KG' },
    offen: 4, booking: {}, ...deps,
  });
  // Unverändert durchgereicht, auch wenn frequenzErkannt() das ablehnen würde —
  // die Prüfung ist bewusst auf Podologie beschränkt (Physio hat eigenes Buch).
  assert.equal(serien[0].frequenz, '4–6 wöchig');
  assert.deepEqual(toasts, []);
});

test('verteileOffeneSitzungen: Hausbesuch der Verordnung greift nur bei Podologie und nur als Ergänzung', async () => {
  const { serien, deps } = fakePresetLauf();
  await verteileOffeneSitzungen({
    rx: { id: 'rx-1', therapie_bereich: 'podo', frequenz: '1x alle 4 Wochen', hausbesuch: true },
    offen: 1, booking: { hausbesuch: false }, ...deps,
  });
  assert.equal(serien[0].hausbesuch, true, 'Verordnung sagt Hausbesuch — muss übernommen werden');
});

test('verteileOffeneSitzungen: Termin-Hausbesuch gewinnt weiterhin, auch ohne Verordnungsangabe', async () => {
  const { serien, deps } = fakePresetLauf();
  await verteileOffeneSitzungen({
    rx: { id: 'rx-1', therapie_bereich: 'podo', frequenz: '1x alle 4 Wochen' },
    offen: 1, booking: { hausbesuch: true }, ...deps,
  });
  assert.equal(serien[0].hausbesuch, true);
});

test('verteileOffeneSitzungen: Physio-rx.hausbesuch wird NICHT übernommen (unveränderter Physio-Pfad)', async () => {
  const { serien, deps } = fakePresetLauf();
  await verteileOffeneSitzungen({
    // Physio-Aufrufer (dashboard.js loadRxSessionsPanel) liefert an dieser
    // Stelle normalerweise gar kein `hausbesuch` — hier absichtlich TRUE
    // gesetzt, um zu beweisen, dass es ignoriert wird, falls es doch mal da ist.
    rx: { id: 'rx-1', therapie_bereich: null, frequenz: '2x pro Woche', hausbesuch: true },
    offen: 2, booking: { hausbesuch: false }, ...deps,
  });
  assert.equal(serien[0].hausbesuch, false, 'Physio-Verhalten darf sich durch die Podologie-Änderung nicht ändern');
});

// ── uebernimmSerienfrequenzAusRx: Wochentag-Kästchen ─────────────────────────

// `Option` ist ein Browser-Global (setFreqValue nutzt es für unbekannte
// Freitext-Werte) — im Node-Testlauf existiert es nicht, hier minimal nachgebaut.
if (typeof globalThis.Option === 'undefined') {
  globalThis.Option = function FakeOption(value, text) { this.value = value; this.text = text ?? value; };
}

/** Baut `#bkSeriesRecurrence` (Select) + `#bkSeriesWeekdays` (Checkboxen) + `#bkStart`. */
function bauSeriesDom({ freqOptions = [], vorabAngehakt = [] } = {}) {
  const recSelect = {
    tagName: 'SELECT',
    options: freqOptions.map(v => ({ value: v, text: v })),
    value: '',
    add(opt) { this.options.push(opt); },
  };
  const boxen = [0, 1, 2, 3, 4, 5, 6].map(v => ({ value: String(v), checked: vorabAngehakt.includes(v) }));
  const startInput = { value: '' };
  const els = { bkSeriesRecurrence: recSelect, bkStart: startInput };
  globalThis.document = {
    getElementById: (id) => els[id] || null,
    querySelectorAll: (sel) => (sel === '#bkSeriesWeekdays input' ? boxen : []),
  };
  return { recSelect, boxen, startInput };
}

test('uebernimmSerienfrequenzAusRx: ohne Frequenz passiert nichts', () => {
  const { boxen } = bauSeriesDom({ vorabAngehakt: [1, 3, 5] });
  uebernimmSerienfrequenzAusRx({ frequenz: '' });
  assert.deepEqual(boxen.map(b => b.checked), [false, true, false, true, false, true, false]);
});

test('uebernimmSerienfrequenzAusRx: "N pro Woche" verteilt über die Woche (unverändertes Verhalten)', () => {
  const { boxen, startInput } = bauSeriesDom();
  startInput.value = '2026-10-05T09:00';   // Starttag wird unten aus demselben Datum berechnet
  const startTag = new Date('2026-10-05T12:00:00Z').getUTCDay();
  uebernimmSerienfrequenzAusRx({ frequenz: '3x pro Woche' });
  const angehakt = boxen.filter(b => b.checked).map(b => Number(b.value));
  assert.equal(angehakt.length, 3);
  assert.ok(angehakt.includes(startTag), 'der Starttag selbst muss dabei sein');
});

// Der S1.8-Fund: "alle N Wochen" liess die Kästchen einer früheren Auswahl
// stehen — batch-create (api-backend/server.js) legt dann für JEDEN
// angehakten Tag einen Termin JE Intervall an.
test('uebernimmSerienfrequenzAusRx: "1x alle 4 Wochen" räumt alte Haken weg, nur der Starttag bleibt', () => {
  const { boxen, startInput } = bauSeriesDom({ vorabAngehakt: [1, 3, 5] });   // Mo/Mi/Fr von einer früheren "3x pro Woche"-Serie
  startInput.value = '2026-10-06T09:00';
  const startTag = new Date('2026-10-06T12:00:00Z').getUTCDay();
  uebernimmSerienfrequenzAusRx({ frequenz: '1x alle 4 Wochen' });
  const angehakt = boxen.filter(b => b.checked).map(b => Number(b.value));
  assert.deepEqual(angehakt, [startTag], 'genau ein Kästchen — der Starttag, nichts von der alten Auswahl');
});

test('uebernimmSerienfrequenzAusRx: "Täglich" räumt ebenfalls auf (Kästchen zählen dort nicht, aber sollen nicht lügen)', () => {
  const { boxen, startInput } = bauSeriesDom({ vorabAngehakt: [2, 4] });
  startInput.value = '2026-10-07T09:00';
  const startTag = new Date('2026-10-07T12:00:00Z').getUTCDay();
  uebernimmSerienfrequenzAusRx({ frequenz: 'Täglich' });
  const angehakt = boxen.filter(b => b.checked).map(b => Number(b.value));
  assert.deepEqual(angehakt, [startTag]);
});

test('uebernimmSerienfrequenzAusRx: ohne Wochentag-Kästchen im DOM kein Absturz', () => {
  const recSelect = { options: [], value: '', add(opt) { this.options.push(opt); } };
  globalThis.document = {
    getElementById: (id) => (id === 'bkSeriesRecurrence' ? recSelect : { value: '' }),
    querySelectorAll: () => [],
  };
  assert.doesNotThrow(() => uebernimmSerienfrequenzAusRx({ frequenz: '1x alle 4 Wochen' }));
});
