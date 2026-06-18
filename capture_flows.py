# -*- coding: utf-8 -*-
"""Capture multi-step interactive flows (modals/wizards) from demo-dashboard."""
import os
import time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899/demo-dashboard.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "funktionen-shots", "raw")
os.makedirs(OUT, exist_ok=True)

def shot(page, slug):
    path = os.path.join(OUT, f"{slug}.png")
    page.screenshot(path=path)
    print(f"  [OK] {slug:18s} {os.path.getsize(path)//1024:5d} KB")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        page.goto(BASE, timeout=30000)
        page.wait_for_function("typeof switchPanel === 'function'", timeout=15000)
        page.evaluate("() => { const b=document.querySelector('.demo-banner'); if(b) b.style.display='none'; }")
        time.sleep(0.4)

        def panel(pid):
            page.evaluate(f"switchPanel('panel-{pid}')")
            time.sleep(0.7)

        # ---- KI-Rezept-Scan: step2 auto-advances to step3 after ~1.8s ----
        panel("billing302")
        page.evaluate("openRezeptScan()"); time.sleep(0.8); shot(page, "rezept-1")
        page.evaluate("navigateRezeptScan(1)"); time.sleep(0.7); shot(page, "rezept-2")  # scanning state (before auto-advance)
        time.sleep(1.9); shot(page, "rezept-3")  # auto-advanced detailed result
        page.evaluate("closeModal(document.getElementById('modal-rezept-scan'))"); time.sleep(0.5)

        # ---- §302 DTA wizard: 3 steps ----
        page.evaluate("open302Wizard()"); time.sleep(0.8); shot(page, "billing302-w1")
        page.evaluate("navigate302Wizard(1)"); time.sleep(0.7); shot(page, "billing302-w2")
        page.evaluate("navigate302Wizard(1)"); time.sleep(0.7); shot(page, "billing302-w3")
        page.evaluate("closeModal(document.getElementById('modal-302-wizard'))"); time.sleep(0.5)

        # ---- New appointment modal ----
        panel("calendar")
        page.evaluate("openModal('modal-new-appt')"); time.sleep(0.7); shot(page, "calendar-new")
        page.evaluate("closeModal(document.getElementById('modal-new-appt'))"); time.sleep(0.4)

        # ---- Patient detail modal (rich record w/ tabs) ----
        panel("patients")
        page.evaluate("openPatientDetailModal(0)"); time.sleep(0.7); shot(page, "patients-detail")
        page.evaluate("document.querySelectorAll('.modal-overlay').forEach(m=>{if(m.style.display==='flex')closeModal(m)})"); time.sleep(0.4)

        # ---- Invoice PDF modal ----
        panel("invoices")
        page.evaluate("openInvoicePdfModal('RE-2026-039','Klaus Bergmann','€187,50','Bezahlt')"); time.sleep(0.7); shot(page, "invoices-pdf")
        page.evaluate("document.querySelectorAll('.modal-overlay').forEach(m=>{if(m.style.display==='flex')closeModal(m)})"); time.sleep(0.4)

        # ---- New trip (Fahrtenbuch) modal ----
        panel("fahrtenbuch")
        page.evaluate("openModal('modal-new-trip')"); time.sleep(0.7); shot(page, "fahrtenbuch-new")
        page.evaluate("closeModal(document.getElementById('modal-new-trip'))"); time.sleep(0.4)

        # ---- Anamnese wizard ----
        panel("anamnese")
        page.evaluate("openAnamneseWizard()"); time.sleep(0.7); shot(page, "anamnese-wizard")
        page.evaluate("document.querySelectorAll('.modal-overlay').forEach(m=>{if(m.style.display==='flex')closeModal(m)})"); time.sleep(0.4)

        # ---- Dunning modal ----
        panel("dunning")
        page.evaluate("openDunningModal('RE-2026-042','Stefan Wolff')"); time.sleep(0.7); shot(page, "dunning-modal")
        page.evaluate("document.querySelectorAll('.modal-overlay').forEach(m=>{if(m.style.display==='flex')closeModal(m)})"); time.sleep(0.4)

        browser.close()
        print("DONE flows.")

if __name__ == "__main__":
    run()
