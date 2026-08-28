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
└── ai-chatbot-proje/             terk edilmiş chatbot projesi (2)

> ⚠️ Bu taşıma **yarım kaldı**: yalnız belgeler (`CLAUDE.md` + `kur.md`) arşive geldi.
> Kodun kendisi hâlâ kökte: `ai chatbot proje/index.html` (92 KB). 27.08.2026'da
> `.vercelignore`'a alındı, artık praxura.de'den erişilemiyor — ama taşıma hâlâ açık.
```

**Not:** `ai-chatbot-proje/CLAUDE.md` içinde 2026-08-05'e kadar açık bir Fal AI anahtarı vardı.
Değer çalışma ağacından kaldırıldı ama **git geçmişinde duruyor** — anahtarın iptali
`TODO_MANUEL.md` §0.1'de takip ediliyor.
