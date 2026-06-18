# -*- coding: utf-8 -*-
"""Capture demo-dashboard panels at mobile viewport to inspect responsive breakage."""
import os, sys, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899/demo-dashboard.html"
TAG = sys.argv[1] if len(sys.argv) > 1 else "before"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mobile-audit", TAG)
os.makedirs(OUT, exist_ok=True)

PANELS = [
    ("overview", "01-overview"),
    ("calendar", "02-calendar"),
    ("patients", "03-patients"),
    ("statistics", "04-statistics"),
    ("billing302", "05-billing302"),
    ("invoices", "06-invoices"),
    ("cashbook", "07-cashbook"),
    ("b2c", "08-b2c"),
    ("einstellungen", "09-settings"),
]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # iPhone 12-ish
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True)
        page.goto(BASE, timeout=30000)
        page.wait_for_function("typeof switchPanel === 'function'", timeout=15000)
        time.sleep(1)
        # topbar-only shot first (default view)
        page.screenshot(path=os.path.join(OUT, "00-topbar-default.png"))
        for pid, slug in PANELS:
            try:
                page.evaluate(f"switchPanel('panel-{pid}')")
                time.sleep(0.8)
                page.screenshot(path=os.path.join(OUT, f"{slug}.png"), full_page=True)
                print(f"OK {slug}")
            except Exception as e:
                print(f"FAIL {slug}: {e}")
        browser.close()

if __name__ == "__main__":
    run()
