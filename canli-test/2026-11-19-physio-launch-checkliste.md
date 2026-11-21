# Physio-Launch (Stufe 1) — 15-Minuten-Live-Checkliste (Melih)

> Stand: 21.11.2026 · Ergänzt `Physio/LAUNCH-P1.md` (kritischer Pfad), `fortschritte/2026-11-21.md` (Teil D) und `wissensbank/sitzungen/2026-11-11_offene-punkte-wiederaufnahme.md`.
> **Ziel:** Nur die Prüfungen, die sich lokal nicht ersetzen lassen (echte Geräte, echte Schreib-Sitzungen im bestätigten QA-Mandanten).
> **Schutzgrenzen:** Nur im bestätigten synthetischen QA-Mandanten („TEST-Physio QA“). Keine echten Patientendaten, kein Live-Mailversand an Dritte, keine Kunden-/Testkonten außerhalb QA (Yannick/Janik ausgeschlossen).

---

## Block A — QA-Konto Datenpflege (2 Min.)
1. **Einstellungen → Praxis:** Straße und Hausnummer im QA-Konto eintragen, speichern, Seite neu laden → Anschrift bleibt erhalten; neue Test-Rechnung (Entwurf) zeigt vollständige Praxisanschrift.
2. **Einstellungen → DATEV:** Synthetische Berater- und Mandantennummer eintragen → DATEV-Export liefert Datei statt `409 DATEV_ANGABEN_FEHLEN`.

## Block B — Geräte- & Integrationsprüfungen (5 Min.)
3. **Passwort ändern** (`Einstellungen → Konto`): Passwort im QA-Konto ändern, neu anmelden → funktioniert; offene andere Sitzung prüfen.
4. **Google Kalender OAuth** (`Einstellungen → Integrationen`): Verbinden, Rücksprung prüfen, Status „Verbunden“ sichtbar.
5. **Kamera-Scan (PDF417-Barcode)** (`Verordnungen → Rezept scannen`): Kamera öffnet auf echtem Gerät (Handy/Tablet), Barcode wird im Sucher erkannt, Bestätigungsmaske zeigt Felder. *(Foto-OCR bleibt bewusst aus / 503.)*
6. **Ein- und auschecken** (`Team / Anwesenheit`, `F-09`): Bei mehreren Standorten zuerst den Standort wählen; auch im Inhaberkonto ist der Link „Ein- und auschecken →“ (`#anwEmployeeView`) sichtbar. Einchecken speichert die Uhrzeit und den gewählten Standort. Auschecken speichert die Abgangszeit. Der Browser fragt in beiden Fällen keine GPS-Freigabe ab.

## Block C — Offene QA-Abnahmen im Browser (8 Min.)
7. **Feiertage & Sondertag (`S8/S9`, ohne Mailversand):** Im Kalender Feiertagsbutton klicken, Seite neu laden → Feiertage persistent; geschlossener Sondertag markiert bestehende Termine rot in Tag/Woche/Monat/Raumansicht und sperrt Neuanlage.
8. **Standortplanung & Räume (`S5/S6`, `M1/M2`):** Wochenmuster und Einzeltagausnahme am Testtherapeuten speichern. Standortfilter in Tag, Woche und Monat prüfen. Raum-Tagesansicht („Therapeut | Raum“) umschalten. Bei zwei parallelen Buchungen für denselben Raum und Zeitraum wird ein Haupttermin gespeichert. Teilnehmende desselben Gruppentermins erhalten den Raum des Haupttermins.
9. **Mitarbeiter anlegen, F11 prüfen, entfernen:**
   - Synthetischen Test-Mitarbeiter anlegen → Einrichtungscode wird angezeigt, Erstanmeldung über `login.html` setzt Passwort.
   - Mit der **Mitarbeitersitzung** einloggen → `F11`: eigener Urlaub/Anstellung sichtbar (nur lesend), fremde Mandanten/Inhaber-Einstellungen gesperrt; Abmelden (`scope: local`) wirft den Inhaber auf dem anderen Tab **nicht** raus.
   - Als Inhaber Mitarbeiter wieder entfernen → Dialog nennt den Namen, Zugang ist danach gesperrt, Termine/Patienten bleiben erhalten.
10. **Physio-Kernfluss:**
    - Physio-Verordnung wählen → Serientermin (Anzahl oben, Wochentage folgen Starttag/Frequenz) → Sitzung abschließen (`POST /api/booking/:id/sitzung-abschliessen`) → Verordnungsfortschritt aktualisiert sich, Status wird `completed`.
11. **Optional (falls Widget direkt mitgetestet wird, `F2`):** Widget-Anfrage auf freigegebener Test-HTTPS-Seite absenden → erscheint genau einmal unter *Termin-Anfragen → Offen*.

## Block D — Live-Schreibtests Dashboard / Überblick & Mobilgeräte (`F-01`–`F-13`, 5 Min.)
12. **Tagesplan & Raster (`F-03`, `F-04`, `F-05`):** Auf dem Dashboard einen künftigen Tag wählen → „Termin anlegen“ / Klick auf freien Raster-Slot übernimmt das gewählte Datum; Termin speichern, verschieben und stornieren. Bei vergangenem Tag springt „Termin anlegen“ mit Hinweis auf heute.
13. **Praxis vs. Meine & Standortwechsel:** Umschalter im Tagesplan/Kalender sowie im Überblick (`.ubl-scope-btn`: Praxis / Meine) und Standortwechsel im QA-Mandanten testen → Zähler, Termine und Listen aktualisieren sauber ohne Race-Flackern.
14. **Zuzahlung + Storno (`F-02`, `9.3a/b`):** Im QA-Mandanten eine Test-Zuzahlung verbuchen und anschließend stornieren → Dashboard-Kachel `#tzGeld` („Monat laufend · Journal“) und Statistik (`Europe/Berlin`) bilden Eingang und Storno konsistent ab.
15. **Responsive & Dark Mode (`F-13`, echte Zielbreiten):** Dashboard (`#panel-overview`), Überblick (`#panel-ueberblick`) und Verordnungen in Hell und Dunkel auf **`1440 px`, `768 px`, `390 px` und `320 px`** (Fenster manuell auf Zielbreite ziehen bzw. echtes iOS/Android-Gerät) prüfen → `document.documentElement.scrollWidth <= window.innerWidth`, Buttons & Links gut tippbar (`≥ 44 px`).
16. **Hinweis zur Suche (klassisches SaaS-Design vs. Pilot-Design `neu`):**
    - Im **klassischen SaaS-Design** (aktueller Standard für „TEST-Physio QA“) gibt es **keine** globale Kopfleisten-Suche mit Suchbereich „Verordnung“ und keinen „Teilbestand“-Hinweis. Geprüft werden stattdessen die Verordnungsliste (`#panel-verordnungen`: Keyset-Pagination `order=id.asc&limit=200`, Datum absteigend, Klick öffnet Muster-13) sowie das Überblick-Suchfeld (`#ublSearchInput`, `Strg+K`, Klick auf „Rezept“ öffnet `#verordnungen`) — **bereits live bestanden am 21.11.2026**.
    - Die **Kopfleisten-Suche** (`.px-suche` mit Suchbereich `Patient / Verordnung / Rechnung` und Teilbestand-Hinweis ab `5.000` je Topf in `.px-suche-hinweis`) ist **nur** im Pilot-Design (`data-design="neu"` über Server-Env `DESIGN_NEU_PILOT_TENANTS` + Rolle `owner`) aktiv — ab `900 px` direkt in der Kopfleiste, unter `900 px` über die Lupe (`.px-suche-knopf`).

---

## Bereits erledigt / NICHT nochmal testen
- Backend-401-Sitzungswächter, Zahlungsjournal CSV-Export, Kachel „nur GKV“, Zuzahlung ohne Leistung, Q4-Kostenträgerdateien (`AO05Q426_KE2`, `EK05Q426_KE2/KE3`) → live geprüft am 18.11. (`fortschritte/2026-11-18.md`).
- Rechnungsrechte `0120` + `0121` (Option A: aktive Mitarbeiter mit Modulrecht `abrechnung`, inaktive Mitarbeiter gesperrt, Storno-/Wartelisten-Grenzen) → live angewandt und geprüft am 11.11. (`fortschritte/2026-11-11.md`).
- Schreibender Basis-Live-Test (Patient anlegen/bearbeiten mit Datumsprüfung, Rechnungsentwurf `INV-2026-0004`, Arbeitszeiten) → bestanden am 18.11.
- Migrationen `0124`–`0129` (inkl. Gruppenraumregel `0129`) → live auf SaaS angewandt am 20.11. (`20261120212231 praxura_0124_bis_0129_physio_qa`); GPS-Check-in entfernt & blockiert. *(**Erledigt 21.11.2026 (Melih-GO):** `api-backend/db/physio-sitzungen-nachziehen.sql` live auf SaaS (`njvuclullotbksskpwgk`) ausgeführt — offene, unabgerechnete Physio-Verordnungen ohne Sitzungsplan: 5 → 0. Reiner Daten-Nachlauf, keine Schema-Änderung.)*
- **Teilabnahme Live-Lesetests am 21.11.2026 (`dc2d27ab` / `c16e9d02`, „TEST-Physio QA“):** Deploy `?v=20261121pag1` bestätigt; `#verordnungen` Keyset-Pagination (`order=id.asc&limit=200`, `200 OK`, kein `414`, 13 Zeilen absteigend nach Datum, Klick öffnet Muster-13); `#ueberblick` Suche (`#ublSearchInput`, `Strg+K`, Klick „Rezept“ → `#verordnungen`); Fristen-Gleichstand Dashboard = Überblick (`7 = 7`); alle beobachteten Supabase-Abfragen `200 OK`; Framing-Schutz (`X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`) bestätigt.
- § 302 Physio-DTA / Entlassmanagement `0112`–`0115` → **Stufe 2** (nicht auf dem kritischen Pfad von Stufe 1, siehe `Physio/LAUNCH-P1.md`).
