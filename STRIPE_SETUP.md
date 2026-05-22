# Stripe Setup — Required ENV vars

Set these in **Vercel → Project Settings → Environment Variables** before testing checkout.

## 1) Stripe API keys

| Variable | Value | Where |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` (TEST first!) | https://dashboard.stripe.com/test/apikeys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | After creating webhook endpoint (step 3) |
| `NEXT_PUBLIC_URL` | `https://infinitymade.de` | Used in checkout redirects |

## 2) Create products & prices in Stripe Dashboard

Go to https://dashboard.stripe.com/test/products and create 3 products:

### Product: Starter
- Add 2 prices:
  - €29 / month → copy price ID → set ENV `STRIPE_PRICE_STARTER_MONTHLY`
  - €25 / month, billed yearly (€300/year) → set ENV `STRIPE_PRICE_STARTER_YEARLY`

### Product: Professional
- €49 / month → `STRIPE_PRICE_PROFESSIONAL_MONTHLY`
- €42 / month yearly (€504/year) → `STRIPE_PRICE_PROFESSIONAL_YEARLY`

### Product: Klinik
- €99 / month → `STRIPE_PRICE_KLINIK_MONTHLY`
- €84 / month yearly (€1008/year) → `STRIPE_PRICE_KLINIK_YEARLY`

### Product: Enterprise (Multi-Business, RBAC, Wochen-/Monatsansicht — Faz 1.3, 2026-05-22)
- €149 / month → `STRIPE_PRICE_ENTERPRISE_MONTHLY`  ⚠️ TODO: kullanıcı kararı bekliyor
- €127 / month yearly (~€1524/year) → `STRIPE_PRICE_ENTERPRISE_YEARLY`  ⚠️ TODO

### Add-on Product: DTA-Pro  *(physiotherapy / praxis only — gates §302 SGB V Sammelabrechnung)*
- €29 / month → `STRIPE_PRICE_DTA_PRO_MONTHLY`
- €290 / year (2 months free) → `STRIPE_PRICE_DTA_PRO_YEARLY`

Sold as a **multi-item subscription** addon: the existing customer subscription
gets a second `subscription_item` line. Endpoints:
- `POST /api/stripe/dta-pro-add`     — body `{ interval: 'month' | 'year' }`
- `POST /api/stripe/dta-pro-remove`  — removes the addon line, prorates refund

The webhook (`customer.subscription.updated`) detects the DTA-Pro price ID in
`sub.items.data[]` and flips `profiles.has_dta_pro`. The dashboard sidebar's
"Kassenabrechnung" entry is hidden unless this flag is true.

Each price ID looks like `price_1AbCdE2FgHiJkLmN`.

## 3) Webhook endpoint

1. https://dashboard.stripe.com/test/webhooks → **Add endpoint**
2. URL: `https://infinitymade.de/api/stripe/webhook`
3. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. After creation → click endpoint → **Signing secret** → "Click to reveal" → copy `whsec_...` → set as `STRIPE_WEBHOOK_SECRET` in Vercel

## 4) Customer Portal

Enable Stripe Customer Portal so users can manage their subscription:
1. https://dashboard.stripe.com/test/settings/billing/portal
2. Activate features: cancel subscription, update payment method, see invoices
3. Save

## 5) Test mode → Live mode

When ready for production:
- Switch all `STRIPE_PRICE_*` to live IDs (recreate products in live mode)
- Replace `STRIPE_SECRET_KEY` with `sk_live_...`
- Recreate webhook endpoint in live mode → new `STRIPE_WEBHOOK_SECRET`
- Activate Stripe account (business verification)

## Test cards

- Success: `4242 4242 4242 4242` (any future date, any CVC)
- 3D Secure: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 0002`

More: https://stripe.com/docs/testing
