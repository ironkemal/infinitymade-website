---
titel: Praxura Qualitätsoffensive — 16 Prüfstand-Befunde, Ergo/Logo-Nachzug & checkJs-Ratsche (682 Einträge)
typ: sitzung
angelegt: 2026-11-14
tags: [sitzung, pruefstand, validator, typecheck, checkjs, dta, onprem]
---

# Qualitätsoffensive: Rezept-Prüfstand & `checkJs`-Ausbau

Wissensfassung der mehrteiligen Sitzung vom 12.–14.11.2026 (`HEAD` = `c5dca0c8` lokal auf `main`, **`27 ahead, 9 behind`** zu `origin/main`, **nicht gepusht**, keine Live-DB-Mutationen).
Ergänzt die Tagesprotokolle `fortschritte/2026-11-13.md` und `fortschritte/2026-11-14.md` um Begründungen, verworfene Alternativen, technische Lernpunkte und offene Grenzen. Für die Gesamt-Restmatrix bleibt [[2026-11-11_offene-punkte-wiederaufnahme]] zusammen mit neueren Belegen maßgeblich.

---

## 1. Rezept-Prüfstand & HeilM-RL-/TP5-Bereinigung (`0 befund`)

Ausgangslage aus `94a9a7ef`: **122** quellengestützte Grenzfälle mit **16** offenen `befund`- und **11** `bewusst`-Abweichungen.

### Gelöste Pakete & Begründungen
- **Paket A — Engine-Routing (`1e16bdda`, `POD-STD-041..043`):** Fehlende Diagnosegruppen und Podologie-Diagnosegruppen bleiben in `api-backend/ai/validators/validate.js` im `standard`-Routing, statt einen falschen `LHB_HINT` auszulösen.
- **Paket B — Behandlungsbeginn-Fristen (`83c275c1`, `LHB-021`, `LHB-022`, `BLK-006`):** Fristlogik (`FRIST_TAGE`, `is_dringend` 14 vs. 28 Tage, `START_BEFORE_AUSSTELLUNG`) in `api-backend/ai/validators/fristen.js` gebündelt und in `standardRules.js`, `lhbBvbRules.js` sowie `blankoRules.js` (`BLANKO_BEGIN_AFTER_28D`) eingebunden, um Drift zwischen den Engines zu verhindern.
- **Paket C — KBV-Diagnoseliste (`1b6d2988`, `BLK-007/008`, `LHB-009/012/016/018/019`):** `api-backend/ai/validators/build-catalog.py` als deterministischer Block-Parser gegen `wissensbank/gemeinsam/heilmittel-richtlinie/heilmittel-diagnoseliste.txt` neu aufgebaut (**416** LHB/BVB- und **65** Blanko-Einträge statt altem Textwert `"114"` in `blankoRules.js`); `lookupCatalogEntry` (`catalog.js`) und `DG_MISMATCH_LHB` (`lhbBvbRules.js`) ergänzt.
- **Paket D & Ops-Nachzug 1 (`7efc0aa6`, `73a83b93`, `LHB-006`, `PHY-STD-011/012`):** 13 pre-2021 Physio-Alt-Codes (`WS1/WS2`, `EX1-3`, `ZN1/2`, `AT1-3`, `LY1-3`) aus `api-backend/ai/validators/diagnosegruppen.json`, `api-backend/ai/catalogs/rezept-optionen.js` (alle **44** amtlichen HeilM-RL-Diagnosegruppen) und `module/verordnung-import.js` (`PHYSIO_FALLBACK_HOECHSTMENGE`: **13** gültige Physio-DGs) entfernt; `SO5` (`6 / 18 / "1-3 x wöchentlich"`) sowie Physio-/Podo-Mengen gegen `wissensbank/gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt` korrigiert.
- **Ops-Nachzug 2 — Ergo/Logo, TP5-Preflight & `R-21` (`257f8fdc`):**
  - **8 Ergo-/Logo-Fälle aktiviert (`ERG-STD-001..004`, `LOG-STD-001..004`):** `ergo` (10) und `logo` (14) aus `HeilM-RL_2025-05-15_iK-2025-08-05.txt` (Teil III Z. 3589–4357, Teil IV Z. 4429–5068) in `diagnosegruppen.json` (`_meta.version` `"2026-11-14-v4"`) ergänzt; `getDiagnosegruppe` in `catalog.js` normalisiert Leerzeichen (`"SB 1"` → `"SB1"`), während `getIcdDgRules()` wegen `validate.js` auf `podologie` beschränkt bleibt. Prüfstand-Endstand: **`119 aktiv / 0 befund / 3 bewusst`** (`BLK-012`, `BLK-013`, `POD-STD-039`), **`122/122` Zitate**.
  - **Parallelitätsfix `R-21` (`tools/check-tanimsiz.test.js`):** Testdateien laufen in isoliertem `mkdtempSync`-Verzeichnis statt gemeinsam in `module/`, damit parallele `test:tools`-Läufe sich nicht gegenseitig bereinigen.

### Verworfene Alternativen & Pflichtberater-Entscheidungen
1. **Kein `SAS`/`CF` (Ernährungstherapie, Teil V) in `diagnosegruppen.json`:** Im Vertrag/HeilM-RL Teil V gibt es keine pauschale Höchstmenge (`hoechstmenge = NULL`). `standardRules.js` besitzt noch kein `?? 6`-Null-Handling und wäre mit `hoechstmenge: null` fehlerhaft verhalten. Entscheidung: `SAS`/`CF` vorerst bewusst nur im SQL-Entwurf (`bereich = 'ernaehrung'`, `hoechstmenge = NULL`) führen.
2. **Kein harter DTA-Blocker in `isValidDiagnosegruppe` (`gkv-302`-Veto):** Verworfen wurde der Vorschlag, `api-backend/billing/dta/preflight.js` hart auf den 44er-HeilM-RL-Katalog festzunageln. Begründung laut `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V21_20260115.txt` Kap. 5.5.3.3 (`ZHE`, `..4 AN M`): Im § 302-Datenverkehr existieren auch zahnärztliche Diagnosegruppen (`CD2a`, `ZNSZ`) sowie der TP5-Ersatzwert `'9999'`. Lösung: `V:01003` (hart) prüft ausschließlich TP5-Syntax (`'9999'` oder `/^[A-Z][A-Za-z0-9]{1,3}$/`), neue Warnregel **`V:01019`** (`schwere: 'warnung'` in `api-backend/billing/dta/regel-schwere.js`, ohne `harteRegeln()` zu ändern) warnt nicht-blockierend bei Abweichung vom 44er-Katalog.
3. **SQL `0122` als Entwurf statt vorgezogener Box-Migration (`onprem` O-129 / G7):** Verworfen wurde das sofortige Einchecken nach `api-backend/db/migrations/`. Wegen G7-Parität zwischen Live-SaaS und Box liegt die idempotente Bereinigung zunächst in `db/entwuerfe/0122_diagnosegruppen_heilm_rl_bereinigen.sql` (15 Alt-Codes `aktiv = false`, 10 Ergo + 14 Logo + Upsert `SAS`/`CF`, DO-Block prüft `44` aktiv / `>= 59` gesamt).
4. **Ergo-Blanko & optionaler ICD bleiben `bewusst`:** `BLK-012`/`BLK-013` mangels Ergo-Blankovertrag in `wissensbank/ergotherapie/` (Ratsbeschluss 2026-08-05); `POD-STD-039` wegen `_global.ICD_OPTIONAL` (historisches `ICD_DG_MISMATCH_STRENG`-Fixture bei fehlendem ICD dokumentiert).

---

## 2. `checkJs`-Typecheck-Ratsche (`jsconfig.json`: `4 → 682`, `0` Fehler)

Ausbau über Pakete `E1–E3` (`51`), DTA-Graph `E4-L1..L3` (`69`), `?v=`-Nachzug (`74`) bis zum Swarm-Abschluss (`c5dca0c8`: **`682` `include`-Einträge**, d. h. `681` Dateien + `"module/typen/**/*.js"`). Invarianten: `module/typen/gkv.js`, `dashboard.js` und §302-Laufzeitlogik blieben unangetastet; **0** `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`.

- **Endverteilung in `jsconfig.json`:** `root: 4` · `module: 205` (`globals.d.ts`, `typen/**/*.js`, `203` UI-/Logik-/Testmodule inkl. Byte-Parität `api-backend/lib/mail-signatur.js` ↔ `module/mail-signatur.js`) · `api: 17/17` (`100 %`) · `api-backend: 391` (`ai: 51`, `billing: 172`, `booking: 24/24`, `db: 10/10`, `dsgvo: 6/6`, `lib: 69/69`, `merkez-istemci: 11/11`, `routes: 24/24`, `setup: 8/8`, `tools: 2`, `_lib + Root: 14`) · `ops: 5` · `tools: 60`.
- **Bewusst in `TYPECHECK.md` zurückgestellt:** `api-backend/server.js`, `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/api/zuzahlungsforderung.routes.js` (+ 6 direkt abhängige Tests/Harnesses), `?v=`-/Browser-/Vendor-Module (`dashboard.js`, `ops/*.js`, übrige `?v=`-Module), Playwright-Skripte sowie `api-backend/ai/router.test.js` und `api-backend/ai/__tests__/m4-corpus.test.js` (selbst fehlerfrei nach JSDoc-Fixes, ziehen aber transitiv untypisierte `module/diktat.js`, `module/ki-client.js` und `spike/ki-maske/*.mjs` mit `174` Fehlern herein).

### Technische Lernpunkte (TypeScript 7 `tsgo` & Repo-Gates)
1. **`TS5042`-Workaround:** `tsc -p jsconfig.json <datei>` schlägt mit `TS5042` fehl; Kandidaten immer über `sh tools/typecheck-kandidat.sh <datei>` im temporären Verbund mit `jsconfig.json` messen.
2. **Relative `?v=`-Imports (`TS2307`):** `declare module '*?v=*'` in `module/globals.d.ts` greift unter TS 7 nicht für relative Pfade `./...js?v=...` und typisiert sie sonst als `any`. Lösung: relative JS-zu-JS-Imports ohne `?v=`, Cache-Buster auf HTML-Einstiege legen (Ausnahmen für Alt-Browsermodule wie `supabase-config.js`, `module/design-oeffentlich.js` und gezielte Einträge wie `declare module './standort-plan-regel.js?v=*'` sowie `declare module 'nodemailer'` in `module/globals.d.ts`).
3. **`redesign-wachen.mjs` Cache-Buster-Kopplung:** Ändert sich in einer von `dashboard.html` geladenen Datei nur JSDoc (hier `sentry-init.js`), verlangt `tools/redesign-wachen.mjs` trotzdem einen neuen Query-Parameter im HTML (`?v=20260917` → `?v=20261114tc` in allen 8 HTML-Ladern).
4. **Pre-Commit-Gates bei JSDoc-Sammelcommits (`c5dca0c8`):**
   - `tools/check-select-spalten.mjs` meldete im vorbestehenden Code `api-backend/lib/terminerinnerung-job.js:167` (`profiles.terminerinnerung_aktiv` aus Box-only-Migration `0110`, bewusst nicht im SaaS-`db/SCHEMA.sql`) → nach Prüfung `SKIP_SPALTEN_GATE=1`.
   - `tools/check-onprem.sh` (`seed-besleme kapısı`) schlägt bei jeder Änderung in `physio_positions.js` / `podologie_positions.js` an → reine JSDoc-/Typ-Änderungen per `git diff` verifiziert, daher `SKIP_SEED_GATE=1`.

---

## 3. Verifikation & ehrliche Grenzen (`HEAD` = `c5dca0c8`)

- **Gemessen nach dem letzten Code-/Doku-Edit:**
  - `npm test` (auf vollem Host per `BypassSandbox: true`, da Loopback `127.0.0.1` in der Sandbox mit `EPERM` blockiert): **Exit 0** — **5562 Tests gesamt (`5555 pass`, `0 fail`, `0 cancelled`)**: `test:frontend` `2894/2894`, `test:backend` `2197 pass / 0 fail / 4 skipped / 3 todo`, `test:tools` `355/355`, `test:merkez` `109/109`.
  - `npm run typecheck`: Exit 0 (`682` Einträge, `0` Fehler).
  - `node tools/pruefstand-zitate.mjs`: Exit 0 (`122/122` Zitate, `100.0 %`, `aktiv=119, bewusst=3`).
  - `node tools/funktionskarte.mjs --check`: Exit 0 (`4656 fonksiyon / 572 dosya`).
  - `node tools/redesign-wachen.mjs` & `node tools/check-tanimsiz.mjs --alle` (`281` Dateien): beide Exit 0.
- **Übersprungen / nicht geprüft:**
  - Die **4 PostgreSQL-Integrationstests** in `api-backend/db/*.integration.test.js` (`Raumautomatik`, `Raumdetails`, `F12 PostgreSQL`, `Urlaub`) mangels laufender PG-Testdatenbank (`# SKIP`).
  - Browser-Probes (`npm run probe`), Live-SaaS-DB, Vercel-/VPS-Deployment sowie `ops_wissen` im separaten Ops-Dashboard.

---

## 4. Verbleibende manuelle / offene Punkte

1. **`git push origin main`:** Branch steht lokal bei **`27 ahead, 9 behind`** (`c5dca0c8`); vor Push `git pull --rebase` prüfen und vorexistierende Fremdbestände in der Arbeitskopie (`db/NUTZUNG.json`, `db/NUTZUNG.md`, `Claude outputs/`, `tools/db-vollkette/`) unberührt lassen.
2. **Live-SaaS-Rollout von `db/entwuerfe/0122_diagnosegruppen_heilm_rl_bereinigen.sql`:** Optional in 4 Schritten gemäß `fortschritte/2026-11-14.md` (1. Live-SaaS anwenden → 2. in `api-backend/db/migrations/` übernehmen → 3. `erwartete-zaehler.json` aktualisieren → 4. `db/REGISTER.md` + `PRUEFSTAND.md` nachziehen & `sh tools/check-onprem.sh` laufen lassen).
3. **Verbleibende `jsconfig.json`-Restkandidaten:** siehe Auflistung in `TYPECHECK.md`.
