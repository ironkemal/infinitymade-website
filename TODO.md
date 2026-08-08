# Praxura — Beta yol haritası ve kayıt arşivi

> ⚠️ **Açık yapılacaklar listesi artık burada DEĞİL.**
>
> 2026-08-08'de tüm açık maddeler ortak panoya taşındı → **https://ops.infinitymade.de**
> Kategoriler: Ortaklık · Launch · Güvenlik · Teknik · Podoloji · Fikir
>
> **Yeni iş çıkarsa panoya yazılır, bu dosyaya değil.** Burada sadece karta dönüşemeyecek
> iki şey kaldı:
>
> | § | Ne |
> |---|---|
> | [1](#1) | Haftalık beta roadmap — plan metni: katman zinciri, DoD, toplantı formatı |
> | [5](#5) | Kapanmış maddelerin kaydı — bir madde buradaysa yeniden açma |

Son güncelleme: 2026-08-08

---

<a id="1"></a>

## 1. Beta Roadmap — 6 haftalık modül kapatma planı

> Amaç: "gözüme çarptı → onu da yapalım" döngüsünü bitirmek. Her hafta **belirli modüller**
> konuşulur, kapatılır ve **dondurulur**. Bittiğini görebilelim.
>
> Oluşturma: 2026-07-24 | Kaynak: `nav-registry.js` + `dashboard.js` veri bağımlılık analizi

### 1.0 Yöntem

#### 1.0.1 Sıralama mantığı: sidebar sırası değil, **veri katmanı** sırası

Gerçek bağımlılık, hangi modülün hangi tabloyu **ürettiği** vs **tükettiği** ile belirleniyor.
Koddan çıkarılan gerçek zincir:

```
KATMAN 1  Stammdaten (üretici, kimseyi tüketmez)
          Einstellungen · Team · Leistungen · Verfügbarkeit · Vorlagen · Ärzte
          → businesses, profiles, services, working_hours, breaks,
            time_offs, document_vorlagen, aerzte
                    │
KATMAN 2  Vorgänge (Stammdaten tüketir, kendi kaydını üretir)
          Patienten · Terminkalender · Termin-Anfragen · Warteliste
          → leads, bookings, warteliste
                    │
KATMAN 3  Klinischer Inhalt (Patient + Termin tüketir)
          Verordnungen · Sitzungen · Anamnese · Notizen · Fußstatus · Fahrtenbuch
          → prescriptions, prescription_sessions, verordnungen,
            podologie_behandlungen, anamnese, patient_notes, pat_fussbefund, fahrten
                    │
KATMAN 4  Belege / Geld (hepsini tüketir)
          Rechnungen · §302-Abrechnung · Podologie-Abrechnung · Kassenbuch · Mahnwesen
          → invoices, abrechnung, belegliste
                    │
KATMAN 5  Auswertung & Kommunikation (sadece okur, hiçbir şey üretmez)
          Übersicht · Dashboard · Auswertungen · Zuweiser · Patientenpost · Bewertungen
```

**Kural:** Aşağıdan yukarı gidiyoruz. Katman 1 kapanmadan Katman 2 konuşulmaz. Bir üst
katmanda çıkan istek alt katmanı değiştiriyorsa → o istek **geri düşer**, alt katman yeniden
açılır (§1.0.4 Regresyon kuralı).

Neden bu sıra: `services` fiyat/süre yapısını değiştirirsen `bookings`, `prescriptions`,
`invoices` ve `§302` üçü birden bozulur. Ama `Auswertungen`'i değiştirmek hiçbir şeyi bozmaz.
Yani en pahalı değişiklikler en başta, en ucuzları en sonda.

#### 1.0.2 Modül "bitti" tanımı (Definition of Done)

Bir modül ancak **5 maddenin hepsi** ✅ ise kapatılır. Toplantıda tek tek işaretlenir:

1. **Fonksiyon**: Modülün ana akışı baştan sona müşteri tarafından canlıda yapıldı (biz değil, o yaptı).
2. **Rol**: Hem `owner` hem `employee` hesabıyla doğru görünüyor/çalışıyor (RBAC).
3. **Veri**: Kayıt gerçekten DB'ye yazıyor, sayfa yenilenince duruyor, yanlış tenant'a sızmıyor.
4. **Kenar durum**: Boş liste / hatalı giriş / iptal / silme davranışı tanımlı (patlamıyor).
5. **Sektör**: Physio ve Podologie kurulumlarının ikisinde de doğru (ikisi ayrı veri havuzu kullanıyor!).

DoD dolmayan madde → modül "offen" kalır, o hafta içinde kapatılır, **bir sonraki toplantının
ilk 10 dakikasında** tekrar sorulmaz-ötelenmez şekilde onaylanır.

#### 1.0.3 Feedback disiplini (scope-creep freni)

Toplantıda gelen her geri bildirim anında 3 kutudan birine atılır — tartışma yok, etiketleme var:

| Kutu | Anlamı | Ne zaman yapılır |
|---|---|---|
| 🔴 **Blocker** | Bu modül bu haliyle günlük işte kullanılamaz | O hafta |
| 🟡 **Lücke** | Çalışıyor ama eksik; iş görülüyor | Modül katmanı kapanmadan |
| 🟢 **Wunsch** | Güzel olurdu / kozmetik | Backlog → 6 hafta sonrası |

**Altın kural:** 🟢 hiçbir zaman aynı hafta yapılmaz. Konuşulan modülün dışından gelen istekler
ait olduğu **katmana** yazılır, o hafta gündeme girmez. ("Bunu not aldım, Katman 4'te 21
Ağustos'ta konuşacağız.") Bu tek cümle, "hiç bitmeyecek" hissini bitiren şey.

#### 1.0.4 Donma + Regresyon kuralı

Kapanan modül **freeze**. Sonradan alt katmanda bir değişiklik gerekirse, değişikliği yapan
taraf o modülün **downstream listesini** açıkça yazar ve o modüller yeniden DoD'den geçer.
Downstream haritası:

- `Leistungen` değişti → Terminkalender, Verordnungen, Rechnungen, §302
- `Verfügbarkeit`/`Team` değişti → Terminkalender, Anfragen, Warteliste
- `Einstellungen` (IK-Nr, Steuernr, adres) değişti → Rechnungen, §302, Vorlagen/Druck
- `Patienten` alan değişti → neredeyse her şey (bu yüzden Katman 2'de erken kapatılıyor)
- `Verordnungen` değişti → Sitzungen, Rechnungen, §302, Auswertungen

#### 1.0.5 Toplantı formatı (sabit, 60–75 dk)

| Süre | Bölüm |
|---|---|
| 10 dk | Geçen haftanın açık maddeleri → kapatma onayı (DoD işaretleme) |
| 35 dk | Bu haftanın modülleri: müşteri **canlıda kendi yapar**, biz izleriz (demo değil, kullanım) |
| 15 dk | Feedback 3 kutuya ayrıştırma + o haftanın 🔴/🟡 listesi kesinleşir |
| 5 dk | Gelecek haftanın modülleri duyurulur + müşteriye "ön hazırlık ödevi" |

**Müşteriye ön hazırlık ödevi** her hafta veriliyor: gelecek haftanın modülünü toplantıdan önce
en az 1 kez gerçek işinde kullanması. Böylece toplantıya "ilk kez görüyorum" ile gelinmiyor —
bu, ilerlemenin yavaş olmasının asıl sebebiydi.

### 1.1 Takvim

| # | Tarih | Katman | Odak |
|---|---|---|---|
| T1 | **Cu 24.07.2026** | Yöntem + Katman 1 | Stammdaten: Einstellungen, Team, Leistungen, Verfügbarkeit |
| — | Cu 31.07.2026 | — | **İzin — toplantı yok** (müşteri ödevi: Katman 1'i canlı kullansın) |
| T2 | **Cu 07.08.2026** | Katman 1 kapanış + Katman 2a | Vorlagen, Ärzte + Patienten |
| T3 | **Cu 14.08.2026** | Katman 2b | Terminkalender, Termin-Anfragen, Warteliste |
| T4 | **Cu 21.08.2026** | Katman 3 | Verordnungen, Sitzungen, Anamnese/Notizen/Fußstatus, Fahrtenbuch |
| T5 | **Cu 28.08.2026** | Katman 4a | Rechnungen, Kassenbuch, Mahnwesen |
| T6 | **Cu 04.09.2026** | Katman 4b + Katman 5 | §302 / Podologie-Abrechnung + Auswertungen, Zuweiser, Patientenpost, Bewertungen |

> Katman 5 kasten en sona ve en hafif tutuldu: sadece okuyan modüller, altı sağlamsa
> kendiliğinden doğru olur. T6'da yer kalmazsa 11.09'a taşınabilir — bu **plan kaymaz**,
> sadece kuyruk uzar.

> ⚠️ **T ≠ K.** Buradaki T1–T6 **haftadır**. `.claude/agents/builder.md`'deki K0–K4
> **karmaşıklık sınıfıdır**. Karıştırma.

### 1.2 T1 — Cuma 24.07.2026 · Yöntem + Katman 1 (Stammdaten I)

**Modüller:** `Einstellungen` · `Team` · `Leistungen` · `Verfügbarkeit`

Neden ilk: Bu dördü hiçbir modülün verisini tüketmiyor, ama takvimden §302'ye kadar her şey
bunları tüketiyor. Burada bir alan/fiyat/saat yanlışsa, yukarıdaki 6 haftanın tamamı yanlış
veriyle test edilmiş olur.

**Toplantıda birlikte yapılacak (müşteri klavyede):**
- Einstellungen: Praxis adı, adres, IK-Nummer, Steuernummer, Bankverbindung, logo,
  Druckeinstellungen → **eksiksiz doldurulur**. (Bu alanlar Rechnungen + §302 çıktısına
  doğrudan basılıyor; boş kalırsa T5/T6 test edilemez.)
- Team: tüm gerçek çalışanlar açılır, rol (`owner`/`employee`) atanır, izin matrisi
  (Berechtigungen) çalışan başına gözden geçirilir.
- Leistungen: gerçek hizmet kataloğu — süre, fiyat, GKV pozisyonları, hangi çalışan hangi
  hizmeti veriyor (`employee_services`).
- Verfügbarkeit: haftalık çalışma saatleri, molalar, tatil/özel günler, çalışan bazlı sapmalar.

**Sorulacak sorular:**
- Kataloğunda burada karşılığı olmayan bir hizmet var mı? (varsa 🔴 — Katman 3/4'ü kilitler)
- Bir çalışanın görmemesi gereken bir şeyi görüyor mu?
- Çalışma saatleri gerçekte nasıl kırılıyor (öğle arası, ev ziyareti blokları, dönüşümlü çalışma)?

**Exit-Kriterien:** 4 modülün de DoD 5/5. Katalog + saatler artık "canlı gerçek veri", test
verisi değil.

**Bizim tarafta bilinen açıklar:** plan-limit enforcement yok (paket sınırları uygulanmıyor);
§302 modülü hâlâ physiotherapy-gate'li.

### 1.3 T2 — Cuma 07.08.2026 · Katman 1 kapanış + Katman 2a (Patienten)

**Modüller:** `Vorlagen` · `Ärzte` + `Patienten`

Neden burada: Vorlagen ve Ärzte de üretici (kimseyi tüketmiyor) ama T1'e sığmaz; Patienten ise
Katman 2'nin temeli ve tüm klinik/fatura zincirinin anahtarı. Patienten alan yapısı burada
kapanmazsa Katman 3 ve 4 iki kez yapılır.

**İçerik:**
- Vorlagen: Rechnung, Mahnung, Terminerinnerung, Arztbericht şablonları — gerçek metinlerle
  doldurulur, çıktı önizlemesi kontrol edilir (Einstellungen'den gelen praxis verisi doğru
  basıyor mu?).
- Ärzte: Zuweiser hekim listesi, LANR/BSNR, adres → Verordnung'da seçilebiliyor mu?
- Patienten: gerçek hasta kaydı açma, arama (isim / doğum tarihi / telefon), Krankenkasse +
  Versichertennummer, Zuzahlungsbefreiung, hasta detay modalinin tüm sekmeleri.

**Sorulacak sorular:**
- Hasta kartında kağıtta tuttuğun ama burada yeri olmayan bir bilgi var mı? (bu sorunun cevabı
  🔴, sonradan gelirse pahalı)
- Aynı hasta iki kez açılırsa ne oluyor? Birleştirme lazım mı?
- Arama gerçek hızda mı (100+ hasta ile)?

**Exit-Kriterien:** Patient veri modeli **donduruldu**. Bundan sonra hasta kartına alan eklemek
regresyon tetikler.

### 1.4 T3 — Cuma 14.08.2026 · Katman 2b (Termine)

**Modüller:** `Terminkalender` · `Termin-Anfragen` · `Warteliste`

Neden burada: Takvim, Katman 1'in (saat/hizmet/çalışan) ve Patienten'in tamamını tüketen ilk
modül. Alt katman sağlamsa buradaki hataların çoğu kendiliğinden kaybolur — bu yüzden Katman
1'den önce takvime dokunmuyoruz.

**İçerik:**
- Tag/Woche/Monat görünümü, çalışan filtresi, sürükle-bırak/taşıma, iptal, no-show işaretleme.
- Grup randevusu + katılımcılar; seri randevu; ev ziyareti işaretleme.
- Termin-Anfragen: kabul / red / red sonrası tekrar gönderim.
- Warteliste: bekleyen hastayı boşalan slota yerleştirme.
- Schnellerfassung / Kiosk / Kompaktmodus: günlük iş temposunda gerçekten kullanılıyor mu?

**Sorulacak sorular:**
- Günün akışında en çok tıklama nerede gidiyor? (en büyük 🟡 kaynağı burasıdır)
- İptal/no-show gerçekte nasıl işleniyor, sistem bunu kaydediyor mu?

**Bizim tarafta bilinen açıklar:** no-show kalıcı kaydedilmiyor; reddedilen anfrage yeniden
gönderilemiyor.

**Exit-Kriterien:** Bir tam iş günü sadece takvim üzerinden yürütülebiliyor, kağıt/paralel
sistem yok.

### 1.5 T4 — Cuma 21.08.2026 · Katman 3 (Klinischer Inhalt)

**Modüller:** `Verordnungen` (+ Rezept-Scan) · `Sitzungen` · `Anamnese` · `Notizen` ·
`Fußstatus` · `Fahrtenbuch`

Neden burada: Reçete, hasta + hekim + hizmet + randevu'nun hepsini tüketir; faturanın ve
§302'nin girdisidir. Burada bir alan yanlışsa fatura da §302 da yanlış çıkar.

⚠️ **Dikkat — iki ayrı zincir var, ikisi de test edilecek:**
- Physio/Logo/Ergo: `prescriptions` + `prescription_sessions`
- Podologie: `verordnungen` + `podologie_behandlungen`

**İçerik:**
- Reçete girişi (manuel + KI-Rezept-Scan): Heilmittel, ICD-10, Leitsymptomatik, Frequenz,
  Hausbesuch, Ausstellungsdatum.
- Reçete validasyon uyarıları (süre aşımı, seans sayısı, imza) doğru mu?
- Sitzungen: her randevuda seans düşümü, hasta imzası, kalan seans sayısı.
- Anamnese / Notizen / Fußstatus (Podologie fußbefund kartı dahil) / Messreihen.
- Fahrtenbuch: ev ziyaretlerinin araç + km kaydına dönmesi, aylık rapor.

**Sorulacak sorular:**
- Scan sonucu ne sıklıkla elle düzeltiliyor? Hangi alan sürekli yanlış?
- Seans sayacına güveniliyor mu, yoksa hâlâ kağıttan mı sayılıyor? (güvenilmiyorsa 🔴 — T6
  §302 anlamsızlaşır)

**Exit-Kriterien:** Reçete → randevu → seans → imza zinciri, gerçek bir hastada baştan sona
hatasız yürüdü.

### 1.6 T5 — Cuma 28.08.2026 · Katman 4a (Privatabrechnung & Kasse)

**Modüller:** `Rechnungen` (+ Ausfallrechnung) · `Kassenbuch/Belegliste` · `Mahnwesen`

Neden burada: Fatura; hasta, randevu, hizmet, reçete/seans ve Einstellungen'in **hepsini**
tüketiyor. Alt dört katman kapalıysa bu hafta çoğunlukla kontrol haftasıdır.

**İçerik:**
- Selbstzahler faturası, Zuzahlung faturası, Ausfallrechnung (tek tık akışı).
- Fatura numaralandırma sürekliliği, tarih, USt/Kleinunternehmer ibaresi, IBAN.
- PDF/yazdırma çıktısı: Vorlagen + Einstellungen doğru mu basıyor (T2'nin regresyon kontrolü).
- Kassenbuch: gelir kalemleri, GoBD açısından belge listesi.
- Mahnwesen: 1./2. hatırlatma, ödeme eşleştirme.

**Sorulacak sorular:**
- Vergi danışmanına verdiğin çıktı bu haliyle yeterli mi? (bu cevap 🔴/🟢 ayrımını netleştirir)
- Ödenmemiş faturayı bugün nasıl takip ediyorsun?

**Bizim tarafta bilinen açıklar:** GoBD audit-trail eksik.

**Exit-Kriterien:** Bir aylık gerçek gelir, sistemden çıkan belgelerle kapatılabiliyor.

### 1.7 T6 — Cuma 04.09.2026 · Katman 4b + Katman 5 (Kassenabrechnung & Auswertung)

**Modüller:** `§302-Abrechnung` / `Podologie-Abrechnung` + `Übersicht` · `Dashboard` ·
`Auswertungen` · `Zuweiser` · `Patientenpost` · `Bewertungen`

Neden en sonda: §302 zincirin en ucu — reçete, seans, hasta, kasa, sertifika, IK numarası ve
Vorlagen'in hepsi doğru olmadan test edilemez. Katman 5 ise sadece okuyan modüller; altı
doğruysa doğru gelir, yanlışsa hatanın kaynağı zaten alt katmandır.

**İçerik:**
- §302: taxierung → DTA üretimi → PKCS#7 imzalama → ZAA geri bildirim/hata okuma.
- Podologie-Abrechnung ayrı zincir olarak ayrıca koşturulur.
- Therapeut-Zertifikat ve Kostenträger/IK verisi kontrolü.
- Übersicht/Dashboard KPI'ları gerçek rakamla uyuşuyor mu (kontrol: T5 rakamlarıyla karşılaştır).
- Auswertungen, Zuweiser (B2B posta), Patientenpost (B2C), Bewertungen.

**Bizim tarafta bilinen açıklar:** gerçek Kostenträgerdatei ITSG hesabı bekliyor (mock veride
duplicate-IK sorunu var) — bu, müşteri kaynaklı değil bizim blocker'ımız, T6'da durum bildirilir.

**Exit-Kriterien:** Bir dönem §302 dosyası uçtan uca üretildi (test gönderimi dahil).
Sidebar'daki her modül ya ✅ ya da tarihli backlog kaydı.

### 1.8 6 hafta sonrası

T6 çıkışında elimizde şu olacak: sidebar'ın tamamı ✅/🟡/🟢 ile işaretli tek bir tablo. Kalan 🟢
backlog, katman sırasına göre zaten dizilmiş olacağı için, ikinci tur ("Politur-Runde") aynı
sırayla ve çok daha hızlı dönebilir.

**Paralel yürüyen, toplantı gündemi dışı işler** (müşteriye sadece durum olarak bildirilir,
tartışılmaz): on-premise geçiş hazırlığı (G8 kuralı), reCAPTCHA, Stripe Enterprise price ID,
mobil UI uyumu (§3.1).

---

<a id="2"></a>

---

<a id="5"></a>

## 5. Kapanmış — kayıt için

Bir maddeyi burada görüyorsan **yeniden açma**, yeni bir olgu yoksa karar geçerlidir.

| Ne | Ne zaman |
|---|---|
| Cookie Consent Manager (kendi banner'ımız, `cookie-consent.js`) | 2026-06-10 |
| DSGVO sprint: AVV checkbox, DSFA/TOM/VVT, OAuth token revoke | 2026-06-10 |
| Stripe LIVE'a geçiş, gerçek ödeme | 2026-06-11 |
| DTA-Pro add-on kaldırıldı, §302 Professional'a dahil edildi | 2026-06-08 |
| WhatsApp / Twilio / AI resepsiyonist raflandı | 2026-05-20 |
| Cal.com çıkarıldı, yerine kendi calendar-api | — |
| Praxura rebrand + domain ayrımı (ürün praxura.de, kurumsal infinitymade.de) | 2026-06-02 |
| Google Fonts self-hosting (12/13 dosya) | 2026-06-10 |
| 39 eskimiş rapor `archive/` altına taşındı | 2026-08-05 |
| Ölü Vault sır fonksiyonları drop edildi | 2026-08-05 |

