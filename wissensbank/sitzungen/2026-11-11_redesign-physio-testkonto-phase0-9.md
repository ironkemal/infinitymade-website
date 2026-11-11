---
titel: Redesign auf das Physio-Testkonto übertragen — Phasen 0–9 lokal
typ: sitzung
angelegt: 2026-11-11
tags: [sitzung, redesign, physio, aktivierung, onprem]
---

# Redesign → Physio-Testkonto: Stand nach Phase 9 (lokal)

Branch `t3/praxura-redesign-phase-one` (Worktree, nicht in `main`, **nichts gepusht, nichts deployed, keine Env gesetzt**).
Genehmigter Plan: Downloads `Praxura-Redesign-Plan-2026-11-10.md` (Phasen 0–10). Nachweise im Branch: `redesign/phase01/VALIDATION.md`, `STATUS.md`, `TRANSFER.md`.

## Was gebaut ist (lokal, getestet)
- **Gestaltung:** Tokens, Kalender (44-px-Ziele), Startseite mit heutigen Aufgaben, Anamnese-Abschnittsnavigation, App-Shell (Leiste, Flyout, Kopfleiste, mobile Schublade), Seiten-/Verwaltungs-CSS, öffentliche Seiten (`design/oeffentlich.css`).
- **Aktivierung (Phase 2):** `?design=neu`/localStorage sind nur Wunsch. Entscheidung nach Login: `GET /api/design/entscheidung` (`api-backend/routes/design.js`), Antwort nur `{neu}`, `private, no-store`, fail-closed. Env (alle optional, fehlend = Alt): `DESIGN_NEU_AUS`, `DESIGN_NEU_PILOT_TENANTS` (Tenant-UUIDs, nie ins Repo), `DESIGN_NEU_PILOT_ROLLEN`. Lokale Vorschau nur über `/api/config designVorschau:true` (liefert nur `dev_server.cjs`). onprem **O-245** (GEÇER): Box setzt die Variablen nie → bleibt Alt.
- **Öffentliche Seiten (Phase 8):** nur lokale Vorschau, kein Livepfad (kein Mandant für eine Server-Entscheidung; Produktentscheidung offen).

## Nachweise
`npm test` grün (0 Fehler); Proben: integriert, Shell 16/16, Anamnese, Kalender-Touchziele, Aktivierung 18 Fälle, Rechteparität Owner/Employee (alle 27 Panels, Alt = Neu), öffentliche Seiten, Onboarding-Schritte, Login-Fehlerzustände; Smoke Neu ≈ Alt über alle Panels, Podologie/Physio/Ergo/Logo, hell/dunkel; axe (WCAG A/AA): Neu nie schlechter als Alt. Unabhängige Reviews (Shell, Aktivierung) → alle Befunde behoben. Fachbildabnahme physio + podoloji (nur Bilder, kein Praxisbetreiber).

## Ehrliche Korrekturen / Grenzen
- Ein Review-Fix hat den Shell-Aufruf in `dashboard.js` versehentlich gelöscht (`ae311aee`), die Probe merkte es nicht → repariert, Probe und Quellwache prüfen jetzt Shell-Präsenz. Zwischenmeldungen zu `7eed0449`/`57fb2043` galten für einen Stand **ohne** Shell.
- Pixelkante Neu→Alt ≥ 1025 px (56 Pixel, 1–2 Stufen, Ecken von `#welcomeOverview`): ohne jedes JS reproduzierbar, Reload ist pixelgleich → nicht behoben, kein Livepfad schaltet dynamisch zurück.
- Nicht geprüft: echte Geräte, Screenreader/Tastatur durch Menschen, echte Anmeldekette, Unterformulare einzeln, A-Fälle A04–A05 nur über Einheitstest, Podologie-Fußbefund-Maske.

## Offene Fachbefunde (Produktentscheidung, nicht umgesetzt)
Behandler:in je Termin auf dem Start, Anwesenheitsstatus statt „vorbei", Serienposition, Konfliktmarkierung im Kalender, Hausbesuch-/Diabetes-Kennzeichen, Dokumentationsknopf auf dem Start, überfällig-Begriff (`gkv-302`). Partnerfragen: `Physio/PARTNER-FRAGEN.md` #23.

## Phase 10 (Live) — nicht begonnen
Braucht: ausdrückliches GO für Push/Deploy/Env-Setzen im SaaS, Tenant-ID des Testkontos (nur serverseitig), Rücknahme: `DESIGN_NEU_AUS=1` oder Pilotliste leeren (wirkt sofort für neue Sitzungen), danach Reload.
