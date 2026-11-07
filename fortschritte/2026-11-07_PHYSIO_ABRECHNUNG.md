# Physiotherapie-Abrechnung — lokaler Zwischenstand 07.11.2026

## Status

Teilumsetzung des genehmigten Plans. Keine Freigabe für Echtbetrieb, kein Deployment, kein Push, keine Live-Migration und keine Übermittlung.

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

1. DB-Entwurf `db/entwuerfe/2026-11-07-physio-abrechnung.md` durch Fach-/Daten-/Rechtsprüfung abschließen. Noch keine Migration geschrieben oder angewandt.
2. Strukturierte Entlass- und Unterbrechungsdaten erfassen, ownergebunden laden und festschreiben; Altbestand unbekannt lassen. Erst danach Physio-Schutzsperre durch vollständig geprüfte Angaben erfüllen.
3. Leistungsbezogene Befreiungsintervalle und Volljährigkeit samt Blattgebühr am ersten Leistungstag in bestehenden gemeinsamen Berechnungsweg integrieren. Auch unterjährige Befreiungswechsel prüfen; momentane Übergangssperren reichen dafür nicht.
4. Blanko-Preise/Positionen/Ampel deterministisch mit Originaltabellen abgleichen; LHB/BVB-Berechtigung, Leistungsmenge und Kombinationen, Qualifikationen, Teilabrechnung und Wiederaufnahme einzeln nachweisen. Exakte 16-Wochen-Endgrenze bleibt ungeklärt.
5. Sitzungsschutz gegen Doppelabrechnung und ZAA-Importidempotenz atomar umsetzen; ursprüngliche Artefakte erhalten. Profilabhängige Decoder bleiben bis verbindlichem DAS-Profil gesperrt.
6. Vollständiges synthetisches Versand-/Abnahmepaket, unabhängige Byteprüfung, Fehlerbetrieb und UI→Download-Integration abschließen. Gesamt-Backend und offene Testhandles prüfen; externe Fach-/DAS-Prüfung gesondert.

## Lokal nutzbare Gut-/Schlechtfälle

`api-backend/billing/dta/output-validator.test.js` enthält handgeschriebenen Gut-Datenstrom mit unabhängig festgelegten Centbeträgen und Mutationen für falsche Version, Referenzen, Datumswerte, Mengen, Überlauf, Unicode, INV/ZHE und widersprüchliche Summen. `strict-fields.test.js`, `physio-verfahren.test.js` und `preise/abrechnungsfenster.test.js` ergänzen Eingabe-, Frist- und Preisgrenzen. Synthetische Syntaxfälle begründen keine Vergütungsberechtigung.
