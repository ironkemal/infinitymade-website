---
titel: Physio-Pilot Planung — Umsetzung M1, M2a, M3, M5, M6a, M7
typ: sitzung
angelegt: 2026-10-31
autor: Melih + Claude Code
tags: [sitzung, physio, p1, pilot, raumplan, rooms, mehrstandort, resturlaub, sondertage, widget, planung]
---

# Physio-Pilot Planung: Umsetzung 30./31.10.2026

> **Erkennungswörter:** Raumplan · rooms · Raum-Streifen · „wer ist in welchem Raum" · O-224 · Resturlaub · Teilzeit ·
> Sondertag · Anrufliste · Einbettungscode · Widget · planung-bruecke.

Plan: `Physio/PLANUNG-UMSETZUNG.md` (§2a geht vor). Gespräch: [[2026-10-30_p1-erstgespraech-physio-demo]].

Status: **lokal gebaut und getestet, nicht live.** Tests: Frontend 2264, Backend 1660, Tools 318, Merkez 107, Browser-Probe 46/46
mit gefälschter Datenbank, Migrationskette auf frischer Datenbank samt Rechtetest. **Nicht geprüft:** echtes Dashboard mit Login,
echte Box, echter Mailversand.

## Was gebaut wurde

| Paket | Ergebnis |
|---|---|
| M1 | `rooms`, `bookings.room_id`, Verwaltung im Panel Verfügbarkeit, Raumwahl in Termin, Serie, Aktionspanel |
| M2a | Streifen „Jetzt" über dem Kalender: Raum, Therapeut-Kürzel, Restzeit, „n Termine ohne Raum" |
| M3 | Mehrstandort in der Box, Bestätigung „dieselbe Rechtsperson", ehrlicher Freigabe-Text |
| M3b | Modulrechte schreibt nur der Inhaber |
| M5 | `mitarbeiter_anstellung`, Resturlaub nach echten Arbeitstagen, Warnung bei Abwesenheit ohne Grund |
| M6a | Sondertage in Tag/Woche/Monat, Warnung, Anrufliste. Kein Mailversand |
| M7 | Einbettungscode, Host folgt der Dagitim |

Offen: M2b Raumspalten, M4 Wochenmuster und Filter, M6b/c Mail nach E13.

## Warum so

- **Warnung statt Sperre:** Wärme und Fango laufen parallel, daher `rooms.plaetze`. Eine harte Sperre wäre Dauerärger.
- **Der Raum setzt den Standort.** Die Datenbank leitet `business_id` sonst aus der Mitarbeiterzuordnung ab, meist den Standard-Standort,
  und der Trigger wiese einen Raum an Standort B ab. Fiel erst beim Lesen von `set_bookings_business_id_default` auf.
- **Keine Änderung an `TERMIN_SELECT`.** `:stable` und `:beta` können auseinanderlaufen (O-222). Ein fehlendes Feld dort legte den ganzen Kalender lahm.
  Räume laden in eigener Abfrage und fallen weich aus.
- **Streifen ohne Patientennamen**, gegen die physio-Empfehlung: Name ist Gesundheitsdatum, der Bildschirm kann einsehbar sein (legal-de).
- **Anstellung nicht in `profiles`:** teamweit lesbar, Positivliste aus 0091.
- **Wochenmuster nicht in `working_hours`:** anonym lesbar, Veto guvenlik. Geht als neue Tabelle.

## Gefundene Altfehler

- **Resturlaub:** `time_offs.start_date` ist ein Zeitstempel. `countWorkDays` hängte `T12:00:00` an, das ergab ein ungültiges Datum.
  Verbrauchter Urlaub stand immer auf 0, die Liste zeigte „Invalid Date".
- **`saveSpecialDays`:** zählte lokal weiter, zur Zeitumstellung kam ein Datum doppelt und der Upsert scheiterte.
- **Sondertag-Konfliktdialog:** Name aus öffentlicher Buchung ungefiltert in `innerHTML`.
- **O-224 war unvollständig:** zweite Sperre beim Speichern, und das Box-Setup legt gar keine `businesses`-Zeile an.

## Lernpunkte für die Arbeitsweise

- Sechs parallele Berater sprengen ein 5-Stunden-Fenster. Abgebrochene Agenten lassen sich per Nachricht fortsetzen, ihre Recherche bleibt erhalten.
- Eine Worker-Anleitung mit Abnahmeszenarien liefert brauchbaren Code, aber der Review fand Fehler, die alle grünen Tests übersahen:
  UTC-Zeit in der Anrufliste, Raumverlust beim Speichern, Rennen im Beobachter.
- Pre-Commit führt nicht alle Tests aus. `npm test` vor jedem Commit bleibt Pflicht.

## Offen

- Live-Anwendung 0092–0094 und Push warten auf das GO.
- Einwilligungstext E13, DATEV im Plan, Foto-Rezeptscan, Fragen an P1: `Physio/PLANUNG-UMSETZUNG.md` §6.
- Gruppen-Kinder tragen weder Raum noch Standort des Elterntermins.
- Vor Verteilung des Widgets: Punkte aus der guvenlik-Prüfung (Quelle der Anfrage, `accepts_bookings`, Client-IP).
