# -*- coding: utf-8 -*-
"""Verify the Funktionen walkthrough component renders + is interactive."""
import time
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/index.html"
OUT = "C:/tmp"

def run():
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": 1440, "height": 1200}, device_scale_factor=1)
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error","warning") else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.goto(URL, timeout=30000, wait_until="domcontentloaded")
        page.wait_for_selector("#fnx", timeout=10000)
        page.eval_on_selector("#funktionen", "el => el.scrollIntoView()")
        time.sleep(1.0)
        # state 1: default (rezept-scan step 1)
        page.locator("#funktionen").screenshot(path=f"{OUT}/fnx_1_default.png")
        # check rail built
        n_fns = page.eval_on_selector_all(".fnx-fn", "els => els.length")
        n_cats = page.eval_on_selector_all(".fnx-cat", "els => els.length")
        img_src = page.eval_on_selector("#fnxImg", "el => el.getAttribute('src')")
        title = page.eval_on_selector("#fnxTitle", "el => el.textContent")
        print(f"rail fns={n_fns} cats={n_cats} img={img_src} title={title!r}")
        # click §302 function
        page.locator('.fnx-fn[data-fn="billing302"]').click()
        time.sleep(0.6)
        page.locator("#funktionen").screenshot(path=f"{OUT}/fnx_2_billing.png")
        b302_title = page.eval_on_selector("#fnxTitle", "el => el.textContent")
        n_dots = page.eval_on_selector_all("#fnxDots .fnx-dot", "els => els.length")
        print(f"billing302 title={b302_title!r} dots={n_dots}")
        # click 3rd dot
        if n_dots >= 3:
            page.locator("#fnxDots .fnx-dot").nth(2).click()
            time.sleep(0.5)
            page.locator("#funktionen").screenshot(path=f"{OUT}/fnx_3_dot3.png")
            dot_title = page.eval_on_selector("#fnxTitle", "el => el.textContent")
            print(f"dot3 title={dot_title!r}")
        # click a single-step fn (settings)
        page.locator('.fnx-fn[data-fn="settings"]').click()
        time.sleep(0.5)
        page.locator("#funktionen").screenshot(path=f"{OUT}/fnx_4_settings.png")
        b.close()
    print("\n=== console errors/warnings ===")
    if errors:
        for e in errors[:30]:
            print("  ", e)
    else:
        print("  (none)")

if __name__ == "__main__":
    run()
