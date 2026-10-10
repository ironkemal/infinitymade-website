// O-40 / Faz 2.4b — GET /api/status: tiefer Box-Status (RELEASE-STANDARD §6.5).
//
//   nurKutu → Limiter → requireAuth → requireOwner → 30-s-Zwischenspeicher
//
// Warum nur Box (guvenlik S-60, wie S-54): derselbe Code läuft auf dem SaaS-VPS,
// dort ist „angemeldet" = jeder im Internet; die Antwort zeigte Disk/Schema des
// gemeinsamen Servers. Warum nur Inhaber: Version, Schema und Disk sind
// Verwaltungsangaben, und jeder Aufruf geht an DB, Kong, GoTrue und Storage.
// Warum unter /api: Caddy reicht in der Box nur /api/* und genau /health durch.
//
// In server.js VOR der Wartungsmodus-Middleware eingehängt (sonst schluckt der
// 503 genau den Fall, den `schema` melden soll) und vor accessLogger (sonst
// füllt der Minutentakt des Panels das Zugriffsprotokoll).
//
// Grenze: requireAuth braucht selbst Kong/PostgREST. Ist der REST-Weg ganz tot,
// kommt auch der Inhaber nicht herein — dann bleiben /health/ready (Docker-Netz)
// und das Diagnose-Paket. Gewollt: §6.5 verlangt die Inhaber-Sitzung.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireOwner } from '../ai/auth.js';
import { nurKutu } from '../lib/dagitim.js';
import { statusSammeln } from '../lib/status.js';

const CACHE_MS = 30_000;

/**
 * @param {object}   o
 * @param {function} o.pruefungen  () => Prüfungen für statusSammeln (frisch je Lauf: liest wartung/zaehler)
 * @param {function} [o.auth]      Ersatz für requireAuth (Tests)
 */
export function createStatusRouter({ pruefungen, auth = requireAuth, cacheMs = CACHE_MS }) {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Zu viele Anfragen. Bitte warten Sie eine Minute.' },
  });

  // Ein laufender Durchgang wird geteilt: zwei Tabs gleichzeitig = eine Messung.
  let cache = null; // { bis, promise }

  const router = Router();
  router.get('/status', nurKutu, limiter, auth, requireOwner, async (req, res) => {
    try {
      const jetzt = Date.now();
      if (!cache || cache.bis < jetzt) {
        const promise = Promise.resolve().then(() => statusSammeln(pruefungen()));
        cache = { bis: jetzt + cacheMs, promise };
        promise.catch(() => { if (cache?.promise === promise) cache = null; });
      }
      const erg = await cache.promise;
      res.set('Cache-Control', 'no-store');
      res.json(erg);
    } catch (err) {
      console.error('[status] Sammeln fehlgeschlagen:', err?.message || err);
      res.status(500).json({ error: 'Status konnte nicht ermittelt werden.' });
    }
  });
  return router;
}
