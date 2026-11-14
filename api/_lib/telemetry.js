// Ops #33: ausschließlich technische Positivliste, kein globales Sentry.init().
// Ohne BEIDE Einstellungen weder SDK-Initialisierung noch Transport.
const ROUTES = new Set(['contact', 'demo-booking', 'config', 'admin/data', 'admin/feedbacks',
  'apify/search', 'onboarding/pending', 'onboarding/check-email', 'stripe/webhook',
  'stripe/portal-session', 'stripe/create-checkout-session']);
const CODES = new Set(['handled_5xx', 'unhandled']);

/**
 * @param {any} event
 * @returns {{ message: string, level: 'error', tags: { route: string, code: string, status: string }, event_id?: string, release?: string } | null}
 */
export function safeTelemetryEvent(event) {
  if (!event || !ROUTES.has(event.tags?.route) || !CODES.has(event.tags?.code)) return null;
  const status = Number(event.tags.status);
  if (!Number.isInteger(status) || status < 500 || status > 599) return null;
  /** @type {{ message: string, level: 'error', tags: { route: string, code: string, status: string }, event_id?: string, release?: string }} */
  const safe = { message: 'serverless.request.failed', level: 'error',
    tags: { route: event.tags.route, code: event.tags.code, status: String(status) } };
  if (/^[a-f0-9]{32}$/i.test(event.event_id || '')) safe.event_id = event.event_id;
  if (/^[a-f0-9]{40}$/i.test(event.release || '')) safe.release = event.release;
  return safe;
}

/** @param {string | undefined} value */
function validDsn(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^o\d+\.ingest\.de\.sentry\.io$/.test(url.hostname)
      && /^[a-f0-9]{32}$/i.test(url.username) && !url.password && !url.port
      && /^\/\d+$/.test(url.pathname) && !url.search && !url.hash;
  } catch { return false; }
}

/**
 * @param {{ env?: Record<string, string | undefined>, loadSdk?: () => Promise<any>, transport?: (options: any) => any }} [opts]
 */
export function createTelemetryReporter({ env = process.env, loadSdk = () => import('@sentry/node'), transport } = {}) {
  /** @type {Promise<{ client: any, sdk: any }> | undefined} */
  let sdkClient;
  /**
   * @param {string} route
   * @param {string} code
   * @param {number} status
   */
  return async function report(route, code, status) {
    try {
      if (env.SENTRY_SERVERLESS_ENABLED !== '1' || !validDsn(env.SENTRY_DSN_SERVERLESS)) return;
      const event = safeTelemetryEvent({ tags: { route, code, status }, release: env.VERCEL_GIT_COMMIT_SHA });
      if (!event) return;
      sdkClient ||= (async () => {
        const sdk = await loadSdk();
        const client = new sdk.NodeClient({
          dsn: env.SENTRY_DSN_SERVERLESS,
          transport: (/** @type {any} */ options) => {
            const target = (transport || sdk.makeNodeTransport)(options);
            return {
              // Das SDK kann nach beforeSend zusätzliche Envelope-Items aus
              // anderen Scopes ergänzen. Deshalb gilt die Grenze am Transport.
              send: (/** @type {any[]} */ envelope) => {
                const item = envelope[1]?.find((/** @type {any[]} */ [header]) => header.type === 'event');
                const safe = item && safeTelemetryEvent(item[1]);
                if (!safe) return Promise.resolve({ statusCode: 200 });
                return target.send([
                  { event_id: safe.event_id, sent_at: new Date().toISOString() },
                  [[{ type: 'event' }, safe]],
                ]);
              },
              flush: (/** @type {number | undefined} */ timeout) => target.flush(timeout),
            };
          },
          stackParser: () => [],
          integrations: [],
          defaultIntegrations: false,
          sendDefaultPii: false,
          tracesSampleRate: 0,
          autoSessionTracking: false,
          sendClientReports: false,
          beforeSend: safeTelemetryEvent,
          beforeBreadcrumb: () => null,
        });
        client.init();
        return { client, sdk };
      })();
      const { client, sdk } = await sdkClient;
      const scope = new sdk.Scope();
      scope.setClient(client);
      scope.captureEvent(event);
      await client.flush(500);
    } catch { /* Diagnose darf den eigentlichen Handler niemals beschädigen. */ }
  };
}

const report = createTelemetryReporter();

/**
 * @param {string} route
 * @param {(req: import('./auth.js').VercelRequest, res: import('./auth.js').VercelResponse) => any} handler
 * @param {(route: string, code: string, status: number) => Promise<void>} [reporter]
 */
export function withServerlessTelemetry(route, handler, reporter = report) {
  if (!ROUTES.has(route)) throw new TypeError('Unbekannter Telemetriepfad');
  /**
   * @param {import('./auth.js').VercelRequest} req
   * @param {import('./auth.js').VercelResponse} res
   */
  return async function observedHandler(req, res) {
    try {
      const result = await handler(req, res);
      if (res.statusCode >= 500 && res.statusCode <= 599) {
        try { await reporter(route, 'handled_5xx', res.statusCode); } catch { /* fail-safe */ }
      }
      return result;
    } catch (err) {
      // Nur Route und Fehlername: ohne Sentry sonst kein Spur in den Vercel-Logs, Meldungstext kann PII tragen.
      console.error('[telemetry] unhandled', route, err && typeof err === 'object' && 'name' in err ? err.name : undefined);
      try { await reporter(route, 'unhandled', 500); } catch { /* fail-safe */ }
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ error: 'Anfrage konnte nicht verarbeitet werden.' }));
      } else if (!res.writableEnded) res.end();
    }
  };
}
