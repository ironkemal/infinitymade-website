// Praxura Merkez — Interne Admin-Bridge für das Cockpit (Faz 3A).
//
// Fail-closed: Ohne gültigen MERKEZ_ADMIN_PUBKEY liefert erstelleAdminBridge() null
// und /internal/admin wird gar nicht erst gemountet.
// Authentifizierung: Ed25519-Protokoll "praxura-v1" (signatur.js) + SQLite-Nonce-Schutz
// + X-Praxura-Akteur + optionaler IP-Allowlist + Rate-Limit (30/min -> 503).
// Klartext-Einrichtungs-/Rebind-Codes werden NIEMALS gespeichert oder geloggt.

import net from 'node:net';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  leseSignaturKopf,
  pruefeSignatur,
  publicKeyLesen,
  boxIdAusPublicKey,
  NONCE_GUELTIG_SEKUNDEN,
} from '../api-backend/merkez-istemci/signatur.js';
import {
  generateSetupCode,
  formatSetupCode,
  hashCode,
  FORMAT_KUTU,
} from '../api-backend/routes/mitarbeiter-zugang-code.js';
import { NAME_FORMAT } from './namen.js';
import { entferneV4Praefix, ratenSchluessel } from './ip.js';
import { monatsSchluessel } from './ki-jeton.js';
import { berechneKiKostenEur, kiModellPreis } from '../api-backend/ai/ki-preise.js';

const TAG_SEK = 86400;
const RE_AKTEUR = /^[a-zA-Z0-9._:@-]{2,80}$/;

/**
 * @param {unknown} raw
 */
function parseAdminPubkey(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes('BEGIN PUBLIC KEY') ? trimmed.replace(/\\n/g, '\n') : trimmed;
  try {
    return publicKeyLesen(normalized);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} raw
 * @returns {{ ips: Set<string> | null, invalid: boolean }}
 */
function parseAllowedIps(raw) {
  if (raw === undefined || raw === null) return { ips: null, invalid: false };
  if (typeof raw !== 'string') return { ips: null, invalid: true };
  if (raw.trim() === '') return { ips: null, invalid: false };

  const entries = raw.split(',').map((entry) => entferneV4Praefix(entry.trim()));
  const ips = [];
  for (const entry of entries) {
    if (!entry) continue;
    if (net.isIP(entry) === 0) return { ips: null, invalid: true };
    ips.push(entry);
  }
  if (ips.length === 0) return { ips: null, invalid: true };
  return { ips: new Set(ips), invalid: false };
}

/**
 * @param {unknown} raw
 * @returns {number}
 */
function parseStandardLimit(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isSafeInteger(n) && n >= 1 && n <= 1_000_000) return n;
  }
  return 600;
}

/**
 * @param {unknown} val
 * @returns {number}
 */
function safeInt(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * @param {number} val
 * @returns {number}
 */
function roundEur(val) {
  return Math.round((Number(val) || 0) * 1_000_000) / 1_000_000;
}

/**
 * Aggregiert einen einzelnen gespeicherten KI-Bericht inkl. geschätzter EUR-Kosten.
 * @param {{ report_id: string, window_start: string, empfangen: number, daten: string }} row
 * @param {{ textModel: string, transcribeModel: string }} models
 */
function summarizeReportRow(row, { textModel, transcribeModel }) {
  let parsed = null;
  try {
    parsed = typeof row.daten === 'string' ? JSON.parse(row.daten) : row.daten;
  } catch {
    parsed = null;
  }
  const totals = parsed?.taskTotals && typeof parsed.taskTotals === 'object' ? parsed.taskTotals : {};

  let calls = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let reasoningTokens = 0;
  let totalTokens = 0;
  let audioSeconds = 0;
  let costEur = 0;

  for (const [task, m] of Object.entries(totals)) {
    if (!m || typeof m !== 'object') continue;
    const c = safeInt(m.calls);
    const pt = safeInt(m.prompt_tokens);
    const ct = safeInt(m.completion_tokens);
    const rt = safeInt(m.reasoning_tokens);
    const tt = safeInt(m.total_tokens) || (pt + ct);
    const as = safeInt(m.audio_seconds);

    calls += c;
    promptTokens += pt;
    completionTokens += ct;
    reasoningTokens += rt;
    totalTokens += tt;
    audioSeconds += as;

    const isAudioTask = task === 'transkribieren' || (as > 0 && pt === 0 && ct === 0);
    const model = isAudioTask ? transcribeModel : textModel;
    const calc = berechneKiKostenEur({
      model,
      promptTokens: pt,
      completionTokens: ct,
      reasoningTokens: rt,
      audioSeconds: as,
    });
    costEur += Number(calc.costEur) || 0;
  }

  return {
    report_id: row.report_id,
    window_start: row.window_start,
    empfangen: row.empfangen,
    calls,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    reasoning_tokens: reasoningTokens,
    total_tokens: totalTokens,
    audio_seconds: audioSeconds,
    cost_eur: roundEur(costEur),
  };
}

/**
 * Erstellt den Express-Router für `/internal/admin` oder `null` (fail-closed).
 *
 * @param {object} opts
 * @param {ReturnType<import('./db.js').oeffneDb>} opts.db
 * @param {{ loesche: (typ: string, fqdn: string) => Promise<void> } | null} [opts.cf]
 * @param {Record<string, string | undefined>} [opts.env]
 * @param {() => number} [opts.jetztFn]
 * @param {string | null} [opts.boxDomain]
 * @param {string | null} [opts.hostErwartet]
 * @param {number | null} [opts.kiStandardLimit]
 * @param {number} [opts.rateLimitMax]
 * @param {{ error: (...args: any[]) => void }} [opts.log]
 * @returns {import('express').Router | null}
 */
export function erstelleAdminBridge({
  db,
  cf = null,
  env = process.env,
  jetztFn = Date.now,
  boxDomain = null,
  hostErwartet = null,
  kiStandardLimit = null,
  rateLimitMax = 30,
  log = console,
} = {}) {
  const adminPubKey = parseAdminPubkey(env?.MERKEZ_ADMIN_PUBKEY);
  if (!adminPubKey) return null;

  const adminKeyFingerprint = boxIdAusPublicKey(adminPubKey);
  const allowedIpsParsed = parseAllowedIps(env?.MERKEZ_ADMIN_ALLOWED_IPS);
  if (allowedIpsParsed.invalid) {
    log?.error?.('[merkez:admin-bridge] MERKEZ_ADMIN_ALLOWED_IPS ungültig — Admin-Bridge fail-closed deaktiviert');
    return null;
  }
  const allowedIps = allowedIpsParsed.ips;
  const effectiveHost = (hostErwartet || env?.MERKEZ_HOST || '').trim() || undefined;
  const domain = boxDomain || env?.BOX_DOMAIN || '';
  const standardLimit =
    Number.isSafeInteger(kiStandardLimit) && kiStandardLimit >= 1 && kiStandardLimit <= 1_000_000
      ? kiStandardLimit
      : parseStandardLimit(env?.KI_MONATS_LIMIT);

  const textModel = kiModellPreis(env?.KI_DEPLOYMENT) ? String(env.KI_DEPLOYMENT) : 'gpt-5-mini';
  const transcribeModel = kiModellPreis(env?.KI_DEPLOYMENT_TRANSCRIBE) ? String(env.KI_DEPLOYMENT_TRANSCRIBE) : 'gpt-4o-transcribe';

  const sek = () => Math.floor(jetztFn() / 1000);
  const rohBody = (req) => (Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
  const jsonBody = (req) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return {};
    try {
      const o = JSON.parse(req.body.toString('utf8'));
      return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
    } catch {
      return null;
    }
  };

  const router = express.Router();

  // 1. Optionaler IP-Allowlist (Defense-in-Depth)
  if (allowedIps) {
    router.use((req, res, next) => {
      const ip = entferneV4Praefix(req.ip);
      if (!allowedIps.has(ip)) {
        return res.status(403).json({ fehler: 'ip_nicht_erlaubt' });
      }
      return next();
    });
  }

  // 2. Rate-Limiter: 30 req / 1 min pro IP -> 503
  const adminLimit = rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ratenSchluessel(req.ip),
    windowMs: 60_000,
    limit: rateLimitMax,
    statusCode: 503,
    message: { fehler: 'zu_viele_anfragen' },
  });
  router.use(adminLimit);

  // 3. Roher Body für Ed25519-Signaturprüfung (vor jedem JSON-Parse)
  router.use(express.raw({ type: () => true, limit: '16kb' }));

  // 4. Ed25519-Signaturprüfung ("praxura-v1") + SQLite-Replay-Schutz + signierter Akteur
  router.use((req, res, next) => {
    const kopf = leseSignaturKopf(req.headers);
    if (!kopf || kopf.boxId !== adminKeyFingerprint) {
      return res.status(401).json({ fehler: 'signatur', serverzeit: sek() });
    }

    // Akteur VOR pruefeSignatur prüfen, damit ungültiger/abweichender Akteur niemals eine Nonce verbrennt.
    const queryAkteur = req.query?.akteur;
    if (typeof queryAkteur !== 'string' || !RE_AKTEUR.test(queryAkteur)) {
      return res.status(400).json({ fehler: 'ungueltiger_akteur' });
    }
    const headerAkteur = req.headers['x-praxura-akteur'];
    if (headerAkteur !== undefined && headerAkteur !== queryAkteur) {
      return res.status(400).json({ fehler: 'ungueltiger_akteur' });
    }

    const ergebnis = pruefeSignatur({
      method: req.method,
      host: req.headers.host || '',
      pfad: req.originalUrl,
      body: rohBody(req),
      kopf,
      publicKey: adminPubKey,
      jetzt: jetztFn(),
      nonceNeu: (b, n) => db.nonceMerken(b, n, sek(), NONCE_GUELTIG_SEKUNDEN),
      erwarteterHost: effectiveHost,
    });
    if (!ergebnis.ok) {
      return res.status(401).json({ fehler: 'signatur', serverzeit: sek() });
    }

    req.adminAkteur = queryAkteur;
    return next();
  });

  // ── GET /status ────────────────────────────────────────────────────────────
  router.get('/status', (req, res) => {
    try {
      const nowMs = jetztFn();
      const t = Math.floor(nowMs / 1000);
      const monat = monatsSchluessel(nowMs);
      const kiGlobal = db.einstellungLesen('ki_global') ?? 'aus';
      const seitSek = t - 7 * TAG_SEK;
      const seitIso = new Date(seitSek * 1000).toISOString().slice(0, 10) + 'T00:00:00.000Z';

      const boxes = db.boxenListe().map((b) => {
        const berichteRaw = db.kiBerichteSeit(b.box_id, seitSek, seitIso);
        const berichte = berichteRaw.map((row) => summarizeReportRow(row, { textModel, transcribeModel }));

        let calls = 0;
        let promptTokens = 0;
        let completionTokens = 0;
        let reasoningTokens = 0;
        let totalTokens = 0;
        let audioSeconds = 0;
        let costEur = 0;

        for (const r of berichte) {
          calls += r.calls;
          promptTokens += r.prompt_tokens;
          completionTokens += r.completion_tokens;
          reasoningTokens += r.reasoning_tokens;
          totalTokens += r.total_tokens;
          audioSeconds += r.audio_seconds;
          costEur += r.cost_eur;
        }

        return {
          box_id: b.box_id,
          name: b.name,
          status: b.status,
          erstellt: b.erstellt,
          iptal_am: b.iptal_am ?? null,
          lan_ip: b.lan_ip ?? null,
          ip_am: b.ip_am ?? null,
          ki_status: b.ki_status ?? 'aus',
          ki_limit: b.ki_limit ?? null,
          ki_ausgaben_monat: db.kiZaehlen(b.box_id, monat),
          letzte_berichte: {
            days: 7,
            report_count: berichte.length,
            calls,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            reasoning_tokens: reasoningTokens,
            total_tokens: totalTokens,
            audio_seconds: audioSeconds,
            cost_eur: roundEur(costEur),
            berichte,
          },
        };
      });

      const adminlogRecent = db.adminLogNeueste(30);

      res.set('Cache-Control', 'no-store');
      return res.json({
        kiGlobal,
        monatsLimitStandard: standardLimit,
        monat,
        boxes,
        adminlogRecent,
      });
    } catch (err) {
      log.error('[merkez:admin-bridge] status fehler:', err?.message);
      return res.status(500).json({ fehler: 'intern' });
    }
  });

  // ── POST /codes/new ────────────────────────────────────────────────────────
  router.post('/codes/new', (req, res) => {
    try {
      const t = sek();
      const rawCode = generateSetupCode(10, FORMAT_KUTU);
      const code = formatSetupCode(rawCode, FORMAT_KUTU);
      const gueltigBis = t + 14 * TAG_SEK;

      db.tx(() => {
        db.codeAnlegen({
          codeHash: hashCode(rawCode, FORMAT_KUTU),
          art: 'kurulum',
          gueltigBis,
          jetzt: t,
        });
        db.adminLog(req.adminAkteur, 'kod-neu', null, { gueltig_tage: 14, quelle: 'admin-bridge' }, t);
      });

      res.set('Cache-Control', 'no-store');
      return res.status(201).json({ code, gueltigBis });
    } catch (err) {
      log.error('[merkez:admin-bridge] codes/new fehler:', err?.message);
      return res.status(500).json({ fehler: 'intern' });
    }
  });

  // ── POST /codes/rebind ─────────────────────────────────────────────────────
  router.post('/codes/rebind', (req, res) => {
    try {
      const body = jsonBody(req);
      const name = body?.name;
      if (typeof name !== 'string' || !NAME_FORMAT.test(name)) {
        return res.status(400).json({ fehler: 'name' });
      }
      const box = db.boxNachName(name);
      if (!box) {
        return res.status(404).json({ fehler: 'box_nicht_gefunden' });
      }
      if (box.status !== 'aktiv') {
        return res.status(409).json({ fehler: 'box_nicht_aktiv' });
      }

      const t = sek();
      const rawCode = generateSetupCode(10, FORMAT_KUTU);
      const code = formatSetupCode(rawCode, FORMAT_KUTU);
      const gueltigBis = t + 3 * TAG_SEK;

      db.tx(() => {
        db.codeAnlegen({
          codeHash: hashCode(rawCode, FORMAT_KUTU),
          art: 'rebind',
          boxName: name,
          gueltigBis,
          jetzt: t,
        });
        db.adminLog(req.adminAkteur, 'kod-rebind', name, { gueltig_stunden: 72, quelle: 'admin-bridge' }, t);
      });

      res.set('Cache-Control', 'no-store');
      return res.status(201).json({ name, code, gueltigBis });
    } catch (err) {
      log.error('[merkez:admin-bridge] codes/rebind fehler:', err?.message);
      return res.status(500).json({ fehler: 'intern' });
    }
  });

  // ── POST /boxes/:name/ki ───────────────────────────────────────────────────
  router.post('/boxes/:name/ki', (req, res) => {
    try {
      const name = req.params.name;
      if (typeof name !== 'string' || !NAME_FORMAT.test(name)) {
        return res.status(400).json({ fehler: 'name' });
      }
      const box = db.boxNachName(name);
      if (!box) {
        return res.status(404).json({ fehler: 'box_nicht_gefunden' });
      }

      const body = jsonBody(req);
      if (!body || (body.status === undefined && body.limit === undefined)) {
        return res.status(400).json({ fehler: 'body' });
      }

      let nextStatus;
      if (body.status !== undefined) {
        if (body.status !== 'aktiv' && body.status !== 'aus') {
          return res.status(400).json({ fehler: 'status_ungueltig' });
        }
        nextStatus = body.status;
      }

      let nextLimit;
      let hasLimit = false;
      if (body.limit !== undefined) {
        hasLimit = true;
        if (body.limit === null || body.limit === 'standard') {
          nextLimit = null;
        } else if (typeof body.limit === 'number' && Number.isSafeInteger(body.limit) && body.limit >= 1 && body.limit <= 1_000_000) {
          nextLimit = body.limit;
        } else {
          return res.status(400).json({ fehler: 'limit_ungueltig' });
        }
      }

      const t = sek();
      db.tx(() => {
        if (nextStatus !== undefined) {
          db.boxKiSetzen(name, nextStatus);
          db.adminLog(req.adminAkteur, nextStatus === 'aktiv' ? 'ki-an' : 'ki-aus', name, { quelle: 'admin-bridge' }, t);
        }
        if (hasLimit) {
          db.boxKiLimitSetzen(name, nextLimit);
          db.adminLog(req.adminAkteur, 'ki-limit', name, { limit: nextLimit, quelle: 'admin-bridge' }, t);
        }
      });

      const updated = db.boxNachName(name);
      res.set('Cache-Control', 'no-store');
      return res.json({
        ok: true,
        box: {
          box_id: updated.box_id,
          name: updated.name,
          status: updated.status,
          erstellt: updated.erstellt,
          iptal_am: updated.iptal_am ?? null,
          lan_ip: updated.lan_ip ?? null,
          ip_am: updated.ip_am ?? null,
          ki_status: updated.ki_status ?? 'aus',
          ki_limit: updated.ki_limit ?? null,
        },
      });
    } catch (err) {
      log.error('[merkez:admin-bridge] boxes/ki fehler:', err?.message);
      return res.status(500).json({ fehler: 'intern' });
    }
  });

  // ── POST /ki-global ────────────────────────────────────────────────────────
  router.post('/ki-global', (req, res) => {
    try {
      const body = jsonBody(req);
      const wert = body?.wert;
      if (wert !== 'an' && wert !== 'aus') {
        return res.status(400).json({ fehler: 'wert_ungueltig' });
      }
      const erwartet = wert === 'an' ? 'KI-GLOBAL-AN' : 'KI-GLOBAL-AUS';
      if (body?.confirmPhrase !== erwartet) {
        return res.status(400).json({ fehler: 'bestaetigung_fehlt' });
      }

      const t = sek();
      db.tx(() => {
        db.einstellungSetzen('ki_global', wert);
        db.adminLog(req.adminAkteur, 'ki-global', null, { wert, quelle: 'admin-bridge' }, t);
      });

      res.set('Cache-Control', 'no-store');
      return res.json({ ok: true, kiGlobal: wert });
    } catch (err) {
      log.error('[merkez:admin-bridge] ki-global fehler:', err?.message);
      return res.status(500).json({ fehler: 'intern' });
    }
  });

  // ── POST /boxes/:name/iptal ────────────────────────────────────────────────
  router.post('/boxes/:name/iptal', async (req, res) => {
    try {
      const name = req.params.name;
      if (typeof name !== 'string' || !NAME_FORMAT.test(name)) {
        return res.status(400).json({ fehler: 'name' });
      }
      const box = db.boxNachName(name);
      if (!box) {
        return res.status(404).json({ fehler: 'box_nicht_gefunden' });
      }
      const body = jsonBody(req);
      if (!body || body.confirmPhrase !== `IPTAL-${name}`) {
        return res.status(400).json({ fehler: 'bestaetigung_fehlt' });
      }

      const t = sek();
      db.tx(() => {
        const neu = db.boxIptal(name, t);
        db.adminLog(req.adminAkteur, neu ? 'iptal' : 'iptal-wiederholt', name, { box_id: box.box_id, quelle: 'admin-bridge' }, t);
      });

      if (cf) {
        if (!domain) {
          return res.status(502).json({ fehler: 'dienst' });
        }
        try {
          await cf.loesche('CNAME', `_acme-challenge.${name}.${domain}`);
        } catch (cfErr) {
          log.error('[merkez:admin-bridge] iptal cloudflare fehler:', cfErr?.message);
          return res.status(502).json({ fehler: 'dienst' });
        }
      }

      res.set('Cache-Control', 'no-store');
      return res.json({ ok: true, name, status: 'iptal' });
    } catch (err) {
      log.error('[merkez:admin-bridge] boxes/iptal fehler:', err?.message);
      return res.status(500).json({ fehler: 'intern' });
    }
  });

  return router;
}
