/**
 * Billing auth error classification (2026-10-22).
 * Intent: deny access before profile/tenant/business reads while distinguishing
 * rejected credentials from unavailable authentication infrastructure.
 * First consumers: abrechnung.routes.js returned-auth-error JSON branches,
 * including positions, Podologie positions and mandantUndAbrechnung.
 * Unknown errors/null users retain existing 401 contract. No refresh or bypass.
 * Only fixed AUTH_UNAVAILABLE diagnostic leaves this boundary; never serialize
 * SDK message, body, headers or arbitrary code. No live-401 root-cause claim.
 * Legacy print/export guards can supply their existing 401 text contract.
 * SDK-internal logging is unchanged; this helper adds no logs.
 */
export async function authTransportFetch(input, options) {
  const response = await globalThis.fetch(input, options);
  const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  // auth-js may discard a 500 status when an upstream HTML/malformed body
  // cannot be parsed. Normalize only Auth GET /user infrastructure errors,
  // before SDK parsing; never touch successful users, token rejection or DB HTTP.
  const method = options?.method || input?.method || 'GET';
  if (method === 'GET' && target.pathname.endsWith('/auth/v1/user')
    && (response.status === 408 || response.status === 429 || response.status >= 500)) {
    await response.body?.cancel().catch(() => {});
    return new Response(JSON.stringify({ message: 'Authentication service unavailable' }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return response;
}

export function authFehlerAntwort(res, error, rejectedText) {
  // Same allowlisted marker/name contract as auth-js isAuthRetryableFetchError;
  // dependency-free so createClient-only router injection remains supported.
  const unavailable = (error?.__isAuthError === true && error.name === 'AuthRetryableFetchError')
    || error instanceof TypeError
    || error?.status === 408 || error?.status === 429
    || (typeof error?.status === 'number' && error.status >= 500 && error.status <= 599);
  const unavailableText = 'Authentifizierungsdienst vorübergehend nicht verfügbar. Bitte später erneut versuchen.';
  if (rejectedText !== undefined) {
    return res.status(unavailable ? 503 : 401).send(unavailable ? unavailableText : rejectedText);
  }
  if (unavailable) {
    return res.status(503).json({
      error: unavailableText,
      code: 'AUTH_UNAVAILABLE',
    });
  }
  return res.status(401).json({ error: 'Invalid token' });
}
