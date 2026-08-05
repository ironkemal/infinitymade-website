# Praxura — Wettbewerbsanalyse Physiotherapie-Software Deutschland
**Stand: Juni 2026 | Markt: Physio/Ergo/Logo/Podo in DE**

---

## EXECUTIVE SUMMARY

Der deutsche Markt für Heilmittelerbringer-Software hat ~11 relevante Anbieter. Praxura ist der günstigste Anbieter mit GKV-§302-Billing. Die 4 kritischsten Lücken vs. Wettbewerb:

1. **TI-Anbindung** — alle Hauptkonkurrenten haben es, Pflicht ab 01.10.2027
2. **E-Mail/SMS-Erinnerungen** — Standard bei jedem Konkurrenten
3. **Therapiedokumentation** (SOAP, Befundberichte, Body Charts)
4. **DATEV-Export** — von Steuerberatern erwartet

Praxuras unbesetzte Nischen: **Preis** (dramatisch günstiger), **modernes Cloud-UI** (THEORG = Windows), **mehrsprachig** (kein Konkurrent hat Türkisch), **AI-OCR** (nur buchnerFLOW hat Ähnliches).

---

## MARKTÜBERBLICK

| Anbieter | Architektur | Einstiegspreis | TI | §302 | DATEV | Online-Booking |
|----------|-------------|---------------|----|------|-------|----------------|
| **THEORG** | Windows-Desktop | ~€74/Mo | ✅ | ✅ | ❌ | ❌ (geplant) |
| **Optica Viva** | Cloud/Browser | €38/Mo | ✅ KIM | ✅ | ❌ | ❌ |
| **buchnerFLOW** | Cloud | N/A (Anfrage) | ✅ | ✅ | ❌ (unklar) | ❌ |
| **synaptos** | Cloud | €37/Mo | ✅ | ✅ | ❌ | ✅ |
| **thevea** | Cloud | €39,90/Mo | ✅ | ✅ | ❌ | ❌ (unklar) |
| **MD Therapie** | Cloud | €44,90/Mo | ✅ | ✅ | ❌ | ❌ |
| **NOVENTI Ora** | Cloud | €59,90/Mo | 🟡 | ✅ | ✅ ASCII | ❌ (geplant) |
| **AMPAREX** | Cloud+Desktop | €60/Mo flat | ❌ (unklar) | ✅ | ❌ | ❌ (unklar) |
| **henara** | Cloud | N/A | ✅ | ✅ | ❌ | ✅ |
| **Qikbee** | Cloud+Desktop | €35/Mo | ❌ | ✅ | ❌ | ❌ (unklar) |
| **Cliniko** | Cloud | $45/Mo | ❌ | ❌ | ❌ | ✅ |
| **"Taha"** | — | — | — | — | — | — |
| **Praxura** | Cloud | €29/Mo | ❌ (Landing Page) | ✅ | ❌ | ❌ (entfernt) |

> **"Taha Software"** existiert nicht im deutschen Markt — in keiner deutschen Quelle (physiosoftware-vergleich.de, fitprotools.de, capterra.de, g2.de) auffindbar.

---

## DETAILANALYSE: TOP-KONKURRENTEN

---

### 1. THEORG / SOVDWAER GmbH

**Marktposition:** Marktführer (~23% Marktanteil), 30+ Jahre, 100.000+ Nutzer, 17.000+ Praxen.

**Stärken:**
- Tiefste Heilmittelkatalog-Validierungslogik im Markt (30 Jahre Erfahrung, alle GKV-Regelwerke)
- ISO 9001:2015 + ISO/IEC 27001:2022 zertifiziert
- **TheraConnect:** einziges Patientenportal mit nativer iOS/Android-App im Segment
- TI-Anbindung via eigenem THEORG-TI Produkt
- Multi-View-Kalender mit Raumplanung, Serien-Termine, Gruppen-Therapie
- Telefonintegration (Anrufer-ID aus Patientendatei)

**Schwächen:**
- Nur Windows-Desktop (kein macOS, kein Browser-native)
- Veraltetes UI — Wechselgrund Nr. 1 laut Capterra-Reviews ("teilweise sehr kompliziert")
- Modulpricing: E-Akte, SMS, TI, Mobile App — alle separate Gebühren
- Kein kostenloser Test
- Setup-Kosten ~€5.000 einmalig
- 2-Monate Wartezeit für Online-Schulungen
- Kein DATEV-Export

**Preisstruktur:**
- Base ~€74/Monat
- TI-Anbindung ~€158/Monat (kompensiert durch GKV-Pauschale €221,74/Monat)
- Einmalig ~€5.000+ Setup

**UX-Beobachtung:** Nutzer berichten von intensivem Schulungsaufwand. Das ist ein konkreter Vertriebsangle für Praxura: kein Setup-Geld, kein Windows-Zwang, selbsterklärend.

---

### 2. Optica Viva (PRAXINO GmbH / Dr. Güldener Gruppe)

**Marktposition:** Stärkster Challenger, einzige vollständig Cloud-native Lösung unter den Top-3. Betreibt auch eines der größten Heilmittel-Abrechnungszentren Deutschlands.

**Stärken:**
- **Client-side E2E-Verschlüsselung** — Optica kann Patientendaten selbst nicht lesen (einziger Anbieter)
- 3 unabhängige deutsche Rechenzentren
- KIM direkt integriert seit 2023 (gematik-Partner)
- **TSE-Kassensystem** eingebaut (€12,50/Monat Add-on)
- Blankoverordnung Traffic-Light-System
- Monatlich kündbar, kein Mindestvertrag
- Öffentlicher Demo-Zugang ohne Registrierung: `demo.opticaviva.de`
- Optionaler Liquiditätsservice: 90% Vorauszahlung innerhalb 48h
- BG-Abrechnung, PKV-Abrechnung, Selbstzahler — alles in einem

**Schwächen:**
- Kein Patientenportal (nur Online-Buchungsformular für Patienten)
- Keine native Mobile App
- Dakota-Direktabrechnung nur unter Windows (macOS: nur via Abrechnungszentrum)
- Kein DATEV (neue Quellen stellen das in Frage)
- Support-Probleme seit Anfang 2026 (mehrere negative Bewertungen)
- Kein Video-Telemedizin (in Entwicklung)

**Preisstruktur:**
- Praxisinhaber: €38/Mo
- Vollzeit-Therapeut: €30/Mo
- Teilzeit-Therapeut: €17/Mo
- Beispiel (1 Inhaber + 2 Therapeuten): €98/Mo Basis, €133/Mo mit Direktabrechnung

**UX-Beobachtung:** Modernster Konkurrent UI-seitig. Der kostenlose Demo-Zugang ohne Registrierung ist eine der effektivsten Lead-Gen-Maßnahmen im Markt — **Praxura sollte das unmittelbar kopieren.**

---

### 3. buchnerFLOW (Buchner & Partner)

**Marktposition:** 33+ Jahre im Markt als Heilmittelkatalog-Verleger. buchnerFLOW = neue Cloud-Version; STARKE Praxis = Legacy Windows-Software.

**Stärken:**
- **KI-Dokumentations-Assistent** — bisher einziger AI-differenzierter Anbieter im Markt
- VO-Scan mit automatischer Vertragslogik-Validierung
- gematik-zertifiziertes buchnerTI (TI-as-a-Service, kein On-Site-Konnektor)
- buchnerTI: **Netto €0** (€205,66 Kosten, €221,74 GKV-Rückerstattung)
- KIM für Arztbriefe
- GKV-Datenaustausch-Zulassung bestätigt (ITSG-Register)
- Mobile-optimiert (Hausbesuche)

**Schwächen:**
- Keine öffentliche Preisgestaltung
- Kein Online-Booking für Patienten
- Kein Video-Konsultation
- STARKE Praxis (Legacy) = Windows-only
- Kaum unabhängige Reviews für buchnerFLOW

**UX-Beobachtung:** Der KI-Doku-Assistent ist bisher das einzige AI-Feature im deutschen Markt. Praxuras OCR-Rezeptscan ist ähnlich positioniert, aber buchnerFLOW geht weiter (vollständige Therapiedokumentation per AI). Das ist Praxuras direktester AI-Konkurrent.

---

### 4. synaptos

**Marktposition:** Österreichisch, expandiert nach Deutschland. 3.000+ Kunden, modernes UI.

**Stärken:**
- Online-Buchung in allen Plänen inklusive
- **TI in allen Plänen inklusive** — einziger Anbieter ohne TI-Aufpreis
- ISO 9001 + ISO 27001 zertifiziert
- SmartScan-App für Rezepte
- Jährlich 5% Rabatt

**Preise:** Starter €37–39/Mo (bis 2 Mitarbeiter), Growth €76–79/Mo, Professional €95–99/Mo

**Schwächen:** Österreichische Server; nur RZH als Abrechnungszentrum (keine freie Wahl).

---

### 5. thevea

**Marktposition:** Startup, 7.000+ Praxen, 4,9★. Billing-first Ansatz.

**Stärken:**
- **Smartphone-Foto-VO-Scan** zur GKV-Konformitätsprüfung in 5 Sekunden
- TI als "3-in-1"-Bundle (Software + Abrechnung + TI)
- 4 Monate kostenlos für Startups (Praxura-Konkurrenz um Neugründungen!)
- 2-Monats-Geldback-Garantie
- Blankoverordnung-Preisrechner auf Website (Lead-Gen)

**Preise:** Starter €39,90, Basis €69,90, Plus €99,90 **+ 0,99% auf Rezeptwert** (Abrechnungsgebühr!)

**Schwäche:** Der Prozentsatz kumuliert. Bei 30 Rezepten à €100/Woche = €120/Monat zusätzlich. Kein DATEV.

---

### 6. Cliniko (international, kein DE-Konkurrent)

Cliniko ist **kein direkter Konkurrent** für Praxura — kein GKV §302, kein TI, kein deutsches UI. Nur für Privatpraxen in DE nutzbar.

**Warum trotzdem relevant:** UX-Benchmark. Cliniko gilt als UI-Goldstandard ("extremely intuitive", Capterra 4.7/5, 65.000 Nutzer weltweit). Praxura sollte Clinikos UX-Patterns als Vorbild nehmen.

**Cliniko-Features die als UX-Ziele dienen sollten:**
- Automatische SMS/E-Mail-Erinnerungen (mehrere vor Termin konfigurierbar)
- Eingebettetes Online-Buchungs-Widget (iframe in Praxis-Website)
- Telehealth/Video bis 4 Personen (kostenlos, integriert)
- 94 Third-Party-Integrationen (REST API + OAuth 2.0)
- Passkey-Authentifizierung
- Full audit trail (wer hat wann was geändert)

---

### 7. NOVENTI Ora

**Stärke:** **DATEV-ASCII Export** — einziger Anbieter mit dieser Funktion laut Research.

**Schwäche:** €499 Setup-Gebühr, 24-Monats-Mindestvertrag. Teuer für kleine Praxen.

---

## FEATURE-LÜCKEN-ANALYSE: PRAXURA VS. MARKT

### 🔴 Kritische Lücken (alle Hauptkonkurrenten haben das)

| Feature | Wer hat es | Schwierigkeit |
|---------|-----------|---------------|
| **SMS/E-Mail-Terminreminder** | Alle (10–12 Anbieter) | Niedrig — SMTP vorhanden, nur Cron-Job |
| **TI-Anbindung / KIM** | THEORG, Optica, Buchner, synaptos, thevea, henara | Hoch — API-Partner-Integration nötig |
| **Blankoverordnung Traffic-Light** | Optica, NOVENTI Ora, thevea | Mittel |
| **Heilmittelkatalog-Validierung bei Buchung** | THEORG, Optica, NOVENTI Ora | Mittel-Hoch |

### 🟠 Wichtige Lücken (mehrere Konkurrenten haben das)

| Feature | Wer hat es | Schwierigkeit |
|---------|-----------|---------------|
| **DATEV-Export** | NOVENTI Ora (ASCII) | Niedrig-Mittel |
| **PKV-Rechnungsstellung + Mahnwesen** | THEORG, Optica, synaptos | Mittel |
| **Therapie-Dokumentation** (SOAP, Body Charts) | THEORG, Optica, Cliniko, MD Therapie | Mittel |
| **Wartelisten-Verwaltung** | THEORG, Optica, Cliniko, henara | Niedrig |
| **Statistik-/Controlling-Dashboard** | THEORG, Optica, MD Therapie | Mittel |
| **Mitarbeiter-Zeiterfassung** | THEORG, Optica, MD Therapie | Mittel |
| **Urlaubskalender / Dienstplanung** | Optica, MD Therapie, henara | Mittel |
| **Online-Buchung für Patienten** | synaptos, henara, Cliniko | Niedrig (wurde entfernt!) |

### 🟡 Mittelfristige Lücken

| Feature | Wer hat es | Schwierigkeit |
|---------|-----------|---------------|
| TSE-Kassensystem | Optica (€12,50/Mo) | Mittel (wenn Barzahlung eingeführt) |
| Video-Telemedizin | Optica (WebPRAX €14,90), Cliniko | Mittel (Partner-Integration) |
| Patientenportal / native App | THEORG (TheraConnect) | Hoch |
| BG-Abrechnung | THEORG, Optica | Hoch |
| ISO 27001 Zertifizierung | THEORG, synaptos | Hoch (€15k+) |

---

## WO PRAXURA BEREITS GEWINNT

| Vorteil | vs. wer | Stärke |
|---------|---------|--------|
| **Preis** | Alle (€29/49/99 vs. €37–149+) | Sehr stark — 30–60% günstiger |
| **Cloud-native, kein Windows** | THEORG (Windows-only) | Stark — macOS-Praxen wachsen |
| **Mehrsprachig (DE/EN/TR)** | Niemand bietet Türkisch | Nische für türkischstämmige Therapeuten in DE |
| **Modernes UI/UX** | THEORG, NOVENTI Ora (veraltet) | Mittel |
| **AI-OCR Rezeptscan** | Nur buchnerFLOW ähnlich | Differenzierend |
| **Monatlich kündbar** | Gleichauf mit Optica, synaptos | Parität |
| **Stripe (kein EC-Terminal)** | Alle anderen: Überweisung/EC | Unterschätzter Modernisierungsvorteil |
| **Kein Setup-Fee** | THEORG (€5.000), NOVENTI (€499) | Psychologisch wichtig für Entscheidung |

---

## QUICK-WIN-OPPORTUNITIES

### 1. Öffentlicher Demo-Zugang ohne Registrierung
Optica hat `demo.opticaviva.de` — jeder kann ohne Login die Software testen. Praxura hat nur 14-Tage-Trial mit Registrierung. **Aufwand: 1 Tag. Impact: hoch.**

### 2. SMS/E-Mail-Terminreminder
Jeder einzelne Konkurrent bietet das. SMTP-Infrastruktur ist bereits in `api/demo-booking.js` vorhanden. Braucht nur Cron-Job + Template. **Aufwand: 1–2 Tage.**

### 3. DATEV-ASCII Export
Nur NOVENTI Ora bietet das explizit — aber alle Steuerberater fragen danach. CSV im DATEV-ASCII-Format aus §302-Abrechnungsdaten ist technisch einfach. **Hoher wahrgenommener Wert, ~2–3 Tage Entwicklung.**

### 4. Wartelisten-Modul produktisieren
Bereits im Kalender vorhanden. Ein vollständiges Feature (Patient wartet → automatisch informiert wenn Slot frei) ist bei Optica und Cliniko ein Kern-Feature. **1–3 Tage.**

### 5. Blankoverordnung Traffic-Light
Heilmittelerbringer verlieren Geld durch abgelaufene Fristen. Datenmodell in DB vorhanden, Logik hinzufügen = starkes Vertriebs-Argument.

---

## PRICING-STRATEGIE-ANALYSE

### Praxuras Preise vs. Markt (Beispielpraxis: 1 Inhaber + 2 Vollzeit-Therapeuten)

| Anbieter | Monatlich | Differenz zu Praxura Professional |
|----------|-----------|-----------------------------------|
| Qikbee | ~€55 | +€6/Mo |
| synaptos | €76–79 | +€27–30/Mo |
| Optica Viva | €98 | +€49/Mo (€588/Jahr) |
| thevea | €69,90 + 0,99% | Variable, oft +€60–100/Mo |
| MD Therapie Standard | €149 | +€100/Mo (€1.200/Jahr) |
| THEORG | ~€150+ | +€100/Mo |
| **Praxura Professional** | **€49** | Referenz |

**Risiko:** "Zu günstig" wird im deutschen Gesundheitsmarkt als Qualitätsproblem wahrgenommen. Empfehlung: Preise durch Compliance-Badges (ISO 27001, ITSG-Zertifizierung) absichern.

---

## UX-VERGLEICH: WAS KONKURRENTEN BESSER MACHEN

### THEORG: Tiefe der Validierung
Rezept-Check direkt beim Einbuchen (Heilmittelkatalog, Fristen, erlaubte Kombinationen). Der Therapeut kann keine ungültige Verordnung einbuchen → verhindert GKV-Rückbuchungen.

### Optica: Intelligente Warteliste
Filterung nach freiem Zeitslot **UND** Diagnose/Heilmittel. Wenn Therapeutin X krank ist, findet das System automatisch passende Patienten aus der Warteliste für Therapeutin Y.

### Cliniko: Buchungs-UX
Embeddable Widget, Bestätigungs-E-Mails mit Kalender-Attachment (.ics), Self-Cancellation ohne Anruf. Genau das Feature das Praxura entfernt hat.

### thevea: Onboarding-UX
Smartphone-Foto-VO-Scan → GKV-Konformitätsprüfung in <10 Sekunden, kein Scanner nötig. Modernste Rezepterfassung im Markt.

### buchnerFLOW: AI-Dokumentation
"Doku-Assistent" generiert strukturierte Therapiedokumentation aus Freitext/Sprache. 10–20 Minuten Ersparnis pro Tag pro Therapeut — stärkster Bindungs-Driver.

---

## STRATEGISCHE EMPFEHLUNGEN

### Sofort (diese Woche)
1. **Demo-Portal aufsetzen** — no-registration, vorgefüllte Testdaten
2. **SMS/E-Mail-Terminreminder** implementieren

### Kurzfristig (1–3 Monate)
3. **DATEV-ASCII Export** — Steuerberater-Argument
4. **Wartelisten-Modul** produktisieren
5. **Blankoverordnung Traffic-Light** hinzufügen

### Mittelfristig (3–6 Monate)
6. **Therapie-Dokumentation** (SOAP, Befundberichte) — ohne das kein vollständiges System
7. **PKV-Rechnungsstellung + Mahnwesen**
8. **TI-Anbindung** via API-Partner (Pflicht ab 01.10.2027)

### Langfristig (6–12 Monate)
9. **AI-Dokumentations-Assistent** — direkt vs. buchnerFLOW
10. **ISO 27001** — Vertrauenssignal + C5-Übergangslösung

### Was Praxura NICHT bauen sollte

| Feature | Warum nicht |
|---------|-------------|
| Eigener TI-Konnektor | gematik-Zulassung €135.000+ |
| KI-Behandlungsempfehlungen | MDR Klasse IIa: €30.000–100.000 |
| DiGA-Patienten-App | BfArM-Antrag + klinische Studien |
| Native iOS/Android-App | 6+ Monate, App-Store-Maintenance |
| Abrechnungszentrum-Betrieb | Regulatorisch + operativ zu aufwendig |
| BG-Abrechnung | Komplexes separates Vertragswerk |

---

## QUELLENVERZEICHNIS

- theorg.de / sovdwaer.de, physiosoftware-vergleich.de/theorg, capterra.com.de/software/196008/theorg
- optica.de, optica.de/software/optica-viva, demo.opticaviva.de, provenexpert.com
- buchner.de/buchnerflow, buchner.de/buchnerti
- cliniko.com, capterra.com/p/180878/Cliniko, g2.com/products/cliniko
- synaptos.de, thevea.de, medifoxdan.de, noventi.de/azh
- amparex.com, qikbee.de, henara.eu
- medi-one.ai/blog/praxissoftware-physiotherapie-vergleich
- fitprotools.de/physiotherapie-software, 3plus4software.de

*"Taha Software": nicht im deutschen Markt auffindbar (keine Ergebnisse auf physiosoftware-vergleich.de, fitprotools.de, capterra.de, g2.de)*
