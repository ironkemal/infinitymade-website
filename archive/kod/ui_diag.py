# -*- coding: utf-8 -*-
"""Targeted diagnostics: funktionen image load + topbar overlap detection."""
import os, time, json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui-audit", "diag")
os.makedirs(OUT, exist_ok=True)

def rects_overlap(a, b):
    return not (a['x']+a['width'] <= b['x'] or b['x']+b['width'] <= a['x'] or
                a['y']+a['height'] <= b['y'] or b['y']+b['height'] <= a['y'])

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # ---- FUNKTIONEN image check (tablet 800 + phone 390) ----
        for label, w, h in [("tab800", 800, 1280), ("phone390", 390, 844)]:
            ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True)
            pg = ctx.new_page()
            pg.goto(BASE + "/index.html", wait_until="networkidle", timeout=30000)
            pg.eval_on_selector("#funktionen", "el => el.scrollIntoView()")
            time.sleep(1.5)
            info = pg.evaluate("""() => {
                const img = document.querySelector('#fnxImg');
                if (!img) return {found:false};
                const r = img.getBoundingClientRect();
                return {found:true, src: img.currentSrc||img.src||'', complete: img.complete,
                        nw: img.naturalWidth, nh: img.naturalHeight,
                        boxW: Math.round(r.width), boxH: Math.round(r.height)};
            }""")
            print(f"[fnxImg {label}] {json.dumps(info)}")
            try:
                pg.eval_on_selector("#funktionen", "el => el.scrollIntoView()")
                time.sleep(0.4)
                pg.locator("#fnx").screenshot(path=os.path.join(OUT, f"fnx__{label}.png"))
            except Exception as e:
                print("  shot fail:", e)
            ctx.close()

        # ---- TOPBAR overlap check on demo-dashboard (phones) ----
        for label, w, h in [("p360", 360, 800), ("p430", 430, 932)]:
            ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True)
            pg = ctx.new_page()
            pg.goto(BASE + "/demo-dashboard.html", wait_until="networkidle", timeout=30000)
            time.sleep(0.6)
            boxes = pg.evaluate("""() => {
                const sels = ['.biz-name','#bizName','.brand','.lang-select','.theme-toggle','.logout-btn','#rezeptScanBtn','.topbar-right','.hamburger'];
                const out = {};
                for (const s of sels){ const el=document.querySelector(s);
                    if(el){ const r=el.getBoundingClientRect();
                        if(r.width>0&&r.height>0) out[s]={x:r.x,y:r.y,width:r.width,height:r.height,vis:getComputedStyle(el).display}; } }
                return out;
            }""")
            # detect overlaps between biz-name and right-side controls
            overlaps = []
            keys = list(boxes.keys())
            for i in range(len(keys)):
                for j in range(i+1, len(keys)):
                    a,b = boxes[keys[i]], boxes[keys[j]]
                    if rects_overlap(a,b):
                        overlaps.append(f"{keys[i]} <> {keys[j]}")
            print(f"[topbar {label}] overlaps: {overlaps if overlaps else 'NONE'}")
            print(f"   bizName display: {boxes.get('#bizName',{}).get('vis','(absent)')}")
            try:
                pg.locator(".topbar").screenshot(path=os.path.join(OUT, f"topbar__{label}.png"))
            except Exception as e:
                print("  shot fail:", e)
            ctx.close()
        browser.close()

if __name__ == "__main__":
    run()
