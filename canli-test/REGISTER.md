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
**Son test:** 2026-09-30 (P1-Regression `9d4b057` + Reform 3.12 `e9d0286`; canlı `dashboard.js?v=20261001d` = yerel md5 eşit, `dashboard.js:15` artık `signal.js?v=20260813`; QA tenant test2, 11:09–11:30Z) — GEÇTİ, signal.js P1 kapandı. **Tek örnek:** `performance` kaynak listesinde yalnız `module/signal.js?v=20260813` (bir kez); `_inspect()` panel açılışlarında `verordnungen:changed` 1 (dashboard) → 2 (+liste) → 3 (+Akte). **Yeni Verordnung → liste:** „+ Neue Verordnung", hasta `a8e9df53`, E11.74 → DG DF otomatik, 78010, 3 Einheiten, 1x pro Woche, test LANR (yanlış Prüfziffer) → „Trotzdem speichern" → `POST /api/rezept/confirm` 200 → liste 0,5 sn içinde 5 → 6 satır (**`f0a303e6`**), yenileme yok. **PATCH → liste:** aynı kayıtta Leitsymptomatik a) + 3 → 4 Einheiten → `PATCH /api/rezept/f0a303e6` 200 → satır anında „0 / 4", ⚠ tooltip'i yeni uyarıya döndü. **Yeni Verordnung → açık Akte:** Kunden → hasta → Rezepte sekmesi „6 laufende Verordnungen" açıkken maske açılıp (`openRezeptModal(null, lead)`) ikinci Verordnung **`6bd45d0e`** kaydedildi (2 Einheiten) → Akte yenileme olmadan „7 laufende Verordnungen". ⚠ Bu yol yapay: Akte modalı (`patientDetailModal`) ile `rezeptModal` ikisi de `z-index:1000`, Akte üstte kalıyor, Speichern tıklanamıyor (pointer-intercept) — kaydetme JS `click()` ile yapıldı. Akte içinde Verordnung anlegen düğmesi yok, yani gerçek kullanıcı bu yığına düşmüyor; bulgu sayılmadı. **abrechnungsstatus emit → liste:** `06dbeb5c` Bereit → In Behandlung (`PATCH …/abrechnungsstatus` 200) → satır anında „In Behandlung"; geri Bereit → 428 „vorzeitig abrechnen?" → „Trotzdem abrechnen" → 200 → satır „Bereit zur Abrechnung" (başlangıç hâli). **dashboard.js:1938 dinleyicisi:** Termin-Aktionen paneli açıkken (bugünkü 09:00 randevusu) aynı modül örneğinden `emit('verordnungen:changed')` → `bookings?select=*,services(…),prescription_sessions(…prescriptions(…))&id=eq.…` 200, panel yeniden çizildi. **Reform 3.12 (maske yolu):** `f0a303e6` INSERT sonrası `ocr_raw_response`/`ocr_raw_enc`/`icd10_enc` NULL, `phi_encrypted=false`; PATCH sonrası da aynı. Önceki satırlar (`50139501`, `06dbeb5c`, `ddf57e1b`) hâlâ dolu — beklenen (temizlik listesi ayrı). OCR yolu canlıda sınanmadı (tarama görüntüsü yok); kodda OCR ve maske aynı insert'i kullanıyor, `ocr_raw_response`/`encryptPHI` satırları diff'te kaldırılmış. **Rechnung/DMRZ (daraltılmış select):** Rechnungen paneli hatasız açıldı („Noch keine Rechnungen“); QA tenant’ta `prescription_id`’li fatura yok → DMRZ export uçtan uca SINANAMADI; `rechnung-dmrz.js:139` select’i canlı PostgREST’te 200 (12 alan, `buildDmrzXml`’in okuduğu alanların hepsi). **handleSessionDrop (daraltılmış embed):** tenant’ta `prescription_sessions` yok (podoloji `podologie_behandlungen` kullanıyor) → sürükle-bırak SINANAMADI; `dashboard.js:3843` embed sorgusu canlıda 200. Konsol: bilinen gürültü (1, 2, 4) + bilinen anomali `loadActivityFeed` + bir kez `POST /api/arzt/resolve` CORS/`Failed to fetch` (11:11:38Z, tek sefer; ardından `rezept/confirm` 200 ve preflight elle 204 + doğru ACAO — büyük olasılıkla Watchtower konteyner değişimi anı, bulgu sayılmadı). Gözlemler: (a) Leitsymptomatik a) + Heilmittel öneri listesinden „78010 – Podologische Behandlung (klein)" → ⚠ „Aus der Leitsymptomatik a) folgt „Hornhautabtragung" — im Heilmittelfeld steht „78010 – …"" (`module/verordnung-pruefung.js:311` birebir metin karşılaştırıyor) — maskenin kendi önerisini kendi kontrolü uyarıyor; aşağıda anomali kutusunda `podoloji`'ye soru. (b) Abrechnungsstatus diyaloğu 0 Behandlung'lu reçetede varsayılan „Bereit zur Abrechnung" + „Behandlungen sind dokumentiert …" yardım metni gösteriyor (`module/abrechnungsstatus.js:88`); Übernehmen → 422 ve ancak o zaman „Noch keine Behandlung dokumentiert …" — P3.
**Son test:** 2026-09-30 (`7459ba1` tek-`?v=` modül turu; canlı `dashboard.js?v=20261001e` = yerel, `git log origin/main..HEAD` boş; QA tenant test2, 11:41–11:50Z) — GEÇTİ. Taze goto: 146 JS dosyası, her biri **tek URL** ile yüklendi (`performance` kaynak listesi, dosya başına sürüm sayısı hep 1): `datum.js?v=20260930f`, `verordnung-regeln.js?v=20260918`, `sitzungsplan.js?v=20261001e`, `termin-nicht-erschienen.js?v=20260916b`, `kalender-raster.js?v=20260830`, `signal.js?v=20260813`. Liste → „In Behandlung“ bir podo reçetesi (1-6) açıldı → Behandlungseinheiten altında Sitzungsplan bloğu („✓ Befund ist eingeplant“, „Sitzung 1–4 · Befundung (78030) + Behandlung (78010/78020)“, Eingangsbefundung tarihi) render ediyor. Konsol: yalnız bilinen gürültü (visibility_reports 403 her panel geçişinde, Nominatim CSP, loadActivityFeed TypeError, #calendarEl).
**Son test:** 2026-09-30 (Reform P3-2/P3-3/P3-4 + podoloji (a)/(c); `047baab`+`5cd9720`; canlı `dashboard.js?v=20261001g` = yerel (deploy ~2 dk sonra indi, taze goto), `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 11:57–12:10Z) — KISMEN. **P3-3 GEÇTİ:** `50139501` (E11.7+DF) → Speichern → „Verordnung speichern?“ Hinweise: „E11.7 ist nicht endständig — für DF passen z. B. E11.74, E11.75 Korrektur nur durch den Arzt (neue Unterschrift + Datum).“ — bir kez, genel katalog cümlesiyle mükerrer değil → Abbrechen, kayıt yok. **P3-4 GEÇTİ:** aynı maskede DG katalogdan DF→NF: uyarı „Der ICD benennt nicht … E11.7 (NF) — Diabetes-Kodes gehören zur Diagnosegruppe DF, nicht NF“, blur sonrası DG NF kaldı; NF→DF: uyarı yeniden „E11.7 ist nicht endständig — für DF …“, DG DF kaldı, ping-pong/ezme yok. Gözlem (P3, bulgu sayılmadı): DG turundan sonra ICD alanının altında ikinci bir satır (katalog `status`: „ICD-Code ist nicht endständig. … Korrektur nur durch den Arzt …“) + DG uyarı satırı birlikte görünüyor — ilk açılışta yalnız ikincisi vardı; aynı bilgi maskede iki cümle. **P3-2 GEÇTİ (banner + diyalog):** `6bd45d0e` maskesinde kaydetmeden: LANR boş → `rzSperreBanner` „Behandlung gesperrt: Arzt-Nr. (LANR) fehlt (Podologie-Vertrag Anlage 3). …“; + Unterschrift kaldırılınca „… Arzt-Nr. (LANR) und Unterschrift/Stempel fehlen …“; LANR geri → „… Unterschrift/Stempel des Arztes fehlt …“. Speichern diyaloğu her iki tekil durumda aynı cümleyi sonda veriyor. ⚠ Yan bulgu: LANR boşken Speichern → onay diyaloğundan ÖNCE `POST /api/arzt/resolve` **500** „Arzt konnte nicht angelegt werden“ — bkz. anomali kutusu. **(a) KISMEN:** `06dbeb5c` (LS a) Heilmittel öneri listesinden 78010 → Prüf motoru temiz („Die Angaben passen zusammen.“, alanda ⚠ yok) ✓; **ama** maskenin kendi ipucu satırı (`module/verordnung-podo.js:320-323`) hâlâ „Aus der Leitsymptomatik a) folgt „Hornhautabtragung“ — das Heilmittelfeld wurde von Hand geändert.“ diyor (olay yeniden tetiklenince de) → KALDI, P2, builder devri aşağıda. 78020 → amber (`vo-mark-warnung`) „78020 „Behandlung groß“ gehört nur zur Komplexbehandlung (Leitsymptomatik c). Bei a) oder b) wird 78010 abgerechnet.“ hem alanda hem Prüf kutusunda ✓. Kaydedilmedi (reload ile atıldı). **(c) GEÇTİ:** Verordnungen listesi Status düğmesi, `f0a303e6` (aktiv, 0 Behandlung): „Bitte wählen …“ seçili, „Bereit zur Abrechnung — erst nach der ersten Behandlung“ disabled, Übernehmen disabled; yardım „Für diese Verordnung ist noch keine Behandlung dokumentiert.“; Archiviert seçince Übernehmen açık, „Bitte wählen“e dönünce yine disabled → Abbrechen, durum değişmedi. ≥1 Behandlung: `50139501` (1 pozisyonsuz Behandlung `3e256b9a`) → eski davranış, „Bereit zur Abrechnung“ önseçili + „Behandlungen sind dokumentiert …“ → Abbrechen. Soru (`podoloji`/`gkv-302`): yalnız Befund günleri olan (78010/78020'siz) reçetede „Bereit“ önseçili, listede aynı reçete „0 / 3“ Einheiten. Konsol: yalnız bilinen gürültü (1, 2, 4 + `loadActivityFeed`) + yukarıdaki `arzt/resolve` 500.
**Son test:** 2026-09-30 (P2 regresyon `765c9ed`; canlı `dashboard.js?v=20261001h` = yerel, `verordnung-podo.js?v=20261001h` tek örnek, `git log origin/main..HEAD` boş; QA tenant test2, taze goto, 12:13–12:25Z; hiçbir şey kaydedilmedi) — GEÇTİ (kalan P3 ile). Kayıtlı LS a + 78010 reçeteler (`f0a303e6`, `6bd45d0e`) taze açılışta: `rzPodoHinweis` yalnız Frist satırı, Heilmittel alanı işaretsiz ✓. `06dbeb5c` (LS a): 78010 → LS/DG yeniden hesaplanınca ipucu satırı YOK ✓; „Nagelbearbeitung“ (serbest metin) → „Leitsymptomatik a) passt zu „Hornhautabtragung“ — auf der Verordnung steht „Nagelbearbeitung“. Im Einvernehmen … vermerken.“ ✓, alan `vo-mark-warnung` (amber zemin) ✓; 78020 → „78020 „Behandlung groß“ gehört nur zur Komplexbehandlung (Leitsymptomatik c). Bei a) oder b) wird 78010 abgerechnet.“ ✓ + alan amber. Kalan P3 (anomali kutusu): ipucu satırı yalnız Heilmittel alanı değişince yeniden hesaplanmıyor; ipucu satırının kendisi gri (`--text-muted`), amber olan alan işareti. Konsol: yalnız bilinen gürültü.
**Son test:** 2026-09-30 (S4-1 `8716a3d`; canlı `dashboard.js?v=20261001i` = yerel, `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 12:28–12:42Z; yazma yolu: `podologie_behandlungen`/`bookings`/`prescriptions` POST/PATCH tarayıcıda fetch-guard ile bloklandı, 0 istek yakalandı, DB `updated_at`/`created_at` test öncesinde kaldı) — GEÇTİ (bir alt madde sınanamadı). **Status diyaloğu, yalnız Befund günlü reçete** (`50139501`, iki satır 78030+79933, 78010/78020 yok): „Bitte wählen …“ seçili, „Bereit zur Abrechnung — erst nach der ersten Behandlung (78010/78020)“ disabled, Übernehmen disabled, yardım „Für diese Verordnung ist noch keine abrechenbare Behandlung (78010/78020) dokumentiert.“ → Abbrechen ✓. **78010’lu reçetede Bereit önseçili: SINANAMADI** — QA’da 78010 Behandlung’lu reçetelerin hepsi zaten `bereit` (`06dbeb5c`/`ddf57e1b`/`f77efc4c`; diyalog „aktuell: Bereit“, seçenekler In Behandlung/Storniert/Archiviert), „In Behandlung“ + 78010 durumu yazmadan kurulamadı. **LS ipucu Heilmittel değişince** (`06dbeb5c`, LS a, kayıtlı Heilmittel bozuk „HornhautabtragungHorn“): alanı „Hornhautabtragung“ yap + `change` → `rzPodoHinweis` anında Beginnfrist satırına döndü (uyuşmazlık kalktı), „Podologische Komplexbehandlung“ → anında „… auf der Verordnung steht „Podologische Komplexbehandlung““ ✓ (yalnız `input` olayında değişmiyor — tasarım gereği `change`). Kaydedilmedi (reload, `updated_at` değişmedi).
**Son test:** 2026-09-30 17:40–18:10Z (`50cfbe4`+`1f1ef45`+`f587876`; canlı `dashboard.js?v=20261002a` = yerel, `kiosk.js`/`anamnese.js?v=20261002a`, `podo-wagner.js`/`podo-therapiezeit-regel.js`/`praxis-standort.js?v=20261001z`; `git log origin/main..HEAD` test başında boş, test sırasında paralel oturumdan push edilmemiş `3758354` geldi — test hedefi canlı `f587876`; QA tenant test2, `-s=praxura-qa`) — GEÇTİ (`50cfbe4`). Yeni maske, hasta `a8e9df53`, „Verordnung prüfen“ (kaydetmeden): DF + L60.0 + Diagnosetext boş → „1 Angabe stimmt so nicht. So nicht: L60.0 passt nicht zur Diagnosegruppe DF. Die Kasse setzt diese Kombination ab — Korrektur nur durch den Arzt (neue Unterschrift + Datum) oder ein Diagnosetext auf der Verordnung.“ (Blocker) · Diagnosetext dolu → „2 Punkte zum Nachsehen — erfassbar … Bitte prüfen: L60.0 passt nicht zur Diagnosegruppe DF. Ein Diagnosetext ist angegeben und wird übermittelt …“ (Warnung) · UI1 + E11.74 metinli ve metinsiz → ikisi de Blocker, Diagnosetext yolu anılmıyor · kontrol: UI1+L60.0 ve DF+E11.74 → ICD-Blocker yok. ⚠ `verordnung-pruefung.js` importları hâlâ `?v=20261001h` (içerik canlıda yeni, `max-age=0` sayesinde; P3 cache-bust). Kayıtlı reçete yolu (`voAusGespeicherterVerordnung` → `diagnose_freitext`) sınanmadı. Ayrıca LS c ile yeni reçete `50d1a8da` KAYDEDİLDİ (LANR Prüfziffer uyarısı → Trotzdem): DB `leitsymptomatik='0010'` (bit dizgisi) — Tagesbehandlung bunu okuyamıyor, bkz. devir [P1] Therapiezeit. P3: tek kayıtta „Verordnung gespeichert ✓“ toast'u iki kez (DB'de tek satır).

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
**Son test:** 2026-09-30 (Reform P3-2 blok metni + podoloji (b); `047baab`+`5cd9720`; canlı `dashboard.js?v=20261001g` = yerel (deploy ~2 dk sonra indi, taze goto), `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 11:57–12:10Z) — GEÇTİ. **P3-2:** `6bd45d0e` Unterschrift'siz kaydedildi (Trotzdem speichern) → Tagesbehandlung „Behandlung speichern“ → yazma YOK, metin „Behandlung gesperrt: Unterschrift/Stempel des Arztes fehlt (Podologie-Vertrag Anlage 3). Bitte vom Arzt ergänzen lassen …“ → Unterschrift geri işaretlendi, DB'de `unterschrift_vorhanden=true`, `arzt_id` değişmedi. Sperre form açılırken hâlâ görünmüyor, yalnız kaydetmede (önceki P3 UX notu aynen). **(b):** `50139501` (DF, Leitsymptomatik yok, `heilmittel_items` boş, Heilmittel metni pozisyonsuz) seçilince 78010 önseçili ✓ (+78030, 79933); başlık altında not „Auf der Verordnung fehlt die Leitsymptomatik — im Einvernehmen mit der verordnenden Praxis ergänzen (ohne neue Unterschrift), sonst wird die Abrechnungsdatei abgewiesen.“ ✓ (metin karar dosyasındaki „… bevor abgerechnet wird“ ifadesinden farklı; „abgewiesen“ iddiası gkv-302'nin açık sorusu (b)'ye önden cevap veriyor — `gkv-302`'ye soru). 78010 kaldırıldı → Speichern → „Keine Behandlungsposition (78010/78020) gewählt — es wird nur die Befundung dokumentiert. Ist das so gewollt?“ ✓; „Zurück“ → yazma yok, form hâli korunuyor ✓; ikinci deneme „Ohne Behandlung speichern“ → `podologie_behandlungen` **`f287afd9`** (78030 · 79933), reload sonrası duruyor ✓. Gözlem → anomali kutusu: aynı reçete + aynı gün (30.09) ikinci Befund-günü (78030+79933 iki kez) uyarısız kabul edildi.
**Son test:** 2026-09-30 (S4-1 `8716a3d`; canlı `dashboard.js?v=20261001i` = yerel, `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 12:28–12:42Z; yazma yolu: `podologie_behandlungen`/`bookings`/`prescriptions` POST/PATCH tarayıcıda fetch-guard ile bloklandı, 0 istek yakalandı, DB `updated_at`/`created_at` test öncesinde kaldı) — GEÇTİ (P2 yan bulguyla). `50139501` seçildi: `#podVerordnetZeile` gri (`rgb(122,111,97)`) „Verordnet: keine Position auf der Verordnung erfasst — vorbelegt: 78010“ (reçetede `heilmittel_position` NULL → doğru dal). İşaretli kutularda gri gerekçe: 78010 „— Behandlungsposition laut Verordnung“ (⚠ üst satırla çelişiyor → P2 devri), 78030 „— Eingangsbefundung am 28.09.2026 schon erfasst — Befundung vor jeder weiteren Behandlung“, 79933 „— Hausbesuch laut Verordnung“; işaretsizlerde gerekçe yok ✓. Tarih 30.09 (zaten `3e256b9a` + `f287afd9` var) → „Behandlung speichern“ → `confirmModal` „Zweiter Behandlungstag — Für diese Verordnung ist am 30.09.2026 bereits ein Behandlungstag erfasst. Je Tag ist nur eine Behandlung abrechenbar (HeilM-RL § 12 Abs. 8) — trotzdem speichern?“ Zurück / Trotzdem speichern → **Zurück** → form açık kaldı, yazma isteği 0, Behandlung sayısı 2 (değişmedi).
**Son test:** 2026-09-30 (S4-2 `f14b2d8`; canlı `dashboard.js?v=20261001m` = yerel (deploy ~2 dk sonra indi, modüller `podo-tag-zusatz`/`fussbefund`/`lead-status` `?v=20261001m`), `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 12:58–13:25Z; yazma yolu fetch-guard ile kapalı, tek gerçek kayıt aşağıda) — KISMEN, bir P1 ile. **Fußbefund bölümü:** `50139501` → `<details id=podFussbefundBox>` kapalı, başlık „Fußbefund — zuletzt am 29.09.2026 · Befund unverändert lassen oder aktualisieren“ (DB: hastanın tek geçerli `pat_fussbefund` `766a84b7`, 29.09 ✓). „Noch kein Fußbefund · Zum Erfassen aufklappen“ dalı yalnız okuma cevabı boşaltılarak (simülasyon) görüldü — QA’da Befund’suz hastaya ait podo reçetesi yok. Açınca kart gömülü (SVG, `fbpTermin` 30.09 önseçili), `fbpPatientSearch` kabı `hidden`, `#fussstatusContent` boş, `#fbpSaveBtn` tek. Menüden Fußbefund paneline geçiş → kart panelde tek örnek (gömülü host boşaldı, arama görünür, hasta seçili değil); geri Tagesbehandlung → bölüm kapalı, yeniden açılınca kart tekrar kuruluyor ✓. ⚠ **P1 (devir aşağıda):** açılınca Tagesbehandlung grid’i `1fr 1fr` (476/476) → `282px 950px`’e sıçrıyor, sağ sütun `#mainArea` (`overflow:hidden`) dışına taşıyor: 1280 px’te gömülü kartın „+ Neuer Befund“ (x 1257–1383) ve **„Speichern“ (x 1391–1491)** görünmez/erişilemez, 1440 px’te de Speichern 1391–1491; ancak 1920 px’te içeride. **390 px:** Tagesbehandlung zaten kapalı hâlde de iki sütunlu (282 + 278, panel x 318–597, `#mainArea` scrollWidth 597) — mobilde form ekran dışında; bu S4-2’den önce de böyle (grid’de breakpoint yok), açınca 950 px’e büyüyor. `documentElement.scrollWidth`=390 (taşma kırpılıyor, kaydırılamıyor). → `mobil-ui`. **Folgetermin sorusu:** gerçek kayıt **`7557e386`** (`f0a303e6`, 30.09, 78010+78030+79933; `behandlungsbeginn` 30.09 yazıldı, status NULL kaldı) → „Folgetermin? — Behandlung gespeichert. Folgetermin jetzt anlegen?“ Später / Folgetermin anlegen ✓ → **Folgetermin anlegen** → maske „Neuer Termin“, `bk-id` boş, hasta `a8e9df53`, `bkSelectedRxId`=f0a303e6, Hausbesuch ✓, Leistung „Podologische Behandlung (klein)“, `bkStart` 2026-10-07T09:00 (yer tutucu 30.09 09:00 + 7), Befund önerisi var; kaydedilmedi, yeni booking 0. **Später** (sahte-başarılı insert, DB’ye yazılmadı) → hiçbir modal/istek yok ✓. **Tükenmiş** `f77efc4c` (1/1, sahte insert) → toast „Alle Einheiten aufgebraucht …“, soru YOK ✓. **Hausbesuch** (`50139501` + booking `e48f89a4`; önseçim modülün `setPodVorwahl`’ı ile, Fahrt durumu okuması `fahrt_return_pending` olarak taklit, insert/`bookings` PATCH/`fahrten` POST sahte): kayıttan sonra „Hausbesuch: Fahrt ist noch offen. [Fahrt beenden]“ görünür, soru YOK ✓ → Fahrt beenden → End-KM → Speichern → ipucu kalktı, **soru ondan sonra** ✓ → Folgetermin anlegen → rx 50139501, `bkStart` 2026-10-16T10:00 (02.10 + 14) ✓. DB: `e48f89a4` fahrt alanları değişmedi, yeni `fahrten` 0. ⚠ P1 (kod+veri, canlıda yazılmadı): „aufgebraucht“ sayacı satır sayıyor, abrechenbar gün değil — devir aşağıda. Konsol: bilinen gürültü (1, 2, 4, `loadActivityFeed`) + kendi test sorgularım/guard kaynaklı `[permissions] blocked by test guard`; S4-2 kaynaklı hata yok.
**Son test:** 2026-09-30 (P1 regresyonu canlı regresyon 2026-09-30 13:30–13:45Z, `b830cfb`+`96e8f3a`, `dashboard.js?v=20261001n`, QA test2, fetch-guard ile yazmasız; `git log origin/main..HEAD` boş) — GEÇTİ. (1) Fußbefund bölümü açıkken 1280/1440/1920 px’te sağ sütun taşmıyor, gömülü „Speichern“ + „+ Neuer Befund“ görünür ve tıklanabilir. (2) Abrechenbar gün sayacı: yukarıdaki devir kaydına bak — Befund-only satırlar reçeteyi erken `bereit` yapmıyor, soru çıkıyor. (3) `ladeTagesTermin` (Berlin günü): listeden açılan `ddf57e1b`, Behandlungstag 29.09 (randevu `7a6fc08b` 29.09 21:00 Berlin, fahrtBookingId yok) → sahte kayıt → Folgetermin anlegen → `bkStart` **2026-10-20T21:00** (randevu + 21, „1x alle 3 Wochen“; yer tutucu olsaydı 09:00) ✓, rx ddf57e1b, Hausbesuch ✓, kaydedilmedi. Yeni DB satırı 0 (`podologie_behandlungen`/`bookings` 13:10Z sonrası boş). P3 not: `96e8f3a` `podo-tag-zusatz.js`’i değiştirdi ama import hâlâ `?v=20261001m` (`module/podologie-abrechnung.js:106`) — bu tarayıcı dosyayı ağdan yeniden doğrulayıp yeni hâli aldı (`transferSize` > 0), fakat cache-bust kuralı çiğnenmiş; builder’a bir sonraki dokunuşta bump. Gece yarısı sınır durumu (00:00–02:00 Berlin randevusu) QA’da veri olmadığından doğrudan gözlenmedi.

**Son test:** 2026-09-30 (S4-3 `6bf6ecc`; canlı `dashboard.js?v=20261001p` = yerel (deploy ~1 dk sonra indi), modüller `akte-podo`/`podo-tag-zusatz`/`podologie-abrechnung` `?v=20261001p`, `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 14:03–14:40Z; yazma yolu fetch-guard ile kapalı, gerçek yazma YOK) — GEÇTİ. **Anamnese-Notiz:** `6bd45d0e` (hasta `a8e9df53`, DB’de anamnese 0) → Fußbefund kutusunun altında „Für diese Patientin / diesen Patienten ist noch keine Anamnese erfasst.“ + „Anamnese erfassen“ → panel `anamnese`, `anamPatientSelect` = o hasta ✓. **78040 sorusu:** gerçek veride 78040 zaten 28.09’da abgerechnet → sert „einmalig“ bloğu önce devreye giriyor (doğru). `podologie_behandlungen` okuması boş taklit edilerek: 78010+78040 → „Anamnese fehlt — … Anlage 1a Teil 2 Nr. 4.1 … Wurde sie erhoben (auch auf Papier)?“ [Zurück | Anamnese erhoben — speichern] ✓ → **Zurück:** yazma isteği YOK, form + işaretler duruyor ✓ → **erhoben:** sahte insert → toast „Behandlung gespeichert ✓“ → Folgetermin sorusu ✓. **Anamnese var** (okuma 1 satır taklit): Notiz YOK, 78040 kaydı soru sormadan geçti → Folgetermin sorusu ✓. **Regresyon:** Fußbefund bölümü açılınca 1280 px’te `#fbpSaveBtn` 959–1059, `elementFromPoint` isabet, tek kart, SVG var, `fbpTermin` `396000d2` ✓; Folgetermin anlegen → „Neuer Termin“, `bk-id` boş, 2026-10-07T09:00, Hausbesuch ✓, kaydedilmedi. Konsol: bilinen gürültü (1, 2, `loadActivityFeed`) + kendi test sorgularım; S4-3 kaynaklı hata yok.

**Son test:** 2026-09-30 (`f940a1a` UI1 Nagelspange; canlı `module/podologie-abrechnung.js?v=20261001p` içeriği düzeltmeyi taşıyor — ⚠ commit `?v=`'yi bump etmedi (dashboard.js importu hâlâ `20261001p`), sunucu `Cache-Control: max-age=0, must-revalidate` verdiği için tarayıcı yeniden doğruluyor → P3, cache-bust kuralı; `git log origin/main..HEAD` boş; QA test2, `-s=praxura-qa`, 14:58–15:04Z; QA'da UI1/UI2 reçete YOK → `f0a303e6` (gerçekte DF) okuma cevabında DG=UI1/UI2 + ICD L60.0 olarak taklit, Lokalisation serbest metin „TEST Zehe"; yazma yolu fetch-guard ile kapalı, 3 POST `podologie_behandlungen` yakalandı, DB'de 14:00Z sonrası yeni Behandlung 0) — GEÇTİ. **UI1:** kutular 78610/78620/78100/78110/78510/78520/79933/79934; yalnız 78610 → Speichern → „nur bei UI2" hatası YOK, hata satırı boş, tek POST (sahte başarı). **UI1 + aynı gün kayıt** (liste okumasına 30.09 tarihli sahte 78610 satırı eklendi): „Zweiter Behandlungstag" sorusu ÇIKMADI, doğrudan POST. **UI2** (78530 de listede): 78610 → hata yok, soru yok. **DF:** 78610 kutusu hiç sunulmuyor (78010/78020/78030/78040/79933/79934) → hata metni yolu UI'dan erişilemez; 78010 + aynı gün sahte kayıt → „Für diese Verordnung ist am 30.09.2026 bereits ein Behandlungstag erfasst … trotzdem speichern?" ÇIKTI, POST yok ✓. Konsol: bilinen gürültü (1, 2, 4, `loadActivityFeed`) + kendi sorgularım.
**Son test:** 2026-09-30 17:40–18:10Z (`50cfbe4`+`1f1ef45`+`f587876`; canlı `dashboard.js?v=20261002a` = yerel, `kiosk.js`/`anamnese.js?v=20261002a`, `podo-wagner.js`/`podo-therapiezeit-regel.js`/`praxis-standort.js?v=20261001z`; `git log origin/main..HEAD` test başında boş, test sırasında paralel oturumdan push edilmemiş `3758354` geldi — test hedefi canlı `f587876`; QA tenant test2, `-s=praxura-qa`) — **KALDI (P1)**. Wagner rozeti GEÇTİ: `6bd45d0e` ve `50d1a8da` (DF) başlık `h4` → „Wagner 2 · 30.09.2026“ (Fußbefund `d047330c`'ten, tooltip „… — aus dem Fußbefund“). Therapiezeit: maskeden kaydedilmiş c-reçetesi `50d1a8da` (`leitsymptomatik='0010'`) → alan **YOK**, 78010 önseçili — `podVordMassnahme` bit dizgisini tanımıyor (devir aşağıda). Mekaniği sınamak için `leitsymptomatik` geçici olarak `'c'` yapıldı (doğrudan DB, sonra `'0010'`'a geri alındı): „Therapiezeit (Minuten) *“ alanı var; boş → `podBehError` „Bei Komplexbehandlung (c) bitte die Therapiezeit … angeben“, yazma yok; 15/20 → 78010, 21/25 → 78020 otomatik (ipucu „25 Min. → 78020“); 25 dk + elle 78010 → „Bei 25 Minuten Therapiezeit ist 78020 abzurechnen … — bitte 78010 abwählen und 78020 wählen.“, yazma yok; 25 dk + 78020 → `POST podologie_behandlungen` + `PATCH prescriptions`, toast „Behandlung gespeichert ✓“; yenileme sonrası DB `1ebd1225`: `hpnr_codes=[78020]`, `therapiezeit_min=25`. c olmayan `6bd45d0e` → alan yok ✓.
**Son test:** 2026-09-30 20:49–21:20Z (`3758354`+`853ea99`; canlı `dashboard.js?v=20261002c` = yerel, `kiosk.js?v=20261002c`, `podologie-abrechnung.js`/`praxis-standort.js`/`attendance.js?v=20261002a`; `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`) — GEÇTİ (Therapiezeit P1 regresyonu). Fetch-guard ile yazmasız (yalnız `rest/v1` yazmaları engellendi, RPC serbest — ilk denemede RPC de engellenmişti ve HPNR listesi boş geldi: kendi test artefaktım, bulgu değil). `50d1a8da` (DB `leitsymptomatik='0010'`, DB'ye dokunulmadı) → „Therapiezeit (Minuten) *“ görünür; 15 → „15 Min. → 78010“ + 78010 işaretli, 25 → 78020 işaretli / 78010 kalktı, 20 → 78010. Kaydetme: boş dakika → „Bei Komplexbehandlung (c) bitte die Therapiezeit in Minuten angeben …“; 25 dk + 78010 → „Bei 25 Minuten Therapiezeit ist 78020 abzurechnen …“; geçerli giriş (20/78010) → „Zweiter Behandlungstag“ Rückfrage → Zurück. a) reçete `6bd45d0e` (`'1000'`): Therapiezeit alanı yok, „Verordnet: 78010“; 78020 işaretle → Speichern → „78020 ist nur bei verordneter Komplexbehandlung abrechenbar. Verordnet ist „Hornhautabtragung" — bitte 78010 zzgl. 78030 verwenden.“ (b) `'0100'` QA'da yok — aynı `['a','b']` dalı; yeni reçete açılmadı). Engellenen yazma 0, konsol 0 hata. P3 gözlem: hata metninde kapanış tırnağı düz `"` (“ yerine).

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

### Patientenakte — Podologie 6 Reiter + Kopf-Knöpfe (S4-3) — nav etiketi: (Patientenkarte, `kunden` / Termin-Aktionen içinden açılır)

**Beklenen:** Podolojide tam 6 sekme, sırayla Verlauf · Anamnese · Fußbefund · Verordnungen · Dokumente · Rechnungen
(Messreihen/Notizen/Termine/Einwilligungen/Überweisung/Mail sekme olarak yok). Verlauf altında açılır „Termine“ (Abgesagte-Schalter)
ve „Notizen“; Dokumente altında Einwilligungen · Überweisung · Mail-Historie. Verordnungen = laufende Verordnungen, yoksa boş ipucu.
Başlıkta „+ Termin“ (akte kapanır, Terminmaske hasta önseçili) ve „+ Verordnung“ (Anlegen-Wahl o hastayla). Physio/Ergo/Logo değişmez.
**Bağımlı ekranlar:** Terminmaske (`bookingModal`), Rezept-Scan/Muster 13, Termin-Aktionen → Patientenakte
**Son test:** 2026-09-30 (S4-3 `6bf6ecc`; canlı `dashboard.js?v=20261001p` = yerel (deploy ~1 dk sonra indi), modüller `akte-podo`/`podo-tag-zusatz`/`podologie-abrechnung` `?v=20261001p`, `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 14:03–14:40Z; yazma yolu fetch-guard ile kapalı, gerçek yazma YOK) — KISMEN, bir P1 + bir P2 ile (ikisi de S4-3 öncesinden, S4-3 regresyonu değil). **6 sekme GEÇTİ:** `a8e9df53` ve `22181f45`’te görünür sekmeler tam `verlauf · anamnese · fussbefund · rezepte(„Verordnungen“) · dokumente · rechnungen`, açılışta Verlauf aktif; Messreihen görünmüyor. Paneller taşındı (`pdPanelNotes/Termine/Einwilligung/Ueberweisung/Mail` → host’lar, sınıf `pd-unter`). Termin-Aktionen → Patientenakte da 6 sekme + Kopf. **Verlauf:** Termine + Notizen kutuları açılıyor, içerik yüklü („Keine Notizen vorhanden.“ — DB’de not yok ✓). **Abgesagte-Schalter** mekanik GEÇTİ (`22181f45`: 0 → 2 satır „Abgesagt am …“ → 0). ⚠ **P2 (eski):** Termine listesi hastayı `bookings.lead_id` ile değil `customer_phone`/`customer_name` ile buluyor — `a8e9df53`’te `lead_id` ile 16 randevu var, listede 2 (5 aktif + 9 abgesagt görünmüyor, Schalter açıkken de 2); devir aşağıda. P3: durum ham İngilizce („confirmed“, „completed“). **Dokumente:** üç bölüm içerikle (Einwilligung einholen + „noch keine digitale Einwilligung“, Überweisung fotografieren + boş, Mail boş) — DB’de üçü de 0 ✓, spinner yok. **Verordnungen:** `a8e9df53` → „7 LAUFENDE VERORDNUNGEN“ kartları; `22181f45` (reçetesiz) → boş ipucu „Keine laufende Verordnung …“ ✓. ⚠ **P1 (eski, §302-komşu):** kartların ALTINDA physio listesi de çiziliyor (`pdRezContent`: Zuzahlungs-Befreiung + 7 satır „0/4 Sitzungen“ · „DMRZ offen“ · „Als bereit markieren“/„Rückgängig“) — aynı reçete iki kez, sayaçlar çelişiyor (kart „1 / 4 Einheiten“, liste „0/4 Sitzungen“); reçetesiz hastada „Keine Rezepte vorhanden.“ + boş ipucu üst üste. Sebep `isPhysio` podolojide de true (`PRAXIS_SECTORS` içinde) → `loadPatientDetailRezepte` koşuyor; `akte-podo.js` koşmadığını varsayıyor. Devir aşağıda. **Hasta değiştirme GEÇTİ:** kapat → `22181f45` aç: başlık değişti, 0 kart/boş ipucu, 0 not, Verlauf aktif; geri `a8e9df53`: 7 kart. **+ Termin GEÇTİ:** akte kapandı, „Neuer Termin“, hasta seçili, Hausbesuch ✓, 5 Verordnung kartı (hastanın telefonu yok — telefon alanı sınanamadı); kaydedilmedi. **+ Verordnung GEÇTİ:** akte kapandı, „Muster 13 scannen“ seçimi → „Von Hand eintippen“ → Muster 13 maskesinde `rzPatientSearch`/`rzPatVorname` o hastayla dolu; kaydedilmeden kapatıldı. P3: Kopf düğmeleri 21 px yüksek (dokunma hedefi küçük). Konsol: S4-3 kaynaklı hata yok.
**Son test:** 2026-09-30 (Akte regresyonu `2db9bd0`+`5badd60`; canlı `module/patient-termine.js` `lead_id.eq` içeriyor (push’tan ~1 dk sonra indi), `akte-podo.js` `setProperty`-guard’lı, `git log origin/main..HEAD` boş; QA test2, `-s=praxura-qa`, 14:20–14:35Z, fetch-guard ile yazmasız — tek bloklanan istek bilinen `visibility_reports` POST’u) — GEÇTİ. 6 sekme aynen. **Verordnungen:** `a8e9df53` yalnız laufende kartlar, physio listesi (`#pdRezContent`) gizli, „Sitzungen“ satırı 0; `22181f45` tek boş ipucu. **Termine:** `a8e9df53` 7 aktif (Bestätigt 3 · Erledigt 4) = DB, Schalter +9 Abgesagt = 16 = DB, geri 7; `22181f45` 0 → 1 → 0 = DB. Konsol: yeni hata yok (yalnız bilinen gürültü). Physio hasta QA’da yok — Physio Akte sınanmadı.

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
**Son test:** 2026-09-30 (Reform P3-1; `047baab`+`5cd9720`; canlı `dashboard.js?v=20261001g` = yerel (deploy ~2 dk sonra indi, taze goto), `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 11:57–12:10Z) — GEÇTİ. GKV hasta „Lead bearbeiten“ → IK (Versichertenkarte) `12345` → Tab → Speichern: „IK der Krankenkasse muss genau 9 Ziffern haben.“ sayfada **bir kez** (DOM'da tek eşleşme), modal açık kaldı; Abbrechen + yeniden açınca IK `100167999` (kaydedilmedi).

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
**Son test:** 2026-09-30 (`7459ba1` tek-`?v=` modül turu, canlı `?v=20261001e`, QA tenant test2) — GEÇTİ (yalnız render). `kalender-raster.js` tek URL (`?v=20260830`). Tag: 48 `dv-slot`, 08:00–19:30, bugünkü QA randevusu `dv-booking-block` olarak görünüyor; Woche (`week-view-grid`, 252 düğüm) ve Monat (`month-grid`, 110 düğüm) geçişleri render etti. Yeni konsol hatası yok. Termin oluşturma bu turda sınanmadı.

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
**Son test:** 2026-09-30 (`7459ba1` tek-`?v=` modül turu, canlı `?v=20261001e`, QA tenant test2) — GEÇTİ (yazmasız yol). Seçilen yol: yeni test randevusu açılMAdı, `e48f89a4` kullanılMAdı; bugünkü 09:00 QA randevusu (`396000d2`) Tag görünümünden açıldı → `#bkActionNoShowBtn` „✕ Patient nicht erschienen“ görünür/aktif → tık → „Grund für Nicht-Erscheinen“ diyaloğu (Grund seçici, varsayılan „— Kein Grund angeben —“, Abbrechen/Bestätigen) → **Abbrechen** → diyalog kapandı, panel açık kaldı; `handlePatientNichtErschienen` `reason === null` ile yazmadan dönüyor (`dashboard.js:4400`). Yenileme sonrası randevu bloğu değişmemiş (no_show izi yok). `termin-nicht-erschienen.js` tek URL (`?v=20260916b`) — ama `markiereNichtErschienen` bu turda ÇAĞRILMADI; yazma yolu (status=no_show, Einheit freigabe) sınanmadı. Konsol: yalnız bilinen gürültü.
**Son test:** 2026-09-30 (S4-1 `8716a3d`; canlı `dashboard.js?v=20261001i` = yerel, `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 12:28–12:42Z; yazma yolu: `podologie_behandlungen`/`bookings`/`prescriptions` POST/PATCH tarayıcıda fetch-guard ile bloklandı, 0 istek yakalandı, DB `updated_at`/`created_at` test öncesinde kaldı) — GEÇTİ (P2 yan bulguyla). `e48f89a4` (02.10 Hausbesuch, `fahrt_status=fahrt_completed` → durum yuvasında düğme değil „Fahrt + Termin abgeschlossen“ kutusu; veri durumuyla tutarlı): `#bkAktionsleiste`’de görünür tam 6 → Verordnung · Patientenakte · Folgetermin · Verschieben · Nicht erschienen · „Weitere Aktionen …“ (Ausfall/Doch behandelt gizli). Menü: Absagen · Termine drucken (A5) · Adresse kopieren · Fußbefund anlegen, `aria-expanded` doğru. **Verordnung** → `bkVeroPanelWrap`’a kaydırdı (scrollTop 0→1125, `bk-akt-blitz`). **Patientenakte** → `patientDetailModal`. **Verschieben** → mevcut maske (`bkStart` 2026-10-02T10:00, Hausbesuch ✓, Löschen/Verschieben düğmeleri; başlık „Neuer Termin“ — P3 anomali). **Absagen** → „Termin absagen“ diyaloğu (Abbrechen/Termin absagen) → Abbrechen. **Nicht erschienen** (gelecek tarihte de etkin, `updateNoShowButton` bilinçli) → „Grund für Nicht-Erscheinen“ (Abbrechen/Bestätigen) → Abbrechen. **Adresse kopieren** → toast „Adresse kopiert ✓“. **Termine drucken** → yazdırma çağrısı 1 (stub’landı). **Fußbefund anlegen** → `fussstatus` paneli aynı hastayla (Termin seçici boş, P3 anomali). **Folgetermin** (`e48f89a4`, `50139501` „1x alle 2 Wochen“): maske aynı hasta, Hausbesuch ✓, `bkSelectedRxId=50139501` kartı vurgulu, Leistung „Podologische Behandlung (klein)“ (kaynak `booking_leistungen` tek satır), `bkStart` 2026-10-16T10:00 (+14) + toast „Folgetermin vorbelegt: 14 Tage … (Frequenz der Verordnung)“; `396000d2` (`06dbeb5c` „1x pro Woche“) → 2026-10-07T09:00 (+7). Kaydedilmedi, yeni booking yok. ⚠ Folgetermin maskesinde 78030 Befund önerisi çıkmıyor, kart yeniden seçilince çıkıyor → P2 devri. **Mobil 390 px:** 5 düğme 171×44, „Weitere“ 349×44, menü öğeleri 331×44; `documentElement.scrollWidth`=390, panel içinde sağa taşan öğe yok ✓. Escape menüyle birlikte paneli kapatıyor (P3 anomali). **Fizyo (Folgetermin gizli): SINANAMADI** — QA tenant’ta fizyo reçetesi/randevusu yok (tüm `prescriptions` podo).
**Son test:** 2026-09-30 (S4-2 `f14b2d8`; canlı `dashboard.js?v=20261001m` = yerel (deploy ~2 dk sonra indi, modüller `podo-tag-zusatz`/`fussbefund`/`lead-status` `?v=20261001m`), `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 12:58–13:25Z; yazma yolu fetch-guard ile kapalı, tek gerçek kayıt aşağıda) — GEÇTİ. Görünür düğme tam 6 (Verordnung · Patientenakte · Folgetermin · Verschieben · Nicht erschienen · Weitere Aktionen …). **Escape:** menü açıkken gerçek Escape → menü kapandı, panel açık kaldı; ikinci Escape → panel kapandı ✓ (P3 kapandı). **Verschieben** (`396000d2`) → başlık „Termin bearbeiten“ ✓ (podo randevusunda `prescription_sessions` yok, Sitzung eki beklenmez — eki taşıyan physio dalı QA’da veri olmadığından sınanmadı). **Fußbefund anlegen** menüden → `fussstatus`, `fbpTermin` = `396000d2` (30.09) önseçili; gelecek randevu `e48f89a4` (02.10) → önseçili ✓ (P3 kapandı). **Folgetermin** (`e48f89a4`) → rx 50139501, 2026-10-16T10:00, „Vorschlag: Befundung (78030) übernehmen …“ ✓; maske etiketleri „Leistung“ / „Patient“. Kaydedilmedi.

**Son test:** 2026-09-30 (S4-3 `6bf6ecc`; canlı `dashboard.js?v=20261001p` = yerel (deploy ~1 dk sonra indi), modüller `akte-podo`/`podo-tag-zusatz`/`podologie-abrechnung` `?v=20261001p`, `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 14:03–14:40Z; yazma yolu fetch-guard ile kapalı, gerçek yazma YOK) — GEÇTİ (hızlı regresyon). Bugünkü randevu bloğu → `#bkAktionsleiste` görünür düğmeler tam 6: Verordnung · Patientenakte · Folgetermin · Verschieben · Nicht erschienen · Weitere Aktionen …; Patientenakte → 6 sekmeli podo akte + Kopf düğmeleri.

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
**Son test:** 2026-09-30 (S-35 `e9d0286`; canlı `?v=20261001d`, QA tenant test2, 11:18–11:22Z) — GEÇTİ. Açık Fahrt `2ec11d8f` (randevu `e48f89a4`, 02.10) kapatıldı: Kalender → 02.10 → randevu → „Ich bin angekommen" → „▶ Termin Starten" → „Termin liegt in der Zukunft" → „Heute behandeln" → Tagesbehandlung (`50139501`, `1-5`) → Behandlung speichern (**`3e256b9a`**, 78030 + 79933 — 78010 önseçili DEĞİLDİ çünkü `50139501`'de Leitsymptomatik yok, `podo-behandlungsposition-regel.js` tasarımı; test turunda elle eklenmedi) → „Hausbesuch: Fahrt ist noch offen." + „Fahrt beenden" → End-KM 30024 → Speichern. DB `fahrten` `2ec11d8f`: `zweck="Patientenbesuch"`, `zielort="Patientenbesuch (s. Verzeichnis Nr. P-E48F89A4)"`, `lead_id` dolu, 30020→30024, 4 km, `abfahrtsort` = praxis adresi; hasta adı/adresi YOK.

### Fahrtenbuch — Fahrten tablosu, CSV, Patientenverzeichnis — nav etiketi: `fahrtenbuch`

**Beklenen (S-35, 30.09.2026):** Fahrtenbuch'ta hasta adı/adresi **görünmez**. Tablo sütunları
Datum · **Nr.** (`P-` + booking id'nin ilk 8 hex'i, büyük harf) · Fahrtzweck · Zielort · Therapeut ·
Kennzeichen · Art · Start-KM · End-KM · Strecke · Dauer · ✏️. Hasta ziyaretleri (`lead_id` dolu ya da
eski satırda `zweck` „Hausbesuch …") ekranda, CSV'de ve düzenleme modalında daima
„Patientenbesuch" / „Patientenbesuch (s. Verzeichnis Nr. P-…)" olarak maskelenir — DB'deki eski ham
metin değişmez, yalnız gösterim. „CSV exportieren" → tam 11 sütun: lfd. Nr./Referenz · Datum ·
Kennzeichen · Fahrer · Km-Stand Beginn · Km-Stand Ende · gefahrene km · Abfahrtsort · Reiseziel ·
Reisezweck · Fahrtart (UTF-8 BOM, `;`). Ayrı „Patientenverzeichnis exportieren" → Referenz · Datum ·
Patientenname · Anschrift, aynı referanslarla; yalnız Finanzamt talebinde verilir (düğme `title` + toast).
**Bağımlı:** `module/fahrtenbuch-regeln.js` (`fahrtReferenz`, `fahrtZweckUndZiel`, `fahrtAnzeigeText`,
CSV'ler) · Fahrt Beenden (`dashboard.js` ~4252, yeni satırlar) · Hausbesuch akışı (yukarıda)
**Son test:** 2026-09-30 (`e9d0286`, canlı `?v=20261001d`, QA tenant test2) — GEÇTİ. Tablo 5 satır,
başlık „Nr." var; yeni satır `P-E48F89A4` ve DB'de hâlâ „Hausbesuch <Ad>" + hasta adresi taşıyan 3 eski
satır (`f726ab5e`, `5e917904`, `5246cb49`) ekranda „Patientenbesuch (s. Verzeichnis Nr. P-…)". `lead_id`'siz
eski satır `97206371` (boş zweck/zielort) „—" gösteriyor, Nr. `P-7A6FC08B`. CSV (`createObjectURL`
yakalanarak okundu, dosya kaydedilmedi): ilk baytlar EF BB BF, başlık tam 11 sütun beklenen sırada,
5 veri satırı, hiçbirinde hasta adı/adresi yok (Abfahrtsort = praxis adresi). Patientenverzeichnis CSV:
başlık `Referenz;Datum;Patientenname;Anschrift`, 5 satır, referanslar Fahrtenbuch CSV'siyle birebir
(`P-7A6FC08B` satırında Anschrift boş — lead yok, ad randevudan). Eski satır `f726ab5e` ✏️ → düzenleme
modalı: Zweck „Patientenbesuch", Zielort „Patientenbesuch (s. Verzeichnis Nr. P-396000D2)", ad/adres yok;
Abbrechen ile kapatıldı (yazma yok). Not: düzenleme modalında „Speichern" eski satırın DB'deki ham
metnini maskeli metinle ezer — istenen yön, bu turda sınanmadı. Konsol: yalnız bilinen gürültü.

### Fußbefund — nav etiketi: `fussstatus`

**Beklenen:** Hasta + (opsiyonel) termin seçilir, işaretler/diagram kaydedilir, sağda "Gespeicherte Befunde" listesi.
**Son test:** 2026-09-28 — GEÇTİ (mekanik): Diabetes/Gerinnungshemmer/Hornhaut + 1 Clavus
işareti kaydedildi, liste güncellendi. Domain açığı (Wagner/Sensibilität/Puls yok) `podoloji`'ye soruldu.
**Son test (ek):** 2026-09-30 17:30Z — GEÇTİ: risiko bloğu artık Anamnese'den salt-okunur (giriş alanı 0), kayıtta `befund.risiken.anamnese_id` + `anamnese_version` yazılıyor (ayrıntı: Anamnese kaydı).
**Son test:** 2026-09-30 17:40–18:10Z (`50cfbe4`+`1f1ef45`+`f587876`; canlı `dashboard.js?v=20261002a` = yerel, `kiosk.js`/`anamnese.js?v=20261002a`, `podo-wagner.js`/`podo-therapiezeit-regel.js`/`praxis-standort.js?v=20261001z`; `git log origin/main..HEAD` test başında boş, test sırasında paralel oturumdan push edilmemiş `3758354` geldi — test hedefi canlı `f587876`; QA tenant test2, `-s=praxura-qa`) — GEÇTİ (Wagner). „Wagner-Grad (diabetisches Fußsyndrom)“ seçici: „nicht erhoben“ + Wagner 0–5 (her biri kısa açıklamalı). `a8e9df53` Ohne Termin + Wagner 2 → „Befund gespeichert ✓“, DB `d047330c` `wagner_grad=2`; `22181f45` (reçetesiz, DF değil) Wagner 1 → `f72b3993` `wagner_grad=1`. Akte başlığı (`#pdRozetHost`): `a8e9df53` „Wagner 2 · 30.09.2026“, `22181f45` rozet 0 ✓ (değer olsa da DF/E10/E11 yok).

### Anamnese je Fachbereich (Podo-Formular) + Kiosk „An Patient übergeben“ / „Nur Einwilligung“ — nav etiketi: `anamnese`

**Beklenen:** Podologie sektöründe `#anamDynForm` çizilir (fizyo markup'ı `#anamPhysioForm` gizli). Boş kayıt → 3 zorunlu hata (Diabetes · Gerinnungshemmung · Allergien), istek gitmez. Diabetes ≠ nein → B grubu (Neuropathie, pAVK, Ulkus, Amputation, Niere) zorunlu + Diabetes alt alanları görünür. Her kayıt = yeni satır (INSERT; önceki `ist_aktuell=false` trigger'la); Kopf „Version n · Praxis · geprüft am …“. „Anamnese unverändert bestätigen“ = kopya yeni sürüm (`uebernommen_von`). Kiosk: PIN yoksa önce PIN kurulumu, kiosk başlamaz; kiosk'ta `infektion` alanı YOK, „weiß nicht“ etiketleri, Kopf gizli, kayıt `quelle=kiosk` + ungeprüft; „Als geprüft markieren“ tek izinli UPDATE (`geprueft_am/_von`). „Nur Einwilligung“: aynı kiosk kabuğu, yalnız onam akışı (hasta seçili olmalı), Abbrechen → onay modalı → „Vielen Dank …“, çıkış PIN. Rozetler (en çok 3 + „+n“, rot önce) YALNIZ Akte başlığı (`#pdRozetHost`) ve Tagesbehandlung `h4`; Kalender/Mail/PDF/Abrechnung'da YOK (legal-de 30.09.2026). Fußbefund risiko bloğu salt-okunur, kayıtta `befund.risiken.anamnese_id/anamnese_version` yazılır. Kiosk'ta hasta seçici KİLİTLİ olmalı (bkz. P0 devri).
**Bağımlı ekranlar:** Patientenakte (Anamnese sekmesi + Kopf-Rozet) · Tagesbehandlung (`podologie-billing`: „Anamnese fehlt“ notu, 78040 sorusu, rozet) · Fußbefund (`fussstatus`) · Kiosk (`module/kiosk.js`) · Einwilligung (`module/patienten-einwilligung.js`) · fizyo tenant'ta aynı panel.
**Son test:** 2026-09-30 17:19–17:35Z (`e8dd77e` + şema `0047`; canlı `dashboard.js?v=20261001r` = yerel, modüller `anamnese*.js?v=20261001r`; `git log origin/main..HEAD` test başında boş, test sırasında paralel oturumdan push edilmemiş `50cfbe4`/`1f1ef45` geldi, test hedefi canlı `e8dd77e`; QA tenant test2, `-s=praxura-qa`; GERÇEK yazma: `22181f45` podo v1–v3 praxis, `1abd135e` podo v1–v2 kiosk (ikisi de sonunda geprüft), Fußbefund `9090321f`; kiosk PIN'i QA tenant için ilk kez ayarlandı) — **KALDI, bir P0 ile (eski, bu commit'ten değil)**. 1 GEÇTİ (3 hata, ağ isteği 0). 2 GEÇTİ (typ2 → 5 B alanı yıldızlı + 5 alt alan görünür, kayıt denemesi 7 hata). 3 GEÇTİ (POST 201, yenileme sonrası 11 işaret duruyor; ikinci kayıt v2; Akte „Frühere Versionen (1)“; ayrı PATCH yok, trigger çeviriyor; DB: v1/v2 `ist_aktuell=false`, v3 aktif). 4 GEÇTİ (bestätigen → v3 `uebernommen_von`=v2, toast doğru; kiosk satırında „Als geprüft markieren“ → PATCH 204, yenileme sonrası „geprüft am“). 5 GEÇTİ (infektion yok, 3× „weiß nicht“, Kopf gizli, POST 201, Kopf „vom Patienten (Kiosk) · ungeprüft“; yanlış PIN 401 „Verbleibende Versuche (4)“, doğru PIN → panel `mainArea`'ya döndü, infektion geri geldi). 6 GEÇTİ (onam overlay'i yalnız „Behandlungsvertrag und Ausfallregelung“ + imza + Abbrechen/Nochmal/Weiter, Anamnese paneli kiosk'a taşınmadı; Abbrechen → onay → „Vielen Dank …“, PIN ile çıkış, düğmeler geri; onam İMZALANMADI — `patient_consents` RESTRICT). 7 GEÇTİ (Akte: „Gerinnungshemmung · Allergie: Latex · Z. n. Ulkus · +1“, kiosk satırında „ungeprüft“ düğmesi; Tagesbehandlung `6bd45d0e`: rot+orange rozet + „ungeprüft“ düğmesi → PATCH 204. Okuma isteği test hastasına yönlendirildi: tüm podo reçeteleri `a8e9df53`'te, onun „Anamnese fehlt“ fikstürü bozulmasın diye ona anamnez yazılmadı. Kalender'de rozet 0 — o hafta görünümünde randevu yoktu; kodda `rozetHtml` yalnız `anamnese.js` + `podologie-abrechnung.js`'ten çağrılıyor). 8 GEÇTİ (risiko bloğu 0 giriş alanı, v3 değerleri; „Ohne Termin“ kaydı POST 201, gövde + DB `risiken.anamnese_id`=`739d43b0`, `anamnese_version`=3). 9 KISMEN (QA tenant podoloji, fizyo formu canlı çizilemedi; `#anamPhysioForm` içinde eski 27 id + 11 radyo eksiksiz, diff yalnız sarmalıyor). ⚠ **P0:** kiosk'ta `#anamPatientSelect` açık (devir aşağıda). P2: Akte Anamnese sekmesi her açılışta `profiles?select=first_name,…` → 400. Trigger'ın içerik-UPDATE/DELETE reddi tarayıcıdan sınanmadı (izin sistemi reddetti) — DB tarafında doğrulanmalı. Konsol: bilinen gürültü (6, 4) + P2 400 + kasıtlı yanlış PIN 401 + kendi hatalı çağrımdan bir `leads` 400.
**Son test:** 2026-09-30 17:40–18:10Z (`50cfbe4`+`1f1ef45`+`f587876`; canlı `dashboard.js?v=20261002a` = yerel, `kiosk.js`/`anamnese.js?v=20261002a`, `podo-wagner.js`/`podo-therapiezeit-regel.js`/`praxis-standort.js?v=20261001z`; `git log origin/main..HEAD` test başında boş, test sırasında paralel oturumdan push edilmemiş `3758354` geldi — test hedefi canlı `f587876`; QA tenant test2, `-s=praxura-qa`) — **P0 KAPANDI; yeni P1 + P2 (devir aşağıda).** Kiosk „An Patient übergeben“ (`1abd135e`): `#anamPatientSelect` `disabled` + `.form-group` `hidden`, `#anamRezeptBtn` `disabled` + görünmez; kiosk snapshot'ında seçici/„Rezept hinzufügen“/„Nur Einwilligung“/„An Patient übergeben“ yok. PIN 2468 → overlay kapandı, seçici + düğme geri, etkin; gerçek seçimle `22181f45`'e geçiş (11 işaret yüklendi), „Rezept hinzufügen“ → Muster-13 maskesi açıldı (kaydedilmedi). „Nur Einwilligung“: onam overlay'i + Abbrechen → „Ablauf abbrechen“ → „Vielen Dank …“ → PIN → seçici/düğmeler geri ✓, onam imzalanmadı. ⚠ Ama onam kiosk'u süresince seçici `disabled=false`, `hidden=false` (panel `mainArea`'da, overlay altında): fare ulaşamıyor (`elementFromPoint` overlay), **Tab ile odaklanıyor ve ok tuşu hastayı değiştiriyor** (`22181f45`→`a8e9df53`, overlay açıkken) → devir [P2]. „An Patient übergeben“de Tab 42/45 kiosk içinde kaldı, sonra header'a (`Praxura` bağlantısı, „Rezept scannen“) kaçtı → devir [P1] (yerelde `3758354` inert ile düzeltilmiş, push edilmemiş). Akte → Anamnese (`22181f45`): „Erstellt: 30.09.2026 · <ad>“ ✓, konsol 0 hata (profiles 400 yok) → P2 KAPANDI.
**Son test:** 2026-09-30 20:49–21:20Z (`3758354`+`853ea99`; canlı `dashboard.js?v=20261002c` = yerel, `kiosk.js?v=20261002c`, `podologie-abrechnung.js`/`praxis-standort.js`/`attendance.js?v=20261002a`; `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`) — KISMEN. **„Nur Einwilligung“ P2 GEÇTİ:** onam açıkken `#anamPatientSelect` disabled (hidden değil, arka plan `inert`), 45× Tab+↑ → seçici aynı hastada kaldı; onam „Abbrechen → Ablauf abbrechen“ → „Vielen Dank“, PIN 2468 → aynı hasta seçili, seçici etkin. **F5 GEÇTİ:** kiosk açıkken reload → overlay + „Vielen Dank“ + PIN modalı (1280×720 tam kaplama, `sessionStorage praxura.kiosk.aktiv=1`, seçici disabled); PIN „Abbrechen“ → overlay kaldı, „Beenden (PIN)“ → PIN yeniden açıldı; 2468 → normal dashboard (overview), işaret silindi; ikinci reload → kiosk yok. Toast görülmedi. **Tab kaçışı P1 KALDI:** 60 Tab'ın 5'i overlay dışında (`BODY`, „Praxura“ `A`, `#rezeptScanBtn`, `#themeToggle`, `#logoutBtn`) — normal kiosk, reload sonrası PIN modalı ve onam kiosk'unda aynı; `inert` yalnız `.dashboard-layout`'ta, header `#app > header.topbar` altında (`body > header` seçicisi eşleşmiyor). **Yeni P2:** kiosk'tan çıkınca `bookings-realtime` kanalı yeniden bağlanmıyor (`closed`, `subscribe()` → „tried to join multiple times“); ayrıca reload-sonrası kiosk'ta kanal `joined`. Devir paketleri aşağıda. Konsol 0 hata.
**Son test:** 2026-09-30 21:25–22:05Z (`e560eba`+`f63041f`; canlı `dashboard.js?v=20261002d` = yerel, `kiosk.js?v=20261002d`, `dashboard.css?v=20261002s5` = yerel (ilk bakışta canlı hâlâ `20261001r`'di, ~2 dk sonra indi); `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`) — GEÇTİ (regresyon `e560eba`). **Tab P1 KAPANDI:** kiosk „An Patient übergeben“ (`22181f45`), aynı kiosk'ta PIN modalı açıkken, „Nur Einwilligung“ ve F5-sonrası kilitte 60× Tab → odak her seferinde `#kioskOverlay` / `#kioskPinModal` / `#einwilligungOverlay` içinde; tek „dışarı“ adımı `BODY` (tarayıcının odak döngüsü, tıklanabilir öğe değil). `[inert]` = `HEADER.topbar` + `DIV.dashboard-layout`. „Praxura“, „Rezept scannen“, Theme, „Abmelden“ hiç odak almadı. **Realtime P2 KAPANDI:** PIN 2468 ile çıkış (normal ve F5 sonrası) → `__praxuraBookingsChannel.state='joined'`, konsolda „tried to join multiple times“ 0. Canlı güncelleme: `POST /api/booking/manual-create` ile test randevusu `00987332` (02.10.2026) → `[realtime] INSERT`; `PATCH` ile 07:00→09:00 → `[realtime] UPDATE`, Wochenansicht'te blok sayfa yenilenmeden 09:00'da belirdi; `PATCH status=cancelled` → blok kayboldu. ⚠ P3 kalıyor: kiosk açıkken F5 → kilit doğru, ama kanal `joined` (devir aşağıda). Konsol 0 hata.

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
**Son test:** 2026-09-30 (`7459ba1`, canlı `booking-request.js?v=20261001e` = yerel; `booking-request.html?business=<QA owner c4fbded4>`, `?u=` slug'ı bu sayfada geçersiz → „Ungültiger Link“ — tasarım) — **KALDI, P1.** Modüller tek sürüm: `supabase-config.js?v=20260701` bir kez, `booking-request.js`, `supabase-js.js`, `katalog-suche.js` birer kez; konsol 0 hata/0 uyarı. Ama **sihirbaz hiç render edilmiyor**: `<main>` boş, `#progressBar` `hidden`, `step-0…6` hepsi `display:none` — 5/5 taze yüklemede (28.09'da „ilk yükleme boş, reload sonrası çalıştı“ idi, bugün reload da kurtarmıyor). Kanıt: sayfada elle `document.dispatchEvent(new Event('DOMContentLoaded'))` → „Schritt 1 von 7“ ve progress bar anında göründü. Kök neden: `supabase-config.js` top-level await taşıyor (`fetch('/api/config')`), `booking-request.js` onu import ettiği için modül gövdesi `DOMContentLoaded`'dan SONRA koşuyor → `booking-request.js:1294` `addEventListener('DOMContentLoaded', init)` olayı kaçırıyor. `dashboard.js:18647` aynı durumu `readyState` kontrolüyle koruyor. `7459ba1`'in bunu tetiklediği kanıtlanamadı (kusur `86aae7b`/O-01 11.09'dan beri yapısal; 28.09'da aralıklıydı). Devir → aşağıda „builder'a devredilenler“.
**Son test:** 2026-09-30 (P1 regresyon `bd71bbf`; canlı `booking-request.js?v=20261001f` = yerel, `?business=<QA owner c4fbded4>`) — GEÇTİ, P1 kapandı. 5/5 taze yüklemede „Schritt 1 von 7“ + progress bar görünür; her JS tek URL (`booking-request.js?v=20261001f`, `supabase-config.js?v=20260701`, `supabase-js.js`, `katalog-suche.js`); konsol 0 hata/0 uyarı. Alan bağlanması: `gkvIcd10` ve `gkvDiagnosegruppe` `data-katalog-wired=1`; Heilmittel listesi açılışta Fachbereich'e göre dolu (15 seçenek, podoloji HPNR'leri). Sihirbaz adımları doldurulmadan `fields-gkv`/`gkvRestFields` DOM'da elle görünür yapıldı (yalnız gösterim): DG „DF“ yazınca dropdown „DF Diabetisches Fußsyndrom“ → seçilince Heilmittel listesi 15 → 8 (78010/78020/78030/78040/79933/79934 + Sonstiges); ICD „E11.7“ → dropdown E11.7-/E11.72/E11.73 … Talep GÖNDERİLMEDİ, adım 1–4 gerçek akışla gezilmedi.

**Son test:** 2026-09-30 (`43b9655` Online-Anfrage S4; canlı `booking.js`/`booking-request.js?v=20261001s` = HEAD, `module/anfrage-anliegen.js` canlı = HEAD (5 kart; yerelde commit'lenmemiş 3-kartlı v2 var, test EDİLMEDİ); QA owner `c4fbded4`, slug `test-podologie-qa` (`profiles_public` + `businesses` `290742a1`), 14:53–15:00Z) — GEÇTİ, P2/P3 gözlemlerle. **(1) booking.html:** `?u=test-podologie-qa` ve `?business=c4fbded4…` → praxis çözülüyor („TEST-Podologie QA"), ama „Keine Dienstleistungen verfügbar." — sebep veri: QA owner'ın `employee_services` satırı **0** (13 service var; tenant SQL ile kuruldu, onboarding `onboarding.js:716`/`server.js:3271` atamayı yapardı). Filtre düzeltmesi `employee_services` cevabı gerçek 13 service ile taklit edilerek doğrulandı: `?s=` yok → 13/13 ✓, `?s=erst` → 2 ✓. **(2) booking-request.html:** `?business=` ve `?u=` → „Schritt 1 von 7", progress bar, `gkvIcd10`/`gkvDiagnosegruppe` `data-katalog-wired=1`, Heilmittel 15, 0 hata; **yeni uyarı** „Multiple GoTrueClient instances detected" (1 warning, önceki turda 0) — P3. **(3) Anliegen:** 5 kart; kartsız Weiter → „Bitte Ihr Anliegen auswählen." (Zahlungsart seçili olsa da) ✓; Mit Verordnung → gkv/pkv/bg · Erstbehandlung → pkv/selbstzahler · Nagelspange ve Fußpflege → yalnız selbstzahler, otomatik seçili, Zahlungsart bloğu gizli · Hausbesuch → dördü + adres alanı ✓; Hausbesuch adresi boş/yalnız boşluk → „Bitte die Adresse für den Hausbesuch angeben." ✓; özet „Anliegen: Hausbesuch" satırı ✓ (adres özette YOK — P3). Gerçek talep: **`cca4dc92`** (TEST Anfrage, Hausbesuch, Selbstzahler, 07.10.2026 10:00, e-posta yok; yeni `patients` satırı **`fbe6fd10`**) → `POST /booking-request/create` 200 `pending`; `notizen` = „Anliegen: Hausbesuch — Adresse: TEST-Weg 1, 00000 Teststadt\nTEST Hinweis canli-test" ✓. Owner `anfragen` → liste kartında Anliegen/Hausbesuch izi yok (yalnız „SZ"), detay „Notizen" satırında görünüyor ama satır sonu yutulmuş (Anliegen ve serbest not tek satır — P3) → Ablehnen → „Absage senden" → `POST /decline` 200, reload sonrası DB `status=declined` ✓. Praxis bildirimi QA owner adresine gitti (sunucu `server.js` create → owner mail). **(4) Bozuk link:** booking-request `?u=a,b` / `%` / `_` / `a)` → „Ungültiger Link", 0 hata ✓. Ama `?business=a,b` / `?business=%` → sihirbaz AÇILIYOR (Schritt 1), konsolda `rpc/public_praxis_sector` 400 ×2 — `business` UUID olarak doğrulanmıyor (önceden de böyleydi) → P2. booking.html `?u=a,b` ve `?business=a,b` → UI „Unternehmen nicht gefunden." ama konsolda `PGRST100 failed to parse logic tree` — `booking.js` kendi çözümlemesini kullanıyor, `public-owner.js`'in regex korumasını değil → P3.
**Son test:** 2026-09-30 (Online-Anfrage v2 `62a9692` + `678f964`; canlı `booking-request.js?v=20261001t` = origin/main, `public-owner.js?v=20261001u` (deploy push'tan ~70 sn sonra indi, önce `…s` servis ediliyordu); ⚠ yerelde push edilmemiş `91f27ab` var (Heilmittel serbest, `public-supabase.js`) — bu tur onu KAPSAMAZ; QA owner `c4fbded4`, `?u=test-podologie-qa`, 15:08–15:17Z) — GEÇTİ, P2/P3 gözlemlerle. **Adım 2 (Anliegen):** 3 kart (Behandlung mit Rezept · Nagelspange · Ohne Rezept – Fußpflege / Beratung), her kartın altında „Ich brauche einen Hausbesuch“ anahtarı; Wunden-Hinweis kartların üstünde görünür ✓. Kartsız Weiter → „Bitte Ihr Anliegen auswählen.“ ✓. Zahlungsart: Rezept → gkv/pkv/bg · Nagelspange → gkv/pkv/selbstzahler · Ohne Rezept → pkv/selbstzahler (gkv YOK) ✓. **Hausbesuch:** kapalıyken adres alanı gizli, Weiter adres istemez; açıkken adres görünür, boş Weiter → „Bitte die Adresse für den Hausbesuch angeben.“ ✓. Soru „Ist auf dem Rezept „Hausbesuch: Ja“ angekreuzt? (freiwillig) Ja/Nein/Weiß nicht“: Rezept+HB → var; Nagelspange/Ohne Rezept + pkv/gkv + HB → var; selbstzahler + HB → yok ✓. Kart değişince anahtar sıfırlanıyor ve yazılmış adres siliniyor ✓; başka kartın anahtarına doğrudan tıklamak o kartı seçip HB'yi açıyor ✓. Özet: „Anliegen: Nagelspange (Hausbesuch)“ ✓ — adres ve Rezept-cevabı özette yok (P3, 43b9655 turunda da not edildi). **Gönderim:** Nagelspange + GKV + HB + „Ja“ + 78610 + 08.10.2026 10:00 → `POST /booking-request/create` 200 `pending`, id **`16e25722`**; yeni `patients` satırı **`6f7a0624`**. Owner Termin-Anfragen detayı „Notizen“: „Anliegen: Nagelspange — Hausbesuch — Adresse: TEST-Weg 2, 00000 Teststadt — Hausbesuch auf Rezept: ja“ + serbest not (satır sonu yine tek satırda, P3 bilinen) ✓ → Ablehnen → Absage senden → `POST /decline` 200; reload sonrası DB `status=declined` ✓. **Yeni bulgu P2 (eski, Haziran'dan):** GKV adımında seçilen Krankenkasse hem hastanın özetinde hem owner detayında **UUID** olarak görünüyor (`c84a7cb3-…` yerine „AOK Bayern“) — devir aşağıda. Gözlemler (P3/soru): GKV adımında podoloji hastasından yine HPNR listesi (78010…79934) zorunlu isteniyor (`91f27ab` bunu değiştiriyor, push edilmedi); Leistung adımı Anliegen'e göre süzülmüyor (Nagelspange seçildi, 13 Leistung'un hepsi, „Therapiebericht UI 2“ dahil — `podoloji`'ye soru); terapeut seçeneği „Kein Präferenz“ (dilbilgisi, „Keine Präferenz“); Nagelspange'de Rezept-sorusu Zahlungsart kartlarının ÜSTÜNDE açılıyor, gkv'ye tıklayınca içerik aşağı kayıyor. **`?business=` (678f964):** `a,b` / `%` / `%25` → „Ungültiger Link“, ağda `public_praxis_sector` isteği YOK, konsol 0 hata ✓; geçerli UUID `c4fbded4…` → „Schritt 1 von 7“ ✓. P3 gözlem: biçimce geçerli ama var olmayan UUID (`00000000-…`) de sihirbazı açıyor (varlık kontrolü yok), ve geçerli UUID'de `rpc/public_praxis_sector` iki kez çağrılıyor. Konsol: her yüklemede 1 uyarı „Multiple GoTrueClient instances detected“ (P3, hâlâ var; `91f27ab`'deki ortak anon client bunu hedefliyor olabilir).
**Son test:** 2026-09-30 (`91f27ab` + `e238a67`; canlı `booking-request.js?v=20261001w` = yerel (push'tan ~1 dk sonra indi, önce `…t`), `anfrage-anliegen.js?v=20261001v`, `public-supabase.js?v=20261001v`, `git log origin/main..HEAD` boş; QA owner `c4fbded4`, `?u=test-podologie-qa`, 15:20–15:27Z) — **GEÇTİ**, KK P2 KAPANDI. **Rezept + GKV:** adım 5'te `gkvHeilmittelWrap` (katalog select) gizli, yerine „Was steht auf Ihrem Rezept unter „Heilmittel“? (freiwillig)“ + 4 düğme (Hornhautabtragung · Nagelbearbeitung · Podologische Komplexbehandlung (Hornhaut + Nägel) · Weiß ich nicht / nicht lesbar / Rezept liegt noch nicht vor) ✓; aynı düğmeye ikinci tık seçimi kaldırıyor ✓; seçimsiz Weiter → adım 6'ya geçti, hata yok, özette Heilmittel satırı YOK ✓; DOM (`outerHTML`) ve görünen metinde „786“/„7803“/„7993“ yok ✓. Krankenkasse select'i artık ad taşıyor (`value="AOK Bayern"`), özet „Krankenkasse AOK Bayern“ ✓. **Nagelspange:** GKV ve PKV → soru yok (`gkvHeilmittelWahlWrap` gizli), özette „Heilmittel Nagelspangenbehandlung“ ✓ (gönderilmedi). **Gönderim:** Rezept + GKV + AOK Bayern + Hornhautabtragung + 07.10.2026 10:00 → başarı ekranı; talep **`dd0a00fd`**, yeni `patients` **`effe559d`**; DB `krankenkasse='AOK Bayern'`, `behandlungsart='Hornhautabtragung'`, `verordnung_typ='erst'`. Owner Anfrage-Details: „Krankenkasse AOK Bayern“, „Behandlungsart Hornhautabtragung“, „Verordnungsart Erstverordnung“ ✓ → Ablehnen → Absage senden → DB `status=declined` ✓. Terapeut „Keine Präferenz“ (liste + özet) ✓. Konsol `booking-request.html`: taze yüklemede 0 mesaj — „Multiple GoTrueClient instances“ uyarısı GİTTİ ✓. Kod okuması (madde 7): `state.anliegenAktiv` yalnız `initAnliegen` içinde, `anliegenFuerBereich(bereich)` podoloji değilse boş dönünce hiç set edilmiyor (`booking-request.js:441-473`); `validateStep4` `!state.anliegenAktiv` dalında `gkvHeilmittel` boşsa „Bitte Heilmittel auswählen.“ ile blokluyor (`:1015-1018`), `zeigeHeilmittelFrage` aynı koşulda select'i gösteriyor (`:958`) → diğer alanlarda katalog zorunluluğu korunuyor ✓ (fizyo praxis'i canlıda yok, gezilmedi). Gözlem (P3, önceki turdan): Rezept + GKV'de Leistung adımı Nagelspange kalemleri dahil 13 Leistung'u gösteriyor (`podoloji` sorusu açık). Yan bulgu P2 (owner): liste kartındaki „Annehmen/Ablehnen“ düğmeleri detay penceresini açıyor — devir aşağıda.
**Son test:** 2026-09-30 (`3adda3a`; canlı `dashboard.js?v=20261001p` — `?v=` bump'sız, içerik `event.stopPropagation();declineAnfrage` + `escapeHtml(String(item.distance_km))` taşıyor, `git log origin/main..HEAD` boş; QA owner `c4fbded4`, `?u=test-podologie-qa`, `-s=praxura-qa`, 15:30–15:36Z) — **GEÇTİ**, owner-kart P2 KAPANDI. Hasta tarafı: Ohne Rezept – Fußpflege / Beratung + Selbstzahler + Podologische Befundung + 07.10.2026 11:00 + „TEST Anfrage“ (e-posta yok) → „Ihre Anfrage wurde erfolgreich gesendet!“; talep **`44ab1a7d`**, yeni `patients` **`2d610943`**. Owner `anfragen` „Offen“: kart „Ablehnen“ → doğrudan Ablehnen penceresi (Grund + Absage senden), detay YOK ✓; Abbrechen → kart gövdesi → Anfrage-Details ✓; tekrar „Ablehnen“ → Grund „TEST canli-test“ → Absage senden → reload sonrası „Offen“ boş, „Abgelehnt“ta, REST `status=declined` ✓. „Annehmen“ tıklanmadı (booking oluşturur) — aynı düzeltme kodda `dashboard.js:19599` ve canlı dosyada. Konsol: yalnız §3 gürültüsü (1, 2, 4) + meta deprecation uyarısı; `loadActivityFeed` TypeError yok.
**Son test:** 2026-09-30 (`0a0fa74` booking.js → `module/public-owner.js` `ladeKennung` + tek anon client; canlı `booking.js?v=20261001z` = yerel (push'tan ~1 dk sonra indi, önce `…s`), `git ls-remote` main = HEAD; QA owner `c4fbded4`, `-s=praxura-qa`, 16:34–16:45Z, randevu OLUŞTURULMADI) — **GEÇTİ**, 43b9655 turundaki booking.html PGRST100 P3'ü KAPANDI. **Geçerli linkler:** `?u=test-podologie-qa`, `?u=c4fbded4…`, `?business=c4fbded4…` → başlık „TEST-Podologie QA“ / „TEST-Inhaber QA“, adım 1 „Dienstleistung wählen — Keine Dienstleistungen verfügbar.“ (bilinen veri durumu: QA `employee_services` 0), tüm Supabase istekleri 200, konsol 0 mesaj — „Multiple GoTrueClient“ YOK ✓. Slug yolu `profiles_public …or=(booking_slug.eq…,ilike…)`, UUID yolu `profiles_public id=eq`, `?business=` çözümleme isteği atmadan doğrudan owner ✓. Tam URL `?u=https://app.praxura.de/booking.html?u=test-podologie-qa` da çözülüyor ✓. **Bozuk linkler:** `?u=a,b.eq.c)`, `?u=%`, `?u=%25`, `?business=keine-uuid`, parametresiz, `?u=` → „Unternehmen nicht gefunden.“, ağda Supabase isteği HİÇ yok, konsol 0 (PGRST100 yok) ✓; `?u=test_podologie_qa` / `a.b.c` / `gibt-es-nicht-xyz` → iki sorgu 200 (profiles_public + businesses), yine „Unternehmen nicht gefunden.“ ✓. Gözlem P3: parametresiz/boş linkte de „Unternehmen nicht gefunden.“ (ayrı „Ungültiger Buchungslink.“ metni görülmedi) ve hata durumunda „Person auswählen“ başlığı ekranda kalıyor; `?u=TEST-PODOLOGIE-QA` bulunmuyor (`eq` büyük/küçük harf duyarlı — eski `booking.js:85` de aynıydı, regresyon değil). **Sınanamadı:** çalışan linki (QA owner altında `profiles_public` employee 0) ve Standort-slug başlığı (tek `businesses` `290742a1`'in slug'ı owner slug'ıyla aynı → profil önce eşleşiyor, `businessName` dalı hiç koşmuyor). **booking-request regresyon:** `?u=test-podologie-qa` ve `?business=c4fbded4…` → „Schritt 1 von 7“, konsol 0; `?u=a,b.eq.c)` → „Ungültiger Link“ ✓ (gönderilmedi).

### Login — sayfa: `login.html`

**Beklenen:** Yalnız Almanca (28.09 kararı, `510adff`): dil düğmesi yok, `infinity_lang` okunmaz; doğru giriş → `dashboard.html`, dashboard Almanca.
**Son test:** 2026-09-30 (`510adff`; canlı `login.js?v=20261001t`; 15:15–15:17Z) — KISMEN. Taze oturumsuz profil: `lang=de`, DE/EN/TR düğmesi yok, `data-i18n` 0; `localStorage.infinity_lang='en'` elle yazılıp yeniden yüklense de metin Almanca ✓. Var olmayan hesapla yanlış giriş → „E-Mail oder Passwort ist falsch.“ ✓ (konsolda beklenen tek auth 400). **P3:** „Noch kein Konto? **Get Started**“ — İngilizce kalıntı (`login.js:19` `reg_btn`). QA hesabıyla gerçek giriş SINANAMADI (şifre bende yok, kalıcı `praxura-qa` oturumu zaten girişli; oturumu kapatmak onu kaybettirirdi). Girişli oturumda `login.html` → `dashboard.html` yönlendirmesi ✓; dashboard `lang=de`, sidebar ve Überblick Almanca, `infinity_lang` yok ✓. GoTrue uyarısı login ve dashboard'da YOK (yalnız `booking-request.html`'de).
**Son test:** 2026-09-30 (`e238a67`; canlı `login.js?v=20261001w`; oturumsuz ayrı profil, 15:26Z) — GEÇTİ. „Noch kein Konto? **Jetzt starten**“ (`#regBtn` → `/vorregistrierung.html`); P3 „Get Started“ kapandı. Not: statik HTML hâlâ „Vorregistrieren“ yazıyor, JS ezer — JS'siz görünüm farklı (bulgu sayılmadı).

### Sidebar / Menü (Podologie) — nav etiketi: tüm modüller (`nav-registry.js` podologie)

**Beklenen (Konsey 2026-09-30, `konsey/tutanak/2026-09-30-podologie-s0-behandlungstag-menue.md`):** grup başlıkları sırasıyla „Heute“, „Termine“, „Patienten“, „Abrechnung“, „Praxis“, „Einstellungen“; Fahrtenbuch „Praxis“ altında; Demo-Modus görünmez; açılış ekranı Dashboard (`overview`).
**Son test:** 2026-09-30 (S4-1 `8716a3d`; canlı `dashboard.js?v=20261001i` = yerel, `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`, 12:28–12:42Z; yazma yolu: `podologie_behandlungen`/`bookings`/`prescriptions` POST/PATCH tarayıcıda fetch-guard ile bloklandı, 0 istek yakalandı, DB `updated_at`/`created_at` test öncesinde kaldı) — KISMEN. Gruplar birebir ve sırayla ✓; Heute: Dashboard, Überblick · Termine: Terminkalender, Termin-Anfragen, Warteliste · Patienten: Patienten, Anamnese, Notizen, Verordnungen, Fußbefund, Patientenpost · Abrechnung: Leistungen, Behandlungen, §302-Abrechnung, Rechnungen, Zahlungsjournal, Mahnwesen, Auswertungen · Praxis: Fahrtenbuch, Verfügbarkeit, Team, Zuweiser · Einstellungen: Demo-Modus, Feedback & Support, Vorlagen, Einstellungen. Fahrtenbuch Praxis altında ve açılıyor ✓. Açılış `overview` ✓. 26 girişin hepsi tıkla → kendi paneli `active` ✓. **Demo-Modus görünüyor → KALDI P2** (`module_visibility` podologie satırları registry’yi eziyor, builder devri). Patientenpost açılıyor ama tablo `ReferenceError` ile boş (eski hata, P2 devri). Konsol: bilinen gürültü (1, 2, 4, `loadActivityFeed`) + Demo-Modus iframe’inin üçüncü-parti hataları (zygotebody, raporlanmadı) + `leadStatusBadge`.

---

### Team → Anwesenheit (Owner) — Praxisstandort für GPS-Check-in — nav etiketi: `team`

**Kullanıcı ne yapar:** Owner Team panelini açar; Anwesenheit bölümünün üstünde „Praxisstandort …“ kutusu. Praxis'teyken „Aktuellen Standort als Praxisstandort übernehmen“ → tarayıcı konumu `businesses.clinic_lat/lng`'e yazılır; çalışan check-in'leri (`attendance.html`) 150 m yarıçapında kontrol edilir.
**Beklenen:** kutu metni „Praxisstandort nicht eingerichtet — Check-ins werden ohne GPS-Prüfung gezählt.“ veya „Praxisstandort gesetzt (lat, lng) — …150 m…“; konum izni yoksa Almanca uyarı toast'u; izin varsa „Praxisstandort gespeichert.“ + metin „gesetzt (…)“. Harici çağrı (Nominatim) YOK.
**Bağımlı:** `module/praxis-standort.js` · `attendance.html`/`attendance.js` (çalışan check-in, aynı `navigator.geolocation`) · `vercel.json` + `onprem/Caddyfile` Permissions-Policy.
**Son test:** 2026-09-30 (`16c9138`+`a992cf2`+`e2f9d7f`; deploy ilk yoklamada inmemişti (canlı 15:30Z yapısı), 16:22Z'de indi; canlı `dashboard.js` `mountPraxisStandort` 2×, `nominatim.openstreetmap` 0, `from('visibility_reports')` 0; `module/praxis-standort.js?v=20261001y` 200. ⚠ `dashboard.html` hâlâ `dashboard.js?v=20261001p` — sürüm bump edilmedi, `max-age=0, must-revalidate` sayesinde pratikte sorun çıkmadı. QA test2, `-s=praxura-qa`, 16:22–16:30Z) — **KALDI (P1).** Kutu Owner görünümünde üstte, metin „nicht eingerichtet“, düğme görünür ✓. İzinsiz tıklama → toast `warning` „Standortfreigabe verweigert oder nicht verfügbar — bitte im Browser erlauben und in der Praxis erneut versuchen.“ ✓ (toast 3,5 sn yaşıyor). **İzin verilip sahte konum (50.8, 7.2) ayarlandığında da aynı toast** — `navigator.permissions` = granted ama `document.featurePolicy.allowsFeature('geolocation')` = false; konsol: `Permissions policy violation: Geolocation access has been blocked because of a permissions policy` (`praxis-standort.js:56`). Sebep: yanıt başlığı `Permissions-Policy: camera=(self), microphone=(), geolocation=()`. **DB'ye hiçbir şey yazılmadı**, QA işletmesinin konumu boş kaldı. Anwesenheit raporu yükleniyor („Keine Einträge im gewählten Zeitraum.“), hata yok. Devir: aşağıda [P1].
**Son test:** 2026-09-30 17:40–18:10Z (`50cfbe4`+`1f1ef45`+`f587876`; canlı `dashboard.js?v=20261002a` = yerel, `kiosk.js`/`anamnese.js?v=20261002a`, `podo-wagner.js`/`podo-therapiezeit-regel.js`/`praxis-standort.js?v=20261001z`; `git log origin/main..HEAD` test başında boş, test sırasında paralel oturumdan push edilmemiş `3758354` geldi — test hedefi canlı `f587876`; QA tenant test2, `-s=praxura-qa`) — GEÇTİ (P2 metin kusuru + P1 Permissions-Policy devri açık). Kutu: Praxisstandort metni + „GPS-Prüfung beim Einchecken (Standard: aus)“ onay kutusu, başlangıçta kapalı (DB `false`). Açınca toast „GPS-Prüfung beim Einchecken ist aktiv.“, DB `profiles.gps_checkin_pruefen=true`, yenileme sonrası işaretli. `attendance.html` (owner): açıkken bilgi metni görünür; „Einchecken“ → 1× `getCurrentPosition`, konsol `Permissions policy violation` (beklenen), metin „Standort nicht verfügbar – Check-in erfolgt ohne Standortprüfung.“, `POST /api/attendance/check-in` **200** gövdede yalnız `business_id`; DB `attendance 900f810c` `check_in_valid=NULL`. Rapor (Laden) GPS sütunu „nicht geprüft“ ✓. Kapatınca DB `false`; `attendance.html` bilgi metni `display:none`. Kapalıyken check-in'de konum istenmemesi canlıda tıklanamadı (günde tek check-in; owner 20:07'de check-out edildi) — kodda `standortFuerCheckin(false)` `holeStandort`'u çağırmıyor. **Ayar test sonunda KAPALI.** ⚠ P2: metin ayar kapalıyken de „Check-ins werden im Umkreis von 150 m geprüft.“ diyor (devir aşağıda).
**Son test:** 2026-09-30 20:49–21:20Z (`3758354`+`853ea99`; canlı `dashboard.js?v=20261002c` = yerel, `kiosk.js?v=20261002c`, `podologie-abrechnung.js`/`praxis-standort.js`/`attendance.js?v=20261002a`; `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`) — GEÇTİ (P2 regresyonu). Şalter kapalı: „Praxisstandort gesetzt (…) — GPS-Prüfung ist aus, Check-ins werden ohne Standort gezählt.“; tık → anında „— Check-ins werden im Umkreis von 150 m geprüft.“, reload → açık kaldı; tekrar tık → anında „GPS-Prüfung ist aus …“, reload → kapalı. **Test sonu ayar KAPALI** (`gps_checkin_pruefen=false`; iki yazma: aç + kapat). Konsol 0 hata.

### kalender.html (eski Owner-Kalender, dashboard'dan bağlantısız) — sayfa: `kalender.html`

**Beklenen (`e2f9d7f` sonrası):** yalnız Almanca, DE/EN/TR düğmesi yok, `kalender_lang`/`infinity_lang` yok; FullCalendar düğmeleri „Heute/Monat/Woche/Tag“.
**Son test:** 2026-09-30 (`e2f9d7f`, QA test2) — dil kısmı GEÇTİ: `lang=de`, dil düğmesi 0, iki localStorage anahtarı null, FC düğmeleri „Heute · Monat · Woche · Team-Tag · Tag“. Konsol temiz DEĞİL, 3 hata, üçü de bu committen önce vardı → anomali kutusu: (a) `bookings` embed `profiles!bookings_user_id_fkey` → 400 PGRST200 (ilişki yok, `kalender.js:336`, hata yutuluyor → takvimde 0 randevu) (b) `GET /api/team?owner_id=` → 401 (`kalender.js:223` Authorization başlığı göndermiyor → ekip boş) (c) CSP `font-src 'self'` FullCalendar'ın `data:` ikon fontunu engelliyor. Sayfa `dashboard.html`/`nav-registry.js`'ten bağlantılı değil.
**`setup.html`:** canlıda 404 — **beklenen**, `.vercelignore:74` (yalnız on-prem kutusunda). Canlıda sınanamaz; `setup.js:68` statik olarak dil düğmesiz.

### Mobil/Tablet düzeni (S5) — Fußbefund · Tagesbehandlung · Patientenakte · Termin-Aktionen · Einstellungen→Konten · Muster-13 · Kalender kartı — nav etiketleri: `fussstatus`, `podologie-billing`, `kunden`, `calendar`, `settings`, `verordnungen`

**Beklenen:** 375/390 (telefon) ve 768 (tablet) px'te sayfa yatay kaymaz (`documentElement.scrollWidth` = viewport). Fußbefund „Rechts“ sütunu ekran içinde (container query `fbp`). Tagesbehandlung ≤768 px tek sütun, „Behandlung speichern“ erişilebilir, gömülü Fußbefund (`#podFussbefundHost`) kendi kabına sığar. ≤1024 px'te Akte başlık düğmeleri, `.pd-tab`, `.modal-close`, Termin-Aktionen şeridi (`.bk-akt-leiste`), `#bkDetailEditBtn`, `#bkActPatSearch`, Löschen, Konten „ד ≥ 44 px. `.pd-tabs` kendi içinde kayar, modal kaymaz. Konten „ד ekran içinde ve tıklanabilir. Muster-13 375'te taşmaz. Tagesansicht kartında soyad görünür („Nachname, Vorname“). Masaüstü 1280'de düzen değişmez; koyu temada `#pdInfoBlock` beyaz değil.
**Bağımlı ekranlar:** `dashboard.css` bütün paneller · `dashboard.html` Muster-13 inline CSS · admin/attendance.html (aynı `?v=`)
**Son test:** 2026-09-30 21:25–22:05Z (`e560eba`+`f63041f`; canlı `dashboard.js?v=20261002d` = yerel, `kiosk.js?v=20261002d`, `dashboard.css?v=20261002s5` = yerel (ilk bakışta canlı hâlâ `20261001r`'di, ~2 dk sonra indi); `git log origin/main..HEAD` boş; QA tenant test2, `-s=praxura-qa`) — GEÇTİ (`f63041f`, yalnız ölçüm, yazma yok). 3 [P0] Fußbefund (`a8e9df53` seçili): 375 → „Rechts“ x 270–335, 101 kontrolün 0'ı ekran dışı, doc 375/375; 390 → 285–350; 768 → 649–714. 4 Tagesbehandlung (`6bd45d0e`) 390: grid `358px` (tek sütun), „Behandlung speichern“ 176×44, kaydırınca görünür ve `elementFromPoint` isabet; gömülü Fußbefund açık: 100 kontrol, host 318/318, hosttan/ekrandan taşan 0, „Rechts“ 255–318; 768: `736px`, host 696/696. 5 Akte 390/768: „+ Termin“ 60×44, „+ Verordnung“ 88×44, ✕ 44×44, `.pd-tab` min 44; `.pd-tabs` 390'da 651/388 `overflow-x:auto`, modal 388/388 (kaymıyor). Termin-Aktionen 390/768: şerit 6 düğme hepsi 44, Bearbeiten 84×44, Patientensuche 349×44, ✕ 44, „Weitere“ → Löschen 331×44 (tıklanmadı); modal 389/389. 6 Konten 390/375: 8 satır, „ד 44×44 x 309–353 / ≤338, `elementFromPoint` = düğme (tıklanmadı). 7 Muster-13 (yeni maske, kaydedilmedi) 375: sheet 21–354, 331/331, 35 kontrol hepsi sheet içinde, `.m13-lsboxes` wrap; 768 684/684. 8 Kalender Tagesansicht 375/390: kart 292×106, ad span 140/140 (kırpma yok), soyad metinde. 9 1280: Fußbefund `592px 360px`, „Rechts“ 773–838; Tagesbehandlung `476px 476px`, gömülü host 436/436, taşma 0; Muster-13 836/836; koyu tema Akte `#pdInfoBlock` inline `background` yok, etkin zemin `rgb(32,28,21)`, metin `rgb(242,236,221)`. Tema test sonunda açık temaya geri alındı (`localStorage im-theme=light` yazıldı). ⚠ Yeni P2 (kapsam dışı): Termin-Aktionen içindeki Rezeptinfo kartında 16–17 px düğmeler (anomali kutusu). Konsol 0 hata (bilinen gürültü 4, 6).

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
- ✅ `visibility_reports` 403 ve Nominatim CSP kısımları KAPANDI 2026-09-30 (`a992cf2`, `16c9138`; taze yükleme + 5 panel geçişi: iki istek hiç atılmıyor, konsol yalnız `apple-mobile-web-app-capable` meta uyarısı + `#calendarEl`). Bu girişin üç parçası da kapandı.
- ✅ `loadActivityFeed` kısmı KAPANDI 2026-09-30 (`3adda3a`, `escapeHtml(String(item.distance_km))`; taze yükleme + Überblick: TypeError yok, akış 7 öğe, „Fahrt gebucht“ satırı çiziliyor). Kalan ikisi §3 gürültüsü.
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
- 2026-09-30 · canli-test · QA tenant test verisi (P1-Regression `9d4b057` + Reform 3.12 turu): iki yeni Verordnung — **`f0a303e6`** (hasta `a8e9df53`, E11.74+DF, 78010, 4 Einheiten, Leitsymptomatik a, 1x pro Woche, test LANR) ve **`6bd45d0e`** (aynı hasta, E11.74+DF, 78010, 2 Einheiten, LS a). İkisinde de PHI gölge kolonları NULL. `06dbeb5c` Bereit → In Behandlung → Bereit (428 onayıyla, yeni `prescription_validations` kaydı; son hâl başlangıçla aynı). Fahrt **`2ec11d8f` kapatıldı** (30024), randevu `e48f89a4` Fahrt tamamlandı, yeni Behandlung **`3e256b9a`** (`50139501`, 30.09, yalnız 78030 + 79933 — Behandlungsposition YOK, alışılmadık kayıt; temizlik listesine). Silinmedi.
- ~~2026-09-30 · canli-test · `verordnungen` maskesi / Muster-13 · Leitsymptomatik a) işaretli iken Heilmittel alanına maskenin **kendi** öneri listesinden „78010 – Podologische Behandlung (klein)" seçilince kontrol ⚠ „Aus der Leitsymptomatik a) folgt „Hornhautabtragung" — im Heilmittelfeld steht „78010 – …"" diyor (`module/verordnung-pruefung.js:311` düz metin eşitliği). Maske ile kontrol birbirine ters. Soru → `podoloji`: podoloji maskesinde Heilmittel alanı HPNR önerisi mi sunmalı, yoksa LS'den türeyen metin mi tek doğru değer? Cevaba göre builder'a (P2/P3). Aynı turda: Tagesbehandlung, Behandlungsposition (78010/78020) olmadan yalnız 78030 + 79933 kaydına izin verdi (`3e256b9a`) — kabul edilebilir mi, `podoloji`'ye. → **Durum 30.09 (`047baab` turu):** Prüf motoru (`verordnung-pruefung.js`) düzeldi ✓; maske ipucu `verordnung-podo.js:320-323` hâlâ aynı cümleyi veriyor → builder devri (P2). `3e256b9a` sorusu karar dosyasında cevaplandı (Rückfrage, sperre değil) — o kısım kapandı.~~ → **KAPANDI** (`765c9ed`, canlı regresyon 30.09).
- ~~2026-09-30 · canli-test · `verordnungen` → Status · 0 Behandlung'lu reçetede „Abrechnungsstatus ändern" varsayılan „Bereit zur Abrechnung" ve yardım metni „Behandlungen sind dokumentiert …" (`module/abrechnungsstatus.js:88`); sunucu doğru 422 veriyor, doğru metin „Noch keine Behandlung dokumentiert …" ancak Übernehmen'den sonra. P3, builder'a istenirse.~~ → **KAPANDI** (`047baab`, canlı 30.09 `f0a303e6`: „Bitte wählen …“, Bereit disabled, Übernehmen disabled).
- 2026-09-30 · canli-test · `verordnungen` maskesi · LANR boş + hekim adı dolu (aynı adlı hekim kaydı LANR'lı) iken Speichern → onay diyaloğundan ÖNCE `POST /api/arzt/resolve` 500 „Arzt konnte nicht angelegt werden“ (`dashboard.js` saveRezept → `resolveArzt`; backend `api-backend/lib/arzt-registry.js:141-170` insert yolu; neden için `docker logs calendar-api` gerekli). Diyalog iptal edildi — „Trotzdem speichern“ halinde `arzt_id`'nin null yazılıp yazılmadığı SINANMADI. P2 adayı, bu sprintin kapsamı dışı.
- ~~2026-09-30 · canli-test · `podologie-billing` Tagesbehandlung · aynı Verordnung (`50139501`) için aynı gün ikinci Befund-günü (78030+79933, `f287afd9`; ilki `3e256b9a`) uyarısız kaydedildi. Beklenen davranış bilinmiyor: soru → `gkv-302` (aynı gün mükerrer pozisyon §302 dosyasında elenir mi, sperre mi gerekir) + `podoloji`. §302'ye dokunduğu için doğrulanırsa en az P1.~~ — KAPANDI 2026-09-30 (S4-1 `8716a3d`: aynı gün ikinci kayıtta „Zweiter Behandlungstag … (HeilM-RL § 12 Abs. 8) — trotzdem speichern?“ Zurück/Trotzdem speichern soruyor; canlıda Zurück → yazma yok).
- 2026-09-30 · canli-test · QA tenant test verisi (`047baab` turu): yeni Behandlung **`f287afd9`** (`50139501`, 78030 · 79933, pozisyonsuz — „Ohne Behandlung speichern“ testi); `6bd45d0e` Unterschrift kaldırıldı ve geri kondu (son hâl `true`, `arzt_id` aynı). Temizlik listesine.
- ~~2026-09-30 · canli-test · `verordnungen` maskesi (podo) · `765c9ed` sonrası kalan P3: `rzPodoHinweis` Heilmittel alanı değişince yeniden hesaplanmıyor — `rzHm` `module/verordnung-podo.js` `AUSLOESER` listesinde yok (yalnız LS/DG/ICD/Anzahl/… tetikliyor; öneri listesinden seçimde yalnız `pruefeHpnrWahl` kendi 78020 satırını yazıyor). Sonuç: yüklenirken çıkan „passt zu … auf der Verordnung steht „HornhautabtragungHorn““ satırı 78010 seçildikten sonra LS/DG'ye dokunulana kadar ekranda kalıyor. Ayrıca ipucu satırı `farbe` almıyor (gri); amber olan yalnız alan işareti — brif „amber“ diyordu, alan işaretiyle karşılanıyor sayıldı. builder'a istenirse.~~ — KAPANDI 2026-09-30 (S4-1 `8716a3d`: `rzHm` `change` → ipucu anında yeniden hesaplanıyor, canlıda `06dbeb5c` ile doğrulandı).
- ~~2026-09-30 · canli-test · Termin-Aktionen · „Weitere Aktionen …“ menüsü açıkken Escape menüyle birlikte **bütün sağ paneli** kapatıyor (menü `keydown` + genel modal Escape’i aynı anda) — P3, beklenen muhtemelen yalnız menü.~~ — KAPANDI 2026-09-30 (S4-2 `f14b2d8`: Escape yalnız menüyü kapatıyor, ikinci Escape paneli)
- ~~2026-09-30 · canli-test · Termin-Aktionen → Verschieben · açılan maskenin başlığı „Neuer Termin“ (Löschen/Verschieben düğmeleriyle düzenleme modu) — `dashboard.js:2550/4916` hep `lbl_manual_title`; P3, eski davranış.~~ — KAPANDI 2026-09-30 (S4-2 `f14b2d8`: düzenleme maskesi „Termin bearbeiten“)
- 2026-09-30 · canli-test · `verordnungen` listesi · `ddf57e1b` aynı gün (29.09) iki 78010 satırıyla „2 / 3“ sayıyor; S4-1’in yeni kuralı (gün başına bir abrechenbar Behandlungstag, `abrechenbareBehandlungstage`) liste sayacına uygulanmamış — soru `gkv-302`/`podoloji`: sayaç gün mü satır mı saymalı. P3.
- ~~2026-09-30 · canli-test · Fußbefund (Termin-Aktionen menüsünden) · panel doğru hastayla açılıyor ama „Termin“ seçicisi boş („— Termin wählen —“), çıkılan gelecek tarihli randevu (02.10) listede yok — beklenen bilinmiyor, `podoloji`’ye. P3.~~ — KAPANDI 2026-09-30 (S4-2 `f14b2d8`: 30.09 `396000d2` ve gelecek 02.10 `e48f89a4` önseçili)
- 2026-09-30 · canli-test · QA tenant test verisi (S4-2 `f14b2d8` turu): yeni Behandlung **`7557e386`** (`f0a303e6`, 30.09, 78010+78030+79933) — gerçek kayıt, Folgetermin sorusu için; `f0a303e6.behandlungsbeginn`=30.09 yazıldı. Başka yazma yok (diğer kayıt denemeleri sahte insert, booking/fahrt yazılmadı).
- 2026-09-30 · canli-test · `podologie-billing` Tagesbehandlung · alan soruları → `podoloji`: (a) Fußbefund bölümü varsayılan kapalı mı kalmalı (ilk Befund günü / Befund’suz hastada açık gelmeli mi)? (b) Randevusuz (listeden açılan) Tagesbehandlung’da Folgetermin yer tutucusu Behandlungstag **09:00**’dan hesaplanıyor ve toast „7 Tage nach dem letzten Termin“ diyor — ortada Termin yokken metin ve saat doğru mu? (c) Folgetermin sorusu 1/1 bitmiş reçetede çıkmıyor — „neue Verordnung anfordern“ gibi bir yönlendirme beklenir mi?
- ✅ KAPANDI 2026-09-30 (`f63041f`, canlı: 390 px grid `358px` tek sütun, 768 px `736px`, taşma 0) · 2026-09-30 · canli-test · `podologie-billing` mobil (390 px) · Tagesbehandlung grid’i `1fr 1fr` kırılımsız: kapalıyken de form x 318–597 (ekran dışı, kaydırılamaz). S4-2’den önce de var, bu turda ölçüldü → `mobil-ui` (P2).

- ~~2026-09-30 · canli-test · Patientenakte (podo) · Termine bölümündeki durum etiketleri ham İngilizce („confirmed“, „completed“) — P3, eski (`module/patient-termine.js`).~~ — KAPANDI (`5badd60`, canlı 2026-09-30: „Bestätigt“/„Erledigt“/„Abgesagt“)
- ✅ KAPANDI 2026-09-30 (`f63041f`, canlı 390/768 px: 44 px yüksek) · 2026-09-30 · canli-test · Patientenakte (podo) · başlıktaki „+ Termin“ / „+ Verordnung“ 21 px yüksek — dokunma hedefi küçük, P3 → `mobil-ui`.
- 2026-09-30 · canli-test · Termin-Aktionen → Rezeptinfo kartı (`#bkRxInfoCard`, `#bkRxSessionsPanel`) @390/768 px · S5 dışında kalan küçük dokunma hedefleri: „⧉ übernehmen“ 94×17, „Kassieren“ 68×17, „€ 🖨“ 25×17, „✎ anpassen“ 69×16, `#bkRxEuroBtn` 34×34, `#bkRxSerieBtn`/`#bkRxLeistungenBtn` 34 px, `.bk-sitz-tab` 29 px, `.pk-verlauf-zeile` 33 px, `.bk-vero-anlegen` 31 px (P2 → `mobil-ui`). Ana şerit ve S5 kapsamındaki düğmeler 44 px.
- 2026-09-30 · canli-test · Patientenakte → Verordnungen · „7 LAUFENDE VERORDNUNGEN“ `abrechnung_status` = `bereit`/`gesendet` olan reçeteleri de sayıyor gibi (hastanın 7 reçetesi var, 4’ü bereit/gesendet) — „laufend“ tanımı → `podoloji`; kart bazında eşleştirme doğrulanmadı.
- 2026-09-30 · canli-test · S4-3 turunda QA’ya yazma YOK (tüm kayıt denemeleri fetch-guard ile sahte).
- 2026-09-30 · canli-test · QA tenant test verisi (`e238a67` turu): Termin-Anfrage **`dd0a00fd`** (Rezept + GKV + AOK Bayern + Hornhautabtragung, 07.10.2026 10:00, e-posta `@example.invalid`) → `declined`; yeni `patients` satırı **`effe559d`** — temizlik listesine.

- 2026-09-30 · canli-test · `kalender.html` (bağlantısız eski sayfa) · üç eski hata: bookings embed `profiles!bookings_user_id_fkey` 400 (takvim boş) · `/api/team` 401 (Auth başlığı yok) · CSP `font-src` FullCalendar `data:` ikon fontunu engelliyor. Sayfa kullanımdaysa P2, değilse arşiv adayı — karar kullanıcının.
- 2026-09-30 · canli-test · `dashboard.html` · `dashboard.js?v=20261001p`, `16c9138`/`a992cf2` içerik değişikliğine rağmen bump edilmedi (P3; `max-age=0, must-revalidate` etkisini sıfırlıyor).
- 2026-09-30 · canli-test · (deploy) · Yerelde push edilmemiş `50cfbe4` + `1f1ef45` `dashboard.js`'i değiştiriyor ama `dashboard.html` hâlâ `dashboard.js?v=20261001r` (canlıdakiyle aynı) — böyle push edilirse tarayıcılar eski `dashboard.js`'i cache'ten verir; push öncesi bump gerekli (17:35Z itibarıyla; sonradan bump edilmiş olabilir).

---

## builder'a devredilenler

**Açık devir: 3** (Regresyon turu 2026-09-30 21:25–22:05Z, `e560eba`+`f63041f`: [P1] kiosk Tab kaçışı ve [P2] kiosk çıkışında Realtime kanalı KAPANDI; reload-kiosk kanal kalıntısı ayrı [P3] olarak açık; S5 mobil ölçümü GEÇTİ, Rezeptinfo küçük hedefleri anomali kutusunda → `mobil-ui`. Önceki: Regresyon turu 2026-09-30 20:49–21:20Z, `3758354`+`853ea99`: [P1] Therapiezeit, [P2] „Nur Einwilligung“ seçici, [P2] Praxisstandort metni KAPANDI; [P1] kiosk Tab kaçışı KALDI (inert header'ı kapsamıyor, regresyon 1); yeni [P2] kiosk çıkışında Realtime kanalı ölü — aşağıda. Regresyon+yeni turu 2026-09-30 17:40–18:10Z, `50cfbe4`+`1f1ef45`+`f587876`: [P0] kiosk seçici ve [P2] Anamnese „Erstellt“ KAPANDI; yeni [P1] Therapiezeit c-reçetede hiç çıkmıyor (LS bit dizgisi), [P1] kiosk'tan Tab ile header'a kaçış (`3758354` yerelde, push yok), [P2] „Nur Einwilligung“da seçici klavyeyle değişiyor, [P2] Praxisstandort metni GPS kapalıyken „geprüft“ diyor — aşağıda. Anamnese turu 2026-09-30 17:19–17:35Z, `e8dd77e`: yeni [P0] kiosk'ta hasta seçici açık + [P2] Akte Anamnese „Erstellt“ profiles 400 — aşağıda, ikisi de bu commit'ten önce de vardı. Praxisstandort turu 2026-09-30 16:22–16:30Z: yeni [P1] Permissions-Policy `geolocation=()` konum düğmesini ve çalışan GPS check-in'ini engelliyor — aşağıda. `e238a67` turu 2026-09-30 15:20–15:27Z: [P2] KK UUID KAPANDI; yeni [P2] Anfragen kart düğmeleri detayı açıyor — aşağıda. Online-Anfrage v2 turu 2026-09-30 15:08–15:17Z: yeni [P2] Krankenkasse UUID olarak görünüyor — aşağıda. Akte regresyonu 2026-09-30 14:20–14:35Z: S4-3 turunun [P1] podo Verordnungen physio listesi (`42dfe4e`+`2db9bd0`) ve [P2] Termine lead_id (`5badd60`) canlıda KAPANDI. S4-3 turu 2026-09-30: [P1] podo Akte Verordnungen sekmesinde physio listesi çift + [P2] Termine hastayı lead_id ile bulmuyor — aşağıda, ikisi de S4-3 öncesinden. S4-2’nin iki P1’i `b830cfb` ile canlı regresyonda KAPANDI, 2026-09-30; P2 Demo-Modus — DB ayarı `module_visibility`, sınanmadı. S4-1’in diğer üç P2’si `5ca271c` ile canlı regresyonda KAPANDI, 2026-09-30). Önceki: (30.09.2026 `047baab` turu: [P2] LS a)+78010 maske ipucu — `765c9ed` ile canlıda KAPANDI. 30.09.2026 `7459ba1` turu: P1 `booking-request.html` sihirbazı boş — `bd71bbf` ile canlı regresyonda KAPANDI. 30.09.2026 P1-Regression turu: signal.js P1’i `9d4b057` ile canlıda KAPANDI. 30.09.2026 S3-Reste turu: P1 signal.js iki örnek — aşağıda. 30.09.2026 öğleden sonra: aşağıdaki P1/P2/P3 + S3.8b P3a gözlemi `f6cd960`/`14171df` ile canlı regresyonda KAPANDI. Önceki: 30.09.2026 öğle: P1 non-terminal ICD „E11.7-“ §302 dosyasını blokluyor · P2 listede „ICD-10-Kode fehlt“ · P3 kayıtlı non-terminal ICD uyarısı yeniden açılışta çıkmıyor — aşağıda). 30.09 öğle: „eski Karten-IK ipucu“ P3'ü `50ef95e` ile canlı regresyonda KAPANDI. 30.09 sabah: „Kasse araması bağlanmıyor" P1'i `2cc414a` ile canlı regresyonda KAPANDI. Kapatılmış girişler geçmiş kaydı
olarak, aynı semptom üçüncü kez çıkarsa buraya bakılır).

### ~~[P1] Therapiezeit-Feld erscheint bei c) Komplexbehandlung nie — `podVordMassnahme` liest das Bit-Format der Maske nicht (2026-09-30, `1f1ef45`-Tur)~~ — KAPANDI (`853ea99`, canlı regresyon 2026-09-30 20:49–21:20Z, QA test2, yazmasız: `50d1a8da` `'0010'` → alan görünür, 15→78010 / 25→78020, boş/uyumsuz kayıt reddedildi; a) `6bd45d0e` 78020 kilidi hata veriyor — bkz. Tagesbehandlung kaydı)

**Nerede:** `podologie-billing` → Tagesbehandlung (reçete Muster-13 maskesinden kaydedilmiş)
**Yeniden üretme:** 1. Muster-13 maskesinde DF reçete, Leitsymptomatik yalnız c) işaretli, kaydet 2. Behandlungen → bu reçete
→ Beklenen: „Therapiezeit (Minuten) *“ alanı, zorunlu; 78010/78020 dakikadan
→ Gerçekleşen: alan yok, 78010 önseçili, Therapiezeit kontrolü hiç devreye girmiyor; `therapiezeit_min` NULL kalır
**Kanıt:** yeni reçete `50d1a8da` DB `leitsymptomatik='0010'`, `heilmittel_items=[]` → `#podTherapiezeit` yok. Aynı satır `'c'` yapılınca alan çıktı ve tüm mekanik çalıştı (bkz. Tagesbehandlung kaydı). QA'daki tüm podo reçeteleri `'1000'` biçiminde.
**Şüpheli:** `module/podologie-abrechnung.js:399-407` (`podVordMassnahme` yalnız `a|b|c` / `DF-c` / `heilmittel_items` okuyor, `/^[01]{4}$/` yok) ↔ `dashboard.js:14832-14841` (`lsCollect` → `'0010'`) + `dashboard.js:15231`. Aynı fonksiyon `:1031` 78020-Sperre (a/b), `:582`, `:756` (LS-Notiz) ve `:418` Behandlungsposition önerisinde kullanılıyor → **a)/b) reçetede 78020 kilidi de sessizce kapalı olmalı** (kodla, canlıda sınanmadı). `dashboard.js:14852` `lsApply` bit dizgisini zaten çözüyor — aynı çözüm modülde yok.
**Katman:** 4 (Belege/Geld — Position = Abrechnungspreis, Retax riski)
**Etki:** Podolog c) reçetede süreyi hiç girmiyor, 78020 yerine 78010 (veya tersi) kasaya gidebilir; a)/b) reçetede 78020 engeli çalışmıyor. Test verisi: `50d1a8da` (`'0010'`, bir 78020/25 dk seansı `1ebd1225` ile) regresyon için hazır.

### ~~[P1] Kiosk „An Patient übergeben“: Tab ile overlay dışına (header: „Praxura“ bağlantısı, „Rezept scannen“, Dunkelmodus, „Abmelden“) çıkılıyor — `3758354` sonrası da açık, `inert` header'ı kapsamıyor (2026-09-30, regresyon 1 KALDI)~~ — KAPANDI (`e560eba`, canlı regresyon 2, 2026-09-30 21:25–22:05Z: 60× Tab normal/PIN/Einwilligung/F5'te odak kiosk'ta, `inert` header + layout)

**Nerede:** `anamnese` → „An Patient übergeben“ (overlay açık)
**Yeniden üretme:** 1. Kiosk'u başlat 2. Tab'a ~43 kez bas
→ Beklenen: odak overlay içinde kalır (arka plan `inert`)
→ Gerçekleşen: 45 Tab'ın 3'ü arka planda (`A` „Praxura“ → `/`, `rezeptScanBtn`, `BODY`); Enter ile PIN'siz sayfadan çıkış mümkün (Enter'a basılmadı)
**Kanıt:** `document.activeElement.closest('#kioskOverlay')` = null; canlı `module/kiosk.js?v=20261002a` içinde `hintergrundInert` 0 kez
**Şüpheli:** `module/kiosk.js` — yerel HEAD `3758354` (`hintergrundInert` + `sessionStorage` kiosk işareti, guvenlik S-37/A-20) bunu hedefliyor; **push edilmemiş**. Push + aynı testin regresyonu yeter.
**Regresyon 1 (2026-09-30 20:49–21:20Z, `3758354`+`853ea99` canlı):** KALDI. 60 Tab → 5 overlay dışı (`BODY`, `A` „Praxura“, `#rezeptScanBtn`, `#themeToggle`, `#logoutBtn`); reload-sonrası PIN modalında ve „Nur Einwilligung“da aynı. `[inert]` yalnız `DIV.dashboard-layout`. Kök: `module/kiosk.js:320` `document.querySelectorAll('body > header, .dashboard-layout')` — header `dashboard.html:41`'de `<div id="app">` içinde (`#app > header.topbar`), `body > header` hiçbir şeyle eşleşmiyor. Olası düzeltme: seçici `#app > header.topbar`. `.dashboard-layout` kısmı çalışıyor — sidebar/panel'e odak gitmiyor. Enter'a basılmadı.
**Regresyon 2 (2026-09-30 21:25–22:05Z, `e560eba` canlı):** GEÇTİ. `[inert]` = `HEADER.topbar` + `DIV.dashboard-layout`; 4 kiosk durumunda 60× Tab → overlay dışı yalnız `BODY` (odak döngüsü).
**Katman:** 5 (Anzeige/Zugriff)
**Etki:** Harici klavyeli tablette hasta kiosk'tan dashboard'a (Art. 9 veri) çıkabilir.

### ~~[P2] Kiosk „Nur Einwilligung“: hasta seçici onam süresince kilitlenmiyor — klavyeyle başka hasta seçilebiliyor (2026-09-30)~~ — KAPANDI (`853ea99`, canlı regresyon 2026-09-30 20:49–21:20Z: seçici disabled, 45× Tab+↑ değiştiremedi, çıkışta aynı hasta seçili)

**Nerede:** `anamnese` → „Nur Einwilligung“ (einwilligungOverlay açık)
**Yeniden üretme:** 1. Hasta A seç 2. „Nur Einwilligung“ 3. Tab ile `#anamPatientSelect`'e gel, ↑
→ Beklenen: onam kiosk'unda da seçici disabled/hidden (kiosk sözleşmesi)
→ Gerçekleşen: seçici `disabled=false`, `hidden=false`; ↑ ile A→B değişti, B'nin formu arka planda yüklendi; onam overlay'i A'da kaldı; PIN ile çıkınca ekranda B seçili
**Kanıt:** onam açıkken `#anamPatientSelect.disabled=false`; fare ulaşamıyor (`elementFromPoint` = overlay `SPAN`), klavye ulaşıyor
**Şüpheli:** `module/kiosk.js` `enterKioskMode` (yerel HEAD ~350-358) — `kioskSperre(true)` yalnız Anamnese dalında; `nurEinwilligung` dalında çağrılmıyor. `3758354`'in `inert`'i klavyeyi büyük olasılıkla keser, ama seçici yine etkin kalır → `kioskSperre(true)`'yu iki dala da koymak kesin çözüm.
**Katman:** 5 (Anzeige)
**Etki:** Onam sonrası tablet geri geldiğinde praksis ekranında yanlış hasta seçili → yanlış hastaya kayıt riski. Hasta B'nin verisini göremez (overlay altında).

### ~~[P2] Praxisstandort metni GPS-Prüfung kapalıyken de „Check-ins werden im Umkreis von 150 m geprüft“ diyor (2026-09-30, `1f1ef45`)~~ — KAPANDI (`853ea99`, canlı regresyon 2026-09-30 20:49–21:20Z: kapalı „GPS-Prüfung ist aus“, açık „150 m geprüft“, anında + reload sonrası tutarlı; ayar kapalı bırakıldı)

**Nerede:** `team` → Anwesenheit → Praxisstandort kutusu
**Yeniden üretme:** 1. Praxisstandort ayarlı, „GPS-Prüfung beim Einchecken“ kapalı 2. Team panelini aç
→ Beklenen: metin şalterle tutarlı (ör. „… GPS-Prüfung ist aus — Check-ins werden nicht geprüft“)
→ Gerçekleşen: „Praxisstandort gesetzt (…) — Check-ins werden im Umkreis von 150 m geprüft.“; onay kutusu değişince metin de güncellenmiyor
**Kanıt:** DB `gps_checkin_pruefen=false`, metin aynı; rapor aynı anda „nicht geprüft“ gösteriyor (aynı bilgi iki yerde farklı)
**Şüpheli:** `module/praxis-standort.js:71-78` (`standortStatusText` şalteri bilmiyor) + `:111-116` (`zeichne`) + `:127-136` (`schalter` `zeichne()` çağırmıyor)
**Katman:** 5 (Anzeige)
**Etki:** Owner GPS kontrolünün çalıştığını sanıyor.

### ~~[P2] Kiosk'tan çıkınca Termin-Realtime kanalı ölü kalıyor — `subscribe()` aynı kanal örneğinde ikinci kez çağrılıyor ve hata yutuluyor (2026-09-30, `853ea99` turu, `bdb4f2b`'den beri)~~ — KAPANDI (`e560eba`, canlı regresyon 2026-09-30 21:25–22:05Z: PIN çıkışı sonrası `joined`, „multiple times“ yok, API ile INSERT/UPDATE/cancel takvimde yenilemesiz göründü. Reload-kiosk P3 ekinin kalanı ayrı [P3] olarak aşağıda)

### [P3] Kiosk açıkken F5: kilit geri geliyor ama `bookings-realtime` kanalı `joined` (2026-09-30, `e560eba` sonrası da açık)

**Nerede:** `anamnese` → kiosk → F5
**Yeniden üretme:** 1. Kiosk'u (normal veya „Nur Einwilligung“) başlat 2. Sayfayı yenile 3. `window.__praxuraBookingsChannel.state`
→ Beklenen: kiosk süresince `closed` (çıkışta yeniden kurulur — bu kısım artık çalışıyor)
→ Gerçekleşen: `joined`; PIN çıkışından sonra da `joined` (çıkış yolu sağlam)
**Kanıt:** reload sonrası `sessionStorage praxura.kiosk.aktiv=1`, overlay+PIN modalı açık, kanal `joined`
**Şüpheli:** `module/kiosk.js:150` (`initKioskMode` → `kioskNachNeuladen()`) → `:288` `getBookingsChannel()?.unsubscribe()` kanal henüz yokken (null) çalışıyor; kanal sonra `dashboard.js:15859` `neuerBkKanal()` ile açılıyor ve kiosk işaretine bakmıyor. Çözüm yönü: `neuerBkKanal` kurulurken `praxura.kiosk.aktiv` ise abone olmamak (ya da kanal kurulunca kiosk'a haber vermek).
**Katman:** 3 (Termin/akış)
**Etki:** Görünür etki bulunamadı (`bookings:changed` yalnız `refreshBookingViews()` çağırıyor, toast yok); kiosk'un mahremiyet niyetini teoride deliyor.

**Nerede:** `anamnese` → „An Patient übergeben“ / „Nur Einwilligung“ → PIN ile çık → Terminkalender canlı güncelleme
**Yeniden üretme:**
1. Dashboard'u yükle — `window.__praxuraBookingsChannel.state` = `joined`
2. Kiosk'u başlat (`closed` — beklenen), PIN ile çık
3. Kanal durumuna bak
→ Beklenen: çıkışta kanal yeniden `joined`, `booking.html`'den gelen randevu takvime canlı düşer
→ Gerçekleşen: `closed`, socket'te kanal yok; elle `subscribe()` → `tried to join multiple times. 'join' can only be called a single time per channel instance`. Sayfa yenilenene kadar realtime yok (gerçek bir randevu olayıyla uçtan uca sınanmadı — kanal durumu ölçüldü).
**Ek (P3, aynı konu):** kiosk açıkken reload → `kioskNachNeuladen()` DOMContentLoaded'da `getBookingsChannel()` = null görüyor (kanal `dashboard.js:15858`'de init sonunda açılıyor) → kiosk kilitli ama kanal `joined`. Görünür etki bulunamadı: `bookings:changed` yalnız `refreshBookingViews()` çağırıyor (`dashboard.js:1909`), toast yok; reload sonrası toast görülmedi.
**Kanıt:** çıkış sonrası `state='closed'`, `socket.channels` boş; reload-kiosk'ta `state='joined'`
**Şüpheli:** `module/kiosk.js:419` (`try { getBookingsChannel()?.subscribe(); } catch {}`) — supabase-js v2 kanalı `unsubscribe()` sonrası yeniden katılamaz; çıkışta yeni `supabase.channel('bookings-realtime')` kurulmalı (kurulum `dashboard.js:15858-15869` bir fonksiyona alınıp kiosk'a verilebilir). Reload yolu: `module/kiosk.js:286` + kanal kurulurken `praxura.kiosk.aktiv` işaretine bakılması.
**Katman:** 5 (Anzeige)
**Etki:** Kiosk kullanan praksis, sayfayı yenilemeden online gelen randevuları takvimde görmez. Reload sonrası kiosk'ta kanalın açık olması mahremiyet amacını teoride deliyor, bugün görünür yüzeyi yok.

### ~~[P0] Kiosk („An Patient übergeben“): hasta seçici kiosk içinde açık — tableti tutan hasta başka hastayı seçip onun Anamnese'sini görebiliyor ve üzerine kayıt atabiliyor (2026-09-30, `e8dd77e` turu, eski)~~ — KAPANDI (`f587876`, canlı regresyon 2026-09-30 17:40–17:50Z, QA test2: kiosk'ta seçici disabled+hidden, „Rezept hinzufügen“ disabled+görünmez; PIN sonrası ikisi geri ve çalışıyor. „Nur Einwilligung“ kalıntısı → yeni [P2] yukarıda)

**Nerede:** `anamnese` paneli → „An Patient übergeben“ (kiosk overlay'i)
**Yeniden üretme:** 1. Anamnese panelinde hasta A'yı seç 2. „An Patient übergeben“ (PIN) 3. Kiosk içinde „Patient wählen“ listesinden hasta B'yi seç
→ Beklenen: kiosk'ta hasta sabit; liste görünmez/kilitli, başka hastanın verisi yüklenmez
→ Gerçekleşen: listede tenant'ın tüm hastaları (ad + doğum tarihi, `displayNameWithBirth`); B seçilince B'nin geçerli anamnezi forma dolduruldu (QA'da 10 işaretli alan), kiosk açık kaldı; „Speichern“ B'ye `quelle=kiosk` sürümü yazar. Aynı panelde „Rezept hinzufügen“ (`anamRezeptBtn`) de kiosk'ta görünür/tıklanabilir → Rezept maskesi.
**Kanıt:** kiosk açıkken `#anamPatientSelect` görünür, `disabled=false`, 4 seçenek; seçim → `GET anamnese?patient_id=eq.<B>` 200, `#anamDynForm input:checked` 0 → 10
**Şüpheli:** `module/kiosk.js:284-299` (`enterKioskMode` bütün `#panel-anamnese`'yi overlay'e taşıyor, seçiciyi/Rezept düğmesini kilitlemiyor) · `dashboard.html:2107-2114` (seçici + `anamRezeptBtn` aynı panelde) · `module/anamnese.js:534` (Stand `e8dd77e`; `sel.onchange = fuelleFormular`, kiosk kontrolü yok) · `dashboard.js:15903`. Kalıp `bdb4f2b` (2026-08-14) ve `c737afc` (2026-06-12) tarihinden beri var — `e8dd77e` regresyonu değil.
**Katman:** 1 (Stammdaten — hasta verisi) → K4
**Etki:** Art. 9 DSGVO / §203 StGB: bir hasta praksisin hasta listesini ve başka hastaların sağlık beyanlarını görebilir; yanlış hastaya Selbstauskunft yazılabilir. Kiosk dosya başı „Irrtumssperre, keine Sicherheitsgrenze“ diyor, ama bu tek dokunuşla, kasıt gerekmeden oluyor. Canlı müşteri henüz yok; ilk kiosk kullanımından önce kapanmalı. `guvenlik` + `legal-de` görüşü önerilir.

### ~~[P2] Patientenakte → Anamnese sekmesi: „Erstellt“ satırı için `profiles?select=first_name,last_name,business_name` her açılışta 400 (2026-09-30, `e8dd77e` turu, eski)~~ — KAPANDI (`f587876`, canlı regresyon 2026-09-30 17:50Z: „Erstellt: <tarih> · <ad>“, konsol 0 hata)

**Nerede:** Patientenakte → Anamnese sekmesi (ve „unverändert bestätigen“ sonrası yeniden çizimde)
**Yeniden üretme:** 1. Anamnezi olan bir hastanın Akte'sini aç 2. Anamnese sekmesi
→ Beklenen: „Erstellt: <tarih> · <kaydeden>“
→ Gerçekleşen: yalnız tarih; konsolda 400
**Kanıt:** `GET /rest/v1/profiles?select=first_name%2Clast_name%2Cbusiness_name&id=eq.c4fbded4…` → 400 (her sekme çiziminde bir kez)
**Şüpheli:** `module/anamnese.js:578` (Stand `e8dd77e`; yerelde 588) — `profiles`'ta `first_name`/`last_name` yok, var olanlar `owner_first_name`/`owner_last_name` (`db/SCHEMA.sql:2848` vd.); eski `dashboard.js` `loadPatientDetailAnamnese`'den aynen taşınmış
**Katman:** 5 (Anzeige)
**Etki:** Podolog kaydı kimin yaptığını göremiyor; konsol her Akte açılışında kirleniyor.

### [P1] Praxisstandort düğmesi hiçbir cihazda çalışamaz — `Permissions-Policy: geolocation=()` tarayıcı konumunu sayfa düzeyinde yasaklıyor (2026-09-30, `16c9138` turu)

**Nerede:** `team` paneli → Anwesenheit (Owner) → „Aktuellen Standort als Praxisstandort übernehmen“; aynı başlık `attendance.html` (çalışan check-in) için de geçerli
**Yeniden üretme:** 1. Team panelini aç 2. tarayıcıda konum iznini ver 3. düğmeye bas
→ Beklenen: „Praxisstandort gespeichert.“, metin „gesetzt (…)“
→ Gerçekleşen: „Standortfreigabe verweigert oder nicht verfügbar …“ toast'u; `featurePolicy.allowsFeature('geolocation')` = false; konum yazılmıyor
**Kanıt:** konsol `Permissions policy violation: Geolocation access has been blocked because of a permissions policy applied to the current document` @ `praxis-standort.js:56`; yanıt başlığı `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
**Şüpheli:** `vercel.json:18` ve `onprem/Caddyfile:44` (`geolocation=()` → en az `geolocation=(self)`); kuralı getiren commit `891f0c8` (pre-launch hardening) — yani çalışan GPS check-in'i (`attendance.js:207`) de o günden beri canlıda konum alamıyor olmalı (çalışan hesabıyla sınanmadı). Başlığı gevşetmek bir güvenlik ayarına dokunur → `guvenlik`'e sorulmalı.
**Katman:** 3 (Termin/Anwesenheit akışı)
**Etki:** Owner Praxisstandort'u hiç ayarlayamıyor → check-in'ler GPS kontrolsüz sayılıyor (O-140'ın amacı gerçekleşmiyor); çalışan check-in'inde GPS adımı muhtemelen her seferinde reddediliyor.
**Güncelleme 2026-09-30 18:05Z (`1f1ef45`):** Permissions-Policy bilerek değiştirilmedi. Owner check-in canlıda konumsuz da başarılı (200, `check_in_valid=NULL`, rapor „nicht geprüft“) — artık akışı bloklamıyor; ama GPS-Prüfung açıkken bile hiçbir cihazda konum alınamıyor, özellik fiilen „her zaman nicht geprüft“. Karar `guvenlik`/`legal-de`'de; açık kalır.

### ~~[P1] Patientenakte (Podologie) → „Verordnungen“: laufende kartların altında physio „Rezepte“ listesi de çiziliyor — aynı reçete iki kez, sayaç çelişkili, §302 durum düğmeleriyle (2026-09-30, S4-3 turu, eski)~~ — KAPANDI (`42dfe4e`+`2db9bd0`, canlı regresyon 2026-09-30 14:20–14:35Z, QA test2, fetch-guard ile yazmasız; `a8e9df53` → Verordnungen: `#pdRezContent` display:none, görünür `.pd-rech-item` 0, „x/y Sitzungen“ 0, „Zuzahlungs-Befreiung“ yok, yalnız „7 LAUFENDE VERORDNUNGEN“ kartları; `22181f45`: tek boş ipucu „Keine laufende Verordnung …“, „Keine Rezepte vorhanden.“ yok. Physio hastada Rezepte listesi — QA tenantta physio hasta yok, sınanmadı)

**Nerede:** `kunden` → podo hasta → Patientenakte → Verordnungen (`#pdPanelRezepte`)
**Yeniden üretme:**
1. QA test2, hasta `a8e9df53` Akte’sini aç → „Verordnungen“
→ Beklenen: yalnız „LAUFENDE VERORDNUNGEN“ kartları (`#pdVeroUebersicht`), yoksa boş ipucu
→ Gerçekleşen: kartların altında `#pdRezContent` physio listesi: „Zuzahlungs-Befreiung“ + 7 `.pd-rech-item` („0/4 Sitzungen“, „DMRZ offen“, „Als bereit markieren“/„Rückgängig“, „Drucken ▾“). Kart „1 / 4 Einheiten · noch 3“ derken liste „0/4 Sitzungen“ (prescription_sessions podolojide yok → hep 0). Reçetesiz hastada (`22181f45`) „Keine Rezepte vorhanden.“ + „Keine laufende Verordnung …“ iki boş mesaj üst üste.

**Kanıt:** DOM ölçümü, konsol hatası yok; S4-3 öncesi de „Rezepte“ sekmesi podolojide görünürdü (aynı yükleme), S4-3 onu „Verordnungen“ yaptı ve boş ipucunu ekledi.
**Şüpheli:** `dashboard.js:7840-7843` `if (isPhysio) { loadPatientDetailRezepte(leadId); … }` — `isPhysio = isPraxisSector(getSector())`, `dashboard.js:892` `PRAXIS_SECTORS` `'podologie'` içeriyor → podolojide de koşuyor. `module/akte-podo.js` (`setzeAkteReiter` yorumu) „`loadPatientDetailRezepte` läuft dort nicht“ varsayıyor. `dashboard.css:6057` boş ipucunu yalnız `#pdVeroUebersicht`’e göre gizliyor.
**Katman:** 4 (Belege/Geld — Abrechnung-Status düğmeleri) → K4
**Etki:** podolog aynı reçeteyi iki kez, çelişen sayaçla görüyor; yanlış sayacın yanında „Als bereit markieren“ var. Domain: bu listenin (Zuzahlungs-Befreiung dahil) podoloji Akte’sinde nerede kalacağı → `podoloji`.

### ~~[P2] Patientenakte → Termine: randevular `bookings.lead_id` ile değil telefon/ad ile aranıyor — hastanın randevularının çoğu görünmüyor (2026-09-30, S4-3 turu, eski)~~ — KAPANDI (`5badd60`, canlı `module/patient-termine.js` `lead_id.eq` içeriyor, regresyon 2026-09-30 14:20–14:35Z, QA test2, yazmasız; `a8e9df53`: DB `lead_id` ile 16 = 4 completed + 3 confirmed + 9 cancelled → liste 7 („Bestätigt“ 3 · „Erledigt“ 4), Schalter açık 16 (+9 „Abgesagt“, 9 „Abgesagt am …“ satırı), kapalı yine 7. `22181f45` (telefon yok): 0 → 1 → 0 = DB’deki tek (cancelled) randevu; S4-3 turunda 2 görülmüştü, bugün DB’de ad veya `lead_id` ile yalnız 1 var — liste DB ile eşit)

**Nerede:** Patientenakte → Verlauf → „Termine“ (`#pdPanelTermine`)
**Yeniden üretme:**
1. QA test2, hasta `a8e9df53` (telefonu yok) Akte → Verlauf → Termine aç
2. „Abgesagte Termine anzeigen“ işaretle
→ Beklenen: hastaya `lead_id` ile bağlı 7 aktif randevu; Schalter ile + 9 abgesagt
→ Gerçekleşen: 2 satır, Schalter açıkken de 2 (bağlı 16 randevunun 14’ü farklı `customer_name` yazımıyla kayıtlı)

**Kanıt:** REST okuması `bookings?lead_id=eq.<a8e9df53…>` → 16 satır; `customer_name` = Akte başlığı olan 2 satır. Schalter mekaniği sağlam (`22181f45`: 0 → 2 → 0).
**Şüpheli:** `module/patient-termine.js:11-12` `if (lead?.phone) query.eq('customer_phone', …) else if (patientName) query.eq('customer_name', …)` — `lead_id` kolonu varken kullanılmıyor.
**Katman:** 2 (Termin)
**Etki:** podolog Akte’de hastanın randevu geçmişini eksik görüyor; S4-3 bu listeyi Verlauf’un altına taşıdığı için daha görünür.

### ~~[P1] Tagesbehandlung: Fußbefund bölümü açılınca sağ sütun ekran dışına taşıyor — gömülü kartın „Speichern“ı 1280/1440 px’te erişilemez (2026-09-30, S4-2)~~ — KAPANDI (canlı regresyon 2026-09-30 13:30–13:45Z, `b830cfb`+`96e8f3a`, `dashboard.js?v=20261001n`, QA test2, fetch-guard ile yazmasız; grid `minmax(0,1fr)` açıkken 1280 px’te 476/476, 1440 px’te 556/556, panel `#mainArea` içinde; `#fbpSaveBtn` 959–1059 / 1039–1139, `#fbpNewBtn` 825–951 / 905–1031, `elementFromPoint` düğmeye isabet; kart host içinde yatay kayıyor (sw 898 / cw 436). 390 px’te artık ekran içinde ama sütunlar 177 px — mobil P2 anomali satırı açık)

**Nerede:** `podologie-billing` → Verordnung seç → „Fußbefund — zuletzt am …“ aç
**Yeniden üretme:**
1. 1280×900 pencere, `50139501` seç
2. Fußbefund bölümünü aç
→ Beklenen: kart Tagesbehandlung sütununun içinde kalır, gerekirse host’ta yatay kaydırma (`overflow-x:auto`)
→ Gerçekleşen: grid `1fr 1fr` (476/476) → `282px 950px`; sütun x 586–1536, `#mainArea` `overflow:hidden` 1280’de kesiyor. `#fbpNewBtn` x 1257–1383, `#fbpSaveBtn` x 1391–1491 (1440 px’te de 1391–1491); yalnız 1920 px’te içeride. Kullanıcı yatay kaydıramaz.

**Kanıt:** ölçüm (`getBoundingClientRect`, `getComputedStyle(grid).gridTemplateColumns`); en geniş iç öğeler `#fbpUebernahme` / `.fbp-card-container` 886 px
**Şüpheli:** `module/podologie-abrechnung.js:852` — `grid-template-columns:1fr 1fr` (`1fr` = `minmax(auto,1fr)`, min-content’e büyüyor); `#podBehPanel` (satır 877) `min-width:0` yok, bu yüzden `module/podo-tag-zusatz.js` host’undaki `overflow-x:auto;max-width:100%` işe yaramıyor. Muhtemel düzeltme `minmax(0,1fr) minmax(0,1fr)` veya `#podBehPanel{min-width:0}` — builder doğrulasın
**Katman:** 3 (Behandlung dokümantasyonu) · Fußbefund yazma yolu `pat_fussbefund`
**Etki:** podolog Tagesbehandlung içinden Fußbefund’u kaydedemiyor (dizüstü genişliklerinde); alternatif yol Fußbefund paneli

### ~~[P1] „Alle Einheiten aufgebraucht“ satır sayıyor, abrechenbar Behandlungstag değil — Befund-günleri reçeteyi erken `bereit` yapıyor ve Folgetermin sorusunu bastırıyor (2026-09-30, S4-2 turu, kod+veri)~~ — KAPANDI (canlı regresyon 2026-09-30 13:30–13:45Z, `b830cfb`+`96e8f3a`, `dashboard.js?v=20261001n`, QA test2, fetch-guard ile yazmasız; `50139501` üzerinde sahte-başarılı 78010 kaydı, sayaç okuması 3 satır döndürecek şekilde yeni satırla genişletildi (eski kod 3 ≥ 3 → bereit sayardı) → `abrechenbareBehandlungstage`=1, status PATCH’i YOK, toast „aufgebraucht“ YOK, Folgetermin sorusu çıktı; DB `abrechnung_status` NULL kaldı)

**Nerede:** `podologie-billing` → Behandlung speichern
**Yeniden üretme (canlıda yazılmadı, kod + DB’den):**
1. `50139501`: 3 Einheiten, iki storniert olmayan satır `3e256b9a`, `f287afd9` — ikisi de 78030+79933 (Befund-only, aynı gün)
2. Bir sonraki gerçek 78010 Behandlung kaydedilince `count` = 3 ≥ 3
→ Beklenen: 1/3 abrechenbar gün (S4-1 kuralı `abrechenbareBehandlungstage`, 78010/78020, gün başına bir, 78620 sayılmaz); status değişmez, Folgetermin sorulur
→ Gerçekleşen (kod): `abrechnung_status` → `bereit` + toast „Alle Einheiten aufgebraucht“ + `alleVerbraucht=true` → Folgetermin sorusu çıkmaz

**Kanıt:** `module/podologie-abrechnung.js:1113-1127` — `select('*',{count:'exact',head:true}).is('storniert_am',null).eq('verordnung_id',…)` → tüm satırlar; `f77efc4c` (1/1) canlıda sahte insert ile doğru dalda (toast, soru yok) — dal çalışıyor, sayım ölçütü yanlış
**Şüpheli:** aynı satırlar; sayacın `verordnung-uebersicht.js`/`abrechenbareBehandlungstage` ile aynı kuralı kullanması gerekir (liste sayacı için açık anomali satırıyla aynı kök). S4-2 regresyonu değil ama S4-2 Folgetermin sorusunu bu sayaca bağladı
**Katman:** 4 (Belege/Geld — `abrechnung_status`) → K4
**Etki:** Befund günlü reçete ilk tedaviden sonra „Bereit zur Abrechnung“ olur, kalan Einheiten boşa gider/erken abrechnung; podolog Folgetermin önerisi almaz. Kural onayı: `gkv-302`


### ~~[P2] Termin-Anfrage (GKV): Krankenkasse hasta özetinde ve owner detayında UUID olarak görünüyor (2026-09-30, Online-Anfrage v2 turu, eski)~~ — KAPANDI (`e238a67`, canlı regresyon 2026-09-30 15:20–15:27Z: özet + owner detay „AOK Bayern“, DB `dd0a00fd` ad taşıyor)

**Nerede:** `booking-request.html` adım 5 (GKV) → adım 7 özet; owner `anfragen` → Anfrage-Details
**Yeniden üretme:** 1. `?u=test-podologie-qa` → GKV'li bir Anliegen → adım 5'te Krankenkasse „AOK Bayern“ seç → 2. özete bak → 3. gönder, owner Termin-Anfragen detayını aç
→ Beklenen: „AOK Bayern“ · → Gerçekleşen: iki yerde de `c84a7cb3-81f6-44e1-8a97-0f73639af33b` (talep `16e25722`)
**Kanıt:** `booking_requests.krankenkasse` alanına select değeri (krankenkassen.id) yazılıyor; özet ve owner detayı onu olduğu gibi basıyor
**Şüpheli:** `booking-request.js:927` `opt.value = kk.id || kk.name` + `:997` `kk.value` → `state.krankenkasse`; özet `booking-request.js:1155`; owner `dashboard.js:19645` `extraFields.push(['Krankenkasse', req.krankenkasse])`. Kod `91c892c` (28.06.2026)'dan beri böyle
**Katman:** 1 (Stammdaten — Kasse) · **Etki:** hasta kendi seçimini doğrulayamıyor; praxis Anfrage'da kasseyi okuyamıyor, kabul/Verordnung aktarımında elle bulmak zorunda

### ~~[P2] Termin-Anfragen listesi: kart üzerindeki „Annehmen“/„Ablehnen“ düğmeleri kendi penceresi yerine Anfrage-Details'i açıyor (2026-09-30, `e238a67` turu, eski)~~ — KAPANDI (`3adda3a`, canlı regresyon 2026-09-30 15:30–15:36Z, `dashboard.js?v=20261001p` içerik düzeltmeyi taşıyor: kart „Ablehnen“ (gerçek ref tıklaması) → doğrudan „Ablehnen“ penceresi, `#declineReasonInput` var, Anfrage-Details yok; kart gövdesi → Anfrage-Details; „Annehmen“ tıklanmadı, `dashboard.js:19599` aynı `event.stopPropagation()` kodda + canlıda; test talebi `44ab1a7d` → declined)

**Nerede:** dashboard `anfragen` → „Offen“ listesi, kart altındaki düğmeler
**Yeniden üretme:** 1. açık bir Anfrage'nın kartında „Ablehnen“e tıkla (gerçek Playwright tıklaması, ref ile) → Beklenen: „Ablehnen“ penceresi (Grund + Absage senden) · → Gerçekleşen: Anfrage-Details penceresi açılıyor (`#declineReasonInput` yok); red ancak detaydaki ikinci „Ablehnen“ ile mümkün
**Kanıt:** düğme `onclick="declineAnfrage(id)"`, kart `onclick="showAnfrageDetail(id)"`; olay kabarcıklanıyor, ikinci `showHtmlModal` birincinin yerini alıyor. Detaydaki düğme `closeHtmlModal();declineAnfrage(id)` ile doğru çalışıyor. „Annehmen“ aynı yapıda (kabul tetiklememek için tıklanmadı)
**Şüpheli:** `dashboard.js:19599-19600` (kart düğmeleri, `event.stopPropagation()` yok) + `:19603` kart `onclick`
**Katman:** 2 (Termine) · **Etki:** praxis listeden tek tıkla kabul/red edemiyor, her seferinde fazladan bir pencere

### [P2] Podoloji menüsünde „Demo-Modus“ hâlâ görünüyor — `module_visibility` admin toggle’ı registry’deki `roles: []`’ı eziyor (2026-09-30, S4-1)

**Nerede:** sidebar, grup „Einstellungen“, `beispielmodus`
**Yeniden üretme:** 1. QA tenant (sector podologie) taze yükle → 2. sidebar’a bak
→ Beklenen: Demo-Modus yok (Konsey 30.09, `nav-registry.js:117` `roles: []`) · → Gerçekleşen: Einstellungen altında „Demo-Modus“ görünür ve açılıyor
**Kanıt:** `module_visibility` (sector=podologie, module_id=beispielmodus) owner+employee `enabled=true` satırları var; `dashboard.js:1037-1039` öncelik: toggle > registry roles → `roles: []` yalnız toggle YOKSA etkili
**Şüpheli:** `module_visibility` verisi (podologie satırları silinmeli/false) veya `dashboard.js:1037-1039` mantığı; registry değişikliği tek başına yetmiyor
**Katman:** 5 (görünüm) · **Etki:** podolog kaldırılması kararlaştırılmış bir modülü görüyor; admin panelinden de düzeltilebilir

### ~~[P2] Folgetermin maskesi Befund önerisini (78030 „Vorschlag … — Grund: …“) göstermiyor; aynı kart elle yeniden seçilince çıkıyor (2026-09-30, S4-1)~~ — KAPANDI (canlı regresyon 2026-09-30 12:46–12:52Z, `5ca271c`/`ebb9063`, `dashboard.js?v=20261001k`, QA test2, fetch-guard ile yazmasız; `396000d2`→`06dbeb5c` ve `e48f89a4`→`50139501` Folgetermin maskesinde ek tık olmadan „Vorschlag: Befundung (78030) übernehmen — Grund: Eingangsbefundung ist schon erfasst …“, işaretsiz; tarih +7 / +14 değişmedi)

**Nerede:** Termin-Aktionen → Folgetermin → `#bookingModal`
**Yeniden üretme:** 1. `396000d2` (30.09, Verordnung `06dbeb5c`, 78010 klein) panelini aç → 2. Folgetermin → 3. `#bkLeistungVorschlag` gizli → 4. aynı Verordnung kartına (`06dbeb5c`, zaten seçili) tekrar tıkla
→ Beklenen: maske açılır açılmaz „Vorschlag: Befundung (78030) übernehmen — Grund: Eingangsbefundung ist schon erfasst …“ (`termin-folge.js:19-22` yorumu bunu vaat ediyor) · → Gerçekleşen: öneri yok; 4. adımdan sonra görünür. `e48f89a4`’te de (`50139501`) yok
**Kanıt:** DOM ölçümü, `#bkLeistungVorschlag` hidden; kart tekrar seçilince görünür
**Şüpheli:** `module/termin-folge.js:114-187` `oeffneFolgetermin` — `selectVerordnung` içindeki `schlageBefundungVor()` (`dashboard.js:3072`, await edilmiyor) sonucu, maske açılışında `module/termin-leistungen.js:785-790` MutationObserver’ın `setzeLeistungenZurueck()` (`_vorschlag = null`) çağrısıyla siliniyor olabilir (hipotez, doğrulanmadı); `setzeLeistungen` sonrası `schlageBefundungVor()` yeniden çağrılmıyor
**Katman:** 3 (Termin/Leistung) · **Etki:** podolog en sık adımında 78030’u hatırlatılmıyor → Befundung eksik planlanır

### ~~[P2] Tagesbehandlung: 78010 gerekçesi „Behandlungsposition laut Verordnung“ diyor, hemen üstteki satır „keine Position auf der Verordnung erfasst — vorbelegt: 78010“ (2026-09-30, S4-1)~~ — KAPANDI (canlı regresyon 2026-09-30 12:46–12:52Z, `5ca271c`/`ebb9063`, `dashboard.js?v=20261001k`, QA test2, fetch-guard ile yazmasız; `50139501` 78010 yanında „— Standardposition (keine Position auf der Verordnung)“; zweiter-Behandlungstag Rückfrage hâlâ „am 30.09.2026“ (datum.js geçişi sağlam), Zurück → yazma yok)

**Nerede:** `podologie-billing` → Verordnung `50139501` (heilmittel_position NULL, heilmittel „Podologische Komplexbehandlung“, DG DF)
**Yeniden üretme:** Behandlungen → `50139501` seç → HPNR kutuları
→ Beklenen: gerekçe kaynağı doğru adlandırsın (DG’den türetilen varsayılan) · → Gerçekleşen: iki satır birbirini yalanlıyor
**Şüpheli:** `module/podo-vorbelegung-grund.js:73` (`code === rezeptPosition` → „laut Verordnung“); `rezeptPosition` `module/podologie-abrechnung.js:406-410` → `behandlungspositionVorschlag` DG yedeğinden (`module/podo-behandlungsposition-regel.js:55`) geliyor
**Katman:** 4 (Belege) · **Etki:** yanlış kaynağı gösteren gerekçe; OCR yanlış okuma kontrolünün amacını bulandırıyor. Domain metni `podoloji`’ye

### ~~[P2] Patientenpost (`b2c`) tablosu hiç çizilmiyor — `ReferenceError: leadStatusBadge is not defined` (2026-09-30, S4-1 turu yan bulgu, eski)~~ — KAPANDI (canlı regresyon 2026-09-30 12:46–12:52Z, `5ca271c`/`ebb9063`, `dashboard.js?v=20261001k`, QA test2, fetch-guard ile yazmasız; Patientenpost 3 satır, `badge badge-gray`, konsolda `leadStatusBadge`/ReferenceError yok. P3 gözlem: rozet ham durum değerini „new“ gösteriyor (Almanca etiket yok))

**Nerede:** sidebar Patienten → Patientenpost
**Yeniden üretme:** panele geç → konsol
→ Beklenen: hasta listesi · → Gerçekleşen: `renderB2C` (`dashboard.js:11505`) atıyor, tablo boş
**Şüpheli:** `dashboard.js:11505` — `leadStatusBadge` `bdb4f2b` (14.08.2026) ile silinmiş, çağrı kalmış. S4-1 regresyonu değil; S4-1 bu paneli „Patienten“ grubuna taşıdığı için daha görünür oldu
**Katman:** 5 · **Etki:** Patientenpost kullanılamıyor (podoloji dışı öncelik)

### ~~[P2] Leitsymptomatik a) + Heilmittel 78010: maske ipucu hâlâ „folgt „Hornhautabtragung“ — das Heilmittelfeld wurde von Hand geändert“ diyor (2026-09-30)~~ — KAPANDI (`765c9ed`, canlı regresyon 2026-09-30 12:13–12:25Z, `dashboard.js?v=20261001h`, `verordnung-podo.js?v=20261001h`; kalan P3 → anomali kutusu)

**Nerede:** `verordnungen` → podo Verordnung maskesi (Muster-13), Heilmittel alanının altındaki ipucu satırı
**Yeniden üretme:**
1. QA tenant, Verordnungen → `06dbeb5c` (LS a) işaretli) satırına tıkla
2. Heilmittel alanına „78010“ yaz, öneri listesinden „78010 Podologische Behandlung (klein)“ seç, Tab
3. „Verordnung prüfen“
→ Beklenen: karar 30.09 (Reform 6a, `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md`): 78010 a/b/c için geçerli pozisyon → „folgt Hornhautabtragung“ uyarısı yok
→ Gerçekleşen: Prüf kutusu „Die Angaben passen zusammen.“ ✓, alanda ⚠ yok ✓; **ama** ipucu satırı „Aus der Leitsymptomatik a) folgt „Hornhautabtragung“ — das Heilmittelfeld wurde von Hand geändert.“ kalıyor (LS/HM change olayı yeniden tetiklenince de). 78020 seçilince satır „78020 ist nur bei … (FAK Podologie Q25)“ metnine dönüyor — satır canlı hesaplanıyor.

**Kanıt:** DOM metni (yukarıda), konsol temiz (yalnız bilinen gürültü)
**Şüpheli:** `module/verordnung-podo.js:320-323` — `if (!unser) return hm.value.trim() === text ? meldung : { text: 'Aus der Leitsymptomatik … folgt „${text}“ — das Heilmittelfeld wurde von Hand geändert.' }` düz metin eşitliği. `047baab` yalnız `verordnung-pruefung.js`'i `POD_HEILMITTEL_KATALOG` üzerinden Maßnahme karşılaştırmasına çevirdi, bu dosyaya dokunmadı; aynı eşleme (78010 → a/b/c, 78020 → yalnız c) burada da gerekli.
**Katman:** 2 (Verordnung erfassen)
**Etki:** podolog doğru girilmiş her 78010'lu reçetede „von Hand geändert“ uyarısını görür — karar metninin gerekçesi aynen: hep çıkan uyarı gerçek olanın da görmezden gelinmesine yol açar.

### ~~[P1] Public Termin-Anfrage (`booking-request.html`) boş sayfa — sihirbaz init'i `DOMContentLoaded`'ı kaçırıyor (2026-09-30)~~ — KAPANDI (`bd71bbf`, canlı regresyon 2026-09-30: 5/5 „Schritt 1 von 7“, konsol temiz, ICD/DG araması + DG→Heilmittel filtresi bağlı — bkz. Online-Buchung kaydı)

**Nerede:** `https://app.praxura.de/booking-request.html?business=<owner_id>` (hasta tarafı, oturumsuz)
**Yeniden üretme:**
1. Sayfayı taze aç (QA owner `c4fbded4…` ile), 3–5 sn bekle
→ Beklenen: „Schritt 1 von 7“ + progress bar
→ Gerçekleşen: yalnız header + footer; `#progressBar` hidden, tüm `.br-step` `display:none`. 5/5 tekrar. Konsol temiz (sessiz arıza).

**Kanıt:** Elle `document.dispatchEvent(new Event('DOMContentLoaded'))` → sihirbaz anında açılıyor ⇒ `init` dinleyicisi olaydan sonra kaydediliyor.
**Şüpheli:** [booking-request.js:1294](booking-request.js#L1294) `document.addEventListener('DOMContentLoaded', init)` — modül [supabase-config.js:2-3](supabase-config.js#L2-L3) top-level `await fetch('/api/config')` içeren modülü import ediyor ([booking-request.js:13](booking-request.js#L13)), bu yüzden gövde DCL'den sonra koşuyor. Aynı kalıp inline modülde: [booking-request.html:671](booking-request.html#L671) (ICD/DG/Heilmittel araması da bağlanmıyor). Karşılaştırma: [dashboard.js:18647](dashboard.js#L18647) `if (document.readyState === 'loading') … else …` ile korumalı.
**Düzeltme yönü (öneri, karar builder'da):** iki yerde de `readyState` koruması (dashboard.js kalıbı). Başka TLA-import + DCL kullanan sayfa taraması önerilir.
**Katman:** 2 (Termin/Anfrage girişi)
**Etki:** hasta praxis'in Termin-Anfrage linkinden talep gönderemiyor; alternatif yol `booking.html?u=` (doğrudan rezervasyon). Canlı müşteri henüz yok.

### ~~[P1] Yeni/düzenlenen Verordnung açık listede ve Patientenakte’de görünmüyor — `signal.js` iki farklı `?v=` ile iki ayrı örnek (2026-09-30)~~ — KAPANDI (`9d4b057`, canlı regresyon 2026-09-30: tek `signal.js` örneği, liste/Akte/abrechnungsstatus/`dashboard.js:1938` dinleyicisi anında güncelleniyor — bkz. Muster-13 kaydı)

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
