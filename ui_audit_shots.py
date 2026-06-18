# -*- coding: utf-8 -*-
"""Responsive UI audit: capture key pages across iOS/Android phone+tablet viewports.
Full-page screenshots so text-overlap / overflow below the fold is visible.
Usage: python ui_audit_shots.py [baseline|after]
"""
import os, sys, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899"
PHASE = sys.argv[1] if len(sys.argv) > 1 else "baseline"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui-audit", PHASE)
os.makedirs(OUT, exist_ok=True)

# page slug -> url path
PAGES = [
    ("index",        "/index.html"),
    ("demo-dash",    "/demo-dashboard.html"),
    ("booking",      "/booking.html"),
    ("login",        "/login.html"),
    ("onboarding",   "/onboarding.html"),
    ("seo-physio",   "/praxissoftware-physiotherapie.html"),
]

# label -> (width, height, is_mobile)  -- ★ = tablet (user priority)
VIEWPORTS = [
    ("iphone-se",        375,  667,  True),   # iOS phone small
    ("iphone-15promax",  430,  932,  True),   # iOS phone large
    ("pixel7",           412,  915,  True),   # Android phone
    ("galaxy-s",         360,  800,  True),   # Android phone small
    ("ipad-mini-p",      768, 1024,  True),   # ★ iOS tablet portrait (boundary)
    ("ipad-pro11-p",     834, 1194,  True),   # ★ iOS tablet portrait
    ("ipad-landscape",  1180,  820,  True),   # ★ iOS tablet landscape
    ("galaxytab-p",      800, 1280,  True),   # ★ Android tablet portrait
    ("galaxytab-l",     1280,  800,  True),   # ★ Android tablet landscape
]

def run():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vlabel, w, h, is_mobile in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": w, "height": h},
                is_mobile=is_mobile,
                has_touch=is_mobile,
                device_scale_factor=1,
            )
            page = context.new_page()
            for slug, path in PAGES:
                fname = f"{slug}__{vlabel}.png"
                fpath = os.path.join(OUT, fname)
                try:
                    page.goto(BASE + path, timeout=30000, wait_until="networkidle")
                    # dismiss demo banner / cookie banner so they don't cover content
                    page.evaluate("""() => {
                        for (const sel of ['.demo-banner','#cookie-banner','.cookie-banner']) {
                            const el = document.querySelector(sel); if (el) el.style.display='none';
                        }
                    }""")
                    time.sleep(0.6)
                    page.screenshot(path=fpath, full_page=True)
                    kb = os.path.getsize(fpath)//1024
                    print(f"[OK] {vlabel:16s} {slug:12s} {kb:5d} KB")
                    results.append((vlabel, slug, "ok"))
                except Exception as e:
                    print(f"[FAIL] {vlabel} {slug}: {str(e)[:100]}")
                    results.append((vlabel, slug, "fail"))
            context.close()
        browser.close()
    ok = sum(1 for r in results if r[2]=="ok")
    print(f"\nDONE [{PHASE}]: {ok}/{len(results)} captured -> {OUT}")

if __name__ == "__main__":
    run()
