import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

def run_qa_audit():
    print("==================================================")
    print("STARTING PLAYWRIGHT DASHBOARD METHODICAL QA AUDIT")
    print("==================================================")
    
    scratch_dir = r"C:\Users\Test\.gemini\antigravity\brain\4ac35ce1-7c99-44d7-b151-d43433212892\scratch"
    if not os.path.exists(scratch_dir):
        os.makedirs(scratch_dir)
        print(f"Created scratch directory: {scratch_dir}")

    console_logs = []
    page_errors = []
    
    with sync_playwright() as p:
        # Launch Chromium headlessly
        browser = p.chromium.launch(headless=True)
        # Set a standard screen resolution to look nice in screenshots
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        
        # Listen to console logs
        def handle_console(msg):
            log_item = {
                "type": msg.type,
                "text": msg.text,
                "location": msg.location
            }
            console_logs.append(log_item)
            print(f"[BROWSER CONSOLE {msg.type.upper()}] {msg.text}")
            
        page.on("console", handle_console)
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        
        # 1. Navigate to Login Page
        login_url = "http://localhost:8081/login.html"
        print(f"Navigating to: {login_url}")
        try:
            page.goto(login_url, timeout=10000)
        except Exception as e:
            print(f"CRITICAL ERROR: Failed to connect to local dev server. Is it running? Error: {e}")
            sys.exit(1)
            
        page.wait_for_selector("#email", timeout=5000)
        
        # 2. Perform Login
        print("Logging in with test account fizyo6@gmail.com...")
        page.fill("#email", "fizyo6@gmail.com")
        page.fill("#password", "Yavuzkemal123.")
        page.screenshot(path=os.path.join(scratch_dir, "01_login_filled.png"))
        
        page.click("#submitBtn")
        
        # Wait for redirection to dashboard
        print("Waiting for redirection to dashboard.html...")
        try:
            page.wait_for_url("**/dashboard.html*", timeout=15000)
            print("Login successful! Redirected to dashboard.html.")
        except Exception as e:
            print("FAILED: Could not redirect to dashboard. Current URL:", page.url)
            page.screenshot(path=os.path.join(scratch_dir, "err_login_failed.png"))
            browser.close()
            sys.exit(1)
            
        # 3. Wait for dashboard page initialization
        # The '#app' element has display:none until the loading screen goes away
        print("Waiting for '#app' element to be visible...")
        page.wait_for_selector("#app", state="visible", timeout=15000)
        print("Dashboard loaded completely!")
        
        time.sleep(2) # Give a small buffer for async requests to complete
        
        # Define panels to test, their sidebar data-panel attribute, and the panel DOM element ID
        panels_to_test = [
            {"name": "Overview", "selector": 'button[data-panel="overview"]', "panel_id": "#panel-overview"},
            {"name": "Calendar", "selector": 'button[data-panel="calendar"]', "panel_id": "#panel-calendar"},
            {"name": "Kunden", "selector": 'button[data-panel="kunden"]', "panel_id": "#panel-kunden"},
            {"name": "Services", "selector": 'button[data-panel="services"]', "panel_id": "#panel-services"},
            {"name": "Hours", "selector": 'button[data-panel="hours"]', "panel_id": "#panel-hours"},
            {"name": "Team", "selector": 'button[data-panel="team"]', "panel_id": "#panel-team"},
            {"name": "B2B", "selector": 'button[data-panel="b2b"]', "panel_id": "#panel-b2b"},
            {"name": "B2C", "selector": 'button[data-panel="b2c"]', "panel_id": "#panel-b2c"},
            {"name": "Rechnungen", "selector": 'button[data-panel="rechnungen"]', "panel_id": "#panel-rechnungen"},
        ]
        
        results = []
        
        # Test each panel methodically
        for i, panel in enumerate(panels_to_test):
            name = panel["name"]
            sel = panel["selector"]
            p_id = panel["panel_id"]
            
            print(f"\n--- Testing Panel: {name} ---")
            
            # Click sidebar button unless it's Overview (since Overview is loaded first by default, but let's click it anyway to be safe)
            try:
                # Wait for selector to be attached/visible
                page.wait_for_selector(sel, state="attached", timeout=5000)
                
                # Check if it exists and is visible/enabled, then click
                button = page.query_selector(sel)
                if button:
                    print(f"Clicking sidebar item for {name}...")
                    button.click()
                else:
                    print(f"WARNING: Button for {name} ({sel}) not found directly in DOM!")
                    # Try falling back to evaluate to click it or trigger switchPanel directly
                    page.evaluate(f"switchPanel('{name.lower()}')")
            except Exception as click_err:
                print(f"Exception trying to click panel {name}: {click_err}. Trying direct js evaluate...")
                try:
                    page.evaluate(f"switchPanel('{name.lower()}')")
                except Exception as eval_err:
                    print(f"Direct JS switchPanel evaluation failed too: {eval_err}")
            
            # Wait for panel to become active
            time.sleep(2.5) # Wait for Supabase queries or iframe loads to settle
            
            # Verify panel is active
            is_active = False
            panel_class = ""
            try:
                panel_el = page.query_selector(p_id)
                if panel_el:
                    panel_class = panel_el.get_attribute("class") or ""
                    is_active = "active" in panel_class
                else:
                    print(f"WARNING: Panel element {p_id} not found in DOM!")
            except Exception as verify_err:
                print(f"Error verifying active state of {p_id}: {verify_err}")
            
            print(f"Panel active state: {is_active} (classes: '{panel_class}')")
            
            # Check for infinite loading screen
            # Ensure loading overlay spinner is hidden
            loading_el = page.query_selector("#loading")
            loading_visible = False
            if loading_el:
                loading_visible = loading_el.is_visible()
            
            # Look for sub-panel spinner inside the active panel
            sub_spinner = page.query_selector(f"{p_id} .spinner") or page.query_selector(f"{p_id} .upcoming-loading")
            sub_spinner_visible = False
            if sub_spinner:
                sub_spinner_visible = sub_spinner.is_visible()
                
            # Check for generic errors inside panel
            has_error = False
            error_msg = ""
            # e.g., toast error or error-card inside active panel
            toast_err = page.query_selector(".toast.error")
            if toast_err and toast_err.is_visible():
                has_error = True
                error_msg = toast_err.inner_text()
                print(f"Toast Error detected: {error_msg}")
            
            # Screenshot path
            safe_name = name.lower().replace(" ", "_")
            screenshot_path = os.path.join(scratch_dir, f"panel_{i+2:02d}_{safe_name}.png")
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to: {screenshot_path}")
            
            # Status object
            status_item = {
                "panel": name,
                "panel_id": p_id,
                "is_active": is_active,
                "loading_visible": loading_visible,
                "sub_spinner_visible": sub_spinner_visible,
                "has_toast_error": has_error,
                "toast_error_msg": error_msg,
                "screenshot": screenshot_path,
                "classes": panel_class
            }
            results.append(status_item)
            
        print("\nAll panels tested. Closing browser...")
        browser.close()
        
    print("\n==================================================")
    print("QA AUDIT COMPLETED")
    print("==================================================")
    
    # Save the output results json
    summary_data = {
        "results": results,
        "console_logs": console_logs,
        "page_errors": page_errors
    }
    
    results_json_path = os.path.join(scratch_dir, "audit_summary_results.json")
    with open(results_json_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2, ensure_ascii=False)
    print(f"Audit summary results written to: {results_json_path}")
    print("==================================================")

if __name__ == "__main__":
    run_qa_audit()
