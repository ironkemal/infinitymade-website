---
titel: On-Premise Box-QA A–Z & Migration 0134 (globale/geteilte Leistungen bei Terminanlage)
typ: sitzung
datum: 2026-11-26
tags: [box, onprem, qa, datenbank, raumplanung, migration-0134]
---

# On-Premise Box-QA A–Z & Migration `0134_booking_raum_leistung_standort`

Systematische A–Z-Live-Prüfung einer laufenden On-Premise Praxura-Box (`istKutu: true`, Version `0.7.1`, Schema `0132`, Stand `dashboard.js?v=20261125foto1`, Fachbereich Physiotherapie) über Browser-Automatisierung + parallele Infrastruktur-/Responsive-Checks sowie anschließende Behebung des einzigen gefundenen `P0`-Bugs (`BOX-P0-01`).

## Ergebnis der A–Z-Prüfung (25.11.2026)

- **Infrastruktur & Assets (`PASS`):** `305 / 305` direkt und transitiv aus `dashboard.js` importierte ES-Module/CSS/Assets lieferten `HTTP 200` (`0 × 404`, `0 × 500`), `0` externe CDN-/Cloud-Aufrufe, `/health` `200 OK`, `/api/status` sauber geschützt (`401`), `/admin.html` `404` (by Design auf Box), `Permissions-Policy: geolocation=()` auf `/attendance.html` (by Design seit 20.11.2026).
- **Responsive-Matrix (`PASS`):** `32 / 32` Playwright-Läufe (`1440 / 768 / 390 / 320 px` × Hell/Dunkel × Voll/Leer auf `#panel-overview` & `#panel-ueberblick`) mit `0 px` horizontalem Überlauf und `0` Konsolen-/Seitenfehlern.
- **Live-Module (`22 / 23` + Einstellungen + `/attendance.html` + Dark Mode `PASS`):**
  - Dashboard (`#overview`), Überblick (`#ueberblick`), Termin-Anfragen (`#anfragen`), Warteliste (`#warteliste`), Patienten (`#kunden`), Notizen (`#notizen`), Fahrtenbuch (`#fahrtenbuch`), Anamnese (`#anamnese`), Leistungen (`#services`), Verordnungen (`#verordnungen`), Rechnungen (`#rechnungen`), §302-Abrechnung (`#abrechnung`), Zahlungsjournal (`#belegliste`), Mahnwesen (`#mahnwesen`), Auswertungen (`#statistik`), Verfügbarkeit (`#hours`), Team (`#team`), Anwesenheit (`/attendance.html`), Nebenmodule (`#b2b`, `#b2c`, `#beispielmodus`, `#feedback`, `#vorlagen`, `#doctors`), alle 13 Einstellungsbereiche inkl. `istKutu`-Systemstatus (`0.7.1`, Schema `0132`) sowie Dark Mode funktionierten fehlerfrei.
  - CRUD-Tests (`Aufgabe`, `Warteliste`, `Notiz`, `Leistung`, `Sondertag`, `Urlaub`, `Vorlage`, `Arzt`) erfolgreich durchlaufen und restlos bereinigt.

## Kritischer Befund `BOX-P0-01` & Lösung (`0134`)

- **Symptom:** Beim Anlegen eines Termins im Kalender (`#calendar`) mit einer globalen Leistung (`services.business_id IS NULL`) bei aktivem Standort schlug das Speichern mit `ERRCODE 23514` (`„Leistung gehört nicht zu diesem Mandanten oder Standort.“`) fehl.
- **Ursache:** `public.booking_raum_automatisch()` (`0129_raum_einzelbelegung.sql:52-55`) prüfte strikt `leistung.business_id IS DISTINCT FROM NEW.business_id`. Während `bizScope` im Frontend globale (`business_id IS NULL`) und per `data_sharing_settings.services = true` geteilte Leistungen regulär anbietet, setzt `trg_set_business_id` beim `INSERT` auf `bookings` automatisch `NEW.business_id` auf den aktiven Standort (`NULL IS DISTINCT FROM <uuid>` = `TRUE`).
- **Fix (`api-backend/db/migrations/0134_booking_raum_leistung_standort.sql`):**
  - `CREATE OR REPLACE FUNCTION public.booking_raum_automatisch()` (signatur-, `SECURITY DEFINER`-, `search_path`- und ACL-neutral: `EXECUTE` nur für `service_role`).
  - Mandantengrenze (`COALESCE(leistung.owner_id, leistung.user_id) IS DISTINCT FROM NEW.owner_id`) bleibt unverändert strikt.
  - Standortprüfung erlaubt zusätzlich `leistung.business_id IS NULL`, `NEW.business_id IS NULL` sowie `data_sharing_settings.services IS TRUE` für `NEW.owner_id`, während ungeteilte Fremdstandorte weiterhin blockiert werden.

## Nachweise

- **PostgreSQL 17.11 (isolierter Container `--network none`, volle Kette `0000`–`0132`):**
  - Gegentest `api-backend/db/tests/0134_booking_raum_leistung_standort.test.sql` gegen `0129` reproduziert exakt `ERROR: Leistung gehört nicht zu diesem Mandanten oder Standort.`.
  - Nach Anwendung von `0134`: `0129_raum_einzelbelegung.test.sql` **PASS** (keine Regression) und `0134_booking_raum_leistung_standort.test.sql` **PASS** (Global erlaubt, Fremdstandort ohne Sharing gesperrt, mit Sharing erlaubt, Fremdmandant gesperrt).
- **Live-SaaS (`njvuclullotbksskpwgk`, 26.11.2026, Melih-GO):**
  - Probelauf mit `ROLLBACK` grün, anschließend live angewandt als Ledger-Eintrag `20261126205803 0134_booking_raum_leistung_standort`.
  - Live-Katalog bestätigt: `acl = {postgres=X/postgres,service_role=X/postgres}`, alle Zähler unverändert (`110` Tabellen, `197` Policies, `161` Funktionen, `188` Trigger, `380` Indizes, `1.596` Spalten).
  - `db/SCHEMA.sql`, `db/SCHEMA-RLS.sql`, `db/README.md` und `api-backend/db/erwartete-zaehler.json` (`bis_version: "0134"`) aktualisiert; `check-onprem.sh`, `check-select-spalten.sh`, `check-tabellen-register.sh` (`110/110`) grün.

[Tagesprotokoll 2026-11-26](../../fortschritte/2026-11-26.md)

## Offen

- **Box-Update ausführen:** Nach Abschluss des GitHub-Actions-Container-Builds `bash update.sh --jetzt` auf dem Box-Server laufen lassen, damit Migration `0134` auch auf der On-Premise-Box eingespielt wird, und kurz eine Terminanlage mit globaler Leistung gegenchecken.
- **Test-Reste auf der Test-Box (optional):** 2 leere Test-Patienten und 1 Entwurf-Verordnung (`QA-Test-20261125*`, ohne UI-Löschbutton wegen GoBD) können bei Bedarf per DSGVO-Weg entfernt werden.
