# Physio-Abrechnung — Ausführung des Astra-Plans

Stand: 07.11.2026. Arbeitsnotiz, keine amtliche Quelle und keine externe Abnahme.

## Auftrag und Grenzen

Genehmigter Plan: ärztliche GKV-Physiotherapie lokal vollständig fertigstellen.
Zahnärztliche Verordnungen bleiben gesperrt. Keine Live-Migration, kein Deployment,
keine echte Übermittlung oder Kundenkontakt durch diesen Auftrag.
Das dauerhafte Ziel ist erst mit belegter Erfüllung abgeschlossen; externe
Fach-/DAS-Abnahme bleibt eigener Nachweis, kein Ersatz durch lokale Tests.

## Verbindliche Pakete

| Paket | Ergebnis | Status |
|---|---|---|
| 0 | Aktuelle Quellen, unabhängige Fallmatrix, numerischer Katalogvergleich, Testbasis | in Arbeit |
| 1 | Wiederholbare Erzeugung, atomare Claims/Snapshots/Freigabe, geschützte Downloads | vorbereitet, offen |
| 2 | Entlassmerkmal/-datum: Schema, UI, DTO, Neuladen, DTA, Snapshot | teilweise vorbereitet |
| 3 | Sitzungspositionen, T/K/F-Nachweise, leistungsbezogene Zuzahlung/Befreiung | offen |
| 4 | Standard → Entlassmanagement → LHB/BVB → Blanko mit eigener Abnahme | offen |
| 5 | Korrektur/Teilabrechnung/Wiederaufnahme und ZAA-Idempotenz | offen |
| 6 | Byte-/Versandpaket, Signatur/Verschlüsselung, UI→Download, unabhängige Abnahme | offen |

Pro Paket: Sollfall → reproduzierbarer Fehler → Umsetzung → Tests → unabhängiges
Review → Behebung/Nachprüfung → Commit. Gemeinsame Routen/Builder/Schema seriell.

## Ausgangslage und Nachweise

- Ausgangscommit dieser Umsetzung: `c2bb4126`; Abrechnungscode zuletzt `922fb5bd`.
- Checkout `main`, einen lokalen Dokumentationscommit vor `origin/main`;
  fremde unversionierte Arbeitsdateien bleiben erhalten.
- Vorhandene Fach-/Quellenmatrix: [[2026-11-07_physio-vertragsquellen-und-regelmatrix]].
- Unabhängige Sollfälle: [[2026-11-07_physio-sollfaelle]] (in Erstellung).
- Ausführungsnachweise: `fortschritte/2026-11-07_PHYSIO_ABRECHNUNG.md`.
- Testinventur: `fortschritte/2026-11-07_PHYSIO_TESTBASIS.md` (in Erstellung).
- Lokaler Datenentwurf: `db/entwuerfe/2026-11-07-physio-abrechnung.md`.
- Aktuelle Physio-Ausgabe bleibt wegen ungeklärtem Entlassmerkmal gesperrt.

## Bestätigtes Publikationsrisiko

`api-backend/billing/api/abrechnung.routes.js:1205–1260` schreibt Dateipfade,
Verordnungsbindung, Belegnummern und Rechnungszeilen in getrennten Schritten.
Bindungs-/Snapshotfehler werden teils nur geloggt. Registry-Nachregistrierung
ist ausdrücklich best-effort (`api-backend/billing/api/artefakt-registry.js`).
Das ist kein atomarer fachlicher Abschluss. Bestehende Reserve/Upload/Readback/
Publish- und Podo-Claim-Muster werden vor einer neuen Architektur geprüft.

Verbindliche Zielinvariante: Dateien zunächst unveröffentlicht; erst nach
erfolgreichem transaktionalem Festschreiben der Ansprüche, Zeilen und Bezüge
herunterladbar. DB und Objektspeicher bilden keine gemeinsame Transaktion.
Abbruch/Wiederholung darf weder Doppelabrechnung noch freigegebenen Teilstand erzeugen.

## Rollen und Freigabe

wissensbank/gkv-302: Originale und Sollfälle; fonksiyon-ustasi: Wiederverwendung;
db-ustasi: Datenvertrag/Transaktionen; physio: Erfassung; unabhängige QA: Nachweis.
Neue fachübergreifende Entscheidungen über konsey, UI über impeccable.
Neue Schemaentwürfe bleiben außerhalb automatischer Anwendung, bis Releasebedingungen
erfüllt sind. Fehlendes Schema sperrt gezielt; niemals NULL zu false umdeuten.

## Fortsetzung: Eingabesperren und Downloadgrenze

Paket-0-Reproduktion nach Funktionsberatung: Multi-Heilmittel ohne eigenen Code
wurde auf die Hauptposition umgedeutet; Einzel-Heilmittel akzeptierte zusätzliche
Sitzungen nach ausgeschöpfter Menge. Zwei neue Tests schlugen vor Behebung fehl
und bestehen danach. Bestehende gemeinsame Funktion `physioLeistungszeilen`
liefert nun kontrollierte 422-Fehler statt falscher Leistungszeilen. Gezielter Lauf
`node --test api-backend/billing/codes/physio-leistungszeilen.test.js`: 14/14.
Dies schließt nicht sämtliche Mengen-/Positionsregeln aus Paket 3.

Zusätzlicher Paket-1-Befund: `module/abrechnung-detail.js:777` erzeugt direkte
Storage-Signed-URLs. `db/SCHEMA-RLS.sql:42` dokumentiert tenantpfadbezogene
Leseberechtigung ohne Registry-Freigabestatus. Backend-Downloadprüfung allein
reicht deshalb nicht. Datenvertrag muss beide Zugriffswege kontrollieren und
bestehende Artefakte kompatibel halten. Kein Storage-/Live-SQL geändert.

Erster DB-Spezialistenversuch scheiterte am Agenten-Nutzungslimit. Erneute
native Beratung erfolgreich: `db/entwuerfe/2026-11-07-physio-publikation.md`.
Konsey-Beschluss: `konsey/tutanak/2026-11-07-physio-publikation.md`;
atomare fachliche Finalisierung plus Wiederholung und Storagefreigabe erforderlich.
Lokaler SQL-Prototyp `db/entwuerfe/physio-publikation-v1.sql` und reproduzierbare
Fixture/SQL-Tests unter `api-backend/db/tests/physio-publikation-v1.*.sql` geschrieben.
31 SQL-Assertions von Root unabhängig bestanden; erweiterte Agentenprobe 42
PASS-Notices inklusive zwei Verbindungen, Einzelclaim und stabilem Retry.
Reviewbefunde ZeilenINSERT-/Signaturblockade und globaler Hash gezielt geschlossen.
Noch keine Paketabnahme: globale Sperren, vollständige Quellen-/Schemaabdeckung,
Storageaktivierung, DSGVO-Klassifikation und Backendintegration offen.
Keine Provider-Umschaltung. Atomare Veröffentlichung bleibt offen. Unabhängige
Eingabefix-Nachprüfung abgeschlossen: keine Regression im geprüften Umfang,
14/14 Tests und zusätzliche Grenzproben unabhängig bestanden. Backend-Regressionslauf
nach Fix: 1.967 bestanden, vier übersprungen, null Fehler; regulär Exit0 in 21,80s.
Log lokal `/tmp/praxura-p0-fix-backend.log`; keine vollständige Physio-Abnahme.

Offen für externe Abnahme: konkrete DAS samt verbindlichem Rückmeldungs-/Testprofil,
externer Fachprüfer und gesonderte Live-Freigaben. CONTRL/APERAK nicht ohne Profil bauen.
