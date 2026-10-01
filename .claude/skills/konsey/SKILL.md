---
name: konsey
description: Karar öncesi danışma kurulu. "Şunu şöyle mi yapsam böyle mi", "bu iyileştirmeyi nasıl yapalım", "A mı B mi" tipi kararlarda ilgili uzman ajanları paralel toplar, kör noktaları çıkarır ve tek bir uygulanabilir KARAR üretir. Kararı builder uygular. Olgusal sorular, önemsiz seçimler ve onay arayışı için KULLANILMAZ.
---

# Konsey

Karar **öncesi** toplanan danışma kurulu. Çıktısı bir görüş yığını değil, **builder'ın alıp
uygulayabileceği tek bir karardır.**

---

## Ne zaman toplanır / toplanmaz

**Topla:**
- Gerçek belirsizlik var ve iki makul yol arasında seçim yapılacak
- Karar geri alınması pahalı (migration, şema, fiyat, müşteriye verilen söz)
- Birden fazla alan kesişiyor (hukuk + faturalandırma + kullanım)
- Katman 1 veya Katman 4'e dokunuluyor (`services`, `profiles`, para/§302)

**Toplama:**
- Olgusal soru — cevabı tek ve bilinebilir ("hangi sürüm geçerli", "bu dosya nerede")
- Önemsiz seçim — geri alması ucuz, tek doğrusu var
- Onay arayışı — kararını vermişsin, sadece "evet" duymak istiyorsun. Konsey bunun için değil.
- Salt uygulama — ne yapılacağı belli, sadece yapılması lazım → doğrudan `builder`

Şüphedeysen: **kararı geri almak ucuz mu?** Ucuzsa toplama, yap ve gör.

---

## Aşama 0 — Çerçeveleme ve koltuk seçimi

**a) Soruyu tarafsızlaştır.** Kullanıcının sorusu genelde taraflıdır ("şunu şöyle yapsak daha
iyi olmaz mı"). Konseye giden metin şöyle olmalı:

```
SORU: <tarafsız, seçenekler eşit ağırlıkta>
BAĞLAM: <hangi ekran/tablo/modül, mevcut davranış>
SEÇENEKLER: A) … B) … (varsa C)
NEDEN ŞİMDİ: <tetikleyen şey>
GERİ DÖNÜŞ: <yanlışsa maliyeti>
```

Bu blok kısa olmalı (≤200 kelime) — her üyeye aynen bu gider, konuşmanın tamamı değil.

**a2) On-prem kontrolü — her karara uygulanır.**

Praxura **SaaS'tan on-premise'e geçiyor**: veri müşterinin kendi sunucusunda duracak, biz hasta
verisine hiç dokunmayacağız. Sebep: §393 SGB V / BSI C5 yükümlülüğünden (€15–200k) kapsam dışına
çıkmak, Auftragsverarbeiter sorumluluğundan kurtulmak, maliyeti düşürmek.

Çerçeveleme bloğuna **her zaman** şu satırı ekle:

```
ON-PREM ETKİSİ: <bu karar hasta verisini bizim tarafımızdan geçiriyor mu? evet/hayır/belirsiz>
```

Cevap "evet" veya "belirsiz" ise `legal-de` **mutlaka oturur.**

Bu satırı chairman tahminle doldurmaz: **`onprem` ajanı** bu işin uzmanıdır ve sicili
(`onprem/REGISTER.md`) tutar. Kararın dağıtım sonucu varsa (dış çağrı, şema, env var,
zamanlanmış iş, sabit adres, yetki kontrolü) o oturur ve satırı o yazar.

Üç kilitli kısıt:
- **G8** — yeni Vercel serverless fonksiyonu, yeni CDN script'i, yeni n8n workflow'u, yeni bulut
  bağımlılığı **yok**
- **K6** — merkezi AI-proxy yok: reçete görüntüsü bizden geçerse Auftragsverarbeiter + §393
  kapsamına geri gireriz
- **K10** — veriye erişimli uzak destek yok: tanılama paketi + ekran paylaşımı, veri erişimi yok

Detay: `ONPREM_MIGRATION_PLAYBOOK.md`

**b) Koltukları seç.** Herkes her seferinde oturmaz.

| Konu | Oturur |
|---|---|
| **Daimî üyeler** (konu ne olursa olsun) | `muhalif`, `deger-mi`, `fonksiyon-ustasi` |
| Hasta verisi, dış servis, kamuya giden metin, çerez/izleme, sözleşme/fiyat | `legal-de` |
| Para, §302, Abrechnung, pozisyon numarası, Rezept doğrulama, katalog | `gkv-302` |
| Podoloji ekranı/akışı/formu | `podoloji` |
| Yeni ekran/düzen, tablo, çok sütunlu görünüm, form — telefonda da kullanılacaksa | `mobil-ui` |
| Dış servis çağrısı, şema değişikliği, yeni env var, zamanlanmış iş, koda gömülen sabit adres, plan/yetki kontrolü | `onprem` |
| Karar dış kaynaklı resmî veriye dayanıyor (fiyat, katalog, kod listesi, IK, ICD) · yeni belge indirme · sürüm geçişi zamanlaması | `wissensbank` |
| (ileride) Physio / Logo / Ergo alanı | ilgili alan ajanı |
| Katman 1 (`services`, `profiles`, çalışma saatleri) | **hepsi** |

Alan ajanları **dönüşümlüdür** — podoloji konusunda fizyoterapi ajanı oturmaz.
Emin değilsen oturt: eksik görüş, fazla görüşten pahalıdır.

`fonksiyon-ustasi` daimîdir ama **fikir vermez** — olgu getirir: "bu zaten var, şurada",
"bunu değiştirirsen şu üç yer etkilenir", "bu iki ekran aynı tabloya ayrı kuralla yazıyor".
Konseyin en pahalı hatası, var olanı görmeden yeni bir şey icat etmektir; onu bu üye kapatır.
Görüşü **veto değildir**, ama "zaten var" bilgisi bir tasarım tartışmasını çoğu zaman bitirir.

**c) Dışarıdan göz (opsiyonel ama önerilir).** Proje bağlamı olmayan farklı bir model.
Bedava — `agy` bütçesinden çıkar, bu konuşmanın token'ını harcamaz:

```bash
agy -p "$(cat C:/tmp/agy-tasks/konsey-outsider.md)" \
    --model gemini-3.1-pro-high --output-format json --print-timeout 10m
```

Prompt'a **sadece tarafsız çerçeveleme bloğu** konur — proje dosyası, geçmiş karar, mimari
bilgi verilmez. Değeri tam olarak bilmemesinden gelir: *"Bu soruyu ilk kez duyan biri olarak
neyi tuhaf buluyorsun, hangi varsayım sorgulanmamış görünüyor?"*

---

## Aşama 1 — Paralel görüşler

Seçilen ajanların **hepsini tek mesajda, paralel** çağır. Her birine giden brifing:

```
<tarafsızlaştırılmış çerçeveleme bloğu>

Konsey turundasın. Kendi alanından görüş ver.
- En fazla 300 kelime
- Tek tur: diğer üyelere cevap yazma
- Kendi ajan tanımındaki konsey formatını kullan
- İlgin yoksa "ilgisiz" de, geç
- Kod yazma, tasarım dayatma
```

**Yapıcılık zorunluluğu — hepsi için geçerli:** hiçbir üye çıkmaz sokak bırakamaz. "Olmaz"
diyen, **ne olur** onu da söyler. Kural sert diyorsa kuralın etrafından dolaşan meşru yolu
arar: kapsamı daraltmak, yükümlülüğü hiç doğurmamak, manuel adımla değiştirmek, %20'lik
sürümle başlamak. Alternatifsiz itiraz geçersiz çıktıdır.

---

## Aşama 2 — Kör nokta turu (ŞARTLI)

**Sadece şu iki durumda çalıştır:**
- İki veya daha fazla üye birbiriyle çelişiyor
- Bir üye ⛔ verdi

Aksi halde **atla ve doğrudan sentezle** — bu tur maliyeti ikiye katlar, uyum varsa gereksizdir.

Çalıştırılacaksa: tüm görüşler tek blokta, sadece çelişen üyelere geri gönderilir.

```
Diğer üyelerin görüşleri aşağıda. TEK SORU:
"Senin kaçırdığın, ama başka birinin yakaladığı bir şey var mı?"
- En fazla 100 kelime
- Görüşünü savunma, tartışma açma
- Sadece: fikrini değiştirdin mi, değiştiysen neden
```

---

## Aşama 3 — Chairman sentezi ve KARAR

Sentezi **ana bağlam yapar** (yeni bir ajan açma — gereksiz katman, gereksiz token).

**Oy ağırlıkları eşit değil:**

| Üye | ⛔ ağırlığı |
|---|---|
| `legal-de` | 🔒 **SERT VETO** — hukuki risk pazarlık konusu değil. Aşılamaz; ancak alternatif yolla çözülür. |
| `gkv-302` | 🔒 **SERT VETO** — para gelmiyorsa özellik yok. Aşılamaz. |
| `onprem` | 🔒 **SERT VETO — yalnız dört korkulukta:** G1 (hasta verisi bize akmaz) · G2 (sır image'a gömülmez) · G3 (n8n pakete girmez) · G8 (buluta yeni zincir yok). Dışında ⚠️ güçlü sinyal, aşılabilir. |
| `wissensbank` | ⚠️ güçlü sinyal — vetosu yok. Ama "bu veri hangi belgeden, hangi sürüm, ne zaman düşüyor" cevapsızsa karar **eksik bilgiyle** alınıyor demektir |
| alan ajanı (`podoloji` vb.) | ⚠️ güçlü sinyal — kullanıcı bilinçli olarak aşabilir |
| `muhalif`, `deger-mi` | ⚠️ güçlü sinyal — aşılabilir |
| dışarıdan göz | 💡 girdi — oy değil |

Chairman **çoğunluğa karşı karar verebilir**, ama gerekçesini yazmak zorundadır. Sert veto
istisnadır: aşılamaz, etrafından dolaşılır.

**Kapsam kayması freni:** Konsey **sorulan soruyu** cevaplar. Üyelerin ürettiği ekstra iyi
fikirler karara karışmaz — ayrı bir "Backlog" satırına düşer. `TODO.md` §1 (Beta-Roadmap)'nin
tek amacı "gözüme çarptı, onu da yapalım" döngüsünü kesmektir; konsey bunu **artırmamalıdır.**

### Çıktı

```markdown
# Konsey Kararı — <konu>
Tarih: <YYYY-MM-DD> · Oturan üyeler: <liste>

## KARAR
<Tek paragraf. Ne yapılacak, ne yapılmayacak. Builder'ın doğrudan uygulayabileceği netlikte.>

## Gerekçe
<2-4 cümle. Hangi görüş belirleyici oldu ve neden.>

## Ödün verilenler
<Bu kararla neyi kaybediyoruz — açıkça yaz. Yoksa "yok".>

## Uzlaşma
<Üyelerin hemfikir olduğu noktalar — güvenilir sinyal>

## Anlaşmazlık
<Gerçek çelişkiler, iki taraf da yazılır. Yoksa "yok".>

## Kör noktalar
<Kimsenin ilk turda görmediği, sonradan çıkanlar. Yoksa "yok".>

## Uygulama — builder'a
- [ ] <somut adım> — karmaşıklık: K<0-4>
- [ ] <somut adım> — karmaşıklık: K<0-4>

> **K = karmaşıklık sınıfı** (`builder`'ın modeli seçmesi için: K0 önemsiz … K4 kritik).
> `TODO.md` §1 (Beta-Roadmap)'deki **T1–T6 hafta numaralarıyla karıştırma** — T hafta, K zorluk.

## Backlog (karara dahil DEĞİL)
<Konseyden çıkan ama sorulan soruya ait olmayan fikirler>

## Sert veto varsa
<legal-de / gkv-302 vetosu ve etrafından dolaşma yolu>
```

### Nereye yazılır

1. Tutanak: `konsey/tutanak/YYYY-MM-DD-<konu>.md` — tam çıktı
2. Karar kaydı: `konsey/KARARLAR.md` — tek satır özet + tutanak linki
3. Alan kaydına çapraz yazım (varsa):
   - Podoloji ürün kararı → `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md`
   - Hukuki karar → `compliance/LEGAL_DECISIONS.md`
   - §302 kuralı → `wissensbank/SPEC-RULES.md`

**Kapatılmış karar yeniden açılmaz** — yeni bir olgu (mevzuat değişikliği, mimari değişiklik,
eşik aşımı) yoksa `konsey/KARARLAR.md`'deki karar geçerlidir. Konsey toplanmadan önce bu dosyaya
bakılır.

---

## Maliyet disiplini

Konsey token harcar — bu kaçınılmaz, çıktısı analizdir. Kontrol mekanizmaları:

1. **Koltuk filtresi** — tipik toplantı 3-4 üye, 6 değil
2. **300 kelime sınırı** — üye başına
3. **Şartlı 2. tur** — uyum varsa hiç çalışmaz
4. **Dışarıdan göz `agy`'de** — bedava
5. **Chairman ana bağlamda** — ekstra ajan yok
6. **Brifing gönderilir, konuşma değil** — üyeler tüm geçmişi almaz

Tipik maliyet: 4 üye × ~300 kelime + sentez. Kör nokta turu açılırsa ~1.5 katı.

---

## Yürütme kontrol listesi

- [ ] `konsey/KARARLAR.md`'ye bakıldı, bu konu daha önce kapanmamış
- [ ] Soru tarafsızlaştırıldı, ≤200 kelime
- [ ] Koltuklar yönlendirme tablosuna göre seçildi
- [ ] Üyeler **paralel** çağrıldı (tek mesajda)
- [ ] Her üye alternatif sundu — alternatifsiz "olmaz" varsa geri gönderildi
- [ ] Kör nokta turu: çelişki/⛔ varsa çalıştırıldı, yoksa atlandı
- [ ] Sert veto kontrolü yapıldı
- [ ] Karar yazıldı, ödünler açıkça belirtildi
- [ ] Tutanak + karar kaydı dosyalandı
- [ ] Backlog ayrıldı, karara karıştırılmadı
