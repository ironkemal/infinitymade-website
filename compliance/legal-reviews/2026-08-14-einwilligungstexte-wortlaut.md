# Hukuki Değerlendirme — Dijital hasta onamı METİNLERİ (Wortlaut)
Tarih: 2026-08-14 · Rol: **Auftragsverarbeiter** (metinler bizim şablonumuz, Verantwortlicher praxis'tir)
Rechtsstand doğrulandı: kısmen (BGB/DSGVO/BDSG paragrafları emin; sunucu bölgesi `compliance/VVT.md`'den doğrulandı; §309 Nr. 5 içtihat detayı doğrulanmadı)
İnceleme konusu: `module/einwilligung-texte.js` · sunum: `module/patienten-einwilligung.js`

## Özet

Mekanizma (iki ekran/iki imza, snapshot+hash, IP yok, raster PNG) 2026-08-14 şartlarına **uygun
uygulanmış** — o taraf temiz. Metinlerin kendisi ise **bu haliyle Nausad'ın hastalarına
imzalatılamaz.** İki blocker var: (1) Ekran 1 hastaya, henüz gerçekleşmemiş bir sözlü
Aufklärung'u geçmiş zamanda onaylatıyor — podoloji akışında imza *karşılamada*, Aufklärung
*anamnezde* alınıyor; (2) Ausfallhonorar maddesinde § 309 Nr. 5 lit. b BGB'nin zorunlu
"düşük zarar ispatı saklıdır" cümlesi yok → madde tümüyle unwirksam olur (geltungserhaltende
Reduktion yok), yani para tahsil edilemez. Ekran 2 Art. 13 açısından iyi ama üç yerde
**olgusal olarak yanlış** ("Server in Deutschland", "keine Weitergabe an Dritte", Arztbericht'in
hem yasal yükümlülük hem opt-in gösterilmesi). Hepsi 🟢 bedava metin düzeltmesi; ~2–3 saat
builder işi. Bir de tüm dosya ASCII-transliterasyonla yazılmış ("aufgeklaert", "koennen") —
hastanın gördüğü ve bastığı belge bu; düzeltilmeden gösterilmez.

## Bulgular

| # | Konu | Fundstelle | Sev | Bütçe | Go-Live |
|---|---|---|---|---|---|
| 1 | Ekran 1 gerçekleşmemiş Aufklärung'u onaylatıyor | §§ 630d, 630e, 630h Abs. 2 BGB | 🔴 | 🟢 | blocker |
| 2 | Ausfallhonorar'da Gegenbeweis-cümlesi yok | § 309 Nr. 5 lit. b BGB | 🔴 | 🟢 | blocker |
| 3 | "auf Servern in Deutschland" yanlış (Azure Sweden) | Art. 13 Abs. 1 lit. f DSGVO | 🔴 | 🟢 | blocker |
| 4 | "keine Weitergabe an Dritte" + Arztbericht çelişkisi | Art. 13 Abs. 1 lit. e; § 125 SGB V; § 203 StGB | 🔴 | 🟢 | blocker |
| 5 | Umlaut'suz ASCII metin (hasta belgesi) | Transparenzgebot § 307 Abs. 1 S. 2 BGB (dolaylı) | 🟡 | 🟢 | blocker (itibar) |
| 6 | Art. 13 Abs. 2 lit. e (verme zorunluluğu) yok | Art. 13 Abs. 2 lit. e DSGVO | 🟡 | 🟢 | blocker |
| 7 | DSB kontağı için yer yok | Art. 13 Abs. 1 lit. b DSGVO | 🟡 | 🟢 | blocker (koşullu) |
| 8 | Kurzfassung `text_snapshot`'ta yok | Art. 7 Abs. 1 DSGVO | 🟡 | 🟢 | blocker |
| 9 | Ausfall tutarı değişince `version` sabit kalıyor | Art. 7 Abs. 1 / § 305 BGB | 🟡 | 🟢 | sonra |
| 10 | Vertretung/Betreuer imzası öngörülmemiş | § 630d Abs. 1 S. 2 BGB | 🟡 | 🟢 | metin: şimdi, alan: sonra |
| 11 | `selbstzahler`: "§ 3 Abs. 1 BMV-Ä analog" yanlış Fundstelle | § 630c Abs. 3 BGB | 🔴 | 🟢 | kullanılmadan önce |
| 12 | `foto`: silme vaadi kendi içinde çelişkili | Art. 7 Abs. 3 vs. § 630f Abs. 3 BGB | 🟡 | 🟢 | kullanılmadan önce |
| 13 | Podoloji dili jenerik | — | 🟡 | 🟢 | şimdi (ucuz) |
| 14 | Sürüm bump'ı kod tarafından zorlanmıyor | Art. 7 Abs. 1 DSGVO | 🟡 | 🟢 | sonra |
| 15 | On-prem'de Ekran 2'nin AV cümlesi yanlış olacak | Art. 28 DSGVO | 🟢 | 🟢 | on-prem'de |

---

### Bulgu 1 — Ekran 1 olmamış bir Aufklärung'u onaylatıyor (BLOCKER)

**Rechtslage:** § 630e Abs. 2 BGB — Aufklärung **mündlich**, **durch den Behandelnden**, **rechtzeitig**
olmalı. Formüler bir "Sie wurden aufgeklärt" beyanı BGH içtihadında yalnızca *Indiz*'dir, ispat
değildir; § 630h Abs. 2 BGB ispat yükünü zaten praxis'e verir.

**Praxura'daki durum:** `einwilligung-texte.js:103-111` geçmiş zaman kullanıyor
("Sie wurden mündlich und verständlich ... aufgeklärt ... hatten ausreichend Bedenkzeit").
Ama `konsey/tutanak/2026-08-14-...md:115` ve `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md`'de kilitlenen
akış: **karşılama → onam imzası → anamnez podologla birlikte.** Yani imza anında Aufklärung
henüz olmamıştır. Belge, olmamış bir olayı belgeliyor.

**Risk:** Bir Behandlungsfehler/Aufklärungsrüge davasında karşı taraf bunu gösterip belgenin
tüm ispat değerini düşürür ("praxis matbu beyan imzalatıyor, gerçek görüşmeyi belgelemiyor").
Olasılık düşük, etkisi yüksek. Ayrıca hasta açısından yanıltıcı beyan.

**Tavsiye:** Ekran 1'i **Aufklärung belgesi olmaktan çıkar**; Behandlungsvertrag + ticari
şartlar belgesi olarak konumlandır, Aufklärung'u ileriye dönük anlat ve dokümantasyonu
Anamnese'ye bırak (§ 630f Abs. 2 BGB zaten orada istiyor). Metin aşağıda.

---

### Bulgu 2 — Ausfallhonorar § 309 Nr. 5 lit. b BGB'yi ihlal ediyor (BLOCKER, para kaybettirir)

**Rechtslage:** Metin `profiles` ayarından üretilse de **vorformulierte Vertragsbedingung**tir
(§ 305 Abs. 1 BGB), hasta Verbraucher'dır (§ 310 Abs. 3 BGB) → §§ 307–309 BGB tam uygulanır.
§ 309 Nr. 5 lit. b BGB: pauschalierter Schadensersatz maddesi, **karşı tarafa "hiç zarar
doğmadığı veya zararın esaslı biçimde daha düşük olduğu" ispatını açıkça saklı tutmazsa
geçersizdir.** Geltungserhaltende Reduktion yoktur — madde komple düşer, praxis hiçbir şey
tahsil edemez. § 309 Nr. 5 lit. a: pauschal, olağan akışta beklenen zararı aşamaz.

**Praxura'daki durum:** `einwilligung-texte.js:56-63` — Gegenbeweis cümlesi yok. Ayrıca
`ausfall_mode === 'percent'` ile owner %100 girebilir; ersparte Aufwendungen düşülmemiş.

**Risk:** Abmahnung değil, **doğrudan tahsilat kaybı** — hasta itiraz ederse madde düşer.
Bir de podoloji hastası tipik olarak Zuzahlung düzeyinde tutarlarda tartışır, mahkemeye gitmez;
ama Nausad'ın kâğıt sürümünden daha kötü bir hukuki konuma düşmesi anlamsız. Ucuz düzeltme.

**Tavsiye:** Aşağıdaki metin + owner ayar ekranına "tam seans ücretinin %100'ü aşılmamalı,
ersparte Aufwendungen düşülmeli" uyarısı (UI notu, 🟢).

---

### Bulgu 3 — "auf Servern in Deutschland" olgusal olarak yanlış (BLOCKER)

**Praxura'daki durum:** `einwilligung-texte.js:161`. `compliance/VVT.md:63,102-107`'ye göre
gerçek zincir: Supabase **Frankfurt (DE)**, Hetzner **Falkenstein (DE)**, Vercel **EU + DPF (US
şirketi)**, Microsoft Azure OpenAI **Sweden Central (SE)** — Rezept-OCR bu sonuncudan geçiyor.
Yani "Deutschland" yanlış; doğru ifade "Europäische Union".

**Risk:** Betroffenenanfrage veya bir praxis'in kendi DSB'si bunu 5 dakikada bulur. Yanlış
Art. 13 bilgisi = doğrudan Verstoß, ayrıca satışta güven kaybı (bizim şablonumuz praxis'i
yanlış beyana sokuyor). Ucuz, mazereti yok.

**Tavsiye:** "innerhalb der Europäischen Union (derzeit Deutschland und Schweden)" + Drittland
negatif beyanı. On-prem müşteride bu cümle tamamen değişecek (Bulgu 15).

---

### Bulgu 4 — "keine Weitergabe an Dritte" + Therapiebericht çelişkisi (BLOCKER)

**Praxura'daki durum:** `einwilligung-texte.js:176-178` "Darüber hinaus werden Ihre Daten nicht
an Dritte weitergegeben" — Steuerberater, olası Forderungseinzug ve praxis'in diğer alıcıları
yüzünden mutlak doğru değil. Daha ciddisi: aynı ekranda **Empfänger** paragrafı Arzt'a
Rückmeldung'u *yasal yükümlülük* olarak anlatırken, `optionen[1]` (`arztkommunikation`,
`:218-222`) aynı şeyi *varsayılan kapalı opt-in* yapıyor. Hasta kutuyu işaretlemezse
podolog, verordnungsgemäß istenen Therapiebericht'i gönderemez sanır → akış kilitlenir; ya da
gönderir ve kendi belgesine aykırı davranmış olur.

**Rechtslage:** Verordnung'da "Therapiebericht ja" işaretliyse veya Heilmittel-Richtlinie /
§ 125 SGB V çerçeve sözleşmeleri öngörüyorsa bildirim **Vertragspflicht**tir; Art. 6 Abs. 1
lit. b/c + Art. 9 Abs. 2 lit. h üzerinden meşrudur, ayrı rıza gerekmez. § 203 StGB açısından
befugte Offenbarung'dur. **Bunun ötesindeki** iletişim (ör. DFS bulgusunun Hausarzt'a
verordnungsdan bağımsız bildirilmesi) rıza + Schweigepflichtentbindung ister.

**Tavsiye:** İkisini ayır — zorunlu Rückmeldung Empfänger paragrafında kalır, opt-in yalnızca
"darüber hinausgehende" bildirime daralır. Ayrıca Inkasso/Factoring'i varsayılan alıcı yapma:
Berufsgeheimnisträger'ın alacağını devri hasta rızası ister; metinde açıkça "nur mit Ihrer
gesonderten Einwilligung" yaz.

---

### Bulgu 5 — Umlaut'suz metin

`einwilligung-texte.js` baştan sona ASCII transliterasyonu: "aufgeklaert", "muendlich",
"spaetestens", "Loeschung", "Ausfallgebuehr". Dosya UTF-8, komşu modül
(`patienten-einwilligung.js`) umlaut kullanıyor — teknik engel yok. Hastanın tablette okuduğu
ve `text_snapshot` olarak 10 yıl saklanan/basılan belge budur. Hukuki geçersizlik sebebi değil
ama Transparenzgebot tartışmasında gereksiz yem, ve Nausad'ın hastasına verdiği ilk izlenim.
**Tüm dosya umlaut'lu yazılmalı** (kod yorumları serbest).

---

### Bulgu 6/7 — Art. 13 eksikleri

- **Art. 13 Abs. 2 lit. e** (verilerin verilmesinin zorunlu olup olmadığı + vermemenin sonucu)
  hiç yok. Bir paragraf ekleniyor (aşağıda).
- **Art. 13 Abs. 1 lit. b** — praxis'in DSB'si varsa iletişim bilgisi zorunlu. Tek kişilik
  podoloji praxisi çoğunlukla DSB atamak zorunda değil (Art. 37 Abs. 1 lit. c "umfangreich"
  eşiği; ErwG 91 tek hekimi açıkça dışarıda bırakır; § 38 Abs. 1 BDSG 20 kişi eşiği). Ama
  **varsayılamaz** → `{{datenschutzbeauftragter}}` opsiyonel yer tutucusu eklenmeli.
  ⚠️ `ersetze()` (`:290-295`) boş değerde `[key]` basıyor — opsiyonel yer tutucular boşken
  **boş** render edilmeli, yoksa hastanın belgesinde `[datenschutzbeauftragter]` yazar.
- **Art. 22** — otomatik karar yok; ayrıca KI-OCR için tek cümlelik şeffaflık ucuz ve satışta
  işe yarar (AI Act Art. 50 burada tetiklenmiyor; hasta ile etkileşen bir AI sistemi değil).

### Bulgu 8 — `Kurzfassung` imzalanan metinde yok

`renderEinwilligungText()` (`:329-346`) sadece `kopf` + `absätze` üretiyor. Hastanın ekranda
**büyük puntoyla ve gerçekten okuyarak** gördüğü şey ise `kurzfassung`
(`patienten-einwilligung.js:196-202`); Volltext katlanmış `<details>` içinde. Art. 7 Abs. 1
Nachweis "hastaya tam olarak ne beyan edildiği"ni ister → görsel olarak baskın blok snapshot'ta
olmalı. Ayrıca kurzfassung ileride Volltext'le çelişirse hiçbir iz kalmaz.
**Çözüm:** `kopf`'tan sonra `Kurzfassung` başlıklı blok olarak snapshot'a dahil et.

Ek not: `<details>` katlı sunum § 305 Abs. 2 Nr. 2 BGB (zumutbare Kenntnisnahme) için
**yeterlidir** (açıkça etiketli, imzadan önce erişilebilir). Ama **Ausfallhonorar paragrafı
para meselesi** — onu ekran 1'de katlamadan, açıkta göstermeyi öneriyorum (🟢, sürpriz-madde
tartışmasını tamamen kapatır).

### Bulgu 9 — Ausfall tutarı `version`'a girmiyor

`ausfallRegelText()` canlı `profiles.ausfall_*`'tan üretiliyor; owner 20 €'yu 40 €'ya çekerse
metin değişir ama `text_version` hâlâ `behandlungsvertrag-v1-2026-08-14`'tür. Eski imzalar
snapshot sayesinde **geçerli ve doğru** kalır (hukuken sorun yok), ama iki pratik sonuç:
(a) aynı sürüm etiketi altında farklı içerikler dolaşır, (b) **eski hastalar yeni tutarla
bağlı değildir** — praxis bunu bilmezse tahsil edemeyeceği tutarı faturalandırır.
**Öneri (sonra):** liste satırında (`patienten-einwilligung.js:508-512`) Ausfall tutarını da
göster; owner ausfall ayarını değiştirdiğinde "mevcut onamlar eski tutarı içeriyor" uyarısı.

### Bulgu 10 — Vertretung / Betreuung

Kabul testi hastası 74 yaşında. `signed_name` (`patienten-einwilligung.js:322`) otomatik
hastanın adıyla dolduruluyor; Betreuer/Bevollmächtigter imzalarsa kayıt **olgusal olarak
yanlış** olur. § 630d Abs. 1 S. 2 BGB einwilligungsunfähig hastada yetkilinin rızasını ister.
Go-live için metne bir cümle yeterli; ayrı "Unterzeichnende Person" alanı sonraya bırakılabilir.

### Bulgu 11/12 — Henüz canlıda olmayan iki metin

- `selbstzahler` (`:245`): **"§ 3 Abs. 1 BMV-Ä analog"** — BMV-Ä hekimlerin çerçeve
  sözleşmesidir, Heilmittelerbringer'a uygulanmaz; "analog" atfı hasta belgesinde yanlış
  Fundstelle'dir, silinmeli. Ayrıca § 630c Abs. 3 BGB **tutarın Textform'da önceden
  bildirilmesini** ister — metinde tutar yok. Yer tutucu eklenmeden bu metin kullanılamaz.
  (`FLOW` bugün sadece iki tip içeriyor, ama `openEinwilligungFlow({types})` ile çağrılabilir.)
- `foto` (`:279-280`): "Widerruf → Aufnahmen werden gelöscht, soweit keine Aufbewahrungspflicht
  entgegensteht" — Behandlungsdokumentasyonunda aufbewahrungspflicht pratikte **her zaman**
  vardır, yani vaat neredeyse hiç yerine gelmez. Yanıltıcı; dürüst formülasyon aşağıda.

### Bulgu 13 — Podoloji dili

Ekran 1 jenerik. `Mitwirkung` paragrafı Diabetes/Marcumar sorduğu için physio kopyası değil,
ama eksik olan: **GKV podologische Komplexbehandlung ile kosmetische Fußpflege ayrımı**
(farklı ödeyici, farklı KDV rejimi — `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md`), ve **açık
yara/enflamasyonda ärztliche Abklärung** notu. İkisi de tek paragrafla çözülür.
DFS/Wagner düzeyinde tıbbi Aufklärung metne **konmamalı** — o sözlü ve Anamnese'ye belgelenir
(hem Bulgu 1'in çözümü bu, hem de şablona tıbbi içerik koymak MDR tartışmasına gereksiz kapı
aralar; MDCG 2019-11 eşiği aşılmıyor ama hiç açmamak daha ucuz).

### Bulgu 14 — Sürümleme (soru 4'ün cevabı)

Biçim `<typ>-v<N>-<YYYY-MM-DD>` **doğru ve yeterli**. Kod davranışı da doğru:
- Eski imzalar `text_snapshot` + `text_sha256` sayesinde sürümden bağımsız geçerli kalır
  (ErwG 171 anlamında da: eski rıza, koşulları sağlıyorsa geçerliliğini korur) → **yeni sürüm
  geriye dönük yeniden imza gerektirmez.** ✅
- Yeni imza otomatik olarak yeni sürümü alır. ✅
- DB `trg_patient_consents_immutable` + 10 yıl silme engeli ✅ (şart 3 ve 6 karşılanıyor).

**Eksik:** sürüm bump'ını hiçbir şey zorlamıyor. Biri metni düzeltip `version`'ı unutursa iki
farklı içerik aynı etiketle dolaşır. Ucuz kapı: her tanımın kanonik hash'ini bir teste sabitle
(`einwilligung-texte.test.js`), metin değişip sürüm değişmezse test kırılsın. 🟢, ~30 dk.

**Bu tur için:** `patient_consents`'ta gerçek hasta imzası **yoksa** metinleri `v1` etiketiyle
düzeltmek yeterlidir (tarih suffix'i güncellenir). Test imzası bile varsa → `v2`.

### Bulgu 15 — On-prem'de Ekran 2 değişecek

"deren Anbieter verarbeitet Ihre Daten ... als Auftragsverarbeiter (Art. 28 DSGVO)" cümlesi
on-prem kurulumda **yanlış** olur (o modelde rolümüz yok). `ONPREM_MIGRATION_PLAYBOOK.md` K6/K10
ile tutarlı kalması için on-prem'de ayrı sürüm gerekir. Şimdi aksiyon yok, sürüm kuralı bunu
zaten taşıyor — geçiş kontrol listesine bir satır.

---

## KARAR

| Metin | Karar |
|---|---|
| **Ekran 1 — Behandlungsvertrag + Ausfallregelung** | 🔧 **Bulgu 1, 2, 5, 8, 10, 13 düzeltilirse kullanılabilir.** Bugünkü haliyle ⛔ (Aufklärung beyanı gerçeğe aykırı, Ausfall maddesi unwirksam). |
| **Ekran 2 — Datenschutz-Einwilligung** | 🔧 **Bulgu 3, 4, 5, 6, 7, 8 düzeltilirse kullanılabilir.** Yapı, Koppelungsverbot ayrımı ve opt-in tasarımı doğru; kusurlar olgusal/eksiklik düzeyinde. |
| `selbstzahler` | ⛔ kullanılmadan önce Bulgu 11 (yanlış Fundstelle + tutar yer tutucusu) |
| `foto` | 🔧 Bulgu 12 |

Sorulan soruların doğrudan cevapları:
1. **Yeterli mi?** Ekran 2 Art. 13 unsurlarının çoğunu içeriyor (Verantwortlicher, amaç,
   Rechtsgrundlage, Empfänger, Speicherdauer, haklar, Art. 77, Widerruf'un ileriye etkili
   olduğu ✅). Eksik: Abs. 2 lit. e, DSB kontağı, Drittland beyanının doğruluğu, Art. 22 notu.
   Ekran 1 § 630d/630e'yi **karşılamıyor** — ama karşılaması da gerekmiyor: doğru çözüm onu
   Aufklärung belgesi olmaktan çıkarmak.
2. **Fazlalık/yanıltıcı?** Evet: "nicht an Dritte" (Bulgu 4), "Server in Deutschland" (3),
   foto silme vaadi (12), Aufklärung geçmiş zamanı (1). **Koppelungsverbot'a yaklaşan cümle
   YOK** — aksine ekran 2 açıkça "Behandlung hängt nicht davon ab" diyor, bu iyi yazılmış.
   **Ausfallgebühr'ün ekran 1'de olması doğru** — ticari sözleşme şartıdır, Art. 7 rızası
   değildir; ekran 2'ye konsaydı asıl Koppelung riski o olurdu.
3. **Podoloji:** kısmen; Mitwirkung podolojiye uygun, gerisi jenerik → Bulgu 13. DFS'e özel
   tıbbi Aufklärung metne konmamalı.
4. **Sürümleme:** biçim ve kod davranışı doğru; eski imzalar geçerli kalır, yeni sürüm yeni
   imza gerektirmez. Eksik: bump zorlaması (14) ve Ausfall tutarının sürüme girmemesi (9).
5. **Dil:** Kurzfassung bloklarının seviyesi iyi (74 yaşında hasta için uygun). Volltext
   kabul edilebilir; tek gerçek problem umlaut'suzluk. § 305c Abs. 1 überraschende Klausel
   riski yok — Ausfallhonorar hem başlıkta hem Kurzfassung'da duyuruluyor.

---

## Somut metin önerileri (builder doğrudan koyabilir — hepsi umlaut'lu)

> Kural: aşağıdaki tüm dosyada `ae/oe/ue/ss` transliterasyonu **umlaut'a** çevrilir.

### E1 · `behandlungsvertrag.kurzfassung` — tamamen değiştir

```
'Sie beauftragen {{praxis_name}} mit Ihrer podologischen Behandlung.',
'Über Ablauf, Nutzen und Risiken sprechen wir persönlich mit Ihnen, bevor die Behandlung beginnt.',
'Sie können Ihre Einwilligung in die Behandlung jederzeit widerrufen.',
'Termine bitte rechtzeitig absagen — sonst kann ein Ausfallhonorar anfallen.',
```

### E2 · `behandlungsvertrag` — "Aufklärung und Einwilligung" paragrafını değiştir

```
Vor Beginn der Behandlung klärt die Sie behandelnde Fachkraft Sie in einem persönlichen
Gespräch verständlich über Art, Umfang, Durchführung, zu erwartende Folgen und Risiken der
vorgesehenen Maßnahmen sowie über Alternativen auf. Sie haben dabei Gelegenheit, Fragen zu
stellen. Ihre Einwilligung in die einzelnen Behandlungsmaßnahmen erklären Sie in diesem
Gespräch; das Gespräch wird in Ihrer Patientenakte dokumentiert. Mit dieser Unterschrift
bestätigen Sie den Behandlungsvertrag und die hier genannten Regelungen — nicht den Inhalt
des Aufklärungsgesprächs. Ihre Einwilligung in die Behandlung können Sie jederzeit und ohne
Angabe von Gründen für die Zukunft widerrufen; die Behandlung wird dann nicht fortgesetzt.
Bereits erbrachte Leistungen sind zu vergüten.
```

### E3 · `behandlungsvertrag` — YENİ paragraf, "Behandlungsvertrag"dan sonra

```
Überschrift: Gegenstand der Behandlung
Gegenstand ist die Behandlung Ihrer Füße durch die Praxis. Erfolgt sie aufgrund einer
ärztlichen Verordnung (zum Beispiel podologische Komplexbehandlung, Hornhaut- oder
Nagelbearbeitung), rechnet die Praxis die Leistung mit Ihrer Krankenkasse ab; die gesetzliche
Zuzahlung tragen Sie selbst, soweit Sie nicht befreit sind. Rein kosmetische Fußpflege ist
keine Leistung der gesetzlichen Krankenversicherung und wird Ihnen privat in Rechnung
gestellt. Welche Leistung erbracht wird, wird vorher mit Ihnen besprochen.
```

### E4 · `behandlungsvertrag` — "Mitwirkung" sonuna ekle

```
Bitte zeigen Sie uns offene Wunden, Druckstellen, Rötungen oder Entzündungen an Füßen und
Nägeln. Solche Befunde gehören ärztlich abgeklärt; die podologische Behandlung ersetzt die
ärztliche Untersuchung nicht.
```

### E5 · `ausfallRegelText()` — üretilen metni değiştir (Bulgu 2, ZORUNLU)

```
Termine, die Sie nicht wahrnehmen können, sagen Sie bitte spätestens ${stunden} Stunden vor
Behandlungsbeginn ab. Bei späterer Absage oder Nichterscheinen berechnet die Praxis ein
Ausfallhonorar von ${hoehe}. Grundlage ist diese Vereinbarung zwischen Ihnen und der Praxis;
die Krankenkasse erstattet dieses Honorar nicht. Der Betrag entspricht dem nach dem
gewöhnlichen Lauf der Dinge zu erwartenden Ausfallschaden abzüglich ersparter Aufwendungen.
Ihnen bleibt der Nachweis vorbehalten, dass der Praxis kein Schaden oder ein wesentlich
geringerer Schaden entstanden ist; in diesem Fall entfällt das Ausfallhonorar oder mindert
sich entsprechend. Es entfällt außerdem, wenn Sie aus einem wichtigen Grund absagen
(zum Beispiel akute Erkrankung oder Unfall) oder wenn die Praxis den Termin anderweitig
vergeben konnte.
```

Fallback metni içerik olarak doğru — sadece umlaut'lanır.

### E6 · Her iki metnin sonuna — Vertretung (Bulgu 10)

```
Überschrift: Unterschrift durch eine andere Person
Unterschreibt für Sie eine bevollmächtigte oder gerichtlich bestellte betreuende Person,
gilt diese Erklärung in Ihrem Namen. Name und Vertretungsverhältnis werden von der Praxis in
Ihrer Akte vermerkt.
```

### E7 · `datenschutz` — "Verantwortliche Stelle" tamamen değiştir (Bulgu 3, 7)

```
Verantwortlich für die Verarbeitung Ihrer Daten ist {{praxis_name}}, {{praxis_adresse}},
{{praxis_kontakt}}. {{datenschutzbeauftragter}}Die Praxis setzt die Praxissoftware Praxura
ein; deren Anbieter verarbeitet Ihre Daten ausschließlich weisungsgebunden als
Auftragsverarbeiter (Art. 28 DSGVO). Die Verarbeitung findet auf Servern innerhalb der
Europäischen Union statt (derzeit Deutschland und Schweden). Eine Übermittlung in Länder
außerhalb der EU und des Europäischen Wirtschaftsraums findet nicht statt.
```

`{{datenschutzbeauftragter}}` dolu olduğunda beklenen içerik (praxis girer):
`Datenschutzbeauftragte(r) der Praxis: <Name>, <Kontakt>. ` — boşsa **boş string** render
edilmeli (`ersetze()` bugün `[key]` basıyor, opsiyonel yer tutucular listesi gerekiyor).

### E8 · `datenschutz` — "Zweck und Rechtsgrundlage" son cümlesini genişlet

```
... Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und lit. c in Verbindung mit Art. 9 Abs. 2 lit. h
DSGVO und § 22 Abs. 1 Nr. 1 lit. b BDSG sowie § 630f BGB. Hierfür ist keine Einwilligung
erforderlich — die Behandlung ist von Ihrer Entscheidung auf dieser Seite unabhängig.
```

### E9 · `datenschutz` — "Empfänger" tamamen değiştir (Bulgu 4)

```
Bei gesetzlich Versicherten übermittelt die Praxis die Abrechnungsdaten nach § 302 SGB V an
Ihre Krankenkasse beziehungsweise die von ihr benannte Annahmestelle; dazu ist sie gesetzlich
verpflichtet. Sieht Ihre ärztliche Verordnung einen Therapiebericht vor oder verlangen die
Heilmittel-Richtlinie und die Verträge nach § 125 SGB V eine Rückmeldung an die verordnende
Ärztin oder den verordnenden Arzt, wird diese ebenfalls übermittelt; hierfür ist keine
gesonderte Einwilligung erforderlich. Darüber hinaus gibt die Praxis Ihre Gesundheitsdaten nur
weiter, wenn Sie ausdrücklich einwilligen oder eine gesetzliche Pflicht dazu besteht. Eine
Abtretung offener Forderungen an ein Abrechnungs- oder Inkassounternehmen erfolgt nur mit
Ihrer gesonderten Einwilligung. Alle Beteiligten sind zur Verschwiegenheit verpflichtet
(§ 203 StGB).
```

### E10 · `datenschutz` — "Speicherdauer" sonuna ekle

```
Daten, die allein auf Ihrer Einwilligung beruhen (die freiwilligen Punkte unten), werden
gelöscht, sobald Sie widerrufen oder der Zweck entfällt — soweit keine gesetzliche
Aufbewahrungspflicht entgegensteht.
```

### E11 · `datenschutz` — YENİ paragraf (Art. 13 Abs. 2 lit. e)

```
Überschrift: Sind Sie verpflichtet, Ihre Daten anzugeben?
Ihre Stammdaten, Ihr Versichertenstatus und Ihre gesundheitliche Vorgeschichte werden für den
Behandlungsvertrag und für die Abrechnung benötigt. Ohne diese Angaben kann die Praxis Sie
nicht sicher behandeln und die Leistung nicht mit Ihrer Krankenkasse abrechnen. Für die
freiwilligen Punkte unten gilt das nicht — dort entstehen Ihnen keine Nachteile.
```

### E12 · `datenschutz` — YENİ paragraf (Art. 22 + KI şeffaflığı)

```
Überschrift: Automatisierte Entscheidungen
Eine automatisierte Entscheidungsfindung oder ein Profiling im Sinne von Art. 22 DSGVO findet
nicht statt. Zur Erfassung Ihrer ärztlichen Verordnung kann eine automatische Texterkennung
eingesetzt werden; das Ergebnis wird immer von der Praxis geprüft, bevor es verwendet wird.
```

### E13 · `datenschutz.optionen` — ikisini de değiştir (Bulgu 4)

```
key: 'terminerinnerung'
label: 'Terminerinnerungen per E-Mail oder SMS an mich senden — unverschlüsselt und ohne
        Angaben zu Diagnose oder Behandlung'
text:  'Terminerinnerungen per E-Mail/SMS (unverschlüsselt, ohne Behandlungsangaben)'

key: 'arztkommunikation'
label: 'Über die gesetzlich vorgesehenen Rückmeldungen hinaus darf die Praxis Befunde an meine
        Hausärztin/meinen Hausarzt oder weitere behandelnde Ärztinnen und Ärzte übermitteln
        (zum Beispiel bei diabetischem Fußsyndrom). Insoweit entbinde ich die Praxis von der
        Schweigepflicht.'
text:  'Befundmitteilungen an Haus- oder Fachärzte über die gesetzlich vorgesehenen
        Rückmeldungen hinaus (Schweigepflichtentbindung)'
```

### E14 · `selbstzahler` — iki paragrafı değiştir (Bulgu 11)

```
Gegenstand
Die nachfolgend besprochene Leistung ist keine Leistung der gesetzlichen Krankenversicherung.
Sie wird auf Ihren ausdrücklichen Wunsch erbracht und Ihnen privat in Rechnung gestellt.

Wirtschaftliche Aufklärung (§ 630c Abs. 3 BGB)
Sie wurden vor Beginn der Behandlung darüber informiert, dass die Kosten voraussichtlich nicht
von einem Kostenträger übernommen werden. Die voraussichtlichen Kosten betragen
{{selbstzahler_betrag}}. Diese Information erhalten Sie hiermit in Textform.
```

### E15 · `foto` — "Verwendung" değiştir (Bulgu 12)

```
Die Aufnahmen sind Teil Ihrer Patientenakte und werden wie diese zehn Jahre aufbewahrt
(§ 630f Abs. 3 BGB). Eine Veröffentlichung oder eine Weitergabe zu Werbe-, Schulungs- oder
Forschungszwecken erfolgt nicht. Sie können Ihre Einwilligung jederzeit mit Wirkung für die
Zukunft widerrufen; es werden dann keine weiteren Aufnahmen angefertigt. Bereits vorhandene
Aufnahmen werden gelöscht, soweit sie nicht zur Dokumentation der bereits erfolgten Behandlung
erforderlich sind.
```

---

## Yapılacaklar

**Go-Live için minimum (Nausad hastaya uzatmadan önce) — hepsi 🟢, tahmini 2–3 saat**
- [ ] builder — E1–E15 metin değişiklikleri + tüm dosyanın umlaut'lanması
- [ ] builder — `renderEinwilligungText()` snapshot'ına `Kurzfassung` bloğu ekle (Bulgu 8)
- [ ] builder — `ersetze()` opsiyonel yer tutucular (`datenschutzbeauftragter`, `praxis_kontakt`)
      boşsa `[key]` yerine boş string
- [ ] builder — Ausfall paragrafı ekran 1'de `<details>` dışında, açıkta gösterilsin
- [ ] builder — `praxis_kontakt` (telefon/e-posta) ve `datenschutzbeauftragter` alanlarının
      owner ayarlarından beslenmesi; boşsa onam akışı **uyarı verir** (praxis adresi tek
      başına Art. 13 Abs. 1 lit. a için sınırda)
- [ ] sahibi — `patient_consents`'ta gerçek imza var mı? Varsa sürümler `v2`, yoksa `v1` +
      tarih suffix'i güncellenir
- [ ] sahibi — owner ausfall ayar ekranına UI notu: "tutar bir seansın ücretini aşmamalı"
- [ ] builder — dokunulan hasta-yüzü metinler de/en/tr sözlüğüne (konsey şartı, hasta ekranı
      DE kalır ama personel etiketleri üç dil)

**Sonra (go-live'ı bloklamaz)**
- [ ] `einwilligung-texte.test.js` — tanım hash'i sabitlenir, sürüm bump'ı zorlanır (Bulgu 14)
- [ ] Liste satırında Ausfall tutarı + owner ayarı değişince "eski onamlar eski tutarı içeriyor"
      uyarısı (Bulgu 9)
- [ ] `patient_consents`'a "Unterzeichnende Person / Vertretungsverhältnis" alanı (Bulgu 10)
- [ ] `selbstzahler` için `{{selbstzahler_betrag}}` beslemesi — bu olmadan tip kullanılamaz
- [ ] On-prem sürümü: Ekran 2'de AV cümlesi ve sunucu cümlesi değişir (Bulgu 15) →
      `ONPREM_MIGRATION_PLAYBOOK.md` kontrol listesine bir satır
- [ ] `compliance/VVT.md` V-... (Einwilligungserfassung) kaydı zaten var (`VVT.md:91`) ✅ —
      TOM/DSFA güncellemesi konsey şartı 8 kapsamında ayrıca doğrulanmalı

## Avukat/DSB'ye sorulacaklar (toplam ~1 saat, ~€200–350 🟡 — opsiyonel)

1. Heilmittelerbringer'da Ausfallhonorar pauschal'i: E5'teki Gegenbeweis-cümlesi § 309 Nr. 5
   BGB için yeterli mi; %100'e kadar oran öngörmek lit. a açısından tutulur mu?
2. Karşılamada imzalanan Behandlungsvertrag ile anamnezde sözlü yapılan Aufklärung'un
   § 630f Abs. 2 BGB dokümantasyonu — Anamnese kaydında hangi asgari alanlar aranır?
3. Verordnungsgemäß Therapiebericht için ayrı Schweigepflichtentbindung gerekmediği tespiti
   (E9) doğrulanır mı?

## Sınırlar

- Yalnızca metinleri inceledim; imza/DB/RLS mekanizması bu turun konusu değildi (konseyde
  ayrıca doğrulanmıştı). `patient_consents` kolonlarını ve trigger'ı koddan değil tutanaktan
  aldım.
- § 309 Nr. 5 lit. b'nin lafzı emin; ilgili BGH içtihatlarının güncel durumunu bu turda
  doğrulamadım.
- Sunucu bölgeleri `compliance/VVT.md`'ye dayanıyor; Vercel EU-region ve Azure ZDR sözleşmesi
  belge üzerinden alındı, ayrıca doğrulanmadı.
- Hasta verisi görülmedi; hiçbir gerçek veri bu rapora girmedi.
- Bu bir hukuki tavsiye değildir; yukarıdaki üç soru dışında dış imza gerektiren bir nokta
  görmüyorum.
