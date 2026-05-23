# Technische und Organisatorische Maßnahmen (TOM)

**Art. 32 DSGVO — Sicherheit der Verarbeitung**

Anhang 2 zum Auftragsverarbeitungsvertrag (AVV) zwischen InfinityMade und den Auftraggebern (Praxen).

| | |
|---|---|
| Anbieter | InfinityMade |
| Stand | 2026-05-23, Version 1.0 |
| Geltungsbereich | Alle Verarbeitungen gemäß VVT.md |

---

## § 1 Vertraulichkeit (Art. 32 Abs. 1 lit. b DSGVO)

### 1.1 Zutrittskontrolle (physisch)
- Hosting Hetzner Online GmbH, Falkenstein/Vogtland — **ISO 27001-zertifiziertes Rechenzentrum**
- Hosting Supabase, Frankfurt am Main — über AWS eu-central-1, **ISO 27001 + C5 zertifiziert**
- Keine eigenen Server, kein physischer Zutritt durch InfinityMade-Mitarbeiter

### 1.2 Zugangskontrolle (Systemzugang)
- E-Mail/Passwort + Supabase Auth (Argon2id-Hash, mindestens 8 Zeichen)
- **Zwei-Faktor-Authentifizierung (TOTP)** verpflichtend für Praxisinhaber-Konten ab Go-Live ⏳
- SSH-Zugang zum VPS: nur Public-Key-Auth, root-Login deaktiviert, Port abweichend von 22, `fail2ban` aktiv
- Service-Role-Keys nur serverseitig (Vercel/VPS Env Vars), niemals im Browser
- Brute-Force-Schutz auf `/login`, `/booking/*`, `/verify-code` (Rate Limiting)

### 1.3 Zugriffskontrolle (Datenzugriff)
- **PostgreSQL Row Level Security (RLS)** auf jeder Tabelle mit Patientendaten
  - Auftraggeber A kann nie auf Daten von Auftraggeber B zugreifen, technisch erzwungen
  - Filter `auth.uid() = owner_id` bzw. Multi-Business via `business_id`
- Role-Based Access Control: `owner` / `employee` mit Modul-Berechtigungen (Faz Multi-Business)
- Audit-Log jedes Patient-Datenzugriffs (Tabelle `data_access_log`, ≥ 12 Monate)
- AI-Aufrufe protokolliert in `ai_audit_log` mit User-ID, Modell, Tokens, Kosten

### 1.4 Trennungskontrolle
- Mandantentrennung über `owner_id`/`business_id` Foreign Keys + RLS Policies
- Separate Storage-Buckets pro Praxis möglich (Pro-Plan-Feature)
- Logische, nicht physische Trennung — durch Row-Level-Security verifiziert

### 1.5 Pseudonymisierung
- KI-Aufrufe an Microsoft Azure (Sweden Central) verwenden **PII-Maskierung**:
  - Patientennamen werden vor Übertragung durch Platzhalter ersetzt
  - KVNR, Geburtsdatum werden nicht an externe KI-Modelle gesendet
  - Nur strukturelle Verordnungsdaten (Diagnose, Heilmittel, Frequenz) gehen an das Modell
- Marketing-Telemetrie nutzt Pseudonyme (`anonymize_ip` in GA)

---

## § 2 Integrität (Art. 32 Abs. 1 lit. b DSGVO)

### 2.1 Eingabekontrolle
- Server-seitige Input-Validierung auf jedem API-Endpunkt
- Preflight-Validator (Anlage 1 V21 § 302 SGB V) vor jedem EDIFACT-Versand: KVNR-Format, IK-Prüfziffer, ICD-10, Datumskonsistenz
- Stripe Webhook Signaturvalidierung (`stripe-signature` Header)
- Supabase JWT-Validierung in jedem authentifizierten Request

### 2.2 Weitergabekontrolle
- TLS 1.2 / 1.3 erzwungen auf allen öffentlichen Endpunkten (Traefik + Let's Encrypt)
- HSTS-Header aktiv
- DTA-Dateien für DMRZ werden ab Sprint 9 mit ITSG-Zertifikat PKCS#7 signiert
- Storage-Bucket `abrechnungen` nur über Signed URLs (Gültigkeit ≤ 15 Min) zugänglich

---

## § 3 Verfügbarkeit & Belastbarkeit (Art. 32 Abs. 1 lit. b/c DSGVO)

### 3.1 Verfügbarkeit
- Supabase: integrierte tägliche Backups, Point-in-Time-Recovery (Pro-Plan ab Go-Live)
- Hetzner VPS: tägliche Snapshots, Aufbewahrung 7 Tage
- Cloudflare/Vercel CDN für statisches Frontend → globale Edge-Verfügbarkeit
- Status-Monitoring (Uptime Kuma) ab Go-Live

### 3.2 Wiederherstellbarkeit
- Backup-Wiederherstellungs-Drill mindestens 1× pro Jahr dokumentiert
- Recovery Time Objective (RTO): ≤ 24 h
- Recovery Point Objective (RPO): ≤ 24 h (Daily Backup); ≤ 5 Min (PITR Pro-Plan)

### 3.3 Belastbarkeit / DoS-Schutz
- Cloudflare/Vercel-CDN absorbiert Layer-7-Angriffe
- Rate Limiting auf öffentlichen Endpunkten (60/min Slots, 20/min Booking, 5/10min Verify)

---

## § 4 Verfahren regelmäßiger Überprüfung (Art. 32 Abs. 1 lit. d DSGVO)

- Vierteljährliche Überprüfung der RLS-Policies durch Code-Review
- Penetration-Self-Test bei jedem Major-Release (RLS-Bypass-Versuche)
- TLS-Bewertung über `ssllabs.com` mindestens halbjährlich (Ziel: A+)
- Dependency-Scan via GitHub Dependabot (wöchentlich)
- Jährliche TOM-Aktualisierung

---

## § 5 Auftragskontrolle (Art. 28 DSGVO)

- Schriftlicher AVV mit jedem Auftraggeber (siehe `dpa.html`)
- Schriftlicher AVV mit jedem Sub-Prozessor (siehe VVT.md Übersicht)
- Weisungen des Auftraggebers werden ausschließlich über das Dashboard oder per E-Mail an `support@infinitymade.de` entgegengenommen und schriftlich dokumentiert

---

## § 6 Datenschutz durch Voreinstellungen (Art. 25 DSGVO)

- Privacy-by-Default: Kunden-Booking-Page sammelt nur die für Terminbuchung minimal erforderlichen Felder (Name, Kontakt, Service)
- Standard-Speicherdauer ist **kurz**; Verlängerung nur durch aktive Konfiguration durch den Verantwortlichen
- Kein Tracking-Cookie ohne Consent (TTDSG)

---

## § 7 Löschkonzept

| Datentyp | Speicherdauer | Löschmechanismus |
|---|---|---|
| Session/JWT | bis Logout, max. 7 Tage | Supabase Auto-Expire |
| Server-Access-Log | 14 Tage | Logrotate-Cron |
| `data_access_log` (Patient-Zugriffe) | 12 Monate | tägl. Cron, hardlöschen |
| `ai_audit_log` | 24 Monate | monatl. Cron |
| Patient-Stammdaten | Vertrag + 10 Jahre (Heilberufe) | Soft-Delete + Cron-Hard-Delete nach 10J |
| Rezept / EDIFACT-Rohdatei | 90 Tage nach DMRZ-Bestätigung | tägl. Cron |
| Abrechnungs-PDF (Begleitzettel) | 10 Jahre (§ 14 UStG) | manuelle Archivierung |
| Inaktives Kundenkonto | Anonymisierung nach 6 Monaten Inaktivität ab Vertragsende | Quartals-Cron |

---

## § 8 Meldepflichten bei Datenpannen (Art. 33 DSGVO)

- Erkennung über Sentry + Server-Log-Anomalien (ab Go-Live)
- Eskalationsweg: Erkennung → interne Bewertung (< 4 h) → Risikoeinstufung → bei Risiko für Betroffene: Meldung an Aufsichtsbehörde **innerhalb 72 h** + Information der Auftraggeber
- Vorlagen siehe `compliance/DATAPANNE_RUNBOOK.md` ⏳ (vor Go-Live)
