---
titel: Praxisinhaber-Paket (Optionen A, B, C), Box-Update-Haltbarkeit & Tiefenprüfung
typ: sitzungsnotiz
angelegt: 2026-11-24
tags: [sitzung, onprem, praxisinhaber, zuzahlung, ueberblick, tagesplan, abwesenheit, tp5-v22, konsey, datenschutz, rls]
---

# Praxisinhaber-Paket (Optionen A, B, C), Box-Update-Haltbarkeit & Tiefenprüfung

## Auslöser und Ziel

Ausgehend von der Testbox-Auswertung (Hetzner-Testbox, Schritte 1–5 + 7–11 bestanden, Schritt 6 Update/Rollback offen) wurden systematisch die größten betrieblichen und rechtlichen Risiken aus Sicht einer realen Heilmittelpraxis (Physiotherapie / Podologie / Ergo / Logo) identifiziert, priorisiert und in vier Paketen umgesetzt:

1. **Box-Update-Haltbarkeit** (`O-213 b/e`, `O-247`, `O-248`, `Europe/Berlin`-Timer).
2. **Option A — Praxisalltag-Sofortschutz**: Zuzahlungs-Jahreswechsel 2026→2027, Umsatz-Retter „Nachfassen“ im Überblick, druckbarer DIN-A4-Tagesplan.
3. **Option C — 07:30-Uhr-Krankheits- & Abwesenheits-Assistent**: 1-Klick-Vertretung, 1-Klick-Absage, datensparsame DIN-A4-Anrufliste.
4. **Option B — Regulatorik & Datenschutz**:
   - **B1 (`W-A09`):** Amtliche §302-Umstellung TP5 V21 → V22 zum `01.02.2027` mit zentralem Stichtags-Schalter.
   - **B2 (`/konsey`):** Verbindlicher Datenschutz- & Rechtemodell-Beschluss (`legal-de`, `guvenlik`, `db-ustasi`) und zwei geprüfte Migrations-Entwürfe (`0131`, `0132`).

---

## Was wurde gebaut und warum so entschieden

### 1. On-Prem Box-Update-Haltbarkeit (`b36ebec7`, gepusht 23.11.)
- **Problem:** Ein abgebrochenes Box-Update hinterließ keinen sauberen Zwischenstand; systemd-Timer liefen ohne explizite Zeitzone `Europe/Berlin`; Rollback- und Manifest-Prüfungen fehlten in automatischen Regressionstests.
- **Lösung:** `install.sh`, `update.sh` (`speicher_stand_schreiben`, Image-Diff-Erkennung, atomares Rollback), aktualisiertes `manifest.json` sowie `tools/onprem-update-haltbarkeit.test.js`.
- **Verifikation:** Regressionstests grün; zusätzlich realer Bash-Lauf (`set -euo pipefail`) für `speicher_stand_schreiben` & Image-Diff (`STAND_JSON_OK`, `IMAGE_DIFF_OK`). Live-Test von Schritt 6 auf der Testbox bleibt bewusst separat offen.

### 2. Option A — Praxisalltag-Sofortschutz (`f7817bf1`, gepusht 24.11.)
- **Zuzahlungs-Jahreswechsel (`module/zuzahlung-befreiung.js`):** Befreiungsausweise gelten kalenderjährlich (§ 62 SGB V). Beim Wechsel über den 31.12.2026 wird eine abgelaufene Vorjahres-Befreiung aktiv erkannt, sichtbar markiert und für 2027 nicht still weiter angewendet.
- **Umsatz-Retter „Nachfassen“ (`module/ueberblick-listen.js`, `module/ueberblick-ansicht.js`, `module/verordnung-fristen-laden.js`):** Neuer Tab im Überblick zeigt laufende Verordnungen mit offenen Resteinheiten ohne gebuchten Folgetermin, gruppiert nach Dringlichkeit.
- **Druckbarer Tagesplan (`module/tagesplan-druck.js`):** DIN-A4-Browserdruck direkt aus dem Überblick (ohne neue Abhängigkeit), inklusive Hausbesuchsadressen und Notfall-Telefonnummern.

### 3. Option C — 07:30-Uhr-Krankheits-Assistent (`c94db5a0`)
- **Problem:** Meldet sich morgens eine Therapeutin krank, mussten Praxen bisher händisch Kalender, Qualifikationen (`employee_services`), Dienstzeiten (`working_hours`) und Patientennummern zusammensuchen.
- **Lösung:** Neues ES-Modul `module/abwesenheit-termine.js` (angebunden über `module/abwesenheit.js`, **+0 Bytes in `dashboard.js`**):
  - Öffnet nach Bestätigung einer Abwesenheit mit Termin-Überschneidungen.
  - `findeFreieVertreter()` filtert gleichzeitig abwesende, bereits belegte, fachlich unpassende (`employee_services`) und außerhalb ihrer `working_hours` (Berliner Wochentag/Zeitfenster) liegende Kollegen heraus und aktualisiert Belegungen sofort nach jeder Übertragung.
  - 1-Klick-Absage (`status = 'cancelled'`) mit Bestätigung, `tel:`-Anruflinks und DIN-A4-Anrufliste (`erstelleAnruflisteHtml`) — streng datensparsam (ohne Diagnose, ohne Krankheitsgrund des Mitarbeiters).

### 4. Option B1 — §302 TP5 V21 → V22 zum 01.02.2027 (`c96e8ece`, `W-A09` geschlossen)
- **Quelle:** Amtliche `Anlage 1 TP5 Version 22` (Stand `21.05.2026`, GKV-Spitzenverband) heruntergeladen und per `pdftotext -enc UTF-8 -layout` nach `wissensbank/gemeinsam/302-tp5/Anlage_1_TP5_V22_20260521.txt` abgeleitet; in [[INDEX]] und [[REGISTER]] eingetragen.
- **Amtlicher Diff V21 ↔ V22:**
  - `Anzuwenden ab: 01.02.2027`, Übergangsfrist für V21 bis `30.04.2027`.
  - Sämtliche fachlichen Segmentänderungen in V22 betreffen ausschließlich `5.5.3.7` (Hebammen).
  - Heilmittel (`5.5.3.3`) und `SLGA` (`5.5.2`) bleiben inhaltlich unverändert; einzige Änderung für Praxura ist `UNH S009` (`SLGA:21:0:0`/`SLLA:21:0:0` → `SLGA:22:0:0`/`SLLA:22:0:0`).
- **Umsetzung:** Zentraler Stichtags-Schalter `api-backend/billing/dta/tp5-version.js` (+ `tp5-version.test.js`), verdrahtet in `builder.js`, `output-validator.js` (prüft Version gegen UNB-Datum, Übergangsfrist und Einheitlichkeit innerhalb einer Datei) und `zuzahlungsforderung-ursprung.js` (akzeptiert V21 und V22).
- **Sicherheit vor vorzeitiger Umstellung:** Bis einschließlich `31.01.2027` erzeugen alle Builder-Läufe weiterhin 100 % V21.

### 5. Option B2 — `/konsey` Datenschutz & Rechtemodell (`c96e8ece`)
- **Beratung:** Parallel durch `legal-de`, `guvenlik` und `db-ustasi`; verbindlicher Beschluss in `konsey/KARARLAR.md`.
- **Vier dabei entdeckte blinde Flecken:**
  1. `time_offs_mandant FOR ALL` erlaubte Mitarbeitern mandantenweiten Zugriff auf fremde Abwesenheitsgründe (inkl. Krankmeldungen, Art. 9 DSGVO).
  2. R6-Abrechnungsschutz galt nur auf `abrechnung`, nicht auf den Kindtabellen (`abrechnung_zeile`, `abrechnung_uebermittlung`, `abrechnung_zahlung`, `zaa_fehler`).
  3. Auf den drei Rechte-Tabellen fehlte `owner_id` für eine saubere `audit_rechte_log()`-Zuordnung.
  4. Zeilen in `abrechnung_uebermittlung` mit `abrechnung_id IS NULL` wären bei reinem Join über `abrechnung` aus der Policy gefallen (korrigiert über direkten `business_id`-Zweig).
- **Zweistufiger Migrations-Entwurf (wegen `:beta`/`:stable`-Abwärtskompatibilität):**
  - Stufe 1: `db/entwuerfe/0131_datenschutz_rechte_und_audit.sql` (abwärtskompatibel; ergänzt `team_abwesenheiten()` RPC ohne Grund-Spalte, R6-Kindtabellen-RLS, Audit-Trigger).
  - Stufe 2: `db/entwuerfe/0132_time_offs_rls_schliessen.sql` (schließt `time_offs`-Direktzugriff erst nach Frontend-Umstellung auf `team_abwesenheiten()`).
- **Bewusst NICHT live angewendet:** Beide Dateien bleiben Entwürfe in `db/entwuerfe/`, bis Melih ausdrückliches Live-Apply-GO gibt.

---

## Tiefenprüfungen (3 Durchläufe) & gefundene Fehler

Bei zwei Code-/Schema-Tiefenprüfungen (`49aa6130`, `2bae0574`) und einer dritten End-to-End-Prüfung (Playwright Chromium + Postgres 17.11 + Bash) wurden **7 echte Bugs/Kantenfälle** vor dem Push gefunden und behoben:

1. **`module/tagesplan-druck.js` (kritischer Live-400):** `leads` besitzt `street, plz, city` — nicht `strasse, ort`. Korrigiert + Regressionstest.
2. **`module/ueberblick-ansicht.js` (kritischer Physio-Falschalarm im „Nachfassen“-Tab):** Physio/Ergo/Logo verknüpfen Termine über `prescription_sessions.booking_id` (nicht `bookings.verordnung_id`, das nur Podologie nutzt). Batch-Laden in 50er-Blöcken ergänzt + Regressionstest.
3. **`module/globals.d.ts` (`tsc`-Fehler TS2307):** `declare module './abwesenheit-termine.js?v=*';` ergänzt → `npm run typecheck` wieder `0` Fehler.
4. **`module/abwesenheit-termine.js` (Teilzeit-Lücke & Doppel-Query):** `working_hours`-Prüfung nach Berliner Wochentag/Zeitfenster ergänzt, doppelte Abwesenheitsabfrage entfernt, `employee_services` auf `teamIds` eingegrenzt.
5. **`db/entwuerfe/0131_datenschutz_rechte_und_audit.sql`:** Nullable `abrechnung_id` auf `abrechnung_uebermittlung` per direktem `business_id`-Zweig abgesichert.
6. **`module/ueberblick-listen.js` / `verordnung-fristen-laden.js`:** `prescription_sessions.status === 'completed'` neben `'done'`, Fallback auf `heilmittel_items[0].einheiten` sowie `is_blanko`-Guard (Blankoverordnung ohne feste Einheitengrenze).
7. **Cache-Busting nachgezogen:** Einheitliche `?v=20261124*`-Stände (byte-neutral in `dashboard.js`) für `abwesenheit.js`, `ueberblick-ansicht.js`, `ueberblick-listen.js`, `verordnung-fristen-laden.js`, `tagesplan-druck.js`, `abwesenheit-termine.js` und `dashboard.html`.

---

## Was ist verifiziert vs. was bleibt offen

### Lokal vollständig verifiziert (Stand 24.11., vor Push)
- `npm run typecheck` (`tsc -p jsconfig.json`): **0 Fehler** (`tp5-version.js` zusätzlich unter `--strict --checkJs` 0 Fehler).
- `npm test`: komplett grün (`3151` + `2284` + `369` + `109` Tests, Exit 0).
- `npm run probe`: komplett grün (`0` Konsolenfehler, `{"befunde":[]}`).
- **Playwright-Chromium-Smoke-Test (`1440 px` & `390 px`):** Alle drei neuen Modals (`zuzahlung-befreiung`, `tagesplan-druck`, `abwesenheit-termine`) sowie `ueberblick-ansicht` („Nachfassen“-Tab + „Tagesplan drucken“): **0 `console.error`, 0 `pageerror`, 0 horizontaler Überlauf**.
- **Echter Wegwerf-Postgres-17.11-Lauf:** `0131` + `0132` fehlerfrei angewendet und funktional nachgewiesen (`audit=3`, `empB_timeoffs=0`, `empB_rpc=1`, `empB_abr=0`, `empA_self=1`, `empA_abr=1`, `empA_ueb=2`, `fremd_rpc=0`).
- **Bash-Test (`set -euo pipefail`):** `update.sh` `speicher_stand_schreiben` & Image-Diff bestanden (`STAND_JSON_OK`, `IMAGE_DIFF_OK`).
- **Qualitäts-Gates:** `node tools/fremde-hosts.mjs` (`371` Frontend + `232` Backend sauber), `tools/check-syntax.sh`, `tools/check-dashboard-size.sh`, `tools/onprem-manifest.mjs --check`, `tools/check-onprem.sh`, `tools/funktionskarte.mjs --check`, `module/import-versionen.test.js` alle grün.

### Bewusst offen (nicht live getestet / wartet auf separates GO)
- **Live-Sichtprüfung nach Vercel-/Watchtower-Deploy:** Nach dem Push am 24.11. prüfen, dass „Nachfassen“-Tab, Tagesplan-Druck und Krankheits-Assistent im Live-Browser mit echten Konten sauber laufen.
- **Testbox Schritt 6 (Update & Rollback):** Realer Durchlauf der neuen `update.sh`-Haltbarkeitslogik auf der Hetzner-Testbox steht noch aus.
- **Migrationen `0131` & `0132` (Live-DB):** Erst nach ausdrücklichem Live-Apply-GO und Vorab-Prüfung `SELECT count(*) FROM public.abrechnung WHERE business_id IS NULL;` in `api-backend/db/migrations/` übernehmen, live anwenden, Dumps (`db/SCHEMA.sql`, `db/SCHEMA-RLS.sql`), `erwartete-zaehler.json` & `compliance/TOM.md` nachziehen und Frontend vor Stufe 2 (`0132`) auf `team_abwesenheiten()` umstellen.
