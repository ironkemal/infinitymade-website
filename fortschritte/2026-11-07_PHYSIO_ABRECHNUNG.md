# Physiotherapie-Abrechnung — lokaler Zwischenstand 07.11.2026

## Status

Teilumsetzung des genehmigten Plans. Code bis `922fb5bd` auf ausdrücklichen Auftrag gepusht. Keine Freigabe für Echtbetrieb, kein Deployment, keine Live-Migration und keine Übermittlung. Fortschreibung des Astra-Plans: `wissensbank/sitzungen/2026-11-07_physio-fertigstellung.md`.

## Geschrieben und gezielt lokal geprüft

- Preisauflösung blockiert unbekannte Positionen, fehlende Preisfenster, falsche Leistungserbringergruppe und fehlende tatsächliche Leistungstage. DTA-Mapping verwendet Berliner Leistungstag statt UTC-Datumsabschneiden.
- KVNR-Prüfziffer nach offizieller Anlage, IK-Prüfungen, echte Kalenderdaten, Datennummer, Mengen-/Betragsgrenzen und Dezimalstellen vor Ausgabe.
- Unabhängige Ausgangsprüfung für unterstütztes TP5-V21-Profil: Segmentfolge, Felder, Referenzen/Zähler, Zeichensatz, EHE/BES/GZF und nachrichtenübergreifende GES-Summen. Keine Behauptung vollständiger GKV-Grammatikabdeckung.
- EHE und Summen verwenden denselben Zuzahlungsfallback; positionsbezogene Befreiung berücksichtigt. Release-Zeichen werden beim Segmentzählen berücksichtigt.
- Physio-Verfahrensprüfung: Beginn 28/14 Tage, kalenderbasierte 3/6 Monate, dokumentierte T/K/F-Pausen, Entlassfristen 7/12 Tage. Blanko-Standardtaxierung und ungeklärte Übergänge werden gesperrt.
- Originalverträge und KVNR-Anlage in Wissensbank registriert; Quellen-/Regelmatrix: `wissensbank/sitzungen/2026-11-07_physio-vertragsquellen-und-regelmatrix.md`.

## Wesentliche Betriebssperre

Das Entlassmerkmal ist bisher weder strukturiert gespeichert noch im Abrechnungspfad geladen. Unbekannt wird deshalb ausdrücklich mit `PHYSIO_ENTLASSMERKMAL_UNGEKLAERT` gesperrt. **Der aktuelle Physio-DTA-Pfad ist damit insgesamt gesperrt**, bis Schema, Erfassung und Laden eines ausdrücklich bestätigten Merkmals umgesetzt und geprüft sind. Dies ist eine lokale Schutzmaßnahme, keine fertiggestellte Physiotherapie-Abrechnung. Podologie bleibt unabhängig.

## Testnachweise

- `node --test "api-backend/billing/dta/*.test.js" "api-backend/billing/preise/*.test.js"`: 342 Tests, 342 bestanden; außerdem interne Legacy-Assertions in vorhandenen Testdateien.
- Zuzahlungsforderungs-Routentests separat: 51/51 laut unabhängigem Testlauf. Ungültige synthetische KVNR im Fixture ersetzt; Produktionsprüfung blieb streng.
- Billing-Gesamtlauf: `node --test --test-force-exit "api-backend/billing/**/*.test.js"`: 1.037/1.037 bestanden, 0 Fehler, 0 übersprungen (31,98 Sekunden). Force-exit beendet offene Testhandles nach Abschluss. Gesamt-Backend separat nicht abschließend ausgewertet. Keine externe DAS-Abnahme.
- Unabhängige QA fand GES-Abgleich, INV/ZHE-Pflichten, Positionspräfix und UTC-Leistungstagfehler; behoben und Mutationstests ergänzt. Abschließende unabhängige Wiederholungsprüfung brach am Agenten-Nutzungslimit ab und bleibt offen.

## Fortsetzung, in Reihenfolge

1. DB-Entwurf `db/entwuerfe/2026-11-07-physio-abrechnung.md` durch Fach-/Daten-/Rechtsprüfung abschließen. Entlass-SQL unter `db/entwuerfe/0112_prescriptions_entlassmanagement.sql` lokal vorbereitet, nicht in aktiver Migrationskette und nicht live angewandt. Vor weiteren Freigaben atomaren Publikations-/Sitzungsanspruchsschutz herstellen (Astra-Paket 1).
2. Strukturierte Entlass- und Unterbrechungsdaten erfassen, ownergebunden laden und festschreiben; Altbestand unbekannt lassen. Erst danach Physio-Schutzsperre durch vollständig geprüfte Angaben erfüllen.
3. Leistungsbezogene Befreiungsintervalle und Volljährigkeit samt Blattgebühr am ersten Leistungstag in bestehenden gemeinsamen Berechnungsweg integrieren. Auch unterjährige Befreiungswechsel prüfen; momentane Übergangssperren reichen dafür nicht.
4. Blanko-Preise/Positionen/Ampel deterministisch mit Originaltabellen abgleichen; LHB/BVB-Berechtigung, Leistungsmenge und Kombinationen, Qualifikationen, Teilabrechnung und Wiederaufnahme einzeln nachweisen. Exakte 16-Wochen-Endgrenze bleibt ungeklärt.
5. Sitzungsschutz gegen Doppelabrechnung und ZAA-Importidempotenz atomar umsetzen; ursprüngliche Artefakte erhalten. Profilabhängige Decoder bleiben bis verbindlichem DAS-Profil gesperrt.
6. Vollständiges synthetisches Versand-/Abnahmepaket, unabhängige Byteprüfung, Fehlerbetrieb und UI→Download-Integration abschließen. Gesamt-Backend und offene Testhandles prüfen; externe Fach-/DAS-Prüfung gesondert.

## Lokal nutzbare Gut-/Schlechtfälle

`api-backend/billing/dta/output-validator.test.js` enthält handgeschriebenen Gut-Datenstrom mit unabhängig festgelegten Centbeträgen und Mutationen für falsche Version, Referenzen, Datumswerte, Mengen, Überlauf, Unicode, INV/ZHE und widersprüchliche Summen. `strict-fields.test.js`, `physio-verfahren.test.js` und `preise/abrechnungsfenster.test.js` ergänzen Eingabe-, Frist- und Preisgrenzen. Synthetische Syntaxfälle begründen keine Vergütungsberechtigung.


## Fortsetzung: Entlassdaten lokal vorbereitet

- Bisherigen Zwischenstand am 07.11.2026 auf ausdrücklichen Auftrag nach origin/main gepusht (bis 8d53e248 einschließlich vorhandener QA-Dokumentation).
- `db/entwuerfe/0112_prescriptions_entlassmanagement.sql`: nullable Merkmal/Datum, konsistente Paare, Ausschluss Blanko und bestehender Festschreibungsschutz erweitert. Kein Default/Backfill. Nicht live angewandt; SCHEMA-Exports unverändert.
- Gemeinsame strikte Feldprüfung in `rezept-felder.js`; bestehende Confirm-/PATCH-Routen verwenden sie vor Sideeffects. Ausgelassene Felder bleiben unberührt. Datenbank-Konsistenzfehler liefern stabilen422-Code mit Feldbezug.
- 63/63 gezielte JavaScript-Tests bestanden. PostgreSQL17.11-Minimalprobe durch db-ustasi bestanden; vollständige Migrationskette/RLS nicht damit nachgewiesen.
- Unabhängiges Review entdeckte Blanko-Wechsel bei ausgelassenem Entlasspaar; durch DB-Invariante für effektiven Alt-/Neustand geschlossen, SQL-Übergangsfälle ergänzt.
- UI-Erfassung, DTO-Roundtrip und Laden in DTA stehen noch aus. Bestehende Physio-Sperre bleibt aktiv. Neue Serverfelder erst nach autorisierter Schemaanwendung verwenden.

Backend-Gesamtlauf nach Entlassdaten-Ergänzung: 1.965 bestanden, vier übersprungen, null Fehler (26,93 Sekunden). Unabhängige Nachprüfung bestätigt Behebung des Blanko-Widerspruchs; SQL-Probe vom Reviewer gelesen, nicht selbst ausgeführt.

Commit-Gate verlangt für aktive Migrationen SaaS-Status und Box-Zählermessung. Deshalb bleibt SQL bewusst unter db/entwuerfe außerhalb der automatischen Migrationskette; keine Gate-Umgehung und keine automatische Box-Anwendung. Aktivierung erfordert eigenen Releaseschritt.

## Astra-Fortsetzung: Prüfvertrag und reproduzierte Eingabefehler

- Zentrale Wissensfassung: `wissensbank/sitzungen/2026-11-07_physio-fertigstellung.md`; unabhängige Fachfälle: `2026-11-07_physio-sollfaelle.md` im selben Ordner. Numerischer Vollabgleich bleibt offen; Stichproben sind keine Tarifabnahme.
- Neuer regulärer Backend-Basislauf: 1.965 bestanden, vier opt-in PostgreSQL-Integrationen übersprungen, kein Fehler/offener Handle reproduziert. Details in `2026-11-07_PHYSIO_TESTBASIS.md`.
- Zwei Regressionstests zunächst rot: Multi-Heilmittel ohne eigenen Code wurde als Hauptposition abgerechnet; Einzelzweig akzeptierte Sitzungen über ausgeschöpfter Menge. Bestehenden Mapper gezielt korrigiert; keine neue Funktion/kein Schema.
- Nach Fix: `node --test api-backend/billing/codes/physio-leistungszeilen.test.js` 14/14. Unabhängiges Funktionsreview und zusätzliche Grenzproben bestätigen Fix und unveränderte ungerade Doppelmenge.
- `npm run test:backend` nach Fix regulär Exit0: 1.967 bestanden, vier übersprungen, null Fehler, 21,80 Sekunden; Log `/tmp/praxura-p0-fix-backend.log`.
- Publikationsreview findet direkten Storage-URL-Download und tenantpfadbezogene Storage-Policy ohne Freigabestatus. Paket1 muss beide berücksichtigen. Neuer DB-Vertrag mangels erfolgreicher Spezialistenprüfung noch nicht geschrieben (Agentenlimit); keine Publikations-/Schemafreigabe.
- Gesamtziel bleibt offen. Paket0 ist teilweise geliefert, nicht vollständig abgenommen; Pakete1–6 nicht abgeschlossen.

## Publikationsvertrag: lokaler Transaktionsprototyp

- Konsey-Beschluss A und konkreter DB-Vertrag in `8dcf373f` gesichert; reine JavaScript-Umsortierung reicht nicht.
- Neue Dateien `db/entwuerfe/physio-publikation-v1.sql` und `api-backend/db/tests/physio-publikation-v1.fixture.sql`/`.test.sql`: additive, nicht aktivierte Erstabrechnungs-Probe. Keine Live-/Boxmigration, keine neuen Schemaexports.
- Statisches unabhängiges Review fand fehlenden Zeilen-INSERT-Schutz und Blockade späterer signed/encrypted-Artefakte; gezielt behoben und unabhängig nachgelesen. Rootreview verwarf globalen Mandantenhash; nun owner-/auswahlbezogener Quellhash.
- Root führte Fixture inklusive ihrer `\\ir`-Abhängigkeiten und anschließend Testdatei in frischem lokalem `postgres:17.11` mit `--pull=never --network none`, tmpfs und ohne Ports/Volumes aus: 31/31 SQL-Assertions, Exit0; Container im finally entfernt. Fixture ist ausdrücklich Teilmenge ohne sämtliche Bestands-FKs/Audit-/RLS-Trigger, keine vollständige Kettenprüfung. Erstaufruf lud Draft versehentlich doppelt; auf leerem Container korrekten Fixture→Test-Aufruf wiederholt.
- Bekannte Freigabeblocker: globale Quelltabellensperren, vollständige Quellen-/Schemaabdeckung, Backendintegration, Storage-Policy-/Bestandsabgleich, DSGVO-Auskunft/Löschung, echte komplette Upgrade-/RLS-Prüfung. Korrektur-/Delta-/Stornoprotokoll nicht durch diesen Erstabrechnungsprototyp freigegeben.
- Bestehendes Goal steht technisch auf paused; CreateGoal mit vollständigem Auftrag wurde einmal aufgerufen und wegen unerledigtem Altziel abgewiesen. Keine neue Goal-Automatik aktiviert; verfügbare Werkzeuge besitzen keine Resume-Operation. Umsetzung innerhalb laufender Sitzung trotzdem fortgesetzt.
- Abschließende Agentenprobe erweitert auf 42 PASS-Notices, Exit0: zwei PostgreSQL-Verbindungen per lokalem dblink/Unixsocket, identischer Reserveauftrag ergibt gleiche Kopf-ID, überlappende Finalizer ergeben einen veröffentlichten Fall/einen Quellkonflikt, genau einen Dauerclaim; Wiederholung nach verlorener Commit-Antwort stabil. Zusätzlich Legacy-ohneHash und blockierte VKZ02/04/10. Root hat Log gelesen, diesen erweiterten Parallelitätslauf nicht selbst wiederholt. Reproduktionsbefehle im Testkopf, Log `/tmp/physio-publikation-v1-proof.log`.

## Publikationsadapter: lokaler Backendvertrag

- Bestehende Registry-API um getrennte Reserve-/Readback-/Finalize-Adapter ergänzt; Legacy-RPC und sämtliche aktiven Routen unverändert. Noch keine Schema-/Storage-Aktivierung.
- Exakte SQLSTATE/Fachcode-Allowlist; unbekannte Datenbanktexte, Details und Hints gelangen nicht in Fehlermeldungen. Fehlende RPC-/Schemafähigkeit und unklarer Transportausgang liefern 503, Konflikte 409. SQL-Zeitstempel bleiben für CAS unverändert, einschließlich Mikrosekunden.
- Unabhängiger Review fand Supabase-Transportantwort mit status0 und unvollständige Worker-Zusagen. Beide reproduziert, behoben und durch Regressionen abgesichert; echter Supabase-Client mit ausschließlich lokal werfendem Fetch getestet.
- Gezielte Prüfung: `node --test api-backend/billing/api/artefakt-registry.test.js api-backend/billing/api/physio-publikation-rpc.test.js`: 17/17 bestanden.
- Regulärer Gesamtlauf `npm run test:backend`: 1.973 bestanden, vier übersprungen, null Fehler, Exit0 (38,15s); Log `/tmp/praxura-publication-adapter-backend-final.log`.
- SQL-Lockprotokoll und worker_granted werden parallel separat geprüft. Veröffentlichung bleibt bis vollständiger Backend-/Storage- und Schemaabnahme gesperrt.
