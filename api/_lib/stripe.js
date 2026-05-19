// Minimal Stripe client using fetch (no SDK dependency).
// Stripe API is form-encoded for POSTs, Bearer-auth via secret key.

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_API = 'https://api.stripe.com/v1';

if (!STRIPE_KEY) console.warn('[stripe] STRIPE_SECRET_KEY is not set');

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') flatten(item, `${key}[${i}]`, out);
        else out[`${key}[${i}]`] = String(item);
      });
    } else if (typeof v === 'object') {
      flatten(v, key, out);
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

function formEncode(params) {
  const flat = flatten(params);
  return new URLSearchParams(flat).toString();
}

export async function stripeRequest(path, { method = 'GET', body, query, idempotencyKey } = {}) {
  let url = `${STRIPE_API}${path}`;
  if (query) url += '?' + formEncode(query);

  const headers = {
    Authorization: `Bearer ${STRIPE_KEY}`,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const init = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = formEncode(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Verify Stripe webhook signature using built-in crypto.
 * Returns parsed event on success, throws on mismatch.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhook(rawBody, signatureHeader, secret) {
  if (!signatureHeader) throw new Error('Missing stripe-signature header');
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => {
      const [k, ...rest] = p.split('=');
      return [k, rest.join('=')];
    })
  );
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) throw new Error('Invalid stripe-signature');

  // 5 minute tolerance against replay attacks
  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (Math.abs(ageSeconds) > 300) throw new Error('Webhook timestamp too old');

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Signature mismatch');
  }
  return JSON.parse(rawBody);
}

// Plan/addon slug → env var name for price ID
export function priceIdFor(planSlug, interval) {
  const map = {
    starter:      { month: 'STRIPE_PRICE_STARTER_MONTHLY',      year: 'STRIPE_PRICE_STARTER_YEARLY' },
    professional: { month: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY', year: 'STRIPE_PRICE_PROFESSIONAL_YEARLY' },
    klinik:       { month: 'STRIPE_PRICE_KLINIK_MONTHLY',       year: 'STRIPE_PRICE_KLINIK_YEARLY' },
    dta_pro:      { month: 'STRIPE_PRICE_DTA_PRO_MONTHLY',      year: 'STRIPE_PRICE_DTA_PRO_YEARLY' },
  };
  const envVar = map[planSlug]?.[interval];
  return envVar ? process.env[envVar] : null;
}

// All currently-configured DTA-Pro price IDs (monthly + yearly).
// Used by the webhook to detect whether a subscription contains the addon.
export function dtaProPriceIds() {
  return [
    process.env.STRIPE_PRICE_DTA_PRO_MONTHLY,
    process.env.STRIPE_PRICE_DTA_PRO_YEARLY,
  ].filter(Boolean);
}
