// DSGVO Routen:
//   GET  /api/dsgvo/export   — DSGVO Art. 15 Datenauskunft
//   POST /api/dsgvo/loeschen — DSGVO Art. 17 Recht auf Loeschung (SaaS Fall B)

import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../ai/auth.js';
import { logAccess } from '../_lib/access-log.js';
import { exportErstellen } from '../dsgvo/export.js';
import { kontoLoeschen, antworttextFallB } from '../dsgvo/loeschen.js';
import { istKutu as defaultIstKutu } from '../lib/dagitim.js';

/**
 * Erstellt den DSGVO-Router mit injizierbaren Abhaengigkeiten (fuer Tests).
 */
export function createDsgvoRouter(options = {}) {
  const router = express.Router();

  // Lazy: der Default-Router entsteht beim Import, vor dotenv.config() in server.js.
  let supabase = options.supabase || null;
  const db = () => supabase || (supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  }));

  const checkIstKutu = typeof options.istKutu === 'function' ? options.istKutu : defaultIstKutu;
  const authMiddleware = options.requireAuth || requireAuth;
  const noopMiddleware = (req, res, next) => next();

  // Rate Limiter: 3 Exporte pro Stunde je Nutzer
  const exportLimiter = options.skipRateLimit ? noopMiddleware : rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.userId || req.ip,
    message: { error: 'Zu viele Export-Anfragen. Bitte warten Sie eine Stunde.' },
  });

  // Rate Limiter: 3 Loeschversuche pro Tag je Nutzer
  const loeschenLimiter = options.skipRateLimit ? noopMiddleware : rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.userId || req.ip,
    message: { error: 'Zu viele Löschanträge. Bitte warten Sie 24 Stunden.' },
  });

  // ── GET /dsgvo/export ───────────────────────────────────────────────────────
  router.get('/dsgvo/export', authMiddleware, exportLimiter, async (req, res) => {
    const { userId, tenantId, role } = req.auth;
    const client = db();

    try {
      let authUser = null;
      if (client?.auth?.admin?.getUserById) {
        try {
          const { data: aData } = await client.auth.admin.getUserById(userId);
          authUser = aData?.user || null;
        } catch (e) {
          // Auth-Metadaten optional
        }
      }

      const payload = await exportErstellen(client, {
        userId,
        tenantId,
        role,
        authUser,
        istKutu: checkIstKutu(),
      });

      // Await damit der Nachweis fuer den spaeteren Pflicht-Export-Check sicher steht
      await logAccess(client, {
        userId,
        ownerId: tenantId,
        method: 'GET',
        path: req.path,
        resource: 'profile',
        resourceId: userId,
        action: 'dsgvo_export',
        ip: req.ip,
        statusCode: 200,
      });

      res.setHeader('Content-Disposition', `attachment; filename="dsgvo-export-${userId}.json"`);
      return res.status(200).json(payload);
    } catch (err) {
      console.error('[dsgvo-route] Export Fehler:', err);
      return res.status(500).json({ error: 'Export konnte nicht erstellt werden' });
    }
  });

  // ── POST /dsgvo/loeschen ────────────────────────────────────────────────────
  router.post('/dsgvo/loeschen', authMiddleware, loeschenLimiter, async (req, res) => {
    // 1. Box-Check: in der Box ist die Praxis Verantwortliche; kein SaaS-Vertragsende
    if (checkIstKutu()) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { userId, role } = req.auth;
    const client = db();

    // 2. Rollenpruefung: Nur der Inhaber darf das Gesamtkonto loeschen
    if (role !== 'owner') {
      return res.status(403).json({
        error: 'Nur der Praxisinhaber kann das Konto löschen. Mitarbeiter werden unter Team entfernt.',
      });
    }

    // 3. Bestaetigungstext pruefen
    const { confirm } = req.body || {};
    if (confirm !== 'LÖSCHEN') {
      return res.status(400).json({
        error: 'Bestätigung fehlt',
        message: 'Bitte senden Sie { "confirm": "LÖSCHEN" } um die Löschung zu bestätigen.',
      });
    }

    // 4. Doppelantrag-Sperre
    try {
      const { data: rlRows } = await client
        .from('data_access_log')
        .select('id')
        .eq('owner_id', userId)
        .eq('action', 'dsgvo_deletion')
        .limit(1);

      if (rlRows && rlRows.length > 0) {
        return res.status(429).json({ error: 'Ihr Konto befindet sich bereits im Löschprozess.' });
      }
    } catch (e) {
      console.error('[dsgvo-route] Doppelantrag-Pruefung Fehler:', e.message);
    }

    // 5. Pflicht-Export: Wurde in den letzten 24 Stunden ein Export durchgefuehrt?
    try {
      const vor24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: expRows, error: expErr } = await client
        .from('data_access_log')
        .select('id')
        .eq('user_id', userId)
        .eq('action', 'dsgvo_export')
        .gte('occurred_at', vor24h)
        .limit(1);

      if (expErr || !expRows || expRows.length === 0) {
        return res.status(409).json({
          error: 'Bitte laden Sie vor der Löschung Ihren Datenexport herunter.',
          code: 'EXPORT_FEHLT',
        });
      }
    } catch (e) {
      console.error('[dsgvo-route] Pflicht-Export-Pruefung Fehler:', e.message);
      return res.status(409).json({
        error: 'Bitte laden Sie vor der Löschung Ihren Datenexport herunter.',
        code: 'EXPORT_FEHLT',
      });
    }

    const vorgangId = crypto.randomUUID();
    const stripeKey = options.stripeKey !== undefined ? options.stripeKey : process.env.STRIPE_SECRET_KEY;

    try {
      // E-Mail fuer pending_signups ermitteln
      let ownerEmail = null;
      if (client?.auth?.admin?.getUserById) {
        try {
          const { data: aData } = await client.auth.admin.getUserById(userId);
          ownerEmail = aData?.user?.email || null;
        } catch (e) {
          // ignore
        }
      }

      // Doppelantrag-Sperre VOR der Kette setzen (guvenlik/Kaltprüfung: sonst laufen zwei
      // parallele Anträge beide durch). Das Ergebnis folgt als eigener Eintrag.
      await logAccess(client, {
        userId, ownerId: userId, method: 'POST', path: req.path, resource: 'profile',
        resourceId: userId, action: 'dsgvo_deletion', ip: req.ip,
        metadata: { vorgang_id: vorgangId, status: 'gestartet' },
      });

      const result = await kontoLoeschen(client, {
        ownerId: userId,
        ownerEmail,
        vorgangId,
        stripeKey,
      });

      // Audit-Log mit minimalen Metadaten schreiben (keine PHI, keine Fehlertexte)
      await logAccess(client, {
        userId,
        ownerId: userId,
        method: 'POST',
        path: req.path,
        resource: 'profile',
        resourceId: userId,
        action: 'dsgvo_deletion_ergebnis',
        statusCode: result.status === 'fehler' ? (result.stripe_fehler ? 502 : 500) : 200,
        ip: req.ip,
        metadata: {
          vorgang_id: vorgangId,
          status: result.status,
          kategorien: (result.gesperrt || []).map(g => g.kategorie),
          unerwartet_anzahl: (result.unerwartet || []).length,
        },
      });

      if (result.stripe_fehler) {
        return res.status(502).json({
          success: false,
          vorgang_id: vorgangId,
          message: 'Abo konnte nicht gekündigt werden — es wurde nichts gelöscht. Bitte support@praxura.de.',
        });
      }

      if (result.status === 'fehler') {
        return res.status(500).json({
          success: false,
          vorgang_id: vorgangId,
          message: 'Die Löschung ist nur teilweise durchgelaufen. Ihr Antrag ist protokolliert und ' +
            'wird manuell zu Ende geführt; bitte wenden Sie sich an support@praxura.de.',
        });
      }

      return res.status(200).json({
        success: true,
        status: result.status,
        vorgang_id: vorgangId,
        gesperrt: result.gesperrt,
        message: antworttextFallB(result.gesperrt),
      });
    } catch (err) {
      console.error('[dsgvo-route] Unerwarteter Loeschfehler:', err);
      return res.status(500).json({
        success: false,
        vorgang_id: vorgangId,
        message: 'Die Löschung ist nur teilweise durchgelaufen. Ihr Antrag ist protokolliert und ' +
          'wird manuell zu Ende geführt; bitte wenden Sie sich an support@praxura.de.',
      });
    }
  });

  return router;
}

export default createDsgvoRouter();
