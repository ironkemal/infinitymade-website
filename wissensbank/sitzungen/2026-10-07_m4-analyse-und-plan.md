# M4 — Analyse und zweistufige Planung

Begonnen: 07.10.2026 · Überarbeitet: 08.10.2026 · Status: Plan 2 zur Umsetzung vorbereitet; offene Vertragsentscheidungen ausdrücklich benannt. Keine Implementierung oder Aktivierung.
Grundlage: aktueller lokaler Checkout, KUTU_HAZIRLIK_SPRINT §M4, K-20 und LEGAL_DECISIONS Nachtrag 4.

## Plan 1 — erster strukturierter Entwurf

1. **Verträge und Ausgangslage sichern.** M4.1–M4.11 auf Dateien, Datenklassen und Abnahmekriterien abbilden. Shared-Checkout erhalten. K-20 gilt: kein Relay, Jeton nur freigegebene Strukturfelder, Standard aus; Mail-Aktivierung und OCR bleiben gesperrt. TTL-Konflikt (60–90 Minuten gegenüber höchstens einer Stunde) mit Hat K/legal-de klären. Echte Azure-Konfiguration wird nicht angefasst.
2. **M4.2 zuerst: NER-Messung.** Bestehenden Harness prüfen, synthetische Korpora verwenden, Modell/Version und Abhängigkeiten festhalten. Messung ≤2 % Restleck auf Korpus2 und höchstens ein Fehlalarm unter sieben Negativfällen; zusätzlich Blockquote, Roundtrip, RAM, Ladezeit und Laufzeit erfassen. Modell nur bei bestandenem Gate und vertretbaren Boxressourcen einbauen, sonst ohne NER weiter.
3. **Gateway und Maskierung (M4.1/.3/.8).** Bestehende azureClient-, pii-mask-, Audit- und Sentry-Funktionen erweitern. Gateway vor Promptbau mit taskbezogenen Feldschemata; AI_MODE aus/direkt/jeton; AZURE-Kompatibilität nur bei nicht explizit ausgeschaltetem Modus. Ein Maskierungskontext je Aufruf mit Nonce, strenger Rückauflösung und Antwortprüfung. Rohprompts, Maps und Anbieterfehler aus Logs entfernen.
4. **Alle Aufrufpfade migrieren (M4.4/.5/.6/.7).** Task- und server.js-Wege erfassen; deterministischen rezept-validate vom Modelltransport unterscheiden. B2B über vorhandenen AI-Router, n8n- und tote Backendwege ersetzen/entfernen. Drafts erst JSON-parsen und validieren, dann Werte zurückersetzen; Leistungen/Termine lokal einsetzen. Rückfrage darf keine A-Maskierung oder Jeton-B-Sperre umgehen. Mailfunktion lokal testbar, extern noch deaktiviert.
5. **Jeton-Integration (M4.11).** Bestehendes merkezFetch wiederverwenden. Mit Hat K Vertrag für Pfad, Token, exp, Endpoint, Deployment, Aggregatverbrauch und Fehler festhalten. Lokaler Fake-Endpunkt: RAM-only Token, exakte Host-Allowlist, store:false, Redirectverbot, Single-flight-Erneuerung, einmalige 401-Erneuerung, begrenzte 429-Warteschlange, sichere Ausfälle. Audit-Metadaten einschließlich Serienplanung vervollständigen; kein zweiter Verbrauchszähler.
6. **Nachweise und Abschluss (M4.9/.10).** Tests zu Datenfluss, Mandantentrennung, Injection, unbekannten Platzhaltern, C-Sperre, Env-Matrix und Ausfällen. Kalten dritten Korpus durch unabhängigen agy-Worker ohne Code-/Korpuskenntnis erzeugen lassen. Isolierte lokale Integration und UI-Probes; danach Gesamtchecks, Funktionenkarte und Register. Dokumentation beschreibt nur gemessene Umsetzung; Dokumententwürfe und externe Aktivierung getrennt.

## Noch vor Plan 2 zu bewerten

- Deckt Plan alle elf Sprintpunkte ab? Welche Reihenfolge vermeidet Umbau und ungesicherte Zwischenzustände?
- Ist Freitext-Freigabe im direkt-Modus ausreichend klar, ohne K-20 zu verwässern?
- Sind NER-Harness und Rückfrage gegen falsche Sicherheitsnachweise abgesichert?
- Fehlen tenantgebundene Namenswörterbuch-Abfragen, Opt-in-Quelle oder Hat-K-Verträge?
- Welche Tests beweisen aus-Modus, Speicherfreiheit, Antwortintegrität und Boxbetrieb ohne Zentrum?
- Welche externen Auflagen verhindern lediglich Aktivierung und welche blockieren bereits Implementierung?

Die folgende Bewertung bezieht sich auf diesen konkreten Entwurf; Plan 2 verarbeitet die Rückmeldungen.


## Vollständige Bestandsanalyse — M4.1 bis M4.11

| Punkt | Lokaler Bestand / Lücke | Geplanter Nachweis |
|---|---|---|
| M4.1 Provider/Env | azureClient liest AZURE_* beim Import, nutzt api-key und wirft bei fehlender Produktionskonfiguration; Compose bietet AI_* bereits an. Gateway fehlt in den geprüften KI-Pfaden. | Env-/Modusmatrix, deutsche 503, Backend startet ohne KI, bestehende SaaS-Konfiguration bleibt kompatibel ohne gesperrte KI zu aktivieren. |
| M4.2 NER | Synthetische Korpora und noch nicht gelaufener Harness vorhanden. Negativmessung betrachtet nur zusätzliche NER-Änderung; Scannerzustand stammt von vor NER. | Korrigierter Gesamtpipeline-Benchmark, Entscheidung mit Ressourcen-/Offline-Nachweis. |
| M4.3 Maskierung | maskPII/maskMessages vorhanden; doppelte allocate-Kerne, vorhersagbare Tokens, kein strenges Restore. | Gemeinsamer Kern, Nonce, Wörterbuch-Tenantgrenze, Injection-/Roundtrip-/Outputtests. |
| M4.4 Taskmigration | Fünf Modelltasks importieren chat direkt; Router und server.js sind unterschiedliche Eintrittswege. rezept-validate ist deterministisch. | Alle Modelltasks über Gateway; kein direkter Providerimport/-fetch außerhalb Treiber; Ergebnisformen und Serienfallback erhalten. |
| M4.5 B2B | n8n-URL sowie tote /ai-summarize-/b2b-mail-agent-Aufrufe im Dashboard vorhanden; Box blendet Mail-Assistent bislang aus. | Ein vorhandener authentifizierter Router, kein neuer Serverless-Endpunkt; UI bleibt bis Aktivierung gesperrt. |
| M4.6 lokale Werte | Drafts restaurieren vor JSON.parse; Leistung/Termin noch nicht durchgängig lokal templatisiert. | Erst Parse/Schema/Scanner, danach bekannte Textwerte restaurieren; Quotes, Zeilenumbrüche, Sonderzeichen getestet. |
| M4.7 Rückfrage | Geplanter UI-Vertrag fehlt; bestehende Modalbausteine wiederverwenden. | Gebundene, kurzlebige Einmalentscheidung; geänderte Eingabe ungültig; keine Jeton-Freitextfreigabe. |
| M4.8 Logs | Unge­salzener Klartexthash, rohe Fehler in Audit/HTTP/Konsole; Sentry regex-scrubbt statt Body zu entfernen. | Sentinel-Daten tauchen in keinem Log-/Sentry-/Auditkanal auf, auch bei Fehlern. |
| M4.9 Tests | pii-mask-Tests und Spike-Messung vorhanden; keine vollständigen Gateway-/Modus-/Cold-Abnahmen. | Stufenweise Unit/Contract/Integration/UI-Gates und unabhängiger finaler Cold-Korpus. |
| M4.10 Dokumente | Rechtliche Aktivierungsauflagen dokumentiert; Patienteninformation setzt kiAktiv:false fest. | Gemessene TOM-/Registerangaben, Opt-in-Informationsfluss; keine vorgezogenen AVV/VVT-Änderungen entgegen Nachtrag 4. |
| M4.11 Jeton | Signierte merkezFetch-/Kimlik-Bausteine vorhanden; gefundener Merkez-Server ist Namensdienst, KI-Jetonvertrag noch nicht belegt. Serienplanung liefert kein _meta/Auditverbrauch. | Lokaler Fakezentrum-Vertrag, Speicher-/Host-/Ablauf-/Fehler-/Aggregattests; echte Zentrums- und Azure-Abnahme separat. |

### Datenvertrag — DB-Spezialistenprüfung

Read-only anhand Schema, Register und vorhandener Migrationen; kein Zugriff auf Produktionsdaten.

| Zweck | Vorhandene Quelle | Grenze |
|---|---|---|
| Patientennamen | `leads.owner_id`, `first_name`, `last_name`, `title` | Nur benötigte Namensspalten; expliziter owner_id-Filter, keine vollständigen Akten. |
| Mitarbeiter/Owner | `profiles.id`, `role`, `owner_id`, `owner_first_name`, `owner_last_name` | Keine employees-Tabelle. Owner per id, Mitarbeiter per owner_id; business_name nur ausdrücklich dokumentierter Fallback. |
| Arzt-/Praxisnamen | `aerzte.owner_id`, `arzt_name`, gegebenenfalls `praxis_name` | Ownerweit, kein erfundener business_id-Filter. |
| Verbrauch | `ai_audit_log.tenant_id`, `task`, Tokenfelder, `created_at`, `dry_run`, `status` | Bestehende Quelle nutzen; eigene autorisierte Filter trotz service-role. Dry-runs aus Verbrauchsmeldungen ausschließen. |
| KI-Opt-in | Keine passende persistierte Spalte im geprüften Schema/Migrationsstand gefunden | AI_MODE ist Betriebsmodus, keine belegte ownerbezogene Opt-in-Einstellung. Kein erfundenes Feld verwenden. |

Quellen: `db/SCHEMA.sql:508,546,2129,2926`, `api/admin/data.js:55`; Schema-Snapshot ist keine aktuelle Live-Introspektion. Vor tatsächlicher Implementierung betroffene Migrationsstände erneut gezielt abgleichen.

Opt-in-Optionen: **A)** lokale Boxkonfiguration mit ausschließlich ownerberechtigtem Aktivierungsschritt und versioniertem Nachweis; **B)** additive ownerverwaltete profiles-Einstellung für gemeinsame Box-/SaaS-Logik. B erfordert Entscheidung für Layer 1, Migration, RLS, Register und Schemaexport. A erfordert ebenfalls belastbaren Aktivierungsnachweis; ein handgesetztes Env allein genügt dem geplanten Praxis-Opt-in nicht. Im Plan keine Variante stillschweigend beschlossen. Bis zur Entscheidung bleibt reale Aktivierung aus; beide Varianten verhindern weder Benchmark noch Gatewaytests mit injizierter Testfreigabe.

### Maßgebliche lokale Quellen

- `KUTU_HAZIRLIK_SPRINT.md:266–303`: elf M4-Punkte, K-17/K-20, Klassen A/B/C.
- `konsey/tutanak/2026-10-05-ki-tek-hesap-jeton.md:11–40`: gesetzte Entscheidung, Aktivierungsreihenfolge, offene Azure-Fragen.
- `compliance/LEGAL_DECISIONS.md:510–609`: Nachtrag 4, strengere Datenklasse und sieben Aktivierungsauflagen. Hier werden bestehende Projektauflagen wiedergegeben; keine erneute Rechtsprüfung.
- `api-backend/ai/azureClient.js:11–142`: Konfiguration, Importassertion, Transport, Rohfehler.
- `api-backend/ai/pii-mask.js:44–177`: wiederzuverwendender Maskierungskern.
- `api-backend/ai/router.js:18–72`, `api-backend/server.js:2081,2371,2421`: verschiedene Task-Eintrittswege.
- `api-backend/ai/tasks/b2c-draft.js:87`, `appointment-confirm-draft.js:96`, `series-scheduler.js:136`: Restore vor Parse und fehlende Metadaten.
- `api-backend/ai/audit.js:13–53`, `api-backend/ai/auth.js:61`, `api-backend/instrument.js:72–89`: Logrisiken.
- `spike/ki-maske/README.md:1–40`, `ner-test.mjs:23–33`: synthetische Benchmarkbasis, Messlücken.
- `api-backend/merkez-istemci/merkez-fetch.js:22`, `api-backend/Dockerfile`, `onprem/.env.template:216–228`: Wiederverwendung und Betriebsgrenzen.
- `module/patienten-einwilligung.js:169`: KI-Information bisher aus.

## Bewertung von Plan 1

Unabhängige Rollen: fonksiyon-ustasi (Wiederverwendung/Verträge), datenschutz-technik (Privacy/Logschutz), qa-tests (Messung/Teststrategie); ergänzend bestehende DB- und Betriebsagenten. Keine Agenten-Codeänderungen beauftragt.

**Urteil: bedingt ausführbar.** Alle elf Sprintpunkte enthalten; Reihenfolge im Entwurf sinnvoll, Datenverträge und messbare Gates noch zu unbestimmt.

| Schwäche im ersten Plan | Korrektur in Plan 2 |
|---|---|
| NER-Gate kann Blockierung statt Erkennung belohnen | Rohleck, effektives Leck, Leck unter gesendeten Items und Blockquote getrennt; ungültige/leere Ergebnisse gelten nicht als Erfolg. |
| Gateway nur als Modulname beschrieben | Explizite Pipeline und injizierbare Transport-/Uhr-/Dictionary-Schnittstellen. |
| Rückfrage ohne Sicherheitsbindung | Benutzer/Mandant/Task/Payloadversion/Ablaufzeit und Einmalverwendung; erneute serverseitige Prüfung. |
| Restore-/Scannerreihenfolge offen | JSON parsen, Schema prüfen, pseudonymisierten Output prüfen, dann ausschließlich Werte restaurieren. |
| Jetonmeldung vor vollständigem Audit | Audit für Serienplanung zuerst vervollständigen, Aggregatfenster/Quittierung/Deduplizierung klären; Meldung bleibt informativ. |
| Cold-Korpus erst am Schluss erwähnt | Unabhängigen Testauftrag vor Codearbeit versiegeln; finale Generierung/Auswertung ohne Code- oder Altkorpuskenntnis. |
| Sicherheitschecks erst im Abschluss | Import-/Log-/Modusgates vor jeder Taskmigration. |
| Aktivierungsgrenzen und Dokumentenarbeit vermischt | Implementierungsnachweis, Boxabnahme und externe Aktivierung getrennte Status. |

Nicht übernommen: pauschal zehn identische Testwiederholungen. Stattdessen einmalige aussagekräftige Tests sowie gezielte Parallelitäts-/Retrytests; Wiederholung nur bei Instabilität oder Änderung.

## Plan 2 — überarbeiteter Ausführungsplan

### P0 — Ausgangslage und Verträge (Vorbereitung; erster technischer Lauf bleibt M4.2)

- Shared-Checkout unverändert erhalten; vor Umsetzung aktuelle Hat-K-Änderungen gezielt abgleichen. Kein automatisches pull/rebase im schmutzigen main-Checkout.
- Task-/Feldmatrix festhalten: erlaubte Typen, feste Enums, lokale Werte und B-Ausnahmen. Unbekannte/nested Zusatzfelder, Bilder/Base64 und freien Text in vermeintlichen A-Feldern ablehnen. Struktur allein macht einen beliebigen String nicht sicher.
- Modusmatrix: **aus** = keine Providerinitialisierung, keine NER-Modellladung, kein Tokenbezug, kein Wörterbuchzugriff; deterministische Kernfunktionen bleiben verfügbar. **direkt** = explizit konfigurierte freigegebene Tasks, B nur mit belegter Feldregel. **jeton** = ausschließlich A-Allowlist; OCR und Mailaktivierung gesperrt, NER/Rückfrage ändern diese Grenze nicht.
- Box-Default aus; ungültiger Modus fail-closed. AZURE-Fallback erhält lediglich technisch kompatible alte Konfiguration, darf ein ausdrückliches aus oder bestehende Aktivierungssperren niemals umgehen. Testmocks explizit injizieren statt fehlende Konfiguration als KI-Erfolg auszugeben.
- Offene Verträge dokumentieren: TTL ≤1 h als strengere Planvorgabe, noch kein Nachweis tatsächlicher Entra-TTL; niemals nur lokal verkürzen und behaupten, externer Token sei ungültig. Hat K muss Ausstellerverhalten und Akzeptanzgrenzen bestätigen. „Relay modunda“ als Dokumentwiderspruch markieren, kein Relay implementieren.
- Exakte geprüfte Ressourcenhosts, Deployment und Region; Tokenantwort/exp/Fehler/Aggregatfenster; Opt-in-Quelle und Berechtigung klären. Mangels Vertrag bleibt jeweilige echte Aktivierung blockiert, lokale Fakes ausdrücklich gekennzeichnet.
- Kalten Testauftrag mit PII-Klassen, Negativen, Unicode, langen Texten und Taskformen vor Codearbeit festlegen. Generator sieht keinen Implementierungscode und keine alten Korpora.

**Gate P0:** schriftliche Matrix und offene Vertragsliste, kein erfundener Cloud-/Datenbanknachweis.

### P1 — M4.2: belastbare NER-Entscheidung

1. Benchmark-Oracle korrigieren und mit unabhängigen Positiv-/Negativfällen prüfen: kurze/teilweise Namen, normalisierte oder fragmentierte Identifikatoren, harmlose Substringtreffer, Unicode sowie leere/ungültige Ausgabe. Komplette Pipeline auf Negativfällen bewerten, nach NER neu scannen, Fehlformat/Trunkierung/Loadfehler als Fehler ausweisen. Oracle-Selbsttests müssen vor Modellbewertung bestehen.
2. Versionierten Modellkandidaten und Lockfile in isoliertem Messsetup verwenden; nur synthetische Texte. Download nur im Build-/Messschritt, keine Laufzeitdownloads.
3. Korpus2-Gate ungerundet: ≤2 % auf 139 historischen Truth-Items entspricht höchstens zwei Restlecks. Negativgate höchstens ein unbegründet veränderter oder blockierter Fall unter sieben. Zusätzlich gesendete Item-Leckrate, Block-/Rückfragequote und funktionale Nutzbarkeit berichten; Ergebnis gilt nur für diesen Korpus.
4. RAM/Peak-RSS, Kaltstart, p95-Latenz, Parallelität, CPU und Offline-Verhalten im vorgesehenen Alpine-/PM2-Setup messen; Lizenz von Modell und Runtime, feste Modellrevision und vollständiges Datei-/Hashmanifest prüfen. Download im Image verhindern. Vorhandene Grenzen: zwei Worker, jeweils 256 MB Heap/500 MB RSS-Neustartgrenze, 1200 MB Containerlimit; Zielbox 4 GB ohne Swap laut Betriebsregister. Beide Modellinstanzen gemeinsam prüfen. Ressourcenbudget mit Hat K/onprem festlegen; Grenzen nicht zur Rettung eines ungeeigneten Modells still erhöhen.
5. NER nur übernehmen, wenn Qualitäts- UND Betriebsgate bestehen. Sonst sichere Variante ohne NER: nicht freigegebene B-Felder blockieren; Rückfrage nur innerhalb bereits zulässiger direkt-Taskregeln.

**Gate P1:** reproduzierbarer Messbericht samt NER-ja/nein-Entscheidung. Netzwerk-/Modellfehler sind kein Negativergebnis der Modellqualität und kein PASS.

### P2 — Gateway, Maskenkern und Logschutz (M4.1/.3/.8)

Pipeline: authentifizierter Taskkontext → geschlossene Rohpayloadprüfung → Modus/Taskfreigabe → tenantgebundenes Wörterbuch → ein Maskierungskontext → Promptbau nur aus freigegebenem Payload → Transport → JSON-/Antwortschema → pseudonymisierte Antwortprüfung → lokale Wert-Restaurierung → Mapping freigeben.

- Bestehende maskPII/maskMessages/azureClient erweitern, keine zweite Implementierung. Eingabetokens neutralisieren; kryptographische Nonce, bekannte Tokens strikt auflösen; fremde Tokens/Output-PII blockieren. Maps nur aufrufbezogen im RAM, keine prozessweiten Tenant-Caches ohne festgelegte Grenzen.
- Provideradapter ausschließlich vom Gateway erreichbar. Health zeigt sichere Zustände; Konfigurationsfehler stoppen KI statt Backendstart.
- Audit/Konsole/HTTP nur definierte Fehlercodes und freigegebene Metadaten. Requestfingerprint über freigegebene Form oder geschützte HMAC-Strategie; keine ungesalzenen Klartextfingerprints. Salt-/Schlüsselrotation mit bestehendem Betrieb abstimmen.
- Sentry Body/messages und inhaltsführende Breadcrumbs/Extras/Causes entfernen; Sanitizerfehler verwirft Event. Keine Prompts, Tokens oder Maps in Diagnosepaketen.
- Fake-Transport/Uhr/Tokenbezug/Dictionary-Loader als Testnähte festlegen. Tatsächliches Freigabe- und Berechtigungsverhalten bleibt serverseitig.

**Gate P2:** Env-/Import-/Datenfluss-/Log-/Injectiontests grün; aus-Modus nachweislich ohne ausgehende KI-Aufrufe.

### P3 — Tasks, B2B, lokale Werte und Rückfrage (M4.4/.5/.6/.7)

- Reihenfolge: Serienplanung, Heilmittel-Normalisierung, danach lokal gesperrte Drafts. Deterministische rezept-validate-Prüfung bleibt modellfrei; OCR nur klassifizieren und Sperre erhalten.
- Bestehende Router- und server.js-Aufrufwege migrieren; Ergebnisformen und deterministische Fallbacks erhalten. Klinische Frequenz nicht neu empfehlen; nur verordnete Vorgaben umsetzen.
- b2b-draft am bestehenden authentifizierten AI-Router; n8n-Webhooks und tote Aufrufe ersetzen/entfernen. Neue Frontendlogik nach module/, dashboard.js wächst nicht. Kein automatischer Mailversand.
- JSON erst parsen/validieren/scannen, anschließend ausschließlich Textwerte lokal restaurieren; Termin/Leistung lokal templatisieren. Schlüssel und strukturelle IDs werden nicht aus Modellantwort frei übernommen.
- Rückfrage als maschinenlesbarer blockierter Zustand; Bestätigung gebunden an autorisierten Benutzer/Mandant/Task, Payloadversion, Ablaufzeit, einmalig. Keine Map persistieren; Kontext beim Wiederholen frisch bilden. Mehrere Fundstellen gegebenenfalls in einer Ansicht bündeln; keine pauschale „alles freigeben“-Entscheidung.
- UI: Deutsch, vorhandene Modalbausteine, Tastatur/mobile Bedienung. Podologie prüft Klickaufwand vor Umsetzung des neuen Flows; Ziel eine zusätzliche Entscheidung, Sicherheit nicht durch Klicklimit aufheben.

**Gate P3:** alle Task-/HTTP-/UI-Wege geprüft, keine direkte Providerumgehung, kein A/B/C-Regelwechsel durch Browserentscheidung; Mail extern weiter gesperrt.

### P4 — Jetonadapter und Verbrauch (M4.11)

- merkezFetch/signiereAnfrage/ladeKimlik wiederverwenden; kein neues Schlüssel-/Signatursystem. Merkez-Server, SP-Ausgabe, Quote und Budgetabschaltung bleiben Hat K, Boxadapter Hat M.
- Zuerst _meta/Audit der Serienplanung vervollständigen. ai_audit_log bleibt bestehende Quelle; nur Task-/Tokenaggregate, keine Einzelaufrufzeitpunkte/Inhalte zum Zentrum. Berichtsfenster/Cursor/Quittierung und Ausfälle spezifizieren, keine neue Verbrauchstabelle ohne DB-Prüfung. Audit best-effort bedeutet mögliche Lücken; Aggregate niemals als verlässliche Abrechnung verwenden. Ausgeschlossene Dry-runs und verlorene Quittierungen testen; feste Meldungs-ID und begrenzte Wiederholung verhindern doppelte Verarbeitung.
- Token ausschließlich Prozess-RAM; exp-Plausibilität, vereinbarte TTL, Single-flight-Erneuerung vor Ablauf. Zwei PM2-Prozesse und mögliche Mehrfachausgabe in Hat-K-Quotenvertrag berücksichtigen.
- HTTPS + exakter eingebrannter Host + erlaubter Port/Pfad/Deployment; Userinfo, Redirect und fremde Hosts ablehnen. Regionassertion ergänzend erhalten. Nur chat/completions mit store:false, keine stateful Features.
- 401: höchstens einmal neuer Token; danach sichere deutsche 503. 429: begrenzte speicherinterne Queue, Retry-/Timeout-/Abbruchgrenzen; kein persistierter Prompt. Zentrumsausfall: vorhandenen gültigen Token nur entsprechend bestätigtem Vertrag nutzen, nach Ablauf KI aus; Praxisfunktionen bleiben verfügbar. Kein Fallback auf Praxura-Geheimnis oder Relay.

**Gate P4:** Fakezentrum-Integration, Restart/Parallelität/401/429/Offline/Quota/Host-/Speichernegativtests. Echte Azure-/Zentrumsabnahme bleibt getrennt offen.

### P5 — kalte Abnahme, Dokumente, Übergabe (M4.9/.10)

- Unabhängigen agy-Worker den versiegelten dritten Korpus erstellen lassen; Annotation separat plausibilisieren, Hash festhalten. Einmalige finale Auswertung ohne Nachjustieren. Nach Fehlerkorrekturen ist dieser Satz Regression; neue Cold-Abnahme braucht neuen Satz.
- Cold-Kriterien vor Codearbeit im Testauftrag festschreiben: Jeton-A-/C-Grenzen, Mandantentrennung und Metadatenlogs erlauben **null** unerlaubte Übertragungen; jeder Verstoß lässt das Gate scheitern. Für den optionalen B-/NER-Zweig Restleck höchstens 2 % ungerundet und Negativfehlerrate höchstens 1/7, zusätzlich nicht schlechter als die nach P1 festgehaltene strengere Basis. Rohleck, gesendete Item-Leckrate und Blockquote bleiben separate Ergebnisse. Vorab annotierte zulässige Positivfälle müssen nutzbare schemafähige Ausgaben erhalten; erwartete Sperrfälle müssen ohne Providerrequest blockieren. Vollständiges Blockieren aller Fälle erfüllt damit die Funktionsabnahme nicht. Kleiner Korpus bleibt keine allgemeine Sicherheitsgarantie.
- Zielgerichtete Regressionen, Gesamt-npm-test/typecheck/Probes, Import-/Onprem-/Größen-/Registergates, Funktionenkarte; nur notwendige DB-Schemaänderungen mit Migration/REGISTER/Export, keine vorgezogene Live-Migration.
- Isolierte lokale Dashboard- und Backendtests ausschließlich mit synthetischen Daten. Vorhandener M3-Teststack ist lokales Hilfsmittel, kein offizieller Boxnachweis. Keine produktiven Writes/Provideraufrufe aus Planung ableiten.
- Gemessene TOM-/Register-/DSFA-Ergänzungen als prüfbare Entwürfe; VVT/AVV gemäß bestehendem Nachtrag 4 erst im vorgesehenen Freigabeschritt ändern. legal-de, Betrieb/Security, DB- und Funktionsregister nach tatsächlicher Umsetzung beteiligen. kiAktiv-Informationsbaustein nur mit echter Opt-in-Quelle verbinden.
- Endstatus getrennt: implementiert / lokal getestet / echte Box geprüft / externe Aktivierung freigegeben. M4 nicht uneingeschränkt abhaken, solange erforderliche Nachweise fehlen.

**Gate P5:** QA-Bericht, Messprotokoll, Cold-Ergebnis, Vertrags-/Blockerliste und konkreter Chrome-/Box-Testprompt. Commit/Push/Deploy bleiben eigener Auftrag.

## Aktivierungsblocker außerhalb lokaler Umsetzung

- Hat-K-Jetonendpoint und tatsächlich bestätigter Antwort-/TTL-/Quotenvertrag.
- Geprüfte Azure-Ressource/Deployment, minimale SP-Rolle, Logs und Token-Verhalten; Testfakes beweisen diese Eigenschaften nicht.
- Microsoft-Nachweise/Product Terms, C5-Scope/Bridge Letter und dokumentierte Anforderungen aus Nachtrag 4.
- Dokumente/Opt-in vor erster Praxisaktivierung; Anwaltsantwort vor Mailaktivierung und erstem bezahlten Einsatz laut Projektregister.
- Echte isolierte Boxabnahme einschließlich Ressourcen-/Offlineprüfung; M3-Hardwarepunkte bleiben separat offen.

## Aufwand und Grenzen

Sprint nennt 4–5 Tage; das ist eine historische Schätzung, kein zugesagter Termin. Nach P1 und geklärten Hat-K-Verträgen neu schätzen. Externe Antworten und echte Boxabnahme sind nicht zuverlässig terminierbar. NER darf lokalen Aufbau nicht unbegrenzt blockieren; belastbarer Messfehler wird dokumentiert, sichere Variante bleibt möglich.

## Letzter Gegencheck von Plan 2 — 08.10.2026

- **QA:** ab P0/P1 lokal ausführbar. Konkretisierung von Oracle-Selbsttests und Cold-PASS-Kriterien aufgenommen. Empfehlung zu zehn identischen Testwiederholungen bewusst nicht übernommen: gezielte Parallelitäts-/Retrytests und Wiederholung bei Instabilität/Änderung liefern den benötigten Nachweis. CI-Status später separat dokumentieren; ein lokaler PASS wird nicht als CI-PASS bezeichnet.
- **Datenschutztechnik:** gegen die geprüften K-20-/Privacy-Anforderungen kein gefährlicher Planfehler offen; echte Aktivierung weiterhin blockiert, solange externe Gates nicht erfüllt sind. Dies ist eine Planprüfung, keine Produkt- oder Rechtsfreigabe.
- **DB und Betrieb:** vorhandene Datenquellen und aktuelle Ressourcenlimits berücksichtigt; Opt-in und Hat-K-Ausstellervertrag bleiben ausdrückliche Entscheidungen vor betroffener Umsetzung/Aktivierung.
- **Erster Umsetzungsschritt:** P0-Vertrags-/Testmatrix festhalten, dann P1-Oracle reparieren und isolierte M4.2-Messung starten. In dieser Planung wurden weder Oracle noch Modell ausgeführt oder verändert.

## Kontextkosten

Gemini-Bridge erfolgreich, aber breit gewählte Exzerpte beantworteten nur merkez-istemci, nicht vollständiges M4. Deshalb konsequente gezielte Quellenprüfung und Spezialisten. Gemeldeter Providerverbrauch des Hauptagenten-Bridgeaufrufs: 32797 Tokens (31930 Input, 867 Output); keine gemessene Nettoersparnis des Hauptagenten. QA-Agent meldete zusätzlich einen gescheiterten Bridgeversuch mit 0 Provider-Tokens und anschließende lokale Evidenzsuche. Keine produktiven Daten oder Secrets in Kontextauftrag.
