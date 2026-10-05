import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erstelleCloudflare, CAA_BASIS } from '../cloudflare.js';

function fakeFetch() {
  const aufrufe = []; const store = [];
  let id = 0;
  const basis = '/client/v4/zones/Z1/dns_records';
  const fetchImpl = async (url, opt) => {
    const u = new URL(url); const m = opt.method; const body = opt.body ? JSON.parse(opt.body) : null;
    aufrufe.push({ m, pfad: u.pathname + u.search, auth: opt.headers.Authorization, body });
    let result;
    if (m === 'GET') result = store.filter((r) => r.type === u.searchParams.get('type') && r.name === u.searchParams.get('name'));
    else if (m === 'POST') { const r = { id: 'r' + (++id), ...body }; store.push(r); result = r; }
    else if (m === 'PUT') { const i = store.findIndex((r) => u.pathname === `${basis}/${r.id}`); store[i] = { id: store[i].id, ...body }; result = store[i]; }
    else if (m === 'DELETE') { const i = store.findIndex((r) => u.pathname === `${basis}/${r.id}`); store.splice(i, 1); result = {}; }
    return { ok: true, status: 200, json: async () => ({ success: true, result }) };
  };
  return { fetchImpl, aufrufe, store };
}

test('setzeA: legt an, aktualisiert statt zu duplizieren, nie proxied', async () => {
  const f = fakeFetch();
  const cf = erstelleCloudflare({ zoneId: 'Z1', token: 'T', fetchImpl: f.fetchImpl });
  await cf.setzeA('a.box.example.org', '192.168.1.5');
  await cf.setzeA('a.box.example.org', '192.168.1.6');
  assert.equal(f.store.length, 1);
  assert.equal(f.store[0].content, '192.168.1.6');
  assert.equal(f.store[0].proxied, false);
  assert.equal(f.store[0].ttl, 600);
  assert.ok(f.aufrufe.every((a) => a.auth === 'Bearer T'));
});

test('setzeCaa: issue letsencrypt dns-01, mit accounturi; ersetzt vorhandenen Eintrag', async () => {
  const f = fakeFetch();
  const cf = erstelleCloudflare({ zoneId: 'Z1', token: 'T', fetchImpl: f.fetchImpl });
  await cf.setzeCaa('a.box.example.org', null);
  assert.deepEqual(f.store[0].data, { flags: 0, tag: 'issue', value: 'letsencrypt.org; validationmethods=dns-01' });
  await cf.setzeCaa('a.box.example.org', 'https://acme-v02.api.letsencrypt.org/acme/acct/42');
  assert.equal(f.store.length, 1);
  assert.equal(f.store[0].data.value, CAA_BASIS + '; accounturi=https://acme-v02.api.letsencrypt.org/acme/acct/42');
});

test('loesche + Fehlerbehandlung ohne Token im Fehlertext', async () => {
  const f = fakeFetch();
  const cf = erstelleCloudflare({ zoneId: 'Z1', token: 'GEHEIM', fetchImpl: f.fetchImpl });
  await cf.setzeCname('_acme-challenge.a.box.example.org', 'x.auth.example.org');
  await cf.loesche('CNAME', '_acme-challenge.a.box.example.org');
  assert.equal(f.store.length, 0);
  const kaputt = erstelleCloudflare({
    zoneId: 'Z1', token: 'GEHEIM',
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ success: false, errors: [{ code: 9109 }] }) }),
  });
  await assert.rejects(kaputt.setzeA('a.box.example.org', '1.2.3.4'), (e) => !e.message.includes('GEHEIM') && e.message.includes('9109'));
});

test('Zone und Token sind Pflicht', () => {
  assert.throws(() => erstelleCloudflare({ zoneId: '', token: 'x' }));
  assert.throws(() => erstelleCloudflare({ zoneId: 'z', token: '' }));
});
