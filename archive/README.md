# Arşiv — eskimiş belgeler ve kökten çekilen ağırlık

**İlk taşınma:** 2026-08-05 · 39 dosya · Silinmedi, taşındı (git geçmişi korunuyor).
**Bugün:** 573 dosya · ~271 MB · beş yeni alt klasör (09.09.2026 kök temizliği).

Bu klasördeki dosyalar **tarihsel kayıttır.** Güncel bilgi için buraya bakma — kök dizindeki
canlı dosyalara, `.claude/agents/` altındaki ajan tanımlarına veya `wissensbank/INDEX.md`'ye bak.

---

## İki tür arşiv — hangisine baktığını bil

Aynı klasörde iki farklı şey duruyor ve ikisine aynı şekilde davranmak hata olur.

| | **Tür 1 — içeriği geçersiz** | **Tür 2 — içeriği geçerli, kökte yeri yoktu** |
|---|---|---|
| Ne | Ürün altından kaydığı için artık yanlış olan belge/kod | Doğru ama ağır: yeniden üretilebilir kanıt görseli, ham medya |
| Okuyan ne alır | **Yanlış bilgi** — okuyup inanırsa zarar eder | Doğru bilgi, ama **bir tarihe ait** |
| Nerede | kök `*.md` (28) · `rapor/` · `kod/` · `lib-orphan/` · `supabase-migrations-vor-baseline/` · `ai-chatbot-proje/` · `marketing-notebooklm/` | `denetim/` · `recherche/` · `medya/` · `competitor-research-optica/` |
| Kullanma kuralı | Buradan alınan **her iddia** aksiyondan önce koda/DB'ye karşı doğrulanır | İçerik doğrudur; sorulacak tek şey "hangi tarihte çekildi, o günden beri ne değişti" |

---

## Neden arşivlendi (Tür 1, 2026-08-05 dalgası)

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
| `rapor/STRIPE_SETUP.md` | Env var **adları** — hâlâ geçerli, ama dosya Test Mode döneminde yazıldı | `CLAUDE.md` → Stripe bölümü |

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
├── *.md (28)                        kök dizinden taşınan raporlar — 05.08.2026
├── competitor-research-optica/ (4)  Optica rakip analizi, metin notları
├── marketing-notebooklm/ (5)        NotebookLM pazarlama materyalleri
├── ai-chatbot-proje/ (3)            terk edilmiş chatbot projesi — belge + kod
├── lib-orphan/ (3)                  kök `lib/`'in içeriği — 28.08.2026
├── supabase-migrations-vor-baseline/ (14)   eski `supabase/migrations/` — 04.09.2026
│
│   ── 09.09.2026 kök temizliği ──
├── kod/ (52)                        ölü SQL + ölü script
├── medya/ (49, 81 MB)               marka + video ham materyali
├── rapor/ (5)                       eskimiş kök raporları
├── denetim/ (291, 159 MB)           UI/mobil denetim kanıt görselleri
└── recherche/ (118, 30 MB)          rakip ekran arşivi
```

> ℹ️ `funktionen-shots/raw/` **buraya gelmedi** — `assets/img/fn/_raw/` altına taşındı,
> çünkü arşivlik değil: `assets/img/fn/`'deki canlı `.webp`'lerin ham kaynağı
> (`index.html:1485` onları yüklüyor). Arşivde arama.

---

## 09.09.2026 kök temizliği — beş yeni alt klasör

Kök dizinde 15 yıl önce bırakılmış gibi duran ne varsa tek günde sınıflandırıldı.
Ölçüt her seferinde aynıydı: **çalışma zamanında bu dosyayı okuyan var mı?** Yoksa
kökte durması için sebep yok. Her taşımada atıflar da yönlendirildi.

### `kod/` — ölü SQL ve ölü script (52 dosya · commit `4f282f7`)

- **Ne:** 39 kök `database_v*.sql` + 9 ölü `.py` + `script.js` · `chatbot.js` ·
  `_fix_encoding2.cjs` · `stripe-live-setup.js`.
- **Niye:** SQL numaraları çakışıyordu (v28/v29/v31 ikişer kez, v13/v14 hiç yok), canlı
  veritabanında **195 migration** kayıtlı ve çalışma zamanında bu dosyaların **hiçbiri**
  okunmuyordu. `db-ustasi` + `fonksiyon-ustasi` ikisi birden doğruladı.
- **Gerçek şema nerede:** `db/SCHEMA.sql` + `db/SCHEMA-RLS.sql`. Bir kolonun ne zaman
  eklendiği sorusu `db/REGISTER.md` ve `fortschritte/` üzerinden cevaplanır.
- ⚠️ **`stripe-live-setup.cjs` kökte KALDI** — canlı ürün/fiyat script'i odur. Buradaki
  `.js` ikizi `package.json`'daki `"type": "module"` yüzünden zaten hiç çalışmıyordu
  (`require is not defined`). İkisi tek kelime farkla aynıydı; karışıklık bu yüzden bitti.

### `medya/` — marka ve video ham materyali (49 dosya · 81 MB · commit `29d9395`)

- **Ne:** `Logo/` · `web foto/` · `app ss/` · `demo rezept/` · `voice demo/` · `demo slayt/`.
- **Niye:** hiçbiri web asset'i değil, hiçbiri runtime'da yüklenmiyor. Tam metin aramada
  **sıfır kod referansı** çıktı (`wissensbank` ile karşılıklı doğrulandı).
- **Tek istisna:** `dashboard-vorschau.html` iki ikon path'i `Logo/`'ya bakıyordu, taşımada
  güncellendi — ama o sayfa `.vercelignore`'daki eski `Logo/` kuralı yüzünden prod'da zaten
  404 alıyordu; taşıma bunu değiştirmedi.
- **Canlı görseller karıştırılmasın:** `assets/img/` · `fonts/` · `images/` dokunulmadı.

### `rapor/` — eskimiş kök raporları (5 dosya · commit `29d9395`)

- **Ne:** `SEO_AKTIONSPLAN.md` · `KONTRAST_AUDIT.md` · `DUPLICATION_AUDIT.md` ·
  `ITSG_EMAIL_DRAFT.md` · `STRIPE_SETUP.md`.
- **Niye:** hepsi bir kerelik durum raporu; ya uygulandı ya konu değişti. Kökte kalanlar
  **açık plan** oldukları için kaldı (`ONPREM_MIGRATION_PLAYBOOK` · `TYPECHECK` ·
  `REBRANDING_GUARDRAILS` · `ARBEITSZEITEN_PRO_STANDORT` · `LEGAL_ONPREM_REQUIREMENTS` ·
  `UMAMI_SETUP`).
- ⚠️ `STRIPE_SETUP.md` tamamen ölü değil: **env var adları hâlâ geçerli.** Geçersiz olan,
  dosyanın Test Mode döneminde yazılmış olması.
- ⚠️ Buna atıf veren yerler kök yolunu kullanıyor olabilir — `archive/rapor/` önekiyle ara.

### `denetim/` — UI ve mobil denetim kanıtları (291 dosya · 159 MB · commit `56e8d95`)

- **Ne:** `ui-audit/` (235) + `mobile-audit/` (56) — responsive/mobil denetimin
  before/after ekran görüntüleri.
- **Niye:** ~159 MB, web asset'i değil, **yeniden üretilebilir**. Üreticileri taşımayla
  birlikte yeni yola çekildi: `ui_audit_shots.py` · `capture_mobile.py` · `capture_mobile2.py`.
- ⚠️ **`mobile-audit/` sadece kanıt değil, canlı bir iş akışının parçası:** `mobil-ui`
  ajanı protokol gereği buraya before/after çekiyor. `.claude/agents/mobil-ui.md` yeni
  yola güncellendi — yani klasör arşivde ama **ölü değil**.
- **Silinmedi çünkü:** bir düzeltmenin gerçekten işe yaradığının kanıtı before/after çiftidir;
  yeniden üretmek "before"u geri getirmez.

### `recherche/` — rakip ekran arşivi (118 dosya · 30 MB · commit `3a3a0ce`)

- **Ne:** eski kök `competitor-research/` — ağırlıklı olarak Optica ekran görüntüleri.
- **Niye:** `archive/competitor-research-optica/` altındaki metin notlarının **görsel eki**;
  ikisi ayrı yerlerde durduğu sürece not okunurken ekran bulunamıyordu.
- ⚠️ **Taşınması riskli sanılıyordu** ("TAŞIMA, 40+ link kırılır" diye işaretliydi).
  Gerçekte o 36 atıf **mutlak `file://C:\Users\Test\…` yolu** — başka bir makinenin
  kullanıcı adıyla yazılmışlar, bu makinede zaten hiç açılmıyorlardı. Yine de tutarlılık
  için hepsi yeni yola çekildi; **çalışır hâle gelmediler**, kullanıcı adı sorunu ayrı.
- **Yan etki:** `tools/tabellenkarte.mjs` içindeki `SKIP_DIRS` listesi de temizlendi.

---

## `ai-chatbot-proje/` — terk edilmiş chatbot (3 dosya, taşıma 09.09.2026'da tamamlandı)

`CLAUDE.md` · `kur.md` · `index.html`. Belge kısmı 2026-08-05'te gelmişti, **kod kısmı
kökte kalmıştı** (`ai chatbot proje/index.html`, 92 KB) — 09.09.2026'da o da buraya
taşındı, taşıma artık **kapalı**.

**Not:** `ai-chatbot-proje/CLAUDE.md` içinde 2026-08-05'e kadar açık bir Fal AI anahtarı vardı.
Değer çalışma ağacından kaldırıldı ama **git geçmişinde duruyor** — anahtarın iptali
`guvenlik/REGISTER.md` → **S-08** altında takip ediliyor (eski takip yeri `TODO_MANUEL.md`
artık yok). Aynı madde altında git geçmişindeki n8n API anahtarı da duruyor.

---

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
