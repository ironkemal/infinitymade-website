# Arşiv — eskimiş rapor ve plan dosyaları

**Taşınma tarihi:** 2026-08-05 · **39 dosya** · Silinmedi, taşındı (git geçmişi korunuyor).

Bu klasördeki dosyalar **tarihsel kayıttır.** Güncel bilgi için buraya bakma — kök dizindeki
canlı dosyalara, `.claude/agents/` altındaki ajan tanımlarına veya `Handbücher/INDEX.md`'ye bak.

---

## Neden arşivlendi

Bu dosyalar "eski" oldukları için değil, **ürün altlarından kaydığı** için geçersiz. 2026-08-05
denetiminde 42 dosyanın neredeyse tamamının şu **altı ürün kararından** birine takıldığı görüldü:

1. **InfinityMade → Praxura** rebrand (ürün adı, domain, marka metni)
2. **Praxis-only daralma** — berber/güzellik sektörleri kapsam dışına çıkarıldı
3. **Public booking kaldırıldı** (2026-06-11) — hasta self-servis rezervasyon üründen çıktı
4. **WhatsApp/Twilio raflandı** (2026-05-20) — AI resepsiyonist odaktan çıktı
5. **Cal.com çıkarıldı** — yerine kendi calendar-api
6. **Stripe LIVE'a geçti** (2026-06-11) + DTA-Pro add-on'u kaldırılıp Professional planına dahil edildi

**Eski bir dosya okurken önce bu altısına karşı kontrol et.** İçeriğin bunlardan biriyle
çelişiyorsa dosya değil ürün haklıdır.

---

## İçinden kurtarılan kalıcı bilgi nereye gitti

Arşivlemeden önce koddan/git'ten çıkarılamayacak bilgiler ilgili yerlere taşındı:

| Kaynak | Kurtarılan bilgi | Nereye |
|---|---|---|
| `BILLING_A2_PLAN.md` | DTA segment zinciri (SLGA/SLLA/SLEZ/SLAU/SLEK); Dakota `.p12` özel anahtarı sunucuya gönderilmez kararı | `.claude/agents/gkv-302.md` |
| `competitor-research-optica/03-billing-compliance-deep.md` | K/T/F mazeret kodları, Zuzahlung %10+10 €, HMR 28/14 gün | `.claude/agents/gkv-302.md` |
| `DEGISIKLIK_REHBERI_2026-06-01.md` | Prod crash-loop kök sebebi: `SUPABASE_SERVICE_KEY` değil **`SUPABASE_SERVICE_ROLE_KEY`** | `.claude/agents/builder.md` |
| `UI_TEST_REPORT.md` | ES-module kapsamı: inline `onclick` için `window.fn = fn` gerekir | `.claude/agents/builder.md` |
| `SECURITY_AUDIT_2026-06-03.md` | Bulgularının çoğu çürütüldü (bkz. aşağıdaki uyarı) | hafıza |
| `infinitymade*.md` | Fiyat setleri — **hepsi geçersiz.** Geçerli set: 29/49/99 €/ay | `CLAUDE.md` |
| `Fahrtenbuch.md` | ORS entegrasyonu, 10 dk buffer formülü, durum makinesi | (özellik canlı — koda bak) |

---

## ⚠️ Bu arşivi kullanırken

**Buradaki audit/güvenlik bulguları *iddiadır*, gerçek değil.** 2026-08-05'te
`SECURITY_AUDIT_2026-06-03.md`'nin iki bulgusu Supabase'den doğrulandı ve **ikisi de çürüdü**
(`pending_signups` düz-metin şifre → aslında Vault referansı; RLS eksik → aslında açık;
`add_credits`/`admin_*` anon RPC → öyle fonksiyon yok).

Buradan bir "açık iş" alıp aksiyona geçmeden **önce koda/DB'ye karşı doğrula.**

---

## Klasör yapısı

```
archive/
├── *.md                          kök dizinden taşınan 28 dosya
├── competitor-research-optica/   Optica rakip analizi derinlemesine notları (4)
├── marketing-notebooklm/         NotebookLM pazarlama materyalleri (5)
├── ai-chatbot-proje/             terk edilmiş chatbot projesi (2)
└── lib-orphan/                   kök `lib/`'in içeriği (3) — 28.08.2026

> ⚠️ Bu taşıma **yarım kaldı**: yalnız belgeler (`CLAUDE.md` + `kur.md`) arşive geldi.
> Kodun kendisi hâlâ kökte: `ai chatbot proje/index.html` (92 KB). 27.08.2026'da
> `.vercelignore`'a alındı, artık praxura.de'den erişilemiyor — ama taşıma hâlâ açık.
```

**Not:** `ai-chatbot-proje/CLAUDE.md` içinde 2026-08-05'e kadar açık bir Fal AI anahtarı vardı.
Değer çalışma ağacından kaldırıldı ama **git geçmişinde duruyor** — anahtarın iptali
`TODO_MANUEL.md` §0.1'de takip ediliyor.


## `lib-orphan/` — kök `lib/` klasörü (28.08.2026)

`business.js` · `plan.js` · `supabase.js`. Buraya taşındılar çünkü **hiçbir yerden
import edilmiyorlardı** — sadece birbirlerini çağırıyorlardı. `admin.js` dahil
kontrol edildi (o yalnız `vendor/supabase-js.js`, `supabase-config.js` ve
`nav-registry.js` yüklüyor).

Neden sadece "kullanılmıyor" değil, **taşınması gerekiyordu:**

- `supabase.js` kendi başlığında *"Single source of truth for Supabase connections"*
  diyordu. Değildi — gerçek istemci `supabase-config.js` + `vendor/supabase-js.js`.
  Okuyan yanlış yola sapıyordu.
- Fonksiyon haritasına **20 hayalet fonksiyon** katıyordu (`getSupabaseAdmin`,
  `getOwnerId`, `hasFeature`, `getPatientDetails`, `withBusinessFilter` …). "Böyle bir
  şey zaten var mı?" sorusu ölü koda işaret edebiliyordu.
- `plan.js` **eskimiş iş kuralı** taşıyordu: §302'yi yalnız `klinik` + `enterprise`
  paketlerine veriyordu, oysa §302 artık **Professional**'a dahil; ayrıca 08.06.2026'da
  kaldırılan DTA-Pro'dan bahsediyordu. Bağlansaydı Professional müşterilerinin §302'si
  sessizce kapanırdı.
- Depo public: dosya 27.08.2026'ya kadar `praxura.de/lib/supabase.js` adresinden
  indirilebiliyordu.

⚠️ **`api-backend/lib/` ile karıştırma** — o canlı ve dokunulmadı
(`phi-encrypt.js`, `arzt-registry.js`, `geschlecht.js`).

**Buradan ne kurtarılabilir:** Konsey 2026-08-13 "veri katmanı" (S5) kararını
ertelemişti ve aynı tutanağın kör noktalar bölümünde *"`lib/supabase.js` ölü — veri
katmanı bir kez yazılıp terk edilmiş, S5'te üçüncü kopya yazılmaz"* yazıyor. S5
geldiğinde bu dosyalar **örnek** olarak okunabilir, ama **kopyalanamaz**: `.single()`
kullanımı ev kuralına aykırı, `TABLES` haritası DROP edilmiş tablolara atıf yapıyor,
ve `supabase` proxy nesnesi hata durumunda sessizce `{data:null}` dönüyor.

**⚠️ Düzeltme (28.08.2026, aynı gün):** Bu bölümde önce "paket bazlı özellik kilidi
hiç yok, her müşteri her özelliği görüyor" yazıyordu. **Yanlıştı.** Arama kalıbım
(`plan === 'starter'` gibi doğrudan karşılaştırmalar) `Set.has()` ve
`Array.includes()` biçimlerini kaçırdı. Kilit çalışıyor, beş yerde:

| Nerede | Ne yapıyor |
|---|---|
| `has302Access()` `dashboard.js:844` | `['professional','klinik','enterprise'].includes(plan)` → §302 Abrechnung modülünü Starter'da sidebar'dan gizler (`:983`, gerekçe `'plan'`) |
| `isEnterprise()` `dashboard.js:17281` | Çok-Standort anahtarı; `:17678` "Mehrere Standorte sind nur im Enterprise-Paket verfügbar." |
| `checkPlanActive()` `dashboard.js:4570` | `canceled`/`expired` durumunda yeni randevu, hasta ve abrechnung'u durdurur |
| `showPlanWall()` `dashboard.js:22235` | Tam ekran paket duvarı (29/49/99) |
| `PLAN_EMPLOYEE_LIMITS` `dashboard.js:66` → `:14574` | "Plan-Limit erreicht: max. N Mitarbeiter" |

Kaybolan bir şey **yok**. `lib/plan.js`'teki `hasFeature()`/`isPlanActive()` ise
doğuştan öksüz: 22.05.2026'da (`9bc0afb`) yazıldı ve **hiçbir commit'te hiçbir
yerden import edilmedi**. Yani ikinci, hiç açılmamış bir kapı taşıyordu — üstelik
§302'yi yalnız `klinik`+`enterprise`'a veren **eskimiş** kuralla. Çalışan kapı
(`has302Access`) §302'yi doğru biçimde Professional'dan itibaren açıyor. İkisi
bağlansaydı çelişirlerdi; arşivlenmesi bu yüzden ayrıca doğru oldu.

`PLAN_FEATURES` (`dashboard.js:664` → tek kullanım `:12656`) gerçekten kilit değil,
sadece "paketiniz şunları içerir" metin listesi — o kısım doğruydu.

---

## `supabase-migrations-vor-baseline/` (14 dosya, taşındı 04.09.2026)

Eskiden `supabase/migrations/`. **Silinmedi, taşındı** — tarih olarak duruyor.

**Niye taşındı:** bu klasör hiçbir zaman şemanın kaynağı olmadı ve olduğu sanılıyordu.
İçinde 14 dosya vardı, canlı veritabanında ise **227** migration kayıtlıydı; 14'ün
yalnız **3'ü** canlıdaki kayıtla birebir eşleşiyordu. Yani buraya bakan biri şemanın
ne olduğu konusunda yanlış bilgi alıyordu.

04.09.2026'da şema dağıtımı için **baseline** kararı alındı: zincir bugünden başlıyor,
geçmiş migration'lar tarih sayılıyor. Yeni ve tek geçerli zincir
`api-backend/db/migrations/` altında. İki dizin bırakmak "iki gerçek" demek olurdu —
bu hata bu depoda bir kez yapıldı (`onprem/schema/` iki ay bayat kaldı ve otorite
sanıldı), tekrarlanmadı.

**Buradan bir şey kurtarılabilir mi:** hayır, aksiyon için değil. Bir kolonun ne zaman
eklendiği sorusu artık `db/REGISTER.md` ve `fortschritte/` üzerinden cevaplanıyor.

Karar ve gerekçesi: `onprem/SCHEMA-VERTEILUNG.md` §5 ve §11.
