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

---

## Bildirilen anomaliler

Format: `TARİH · bildiren ajan · ekran/panel · gözlem (tek cümle, hasta verisi yok)`

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

---

## builder'a devredilenler

_Şu an açık devir yok._ Son giriş (aşağıda kapatılmış olarak tutuluyor — geçmiş kaydı
olarak, aynı semptom üçüncü kez çıkarsa buraya bakılır).

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
