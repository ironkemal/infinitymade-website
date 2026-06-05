# Mail-Ausfall (B2B/B2C) & Domain-Migrations-Folgen — Befund 2026-06-05

> Diagnose live gegen Produktion (nicht nur Code-Review). Endpunkte mit echten
> verbundenen User-IDs aufgerufen.

## 1. Kernursache: B2B/B2C-Mail versendet nicht

**Symptom:** B2B- und B2C-Mailversand schlägt fehl.

**Live-Beweis:** `POST https://n8n.infinitymade.de/api/gmail/send` mit beiden
real verbundenen Konten →

```
{"success":false,"error":"invalid_grant"}   HTTP 500
```

Beide verbundenen Gmail-Konten (`ironkemal30@gmail.com`, `demiryavuzkemal@gmail.com`)
schlagen gleichzeitig fehl → **systemisch**, kein einzelner User-Widerruf.

**Warum (Domain-Migration):** Der gespeicherte `b2b_gmail_refresh_token` ist tot
(`invalid_grant`). Beide Tokens (zuletzt 2026-06-01 bzw. 2026-05-15 erneuert)
starben gleichzeitig → passt zur **OAuth-Client-Rotation während der
praxura.de-Migration (02.06.)**, nicht zum 7-Tage-Testing-Ablauf. Tokens, die
ein inzwischen ersetzter OAuth-Client ausgestellt hat, sind sofort ungültig.

Der `connect`-Flow selbst funktioniert (liefert gültige Consent-URL,
`access_type=offline` + `prompt=consent`, Client `862674740514-…`, redirect_uri
`https://n8n.infinitymade.de/api/calendar/google-callback`). → **Neu verbinden
erzeugt wieder funktionierende Tokens.**

### ✅ EINZIGE echte Behebung (manuell, nur durch dich)
1. Dashboard → **B2B → Konfiguration → „Mit Google verbinden"** → erneut
   einloggen/zustimmen. Pro verbundenem Konto wiederholen.
2. Danach Testmail senden — sollte sofort gehen.

### ⚠️ Damit es nicht in 7 Tagen wieder bricht
Google Cloud Console → **OAuth consent screen** muss **„In production"** sein
(nicht „Testing" — sonst laufen refresh_tokens nach 7 Tagen ab). Scope
`gmail.send` + `calendar` müssen gelistet sein.

### 🛠️ Code-Fix (in diesem Branch, bereits gemacht)
- `api-backend/server.js` `/api/gmail/send`: fängt jetzt den Refresh-Fehler ab,
  **löscht den toten Token** (`b2b_gmail_refresh_token = null`) und liefert
  `{code:'gmail_reauth_required'}` statt eines kryptischen 500.
- `dashboard.js`: Sendepfad erkennt diesen Fall, setzt das Konto lokal auf
  „nicht verbunden" und zeigt eine klare Reconnect-Meldung.
- Wirkung: Die UI zeigt nicht mehr fälschlich „verbunden" und fordert aktiv zum
  Neuverbinden auf. **Stellt den Versand NICHT von selbst wieder her** — dafür
  bleibt Schritt oben (neu verbinden) nötig.

---

## 2. Weitere Domain-Migrations-Folgen (Config, kein Code-Fix möglich)

| # | Befund | Beweis | Manuelle Aktion |
|---|--------|--------|-----------------|
| A | **Stripe-Webhook zeigt evtl. noch auf alte Domain** | `POST www.infinitymade.de/api/stripe/webhook` → **404**; `…praxura.de/api/stripe/webhook` → **400** (lebt) | Stripe-Dashboard → Webhook-Endpoint-URL auf `https://www.praxura.de/api/stripe/webhook` (bzw. primäre praxura-Domain) ändern. **Neuer Endpoint = neues Signing-Secret** → `STRIPE_WEBHOOK_SECRET` in Vercel aktualisieren. Sonst werden Abo-Events (trial→active, Zahlung, Kündigung) nicht mehr verarbeitet. |
| B | **`NEXT_PUBLIC_URL` evtl. noch `infinitymade.de`** | Code-Default ist bereits `app.praxura.de`, aber Vercel-Env überschreibt | Vercel-Env `NEXT_PUBLIC_URL` auf `https://app.praxura.de` setzen **oder löschen** (dann greift Default). Sonst landen Checkout-Success/Cancel & Billing-Portal-Return auf 404. |
| C | **Supabase Auth Site-URL / Redirect-Allowlist** | Code nutzt `window.location.origin` (ok), aber Bestätigungs-/Passwort-Reset-Mails nutzen die Supabase-Site-URL | Supabase → Authentication → URL Configuration: **Site URL = `https://app.praxura.de`**, Redirect URLs inkl. `https://app.praxura.de/**`. Sonst brechen Auth-Mail-Links. |
| D | **n8n-MCP-API-Key veraltet** (nur Tooling) | `n8n_list_workflows` → `AUTHENTICATION_ERROR` (health = ok) | n8n → Settings → API → Key neu erzeugen, im MCP-Config hinterlegen. Betrifft NUR die Workflow-Inspektion, NICHT die Produktion. |
| E | **vercel.json: alte infinitymade-Redirects** | `app.infinitymade.de` → 404 (Domain abgekoppelt), Regeln feuern nie | Kosmetisch/ungefährlich. Bei Gelegenheit aufräumen. Nicht dringend. |

---

## Was NICHT betroffen ist (geprüft, gesund)
- calendar-api läuft (kein Crash-Loop): `booking/get-slots` → 400, korrektes Routing.
- AI-Gateway `/api/ai/_health` → 200, Azure (gpt-4.1-mini) konfiguriert. Entwürfe
  (b2c-draft / appointment-confirm-draft) funktionieren — nur der **Versand** war tot.
- CORS erlaubt praxura.de + infinitymade.de Origins.
- OAuth-Callbacks zeigen auf `app.praxura.de`.
