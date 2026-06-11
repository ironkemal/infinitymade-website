// GET  /api/dsgvo?action=export  — DSGVO Art. 15 Datenauskunft
// POST /api/dsgvo?action=delete  — DSGVO Art. 17 Recht auf Löschung

import { getAuthedUser, adminFetch, adminAuthFetch, json } from './_lib/auth.js';
import { stripeRequest } from './_lib/stripe.js';

// ─── Export ──────────────────────────────────────────────────────────────────

const USER_TABLES = [
  { table: 'profiles',                     filter: 'id'        },
  { table: 'user_preferences',             filter: 'user_id'   },
  { table: 'businesses',                   filter: 'owner_id'  },
  { table: 'calendar_integrations',        filter: 'user_id'   },
  { table: 'services',                     filter: 'owner_id'  },
  { table: 'business_services',            filter: 'owner_id'  },
  { table: 'employee_services',            filter: 'owner_id'  },
  { table: 'working_hours',                filter: 'user_id'   },
  { table: 'breaks',                       filter: 'user_id'   },
  { table: 'custom_days',                  filter: 'user_id'   },
  { table: 'time_offs',                    filter: 'user_id'   },
  { table: 'bookings',                     filter: 'owner_id'  },
  { table: 'patient_notes',                filter: 'owner_id'  },
  { table: 'anamnese',                     filter: 'owner_id'  },
  { table: 'prescriptions',                filter: 'owner_id'  },
  { table: 'prescription_sessions',        filter: 'owner_id'  },
  { table: 'prescription_validations',     filter: 'owner_id'  },
  { table: 'invoices',                     filter: 'owner_id'  },
  { table: 'abrechnung',                   filter: 'owner_id'  },
  { table: 'zuzahlung_befreiung',          filter: 'owner_id'  },
  { table: 'leads',                        filter: 'owner_id'  },
  { table: 'b2b_contacts',                 filter: 'owner_id'  },
  { table: 'email_logs',                   filter: 'owner_id'  },
  { table: 'feedbacks',                    filter: 'user_id'   },
  { table: 'ai_audit_log',                 filter: 'user_id'   },
  { table: 'chatbot_usage',                filter: 'user_id'   },
  { table: 'vehicles',                     filter: 'owner_id'  },
  { table: 'fahrten',                      filter: 'owner_id'  },
  { table: 'aerzte',                       filter: 'owner_id'  },
  { table: 'ueberweisungen',               filter: 'owner_id'  },
  { table: 'referral_drafts',              filter: 'owner_id'  },
  { table: 'terapeut_zertifikat',          filter: 'owner_id'  },
  { table: 'employee_groups',              filter: 'owner_id'  },
  { table: 'employee_business_assignments',filter: 'owner_id'  },
  { table: 'consent_log',                  filter: 'user_id'   },
];

async function handleExport(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { user, error } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: error || 'Unauthorized' });

  const userId = user.id;
  const data = {};
  const errors = {};

  for (const { table, filter } of USER_TABLES) {
    const url = `/${table}?${filter}=eq.${encodeURIComponent(userId)}&select=*`;
    const { ok, data: rows, status } = await adminFetch(url);
    if (ok) {
      data[table] = rows || [];
    } else {
      errors[table] = `status ${status}`;
    }
  }

  const auth_meta = {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    email_confirmed_at: user.email_confirmed_at,
    user_metadata: user.user_metadata || null,
  };

  const payload = {
    generated_at: new Date().toISOString(),
    user_id: userId,
    legal_basis: 'DSGVO Art. 15 (Recht auf Auskunft)',
    note: 'Vollständige Kopie der zu Ihrer Person gespeicherten Daten. Bei Fragen: support@praxura.de',
    auth: auth_meta,
    data,
    errors_per_table: Object.keys(errors).length ? errors : undefined,
  };

  res.setHeader('Content-Disposition', `attachment; filename="dsgvo-export-${userId}.json"`);
  return json(res, 200, payload);
}

// ─── Delete ──────────────────────────────────────────────────────────────────

const ANONYMIZE_TABLES = [
  { table: 'invoices', filter: 'owner_id', nullify: ['patient_name', 'patient_id', 'notes'] },
];

const DELETE_TABLES = [
  'consent_log', 'ai_audit_log', 'chatbot_usage', 'feedbacks', 'email_logs',
  'patient_notes', 'anamnese', 'prescription_validations', 'prescription_sessions',
  'prescriptions', 'zuzahlung_befreiung', 'referral_drafts', 'ueberweisungen',
  'aerzte', 'b2b_contacts', 'leads', 'fahrten', 'vehicles', 'terapeut_zertifikat',
  'bookings', 'time_offs', 'breaks', 'custom_days', 'working_hours',
  'employee_services', 'business_services', 'services', 'calendar_integrations',
  'employee_business_assignments', 'employee_groups', 'businesses', 'user_preferences',
];

async function handleDelete(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { confirm } = req.body || {};
  if (confirm !== 'LÖSCHEN') {
    return json(res, 400, {
      error: 'Bestätigung fehlt',
      message: 'Bitte senden Sie { "confirm": "LÖSCHEN" } um die Löschung zu bestätigen.',
    });
  }

  const { user, error } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: error || 'Unauthorized' });
  const userId = user.id;

  const { ok: rlOk, data: rlRows } = await adminFetch(
    `/data_access_log?user_id=eq.${encodeURIComponent(userId)}&action=eq.dsgvo_deletion&select=id&limit=1`
  );
  if (rlOk && Array.isArray(rlRows) && rlRows.length > 0) {
    return json(res, 429, { error: 'Ihr Konto befindet sich bereits im Löschprozess.' });
  }

  const log = { user_id: userId, started_at: new Date().toISOString(), steps: [] };

  {
    const { ok: profOk, data: profData } = await adminFetch(
      `/profiles?id=eq.${encodeURIComponent(userId)}&select=stripe_subscription_id,stripe_customer_id`,
      { method: 'GET' }
    );
    if (profOk && Array.isArray(profData) && profData.length > 0) {
      const { stripe_subscription_id, stripe_customer_id } = profData[0];
      if (stripe_subscription_id) {
        try {
          const { ok, status } = await stripeRequest(`/subscriptions/${stripe_subscription_id}`, { method: 'DELETE' });
          log.steps.push({ step: 'stripe:cancel_subscription', ok, status });
        } catch (err) {
          log.steps.push({ step: 'stripe:cancel_subscription', ok: false, error: err.message });
        }
      }
      if (stripe_customer_id) {
        try {
          const { ok, status } = await stripeRequest(`/customers/${stripe_customer_id}`, { method: 'DELETE' });
          log.steps.push({ step: 'stripe:delete_customer', ok, status });
        } catch (err) {
          log.steps.push({ step: 'stripe:delete_customer', ok: false, error: err.message });
        }
      }
    } else {
      log.steps.push({ step: 'stripe:profile_fetch', ok: profOk, note: 'no profile row or no stripe IDs' });
    }
  }

  for (const { table, filter, nullify } of ANONYMIZE_TABLES) {
    const patch = nullify.reduce((acc, col) => ({ ...acc, [col]: null }), {});
    const { ok, status } = await adminFetch(`/${table}?${filter}=eq.${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    log.steps.push({ step: `anonymize:${table}`, ok, status });
  }

  for (const table of DELETE_TABLES) {
    for (const filter of ['owner_id', 'user_id']) {
      const { ok, status } = await adminFetch(`/${table}?${filter}=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
      if (ok && status !== 404) { log.steps.push({ step: `delete:${table}:${filter}`, ok, status }); break; }
    }
  }

  const { ok: pOk, status: pStatus } = await adminFetch(`/profiles?id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
  log.steps.push({ step: 'delete:profiles', ok: pOk, status: pStatus });

  const { ok: aOk, status: aStatus } = await adminAuthFetch(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  log.steps.push({ step: 'delete:auth_user', ok: aOk, status: aStatus });

  log.completed_at = new Date().toISOString();

  await adminFetch('/data_access_log', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId, owner_id: userId, action: 'dsgvo_deletion',
      method: 'POST', path: '/api/dsgvo', resource: 'profile',
      resource_id: userId, metadata: log,
    }),
  });

  return json(res, 200, {
    success: true,
    message: 'Ihre Daten wurden gelöscht. Abrechnungsdaten bleiben anonymisiert aus gesetzlicher Aufbewahrungspflicht (§ 147 AO, § 304 SGB V) gespeichert.',
    log,
  });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const action = req.query?.action || req.url?.split('?')[1]?.match(/action=([^&]+)/)?.[1];
  if (action === 'export') return handleExport(req, res);
  if (action === 'delete') return handleDelete(req, res);
  return json(res, 400, { error: 'action=export veya action=delete gerekli' });
}
