---
titel: Physio-QA — Raumbelegung, Rechnungen, Zuweiser und Anwesenheit
typ: sitzung
datum: 2026-11-20
tags: [physio, raumplanung, rechnungen, zuweiser, anwesenheit]
---

# Physio-QA — Entscheidungen und Abnahme

- **Raumbelegung.** Je Raum und Zeitraum ist ein Haupttermin buchbar. Die Teilnehmenden desselben Gruppentermins teilen seinen Raum. Die Regel gilt für manuelle und automatische Zuweisung. Bestehende Überschneidungen bleiben im Kalender sichtbar. Die neue Migrationsdatei `api-backend/db/migrations/0129_raum_einzelbelegung.sql` ersetzt die frühere Kapazitätsregel aus 0127. Vorgeschichte in [[2026-11-19_physio-launch-stufe1-sitzung-auth-raeume-ueberblick]].
- **Rechnungen.** Die Vorgaben werden mit jeder Praxis einzeln geklärt. Die vorhandene Liste fehlender Praxisangaben unterstützt die Vorprüfung. Die Abstimmung verantworten die Praxis und das Praxura-Team.
- **Zuweiser.** Die vorhandene Ansicht bleibt verfügbar. Die Rollenzuordnung steht in `nav-registry.js`.
- **Anwesenheit.** Mitarbeitende öffnen „Ein- und auschecken“ über „Team“. Die App fordert keine GPS-Koordinaten an. Der Server ignoriert Koordinaten älterer Clients. Historische Zeitnachweise bleiben sichtbar.

## Nachweise

Vor der Freigabe lokal geprüft in Codecommit `0eef4585`. 5.760 Tests bestanden. Vier Datenbanktests waren übersprungen und drei bekannte TODOs blieben offen. Der Datenbank-Timeout-Test bestand separat im isolierten Container. Typprüfung und vollständiger Browserlauf waren grün. Darunter Raumplanung 64/64, Physio 41/41 und synthetische Anwesenheitsabläufe für Mitarbeitende und Praxisinhaber.

Die Box-nahe Migrationskette wandte 128 Dateien an. Bei Wiederholung kamen 0 hinzu. Ledger-Prüfsummen und Schemazähler stimmten. Die SQL-Probe prüfte parallele Buchung, Gruppenteilnahme, automatische Raumzuweisung und einen direkt anschließenden Termin.

## Offen

Der lesende SaaS-Schemaabgleich vom 20.11.2026 bestätigte, dass die Abschlussfunktion aus 0128 und die neue Raumregel aus 0129 fehlten. Der Code-Push aktiviert das Backend-Deployment. Betrieb und Datenbankverantwortliche gleichen deshalb 0124–0129 ab und wenden die ausstehenden Migrationen nach separater Freigabe an. Danach folgen Live-Abnahme im Physio-Testkonto und Kontrolle der Raumregel. Die Rechnungsvorgaben bleiben je Praxis zu klären.
