import express from 'express';
import { enthaeltHpnr78040 } from '../utils/podo-empfangsnachweis.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Authentifizierung und rollenbasierte Autorisierung (Fail-Closed).
 * - Inhaber: role === 'owner', profile.id === user.id, profile.owner_id === null
 * - Mitarbeiter: role === 'employee', profile.owner_id vorhanden
 * - Andere Rollen: 403 Forbidden
 */
async function resolveAuth(req, supabase) {
  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { status: 401, error: 'Fehlender oder ungültiger Authorization-Header' };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { status: 401, error: 'Fehlender Bearer-Token' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return { status: 401, error: 'Ungültiger oder abgelaufener Token' };
  }
  const user = userData.user;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, owner_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { status: 403, error: 'Profil nicht gefunden' };
  }

  if (profile.role === 'owner') {
    if (profile.id !== user.id || profile.owner_id !== null) {
      return { status: 403, error: 'Ungültige Inhaber-Rollenkonfiguration' };
    }
    return {
      user,
      profile,
      tenantId: profile.id,
      isOwner: true,
      isEmployee: false,
    };
  }

  if (profile.role === 'employee') {
    if (
      profile.id !== user.id ||
      !profile.owner_id ||
      typeof profile.owner_id !== 'string' ||
      !UUID_REGEX.test(profile.owner_id) ||
      profile.owner_id === user.id
    ) {
      return { status: 403, error: 'Ungültige Mitarbeiter-Rollenkonfiguration' };
    }
    return {
      user,
      profile,
      tenantId: profile.owner_id,
      isOwner: false,
      isEmployee: true,
    };
  }

  return { status: 403, error: 'Unzureichende Berechtigungen' };
}

/**
 * Erzeugt den Router für podologische Empfangsnachweise (Dependency Injected).
 */
export function createPodoEmpfangsnachweisRouter({ supabase }) {
  if (!supabase) {
    throw new Error('createPodoEmpfangsnachweisRouter erfordert { supabase }');
  }

  const router = express.Router();

  // GET /podologie/behandlungen/:id/empfangsnachweis
  router.get('/podologie/behandlungen/:id/empfangsnachweis', async (req, res) => {
    try {
      const auth = await resolveAuth(req, supabase);
      if (auth.status) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const treatmentId = req.params.id;
      if (!UUID_REGEX.test(treatmentId)) {
        return res.status(400).json({ error: 'Ungültige Behandlungs-ID (UUID erforderlich)' });
      }

      // Mandantenisolierte Abfrage mit kontrolliertem 404 (verhindert Tenant-Leakage)
      const { data: treatment, error: tErr } = await supabase
        .from('podologie_behandlungen')
        .select('id, owner_id, behandlungsdatum, hpnr_codes, storniert_am, verordnung_id')
        .eq('id', treatmentId)
        .eq('owner_id', auth.tenantId)
        .maybeSingle();

      if (tErr) {
        return res.status(500).json({ error: 'Fehler beim Laden der Behandlungsdaten' });
      }
      if (!treatment) {
        return res.status(404).json({ error: 'Behandlung nicht gefunden' });
      }

      const { data: event, error: evErr } = await supabase
        .from('podologie_empfangsnachweise')
        .select('id, event_seq, owner_id, behandlung_id, behandlungsdatum, hpnr_code, therapeuteninitialen, status, geprueft_von, geprueft_am, dokument_id, grund, vorgaenger_id')
        .eq('behandlung_id', treatment.id)
        .eq('owner_id', auth.tenantId)
        .order('event_seq', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (evErr) {
        return res.status(500).json({ error: 'Fehler beim Laden des Empfangsnachweises' });
      }

      return res.json({ nachweis: event || null });
    } catch (err) {
      return res.status(500).json({ error: 'Interner Serverfehler' });
    }
  });

  // POST /podologie/behandlungen/:id/empfangsnachweis
  router.post('/podologie/behandlungen/:id/empfangsnachweis', async (req, res) => {
    try {
      const auth = await resolveAuth(req, supabase);
      if (auth.status) {
        return res.status(auth.status).json({ error: auth.error });
      }

      // Owner Write Only
      if (!auth.isOwner) {
        return res.status(403).json({
          error: 'Nur Praxisinhaber dürfen den Empfangsnachweis prüfen oder widerrufen',
        });
      }

      const treatmentId = req.params.id;
      if (!UUID_REGEX.test(treatmentId)) {
        return res.status(400).json({ error: 'Ungültige Behandlungs-ID (UUID erforderlich)' });
      }

      // Request Body Whitelist & Validierung: muss echtes JSON-Objekt sein (kein Array)
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Ungültiger Anforderungskörper (JSON-Objekt erforderlich)' });
      }

      const body = req.body;
      const allowedKeys = new Set(['status', 'therapeuteninitialen', 'grund', 'dokument_id']);
      for (const k of Object.keys(body)) {
        if (!allowedKeys.has(k)) {
          return res.status(400).json({ error: `Unerlaubtes Feld im Anforderungskörper: ${k}` });
        }
      }

      const status = body.status;
      if (status !== 'bestaetigt' && status !== 'widerrufen') {
        return res.status(400).json({
          error: 'Ungültiger Status: erwartet wird "bestaetigt" oder "widerrufen"',
        });
      }

      let initialen = null;
      let grund = null;
      let dokumentId = null;

      if (status === 'bestaetigt') {
        if (typeof body.therapeuteninitialen !== 'string') {
          return res.status(400).json({ error: 'Therapeuteninitialen erforderlich' });
        }
        const initTrimmed = body.therapeuteninitialen.trim();
        if (initTrimmed.length < 1 || initTrimmed.length > 16) {
          return res.status(400).json({
            error: 'Therapeuteninitialen müssen zwischen 1 und 16 Zeichen lang sein',
          });
        }
        initialen = initTrimmed;

        if (body.grund !== undefined && body.grund !== null) {
          if (typeof body.grund !== 'string') {
            return res.status(400).json({ error: 'Grund muss ein Text sein' });
          }
          const gTrimmed = body.grund.trim();
          if (gTrimmed.length > 500) {
            return res.status(400).json({ error: 'Grund darf maximal 500 Zeichen lang sein' });
          }
          grund = gTrimmed.length > 0 ? gTrimmed : null;
        }
      } else if (status === 'widerrufen') {
        if (typeof body.grund !== 'string') {
          return res.status(400).json({ error: 'Grund für Widerruf erforderlich' });
        }
        const gTrimmed = body.grund.trim();
        if (gTrimmed.length < 1 || gTrimmed.length > 500) {
          return res.status(400).json({
            error: 'Grund für Widerruf muss zwischen 1 und 500 Zeichen lang sein',
          });
        }
        grund = gTrimmed;

        if (body.therapeuteninitialen !== undefined && body.therapeuteninitialen !== null) {
          if (typeof body.therapeuteninitialen !== 'string') {
            return res.status(400).json({ error: 'Therapeuteninitialen müssen ein Text sein' });
          }
          const initTrimmed = body.therapeuteninitialen.trim();
          if (initTrimmed.length < 1 || initTrimmed.length > 16) {
            return res.status(400).json({
              error: 'Therapeuteninitialen müssen zwischen 1 und 16 Zeichen lang sein',
            });
          }
          initialen = initTrimmed;
        }
      }

      if (body.dokument_id !== undefined && body.dokument_id !== null) {
        let dokStr = null;
        if (typeof body.dokument_id === 'number') {
          if (!Number.isSafeInteger(body.dokument_id) || body.dokument_id <= 0) {
            return res.status(400).json({
              error: 'dokument_id muss eine positive Ganzzahl sein',
            });
          }
          dokStr = String(body.dokument_id);
        } else if (typeof body.dokument_id === 'string') {
          const s = body.dokument_id.trim();
          if (!/^[1-9]\d*$/.test(s)) {
            return res.status(400).json({
              error: 'dokument_id muss eine positive Ganzzahl als String oder Zahl sein',
            });
          }
          try {
            const b = BigInt(s);
            if (b <= 0n || b > 9223372036854775807n) {
              return res.status(400).json({
                error: 'dokument_id überschreitet den zulässigen Wertebereich (1 bis 9223372036854775807)',
              });
            }
          } catch {
            return res.status(400).json({
              error: 'dokument_id ungültig',
            });
          }
          dokStr = s;
        } else {
          return res.status(400).json({
            error: 'dokument_id muss eine positive Ganzzahl als String oder Zahl sein',
          });
        }
        dokumentId = dokStr;
      }

      // Mandantenisolierte Behandlung prüfen (Controlled 404)
      const { data: treatment, error: tErr } = await supabase
        .from('podologie_behandlungen')
        .select('id, owner_id, behandlungsdatum, hpnr_codes, storniert_am, verordnung_id')
        .eq('id', treatmentId)
        .eq('owner_id', auth.tenantId)
        .maybeSingle();

      if (tErr) {
        return res.status(500).json({ error: 'Fehler beim Laden der Behandlungsdaten' });
      }
      if (!treatment) {
        return res.status(404).json({ error: 'Behandlung nicht gefunden' });
      }

      // Eligibility-Checks
      if (treatment.storniert_am !== null && treatment.storniert_am !== undefined) {
        return res.status(422).json({ error: 'Behandlung ist storniert' });
      }
      if (!treatment.verordnung_id) {
        return res.status(422).json({ error: 'Behandlung ist keiner Verordnung zugeordnet' });
      }
      if (!enthaeltHpnr78040(treatment.hpnr_codes)) {
        return res.status(422).json({ error: 'Behandlung erfordert HPNR 78040' });
      }

      // Server-seitig abgeleitete Actor-Parameter; Append via PostgreSQL RPC
      const { data: rpcRow, error: rpcErr } = await supabase.rpc('podologie_empfangsnachweis_append', {
        p_owner_id: auth.tenantId,
        p_pruefer_id: auth.profile.id,
        p_behandlung_id: treatment.id,
        p_status: status,
        p_therapeuteninitialen: initialen,
        p_dokument_id: dokumentId,
        p_grund: grund,
      });

      if (rpcErr) {
        const code = rpcErr.code;
        const msg = rpcErr.message || '';
        if (code === '42501') {
          return res.status(403).json({ error: 'Keine Berechtigung zur Ausführung dieser Aktion' });
        }
        if (code === 'P0002') {
          return res.status(404).json({ error: 'Zugehörige Ressource nicht gefunden' });
        }
        if (code === '23514') {
          let safeMsg = 'Voraussetzungen für Empfangsnachweis nicht erfüllt';
          if (msg.includes('Withdrawal requires an existing predecessor event')) {
            safeMsg = 'Widerruf erfordert einen vorherigen Nachweis';
          } else if (msg.includes('cancelled')) {
            safeMsg = 'Behandlung ist storniert';
          } else if (msg.includes('78040')) {
            safeMsg = 'Behandlung erfordert HPNR 78040';
          }
          return res.status(422).json({ error: safeMsg });
        }
        return res.status(500).json({ error: 'Fehler beim Erfassen des Empfangsnachweises' });
      }

      // Normalisierung: RPC kann Einzelobjekt oder 1-elementiges Array liefern; 0 oder >1 Zeilen ablehnen
      let rpcResult = rpcRow;
      if (Array.isArray(rpcResult)) {
        if (rpcResult.length !== 1) {
          return res.status(500).json({ error: 'Ungültige Rückgabe des Bestätigungsdienstes (Zeilenanzahl unerwartet)' });
        }
        rpcResult = rpcResult[0];
      }

      if (!rpcResult || typeof rpcResult !== 'object' || Array.isArray(rpcResult)) {
        return res.status(500).json({ error: 'Ungültige Rückgabe des Bestätigungsdienstes' });
      }

      // Vollständige Snapshot-Validierung gegen Server-Daten (kein Erfinden von Erfolgsmeldungen)
      if (
        !rpcResult.id ||
        rpcResult.status !== status ||
        rpcResult.behandlung_id !== treatment.id ||
        rpcResult.owner_id !== auth.tenantId ||
        rpcResult.hpnr_code !== '78040' ||
        rpcResult.behandlungsdatum !== treatment.behandlungsdatum ||
        (rpcResult.geprueft_von !== auth.profile.id && rpcResult.pruefer_id !== auth.profile.id)
      ) {
        return res.status(500).json({ error: 'Ungültige Rückgabe des Bestätigungsdienstes' });
      }

      return res.status(201).json({ nachweis: rpcResult });
    } catch (err) {
      return res.status(500).json({ error: 'Interner Serverfehler' });
    }
  });

  return router;
}

/**
 * Mountet die Routen auf den Abrechnungs-Router.
 */
export function mountPodoEmpfangsnachweisRoutes(parentRouter, deps) {
  const subRouter = createPodoEmpfangsnachweisRouter(deps);
  parentRouter.use(subRouter);
}
