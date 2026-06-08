// POST /api/dsgvo/delete
// DSGVO Art. 17 (Recht auf Löschung / "Right to be forgotten")
// Body: { confirm: "LÖSCHEN" }   ← explicit string confirmation, avoids accidents
//
// Effect:
// 1. Deletes profiles row (cascading FKs handle child tables where defined)
// 2. Hard-deletes user from Supabase Auth
// 3. Writes audit row to data_access_log (legally required to log deletion event)
//
// Retention exceptions (NOT deleted — legal hold):
//   - invoices (10 years per § 147 AO — accounting law)
//   - abrechnung (10 years per § 304 SGB V — health insurance billing)
// These are anonymized (PII stripped, IDs kept) rather than purged.

import { getAuthedUser, adminFetch, adminAuthFetch, json } from '../_lib/auth.js';
import { stripeRequest } from '../_lib/stripe.js';

// Tables to anonymize (legal retention) — set personal fields to NULL, keep row for audit
// invoices: 10y retention (§ 147 AO) — strip patient PII, keep IDs/amounts for audit.
// abrechnung: 10y retention (§ 304 SGB V) — no PII columns directly; patient data lives in
// linked prescriptions which are hard-deleted below. abrechnung row itself stays untouched
// for audit (only contains owner_id + amounts + file paths).
const ANONYMIZE_TABLES = [
  { table: 'invoices',    filter: 'owner_id', nullify: ['patient_name', 'patient_id', 'notes'] },
];

// Tables to hard-delete
const DELETE_TABLES = [
  'consent_log',
  'ai_audit_log',
  'chatbot_usage',
  'feedbacks',
  'email_logs',
  'patient_notes',
  'anamnese',
  'prescription_validations',
  'prescription_sessions',
  'prescriptions',
  'zuzahlung_befreiung',
  'referral_drafts',
  'ueberweisungen',
  'aerzte',
  'b2b_contacts',
  'leads',
  'fahrten',
  'vehicles',
  'terapeut_zertifikat',
  'bookings',
  'time_offs',
  'breaks',
  'custom_days',
  'working_hours',
  'employee_services',
  'business_services',
  'services',
  'calendar_integrations',
  'employee_business_assignments',
  'employee_groups',
  'businesses',
  'user_preferences',
];

export default async function handler(req, res) {
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

  const log = { user_id: userId, started_at: new Date().toISOString(), steps: [] };

  // 0. Stripe cleanup (DSGVO Art. 17 — cancel subscription + delete customer)
  //    Run BEFORE Supabase deletes so we can still read stripe IDs from profiles.
  //    Stripe errors must NOT block the deletion — warn and continue.
  {
    const { ok: profOk, data: profData } = await adminFetch(
      `/profiles?id=eq.${encodeURIComponent(userId)}&select=stripe_subscription_id,stripe_customer_id`,
      { method: 'GET' }
    );

    if (profOk && Array.isArray(profData) && profData.length > 0) {
      const { stripe_subscription_id, stripe_customer_id } = profData[0];

      if (stripe_subscription_id) {
        try {
          const { ok, status } = await stripeRequest(
            `/subscriptions/${stripe_subscription_id}`,
            { method: 'DELETE' }
          );
          log.steps.push({ step: 'stripe:cancel_subscription', ok, status });
        } catch (err) {
          console.warn('[dsgvo/delete] Stripe subscription cancel failed:', err.message);
          log.steps.push({ step: 'stripe:cancel_subscription', ok: false, error: err.message });
        }
      }

      if (stripe_customer_id) {
        try {
          const { ok, status } = await stripeRequest(
            `/customers/${stripe_customer_id}`,
            { method: 'DELETE' }
          );
          log.steps.push({ step: 'stripe:delete_customer', ok, status });
        } catch (err) {
          console.warn('[dsgvo/delete] Stripe customer delete failed:', err.message);
          log.steps.push({ step: 'stripe:delete_customer', ok: false, error: err.message });
        }
      }
    } else {
      log.steps.push({ step: 'stripe:profile_fetch', ok: profOk, note: 'no profile row or no stripe IDs' });
    }
  }

  // 1. Anonymize retention-protected tables
  for (const { table, filter, nullify } of ANONYMIZE_TABLES) {
    const patch = nullify.reduce((acc, col) => ({ ...acc, [col]: null }), {});
    const { ok, status } = await adminFetch(
      `/${table}?${filter}=eq.${encodeURIComponent(userId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    );
    log.steps.push({ step: `anonymize:${table}`, ok, status });
  }

  // 2. Hard-delete user-owned rows
  for (const table of DELETE_TABLES) {
    // try both owner_id and user_id — table schema varies
    for (const filter of ['owner_id', 'user_id']) {
      const { ok, status } = await adminFetch(
        `/${table}?${filter}=eq.${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      );
      if (ok && status !== 404) {
        log.steps.push({ step: `delete:${table}:${filter}`, ok, status });
        break;
      }
    }
  }

  // 3. Delete profile (last — child FKs already cleared)
  const { ok: pOk, status: pStatus } = await adminFetch(
    `/profiles?id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );
  log.steps.push({ step: 'delete:profiles', ok: pOk, status: pStatus });

  // 4. Delete from Supabase Auth
  const { ok: aOk, status: aStatus } = await adminAuthFetch(
    `/admin/users/${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );
  log.steps.push({ step: 'delete:auth_user', ok: aOk, status: aStatus });

  log.completed_at = new Date().toISOString();

  // 5. Audit row (legally required to log the deletion event itself)
  await adminFetch('/data_access_log', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      owner_id: userId,
      action: 'dsgvo_deletion',
      resource: 'profile',
      resource_id: userId,
      metadata: log,
    }),
  });

  return json(res, 200, {
    success: true,
    message: 'Ihre Daten wurden gelöscht. Abrechnungsdaten bleiben anonymisiert aus gesetzlicher Aufbewahrungspflicht (§ 147 AO, § 304 SGB V) gespeichert.',
    log,
  });
}
