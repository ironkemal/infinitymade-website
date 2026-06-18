from playwright.sync_api import sync_playwright
import time
import os

def run_login_demo():
    print("Starting Playwright in headed mode (headless=False)...")
    print("You should see the Chromium browser window open on your screen shortly!")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=["--start-maximized"])
        context = browser.new_context(no_viewport=True)
        page = context.new_page()
        
        # Navigate to login page
        url = "http://localhost:8081/login.html"
        print(f"Navigating to {url}...")
        page.goto(url)
        
        # Wait for form to be visible
        page.wait_for_selector("#email")
        
        # Fill in the credentials
        print("Filling in credentials...")
        page.fill("#email", "fizyo6@gmail.com")
        page.wait_for_timeout(500)
        page.fill("#password", "Yavuzkemal123.")
        page.wait_for_timeout(500)
        
        # Click login button
        print("Submitting login form...")
        page.click("#submitBtn")
        
        # Wait for navigation to the dashboard
        print("Waiting for redirection to dashboard...")
        # Since it routes to dashboard.html, let's wait for url to contain 'dashboard'
        try:
            page.wait_for_url("**/dashboard.html**", timeout=15000)
            print("Successfully redirected to dashboard!")
        except Exception as e:
            print("Navigation timeout or error:", e)
            print("Current URL:", page.url)
        
        # Let it stay on dashboard for 8 seconds so the user can inspect it
        print("Staying on dashboard for 8 seconds so you can watch...")
        time.sleep(8)
        
        # Take a screenshot of the dashboard
        output_path = r"C:\Users\Test\Desktop\claude\website\dashboard_logged_in.png"
        print(f"Taking a screenshot of the dashboard and saving to {output_path}...")
        page.screenshot(path=output_path, full_page=True)
        
        # Close the browser
        print("Closing the browser...")
        browser.close()
        
    print("Process finished successfully!")

if __name__ == "__main__":
    run_login_demo()
