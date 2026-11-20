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

## QA-Nachprüfung und Korrekturen

Codecommit `5d4de74d` behebt die bei der Nachprüfung gefundenen Fehler.

- **Anwesenheit.** Bei mehreren Standorten bleibt Einchecken bis zur Auswahl gesperrt. Ein laufender Check-in verhindert Standortwechsel und Doppelanfragen. Bei fehlgeschlagenem Laden der Standorte bleibt der Check-in gesperrt. Browserprüfung auf Desktop, Tablet und Mobil umfasst GPS-freies Ein- und Auschecken, Einzelpraxen und historische Zeitnachweise.
- **Terminplanung.** Die Vorprüfung verwendet dieselbe Raumwahl wie das Speichern. Bei automatischer Zuweisung können Serien und verschobene Termine auf andere freie Räume ausweichen. Bewusst gewählte Räume bleiben verbindlich. Eine unveränderte manuelle Altbelegung mit vollständigem Leistungsstand darf nach Hinweis bearbeitet werden. Ohne gespeicherten Leistungsstand bleibt die Sperre bestehen.
- **Physio-Serien.** Erfolgreich erstellte Termine werden der gewählten Verordnung zugeordnet. Ein bedingtes Update schützt bereits zugeordnete Sitzungen. Die Oberfläche meldet fehlende Zuordnungen.
- **Tests.** Lokal bestanden 5.763 JavaScript-Tests, 50 PostgreSQL-Integrationstests, Typprüfung, Git-Hooks und die vollständige Chromium-Suite. Raumplanung 75/75, Physio 41/41. Der Test für den Mitteilungsdeckel hält die Transaktion bis zur Timeout-Gegenprobe offen. Die Box-nahe Kette wandte 128 Migrationen an und bei Wiederholung 0.

[QA-Tagesprotokoll](../../fortschritte/2026-11-20.md#physio-qa-nach-dem-saas-deploy) · [Checkliste für die fachliche Live-Abnahme](../../canli-test/2026-11-19-physio-launch-checkliste.md)

## SaaS-Schema und offene Abnahme

Am 20.11.2026 wurden 0124–0129 nach Freigabe gemeinsam angewandt. Der vorausgehende Probelauf rollte vollständig zurück. Die Supabase-Historie führt den Lauf als `20261120212231 praxura_0124_bis_0129_physio_qa`. Der anschließende Katalogabgleich bestätigte die Abschlussfunktion, die Fachtrigger, den Zeitraumschutz und die Einzelbelegung aus 0129. Beide SaaS-Strukturdateien wurden aus demselben Live-Katalog erzeugt.

Technisch bestätigt sind die Rechte für den atomaren Sitzungsabschluss und die browserseitige GPS-Sperre der Anwesenheitsseite.

- **QA** prüft mit einem Physio-Testkonto einen gültigen Sitzungsabschluss und den Zuzahlungsablauf anhand der Live-Checkliste.
- **Praxura-Betrieb** übernimmt den Nachzug fehlender Sitzungen für Bestandsverordnungen nach separater Freigabe.
- **Praxura-Team und jeweilige Praxis** klären die Rechnungsvorgaben gemeinsam.
