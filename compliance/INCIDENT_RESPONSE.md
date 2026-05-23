# Datenpannen-Runbook — Incident Response Plan

**Status:** Draft 2026-05-23
**Verantwortlich:** Yavuz Kemal Demir (Geschäftsführer + DSB-Interim)
**Rechtsgrundlage:** Art. 33, 34 DSGVO (Meldepflicht binnen 72h)

---

## Was zählt als "Datenpanne"?

Eine **Verletzung des Schutzes personenbezogener Daten** liegt vor, wenn:

- Unbefugte Zugriff auf Daten erlangt haben (Hack, geleakter Service-Role-Key, fremder Admin-Login)
- Daten verloren gehen (gelöschte Tabelle ohne Backup, korrupter Supabase-Snapshot)
- Daten unrechtmäßig verändert wurden (Manipulation von Abrechnungs- oder Patientendaten)
- Daten an Unbefugte versendet wurden (z.B. Bestätigungs-E-Mail an falschen Empfänger mit KVNR)

**Beispiele aus unserem Stack:**
- Supabase RLS-Bypass → fremde Mandanten-Daten sichtbar
- Stripe Webhook ohne Signature-Verify → fremder POST mit gefakter Subscription
- Calendar-API Token-Leak → Fremder erstellt Buchungen
- VPS-Hack → Zugriff auf Vault-Secrets, OCR-Bilder

---

## ⏱️ Zeitplan (DSGVO-konform)

| Zeit ab Kenntnis | Aktion |
|---|---|
| **0h** | Incident erkennen, Zeitpunkt notieren |
| **0–1h** | Containment: betroffenes System isolieren |
| **1–4h** | Forensik: Was wurde betroffen? Welche Daten? Wie viele? |
| **24–48h** | Mitigation + Doku |
| **bis 72h** | **Meldung an Datenschutzbehörde** (LfDI NRW oder zuständige) |
| **falls "hohes Risiko"** | **Betroffene informieren** (Art. 34) — z.B. Brief/E-Mail |

> 72-Stunden-Frist gilt **ab Kenntniserlangung**, nicht ab Vorfall. Wenn man Mittwoch 14:00 davon erfährt → Samstag 14:00 muss Meldung raus sein.

---

## 🚨 Sofortmaßnahmen (Containment)

### 1. Supabase-Vorfall

```bash
# Service-Role-Key rotieren
# Supabase Dashboard → Settings → API → Reset service role key

# RLS überprüfen
# SQL: select * from pg_policies where schemaname = 'public';

# Verdächtige Sessions kicken
# Auth → Users → Sign out user
```

- Vercel env vars updaten (`SUPABASE_SERVICE_ROLE_KEY`)
- VPS `.env.calendar` updaten + `docker compose restart calendar-api`
- Logs ziehen: Supabase → Logs → Postgres + Auth, letzte 7 Tage

### 2. Stripe-Vorfall

- Webhook secret rotieren: Stripe Dashboard → Developers → Webhooks → Roll secret
- Verdächtige Subscriptions stornieren manuell
- Stripe Radar-Logs prüfen

### 3. VPS-Vorfall (n8n.infinitymade.de)

```bash
# Disconnect: ufw default deny incoming
# Snapshot ziehen (Hetzner) vor irgendeiner Änderung — Forensik!
# Dann: alle Sessions + SSH-Keys rotieren
```

- Hetzner-Snapshot von **vor dem Vorfall** isolieren (nicht überschreiben)
- Watchtower stoppen: `docker compose stop watchtower` (kein Auto-Update bis Analyse)

### 4. Falsche E-Mail mit Patientendaten

- Empfänger anrufen, Löschung verlangen (mündliche Bestätigung dokumentieren)
- Eigenes Sent-Folder leeren reicht **nicht** — empfangene Mail bleibt beim Empfänger

---

## 📋 Forensik-Checkliste

- [ ] Wann ist es passiert? (Logs prüfen, nicht raten)
- [ ] Wer hat es entdeckt? (Kunde / interner Monitor / Sentry / Behörde)
- [ ] Welche Daten betroffen? (Stammdaten? Patientendaten? KVNR? Bankverbindung?)
- [ ] Wie viele Personen? (1–9 / 10–100 / 100+ / > 1000)
- [ ] Welche Datenkategorien nach Art. 9 DSGVO? (Gesundheitsdaten = **immer** hohes Risiko)
- [ ] Wurden Daten exfiltriert oder nur potenziell sichtbar?
- [ ] Mitigation bereits implementiert? (Patch, Rotate, Disable)
- [ ] Externer Angriff oder interner Fehler?

---

## 📧 Meldung an Aufsichtsbehörde

**Zuständig:** LfDI NRW (Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen)
- Online-Formular: https://www.ldi.nrw.de/datenpanne
- E-Mail: poststelle@ldi.nrw.de
- Telefon: 0211 38424-0

**Inhalt der Meldung (Art. 33 Abs. 3):**

1. Art der Verletzung (Zugriff / Verlust / Manipulation / Offenlegung)
2. Kategorien + ungefähre Zahl betroffener Personen
3. Kategorien + ungefähre Zahl betroffener Datensätze
4. Voraussichtliche Folgen
5. Ergriffene oder vorgeschlagene Mitigation
6. Name + Kontaktdaten des DSB

**Falls innerhalb 72h Details unklar:** Meldung trotzdem absetzen mit "Folgemeldung folgt".

---

## 📨 Benachrichtigung der Betroffenen (Art. 34)

Pflicht **nur wenn "hohes Risiko"** für Rechte/Freiheiten der Betroffenen besteht. Bei Patientendaten/KVNR/Diagnosen → **immer hohes Risiko**.

**Inhalt:**
- Klare Sprache, keine Juristerei
- Was passiert ist
- Wahrscheinliche Folgen
- Was wir tun
- Was sie tun sollten (Passwort ändern, Bank prüfen, etc.)
- Kontakt für Rückfragen

**Kanal:** E-Mail mit qualifiziertem Empfang (Read-Receipt) oder per Post bei größeren Vorfällen.

---

## 🗂️ Interne Dokumentation

Auch wenn **keine Meldepflicht** entsteht (Vorfall ohne Risiko) — **immer** intern dokumentieren in `compliance/incidents/YYYY-MM-DD-kurzname.md`:

```markdown
# Incident YYYY-MM-DD — Kurzname

- Entdeckt: <Datum/Uhrzeit + Person>
- Beschreibung: <2-3 Sätze>
- Betroffene Systeme: <Supabase / Stripe / VPS / E-Mail>
- Betroffene Personen: <Anzahl + Kategorien>
- Datenkategorien: <Stammdaten / Gesundheitsdaten / Zahlungsdaten>
- Mitigation: <Was wurde getan>
- Meldung an Behörde: <Ja/Nein, Datum, Aktenzeichen>
- Meldung an Betroffene: <Ja/Nein, Datum, Kanal>
- Lessons Learned: <was machen wir anders>
```

Audit-Trail aufbewahren mindestens **3 Jahre** (Art. 33 Abs. 5).

---

## 🔁 Post-Incident-Review (innerhalb 1 Woche)

- War der Vorfall verhinderbar? Welcher Control hat versagt?
- Welcher Detective Control hätte ihn früher gefangen?
- Update TOM.md falls Maßnahme angepasst wird
- Update DSFA.md falls neue Risikomatrix
- Bei wiederholtem Pattern: Strukturelle Änderung (z.B. RLS-Test in CI)

---

## Kontakte

| Rolle | Person | Kontakt |
|---|---|---|
| Geschäftsführer / DSB-Interim | Yavuz Kemal Demir | ironkemal5@gmail.com |
| Hosting (Hetzner) | Support | https://www.hetzner.com/support |
| Backend (Supabase) | Support | https://supabase.com/support |
| Payments (Stripe) | Support | https://support.stripe.com |
| Aufsichtsbehörde NRW | LfDI | poststelle@ldi.nrw.de |

> Bei externer DSB-Bestellung (siehe PRE_LAUNCH P3): Kontakt hier eintragen.
