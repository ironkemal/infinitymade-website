# qa_demo_prep.py  --  Praxura Demo Hazirlik QA (2026-06-11)
# Kapsamli feature testi: login, tum paneller, §302 abrechnung, KI rezept, belegliste,
# kalender, kunden, settings, warteliste, mahnwesen, statistik, team.
# Headed=True (gorsel browser), screenshots C:/tmp/demo_* altina kaydedilir.

import os
import sys
import time
import json
import datetime
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TMP = r"C:\tmp"
os.makedirs(TMP, exist_ok=True)

TS = int(time.time())
RESULTS = []
ERRORS_GLOBAL = []
PASS = 0
FAIL = 0
WARN = 0

LOGIN_URL = "https://app.praxura.de/login.html"
EMAIL = "fizyo6@gmail.com"
PASSWORD = "Yavuzkemal123."

def ss(page, name):
    path = os.path.join(TMP, f"demo_{name}.png")
    try:
        page.screenshot(path=path, full_page=False)
    except Exception as e:
        print(f"  [screenshot failed: {e}]")
    return path

def log(status, scenario, detail, path=""):
    global PASS, FAIL, WARN
    icon = {"PASS":"✅","FAIL":"❌","WARN":"⚠️","INFO":"ℹ️"}.get(status,"?")
    clean = detail.encode('ascii','ignore').decode('ascii')
    print(f"{icon} [{status}] {scenario}: {clean[:120]}")
    RESULTS.append({"status": status, "scenario": scenario, "detail": detail, "screenshot": os.path.basename(path)})
    if status == "PASS": PASS += 1
    elif status == "FAIL": FAIL += 1
    elif status == "WARN": WARN += 1

def wait_panel(page, pid, timeout=8000):
    """Switch to panel and wait for content."""
    page.evaluate(f"window.switchPanel('{pid}')")
    time.sleep(3.5)

def read_toast(page, ms=2000):
    deadline = time.time() + ms/1000
    while time.time() < deadline:
        try:
            txt = page.evaluate("""
                () => {
                    const t = document.querySelector('#toastContainer .toast') || document.querySelector('.toast');
                    return t ? t.textContent.trim() : '';
                }
            """)
            if txt: return txt
        except: pass
        time.sleep(0.1)
    return ""

def close_modals(page):
    for _ in range(3):
        open_count = page.evaluate("""
            () => document.querySelectorAll('.modal-overlay:not([hidden])').length
        """)
        if open_count == 0: break
        page.keyboard.press("Escape")
        time.sleep(0.3)
        try:
            page.evaluate("""
                () => {
                    document.querySelectorAll('[data-modal], .modal-close').forEach(b => b.click());
                }
            """)
        except: pass
        time.sleep(0.3)

def first_non_empty(page, sel, timeout=8000):
    deadline = time.time() + timeout/1000
    while time.time() < deadline:
        opts = page.evaluate(f"() => Array.from(document.querySelectorAll('{sel} option')).map(o=>o.value).filter(Boolean)")
        if opts:
            page.select_option(sel, value=opts[0])
            return opts[0]
        time.sleep(0.3)
    raise Exception(f"No non-empty options in {sel}")

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def run():
    global PASS, FAIL, WARN

    with sync_playwright() as p:
        print("="*60)
        print("PRAXURA DEMO HAZIRLIK QA  —  headed Chromium")
        print("="*60)

        browser = p.chromium.launch(
            headless=False,
            args=["--window-size=1366,900"]
        )
        ctx = browser.new_context(viewport={"width": 1366, "height": 900})
        page = ctx.new_page()

        # Error listeners
        page.on("pageerror", lambda e: ERRORS_GLOBAL.append(f"PAGEERROR: {e}"))
        page.on("console", lambda m: ERRORS_GLOBAL.append(f"CONSOLE {m.type}: {m.text}") if m.type == "error" else None)
        http_errors = []
        page.on("response", lambda r: http_errors.append(f"{r.status} {r.url}") if r.status >= 400 and ("api" in r.url or "supabase" in r.url) else None)

        # ──────────────────────────────────────
        # 01. LOGIN
        # ──────────────────────────────────────
        print("\n═══ 01. LOGIN ═══")
        try:
            page.goto(LOGIN_URL, timeout=30000)
            page.wait_for_selector("#email", timeout=10000)
            page.fill("#email", EMAIL)
            page.fill("#password", PASSWORD)
            page.click("#submitBtn")
            page.wait_for_url("**/dashboard.html*", timeout=30000)
            page.wait_for_selector("#app", state="visible", timeout=20000)
            time.sleep(3)
            path = ss(page, "01_login_dashboard")
            log("PASS", "Login + Dashboard yükle", "Giriş başarılı, dashboard açıldı", path)
        except Exception as e:
            path = ss(page, "01_login_FAIL")
            log("FAIL", "Login", str(e), path)
            browser.close()
            return

        # ──────────────────────────────────────
        # 02. OVERVIEW PANEL
        # ──────────────────────────────────────
        print("\n═══ 02. OVERVIEW ═══")
        try:
            wait_panel(page, "overview")
            path = ss(page, "02_overview")
            errs = page.evaluate("() => document.querySelector('#panel-overview')?.innerText.toLowerCase().includes('fehler') || false")
            log("WARN" if errs else "PASS", "Overview paneli", "Panel yüklendi" + (" — DOM'da 'Fehler' metni var" if errs else ""), path)
        except Exception as e:
            log("FAIL", "Overview paneli", str(e), ss(page, "02_overview_FAIL"))

        # ──────────────────────────────────────
        # 03. KALENDER — randevu oluştur
        # ──────────────────────────────────────
        print("\n═══ 03. KALENDER — yeni randevu ═══")
        booking_created = False
        try:
            wait_panel(page, "calendar")
            page.click("#calAddBookingBtn")
            page.wait_for_selector("#bookingModal", state="visible", timeout=10000)
            time.sleep(1.5)

            # Çalışan seç
            page.wait_for_function("() => document.querySelectorAll('#bkEmployee option').length > 1", timeout=8000)
            page.select_option("#bkEmployee", index=1)
            time.sleep(2)  # async service reload

            # Hizmet seç
            svc = first_non_empty(page, "#bkService")

            # Tarih: 3 gün sonra 11:00
            target = (datetime.datetime.now() + datetime.timedelta(days=3)).strftime("%Y-%m-%dT11:00")
            page.fill("#bkStart", target)

            # Hausbesuch kapat
            if page.locator("#bkHausbesuch").is_checked():
                page.uncheck("#bkHausbesuch")

            # Hasta ara
            customer_selected = False
            for letter in ["a", "e", "i", "m", "t"]:
                page.fill("#bkCustomerSearch", "")
                page.fill("#bkCustomerSearch", letter)
                time.sleep(1.5)
                li_els = page.query_selector_all("#bkCustomerList li[data-id]")
                if li_els:
                    li_els[0].click()
                    customer_selected = True
                    break

            path_form = ss(page, "03a_booking_form")
            if not customer_selected:
                log("WARN", "Kalender — randevu", "Hasta bulunamadı (müşteri listesi boş?)", path_form)
                close_modals(page)
            else:
                cust_name = page.locator("#bkCustomer").input_value()
                page.click("#bkSaveBtn")
                toast = read_toast(page, 3000)
                time.sleep(1.5)
                modal_open = page.locator("#bookingModal").is_visible()
                path = ss(page, "03b_booking_result")
                if not modal_open:
                    booking_created = True
                    log("PASS", "Kalender — randevu oluştur", f"Randevu kaydedildi (hasta: {cust_name}). Toast: '{toast}'", path)
                else:
                    log("FAIL", "Kalender — randevu oluştur", f"Modal açık kaldı. Toast: '{toast}'", path)
                close_modals(page)
        except Exception as e:
            log("FAIL", "Kalender — randevu oluştur", str(e), ss(page, "03_booking_FAIL"))
            close_modals(page)

        # ──────────────────────────────────────
        # 04. KUNDEN — hasta ekle
        # ──────────────────────────────────────
        print("\n═══ 04. KUNDEN — hasta ekle ═══")
        patient_id = None
        try:
            wait_panel(page, "kunden")
            page.click("#leadAddBtn")
            page.wait_for_selector("#leadModal", state="visible", timeout=10000)
            time.sleep(1)

            pf = f"DEMO {TS}"
            pl = "Hasta"
            page.fill("#lead-first-name", pf)
            page.fill("#lead-last-name", pl)
            page.fill("#lead-geburtsdatum", "1985-06-15")
            page.fill("#lead-phone", "017666666666")
            page.fill("#lead-email", f"demo_{TS}@example.com")
            page.fill("#lead-city", "München")
            page.fill("#lead-street", "Teststrasse 1")
            page.fill("#lead-plz", "80333")

            # Krankenkasse
            try:
                first_non_empty(page, "#lead-krankenkasse")
                page.fill("#lead-krankenkassennummer", "A123456789")
            except:
                log("WARN", "Kunden — hasta ekle", "Krankenkasse dropdown boş (KK listesi yüklenmedi?)")

            path_form = ss(page, "04a_lead_form")
            page.click("#leadSaveBtn")
            page.wait_for_selector("#leadModal", state="hidden", timeout=15000)
            time.sleep(2)

            # Patient ID al
            row = page.query_selector(f"#leadTableBody tr.lead-row")
            if row:
                rows = page.query_selector_all("#leadTableBody tr.lead-row")
                patient_id = rows[0].get_attribute("data-lead-id") if rows else None

            path = ss(page, "04b_lead_saved")
            log("PASS", "Kunden — hasta ekle", f"Hasta '{pf} {pl}' oluşturuldu. ID: {patient_id}", path)
        except Exception as e:
            log("FAIL", "Kunden — hasta ekle", str(e), ss(page, "04_lead_FAIL"))
            close_modals(page)

        # ──────────────────────────────────────
        # 04c. KUNDEN — hasta listesi & arama
        # ──────────────────────────────────────
        print("\n═══ 04c. KUNDEN — arama ═══")
        try:
            page.fill("#leadSearchInput", "DEMO")
            time.sleep(1.5)
            row_count = page.evaluate("() => document.querySelectorAll('#leadTableBody tr.lead-row').length")
            path = ss(page, "04c_lead_search")
            log("PASS" if row_count > 0 else "WARN", "Kunden — hasta arama", f"'{row_count}' satır döndü", path)
            # Arama temizle
            page.fill("#leadSearchInput", "")
            time.sleep(1)
        except Exception as e:
            log("FAIL", "Kunden — hasta arama", str(e))

        # ──────────────────────────────────────
        # 05. KALENDER — tam görünüm
        # ──────────────────────────────────────
        print("\n═══ 05. KALENDER — panel görünüm ═══")
        try:
            wait_panel(page, "calendar")
            path = ss(page, "05_calendar_view")
            log("PASS", "Kalender — panel görünüm", "Takvim paneli açıldı", path)
        except Exception as e:
            log("FAIL", "Kalender — panel görünüm", str(e))

        # ──────────────────────────────────────
        # 06. ABRECHNUNG §302
        # ──────────────────────────────────────
        print("\n═══ 06. ABRECHNUNG §302 ═══")
        try:
            wait_panel(page, "abrechnung")
            path = ss(page, "06a_abrechnung")
            content = page.evaluate("() => document.querySelector('#panel-abrechnung')?.innerText?.substring(0,400) || ''")
            has_error = "fehler" in content.lower() or "failed to fetch" in content.lower()
            log("WARN" if has_error else "PASS", "Abrechnung §302 paneli",
                ("Hata içerik var: " + content[:100]) if has_error else "Panel yüklendi: " + content[:100], path)
        except Exception as e:
            log("FAIL", "Abrechnung §302 paneli", str(e), ss(page, "06_abrechnung_FAIL"))

        # ──────────────────────────────────────
        # 07. BELEGLISTE (GoBD)
        # ──────────────────────────────────────
        print("\n═══ 07. BELEGLISTE ═══")
        try:
            wait_panel(page, "belegliste")
            path = ss(page, "07_belegliste")
            content = page.evaluate("() => document.querySelector('#panel-belegliste')?.innerText?.substring(0,300) || ''")
            log("PASS", "Belegliste (GoBD) paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Belegliste paneli", str(e), ss(page, "07_belegliste_FAIL"))

        # ──────────────────────────────────────
        # 08. RECHNUNGEN
        # ──────────────────────────────────────
        print("\n═══ 08. RECHNUNGEN ═══")
        try:
            wait_panel(page, "rechnungen")
            path = ss(page, "08_rechnungen")
            content = page.evaluate("() => document.querySelector('#panel-rechnungen')?.innerText?.substring(0,300) || ''")
            log("PASS", "Rechnungen paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Rechnungen paneli", str(e), ss(page, "08_rechnungen_FAIL"))

        # ──────────────────────────────────────
        # 09. MAHNWESEN
        # ──────────────────────────────────────
        print("\n═══ 09. MAHNWESEN ═══")
        try:
            wait_panel(page, "mahnwesen")
            path = ss(page, "09_mahnwesen")
            content = page.evaluate("() => document.querySelector('#panel-mahnwesen')?.innerText?.substring(0,200) || ''")
            log("PASS", "Mahnwesen paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Mahnwesen paneli", str(e), ss(page, "09_mahnwesen_FAIL"))

        # ──────────────────────────────────────
        # 10. WARTELISTE — entry ekle
        # ──────────────────────────────────────
        print("\n═══ 10. WARTELISTE ═══")
        try:
            wait_panel(page, "warteliste")
            page.click("#wlAddBtn")
            page.wait_for_selector("#wlModal", state="visible", timeout=8000)
            time.sleep(1)

            # Hasta ara
            wl_patient_found = False
            for letter in ["a", "e", "m", "i"]:
                page.fill("#wlPatientSearch", letter)
                time.sleep(1.5)
                lis = page.query_selector_all("#wlPatientList li[data-id]")
                if lis:
                    lis[0].click()
                    wl_patient_found = True
                    break

            if wl_patient_found:
                try:
                    first_non_empty(page, "#wlService")
                except: pass
                try:
                    page.check("input.wlDay[value='Mo']")
                except: pass
                page.fill("#wlTimeFrom", "09:00")
                page.fill("#wlTimeTo", "17:00")
                path_form = ss(page, "10a_warteliste_form")
                page.click("#wlSaveBtn")
                try:
                    page.wait_for_selector("#wlModal", state="hidden", timeout=10000)
                    time.sleep(2)
                    path = ss(page, "10b_warteliste_saved")
                    log("PASS", "Warteliste — entry ekle", "Bekleme listesi girişi oluşturuldu", path)
                except:
                    toast = read_toast(page, 2000)
                    path = ss(page, "10b_warteliste_modal")
                    log("WARN", "Warteliste — entry ekle", f"Modal kapanmadı. Toast: '{toast}'", path)
            else:
                path = ss(page, "10_warteliste_no_patient")
                log("WARN", "Warteliste — entry ekle", "Hasta bulunamadı, form doldurulmadı", path)

            close_modals(page)
        except Exception as e:
            log("FAIL", "Warteliste", str(e), ss(page, "10_warteliste_FAIL"))
            close_modals(page)

        # ──────────────────────────────────────
        # 11. STATISTIK
        # ──────────────────────────────────────
        print("\n═══ 11. STATISTIK ═══")
        try:
            wait_panel(page, "statistik")
            path = ss(page, "11_statistik")
            # Chart elementleri var mı?
            chart_count = page.evaluate("() => document.querySelectorAll('canvas').length")
            has_error = page.evaluate("() => document.querySelector('#panel-statistik')?.innerText?.toLowerCase()?.includes('fehler') || false")
            log("WARN" if has_error else "PASS", "Statistik paneli",
                f"Canvas sayısı: {chart_count}" + (" — Hata metni var!" if has_error else ""), path)
        except Exception as e:
            log("FAIL", "Statistik paneli", str(e), ss(page, "11_statistik_FAIL"))

        # ──────────────────────────────────────
        # 12. SETTINGS — IK, IBAN, Praxis bilgileri
        # ──────────────────────────────────────
        print("\n═══ 12. SETTINGS ═══")
        try:
            wait_panel(page, "settings")
            path = ss(page, "12a_settings")
            # IK number mevcut mu?
            ik_visible = page.locator("#setIkNumber").is_visible()
            # Rechnungsdaten
            billing_visible = page.locator("#setBankName").is_visible()
            log("PASS" if ik_visible else "WARN", "Settings — IK alanı",
                "IK ve banka alanları görünür" if (ik_visible and billing_visible) else "Bazı alanlar eksik", path)

            # Business hours section
            try:
                hours_section = page.locator("#businessHoursSection").is_visible()
                log("PASS" if hours_section else "WARN", "Settings — çalışma saatleri",
                    "Çalışma saatleri bölümü " + ("görünür" if hours_section else "GİZLİ"))
            except: pass

            # Aerzte (doctors) section
            try:
                aerzte_section = page.locator("#aerzteSection").is_visible()
                doc_count = page.evaluate("() => document.querySelectorAll('.aerzte-row').length")
                path2 = ss(page, "12b_settings_aerzte")
                log("PASS" if aerzte_section else "WARN", "Settings — Ärzte bölümü",
                    f"Doktor bölümü görünür, {doc_count} kayıtlı doktor", path2)
            except Exception as e:
                log("WARN", "Settings — Ärzte", str(e))
        except Exception as e:
            log("FAIL", "Settings", str(e), ss(page, "12_settings_FAIL"))

        # ──────────────────────────────────────
        # 13. TEAM (Mitarbeiter)
        # ──────────────────────────────────────
        print("\n═══ 13. TEAM ═══")
        try:
            wait_panel(page, "team")
            path = ss(page, "13a_team")
            emp_count = page.evaluate("() => document.querySelectorAll('#employeeList .emp-row, #employeeList tr').length")
            log("PASS", "Team paneli", f"{emp_count} çalışan listelendi", path)

            # Plan limit testi — boş modal aç
            try:
                page.click("#teamAddBtn")
                time.sleep(1.5)
                modal_open = page.locator("#addEmployeeModal").is_visible()
                if not modal_open:
                    # Yeni sekme açıldı mı?
                    pages = ctx.pages
                    if len(pages) > 1:
                        log("WARN", "Team — çalışan ekle", f"Buton yeni sekme açtı ({len(pages)} sekme var) — modal değil")
                        pages[-1].close()
                    else:
                        log("WARN", "Team — çalışan ekle", "Buton modal açmadı")
                else:
                    path2 = ss(page, "13b_team_modal")
                    log("PASS", "Team — çalışan ekleme modal", "Modal açıldı", path2)
                    close_modals(page)
            except Exception as e:
                log("WARN", "Team — çalışan ekleme butonu", str(e))
                close_modals(page)
        except Exception as e:
            log("FAIL", "Team paneli", str(e), ss(page, "13_team_FAIL"))

        # ──────────────────────────────────────
        # 14. ANAMNESE / THERAPIEBERICHTE
        # ──────────────────────────────────────
        print("\n═══ 14. ANAMNESE ═══")
        try:
            wait_panel(page, "anamnese")
            path = ss(page, "14_anamnese")
            content = page.evaluate("() => document.querySelector('#panel-anamnese')?.innerText?.substring(0,200) || ''")
            has_error = "fehler" in content.lower() or "failed" in content.lower()
            log("WARN" if has_error else "PASS", "Anamnese paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Anamnese paneli", str(e))

        # ──────────────────────────────────────
        # 15. NOTIZEN
        # ──────────────────────────────────────
        print("\n═══ 15. NOTIZEN ═══")
        try:
            wait_panel(page, "notizen")
            path = ss(page, "15_notizen")
            content = page.evaluate("() => document.querySelector('#panel-notizen')?.innerText?.substring(0,200) || ''")
            log("PASS", "Notizen paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Notizen paneli", str(e))

        # ──────────────────────────────────────
        # 16. FAHRTENBUCH
        # ──────────────────────────────────────
        print("\n═══ 16. FAHRTENBUCH ═══")
        try:
            wait_panel(page, "fahrtenbuch")
            path = ss(page, "16_fahrtenbuch")
            content = page.evaluate("() => document.querySelector('#panel-fahrtenbuch')?.innerText?.substring(0,200) || ''")
            log("PASS", "Fahrtenbuch paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Fahrtenbuch paneli", str(e))

        # ──────────────────────────────────────
        # 17. DOCTORS (Verordnungen/Ärzte)
        # ──────────────────────────────────────
        print("\n═══ 17. DOCTORS paneli ═══")
        try:
            wait_panel(page, "doctors")
            path = ss(page, "17_doctors")
            content = page.evaluate("() => document.querySelector('#panel-doctors')?.innerText?.substring(0,300) || ''")
            log("PASS", "Doctors paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Doctors paneli", str(e))

        # ──────────────────────────────────────
        # 18. B2B
        # ──────────────────────────────────────
        print("\n═══ 18. B2B ═══")
        try:
            wait_panel(page, "b2b")
            path = ss(page, "18_b2b")
            content = page.evaluate("() => document.querySelector('#panel-b2b')?.innerText?.substring(0,300) || ''")
            has_error = "fehler" in content.lower() or "failed" in content.lower()
            log("WARN" if has_error else "PASS", "B2B paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "B2B paneli", str(e))

        # ──────────────────────────────────────
        # 19. B2C
        # ──────────────────────────────────────
        print("\n═══ 19. B2C ═══")
        try:
            wait_panel(page, "b2c")
            path = ss(page, "19_b2c")
            content = page.evaluate("() => document.querySelector('#panel-b2c')?.innerText?.substring(0,300) || ''")
            has_error = "fehler" in content.lower() or "failed" in content.lower()
            log("WARN" if has_error else "PASS", "B2C paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "B2C paneli", str(e))

        # ──────────────────────────────────────
        # 20. KI REZEPT SCAN MODAL
        # ──────────────────────────────────────
        print("\n═══ 20. KI REZEPT SCAN ═══")
        try:
            # Overview'a git, KI scan düğmesini bul
            wait_panel(page, "overview")
            time.sleep(1)

            # Rezept scan modal'ını bul (farklı trigger olabilir)
            scan_btn = page.query_selector("#rezeptScanBtn, #aiScanBtn, [data-modal='kiRezeptModal'], #kiRezeptBtn, .rezept-scan-btn")
            if scan_btn:
                scan_btn.click()
                time.sleep(2)
                path = ss(page, "20a_ki_rezept_modal")
                modal_open = page.evaluate("() => !!document.querySelector('.modal-overlay:not([hidden])')")
                log("PASS" if modal_open else "WARN", "KI Rezept Scan modal",
                    "Modal açıldı" if modal_open else "Modal açılmadı", path)
                close_modals(page)
            else:
                # Overview panelinde modal'ı JS ile aç
                modals = page.evaluate("() => Array.from(document.querySelectorAll('[id*=\"rezept\"], [id*=\"scan\"], [id*=\"ki\"]')).map(e=>e.id)")
                if modals:
                    for mid in modals:
                        if "modal" in mid.lower() or "rezept" in mid.lower():
                            try:
                                page.evaluate(f"window.openModal && window.openModal('{mid}')")
                                time.sleep(1.5)
                                path = ss(page, f"20b_ki_{mid}")
                                log("PASS", f"KI/Rezept modal ({mid})", "Modal JS ile açıldı", path)
                                close_modals(page)
                                break
                            except: pass
                else:
                    path = ss(page, "20_ki_overview")
                    log("WARN", "KI Rezept Scan", "Scan butonu veya modal bulunamadı — overview'da kontrol et", path)
        except Exception as e:
            log("WARN", "KI Rezept Scan", str(e))
            close_modals(page)

        # ──────────────────────────────────────
        # 21. REZEPT CONFIRM MODAL (§302 OCR onay)
        # ──────────────────────────────────────
        print("\n═══ 21. REZEPT CONFIRM MODAL ═══")
        try:
            page.evaluate("window.openModal && window.openModal('rezeptConfirmModal')")
            time.sleep(2)
            modal_visible = page.locator("#rezeptConfirmModal").is_visible()
            if modal_visible:
                leitsym_visible = page.locator("#rxcLeitsymptomatik").is_visible()
                path = ss(page, "21_rezept_confirm")
                log("PASS" if leitsym_visible else "WARN", "Rezept Confirm Modal",
                    "Leitsymptomatik alanı " + ("görünür" if leitsym_visible else "GİZLİ"), path)
                close_modals(page)
            else:
                log("WARN", "Rezept Confirm Modal", "Modal açılmadı (rezeptConfirmModal)")
        except Exception as e:
            log("WARN", "Rezept Confirm Modal", str(e))
            close_modals(page)

        # ──────────────────────────────────────
        # 22. BEISPIELMODUS
        # ──────────────────────────────────────
        print("\n═══ 22. BEISPIELMODUS ═══")
        try:
            wait_panel(page, "beispielmodus")
            path = ss(page, "22_beispielmodus")
            content = page.evaluate("() => document.querySelector('#panel-beispielmodus')?.innerText?.substring(0,200) || ''")
            log("PASS", "Beispielmodus paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Beispielmodus paneli", str(e))

        # ──────────────────────────────────────
        # 23. FEEDBACK
        # ──────────────────────────────────────
        print("\n═══ 23. FEEDBACK ═══")
        try:
            wait_panel(page, "feedback")
            path = ss(page, "23_feedback")
            content = page.evaluate("() => document.querySelector('#panel-feedback')?.innerText?.substring(0,200) || ''")
            log("PASS", "Feedback paneli", content[:120], path)
        except Exception as e:
            log("FAIL", "Feedback paneli", str(e))

        # ──────────────────────────────────────
        # 24. SERVICES (Leistungen) — kalender.html
        # ──────────────────────────────────────
        print("\n═══ 24. SERVICES — kalender.html ═══")
        try:
            page.goto("https://app.praxura.de/kalender.html", timeout=20000)
            page.wait_for_selector("#app", state="visible", timeout=15000)
            time.sleep(3)
            path = ss(page, "24a_kalender_services")
            content = page.evaluate("() => document.body.innerText.substring(0,300)")
            has_error = "fehler" in content.lower() or "failed" in content.lower()
            log("WARN" if has_error else "PASS", "kalender.html (Leistungen/Öffnungszeiten)", content[:120], path)

            # Leistungen tab
            try:
                leistungen_tab = page.query_selector("[data-tab='leistungen'], #leistungenTab, button:has-text('Leistungen')")
                if leistungen_tab:
                    leistungen_tab.click()
                    time.sleep(2)
                    path2 = ss(page, "24b_leistungen")
                    svc_count = page.evaluate("() => document.querySelectorAll('.service-row, .leistung-row, tr[data-id]').length")
                    log("PASS", "Leistungen tab", f"{svc_count} hizmet kayıtlı", path2)
            except Exception as e:
                log("WARN", "Leistungen tab", str(e))

        except Exception as e:
            log("FAIL", "kalender.html", str(e), ss(page, "24_kalender_FAIL"))

        # ──────────────────────────────────────
        # 25. Geri dashboard'a dön & final overview
        # ──────────────────────────────────────
        print("\n═══ 25. DASHBOARD FINAL GÖRÜNÜM ═══")
        try:
            page.goto("https://app.praxura.de/dashboard.html", timeout=20000)
            page.wait_for_selector("#app", state="visible", timeout=20000)
            time.sleep(3)
            path = ss(page, "25_final_dashboard")
            log("PASS", "Final dashboard görünümü", "Demo için son hali", path)
        except Exception as e:
            log("FAIL", "Final dashboard", str(e))

        # HTTP hata özeti
        if http_errors:
            print(f"\n⚠️  HTTP Hataları ({len(http_errors)} adet):")
            for he in http_errors[:20]:
                print(f"   {he}")

        # Browser açık bırak birkaç saniye
        time.sleep(2)
        browser.close()

    # ──────────────────────────────────────────
    # RAPOR YAZAR
    # ──────────────────────────────────────────
    report_path = os.path.join(TMP, "demo_qa_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Praxura Demo Hazırlık QA Raporu\n\n")
        f.write(f"**Tarih:** {datetime.date.today().isoformat()}  \n")
        f.write(f"**URL:** https://app.infinitymade.de  \n")
        f.write(f"**Hesap:** {EMAIL}  \n\n")
        f.write(f"## Özet\n\n")
        f.write(f"- ✅ PASS: {PASS}\n- ❌ FAIL: {FAIL}\n- ⚠️ WARN: {WARN}\n\n")
        f.write("## Senaryo Sonuçları\n\n")
        f.write("| # | Senaryo | Durum | Açıklama | Ekran görüntüsü |\n")
        f.write("|---|---------|-------|----------|------------------|\n")
        for i, r in enumerate(RESULTS, 1):
            icon = {"PASS":"✅","FAIL":"❌","WARN":"⚠️","INFO":"ℹ️"}.get(r["status"],"?")
            detail = r["detail"].replace("|","\\|")[:100]
            f.write(f"| {i} | {r['scenario']} | {icon} {r['status']} | {detail} | `{r['screenshot']}` |\n")

        if http_errors:
            f.write("\n## HTTP Hataları\n\n")
            for he in http_errors[:30]:
                f.write(f"- `{he}`\n")

        if ERRORS_GLOBAL:
            f.write("\n## Tarayıcı Hataları\n\n")
            for e in list(set(ERRORS_GLOBAL))[:20]:
                clean = e.encode('ascii','ignore').decode('ascii')
                f.write(f"- `{clean[:200]}`\n")

        f.write("\n---\n*Ekran görüntüleri: C:\\tmp\\demo_*.png*\n")

    print("\n" + "="*60)
    print(f"QA TAMAMLANDI — PASS:{PASS}  FAIL:{FAIL}  WARN:{WARN}")
    print(f"Rapor: {report_path}")
    print(f"Screenshots: C:\\tmp\\demo_*.png")
    print("="*60)

    # JSON da yaz
    json_path = os.path.join(TMP, "demo_qa_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"summary":{"pass":PASS,"fail":FAIL,"warn":WARN}, "results":RESULTS, "http_errors":http_errors[:30]}, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    run()
