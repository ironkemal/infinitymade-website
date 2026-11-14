import test from 'node:test';
import assert from 'node:assert/strict';
import { geldAuswerten, ladeGeld, geldHtml, monatText } from './startseite-geld.js';

const ANTWORT = {
  monatlich: [{ monat: '2026-10', umsatz: 900, bezahlt: 120, offen: 0 }, { monat: '2026-11', umsatz: 500, bezahlt: 84.5, offen: 30 }],
  offene_zuzahlungen: 3, offene_zuzahlungen_summe: 30, offen_gesamt_summe: 72,
  ausfallrechnungen: { offen: 1, offen_summe: 42, bezahlt: 2 },
  mahnungen: { gesamt: 4, bezahlt: 1, offen: 3 },
  aerzte: [{ arzt_name: 'darf nicht auftauchen' }],
};
const sb = (token = 't') => ({ auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) } });
const antwort = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });

test('geldAuswerten liest nur die Kartenwerte, letzter Monat = laufender', () => {
  assert.deepEqual(geldAuswerten(ANTWORT), {
    monat: '2026-11', kassiert: 84.5,
    zuzahlungen: { anzahl: 3, summe: 30 }, ausfall: { anzahl: 1, summe: 42 }, offenGesamt: 72, mahnungenOffen: 3,
  });
});

test('geldAuswerten: kaputte Antwort → null, fehlende Felder → null statt 0', () => {
  assert.equal(geldAuswerten(null), null);
  assert.equal(geldAuswerten({ monatlich: 'x' }), null);
  const d = geldAuswerten({ monatlich: [] });
  assert.equal(d.kassiert, null);
  assert.equal(d.zuzahlungen.summe, null);
  assert.equal(d.mahnungenOffen, null);
  assert.equal(geldAuswerten({ monatlich: [{ bezahlt: 'NaN' }], offene_zuzahlungen: -1 }).zuzahlungen.anzahl, null);
});

test('ladeGeld: ruft nur /billing/statistik?monate=1 mit Bearer-Token', async () => {
  const aufrufe = [];
  const r = await ladeGeld({ supabase: sb('abc'), apiBase: 'https://x/api', fetchFn: async (url, opt) => { aufrufe.push([url, opt.headers.Authorization]); return antwort(200, ANTWORT)(); } });
  assert.equal(r.status, 'ok');
  assert.deepEqual(aufrufe, [['https://x/api/billing/statistik?monate=1', 'Bearer abc']]);
});

test('ladeGeld: ohne Token kein Request, Fehler/403 → fehler, Abbruch → abgebrochen', async () => {
  let n = 0;
  assert.equal((await ladeGeld({ supabase: sb(null), apiBase: 'a', fetchFn: async () => { n++; } })).status, 'fehler');
  assert.equal(n, 0);
  const warn = console.warn; const logs = []; console.warn = (...a) => logs.push(a.join(' '));
  try {
    assert.equal((await ladeGeld({ supabase: sb(), apiBase: 'a', fetchFn: antwort(403, { code: 'NUR_INHABER' }) })).status, 'fehler');
    assert.equal((await ladeGeld({ supabase: sb(), apiBase: 'a', fetchFn: antwort(200, { kaputt: 1 }) })).status, 'fehler');
    assert.equal((await ladeGeld({ supabase: sb(), apiBase: 'a', fetchFn: async () => { throw new TypeError('netz'); } })).status, 'fehler');
    const c = new AbortController(); c.abort();
    assert.equal((await ladeGeld({ supabase: sb(), apiBase: 'a', signal: c.signal, fetchFn: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } })).status, 'abgebrochen');
  } finally { console.warn = warn; }
  assert.ok(logs.every(l => !/\d+,\d{2}|€/.test(l)), 'keine Beträge im Log');
});

test('geldHtml: laden, fehler (mit Erneut), ok ohne Arztdaten und ohne „Umsatz“', () => {
  assert.match(geldHtml({ status: 'laden' }), /werden geladen/);
  const f = geldHtml({ status: 'fehler' });
  assert.match(f, /nicht verfügbar/);
  assert.match(f, /data-aktion="geld-neu"/);
  assert.doesNotMatch(f, /0,00/);
  const ok = geldHtml({ status: 'ok', daten: geldAuswerten(ANTWORT) });
  assert.match(ok, /84,50 €/);
  assert.match(ok, /3 · 30,00 €/);
  assert.match(ok, /1 · 42,00 €/);
  assert.doesNotMatch(ok, /Umsatz|darf nicht/);
});

test('geldHtml: unbekannte Werte zeigen „–“, nie 0 €', () => {
  const html = geldHtml({ status: 'ok', daten: geldAuswerten({ monatlich: [] }) });
  assert.doesNotMatch(html, /0,00 €/);
  assert.match(html, /–/);
});

test('monatText', () => {
  const jetzt = new Date('2026-11-14T12:00:00Z');
  assert.equal(monatText('2026-11', jetzt), 'November');
  assert.equal(monatText('2025-12', jetzt), 'Dezember 2025');
  assert.equal(monatText('2026-13', jetzt), '');
  assert.equal(monatText(null, jetzt), '');
});
