# InfinityMade — Faktenbasis für Videogenerierung

> **WICHTIG für NotebookLM / KI-Video-Generator:**
> Verwende AUSSCHLIESSLICH die hier aufgeführten Fakten.
> Erfinde KEINE Features. Verwende KEINE allgemeinen SaaS-Marketing-Floskeln.
> Spreche AUSSCHLIESSLICH auf Deutsch. Zielgruppe: deutsche Physiotherapie-Praxen.
> Vermeide AI-typische Phrasen wie "revolutionär", "bahnbrechend", "alles verändern".

---

## Was InfinityMade IST

- SaaS-Plattform aus **Siegburg, Nordrhein-Westfalen, Deutschland**
- Hosting: **100% in der EU** (Vercel Frankfurt + Hetzner + Supabase EU + Azure Sweden Central)
- DSGVO-konform, AV-Vertrag, Impressum, Datenschutzerklärung vorhanden
- **Vertikale Spezialisierung: deutsche Physiotherapie-Praxen** (Hauptmarkt)
- Sekundärsektoren: Beauty/Salon, Restaurant (kleinerer Umfang)

## Was InfinityMade NICHT IST

- Kein elektronisches Patientenaktensystem (keine ePA-/KIM-Anbindung)
- Kein Buchhaltungssystem (kein DATEV-Export)
- Keine WhatsApp-Integration zum jetzigen Zeitpunkt (kommt später)
- Keine eigene Smartphone-App (Web-Browser-basiert)
- Keine telemedizinische Plattform

---

## Tatsächlich gebaute Features (Stand: Mai 2026)

### Für alle Sektoren
- Online-Buchungsseite mit eigener URL (z. B. `infinitymade.de/booking.html?u=praxis-mueller`)
- Smart-Kalender mit drei Ansichten: Tag, Woche, pro Mitarbeiter
- Drag-and-Drop-Terminverschiebung
- Kunden-/Patienten-Datenbank mit Notizen
- Service-Katalog mit konfigurierbarer Dauer und Preis
- Arbeitszeiten- und Schließtage-Verwaltung
- Team-Verwaltung mit 6-stelligen Einladungscodes
- Mehrere Mitarbeiter pro Konto, jeder mit eigener Buchungs-URL
- E-Mail-Benachrichtigungen
- Mehrsprachige Oberfläche: Deutsch, Englisch, Türkisch
- Stripe-Abo-Verwaltung mit monatlicher und jährlicher Abrechnung
- 14 Tage kostenlos testen, jederzeit kündbar

### Speziell für Physiotherapie / Praxis
- **Rezept-OCR**: Foto eines Muster-13-Rezepts wird in drei Sekunden ausgelesen
  - Erkannte Felder: Diagnose, ICD-10, Heilmittel, Anzahl Einheiten, Frequenz, Arzt-LANR, Arzt-BSNR, Krankenkasse
  - Technologie: Azure Document Intelligence (Region Sweden Central)
- **AI-Validierung** gegen die Heilmittel-Richtlinie
- **Krankenkasse-zu-IK-Auflösung** über Fuzzy-Match (16 große Krankenkassen vorinstalliert)
- **Heilmittel-Position automatische Erkennung** (KG → X0501, MT → X1201, MLD-30 → X0205)
- **Verordnungs-Sitzungsplanung** mit Fortschrittsanzeige
- **Zuzahlungs-Befreiungs-Workflow**: PDF hochladen, Datenbank-Trigger flaggt alle laufenden Rezepte des Patienten automatisch
- **Anamnesebogen** digital
- **Ärzteverzeichnis** mit LANR / BSNR

### Add-on "DTA-Pro" (nur Physiotherapie/Praxis)
- **§302 SGB V Sammelabrechnung**
- Automatische DTA-Datei-Erzeugung im EDIFACT-Format
- **PKCS#7-Signatur im Browser** mit ITSG/Dakota .p12-Zertifikat
  - Privater Schlüssel verlässt den Computer der Therapeut·in nie
  - Technologie: node-forge (Browser-seitig)
- **Begleitzettel** als HTML mit Druckdialog-Auto-Ausführung (kann als PDF gespeichert werden)
- **DAS-Portal-Schritt-für-Schritt-Anleitung** (Davaso, DDG, BITMARCK)
- **ZAA-Antwort-Workflow**: hochladen, automatische Übersetzung der Fehlercodes (40-Code-Wörterbuch), abgelehnte Rezepte rotieren zurück in den "abrechnungsbereit"-Pool
- **Zuzahlungs-Berechnung** automatisch (10% + 10€ Verordnungspauschale, gekappt am Bruttopreis, Befreiungsstatus, Versicherte unter 18)

---

## Preisstruktur (Stand: Mai 2026)

| Plan | Monatlich | Jährlich (-17%) | Kapazität |
|---|---|---|---|
| Essential | 29 € | 290 € (24 €/Monat) | 1 Mitarbeiter |
| Professional | 69 € | 690 € (57 €/Monat) | 2-5 Mitarbeiter |
| Clinic | 149 € | 1.490 € (124 €/Monat) | 6+ Mitarbeiter, Multi-Standort |

| Add-on | Monatlich | Jährlich |
|---|---|---|
| DTA-Pro (nur Physio) | 39 € | 390 € |

**Maximaler Physio-Bundle**: Professional + DTA-Pro = 108 €/Monat.
**Vergleich**: DMRZ + theorg + Cal.com ≈ 175-495 €/Monat.

---

## Konkrete Zahlen (keine Schätzungen, gemessene Werte)

- Rezept-Erfassung: **3 Sekunden** mit OCR vs. **5-10 Minuten** manuell
- Sammelabrechnung: **15 Minuten** vs. **4-6 Stunden** traditionell
- DMRZ-Kommission auf §302-Abrechnungen: **1-3% des Umsatzes**
- Bei 10.000 € monatlichem Umsatz: **mind. 100 € Kommissions-Ersparnis pro Monat**

---

## Verbotene Aussagen (NICHT verwenden)

- "Künstliche Intelligenz" ohne konkrete Anwendung — immer konkret: "OCR liest Rezept"
- Konkrete Stunden-Versprechen pro Anwender ("Sie sparen X Stunden") — Branchendurchschnitt OK
- "Mehr Patienten gewinnen" — können wir nicht garantieren
- "Marktführer", "Beste Lösung", "Revolutionär" — wir sind eine kleine Agentur
- Vergleich mit konkreten Mitbewerbern beim Namen außer DMRZ/theorg/Cal.com (nur deren Funktion erwähnt)
- "Hosting in der Cloud" — wir sagen "in Deutschland und der EU"

## Erlaubte Aussagen

- "Wir richten alles ein" — wahr für VIP-Onboarding (Clinic-Plan)
- "Persönliche Betreuung — bei uns antwortet ein Mensch" — wahr
- "DSGVO-konform" — wahr (AV-Vertrag verfügbar)
- "In 1-2 Tagen einsatzbereit" — wahr für Onboarding
- "Keine technischen Kenntnisse nötig" — wahr für Endnutzer
- "Made in Germany / Made in NRW" — wahr (Siegburg)
