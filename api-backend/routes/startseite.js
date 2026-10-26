// B04: Routing-/Rollengrenze für die Startseite, noch ohne Finanzadapter.
import { Router } from 'express';
import { requireAuth } from '../ai/auth.js';

const BLOECKE = ['geld', 'mahnungen', 'abrechnung'];
const BLOCK_FEHLER = 'BLOCK_NICHT_VERFUEGBAR';

/**
 * Integrator mountet unter /api: GET /api/startseite/zusammenfassung.
 * Query: kein Parameter oder einmal bloecke=geld,mahnungen,abrechnung (Teilmenge,
 * keine Duplikate). Keine Tenant-/Standort-Overrides; Scope ist der ganze Mandant.
 *
 * Owner-Default: alle Blöcke. Employee-Default: { bloecke: {} }, ohne Lader.
 * Employee braucht userId !== tenantId; Owner braucht userId === tenantId.
 * is_active=false sperrt laut bestehender Auth nur Mitarbeiter, nicht Owner.
 * Explizite Finanzanforderung durch Mitarbeiter / ungültige Rolle: 403 NUR_INHABER.
 * Auswahlfehler: 400 UNGUELTIGE_BLOECKE; fremde Querykeys: UNGUELTIGE_PARAMETER.
 * Erfolg: { bloecke: { [name]: { status: 'ok', daten: <JSON-Objekt/Array> } } }.
 * Blockfehler: { status: 'fehler', code: 'BLOCK_NICHT_VERFUEGBAR' } statt daten.
 * HTTP 200 auch bei Teilfehlern; 503, wenn alle angeforderten Blöcke fehlschlagen.
 *
 * lader[name]({ tenantId }) liefert ein sicheres JSON-Objekt/Array oder wirft.
 * tenantId stammt ausschließlich aus requireAuth, niemals aus Request-Parametern.
 * Fehlender Lader / null / undefined ist unavailable, kein leerer Geldbestand.
 * Fachliche Datenform und Finanzberechnung gehören in die noch fehlenden Adapter.
 * @param {object} [options]
 * @param {function} [options.auth] Bestehende Auth, injizierbar für Grenztests.
 * @param {object} [options.lader] Async-Lader für geld, mahnungen, abrechnung.
 */
export function createStartseiteRouter({ auth = requireAuth, lader = {} } = {}) {
  const router = Router();
  router.get('/startseite/zusammenfassung', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, auth, async (req, res) => {
    const a = req.auth;
    if (!a || ![a.userId, a.tenantId].every(id => typeof id === 'string' && id.trim() === id && id.length > 0)
      || !['owner', 'employee'].includes(a.role)
      || (a.role === 'owner' && a.userId !== a.tenantId)
      || (a.role === 'employee' && a.userId === a.tenantId)) {
      return res.status(403).json({ code: 'NUR_INHABER' });
    }

    // Roh-Query prüfen: Express' extended-Parser kann z. B. __proto__ entfernen.
    // URLSearchParams erhält doppelte Schlüssel und funktioniert bei beiden Parsern.
    const query = new URLSearchParams(req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '');
    const keys = [...query.keys()];
    let angefordert = a.role === 'owner' ? BLOECKE : [];
    if (keys.length > 0) {
      if (keys.some(key => key !== 'bloecke' && !key.startsWith('bloecke['))) {
        return res.status(400).json({ code: 'UNGUELTIGE_PARAMETER' });
      }
      if (keys.length !== 1 || keys[0] !== 'bloecke') {
        return res.status(400).json({ code: 'UNGUELTIGE_BLOECKE' });
      }
      angefordert = query.get('bloecke').split(',');
      if (angefordert.some(name => !BLOECKE.includes(name)) || new Set(angefordert).size !== angefordert.length) {
        return res.status(400).json({ code: 'UNGUELTIGE_BLOECKE' });
      }
      if (a.role !== 'owner') return res.status(403).json({ code: 'NUR_INHABER' });
    }

    const tenantId = a.tenantId;
    const eintraege = await Promise.all(angefordert.map(async (name) => {
      try {
        if (!Object.hasOwn(lader, name) || typeof lader[name] !== 'function') throw new Error(BLOCK_FEHLER);
        const daten = await lader[name]({ tenantId });
        if (daten === null || typeof daten !== 'object' || daten instanceof Error) throw new Error(BLOCK_FEHLER);
        // Vor der Sammelantwort serialisieren: auch BigInt/Zyklen/toJSON-Fehler
        // dürfen nur diesen Block treffen; Fehlerobjekte bleiben intern.
        const sicher = JSON.parse(JSON.stringify(daten, (_key, value) => {
          if (value instanceof Error || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(BLOCK_FEHLER);
          return value;
        }));
        if (sicher === null || typeof sicher !== 'object') throw new Error(BLOCK_FEHLER);
        return [name, { status: 'ok', daten: sicher }];
      } catch {
        return [name, { status: 'fehler', code: BLOCK_FEHLER }];
      }
    }));
    const alleFehlgeschlagen = eintraege.length > 0 && eintraege.every(([, block]) => block.status === 'fehler');
    return res.status(alleFehlgeschlagen ? 503 : 200).json({ bloecke: Object.fromEntries(eintraege) });
  });
  return router;
}
