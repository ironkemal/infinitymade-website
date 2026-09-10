from playwright.sync_api import sync_playwright
import time

def run_live_demo():
    print("Starting Playwright in headed mode (headless=False)...")
    print("You should see a Chromium browser window open on your screen shortly!")
    
    with sync_playwright() as p:
        # Launch headed browser so the user can see it
        browser = p.chromium.launch(headless=False, args=["--start-maximized"])
        context = browser.new_context(no_viewport=True)
        page = context.new_page()
        
        # Navigate to the local server
        url = "http://localhost:8081/index.html"
        print(f"Navigating to {url}...")
        page.goto(url)
        
        # Wait a bit so the user can see the initial state
        print("Page loaded. Pausing for 3 seconds...")
        time.sleep(3)
        
        # Slowly scroll down the page to simulate human reading and show the content
        print("Scrolling down the page...")
        for i in range(1, 10):
            page.evaluate(f"window.scrollTo(0, document.body.scrollHeight * {i/10});")
            time.sleep(0.5)
            
        time.sleep(2)
        
        # Scroll back to the top
        print("Scrolling back to the top...")
        page.evaluate("window.scrollTo(0, 0);")
        time.sleep(2)
        
        print("Demo completed. Closing browser in 3 seconds...")
        time.sleep(3)
        browser.close()
        
    print("Browser closed.")

if __name__ == "__main__":
    run_live_demo()
