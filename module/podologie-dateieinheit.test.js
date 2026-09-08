// Dateieinheit je Kasse (Ops #283).
//   node --test module/podologie-dateieinheit.test.js
//
// Importierbar in node, weil der Modulrumpf kein `document` anfasst — anders
// als podologie-abrechnung.js, die deshalb nur einen Bauart-Test hat.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  initDateieinheit, ladeDateieinheiten, dateieinheitVon,
  gruppiereNachDatei, dateieinheitBadge, auswahlHinweis,
} from './podologie-dateieinheit.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Antwort des Backends nachstellen. Die IK-Vergabe:
//   AOK1/AOK2 → dieselbe Annahmestelle+Kassenart (eine Dateieinheit)
//   EK1       → andere Annahmestelle
//   TOT       → nicht auflösbar
const ANTWORT = {
  '101000001': { aufloesbar: true, davIk: '660500345', davName: 'AOK DAS', kassenart: 'AO', dateieinheit: '660500345|AO', ueberSammelschluessel: false },
  '101000002': { aufloesbar: true, davIk: '660500345', davName: 'AOK DAS', kassenart: 'AO', dateieinheit: '660500345|AO', ueberSammelschluessel: true },
  '101575519': { aufloesbar: true, davIk: '661430035', davName: 'vdek DAS', kassenart: 'EK', dateieinheit: '661430035|EK', ueberSammelschluessel: false },
  '109999999': { aufloesbar: false, grund: 'keine elektronische Datenannahmestelle hinterlegt' },
};

let letzteAnfrage = null;

function stelleUmgebung({ scheitern = false } = {}) {
  letzteAnfrage = null;
  globalThis.fetch = async (url, opt) => {
    letzteAnfrage = { url, body: JSON.parse(opt.body) };
    if (scheitern) throw new Error('Netz weg');
    const iks = letzteAnfrage.body.iks;
    const annahmestellen = {};
    for (const ik of iks) if (ANTWORT[ik]) annahmestellen[ik] = ANTWORT[ik];
    return { ok: true, json: async () => ({ ok: true, annahmestellen }) };
  };
  initDateieinheit({
    apiBase: 'https://test.example/api',
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
  });
}

// Der Cache lebt im Modul und ueber die Tests hinweg — die Reihenfolge ist
// deshalb Absicht: erst der Fehlerfall (leerer Cache), dann das Laden.

test('ein gescheiterter Aufruf wirft nicht und cacht nichts', async () => {
  stelleUmgebung({ scheitern: true });
  assert.equal(await ladeDateieinheiten(['101000001']), false);
  assert.equal(dateieinheitVon('101000001'), null);
  // Ohne Wissen ist alles „ungeklaert" — und die Kasse bleibt bedienbar.
  const g = gruppiereNachDatei(['101000001']);
  assert.deepEqual(g.ungeklaert, ['101000001']);
  assert.equal(g.dateieinheiten.size, 0);
  assert.equal(dateieinheitBadge('101000001', escapeHtml), '',
    'ohne Wissen kein Abzeichen — ein Platzhalter verunsichert mehr, als er erklaert');
});

test('laedt nur die unbekannten IKs und cacht sie', async () => {
  stelleUmgebung();
  assert.equal(await ladeDateieinheiten(['101000001', '101000001']), true);
  assert.deepEqual(letzteAnfrage.body.iks, ['101000001'], 'Duplikate muessen zusammenfallen');
  assert.equal(dateieinheitVon('101000001').davIk, '660500345');

  // Zweiter Aufruf mit derselben IK darf gar nicht erst ans Netz gehen.
  letzteAnfrage = null;
  assert.equal(await ladeDateieinheiten(['101000001']), false);
  assert.equal(letzteAnfrage, null);
});

test('gruppiert nach Dateieinheit, nicht nach Kasse', async () => {
  stelleUmgebung();
  await ladeDateieinheiten(['101000001', '101000002', '101575519', '109999999']);

  const g = gruppiereNachDatei(['101000001', '101000002', '101575519', '109999999']);
  assert.equal(g.dateieinheiten.size, 2, 'zwei Annahmestellen → zwei Einheiten');
  assert.deepEqual(g.dateieinheiten.get('660500345|AO'), ['101000001', '101000002']);
  assert.deepEqual(g.dateieinheiten.get('661430035|EK'), ['101575519']);
  assert.deepEqual(g.nichtAufloesbar, ['109999999']);
  assert.deepEqual(g.ungeklaert, []);
});

test('der Hinweis nennt Dateien, Begleitzettel und Annahmestellen', async () => {
  stelleUmgebung();
  await ladeDateieinheiten(Object.keys(ANTWORT));

  assert.equal(auswahlHinweis([]), 'Keine Kasse ausgewählt.');

  const einer = auswahlHinweis(['101000001']);
  assert.ok(einer.includes('1 Kasse ausgewählt'));
  assert.ok(einer.includes('1 Datei'));
  assert.ok(einer.includes('1 Begleitzettel'));

  // Der Punkt der ganzen Uebung: drei Kassen sind drei Dateien und drei
  // Umschlaege, auch wenn zwei davon zur selben Annahmestelle gehen.
  const drei = auswahlHinweis(['101000001', '101000002', '101575519']);
  assert.ok(drei.includes('3 Kassen ausgewählt'), drei);
  assert.ok(drei.includes('3 Dateien'), drei);
  assert.ok(drei.includes('3 Begleitzettel'), drei);
  assert.ok(drei.includes('an 2 Annahmestellen'), drei);
});

test('eine Kasse ohne Annahmestelle wird im Hinweis benannt', async () => {
  stelleUmgebung();
  await ladeDateieinheiten(Object.keys(ANTWORT));
  const h = auswahlHinweis(['101000001', '109999999']);
  assert.ok(h.includes('1 ohne Annahmestelle (wird abgelehnt)'), h);
});

test('das Abzeichen zeigt Kassenart und Annahmestelle, das rote den Grund', async () => {
  stelleUmgebung();
  await ladeDateieinheiten(Object.keys(ANTWORT));

  const gut = dateieinheitBadge('101000001', escapeHtml);
  assert.ok(gut.includes('AO'));
  assert.ok(gut.includes('660500345'));
  assert.ok(gut.includes('AOK DAS'), 'der Klarname gehoert in den Tooltip');

  const ueberSammel = dateieinheitBadge('101000002', escapeHtml);
  assert.ok(ueberSammel.includes('Sammelschlüssel'),
    'ueber den Sammelschluessel aufgeloest — das muss sichtbar bleiben');

  const schlecht = dateieinheitBadge('109999999', escapeHtml);
  assert.ok(schlecht.includes('keine Annahmestelle'));
  assert.ok(schlecht.includes('#ef4444'), 'muss rot sein');
});
