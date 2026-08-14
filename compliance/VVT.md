# Verzeichnis von Verarbeitungstätigkeiten (VVT)

**Art. 30 DSGVO — Verzeichnis nach Verarbeitungstätigkeiten des Verantwortlichen / Auftragsverarbeiters**

| | |
|---|---|
| **Verantwortliche Stelle** | InfinityMade (Einzelunternehmen) |
| **Inhaber / DSB** | Yavuz Kemal Demir, ironkemal5@gmail.com |
| **Adresse** | Industriestraße 33, 53721 Siegburg, Deutschland |
| **Aufsichtsbehörde** | Landesbeauftragter für Datenschutz NRW |
| **Letzte Aktualisierung** | 2026-08-14 |
| **Version** | 1.2 |

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

## Verarbeitung 5 — Einwilligungserfassung (digitale Patienten-Einwilligung)

| Feld | Inhalt |
|---|---|
| **Bezeichnung** | Erfassung und Nachweis von Patienten-Einwilligungen mit elektronischer Unterschrift |
| **Rolle** | Auftragsverarbeiter (im Auftrag der Praxis) |
| **Zwecke** | Nachweis der Behandlungs-Einwilligung (§ 630d BGB) und der datenschutzrechtlichen Einwilligung (Art. 7 Abs. 1 DSGVO Nachweispflicht) |
| **Rechtsgrundlage** | Behandlungsteil: Art. 6 Abs. 1 lit. b i. V. m. Art. 9 Abs. 2 lit. h DSGVO, § 630d BGB. Datenschutzteil: Art. 6 Abs. 1 lit. a i. V. m. Art. 9 Abs. 2 lit. a DSGVO. Nachweisspeicherung: Art. 7 Abs. 1 DSGVO, § 630f BGB |
| **Datenkategorien** | Patienten-ID, unterschriebener Name, Unterschrift als **Rasterbild (PNG)**, Volltext-Snapshot der Erklärung, Textversion, SHA-256-Prüfsumme, Zeitstempel, erfassender Nutzer, grobe Gerätebezeichnung (Plattform + Bildschirmauflösung), ggf. Widerrufszeitpunkt und -grund |
| **Ausdrücklich NICHT erhoben** | **IP-Adresse** — bei einer Unterschrift von Angesicht zu Angesicht auf dem Praxis-Tablet ist die IP der Praxisrouter; der Beweiswert ist null, die Erhebung daher ein Verstoß gegen Art. 5 Abs. 1 lit. c (Datenminimierung). Das Muster aus `consent_log` wird bewusst nicht übernommen. — **Signaturdynamik** (Druck, Geschwindigkeit, Strichzeiten): nicht erhoben, damit das Rasterbild kein biometrisches Datum i. S. v. Art. 4 Nr. 14 DSGVO wird |
| **Betroffene** | Patient*innen der angeschlossenen Praxen |
| **Empfänger** | Keine externen Empfänger. Speicherung Supabase Frankfurt (Tabelle `patient_consents`, privater Storage-Bucket `patient-documents`) |
| **Drittland-Übermittlung** | Keine |
| **Speicherdauer** | 10 Jahre ab Unterschrift (§ 630f Abs. 3 BGB, zusammen mit der Behandlungsdokumentation) |
| **Löschkonzept** | Löschung vor Fristablauf ist per DB-Trigger `trg_patient_consents_immutable` blockiert; derselbe Trigger verhindert nachträgliche Änderungen am Nachweis. Nach Fristablauf Löschung zusammen mit der Patientenakte |
| **Widerruf** | Art. 7 Abs. 3 DSGVO: die Datenschutz-Einwilligung ist jederzeit formlos widerruflich, der Widerrufsweg steht im unterschriebenen Text. Ein Widerruf **löscht den Nachweis nicht**, er markiert ihn (`revoked_at`). Die Behandlungs-Einwilligung nach § 630d BGB ist davon getrennt erfasst — Kopplung beider Wäre ein Verstoß gegen das Koppelungsverbot |
| **TOM-Verweis** | siehe TOM.md § 1.2, § 1.3, § 2.1 |

---

## Auftragsverarbeiter / Sub-Prozessoren

| Anbieter | Zweck | Sitz / Region | AVV vorhanden | Drittland |
|---|---|---|---|---|
| Supabase Inc. | Datenbank, Auth, Storage | EU (Frankfurt) | ✅ | nein |
| Microsoft Azure | OCR, KI-Strukturierung Verordnungen | EU (Sweden Central) | ✅ + ZDR | nein |
| Hetzner Online GmbH | VPS für Calendar-API & n8n | DE (Falkenstein) — ISO 27001 | ✅ | nein |
| Vercel Inc. | Frontend-Hosting | EU + DPF-zertifiziert | ✅ | (USA via DPF) |
| Stripe Payments Europe | Zahlungsabwicklung | EU (Irland) | ✅ | (USA via SCC + DPF) |
| GoDaddy (Mailhosting `praxura.de`) | Transaktions-E-Mails über SMTP (nodemailer) sowie Supabase-Auth-Mails | ⚠️ **offen** | ⚠️ **offen** | ⚠️ **zu prüfen** |
| Google LLC | OAuth + Calendar (nur opt-in) | DPF-zertifiziert | (Google Workspace DPA) | (USA via DPF) |

> **Korrektur 14.08.2026:** In diesem Verzeichnis stand bis dahin „Resend (geplant) — Transaktions-E-Mails". **Resend wird nicht eingesetzt und ist nicht vorgesehen.** Der Versand läuft über `nodemailer` gegen den SMTP-Server des Mailhostings (`SMTP_HOST`/`SMTP_USER`, siehe `api/contact.js`); belegt in `ONPREM_MIGRATION_PLAYBOOK.md` und `ON_PREMISE_ANALYSE.md`. Ein Verzeichnis, das einen nicht existierenden Auftragsverarbeiter nennt und den tatsächlichen verschweigt, ist nach Art. 30 unvollständig — deshalb korrigiert.
>
> **Offener Punkt:** Für das Mailhosting liegen AVV-Status, Sitz der vertragspartnerischen Gesellschaft und Drittlandbewertung noch nicht geprüft vor. Das ist vor Go-Live zu klären und im AVV (DPA.html) nachzuführen.

### Nicht-Auftragsverarbeiter: entfallene CDN-Abrufe (14.08.2026)

`esm.sh` und `cdn.jsdelivr.net` lieferten bis 14.08.2026 **Programmbibliotheken** an den Browser der Praxis (kein Zugriff auf Patientendaten, aber Übermittlung der IP-Adresse und potenzieller Codeausführungskontext). Sie waren **nie** als Auftragsverarbeiter geführt.

Die richtige Antwort war nicht, sie nachzutragen, sondern die Abrufe **abzustellen**: Die Bibliotheken werden seit 14.08.2026 von der eigenen Domain ausgeliefert, die Content-Security-Policy sperrt beide Hosts. Damit entfällt der Übermittlungsvorgang; ein AVV bzw. Garantien nach Art. 44 ff. werden für sie gegenstandslos. Einzelheiten: TOM.md § 2.3, DSFA.md R14/R15.

Verbleibende externe Abrufe im Anwendungskontext — Sentry-Loader, Cropper.js (cdnjs), Google Fonts — sind als Aufgaben erfasst; Stripe (`js.stripe.com`) bleibt aus PCI-DSS-Gründen bewusst extern.

Alle Sub-Prozessoren sind im AVV (DPA.html) aufgeführt; Änderungen werden 30 Tage vor Inkrafttreten kommuniziert.
