# Konsey Kararı — Eş-kurucu (CTO) Aşama-1 belge seti
Tarih: 2026-08-06 · Oturan üyeler: legal-de, muhalif, deger-mi · Kör nokta turu: **açıldı** (legal-de)

> Bağlam kaynağı: `PARTNERSHIP_NOTES.md` (gitignore'lu, PUBLIC repo'ya girmez).
> Bu tutanakta **kişisel/ticari koşul rakamı yazılmaz** — sadece hukuki yapı.

## SORU
Pay devrinden ÖNCE hangi belgeler, hangi biçimde (e-posta onayı mı ıslak imza mı) imzalanmalı;
bu haftaki müşteri görüşmesine eş-kurucu adayının katılabilmesi için asgari ne gerekli?

## KARAR

**İki belge, ikisi de ıslak imza, müşteri görüşmesinden ÖNCE.** Beş ayrı belge yerine iki
belgede birleştirilir; birleştirme ancak tamamı Schriftform (§126 BGB) ile alınırsa geçerlidir
— bu yüzden e-posta onayı yöntemi (müşterilerle kullanılan yöntem) burada **kullanılmaz.**

**Belge 1 — `Vertraulichkeits- und Verpflichtungserklärung`**
NDA (§23 GeschGehG) + Datengeheimnis (§53 BDSG) + §203 Abs. 4 StGB taahhüdü.
Şart: §203 ve §53 **kendi başlıklı ayrı paragraflar** olarak durur (cezai yükümlülük DSGVO
metnine erimemeli); gizlilik **nachvertraglich ve unbefristet**.

**Belge 2 — `Mitarbeits- und Rechteübertragungsvereinbarung`**
İçeriği dört blok:
1. **Rechteübertragung** — ausschließliches, zeitlich/räumlich/inhaltlich unbeschränktes,
   übertragbares ve unterlizenzierbares Nutzungsrecht + Bearbeitungsrecht (§23 UrhG) +
   unbekannte Nutzungsarten (§31a UrhG). Geriye dönük **2026-08-05**'ten geçerli.
2. **Gegenleistung** — devrin karşılığı yazılı olmak zorunda (aşağıdaki cümle). Karşılıksız
   ausschließliche Rechteübertragung §32 UrhG'ye açık ve §31 Abs. 5 UrhG (Zweckübertragungslehre)
   kapsamı daraltır.
3. **Probezeit + ausdrücklicher GbR-Ausschluss** — "bis dahin entsteht keine Gesellschaft".
   ⚠️ Bu madde bu kurgunun **en kritik cümlesi**, aşağıdaki olgu yüzünden.
4. **Zugriffsregelung** — "kein Zugriff auf Produktivdaten, nur Testdaten"; VVT/TOM'a tek satır.

**Gegenleistung cümlesi (legal-de taslağı, rakam boş):**
> „Als Gegenleistung für die Einräumung der ausschließlichen, zeitlich, räumlich und inhaltlich
> unbeschränkten Nutzungsrechte an sämtlichen Arbeitsergebnissen – einschließlich der Rechte für
> unbekannte Nutzungsarten (§ 31a UrhG) und zur Bearbeitung, Vervielfältigung, Verbreitung,
> öffentlichen Zugänglichmachung sowie Übertragung an Dritte – erhält [Partner] die im Oktober 2026
> zu begründende Beteiligung. Kommt diese bis zum 31.12.2026 nicht zustande, steht ihm eine
> einmalige Vergütung von … EUR brutto zu; die Rechte verbleiben in beiden Fällen unwiderruflich
> bei InfinityMade. Die Parteien halten diese Vergütung für angemessen i. S. d. § 32 UrhG."

**Belge 3 — bağlayıcı DEĞİL, ama aynı gün verilir: 1 sayfa `Term Sheet`.**
Hedef pay oranı, Ekim tarihi, roller, vesting mantığı (4 yıl / 12 ay cliff / geriye dönük
2026-08-05), leaver mantığı. Amacı hukuki değil **ilişkiseldir**: karşı taraf da bir şey alır.
Rakamlar `PARTNERSHIP_NOTES.md`'de kalır.

**Müşteri görüşmesi — asgari koşullar:**
- Belge 1 + Belge 2 imzalı olacak (görüşmeden önce)
- Katılımcı **eigenes Personal / Erfüllungsgehilfe** olarak tanıtılır → ayrı AVV-Unterauftrag
  ve müşteriden ayrı izin **gerekmez**
- Ama praksiste ekranda/kağıtta hasta verisi görülebileceği için müşteriye **önceden kısa yazılı
  bilgi** (mail) gider: *"… nimmt als vertraulich verpflichteter Mitarbeiter teil."*
- Demo yapılacaksa **Testmandant** üzerinden

**Ertelenen (bilinçli):** gelir/gider paylaşımı, ortağın Kleingewerbe açıp fatura kesmesi,
UG kuruluşu, noter, Steuerberater, sigorta. **Tek istisna:** yukarıdaki cümledeki
"einmalige Vergütung … EUR" rakamı — o bugün konuşulmak zorunda, ertelenemez.

## Gerekçe
`legal-de` belirleyici oldu: karşılıksız IP devri saldırıya açık (§32 UrhG) — bunu ilk turda
`muhalif` yakaladı, kör nokta turunda `legal-de` düzeltti. `deger-mi`'nin "%20 sürüm" çağrısı
belge sayısını beşten ikiye indirdi; `legal-de` birleştirmeyi ancak tamamı ıslak imza olursa
kabul etti. Üç üye de tek noktada hemfikir: **müşteri görüşmesinden önce imza**.

## Yeni olgu — kararı sertleştiren
**InfinityMade = `Einzelunternehmung` (agb.html:39, datenschutz.html:157).**
`PARTNERSHIP_NOTES.md` §2b'de "doğrulanmadı" diye duran madde kapandı. Sonucu:
- Bugün devredilecek **pay yok** — Einzelunternehmen'de Geschäftsanteil diye bir şey yoktur
- Bu yüzden **GbR-Ausschluss cümlesi opsiyonel değil**: yazılı ayrım olmadan fiilî birlikte
  çalışma §705 BGB GbR karinesi doğurur → **her ikisi de kişisel malvarlığıyla sınırsız sorumlu**,
  hasta verisi + §302 işleyen bir üründe kabul edilemez
- UG kuruluşu Ekim'e / eşiğe ertelenebilir, **ama GbR-Ausschluss ertelenemez**

## Ödün verilenler
- E-posta onayı yöntemi (müşterilerde işleyen, hızlı yol) burada kullanılamaz — fiziksel imza
  veya qualifizierte elektronische Signatur (§126a BGB) gerekir
- Fallback rakamı ("kurulmazsa … EUR") bugün konuşulmak zorunda; ertelemek isteniyordu
- Hedef oran Term Sheet'te yazılıyor; `muhalif`'in önerdiği **%10 ESOP havuzu** ancak "önce
  havuz ayrılır, kalan bölünür" formülüyle korunuyor — bu, oranı bugün sabitlemenin bedeli
- UG yok → sınırlı sorumluluk yok; risk bilinçli kabul ediliyor (beta, düşük ciro, öğrenci
  varlığı yok)

## Uzlaşma
- Müşteri görüşmesinden önce gizlilik belgesi imzalı olmalı — üç üye
- IP/Nutzungsrechte devri en pahalı boşluk, kapatması en ucuz iş — üç üye
- UG + noter + Steuerberater şimdi değil — `deger-mi` ve `legal-de` (legal-de: noter yalnız pay
  devri anında)
- Belge yığını ilişkiyi zehirler; sayı azaltılmalı ve karşı tarafa da bir şey verilmeli —
  `muhalif` ve `deger-mi`

## Anlaşmazlık
`legal-de` ilk turda "Datengeheimnis'i NDA'ya eritme, ayrı belge" dedi; `muhalif` 5→2
birleştirme istedi. **Kör nokta turunda çözüldü:** birleştirme kabul, koşulu §203 ve §53'ün
kendi başlıklı ayrı paragraf kalması + tamamının ıslak imza olması.

## Kör noktalar
1. **Karşılıksız IP devri** (`muhalif` → `legal-de` onayladı ve düzeltti). Aşama-1'de devir var
   ama ara dönem için ne ücret ne pay tanımlıydı → §32/§32a UrhG saldırısına açık.
2. **Einzelunternehmen olgusu** (chairman, koda karşı doğrulandı). "Pay Ekim'de" cümlesi
   hukuken boştu; devredilecek pay yok, GbR riski aktif.
3. **Ara dönemin bedeli** (`muhalif`): Ekim'de anlaşma çıkmazsa 3 ayın emeği tanımsız kalıyordu
   — fallback cümlesi bunu kapatıyor.
4. **Başlangıç katkı notu** (`muhalif`): 6 ay sonraki en olası kavga "kim ne kadar katkı yaptı".
   10 satırlık bir başlangıç durumu notu (2026-08-05 itibarıyla ürünün ne olduğu) bunu öldürür.

## Uygulama — builder'a
- [ ] `Vertraulichkeits- und Verpflichtungserklärung` taslağı (DE) — §23 GeschGehG + §53 BDSG
      ayrı paragraf + §203 StGB ayrı paragraf + nachvertraglich/unbefristet — K2
- [ ] `Mitarbeits- und Rechteübertragungsvereinbarung` taslağı (DE) — 4 blok + Gegenleistung
      cümlesi (rakam yeri boş) + ausdrücklicher GbR-Ausschluss — K3
- [ ] 1 sayfa bağlayıcı olmayan Term Sheet (DE) — oran/vesting/roller/leaver; rakamlar
      `PARTNERSHIP_NOTES.md`'den okunur — K2
- [ ] "Ausgangslage 2026-08-05" ekı — o tarihte ürünün ne olduğu (beta canlı, §302 zinciri,
      Stripe LIVE, ilk müşteriler), 10 satır, Term Sheet eki — K1
- [ ] Müşteriye gidecek kısa bilgilendirme maili (DE), görüşmeden önce — K1
- [ ] İmza sonrası: `PARTNERSHIP_NOTES.md` §2b'de şirket formu maddesini **kapat**
      (Einzelunternehmung doğrulandı), §7 erişim checklist'ini başlat — K1
- [ ] VVT/TOM'a tek satır: erişim yetkilisi listesi + "nur Testdaten" — K1

> ⚠️ Üretilen taslaklar `legal-de` çıktısıdır, **avukat metni değildir.** Ekim turunda
> Beteiligungsvertrag ile birlikte tek seferlik avukat kontrolüne verilir (`deger-mi`: avukata
> "incele" değil "şu 3 şablonu onayla" diye paket ver).
> ⛔ Taslaklar `.gitignore`'a alınır — bu depo PUBLIC.

## Backlog (karara dahil DEĞİL)
- UG kuruluşu + noter + Steuerberater → eşik: **5 ödeyen müşteri VEYA ~500 €/ay MRR VEYA
  ilk on-prem/Enterprise sözleşmesi VEYA dış yatırım** — hangisi önce gelirse
- IT-Haftpflicht + Cyber sigorta → eşik: ilk on-prem veya Klinik/Enterprise müşteri
- %10 ESOP havuzu formülünün Beteiligungsvertrag'a taşınması (Ekim)
- Gelir/gider paylaşımı + Kleingewerbe-fatura modeli (Ekim, ayrı konsey)
- Marka: "Praxura" DPMA tescili — ortaklıktan önce, şirket adına
- CTO teknik onboarding paketi → `PARTNERSHIP_NOTES.md` §6 zaten tanımlı, ayrı karar gerekmez

## Sert veto
`legal-de` ⛔: **"Ortak Kleingewerbe faturası kesen bağımsız yüklenici iken §69b UrhG
kendiliğinden çalışmaz — 'sonra hallederiz' seçeneği yok."**
Etrafından dolaşma: IP devri **bugün ıslak imzayla** alınır, ücret/fatura modeli sorusu Ekim'e
bırakılır. İki konu birbirinden ayrılabilir.
