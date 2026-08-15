# Verfahrensdokumentation zur Belegablage und geordneten Buchführung (GoBD)
**Rechtsträger:** Einzelunternehmen Yavuz Kemal Demir  
**Wirtschaftsjahr:** ab 2026  
**Version:** 2.0 (Stand: 15.08.2026)  
**Rechtsgrundlage:** GoBD (BMF-Schreiben vom 28.11.2019), § 146 AO, § 147 AO, § 4 Abs. 3 EStG (EÜR), UStG

---

## 1. Allgemeines und Anwendungsbereich
Diese Verfahrensdokumentation beschreibt den organisatorischen und technischen Prozess für den Empfang, die Digitalisierung, die revisionssichere Archivierung, die steuerliche Erfassung sowie die Auswertung von elektronischen Belegen (Eingangsrechnungen, Quittungen) für das Einzelunternehmen *Yavuz Kemal Demir*.

---

## 2. Systemübersicht und Schnittstellen

```
[1. E-Mail Eingang (IMAP/Gmail)]
               │
               ▼
[2. n8n Automation Engine (Local Docker / Webhook)]
   ├── Extraktion Originalbeleg (PDF)
   ├── SHA-256 Hash-Generierung (Integritätsprüfung)
   ├── Upload in geschütztes Google Drive Rechnungsarchiv (Unveränderbarkeit)
   ├── AI Vision Parsing (Gemini Multimodal OCR)
   └── Plausibilitätsprüfung & Vorab-Klassifizierung
               │
               ▼
[3. PostgreSQL / Supabase Datenbank (farkaejociddtgqkusvm)]
   ├── `ops_finance_expenses` (Transaktionsregister mit § 11 EStG Zahlungsdatum)
   └── `ops_finance_audit_log` (Lückenloses Änderungsprotokoll / Audit Trail)
               │
               ▼
[4. Praxura Ops Dashboard (Frontend)]
   ├── Menschliche Plausibilitätsprüfung & Freigabe
   ├── Verwaltung von Anlagevermögen (AVEÜR), GWG und § 13b Reverse Charge
   └── Elster / Steuerberater-Export (CSV / JSON)
```

---

## 3. Detaillierter Verfahrensablauf

### Schritt 1: Belegeingang
- Eingangsrechnungen gehen digital als PDF-Anhang im designierten Postfach ein oder werden vom Unternehmer dorthin weitergeleitet.
- Das System erfasst Eingangszeitpunkt (`received_at`), Absender (`email_sender`) und Betreff (`email_subject`).

### Schritt 2: Unveränderbare Archivierung & Integritätssicherung
- Der Originalbeleg (PDF) wird in das gesicherte Google Drive Belegarchiv überführt.
- Es wird unmittelbar ein kryptografischer Hashwert (`original_file_hash`, SHA-256) generiert und in der Datenbank hinterlegt.
- **Wichtig:** Der Originalbeleg wird niemals modifiziert oder überschrieben.

### Schritt 3: OCR-Extraktion & Plausibilitätsprüfung
- Die KI (Gemini Vision) liest die Rechnungsdaten (Lieferant, Rechnungsnummer, Rechnungsdatum, Netto, USt-Satz, USt-Betrag, Brutto, Währung, Land, USt-IdNr.).
- **Plausibilitätsregeln:**
  - `Brutto = Netto + USt`
  - Prüfung auf Duplikate anhand von `(Lieferant, Rechnungsnummer, Bruttobetrag, Rechnungsdatum)` oder File-Hash.
  - Erkennung von Reverse Charge (§ 13b UStG) bei ausländischen B2B-Diensten (EU / Drittland).
  - Erkennung von wiederkehrenden Abonnements / Fixkosten.

### Schritt 4: Steuerliche Klassifizierung & Sachkontenzuordnung
- Jede Ausgabe wird einer der 18 definierten steuerlichen Sachkategorien zugeordnet.
- Wirtschaftsgüter > 800 € Netto werden als Anlagevermögen (`asset_acquisition`) markiert und nicht als Sofortaufwand gebucht.
- Private Ausgaben Dritter (z. B. Melih privat) werden mit `is_deductible: false` und `tax_category: 'private_expense'` markiert und fließen **nicht** in die EÜR des Einzelunternehmens ein.

### Schritt 5: Zahlungsabgleich nach § 11 EStG (Zufluss-/Abflussprinzip)
- Für die EÜR-Erfassung ist verbindlich das tatsächliche Zahlungsdatum (`payment_date` / `cash_flow_date`) maßgebend.
- Belege ohne Zahlungsnachweis verbleiben bis zur Begleichung im Status `review_needed`.

### Schritt 6: Audit Trail & Änderungsprotokollierung
- Jede manuelle Änderung von OCR-Werten (z. B. Korrektur des Betrags oder der Steuerkategorie) wird automatisch in `ops_finance_audit_log` mit Benutzer-ID, Zeitstempel, altem Wert, neuem Wert und Änderungsgrund protokolliert.

### Schritt 7: Jahresabschluss & Export für ELSTER
- Erzeugung des GoBD-konformen CSV- und JSON-Exports für die Anlage EÜR und die Umsatzsteuererklärung.
- Getrennter Ausweis von Vorsteuer (§ 15 UStG) und geschuldeter/abziehbarer § 13b Reverse-Charge-Steuer.

---

## 4. Datensicherheit, Backup und Zugriffskontrolle
1. **Zugriffsbeschränkung:** Zugriff auf das Dashboard und die Datenbank erfolgt über Supabase Auth mit Row-Level-Security (RLS) ausschließlich für autorisierte Ops-Mitglieder.
2. **Datensicherung:** Regelmäßige verschlüsselte Backups der PostgreSQL-Datenbank und Versionierung im Google Drive Rechnungsarchiv.
3. **Aufbewahrungsfrist:** Sämtliche Originalbelege und Buchungsdaten werden für die gesetzliche Frist von 10 Jahren (§ 147 Abs. 3 AO) unveränderbar vorgehalten.
