# Konsey Kararı — Lokaler Agent / Hybrid-Architektur für TI & Hardware

Tarih: 2026-08-30 · Oturan üyeler: gkv-302, legal-de, muhalif, deger-mi, fonksiyon-ustasi
(`podoloji` oturmadı — soru mimari, alan değil. Dış göz oturmadı — `agy` bu makinede kurulu değil.)

> Tutanak Almanca: müzakere Almanca yürüdü, alıntılar ve kaynaklar Almanca.

---

## Anlass

Kullanıcı, piyasa araştırmasından bir metin getirdi: modern Arzt-PVS'leri (Doc-Cirrus/inSuite,
epos) "Web-Interface + schlanker lokaler Agent" melez mimarisi kullanıyor; Praxura da kullanmalı mı?
Metin ayrıca KBV-Zertifizierung'u ön koşul olarak sayıyordu.

**İki ön kabul daha müzakereden önce düzeltildi:**

1. **KBV-Zulassung bizi ilgilendirmiyor.** O, Vertragsärzte'nin PVS'i içindir (KVDT, GOÄ, GDT).
   Praxura yalnız Heilmittelerbringer'e hizmet eder; abrechnung §302 SGB V üzerinden yürür.
   Metindeki GDT ve GOÄ de Arztpraxis konusudur.
2. **Frist yanlış kesilmişti.** 01.01.2027 *hekimin* eVO düzenleme yükümlülüğüdür; *bizim*
   kabul yükümlülüğümüz 01.10.2027'dir
   (`blog/telematikinfrastruktur-heilmittelerbringer-2027.html:209`).

---

## KARAR

**Seçenek A. Lokal ajan yazılmayacak — ne localhost köprüsü (B), ne masaüstü sarmalayıcı (C).**
TI ve eGK yolu, praxis ile sertifikalı TIaaS sağlayıcısı arasında **doğrudan sözleşmeyle** kurulur;
Praxura yalnızca sunucu tarafından o sağlayıcının API'siyle konuşur. Bugün kod yazılmaz.
Karar Q1/2027'de partner seçimiyle birlikte kesinleşir; entegrasyon Q2/2027.

**D (On-Prem `api` konteyneri ajan görevini üstlensin) reddedilmedi, park edildi.** Bugünkü
dağıtım topolojisinde çalışmıyor; "Weg C" ürünleşirse yeniden açılır (aşağıya bak).

---

## Gerekçe

Belirleyici olan üç olguydu, üçü de ajan fikrinin **önkoşulunu** çürüttü:

1. **`legal-de`: eHealth-Kartenterminal hiçbir zaman doğrudan adreslenmez** — Konnektor'la
   eşleştirilmiştir, konuşulan onun LAN arayüzüdür. Yani B'nin kendisine biçilen görev yok.
2. **`fonksiyon-ustasi`: metindeki dört işten üçü bizde hiç yok.** Kodda yazıcı yok, tarayıcı yok,
   izlenen klasör yok, lokal dosya yolu yok — yalnızca dağınık on adet `window.print()`.
   Etikettendrucker ve GDT Arztpraxis konularıdır.
3. **`gkv-302`: §302 zinciri sıfır lokal donanıma bağlı.** DTA üretimi sunucuda, PKCS#7 imzası
   zaten tarayıcıda. eVO'nun üç kullanım yolundan ikisi (App-QR, Token-Ausdruck) saf kamera işi —
   tarayıcı bugün yapabiliyor. Yalnız eGK yolu terminal istiyor.

Buna maliyet tarafı eklendi (`deger-mi`): A bugün **0 gün**; B **15–25 gün** yapım + **ayda 1–2 gün
kalıcı bakım**. Belirleyici cümle: *29–49 €/ay fiyatta tek bir destek vakası bir müşterinin yıllık
cirosunu yer.* Üstelik TI, Förderpauschale ile refinanse edildiği için satılabilir bir ek değil,
10/2027'den itibaren beklenen bir hijyen faktörü.

`muhalif` B/C'nin **2026-08-13 ve 2026-08-14 kararlarını kelimesi kelimesine tekrarladığını**
gösterdi: ikinci kod yolu + ikinci oturum modeli + ikinci dağıtım hedefi, üstüne Watchtower'ın
yanına üçüncü bir güncelleme sistemi. Ayrıca **K10 uzaktan erişimi yasaklıyor** — iki kurucu,
bakamadıkları bir binary'yi yabancı Windows makinelerinde desteklerdi.

---

## Ödün verilenler

- **eGK yolu partner bağlanana kadar elle kalır.** Hastanın kart okutmasıyla gelen Stammdaten
  bugünkü gibi yazılır/OCR'dan gelir.
- **Mimari karar fiilen partnere devredildi.** Lokal bileşen gerekip gerekmediğine onun mimarisi
  karar verecek.
- Seçilen partnerin sunucu tarafı API'si **yoksa**, Q2/2027'de bugün yatırılabilecek zaman kaybedilir.
- D park edildiği için "Weg C" (praxis içi makine) ürünleşene kadar en temiz hukuki biçim
  (`legal-de`'nin ilk tercihi: hiçbir ek artefakt, sıfır CRA yükü) elde edilmiyor.

---

## Uzlaşma

- **C'yi beş üyenin hiçbiri savunmadı.** En pahalı biçim, sıfır hukuki kazanç: tek CE beyanı altında
  üç işletim sistemi güncelleme kanalı.
- B bugün yapılmaz (dördü açıkça reddetti, biri "şimdi değil" dedi).
- Bugün karar vermek zorunlu değil; **eşik tanımlamak yeterli.**
- `blog/praxissoftware-vergleich-physiotherapie-2026.html:174` derhal düzeltilmeli (aşağıda).

---

## Anlaşmazlık

**Tek gerçek çelişki D üzerindeydi ve kör nokta turunda ÇÖZÜLDÜ — iki sert veto sahibi de
pozisyonunu değiştirdi:**

| Üye | 1. tur | Kör nokta turundan sonra |
|---|---|---|
| `legal-de` | **D**'yi taşıyor (hukuken en temiz: kutu müşteride, sıfır ek artefakt, sıfır CRA nesnesi) | **D'yi geri çekti, A'ya geçti.** Gerekçe: *"Die Topologie hatte ich übersehen — der Kundenkasten steht im Rechenzentrum und sieht kein Praxis-LAN."* |
| `gkv-302` | **⛔ D** (topolojik: konteyner Hetzner RZ'de, praxis LAN'ında değil) | **⛔'yü kaldırdı.** *"Mein ⛔ auf D war topologisch, nicht fachlich: mit ‚Weg C' als Voraussetzung fällt es."* Şart: §302 zinciri bugünkü gibi kalır, TI yolu sertifikalı partnerde kalır. |

Yani **D üzerinde artık sert veto YOK.** D ölü değil, park edilmiş durumda.

---

## Kör noktalar

1. ★ **Chairman'ın sentezi bir noktada yanlıştı ve `gkv-302` düzeltti.** Chairman, mevcut
   tarayıcı-içi PKCS#7 imzasının eHBA için hazır bir yuva olduğunu, "yalnız anahtar taşıyıcısının
   değişeceğini" yazmıştı. **Yanlış:** `.p12` bir **dosyadır**, eHBA ise **Konnektor arkasındaki bir
   karttır**; QES TIaaS yolundan geçer, node-forge'dan değil. Desen eHBA'ya taşınmıyor.
   (Sonucu değiştirmedi — B zaten reddedilmişti, ama gerekçesi düzeldi.)
2. **On-Prem bugün HTTP üzerinde, Secure Context olmadan çalışıyor.** Kanıt: kamera geri düşüşü
   (`dashboard.html:3722`, `dashboard.js:18252`). Bir localhost köprüsü aynı Mixed-Content /
   Secure-Context koşuluna çarpardı; bunu bugün dikkate alan tek yer `dashboard.js:61-63` (`const API`).
3. **localhost köprüsü tarayıcıdaki *herhangi* bir web sitesinden erişilebilir** (`muhalif`).
   B'nin saldırı yüzeyi budur.
4. **eVO kolonları Temmuz'dan beri hazır ve kullanılmıyor:** `db/SCHEMA.sql:1344-1347`
   (`evo_task_id`, `evo_access_code`, `quelle DEFAULT 'papier'`, `fhir_raw`).
   Kaynak: `TI_READINESS_REPORT.md:50`.
5. **Kodda TI = üç ölü alan.** `dashboard.html:2678` `set-telematik-id` (okunuyor `dashboard.js:12454`,
   kaydediliyor `:13546`/`:13570`/`:13583`, **başka hiçbir yerde kullanılmıyor**) ·
   `db/SCHEMA.sql:1453` `profiles.kim_adresse` · `db/SCHEMA.sql:984` `leads.versichertenstatus`.
   Konnektor / Kartenterminal / SMC-B / eHBA / KIM-Versand / FHIR-Client: **bulunamadı.**
6. **Heilmittel-eVO spec'i final değil** (`TI_READINESS_REPORT.md:31`) — bugün spec'e karşı kod
   yazılamaz. `TI_READINESS_REPORT.md` `CLAUDE.md`'nin "güncel" listesinde **yok**.
7. **Doc-Cirrus/epos karşılaştırması taşımıyor** (`muhalif`): onlar donanımı zaten olan hekimlere
   hizmet ediyor. Bizim beta müşterilerimizin 01.10.2027 öncesi terminali muhtemelen hiç yok —
   bu tek soruyla, sıfır kodla doğrulanabilir.
8. **"Dosyayı indir → kasa portalına yükle → cevabı geri yükle" bir boşluk değil, kurulu ve yaşayan
   akış** (`begleitzettel.template.js:113`/`:179`, `abrechnung.routes.js:880` `/upload-zaa`).
9. ★ **Netzausfall — hiçbir üye sormadı, kullanıcı sordu (30.08.2026, oturumdan sonra).**
   Bugün praxiste internet giderse **her şey durur**: takvim, hasta dosyası, dokümantasyon.
   Depoda **Service Worker yok** (`sw.js` yok, kayıt yok), `navigator.onLine` yok, IndexedDB yok —
   ne önbellek ne yazma kuyruğu. Ama `manifest.json` **var** ve `dashboard.html:17` +
   `attendance.html:12`'den bağlı, `"display": "standalone"` ile: uygulama **kurulabilir görünüyor**,
   app gibi duruyor, yine de netsiz anında ölüyor. En kötü bileşim.
   ⚠️ **On-Prem bunu ÇÖZMÜYOR:** kutu Hetzner RZ'de (§4.1/§4.3), praxis ona aynı internetten ulaşıyor.
   Playbook `:251`'deki *"30 gün internetsiz tam çalışır"* satırı **lisans** koşuludur — kutunun bizim
   lisans sunucumuza ulaşamamasını tolere eder; praxis→kutu bağlantısı hakkında hiçbir şey söylemez.
   **Yalnız "Weg C" (praxis içi makine) ayakta kalır** — LAN çalışmaya devam eder, 30 günlük lisans
   toleransı tam bunun için tasarlanmış.
   ⚠️ **Kararı değiştirmez: B ve C de çözmüyor.** B donanım köprüsüdür, C aynı web kodunun
   sarmalayıcısıdır; ikisinde de ana uygulama uzakta kalır. Ama **Weg C'nin ağırlığını artırır** —
   artık yalnız "Kartenterminal'e erişim" değil, aynı zamanda "kesintiyi atlatan tek biçim".
   İki yol: **küçük** — yalnız bugünün randevu listesini önbelleğe alan Service Worker (günler,
   hiçbir şeyle çakışmaz); **büyük** — gerçek offline-first + yazma kuyruğu + çakışma çözümü,
   ayrı bir proje ve **2026-08-13 "yeniden yazma yok" kararıyla cepheden çakışır.**
10. **Yazdırma için huni yok:** on ayrı `window.print()` çağrısı var, ortak yardımcı yok —
   yazdırma tarafında bir şey değişecekse on yer tek tek elden geçer.

---

## Uygulama — builder'a

Karara ait tek zorunlu iş **bugün kod yazmamak**. Bunun dışındakiler ayrı ve küçük:

- [ ] **⚠️ ÖNCE, karardan bağımsız:** `blog/praxissoftware-vergleich-physiotherapie-2026.html:174`
      "eVO-Annahme, KIM-Postfach, ePA-Anbindung, eHBA-Signatur **eingebaut**" iddiası **yanlış** —
      hiçbiri kurulu değil. `legal-de` §5 UWG diyor, `gkv-302` ayrıca not düştü. — K0
- [ ] `index.html:1971` + `ti-anbindung-heilmittel.html` "heute startklar" ifadesi düzeltilir;
      sertifikalı olan **partnerdir, Praxura değil** (§5 UWG). — K0
- [ ] `TI_READINESS_REPORT.md` `CLAUDE.md`'nin güncel belgeler listesine eklenir. — K0
- [ ] İki TIaaS sağlayıcısına e-posta: *müşteri LAN'ındaki yabancı bir PVS için Konnektor
      endpoint'i sunuyor musunuz?* Cevap ileride A ile "Weg C"yi ayırır. — K0, kod yok

---

## Backlog (karara dahil DEĞİL)

- Etiketler `@page` ile tarayıcı yazdırmasından PDF olarak (1–2 gün, `deger-mi`) — ajan gerektirmez.
- Tarayıcı/cihaz klasörü yerine foto yükleme: altyapı Rezept-OCR için **zaten var**.
- Veri modeli borcu (`muhalif`): iki hasta tablosu, KVNR doğrulaması uyarıyor ama engellemiyor
  (`module/kvnr.js:27-33`), kasa serbest metin. Aynı günler oraya konsa bugünden §302'ye yazar.
- Ölü alanların akıbeti: `set-telematik-id`, `profiles.kim_adresse`.
- Beta-1'e tek soru: praxiste eHealth-Kartenterminal var mı?
- **KIM (30.08.2026 sonradan eklendi).** Kaynak metnin tam hâli geldiğinde tek yeni geçerli madde
  buydu. `TI_READINESS_REPORT.md`: KIM bizim için üç yeni veri kanalından biri (Arzt↔Praxis —
  Rezeptänderung, Therapiebericht, Kostenvoranschlag; Kasse↔Praxis) ve **TI-Pauschale güncel KIM
  sürümü desteğine bağlı.** Kodda tek iz: ölü `profiles.kim_adresse` (`db/SCHEMA.sql:1453`).
  ⚠️ **Kararı değiştirmez:** KIM, sertifikalı KIM-Fachdienst üzerinden S/MIME postadır —
  **sunucu tarafı** kanal, lokal ajan gerektirmez. A'yı destekler.
- **Zero-Knowledge / uçtan uca şifreleme** (kaynak metin §4). Bugün elimizde `lib/phi-encrypt.js`
  ve `leads.versichertennummer_enc` var, ama bu "yalnız müşteri çözebilir" anlamında
  zero-knowledge değil. On-Prem'de soru zaten düşüyor (veri kutudan çıkmıyor). Ayrı konu.

---

## Sert veto durumu

**Kapanışta yürürlükte sert veto YOK.**

- `legal-de` ⛔ (seçenek-üstü, **yürürlükte**): eVO/KVNR/eGK verisi **praxura.de altyapısı üzerinden
  akamaz** — bu §393 SGB V + BSI C5 Typ 2 yükümlülüğünü geri getirir ve **G1**'i kırar.
  **A bu ⛔'yü karşılıyor**, tek şartla: TIaaS sözleşmesi doğrudan praxis ↔ partner arasında olacak,
  veri bizim VPS'imizden geçmeyecek.
- `gkv-302` ⛔ D: **kör nokta turunda kaldırıldı** (yukarıya bak).
- `gkv-302` ⛔ C ve `legal-de`'nin C reddi: **yürürlükte.** C bir daha açılmaz.

---

## Yeniden değerlendirme tetiği

**B (lokal ajan) yalnız şu ikisinden biriyle yeniden açılır:**
(a) seçilen TIaaS partneri **yazılı olarak** sunucu/LAN tarafı API sunmadığını bildirirse — o zaman
dar kapsam: yalnız Kartenterminal, tek işletim sistemi;
(b) üç beta müşterisi etiket yazdırmayı blocker olarak bildirirse.

**D yalnız "Weg C" (praxis içi lokal makine) ürünleşirse açılır** — o zaman TI modülünün
**önkoşulu** olarak fiyatlanır. Bugün Weg C `ONPREM_MIGRATION_PLAYBOOK.md` kapsamı dışındadır.

**Karar penceresi:** 01.10.2027'den geriye — entegrasyon + test ~3 ay → başlangıç Q2/2027 →
**partner seçimi Q1/2027'ye kadar.** Ya da gematik Heilmittel-eVO spec'i finalleşirse, hangisi
önce gelirse.
