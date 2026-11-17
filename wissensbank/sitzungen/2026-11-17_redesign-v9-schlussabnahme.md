---
titel: Redesign v2 — V9 Schlussabnahme (V9.01–V9.07) und Zusammenführung mit den Bugfixes
typ: sitzung
angelegt: 2026-11-17
tags: [sitzung, redesign, abnahme, physio, podologie, rechte, fristen, mobil]
---

# Redesign v2 — V9 Schlussabnahme 16.–17.11.2026

Worktree `redesign-delta-20261112`, Branch `redesign/delta-20261112`. Neues Design bleibt live aus, bis die Pilot-Env gesetzt ist (O-245). Melih 17.11.: Alt-Funde in beiden Designs beheben, am Ende pushen, Pilot fürs Physio-Testkonto heute.

## Was gebaut wurde

| Paket | Inhalt | Wirkt auf |
|---|---|---|
| V9.01 | Panel-IDs ohne Rechte-Zuordnung (`kunden`, `ueberblick`, `warteliste`, `doctors`) folgen dem Recht ihres Bereichs (guvenlik S-68, kein Veto) | alt + neu |
| V9.02 | Startseite 769–1279 px: Karten einer Rasterzeile enden bündig | neu |
| V9.03 | „Freie Zeit“ zeigte bei Ladefehler der Termine den ganzen Arbeitstag als frei (Doppelbuchungsgefahr) → Fehlerzustand | alt + neu |
| V9.04 | Test-Fixture an `db/SCHEMA.sql`: echte UUIDs, gültige Status, Formfelder, Rechnungsbeträge, `user_id` der Behandlerin, `.or()` ausgewertet, leere Statistik, Anfragen-Antwort | nur Werkzeug |
| V9.05 | Beginnfrist nach HeilM-RL § 15 (gkv-302): rechtzeitig begonnene VO nicht mehr „überfällig“, verspäteter Beginn bleibt überfällig; Inhaber-Karte zählt verspäteten Beginn; neuer Start lädt Anfragen-Zähler | alt + neu |
| V9.06 | Wortlaut (Nichterscheinen, Verordnung erfassen, Hallux valgus), kein doppeltes „Bezahlt“, Leerzustand „Noch keine laufenden Verordnungen.“ | alt + neu |
| V9.07 | Patienten-, Verordnungs- und Rechnungsliste unter 600 px ohne Abschneiden (Rechnungen als Karten) | alt + neu |

## Was die Abnahme gelehrt hat

- **Fixture-Fehler sehen wie Produktfehler aus.** Die Hälfte der Blocker aus der Bildabnahme (Inhaberin ohne Fristen, überlappende Termine, doppelte Verordnungen, Geldzahlen in leerer Praxis, rohe Status) kam aus Testdaten, die die echte DB nie zulassen würde. Vor einer Bildabnahme die Fixture gegen die Prüfregeln in `db/SCHEMA.sql` halten.
- **`gueltig_bis` ist die Beginnfrist, nicht das Ende der VO.** Eine VO mit rechtzeitig dokumentiertem Beginn hat keine Beginnfrist-Warnung mehr; ein Beginn nach der Frist heißt, die VO war schon ungültig (Geld weg) und muss sichtbar bleiben.
- **Startseite liest Zustände anderer Bereiche** (Anfragen-Badge, Lückenliste). Was dort erst beim Öffnen des Bereichs lädt, fehlt auf der Startseite dauerhaft.

## Fachberater

- `podoloji` (27 Bilder): „mit Auflagen“. `physio` (20 Bilder): „Pilot ja, mit Auflagen“. `gkv-302`: Beginnfrist-Regel ohne Veto. `guvenlik`: S-68 ohne Veto. `mobil-ui`: misst und baut V9.02/V9.07.
- Offen für später (kein Pilot-Blocker): Therapeut je Zeile/Kalenderfarben, Verordnungsliste mit Diagnosegruppe/Arzt/Frist/Suche, Patientenliste mit Telefon/Kasse/nächstem Termin, Neuer-Termin-Dialog (Verordnung zuerst, Rhythmus), Kalender am Handy bei vielen Therapeuten, „Zu erledigen“ vs. „Ohne Folgetermin“. Details `redesign/STATUS.md` §9.

## Zusammenführung

Parallel hat eine Bugfix-Sitzung (erst Claude, dann Codex) Melihs Live-Funde auf `main` behoben (32 lokale Commits). Der Redesign-Branch wurde darauf rebaset; Konflikte nur bei `?v=`-Nummern und zwei Importzeilen. Sicherung `backup/redesign-vor-rebase-20261117`.

## Pilot

Env `DESIGN_NEU_PILOT_TENANTS` (+ optional `DESIGN_NEU_PILOT_ROLLEN=owner`) auf dem SaaS-VPS. Dieser Rechner hat keinen SSH-Zugang (publickey abgelehnt); Melih oder Kemal setzt die Env, danach Live-Prüfung im Testkonto und Rücknahmeprobe mit `DESIGN_NEU_AUS=1`.
