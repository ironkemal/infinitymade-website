# Datenschutz-Folgenabschätzung (DSFA)

**Art. 35 DSGVO**

Eine DSFA ist erforderlich, weil InfinityMade besondere Kategorien personenbezogener Daten (Art. 9 DSGVO — Gesundheitsdaten) in **umfangreicher Weise** und in **automatisierter Form** verarbeitet (Bundesweiter Praxis-SaaS, KI-gestützte OCR, Mandantenisolation).

| | |
|---|---|
| Verantwortlicher | InfinityMade |
| Stand | 2026-08-14, Version 1.1 |
| Bezug | VVT.md Verarbeitung 2 + 3 + 5 |

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
| R13 | Unterschriftenerfassung auf einem an Patient*innen übergebenen Gerät — Einblick in andere Patientendaten über den Kiosk-Modus hinweg | 2 | 4 | 8 | **teilmitigiert → siehe Maßnahmen R13** |
| R14 | Fremdes CDN liefert Programmcode in den Anwendungskontext → bei Kompromittierung beliebiger Code im Browser der Praxis mit Zugriff auf die gesamte Sitzung (Lieferkette) | 2 | 5 | 10 | **mitigiert (14.08.2026) → Restpunkte siehe Maßnahmen R14** |
| R15 | Ausfall eines fremden CDN macht die Anwendung startunfähig (Verfügbarkeit) | 3 | 3 | 9 | **mitigiert (14.08.2026)** |
| R16 | Angestellte lesen Verordnungen und Behandlungsdokumentation aller Patient*innen ihrer Praxis, nicht nur der selbst behandelten | 2 | 3 | 6 | **bewertet und akzeptiert (03.09.2026)** — siehe unten |
| R17 | Direktzugriffe des Dashboards auf die Datenbank erscheinen in keinem Zugriffsprotokoll | 2 | 3 | 6 | **offen** — Umfang in TOM.md §1.3 richtiggestellt, lückenlose Protokollierung erfasst |

Score-Skala: 1-4 niedrig · 5-9 mittel · 10-14 hoch · 15-25 sehr hoch.

**R16 — Begründung der Annahme.** Der Zugriff bleibt strikt innerhalb desselben
Auftraggebers (RLS-Vergleich gegen `profiles.owner_id`), die Mandantentrennung ist
unberührt. Rechtsgrundlage trägt (Art. 9 Abs. 3 DSGVO, § 203 Abs. 1 Nr. 1 und Abs. 3
StGB — Therapeut*innen sind über ihr Berufsgesetz selbst Geheimnisträger). Eine
Einschränkung auf „nur selbst behandelte Patient*innen" wäre datensparsamer, ist aber
in einer kleinen Praxis nicht praktikabel: Vertretung bei Krankheit und Urlaub ist der
Normalfall, und der Physio-Verordnungstopf (`prescriptions`) arbeitet seit jeher so.
Gegenrechnung: die vorherige Sperre führte dazu, dass die behandelnde Person ihre eigene
Behandlung **nicht** dokumentieren konnte — mit Blick auf § 630f Abs. 2 BGB (Zeitnähe)
und § 630h Abs. 3 BGB (Beweislast) war das das größere Risiko.
**Neubewertung ausgelöst durch:** ersten Kunden mit mehreren Standorten (die
Standorttrennung ist keine RLS-Zusicherung, siehe TOM.md §1.3), oder wenn die Rolle
`employee` auch an nicht-klinisches Personal (Empfang) vergeben wird.

### Maßnahmen zu offenen Risiken

- **R4 / MFA-Pflicht**: Supabase `enrollMfa` Flow erzwingen für Owner-Konten ab Go-Live. Implementierung als P0 in TODO.md §2.
- **R6 / Backup-Drill**: 1× vollständiger Restore-Test vor Go-Live, Protokoll in `compliance/BACKUP_DRILL_LOG.md`.
- **R7 / Datenpannen-Runbook**: Erstellung `compliance/DATAPANNE_RUNBOOK.md` mit Eskalations-Flowchart, Meldetemplate Aufsichtsbehörde, Kommunikationsvorlage Auftraggeber.
- **R9 / Log-Filter**: Custom Logger der bekannte PII-Felder (KVNR-Regex, ICD-10) durch `[REDACTED]` ersetzt — bereits in `api-backend/_log.js` einplanen.
- **R12 / Column-Encryption**: `pgp_sym_encrypt` auf `prescriptions.icd10`, `prescriptions.diagnosetext`, `patients.kvnr`. Schlüssel über Supabase Vault. P1 vor Go-Live.
- **R13 / Kiosk-Modus und Einwilligung** (neu 14.08.2026, Konsey-Beschluss `konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md`): PIN serverseitig als scrypt-Hash mit Rate Limit und Sperre; „PIN vergessen“ beendet die Sitzung statt den Kiosk; Vollbild-Wächter; Abmeldung des Termin-Realtime-Kanals; Protokollierung von Ein- und Austritt in `data_access_log` (vorher gab es **keine**). Einwilligungsnachweise unveränderlich per DB-Trigger, Unterschriften nur über Signed URLs (300 s), **keine IP-Adresse**, **keine Signaturdynamik**. Details: TOM.md § 1.6 und § 1.7.
  **Verbleibendes Risiko, bewusst akzeptiert:** der Kiosk-Modus ist eine Irrtumssperre, keine Sicherheitsgrenze — die Sitzung der Therapeut*in bleibt auf dem Gerät offen. Der Gegenentwurf (sitzungslose Seite mit Einmal-Token) wäre ein zweiter Code- und Deployment-Pfad und wurde vertagt. Organisatorische Kompensation: das Gerät wird nicht unbeaufsichtigt überlassen.
  **Art. 33 DSGVO:** Aus dem bis 14.08.2026 bestehenden Zustand ergibt sich **keine Meldepflicht** — es liegt kein Nachweis eines tatsächlichen unbefugten Zugriffs vor, nur ein Risiko (siehe `compliance/LEGAL_DECISIONS.md`, 2026-08-14).
- **R14 / R15 — Lieferkette und Verfügbarkeit fremder CDN** (neu 14.08.2026, Konsey-Beschluss `konsey/tutanak/2026-08-13-frontend-mimari-katman.md`):

  *Zustand vorher:* Die Anwendung lud `@supabase/supabase-js` an 14 Stellen sowie `node-forge` (PKCS#7-Signatur § 302) und FullCalendar **zur Laufzeit von `esm.sh` bzw. `cdn.jsdelivr.net`**. Damit hätte eine Kompromittierung dieser Anbieter beliebigen Code in der angemeldeten Sitzung ausführen können — mit Zugriff auf sämtliche dort sichtbaren Patientendaten. Ein Ausfall hätte die Anwendung nicht nur gestört, sondern **gar nicht erst starten lassen**. Dieses Risiko war in dieser DSFA bis dahin **nicht erfasst**.

  *Maßnahme:* Alle betroffenen Bibliotheken werden seit 14.08.2026 von der eigenen Domain ausgeliefert (`/vendor/`). Die Content-Security-Policy erlaubt `esm.sh` und `cdn.jsdelivr.net` nicht mehr, die Sperre ist also technisch erzwungen. Einzelheiten TOM.md § 2.3.

  *Nachweis:* Sperrtest am 14.08.2026 — mit blockierten Drittanbieter-Hosts starten Anmeldung und Dashboard unverändert; Supabase-Client, `node-forge` und FullCalendar werden lokal geladen. Wiederholbare Anleitung in `vendor/README.md`; der Test ist Pflichtpunkt der On-Premise-Freigabe.

  **Verbleibendes Risiko, benannt und terminiert:** Der Sentry-Loader (`js-de.sentry-cdn.com`) ist die **letzte externe Laufzeit-Abhängigkeit im Startpfad**; im Sperrtest bestätigt, dass sein Ausfall die Anwendung nicht funktionsunfähig macht. Ebenfalls offen: Cropper.js über `cdnjs.cloudflare.com` (Logo-Zuschnitt, kein Patientendatenbezug, aber gleicher Anwendungskontext) und Google Fonts (rein gestalterisch). **Bewusst extern bleibt Stripe** (`js.stripe.com`) — PCI-DSS verlangt das Laden aus der Stripe-Domain; kein Patientendatenbezug.

  *Rechtlicher Nebenaspekt:* Das Nachladen aus fremden CDN übermittelte zugleich die IP-Adresse der Praxis an Dritte (Analogie LG München I, 20 O 14368/19 — Google Fonts). Mit der Umstellung entfällt dieser Übermittlungsvorgang für die betroffenen Bibliotheken; ein Vertrag nach Art. 28 bzw. Garantien nach Art. 44 ff. werden für sie damit gegenstandslos.

---

## 4. Konsultation des / der Betroffenen

Konsultation erfolgt indirekt über:
- Datenschutzerklärung mit klarer Information über Verarbeitungszwecke
- Möglichkeit zur Auskunft (Art. 15 DSGVO) und Löschung (Art. 17) über Praxis als Verantwortliche
- Beschwerdemöglichkeit über `support@praxura.de` und Aufsichtsbehörde

---

## 5. Ergebnis

Die Verarbeitung ist nach Umsetzung aller offenen P0/P1-Maßnahmen aus TODO.md §2 **mit den Anforderungen der DSGVO und § 22 BDSG vereinbar**.

Eine erneute DSFA ist erforderlich, wenn:
- KI-Modelle ausgetauscht werden (z. B. Anbieterwechsel von Azure auf US-only Provider)
- Neue Datenkategorien eingeführt werden (z. B. genetische Daten, biometrische Auth, Signaturdynamik statt Rasterbild)
- Geschäftsmodell sich grundlegend ändert (z. B. Anbindung an gesetzliche Krankenkassen direkt)

| Verantwortlicher | Unterschrift | Datum |
|---|---|---|
| Yavuz Kemal Demir, InfinityMade | _______ | 2026-06-08 |
