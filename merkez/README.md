# Praxura Merkez

Zentraler Namensdienst für Kunden-Boxen (Sprint K2b.2 / K2b.17, Register `onprem/REGISTER.md` O-161).
Läuft **nur in der Zentrale** (eigene kleine VPS, nicht auf dem n8n-/calendar-api-Server).
**Nicht für Boxen:** dieser Ordner gehört nicht in das Box-Image (`api-backend/Dockerfile` kopiert
Verzeichnisse einzeln) und nicht ins Web (`.vercelignore`).

**Auf der VPS (07.10.2026):** Sparse-Checkout reicht mit `/merkez/` allein NICHT — `server.js`/`admin.js`
importieren zwei Dateien aus `api-backend/`. Muster (`git sparse-checkout set --no-cone`):
`/merkez/` · `/api-backend/routes/mitarbeiter-zugang-code.js` · `/api-backend/merkez-istemci/signatur.js` · `/api-backend/merkez-istemci/ki-bericht-schema.js` · `/api-backend/lib/berlin-tag.js` · `/api-backend/ai/ki-config.js` (KI-Jeton, 3b.4).
Kommt ein neuer `../api-backend/`-Import dazu, muss das Muster auf der VPS mitwachsen.

Was es tut: Einrichtungscode → zufälliger Name (`wort-wort-NN`) → DNS-Einträge bei Cloudflare
(`_acme-challenge`-CNAME, CAA, später A) + ein acme-dns-Konto. Die Box beweist ihre Identität mit
einem Ed25519-Schlüssel (`api-backend/merkez-istemci/`); Merkez speichert nur den öffentlichen Teil.
Dieselbe Identität gilt später für Postfach-Abruf (Y3) und KI-Jeton (3b.4).

## Umgebung

| Variable | Zweck |
|---|---|
| `BOX_DOMAIN` | Zone der Box-Namen (Pflicht, im Code kein Standardwert) |
| `CF_ZONE_ID`, `CF_API_TOKEN` | Cloudflare — Token nur DNS:Edit, eine Zone, IP-Filter = diese VPS (O-161 (6)) |
| `ACME_DNS_INTERN_URL` | lokales acme-dns (`/register`, nur von hier erreichbar) |
| `ACME_DNS_URL` | öffentliche acme-dns-Adresse (`/update`), wird der Box mitgegeben |
| `MERKEZ_DB` | SQLite-Datei (Standard `./merkez.sqlite`) |
| `MERKEZ_HOST` | erwarteter Host-Header — **Pflicht** (Start bricht sonst ab) |
| `MERKEZ_TRUST_PROXY` | ganze Zahl: Proxy-Stufen für die Quell-IP (`/v1/ip` Modus `internet`, Rate-Limits). Bei Bindung an Loopback **Pflicht** |
| `MERKEZ_DEV` | `1` = nur lokale Entwicklung: hebt die beiden Pflichten oben auf |
| `PORT`, `HOST` | Standard `8788`, `127.0.0.1` |
| `KI_ENTRA_TENANT_ID`, `KI_ENTRA_CLIENT_ID` | Entra-App für die KI-Jeton-Ausgabe (UUID). Optional: fehlt etwas oder ist ungültig, antwortet `/v1/ki/jeton` 503 `ki_aus` (eine Warnzeile beim Start, der Dienst läuft weiter). **`KI_ENTRA_CLIENT_ID` darf NICHT die Identität der SaaS-VPS sein** (O-169 (4)) |
| `KI_ENTRA_CLIENT_SECRET` | Secret dieser App — **nur** in der Merkez-Umgebung (O-169 (8), G2), nie in einer Box, nie im Log |
| `KI_ENDPOINT` | `https://<host>/` — nur Host, Port 443, kein Pfad/Query |
| `KI_DEPLOYMENT`, `KI_REGION` | Deployment-Name (`[a-zA-Z0-9_-]{1,64}`); Region aus der EU-Liste von `ai/ki-config.js` |
| `KI_API_VERSION` | Standard `2024-10-21` |
| `KI_MONATS_LIMIT` | Standard-Kontingent je Box und Berliner Kalendermonat (Standard `600`); je Box übersteuerbar per CLI |

Der Reverse-Proxy muss Pfad und Query **unverändert** durchreichen (sie sind Teil der Signatur)
und TLS terminieren. Node ≥ 22.13 (`node:sqlite`).

## Schnittstelle KI-Jeton (3b.4)

`POST /v1/ki/jeton` — signiert (wie `/v1/ip`), Body `{antragsteller:"praxura-box", report:null|{reportId,windowStart,windowEnd,taskTotals}}`.
Antwort 200: `{token, exp, endpoint, deployment, region, apiVersion, acknowledgedReportId?, rejectedReportId?}` (`exp − jetzt ≤ 3600`). `rejectedReportId` = Bericht dauerhaft abgelehnt (abweichender Inhalt unter bekannter ID oder ungültig) → Box verwirft ihn statt ihn ewig mitzusenden (O-169 γ; Client-Seite M4.11 offen).

| Status | Bedeutung |
|---|---|
| 402 `{code:"AI_QUOTA_EXCEEDED", resetAt}` | Monatskontingent der Box erschöpft; `resetAt` = UNIX-Sek. des Monatsanfangs Europe/Berlin. Box soll KI bis `resetAt` pausieren (⚠️ heutiger Client `api-backend/ai/ki-jeton.js` sperrt bis zum Neustart und wertet auch 429 als Kontingent — offen für M4.11, onprem O-169 α/β) |
| 503 `ki_aus` / `ki_nicht_freigeschaltet` / `dienst` | global aus oder Konfiguration unvollständig / Box nicht freigeschaltet / Entra-Fehler. **Nie 429** (der Client würde 429 als Kontingent-Ende lesen); auch das Rate-Limit antwortet 503 |
| 401 | Signatur, unbekannte oder gesperrte Box (kein Orakel) |

Zählung = Merkez-Wahrheit: ein ausgegebenes Jeton = ein Zähler-Eintrag (`ki_ausgabe`, Monat Europe/Berlin). Erhält dieselbe Box dasselbe noch gültige Jeton erneut (zwei Worker), wird nicht doppelt gezählt. Das Entra-Token wird im RAM wiederverwendet, solange die Restlaufzeit ≥ 45 min ist; es landet nie in DB oder Log. Berichte (nur Summen) werden idempotent je (Box, reportId) gespeichert und quittiert.
Neu-Bindung (`kod-rebind`) überträgt Zähler und Berichte auf die neue Box-ID (sonst wäre sie eine Kontingent-Umgehung).

KI-Verwaltung (CLI, alles im adminlog): `ki-an <name>` · `ki-aus <name>` · `ki-limit <name> <n|standard>` · `ki-global an|aus` · `ki-stand [name]`.
Bestehende Boxen sind nach dem Update `aus` (Opt-in, K-20); der globale Schalter ist standardmäßig `aus`.
⚠️ **`ki-global an` erst nach O-169 Bedingung 7 + ORG-Freigabe.** Nicht zum Ausprobieren auf der Produktiv-VPS.

## Lokal

```
cd merkez && npm install
npm test                      # Fakes für Cloudflare und acme-dns, kein Netz
node admin.js kod-neu         # Einrichtungscode erzeugen (erscheint einmal)
node admin.js liste
node admin.js kod-rebind <name>
node admin.js iptal <name>
node admin.js adresse-loeschen <name>   # nur nach iptal
node admin.js ki-stand [name]            # KI-Zähler/Berichte (ki-an/ki-aus/ki-limit/ki-global: siehe oben)
BOX_DOMAIN=… CF_ZONE_ID=… CF_API_TOKEN=… ACME_DNS_INTERN_URL=… ACME_DNS_URL=… node server.js
```

## Lokal testen

1. Dev-Server mit Fake-DNS und In-Memory-acme-dns starten:
```bash
MERKEZ_DEV=1 node test/dev-server.js
```
Der Server gibt beim Start einen gültigen Einrichtungscode aus.

2. `kayit.js` lokal gegen den Dev-Server ausführen:
```bash
MERKEZ_URL=http://127.0.0.1:8788 KIMLIK_DIR=/tmp/test-kimlik ACMEDNS_DIR=/tmp/test-acmedns node api-backend/merkez-istemci/kayit.js --code <CODE> --auto --lan-ip 192.168.2.111
```

3. Für Docker: gitignoriertes `onprem/docker-compose.override.yml` anlegen:
```yaml
services:
  kayit:
    network_mode: host
```

## Schnittstellen

`POST /v1/vorschlag` (Code) · `POST /v1/register` (mit neuem Schlüssel signiert) ·
`POST /v1/ip` · `POST /v1/caa` (beide signiert). Kein Admin-Endpunkt — Verwaltung nur per CLI,
Protokoll im nur anhängbaren `adminlog`. Signaturformat: Kopf von `api-backend/merkez-istemci/signatur.js`.

## Bekannte Grenzen v1

- **Verwaister acme-dns-Konto / nicht wiederholbare Antwort:** `/v1/register` legt erst das acme-dns-Konto und die DNS-Einträge an, dann die Box.
  Scheitert Merkez dazwischen (oder geht die Antwort verloren), bleibt ein ungenutztes acme-dns-Konto zurück (harmlos, ohne Zuordnung),
  der Code wird freigegeben (bei Fehler auf unserer Seite), aber die Antwort mit dem acme-dns-Passwort ist nicht erneut abrufbar —
  die Box muss neu registrieren. Nach erfolgreichem Eintrag, aber verlorener Antwort: Admin gibt `kod-rebind <name>`, die Box ruft `kayit.js --neuer-schluessel`.
  Aufräumen verwaister acme-dns-Konten ist nicht automatisiert.
- **Globale Register-Sperre:** über 20 abgelehnte `/v1/register`-Anfragen pro Stunde (alle Quellen) → 503 bis Fensterende und Logzeile `[ALARM]`. Ein Angreifer kann Registrierungen so bis zu eine Stunde blockieren; bestehende Boxen (`/v1/ip`, `/v1/caa`) sind nicht betroffen.
- Rate-Limits liegen im Arbeitsspeicher (ein Prozess, Neustart setzt zurück).
