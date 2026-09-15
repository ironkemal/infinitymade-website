# Konsey Kararı — On-prem kutusunda AI modeli (K4 revizyonu)

Tarih: 2026-09-12 · Oturan üyeler: `legal-de`, `onprem`, `guvenlik`, `gkv-302`, `podoloji`,
`muhalif`, `deger-mi`, `fonksiyon-ustasi` + teknik fizibilite araştırması (dış rapor)

---

## KARAR

**Seçenek E.** On-prem kutusuna **OpenAI-uyumlu, sağlayıcı-bağımsız bir AI adaptörü**
(`llmClient`, Faz 1.3) konur; `AI_PROVIDER` / `AI_ENDPOINT` / `AI_API_KEY` / `AI_MODEL_*`
env'den gelir. **Varsayılan KAPALI** — anahtar girilmediği sürece kutudan tek bir AI
çağrısı çıkmaz, uygulama sorunsuz açılır, reçete girişi elle yapılır. **Sağlayıcı kararı
(IONOS / Azure / lokal model) verilmez ve satış vaadi hâline getirilmez**; ilk soran ya da
ilk ödeme yapan müşteriye ertelenir. K4 iptal edilmez, **tetiklenmemiş** duruma alınır:
BYO-key deseni env satırı olarak kâğıtta kalır, kurulum sihirbazının zorunlu adımı olmaz.
`gkv-302`'nin **dört deterministik kapısı** (aşağıda) sağlayıcıdan bağımsız ön koşuldur ve
hangi model seçilirse seçilsin önce kurulur.

## Gerekçe

Kararı iki olgu çevirdi. **Birincisi hukuki:** §393 SGB V 01.07.2025'ten beri **C5 Typ-2**
istiyor; IONOS Cloud'un testatı **Typ 1**'dir (28.05.2026, PwC) ve testat edilen servis
listesi yayımlanmıyor — IONOS'un ISO 27001 kapsamında **AI Model Hub geçmiyor**. Yani K4'ün
dayandığı sağlayıcının, kanunun istediği belgesi yok. Azure OpenAI'nin durumu ise "uyumlu"
değil **"bilinmiyor"** (C5, SOC 2 Typ 2 raporunun kapalı ekinde; ilk bağımsız C5 belgesi
Temmuz 2026). **İkincisi teknik:** lokal model (C) referans kutuda (2 vCPU / 3,7 GB RAM,
GPU yok) çalışmıyor; en ucuz çalışan donanım Hetzner GEX44 **€184/ay** ya da praxis içi
RTX 3060 12GB **~€333** tek seferlik, ve Alman küçük praxis'lerinde GPU standart değil.
Hibrit (D) ise **VLM güven skorlarının kalibre olmamasıyla** düştü (ECE 0,27–0,40; yanlış
cevaplarda ortalama güven 0,82–0,97) — "düşük güvende buluta düş" güvenilir bir sinyale
dayanamıyor. Geriye, hiçbir sağlayıcıya bağlanmadan ilerlemeyi mümkün kılan tek yol kaldı.

## Ödün verilenler

- **Rezept-Scan kutuda varsayılan olarak çalışmaz.** Podolog 25 alanı elle girer —
  `podoloji`'nin ölçümüyle günde 10–20 dakika. Bu, K7'nin ("Rezept-Scan satışta ana
  özellik") fiilen geri çekilmesidir; `podoloji` özelliği "konfor, satış argümanı değil"
  diye yeniden sınıflandırdı.
- **Satış vaadi zayıflıyor.** Ne "KI läuft lokal, keine Cloud" (C'nin vaadi) ne de
  "DSGVO-konforme deutsche KI" (A'nın vaadi) söylenebilir. Elimizde kalan cümle daha
  sönük: "AI isteğe bağlıdır, sağlayıcıyı siz seçersiniz."
- **Karar ertelendiği için iki kez ödenecek.** Sağlayıcı seçildiğinde sihirbaz adımı,
  rehber, üç dil metni ve destek malzemesi o zaman yazılacak (`deger-mi`: +1,5–2,5 gün).
- **`guvenlik`'in tercih ettiği C (PHI kutudan hiç çıkmaz) elde edilmiyor** — yalnız
  erteleniyor.

## Uzlaşma

- **B (anahtar bizden) ölü** — üç bağımsız veto: `legal-de` (sözleşme bizden geçerse §393
  bize döner), `onprem` ⛔ **G2**, `guvenlik` (kutuda sır kasası yok; `docker inspect` /
  `cat .env` ile düz metin okunur, rotasyon her kutuya dokunmak demek).
- **D (hibrit) ölü** — `guvenlik` ("en bozuk okunan reçete dışarı çıkar"), `muhalif`
  ("en kötüsü"), teknik rapor (güven sinyali yanılsama), `podoloji` (kendi seçimini geri
  çekti), `deger-mi` (8–15 gün, en az kanıtlı).
- AI'sız elle giriş yolunun çalıştığı **doğrulandı** (`fonksiyon-ustasi`) — `muhalif` bunu
  kararın ön koşulu saymıştı, koşul sağlanıyor.
- Sağlayıcı değişiminin ucuz olduğu doğrulandı: 1 client + 4 task + `server.js`'te 2
  doğrudan import; vision formatına bağlı tek yer `rezept-ocr.js:147-157`.

## Anlaşmazlık

**`gkv-302` kör nokta turunda C'de kaldı** (A'dan C'ye geçti), diğer dördü E'ye geldi.
Çelişki görünürde: kendi ifadesiyle *"vendor legal-de'nin sert vetosuna tabi, benim
kapılarım vendor-agnostic"* — yani itirazı E'ye değil, **kapılar kurulmadan herhangi bir
modelin ölçülmesine**. Chairman bunu anlaşmazlık değil **koşul** olarak kayda geçirdi ve
dört kapıyı kararın bağlayıcı parçası yaptı.

`guvenlik` kör nokta turuna alınmadı (çelişen taraflardan biri değildi). İlk turdaki
konumu "C, geçişte A kabul edilebilir, ⛔ B" idi; E, varsayılan kapalı olduğu için A'dan
daha muhafazakârdır ve ⛔ B korunur, dolayısıyla konumuyla çelişmez. **Yine de yeniden
sorulmadı — bu tutanağın bilinen eksiğidir.**

## Kör noktalar

1. **`azureClient.js:40` — kutuda "AI kurulmadı" hâli üretim modunda uygulamayı
   açtırmıyor.** `NODE_ENV=production` + anahtar yoksa `throw`. `onprem`'in O-07 şartı
   ("anahtar yok → uygulama açılır, yalnız AI kapalı") bugünkü kodda **sağlanmıyor**.
   Karardan bağımsız hata; E'nin "varsayılan kapalı" ilkesinin ön koşulu.
2. **KVNR Prüfziffer hiç hesaplanmıyor** — `billing/dta/preflight.js:59` yalnız
   `/^[A-Z]\d{9}$/`. Biçimsel olarak geçerli ama yanlış bir KVNR Prüfstufe 1–3'ten geçer,
   aylar sonra Absetzung olarak döner (`gkv-302`: sessiz hata, en tehlikeli sınıf).
3. **14/28 günlük Behandlungsbeginn-Frist sabiti iki bağımsız dosyada literal** —
   `module/heilmittel-fristen.js:39` ve `api-backend/ai/validators/standardRules.js:32-33`.
   Biri güncellenip diğeri unutulursa sessiz yanlış hesap. Daha genel olarak: aynı üç
   kavram (ICD↔Diagnosegruppe uyuşmazlığı, Höchstmenge, Behandlungsbeginn-Frist) iki
   kural motorunda farklı kod adlarıyla yazılı (backend `validators/` 2088 satır ·
   frontend `module/verordnung-*` 1198 satır). **AI kararından bağımsız, öne çekilmeli.**
4. **`ocr_raw_enc` şifreleme anahtarı kutuda şifremetinle aynı `.env`'de** (`guvenlik`
   sicilinden) — anahtar ve kilit tek torbada.
5. **Prompt injection reçete görüntüsü üzerinden mümkün** — forma basılmış metin vision
   modelini yönlendirebilir ve doğrudan §302'ye giden veriyi bozar. Ucuz modelde direnç
   daha düşük. A/B/C/D'nin hepsinde var, C'ye özgü değil.
6. **Lisans tuzağı:** Nanonets-OCR2-3B **ticari kullanım yasak** (Qwen Research License),
   dots.ocr saf MIT değil (özel ek şartlı). Granite-Docling · LightOnOCR-2 · PaddleOCR-VL ·
   DeepSeek-OCR Apache-2.0/MIT, dağıtıma uygun. Sağlayıcı kararı geldiğinde bu sütun
   önce okunur.
7. **Airgap talebi kayıtlarda sıfır** (`onprem`: playbook 0, sicil 0, LEGAL 0;
   `RELEASE-STANDARD.md:653` tam hava boşluğunu v1'de desteklemiyor). C'nin en güçlü
   argümanlarından biri, sorulmamış bir soruyu cevaplıyordu.

## Uygulama — builder'a

- [ ] **`azureClient.js:40` throw'u kaldırılır** — anahtar yokken üretim modunda da
      uygulama açılır, AI özelliği kapalı görünür (O-07). — karmaşıklık: **K1**
- [ ] **`llmClient` soyutlaması** (Faz 1.3): `azureClient.js` → `ai/llmClient.js`,
      `AI_PROVIDER`/`AI_ENDPOINT`/`AI_API_KEY`/`AI_MODEL_TEXT`/`AI_MODEL_VISION`;
      EU/uyum kontrolü sağlayıcı-bazlı hâle gelir; mevcut Azure çağrısı da bu adaptörün
      arkasına girer. 4 task + `server.js`'te 2 import dokunulur. — **K2**
- [ ] **AI varsayılan kapalı**: anahtar yoksa Rezept-Scan girişi UI'da gizlenir/pasifleşir,
      elle giriş (`openRezeptModal()`) birincil yol olur. — **K1**
- [ ] **`gkv-302`'nin dört kapısı** (sağlayıcıdan bağımsız, model ölçümünden ÖNCE):
      KVNR Prüfziffer · Positionsnummer'ı `heilmittel-catalog.json` üyeliğine bağlamak ·
      ICD'yi `icd10gm2026syst_kodes.txt`'e karşı doğrulamak · **"AI confidence asla tek
      başına kabul kriteri değildir, yalnız insan gözden geçirme sırasını belirler"**
      kuralı. `rezept-normalize`'ın exact/fuzzy/none etiketi model self-confidence'a değil
      string-mesafe/katalog-eşleşmesine dayanmalı. — **K3**
- [ ] **Frist sabitinin tekilleştirilmesi** — `module/heilmittel-fristen.js:39` ve
      `validators/standardRules.js:32-33` tek kaynağa bağlanır. — **K2**
- [ ] **İki kanıt maili** (🟢 €0, `legal-de`): (1) Microsoft'tan Service Trust Portal
      üzerinden *"Azure SOC 2 Type 2 + C5:2020, Services in Scope Appendix"* + Sweden
      Central teyidi + Professional Secrecy Amendment'ın Azure OpenAI'yi kapsadığına dair
      yazılı onay; (2) IONOS'tan *"C5-Testat 28.05.2026, Anlage: Liste der testierten
      Services"* + AI Model Hub kapsamda mı + Typ 1 → Typ 2 takvimi. — **K0**
- [ ] Sicile yazım: `onprem/REGISTER.md` → **O-74** (IONOS C5 kapsam sorusu, `offen`) +
      `azureClient.js:40` bulgusu; `guvenlik/REGISTER.md` → prompt injection + `.env`
      anahtar birlikteliği; `compliance/LEGAL_DECISIONS.md` → §393/C5 tespiti. — **K0**

## Backlog (karara dahil DEĞİL)

- İki kural motorunun **tamamen** birleştirilmesi (yalnız Frist sabiti karara dahil)
- `rezept-validate` router girdisinin silinmesi (sıfır çağıran, altındaki validatör canlı)
- Mail taslaklarının (`b2c-draft`, `appointment-confirm-draft`) kapatılması ve VVT'deki
  beyan edilmemiş işleme amacının düzeltilmesi — ayrı iş, ayrı karar
- EU AI Act Art. 6(3)/6(4) değerlendirmesinin `compliance/`'a yazılması

## Sert veto kaydı

- **`legal-de` ⛔ A** — doğrulanmamış C5 üzerine ürün kararı kurulmaz; ispat yükü bizde.
  *Etrafından dolaşma:* iki kanıt maili gelir ve olumlu çıkarsa A yeniden açılabilir.
- **`legal-de` ⛔ B** · **`onprem` ⛔ B (G2)** · **`guvenlik` ⛔ B** — kalıcı, dolanma yolu yok.
- `gkv-302` veto kullanmadı, **koşul** koydu (dört kapı) — karara dahil edildi.

## Yeniden açma koşulu

Karar şu üç olgudan biri değişirse yeniden açılır: (1) IONOS AI Model Hub için **C5 Typ-2**
belgelenir, (2) Microsoft Azure OpenAI'nin C5 kapsamı yazılı olarak teyit edilir,
(3) referans donanımda çalışan, alan-bazlı çıkarımı ölçülmüş bir açık model çıkar.
Aksi hâlde sağlayıcı kararı **ilk ödeme yapan on-prem müşterisine** ertelenmiştir.
