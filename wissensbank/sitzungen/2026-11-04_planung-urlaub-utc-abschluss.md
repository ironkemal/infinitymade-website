---
titel: Planung M4/M5/M7 und expliziter UTC-Vertrag für Urlaub
typ: sitzung
angelegt: 2026-11-04
tags: [sitzung, planung, urlaub, zeitzone, qa]
---

# Planung: konsolidierte Fortsetzung und Nachweisgrenzen

Eigene Sitzungsnotiz, keine externe Fachquelle. Quellen: `Physio/PILOT-PLAN.md`, `Physio/AUTOPILOT.md`, `Physio/ABNAHME-RESTSTAND.md`, `Physio/URLAUB-UTC-NACHWEIS.md` und [[2026-11-03_raumplanung-release-und-pruefung]]. Stand der dort dokumentierten Arbeit; hier keine Tests oder Liveprüfung wiederholt.

## Was gebaut und warum geändert wurde

- **M4 / Standorte:** gespeicherter `bookings.business_id` filtert Tag/Woche/Monat; NULL-Altbestand bleibt sichtbar. Veraltete Tages-/Monatsantworten dürfen neueren Datum-/Team-/Standort-/Ansichtszustand nicht überschreiben. Einzelmitarbeiter und verifiziert leere Einsatzpläne werden berücksichtigt; bestehende Standorttermine halten ihre Spalte sichtbar.
- **M5 / Anstellung und Urlaub:** Inhaber und persönliche Mitarbeiteranzeige verwenden zentrale Jahresbegrenzung und Deduplizierung überlappender Urlaubstage. Fehler oder fehlende Arbeitszeiten ergeben keinen erfundenen Saldo; erfolgreich geladene Abwesenheiten bleiben sichtbar/löschbar. „Mein Urlaub“ nutzt denselben validierten Arbeitszeitloader. Anzeige bleibt für Mitarbeiter nur lesend.
- **M7 / Widget:** spätere Entscheidung `17a966c2` gilt: Support-Hinweis im Praxis-Panel, gemeinsames Setup durch Team. Vorhandener Generator bleibt Team-Werkzeug; kein neuer Praxis-Codegenerator. Technische Fremd-Origin-Ladungen und synthetische Formularprüfungen ersetzen keine vollständige Anfrageabnahme im eindeutig bestätigten QA-Mandanten.

## Veröffentlichung und getrennte lokale Nachprüfung

Planungskorrekturen bis `ddfa3cc9` sind laut Release-Übergabe veröffentlicht; öffentliche Dateien wurden bytegleich verglichen. Einzelheiten und historische Raum-/Migrationsbelege stehen in [[2026-11-03_raumplanung-release-und-pruefung]]. Dieser Auslieferungsnachweis ist keine funktionale Kontoabnahme. 0103/0104 nicht erneut anwenden.

**UTC-Fix `82cc6189`: zum Zeitpunkt dieser Notiz lokal committet, noch kein neuer Veröffentlichungsnachweis.** Drei tatsächliche `time_offs`-Schreibpfade (Kalender-Abwesenheit, Teamliste, Mitarbeiterdetail) senden explizites `T00:00:00Z`. Grund: reine Datumswerte werden von `timestamptz` in Sessionzeitzone interpretiert. Isoliertes PostgreSQL reproduzierte vor Fix bei `Europe/Berlin` einen gewählten 01.01. als 31.12. UTC in allen drei Pfaden. Explizites UTC bewahrt bestehenden Kalendervertrag; Altbestände bleiben unverändert, keine Schemaänderung.

Reproduktion:

```sh
PRAXURA_URLAUB_DATUM_PG_TEST=1 node --test api-backend/db/urlaub-datum.integration.test.js
```

Dokumentiertes Ergebnis: **7/7 PostgreSQL-Tests ohne Skip**, 30 Roundtrips (drei Writer × zwei Sessionzeitzonen × vier Grenztage plus Teilzeit-Jahresüberhang), **55 gezielte Regressionen**, Dashboard-Build und Commitprüfungen grün. Echte INSERT-Objekte werden aus aktuellem Dashboard ausgewertet; PostgreSQL-JSON-Rückgabe geht an tatsächliche Saldo-/Kalenderfunktionen. Eigenständiger Container ohne Netzwerk/Ports/Volumes, danach entfernt. Unabhängiger Code-Reviewer bestätigte Oracle und Ansatz; empfohlener Teilzeit-Jahresüberhang wurde ergänzt.

Aus früherer Planungskorrektur: sieben Tagesantwort-Regressionen und drei Arbeitszeit-Grenzfälle zuerst rot, danach grün; Frontend 2659/2659, isolierte tatsächliche DOM-Probe 22/22 bei 390/1280px. Diese Zahlen gehören zum jeweiligen dokumentierten Lauf und werden nicht zu einer neuen Gesamtabnahme addiert.

## Grenzen und nächste Zuständigkeit

- **Funktionale Live-QA offen:** ausschließlich bestätigter separater QA-Mandant samt autorisiertem Mitarbeiter; zuständiger Live-QA-/Release-Chat. Keine vollständige QA-Abnahme aus lokalen Fixtures oder ausgelieferten Dateien ableiten.
- **UTC-Test begrenzt:** keine Browser-Speicherhandler, kein PostgREST-Transport, keine RLS-Policies der Produktdatenbank und keine aktuelle Live-Sessionzeitzone geprüft. Keine Aussage, dass produktive Datensätze bereits verschoben sind; keine Legacy-Umdeutung. Technische Details: `Physio/URLAUB-UTC-NACHWEIS.md`.
- **Mail STOP bleibt:** kein Versand, keine Ersatzkonfiguration oder automatische Aktivierung. Mail-Migration 0105 und tatsächliche KI-Freigabe bleiben getrennte offene Aufgaben beim zuständigen Release-Chat.
- **Isolierte installierte Box zuletzt:** lokale Speicher-/Planproben ersetzen weder installierte PostgreSQL-RLS noch Browser-Switcher, Neustart und Persistenz. Ablauf: `tools/box-standort-abnahme.md`.
- **Beratung begrenzt:** DB-Berater lieferte strukturelle Quellenbelege, brach danach wegen Provider-Nutzungslimit ab; kein vollständiges unabhängiges DB-Sign-off. Funktionsberatung und Code-Review abgeschlossen.

Fortlaufende Quellen statt doppelter Statuspflege: `fortschritte/2026-11-03.md`, `fortschritte/2026-11-04.md`, `canli-test/REGISTER.md`, `Physio/ABNAHME-RESTSTAND.md`. Diese Notiz enthält keine Zugangsdaten, Kontaktdaten oder Kundendaten.

## Integration vor freigegebenem Push

Remote-Physio-Fixes (e8247fd6, d71639e5, 54148111) mit lokaler UTC-Korrektur in Merge6a79d34 zusammengeführt. Protokollkonflikt erhält beide Nachweise; Dashboard nutzt neue Cacheversion, Funktionskarte frisch erzeugt. Integrierter Lauf: Frontend2676/2676 ohne Skip, UTC-PostgreSQL7/7 ohne Skip, Dashboard-Bundle grün. Keine Migration oder Mail. Push vom Nutzer ausdrücklich freigegeben; endgültiger Git-/Auslieferungsstatus separat prüfen.
