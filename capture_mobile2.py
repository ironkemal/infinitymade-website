# -*- coding: utf-8 -*-
"""Capture remaining panels + key modals + topbar closeup at mobile viewport."""
import os, sys, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899/demo-dashboard.html"
TAG = sys.argv[1] if len(sys.argv) > 1 else "before"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mobile-audit", TAG)
os.makedirs(OUT, exist_ok=True)

PANELS = [
    ("notes", "10-notes"), ("fahrtenbuch", "11-fahrtenbuch"),
    ("services", "12-services"), ("hours", "13-hours"),
    ("employees", "14-employees"), ("doctors", "15-doctors"),
    ("anamnese", "16-anamnese"), ("dunning", "17-dunning"),
    ("waitinglist", "18-waitinglist"), ("b2b", "19-b2b"),
]
MODALS = [
    ("modal-new-appt", "m1-new-appt"),
    ("modal-302-wizard", "m2-302-wizard"),
    ("modal-rezept-scan", "m3-rezept-scan"),
    ("modal-anamnese-wizard", "m4-anamnese-wizard"),
    ("modal-invoice-pdf", "m5-invoice-pdf"),
    ("modal-patient-details", "m6-patient-details"),
]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True)
        page.goto(BASE, timeout=30000)
        page.wait_for_function("typeof switchPanel === 'function'", timeout=15000)
        time.sleep(1)
        # topbar closeup
        page.screenshot(path=os.path.join(OUT, "00b-topbar-clip.png"), clip={"x":0,"y":36,"width":390,"height":60})
        for pid, slug in PANELS:
            try:
                page.evaluate(f"switchPanel('panel-{pid}')")
                time.sleep(0.6)
                page.screenshot(path=os.path.join(OUT, f"{slug}.png"), full_page=True)
                print(f"OK {slug}")
            except Exception as e:
                print(f"FAIL {slug}: {e}")
        for mid, slug in MODALS:
            try:
                page.evaluate(f"if(typeof openModal==='function'){{openModal('{mid}')}}else{{document.getElementById('{mid}').style.display='flex'}}")
                time.sleep(0.6)
                page.screenshot(path=os.path.join(OUT, f"{slug}.png"))
                page.evaluate(f"document.getElementById('{mid}').style.display='none'")
                print(f"OK {slug}")
            except Exception as e:
                print(f"FAIL {slug}: {e}")
        browser.close()

if __name__ == "__main__":
    run()
