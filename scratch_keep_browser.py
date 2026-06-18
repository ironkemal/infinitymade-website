from playwright.sync_api import sync_playwright
import sys

def run_persistent_browser():
    print("Starting Playwright in headed mode (headless=False)...")
    print("This browser will STAY OPEN until you press Enter in the console or close it manually.")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=["--start-maximized"])
        context = browser.new_context(no_viewport=True)
        page = context.new_page()
        
        url = "http://localhost:8081/login.html"
        print(f"Navigating to {url}...")
        page.goto(url)
        
        # Fill in credentials
        page.wait_for_selector("#email")
        print("Filling in credentials...")
        page.fill("#email", "fizyo6@gmail.com")
        page.wait_for_timeout(500)
        page.fill("#password", "Yavuzkemal123.")
        page.wait_for_timeout(500)
        
        print("Submitting login form...")
        page.click("#submitBtn")
        
        try:
            page.wait_for_url("**/dashboard.html**", timeout=15000)
            print("\nSuccessfully logged in and reached the Dashboard!")
        except Exception as e:
            print("\nRedirection to dashboard timed out or took longer than expected.")
        
        print("\n" + "="*60)
        print("TARAYICI SU AN ACIK VE KONTROLUNUZDE!")
        print("Tarayiciyi kapatmak icin buraya tiklayip Enter'a basabilirsiniz.")
        print("="*60)
        
        # Wait for user input in the console to close
        input("Kapatmak icin Enter tusuna basin...")
        
        browser.close()
    print("Browser closed successfully.")

if __name__ == "__main__":
    run_persistent_browser()
