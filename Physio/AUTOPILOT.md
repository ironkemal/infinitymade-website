# Autopilot „Planung" (M1–M7) — Warteschlange und Steuerung

> Angelegt 01.11.2026 (Melih + Claude Code). Wird von einer T3-geplanten Aufgabe abgearbeitet:
> jeder Lauf = **frische Sitzung** (leerer Kontext), nimmt **eine** Scheibe, endet mit Commit/Push und Übergabe hier.
> Repo public: keine Namen, Städte, Preise, Zugangsdaten. Grundlage: `Physio/PILOT-PLAN.md`, `Physio/PLANUNG-UMSETZUNG.md`
> (§2a geht vor), Übergabe: `wissensbank/sitzungen/2026-10-30_kemal-uebergabe-physio-pilot-planung.md`.

## Steuerung (Melih schreibt hier)

- Autopilot: **AUS** (bis Blocker unten gelöst; zum Starten auf `AN` setzen) ← auf `AUS` setzen stoppt jeden weiteren Lauf
- GO Live-Migrationen (Melih setzt `[x]`, Autopilot wendet dann per MCP an):
  - [ ] GO 0096 `mitarbeiter_anstellung` (S1)
  - [ ] GO M4a `employee_standort_plan` (S3)
  - [ ] GO M6b Sondertag-Mitteilungsprotokoll (S8)

## Rechte (Melih, 01.11.2026)

| Darf allein | Nur mit GO oben | Nie |
|---|---|---|
| bauen, testen, committen, **pushen** grüner Scheiben (= live) | Migration live anwenden (MCP) | Daten löschen · Kemals Bereich ändern (Verordnung, Akte, Vorlagen, Rechnungsmail/Fax, KI, Diktat, Befund, Box, §302) · gemeinsame Module (`nav-registry.js`, `calendar-widget.js`, `patient-suche.js`, `katalog-suche.js`) ohne Kemal · Secrets |

## Warteschlange

Status: `offen` · `läuft` · `wartet-GO` · `blockiert` · `fertig`. Reihenfolge = Priorität; blockierte überspringen.

| # | Scheibe | Status | Abhängig | Agenten (Pflicht fett) | Fertig wenn |
|---|---|---|---|---|---|
| S1 | **M5-Fix:** Migration `0096_mitarbeiter_anstellung` (Kollegen lesen nichts, nur Inhaber schreibt, Mitarbeiter liest eigene Zeile), `klassifikation.js`, `db/REGISTER.md`, lokal frische DB | wartet-GO (Entwurf fertig, nicht committet) | — | **db-ustasi**, **guvenlik**, **onprem** | Datei + Tests grün → `wartet-GO`; nach GO: live, `db/SCHEMA*` neu, Commit+Push |
| S2 | Live-Test M1, M2a, M5, M6a, M7 im **QA-Tenant** (nie im P1-Testkonto I6) — **macht der Chat „Live-Test", Autopilot überspringt S2** | offen | S1 live | **canli-test**, physio | Einträge in `canli-test/REGISTER.md`; Fehler → neue Scheibe hier |
| S3 | M4a Migration `employee_standort_plan` (ohne anon, Tag-Granularität) | offen | — | **db-ustasi**, **guvenlik**, **onprem** | wie S1 |
| S4 | M4b Regel Einzeltag → Wochenmuster → alle zugeordneten Standorte, Backend `api-backend/lib/standort-plan.js` + Frontend `module/standort-plan-regel.js`, gemeinsame Testvektoren | offen | — | **fonksiyon-ustasi** | Beide Fassungen bestehen dieselben Vektoren |
| S5 | M4c UI: Wochenmuster, Einzeltag, „Versetzen" als ein Ablauf, Warnliste gebuchter Termine (nie automatisch verschieben) | offen | S3 live, S4 | **fonksiyon-ustasi**, physio, Skill `impeccable` | Montag A: in B nicht sichtbar; Einzeltag wirkt in beiden |
| S6 | M4d Filter Kalender + `getAvailableSlots` + Serienplaner; leere Tabelle/Lesefehler = altes Verhalten | offen | S5 | **onprem**, fonksiyon-ustasi | Tests + Browser-Probe grün |
| S7 | M2b Raumspalten (Umschalter Therapeut/Raum) + freie Räume im Terminformular | offen | S6 | physio, Skill `impeccable`, mobil-ui | Spalten je Raum; freie Räume gelistet |
| S8 | M6b Migration Mitteilungsprotokoll + Route Vorschau/Senden (`api-backend/routes/sondertag.js`): **nie automatisch** — System erstellt Vorschau, **Praxis-Mitarbeiter:in prüft und gibt frei, erst dann Versand** (Melih 01.11.2026; welche Rolle freigeben darf, klären guvenlik + legal-de — bisheriger Plan: nur Inhaber), Einzelmails, fester Text, nur mit Opt-in, Dedup in DB, Deckel je Lauf, kein Cron, über `api-backend/lib/mail.js` | blockiert | **Kemal: E13-Einwilligungstext um „Terminänderungen" ergänzen** | **db-ustasi**, **guvenlik**, **onprem**, legal-de | Route + Tests; Migration `wartet-GO` |
| S9 | M6c Dialog Vorschau, Abwahl je Empfänger, Anrufliste (ohne Opt-in/Adresse/SMTP) | blockiert | S8 | fonksiyon-ustasi, legal-de | Ablauf vollständig, Box ohne SMTP liefert Liste |
| F1 | **Live-Test M1:** Termin mit belegtem Raum, Hinweis „Raum belegt" bestätigen mit „Trotzdem eintragen": Termin wird nicht gespeichert, Formular bleibt offen, keine Meldung. (a) gleicher Therapeut: `POST bookings` 400 `no_overlapping_bookings` (Therapeuten-Sperre greift, UI zeigt nichts). (b) zweiter Therapeut `qa-mitarbeiter`, gleicher Raum und gleiche Zeit (09.11.2026 10:00): nach Bestätigung kein POST, Termin fehlt im Kalender, Ursache offen. Schritte: Terminkalender, + Termin, Raum „QA Raum A2" (Plätze 1), Zeit mit vorhandenem Raum-Termin, Speichern, Trotzdem eintragen. Erwartet: Termin gespeichert, sonst klare Meldung. Register: `canli-test/REGISTER.md` Abschnitt „Räume (M1)" | offen | — | **canli-test**, fonksiyon-ustasi | Beide Fälle liefern Termin oder verständliche Meldung |

Nicht im Autopilot: Ops #202 HMV13 „+"-Button (Kemals Bereich Verordnung → erst Absprache), #242 QA-Konten löschen (rote Linie), M3-Abnahme (nur echte Box).

## Blocker und Nacharbeit (Stand 01.11.2026, Melih + Claude)

1. **Supabase-MCP „Unauthorized"** (Hauptsitzung und Agenten): Live-Prüfung (`select to_regclass('public.mitarbeiter_anstellung')`) und jede Live-Migration gehen erst, wenn der MCP-Token wieder gültig ist. Melih erneuert ihn.
2. **`npm test` ist auf `main` rot, nicht durch den Autopilot verursacht:**
   `module/import-versionen.test.js` „Modulgraph" meldet `module/podologie-positionen.js` unter zwei URLs
   (`?v=20260902` in `dashboard.js:95` und `module/verordnung-detail.js:80`, `?v=20261022auth1` in `module/abrechnung-auswahl.js:69`;
   Ursache: gesicherte Arbeit vom 22.10., Commit `ce098678`). Dazu der ungetrackte Test
   `module/billing-loader-503.test.js` einer anderen Sitzung (11 rote Fälle). Beides gehört nicht zu Planung; bis geklärt, wer es behebt,
   gilt für den Autopilot: `npm test` darf **genau diese Fehler** zeigen und sonst nichts; jede weitere rote Zeile = stoppen.
3. **GO 0096** steht aus (Kästchen oben).

> **Update Kemal-Sitzung 01.11.2026:** Blocker 2 behoben. `podologie-positionen.js` jetzt unter einer URL (`9f7de78d`); `S:01012` auch aus `regel-schwere.js` entfernt (fehlte nach `ce098678`, Ops #340). `npm test` frontend 2350/0, backend nur die bekannten Windows-Faelle (ai/m4-*, ki-einwilligung). `billing-loader-503.test.js` liegt nicht im Repo. Blocker 1 (MCP) betrifft nur Melihs Maschine — in Kemals Sitzung ist der MCP gueltig.

**S1 Entwurf liegt uncommittet im Arbeitsbaum** (nicht anfassen, nicht überschreiben):
`api-backend/db/migrations/0096_mitarbeiter_anstellung.sql` (auf frischer DB getestet, guvenlik: keine kritische/hohe Lücke),
`api-backend/db/erwartete-zaehler.json`, `api-backend/dsgvo/klassifikation.js` (Eintrag auskommentiert), `db/REGISTER.md`, `onprem/REGISTER.md`.
**Nach GO in EINEM Commit:** Migration live (MCP) → Marker `-- SaaS: angewandt <Datum>, MCP.` → `db/SCHEMA*.sql` neu → Eintrag in `klassifikation.js`
einkommentieren → **`{ table: 'mitarbeiter_anstellung', filter: 'owner_id' }` in `api-backend/dsgvo/loeschen.js` (Liste `einfacheLoeschTabellen`, ~Z. 533)
ergänzen** (guvenlik M1: sonst bleiben Vertragsdaten nach Kontolöschung stehen) → `node tools/tabellenkarte.mjs`, Tests, Push.
Offen für legal-de: Aufbewahrungsfrist der Vertragsdaten (Entwurf nimmt „keine eigene Frist" an). Offen für Melih: darf nur der Inhaber schreiben (so im Entwurf; im Code gibt es keine Standortleiter-Rolle).
Optional (niedrig): `ladeAnstellung` soll für Nicht-Inhaber bei fremder `empId` „nicht sichtbar" statt Vorgabe 30 Tage liefern (`module/anstellung.js:164`).

## Fehlerkanal Live-Test-Chat → Autopilot

Der Chat „Live-Test" trägt gefundene Fehler hier als neue Scheibe `F1`, `F2`, … mit Status `offen` in die Warteschlange ein
(Ekran, Schritte, erwartet/tatsächlich, Verweis auf `canli-test/REGISTER.md`). Der Autopilot behandelt `F`-Scheiben vor `S`-Scheiben.

## Übergabe-Protokoll (Autopilot schreibt, neueste oben)

<!-- Format: JJJJ-MM-TT HH:MM · S# · Ergebnis · Commit · nächster Schritt / Blocker -->
