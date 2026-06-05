# Praxura Security Audit Report
**Date:** 2026-06-05
**Auditor:** Claude Code (Sonnet 4.6) — read-only analysis
**Scope:** api-backend/server.js, api/ (Vercel serverless), supabase-config.js, vercel.json, billing routes, AI gateway, DSGVO endpoints. Live HTTP probes on n8n.infinitymade.de/api/*, praxura.de, app.praxura.de.
**Reference:** Cross-checked against SECURITY_AUDIT_2026-06-03.md (prior audit) and PRE_LAUNCH_CHECKLIST.md.

---

## Status of Prior Audit Findings

| Finding | Status |
|---------|--------|
| C1 — HAR file publicly served (tokens) | **FIXED** — 404 on praxura.de/.har; .vercelignore added |
| C2 — Plaintext passwords in pending_signups | **FIXED** — Vault RPC; commit `0066fba` |
| C3 — add_credits RPC anon-callable | **NOT VERIFIED** — DB access required |
| C4 — n8n API key in .roo/mcp.json | **FIXED** — 404 confirmed live |
| H1 — Entire repo served as static | **FIXED** — .vercelignore excludes sql/md/py/api-backend etc |
| H2 — find_patient_by_name_and_birth anon | **NOT VERIFIED** — DB access required |
| H3 — profiles_public view leaks company_code | **NOT VERIFIED** — DB access required |
| H4 — admin_* RPCs anon callable | **NOT VERIFIED** — DB access required |
| H5 — confirm_referral_and_create_series anon | **NOT VERIFIED** — DB access required |
| H6 — fahrten_monthly_summary anon view | **NOT VERIFIED** — DB access required |
| M1 — No security headers | **FIXED** — X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy in vercel.json |
| M2 — Wildcard CORS | **FIXED** — allowlist: praxura.de, app.praxura.de, infinitymade.de variants |

> **NOTE:** DB-level findings (C3, H2–H6, M4) from the prior audit cannot be re-verified without Supabase MCP access to query grants/RLS. Assume still open unless you ran the SQL migrations.

---

## New / Still-Open Findings

---

### Theme 1: Committed Live Credentials

#### [P0] GOOGLE_CLIENT_SECRET + SUPABASE_SERVICE_ROLE_KEY in committed api-backend/.env
- **Evidence:** `api-backend/.env` lines 2–5 contain `GOOGLE_CLIENT_SECRET=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` and `SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdnVjbHVsbG90Ymtzc2twd2drIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIs...` as **plaintext live values**.
- **Is it git-tracked?** `.gitignore` includes `.env`, and `git ls-files api-backend/.env` returns empty — so it is NOT currently committed to git history. However, the file **exists on disk in the working tree** and has been present throughout development.
- **Risk:** If `git add .` or similar is ever run carelessly, the service_role key (which bypasses ALL Postgres RLS) gets committed and pushed to the repo. Additionally, the file is readable by anyone with local or CI access to the build environment.
- **Additional concern:** `SUPABASE_ANON_KEY` is hardcoded as a fallback literal in both `supabase-config.js:4` and `api/_lib/auth.js:5`. The anon key is intentionally public (low risk by itself), but the pattern of hardcoding keys should not extend to service-role keys.
- **Impact:** Service-role key = full Supabase access bypassing RLS; Google OAuth secret = token theft + account compromise.
- **Recommended fix:** Delete `api-backend/.env`; add `api-backend/.env` explicitly to `.gitignore` (it should already match `/.env` but that pattern may not cover subdirectory files — verify); rotate Google client secret in Google Cloud Console; rotate Supabase service-role key in Supabase dashboard.
- **Effort:** S (30 min)

---

### Theme 2: Unauthenticated Write Endpoints on VPS

#### [P0] /api/booking/manual-create — no auth, accepts arbitrary owner/employee UUIDs
- **Evidence:** `api-backend/server.js:1608–1633`. No auth middleware. Live probe `POST /api/booking/manual-create` with `ownerId=<uuid>`, `employeeId=<uuid>` — accepted until FK constraint fires. Returns 500 only because the random UUID doesn't exist.
- **Impact:** Any attacker who knows a valid `owner_id` (obtainable from public booking pages, team endpoint, or verify-code) can create confirmed bookings under any therapist. Poisoning schedules, disrupting operations.
- **Recommended fix:** Add `requireAuthAI` middleware (already imported) to this route; verify that `req.auth.tenantId === ownerId` inside the handler.
- **Effort:** S

#### [P0] /api/booking/batch-create — no auth, bulk confirmed bookings without verification
- **Evidence:** `api-backend/server.js:1021–1124`. No auth middleware. Live probe confirmed: returns `{"created":[],"conflicts":[...]}` — the endpoint is reached and executes. Up to 52 bookings can be created in one call.
- **Impact:** Same as above but amplified — attacker can flood a practice calendar with 52 confirmed bookings per request.
- **Recommended fix:** Add `requireAuthAI` middleware; verify `req.auth.tenantId === ownerId`.
- **Effort:** S

#### [P0] /api/booking/batch-create-explicit — no auth, writes bookings with arbitrary employee IDs
- **Evidence:** `api-backend/server.js:1552–1605`. No auth middleware. Accepts `slots[].employeeId` from caller — no server-side check that `ownerId` is the authenticated user.
- **Impact:** Write confirmed bookings for any employee under any owner.
- **Recommended fix:** Add `requireAuthAI`; verify `req.auth.tenantId === ownerId`.
- **Effort:** S

#### [P1] /api/rezept/save — no auth, writes anamnese/aerzte records for arbitrary patients
- **Evidence:** `api-backend/server.js:1969–2047`. No `requireAuthAI` guard (unlike `/rezept/upload` and `/rezept/confirm` which correctly use it). Accepts `ownerId`, `patientId`, `arztName` from body. Live probe returns 500 only due to FK violation.
- **Impact:** Unauthenticated attacker can inject/corrupt medical record (doctor name, diagnosis, Befund notes) for any patient if `ownerId`+`patientId` pair is known.
- **Recommended fix:** Add `requireAuthAI`; replace body `ownerId` with `req.auth.tenantId`.
- **Effort:** S

#### [P1] /api/prescription/lookup-by-phone — no auth, PHI disclosure by phone number
- **Evidence:** `api-backend/server.js:2055–2149`. No auth middleware. Live probe: `POST /api/prescription/lookup-by-phone {"ownerId":"...","phone":"+4915100000000"}` returns `{"found":false,"reason":"no_patient_for_phone"}`. With a real owner_id and phone number, returns patient name, prescription status, session counts, next appointment.
- **Impact:** Unauthenticated read of health record (Heilmittel Rezept details = sensitive PHI under DSGVO/BDSG). Caller only needs a valid `ownerId` (public via booking pages) and a patient's phone.
- **Recommended fix:** Add `requireAuthAI`; verify `req.auth.tenantId === ownerId`.
- **Effort:** S

#### [P1] /api/apify/search — no auth, Apify API cost & data exfiltration
- **Evidence:** `api-backend/server.js:348–392`. No auth middleware. Only checks `query` and `userId` in body. Attacker can supply any `userId` (no ownership verification), exhaust weekly Apify crawl quota, and insert scraped business contacts into any owner's `b2b_contacts` table.
- **Impact:** Uncontrolled spend on Apify API; database pollution; cross-tenant data injection.
- **Recommended fix:** Add `requireAuthAI`; use `req.auth.tenantId` instead of body `userId`.
- **Effort:** S

---

### Theme 3: Token in URL (JWT Credential Exposure)

#### [P1] Supabase JWT accepted as `?token=` query parameter in billing routes
- **Evidence:**
  - `api-backend/billing/api/statistik.routes.js:18`: `const token = req.query.token || req.headers.authorization?.slice(7);`
  - `api-backend/billing/api/mahnwesen.routes.js:21`: same pattern
  - `api-backend/billing/api/warteliste.routes.js:22`: same pattern
  - `api-backend/billing/api/abrechnung.routes.js:836`, `:1105`, `:1197`: same pattern
- **Impact:** JWTs in query strings are logged by: the Express request logger at `server.js:83` (`body=${JSON.stringify(req.body)}`... and `req.path`), web server access logs, Traefik logs, browser history, Referrer headers to third parties, Sentry (if path is captured). Token validity = user session. This makes session theft possible from logs alone.
- **Recommended fix:** Accept tokens only in the `Authorization: Bearer` header. Remove `req.query.token` fallback from all billing route auth helpers. (The `dta-bytes` download route at line 524 already does it correctly — use that pattern.)
- **Effort:** S

---

### Theme 4: Full Request Body Logged (PHI in Logs)

#### [P2] Global middleware logs full request body for every non-health request
- **Evidence:** `api-backend/server.js:83`: `console.log(\`[...] ${req.method} ${req.path} body=${JSON.stringify(req.body)}\`)`
- **This logs patient names, emails, phone numbers, and medical data** (e.g., `/api/booking/create` body contains `customerName`, `customerEmail`, `customerPhone`; `/api/rezept/upload` body contains `image_base64` of a prescription — 15 MB limit; `/api/prescription/lookup-by-phone` body contains `phone`).
- Line 859 additionally: `console.log('[lead upsert]', { resolvedOwnerId, email, normPhone, customerName })` — also logs PHI.
- **Impact:** DSGVO Art. 5(1)(f) — PHI in application logs. If logs are shipped to Sentry/external logging, this is a data processor disclosure issue. Even locally, PM2 logs = PHI persisted to disk in plaintext.
- **Recommended fix:** Remove the global body logger or at minimum scrub sensitive fields (replace body values with `[REDACTED]` for known PHI paths). For the lead upsert log, remove `email`, `normPhone`, `customerName`.
- **Effort:** S–M

---

### Theme 5: Missing Content-Security-Policy Header

#### [P2] No CSP header on any Vercel-served page
- **Evidence:** Live probe of `https://app.praxura.de/dashboard.html` — response headers include `X-Frame-Options`, `HSTS`, `X-Content-Type-Options`, `Referrer-Policy` (all added since prior audit) but **no `Content-Security-Policy`**.
- **Impact:** No protection against XSS payload execution. Dashboard is a complex SPA with inline event handlers, imported scripts, and user-controlled data rendered in the DOM. Without CSP, a successful XSS (e.g., via a stored patient note) can exfiltrate session tokens.
- **Recommended fix:** Add a CSP header to the `/(.*)`  headers block in `vercel.json`. Starter policy: `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://n8n.infinitymade.de; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';`. Note: `'unsafe-inline'` is needed for current vanilla JS approach; a nonce-based CSP is the gold standard but requires server-side rendering.
- **Effort:** S (basic CSP); M (strict nonce-based)

---

### Theme 6: No Security Headers on VPS API

#### [P2] VPS API (Express on n8n.infinitymade.de) has no security headers
- **Evidence:** Live probe of `/api/team?owner_id=test` — headers show only `X-Powered-By: Express`. No `X-Frame-Options`, no `X-Content-Type-Options`, no `Strict-Transport-Security`, no `Content-Security-Policy`. Traefik provides HTTPS but no security header injection.
- **Impact:** Information disclosure (`X-Powered-By`), missing HSTS (downgrade attack risk on API), clickjacking not mitigated.
- **Recommended fix:** Add `helmet()` middleware to Express app in `server.js` (one line: `import helmet from 'helmet'; app.use(helmet());`). Also add `X-Powered-By` removal: `app.disable('x-powered-by');`.
- **Effort:** S

---

### Theme 7: Unauthenticated AI Configuration Disclosure

#### [P3] /api/ai/_health returns Azure deployment info without auth
- **Evidence:** Live `GET /api/ai/_health` returns: `{"ok":true,"tasks":["b2c-draft","rezept-validate","rezept-ocr","appointment-confirm-draft"],"azure":{"endpoint":"ironk-mp8kdyv6-swedencentral.…","deployment":"gpt-4.1-mini","api_version":"2024-10-21","dry_run":false}}`
- **Impact:** Exposes Azure endpoint partial name, deployment model name, API version. Low severity but useful for a targeted attacker. Also exposes all available AI task names.
- **Recommended fix:** Add `requireAuthAI` to the `/_health` router.get handler in `ai/router.js:28`.
- **Effort:** S (1 line)

---

### Theme 8: /api/team Unauthenticated Cross-Tenant Profile Disclosure

#### [P2] /api/team leaks employee profiles with no auth
- **Evidence:** `api-backend/server.js:1004–1019`. No auth middleware. Live probe: `GET /api/team?owner_id=<uuid>` returns array of employee profiles including `id`, `email`, `business_name`, `booking_slug`, `avatar_url`, `anrede`. Returns `[]` for non-existent owner.
- **Impact:** Unauthenticated enumeration of user emails + booking slugs for any owner_id. Owner IDs are visible in public booking page URLs.
- **Recommended fix:** Add `requireAuthAI` and verify that `req.auth.tenantId === owner_id` (employees can query their own team; owners can query their own team).
- **Effort:** S

---

### Theme 9: /api/booking/ai-suggest-series — No Auth, Hits n8n AI Backend

#### [P2] AI series scheduler endpoint has no authentication
- **Evidence:** `api-backend/server.js:1127–1549`. No auth middleware. Live probe with dummy UUIDs returns `{"error":"Service not found"}` — the endpoint is fully reached.
- **Impact:** Any caller can trigger AI slot enumeration (DB reads across working_hours, bookings, time_offs for any owner_id) and an outbound request to `https://n8n.infinitymade.de/webhook/ai-series-scheduler` — costing AI tokens and compute. Also leaks employee schedule availability.
- **Recommended fix:** Add `requireAuthAI`; verify `req.auth.tenantId === ownerId`.
- **Effort:** S

---

### Theme 10: Sensitive Request Body Limit Set to 15 MB

#### [P3] express.json({ limit: '15mb' }) allows large payloads on all endpoints
- **Evidence:** `api-backend/server.js:48`: `app.use(express.json({ limit: '15mb' }))`.
- The comment says this was "raised for rezept image base64 payloads". However, this 15 MB limit applies to **all routes**, including `/api/verify-code`, `/api/booking/create`, and billing endpoints.
- **Impact:** A caller can send 15 MB JSON to `/api/verify-code` (or any public endpoint), causing the server to parse it fully. At scale, this is a DoS amplification vector. Even with rate limiting, a single IP can consume significant memory per request.
- **Recommended fix:** Use a per-route body parser: set the default global limit to `1mb` (or `100kb`) and mount a larger limit only on `/api/rezept/upload` and `/api/ai/*` routes that actually need it.
- **Effort:** S

---

### Theme 11: DSGVO — /api/booking/create Returns Full Booking Object to Client

#### [P2] Public booking endpoint returns full DB row including internal fields
- **Evidence:** `api-backend/server.js:973`: `res.json({ success: true, booking });` where `booking` is the full DB row from `.select().single()`, including `id`, `owner_id`, `user_id`, `service_id`, `lead_id`, and all fields.
- **Impact:** The `lead_id` in the response allows a public user to discover their own Supabase `leads` UUID, which could be used with other unauthenticated endpoints. `owner_id` and `user_id` are internal UUIDs that help enumerate tenant structure. Minimally necessary data principle (DSGVO Art. 5(1)(c)) recommends only returning the booking confirmation number.
- **Recommended fix:** Return only `{ success: true, booking: { id: booking.id, start_time: booking.start_time, meeting_link: booking.meeting_link } }`.
- **Effort:** S

---

## Verified GOOD (this audit)

- **Prior C1, C4 (HAR file, n8n key):** Confirmed 404 — fixed.
- **Prior H1 (static file exposure):** `.vercelignore` correctly blocks .md, .sql, .py, api-backend/, .roo/, .claude/. Verified 404 for INFRASTRUCTURE.md and database_setup.sql.
- **Prior M1 (missing headers on Vercel):** HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all present.
- **Prior M2 (wildcard CORS):** Allowlist confirmed working — evil.com origin gets no ACAO header; praxura.de gets ACAO.
- **Stripe webhook signature:** Correctly verified with raw body (`bodyParser:false`, `verifyWebhook`) — `api/stripe/webhook.js:101`.
- **service_role never exposed client-side:** `supabase-config.js` and browser `lib/supabase.js` only export `SUPABASE_ANON_KEY`. Service-role gated behind `isNode` check in `lib/supabase.js:32-33`.
- **DSGVO delete/export endpoints:** Both protected by `getAuthedUser(req)` (JWT required). Delete requires `{ confirm: "LÖSCHEN" }` body guard.
- **Admin panel (/api/admin/data.js):** Protected by `getAuthedUser` + `isAdmin` check.
- **rezept/upload, rezept/confirm:** Both use `requireAuthAI` middleware.
- **AI router tasks:** All behind `requireAuth` middleware in `ai/router.js:32`.
- **Rate limiting:** `/api/booking/create` (20/min), `/api/booking/get-slots` (60/min), `/api/verify-code` (5/10min) all present and confirmed via live `Ratelimit` headers.
- **Google OAuth singleton race:** Fixed — factory function `newOAuthClient()` used consistently.
- **Double-booking:** PostgreSQL EXCLUDE constraint present (noted in CLAUDE.md).
- **Password storage:** Vault RPC (`pending_signup_store`) replaces plaintext storage.

---

## Prioritized Top-10 Table

| # | Severity | ID | Title | File:Line | Effort |
|---|----------|----|-------|-----------|--------|
| 1 | P0 | S-01 | Live service_role key + Google secret in api-backend/.env on disk | api-backend/.env:5-6 | S |
| 2 | P0 | S-02 | /api/booking/manual-create — no auth, write bookings | server.js:1608 | S |
| 3 | P0 | S-03 | /api/booking/batch-create — no auth, bulk write up to 52 bookings | server.js:1021 | S |
| 4 | P0 | S-04 | /api/booking/batch-create-explicit — no auth, write bookings | server.js:1552 | S |
| 5 | P1 | S-05 | /api/prescription/lookup-by-phone — no auth, PHI read (Heilmittel records) | server.js:2055 | S |
| 6 | P1 | S-06 | JWT accepted as ?token= query param in 5+ billing routes (logs sessions) | billing/api/*.routes.js | S |
| 7 | P1 | S-07 | /api/rezept/save — no auth, writes medical records | server.js:1969 | S |
| 8 | P1 | S-08 | /api/apify/search — no auth, arbitrary Apify cost + cross-tenant write | server.js:348 | S |
| 9 | P2 | S-09 | Full request body logged (PHI: names, emails, phones, base64 Rezept images) | server.js:83, server.js:859 | S |
| 10 | P2 | S-10 | No CSP header on Vercel-served pages (XSS mitigation absent) | vercel.json (missing) | S–M |

Additional P2: /api/team (no auth, email enumeration), /api/ai/_health (unauthenticated config disclosure), /api/booking/ai-suggest-series (no auth, AI cost abuse), missing security headers on VPS Express app.

---

## DB-Level Findings — Still Unverified (Require Supabase SQL Access)

These were flagged in the prior audit and **cannot be confirmed fixed** without Supabase MCP queries or SQL console access:
- C3: `add_credits` RPC anon-callable
- H2: `find_patient_by_name_and_birth` anon PHI function
- H3: `profiles_public` view leaks company_code
- H4: `admin_*` RPCs callable by anon
- H5: `confirm_referral_and_create_series` anon write
- H6: `fahrten_monthly_summary` anon view
- M4: Over-broad anon table GRANTs (DELETE/UPDATE on profiles, leads, prescriptions)

**Action required:** Run the Supabase advisor and the SQL revocations from the prior audit's remediation section. These are P0/P1 findings if not yet applied.
