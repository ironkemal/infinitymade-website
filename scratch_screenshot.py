from playwright.sync_api import sync_playwright
import os

def capture():
    print("Launching browser...")
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        url = "http://localhost:8081/index.html"
        print(f"Navigating to {url}...")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(2000) # wait a bit for animations
        
        output_path = r"C:\Users\Test\Desktop\claude\website\landing_page.png"
        print(f"Taking screenshot and saving to {output_path}...")
        page.screenshot(path=output_path, full_page=True)
        b.close()
    print("Screenshot captured successfully!")

if __name__ == "__main__":
    capture()
