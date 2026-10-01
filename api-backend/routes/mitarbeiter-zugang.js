import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../ai/auth.js';
import {
  generateSetupCode,
  formatSetupCode,
  hashCode,
  verifyCode,
  isCodeExpired,
  calculateExpiryDate,
} from './mitarbeiter-zugang-code.js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Plan-Limits für Mitarbeiteranzahl (identisch mit dashboard.js PLAN_EMPLOYEE_LIMITS)
const PLAN_EMPLOYEE_LIMITS = {
  starter: 2,
  professional: 8,
  klinik: 15,
  enterprise: Infinity,
};

function cleanSlug(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Rate Limiter ─────────────────────────────────────────────────────────────

// a) Mitarbeiter anlegen: 10 pro Stunde pro Inhaber-UserId
const createEmployeeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId || req.ip,
  message: { error: 'Zu viele Mitarbeiter-Neuanlagen. Bitte warten Sie eine Stunde.' },
});

// b) Neuen Einrichtungscode erzeugen: 20 pro Stunde pro Inhaber-UserId
const resetCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId || req.ip,
  message: { error: 'Zu viele Anfragen für Einrichtungscodes. Bitte warten Sie eine Stunde.' },
});

// c) Erstanmeldung (öffentlich): 5 Versuche pro 15 Minuten pro IP
const erstanmeldungLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Zu viele Versuche. Bitte warten Sie 15 Minuten.' },
});

// ── a) POST /team/mitarbeiter ────────────────────────────────────────────────
router.post('/team/mitarbeiter', requireAuth, createEmployeeLimiter, async (req, res) => {
  const ownerId = req.auth.userId;

  try {
    // 1. Rolle des Aufrufers prüfen (muss 'owner' sein)
    const { data: callerProfile, error: callerErr } = await supabase
      .from('profiles')
      .select('id, role, plan, sector, business_name, company_code')
      .eq('id', ownerId)
      .maybeSingle();

    if (callerErr || !callerProfile) {
      return res.status(403).json({ error: 'Profil des Aufrufers nicht gefunden.' });
    }
    if (callerProfile.role !== 'owner') {
      return res.status(403).json({ error: 'Nur Praxisinhaber können Mitarbeiter anlegen.' });
    }

    // 2. Body-Validierung
    const rawVorname = req.body?.vorname || req.body?.firstName || '';
    const rawNachname = req.body?.nachname || req.body?.lastName || '';
    const rawEmail = req.body?.email || '';
    const rawAnrede = req.body?.anrede || null;

    const vorname = typeof rawVorname === 'string' ? rawVorname.trim() : '';
    const nachname = typeof rawNachname === 'string' ? rawNachname.trim() : '';
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const anrede = typeof rawAnrede === 'string' && rawAnrede.trim().length ? rawAnrede.trim() : null;
    const telefon = typeof req.body?.telefon === 'string' && req.body.telefon.trim() ? req.body.telefon.trim().slice(0, 40) : null;

    if (!vorname || vorname.length > 100) {
      return res.status(400).json({ error: 'Vorname ist erforderlich (maximal 100 Zeichen).' });
    }
    if (!nachname || nachname.length > 100) {
      return res.status(400).json({ error: 'Nachname ist erforderlich (maximal 100 Zeichen).' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 255) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
    }

    // 3. Plan-Limit serverseitig prüfen
    const plan = (callerProfile.plan || 'starter').toLowerCase();
    const lim = PLAN_EMPLOYEE_LIMITS[plan] ?? 2;

    const { count, error: countErr } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('role', 'employee');

    if (countErr) {
      return res.status(500).json({ error: 'Mitarbeiteranzahl konnte nicht ermittelt werden.' });
    }

    if (Number.isFinite(lim) && (count ?? 0) >= lim) {
      return res.status(409).json({
        error: `Plan-Limit erreicht: max. ${lim} Mitarbeiter im ${(callerProfile.plan || 'starter')}-Paket. Bitte upgraden.`
      });
    }

    // 4. Einrichtungscode + Zufallspasswort generieren
    const rawCode = generateSetupCode();
    const formattedCode = formatSetupCode(rawCode);
    const codeHash = hashCode(rawCode);
    const gueltigBis = calculateExpiryDate(7);
    const tempPassword = crypto.randomBytes(32).toString('base64');
    const fullName = `${vorname} ${nachname}`.trim();

    // 5. Auth-Konto bestätigt anlegen (email_confirm: true)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: vorname,
        last_name: nachname,
      },
      app_metadata: {
        einrichtung_hash: codeHash,
        einrichtung_bis: gueltigBis,
      }
    });

    if (authErr) {
      const msg = (authErr.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || authErr.status === 422) {
        return res.status(409).json({ error: 'Für diese E-Mail-Adresse besteht bereits ein Konto.' });
      }
      return res.status(500).json({ error: 'Konto konnte nicht angelegt werden', detail: authErr.message });
    }

    const newUserId = authData.user.id;

    // 6. Profil & Zuordnungen vervollständigen (bei Fehlschlag wird das Auth-Konto bereinigt)
    try {
      const appBaseUrl = process.env.APP_BASE_URL || 'https://app.praxura.de';
      const ownerSlug = cleanSlug(callerProfile.business_name) || callerProfile.company_code?.toLowerCase() || cleanSlug(ownerId);
      const empSlug = cleanSlug(fullName);
      const bookingSlug = `${appBaseUrl}/booking.html?u=${ownerSlug}-${empSlug}`;

      // Trigger handle_new_user hat bereits (id, email) angelegt -> hier UPDATE
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          role: 'employee',
          owner_id: ownerId,
          business_name: fullName,
          anrede: anrede,
          phone: telefon,
          plan: 'mitarbeiter',
          billing: null,
          plan_status: 'active',
          is_active: true,
          sector: callerProfile.sector || 'default',
          booking_slug: bookingSlug,
        })
        .eq('id', newUserId);

      if (pErr) throw pErr;

      // Arbeitszeiten vom Inhaber kopieren oder Standard Mo-Fr 08:00-17:00
      const { data: ownerWh } = await supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time, is_active')
        .eq('user_id', ownerId);

      let whRows = [];
      if (ownerWh && ownerWh.length > 0) {
        whRows = ownerWh.map(h => ({
          user_id: newUserId,
          day_of_week: h.day_of_week,
          start_time: h.start_time,
          end_time: h.end_time,
          is_active: h.is_active,
        }));
      } else {
        for (let d = 0; d < 7; d++) {
          whRows.push({
            user_id: newUserId,
            day_of_week: d,
            start_time: '08:00:00',
            end_time: '17:00:00',
            is_active: d >= 1 && d <= 5,
          });
        }
      }

      if (whRows.length > 0) {
        const { error: whErr } = await supabase.from('working_hours').insert(whRows);
        if (whErr) console.warn('[mitarbeiter-zugang] working_hours Fehler (nicht blockierend):', whErr.message);
      }

      // Zuordnung zum Standard-Standort und Mitarbeiter-Gruppe
      try {
        const { data: defaultBiz } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', ownerId)
          .eq('is_default', true)
          .maybeSingle();

        if (defaultBiz?.id) {
          const { data: mitGroup } = await supabase
            .from('employee_groups')
            .select('id')
            .eq('business_id', defaultBiz.id)
            .eq('name', 'Mitarbeiter')
            .maybeSingle();

          await supabase.from('employee_business_assignments').upsert({
            employee_id: newUserId,
            business_id: defaultBiz.id,
            group_id: mitGroup?.id || null,
          }, { onConflict: 'employee_id,business_id' });
        }
      } catch (bizErr) {
        console.warn('[mitarbeiter-zugang] business-assignment Fehler (nicht blockierend):', bizErr.message);
      }

      // Audit-Log
      console.info('[mitarbeiter-zugang]', JSON.stringify({
        aktion: 'mitarbeiter_angelegt',
        owner_id: ownerId,
        ziel_id: newUserId,
        ts: new Date().toISOString()
      }));

      return res.status(200).json({
        id: newUserId,
        email,
        einrichtungscode: formattedCode,
        gueltig_bis: gueltigBis,
      });

    } catch (setupErr) {
      // Rollback: Auth-Konto wieder löschen, kein verwaistes Konto hinterlassen
      console.error('[mitarbeiter-zugang] Fehler nach createUser, lösche Konto:', setupErr.message);
      try {
        await supabase.auth.admin.deleteUser(newUserId);
      } catch (delErr) {
        console.error('[mitarbeiter-zugang] deleteUser Rollback fehlgeschlagen:', delErr.message);
      }
      return res.status(500).json({
        error: 'Mitarbeiterprofil konnte nicht eingerichtet werden',
        detail: setupErr.message
      });
    }

  } catch (err) {
    console.error('[mitarbeiter-zugang] Unerwarteter Fehler bei Mitarbeiter-Anlage:', err);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// ── b) POST /team/mitarbeiter/:id/einrichtungscode ───────────────────────────
router.post('/team/mitarbeiter/:id/einrichtungscode', requireAuth, resetCodeLimiter, async (req, res) => {
  const ownerId = req.auth.userId;
  const targetId = req.params.id;

  try {
    // 1. Aufrufer muss owner sein
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', ownerId)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== 'owner') {
      return res.status(403).json({ error: 'Nur Praxisinhaber dürfen Einrichtungscodes neu erzeugen.' });
    }

    // 2. Ziel-Mitarbeiter prüfen (owner_id muss = caller AND role = 'employee', sonst 404)
    const { data: targetProfile, error: tErr } = await supabase
      .from('profiles')
      .select('id, owner_id, role')
      .eq('id', targetId)
      .eq('owner_id', ownerId)
      .eq('role', 'employee')
      .maybeSingle();

    if (tErr || !targetProfile) {
      console.info('[mitarbeiter-zugang]', JSON.stringify({
        aktion: 'einrichtungscode_erneuert_fehlschlag',
        grund: 'nicht_gefunden',
        owner_id: ownerId,
        ziel_id: targetId,
        ts: new Date().toISOString()
      }));
      return res.status(404).json({ error: 'Mitarbeiter nicht gefunden.' });
    }

    // 3. Neuen Code erzeugen + temporäres Passwort rotieren
    const rawCode = generateSetupCode();
    const formattedCode = formatSetupCode(rawCode);
    const codeHash = hashCode(rawCode);
    const gueltigBis = calculateExpiryDate(7);
    const newTempPassword = crypto.randomBytes(32).toString('base64');

    // 4. In app_metadata speichern + Passwort ungültig machen
    const { error: updErr } = await supabase.auth.admin.updateUserById(targetId, {
      password: newTempPassword,
      app_metadata: {
        einrichtung_hash: codeHash,
        einrichtung_bis: gueltigBis,
      }
    });

    if (updErr) {
      return res.status(500).json({
        error: 'Einrichtungscode konnte nicht aktualisiert werden',
        detail: updErr.message
      });
    }

    // Audit-Log
    console.info('[mitarbeiter-zugang]', JSON.stringify({
      aktion: 'einrichtungscode_erneuert',
      owner_id: ownerId,
      ziel_id: targetId,
      ts: new Date().toISOString()
    }));

    return res.status(200).json({
      einrichtungscode: formattedCode,
      gueltig_bis: gueltigBis,
    });

  } catch (err) {
    console.error('[mitarbeiter-zugang] Unerwarteter Fehler bei Einrichtungscode-Erneuerung:', err);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// ── c) POST /team/erstanmeldung ──────────────────────────────────────────────
router.post('/team/erstanmeldung', erstanmeldungLimiter, async (req, res) => {
  const genericFail = () => {
    console.info('[mitarbeiter-zugang]', JSON.stringify({
      aktion: 'erstanmeldung_fehlschlag',
      ip: req.ip,
      ts: new Date().toISOString()
    }));
    return res.status(400).json({
      error: 'E-Mail-Adresse oder Einrichtungscode ungültig oder abgelaufen.'
    });
  };

  try {
    const rawEmail = req.body?.email || '';
    const rawCode = req.body?.code || '';
    const passwort = req.body?.passwort || '';

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';

    if (!email || !code) {
      return genericFail();
    }

    // Passwort-Validierung (min. 12 Zeichen)
    if (typeof passwort !== 'string' || passwort.length < 12) {
      return res.status(400).json({
        error: 'Das Passwort muss mindestens 12 Zeichen lang sein.'
      });
    }

    // 1. Mitarbeiter über profiles (email, role='employee') mit service role suchen
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, role, owner_id')
      .eq('email', email)
      .eq('role', 'employee')
      .maybeSingle();

    if (pErr || !profile) {
      return genericFail();
    }

    // 2. Nutzer-Daten aus auth.admin laden
    const { data: authData, error: aErr } = await supabase.auth.admin.getUserById(profile.id);
    if (aErr || !authData?.user) {
      return genericFail();
    }

    const appMeta = authData.user.app_metadata || {};
    const storedHash = appMeta.einrichtung_hash;
    const storedBis = appMeta.einrichtung_bis;

    if (!storedHash || !storedBis) {
      return genericFail();
    }

    // 3. Ablaufdatum prüfen
    if (isCodeExpired(storedBis)) {
      return genericFail();
    }

    // 4. Hash timing-sicher vergleichen
    const matches = verifyCode(code, storedHash);
    if (!matches) {
      return genericFail();
    }

    // 5. Neues Passwort setzen und Einrichtungscode in app_metadata entwerten
    const { error: pwErr } = await supabase.auth.admin.updateUserById(profile.id, {
      password: passwort,
      app_metadata: {
        ...appMeta,
        einrichtung_hash: null,
        einrichtung_bis: null,
      }
    });

    if (pwErr) {
      console.error('[mitarbeiter-zugang] Passwort-Update fehlgeschlagen:', pwErr.message);
      return res.status(500).json({ error: 'Passwort konnte nicht gesetzt werden' });
    }

    // Audit-Log
    console.info('[mitarbeiter-zugang]', JSON.stringify({
      aktion: 'erstanmeldung_erfolgreich',
      owner_id: profile.owner_id,
      ziel_id: profile.id,
      ts: new Date().toISOString()
    }));

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[mitarbeiter-zugang] Unerwarteter Fehler bei Erstanmeldung:', err);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;
