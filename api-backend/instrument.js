// Sentry init for the Express backend (calendar-api).
//
// IMPORTANT: This file MUST be the very first import in server.js — Sentry
// auto-instruments libraries (Express, HTTP, postgres) by patching `require`/
// dynamic-import hooks, so anything loaded before Sentry won't be traced.
//
// DSGVO note: we set sendDefaultPii=false to keep IPs and user-agent strings
// out of Sentry by default. The beforeSend hook additionally scrubs:
//   - KVNR (1 letter + 9 digits)
//   - IBAN (DE-format)
//   - ICD-10 codes (could leak in error messages)
// Errors continue to flow; only the PII substrings get redacted.

import * as Sentry from '@sentry/node';

const DSN = process.env.SENTRY_DSN_BACKEND || '';
const ENV = process.env.SENTRY_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'test');

if (!DSN) {
  console.log('[sentry] SENTRY_DSN_BACKEND not set — error tracking disabled');
} else {
  const PII_PATTERNS = [
    { re: /\b[A-Z]\d{9}\b/g, sub: '[KVNR_REDACTED]' },
    { re: /\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b/g, sub: '[IBAN_REDACTED]' },
    { re: /\b[A-Z]\d{2}\.\d{1,2}[A-Z]?\b/g, sub: '[ICD_REDACTED]' },
  ];

  const scrubString = (s) => {
    if (typeof s !== 'string') return s;
    let out = s;
    for (const { re, sub } of PII_PATTERNS) out = out.replace(re, sub);
    return out;
  };

  const deepScrub = (obj, depth = 0) => {
    if (depth > 5 || obj == null) return obj;
    if (typeof obj === 'string') return scrubString(obj);
    if (Array.isArray(obj)) return obj.map(x => deepScrub(x, depth + 1));
    if (typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) out[k] = deepScrub(obj[k], depth + 1);
      return out;
    }
    return obj;
  };

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    serverName: process.env.SENTRY_SERVER_NAME || 'calendar-api',

    // Test phase: capture everything. Production: %20 traces sample.
    tracesSampleRate: ENV === 'production' ? 0.2 : 1.0,

    // GDPR: don't auto-collect IP and user-agent — we add only what we need
    // via Sentry.setUser({ id }) downstream.
    sendDefaultPii: false,

    // Drop noisy / non-actionable errors.
    ignoreErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'AbortError',
    ],

    beforeSend(event, hint) {
      try {
        if (event.message)            event.message            = scrubString(event.message);
        if (event.exception)          event.exception          = deepScrub(event.exception);
        if (event.breadcrumbs)        event.breadcrumbs        = deepScrub(event.breadcrumbs);
        if (event.request) {
          if (event.request.data)    event.request.data        = deepScrub(event.request.data);
          // Strip headers that might carry tokens / patient context
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
            delete event.request.headers['x-supabase-auth'];
          }
          // Strip query strings that might contain KVNR/email
          if (event.request.query_string) {
            event.request.query_string = scrubString(event.request.query_string);
          }
        }
        if (event.user) {
          delete event.user.email;
          delete event.user.username;
          delete event.user.ip_address;
        }
      } catch (_) { /* never let scrubbing crash the SDK */ }
      return event;
    },

    beforeBreadcrumb(crumb) {
      try {
        if (crumb.message) crumb.message = scrubString(crumb.message);
        if (crumb.data)    crumb.data    = deepScrub(crumb.data);
      } catch (_) {}
      return crumb;
    },
  });

  console.log(`[sentry] initialized for ${ENV} (${process.env.SENTRY_SERVER_NAME || 'calendar-api'})`);
}

export { Sentry };
