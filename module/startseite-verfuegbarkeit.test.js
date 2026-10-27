import test from 'node:test';
import assert from 'node:assert/strict';
import { freieZeitHtml, wocheHtml, minutenText, holeVerfuegbarkeit } from './startseite-verfuegbarkeit.js';
const tag = { status: 'ok', grund: null, minimumMin: 30, luecken: [{ userId: 'own', freiMin: 60,
  intervalle: [{ von: '11:00', bis: '12:00' }], starts: [
    { start: '11:00', serviceId: 's', dauerMin: 30, art: 'frei' },
    { start: '12:30', serviceId: 'g', dauerMin: 30, art: 'gruppenrestplatz' }
  ] }] };
test('Minuten bleiben belegte Minuten, kein Slotzählen', () => {
  assert.equal(minutenText(75), '1 Std 15 Min'); assert.equal(minutenText(0), '0 Min'); assert.equal(minutenText(null), '–');
  const html = freieZeitHtml({ daten: tag }, { behandlerName: () => 'Behandler <b>', serviceName: () => 'Behandlung <b>' });
  assert.match(html, /1 Std frei/); assert.match(html, /11:00–12:00/);
  assert.match(html, /Gruppenrestplätze: 1 mögliche Startzeit/);
  assert.match(html, /Startzeiten ansehen \(2\)/); assert.match(html, /Behandler &lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/); assert.match(html, /keine Buchbarkeitsgarantie/);
});
test('Tag kennt Laden, Unknown, Fehler, Leer und Altstand ohne Fake-Frei', () => {
  assert.match(freieZeitHtml({ laden: true }), /werden geladen/);
  assert.match(freieZeitHtml({ daten: { status: 'unbekannt', grund: 'QUELLEN_UNVOLLSTAENDIG', luecken: null } }), /derzeit unbekannt/);
  assert.doesNotMatch(freieZeitHtml({ fehler: true }), /0 Min frei/);
  assert.match(freieZeitHtml({ daten: { status: 'ok', grund: 'KEINE_FREIEN_STARTS', luecken: [] } }), /Keine freien Startzeiten/);
  assert.match(freieZeitHtml({ daten: tag, fehler: true }), /Zuletzt geladener Stand/);
  assert.match(freieZeitHtml({ daten: { status: 'ok', luecken: [null] } }), /derzeit unbekannt/);
});
test('Employee darf fremden oder alten Ownerscope auch im Renderer nicht zeigen', () => {
  assert.match(freieZeitHtml({ daten: tag }, { eigeneUid: 'other' }), /derzeit unbekannt/);
  assert.doesNotMatch(freieZeitHtml({ daten: tag }, { eigeneUid: 'other' }), /11:00/);
});
test('Gruppenreststart liefert keine freien Minuten dazu', () => {
  const d = { ...tag, luecken: [{ ...tag.luecken[0], freiMin: 0, intervalle: [], starts: [tag.luecken[0].starts[1]] }] };
  const html = freieZeitHtml({ daten: d }); assert.match(html, /0 Min frei/); assert.match(html, /Gruppenrestplatz/);
});
test('Wochenquote: volle Rohbasis, unbekannt ist nicht null Prozent, 0/0 nicht Quote0', () => {
  assert.match(wocheHtml({ daten: { status: 'ok', gebuchtMin: 150, arbeitsMin: 1260, quote: 150 / 1260 } }), /12 % belegt/);
  assert.match(wocheHtml({ daten: { status: 'ok', gebuchtMin: 0, arbeitsMin: 0, quote: null } }), /Keine Arbeitszeit/);
  const unknown = wocheHtml({ daten: { status: 'unbekannt', grund: 'ZEITBASIS_UNKLAR', gebuchtMin: null, arbeitsMin: null, quote: null } });
  assert.match(unknown, /derzeit unbekannt/); assert.doesNotMatch(unknown, /0 %|role="meter"/);
  assert.match(wocheHtml({ laden: true }), /wird geladen/);
  assert.match(wocheHtml({ daten: { status: 'ok', gebuchtMin: null, arbeitsMin: 42, quote: 0 } }), /derzeit unbekannt/);
});
test('Fetch: erlaubte Pfade, auth, employee Woche vor Session/Netz gesperrt, Unknown erhalten', async () => {
  let sessions = 0, calls = 0;
  const supabase = { auth: { getSession: async () => { sessions++; return { data: { session: { access_token: 'synthetic' } } }; } } };
  const fetchFn = async (url, opts) => { calls++; assert.equal(url, '/api/startseite/tag'); assert.equal(opts.cache, 'no-store'); return { ok: true, json: async () => ({ status: 'unbekannt', grund: 'ZEITBASIS_UNKLAR', luecken: null }) }; };
  assert.equal((await holeVerfuegbarkeit({ supabase, apiBase: '/api/', modus: 'tag', rolle: 'employee', fetchFn })).status, 'unbekannt');
  await assert.rejects(holeVerfuegbarkeit({ supabase, apiBase: '/api', modus: 'woche', rolle: 'employee', fetchFn }), /ZUGRIFF_VERWEIGERT/);
  assert.equal(sessions, 1); assert.equal(calls, 1);
  await assert.rejects(holeVerfuegbarkeit({ supabase, apiBase: '/api', modus: 'tag', rolle: 'owner', fetchFn: async () => ({ ok: false, status: 503 }) }), /HTTP_503/);
});
test('Hängender Transport wird beendet, andere Karte kann weiterladen', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }) } };
  let signal;
  const request = holeVerfuegbarkeit({ supabase, apiBase: '/api', modus: 'woche', rolle: 'owner',
    fetchFn: async (_url, o) => { signal = o.signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('ABBRUCH')))); } });
  await Promise.resolve();
  const check = assert.rejects(request, /ABBRUCH/);
  t.mock.timers.tick(30000); await check; assert.equal(signal.aborted, true);
});
