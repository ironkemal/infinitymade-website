---
titel: Kemals Übergabe an Melih nach dem P1-Gespräch — Bereich Planung (M1–M7)
typ: sitzung
angelegt: 2026-11-01
bezug: 2026-10-30
autor: Melih + Claude Code (Analyse einer Nachricht von Kemal, Original türkisch)
tags: [sitzung, physio, p1, pilot, uebergabe, planung, raumplan, mehrstandort, arbeitsteilung]
---

# Kemals Übergabe nach dem P1-Gespräch (30.10.2026)

> **Erkennungswörter:** Übergabe · Arbeitsteilung Kemal/Melih · „24 Funktionen: 9 / 11 / 4" · IST_KUTU ·
> „Dereyi geçerken at değiştirmiyoruz" · Raumplan-Entwurf pushen · zweiter Standort Ende Dez/Anfang Jan.

Quelle: Nachricht von Kemal an Melih (türkisch, Messenger, 30.10.2026), hier sinngemäß übersetzt und gegen
den Repo-Stand vom 01.11.2026 geprüft. Plan: `Physio/PILOT-PLAN.md`. Gespräch: [[2026-10-30_p1-erstgespraech-physio-demo]].
Umsetzung: [[2026-10-31_physio-planung-umsetzung]], `Physio/PLANUNG-UMSETZUNG.md`.

## 1. Inhalt der Nachricht

**Gesprächsergebnis**
- Kunde heißt im Repo nur **P1** (Repo public: kein Name, keine Stadt).
- P1 fragte **24 Funktionen** ab. Gegen den Code geprüft: **9 vollständig, 11 teilweise, 4 fehlen.**
- Fehlend waren: **Raumplan, Fax, Diktat (Sprache→Text), eigene Praxisdokumente unterschreiben lassen.**
- Größtes verstecktes Problem: In der Box waren die Mehrstandort-Screens unsichtbar — der Owner startet als
  `professional`, Standort-Screens öffnen nur bei Enterprise (O-224).

**Kemals Entscheidungen (nicht neu verhandeln)** — deckungsgleich mit `Physio/PILOT-PLAN.md` §1
- Server im **eigenen Hetzner-Konto der Praxis**; wir installieren, übergeben den Zugang **vor** den ersten Patientendaten.
- P1 = erster Physio-Kunde. Physio wird mit ihm fertig gebaut, aber **allgemein**, nicht kundenspezifisch.
- KI in der Box an (maskiertes Azure, Risikoakzeptanz). Foto-Rezept-OCR bleibt aus.
- Abrechnung darf die ersten Monate in THEORG bleiben.
- Weiter auf dem aktuellen Design (`main`); Redesign-Zweig wird später integriert („mitten im Fluss wechselt man nicht das Pferd").

**Am 30.10. erledigt (Kemal):** `required_certificate` für MT/MLD/KGG befüllt (vorher leer → Zertifikatsprüfung lief nie);
Arbeitsteilung + Konfliktregeln geschrieben; O-224/O-225 im onprem-Register.

**Melihs Bereich „Planung"** (Kalender · Raum · Standort · Team · Online-Termin): M1–M7, DoD je Paket in `Physio/PILOT-PLAN.md` §2.

**Kemals Bereich — nicht anfassen:** Verordnungsprüfungen, Patientenakte, Vorlagen/Unterschrift, Rechnungsmail + Fax,
KI, Diktat, Physio-Befund, Box-Infrastruktur, §302-Zulassung.

**Konfliktregeln (beide auf `main`)**
1. Migration: direkt vorher `git pull`, nächste Nummer nehmen, **Migrationsdatei allein sofort committen + pushen**, Code danach.
   Gleiche Nummer → wer später kommt, nummeriert um.
2. Generierte Dateien (`funktionen/INDEX.*`, `db/SCHEMA*.sql`) nie von Hand mergen: eigene Seite verwerfen, nach Pull neu erzeugen.
3. `dashboard.js`: nur Import-Zeile + Einzeiler-Anbindung, neue Logik in `module/`.
4. Gemeinsame Module (`nav-registry.js`, `calendar-widget.js`, `patient-suche.js`, `katalog-suche.js`): **vorher Kemal Bescheid geben.**

**Bitte an Melih:** lokalen Raumplan-Entwurf nach `main` bringen und pushen, M1 baut darauf auf. Redesign-Arbeit geht nicht verloren.
**Termin:** zweiter Standort von P1 öffnet **Ende Dezember / Anfang Januar.**

## 2. Abgleich mit dem Stand 01.11.2026

| Punkt aus der Nachricht | Stand | Beleg |
|---|---|---|
| Raumplan-Entwurf pushen | ✅ erledigt — nicht als Entwurf, direkt als M1 umgesetzt und gepusht | `0092_rooms.sql` (SaaS angewandt 31.10.), `module/raum-*.js` |
| M1 Raumplan | ✅ gebaut, live-Migration; Live-Klicktest fehlt | Ops #342 |
| M2 Raumspalten + Streifen + freie Räume | 🟨 Streifen (M2a) da; **Raumspalten (M2b) bewusst verschoben** (muhalif/deger-mi 31.10.) — Kemal nennt es „erste Frage des Kunden" | `Physio/PLANUNG-UMSETZUNG.md` §2a Nr. 6 |
| M3 Mehrstandort in der Box (IST_KUTU-Muster) | ✅ Code; prüfbar nur in echter Box | Ops #344 |
| M4 Wochenmuster + Einzeltag + „versetzen" | ❌ offen — größtes Paket, wichtig bis zum zweiten Standort | Ops #345 |
| M5 Teilzeit/Urlaubsanspruch/Warnung | 🔴 Code live, **Tabelle `mitarbeiter_anstellung` fehlt** (keine Migration, nicht live); nächste Nummer 0096 | `fortschritte/2026-10-31.md` „Offen" |
| M6 Sondertage + Mail an Patienten | 🟨 Anzeige (M6a) da. **Widerspruch:** Nachricht (30.10.) sagt Mail via K9-Helfer; Plan (Kemal 31.10.) sagt **keine automatische Mail**, Mitarbeiter informiert selbst. Neuere Entscheidung gilt bis Bestätigung | `Physio/PILOT-PLAN.md` §2 M6 |
| M7 Widget-Generator | ✅ gebaut; Live-Test fehlt | Ops #348 |

## 3. Folgerungen

- **Termin treibt M3 + M4**, nicht M2b: Am zweiten Standort braucht P1 Mitarbeiter-Zuordnung je Wochentag.
  M4 ist das kritische offene Paket.
- **M5 ist ein stiller Fehler im Live-System** — vor allem anderen beheben (Migration 0096, dann Live mit GO).
- Kemals Konfliktregel 1 (Migration allein sofort pushen) kollidiert mit dem Pre-Commit-Gate, das
  `-- SaaS: angewandt` verlangt → jede Migration braucht **vor** dem Commit das Live-GO.
- HMV13 „+"-Button (Ops #202) berührt die Verordnungsmaske = **Kemals Bereich** → nur nach Absprache.
- Ops-Karte #347 trägt noch den alten Text „+ hastalara mail" — anpassen, sobald M6-Mail-Frage geklärt ist.

## Offen

- M6-Mail: endgültig weg oder später (nach E13-Opt-in)? → Kemal.
- M2b Raumspalten: vor Ende Dezember oder nach dem Pilotstart?
- Fragen an P1 aus `Physio/PLANUNG-UMSETZUNG.md` §6 (gleiche Rechtsperson, IK je Standort, feste Räume) — Antwort steht aus.
