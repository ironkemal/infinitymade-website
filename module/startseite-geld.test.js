import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summeText, monatText, geldKarteHtml, holeGeld } from './startseite-geld.js';

const NBSP = / /g;
const t = (s) => s.replace(NBSP, ' ');

test('summeText: vollständige Summe ohne Hinweis, Tausenderpunkt', () => {
  const r = summeText({ bekanntCent: 123450, gesamtCent: 123450, unbekanntAnzahl: 0 });
  assert.equal(t(r.betrag), '1.234,50 €');
  assert.equal(r.hinweis, '');
});

test('summeText: Unbekannte → „mind.“ + Anzahl, keine Schätzung', () => {
  const r = summeText({ bekanntCent: 5000, gesamtCent: null, unbekanntAnzahl: 2 });
  assert.equal(t(r.betrag), 'mind. 50,00 €');
  assert.equal(r.hinweis, '2 Einträge ohne gültigen Betrag');
  assert.equal(summeText({ bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: 1 }).hinweis, '1 Eintrag ohne gültigen Betrag');
  assert.equal(summeText({ bekanntCent: 0, gesamtCent: null, unbekanntAnzahl: null }).hinweis, 'Teilsumme');
  assert.equal(summeText(null).betrag, '–');
});

test('monatText', () => {
  assert.equal(monatText('2026-10'), 'Oktober 2026');
  assert.equal(monatText('2026-13'), '');
  assert.equal(monatText(undefined), '');
});

test('geldKarteHtml: Zustände laden / fehler / Daten; Text aus umfang, Privat/Ausfall als nicht enthalten', () => {
  assert.match(geldKarteHtml({ laden: true }), /werden geladen/);
  assert.match(geldKarteHtml({ fehler: true }), /data-aktion="geld-neu"/);
  const html = geldKarteHtml({ fehler: true, daten: {
    monat: '2026-10', umfang: { patient: 'Kassiert diesen Monat (erfasst im Kassenbuch)' },
    kassiert: { patient: { bekanntCent: 10000, gesamtCent: 10000, unbekanntAnzahl: 0 }, kasse: { bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0 } },
    offen: { zuzahlung: { bekanntCent: 2000, gesamtCent: null, unbekanntAnzahl: 1 } } } });
  assert.match(html, /Kassiert diesen Monat \(erfasst im Kassenbuch\)/);
  assert.match(html, /Oktober 2026 · alle Standorte/);
  assert.match(html, /mind\. 20,00/);
  assert.match(html, /nicht enthalten/);
  assert.doesNotMatch(html, /geld-neu/, 'letzte gute Zahlen bleiben bei Fehler stehen');
  assert.doesNotMatch(geldKarteHtml({ daten: { umfang: { patient: '<b>x</b>' } } }), /<b>x/);
});

test('holeGeld: Token, Pfad, Blockfehler', async () => {
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } };
  let url, opt;
  const ok = async (u, o) => { url = u; opt = o; return { ok: true, json: async () => ({ bloecke: { geld: { status: 'ok', daten: { monat: '2026-10' } } } }) }; };
  assert.deepEqual(await holeGeld({ supabase, apiBase: 'https://x/api/', fetchFn: ok }), { monat: '2026-10' });
  assert.equal(url, 'https://x/api/startseite/zusammenfassung?bloecke=geld');
  assert.equal(opt.headers.Authorization, 'Bearer tok');
  await assert.rejects(holeGeld({ supabase, apiBase: 'https://x/api', fetchFn: async () => ({ ok: false, status: 403 }) }), /HTTP_403/);
  await assert.rejects(holeGeld({ supabase, apiBase: 'https://x/api', fetchFn: async () => ({ ok: true, json: async () => ({ bloecke: { geld: { status: 'fehler' } } }) }) }), /BLOCK/);
  await assert.rejects(holeGeld({ supabase: { auth: { getSession: async () => ({ data: {} }) } }, apiBase: 'x' }), /KEINE_SITZUNG/);
});
