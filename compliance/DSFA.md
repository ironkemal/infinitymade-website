# Datenschutz-Folgenabschätzung (DSFA)

**Art. 35 DSGVO**

Eine DSFA ist erforderlich, weil InfinityMade besondere Kategorien personenbezogener Daten (Art. 9 DSGVO — Gesundheitsdaten) in **umfangreicher Weise** und in **automatisierter Form** verarbeitet (Bundesweiter Praxis-SaaS, KI-gestützte OCR, Mandantenisolation).

| | |
|---|---|
| Verantwortlicher | InfinityMade |
| Stand | 2026-05-23, Version 1.0 |
| Bezug | VVT.md Verarbeitung 2 + 3 |

---

## 1. Beschreibung der Verarbeitung

Eine SaaS-Plattform für Praxen (Physiotherapie, Heilmittelerbringer) zur:
- Online-Terminbuchung durch Patient*innen
- Verwaltung der Patient*innen-Stammdaten und Verordnungen
- OCR-Erkennung handschriftlich/digital ausgestellter Verordnungen
- Erstellung der § 302 SGB V Abrechnungsdateien (EDIFACT) für DMRZ

**Datenarten:** Name, Geburtsdatum, Adresse, Kontaktdaten, **KVNR**, **Versichertenstatus**, **ICD-10-Diagnose**, **Diagnosetext**, Heilmittel-Positionen, Behandlungssitzungen, ggf. Notizen aus Therapieberichten.

**Umfang:** Pro Praxis ~50–500 Patient*innen, geplant 100–1.000 Praxen.

**Technologien:** PostgreSQL + RLS, Node.js Backend, Microsoft Azure OpenAI (Sweden Central) für OCR.

---

## 2. Notwendigkeit und Verhältnismäßigkeit

| Prüfpunkt | Bewertung |
|---|---|
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b + Art. 9 Abs. 2 lit. h DSGVO; § 22 BDSG |
| Zweckbindung | Erfüllt — Verarbeitung ausschließlich zur Patient*innenversorgung & gesetzlicher Abrechnung |
| Datenminimierung | Erfüllt — Booking-Page sammelt minimal; OCR sendet nur strukturierten Inhalt, keine Klartextnamen mehr nach PII-Masking |
| Speicherbegrenzung | Erfüllt — 10-Jahres-Aufbewahrung Heilberufe; alles andere ≤ 24 Monate |
| Transparenz | Erfüllt — Datenschutzerklärung, AVV, VVT öffentlich/auf Anfrage |

---

## 3. Risikoanalyse

### Risikomatrix

| ID | Risiko | Eintrittsw. (1-5) | Schaden (1-5) | Score | Status |
|----|--------|-----|-----|----|----|
| R1 | RLS-Bypass — Praxis A sieht Daten Praxis B | 2 | 5 | 10 | **mitigiert** |
| R2 | Service-Role-Key kompromittiert | 2 | 5 | 10 | mitigiert |
| R3 | OCR-Daten an externe KI mit Re-Identifizierungs-Risiko | 3 | 4 | 12 | **mitigiert (PII-Masking + ZDR)** |
| R4 | Account-Übernahme Praxisinhaber (kein MFA) | 4 | 4 | 16 | **offen → P0 vor Go-Live (MFA-Pflicht)** |
| R5 | Doppelbuchung führt zu falschem Abrechnungsdatum | 1 | 2 | 2 | mitigiert (EXCLUDE GIST Constraint) |
| R6 | Backup-Verlust / Wiederherstellbarkeit nicht getestet | 2 | 4 | 8 | **offen → P1 (Drill vor Go-Live)** |
| R7 | Datenpanne ohne 72h-Meldung | 3 | 5 | 15 | **offen → P0 (Runbook)** |
| R8 | DMRZ-Datei mit fehlerhaften Patient-Daten → Rückläufer | 3 | 2 | 6 | mitigiert (Preflight-Validator) |
| R9 | KVNR im Server-Log durch ungeschickte Fehlermeldung | 2 | 4 | 8 | **offen → P1 (Log-Filter)** |
| R10 | Drittländer-Übermittlung über Sub-Prozessor | 2 | 3 | 6 | mitigiert (Azure EU, Stripe SCC) |
| R11 | Mitarbeiter-Konto behält Zugriff nach Kündigung | 2 | 3 | 6 | mitigiert (Owner-Deaktivierungsflow) |
| R12 | Klartext-Diagnose in DB-Spalte → Datenbankleck enthüllt Gesundheitsdaten | 3 | 5 | 15 | **offen → P1 (Column-Encryption pgcrypto)** |

Score-Skala: 1-4 niedrig · 5-9 mittel · 10-14 hoch · 15-25 sehr hoch.

### Maßnahmen zu offenen Risiken

- **R4 / MFA-Pflicht**: Supabase `enrollMfa` Flow erzwingen für Owner-Konten ab Go-Live. Implementierung als P0 in PRE_LAUNCH_CHECKLIST.md.
- **R6 / Backup-Drill**: 1× vollständiger Restore-Test vor Go-Live, Protokoll in `compliance/BACKUP_DRILL_LOG.md`.
- **R7 / Datenpannen-Runbook**: Erstellung `compliance/DATAPANNE_RUNBOOK.md` mit Eskalations-Flowchart, Meldetemplate Aufsichtsbehörde, Kommunikationsvorlage Auftraggeber.
- **R9 / Log-Filter**: Custom Logger der bekannte PII-Felder (KVNR-Regex, ICD-10) durch `[REDACTED]` ersetzt — bereits in `api-backend/_log.js` einplanen.
- **R12 / Column-Encryption**: `pgp_sym_encrypt` auf `prescriptions.icd10`, `prescriptions.diagnosetext`, `patients.kvnr`. Schlüssel über Supabase Vault. P1 vor Go-Live.

---

## 4. Konsultation des / der Betroffenen

Konsultation erfolgt indirekt über:
- Datenschutzerklärung mit klarer Information über Verarbeitungszwecke
- Möglichkeit zur Auskunft (Art. 15 DSGVO) und Löschung (Art. 17) über Praxis als Verantwortliche
- Beschwerdemöglichkeit über `support@infinitymade.de` und Aufsichtsbehörde

---

## 5. Ergebnis

Die Verarbeitung ist nach Umsetzung aller offenen P0/P1-Maßnahmen aus PRE_LAUNCH_CHECKLIST.md **mit den Anforderungen der DSGVO und § 22 BDSG vereinbar**.

Eine erneute DSFA ist erforderlich, wenn:
- KI-Modelle ausgetauscht werden (z. B. Anbieterwechsel von Azure auf US-only Provider)
- Neue Datenkategorien eingeführt werden (z. B. genetische Daten, biometrische Auth)
- Geschäftsmodell sich grundlegend ändert (z. B. Anbindung an gesetzliche Krankenkassen direkt)

| Verantwortlicher | Unterschrift | Datum |
|---|---|---|
| [Inhaber InfinityMade] | _______ | _______ |
