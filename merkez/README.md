# Praxura Merkez

Zentraler Namensdienst für Kunden-Boxen (Sprint K2b.2 / K2b.17, Register `onprem/REGISTER.md` O-161).
Läuft **nur in der Zentrale** (eigene kleine VPS, nicht auf dem n8n-/calendar-api-Server).
**Nicht für Boxen:** dieser Ordner gehört nicht in das Box-Image (`api-backend/Dockerfile` kopiert
Verzeichnisse einzeln) und nicht ins Web (`.vercelignore`).

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

Der Reverse-Proxy muss Pfad und Query **unverändert** durchreichen (sie sind Teil der Signatur)
und TLS terminieren. Node ≥ 22.13 (`node:sqlite`).

## Lokal

```
cd merkez && npm install
npm test                      # Fakes für Cloudflare und acme-dns, kein Netz
node admin.js kod-neu         # Einrichtungscode erzeugen (erscheint einmal)
node admin.js liste
node admin.js kod-rebind <name>
node admin.js iptal <name>
node admin.js adresse-loeschen <name>   # nur nach iptal
BOX_DOMAIN=… CF_ZONE_ID=… CF_API_TOKEN=… ACME_DNS_INTERN_URL=… ACME_DNS_URL=… node server.js
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
