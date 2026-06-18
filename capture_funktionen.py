# -*- coding: utf-8 -*-
"""Capture each demo-dashboard panel as a screenshot for the Funktionen walkthrough."""
import os
import time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899/demo-dashboard.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "funktionen-shots", "raw")
os.makedirs(OUT, exist_ok=True)

# panel id (without 'panel-') -> output slug
PANELS = [
    ("overview", "overview"),
    ("calendar", "calendar"),
    ("patients", "patients"),
    ("notes", "notes"),
    ("fahrtenbuch", "fahrtenbuch"),
    ("services", "services"),
    ("hours", "hours"),
    ("employees", "employees"),
    ("doctors", "doctors"),
    ("anamnese", "anamnese"),
    ("invoices", "invoices"),
    ("billing302", "billing302"),
    ("cashbook", "cashbook"),
    ("dunning", "dunning"),
    ("waitinglist", "waitinglist"),
    ("statistics", "statistics"),
    ("b2b", "b2b"),
    ("b2c", "b2c"),
    ("einstellungen", "settings"),
]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        print(f"Loading {BASE}")
        page.goto(BASE, timeout=30000)
        page.wait_for_function("typeof switchPanel === 'function'", timeout=15000)
        # dismiss demo banner so it doesn't cover content (keep app chrome clean)
        page.evaluate("""() => {
            const b = document.querySelector('.demo-banner');
            if (b) b.style.display = 'none';
        }""")
        time.sleep(0.5)
        ok, fail = [], []
        for panel_id, slug in PANELS:
            try:
                page.evaluate(f"switchPanel('panel-{panel_id}')")
                time.sleep(0.9)  # let panel + any chart/animation settle
                # scroll main content to top
                page.evaluate("""() => {
                    const m = document.querySelector('.main-content, .content, main') || document.scrollingElement;
                    if (m) m.scrollTop = 0;
                    window.scrollTo(0,0);
                }""")
                time.sleep(0.3)
                path = os.path.join(OUT, f"{slug}.png")
                page.screenshot(path=path)  # viewport clip
                size = os.path.getsize(path)
                print(f"  [OK] {slug:14s} {size//1024:5d} KB")
                ok.append(slug)
            except Exception as e:
                print(f"  [FAIL] {slug}: {e}")
                fail.append(slug)
        browser.close()
        print(f"\nDONE. {len(ok)} ok, {len(fail)} failed.")
        if fail:
            print("FAILED:", fail)

if __name__ == "__main__":
    run()
