# Autopilot „Planung" (M1–M7) — Warteschlange und Steuerung

> Angelegt 01.11.2026 (Melih + Claude Code). Wird von einer T3-geplanten Aufgabe abgearbeitet:
> jeder Lauf = **frische Sitzung** (leerer Kontext), nimmt **eine** Scheibe, endet mit Commit/Push und Übergabe hier.
> Repo public: keine Namen, Städte, Preise, Zugangsdaten. Grundlage: `Physio/PILOT-PLAN.md`, `Physio/PLANUNG-UMSETZUNG.md`
> (§2a geht vor), Übergabe: `wissensbank/sitzungen/2026-10-30_kemal-uebergabe-physio-pilot-planung.md`.

## Steuerung (Melih schreibt hier)

- Autopilot: **AUS** (bis Blocker unten gelöst; zum Starten auf `AN` setzen) ← auf `AUS` setzen stoppt jeden weiteren Lauf
- GO Live-Migrationen (Melih setzt `[x]`, Autopilot wendet dann per MCP an):
  - [x] GO 0096 `mitarbeiter_anstellung` (S1) — Melih 01.11.2026 („ohne meine Zustimmung weiterführen“), live 01.11.2026
  - [x] GO M4a `employee_standort_plan` (S3) — wie oben, live 01.11.2026
  - [ ] GO M6b Sondertag-Mitteilungsprotokoll (S8)

## Rechte (Melih, 01.11.2026)

| Darf allein | Nur mit GO oben | Nie |
|---|---|---|
| bauen, testen, committen, **pushen** grüner Scheiben (= live) | Migration live anwenden (MCP) | Daten löschen · Kemals Bereich ändern (Verordnung, Akte, Vorlagen, Rechnungsmail/Fax, KI, Diktat, Befund, Box, §302) · gemeinsame Module (`nav-registry.js`, `calendar-widget.js`, `patient-suche.js`, `katalog-suche.js`) ohne Kemal · Secrets |

## Warteschlange

Status: `offen` · `läuft` · `wartet-GO` · `blockiert` · `fertig`. Reihenfolge = Priorität; blockierte überspringen.

| # | Scheibe | Status | Abhängig | Agenten (Pflicht fett) | Fertig wenn |
|---|---|---|---|---|---|
| S1 | **M5-Fix:** Migration `0096_mitarbeiter_anstellung` (Kollegen lesen nichts, nur Inhaber schreibt, Mitarbeiter liest eigene Zeile), `klassifikation.js`, `db/REGISTER.md`, lokal frische DB | fertig (live 01.11.2026) | — | **db-ustasi**, **guvenlik**, **onprem** | Datei + Tests grün → `wartet-GO`; nach GO: live, `db/SCHEMA*` neu, Commit+Push |
| S2 | Live-Test M1, M2a, M5, M6a, M7 im **QA-Tenant** (nie im P1-Testkonto I6) — **macht der Chat „Live-Test", Autopilot überspringt S2** | offen | S1 live | **canli-test**, physio | Einträge in `canli-test/REGISTER.md`; Fehler → neue Scheibe hier |
| S3 | M4a Migration `employee_standort_plan` (ohne anon, Tag-Granularität) | fertig (live 01.11.2026, mit 0096 in einem Commit) | — | **db-ustasi**, **guvenlik**, **onprem** | wie S1 |
| S4 | M4b Regel Einzeltag → Wochenmuster → alle zugeordneten Standorte, Backend `api-backend/lib/standort-plan.js` + Frontend `module/standort-plan-regel.js`, gemeinsame Testvektoren | fertig (46 Tests grün; Schnittmenge mit `employee_business_assignments` noch in S6 prüfen) | — | **fonksiyon-ustasi** | Beide Fassungen bestehen dieselben Vektoren |
| S5 | M4c UI: Wochenmuster, Einzeltag, „Versetzen" als ein Ablauf, Warnliste gebuchter Termine (nie automatisch verschieben) | fertig (Reiter „Standorte“ im Team-Panel, nur Inhaber, ab 2 Standorten; Probe 18/18; live ungetestet; „gültig ab Datum“ für Wochenmuster fehlt bewusst, keine Spalte) | S3 live, S4 | **fonksiyon-ustasi**, physio, Skill `impeccable` | Montag A: in B nicht sichtbar; Einzeltag wirkt in beiden |
| S6 | M4d Filter Kalender + `getAvailableSlots` + Serienplaner; leere Tabelle/Lesefehler = altes Verhalten | fertig (Tagesansicht, getAvailableSlots, ai-suggest-series, batch-create; fällt ohne Tabelle auf altes Verhalten; Wochen-/Monatsansicht nicht gefiltert; live ungetestet) | S5 | **onprem**, fonksiyon-ustasi | Tests + Browser-Probe grün |
| S7 | M2b Raumspalten (Umschalter Therapeut/Raum) + freie Räume im Terminformular | fertig (Umschalter Therapeut/Raum in Tagesansicht, Hinweiszeile freie Räume; Probe 59/59; live ungetestet, Mitarbeiterfilter im Raum-Modus und Klick auf leere Slots bewusst nicht) | S6 | physio, Skill `impeccable`, mobil-ui | Spalten je Raum; freie Räume gelistet |
| S8 | M6b Migration Mitteilungsprotokoll + Route Vorschau/Senden (`api-backend/routes/sondertag.js`): **nie automatisch** — System erstellt Vorschau, **Praxis-Mitarbeiter:in prüft und gibt frei, erst dann Versand** (Melih 01.11.2026; welche Rolle freigeben darf, klären guvenlik + legal-de — bisheriger Plan: nur Inhaber), Einzelmails, fester Text, nur mit Opt-in, Dedup in DB, Deckel je Lauf, kein Cron, über `api-backend/lib/mail.js` | blockiert | **Kemal: E13-Einwilligungstext um „Terminänderungen" ergänzen** | **db-ustasi**, **guvenlik**, **onprem**, legal-de | Route + Tests; Migration `wartet-GO` |
| S9 | M6c Dialog Vorschau, Abwahl je Empfänger, Anrufliste (ohne Opt-in/Adresse/SMTP) | blockiert | S8 | fonksiyon-ustasi, legal-de | Ablauf vollständig, Box ohne SMTP liefert Liste |
| F1 | **Live-Test M1:** Termin mit belegtem Raum, Hinweis „Raum belegt" bestätigen mit „Trotzdem eintragen": Termin wird nicht gespeichert, Formular bleibt offen, keine Meldung. (a) gleicher Therapeut: `POST bookings` 400 `no_overlapping_bookings` (Therapeuten-Sperre greift, UI zeigt nichts). (b) zweiter Therapeut `qa-mitarbeiter`, gleicher Raum und gleiche Zeit (09.11.2026 10:00): nach Bestätigung kein POST, Termin fehlt im Kalender, Ursache offen. Schritte: Terminkalender, + Termin, Raum „QA Raum A2" (Plätze 1), Zeit mit vorhandenem Raum-Termin, Speichern, Trotzdem eintragen. Erwartet: Termin gespeichert, sonst klare Meldung. Register: `canli-test/REGISTER.md` Abschnitt „Räume (M1)" | zurückgezogen (Testfehler, 01.11.: Meldung `#bkSaveError` war vorhanden, zweiter Therapeut speichert nach Bestätigung) | — | **canli-test**, fonksiyon-ustasi | Beide Fälle liefern Termin oder verständliche Meldung |
| F2 | **Live-Test M7:** Widget in fremder HTTPS-Seite (iframe `praxura.de/widget/booking-widget.html?owner=<QA-Inhaber>`): beim ersten Laden CORS-Fehler auf `GET n8n…/api/booking-request/praxis` (Origin `https://praxura.de`, „No Access-Control-Allow-Origin"), Widget zeigt „Online-Terminanfrage ist gerade nicht erreichbar". Zweiter Ladeversuch ~15 s später ok; `curl` mit Origin liefert den Header (`Vary: Origin`, `Cache-Control: public, max-age=300`). Verdacht: Cache/Proxy ohne Origin-Schlüssel oder Backend-Neustart. Erwartet: Formular lädt immer. Register: `canli-test/REGISTER.md` Abschnitt „Einbettungscode (M7)" | offen (nicht reproduzierbar: 3 weitere Ladeversuche ohne Fehler; nur beobachten) | — | **canli-test**, betrieb-sre | Fünf frische Ladeversuche aus fremder Seite ohne CORS-Fehler |
| F3 | **Live-Test Mobil:** Verfügbarkeit bei 390 px: Arbeitszeiten-Zeile (`#hoursGrid`) ist 343 px breit, `overflow:hidden`, Endzeit-Feld (`#wh-end-0`) reicht bis x=433 und ist abgeschnitten. Erwartet: Zeile passt oder bricht um. Nicht M1–M7, aber im selben Bildschirm wie Räume und Sondertage. Register: Abschnitt „Mobil 390 px" | erledigt (live geprüft 01.11., 390 px ohne Überlauf) | — | **mobil-ui**, canli-test | Endzeit-Feld bei 390 px vollständig sichtbar, kein Überlauf |
| F4 | **Live-Test Mobil:** Monatsansicht bei 390 px: Sondertag-Etikett „Praxis geschlossen“ (81 px) in der 47 px breiten Monatszelle abgeschnitten. Korrektur `dashboard.css` (`8d942bb9`). Register: „Nachprüfung und Rest-Checkliste S2“ | erledigt (live geprüft 01.11., 390 px: Etikett 33 px in 47-px-Zelle, Auslassung, kein Überlauf) | — | **mobil-ui**, canli-test | Etikett in Monatszelle bei 390 px mit Auslassung, kein Abschneiden |
| F5 | **Live-Test S7 (Raum-Tagesansicht):** Termine mit gesetztem `room_id` erscheinen im Raum-Modus ALLE in der Spalte „Ohne Raum“. Schritte: QA-Tenant, Terminkalender, Tag 10.11.2026 (Serientermin 15:00, DB: `room_id` = „QA Raum A2“), Umschalter „Raum“. Erwartet: Termin in Spalte „QA Raum A2“. Tatsächlich: Spalte „QA Raum A2“ leer, Termin unter „Ohne Raum“. **Ursache (Code gelesen, nicht geändert):** `module/raum-tagesansicht.js:298` liest mit `TERMIN_SELECT` aus `module/termin-laden.js:70`, und dort fehlt `room_id`; `spaltenModell` (Z. 83/88) sieht `undefined`. Die Tests nutzen Fixtures mit `room_id` und fangen das nicht. Korrektur: `room_id` an die Raum-Abfrage anhängen (`${TERMIN_SELECT},room_id`) plus Test, der das echte Select prüft. Danach Live-Nachprüfung durch Live-Test | offen | — | |
| F6 | **Live-Test Backend (SaaS):** Der Backend-Build `publish-calendar-api` ist seit S6 (`8e239319`) und S-58 (`4ec006e5`) ROT, es gibt kein neues Image. Folge: S6-Backendteil und S-58/S-59 sind live NICHT wirksam (Beweis: `POST /booking/ai-suggest-series` mit erfundener `employeeId` liefert live 200 statt 400). Ursache: `api-backend/booking/auth-handlers.test.js` baut den vm-Kontext (ab Z. 108) ohne `planErlaubt` (und `ladeStandortPlan`), die `server.js` seit S6 in `batch-create`/`manual-create` etc. aufruft: `ReferenceError: planErlaubt is not defined` (3 Tests: Z. 307, 356, 403). Lokal reproduzierbar: `cd api-backend && node --test booking/auth-handlers.test.js`. Korrektur: beide Funktionen aus `./lib/standort-plan-laden.js` in den Kontext aufnehmen, danach `npm test` in `api-backend`. Nach grünem Build prüft der Live-Test S-58 erneut | offen | — | |

Nicht im Autopilot: Ops #202 HMV13 „+"-Button (Kemals Bereich Verordnung → erst Absprache), #242 QA-Konten löschen (rote Linie), M3-Abnahme (nur echte Box).

## Blocker und Nacharbeit (Stand 01.11.2026, Melih + Claude)

1. **Supabase-MCP „Unauthorized"** (Hauptsitzung und Agenten): Live-Prüfung (`select to_regclass('public.mitarbeiter_anstellung')`) und jede Live-Migration gehen erst, wenn der MCP-Token wieder gültig ist. Melih erneuert ihn.
2. **`npm test` ist auf `main` rot, nicht durch den Autopilot verursacht:**
   `module/import-versionen.test.js` „Modulgraph" meldet `module/podologie-positionen.js` unter zwei URLs
   (`?v=20260902` in `dashboard.js:95` und `module/verordnung-detail.js:80`, `?v=20261022auth1` in `module/abrechnung-auswahl.js:69`;
   Ursache: gesicherte Arbeit vom 22.10., Commit `ce098678`). Dazu der ungetrackte Test
   `module/billing-loader-503.test.js` einer anderen Sitzung (11 rote Fälle). Beides gehört nicht zu Planung; bis geklärt, wer es behebt,
   gilt für den Autopilot: `npm test` darf **genau diese Fehler** zeigen und sonst nichts; jede weitere rote Zeile = stoppen.
3. ~~**GO 0096** steht aus~~ erledigt: 0096 + 0097 live 01.11.2026.

> **Update Kemal-Sitzung 01.11.2026:** Blocker 2 behoben. `podologie-positionen.js` jetzt unter einer URL (`9f7de78d`); `S:01012` auch aus `regel-schwere.js` entfernt (fehlte nach `ce098678`, Ops #340). `npm test` frontend 2350/0, backend nur die bekannten Windows-Faelle (ai/m4-*, ki-einwilligung). `billing-loader-503.test.js` liegt nicht im Repo. Blocker 1 (MCP) betrifft nur Melihs Maschine — in Kemals Sitzung ist der MCP gueltig.

**S1 Entwurf liegt uncommittet im Arbeitsbaum** (nicht anfassen, nicht überschreiben):
`api-backend/db/migrations/0096_mitarbeiter_anstellung.sql` (auf frischer DB getestet, guvenlik: keine kritische/hohe Lücke),
`api-backend/db/erwartete-zaehler.json`, `api-backend/dsgvo/klassifikation.js` (Eintrag auskommentiert), `db/REGISTER.md`, `onprem/REGISTER.md`.
**Nach GO in EINEM Commit:** Migration live (MCP) → Marker `-- SaaS: angewandt <Datum>, MCP.` → `db/SCHEMA*.sql` neu → Eintrag in `klassifikation.js`
einkommentieren → **`{ table: 'mitarbeiter_anstellung', filter: 'owner_id' }` in `api-backend/dsgvo/loeschen.js` (Liste `einfacheLoeschTabellen`, ~Z. 533)
ergänzen** (guvenlik M1: sonst bleiben Vertragsdaten nach Kontolöschung stehen) → `node tools/tabellenkarte.mjs`, Tests, Push.
legal-de 01.11.: Kategorie `loeschen`, keine eigene Frist, Modell Inhaber-schreibt/Mitarbeiter-liest-eigene-Zeile reicht. Pflicht: BEIDE Tabellen (`mitarbeiter_anstellung`, `employee_standort_plan`, Filter `owner_id`) in `loeschen.js`; Zeilen löschen, wenn Mitarbeiter aus dem Team entfernt wird; Hilfetext „Praxura ist kein Lohn- oder Arbeitszeiterfassungssystem …"; Einzeltag-Zeilen älter 12 Monate später bereinigen (niedrig). guvenlik 0097: Mandantengrenze hält; Testlücken ergänzen (UPDATE owner_id/employee_id auf fremden Wert, fremder UPDATE/DELETE, ON CONFLICT als Fremder); optional `REVOKE REFERENCES, TRIGGER` von authenticated. S-58/S-59 behoben (server.js). Offen für Melih: darf nur der Inhaber schreiben (so im Entwurf; im Code gibt es keine Standortleiter-Rolle).
Optional (niedrig): `ladeAnstellung` soll für Nicht-Inhaber bei fremder `empId` „nicht sichtbar" statt Vorgabe 30 Tage liefern (`module/anstellung.js:164`).


## Abstimmung Autopilot-Chat ↔ Live-Test-Chat (01.11.2026, Stand nach S7)

Ziel Autopilot-Chat: M4a–M4d, M2b, M5-Fix bis zum zweiten Standort (Ende Dez) live bringen; M6-Mail erst nach E13.
Gepusht und **live ungetestet** (bitte Live-Test-Chat im QA-Tenant prüfen, Ergebnis in `canli-test/REGISTER.md`, Fehler als `F`-Scheibe hier):
- **S7:** Tagesansicht-Umschalter „Therapeut | Raum" (`module/raum-tagesansicht.js`), Hinweiszeile „Frei zu dieser Zeit" im Terminformular.
- **S6:** Standort-Filter (Tagesansicht, `getAvailableSlots`, `ai-suggest-series`, `batch-create`) — ohne Tabelle `employee_standort_plan` = altes Verhalten, also jetzt nur auf Regression prüfen (Kalender, Online-Buchung, Serie unverändert).
- **S-58/S-59:** `ai-suggest-series` prüft IDs gegen den Mandanten → Serienvorschlag im QA-Tenant einmal durchspielen (Service, Mitarbeiter, Patient).
- **F1 zurückgezogen** (Live-Test-Chat, 01.11.: Testfehler, Meldung steht in `#bkSaveError`). Nicht weiter suchen.
Wartet auf Melih: neuer Supabase-Token + Neustart, dann 0096/0097 live (Autopilot-Chat macht das, Live-Test danach M5/M4).

## Fehlerkanal Live-Test-Chat → Autopilot

Der Chat „Live-Test" trägt gefundene Fehler hier als neue Scheibe `F1`, `F2`, … mit Status `offen` in die Warteschlange ein
(Ekran, Schritte, erwartet/tatsächlich, Verweis auf `canli-test/REGISTER.md`). Der Autopilot behandelt `F`-Scheiben vor `S`-Scheiben.

## Übergabe-Protokoll (Autopilot schreibt, neueste oben)

<!-- Format: JJJJ-MM-TT HH:MM · S# · Ergebnis · Commit · nächster Schritt / Blocker -->

- 2026-11-01 · S5 · Standortplan-UI (`module/standort-plan.js`, Reiter „Standorte“) · Regel korrigiert (`6906870d`): Wochentag ohne Häkchen = alle Standorte wie bisher (vorher „frei“, widersprach M4b). · **bitte Live-Test (QA-Tenant, Inhaber, ≥ 2 Standorte):**
  1. Team → Mitarbeiter öffnen → Reiter „Standorte“ sichtbar (als Mitarbeiter-Login: nicht sichtbar; bei nur 1 Standort: nicht sichtbar).
  2. Raster zeigt nur die Standorte, die im Reiter Info dem Mitarbeiter zugeordnet sind.
  3. Mo bei Standort A anhaken → Speichern → „Standortplan gespeichert ✓“. Kalender Standort B, nächster Montag, Tagesansicht: Mitarbeiter-Spalte fehlt (außer er hat dort einen Termin). Standort A: Spalte da. Dienstag: in beiden da.
  4. Online-Buchung Standort B, Montag: Mitarbeiter ohne Slots. Standort A: Slots da.
  5. Einen künftigen Montagstermin des Mitarbeiters in Standort B anlegen (vorher), dann Plan speichern → Dialog „Trotzdem speichern?“ + Warnliste (Datum, Zeit, Patient, Leistung, „gebucht: B“). Zeile antippen → Termin öffnet sich. Termin wird NICHT verschoben.
  6. Versetzen: Von/Bis = ein Montag, Ziel B, „Tage übernehmen“, Speichern → an diesem Montag in B sichtbar, in A nicht (Einzeltag gewinnt).
  7. Einzeltag „Entfernen“ + Speichern → wieder Wochenmuster.
  8. Alle Häkchen weg + Speichern → überall wie vorher.
  9. 390 px: Raster scrollt waagrecht, kein Seitenüberlauf.

- 2026-11-01 · S1+S3 · 0096 `mitarbeiter_anstellung` + 0097 `employee_standort_plan` **live** (Management-API mit gültigem Token; MCP-Prozess hielt noch den alten). Vorher frische Kette 0000–0097 + RLS-Probe (3 neue Fälle) grün; live RLS/Policies/Grants/Advisors geprüft. `db/SCHEMA*` voll aus Live-Katalog neu (alter Dump war von Hand fortgeschrieben, u. a. fehlte `bookings.room_id → rooms`). · **bitte Live-Test:** (1) M5: Team → Mitarbeiter → Reiter Urlaub: Vollzeit/Teilzeit, Wochenstunden, Urlaubsanspruch (z. B. 28) speichern, Seite neu laden → Werte bleiben, Resturlaub rechnet mit 28. Als Mitarbeiter einloggen: eigene Werte sichtbar, Kollegen nicht. (2) S6-Regression weiter ohne Planzeilen (Tabelle leer = altes Verhalten). M4-Pflege-UI (S5) kommt als Nächstes.

- 2026-11-01 · F6 · behoben: `api-backend/booking/auth-handlers.test.js` gibt `ladeStandortPlan`/`planErlaubt` (aus `lib/standort-plan-laden.js`) in den vm-Kontext · api-backend `npm ci && npm test` lokal 1743 pass / 0 fail · **bitte Live-Test** nach grünem `publish-calendar-api` + Watchtower: `ai-suggest-series` mit erfundener `employeeId` → 400, erfundene `serviceId` → 400 (S-58); S6-Backend: Slots/Serie unverändert, solange kein Plan gepflegt ist.
- 2026-11-01 · F5 · live bestätigt (Live-Test-Chat): 10.11. 15:00 in „QA Raum A2“, „Frei zu dieser Zeit“ korrekt.

- 2026-11-01 · F5 · behoben: Raum-Modus nutzt `RAUM_TAGES_SELECT` (= TERMIN_SELECT + `room_id`), Test prüft Select-Konstante und Aufrufstelle · Cache-Version `?v=20261101b` (dashboard.js → planung-bruecke → raum-tagesansicht) · **bitte Live-Test:** nach Deploy Seite hart neu laden, Tagesansicht 10.11. → Raum → Termin 15:00 steht in Spalte „QA Raum A2“, „Ohne Raum“ nur für Termine ohne Raum.

- 2026-11-01 · Blocker · Supabase-Token in `~/.zshenv` ungültig (API direkt 401, nicht nur MCP) → 0096/0097 NICHT live, nichts davon committet (Entwürfe nur im Arbeitsbaum). Melih muss neuen Token setzen + T3 neu starten. Keine Live-Migration ohne Melihs GO und nur per MCP.
- 2026-11-01 · **bitte Live-Test (S7, `1abeacc6`…`be9de2d8`, schon deployt, wenn Vercel durch):** (1) Tagesansicht → Umschalter „Therapeut | Raum" → Raumspalten zeigen Termine, Wechsel zurück stellt Therapeutenansicht her. (2) Neuer Termin, Raum + Zeit wählen → Zeile „Frei zu dieser Zeit: …" erscheint. (3) S6-Regression: Kalender, Online-Buchung, Serie unverändert (Tabelle `employee_standort_plan` existiert noch nicht = altes Verhalten). (4) S-58/S-59: Serienvorschlag (Service, Mitarbeiter, Patient) einmal durchspielen; fremde/fehlende Service-ID darf nicht gehen. (5) F4 Monatszelle 390 px nach Deploy. Nicht gebaut/ungeprüft erwartet: Mitarbeiterfilter im Raummodus, klickbare Leerslots, Jetzt-Linie.
- 2026-11-01 · Hinweis M7 · Kemal hat in `17a966c2` den Einbettungscode aus dem Termin-Anfragen-Panel entfernt → M7-Plan beachtet das, kein Einbettungscode-UI mehr bauen.
