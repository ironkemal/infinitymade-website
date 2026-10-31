#!/usr/bin/env python3
"""Real dashboard bootstrap and click paths, isolated at SDK/HTTP boundary.

Run only against safe static server without env loading on localhost:8081:
  rtk proxy python3 tools/browser-probe/dashboard-ops-journey.py
No product modules/DOM/renderer replacements; synthetic SDK module only.
"""
import argparse
import asyncio
import base64
import hashlib
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright
from greenlet import greenlet

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = "http://localhost:8081"
TOKEN = "synthetic-probe-only"
UNAVAILABLE = "Authentifizierungsdienst vorübergehend nicht verfügbar. Bitte später erneut versuchen."
FIXTURE = Path(__file__).with_name("dashboard-ops-fixture.js")
DEFAULT_OUT = ROOT / "Claude outputs/2026-10-23-ops-dashboard"
# Explicit source families; no arbitrary local root, API passthrough, or dotfiles.
ROOT_SOURCES = {"/dashboard.html", "/dashboard.js", "/dashboard.css", "/dashboard-feinschliff.css", "/supabase-config.js",
    "/sentry-init.js", "/cookie-consent.js", "/nav-registry.js", "/katalog-suche.js",
    "/patient-suche.js", "/calendar-widget.js", "/icd-dg-match.js", "/arzt-suche.js",
    "/favicon.ico", "/manifest.json", "/manifest.webmanifest"}
SOURCE_FAMILIES = {"module": {".js", ".css", ".json"}, "vendor": {".js", ".css", ".map"},
    "fonts": {".woff", ".woff2", ".css"}, "assets": {".png", ".jpg", ".svg", ".webp", ".css"},
    "img": {".png", ".jpg", ".svg", ".webp"}, "images": {".png", ".jpg", ".svg", ".webp"}}


def static_allowed(path):
    if "%" in path:
        return False
    if any(part.startswith(".") or part == ".." for part in path.split("/")):
        return False
    if path in ROOT_SOURCES:
        return True
    parts = path.lstrip("/").split("/")
    return len(parts) > 1 and Path(path).suffix in SOURCE_FAMILIES.get(parts[0], set())


def block_websockets(context, blocked):
    """Fail closed before page creation; never connect to a WebSocket server."""
    async def route_websocket(route):
        blocked.append({"method": "WEBSOCKET", "url": route.url, "reason": "websocket-blocked"})
        # Playwright Python 1.58 dispatches WS callbacks on its event-loop fiber.
        # Its synchronous close() needs a child greenlet to yield back to that loop.
        done = asyncio.get_running_loop().create_future()

        def close():
            try:
                route.close(code=1008, reason="Local test boundary: WebSockets blocked")
                done.set_result(None)
            except Exception as error:
                done.set_exception(error)

        greenlet(close).switch()
        await done

    context.route_web_socket("**/*", route_websocket)


def websocket_boundary_selftest(browser, context, blocked):
    """Prove the context fence with a temporary IPv4-loopback handshake witness."""
    transports, handshakes = [], []

    class WitnessServer(ThreadingHTTPServer):
        def get_request(self):
            connection, address = super().get_request()
            connection.settimeout(2)
            transports.append(address[0])
            return connection, address

    class WitnessHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            key = self.headers.get("Sec-WebSocket-Key")
            if self.headers.get("Upgrade", "").lower() != "websocket" or not key:
                self.send_error(400)
                return
            handshakes.append(self.path)
            accept = base64.b64encode(hashlib.sha1(
                (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()).decode("ascii")
            self.send_response(101)
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", accept)
            self.end_headers()
            self.wfile.flush()

        def log_message(self, *_args):
            pass

    probe = """url => new Promise(resolve => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {ws.close(); resolve({event:'timeout'});}, 3000);
      const done = value => {clearTimeout(timer); resolve(value);};
      ws.onopen = () => {ws.close(); done({event:'open'});};
      ws.onclose = e => done({event:'close', code:e.code, reason:e.reason});
    })"""
    witness = WitnessServer(("127.0.0.1", 0), WitnessHandler)
    worker = threading.Thread(target=witness.serve_forever, daemon=True)
    worker.start()
    control = browser.new_context(service_workers="block")
    # Only WebSockets escape this HTTP-only control. No external URL is used.
    control.route("**/*", lambda route: route.abort())
    base = f"ws://127.0.0.1:{witness.server_port}"
    expected = {"method": "WEBSOCKET", "url": base + "/guarded", "reason": "websocket-blocked"}
    try:
        control_page = control.new_page()
        control_page.set_content("<!doctype html><title>Loopback WebSocket control</title>")
        control_result = control_page.evaluate(probe, base + "/control")
        control_counts = {"transport": len(transports), "handshakes": list(handshakes)}
        guarded_page = context.new_page()
        guarded_page.set_content("<!doctype html><title>Loopback WebSocket fence</title>")
        guarded_result = guarded_page.evaluate(probe, expected["url"])
        # Allow pending accepts to surface before counting zero guarded transport.
        guarded_page.wait_for_timeout(150)
        guarded_counts = {"transport": len(transports) - control_counts["transport"],
            "handshakes": handshakes[len(control_counts["handshakes"]):]}
        guarded_page.close()
        checks = [
            {"name": "WebSocket HTTP-only control reaches loopback witness", "ok": control_result["event"] == "open"
                and control_counts == {"transport": 1, "handshakes": ["/control"]}},
            {"name": "WebSocket fence prevents transport and handshake", "ok": guarded_counts == {"transport": 0, "handshakes": []}},
            {"name": "WebSocket fence logs exact blocked attempt", "ok": blocked == [expected]},
            {"name": "WebSocket fence closes with policy violation", "ok": guarded_result == {
                "event": "close", "code": 1008, "reason": "Local test boundary: WebSockets blocked"}},
        ]
        return {"checks": checks, "control": {**control_counts, "browser": control_result},
            "guarded": {**guarded_counts, "browser": guarded_result}, "expectedBlocked": expected}
    finally:
        control.close()
        witness.shutdown()
        witness.server_close()
        worker.join(timeout=3)


def boundary_selftest(browser, out):
    """Adapter safety/contract test, separate from real dashboard acceptance."""
    context = browser.new_context(service_workers="block")
    blocked = []

    def route_request(route):
        url = urlsplit(route.request.url)
        if route.request.url == ORIGIN + "/synthetic-boundary.html" and route.request.method == "GET":
            route.fulfill(content_type="text/html", body="<!doctype html><title>Synthetic fixture boundary self-test</title>")
        elif route.request.url == ORIGIN + "/vendor/supabase-js.js" and route.request.method == "GET":
            route.fulfill(content_type="text/javascript", body=FIXTURE.read_text())
        else:
            blocked.append({"method": route.request.method, "path": url.path})
            route.abort()

    context.route("**/*", route_request)
    block_websockets(context, blocked)
    page = context.new_page()
    try:
        page.goto(ORIGIN + "/synthetic-boundary.html")
        result = page.evaluate("""async () => {
          const {createClient}=await import('/vendor/supabase-js.js');
          const sb=createClient('https://synthetic.invalid','synthetic-anon-dummy');
          const checks=[];
          const test=(name,ok)=>checks.push({name,ok:!!ok});
          const id=window.__opsFixture.ids.OWNER;
          const read=await sb.from('profiles').select('id,role').eq('id',id).single();
          test('single/projection/filter', read.data.id===id && read.data.role==='owner' && !('email' in read.data));
          const none=await sb.from('profiles').select('*').eq('id','absent').maybeSingle();
          test('maybeSingle absent => null', none.data===null && none.error===null);
          const missing=await sb.from('profiles').select('*').eq('id','absent').single();
          test('single absent => PGRST116', missing.error?.code==='PGRST116');
          const count=await sb.from('working_hours').select('day_of_week',{count:'exact',head:true}).gte('day_of_week',2).lte('day_of_week',4);
          test('filter/head/exact count', count.data===null && count.count===3);
          const sorted=await sb.from('working_hours').select('day_of_week').order('day_of_week',{ascending:false}).range(1,2);
          test('descending/range', JSON.stringify(sorted.data)==='[{"day_of_week":5},{"day_of_week":4}]');
          const alternatives=await sb.from('working_hours').select('day_of_week').or('day_of_week.eq.1,day_of_week.eq.3');
          test('OR syntax/column type', alternatives.data?.length===2);
          const member=await sb.from('working_hours').select('day_of_week').in('day_of_week',[1,3]);
          test('typed IN', member.data?.length===2);
          const joined=await sb.from('prescriptions').select('id,leads:patient_id(first_name),podologie_behandlungen(hpnr_codes)').single();
          test('joined relation projection', joined.data?.leads?.first_name==='Synthetisch' && joined.data?.podologie_behandlungen?.length===1);
          const unknown=await sb.from('unconfigured_table').select('*');
          test('unknown read fails closed + logged', unknown.error?.code==='FIXTURE_REQUIRED' && window.__opsFixture.unknown.length===1);
          for(const name of ['insert','update','upsert','delete']) {
            const before=window.__opsFixture.rejected.length;
            try { await sb.from('profiles')[name]({id}); } catch {}
            test('DB '+name+' logged/rejected', window.__opsFixture.rejected.length===before+1);
          }
          for(const name of ['signOut','refreshSession','setSession','signInWithPassword','signUp','updateUser','resetPasswordForEmail']) {
            const before=window.__opsFixture.rejected.length;
            try { await sb.auth[name]({}); } catch {}
            test('Auth '+name+' logged/rejected', window.__opsFixture.rejected.length===before+1);
          }
          for(const name of ['upload','update','remove','createSignedUrl']) {
            const before=window.__opsFixture.rejected.length;
            try { await sb.storage.from('synthetic')[name]('test'); } catch {}
            test('Storage '+name+' logged/rejected', window.__opsFixture.rejected.length===before+1);
          }
          for(const [kind,action] of [['Storage bucket',()=>sb.storage.createBucket('synthetic')],
              ['unknown RPC',()=>sb.rpc('unconfigured_rpc')],['Edge function',()=>sb.functions.invoke('unconfigured_function')]]) {
            const before=window.__opsFixture.rejected.length;
            try { await action(); } catch {}
            test(kind+' logged/rejected',window.__opsFixture.rejected.length===before+1);
          }
          return {checks, fixture:window.__opsFixture};
        }""")
        result["websocketWitness"] = websocket_boundary_selftest(browser, context, blocked)
        result["checks"].extend(result["websocketWitness"]["checks"])
        result["blocked"] = blocked
        result["ok"] = all(c["ok"] for c in result["checks"]) and blocked == [result["websocketWitness"]["expectedBlocked"]]
        (out / "fixture-boundary-selftest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
        return result
    finally:
        context.close()


def check(case, name, ok, details=None):
    item = {"name": name, "ok": bool(ok)}
    if details is not None:
        item["details"] = details
    case["checks"].append(item)


def nav(page, panel):
    if page.locator("#hamburger").is_visible() and not page.locator(".sidebar").evaluate("e => e.classList.contains('open')"):
        page.locator("#hamburger").click()
    button = page.locator(f'#sidebarNav [data-panel="{panel}"]')
    group = button.locator("xpath=ancestor::div[@data-group-id]")
    if not group.evaluate("e => e.classList.contains('open')"):
        group.locator(".nav-group-header").click()
    button.click()
    page.wait_for_selector(f"#panel-{panel}.active")


def evidence(page, case, target, label, out):
    element = page.locator(target)
    element.wait_for(state="visible")
    element.scroll_into_view_if_needed()
    # Scroll the actual notice into view as a user would inside the side panel.
    # Checking innerText alone would miss clipping by its sticky action footer.
    notice = element.locator('[role="status"]').filter(has_text=re.compile(r"Authentifizierungsdienst|HTTP 401")).first
    if notice.count():
        notice.evaluate("e => e.scrollIntoView({block:'center',behavior:'instant'})")
    page.wait_for_timeout(100)
    text = element.inner_text()
    geometry = element.evaluate("""e => ({ width:e.clientWidth, scrollWidth:e.scrollWidth,
      rootWidth:document.documentElement.clientWidth, rootScrollWidth:document.documentElement.scrollWidth,
      mainWidth:document.getElementById('mainArea')?.clientWidth,
      mainScrollWidth:document.getElementById('mainArea')?.scrollWidth,
      notice:(e.id==='abDetailContent'&&/^Konnte nicht geladen werden/.test(e.textContent)?[e]:
        [...e.querySelectorAll('[role="status"]')].filter(n=>/Authentifizierungsdienst|HTTP 401/.test(n.textContent))).map(n=>{const r=n.getBoundingClientRect();
        const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return {text:n.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},
          centerVisible:!!hit&&(n===hit||n.contains(hit)),occluder:hit?.id||hit?.className};}),
      overflowing:[...e.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().width &&
        (n.getBoundingClientRect().right>innerWidth+1 || n.getBoundingClientRect().left < -1)).slice(0,15)
        .map(n=>({tag:n.tagName,id:n.id,cls:String(n.className).slice(0,100),width:n.getBoundingClientRect().width})) })""")
    path = out / f"{case['id']}-{label}.png"
    page.screenshot(path=str(path), full_page=True)
    viewport_path = out / f"{case['id']}-{label}-viewport.png"
    page.screenshot(path=str(viewport_path))
    case["screens"][label] = {"path": str(path.relative_to(ROOT)), "viewportPath": str(viewport_path.relative_to(ROOT)),
        "target": target, "text": text, "geometry": geometry}
    check(case, label + ": no horizontal overflow", geometry["scrollWidth"] <= geometry["width"] + 1
          and geometry["rootScrollWidth"] <= geometry["rootWidth"] + 1, geometry)
    if geometry["notice"]:
        check(case, label + ": error notice visually exposed", all(n["centerVisible"] for n in geometry["notice"]), geometry["notice"])
    return text


def run_case(browser, width, theme, status, out, recovery=False):
    ident = f"{width}-{theme}-{status}" + ("-recovery" if recovery else "")
    case = {"id": ident, "width": width, "theme": theme, "status": status, "checks": [],
        "screens": {}, "requests": [], "blocked": [], "console": [], "pageErrors": [], "sourceSha256": {}}
    active = {"status": status}
    context = browser.new_context(viewport={"width": width, "height": 900}, service_workers="block",
        locale="de-DE", timezone_id="Europe/Berlin", color_scheme=theme)
    context.set_default_timeout(12000)
    # Theme preference only, in a fresh empty browser context; never real account storage.
    context.add_init_script("localStorage.setItem('im-theme', " + json.dumps(theme) + ");")
    # Deterministic code extraction only; no model conversion of billing numbers.
    source = (ROOT / "dashboard.js").read_text()
    start = source.index("  podologie: [", source.index("const GKV_LEISTUNGSKATALOG"))
    catalog_codes = re.findall(r"code: '([^']+)'", source[start:source.index("\n  ],", start)])
    context.add_init_script("window.__opsCatalogCodes = " + json.dumps(catalog_codes) + ";")

    def route_request(route):
        req = route.request
        url = urlsplit(req.url)
        origin = f"{url.scheme}://{url.netloc}"
        record = {"method": req.method, "path": url.path, "query": url.query}
        if origin != ORIGIN:
            case["blocked"].append({**record, "origin": origin, "reason": "external"})
            route.abort()
            return
        if req.method == "GET" and url.path == "/vendor/supabase-js.js":
            case["requests"].append({**record, "fixture": "synthetic-sdk-module"})
            route.fulfill(status=200, content_type="text/javascript", body=FIXTURE.read_text())
            return
        body = None
        code = 200
        if url.path == "/api/config" and req.method == "GET":
            body = {"supabaseUrl": "https://synthetic.invalid", "supabaseAnonKey": "synthetic-anon-dummy",
                "apiBase": "/api", "istKutu": False, "telemetryEnabled": False}
        elif url.path == "/api/ai/_config" and req.method == "GET":
            body = {"enabled": False, "provider": None, "configured": False, "kiEnabled": False}
        elif url.path == "/api/attendance/report" and req.method == "GET":
            body = {"records": []}
        elif (re.fullmatch(r"/api/billing/positions(?:/podologie)?", url.path)
              or re.fullmatch(r"/api/billing/abrechnung/55555555-5555-4555-8555-555555555555/zeilen", url.path)) and req.method == "GET":
            check(case, "synthetic bearer only: " + url.path, req.headers.get("authorization") == "Bearer " + TOKEN)
            code = active["status"]
            if code != 200:
                body = {"error": UNAVAILABLE, "code": "AUTH_UNAVAILABLE"} if code == 503 else {"error": "Invalid token"}
            elif url.path.endswith("/zeilen"):
                line = {"id": "synthetic-line", "abrechnung_id": "55555555-5555-4555-8555-555555555555",
                    "prescription_id": "33333333-3333-4333-8333-333333333333", "belegnummer": "SYN-0001",
                    "einzel_rechnungsnummer": "SYN-302-0001", "patient_name": "Synthetisch Testpatient",
                    "verordnungsdatum": "2026-10-23", "anzahl_einheiten": 1, "heilmittel_position": "78010",
                    "status": "offen", "herkunft": "eingefroren", "brutto_eur": 36.10,
                    "zuzahlung_eur": 13.61, "netto_eur": 22.49, "absetzung_eur": 0,
                    "leistungen": [{"datum": "2026-10-23", "positionsnummer": "78010", "anzahl": 1, "einzelbetrag": 36.10}]}
                body = {"abrechnung": {"id": "55555555-5555-4555-8555-555555555555", "status": "erstellt",
                    "dateiname": "TSOL_SYNTHETIC_ONLY", "total_eur": 36.10, "zuzahlung_total": 13.61,
                    "kostentraeger_ik": "999999998", "empfaenger_ik": "999999997", "rechnungsnummer": "SYN-302-0001",
                    "prescription_count": 1, "created_at": "2026-10-23T06:00:00Z", "betriebsart": "test"},
                    "gruppen": [{"einzel_rechnungsnummer": "SYN-302-0001", "karten_ik": "999999998",
                        "brutto_eur": 36.10, "zuzahlung_eur": 13.61, "netto_eur": 22.49, "absetzung_eur": 0, "zeilen": [line]}],
                    "zeilen": [line], "geld": {"eingereicht": 22.49, "abgesetzt": 0, "bezahlt": 0, "offen": 22.49}}
            else:
                body = {"positions": [{"hpnr": "78010", "x": "X0501", "kat": "Therapie",
                    "name": "Synthetische Position", "preis": 36.10, "zuzahlung": 3.61}]}
        elif url.path == "/api/billing/abrechnung/annahmestellen" and req.method == "POST":
            # This POST resolves lookup data; does not create billing/files/payments.
            check(case, "annahmestellen read-only POST bearer", req.headers.get("authorization") == "Bearer " + TOKEN)
            check(case, "annahmestellen synthetic IKs only", json.loads(req.post_data or "{}").get("iks") == ["999999998"])
            body = {"annahmestellen": {"999999998": {"aufloesbar": True, "davIk": "999999997",
                "davName": "Synthetische Annahmestelle", "kassenart": "01", "dateieinheit": "999999997:01"}}}
        if body is not None:
            case["requests"].append({**record, "status": code, "fixture": "synthetic-http"})
            route.fulfill(status=code, content_type="application/json", body=json.dumps(body))
        elif req.method == "GET" and static_allowed(url.path):
            case["requests"].append({**record, "fixture": "real-local-source"})
            source_file = ROOT / url.path.lstrip("/")
            if url.path not in case["sourceSha256"] and source_file.is_file():
                case["sourceSha256"][url.path] = hashlib.sha256(source_file.read_bytes()).hexdigest()
            route.continue_()
        else:
            case["blocked"].append({**record, "reason": "unconfigured-local-request"})
            route.abort()

    context.route("**/*", route_request)
    block_websockets(context, case["blocked"])
    page = context.new_page()
    # Fixed synthetic test day/time; timers remain real. No product clock changes.
    page.clock.set_fixed_time(datetime(2026, 10, 23, 6, 0, tzinfo=timezone.utc))
    page.on("console", lambda msg: case["console"].append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda error: case["pageErrors"].append(str(error)))
    try:
        page.goto(ORIGIN + "/dashboard.html", wait_until="networkidle")
        page.wait_for_selector("#app:visible")
        check(case, "real app booted; loading hidden", not page.locator("#loading").is_visible())
        check(case, "theme applied", page.locator("html").get_attribute("data-theme") == ("dark" if theme == "dark" else None))
        nav(page, "verordnungen")
        row = page.locator('#vordTbody .vord-row[data-vord-id="33333333-3333-4333-8333-333333333333"]')
        row.click()
        page.wait_for_selector('#vordDetailContent[data-geladen="1"]')
        text = evidence(page, case, "#vordDetailContent", "verordnung", out)
        check(case, "verordnung price/error", "13,61" in text and "36,10" in text if status == 200
            else (UNAVAILABLE if status == 503 else "401") in text and not re.search(r"13,61|10,00|0,00\s*€", text))
        nav(page, "overview")
        # Normal daily schedule event, not direct invocation of product function.
        page.locator(".dv-booking-block").filter(has_text="Testpatient").first.click()
        page.wait_for_selector("#bkRxGeldZeile #bkRxEuroBtn")
        page.wait_for_function("""status => {
          const e=document.getElementById('bkRxGeldZeile');
          const text=e?.textContent||'';
          return status===200 ? /13,61/.test(text)&&!/voraussichtlich/.test(text)
            : (status===503 ? /Authentifizierungsdienst/ : /401/).test(text);
        }""", arg=status)
        money = evidence(page, case, "#bkRxGeldZeile", "geld", out)
        check(case, "money: price/error and cashier gate", ("13,61" in money and not page.locator("#bkRxEuroBtn").is_disabled())
            if status == 200 else ((UNAVAILABLE if status == 503 else "401") in money
                and not re.search(r"13,61|36,10|0,00\s*€", money) and page.locator("#bkRxEuroBtn").is_disabled()))
        if recovery:
            requests_before = len([r for r in case["requests"] if r["path"].startswith("/api/billing/positions")])
            active["status"] = 200
            page.wait_for_timeout(500)
            check(case, "recovery: no automatic retry", requests_before == len([r for r in case["requests"] if r["path"].startswith("/api/billing/positions")])
                and page.locator("#bkRxEuroBtn").is_disabled())
            page.locator('#bkActionModal .modal-close').click()
            page.locator(".dv-booking-block").filter(has_text="Testpatient").first.click()
            page.wait_for_function("""() => {
              const text=document.getElementById('bkRxGeldZeile')?.textContent||'';
              return text.includes('13,61') && !text.includes('voraussichtlich') && !document.getElementById('bkRxEuroBtn')?.disabled;
            }""")
            money = evidence(page, case, "#bkRxGeldZeile", "geld-recovered", out)
            check(case, "recovery: explicit reopen restores 13.61", "13,61" in money and UNAVAILABLE not in money)
        page.locator('#bkActionModal .modal-close').click()
        nav(page, "abrechnung")
        page.locator('[data-ab-goto="bisherige"]').click()
        page.locator('#abVerlaufTbody .ab-verlauf-row').first.click()
        page.wait_for_function("""() => {
          const e=document.getElementById('abDetailContent');
          return /SYN-302-0001|Konnte nicht geladen werden/.test(e?.textContent || '');
        }""")
        text = evidence(page, case, "#abDetailContent", "abrechnung", out)
        final_status = active["status"]
        check(case, "§302 detail: success/error", all(value in text for value in ["SYN-302-0001", "36,10", "13,61", "22,49"])
            if final_status == 200
            else (UNAVAILABLE if final_status == 503 else "Invalid token") in text
                and not re.search(r"36,10|13,61|22,49|0,00\s*€", text))
    except Exception as error:
        case["failure"] = str(error)
        page.screenshot(path=str(out / f"{ident}-failure.png"), full_page=True)
        case["failureDOM"] = page.locator("body").inner_text()[:18000]
    finally:
        case["fixture"] = page.evaluate("() => window.__opsFixture || null")
        check(case, "no unexpected page errors", not case["pageErrors"], case["pageErrors"])
        check(case, "no unexpected network requests", not case["blocked"], case["blocked"])
        check(case, "no DB/auth/storage mutations or unknown RPC", case["fixture"] is not None and not case["fixture"]["rejected"],
              case["fixture"]["rejected"] if case["fixture"] else None)
        check(case, "no unknown fixture reads", case["fixture"] is not None and not case["fixture"]["unknown"],
              case["fixture"]["unknown"] if case["fixture"] else None)
        expected_console = re.compile(r"^(Failed to load resource: the server responded with a status of (401|503)|"
            r"\[initCalendar\] #calendarEl not in DOM — skipping legacy FullCalendar init|"
            r"\[(?:podologie-positionen|positions/load|abrechnung-detail)\] (?:Error: )?(?:"
            r"Authentifizierungsdienst vorübergehend nicht verfügbar|Preiskatalog konnte nicht geladen werden \(HTTP 401\)|Invalid token))")
        case["unexpectedConsole"] = [entry for entry in case["console"] if entry["type"] in ["warning", "error"]
            and not expected_console.search(entry["text"])]
        check(case, "no unexpected console warning/error", not case["unexpectedConsole"], case["unexpectedConsole"])
        case["ok"] = "failure" not in case and all(c["ok"] for c in case["checks"])
        (out / f"{ident}.json").write_text(json.dumps(case, ensure_ascii=False, indent=2))
        context.close()
    return case


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--width", type=int, choices=[390, 1280])
    parser.add_argument("--theme", choices=["light", "dark"])
    parser.add_argument("--status", type=int, choices=[503, 401, 200])
    parser.add_argument("--recovery", action="store_true", help="Run explicit 503→200 reopen (in addition to matrix).")
    args = parser.parse_args()
    out = DEFAULT_OUT
    out.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-background-networking", "--disable-component-update"])
        try:
            boundary = boundary_selftest(browser, out)
            if not boundary["ok"]:
                raise RuntimeError("Fixture boundary self-test failed; see fixture-boundary-selftest.json")
            for width in [args.width] if args.width else [390, 1280]:
                for theme in [args.theme] if args.theme else ["light", "dark"]:
                    for status in [args.status] if args.status else [503, 401, 200]:
                        result = run_case(browser, width, theme, status, out)
                        results.append(result)
                        print(result["id"], "PASS" if result["ok"] else "FAIL", result.get("failure", ""), flush=True)
                        print("  failed checks:", [c["name"] for c in result["checks"] if not c["ok"]], flush=True)
            if args.recovery:
                result = run_case(browser, 1280, "light", 503, out, recovery=True)
                results.append(result)
                print(result["id"], "PASS" if result["ok"] else "FAIL", result.get("failure", ""), flush=True)
        finally:
            browser.close()
    report = {"generated": datetime.now().isoformat(), "syntheticOnly": True,
        "limits": "Real unchanged dashboard bootstrap/navigation/modules; synthetic SDK/HTTP; no DB/RLS/Auth server/clinical/OS/live acceptance.",
        "sources": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in [ROOT / "dashboard.html", ROOT / "dashboard.js", FIXTURE, Path(__file__)]},
        "boundarySelftest": {"ok": boundary["ok"], "checks": len(boundary["checks"])},
        "cases": results, "passed": sum(r["ok"] for r in results), "total": len(results)}
    (out / "journey-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"{report['passed']}/{report['total']} cases passed. Evidence: {out}")
    raise SystemExit(0 if report["passed"] == report["total"] else 1)


if __name__ == "__main__":
    main()
