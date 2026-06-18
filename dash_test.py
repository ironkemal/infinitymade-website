# -*- coding: utf-8 -*-
"""Comprehensive demo-dashboard test: every panel + every modal across viewports.
Detects horizontal overflow + modal-overflows-viewport; screenshots everything."""
import os, json, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899/demo-dashboard.html"
ROOT = os.path.dirname(os.path.abspath(__file__))

PANELS = ["overview","calendar","patients","notes","fahrtenbuch","services","hours",
          "employees","doctors","anamnese","invoices","billing302","cashbook","dunning",
          "waitinglist","statistics","b2b","b2c","einstellungen"]

VIEWPORTS = [("desktop",1440,900,False), ("tablet",834,1194,True), ("phone",390,844,True)]

def run():
    report = {"panels": [], "modals": []}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vp,w,h,mob in VIEWPORTS:
            outdir = os.path.join(ROOT,"ui-audit","dash",vp)
            os.makedirs(outdir, exist_ok=True)
            ctx = browser.new_context(viewport={"width":w,"height":h}, is_mobile=mob, has_touch=mob)
            pg = ctx.new_page()
            pg.goto(BASE, wait_until="networkidle", timeout=40000)
            pg.wait_for_function("typeof switchPanel === 'function'", timeout=15000)
            pg.evaluate("""()=>{for(const s of ['.demo-banner','#cookie-banner']){const e=document.querySelector(s);if(e)e.style.display='none';}}""")
            # ---- discover modal ids at runtime ----
            modal_ids = pg.evaluate("""()=>[...document.querySelectorAll('.modal-overlay[id]')].map(m=>m.id)""")
            # ---- PANELS ----
            for slug in PANELS:
                try:
                    pg.evaluate(f"switchPanel('panel-{slug}')")
                    time.sleep(0.7)
                    pg.evaluate("()=>{window.scrollTo(0,0);const m=document.querySelector('.main-area,.main-content,main');if(m)m.scrollTop=0;}")
                    time.sleep(0.2)
                    ov = pg.evaluate("""()=>{const el=document.querySelector('.main-area,.main-content,main')||document.body;
                        return {hov: el.scrollWidth-el.clientWidth, bodyhov: document.documentElement.scrollWidth-document.documentElement.clientWidth};}""")
                    pg.screenshot(path=os.path.join(outdir,f"panel_{slug}.png"))
                    flag = ov["hov"]>2 or ov["bodyhov"]>2
                    report["panels"].append({"vp":vp,"panel":slug,"hov":ov["hov"],"bodyhov":ov["bodyhov"],"FLAG":flag})
                    if flag: print(f"  [OVERFLOW] {vp} panel {slug}: hov={ov['hov']} bodyhov={ov['bodyhov']}")
                except Exception as e:
                    report["panels"].append({"vp":vp,"panel":slug,"error":str(e)[:90]})
                    print(f"  [ERR] {vp} panel {slug}: {str(e)[:80]}")
            # ---- MODALS ----
            for mid in modal_ids:
                try:
                    pg.evaluate("()=>{window.scrollTo(0,0);}")
                    pg.evaluate(f"openModal('{mid}')")
                    time.sleep(0.6)
                    vis = pg.evaluate(f"""()=>{{const m=document.getElementById('{mid}');if(!m)return null;
                        const cs=getComputedStyle(m);const card=m.querySelector('.modal-card,.modal-content,.modal-box')||m;
                        const r=card.getBoundingClientRect();
                        return {{disp:cs.display, vis:cs.visibility, cardH:Math.round(r.height), cardTop:Math.round(r.top),
                                 cardBottom:Math.round(r.bottom), ih:window.innerHeight, hov:card.scrollWidth-card.clientWidth}};}}""")
                    if vis and vis["disp"]!="none":
                        clipped = vis["cardTop"] < -2 or (vis["cardBottom"] > vis["ih"]+2 and vis["cardH"] > vis["ih"])
                        flag = vis["hov"]>2 or clipped
                        pg.screenshot(path=os.path.join(outdir,f"modal_{mid}.png"))
                        report["modals"].append({"vp":vp,"modal":mid,"hov":vis["hov"],"cardTop":vis["cardTop"],
                                                 "cardH":vis["cardH"],"ih":vis["ih"],"clippedTop":vis["cardTop"]<-2,"FLAG":flag})
                        if flag: print(f"  [MODAL ISSUE] {vp} {mid}: hov={vis['hov']} top={vis['cardTop']} h={vis['cardH']}/{vis['ih']}")
                    else:
                        report["modals"].append({"vp":vp,"modal":mid,"openFail":True})
                        print(f"  [MODAL no-open] {vp} {mid}")
                    pg.evaluate(f"()=>{{try{{closeModal(document.getElementById('{mid}'))}}catch(e){{}};try{{closeModal('{mid}')}}catch(e){{}}; const m=document.getElementById('{mid}'); if(m)m.style.display='none';}}")
                    time.sleep(0.2)
                except Exception as e:
                    report["modals"].append({"vp":vp,"modal":mid,"error":str(e)[:90]})
                    print(f"  [ERR] {vp} modal {mid}: {str(e)[:80]}")
            ctx.close()
            print(f"[{vp}] done: {len(PANELS)} panels, {len(modal_ids)} modals")
        browser.close()
    with open(os.path.join(ROOT,"ui-audit","dash","report.json"),"w",encoding="utf-8") as f:
        json.dump(report,f,indent=1)
    pf=[r for r in report["panels"] if r.get("FLAG")]; mf=[r for r in report["modals"] if r.get("FLAG") or r.get("openFail")]
    print(f"\n=== SUMMARY ===\nPanel flags: {len(pf)}  Modal flags/fails: {len(mf)}")
    for r in pf: print("  PANEL", r)
    for r in mf: print("  MODAL", r)

if __name__ == "__main__":
    run()
