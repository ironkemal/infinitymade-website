# Konsey Kararı — Belge/Vorlage yazdırma zinciri
Tarih: 2026-08-12 · Oturan üyeler: legal-de, gkv-302, podoloji, muhalif, deger-mi
Kör nokta turu: **çalıştırıldı** (podoloji ↔ muhalif, madde 4 çelişkisi) — iki üye de pozisyon değiştirdi.

## KARAR

Belge zinciri **üç kovaya** ayrılır ve bu turda yalnız **Kova 1** uygulanır.

**Kova 1 — "Yanlış bilgi" sınıfı (bu tur, tek commit):**
Sahte sabit IBAN (`DE89 … Musterbank`) **iki yerden birden** silinir ve banka satırı
`profiles.iban/bic/bank_name`'den kurulur. Boşsa **uydurulmaz ve boş da basılmaz** — fatura
niteliğindeki belgeler için yazdırma **bloklanır**, kullanıcıya "Bankdaten in Einstellungen
hinterlegen" yönlendirmesi verilir. Profil select'ine `steuernummer, ust_id, iban, bic,
bank_name` eklenir; footer'da `steuernummer` **veya** `ust_id`'den dolu olan basılır, ikisi de
yoksa yazdırma bloklanır (§14 Abs. 4 Nr. 2 — ikisinden biri yeter, Kleinunternehmer'de de
Steuernummer zorunlu). `abrechnungscode: '22'` sabiti üç çağrı yerinde sector helper'ına
bağlanır (podoloji `'71'`, repoda doğrulandı). `rechnung_eigenanteil` tipi Eigenanteil hesabı
yazılana kadar **yazdırma menüsünden kaldırılır** (bugün tam tutarı basıyor = hastadan fazla
talep). Rezeptvorderseite çıktısına sabit **"Kopie — nicht zur Vorlage bei der Krankenkasse"**
damgası eklenir (buton kalır). Şablon başlıkları ve seans fallback metni Fachbereich'ten
türetilir. `rechnung_ausfall` seed listesine eklenir (panel 8 → 9 kart).

**Kova 2 — Fortlaufende Nummer (ayrı iş, aynı hafta):** tenant başına sayaç, atomik tahsis
(`UPDATE … RETURNING`), PDF üretiminden **önce** tahsis, tahsis edilen numara kaydedilir
(GoBD Unveränderbarkeit — bugünkü "her tıkta yeniden üret" yaklaşımı denetimde zayıf).
Nummernkreis tip+yıl bazlı (`RE-2026-PR-00001`) meşrudur, yıllık sıfırlama meşrudur.
Kova 1'in bloklaması bu arada zaten geçersiz fatura basılmasını engeller.

**Kova 3 — Ops-Dashboard/Teknik:** podoloji `verordnungen` havuzuna **salt-render** yazdırma
(Behandlung→Rechnung köprüsü Faz 3'te kalır, 2026-08-10 kararı bozulmaz) · Vorlagen panelindeki
mock önizlemenin gerçek şablonla birleştirilmesi · Muster 13 koordinat hizalama **yapılmayacak**.

**Logo:** Einstellungen'e gerçek dosya yükleme + kırpma gelir; mevcut çalışan Cropper modalı ve
`avatars` bucket'ı yeniden kullanılır (**G8 temiz — yeni bucket, yeni CDN script'i yok**).
Varsayılan kırpma **serbest oran**, daire bir **preset seçenek** olarak sunulur.

## Gerekçe

`legal-de` (sert veto sahibi) sahte IBAN'ı "yanıltıcı ödeme talebi", eksik Steuernummer'ı
§14 Abs. 4 Nr. 2 ihlali saydı ve fatura/makbuz ayrımıyla hard-block istedi; `gkv-302` (sert veto
sahibi) gelir kaybı sırasını IBAN → Eigenanteil → `abrechnungscode` olarak verdi. İkisi de aynı
küçük çekirdeği işaret ettiği için Kova 1 bu üç maddenin etrafında kuruldu. `muhalif`'in
"IBAN'ı boş bırakmak belirtiyi kırmızıdan griye çevirir" itirazı belirleyici oldu: kullanıcının
"boş göstersin" isteği, **fatura** belgelerinde bloklamaya çevrildi. Kova 2'de `deger-mi`
ertelemek istedi, `muhalif` + `legal-de` ertelemenin daha pahalı olduğunu söyledi — chairman
`legal-de`'nin ağırlığıyla Kova 2'yi aynı haftaya aldı ama ayrı işe böldü (migration + şema
tazeleme + kalıcılık, Kova 1'in içine sıkıştırılamaz).

## Ödün verilenler

- Kullanıcının açık isteği "IBAN yoksa boş göstersin" **uygulanmıyor**; fatura tiplerinde
  yazdırma bloklanıyor. Boş banka satırlı fatura = hasta parayı nereye yollayacağını bilmiyor.
- Kullanıcının açık isteği "dairesel kırpma" **varsayılan değil**, preset. Üç üye bağımsız olarak
  daire varsayılanının Wortmarke'yi keseceğini söyledi.
- `rechnung_eigenanteil` geçici olarak kayboluyor — bugün onu kullanan varsa akışı kesilir.
- Podolog bu turda hâlâ hiçbir belge basamıyor (Kova 3).
- Vorlagen paneli hâlâ WYSIWYG değil.
- Kova 1 sonrası basılan faturaların numarası hâlâ fortlaufend değil (Kova 2'ye kadar).

## Uzlaşma

- Sahte IBAN derhal gider — beş üyenin tamamı.
- `abrechnungscode: '22'` sabiti podolojide sessiz yanlış fiyat üretiyor — gkv-302, muhalif.
- Muster 13 koordinat hizalama yapılmamalı; damga yeterli — legal-de, gkv-302, deger-mi.
- Dairesel kırpma varsayılan olmamalı — podoloji, muhalif, deger-mi.

## Anlaşmazlık

- **Fortlaufende Nummer zamanlaması:** `deger-mi` "ilk gerçek fatura kesilene kadar ertele";
  `muhalif` + `legal-de` "her gecikme kırık seri üretir". Chairman `legal-de` lehine karar verdi,
  ama ayrı iş paketine böldü.
- **`legal-de` "Quittung serbest" dedi**, ancak koddan doğrulandı ki `quittung_zuzahlung` tipi
  gerçekte Fälligkeit + banka satırı olan bir **Rechnung** basıyor. Chairman notu: bu tip fatura
  kovasına alındı. `legal-de`'nin muafiyeti yalnız `rzg_quittung` için geçerli.

## Kör noktalar

- `podoloji` sahte IBAN riskini hiç görmemişti ("tık ekonomisi gözlüğünün altında kaldı").
- `muhalif` 2026-08-10 kararının kapsamını yanlış hatırladı: kapatılan şey Behandlung→**Rechnung**
  köprüsüydü, Quittung o kapının içinde değil — itirazını geri çekti.
- `legal-de`: §33 UStDV **Kleinbetragsrechnung** (≤250 € brüt) kaçış kapısı — bu eşikte
  Steuernummer ve fortlaufende Nummer zorunlu değil. Beta faturalarının çoğu buraya düşer, yani
  hard-block kimsenin işini fiilen durdurmaz.
- `legal-de`: §4 Nr. 14 UStG muafiyet notunu **her** belgeye basmak §14c riski (Ausfallgebühr
  Schadensersatz'tır, steuerbar değil). Bu turda not yalnız Rechnung şablonlarında kalır.

## Uygulama — builder'a

- [ ] Sahte IBAN iki çağrı yerinden silinir, banka satırı profilden kurulur — K1
- [ ] Profil select'lerine `steuernummer, ust_id, iban, bic, bank_name` eklenir — K1
- [ ] Fatura tipleri için ön koşul guard'ı (IBAN + Steuernummer/USt-IdNr) + Almanca yönlendirme — K2
- [ ] Banka bölümü şablonlarda koşullu (veri yoksa blok hiç basılmaz) — K1
- [ ] `abrechnungscode` sabiti üç yerde sector helper'ına bağlanır — K2
- [ ] `rechnung_eigenanteil` yazdırma menüsünden ve VALID_TYPES'tan çıkarılır — K1
- [ ] Rezeptvorderseite'ye "Kopie — nicht zur Vorlage bei der Krankenkasse" damgası — K1
- [ ] Şablon başlığı + seans fallback metni Fachbereich'ten türetilir — K2
- [ ] `rechnung_ausfall` seed listesine eklenir — K0
- [ ] Einstellungen'e logo yükleme + kırpma (mevcut Cropper modalı + `avatars` bucket) — K2

## Backlog (karara dahil DEĞİL)

- Podolojiye **nakit tahsilat makbuzu** (Fälligkeit/banka satırı olmayan gerçek Quittung) — bugün
  bu belge tipi hiç yok; `quittung_zuzahlung` bir Rechnung basıyor.
- Steuerberater'a tek soru (~30 dk): Ausfallgebühr ve Selbstzahler-Wellness satırlarında hangi
  USt-Hinweis basılmalı (§14c riski).
- Vorlagen kartına "Beispieldarstellung — tatsächlicher Druck kann abweichen" notu (de/en/tr).
- Onboarding'de banka verisi hiç sorulmuyor — Kova 1'in bloklaması bunu görünür kılacak.

## Sert veto varsa

Yok. `legal-de` ve `gkv-302` 🔧 KOŞULLU verdi; koşulları Kova 1'e yazıldı.

## Yeniden değerlendirme tetiği

- **Kova 3 / podoloji yazdırma:** ilk podolog "belge basamıyorum" dediğinde açılır.
- **Eigenanteil tipi:** Eigenanteil hesabı yazıldığında menüye geri döner.
