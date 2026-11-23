---
titel: Migrationen 0105 + 0122 live, Physio-Sitzungen nachgezogen, Live-Rundgang
typ: sitzung
angelegt: 2026-11-23
tags: [sitzung, migration, diagnosegruppen, mail-signatur, live-test]
---

# Migrationen 0105 + 0122 live, Physio-Sitzungen nachgezogen, Live-Rundgang (21.–23.11.2026)

> ⚠️ Eigene Notiz, kein amtliches Dokument (Ausnahme laut [[README]]). Maßgeblich für die
> Diagnosegruppen bleibt die HeilM-RL (Original + Fassung, siehe [[REGISTER]]).
> Nur Zähler und synthetische QA-Mandanten, keine Patientendaten.

## Was gemacht wurde

| Schritt | Ergebnis | Beleg |
|---|---|---|
| `api-backend/db/physio-sitzungen-nachziehen.sql` auf Produkt-DB | 5 → 0 fehlende Sitzungen | `ed05ce19` |
| Migration `0105_mail_signaturen` (Spalte `profiles.mail_signatur_einstellungen` + CHECK) | live, Ledger `20261121181746` | `1358660d` |
| Migration `0122_diagnosegruppen_heilm_rl_bereinigen` (aus `db/entwuerfe/` in die Kette) | live, Ledger `20261121181821`; 44 aktiv / 59 gesamt | `1358660d` |
| `db/SCHEMA*.sql`, `db/REGISTER.md`, `erwartete-zaehler.json`, `PRUEFSTAND.md` | nachgezogen; Zähler unverändert, `bis_version` 0129 | `1358660d` |
| Melihs Handtest (0105 + 0122 B1–B3) | bestanden | `4571f4ac` |
| Live-Rundgang drei Konten + B1-Rest | bestanden | dieser Commit |

Alle Commits liegen auf `origin/main`.

## Warum so entschieden

- **Probelauf vor jeder Live-Anwendung:** SQL ausführen, danach ein `DO`-Block mit
  `RAISE EXCEPTION 'PROBE_OK …'`. Der Fehler trägt das Ergebnis heraus und erzwingt den Rollback.
  So wird das echte Ergebnis gesehen, ohne etwas zu ändern.
- **Kopf von 0105 nicht geändert**, obwohl der Auftrag es wollte: Der Runner (`api-backend/db/migrate.js`)
  hasht die ganze Datei inkl. Kommentaren. Boxen, die 0105 schon haben, würden nicht mehr starten.
  Der Live-Stand steht deshalb in `db/REGISTER.md` statt im Dateikopf (Vorbild 0129).
- **0122 in die Kette trotz Lücke in der Nummerierung:** Der Runner erlaubt Lücken; Boxen mit
  0124–0129 holen 0122 einfach nach. Der Box-Ausgangsstand (Seed 0011 + 0014 + 0047, 57 Gruppen) ist
  derselbe wie SaaS vor 0122. Nachweis: volle Kette 0000–0129 auf Postgres 17.11 grün
  (`SPLIT=0122 bash tools/db-vollkette/vollkette-pg17.sh`).
- **Daten-Migration statt Löschen:** Die 15 Alt-DGs (vor HeilM-RL 2021) werden nur `aktiv=false`.
  Bestehende Verordnungen verweisen noch darauf und öffnen weiter normal (B3 bestanden).

## Live-Rundgang 23.11.2026 (gemessen)

Playwright gegen `app.praxura.de` (`dashboard.js?v=20261123qa1`), alle schreibenden Anfragen hart
abgebrochen (0 Versuche). Skript lokal: `~/praxura-qa/live-0105-0122-rundgang.mjs`.

- **Alle Bereiche:** Physio-Inhaber 25, Physio-Mitarbeiter 14, Podologie-Mitarbeiter 13. Kein
  `pageerror`, kein `console.error`. Einzige HTTP ≥ 400: `GET /api/status` → 404 im SaaS, gewollt
  (Box-only, Abschnitt wird ausgeblendet).
- **0105:** Fußzeilen-Editor rendert die gespeicherte Vorlage; REST mit Inhaber-Sitzung 200; `anon`
  hat kein SELECT auf die Spalte.
- **0122 (B1-Rest, Abnahmekriterium):** Das ausgelieferte Prüfmodul (`module/verordnung-pruefung.js`)
  lief im eingeloggten Browser auf dem Live-Katalog. Alle 13 gültigen Physio-DGs ohne Befund.
  Alt-DGs → `DG_UNBEKANNT`. Höchstmenge warnt bei 40 (`SB1, PS2, ST1, SP1`), bei 6 nicht.
- **`npm test` auf `main`:** 0 Fehler.

## Lernpunkte

- **„Abgelehnt“ heißt hier „veraltet“:** EX1, EX2, WS2, ZN1 sind Alt-DGs; WS3 gab es nie. Der Text
  „gehört nicht zum Fachbereich …“ führt in die Irre. Vorschlag für das Ops-Board (Teknik): eigener Text
  für deaktivierte Gruppen („seit HeilM-RL 2021 ersetzt, bitte neue DG wählen“).
- **Zugangsdateien unter `~/praxura-qa/` haben zwei Formate** (`email=`/`passwort=` und `Login:`/`Passwort:`).
  Vor dem Lesen das Format prüfen, ohne den Inhalt auszugeben.
- **Fremde Änderungen in derselben Datei:** Nur die eigenen Hunks committen (Index-Version aus HEAD plus
  eigenen Änderungen bauen). Kein `git add -A`.

## Offen

- Echter Mailversand mit Fußzeile (rote Linie Senden, nur mit Melih).
- Text für deaktivierte DGs (siehe Lernpunkte).
- `module/systemstatus.js` fragt im SaaS trotz `istKutu=false` `/api/status` ab (harmloser 404).
  Nicht geändert, weil die Datei zur laufenden Phase-7b-Arbeit gehört.
- O-129 in `onprem/REGISTER.md` als erledigt markieren (Rückfrage an Melih steht aus).
