# Praxura Social — Kurallar + Üretim Kaydı

> Tek dosya, iki bölüm. **Bölüm A kurallar:** her üretimden önce okunur.
> **Bölüm B kayıt:** her gün bir satır eklenir. Satır silinmez, yalnız durumu güncellenir.
> Görsel kimlik sitenin kendisidir (`assets/system.css`). Ürünün neyi yapıp yapmadığı `llms.txt`'den okunur.
> **Amaç:** sosyal medyayı önden ısıtmak. Praxura dört alanın hepsine hazır bir marka olarak görünür.

---

# BÖLÜM A — KURALLAR

## A0. Numaralandırma: bir gün = bir içerik

- **İçeriğin numarası, yayınlanacağı günün tarihidir: `AA-GG`.** Örnek: 20 Ekim → `10-20`.
- Her gün tam **bir** içerik çıkar. İçerikler video ve yazılı post olarak sırayla gelir.
- Kaynak dosya `sosyal/<yıl>/<AA-GG>.json`. Çıktılar `sosyal/ausgabe/<yıl>/<AA-GG>.mp4|png`,
  kapak `-cover.jpg`, caption `.txt`. Carousel ise `<AA-GG>-1.png`, `-2.png` …
- Üretim komutu: `node sosyal/erzeuge.mjs 10-20` (birden fazla gün: `node sosyal/erzeuge.mjs 10-21 10-22`).
- Otomasyon her gün yalnız bugünün dosyasını arar: `<yıl>/<bugün AA-GG>`. Arama ya da eşleştirme gerekmez.
- Yayınlanmamış bir gün başka güne kaydırılırsa dosyanın adı da değişir. Numara her zaman yayın günüdür.
- Denemeler ve şablon örnekleri `sosyal/_muster/` altında durur, yayına girmez.

## A1. Hedef kitle

**Bütün Heilmittel praxisleri:** Physiotherapie · Ergotherapie · Logopädie · Podologie.
Dördü de **hazır ve yayında** gibi anlatılır. Okuyan: praxis sahibi ya da yöneticisi; yoğun,
GKV evrakından bıkmış, satış diline alerjik.

- **Ortak konular (~%60):** HeilM-RL, Verordnung, Zuzahlung, abrechnung, Absetzung,
  praxis organizasyonu, veri, terapistin günlük hayatı. Hitap: „Heilmittelpraxen", „Therapiepraxen".
- **Alana özel (~%40):** dört alan sırayla döner, her biri ayda en az 2 içerik alır.
  Hitap o alana: „Physios, aufgepasst", „Ergotherapeut:innen", „Logopädie-Praxen", „Podolog:innen".

## A2. Değişmeyen kurallar (her içerikte, format ne olursa olsun)

1. **Hook:** ilk 1–3 saniyede (posttaysa başlıkta) durdurur. Kayıp, merak, rakam, komik ya da
   tanıdık bir an: bunlardan biri olmadan içerik çıkmaz.
2. **İlk karede yazı ekranda.** Kapak ve otomatik oynatma o kareyle başlıyor.
3. **Tek fikir.** Bir içerik bir şey söyler.
4. **Marka kimliği tanınır:** renkler, Fraunces başlık, tek italik bronz vurgu kelime,
   Praxura wordmark. Format değişir, kimlik değişmez.
5. **Sessiz izlenebilir:** her bilgi ekranda yazıyla bulunur.
6. **Güvenli alan:** üst 230 px, alt 420 px ve sağ 150 px boş kalır (Reels/TikTok arayüzü kapatır).
7. **Hook'un vaadi içerikte karşılanır.** Boş clickbait yok, takipçi kaybettirir.
8. **Aynı format art arda iki gün gelmez.**

## A3. Ürün anlatımı: merak uyandır, detay verme

- **Fiyat yok.** Rakam, paket, indirim, deneme süresi, „kostenlos" geçmez.
  Soru gelirse: „Schreiben Sie uns: kontakt@praxura.de".
- **Teknik detay yok, his ve sonuç var.** „20–40 dakikada kurulum, Windows 11, Hetzner" değil;
  „Ihre Daten verlassen die Praxis nicht."
- Özelliği bütün yönleriyle anlatma, **bir köşesini göster, gerisini merak ettir.**
  Çağrı: „Mehr auf praxura.de", „Folgen — Teil 2 kommt", „Schreiben Sie uns".
- Bilgi içeriklerinde (GKV kuralı, süre, norm) bilgi **doğru ve kaynaklı** verilir.
  Merak kuralı ürün anlatımı içindir, mevzuat bilgisini bulanıklaştırmak için değil.

## A4. Parlatılacak özellikler

Bunlar öne çıkarılır. Her ay en az 4'ü işlenir.

| Özellik | Açı (merak cümlesi yönü) |
|---|---|
| **Veriler praxiste kalır** | „Ihre Patientendaten liegen bei Ihnen. Nicht bei uns. Nicht in fremder Cloud." |
| **Üretici bile erişemez** | „Selbst unser Support sieht keine Patientendaten." |
| **Provizyonsuz abrechnung hazırlığı** | „Warum Prozente vom Umsatz abgeben?" |
| **İnternet giderse praxis durmaz** | „Router aus. Praxis läuft weiter." |
| **Reçete barkodu yerelde okunur** | „Scannen. Fertig. Das Bild verlässt den Rechner nicht." |
| **Verordnung tedaviden önce kontrol edilir** | „Fehler sehen, bevor die Kasse sie sieht." |
| **Her gece şifreli yedek** | „Jede Nacht gesichert. Ohne dass Sie daran denken." |
| **Yalnız Heilmittel için yapılmış** | „Keine Arztsoftware, die man umbiegt. Gebaut für Therapie." |
| **Tarayıcıda çalışır, praxis ağında tablet/PC** | „Kein Installationsmarathon an jedem Platz." |
| **Ev ziyareti + dijital Fahrtenbuch** | „Hausbesuch? Kilometer sind schon drin." |
| **Grafik Fußbefund (podoloji)** | „Befund mit einem Tipp auf den Fuß." |

⚠️ „Als einzige", „keiner außer uns" gibi **teklik iddiası kurulmaz**. Rakiplerde de olabilir;
fark hissettirilir, iddia edilmez.

## A5. Yapılmayanlar (değişmez)

- **Ürünün yapmadığı özellik gösterilmez.** Bu, ısınma döneminde güveni yakan tek hata:
  ilgilenen praxis demoda bulamazsa geri gelmez. Kapsam: KI/OCR-Scan, Online-Buchung,
  GPS rota, Google-Kalender, TI-Anbindung (liste: `llms.txt` → „Not currently offered").
- „Cloud", „SaaS", „App" denmez. Ürün yerel kurulum: Praxura Lokal.
- „Wir rechnen ab" denmez. Doğrusu: „Praxura **bereitet** die Abrechnung **vor**".
- Hasta adı, gerçek hasta görüntüsü, beta müşterisinin adı kullanılmaz.
- Rakip adı verilerek kötüleme yapılmaz. „Abrechnungszentrum" gibi genel kategoriler serbest.

## A6. Formatlar: serbest, denenir, ölçülür

Format kalıbı **zorunlu değildir.** A2'deki değişmeyen kurallar tuttuğu sürece her format
denenebilir, trendler takip edilir. Aşağıdaki liste başlangıç havuzudur, kapalı liste değildir.

**Video**
| Format | Nasıl |
|---|---|
| Bilgi patlaması | Hook (damga/şok) → sayaç/gerilim → kural → kapanış. Örnek `10-20` |
| Storytelling | „Montag, 7:58. Erster Patient. Die Verordnung ist …". Kısa bir praxis anı, son karede çözüm |
| POV / komik | „POV: Freitag 17 Uhr, Abrechnung fällig" · „Therapeut:innen, wenn die Kasse anruft". Yazı ve tempoyla esprili, insan görüntüsü yok |
| Beklenti / gerçek | İki sahne: „Was alle denken" / „Was wirklich stimmt" |
| Geri sayım | „3 Dinge, die Ihre Praxis jeden Monat Geld kosten" — 3, 2, 1 |
| Soru / test | „Wissen Sie es? Wie lange ist eine Verordnung gültig?", cevap 2 saniye sonra. Yorum çeker |
| Gizem / teaser | „Wir zeigen nicht alles. Nur so viel: …", ürünün bir köşesi. Merak kuralına (A3) en uygun format |
| Seri | „Teil 1/3". Takip ettirir, bir sonraki gün planına bağlanır |
| Trend kalıbı | O ay yükselen yazı ya da ses kalıbı markaya uyarlanır |

**Yazılı post**
`wissen` · `liste` · `mythos` · `haltung` (ayda en çok 2) · carousel (3–7 sayfa, ilk sayfa = hook) ·
meme tarzı tek cümle (marka renkleriyle, stok görsel yok).

Motor her yeni formatta gerekirse yeni sahne tipiyle genişletilir (`video/vorlage-video.html`).
Motoru yalnız ana oturum değiştirir; üretici ajanlar mevcut tipleri kullanır.

**Video sahne tipleri** (`szenen[]`, her sahnede `typ` + `dauer` saniye zorunlu)
| typ | Alanlar | İşe yarar |
|---|---|---|
| `hook` | `titel`, `stempel`, ops. `kicker` `kopf` `muster` `datum` `stempelGut:true` (yeşil damga) `stempelBei` | Reçete kartı + damga, şok açılış |
| `zaehler` | `praefix`, `von`, `bis`, ops. `grenze` (aşınca kırmızı) `kicker` `text` `quelle` | Sayaç, gerilim |
| `aussage` | `titel`, ops. `kicker` `text` `quelle` | Kelime kelime gelen açıklama (POV için `kicker:"POV"`) |
| `frage` | `titel`, `antwort`, ops. `kicker` `antwortLabel` `antwortBei` `quelle` | Soru, ardından cevap kartı |
| `vergleich` | `links{label,text,weg?}`, `rechts{label,text}`, ops. `titel` `rechtsBei` | Mythos/Fakt, Beklenti/Gerçek |
| `countdown` | `punkte[]` (2–4 madde, `<em>` serbest), ops. `kicker` | 3-2-1 sayımı |
| `enthuellung` | `titel`, ops. `kicker` `text` | Bulanıktan netleşir, teaser |
| `tippen` | `titel` (düz metin, daktiloyla yazılır), ops. `kicker` `text` `tempo` | Storytelling, POV |
| `outro` | `titel`, `cta`, ops. `kicker` | Yeşil kapanış + logo (her zaman koyu) |

Her sahnede ayrıca: `ton:"dunkel"` (yeşil zemin) · `uebergang:"schnitt"` (sert kesme, komik zamanlama).
Video üst düzeyi: `art:"video"`, `caption`, ops. `coverBei` (kapak karesinin saniyesi, varsayılan 1.2).

**Post alanları** (`art:"post"`): `layout`, `rubrik`, `seite`, `titel`, + layout'a göre `text`/`quelle` (wissen, haltung) ·
`punkte:[["Satır","alt satır"],…]` (liste, en fazla 5) · `mythos`, `fakt` (mythos). Carousel: `seiten:[{…},{…}]`,
her sayfa kendi layout'uyla. Bir de `caption`.

**Kontrol:** `node sosyal/erzeuge.mjs --vorschau <AA-GG>` → videoda her sahneden bir kare (`-vorschau.png`).
⚠ uyarısı veren içerik bitmiş sayılmaz: metin kısaltılır, komut yeniden çalıştırılır.

**Video ritmi (öneri, kural değil):** 7–20 sn. Sahne başı 1,5–3 sn. Ekranda aynı anda en çok
~7 kelime. Üstte altın ilerleme çubuğu. Son kare ilk kareye bağlanabiliyorsa bağlanır.

**Ses:** ✅ Müzik bizim, kendimiz besteledik (`sosyal/musik/komponiere.py`): lisans yok, Content ID riski yok. Üç parça:
`ruhig` (piyano, 72 bpm) · `warm` (lo-fi, 84 bpm) · `leicht` (oyuncu, 112 bpm). Otomatik seçim: POV/geri sayım → leicht,
daktilo/teaser açılışı → ruhig, gerisi → warm. JSON'da `"musik": "ruhig|warm|leicht|keine"` ile elle seçilir.
Her videonun **sessiz kopyası** da çıkar (`<AA-GG>-stumm.mp4`): trend sesle elle yüklenecek videolar için.
Müziği değiştirmek render gerektirmez: `node sosyal/erzeuge.mjs --nur-musik <AA-GG>`.
WAV'lar git'te değil, gerekirse yeniden üretilir: `python sosyal/musik/komponiere.py` (deterministik, hep aynı sonuç).

## A7. Ses tonu

- **Sie** hitabı. Komik formatta bile saygılı; hiçbir terapist ya da kasa aşağılanmaz.
- Varsayılan ton sakin ve uzman. Komik ve storytelling formatlarında daha rahat olabilir.
- Ünlem en fazla bir tane. Ekranda emoji yok, caption'da en fazla 1–2.
- Yasak kelimeler: „revolutionär", „Gamechanger", „die beste", „100 %".
- **Caption:** ilk satır hook'u tekrar eder → 1–3 cümle → çağrı → 3–5 hashtag.
- **Hashtag havuzu:** `#Heilmittel #Praxissoftware #PVS #Praxisalltag #GKV #Physiotherapie
  #Ergotherapie #Logopädie #Podologie #Therapiepraxis #Praxisinhaber #Therapeutenleben`

## A8. Üretim akışı

1. **Planla:** ay başında Bölüm B'ye her gün için bir satır eklenir (`AA-GG`, tür, format, alan, hook). Durum `Plan`.
2. **Doğrula:** bilgi içeriği `wissensbank/`'ta kontrol edilir (emin olunamazsa `gkv-302` ajanına sorulur), kaynak kayda yazılır. Ürün içeriği A4/A5 ve `llms.txt` ile karşılaştırılır.
3. **Üret:** `sosyal/<yıl>/<AA-GG>.json` yazılır → `node sosyal/erzeuge.mjs <AA-GG>`.
4. **Kontrol listesi:** ☐ A2'nin 8 maddesi ☐ fiyat yok ☐ olmayan özellik yok ☐ alan rotasyonu ☐ caption ilk satırı = hook
5. **Onay:** `node sosyal/galerie.mjs` → `sosyal/ausgabe/<yıl>/galerie.html` (bütün günler tek sayfada). Kemal bakar → `Onay`, düzeltme gerekirse `Revize`.
6. **Yayın:** `sosyal/yayinci/` (merkez VPS, systemd `praxura-sosyal`) her gün 12:15'te bugünün dosyasını Instagram + Facebook'a atar; 19:00'da yarının önizlemesi Telegram'a gelir, `/stopp AA-GG` ile durdurulur. Yeni tur: render → `bash sosyal/yayinci/yukle.sh`. Kurulum: `sosyal/yayinci/KURULUM.md`. → `Yayında` + link.
7. **Ölçüm:** 7 gün sonra izlenme, kaydetme ve izlenme süresi kayda yazılır. Ay sonunda iyi giden format ve hook'lar çoğaltılır, kötü gidenler bırakılır.

---

# BÖLÜM B — ÜRETİM KAYDI

**Durumlar:** `Plan` → `Taslak` → `Revize` → `Onay` → `Yayında` · (`Düştü`)

| No (AA-GG) | Tür | Format | Alan | Hook | Kaynak / iddia kontrolü | Durum | Sonuç (7 gün) |
|---|---|---|---|---|---|---|---|
| 10-20 | Video 13,6 sn | Bilgi patlaması (damga + sayaç) | Ortak | „Diese Verordnung ist wertlos." | HeilM-RL § 15 · „prüft die Frist": `api-backend/ai/validators/standardRules.js` | Taslak ✅ Kemal beğendi | — |
| 10-21 | Post | wissen | Ortak | „10 € + 10 %: Wer zahlt eigentlich was?" | praxiswissen-heilmittel.txt → Zuzahlung · Korrekturverfahren-Empfehlung Frage 10 | Taslak | |
| 10-22 | Video 10,4 sn | POV / komik | Ortak | „POV: Freitag, 17 Uhr. Die Abrechnung ist fällig." | llms.txt → Key features 4 | Taslak | |
| 10-23 | Post | haltung | Ortak | „Ihre Patientendaten liegen bei Ihnen. Nicht bei uns." | llms.txt → Deployment, Differentiators | Taslak | |
| 10-24 | Video 12,6 sn | Soru / test | Physio | „Physios: Wie lange darf die Behandlung pausieren?" | HeilM-RL § 16 Abs. 4 · ürün: module/abrechnung-auswahl.js | Taslak | |
| 10-25 | Post | mythos | Ortak | „Ohne Internet steht die Praxis still?" | llms.txt → Deployment | Taslak | |
| 10-26 | Video 13,4 sn | Storytelling | Podologie | „Montag, 7:58. Drei Hausbesuche heute." | llms.txt → Key features 2 + 5 | Taslak | |
| 10-27 | Post | liste | Ergo | „3 Dinge zur Blankoverordnung, die Sie wissen müssen." | HeilM-RL § 13a Abs. 2, § 15 · KBV Praxiswissen 2026 S. 12 · heilmittel-diagnoseliste.txt | Taslak | |
| 10-28 | Video 14,4 sn | Geri sayım | Ortak | „3 Gründe, warum die Kasse absetzt." | HeilM-RL § 15 Abs. 1, § 16 Abs. 1, § 13 Abs. 1 S. 3 (doğrulandı) | Taslak | |
| 10-29 | Post | wissen | Logo | „Welche Gruppe steht auf Ihrer Verordnung?" | HeilM-RL § 13 Abs. 2j · Katalog Teil III (ST, SP, RE, SF, SC) | Taslak | |
| 10-30 | Video 10,8 sn | Teaser | Ortak | „Barcode scannen. Fertig." → „Das Bild bleibt hier." | llms.txt → Key features 3 | Taslak | |
| 10-31 | Post | haltung (Halloween) | Ortak | „Das Gruseligste in jeder Praxis? Die Absetzung." | Korrekturverfahren-Empfehlung · Podologie FAK | Taslak | |
| 11-01 | Video 12,4 sn | Karşılaştırma | Ortak | „Was alle denken: Selbst einreichen ist zu kompliziert." | TP5 Anlage 1 V21 · GGT Anlage 16 · llms.txt Key features 4 | Taslak | |
| 11-02 | Post | wissen | Podologie | „Vier Kürzel, die jede Podologie-Praxis kennen muss." | HeilM-RL Katalog Teil II Podologie (DF, NF, QF, UI1/UI2) | Taslak | |
| 11-03 | Video 13,8 sn | Bilgi patlaması (hook + sayaç) | Ortak | „Wie lange bleibt eine Akte Pflicht?" | § 630f Abs. 3 BGB · LEGAL_DECISIONS.md K1.4 · dsgvo/klassifikation.js | Taslak | |
| 11-04 | Post | liste | Ortak | „5 Felder, die Sie vor der ersten Behandlung prüfen." | HeilM-RL § 13 Abs. 2 a, f/g, j, k, l | Taslak | |
| 11-05 | Video 11,6 sn | POV / komik | Ergo | „Erster Patient. Auf der Verordnung fehlt die Leitsymptomatik." | HeilM-RL Anlage 3 Zeile l · § 13 Abs. 2 l | Taslak | |
| 11-06 | Post | haltung | Ortak | „Selbst unser Support sieht keine Patientendaten." | llms.txt → Deployment | Taslak | |
| 11-07 | Video 11,2 sn | Soru / test | Logo | „Hausbesuch, aber nicht verordnet. Dürfen Sie?" | HeilM-RL § 11 Abs. 1, § 13 Abs. 2c (istisna § 11 Abs. 2 caption'da) | Taslak | |
| 11-08 | Post | mythos | Physio | „Blanko gibt es nur in der Ergo?" | heilmittel-diagnoseliste.txt → Blankoverordnung (Ergo 01.04.2024, Physio 01.11.2024) · HeilM-RL § 13a | Taslak | |
| 11-09 | Video 11,2 sn | Teaser | Ortak | „Jede Nacht – Etwas passiert in Ihrer Praxis. Sie bemerken es nie." | llms.txt → Deployment (gece + güncelleme öncesi şifreli yedek) | Taslak | |
| 11-10 | Post | wissen | Ortak | „Fehler auf der Verordnung? Nicht jeder darf ändern." | HeilM-RL § 13 Abs. 1 · Anlage 3 | Taslak | |
| 11-11 | Video 12,8 sn | Storytelling | Physio | „Vier Behandler. Drei Zettel. Null Überblick." | llms.txt → Key features 1 | Taslak | |
| 11-12 | Post | liste | Podologie | „Podolog:innen: Das nimmt Praxura Ihnen ab." | llms.txt → Key features 1–5 | Taslak | |
| 11-13 | Video 11,2 sn | Geri sayım | Ortak | „3 Dinge, die Zeit kosten." | llms.txt → Key features 3, 5, 6 | Taslak | |
| 11-14 | Post | mythos | Ortak | „Lokale Software ist von gestern?" | llms.txt → Deployment | Taslak | |
| 11-15 | Video 11,8 sn | POV / komik | Ortak | „POV: Sie entziffern die Unterschrift des Arztes." | HeilM-RL § 13 Abs. 1 · ürün: standardRules.js (imza kontrolü iddia edilmiyor) | Taslak | |
| 11-16 | Post | wissen | Ergo | „Welche Gruppe gehört zu welchem Befund?" (SB/EN/PS) | HeilM-RL 2. Teil IV (Ergotherapie) · § 13 Abs. 2j | Taslak | |
| 11-17 | Video 11,2 sn | Karşılaştırma | Ortak | „Wo liegen Ihre Patientendaten?" | llms.txt → Deployment | Taslak | |
| 11-18 | Post | haltung | Ortak | „Keine Arztsoftware, die man umbiegt. Gebaut für Therapie." | llms.txt → Target audience, Differentiators | Taslak | |
| 11-19 | Video 14 sn | Bilgi patlaması (hook + sayaç) | Ortak | „Diese 10 € bleiben an Ihnen hängen." → „Mit Nachweis zurückfordern." | KBV Praxiswissen → Zuzahlung · TP5 Anlage 1 V21 Kap. 7.4.2 | Taslak | |
| 11-20 | Post | liste | Physio | „Fünf Maßnahmen nur mit Weiterbildung." (konu: „Zertifikat abrechenbar“ belgelenemedi) | HeilM-RL § 17 Abs. 2, § 18 Nr. 7, § 19 | Taslak | |
| 11-21 | Video 10,8 sn | Teaser | Ortak | „Fehler sehen, bevor die Kasse sie sieht." | llms.txt → Key features 3 | Taslak | |
| 11-22 | Post | mythos | Logo | „Formfehler prüft doch die Kasse?" | HeilM-RL Anlage 3 · § 16 Abs. 1 | Taslak | |
| 11-23 | Video 13,8 sn | Storytelling | Ergo | „Montagmorgen. Eine Blankoverordnung. Und jetzt entscheiden Sie." | HeilM-RL § 13a · KBV Praxiswissen S. 12 | Taslak | |
| 11-24 | Post carousel 4 | wissen | Ortak | „Was ist eigentlich ein ITSG-Zertifikat?" | GGT Anlage 16 § 4.4.5, 4.5, 5.5 · llms.txt | Taslak | |
| 11-25 | Video 11,2 sn | Soru / test | Podologie | „Podolog:innen: Wie lange dauert Ihr Fußbefund?" | llms.txt → Key features 2 | Taslak | |
| 11-26 | Post | liste | Ortak | „Router aus. Diese 3 Dinge laufen trotzdem weiter." | llms.txt → Deployment, Key features 1–3 | Taslak | |
| 11-27 | Video 10,8 sn | POV / komik (Black Friday) | Ortak | „POV: Black Friday. Überall Prozente." | llms.txt → Key features 4, Differentiators | Taslak | |
| 11-28 | Post | wissen | Ortak | „Unterschrift fehlt auf der Verordnung. Wer trägt das Risiko?" | HeilM-RL § 13 Abs. 1 · Podologie Anlage 3 Nr. 3 (⚠ „vor Einreichung“ yalnız podoloji kaynağı) | Taslak | |
| 11-29 | Video 13,6 sn | Geri sayım | Logo | „3 Fehler, die Geld kosten." | HeilM-RL Anlage 3 (f, g, j) | Taslak | |
| 11-30 | Post | mythos | Podologie | „Podologie braucht keine eigene Software?" | HeilM-RL § 27, § 27a, § 7 Abs. 2 · llms.txt Key features 2 | Taslak | |
| 12-01 | Video 10,8 sn | Teaser | Ortak | „Ein Tablet. Die ganze Praxis." | llms.txt → Deployment | Taslak | |
| 12-02 | Post | wissen | Physio | „Was ist ein ergänzendes Heilmittel?" | HeilM-RL § 12 Abs. 3, § 7 Abs. 2 | Taslak | |
| 12-03 | Video 11,4 sn | Karşılaştırma | Ortak | „Auf dem Zettel im Handschuhfach." → „Kilometer sind schon drin." | llms.txt Key features 5 · „protokolliert“: canli-test/REGISTER.md | Taslak | |
| 12-04 | Post | haltung | Ortak | „Wir verdienen nicht an Ihrem Umsatz." | llms.txt → Key features 4, Differentiators | Taslak | |
| 12-05 | Video 12,4 sn | Storytelling | Logo | „Eine Logopädin. 30 Kinder." | llms.txt → Key features 1 | Taslak | |
| 12-06 | Post | liste (Nikolaus) | Ortak | „Waren Ihre Verordnungen brav?" | HeilM-RL § 13 Abs. 2, § 16 Abs. 1, § 13a | Taslak | |
| 12-07 | Video 13,2 sn | POV / komik | Physio | „Die Verordnung liegt noch zu Hause." | HeilM-RL § 15 Abs. 1–2 · standardRules.js | Taslak | |
| 12-08 | Post | wissen | Ortak | „Gesundheitsdaten sind besonders geschützt. Wo liegen Ihre?" | Art. 9 DSGVO · compliance/AVV.md 3.2 | Taslak | |
| 12-09 | Video 15 sn | Soru / test | Ergo | „Ergo-Blanko: Wer bestimmt die Anzahl der Einheiten?" | HeilM-RL § 13a Abs. 1 · KBV Praxiswissen S. 12 | Taslak | |
| 12-10 | Post carousel 3 | liste | Ortak | „5 Fragen, bevor Sie Ihre Praxissoftware wechseln." | llms.txt → Differentiators | Taslak | |
| 12-11 | Video 16 sn | Geri sayım | Podologie | „4 Angaben, ohne die keine Behandlung beginnt." (3→4, kaynak 4 diyor) | Podologie Anlage 3 Ziff. 3 | Taslak | |
| 12-12 | Post | mythos | Ortak | „Softwarewechsel heißt Chaos?" | llms.txt → Deployment · Datenübernahme: praxissoftware-podologie.html (20–40 dk ana oturumda çıkarıldı, A3) | Taslak | |
| 12-13 | Video 11,4 sn | Bilgi patlaması (yeşil damga) | Ortak | „Diese Verordnung kommt vom Zahnarzt." | HeilM-RL § 1 Abs. 3 · TP5 Anlage 3 V21 Schlüssel 8.1.11 | Taslak | |
| 12-14 | Post | wissen | Logo | „Einzel oder Gruppe: Was gilt?" | HeilM-RL § 10, § 30 Abs. 2, § 16 Abs. 6 | Taslak | |
| 12-15 | Video 13,2 sn | POV / komik | Ortak | „POV: Neue Kollegin. Erster Tag. Wo stehen die Passwörter?" | llms.txt Key features 7 · routes/mitarbeiter-zugang.js | Taslak | |
| 12-16 | Post | mythos | Ergo | „Blanko heißt nicht grenzenlos." | HeilM-RL § 13a Abs. 2 · KBV Praxiswissen S. 12 | Taslak | |
| 12-17 | Video 15 sn | Storytelling | Ortak | „Ein Jahr in 15 Sekunden." | GKV iddiası yok · llms.txt | Taslak | |
| 12-18 | Post | wissen | Ortak | „Feiertage stoppen keine Fristen." | HeilM-RL § 15 Abs. 1 | Taslak | |
| 12-19 | Video 13 sn | Teaser | Ortak | „Was, wenn Ihre Praxissoftware bei Ihnen wohnt?" | llms.txt → Deployment | Taslak | |
| 12-20 | Post | haltung | Ortak | „Danke, 2026. Ihre Daten bleiben, wo sie hingehören." | llms.txt → Deployment | Taslak | |

✨ = A4'teki parlatılacak özellikler. Plan dağılımı: 31 post + 30 video · Physio 6 · Ergo 6 · Logo 6 · Podologie 6 · Ortak 37.
Bir konu doğrulanamazsa (kaynak bulunamazsa) ajan **aynı alanda ve aynı formatta** doğrulanabilir bir konuya geçer ve bunu bildirir.

### Dönem 2 — 21.12.2026 → 20.01.2027 (Ocak dosyaları `sosyal/2027/`)
Yeni günlerde **Bölüm B'deki 10-20 → 12-20 konuları tekrarlanmaz**; aynı konuya ancak bambaşka bir açıdan dönülebilir.

| No (AA-GG) | Tür | Format | Alan | Hook | Kaynak / iddia kontrolü | Durum | Sonuç (7 gün) |
|---|---|---|---|---|---|---|---|
| 12-21 | Video 11,4 sn | Soru / test | Ortak | „Wie viele Einheiten passen auf eine Verordnung?" | HeilM-RL § 7 Abs. 2, 4, 5 | Taslak | |
| 12-22 | Post | wissen | Physio | „Ist die Frequenz auf der Verordnung verbindlich?" | HeilM-RL § 16 Abs. 3 · KBV Praxiswissen (Frequenzspannen) | Taslak | |
| 12-23 | Video 10,2 sn | Teaser | Ortak | „Offene Zuzahlungen? Praxura vergisst sie nicht." | llms.txt → Key features 6 | Taslak | |
| 12-24 | Post | liste (Heiligabend) | Ortak | „Was wir Ihrer Praxis für 2027 wünschen." | GKV iddiası yok · llms.txt Deployment | Taslak | |
| 12-25 | Video 12,4 sn | POV / komik | Ortak | „POV: Weihnachtsessen. Sie erklären die Heilmittel-Richtlinie." | llms.txt → Key features 3 | Taslak | |
| 12-26 | Post | wissen | Logo | „Therapiebericht angekreuzt: Was jetzt?" | HeilM-RL § 16 Abs. 7 · KBV Praxiswissen | Taslak | |
| 12-27 | Video 14 sn | Storytelling | Ergo | „Nicht jede Patientin braucht alle paar Wochen eine neue Verordnung." | HeilM-RL § 8 Abs. 2–3, Anlage 2 | Taslak | |
| 12-28 | Post | mythos | Ortak | „Lokal heißt: Backups vergessen?" | llms.txt → Deployment | Taslak | |
| 12-29 | Video 11,8 sn | Soru / test | Podologie | „Zwei Nägel mit Spange. Wie viele Verordnungen?" | HeilM-RL § 28 Abs. 1 | Taslak | |
| 12-30 | Post | wissen | Ortak | „Verordnung aus dem Krankenhaus? Andere Fristen." | HeilM-RL § 16a Abs. 1–3 | Taslak | |
| 12-31 | Video 11,6 sn | Geri sayım (Silvester) | Ortak | „Was Sie 2026 zurücklassen können." | llms.txt → Key features 3–5 | Taslak | |
| 01-01 | Post | wissen (Neujahr) | Ortak | „Neues Jahr, neuer Zuzahlungsstatus?" (konu: „Befreiung pro Kalenderjahr“ wissensbank'ta yok) | TP5 Anlage 1 V21 Kap. 7.4.2.1, 7.4.2.3 | Taslak | |
| 01-02 | Video 13,2 sn | Bilgi patlaması (hook) | Podologie | „Dieselbe Leistung. Drei Nummern." (konu: HPNR 2027 henüz yok → numaranın ilk hanesi) | Podologie_Positionsnummern_2026_Filtered.csv | Taslak | |
| 01-03 | Post | mythos | Ergo | „Wärme allein verordnen? Geht nicht." | HeilM-RL § 40 Abs. 1, § 12 Abs. 3, Katalog Teil IV | Taslak | |
| 01-04 | Video 13 sn | Karşılaştırma | Ortak | „Was viele denken: Therapie per Video geht nicht." | HeilM-RL § 16b Abs. 1, 3 · KBV Praxiswissen | Taslak | |
| 01-05 | Post | haltung | Ortak | „Software sollte Ihnen gehören. Nicht umgekehrt." | llms.txt → Deployment, Key features 4 | Taslak | |
| 01-06 | Video 11,4 sn | POV / komik | Physio | „POV: MLD-45 verordnet. Der Patient hat 30 Minuten." | HeilM-RL § 18 Abs. 2 Nr. 7 · llms.txt Key features 1 | Taslak | |
| 01-07 | Post | liste | Logo | „Vier Therapien, die Logopädie-Praxen verordnet bekommen." | HeilM-RL §§ 31, 32, 33, 33a | Taslak | |
| 01-08 | Video 11,2 sn | Teaser | Ortak | „Von unterwegs? Über Ihr eigenes VPN." | llms.txt → Deployment | Taslak | |
| 01-09 | Post | wissen | Podologie | „Podologische Komplexbehandlung: Was gehört dazu?" | HeilM-RL § 27a Abs. 3, 4 | Taslak | |
| 01-10 | Video 15,4 sn | Storytelling | Ortak | „Freitag, 16:40. Letzter Patient." | llms.txt → Key features 1–3 | Taslak | |
| 01-11 | Post | mythos | Physio | „Kombination plus Einzelmaßnahme? Geht nicht." | HeilM-RL § 12 Abs. 4–5, § 25 Abs. 1 | Taslak | |
| 01-12 | Video 9,4 sn | Soru / test | Ortak | „Wer darf Heilmittel verordnen?" (01-14'e teaser: Ergo istisnası iki gün sonra) | HeilM-RL § 1 Abs. 1, § 3 Abs. 1 | Taslak | |
| 01-13 | Post | liste | Ortak | „Fünf Vorsätze für 2027." | llms.txt → Key features 3, 5, 6, Deployment | Taslak | |
| 01-14 | Video 11,8 sn | POV / komik | Ergo | „POV: Die Ergo-Verordnung kommt von der Psychotherapeutin." | HeilM-RL § 1 Abs. 1, § 35 Abs. 4 · KBV Praxiswissen | Taslak | |
| 01-15 | Post | mythos | Ortak | „Lokal heißt unsicher?" | llms.txt → Deployment, Differentiators | Taslak | |
| 01-16 | Video 11,6 sn | Storytelling | Logo | „Dienstag, 14:10. Eine Verordnung. Zwei Behandlungszeiten." | HeilM-RL § 12 Abs. 2, § 30 Abs. 2 | Taslak | |
| 01-17 | Post | liste | Podologie | „Hausbesuch in der Podologie: Das haben Sie digital dabei." | llms.txt → Key features 1, 2, 3, 5, Deployment | Taslak | |
| 01-18 | Video 13 sn | POV / komik | Ortak | „POV: Die Kasse schickt eine Absetzung. Von vor drei Monaten." | Korrekturverfahren-Empfehlung Frage 3, 4, 7 · llms.txt Key features 4 | Taslak | |
| 01-19 | Post | wissen | Ortak | „Was ändert sich am 1. Februar 2027?" | Anlage 3 TP5 V22 · Anhang 03 V10 · wissensbank/INDEX.md | Taslak | |
| 01-20 | Video 10 sn | Teaser | Ortak | „Neue Praxissoftware? Ein Code." | llms.txt → Deployment | Taslak | |

Dönem 2 dağılımı: 16 video + 15 post · Physio 3 · Ergo 3 · Logo 3 · Podologie 4 · Ortak 18.

### Şablon örnekleri (`_muster/`, yayına girmez)
| No | Format | Hook |
|---|---|---|
| P1 | Post · wissen | „Die Verordnung hat ein Verfallsdatum." |
| P2 | Post · haltung | „Ihre Patientendaten gehören Ihrer Praxis. Nicht uns." |
| P3 | Post · liste | „Was Praxura im Praxisalltag übernimmt." (podoloji listesi, genele uyarlanmalı) |
| P4 | Post · mythos | „Ohne Abrechnungszentrum geht es nicht?" |

## Kayıt notları

- **20.10.2026:** Kurallar yazıldı. Hedef kitle bütün Heilmittel praxisleri, dördü de hazır gibi anlatılıyor. Ürün anlatımında fiyat ve detay yok, merak var. Formatlar serbest; değişmeyen kurallar A2'de. Numaralandırma `AA-GG` = yayın günü. `10-20` ilk içerik. Ses kararı bekliyor (sonra kapandı, aşağıya bak).
- **20.10.2026:** 28 gün kuralının kaynağı düzeltildi: HeilM-RL **§ 15** Abs. 1 (önce yanlışlıkla § 16 yazılmıştı; § 16 Abs. 4 = 14 günden uzun kesinti). Bir üretici ajan fark etti.
- **20.10.2026 (gece):** 10-21 → 12-20 arası 61 içerik 15 üretici ajanla yazıldı (ajan başına 4 gün). Rate limit yüzünden 14 ajan yarıda kaldı, sonra kaldıkları yerden devam etti. Konu değişen günler: 11-20 („Zertifikat abrechenbar" belgelenemedi → „nur mit Weiterbildung"), 12-11 (3 → 4 madde, kaynak öyle diyor), 11-19 (hook düzeltildi: Zuzahlung kanıtla geri istenebilir). Ana oturum kontrolü: yasak kelime ve fiyat taraması temiz; 12-12'den kurulum süresi rakamı çıkarıldı (A3).
- **20.10.2026:** Ses kararı Kemal'den: "parçaları da sen seç, hallet". Hazır kütüphane yerine üç parçayı kendimiz besteledik (telif yok). 31 videoya eklendi, sessiz kopyalar duruyor.
- **20.10.2026:** Dönem 2 (12-21 → 01-20, 31 içerik) 8 ajanla üretildi; rate limit sonrası devam edildi. Konu değişen günler: 01-01 („Befreiung pro Kalenderjahr" wissensbank'ta yok → Jahreswechsel-Status), 01-02 (HPNR 2027 henüz yok → numaranın ilk hanesi), 01-11 (Kombination + Einzelmaßnahme). Ana oturum: 01-12'nin cevabı 01-14'e teaser yapıldı (aynı espri iki gün arayla tekrar etmesin). Tarama temiz.
- **20.10.2026:** Otomatik yayıncı yazıldı (`sosyal/yayinci/`): merkez VPS'te Docker, yalnız giden bağlantı, n8n yok (G8). Instagram (Reel/görsel/carousel) + Facebook sayfası, Telegram önizleme ve komutları (/stopp, /pause, /status), stok uyarısı. 13 test geçiyor. Bekleyen: Kemal'in Meta + Telegram hesap kurulumu (KURULUM.md §1–4), sonra Claude yükler.
- **20.10.2026:** Yayıncı merkez VPS'e kuruldu. Merkezde Docker yok, servisler systemd ile çalışıyor; aynı kalıp uygulandı (kullanıcı `sosyal`, `/etc/praxura-sosyal/sosyal.env`, `/var/lib/praxura-sosyal`, MemoryMax 160M). Token yokken deneme modunda. n8n sunucusu önerisi reddedildi: SaaS VPS kapanacak (K1), G8.
