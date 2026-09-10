# Grounded Capability Audit: InfinityMade vs. Optica Viva (Competitor Gaps)

**Author:** Senior Systems Engineer  
**Date:** May 25, 2026  
**Subject:** Grounded Technical Codebase Audit and Actionable Reuse Handoff  
**Workspace Root:** `C:\Users\Test\Desktop\claude\website\`  

---

## 1. Executive Reality Check
A prior competitive analysis of rival "Optica Viva" concluded that InfinityMade was suffering from a massive gap in core German billing, compliance, and clinical features. However, that analysis was done by browsing only the public-facing dashboard menus and could not inspect our backend files, thus severely overstating our gaps. A deep architectural audit of the actual `api-backend/` and database migrations reveals a highly sophisticated billing framework that is already built but partially hidden. We have fully implemented the raw engines for SGB V §302 electronic clearing (byte-exact DTA EDIFACT generation), automated statutory patient co-payment calculations, annual patient exemption triggers, and advanced AI-driven prescription validators (including the new 2024 Blankoverordnung shoulder-list rules and KBV LHB/BVB list matches). Out of the 15 candidate features assessed, we possess solid backend capabilities for 4 key areas (HMR rules, §302 clearing, Zuzahlung calculations, and Blankoverordnung rules) which only require minor frontend integrations (our highest ROI "quick wins"). The remaining 11 features (such as therapist qualification gating, reception hardware, dunning, GoBD cash ledgers, and physician report gating) are currently missing. By aggressively wiring our existing backend assets into the UI, we can immediately neutralize Optica's primary compliance moat and begin onboarding high-volume German clinics.

---

## 2. Grounded Status Table

| Feature Name | Status | Evidence (File & Functions) | Reusable Assets We Already Have | What's Needed to Close It | Effort |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HMR-Prüfung Rules Engine** | 🟡 Partial | [validate.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/ai/validators/validate.js#L33-L77): `validateRezept`<br>[standardRules.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/ai/validators/standardRules.js#L57-L148): `validateStandard`<br>[lhbBvbRules.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/ai/validators/lhbBvbRules.js#L28-L131): `validateLhbBvb`<br>[blankoRules.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/ai/validators/blankoRules.js#L44-L153): `validateBlanko` | Fully functional standard prescription limits validator (Orientierende Menge, 28/14-day start deadlines, age-based Zuzahlung exempt rules), dynamic LHB/BVB KBV lists scanner, and Blankoverordnung shoulder EX-diagnosis validation (16-week validity, 28-day begin deadline, Ampelsystem 9% cuts, billing bonuses). | GKV treatment interruption rules checking (validating if session dates exceed 14-day gaps, forcing K/T/F justification codes at the billing stage). | **S** |
| **Structured §302 Clearing Pipeline** | 🟡 Partial | [abrechnung.routes.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/api/abrechnung.routes.js#L107-L385): `POST /abrechnung/create`<br>[preflight.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/dta/preflight.js#L131-L303): `preflight`<br>[builder.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/dta/builder.js#L13-L200): `buildDtaFile`<br>[parser.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/zaa/parser.js#L97-L121): `parseZaaFile` | Robust preflight validator (30+ rules like Modulo 10 check for Absender/Empfänger IKs, KVNR structure, LANR checksum, BSNR format), complete segment-by-segment EDIFACT DTA generator, browser-side PKCS#7 Dakota certified-signing via node-forge ESM lazy-import, and EDIFACT ZAA parser with translation dictionary ([error-translations.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/zaa/error-translations.js#L7-L60)). | Re-layout the frontend Kassenabrechnung dashboard into a clear 4-stage UI wizard (Kontrolle → Taxierung → Export → Archiv) rather than just a checklist. Add the "Heilmittel-Position inline override UI" (Sprint 7-1) to allow manual Positionsnummer picking before exporting (Taxierung stage). | **M** |
| **Zuzahlung Accounting** | 🟡 Partial | [calculator.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/zuzahlung/calculator.js#L41-L72): `calcAbrechnungsfallZuzahlung`<br>[zuzahlungsrechnung.template.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/pdf/zuzahlungsrechnung.template.js#L31-L165): `renderZuzahlungsrechnung`<br>[database_v19_befreiung_auto_flag.sql](file:///C:/Users/Test/Desktop/claude/website/database_v19_befreiung_auto_flag.sql#L25-L96): trigger functions | Complete mathematical statutory co-payment calculator (10% per session + 10€ fee, under-18 check, annual exemption checks), database schemas with Postgres BEFORE/AFTER write triggers to auto-propagate patient exemptions to prescriptions at write time, and A4 print-ready co-payment invoice/receipt HTML template. | Add physical desk cash box tracking (*Einzahlen* desk cash ledger and deposits record UI). | **S** |
| **Blankoverordnung Budget Tracking** | 🟡 Partial | [blankoRules.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/ai/validators/blankoRules.js#L107-L121): Ampelsystem logic inside `validateBlanko` | Fully operational rules schema, shoulder diagnostic check, and Ampelsystem threshold checker in the AI validator. | A frontend patient progress tracker and dynamic budget meter tracking cumulative treatment minutes and budget costs consumed in the EHR/calendar to avoid over-budget penalties. | **M** |
| **Therapieberichte Gating** | ❌ Missing | None found | Standard progress notes/reports schema in database under `notizen_sub` and `lbl_ai_summary`. | Add `bericht_angefordert` (boolean) and `bericht_status` (`offen`, `in_arbeit`, `erledigt`) fields to the `prescriptions` schema. Wire a validation check in `standardRules.js` and `abrechnung.routes.js:mapPrescriptionToDtaShape` to block billing if a report is requested but not complete. Add a UI checkbox in the prescription entry/confirmation flow. | **S** |
| **Tarifänderung Splitting** | ❌ Missing | None found | Static pricing and positions list in [physio_positions.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/codes/physio_positions.js#L16-L94). | Refactor from hardcoded arrays to a dynamic DB table `heilmittel_tarif` that supports pricing validity date ranges, and build a splitting engine in the backend billing creator that divides treatment sessions between old and new tariffs based on treatment dates. | **M** |
| **GoBD Belegliste** | ❌ Missing | None found | None | Create a Postgres database table `public.belegliste` with Supabase RLS policies preventing updates/deletes to record immutable cash receipts, retail logs, and bank transfers, with sequential transaction logging. | **M** |
| **Mahnwesen (Dunning)** | ❌ Missing | None found | None | Create a dunning dashboard tracking overdue patient co-payments, automatic dunning tier progression, and print-ready templates for payment reminders (`Zahlungserinnerung` and `1./2. Mahnung`). | **M** |
| **Therapist Qualifikation Gating** | ❌ Missing | None found | None | Create a new table for staff certificates. Add scheduling validation inside [kalender.js](file:///C:/Users/Test/Desktop/claude/website/kalender.js) that blocks slot booking if the therapist lacks the required specialized certificate (MT, MLD, KGG) for the selected service. | **M** |
| **Reception Hardware** | ❌ Missing | None found | OCR confirmation inputs in [dashboard.js](file:///C:/Users/Test/Desktop/claude/website/dashboard.js#L10213-L10273): `setupRezeptConfirmDropdowns`. | Build a local WebSocket background agent or browser WebUSB connection to talk to physical eHealth chip-card terminals, and simple USB barcode scanner keyboard hooks to scan paper prescription barcodes. | **M** |
| **Messreihen Outcome Tracking** | ❌ Missing | None found | None | Define an outcome metrics database schema, patient clinical entry forms (VAS pain scale, range of motion in degrees), and progress charts visualization in EHR. | **S** |
| **Clinic Analytics / Statistik** | ❌ Missing | None found | Basic database relations for leads and bookings. | Implement SQL aggregate queries, import a charting library (like Chart.js via esm.sh), and build analytics dashboards for doctor referrals cancellation rates, and therapist productivity. | **M** |
| **Tarife / Heilmittelkatalog UI** | ❌ Missing | None found | Static positions data and dynamic HTML option builder `buildPositionOptionsHtml` in [dashboard.js](file:///C:/Users/Test/Desktop/claude/website/dashboard.js#L10295-L10320). | Settings page in the dashboard allowing managers to customize GKV prices or add custom private/retail service lines. | **M** |
| **Waiting-List Matcher** | ❌ Missing | None found | None | Database schema for waiting queue, and waiting list dashboard that matches patient slots by therapist qualifications, availability, and wait duration. | **M** |
| **Keyboard Shortcuts & Compact Mode** | ❌ Missing | None found | Global Escape-key `keydown` listener on line 601 in [dashboard.js](file:///C:/Users/Test/Desktop/claude/website/dashboard.js#L601-L609). | Hotkey router mapping key combinations to dashboard pages, and a global high-density spacing stylesheet toggle class (`.compact-mode`). | **S** |

---

## 3. Quick Connect-the-Dots (Highest ROI Gaps)
These features are fully built in our backend or databases but are **not fully exposed in the UI or not wired together**. Doing these minor integrations will bring immediate high-value features online:

1. **Heilmittel-Position Inline Override UI (Sprint 7-1):**
   * *The Dot:* We have an automated position mapping system in `abrechnung.routes.js:mapPrescriptionToDtaShape` that tries to resolve short-form OCR codes (e.g. "KG") to official GKV codes (e.g., `20501`) via [physio_positions.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/codes/physio_positions.js). However, there is no way for the user to override this before creating an Abrechnung batch if the OCR fails or a special position (like KG-ZNS telemed) is required.
   * *Connect:* Add a `<select>` dropdown populated from `loadPhysioPositions()` directly in each recipe row in the "Abrechnungsbereit" grid (on the Kassenabrechnung tab). Position changes should write directly to the `prescriptions.heilmittel_position` column in Supabase.
2. **Expose Zuzahlung Invoice Printing:**
   * *The Dot:* We have the beautiful, fully-functional co-payment invoice HTML template [zuzahlungsrechnung.template.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/pdf/zuzahlungsrechnung.template.js) and co-payment calculator logic. However, the print link is not exposed in the patient's billing list.
   * *Connect:* In the patient details' Rezepte table or billing history list, add a "Zuzahlungsrechnung drucken" button that requests the rendered template and triggers a standard browser print dialog.
3. **Automate ZAA Correction Workflow:**
   * *The Dot:* We have a fully-functional ZAA response file EDIFACT parser [parser.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/zaa/parser.js) and translation dictionary [error-translations.js](file:///C:/Users/Test/Desktop/claude/website/api-backend/billing/zaa/error-translations.js) that populates `zaa_fehler` records and flags rejected prescriptions.
   * *Connect:* Wire the `zaa_fehler` records into the frontend history table so that a rejected batch shows a warning button. Clicking it should open a modal listing the parsed errors (e.g. "Fehler 101: Positionsnummer unbekannt") and direct fix links (e.g. opening the prescription edit modal with a one-click fix recommendation).

---

## 4. Genuinely Missing (True New Build - Prioritized)
For the gaps that are 100% missing from our codebase, this is the ranked roadmap based on operational priority and GKV clearing risk:

1. **GoBD Belegliste (Receipt Ledger - Priority 1):**
   * *Why:* Mandated by German tax law for any business ledger. Modifiable database records will fail official tax audits.
   * *Build:* Add a `public.belegliste` table in Supabase storing immutable log rows of co-payments and retail receipts. Protect it with SQL triggers or Supabase RLS rules that prevent updates/deletes.
2. **Therapieberichte Gating (Priority 2):**
   * *Why:* GKV clearing houses retroactively claw back payouts if doctors requested a progress report but the clinic billed without sending it.
   * *Build:* Add a `bericht_angefordert` checkbox to the prescription OCR review / manual entry modal. Modify standard rules and `preflight.js` to throw a validation blocker if requested but not complete.
3. **Mahnwesen (Dunning Engine - Priority 3):**
   * *Why:* Patients frequently ignore co-payment invoices; practices spend hours manually chasing debts.
   * *Build:* Build a simple dashboard tracking invoices that have passed their due dates. Add templates to print standard German dunning letters (`Zahlungserinnerung`, `1. Mahnung`, `2. Mahnung`) with automated late fees.
4. **Therapist Certificate Gating (Priority 4):**
   * *Why:* Prevents scheduling specialized treatments (like Manual Therapy or Lymph Drainage) with therapists who lack the certification, protecting the practice from automated insurance chargebacks (*Absetzungen*).
   * *Build:* A dynamic certifications table for employees. Add scheduling checks in `kalender.js` calendar bookings.
5. **Blankoverordnung Calendar Tracker (Priority 5):**
   * *Why:* Comply with new 16-week validity and active budget rules under § 125a SGB V.
   * *Build:* Add visual progress bars on Blankoverordnung patient records showing how many sessions, treatment minutes, and costs have been consumed vs. the Ampelsystem thresholds.

---

## 5. Stale / Half-Done Work Needing Polish
* **DTA Test vs. Echt-Mode Toggle:**
  Our `builder.js` currently hardcodes the DTA transmission indicator `kind: 'test'` (representing a Dakota test submission). Once a clinic passes the initial submission checks with their Datenannahmestellen (DAS), they must be able to switch to `kind: 'echt'`. We need to expose a simple configuration toggle in settings under "Abrechnung" to flip between test and production transmission modes.
* **Expand the ZAA Error dictionary:**
  The `error-translations.js` dictionary currently contains ~40 of the most common GKV/ITSG error codes. During pilot testing with real-world DAS portals (Davaso, DDG, Bitmarck), new rejection codes will inevitably appear. The dictionary must be progressively expanded to cover ~100 codes to ensure that we maintain high-quality, actionable error translations and "fix hints" for therapists.
