# Praxura — TEK yapılacaklar listesi

> **Bu dosya projedeki tek TODO'dur.** 2026-08-05'te üç ayrı liste burada birleştirildi:
> `TODO_MANUEL.md` (manuel işler) · `PRE_LAUNCH_CHECKLIST.md` (launch listesi) ·
> `BETA_ROADMAP_6WOCHEN.md` (haftalık plan) + `CLAUDE.md`'nin "Aktif TODO" bölümü.
>
> **Başka yerde TODO tutma.** Yeni iş çıkarsa buraya, doğru bölüme yazılır.

**Bölüm haritası**

| § | Ne | Kim yapar |
|---|---|---|
| [0](#0) | 🔴 ACİL — sızan kimlik bilgileri | **sadece kullanıcı** |
| [1](#1) | Haftalık beta planı T1–T6 (katman zinciri, DoD, toplantı formatı) | birlikte |
| [2](#2) | Launch öncesi kontrol listesi P0–P5 + D-0 | karışık |
| [3](#3) | Açık teknik işler | geliştirme |
| [4](#4) | Fikirler (henüz karar verilmedi) | — |
| [5](#5) | Kapanmış maddeler — kayıt için | — |

Son güncelleme: 2026-08-05

---

<a id="0"></a>

## 🔴 0. ACİL — SIZAN KİMLİK BİLGİLERİ (2026-08-05 tespit edildi)

> **Neden acil:** Depo GitHub'da **public** (`api.github.com` 200 döndü) ve bu değerler
> **git geçmişinde** duruyor. Dosyayı silmek yetmez — geçmişten okunabilir.
> Bu iki madde **sadece sen** yapabilirsin, kod tarafı temizlendi.

### 0.1 Fal AI anahtarını iptal et ⬜
- **Nerede:** `ai chatbot proje/CLAUDE.md:186` → `const FAL_KEY = '...'`
- **Ne zamandır açık:** commit `961404e` / `46f338c` — **22.05.2026'dan beri (~2,5 ay)**
- **Yapılacak:** [fal.ai](https://fal.ai) panelinden anahtarı **revoke** et. Yeni anahtar
  üretmeye gerek yok — bu proje ÖLÜ, kullanılmıyor.
- **Neden yine de acil:** kullanılmayan bir anahtar da faturalandırılabilir.
- Çalışma ağacındaki değer 2026-08-05'te temizlendi, **geçmişte duruyor.**

### 0.2 Test hesabı şifresini değiştir ⬜
- **Nerede:** `PODOLOGIE_ORCHESTRATOR_PROMPT.md:36` → e-posta + şifre açık
- **Yapılacak:** Supabase Auth'tan o hesabın şifresini değiştir. Yeni şifreyi **hiçbir
  `.md` dosyasına yazma** — env var veya şifre yöneticisinde tut.
- Çalışma ağacındaki değer 2026-08-05'te temizlendi, **geçmişte duruyor.**

### 0.3 (opsiyonel, sonra) Git geçmişini temizleme ⬜
- 0.1 ve 0.2 yapıldıktan **sonra** düşünülür. `git filter-repo` ile geçmiş yazılabilir ama
  force-push gerekir ve depo geçmişini bozar. **Anahtar iptal edildiyse aciliyeti kalmaz** —
  iptal edilmiş bir anahtarın geçmişte durması zararsızdır.
- Alternatif: depoyu private yapmak (ama bkz. `feedback_vercel_private_repo` — daha önce
  Vercel deploy'u durdurmuştu).

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

## 2. Launch öncesi kontrol listesi

> Canlıya geçmeden önce baştan sona yapılacak. Test fazındayken yapılması zorluk çıkaracak
> şeyler (MFA enforcement, column encryption) ayrıca işaretli.
>
> Durum: 🟡 P0 tamamlandı, P1 büyük ölçüde tamamlandı

### 2.1 ✅ P0 — Yasal / Hukuki (TAMAMLANDI 2026-06-11)

- [x] **AVV onboarding adımı zorunlu** — checkbox + IP/timestamp kaydı aktif
- [x] **TOM** — `compliance/TOM.md`
- [x] **VVT** — `compliance/VVT.md` (Art. 30)
- [x] **DSFA** — `compliance/DSFA.md` (Art. 35)
- [x] **Cookie consent banner** — `cookie-consent.js` aktif
- [x] **Datenpannen-Runbook** — `compliance/DATENPANNEN_RUNBOOK.md`
- [x] **Recht auf Löschung** — `api/dsgvo.js` (Stripe cancel/delete dahil, cascading)
- [x] **Recht auf Auskunft (DSAR)** — `api/dsgvo.js` (47 tablo JSON export)

### 2.2 🟠 P1 — Güvenlik

- [ ] **MFA zorunluluğu (owner)** — Supabase Auth `enrollMfa` flow'u, owner login'inde AAL2
      zorunlu. ⏸️ Ayrı sprint (canlıya geçmeden).
- [x] **VPS Hardening** — ✅ 2026-06-11: `PermitRootLogin prohibit-password`,
      `PasswordAuthentication no`, `fail2ban` + sshd jail, UFW 22/80/443, unattended-upgrades
  - [ ] SSH portu değişikliği — ⏸️ lockout riski, ertelendi
- [x] **TLS / Security headers** — ✅ 2026-06-11: `praxura.de` (Vercel) HSTS+CSP;
      `n8n.infinitymade.de` Traefik middleware
- [ ] **Column-level encryption** — ⏸️ Ertelendi (tüm SELECT/INSERT değişmeli, büyük sprint)
- [ ] **Backup + Restore drill**
  - [x] VPS cron backup — `/usr/local/bin/praxura-backup.sh`, her gece 02:00 UTC, 7 gün
  - [x] Restore tatbikatı — ✅ 2026-06-11
  - [ ] Hetzner günlük snapshot — ⏸️ 5. aktif müşteriye ertelendi (~€2/ay)
  - [ ] Supabase PITR — ⏸️ Pro plan gerekli
- [x] **Sentry production** — ✅ 2026-06-11, 2 proje (JS + Node), alert kuralları aktif,
      `SENTRY_ENVIRONMENT=production`
  - [ ] Vercel serverless Sentry — ⏸️ opsiyonel
- [ ] 🔴 **reCAPTCHA v3 — YAPILMADI** (bkz. §3.2, düzeltme notu)
- [x] **Supabase function güvenliği** — `delete_expired_accounts()` anon/authenticated erişimi
      kapatıldı
- [x] **Ölü Vault sır fonksiyonları kaldırıldı** — ✅ 2026-08-05
      (`business_get_secret`/`business_save_secret` drop edildi; kolonları zaten yoktu)

### 2.3 🟡 P2 — Stripe

Stripe **2026-06-11'den beri LIVE**, gerçek ödeme alınıyor. Kalanlar:

- [ ] 🟠 **Enterprise price ID** — Stripe'ta product + monthly/yearly price oluştur,
      `STRIPE_PRICE_ENTERPRISE_MONTHLY` / `_YEARLY` env var'larına koy.
      **Doğrulandı 2026-08-05:** `stripe-live-setup.js` ve `api/_lib/pricing.js` içinde
      `ENTERPRISE` hiç geçmiyor — gerçekten açık.
- [x] **Webhook domain doğrulaması** — ✅ 2026-08-05 panelden doğrulandı:
      `https://app.praxura.de/api/stripe/webhook`. Doğru. Kodun fallback'i de aynı
      (`create-checkout-session.js:10`, `portal-session.js:8`) → `NEXT_PUBLIC_URL` boş
      olsa bile çalışır.
- [ ] **`NEXT_PUBLIC_URL` değerini gör** (küçük, tamamlayıcı) — Vercel → Settings → Environment
      Variables. Boşsa sorun yok (fallback doğru). Set edilmişse `https://app.praxura.de`
      olmalı; `infinitymade.de` yazıyorsa checkout dönüş yönlendirmeleri yanlış domain'e gider.
- [ ] **Stripe Tax** (opsiyonel) — otomatik USt, B2B reverse-charge
- [ ] **Stripe Radar** — en azından default fraud kuralları aktif
- [x] **Live mode end-to-end test** — ✅ 2026-06-11
- [x] **Fiyat seti doğrulandı** — ✅ 2026-08-05, üç bağımsız kaynak (index.html, chatbot bilgi
      tabanı, stripe-live-setup.js): **29 / 49 / 99 €/ay** · yıllık 25 / 42 / 84

### 2.4 🟢 P3 — Operasyonel

- [x] **Email confirmation sistemi** — demo booking (`api/demo-booking.js`) SMTP/nodemailer ile
      müşteri+owner'a e-posta gönderiyor ✅
- [x] **DSB Prüfvermerk** — beta aşamasında bestellpflicht yok (Art. 37 Abs. 1 kriterleri
      karşılanmıyor), `compliance/DSB_PRUEFVERMERK.md`, datenschutz.html §9
- [x] **Status page** — Uptime Kuma, `status.praxura.de` Traefik+Let's Encrypt
  - [ ] ⚠️ DNS CNAME bekliyor: Cloudflare `status.praxura.de` → `n8n.infinitymade.de`
        (proxy **OFF**) ← **KULLANICI YAPACAK**
- [x] **Pricing page** — Enterprise kartı dolu
- [x] **DNS + Email auth** — SPF aktif, DKIM CNAME yayıldı (selector1+2)
  - [ ] Microsoft 365 toggle bekliyor
- [x] **DSGVO delete → Stripe abonelik iptali** — implementli, 2026-06-11 doğrulandı
- [ ] **Onboarding video / Hilfe-Center** — en az 5 dk intro + SSS
- [ ] **Support kanalı** — `kontakt@praxura.de` yanıt süresi SLA'sı AGB'ye eklenmeli

### 2.5 🟢 P4 — Sonraya bırakılanlar

- [ ] **Per-business working_hours** — şu an çalışan saatleri global, business-bazlı override yok
- [ ] **Multi-currency** — şu an sadece EUR
- [ ] **PWA / mobile installer**
- [ ] **Mitarbeiter-Verpflichtung** — çalışan alınırsa "Verpflichtung auf das Datengeheimnis"
      imzası (§ 28 Abs. 3 lit. b DSGVO)
- [ ] **ISO 27001 hazırlığı** — Enterprise müşteri talep ettiğinde

### 2.6 🟠 P5 — Test fazından SONRA (şimdi eklenirse UX bozar)

- [ ] **reCAPTCHA v3** — booking + employee-signup. Test sırasında her seferinde captcha
      çözmemek için ertelendi. Env: `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_SITE_KEY`
- [ ] **Cookie banner TTDSG strict-review** — reddet butonu eşit görünür mü? Pre-consent hiçbir
      script yüklenmiyor mu?
- [ ] **Email rate limit + DMARC** — production'da rate limit + DNS kaydı tamamlama
- [ ] **DSB iletişim bilgisi** datenschutz.html'e — atama yapıldıktan sonra
- [ ] **Umami production domain** — şu an `analytics.infinitymade.de`, launch öncesi doğrula

### 2.7 Launch Day (D-0)

- [ ] Tüm P0 + P1 tamamlandı
- [ ] Stripe live mode test transaction başarılı
- [ ] Production smoke test: signup → onboarding → booking → abrechnung
- [ ] DMRZ ile bir gerçek müşteri için Echtbetrieb dosyası ack alındı
- [ ] Status page açık · Sentry alerts yapılandırıldı · Backup drill 1 kez tamamlandı
- [ ] DSB iletişim bilgisi datenschutz.html'de

---

<a id="3"></a>

## 3. Açık teknik işler

### 3.1 🟠 Mobil / küçük ekran UI uyumu (2026-08-05 eklendi)

**Sorun:** Desktop için yapılan her değişiklik mobile de geçiyor ama **öğeler üst üste
biniyor**, düzen tam oturmuyor. Yani mobil ayrı bir tasarım katmanı olarak ele alınmıyor.

**Yapılacak:**
1. Bunun için ayrı bir **uzman ajan** oluştur (responsive/mobil UI) — mevcut ajanların hiçbiri
   bu alanı kapsamıyor.
2. Ajan tüm dashboard + public sayfaları küçük ekran genişliklerinde tarasın, taşma/üst üste
   binme noktalarını çıkarsın.
3. En son toplu bir düzeltme turu.

**Not:** 2026-06-05'te bir responsive audit yapılıp topbar/tablet/telefon taşma düzeltmeleri
push'lanmıştı (`8564b12`, `2ef8ae2`) — ama sorun devam ediyor, yani o tur yeterli olmamış.

### 3.2 ⚠️ reCAPTCHA — kayıtlardaki çelişki düzeltildi

Eski `PRE_LAUNCH_CHECKLIST.md` **aynı dosya içinde** hem "✅ DSGVO sprint'te yapıldı" (P1) hem
"⬜ yapılacak" (P5) diyordu. **2026-08-05'te koda bakıldı: hiçbir yerde reCAPTCHA yok**
(`grep -ri captcha` → sadece belge dosyaları). Doğrusu: **yapılmadı.** Gerçek koruma şu an
`express-rate-limit`.

### 3.3 Google Fonts self-hosting — neredeyse bitti

`fonts/` altında Inter + Outfit self-hosted. **2026-08-05 taraması:** CDN'den font çeken
sadece **1 canlı dosya** kaldı:
- [ ] `demo-booking.html`
- ~~`ai chatbot proje/index.html`~~ — ölü proje, sayılmaz

(Eski listedeki 13 dosyanın 12'si kapanmış, liste güncellenmemişti.)

### 3.4 Ajanlar için private repo (2026-08-05)

`.claude/` **gitignore'da** ve bu depo **public** — ajanlar (6 uzman + `/konsey`) versiyon
kontrolü altında değil.

- [x] Geçici çözüm: depo dışına yedek → `Desktop/claude/claude-agents-yedek/`
      (ajanları değiştirdikçe **elle güncellenmeli** — otomatik değil)
- [ ] Kalıcı çözüm: ajanlar için **ayrı private GitHub deposu** aç, `.claude/` içeriğini
      oraya push'la. Public depoya konamaz: içinde vertikal strateji, `legal-de` bütçe
      eşikleri ve delegasyon yöntemi var.

### 3.5 Legal sayfa bakımı

- [ ] **Impressum** — Hetzner VPS host bilgisi (Art. 5 TMG), adres/telefon/USt-IdNr güncel mi?
- [ ] **AGB** — Stripe ödeme koşulları, abonelik iptal süreleri, Widerrufsfrist
- [ ] **Widerruf** — Muster-Widerrufsformular güncel mi?
- [ ] **DPA** — Supabase, Vercel, Hetzner, IONOS/Azure, Stripe için AVV referans listesi
- [ ] Tüm legal sayfalara "Zuletzt aktualisiert: [TARIH]"
- Kapanmış hukuki kararlar: `compliance/LEGAL_DECISIONS.md`

### 3.6 2FA — kalan platformlar

- [ ] Supabase (hesap + MFA enforcement, bkz. §2.2)
- [ ] Vercel — Team Settings > Security > Require 2FA
- [ ] Stripe — Settings > Security > Two-step verification
- [ ] Hetzner — Account > Security > 2FA
- ~~Twilio~~ — **N/A**, WhatsApp/Twilio 2026-05-20'de raflandı

### 3.7 Diğer

- [ ] **UTF-8 encoding** — `dashboard.html`/`dashboard.js`'de ü/ä/ß/— bozulabiliyor; IDE'yi
      UTF-8'e zorla, commit öncesi `git diff` ile kontrol et
- [ ] **Cache busting** — deploy'da `?v=YYYYMMDD` güncellensin, aynı sürüm tekrar kullanılmasın
- [ ] **noindex kontrolü** — `login.html`, `onboarding.html`, `employee-signup.html`'de
      `<meta name="robots" content="noindex">` var mı? (`dashboard.html`, `booking.html`'de var)
- [ ] **robots.txt / sitemap.xml** — praxura.de'ye göre güncel mi, yeni sayfalar dahil mi?
- [ ] **404 sayfası** var mı?
- [ ] **Ergotherapie Blankoverordnung** — sözleşme 01.04.2024'ten beri yürürlükte ve kodumuz
      onu **blokluyor** (gelir kaybı). ⏸️ Bilinçli beklemede: podoloji bitene kadar diğer
      alanların ince ayarı ertelendi (bkz. `CLAUDE.md` → Vertikal sıralaması)
- [ ] **GoBD audit trail** — §302 için eksik
- [ ] **Gerçek Kostenträgerdatei** — ITSG hesabı bekliyor; mock veride duplicate-IK sorunu var

---

<a id="4"></a>

## 4. Fikirler (karar verilmedi)

### 4.1 GKV-Datenaustausch otomatik izleme + AI ön inceleme (2026-08-04)

**Bugünkü durum:** `gkv-datenaustausch.de` sayfasına yeni belge yüklendiğinde mevcut n8n
workflow'u Telegram'dan "yeni dosya geldi" bildirimi atıyor. Sonrası tamamen manuel.

**Hedef zincir:**
1. Yeni belge tespit edilir (mevcut izleme)
2. Otomatik indirilir → `Handbücher/` altına
3. `pdftotext -enc UTF-8 -layout` ile `.txt` üretilir
4. Bir AI worker belgeyi okur ve `Handbücher/INDEX.md` protokolüne göre kaydını üretir:
   ne, kapsam, `Version:`, `Anzuwenden ab:`, anahtar bölümler
5. **Sürüm karşılaştırması:** aynı belgenin önceki sürümü arşivde varsa fark çıkarılır
6. Etki değerlendirmesi: değişiklik `SPEC-RULES.md`'deki bir kuralı etkiliyor mu? Etkiliyorsa
   hangi kod dosyası (`blankoRules.js`, `billing/dta/` …) gözden geçirilmeli?
7. Sonuç Telegram'a **özet + etki + önerilen aksiyon** olarak düşer; kod değişikliği otomatik
   YAPILMAZ, sadece önerilir

**Neden değerli:** §302 belgeleri sessizce sürüm atlıyor (ör. Anlage 3 V22 → 01.02.2027).
Kaçırılan bir sürüm geçişi = reddedilen fatura = müşteri parasını alamaz.

**Dikkat — G8:** yeni n8n workflow'u AÇILMAZ. **Mevcut** izleme workflow'unun genişletilmesi
olarak yapılır; ağır iş `api-backend` tarafında veya yerel bir script'te çalışır.

**Bağlantılı:** `Handbücher/INDEX.md` · `Handbücher/SPEC-RULES.md` · `.claude/agents/gkv-302.md`

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
