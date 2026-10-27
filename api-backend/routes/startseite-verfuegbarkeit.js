import { Router } from 'express';
import { requireAuth } from '../ai/auth.js';

const uuid = x => typeof x === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x);

/** Auth is the ONLY scope source. Factory is request-local; no shared observations. */
export function createVerfuegbarkeitRouter({ auth = requireAuth, createLader } = {}) {
  const router = Router();
  for (const modus of ['tag', 'woche']) {
    router.get(`/startseite/${modus}`, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, auth, async (req, res) => {
      const a = req.auth;
      if (!a || !uuid(a.tenantId) || !uuid(a.userId) || !['owner', 'employee'].includes(a.role)
        || (a.role === 'owner') !== (a.userId.toLowerCase() === a.tenantId.toLowerCase())) {
        return res.status(403).json({ code: 'ZUGRIFF_VERWEIGERT' });
      }
      if (modus === 'woche' && a.role !== 'owner') return res.status(403).json({ code: 'NUR_INHABER' });
      if (new URLSearchParams(req.url.split('?')[1] || '').size || (req.body && Object.keys(req.body).length)) {
        return res.status(400).json({ code: 'UNGUELTIGE_PARAMETER' });
      }
      try {
        const lader = createLader();
        const daten = await lader[modus]({ tenantId: a.tenantId, userId: a.userId, role: a.role });
        return res.json(daten);
      } catch {
        return res.status(503).json({ status: 'unbekannt', grund: 'QUELLE_NICHT_VERFUEGBAR',
          ...(modus === 'tag' ? { luecken: null, minimumMin: null } : { gebuchtMin: null, arbeitsMin: null, quote: null }) });
      }
    });
  }
  return router;
}
