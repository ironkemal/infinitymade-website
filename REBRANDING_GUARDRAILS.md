# 🎯 Rebranding Guardrails — InfinityMade → Praxura

> Bu repo'da kapsamlı marka değişikliği yapacak ajan(lar) için ZORUNLU okuma.
> 2026-06-02 domain migration sonrası hazırlandı. Kör find-replace = canlı sistem kırılır.

---

## Model (özet)

- **infinitymade.de** = sadece **vitrin / şirket sayfası**. AYRI repo: `github.com/ironkemal/infinitymade-company`. Bu repo DEĞİL. Buraya dokunma.
- **praxura.de** = **ürün** marketing landing (bu repo).
- **app.praxura.de** = uygulama (login/dashboard/onboarding/booking/kalender — bu repo).
- **admin.praxura.de** = admin paneli (bu repo).
- **n8n.infinitymade.de** = **BACKEND** (VPS, calendar-api + n8n). Kullanıcı görmez. **YERİNDE KALIYOR.**

## 🥇 ALTIN KURAL: Şirket ≠ Ürün

- **Şirket / tüzel kişi = "InfinityMade"** → Einzelunternehmen, Yavuz Kemal Demir, Siegburg/NRW. Kleine Gewerbe, sahibinin adına. **DEĞİŞMEZ.**
- **Ürün = "Praxura"** → praxis yazılımı.
- Doğru ifade: *"Praxura — ein Produkt der InfinityMade."*
- Legal evrak (impressum/agb/datenschutz/dpa/widerruf): **işleten = InfinityMade KALIR**, ürün adı geçen yerler → Praxura. (Bu dosyalar zaten büyük ölçüde doğru yapılandırılmış — InfinityMade=Auftragsverarbeiter/Anbieter, Praxura=Produkt.)

---

## ⛔ ASLA DEĞİŞTİRME (kör sweep tuzakları)

1. **`n8n.infinitymade.de` backend URL'leri** (~15 yer: dashboard.js, booking.js, kalender.js, employee-signup.js, server.js). Bunlar CANLI API endpoint'leri. `infinitymade.de`→`praxura.de` genel replace yaparsan **tüm booking/slot/OAuth/AI çağrıları patlar.** Backend taşınmadı.

2. **`storageKey: 'infinitymade-auth'`** (lib/supabase.js + sentry-init.js okur + admin izolasyonu). Origin-scoped, kullanıcı görmez. Adını değiştirirsen herkes logout olur + Sentry user attach kırılır. **BIRAK.** (admin: `sb-admin-auth` — o da kalsın.)

3. **E-posta adresleri:** praxura.de'de SADECE `info@` ve `support@` alias'ları var.
   - `support@praxura.de` → ürün support sayfasında zaten yapıldı. ✓
   - `kontakt@infinitymade.de`, `datenschutz@infinitymade.de` → bu alias'lar praxura'da YOK + legal/şirket iletişimi → **@infinitymade.de KALIR.**
   - Yeni bir adrese işaret etmeden önce alias'ın gerçekten var olduğundan emin ol.

4. **`server.js` OAuth callback'leri** → zaten `app.praxura.de/dashboard.html` (canlı, doğrulandı). Geri alma.
   - ⚠️ `api-backend/**` değişikliği main'e push edilince **GitHub Actions + Watchtower otomatik VPS'e deploy eder** (~4 dk). Test etmeden push etme.

5. **`vercel.json`** host-routing kuralları (praxura + infinitymade subdomain'leri). Bozma.

6. **Footer "© 2026 InfinityMade · Made in NRW"** ve "Siegburg, NRW" → şirket. **KALIR.**

---

## 🔁 DEĞİŞTİR (ürün markası)

- App sayfa başlıkları, `manifest.json`, onboarding "Willkommen bei …", dashboard ürün metinleri → **Praxura** (çoğu app-facing zaten yapıldı, commit geçmişine bak: `rebrand(product)…`).
- `dashboard.js` i18n sözlüğü: marka stringleri **de/en/tr ÜÇÜNDE de** güncellenmeli (HTML'deki `data-i18n` JS sözlüğü tarafından ezilir).

---

## 📝 index.html / blog/ / praxis.html = YENİDEN YAZ (swap değil)

Bu sayfalar **eski InfinityMade studio** içeriği: "KI-Agents & Automatisierung", Handwerk, Steuerkanzlei, WhatsApp-Bot. Bu vizyon **terk edildi.**
- Bunlarda `InfinityMade`→`Praxura` yapma — yanlış iddialar çıkar.
- Praxura **praxis-only**: Physio / Logopädie / Ergo / Podologie. Berber/güzellik YOK.
- **WhatsApp / AI-Rezeptionist RAFA KALDIRILDI** — bu özellik metinlerini taşıma, sil.
- praxura.de landing'i sıfırdan Praxura odaklı yeniden kurgula.

---

## ✅ Zaten yapıldı (tekrar etme / çakışma yaratma)

App başlıkları (login/booking/onboarding/employee-signup/support/demo), manifest PWA adı, onboarding welcome, çalışan davet metni, `support@praxura.de`. Bkz commit `rebrand(product): InfinityMade -> Praxura …`.

---

*Son güncelleme: 2026-06-02 — domain migration + kısmi rebrand sonrası.*
