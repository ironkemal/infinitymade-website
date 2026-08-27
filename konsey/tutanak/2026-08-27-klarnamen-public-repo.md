# Konsey Kararı — Beta-Kunden-Klarnamen im öffentlichen Repository
Tarih: 2026-08-27 · Oturan üyeler: legal-de, muhalif, deger-mi, fonksiyon-ustasi

> **Bu tutanak bilinçli olarak rumuz kullanır.** Gerçek adları buraya yazmak,
> tam da kapatmaya çalıştığımız sızıntıyı bir dosya daha büyütürdü.
> Rumuz→kişi eşlemesi yalnızca `I:\My Drive\Ops Praxura gitnogo\meetings\`
> içinde ve `ops_meetings` kaydındadır.

## KARAR

İki beta müşterisinin tam adları (bundan sonra **B1** — Podologe, ve **B2**) depodan
**tamamen kaldırılır: hem çalışma ağacından hem git geçmişinden hem commit mesajlarından.**
Sıra şudur ve bölünmez: (1) bugün ileriye dönük rumuz kuralı + pre-commit isim kapısı —
kanama durur; (2) HEAD temizliği, 34 dosyada ad→rumuz, alıntı ve tarih **aynen korunur**;
(3) `git filter-repo --replace-text` ile geçmiş + 4 commit mesajı, ardından force-push ve
GitHub Support'tan cache purge talebi. Değiştirilecek dizgiler **elle listelenir ve
onaylanır — kör `sed` yasaktır.** Depoyu private yapmak (C) bu turda **yapılmaz**; Vercel
kırılması 2026-06-10'dan beri çözülmemiştir, konu on-prem geçiş penceresine notlanır.
Paralel olarak iki müşteriden **yazılı referans onayı** istenir; onay gelirse konu kökten
kapanır ve satışa referans hakkı kazanılır. Denetim makamına bildirim **yapılmaz**
(Art. 33(1) istisnası), ancak Art. 33(5) gereği olay `compliance/` altına iç kayıt olarak
geçirilir.

## Gerekçe

Belirleyici olan üç ölçüm oldu, üçü de ilk tur görüşlerinden sonra çıktı:
**fork yok** (`forks_count: 0`, `network_count: 0`, klon sayısı 2) — bu, muhalif'in ve
deger-mi'nin erteleme gerekçesi olan "rewrite zaten dağılmışı toplamaz" argümanını çürüttü;
**isimler hiçbir testte assertion/fixture değil, hepsi yorum** — HEAD temizliğinin riski
sıfıra indi; ve **4 commit mesajı kirli** — yani ucuz alternatif olarak önerilen HEAD-only
temizlik işi bitirmiyordu. Bu üç olgu gösterildiğinde muhalif ve deger-mi görüş değiştirdi;
konsey oybirliğine vardı. legal-de'nin çerçevesi geçerli kaldı: veri Art. 4 Nr. 1 anlamında
kişisel veridir, Art. 9 devrede değildir (meslek beyanı sağlık verisi değil), ve Art. 6(1)(f)
iç dokümantasyonu taşır ama **kamuya yayını taşımaz** — çünkü rumuz aynı işlevi görürdü.

## Ödün verilenler

- Force-push iki klonu bozar: her iki tarafta çalışma durur, taze klon alınır. Bu, iki
  paralel oturumun aynı depoda çalıştığı bir dönemde gerçek bir kesintidir.
- Yaklaşık 2–4 saat kurucu zamanı; karşılığında bir günlük podoloji ince ayarı ertelenir.
- Geçmişteki commit SHA'ları değişir; dışarıda paylaşılmış bir SHA varsa kırılır.
- Rewrite "hiç olmamış" yapmaz, "GitHub'da görünmez" yapar. Arşiv/mirror almışsa geri gelmez.

## Uzlaşma

Dört üye de şunlarda hemfikir: ileriye dönük rumuz kuralı + otomatik kapı zorunludur;
alıntının kendisi (Almanca özgün söz + tarih) **korunmalıdır**, çünkü kararın gerekçesini o
taşır; kör toplu değiştirme yasaktır; ve müşteriden onay istemek en yüksek getirili adımdır.

## Anlaşmazlık

İlk turda B'nin zamanlaması: legal-de "şimdi, pencere kapanıyor" derken muhalif ve deger-mi
"ertele, tetikleyiciye bağla" dedi. Kör nokta turunda yeni olgularla çözüldü — anlaşmazlık
kalmadı.

## Kör noktalar

- **4 commit mesajı** — ilk turda hiç kimse görmedi; HEAD temizliğini tek başına yetersiz
  kılan asıl olgu budur.
- **Kör `sed` tuzağı:** `demo-dashboard.html` içinde uydurma demo hastası "Stefan W." 21
  satır geçiyor ve `capture_flows.py` aynı dizgiyi çağırıyor — gerçek kişi değil, listeden
  çıkarılmazsa ekran-görüntüsü pipeline'ı kırılır. Ayrıca `module/plz-orte.json` içinde bir
  yer adı alt-dizgi olarak eşleşiyor, `ops/tools/groups.mjs` kart eşleştirme dizgileri var.
- **Asıl mesele isim değil, denetimsizlik:** public depoya ne gittiğine bakan bir kapı yok.
  2026-08-05 denetiminde aynı boşluktan Fal AI anahtarı + test şifresi sızmıştı. Bu, ikinci
  kez aynı kural boşluğu.
- Beta müşterileriyle **imzalı gizlilik sözleşmesi bulunamadı** (`vertraege/` altında yalnız
  ortakla iki belge var) — sözleşme ihlali boyutu doğmuyor, ama bu ayrıca düşünülmesi gereken
  bir eksiklik.

## Uygulama — builder'a

- [ ] İleriye dönük kural: ad yerine rumuz (`B1 (Podologe)`, `B2`); alıntı + tarih korunur — karmaşıklık: K0
- [ ] `.githooks` pre-commit: isim listesi grep'i, eşleşirse commit reddedilir (`check-dashboard-size.sh` kalıbı) — karmaşıklık: K1
- [ ] Değiştirilecek dizgilerin **elle listesi**; `Stefan W.` demo hastası ve `plz-orte.json` yer adı listeden **hariç** — karmaşıklık: K1
- [ ] HEAD temizliği: 34 dosya, ad→rumuz, alıntı/tarih aynen — karmaşıklık: K2
- [ ] Her iki klonda çalışma durdurulur; `git filter-repo --replace-text` + 4 commit mesajı; force-push; taze klon — karmaşıklık: K3
- [ ] GitHub Support'a unreachable-object cache purge talebi — karmaşıklık: K1
- [ ] Art. 33(5) iç kaydı `compliance/` altına — karmaşıklık: K1
- [ ] İki müşteriye referans onayı talebi (metni `legal-de` yazar) — karmaşıklık: K1

## Backlog (karara dahil DEĞİL)

- Depoyu private yapma + Vercel GitHub App scope sorununun çözümü → on-prem geçiş penceresi
- Beta müşterileriyle yazılı sözleşme/AVV eksikliğinin gözden geçirilmesi
- Public depoya giden içerik için genel bir denetim kapısı (sır + kişisel veri taraması)

## Sert veto varsa

Yok. `legal-de` 🔧 KOŞULLU verdi, veto değil. `gkv-302` bu turda oturmadı (para/§302 konusu değil).
