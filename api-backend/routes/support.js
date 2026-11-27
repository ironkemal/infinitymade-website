/**
 * Praxura Support Ticket Routes (`/api/support/*`)
 *
 * Hybrid-Architektur:
 * - Zentralmodus (`!istKutu`):
 *   - SaaS-Praxen (`requireAuth` → `POST /tickets`, `GET /tickets`, `POST /tickets/:id/messages`)
 *   - On-Prem-Boxen (Ed25519-signiert → `POST /box/tickets`, `GET /box/tickets`, `POST /box/tickets/:id/messages`)
 *   - Cockpit-Team (`requireCockpitRole` → `POST /cockpit/tickets/:id/reply` inkl. SMTP-Antwort)
 * - Box-Relay-Modus (`istKutu === true`):
 *   - Authentifiziert lokal via `requireAuth`, bereinigt `techContext`, signiert per Box-Kimlik
 *     und leitet an `${SUPPORT_API_URL}/api/support/box/*` weiter (oder `503 SUPPORT_OFFLINE`).
 *
 * DSGVO / G1:
 * - KEINE Patientendaten (PHI) in Tickets, Nachrichten oder `tech_context`.
 * - Interne Mitarbeiter-Notizen (`is_internal_note = true`) werden NIEMALS an Praxen ausgeliefert.
 */

import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireCockpitRole, getOpsSupabaseFromEnv } from './cockpit.js';
import { createSMTPTransport, getMailFrom } from '../lib/mail.js';
import { renderePraxuraMail, baueMailOptionen } from '../lib/mail-vorlage.js';
import { istKutu as istKutuEnv } from '../lib/dagitim.js';
import {
  leseSignaturKopf,
  pruefeSignatur,
  signiereAnfrage,
  NONCE_GUELTIG_SEKUNDEN,
} from '../merkez-istemci/signatur.js';
import { ladeKimlik } from '../merkez-istemci/kimlik.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SUPPORT_FALLBACK_EMAIL = 'support@praxura.de';
export const SUPPORT_CATEGORIES = Object.freeze(['bug', 'support', 'feature', 'abrechnung', 'box', 'sonstiges']);
export const SUPPORT_PRIORITIES = Object.freeze(['niedrig', 'normal', 'hoch', 'kritisch']);
export const SUPPORT_STATUSES = Object.freeze(['neu', 'in_arbeit', 'wartet', 'geloest']);

const CATEGORY_SET = new Set(SUPPORT_CATEGORIES);
const PRIORITY_SET = new Set(SUPPORT_PRIORITIES);
const STATUS_SET = new Set(SUPPORT_STATUSES);
const TECH_CONTEXT_KEYS = Object.freeze(['appVersion', 'panel', 'mode', 'browser']);
const MAX_NONCES = 5000;

/** @type {Promise<any> | null} */
let cachedRequireAuthPromise = null;

/**
 * Lädt `../ai/auth.js` erst bei Bedarf (damit Tests ohne `SUPABASE_URL` importieren können).
 * @param {any} injected
 */
async function resolveRequireAuth(injected) {
  if (injected) return injected;
  if (!cachedRequireAuthPromise) {
    cachedRequireAuthPromise = import('../ai/auth.js')
      .then((m) => m.requireAuth)
      .catch((err) => {
        cachedRequireAuthPromise = null;
        throw err;
      });
  }
  return cachedRequireAuthPromise;
}

/**
 * Strenge Allowlist für technischen Kontext — verhindert PHI-Einschleusung (G1).
 * @param {unknown} raw
 * @returns {{ appVersion?: string, panel?: string, mode?: string, browser?: string }}
 */
export function sanitizeTechContext(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of TECH_CONTEXT_KEYS) {
    const val = /** @type {Record<string, unknown>} */ (raw)[key];
    if (typeof val !== 'string') continue;
    const trimmed = val.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120);
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

/**
 * @param {unknown} raw
 * @param {number} maxLen
 */
function cleanText(raw, maxLen) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

/**
 * @param {any} body
 * @param {{ requireSubject?: boolean }} [opts]
 */
function validateTicketInput(body, { requireSubject = true } = {}) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  let subject = '';
  if (requireSubject) {
    if (typeof payload.subject !== 'string') return { ok: false, error: 'INVALID_SUBJECT' };
    subject = payload.subject.trim();
    if (subject.length < 1 || subject.length > 200) return { ok: false, error: 'INVALID_SUBJECT' };
  }

  if (typeof payload.body !== 'string') return { ok: false, error: 'INVALID_BODY' };
  const messageBody = payload.body.trim();
  if (messageBody.length < 1 || messageBody.length > 5000) return { ok: false, error: 'INVALID_BODY' };

  let category = 'support';
  if (payload.category !== undefined && payload.category !== null && payload.category !== '') {
    if (typeof payload.category !== 'string' || !CATEGORY_SET.has(payload.category)) {
      return { ok: false, error: 'INVALID_CATEGORY' };
    }
    category = payload.category;
  }

  let priority = 'normal';
  if (payload.priority !== undefined && payload.priority !== null && payload.priority !== '') {
    if (typeof payload.priority !== 'string' || !PRIORITY_SET.has(payload.priority)) {
      return { ok: false, error: 'INVALID_PRIORITY' };
    }
    priority = payload.priority;
  }

  const techContext = sanitizeTechContext(payload.techContext);
  return { ok: true, subject, body: messageBody, category, priority, techContext };
}

/**
 * @param {any} row
 */
function sanitizePublicTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticket_no: row.ticket_no,
    source: row.source,
    practice_name: row.practice_name || '',
    category: row.category,
    priority: row.priority,
    status: row.status,
    subject: row.subject,
    tech_context: sanitizeTechContext(row.tech_context),
    first_response_at: row.first_response_at || null,
    resolved_at: row.resolved_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * @param {any} row
 */
function sanitizePublicMessage(row) {
  if (!row || row.is_internal_note === true) return null;
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    sender_type: row.sender_type,
    sender_name: row.sender_name || (row.sender_type === 'staff' ? 'Praxura-Team' : 'Praxis'),
    body: row.body,
    created_at: row.created_at,
  };
}

/**
 * Validiert `SUPPORT_API_URL` für Box-Relay-Weiterleitungen (https:// oder lokaler Testserver).
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
function resolveSupportApiUrl(env) {
  const raw = String(env?.SUPPORT_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const isHttps = parsed.protocol === 'https:';
    const isProd = String(env?.NODE_ENV || '').toLowerCase() === 'production';
    const isLocalTest = !isProd
      && parsed.protocol === 'http:'
      && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isHttps && !isLocalTest) return null;
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * Best-effort Auflösung von Praxisname und Kontakt-E-Mail aus dem Produkt-Schema (ohne PHI).
 * @param {any} supabase
 * @param {string} userId
 * @param {string} tenantId
 */
async function resolvePracticeMeta(supabase, userId, tenantId) {
  if (!supabase) return { practiceName: 'Praxis', contactEmail: null, senderName: 'Praxis' };
  let practiceName = '';
  let contactEmail = null;
  let senderName = '';

  try {
    const { data: bizRows } = await supabase
      .from('businesses')
      .select('business_name, is_default')
      .eq('owner_id', tenantId);
    if (Array.isArray(bizRows) && bizRows.length) {
      const def = bizRows.find((b) => b.is_default) || bizRows[0];
      practiceName = cleanText(def?.business_name, 120);
    }
  } catch { /* best-effort */ }

  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('email, business_name, owner_first_name, owner_last_name')
      .eq('id', userId)
      .maybeSingle();
    if (prof) {
      if (!practiceName) practiceName = cleanText(prof.business_name, 120);
      if (typeof prof.email === 'string' && EMAIL_RE.test(prof.email.trim())) {
        contactEmail = prof.email.trim().slice(0, 160);
      }
      const fullName = [prof.owner_first_name, prof.owner_last_name].filter(Boolean).join(' ').trim();
      senderName = cleanText(fullName || practiceName, 120);
    }
  } catch { /* best-effort */ }

  return {
    practiceName: practiceName || 'Praxis',
    contactEmail,
    senderName: senderName || practiceName || 'Praxis',
  };
}

/**
 * Sendet eine Mail über injizierten `mailSender` oder Env-SMTP (`createSMTPTransport`).
 * @param {{ mailSender?: any, env: Record<string, string | undefined>, mailOptions: any }} opts
 */
async function dispatchMail({ mailSender, env, mailOptions }) {
  if (typeof mailSender === 'function') {
    await mailSender(mailOptions);
    return true;
  }
  if (mailSender && typeof mailSender.sendMail === 'function') {
    await mailSender.sendMail(mailOptions);
    return true;
  }
  if (!env?.SMTP_HOST) {
    return false;
  }
  const transport = createSMTPTransport({ requireTLS: true });
  await transport.sendMail(mailOptions);
  return true;
}

/**
 * Best-effort Dringlichkeits-Alert + optionale E-Mail für `hoch`/`kritisch`.
 * Darf die Ticket-Erstellung niemals abbrechen.
 */
async function notifyUrgentTicket({ ops, ticket, subject, priority, source, mailSender, env }) {
  try {
    await ops.from('ops_alerts').insert({
      kind: 'ticket_urgent',
      severity: priority === 'kritisch' ? 'critical' : 'warn',
      title: `Dringendes Ticket #${ticket.ticket_no}: ${subject}`,
      details: {
        ticket_id: ticket.id,
        ticket_no: ticket.ticket_no,
        priority,
        source,
      },
    });
  } catch { /* best-effort */ }

  const alertEmail = cleanText(env?.SUPPORT_ALERT_EMAIL, 160);
  if (!alertEmail || !EMAIL_RE.test(alertEmail)) return;

  try {
    const from = cleanText(env?.SUPPORT_FROM_EMAIL, 160) || getMailFrom('Praxura Support');
    const rendered = renderePraxuraMail({
      praxis: 'Praxura Support-Alert',
      titel: `Dringendes Ticket #${ticket.ticket_no} (${priority.toUpperCase()})`,
      absaetze: [
        `Es wurde ein Ticket mit Priorität „${priority}“ erstellt.`,
      ],
      boxZeilen: [
        { label: 'Ticket', wert: `#${ticket.ticket_no}` },
        { label: 'Quelle', wert: source },
        { label: 'Praxis', wert: ticket.practice_name || '—' },
        { label: 'Betreff', wert: subject },
      ],
    });
    const mailOptions = baueMailOptionen({
      from,
      to: alertEmail,
      subject: `[URGENT #${ticket.ticket_no}] ${subject}`,
      html: rendered.html,
      text: rendered.text,
      autoSubmitted: true,
    });
    await dispatchMail({ mailSender, env, mailOptions });
  } catch { /* best-effort */ }
}

/**
 * Erstellt den Express-Router für `/api/support/*`.
 * @param {{
 *   supabase?: any,
 *   opsSupabase?: any,
 *   istKutu?: boolean,
 *   mailSender?: any,
 *   boxKeyResolver?: (boxId: string) => Promise<{ publicKey: any, boxName?: string, customerId?: string | null, practiceName?: string, contactEmail?: string | null } | null>,
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof fetch,
 *   kimlikLoader?: () => any,
 *   requireAuthImpl?: any,
 *   disableRateLimit?: boolean,
 * }} [deps]
 */
export function createSupportRouter({
  supabase = null,
  opsSupabase = null,
  istKutu = istKutuEnv(),
  mailSender = null,
  boxKeyResolver = null,
  env = process.env,
  fetchImpl = globalThis.fetch,
  kimlikLoader = ladeKimlik,
  requireAuthImpl = null,
  disableRateLimit = false,
} = {}) {
  const router = Router();
  const isBox = Boolean(istKutu);
  const getOps = () => opsSupabase ?? getOpsSupabaseFromEnv();

  const noopLimiter = (/** @type {any} */ _req, /** @type {any} */ _res, /** @type {any} */ next) => next();
  const boxLimiter = disableRateLimit
    ? noopLimiter
    : rateLimit({
      windowMs: 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'SUPPORT_RATE_LIMIT_EXCEEDED' },
    });
  const writeLimiter = disableRateLimit
    ? noopLimiter
    : rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 15,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator: (/** @type {any} */ req) => (
        req.auth?.tenantId ? `tenant:${req.auth.tenantId}` : String(req.ip || 'anon')
      ),
      message: { error: 'SUPPORT_RATE_LIMIT_EXCEEDED' },
    });

  const authMiddleware = async (req, res, next) => {
    try {
      const fn = await resolveRequireAuth(requireAuthImpl);
      return fn(req, res, next);
    } catch (err) {
      console.error('[support/auth] unavailable:', err?.message || err);
      return res.status(503).json({ error: 'SUPPORT_AUTH_UNAVAILABLE' });
    }
  };

  // JSON-Fallback-Parser für Standalone-Mount in Tests (wenn server.js nicht vorgeschaltet ist)
  const jsonFallback = express.json({ limit: '64kb' });
  const ensureJsonBody = (req, res, next) => {
    if (req.body !== undefined) return next();
    return jsonFallback(req, res, next);
  };

  // ── Box-Relay-Modus (`istKutu === true`) ─────────────────────────────────
  if (isBox) {
    const forwardBox = async (req, res, { method, targetPath, bodyObj }) => {
      const supportApiUrl = resolveSupportApiUrl(env);
      if (!supportApiUrl) {
        return res.status(503).json({ error: 'SUPPORT_OFFLINE', fallbackEmail: SUPPORT_FALLBACK_EMAIL });
      }
      let kimlik = null;
      try { kimlik = kimlikLoader ? kimlikLoader() : null; } catch { kimlik = null; }
      if (!kimlik || !kimlik.boxId || !kimlik.privateKey) {
        return res.status(503).json({
          error: 'SUPPORT_OFFLINE',
          reason: 'BOX_IDENTITY_MISSING',
          fallbackEmail: SUPPORT_FALLBACK_EMAIL,
        });
      }

      const url = `${supportApiUrl}${targetPath}`;
      const bodyText = bodyObj === undefined ? undefined : JSON.stringify(bodyObj);
      const signed = signiereAnfrage({ method, url, body: bodyText, kimlik });
      /** @type {Record<string, string>} */
      const headers = { Accept: 'application/json', ...signed.headers };
      if (bodyText !== undefined) headers['Content-Type'] = 'application/json';

      try {
        const upstream = await fetchImpl(url, {
          method,
          headers,
          body: bodyText,
          redirect: 'error',
          signal: globalThis.AbortSignal?.timeout ? AbortSignal.timeout(10000) : undefined,
        });
        let parsed = null;
        try { parsed = await upstream.json(); } catch { parsed = null; }
        if (!upstream.ok && upstream.status >= 500) {
          return res.status(503).json({ error: 'SUPPORT_OFFLINE', fallbackEmail: SUPPORT_FALLBACK_EMAIL });
        }
        return res.status(upstream.status).json(parsed || {});
      } catch {
        return res.status(503).json({ error: 'SUPPORT_OFFLINE', fallbackEmail: SUPPORT_FALLBACK_EMAIL });
      }
    };

    router.post('/tickets', ensureJsonBody, authMiddleware, writeLimiter, async (req, res) => {
      const check = validateTicketInput(req.body, { requireSubject: true });
      if (!check.ok) return res.status(400).json({ error: check.error });

      const meta = await resolvePracticeMeta(supabase, req.auth.userId, req.auth.tenantId);
      const payload = {
        category: check.category,
        priority: check.priority,
        subject: check.subject,
        body: check.body,
        techContext: check.techContext,
        practiceName: meta.practiceName,
        ...(meta.contactEmail ? { contactEmail: meta.contactEmail } : {}),
      };
      return forwardBox(req, res, {
        method: 'POST',
        targetPath: '/api/support/box/tickets',
        bodyObj: payload,
      });
    });

    router.get('/tickets', authMiddleware, async (req, res) => {
      return forwardBox(req, res, {
        method: 'GET',
        targetPath: '/api/support/box/tickets',
      });
    });

    router.post('/tickets/:id/messages', ensureJsonBody, authMiddleware, writeLimiter, async (req, res) => {
      const ticketId = String(req.params?.id || '').trim();
      if (!UUID_RE.test(ticketId)) return res.status(400).json({ error: 'INVALID_TICKET_ID' });

      const check = validateTicketInput(req.body, { requireSubject: false });
      if (!check.ok) return res.status(400).json({ error: check.error });

      return forwardBox(req, res, {
        method: 'POST',
        targetPath: `/api/support/box/tickets/${ticketId}/messages`,
        bodyObj: { body: check.body },
      });
    });

    return router;
  }

  // ── Zentralmodus (`!istKutu`) ────────────────────────────────────────────

  /**
   * Gemeinsame Helfer für Ticket-Listen + öffentliche Nachrichten (strikter Filter auf `is_internal_note = false`).
   */
  async function attachPublicMessages(ops, tickets) {
    if (!tickets.length) return [];
    const ids = tickets.map((t) => t.id);
    const { data: msgRows, error: msgErr } = await ops
      .from('ops_ticket_messages')
      .select('id, ticket_id, sender_type, sender_name, body, is_internal_note, created_at')
      .in('ticket_id', ids)
      .eq('is_internal_note', false)
      .order('created_at', { ascending: true });

    if (msgErr) throw msgErr;

    /** @type {Map<string, any[]>} */
    const byTicket = new Map();
    for (const row of msgRows || []) {
      // Defense-in-depth: interne Notizen dürfen niemals an Praxen ausgeliefert werden
      if (row.is_internal_note === true) continue;
      const pub = sanitizePublicMessage(row);
      if (!pub) continue;
      const arr = byTicket.get(row.ticket_id) || [];
      arr.push(pub);
      byTicket.set(row.ticket_id, arr);
    }

    return tickets.map((t) => ({
      ...sanitizePublicTicket(t),
      messages: byTicket.get(t.id) || [],
    }));
  }

  // ── 1) SaaS-Praxis-Endpunkte ─────────────────────────────────────────────
  router.post('/tickets', ensureJsonBody, authMiddleware, writeLimiter, async (req, res) => {
    try {
      const ops = getOps();
      if (!ops) return res.status(503).json({ error: 'SUPPORT_SERVICE_UNAVAILABLE' });

      const check = validateTicketInput(req.body, { requireSubject: true });
      if (!check.ok) return res.status(400).json({ error: check.error });

      const { tenantId, userId } = req.auth;
      const meta = await resolvePracticeMeta(supabase, userId, tenantId);

      let customerId = null;
      try {
        const { data: cust } = await ops
          .from('ops_customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (cust?.id) customerId = cust.id;
      } catch { /* best-effort */ }

      const { data: ticket, error: tErr } = await ops
        .from('ops_tickets')
        .insert({
          customer_id: customerId,
          tenant_id: tenantId,
          source: 'saas',
          practice_name: meta.practiceName,
          contact_email: meta.contactEmail,
          category: check.category,
          priority: check.priority,
          status: 'neu',
          subject: check.subject,
          tech_context: check.techContext,
        })
        .select('*')
        .single();

      if (tErr || !ticket) {
        console.error('[support/saas] create ticket failed:', tErr?.code || tErr?.message);
        return res.status(500).json({ error: 'SUPPORT_TICKET_CREATE_FAILED' });
      }

      const { data: message, error: mErr } = await ops
        .from('ops_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'praxis',
          sender_name: meta.senderName,
          body: check.body,
          is_internal_note: false,
        })
        .select('id, ticket_id, sender_type, sender_name, body, is_internal_note, created_at')
        .single();

      if (mErr) {
        console.error('[support/saas] create initial message failed:', mErr?.code || mErr?.message);
        try {
          await ops.from('ops_tickets').delete().eq('id', ticket.id);
        } catch { /* best-effort */ }
        return res.status(500).json({ error: 'SUPPORT_MESSAGE_CREATE_FAILED' });
      }

      if (check.priority === 'hoch' || check.priority === 'kritisch') {
        await notifyUrgentTicket({
          ops,
          ticket,
          subject: check.subject,
          priority: check.priority,
          source: 'saas',
          mailSender,
          env,
        });
      }

      res.set('Cache-Control', 'no-store');
      return res.status(201).json({
        ticket: sanitizePublicTicket(ticket),
        message: sanitizePublicMessage(message),
      });
    } catch (err) {
      console.error('[support/saas] POST /tickets error:', err?.message || err);
      return res.status(500).json({ error: 'SUPPORT_TICKET_CREATE_FAILED' });
    }
  });

  router.get('/tickets', authMiddleware, async (req, res) => {
    try {
      const ops = getOps();
      if (!ops) return res.status(503).json({ error: 'SUPPORT_SERVICE_UNAVAILABLE' });

      const { tenantId } = req.auth;
      const { data: tickets, error: tErr } = await ops
        .from('ops_tickets')
        .select('id, ticket_no, tenant_id, source, practice_name, category, priority, status, subject, tech_context, first_response_at, resolved_at, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('source', 'saas')
        .order('created_at', { ascending: false });

      if (tErr) {
        console.error('[support/saas] list tickets failed:', tErr?.code || tErr?.message);
        return res.status(500).json({ error: 'SUPPORT_TICKETS_FETCH_FAILED' });
      }

      const ownTickets = (tickets || []).filter((t) => t.tenant_id === tenantId && t.source === 'saas');
      const enriched = await attachPublicMessages(ops, ownTickets);

      res.set('Cache-Control', 'no-store');
      return res.json({ tickets: enriched });
    } catch (err) {
      console.error('[support/saas] GET /tickets error:', err?.message || err);
      return res.status(500).json({ error: 'SUPPORT_TICKETS_FETCH_FAILED' });
    }
  });

  router.post('/tickets/:id/messages', ensureJsonBody, authMiddleware, writeLimiter, async (req, res) => {
    try {
      const ops = getOps();
      if (!ops) return res.status(503).json({ error: 'SUPPORT_SERVICE_UNAVAILABLE' });

      const ticketId = String(req.params?.id || '').trim();
      if (!UUID_RE.test(ticketId)) return res.status(400).json({ error: 'INVALID_TICKET_ID' });

      const check = validateTicketInput(req.body, { requireSubject: false });
      if (!check.ok) return res.status(400).json({ error: check.error });

      const { tenantId, userId } = req.auth;
      const { data: ticket, error: findErr } = await ops
        .from('ops_tickets')
        .select('id, tenant_id, source, status')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .eq('source', 'saas')
        .maybeSingle();

      if (findErr) {
        console.error('[support/saas] lookup ticket failed:', findErr?.code || findErr?.message);
        return res.status(500).json({ error: 'SUPPORT_TICKET_LOOKUP_FAILED' });
      }
      if (!ticket || ticket.tenant_id !== tenantId || ticket.source !== 'saas') {
        return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      }

      const meta = await resolvePracticeMeta(supabase, userId, tenantId);
      const { data: message, error: mErr } = await ops
        .from('ops_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'praxis',
          sender_name: meta.senderName,
          body: check.body,
          is_internal_note: false,
        })
        .select('id, ticket_id, sender_type, sender_name, body, is_internal_note, created_at')
        .single();

      if (mErr) {
        console.error('[support/saas] insert message failed:', mErr?.code || mErr?.message);
        return res.status(500).json({ error: 'SUPPORT_MESSAGE_CREATE_FAILED' });
      }

      let nextStatus = ticket.status;
      if (ticket.status === 'wartet' || ticket.status === 'geloest') {
        nextStatus = 'neu';
        await ops
          .from('ops_tickets')
          .update({ status: 'neu', resolved_at: null })
          .eq('id', ticket.id);
      }

      res.set('Cache-Control', 'no-store');
      return res.status(201).json({
        message: sanitizePublicMessage(message),
        status: nextStatus,
      });
    } catch (err) {
      console.error('[support/saas] POST /tickets/:id/messages error:', err?.message || err);
      return res.status(500).json({ error: 'SUPPORT_MESSAGE_CREATE_FAILED' });
    }
  });

  // ── 2) On-Prem-Box-Endpunkte (Ed25519-signiert) ──────────────────────────
  const boxNonces = new Map();
  const nonceNeu = (boxId, nonce) => {
    const now = Date.now();
    if (boxNonces.size > MAX_NONCES) {
      for (const [k, exp] of boxNonces.entries()) {
        if (exp <= now) boxNonces.delete(k);
      }
    }
    const key = `${boxId}:${nonce}`;
    const existing = boxNonces.get(key);
    if (existing && existing > now) return false;
    boxNonces.set(key, now + NONCE_GUELTIG_SEKUNDEN * 1000);
    return true;
  };

  const defaultBoxKeyResolver = async (boxId) => {
    const ops = getOps();
    if (!ops) {
      const err = new Error('BOX_VERIFIER_UNAVAILABLE');
      /** @type {any} */ (err).code = 'BOX_VERIFIER_UNAVAILABLE';
      throw err;
    }
    const { data, error } = await ops
      .from('ops_customers')
      .select('id, display_name, box_name, box_id, box_public_key, contact_email')
      .eq('box_id', boxId)
      .maybeSingle();

    if (error) {
      if (error.code === '42703') return null; // box_id/box_public_key noch nicht migriert -> fail closed 401
      const err = new Error('BOX_VERIFIER_UNAVAILABLE');
      /** @type {any} */ (err).code = 'BOX_VERIFIER_UNAVAILABLE';
      throw err;
    }
    if (!data || !data.box_public_key) return null;
    return {
      publicKey: data.box_public_key,
      boxName: data.box_name || boxId,
      customerId: data.id,
      practiceName: data.display_name || '',
      contactEmail: data.contact_email || null,
    };
  };

  const rawBoxParser = express.raw({ type: () => true, limit: '64kb' });
  const captureRawAndJsonForBox = (req, res, next) => {
    const finishFromRaw = (buf) => {
      req.rawBody = buf;
      if (!buf || buf.length === 0) {
        req.body = {};
        return next();
      }
      try {
        const parsed = JSON.parse(buf.toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return res.status(400).json({ error: 'INVALID_JSON' });
        }
        req.body = parsed;
        return next();
      } catch {
        return res.status(400).json({ error: 'INVALID_JSON' });
      }
    };

    if (Buffer.isBuffer(req.rawBody)) {
      return next();
    }
    if (Buffer.isBuffer(req.body)) {
      return finishFromRaw(req.body);
    }
    if (req.body === undefined) {
      return rawBoxParser(req, res, (err) => {
        if (err) return res.status(err.status || 400).json({ error: 'INVALID_BODY' });
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        return finishFromRaw(buf);
      });
    }
    // Leerer GET/DELETE ohne Body (z. B. vorgeschaltetes express.json setzt {})
    req.rawBody = Buffer.alloc(0);
    return next();
  };

  const requireBoxSignature = async (req, res, next) => {
    try {
      const kopf = leseSignaturKopf(req.headers);
      if (!kopf) return res.status(401).json({ error: 'INVALID_BOX_SIGNATURE' });

      const resolver = boxKeyResolver || defaultBoxKeyResolver;
      if (!boxKeyResolver && !getOps()) {
        return res.status(503).json({ error: 'BOX_VERIFIER_UNAVAILABLE' });
      }

      let resolved = null;
      try {
        resolved = await resolver(kopf.boxId);
      } catch (err) {
        if (err?.code === 'BOX_VERIFIER_UNAVAILABLE') {
          return res.status(503).json({ error: 'BOX_VERIFIER_UNAVAILABLE' });
        }
        return res.status(503).json({ error: 'BOX_VERIFIER_UNAVAILABLE' });
      }

      if (!resolved || !resolved.publicKey) {
        return res.status(401).json({ error: 'UNKNOWN_BOX' });
      }

      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.alloc(0);
      const host = String(req.headers?.host || '').toLowerCase();
      const sig = pruefeSignatur({
        method: req.method,
        host,
        pfad: req.originalUrl,
        body: rawBody,
        kopf,
        publicKey: resolved.publicKey,
        nonceNeu,
      });

      if (!sig.ok) {
        return res.status(401).json({ error: 'INVALID_BOX_SIGNATURE' });
      }

      req.boxAuth = {
        boxId: kopf.boxId,
        boxName: cleanText(resolved.boxName, 120) || kopf.boxId,
        customerId: resolved.customerId || null,
        practiceName: cleanText(resolved.practiceName, 120),
        contactEmail: (typeof resolved.contactEmail === 'string' && EMAIL_RE.test(resolved.contactEmail.trim()))
          ? resolved.contactEmail.trim().slice(0, 160)
          : null,
      };
      return next();
    } catch (err) {
      console.error('[support/box] signature check error:', err?.message || err);
      return res.status(500).json({ error: 'BOX_AUTH_FAILED' });
    }
  };

  router.use('/box', boxLimiter);

  router.post('/box/tickets', captureRawAndJsonForBox, requireBoxSignature, async (req, res) => {
    try {
      const ops = getOps();
      if (!ops) return res.status(503).json({ error: 'SUPPORT_SERVICE_UNAVAILABLE' });

      const check = validateTicketInput(req.body, { requireSubject: true });
      if (!check.ok) return res.status(400).json({ error: check.error });

      const box = req.boxAuth;
      const bodyEmail = typeof req.body?.contactEmail === 'string' && EMAIL_RE.test(req.body.contactEmail.trim())
        ? req.body.contactEmail.trim().slice(0, 160)
        : null;
      const practiceName = box.practiceName || cleanText(req.body?.practiceName, 120) || box.boxName;
      const contactEmail = box.contactEmail || bodyEmail;

      const { data: ticket, error: tErr } = await ops
        .from('ops_tickets')
        .insert({
          customer_id: box.customerId,
          box_name: box.boxName,
          source: 'box',
          practice_name: practiceName,
          contact_email: contactEmail,
          category: check.category,
          priority: check.priority,
          status: 'neu',
          subject: check.subject,
          tech_context: check.techContext,
        })
        .select('*')
        .single();

      if (tErr || !ticket) {
        console.error('[support/box] create ticket failed:', tErr?.code || tErr?.message);
        return res.status(500).json({ error: 'SUPPORT_TICKET_CREATE_FAILED' });
      }

      const { data: message, error: mErr } = await ops
        .from('ops_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'praxis',
          sender_name: practiceName,
          body: check.body,
          is_internal_note: false,
        })
        .select('id, ticket_id, sender_type, sender_name, body, is_internal_note, created_at')
        .single();

      if (mErr) {
        console.error('[support/box] create initial message failed:', mErr?.code || mErr?.message);
        try {
          await ops.from('ops_tickets').delete().eq('id', ticket.id);
        } catch { /* best-effort */ }
        return res.status(500).json({ error: 'SUPPORT_MESSAGE_CREATE_FAILED' });
      }

      if (check.priority === 'hoch' || check.priority === 'kritisch') {
        await notifyUrgentTicket({
          ops,
          ticket,
          subject: check.subject,
          priority: check.priority,
          source: 'box',
          mailSender,
          env,
        });
      }

      res.set('Cache-Control', 'no-store');
      return res.status(201).json({
        ticket: sanitizePublicTicket(ticket),
        message: sanitizePublicMessage(message),
      });
    } catch (err) {
      console.error('[support/box] POST /box/tickets error:', err?.message || err);
      return res.status(500).json({ error: 'SUPPORT_TICKET_CREATE_FAILED' });
    }
  });

  router.get('/box/tickets', captureRawAndJsonForBox, requireBoxSignature, async (req, res) => {
    try {
      const ops = getOps();
      if (!ops) return res.status(503).json({ error: 'SUPPORT_SERVICE_UNAVAILABLE' });

      const { boxName, customerId } = req.boxAuth;
      let query = ops
        .from('ops_tickets')
        .select('id, ticket_no, customer_id, box_name, source, practice_name, category, priority, status, subject, tech_context, first_response_at, resolved_at, created_at, updated_at')
        .eq('source', 'box');
      query = customerId ? query.eq('customer_id', customerId) : query.eq('box_name', boxName);
      const { data: tickets, error: tErr } = await query.order('created_at', { ascending: false });

      if (tErr) {
        console.error('[support/box] list tickets failed:', tErr?.code || tErr?.message);
        return res.status(500).json({ error: 'SUPPORT_TICKETS_FETCH_FAILED' });
      }

      const ownTickets = (tickets || []).filter((t) => (
        t.source === 'box' && (customerId ? t.customer_id === customerId : t.box_name === boxName)
      ));
      const enriched = await attachPublicMessages(ops, ownTickets);

      res.set('Cache-Control', 'no-store');
      return res.json({ tickets: enriched });
    } catch (err) {
      console.error('[support/box] GET /box/tickets error:', err?.message || err);
      return res.status(500).json({ error: 'SUPPORT_TICKETS_FETCH_FAILED' });
    }
  });

  router.post('/box/tickets/:id/messages', captureRawAndJsonForBox, requireBoxSignature, async (req, res) => {
    try {
      const ops = getOps();
      if (!ops) return res.status(503).json({ error: 'SUPPORT_SERVICE_UNAVAILABLE' });

      const ticketId = String(req.params?.id || '').trim();
      if (!UUID_RE.test(ticketId)) return res.status(400).json({ error: 'INVALID_TICKET_ID' });

      const check = validateTicketInput(req.body, { requireSubject: false });
      if (!check.ok) return res.status(400).json({ error: check.error });

      const { boxName, customerId } = req.boxAuth;
      let lookupQuery = ops
        .from('ops_tickets')
        .select('id, customer_id, box_name, source, status, practice_name')
        .eq('id', ticketId)
        .eq('source', 'box');
      lookupQuery = customerId ? lookupQuery.eq('customer_id', customerId) : lookupQuery.eq('box_name', boxName);
      const { data: ticket, error: findErr } = await lookupQuery.maybeSingle();

      if (findErr) {
        console.error('[support/box] lookup ticket failed:', findErr?.code || findErr?.message);
        return res.status(500).json({ error: 'SUPPORT_TICKET_LOOKUP_FAILED' });
      }
      const ownsTicket = Boolean(
        ticket
        && ticket.source === 'box'
        && (customerId ? ticket.customer_id === customerId : ticket.box_name === boxName)
      );
      if (!ownsTicket) {
        return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      }

      const { data: message, error: mErr } = await ops
        .from('ops_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'praxis',
          sender_name: ticket.practice_name || boxName,
          body: check.body,
          is_internal_note: false,
        })
        .select('id, ticket_id, sender_type, sender_name, body, is_internal_note, created_at')
        .single();

      if (mErr) {
        console.error('[support/box] insert message failed:', mErr?.code || mErr?.message);
        return res.status(500).json({ error: 'SUPPORT_MESSAGE_CREATE_FAILED' });
      }

      let nextStatus = ticket.status;
      if (ticket.status === 'wartet' || ticket.status === 'geloest') {
        nextStatus = 'neu';
        await ops
          .from('ops_tickets')
          .update({ status: 'neu', resolved_at: null })
          .eq('id', ticket.id);
      }

      res.set('Cache-Control', 'no-store');
      return res.status(201).json({
        message: sanitizePublicMessage(message),
        status: nextStatus,
      });
    } catch (err) {
      console.error('[support/box] POST /box/tickets/:id/messages error:', err?.message || err);
      return res.status(500).json({ error: 'SUPPORT_MESSAGE_CREATE_FAILED' });
    }
  });

  // ── 3) Staff-Cockpit-Endpunkt ────────────────────────────────────────────
  const requireSupportStaff = requireCockpitRole(['founder', 'tech', 'support'], { getOpsSupabase: getOps });

  router.post('/cockpit/tickets/:id/reply', ensureJsonBody, requireSupportStaff, async (req, res) => {
    try {
      const ops = getOps();
      if (!ops) return res.status(503).json({ error: 'SUPPORT_SERVICE_UNAVAILABLE' });

      const ticketId = String(req.params?.id || '').trim();
      if (!UUID_RE.test(ticketId)) return res.status(400).json({ error: 'INVALID_TICKET_ID' });

      const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      if (typeof payload.body !== 'string') return res.status(400).json({ error: 'INVALID_BODY' });
      const body = payload.body.trim();
      if (body.length < 1 || body.length > 5000) return res.status(400).json({ error: 'INVALID_BODY' });

      const isInternalNote = payload.isInternalNote === true;
      const sendEmail = payload.sendEmail !== false;

      let newStatus = null;
      if (payload.newStatus !== undefined && payload.newStatus !== null && payload.newStatus !== '') {
        if (typeof payload.newStatus !== 'string' || !STATUS_SET.has(payload.newStatus)) {
          return res.status(400).json({ error: 'INVALID_STATUS' });
        }
        newStatus = payload.newStatus;
      }

      const { data: ticket, error: tErr } = await ops
        .from('ops_tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      if (tErr) {
        console.error('[support/cockpit] ticket lookup failed:', tErr?.code || tErr?.message);
        return res.status(500).json({ error: 'SUPPORT_TICKET_LOOKUP_FAILED' });
      }
      if (!ticket) {
        return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
      }

      const staffName = cleanText(req.cockpitUser?.display_name || req.cockpitUser?.email || 'Praxura-Team', 120);
      const { data: message, error: mErr } = await ops
        .from('ops_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'staff',
          sender_name: staffName,
          sender_member_id: req.cockpitUser?.id || null,
          body,
          is_internal_note: isInternalNote,
        })
        .select('*')
        .single();

      if (mErr || !message) {
        console.error('[support/cockpit] insert reply failed:', mErr?.code || mErr?.message);
        return res.status(500).json({ error: 'SUPPORT_REPLY_CREATE_FAILED' });
      }

      const nowIso = new Date().toISOString();
      /** @type {Record<string, any>} */
      const ticketPatch = {};
      if (!isInternalNote && !ticket.first_response_at) {
        ticketPatch.first_response_at = nowIso;
      }
      if (newStatus) {
        ticketPatch.status = newStatus;
        ticketPatch.resolved_at = newStatus === 'geloest' ? nowIso : null;
      }

      let updatedTicket = ticket;
      if (Object.keys(ticketPatch).length > 0) {
        const { data: upd, error: updErr } = await ops
          .from('ops_tickets')
          .update(ticketPatch)
          .eq('id', ticket.id)
          .select('*')
          .single();
        if (!updErr && upd) updatedTicket = upd;
      }

      let emailed = false;
      let emailError = null;
      let finalMessage = message;

      if (!isInternalNote && sendEmail && ticket.contact_email && EMAIL_RE.test(String(ticket.contact_email).trim())) {
        try {
          const from = cleanText(env?.SUPPORT_FROM_EMAIL, 160) || getMailFrom('Praxura Support');
          const replyTo = cleanText(env?.SUPPORT_REPLY_TO, 160) || SUPPORT_FALLBACK_EMAIL;
          const rendered = renderePraxuraMail({
            praxis: 'Praxura Support',
            titel: `Antwort zu Ticket #${ticket.ticket_no}: ${ticket.subject}`,
            anrede: ticket.practice_name ? `Hallo ${ticket.practice_name},` : 'Hallo,',
            absaetze: [body],
            boxZeilen: [
              { label: 'Ticket-Nr.', wert: `#${ticket.ticket_no}` },
              { label: 'Bearbeitet von', wert: staffName },
            ],
            hinweis: 'Sie können auf diese E-Mail direkt antworten oder im Bereich „Feedback & Support“ in Ihrer Praxura-Anwendung eine Rückmeldung senden.',
          });
          const mailOptions = baueMailOptionen({
            from,
            to: String(ticket.contact_email).trim(),
            replyTo,
            subject: `[Praxura Support #${ticket.ticket_no}] ${ticket.subject}`,
            html: rendered.html,
            text: rendered.text,
          });
          const sent = await dispatchMail({ mailSender, env, mailOptions });
          if (sent) {
            emailed = true;
            const emailedAt = new Date().toISOString();
            const { data: msgUpd } = await ops
              .from('ops_ticket_messages')
              .update({ emailed_at: emailedAt })
              .eq('id', message.id)
              .select('*')
              .single();
            finalMessage = msgUpd || { ...message, emailed_at: emailedAt };
          }
        } catch (err) {
          emailError = err?.code || 'EMAIL_SEND_FAILED';
          console.error('[support/cockpit] email send failed:', emailError);
        }
      }

      res.set('Cache-Control', 'no-store');
      return res.status(201).json({
        message: finalMessage,
        ticket: updatedTicket,
        emailed,
        ...(emailError ? { emailError } : {}),
      });
    } catch (err) {
      console.error('[support/cockpit] POST /cockpit/tickets/:id/reply error:', err?.message || err);
      return res.status(500).json({ error: 'SUPPORT_REPLY_FAILED' });
    }
  });

  return router;
}
