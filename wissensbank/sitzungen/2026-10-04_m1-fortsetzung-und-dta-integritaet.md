---
titel: M1-Fortsetzung — Berliner Datum, öffentliche Buchung und DTA-Integrität
typ: sitzungsnotiz
angelegt: 2026-10-04
tags: [sitzung, m1, billing, cms, aufbewahrung, lokal-geprueft]
---

# M1-Fortsetzung und DTA-Integrität

**Stand:** Änderungen unten auf `main` committet und gepusht; lokal geprüft. **M1 insgesamt offen, keine M2-Freigabe.** Diese Notiz dokumentiert Entwicklungswissen, ersetzt keine amtliche Quelle oder Rechtsentscheidung. Tagesdetails: `fortschritte/2026-10-04.md`; Aufgaben und Eigentumsgrenzen: `KUTU_HAZIRLIK_SPRINT.md` §0/§2/§6.

## Gesicherte Änderungen

| Teil | Änderung und Zweck | Commit | Nachweis / Grenze |
|---|---|---|---|
| M1.11 | Paralleles Rechnungsspeichern sperren, damit zwei Klicks nicht zwei INSERTs erzeugen. Vorhandene `saveInvoice()` erhalten. | `4efd97e` | Acht VM-Tests mit tatsächlicher Funktion; ursprünglicher UI-Freeze weiterhin nicht live reproduziert. |
| M1.12 | Honeypot in öffentlichen Formularen; Praxis-, Therapeut- und Patientenreferenzen vor Writes prüfen. Neutrale Trap-Antwort ohne Termin-/Mailzusage. | `64dc485` | 18 Pure-/VM-Tests; keine neue CAPTCHA-Abhängigkeit oder Schemaänderung. |
| M1.13 | Fünf Berlin-Datumskopien bündeln; Tagesquery mit separat berechneter nächster Mitternacht, `gte(von).lt(bisExklusiv)`. | `4bb380d` | Vier Prozesszeitzonen, Sommer-/Winterzeit mit 23/25 Stunden, doppelte Herbst-Uhrzeit und Querygrenzen. Hostlokale 14/28-Tage-Fristrechnung unverändert. |
| M1.14 | Zygote erst über bewusst geöffneten externen Link; automatische iframe-/Timer-/Vollbildlogik entfernt. | `c5d1e19` | Isolierte Chromium-Probe: null iframes, ein korrekter Link, null Requests. Keine Live- oder Lizenzfreigabe behauptet. |
| M1.15 | Transportname ohne Suffix bestätigt; interner verschlüsselter Storagepfad darf davon abweichen. WB-Z12 nur im Dateinamen-Teil geklärt. | `3327559` | Tatsächlicher Downloadhandler plus installiertes Storage-SDK mit synthetischem Fetch geprüft. Live-HTTP-Content-Disposition nicht belegt. |
| M1.16-A | Originalbytes aus eingebettetem CMS SignedData kryptografisch und per Hash prüfen; für Originaldownload und VKZ03 verwenden. | `41639fc` | 25 neue Helpertests, tatsächlicher VKZ03-Routertest und Originaldownload-VM-Probe. Nur lesend, keine Löschung. |
| M1.16-B1 | Gleichen CMS-Prüfer vor Signatur-Upload einsetzen; DB-Originalhash bindet hochgeladenen Inhalt an Abrechnung. | `6073aa4` | Sieben tatsächliche Handler-VM-Tests; kein CAS, keine Versionierung oder Löschung. |

M1.10 ist laut Sprint nach M4.4 verschoben. Frühere M1.1–M1.9-Arbeiten sind im Sprint und Tagesjournal dokumentiert; diese Wissensfassung erklärt vor allem die anschließenden Änderungen.

## Wiederverwendbare Verträge

### Originaldownload und Signatur-Upload

- Gemeinsamer Prüfer: `api-backend/billing/dta/signed-original.js`, `pruefeSignedDta()` und `ladeDtaOriginalbytes()`.
- Caller: `api-backend/billing/api/abrechnung.routes.js` (`/dta-bytes`, `/upload-signed`) und `api-backend/billing/api/zuzahlungsforderung.routes.js` (Originalquelle für VKZ03).
- SignedData muss eingebetteten Inhalt und genau einen Signer enthalten. Signatur und Original-SHA-256 werden geprüft; Signed-Hash ist beim gespeicherten Fallback zusätzlich erforderlich. Signed-Content-Type muss zum eingebetteten Content-Type passen.
- Originaldownload fällt nur bei fehlendem Originalpfad oder eindeutigem Storage-404 auf `.p7m` zurück. 403, 500 und Netzwerkfehler erlauben keinen Fallback. Ownerpfad und Traversal werden geprüft.
- Neuer Upload verwendet den aktuellen `dta_sha256` aus dem tenantgeprüften DB-Header. Den Hash der **vorherigen** Signatur nicht gegen eine neue Signatur vergleichen: legitimes erneutes Signieren erzeugt andere Signed-Bytes.
- `checkChain:false` beweist mathematische Integrität, nicht CA-Vertrauen, Zertifikatsgültigkeit/Widerruf, Inhaberbindung oder vollständige SECON-Konformität. Keine solche Freigabe aus erfolgreichem Test ableiten.

### Lernen aus Review und Tests

- Gemini liefert begrenzte öffentliche Quellausschnitte bzw. synthetische Tests; Root prüft Diff und Tests, unabhängiges kaltes Gespräch prüft Endfassung. Fachagenten prüfen bestehende Funktionen, Datenverträge, Packaging und Sicherheitsgrenzen.
- Erste Upload-Testfassung hätte fehlenden Produktiv-Guard im Test automatisch ergänzt. Verworfen: Tests müssen tatsächlichen Handler unverändert ausführen und bei fehlendem Guard scheitern.
- Signaturmanipulation trifft tatsächliches SignerInfo-Signature-OctetString statt geratenen DER-Byteoffset. Sonst wäre unklar, ob Zertifikat, Inhalt oder Signatur beschädigt wurde.
- Provider-Zähler sind getrennt im Tagesjournal dokumentiert; Gesprächszählersemantik und Nettoersparnis nicht gemessen. Kein gesparter Tokenbetrag behauptet.

## Prüfstand

Letzte vollständige Suite für `6073aa4`: **2465 Tests erfolgreich**, 1586 Frontend / 781 Backend / 98 Tools. Log bei Erstellung: `/tmp/praxura-m116b-all-tests.log` (temporär, kein dauerhafter Beleg). Dauerhafte Tests liegen im Repository, darunter `api-backend/billing/dta/signed-original.test.js` und `api-backend/billing/api/signed-upload.test.js`.

Funktionskarte frisch: 2875 erfasste Einträge / 338 Dateien. Syntax und Diffprüfung erfolgreich. Kaltes Gemini-Review Upload-Guard: `40e0fb5d-355f-485d-9b5f-f17967882b30`, PASS im begrenzten Umfang. Kaltes Review Originalfallback: `3afb1658-b25e-4aaa-87d8-ba0a29094477`, PASS_STATIC. Reale Kundendaten und Schlüssel wurden nicht verwendet. Push ist kein Nachweis eines Live-Deployments.

## Offene Grenzen und nächster sicherer Schritt

1. **Historische Signaturen:** DSGVO-Referenzsammlung schützt aktuelle Pfade. Nach Versionswechsel wären frühere eindeutige Signed-Pfade unreferenziert und würden von Accountlöschung erfasst. Vor Versionierung dauerhaft geschützte Historie und Aufbewahrungsentscheidung mit Hat K abstimmen. `api-backend/dsgvo/klassifikation.js` und `loeschen.js` gehören dessen Bereich. Keine stille Änderung oder Veröffentlichung ungeschützter Versionen.
2. **Parallelzugriffe:** Signaturupload verwendet noch mutable Pfade und `upsert:true`; Headerupdates sind nicht vollständig versionsgebunden. Gemeinsamer CAS-/Transaktionsvertrag für Signieren, Verschlüsseln, Versand und Cleanup fehlt. Vorablesen allein verhindert keine Race Condition.
3. **Entwürfe:** Geprüfte Billingrouten enthalten keinen allgemeinen Regenerierungs-/Stornoendpoint. Create/Korrektur erzeugen neue Header; pauschal alte Originaldateien zu löschen könnte VKZ03 beschädigen. Vor Cleanup atomare Status-, Referenz- und Veröffentlichungsabsicherung nachweisen.
4. **DAS-Annahme:** `gesendet`, fehlerlos gelesene ZAA und M1.9-Papierempfang ersetzen keine authentische positive DAS-Quittung zur konkreten Transportversion. Deshalb keine verschlüsselte Datei gelöscht.
5. **Live-Abnahme:** Öffentliche Backend-GETs lieferten zuletzt HTML statt erwarteten API-JSON. Verifizierter SSH-/QA-Zugang fehlt. §6 und M1-Gesamtabschluss bleiben offen.

Aufbewahrungsentscheidung ist in `compliance/LEGAL_DECISIONS.md`, Abschnitt „2026-10-02“, §3 dokumentiert. Maßgebliche externe Unterlagen mit Original/Abschnitt/Fassung stehen in [[REGISTER]], [[INDEX]] und [[SPEC-RULES]]. Diese Sitzungsnotiz erweitert keinen Rechts- oder Abrechnungsvertrag.

## Freigegebene Fortsetzung: parallele Artefaktwechsel

Punkt 2 lokal umgesetzt: vollständige versionsgebundene CAS-Writes, eindeutige Uploadpfade ohne Überschreiben und Versandbindung an angezeigte Pfad-/Hashfelder. Schema laut DB-Agent ausreichend. 2488 lokale Tests erfolgreich; unabhängiges Gemini-Review PASS_STATIC. Kein Live- oder vollständiger Archivnachweis.

Bestehende historische E-Testdateien laut Nutzer außerhalb Arbeitsumfang. Punkt 3 autorisiert, eigener Teil noch offen: fehlgeschlagene unveröffentlichte unsigned Versuche sicher bereinigen. Punkt 4 DAS, Punkt 5 Infrastruktur (Nutzer/Kemal) und Punkt 6 spätere Live-QA bleiben offen. Signed-/Encrypted-Historie wird nicht gelöscht. Details: Tagesjournal M1.16-B2.
