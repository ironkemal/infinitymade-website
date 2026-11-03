---
titel: Raumplanung, Veröffentlichung und erneute Prüfung
typ: sitzung
angelegt: 2026-11-03
tags: [sitzung, raumplanung, release, qa]
---

# Raumplanung: Umsetzung und belastbarer Stand

## Entscheidung und Verhalten

Räume erhalten Beschreibung und editierbare Ausstattungscheckliste. Leistungen definieren benötigte Ausstattung. Die Beschreibung dient nicht als Matchingregel. Automatische Zuordnung prüft Mandant, Standort, aktive Räume, Ausstattung und freie Kapazität. Manuelle Planung schlägt passenden Raum vor; bewusste manuelle Auswahl bleibt möglich. Haupt- und Zusatzleistungen werden gemeinsam berücksichtigt, Gruppen übernehmen den Elternraum. Hausbesuche und reine Onlineleistungen benötigen keinen Praxisraum.

Einstieg: Verfügbarkeit → Raumverwaltung; Anforderungen in den Leistungseditoren. Öffentliche Bestätigung nennt zugeordneten Raum. Öffentliche Slots filtern Raumkapazität noch nicht vorab: frische Prüfung beim Buchen, fehlender Raum ergibt HTTP409. Explizite manuelle Überbelegung bleibt möglich.

## Veröffentlichung und Supabase

- Raumfeature `a95d8339`, Gruppenfehlerkorrektur `c7a4a56d`, Release `8d46226f`; tatsächlicher Schemaexport `6f462002`.
- Aktueller geprüfter Frontend-Produktstand `ddfa3cc9`: alte Tagesantworten werden nach Datums-/Team-/Standort-/Ansichtwechsel verworfen; persönliche Urlaubskarte verwendet validierte Arbeitstage. Workflow41714326862 erfolgreich, Vercel-Hauptprojekt veröffentlicht. Zweites Vercel-Projekt durch Ignored Build Step übersprungen.
- Fünf Dateien erneut per HTTPS geladen und SHA-256 gegen `ddfa3cc9` verglichen: dashboard.html, dashboard.js, module/mein-urlaub.js, module/planung-bruecke.js, module/raum-verwaltung.js; alle bytegleich. Backendversionsroute lieferte `0.7.1+238c4ff`.
- Eigene erneute lesende Management-API-Katalogprüfung bestätigt Migrationen `20261103135541 0103_raum_details` und `20261103135621 0104_raum_automatik`. Keine Migration erneut angewandt.
- Alle fünf Spalten vorhanden: rooms.beschreibung, rooms.ausstattung, services.raum_ausstattung, bookings.room_automatisch, bookings.raum_service_ids. Vier neue Constraints validiert; drei neue Raumtrigger und bestehender Mandantentrigger aktiviert.
- Drei interne SECURITY-DEFINER-Triggerfunktionen haben festen search_path und kein EXECUTE für anon/authenticated. Reiner Ausstattungsvalidator ist SECURITY INVOKER, öffentlich ausführbar und liest keine Anwendungsdaten.
- Connector war zuvor mit -32600 blockiert; obiger aktueller Katalognachweis stammt ausdrücklich aus separatem autorisiertem Management-API-Zugang. Keine Zugangsdaten in dieser Notiz.

## Erneut gemessen in dieser Sitzung

- Gesamtes `npm test` erfolgreich: Frontend2659, Backend1833, Tools339, Merkez109 =4940 PASS, vier optionale Standard-Skips; null Fehler. Zusätzliche gezielte Auswahl171/171 PASS.
- Zwei Raum-PostgreSQL-Suiten explizit aktiviert, eigene isolierte Wegwerfcontainer:29/29 PASS, keine Skips. Testflags PRAXURA_RAUM_DETAILS_PG_TEST=1 und PRAXURA_RAUM_AUTOMATIK_PG_TEST=1; Dateien api-backend/db/raum-details.integration.test.js und raum-automatik.integration.test.js. Minimalfixtures, keine volle Kettenabnahme.
- tools/browser-probe/kalender-tag-antwort.mjs:22/22; tools/browser-probe/raum-automatik-probe.mjs:28/28. Synthetische Fixtures, kein angemeldetes Praxiskonto, kein echter Versand. Dashboard-ESM-Bundle erfolgreich.
- Ops-Status erneut gelesen: #342 und #343 done=true; #344–#348 done=false. Abgeschlossene Umsetzung und Veröffentlichung ersetzen keine vollständige Kontoabnahme.

## Offene Grenzen

Funktionale Live-QA nur in bestätigtem separatem Testkonto. Kundenkonto bleibt ohne Tests und neue Testdaten. Mail-STOP bleibt bestehen, auch bei zufällig verbundener Sitzung. Kein neuer Push, Deploy, DB-Write oder Versand durch diese erneute Prüfung. Installierte Kundenbox und spätere Mail-/KI-Aktivierung separat offen. Keine Compliance- oder Gesamtproduktionsfreigabe aus diesen Ergebnissen ableiten.

Belege und Historie: fortschritte/2026-11-03.md; canli-test/REGISTER.md; db/SCHEMA.sql; db/SCHEMA-RLS.sql; Physio/ABNAHME-RESTSTAND.md. Historische Hinweise auf lediglich lokale0103/0104 werden durch obigen Live-Katalogstand überholt; angewandte SQL-Dateien nicht zur Statuspflege ändern.
