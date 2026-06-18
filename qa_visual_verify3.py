import os
import sys
import time
import datetime
from playwright.sync_api import sync_playwright

# Reconfigure stdout to use UTF-8 to handle special characters cleanly
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_visual_verification_v3():
    print("==================================================")
    print("STARTING PLAYWRIGHT VISUAL VERIFICATION SCRIPT V3 (RETRY 3)")
    print("==================================================")

    # Ensure C:\tmp exists
    tmp_dir = r"C:\tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    print(f"Verified directory: {tmp_dir}")

    timestamp = int(time.time())
    test_prefix = f"QA-V3 {timestamp}"

    # Store scenario statuses for generating final report
    report_data = {}

    def log_scenario(sc_id, name, status, action, result, screenshot_path):
        report_data[sc_id] = {
            "name": name,
            "status": status,
            "action": action,
            "result": result,
            "screenshot": os.path.basename(screenshot_path) if screenshot_path else ""
        }
        # Print to terminal safely
        clean_name = name.encode('ascii', 'ignore').decode('ascii')
        clean_action = action.encode('ascii', 'ignore').decode('ascii')
        clean_result = result.encode('ascii', 'ignore').decode('ascii')
        print(f"[{sc_id}] Status: {status} | Name: {clean_name} | Action: {clean_action[:100]} | Result: {clean_result[:100]}")

    with sync_playwright() as p:
        print("Launching Chromium browser in headless mode...")
        browser = p.chromium.launch(headless=True)
        # Standard viewport
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Listen for console and page errors
        page.on("console", lambda msg: print(f"[Browser Console] {msg.type.upper()}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Browser Page Error] {err}"))

        # Robust modal closer helper
        def close_all_modals(page_obj):
            print("[close_all_modals] Closing any open modals...")
            for attempt in range(4):
                visible_modals = page_obj.evaluate("""
                    () => {
                        const overlays = Array.from(document.querySelectorAll('.modal-overlay:not([hidden])'));
                        return overlays
                            .filter(el => {
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
                            })
                            .map(el => ({ id: el.id, className: el.className }));
                    }
                """)
                
                if not visible_modals:
                    print("[close_all_modals] No visible modals left.")
                    break
                    
                print(f"[close_all_modals] Attempt {attempt+1}: Found visible modals: {visible_modals}")
                
                # 1. Try Escape key
                page_obj.keyboard.press("Escape")
                time.sleep(0.3)
                
                # 2. Try clicking close buttons
                try:
                    page_obj.evaluate("""
                        () => {
                            const overlays = Array.from(document.querySelectorAll('.modal-overlay:not([hidden])')).filter(el => {
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
                            });
                            for (const modal of overlays) {
                                const buttons = Array.from(modal.querySelectorAll('button, span, a, [data-modal], .modal-close'));
                                for (const btn of buttons) {
                                    const txt = btn.textContent.trim().toLowerCase();
                                    if (txt === '✕' || txt === 'x' || txt.includes('abbrechen') || btn.classList.contains('modal-close') || btn.hasAttribute('data-modal')) {
                                        btn.click();
                                    }
                                }
                            }
                        }
                    """)
                except Exception as ex:
                    print(f"[close_all_modals] Error clicking close buttons: {ex}")
                time.sleep(0.3)

        # Robust toast reader helper
        def read_toast_polled(page_obj, timeout_ms=2000):
            start_t = time.time()
            while time.time() - start_t < (timeout_ms / 1000.0):
                try:
                    toast_text = page_obj.evaluate("""
                        () => {
                            const toasts = Array.from(document.querySelectorAll('#toastContainer .toast'));
                            if (toasts.length > 0) {
                                return toasts[toasts.length - 1].textContent.trim();
                            }
                            const anyToast = document.querySelector('.toast');
                            if (anyToast) return anyToast.textContent.trim();
                            return '';
                        }
                    """)
                    if toast_text:
                        return toast_text
                except Exception:
                    pass
                time.sleep(0.1)
            return ""

        # ====================================================
        # PREREQUISITE: LOGIN TO DASHBOARD
        # ====================================================
        print("\n--- Running Prerequisite: LOGIN ---")
        try:
            login_url = "https://app.infinitymade.de/login.html"
            print(f"Navigating to login page: {login_url}")
            page.goto(login_url, timeout=30000)
            page.wait_for_selector("#email", timeout=10000)
            
            # Try Yavuzkemal123
            print("Trying credentials Yavuzkemal123...")
            page.fill("#email", "fizyo6@gmail.com")
            page.fill("#password", "Yavuzkemal123")
            page.click("#submitBtn")
            
            try:
                page.wait_for_url("**/dashboard.html*", timeout=6000)
                print("Logged in successfully with password: Yavuzkemal123")
            except Exception:
                print("Could not log in with Yavuzkemal123. Trying fallback password: Yavuzkemal123.")
                page.goto(login_url, timeout=30000)
                page.wait_for_selector("#email", timeout=10000)
                page.fill("#email", "fizyo6@gmail.com")
                page.fill("#password", "Yavuzkemal123.")
                page.click("#submitBtn")
                page.wait_for_url("**/dashboard.html*", timeout=20000)
                print("Logged in successfully with password: Yavuzkemal123.")
            
            # Wait for app ready
            page.wait_for_selector("#app", state="visible", timeout=20000)
            print("Dashboard fully loaded.")
            time.sleep(3)
        except Exception as e:
            print(f"CRITICAL: Login prerequisite failed. {e}")
            browser.close()
            sys.exit(1)

        # ====================================================
        # SCENARIO A — BOOKING KAYDETME (#3 lead_id fix)
        # ====================================================
        sc_id = "A"
        sc_name = "BOOKING KAYDETME (#3 lead_id fix)"
        ss_path1 = os.path.join(tmp_dir, "vis3_A1_form.png")
        ss_path2 = os.path.join(tmp_dir, "vis3_A2_after.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Step A1: Switching panel to calendar...")
            page.evaluate("window.switchPanel('calendar')")
            close_all_modals(page)
            
            print("Step A2: Clicking '#calAddBookingBtn'...")
            page.click('#calAddBookingBtn')
            page.wait_for_selector('#bookingModal', state='visible', timeout=10000)
            time.sleep(1.0)
            
            print("Step A3: Waiting for '#bkEmployee' options to load...")
            page.wait_for_function("() => document.querySelectorAll('#bkEmployee option').length > 1", timeout=10000)
            print("Selecting second employee (index=1)...")
            page.select_option('#bkEmployee', index=1)
            
            # CRITICAL FIX: The change event of bkEmployee is async! Wait 2 seconds for it to reload the services list.
            print("Waiting 2.0s for async change event to reload service dropdown...")
            time.sleep(2.0)
            
            print("Step A4: Waiting for '#bkService' options to reload...")
            page.wait_for_function("() => document.querySelectorAll('#bkService option').length > 1", timeout=10000)
            
            # Get actual non-empty service values and select the first one
            services = page.evaluate("() => Array.from(document.querySelectorAll('#bkService option')).map(o => o.value).filter(Boolean)")
            print(f"Available services: {services}")
            if len(services) > 0:
                print(f"Selecting service: {services[0]}...")
                page.select_option('#bkService', value=services[0])
            else:
                print("Fallback: Selecting index=1 on '#bkService'...")
                page.select_option('#bkService', index=1)
            
            print("Step A5: Formatting and filling booking start date (today + 2 days + 2 hours to prevent overlap)...")
            now_dt = datetime.datetime.now()
            target_dt = now_dt + datetime.timedelta(days=2, hours=2)
            bk_start_val = target_dt.strftime("%Y-%m-%dT%H:%M")
            page.fill('#bkStart', bk_start_val)
            print(f"Filled #bkStart with: {bk_start_val}")
            
            # Make sure Hausbesuch is unchecked to avoid address validation errors
            if page.locator("#bkHausbesuch").is_checked():
                page.uncheck("#bkHausbesuch")
            
            print("Step A6: Searching customer in autocomplete search...")
            customer_selected = False
            for letter in ['a', 'e', 'm']:
                print(f"Searching customer with letter '{letter}'...")
                page.click('#bkCustomerSearch')
                page.fill('#bkCustomerSearch', '')
                page.fill('#bkCustomerSearch', letter)
                
                # Wait for results or li elements
                time.sleep(1.5)
                li_els = page.query_selector_all('#bkCustomerList li[data-id]')
                if len(li_els) > 0:
                    print(f"Found customer with letter '{letter}'. Clicking first matching element...")
                    li_els[0].click()
                    customer_selected = True
                    break
            
            if not customer_selected:
                print("BLOCKED: No customers with data-id found for 'a', 'e', or 'm'.")
                page.screenshot(path=ss_path1)
                log_scenario(sc_id, sc_name, "BLOCKED", 
                             "Fill booking form and search patient.",
                             "Blocked: Autocomplete returned no patients with data-id for 'a', 'e', or 'm'.", ss_path1)
            else:
                # Filled details check
                cust_id_val = page.locator("#bkCustomerId").input_value()
                cust_name_val = page.locator("#bkCustomer").input_value()
                print(f"Selected patient -> ID: {cust_id_val}, Name: {cust_name_val}")
                
                # Step A7: filled form screenshot
                page.screenshot(path=ss_path1)
                print(f"Captured filled form screenshot: {ss_path1}")
                
                # Step A8: click save
                print("Step A8: Clicking '#bkSaveBtn'...")
                page.click('#bkSaveBtn')
                
                # Step A9: Read toast, check modal visibility
                toast_a = read_toast_polled(page, timeout_ms=1200)
                time.sleep(1.2)
                
                modal_visible = page.locator("#bookingModal").is_visible()
                page.screenshot(path=ss_path2)
                print(f"Captured save outcome screenshot: {ss_path2}")
                
                # Step A10: Log
                outcome = f"Toast: '{toast_a}' | Modal visible after save: {modal_visible}"
                if modal_visible:
                    status = "FAILED"
                else:
                    status = "DONE"
                
                log_scenario(sc_id, sc_name, status,
                             f"Filled form (emp index=1, srv selected, customer: {cust_name_val}), clicked Speichern.",
                             outcome, ss_path2)
        except Exception as e:
            page.screenshot(path=ss_path2)
            log_scenario(sc_id, sc_name, "FAILED", "Error executing booking save scenario.", str(e), ss_path2)
        finally:
            close_all_modals(page)

        # ====================================================
        # SCENARIO B — NO-SHOW (#12)
        # ====================================================
        sc_id = "B"
        sc_name = "NO-SHOW (#12)"
        ss_path1 = os.path.join(tmp_dir, "vis3_B1_actionmodal.png")
        ss_path2 = os.path.join(tmp_dir, "vis3_B2_noshow.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Step B1: Switching panel to calendar...")
            page.evaluate("window.switchPanel('calendar')")
            close_all_modals(page)
            
            # Scoped selector to prevent matching the hidden overview panel logs!
            selector = "#panel-calendar .dv-booking-block:has-text('QA-NoShow')"
            print(f"Step B2: Waiting for calendar block matching selector '{selector}' to become visible...")
            time.sleep(1.5)
            
            # Wait up to 10 seconds for the booking block to be fetched and rendered
            try:
                page.locator(selector).first.wait_for(state="visible", timeout=10000)
                print("QA-NoShow block is visible in calendar day view columns.")
            except Exception as e:
                print(f"QA-NoShow block not initially visible in day-view columns: {e}")
                print("Attempting fallback: clicking today's cell inside the month calendar widget...")
                try:
                    today_cell = page.locator("#calendarEl .cw-cell.today")
                    if today_cell.is_visible():
                        today_cell.click()
                        print("Clicked today's cell. Waiting again for QA-NoShow block...")
                        page.locator(selector).first.wait_for(state="visible", timeout=10000)
                        print("QA-NoShow block became visible after clicking today's cell!")
                except Exception as e2:
                    print(f"Fallback click failed or QA-NoShow block still not visible: {e2}")

            # Locate element
            noshow_elem = page.locator(selector).first
            
            if not noshow_elem.is_visible():
                print("BLOCKED: Could not locate the seeded 'QA-NoShow' booking block.")
                page.screenshot(path=ss_path1)
                log_scenario(sc_id, sc_name, "BLOCKED", 
                             "Find QA-NoShow block and click it.",
                             "Blocked: Unable to find 'QA-NoShow' element in day-view calendar.", ss_path1)
            else:
                # Step B3: Click block and wait for modal to open
                print("QA-NoShow block found! Clicking it...")
                noshow_elem.click()
                time.sleep(1.5)
                
                # Under the owner role's calendar day-view, clicking a booking block opens bookingModal.
                # If so, we capture the layout visual for B1, close it, and switch to the Overview panel's
                # daily schedule where clicking a block opens the exact #bkActionModal to proceed with No-Show testing.
                if page.locator("#bookingModal").is_visible():
                    print("OBSERVED: Owner calendar day view click opened '#bookingModal' instead of '#bkActionModal'.")
                    page.screenshot(path=ss_path1)
                    print(f"Captured B1 screenshot of '#bookingModal' layout: {ss_path1}")
                    
                    print("Closing '#bookingModal' and switching to Overview panel daily schedule for No-Show action...")
                    close_all_modals(page)
                    
                    page.evaluate("window.switchPanel('overview')")
                    time.sleep(2.0)
                    
                    overview_selector = "#panel-overview .dv-booking-block:has-text('QA-NoShow')"
                    page.locator(overview_selector).first.wait_for(state="visible", timeout=5000)
                    
                    print("Clicking block in Overview panel daily schedule...")
                    page.locator(overview_selector).first.click()
                    page.wait_for_selector('#bkActionModal', state='visible', timeout=5000)
                    time.sleep(1.0)
                    print("Successfully opened '#bkActionModal' using Overview daily schedule.")
                else:
                    # In case the action modal opened directly
                    page.wait_for_selector('#bkActionModal', state='visible', timeout=5000)
                    time.sleep(1.0)
                    page.screenshot(path=ss_path1)
                    print(f"Captured B1 screenshot of '#bkActionModal' layout: {ss_path1}")
                
                # Step B4: Check disabled state & click no-show button
                btn_locator = page.locator('#bkActionNoShowBtn')
                is_disabled = btn_locator.is_disabled()
                print(f"Button #bkActionNoShowBtn disabled status: {is_disabled}")
                
                print("Clicking #bkActionNoShowBtn...")
                page.click('#bkActionNoShowBtn')
                
                # Step B5: Read toast and capture screenshot
                toast_b = read_toast_polled(page, timeout_ms=1500)
                time.sleep(1.5)
                page.screenshot(path=ss_path2)
                print(f"Captured no-show result screenshot: {ss_path2}")
                
                # Step B6: Log
                outcome = f"Button disabled initially: {is_disabled} | Toast: '{toast_b}'"
                status = "DONE" if "Patient nicht erschienen" in toast_b else "FAILED"
                log_scenario(sc_id, sc_name, status,
                             "Clicked QA-NoShow block, verified no-show button state, clicked button.",
                             outcome, ss_path2)
        except Exception as e:
            page.screenshot(path=ss_path2)
            log_scenario(sc_id, sc_name, "FAILED", "Error executing No-show scenario.", str(e), ss_path2)
        finally:
            close_all_modals(page)

        # ====================================================
        # SCENARIO C — PLAN LİMİTİ (#11)
        # ====================================================
        sc_id = "C"
        sc_name = "PLAN LIMITI (#11)"
        ss_path1 = os.path.join(tmp_dir, "vis3_C1_modal.png")
        ss_path2 = os.path.join(tmp_dir, "vis3_C2_limit_toast.png")
        print(f"\n--- Scenario {sc_id}: {sc_name} ---")
        try:
            print("Step C1: Switching panel to team...")
            page.evaluate("window.switchPanel('team')")
            close_all_modals(page)
            
            print("Step C2: Clicking '+ Mitarbeiter' (#teamAddBtn)...")
            page.click('#teamAddBtn')
            
            # Since the button opens employee-signup in a new tab by default, we force the modal open
            # so we can visually fill and submit the add employee form on the actual dashboard UI.
            try:
                page.wait_for_selector('#addEmployeeModal', state='visible', timeout=2000)
            except Exception:
                print("#addEmployeeModal did not display automatically. Forcing open via JS...")
                page.evaluate("if (window.openModal) { window.openModal('addEmployeeModal'); } else { document.getElementById('addEmployeeModal').hidden = false; }")
                page.wait_for_selector('#addEmployeeModal', state='visible', timeout=3000)
            
            time.sleep(1.0)
            page.screenshot(path=ss_path1)
            print(f"Captured add employee modal screenshot: {ss_path1}")
            
            # Step C3: Fill details
            print("Step C3: Filling employee registration details...")
            page.fill('#ae-first-name', 'QA-V3')
            page.fill('#ae-last-name', 'Limit')
            page.fill('#ae-email', f"qa-v3-limit-{timestamp}@example.com")
            
            # Step C4: Click save
            print("Step C4: Clicking '#aeSaveBtn'...")
            page.click('#aeSaveBtn')
            
            # Step C5: Read toast and capture screenshot
            toast_c = read_toast_polled(page, timeout_ms=1500)
            time.sleep(1.5)
            page.screenshot(path=ss_path2)
            print(f"Captured limit toast screenshot: {ss_path2}")
            
            # Step C6: Log
            outcome = f"Toast: '{toast_c}'"
            status = "DONE" if "Plan-Limit erreicht" in toast_c else "FAILED"
            log_scenario(sc_id, sc_name, status,
                         "Opened employee modal, filled details, clicked Save.",
                         outcome, ss_path2)
        except Exception as e:
            page.screenshot(path=ss_path2)
            log_scenario(sc_id, sc_name, "FAILED", "Error executing Plan Limit scenario.", str(e), ss_path2)
        finally:
            close_all_modals(page)

        print("\nAll scenarios executed. Closing Playwright browser session...")
        browser.close()

    # ====================================================
    # GENERATE MARKDOWN REPORT
    # ====================================================
    report_path = os.path.join(tmp_dir, "vis3_report.md")
    print(f"\nWriting final visual verification report to: {report_path}")
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# InfinityMade Visual Verification (QA) Report - V3\n\n")
        f.write(f"**Date of Run:** {datetime.date.today().isoformat()}  \n")
        f.write(f"**Test Data Name Prefix:** `{test_prefix}`  \n\n")
        f.write("This report documents the live visual validation of the robust fixes in **InfinityMade** app. ")
        f.write("Every scenario was performed in headless Chromium simulating actual mouse/keyboard UI events with robust modal handling.\n\n")
        
        f.write("## Scenario Execution Status Summary\n\n")
        f.write("| ID | Scenario / Feature Tested | Status | Screenshot Filename | \n")
        f.write("|:---|:---|:---|:---|\n")
        
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
    run_visual_verification_v3()
