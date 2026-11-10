# Schema-Entwurf: belastbare Physiotherapie-Abrechnung

Stand: 07.11.2026 · **Entwurf, keine Migration geschrieben oder angewandt.**
Auftrag: lokale Ergänzung des freigegebenen Abrechnungsplans; Schema vor Umsetzung gesondert prüfen.

## Belegter Ausgangsstand

Die lokale Struktur ist der gezielt fortgeschriebene Export vom 06.11.2026, Migration 0111. Keine erneute Live-Introspektion. Quellen: `db/README.md`, `db/REGISTER.md`, `db/SCHEMA.sql`, `db/NUTZUNG.json`; Codebeleg für ZAA: `api-backend/db/migrations/0111_zaa_fehler_belegnummer_kasse.sql`.

- `prescriptions` besitzt Formmerkmale (`rezept_typ`, `is_blanko`, `is_lhb_bvb`), aber kein dokumentiertes Entlassungsdatum/-merkmal. `computed` ist Ergebnis-/Erfassungsmetadaten, `fhir_raw` Rohimport; keiner dieser Behälter ist ein Vertrag für geprüfte Abrechnungstatsachen.
- `prescription_sessions` hat einzelne erbrachte Sitzungen und `notes`; kein typisierter Unterbrechungsnachweis.
- `zuzahlung_befreiung` enthält bereits patienten- und ownergebundene Zeiträume und Belegbezug; Unique `(patient_id, jahr)` ist bestehende Einschränkung.
- `prescription_documents` ist vorhandener Nachweisspeicher. Sein Art-CHECK kennt noch keinen Blanko-Wiederaufnahmenachweis.
- `abrechnung_zeile` friert `leistungen` und Beträge ein; einzelne Sitzungen werden dort nicht relational gegen Mehrfachabrechnung beansprucht.
- `abrechnung.verarbeitungskennzeichen` erlaubt im derzeitigen CHECK nur 01–04. Der reine JavaScript-Schlüssel 10 belegt keine persistierbare Wiederaufnahme.
- `abrechnung_uebermittlung` hat bereits SHA-256, Richtung, Original-/Antwortbezug und Owner; Stammdaten sind festgeschrieben, Patientendaten strikt verboten.
- Die ZAA-RPC 0111 ist atomar und versionsgebunden, aber nicht idempotent: ein neuer Aufruf ersetzt den Fehlerbestand und setzt dessen Bearbeitungsstatus auf offen.

## 1. Entlassmanagement: unbekannt bleibt unbekannt

`prescriptions` ergänzen um:

- `entlassmanagement boolean NULL`, ohne Default: NULL = ungeprüft, false = ausdrücklich kein Entlassmanagement, true = bestätigt.
- `entlassungsdatum date NULL`.

Constraint: true verlangt Datum; false verlangt NULL-Datum. NULL darf für Altbestand erhalten bleiben, ist jedoch kein abrechenbarer Ersatz für false. Bestätigung erfolgt durch denselben autorisierten Backend-Schreibweg wie andere Verordnungsdaten; keine direkte Client-Sonderroute. Neue Angaben ab dem bestehenden Festschreibungszeitpunkt gegen rückwirkende Änderung schützen; Korrektur erfolgt über vorhandenen fachlichen Korrekturweg.

Keine automatische Ableitung aus Klinik-BSNR, Notizen, OCR-Confidence oder fehlendem FHIR-Feld. Ein strukturierter, bestätigter Import darf den Wert liefern. Entlassmanagement und Blanko werden nach Originalvertrag als unzulässige Kombination abgewiesen. Fachliche Fristen bestimmen Vertrag und `gkv-302`, nicht SQL-Datumsheuristiken.

## 2. Mehrere Unterbrechungen pro Verordnung

Neue Relation `prescription_unterbrechung` ist begründet durch 1:n-Kardinalität; ein einzelnes Verordnungsfeld reicht nicht. Vorgesehene Felder:

- UUID, Owner, optional Standort, Verordnungs-FK.
- `von date`, `bis date`, `grund text` mit T/K/F-CHECK.
- `dokumentiert_von uuid`, `dokumentiert_am timestamptz`.
- optionaler Bezug auf vorhandenes `prescription_documents` als Nachweis; kein neues Dokumentenlager.

Constraints: von ≤ bis; Verordnung, Standort und Dokument gehören demselben Owner. Das Intervall bezeichnet genau den dokumentierten Unterbrechungszeitraum; die Abrechnung prüft, ob die zwischen zwei Leistungen liegende Pause abgedeckt ist. Kein Herauslesen von T/K/F aus Freitext `notes`. Erfassung bestätigt Dokumentation auf dem Urbeleg, keine automatisch erzeugte medizinische Begründung.

Bereits für Abrechnung verwendete Nachweise werden nicht überschrieben. Die Rechnungszeile friert angewandte Nachweis-IDs und Inhalte ein. Fachliche Änderung erzeugt einen neuen dokumentierten Stand; tatsächliche Aufbewahrungs-/Löschregeln vor Migration mit `legal-de` festlegen.

## 3. Befreiung nach Leistungstag: vorhandene Tabelle verwenden

Keine zweite Befreiungstabelle und kein zweites Jahresflag. Der Backend-Berechnungsweg lädt nur zur betreffenden Praxis und Person gehörende `zuzahlung_befreiung`-Intervalle, prüft den jeweiligen Leistungstag einschließlich Jahresgrenze und berücksichtigt Geburtsdatum. Blattgebühr wird nach erstem Behandlungstag bestimmt; Prozentanteil nach jeweiligem Leistungstag (Quellenmatrix vom 07.11.2026).

Rechnungszeile erhält im vorhandenen `leistungen`-Snapshot pro Leistung angewandten Befreiungsstatus, Nachweis-ID und Berechnungsgrund. Eine spätere Änderung des Ausweises ändert ältere Rechnungsbeträge nicht. `computed` darf daraus berechnete Vorschau enthalten, ist aber nicht Autorität.

Offener Fach-/Datenpunkt: Ein vorhandenes Intervall je Patient und Jahr kann mehrere disjunkte Bescheinigungen desselben Jahres nicht ausdrücken. Kein Zusammenziehen zweier Intervalle über eine nicht befreite Lücke. Falls solche Fälle unterstützt werden müssen: bestehendes Jahres-Unique gezielt durch Intervallmodell ersetzen; vor Änderung eigene Prüfung und keine automatische Bestandsumschreibung. Bis dahin blockiert Mehrdeutigkeit die betroffene Abrechnung.

## 4. Blanko-Wiederaufnahme und Teilabrechnung

`abrechnung`-CHECK um 10 ergänzen, erst wenn Wiederaufnahme fachlich und technisch freigegeben ist. Kein bloßes Entfernen des CHECKs.

`abrechnung_zeile` ergänzen um:

- `ursprung_zeile_id uuid NULL` als FK auf bereits existierende Originalzeile.
- `wiederaufnahme_document_id bigint NULL` als FK auf vorhandenen Nachweis.
- `wiederaufnahme_document_sha256 text NULL` zur Bindung der tatsächlich geprüften Anhang-A-Bytes; Hashformat 64 Hexzeichen.

Dokumentenart-CHECK um `blanko_wiederaufnahme` ergänzen. Beim Veröffentlichen prüft die Transaktion: gleicher Owner, gleiche Verordnung, geeigneter ursprünglicher Abrechnungszustand, Anhang vorhanden und Hash gültig, ZHE-Verordnungsart 05, fachlich gültiger Rezidivfall innerhalb gültiger Frist. Ursprungsbezug darf nicht selbstreferenziell oder zyklisch sein. Bezug und Nachweishash sind nach Veröffentlichung festgeschrieben. Dokument und Ursprungszeile bleiben über RESTRICT erhalten. Mehrere Rezidive erhalten jeweils eigenen Rechnungs-/Nachweisbezug; keine globale Verordnungs-Flag-Simulation.

Für eindeutige Sitzungsbeanspruchung neue Relation `prescription_session_abrechnungsanspruch`:

- `prescription_session_id uuid PRIMARY KEY` und FK auf Sitzung.
- Owner, Verordnungs-ID und ursprüngliche `abrechnung_zeile_id` als geprüfte FKs.
- Zeitpunkt der erstmaligen veröffentlichten Beanspruchung.

Ein Anspruch erfasst die Sitzung samt ihren tatsächlich erbrachten Leistungsbestandteilen, nicht jeden EHE-Satz getrennt. Die beteiligten Leistungen bleiben im Snapshot der Zeile. Beanspruchung und Veröffentlichung erfolgen in einer Transaktion: parallele Rechnungserzeugung für dieselbe Sitzung kann nur einmal erfolgreich sein. Reine Vorschau/Entwurf reserviert keinen dauerhaften Anspruch. Uploadfehler vor Veröffentlichung dürfen keinen endgültigen Anspruch erzeugen.

Korrektur derselben Leistung referenziert den ursprünglichen Anspruch; sie erzeugt keinen zweiten Primäranspruch und gibt alte Ansprüche nicht durch DELETE frei. Neue, später erbrachte Sitzungen können eigene Ansprüche erhalten. Die genaue zulässige Teilabrechnung und Zuordnung bei Storno muss `gkv-302` bestätigen, bevor dieser Schutz scharf geschaltet wird. Für Bestandsabrechnungen kein automatischer Claim-Backfill aus Mengen oder Datum; fehlender eindeutiger Sitzungsbezug sperrt neue Teilabrechnung statt ihn zu erfinden.

## 5. ZAA: atomarer Schutz vor Wiederholungsimport

`abrechnung_uebermittlung` als vorhandenes, festgeschriebenes Importprotokoll wiederverwenden. Für erfolgreich angewandte eingehende Rückmeldungen braucht es eindeutige Kombination `(owner_id, abrechnung_id, richtung, sha256)` im Empfangsfall; neue Empfangseinträge verlangen vollständigen Hash und passenden Abrechnungsbezug. Bestehende NULL-Hashes nicht nachträglich erfinden.

Die Server-RPC erhält den SHA-256 der originalen Uploadbytes und ausschließlich Transportmetadaten. Innerhalb derselben Transaktion:

1. Owner und Rechnungsheader in vorhandener Reihenfolge sperren; Mandant und Bezug prüfen.
2. Identischen bereits erfolgreich angewandten Empfang erkennen und als Duplikat ohne Mutation quittieren, auch wenn die Header-Version inzwischen weitergelaufen ist.
3. Für neuen Empfang Versionsprüfung durchführen; danach Importprotokoll und fachliche Fehlerwirkung gemeinsam schreiben.
4. Fehler oder Versionskonflikt rollen beides zurück; identische parallele Importe haben nur einmal Wirkung.

Transporttabelle enthält keine Originaldatei, Fehlertexte mit Patientendaten oder Diagnosen. Fachliche Fehler bleiben in vorhandenem `zaa_fehler`. Ein Datei-Hash beweist weder Authentizität noch Annahme; unbekannte/mehrdeutige Profile bleiben vor der RPC gesperrt. Ob semantisch gleiche Rückmeldungen mit anderen Bytes ebenfalls dedupliziert werden müssen, entscheidet konkretes DAS-Profil; kein selbst erfundener Fingerprint aus freiem Text.

## Migration, Kompatibilität und Freigabe

1. `gkv-302` prüft fachliche Kardinalität, Teilabrechnung und Nachweisfelder; `legal-de` prüft neue Dokumentations-/Aufbewahrungsfolgen; `fonksiyon-ustasi` bestätigt den einen Schreibweg. Noch keine Freigabe durch dieses Dokument.
2. Additive Felder/Relationen und Constraints in separater lokaler Migration entwerfen. Bestehende Nutzdaten bleiben unverändert; neue Entlassungswerte NULL. Kein Live-Apply und kein Backfill ohne gesonderte Freigabe.
3. Neue Funktionen mit expliziten Grants, Ownerprüfung, RLS nach vorhandenen Projektmustern und gleicher Prüfung für service-role-Schreibwege erstellen. Neue Tabellen in REGISTER und DSGVO-Klassifikation aufnehmen; Auskunft und Lösch-/Anonymisierungsreihenfolge prüfen. `api/dsgvo.js` ist kein pauschaler Ersatz für aktuelle Backend-Klassifikation.
4. Backend erkennt fehlende Schemaversion und liefert für betroffene neuen Verfahren eine kontrollierte Sperre. Standardaltbestand wird niemals durch NULL→false umgedeutet. Erst nach bestätigtem Schema und vollständig erfassten Angaben neue Fachprofile freigeben.
5. Nach tatsächlicher Schemaänderung Struktur-/RLS-Export, REGISTER und generierte Nutzungskarte aktualisieren; lokale Entwurfsdatei allein verändert diese Quellen nicht.

## Notwendige Tests

- Altverordnung mit NULL-Entlassungsmerkmal bleibt ungeprüft; true ohne Datum, false mit Datum sowie Blanko+Entlassmanagement werden abgewiesen.
- Mehrere T/K/F-Intervalle korrekt zugeordnet; falscher Owner/Standort/Nachweis und unzureichende Intervallabdeckung werden gesperrt.
- Geburtstag, Jahreswechsel, Beginn/Ende einer Befreiung und widersprüchliche Nachweise; Centwerte für Prozentanteil und Blattgebühr unabhängig nachrechnen.
- VKZ10 ohne ursprüngliche Zeile/Anhang, fremde Ursprungszeile, falscher Hash, erneuter Rezidivfall, abgelaufene Verordnung und mehrfach beanspruchte Sitzung.
- Zwei parallele Erstabrechnungen derselben Sitzung; Rollback bei Upload-/Publikationsfehler; zulässige Korrektur mit ursprünglichem Claim.
- ZAA doppelt sequenziell und parallel; Duplikat nach Bearbeitung einzelner Fehler darf diese nicht wieder öffnen; neuer Import mit veralteter Version schreibt weder Empfangsprotokoll noch Fehlerbestand.
- Bereits erzeugte Artefakte und ihre Ursprungsbezüge bleiben bei jeder neuen Vorschau bytegleich.

## Rücknahme

Neue Fachprofile per Backend-Freigabeschalter sperren, bestehende Artefakte und Nachweise erhalten. Additive Spalten und Tabellen nicht durch automatisches Down-SQL löschen. Eine ältere Codeversion ist nur zulässig, wenn sie neue Fachprofile/Verarbeitungskennzeichen sicher abweist; sonst bleibt der neue Backend-Schutz aktiv. Keine Rücksetzung von NULL auf false, keine automatische Neuabrechnung, keine Aufhebung bestehender Festschreibung.

Publikationsschutz: `.vercelignore` enthält bereits `db/`; der neue Unterordner bleibt dadurch vom Webdeployment ausgeschlossen.

## Datenberatung 10.11.2026: nächstes begrenztes Zuzahlungspaket

Dieser Nachtrag beschreibt geprüfte lokale Lücken gegen Exportstand 0119; keine
Migration und kein Live-Katalogzugriff. Frühere Schemaangaben oben sind historisch.

- `zuzahlung_befreiung` weiterverwenden. Bestehendes UNIQUE `(patient_id, jahr)`
  verhindert getrennte Intervalle. Vor dessen Ersatz Datumsreihenfolge,
  Jahresbindung, überlappende/widersprüchliche Nachweise und gemeinsame Ownerbindung
  von Patient/Intervall absichern. RLS allein ersetzt diese Relation nicht.
- Umstellung umfasst Browser-Upsert mit `onConflict: 'patient_id,jahr'` und
  Nachweisdateipfad `befreiung_<jahr>.<ext>` in `module/zuzahlung-befreiung.js`.
  Ohne neuen identitätsgebundenen Schreib-/Dateivertrag würden Altclients Fehler
  erzeugen oder Nachweise überschreiben. Bestehende Belege erhalten; kein automatisches
  Zusammenziehen, Überschreiben oder Erfinden von Altintervallen.
- Vorhandene DB-Helfer `fn_befreiung_backfill_prescriptions` und
  `fn_is_patient_befreit` gemeinsam prüfen: Rezeptboolean folgt bisher
  Ausstellungsdatum; Nachweisjahr und Owner werden nicht durchgängig mitgeführt.
  Boolean ist daher keine ausreichende leistungsdatumsbezogene Berechnungsquelle.
- Tatsächlichen ursprünglichen Beginn aus allen belegten Sitzungen der Verordnung
  bestimmen, nicht aus aktueller Abrechnungsauswahl. `behandlungsbeginn` und
  importierte Vorgeschichte benötigen eindeutige Provenienz. Unbekannt bleibt
  gesperrt statt durch erste verfügbare Sitzung ersetzt zu werden.
- Bestehende Kassen-/Altsystemfelder dokumentieren Gesamtzuzahlung. Separate
  Blattgebühr daraus nicht ableiten. Vorhandenen Snapshot um explizite Entscheidung,
  ursprünglichen Beginn, angewandte Nachweis-IDs und Originalbezug erweitern;
  alte Komponenten bleiben unbekannt, kein Rückrechnen aus Gesamtbetrag.
- Vor gemeinsamer Anbindung Doppelbuchungsgrenze zwischen ZU-Rechnung und
  Kassierweg gezielt prüfen (`db/REGISTER.md`, Abschnitt invoices/ZU).

Nächster Übergang: konkreten kompatiblen Migrations-/API-/UI-Vertrag getrennt
fachlich, datenschutzrechtlich und auf Altclients prüfen; dann paketweise bauen.
Keine zweite Befreiungs-/Rechnungstabelle als Standardlösung. Lokale Umsetzung
bleibt autorisiert; Live-Anwendung und externe Abnahme bleiben gesondert.
