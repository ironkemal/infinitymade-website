# Konsey Kararı — On-prem AI: Seçenek B ("anahtar bizden") yeni olgularla
Tarih: 2026-09-28 · Oturan üyeler: legal-de, guvenlik, onprem, muhalif, deger-mi, fonksiyon-ustasi

## Soru
2026-09-12'de üç vetoyla düşen Seçenek B, yeni olgularla yeniden değerlendirilsin mi? Kemal'in modeli: Praxura tek bir Azure aboneliği tutar, her praxis için ayrı kaynak ve ayrı anahtar açar. Anahtar praxis'in kutusunda durur, istekler kutudan doğrudan Azure'a gider (gateway yok). Maliyet Praxura faturasına eklenir, praxis Azure'u hiç görmez.

Yeni olgular: Microsoft C5:2020 Typ 2 raporu yayında (Azure OpenAI için dipnot 6: yalnız 31.12.2025'e kadar incelendi). Modified Abuse Monitoring başvurusu yalnız "managed" müşterilere açık ve müşteri adına yapılamıyor; B'de başvuran biz olduğumuz için tek başvuru yeter. Anahtar kaynak başına ayrı. Microsoft'a iki ticket açıldı, form gönderildi (28.09).

## KARAR
**B yeniden açıldı ve "şartlı mümkün" olarak işaretlendi. Uygulanmıyor. Şartlar tamamlanana kadar 09-12 kararı (E) geçerli: kutuda AI varsayılan kapalı, sağlayıcı seçilmedi.** Üç veto kalktı ya da şarta dönüştü: `legal-de` ⛔ yerine KOŞULLU verdi, `guvenlik` vetosunu şartlı geri çekti, `onprem` veto vermedi.

B'nin canlıya çıkması için DÖRT ön şartın hepsi gerekli:
1. **Microsoft'un yazılı cevapları:**
   - Azure OpenAI'nin 01.01.2026'dan sonra da Foundry üzerinden kapsamda olduğu.
   - 31.03.2026 sonrası için bir bridge letter.
   - Professional Secrecy Amendment'ın (§203) bu abonelik için alınabildiği.
2. **Modified Abuse Monitoring onayı.** Onay yoksa istek içerikleri Microsoft tarafında saklanır.
3. **Avukat görüşü** (1–2 saat, ~€300–600), üç soru:
   - (a) Kendi bulut sistemi işletmeyen bir Auftragsverarbeiter için §393 Abs. 3 Nr. 2 şartını alt işleyicinin C5 testatı karşılar mı?
   - (b) Foundry kapsamı ve bridge letter "aktuelles Testat" sayılır mı?
   - (c) Praxis başına kaynak açıp faturalamak Product Terms'e göre "Customer Solution" mı, yoksa yasak bir yeniden satış mı?
4. **Belge seti:** her praxis ile AVV, Microsoft'un alt işleyen olarak onaylanması, §203 zinciri, DSFA ve TOM güncellemesi.

Dört şart tamamlandığında B ile C arasında seçim yapılır. **Hukuken en temiz yol C'dir** (biz hiçbir rol üstlenmeyiz). B'yi seçmek ticari bir karardır.

B için teknik şartlar da bağlayıcıdır (guvenlik ve onprem):
- Her praxis için ayrı kaynak ve ayrı resource group.
- Kaynak başına düşük bir TPM kotası: harcamanın gerçek tavanı budur; Azure bütçesi yalnız uyarı verir, harcamayı durdurmaz.
- Bütçe uyarısı gelince anahtarı otomatik yeniden üreten mekanizma.
- Anahtar ilk lisans aktivasyonunun cevabıyla kutuya gelir; `install.sh` anahtarı sormaz. Rotasyon key1/key2 dönüşümüyle, gece lisans yenilemesinde yayılır.
- Anahtar iptali K9 takvimine bağlıdır (tolerans bitip salt-okunur moda geçişte).
- Azure Policy ile içerik saklayan özellikler (stored completions, Assistants/Files, içerik yakalayan tracing) engellenir.
- Activity Log'a alarm konur, log dışa aktarılır.
- Kutudaki kod istekleri `store:false` ile gönderir.
- Praxis'in sabit IP'si varsa kaynağa IP kısıtı konur.
- Abonelik ve bölge başına kaynak sınırı kontrol edilir (varsayılanın ~30 olduğu biliniyor, doğrulanmadı).

⚠️ B, playbook'taki kilitli kararlar K4, K5 ve K6'yı açar. Konsey bunları açamaz. B seçilirse **Kemal bunları açıkça açar** ve playbook §2'ye yazılır.

## Kemal'in üç iddiasına hüküm
1. **"Hasta verisini görmüyoruz, ispatlayabiliriz": HAYIR.** Veri teknik olarak bizden geçmiyor, bu doğru. Ama hukuki rol veriye erişime değil sözleşmeye bağlı: B'de OCR dilimi için Auftragsverarbeiter oluruz. Abonelik sahibi loglamayı açabildiği için "görmediğimizi ispat" da ancak şu biçimde kurulabilir: *"Görmüyoruz; görmeye başlarsak silinmez bir iz kalır"* (Azure Policy + Activity Log + `store:false`).
2. **"Bizim C5 almamız gerekmez, SaaS'ların standart yolu bu": ŞARTLI.** Gerekçe yanlış: Almanya'da SaaS'lar kendi katmanları için C5 alıyor, on-prem'e geçmemizin sebebi de zaten buydu. Ama B'de kendi işlettiğimiz bir bulut katmanı olmadığı için sonuç büyük ihtimalle doğru. Avukat (a) sorusuyla teyit edecek.
3. **"Microsoft olumlu dönerse olur": ŞARTLI.** Microsoft'un cevapları gerekli ama yeterli değil. Microsoft yalnız kendi testatını teyit edebilir, Praxura'nın rolünü değil. Avukat görüşü ve belge seti de gerekiyor.

## Gerekçe
Belirleyici görüş `legal-de`'nin: §393 Abs. 3 Nr. 2, C5'i "eingesetzte Cloud-Systeme" için istiyor. Kendi bulut sistemi işletmeyen biri için alt işleyicinin testatı savunulabilir, ama kesin değil. Yeni C5 raporu 09-12'deki "Azure bilinmiyor" boşluğunu kapattı. Kaynak başına anahtar da guvenlik vetosunun "anahtar paylaşılıyor" ayağını ortadan kaldırdı. Aciliyet yok: ödeyen müşteri yok, on-prem paketi yok, son AI çağrısı 19.08'de, Beta-1'e "KI kapalı" sözü verildi. Bu yüzden `deger-mi` ve `muhalif`'in "şimdi uygulama" görüşü kabul edildi.

## Ödün verilenler
- B seçilirse OCR diliminde on-prem'in "hiçbir rolümüz yok" kazancı gider: AVV, DSFA ve Art. 33 yükü bize döner.
- Bekleme: şartlar tamamlanana kadar (en erken ~2–4 hafta) kutuda AI yok.
- Avukata ~€300–600.

## Uzlaşma
- "Veri bizden geçmiyor" doğru, ama rolü belirleyen bu değil (legal-de, muhalif, onprem).
- Kaynak başına anahtar ve TPM kotası riski veri riskinden fatura riskine indiriyor (guvenlik, onprem).
- Bu hafta B uygulanmaz; sağlayıcıdan bağımsız dört kod işi yapılır (deger-mi, fonksiyon-ustasi'nin olguları).

## Anlaşmazlık
- `muhalif`: B hiç yeniden açılmasın; soru "Praxura §393 Abs. 1 anlamında Cloud-Dienst sağlayıcısı mı" diye daraltılsın, ilk müşteride C uygulansın.
- `legal-de`, `guvenlik`: şartlı açılabilir.
- **Chairman:** iki taraf uygulamada birleşiyor (bugün A, karar avukat görüşüne bağlı). "Açık ama şartlı" statüsü muhalif'in daraltılmış sorusunu avukat (a) sorusu olarak zaten içeriyor. Bu yüzden kör nokta turu çalıştırılmadı.

## Kör noktalar
- `legal-de`: Product Terms'e göre praxis başına kaynak açıp faturalamak "yeniden satış" sayılabilir. Bu konu ilk kez masaya geldi.
- `muhalif`: DSGVO Art. 13/28 gereği Microsoft'un adı alt işleyen listesinde ve hasta bilgilendirmesinde geçmek zorunda. "Praxis Azure'u bilmez" hukuken mümkün değil.
- `fonksiyon-ustasi`:
  - Merkezden kutuya sır taşıyan bir kanal hiç yok: lisans mekanizması yazılmadı; `install.sh` ve `api-backend/setup/router.js` AI anahtarı almıyor.
  - `ai_audit_log` praxis başına token tutuyor, ama kutudaki log merkeze dönmüyor. Faturalama için ayrıca bir kanal gerekir.

## Uygulama — builder'a
- [ ] `rezept-ocr.js:211`: `requires_manual_review` modelin kendi confidence skoruna değil, katalog/ICD/KVNR kontrollerine bağlanacak (gkv-302 kapı 4) — K2
- [ ] KVNR Prüfziffer hesabı (`billing/dta/preflight.js:59`) — K2
- [ ] `llmClient.js`: `AI_PROVIDER/AI_ENDPOINT/AI_API_KEY/AI_MODEL_*` okuyan ince bir katman; SaaS ve kutuda aynı env adları (G7); istekler `store:false` ile gönderilir — K2
- [ ] `azureClient.js:40`: anahtar yoksa uygulama çökmesin, AI "kapalı" hâlinde açılsın — K1
- [ ] Microsoft'taki Ticket 2'ye ek soru: bu model Product Terms'e göre "Customer Solution" mı, yeniden satış mı? Abonelik ve bölge başına Azure OpenAI kaynak sınırı kaç? — K0 (Kemal)

## Backlog (karara dahil DEĞİL)
- Kutu kullanımını merkeze raporlayan faturalama kanalı (paketleme sprinti, Faz 3).
- IP kısıtı ve Azure Policy şablonu (B seçilirse).
- Temmuz 2027'de C5 takip raporu için Ops kartı (wissensbank W-A12).

## Yeniden karar tetikleyicisi
Dört ön şartın sonuncusu tamamlandığında 1 saatlik karar turu yapılır. Bundan önce ilk on-prem müşteri AI isterse C elle kurulur (09-14 kararı).
