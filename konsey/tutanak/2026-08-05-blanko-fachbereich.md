# Konsey Kararı — Blankoverordnung geçerlilik süresi ve Fachbereich ayrımı

Tarih: 2026-08-05
Oturan üyeler: `gkv-302`, `podoloji`, `muhalif`, `deger-mi` + dışarıdan göz (`agy`/gemini-3.1-pro)
Oturmayan: `legal-de` — yönlendirme tablosuna göre ilgisiz (hasta verisi/dış servis/kamuya giden
metin/sözleşme-fiyat boyutu yok). Filtre bilinçli uygulandı.
Kör nokta turu: **açılmadı** — ⛔ yok, dört üye de aynı seçenekte birleşti.

---

## KARAR

**Seçenek C — en dar hâliyle.** `GUELTIG_WOCHEN = 16` sabitine **dokunulmayacak**, Fachbereich
bazlı tabloya çevrilmeyecek. Bunun yerine `validate.js` içindeki yönlendirmeye (`inferRezeptTyp`
/ `validateRezept`) bir **guard** eklenecek: bir rezept Blanko motoruna yönlendiriliyor ama
Physiotherapie-Schulter profiline uymuyorsa, motora hiç girmeden **tek ve anlaşılır bir blocker**
dönecek — bugünkü gibi iki ayrı kafa karıştırıcı hata (`NOT_ON_BLANKO_LIST` +
`BLANKO_DG_NOT_EX`) değil. `blankoRules.js` başına "Physio-only, Stand 08/2026" kapsam yorumu
yazılacak. Podologie Blankoverordnung **desteklenmeyecek** — §125a sözleşmesi yok.

---

## Gerekçe

`gkv-302` iki kuralı da kaynaktan doğruladı ve ikisi de bağımsız olarak teyit edildi:
HeilM-RL § 13a Abs. 2'deki 16/40 hafta ayrımı gerçekten **Blankoverordnung'a** aittir
(Abs. 1 = "Verordnungen aufgrund von Indikationen nach § 125a SGB V"), **ama** Podologie için
§125a Blankoverordnung fiilen **yürürlükte değildir** — KBV Praxiswissen 2026 s. 1144:
*"Möglich ist dies derzeit für Ergotherapie und Physiotherapie."*, ve Diagnoseliste Bölüm 2
yalnızca `ERGOTHERAPIE AB 1. APRIL 2024` ve `PHYSIOTHERAPIE AB 1. NOVEMBER 2024` başlıklarını
içeriyor. Yani 40 hafta ileriye dönük bir hükümdür; bugün faturalanabilir değildir.

Belirleyici olan bu ikinci tespit: sözleşme yokken 40 haftayı koda yazmak, kullanıcıya
**faturalanamayan bir reçeteyi "geçerli" göstermek** olurdu.

`muhalif` uygulama yerini değiştirdi ve haklı çıktı: `validate.js:18-30` yönlendirmesi sadece
metin markörüne bakıyor, Fachbereich bilgisi taşımıyor — guard `blankoRules.js` içine değil,
yönlendirme katmanına konmalı.

---

## Ödün verilenler

- Podologie Blankoverordnung sözleşmesi yayımlandığı gün kod **hazır olmayacak** — o zaman
  ayrı bir çalışma gerekecek. Bilinçli kabul: sözleşme tarihi belirsiz, şimdiden yazılacak
  kuralların yarısı tahmin olurdu.
- Fachbereich soyutlaması ertelendi; ikinci gerçek kural seti geldiğinde yapılacak.

---

## Uzlaşma (dört üye de aynı noktada)

- Seçenek **A (şimdi Fachbereich tablosu) reddedildi** — sözleşme yokken parametreleştirmek
  "destekleniyor" izlenimi yaratır
- Seçenek **B (hiç dokunma) yetersiz** — bedava değil, yanlış hata mesajı destek yükü üretiyor
- Asıl acil sorun **kural değil, yanlış yönlendiren mesaj**
- `GUELTIG_WOCHEN` sabiti kendi kapsamı içinde **doğru** (modül zaten physio-only)

---

## Anlaşmazlık

- **Guard'ın yeri:** `podoloji` ve `deger-mi` `blankoRules.js` girişini ima etti, `muhalif`
  `validate.js` yönlendirmesini savundu. → **Muhalif kabul edildi**, çünkü tek kanıt sunan oydu
  (`validate.js:18-30` okundu ve doğrulandı).
- **Zamanlama:** `gkv-302` Fachbereich tablosunu Ergo eklenirken yapmayı önerdi, `deger-mi` şimdi
  yapılmamasını. → Çelişki değil, uyumlu: tablo Ergo işiyle birlikte gelecek.

---

## Kör noktalar

- **Dışarıdan göz** (proje bağlamı olmadan) ve `muhalif` bağımsız olarak aynı sorgulanmamış
  varsayımı yakaladı: *"Podoloji, fizyoterapi için terzi işi dikilmiş bir modüle sadece süre
  parametresi değiştirilerek eklemlenebilir."* Eklemlenemez — tanı grupları, Ampel, Vergütung
  ve bonus tutarları da farklı olacak. Sözleşme geldiğinde doğru şekil **ayrı bir motor**
  (`blankoPodoRules.js`), tablo değil.
- **Guard'ın veri bağımlılığı:** rezept payload'ında `fachbereich` alanı **yok**. Guard mevcut
  sinyallerden (Diagnosegruppe, ICD) türetilmeli, yoksa hiç tetiklenmez. Uygulama öncesi çözülmeli.
- `blankoRules.js:124-132` — bonuslar `blockers` doluyken de hesaplanıp `computed`'a yazılıyor;
  `ok:false` iken `total_bonuses_eur: 89.34` dönüyor. Bugün tüketen yok ama sessiz yanlış fatura
  kaynağı. (muhalif)

---

## Uygulama — builder'a

> **Not:** `K` = karmaşıklık sınıfı (builder'ın model seçimi), `T` = roadmap haftası. Karıştırma.

- [ ] `validate.js` yönlendirmesine guard: Blanko'ya yönlendirilen ama Physio-Schulter profiline
      uymayan rezept → tek blocker `BLANKO_NICHT_VERFUEGBAR`, mesaj: *"Blankoverordnung derzeit
      nur Physiotherapie (Schulter). Für Podologie besteht kein §125a-Vertrag — bitte als
      Standardverordnung / Muster 13 ausstellen."* — karmaşıklık: **K4** (Katman 4, §302)
- [x] ~~Guard'ın tetikleyici koşulunu belirle~~ **ÇÖZÜLDÜ (Chairman, 2026-08-05):**
      Podolojiyi tespit etmeye çalışma — **tersini yap.** Kod zaten geçerli physio-Blanko'nun
      profilini biliyor. Koşul: `rezept_typ === 'blanko'` **VE** (ICD Blanko-Schulterliste'de
      değil **VEYA** `diagnosegruppe !== 'EX'`) → guard tetiklenir, motora hiç girilmez.
      **Yeni alan gerekmiyor.** `fachbereich` alanı yok ve `diagnosegruppen.json` yalnızca
      `physio` içeriyor (podoloji grupları orada değil, `diagnosegruppen` tablosunda) — bu yüzden
      "podolojiyi tanı" yaklaşımı zaten çalışmazdı.
- [ ] Hata mesajı UI'da üç dilde (de/en/tr) — `dashboard.js` sözlüğü — karmaşıklık: **K1**
- [ ] `blankoRules.js` başına kapsam yorumu: "Physiotherapie-Schulter only, Stand 08/2026;
      Podologie §125a nicht in Kraft" — karmaşıklık: **K0**
- [ ] `blankoRules.js:124-132` — `ok !== true` iken bonusları `null` bırak — karmaşıklık: **K4**
- [ ] Test: DF-b tanılı hasta (ICD E11.7x), Diagnosegruppe DF, HPNR 78030 + 78001, sağ ayak →
      Blanko akışına sok, **tek** anlaşılır mesaj çıktığını doğrula (podoloji ajanının senaryosu)

Toplam tahmini efor: **1–2 saat** (`deger-mi`), bütçe €0 🟢.
Roadmap: bu hafta **T2** haftası (Vorlagen/Ärzte/Patienten); Verordnungen **T4** haftasında
(21.08). İş 1-2 saatlik olduğu için araya alınması savunulabilir. **Karar kullanıcının.**

---

## Backlog (karara DAHİL DEĞİL)

🔴 **Ergotherapie Blankoverordnung desteklenmiyor — gerçek gelir kaybı.**
Ergo Blanko **01.04.2024'ten beri yürürlükte** (Diagnoseliste Bölüm 2, "ERGOTHERAPIE AB
1. APRIL 2024"). `blankoRules.js` bugün Ergo Blanko rezeptlerini `NOT_ON_BLANKO_LIST` ile
reddediyor — yani var olan, faturalanabilir bir vakayı bloke ediyor. Podologie'den farklı
olarak burada sözleşme **var**.
→ Bu ayrı bir konsey sorusu ve ayrı bir iş kalemi. Kapsam kayması freni gereği bu karara
karıştırılmadı.

**Öncelik kararı (kullanıcı, 2026-08-05): ERTELENDİ.** Ürün stratejisi: önce podoloji vertikali
uçtan uca mükemmelleştirilecek, diğer alanlar (Ergo, Physio, Logo) yalnızca **temel/ortak**
özelliklerle taşınacak; ince ayarları podoloji bittikten sonra yapılacak ve **ince ayar
yapılmadan o alanda müşteri kabul edilmeyecek.** Ergo Blanko bir ince-ayar kalemidir → podoloji
tamamlanana kadar beklemede. Ayrı konsey açılmadı.

Diğer:
- `heilmittel-diagnoseliste.txt` Bölüm 2 Ergo listesi tam okunmadı (gkv-302'nin doğrulanamayanı)

---

## Sert veto

Yok. `legal-de` oturmadı, `gkv-302` 🔧 KOŞULLU verdi (⛔ değil).

---

## Süreç notu (konseyin kendi işleyişi)

- `muhalif`, 40 hafta iddiasının doğrulamasını `legal-de`'ye yönlendirdi — yanlış adres,
  bu bir spesifikasyon sorusu (`gkv-302`). Ajan tanımındaki "kimin bakması lazım" listesi
  netleştirilebilir.
- Dört üyenin toplam maliyeti ~150k token, süre ~65 sn (paralel). Dışarıdan göz 22k token,
  `agy` bütçesinden — bu konuşmadan çıkmadı.
