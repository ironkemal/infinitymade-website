/**
 * Praxura Cockpit -> Merkez Admin-Bridge Proxy (`/api/cockpit/merkez/*`)
 *
 * Läuft ausschließlich im SaaS-Backend (über `cockpit.js`, nur wenn `!istKutu()`).
 * Fail-Closed: Ohne gültige `MERKEZ_ADMIN_URL` + `MERKEZ_ADMIN_PRIVKEY` antwortet
 * jeder Endpunkt mit 503 `MERKEZ_BRIDGE_NOT_CONFIGURED`.
 *
 * Jede Anfrage wird mit Ed25519 (`praxura-v1`) signiert, trägt den authentifizierten
 * Cockpit-Akteur (`cockpit:<email>`) und wird ohne Redirects mit 10s Timeout gesendet.
 */

import crypto from 'node:crypto';
import express, { Router } from 'express';
import { signiereAnfrage, boxIdAusPublicKey } from '../merkez-istemci/signatur.js';

const RE_BOX_NAME = /^[a-z]{2,8}-[a-z]{2,8}-[1-9][0-9]?$/;
const PROXY_TIMEOUT_MS = 10_000;

/**
 * Validiert `MERKEZ_ADMIN_URL`: HTTPS in Produktion Pflicht; `http://localhost` /
 * `127.0.0.1` / `[::1]` ausschließlich außerhalb der Produktion erlaubt.
 *
 * @param {unknown} rawUrl
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
function parseMerkezAdminUrl(rawUrl, env) {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let u;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  if (u.username || u.password || u.search || u.hash) return null;

  const isProd = env?.NODE_ENV === 'production';
  const host = u.hostname.toLowerCase();
  const isHttps = u.protocol === 'https:';
  const isLocalHttp = !isProd && u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]');

  if (!isHttps && !isLocalHttp) return null;

  const cleanPath = u.pathname.replace(/\/+$/, '');
  return `${u.origin}${cleanPath}`;
}

/**
 * Liest `MERKEZ_ADMIN_PRIVKEY` als PKCS8-PEM oder base64url(PKCS8-DER) Ed25519-Schlüssel.
 *
 * @param {unknown} rawKey
 * @returns {{ boxId: string, privateKey: crypto.KeyObject } | null}
 */
function parseAdminPrivkey(rawKey) {
  if (typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();
  if (!trimmed) return null;

  let privateKey;
  try {
    if (trimmed.includes('BEGIN PRIVATE KEY')) {
      privateKey = crypto.createPrivateKey(trimmed.replace(/\\n/g, '\n'));
    } else if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      privateKey = crypto.createPrivateKey({
        key: Buffer.from(trimmed, 'base64url'),
        format: 'der',
        type: 'pkcs8',
      });
    } else {
      return null;
    }
    if (privateKey.asymmetricKeyType !== 'ed25519') return null;
    const publicKey = crypto.createPublicKey(privateKey);
    const boxId = boxIdAusPublicKey(publicKey);
    return { boxId, privateKey };
  } catch {
    return null;
  }
}

/**
 * Formatiert den authentifizierten Cockpit-Akteur für `X-Praxura-Akteur`.
 *
 * @param {any} cockpitUser
 * @returns {string}
 */
function formatAkteur(cockpitUser) {
  const raw = String(cockpitUser?.email || cockpitUser?.id || 'unknown').trim();
  const safe = raw.replace(/[^a-zA-Z0-9._:@-]/g, '_').slice(0, 72) || 'unknown';
  return `cockpit:${safe}`;
}

/**
 * Erstellt den Express-Router für `/api/cockpit/merkez`.
 *
 * @param {object} opts
 * @param {(roles: string[]) => import('express').RequestHandler} opts.requireCockpitRole
 * @param {Record<string, string | undefined>} [opts.env]
 * @param {typeof globalThis.fetch} [opts.fetchImpl]
 */
export function createCockpitMerkezRouter({
  requireCockpitRole,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof requireCockpitRole !== 'function') {
    throw new TypeError('requireCockpitRole ist Pflicht');
  }

  const router = Router();
  router.use(express.json({ limit: '16kb' }));

  const baseUrl = parseMerkezAdminUrl(env?.MERKEZ_ADMIN_URL, env);
  const kimlik = parseAdminPrivkey(env?.MERKEZ_ADMIN_PRIVKEY);
  const bridgeConfig = baseUrl && kimlik ? { baseUrl, kimlik } : null;

  const authTech = requireCockpitRole(['founder', 'tech']);
  const authFounder = requireCockpitRole(['founder']);

  /**
   * Signiert und leitet eine Anfrage an `${MERKEZ_ADMIN_URL}/internal/admin${upstreamPath}` weiter.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {{ method: 'GET' | 'POST', upstreamPath: string, body?: Record<string, any> }} opts
   */
  async function forwardToMerkez(req, res, { method, upstreamPath, body }) {
    res.set('Cache-Control', 'no-store');
    if (!bridgeConfig) {
      return res.status(503).json({ error: 'MERKEZ_BRIDGE_NOT_CONFIGURED' });
    }

    const akteur = formatAkteur(req.cockpitUser);
    const sep = upstreamPath.includes('?') ? '&' : '?';
    const url = `${bridgeConfig.baseUrl}/internal/admin${upstreamPath}${sep}akteur=${encodeURIComponent(akteur)}`;
    const rawBody = method === 'GET' ? undefined : JSON.stringify(body ?? {});

    const sig = signiereAnfrage({
      method,
      url,
      ...(rawBody !== undefined ? { body: rawBody } : {}),
      kimlik: bridgeConfig.kimlik,
    });

    const headers = {
      ...sig.headers,
      'X-Praxura-Akteur': akteur,
      Accept: 'application/json',
      ...(rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
    };

    try {
      const upstreamRes = await fetchImpl(url, {
        method,
        headers,
        ...(rawBody !== undefined ? { body: rawBody } : {}),
        redirect: 'error',
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });

      const data = await upstreamRes.json().catch(() => null);
      if (!data || typeof data !== 'object') {
        return res.status(502).json({ error: 'MERKEZ_UPSTREAM_INVALID' });
      }
      return res.status(upstreamRes.status).json(data);
    } catch (err) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      console.error('[cockpit/merkez] upstream error:', err?.message || err);
      return res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? 'MERKEZ_UPSTREAM_TIMEOUT' : 'MERKEZ_UPSTREAM_UNREACHABLE',
      });
    }
  }

  // ── GET /api/cockpit/merkez/status ─────────────────────────────────────────
  router.get('/status', authTech, (req, res) =>
    forwardToMerkez(req, res, { method: 'GET', upstreamPath: '/status' })
  );

  // ── POST /api/cockpit/merkez/codes/new ─────────────────────────────────────
  router.post('/codes/new', authTech, (req, res) =>
    forwardToMerkez(req, res, { method: 'POST', upstreamPath: '/codes/new', body: {} })
  );

  // ── POST /api/cockpit/merkez/codes/rebind ──────────────────────────────────
  router.post('/codes/rebind', authTech, (req, res) => {
    const name = req.body?.name;
    if (typeof name !== 'string' || !RE_BOX_NAME.test(name)) {
      return res.status(400).json({ error: 'INVALID_BOX_NAME' });
    }
    return forwardToMerkez(req, res, {
      method: 'POST',
      upstreamPath: '/codes/rebind',
      body: { name },
    });
  });

  // ── POST /api/cockpit/merkez/boxes/:name/ki ────────────────────────────────
  router.post('/boxes/:name/ki', authTech, (req, res) => {
    const name = req.params.name;
    if (typeof name !== 'string' || !RE_BOX_NAME.test(name)) {
      return res.status(400).json({ error: 'INVALID_BOX_NAME' });
    }
    const payload = {};
    if (req.body?.status !== undefined) payload.status = req.body.status;
    if (req.body?.limit !== undefined) payload.limit = req.body.limit;
    if (payload.status === undefined && payload.limit === undefined) {
      return res.status(400).json({ error: 'INVALID_KI_PAYLOAD' });
    }
    return forwardToMerkez(req, res, {
      method: 'POST',
      upstreamPath: `/boxes/${encodeURIComponent(name)}/ki`,
      body: payload,
    });
  });

  // ── POST /api/cockpit/merkez/ki-global (Founder ONLY) ──────────────────────
  router.post('/ki-global', authFounder, (req, res) => {
    const wert = req.body?.wert;
    const confirmPhrase = req.body?.confirmPhrase;
    if ((wert !== 'an' && wert !== 'aus') || typeof confirmPhrase !== 'string') {
      return res.status(400).json({ error: 'INVALID_KI_GLOBAL_PAYLOAD' });
    }
    return forwardToMerkez(req, res, {
      method: 'POST',
      upstreamPath: '/ki-global',
      body: { wert, confirmPhrase },
    });
  });

  // ── POST /api/cockpit/merkez/boxes/:name/iptal (Founder ONLY) ──────────────
  router.post('/boxes/:name/iptal', authFounder, (req, res) => {
    const name = req.params.name;
    if (typeof name !== 'string' || !RE_BOX_NAME.test(name)) {
      return res.status(400).json({ error: 'INVALID_BOX_NAME' });
    }
    const confirmPhrase = req.body?.confirmPhrase;
    if (typeof confirmPhrase !== 'string') {
      return res.status(400).json({ error: 'CONFIRM_PHRASE_REQUIRED' });
    }
    return forwardToMerkez(req, res, {
      method: 'POST',
      upstreamPath: `/boxes/${encodeURIComponent(name)}/iptal`,
      body: { confirmPhrase },
    });
  });

  return router;
}
