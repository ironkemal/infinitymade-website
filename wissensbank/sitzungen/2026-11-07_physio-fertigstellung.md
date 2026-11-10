# Physio-Abrechnung — Ausführung des Astra-Plans

Stand: 10.11.2026. Arbeitsnotiz, keine amtliche Quelle und keine externe Abnahme.
Ältere Abschnitte dokumentieren damalige Zwischenstände. Aktueller Abgleich unten;
vorhandene Implementierung bedeutet keine vollständige Paketabnahme.

## Auftrag und Grenzen

Genehmigter Plan: ärztliche GKV-Physiotherapie lokal vollständig fertigstellen.
Zahnärztliche Verordnungen bleiben gesperrt. Keine Live-Migration, kein Deployment,
keine echte Übermittlung oder Kundenkontakt durch diesen Auftrag.
Das dauerhafte Ziel ist erst mit belegter Erfüllung abgeschlossen; externe
Fach-/DAS-Abnahme bleibt eigener Nachweis, kein Ersatz durch lokale Tests.

## Verbindliche Pakete

| Paket | Ergebnis | Status |
|---|---|---|
| 0 | Aktuelle Quellen, unabhängige Fallmatrix, numerischer Katalogvergleich, Testbasis | Teilnachweise vorhanden; vollständiger Soll-/Ist-Abgleich offen |
| 1 | Wiederholbare Erzeugung, atomare Claims/Snapshots/Freigabe, geschützte Downloads | Ablauf/Adapter und Migrationen 0113/0115 vorhanden; Aktivierungs-/Gesamtnachweis offen |
| 2 | Entlassmerkmal/-datum: Schema, UI, DTO, Neuladen, DTA, Snapshot | 0112 und UI umgesetzt; historischer QA-Roundtrip dokumentiert, vollständige Paketabnahme offen |
| 3 | Sitzungspositionen, T/K/F-Nachweise, leistungsbezogene Zuzahlung/Befreiung | Tagescalculator vorhanden und gehärtet; aktive Berechnungswege noch nicht gemeinsam angebunden |
| 4 | Standard → Entlassmanagement → LHB/BVB → Blanko mit eigener Abnahme | Einzelabnahmen weiterhin nachzuweisen |
| 5 | Korrektur/Teilabrechnung/Wiederaufnahme und ZAA-Idempotenz | ZAA-Migration 0114 vorhanden; gesamte Korrektur-/Wiederaufnahmekette offen |
| 6 | Byte-/Versandpaket, Signatur/Verschlüsselung, UI→Download, unabhängige Abnahme | Teiltests vorhanden; vollständiger unabhängiger Gesamtnachweis offen |

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
- Historischer Ausgangsblocker war unbekanntes Entlassmerkmal. Inzwischen existieren Eingabe und Schema; Publikationsweg bleibt standardmäßig hinter `PHYSIO_PUBLIKATION_V1` gesperrt.

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

## Publikationsadapter: lokaler Backendvertrag

- Bestehende Registry-API um getrennte Reserve-/Readback-/Finalize-Adapter ergänzt; Legacy-RPC und sämtliche aktiven Routen unverändert. Noch keine Schema-/Storage-Aktivierung.
- Exakte SQLSTATE/Fachcode-Allowlist; unbekannte Datenbanktexte, Details und Hints gelangen nicht in Fehlermeldungen. Fehlende RPC-/Schemafähigkeit und unklarer Transportausgang liefern 503, Konflikte 409. SQL-Zeitstempel bleiben für CAS unverändert, einschließlich Mikrosekunden.
- Unabhängiger Review fand Supabase-Transportantwort mit status0 und unvollständige Worker-Zusagen. Beide reproduziert, behoben und durch Regressionen abgesichert; echter Supabase-Client mit ausschließlich lokal werfendem Fetch getestet.
- Gezielte Prüfung: `node --test api-backend/billing/api/artefakt-registry.test.js api-backend/billing/api/physio-publikation-rpc.test.js`: 17/17 bestanden.
- Regulärer Gesamtlauf `npm run test:backend`: 1.973 bestanden, vier übersprungen, null Fehler, Exit0 (38,15s); Log `/tmp/praxura-publication-adapter-backend-final.log`.
- SQL-Lockprotokoll und worker_granted werden parallel separat geprüft. Veröffentlichung bleibt bis vollständiger Backend-/Storage- und Schemaabnahme gesperrt.

## Fortsetzung 10.11.2026: Zuzahlung und belastbarer Restumfang

Ausgangsstand `d384c2b4`, `main` nach Fetch synchron mit `origin/main`.
Fremde Änderungen `db/NUTZUNG.*`, unversionierte Berichte und `tools/db-vollkette/`
bleiben erhalten. Alte offene Upload-/RPC-Entwürfe aus früherer Übergabe sind im
aktuellen Checkout bereits weiterentwickelt und werden nicht erneut gebaut.

Vorhanden: `physio-publikation-ablauf.js`, Routenanbindung hinter exakt gesetztem
Feature-Flag, Migrationen 0112–0115. Tagesprotokoll und `canli-test/REGISTER.md`
berichten historische Live-Prüfungen; diese Fortsetzung führt keinen Live-Zugriff
aus und bestätigt keinen aktuellen QA-Serverzustand.

Funktionsberater und gkv-302 getrennt konsultiert. Reproduziert und korrigiert:
Befreiungs-Enddatum verlor Gültigkeit am selben Tag; unmögliche Kalenderdaten
passierten Regex; ungültige Leistungsbeträge wurden still zu null Euro;
Positionszuzahlungen und Gesamtüberlauf blieben ungeprüft. Bestehende Helfer
`istStichtag`, `berlinHeute`, `isDtaDecimal` wiederverwendet. Review fand zusätzlich
normalisierte ungültige Referenzstrings; jetzt ausschließlich echte ISO-Tage oder
gültige Date-Instanzen für Befreiungsprüfung. Vier-Zeitzonen-Test reproduzierte
vorzeitige Volljährigkeit in Los Angeles; bestehender `isUnter18` vergleicht nun
Kalendertage und bildet echte Zeitpunkte auf Berlin ab.

Quellenabgleich ausschließlich gegen archivierte Original-TXT: W-17 §8 Abs.2–4
(Lesefassung 04.04.2022, Zeilen 753–783), W-29 §32 Abs.2 (27–32), W-30 §§187/188
(11–13,23–27). Kein neuer Nachweis aktueller Herausgeberfassung. Geburtstag ist
keine offene Praxisentscheidung; Partnerfrage #22 auf Erfassungsablauf umgestellt.
Status des ersten Behandlungstags für Blattgebühr bleibt systematische Auslegung
mit gezielt erforderlicher externer Fallprüfung.

**Nächste lokale Reihenfolge:** Jahresbindung und Herkunft von Befreiungsnachweisen
klären; ursprünglichen ersten Behandlungstag sowie bereits erhobene Blattgebühr
für Korrekturen festlegen; gemeinsame Sollfälle für Vorschau, Patientenforderung,
Snapshot und DTA erstellen; danach zusammenhängend anbinden. Bloßer Importwechsel
wäre falsch: aktive Pfade verlieren Tagesdatum oder verwenden verordnungsweiten
Status. Ungebundener Boolean `befreit_im_jahr` und pauschales
`verordnung_zuzahlungsfrei` sind vor Aktivierung weiter zu klären.

QA-Flag, Box-/Hardwareabnahme und externe Fach-/DAS-Prüfung bleiben gesondert;
sie blockieren diese unabhängigen lokalen Restarbeiten nicht. Zahnärztliche
Verordnungen bleiben gesperrt. Kein vollständiger Abschluss behauptet.

Nachweis dieses Schritts: `npm run test:backend` nach letztem Codefix:
2.036 PASS, 4 SKIP, 0 FAIL, Exit0 (26,90s), Log
`/tmp/praxura-20261110-copay-final.log`. Calculator-/Legacyfälle in UTC,
Los Angeles, Tokio und Berlin grün. Unabhängiger Abschlussreview: 31/31 unter
Los Angeles plus Timestamp-/Date-Kompatibilität unter Tokio, keine neuen Blocker.
Keine Live-/Browserabnahme. Tagesverlauf: `fortschritte/2026-11-10.md`.

DB-Pflichtberatung anschließend abgeschlossen: Jahres-Unique verhindert getrennte
Intervalle; Browser-Upsert und jährlicher Dateipfad müssen zusammen umgestellt
werden. Bisheriges Rezeptboolean folgt Ausstellungsdatum, vorhandene Zahlungsfelder
trennen Blattgebühr nicht vom Gesamtbetrag. Konkrete nächste Datenvertragsgrenzen
in `db/entwuerfe/2026-11-07-physio-abrechnung.md`, Nachtrag 10.11.2026. Keine
neue Migration geschrieben; keine Altbeträge oder Nachweiszeiträume erfunden.
