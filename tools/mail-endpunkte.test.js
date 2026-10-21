import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { createMailRateLimiter } from '../api/_lib/mail-rate-limit.js';
import { escHtml } from '../api/_lib/mail-html.js';
import { escHtml as backendEscHtml } from '../api-backend/booking/html-escape.js';

test('instanzlokales Limit: getrennte Pfade/IPs, Ablauf und feste Speichergrenze', () => {
  let time = 0;
  const consume = createMailRateLimiter({ limit: 2, windowMs: 2000, maxEntries: 2, now: () => time, isVercel: () => false });
  const req = ip => ({ socket: { remoteAddress: ip }, headers: {} });
  assert.equal(consume(req('192.0.2.1'), 'contact').allowed, true);
  assert.equal(consume(req('192.0.2.1'), 'contact').allowed, true);
  assert.deepEqual(consume(req('192.0.2.1'), 'contact'), { allowed: false, retryAfter: 2 });
  assert.equal(consume(req('192.0.2.1'), 'demo-create').allowed, true);
  assert.equal(consume(req('192.0.2.2'), 'contact').allowed, false);
  time = 2000;
  assert.equal(consume(req('192.0.2.2'), 'contact').allowed, true);
});

test('gefälschte Proxyheader und unbekannte IP schaffen keinen Bypass', () => {
  const req = { headers: { 'x-vercel-forwarded-for': '192.0.2.2', 'x-forwarded-for': '192.0.2.3' }, socket: { remoteAddress: '192.0.2.1' } };
  const local = createMailRateLimiter({ limit: 1, isVercel: () => false });
  assert.equal(local(req, 'contact').allowed, true);
  req.headers['x-vercel-forwarded-for'] = '192.0.2.9';
  assert.equal(local(req, 'contact').allowed, false);
  const vercel = createMailRateLimiter({ limit: 1, isVercel: () => true });
  assert.equal(vercel(req, 'contact').allowed, true);
  req.headers['x-vercel-forwarded-for'] = '192.0.2.8';
  assert.equal(vercel(req, 'contact').allowed, true);
  const missing = createMailRateLimiter({ limit: 1, isVercel: () => true });
  assert.equal(missing({ headers: {} }, 'contact').allowed, true);
  assert.equal(missing({ headers: { 'x-vercel-forwarded-for': 'a,b' } }, 'contact').allowed, false);
});

test('äquivalente IPv6-Formen und IPv4-Mapping teilen Zähler', () => {
  for (const [a, b] of [['::ffff:192.0.2.1', '192.0.2.1'], ['2001:db8::1', '2001:0db8:0:0:0:0:0:1']]) {
    const limit = createMailRateLimiter({ limit: 1, isVercel: () => false });
    assert.equal(limit({ socket: { remoteAddress: a } }, 'contact').allowed, true);
    assert.equal(limit({ socket: { remoteAddress: b } }, 'contact').allowed, false);
  }
});

test('deploymentgetrennte HTML-Helfer behalten identische sichere Semantik', () => {
  for (const value of ['&<>"\'', null, undefined, 42, '&amp;']) assert.equal(escHtml(value), backendEscHtml(value));
  assert.equal(escHtml('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
});

test('Kontakt und Demo: erfolgreiche Fake-Anfragen, danach 429 ohne SMTP/DB/Google', async t => {
  // Nur synthetische Konfiguration. Kein Laden von .env, keine echten Aufrufe.
  const saved = Object.fromEntries(['SMTP_HOST', 'VERCEL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_DEMO_CALENDAR_REFRESH_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SENTRY_SERVERLESS_ENABLED'].map(key => [key, process.env[key]]));
  Object.assign(process.env, { SMTP_HOST: 'smtp.invalid', NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', GOOGLE_DEMO_CALENDAR_REFRESH_TOKEN: '',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', VERCEL: '', SENTRY_SERVERLESS_ENABLED: '' });
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const mails = [];
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => { mails.push(mail); } }));
  let calls = 0;
  const booking = { id: 'synthetic', name: '<a href="https://attacker.invalid">Probe</a>', email: 'test"&\'@example.invalid',
    company: '<strong>Fake&Co</strong>', message: '<b>PROBE_MESSAGE</b>',
    booking_date: '2026-11-02', booking_time: '10:00', status: 'confirmed', reschedule_token: 'synthetic-token' };
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls++;
    assert.match(String(url), /^https:\/\/synthetic\.invalid\/rest\/v1\/demo_bookings/);
    const rows = String(url).includes('reschedule_token=') || options.method === 'POST' || options.method === 'PATCH' ? [booking] : [];
    return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
  });
  const contact = (await import('../api/contact.js')).default;
  const demo = (await import('../api/demo-booking.js')).default;
  const response = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } });
  const special = '<b>&"\'';
  const contactBody = { vorname: special, nachname: special, firma: special, email: 'test"&\'@example.invalid', nachricht: special };
  for (let i = 0; i < 5; i++) {
    const res = response();
    await contact({ method: 'POST', headers: {}, socket: { remoteAddress: '192.0.2.31' }, body: contactBody }, res);
    assert.equal(res.statusCode, 200);
  }
  assert.match(mails[0].html, /&lt;b&gt;&amp;&quot;&#39;/);
  assert.match(mails[0].html, /mailto:test&quot;&amp;&#39;@example.invalid/);
  assert.doesNotMatch(mails[0].html, /<b>|mailto:test"/);
  const denied = response();
  await contact({ method: 'POST', headers: {}, socket: { remoteAddress: '192.0.2.31' }, body: contactBody }, denied);
  assert.equal(denied.statusCode, 429);
  assert.ok(Number(denied.headers['Retry-After']) > 0);
  assert.equal(mails.length, 5);
  assert.equal(calls, 0);
  for (const action of ['create', 'reschedule']) {
    const req = { method: 'POST', headers: {}, socket: { remoteAddress: '192.0.2.32' }, query: { action },
      body: action === 'create' ? booking : { token: 'synthetic-token', new_date: '2026-11-02', new_time: '11:00' } };
    for (let i = 0; i < 5; i++) { const res = response(); await demo(req, res); assert.equal(res.statusCode, 200); }
    const pair = mails.slice(-2);
    for (const mail of pair) {
      assert.ok(mail.html.includes(escHtml(booking.name)), `${action}: Name als Text`);
      assert.doesNotMatch(mail.html, /<a href="https:\/\/attacker\.invalid"|<b>PROBE_MESSAGE<\/b>|<strong>Fake&Co<\/strong>/);
    }
    assert.ok(pair[1].html.includes(`mailto:${escHtml(booking.email)}`), `${action}: E-Mail-Attribut escaped`);
    if (action === 'create') {
      assert.ok(pair[1].html.includes(escHtml(booking.company)));
      assert.ok(pair[1].html.includes(escHtml(booking.message)));
    }
    const before = { calls, mails: mails.length };
    const res = response(); await demo(req, res);
    assert.equal(res.statusCode, 429);
    assert.deepEqual({ calls, mails: mails.length }, before);
  }
  booking.company = null;
  booking.message = null;
  const optional = response();
  await demo({ method: 'POST', headers: {}, socket: { remoteAddress: '192.0.2.33' },
    query: { action: 'create' }, body: booking }, optional);
  assert.equal(optional.statusCode, 200);
  assert.match(mails.at(-1).html, /Unternehmen:<\/strong> —/);
  assert.match(mails.at(-1).html, /Nachricht:<\/strong> —/);
});

test('Demo-Buchung: Mehrfachempfänger, CRLF, Längen und Typen werden vor DB/SMTP abgelehnt; Setup-Route ohne Secret gesperrt', async t => {
  const saved = Object.fromEntries(['SMTP_HOST', 'VERCEL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SETUP_SECRET', 'SENTRY_SERVERLESS_ENABLED'].map(key => [key, process.env[key]]));
  Object.assign(process.env, { SMTP_HOST: 'smtp.invalid', NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', VERCEL: '', SENTRY_SERVERLESS_ENABLED: '' });
  delete process.env.SETUP_SECRET;
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const mails = []; let calls = 0;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => { mails.push(mail); } }));
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: true, status: 200, text: async () => '[]' }; });
  const demo = (await import('../api/demo-booking.js')).default;
  const response = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } });
  const base = { name: 'Probe', email: 'probe@example.invalid', booking_date: '2026-11-02', booking_time: '10:00' };
  const bad = [
    { ...base, email: 'a@example.invalid, b@example.invalid' },
    { ...base, email: 'a@example.invalid;b@example.invalid' },
    { ...base, email: 'a@example.invalid\r\nBcc: x@example.invalid' },
    { ...base, email: 'ohne-at' },
    { ...base, email: `${'a'.repeat(250)}@example.invalid` },
    { ...base, name: 'x'.repeat(201) },
    { ...base, message: 'x'.repeat(2001) },
    { ...base, name: 42 },
    { ...base, email: ['a@example.invalid'] },
  ];
  let ip = 40;
  for (const body of bad) {
    const res = response();
    await demo({ method: 'POST', headers: {}, socket: { remoteAddress: `192.0.2.${ip++}` }, query: { action: 'create' }, body }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(calls, 0);
  assert.equal(mails.length, 0);
  // Ohne gesetztes SETUP_SECRET darf auch ein fehlendes Secret die Route nicht öffnen.
  const res = response();
  await demo({ method: 'GET', headers: {}, socket: { remoteAddress: '192.0.2.99' }, query: { action: 'setup-calendar' } }, res);
  assert.equal(res.statusCode, 403);
});
