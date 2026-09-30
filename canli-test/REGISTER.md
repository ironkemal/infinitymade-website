# canli-test sicili — ekran/fonksiyon beklenen davranış kaydı

> Bu dosya `canli-test` ajanının kalıcı hafızasıdır (kuruldu: 2026-09-19). Cevapladığı
> soru: **"bu ekran/buton/akış NE yapmalı, en son ne zaman doğrulandı, sonuç neydi?"**
> `funktionen/INDEX.json` bir fonksiyonun NE olduğunu ve NEREDE kullanıldığını tutar —
> bu dosya onun **beklenen davranışını** ve **test geçmişini** tutar. İkisi birbirinin
> yerine geçmez, `db/REGISTER.md` (niye) / `db/SCHEMA.sql` (ne) ayrımıyla aynı mantık.

## Bu dosya iki şey yapar

1. **Ekran/fonksiyon kataloğu** (§ Ekran/Fonksiyon kayıtları) — her panel/akış için:
   kullanıcı ne yapar, arayüz ne göstermeli (buton, bildirim, boş durum), hangi diğer
   ekranlarla bağlantılı, en son ne zaman ve hangi sonuçla test edildi.
2. **Bildirilen anomaliler kutusu** (§ Bildirilen anomaliler) — `canli-test` test
   YAPMIYORKEN bile başka bir ajan (`fonksiyon-ustasi`, `db-ustasi`, `builder`,
   `podoloji`, `mobil-ui`) kendi işini yaparken bir arayüz tuhaflığı görürse buraya
   tek satır not düşer. Kendisi düzeltmez, sadece kaydeder. `canli-test` bir sonraki
   test turunda bu kutuyu okur, iddiayı doğrular, gerekirse `builder`'a devreder.

## Nasıl bakımı yapılır

- **Elle tutulur, üretilmez** — `funktionen/INDEX.json` veya `db/SCHEMA.sql` gibi bir
  script çıktısı değil. Tetikleyici cümle yok; her test turunun doğal bir parçası.
- `canli-test` her test turunda: ilgili satır varsa okur ve beklentiyi ona göre kurar,
  turun sonunda tarih + GEÇTİ/KALDI ile günceller. Satır yoksa yeni açar.
- **Domain-doğruluk sorusu buraya `canli-test`'in kendi yargısıyla yazılmaz.** "Bu akış
  bir podolog için mantıklı mı / doğru sırada mı" sorusu önce **`podoloji`** ajanına
  sorulur, cevap buraya not düşülür. `canli-test` kendi başına yalnız **mekanik**
  doğruluğu yargılar: çalışıyor mu, konsol temiz mi, veri sayfa yenilenince de duruyor mu.
- **Otomatik/periyodik çalışma yok** (2026-09-19 kararı) — sadece istendiğinde
  ("şunu test et", "deploy oldu mu bak") çalışır. Sürekli tarama kurulmadı; kontrol
  elde kalsın istendi.
- Bu dosya **public** (depo public) — hasta verisi, gerçek isim, kimlik bilgisi
  **girmez** (bkz. `.claude/agents/canli-test.md` §7). Yalnız ekran/davranış/tarih.

---

## Ekran/Fonksiyon kayıtları

Format — her panel/akış için bir blok:

```
### <panel/akış adı> — nav-registry etiketi: <...>

**Beklenen:** <buton X'e basınca ne olmalı, bildirim ne demeli, hangi alan zorunlu>
**Bağımlı ekranlar:** <bu değişirse hangi başka panel etkilenir — builder §1 katman zinciriyle aynı mantık>
**Son test:** <tarih> — <GEÇTİ / KALDI, kısa not>
```

> İlk kurulumda bilerek boş bırakıldı — 23 panelin tamamını tek seferde doldurmak bir
> okuma iddiası olurdu (`fonksiyon-ustasi`'nin aynı hatayı yapmama gerekçesiyle aynı
> ölçüt, bkz. `.claude/agents/fonksiyon-ustasi.md` §1: "hiçbir model bunu okuyarak
> kapsayamaz"). Kayıt, `canli-test` her test ettiği ekranı burada **biriktirerek**
> dolar — toplu bir denetimle değil.

### Muster-13 Verordnung maskesi (anlegen + ändern) — nav etiketi: `verordnungen`

**Beklenen:** Hasta seçilince kasa/ad/doğum/adres/KVNR/status alanları otomatik dolar.
ICD girilince Diagnosegruppe türetilir ve 28-günlük Behandlungsbeginn tarihi yeniden
hesaplanır. "Speichern" ANLEGEN'de `POST /api/rezept/confirm`, ÄNDERN'de
`PATCH /api/rezept/:id` çağırır (doğrudan Supabase yazımı yok, Ops #289).
İkinci ICD kodu için `#rzIcd2` alanı var (19.09.2026'dan beri); Diagnosegruppe
**birinci** ICD'den türer, ikinci alan onu ezmez.
**Bağımlı ekranlar:** `abrechnung` (§302 preflight), `rechnungen`, `podologie-billing`
**Son test:** 2026-09-19 (ikinci tur, `bdff16f`) — GEÇTİ. İki ICD kodu (E11.74 + I70.24)
elle girildi, kaydedildi, sayfa yenilendikten sonra `icd10` + `icd10_2` ikisi de yerinde;
Diagnosegruppe DF kaldı. Eski "maskede `icd10_2` yok" boşluğu **kapandı**.
⚠️ Yeni bulgu: iki ICD'li bir kayıt listede yanlışlıkla "ICD-10-Kode fehlt" uyarısı
alıyor (aşağıdaki anomali kutusu).

**ICD (`rzIcd`) ↔ Diagnosegruppe (`rzDg`) alan çifti — beklenen (Ops #304, 25.09.2026):**
> Domain kaynağı: `podoloji` (praksis UX) + `gkv-302` (norm: DG **yalnız hekim tarafında**
> değiştirilebilir — Podologie-Vertrag Anlage 3 Ziffer 5 j), ikisi de 25.09.2026'da soruldu.
> Durum: **deploy edildi 25.09.2026 (`a7b1ff3`, canlı `?v=20260925a`) — canlıda HENÜZ TEST EDİLMEDİ** (aşağıdaki 25.09.2026 notu). Yukarıdaki "ICD girilince
> Diagnosegruppe türetilir" cümlesi bu kurallarla daraltılır — türetme yalnız **boş** DG'ye yazar.
> Uyarı satırı: `rzIcdDgWarning`.
- **Boş DG + tek anlamlı ICD** (E11.74, E11.75, G63.2 → DF) → DF otomatik yazılır.
- **L60.0 tek başına** → DG yazılmaz, uyarı: „Passende Diagnosegruppen: UI1, UI2".
- **Çok anlamlı** (E11.74 + L60.0) → DG yazılmaz, uyarıda DF, UI1, UI2 adayları; DF daha
  önce **otomatik** yazılmışsa ICD alanından çıkılınca (blur) geri alınır.
- **26.09.2026'dan beri — iki ICD alanı birlikte sayılır** (`rzIcd` + `rzIcd2`): E11.74 birinci,
  L60.0 ikinci alanda → aynı sonuç (DG yok, DF/UI1/UI2). İkinci alan boşken birinciye iki kod
  yazılırsa („E11.74, L60.0" veya „E11.74 L60.0") alandan çıkınca ikinci kod `rzIcd2`'ye geçer,
  ipucu „2. Code nach ICD 2 übernommen". ≥3 kod / ikinci alan dolu → taşınmaz, ipucu „Mehr als zwei
  ICD-Codes: übertragen werden zwei (je Feld einer) – weitere bitte in den Diagnosetext", kaydederken
  „Trotzdem speichern?" listesinde (sperre YOK — `gkv-302`: 3+ kodlu Verordnung geçerli).
- DG ipucu **yalnız** ICD alanının altında (`rzIcdDgWarning`); Podologie kutusunda „Zulässige
  Diagnosegruppen …" / „… passt nicht zum eingegebenen ICD-Kode" satırı artık **çıkmaz**. „Passt nicht"
  ipucu uygun grupları da sayar. DG elle boşaltılınca otomatik hemen yeniden önerir.
- **Yüklenmiş DG** (Scan übernehmen, Bearbeiten, Folgeverordnung) veya katalogdan seçilmiş /
  alandan çıkılarak kabul edilmiş DG → **asla ezilmez.** ICD uymuyorsa uyarı:
  „Der ICD benennt nicht die für diese Diagnosegruppe geforderte Diagnose: … (DG)".
- DG alanına **seçim yapmadan tıklamak** otomatiği KAPATMAZ. DG alanını boşaltmak →
  otomatik yeniden devrede. Önceki rezeptin ardından yeni rezept açmak → otomatik devrede.
- **Bilinen açık — Soll sapması değil, sonraki adım (L4):** boş DG'de fachfremd (Z99.9) veya
  belirsiz ICD (E11.72/.73) için uyarı **yok**; otomatik yazılan DG'de „aus ICD" işareti **yok**.
  Canlı turda bunlar KALDI diye yazılmaz.

**Canlı tur test senaryoları (kaynak `podoloji`):**
a) boş DG, E11.74 → DF · b) NF'li Verordnung'u Bearbeiten, E11.74 yaz → NF kalır + uyarı ·
c) DG'yi boşalt → DF yeniden yazılır · d) „E11.74, L60.0" birinci alanda → L60.0 ikinci alana geçer, DG yok, adaylar ·
d2) E11.74 → DF, sonra ikinci alana L60.0 → DF geri alınır ·
e) Z99.9 → (bugün uyarı yok, sonraki adım) · f) E11.72 → DF yazılmaz ·
g) Rezept A kaydet, yeni Rezept B'de E11.74 → DF.
Her senaryoda kaydet → **sayfa yenile** → `prescriptions` üzerinde DG gerçekten duruyor mu.

**Canlı tur 2026-09-25 (Ops #304, `c4e5b5f`) — TEST EDİLEMEDİ.**
- Kapı 1 ✅ `/health` 200 · Kapı 2 ✅ `dashboard.html` → `dashboard.js?v=20260925a` →
  `icd-dg-match.js?v=20260925a`, `dgVorschlag` içinde `kandidaten.every(k => k === auto)` canlıda;
  canlı `dashboard.html` / `dashboard.js` / `icd-dg-match.js` commit ile **bayt bayt aynı**
  (Vercel deploy 20:23 UTC tamamlandı, push'tan ~8 dk sonra).
- Kapı 3 ❌ bu makinede (macOS) `playwright-cli` kurulu değil, oturumlu bir tarayıcı profili bu tur için erişilebilir değildi;
  `.env.local`'da `PRAXURA_QA_*` yok. Oturumsuz tarayıcı `login.html`'e düşüyor.
- Senaryolar a · c · d · d2 · f · h · i · b · g · e → hepsi **atlandı (oturum yok)**, hiçbiri
  geçti/kaldı sayılmaz. Talimat gereği bu turda zaten kayıt yapılmayacaktı (maske açılıp
  kaydetmeden kapatılacaktı), yani yukarıdaki "kaydet → yenile" adımı bu tur için geçerli değil.
- Yerine kanıt (canlı değil): `node --test module/icd-dg-vorschlag.test.js` 18/18 geçti — canlıyla
  aynı `icd-dg-match.js` üzerinde. `dgAuto`/blur geri alma kablolaması `dashboard.js`'te, testsiz.
- **26.09.2026:** d/d2'nin canlıdaki kök nedeni bulundu — ikinci DG yazanı `module/verordnung-podo.js`
  `dgAuswahlEingrenzen` DF'yi `dgAuto` işaretsiz yazıyordu; ağda önce o dönerse DF hekim beyanı sayılıp
  hiç geri alınmıyordu (c de etkileniyordu). Artık DG'ye tek yazan `module/icd-dg-verdrahtung.js`;
  Fachbereich maskeden okunur (`praxis` mandantında otomatik susuyordu). Kanıt: `icd-dg-verdrahtung.test.js`
  19/19 + **`tools/browser-probe/icd-dg-probe.mjs` 15/15 — gerçek Muster-13 maskesi, klavye + Tab**
  (a, c, d, d2, f, L60.0 tek, DG'ye tıklama, elle DF).
- **Canlı tur 26.09.2026 (`632d1f0`, oturumlu; sonucu Melih bildirdi):** ✅ ana düzeltme — tek alandaki
  çoklu ICD'nin ikinci alana bölünmesi, d ve d2 — **sorunsuz**. ⚠️ **Doğrulanamadı:** >2 kodda
  kaydederken „Trotzdem speichern?" listesindeki satır. Sebep büyük olasılıkla araç: liste yerel
  `window.confirm()`, tarayıcı otomasyonu diyaloğu okuyamaz/tıklayamaz. Karşılığı: kural
  `icdMehrAlsEinKodeJeFeld` olarak modüle alındı ve testli (`icd-dg-verdrahtung.test.js`, 7 durum);
  `dashboard.js` `saveRezept` yalnız onu çağırır. **Elle kontrol (bir kez, otomasyonsuz):** ilk ICD
  alanına `E11.74, L60.0, G63.2` yaz → Speichern → diyalogda „Hinweise: • Mehr als zwei ICD-Codes: …"
  satırı görünmeli → „Abbrechen".

**Son test (ICD↔DG):** 26.09.2026 canlı (`632d1f0`) — GEÇTİ: bölme, d, d2 (Melih bildirdi).
Açık: >2 kodda „Trotzdem speichern?" satırı (yerel `confirm()`, elle bakılacak — yukarıda).
Yerel: `icd-dg-verdrahtung.test.js` + `tools/browser-probe/icd-dg-probe.mjs` 15/15.

**Patientenkopf — „Patient auswählen" (`#rzPatientSearch` + ipucu `#rzPatientHint`):**
**Beklenen:** Maske **hangi yoldan açılırsa açılsın** hasta listesi yüklenir — (a) listeden bir
Verordnung'a tıklayınca açılan **gömülü** maske, (b) „+ Neue Verordnung" **modalı**. Alanın
altındaki ipucu „N Patienten — tippen zum Suchen" yazar; liste gerçekten boşsa
„⚠ Keine Patienten gefunden — bitte zuerst Patienten anlegen". İsim yazınca eşleşenler listelenir.
Bugün randevusu olan hastada „Heute HH:MM" işareti çıkar ve o hasta listede üste sıralanır —
**yalnız sıralama, otomatik seçim YOK** (Ops #267: Verordnung'da otomatik seçilen hasta
dokümantasyon hatası olurdu).
**Bağımlı:** `patient-suche.js` (`_patientSearchApi.refresh()` — `loaded` latch'i yalnız `force`
ile açılır) · `module/termin-heute.js` (`heuteRang`/`heuteHinweis`) · `module/verordnung-maske.js`
köprüsü (`setzeMaskeBruecke({ladePatienten})`) · `module/rezept-patientenfeld.js:ladePatientenCache`
**Sıra bağlayıcıdır:** önce `rzPatientCache` atanır, **sonra** `refresh()` — `loadLeads` cache'i
senkron okuduğu için ters sırada boş liste latch'lenir. Düzeltmenin kendisi bu sıradır.
**Son test:** 2026-09-27 (`70a5b3f`) — canlı yayımlanan modüllere karşı **GEÇTİ**, ama
**tarayıcıda oturumlu tıklama turu YAPILAMADI** (aşağıdaki nota bak).

**Canlı tur 2026-09-27 (Ops #302 QA-Nachtrag, `70a5b3f`) — KISMİ: mekanik GEÇTİ, oturumlu tur TEST EDİLEMEDİ.**
- Kapı 1 ✅ `/health` 200, `/api/krankenkassen` 200 · Kapı 2 ✅ canlı `dashboard.js` yerelle
  **bayt bayt aynı** (20620 satır), `module/rezept-patientenfeld.js?v=20260927` + 
  `verordnung-maske.js?v=20260927` canlıda 200.
- ⚠️ `dashboard.html`'in `?v=` değeri bump **edilmedi** (`20260926b` kaldı) hâlbuki `dashboard.js`
  değişti. Bu turda **zararsız**: Vercel `cache-control: public, max-age=0, must-revalidate` +
  ETag gönderiyor, yani tarayıcı her açılışta revalidate ediyor. Bulgu sayılmadı, ama kural
  (`?v=YYYYMMDD` tazele) yine de atlanmış — bir sonraki dokunuşta düzelir.
- Kapı 3 ❌ 25.09.2026'nın aynısı: bu makinede `playwright-cli` kurulu değil, oturumlu tarayıcı
  profili yok, `.env.local`'da `PRAXURA_QA_*` yok. **Talimattaki 8 adımlı tıklama turu
  (listeden maske → yaz → modal → yaz, arada reload YOK) koşulmadı** — „geçti" denmiyor.
- Yerine kanıt (canlı **yayımlanan** modüller, `page.route` ile app.praxura.de origin'inde
  sahte tek sayfa; gerçek modüller ağdan, supabase stub, **kunstname** — gerçek hasta verisi
  kullanılmadı):
  - Wurzel 2 (latch/race) **10/10**: alan önce fokuslanıp latch kurulduktan sonra cache
    dolduruluyor → `refresh()` ile eşleşmeler geliyor; ipucu tam „3 Patienten — tippen zum Suchen";
    **karşı-prova**: `refresh()` çağrılmazsa liste boş kalıyor (yani prova hatayı gerçekten görüyor).
    „Heute HH:MM" işareti ve üste sıralama (rang 1 > 0) çalışıyor. Konsol temiz.
  - Wurzel 1 (gömülü maske köprüsü) **5/5**: canlı `maskeEinbetten()` köprüden hem
    `verdrahteToggles` hem `ladePatienten` çağırıyor, doğru sırada (önce alan kablolanır, sonra yüklenir).
  - `node --test module/rezept-patientenfeld.test.js` 2/2 · `npm run test:frontend` **1056/1056** ·
    `verordnung-maske-probe` 33/33 · `modul-probe` 91/91 (iki konsol hatası yerel `/api/config`
    500'ü, ürün hatası değil) · silinen ölü kod `rzLabelToId`'ye canlıda/repoda **sıfır** atıf.
- **Açık kalan (yalnız oturumla görülebilir):** gerçek `bizScope`/`getOwnerId` ile listenin
  gerçekten dolması, ve „Heute" işaretinin gerçek randevu verisiyle görünmesi. Melih'in
  oturumlu turunda bakılacak: adım 3'te ipucu „N Patienten …" mi, adım 6'da (reload YOK) aynı mı.

**Canlı tur 2026-09-28 (Ops #313, `70cb3e9`) — Claude-in-Chrome, oturumlu: KISMİ GEÇTİ.**
- Konu: `rzPodoFelder` bloğu ("Podologische Angaben") artık koşullu — Nagel yalnız UI1/UI2'de
  (zorunlu), Anlass yalnız GKV-olmayan Rezeptart'ta, ikisi de yoksa blok tamamen gizli.
- ✅ Deploy güncel (hard-reload, `dashboard.js?v=20260926b`) · DF seçili: blok tamamen görünmez
  (ne Nagel ne Anlass, boş çerçeve de yok) · UI1 seçili: blok görünür, yalnız "Behandelter
  Zehennagel" (kırmızı *) — Anlass gizli kalıyor · konsol boyunca **hatasız**.
- ❌ **Anlass-görünürlük Privat/Selbstzahler/BG'de DOĞRULANAMADI** — ama kodda hata değil,
  **önceden var olan ayrı bir boşluk**: Muster-13-Maske'de Rezeptart seçici (kassen/privat/
  selbstzahler/bg) hiçbir yerde yok. `module/verordnung-podo.js`'in kendi yorumu (06.09.2026)
  ve `gkv-302` teyidiyle: eski podolojik hızlı yol (`podNew*` alanları, Rezeptart seçici dahil)
  **06.09.2026'da tamamen kaldırıldı**, Muster-13 o günden beri TEK giriş yolu — ama Rezeptart
  anahtarı oraya hiç taşınmadı. Yani üç hafta önce, bu değişiklikten bağımsız olarak, GKV-dışı
  bir Podoloji-Verordnung açma yolu zaten yoktu. `module/verordnung-pruefen-knopf.js`'teki ölü
  `podNew*` referansları (`lesenPodologie()`, `MASKEN.podologie` — hiç çağrılmıyordu) aynı turda
  temizlendi.
- **gkv-302 payı:** §302 için zararsız (privat/selbstzahler/bg zaten §302'ye girmiyor,
  sunucu ayrıca reddediyor). Gerçek boşluk: PKV-Verordnung'lu hasta bugün yalnız `kassen` olarak
  girilebiliyor → `zahlerTyp()` (`module/rezeptinfo-geld.js:87-89`) onu sessizce GKV zuzahlung
  mantığıyla hesaplıyor. **Ayrı P2-ticket, ilk PKV-Verordnung vakasından önce** — bkz.
  `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md` „Podologische Angaben"-Block girişi.
- **Doğrulandı (MCP, 28.09.2026):** Prod'da `bereich='podo'` olan **24** Verordnung'un tamamı
  `rezeptart` NULL (20) veya `kassen` (4) — **sıfır** privat/selbstzahler/bg. Boşluk varsayım
  değil, ölçülmüş: 06.09.2026'dan bu yana açılan HİÇBİR Podoloji-Verordnung GKV-dışı değil.

**Son test:** 2026-09-29 (S3.9 `0418566`; canlı `dashboard.js?v=20260929o`, taze goto) — GEÇTİ. „+ Neue Verordnung" → Nachname alanına sentetik değer, (a) ICD alanı `rzIcd`'ye „E11.7" → `.icd10-dropdown` 5 öneri görünür → **Escape** → öneri listesi 0 görünür öğe, maske açık, `rzIcd`=„E11.7" ve Nachname korunuyor, odak `rzIcd`'de; (b) anomali kutusundaki asıl yol, Heilmittel `rzHm`'ye „780" → „Heilmittel-Vorschläge" listbox (`display:block`, 4 öğe) → **Escape** → listbox `display:none`, maske (`.modal-overlay` flex) açık, `rzHm`=„780" + Nachname korunuyor. Kaydedilmedi (Abbrechen), yeni `prescriptions` satırı yok. 29.09 anomalisi (Escape tüm modalı kapatıyordu) kapandı.
**Son test:** 2026-09-30 (S3.5/S3.6/S3.7, canlı `?v=20260929t`, QA tenant test2) — GEÇTİ. Yeni test Verordnung'u **`06dbeb5c`** (TEST-Hilde, DF, Hausbesuch ja, 3 Einheiten, 1x pro Woche, LANR `123456701` = bilerek yanlış Prüfziffer, BSNR boş, ilk kayıtta Unterschrift yok; ardından Unterschrift işaretlendi). **S3.6:** ICD aramasında „E11.7-“ satırı „nicht endständig“ etiketli; seçilince alan altında „ICD-Code ist nicht endständig. Bitte mit der Verordnung vergleichen — Korrektur nur durch den Arzt (neue Unterschrift + Datum).“ — seçim ve kayıt engellenmedi (uyarı, blok değil). DG otomatik türemedi (elle DF). **S3.7 (maske):** Speichern → `showConfirmModal` „Verordnung speichern?“: leer BSNR + Unterschrift; Hinweise „LANR-Prüfziffer stimmt nicht …“ + „BSNR fehlt — kann vom Arztstempel übernommen werden.“ + Behandlungssperre cümlesi → „Trotzdem speichern“ → `POST /api/rezept/confirm` 200. Unterschrift işaretlenip tekrar kaydedilince aynı dialog yalnız LANR+BSNR uyarısıyla, sperre cümlesi yok → `PATCH /api/rezept/06dbeb5c` 200. **S3.5 (Verordnung tarafı):** her iki kayıtta `window.confirm` çağrısı SIFIR (sarmalayıcı sayacı), dialog uygulama modalı. Yenileme sonrası liste satırı „1-4 · 0/3 · In Behandlung“, ICD `E11.7-`, DG DF, Hausbesuch ✓ duruyor. Gözlemler (P3): (a) BSNR hem „leer“ hem „Hinweis“ listesinde iki kez; (b) kayıtlı non-terminal ICD düzenleme görünümünde yeniden açılınca uyarı gösterilmiyor (yalnız seçim anında — tasarım, preflight kapsıyor); (c) Ausstellungsdatum varsayılanı `new Date().toISOString()` (`dashboard.js:15612`) → 00:00–02:00 Berlin arası DÜNÜN tarihi (00:25'te 29.09 önerdi); (d) yeni Verordnung kaydından hemen sonra liste yeni satırı göstermedi, yalnız sayfa yenileyince geldi (tek gözlem, tekrar sınanmalı).
**Son test:** 2026-09-30 (S3.8a `e665aca` + `d92e422`; canlı `dashboard.js?v=20260930d` = HEAD md5 eşit, backend yeni — PATCH sonrası `krankenkasse_ik` yazıldı, `kostentraeger_ik` sunucuda türetildi; QA tenant test2) — GEÇTİ, bir P1 bulguyla. **Yeni kayıt (+ Neue Verordnung):** Ausstellungsdatum varsayılanı `2026-09-30`; `alsISODatum(new Date('2026-09-29T22:30Z'))` tarayıcıda (Europe/Berlin) `2026-09-30`, eski `toISOString` yolu `2026-09-29` — gece 00–02 hatası kapandı (test saati 07:xx olduğu için doğrudan gözlem değil, modül çağrısıyla). Kasse alanına „DAK" → açılır listede „DAK-Gesundheit DAK · IK 105830016" → seç → IK alanı BOŞ kaldı, ipucu „IK von der Versichertenkarte eintragen (nicht die Kassen-IK aus der Suche)."; IK alanına 100167999 + blur → „Karte 100167999 → Kostenträger DAK (IK 105830016)". Kaydedilmedi. **`06dbeb5c` düzenleme:** Karten-IK boşken Speichern → „Verordnung speichern?" listesinde „IK der Krankenkasse von der Versichertenkarte fehlt — ohne sie kommt die Verordnung nicht in eine Abrechnung." maddesi, blok yok → Trotzdem speichern → `PATCH /api/rezept/06dbeb5c` 200. Sonra DAK + 100167999 → uyarıda Karten-IK maddesi YOK → 200 → DB `krankenkasse_ik=100167999`, `kostentraeger_ik=105830016`. Yenileme sonrası maske IK alanında 100167999 (Karte→Kostenträger ipucu yeniden yüklemede görünmüyor, yalnız değişiklikte). Patientenakte okuma görünümünde (Kunden → tablo görünümü → reçete) „Kostenträger und Zuzahlung" bloğunda iki ayrı satır: „IK der Krankenkasse (Karte) 100167999" / „IK des Kostenträgers 105830016". **`ddf57e1b`:** Karten-IK 104212505 eklendi → `krankenkasse_ik`=`kostentraeger_ik`=104212505, `abrechnung_status=bereit` korundu. ⚠️ **P1 (builder'a devredildi):** sayfa taze yüklendikten sonra listeden bir reçete seçilip maske düzenlemede açıldığında `rzPatKasse` bağlanmamış (`dataset.katalogWired` yok) — Kasse adı araması açılır liste göstermiyor, Karten-IK girilince „Karte → Kostenträger" / „kein Kostenträger gefunden" geri bildirimi yok, Kasse adı IK'ya eşlenmiyor (Kasse „DAK" kalırken IK 104212505 yazılabildi). Aynı oturumda önce „+ Neue Verordnung" açılırsa bağlantı kuruluyor ve düzenlemede de çalışıyor. Yan gözlem (tasarım, bulgu değil): bir reçetede Kasse değişince `PATCH leads` hastanın Kasse'sini de değiştiriyor, hastanın diğer reçetelerinin maskesi yeni Kasse adını gösteriyor.
**Son test:** 2026-09-30 (P1 regresyon `2cc414a`; canlı `dashboard.js?v=20260930h` = HEAD `f4d31dc`, QA tenant test2, taze goto, bu oturumda „+ Neue Verordnung" AÇILMADI) — GEÇTİ, P1 kapandı. Listeden `06dbeb5c` seçildi → `#rzPatKasse.dataset.katalogWired="1"` (önceki turda tanımsızdı). Kasse alanına „DAK" → açılır listede tek öğe „DAK-Gesundheit DAK · IK 105830016" (seçilmedi). Karten-IK alanı temizlenip 100167999 yazıldı + Tab → „Karte 100167999 → Kostenträger DAK (IK 105830016)", tek istek (`kostentraeger_auswahl?ik=like.100167999%`); 109999999 → „Zu dieser IK wurde kein Kostenträger gefunden — bitte mit der Versichertenkarte abgleichen.", tek istek. Reçete 4 kez „✕ Auswahl aufheben" + yeniden seçildi → sonra IK değişikliğinde yine **1** ipucu elemanı (`#rzPatKasseIkHinweis`), **1** istek; „DAK" aramasında tek liste öğesi — dinleyiciler yığılmıyor. Hiçbir şey kaydedilmedi (DB: `krankenkasse_ik=100167999`, `kostentraeger_ik=105830016` değişmedi). ⚠️ **P3 (builder'a):** kaydetmeden kapatıp yeniden açınca alan DB değerine (100167999) dönüyor ama önceki denemenin ipucu „kein Kostenträger gefunden" altında kalıyor — geçerli IK'nın altında yanlış hata metni. Yan gözlem (bilinen, S3.8a turu): maskede Kasse adı „AOK Rheinland/Hamburg" iken Karten-IK DAK'a ait (hasta-düzeyi Kasse başka reçetenin kaydıyla değişmişti). Konsol: yalnız bilinen gürültü.
**Son test:** 2026-09-30 (S3.8b ön-doldurma `8316fbe` + `a81660c` + `50ef95e` P3 regresyonu; canlı `?v=20260930y`, QA tenant test2) — KISMEN. **S3.8b ön-doldurma GEÇTİ:** „+ Neue Verordnung“ → hasta `a8e9df53` seçildi → `rzPatKasse`=„DAK-Gesundheit“, `rzPatKasseIk`=**100167999** (Karten-IK, 105830016 değil). IK alanı temizlenip aynı değer yeniden girilince „Karte 100167999 → Kostenträger DAK (IK 105830016)“. Gözlem P3: ön-doldurmada ipucu gösterilmiyor (`fillRzPatientFromLead` `tazeleIkHinweis` çağırmıyor, `dashboard.js:15566`), yalnız elle değişiklikte çıkıyor. Yeni Verordnung **kaydedilmedi**. **BSNR tek sefer GEÇTİ:** aynı maskede Speichern → „Verordnung speichern?“: „noch leer“ listesinde ICD/DG/Heilmittel/Einheiten/LANR/Unterschrift, BSNR **yok**; „Hinweise“de tek madde „BSNR fehlt — kann vom Arztstempel übernommen werden.“ → Abbrechen, POST yok (prescriptions sayısı değişmedi). **Kayıtlı non-terminal ICD uyarısı (3.6, `a81660c`) KALDI:** taze yükleme → listeden `06dbeb5c` (`icd10=E11.7-`) → `rzIcd`=„E11.7-“, alan altında „nicht endständig“ metni YOK (gizli öğe de yok). Alan bir kez odaklanıp (katalog bağlandı) kapat/aç yapıldığında da yok. İki neden: (1) `attachDiagnoseSearch` `focusin`'de tembel bağlanıyor (`dashboard.js:15440-15446`) — taze yüklemede `katalog:gespeichert` olayını dinleyen yok; (2) `gespeicherterKodeHinweis` RPC'ye ham „E11.7-“ gönderiyor (`katalog-suche.js:416`), `search_diagnosen(p_q='E11.7-')` **0 satır**, „E11.7“ ise `E11.7-` satırını döndürüyor. → builder'a P3. **`50ef95e` P3 regresyonu GEÇTİ (kapandı):** `06dbeb5c` → IK 109999999 + Tab → „kein Kostenträger gefunden“ → kaydetmeden „✕ Auswahl aufheben“ → yeniden seç (2 tur) → alan 100167999, ipucu „Karte 100167999 → Kostenträger DAK (IK 105830016)“, tek `#rzPatKasseIkHinweis`; DB değişmedi. **Yeni gözlem (P2, builder'a):** Verordnungen listesinde `06dbeb5c` satırı ⚠ „ICD-10-Kode fehlt — in der Podologie bestimmt er die Diagnosegruppe.“ diyor, oysa `icd10=E11.7-` kayıtlı — `parseIcdList('E11.7-')` → `[]` (`icd-dg-match.js:48` `ICD_SHAPE` sondaki „-“yi kabul etmiyor). Aynı tooltip'te „im Heilmittelfeld steht „HornhautabtragungHorn““ — DB `heilmittel` gerçekten bu değerde (eski test turunun giriş artığı olabilir, bulgu sayılmadı). Konsol: yalnız bilinen gürültü.
**Son test:** 2026-09-30 (P1/P2/P3/P3a regresyonu `f6cd960` + `14171df`; canlı `dashboard.js?v=20261001a` = yerel, calendar-api image `f6cd960` 09:35Z derlendi, test 09:37–09:44Z; QA tenant test2) — GEÇTİ, dört devir kapandı. **P3a:** „+ Neue Verordnung“ → hasta `a8e9df53` seçildi → `rzPatKasseIk`=100167999 ve ipucu „Karte 100167999 → Kostenträger DAK (IK 105830016)“ ön-doldurmanın hemen ardından görünür (elle değişiklik yok). **P3:** taze yükleme → listeden `06dbeb5c` (kayıtlı „E11.7-“) → alana odaklanmadan „ICD-Code ist nicht endständig …“ görünür; yeniden kayıttan sonra tiresiz „E11.7“ ile açılışta da görünür. **P1 kayıt yolu:** ICD alanında listeden „E11.7-“ seçildi → Speichern (LANR/BSNR uyarısı → Trotzdem speichern, bilinen test verisi) → `PATCH /api/rezept/06dbeb5c` 200 → **yenileme sonrası** DB `icd10="E11.7"` (tire yok). **Regresyon:** aynı alana „E11.74 L60.0“ + Tab → alan E11.74, `rzIcd2`=L60.0, 3.6 ipucu kalktı → kaydet → yenileme sonrası `icd10=E11.74`, `icd10_2=L60.0`. **P2:** liste satırı tooltip'inde „ICD-10-Kode fehlt“ yok, ICD⇄DG kontrolü çalışıyor: „E11.7 passt nicht zur Diagnosegruppe DF.“ (DF `icd_accept` yalnız `E1x.74/75`, `E1x.40/41`, `G63.2`; üst kod E11.7 hiçbirine uymuyor → `mismatch`). Açık soru → `podoloji`/`gkv-302`: non-terminal üst kod için „passt nicht“ mı, yoksa „nicht endständig — Unterkode entscheidet“ tarzı bir metin mi doğru? Mekanik olarak doğru, UX olarak yanıltıcı olabilir (alt kodu E11.74 DF'ye uyar). Konsol: yalnız bilinen gürültü (5). Son durum: `06dbeb5c` ICD = E11.74 + L60.0 (önceki „E11.7-“ repro'su artık DB'de yok).
**Son test:** 2026-09-30 (S3-Reste `2e4275f`; canlı `dashboard.js?v=20261001b` = yerel, modül importları `?v=20261001b`; QA tenant test2, 10:46–11:05Z) — KISMEN. **ICD nicht endständig (GEÇTİ):** yeni maske, hasta `a8e9df53`, `rzIcd`=E11.7 + DG DF → `rzIcdDgWarning` „E11.7 ist nicht endständig — für DF passen z. B. E11.74, E11.75“ (`--warning` rengi, kalın değil). ⚠ Uyarı yalnız ICD alanı değişince hesaplanır: önce ICD sonra DG seçilince uyarı ÇIKMADI, ICD alanına tekrar dokununca çıktı (kod: `icd-dg-verdrahtung.js` DG `change` yalnız DG boşalınca `onIcdChange` çağırır — commit öncesiyle aynı davranış, bu turun kapsamı dışı). Kaydedilen **`50139501`** (E11.7+DF) listede amber ⚠ (`rgb(245,158,11)`), tooltip „E11.7 ist nicht endständig — für DF passen z. B. E11.74, E11.75“; yeniden açılışta odaksız uyarı var. **Terminal mismatch:** L60.0+DF → formda „Der ICD benennt nicht … L60.0 (DF) · Passende Diagnosegruppen: UI1, UI2“, listede „L60.0 passt nicht zur Diagnosegruppe DF.“ — ikisi de **amber**, kırmızı DEĞİL: `diagnosegruppen.icd_enforcement` DF=`warn` (yalnız UI1/UI2 `hard_before_dta` → blocker). Formda hiçbir ICD uyarısı kırmızı olmaz (`zeige()` rengi değiştirmez, yalnız kalınlık). Commit öncesiyle aynı; „kırmızı kalsın“ beklentisi DF için kodla/DB ile örtüşmüyor → açık soru `gkv-302`'ye (DF'de terminal mismatch blocker mı olmalı). **Kasse↔Karten-IK (GEÇTİ):** maskede Kasse „AOK Hessen“ seçilince (IK alanı silinmez, maske tasarımı) `rzPatKasseIkAbweichung` „Karten-IK gehört zu DAK, eingetragen ist AOK Hessen.“ amber (`rgb(138,106,47)`); DAK'a dönünce kalktı, kaydedilmedi. **Sperre-Banner (GEÇTİ):** yeni maske (LANR boş, imza yok) → `#rzSperreBanner` görünür, amber; Arzt picker'dan hekim seçildi → LANR doldu, imza yok → banner kalır; imza işaretlendi → banner gizlendi; LANR elle silindi → banner geri geldi; LANR yazıldı → gizlendi. Banner metni sabit („Ohne Arzt-Nr. und Unterschrift/Stempel …“), hangisinin eksik olduğunu ayırmıyor (P3 gözlem). **Yeni Verordnung listede/Akte'de anında (KALDI, P1):** kayıt DB'de (`50139501`) ama açık Verordnungen listesi 10 sn sonra hâlâ eski 4 satır; panel değiştirip dönünce geldi. Düzenleme (PATCH, L60.0) de listeyi yenilemedi. Kök neden ölçüldü: `dashboard.js` `signal.js?v=20260815`, dinleyiciler (`verordnung-liste.js`, `verordnung-uebersicht.js` vd.) `signal.js?v=20260813` içe aktarıyor → iki ayrı modül örneği, iki ayrı dinleyici `Map`'i. Tarayıcıda: `a=import(…v=20260815)`, `b=import(…v=20260813)` → `a!==b`; `a.emit` → b-dinleyicisi 0 kez. Akte açıkken `a.emit('verordnungen:changed')` → 0 REST isteği; `b.emit(…)` → 7 istek (prescriptions×4, leads, podologie_behandlungen×2) = Akte yeniden çiziyor. Devir paketi aşağıda. Kaydetme onay diyaloğu yalnız LANR Prüfziffer'i sayıyor, E11.7 „nicht endständig“ uyarısını listelemiyor (P3 gözlem, `podoloji`'ye). Konsol: yalnız bilinen gürültü + loadActivityFeed.

### Podologie Behandlungen — Tagesbehandlung erfassen — nav etiketi: `podologie-billing`

**Beklenen:** Sol listeden aktif Verordnung seçilir, sağda tarih + HPNR kutuları gelir
(ilk seansta 78040 varsayılan işaretli, sonrakilerde 78030). "Behandlung speichern" →
`podologie_behandlungen` satırı (`verordnung_id`, `behandlungsdatum`, `hpnr_codes[]`).
İlk behandlung kaydedilince `prescriptions.behandlungsbeginn` yazılır;
`abrechnung_status` **ancak seans sayısı `anzahl_einheiten`'e ulaşınca** `bereit`
olur (sayaç `module/podologie-abrechnung.js`'te, `sitzungsfortschritt.js` podolojide
bilerek devre dışı).
Seçili Verordnung'un kayıtlı seansları **"Bereits dokumentiert (n)"** başlığı altında
listelenir (20.09.2026'dan beri; `podBehandlungenDerVerordnung()`).
**Bağımlı ekranlar:** `abrechnung` (EHE satırları buradan gelir)
**Son test:** 2026-09-19 (ikinci tur) — GEÇTİ (kayıt + `behandlungsbeginn` + 3/3'te
`bereit`). Kusur (a) Behandlungsdatum **gelecek tarih kabul ediyor** → `c4332d5` ile
geri-soru eklendi, bu turda ayrıca sınanmadı. Kusur (b) "kayıtlı seanslar hiçbir yerde
listelenmiyor" → **kapandı** (`1201618`, aşağıdaki Storno kaydına bak).
**Son test:** 2026-09-28 (S1 doğrulama, `2d8aea5`) — TEST EDİLEMEDİ. Canlı `module/podologie-abrechnung.js`
SyntaxError veriyor (`Unexpected identifier 'max'`, satır 783: `2d8aea5`'in template literal içindeki
HTML yorumuna koyduğu backtick'ler dizgiyi erken kapatıyor). `dashboard.js:38` bu modülü statik
import ettiği için tüm dashboard boş render ediyor (body boş, sidebar yok) — P0, bütün hesaplar. S1.5 sınanamadı.
**Son test:** 2026-09-29 (S1 regresyon, hotfix `94c753c`) — GEÇTİ (kısmi). P0 kapandı: dashboard taze yüklemede açılıyor, `Unexpected identifier` yok. QA tenant'ta aktif podo-Verordnung yok; "Abgerechnet (1)" grubundaki DF (a) Verordnung seçildi (form açık kaldı, bilgi şeridi var): 78010 önseçili ✓, 78030 işaretli ✓ (1 behandlung zaten dokümante → 78040 değil, doğru), `podBehDatum` = bugün ✓. KAYDEDİLMEDİ. İlk-gün 78040 dalı ve b)→78020 dalı veri olmadığı için sınanamadı.
**Son test:** 2026-09-29 (S1.4+S1.7, `45d91c3`) — GEÇTİ. Termin-Aktionen → "Termin Starten" (bağlı, geçmiş tarihli test randevusu 28.09) doğrudan bu panele düşüyor: Sitzungsnotiz yok, Anamnese yok; Tagesbehandlung doğru Verordnung ile açık (tenant'ta tek podo-Verordnung var, 1-1 DF "Abgerechnet" — çoklu reçetede ayırt etme sınanamadı), `podBehDatum` = 2026-09-28 (randevu günü). Gelecek tarihli randevu (06.10): "Termin liegt in der Zukunft" sorusu çıktı; "Abbrechen" → takvimde kalındı, panel açılmadı; "Heute behandeln" → `podBehDatum` = 2026-09-29. KAYDEDİLMEDİ, `podologie_behandlungen` sayısı değişmedi (1). Hausbesuch dalı sınanmadı. Kanıt: `C:\tmp\pq29\05-termin-starten-vergangen.png`, `07-zukunft-frage.png`, `08-heute-behandeln.png`.
**Son test:** 2026-09-29 (S1.12/S2.6/S2.4/S2.7 turu, S2.6 = `8486dee`; canlı `dashboard.js?v=20260929i`) — S2.6 GEÇTİ (disabled dalı). QA tenant, "Aktive Verordnungen" → `f77efc4c` (DF, `hausbesuch=false`) seçildi, yeni tedavi KAYDEDİLMEDİ: 79933 ve 79934 kutuları `disabled`, işaretsiz, satır `opacity 0.5` + `cursor: not-allowed`, satır sonunda ve `title`da „Nur abrechenbar, wenn auf der Verordnung „Hausbesuch: Ja" angekreuzt ist." Etkin dal (hausbesuch=true) SINANAMADI: tenant'ın iki podo reçetesi (`796aae21`, `f77efc4c`) de `hausbesuch=false` — veri üretilmedi. Konsol: yalnız bilinen gürültü.
**Son test:** 2026-09-30 (S3.7 sperre, `22480aa`) — GEÇTİ. `06dbeb5c` Unterschrift'siz iken: „Behandlung speichern“ → yazma isteği YOK, düğmenin üstünde „Behandlung nicht möglich: Auf der Verordnung fehlen Arzt-Nr. oder Unterschrift/Stempel (Podologie-Vertrag Anlage 3). …“. Status → „Bereit zur Abrechnung“ → `PATCH /api/billing/verordnung/06dbeb5c/abrechnungsstatus` **422** „Diese Verordnung kann noch nicht freigegeben werden: Unterschrift/Stempel des Arztes fehlt (Podologie-Vertrag Anlage 3)“ — dialog içinde gösterildi, durum değişmedi. Yanlış Prüfziffer'li LANR tek başına bloklamadı (Unterschrift eklendikten sonra Behandlung kaydedildi, bkz. Hausbesuch kaydı). Not: sperre formu açarken değil, yalnız kaydetmede görünüyor (P3 UX — form önceden uyarabilir).

### Podologie Behandlungen — Abgerechnet-Gruppe (gesendete Verordnungen) — nav etiketi: `podologie-billing`

**Beklenen:** Zaten §302-Datei'ye giren (`abrechnung_status` ∈
`in_abrechnung,gesendet,accepted,paid`) Verordnungen "Aktive Verordnungen" listesinden
düşer, ama kaybolmaz — liste altında kapalı bir **"Abgerechnet (n)"** başlığı altında
durur (`_podState.verordnungenAbgerechnet`, `PODO_ABGERECHNET_OR`). Açılınca aynı satır
biçimiyle listelenirler, fakat "Status" düğmesi **gösterilmez** (Abrechnungsstatus artık
buradan değişmez). Böyle bir Verordnung seçilince Tagesbehandlung formu **kapanmaz** —
§630f Abs. 1 S. 2 BGB ve gkv-302'nin onayı gereği (Teilabrechnung normal, kalan
Einheiten dokümante edilebilir kalmalı) — form üstünde bilgi şeridi çıkar:
"Diese Verordnung wurde bereits (teilweise) eingereicht — X Einheit(en) abgerechnet,
Y Einheit(en) noch offen."
**Bağımlı ekranlar:** `abrechnung`, hasta dosyası zaman çizelgesi (`patientenkarte.js`
→ `verordnung-uebersicht.js`, aynı `PODO_ABGERECHNET_OR` filtresini paylaşır)
**Son test:** 2026-09-20 (`1d549f6`) — GEÇTİ (kısmi). Grup kapalı geliyor, "▸/▾" ile
açılıp kapanıyor, 3 Verordnung doğru göründü. Seçilince Tagesbehandlung formu **açık**
kaldı (kapanmadı), bilgi şeridi göründü, "Status" düğmesi bu grupta **yok**
(DOM'da 0 buton, doğrulandı). Hasta dosyası zaman çizelgesinden (Patientenakte →
Behandlung satırı) bu gruba tıklamayla ulaşmak da çalıştı — eskiden ölü olan bağlantı
şimdi doğru Verordnung'u seçili getiriyor (aşağıda ayrıca kapatıldı).
✅ ~~P1, hâlâ açık (regresyon turu 2, 20.09.2026, `c1c3e16`): sayaç "0 abgerechnet"
gösteriyor, `abrechnung_zeile`'a giden istek hiç tetiklenmiyor~~ — **3. turda (aynı gün,
taze `goto` ile) çürütüldü.** Testte kullanılan üç somut prescription_id ile
(`f89aa419…` 1 Einheiten, `3ec144e0…` 3 Einheiten, `ed52d1e5…` 6 Einheiten) `podologie-billing`
→ "Abgerechnet"-Grubu tek tek açıldı, her biri için `playwright-cli requests` ile ağ trafiği
yakalandı: **üçünde de** `GET .../abrechnung_zeile?select=created_at&abrechnung_id=eq.<X>&
prescription_id=eq.<Y>` isteği gerçekten gitti, doğru `created_at` döndü, ve bilgi şeridi
sırasıyla "1 Einheit(en) abgerechnet, 0 noch offen" / "3 Einheit(en) abgerechnet, 0 noch offen" /
"6 Einheit(en) abgerechnet, 0 noch offen" gösterdi — üçü de Verordnung'un toplam dokümante
edilmiş seans sayısıyla birebir eşleşiyor. Yani `selectedVord?.abrechnung_id` koşulu bu turda
**true** geldi — "regresyon turu 2"nin "koşul hiç sağlanmıyor" bulgusu **yeniden üretilemedi**.

**Kök neden (kesin kanıtlanmış):** veri hiçbir zaman eksik değildi — her üç kaydın
`abrechnung_zeile` satırı 2026-09-19'da oluşmuş (`created_at` 19.09.2026, saat 15:00–21:28
aralığında üç farklı an), yani hem `c1c3e16` fix'inden HEM de "regresyon turu 2" testinden
**ÖNCE** DB'de zaten doluydu. Kod da (`module/podologie-abrechnung.js:653-670`,
`module/podo-abrechnet-zaehler.js`) doğru çalışıyor — hem okuma hem bu turdaki canlı test bunu
doğruluyor. Geriye kalan tek açıklama: **"regresyon turu 2" testi taze bir tam sayfa
navigasyonu (`goto`/`open`) olmadan** çalıştırılmış olabilir — aynı kalıcı (`-s=praxura`)
oturumda yalnız `switchPanel()` ile panel değiştirmek ES module'leri yeniden fetch etmez;
sekme `c1c3e16` deploy'undan önce açık kalmışsa (veya başka bir nedenle eski modul instance'ı
bellekte kalmışsa) `?v=` parametresi HTML'de güncel olsa bile o sekme eski mantıkla çalışmaya
devam eder. Bu turda bilinçli olarak yeni bir `playwright-cli open --persistent` (tam `goto`)
yapıldı, kod fiilen baştan yüklendi ve doğru çalıştı. **Bu bir kod hatası değil, muhtemelen bir
test-oturumu artefaktıydı** — önceki test sekmesinin gerçek durumu geriye dönük
doğrulanamaz, ama veri + kod + taze-oturum üçlüsü şu an tutarlı ve doğru sonuç veriyor.
`builder`'a **üçüncü tur olarak GÖNDERİLMEDİ** — iki vuruş kuralı gereği zaten gönderilmeyecekti,
ama artık gerek de yok. **Metodoloji notu:** bundan sonra client-side JS düzeltmelerinin
regresyon testi her zaman taze bir `open`/`goto` ile yapılmalı, aynı kalıcı sekmede
`switchPanel()` ile değil — aksi halde deploy'dan sonra bile eski kod test edilmiş olabilir.

### Podologie Behandlungen — Storno (durchstreichen statt löschen) — nav etiketi: `podologie-billing`

**Beklenen:** Seçili Verordnung'un altındaki "Bereits dokumentiert (n)" listesinde her
stornolanmamış satırda **"Stornieren"** düğmesi durur. Tıklanınca `showInputModal`
açılır; metin satırın silinmeyeceğini açıkça söyler. **Gerekçe zorunlu** (≥3 karakter,
`grundPruefen()`): boş / yalnız boşluk / 2 karakter → kayıt DEĞİŞMEZ ve
"Ohne Grund lässt sich nicht stornieren…" uyarısı çıkar. Abbrechen hiçbir şey yapmaz.
Geçerli gerekçeyle: satır **silinmez**, üstü çizilir (`line-through`), soluklaşır
(`opacity .6`), altına "Storniert am `<tarih>` — `<gerekçe>`" yazılır, "Stornieren"
düğmesi kaybolur, başlık "Bereits dokumentiert (0 + 1 storniert)" olur.
Stornolanan satır **hiçbir sayımda** artık yok: Einheiten sayacı, §302 seçim ekranı
(`abrechnung`), abrechnung_status. Silme DB tarafında `trg_podologie_behandlungen_kein_delete`
(BEFORE DELETE, migration 0026) ile yasak; `api/dsgvo.js` de bu yüzden tabloyu
`DELETE_TABLES`'tan çıkardı (yerine `EXPORT`'ta kalıyor).
20.09.2026'dan beri ek olarak: bu davranış **yalnız `invoice_id` NULL olan** satırlarda
geçerli — `darfStornieren()` (`module/podo-storno.js:55`) satır zaten bir özel
Rechnung'a bağlıysa Storno'yu tamamen **reddeder** ("Diese Behandlung steht bereits auf
einer Rechnung. Bitte zuerst die Rechnung stornieren…"), ayrı ve önceki bir kilit.
Bunun ÜSTÜNE: eğer ÜST Verordnung zaten Kasseye gönderilmişse (`status` ∈
`abgerechnet,abgesetzt,teilabsetzung`, podolojik eksende) Storno **engellenmez** ama
onay diyaloğuna iki ek uyarı eklenir: Meldepflicht metni (`MELDEPFLICHT_TEXT`,
`module/abrechnungsstatus.js`) + Zuzahlung düzeltme uyarısı — gkv-302'nin
"Korrekturverfahren Umsetzungsempfehlungen 13.02.2025, Frage 5" referansına dayanıyor
(kendiliğinden keşfedilen fazla ödeme Korrekturverfahren'e girmez, Kasseye elle
bildirilmeli).
**Bağımlı ekranlar:** `abrechnung` (stornolu seans §302'ye girmez), `rechnungen`,
`belegliste`
**Son test:** 2026-09-20 (`c66232d`, ikinci tur) — GEÇTİ. "Abgerechnet"-Gruppe içindeki
gönderilmiş bir Verordnung'un dokümante edilmiş bir seansında "Stornieren" tıklandı;
onay diyaloğunda hem standart metin hem de **Meldepflicht** cümlesi ("Diese Verordnung
wurde bereits bei der Kasse eingereicht…") hem de **Zuzahlung** cümlesi ("Diese
Behandlung ist Teil einer bereits eingereichten Rechnung…") tam metniyle göründü.
İşlem **gerçekten onaylanmadı** (geri alınamaz olduğu için "Abbrechen" ile kapatıldı,
gerçek veri değişmedi) — dialog içeriği doğrulandı, kayıt durumu değişmedi.
⚠️ Sınanamadı: canlı `DELETE` denemesi (araç izin katmanı reddetti) — trigger yalnız
migration dosyasından doğrulandı.
✅ ~~Açık soru: `abrechnung_status = 'gesendet'` Verordnung'ların seansları Storno
listesine hiç gelmiyordu~~ — `1d549f6` ile "Abgerechnet"-Gruppe geldi, bu Verordnunglar
artık listede ve Storno erişilebilir (yukarıdaki paragraf); domain kararı gkv-302
tarafından commit mesajında referanslandı (Storno engellenmiyor, sadece bilgilendiriyor).

### Einstellungen → Abrechnung (Krankenkasse): §302-Betriebsart — nav etiketi: `settings`

**Beklenen:** `#settingsAbrechnungSection` yalnız Praxis-Fachbereich'ta ve yalnız
**Inhaber**'e görünür. İçinde sırayla: IK girişi + "IK speichern", ITSG-Zertifikat
durumu, ardından **"Betriebsart der §302-Abrechnung (Vorgabewert)"** — üç seçenek
(`test` / `erprobung` / `echt`), altında seçime göre değişen açıklama metni.
`echt` seçilince Zulassung alanları (Aktenzeichen + Datum) açılır ve **ikisi de
dolu değilse kayıt reddedilir**; asıl kilit DB tarafındaki CHECK (migration 0028).
Altında **"Ausnahmen je Datenannahmestelle"**: 9 haneli DAS-IK girilir, isim
`kostentraeger_annahmestellen` → `kostentraeger` üzerinden **otomatik** gelir
(bulunamazsa "Name nicht gefunden (Speichern trotzdem möglich)"), "Ausnahme speichern"
`betriebsart_empfaenger`'e yazar, liste altında Bearbeiten/Löschen ile durur.
Löschen `showConfirmModal` sorar. Kayıt yoksa "Keine abweichenden Ausnahmen hinterlegt".
20.09.2026'dan beri ek olarak: "Aktuell (Vorgabewert): X" başlığı radyo seçilir
seçilmez **değişmez** — yerine "noch nicht gespeichert" ibaresi eklenir; "Vorgabewert
speichern" tıklanınca `showConfirmModal` ile "Vorgabewert von „A" auf „B" umstellen?"
sorar, onaylanırsa DB güncellenir VE ancak o zaman başlık yeni değere döner.
**Bağımlı ekranlar:** `abrechnung` (dosya adı TSOL/ESOL ve UNB 0/1/2 buradan gelir)
**Son test:** 2026-09-20 (ikinci tur, `69c7a0e`) — GEÇTİ. `test`'ten `erprobung`'a
radyo işaretlendi (kaydetmeden): başlık **"Testverfahren"** olarak kaldı, yanına
"noch nicht gespeichert" eklendi — eski regresyon (kaydetmeden değişme) **kapandı**.
"Vorgabewert speichern" tıklanınca önce bir onay modalı çıktı ("Vorgabewert von
„Testverfahren" auf „Erprobungsverfahren" umstellen?" — bu turda yeni görülen,
önceki testte rastlanmamış bir ek güvenlik adımı), onaylandıktan sonra başlık
**"Erprobungsverfahren"**'e döndü. Test sonunda ayar bilerek **`test`'e geri alındı**
(aynı onay akışıyla) — canlı ayar test öncesi durumunda bırakıldı. Konsol temiz
(yalnız bilinen `visibility_reports` 403).

### §302-Abrechnung — Neue Abrechnung → DTA — nav etiketi: `abrechnung`

**Beklenen:** Kasa başına bir dosya + bir Begleitzettel. Liste tıklamadan önce kaç
dosya/zarf çıkacağını söyler. "Erstellen" → `POST /api/billing/abrechnung/create-podologie`
→ `abrechnung` + `abrechnung_zeile` satırı + Storage'a `.dta`. "DTA herunterladen"
imzalı URL ile indirir ve kaydı `heruntergeladen`'a çeker. Preflight'ı geçmeyen
reçeteler "Fehlerhafte Rezepte" başlığı altında **gerekçesiyle** ayrı durur.
Sunucu 422 dönerse üstteki şerit "Die Datei hätte die Prüfung der Annahmestelle nicht
bestanden." der ve **altına `<ul><li>` olarak sunucunun her gerekçesini** yazar
(metin + alan yolu + kod, ör. `V:01011`).
20.09.2026'dan beri ayrıca: başarılı üretimde `.dta` yanına `.auf` (Auftragsdatei)
yazılır ve detay penceresinde **"Auftragsdatei"** düğmesi çıkar — düğme
`ab.auftragsdatei_path` doluysa render edilir (`module/abrechnung-detail.js:421`),
yani migration 0027 öncesi üretilmiş dosyalarda **bilerek yok**.
Preflight reddi artık iz bırakır: `abrechnung` satırı `status='verworfen'` +
`verwerfungsgrund` ile kalır, numara (`datenaustauschreferenz`/`transfernummer`) yanar.
Bu satır **"Bisherige Abrechnungen" listesinin sonunda** durur (açık dosyaların
üstünde değil), özet sayacına ("X Dateien") **dahil edilmez** (ayrı "Y verworfen"
olarak gösterilir), `verwerfungsgrund` hem listede hem detayda görünür, ve detayda
"Zahlung erfassen"/"ZAA hochladen" düğmeleri **çıkmaz** (yalnız "Anleitung").
**Bağımlı ekranlar:** `belegliste`, `mahnwesen`, `rechnungen`, `podologie-billing`
**Son test:** 2026-09-20 (ikinci tur, `69c7a0e`) — GEÇTİ. Var olan bir `verworfen`
kaydı (`R2026-W38-001`, `Preflight [V:01011] (1 Fehler)`) listede **son sırada**
göründü, özet "3 Dateien · 3 offen · 1 verworfen · 490,34 € offen" dedi (verworfen
3'e dahil değil), `verwerfungsgrund` hem satırda hem detay başlığında tam metniyle
duruyordu, detay penceresinde ödeme/ZAA düğmeleri **yoktu**, yalnızca "Anleitung"
vardı. Önceki turun üç bulgusu (sıra, sayaç, gizli gerekçe, yanlış düğmeler) **hepsi
kapandı**.
⚠️ Sınanamadı: **Auftragsdatei düğmesi** — başarılı bir Abrechnung üretilemedi
(elde kalan tek "bereit" reçete Leitsymptomatik eksikliğinden 422 alıyor), mevcut üç
dosya (19.09) ise 0027 öncesi olduğu için `auftragsdatei_path` NULL ve düğme doğru
şekilde çıkmıyor. Bir sonraki turda, Leitsymptomatik'i dolu bir reçeteyle tekrar
denenmeli. ⚠️ `datenaustausch_zaehler` istemciden okunamıyor (RLS, SELECT policy yok —
`service_role`'a özel, tasarım gereği); sayaç kalıcılığı tarayıcıdan doğrulanamaz.
**Son test:** 2026-09-29 (S2.1, `13d4351`) — GEÇTİ (DTA üretim tarafı). Test dosyası `TSOL0002` (abrechnung `985371d2`) oluştu, `.auf` yolu yazıldı; reçete `f77efc4c` Betriebsart `test` altında festgeschrieben EDİLMEDİ (ayrıntı: aşağıdaki "Neue Abrechnung → Erstellen" kaydı). DTA indirilmedi.
**Son test:** 2026-09-29 (S2.2 `36fb9ff`; canlı `?v=20260929i`, backend `:beta` = `36fb9ff`) — GEÇTİ (P2 gözlemlerle). Bisherige listesinde üç satırın (TSOL0001/2/3) üçünde de „Test" rozeti. TSOL0003 (`a4d4e713`) detayı: durum „Erstellt — noch nicht heruntergeladen" + „Test" rozeti (title „Testdatei — löst keine Zahlung aus"); tarih satırı yerine „Übermittlung: Testdatei – wird nicht an die Kasse übermittelt, löst keine Zahlung aus."; para bloğu „In Datei (Test) 25,70 € · Abgesetzt 0,00 € · Bezahlt 0,00 € · Offen 25,70 €"; „Eingereicht: noch nicht" ve „Eingereicht X €" YOK; „Zahlung erfassen"/„ZAA hochladen" YOK; düğmeler: DTA herunterladen · Auftragsdatei · Begleitzettel · ✍ Signieren · Anleitung. Erprobung/echt dosyası yok (3 dosyanın üçü de `betriebsart=test`, verworfen yok) → o dal: veri yok. P2 gözlemler (domain teyidi `gkv-302`): (a) Beleg tablosunun „Rückmeldung" sütunu test dosyasında hâlâ „eingereicht" diyor (`abrechnung_zeile.status`) — üst blok „nicht übermittelt" derken satır „eingereicht": tek-dil hedefinin kalan kısmı; (b) test dosyasında „Offen 25,70 €" — „löst keine Zahlung aus" ile yan yana (S2.1 gözlemi (a) ile aynı soru); (c) test dosyasında „✍ Signieren" düğmesi görünüyor — beklenen mi belirsiz.

### Patientenakte — Zeitleiste → Verordnung/Behandlung-Sprung — nav etiketi: (Patientenkarte, `kunden` içinden açılır)

**Beklenen:** Hasta dosyasının zaman çizelgesinde bir "Behandlung" satırına tıklanınca
ilgili Verordnung'un bulunduğu panele (`podologie-billing`) gidilir ve o Verordnung
seçili gelir — Verordnung zaten §302'ye gönderilmiş olsa bile.
**Bağımlı ekranlar:** `podologie-billing` (Abgerechnet-Gruppe)
**Son test:** 2026-09-20 (`1d549f6`) — GEÇTİ. "Automat E2ETest" hastasının zaman
çizelgesinde 10.7.2026 tarihli (gönderilmiş) Verordnung'a bağlı "15.7.2026 Behandlung"
satırına tıklandı; sayfa `podologie-billing`'e geçti, "Abgerechnet"-Grubu otomatik
açık geldi, doğru Verordnung ("Automat E2ETest", 22-1, 6 Einheiten) seçili olarak
göründü, "Bereits dokumentiert (6)" listesi tıklanan tarihi içeriyordu. Eskiden bu
tıklama ölü/boş bir dala düşüyordu (commit mesajı: "eine tote Verzweigung von der
Patientenakte-Zeitleiste") — **kapandı**.

### Uçtan uca podoloji turu (sentetik hesap) — 2026-09-28

> Bu turun kapsamı ve tüm ham bulgular `canli-test` dışı bir oturumda toplandı (Claude ana
> oturumu, `playwright-cli -s=praxura-qa`, sentetik owner "TEST-Podologie QA", klinik/active,
> betriebsart `test`). Yeni sentetik tenant 21.09 blokajındaki öneriyi karşılıyor: bu hesap
> hiçbir gerçek müşteriye ait değil. Ayrıntılı rapor Kemal'e ayrı teslim edildi.

### Patienten — Neuer Patient ("Neuer Lead") — nav etiketi: `kunden`

**Beklenen:** Vorname/Nachname/Geburtsdatum/Versicherungsart zorunlu. "GKV" seçilince
Krankenkasse (arama), Versichertennummer, Versichertenstatus alanları açılır. KVNR Prüfziffer
anında kontrol edilir. "Hausbesuch" işareti `leads.hausbesuch` sütununa yazılmalı (terminmodal
ve Fahrt akışı onu okur).
**Bağımlı ekranlar:** `calendar` (terminmodal Hausbesuch önseçimi), `verordnungen` (Muster-13 otomatik dolum)
**Son test:** 2026-09-28 — KISMEN. Kayıt + KVNR kontrolü GEÇTİ (geçersiz A123456789 uyarı verdi,
T000000002 kabul). KALDI: Hausbesuch ve Geburtsdatum yalnız `metadata`'ya yazılıyor, sütunlar
boş (terminmodal Hausbesuch'u önseçmedi); başlık/düğme hâlâ "Neuer Lead".
**Son test:** 2026-09-29 (S3.1 `1fb3a7e`; frontend `?v=20260929o`, backend `:beta` digest = `1fb3a7e` etiketi, GHCR'den doğrulandı) — GEÇTİ. „+ Neuer Lead" (başlık hâlâ „Neuer Lead", bilinen): sentetik hasta **`1abd135e`** (TEST-QA Spalten, Geburtsdatum 01.02.1950, Privat, Hausbesuch işaretli). Hausbesuch işaretliyken adres zorunlu (Strasse/PLZ/Stadt; ilk Speichern bu yüzden toast ile reddedildi — beklenen, sentetik adres girildi). DB (REST, kullanıcı JWT'si): `geburtsdatum='1950-02-01'`, `hausbesuch=true`, `metadata=null` (iki anahtar metadata'da YOK). Listede Geburtsdatum „1.2.1950" sütundan. Bearbeiten → başlık „Lead bearbeiten", form sütunlardan doğru doldu → yalnız Festnetz eklendi → tek kayıt, `phone` yazıldı, `geburtsdatum`/`hausbesuch`/adres korundu. **Sınanamadı:** metadata birleştirmede „yabancı anahtar korunur" kısmı — bu hastanın metadata'sı boş, UI'dan yabancı anahtar (ör. OCR) üretmenin yolu yok, DB'ye doğrudan yazılmadı. Terminkalender → + Termin → TEST-QA seçildi → `bkHausbesuch` önseçili; kontrol: TEST-Karl (hausbesuch false, metadata boş) → işaretsiz. Randevu kaydedilmedi.
**Son test:** 2026-09-30 (S3.8b `8316fbe`; canlı `dashboard.js?v=20260930y` = yerel, calendar-api image `18b9c1f` 08:38Z derlendi, test 08:40–08:52Z; QA tenant test2) — GEÇTİ. Hasta `a8e9df53` → Bearbeiten: yeni alan „IK (Versichertenkarte)“ (`lead-krankenkasseIk`) görünür, başlangıçta boş. 100167999 + Tab → „Karte 100167999 → Kostenträger DAK (IK 105830016)“ → Speichern → toast „Gespeichert.“, DB `leads.krankenkasse_ik=100167999`. **Sayfa yenilendi** → Bearbeiten → alan 100167999. Kasse alanına elle „DAK“ yazınca IK alanı anında boşaldı; listeden „DAK-Gesundheit · IK 105830016“ seçilince IK boş kaldı (Kostenträger-IK alana yazılmadı), ipucu „IK von der Versichertenkarte eintragen (nicht die Kassen-IK aus der Suche).“ **Geçersiz IK:** 12345 → ipucu „IK der Krankenkasse muss genau 9 Ziffern haben.“ → Speichern çalıştı, modal kapandı, DB `krankenkasse_ik=null`. Sonra 100167999 yeniden girildi (son hâl: Kasse DAK-Gesundheit + Karten-IK 100167999). Gözlemler (P3, `podoloji`'ye UX): (a) Kasse adı „AOK“ dururken DAK'a ait Karten-IK girilebiliyor, form uyumsuzluğu söylemiyor (ipucu yalnız Kostenträger adını gösteriyor); (b) geçersiz IK kaydedilince sessizce null yazılıyor — daha önce geçerli bir IK kayıtlıysa yazım hatası onu da siler, toast bunu söylemiyor (ipucu yalnız alan altında). Konsol: yalnız bilinen gürültü.
**Son test:** 2026-09-30 (S3-Reste `2e4275f`; canlı `?v=20261001b`; QA tenant test2) — GEÇTİ. Önceki turun iki P3 gözlemi kapandı. Hasta `a8e9df53` (başlangıç DAK-Gesundheit + 100167999) → Bearbeiten → IK alanına 12345 → Speichern → modal açık kaldı, `lead-krankenkasseIkFehler` (role=alert) „IK der Krankenkasse muss genau 9 Ziffern haben.“, `aria-invalid=true`, odak IK alanında; DB değişmedi (`krankenkasse_ik=100167999`). Aynı metin ipucu satırında da duruyor → alan altında iki kez aynı cümle (P3 kozmetik). Boş IK → Speichern → toast „Gespeichert.“, DB `krankenkasse_ik=null`. **Kasse↔IK:** Kasse „AOK Hessen“ seçildi (IK alanı boşalır — form tasarımı), IK 100167999 + Tab → `lead-krankenkasseIkAbweichung` „Karten-IK gehört zu DAK, eingetragen ist AOK Hessen.“ amber (`rgb(138,106,47)`), kaydedilmedi. Kasse DAK-Gesundheit + IK 100167999 geri girildi → uyarı kalktı → kaydedildi → **sayfa yenilendi** → form DAK-Gesundheit / 100167999 (son hâl = başlangıç). Not: Versichertenstatus „1000“ (test verisi, 4 hane) her kayıtta kırmızı toast üretiyor ama bloklamıyor — IK hatası da olduğunda iki geri bildirim üst üste çıkıyor. Konsol: yalnız bilinen gürültü.

### Terminkalender — Neuer Termin (Verordnung kartı ile) — nav etiketi: `calendar`

**Beklenen:** Hasta seçilince aktif Verordnung kartı çıkar; kart seçilince Leistung satırları
(ilk seansta 78040+78010, sonra 78030+78010) önerilir ve kayıt sonrası termin
`bookings.verordnung_id` ile Verordnung'a bağlanır (sayaç "Termine (n)" artar). Çakışan saat
DB kısıtıyla (`no_overlapping_bookings`) reddedilir ve kullanıcıya anlaşılır mesaj gösterilir.
**Bağımlı ekranlar:** `verordnungen` (Termine vergeben/unvergeben), Termin-Aktionen paneli, `podologie-billing`
**Son test:** 2026-09-28 — KALDI. (1) Kart seçilerek kaydedilen 2/2 termin `verordnung_id=NULL`
(bağlanmadı; bağlama yalnız portaldan sürüklenen seansta çalışıyor). (2) Çakışma 23P01 ile
reddedildi ama UI sessiz (modal açık kalıyor, mesaj yok). (3) Kart seçildikten sonra "Alle
Sitzungen bereits vergeben." yazıyor (0/3 iken). Taşıma (Ändern → Verschieben → hedef → onay)
GEÇTİ; takvimde sürükle-bırak yok.
**Son test:** 2026-09-28 (kontrol turu) — madde (2) ÇÜRÜTÜLDÜ: UI sessiz DEĞİL. TEST-Karl,
Selbstzahler, 29.09 09:30 → tek `POST bookings` 400/23P01, ~0,45 sn sonra kırmızı toast
"Dieser Zeitraum ist für diese:n Mitarbeiter:in bereits belegt. Bitte eine andere Uhrzeit
wählen." — 3,5 sn ekranda (ölçülen 452→3959 ms), modal açık kalıyor, randevu yazılmadı (iki
denemede de 400). Kalan zayıflık yalnız UX: toast sağ altta, modaldan uzak ve kısa; modal
içinde kalıcı bir hata satırı yok → gözden kaçabilir (ilk turun kaçırma sebebi muhtemelen bu).
Önem P1 → P3. Kanıt: `C:\tmp\pq\shots\kontrol\k1-toast.png`. (1) ve (3) bu turda sınanmadı.
**Son test:** 2026-09-28 (S1 doğrulama, `2d8aea5`) — TEST EDİLEMEDİ. Canlı `module/podologie-abrechnung.js`
SyntaxError veriyor (`Unexpected identifier 'max'`, satır 783: `2d8aea5`'in template literal içindeki
HTML yorumuna koyduğu backtick'ler dizgiyi erken kapatıyor). `dashboard.js:38` bu modülü statik
import ettiği için tüm dashboard boş render ediyor (body boş, sidebar yok) — P0, bütün hesaplar. S1.1 sınanamadı.
**Son test:** 2026-09-29 (S1 regresyon, hotfix `94c753c`) — GEÇTİ. QA tenant, TEST-hasta, DF Verordnung kartı seçildi: "Alle Sitzungen bereits vergeben" YOK, "Noch 3 von 3 Einheiten offen." var. Kaydet → `POST bookings` 201 + `PATCH bookings?id=eq.ac98464a` gövdesi `{"verordnung_id":"796aae21…"}` 200. Sayfa yenilendikten sonra Verordnung portalında "Termine: 1 vergeben — 01.10.26 · 11:00" (madde (1) ve (3) kapandı). Test randevusu Bearbeiten → "Löschen" (= `absageTerminMitGrund`, status=cancelled, silme değil) → sebep seçilip iptal edildi, `PATCH /api/booking/ac98464a` 200. Yeni konsol hatası yok. Not: yan paneldeki buton "Löschen" etiketli ama işlevi Absagen; önceki "Absagen" beklenti metni buna göre okunmalı.
**Son test:** 2026-09-29 (S1.2, `2db4146`) — GEÇTİ. Kartsız kaydedilmiş podo randevusu (test, 28.09 16:00, `51841395`) → Termin-Aktionen "Bearbeiten" → Verordnung kartı seçildi ("Noch 3 von 3 Einheiten offen.") → Speichern → "Termin in der Vergangenheit" onayı → DB'de `verordnung_id=796aae21` yazıldı; panel hemen 1/3 gösterdi, yenileme sonrası takvimden açınca da 1/3 + "Termine (1)". Bilinen P3 duruyor: düzenleme penceresinin başlığı "Neuer Termin". Yan gözlem: geçmiş tarihli randevunun paneli açılınca `status` kendiliğinden `completed` oluyor (realtime UPDATE) — mevcut davranış, bu turun kapsamı dışı. Kanıt: `C:\tmp\pq29\02-bearbeiten-karte.png`, `03-panel-nach-bearbeiten.png`.
**Son test:** 2026-09-29 (S1.9–1.11, `24d751b`) — S1.11a GEÇTİ: bağlı randevu (`51841395`) Bearbeiten maskesinde ve "Serie verteilen" seri maskesinde Verordnung kartı gerçek sayıyı gösteriyor (1/3; önceki P2 "0/3" kapandı). S1.9 SINANAMADI: QA tenant'ta tek podo reçetesi var (`796aae21`, ausstellungsdatum 28.09, behandlungsbeginn dolu) — 28 günden eski, beginn'siz reçete yok, "Behandlungsbeginn verpasst" sperresi gözlenemedi; veri üretilmedi.
**Son test:** 2026-09-29 (S1.12, `ee51827`; canlı `?v=20260929g`) — GEÇTİ. "+ Termin" → TEST-hasta → `796aae21` kartı (bkSelectedRxId doğrulandı): Leistungen altında İŞARETSİZ „Vorschlag: Befundung (78030) übernehmen (+30 Min.)", ipucu „Befundung (78030) — die Eingangsbefundung ist am 28.09.2026 bereits dokumentiert." („abgerechnet" yok, TT.MM.JJJJ), Dauer 35 (yalnız 78010). KAYDEDİLMEDİ (Abbrechen). Not: bu anda kart 3/3 + „Alle Sitzungen bereits vergeben." gösterdi çünkü seri randevuları henüz iptal edilmemişti — beklenen.
**Son test:** 2026-09-29 (S3.11 `7331d46`; canlı `?v=20260929o`) — GEÇTİ, üç yol. Praxis'in 78030 hizmetleri `duration_minutes=NULL` (Einstellungen'e dokunulmadı; `services` REST ile okundu). (1) Tekli „+ Termin" → TEST-Hilde → `796aae21` kartı („Noch 2 von 3 Einheiten offen."): öneri metni „Vorschlag: Befundung (78030) übernehmen" — **„(+30 Min.)" eki YOK**; Dauer 35; kutu işaretlenince ikinci satır „Podologische Befundung" eklendi, Dauer **35 kaldı**; işaret kalkınca satır gitti. (2) Bağlı randevu `51841395` → „2 offene Einheiten als Serie verteilen" → „Befundung (78030) in alle Serientermine übernehmen" (ek yok), işaretli/işaretsiz Dauer 35 („kombiniert"/„geschätzt"), Termin-Block 57 iki durumda da aynı. (3) Folgetermin yolu: aynı paneldeki Verordnung kutusundan „#2 Befundung (78030) + Behandlung" öğesi 28.09 10:00 slotuna bırakıldı (sentetik DragEvent, gerçek `application/rx-session` verisiyle) → „Folgetermin erstellen": Leistungen'de Befundung **satır olarak yok**, yalnız „Leistung aus der Verordnung: Podologische Behandlung (klein)" + İŞARETSİZ „Vorschlag: Befundung (78030) übernehmen", Dauer 35; işaretlenince Befundung satırı geldi, Dauer 35. Hiçbiri kaydedilmedi, yeni booking yok. Gözlemler (P3, bulgu değil): (a) Folgetermin maskesindeki şerit hâlâ „Einheit #2: Befundung (78030) + Behandlung" diyor, Befundung artık yalnız öneri; (b) tekli maskede Hausbesuch'lu hastada „Termin-Block: ca. 52" kart seçilip Dauer 35 olduktan sonra güncellenmedi, seri maskesinde aynı hasta 57 (35+6+6+10) — tekli maskede blok eski Dauer ile kalmış olabilir, doğrulanmadı; (c) aynı hasta (TEST-Hilde: sütun `hausbesuch=false`, legacy metadata `true`) tekli ve seri maskesinde Hausbesuch **önseçili**, Folgetermin maskesinde **işaretsiz**; reçete `hausbesuch=false` — S3.1 okuyucusu „true kazanır" kuralıyla tasarım gereği, ama üç yol tutarsız → `podoloji`'ye: Hausbesuch önseçimi hastadan mı reçeteden mi gelmeli?
**Son test:** 2026-09-30 (S3.5 `a541ae3` + S3.10 `410cc6f`) — GEÇTİ. **S3.10:** TEST-Hilde + `06dbeb5c` kartı + Hausbesuch (önseçili, kayıtlı mesafe 2 km/6 dk) → 30.09 09:00 → `POST bookings` 201 **`396000d2`**, `customer_name` = yalnız „Vorname Nachname“ (2 kelime, `·` ve rakam yok), `lead_id` dolu; `PATCH verordnung_id=06dbeb5c` 200; `booking_leistungen` 1 satır; blok 09:00–09:57. Kalender kartı „Nachname, Vorname“ (doğum tarihi kartta yok — tasarım: kart yalnız adı gösterir); 29.09 ve 28.09'daki eski („Name · Datum“ dönemi) kartlarda tarih ad yerine geçmiyor. **S3.5:** aynı saate ikinci termin (Selbstzahler, Hausbesuch kapalı) → `POST bookings` 400/23P01 → modal açık kaldı, `#bkSaveError` (role=alert) Speichern düğmesinin 29 px üstünde „Dieser Zeitraum ist für diese:n Mitarbeiter:in bereits belegt. Bitte eine andere Uhrzeit wählen.“; hata toast'u YOK. Abbrechen → yeniden „+ Termin“ → kutu boş/gizli. B-078'in UX artığı kapandı.

### Termin-Aktionen (sağ panel) — nav etiketi: (Terminkalender içinden)

**Beklenen:** Termin başlığı + Ändern, hasta özeti, Verlauf, "Termin Starten", Fußbefund,
Bearbeiten/Absagen/Nicht erschienen, Verordnung özeti ve seans listesi. Değişiklikten
(taşıma) sonra panel güncel zamanı göstermeli.
**Son test:** 2026-09-28 — KALDI. "Löschen" düğmesi aslında "Termin absagen" diyaloğu açıyor
(absage + gerekçe GEÇTİ). Taşımadan sonra panel eski saati göstermeye devam etti. Podolojide
"Termin Starten" → "Sitzungsnotiz … Sitzung abschließen": not hiçbir tabloya yazılmıyor
(`markPrescriptionSession` fizyo defterine yazıyor), booking `confirmed` kalıyor, ekran fizyo
Anamnese paneline atlıyor.
**Son test:** 2026-09-28 (kontrol turu) — "Offene Einheiten als Serie verteilen" podolojide
YOK: `#bkRxSerieBtn` DOM'da var ama gizli; `module/podo-einheiten.js:320` onu podoloji
Verordnung'unda bilerek kapatıyor ("prescription_sessions-Zeilen, die es hier nicht gibt").
Tek yol tek tek sürüklemek. Aynı panelde çelişki: "Aktive Verordnungen: 78010 … 0/3" listesi
görünürken hemen altındaki "Aktive Verordnung" kutusu "Für diesen Patienten ist keine aktive
Verordnung hinterlegt." diyor (reçete 1-1 "Abgerechnet"). Ayrıca "Ändern" ile Hausbesuch
işaretlenince termin süresi sessizce 65 → 87 dk uzadı (bitiş 10:05 → 10:27) — niyet mi, `podoloji`'ye
sorulmalı. Kanıt: `k4-aktionen.png`, `k3-termin-starten.png`.
**Son test:** 2026-09-29 (S1.3, `2a596dc`) — GEÇTİ. Bağlı podo randevusunda "Für diesen Patienten ist keine aktive Verordnung hinterlegt." YOK; kart sayacı bağlı (iptal edilmemiş) randevu sayısını gösteriyor: 1 bağlıyken 1/3, 3 bağlıyken 3/3 (iptal edilmiş eski bağlı randevu sayılmıyor). Alt blok "Aktive Verordnung — n offen / 3 ges." + "Termine (n)" aynı reçeteyi gösteriyor. İki yükleme yolu, ikisi de sayfa yenilendikten sonra: takvim (Tag görünümü) ve Dashboard "Heutige Termine" listesi — ikisi de doğru. Kartsız (bağsız) randevuda eski metin hâlâ çıkıyor (beklenen, S1.3 kapsamı bağlı randevu). Yan gözlem (P2, kapsam dışı): Rezeptinfo "Status: gesendet" için tooltip "Unbekannter Status — steht so in der Datenbank." diyor, `gesendet` geçerli bir `abrechnung_status`. Kanıt: `C:\tmp\pq29\04-panel-kalender-reload.png`, `06-panel-heute-liste.png`.
**Son test:** 2026-09-29 (S1.8, `72e56cb`) — GEÇTİ (bir P1 yan bulguyla). Bağlı podo randevusu (`51841395`, 28.09, reçete `796aae21` DF, frequenz "1x alle 3 Wochen", hausbesuch=false) paneli: "🗓 2 offene Einheiten als Serie verteilen" görünüyor (blok "2 offen / 3 ges." ile tutarlı); seri bitince 0 offen → düğme gizli. Tık → "Neuer Termin" seri moduyla açıldı: `bkSeriesToggle` açık, `bkSeriesCount=2`, `bkSeriesRecurrence="1x alle 3 Wochen"` (reçeteden, uyarı çıkmadı — frequenz tanındı), hafta günü yalnız Mo (başlangıç 05.10 Pazartesi), Hausbesuch kapalı (reçeteye uygun); KI-Präferenzen diyaloğu doğrudan açıldı. "Vorschläge holen" → 2 slot (Mo 05.10 09:00, Mo 26.10 09:00 — 3 hafta ara) → "Termine erstellen" → DB'de 2 yeni booking `verordnung_id=796aae21`, `prescription_sessions` 0 satır (doğru). Yenileme sonrası panel "0 offen / 3 ges.", "Termine (3)". **P1 yan bulgu:** maske 2 Leistung (78010 + Befundung 78030) ve "Dauer 65 kombiniert" gösterirken seri randevuları 35 dk ve `booking_leistungen` satırsız kaydedildi (tekli kayıt `51841395`'te 2 satır var) — `dashboard.js:6773` KI-batch payload'ı yalnız `service.duration` gönderiyor, `speichereLeistungen` çağrılmıyor. **P2:** seri maskesindeki Verordnung kartı "0/3" gösterdi (panel aynı anda 1 bağlı) — seriden sonra panelde 3/3. **P2:** e-posta diyaloğu (hasta e-postası yok) ✕ ile kapatılınca "Rechnungen" paneline "Rechnung vorbereitet" ile atladı (✕ = "Nein, weiter zur Rechnung" gibi davranıyor; gelecek randevular için fatura adımı şüpheli, `podoloji`'ye sorulmalı). Konsol: yalnız bilinen gürültü. Temizlik: `b70cf53b` + `4ee608f6` Löschen → Termin absagen (Sonstiges "QA-Testtermin Bereinigung") ile iptal edildi, Ausfallrechnung sorulmadı; reçete yine 1/3.
**Son test:** 2026-09-29 (S1.9–1.11, `dbd79f0`/`32f1a4d`/`24d751b`) — GEÇTİ. "2 offene Einheiten als Serie verteilen" → maske: 78010 klein + Podologische Befundung (yazılım önerisi), Dauer 65 kombiniert, 1x alle 3 Wochen. `ai-suggest-series` isteği `duration:65` gönderdi, backend `service.duration:65` döndü (backend deploy inmiş); öneri 2 slot (Mo 05.10 09:00, Mo 26.10 09:00), übersprungen/Konflikt yok. "Termine erstellen" → `9644badf` + `ec2e1f35`: ikisi de 65 dk, `verordnung_id=796aae21`, `booking_leistungen` 2 satır (78010 klein + Befundung, tekli kayıtla aynı) — S1.8'in P1 bulgusu kapandı. E-posta diyaloğu başlığı "Terminübersicht mitgeben?", hasta e-postasız → yalnız "Schließen" + "Direkt drucken", e-posta alanı yok; "Schließen" → Terminkalender'de kalındı, "Rechnung vorbereitet"/"weiter zur Rechnung" yok (S1.8 P2 kapandı). Seri sonrası panel "0 offen", Serie düğmesi gizli. **Açık soru (P2, `podoloji`'ye):** maske "Befundung (78030) — die Eingangsbefundung wurde am 2026-09-28 bereits abgerechnet." ipucunu gösterirken Befundung satırını "von der Software vorgeschlagen" olarak önseçili bırakıyor; seri randevularına ikinci bir Befundung taşınıyor. Konsol: yalnız bilinen gürültü (visibility_reports 403, nominatim CSP, loadActivityFeed). Temizlik: iki seri randevusu Löschen → Termin absagen (Sonstiges "QA-Testtermin Bereinigung") ile iptal, Ausfallrechnung sorulmadı; yenileme sonrası reçete 1/3, "2 offen / 3 ges.".
**Son test:** 2026-09-29 (S1.12, `ee51827`; canlı `?v=20260929g`) — GEÇTİ. Bağlı randevu `51841395` → „2 offene Einheiten als Serie verteilen" → maske: Leistungen listesinde yalnız 78010 satırı; altında İŞARETSİZ „Befundung (78030) in alle Serientermine übernehmen (+30 Min.)"; ipucu „… Eingangsbefundung ist am 28.09.2026 bereits dokumentiert." („abgerechnet" YOK); Dauer 35. Kutu işaretlenince ikinci Leistung satırı (Podologische Befundung) + Dauer 65, işaret kaldırılınca satır kalkıyor + Dauer 35 (DOM ölçümü). İşaretsiz → KI „Vorschläge holen" (Mo 05.10 09:00, Mo 26.10 09:00) → „Termine erstellen" → **`d85625a1`** + **`66bfdd15`**: ikisi de 35 dk, `verordnung_id=796aae21`, `booking_leistungen` yalnız 1 satır (`ec3cb34d` = 78010), 78030/78040 YOK (REST, kullanıcı JWT'si). S1.9–1.11 turundaki açık P2 soru (seriye ikinci Befundung taşınıyor) bununla kapandı. Gözlem (bulgu değil): seri maskesinde Verordnung kartı vurgulanmıyor, `bkSelectedRxId` boş — bu akış reçeteyi `window._physioFlow.prescription_id` üzerinden taşıyor (`module/termin-aktionen.js:540`), bağlama doğru çalıştı; hastanın 2 podo reçetesi varken hangisinin planlandığı ekranda görünmüyor → UX sorusu, `podoloji`'ye. Temizlik: iki randevu Löschen → „Termin absagen" (Sonstiges „QA-Testtermin Bereinigung") ile iptal, Ausfallrechnung sorulmadı; yenileme sonrası `796aae21` 1/3, „2 offen / 3 ges.", „Termine (1)". Konsol: yalnız bilinen gürültü.

### Hausbesuch — Fahrt Starten / Angekommen / Fahrt Beenden — nav etiketi: (Termin-Aktionen içinden)

**Beklenen:** Araç seç + Start-km → "Ich bin angekommen" → Termin Starten → Fahrt Beenden (End-km)
→ `fahrten` satırı. "+ Neues Privatfahrzeug" tek araç, `kind='privat'` yazmalı.
**Son test:** 2026-09-28 — KISMEN. Fahrt zinciri GEÇTİ (fahrten satırı 4 km, zaman damgaları
doğru). KALDI: "+ Neues Privatfahrzeug" tek tıkta iki araç satırı + `kind='gewerblich'`.
Podoloji menüsünde Fahrtenbuch girişi yok.
**Son test:** 2026-09-28 (kontrol turu) — çift bağlama DOĞRULANDI. Statik: 9/9 düğmede inline
`onclick=window.__fb.*` var, `window.__fb` yüklü, `__fbDelegatedBound=true` → her tık iki handler.
Canlı (20.10 TEST-Hilde, Hausbesuch'a çevrildi, araç TEST-QA 1): "Fahrt Starten"-Kaydet →
2× `PATCH bookings` + 2× `POST fahrten?on_conflict=booking_id`; "Ich bin angekommen" → 2× `PATCH
bookings`; "Fahrt Beenden"-Kaydet (20003) → 2× `PATCH bookings` + 2× `POST fahrten`. Veri
bozulmadı: upsert sayesinde tek `fahrten` satırı (20000→20003, 3 km), booking `fahrt_completed`.
Modal açan düğmeler (Fahrt Starten/Beenden aç) iki kez açıyor, görünür etki yok. Gerçek hasar
yalnız guard'sız insert'lerde (araç ekleme — 28.09'da iki satır kanıtlandı; araç listesinde hâlâ
iki "TEST-QA 1"). Önem P1 kalır (araç çiftlenmesi), Fahrt zinciri için P3.
**Son test:** 2026-09-29 (S3.3/S3.4 `cc6f346` + S3.13 `46faff6`; canlı `?v=20260929o`) — S3.3/S3.4 GEÇTİ, S3.13 KALDI (P1). Fahrtenbuch → Fahrzeuge → „+ Neues Fahrzeug" (düğme etiketi bu): başlık „Neues Fahrzeug", Art seçenekleri „🏢 Praxisfahrzeug (für alle sichtbar)" [varsayılan, owner] / „🚙 Privatfahrzeug (nur ich)" → „TEST-QA S34" kaydet → **tek** `POST vehicles` (201), listede tek satır (**`c79a59f1`**, kind `gewerblich`). Bearbeiten → başlık „Fahrzeug bearbeiten" → Bezeichnung → **tek** `PATCH vehicles` (204). Fahrten → „CSV exportieren" → **tek** indirme (anchor.click + createObjectURL sayacı 1/1; dosya kaydedilmedi). Fahrt Starten (yeni Hausbesuch test randevusu `7a6fc08b`, reçete `ddf57e1b`) → „+ Fahrzeug" → aynı form („Neues Fahrzeug", Praxis varsayılan) → „TEST-QA S34b" → tek POST (**`8a674747`**) → Fahrt Starten modalı açık kaldı, yeni araç **seçili**. Abbrechen → yazma yok. `window.__fb` = undefined, konsolda `__fb` izi yok. Fahrt zinciri artık tekil: Fahrt Starten → 1× `PATCH bookings` + 1× `POST fahrten`; „Ich bin angekommen" → 1× `PATCH bookings` (28.09'daki çift istek kapandı). **S3.13 KALDI:** „Termin Starten" (fahrt_arrived) → `PATCH bookings {fahrt_status:'in_progress'}` → **400 / 23514** `bookings_fahrt_status_check` (izinli değerler: fahrt_started/arrived/return_pending/completed — `in_progress` yok). Kod hatayı yutup yerel önbelleği `in_progress` yapıyor, Tagesbehandlung'a geçiyor; Behandlung **`81cd1398`** (78010) kaydedildi ama „Hausbesuch: Fahrt ist noch offen." + „Fahrt beenden" **çıkmadı** — `zeigeFahrtHinweis` DB'den `fahrt_status==='in_progress'` bekliyor, DB'de `fahrt_arrived`. Termin-Aktionen yeniden açılınca yalnız „▶ Termin Starten" (rozet „Angekommen"), „Fahrt Beenden" yok → podoloji Hausbesuch'unda Fahrt UI'dan kapatılamıyor. Fahrt `97206371` Fahrtenbuch ✏️ „Fahrt bearbeiten" ile End-KM 30004 girilerek kapatıldı (tek `PATCH fahrten` 204) — geçici yol; booking `fahrt_status=fahrt_arrived` kaldı. Devir paketi: aşağıda „builder'a devredilenler". Yan: yeni Fahrt satırında Fahrtzweck/Zielort boş (önceki satırlarda Beenden adımında dolduruluyordu).
**Son test:** 2026-09-30 (S3.13 hotfix `96c0320`; canlı `dashboard.js?v=20260929t`, canlı `module/fahrt-beenden.js` `fahrt_return_pending` karşılaştırıyor) — GEÇTİ, P1 kapandı. Randevu `396000d2` (Hausbesuch, `06dbeb5c`), araç `c79a59f1`: Fahrt Starten (30010) → 1× `PATCH bookings {fahrt_status:fahrt_started}` 200 + 1× `POST fahrten` 201 → „Ich bin angekommen“ → `PATCH {fahrt_status:fahrt_arrived}` 200 → „▶ Termin Starten“ → **`PATCH {fahrt_status:fahrt_return_pending}` 204** (23514 yok) → Tagesbehandlung açıldı (`1-4` seçili, tarih 30.09, 78010+78030+79933 önseçili) → Behandlung speichern → `POST podologie_behandlungen` 201 + `behandlungsbeginn=2026-09-30` → „Hausbesuch: Fahrt ist noch offen.“ + **„Fahrt beenden“** göründü → End-KM 30014 → `PATCH {fahrt_status:fahrt_completed,end_km:30014}` 200 + `POST fahrten?on_conflict=booking_id` 200 (upsert, `lead_id` bu adımda dolduruldu) → ipucu kayboldu. Yenileme sonrası Fahrtenbuch'ta TEK satır: 30010→30014, 4 km, Fahrtzweck „Hausbesuch <Patient>“, Zielort dolu, Gewerblich; Termin-Aktionen „Hausbesuch · Abgeschlossen · Fahrt + Termin abgeschlossen“. Konsol: yalnız bilinen gürültü. Gözlem (P3): Fahrt Starten'deki ilk `POST fahrten` `lead_id:null` gönderiyor, Beenden'de dolduruluyor. Termin-Aktionen'deki alternatif „Fahrt Beenden“ yolu (`fahrt_return_pending` dalı) bu turda sınanmadı.
**Son test:** 2026-09-30 (S3-Reste `2e4275f`, `leadIdFuerFahrt`; canlı `?v=20261001b`) — GEÇTİ, önceki P3 gözlemi kapandı. Yeni Hausbesuch test randevusu **`e48f89a4`** (02.10.2026 10:00, `customer_phone` NULL, `lead_id`=`a8e9df53`, Verordnung `50139501`) → Termin-Aktionen „Fahrt Starten“ → araç `c79a59f1`, Start-KM 30020 → `fahrten` **`2ec11d8f`**: `lead_id` başlangıçta dolu (`a8e9df53`), `start_km=30020`, `end_km` NULL; booking `fahrt_status=fahrt_started`. Telefon boş olduğu için eski telefon eşlemesi burada null verirdi — yeni `bookings.lead_id` yolu çalıştı. ⚠ Fahrt AÇIK bırakıldı (kapatmak Tagesbehandlung yazmayı gerektirir) — açık Fahrt randevunun iptalini bloklar; temizlik kararı kullanıcıda.

### Fußbefund — nav etiketi: `fussstatus`

**Beklenen:** Hasta + (opsiyonel) termin seçilir, işaretler/diagram kaydedilir, sağda "Gespeicherte Befunde" listesi.
**Son test:** 2026-09-28 — GEÇTİ (mekanik): Diabetes/Gerinnungshemmer/Hornhaut + 1 Clavus
işareti kaydedildi, liste güncellendi. Domain açığı (Wagner/Sensibilität/Puls yok) `podoloji`'ye soruldu.

### §302-Abrechnung — Neue Abrechnung → Erstellen (UI geri bildirimi) — nav etiketi: `abrechnung`

**Beklenen:** "Erstellen" sonrası başarı mesajı + "Bisherige Abrechnungen"a dönüş; Praxis-IK
yoksa anlaşılır, ayara yönlendiren hata.
**Son test:** 2026-09-28 — KALDI (UI). IK'siz: "Kein IK-Nummer hinterlegt" (dilbilgisi, yönlendirme
yok). IK'li: TSOL0001.dta + .auf + Begleitzettel DB/Storage'da oluştu (Auftragsdatei düğmesi
detayda GÖRÜNDÜ — 20.09'da sınanamayan madde kapandı), ama ekran "Neue Abrechnung — keine
abrechnungsbereiten Verordnungen" görünümünde kaldı; yalnız sayfa yenileme listeyi gösterdi.
Sonrasında Verordnung "an die Kasse übermittelt, festgeschrieben" diyor — dosya yalnız oluşturuldu.
**Son test:** 2026-09-28 (kontrol turu) — "‹ Zurück" KISMEN. Taze yüklemede: Bisherige → Zurück
✓, Bisherige → satır seç → Zurück ✓, Neue Abrechnung → Zurück ✓; yeni konsol hatası yok (taban
5 hata sabit kaldı). Asıl iddia ("Erstellen"den SONRA Zurück/panel değişimi takılıyor) bu turda
sınanmadı — "Erstellen"e basmak yasaktı. Yani Zurück'ün kendisi sağlam; takılma, Erstellen
sonrası durum yenilenmemesine bağlı olabilir (başarı toast'ı yok + liste yenilenmiyor maddesi
açık kalır). Kanıt: `k2-bisherige.png`, `k2-zurueck1.png`, `k2-neue.png`, `k2-zurueck2.png`.
**Son test:** 2026-09-28 (S1 doğrulama, `2d8aea5`) — TEST EDİLEMEDİ. Canlı `module/podologie-abrechnung.js`
SyntaxError veriyor (`Unexpected identifier 'max'`, satır 783: `2d8aea5`'in template literal içindeki
HTML yorumuna koyduğu backtick'ler dizgiyi erken kapatıyor). `dashboard.js:38` bu modülü statik
import ettiği için tüm dashboard boş render ediyor (body boş, sidebar yok) — P0, bütün hesaplar. S1.6 sınanamadı.
**Son test:** 2026-09-29 (S1 regresyon, hotfix `94c753c`) — SINANAMADI (veri yok). Panel açılıyor, "Neue Abrechnung" → "Keine abrechnungsbereiten Verordnungen."; tedavisiz 78030 günlü DF/NF/QF reçete QA tenant'ta yok, sperre metni gözlenemedi. Veri üretilmedi. "Erstellen"e basılmadı.
**Son test:** 2026-09-29 (S2.1, `13d4351`; canlı backend image `:beta` = `ee51827`, `13d4351`'i içeriyor — GHCR etiketinden doğrulandı) — GEÇTİ. QA tenant (test2), Betriebsart `test` (Vorgabewert, `betriebsart_empfaenger` boş). Yeni test verisi: Verordnung **`f77efc4c`** (TEST-Hilde, DF, E11.74, Leitsymptomatik a → 78010, 1 Einheit, 1x alle 3 Wochen, Ausstellung 29.09), Tagesbehandlung **`bd1aa13b`** (29.09, 78010 + 78030) → reçete `bereit`. Neue Abrechnung → yalnız bu reçete listelendi (AOK Rheinland/Hamburg, 1 Verordnung, Kassenanteil 25,70 €) → **bir kez** "Erstellen" → **`TSOL0002`**, abrechnung **`985371d2`** (`status=erstellt`, `betriebsart=test`, `.auf` yolu dolu), 1 `abrechnung_zeile` (`a5af9cd9`, belegnummer 1-2, 78010+78030). DB (salt-okuma, kullanıcı JWT'si ile REST): reçetede `belegnummer=NULL`, `abrechnung_status=bereit`, `abrechnung_id=NULL`, `zuzahlung_eur=NULL`, `updated_at` Erstellen'den önceki (18:50:45Z < 18:53:08Z) — yani reçeteye hiç yazılmadı. Sayfa yenilendikten sonra: "Neue Abrechnung 1 Verordnung bereit · 25,70 €", reçete yine seçilebilir; Verordnung maskesinde "an die Kasse übermittelt … festgeschrieben" kilidi YOK, 35 alanın hiçbiri disabled/readonly değil (kontrol: eski `796aae21` aynı maskede kilit metnini gösteriyor). Liste rozeti "Bereit zur Abrechnung". Konsol: yalnız bilinen gürültü; bir kez `/api/billing/positions/podologie` CORS/ERR_FAILED — o anda Watchtower yeni image'a geçiyordu (sonraki commit'ler `9a71119`/`e2144ac`), birkaç saniye sonra `/api/krankenkassen` 200, tekrar açılışta hata yok → geçici, bulgu değil. Frontend S2.4 (`9a71119`) de canlıydı: Erstellen sonrası ekran doğrudan "Bisherige Abrechnungen"a geçti, TSOL0002 listede. `abrechnung_zeile.status=eingereicht` (bilinen 2.2 çelişkisi, bulgu olarak yazılmadı). **Sonraki S2 testleri `f77efc4c`'yi kullanacak — silme.** DTA indirilmedi/gönderilmedi. Gözlemler (P2, domain teyidi gerek): (a) Bisherige özeti test dosyalarını "offen €" olarak topluyor ("2 Dateien · 2 offen · 68,99 € offen"); S2.1'den sonra aynı reçete her test turunda yeni bir TSOL dosyasına girebildiği için bu tutar her testte büyür — `gkv-302`'ye: test dosyası açık alacak sayılmalı mı? (b) Neue Abrechnung tablosunda "Einheiten 2 / 1" (erbracht/verordnet — 78030 Befundung da "erbracht" sayılıyor, `module/abrechnung-auswahl.js:843-846`); 1 Einheit'lik reçetede fazla fatura izlenimi veriyor — `podoloji`/`gkv-302`'ye.
**Son test:** 2026-09-29 (S2.4 `9a71119` + S2.7 `e2144ac`; canlı `?v=20260929i` — S2.3 `2c3fc45` ve S2.2 `36fb9ff` test sırasında indi) — S2.4 GEÇTİ, S2.7 SINANAMADI (statik GEÇTİ). Betriebsart `test` (`terapeut_zertifikat`, `betriebsart_empfaenger` boş). Neue Abrechnung → yalnız `f77efc4c` (AOK Rheinland/Hamburg, 25,70 €) → **bir kez** „Erstellen" → toast „Abrechnungsdatei erstellt: TSOL0003 ✓", sayfa yenilenmeden „Bisherige Abrechnungen"a geçti, **`TSOL0003`** (abrechnung **`a4d4e713`**, `status=erstellt`, `betriebsart=test`, zeile `70ab494d`) listede en üstte, „Test" etiketiyle (S2.2). S2.3 onay modalı ÇIKMADI (açık birim yok — doğru). „‹ Zurück" → Neue Abrechnung: son protokol („✓ AOK Rheinland/Hamburg — R2026-W40-003 · 2 Positionen", „1 von 1 Abrechnung erstellt.") görünüyor; liste boş değil çünkü test modunda reçete `bereit` kalıyor — protokolün BOŞ-liste durumu bu veride oluşamıyor (sınanamadı). S2.1 regresyonu: `f77efc4c` `belegnummer=NULL`, `abrechnung_status=bereit`, `abrechnung_id=NULL`, `updated_at` değişmedi (18:50:45Z). Yenileme sonrası „3 Dateien · 3 offen · 94,69 € offen" — test dosyalarının „offen" toplamı büyümeye devam ediyor (S2.1 gözlemi (a), `gkv-302` sorusu açık). DTA indirilmedi/gönderilmedi. Geçici: test ortasında bir kez `/api/billing/*` preflight CORS/ERR_FAILED (Watchtower S2.3 image geçişi), 2 dk yoklamada `/api/krankenkassen` 200 + OPTIONS 204 stabil, Erstellen ondan sonra yapıldı. S2.7 statik: canlı `module/abrechnung-auswahl.js?v=20260929e` içinde „IK jetzt eintragen" + `.ab-ik-gehzu` (2+2 eşleşme, tık → `window.gehZuEinstellung('settingsAbrechnungSection','setIkNumber')`), `window.gehZuEinstellung` = function, `#settingsAbrechnungSection` ve `#setIkNumber` DOM'da. Canlı akış: IK bilinçli olarak silinmedi → SINANAMADI.
**Son test:** 2026-09-29 (S2.3 `2c3fc45` / S2.2 `36fb9ff`; canlı `?v=20260929i`, backend `:beta` digest = `36fb9ff` etiketi, GHCR'den doğrulandı) — S2.3: elle-Bereit yolu GEÇTİ, Neue-Abrechnung yolu (liste „N offen" + Erstellen modalı) SINANAMADI. Yeni test verisi (silme): Verordnung **`ddf57e1b`** (TEST-Hilde, DF, E11.74, Leitsymptomatik a → 78010, **3 Einheiten**, 1x alle 3 Wochen, Hausbesuch nein, Kasse-IK 104212505, Nr. 1-3), Behandlung **`b656a023`** (29.09, yalnız 78010) → 2 offen, `abrechnung_status=NULL`. **Neden sınanamadı:** Neue Abrechnung podo tarafında yalnız `status==='abrechenbar'` (= `abrechnung_status='bereit'`) reçeteleri listeler (`module/abrechnung-auswahl.js:594`); açık birimli reçete kendiliğinden `bereit` olmaz (sayaç `anzahl_einheiten`'e ulaşınca olur, `module/podologie-abrechnung.js:1087`). Yeni reçete listede YOK, liste yalnız `f77efc4c`'yi (önseçili) gösterdi. Liste yoluna varmak için reçetenin önce `bereit`'e çekilmesi gerekir (elle Bereit + onay veya 3/3 + storno) — ikisi de reçeteyi kalıcı değiştirir, bu turda yapılmadı, karar çağırana bırakıldı. **Elle Bereit (Behandlungen → reçete kartı „Status" → „Abrechnungsstatus ändern", aktuell „In Behandlung", hedef „Bereit zur Abrechnung" → Übernehmen):** `PATCH /api/billing/verordnung/ddf57e1b…/abrechnungsstatus` → **428**, ardından onay penceresi, birebir: başlık „Verordnung vorzeitig abrechnen?" · gövde „Es sind noch 2 Einheit(en) offen. Mit der Abrechnung wird die Verordnung beendet – die offenen Einheiten können auf dieser Verordnung nicht mehr erbracht oder abgerechnet werden. Bitte das Datum des Behandlungsabbruchs auf der Rückseite der Verordnung vermerken." + ayrı paragraf „Bereits erbrachte, aber noch nicht dokumentierte Einheiten bitte vorher nachtragen." · düğmeler „Abbrechen" / „Trotzdem abrechnen". **Abbrechen** → pencere kapandı, durum diyaloğunda hata satırı yok; DB (salt-okuma, kullanıcı JWT'si): `abrechnung_status=NULL`, `abrechnung_status_manuell_am=NULL`, `updated_at` değişmedi (19:31:48Z, Behandlung kaydı anı), `prescription_validations`'ta bu reçete için yalnız oluşturma kaydı (`engine=standard`). Onaylanmadı. `abrechnung` sayısı 3 (değişmedi). Konsol: 428 + bilinen gürültü (visibility_reports 403, nominatim CSP, loadActivityFeed) + kendi REST sorgularımın iki 400'ü (yanlış kolon adı).
**Son test:** 2026-09-29 (S2.3 liste yolu `2c3fc45`; canlı `?v=20260929o`, Betriebsart `test`, `betriebsart_empfaenger` boş) — GEÇTİ. Sıra notu: madde 4 (S3.13) bu reçeteye bir Behandlung ekledi (`81cd1398`), bu yüzden `ddf57e1b` bu turda **2/3, 1 offen** idi (talimattaki 2 offen değil). Behandlungen → reçete 1-3 „Status" → „Bereit zur Abrechnung" → Übernehmen → `PATCH …/abrechnungsstatus` **428** → „Verordnung vorzeitig abrechnen?" („Es sind noch 1 Einheit(en) offen …") → **Trotzdem abrechnen** → 200; DB: `abrechnung_status=bereit`, `abrechnung_status_manuell_am` dolu, `belegnummer=NULL`; `prescription_validations` yeni satır **`31efe963`** (`engine=abrechnung-freigabe`, `ok=false`, `proceeded_anyway=true`, `overridden_rules=[OFFENE_EINHEITEN]`, `proceed_reason='Vorzeitige Abrechnung bestätigt'`, `result.aktion='bereit'`, snapshot erbracht 2/verordnet 3/offen 1) — Betriebsart'a bakmadan loglandı (beklenen). §302 → „Neue Abrechnung 2 Verordnungen bereit" → AOK grubu `checked=mixed`; açınca `ddf57e1b` satırı „2 / 3 **1 offen**" ve **işaretsiz**, `f77efc4c` („2 / 1") işaretli. Seçim değiştirildi (yalnız `ddf57e1b`, 54,98 €) → Erstellen → „Verordnung vorzeitig abrechnen?" → **Abbrechen** → yazma isteği yok, `abrechnung` sayısı 3 kaldı, seçim korundu. Tekrar Erstellen → **Trotzdem abrechnen** → tek `POST /api/billing/abrechnung/create-podologie` 200 → **`TSOL0004`** (abrechnung **`b795c0d0`**, `status=erstellt`, `betriebsart=test`, 1 zeile `84be3eb3` belegnummer 1-3) → ekran „Bisherige Abrechnungen"a geçti. Reçete kilitlenmedi: `belegnummer=NULL`, `abrechnung_id=NULL`, `updated_at` Erstellen'den önceki (20:31:01Z < 20:32:48Z). DTA indirilmedi. Bilinen: zeile `status=eingereicht` (2.2 gözlemi).
**Son test:** 2026-09-30 (S3.8a `e665aca` + S2.3b `f8ea2aa`; canlı `?v=20260930d`, Betriebsart `test`) — GEÇTİ. **3.8a liste:** `ddf57e1b` ve `f77efc4c` `abrechnung_status=bereit` ama Karten-IK'sız iken Neue Abrechnung „Keine abrechnungsbereiten Verordnungen." — Karten-IK'sız reçete bereit görünmüyor. (Gözlem P3: listede neden görünmediğine dair ipucu yok; Verordnungen listesindeki ⚠ rozeti tek iz.) **Backend kanıtı:** `POST /api/billing/abrechnung/create-podologie` `f77efc4c` ile (Karten-IK yok) → **422** „Verordnung f77efc4c (…): IK der Krankenkasse von der Versichertenkarte fehlt — in der Verordnung eintragen.", yazma yok. Gözlem P3: gövdede `code: "KARTEN_IK_FEHLT"` alanı yok (`karten-ik.js` `e.code` set ediyor, yanıta konmuyor; ön yüz bu koda bakmıyor, işlevsel etki yok). **2.3b (a) geçerli onay:** `ddf57e1b` (3 Einheiten, 2 erbracht, 1 offen; 29.09'da onaylı Bereit, protokol `31efe963` snapshot offen=1; gelecek termin yok) Karten-IK eklendikten sonra listede „2 / 3 **1 offen**" ve **önseçili** (29.09'da işaretsizdi) → „Ausgewählte erstellen" → ikinci „vorzeitig abrechnen?" diyaloğu ÇIKMADI → tek `POST create-podologie` 200 → **`TSOL0005`** (abrechnung **`c6e57157`**, `status=erstellt`, `betriebsart=test`) → ekran Bisherige'ye geçti. Reçete kilitlenmedi (`belegnummer=NULL`, `abrechnung_id=NULL`, `updated_at` Erstellen öncesi). DTA (`/dta-bytes`, salt okuma) FKT: `FKT+01++460000000+104212505+104212505+…` — Kostenträger ve Karten-IK alanları dolu (AOK'ta ikisi aynı IK). Karten-IK'lı podo reçetesiyle test dosyası oluşturma çalışıyor. **(b) gelecek termin:** `06dbeb5c` (DAK 100167999→105830016, 3 Einheiten, 1 erbracht, bağlı termin `396000d2` bugün 09:00, `confirmed`) → Status → Bereit → 428 → „Verordnung vorzeitig abrechnen? … 2 Einheit(en) offen" → Trotzdem abrechnen → 200, protokol **`5d41345f`** (snapshot offen=2). Liste: DAK grubunda „2 offen", **işaretsiz** (AOK satırı işaretli) → yalnız DAK seçildi → Ausgewählte erstellen → onay diyaloğu **yeniden çıktı** (istek gitmeden) → Abbrechen. Sunucu kilidi: aynı reçete için onaysız `POST create-podologie` → **428 `OFFENE_EINHEITEN`** (offen 2), yeni abrechnung yok. Gözlemler (P2/P3, domain teyidi `podoloji`): (1) Bereit onay penceresi bugün 09:00'daki bağlı termini anmıyor; (2) Erstellen'de yeniden sorulduğunda nedeni (gelecek termin) söylenmiyor, metin ilk soruyla birebir aynı; (3) `06dbeb5c` Einheiten hücresi „3 · 2 offen" — `einheiten` pozisyon sayısını (78010+78030+79933) topluyor, 1 erbracht'ı değil (29.09 gözlemi (b)'nin daha görünür hâli, `module/abrechnung-auswahl.js:653`). ⚠️ Test verisi durumu: `06dbeb5c` artık `bereit` (09:00 termini geçince 2.3b kuralı gereği önseçili olur); `ddf57e1b` ve `06dbeb5c`'nin Karten-IK'sı var, `f77efc4c`'nin yok. Konsol: yalnız bilinen gürültü + kendi 422/428 çağrılarım.
**Son test:** 2026-09-30 (`2cc414a` liste ipucu + `f4d31dc` sebep satırı/Einheiten hücresi; canlı `?v=20260930h`, backend `2cc414a` canlı, Betriebsart `test`; saat 08:00 Berlin, `396000d2` 09:00 henüz gelecekte) — GEÇTİ, dört madde. **(1) Liste ipucu:** Neue Abrechnung altında „1 Verordnung ohne IK der Versichertenkarte — in der Verordnung eintragen." (`f77efc4c`, bereit, Karten-IK yok). **(2) Backend:** `POST create-podologie` `f77efc4c` ile → 422 gövdesi `{"error":"… IK der Krankenkasse von der Versichertenkarte fehlt — in der Verordnung eintragen.","code":"KARTEN_IK_FEHLT"}` (önceki turun P3'ü kapandı), yazma yok (abrechnung sayısı 5, değişmedi). **(3) Einheiten hücresi:** AOK `ddf57e1b` „2 / 3 · 1 offen", DAK `06dbeb5c` „1 / 3 · 2 offen", hücre `title="Behandlungen erbracht / verordnet"`; HPNR listesi Mittel sütununda. **(4) Sebep satırı — Erstellen:** yalnız DAK seçili → „Ausgewählte erstellen" → istek gitmeden „Verordnung vorzeitig abrechnen?": gkv-302 metni + „Bereits erbrachte …" paragrafı değişmeden, altında ayrı paragraf „Für diese Verordnung ist noch ein Termin am 30.09. geplant." („Seit der Freigabe …" satırı yok — snapshot offen=2 = şimdiki 2, doğru) → Abbrechen, POST yok. **Sebep satırı — Bereit:** Behandlungen → 1-4 Status → „In Behandlung" (PATCH 200) → Status → „Bereit zur Abrechnung" → 428 → aynı pencere, aynı son paragraf „Für diese Verordnung ist noch ein Termin am 30.09. geplant." → Trotzdem abrechnen → 200; yenileme sonrası 1-4 yine „Bereit zur Abrechnung" (yeni Bereit protokolü, snapshot offen=2). Gözlem (P3, `podoloji`'ye UX): seçili olmayan bir Kasse grubunun kendi „Erstellen" düğmesine basınca istek gitmiyor ama sonuç kutusu „✕ DAK-Gesundheit — Keine Verordnung ausgewählt. · 0 von 1 Abrechnung erstellt, 1 fehlgeschlagen." diyor — satır başı düğme grubu seçmiyor, „fehlgeschlagen" dili hata izlenimi veriyor. Konsol: bilinen gürültü + kendi 428'im.
**Son test:** 2026-09-30 (B1 `79e1556` — Kostenträger-IK DTA anında Karten-IK'dan taze türetilir; calendar-api image `18b9c1f` 08:38:29Z derlendi (GitHub Actions success), test 08:47Z; sürüm uç noktası yok, canlılık zamanlamadan çıkarıldı; Betriebsart `test`) — KISMEN. **Preflight:** `POST /api/billing/abrechnung/preflight` podo reçeteleriyle → 400 „Preflight läuft nur für Physio/Ergo/Logo.“ — tasarım; QA tenantında physio verisi yok → B1'in preflight kolu SINANAMADI. **create-podologie AOK (`ddf57e1b`, Karten-IK = Kostenträger-IK = 104212505):** yalnız AOK seçili → „Ausgewählte erstellen“ → 200 → **`TSOL0006`** (abrechnung **`7a4f708e`**, `status=erstellt`, `betriebsart=test`), `warnungen: []` (KOSTENTRAEGER_IK_NEU yok — saklı = taze, beklenen), 409/422 yok. Reçete kilitlenmedi (`abrechnung_id=NULL`, `belegnummer=NULL`, `updated_at` değişmedi). **create-podologie DAK (`06dbeb5c`, Karte 100167999 → 105830016):** 422 „Preflight-Fehler.“ — `KOSTENTRAEGER_NICHT_AUFLOESBAR` değil (taze türetme hata vermedi), sebep ICD: `V:01002 ICD-10 "E11.7-" ungültiges Format` (error) + `V:01016 … nicht endständig` (warning). UI: „✕ DAK-Gesundheit — Die Datei hätte die Prüfung der Annahmestelle nicht bestanden.“ + madde listesi, anlaşılır. → **P1 builder'a:** S3.6 non-terminal ICD'yi yalnız uyarı sayıyor, ama kod katalog biçiminde („-“ ekli) kaydediliyor ve `isValidIcd10` (`preflight.js:101`) bunu biçim hatası sayıyor → böyle kaydedilmiş her podo reçetesi dosyaya giremiyor. KOSTENTRAEGER_IK_NEU / 409 KOSTENTRAEGER_GEAENDERT yolları QA verisinde üretilemedi (saklı IK'ler güncel). Konsol: bilinen gürültü + kendi 422'm.
**Son test:** 2026-09-30 (P1 `14171df` — ICD sondaki „-“ DTA/Preflight'ta tiresiz; calendar-api image `f6cd960` 09:35:25Z derlendi (GitHub Actions success), test 09:38Z; sürüm uç noktası yok, canlılık davranıştan doğrulandı; Betriebsart `test`) — GEÇTİ. **P1:** `06dbeb5c` (DAK, DB `icd10="E11.7-"`) → Neue Abrechnung → yalnız DAK „Erstellen“ → `POST create-podologie` **200** → `TSOL0002` (abrechnung `b1977301`, GFS 661420011), `warnungen:[V:01016 ICD-10 "E11.7" ist nicht endständig …]`, V:01002 yok; `dta-bytes` → tek segment `DIA+E11.7`, dosyada „E11.7-“ geçmiyor. **Terminal regresyon:** aynı reçete E11.74 + L60.0 ile yeniden kaydedildikten sonra → 200 → `TSOL0003` (abrechnung `a6b8cca9`), `warnungen:[]`, DIA segmentleri `DIA+E11.74` ve `DIA+L60.0`. Not: GFS'ye ilk dosya `TSOL0002` aldı — 0001 sabahki 422 denemesinde (`58e816cf`, verworfen) tüketilmiş; `api-backend/billing/api/verworfen.js` başlığı gereği bilinçli (fortlaufend, lückensiz değil; gkv-302 20.09.2026). Bulgu değil. **B1 `77c12bc` (preflight satır başına):** SINANAMADI — QA tenantındaki dört reçetenin hepsi `therapie_bereich=podo`, preflight yalnız Physio/Ergo/Logo için; physio test reçetesi gerekiyor. Reçeteler kilitlenmedi (`abrechnung_id=NULL`).

### Online-Buchung / Termin-Anfrage (hasta tarafı) — sayfa: `booking.html?u=`, `booking-request.html?business=`

**Beklenen:** Yeni praxis'in public linki en az bir bookable Leistung gösterir; Termin-Anfrage 7 adımda talep toplar.
**Son test:** 2026-09-28 — KISMEN. `booking.html`: "Keine Dienstleistungen verfügbar" (yeni podoloji
praxis). `booking-request.html`: ilk yükleme boş sayfa, reload sonrası çalıştı; adım 5'e kadar
gezildi, "Absenden" bilerek BASILMADI (mail tetikler) → owner onayı sınanmadı.

---

## Bildirilen anomaliler

Format: `TARİH · bildiren ajan · ekran/panel · gözlem (tek cümle, hasta verisi yok)`

**QA turu 2026-09-26 (Claude in Chrome, Owner görünümü) — 7 bulgu.** Durum: 🔧 = yerelde
düzeltildi + yerel kanıt var, **canlıda henüz doğrulanmadı** (bir sonraki turda kapatılır).
- 🔧 2026-09-26 · QA · `verordnungen` (+ `katalog-suche.js` kullanan her alan) · ICD/DG/Heilmittel
  dropdown'undan seçim alanı güvenilir doldurmuyor — kök neden: seçimden sonra bekleyen debounce
  / yoldaki RPC cevabı dropdown'u dolu alanın üstünde yeniden açıyordu (alan dolu ama seçim
  "tutmamış" görünüyordu, sonraki tık eski listeye düşüyordu). `katalog-suche.js` `verwirfSuche()`.
  Kanıt: `tools/browser-probe/katalog-auswahl-probe` önce 5/8, sonra 8/8; podo-/verordnung-maske 32/32.
  Canlı kontrol: hızlı yazıp hemen seç → dropdown kapalı kalmalı.
- 🔧 2026-09-26 · QA · `calendar` · Termin-Bearbeiten 2 saat kaymış gösteriyor — kök neden
  `openBookingModal`: `start_time.substring(0,16)` UTC metni alana yazıyordu, kaydederken yerel
  okunuyor → **açıp değiştirmeden kaydetmek terimi 2 saat öne kaydırıyordu** (veri bozan, P1).
  `module/datum.js` `alsDatetimeLocal()`. Kanıt: `module/datum.test.js` gidiş-dönüş testi.
  Canlı kontrol: 10:00 terimi aç → alanda 10:00; kaydet → takvimde 10:00 kalmalı.
- 🔧 2026-09-26 · fonksiyon-ustasi · `fahrtenbuch` · aynı hata Fahrt-Bearbeiten'de (`toLocal =
  iso.slice(0,16)`): açıp kaydetmek başlangıç/bitişi 2 saat kaydırıyordu. `c82e831`, `alsDatetimeLocal`.
  Canlı kontrol: bir Fahrt aç → saatler listedekiyle aynı; değiştirmeden kaydet → aynı kalmalı.
- 🔧 2026-09-26 · QA · `warteliste` · "Wartend"/"Vermittelt" sekmeleri filtrelemiyor — sorgu
  doğru filtreliyordu (canlıda 26.09: yalnız 4 `waiting`, 0 `matched`); kök neden yarış: panel
  açılışındaki "Wartend" cevabı, hızlı tıklanan "Vermittelt"in boş cevabından SONRA gelip listeyi
  eziyordu. `module/warteliste-ansicht.js` sekmeye ait olmayan cevabı atar. Kanıt: yerel tarayıcı
  denemesi (0 satır / 1 satır). Canlı kontrol: panele gir, hemen "Vermittelt" → boş mesaj.
- 🔧 2026-09-26 · QA · sidebar · "Bewertungen" "Feedback & Support"u açıyor — routing hatası
  DEĞİL: panel zaten destek bileti formu, etiket yanlıştı. `nav-registry.js` + i18n (de/en/tr)
  "Feedback & Support" / "Geri Bildirim & Destek". Gerçek bir değerlendirme özelliği yok.
- 🔧 2026-09-26 · QA · public `booking-request.html` · takvim blokerleri ("Fortbildung"/"Privat")
  hizmet listesinde — `/api/services/public` `is_internal` filtrelemiyordu. Canlı veri 26.09:
  6 blokerin hepsi `is_internal=true`, NULL yok. `server.js` `.not('is_internal','is',true)`.
  Canlı kontrol: backend deploy (Watchtower) sonrası liste blokersiz.
- 🔧 2026-09-26 · QA · `verordnungen` · bulgu 6 — QA raporunun metni kayboldu (Chrome oturumu
  özetlendi); aynı gün canlıda salt-okur yeniden tarandı (hiçbir şey kaydedilmedi), şu bulundu:
  listeden açılan (gömülü) Muster-13 maskesinde **Therapiebereich ve Hausbesuch ja/nein kutuları
  boş** görünüyordu (veri doğru: `rzTherapieBereich=podo`), ve kutulara tıklamak hiçbir şey
  yapmıyordu. Kök neden iki: (a) `setM13Therapy`/`setM13Hausbesuch` kutuları yalnız
  `#rezeptModal` içinde arıyordu, maske ise `#vordMaskeHost`'a taşınmış oluyordu; (b)
  `wireM13Toggles()` yalnız `openRezeptModal()`'dan çağrılıyordu — listeden açınca maske hiç
  kablolanmıyordu (Patientensuche, LHB-Nachweis, Zuzahlungsbefreiung dahil). Düzeltme: kök
  `#rzMaskeWrap`, `maskeEinbetten()` köprü üzerinden `verdrahteToggles` çağırır. Kanıt:
  `verordnung-maske-probe` 33/33 (yeni: "Einbetten stösst die Klick-Verdrahtung an").
  ⚠️ QA'nın kastettiği bulgu bu olmayabilir. Canlı kontrol: listeden podolojik Verordnung aç →
  "Podologische Therapie" X'li, Hausbesuch'tan biri X'li; "nein"e tıkla → X yer değiştirir
  (kaydetmeden kapat). Ayrıca not: dar pencerede (≈1050px) liste tablosu yatay kayıyor, Status
  sütunu kesik görünüyor — hata sayılmadı.
- ✅ 2026-09-27 · QA (Ops #302 Nachtrag) · `verordnungen` · Muster-13 kopfundaki hasta arama
  **hangi isim yazılırsa yazılsın 0 sonuç** veriyordu (QA iki gerçek hasta adıyla denedi — adlar
  buraya yazılmaz, §7). İki kök neden: (a) listeden açılan **gömülü** maske `rzPatientCache`'i hiç
  doldurmuyordu (yükleme yalnız `openRezeptModal()` içindeydi), (b) `patient-suche.js`'te latch —
  boş ilk yüklemeden sonra `loaded = true` kalıyor, alan bir kez fokuslandıysa bir daha yüklemiyor.
  Düzeltme `70a5b3f`: yükleme `module/rezept-patientenfeld.js:ladePatientenCache()`'e çıkarıldı,
  köprüyle gömülü maskeye de verildi, `dashboard.js` cache'i atadıktan **sonra**
  `_patientSearchApi.refresh()` çağırıyor (force → latch açılır); `heuteAktualisieren()` artık
  iki yolda da çalışıyor. **KAPANDI** — canlı modüllere karşı 10/10 + 5/5 prova (yukarıdaki
  27.09.2026 turu). ⚠️ Oturumlu tıklama turu hâlâ yapılmadı.
- 🔧 2026-09-26 · QA · `overview` @390px · yatay taşma — `.schedule-header` nowrap, `#ovCountSelector`
  `#mainArea`'dan 34px taşıyordu. `dashboard.css` ≤768px `flex-wrap: wrap`. Kanıt: statik markup
  360/390/430/768px'de taşan öğe yok. ⚠️ Oturumla gelen JS içerik (termin kartları) ölçülmedi.

**Canlı doğrulama turu 2026-09-26 (deploy `8bae297` sonrası; Claude in Chrome + Claude Code, salt-okur, hiçbir şey kaydedilmedi):**
- ✅ Termin-Uhrzeit: kart saati = dialog alanı (3 termin). Kaydetme testi yapılmadı (izin yok).
- ✅ Warteliste: hızlı "Vermittelt" → sekme aktif kalıyor, "0 vermittelte Einträge".
- ✅ Sidebar: "Feedback & Support" (DE); formu açıyor.
- ✅ Public Leistungen: `/api/services/public` 23 → 20, "Fortbildung/Pause/Privat" yok (API ile ölçüldü).
  Chrome turu booking sayfasında hiç Leistung listesi görmedi — ayrı konu (akış adımına bağlı olabilir), bug sayılmadı.
- ✅ Verordnung gömülü maske, PODOLOGIE satırları: Bereich + Hausbesuch X'li, tıklama çalışıyor (`m13Wired=1`).
- ℹ️ Verordnung "HEILMITTEL" satırında Bereich kutusu boş → **veri, hata değil:** `prescriptions.therapie_bereich`
  67 satırın 42'sinde NULL (26.09 sayım). Maske NULL'u doğru boş gösteriyor. Geriye dönük doldurma = veri
  kararı (`db-ustasi`), Ops kartı.
- ℹ️ "Public sayfada hasta adı" şüphesi → **yanlış alarm:** `/api/team/public` yalnız `profiles` okur; test
  hesabının Owner'ı (kurucu) aynı adla test hastası olarak da kayıtlı. Hasta verisi sızmıyor.
- ⚠️ Katalog "Tab sonrası dropdown açık kalıyor": `rzIcd2` → Tab → `rzDg`; DG alanı odakta KENDİ listesini
  bilerek açar (minChars 0). Büyük olasılıkla bu görüldü. `rzHm` → Tab → `rzAnzahl` probe'da kapanıyor. Canlıda
  hangi alandan Tab'landığı belirsiz → sonraki turda alan adıyla tekrar.
- ⚠️ 390px: canlı ölçülemedi (Chrome penceresi ≥789px, iframe `X-Frame-Options` ile bloklu). 789px'de sayfa
  taşmıyor; `.ov-week-grid` (140+7×120px) kendi kabında kayıyor. Chrome turunun "KPI satırı taşıyor" iddiası
  koddan okunmuş, ölçülmemiş → `mobil-ui` ile gerçek mobil viewport'ta ölçülmeli.
- ⏸ Test edilemedi: Fahrtenbuch (UI'da bulunamadı), dil değiştirici (bulunamadı) — ürün/kapsam sorusu, bug değil.

- ✅ ~~2026-09-19 · canli-test · `abrechnung` · Preflight 422'de sunucunun verdiği
  ayrıntılı hata mesajı arayüzde yutuluyor~~ — `4c3ce6e` ile düzeldi, 19.09.2026
  canlıda doğrulandı (V:01011 ekranda göründü).
- ✅ ~~2026-09-19 · canli-test · `verordnungen` · Muster-13 maskesinde ikinci ICD kodu
  için alan yok~~ — `50f45f9` ile `#rzIcd2` eklendi, 19.09.2026 canlıda doğrulandı
  (çift DIA segmenti üretildi).
- ✅ ~~2026-09-19 · canli-test · `podologie-billing` · seçili Verordnung'un kayıtlı
  seansları hiçbir yerde listelenmiyor, düzeltme yolu yok~~ — `1201618` + `7911f91`
  ile "Bereits dokumentiert" listesi + Storno geldi, 20.09.2026 canlıda doğrulandı.
- ✅ ~~2026-09-20 · canli-test · tüm dashboard · `dashboard.js` 20.09'da değişti ama
  `dashboard.html`'deki `?v=` 20260919b'de kaldı~~ — `d124410` ile `?v=20260920`
  yapıldı, canlıda doğrulandı. (Ölçülmüş not: Vercel bu dosyaları
  `Cache-Control: public, max-age=0, must-revalidate` + ETag ile veriyor, yani
  pratikte bayat servis edilmiyordu; yine de `?v=` disiplini bozulmuş durumdaydı.)
- 2026-09-19 · canli-test · §302 DTA · `prescriptions.diagnose_freitext` hiçbir mapper
  tarafından `diagnosetext` olarak geçirilmiyor, dolayısıyla DIA segmentinin serbest
  metin alanı her zaman boş kalıyor (builder onu destekliyor). — hâlâ açık, bu turda
  da serbest metin girilmediği için tekrar sınanmadı.
- 2026-09-19 · canli-test · `verordnungen` liste + Verordnung detayı · **iki** ICD kodu
  taşıyan kayıtlar yanlışlıkla "ICD-10-Kode fehlt" blocker'ı gösteriyor:
  `module/verordnung-pruefung.js:171` diziyi **boşlukla** birleştiriyor, `parseIcdList()`
  ise yalnız `, ; \n` ile ayırıyor → kod çifti tek geçersiz dizgiye dönüşüyor. Maske
  tarafı (`verordnung-pruefen-knopf.js:71`) `", "` ile birleştirdiği için aynı reçete
  için iki farklı hüküm çıkıyor. Yan etki: ICD⇄Diagnosegruppe kontrolü de sessizce
  atlanıyor. — bu turda tekrar sınanmadı, hâlâ açık.
- 2026-09-19 · canli-test · `podologie-billing` (Tagesbehandlung) · Behandlungsdatum
  gelecek tarihe izin veriyor; §302 preflight sonra bütün dosyayı reddediyor
  (S:01005/S:01006). — `c4332d5` geri-soru ekledi, canlıda tekrar sınanmadı.
- 2026-09-21 · builder · Korrekturverfahren (VKZ 04) canlı-test denemesi · **AÇIK,
  ENGELLENDİ.** `ABRECHNUNG_ECHTBETRIEB_PLAN.md` Adım 1.6'yı kapatmak için planlanan
  8 adımlık canlı test turu **Adım 0'da durdu.** `qa_credentials.py`'deki
  `PRAXURA_QA_EMAIL` hesabının `betriebsart` alanı gerçekten `'test'` (literal kapı
  geçti) — ama bu hesap sentetik/boş bir sandbox tenant DEĞİL, **gerçek, aktif bir
  beta müşterisinin hesabı** (plan=professional, plan_status=active, 22 lead, 19
  prescription, 4 abrechnung — canlı üretim verisi). Plandaki Adım 1-8, bu tenant'ın
  GERÇEK `prescriptions` kayıtlarını sahte ZAA ile "abgesetzt" işaretleyip
  Korrekturverfahren ile gerçek fatura numaralarını değiştirecekti — `betriebsart='test'`
  kapısı yalnızca DAS'a giden dosyanın Testindikator'ünü koruyor, DB'deki gerçek
  müşteri kayıtlarını korumuyor. Kullanıcıya soruldu, cevap bekleniyor. Öneri: ayrı,
  gerçekten boş/sentetik bir test-tenant açılsın (leads/prescriptions sıfırdan
  üretilmiş, hiçbir gerçek hastaya ait olmayan) ve `PRAXURA_QA_EMAIL` ona işaret
  etsin — bugünkü QA hesabı hem login/smoke-test hem de yıkıcı billing-test için
  aynı anda kullanılmamalı.
- ✅ 2026-09-21 · builder (Görev B, aynı tur) · `podologie-billing` ZAA-Upload sonucu ·
  İki gerçek bug düzeltildi ve soğuk ikinci `agy` worker'la denetlendi (GEÇTİ):
  (1) `abrechnung.rejected_count` hata-satırı sayısını değil Beleg sayısını
  (`vordGrund.size`) tutuyor artık — eskisi `module/abrechnung-status.js`'teki
  "teilweise/vollständig abgesetzt" ayrımını bozabiliyordu; (2) ZAA dosyasındaki bir
  `belegnummer` hiçbir `prescriptions` kaydıyla eşleşmezse artık API yanıtında
  `nichtZugeordnet` sayacıyla görünür ve arayüzde sarı uyarı çıkıyor (eskiden
  `prescription_id:null` sessizce yazılıyordu). ⚠️ **Yalnız `node --test` +
  statik diff denetimiyle doğrulandı — tarayıcıda gerçek bir upload-zaa akışıyla
  CANLI sınanmadı** (yukarıdaki blokaj yüzünden). Bir sonraki canlı test turunda,
  yeni sentetik tenant açılınca bu iki davranış da tarayıcıdan doğrulanmalı.
- ✅ ~~2026-09-20 · fonksiyon-ustasi'nin bildirdiği, canli-test canlıda gözledi ·
  `abrechnung` (Verlauf + Detay) · `status='verworfen'` arayüzde karşılıksız~~ —
  `69c7a0e` ile düzeldi: satır listenin sonunda, özet sayacına dahil değil,
  `verwerfungsgrund` görünür, ödeme/ZAA düğmeleri kalktı. 20.09.2026 canlıda
  (ikinci tur) doğrulandı — ayrıntı yukarıdaki "§302-Abrechnung → DTA" kaydında.
- ✅ ~~2026-09-20 · canli-test · `settings` → Abrechnung · "Aktuell (Vorgabewert): X"
  başlığı radyo düğmesi **seçilir seçilmez** yeni değeri gösteriyor, kaydedilmeden~~ —
  `69c7a0e` ile düzeldi: başlık kaydedilene kadar eski değerde kalıyor, yanına
  "noch nicht gespeichert" ibaresi ekleniyor; kaydetmede ayrıca bir onay modalı
  araya girdi (yeni, olumlu bir ek güvenlik adımı). 20.09.2026 canlıda doğrulandı.
- ✅ ~~2026-09-20 · canli-test · `podologie-billing` · **Açık soru (domain):** Storno
  düğmesine yalnız "Aktive Verordnungen" listesindeki reçetelerin seansları üzerinden
  ulaşılıyor, `abrechnung_status='gesendet'` olanlar erişilemiyordu~~ — `1d549f6` ile
  "Abgerechnet"-Gruppe geldi (gönderilmiş Verordnungen artık görünür ve seçilebilir),
  `c66232d` ile Storno bu durumda **engellenmiyor, sadece Meldepflicht + Zuzahlung
  uyarısıyla bilgilendiriyor** — commit mesajı gkv-302'nin "Korrekturverfahren
  Umsetzungsempfehlungen 13.02.2025, Frage 5" referansını taşıyor (kendiliğinden
  keşfedilen fazla ödeme Korrekturverfahren dışında, Kasseye elle bildirilmeli).
  20.09.2026 canlıda doğrulandı (dialog metni tam eşleşti, gerçek storno
  denenmedi — geri alınamaz işlem).
- ✅ ~~2026-09-20 · canli-test · `podologie-billing` (Abgerechnet-Gruppe) · P1, açık,
  regresyon turu 2: "X Einheit(en) abgerechnet, Y noch offen" sayacı `c1c3e16` ile
  düzeltildi ama aynı iki kayıtta hâlâ "0 abgerechnet" gösteriyordu, `abrechnung_zeile`
  sorgusu hiç tetiklenmiyordu~~ — **3. turda (aynı gün, taze `goto` ile) çürütüldü.**
  Üç test kaydının üçünde de sayaç ve ağ isteği doğru çalıştı; kök neden kodda/DB'de
  değil, muhtemelen önceki testin taze navigasyon olmadan (aynı sekmede `switchPanel`
  ile) çalıştırılmasıydı. Ayrıntı: yukarıdaki "Abgerechnet-Gruppe" kaydı.
- 2026-09-21 · fonksiyon-ustasi · `abrechnung` → ZAA-Modal ("ZAA-Fehler dieser
  Abrechnung" görünümü, `showZaaErrors`) · Koyu temada okunabilirlik: tablodaki "Lösung"
  sütunu sabit `color:#444` ile, "Keine Fehler" kutusu sabit `#f0fdf4/#bbf7d0/#166534`
  ile çiziliyor (CSS değişkeni değil) — aynı modalın upload-sonrası kardeş görünümü
  (`renderZaaUploadResult`, 21.09.2026 modüle taşındı) değişken kullanıyor, yani iki
  görünüm koyu temada farklı davranıyor. Düzeltilmedi, sadece kaydedildi.
- 2026-09-28 · fonksiyon-ustasi · Fahrtenbuch/Hausbesuch düğmeleri · B-101'in kökü tek düğme değil: `dashboard.html`'de 9 düğme (`qvSaveBtn`, `vehEditSaveBtn`, `fsSaveBtn`, `feSaveBtn`, `fbVehicleAddBtn`, `bkActionFahrtStartBtn`, `bkActionArrivedBtn`, `bkActionFahrtEndBtn`, `bkActionHbCopyBtn`) hem inline `onclick=window.__fb.*` hem `dashboard.js:17705` document-delegation ile bağlı → her tık iki kez çalışıyor; guard'sız insert yapanlar (quick + Fahrtenbuch-paneli "Neues Fahrzeug") çift satır üretiyor olmalı — diğer yedisi canlıda sınanmadı. Düzeltilmedi, sadece kaydedildi.
  → canli-test 2026-09-28 kontrol turu: DOĞRULANDI (9/9 statik; Fahrt Starten/Angekommen/Beenden
  canlıda ikişer istek). Fahrt zincirinde veri hasarı yok (upsert), hasar araç insert'lerinde.
  Ayrıntı: yukarıdaki "Hausbesuch" kaydı.
- 2026-09-28 · canli-test · tüm dashboard (her taze yükleme) · konsolda 5 sabit hata: `[loadActivityFeed]
  TypeError: str.replace is not a function` (`escapeHtml`, `dashboard.js:875` ← `:2096`) — aktivite
  akışı boş/eksik kalıyor olabilir; `visibility_reports` upsert 2× 403 (RLS); `nominatim.openstreetmap.org`
  isteği CSP `connect-src` tarafından engelleniyor (adres→koordinat çalışmıyor). Düzeltilmedi, sadece kaydedildi.
- 2026-09-28 · canli-test · `employee-signup.html` adım 3 ("Konto erstellen") · çalışan kaydı tamamlanamadı:
  `POST /auth/v1/signup` 3× 504 `request_timeout` (~10 sn, GoTrue onay mailini gönderirken takılıyor —
  SMTP şüphesi), 4. deneme 200 loglandı ama `auth.users`'ta kayıt YOK. Ayrıca adım 2'deki
  `pending_employee_registrations` upsert'i 401 döndü (INSERT policy var ama upsert=INSERT+UPDATE,
  UPDATE policy'si yok — muhtemel sebep); kod bunu yalnız `console.warn` ile yutuyor → kayıt başarılı
  olsa bile owner bağı/çalışma saatleri kaybolur. Çalışan yetki testi (kontrol #5) bu yüzden ertelendi
  (kullanıcı kararı, 28.09.2026). Düzeltilmedi, sadece kaydedildi.
- 2026-09-28 · fonksiyon-ustasi · Termin-Portal "Nicht erschienen" · başarı toast'ı "Patient nicht erschienen — Bot wurde ausgelöst." diyor (`dashboard.js:4458`), oysa `triggerNoShowBot` yalnız console.log yapan ölü WhatsApp kalıntısı — kullanıcıya olmayan bir işlem bildiriliyor. Düzeltilmedi, sadece kaydedildi.
- 2026-09-29 · canli-test · Termin-Aktionen → Rezeptinfo · abrechnung_status `gesendet` olan Verordnung'da Status rozetinin tooltip'i "Unbekannter Status — steht so in der Datenbank." (P2 — `gesendet` §302 akışının normal durumu; etiket haritası eksik görünüyor). Düzeltilmedi, sadece kaydedildi.
- 2026-09-29 · canli-test · `dashboard.js?v=` cache-bust · 29.09'da `dashboard.js` iki kez değişti (`2a596dc`, `45d91c3`) ama `dashboard.html` hâlâ `?v=20260926b` — dosyayı daha önce önbelleğe almış tarayıcı eski sürümü çalıştırabilir (yeni modül `?v=20260929` ile bump'lı, ama onu import eden `dashboard.js` değil). P2, builder'a.
- 2026-09-29 · canli-test · QA tenant temizliği AÇIK · S1 testi için üç test randevusu açıldı (TEST-hasta, bağlı Verordnung `796aae21`): `51841395` (28.09 16:00, status completed), `bc643b06` (06.10 10:00), `cd20da08` (29.09 17:00). Doğrudan REST ile iptal denemesi izin sisteminde reddedildi → kullanıcı kararı bekliyor. İptal edilmezse Verordnung sayacı 3/3 görünür ve sonraki testleri etkiler.
- 2026-09-29 · canli-test · 29.09 temizlik: `cd20da08` + `bc643b06` Termin-Aktionen → Löschen → „Termin absagen" (Grund Sonstiges/QA-Notiz) ile arayüzden iptal edildi, Ausfallrechnung/bildirim sorulmadı; `51841395` (completed) iptal edilemedi — UI „Nur geplante Termine können abgesagt werden." (dashboard.js:7707, beklenen). Yenileme sonrası `796aae21` kartı **1/3** (iptaller sayılmıyor). Üstteki "temizlik AÇIK" maddesi bununla kapandı.
- 2026-09-29 · canli-test · `verordnungen` → "+ Neue Verordnung" (Muster-13 modalı) · Heilmittel alanının "Heilmittel-Vorschläge" listbox'ı açıkken **Escape** basılınca liste değil **modalın tamamı** kapandı; yeniden "+ Neue Verordnung" açıldığında ~20 alanın hepsi boştu (onaysız veri kaybı). Global handler `dashboard.js:1279-1289` en üstteki `.modal-overlay`'i koşulsuz kapatıyor, açık öneri listesine öncelik vermiyor. Yorumdaki gerekçe (overlay tıklamasıyla girdi kaybı şikayeti) aynı riskin klavye yolu. P2. Düzeltilmedi, sadece kaydedildi. (Yan: modal kapandıktan sonra listbox DOM'da `display:block` kalıyor, ekran dışında y=-61 — görünür etkisi yok.)
  → **KAPANDI 2026-09-29** (canli-test, `0418566`, `?v=20260929o`): Heilmittel ve ICD alanında Escape yalnız listeyi kapatıyor, maske ve girilen veri duruyor — bkz. Muster-13 kaydı.
- 2026-09-29 · canli-test · Termin-Aktionen → „Termin Starten" (Hausbesuch, `fahrt_arrived`) · `dashboard.js:4319` `fahrt_status:'in_progress'` yazıyor, `bookings_fahrt_status_check` bu değeri içermiyor → 400/23514, hata yutuluyor. Sonuç: S3.13 „Fahrt beenden" hiç görünmüyor ve podoloji Hausbesuch Fahrt'ı UI'dan kapatılamıyor. P1 — builder'a devredildi (aşağıda).
- 2026-09-29 · canli-test · Terminmaske Hausbesuch önseçimi · aynı hasta (sütun false, legacy metadata true) tekli/seri maskede önseçili, Folgetermin (sürükle) maskesinde işaretsiz; reçete hausbesuch=false. P2/soru → `podoloji`: önseçim hastadan mı reçeteden mi.
- 2026-09-29 · canli-test · QA tenant test verisi (29.09 akşam turu): hasta `1abd135e` (TEST-QA Spalten), araç `c79a59f1` (TEST-QA S34) + `8a674747` (TEST-QA S34b), randevu `7a6fc08b` (29.09 21:00, `ddf57e1b`, Hausbesuch — `completed`, Behandlung'lı olduğu için „Nur geplante Termine können abgesagt werden"; iptal edilemedi, bırakıldı), Behandlung `81cd1398`, Fahrt `97206371` (30000→30004, Fahrtenbuch ✏️ ile kapatıldı), `prescription_validations` `31efe963`, test dosyası `TSOL0004` (`b795c0d0`). `ddf57e1b` artık `bereit` (2/3). Silinmedi.
- 2026-09-30 · canli-test · QA tenant test verisi (30.09 sabah turu, `2cc414a`/`f4d31dc`): `06dbeb5c` durumu In Behandlung → Bereit'e geri alınıp yeniden onaylandı (yeni `prescription_validations` Bereit kaydı, snapshot offen=2; son hâl `bereit`, Karten-IK 100167999 değişmedi). Yeni abrechnung/TSOL YOK, yeni randevu YOK. `396000d2` (30.09 09:00) geçtikten sonra `06dbeb5c` 2.3b kuralı gereği önseçili olur; sebep satırını tekrar sınamak için yeni gelecek tarihli termin bağlanmalı. Silinmedi.
- 2026-09-30 · canli-test · QA tenant test verisi (30.09 öğle turu, `18b9c1f`): hasta `a8e9df53` Kasse **AOK Rheinland/Hamburg → DAK-Gesundheit**, `krankenkasse_ik=100167999` (önceden null; arada bir kez 12345→null sınandı). Yeni test dosyası **`TSOL0006`** (abrechnung `7a4f708e`, AOK, `ddf57e1b`). DAK (`06dbeb5c`) için dosya denemesi 422 ile reddedildi, yazma yok. Yeni Verordnung/randevu YOK. Silinmedi.
- 2026-09-30 · canli-test · QA tenant test verisi (30.09 öğleden sonra turu, `f6cd960`): `06dbeb5c` ICD iki kez yeniden kaydedildi (E11.7- → E11.7 → **E11.74 + L60.0**, son hâl). Yeni test dosyaları **`TSOL0002`** (abrechnung `b1977301`) ve **`TSOL0003`** (`a6b8cca9`), ikisi DAK/GFS, `06dbeb5c`, Betriebsart test, reçete kilitlenmedi. Yeni Verordnung/randevu YOK („+ Neue Verordnung“ P3a için açıldı, kaydedilmedi). Silinmedi.
- 2026-09-30 · canli-test · QA tenant test verisi (S3-Reste turu `2e4275f`): yeni Verordnung **`50139501`** (hasta `a8e9df53`, E11.7+DF, 78010, 3 Einheiten, 1x alle 2 Wochen, test hekimi LANR 123456789 = yanlış Prüfziffer, imza var; arada L60.0'a çevrilip E11.7'ye geri alındı). Yeni Hausbesuch randevusu **`e48f89a4`** (02.10.2026 10:00, `50139501`'e bağlı) + **açık** Fahrt **`2ec11d8f`** (Start-KM 30020, bitmedi). Hasta `a8e9df53` son hâli değişmedi (DAK-Gesundheit + Karten-IK 100167999; arada bir kez null kaydedildi). Silinmedi.

---

## builder'a devredilenler

**Açık devir: 1** (30.09.2026 S3-Reste turu: P1 signal.js iki örnek — aşağıda. 30.09.2026 öğleden sonra: aşağıdaki P1/P2/P3 + S3.8b P3a gözlemi `f6cd960`/`14171df` ile canlı regresyonda KAPANDI. Önceki: 30.09.2026 öğle: P1 non-terminal ICD „E11.7-“ §302 dosyasını blokluyor · P2 listede „ICD-10-Kode fehlt“ · P3 kayıtlı non-terminal ICD uyarısı yeniden açılışta çıkmıyor — aşağıda). 30.09 öğle: „eski Karten-IK ipucu“ P3'ü `50ef95e` ile canlı regresyonda KAPANDI. 30.09 sabah: „Kasse araması bağlanmıyor" P1'i `2cc414a` ile canlı regresyonda KAPANDI. Kapatılmış girişler geçmiş kaydı
olarak, aynı semptom üçüncü kez çıkarsa buraya bakılır).

### [P1] Yeni/düzenlenen Verordnung açık listede ve Patientenakte'de görünmüyor — `signal.js` iki farklı `?v=` ile iki ayrı örnek (2026-09-30)

**Nerede:** `verordnungen` paneli (liste `#vordTbody`) + Patientenakte Verordnungsübersicht (`kunden` → hasta)
**Yeniden üretme:**
1. Verordnungen paneli açık → „+ Neue Verordnung“ → maskeyi doldur → Speichern (→ „Trotzdem speichern“ gerekiyorsa)
2. Modal kapanır, listeye bak (10 sn bekle)
→ Beklenen: yeni satır listede anında (commit `2e4275f` „Neue Verordnung → verordnungen:changed → Liste/Akte laden nach“)
→ Gerçekleşen: DB'de kayıt var (QA: `50139501`), liste eski hâlde; panel değiştirip dönünce görünüyor. Düzenleme (PATCH) sonrası da aynı.

**Kanıt:** tarayıcıda `const a=await import('/module/signal.js?v=20260815'); const b=await import('/module/signal.js?v=20260813')` → `a===b` false; `b.on('x',…)` + `a.emit('x')` → 0 teslimat. Akte açıkken `a.emit('verordnungen:changed')` → 0 REST isteği, `b.emit(…)` → 7 istek (Akte yeniden çiziyor). Konsol hatası yok (sessiz kayıp).
**Şüpheli:** [dashboard.js:15](dashboard.js#L15) `import { emit, on } from './module/signal.js?v=20260815'` — diğer herkes `?v=20260813`: [module/verordnung-liste.js:50](module/verordnung-liste.js#L50), [module/verordnung-uebersicht.js:86](module/verordnung-uebersicht.js#L86), [module/abrechnungsstatus.js:44](module/abrechnungsstatus.js#L44), `verordnung-detail.js:83`, `verordnung-patient-abgleich.js:1`, `termin-nicht-erschienen.js:1`, `booking-status-korrektur.js:1`, `abrechnung-detail.js:49`, `abrechnung-verlauf.js:36`, `patient-suche.js:32`. `signal.js` dinleyicileri modül düzeyinde `const listeners = new Map()` tutuyor → URL farklıysa kayıt paylaşılmıyor. Aynı kusur ters yönü de etkiler: `abrechnungsstatus.js`'in `emit('verordnungen:changed')`'i [dashboard.js:1938](dashboard.js#L1938) dinleyicisine (Termin-Aktionen paneli) ulaşmaz; `dashboard.js`'in `emit` çağrıları (6015, 6110, 7618, 15810, 15830) hiçbir modül dinleyicisine ulaşmaz. İz: sürüm farkı `575fd4b` ile girdi.
**Düzeltme yönü (öneri, karar builder'da):** tüm importları tek `?v=`'ye eşitle (ya da signal.js kaydını `globalThis` üzerinde tekil tut, böylece gelecekteki bir bump bunu tekrar kırmaz). `tools/browser-probe` altındaki eski `?v=` probe'ları da (icd-dg-verdrahtung 20260926b, verordnung-maske 20260930b/20260927, krankenkasse-suche 20260817) aynı sınıf risk — üretimde değil.
**Katman:** 2 (Verordnung/Termin akışı) — veri kaybı yok, görünürlük hatası
**Etki:** podolog yeni Verordnung'u kaydedince listede/Akte'de göremez, tekrar girmeye kalkabilir (mükerrer Verordnung riski); Abrechnungsstatus değişikliği açık Termin panelini güncellemez.

### ~~[P1] Non-terminal ICD „E11.7-“ ile kaydedilmiş podo reçetesi §302 dosyasına giremiyor (V:01002) (2026-09-30)~~ — KAPANDI (`14171df`+`f6cd960`, canlı regresyon 2026-09-30, `06dbeb5c` → TSOL0002, yalnız V:01016, `DIA+E11.7`)

**Nerede:** `abrechnung` → Neue Abrechnung → podo reçetesi (QA: `06dbeb5c`, DAK)
**Yeniden üretme:**
1. Muster-13'te ICD aramasından „nicht endständig“ etiketli bir kod seç (örn. E11.7-) — S3.6 uyarı gösterir, kaydı engellemez → kaydet
2. Reçeteyi Bereit'e getir → §302 → Neue Abrechnung → yalnız o Kasse → Ausgewählte erstellen
→ Beklenen: S3.6 / SPEC-RULES Z-18 gereği yalnız uyarı V:01016, dosya oluşur
→ Gerçekleşen: `POST /api/billing/abrechnung/create-podologie` 422 „Preflight-Fehler.“, `errors:[V:01002 ICD-10 "E11.7-" ungültiges Format]`, aynı yanıtta `warnings:[V:01016 nicht endständig]`

**Kanıt:** 422 gövdesi (yukarıda), DB `prescriptions.icd10='E11.7-'` (katalog kodu sondaki „-“ ile saklanıyor)
**Şüpheli:** `api-backend/billing/dta/preflight.js:101` `isValidIcd10` regex'i sondaki „-“yi reddediyor, çağrı `preflight.js:347-348`. Karar sorusu `gkv-302`'ye: DIA segmentine „E11.7-“ mi „E11.7“ mi yazılmalı — „-“ kayıtta mı (maske, `nurIcdKode`), DTA eşlemesinde mi, yoksa yalnız doğrulamada mı normalize edilir? Aynı kök P2'de (`icd-dg-match.js:48`).
**Katman:** 4 Belege/Geld (§302) — K4
**Etki:** podolog S3.6'nın izin verdiği non-terminal ICD'li reçeteyi faturalayamaz; hata „ungültiges Format“ dediği için ne yapacağını bilmez (düzeltme yalnız hekimde)

### ~~[P2] Verordnungen listesi kayıtlı „E11.7-“ için „ICD-10-Kode fehlt“ diyor (2026-09-30)~~ — KAPANDI (`f6cd960`, canlı regresyon 2026-09-30; ICD⇄DG kontrolü artık çalışıyor, metin sorusu → Verordnung kaydı)

**Nerede:** `verordnungen` → liste, ⚠ rozeti tooltip'i
**Yeniden üretme:** non-terminal ICD (E11.7-) ile kaydedilmiş podo reçetesi → listede ⚠ → tooltip
→ Beklenen: ICD var; en fazla „nicht endständig“ uyarısı
→ Gerçekleşen: „ICD-10-Kode fehlt — in der Podologie bestimmt er die Diagnosegruppe.“ (blocker) — ICD⇄DG çapraz kontrolü de sessizce atlanıyor

**Kanıt:** `parseIcdList('E11.7-')` → `[]`, `parseIcdList('E11.74')` → `['E11.74']` (node ile doğrulandı)
**Şüpheli:** `icd-dg-match.js:48` `ICD_SHAPE` + `module/verordnung-pruefung.js:180-183`
**Katman:** 1 Stammdaten (Verordnung doğrulama) → §302'yi besler
**Etki:** yanlış „eksik“ alarmı; podolog var olan kodu arar

### ~~[P3] Kayıtlı non-terminal ICD uyarısı (3.6) yeniden açılışta çıkmıyor — `a81660c` düzeltmesi canlıda etkisiz (2026-09-30)~~ — KAPANDI (`f6cd960`, canlı regresyon 2026-09-30, `06dbeb5c`, odaksız)

**Nerede:** `verordnungen` → listeden reçete → gömülü Muster-13, `rzIcd`
**Yeniden üretme:** taze yükleme → `06dbeb5c` (icd10 E11.7-) seç → alan altına bak
→ Beklenen: „ICD-Code ist nicht endständig. Bitte mit der Verordnung vergleichen …“
→ Gerçekleşen: ipucu yok (ne görünür ne gizli öğe); alan bir kez odaklanıp kapat/aç yapılınca da yok

**Kanıt:** `rzIcd.dataset.katalogWired` taze yüklemede tanımsız; `search_diagnosen({p_q:'E11.7-',p_bereich:'podo',p_kind:'icd'})` → 0 satır, `p_q:'E11.7'` → `E11.7-` ilk satır
**Şüpheli:** (1) `dashboard.js:15440-15446` — `attachDiagnoseSearch` yalnız `focusin`'de bağlanıyor, `module/verordnung-maske.js:440-444`, Listener `katalog-suche.js:480`'in gönderdiği `katalog:gespeichert` olayını dinleyen yok; (2) `katalog-suche.js:416` `gespeicherterKodeHinweis` RPC'ye `roh` gönderiyor, `norm(roh)` göndermeli. `module/katalog-hinweis.test.js` RPC'yi taklit ettiği için (2)'yi yakalamıyor
**Katman:** 1 Stammdaten — yalnız görüntü
**Etki:** podolog kayıtlı kodun non-terminal olduğunu yeniden açınca görmez; dosya denemesinde P1 hatasıyla karşılaşır

### ~~[P3] Gömülü Verordnung maskesi: kaydetmeden kapatıp açınca eski Karten-IK ipucu kalıyor (2026-09-30)~~ — KAPANDI (`50ef95e`, canlı regresyon 2026-09-30 öğle, `06dbeb5c`, 2 kapat/aç turu)

**Nerede:** `verordnungen` → listeden mevcut reçete → gömülü Muster-13 maskesi, Kostenträgerkennung alanı
**Yeniden üretme:**
1. Karten-IK'lı bir reçete seç (örn. `06dbeb5c`, IK 100167999)
2. IK alanına bilinmeyen bir IK yaz (109999999) + Tab → „Zu dieser IK wurde kein Kostenträger gefunden …"
3. Kaydetmeden „✕ Auswahl aufheben" → aynı reçeteyi yeniden seç
→ Beklenen: alan DB değerine döner, ipucu boş (ya da DB değerine ait „Karte → Kostenträger" satırı)
→ Gerçekleşen: alan 100167999'a dönüyor ama altında hâlâ „kein Kostenträger gefunden" yazıyor

**Kanıt:** yeniden açılıştan sonra `#rzPatKasseIk.value="100167999"`, `#rzPatKasseIkHinweis.textContent` = önceki denemenin metni (3 kapat/aç turunda da aynı)
**Şüpheli:** `module/krankenkasse-suche.js:366` `loescheIkHinweis` yalnız `input` olayında çağrılıyor (dışa açık değil); maske değerleri programatik yazılıyor (`module/verordnung-maske.js` `maskeEinbetten`, ~satır 173-201) → `input` olayı yok → ipucu temizlenmiyor
**Katman:** 1 Stammdaten (Karten-IK) — görüntü, veri doğru
**Etki:** podolog geçerli bir Karten-IK'nın altında hata metni görür, gereksiz yere kartı yeniden kontrol eder

---

### ~~[P1] Verordnung düzenleme maskesi: taze yüklemede Kasse araması ve Karten-IK geri bildirimi bağlanmıyor (2026-09-30)~~ — KAPANDI (`2cc414a`, canlı regresyon 2026-09-30, `06dbeb5c`)

**Nerede:** `verordnungen` → listeden mevcut bir reçete seç → gömülü Muster-13 maskesi
**Yeniden üretme:**
1. `dashboard.html` taze yükle (bu oturumda „+ Neue Verordnung" açılmamış olsun)
2. Verordnungen → bir podo reçetesine tıkla
3. „Krankenkasse bzw. Kostenträger" alanına „DAK" yaz → açılır liste yok
4. Kostenträgerkennung alanına bir Karten-IK (örn. 104212505) yaz + blur → ipucu yok, Kasse adı değişmiyor
→ Beklenen: yeni kayıttaki gibi Kasse listesi + „IK von der Versichertenkarte eintragen…" / „Karte X → Kostenträger Y" / „kein Kostenträger gefunden"
→ Gerçekleşen: `#rzPatKasse.dataset.katalogWired` tanımsız; Kasse „DAK" kalırken IK 104212505 kaydedilebildi (sunucu Kostenträger'i Karten-IK'dan doğru türetti, ama yanlış bir IK girilse hiçbir geri bildirim yok — reçete sessizce „Kostenträger fehlt" kalır ve §302 listesine hiç girmez)

**Kanıt:** taze yüklemede `katalogWired=undefined`; aynı oturumda önce „+ Neue Verordnung" açıldıktan sonra `katalogWired="1"` ve düzenlemede liste/ipucu çalışıyor
**Şüpheli:** `dashboard.js:15649` — `attachKrankenkasseSuche` yalnız `openRezeptModal()` içinde `populateKkDatalist()` (`dashboard.js:16932`) üzerinden çağrılıyor; `module/verordnung-maske.js:173` `maskeEinbetten()` bağlamıyor
**Katman:** 1 Stammdaten (Kasse/Karten-IK) → §302'yi besler
**Etki:** Karten-IK'yı sonradan (düzenlemeyle) giren podolog S3.8a'nın doğrulama geri bildirimini hiç görmez — mevcut reçetelere Karten-IK eklemenin tek yolu bu

---

### ~~[P1] Podoloji Hausbesuch: „Termin Starten" `fahrt_status='in_progress'` yazamıyor → S3.13 „Fahrt beenden" hiç çıkmıyor, Fahrt UI'dan kapatılamıyor~~ — KAPANDI (`96c0320`, canlı regresyon 2026-09-30, randevu `396000d2`)

**Nerede:** `calendar` → Hausbesuch randevusu → Termin-Aktionen → „▶ Termin Starten" → `podologie-billing` Tagesbehandlung
**Yeniden üretme:**
1. Podo reçeteye bağlı Hausbesuch randevusu → Fahrt Starten (araç + Start-KM) → „Ich bin angekommen"
2. „▶ Termin Starten" → Tagesbehandlung → „Behandlung speichern"
→ Beklenen: „Hausbesuch: Fahrt ist noch offen." + „Fahrt beenden" (S3.13), End-KM → tek `fahrten` satırı kapanır
→ Gerçekleşen: `PATCH bookings?id=eq.<id>` gövde `{"fahrt_status":"in_progress"}` → **400** `23514 new row for relation "bookings" violates check constraint "bookings_fahrt_status_check"`; hata yutuluyor, Behandlung kaydediliyor, ipucu/düğme çıkmıyor. Termin-Aktionen yeniden açılınca yalnız „Termin Starten" (rozet „Angekommen"), „Fahrt Beenden" yok.

**Kanıt:** canlı 2026-09-29, randevu `7a6fc08b`, ağ isteği #520 (400/23514). CHECK: `api-backend/db/migrations/0000_baseline.sql:2906` → `fahrt_status IN ('fahrt_started','fahrt_arrived','fahrt_return_pending','fahrt_completed')`.
**Şüpheli:** `dashboard.js:4318-4320` (`update({ fahrt_status: 'in_progress' })`, sonucu kontrol edilmiyor) · `module/fahrt-beenden.js:24-26` (`zeigeFahrtBeenden` → `fahrt_status === 'in_progress'`) · `module/podologie-abrechnung.js` `zeigeFahrtHinweis` (DB'den okuyor) · `dashboard.js:4031` `renderBkActionFahrtState` `in_progress` dalı. `in_progress` `eace931`'den (Fahrtenbuch Waves 1-5) beri kodda, CHECK hiç izin vermemiş — ya CHECK'e değer eklenmeli (yeni migration, `db-ustasi`+`onprem`) ya kod mevcut bir değeri (ör. `fahrt_return_pending`) kullanmalı. Karar builder/db-ustasi'nin.
**Katman:** 3 (Termin/Behandlung akışı; Fahrtenbuch = Finanzamt kaydı → Belege'ye yakın, en az P1)
**Etki:** Hausbesuch yapan podolog Fahrt'ı bitiremiyor; Fahrtenbuch'ta End-KM'siz açık satır kalıyor, ancak ✏️ ile elle kapatılabiliyor.

### ~~[P1] "X Einheit(en) abgerechnet, Y noch offen" sayacı — regresyon turu 2, hâlâ "0 abgerechnet" gösteriyor~~ — KAPANDI (3. tur, 2026-09-20)

**Nerede:** `podologie-billing` paneli → "Abgerechnet"-Gruppe → bir Verordnung seçilince
Tagesbehandlung formunun üstündeki bilgi şeridi.

**Geçmiş:** İlk tur `podologie_behandlungen.invoice_id` kullanımını yanlış diye işaretlemişti.
`c1c3e16` bunu `abrechnung_zeile.created_at` kesimine çevirdi. "Regresyon turu 2" bunun da
işe yaramadığını, sorgunun hiç tetiklenmediğini iddia etmişti (bu dosyanın önceki sürümünde
tam ayrıntı vardı — aşağıdaki 3. tur bulgusuyla çelişiyor, o yüzden burada tutulmuyor).

**3. tur sonucu (SADECE TEŞHİS görevi, kod değişikliği yapılmadı):** Aynı üç prescription_id
(`f89aa419-2023-4d03-985c-b13fe748bfec` / `3ec144e0-73fc-46bd-9817-f32115acc732` /
`ed52d1e5-1aa9-42d8-a884-dca964512845`) taze bir `playwright-cli open --persistent` (tam
sayfa navigasyonu) ile tek tek açıldı ve `playwright-cli requests`/`response-body` ile ağ
trafiği yakalandı:

| prescription_id (kısa) | `abrechnung_zeile` isteği gitti mi | dönen `created_at` | UI sayacı |
|---|---|---|---|
| `f89aa419…` (1 Einheiten) | evet | 2026-09-19T21:28:15Z | "1 Einheit(en) abgerechnet, 0 noch offen" |
| `3ec144e0…` (3 Einheiten) | evet | 2026-09-19T19:30:47Z | "3 Einheit(en) abgerechnet, 0 noch offen" |
| `ed52d1e5…` (6 Einheiten) | evet | 2026-09-19T16:15:16Z | "6 Einheit(en) abgerechnet, 0 noch offen" |

Üçünde de `selectedVord?.abrechnung_id` dolu geldi, sorgu gitti, sayaç doğru hesaplandı —
"regresyon turu 2"nin iddia ettiği "koşul hiç sağlanmıyor" durumu **hiçbirinde gözlenmedi**.

**Kök neden (kesin kanıtlanmış):** `abrechnung_zeile` satırlarının `created_at`'i her üç
kayıtta da **2026-09-19**'a ait — yani `c1c3e16` fix'inden VE "regresyon turu 2" testinden
önce DB'de zaten doluydu. Demek ki sorun DB'de hiç olmadı. Kodda da (okuma + bu turdaki canlı
doğrulama) hata yok. Geriye kalan tek makul açıklama: "regresyon turu 2" testi aynı kalıcı
(`-s=praxura`) tarayıcı sekmesinde, deploy'dan sonra taze bir `goto`/`open` yapılmadan
(yalnız `switchPanel()` ile panel değiştirilerek) çalıştırılmış olabilir — ES module import'ları
sayfa başına bir kez bağlanır, SPA-içi panel geçişi onları yeniden fetch etmez; sekme
`c1c3e16` canlıya çıkmadan önce açık kalmışsa, HTML'deki `?v=` güncel olsa bile o sekme eski
modül mantığıyla çalışmaya devam eder. Bu turda kasıtlı olarak yeni bir tam `open` yapıldı ve
sorun ortadan kalktı. **Kanıtlanamayan** tek şey önceki test sekmesinin gerçekte ne zaman
açıldığı (geriye dönük denetlenemez) — ama kod, veri ve taze-oturum kanıtlarının üçü de şu an
tutarlı ve doğru.

**Katman:** 1 (Stammdaten/Belege — §302 Abrechnung durumu, `builder` §1 tablosuna göre K4)
**Etki:** Yok — sayaç canlıda üç test kaydında da doğru gösteriyor, podolog yanlış bilgi almıyor.
**Aksiyon:** `builder`'a üçüncü düzeltme turu **gönderilmedi** (gerek yok). Kalıcı ders
metodoloji tarafında: client-side JS regresyon testleri artık taze `open`/`goto` ile yapılmalı,
aynı kalıcı sekmede `switchPanel()` ile değil.
