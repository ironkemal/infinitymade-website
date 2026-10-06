# ════════════════════════════════════════════════════════════════════════════
#  Praxura On-Premise — Oberfläche + Caddy (EIN Image)
# ════════════════════════════════════════════════════════════════════════════
#
#  Erzeugt: 11.09.2026 · Playbook Phase 2.0 + 2.1b
#
#  Warum EIN Image statt zwei: die Oberfläche und der Proxy, der sie ausliefert,
#  müssen immer zusammen versioniert sein — sonst driftet die Dateiliste
#  unbemerkt vom Caddyfile weg. Gebaut aus demselben Commit wie `praxura/api`
#  (siehe .github/workflows/publish-frontend.yml), beide Tags laufen parallel.
#
#  K2b.4 (06.10.2026): Eigenes Caddy-Binary mit dem Plugin `caddy-dns/acmedns`
#  für DNS-01-Zertifikate über den Praxura-Namensdienst (O-161 / O-171).
#
#  Build-Kontext ist das Repo-Root (nicht onprem/) — die Quelldateien liegen
#  dort. `docker build -f onprem/frontend.Dockerfile .`
#
#  ACHTUNG — wie beim Backend-Dockerfile: diese COPY-Liste ist VOLLSTÄNDIG
#  aufzuführen, kein "COPY . .". Das ist zugleich die Faz-2.0-Paketgrenze:
#  was hier NICHT steht, kommt NIE in eine Kundenbox — auch keine neue
#  Marketing-Seite, die später aus Versehen im Root landet (Allowlist statt
#  .vercelignore-Blockliste). Beim Anlegen einer neuen App-Seite/eines neuen
#  gemeinsamen Moduls hier eine Zeile ergänzen; beim Anlegen einer neuen
#  Marketing-/SaaS-only-Seite NICHTS tun — sie bleibt automatisch draussen.
#
#  Bewusst NICHT im Paket (Faz-2.0-Entscheidung, onprem/REGISTER.md §7F):
#    admin.html/js, admin-login.html/js  — unser internes Cross-Tenant-Tool,
#                                           ergibt auf einer Ein-Praxis-Box
#                                           keinen Sinn, und wir kommen laut
#                                           K10 ohnehin nicht in die Box.
#    onboarding.html/js, onboarding-success.html,
#    email-template-confirm-signup.html  — SaaS-Signup mit Stripe-Checkout.
#                                           Die Box bekommt ihren eigenen
#                                           Einrichtungsassistenten (Faz 2.2).
#    oauth.html                          — verweist nirgends hin (geprüft,
#                                           0 Referenzen); Google-OAuth ist
#                                           on-prem ohnehin aus (O-08).
#    styles.css                          — nur von index-old.html geladen
#                                           (tot), keine App-Seite braucht es.
#    login.css                           — gehört admin-login/employee-signup
#                                           in der SaaS-Version, aber keine der
#                                           acht Box-Seiten lädt es (gezählt).
#    cookie-consent.js/css               — reiner Umami-Injector (O-05), auf
#                                           der Box ohnehin nicht verkabelt.
#    alle *.html im Root sonst           — Marketing/SEO, Faz 2.0 sperrt sie
#                                           explizit ("paketin kök adresi
#                                           doğrudan login/dashboard'a gitmeli").
#
# ── Stufe 1: Caddy mit acmedns-Plugin bauen ─────────────────────────────────
# Versionsbindung per Tag + Go-Prüfsumme (sum.golang.org), gebaut in CI,
# nie in der Box (guvenlik S-47 Bedingung 3).
ARG VERSION_CADDY=2.11.6
FROM caddy:${VERSION_CADDY}-builder-alpine AS caddybau

RUN xcaddy build \
    --with github.com/caddy-dns/acmedns@v0.7.0

# ── Stufe 2: Laufzeit-Image mit Oberfläche ──────────────────────────────────
FROM caddy:${VERSION_CADDY}-alpine

COPY --from=caddybau /usr/bin/caddy /usr/bin/caddy

COPY onprem/Caddyfile /etc/caddy/Caddyfile

WORKDIR /srv/www

# ── Praxis-/Mitarbeiter-Oberfläche (Login-Pflicht) ──────────────────────────
# ⚠️ login.html benutzt NICHT login.css (das gehört admin-login/employee-signup
# in der SaaS-Version, aber referenziert hier keins der acht Box-Seiten,
# onprem-Gegenlesen 11.09.2026 gezählt) — deshalb fehlt es hier bewusst.
COPY login.html login.js ./
COPY dashboard.html dashboard.css dashboard.js ./
COPY kalender.html kalender.js ./
COPY employee-signup.html ./
# employee-signup.js seit ecbf871 (KHS K1.1) archiviert — die Seite ist nur noch ein Hinweis auf den Einrichtungscode.
# GoTrue leitet nach E-Mail-Bestätigung hierher (employee-signup.js:
# emailRedirectTo — seit O-56 window.location.origin, kein fester SaaS-Pfad mehr).
COPY confirm.html ./
COPY attendance.html attendance.js ./

# ── Einrichtungsassistent (Faz 2.2, NUR in der Box) ─────────────────────────
# Anders als die App-Seiten oben: setup.html hat auf SaaS keine Funktion (dort
# gibt es keinen SETUP_TOKEN-Ablauf, Owner kommen über Stripe/onboarding.html)
# und steht deshalb in .vercelignore — sie existiert NUR in diesem Image.
COPY setup.html setup.js ./

# ── Öffentliche Patienten-Seiten (kein Login, Slug-basiert) ─────────────────
COPY booking.html booking.js ./
COPY booking-request.html booking-request.css booking-request.js ./

# ── Gemeinsame Module (dashboard.js:1-8 importiert sie direkt) ─────────────
COPY nav-registry.js katalog-suche.js patient-suche.js calendar-widget.js ./
COPY arzt-suche.js icd-dg-match.js ./
# cookie-consent.js/css NICHT hier — reiner Umami-Injector (O-05), keine der
# acht Box-Seiten lädt es (onprem-Gegenlesen 11.09.2026 gezählt).
COPY sentry-init.js supabase-config.js ./
# system.css — trägt login/employee-signup/confirm, ohne sie ist der
# Anmeldebildschirm ungestylt (O-57, onprem-Gegenlesen 11.09.2026 gefunden).
COPY assets/system.css ./assets/system.css
COPY manifest.json ./
COPY module ./module

# ── Vendor — lokalisiert, CDN-Rückkehr verboten (Konsey 2026-08-13 S3) ──────
COPY vendor ./vendor

# ── Branding / Icons / Schrift ──────────────────────────────────────────────
COPY favicon.svg favicon.png apple-touch-icon.png logo.png ./
COPY fonts ./fonts
# Nur der Podologie-Fussatlas — nicht assets/img/fn/ (Marketing-Walkthrough,
# index.html), nicht assets/img/fn/_raw/ (Rohbilder, sowieso kein Web-Asset).
COPY assets/img/foot ./assets/img/foot
