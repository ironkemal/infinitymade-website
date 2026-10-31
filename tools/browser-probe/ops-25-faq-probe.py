#!/usr/bin/env python3
"""FAQ25 synthetic read-only clickflow. Real dashboard, SDK module route only.
Requires root-owned safe static localhost:8081 server; never starts server.
"""
import argparse
import hashlib
import importlib.util
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, unquote
from playwright.sync_api import sync_playwright

SPEC = importlib.util.spec_from_file_location("ops_journey", Path(__file__).with_name("dashboard-ops-journey.py"))
J = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(J)
ROOT, ORIGIN, FIXTURE = J.ROOT, J.ORIGIN, J.FIXTURE
PATIENT = "22222222-2222-4222-8222-222222222222"
NAME = "Synthetisch Testpatient"
TABS = ["Verlauf", "Anamnese", "Fußbefund", "Verordnungen", "Dokumente", "Rechnungen"]
BASE_OUT = ROOT / "Claude outputs/2026-10-23-ops-fortsetzung"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def id_reads(reads):
    return [r for r in reads if any(s[0] == "eq" and s[1] in ["id", "lead_id", "patient_id"] and s[2] == PATIENT
        for s in r.get("steps", []))]


def capture_record(page, case, label, out):
    page.wait_for_selector("#patientDetailModal:visible")
    page.wait_for_function("() => document.querySelector('#pdMailLoading')?.hidden && document.querySelector('#pdRechLoading')?.hidden")
    J.check(case, label + ": appointment history loaded", page.locator("#pdTermLoading").evaluate("e => e.hidden"))
    title = page.locator("#pdModalTitle").inner_text()
    tabs = page.locator("#patientDetailModal .pd-tab:visible").all_text_contents()
    reads = page.evaluate("() => window.__opsFixture.reads")
    new_reads = reads[case.pop("readStart"):]
    case.setdefault("identity", {})[label] = {"title": title, "tabs": tabs, "patientIdReads": id_reads(new_reads), "reads": new_reads}
    J.check(case, label + ": visible identity and six podology tabs", title == NAME and tabs == TABS, {"title": title, "tabs": tabs})
    J.check(case, label + ": actual ID-filtered SDK reads", len(id_reads(new_reads)) >= 3, id_reads(new_reads))
    # A completed loader can also show an empty/error state: assert real visible history.
    history_reads = [r for r in new_reads if r.get("table") == "bookings" and any(
        step[0] == "select" and step[1] == "id,start_time,end_time,status,cancellation_reason,cancelled_at,customer_name,services(title,code)"
        for step in r.get("steps", []))]
    expected_filter = 'lead_id.eq.' + PATIENT + ',and(lead_id.is.null,customer_phone.eq."+490000000000")'
    scoped_history = len(history_reads) == 1 and ["eq", "owner_id", "11111111-1111-4111-8111-111111111111"] in history_reads[0]["steps"] and ["or", expected_filter] in history_reads[0]["steps"] and history_reads[0].get("count") == 1
    J.check(case, label + ": appointment query scoped to selected patient", scoped_history, history_reads)
    section = page.locator("#pdVerlaufTermineBox")
    if not section.evaluate("element => element.open"):
        section.locator("summary").click()
    rows = page.locator("#pdTermContent .pd-term-item")
    row_text = rows.first.inner_text() if rows.count() == 1 else ""
    fields = {key: " ".join(rows.first.locator(selector).inner_text().split()) for key, selector in
        [("date", ".pd-term-date"), ("status", ".badge"), ("service", ".pd-term-service")]} if rows.count() == 1 else {}
    expected_fields = {"date": "23.10.2026 · 09:00", "status": "Erledigt", "service": "Synthetische Podologie 78010 30 min"}
    visible_history = rows.count() == 1 and rows.first.is_visible() and fields == expected_fields
    case["identity"][label]["appointmentHistory"] = {"rowText": row_text, "fields": fields, "reads": history_reads}
    J.check(case, label + ": completed appointment visibly rendered", visible_history, row_text)
    J.evidence(page, case, "#patientDetailModal .modal", label, out)
    # Visit all six normal tab buttons; never save, upload, consent, print or send.
    for text in TABS:
        page.locator("#patientDetailModal .pd-tab").filter(has_text=re.compile("^" + re.escape(text) + "$")).click()
        active = page.locator("#patientDetailModal .pd-panel.active")
        J.check(case, label + ": tab " + text, active.count() == 1 and active.is_visible())
    page.locator('#patientDetailModal .modal-close').click()
    page.wait_for_selector("#patientDetailModal", state="hidden")


def run_case(browser, width, theme, box, out):
    ident = f"faq25-{width}-{theme}-" + ("box" if box else "saas")
    case = {"id": ident, "width": width, "theme": theme, "istKutu": box, "checks": [], "screens": {},
        "requests": [], "blocked": [], "console": [], "pageErrors": [], "httpErrors": [], "sourceSha256": {}}
    context = browser.new_context(viewport={"width": width, "height": 900}, service_workers="block",
        locale="de-DE", timezone_id="Europe/Berlin", color_scheme=theme)
    context.set_default_timeout(12000)
    context.add_init_script("localStorage.setItem('im-theme', " + json.dumps(theme) + ");")
    source = (ROOT / "dashboard.js").read_text()
    start = source.index("  podologie: [", source.index("const GKV_LEISTUNGSKATALOG"))
    codes = re.findall(r"code: '([^']+)'", source[start:source.index("\n  ],", start)])
    context.add_init_script("window.__opsCatalogCodes = " + json.dumps(codes) + ";")

    def route_request(route):
        req = route.request
        url = urlsplit(req.url)
        record = {"method": req.method, "path": url.path, "query": url.query}
        if f"{url.scheme}://{url.netloc}" != ORIGIN:
            case["blocked"].append({**record, "reason": "external", "origin": f"{url.scheme}://{url.netloc}"})
            route.abort()
            return
        if req.method == "GET" and url.path == "/vendor/supabase-js.js":
            case["requests"].append({**record, "fixture": "synthetic-sdk-module"})
            route.fulfill(content_type="text/javascript", body=FIXTURE.read_text())
            return
        body = None
        if req.method == "GET" and url.path == "/api/config":
            body = {"supabaseUrl": "https://synthetic.invalid", "supabaseAnonKey": "synthetic-anon-dummy",
                "apiBase": "/api", "istKutu": box, "telemetryEnabled": False}
        elif req.method == "GET" and url.path == "/api/ai/_config":
            body = {"enabled": False, "provider": None, "configured": False, "kiEnabled": False}
        elif req.method == "GET" and url.path == "/api/attendance/report":
            body = {"records": []}
        elif req.method == "GET" and re.fullmatch(r"/api/billing/positions(?:/podologie)?", url.path):
            J.check(case, "synthetic bearer only: " + url.path, req.headers.get("authorization") == "Bearer " + J.TOKEN)
            body = {"positions": [{"hpnr": "78010", "x": "X0501", "kat": "Therapie",
                "name": "Synthetische Position", "preis": 36.10, "zuzahlung": 3.61}]}
        if body is not None:
            case["requests"].append({**record, "status": 200, "fixture": "synthetic-http"})
            route.fulfill(content_type="application/json", body=json.dumps(body))
        elif req.method == "GET" and J.static_allowed(url.path):
            case["requests"].append({**record, "fixture": "real-local-source"})
            path = ROOT / url.path.lstrip("/")
            if path.is_file():
                case["sourceSha256"].setdefault(url.path, digest(path))
            route.continue_()
        else:
            case["blocked"].append({**record, "reason": "unconfigured-local-request"})
            route.abort()

    context.route("**/*", route_request)
    J.block_websockets(context, case["blocked"])  # Mandatory BEFORE new_page.
    page = context.new_page()
    page.clock.set_fixed_time(datetime(2026, 10, 23, 6, 0, tzinfo=timezone.utc))
    page.on("console", lambda msg: case["console"].append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda error: case["pageErrors"].append({"message": str(error), "stack": error.stack}))
    page.on("response", lambda response: case["httpErrors"].append({"url": response.url, "status": response.status}) if response.status >= 400 else None)
    try:
        page.goto(ORIGIN + "/dashboard.html", wait_until="networkidle")
        page.wait_for_selector("#app:visible")
        J.check(case, "real dashboard booted", not page.locator("#loading").is_visible())
        J.check(case, "theme applied", page.locator("html").get_attribute("data-theme") == ("dark" if theme == "dark" else None))
        J.nav(page, "calendar")
        page.locator("#calAddBookingBtn").click()
        page.wait_for_selector("#bookingModal:visible")
        page.locator("#bkCustomerSearch").fill("Testpatient")
        option = page.locator("#bkCustomerList li").filter(has_text="Testpatient").first
        option.click()
        page.wait_for_function("id => document.querySelector('#bkCustomerId').value === id", arg=PATIENT)
        case["selectedPatient"] = {"id": page.locator("#bkCustomerId").input_value(),
            "label": page.locator("#bkCustomerSearch").input_value(), "name": page.locator("#bkCustomer").input_value()}
        J.check(case, "existing synthetic patient selected by normal UI", case["selectedPatient"]["id"] == PATIENT
            and NAME in case["selectedPatient"]["label"] and case["selectedPatient"]["name"] == NAME)
        J.evidence(page, case, "#bookingModal .modal", "new-appointment-selected", out)
        page.locator('#bookingModal .modal-close').click()
        page.wait_for_selector("#bookingModal", state="hidden")
        J.nav(page, "overview")
        page.locator(".dv-booking-block").filter(has_text="Testpatient").first.click()
        page.wait_for_selector("#bkActionModal:visible")
        case["booking"] = page.evaluate("() => window.__opsFixture.dataset.booking")
        J.check(case, "existing completed booking belongs to selected ID", case["booking"]["lead_id"] == PATIENT and case["booking"]["status"] == "completed")
        case["readStart"] = page.evaluate("() => window.__opsFixture.reads.length")
        page.locator("#bkOpenPatientBtn").click()
        capture_record(page, case, "record-from-booking", out)
        if page.locator("#bkActionModal").is_visible():
            page.locator("#bkActionModal .modal-close").click()
        J.nav(page, "kunden")
        row = page.locator('.lead-row[data-lead-id="' + PATIENT + '"]')
        case["readStart"] = page.evaluate("() => window.__opsFixture.reads.length")
        case["listPatientId"] = row.get_attribute("data-lead-id")
        J.check(case, "patient list row has selected ID", case["listPatientId"] == PATIENT)
        row.locator("td").nth(1).click()
        capture_record(page, case, "record-from-list", out)
        J.check(case, "both records resolve selected patient ID", all(v["patientIdReads"] and v["title"] == NAME
            for v in case["identity"].values()) and len(case["identity"]) == 2)
        J.nav(page, "feedback")
        support = page.locator('#panel-feedback a[href^="mailto:"]')
        if box:
            J.check(case, "Box replaces ticket form and list", page.locator("#fbSendBtn").count() == 0 and page.locator("#fbList").count() == 0)
            J.check(case, "Box support link visible", support.count() == 1 and support.is_visible() and support.inner_text() == "Support kontaktieren")
            text = page.locator("#panel-feedback").inner_text()
            J.check(case, "Box patient-data warning visible", "Bitte keine Patientendaten in die Mail." in text)
            case["mailtoReadOnly"] = support.get_attribute("href")  # NEVER click.
            J.check(case, "Box mailto target and warning", case["mailtoReadOnly"].startswith("mailto:support@praxura.de?") and "Bitte keine Patientendaten" in unquote(case["mailtoReadOnly"]))
        else:
            page.wait_for_function("() => document.querySelector('#fbList')?.textContent.includes('Noch keine Tickets.')")
            J.check(case, "SaaS form and list remain", page.locator("#fbSendBtn").is_visible() and page.locator("#fbList").is_visible() and support.count() == 0)
        J.evidence(page, case, "#panel-feedback", "support", out)
    except Exception as error:
        case["failure"] = str(error)
        page.screenshot(path=str(out / f"{ident}-failure.png"), full_page=True)
        case["failureDOM"] = page.locator("body").inner_text()[:24000]
    finally:
        case["fixture"] = page.evaluate("() => window.__opsFixture || null")
        J.check(case, "no unexpected page errors", not case["pageErrors"], case["pageErrors"])
        J.check(case, "no unexpected HTTP/WS requests", not case["blocked"], case["blocked"])
        J.check(case, "no HTTP errors", not case["httpErrors"], case["httpErrors"])
        J.check(case, "no DB/auth/storage mutation or unknown RPC", case["fixture"] is not None and not case["fixture"]["rejected"], case["fixture"]["rejected"] if case["fixture"] else None)
        J.check(case, "no unknown fixture reads", case["fixture"] is not None and not case["fixture"]["unknown"], case["fixture"]["unknown"] if case["fixture"] else None)
        expected = "[initCalendar] #calendarEl not in DOM — skipping legacy FullCalendar init"
        case["unexpectedConsole"] = [x for x in case["console"] if x["type"] in ["warning", "error"] and x["text"] != expected]
        J.check(case, "no unexpected console warnings/errors", not case["unexpectedConsole"], case["unexpectedConsole"])
        changed = [path for path, before in case["sourceSha256"].items() if digest(ROOT / path.lstrip("/")) != before]
        J.check(case, "loaded product sources unchanged during case", not changed, changed)
        case["ok"] = "failure" not in case and all(c["ok"] for c in case["checks"])
        (out / f"{ident}.json").write_text(json.dumps(case, ensure_ascii=False, indent=2))
        context.close()
    return case


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True, help="New faq25-* directory beneath existing authorized output folder")
    parser.add_argument("--width", type=int, choices=[390, 1280])
    parser.add_argument("--theme", choices=["light", "dark"])
    parser.add_argument("--mode", choices=["box", "saas"])
    args = parser.parse_args()
    out = args.out.resolve()
    if out.parent != BASE_OUT or not out.name.startswith("faq25-") or out.exists():
        parser.error("output must be NEW faq25-* directory directly beneath authorized existing output folder")
    out.mkdir()
    paths = [ROOT / "dashboard.html", ROOT / "dashboard.js", FIXTURE, Path(J.__file__), Path(__file__)]
    before = {str(path.relative_to(ROOT)): digest(path) for path in paths}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-background-networking", "--disable-component-update"])
        try:
            boundary = J.boundary_selftest(browser, out)
            if not boundary["ok"]:
                raise RuntimeError("Fixture boundary selftest failed")
            cases = [run_case(browser, width, theme, box, out)
                for width in ([args.width] if args.width else [390, 1280])
                for theme in ([args.theme] if args.theme else ["light", "dark"])
                for box in ([args.mode == "box"] if args.mode else [True, False])]
        finally:
            browser.close()
    report = {"generated": datetime.now(timezone.utc).isoformat(), "syntheticOnly": True,
        "limits": "No real authorization, DB/RLS, persistence, saved draft, treatment, OS/Box/device/mail delivery/video acceptance. No mailto click.",
        "sourceSha256": before, "sourceUnchanged": all(digest(ROOT / path) == value for path, value in before.items()),
        "boundary": {"ok": boundary["ok"], "checks": len(boundary["checks"])}, "cases": cases,
        "passed": sum(c["ok"] for c in cases), "total": len(cases)}
    (out / "faq25-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    for case in cases:
        print(case["id"], "PASS" if case["ok"] else "FAIL", case.get("failure", ""), [c["name"] for c in case["checks"] if not c["ok"]], flush=True)
    print(f"{report['passed']}/{report['total']}; boundary {len(boundary['checks'])}; sources unchanged {report['sourceUnchanged']}; {out}")
    raise SystemExit(0 if all(c["ok"] for c in cases) and report["sourceUnchanged"] else 1)


if __name__ == "__main__":
    main()
