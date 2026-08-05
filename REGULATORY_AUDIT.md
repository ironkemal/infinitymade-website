# Praxura — Regulatorische Landminen-Audit
**Stand: Juni 2026 | Budget-Kontext: €100–200/Monat | Zielgruppe: Physio/Ergo/Logo/Podo in DE**

---

## TOP-5-SOFORTRISIKEN (Zusammenfassung)

| Rang | Landmine | Severity | Zeitkritisch |
|------|----------|----------|--------------|
| 1 | **§393 SGB V / BSI C5-Testat** | 🔴 | Retroaktiv seit Juli 2025 |
| 2 | **MDR / EU AI Act** bei AI-Features | 🔴 | Vor jedem klinischen Feature-Launch |
| 3 | **n8n Sustainable Use License** | 🟠 | Sofort prüfen |
| 4 | **Externer DSB + DSFA-Update** | 🟠 | Binnen 30 Tagen |
| 5 | **ITSG/dakota §302 Integration** | 🟠 | Vor erstem Live-Abrechnungskunden |

---

## LANDMINE 1: BSI C5-Testat nach §393 SGB V

**Severity: 🔴 IMMEDIATE BLOCKER**

### Was passiert ist

Das Digitalgesetz (DigiG) hat am 25. März 2024 §393 SGB V in Kraft gesetzt. Seit **1. Juli 2025** ist ein **BSI C5 Typ-2-Testat** zwingend für alle Cloud-Computing-Dienste, die Gesundheits- oder Sozialdaten von GKV-Leistungserbringern verarbeiten.

**Praxura ist direkt betroffen:** Heilmittelerbringer fallen explizit unter SGB V Kapitel 4. Praxura verarbeitet deren Patientendaten (Buchungen, Rezepte) in Supabase/Vercel/Hetzner-VPS.

### Kosten (ohne Übergangslösung)

- Gap-Analyse: €5.000–25.000
- ISMS-Aufbau: €20.000–60.000
- C5 Typ-2-Testat (Wirtschaftsprüfer): €40.000–120.000
- **Gesamtkosten ohne ISMS: >€200.000** — für ein Startup mit €100–200/Monat Budget existenzbedrohend

### Übergangslösung (wichtig!)

Die **C5-Gleichwertigkeitsverordnung** erlaubt temporär als Ersatz:
- **ISO/IEC 27001:2022-Zertifizierung** (ca. €15.000–40.000 einmalig)
- Bedingung: Lücken zum C5-Typ2 dokumentieren + Plan zur Schließung in 24 Monaten
- Innerhalb von 24 Monaten echtes C5-Typ2-Testat vorlegen (Auditorvertrag abgeschlossen)

### Kostenhebel: AWS-Scope-Reduktion

Supabase nutzt **AWS eu-central (Frankfurt)** — AWS hat selbst ein C5 Typ-2-Testat. Das bedeutet: Die Infrastrukturschicht ist bereits zertifiziert. Praxura muss nur die **eigene Applikationsschicht** zertifizieren lassen → Kosten signifikant niedriger.

**Sofortmaßnahme:** Prüfen, ob Supabase (AWS Frankfurt) und Vercel eigene C5-Testats haben. Falls ja: Scope der eigenen Zertifizierung auf Applikationsschicht reduzieren → ISO 27001 als Übergangslösung realistisch für €15.000–25.000.

**Bußgeldrisiko bei Nichtbeachtung:** Vertragsunfähigkeit mit Leistungserbringern + DSGVO-Bußgelder bis 4% Jahresumsatz.

---

## LANDMINE 2: MDR (EU Medical Device Regulation 2017/745) + EU AI Act

**Severity: 🔴 Feature-abhängig**

### Grundregel: Wann wird Software zum Medizinprodukt?

Nach MDCG 2019-11 Rev.1: Software ist Medizinprodukt (MDSW), wenn sie eine **medizinische Zweckbestimmung** hat (Diagnose, Therapie, Monitoring, Prognose) UND **direkte Patientenentscheidungen** trifft oder unterstützt.

**Kein Medizinprodukt:** Rein administrative/organisatorische Software (Terminverwaltung, Abrechnung).

### Praxura-Feature-Matrix

| Feature | MDR-Status | Risiko |
|---------|-----------|--------|
| Terminverwaltung, Kalender | Kein Medizinprodukt | ✅ Sicher |
| §302-Abrechnung, DTA-Generierung | Kein Medizinprodukt | ✅ Sicher |
| OCR-Rezeptscan zur **Dateneingabe** (Felder befüllen) | Grauzone — nur wenn keine klinische Interpretation | 🟡 Niedrig wenn richtig positioniert |
| OCR mit Zweckbestimmung "erkennt Diagnose/Behandlungsplanung" | **Klasse IIa MDSW** — MDR-pflichtig | 🔴 HOCH |
| KI-Behandlungsempfehlungen / Decision Support | **Klasse IIa oder IIb** | 🔴 SEHR HOCH |

### Kosten wenn MDR greift (Klasse IIa)

- Benannte Stelle (kein Self-Declaration)
- Zertifizierung: ca. €30.000–35.000 Erstzertifizierung + jährliche Überwachung
- Zeitaufwand: 6–12 Monate
- ISO 13485 QMS erforderlich

### Sofortmaßnahme für bestehende OCR-Funktion

**In Produktdokumentation, Marketing-Texten und Code-Kommentaren explizit festhalten:**
> "Praxuras OCR-Funktion ist ein Verwaltungstool zur Dateneingabe ohne medizinische Zweckbestimmung."

**Verbotene Formulierungen:**
- "KI erkennt Diagnose"
- "Optimiert Behandlungsplan"
- "Klinische Entscheidungsunterstützung"

### EU AI Act (vollständig anwendbar ab August 2026)

AI-basierte Medizinprodukte (MDAI) müssen BEIDE Regulierungen erfüllen: MDR **und** AI Act.

**Escape-Hatch:** Praxuras AI-OCR kann AI-Act-konform bleiben, wenn es explizit als "nicht-Hochrisiko" nach Art. 6(3) schriftlich begründet wird (warum kein signifikantes Risiko für Gesundheitsentscheidungen besteht).

---

## LANDMINE 3: n8n Sustainable Use License

**Severity: 🟠 Sofort klären**

### Das Problem

n8n läuft unter der "Sustainable Use License" (nicht MIT/Apache). Kerneinschränkung:

> "You may use or modify the software only for your own **internal business purposes** [...] you may distribute the software or provide it to others only if you do so **free of charge for non-commercial purposes**."

**Erlaubt:** n8n intern für eigene Prozesse (Azure-Routing, interne Webhooks).

**Verboten:** n8n als White-Label-Automation-Tool für zahlende Kunden bereitstellen, oder wenn Automation-Kapazität Teil des verkauften Produktwerts ist.

**Konkrete Prüffrage:** Wenn Praxura Kunden-facing Funktionen (z.B. automatische SMS-Erinnerungen) via n8n-Workflows ausführt — das könnte als "providing n8n as a hosted service" gelten → **lizenzwidrig**.

### Empfehlung

- AI-Features intern auf n8n lassen (OCR-Routing, Azure-Gateway → OK)
- Kunden-facing Automationen (Terminbestätigungen, Erinnerungen) in Express/server.js direkt implementieren
- n8n Enterprise License falls nötig: ab ~€500/Monat → Budget-Killer

---

## LANDMINE 4: Datenschutzbeauftragter (DSB) + DSFA-Update

**Severity: 🟠 Binnen 30 Tagen**

### DSB-Pflicht

Art. 37 Abs. 1 lit. c DSGVO: DSB-Pflicht bei umfangreicher Verarbeitung besonderer Kategorien (Art. 9 DSGVO = Gesundheitsdaten). Bei einem Praxis-SaaS mit Patientenbuchungen, Diagnosen, Rezeptdaten: **DSB wahrscheinlich Pflicht, unabhängig von Mitarbeiterzahl.**

- Kosten externer DSB: **€1.500–4.000/Jahr** (monatlich buchbar)

### DSFA-Pflicht

Eine Datenschutz-Folgenabschätzung ist zwingend bei umfangreicher Verarbeitung von Gesundheitsdaten. Praxura hat laut MEMORY.md bereits eine DSFA durchgeführt (2026-06-10) ✅ — aber: **DSFA muss bei neuen Features neu bewertet werden** (OCR-Update, AI-Features, Patientenportal).

**Was noch fehlt:**
- Verarbeitungsverzeichnis (Art. 30 DSGVO) für alle Verarbeitungen inkl. Supabase/Stripe/Azure
- Azure (OCR): EU-Region prüfen + SCCs vorhanden?
- Muster-Datenschutzhinweise für Praxis-Kunden (die Patienten informieren müssen)

---

## LANDMINE 5: §302 SGB V — ITSG/dakota-Integration

**Severity: 🟠 Vor erstem Live-Abrechnungskunden**

### Aktueller Praxura-Status

Praxura generiert EDIFACT/DTA-Dateien mit Browser-PKCS#7-Signierung. Das ist die Datei-Erstellung — aber **die Übertragung** an Krankenkassen erfordert zwingend die ITSG-Software **dakota.le**.

### Was fehlt

1. **Software-Hersteller-Registrierung** bei ITSG (`dakota@itsg.de`) — Systemuntersuchungsanforderungen klären
2. **Testannahme-Verfahren** mit mindestens einer Krankenkasse (3 Abrechnungsmonate Testdaten) — ohne das kein GKV-Zertifikat
3. **Kostenträgerdatei** (echte IK-Nummern + Datenannahmestellen): Nur über ITSG-Vertrag zugänglich. Praxura nutzt derzeit Mocks mit Duplicate-IK-Bug → muss ersetzt werden

### Kosten

- dakota.le Basislizenz: ~€200 einmalig (für Leistungserbringer)
- Dakota-Zertifikat: €45–60 / 3 Jahre
- Software-Hersteller Systemuntersuchung: Mehrere Tausend Euro (auf Anfrage bei ITSG)
- Kostenträgerdatei-Vertrag: €500–2.000/Jahr

---

## LANDMINE 6: TI-Anbindung — gematik-Zertifizierung

**Severity: 🟡 Watchlist bis 2027, dann 🟠**

### Deadlines (nach Verschiebung)

| Termin | Status |
|--------|--------|
| Ursprünglich 1. Januar 2026 | Verschoben |
| **1. Oktober 2027** | **Aktuell gültiger Pflichttermin** |
| eVO (elektronische Heilmittelverordnung) | Pilot 2027, Pflicht ~2028 |

### Was TI für einen Software-Anbieter bedeutet

- **gematik-Primärsystembestätigung** durchlaufen (Bestätigungsverfahren)
- KIM-Dienst (sichere Arzt-Kommunikation) implementieren
- eHBA-Integration (elektronischer Heilberufsausweis)

**Realistischer Ansatz für ein Startup:** Nicht selbst bauen — **API-Integration mit einem zertifizierten TI-Dienstleister** (z.B. KIM-Anbieter). Kosten: €2.000–10.000/Jahr für API-Zugang.

**Finanzierungspauschale für Praxen:** Heilmittelerbringer erhalten €213,75/Monat für TI-Kosten vom GKV → Zahlungsbereitschaft bei Kunden vorhanden.

### Abmahnrisiko TI-Landing-Page

Praxuras TI-Landing-Page darf keine Versprechen machen, die vor Oktober 2027 nicht erfüllbar sind. **Sofortmaßnahme:** "TI-ready" nur mit Datum-Vorbehalt bewerben ("ab 2027").

---

## LANDMINE 7: TSE (Kassensicherungsverordnung / §146a AO)

**Severity: 🟡 Watchlist — nur bei Barzahlung**

### Aktueller Status

Praxura hat keine Barzahlungsfunktion (Stripe-only). **Derzeit: Keine TSE-Pflicht.**

### Trigger: Bei Einführung von Barzahlung

- TSE-Pflicht sofort (keine Übergangsfristen mehr seit 2023)
- Finanzamt-Registrierungspflicht innerhalb 1 Monat (seit 1. Jan 2025)
- Quittungspflicht mit TSE-Seriennummer
- Bußgeld bei Verstoß: bis **€25.000**

### Kosten (wenn nötig)

Cloud-TSE: ca. **€15/Monat** (Deutsche Fiskal API, Swissbit) — im Budget verkraftbar. Nicht durch Drittanbieter abzudecken, muss in eigene App integriert werden.

**Escape-Hatch:** Wenn "cash payments" nur als manuelle Notiz ohne elektronische Erfassung implementiert → keine TSE-Pflicht. Aber: Sobald das System Kassentransaktionen elektronisch erfasst, greift §146a AO.

---

## LANDMINE 8: GoBD — Tiefenanalyse

**Severity: 🟠 Teilweise noch Lücken**

### Was für Praxura direkt gilt

GoBD gilt für **Praxuras eigene Buchführung** (Stripe-Zahlungen, Rechnungen an Praxen) — nicht für die Buchführung der Kunden-Praxen.

- **Aufbewahrung Buchungsbelege:** 8 Jahre (Bürokratieentlastungsgesetz IV, ab 2025)
- **Aufbewahrung §302-Abrechnungsdaten:** 10 Jahre (§§ 84, 85 SGB X) — auch nach Kündigung eines Kunden
- **Unveränderbarkeit:** Rechnungen nach Versand nur durch Stornierung + Neuausstellung änderbar
- **Betriebsprüfung (Finanzamt):** Kann Z1/Z2/Z3-Zugriff verlangen (direkt, mittelbar, oder IDEA-Export)

### Was noch fehlt

- **Verfahrensdokumentation** (5–20 Seiten, schriftlich — fehlt bei den meisten Startups, häufigstes Angriffsziel)
- **IDEA-Export** für eigene Rechnungsdaten
- Sicherstellen, dass Abrechnungsdaten auch nach Kunden-Kündigung 10 Jahre abrufbar bleiben

---

## LANDMINE 9: KBV-Zertifizierung

**Severity: 🟡 Aktuell kein Blocker**

KBV-Zertifizierung ist **nur für Vertragsarzt-Software** (§332b SGB V) verpflichtend. Für Heilmittelerbringer-Software gilt ITSG statt KBV. **Praxuras Zielgruppe: kein KBV-Blocker.**

Watchlist nur bei zukünftiger Expansion in den Arztpraxis-Markt.

---

## LANDMINE 10: DiGA / DiPA

**Severity: 🟡 Chance + Fallstrick**

Praxura ist eine Praxis-Management-Plattform → **kein DiGA-Kandidat** (DiGA sind Patienten-Apps nach §134a SGB V).

**Fallstrick:** Wenn Patientenportal/App zu "klinisch" positioniert wird, könnte BfArM ungewollte Medizinprodukt-Klassifizierung vornehmen. App-Features müssen klar als "administrativ/organisatorisch" positioniert werden.

---

## LANDMINE 11: Umsatzsteuer / VAT

**Severity: 🟡 Aufklärungsbedarf**

- §4 Nr. 14 UStG (Steuerbefreiung) gilt für **Behandlungsleistungen** der Praxen — **nicht** für Software, die an Praxen verkauft wird
- **Praxura → Praxis:** 19% MwSt. auf Softwareabonnement (B2B)
- Praxen können diese Vorsteuer **nicht** zurückfordern (da selbst steuerbefreit) → Preis ist für Kunden effektiv 19% teurer
- **Kleinunternehmergrenze:** €22.000/Jahr — bei LIVE-Stripe-Umsätzen seit Juni 2026 bald überschritten → Steuerberater konsultieren

---

## LANDMINE 12: Open-Source-Lizenzen

**Severity: 🟠 n8n — sonst grün**

| Komponente | Lizenz | Risiko |
|------------|--------|--------|
| Node.js / Express | MIT | ✅ |
| Supabase JS Client | Apache 2.0 | ✅ |
| Stripe SDK | MIT | ✅ |
| Azure SDK | MIT | ✅ |
| **n8n** | **Sustainable Use License** | 🟠 Siehe Landmine 3 |

**Empfehlung:** `npm audit --licenses` + FOSSA Free Tier regelmäßig ausführen, um AGPL-Abhängigkeiten in der Dependency-Chain aufzudecken.

---

## PRIORISIERTER AKTIONSPLAN

### 🔴 Diese Woche

1. **C5-Testat-Scope klären:** Supabase (AWS Frankfurt) und Vercel auf eigene C5-Testats prüfen. Eigene App-Schicht identifizieren. ISO 27001 als Übergangslösung dokumentieren, Roadmap für 24-Monate C5-Testat festlegen.

2. **MDR-Zweckbestimmung fixieren:** In Produktdokumentation, Marketing und Code explizit verankern: OCR = Verwaltungstool ohne medizinische Zweckbestimmung. Alle klinisch klingenden Formulierungen entfernen.

3. **n8n-Nutzung dokumentieren:** Welche Workflows intern (OK) vs. kunden-facing (prüfen). Kunden-facing Automationen aus n8n heraus in Express-Code verlagern.

### 🟠 Binnen 30 Tagen

4. **Externen DSB beauftragen** (~€150–300/Monat extern). DSFA für OCR/AI-Features aktualisieren. Verarbeitungsverzeichnis nach Art. 30 DSGVO vervollständigen.

5. **ITSG kontaktieren** (`dakota@itsg.de`): Als Software-Hersteller für §302 registrieren. Systemuntersuchungsanforderungen + Kostenträgerdatei-Vertrag klären.

6. **GoBD Verfahrensdokumentation** erstellen (Template bei Steuerberater).

### 🟡 Binnen 90 Tagen

7. **ISO 27001-Readiness Assessment** beauftragen (Übergangslösung für C5).

8. **AGB/Impressum** von Healthcare-IT-Anwalt prüfen lassen (€800–2.000 einmalig).

9. **TI-Landing-Page** mit Datum-Vorbehalt versehen ("Oktober 2027"), Abmahnrisiko minimieren.

---

## KOSTENSCHÄTZUNG (12 Monate)

| Maßnahme | Einmalig | Jährlich |
|----------|----------|---------|
| Externer DSB | — | €1.800–3.600 |
| DSFA Update (neue Features) | €500–1.500 | — |
| ISO 27001 (C5-Übergangslösung) | €15.000–40.000 | €3.000–8.000 |
| C5 Typ-2-Testat (Jahr 2) | €40.000–120.000 | €20.000–50.000 |
| AGB/Impressum Anwalt | €800–2.000 | — |
| ITSG Systemuntersuchung + Kostenträgerdatei | €2.000–5.000 | €500–1.000 |
| n8n Enterprise (falls nötig) | — | €6.000–24.000 |
| **Realistisch Jahr 1** (mit AWS-Scope-Hebel) | **€20.000–35.000** | **€10.000–20.000** |

> **Wichtigster Kostenhebel:** Supabase auf AWS Frankfurt → AWS hat C5-Testat. Praxura muss nur Applikationsschicht zertifizieren. ISO 27001 als Übergangslösung reduziert Jahr-1-Kosten auf ~€20.000 vs. €200.000 für vollständiges C5-Testat.

---

## FEATURES DIE PRAXURA NICHT BAUEN SOLLTE (ohne erhebliches Budget)

| Feature | Blocker |
|---------|---------|
| KI-Behandlungsempfehlungen / Clinical Decision Support | MDR Klasse IIa: €30.000–100.000+ Zertifizierung |
| Diagnose-KI / Therapieplanung-KI | MDR + EU AI Act Hochrisiko |
| DiGA (Patienten-App mit klinischen Effekten) | BfArM-Antrag, klinische Studien, MDR |
| Eigener TI-Konnektor | gematik-Zulassung: €135.000+ |
| §302-Direktabrechnung ohne ITSG-Zertifizierung | Technisch illegal |
| Kassensystem ohne TSE | §146a AO Bußgeld bis €25.000 |

---

*Quellen: §393 SGB V, BSI C5, MDCG 2019-11, EU AI Act Annex III, n8n Sustainable Use License, gematik Fachportal, ITSG dakota, §146a AO, GoBD 2025, Art. 37 DSGVO*
