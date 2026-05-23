# Verzeichnis von Verarbeitungstätigkeiten (VVT)

**Art. 30 DSGVO — Verzeichnis nach Verarbeitungstätigkeiten des Verantwortlichen / Auftragsverarbeiters**

| | |
|---|---|
| **Verantwortliche Stelle** | InfinityMade (Einzelunternehmen) |
| **Inhaber / DSB** | [Inhaber Name], ironkemal5@gmail.com |
| **Adresse** | [Geschäftsadresse einfügen] |
| **Aufsichtsbehörde** | Landesbeauftragter für Datenschutz NRW |
| **Letzte Aktualisierung** | 2026-05-23 |
| **Version** | 1.0 |

InfinityMade tritt **doppelt** in Erscheinung:
- als **Verantwortlicher** für eigene Geschäftskunden-Daten (B2B-Stammdaten, Login, Abrechnung)
- als **Auftragsverarbeiter** im Auftrag der angeschlossenen Praxen für deren Patient*innen-Daten

---

## Verarbeitung 1 — B2B Kundenkonto (Praxisinhaber)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Kontoverwaltung & Vertragsabwicklung Praxiskunden |
| **Rolle** | Verantwortlicher |
| **Zwecke** | Vertragserfüllung, Rechnungsstellung, Support, Produktverbesserung |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertrag); lit. f (berechtigtes Interesse — Produktstats) |
| **Datenkategorien** | Name, E-Mail, Telefon, Geschäftsname, Adresse, Sektor, IK-Nummer, Stripe-Kunden-ID, IP, Login-Zeitstempel |
| **Betroffene** | Geschäftsinhaber, Mitarbeiter mit eigenem Login |
| **Empfänger** | Stripe Payments Europe (EU, AVV), Vercel (DPF-zertifiziert, EU-Region), Supabase Frankfurt |
| **Drittland-Übermittlung** | Stripe verarbeitet primär in EU; Sub-Prozessoren in USA über SCC |
| **Speicherdauer** | Vertragslaufzeit + 10 Jahre (§ 147 AO Buchhaltungspflicht) |
| **Löschkonzept** | Nach Vertragsende: Stammdaten anonymisiert; Buchhaltungsrelevante Daten 10 Jahre archiviert |
| **TOM-Verweis** | siehe TOM.md §1, §2, §4 |

## Verarbeitung 2 — Patient*innen-Stammdaten (im Auftrag)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Patientenverwaltung & Terminbuchung |
| **Rolle** | Auftragsverarbeiter (gem. AVV mit Praxis) |
| **Zwecke** | Terminbuchung, Behandlungsdokumentation, Rezept-Verwaltung — ausschließlich nach Weisung des Verantwortlichen |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b + Art. 9 Abs. 2 lit. h DSGVO (Gesundheitsversorgung) — durch den Verantwortlichen |
| **Datenkategorien** | Name, Geburtsdatum, Kontakt, **Versichertennummer (KVNR)**, **Versichertenstatus**, Adresse |
| **Besondere Kategorien (Art. 9)** | ja — Gesundheitsdaten (siehe Verarbeitung 3) |
| **Betroffene** | Patient*innen der angeschlossenen Praxen |
| **Empfänger** | Keine — Daten verbleiben in der Mandantenisolation des Verantwortlichen |
| **Drittland-Übermittlung** | Keine |
| **Speicherdauer** | Nach Weisung des Verantwortlichen, max. gesetzliche Aufbewahrung Heilberufe (10 Jahre) |
| **Löschkonzept** | Praxis löscht über Dashboard; Auftragsverarbeiter führt Löschung binnen 30 Tagen aus |
| **TOM-Verweis** | siehe TOM.md §3, §5, §6 |

## Verarbeitung 3 — Gesundheitsdaten (Rezepte / Verordnungen / Abrechnung)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Heilmittel-Abrechnung nach § 302 SGB V |
| **Rolle** | Auftragsverarbeiter |
| **Zwecke** | EDIFACT-Dateierstellung für DMRZ, OCR-gestützte Datenerfassung aus Verordnungen, Diagnose-Plausibilitätsprüfung |
| **Rechtsgrundlage** | Art. 9 Abs. 2 lit. h + § 22 Abs. 1 Nr. 1 lit. b BDSG (Gesundheitsvorsorge) |
| **Datenkategorien** | ICD-10-Diagnose, Diagnosetext, Diagnosegruppe, Heilmittel-Positionsnummern, Verordnungsart, Leitsymptomatik, Therapiefrequenz, Behandlungssitzungen mit Datum |
| **Betroffene** | Patient*innen |
| **Empfänger** | Microsoft Azure OpenAI (Region Sweden Central, EU) — nur für OCR/Strukturierung mit Zero-Data-Retention-Vertrag; Datenannahmestelle (DMRZ o.ä.) als gesetzlich vorgesehener Empfänger |
| **Drittland-Übermittlung** | Keine (Azure Sweden Central = EU) |
| **Speicherdauer** | Behandlung + 10 Jahre (Heilberufe-Aufbewahrung); EDIFACT-Rohfiles 90 Tage nach Annahme-Bestätigung durch DMRZ, dann automatisch gelöscht |
| **TOM-Verweis** | siehe TOM.md §3, §5, §7 |

## Verarbeitung 4 — Server-Logs / Audit

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Sicherheits- und Zugriffsprotokollierung |
| **Rolle** | Verantwortlicher (Server-Logs) bzw. Auftragsverarbeiter (Patient-Access-Logs) |
| **Zwecke** | Missbrauchserkennung, Datensicherheit, Nachweispflicht (Art. 5 Abs. 2 DSGVO Rechenschaftspflicht) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f DSGVO; Art. 32 DSGVO |
| **Datenkategorien** | IP, User-Agent, User-ID, Endpunkt, Zeitstempel, HTTP-Status |
| **Betroffene** | Alle Systemnutzer |
| **Speicherdauer** | Server-Access-Logs 14 Tage; Audit-Trail Patient-Zugriff 12 Monate; AI-Aufrufprotokoll 24 Monate |

---

## Auftragsverarbeiter / Sub-Prozessoren

| Anbieter | Zweck | Sitz / Region | AVV vorhanden | Drittland |
|---|---|---|---|---|
| Supabase Inc. | Datenbank, Auth, Storage | EU (Frankfurt) | ✅ | nein |
| Microsoft Azure | OCR, KI-Strukturierung Verordnungen | EU (Sweden Central) | ✅ + ZDR | nein |
| Hetzner Online GmbH | VPS für Calendar-API & n8n | DE (Falkenstein) — ISO 27001 | ✅ | nein |
| Vercel Inc. | Frontend-Hosting | EU + DPF-zertifiziert | ✅ | (USA via DPF) |
| Stripe Payments Europe | Zahlungsabwicklung | EU (Irland) | ✅ | (USA via SCC + DPF) |
| Resend (geplant) | Transaktions-E-Mails | EU | ⏳ vor Live | nein |
| Google LLC | OAuth + Calendar (nur opt-in) | DPF-zertifiziert | (Google Workspace DPA) | (USA via DPF) |

Alle Sub-Prozessoren sind im AVV (DPA.html) aufgeführt; Änderungen werden 30 Tage vor Inkrafttreten kommuniziert.
