---
titel: Sechs Praxura-Pakete — Anfragen, Anamnese, Leistungen, KI-BYOK, Mail & öffentliches Design
typ: sitzung
angelegt: 2026-11-27
tags: [sitzung, anfragen, anamnese, leistungen, ki, mailversand, design, qa]
---

# Sechs Praxura-Pakete (26.–27.11.2026)

## Ausgangslage
Handschriftliche Praxura-Offenliste vom 26.11.2026 mit 6 Schwerpunkt-Paketen:
1. Leistungen verbessern & Schreibfehler „Hepsi“ → „Alle“ beheben
2. Anfrage-Seite auf bevorzugte Wochentage statt Datum umstellen, Anfrage in der App bearbeiten, „Absagen“ → „Anderer Termin“, Nachricht mit KI entwerfen
3. KI-Integration gemäß Konsey-Beschluss Option D (24.11.2026) dokumentieren & absichern
4. Anamnese-Modul strukturell verbessern
5. E-Mail-Versand (Anti-Spam, Vorlagen, Browser-Versand) optimieren
6. Buchungsseite & ähnliche öffentliche Seiten an das aktuelle Praxura-Design anpassen

## Umgesetzt & verifiziert

- **Paket 1 — Leistungen (`beabc8e1`):**
  - `dashboard.html:754`: `Hepsi` → `Alle`.
  - `+ Neue Leistung` im Panel-Kopf (`#panelServicesNeuBtn`), Formular über die Liste verschoben und in Abschnitte gegliedert.
  - `module/leistungen-liste.js`: Live-Suche, Kostenträger-Filterchips (`Alle`, `GKV`, `Privat`, `Selbstzahler`, `BG`, `Intern`) und expliziter `Bearbeiten`-Knopf pro Zeile.
- **Paket 2 — Anfragen & KI-Nachricht (`9c41b4a3`, QA-Fix `03d3cec2`):**
  - `booking-request.html` / `booking-request.js` / `booking-request.css`: Schritt 3 von Kalenderdatum auf bevorzugte Wochentage (Mehrfachauswahl + exklusives `Flexibel`), Tageszeit und Dringlichkeit umgestellt (`preferred_date: null`, `Zeit: …` / `Wie bald: …` in `notizen`).
  - `api-backend/server.js`: neuer Owner-Endpunkt `POST /api/booking-request/update` (Mandanten- und Statusprüfung `pending`), angebunden über „Änderungen speichern“ in `module/anfrage-bearbeiten.js`.
  - `dashboard.js`: `Ablehnen` → `Anderer Termin`, Wunschtage-Anzeige aus `zeitwunschAus(req.notizen)` auf der Anfragen-Karte (`dashboard.js` um 30 Zeilen geschrumpft).
  - `module/anfrage-nachricht.js`: KI-Entwurfshilfe (`POST /api/ai/b2c-draft` über das M4-Gateway mit PII-Maskierung, 4 Schnellvorlagen, sauberer `503 AI_DISABLED`-Fallback).
- **Paket 3 — KI-Integration Option D (`a49d98b4`):**
  - Bestehende Option-D-Umsetzung (Azure OpenAI EU-Region via `.env`, `AI_BYOK_ALLOWED=1`, `POST /api/ai/_verbindungstest`, `module/ki-einstellungen.js`) geprüft (`26/26` Tests grün) und in `docs/ki-byok-einrichtung.md` als 3-Schritte-Anleitung dokumentiert.
- **Paket 4 — Anamnese (`143941f0`):**
  - `module/anamnese.js` & `dashboard.css`: Live-Fortschrittsleiste (`berechneAnamneseFortschritt`), Pflichtfeld-Zähler, Abschnitts-Sprung-Navigation, „Alle auf-/zuklappen“ und einklappbare `<details>`-Abschnitte (`50/50` Tests grün).
- **Paket 5 — E-Mail-Versand & Anti-Spam (`277a8423`, QA-Fix `03d3cec2`):**
  - `api-backend/lib/mail-vorlage.js`: einheitliches Praxura-Design (`#F4F6F9` / `#0B0F17` / `#2563EB`), automatisches `multipart/alternative` (HTML + Klartext) und Domain-gebundene `Message-ID` für alle 4 Booking-Request-Mails in `api-backend/server.js`.
  - `module/mail-entwurf.js`: Browser-Versanddialog mit 1-Klick-Text-Kopieren (Webmail) + `mailto:`.
  - `module/mailversand.js`: einklappbarer SPF/DKIM/DMARC-Hinweis (`mv-hinweis-liste`, kollisionsfrei mit `mailversand-probe.mjs` `46/46`).
- **Paket 6 — Öffentliche Seiten im aktuellen Design (`f5deac67`):**
  - `design/oeffentlich.css` erweitert und `data-design="neu"` als Standard aktiviert (`module/design-oeffentlich-logik.js`, `?design=alt` bleibt als Rückfall erhalten) auf `booking.html`, `booking-request.html`, `login.html`, `employee-signup.html`, `onboarding.html`, `setup.html`, `vorregistrierung.html` und `admin-login.html` (`16/16` Playwright-Checks auf 1280px & 390px grün, `0` Seitenfehler, `0` Überlauf).

## QA-Funde & Nachprüfung
- **Fund 1:** Dashboard-Anfragen-Karte zeigte `—` bei Anfragen ohne `preferred_date` → behoben in `03d3cec2` (`zeitwunschAus(req.notizen)`).
- **Fund 2:** CSS-Klasse `mv-schritte` im neuen Spam-Hinweis kollidierte mit `mailversand-probe.mjs` → umbenannt auf `mv-hinweis-liste` in `03d3cec2` (`46/46` grün).
- **Verifikation:** Unit-Tests (`46/46` Frontend + `22/22` Backend + Gesamtlauf `2.304/2.312` mit `0 fail`), `POST /api/booking-request/update` (`6/6` Edge-Cases), Playwright-Probes (`leistungen`, `mailversand`, `setup`, `termin-anfrage-bis-liste`, 8 öffentliche Seiten 1280/390px) und interaktive Flow-Tests alle bestanden.

## Offen (nach Push)
- **Live-Sichtprüfung** nach Vercel-/Watchtower-Deploy auf `app.praxura.de` (öffentliche Buchungs-/Anfrage-/Login-Seiten, Leistungen, Anamnese, Anfragen-Karte).
- **On-Premise-Box:** `bash update.sh --jetzt` sobald das neue Image gebaut ist; optional `.env`-Variablen gemäß `docs/ki-byok-einrichtung.md` setzen und unter Einstellungen → KI-Unterstützung „Verbindung testen“ ausführen.
