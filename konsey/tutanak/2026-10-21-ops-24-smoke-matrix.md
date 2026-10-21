# #24 — Launch-Smoke-Test: Konfigurationsvertrag und Testmatrix (2026-10-21)

**Status: lokale Vorbereitung.** Kein Live-/Betreiber-/Kassenlauf, keine Testzahlung, keine Sendung,
keine Anmeldung mit echtem Konto. Ops-Karte #24 bleibt offen; dieses Dokument ersetzt keinen
Launch-Smoke-Test auf `app.praxura.de`.

## 1. Konfigurationsvertrag (nur Namen, keine Werte)

| Variable / Ort | Erwartung | Lokal belegt durch | Betreiberprüfung (offen) |
|---|---|---|---|
| `NEXT_PUBLIC_URL` (Vercel) | leer/nicht gesetzt oder `https://app.praxura.de`; abschließende Slashes werden gekappt (#17) | `tools/stripe-url-contract.test.js` 36/36 | tatsächlichen Vercel-Wert prüfen |
| `PUBLIC_API_BASE` (Vercel) | **nicht setzen** (Vorgabe CLAUDE.md O-01) | nicht prüfbar lokal | Abwesenheit in Vercel bestätigen |
| `SETUP_TOKEN` (VPS SaaS) | **nicht setzen** | nicht prüfbar lokal | Abwesenheit auf VPS bestätigen |
| `SUPABASE_SERVICE_ROLE_KEY` (VPS) | exakt dieser Name (nicht `…_SERVICE_KEY`) | Startup-Abbruch laut CLAUDE.md | Name im Container prüfen |
| `STRIPE_SECRET_KEY` + `ADMIN_RECOVERY_SECRET` (VPS) | pfadabhängig nötig (#337) | `routes/dsgvo.test.js` 2/2 | VPS-Konfiguration |
| `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | gesetzt, Webhook-URL `https://app.praxura.de/api/stripe/webhook` | nicht lokal | Stripe-Panel |

## 2. Testmatrix Anmeldung → Onboarding → Buchung → Abrechnung

Spalte „lokal" = was ohne Login/Netz heute nachgewiesen ist. „Live" bleibt in jeder Zeile ungeprüft.

| Schritt | Lokaler Nachweis (Stand 2026-10-21) | Live-/Login-Prüfung (manuell, offen) |
|---|---|---|
| Anmeldung (`login.html`) | `canli-test/REGISTER.md` Login-Eintrag; Frontend-Suite | Anmeldung mit QA-Konto (`~/praxura-qa/`), Weiterleitung, Sentry-Konsole sauber |
| Onboarding (`onboarding.html`, Stripe Checkout) | Checkout-/Portal-Redirect-URLs `stripe-url-contract` 36/36; `setup-probe` | Testmodus-Checkout nur mit ausdrücklichem GO; Rückkehr-URL ohne Doppelslash |
| Public-Buchung / Termin-Anfrage | `widget-probe` 55/55 (CSP, iframe, 320–768 px), `booking/*.test.js` | Anfrage absenden, Owner bestätigt, Mail-Zustellung |
| Kalender / Termin anlegen | `layout-probe`, `render-probe`, `leistungen-probe` | Termin mit Verordnung anlegen, Reload |
| Verordnung (Muster 13) | `verordnung-maske-probe`, `blanko-hinweis` 4/4 | Anlage mit Selbstzahler und Kasse |
| Behandlung dokumentieren → Abrechnung | `abrechnung-probe`, `billing/**/*.test.js` | Neue Abrechnung → DTA erzeugen (nur Entwurf, kein Versand) |
| Rechnung / Zuzahlung | `rechnung-zahlung-security`, `zuzahlungsforderung.routes` | Rechnung öffnen, Zahlung erfassen |
| Datenschutz / Cookie | `cookie-consent` 32/32 | Banner, Widerruf, kein Tracker nach Ablehnen |

## 3. Ausführungsregeln für den späteren Live-Lauf

- Nur QA-Praxis „Podologie Nord" mit synthetischen Daten; Zugänge nur lokal.
- Keine Testzahlung, kein SMTP-Versand an Dritte, kein DTA-Versand ohne ausdrückliches GO.
- Ergebnis je Zeile in `canli-test/REGISTER.md` eintragen (Datum, Commit, Ergebnis).
- Abbruchbedingung: Konsolenfehler, 4xx/5xx im Netzwerk oder Doppelslash in Redirect-URL.
