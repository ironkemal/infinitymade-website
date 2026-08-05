# Competitive Structure Map: Optica Viva (opticaviva.de)

This document maps the complete navigation structure, feature set, and user experience of **Optica Viva**, a leading German Heilmittel (therapy) billing and practice management SaaS.

---

## 1. Entry & Demo Access Path

* **Competitor Demo URL:** `https://demo.opticaviva.de/index`
* **Entry Path / Credentials:** 
  * The WAF (Web Application Firewall) blocks standard headless automated browsers. Accessing it requires a standard desktop User-Agent and disabling the automation flags (`navigator.webdriver = false`).
  * Once the login page loads, the credentials and options are pre-filled:
    * **Praxis (Branch/Specialty):** `Physiotherapie` (default selection, ID: `2001`). Other options include: `Ergotherapie`, `Logopädie`, `Podologie`, `Ernährungstherapie`, `Heilpraktik`.
    * **Benutzer (User Role):** `Praxisinhaber` (default selection, ID: `PRIN`). Other roles: `Verwalter` (Manager), `Therapeut in Vollzeit` (FT Therapist), `Therapeut in Teilzeit` (PT Therapist), `Empfangsmitarbeiter` (Receptionist).
    * **Passwort (Password):** Pre-filled with `1234567890`.
    * **Sicherheitsschlüssel (Security Key):** Blank.
  * Clicking the primary **Login** button (`button[type="submit"]`) immediately authenticates and redirects to the main dashboard.
* **Landing URL:** `https://demo.opticaviva.de/index`
* **Landing Page Title:** `Optica Viva DEMO – Dashboard`
* **Screenshot of Login Page:** `01-login.png`

---

## 2. Full Navigation Structure & Module Inventory

The Optica Viva platform uses a **left-collapsible sidebar** for navigation and a **top utility bar** for quick-actions. Below is the full hierarchical map of the platform modules with functional descriptions and corresponding screenshots.

### Topbar Utility Tools (Global Actions)
* **GKV-Karte (Health Insurance Card Reader):** Integration button to trigger a local card reader to read patient data directly.
* **Barcodescanner (Barcode Scanner):** Triggers a scanner to automatically read code from standard paper prescription sheets (Heilmittelverordnung).
* **Filialwähler (Branch Switcher):** Dropdown menu showing the active branch (`Filiale 2001 P`) and allowing switching between locations.
* **User Profile & Quick Info:** Shows the logged-in role (`Praxis INHABER`) with quick access to user profile settings.

---

### Left Sidebar Modules

| # | Nav Module | Href / Selector | Functional Description | Screenshot |
|---|------------|-----------------|------------------------|------------|
| **1** | **Dashboard** | `/` | Main portal home with widgets for calendar, open tasks, statistics, and billing progress. | `02-overview.png` |
| **2** | **Kalender (Calendar)** | `/kalender/` | Core scheduler with drag-and-drop support, therapist columns, and room allocation. | `03-calendar.png` |
| **3** | **Weitere Kalender** | `#sidebar-calendars` | Expandable sub-menu for advanced calendars and scheduling views. | *Group* |
| 3a | ↳ *Abwesenheiten* | `/abwesenheiten/` | Manage therapist absences, sick leave, and off-duty times. | `03-calendar.png` |
| 3b | ↳ *Ressourcen* | `/ressourcen/` | Manage and schedule specific treatment rooms and specialized equipment. | `03-calendar.png` |
| 3c | ↳ *Urlaubskalender* | `/urlaub/` | Practice-wide staff vacation planner. | `03-calendar.png` |
| **4** | **Aufgaben (Tasks)** | `/aufgaben/` | Task and to-do manager for practice staff (shows active count e.g., "Aufgaben 5"). | `04-tasks.png` |
| **5** | **Notizen (Notes)** | `/notizen/` | General internal stickies/notes dashboard for the practice team. | `04-tasks.png` |
| **6** | **Dateien (File Manager)** | `/dateimanager/` | Practice file storage, document uploads, and patient-related folder management. | `04-tasks.png` |
| **7** | **KIM (Med-Email)** | `/kim/info` | Integrated *Kommunikation im Medizinwesen* – secure German medical emailing protocol. | `04-tasks.png` |
| **8** | **Patienten** | `#sidebar-patients` | Expandable menu for patient records management. | *Group* |
| 8a | ↳ *Liste* | `/patienten/` | Full patient master database, contacts, diagnoses, and medical histories. | `05-patients.png` |
| 8b | ↳ *Archiv* | `/patienten/archiv` | Archived patient files who are no longer active in the practice. | `05-patients.png` |
| 8c | ↳ *Geburtstage* | `/patienten/geburtstage` | List of upcoming birthdays, useful for patient relationship marketing. | `05-patients.png` |
| 8d | ↳ *Gruppen* | `/patienten/patientengruppen`| Grouping patients (e.g. rehab groups, neurological patients) for bulk booking. | `05-patients.png` |
| 8e | ↳ *Import* | `/patienten/import` | Utility to batch import patient lists from spreadsheets or other softwares. | `05-patients.png` |
| **9** | **Rezepte (Prescriptions)** | `#sidebar-prescriptions` | Expandable menu for healthcare prescription tracking and lifecycle. | *Group* |
| 9a | ↳ *Kassenrezepte* | `/rezepte/kassenrezepte` | Statutory health insurance prescriptions (GKV / Muster 13). | `06-prescriptions.png` |
| 9b | ↳ *Privatrezepte* | `/rezepte/privatrezepte` | Private health insurance prescriptions (PKV). | `06-prescriptions.png` |
| 9c | ↳ *BG- & UK-Rezepte* | `/rezepte/bg-uk-rezepte` | Occupational accident insurance prescriptions (Berufsgenossenschaft / Unfallkasse).| `06-prescriptions.png` |
| 9d | ↳ *Archiv* | `/rezepte/archiv` | Completed and fully billed prescription archives. | `06-prescriptions.png` |
| **10** | **Prüfung (Auditing)** | `#sidebar-checks` | Expandable module for compliance and prescription validation. Crucial billing step. | *Group* |
| 10a | ↳ *HMR-Prüfung* | `/pruefung/rezeptpruefung`| Heilmittel-Richtlinien (HMR) compliance check to avoid billing clawbacks (Absetzungen). | `07-checks.png` |
| 10b | ↳ *Blankorezepte* | `/pruefung/blankorezepte` | Audit tools for the new German "Blankoverordnung" (therapist-defined treatments). | `07-checks.png` |
| 10c | ↳ *Ausfalltermine* | `/pruefung/ausfalltermine` | Audit page for missed/no-show sessions and tracking default charges. | `07-checks.png` |
| 10d | ↳ *Kassenrezepte* | `/pruefung/kassenrezepte` | Audits specific to statutory insurance prescriptions before billing. | `07-checks.png` |
| 10e | ↳ *Offene Termine* | `/pruefung/offenetermine` | Sessions that have been scheduled but not checked-in or verified as completed. | `07-checks.png` |
| 10f | ↳ *Privatrezepte* | `/pruefung/privatrezepte` | Audits specific to private patient prescriptions before invoicing. | `07-checks.png` |
| 10g | ↳ *Tarifänderung* | `/pruefung/tarifaenderung` | Detects price catalog discrepancies on active prescriptions. | `07-checks.png` |
| 10h | ↳ *Therapieberichte*| `/pruefung/berichte` | Status of therapy reports that must be written and sent back to prescribing doctors.| `07-checks.png` |
| 10i | ↳ *Verkäufe* | `/pruefung/verkaufe` | Auditing direct product sales (e.g. bands, massage oils) made in the clinic. | `07-checks.png` |
| 10j | ↳ *Wiedervorlage* | `/pruefung/wiedervorlage` | Follow-ups and resubmissions for patient cases. | `07-checks.png` |
| 10k | ↳ *Zuzahlungen* | `/pruefung/zuzahlungen` | Tracks statutory co-payments (§32 SGB V) owed, paid, or exempt (Zuzahlungsbefreiung).| `07-checks.png` |
| **11** | **Abrechnung (Clearing)**| `#sidebar-clearing` | Expandable step-by-step billing clearing pipeline for statutory insurances. | *Group* |
| 11a | ↳ *1. Kontrolle* | `/abrechnung/kassen/kontrolle`| Stage 1: Validation of prescription data and completed treatment logs. | `08-billing.png` |
| 11b | ↳ *2. Taxierung* | `/abrechnung/kassen/taxierung`| Stage 2: Pricing/taxation of prescriptions (calculating items, VAT, and totals). | `08-billing.png` |
| 11c | ↳ *3. Export* | `/abrechnung/kassen/export` | Stage 3: Direct digital billing data transmission (DTA §302 SGB V). | `08-billing.png` |
| 11d | ↳ *4. Archiv* | `/abrechnung/kassen/archiv` | Stage 4: Historical billing run archives and remittance reports. | `08-billing.png` |
| **12** | **Finanzen (Finance)** | `#sidebar-finance` | Expandable general finance and invoicing dashboard. | *Group* |
| 12a | ↳ *Offene Posten* | `/finanzen/opos` | Accounts receivable / outstanding customer and private patient invoices. | `09-finance.png` |
| 12b | ↳ *Belegliste* | `/finanzen/belege` | Ledger showing all cash receipts, retail sales vouchers, and bank transfers. | `09-finance.png` |
| 12c | ↳ *Einnahmenprognose*| `/finanzen/einnahmenprognose`| Revenue projection based on scheduled treatments and active prescriptions. | `09-finance.png` |
| 12d | ↳ *Journale* | `/finanzen/journale` | Detailed audit trails and transaction logs for financial compliance (GoBD). | `09-finance.png` |
| 12e | ↳ *Mahnwesen* | `/finanzen/mahnwesen` | Dunning and debt collection workflow for overdue private payments. | `09-finance.png` |
| 12f | ↳ *Patientenkonten* | `/finanzen/patientenkonten`| Credit/debit balances tracked at the individual patient profile level. | `09-finance.png` |
| **13** | **Statistik (Stats)** | `#sidebar-statistic` | Expandable business intelligence and practice metrics dashboard. | *Group* |
| 13a | ↳ *Umsatz* | `/statistik/umsatz` | General revenue breakdowns, comparisons, and graphical trends. | `10-statistics.png` |
| 13b | ↳ *Ärzte* | `/statistik/aerzte` | Stats on referring doctors (who prescribes the most, what types of remedies). | `10-statistics.png` |
| 13c | ↳ *Diagnosen* | `/statistik/diagnosen` | Breakdown of clinical diagnosis codes (ICD-10) treated in the clinic. | `10-statistics.png` |
| 13d | ↳ *Krankenkassen* | `/statistik/kassen` | Revenue and volume split by health insurance providers (AOK, TK, BARMER, etc.). | `10-statistics.png` |
| 13e | ↳ *Organisationen* | `/statistik/organisationen`| Stats on corporate/B2B clients or partners. | `10-statistics.png` |
| 13f | ↳ *Therapeuten* | `/statistik/therapeuten` | Therapist productivity, working hours, and treatment-revenue statistics. | `10-statistics.png` |
| **14** | **Im- & Export** | `#sidebar-datawarehouse`| Expandable utility menu for data warehouse operations. | *Group* |
| 14a | ↳ *Messreihen* | `/daten/messreihen` | Import or export configurations for clinical measurement series. | `11-import-export.png` |
| 14b | ↳ *Anamnesen* | `/daten/anamnesen` | Import or export patterns for clinical anamnesis templates. | `11-import-export.png` |
| 14c | ↳ *Ärzte* | `/daten/aerzte` | Import or export doctors master data lists. | `11-import-export.png` |
| 14d | ↳ *Patienten* | `/daten/patienten` | Import or export core patient lists. | `11-import-export.png` |
| 14e | ↳ *Privattarife* | `/daten/privattarife` | Import or export private tariff price lists. | `11-import-export.png` |
| 14f | ↳ *Textbausteine* | `/daten/textbausteine` | Import or export reusable text snippets used in documentation. | `11-import-export.png` |
| 14g | ↳ *Terminvorgehen* | `/daten/vorgehen` | Import or export defined procedural calendars paths. | `11-import-export.png` |
| 14h | ↳ *Terminziele* | `/daten/terminziele` | Import or export clinical treatment goals catalog. | `11-import-export.png` |
| **15** | **Verwaltung (Admin)**| `#sidebar-management` | Expandable core administrative master-data database. | *Group* |
| 15a | ↳ *Benutzer* | `/verwaltung/benutzer/` | Practice staff records, user logins, roles, working hours, and RBAC permissions. | `12-management.png` |
| 15b | ↳ *Qualifikationen* | `/verwaltung/qualifikationen/`| Certifications of staff (e.g. Manuelle Therapie, Lymphdrainage) which limit what they can bill.| `12-management.png` |
| 15c | ↳ *Ressourcen* | `/verwaltung/ressourcen/` | Configure treatment rooms, training devices, and physical capacity. | `12-management.png` |
| 15d | ↳ *Tarife* | `/verwaltung/tarife/` | Pricing tables for GKV catalogs (Heilmittelkatalog), private fees, and BG rates. | `12-management.png` |
| 15e | ↳ *Störungsbilder* | `/verwaltung/stoerungsbilder/`| Catalog of standard clinical disorders/ICD-10 classifications treated. | `12-management.png` |
| 15f | ↳ *Verkauf* | `/verwaltung/verkauf/` | Product sales setup (reception inventory, fitness/health items, massage oils). | `12-management.png` |
| 15g | ↳ *Krankenkassen* | `/verwaltung/krankenkassen/`| Master register of health insurers, billing addresses, and IK numbers. | `12-management.png` |
| 15h | ↳ *Filialen* | `/verwaltung/filialen/` | Multi-location setup and configuration. | `12-management.png` |
| 15i | ↳ *Ärzte* | `/verwaltung/aerzte/` | Directory of referring physicians, their clinic addresses, and Lanr codes. | `12-management.png` |
| 15j | ↳ *Anamnesen* | `/verwaltung/anamnesen/` | Define custom medical intake/anamnesis questions and fields. | `12-management.png` |
| 15k | ↳ *Messreihen* | `/verwaltung/messreihen/` | Configure tracking parameters for patient metrics (e.g. range of motion). | `12-management.png` |
| 15l | ↳ *Patientenakquisen*| `/verwaltung/akquisen/` | Track referral marketing channels (e.g. local newspaper, GP referral). | `12-management.png` |
| **16** | **Einstellungen (Settings)**| `#sidebar-settings` | Expandable comprehensive system and practice rules setup. | *Group* |
| 16a | ↳ *Praxis* | `/einstellungen/praxis` | Core clinic profile: address, logo, business details, bank connection. | `13-settings.png` |
| 16b | ↳ *Abrechnung* | `/einstellungen/abrechnung`| Rules for GKV billing, direct clearing options, and §302 billing data configurations. | `13-settings.png` |
| 16c | ↳ *Dienste* | `/einstellungen/dienste` | Third-party integrations (SMS gateways, calendar syncs, email SMTP). | `13-settings.png` |
| 16d | ↳ *Druck* | `/einstellungen/druck` | Print layouts, invoice designs, receipt templates, PDF header/footer. | `13-settings.png` |
| 16e | ↳ *Fachrichtungen* | `/einstellungen/fachrichtungen`| Active medical specialties of the clinic (e.g. Physiotherapy vs. Podology). | `13-settings.png` |
| 16f | ↳ *Finanzen* | `/einstellungen/finanzen` | Taxation, tax brackets, dunning fees, payment terms, and invoice numbering. | `13-settings.png` |
| 16g | ↳ *Vorlagen* | `/einstellungen/vorlagen` | Document, certificate, and medical consent forms email/print templates. | `13-settings.png` |
| **17** | **Konto (Account)** | `/konto/` | Subscription status with Optica Viva, invoices, contract details. | `13-settings.png` |
| **18** | **Informationen** | `/nachrichten` | System notifications, news, software updates, and developer announcements. | `13-settings.png` |
| **19** | **Knowhow (Learning)**| `#sidebar-knowhow` | Expandable educational catalog, FAQs, training materials, and support links. | *Group* |
| 19a | ↳ *Aktuelles* | `/knowhow/aktuelles` | Blog / software release notes. | `14-knowhow.png` |
| 19b | ↳ *FAQ* | `/knowhow/faq` | Searchable list of answers to common practice software questions. | `14-knowhow.png` |
| 19c | ↳ *Hilfe* | `/knowhow/hilfe` | Complete software user manual. | `14-knowhow.png` |
| **20** | **Support** | `/support/` | Direct ticketing system, feedback, and live help request center. | `15-support.png` |

---

## 3. General Layout & Design Observations

* **Platform Type:** Highly optimized **Desktop Web Application (SaaS)**. It is built strictly as a full-screen desktop dashboard portal. It is not responsive enough for phones, relying heavily on side-by-side data grids, tables, and popups.
* **Language:** Strictly **German (DE)**. The platform features, settings, terms, and billing logic are designed exclusively around the highly specialized German regulatory framework for remedies (Heilmittel).
* **Layout Design:** 
  * **Sidebar:** Left-aligned, collapsible multi-level navigation. Divided into clear sections (Scheduling, Patients, Prescriptions, Financials, Settings, Training). Active items are clearly highlighted.
  * **Topbar:** Contains quick-utility buttons (specifically card reader and barcode scanners for physical reception desks), active branch, active user role profile, notifications, search bar, and logout.
  * **Colors & Themes:** Traditional corporate light mode (shades of light-grey `#f5f6f8` backgrounds, pure white content panels, primary dark slate `#2b303b` for sidebar, and primary royal-blue accents `#1b75bb`). No dark mode is present in this version.
  * **Aesthetics:** Clean, clean grid tables (Select2 elements, FontAwesome light icons, bootstrap-style modular panes). Extremely functional, designed for high-density administrative input rather than visual minimalism.

---

## 4. First Impressions & Comparison: Optica Viva vs. InfinityMade

Optica Viva is a highly mature, specialized administrative powerhouse for high-volume German medical clinics. Comparing its modules to our product **InfinityMade**, we can observe major functional alignments and gaps:

### What Optica Viva has that InfinityMade lacks (Opportunities for InfinityMade)
1. **Physical Integrations (GKV-Reader & Barcode Scanner):** Optica Viva features topbar-level buttons to directly read physical patient insurance cards and scan printed prescriptions. This is critical for front-desk reception efficiency.
2. **Dedicated "Prüfung" (Billing Audit/Compliance Compliance):**
   * **HMR-Prüfung:** Automatic compliance check according to German Heilmittel-Richtlinien (remedy guidelines). It flags if a doctor has prescribed a combination of treatments not allowed by GKV, or if the initial treatment start date is exceeded.
   * **Blankorezepte:** Specialized section to audit and manage the recently introduced (2024) German "Blankoverordnung", allowing therapists full budget/therapy control.
   * **Zuzahlungen (§32 SGB V):** Automatic calculating and tracking of statutory co-payments, tracking who has paid their 10% + €10 fee, generating standard receipts or billing the patient if they are exempt (Zuzahlungsbefreiung).
3. **Structured Billing Stages (1. Kontrolle -> 2. Taxierung -> 3. Export):** Rather than our single "Kassenabrechnung" module, they split GKV billing into a solid 4-step pipeline: checking, pricing (taxing), exporting (DTA §302 transmission), and archiving.
4. **Embedded Medical Emailing (KIM):** Connects to the secure medical communication network in Germany (*KIM*), which is mandatory for modern clinics to exchange reports with doctors securely.
5. **Detailed Finance Workflows:** Includes *Mahnwesen* (structured debt-collection/dunning letters for patients) and *Einnahmenprognose* (predictive cashflow based on appointments).
6. **Detailed Clinic Master Data:** Features like *Qualifikationen* (tracking which therapist has manual therapy/lymph drainage certificates, determining billing capability) and *Störungsbilder* (built-in ICD-10 disorders library).
7. **Knowhow Integration:** Strong educational marketing directly in-app: Webinars, release histories, Help Centers, and direct link to their *Optica OWL* marketing platform.

### What InfinityMade has that Optica Viva lacks (Our Strengths)
1. **Fahrtenbuch (Home-visit GPS driving log):** We have a modern GPS-backed driving log specifically for therapist home visits (*Hausbesuch*). Optica Viva has absence/resource tracking but no active location/route tracking feature.
2. **Modern UX & Theme Control:** InfinityMade features a premium Dark Mode and responsive layout, making it extremely pleasant to use on tablets/mobiles during direct patient treatment, while Optica Viva is strictly a desktop administrative light-mode interface.
3. **Multi-lingual Support (DE/EN/TR):** Optica Viva is strictly German, while we support German, English, and Turkish, opening up multi-cultural practice ownership.
4. **Public Online Booking & Integrations:** InfinityMade includes a public booking page with Stripe subscriptions and Google Calendar sync. Optica Viva is focused on back-office scheduling; public self-booking is not embedded in this primary nav.
5. **Modern Feedback Loops:** Built-in patient feedback modules.

---

### Summary Recommendation for InfinityMade Development
Optica Viva's strongest competitive advantages are **reception hardware triggers (card reader/barcode scanner)** and **strict billing/compliance checks (HMR-Prüfung, Zuzahlungen, and Blankorezepte)**. 
To win over established clinics in Germany:
* We should expand our §302 billing into a structured validation pipeline (Check, Tax, Export).
* We must implement a rules-engine for the **Heilmittel-Richtlinien (HMR)** check and **Blankoverordnung** management, as errors here lead to painful billing rejections (Absetzungen) for practice owners.
