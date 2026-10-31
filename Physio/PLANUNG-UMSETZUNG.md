# Physio-Pilot P1 — Umsetzungsplan „Planung" (M1–M7, Melih)

> Stand 31.10.2026. Ergänzt `Physio/PILOT-PLAN.md` §2, ersetzt ihn nicht. Repo public: keine Namen, Städte, Preise.
> Grundlage: Kundengespräch (`wissensbank/sitzungen/2026-10-30_p1-erstgespraech-physio-demo.md`) und Vorprüfung durch
> fonksiyon-ustasi, db-ustasi, onprem, guvenlik, legal-de, physio.

## 1. Was das Gespräch zusätzlich festgelegt hat

| Aussage im Gespräch | Stand im Code | Folge |
|---|---|---|
| Sondertag: „automatisch Mail an Patienten" | Mail gibt es nicht, nur Wirkung auf Online-Buchung | M6 baut sie, aber mit Vorschau und Klick (legal-de), nicht automatisch |
| Sondertag im Terminkalender sichtbar, Tag nicht vergebbar | Tages-, Wochen-, Monatsansicht lesen `custom_days` nicht | M6 |
| Teilzeit/Vollzeit einstellbar, Urlaub → Meldung im Kalender | Fehlt beides | M5 |
| Räume anpassbar, Raum bei Buchung | Nur in der lokalen Demo | M1 |
| Einbindung auf eigener Webseite | Widget vorhanden, Dashboard-Generator fehlt | M7 |

Der Kunde testet 3–4 Wochen in der Sandbox auf dem SaaS, deshalb zählt jeder Schritt erst nach Push und Live-Migration.
Die Lieferreihenfolge steht in §2a.

## 2. Entscheidungen (mit Begründung)

1. **Raum optional, Überschneidung nur Warnung.** Plan-DoD, Ops #307, physio. Der Demo-Entwurf sperrte hart, das wird nicht übernommen.
2. **`rooms.plaetze` (Default 1).** Wärme/Fango läuft parallel. Warnung erst, wenn belegte Termine ≥ Plätze. Sonst wäre die Warnung bei
   Wärmekabinen Dauerrauschen.
3. **`rooms.business_id` nullable nur für Inhaber ohne `businesses`-Zeile**, sonst per `trg_set_business_id` gesetzt. Kein „NULL = praxisweit".
4. **Raum-Streifen zeigt Raum, Therapeut-Kürzel, frei/belegt, Restzeit, nie Patientenname oder Initialen** (legal-de). Das überstimmt die
   physio-Empfehlung „M. Müller". Klick öffnet den Termin, dort gelten die normalen Kalenderrechte.
5. **Wochenmuster in eigener Tabelle, nicht in `working_hours.business_id`.** guvenlik-Veto: `working_hours` ist anonym lesbar. Eine Tabelle
   für Wochenmuster und Einzeltag: `employee_standort_plan`, Tag-Granularität, keine Halbtage im Pilot.
6. **Gebuchte Termine werden nie automatisch verschoben.** Bei Standortwechsel: Warnung mit Liste.
7. **Anstellung in eigener Tabelle `mitarbeiter_anstellung`**, nicht in `profiles` (legal-de, guvenlik, db-ustasi): Kollegen sehen sie nicht.
   Anspruch + manueller Übertrag − genommene Tage, keine anteilige Automatik.
8. **Warntext nennt nie den Abwesenheitsgrund:** „Therapeut:in ist an diesem Tag nicht verfügbar."
9. **Sondertag bleibt praxisweit** (`custom_days` UNIQUE unverändert, onprem). Die Vorschau erlaubt Abwahl je Empfänger, damit ein nur einen
   Standort betreffender Fall lösbar ist. Standorteigene Sondertage: später.
10. **Mail nur nach Klick, Einzelmails, fester Text, nur mit Opt-in (E13), `requireTLS`, Dedup in der DB, kein Cron.** Ohne Opt-in, ohne Adresse
    oder ohne SMTP: Anrufliste. Versand über vorhandenes `api-backend/lib/mail.js`, keine Abhängigkeit von K9-Reihenfolge.
11. **Snippet nur für `widget/booking-widget.html`, nie `booking.html`.** Host in der Box aus `location.origin`, im SaaS `praxura.de`. Box nicht
    öffentlich erreichbar: Generator ausgeblendet.
12. **Beim Anlegen eines weiteren Standorts Pflichtbestätigung „dieselbe Rechtsperson"**, Freigabe-Text nennt die Trennung Anzeigefilter.

## 2a. Ergebnis der Planprüfung (muhalif, deger-mi, 31.10.2026)

Diese Punkte gehen §3 vor.

1. **Lieferreihenfolge:** Migrationswelle (M3b, M1a, M4a, M5a) → M1 + M5c → M2a → M5a/b → M6a → M3 → M7 → M4 → Mail-Versand nach E13 → M2b.
   M3 und M4 wirken nur in der Box und am zweiten Standort; die Sandbox läuft im SaaS, der Kunde startet mit einem Standort.
2. **Scheiben statt Sammelpush:** Jede Scheibe wird einzeln gepusht, sobald sie grün ist. Migrationen je Datei sofort, damit Kemal die Nummer sieht.
3. **Streifen nennt „n Termine ohne Raum".** Online-Buchungen und Serienvorschläge haben keinen Raum; „frei" wäre sonst falsch. M1d prüft alle
   `bookings`-Schreibwege darauf, dass eine Änderung `room_id` nicht verliert.
4. **Brückendatei je Scheibe** statt Einzelzeilen in `dashboard.js`; der Hauptagent schreibt vorab 3–5 Abnahmeszenarien für jeden Worker.
5. **M6b/M6c-Versand erst nach E13.** Vorher: M6a plus Vorschau und Anrufliste. Die Protokolltabelle kommt mit dem Versand, nicht in die Welle.
6. **M2b-Raumspalten später**, weicht von der DoD in `PILOT-PLAN.md` ab: Der Streifen beantwortet die Kundenfrage, die Spalten sind die teuerste Einzelposition.
   Freie Räume im Formular bleiben, das kostet kaum etwas.
7. **M5 kleiner:** Beschäftigung, Wochenstunden, Anspruch, keine Übertragsrechnung. Resturlaub zählt nur Arbeitstage laut Verfügbarkeit, nicht fest Mo–Fr.
8. **M7 und M4 kleiner:** M7 bleibt Generator, aber nach M3. M4 zuerst nur Wochenmuster und Filter, Einzeltag folgt.
9. **Fragen an P1 sofort über Kemal:** gleiche Rechtsperson, eigenes IK je Standort, feste Räume. Antwort „zwei Rechtspersonen" kippt M3/M4 (legal-de-Sperre).

## 3. Arbeitspakete

Jede Zeile ist einzeln lieferbar. „Verantw." = wer schreibt. Migrationen und Integration in `dashboard.js`/`server.js` macht der Hauptagent.

| AP | Inhalt | Dateien | Verantw. | Fertig wenn |
|---|---|---|---|---|
| **M3** | `isEnterprise()` in der Box true, zweite Sperre (lokale Prüfung beim Speichern), Pfad ohne `businesses`-Zeile, Bestätigung Rechtsperson | `dashboard.js` (zeilenneutral) | Haupt | Box: zweiter Standort speicherbar, Switcher sichtbar; SaaS unverändert |
| **M3b** | Modulrechte nur Inhaber (`employee_scope_overrides`) | Migration | Haupt | Mitarbeiter kann sich kein Modul freischalten |
| **M1a** | Migration `rooms`, `bookings.room_id`, Mandanten-Trigger | Migration, `klassifikation.js`, `loeschen.js`, `db/REGISTER.md`, Grant-Prüfung | Haupt | Frische DB grün, Zähler gemessen |
| **M1b** | Logik portiert aus Demo: Name prüfen, Belegung, Warnung, freie Räume, aktuelle Belegung | `module/raum-plan.js` + Test | Worker | Tests aus `raeume.test.js` portiert, angepasst auf Warnung und Plätze |
| **M1c** | Raumverwaltung (anlegen, umbenennen, deaktivieren, Plätze) | `module/raum-verwaltung.js` + Test, Panel Verfügbarkeit | Worker | Inhaber verwaltet Räume je Standort, Fehler weich |
| **M1d** | Raumwahl in Terminmaske, Serie, Termin-Aktionspanel; Warnung; `room_id` in Payload und Backend | `module/raum-auswahl.js`, `dashboard.js`, `server.js` | Worker + Haupt | Einzeln, Serie, Nachtrag, Verschieben; Status-Änderung erhält Raum |
| **M2a** | Streifen „Jetzt" über der Tagesansicht | `module/raum-streifen.js` + Test | Worker | Zeigt je Raum Therapeut-Kürzel und Rest, keine Patientendaten |
| **M2b** | Umschalter Tagesansicht Therapeut/Raum, freie Räume im Formular | `module/kalender-raum.js`, `dashboard.js` | Worker + Haupt | Spalten je Raum; freie Räume im Formular gelistet |
| **M4a** | Migration `employee_standort_plan` (ohne Anon) | Migration | Haupt | wie M1a |
| **M4b** | Regel Einzeltag → Wochenmuster → alle zugeordneten Standorte | `api-backend/lib/standort-plan.js`, `module/standort-plan-regel.js`, gemeinsame Testvektoren | Worker | Beide Fassungen bestehen dieselben Vektoren |
| **M4c** | UI Wochenmuster, Einzeltag, „Versetzen" als ein Ablauf, Warnliste | `module/standort-plan.js` | Worker | Montag A: in B nicht sichtbar; Einzeltag wirkt in beiden |
| **M4d** | Filter in Kalender und `getAvailableSlots`, Serienplaner | `dashboard.js`, `server.js` | Haupt | Leere Tabelle oder Lesefehler = altes Verhalten |
| **M5a** | Migration `mitarbeiter_anstellung` | Migration, Klassifikation | Haupt | Kollegen lesen nichts, Inhaber schreibt |
| **M5b** | Felder im Team-Panel, Resturlaub mit Übertrag | `module/anstellung.js` | Worker | Rest stimmt, Mitarbeiter sieht nur eigenen |
| **M5c** | Warnung bei Abwesenheit in Einzel, Serie, Verschieben | `module/abwesenheit-pruefung.js`, `dashboard.js` | Worker + Haupt | Warnung ohne Grund, kein Block |
| **M6a** | Sondertage in Tag/Woche/Monat, Warnung beim Speichern | `module/kalender-sondertag.js` | Worker | Sichtbar in allen drei Ansichten |
| **M6b** | Migration Protokoll, Route Vorschau + Senden | Migration, `api-backend/routes/sondertag.js` + Test | Haupt | Nur Inhaber, Dedup vor Versand, Deckel je Lauf |
| **M6c** | Dialog Vorschau, Abwahl, Anrufliste | `module/sondertag-mitteilung.js` | Worker | Ablauf vollständig, Box ohne SMTP liefert Liste |
| **M7** | Generator im Panel Termin-Anfragen, Hinweis an Praxis | `module/widget-einbettung.js` + Test | Worker | Code kopierbar, Box-Regeln greifen |

Nummern: Migrationen ab 0092, vor jedem Schreiben `git fetch` (Kemal arbeitet parallel).

## 4. Arbeitsweise

- **Worktree** `~/infinitymade-p1`, Basis `origin/main`, kein Feature-Branch nach außen. Hauptbaum bleibt unberührt.
- **Pflichtschritte je AP:** `node --test` gezielt, Lint-Gates über Pre-Commit, nach jedem Block `npm test`. UI zusätzlich Browser-Probe mit Fixture.
- **Migrationen** laufen zuerst auf einer lokalen frischen Datenbank (Docker). Die Pre-Commit-Kapı verlangt `-- SaaS: angewandt`, also braucht jede
  Migration vor dem Commit das GO für die Live-Anwendung.
- **Rückwärtsverträglich:** alle Leser fallen bei fehlender Tabelle oder Spalte auf altes Verhalten zurück (`:stable`/`:beta`, O-222).
- **Kein Wachstum** in `dashboard.js` (Basis 18408): nur Änderungen in bestehenden Zeilen, Importe zusammengelegt.
- **Gemeinsame Module** bleiben unberührt. Wird eines nötig, entscheidet erst Kemal.
- **Abschluss je Block:** `fonksiyon-ustasi` Bildirim (niye, nerede), Karte neu, `db/REGISTER.md`, onprem-Sicil.

## 5. Nicht in diesem Plan

Kemals Bereich (K1–K13, I1–I8). THEORG-Import (K13), Standorteigene Sondertage, Halbtage, Stammraum/Leistung→Raum-Vorschlag, automatische
Umbuchung, automatischer Mailversand, Empfangsmodus mit Patientennamen.

## 6. Offen für Kemal

- DATEV-Zusage „bis zum zweiten Standort" fehlt in `PILOT-PLAN.md`.
- Foto-Rezeptscan wurde gezeigt, bleibt aber aus: Sandbox-Erwartung klären.
- Einwilligungstext E13 um „Terminänderungen" ergänzen, sonst greift der Opt-in für M6 nicht (`einwilligung-texte.js`).
- Offene Fragen an P1: gleiche Rechtsperson? Eigenes IK je Standort? Feste Räume oder leistungsgebunden?
