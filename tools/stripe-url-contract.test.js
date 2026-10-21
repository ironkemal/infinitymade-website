import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Every invocation gets a fresh module graph and only synthetic environment values.
// Actual handlers, telemetry wrapper, auth helpers and Stripe form encoding run unchanged.
async function exerciseHandler() {
  const { flow, checkoutModule, portalModule } = JSON.parse(process.argv[1]);
  const assert = (await import('node:assert/strict')).default;
  const calls = [];
  const unexpected = [];
  const expected = [];
  const user = { id: 'user_synthetic', email: 'user@example.invalid' };
  const customerId = flow === 'auth-new' || flow === 'pending' ? 'cus_created' : 'cus_existing';
  const responseUrl = 'https://stripe.example.invalid/session';
  const pendingId = 'pending_synthetic';
  const profilePath = flow === 'portal'
    ? '/profiles?id=eq.user_synthetic&select=stripe_customer_id'
    : '/profiles?id=eq.user_synthetic&select=email,stripe_customer_id';
  const enqueue = (url, method, data) => expected.push({ url, method, data });
  const rest = path => `https://supabase.example.invalid/rest/v1${path}`;

  if (flow === 'pending') {
    enqueue(rest(`/pending_signups?id=eq.${pendingId}&select=*`), 'GET', [{
      id: pendingId, email: user.email, created_at: new Date().toISOString(),
      onboarding_data: { business_name: 'Synthetic Praxis' }, stripe_checkout_session_id: null,
    }]);
  } else {
    enqueue('https://supabase.example.invalid/auth/v1/user', 'GET', user);
    enqueue(rest(profilePath), 'GET', [{ email: user.email,
      stripe_customer_id: flow === 'auth-new' ? null : customerId }]);
  }
  if (flow === 'auth-new' || flow === 'pending') {
    enqueue('https://api.stripe.com/v1/customers', 'POST', { id: customerId });
    if (flow === 'auth-new') enqueue(rest('/profiles?id=eq.user_synthetic'), 'PATCH', []);
  }
  const stripePath = flow === 'portal' ? '/billing_portal/sessions' : '/checkout/sessions';
  enqueue(`https://api.stripe.com/v1${stripePath}`, 'POST', { id: 'cs_synthetic', url: responseUrl });
  if (flow === 'pending') enqueue(rest(`/pending_signups?id=eq.${pendingId}`), 'PATCH', []);

  globalThis.fetch = async (url, init = {}) => {
    const call = { url, method: init.method || 'GET', headers: init.headers, body: init.body };
    calls.push(call);
    const next = expected.shift();
    if (!next || url !== next.url || call.method !== next.method) {
      unexpected.push({ url, method: call.method });
      throw new Error('Unexpected network call blocked');
    }
    if (url.startsWith('https://api.stripe.com/')) {
      assert.equal(init.headers.Authorization, 'Bearer sk_test_synthetic_not_a_key');
      assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
    } else {
      const auth = url.endsWith('/auth/v1/user');
      assert.equal(init.headers.Authorization, auth ? 'Bearer jwt_synthetic' : 'Bearer service_synthetic');
      assert.equal(init.headers.apikey, auth ? 'anon_synthetic' : 'service_synthetic');
    }
    return new Response(JSON.stringify(next.data), { status: 200 });
  };
  const { default: handler } = await import(flow === 'portal' ? portalModule : checkoutModule);
  const res = { statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); this.writableEnded = true; },
  };
  await handler({ method: 'POST',
    headers: flow === 'pending' ? {} : { authorization: 'Bearer jwt_synthetic' },
    body: { planSlug: 'starter', interval: 'month',
      ...(flow === 'pending' ? { pending_id: pendingId } : {}),
      ...(flow === 'reactivate' ? { reactivate: true } : {}),
    },
  }, res);
  assert.deepEqual(unexpected, [], 'unknown fetches must fail even if handler catches errors');
  assert.equal(expected.length, 0, 'all expected calls consumed');
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(res.body, flow === 'portal' ? { url: responseUrl }
    : { url: responseUrl, sessionId: 'cs_synthetic' });
  const session = calls.find(call => call.url === `https://api.stripe.com/v1${stripePath}`);
  const form = Object.fromEntries(new URLSearchParams(session.body));
  assert.equal(form.customer, customerId);
  if (flow !== 'portal') {
    const identity = flow === 'pending' ? 'pending_id' : 'user_id';
    const id = flow === 'pending' ? pendingId : user.id;
    assert.equal(form.mode, 'subscription');
    assert.equal(form['line_items[0][price]'], 'price_synthetic');
    assert.equal(form['line_items[0][quantity]'], '1');
    for (const prefix of ['metadata', 'subscription_data[metadata]']) {
      assert.equal(form[`${prefix}[${identity}]`], id);
      assert.equal(form[`${prefix}[plan_slug]`], 'starter');
      assert.equal(form[`${prefix}[interval]`], 'month');
    }
    assert.equal(form['subscription_data[trial_period_days]'], flow === 'reactivate' ? undefined : '14');
    assert.equal(form.allow_promotion_codes, 'true');
    assert.equal(form.billing_address_collection, 'required');
    assert.equal(form['automatic_tax[enabled]'], 'false');
    assert.equal(session.headers['Idempotency-Key'],
      `checkout_${flow === 'pending' ? 'pending' : 'user'}_${id}_starter_month${flow === 'reactivate' ? '_reactivate' : ''}`);
  }
  const customer = calls.find(call => call.url === 'https://api.stripe.com/v1/customers');
  if (customer) {
    const customerForm = Object.fromEntries(new URLSearchParams(customer.body));
    assert.equal(customerForm.email, user.email);
    assert.equal(customerForm[`metadata[${flow === 'pending' ? 'pending_id' : 'user_id'}]`],
      flow === 'pending' ? pendingId : user.id);
    assert.equal(customer.headers['Idempotency-Key'], flow === 'pending'
      ? `cust_pending_${pendingId}` : `cust_user_${user.id}`);
    if (flow === 'pending') assert.equal(customerForm.name, 'Synthetic Praxis');
  }
  const patch = calls.find(call => call.method === 'PATCH');
  if (flow === 'auth-new') assert.deepEqual(JSON.parse(patch.body), { stripe_customer_id: customerId });
  if (flow === 'pending') assert.deepEqual(JSON.parse(patch.body), { stripe_checkout_session_id: 'cs_synthetic' });
  process.stdout.write(JSON.stringify(form));
}

function runFlow(flow, base) {
  // No inherited secrets, env files, NODE_OPTIONS/preloads, or telemetry transport.
  // Parent process.env is never mutated; child environment disappears on exit.
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.invalid',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon_synthetic',
    SUPABASE_SERVICE_ROLE_KEY: 'service_synthetic',
    STRIPE_SECRET_KEY: 'sk_test_synthetic_not_a_key',
    STRIPE_PRICE_STARTER_MONTHLY: 'price_synthetic',
    SENTRY_SERVERLESS_ENABLED: '0',
    ...(base === undefined ? {} : { NEXT_PUBLIC_URL: base }),
  };
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
    `(${exerciseHandler.toString()})()`, JSON.stringify({ flow,
      checkoutModule: new URL('../api/stripe/create-checkout-session.js', import.meta.url).href,
      portalModule: new URL('../api/stripe/portal-session.js', import.meta.url).href,
    })], { env, encoding: 'utf8', timeout: 10000 }));
}

const cases = [
  ['unset', undefined, 'https://app.praxura.de'],
  ['empty', '', 'https://app.praxura.de'],
  ['explicit canonical', 'https://app.praxura.de', 'https://app.praxura.de'],
  ['trailing slash', 'https://app.praxura.de/', 'https://app.praxura.de'],
  ['repeated trailing slashes', 'https://app.praxura.de///', 'https://app.praxura.de'],
  ['custom base', 'http://local.example.invalid:8080/praxura', 'http://local.example.invalid:8080/praxura'],
  ['custom base trailing slash', 'http://local.example.invalid:8080/praxura/', 'http://local.example.invalid:8080/praxura'],
];
for (const [label, configured, base] of cases) {
  for (const flow of ['portal', 'auth-existing', 'auth-new', 'pending', 'reactivate']) {
    test(`${flow}: ${label} emits exact Stripe redirect URLs`, () => {
      const form = runFlow(flow, configured);
      if (flow === 'portal') {
        assert.equal(form.return_url, `${base}/dashboard.html?tab=settings`);
      } else if (flow === 'pending') {
        assert.equal(form.success_url, `${base}/onboarding-success.html?session_id={CHECKOUT_SESSION_ID}`);
        assert.equal(form.cancel_url, `${base}/onboarding.html?step=plan&canceled=1`);
      } else {
        assert.equal(form.success_url, `${base}/dashboard.html?welcome=1&session_id={CHECKOUT_SESSION_ID}`);
        assert.equal(form.cancel_url, `${base}/dashboard.html`);
      }
    });
  }
}

test('wrong marketing origin: config passthrough characterization, NOT deployment/operator verification', () => {
  // Existing host/protocol policy is unchanged. Actual operator config remains unverified;
  // configuring the marketing origin is an operator blocker, not an acceptable deployment.
  for (const flow of ['portal', 'auth-existing', 'pending']) {
    const form = runFlow(flow, 'https://praxura.de');
    const key = flow === 'portal' ? 'return_url' : 'success_url';
    assert.equal(new URL(form[key]).origin, 'https://praxura.de');
  }
});

test('publicBaseUrl: Whitespace/Slashes bereinigt, ungültige Werte fallen auf Standard', async () => {
  const { publicBaseUrl } = await import('../api/_lib/stripe.js');
  assert.equal(publicBaseUrl('  https://app.praxura.de//\n'), 'https://app.praxura.de');
  assert.equal(publicBaseUrl('https://example.invalid/x/'), 'https://example.invalid/x');
  assert.equal(publicBaseUrl(''), 'https://app.praxura.de');
  assert.equal(publicBaseUrl(undefined), 'https://app.praxura.de');
  assert.equal(publicBaseUrl('app.praxura.de'), 'https://app.praxura.de');
  assert.equal(publicBaseUrl('javascript:alert(1)'), 'https://app.praxura.de');
});
