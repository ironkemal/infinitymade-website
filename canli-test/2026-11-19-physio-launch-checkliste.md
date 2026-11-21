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
13. **Praxis vs. Meine & Standortwechsel:** Umschalter im Tagesplan/Kalender sowie Standortwechsel im QA-Mandanten testen → Zähler, Termine und Listen aktualisieren sauber ohne Race-Flackern.
14. **Zuzahlung + Storno (`F-02`, `9.3a/b`):** Im QA-Mandanten eine Test-Zuzahlung verbuchen und anschließend stornieren → Dashboard-Kachel `#tzGeld` („Monat laufend · Journal“) und Statistik (`Europe/Berlin`) bilden Eingang und Storno konsistent ab.
15. **Echte Smartphones (`F-13`):** Dashboard (`#panel-overview`), Überblick (`#panel-ueberblick`) und Kalender kurz auf echtem iOS- und Android-Gerät öffnen → kein horizontaler Überlauf, Buttons & Links gut tippbar.

---

## Bereits erledigt / NICHT nochmal testen
- Backend-401-Sitzungswächter, Zahlungsjournal CSV-Export, Kachel „nur GKV“, Zuzahlung ohne Leistung, Q4-Kostenträgerdateien (`AO05Q426_KE2`, `EK05Q426_KE2/KE3`) → live geprüft am 18.11. (`fortschritte/2026-11-18.md`).
- Rechnungsrechte `0120` + `0121` (Option A: aktive Mitarbeiter mit Modulrecht `abrechnung`, inaktive Mitarbeiter gesperrt, Storno-/Wartelisten-Grenzen) → live angewandt und geprüft am 11.11. (`fortschritte/2026-11-11.md`).
- Schreibender Basis-Live-Test (Patient anlegen/bearbeiten mit Datumsprüfung, Rechnungsentwurf `INV-2026-0004`, Arbeitszeiten) → bestanden am 18.11.
- Migrationen `0124`–`0129` (inkl. Gruppenraumregel `0129`) → live auf SaaS angewandt am 20.11. (`20261120212231 praxura_0124_bis_0129_physio_qa`); GPS-Check-in entfernt & blockiert. *(**Erledigt 21.11.2026 (Melih-GO):** `api-backend/db/physio-sitzungen-nachziehen.sql` live auf SaaS (`njvuclullotbksskpwgk`) ausgeführt — offene, unabgerechnete Physio-Verordnungen ohne Sitzungsplan: 5 → 0. Reiner Daten-Nachlauf, keine Schema-Änderung.)*
- Dashboard-/Überblick-QA-Fixes `F-01`–`F-13` + `9.1`–`9.6` → lokal & Playwright geprüft und am 21.11. gepusht (`6a61ac95`); Keyset-Pagination in `module/verordnung-uebersicht.js` lokal verifiziert (wartet auf Push-GO).
- § 302 Physio-DTA / Entlassmanagement `0112`–`0115` → **Stufe 2** (nicht auf dem kritischen Pfad von Stufe 1, siehe `Physio/LAUNCH-P1.md`).
