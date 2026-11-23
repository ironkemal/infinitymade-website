// Box-Test 22.11.2026, Problem 1: Systemstatus für den Inhaber (nur Box).
import test from 'node:test';
import assert from 'node:assert/strict';
import { statusZeilen, mountSystemstatus } from './systemstatus.js';

const antwort = {
  gesamt: 'warnung', gemessen_am: '2026-11-23T08:00:00Z',
  felder: {
    version: { status: 'info', version: '0.7.2', digest: 'sha256:' + 'a'.repeat(64), schema: '0129' },
    schema: { status: 'ok' },
    backup: { status: 'warnung', code: 'lokal', letzte_ok: '2026-11-23T01:02:00Z', alter_stunden: 7, ziel_ausserhalb: false },
    data_key: { status: 'ok', vergleich: 'gleich' },
    zertifikat: { status: 'ok', art: 'le', gueltig_bis: '2027-01-20T00:00:00Z', tage_rest: 58 },
    realtime: { status: 'ok' },
    disk: { status: 'ok', frei_prozent: 72.5, frei_bytes: 58e9, gesamt_bytes: 80e9, restore_reste: [{ name: 'postgres_onceki_20261122', bytes: 2.3e6 }] },
    zeit: { status: 'ok' },
  },
};

test('statusZeilen: alle Bereiche aus dem Bericht, ohne Schlüsselabdruck', () => {
  const z = statusZeilen(antwort);
  const namen = z.map(r => r[0]);
  for (const n of ['Version', 'Datenbank-Schema', 'Letzte Sicherung', 'Datenschlüssel', 'Zertifikat', 'Echtzeit (Realtime)', 'Speicherplatz', 'Alte Datenbanken nach Wiederherstellung']) assert.ok(namen.includes(n), n);
  const text = z.map(r => r[2]).join(' | ');
  assert.match(text, /liegt nur auf diesem Server/);
  assert.match(text, /gleich wie in der Sicherung/);
  assert.match(text, /postgres_onceki_20261122 \(2 MB\)/);
  assert.match(text, /\(58 Tage\)/);
  assert.doesNotMatch(text, /[0-9a-f]{16}/, 'kein Abdruck/Digest in voller Länge');
});

test('mountSystemstatus: 404/403 verbergen den Abschnitt, Antwort wird maskiert angezeigt', async () => {
  const abschnitt = /** @type {any} */ ({ hidden: true, innerHTML: '', textContent: '', querySelector: () => null });
  for (const status of [404, 403, 401]) {
    abschnitt.hidden = false;
    const r = await mountSystemstatus(abschnitt, { apiBase: '/api', getToken: async () => 't', fetchImpl: async () => /** @type {any} */ ({ status, json: async () => ({}) }) });
    assert.equal(r, 'versteckt'); assert.equal(abschnitt.hidden, true);
  }
  const boese = structuredClone(antwort); boese.felder.disk.restore_reste[0].name = '<img src=x onerror=alert(1)>';
  /** @type {any[]} */ const aufrufe = [];
  const r = await mountSystemstatus(abschnitt, { apiBase: '/api', getToken: async () => 't', fetchImpl: async (u, o) => { aufrufe.push([u, o.headers.Authorization]); return /** @type {any} */ ({ status: 200, json: async () => boese }); } });
  assert.equal(r, 'angezeigt'); assert.equal(abschnitt.hidden, false);
  assert.deepEqual(aufrufe, [['/api/status', 'Bearer t']]);
  assert.ok(!abschnitt.innerHTML.includes('<img'), 'maskiert');
  assert.match(abschnitt.innerHTML, /Gesamtzustand: Hinweise/);
});

test('Phase 7b F5: Netzwerkfehler im SaaS blendet aus, auf der Box wird er gemeldet', async () => {
  const mk = () => { const ziel = { textContent: '', innerHTML: '' }; return { hidden: true, querySelector: () => ziel, ziel }; };
  const kaputt = async () => { throw new Error('offline'); };
  const saas = mk();
  assert.equal(await mountSystemstatus(saas, { apiBase: '/api', getToken: async () => 't', fetchImpl: kaputt, istKutu: false }), 'versteckt');
  assert.equal(saas.hidden, true);
  const box = mk();
  assert.equal(await mountSystemstatus(box, { apiBase: '/api', getToken: async () => 't', fetchImpl: kaputt, istKutu: true }), 'fehler');
  assert.equal(box.hidden, false);
});
