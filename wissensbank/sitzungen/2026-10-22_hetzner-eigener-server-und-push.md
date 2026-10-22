---
titel: Hetzner-Eigenbetrieb der Praxis-Box und Push-Abgleich 22.10.2026
typ: sitzung
angelegt: 2026-10-22
tags: [sitzung, onprem, hetzner, deploy, migrationen, push]
---

# Hetzner-Eigenbetrieb der Praxis-Box und Push-Abgleich (22.10.2026)

> Keine Quelle. Maßgeblich bleibt `onprem/KURULUM.md` (Stand 0.4.1, 08.10.2026) und `onprem/REGISTER.md`.
> Status: **gelesen und dokumentiert, nichts auf einem Server getestet.**

## 1. Frage: Praxura auf einem eigenen Hetzner-Server laufen lassen

**Ergebnis:** Der Weg C in `onprem/KURULUM.md` beschreibt es vollständig. Es gab keine Server-IP
und keinen Zugang, deshalb wurde **nichts live getestet** (Stand: gelesen, nicht gemessen).

Kernpunkte:

- Servertyp **CX33** (4 vCPU, 8 GB, 80 GB), Ubuntu 24.04, **nur x86** (kein CAX/ARM, Images nur amd64).
  CX23 reicht nicht: `install.sh` bricht unter 40 GB freiem Platz ab.
- **Hetzner Cloud Firewall** statt `ufw` (Docker umgeht `ufw`). Offen: 80/tcp, 443/tcp, 443/udp;
  22/tcp nur für die eigene Admin-IP.
- Installation: Starter-Befehl von `praxura.de/install.sh` per `sudo bash`, danach die Fragen aus KURULUM §2.
- **Einrichtungscode** (`XXXX-XXXX-XXXX-XXXX`) liefert Namen unter `*.box.praxura.de` und ein
  Let's-Encrypt-Zertifikat über den Praxura-Namensdienst. Ohne Code gilt der Ausstiegsweg (KURULUM §8):
  eigene Domain mit A-Record, in `.env` `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`,
  `CADDY_TLS_MODUS=klassisch`. Weil ein Cloud-Server aus dem Internet erreichbar ist, bei
  `CADDY_TLS_ARG` eine E-Mail für Let's Encrypt eintragen, nicht `internal`.
- Einmalig angezeigte Werte: `DATA_ENCRYPTION_KEY` und Sicherungsschlüssel (`AGE-SECRET-KEY-1…`).
  Beide in den Tresor, nicht auf den Server. Ohne sie sind Patientenfelder und Backups verloren.
- Update-Kanal zum Testen: `beta`. Ein Wechsel auf `stable` ist nur sinnvoll, wenn `stable` mindestens so neu ist.
- Nicht auf dem Produktiv-VPS (`/opt/calendar-api`, n8n) testen, sondern auf einem neuen, getrennten Server.

**Ungeprüft / offen:**

- Ob `ghcr.io/ironkemal/infinitymade-website/...` öffentlich pullbar ist (sonst scheitert der Image-Pull).
- Ob es bereits einen `stable`-Kanal gibt, oder nur `beta`.
- Wer den Einrichtungscode erzeugt und woher ein Testcode kommt.
- Der echte Lauf auf Hetzner (Healthchecks, Zertifikat, Firewall) steht aus. Alternative: lokaler Test mit
  `onprem/docker-compose.yml` im Ausstiegsmodus mit `praxis.home.arpa` (Docker 29.1.3 ist auf dem Mac vorhanden).
- § 393 SGB V / Standortwahl: KURULUM §9 vor dem Echtbetrieb lesen.

## 2. Commit und Push

Gepusht wurde `ff58303e` auf `origin/main` (zuvor `e28bde5c`). Vorgehen:

1. Erster Commit-Versuch scheiterte am Pre-commit-Hook (Migrationen ohne `-- SaaS:`-Zeile nach O-129,
   veraltetes `onprem/manifest.json` nach O-149). Kein `SKIP_*` verwendet.
2. `git pull --rebase --autostash` auf 14 neue Commits, Konflikte in `onprem/install.sh`,
   `funktionen/INDEX.*`, `fortschritte/2026-10-22.md`.
   - `install.sh`: upstream hatte denselben `select=id`-Fix, upstream-Version übernommen.
   - `funktionen/INDEX.*` neu erzeugt (`node tools/funktionskarte.mjs`).
   - `onprem/manifest.json` neu erzeugt (`node tools/onprem-manifest.mjs`).
   - Tagesprotokoll beider Seiten zusammengeführt.
3. **Nicht gepusht (bewusst):**
   - `Claude outputs/` (Audit-Berichte, Repo ist öffentlich; Sicherheitsbefunde gehören nach `guvenlik/`).
   - Migration `0081_warteliste_referenzen_abrechnungsrechte.sql` (nicht live angewendet, Nummer kollidiert,
     siehe unten).
4. **Nicht ausgeführt:** `npm test` und `npm run probe` nach dem Rebase.

## 3. Migrationsnummern-Kollision

Lokal neu angelegt, aber **Duplikate** bereits live angewendeter Upstream-Migrationen:

| Lokal (verworfen) | Upstream, live angewendet |
|---|---|
| `0079_ausfall_zahlung_faelligkeit` | `0081_ausfall_zahlung_faelligkeit` (17.10.2026) |
| `0080_request_approve_atomic` | `0082_request_approve_atomic` (17.10.2026) |

Neu und **nicht** live: `0081_warteliste_referenzen_abrechnungsrechte` (Trigger `warteliste_referenzen_pruefen`).
Sie braucht eine freie Nummer (nächste nach dem Live-Stand `0088`/`0087b`, also `0089`), die Zeile
`-- SaaS: angewandt …` erst nach dem Anwenden und vorher `db-ustasi` und `onprem`.
Die drei Dateien liegen lokal in `/tmp/praxura-migr-parked/` (nicht im Repo, geht bei Neustart verloren).

Lehre: Vor dem Vergeben einer Migrationsnummer `git fetch` und `mcp__supabase__list_migrations`
prüfen. Parallele Sitzungen im selben Arbeitsverzeichnis vergeben sonst dieselben Nummern.

## 4. Offen

- `konsey/tutanak/2026-10-22-ops-statusabgleich.md` wird weiter verändert (vermutlich parallele Sitzung), nicht committet.
- Eintrag in [[conflict]] unter K10 (Migration 0081 Warteliste).
