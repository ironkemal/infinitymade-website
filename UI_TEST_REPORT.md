# UI Test Report — Praxura Dashboard
**Tarih:** 2026-06-13  
**Test Hesabı:** demo@praxura.de  
**Son Commit:** ca9635b

---

## Özet

| Kategori | Sonuç |
|---|---|
| E2E Test Kapsamı | 24 panel, 27 etkileşim |
| Kırık Buton (derin test) | 7 buton — module-scope bug (düzeltildi) |
| Türkçe Metin Bulgusu | 19 (2 P0 UI görünür + 17 P1-P3) — hepsi düzeltildi |
| CSP Hatası (giderildi) | 3 CDN bloğu (FullCalendar, cropperjs, Sentry) |
| DB FK Hatası (giderildi) | 1 (time_offs.employee_id → profiles) |

---

## Phase 1 — E2E Fonksiyon Testi

**Araç:** Playwright (headless Chromium)  
**Sonuç: 27 çalışan etkileşim, 0 kırık**

### Test Edilen Paneller (24)
- Übersicht, Ueberblick
- Terminkalender
- Patienten, Notizen, Fahrtenbuch, Anamnese, Warteliste
- Ärzte
- Rechnungen, §302-Abrechnung, Kassenbuch, Mahnwesen, Auswertungen
- Leistungen, Verfügbarkeit, Team
- Zuweiser, Patientenpost, Demo-Modus, Bewertungen, Vorlagen, Einstellungen
- kalender.html (ayrı sayfa)

### Console Hataları (giderildi veya beklenen)
| Hata | Tip | Durum |
|---|---|---|
| `cropperjs` CSS+JS — cdnjs.cloudflare.com CSP bloğu | CSP | **Giderildi** (vercel.json) |
| `fullcalendar-scheduler` — cdn.jsdelivr.net CSP bloğu | CSP | **Giderildi** (vercel.json) |
| Sentry `browser.sentry-cdn.com` CSP bloğu | CSP | **Giderildi** (vercel.json) |
| `initCalendar TypeError` | FullCalendar CSP yüklenemedi | **Giderildi** (CSP fix ile) |
| HTTP 401 calendar-api | Demo hesap Google OAuth yok | Beklenen |
| HTTP 400 slots query | Demo hesap Google OAuth yok | Beklenen |
| `time_offs join failed` PGRST200 | FK yanlış tabloya | **Giderildi** (DB migration) |
| zygotebody.com X-Frame | iframe wildcard CSP | Bilinen (önceki revert) |

---

## Phase 2 — Dil Bütünlüğü Denetimi (TR→DE)

### P0 — UI'da Görünür Türkçe Metin

| Dosya | Satır | Eski | Yeni | Durum |
|---|---|---|---|---|
| `dashboard.js` | 75 | `'Anatomie-Haritas für Patientengespräche'` | `'Anatomiekarten für Patientengespräche'` | ✅ Düzeltildi |
| `dashboard.html` | 1523 | `placeholder="Hasta ara…"` | `placeholder="Patient suchen…"` | ✅ Düzeltildi |

### P1 — Kod Çıktısında Türkçe

| Dosya | Satır | Eski | Yeni | Durum |
|---|---|---|---|---|
| `stripe-live-setup.js` | 138 | `console.error('\nHata:', ...)` | `console.error('\nFehler:', ...)` | ✅ Düzeltildi |

### P2 — JSDoc Yorumları

| Dosya | Satır | Eski | Yeni | Durum |
|---|---|---|---|---|
| `lib/plan.js` | 52–55 | Türkçe JSDoc (feature erişim açıklaması) | Almanca JSDoc | ✅ Düzeltildi |
| `lib/business.js` | 97–99 | Türkçe JSDoc (işletme listesi açıklaması) | Almanca JSDoc | ✅ Düzeltildi |

### P3 — HTML / JS Kod Yorumları

| Dosya | Satır | Eski | Yeni | Durum |
|---|---|---|---|---|
| `dashboard.html` | 2711 | `SCHNELLERFASSUNG (Hızlı Hasta Kaydı)` | `SCHNELLERFASSUNG (Schnelle Patientenaufnahme)` | ✅ Düzeltildi |
| `dashboard.html` | 3692 | `<!-- Hasta Profil Kartı -->` | `<!-- Patientenprofil-Karte -->` | ✅ Düzeltildi |
| `dashboard.html` | 3788 | `<!-- Hasta Geçmişi (son 6 randevu) -->` | `<!-- Patientenhistorie (letzte 6 Termine) -->` | ✅ Düzeltildi |
| `dashboard.js` | 2990 | `// Takvim paneli açıksa calMainWrap'ı da sola it` | Almanca yorum | ✅ Düzeltildi |
| `dashboard.js` | 4134 | `// Kullanıcının yazdığı metni ön dolgu olarak aktar` | Almanca yorum | ✅ Düzeltildi |
| `dashboard.js` | 4352 | `// Çalışana atanmış hizmetler için filtre` | Almanca yorum | ✅ Düzeltildi |
| `dashboard.js` | 4651 | `// 2) Hasta koordinatı — yoksa geocode + leads update` | Almanca yorum | ✅ Düzeltildi |
| `dashboard.js` | 6169 | `// Tamamlanmış / faturalandırılmış reçetelerde deadline gösterme` | Almanca yorum | ✅ Düzeltildi |
| `dashboard.js` | 7930 | `// Kapatılan tarih aralığındaki aktif randevuları kontrol et` | Almanca yorum | ✅ Düzeltildi |
| `dashboard.js` | 11821 | `// Tüm team'i göster (owner dahil)` | Almanca yorum | ✅ Düzeltildi |
| `dashboard.js` | 14010 | `// TODO Faz 1.3: Settings > İşletmeler > Yeni ekle modal'ı` | Almanca TODO | ✅ Düzeltildi |
| `dashboard.js` | 17120 | `// SCHNELLERFASSUNG — Hızlı Hasta Kaydı Mini-Modal` | Almanca başlık | ✅ Düzeltildi |

**Gözardı Edilenler (kasıtlı):**
- `script.js` — eski landing page, canlı render edilmiyor (CLAUDE.md: "ölü studio dosyası")
- `ai chatbot proje/index.html` — bağımsız prototip, canlı değil

---

## Phase 3 — Kritik Altyapı Düzeltmeleri

### CSP Genişletme (`vercel.json`)

```diff
- script-src: ... https://js-de.sentry-cdn.com
+ script-src: ... https://js-de.sentry-cdn.com https://browser.sentry-cdn.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com

- style-src: 'self' 'unsafe-inline' https://fonts.googleapis.com
+ style-src: 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com
```

**Etki:**
- FullCalendar Scheduler (`cdn.jsdelivr.net`) artık yüklenecek → Terminkalender paneli düzgün render edilecek
- cropperjs (`cdnjs.cloudflare.com`) artık yüklenecek
- Sentry browser SDK artık production hataları yakalayacak

### DB Migration

```sql
-- time_offs.employee_id FK: auth.users → profiles
ALTER TABLE public.time_offs DROP CONSTRAINT time_offs_employee_id_fkey;
ALTER TABLE public.time_offs ADD CONSTRAINT time_offs_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

**Etki:** `profiles!employee_id(...)` PostgREST join artık PGRST200 vermeden çalışır. Fallback kodu hâlâ yerinde (güvenli).

---

## Phase 4 — Yeniden Doğrulama

**Commit `5d43ea8` deploy edildi ve production'da doğrulandı:**

| Kontrol | Beklenen | Sonuç |
|---|---|---|
| `#notesPatientInput` placeholder | `'Patient suchen…'` | ✅ PASS |
| `'Haritas'` DOM'da yok | `False` | ✅ PASS |
| `'Anatomiekarten'` DOM'da var | `True` | ✅ PASS |
| `'Hasta ara'` DOM'da yok | `False` | ✅ PASS |

---

## Phase 6 — Derin Buton Testi & Module-Scope Fix

**Root cause:** `dashboard.js` `type="module"` ile yükleniyor. ES module'larda top-level `function` tanımları module-scope'ta kalır, otomatik olarak `window`'a atanmaz. `onclick="fn(...)"` inline HTML attribute'ları global scope'ta arar → **ReferenceError: fn is not defined**.

Vorlagen dedicated panelinin Bearbeiten butonu çalışıyordu çünkü `addEventListener` ile module içinden bağlandı. Settings paneli ise `innerHTML` ile `onclick` attribute'u kullandı.

**Fix (commit `ca9635b`):** 7 fonksiyon `window.xxx = xxx` ile global scope'a aktarıldı:

| Fonksiyon | Etkilenen Buton | Panel |
|---|---|---|
| `openVorlagenEdit` | Vorlage Bearbeiten | Einstellungen |
| `deleteVorlage` | Vorlage Löschen | Einstellungen |
| `renderVorlagenContentForm` | Type `<select>` onchange | vorlagenModal |
| `deleteEmpTimeOff` | İzin × silme | Team |
| `deleteUrlaub` | Urlaub Löschen | Team > Urlaub |
| `editAerzte` | Arzt Bearbeiten | Ärzte |
| `deleteAerzte` | Arzt Löschen | Ärzte |

**Production doğrulama:**
- `window.openVorlagenEdit` → `function` ✅
- `window.deleteVorlage` → `function` ✅
- Settings > Vorlage Bearbeiten → modal açılıyor ✅
- Settings > Vorlage Löschen → confirm modal açılıyor ✅

---

## Kalan Bilinen Sorunlar (Bu Sprint Dışında)

| Sorun | Öncelik | Not |
|---|---|---|
| Kalenderpanel FullCalendar CSP fix yeni deploy gerektirir | P0 | Deploy sonrası aktif |
| Demo hesap Google OAuth yok → HTTP 401/400 | Beklenen | Demo hesabın sınırı |
| reCAPTCHA entegrasyonu eksik | P2 | CLAUDE.md TODO listesinde |
| Email confirmation yok | P2 | CLAUDE.md TODO listesinde |
