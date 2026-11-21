---
titel: Dashboard- und Überblick-QA — Fristen, Kassenbuch, Navigation und Mobilansicht
typ: sitzung
datum: 2026-11-21
tags: [dashboard, ueberblick, fristen, kassenbuch, statistik, qa, mobile]
---

# Dashboard- und Überblick-QA (F-01 bis F-13 + Zusätze 9.1–9.6)

Auf Basis der Browser-QA im Physio-Testmandanten wurden 13 bestätigte Fehler (`F-01`–`F-13`) sowie 7 technische Zusatzbefunde (`9.1`, `9.2a`, `9.2b`, `9.3a`, `9.3b`, `9.4a/b`, `9.5`, `9.6`) lokal analysiert, mit dem Nutzer abgestimmt, einzeln umgesetzt, durch unabhängige Prüf-Subagenten abgenommen und in `main` integriert.

## Entscheidungen und Begründungen

- **Fristen-Einheitlichkeit (`F-01`, `9.1`, `9.2a`, `9.2b`):** Dashboard (`#physioRezKpi`) und Überblick (`#panel-ueberblick`) rechnen jetzt über dieselbe Behandlungsbeginn-Frist (`HeilM-RL §15`, `14/28 Tage`, `fristenAuswerten` / `rezKpiAuswerten` in `module/ueberblick-listen.js`), inkl. Entwürfen (`parsed`) und ohne abgeschlossene/stornierte Rezepte (`rxGeschlossen`).
  - *Verworfen:* Separate `gueltig_bis`-Auswertung im Dashboard (blieb bei fehlendem `gueltig_bis` still bei `0`). `api-backend/lib/rezept-felder.js` + `api-backend/server.js` setzen `gueltig_bis` beim Anlegen nun zusätzlich konsistent.
  - *Technik:* Sommerzeit-Drift in `module/heilmittel-fristen.js` durch UTC-Datumsarithmetik behoben; festes Limit `150` + falscher Statusfilter `'rejected'` durch Keyset-Pagination + `'cancelled'` in `module/verordnung-fristen-laden.js` ersetzt; Prüfbedarf erkennt die echten DB-CHECK-Werte `'rejected'` und `'teilabsetzung'` statt `'absetzung'`.
- **Kassiert-Kachel & Statistik-Stornos (`F-02`, `9.3a`, `9.3b`):**
  - Dashboard-Kachel `#tzGeld` (`module/startseite-geld.js`, `module/tageszentrale-ansicht.js`) zeigt alle Zahlungsjournal-Eingänge (`monat.umsatz`, abzüglich Stornos) unter der Beschriftung `Monat laufend · Journal` (ohne das Wort „Umsatz“). Das Zuzahlungs-Diagramm unter Auswertungen blieb unverändert.
  - `api-backend/billing/api/statistik.routes.js` berechnet das Monatsfenster und die Monatszuordnung in `Europe/Berlin` (`berlinMonatsgrenzen`, `berlinTagesgrenzen`, `berlinHeute`) ohne Monatsende-Überlauf (`setMonth` an Tagen 29–31).
  - Storno-Klassifizierung (`9.3b`, `istForderungsBeleg`): `umsatz` zählt weiterhin alle Belege inkl. sämtlicher Stornos; `bezahlt` (Forderungsreihe `zuzahlung` + `ausfall`) übernimmt nur Stornos, deren Originalbeleg (`storno_von`, ggf. mandantengeschützt nachgeladen) eine Forderung war (Fallback bei Altstornos ohne `storno_von`: `invoice_id` ohne `prescription_id` → kein Forderungs-Storno; `prescription_id` → Forderungs-Storno). Damit drücken Rechnungs- oder Barverkauf-Stornos `bezahlt` nicht mehr ins Negative.
- **Navigation, Tagesplan & Raster (`F-03`, `F-04`, `F-05`, `F-06`, `F-08`, `F-10`):**
  - Klick auf Dashboard-Fristen springt direkt nach `Überblick → Rezept-Fristen` (Tab `alle`, Suche geleert, Scroll auf `#ublDeadlinesSection`).
  - Hash-Routing für alle Panels (`module/panel-verlauf.js`): Dashboard bleibt ohne Hash, alle anderen Panels (z. B. `#ueberblick`) tragen einen Hash mit Reload- und Browser-Zurück/Vor-Unterstützung. Initialisierung erfolgt bewusst nach `initBeleglisteUI()`.
  - Schnelle Klicks auf Datumsnavigation (`F-05`): Generation-Guards (`erstelleLaufWaechter`), DST-sicheres `tagVerschiebenDatum`, persistente Nav-Buttons im DOM und paralleles `Promise.all`.
  - „Termin anlegen“ / „Neuer Termin“ übernehmen den gewählten Tag (`terminStartFuerTag`); vergangene Tage weichen mit Hinweis-Toast auf heute aus, die bestehende `bkStart.min`-Sperre bleibt aktiv.
  - Dashboard-Raster (`module/tageszentrale-raster.js`): einfacher Slot-Klick (und Enter/Space, 350-ms-Entprellung) öffnet die vorbelegte Terminmaske ohne automatisches Speichern; leeres Raster bleibt bei 0 Terminen sichtbar und scrollt zum ersten Termin / zur aktuellen Zeit.
  - Hero-Leertexte (`heroLeerStatusTexte`) und Singular/Plural (`1 Termin` vs. `N Termine`) korrigiert.
- **Überblick, Team, Detailpanel & Mobil (`F-07`, `F-09`, `F-11`, `F-12`, `F-13`):**
  - Abwesenheiten-Kachel im Überblick fest auf 14 Tage (`Abwesenheiten (14 T.)`, Untertitel `heute aktiv: X`), entkoppelt vom Listenfilter (`14 T. / 30 T.`); alle Listenzähler folgen der Suche.
  - Team-Ansicht (`F-09`): `.emp-card .emp-neuer-code` bricht sauber mehrzeilig um; Inhaber sieht neben `#anwOwnerView` auch `#anwEmployeeView` („Ein- und auschecken →“ `/attendance.html`), Mitarbeitende unverändert nur `#anwEmployeeView`.
  - Termin-Detailpanel (`F-11`): Überschrift `Sitzungen & Einheiten` statt doppelt „Verordnungen“; deterministisches Ausblenden des leeren Sitzungs-Panels ohne Patient; `.btn.btn-primary` für Raum-Speichern und Entwurf-Prüfung (da `.btn-secondary` im Standard-Design ungestylt war); Entwurf-Hinweis (`ladePatientenEntwuerfe`); `abschlussErlaubtImPanel` sperrt abgeschlossene/abgesagte Physio-Termine und erhält die Podologie-Dokumentation bei `completed`.
  - Texte & Mobil (`F-12`, `F-13`): Leertext `Keine versäumten Termine zuletzt.`; `.tz-mini-link` ≥ `44 px` hoch; Hero-Buttons und Tageszentrale auf `320 / 390 / 768 px` (Light & Dark) ohne horizontalen Überlauf bei unveränderter `1440 px`-Desktop-Ansicht.

## Nachweise (lokal auf `main`)

- `npm test`: `5.780` bestanden, `0` fehlgeschlagen (`test:frontend` `3.064/3.064`, `test:backend` `2.252/2.259` mit 7 bekannten `# [bewusst]`-TODOs, `test:tools` `355/355`, `test:merkez` `109/109`).
- `npm run typecheck`: `0` Fehler.
- `tools/check-dashboard-size.sh`: grün (`dashboard.js` von `17.520` auf `17.487` Zeilen geschrumpft).
- `node tools/funktionskarte.mjs --check`: OK (`4.887` Funktionen / `598` Dateien).
- Browser-Probes & Playwright (synthetische Daten, Hell & Dunkel, `1440 / 768 / 390 / 320 px`): `v6b03-geld.mjs`, komplette `npm run probe`-Suite sowie interaktiver Dashboard-/Überblick-/Team-/Detailpanel-Durchlauf mit `0` Konsolen-, Seiten- und HTTP-Fehlern.

[Tagesprotokoll 2026-11-21](../../fortschritte/2026-11-21.md)

## Offen / nach Deploy zu prüfen

- **Live-Abnahme Teil 1 (21.11.2026, Test-Mandant „TEST-Physio QA“, Inhaber-Konto, Asset-Stand `dashboard.js?v=20261121pag1`, `dashboard-start.css?v=20261121f13`, `dashboard.css?v=20261121f09`):**
  - **Bestanden (`PASS`):** `F-01`–`F-12` inkl. `9.3a/b`, `9.4a/b`, `9.5/9.6` komplett live bestätigt (`in ≤7 Tagen = 2`, `Kassiert = 12,96 €` mit `Monat laufend · Journal`, Zuzahlungs-Diagramm ohne Negativwerte, Termin-Vorbelegung Zukunft & Vergangenheit-Fallback, Raster-Scroll + Lücken-Klick + 0-Termine-Raster, schnelle Datumsnavigation, `1 Termin` & Hero-Status, Abwesenheiten-Kachel fest auf 14 T., Hash-Routing `#ueberblick`/`#verordnungen`/`#team` inkl. Reload & Zurück/Vor, Team-Passwort-Button & Check-in-Link für Inhaber, Fristen-Sprung, Detailpanel, Leertext & 44-px-Links). **0 Konsolenfehler, 0 Netzwerkfehler ≥ 400** bei 250 Ressourcen.
  - **Teilweise geprüft:** `F-13` bei `562 px` (Light & Dark) ohne horizontalen Überlauf (`562 === 562`) bestätigt; Breiten `1440 / 768 / 390 / 320 px` sowie Kontrast & Tastaturfokus live noch offen (Chrome-Seitenpanel hatte fixe Breite).
  - **Nachbefunde aus Live-Abnahme behoben (neuer Stand `dashboard.js?v=20261121ubl2`):**
    - `N-1` (Asset-Version): `dashboard.js?v=20261121pag1` stammte aus dem Nachfolge-Commit `c16e9d02` (Keyset-Pagination in `module/verordnung-uebersicht.js`) und enthielt bereits alle `F-01`–`F-13`-Fixes.
    - `N-2` (Wochenleiste Singular/Plural): `title` und explizites `aria-label` in `module/ueberblick-ansicht.js` verwenden nun `1 Termin` / `1 Hausbesuch` statt pauschal Plural.
    - `N-3` (Terminzahl Überblick ≠ Dashboard): Ursache war `scope(..., 'patients')` (`bizScope`) auf `wochePromise` in `module/ueberblick-ansicht.js`, während Dashboard (`loadScheduleBookings`) und Hauptkalender (Tag/Woche/Monat) Termine bewusst owner-weit (cross-business) laden; zudem schließt `wochenAuslastungAufbereiten` jetzt `group_parent_id`-Kindzeilen aus (wie `buchungenFuerTagAufbereiten`).
    - `N-4` (Such-Leertexte): Kontextspezifische Texte („Keine Rezept-Fristen passend zur Suche.“ usw.) bewusst beibehalten.
- **Weiterhin offen (Teil 2 & Geräte):** Mitarbeiter-Konto live (`QA Testtherapeut`), Schreibabläufe live (Termin anlegen/verschieben/stornieren, Sitzung abschließen inkl. `0/6 → 1/6`, Zuzahlung + Storno live) sowie `F-13` live bei `1440 / 768 / 390 / 320 px` + Kontrast/Tastaturfokus auf echten Smartphones/Desktop-Browsern.
- **Verordnungsliste Pagination:** Mit Commit `c16e9d02` (`module/verordnung-uebersicht.js`) inzwischen vollständig geschlossen.
