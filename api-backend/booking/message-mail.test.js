import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { meldeVerbindungsfehler } from '../lib/mail.js';

const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const start = source.indexOf("app.post('/api/booking-request/message'");
const end = source.indexOf('// POST /api/booking-request/accept-offer', start);
assert.ok(start >= 0 && end > start);

for (const quelle of ['db', 'env']) {
  test(`Nachrichten-Mail: ${quelle} EAUTH bleibt Fehler, Log ohne Rohmeldung`, async () => {
    let handler; const logs = []; const updates = [];
    const supabase = { from(table) {
      const q = {
        select() { return q; }, eq() { return q; },
        async maybeSingle() { return { data: table === 'profiles'
          ? { id: 'owner', business_name: 'Testpraxis', email: 'owner@example.invalid' }
          : { id: 'request', patients: { email: 'patient@example.invalid', vorname: 'Test' } } }; },
        update(row) { updates.push({ table, row }); return q; },
      }; return q;
    } };
    const kanal = { weg: 'smtp', quelle, from: () => 'owner@example.invalid',
      transport: () => ({ sendMail: async () => { throw Object.assign(new Error('private recipient patient@example.invalid'), { code: 'EAUTH' }); } }) };
    vm.runInNewContext(source.slice(start, end), {
      app: { post(_path, ...args) { handler = args.at(-1); } },
      requireAuthAI() {}, bookingRequestApprovalLimiter() {}, supabase,
      mailKanal: async () => kanal, mailEntwurfStattVersand: () => false,
      meldeVerbindungsfehler, escHtml: s => s,
      console: { error: (...args) => logs.push(args.join(' ')) },
    });
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ auth: { userId: 'owner' }, body: { request_id: 'request', owner_id: 'owner', text: 'Synthetische Nachricht' } }, res);
    assert.equal(res.code, 500);
    assert.equal(updates.length, quelle === 'db' ? 1 : 0);
    if (quelle === 'db') {
      assert.equal(updates[0].table, 'praxis_mailversand');
      assert.equal(updates[0].row.status, 'unterbrochen');
      assert.equal(updates[0].row.letzter_fehler_code, 'EAUTH');
    }
    assert.match(logs.join(' '), /EAUTH/);
    assert.ok(!logs.join(' ').includes('patient@example.invalid'));
  });
}
