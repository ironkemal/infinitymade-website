import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

# Module level variable for tagging events
current_panel = "login"

def run_qa_crawler():
    global current_panel
    print("==================================================")
    print("STARTING LIVE END-TO-END QA CRAWLER (PRODUCTION)")
    print("==================================================")
    
    # Ensure c:\\tmp exists
    tmp_dir = r"C:\tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    
    # 21 panels to visit in this order
    panel_ids = [
        "overview", "calendar", "kunden", "services", "hours", "team", "doctors",
        "notizen", "anamnese", "rechnungen", "abrechnung", "belegliste", "mahnwesen",
        "warteliste", "statistik", "fahrtenbuch", "b2b", "b2c", "settings",
        "feedback", "beispielmodus"
    ]
    
    # Structured results container
    # Initialize dictionary for "login" and all panel_ids
    results = {
        "login": {
            "failed_requests": [],
            "http_errors": [],
            "console_errors": [],
            "page_errors": [],
            "dom_errors": []
        }
    }
    for pid in panel_ids:
        results[pid] = {
            "failed_requests": [],
            "http_errors": [],
            "console_errors": [],
            "page_errors": [],
            "dom_errors": []
        }
        
    # Listeners
    def handle_requestfailed(request):
        try:
            url = request.url
            failure_text = request.failure.error_text if request.failure else "Unknown failure"
            results[current_panel]["failed_requests"].append({
                "url": url,
                "failure_text": failure_text
            })
            print(f"[{current_panel.upper()} REQUEST FAILED] {url} - {failure_text}")
        except Exception:
            pass
            
    def handle_response(response):
        try:
            url = response.url
            status = response.status
            if status >= 400 and ("/api" in url or "supabase" in url):
                response_text = ""
                try:
                    response_text = response.text()
                    # Limit response text size just in case it's huge
                    if len(response_text) > 1000:
                        response_text = response_text[:1000] + "..."
                except Exception as e:
                    response_text = f"<Could not read response: {e}>"
                
                results[current_panel]["http_errors"].append({
                    "url": url,
                    "status": status,
                    "response_text": response_text
                })
                print(f"[{current_panel.upper()} HTTP ERROR {status}] {url}")
        except Exception:
            pass
            
    def handle_console(msg):
        try:
            if msg.type == "error":
                results[current_panel]["console_errors"].append({
                    "text": msg.text,
                    "location": msg.location
                })
                print(f"[{current_panel.upper()} CONSOLE ERROR] {msg.text} ({msg.location})")
        except Exception:
            pass
            
    def handle_pageerror(err):
        try:
            results[current_panel]["page_errors"].append(str(err))
            print(f"[{current_panel.upper()} PAGE ERROR] {err}")
        except Exception:
            pass
            
    with sync_playwright() as p:
        # 1. Launches Chromium headless. Viewport 1366x900.
        print("Launching Chromium headlessly...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1366, "height": 900})
        page = context.new_page()
        
        # Register listeners BEFORE navigation
        page.on("requestfailed", handle_requestfailed)
        page.on("response", handle_response)
        page.on("console", handle_console)
        page.on("pageerror", handle_pageerror)
        
        # 3. Logs in
        current_panel = "login"
        login_url = "https://app.praxura.de/login.html"
        print(f"Navigating to login page: {login_url}")
        try:
            page.goto(login_url, timeout=30000)
            page.wait_for_selector("#email", timeout=10000)
            
            print("Filling in credentials...")
            page.fill("#email", "fizyo6@gmail.com")
            page.fill("#password", "Yavuzkemal123.")
            
            print("Submitting login form...")
            page.click("#submitBtn")
            
            print("Waiting for redirection to dashboard...")
            page.wait_for_url("**/dashboard.html*", timeout=20000)
            
            print("Waiting for dashboard initialization (#app visible)...")
            page.wait_for_selector("#app", state="visible", timeout=20000)
            print("Successfully logged in and dashboard is loaded!")
            time.sleep(2)  # Short pause to let initial page settle
            
        except Exception as e:
            print(f"CRITICAL LOGIN FAILURE: {e}")
            screenshot_path = os.path.join(tmp_dir, "qa_login_fail.png")
            try:
                page.screenshot(path=screenshot_path)
                print(f"Login failure screenshot saved to: {screenshot_path}")
            except Exception as se:
                print(f"Failed to save screenshot: {se}")
            browser.close()
            sys.exit(1)
            
        # 4. Visit each panel
        for pid in panel_ids:
            print(f"\n--- Crawling Panel: {pid} ---")
            current_panel = pid
            
            # Navigate using switchPanel(id) via evaluate
            try:
                print(f"Evaluating switchPanel('{pid}')...")
                page.evaluate(f"switchPanel('{pid}')")
            except Exception as nav_err:
                print(f"Error executing switchPanel for {pid}: {nav_err}")
                results[pid]["dom_errors"].append({
                    "type": "navigation_failure",
                    "details": f"Failed to execute switchPanel('{pid}'): {nav_err}"
                })
                continue
                
            # Wait ~3500ms for async loads
            print("Waiting 3500ms for async data loading...")
            time.sleep(3.5)
            
            # Check the DOM for visible error indicators inside the active panel
            try:
                # Target panel selector #panel-{pid} or fallback
                panel_selector = f"#panel-{pid}"
                panel_exists = page.query_selector(panel_selector) is not None
                if not panel_exists:
                    # try fallback to active panel
                    panel_selector = ".panel.active"
                    if page.query_selector(panel_selector) is None:
                        panel_selector = "body"
                
                # A. Check text matches
                texts_to_check = ["failed to fetch", "Fehler", "Error", "Krankenkasse fehlt", "Kostenträger fehlt"]
                for text in texts_to_check:
                    text_found = page.evaluate("""
                        ([selector, text]) => {
                            const root = document.querySelector(selector);
                            if (!root) return false;
                            
                            function isVisible(el) {
                                if (!el) return false;
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && 
                                       style.visibility !== 'hidden' && 
                                       style.opacity !== '0' &&
                                       el.getBoundingClientRect().width > 0 &&
                                       el.getBoundingClientRect().height > 0;
                            }
                            
                            const elements = root.querySelectorAll('*');
                            for (const el of elements) {
                                if (isVisible(el)) {
                                    const children = Array.from(el.childNodes);
                                    const hasDirectText = children.some(node => 
                                        node.nodeType === Node.TEXT_NODE && 
                                        node.textContent.toLowerCase().includes(text.toLowerCase())
                                    );
                                    if (hasDirectText) return true;
                                }
                            }
                            if (isVisible(root)) {
                                const children = Array.from(root.childNodes);
                                const hasDirectText = children.some(node => 
                                    node.nodeType === Node.TEXT_NODE && 
                                    node.textContent.toLowerCase().includes(text.toLowerCase())
                                );
                                if (hasDirectText) return true;
                            }
                            return false;
                        }
                    """, [panel_selector, text])
                    
                    if text_found:
                        err_item = {
                            "type": "text_match",
                            "details": f"Found visible error text: '{text}'"
                        }
                        results[pid]["dom_errors"].append(err_item)
                        print(f"[{pid.upper()} DOM ERROR] {err_item['details']}")
                        
                # B. Check for a visible toast error
                toast_found = page.evaluate("""
                    () => {
                        const toast = document.querySelector('.toast.error');
                        if (!toast) return false;
                        const style = window.getComputedStyle(toast);
                        return style.display !== 'none' && 
                               style.visibility !== 'hidden' && 
                               toast.getBoundingClientRect().width > 0;
                    }
                """)
                if toast_found:
                    toast_text = page.locator(".toast.error").first.inner_text()
                    err_item = {
                        "type": "toast_error",
                        "details": f"Visible toast error detected: {toast_text}"
                    }
                    results[pid]["dom_errors"].append(err_item)
                    print(f"[{pid.upper()} DOM ERROR] {err_item['details']}")
                    
                # C. Check for stuck spinner (.spinner or .upcoming-loading still visible)
                spinner_selector = f"{panel_selector} .spinner, {panel_selector} .upcoming-loading"
                spinner_found = page.evaluate("""
                    (selector) => {
                        const spinners = document.querySelectorAll(selector);
                        for (const spinner of spinners) {
                            const style = window.getComputedStyle(spinner);
                            if (style.display !== 'none' && 
                                style.visibility !== 'hidden' && 
                                spinner.getBoundingClientRect().width > 0) {
                                return true;
                            }
                        }
                        return false;
                    }
                """, spinner_selector)
                if spinner_found:
                    err_item = {
                        "type": "stuck_spinner",
                        "details": "Stuck spinner (.spinner or .upcoming-loading) is still visible"
                    }
                    results[pid]["dom_errors"].append(err_item)
                    print(f"[{pid.upper()} DOM ERROR] {err_item['details']}")
                    
            except Exception as dom_err:
                print(f"Error checking DOM for panel {pid}: {dom_err}")
                
        # Close the browser
        print("\nCrawling finished. Closing browser...")
        browser.close()
        
    print("==================================================")
    print("QA CRAWL COMPLETED")
    print("==================================================")
    
    # Save the output results json
    results_json_path = os.path.join(tmp_dir, "qa_crawl_results.json")
    with open(results_json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Results written to: {results_json_path}")
    
    # Concise stdout summary
    print("\n--- CONCISE SUMMARY ---")
    print(f"{'Panel ID':<20} | {'Req Fail':<8} | {'HTTP Err':<8} | {'Console':<8} | {'Page Err':<8} | {'DOM Err':<8}")
    print("-" * 75)
    for p_name, data in results.items():
        req_fail = len(data["failed_requests"])
        http_err = len(data["http_errors"])
        con_err = len(data["console_errors"])
        page_err = len(data["page_errors"])
        dom_err = len(data["dom_errors"])
        # Only print summary if there's any activity or it's not the initial "login" panel (unless login had issues)
        if p_name == "login" and (req_fail + http_err + con_err + page_err + dom_err == 0):
            continue
        print(f"{p_name:<20} | {req_fail:<8} | {http_err:<8} | {con_err:<8} | {page_err:<8} | {dom_err:<8}")
    print("-" * 75)

if __name__ == "__main__":
    run_qa_crawler()
