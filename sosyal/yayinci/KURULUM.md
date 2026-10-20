# Praxura Social — Otomatik Yayıncı: Kurulum ve Kullanım

> Her gün o günün içeriğini (`sosyal/<yıl>/<AA-GG>.json` + render edilmiş medya) Instagram'a
> ve Facebook sayfasına kendisi atar. Merkez VPS'te systemd servisi (`praxura-sosyal`) olarak 7/24 çalışır,
> PC kapalıyken de. Yalnız dışarı bağlanır, sunucuda port açmaz. n8n kullanılmaz (G8).

## Nasıl çalışır

```
Kemal'in PC'si                         merkez VPS (systemd)
─────────────                          ───────────────────────────────
sosyal/<yıl>/*.json  ─┐                servis "praxura-sosyal", 5 dakikada bir:
sosyal/ausgabe/...   ─┼─ yukle.sh ──►   12:15 → bugünün içeriği → Instagram + Facebook
yayinci/*.mjs        ─┘   (ssh)         19:00 → yarının önizlemesi → Telegram
                                         her zaman → Telegram komutlarını dinler
```

- **Her gün yalnız bir kez atar.** Durum dosyası (`/var/lib/praxura-sosyal/zustand.json`) neyin atıldığını tutar. Sunucu yeniden başlasa da aynı gün iki kez atılmaz.
- **Hata olursa** en fazla 3 kez dener. İlk ve son hatada Telegram'a mesaj gelir.
- **Sunucu 12:15'te kapalıysa** açıldığı ilk dakikada o günün içeriğini yine atar.
- **Stok azalırsa** (7 günden az içerik kaldığında) Telegram'a "yeni tur üret" uyarısı gelir.

## Telegram komutları (günlük kullanım)

| Komut | Ne yapar |
|---|---|
| `/stopp 10-22` | O günü atma (önizleme geldiğinde beğenmediysen) |
| `/freigeben 10-22` | Durdurmayı geri al |
| `/pause` | Bütün yayını durdur (tatil, kriz) |
| `/weiter` | Yayına devam |
| `/status` | Bugün atıldı mı, kaç günlük stok var, neler durdurulmuş |

Her akşam 19:00'da yarının kapağı ve hook'u gelir. Bir şey yapmazsan ertesi gün 12:15'te otomatik çıkar.

## Kurulum (bir kez) — Kemal'in yapacakları

### 1. Hesaplar
1. **Instagram'ı profesyonel hesaba çevir** (Business). Uygulama → Ayarlar → Hesap türü.
2. **Facebook sayfası aç:** „Praxura".
3. **Meta Business Suite'te** (business.facebook.com) sayfayı ve Instagram hesabını aynı işletmeye ekle, birbirine bağla.

### 2. Meta uygulaması ve kalıcı token
1. developers.facebook.com → **Uygulama oluştur** → tür „Business" → az önce kullandığın işletmeyi seç.
2. Uygulamaya **„Instagram API" (Facebook Login ile)** ürününü ekle.
3. business.facebook.com → **Ayarlar → Kullanıcılar → Sistem kullanıcıları** → „Yönetici" rolünde bir sistem kullanıcısı ekle (örn. `praxura-yayinci`).
4. Bu sistem kullanıcısına **varlık ekle**: Facebook sayfası ve Instagram hesabı, „tam kontrol".
5. **Token oluştur:** uygulamayı seç, süre „Hiçbir zaman", izinler:
   `pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish, business_management`
6. Bu token'dan **sayfa token'ını** al (tarayıcıda açılabilir):
   `https://graph.facebook.com/v23.0/me/accounts?access_token=<SİSTEM_TOKENI>`
   → listede sayfanın `access_token` (= **META_PAGE_TOKEN**) ve `id` (= **META_PAGE_ID**) değeri var.
7. **Instagram kimliği:**
   `https://graph.facebook.com/v23.0/<META_PAGE_ID>?fields=instagram_business_account&access_token=<META_PAGE_TOKEN>`
   → `instagram_business_account.id` = **META_IG_USER_ID**

Kendi hesaplarımıza attığımız için App Review gerekmiyor; uygulama geliştirme modunda kalabilir.
Hata çıkarsa önce bağlantı testini çalıştır (aşağıda), mesajı bana gönder.

### 3. Telegram botu
1. Telegram'da **@BotFather** → `/newbot` → isim „Praxura Social" → **TELEGRAM_BOT_TOKEN**.
2. Yeni bota bir mesaj yaz (örn. „hallo").
3. `https://api.telegram.org/bot<TOKEN>/getUpdates` → `message.chat.id` = **TELEGRAM_CHAT_ID**.
   Bu bot yalnız bu iş için olmalı; gkv-izleme botu tekrar kullanılmaz, yoksa komutlar karışır.

### 4. Ayar dosyası
`sosyal/yayinci/env.beispiel` → kopyala → `sosyal/yayinci/.env` (git'e girmez), değerleri yaz.

### 5. Test, sonra yükleme (bu kısmı Claude yapar)
Servis **20.10.2026'dan beri merkezde kurulu ve deneme modunda çalışıyor**; `.env` gelince aynı komutla gerçek moda geçer.
```bash
node --env-file=sosyal/yayinci/.env sosyal/yayinci/yayinci.mjs --verbindung   # hiçbir şey atmadan token/sayfa/Instagram/Telegram kontrolü
node sosyal/yayinci/yayinci.mjs --pruefe 30                                    # önümüzdeki 30 günün stoku
bash sosyal/yayinci/yukle.sh                                                   # merkez VPS'e yükle + başlat
```

## Yeni içerik turu bitince
1. Render: `node sosyal/erzeuge.mjs <günler>`
2. Yükle: `bash sosyal/yayinci/yukle.sh` (atılmış günler yeniden atılmaz)

## Sunucuda bakım (sunucuda elle değişiklik yapılmaz — her şey `yukle.sh` ile, onprem O-205)
```bash
ssh praxura-merkez "sudo journalctl -u praxura-sosyal -n 50 --no-pager"   # günlük
ssh praxura-merkez "sudo cat /var/lib/praxura-sosyal/zustand.json"        # ne atıldı
ssh praxura-merkez "sudo systemctl restart praxura-sosyal"
```
Elle telafi (örneğin bir gün 3 denemede de başarısız olduysa):
`ssh praxura-merkez "cd /opt/praxura-sosyal/app && sudo -u sosyal env $(sudo cat /etc/praxura-sosyal/sosyal.env | xargs) SOSYAL_INHALT=/opt/praxura-sosyal/inhalt SOSYAL_MEDIEN=/opt/praxura-sosyal/medien SOSYAL_DATEN=/var/lib/praxura-sosyal node yayinci.mjs --posten 10-22"` — ya da Claude'ye „10-22'yi şimdi at" de.

## Sonraki adımlar (henüz yok)
- **LinkedIn şirket sayfası:** „Community Management API" onayı gerekiyor. Onay gelince `PLATTFORMEN`'e eklenir.
- **TikTok:** Content Posting API, TikTok'un denetiminden geçene kadar yalnız gizli paylaşıma izin veriyor.
- **Yorum/DM cevapçısı:** Meta'nın App Review ve Business Verification onayından sonra.
