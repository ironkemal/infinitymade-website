// M4.11 (α)(β)(γ) — Hat K → Hat M Notiz 09.10.2026 (onprem O-169, guvenlik S-55).
// α: 429 ist vorübergehend, Kontingent nur 402 + AI_QUOTA_EXCEEDED.
// β: Sperre bis resetAt (höchstens 6 h ohne gültigen Wert), hebt sich selbst auf.
// γ: rejectedReportId verwirft den ausstehenden Bericht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJetonClient, kilitBitisMs } from './ki-jeton.js';
import { readFileSync } from 'node:fs';
import { KNOWN_AI_TASKS } from './ki-privacy.js';
import { KI_TASKS } from '../merkez-istemci/ki-bericht-schema.js';

const FAKE_HOST = 'praxura-fake-central.services.ai.azure.com';
const ALLOWED_HOSTS = [FAKE_HOST];
const CONFIG = Object.freeze({ mode: 'jeton', activationReady: true, valid: true, allowedHosts: ALLOWED_HOSTS });

function okToken(nowMs, token = 'm411-token-string-abcdef') { // secret-scan: ignore (Fake-Testwert)
  return {
    status: 200,
    ok: true,
    json: {
      token,
      exp: Math.floor(nowMs / 1000) + 1800,
      endpoint: `https://${FAKE_HOST}`,
      deployment: 'gpt-4o-mini',
      region: 'swedencentral',
      apiVersion: '2024-10-21'
    }
  };
}

function quota402(nowMs, extra = {}) {
  return { status: 402, ok: false, json: { code: 'AI_QUOTA_EXCEEDED', resetAt: Math.floor(nowMs / 1000) + 60, ...extra } };
}

const BERICHT = Object.freeze({
  reportId: 'rep-m411',
  windowStart: '2023-11-14T00:00:00.000Z',
  windowEnd: '2023-11-15T00:00:00.000Z',
  taskTotals: { 'b2c-draft': { calls: 1, prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }
});

test('Task-Liste: Router, Audit-Whitelist und Merkez-Vertrag sind deckungsgleich', () => {
  const vertrag = [...KI_TASKS].sort();
  // router.js nicht importieren (zieht den Supabase-Client): Schlüssel des TASKS-Objekts aus dem Quelltext.
  const quelle = readFileSync(new URL('./router.js', import.meta.url), 'utf8');
  const block = quelle.match(/export const TASKS = Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(block, 'TASKS-Block in router.js gefunden');
  const routerTasks = [...block[1].matchAll(/'([a-z0-9-]+)'\s*:/g)].map((m) => m[1]).sort();
  assert.deepEqual(routerTasks, vertrag);
  assert.deepEqual([...KNOWN_AI_TASKS].sort(), vertrag);
});

test('kilitBitisMs: resetAt in der Zukunft gilt, sonst 6-Stunden-Obergrenze', () => {
  const now = 1_700_000_000_000;
  const sechsStunden = now + 6 * 3600_000;
  const inEinerStunde = Math.floor(now / 1000) + 3600;
  assert.equal(kilitBitisMs(inEinerStunde, now), inEinerStunde * 1000);
  assert.equal(kilitBitisMs(undefined, now), sechsStunden);
  assert.equal(kilitBitisMs(String(inEinerStunde), now), sechsStunden);
  assert.equal(kilitBitisMs(1.5, now), sechsStunden);
  assert.equal(kilitBitisMs(Math.floor(now / 1000) - 10, now), sechsStunden);
  assert.equal(kilitBitisMs(Math.floor(now / 1000) + 33 * 86_400, now), sechsStunden);
});

test('α: 429 (JSON oder Text) und 402 ohne Code sind vorübergehend — Token bleibt, keine Sperre', async () => {
  let fakeNow = 1_700_000_000_000;
  let antwort = 'ok';
  const client = createJetonClient({
    config: CONFIG,
    allowedHosts: ALLOWED_HOSTS,
    now: () => fakeNow,
    merkezFetchImpl: async () => {
      if (antwort === '429-json') return { status: 429, ok: false, json: { code: 'AI_QUOTA_EXCEEDED' } };
      if (antwort === '429-text') return { status: 429, ok: false, json: null };
      if (antwort === '402-ohne-code') return { status: 402, ok: false, json: { fehler: 'x' } };
      return okToken(fakeNow);
    }
  });
  const t1 = await client.getToken();

  for (const fall of ['429-json', '429-text', '402-ohne-code']) {
    antwort = fall;
    const t = await client.getToken({ forceRefresh: true });
    assert.equal(t.token, t1.token, `${fall}: gültiges Token wird behalten`);
    assert.equal(client.getState().tokenDisabled, false, `${fall}: keine Sperre`);
  }

  // Ohne gültiges Token: 503 AI_JETON_UNAVAILABLE, trotzdem keine Sperre
  fakeNow += 3600_000;
  antwort = '429-text';
  await assert.rejects(client.getToken(), (err) => err.code === 'AI_JETON_UNAVAILABLE' && err.status === 503);
  assert.equal(client.getState().tokenDisabled, false);
  antwort = 'ok';
  assert.ok((await client.getToken()).token);
});

test('β: 402-Sperre endet bei resetAt, ohne Zentrumsanfragen dazwischen, und hebt sich selbst auf', async () => {
  let fakeNow = 1_700_000_000_000;
  const resetAt = Math.floor(fakeNow / 1000) + 7200;
  let quota = true;
  let aufrufe = 0;
  const client = createJetonClient({
    config: CONFIG,
    allowedHosts: ALLOWED_HOSTS,
    now: () => fakeNow,
    merkezFetchImpl: async () => {
      aufrufe++;
      return quota ? quota402(fakeNow, { resetAt }) : okToken(fakeNow);
    }
  });

  await assert.rejects(client.getToken(), (err) => err.code === 'AI_QUOTA_EXCEEDED' && err.status === 503);
  assert.equal(client.getState().disabledUntil, resetAt * 1000);
  await assert.rejects(client.getToken(), (err) => err.code === 'AI_QUOTA_EXCEEDED');
  assert.equal(aufrufe, 1);

  fakeNow = resetAt * 1000;
  quota = false;
  assert.ok((await client.getToken()).token);
  const st = client.getState();
  assert.equal(st.tokenDisabled, false);
  assert.equal(st.disabledUntil, null);
  assert.equal(st.disabledReason, null);
});

test('β: 402 mit ungültigem resetAt sperrt genau 6 Stunden', async () => {
  let fakeNow = 1_700_000_000_000;
  let quota = true;
  const client = createJetonClient({
    config: CONFIG,
    allowedHosts: ALLOWED_HOSTS,
    now: () => fakeNow,
    merkezFetchImpl: async () => (quota ? quota402(fakeNow, { resetAt: 'morgen' }) : okToken(fakeNow))
  });
  await assert.rejects(client.getToken(), (err) => err.code === 'AI_QUOTA_EXCEEDED');
  assert.equal(client.getState().disabledUntil, fakeNow + 6 * 3600_000);
  fakeNow += 6 * 3600_000 - 1;
  await assert.rejects(client.getToken(), (err) => err.code === 'AI_QUOTA_EXCEEDED');
  fakeNow += 1;
  quota = false;
  assert.ok((await client.getToken()).token);
});

for (const status of [200, 402]) {
  test(`γ: rejectedReportId verwirft den ausstehenden Bericht (${status}), Log nur mit ID`, async () => {
    const fakeNow = 1_700_000_000_000;
    const gesendet = [];
    const client = createJetonClient({
      config: CONFIG,
      allowedHosts: ALLOWED_HOSTS,
      now: () => fakeNow,
      merkezFetchImpl: async (_pfad, opts) => {
        gesendet.push(opts.body.report);
        const r = status === 200 ? okToken(fakeNow) : quota402(fakeNow);
        r.json.rejectedReportId = 'rep-m411';
        return r;
      }
    });
    const warn = console.warn;
    const logs = [];
    console.warn = (...a) => logs.push(a.join(' '));
    try {
      await client.reportUsage({ ...BERICHT });
      assert.equal(client.getState().hasPendingReport, true);
      if (status === 200) await client.getToken();
      else await assert.rejects(client.getToken(), (err) => err.code === 'AI_QUOTA_EXCEEDED');
    } finally {
      console.warn = warn;
    }
    assert.equal(gesendet[0].reportId, 'rep-m411');
    assert.equal(client.getState().hasPendingReport, false);
    assert.deepEqual(await client.reportUsage({ ...BERICHT, reportId: 'rep-m411-b' }), { ok: true, staged: true });
    assert.equal(logs.length, 1);
    assert.match(logs[0], /rep-m411/);
    assert.doesNotMatch(logs[0], /b2c-draft|prompt_tokens/);
  });
}

test('402 quittiert den Bericht vor der Sperre (acknowledgedReportId)', async () => {
  const fakeNow = 1_700_000_000_000;
  const client = createJetonClient({
    config: CONFIG,
    allowedHosts: ALLOWED_HOSTS,
    now: () => fakeNow,
    merkezFetchImpl: async () => quota402(fakeNow, { acknowledgedReportId: 'rep-m411' })
  });
  await client.reportUsage({ ...BERICHT });
  await assert.rejects(client.getToken(), (err) => err.code === 'AI_QUOTA_EXCEEDED');
  assert.equal(client.getState().hasPendingReport, false);
});

test('Bericht-Prüfung kommt aus dem gemeinsamen Schema (Zusatzfeld wird abgewiesen)', async () => {
  const client = createJetonClient({ config: CONFIG, allowedHosts: ALLOWED_HOSTS });
  await assert.rejects(client.reportUsage({ ...BERICHT, extra: 1 }), /unzulässige Felder/);
});
