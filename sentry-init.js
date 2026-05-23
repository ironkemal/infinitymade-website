// Sentry frontend init — runs after loader script (js-de.sentry-cdn.com)
// pulls the SDK. DSN is baked into the loader URL; this file only configures
// behavior (environment, sample rates, PII scrubbing).
//
// Include AFTER the loader script:
//   <script src="https://js-de.sentry-cdn.com/.../...min.js" crossorigin="anonymous"></script>
//   <script src="/sentry-init.js?v=20260523b"></script>

(function () {
  if (typeof window === 'undefined' || !window.Sentry || !window.Sentry.onLoad) {
    // Loader missing — fail silent (don't break page if Sentry blocked by ad-blocker etc.)
    return;
  }

  // Heuristic: anything on apex domain or *.infinitymade.de is production;
  // localhost / vercel preview / 127.x is test.
  var host = window.location.hostname;
  var isProd = /(?:^|\.)infinitymade\.de$/.test(host) && !host.startsWith('preview-');
  var environment = isProd ? 'production' : 'test';

  // PII patterns to scrub from event payloads (mirrors backend access-log redactor).
  var PII_PATTERNS = [
    { re: /\b[A-Z]\d{9}\b/g, sub: '[KVNR_REDACTED]' },          // KVNR
    { re: /\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b/g, sub: '[IBAN_REDACTED]' },
    { re: /\b[A-Z]\d{2}\.\d{1,2}[A-Z]?\b/g, sub: '[ICD_REDACTED]' },
  ];

  function scrubString(s) {
    if (typeof s !== 'string') return s;
    var out = s;
    for (var i = 0; i < PII_PATTERNS.length; i++) {
      out = out.replace(PII_PATTERNS[i].re, PII_PATTERNS[i].sub);
    }
    return out;
  }

  function deepScrub(obj, depth) {
    if (depth > 5 || obj == null) return obj;
    if (typeof obj === 'string') return scrubString(obj);
    if (Array.isArray(obj)) return obj.map(function (x) { return deepScrub(x, depth + 1); });
    if (typeof obj === 'object') {
      var out = {};
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          out[k] = deepScrub(obj[k], depth + 1);
        }
      }
      return out;
    }
    return obj;
  }

  window.Sentry.onLoad(function () {
    window.Sentry.init({
      environment: environment,

      // Performance tracing disabled — the lightweight CDN loader doesn't ship
      // the tracing bundle. We only need error tracking; if performance traces
      // become useful later, enable "Performance Monitoring" in Sentry dashboard
      // → Settings → Loader Script (swaps to the heavier bundle), then add
      // tracesSampleRate back here.

      // Don't capture user input from forms (could contain KVNR, names, diagnose text).
      // We re-enable per-form only where safe.
      sendDefaultPii: false,

      // Ignore noisy / actionless errors.
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        // Stripe.js network probes on slow connections
        /Failed to fetch.*stripe/i,
      ],

      // Strip PII from anything that bubbles up.
      beforeSend: function (event) {
        try {
          if (event.message)            event.message            = scrubString(event.message);
          if (event.exception)          event.exception          = deepScrub(event.exception, 0);
          if (event.breadcrumbs)        event.breadcrumbs        = deepScrub(event.breadcrumbs, 0);
          if (event.request && event.request.data) {
            event.request.data = deepScrub(event.request.data, 0);
          }
          // Never send user email (only id — enough to debug, no PII)
          if (event.user) {
            delete event.user.email;
            delete event.user.username;
          }
        } catch (e) { /* never let scrubbing crash the SDK */ }
        return event;
      },

      // Same scrubbing for breadcrumbs (e.g. fetch URLs with KVNR in query string)
      beforeBreadcrumb: function (crumb) {
        try {
          if (crumb.message) crumb.message = scrubString(crumb.message);
          if (crumb.data)    crumb.data    = deepScrub(crumb.data, 0);
        } catch (e) {}
        return crumb;
      },
    });

    // Attach current Supabase user id (if available) — id only, no email/name.
    try {
      var raw = localStorage.getItem('infinitymade-auth');
      if (raw) {
        var parsed = JSON.parse(raw);
        var uid = parsed && parsed.user && parsed.user.id;
        if (uid) window.Sentry.setUser({ id: uid });
      }
    } catch (e) {}
  });
})();
