---
titel: Physio-Launch Stufe 1 — Sitzungsabschluss, lokales signOut, Raum-Concurrency, 0081-Klärung, Überblick-CSS & AZE-Testsatz
typ: sitzung
angelegt: 2026-11-19
tags: [sitzung, physio, launch, auth, raeume, ueberblick, dta, 0081]
---

# Physio-Launch Stufe 1 — Sitzungsabschluss, Auth/Nebenseiten, Raum-Concurrency & Überblick-CSS

## Kontext & Zusammenarbeit
Auftrag Melih: Fokus auf schneller Veröffentlichung von Physio (Stufe 1: Praxisalltag; § 302-Physio-Abrechnung als Stufe 2, siehe `Physio/LAUNCH-P1.md`). Arbeitsteilung über Orca zwischen zwei Agenten ohne Dateiüberschneidung:
- **Gemini (`Offene Punkte 1`):** Sitzungsabschluss/Serientermine/Cache-Buster, 0081-Abgleich, `signOut` lokal + deutsche Fehlertexte auf Nebenseiten, Raum-Parallel-Nachweis `0104`, 15-Minuten-Live-Checkliste, Überblick-CSS-Gate-Fix.
- **Claude (`Offene Punkte 2`):** `Physio/LAUNCH-P1.md`, Physio-AZE-Testsatz (`TSOL0101–0105`, Betreff = nur Absender-IK `590537440`), Entlassmanagement → ZHE-Verordnungsbesonderheit `4` (`32f84d27`), Wächtertest für Testsätze (`9a07f881`).

## Befunde & Entscheidungen

### 1. Sitzungsabschluss & Physio-Alltag (`140691f2`)
- **Befund (Code-Review):** In `api-backend/booking/sitzung-abschliessen.js` wurden bereits geschriebene `prescription_sessions` (`status = 'done'`) bei parallelem Verschieben zurückgerollt, bei paralleler Absage, `no_show` oder Teil-Konflikt aber **nicht** — das hätte verwaiste erledigte Sitzungen an stornierten Terminen hinterlassen können. Außerdem war `req.headers.authorization?.slice(7)` nicht gegen Header-Arrays/fehlendes `Bearer ` gehärtet (`TS2345`).
- **Entscheidung:** Einheitliche `zuruecksetzen()`-Logik für alle 409-Konfliktpfade nach Session-Update, strikte `Bearer `-Prüfung, JSDoc-Typen (`jsconfig.json`) und 8 Unit-Tests (`api-backend/booking/sitzung-abschliessen.test.js`).
- **Nebenfunde:** `TS2307` in `module/serien-termine.js` via `declare module './frequenz-pruefung.js?v=*'` (`module/globals.d.ts`) behoben; veraltete `?v=`-Cache-Buster an 10 geänderten Frontend-Modulen auf `?v=20261119physio` angehoben (sonst Risiko fehlender Exporte wie `leistungsOptionen` / `wechsleLeistungsoptionen` aus Browser-Cache).

### 2. Rechnungsrechte `0081` — alle 3 Teilpunkte bereits live geschlossen
- **Befund (Originalbelege geprüft):** Direkt in `api-backend/db/migrations/0120_rechnungsrechte_teil1.sql` (Z. 24–82) und `fortschritte/2026-11-11.md` nachgeprüft:
  - Inaktive Mitarbeiter (`profiles.is_active IS TRUE`) auf `invoices` / `rechnung_zahlungen` → `0120` (live 11.11.2026).
  - Storno-Referenz-Trigger (`rechnung_zahlung_storno_referenz_pruefen`) + Wartelisten-Referenz-Trigger (`warteliste_referenzen_pruefen`) → `0120` (live 11.11.2026, zurückgerollte Live-Proben 23514).
  - Modulrecht `abrechnung` (Option A) → `0121_rechnungen_modulrecht.sql` (live 11.11.2026).
- **Ergebnis:** Kein offener Blocker mehr; in `Physio/LAUNCH-P1.md` (`92bf589d`) als erledigt markiert.

### 3. Lokales `signOut` & deutsche Fehlertexte auf Nebenseiten (`f159d224`, `4b9ced90`)
- **Problem:** `admin-login.js`, `admin.js` und `onboarding.js` nutzten noch `supabase.auth.signOut()` (Default `scope: 'global'`) und konnten andere Praxisgeräte abmelden. Nebenseiten (`booking-request.js`, `booking.js`, `login.js`, `onboarding.js`) zeigten teils rohe `HTTP ${status}`-, JSON-, `SyntaxError`- oder englische Supabase-/Netzwerk-Texte (`Failed to fetch`, `Invalid login credentials`).
- **Entscheidung:** Überall auf `{ scope: 'local' }` umgestellt (`dsgvo-client.js` bei Kontolöschung bleibt bewusst global) und `fehlertextAus`/`apiFehlertext` aus `module/api-sitzung.js` eingebunden. Bei `booking-request.js` bleiben die expliziten deutschen 500-Texte (`Anfrage konnte nicht gespeichert werden`, `Praxisangaben nicht verfügbar`) erhalten (`termin-anfrage-bis-liste-probe.mjs` grün).

### 4. Gleichzeitige Buchung auf letzter Raumkapazität (`748148ef`)
- **Nachweis (gemessen, reales PostgreSQL 17.11):** `api-backend/db/tests/0104-raum-kapazitaet-concurrency-proof.mjs` wendet die echten Migrationen `0103_raum_details.sql` + `0104_raum_automatik.sql` in einem Wegwerf-`postgres:17.11`-Container an und prüft mit zwei parallelen Verbindungen:
  - `plaetze = 1`: Verbindung A gewinnt, Verbindung B wartet nachweislich am `pg_advisory_xact_lock` und erhält nach Commit `P0001`.
  - `plaetze = 2` (letzter Platz): 2× OK, 3. parallele Buchung erhält `P0001`.
  - Rollback-Gegenprobe: nach Rollback übernimmt Verbindung B sauber.
  - Produktives `raumBuchungsFehler(err)` liefert die erwartete 409-Meldung.
- **Grenze:** Minimales Tabellenschema ohne Vollkette/RLS; prüft gezielt Trigger + Advisory-Lock + Fehlermapping.

### 5. Gemeinsames Überblick-CSS vs. `redesign-wachen` (`b4009e27`)
- **Problem:** Die Überblick-v2-Commits (`e41c6346`, `330c288d`, `d2efd6f1`) legten das gemeinsam für Alt + Neu geltende Stylesheet unter `design/ueberblick.css` ab. `tools/redesign-wachen.mjs` verlangt für alle Dateien in `design/` zwingend `[data-design="neu"]` → `test:tools` war rot (`354/355`).
- **Entscheidung:** Umzug nach `dashboard-ueberblick.css` (analog zu `dashboard-feinschliff.css`) + Eintrag in `dashboard.html` (`?v=20261119ubl4`), `onprem/frontend.Dockerfile` und `.github/workflows/publish-frontend.yml`. Alt + Neu bleiben gestaltet, `design/` bleibt strikt Neu-Design-only, `test:tools` wieder `355/355` grün.

## Nachweise
- Gesamtlauf auf `b4009e27`: `npm test` Exit 0 (Frontend `3.031/3.031`, Backend `0 Fehler`, Tools `355/355`, Merkez `109/109`), `npm run typecheck` `0 Fehler`, `check-dashboard-size.sh`, `check-syntax.sh`, `funktionskarte.mjs --check` (`4.790` Funktionen / `587` Dateien) grün.
- Gezielte Proben: `npm run probe` (u. a. `raum-probe` `66/66`, `physio-p1-probe` `41/41`), `termin-anfrage-bis-liste-probe.mjs` (`ok: true`), `tools/box-standort-abnahme.test.js` (`8/8`), `0104-raum-kapazitaet-concurrency-proof.mjs` (`PASS` auf `postgres:17.11`).
- Gepusht auf `origin/main` bis `b4009e27` (Melih-GO, Push durch Claude, Build/Live-Prüfung läuft dort).

## Offen (nach Push)
Vollständige Liste: [[2026-11-11_offene-punkte-wiederaufnahme]] → „Nachtrag 19.11.2026“ und `canli-test/2026-11-19-physio-launch-checkliste.md`.
- Melih: 15-Minuten-Live-Checkliste im QA-Konto (Gerätetests Passwort/OAuth/Kamera/GPS, QA-Datenpflege Straße/DATEV, Feiertagsbutton, Mitarbeiter anlegen/F11/entfernen, Physio-Kernfluss live).
- Kemal: Box-Schritte `L1–L7` (`Physio/LAUNCH-P1.md`) und 4 Partnerfragen an P1 (`#13`, `#14`, `#1`, `#22`).
- Extern: Antwort der AZE auf `TSOL0101–0105` (mit Betreff `590537440` neu verschickt, CC Kemal).

## Lernpunkte
- **Gemeinsames Dashboard-CSS gehört nicht nach `design/`:** Alles unter `design/*.css` wird von `redesign-wachen.mjs` als `[data-design="neu"]`-only erzwungen; geteilte Stylesheets für Alt + Neu liegen im Root (wie `dashboard-feinschliff.css` und jetzt `dashboard-ueberblick.css`) und müssen in `onprem/frontend.Dockerfile` + `.github/workflows/publish-frontend.yml` eingetragen werden.
- **AZE-Betreffregel:** `inbox@tp5.arz-emmendingen.de` verlangt **ausschließlich** die 9-stellige Absender-IK als E-Mail-Betreff; Zusatztext im Betreff führt zur automatischen Ablehnung vor Dateiprüfung.
- **Cache-Buster bei neuen Exporten sofort mitziehen:** Geänderte Module mit neuen Exporten (`leistungsOptionen`, `wechsleLeistungsoptionen`) brauchen überall dieselbe neue `?v=`-Version, sonst brechen wiederkehrende Browser beim Laden aus dem Cache.
- **Vor Parallelarbeit zuerst Orca-Postfach + Originalmigrationen prüfen:** Verhindert doppelte Arbeit (0081 war in `0120`/`0121` schon komplett live) und Push-/Commit-Kollisionen.
