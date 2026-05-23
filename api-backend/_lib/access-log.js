// Access audit log — writes to data_access_log table for DSGVO Art. 32 compliance.
//
// Usage:
//   import { logAccess, accessLogger } from './_lib/access-log.js';
//
//   // 1. Auto middleware (logs every authenticated request to /api/*)
//   app.use('/api', accessLogger(supabase, {
//     resourceMap: { '/api/booking': 'booking', '/api/billing': 'abrechnung' }
//   }));
//
//   // 2. Explicit call for sensitive ops
//   await logAccess(supabase, {
//     userId, ownerId, resource: 'prescription', resourceId: rxId,
//     action: 'export', method: 'GET', path: req.path, ip: req.ip,
//   });
//
// Writes are fire-and-forget — errors logged to console, never block the request.
// Service role bypasses RLS so all inserts succeed regardless of caller identity.

const PII_REDACT = [
  // KVNR: 1 letter + 9 digits
  { re: /\b[A-Z]\d{9}\b/g, sub: '[KVNR_REDACTED]' },
  // ICD-10: letter + 2 digits + optional .digit
  { re: /\b[A-Z]\d{2}(\.\d{1,2}[A-Z]?)?\b/g, sub: '[ICD_REDACTED]' },
  // IBAN
  { re: /\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b/g, sub: '[IBAN_REDACTED]' },
];

function redactString(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const { re, sub } of PII_REDACT) out = out.replace(re, sub);
  return out;
}

// Resource resolution from path. Override via accessLogger({ resourceMap })
const DEFAULT_RESOURCE_MAP = [
  [/^\/api\/booking/,        'booking'],
  [/^\/api\/billing\/abrech/, 'abrechnung'],
  [/^\/api\/billing/,         'billing'],
  [/^\/api\/ai\//,            'ai'],
  [/^\/api\/calendar/,        'calendar'],
  [/^\/api\/verify-code/,     'auth'],
  [/^\/api\/team/,            'employee'],
];

function inferResource(path, custom) {
  if (custom) {
    for (const [re, name] of custom) {
      if (re.test(path)) return name;
    }
  }
  for (const [re, name] of DEFAULT_RESOURCE_MAP) {
    if (re.test(path)) return name;
  }
  return null;
}

function inferAction(method) {
  switch ((method || '').toUpperCase()) {
    case 'GET': return 'read';
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'other';
  }
}

// Fire-and-forget. Errors are swallowed but logged so audit failure
// never blocks the user request.
export async function logAccess(supabase, entry) {
  try {
    const row = {
      user_id:     entry.userId || null,
      owner_id:    entry.ownerId || null,
      business_id: entry.businessId || null,
      ip:          entry.ip || null,
      user_agent:  entry.userAgent ? entry.userAgent.slice(0, 500) : null,
      method:      entry.method || 'GET',
      path:        entry.path ? entry.path.slice(0, 500) : '',
      resource:    entry.resource || null,
      resource_id: entry.resourceId ? String(entry.resourceId).slice(0, 100) : null,
      action:      entry.action || inferAction(entry.method),
      status_code: entry.statusCode || null,
      duration_ms: entry.durationMs || null,
      metadata:    entry.metadata || null,
    };
    const { error } = await supabase.from('data_access_log').insert(row);
    if (error) console.error('[access-log] insert failed:', error.message);
  } catch (e) {
    console.error('[access-log] exception:', e.message);
  }
}

// Express middleware: logs every request that has an authenticated user.
// Skips: /health, OPTIONS preflight, anonymous booking endpoints (those use
// explicit logAccess from their handler with the resource owner_id).
export function accessLogger(supabase, opts = {}) {
  const { resourceMap, skipPaths = ['/health', '/api/booking/get-slots', '/api/booking/create'] } = opts;
  const resourceMapEntries = resourceMap ? Object.entries(resourceMap).map(([k, v]) => [new RegExp('^' + k), v]) : null;

  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    if (skipPaths.some(p => req.path === p || req.path.startsWith(p))) return next();

    const t0 = Date.now();
    res.on('finish', () => {
      // Best-effort: assumes upstream auth middleware set req.user / req.ownerId.
      const userId = req.user?.id || req.userId || null;
      if (!userId) return;  // skip anonymous (handled by explicit calls)

      logAccess(supabase, {
        userId,
        ownerId:    req.ownerId || userId,
        businessId: req.businessId || null,
        ip:         req.ip,
        userAgent:  req.headers['user-agent'],
        method:     req.method,
        path:       req.path,
        resource:   inferResource(req.path, resourceMapEntries),
        statusCode: res.statusCode,
        durationMs: Date.now() - t0,
      });
    });
    next();
  };
}

export { redactString };
