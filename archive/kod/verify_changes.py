"""Verification script for DSGVO/cookie/AVV/reCAPTCHA changes."""
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:4322"

def ok(msg): print(f"PASS  {msg}")
def fail(msg): print(f"FAIL  {msg}")
def probe(msg): print(f"PROBE {msg}")
def info(msg): print(f"INFO  {msg}")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # ── TEST 1: Cookie consent banner ──────────────────────────────
        print("\n=== TEST 1: Cookie Consent Banner ===")
        ctx1 = await browser.new_context()
        page = await ctx1.new_page()
        # Clear storage before loading
        await page.goto(f"{BASE}/index.html", wait_until="domcontentloaded")
        await page.evaluate("localStorage.clear()")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(500)
        await page.screenshot(path="verify_1_banner.png")

        banner = await page.query_selector("#cc-banner")
        if banner:
            ok("Banner #cc-banner found in DOM")
        else:
            fail("Banner #cc-banner NOT found — init() may not have fired or localStorage already set")

        visible = await page.is_visible("#cc-banner") if banner else False
        if visible:
            ok("Banner is visible")
        else:
            fail(f"Banner not visible (banner={banner is not None})")

        reject_btn = await page.query_selector("#cc-reject")
        accept_btn = await page.query_selector("#cc-accept")
        if reject_btn: ok("'Nur notwendige' button #cc-reject present")
        else: fail("'Nur notwendige' button NOT present")
        if accept_btn: ok("'Alle akzeptieren' button #cc-accept present")
        else: fail("'Alle akzeptieren' button NOT present")

        # Check button sizes equal (TTDSG)
        if reject_btn and accept_btn:
            r_box = await reject_btn.bounding_box()
            a_box = await accept_btn.bounding_box()
            if r_box and a_box:
                h_diff = abs(r_box["height"] - a_box["height"])
                info(f"  Reject: {r_box['width']:.0f}x{r_box['height']:.0f}px  Accept: {a_box['width']:.0f}x{a_box['height']:.0f}px")
                if h_diff < 5:
                    ok(f"Button heights equal (diff={h_diff:.1f}px)")
                else:
                    fail(f"Button height mismatch ({h_diff:.1f}px) — TTDSG requires equal prominence")

        # Click accept
        if accept_btn:
            await accept_btn.click()
            await page.wait_for_timeout(700)
            await page.screenshot(path="verify_1_after_accept.png")
            banner_after = page.locator("#cc-banner")
            count = await banner_after.count()
            visible_after = await banner_after.is_visible() if count > 0 else False
            if not visible_after: ok("Banner hidden after accept")
            else: fail("Banner still visible after accept")

            ls_raw = await page.evaluate("localStorage.getItem('praxura_cookie_consent')")
            if ls_raw:
                parsed = json.loads(ls_raw)
                if parsed.get("analytics") is True:
                    ok(f"localStorage analytics=True, v={parsed.get('v')}")
                else:
                    fail(f"localStorage analytics not True: {parsed}")
            else:
                fail("localStorage 'praxura_cookie_consent' NOT set after accept")

        # Probe: reject path
        probe("Testing reject path")
        ctx1r = await browser.new_context()
        page_r = await ctx1r.new_page()
        await page_r.goto(f"{BASE}/index.html", wait_until="domcontentloaded")
        await page_r.evaluate("localStorage.clear()")
        await page_r.reload(wait_until="networkidle")
        await page_r.wait_for_timeout(400)
        rj = await page_r.query_selector("#cc-reject")
        if rj:
            await rj.click()
            await page_r.wait_for_timeout(700)
            ls_r = await page_r.evaluate("localStorage.getItem('praxura_cookie_consent')")
            parsed_r = json.loads(ls_r) if ls_r else {}
            if parsed_r.get("analytics") is False:
                probe(f"Reject sets analytics=False correctly")
            else:
                fail(f"Reject path analytics value wrong: {parsed_r}")
            banner_r = await page_r.is_visible("#cc-banner")
            if not banner_r: probe("Banner hidden after reject")
            else: fail("Banner still visible after reject")
        await ctx1r.close()

        # Probe: revisit hides banner
        probe("Revisit with consent stored — banner should NOT reappear")
        page_r2 = await ctx1.new_page()
        await page_r2.goto(f"{BASE}/index.html", wait_until="networkidle")
        await page_r2.wait_for_timeout(400)
        banner_r2 = await page_r2.query_selector("#cc-banner")
        if not banner_r2:
            probe("Banner does not reappear on revisit (consent remembered)")
        else:
            visible_r2 = await page_r2.is_visible("#cc-banner")
            if not visible_r2:
                probe("Banner present but hidden on revisit")
            else:
                fail("Banner reappears on revisit despite stored consent")
        await ctx1.close()

        # ── TEST 2: AVV Checkbox ───────────────────────────────────────
        print("\n=== TEST 2: AVV Checkbox in Onboarding ===")
        ctx2 = await browser.new_context()
        page2 = await ctx2.new_page()
        await page2.goto(f"{BASE}/onboarding.html", wait_until="networkidle")
        await page2.screenshot(path="verify_2_onboarding.png")

        avv_cb = await page2.query_selector("#consentAvv")
        if avv_cb:
            ok("#consentAvv checkbox found")
            checked = await avv_cb.is_checked()
            if not checked: ok("Checkbox NOT pre-checked (DSGVO opt-in compliant)")
            else: fail("Checkbox is pre-checked — DSGVO violation!")
        else:
            fail("#consentAvv NOT found in onboarding.html")

        # Check link href
        links = await page2.query_selector_all("a[href]")
        dpa_link = None
        for l in links:
            href = await l.get_attribute("href")
            if href and "dpa" in href.lower():
                dpa_link = href
                break
        if dpa_link: ok(f"DPA link found: href='{dpa_link}'")
        else: fail("No link to DPA (/dpa or dpa.html) found on onboarding page")

        await ctx2.close()

        # ── TEST 3: Code checks ────────────────────────────────────────
        print("\n=== TEST 3: Code Checks (reCAPTCHA + email + OAuth revoke) ===")

        with open("supabase-config.js", encoding="utf-8") as f:
            cfg = f.read()
        if "RECAPTCHA_SITE_KEY" in cfg:
            ok("RECAPTCHA_SITE_KEY exported from supabase-config.js")
        else:
            fail("RECAPTCHA_SITE_KEY NOT in supabase-config.js")

        with open("booking.js", encoding="utf-8") as f:
            bk = f.read()
        if "RECAPTCHA_SITE_KEY" in bk: ok("RECAPTCHA_SITE_KEY imported in booking.js")
        else: fail("RECAPTCHA_SITE_KEY not in booking.js")
        if "getRecaptchaToken" in bk: ok("getRecaptchaToken() defined in booking.js")
        else: fail("getRecaptchaToken() missing in booking.js")
        if "recaptcha_token" in bk: ok("recaptcha_token sent in booking POST")
        else: fail("recaptcha_token not in booking POST body")

        with open("employee-signup.js", encoding="utf-8") as f:
            es = f.read()
        if "getRecaptchaToken" in es: ok("getRecaptchaToken() in employee-signup.js")
        else: fail("getRecaptchaToken() missing in employee-signup.js")
        if "recaptcha_token" in es: ok("recaptcha_token in employee-signup POST")
        else: fail("recaptcha_token not in employee-signup POST")

        with open("api-backend/server.js", encoding="utf-8") as f:
            sv = f.read()
        if "sendBookingConfirmationEmails" in sv:
            ok("sendBookingConfirmationEmails() defined in server.js")
        else:
            fail("sendBookingConfirmationEmails() missing")
        if "RESEND_API_KEY" in sv: ok("RESEND_API_KEY referenced in server.js")
        else: fail("RESEND_API_KEY not referenced")
        # fire-and-forget check
        awaited = "await sendBookingConfirmationEmails" in sv
        if not awaited: ok("sendBookingConfirmationEmails NOT awaited (fire-and-forget)")
        else: fail("sendBookingConfirmationEmails is awaited — could delay booking response")

        with open("api/stripe/webhook.js", encoding="utf-8") as f:
            wh = f.read()
        if "revokeGoogleCalendarTokens" in wh:
            ok("revokeGoogleCalendarTokens() in webhook.js")
        else:
            fail("revokeGoogleCalendarTokens() missing from webhook.js")
        if "googleapis.com/revoke" in wh: ok("Google revoke endpoint referenced")
        else: fail("Google revoke URL missing")
        if "subscription.deleted" in wh: ok("subscription.deleted event handled")
        else: fail("subscription.deleted handler not found")

        # VPS verifyRecaptcha
        if "verifyRecaptcha" in sv: ok("verifyRecaptcha() in server.js")
        else: fail("verifyRecaptcha() missing from server.js")
        if "siteverify" in sv: ok("Google siteverify endpoint called")
        else: fail("siteverify endpoint missing")

        await browser.close()
        print("\n=== VERIFICATION COMPLETE ===")

asyncio.run(main())
