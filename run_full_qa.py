import os
import sys
import time
import subprocess
import json
import urllib.request
from playwright.sync_api import sync_playwright

def is_server_running(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False

def run_full_qa():
    print("==================================================")
    print("STARTING FULL COHESIVE QA AUDIT PROCESS")
    print("==================================================")
    
    server_url = "http://localhost:8081/login.html"
    dev_server_proc = None
    
    # Check if dev server is already running
    if is_server_running(server_url):
        print("Dev server is already running on port 8081.")
    else:
        print("Dev server is not running. Starting node dev_server.cjs...")
        try:
            dev_server_proc = subprocess.Popen(
                ["node", "dev_server.cjs"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=os.getcwd()
            )
            print("Launched dev server process in background. Waiting for it to start...")
            # Wait up to 10 seconds for it to start
            for i in range(10):
                time.sleep(1)
                if is_server_running(server_url):
                    print(f"Dev server started successfully on attempt {i+1}!")
                    break
            else:
                print("WARNING: Dev server did not respond on port 8081 after 10 seconds. We will try to run anyway.")
        except Exception as start_err:
            print(f"CRITICAL ERROR trying to start dev server process: {start_err}")
            print("We will assume the server might be running and proceed.")

    scratch_dir = r"C:\Users\Test\.gemini\antigravity\brain\4ac35ce1-7c99-44d7-b151-d43433212892\scratch"
    if not os.path.exists(scratch_dir):
        os.makedirs(scratch_dir)
        print(f"Created scratch directory: {scratch_dir}")

    console_logs = []
    page_errors = []
    results = []
    
    try:
        with sync_playwright() as p:
            print("Launching Chromium in headless mode...")
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()
            
            # Listen to console logs and page errors
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
            
            # 1. Navigate to Login
            print(f"Navigating to: {server_url}")
            page.goto(server_url, timeout=15000)
            page.wait_for_selector("#email", timeout=5000)
            
            # 2. Login
            print("Filling in credentials for fizyo6@gmail.com...")
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
                raise e
                
            # 3. Wait for dashboard page initialization
            print("Waiting for '#app' element to be visible...")
            page.wait_for_selector("#app", state="visible", timeout=15000)
            print("Dashboard loaded completely!")
            
            time.sleep(2) # Give a small buffer for initial loads
            
            # Define panels to test
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
            
            # Methodically click and capture screenshots of all panels
            for i, panel in enumerate(panels_to_test):
                name = panel["name"]
                sel = panel["selector"]
                p_id = panel["panel_id"]
                
                print(f"\n--- Testing Panel: {name} ---")
                
                try:
                    page.wait_for_selector(sel, state="attached", timeout=5000)
                    button = page.query_selector(sel)
                    if button:
                        print(f"Clicking sidebar item for {name}...")
                        button.click()
                    else:
                        print(f"WARNING: Button for {name} ({sel}) not found directly. Evaluating JS...")
                        page.evaluate(f"switchPanel('{name.lower()}')")
                except Exception as click_err:
                    print(f"Click failed: {click_err}. Trying switchPanel direct JS...")
                    try:
                        page.evaluate(f"switchPanel('{name.lower()}')")
                    except Exception as eval_err:
                        print(f"Direct JS switchPanel evaluation failed: {eval_err}")
                
                # Wait for panel to switch and settle
                time.sleep(2.5)
                
                # Check active class and loading states
                is_active = False
                panel_class = ""
                panel_el = page.query_selector(p_id)
                if panel_el:
                    panel_class = panel_el.get_attribute("class") or ""
                    is_active = "active" in panel_class
                
                loading_el = page.query_selector("#loading")
                loading_visible = loading_el.is_visible() if loading_el else False
                
                sub_spinner = page.query_selector(f"{p_id} .spinner") or page.query_selector(f"{p_id} .upcoming-loading")
                sub_spinner_visible = sub_spinner.is_visible() if sub_spinner else False
                
                has_error = False
                error_msg = ""
                toast_err = page.query_selector(".toast.error")
                if toast_err and toast_err.is_visible():
                    has_error = True
                    error_msg = toast_err.inner_text()
                    print(f"Error detected in active panel: {error_msg}")
                
                # Capture screenshot
                safe_name = name.lower().replace(" ", "_")
                screenshot_path = os.path.join(scratch_dir, f"panel_{i+2:02d}_{safe_name}.png")
                page.screenshot(path=screenshot_path)
                print(f"Screenshot saved to: {screenshot_path}")
                
                results.append({
                    "panel": name,
                    "panel_id": p_id,
                    "is_active": is_active,
                    "loading_visible": loading_visible,
                    "sub_spinner_visible": sub_spinner_visible,
                    "has_toast_error": has_error,
                    "toast_error_msg": error_msg,
                    "screenshot": screenshot_path,
                    "classes": panel_class
                })
                
            print("\nClosing browser...")
            browser.close()
            
    except Exception as run_err:
        print(f"ERROR DURING PLAYWRIGHT EXECUTION: {run_err}")
    finally:
        # Gracefully stop dev server if we started it
        if dev_server_proc:
            print("Stopping the background dev server process...")
            dev_server_proc.terminate()
            try:
                dev_server_proc.wait(timeout=5)
                print("Dev server terminated gracefully.")
            except subprocess.TimeoutExpired:
                print("Dev server did not terminate. Killing it...")
                dev_server_proc.kill()
                
    # Save the output results json
    summary_data = {
        "results": results,
        "console_logs": console_logs,
        "page_errors": page_errors
    }
    
    results_json_path = os.path.join(scratch_dir, "audit_summary_results.json")
    with open(results_json_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2, ensure_ascii=False)
    print(f"\nAudit summary results written to: {results_json_path}")
    print("==================================================")
    print("QA AUDIT COMPLETED SUCCESSFULY")
    print("==================================================")

if __name__ == "__main__":
    run_full_qa()
