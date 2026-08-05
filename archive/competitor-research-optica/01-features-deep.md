# Competitor Analysis Report: Optica Viva Features & Workflows Deep-Dive

**Author:** Competitive Analysis Sub-Agent  
**Date:** May 25, 2026  
**Target Competitor:** Optica Viva (SaaS Web App for German Physiotherapy, Ergotherapy, and Speech Therapy Practices)  
**Subject URL:** [https://demo.opticaviva.de/index](https://demo.opticaviva.de/index)  
**Comparison Product:** InfinityMade (German Practice Management SaaS)  

---

## Executive Summary
This report provides a granular, factual, and workflow-centric analysis of **Optica Viva**, focusing on features, scheduling models, EHR components, prescription lifecycle management, master data, and analytics. The goal is to compare Optica Viva's capabilities with our product, **InfinityMade**, and rank feature gaps based on their importance for thriving German physical therapy practices.

All screenshots cited below are saved as absolute paths in: `C:\Users\Test\Desktop\claude\website\competitor-research\optica\screens\`

---

## Module 1: Dashboard

### 1. Capabilities & Actionable Workflows
The Optica Viva Dashboard serves as a clinical and operational mission control. It is built to drive practice compliance and efficiency by aggregating daily tasks, reminders, and patient warnings alongside direct links to regulatory action items.

Key widgets and sections:
*   **Daily Schedule Feed:** Shows a chronological list of today's appointments, including therapist names, treatment types, and specific icons (e.g., for home visits).
*   **Task List (Aufgaben):** Actionable list displaying title, deadline (Frist), and quick complete checkboxes (e.g., "Offene Termine kontrollieren", "Zuzahlung von Max einfordern").
*   **Reminders (Erinnerungen):** Real-time warnings highlighting compliance gaps:
    *   Number of open appointments (offene Termine) that require validation.
    *   Number of missing or open therapy reports (offene Therapieberichte) split between GKV (Statutory) and Privat.
    *   Time-tracking exceptions (Offene Zeitbuchungen) and pending vacation approvals (Offene Urlaubsgenehmigungen).
*   **Keyboard Shortcuts (Tastaturkürzel):** An overlay panel showing power-user shortcuts (e.g., `Shift+K` for Kalender, `Shift+P` for Patienten) for hyper-fast clinic navigation without a mouse.

### 2. Notable & Clever Features
*   **Visual Warning Badges:** Color-coded alert dots flag patient accounts with negative ledger balances or outstanding GKV co-payments (Zuzahlung).
*   **Shortcut Integrations:** Users can immediately click dashboard widgets to go directly to batch operations (e.g., clicking "7 offene Termine" immediately routes to the validation wizard).

### 3. Comparison with InfinityMade
InfinityMade has an "Übersicht" (Dashboard) showing daily appointments and general stats. However, InfinityMade lacks targeted German compliance tracking, such as pending GKV therapy reports (Therapieberichte), HMR-compliance indicators, or automated employee time-sheet warnings on the main view.

*   **Screenshot:** `featA-01-dashboard.png`

---

## Module 2: Kalender, Abwesenheiten, Ressourcen & Urlaubskalender

### 1. Capabilities & Scheduling Model
The calendar is the heart of the application. It uses a highly robust, interactive multi-column grid mapped by therapist, therapy room, or equipment, featuring seamless drag-and-drop.

*   **View Options:** Toggle between Single Day, 3-Day, Week, Month, and Therapist (columns).
*   **Urlaubskalender (Holiday Calendar):** Central visual overview showing national holidays and therapist vacation states.
*   **Abwesenheiten (Absence Manager):** Mapped timelines of therapist absences (illness, education, vacation) showing approval statuses.
*   **Ressourcen (Resources Allocation):** Dedicated columns and filters for vehicles (e.g., `Auto Golf` for home visits), specialized medical equipment (e.g., `Cryosauna`), and specific rooms (`Raum 1`, `Raum 2`).

### 2. Notable & Clever Features
*   **Pre- & Post-Therapy Buffers (Vorbereitungs- & Nachbereitungszeit):** Located directly in the booking modal (`generic-appointment-modal-preparation-time-toggle`). It allows the clinic to block out distinct preparation/cleaning buffers (e.g., 5 min, 10 min, or custom) before or after an appointment. Crucially, the system offers a checkbox to decide whether this buffer blocks the **Therapist**, the **Therapy Room**, or **both** (`blockTherapyRoomDuringPrePostTherapyTime`).
*   **Schnellerfassung (Quick Enrollment modal):** Allows front desk staff to create a brand-new patient record and book their first appointment simultaneously within the calendar flow, eliminating the need to leave the screen to create the patient first.
*   **Terminvorgehen (Appointment Workflows):** Integrates preset sequences of service steps matching therapeutic guidelines.

### 3. Comparison with InfinityMade
While InfinityMade features a Google Calendar sync and therapist columns, it completely lacks:
1.  **Vorbereitungs- & Nachbereitungszeit (Buffer rules):** Essential for physiotherapists to clean rooms or write clinical entries between back-to-back 20-minute sessions.
2.  **Resource Booking Gating:** The ability to block physical devices (like gym machines or ultrasound) or clinic vehicles automatically when booking home visits (Hausbesuche).
3.  **Schnellerfassung:** Staff in InfinityMade must navigate away to the patient registry to create a client before booking.

*   **Screenshots:**
    *   Calendar Grid: `featA-02-kalender.png`
    *   Booking Modal & Buffers: `featA-02b-termin-modal.png`
    *   Resource Columns: `featA-02c-ressourcen.png`
    *   Urlaubskalender: `featA-02d-urlaubskalender.png`

---

## Module 3: Aufgaben, Notizen, Dateien & KIM

### 1. Capabilities & Workflow
*   **Aufgaben (Internal Tasks):** Split into two distinct tab structures: "An Therapeut" (delegated by the owner to a therapist) and "Von Therapeut" (submitted by a therapist to the owner). Fields include: Title, description, priority, therapist assignee, and respite date.
*   **Notizen (Clinic Notes):** Acts as a collaborative intranet wiki. Forms allow text formatting for clinic checklists, delegation processes, and general board meetings.
*   **Dateien (File Manager):** A central digital filing cabinet. Supports drag-and-drop uploads of audio, images, PDFs, and videos up to 100MB. Files can be flagged as "visible in templates" (`visibleInTemplates`) to easily attach them to patient mailings or medical reports.
*   **KIM (Kommunikation im Medizinwesen):** A highly specialized, secure email module integrated with the Telematikinfrastruktur (TI). Enables legal, end-to-end encrypted exchange of electronic medical reports (e-Arztbriefe) and therapy reports directly between the physio practice and physicians.

### 2. Notable & Clever Features
*   **Contextual File Flags:** Flagging uploaded documents so they are dynamically pulled into invoice attachments or print templates.
*   **TI Integration via KIM:** Complete elimination of paper-based physician correspondence.

### 3. Comparison with InfinityMade
InfinityMade supports general notes and simple image/PDF uploads. However, InfinityMade lacks:
1.  **KIM Integration:** A major competitive disadvantage in Germany, where digital integration with the Telematikinfrastruktur is increasingly mandated.
2.  **Visible in Templates Flag:** Files in InfinityMade are static and cannot be mapped dynamically to automated templates.

*   **Screenshots:**
    *   Tasks: `featA-03-aufgaben.png`
    *   Wiki Notes: `featA-04-notizen.png`
    *   File Cabinet: `featA-05-dateimanager.png`
    *   KIM Panel: `featA-06-kim.png`

---

## Module 4: Patienten

### 1. EHR Record Tabs & Fields
Opening a patient record (e.g., Eli Strehlau) reveals an extensive, tab-based Electronic Health Record (EHR) designed specifically for rehabilitation environments.

Key Tabs & Data Structures:
*   **Stammdaten (Master Data):** Patient title, name, gender, nickname, birthdate, home phone, mobile, work phone, email, and internal comments. Also displays a visual credit indicator (`Konto: -130,65€`) to flag unpaid sessions or cash register debts.
*   **Warteliste (Waiting List):** Integrates preferred therapists, desired time frames (e.g., mornings only), GKV/Private insurance, target diagnosis codes, and automatically calculates waiting duration in days.
*   **Patientengruppen (Groups):** Enables clustering patients into groups (e.g., "Rehasport Gruppe A") for batch booking and group billing.
*   **Messreihen (Measurement Series):** Built-in clinical outcome tracking. Tracks specific measurement metrics (e.g., degrees of extension, pain scales, endurance indicators) over multiple sessions, generating visual progression curves.
*   **Patientenkonto (Clinic Ledger):** Financial ledger showing invoice numbers, booking dates, transaction types (debits/credits), and cash book client details.
*   **B2C retail Sales (Verkäufe):** Directly log sales of retail items (massage oils, kinesiology tape, blackrolls) onto the patient record, calculating VAT and printing receipt QR codes.
*   **Anamnesen (Medical History):** Custom clinic intake questionnaires completed on screen or via tablets.
*   **Kontaktpersonen:** Directory for emergency contacts, legal guardians, or doctors.
*   **Patienten-Import:** Smart importer mapping CSV/Excel columns directly to standard fields.

### 2. Notable & Clever Features
*   **Dynamic Ledger Warnings:** If a patient has outstanding B2C or co-payment debts, their name is flagged in red throughout the booking flow.
*   **Outcome Tracking (Messreihen):** Direct pairing of clinical progression metrics to treatment outcomes, allowing easy PDF exports for referring physicians.

### 3. Comparison with InfinityMade
InfinityMade features a basic patient list and simple anamnesis. However, InfinityMade has no:
1.  **Built-in Waiting List Matcher:** Gating preferred times, therapist qualifications, and calculating wait-times.
2.  **Messreihen (Outcome progression tracking):** Required by modern German practices to prove therapeutic outcomes.
3.  **B2C retail selling and ledgers directly tied to patient files.**

*   **Screenshots:**
    *   Patient Grid: `featA-07-patientenliste.png`
    *   EHR Tabs & Ledger: `featA-07f-patientendetails-eli.png`
    *   Waiting List: `featA-07b-patientenarchiv.png`

---

## Module 5: Rezepte (Prescriptions)

### 1. Prescription Record Lifecycle
Optica Viva tracks statutory (Kassenrezepte), private (Privatrezepte), and work accident (BG- & UK-Rezepte) prescriptions through a rigid compliance lifecycle:
`Erfasst (Entered) -> In Arbeit (In Progress) -> Kontrolliert (Checked) -> Taxiert (Taxed) -> Abgerechnet (Billed)`

Key Fields & Tracked Workflows:
*   **Heilmittelkatalog (HMK) Integration:** Full mapping of standard GKV Heilmittel codes (e.g., `KG` - Krankengymnastik, `MLD` - Lymphdrainage).
*   **Prescription Metadata:** Target deadlines for starting therapy (e.g., 28 days from date of issue), therapist qualification checks, double-treatment checkboxes (Doppelbehandlung), home therapy indicators, and mileage counters (Wegstrecke/Kilometer).
*   **GKV Co-payment (Zuzahlung):** Automatically calculates the mandatory patient fee (10€ flat fee + 10% of the GKV price list value) and flags payment status (paid, exempt, or open).
*   **GKV Interruption Rules (Unterbrechungsprüfungen):** Enforces compliance with GKV framework contracts (e.g., checking if therapy was interrupted for more than 14 days and requiring documented reasons like sickness, holiday, or coordinate breaks).
*   **Therapieberichte (Physician Reports):** An automated wizard that compiles diagnosis details, clinical findings, progress targets, break reasons, and future therapy recommendations into a professional medical report.

### 2. Notable & Clever Features
*   **Smart Report Builder:** The therapist report generator automatically pulls the patient's diagnostic codes, treatment goals, and progress notes, allowing the therapist to build a complete report via quick checkboxes rather than manual typing.
*   **Interruption Guard:** Instantly warns the scheduler if dragging an appointment violates GKV framework limits.

### 3. Comparison with InfinityMade
InfinityMade features a simple prescription scanner but completely lacks:
1.  **Automated GKV framework contract validators:** Does not block scheduling when a therapist violates start-deadlines or maximum interruption windows.
2.  **Dynamic Zuzahlung calculations:** Practice owners must manually calculate co-payment invoices.
3.  **Structured Therapiebericht Wizards:** No clinical templates to draft doctor reports automatically.

*   **Screenshots:**
    *   Prescription Registry: `featA-08-rezepte-kassen.png`
    *   Prescription EHR and HMK Validation: `featA-08d-rezeptdetails-1.png`

---

## Module 6: Verwaltung (Master Data)

### 1. Capabilities & Workflows
The administration module acts as the practice’s operational foundation. It controls critical gates that link clinical scheduling to German billing rules.

Key Master Data Components:
*   **Qualifikationen (Therapist Certificates):** Defines specialized billing qualifications (e.g., `MT` - Manuelle Therapie, `KGG` - Krankengymnastik am Gerät, `MLD` - Manuelle Lymphdrainage). 
    *   *Smart Integration:* You assign these certificates to employee records. The scheduling system then strictly gates calendar bookings—preventing front desk staff from assigning an `MT` treatment to a therapist who does not hold the MT certificate, avoiding billing rejections.
*   **Störungsbilder (Clinical Syndromes):** A pre-loaded dictionary of clinical syndromes matched to pre-compiled therapeutic steps and ICD-10 codes.
*   **Ärzte (Physicians Directory):** Comprehensive directory of referring physicians. Captures BSNR (Betriebsstättennummer), LANR (Lebenslange Arztnummer), special contract validation toggles, and KIM addresses.
*   **Anamnesen Builder:** Custom clinical intake designer allowing fields, checkboxes, and text blocks to be arranged dynamically.
*   **Messreihen Config:** Tool to define progression scales (e.g., VAS Pain Scale 1-10, range of motion in degrees).
*   **Patientenakquisen (Acquisition Channels):** Configures tracking of referral channels (e.g., "Google Maps", "Doctor Recommendation", "Flyer") to evaluate marketing efficacy.

### 2. Comparison with InfinityMade
While InfinityMade stores basic employee and service lists, it lacks the specialized regulatory safety nets:
1.  **Therapist Qualification Gating:** InfinityMade allows any therapist to be booked for any service, risking massive financial losses from statutory health insurance billing rejections (Absetzungen).
2.  **Pre-loaded German LANR/BSNR Directories:** No built-in verification of physician numbers.
3.  **Custom Intake & Outcome Scale builders.**

*   **Screenshots:**
    *   Anamnesen Custom Builder: `featA-09-verwaltung-anamnesen.png`
    *   Störungsbilder Settings: `featA-10-verwaltung-stoerungsbilder.png`
    *   Doctors Registry: `featA-11-verwaltung-aerzte.png`

---

## Module 7: Statistik (Analytics)

### 1. Insights & Charts
Optica Viva's statistics engine is designed to optimize practice profitability and evaluate clinical relationships.

Key Analytical Views:
*   **Umsatz (Revenue Analytics):** Visualizes revenue trends, billing methods, and split-performance over time.
*   **Ärzte (Physician referrals):** Uncovers which local doctors refer the most patients and generate the highest revenue. Essential for practice B2B networking.
*   **Diagnosen (Clinical Distribution):** Charts the distribution of ICD-10 diagnosis codes treated in the clinic.
*   **Krankenkassen (Insurances):** Analyzes revenue share by statutory health insurance (AOK, Barmer, etc.) vs. private payers.
*   **Therapeuten (Productivity):** Displays therapist working hours, actual treated volume, cancellations, and overall productivity stats.

### 2. Comparison with InfinityMade
InfinityMade offers standard financial reports. However, it lacks crucial clinic-specific reports:
1.  **Physician Referral Valuation:** Knowing which doctor drives the most billing value.
2.  **Therapist Productivity Cancellation metrics.**
3.  **ICD-10 clinical volume distribution.**

*   **Screenshots:**
    *   Revenue Analytics: `featA-16-statistik-umsatz.png`
    *   Therapist Productivity Charts: `featA-16e-statistik-therapeuten.png`

---

## Module 8: Im-/Export, Einstellungen, Knowhow & Support

### 1. Capabilities & Workflows
*   **Im- & Export:** Allows complete data portability. Custom CSV pipelines export Anamnesen, doctors directories, measurement series, patient registries, and private tariffs.
*   **Einstellungen (Practice Settings):**
    *   *Dienste (Integrations):* External SMS Gateways, email routing, and calendar synchronization.
    *   *Vorlagen (Templates):* Sophisticated visual document layout designer. Users can tweak print margins down to the millimeter (`PAGE1_MARGIN_TOP`, `PAGE1_MARGIN_BOTTOM`, etc.) and adjust address offset parameters (`PAGE1_ADDRESS_MARGIN_TOP`) to guarantee that printouts align perfectly with standard German window envelopes (DIN C6/5).
*   **Knowhow & Support:** Integrated help center, updates log, FAQ libraries, and contextual ticket routing (where a user can directly attach the affected patient ID or prescription ID to the support query).

### 2. Comparison with InfinityMade
*   InfinityMade lacks precise page margin and address-offset print customizers, which often results in alignment issues when practices print invoices using standard German envelopes.
*   Support tickets in InfinityMade are basic email forms with no context-sensitive patient/prescription attachment routing.

*   **Screenshots:**
    *   Settings & Integrations: `featA-17-einstellungen-dienste.png`
    *   Document Template Margin customizer: `featA-17e-einstellungen-vorlagen.png`

---

## Feature Gaps for InfinityMade
*(Ranked by how impactful they are for a German physiotherapy practice)*

### 1. GKV Heilmittelkatalog & Framework Contract Validators
*   **Impact:** **CRITICAL (High Risk of Revenue Loss)**
*   **Description:** In Germany, a single mistake on a GKV prescription (e.g., starting 29 days after issue instead of 28, or exceeding the 14-day interruption limit without documenting a valid reason) will result in a **full billing rejection (Absetzung)** by the clearing houses.
*   **Actionable Recommendation:** Implement an automated GKV framework calendar-validator in InfinityMade. It must alert schedulers in real-time when dragging appointments violates start timelines or maximum interruption windows, requiring a standard GKV justification code.

### 2. Therapist Qualification Gating
*   **Impact:** **CRITICAL (Operational Risk)**
*   **Description:** Billing for Manuelle Therapie (MT) or lymphatic drainage (MLD) requires therapists to hold registered state certificates. Assigning these to an uncertified therapist is illegal and results in billing rejections.
*   **Actionable Recommendation:** Add a "Qualifications" certificate list to InfinityMade's employee master records. Map these certificates to practice services and strictly gate the calendar booking flow, blocking bookings that lack qualified assignees.

### 3. Automated Zuzahlung (Co-payment) Billing
*   **Impact:** **HIGH (Practice Efficacy)**
*   **Description:** Practices are legally required to collect co-payments (10€ + 10%) from GKV patients at the start of therapy.
*   **Actionable Recommendation:** Integrate automated co-payment invoicing inside InfinityMade. Upon scanning or entering a GKV prescription, automatically compute the co-payment fee based on standard GKV price lists, log it as an open debt on the patient's ledger, and print the Zuzahlung invoice.

### 4. Vor- & Nachbereitungszeit (Preparation Buffers)
*   **Impact:** **MEDIUM (Therapist Workload & Hygiene)**
*   **Description:** German physical therapists operate on tight 20-minute cadences. Without buffer times, they cannot sanitize rooms or complete documentation.
*   **Actionable Recommendation:** Implement pre- and post-therapy buffer time options inside InfinityMade's appointment booking modal. Schedulers should be able to toggle 5-15 minute buffers that block out either the therapist, the room, or both.

### 5. Messreihen (Outcome Tracking Metric Scales)
*   **Impact:** **MEDIUM (Quality of Care & Marketing)**
*   **Description:** Modern practices rely on standardized metrics to prove treatment efficacy to referring physicians and private patients.
*   **Actionable Recommendation:** Add custom measurement series (Messreihen) templates into InfinityMade patient files, enabling therapists to input pain scores or range of motion metrics and export a visual progress chart.

---
*Report complete. Technical findings and visual artifacts have been fully validated.*
