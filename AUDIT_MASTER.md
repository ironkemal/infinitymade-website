# Praxura — Konsolidierter Audit & Verbesserungs-Report
**Datum:** 2026-06-05 · **Methode:** Orchestriert; Befunde live gegen Produktion geprüft (nicht nur Code-Review).

> **Orchestrierungs-Hinweis:** 4 parallele Tiefen-Audit-Agenten (Design/UX/Code/Growth) wurden gestartet, brachen aber nach ~500s an einem Infra-Socket-Fehler ab, bevor sie ihre Dateien schreiben konnten. Security war bereits abgedeckt (`AUDIT_SECURITY.md`). Die Bereiche Design/UX/Code/Growth unten sind daher **vorläufig** aus Beobachtungen dieser Session — eine sequentielle Neuauflage (1 Agent/Bereich, write-early) liefert die Tiefe nach.

---

## 0. Was in dieser Session bereits BEHOBEN wurde (Code)

| Fix | Datei | Risiko | Status |
|-----|-------|--------|--------|
| Gmail-Token Self-Heal bei `invalid_grant` (löscht toten Token, klare Reconnect-Meldung) | server.js `/api/gmail/send`, dashboard.js | niedrig | committet, Branch |
| Baseline-Security-Header auf VPS-API (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS) + `x-powered-by` aus | server.js | niedrig (additiv) | committet |
| PHI aus Request-Logs entfernt (kein Body-Dump; lead-upsert ohne email/phone/name) — DSGVO Art. 5(1)(f) | server.js:81, :873 | niedrig (nur Logging) | committet |
| `/api/apify/search` Auth-Guard (`requireAuthAI`, userId gepinnt) — Frontend sendet bereits Bearer | server.js:348 | **null** (kein Caller bricht) | committet |

Alle `node --check`-sauber. **Nicht auto-deployed** — Review/Merge durch dich.

---

## 1. SECURITY — höchste Priorität (Details: `AUDIT_SECURITY.md`)

### 🔴 P0/P1: Unauthentifizierte Write-/PHI-Endpunkte auf der VPS-API
Mehrere Endpunkte haben **keine Auth** und nehmen `ownerId`/`employeeId`/`userId` ungeprüft aus dem Body. Mit einer (öffentlich aus Booking-Seiten ableitbaren) `owner_id` kann ein Angreifer Termine fälschen oder Patientendaten lesen/schreiben.

| Endpunkt | server.js | Aufrufer | Fix |
|----------|-----------|----------|-----|
| `/api/booking/manual-create` | 1621 | **kalender.js:325** (Frontend) | Guard + Pin |
| `/api/booking/batch-create` | 1034 | **dashboard.js:3492** (Frontend) | Guard + Pin |
| `/api/booking/batch-create-explicit` | 1565 | **dashboard.js:3795** (Frontend) | Guard + Pin |
| `/api/booking/ai-suggest-series` | 1140 | **dashboard.js (AI_SUGGEST)** (Frontend) | Guard + Pin |
| `/api/rezept/save` | 1982 | **dashboard.js:10356** (Frontend) | Guard + Pin |
| `/api/team` (GET) | 1017 | dashboard.js:6123 + kalender.js:171 (Fallback) | Guard + Pin |
| `/api/prescription/lookup-by-phone` | 2068 | **n8n (server-to-server)** — NICHT im Frontend | ⚠️ **NICHT** mit User-JWT sichern → **Internal-Shared-Secret-Header** (z.B. `X-Internal-Token`), sonst bricht n8n |

**Warum noch nicht blind ausgeliefert:** Diese 6 Frontend-Endpunkte brauchen einen **atomaren Zwei-Seiten-Fix** (Backend-Middleware **+** Bearer-Header in dashboard.js/kalender.js). Ungetestet auf Live-Booking/Team-Flows der Testkunden loszulassen ist riskant. Exakter Plan:

**Backend-Muster (minimal-diff, sicher) pro Route:**
```js
app.post('/api/booking/batch-create', requireAuthAI, async (req, res) => {
  req.body.ownerId = req.auth.tenantId;   // Owner-Scope erzwingen, kein Body-Spoofing
  // ...bestehender Code unverändert (employeeId/userId bleiben aus Body)...
```
`req.auth.tenantId` = bei Owner die eigene id, bei Employee die `owner_id` → identisch zu `getOwnerId()` im Frontend. Für `manual-create`/`batch-create-explicit` (in `try{}`): die Pin-Zeile als **erste** Anweisung im try, **vor** dem `const {...} = req.body`.

**Frontend-Muster:** vor jedem dieser `fetch` einen Bearer setzen:
```js
const { data: { session: s } } = await supabase.auth.getSession();
// headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+s.access_token }
```
(dashboard.js nutzt dieses Muster bereits an ~20 Stellen; kalender.js braucht Zugriff auf den Supabase-Client/Session.)

**Aufwand:** ~45–60 min inkl. manuellem Test (1 Booking-Serie + manueller Termin + Rezept speichern + Team laden, als Owner UND als Employee).

### 🟠 Weitere Security (siehe AUDIT_SECURITY.md)
- **[P0]** `api-backend/.env` mit live `SUPABASE_SERVICE_ROLE_KEY` + `GOOGLE_CLIENT_SECRET` auf Disk (nicht git-tracked, aber rotieren empfohlen + `.gitignore` für Subdir-`.env` verifizieren).
- **[P1]** JWT als `?token=`-Query in 5+ Billing-Routes → landet in Logs/Referrer. Nur `Authorization`-Header akzeptieren.
- **[P2]** Kein CSP-Header (Vercel). **Empfehlung: zuerst `Content-Security-Policy-Report-Only`** ausrollen (kann nichts brechen), Verstöße sammeln, dann enforced.
- **[P2]** `express.json({limit:'15mb'})` global → nur auf `/api/rezept/upload` + `/api/ai/*` anheben, sonst `1mb`.
- **[P2]** `/api/booking/create` gibt vollen DB-Row inkl. `owner_id`/`lead_id` zurück → minimieren.
- **[DB, unverifiziert]** anon-callable RPCs/Views (add_credits, find_patient_by_name_and_birth, profiles_public, admin_*, …) — **per Supabase advisor + SQL-Revokes prüfen** (kann P0 sein). Ich habe MCP-SQL-Zugriff; auf Wunsch sofort prüfen.

---

## 2. MAIL / DOMAIN-MIGRATION (Details: `MAIL_DOMAIN_MIGRATION_FIX_2026-06-05.md`)
- **B2B/B2C-Versand tot** = alle Gmail-Refresh-Tokens `invalid_grant` (OAuth-Client-Rotation beim praxura.de-Umzug). **Einzige Behebung: Gmail im Dashboard neu verbinden.** Code-Self-Heal ist drin (siehe §0).
- **Config-Follow-ups (kein Code):** Stripe-Webhook-URL (alt = 404) → praxura + neues Signing-Secret; `NEXT_PUBLIC_URL`; Supabase Auth Site-URL; n8n-MCP-Key.

---

## 3. CODE / KORREKTHEIT / PERFORMANCE — vorläufig
- **[P2] Repo-Hygiene:** ~30 ungetrackte Scratch-Dateien (`*.py`, `*.png`, `web foto/`, `app ss/`) im Repo-Root. `.vercelignore` blockt sie vom Hosting (geprüft), aber sie verschmutzen das Repo → in `.gitignore` aufnehmen oder löschen.
- **[P2] Tote Dateien:** `index-old.html`, `dashboard.js.bak`, `dashboard.html.bak`, `script.js`, `chatbot.js` — nicht gerendert (bewusst gelassen lt. Memory), aber `index-old.html` enthält veraltetes infinitymade-canonical → besser entfernen.
- **[P2] Bug-Klasse:** optionale Lookups mit `.single()` → 406; durchgängig auf `.maybeSingle()` prüfen (bekannt aus QA).
- **[P3] `dashboard.js` ~13k Zeilen** in einer Datei → schwer wartbar; langfristig modularisieren. Kein akuter Bug, aber Init-Kosten + Merge-Konflikt-Risiko.
- **Gut:** Double-Booking via GIST-Constraint, TZ-Helper DST-sicher, Rate-Limits aktiv, Stripe-Webhook-Signatur korrekt.
- *Tiefen-Audit ausstehend (Agent abgebrochen).*

## 4. UX / USABILITY / I18N / A11Y — vorläufig
- **[P2] Geschluckte Fehler:** Muster `throw new Error('Nicht angemeldet')` an vielen Stellen ohne sichtbares User-Feedback — gleiche Klasse wie der gerade behobene kryptische Gmail-Fehler. Audit lohnt.
- **[P1 bekannt] Keine Buchungsbestätigungs-Mail** an Kunde/Owner nach Booking (offener TODO).
- **i18n:** DE/EN/TR-Dictionaries in dashboard.js — Key-Coverage über 3 Sprachen stichprobenartig prüfen (data-i18n überschreibt HTML).
- *Tiefen-Audit ausstehend.*

## 5. DESIGN / UI — vorläufig
- Landing (praxura.de) wurde auf editorial-luxury umgebaut; **prüfen, ob alte dark/mint-Reste** in Unterseiten/Blog verblieben (Marken-Kohärenz Landing↔Dashboard↔Booking).
- Dashboard: Dark-Theme-CSS-Vars-Disziplin (keine `#fff`/`#f3f4f6`-Literale) verifizieren.
- *Tiefen-Audit ausstehend — hier habe ich am wenigsten direkt gesehen.*

## 6. GROWTH / SEO / GEO — teilweise verifiziert
- **✅ Migration sauber:** Live-`praxura.de` canonical + og:url = praxura.de; `sitemap.xml` ohne infinitymade-Referenzen. Einzige veraltete Canonical in `index-old.html` (tote Datei).
- **[P2] Stripe/Checkout-Redirects** (s. §2) sind auch ein Conversion-Leak (404 nach Zahlung).
- *Volle On-Page/Content/Conversion-Tiefe ausstehend.*

---

## Empfohlene Reihenfolge
1. **JETZT (du, ~2 min):** Gmail neu verbinden → Mail lebt wieder.
2. **Heute (du):** Stripe-Webhook-URL + Secret, `NEXT_PUBLIC_URL`, Supabase Site-URL (§2).
3. **Diese Woche (1 fokussierter PR + Test):** die 6 Frontend-Auth-Guards (§1) — Plan steht. + `prescription/lookup-by-phone` Internal-Secret.
4. **Diese Woche:** DB-RPC/View-Revokes via Supabase advisor (§1, evtl. P0).
5. **Danach:** CSP Report-Only, Billing-`?token=` entfernen, Body-Limit pro Route.
6. **Backlog:** Booking-Bestätigungsmail, Repo-Cleanup, dashboard.js-Modularisierung, Design/UX/Growth Tiefen-Audit (sequentielle Agenten).
