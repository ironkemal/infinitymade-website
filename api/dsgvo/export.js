// GET /api/dsgvo/export
// DSGVO Art. 15 (Recht auf Auskunft) — exports all personal data of the authenticated user
// as a single JSON. User authenticates via Authorization: Bearer <JWT>.
//
// Response: { generated_at, user_id, data: { table_name: [rows...] } }

import { getAuthedUser, adminFetch, json } from '../_lib/auth.js';

// Tables linked to a user. Filter column → user-id source.
// 'owner_id' = profiles.id (for owner-scoped rows like patients/bookings)
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

export default async function handler(req, res) {
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
      // Column may not exist on every table — soft-fail per table, don't kill export
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
    note: 'Vollständige Kopie der zu Ihrer Person gespeicherten Daten. Bei Fragen: support@infinitymade.de',
    auth: auth_meta,
    data,
    errors_per_table: Object.keys(errors).length ? errors : undefined,
  };

  res.setHeader('Content-Disposition', `attachment; filename="dsgvo-export-${userId}.json"`);
  return json(res, 200, payload);
}
