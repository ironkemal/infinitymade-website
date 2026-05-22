# AI Chatbot Widget Builder — Uygulama Spesifikasyonu

## Genel Bakis

Isletmeler icin ozel chatbot widget'i olusturucu. Kullanici sol panelde botun adini, gorunumunu, soru-cevap ciftlerini ve tonunu ayarlar; sag panelde canli on izleme olarak calisan bir chat widget'i gorur. Fal AI ile bot avatari olusturulabilir. Sonuc olarak gomulur HTML/JS kodu kopyalanabilir.

## Teknik Gereksinimler

- **Tek dosya:** `index.html` — tum CSS ve JS inline
- **Font:** DM Sans (Google Fonts)
- **Tema:** Koyu arka plan `#0a0a0a`, yazi rengi `#e5e5e5`
- **Vurgu rengi:** Rose `#f43f5e`
- **Dil:** Turkce
- **Framework:** Yok — vanilla HTML/CSS/JS

## Sayfa Yapisi — 2 Panel Duzen

```
+----------------------------+----------------------------+
|       Sol Panel            |       Sag Panel            |
|       (420px)              |       (esnek)              |
|                            |                            |
|   Chatbot Ayarlari        |   Canli On Izleme          |
|                            |   (Chat Widget)            |
+----------------------------+----------------------------+
```

Ust kisimda tam genislikte header bar:
- Sol: "Chatbot Widget Builder" basligi
- Sag: "Widget Kodunu Kopyala" butonu (rose vurgu renkli)

### Sol Panel — Chatbot Ayarlari

Kaydirılabilir (overflow-y: auto). Bolumler arasi `1px solid #262626` ayirici.

#### Bolum 1: Genel Ayarlar

- **Bot Adi** — text input (varsayilan: "Asistan")
- **Karsilama Mesaji** — textarea (varsayilan: "Merhaba! Size nasil yardimci olabilirim?")
- **Eslesmeme Mesaji** — textarea (varsayilan: "Bu konuda yardimci olamiyorum. Lutfen 0850 123 4567 ile iletisime gecin.")
- **Ton Secimi** — 3 butonlu secim grubu (radio-button tarzinda):
  - Resmi (icon: kravat) — cevaplarda "siz" hitabi, kurumsal dil
  - Samimi (icon: el sallama) — "sen" hitabi, rahat dil
  - Arkadas Canlisi (icon: kalp) — emoji kullanimi, sicak dil
- **Marka Rengi** — renk secici (color input), varsayilan `#f43f5e`
  - Bu renk widget'in header'ini, gonderme butonunu ve bot mesaj balonunu etkiler

#### Bolum 2: Bot Avatari

- Varsayilan: Secilen marka renginde daire icinde bot emoji (robot emojisi)
- **Emoji Secimi** — 6 emoji secenegi: robot, yildiz, kalp, ampul, roket, smiley — tiklayinca aktif olur
- **"Bot Avatari Olustur" butonu** (rose renkli, kucuk sparkle ikonu)
  - Tiklayinca acilan alan:
    - Textarea: "Avatari tarif edin" (placeholder: "sevimli mavi robot maskot, buyuk gozler")
    - "Olustur" butonu
    - Yukleniyor spinner'i
    - Sonuc on izleme (64x64 yuvarlak)
    - "Kullan" ve "Vazgec" butonlari
  - Kullanildiginda emoji yerine olusturulan gorsel gosterilir

#### Bolum 3: Soru-Cevap Ciftleri

Her cift bir kart icinde gosterilir:
- **Soru** — text input (placeholder: "Calisma saatleriniz nedir?")
- **Cevap** — textarea (placeholder: "Hafta ici 09:00-18:00 arasi hizmet vermekteyiz.")
- **Anahtar Kelimeler** — text input, virgule ayrilmis (placeholder: "saat, calisma, acik, kapali")
  - Bu kelimeler eslesme icin kullanilir
- Kartin sag ustunde kirmizi "Sil" butonu (x ikonu)

Listenin altinda: **"Yeni Soru-Cevap Ekle"** butonu (+ ikonu, ikincil buton stili)

**Baslangic Soru-Cevap Ciftleri (12 adet, tipik Turkce isletme icin):**

1. Soru: "Fiyatlariniz nedir?" / Cevap: "Hizmet fiyatlarimiz pakete gore degiskenlik gostermektedir. Guncel fiyat listemiz icin bize ulasabilirsiniz." / Anahtar: fiyat, ucret, maliyet, para, ne kadar
2. Soru: "Calisma saatleriniz nedir?" / Cevap: "Hafta ici 09:00-18:00, Cumartesi 10:00-14:00 arasi hizmet vermekteyiz. Pazar gunleri kapaliyiz." / Anahtar: saat, calisma, acik, kapali, mesai
3. Soru: "Adresiniz nerede?" / Cevap: "Levent Mah. Cinar Sok. No:12 Besiktas/Istanbul adresinde bulunmaktayiz." / Anahtar: adres, nerede, konum, harita, yol
4. Soru: "Hangi hizmetleri veriyorsunuz?" / Cevap: "Web tasarim, mobil uygulama gelistirme, SEO danismanligi ve dijital pazarlama hizmetleri sunmaktayiz." / Anahtar: hizmet, servis, ne yapiyorsunuz, yapiyorsunuz
5. Soru: "Randevu almak istiyorum" / Cevap: "Randevu icin 0850 123 4567 numarali telefonumuzu arayabilir veya web sitemizden online randevu olusturabilirsiniz." / Anahtar: randevu, rezervasyon, gorusme, toplanti
6. Soru: "Iade politikaniz nedir?" / Cevap: "Urunlerimizde 14 gun icinde kosulsuz iade garantisi sunuyoruz. Iade icin faturaniz ile birlikte bize basvurmaniz yeterlidir." / Anahtar: iade, iptal, geri, para iade
7. Soru: "Kargo suresi ne kadar?" / Cevap: "Siparisleriniz 1-3 is gunu icinde kargoya verilmektedir. Istanbul ici teslimat genellikle ertesi gundur." / Anahtar: kargo, teslimat, gonderi, ne zaman gelir, sure
8. Soru: "Hangi odeme yontemlerini kabul ediyorsunuz?" / Cevap: "Kredi karti, banka havalesi, EFT ve kapida odeme seceneklerimiz mevcuttur." / Anahtar: odeme, kredi karti, havale, eft, kapida
9. Soru: "Garanti suresi ne kadar?" / Cevap: "Tum urunlerimiz 2 yil garanti kapsamindadir. Garanti disinda da teknik destek saglamaktayiz." / Anahtar: garanti, ariza, bozuldu, teknik
10. Soru: "Toptan satis yapiyor musunuz?" / Cevap: "Evet, toptan satis ve kurumsal projeler icin ozel fiyatlandirma sunuyoruz. Detaylar icin satis ekibimizle iletisime gecebilirsiniz." / Anahtar: toptan, kurumsal, cok adet, indirim
11. Soru: "Destek hattiniz var mi?" / Cevap: "7/24 canli destek hattimiza 0850 123 4567 numarasindan ulasabilirsiniz. Ayrica destek@firma.com adresine e-posta gonderebilirsiniz." / Anahtar: destek, yardim, iletisim, telefon, email
12. Soru: "Ucretsiz deneme var mi?" / Cevap: "Evet, tum hizmetlerimizde 7 gunluk ucretsiz deneme suresi sunuyoruz. Hemen baslamak icin kayit olabilirsiniz." / Anahtar: deneme, ucretsiz, bedava, trial, test

### Sag Panel — Canli On Izleme

Arka plan: `#1a1a1a` hafif grid deseni ile (subtle).

Ortada bir "web sayfasi" simülasyonu: `background: #f5f5f5`, `border-radius: 12px`, `max-width: 500px`, icinde ornek bir isletme sayfasi gorunumu (basit birkac satir placeholder metin ve gorsel).

Sag alt kosede canli calisan chat widget'i:

#### Chat Widget Yapisi

**Kapali hali — Yuvarlak Balon:**
- 56x56px yuvarlak buton
- Marka renginde arka plan
- Ortada bot emojisi veya AI avatar
- Hafif golge
- Hover'da buyume animasyonu (scale 1.1)
- Tiklayinca chat penceresi acilir

**Acik hali — Chat Penceresi:**
- Genislik: 380px, Yukseklik: 520px
- Sag alttan acilir (animasyonlu, asagidan yukariya kayarak)
- Yuvarlak koseler: `border-radius: 16px`
- Golge: buyuk, yumusak

**Chat Penceresi Ic Yapisi:**

1. **Header** (ust kisim):
   - Marka renginde arka plan
   - Sol: Bot avatari (32x32 yuvarlak) + Bot adi (beyaz, kalin)
   - Sag: Kapat butonu (x ikonu, beyaz)

2. **Mesaj Alani** (orta, kaydirılabilir):
   - Arka plan: `#ffffff`
   - Bot mesajlari: sol tarafa hizali, acik gri balon (`#f0f0f0`), koyu yazi
   - Kullanici mesajlari: sag tarafa hizali, marka renginde balon, beyaz yazi
   - Her mesajin altinda kucuk saat bilgisi (HH:MM formati)
   - Mesajlar arasi `8px` bosluk

3. **Yazma Gostergesi** (bot yaziyor animasyonu):
   - Sol tarafa hizali kucuk balon
   - Icinde 3 nokta animasyonu (bouncing dots)
   - Bot cevap vermeden once 1-2 saniye gosterilir

4. **Giris Alani** (alt kisim):
   - Beyaz arka plan, ust kenarda ince `border-top`
   - Text input: `border: none`, placeholder: "Mesajinizi yazin..."
   - Gonder butonu: marka renginde yuvarlak buton, ok ikonu (SVG)
   - Enter tusu ile de gonderilebilir

#### Mesaj Eslesme Algoritmasi

```javascript
function findAnswer(userMessage) {
  const words = userMessage.toLowerCase().split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;

  for (const qa of qaPairs) {
    const keywords = qa.keywords.split(',').map(k => k.trim().toLowerCase());
    let score = 0;
    for (const word of words) {
      for (const keyword of keywords) {
        if (word.includes(keyword) || keyword.includes(word)) {
          score++;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = qa;
    }
  }

  if (bestScore >= 1) {
    return applyTone(bestMatch.answer);
  }
  return applyTone(noMatchMessage);
}
```

**Ton Uygulama:**
- Resmi: Cevaplari oldugu gibi kullan (varsayilan olarak resmi yazilmislar)
- Samimi: Cevap basina "Tabii, " veya "Elbette, " ekle. "sunmaktayiz" -> "sunuyoruz", "vermekteyiz" -> "veriyoruz" vb. basit donusumler
- Arkadas Canlisi: Cevap basina emoji ekle (rastgele: wave, sparkle, thumbsup). Sonuna "Baska bir sorun varsa yaz bana!" ekle

#### Mesaj Akisi

1. Widget acildiginda otomatik olarak karsilama mesaji gosterilir (bot mesaji olarak)
2. Kullanici mesaj yazar ve gonderir
3. Kullanici mesaji sag tarafa eklenir
4. 800ms bekleme + yazma gostergesi gosterilir
5. 1200ms sonra yazma gostergesi kalkar, bot cevabi sol tarafa eklenir
6. Mesaj alani otomatik en alta kayar

## Fal AI Entegrasyonu

### API Ayarlari

```javascript
const FAL_KEY = '3c2e1b25-c850-4e3f-9822-9f88b6807a63:e41f4d159c6dd129bb795b812e27d75a';

async function generateImage(prompt) {
  const response = await fetch('https://fal.run/fal-ai/nano-banana-2', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      image_size: 'square_hd',
      num_inference_steps: 25,
      guidance_scale: 7.5
    })
  });
  const data = await response.json();
  return data.images[0].url;
}
```

### Bot Avatari Olusturma

Tetikleme: Bot Avatari bolumundeki "Bot Avatari Olustur" butonu

```javascript
const description = avatarPromptInput.value;
const prompt = `cute friendly chatbot mascot, ${description}, minimalist, flat design, circle avatar, solid background, high quality`;
const imageUrl = await generateImage(prompt);
// imageUrl'yi bot avatari olarak ayarla (emoji yerine gosterilir)
```

UI akisi:
1. Kullanici tarif yazar
2. "Olustur" butonuna tiklar
3. Buton disabled olur, spinner gosterilir
4. Sonuc gelince: 64x64 yuvarlak on izleme gosterilir
5. "Kullan" butonuna tiklayinca avatar hem sol panelde hem widget'ta guncellenir
6. Hata durumunda: kirmizi uyari mesaji, buton tekrar aktif

## Veri Yapisi

```javascript
const chatbotData = {
  botName: 'Asistan',
  welcomeMessage: 'Merhaba! Size nasil yardimci olabilirim?',
  noMatchMessage: 'Bu konuda yardimci olamiyorum. Lutfen 0850 123 4567 ile iletisime gecin.',
  tone: 'formal', // 'formal' | 'casual' | 'friendly'
  brandColor: '#f43f5e',
  avatar: {
    type: 'emoji', // 'emoji' | 'image'
    emoji: 'robot', // secilen emoji key
    imageUrl: '' // Fal AI ile olusturulan gorsel
  },
  qaPairs: [
    {
      id: 'qa_1',
      question: 'Fiyatlariniz nedir?',
      answer: 'Hizmet fiyatlarimiz pakete gore...',
      keywords: 'fiyat, ucret, maliyet, para, ne kadar'
    }
    // ... 12 adet
  ]
};
```

## "Widget Kodunu Kopyala" Islevi

Header'daki butona tiklayinca:

1. Mevcut chatbot ayarlarindan bagimsiz, gomulur bir HTML/JS snippet'i olusturulur
2. Snippet icerir:
   - Tum Q&A verileri (JSON olarak)
   - Chat widget CSS (scoped, baska CSS ile catismaz)
   - Chat widget JS (IIFE icinde, global scope kirletmez)
   - Widget'i sayfaya ekleyen kod
3. Olusturulan kod `<script>` tag'i icinde olur, herhangi bir HTML sayfasina yapistirılabilir
4. Kod panoya kopyalanir (`navigator.clipboard.writeText`)
5. Buton metni gecici olarak "Kopyalandi!" olur (2 saniye sonra geri doner)
6. Kopyalanan kodda Fal AI key'i OLMAZ — sadece statik widget kodu

## CSS Detaylari

- Sol panel: `background: #141414`, `border-right: 1px solid #262626`, `overflow-y: auto`
- Sag panel: `background: #1a1a1a`
- Ayar kartlari: `background: #1e1e1e`, `border-radius: 10px`, `padding: 16px`
- Bolum basliklari: `font-size: 13px`, `text-transform: uppercase`, `letter-spacing: 1px`, `color: #888`
- Input/textarea: `background: #252525`, `border: 1px solid #333`, `color: #e5e5e5`, `border-radius: 8px`, focus'ta `border-color: #f43f5e`
- Birincil butonlar: `background: #f43f5e`, `color: white`, `border-radius: 8px`
- Q&A kartlari: `background: #1a1a1a`, `border: 1px solid #2a2a2a`, `border-radius: 10px`
- Gecis animasyonlari: `transition: all 0.2s ease`
- Ince scrollbar styling

## Responsive Davranis

Masaustu araci — minimum genislik `900px`. Paneller yan yana sabit kalir.
