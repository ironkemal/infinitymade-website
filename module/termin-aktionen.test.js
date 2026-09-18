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
import { waehleVerordnungFuerPanel } from './termin-aktionen.js';

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
