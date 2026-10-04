# M1 — Übergabe an Claude Code, 2026-10-05

## Kopierbarer Arbeitsauftrag

Du übernimmst Hat M in `/Users/melihdonmez/infinitymade-website`. Setze den bereits freigegebenen M1-Abschlussplan um. Lies `AGENTS.md`, `CLAUDE.md`, `/Users/melihdonmez/.codex/RTK.md` und `KUTU_HAZIRLIK_SPRINT.md` vollständig, besonders §0/§1/§2/§6; danach Tagesjournale 2026-10-04 und 2026-10-05 sowie diese Übergabe. Plane verbleibende Arbeit kurz, dann arbeite innerhalb bestehender Freigaben weiter.

### Feststehende Grenzen

- Serverausfall durch volle VPS-Platte hat Kemal behoben. Keine weitere Infrastrukturreparatur ohne neuen Befund. GitHub war zuletzt auf `f8dbabe`; aktueller Stand muss neu geprüft werden.
- DAS-Kanal ist ausdrücklich unbestimmt. M1.16(b), automatische Löschung verschlüsselter Dateien nach authentischer DAS-Annahme, bleibt offen und deaktiviert. Keine uneingeschränkte M1-Gesamtfreigabe oder M2-Startfreigabe behaupten.
- Neue synthetische QA-Praxis verwenden. Historische E-Testdateien unberührt lassen. Keine echten Abrechnungssendungen oder Zahlungen. M1.10 gehört M4.
- Owner-/Mandantenprüfung, bestehende Aufbewahrungsentscheidung und Header-CAS erhalten. Neue Registry schützt Dateien, ersetzt keine Rechnungszustandsmaschine.

### Exakter Arbeitsstand

`git pull --rebase --autostash` durchgeführt; anschließend erneut synchronisiert, kein neuer Remote-Commit. HEAD `f8dbabe`. Diese Fortsetzung hat noch keinen eigenen Commit oder Push erzeugt. Nachfolgende Änderungen sind lokale, nicht abgenommene Entwürfe:

1. `api-backend/billing/zaa/parser.js` und `parser.test.js`: additive Validität/Fehlergrund; unbekannte, leere, malformed Rückmeldungen ablehnen. Erster kalter Gemini-Review hat Trunkierung, gemischte ungültige Zeilen und unsicheren Plaintext-Fallback bemängelt. Korrekturrunde angewandt, abschließender kalter Review fehlt. Route noch unverändert!
2. `api-backend/dsgvo/klassifikation.js`, `loeschen.js`, `api-backend/routes/dsgvo.test.js`; neue `api-backend/dsgvo/artefakt-schutz.test.js`: früher Owner-Freeze, Registry-Schutzabfrage, konservativer Erhalt unbekannter Abrechnungsdateien, Exportklassifikation und ehrlicher Teil-Löschstatus. Entwurf hängt von noch nicht vorhandener Tabelle/RPC ab. Nicht allein deployen.
3. Entscheidung dokumentiert in `konsey/tutanak/2026-10-05-m1-artefakt-archiv.md` und `konsey/KARARLAR.md`. Fortschritt in `fortschritte/2026-10-05.md`.
4. Migration `0060` noch NICHT im Repository und NICHT auf SaaS angewandt. Temporärer Gemini-Entwurf `/tmp/praxura-m1-registry-sql/0060.sql` (42.155 Bytes). Author-Result `/tmp/praxura-m1-registry-sql/author-result.json` meldet **ERROR**. Deshalb ausdrücklich kein akzeptierter SQL-Entwurf: auf Vollständigkeit prüfen, verkleinern, korrigieren, unabhängig prüfen und lokal ausführen, bevor irgendetwas live angewandt wird. Prompt und Log im selben Verzeichnis.

### Aktuelle Prüfergebnisse

Gezielter Root-Test mit erforderlichen lokalen Prozessrechten:

`node --test api-backend/billing/zaa/parser.test.js api-backend/dsgvo/artefakt-schutz.test.js api-backend/routes/dsgvo.test.js`

Ergebnis 25/26 Node-Testfälle bestanden; Parser-Testdatei scheitert an Assertion `EDIFACT structural envelope with no errors rejects unknown without fallback to plain`. Testfall: EDIFACT-Hülle ohne Fehler, danach Plaintext-ähnliche Zeile. Prüfe fachlich, ob `unknown` oder `invalid` korrekt ist; entscheidend sind Ablehnung und keinerlei Mutation. Test nicht zur bloßen Grünfärbung abschwächen. Log `/tmp/m1-handoff-targeted-tests.log`. Parser verwendet eigene Assertion-Zählung; 25/26 ist keine Zahl sämtlicher Parser-Assertions.

Vollständiges `npm test` nach Änderungen noch nicht durchgeführt. Klassifikations-/Schema-Drift-Test kann bis echtem Schemaexport scheitern.

`npm run probe` nicht grün: zunächst Connection-Resets des lokalen Servers, nach größerer Warteschlange Modulimporte erfolgreich; anschließend `leistungen-probe.mjs` rot. Probe erwartet automatische, bereits übernommene 78040-Zeile. Aktuelles `termin-leistungen.js` bietet dagegen bewusst unangehakten Vorschlag. Mit Podologie-/Funktionsagent prüfen und Probe um tatsächlichen Bestätigungsklick ergänzen; Dauer-/Rückweg-Prüfungen erhalten. Keine Produktänderung zur Anpassung an veraltete Testannahme. Lokaler Server auf Port 8081 wurde für Übergabe beendet.

Lokaler isolierter Container `praxura-m1-1-db` wurde gestartet; public-Schema leer, `auth.users` vorhanden, Storage-Schema fehlt. `docker exec ... psql -U supabase_admin -d postgres` funktioniert. Keine gemeinsame `supabase-db` verändern. Für SQL-Tests gezielte synthetische Fixture oder vollständige isolierte Box initialisieren.

### Verbleibende Umsetzung, in Reihenfolge

1. **Lokale Entwürfe stabilisieren:** Parser-Fehler und unabhängigen kalten Review abschließen; DSGVO-Diff selbst lesen und unabhängig prüfen. Bestehende Funktion `pruefeSignedDta`, `ladeDtaOriginalbytes`, `aktualisiereArtefaktVersion` und Versuchspfadhelper verwenden.
2. **Registry-Migration fertigstellen:** kleine Tabelle `abrechnung_artefakt_version`, eindeutiger unveränderlicher Pfad/Owner/Abrechnung/Hash/Quelle; kind unsigned/signed/encrypted, separate Rollen dta/auftrag/begleit/signed/encrypted. Lifecycle reserved/published/retire_pending/retired, eigener Uploadstatus pending/uploaded/upload_failed. Laufende Reservierung niemals per Timeout löschen. Owner-RLS nur Lesen, Client-DML und RPC-Ausführung sperren; vorhandene Storage-Client-Schreibsperren erhalten. Owner-Lock vor Header-Lock vor sortierten Registry-Zeilen. Owner muss `is_active IS TRUE` sein, sonst Reserve/Publish ablehnen.
3. **RPCs und Backend-Vertrag:** `artefakt_reserve`, `artefakt_upload_done`, `artefakt_publish`, `artefakt_retire_claim`, `artefakt_retire_done`, `artefakt_owner_freeze`. Freeze liefert strikt true; darf Abschluss eines schon reservierten Uploads nicht verhindern. Reserve vor Storageupload, Upload upsert:false, Registry+Header atomar unter vollständigem NULL-aware CAS publizieren; PostgreSQL-Mikrosekunden erhalten. Ausschließlich kontrollierte Patchfelder. Kein Löschen nach verlorenem Versionsvergleich. Dauerhafte Claim-Tokens/Fehler für Wiederholung, keine Wiederveröffentlichung eines beanspruchten Pfads.
4. **Signed-Readback und unsigned-DTA:** hochgeladene Signatur herunterladen, CMS und beide Hashes kryptografisch prüfen. Erst dann exakte alte DTA atomar aus aktuellen Referenzen lösen und über Claim entfernen. Auftrag/Begleitzettel erhalten. Originaldownload und erneutes Signieren verwenden bestehenden geprüften eingebetteten CMS-Fallback. Signed-Historie erhalten; acht Jahre erst nach dokumentierter Einreichung entsprechend bestehender Rechtsentscheidung. Ohne Einreichung begründete Owner-Wiedervorlage nach sieben Tagen, kein automatischer Purge.
5. **DSGVO gemeinsam liefern:** Freeze vor jeder Löschmutation, Schutzabfrage fail-closed, Registry in Auskunft/Löschschutz, unbekannte historische Bucketobjekte konservativ erhalten. Hat-K-Bereich begrenzt abstimmen. Nie neue Tabelle isoliert vom Schutz oder Schutz isoliert von fehlender RPC deployen.
6. **ZAA-Route wirklich korrigieren:** `abrechnung.routes.js` `/abrechnung/:id/upload-zaa` liest aktuell nur id/owner und löscht alten Fehlerbestand vor Validierung. Guard direkt nach Parser und vor jeder Mutation. Beide Annahme-Zweige entfernen: Header `accepted` und Zeilen `akzeptiert` aus leerer Fehlerliste. Gültige Fehlerlisten weiterhin verarbeiten. Fehlerbestand/Header/Verordnungs-/Zeilenstatus atomar versionsgebunden publizieren; dafür separate nächste Migration (voraussichtlich 0061) mit Owner-Lock/full-CAS empfohlen. Kein authentisches DAS-ACK erfinden; keine Datei löschen.
7. **Oberflächen:** vorhandene M1.2-Reparatur/Storno unfakturierter Zeilen tatsächlich im Browser prüfen und echte Lücken schließen. Historische Signaturversionen mit Aufbewahrungs-/Prüfstatus verfügbar machen. Zwei additive geschützte Express-Endpunkte für Versionsliste und versionsgebundenen Download. Deutsche Texte, Themevariablen, Cacheversionen; Dashboard nicht vergrößern. Upload-/Versandverträge erhalten.
8. **Abnahme:** Registry-Ausfall vor Upload, Konkurrenz, veraltete Ansicht, Fremd-Owner, DSGVO während Upload, Löschfehler, Hashfehler, unbekannte ZAA prüfen. Vollständiges `npm test` und `npm run probe` mit Server8081 grün. `canli-test` neue synthetische Praxis: Storno, Zertifikate, 78040-Nachweis, Rechnung, Honeypot, Berlin-Datum, Demo-Link, Downloadnamen, erneutes Signieren. Browser-, Netzwerk- und Persistenzbelege; Push nicht als Deploymentnachweis zählen.
9. **Abschluss:** Migrationen zuerst lokal prüfen, dann autorisiert SaaS anwenden und tatsächlichen Stand exportieren; Schema/RLS/REGISTER, Box-Zähler/Version und Funktionskarten gemeinsam aktualisieren. Vor jedem eigenen Commit pull/rebase, nur eigene Pfade `git commit -- <Dateien>`, anschließend push. Tagesjournal, Wissensbank und Sprintstatus mit tatsächlichen Belegen aktualisieren. DAS-Abhängigkeit getrennt offen ausweisen.

### Arbeitsweise / Agenten / Gemini

Vor Funktionen fonksiyon-ustasi, vor SQL db-ustasi, vor §302 gkv-302, vor Podologiefluss podoloji konsultieren; Abschlussabsicht an Fachagenten zurückmelden. Sicherheits-/Packaging-Review ergänzen. Heavy Code gemäß Builder-Protokoll per Gemini; unabhängiger kalter Gemini-Worker, danach eigener Diff-Review. Keine realen Daten/Schlüssel in Prompts. Öffentlicher Repository-Status wurde bestätigt. `agy-context` benötigt hier explizit `--model gemini-3.8-flash-low`: Default high kollidierte mit internem effort low. Providerzahlen separat, keine behaupteten gemessenen Nettoeinsparungen. Autor-Result SUCCESS allein beweist keine korrekte Umsetzung.

Temporäre ZAA-/DSGVO-Autoren-/Reviewdateien liegen unter `/tmp/m1-zaa-*` und `/tmp/m1-dsgvo-*`; verwendbar als Zusatz, Repositorydiff maßgeblich. Aktive Gemini-Prozesse wurden bei Übergabe nicht gefunden; Built-in-Agenten sind unterbrochen. Nicht blind alte Worker fortsetzen.

### Fremde Änderungen unbedingt erhalten

Bereits vor dieser Fortsetzung vorhanden: `dashboard.js.bak` gelöscht; `db/NUTZUNG.json`, `db/NUTZUNG.md`, `funktionen/README.md`, `wissensbank/README.md` geändert; untracked `AGENTS.md`, `Claude outputs/`, `KHS_M2_PLAN.md`, `legal-de.md`, `wissensbank/conflict/`. Nicht resetten, breit stagen, löschen oder in eigenen Commit übernehmen. Generierte Karten erst nach gezieltem Vergleich/Koordination aktualisieren. Kemal kann gleichzeitig Hat K bearbeiten.
