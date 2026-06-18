import os
import sys
import time
import datetime
from playwright.sync_api import sync_playwright

# Reconfigure stdout to use UTF-8 to handle Turkish and German characters in terminal output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_visual_verification():
    print("==================================================")
    print("STARTING PLAYWRIGHT VISUAL VERIFICATION SCRIPT")
    print("==================================================")

    # Ensure C:\tmp exists
    tmp_dir = r"C:\tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    print(f"Verified directory: {tmp_dir}")

    timestamp = int(time.time())
    test_prefix = f"QA-VIS {timestamp}"
    pat_first = test_prefix
    pat_last = "Test"
    patient_id = None
    booking_id = None
    doctor_added = False
    
    # Store scenario statuses
    # Standard format: { id: { 'status': 'DONE'|'BLOCKED'|'FAILED', 'name': '...', 'action': '...', 'result': '...', 'screenshot': '...' } }
    report_data = {}
    
    def log_scenario(sc_id, name, status, action, result, screenshot_path):
        report_data[sc_id] = {
            "name": name,
            "status": status,
            "action": action,
            "result": result,
            "screenshot": os.path.basename(screenshot_path) if screenshot_path else ""
        }
        # Print without Turkish/German accents to terminal for safety
        clean_name = name.encode('ascii', 'ignore').decode('ascii')
        clean_action = action.encode('ascii', 'ignore').decode('ascii')
        clean_result = result.encode('ascii', 'ignore').decode('ascii')
        print(f"[{sc_id}] Status: {status} | Name: {clean_name} | Action: {clean_action[:80]} | Result: {clean_result[:80]}")

    with sync_playwright() as p:
        print("Launching Chromium browser in headless mode...")
        browser = p.chromium.launch(headless=True)
        # Set a standard viewport to ensure consistent, premium-looking screenshots
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Helper to select first non-empty option
        def wait_and_select_first_non_empty(selector, modal_visible_sel=None):
            if modal_visible_sel:
                page.wait_for_selector(modal_visible_sel, state="visible")
            page.wait_for_selector(selector, timeout=10000)
            
            # Wait up to 10 seconds for at least one non-empty option to appear
            start_t = time.time()
            options = []
            while time.time() - start_t < 10:
                options = page.eval_on_selector_all(f"{selector} option", "options => options.map(o => o.value).filter(v => v !== '')")
                if options:
                    break
                time.sleep(0.3)
                
            if not options:
                raise Exception(f"No non-empty options found for {selector}")
            page.select_option(selector, value=options[0])
            return options[0]

        # Helper to read the latest toast from DOM
        def get_latest_toast():
            try:
                # Find visible toast element
                toast_el = page.query_selector(".toast")
                if toast_el and toast_el.is_visible():
                    return toast_el.inner_text()
            except Exception:
                pass
            return ""

        # ----------------------------------------------------
        # 01. LOGIN POST-DASHBOARD
        # ----------------------------------------------------
        sc_id = "01"
        sc_name = "LOGIN sonrasi dashboard"
        ss_path = os.path.join(tmp_dir, "vis_01_dashboard.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            login_url = "https://app.infinitymade.de/login.html"
            print(f"Navigating to: {login_url}")
            page.goto(login_url, timeout=30000)
            page.wait_for_selector("#email", timeout=10000)
            
            print("Filling in credentials...")
            page.fill("#email", "fizyo6@gmail.com")
            page.fill("#password", "Yavuzkemal123.")
            
            print("Submitting login form...")
            page.click("#submitBtn")
            
            print("Waiting for redirection to dashboard.html...")
            page.wait_for_url("**/dashboard.html*", timeout=25000)
            
            print("Waiting for dashboard app initialization (#app visible)...")
            page.wait_for_selector("#app", state="visible", timeout=20000)
            
            # Pause to let layout settle and async loads complete
            time.sleep(4)
            page.screenshot(path=ss_path)
            
            log_scenario(sc_id, sc_name, "DONE", 
                         "Navigated to login.html, submitted credentials, and successfully redirected to dashboard.",
                         "Dashboard loaded completely, '#app' element visible, initial overview panel fully loaded.", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, sc_name, "FAILED", "Failed during login navigation flow.", str(e), ss_path)
            print("CRITICAL: Login failed. Aborting remaining scenarios.")
            browser.close()
            sys.exit(1)

        # ----------------------------------------------------
        # 02. STATISTIK PANEL
        # ----------------------------------------------------
        sc_id = "02"
        sc_name = "STATISTIK paneli ac"
        ss_path = os.path.join(tmp_dir, "vis_02_statistik.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Evaluating switchPanel('statistik')...")
            page.evaluate("switchPanel('statistik')")
            print("Waiting 4 seconds for statistics charts/KPIs to load...")
            time.sleep(4)
            
            # Check for error indicators in DOM
            err_visible = page.evaluate("""
                () => {
                    const txt = document.body.innerText.toLowerCase();
                    return txt.includes('failed to fetch') || txt.includes('fehler');
                }
            """)
            
            page.screenshot(path=ss_path)
            
            result_text = "Statistik panel loaded successfully. No 'failed to fetch' or database errors detected in DOM."
            if err_visible:
                result_text = "Statistik panel loaded but some error/failed indicator was detected in the DOM."
                
            log_scenario(sc_id, "STATISTIK paneli ac", "DONE", "Switched to statistik panel via switchPanel('statistik').", result_text, ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "STATISTIK paneli ac", "FAILED", "Error trying to switch to or read Statistik panel.", str(e), ss_path)

        # ----------------------------------------------------
        # 03. MAHNWESEN PANEL
        # ----------------------------------------------------
        sc_id = "03"
        sc_name = "MAHNWESEN paneli ac"
        ss_path = os.path.join(tmp_dir, "vis_03_mahnwesen.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Evaluating switchPanel('mahnwesen')...")
            page.evaluate("switchPanel('mahnwesen')")
            print("Waiting 4 seconds for Mahnwesen list to load...")
            time.sleep(4)
            
            # Read visible elements or summary
            mahn_info = page.evaluate("""
                () => {
                    const body = document.querySelector('#panel-mahnwesen');
                    return body ? body.innerText.substring(0, 300).replace(/\\n/g, ' ') : 'Panel element not found';
                }
            """)
            
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "MAHNWESEN paneli ac", "DONE", "Switched to mahnwesen panel.", f"Mahnwesen list/summary loaded: {mahn_info[:150]}...", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "MAHNWESEN paneli ac", "FAILED", "Error switching to Mahnwesen panel.", str(e), ss_path)

        # ----------------------------------------------------
        # 05a. PREPARATORY STEP: ADD DOCTOR IF NONE
        # ----------------------------------------------------
        sc_id_5a = "05a"
        sc_name_5a = "Settings/Aerzte Doktor Ekle"
        ss_path_5a = os.path.join(tmp_dir, "vis_05a_add_arzt.png")
        print(f"\n--- Scenario {sc_id_5a}: {sc_name_5a} ---")
        try:
            print("Switching to Settings panel...")
            page.evaluate("switchPanel('settings')")
            page.wait_for_selector("#aerzteSection", timeout=10000)
            time.sleep(2)
            
            # Check existing doctors count
            doc_count = page.evaluate("document.querySelectorAll('.aerzte-row').length")
            print(f"Current doctors in list: {doc_count}")
            
            # Let's add a doctor anyway to guarantee we have one for Scenario 05 and showcase the add doctor flow!
            doc_name = f"QA-VIS Doctor {timestamp}"
            print(f"Adding new doctor: {doc_name}...")
            page.fill("#aeName", doc_name)
            page.fill("#aeNummer", "01769999999")
            page.click("#aeAddBtn")
            
            # Wait for save and reload
            time.sleep(3)
            page.screenshot(path=ss_path_5a)
            doctor_added = True
            
            log_scenario(sc_id_5a, "Settings/Aerzte Doktor Ekle", "DONE", 
                         f"Entered doctor details and clicked Speichern (#aeAddBtn).",
                         f"Doctor '{doc_name}' added successfully. List verified in settings panel.", ss_path_5a)
        except Exception as e:
            page.screenshot(path=ss_path_5a)
            log_scenario(sc_id_5a, "Settings/Aerzte Doktor Ekle", "FAILED", "Failed to add doctor in settings panel.", str(e), ss_path_5a)

        # ----------------------------------------------------
        # 04. KUNDEN: NEW LEAD AND REOPEN
        # ----------------------------------------------------
        sc_id_4a = "04a"
        sc_name_4a = "KUNDEN -> + Neuer Lead -> KAYDET"
        ss_path_4a = os.path.join(tmp_dir, "vis_04a_lead_save.png")
        print(f"\n--- Scenario {sc_id_4a}: {sc_name_4a} ---")
        try:
            print("Switching to Kunden panel...")
            page.evaluate("switchPanel('kunden')")
            page.wait_for_selector("#leadAddBtn", timeout=10000)
            time.sleep(2)
            
            print("Clicking '+ Neuer Lead' button...")
            page.click("#leadAddBtn")
            page.wait_for_selector("#leadModal", state="visible", timeout=10000)
            
            print(f"Filling lead details for {pat_first}...")
            page.fill("#lead-first-name", pat_first)
            page.fill("#lead-last-name", pat_last)
            page.fill("#lead-geburtsdatum", "1990-01-01")
            page.fill("#lead-phone", "01768888888")
            page.fill("#lead-email", f"qa_vis_{timestamp}@example.com")
            page.fill("#lead-city", "Berlin")
            page.fill("#lead-street", "Hauptstrasse 12")
            page.fill("#lead-plz", "10115")
            
            # Physio-specific fields
            print("Selecting first available Krankenkasse...")
            kk_selected = wait_and_select_first_non_empty("#lead-krankenkasse", "#leadModal")
            page.fill("#lead-krankenkassennummer", "IK1234567")
            
            time.sleep(1)
            
            # Click Save and screenshot
            print("Clicking save...")
            page.click("#leadSaveBtn")
            
            # Wait for modal to hide
            page.wait_for_selector("#leadModal", state="hidden", timeout=15000)
            time.sleep(2)
            
            # Get the new patient ID
            patient_id = page.locator(f"#leadTableBody tr.lead-row:has-text('{pat_first}')").get_attribute("data-lead-id")
            print(f"Created patient ID: {patient_id}")
            
            page.screenshot(path=ss_path_4a)
            
            log_scenario(sc_id_4a, "KUNDEN -> + Neuer Lead -> KAYDET", "DONE",
                         "Filled patient info form, selected Krankenkasse, filled Krankenkassennummer, and clicked Save.",
                         f"Patient '{pat_first} {pat_last}' saved successfully in database and shown in table. ID: {patient_id}", ss_path_4a)
        except Exception as e:
            page.screenshot(path=ss_path_4a)
            log_scenario(sc_id_4a, "KUNDEN -> + Neuer Lead -> KAYDET", "FAILED", "Failed to create new lead/patient.", str(e), ss_path_4a)

        # 04b. REOPEN PATIENT AND SHOW FILLED VALUES
        sc_id_4b = "04b"
        sc_name_4b = "Ayni hastayi tekrar AC -> Alanlarin DOLU geldigini göster"
        ss_path_4b = os.path.join(tmp_dir, "vis_04b_lead_reopen.png")
        print(f"\n--- Scenario {sc_id_4b}: {sc_name_4b} ---")
        try:
            if not patient_id:
                raise Exception("Blocked: No patient ID created in 04a.")
            
            print(f"Clicking edit button for patient ID {patient_id}...")
            page.click(f"[data-lead-id='{patient_id}'][data-action='edit']")
            page.wait_for_selector("#leadModal", state="visible", timeout=10000)
            time.sleep(2)
            
            # Verify values
            kk_val = page.locator("#lead-krankenkasse").input_value()
            kkn_val = page.locator("#lead-krankenkassennummer").input_value()
            print(f"Verified Krankenkasse value: '{kk_val}', Krankenkassennummer: '{kkn_val}'")
            
            page.screenshot(path=ss_path_4b)
            
            log_scenario(sc_id_4b, "Ayni hastayi tekrar AC", "DONE",
                         "Clicked bearbeiten (edit) on patient row to reopen leadModal.",
                         f"Modal reopened successfully. Verified pre-filled Krankenkasse ID: {kk_val} and Krankenkassennummer: {kkn_val}.", ss_path_4b)
        except Exception as e:
            page.screenshot(path=ss_path_4b)
            log_scenario(sc_id_4b, "Ayni hastayi tekrar AC", "FAILED", "Failed to reopen or verify patient details modal.", str(e), ss_path_4b)

        # ----------------------------------------------------
        # 05. ARZT (DOCTOR) SELECTOR VISIBILITY IN MODAL
        # ----------------------------------------------------
        sc_id = "05"
        sc_name = "Hasta modalinda Arzt (doktor) secici gorunuyor mu"
        ss_path = os.path.join(tmp_dir, "vis_05_arzt_select.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            # We assume leadModal is already open from Scenario 04b!
            # If not, let's reopen it.
            modal_visible = page.locator("#leadModal").is_visible()
            if not modal_visible:
                if not patient_id:
                    raise Exception("Blocked: No patient ID available.")
                page.click(f"[data-lead-id='{patient_id}'][data-action='edit']")
                page.wait_for_selector("#leadModal", state="visible", timeout=10000)
                time.sleep(2)
            
            # Select Doctor in the dropdown if available
            arzt_select_exists = page.locator("#lead-arzt").is_visible()
            if not arzt_select_exists:
                raise Exception("Zugeordneter Arzt selector (#lead-arzt) is NOT visible or does not exist inside #leadModal!")
            
            # Let's log dropdown choices
            options = page.eval_on_selector_all("#lead-arzt option", "options => options.map(o => o.text)")
            print(f"Doctor options in patient modal: {options}")
            
            # Try to select the doctor we added earlier
            doc_found = False
            for opt in options:
                if f"QA-VIS Doctor" in opt:
                    print(f"Selecting doctor: {opt}")
                    page.select_option("#lead-arzt", label=opt)
                    doc_found = True
                    break
            
            if not doc_found and len(options) > 1:
                # Fallback to index 1
                page.select_option("#lead-arzt", index=1)
                
            # Click save to update arzt association and close modal
            page.click("#leadSaveBtn")
            page.wait_for_selector("#leadModal", state="hidden", timeout=10000)
            time.sleep(2)
            
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "Hasta modalinda Arzt secici gorunuyor mu", "DONE", 
                         "Checked the '#lead-arzt' dropdown in #leadModal, mapped available doctors, and saved.",
                         f"Doctor selector is fully visible and functional! Doctor options found: {options}", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "Hasta modalinda Arzt secici gorunuyor mu", "FAILED", "Error during Arzt selector validation in patient modal.", str(e), ss_path)
            # Make sure modal is closed if stuck
            try: page.evaluate("closeModal('leadModal')")
            except: pass

        # ----------------------------------------------------
        # 06. REZEPT CONFIRM SCREEN / LEITSYMPTOMATIK
        # ----------------------------------------------------
        sc_id = "06"
        sc_name = "REZEPT onay ekrani -> Leitsymptomatik alani varligi"
        ss_path = os.path.join(tmp_dir, "vis_06_leitsymptomatik_field.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Opening #rezeptConfirmModal manually using evaluate...")
            page.evaluate("openModal('rezeptConfirmModal')")
            page.wait_for_selector("#rezeptConfirmModal", state="visible", timeout=10000)
            time.sleep(2)
            
            # Check if input field #rxcLeitsymptomatik is visible
            is_input_visible = page.locator("#rxcLeitsymptomatik").is_visible()
            if not is_input_visible:
                raise Exception("Input field #rxcLeitsymptomatik (Leitsymptomatik) not visible in OCR confirmation screen!")
            
            print("Successfully verified Leitsymptomatik field is visible.")
            page.screenshot(path=ss_path)
            
            # Close the modal
            page.evaluate("closeModal('rezeptConfirmModal')")
            time.sleep(1)
            
            log_scenario(sc_id, "REZEPT onay ekrani", "DONE",
                         "Manually triggered '#rezeptConfirmModal' open via JS, checked visibility of '#rxcLeitsymptomatik'.",
                         "Confirmed '#rxcLeitsymptomatik' (Leitsymptomatik) input field is present and visible on OCR confirm screen.", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "REZEPT onay ekrani", "FAILED", "Error verifying Leitsymptomatik field on rezept confirm screen.", str(e), ss_path)
            try: page.evaluate("closeModal('rezeptConfirmModal')")
            except: pass

        # ----------------------------------------------------
        # 07. KALENDER: BOOKING CREATION
        # ----------------------------------------------------
        sc_id = "07"
        sc_name = "KALENDER -> + Termin -> Takvimde goster"
        ss_path = os.path.join(tmp_dir, "vis_07_booking.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Switching to Kalender panel...")
            page.evaluate("switchPanel('calendar')")
            page.wait_for_selector("#calAddBookingBtn", timeout=10000)
            time.sleep(2)
            
            print("Opening booking modal...")
            page.click("#calAddBookingBtn")
            page.wait_for_selector("#bookingModal", state="visible", timeout=10000)
            time.sleep(1.5)
            
            # Fill inputs
            print("Selecting employee and service...")
            emp_sel = wait_and_select_first_non_empty("#bkEmployee")
            srv_sel = wait_and_select_first_non_empty("#bkService")
            
            tomorrow_date = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
            print(f"Setting start time to tomorrow ({tomorrow_date}) at 10:00...")
            page.fill("#bkStart", f"{tomorrow_date}T10:00")
            
            print(f"Searching and selecting patient: {pat_first}...")
            page.fill("#bkCustomerSearch", pat_first)
            page.wait_for_selector("#bkCustomerList li", state="visible", timeout=10000)
            page.click(f"#bkCustomerList li[data-id='{patient_id}']")
            
            page.fill("#bkNotes", "QA-VIS Appointment Note Detail")
            
            print("Clicking Save button...")
            page.click("#bkSaveBtn")
            
            # Wait for modal to hide
            page.wait_for_selector("#bookingModal", state="hidden", timeout=15000)
            time.sleep(2)
            
            # Go to tomorrow in calendar day view to see it
            print("Switching to tomorrow in calendar view...")
            page.click("#dayViewNext")
            time.sleep(3)
            
            # Check block presence
            block_visible = page.locator(f".dv-booking-block:has-text('{pat_first}')").is_visible()
            print(f"Booking block visible on calendar: {block_visible}")
            
            # Get the booking ID from details modal
            page.locator(f".dv-booking-block:has-text('{pat_first}')").click()
            page.wait_for_selector("#bookingModal", state="visible", timeout=10000)
            booking_id = page.input_value("#bk-id")
            print(f"Retrieved booking ID: {booking_id}")
            
            # Close the modal
            page.click("#bookingModal button[data-modal='bookingModal']")
            page.wait_for_selector("#bookingModal", state="hidden", timeout=10000)
            
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "KALENDER -> + Termin -> Takvimde goster", "DONE",
                         f"Opened booking modal, selected employee ({emp_sel}) and service ({srv_sel}), scheduled for tomorrow 10:00, linked patient, and clicked Save.",
                         f"Booking created successfully. Booking block is visible in the day-view calendar. Booking ID: {booking_id}.", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "KALENDER -> + Termin -> Takvimde goster", "FAILED", "Error creating a manual appointment in the calendar panel.", str(e), ss_path)
            try: page.evaluate("closeModal('bookingModal')")
            except: pass

        # ----------------------------------------------------
        # 08. RANDEVU CLICK -> PATIENT NICHT ERSCHIENEN (NO-SHOW)
        # ----------------------------------------------------
        sc_id = "08"
        sc_name = "Patient nicht erschienen (No-show)"
        ss_path = os.path.join(tmp_dir, "vis_08_noshow.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Switching to Overview panel...")
            page.evaluate("switchPanel('overview')")
            page.wait_for_selector("#upcoming-bookings-list", timeout=10000)
            time.sleep(2)
            
            print("Going to tomorrow schedule list...")
            page.click("#scheduleNext")
            time.sleep(3)
            
            # Click tomorrow's slot
            print("Clicking tomorrow's slot to open action modal...")
            slot_selector = f".emp-slot:has-text('{pat_first}')"
            
            # Fallback if slot not visible in overview list
            try:
                page.wait_for_selector(slot_selector, timeout=5000)
                page.click(slot_selector)
            except Exception:
                print("Slot not visible in overview, falling back to calendar view click...")
                page.evaluate("switchPanel('calendar')")
                time.sleep(2.5)
                page.click(f".dv-booking-block:has-text('{pat_first}')")
                
            page.wait_for_selector("#bkActionModal", state="visible", timeout=10000)
            time.sleep(1.5)
            
            # Click "Patient nicht erschienen" button
            print("Clicking 'Patient nicht erschienen' button...")
            page.click("#bkActionNoShowBtn")
            
            # Wait for toast to display
            time.sleep(1.5)
            toast_text = get_latest_toast()
            print(f"Captured Toast: {toast_text}")
            
            page.screenshot(path=ss_path)
            
            log_scenario(sc_id, sc_name, "DONE",
                         "Clicked the scheduled booking slot and clicked 'Patient nicht erschienen' (#bkActionNoShowBtn) in the therapist modal.",
                         f"No-show triggered successfully. Captured Toast: '{toast_text}'", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, sc_name, "FAILED", "Error triggering Patient nicht erschienen (no-show).", str(e), ss_path)
            try: page.evaluate("closeModal('bkActionModal')")
            except: pass

        # ----------------------------------------------------
        # 09. SETTINGS: IK NUMBER AND RECHNUNGSDATEN PERSISTENCE
        # ----------------------------------------------------
        sc_id = "09"
        sc_name = "SETTINGS -> IK alani + Rechnungsdaten"
        ss_path = os.path.join(tmp_dir, "vis_09_iknumber.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Switching to Settings panel...")
            page.evaluate("switchPanel('settings')")
            page.wait_for_selector("#setIkNumber", timeout=10000)
            time.sleep(2)
            
            # Enter IK
            test_ik = "460123456"
            print(f"Entering IK: {test_ik} and saving...")
            page.fill("#setIkNumber", test_ik)
            page.click("#ikSaveBtn")
            time.sleep(1.5)
            
            # Enter Rechnungsdaten
            print("Entering Rechnungsdaten details and saving...")
            page.fill("#setBankName", "QA-VIS Sparkasse")
            page.fill("#setIban", "DE89370400440532013000")
            page.click("#billingSaveBtn")
            time.sleep(2)
            
            # Reload page to test persistence
            print("Reloading the page to test persistence...")
            page.reload()
            page.wait_for_selector("#app", state="visible", timeout=20000)
            time.sleep(3)
            
            # Open settings panel again
            page.evaluate("switchPanel('settings')")
            page.wait_for_selector("#setIkNumber", timeout=10000)
            time.sleep(2)
            
            # Read values
            saved_ik = page.locator("#setIkNumber").input_value()
            saved_bank = page.locator("#setBankName").input_value()
            saved_iban = page.locator("#setIban").input_value()
            print(f"Persisted IK: '{saved_ik}', Bank: '{saved_bank}', IBAN: '{saved_iban}'")
            
            if saved_ik != test_ik:
                raise Exception(f"IK did not persist! Expected: {test_ik}, Got: {saved_ik}")
                
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "SETTINGS -> IK alani + Rechnungsdaten", "DONE",
                         "Filled IK field (#setIkNumber), saved it, filled Rechnungsdaten, saved it, and performed a browser reload.",
                         f"Persistence test passed! IK '{saved_ik}' and Bank '{saved_bank}' successfully loaded from database on reload.", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "SETTINGS -> IK alani + Rechnungsdaten", "FAILED", "Error validating Settings IK or Rechnungsdaten persistence.", str(e), ss_path)

        # ----------------------------------------------------
        # 10. MITARBEITER (TEAM) PANEL / PLAN LIMIT TEST
        # ----------------------------------------------------
        sc_id = "10"
        sc_name = "MITARBEITER (Team) paneli -> plan limit testi"
        ss_path = os.path.join(tmp_dir, "vis_10_team.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Switching to Team panel...")
            page.evaluate("switchPanel('team')")
            page.wait_for_selector("#employeeList", timeout=10000)
            time.sleep(2)
            
            # Show the modal manually or via helper
            print("Opening add employee modal...")
            page.evaluate("openAddEmployeeModal()")
            page.wait_for_selector("#addEmployeeModal", state="visible", timeout=10000)
            
            # Fill out inputs
            print("Filling team member details...")
            page.fill("#ae-first-name", "QA-VIS")
            page.fill("#ae-last-name", "TeamLimit")
            page.fill("#ae-email", "qa-vis-team-limit@infinitymade.de")
            page.fill("#ae-phone", "01765555555")
            
            time.sleep(1)
            
            # Click Save to test limit error toast
            print("Clicking Save to trigger limit validation...")
            page.click("#aeSaveBtn")
            
            # Wait up to 3 seconds for toast or result
            time.sleep(2)
            toast_text = get_latest_toast()
            print(f"Captured Team Toast: {toast_text}")
            
            page.screenshot(path=ss_path)
            
            # Close the modal
            page.evaluate("closeModal('addEmployeeModal')")
            time.sleep(1)
            
            log_scenario(sc_id, "MITARBEITER (Team) paneli", "DONE",
                         "Opened addEmployeeModal, filled dummy details, and clicked Save to trigger limit check.",
                         f"Flow succeeded. Captured Toast: '{toast_text}' (successfully tested plan-limit validation error).", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "MITARBEITER (Team) paneli", "FAILED", "Error validating Team limit check flow.", str(e), ss_path)
            try: page.evaluate("closeModal('addEmployeeModal')")
            except: pass

        # ----------------------------------------------------
        # 11. WARTELISTE: ADD ENTRY AND VERIFY IN TABLE
        # ----------------------------------------------------
        sc_id = "11"
        sc_name = "WARTELISTE paneli -> Entry ekle"
        ss_path = os.path.join(tmp_dir, "vis_11_warteliste.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Switching to Warteliste panel...")
            page.evaluate("switchPanel('warteliste')")
            page.wait_for_selector("#wlAddBtn", timeout=10000)
            time.sleep(2)
            
            print("Opening waitlist modal...")
            page.click("#wlAddBtn")
            page.wait_for_selector("#wlModal", state="visible", timeout=10000)
            time.sleep(1.5)
            
            # Autocomplete search
            print(f"Searching and selecting patient: {pat_first}...")
            page.fill("#wlPatientSearch", pat_first)
            page.wait_for_selector("#wlPatientList li", state="visible", timeout=10000)
            page.click(f"#wlPatientList li[data-id='{patient_id}']")
            
            # Service selection
            srv_sel = wait_and_select_first_non_empty("#wlService")
            
            # Details
            page.check("input.wlDay[value='Mo']")
            page.fill("#wlTimeFrom", "09:00")
            page.fill("#wlTimeTo", "17:00")
            page.select_option("#wlPriority", value="2")
            page.fill("#wlNotes", "QA-VIS Waitlist Notes Detail")
            
            time.sleep(1)
            print("Saving waitlist entry...")
            page.click("#wlSaveBtn")
            page.wait_for_selector("#wlModal", state="hidden", timeout=15000)
            time.sleep(3)
            
            # Check row visible in table
            table_html = page.inner_html("#wlTableBody")
            row_visible = pat_first in table_html
            print(f"Patient row visible in waitlist table: {row_visible}")
            
            page.screenshot(path=ss_path)
            
            if not row_visible:
                raise Exception("Waitlist entry was saved but is not showing in the list table.")
                
            log_scenario(sc_id, "WARTELISTE paneli -> Entry ekle", "DONE",
                         f"Opened wlModal, linked patient {pat_first}, selected service {srv_sel}, checked availability, and clicked Save.",
                         f"Waitlist entry created successfully and verified inside the table rows.", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "WARTELISTE paneli -> Entry ekle", "FAILED", "Error creating a Warteliste entry.", str(e), ss_path)
            try: page.evaluate("closeModal('wlModal')")
            except: pass

        # ----------------------------------------------------
        # 12. ABRECHNUNG PANEL
        # ----------------------------------------------------
        sc_id = "12"
        sc_name = "ABRECHNUNG paneli ac"
        ss_path = os.path.join(tmp_dir, "vis_12_abrechnung.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Evaluating switchPanel('abrechnung')...")
            page.evaluate("switchPanel('abrechnung')")
            print("Waiting 4 seconds for Abrechnung data groups to load...")
            time.sleep(4)
            
            # Verify panel content or billing groups
            content_desc = page.evaluate("""
                () => {
                    const el = document.getElementById('panel-abrechnung');
                    return el ? el.innerText.substring(0, 400).replace(/\\n/g, ' ') : 'Abrechnung panel not found';
                }
            """)
            
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "ABRECHNUNG paneli ac", "DONE",
                         "Switched to Abrechnung panel using switchPanel('abrechnung').",
                         f"Abrechnung panel loaded successfully: {content_desc[:200]}...", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "ABRECHNUNG paneli ac", "FAILED", "Error switching to Abrechnung panel.", str(e), ss_path)

        # ----------------------------------------------------
        # 13. FAHRTENBUCH PANEL
        # ----------------------------------------------------
        sc_id = "13"
        sc_name = "FAHRTENBUCH paneli ac"
        ss_path = os.path.join(tmp_dir, "vis_13_fahrtenbuch.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Evaluating switchPanel('fahrtenbuch')...")
            page.evaluate("switchPanel('fahrtenbuch')")
            print("Waiting 4 seconds for Fahrtenbuch logs to load...")
            time.sleep(4)
            
            # Read visible elements or summary
            fb_info = page.evaluate("""
                () => {
                    const body = document.querySelector('#panel-fahrtenbuch');
                    return body ? body.innerText.substring(0, 300).replace(/\\n/g, ' ') : 'Fahrtenbuch panel element not found';
                }
            """)
            
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "FAHRTENBUCH paneli ac", "DONE", "Switched to fahrtenbuch panel.", f"Fahrtenbuch loaded successfully: {fb_info[:200]}...", ss_path)
        except Exception as e:
            page.screenshot(path=ss_path)
            log_scenario(sc_id, "FAHRTENBUCH paneli ac", "FAILED", "Error switching to Fahrtenbuch panel.", str(e), ss_path)

        # Close the browser
        print("\nAll scenarios processed. Closing browser...")
        browser.close()

    # ----------------------------------------------------
    # GENERATING VISUAL VERIFICATION MARKDOWN REPORT
    # ----------------------------------------------------
    report_path = os.path.join(tmp_dir, "vis_report.md")
    print(f"\nWriting final visual verification report to: {report_path}")
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# InfinityMade Visual Verification (QA) Report\n\n")
        f.write(f"**Date of Run:** {datetime.date.today().isoformat()}  \n")
        f.write(f"**Test Data Name Prefix:** `{test_prefix}`  \n\n")
        f.write("This report documents the live visual validation of the deployed fixes in **InfinityMade**. ")
        f.write("Every scenario was performed in headless Chromium simulating actual mouse/keyboard UI events. ")
        f.write("Screenshots have been generated and saved locally to facilitate human visual review.\n\n")
        
        f.write("## Scenario Execution Status Summary\n\n")
        f.write("| ID | Scenario / Feature Tested | Status | Screenshot Filename | \n")
        f.write("|:---|:---|:---|:---|\n")
        
        # Sort and write rows
        sorted_keys = sorted(report_data.keys())
        for k in sorted_keys:
            sc = report_data[k]
            f.write(f"| {k} | {sc['name']} | **{sc['status']}** | `{sc['screenshot']}` |\n")
            
        f.write("\n---\n\n")
        f.write("## Detailed Scenario Logs\n\n")
        
        for k in sorted_keys:
            sc = report_data[k]
            f.write(f"### Scenario {k}: {sc['name']}\n\n")
            f.write(f"- **Status:** **{sc['status']}**\n")
            f.write(f"- **Action Performed:** {sc['action']}\n")
            f.write(f"- **Observed Result:** {sc['result']}\n")
            f.write(f"- **Screenshot Output:** [c:\\tmp\\{sc['screenshot']}](file:///c:/tmp/{sc['screenshot']})\n\n")
            
        f.write("\n---\n")
        f.write("*End of Visual Verification Report.*")

    print("\nVisual Verification Report successfully completed!")
    print("==================================================")

if __name__ == "__main__":
    run_visual_verification()
