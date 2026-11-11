# Box-nahe Abnahme: E-Mail-Versand (lokal)

Belegt Ende zu Ende, was ohne echte Kundenbox und ohne echtes Postfach belegbar ist. Ersetzt **nicht** die Abnahme auf einer echten Box
und keine Testmail über einen echten Anbieter (siehe unten „Grenzen“).

```bash
node tools/box-abnahme-mail/abnahme.mjs        # ca. 2–4 Minuten; Exit 0 = alle Prüfungen bestanden
ABN_KEEP=1 node tools/box-abnahme-mail/abnahme.mjs   # Stack zur Fehlersuche stehen lassen
bash tools/box-abnahme-mail/stack.sh down            # Stack entfernen
```

Voraussetzungen: Docker, `openssl`, Node, und diese **lokalen** Images (es wird nichts gezogen, `--pull=never`):
`supabase/postgres:17.6.1.136`, `supabase/storage-api:v1.74.0`, `supabase/gotrue:v2.196.0`, `postgrest/postgrest:v14.17`.

## Was läuft

| Baustein | Was | Datei |
|---|---|---|
| Datenbank + Storage + GoTrue + PostgREST | Container `praxura-abn-*`, Ports 54610–54613 (nur 127.0.0.1), Init-Skripte wie `onprem/docker-compose.yml`, Migrationskette 0000…aktuell mit dem **echten** `api-backend/db/migrate.js` | `stack.sh` |
| Gateway | ersetzt Kong: `/rest/v1` → PostgREST, `/auth/v1` → GoTrue | `gateway.mjs` |
| SMTP-Empfänger | nur `::1`, STARTTLS (selbstsigniert), AUTH gegen feste Testdaten, speichert jede Mail als `.eml` | `smtp-sink.mjs` |
| `api-backend` | der **echte** `server.js` im Box-Modus (`SUPABASE_PUBLIC_URL` gesetzt), einmal ohne, einmal mit `SMTP_*` der Installation | `abnahme.mjs` |

## Was geprüft wird (30 Prüfungen)

- **Einstellungen → E-Mail-Versand:** ohne Postfach, IP statt Servername abgelehnt, falsches Passwort (`EAUTH`, Status „unterbrochen“), richtiges
  Passwort (verbunden über STARTTLS), Passwort nur verschlüsselt in der Datenbank und nie in Antworten, Testmail beim Empfänger (Absender der Praxis),
  Zugangsdaten nie im Klartext, Drossel (429), Transparenzseite (`/ueber/verbindungen`).
- **Rechnung per Mail:** PDF-Vorschau, Versand an den Patienten (Anhang, Absender der Praxis, keine Praxura-Adresse), Mitarbeiter ohne Modulrecht
  `abrechnung` → 403, mit Recht → 200.
- **Terminerinnerung:** echter Lauf (19:00 Berlin), Mail beim Patienten, Protokollzeile, zweiter Lauf ohne Doppelversand.
- **Update-Alarm:** `setup/update-alarm-mail.mjs` liest das Postfach aus der Datenbank, Exit 0, Mail beim Inhaber.
- **Rangfolge:** Praxis-Postfach > `SMTP_*` der Installation; nach „Trennen“ greift die Installation, Passwort in der Datenbank gelöscht.

## Grenzen (bewusst nicht belegt)

- **Kein echter Anbieter** (Gmail, IONOS, Strato, T-Online, Microsoft): Zustellung, Anbieter-Hinweise bei echten Fehlern, Spam-Einstufung.
- **Kein echtes Zertifikat:** der Empfänger nutzt ein selbstsigniertes; der Testprozess läuft mit `NODE_TLS_REJECT_UNAUTHORIZED=0`.
  Die Zertifikatsprüfung selbst ist hier nicht belegt (sie ist in `api-backend/routes/mailversand-smtp.test.js` nur mit Ausnahme getestet).
- **Keine echte Box:** weder `install.sh`, Caddy/TLS noch Kong, Watchtower/Update-Zyklus, Netz der Praxis, Zeitzone/Uhr der Box.
- **Nicht abgedeckt:** Therapiebericht-/Fax-Versand, Sondertag-Mitteilung, Booking-Anfrage-Antworten (nur Unit-/Handler-Tests), Google-/Microsoft-Anmeldung.
- Der Erinnerungslauf wird mit festem `jetzt` (19:00 Berlin) aufgerufen; der Zeitjob (`starteTerminerinnerung`) selbst läuft nicht.

