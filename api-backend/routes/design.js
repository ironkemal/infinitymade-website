// Redesign-Pilot — GET /api/design/entscheidung (Phase 2, Aktivierungsvertrag 10.11.2026).
//
//   Limiter → requireAuth → Entscheidung aus Env
//
// Antwort: { neu: boolean }, `Cache-Control: private, no-store`. Keine Liste, keine Tenant-ID,
// kein Grund — der Browser lernt nur ja/nein für den EIGENEN Mandanten (A19/A20).
// Das Design erteilt keine Rechte: Rollen-, Standort- und Finanzprüfungen bleiben unverändert.
//
// Env (alle optional, fehlend = Alt; Box setzt sie nicht, onprem O-245):
//   DESIGN_NEU_AUS=1            globaler Alt-Schalter, gewinnt vor allem anderen
//   DESIGN_NEU_PILOT_TENANTS    Tenant-UUIDs (= Inhaber-IDs), kommagetrennt
//   DESIGN_NEU_PILOT_ROLLEN     „owner" (Standard) oder „owner,employee"
// Echte UUIDs gehören nie ins Repo (public) — nur in die Server-Umgebung.

import { createHash } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../ai/auth.js';

const liste = (wert) => String(wert || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/** Rein, testbar: Entscheidung aus verifiziertem Kontext + Umgebung. Fehler → false. */
export function designNeuErlaubt(auth, env = process.env) {
  try {
    // Fail-closed: jeder nicht-leere Wert außer ausdrücklich „aus" (0/false/no/off) schaltet ab.
    const aus = String(env.DESIGN_NEU_AUS || '').trim().toLowerCase();
    if (aus && !['0', 'false', 'no', 'off'].includes(aus)) return false;
    if (!auth?.tenantId || !['owner', 'employee'].includes(auth.role)) return false;
    if (!liste(env.DESIGN_NEU_PILOT_TENANTS).includes(String(auth.tenantId).toLowerCase())) return false;
    const rollen = liste(env.DESIGN_NEU_PILOT_ROLLEN || 'owner');
    return rollen.includes(auth.role);
  } catch { return false; }
}

/** @param {object} [o] @param {function} [o.auth] Ersatz für requireAuth (Tests) @param {object} [o.env] */
export function createDesignRouter({ auth = requireAuth, env = process.env } = {}) {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Je Sitzung statt je IP: Mitarbeitende hinter einer Praxis-NAT teilen sich sonst das Limit und fielen bei 429 still auf Alt.
    keyGenerator: (req) => 'd:' + createHash('sha256').update(String(req.headers.authorization || '')).digest('hex').slice(0, 32),
    validate: { keyGeneratorIpFallback: false },
    message: { error: 'Zu viele Anfragen. Bitte warten Sie eine Minute.' },
  });
  const router = Router();
  router.get('/design/entscheidung', limiter, auth, (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json({ neu: designNeuErlaubt(req.auth, env) });
  });
  return router;
}
