# Physio-Launch (Stufe 1) — 15-Minuten-Live-Checkliste (Melih)

> Stand: 19.11.2026 · Ergänzt `Physio/LAUNCH-P1.md` (kritischer Pfad) und `wissensbank/sitzungen/2026-11-11_offene-punkte-wiederaufnahme.md`.
> **Ziel:** Nur die Prüfungen, die sich lokal nicht ersetzen lassen (echte Geräte, echte Sitzungen im bestätigten QA-Mandanten).
> **Schutzgrenzen:** Nur im bestätigten synthetischen QA-Mandanten („TEST-Physio QA“). Keine echten Patientendaten, kein Live-Mailversand an Dritte, keine Kunden-/Testkonten außerhalb QA (Yannick/Janik ausgeschlossen).

---

## Block A — QA-Konto Datenpflege (2 Min.)
1. **Einstellungen → Praxis:** Straße und Hausnummer im QA-Konto eintragen, speichern, Seite neu laden → Anschrift bleibt erhalten; neue Test-Rechnung (Entwurf) zeigt vollständige Praxisanschrift.
2. **Einstellungen → DATEV:** Synthetische Berater- und Mandantennummer eintragen → DATEV-Export liefert Datei statt `409 DATEV_ANGABEN_FEHLEN`.

## Block B — Geräte- & Integrationsprüfungen (5 Min.)
3. **Passwort ändern** (`Einstellungen → Konto`): Passwort im QA-Konto ändern, neu anmelden → funktioniert; offene andere Sitzung prüfen.
4. **Google Kalender OAuth** (`Einstellungen → Integrationen`): Verbinden, Rücksprung prüfen, Status „Verbunden“ sichtbar.
5. **Kamera-Scan (PDF417-Barcode)** (`Verordnungen → Rezept scannen`): Kamera öffnet auf echtem Gerät (Handy/Tablet), Barcode wird im Sucher erkannt, Bestätigungsmaske zeigt Felder. *(Foto-OCR bleibt bewusst aus / 503.)*
6. **GPS-Check-in** (`Team / Anwesenheit`): Standortfreigabe am Mobilgerät → Check-in speichert Zeit/Standort, Auschecken funktioniert mit deutscher Meldung.

## Block C — Offene QA-Abnahmen im Browser (8 Min.)
7. **Feiertage & Sondertag (`S8/S9`, ohne Mailversand):** Im Kalender Feiertagsbutton klicken, Seite neu laden → Feiertage persistent; geschlossener Sondertag markiert bestehende Termine rot in Tag/Woche/Monat/Raumansicht und sperrt Neuanlage.
8. **Standortplanung & Räume (`S5/S6`, `M1/M2`):** Wochenmuster + Einzeltagausnahme am Testtherapeuten speichern, Standortfilter in Tag/Woche/Monat prüfen; Raum-Tagesansicht („Therapeut | Raum“) umschalten. *(Gleichzeitige Buchung auf letzter Raumkapazität: 2 Tabs gleichzeitig auf letzten Platz → 1× Erfolg, 1× `409`.)*
9. **Mitarbeiter anlegen, F11 prüfen, entfernen:**
   - Synthetischen Test-Mitarbeiter anlegen → Einrichtungscode wird angezeigt, Erstanmeldung über `login.html` setzt Passwort.
   - Mit der **Mitarbeitersitzung** einloggen → `F11`: eigener Urlaub/Anstellung sichtbar (nur lesend), fremde Mandanten/Inhaber-Einstellungen gesperrt; Abmelden (`scope: local`) wirft den Inhaber auf dem anderen Tab **nicht** raus.
   - Als Inhaber Mitarbeiter wieder entfernen → Dialog nennt den Namen, Zugang ist danach gesperrt, Termine/Patienten bleiben erhalten.
10. **Physio-Kernfluss (nach Push von `140691f2` + `f159d224`):**
    - Physio-Verordnung wählen → Serientermin (Anzahl oben, Wochentage folgen Starttag/Frequenz) → Sitzung abschließen (`POST /api/booking/:id/sitzung-abschliessen`) → Verordnungsfortschritt aktualisiert sich, Status wird `completed`.
11. **Optional (falls Widget direkt mitgetestet wird, `F2`):** Widget-Anfrage auf freigegebener Test-HTTPS-Seite absenden → erscheint genau einmal unter *Termin-Anfragen → Offen*.

---

## Bereits erledigt / NICHT nochmal testen
- Backend-401-Sitzungswächter, Zahlungsjournal CSV-Export, Kachel „nur GKV“, Zuzahlung ohne Leistung, Q4-Kostenträgerdateien (`AO05Q426_KE2`, `EK05Q426_KE2/KE3`) → live geprüft am 18.11. (`fortschritte/2026-11-18.md`).
- Rechnungsrechte `0120` + `0121` (Option A: aktive Mitarbeiter mit Modulrecht `abrechnung`, inaktive Mitarbeiter gesperrt, Storno-/Wartelisten-Grenzen) → live angewandt und geprüft am 11.11. (`fortschritte/2026-11-11.md`).
- Schreibender Basis-Live-Test (Patient anlegen/bearbeiten mit Datumsprüfung, Rechnungsentwurf `INV-2026-0004`, Arbeitszeiten) → bestanden am 18.11.
- § 302 Physio-DTA / Entlassmanagement `0112`–`0115` → **Stufe 2** (nicht auf dem kritischen Pfad von Stufe 1, siehe `Physio/LAUNCH-P1.md`).
