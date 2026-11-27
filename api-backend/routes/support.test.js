import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import { createSupportRouter, sanitizeTechContext } from './support.js';
import { boxIdAusPublicKey, publicKeyAlsBase64url, signiereAnfrage } from '../merkez-istemci/signatur.js';

function makeId(prefix, n) {
  const hex = String(n).padStart(12, '0');
  return `${prefix}0000-0000-4000-8000-${hex}`;
}

function makeInMemoryOpsDb({ customers = [], members = {}, tokenUsers = {}, failMessageInsert = false } = {}) {
  let ticketSeq = 1001;
  let idCounter = 1;
  const state = {
    ops_customers: [...customers],
    ops_tickets: [],
    ops_ticket_messages: [],
    ops_alerts: [],
    ops_members: Object.values(members),
    queryCalls: [],
  };

  return {
    state,
    auth: {
      async getUser(token) {
        const user = tokenUsers[token];
        if (!user) return { data: { user: null }, error: { message: 'invalid jwt' } };
        return { data: { user }, error: null };
      },
    },
    from(table) {
      let mode = 'select';
      let insertPayload = null;
      let updatePayload = null;
      const filters = [];
      let orderCfg = null;

      const builder = {
        select() { return builder; },
        insert(payload) {
          mode = 'insert';
          insertPayload = payload;
          return builder;
        },
        update(payload) {
          mode = 'update';
          updatePayload = payload;
          return builder;
        },
        delete() {
          mode = 'delete';
          return builder;
        },
        eq(col, val) {
          filters.push({ op: 'eq', col, val });
          return builder;
        },
        in(col, vals) {
          filters.push({ op: 'in', col, vals });
          return builder;
        },
        order(col, opts) {
          orderCfg = { col, ascending: opts?.ascending !== false };
          return builder;
        },
        async single() {
          const res = await execute();
          if (res.error) return res;
          const row = Array.isArray(res.data) ? res.data[0] : res.data;
          if (!row) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
          return { data: row, error: null };
        },
        async maybeSingle() {
          const res = await execute();
          if (res.error) return res;
          const row = Array.isArray(res.data) ? res.data[0] || null : res.data || null;
          return { data: row, error: null };
        },
        then(resolve, reject) {
          return execute().then(resolve, reject);
        },
      };

      const matches = (row) => filters.every((f) => {
        if (f.op === 'eq') return row[f.col] === f.val;
        if (f.op === 'in') return f.vals.includes(row[f.col]);
        return true;
      });

      async function execute() {
        state.queryCalls.push({ table, mode, filters: [...filters] });
        const rows = state[table];
        if (!rows) return { data: null, error: { code: '42P01', message: `unknown table ${table}` } };

        if (mode === 'insert') {
          if (table === 'ops_ticket_messages' && failMessageInsert) {
            return { data: null, error: { code: '23514', message: 'simulated message insert failure' } };
          }
          const items = Array.isArray(insertPayload) ? insertPayload : [insertPayload];
          const inserted = items.map((item) => {
            const now = new Date().toISOString();
            const base = {
              id: item.id || makeId('1111', idCounter++),
              created_at: now,
              ...item,
            };
            if (table === 'ops_tickets') {
              base.ticket_no = base.ticket_no || ticketSeq++;
              base.updated_at = now;
              base.tech_context = base.tech_context || {};
              base.status = base.status || 'neu';
              base.priority = base.priority || 'normal';
            }
            if (table === 'ops_ticket_messages') {
              base.is_internal_note = Boolean(base.is_internal_note);
              base.emailed_at = base.emailed_at || null;
            }
            rows.push(base);
            return { ...base };
          });
          return { data: Array.isArray(insertPayload) ? inserted : inserted[0], error: null };
        }

        if (mode === 'update') {
          const updated = [];
          for (const row of rows) {
            if (matches(row)) {
              Object.assign(row, updatePayload, table === 'ops_tickets' ? { updated_at: new Date().toISOString() } : {});
              updated.push({ ...row });
            }
          }
          return { data: updated, error: null };
        }

        if (mode === 'delete') {
          const deleted = [];
          for (let i = rows.length - 1; i >= 0; i--) {
            if (matches(rows[i])) {
              deleted.push(rows[i]);
              rows.splice(i, 1);
            }
          }
          return { data: deleted, error: null };
        }

        let result = rows.filter(matches).map((r) => ({ ...r }));
        if (orderCfg) {
          result.sort((a, b) => {
            const av = a[orderCfg.col] || '';
            const bv = b[orderCfg.col] || '';
            if (av === bv) return 0;
            return orderCfg.ascending ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
          });
        }
        return { data: result, error: null };
      }

      return builder;
    },
  };
}

function makeProductDb({ businesses = [], profiles = [] } = {}) {
  return {
    from(table) {
      const filters = {};
      const builder = {
        select() { return builder; },
        eq(col, val) { filters[col] = val; return builder; },
        async maybeSingle() {
          const rows = table === 'profiles' ? profiles : businesses;
          const hit = rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v)) || null;
          return { data: hit, error: null };
        },
        then(resolve, reject) {
          const rows = table === 'profiles' ? profiles : businesses;
          const hits = rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
          return Promise.resolve({ data: hits, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

function makeHeaderAuth() {
  return (req, res, next) => {
    const tenantId = req.headers['x-test-tenant'];
    const userId = req.headers['x-test-user'] || tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Missing bearer token' });
    req.auth = { tenantId: String(tenantId), userId: String(userId), role: 'owner' };
    next();
  };
}

async function withServer(router, fn) {
  const app = express();
  app.use('/api/support', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function makeBoxIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    boxId: boxIdAusPublicKey(publicKey),
    publicKey,
    privateKey,
    publicKeyBase64url: publicKeyAlsBase64url(publicKey),
  };
}

test('1. SaaS create + techContext whitelist + urgent alert', async () => {
  const tenantA = makeId('aaaa', 1);
  const custId = makeId('cccc', 1);
  const opsDb = makeInMemoryOpsDb({
    customers: [{ id: custId, tenant_id: tenantA, display_name: 'Praxis Demo Nord' }],
  });
  const productDb = makeProductDb({
    businesses: [{ owner_id: tenantA, business_name: 'Praxis Demo Nord', is_default: true }],
    profiles: [{ id: tenantA, email: 'inhaber@demo-nord.invalid', business_name: 'Praxis Demo Nord' }],
  });

  const router = createSupportRouter({
    supabase: productDb,
    opsSupabase: opsDb,
    istKutu: false,
    requireAuthImpl: makeHeaderAuth(),
  });

  // Direkte Unit-Prüfung sanitizeTechContext
  const cleaned = sanitizeTechContext({
    appVersion: ' 2.5.1 ',
    panel: 'feedback',
    mode: 'saas',
    browser: 'Firefox',
    patientName: 'NICHT_ERLAUBT',
    kvnr: 'A123456789',
    nested: { a: 1 },
  });
  assert.deepEqual(cleaned, { appVersion: '2.5.1', panel: 'feedback', mode: 'saas', browser: 'Firefox' });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-tenant': tenantA,
      },
      body: JSON.stringify({
        category: 'bug',
        priority: 'kritisch',
        subject: 'Abrechnung startet nicht',
        body: 'Der Export-Button reagiert nicht.',
        techContext: {
          appVersion: '2.5.1',
          panel: 'feedback',
          mode: 'saas',
          patientName: 'GEHEIM_PHI',
          diagnose: 'M54.5',
        },
      }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.ticket.source, 'saas');
    assert.equal(json.ticket.priority, 'kritisch');
    assert.equal(json.ticket.practice_name, 'Praxis Demo Nord');
    assert.deepEqual(json.ticket.tech_context, { appVersion: '2.5.1', panel: 'feedback', mode: 'saas' });
    assert.equal(json.ticket.tech_context.patientName, undefined);
    assert.equal(json.ticket.tech_context.diagnose, undefined);
    assert.equal(opsDb.state.ops_tickets[0].customer_id, custId);
    assert.equal(opsDb.state.ops_alerts.length, 1);
    assert.equal(opsDb.state.ops_alerts[0].kind, 'ticket_urgent');
  });
});

test('2. Strict is_internal_note = false isolation on SaaS GET /tickets', async () => {
  const tenantA = makeId('aaaa', 2);
  const opsDb = makeInMemoryOpsDb();
  const ticketId = makeId('2222', 1);
  opsDb.state.ops_tickets.push({
    id: ticketId,
    ticket_no: 1001,
    tenant_id: tenantA,
    source: 'saas',
    practice_name: 'Praxis Test',
    category: 'support',
    priority: 'normal',
    status: 'in_arbeit',
    subject: 'Frage zu Vorlagen',
    tech_context: {},
    created_at: '2026-11-27T10:00:00Z',
    updated_at: '2026-11-27T10:00:00Z',
  });
  opsDb.state.ops_ticket_messages.push(
    {
      id: makeId('3333', 1),
      ticket_id: ticketId,
      sender_type: 'praxis',
      sender_name: 'Praxis Test',
      body: 'Wie drucke ich?',
      is_internal_note: false,
      created_at: '2026-11-27T10:00:00Z',
    },
    {
      id: makeId('3333', 2),
      ticket_id: ticketId,
      sender_type: 'staff',
      sender_name: 'Support',
      body: 'INTERNE NOTIZ: Bitte später zurückrufen, Bug bekannt.',
      is_internal_note: true,
      created_at: '2026-11-27T10:05:00Z',
    },
    {
      id: makeId('3333', 3),
      ticket_id: ticketId,
      sender_type: 'staff',
      sender_name: 'Support',
      body: 'Öffentliche Antwort an Praxis.',
      is_internal_note: false,
      created_at: '2026-11-27T10:10:00Z',
    },
  );

  const router = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    requireAuthImpl: makeHeaderAuth(),
  });

  await withServer(router, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/support/tickets`, {
      headers: { 'x-test-tenant': tenantA },
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.tickets.length, 1);
    assert.equal(json.tickets[0].messages.length, 2);
    assert.ok(json.tickets[0].messages.every((m) => !m.body.includes('INTERNE NOTIZ')));
    assert.equal(json.tickets[0].messages[0].is_internal_note, undefined);
  });
});

test('3. Strict cross-tenant isolation & follow-up reopen', async () => {
  const tenantA = makeId('aaaa', 3);
  const tenantB = makeId('bbbb', 4);
  const opsDb = makeInMemoryOpsDb();
  const ticketA = makeId('2222', 99);
  opsDb.state.ops_tickets.push({
    id: ticketA,
    ticket_no: 1002,
    tenant_id: tenantA,
    source: 'saas',
    practice_name: 'Praxis Alpha',
    category: 'support',
    priority: 'normal',
    status: 'wartet',
    subject: 'Nur für Alpha',
    tech_context: {},
    created_at: '2026-11-27T10:00:00Z',
    updated_at: '2026-11-27T10:00:00Z',
  });

  const router = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    requireAuthImpl: makeHeaderAuth(),
  });

  await withServer(router, async (baseUrl) => {
    // Tenant B sieht Ticket A nicht
    const listB = await fetch(`${baseUrl}/api/support/tickets`, {
      headers: { 'x-test-tenant': tenantB },
    });
    assert.equal(listB.status, 200);
    assert.deepEqual((await listB.json()).tickets, []);

    // Tenant B darf keine Nachricht an Ticket A schreiben
    const postB = await fetch(`${baseUrl}/api/support/tickets/${ticketA}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-tenant': tenantB },
      body: JSON.stringify({ body: 'Fremder Zugriff' }),
    });
    assert.equal(postB.status, 404);
    assert.equal(opsDb.state.ops_ticket_messages.length, 0);

    // Tenant A darf antworten -> Status springt von 'wartet' zurück auf 'neu'
    const postA = await fetch(`${baseUrl}/api/support/tickets/${ticketA}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-tenant': tenantA },
      body: JSON.stringify({ body: 'Hier noch eine Rückfrage' }),
    });
    assert.equal(postA.status, 201);
    const bodyA = await postA.json();
    assert.equal(bodyA.status, 'neu');
    assert.equal(opsDb.state.ops_tickets[0].status, 'neu');
  });
});

test('4. Staff reply SMTP send vs internal note no-email + sales RBAC 403', async () => {
  const ticketId = makeId('2222', 55);
  const supportId = makeId('9999', 1);
  const salesId = makeId('9999', 2);

  const opsDb = makeInMemoryOpsDb({
    tokenUsers: {
      'tok-support': { id: supportId },
      'tok-sales': { id: salesId },
    },
    members: {
      [supportId]: { id: supportId, email: 'sup@praxura.invalid', display_name: 'Support Team', role: 'support', is_active: true },
      [salesId]: { id: salesId, email: 'sales@praxura.invalid', display_name: 'Sales Team', role: 'sales', is_active: true },
    },
  });
  opsDb.state.ops_tickets.push({
    id: ticketId,
    ticket_no: 1055,
    tenant_id: makeId('aaaa', 5),
    source: 'saas',
    practice_name: 'Praxis Süd',
    contact_email: 'kontakt@praxis-sued.invalid',
    category: 'support',
    priority: 'normal',
    status: 'neu',
    subject: 'Zertifikat erneuern',
    tech_context: {},
    first_response_at: null,
    resolved_at: null,
    created_at: '2026-11-27T10:00:00Z',
    updated_at: '2026-11-27T10:00:00Z',
  });

  const sentMails = [];
  const router = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    mailSender: async (mailOpts) => { sentMails.push(mailOpts); },
  });

  await withServer(router, async (baseUrl) => {
    // Sales darf nicht über /cockpit/tickets/:id/reply nach außen antworten
    const rSales = await fetch(`${baseUrl}/api/support/cockpit/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok-sales' },
      body: JSON.stringify({ body: 'Test', isInternalNote: false }),
    });
    assert.equal(rSales.status, 403);

    // Interne Notiz -> KEINE E-Mail, first_response_at bleibt null
    const rInternal = await fetch(`${baseUrl}/api/support/cockpit/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok-support' },
      body: JSON.stringify({ body: 'Interner Hinweis für Technik', isInternalNote: true }),
    });
    assert.equal(rInternal.status, 201);
    const jInternal = await rInternal.json();
    assert.equal(jInternal.emailed, false);
    assert.equal(jInternal.message.is_internal_note, true);
    assert.equal(sentMails.length, 0);
    assert.equal(opsDb.state.ops_tickets[0].first_response_at, null);

    // Echte Antwort -> E-Mail versendet, emailed_at + first_response_at + status gesetzt
    const rReply = await fetch(`${baseUrl}/api/support/cockpit/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok-support' },
      body: JSON.stringify({
        body: 'Bitte laden Sie die neue Datei hoch.',
        isInternalNote: false,
        newStatus: 'wartet',
        sendEmail: true,
      }),
    });
    assert.equal(rReply.status, 201);
    const jReply = await rReply.json();
    assert.equal(jReply.emailed, true);
    assert.ok(jReply.message.emailed_at);
    assert.equal(sentMails.length, 1);
    assert.equal(sentMails[0].to, 'kontakt@praxis-sued.invalid');
    assert.match(sentMails[0].subject, /#1055/);
    assert.ok(sentMails[0].text.includes('Bitte laden Sie die neue Datei hoch.'));
    assert.ok(sentMails[0].html.includes('Bitte laden Sie die neue Datei hoch.'));
    assert.equal(opsDb.state.ops_tickets[0].status, 'wartet');
    assert.ok(opsDb.state.ops_tickets[0].first_response_at);
  });
});

test('5. Box Ed25519 signed create/list + 401 on bad sig + internal note hidden', async () => {
  const box1 = makeBoxIdentity();
  const box2 = makeBoxIdentity();
  const opsDb = makeInMemoryOpsDb();

  const router = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    boxKeyResolver: async (boxId) => {
      if (boxId === box1.boxId) {
        return { publicKey: box1.publicKeyBase64url, boxName: 'sonne-tal-42', practiceName: 'Praxis Tal' };
      }
      if (boxId === box2.boxId) {
        return { publicKey: box2.publicKeyBase64url, boxName: 'wald-berg-11', practiceName: 'Praxis Berg' };
      }
      return null;
    },
  });

  await withServer(router, async (baseUrl) => {
    const createUrl = `${baseUrl}/api/support/box/tickets`;
    const body1 = JSON.stringify({
      category: 'box',
      priority: 'hoch',
      subject: 'Backup-Platte fast voll',
      body: 'Freier Speicher unter 10%.',
      techContext: { mode: 'box', panel: 'feedback', patientName: 'DROP_ME' },
    });
    const sig1 = signiereAnfrage({ method: 'POST', url: createUrl, body: body1, kimlik: box1 });
    const rCreate = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sig1.headers },
      body: body1,
    });
    assert.equal(rCreate.status, 201);
    const created = await rCreate.json();
    assert.equal(created.ticket.source, 'box');
    assert.deepEqual(created.ticket.tech_context, { mode: 'box', panel: 'feedback' });

    // Interne Notiz hinzufügen — Box darf sie nicht sehen
    opsDb.state.ops_ticket_messages.push({
      id: makeId('4444', 1),
      ticket_id: created.ticket.id,
      sender_type: 'staff',
      sender_name: 'Tech',
      body: 'INTERN_BOX_GEHEIM',
      is_internal_note: true,
      created_at: new Date().toISOString(),
    });

    // Replay der exakt selben Signatur -> 401
    const rReplay = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sig1.headers },
      body: body1,
    });
    assert.equal(rReplay.status, 401);

    // Manipulierter Body mit neuer Signatur für anderen Inhalt -> 401
    const sigBad = signiereAnfrage({ method: 'POST', url: createUrl, body: '{"a":1}', kimlik: box1 });
    const rTampered = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sigBad.headers },
      body: body1,
    });
    assert.equal(rTampered.status, 401);

    // Gültiges GET für box1 -> sieht Ticket ohne interne Notiz
    const listUrl = `${baseUrl}/api/support/box/tickets`;
    const sigList1 = signiereAnfrage({ method: 'GET', url: listUrl, kimlik: box1 });
    const rList1 = await fetch(listUrl, { headers: { ...sigList1.headers } });
    assert.equal(rList1.status, 200);
    const jList1 = await rList1.json();
    assert.equal(jList1.tickets.length, 1);
    assert.equal(jList1.tickets[0].messages.length, 1);
    assert.ok(jList1.tickets[0].messages.every((m) => !m.body.includes('INTERN_BOX_GEHEIM')));

    // Gültiges GET für box2 -> sieht Tickets von box1 nicht
    const sigList2 = signiereAnfrage({ method: 'GET', url: listUrl, kimlik: box2 });
    const rList2 = await fetch(listUrl, { headers: { ...sigList2.headers } });
    assert.equal(rList2.status, 200);
    assert.deepEqual((await rList2.json()).tickets, []);
  });
});

test('6. Box local relay mode: 503 offline fallback + signed round-trip when configured', async () => {
  const tenantBox = makeId('bbbb', 9);
  const boxKimlik = makeBoxIdentity();

  // 6a. Ohne SUPPORT_API_URL -> 503 SUPPORT_OFFLINE
  const offlineRouter = createSupportRouter({
    istKutu: true,
    env: {},
    kimlikLoader: () => boxKimlik,
    requireAuthImpl: makeHeaderAuth(),
  });

  await withServer(offlineRouter, async (baseUrl) => {
    const rOffline = await fetch(`${baseUrl}/api/support/tickets`, {
      headers: { 'x-test-tenant': tenantBox },
    });
    assert.equal(rOffline.status, 503);
    const j = await rOffline.json();
    assert.equal(j.error, 'SUPPORT_OFFLINE');
    assert.equal(j.fallbackEmail, 'support@praxura.de');
  });

  // 6b. Mit laufendem Zentralserver -> Ende-zu-Ende signiertes Relay
  const opsDb = makeInMemoryOpsDb();
  const centralRouter = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    boxKeyResolver: async (boxId) => (boxId === boxKimlik.boxId
      ? { publicKey: boxKimlik.publicKeyBase64url, boxName: 'birke-see-77', practiceName: 'Praxis Birke' }
      : null),
  });

  await withServer(centralRouter, async (centralBase) => {
    const relayRouter = createSupportRouter({
      istKutu: true,
      env: { SUPPORT_API_URL: centralBase },
      kimlikLoader: () => boxKimlik,
      requireAuthImpl: makeHeaderAuth(),
    });

    await withServer(relayRouter, async (relayBase) => {
      const rPost = await fetch(`${relayBase}/api/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-tenant': tenantBox },
        body: JSON.stringify({
          category: 'support',
          priority: 'normal',
          subject: 'Frage aus Box',
          body: 'Testnachricht über signiertes Relay',
          techContext: { mode: 'box', panel: 'feedback', kvnr: 'DROP' },
        }),
      });
      assert.equal(rPost.status, 201);
      const created = await rPost.json();
      assert.equal(created.ticket.source, 'box');
      assert.deepEqual(created.ticket.tech_context, { mode: 'box', panel: 'feedback' });

      const rGet = await fetch(`${relayBase}/api/support/tickets`, {
        headers: { 'x-test-tenant': tenantBox },
      });
      assert.equal(rGet.status, 200);
      const list = await rGet.json();
      assert.equal(list.tickets.length, 1);
      assert.equal(list.tickets[0].subject, 'Frage aus Box');
    });
  });
});

test('7. Manual/internal ticket leak prevention on SaaS and Box portals (HIGH #1)', async () => {
  const tenantA = makeId('aaaa', 7);
  const custBoxId = makeId('cccc', 7);
  const box = makeBoxIdentity();
  const boxName = 'kiefer-tal-07';

  const opsDb = makeInMemoryOpsDb();
  const saasTicketId = makeId('2222', 701);
  const saasManualId = makeId('2222', 702);
  const boxTicketId = makeId('2222', 703);
  const boxManualId = makeId('2222', 704);

  opsDb.state.ops_tickets.push(
    {
      id: saasTicketId,
      ticket_no: 2001,
      tenant_id: tenantA,
      source: 'saas',
      practice_name: 'Praxis Nord',
      category: 'support',
      priority: 'normal',
      status: 'neu',
      subject: 'Sichtbares SaaS-Ticket',
      tech_context: {},
      created_at: '2026-11-27T10:00:00Z',
      updated_at: '2026-11-27T10:00:00Z',
    },
    {
      id: saasManualId,
      ticket_no: 2002,
      tenant_id: tenantA,
      source: 'manual',
      practice_name: 'Praxis Nord',
      category: 'sonstiges',
      priority: 'hoch',
      status: 'neu',
      subject: 'INTERNES SALES-TICKET SAAS',
      tech_context: {},
      created_at: '2026-11-27T10:01:00Z',
      updated_at: '2026-11-27T10:01:00Z',
    },
    {
      id: boxTicketId,
      ticket_no: 2003,
      customer_id: custBoxId,
      box_name: boxName,
      source: 'box',
      practice_name: 'Praxis Kiefer',
      category: 'box',
      priority: 'normal',
      status: 'neu',
      subject: 'Sichtbares Box-Ticket',
      tech_context: {},
      created_at: '2026-11-27T10:02:00Z',
      updated_at: '2026-11-27T10:02:00Z',
    },
    {
      id: boxManualId,
      ticket_no: 2004,
      customer_id: custBoxId,
      box_name: boxName,
      source: 'manual',
      practice_name: 'Praxis Kiefer',
      category: 'sonstiges',
      priority: 'hoch',
      status: 'neu',
      subject: 'INTERNES SALES-TICKET BOX',
      tech_context: {},
      created_at: '2026-11-27T10:03:00Z',
      updated_at: '2026-11-27T10:03:00Z',
    },
  );

  const router = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    requireAuthImpl: makeHeaderAuth(),
    boxKeyResolver: async (boxId) => (boxId === box.boxId
      ? { publicKey: box.publicKeyBase64url, boxName, customerId: custBoxId, practiceName: 'Praxis Kiefer' }
      : null),
  });

  await withServer(router, async (baseUrl) => {
    // SaaS GET darf nur source='saas' liefern
    const rSaasGet = await fetch(`${baseUrl}/api/support/tickets`, {
      headers: { 'x-test-tenant': tenantA },
    });
    assert.equal(rSaasGet.status, 200);
    const saasList = await rSaasGet.json();
    assert.equal(saasList.tickets.length, 1);
    assert.equal(saasList.tickets[0].id, saasTicketId);
    assert.ok(saasList.tickets.every((t) => t.source === 'saas'));

    // SaaS POST /messages auf source='manual' -> 404
    const rSaasPostManual = await fetch(`${baseUrl}/api/support/tickets/${saasManualId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-tenant': tenantA },
      body: JSON.stringify({ body: 'Darf nicht klappen' }),
    });
    assert.equal(rSaasPostManual.status, 404);

    // Box GET darf nur source='box' liefern
    const boxListUrl = `${baseUrl}/api/support/box/tickets`;
    const sigBoxGet = signiereAnfrage({ method: 'GET', url: boxListUrl, kimlik: box });
    const rBoxGet = await fetch(boxListUrl, { headers: { ...sigBoxGet.headers } });
    assert.equal(rBoxGet.status, 200);
    const boxList = await rBoxGet.json();
    assert.equal(boxList.tickets.length, 1);
    assert.equal(boxList.tickets[0].id, boxTicketId);
    assert.ok(boxList.tickets.every((t) => t.source === 'box'));

    // Box POST /messages auf source='manual' -> 404
    const boxMsgUrl = `${baseUrl}/api/support/box/tickets/${boxManualId}/messages`;
    const boxMsgBody = JSON.stringify({ body: 'Darf nicht klappen' });
    const sigBoxPost = signiereAnfrage({ method: 'POST', url: boxMsgUrl, body: boxMsgBody, kimlik: box });
    const rBoxPostManual = await fetch(boxMsgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sigBoxPost.headers },
      body: boxMsgBody,
    });
    assert.equal(rBoxPostManual.status, 404);
  });
});

test('8. Box immutable customer_id scoping survives box_name rename (MEDIUM #5)', async () => {
  const box = makeBoxIdentity();
  const custId = makeId('cccc', 8);
  const ticketId = makeId('2222', 801);
  const opsDb = makeInMemoryOpsDb();
  opsDb.state.ops_tickets.push({
    id: ticketId,
    ticket_no: 2101,
    customer_id: custId,
    box_name: 'alter-box-name',
    source: 'box',
    practice_name: 'Praxis Umbau',
    category: 'box',
    priority: 'normal',
    status: 'wartet',
    subject: 'Ticket vor Umbenennung',
    tech_context: {},
    created_at: '2026-11-27T10:00:00Z',
    updated_at: '2026-11-27T10:00:00Z',
  });

  const router = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    boxKeyResolver: async (boxId) => (boxId === box.boxId
      ? { publicKey: box.publicKeyBase64url, boxName: 'neuer-box-name', customerId: custId, practiceName: 'Praxis Umbau' }
      : null),
  });

  await withServer(router, async (baseUrl) => {
    const listUrl = `${baseUrl}/api/support/box/tickets`;
    const sigGet = signiereAnfrage({ method: 'GET', url: listUrl, kimlik: box });
    const rGet = await fetch(listUrl, { headers: { ...sigGet.headers } });
    assert.equal(rGet.status, 200);
    const list = await rGet.json();
    assert.equal(list.tickets.length, 1);
    assert.equal(list.tickets[0].id, ticketId);

    const msgUrl = `${baseUrl}/api/support/box/tickets/${ticketId}/messages`;
    const body = JSON.stringify({ body: 'Nach Umbenennung geantwortet' });
    const sigPost = signiereAnfrage({ method: 'POST', url: msgUrl, body, kimlik: box });
    const rPost = await fetch(msgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sigPost.headers },
      body,
    });
    assert.equal(rPost.status, 201);
    assert.equal((await rPost.json()).status, 'neu');
  });
});

test('9. Orphan ticket cleanup on initial message insert failure (MEDIUM #6)', async () => {
  const tenantA = makeId('aaaa', 9);
  const box = makeBoxIdentity();
  const opsDb = makeInMemoryOpsDb({ failMessageInsert: true });

  const router = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    requireAuthImpl: makeHeaderAuth(),
    boxKeyResolver: async (boxId) => (boxId === box.boxId
      ? { publicKey: box.publicKeyBase64url, boxName: 'cleanup-box', customerId: makeId('cccc', 9), practiceName: 'Praxis Cleanup' }
      : null),
  });

  await withServer(router, async (baseUrl) => {
    const rSaas = await fetch(`${baseUrl}/api/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-tenant': tenantA },
      body: JSON.stringify({ subject: 'Soll bereinigt werden', body: 'Initialtext' }),
    });
    assert.equal(rSaas.status, 500);
    assert.equal(opsDb.state.ops_tickets.length, 0);

    const boxUrl = `${baseUrl}/api/support/box/tickets`;
    const body = JSON.stringify({ subject: 'Box-Ticket bereinigen', body: 'Initialtext' });
    const sig = signiereAnfrage({ method: 'POST', url: boxUrl, body, kimlik: box });
    const rBox = await fetch(boxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sig.headers },
      body,
    });
    assert.equal(rBox.status, 500);
    assert.equal(opsDb.state.ops_tickets.length, 0);
  });
});

test('10. Production guard rejects http://localhost in resolveSupportApiUrl (MEDIUM #4) & rate limiters (HIGH #3)', async () => {
  const tenantA = makeId('aaaa', 10);
  const box = makeBoxIdentity();

  const prodRelay = createSupportRouter({
    istKutu: true,
    env: { NODE_ENV: 'production', SUPPORT_API_URL: 'http://127.0.0.1:8089' },
    kimlikLoader: () => box,
    requireAuthImpl: makeHeaderAuth(),
  });

  await withServer(prodRelay, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/support/tickets`, {
      headers: { 'x-test-tenant': tenantA },
    });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'SUPPORT_OFFLINE');
  });

  // Rate limiter on /box/* (30 req/min -> 31st returns 429) & POST /tickets (15 req/10min -> 16th returns 429)
  const opsDb = makeInMemoryOpsDb();
  const limitedRouter = createSupportRouter({
    opsSupabase: opsDb,
    istKutu: false,
    requireAuthImpl: makeHeaderAuth(),
  });

  await withServer(limitedRouter, async (baseUrl) => {
    let boxStatus = 0;
    for (let i = 0; i < 31; i++) {
      const r = await fetch(`${baseUrl}/api/support/box/tickets`);
      boxStatus = r.status;
    }
    assert.equal(boxStatus, 429);

    let writeStatus = 0;
    for (let i = 0; i < 16; i++) {
      const r = await fetch(`${baseUrl}/api/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-tenant': tenantA },
        body: JSON.stringify({ subject: `Ticket ${i}`, body: 'Inhalt' }),
      });
      writeStatus = r.status;
    }
    assert.equal(writeStatus, 429);
  });
});
