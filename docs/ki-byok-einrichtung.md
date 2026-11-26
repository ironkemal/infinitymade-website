# KI-Integration (BYOK — Konsey-Beschluss 24.11.2026, Option D)

Diese Anleitung beschreibt, wie ein eigener **Microsoft Azure OpenAI**-Zugang (EU-Region) per `.env` auf der Praxura-Box eingebunden wird — ohne API-Schlüssel in der Datenbank oder im Browser.

## Rahmenbedingungen (verbindlich)
- **Nur Praxura-Box** (erkannt über gesetztes `SUPABASE_PUBLIC_URL`, kein SaaS-BYOK).
- **Nur `.env` auf dem Server** — Schlüssel verlassen den Server nicht und erscheinen nie in UI, Datenbank oder Logs.
- **Nur Azure OpenAI in der EU Data Boundary**:
  - Host-Muster: `https://<name>.openai.azure.com` oder `https://<name>.cognitiveservices.azure.com`
  - Erlaubte `AI_REGION`-Werte: `germanywestcentral`, `westeurope`, `northeurope`, `francecentral`, `swedencentral`, `switzerlandnorth`, `switzerlandwest`, `norwayeast`, `polandcentral`, `italynorth`, `spaincentral`.
- **Datenklasse A (PII-Maskierung aktiv)**: Alle Aufrufe laufen über das M4-Gateway (`api-backend/ai/ki-gateway.js`) mit Maskierung vor dem Versand.

## Einrichtung in 3 Schritten

### 1. `.env` auf der Box ergänzen
```env
# KI-Modus & Freigaben (Option D — BYOK)
AI_MODE=direkt
AI_BYOK_ALLOWED=1
AI_ACTIVATION_READY=1
AI_MAIL_READY=1

# Eigener Azure OpenAI Zugang (EU-Region)
AI_PROVIDER=azure
AI_ENDPOINT=https://<ihr-ressourcenname>.openai.azure.com
AI_API_KEY=<ihr-azure-api-schluessel>
AI_REGION=germanywestcentral
AI_MODEL_TEXT=gpt-4o-mini
AI_API_VERSION=2024-10-21
```

*(Die Box setzt `SUPABASE_PUBLIC_URL` bereits im Standard-Setup.)*

### 2. Backend neu starten
Nach dem Speichern der `.env` den `api-backend`-Container neu starten (`docker compose up -d api-backend`).

### 3. In Praxura prüfen & freischalten
1. In Praxura als **Praxisinhaber** anmelden.
2. **Einstellungen → KI-Unterstützung** öffnen.
3. Prüfen, dass **Anbieter & Region** (`Eigener Azure-Zugang (Admin-Konfiguration) · <region> (EU)`) angezeigt wird.
4. Auf **„Verbindung testen“** klicken (`POST /api/ai/_verbindungstest`). Bei Erfolg erscheint `✓ Verbindung in Ordnung.`.
5. Den Schalter **„Optionale KI-Unterstützung für diese Praxis erlauben“** aktivieren und gewünschte Aufgaben freigeben.

## Verfügbare KI-Funktionen
- **Anfragen → Nachricht an Patient → ✨ Mit KI erstellen** (`POST /api/ai/b2c-draft`) — erstellt Entwürfe, sendet niemals automatisch.
- **E-Mail-Assistent (B2C / B2B)** — Entwürfe auf Deutsch (Sie-Form).
- **Serientermin-Planung & Rezept-Normalisierung** (jeweils als Vorschlag vor manueller Freigabe).

## Technische Referenz
- Konfiguration & Validierung: [api-backend/ai/ki-config.js](../api-backend/ai/ki-config.js)
- Router & Verbindungstest: [api-backend/ai/router.js](../api-backend/ai/router.js)
- Einstellungen-UI: [module/ki-einstellungen.js](../module/ki-einstellungen.js)
- Konsey-Beschluss: [konsey/KARARLAR.md](../konsey/KARARLAR.md) (2026-11-24)
