# Auftragsverarbeitungsvertrag (AVV)

**gemäß Art. 28 DSGVO**

> **ENTWURF — rechtliche Prüfung erforderlich**
> Dieses Dokument ist ein internes Arbeitsdokument und ersetzt keine anwaltliche Beratung. Vor Einsatz gegenüber Kunden ist eine rechtliche Prüfung durch einen auf Datenschutzrecht spezialisierten Rechtsanwalt erforderlich.

| | |
|---|---|
| **Version** | 1.0 (Entwurf) |
| **Stand** | 2026-06-08 |
| **Bezug** | VVT.md, DSFA.md, TOM.md |

---

## Vertragsparteien

**Auftraggeber (Verantwortlicher i. S. d. Art. 4 Nr. 7 DSGVO):**

Name / Praxisname: ___________________________________
Anschrift: ___________________________________
Vertreten durch: ___________________________________
(nachfolgend: **„Auftraggeber"**)

**Auftragnehmer (Auftragsverarbeiter i. S. d. Art. 4 Nr. 8 DSGVO):**

Yavuz Kemal Demir
InfinityMade (Einzelunternehmen)
Industriestraße 33
53721 Siegburg
Deutschland
E-Mail: kontakt@infinitymade.de
(nachfolgend: **„Auftragnehmer"**)

---

## § 1 Gegenstand und Dauer der Verarbeitung

### 1.1 Gegenstand

Der Auftragnehmer erbringt für den Auftraggeber Leistungen im Rahmen der SaaS-Plattform **Praxura** (Produkt der InfinityMade), insbesondere:

- Online-Terminbuchungssystem für Praxispatienten
- Verwaltung von Patientenstammdaten und Verordnungen
- KI-gestützte OCR-Erkennung von Heilmittelverordnungen
- Erstellung von § 302 SGB V Abrechnungsdateien (EDIFACT) für Datenannahmestellen
- Personalverwaltung (Mitarbeiterzugänge, Dienstpläne)

Der Auftragnehmer verarbeitet hierfür personenbezogene Daten ausschließlich im Auftrag und nach dokumentierter Weisung des Auftraggebers.

### 1.2 Dauer

Dieser Vertrag gilt ab dem Datum der Unterzeichnung und endet mit der Beendigung des Hauptvertrags über die Nutzung der Praxura-Plattform. Die Regelungen zur Löschung nach Vertragsende (§ 8) bleiben nach Vertragsende in Kraft.

---

## § 2 Art und Zweck der Verarbeitung

### 2.1 Art der Verarbeitung

Erhebung, Speicherung, Veränderung, Abfrage, Verwendung, Übermittlung, Verknüpfung, Einschränkung und Löschung personenbezogener Daten in automatisierter Form über die Praxura-Plattform und die zugrundeliegenden technischen Systeme (Supabase PostgreSQL, Node.js Backend-API, Microsoft Azure OpenAI).

### 2.2 Zweck

Die Verarbeitung erfolgt ausschließlich zur Erbringung der in § 1.1 genannten Dienstleistungen. Eine Verarbeitung für eigene Zwecke des Auftragnehmers — insbesondere Profilbildung, Werbung oder Weitergabe an Dritte — findet nicht statt.

---

## § 3 Art der personenbezogenen Daten und Kategorien betroffener Personen

### 3.1 Kategorien betroffener Personen

- **Patienten** der Praxis des Auftraggebers
- **Mitarbeiter** des Auftraggebers (Therapeuten, Rezeptionskräfte)

### 3.2 Kategorien personenbezogener Daten

**Patientenstammdaten:**
- Name, Geburtsdatum, Anschrift, Telefon, E-Mail
- Krankenversicherungsnummer (KVNR), Versichertenstatus, Kostenträgername und IK-Nummer

**Gesundheitsdaten (Art. 9 DSGVO — besondere Kategorie):**
- ICD-10-Diagnose, Diagnosetext, Leitsymptomatik, Diagnosegruppe
- Heilmittel-Positionsnummern, Verordnungsart, Therapiefrequenz
- Behandlungssitzungen mit Datum und Dauer
- Therapieberichte und therapeutische Notizen (soweit im System hinterlegt)
- EDIFACT-Abrechnungsdaten nach § 302 SGB V

**Mitarbeiterdaten:**
- Name, E-Mail-Adresse, Rolle/Funktion, Arbeitszeitdaten

### 3.3 Rechtsgrundlage des Auftraggebers

Der Auftraggeber stellt sicher, dass die Verarbeitung der Gesundheitsdaten auf Art. 9 Abs. 2 lit. h DSGVO i. V. m. § 22 Abs. 1 Nr. 1 lit. b BDSG (Gesundheitsversorgung) sowie auf Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) gestützt ist.

---

## § 4 Pflichten und Rechte des Verantwortlichen (Auftraggeber)

### 4.1 Weisungsrecht

Der Auftraggeber ist allein weisungsbefugt hinsichtlich der Verarbeitung der ihm zuzurechnenden personenbezogenen Daten. Weisungen erteilt der Auftraggeber schriftlich (E-Mail an support@infinitymade.de oder über das Dashboard). Mündliche Weisungen sind unverzüglich schriftlich zu bestätigen.

### 4.2 Pflichten des Auftraggebers

Der Auftraggeber ist verpflichtet:

1. Vor der Beauftragung und regelmäßig während der Laufzeit die Einhaltung der datenschutzrechtlichen Anforderungen beim Auftragnehmer zu prüfen und die Ergebnisse zu dokumentieren (Art. 28 Abs. 1 DSGVO).
2. Alle Weisungen zur Datenverarbeitung vor deren Erteilung auf ihre datenschutzrechtliche Zulässigkeit zu prüfen.
3. Den Auftragnehmer unverzüglich zu informieren, wenn er Fehler oder Unregelmäßigkeiten bei der Verarbeitung personenbezogener Daten feststellt.
4. Betroffenenrechte (Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch) selbst gegenüber den betroffenen Personen zu erfüllen, soweit dies im Dashboard möglich ist. Bei Unterstützungsbedarf gilt § 5.5.

---

## § 5 Pflichten des Auftragsverarbeiters (Art. 28 Abs. 3 DSGVO)

### 5.1 Weisungsgebundenheit

Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich nach dokumentierter Weisung des Auftraggebers, sofern er nicht durch das Unionsrecht oder das Recht eines Mitgliedstaats, dem der Auftragnehmer unterliegt, zur Verarbeitung verpflichtet ist. In einem solchen Fall teilt der Auftragnehmer dem Auftraggeber diese rechtlichen Anforderungen vor der Verarbeitung mit, sofern das betreffende Recht eine solche Mitteilung nicht aus wichtigen Gründen des öffentlichen Interesses verbietet.

Hält der Auftragnehmer eine Weisung für unzulässig, teilt er dies dem Auftraggeber unverzüglich mit.

### 5.2 Verschwiegenheitspflicht

Der Auftragnehmer stellt sicher, dass sich alle zur Verarbeitung der personenbezogenen Daten befugten Personen zur Vertraulichkeit verpflichtet haben oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen.

### 5.3 Technische und organisatorische Maßnahmen

Der Auftragnehmer trifft alle erforderlichen technischen und organisatorischen Maßnahmen gemäß Art. 32 DSGVO. Die konkreten Maßnahmen sind in **Anhang 2 (TOM.md)** beschrieben, der Bestandteil dieses Vertrags ist.

### 5.4 Unterauftragsverarbeiter

Die Hinzuziehung weiterer Auftragsverarbeiter (Unterauftragnehmer) ist nur mit vorheriger schriftlicher Genehmigung des Auftraggebers zulässig. Die zum Zeitpunkt des Vertragsschlusses genehmigten Unterauftragsverarbeiter sind in § 6 aufgeführt; der Auftraggeber erteilt mit Unterzeichnung dieses Vertrags seine Genehmigung für diese. Neue Unterauftragnehmer werden dem Auftraggeber mindestens 30 Tage vor Inbetriebnahme mitgeteilt; der Auftraggeber kann innerhalb dieser Frist Widerspruch einlegen.

### 5.5 Unterstützung bei Betroffenenrechten

Der Auftragnehmer unterstützt den Auftraggeber mit geeigneten technischen und organisatorischen Maßnahmen soweit möglich dabei, seinen Pflichten zur Beantwortung von Betroffenenanfragen (Art. 15–22 DSGVO) nachzukommen. Soweit eine Betroffenenanfrage direkt beim Auftragnehmer eingeht, leitet er diese unverzüglich an den Auftraggeber weiter.

### 5.6 Unterstützung bei Compliance-Pflichten

Der Auftragnehmer unterstützt den Auftraggeber bei der Einhaltung der in Art. 32–36 DSGVO genannten Pflichten (Datensicherheit, Meldung von Datenpannen, Datenschutz-Folgenabschätzung, vorherige Konsultation), unter Berücksichtigung der Art der Verarbeitung und der dem Auftragnehmer zur Verfügung stehenden Informationen.

### 5.7 Meldung von Datenpannen

Der Auftragnehmer informiert den Auftraggeber unverzüglich — und in jedem Fall innerhalb von **24 Stunden** nach Bekanntwerden — über Verletzungen des Schutzes personenbezogener Daten, die Daten des Auftraggebers betreffen. Die Meldung enthält mindestens die in Art. 33 Abs. 3 DSGVO genannten Informationen, soweit diese zu diesem Zeitpunkt vorliegen.

### 5.8 Kontroll- und Prüfungsrecht

Der Auftraggeber ist berechtigt, die Einhaltung dieses Vertrags und der einschlägigen Datenschutzvorschriften beim Auftragnehmer zu überprüfen. Der Auftragnehmer stellt dem Auftraggeber alle erforderlichen Informationen zum Nachweis der Einhaltung seiner Pflichten gemäß Art. 28 DSGVO zur Verfügung und ermöglicht Audits — auch durch beauftragte Dritte — sowie Inspektionen. Audits sind dem Auftragnehmer mindestens **14 Tage** im Voraus schriftlich anzukündigen und dürfen den laufenden Betrieb nicht unverhältnismäßig beeinträchtigen.

---

## § 6 Unterauftragsverarbeiter

Folgende Unterauftragsverarbeiter sind zum Zeitpunkt des Vertragsschlusses im Einsatz; der Auftraggeber erteilt mit Unterzeichnung seine Genehmigung:

| Anbieter | Zweck | Sitz / Verarbeitungsort | Drittlandtransfer | Rechtsgrundlage Transfer |
|---|---|---|---|---|
| **Supabase Inc.** | Datenbank (PostgreSQL), Authentifizierung, Dateispeicher | EU (Frankfurt, AWS eu-central-1) | nein | — |
| **Hetzner Online GmbH** | VPS-Hosting für Backend-API und n8n-Workflows | DE (Falkenstein) — ISO 27001 | nein | — |
| **Microsoft Azure (OpenAI)** | KI-gestützte OCR/Strukturierung von Verordnungen | EU (Sweden Central) — Zero-Data-Retention | nein | — |
| **Stripe Payments Europe Ltd.** | Zahlungsabwicklung (Abrechnungsdaten des Auftraggebers, keine Patientendaten) | EU (Irland) | (USA, Sub-Prozessoren) | EU-SCC + DPF |
| **Vercel Inc.** | Frontend-Hosting (statische Dateien, keine Patientendaten) | EU-Edge + USA | (USA) | DPF-zertifiziert |
| **Google LLC** | OAuth-Authentifizierung + Google Calendar (nur bei opt-in durch Auftraggeber) | USA | ja | Google Workspace DPA + EU-SCC |

Der Auftragnehmer schließt mit jedem Unterauftragsverarbeiter einen Vertrag ab, der diesem die gleichen datenschutzrechtlichen Pflichten auferlegt wie dieser Vertrag dem Auftragnehmer (Art. 28 Abs. 4 DSGVO). Bestehende Vereinbarungen mit Unterauftragsverarbeitern liegen zur Einsicht bereit.

---

## § 7 Technische und organisatorische Maßnahmen

Die vom Auftragnehmer getroffenen technischen und organisatorischen Maßnahmen gemäß Art. 32 DSGVO sind in **Anhang 2 (TOM.md)** vollständig beschrieben. Anhang 2 ist Bestandteil dieses Vertrags.

Wesentliche Maßnahmen im Überblick:

- **Verschlüsselung** in der Übertragung: TLS 1.2/1.3 auf allen Endpunkten, HSTS-Header
- **Zugriffskontrolle**: PostgreSQL Row Level Security (RLS) — mandantenisolierte Datentrennung
- **Pseudonymisierung**: PII-Masking vor KI-Übertragung (Namen, KVNR, Geburtsdatum)
- **Verfügbarkeit**: Tägliche Backups + Point-in-Time-Recovery (Supabase Pro), VPS-Snapshots (7 Tage)
- **Belastbarkeit**: Rate Limiting, CDN, DoS-Schutz
- **Überprüfung**: Vierteljährliche RLS-Audits, TLS-Assessment (Ziel A+)

Änderungen der TOM, die das Datenschutzniveau der verarbeiteten Daten des Auftraggebers verringern, bedürfen der vorherigen schriftlichen Zustimmung des Auftraggebers.

---

## § 8 Löschung nach Vertragsende

Nach Beendigung der Hauptvertragsbeziehung hat der Auftragnehmer — nach Wahl des Auftraggebers — alle personenbezogenen Daten des Auftraggebers entweder **zurückzugeben** (Export via Dashboard in maschinenlesbarem Format, CSV/JSON) oder **zu löschen**, soweit keine gesetzliche Pflicht zur Aufbewahrung besteht.

Die Löschung ist nach folgendem Zeitplan durchzuführen:

| Datenkategorie | Löschfrist nach Vertragsende |
|---|---|
| Patientenstammdaten | Unverzüglich auf Anfrage; spätestens 30 Tage nach Vertragsende |
| Gesundheitsdaten / Verordnungen | Gemäß Weisung des Auftraggebers; max. gesetzliche Aufbewahrungsfrist Heilberufe (10 Jahre) |
| EDIFACT-Rohdateien | 90 Tage nach DMRZ-Bestätigung |
| Mitarbeiterdaten des Auftraggebers | 30 Tage nach Vertragsende |
| Server-Logs mit Personenbezug | 14 Tage (automatisch durch Logrotate) |
| Rechnungs-/Abrechnungsunterlagen | 10 Jahre (§ 147 AO, § 14 UStG) |

Die Vernichtung ist dem Auftraggeber schriftlich zu bestätigen. Unterauftragsverarbeiter werden zur entsprechenden Löschung innerhalb der gleichen Frist verpflichtet.

---

## § 9 Haftung

### 9.1 Haftungsrahmen

Jede Partei haftet für Verstöße gegen dieses Vertrag und die einschlägigen Datenschutzvorschriften nach Maßgabe der Art. 82 und 83 DSGVO sowie der allgemeinen zivilrechtlichen Regelungen.

### 9.2 Haftungsverteilung

Der Auftragnehmer ist von der Haftung gemäß Art. 82 Abs. 2 DSGVO befreit, wenn er nachweist, dass er für den Umstand, durch den der Schaden eingetreten ist, nicht verantwortlich ist. Insbesondere haftet der Auftragnehmer nicht für Schäden, die durch eine Weisung des Auftraggebers entstanden sind, gegen deren Rechtswidrigkeit der Auftragnehmer vorher schriftlich Einwände erhoben hat.

### 9.3 Haftungsbeschränkung

Die Haftung des Auftragnehmers für mittelbare Schäden, entgangenen Gewinn, Umsatzausfälle oder Folgeschäden ist — soweit gesetzlich zulässig — auf den Betrag begrenzt, den der Auftraggeber in den letzten 12 Monaten vor dem schadensbegründenden Ereignis an den Auftragnehmer gezahlt hat, maximal jedoch 10.000 EUR pro Schadensfall.

---

## Anhänge

- **Anhang 1** — Weisungsformular (kann formlos per E-Mail an support@infinitymade.de erteilt werden)
- **Anhang 2** — Technische und Organisatorische Maßnahmen (TOM.md)

---

## Unterschriften

**Auftraggeber (Verantwortlicher):**

Ort, Datum: ___________________________________

Name: ___________________________________

Unterschrift: ___________________________________

---

**Auftragnehmer (Auftragsverarbeiter):**

Siegburg, den ___________________________________

Yavuz Kemal Demir
InfinityMade

Unterschrift: ___________________________________

---

*ENTWURF — rechtliche Prüfung erforderlich | Stand: 2026-06-08 | Version 1.0*
