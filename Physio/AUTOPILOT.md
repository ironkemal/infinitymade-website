# Autopilot „Planung" (M1–M7) — Warteschlange und Steuerung

> Angelegt 01.11.2026 (Melih + Claude Code). Wird von einer T3-geplanten Aufgabe abgearbeitet:
> jeder Lauf = **frische Sitzung** (leerer Kontext), nimmt **eine** Scheibe, endet mit Commit/Push und Übergabe hier.
> Repo public: keine Namen, Städte, Preise, Zugangsdaten. Grundlage: `Physio/PILOT-PLAN.md`, `Physio/PLANUNG-UMSETZUNG.md`
> (§2a geht vor), Übergabe: `wissensbank/sitzungen/2026-10-30_kemal-uebergabe-physio-pilot-planung.md`.

## Steuerung (Melih schreibt hier)

- Autopilot: **AN**  ← auf `AUS` setzen stoppt jeden weiteren Lauf
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
| S1 | **M5-Fix:** Migration `0096_mitarbeiter_anstellung` (Kollegen lesen nichts, nur Inhaber schreibt, Mitarbeiter liest eigene Zeile), `klassifikation.js`, `db/REGISTER.md`, lokal frische DB | offen | — | **db-ustasi**, **guvenlik**, **onprem** | Datei + Tests grün → `wartet-GO`; nach GO: live, `db/SCHEMA*` neu, Commit+Push |
| S2 | Live-Test M1, M2a, M5, M6a, M7 im **QA-Tenant** (nie im P1-Testkonto I6) | offen | S1 live | **canli-test**, physio | Einträge in `canli-test/REGISTER.md`; Fehler → neue Scheibe hier |
| S3 | M4a Migration `employee_standort_plan` (ohne anon, Tag-Granularität) | offen | — | **db-ustasi**, **guvenlik**, **onprem** | wie S1 |
| S4 | M4b Regel Einzeltag → Wochenmuster → alle zugeordneten Standorte, Backend `api-backend/lib/standort-plan.js` + Frontend `module/standort-plan-regel.js`, gemeinsame Testvektoren | offen | — | **fonksiyon-ustasi** | Beide Fassungen bestehen dieselben Vektoren |
| S5 | M4c UI: Wochenmuster, Einzeltag, „Versetzen" als ein Ablauf, Warnliste gebuchter Termine (nie automatisch verschieben) | offen | S3 live, S4 | **fonksiyon-ustasi**, physio, Skill `impeccable` | Montag A: in B nicht sichtbar; Einzeltag wirkt in beiden |
| S6 | M4d Filter Kalender + `getAvailableSlots` + Serienplaner; leere Tabelle/Lesefehler = altes Verhalten | offen | S5 | **onprem**, fonksiyon-ustasi | Tests + Browser-Probe grün |
| S7 | M2b Raumspalten (Umschalter Therapeut/Raum) + freie Räume im Terminformular | offen | S6 | physio, Skill `impeccable`, mobil-ui | Spalten je Raum; freie Räume gelistet |
| S8 | M6b Migration Mitteilungsprotokoll + Route Vorschau/Senden (`api-backend/routes/sondertag.js`): nur Inhaber, nach Klick, Einzelmails, fester Text, nur mit Opt-in, Dedup in DB, Deckel je Lauf, kein Cron, über `api-backend/lib/mail.js` | blockiert | **Kemal: E13-Einwilligungstext um „Terminänderungen" ergänzen** | **db-ustasi**, **guvenlik**, **onprem**, legal-de | Route + Tests; Migration `wartet-GO` |
| S9 | M6c Dialog Vorschau, Abwahl je Empfänger, Anrufliste (ohne Opt-in/Adresse/SMTP) | blockiert | S8 | fonksiyon-ustasi, legal-de | Ablauf vollständig, Box ohne SMTP liefert Liste |

Nicht im Autopilot: Ops #202 HMV13 „+"-Button (Kemals Bereich Verordnung → erst Absprache), #242 QA-Konten löschen (rote Linie), M3-Abnahme (nur echte Box).

## Übergabe-Protokoll (Autopilot schreibt, neueste oben)

<!-- Format: JJJJ-MM-TT HH:MM · S# · Ergebnis · Commit · nächster Schritt / Blocker -->
