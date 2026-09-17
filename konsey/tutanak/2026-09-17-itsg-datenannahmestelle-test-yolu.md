# Konsey Kararı — §302 GKV testi: ITSG/Datenannahmestelle giriş yolu ve sıralama
Tarih: 2026-09-17 · Oturan üyeler: legal-de, gkv-302, guvenlik, onprem, mentor, muhalif, deger-mi, fonksiyon-ustasi

## Çerçeveleme

SORU: §302 GKV testi ve Datenannahmestelle sürecine giriş şu hangi sırayla ve hangi
yöntemle yapılmalı: (A) önce kod blockerlarını (şifreleme + Auftragsdatei) tamamla,
sonra Datenannahmestelle ile temasa geç; (B) paralel götür; (C) beta müşterilerin kendi
ITSG/Trust-Center hesaplarını/IK'lerini kullanarak test kanalına doğrudan girmeyi dene.

BAĞLAM: gkv-302'nin önceki turda düzelttiği teşhis — ITSG'den yazılım üreticisi için
resmi bir "Zulassım" yok, asıl blocker kodda: CMS şifreleme yok (yalnız imza var,
tarayıcıda), Auftragsdatei üretilmiyor. Kemal'in beta müşterilerinin (Beta-1, Beta-2)
kendi ITSG Trust-Center hesaplarına/IK bilgilerine doğrudan erişimi var.

ON-PREM ETKİSİ: belirsiz — kod hem SaaS hem gelecekteki on-prem kutularına gidecek
ortak modül (`api-backend/billing/dta/`).

## KARAR

**Sıra A+B melez, C bu turda KAPALI.**

1. **İdari temas ŞİMDİ, paralel başlar — ama müşteri kimliği olmadan.** Bir
   Datenannahmestelle'ye (AOK veya BITMARCK) genel bir soru e-postası gider: yazılım
   üreticisi için ayrı bir test-IK/sandbox mekanizması var mı, yoksa Kommunikationspartner
   kaydı gerçek IK mı gerektiriyor? Bu adım veri göndermediği için koda bağımlı değil ve
   hukuki risk taşımaz.
2. **Kod: önce Auftragsdatei iskeleti (2-3 gün, network'süz, risksiz), şifreleme (CMS
   EnvelopedData) sonra** — şifreleme, sıfırdan bir Schlüsselverzeichnis/sertifika deposu
   gerektirdiği için daha büyük iş (deger-mi: toplam 5-10 gün). İkisi de bitmeden hiçbir
   gerçek dosya (test dahil) bir Datenannahmestelle'ye **fiilen gönderilmez** — eksik
   Auftragsdatei ile atılan ilk deneme Prüfstufe 1'de gerekçesiz red alır ve güven kaybettirir.
3. **Gönderim adaptörü BYO-config olarak tasarlanır** (onprem şartı) — Datenannahmestelle
   sertifikası/kimlik bilgisi kod içine gömülmez, per-tenant config'ten okunur. Bugün
   SaaS'ta yazılsa bile yarın on-prem kutusu kendi Trust-Center hesabıyla göndermek
   isteyecek; bu tasarım ilk seferde doğru yapılmazsa ikinci kez yazılır.
4. **C — Kemal'in beta müşteri ITSG/Trust-Center hesabına girip işlem yapması —
   YAPILMAZ.** legal-de'nin üç koşulu (yazılı Vollmacht+AVV, Trust-Center sözleşmesinin
   devri yasaklamadığının teyidi, DAS'a önceden bildirim) VE "Kemal şifreyle girmez,
   praxis kendi tıklar, biz ekran paylaşımında izleriz" şartı bugün sağlanmıyor. Bu üçü
   sağlanmadan hiçbir gönderim bu hesap üzerinden yapılmaz.
5. **Bu hafta somut eylemler:**
   - Auftragsdatei iskeleti yazılır (`builder.js`).
   - DAS'a idari soru e-postası gider (müşteri kimliği içermez).
   - **Beta-1 ve Beta-2 ile gerçek bir görüşme planlanır** (mentor): "§302 testine
     yaklaşıyoruz, IK'niz gerekebilir, ne zaman/hangi şartla kabul edersiniz?" — kayıt
     tutulur, tarihlenir.
   - Kemal'in elinde tuttuğu beta müşteri ITSG kimlik bilgilerinin **nerede saklandığı**
     netleştirilir ve kasaya taşınır (guvenlik'in açık sorusu) — bu C açılmasa bile bugünden
     yapılması gereken bir güvenlik ön koşulu, çünkü kimlik bilgisi zaten elde tutuluyor.

## Gerekçe

Sekiz üye de bağımsız olarak aynı iki katmana ayrıştı: (a) idari/kayıt teması veri
taşımadığı için risksiz ve hemen başlayabilir, (b) fiili gönderim kod blockerları
bitmeden ve legal-de'nin koşulları sağlanmadan yapılamaz. gkv-302'nin spec okuması
(dosya adı gönderenin gerçek IK'sini taşıyor, dummy IK muhtemelen "bilinmeyen gönderen"
reddi alır) C'yi teknik olarak da güçsüzleştirdi — güvenlik'in önerdiği "kendi dummy
IK'mızla test et" alternatifi bile doğrulanmamış.

## Ödün verilenler

- Şifreleme (CMS EnvelopedData) ayrı ve büyük bir iş olarak beklemede kalıyor — Auftragsdatei
  bitse bile gerçek gönderim şifreleme tamamlanana kadar açılmıyor.
- Ticari temas (Beta-1/2 görüşmesi) kod işinden bağımsız olarak YAPILMAK ZORUNDA — "önce
  kod" gerekçesiyle ertelenirse mentor'un T-02 teşhisi ("hesap erişimi ticari temasın
  yerine geçen teknik kısayol") doğrulanmış sayılır.
- Kemal'in elindeki müşteri kimlik bilgilerinin saklama yeri netleşene kadar guvenlik
  kaydı "Offen/şüphe" statüsünde kalıyor.

## Uzlaşma

- İdari temas ile fiili gönderimin ayrı adımlar olduğu ve idari temasın koda bağımlı
  olmadığı — sekiz üyenin de bağımsız vardığı ortak nokta.
- C'nin bugünkü haliyle kapalı olması gerektiği (legal-de ⛔ koşullu, guvenlik güçlü görüş,
  muhalif+deger-mi karşı, gkv-302 teknik olarak zayıflattı).
- Auftragsdatei'nin şifrelemeden daha küçük ve önce yapılabilir bir iş olduğu
  (fonksiyon-ustasi'nin kod okuması + deger-mi'nin efor tahmini örtüştü).

## Anlaşmazlık

guvenlik'in önerdiği "kendi/dummy IK ile test et" güvenli alternatifi ile gkv-302'nin
"dosya adı gerçek IK taşıdığı için dummy IK muhtemelen reddedilir" bulgusu çelişiyor.
İkisi de kendi belirsizliğini kabul etti (gkv-302: "doğrulanamayan"; guvenlik: "kasa dışı
olup olmadığı doğrulanmadı"). **Chairman kararı:** bu soru başka bir agent turu yerine
doğrudan DAS'a sorulacak sorular listesine eklenir (madde 5'teki e-postada) — tahminle
çözülmez, muhatabından cevap alınır.

## Kör noktalar

- **muhalif:** Bu erişimin (Kemal'in müşteri ITSG hesabına girebilmesi) NEDEN var olduğu
  hiç sorulmamıştı — A-08 sicil kaydındaki QA-testkonto sızıntısı ve
  `PODOLOGIE_ORCHESTRATOR_PROMPT.md:333`'teki canlı şifreyle aynı örüntü: paylaşılan
  kimlik bilgisi kısayoldur ve kalıcılaşır. Mini-olay incelemesi (ne zamandır var, kim
  verdi, başka müşteride tekrarlanıyor mu) C'nin herhangi bir varyantından önce yapılmalı.
- **mentor:** "5 haftadır beta müşteriyle konuşma yok" teşhisi bu turda ÇÜRÜMEDİ, sadece
  görünmez hale geldi — hesap erişimi konuşmanın yerine geçmiş olabilir.
- **fonksiyon-ustasi:** ITSG kimlik bilgisi bugün depoda/DB'de hiçbir yerde yok — tamamen
  depo dışı, bu iyi haber (sızıntı riski kod tarafında değil).
- **onprem:** Gönderim adaptörü BYO-config olarak tasarlanmazsa on-prem paketleme
  sprintinde ikinci kez yazılır — bu bir uyarı, henüz gerçekleşmiş bir hata değil.

## Uygulama — builder'a

- [ ] `api-backend/billing/dta/builder.js`'e Auftragsdatei üretimi eklenir (Anhang 2 Kap.9
      spesifikasyonuna göre, gkv-302 doğrulamasıyla) — karmaşıklık: K2
- [ ] Kalıcı, empfänger-bazlı Datenaustauschreferenz sayacı eklenir (bugün `rechnung.datennummer`
      üzerinden mod alınıyor, geçici) — karmaşıklık: K1
- [ ] CMS EnvelopedData şifreleme katmanı tasarlanır ve yazılır — Schlüsselverzeichnis/
      sertifika deposu dahil, BYO-config (onprem şartı) — karmaşıklık: K3
- [ ] DAS'a (AOK/BITMARCK) idari soru e-postası — müşteri kimliği içermez — karmaşıklık: K0
- [ ] Beta-1/Beta-2 ile görüşme planlanır ve kayda geçirilir (mentor/REGISTER.md T-02) — karmaşıklık: K0
- [ ] guvenlik: Kemal'in elindeki ITSG kimlik bilgilerinin saklama yeri netleştirilir,
      kasaya taşınır, sicile (Akzeptiert/Offen) yazılır — karmaşıklık: K1

## Backlog (karara dahil DEĞİL)

- onprem'in önerdiği "§302 transmission adapter, BYO-credential" faz maddesi — ayrı bir
  roadmap kalemi olarak Ops-Dashboard'a düşürülmeli, bu kararın kapsamı değil.
- wissensbank'a yeni Broschüre (Stand 15.09.2026) eklenmesi — önceki gkv-302 turunda
  zaten not edilmişti, bu karara tekrar dahil edilmedi.

## Sert veto varsa

legal-de'nin C üzerindeki vetosu **koşulludur, sert değildir** — üç şart (Vollmacht+AVV,
sözleşme devir teyidi, DAS'a önceden bildirim) + "Kemal şifreyle girmez" sağlanırsa C
açılabilir. Bugün hiçbiri sağlanmadığı için pratik sonuç aynı: C kapalı.
