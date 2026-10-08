# M4 — Technischer Vertrag: Provider-, Konfigurations- und Jeton-Transport

**Stand:** 08.10.2026 (Überarbeitet nach Root-Review)
**Status:** Lokale Implementierung und unabhängige Prüfung für M4.1 / M4.11 abgeschlossen; Gesamtsuite 3117/3117 bestanden. Freitextqualität FAIL, externe Aktivierung gesperrt. Einzelbelege: `wissensbank/sitzungen/2026-10-08_m4-qa-bericht.md`.
**Geltungsbereich:** Ausschließlich On-Premise Box & Backend-Transport (`ki-config.js`, `ki-jeton.js`, `azureClient.js`).

---

## 1. Übersicht & Sicherheitsarchitektur

Die KI-Transportschicht setzt die Sicherheitsvorgaben aus KUTU_HAZIRLIK_SPRINT §M4, K-20 und LEGAL_DECISIONS Nachtrag 4 strikt um:

1. **`ki-config.js` (`createAiConfig`)**: Rein funktionale, zustandsfreie Konfigurationsauflösung je Aufruf. Keine Initialisierungsfehler beim Modulimport, kein Netzwerkzugriff, strikte Host- und EU-Region-Validierung, CRLF-Sperre für Keys und Endpoints.
2. **`ki-jeton.js` (`createJetonClient`)**: RAM-only Jeton-Transport über signierten `merkezFetch` (`praxura-v1`). Keine persistente Speicherung, strikte TTL-Prüfung (≤ 3600 s), Singleflight-Erneuerung mit isolierter Caller-Stornierung, dynamische Modus- und Allowlist-Prüfung bei jedem Token-Zugriff, Quotenabschaltung (`AI_QUOTA_EXCEEDED`).
3. **`azureClient.js` (`chat`)**: Gehärteter Provider-Transport. Erzwingt `store: false` auf jedem Request, verbietet Redirects (`redirect: 'error'`), sanitisiert Nachrichten-Objekte (nur bekannte Rollen, keine Zusatzfelder), blockiert multimodale Inhalte (OCR/Bilder), validiert Provider-Antworten und Nutzungsmetriken, maskiert Fehler (keine URLs/Secrets/Prompts) und implementiert isolierte 401-Re-Auth sowie 429-Warteschlangen-Backpressure.

Gateway übergibt `beforeSend`: Owner- und dynamische Betreiberfreigabe unmittelbar
vor jedem tatsächlichen Provider-Fetch erneut prüfen, auch nach Token-/Retry-Wartezeit.
Callback nur mit exaktem `true` erfolgreich; sein sicherer Ablehnungsfehler wird erhalten.
Lokale Regression mit Widerruf während Tokenabruf bestätigt null Provider-Sends.
Leere verifizierte Hostliste blockiert echte Aktivierung. A-Strukturprüfung und B-/C-Sperren
sind getrennt vom Freitext-FAIL (Cold36/156); keine Provider-/Box-/Rechtsfreigabe.

---

## 2. Öffentliche Schnittstellen & Verträge

### 2.1 Konfiguration (`ki-config.js`)

```javascript
createAiConfig(env = process.env, { allowedHosts = VERIFIED_AZURE_HOSTS } = {})
```

- **Standardmodus:** `aus` (Default).
- **Modus-Hierarchie:**
  - Explizites `AI_MODE=aus` gewinnt immer vor vorhandenen Legacy-`AZURE_*`-Variablen.
  - Fehlt `AI_MODE`, wird eine vollständige Legacy-Konfiguration (`AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY`) als `direkt` interpretiert.
  - Explizit gesetzte `AI_*`-Werte überschreiben Legacy-Werte, selbst wenn sie als leerer String übergeben werden.
  - `AZURE_DRY_RUN` aktiviert **niemals** automatisch Mocks oder gefälschte Erfolge.
- **Fail-Closed:** Ungültige Modi oder nicht unterstützte Provider (`provider !== 'azure'`) schlagen sicher fehl (`valid: false`, definierte Fehlercodes).
- **Host-Allowlist:** `VERIFIED_AZURE_HOSTS = Object.freeze([])`. Es werden keine fiktiven Produktionsendpunkte im Quellcode eingebrannt. Jede Produktionsadresse muss über die Konfiguration explizit verifiziert und freigegeben werden.
- **EU Data Boundary:** Erlaubt sind ausschließlich Regionen aus `EU_DATA_BOUNDARY_REGIONS` (`germanywestcentral`, `westeurope`, `northeurope`, `francecentral`, `swedencentral`, etc.). Diese Prüfung ist eine ergänzende technische Konfigurationsschranke und stellt keine selbstständige DSGVO-Rechtsgarantie dar.
- **Steuerzeichen-Schutz:** API-Keys und Endpoints werden strikt auf Zeilenumbrüche (`\r`, `\n`) und Steuerzeichen geprüft (`AI_API_KEY_INVALID`, `AI_ENDPOINT_CONTROL_CHARS_FORBIDDEN`).

### 2.2 Jeton-Client & Aggregat-Vertrag (`ki-jeton.js`)

```javascript
createJetonClient({
  config,
  configProvider,
  merkezFetchImpl = merkezFetch,
  merkezOptions,
  now = Date.now,
  aggregateSupplier,
  refreshSkewMs = 300_000,
  allowedHosts
})
```

- **Dynamische Bereitschaftsprüfung:** `getToken()` prüft vor jedem Cache- oder Netzwerkzugriff die aktuelle Konfiguration (`mode === 'jeton'`, `activationReady === true`, `valid === true`). Schlägt bei Konfigurationsänderung sofort fail-closed fehl (`AI_MODE_NOT_JETON`, `AI_NOT_ACTIVATED`).
- **Cache-Revalidierung:** Ein im RAM gehaltenes Token wird bei jedem Aufruf gegen die aktuelle `allowedHosts`-Liste geprüft. Wird ein Host aus der Konfiguration entfernt, verfällt das Token sofort.
- **Endpunkt & Anfrage-Payload:** Signierter Aufruf `POST /v1/ki/jeton` an Merkez. Enthält **niemals** Freitext, Prompts, Nachrichten, Patientendaten oder Einzelzeitstempel.
  ```json
  {
    "antragsteller": "praxura-box",
    "report": { ... } // optionaler gestagter Aggregat-Snapshot
  }
  ```
- **Antwort-Payload:** `{ token, exp, endpoint, deployment, region, apiVersion, acknowledgedReportId?: string }`.
  - `exp`: Ganzzahlige UNIX-Sekunden.
  - **TTL-Prüfung:** Streng `exp - now <= 3600 s`. Überschreitungen führen zur Zurückweisung mit sicherem Code `AI_TOKEN_TTL_EXCEEDED` (keine stille Trunkierung). Bereits abgelaufene Token werden verworfen (`AI_TOKEN_EXPIRED`).
  - **Endpunkt-Prüfung:** HTTPS-Zwang, Standardport 443, keine Userinfo, kein Query/Hash, Pfad ausschließlich `/` oder leer, Host muss in `allowedHosts` enthalten sein.
  - **Deployment-Prüfung:** Sicheres Token-Segment (`/^[a-zA-Z0-9_-]{1,64}$/`).
  - **Region-Prüfung:** Strikt in `EU_DATA_BOUNDARY_REGIONS`.
  - **Fehler-Sanitisierung:** Fehlermeldungen bei ungültiger Antwort verwenden konstante deutsche Strings (`'KI-Jeton-Antwort ungültig'`) und sichere Codes. Es werden keine unvertrauenswürdigen Regionen, TTLs, Tokens oder Rohmeldungen reflektiert.
- **Singleflight & Abbruch-Isolierung:**
  - Mehrere parallele Aufrufer teilen sich dieselbe Netzwerkanfrage an Merkez.
  - Der interne Merkez-Aufruf und der vorgeschaltete Aggregat-Abruf (Supplier) sind durch eine feste 15-Sekunden-Frist (`AbortSignal.timeout(15000)`) begrenzt (konfigurierbar für Tests).
  - Bricht Aufrufer A seine Anfrage via `signal` ab, wird Aufrufer A sofort mit `AbortError` beendet. Die laufende Singleflight-Anfrage läuft für Aufrufer B ungestört weiter. Ein abgebrochener Aufrufer konsumiert nach dem Abbruch kein Token.
- **Verhalten bei Zentrumsausfall:** Ein bereits bezogenes, ungelaufenes Token wird bei Ausfall von Merkez bis zu seinem tatsächlichen Ablauf weitergenutzt. Nach Ablauf schlägt der Dienst sicher fehl (`AI_JETON_UNAVAILABLE`).
- **Quotenfehler:** Antworten mit Status 402/429 oder Fehlercode `AI_QUOTA_EXCEEDED` invalidieren das Token sofort und deaktivieren den Jeton-Client prozessweit mit Code `AI_QUOTA_EXCEEDED`.
- **Aggregat-Nutzungsmeldung (Piggybacked Snapshot):**
  - **Automatisches Staging:** Vor einem Token-Refresh wird automatisch der `aggregateSupplier` aufgerufen (begrenzt durch Timeout). Hängt oder wirft der Supplier, wird dies im sicheren `aggregateDiagnostic`-Feld erfasst; der Refresh läuft dennoch weiter.
  - Staging ist auch manuell über `reportUsage(report)` möglich. Es wird **kein** separater Netzwerkendpunkt aufgerufen; der Snapshot wird beim nächsten `POST /v1/ki/jeton` mitgesendet.
  - Schema des Snapshots:
    ```json
    {
      "reportId": "rep-fixed-id-12345",
      "windowStart": "2026-10-08T00:00:00.000Z",
      "windowEnd": "2026-10-09T00:00:00.000Z",
      "taskTotals": {
        "rezept-ocr": { "calls": 10, "prompt_tokens": 1000, "completion_tokens": 200, "total_tokens": 1200 },
        "b2c-draft": { "calls": 4, "prompt_tokens": 200, "completion_tokens": 100, "total_tokens": 300 }
      }
    }
    ```
  - **Validierungsregeln:**
    - `reportId`: Exakter, begrenzter String (`/^[a-zA-Z0-9_-]{1,64}$/`).
    - `windowStart` / `windowEnd`: Feste UTC-ISO-Tagesgrenzen (`YYYY-MM-DDT00:00:00.000Z`), die exakt einen 24-Stunden-Zeitraum kanonisch abdecken.
    - `taskTotals`: Ausschließlich bekannte Task-Namen (`b2c-draft`, `rezept-validate`, `rezept-ocr`, `appointment-confirm-draft`, `series-scheduler`, `b2b-draft`, `rezept-normalize`). Keine beliebigen Schlüssel oder Patientennamen!
    - Metriken: Sichere, endliche, nicht-negative Ganzzahlen (`Number.isSafeInteger`).
  - **Quittierung:** Der ausstehende Bericht wird erst gelöscht, wenn die Antwort von Merkez exakt `acknowledgedReportId === pendingReport.reportId` zurückgibt. Ein bloßer HTTP 200 quittiert den Bericht nicht. Es wird kein Refresh beim Supplier während anhängigen Berichten vorgenommen.
  - **Begrenzung:** Genau ein ausstehender Bericht im RAM. Ein Überschreiben mit einer abweichenden Payload unter derselben `reportId` wird abgewiesen.
  - **Abrechnungshinweis:** Mangels finalem Hat-K-Abrechnungsvertrag dient die Meldung rein informativen Diagnosezwecken und stellt keine Abrechnungsgrundlage dar.

### 2.3 Provider-Transport (`azureClient.js`)

```javascript
chat({
  messages,
  responseFormat,
  temperature = 0.4,
  maxTokens = 1200,
  deployment,
  mock = false,
  mockFn,
  config,
  configProvider,
  fetchImpl = globalThis.fetch,
  jetonClient,
  beforeSend,
  signal,
  timeoutMs = 45000
})
```

- **Mocks:** Ausschließlich explizit via `{ mock: true, mockFn }`. Fehlt `mockFn`, wird ein Fehler geworfen (`AI_MOCK_FN_REQUIRED`). Niemals implizite Mocks durch Dev-Umgebungen oder fehlende Keys.
- **Gating vor Netzwerk:**
  - `cfg.mode === 'aus'` wirft sofort sicheren deutschen 503-Fehler (`AI_MODE_AUS`).
  - `!cfg.activationReady` wirft sofort sicheren deutschen 503-Fehler (`AI_NOT_ACTIVATED`).
  - `!cfg.valid` wirft sicheren 503-Fehler (`AI_CONFIG_INVALID`).
- **Sanitisierte Nachrichten-Payload:**
  - Jedes Nachrichten-Objekt darf **ausschließlich** die Felder `role` und `content` (sowie optional `name`) enthalten. Unerwartete Zusatzfelder führen zur Abweisung (`AI_MESSAGES_INVALID`).
  - Erlaubte Rollen: Nur `system`, `user`, `assistant`.
  - `content` muss zwingend ein String sein. Multimodale Inhaltsblöcke (Bilder, Base64, Arrays) werden am Transport mit Status 400 (`AI_MULTIMODAL_BLOCKED`) abgewiesen. OCR über diesen Kanal bleibt gesperrt.
- **Payload-Parameter:**
  - `responseFormat`: Ausschließlich `{ type: 'json_object' }` oder `{ type: 'text' }`. Beliebige verschachtelte Schemas werden abgewiesen (`AI_PAYLOAD_INVALID`).
  - `temperature`: Endliche Zahl zwischen `0` und `2`.
  - `maxTokens`: Endliche Ganzzahl zwischen `1` und `16384`.
- **Auth-Header:**
  - Modus `direkt`: `api-key: <apiKey>` (kein Bearer).
  - Modus `jeton`: `Authorization: Bearer <token>` (kein api-key).
  - Beide Header weisen Steuerzeichen (`\r`, `\n`) strikt ab (`AI_AUTH_INVALID`).
- **401-Behandlung & Concurrency-Schutz:**
  - Tritt ein 401 auf, wird `jetonClient.invalidate(rejectedToken)` aufgerufen.
  - Wurde das Token bereits durch einen parallelen Aufrufer erneuert (`currentToken.token !== rejectedToken`), wird das frische Token sofort wiederverwendet, ohne einen zweiten Merkez-Abruf auszulösen.
  - Pro Aufrufer erfolgt genau ein Retry; schlägt auch dieser fehl, bricht die Anfrage mit sicherem deutschen 503 (`AI_UNAVAILABLE`) ab.
- **429-Behandlung & Target-Revalidierung:**
  - Bounded RAM Queue: Maximal 8 parallel wartende Anfragen (`AI_QUEUE_FULL`).
  - Maximal 2 Retries mit exponentiellem Backoff bzw. Begrenzung auf `Retry-After` (500 ms bis 10.000 ms).
  - **Revalidierung:** Nach dem Warten wird das Ziel vor dem Retry neu aufgelöst (`resolveTarget()`), da das Token während der Wartezeit abgelaufen sein könnte.
- **Zeitbudget & Signal-Renner:**
  - Standard-Timeout: 45 Sekunden (`DEFAULT_TIMEOUT_MS = 45000`) inklusive Auslesen des Antwort-Bodys.
  - Explizite Test-Düse: `timeoutMs` erlaubt kurze Timeouts in Tests ohne künstliche 45s-Pausen.
  - Alle asynchronen Phasen (Fetch, Text/JSON-Lesen, Warten) rennen gegen das Signal (`raceSignal`). Signal-Listener werden im `finally`-Block sauber entfernt.
  - Eventuelle vertrauliche Werte in `signal.reason` werden **niemals** in Fehlermeldungen reflektiert (`AI_ABORTED`).
- **Antwort-Validierung:**
  - Fehlen `choices` oder ist der Inhalt kein String, bricht der Aufruf mit `AI_RESPONSE_MALFORMED` ab.
  - Nutzungsdaten (`prompt_tokens`, `completion_tokens`, `total_tokens`) müssen endliche, nicht-negative Ganzzahlen sein.
  - Vom Anbieter gemeldete Modell-Metadaten werden nur aus der geschlossenen Liste `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini` übernommen. Sonst verwendet der Transport das validierte Deployment; der Auditpfad speichert bei unbekanntem Modell `null`.
- **`configSummary()`:**
  - Wird rein dynamisch evaluiert.
  - Whitelistet Deployment, ApiVersion, Region und Mode auf sichere Zeichensätze; fehlerhafte oder injizierte Werte fallen auf `'(invalid)'` bzw. `'(unset)'` zurück.

---

## 3. Zwei-Prozess-Architektur & Quoten-Auswirkung

Auf der aktuellen On-Premise Box startet `start.mjs` zwei `node:cluster`-Worker mit `NODE_APP_INSTANCE=0/1`. Der SaaS-VPS kann während O-179 Phase2 noch den separaten PM2-Compose-Override nutzen. Die folgenden RAM-/Quotenregeln gelten pro Worker in beiden Varianten.
- **Isolierter RAM:** Jeder PM2-Worker besitzt eine eigene V8-Instanz und damit einen eigenen, getrennten RAM-Speicher.
- **Keine Prozess-Synchronisation:** Die Singleflight-Erneuerung, der Token-Cache (`currentToken`) und gestagte Berichte arbeiten isoliert pro Prozess. Es existiert absichtlich kein prozessübergreifendes Locking und kein IPC-Token-Sharing.
- **Quoten-Auswirkung für Hat K:** Bei einem Token-Refresh-Intervall von bspw. 30 Minuten können pro Box rechnerisch bis zu 4 Token pro Stunde (2 Worker × 2 Refreshes) angefordert werden. Der Quoten- und Ausstellervertrag von Hat K muss diese Multi-Worker-Architektur berücksichtigen und darf nicht von einem globalen Distributed Singleflight ausgehen.
- **Mögliche doppelte Aggregatmeldungen:** Da beide Worker dieselbe Box repräsentieren, kann ein gestagter Tagesbericht von beiden Prozessen mitgeteilt werden. Merkez muss Idempotenz anhand der `reportId` sicherstellen.

---

## 4. Rechtliche Betriebsbereitschaft vs. Inhaber-Opt-In

Es gilt die strikte funktionale Trennung zwischen zwei unabhängigen Schutzebenen:

1. **Technische & Betreiber-Bereitschaft (`AI_ACTIVATION_READY=1`, `AI_MAIL_READY=1`):**
   - Wird ausschließlich durch den System-Operator auf Infrastruktur- bzw. Container-Ebene (`.env`) gesetzt.
   - Benutzer-Payloads können diese Schranke unter keinen Umständen übersteuern.
   - Wenn `AI_ACTIVATION_READY !== 1`, blockieren Konfiguration, Jeton und Transport sofort mit 503 (`AI_NOT_ACTIVATED`).
2. **Inhaber-Opt-In (Praxisinhaber / Tenant):**
   - Die technische Freigabeentscheidung des Praxisinhabers stellt eine separate Ebene dar; sie ersetzt keine rechtliche Grundlage oder externe Freigabe.
   - Ein gesetztes `AI_ACTIVATION_READY=1` ersetzt das Inhaber-Opt-In **nicht**.
   - Solange kein gültiges persistiertes, versioniertes und boxgebundenes Inhaber-Opt-In vorliegt, darf die KI in der Anwendung für den jeweiligen Mandanten nicht freigeschaltet werden. Lokales atomisches JSON und Zugriffsschutz sind umgesetzt; eine revisionssichere Historie ist damit nicht nachgewiesen.

---

## 5. Externe Aktivierungsblocker

Die lokalen Tests ersetzen weder die unabhängige Abnahme noch den Nachweis des echten Zentrums oder der Box. Die **externe Aktivierung** bleibt durch folgende Vorbedingungen blockiert:

1. **Hat-K-Vertrag:** Schriftliche Bestätigung des Ausstellerverhaltens, des Quotenvertrags (Mehrprozessfähigkeit) und der Piggyback-Aggregatquittierung auf `/v1/ki/jeton`.
2. **Azure-Ressourcennachweis:** Bereitstellung einer verifizierten Azure-Ressource in Deutschland/EU mit minimaler Service-Principal-Rolle und gesondertem Nachweis der tatsächlichen Provider-Aufbewahrung. `store: false` wird gesendet und beweist allein keine Zero Data Retention.
3. **Microsoft Product Terms & Bridge Letter:** Vorliegen der C5-Zertifizierung und der DSGVO-Überprüfungsdokumente gemäß Nachtrag 4 (`LEGAL_DECISIONS.md`).
4. **Rechtliche Freigabe für E-Mail & OCR:** OCR und E-Mail-Assistent bleiben gesperrt, bis die anwaltliche Freigabe für B2C/B2B-Drafts und die Patienteninformation vorliegen.
