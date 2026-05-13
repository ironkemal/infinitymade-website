# Yapılamayanlar / Takip Listesi

## 1. Anamnese PDF Yazdırma
**Durum:** Çalışmıyor
**Sorun:** "Anamnese als PDF" butonuna basınca aynı sayfayı `window.print()` ile yazdırıyor. Bu nedenle sidebar, rechnungen paneli, anamnese formu hepsi karışık bir şekilde çıkıyor. Hasta seçili değil gibi görünüyor.
**Yapılan:** `printAnamnese()` fonksiyonu `dashboard.js`'e eklendi (yeni sekme açıp temiz tablo gösteriyor). Ama kullanıcı yine de eski bozuk görüntü alıyor.
**Muhtemel sebep:**
- Browser cache eski `dashboard.js`'yi yüklüyor (Ctrl+F5 çözmeli)
- Veya `printAnamnese` fonksiyonu sonradan yapılan kullanıcı değişiklikleriyle çakışıp kaybolmuş olabilir

**Not:** `dashboard.js` içinde `bindAnamneseEvents` fonksiyonunda `pdfBtn.onclick = printAnamnese` olmalı, `() => window.print()` olmamalı.

---

## 2. Anamnese RLS (ÇÖZÜLDÜ)
**Durum:** Çözüldü
**Sorun:** Employee hesabıyla anamnese kaydederken "new row violates row-level security policy" hatası geliyordu.
**Çözüm:** Supabase'de `anamnese` tablosunun RLS politikaları `leads` tablosundaki gibi owner + employee olarak güncellendi.

---

## 3. Dashboard Redesign (BEKLEMEDE)
**Durum:** Henüz başlanmadı
**Plan:** `DASHBOARD_REDESIGN_PLAN.md` içinde detaylı anlatılmış. Sırasıyla: CSS → HTML → JS → Supabase SQL → Test

---

## 4. Diğer Kullanıcı Değişiklikleri (2026-05-13)
Kullanıcı `dashboard.js` içinde kendi başına şunları yaptı:
- Leads listesinde doğum tarihi gösterme (`displayNameWithBirth`)
- `created_by` / `updated_by` alanları ekleme
- `aerzte` tablosunda `name` → `arzt_name` düzeltmesi
- Rechnungen'den patient detail modal'a tıklama
- Lead kaydetmeden sonra booking modal'a dönüş
- Notizen panelinde doğum tarihi

Bu değişiklikler commit edilmedi. `dashboard.js`'yi düzenlerken dikkatli olun, birbiri üzerine yazma riski yüksek.
