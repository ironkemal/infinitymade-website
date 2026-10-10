# Funktionskarte — projedeki her fonksiyonun haritası

`db/` klasörünün koda uygulanmış hâli. `db/` "hangi tablo var"ı, burası **"hangi fonksiyon
var, nerede kullanılıyor, neyle besleniyor"**u tutar.

## Neden var

`dashboard.js` 24.000+ satır; projede 1700'den fazla fonksiyon var. "Böyle bir şey zaten var
mı" sorusu okuyarak cevaplanamaz — hiçbir model bu hacmi tek seferde kapsayamaz, okur ve
**makul ama eksik** bir cevap üretir. Bu klasör o soruyu okumaya değil **saymaya** çevirir.

Somut sebep: 12.08.2026 beta görüşmesinde aynı işin iki ayrı yerde ayrı kodla yapıldığı
görüldü (Fußbefund iki yerden kaydediliyor, Zuzahlungsbefreiung dört ayrı yoldan yazılıyor).
Bunlar tek tek bug değil, **bir kalıp**. Kalıbı görmek için envanter gerekiyordu.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `INDEX.json` | Makine okuru. Her fonksiyon: dosya/satır, dokunduğu tablolar, yazma işlemleri, çağırdıkları, **onu çağıranlar**, hangi sidebar modülünden erişilebildiği, tıklama yolu. |
| `INDEX.md` | İnsan okuru. Kopya adayları, en çok yazılan tablolar, çift isimler. |

İkisi de **üretilir, elle düzenlenmez.** Yanlış varsa düzeltilecek yer
`tools/funktionskarte.mjs`, çıktı değil.

## Tazeleme

```bash
node tools/funktionskarte.mjs
```

**Kural:** fonksiyon eklendiğinde, silindiğinde veya taşındığında harita aynı commit'te
tazelenir. Tetikleyici cümle: **"harita güncelle"**.

Eski harita hiç haritadan kötüdür — okuyan ona inanır. `db/README.md`'deki şema tazeleme
kuralıyla aynı gerekçe.

## Kopya adayları nasıl okunur

`INDEX.md`'deki her küme, **aynı tabloya yazan ama birbirini çağırmayan** kod yollarını
gösterir. Bu bir suçlama listesi değil, **inceleme kuyruğu.**

Bu projede bilinçli bir katmanlama var ve script onu ayırt edemez:

- ✅ **Doğru:** ortak taban + üstüne binen alan bloğu (podolojide ayak şeması), ya da tek
  uygulamanın parametreyle daraltılması (`attachDiagnoseSearch(..., { strict: true })`)
- ⚠️ **ARTIK GEÇERSİZ (04.09.2026):** "iki veri havuzu kasıtlıdır, birleştirme kırar"
  maddesi kalktı. Kemal'in kararıyla podoloji `verordnungen`'den `prescriptions`'a taşındı
  (hedef: 9 kolon / 7 satır / 72 kod noktası — 47 / 242 / 168 yerine). Podolojinin kendi
  kelime dağarcığı (`lead_id`, `behandlungseinheiten`, `therapiefrequenz`, `dringend`,
  `icd10` dizisi, aktiv/abrechenbar/abgesetzt durum ekseni) sıfırdan yeniden yazılmadı;
  arada **`module/verordnung-topf.js`** sınır modülü duruyor (`ausTopf`/`inTopf`,
  `statusAusTopf`/`statusInTopf`, `fuehrtSitzungsbuch`). Yani `prescriptions`'a iki farklı
  kelimeyle yazan yolları görürsen bu kopya değil, **çeviri katmanıdır.**
  ⚠️ `api-backend/billing/utils/einreichbar.js` içindeki `statusAusAbrechnungStatus` /
  `abrechnungStatusAusStatus` bu modülün **bilinçli aynasıdır** (`SPIEGEL` yorumlu):
  Docker imajı `module/`'ü içermediği için paylaşılamıyor. Biri değişirse ikisi değişir.
- 🔴 **Kopya:** aynı iş için ikinci kez sıfırdan yazılmış kod
- 🔴 **Veri riski:** aynı tabloya farklı kurallarla yazan yollar (biri `onConflict` kullanıyor,
  diğeri kullanmıyor gibi)

Karar `fonksiyon-ustasi` ajanında; şüpheli olan kullanıcıya **tıklama yoluyla** sorulur,
sessizce birleştirilmez.

## Bilinen sınır

`uiPfad` alanı, `dashboard.js`'teki `if (id === '...')` modül yönlendiricisinden ileriye
doğru çağrı grafiğiyle hesaplanır. Olay dinleyicisiyle bağlanan fonksiyonlar bu zincirin
dışında kalıp "UI yolu çözülemedi" görünebilir; çok yerden çağrılan yardımcılar da
`gemeinsam: true` ile işaretlenir. Kullanıcıya verilecek ekran tarifi bu alandan körü körüne
kopyalanmaz, `canli-test` ile doğrulanır.

### ⚠️ `calledBy: []` "ölü kod" demek DEĞİLDİR (08.09.2026'da ölçüldü)

Express route gövdeleri `router.post('/x', async (req, res) => { … })` biçiminde **isimsiz**
argüman fonksiyonlarıdır; üretici onları hiç kayda almaz. Dolayısıyla **yalnızca bir
route'tan çağrılan backend fonksiyonu haritada `calledBy: []` görünür.**

Ölçülen örnek: `api-backend/billing/api/abrechnung.routes.js` — dosyada 30'dan fazla route
var, haritada 17 kayıt, hiçbiri route gövdesi değil. Bu yüzden `buildDtaFile` (gerçekte 2
çağrı yeri), `ladeAnnahmestelle` (4) ve `annahmestelleFehlt` (3) çağrılmıyor görünür.

**Backend fonksiyonu için "ölü kod / silinebilir" hükmü `calledBy`'a bakılarak verilmez** —
ham grep ile doğrulanır. Frontend tarafında bu sorun yok, import zinciri çözülüyor.

### `endpoints[]` yalnız `fetch()` içindeki düz metni görür

Adres bir değişkende duruyorsa (`const URL = '…'; fetch(URL, …)`) alan **boş** kalır.
Örnek: `module/podologie-dateieinheit.js` → `ladeDateieinheiten()` gerçekte
`POST /billing/abrechnung/annahmestellen` çağırır, haritada `endpoints: []`.

"Bu ekran hangi backend yolunu çağırıyor" sorusu bu alandan tek başına cevaplanmaz;
`grep "n8n.infinitymade.de"` ile tamamlanır.

### `kopieKandidaten` yalnız YAZAN yolları sayar — çizen kopyalar görünmez (18.09.2026'da ölçüldü)

Üretici, kopya adaylarını `writes[]` alanından (tablo başına bağımsız insert/update/upsert/
delete yolu) çıkarır. Bu yüzden **salt-okunur iki render yolu asla kuyruğa girmez**, aynı
DOM'u iki ayrı şablonla doldursalar bile.

Ölçülen olay — Ops #308, sağdaki Termin-Panel'i (`#bkActionModal`) iki giriş doldurur:
`openBookingActionModal` (dashboard.js:3223, 477 satır) ve `zeigePatientOhneTermin`
(module/termin-panel-patient.js:135, 54 satır). İkisi de hiçbir tabloya yazmaz; harita
ikisini de "kopya adayı" saymadı, ikinci yol dokuz ay boyunca birinci yolun bloklarının
çoğunu hiç çizmeden yaşadı. Aynı denetimde `bkVerordnungSection`'ın panelden değil
`#bookingModal`'dan geldiği de yalnız DOM id'lerini elle sayarak bulundu.

**Kural:** "aynı ekranı kaç yol çiziyor" sorusu `kopieKandidaten`'dan cevaplanmaz. Aynı
`getElementById('…')` kimliğine dokunan fonksiyonları say — bugün elle, `INDEX.json`'daki
`start`/`end` aralıklarını dosya gövdesinde tarayarak. Üreticiye bir `domIds[]` boyutu
eklenene kadar bu boşluk açık.

## Niyet kaydı — haritanın göremediği "niye"

Harita bir fonksiyonun *ne* olduğunu tutar, *niye* yazıldığını/değiştirildiğini tutmaz.
Builder/oturumlar yazdıktan sonra bildirir (CLAUDE.md → "sor **ve** bildir"); kısa kayıt buraya.
En yeni üstte. Satır numarası yazılmaz — harita onu tutar.

### 10.10.2026 · Akte: Drucken-Menü an der Verordnungskarte, Verordnung-Häkchen im vorbefüllten Entwurf (cd4219f7)
- `module/rechnung-zur-verordnung.js` `druckenMenueHtml` + `verdrahteDruckenMenue` — „Drucken ▾" menüsünün **tek
  kaynağı** (HTML + aç/kapa/dış tıklama/öğe tıklaması). Önce `loadPatientDetailRezepte` içinde inline idi; o liste
  podolojide `display:none !important` ile gizli olduğundan menü podolojide ekranda yoktu. İkinci kopya yerine
  çıkarıldı. Kullanım: dashboard.js Rezeptliste + `module/verordnung-uebersicht.js` `karteHtml` (yalnız
  `deps.onBeleg` verilince). **Üçüncü bir Drucken menüsü yazılmaz** — bu ikisi çağrılır.
- dashboard.js `belegOeffnen(rxId, typ, leadId)` — menü öğesinin `oeffneRechnungZurVerordnung` / `oeffneBelegDruck`
  dağıtımı; deps dashboard.js değişkenlerine bağlı olduğu için orada. Çağıranlar: Rezeptliste +
  `renderPatientenkarte` deps `onBeleg`.
- `module/podologie-abrechnung.js` `ladePodVerordnung(sb, id)` + `_podState.nachgeladen` (Map), `findVord` üçüncü
  kaynak. Niye: `_podState` yalnız Podologie-Abrechnung paneli açılınca doluyordu; Akte'den „Rechnung" boş editöre
  düşüyordu. İlk kullanım: `oeffneRechnungZurVerordnung` opsiyonel dep, `podVerordnungVorhanden`'dan önce.
  ✅ (aynı gün, sonraki commit) Geldzeile yolu: `rechnungAusVerordnung` artık `await ladePodVerordnung` kullanıyor. Eski not: Geldzeile yolu nachladen yapmıyordu; panel hiç
  açılmadıysa `starteRechnungAusVerordnung` `if (!verordnung) return` ile **sessizce** döner. Tek yerde kapanır:
  dashboard.js `rechnungAusVerordnung` içinde `getPodVerordnung` yerine `await ladePodVerordnung(supabase, …)`.
  **Açık (küçük):** `nachgeladen` oturum boyu geçersizlenmez — Verordnung sonradan değişirse (rezeptart → BG) bayat
  kopya zahlertyp/BG kontrolüne girer.
- `module/rechnung-verordnung.js` `verordnungVormerken(vordId, behandlungIds)` — `verordnungAuswahlLeeren`'in
  karşılığı: `onAuswahl` tetiklemeden kutucuk durumunu kurar (canli-test P3: ön doldurulan taslakta Verordnung
  işaretsizdi). Tek çağıran: dashboard.js `rechnungAusVerordnung` → `setzeEntwurf`.
- `verordnungAuswahl()` artık `podoBehandlungIds` döndürür; dashboard.js `onAuswahl`: `invVerordnungId` doluysa
  `invBehandlungIds` kutucuk seçimini izler (faturada olmayan Behandlung abgerechnet bağlanmasın). Elle yolda
  değişmedi. ✅ (1) kapandı: dönüş artık `podoBehandlungIdsJe` (Verordnung başına), `onAuswahl` yalnız `invVerordnungId`'ninkini alır. Eski not: `podoBehandlungIds` **tüm** işaretli podo Verordnung'ları toplar, `invVerordnungId`'ye
  süzülmez — ikinci Verordnung işaretlenirse `invoices.verordnung_id` A, bağlanan Behandlung'lar A+B. (2) Satır
  tablodan elle silinirse `invBehandlungIds` izlemez. (3) Elle yolda podo Behandlung hiç bağlanmaz (eski davranış).
- `ladeAktiveVerordnungen` dönen nesnelere `rezeptart` eklendi (eklemeli; `druckenMenueHtml` için).

### 09.10.2026 · 3b.4 Merkez KI jeton ucu (`POST /v1/ki/jeton`)
- `api-backend/merkez-istemci/ki-bericht-schema.js` (yeni): `pruefeKiBericht`, `kiBerichtHash`, `KI_TASKS`,
  `RE_REPORT_ID`, `RE_UTC_DAY` — kutu↔merkez KI kullanım raporu sözleşmesinin (M4-VERTRAG §2.2) **TEK şeması**,
  bilerek import'suz (VPS sparse-checkout'a tek dosya ekler). İlk kullanım: `merkez/server.js` `/v1/ki/jeton`.
  **Açık (karar Melih/kullanıcı):** `ai/ki-jeton.js` `validateReportSnapshot` bu şemaya geçmeli (KHS M4
  "Hat K → Hat M notları"); bilinen task listesinin üç kopyası (`ai/ki-jeton.js` `ALLOWED_TASKS`,
  `ai/ki-privacy.js` `KNOWN_AI_TASKS`, `ai/router.js` `TASKS` anahtarları) burada birleşebilir. Yeni bir
  task listesi açılmaz.
- `merkez/ki-jeton.js` (yeni): `kiConfigAusEnv`, `erstelleKiEntra`, `monatsSchluessel`,
  `naechsterMonatsanfangBerlin`, `tokenFingerabdruck` — merkezin Entra client_credentials istemcisi (repodaki
  ilk ve tek), KI env config'i, Berlin ayı/kota sıfırlama. Yalnız `merkez/server.js` + `merkez/admin.js` kullanır.
  Berlin hesabı `api-backend/lib/berlin-tag.js` `berlinHeute` üzerinden — ikinci bir `Intl` kopyası yazılmaz.
- `merkez/db.js` `ki*` metotları + `merkez/admin.js` komutları `ki-an` / `ki-aus` / `ki-limit` / `ki-global` /
  `ki-stand` (hepsi adminlog'a).
- **Kural:** kutu↔merkez sözleşmesine dokunan her değişiklikte `merkez/test/ki-jeton-vertrag.test.js` koşulur
  (gerçek `createJetonClient` ile uçtan uca).

### 08.10.2026 · O-178 / K2b.16 „Über diese Software" (Lizenzen, Verbindungen, Rechtslinks in der Box)
- `api-backend/tools/lizenzen-erzeugen.mjs` (yeni): `bewerteLizenz`, `sammlePakete`, `pruefe`, `erzeugeBericht` —
  imajdaki `node_modules`'un lisans kapısı + THIRD-PARTY-NOTICES üretimi; boş/UNKNOWN/yasak lisansta build kırılır.
  İlk kullanım: `api-backend/Dockerfile` RUN. **O-42 izinli/yasak lisans listesinin TEK yeri burası** — başka
  bir yerde ikinci liste açılmaz. `tools/vendor-lizenzen.mjs` aynı fonksiyonları import ederek `vendor/` + fonts
  için `vendor/LICENSES.txt` üretiyor (kopya değil, yeniden kullanım — doğrulandı).
- `api-backend/lib/verbindungen.js` (yeni): `verbindungenListe` — kutunun dış bağlantı listesi env'den
  (MERKEZ_URL, CADDY_TLS_MODUS, AI_MODE, SMTP_HOST). **Yeni bir dış bağlantı eklenen her iş buraya da yazar**,
  yoksa sayfa eksik beyan eder (G1). `AI_MODE`'u okuyan İLK kod — M4.1/M4.11 aynı değer adlarını
  (`aus`/`direkt`/`jeton`) kullanmalı. Kutu tespiti `lib/dagitim.js` `istKutu()` üzerinden, ikinci tespit yok.
  İlk kullanım: `routes/ueber.js`.
- `api-backend/routes/ueber.js` (yeni): `/api/ueber` (sürüm), `/ueber/verbindungen`, `/ueber/lizenzen` — yalnız
  kutu + `requireAuth` (ai/auth.js) + rate limit. Sürüm `IMAGE_VERSION || 'dev'` (`/health` ile aynı ifade).
- `module/ueber.js` (yeni): `ueberSeiteStarten` (`ueber.html`) · `rechtslinksFuerKutu(istKutu)` — kutuda
  `data-rechtslinks` işaretli Impressum/Datenschutz bloğunu „Über diese Software" linkine çevirir. Kullanım:
  `login.js` (eski `#saasFooter` `.remove()` satırının YERİNE geçti, iki mekanizma yok), `confirm.html`,
  `employee-signup.html`. Yeni bir public sayfada aynı alt satır varsa `data-rechtslinks` + bu çağrı — ikinci
  bir kutu-link mantığı yazılmaz. `RECHTEVERMERK = null` bilinçli yer tutucu (KHS §5b T21).

### 06.10.2026 · K2b.11 Kurulum jetonu URL-Fragment'te (commit 85d463e7)
- `module/setup-fragment.js` (yeni): `jetonAusHash(hash)` — saf; URL hash'inden hex kurulum jetonu (16–128 karakter)
  çıkarır, uymazsa boş. Ayrıca modül yüklenirken **yan etkili** `export const fragmentJeton`: `location.hash`'i okur,
  `history.replaceState` ile adresten siler. Niye: jeton praksise gösterilmesin (K-19 h). **`setup.js`'in İLK
  import'u olmak zorunda** — `supabase-config.js` yüklenirken fetch atıyor, jeton ondan önce adresten silinmeli
  (guvenlik S-48). Import sırasını değiştiren, bu modülü başka bir import'un arkasına alan bu korumayı kırar.
  Nerede: yalnız `setup.js` (kutuya özel sayfa).
- `setup.js` `pruefeJeton(token)` (yeni): eski submit handler'ın gövdesi çıkarıldı; link (fragment) ve form aynı
  yoldan doğrular. Jeton doğrulaması için ikinci yol yazılmasın.
- Kopya kontrolü: hash'ten jeton/parametre okuyan ortak bir yardımcı haritada yok — kopya değil.

### 06.10.2026 · K2b.6 Kutu IP eşitlemesi (ad ≤15 dk içinde yeni iç IP'ye)
- `api-backend/merkez-istemci/ip-abgleich.js` (yeni): `starteIpAbgleich()`, `ipAbgleichSchritt()`, `istGueltigesIpv4`,
  `istRfc1918`, `erzeugeZustand`. Niye: kutunun iç IP'si değişince adın A kaydı ≤15 dk içinde yeniden doğru yeri
  göstersin (K2b.6). Nerede: `server.js` açılışında `starteIpAbgleich()` (`scheduleAttendanceAutoClose` kalıbı);
  yalnız kutuda iş yapar — `MERKEZ_URL` yoksa (SaaS) hiçbir şey yapmaz. `ipAbgleichSchritt` testlerin sürdüğü tek
  tick. Taşıyıcı var olan `merkezFetch` — merkeze ikinci bir fetch yolu yazılmadı.
- `onprem/lib-ip.sh` (yeni): `lan_ip_ermitteln`, `ist_rfc1918` `install.sh`'tan buraya taşındı (K2b.5b kaydındaki
  "ikinci IP tespiti yazma" notunun karşılığı). Kullananlar: `install.sh` (`source`) + `onprem/ip-melden.sh` (host
  zamanlayıcısı, yeni). Kutu tarafında IP tespiti için **tek yer budur.**
- `ip_timer_einrichten` (`onprem/install.sh`, yeni). Niye: host zamanlayıcısını kurar. Nerede: `install.sh`; ileride
  `update.sh`'tan da çağrılacak — orada yeniden yazılmasın, bu fonksiyon `lib-ip.sh`'a ya da ortak bir dosyaya
  taşınarak paylaşılsın.
- 🟡 **Kopya adayı — bilinçli ayrı, birleştirilmedi (karar sonra):** IPv4 doğrulama/RFC1918 kuralı **üç yerde**:
  `merkez/ip.js` `parseIpv4`/`klassifiziereIpv4` (merkez dağıtımı) · `ip-abgleich.js` `istGueltigesIpv4`/`istRfc1918`
  (kutu imajı) · `lib-ip.sh` `ist_rfc1918` (host bash). Gerekçe: kutu imajı `merkez/`'i içermez, bash JS'i çağıramaz.
  06.10'da karşılaştırıldı, kurallar şu an **aynı** (öndeki sıfır reddi, 10/8 · 172.16/12 · 192.168/16). Kural
  değişirse (ör. CGNAT kabulü) üçü birden güncellenir. Küçük fark: JS `istRfc1918` ve bash `ist_rfc1918` biçim
  doğrulamaz — JS'te `istGueltigesIpv4` önce çağrıldığı için sorun değil; bash'te girdi `ip` komutundan geliyor,
  merkez L1 kuralıyla zaten reddeder.
- ⚠️ Kör nokta (K2b.5b'deki gibi): `*.sh` ve `merkez/` haritada taranmaz — `lib-ip.sh`, `ip-melden.sh`,
  `ip_timer_einrichten` ve `merkez/ip.js` INDEX.json'da yok, tek kayıt burası. `starteIpAbgleich`'in `calledBy`'ı
  haritada boş görünür; çağrı `server.js`'te üst düzey (fonksiyon dışı) — ölü kod değil.

### 06.10.2026 · K2b.5b Kayıt durumu, volume sahiplik mesajı, yerel sahte merkez, LAN-IP yardımcıları
- `durum({kimlikDir})` (`api-backend/merkez-istemci/kayit.js`). Niye: `install.sh` yeniden çalıştığında (`--neu` vb.)
  kurulum kodunu ikinci kez harcamasın — ağsız/kodsuz `{registriert, ad, fqdn}` döner, anahtar dönmez. Nerede:
  `kayit.js --durum --json` ← `install.sh` adım 4 + 13.
- `wrapFsFehler(dir, fn)` (`kimlik.js`, iç yardımcı). Niye: EACCES/EPERM'i "Volumes vorbereiten: install.sh erneut
  ausführen" mesajına çevirir (K13 sahiplik tuzağı). Kimlik dizinine yazan dört yol (`erzeugeKimlik`, `schreibeNeu`,
  `speichereAd`, `uebernehmeNeueKimlik`) bunun üzerinden geçer — yeni yazan yol eklenirse **bunu kullan**.
  `speichereAd` artık `fqdn` da yazıyor (`durum` onu okuyor).
- `starteDevServer()`, `erstelleProtokollierendesCloudflare()` (`merkez/test/dev-server.js`, yeni). Niye: yalnız yerel
  test için sahte merkez (`MERKEZ_DEV=1`, 127.0.0.1). `merkez/test/helper.js`'teki `fakeAcmeDns` yeniden kullanıldı.
  🟡 **Kopya adayı (birleştirilmedi, karar sonra):** `erstelleProtokollierendesCloudflare` ↔ `helper.js` `fakeCloudflare`
  — aynı sahte, biri log basıyor. Olası tek yol: `fakeCloudflare({ log })` parametresi. Yalnız test kodu, veri riski yok.
- `lan_ip_ermitteln`, `ist_rfc1918` (`onprem/install.sh`, bash). Niye: adım 17'deki IP tespiti tek yere çekildi;
  K2b.6 zamanlayıcısı da bunu kullanacak — **ikinci IP tespiti yazma.**
- ⚠️ Kör nokta: `merkez/` haritanın `SCAN_ROOTS`'unda yok (06.10'da INDEX.json'da 0 kayıt), `*.sh` hiç taranmaz. Bu
  yüzden dev-server, helper ve install.sh yardımcıları INDEX.json'da görünmez — tek kayıt burası. `merkez` kapsama
  alınacaksa düzeltme `tools/funktionskarte.mjs`'te yapılır.
### 06.10.2026 · KHS M2 (M2.1–M2.8) — Rezeptart-Umschalter, BG, Branding/Stempel, Einrichtungsring (8967ecc d2da247 6757809 09266f3 e14697a 9726ebc 329fc99 bfae06f)
- **`module/rezeptart.js`** (M2.1) — Werteliste `kassen|privat|selbstzahler|bg`, `gkv`/NULL→`kassen`, Vorauswahl, Sperrmeldung.
  Niye: tek yazım değeri. **`module/rezeptart-umschalter.js`** — Muster-13 maskesinde "Abrechnung über" segment çubuğu
  (`data-rezeptart`). Backend aynası: `api-backend/lib/rezept-felder.js` `artFelderAusRezept`/`rezeptartWechselPruefen`
  (ARTEN listesi ön yüz REZEPTARTEN'in aynası — bilinçli çift). İlk kullanım: `dashboard.js` `fillRzPatientFromLead`/
  `saveRezept`, `verordnung-maske.js`. ⚠️ Okuyucular toleranslı bırakıldı → **ayna adayları** (`|| 'kassen'` kopyaları):
  `verordnung-podo.js`, `podologie-abrechnung.js`, `rechnung-bruecke.js` `istPrivatRezeptart`, `abrechnung-auswahl.js` (2×),
  `verordnung-uebersicht.js`. `rezeptinfo-geld.js` `zahlerTyp` bg→'privat' daraltır (gkv/privat ekseni, katman — kopya değil).
- **`module/bg-angaben.js`** (M2.2) — `BG_FELDER`, `bgAusWerte`, `bgFehltFuerRechnung`, `bgHinweiseBeimSpeichern`,
  `bgEmpfaengerBlock`, `bgAusZeile`, `bgAusMaske`, `bgInMaske`. Niye: BG-Verordnung yalnız dolu alanlarla (PE-006 B),
  Pflicht "Träger + Unfalltag" Rechnung başlatırken. Backend aynası: `rezept-felder.js` `bgFelderAusRezept`/
  `bgAenderungGesperrt`/`bgFehltFuerRechnung` (bilinçli ayna, iki BG_FELDER listesi). İlk kullanım: `verordnung-maske.js`
  `nutzlastAusMaske`, `rechnung-bruecke.js` `starteRechnungAusVerordnung`, `rechnung-ansicht.js` `openInvView` +
  `billing/pdf/rechnung.template.js` (alıcı = UV-Träger). `booking_requests.bg_name/bg_aktenzeichen` ayrı tablo — birleştirme.
- **`module/rechnung-bruecke.js`** — `zahlertypAusRezeptart` (bg artık 'bg', `invoices_invoice_type_check` zaten izinli),
  `PRIVAT_ANZEIGE` (78010/78020 düz metni, yalnız fatura satırı; öncelik `services.title` > PRIVAT_ANZEIGE > katalog —
  `GKV_LEISTUNGSKATALOG`/`heilmittel_katalog` başlıklarının yerine geçmez, katman), `behandlungenVerknuepfen` isabet sayar
  (RLS 0-satır tuzağı, M2.3).
- **`module/branding.js`** (M2.4) — `brandingAus`, `brandingLuecken`, `terminzettelPraxis`, `BRANDING_SPALTEN`,
  `STEMPEL_PFAD_RE`. Niye: belge başlığının TEK kaynağı (logo yalnız https, S-49; plz||zip). `dashboard.js`
  `terminzettelPraxis` artık ince sarmalayıcı (owner||current). **Kalan ayna adayları:** `beleg-druck.js`
  `ladePraxisAbrechnungsProfil` (+ `fehlend` §14 UStG listesi ↔ `brandingLuecken` ↔ backend `fehlendePflichtangaben`),
  backend `abrechnung.routes.js` `PRAXIS_DRUCK_FELDER` + praxis nesnesi, `ausfall.routes.js` select + praxis nesnesi.
- **`module/stempel.js`** — `stempelHochladen`/`stempelEntfernen` (owner satırı, `praxis_stempel_path`, private bucket),
  `ladeStempelDataUrl` (belgeye data-URL), `kodiereAlsPng`, `zielGroesse`. **`module/branding-ui.js`** `mountBrandingExtras`
  (Stempel, Inhaber `praxis_inhaber`, "Was fehlt noch"). Görüntü yeniden kodlamanın üçüncü yolu: logo kaydı
  (`dashboard.js` `initBrandingLogoUpload`, cropper→PNG, `avatars`) ve avatar (`dashboard.js` cropper→JPEG 400) dokunulmadı.
- **`module/einrichtung-fortschritt.js`** `einrichtungFortschritt`, `ringStrich` + **`module/einrichtung-ring.js`**
  `mountEinrichtungRing` (M2.6) — kopf çubuğunda kurulum halkası. Uygulamadaki ilk halka bileşeni (öncesi yalnız
  çubuklar: `zeichneRezeptFortschritt`, `booking-request.js` `buildProgressBar`). Halka/ilerleme lazımsa **bunu kullan**.
- **`api-backend/setup/branding-felder.js`** `brandingFelderPruefen` + `POST /setup/branding` (M2.5) — kurulum asistanının
  atlanabilir Branding adımı, 11 kolon beyaz liste + biçim kuralı.
- **`module/einwilligung-texte.js`** (M2.8) — `softwareSatz`, absatz filtresi `nur:'ki'`, `OPTIONALE_PLATZHALTER`.
  Datenschutztext v3 (legal-de).
- **fonksiyon-ustasi bulguları (06.10.2026, karar kullanıcıda, dokunulmadı):**
  1. 🔴 Aynı profil kolonları **farklı kurallarla** yazılıyor: `POST /setup/branding` IBAN/BIC/PLZ/IK/USt-IdNr biçimini
     doğruluyor; Einstellungen `profileSaveBtn`/`billingSaveBtn` (`dashboard.js`) aynı kolonları doğrulamasız `|| null`
     yazıyor ve `currentSession.user.id` satırına (owner değil). IK için üçüncü yol `abrechnung-einstellungen.js` `ikSaveBtn`
     (9 hane kontrolü var).
  2. 🟠 `brandingAus`'u atlayan okuyucular (https filtresi + owner fallback devre dışı): `dashboard.js` Terminzettel/
     Behandlungsbestätigung çağrılarında `logoUrl: currentProfile?.praxis_logo_url` (3 yer), `getVorlagenSampleHtml`;
     `rechnung-ansicht.js` başlık meta (street/plz/phone/ik) ve alt bilgi (bank/iban/steuer) hâlâ `currentProfile`'dan.
  3. 🟡 Cropper iki kopya (`dashboard.js` avatar ↔ logo) + `stempel.js` `kodiereAlsPng` = canvas→blob üç yerde.
- Harita bfae06f'de üretildi (3016 kayıt). ⚠️ Kısa yardımcı adlarda (`t`, `esc`, `zeile`) `calledBy` ad çakışmasıyla şişik.

### 06.10.2026 · K2b.5a Kutu kaydı: kod env'den, kayıt sonrası IP, kimlik volume testi
- `codeAufloesen(o, env)` (`api-backend/merkez-istemci/kayit.js`, yeni export). Niye: kurulum kodu argv yerine
  `KAYIT_CODE` env'den gelebilsin — `ps`/log'a düşmesin. Nerede: ilk `kayit.js` `main()`; ileride `install.sh`
  `docker compose run -e KAYIT_CODE kayit`.
- `args()` aynı dosyada export edildi (yalnız test için). `kayitAusfuehren` yeni `ip` parametresi: kayıttan hemen sonra
  tek imzalı `/v1/ip` (merkez register A kaydı yazmıyor; ad ancak bununla çözülür). Taşıyıcı mevcut `merkezFetch` —
  ikinci imza/taşıyıcı yazılmadı (05.10 K2b.17 sözleşmesi korunuyor).
- `dienstBlock(text, name)` (`tools/onprem-kimlik-yedek.test.js`, export). Niye: compose servis bloğunu YAML bağımlılığı
  olmadan girintiyle okur; kimlik/acmedns volume'larının yedeğe ve yanlış konteynere girmediğini sabitler (O-161).
  Başka compose metin testi gerekirse **bunu kullan**, ikinci parser yazma. ⚠️ `tools/` haritanın kapsamı dışında —
  bu yüzden INDEX.json'da görünmez; tek kayıt burası. Haritada karşılığı yok (grep 06.10: başka compose-blok okuyucu yok).

### 05.10.2026 · K2b.17 Kutu-Identität (Ed25519) + K2b.2 Merkez-Namensdienst (07fab61)
- `api-backend/merkez-istemci/` — `signatur.js` (`signiereAnfrage`, `pruefeSignatur`, `boxIdAusPublicKey`), `kimlik.js`
  (`erzeugeKimlik`, `ladeKimlik`, `speichereAd`), `merkez-fetch.js` (`merkezFetch`), `kayit.js` (CLI). Niye: her kutu→merkez
  çağrısı için TEK kutu kimliği (Ed25519) — K-18 isim servisi, sonra Y3 3b.1 ve KI-token 3b.4/M4.11. Sözleşme KHS M4.11'de:
  **yeniden uygulanmaz**, kutu→merkez imzası hep buradan. Nerede: ilk `kayit.js` (kutu kurulumu; `install.sh` bağlantısı K2b.5),
  `merkez/` doğrulama için `signatur.js`'i import ediyor (iki tarafta ikinci imza kodu yok).
- `merkez/` — `server.js`, `db.js`, `namen.js` (`zufallsName`, `nameErlaubt`), `cloudflare.js`, `acmedns.js`, `ip.js`, `admin.js`.
  Niye: K2b.2 merkezî isim servisi (kod → okunur rastgele ad, Cloudflare A/CNAME/CAA, IP güncelleme) + acme-dns istemcisi.
  **Yalnız merkezde koşar, kutuya girmez.** Nerede: henüz deploy edilmedi (VPS kararı K3 öncesi). `calledBy: []` ölü kod değil.
- `mitarbeiter-zugang-code.js`: ikinci biçim `FORMAT_KUTU` (Crockford + kontrol karakteri, `istKutuCodeGueltig`) — ikinci
  hash/verify yazılmadı, mevcut modül genişletildi (fonksiyon-ustasi 05.10 tavsiyesi). Kopya değil, parametreli katman.

### 05.10.2026 · Kutu-Uyum K2b.15 (b54cb42)
- `schliesse(filter, label)` + `tick()` — `api-backend/server.js` `scheduleAttendanceAutoClose` iç fonksiyonları.
  `schliesse`: attendance present→incomplete, filtre parametreli; `tick`: dakikada bir, gün değişince önceki günleri,
  23:55'te bugünü kapatır. Niye: kutu PC'si gece kapalıysa 23:55 işi kaçıyordu + PM2 `-i 2` işi iki kez koşuyordu
  (artık yalnız `NODE_APP_INSTANCE` 0). Nerede: yalnız bu zamanlanmış iş.
- `kalender.js` `initCalendar`: FullCalendar resources/`resourceTimeGridDay` kaldırıldı (Premium lisans yok → MIT Standard).
  Olaylardaki `resourceId` zararsız extendedProps olarak kaldı — kopya/ölü alan sayma.

### 02.10.2026 · KHS K2 — kutu adresi/plan tek kaynak, owner şifre sıfırlama, kutuda olmayan düğmeler gizlendi
- `appBaseUrl()` (`api-backend/lib/dagitim.js`). Niye: kutuda sunucunun ürettiği linkler (mail, OAuth redirect)
  app.praxura.de'ye gitmesin (O-150/Y4); `SITE_URL → APP_BASE_URL → SaaS` sırası, **istek başlığından kurulmaz**
  (host-header injection). Nerede: `server.js` OAuth redirect'leri, `verified=1` redirectTo, Termin-Anfrage mail linkleri;
  `routes/mitarbeiter-zugang.js` (yerel `APP_BASE_URL` kopyası buna bağlandı). Backend'de başka kopya kalmadı (grep doğrulandı).
  ⚠️ Haritada `calledBy: []` — çağrılar anonim route handler'larında; ölü kod değil.
- `KUTU_OWNER_PLAN` (sabit, aynı dosya). Niye: kutu owner'ı professional/active doğsun (K-2, O-147); lisansa
  bağlanınca değişecek tek yer. Nerede: `setup/router.js` `/owner`.
- `api-backend/setup/owner-passwort-reset.mjs` (CLI; `stdinZeile`, `ende`). Niye: kutu mailsiz, owner şifresini root
  host'tan sıfırlar (O-107). Yalnız `onprem/reset-owner-passwort.sh` çağırır. `createClient` kalıbı `setup/router.js`'ten
  bilerek kopyalandı (iki kullanım, fabrika açılmadı).
- `hausbesuchRouteAusblenden()` (`module/hausbesuch-route.js`). Niye: kutuda Edge Function yok, "Entfernung berechnen"
  düğmesi kaldırılır (K-5, O-11). Yan etkili import (`IST_KUTU`'yu kendisi okur) — `dashboard.js`'te tek import satırı,
  bu yüzden haritada `calledBy: []`.
- Yeni fonksiyon olmayan kutu dalları: `module/lead-suche.js` B2B "KI Mail-Assistent" kartı `.remove()` (O-09b);
  `login.js` forgotLink metni `IST_KUTU` dalı.
- `tools/onprem-manifest.mjs --check` (O-149). Niye: paket listesi 4 yerde elle (BUNDLE_DATEILER, Dockerfile COPY,
  workflow paths, smoke test BUNDLE_DATEIEN) — kapı bağlar. Nerede: `tools/check-onprem.sh`.
  ⚠️ `tools/` haritanın kapsamı dışında.
- `onprem/windows/praxura-installieren.ps1` iç yardımcıları (Log/Ok/Warn/Fehler/Frage/InWsl/BoxEnv/DistroVorhanden):
  yalnız o betikte yaşar; harita `.ps1` taramıyor.

### 02.10.2026 · KHS K1 — Mitarbeiter entfernen backend'e, query-token daraltıldı, DB koruma trigger'ları, sır kapısı
- `mitarbeiterEntfernen(id, options)` (`module/mitarbeiter-zugang.js`). Niye: "Mitarbeiter entfernen" düğmesi tarayıcıdan
  başka kullanıcının `profiles` satırını yazıyordu — RLS yüzünden hiç çalışmadı, 0053'ten beri zaten yasak. Nerede:
  `dashboard.js` `empRemoveBtn` onclick (`openEmpDetail`) → backend `POST /team/mitarbeiter/:id/entfernen`
  (`api-backend/routes/mitarbeiter-zugang.js`, `is_active=false`; commit fdf25dd). Çalışan kaldırmanın tek yazma yolu bu —
  ikinci yol haritada yok (grep `is_active: false` / `owner_id: null`: yalnız bu route + Stripe webhook'un ayrı işi).
  ⚠️ Harita `endpoints[]` bu çağrıyı yakalamıyor (şablon yol), `calledBy`'daki `fmt` gürültü.
- `queryTokenErlaubt(req)` (`api-backend/ai/auth.js`). Niye: `requireAuth` `?token=`'ı her route'ta kabul ediyordu — token
  URL'de log/Referer'a düşer (guvenlik S-38). Nerede: yalnız `requireAuth` içinde; izinli iki yol `GET /api/gmail/connect`,
  `GET /api/calendar/google-auth` (tarayıcı yönlendirmesi, header taşıyamaz).
- DB fonksiyonları (harita kapsamı dışı, `SCHEMA-RLS.sql`'de): RPC `auth_sitzungen_beenden`, `mitarbeiter_zuordnen` (0055);
  trigger fonksiyonları `profiles_privilegierte_spalten_schuetzen` (0053 — rol/owner_id/plan kolonlarını istemciden korur),
  `prescriptions_mandant_pruefen` (0054 — mandant sınırı).
- `tools/check-secrets.mjs` (`pruefeText`, `ladeAllowlist`, `pruefeDatei`, `scanneStaged`, `scanneAlle`, CLI): pre-commit
  sır tarama kapısı (S-05). `tools/check-definer-referenz.test.js`: SECURITY DEFINER referans testi (S-04b).
  ⚠️ `tools/` haritanın `SCAN_ROOTS`'unda değil — bu dosyalar `INDEX.json`'da görünmez (bilinen kapsam sınırı, diğer kapılar gibi).
- Silinen: `confirm.html` `applyPendingEmployeeData` (inline), `employee-signup.js` → `archive/kod/`,
  `api/admin/data.js` `type=bookings` dalı. Haritada artık yoklar (doğrulandı).
- **Açık not (bilinçli bırakıldı, karar bekliyor):** pasif çalışanları (`is_active=false`) süzmeyen okuyucular —
  `module/anfrage-bearbeiten.js` (çalışan seçimi), `dashboard.js` Fahrtenbuch çalışan listesi, `dashboard.js` Urlaub
  çalışan listesi. Fahrtenbuch'ta geçmiş kayıtların sahibi görünsün diye doğru olabilir; Anfrage/Urlaub'da pasif çalışana
  atama yapılabiliyor olması muhtemelen değil. Aynı kural ("aktif çalışanlar") üç yerde ayrı sorgu — kural farkı adayı.

### 01.10.2026 · Oturum B — Fahrtenbuch Änderungsprotokoll (0052), Berlin-Tag Backend-Kopien kapandı
- DB fonksiyonu `fahrten_aenderung_protokollieren()` (migration 0052, trigger `trg_fahrten_aenderung_protokollieren`
  AFTER UPDATE OR DELETE on `fahrten`). Niye: BMF 18.11.2009 — elektronik Fahrtenbuch'ta sonradan değişiklik/silme görünür
  kaydedilmeli (legal-de); tamamlanmış yolculukta Finanzamt alanı değişince veya silinince eski/yeni değer append-only
  `fahrten_aenderungen`'e. Nerede: yalnız DB; okuyan frontend henüz yok (Oturum A: CSV "geändert" sütunu + Änderungsprotokoll export).
  Harita kapsamı dışı (DB fonksiyonu, `SCHEMA-RLS.sql`'de).
- Refactor: `stichtag-pruefung.js` `berlinTagVon` ve `tools/kostentraeger-check.mjs` artık `api-backend/lib/berlin-tag.js`
  `berlinHeute()` kullanıyor — aşağıdaki Berlin-günü kopya listesinden iki backend kopyası (🟡 `berlinTagVon`, 🟡 `kostentraeger-check`)
  kapandı. Frontend kopyaları duruyor (Oturum A bölgesi).

### 01.10.2026 · Oturum B — ICD DTA-Reinform, Stichtag-Prüfung Empfänger (Çeyrek geçişi)
- `icdFuerDta(code)` (`api-backend/billing/utils/icd-code.js`). Niye: §302 DIA segmentine yalnız saf ICD-10-GM kodu
  (`^[A-Z]\d{2}(\.\d{1,2})?$`) gitsin; `-`, `†*!`, G/V/Z/A, L/R/B ekleri soyulur (gkv-302 01.10.2026, Anlage 1 TP5 V21
  §5.5.3.3, ICD-10-GM Feld 7). Nerede: `dta/builder.js` icdListe, `dta/preflight.js` (endständig + ICD↔DG), `api/abrechnung.routes.js`
  (terminal lookup, podo UI1/UI2 L60.0 kilidi). `isValidIcd10` aynı zerlegung ile toleranslı (B ve †*! kabul). Frontend'de
  `ICD_SHAPE` ayrı katman (ayna, `icdOhneStrich` ↔ `normalizeIcd` ailesi).
- Yeni `api-backend/billing/kostentraeger/stichtag-pruefung.js`: `bewerteEmpfaengerWechsel` (saf), `pruefeEmpfaenger` (DB),
  `quartalVon`, `berlinTagVon`, `anschriftGleich`. Niye: çeyrek geçişinde (30.09 üretilip 02.10 gönderilen dosya) DTA alıcısı /
  Papierannahmestelle değiştiyse engel, çeyrek farkında uyarı; Stichtag = Übermittlungstag (gkv-302). Nerede: `abrechnung.routes.js`
  `dta-bytes` (409 / uyarı header'ı), `upload-signed` (409 / `stichtagWarnung`), `mark-sent` (yalnız `stichtagWarnung`), yeni
  `GET /abrechnung/:id/empfaenger-pruefung`. Routes'ta yeni `bereichFuerAbrechnung(supabase, abrechnung, {tenantId})` (Podologie:
  abrechnung_zeile/`prescriptions.therapie_bereich='podo'`, yoksa owner `profiles.sector`).
- **Kopya adayı (listelendi, birleştirilmedi — karar Kemal'in):** 🟡 `berlinTagVon` ↔ `api-backend/lib/berlin-tag.js` `berlinHeute`
  (aynı aile; yukarıdaki 01.10 "Berlin günü tek kaynak" kaydındaki kopya listesine eklenir).

### 01.10.2026 · Oturum B — Berlin günü tek kaynak (O-139, Annahmestelle Stichtag)
- `berlinHeute(jetzt?)`, `istStichtag(s)` (neu `api-backend/lib/berlin-tag.js` + test). Niye: Stichtag = Rechnungsdatum =
  Übermittlungstag; UTC `current_date` / `toISOString().slice(0,10)` 00:00–02:00 Berlin arası bir gün geride kalıyordu →
  çeyrek geçişinde (01.10) dosya eski Annahmestelle'ye gidebilirdi. Nerede: `billing/kostentraeger/annahmestelle.js`
  (valid_from/valid_to filtresi), `lib/rezept-felder.js`, `tools/kostentraeger-annahmestellen-laden.mjs`.
  `tools/seed-generieren.mjs` aynı kuralı SQL'de uyguluyor (`zukunftSperreSql`: `(now() AT TIME ZONE 'Europe/Berlin')::date`,
  Adım-2 kilidi: gelecek tarihli valid_from reddi) — JS yardımcısını import etmiyor, bilinçli.
- **Kopya kontrolü (fonksiyon-ustasi 01.10, birleştirilmedi — karar kullanıcının):**
  - 🟡 `tools/kostentraeger-check.mjs` stichtag varsayılanı `Intl.DateTimeFormat('en-CA', Europe/Berlin)` inline —
    `berlinHeute()`'nin birebir kopyası, aynı Kostenträger alanında. En ucuz birleştirme adayı.
  - 🟡 Frontend (backend modülünü import edemez, ayrı katman): `heilmittel-fristen.js` `berlinTag(datum)`;
    inline `toLocaleDateString('sv-SE', Europe/Berlin)` → `podo-behandlungen-oeffnen.js` (2×), `podo-einheiten.js` `heute`,
    `podo-geplant.js` `tag`, `termin-heute.js`. Aynı iş, beş yer; ortak yeri `module/datum.js` olurdu.
  - 🔴 **Kural farkı:** `verordnung-pruefung.js` `heuteIso()` ve `module/datum.js` `alsISODatum()` Berlin değil
    **tarayıcı yerel saati** kullanıyor. Almanya'daki cihazda aynı sonuç; farklı saat dilimli cihazda ayrışır.
  - Kopya değil: `server.js` `berlinOffsetMin()` gün değil dakika-ofseti döndürür (slot hesabı);
    `belegliste/helper.js`, `warteliste.routes.js` tarih+saat/hafta günü biçimliyor, başka iş.

### 30.09.2026 · Migration 0047 canlı (a990014), ön yüz push 30.09 akşam — Anamnese je Fachbereich, append-only, Risiko-Rozets
Kemal kararı: Anamnese Fachbereich'e özgü (podo 20 alan — podoloji kararı; physio mevcut; ergo/logo taslak).
Commit edilmedi; B'nin anamnese migration'ı (`ist_aktuell`, `fachbereich`, `version`, `felder` …) bekleniyor,
commit'te harita tazelenecek.
- `module/anamnese-formulare.js` (neu, saf): `FORMULARE` + `validiere`, `antwortAusForm`, `spaltenAusFelder`,
  `anzeigeZeilen`, `baueInsert`, `bestaetigungsKopie`, `rozetsAusFelder`, `begrenzeRozets`, `konsistenzHinweis`,
  `risikoKopie`, `vorschlaegeAusRisiken`, `kioskHinweis`, `risikoZeilen`, `befundRisikoHinweis`. Niye: dört form tek
  tanım dosyasında; DOM/DB'siz test edilebilir. `spaltenAusFelder` sabit kolonları (Terminkarte, Druck) `felder`'den
  besler — Terminkarte kendi renderer'ını (`termin-panel.js` `zeichneAnamnese`) bilerek korur.
- `module/anamnese-daten.js` (neu): anamnese'ye TEK frontend erişimi — append-only INSERT (`speichereNeu`, `bestaetige`),
  tek UPDATE `markiereGeprueft`, okuyucular `ist_aktuell`+`fachbereich` (`ladeAktuelle`, `ladeAlleAktuellen`,
  `ladeVersionen`, `hatAktuelle`), `ladeAltrisiken` (eski `befund.risiken` → öneri).
- `module/anamnese-rozet.js` (neu): `rozetHtml`. Niye: risk rozetleri yalnız Akte başlığı + Tagesbehandlung
  (legal-de: Kalender/E-Mail/PDF/Abrechnung'da yok).
- `module/anamnese.js` (kuşatma, dashboard.js −489): `loadAnamnese`, `fillAnamneseForm`, `saveAnamnese`,
  `printAnamneseInline`, `bindAnamneseEvents`, `loadAnamneseRxContext`, `loadPatientDetailAnamnese` taşındı;
  legacy `printAnamnese` silindi; yeni `initAnamnese`, `oeffneAnamneseFuer`.
- Değişen: `kiosk.js` `handleKioskStart(modus)` („Nur Einwilligung" — aynı kiosk kabuğu, ikinci kabuk yok);
  `patienten-einwilligung.js` `onClose` + z-index 99999; `fussbefund.js` risk bloğu salt-okunur (Anamnese lider kaynak,
  `befund.risiken` = `risikoKopie` + `anamnese_id`); `podo-tag-zusatz.js` `hatAnamnese` → `ist_aktuell`+`fachbereich='podo'`.
- **Kopya kontrolü (fonksiyon-ustasi 30.09, birleştirilmedi, karar Kemal'de):**
  - **VERİ RİSKİ — `api-backend/server.js` `POST /api/rezept/save`**: anamnese'ye hâlâ eski kuralla yazıyor: `ist_aktuell`/`fachbereich`
    filtresiz `.maybeSingle()` okuma, sonra **UPDATE** (mevcut satırı değiştirir) ya da `fachbereich`/`version`'sız INSERT.
    Append-only kuralıyla çelişen ikinci yazma yolu. Frontend'de çağıranı bulunamadı (grep + harita `endpoints[]` boş) —
    ölü olabilir; migration'dan önce karar: kaldır / `anamnese-daten` kuralına çek.
  - `podo-tag-zusatz.js` `hatAnamnese` ↔ `anamnese-daten.js` `hatAktuelle(sb, leadId, 'podo')` — aynı sorgu, aynı `null`
    anlamı. Küçük kopya; import edilebilir.
  - `dashboard.js` Terminpanel doğrudan `from('anamnese')` okuyor (anamnese-daten dışı ikinci okuyucu, filtreler doğru).
  - Kopya değil: `risikoZeilen` ↔ `fussbefund-archiv.js` `risiken` (biri Anamnese `felder`, öbürü Befund anlık kopyası
    — iki farklı kaynak, kasıtlı). Ama eski 4 anahtarın etiketi üç yerde ayrı: `befundRisikoHinweis`
    („Infektionskrankheiten"), `fussbefund-archiv.js` `RISIKO_LABEL` („Infektion"), `fussbefund.js` `kurzBefund`
    („Allergie", infektion yok). Görsel drift, veri riski değil.
  - `anzeigeZeilen` ↔ `patientenkarte.js`: patientenkarte anamnese satırı çizmiyor — aday düştü. Tek diğer çizici
    `termin-panel.js` `zeichneAnamnese` (sabit kolonlar, yukarıda).
  - Einwilligung: kiosk kabuğu tek (`kiosk.js` `enterKioskMode(modus)`), `openEinwilligungFlow` onun üstüne biniyor — kopya yok.

### 30.09.2026 · 047baab — Podoloji (a)/(b)/(c) + canli-test P3 (Sperrtext, ICD im Speichern-Dialog)
- `sperreTextAusLage(lage)` (`podo-arztangaben.js`). Niye: LANR/Unterschrift-Sperre hatte drei Wortlaute
  (Banner, Speichern-Dialog, Tagesbehandlung); jetzt ein Satz, der das Fehlende nennt (canli-test P3).
  Nerede: `podoArztHinweise().satz` (saveRezept), `behandlungGesperrt().text` (Tagesbehandlung),
  `arztangaben-banner.js` `sperreBannerText`. `SPEICHERN_HINWEIS` / `BEHANDLUNG_GESPERRT_TEXT` entfernt.
- `icdSpeicherHinweise`, `icdHinweiseZusammen` (neu `module/verordnung-speichern-hinweise.js`). Niye: saveRezept-Bestätigung
  soll nicht endständige ICD (z. B. E11.7) nennen, ohne dass `dashboard.js` wächst. Nerede: `dashboard.js` `saveRezept`
  (formatErrors-Zeile). Kein zweiter Wortlaut: nutzt `gespeicherterKodeHinweis` (katalog-suche.js → `nichtEndstaendigHinweis`) + `pruefeVerordnung`.
- `heilmittelGegenLeitsymptomatik` (`verordnung-pruefung.js`). Niye: 78010↔Leitsymptomatik wurde per Freitextvergleich
  geprüft; jetzt positionsbasierte Regel (podoloji (a), Wortlaut gkv-302). Nerede: `pruefeVerordnung`.
- `module/podo-heilmittel-katalog.js` (neu) — `POD_HEILMITTEL_KATALOG` / `POD_HEILMITTEL_DGS` aus `podologie-abrechnung.js`
  hierher, weil jenes Modul im Rumpf einen DOM-Listener hat und nicht importierbar war. Eine Tabelle; Import in
  `podologie-abrechnung.js` + `verordnung-pruefung.js`. Nicht verwechseln mit `POD_KATALOG` (verordnung-regeln.js).
  - **Offener Rest:** `podo-behandlungsposition-regel.js` `DGS_MIT_BEHANDLUNG = ['DF','NF','QF']` ist laut eigenem
    Kommentar ein Spiegel von `POD_HEILMITTEL_DGS` „ohne Import-Kette" — seit dieser Auslagerung wäre der Import
    möglich. Klein, nicht gemeldet als Kopie-Karte; beim nächsten Anfassen importieren statt spiegeln.
- `ohneBehandlungsposition`, `leitsymptomatikNotiz`, `OHNE_BEHANDLUNG_FRAGE`, `LS_FEHLT_NOTIZ`
  (`podo-behandlungsposition-regel.js`). Niye: DF/NF/QF-Tagesbehandlung ohne 78010/78020 rutschte still durch
  (podoloji (b)); jetzt Rückfrage beim Speichern + Notiz bei fehlender Leitsymptomatik. Nerede:
  `podologie-abrechnung.js` Kaydet-Handler + Tagesbehandlung-Kopf. `behandlungspositionVorschlag(massnahme, roh, dg)`
  — 3. Parameter DG → 78010-Vorbelegung bei DF/NF/QF.
- `statusDialogVorgabe` (`abrechnungsstatus.js`). Niye: aktive podo-Verordnung mit 0 Behandlungen → „Bereit" disabled und
  nicht vorgewählt, damit der Server-422 vorher sichtbar ist (podoloji (c)). Nerede: `oeffneStatusDialog` / `oeffneStatusDialogFuer`.

### 01.10.2026 · S3-Reste — ICD nicht endständig, Karten-IK-Prüfung, Sperre-Banner, Fahrt-lead_id
- `passendeUnterkodes(code, rule)` (`icd-dg-match.js`). Niye: „E11.7 passt nicht zur Diagnosegruppe DF" war mechanisch wahr,
  aber irreführend (E11.74/E11.75 passen). Kinder eines nicht endständigen Kodes, die die DG-Regel annimmt → gelbe Warnung
  `ICD_NICHT_ENDSTAENDIG` (gkv-302: V:01016, kein Blocker) statt rotem Mismatch. Nerede: `verordnung-pruefung.js` (Liste/Knopf) +
  `icd-dg-verdrahtung.js` (Formular-Warnzeile). `dgSperrenFuerIcd` unverändert.
- `leadKartenIkFehler(wert)` / `pruefeLeadKartenIk(kasseEl)` (`lead-karten-ik.js`). Niye: ungültige Karten-IK wurde im Patientenformular
  still zu null und überschrieb eine gültige. Nerede: Speichern-Handler `leadSaveBtn` in `dashboard.js` (Inline-Fehler + Abbruch).
- `kasseZuKartenIk({...})` (`krankenkasse-suche.js`). Niye: Kassenname passte nicht zur Karten-IK (DAK-IK bei „AOK…"), kein Hinweis.
  Amber-Warnung `#<ik-id>Abweichung`, kein Blocker; nutzt den vorhandenen Resolver `kartenIkStatus` (kein zweiter). Nerede: Patientenformular + Muster-13-Maske.
- `sperreBannerText` / `aktualisiereArztSperreBanner` / `installiereArztSperreBanner` (neu `module/arztangaben-banner.js`). Niye: die
  Behandlungssperre (LANR/Unterschrift, S3.7) erschien nur im Speichern-Dialog. Live-Banner `#rzSperreBanner` in der Maske (podo),
  Speichern blockiert weiterhin nicht. Nerede: `dashboard.js` (Maske öffnen/Arzt-Vorbelegung), `verordnung-maske.js` `fuelleMuster13`; `arzt-register.js` sendet nach LANR-Übernahme `input`.
- `leadIdFuerFahrt(sb, b)` (`fahrt-beenden.js`). Niye: erste `fahrten`-Zeile hatte `lead_id` nur über Telefon → leer bis „Beenden".
  `bookings.lead_id` zuerst, dann Telefon. Nerede: Fahrtstart in `dashboard.js`.
- Neue Verordnung → `emit('verordnungen:changed')` (statt nur bei `activePanel==='verordnungen'`): Liste/Akte zogen nicht nach.

### 30.09.2026 · gkv-302 Auflagen zu B1 — Rückschreiben, valid_from, Preflight je Zeile
- `kostentraegerIkZurueckschreiben(supabase, zeilen, warnungen, ownerId)` (`kostentraeger-frisch.js`). Niye: Arbeitsliste
  (`abrechnung-auswahl.js`) gruppiert nach gespeicherter IK; ohne Rückschreiben hing eine Verordnung mit geändertem
  Kostenträger für immer im 409 `KOSTENTRAEGER_GEAENDERT`. Schreibt nur `abrechnung_status='bereit'` + `belegnummer IS NULL`
  (GoBD-Tor `prescriptions_festschreibung`), Bedingung zusätzlich im WHERE, best effort. Nerede: `/abrechnung/create` und
  `/abrechnung/create-podologie`, direkt nach `kostentraegerFrischAbleiten`. ⚠ 8. `prescriptions`-Schreibweg (nur diese eine Spalte).
- `kostentraegerGeaendertAntwort(id, alt, neu, zurueckgeschrieben)` — 409-Text; „Liste neu laden" nur wenn wirklich gespeichert.
- `kostentraegerFrischAbleiten(..., {preflight:true})` liefert zusätzlich `fehler` (je Zeile, kein Abbruch) + `aufgeloest`;
  `/abrechnung/preflight` richtet die Kasse/DAS-Auflösung an der ersten aufgelösten Zeile aus. `kostentraegerAbfrage` filtert jetzt auch `valid_from`.

### 30.09.2026 · gkv-302 B1 — Kostenträger-IK DTA anında taze; kayıtlı ICD'de S3.6 uyarısı
- 79e1556 — yeni `api-backend/billing/utils/kostentraeger-frisch.js` → `kostentraegerFrischAbleiten(supabase, zeilen, {aufloeser})`.
  Niye: §302 dosyası üretilirken `prescriptions.kostentraeger_ik`'deki saklı değere güvenilmiyor; Karten-IK'dan
  o anki Kostenträgerdatei'ye göre yeniden türetiliyor (birleşme / yeni `abrechnender_kt_ik` sonrası dosya eski
  IK'ya gitmesin). Çözülemezse 422 `KOSTENTRAEGER_NICHT_AUFLOESBAR`, değiştiyse uyarı `KOSTENTRAEGER_IK_NEU`.
  **Yeni çözümleyici değil** — S3.8a'nın tek kaynağı `kostentraegerIkAufloesen`'i sarar; isim geri düşüşü bilerek
  kapalı (yalnız `krankenkasse_ik` geçer). Nerede: `abrechnung.routes.js` → `/abrechnung/create`,
  `/abrechnung/preflight`, `/abrechnung/create-podologie`. Haritada `calledBy` boş görünür (route gövdeleri
  anonim) — kullanım bu üç route'tur.
  - **Açık not:** `/abrechnung/korrektur` bu yardımcıya bağlı **değil**; IK'yı orijinal dosyanın
    `abrechnung.kostentraeger_ik`'sinden alıyor. Korrektur'un orijinal alıcıya gitmesi bilinçli olabilir — karar
    gkv-302'nin. Taze türetme oraya da gerekirse ikinci kural yazılmaz, bu fonksiyon bağlanır.
- 30.09 (canli-test P3) — `katalog-suche.js` → `gespeicherterKodeHinweis(sb, feldwert, bereich)`.
  Niye: kayıtlı, endständig olmayan ICD reçete yeniden açıldığında da S3.6 uyarısını göstersin. Metni kendisi
  üretmez, `nichtEndstaendigHinweis`'i yeniden kullanır; katalog araması `searchDiagnosen` üzerinden.
  Nerede: `attachDiagnoseSearch` içindeki `katalog:gespeichert` dinleyicisi; olayı `module/verordnung-maske.js`
  `rzIcd`/`rzIcd2` doldurulunca atar. `attachDiagnoseSearch`'in tek bağlandığı yer `DIAGNOSE_FIELDS`
  (`rzIcd`, `rzIcd2`, `rzDg`) — başka ICD giriş yolu yok, kapsama tam.
- 30.09 (canli-test P1/P3) — ICD sondaki "-" kodun parçası değil (gkv-302). Yeni: `api-backend/billing/utils/icd-code.js`
  → `icdOhneStrich` (tek ortak backend normalizer; frontend karşılığı `icd-dg-match.js` `normalizeIcd`), `icdAbfrageKodes`
  (icd10_titles için k ve k- birlikte), `icdTerminalMap` (tiresiz anahtarlı harita, terminal=false kazanır). Nerede: preflight
  `isValidIcd10`/V:01016, `builder.js` DIA listesi, `abrechnung.routes.js` mapper + terminal sorgusu. Ayrıca `katalog-suche.js`
  → `setzeNichtEndstaendigHinweis` (hint DOM, eskiden `attachDiagnoseSearch` içinde kapalıydı) + `hinweisFuerGespeichertenKode`
  (dinleyici bağlı olmasa da çalışır; `verordnung-maske.js` `fuelleMuster13` doğrudan çağırır — taze yüklemede focusin yoktu).

### 30.09.2026 · Reform S3.8a — Karten-IK ≠ Kostenträger-IK; yerel "bugün"
- e665aca — Reform S3.8a (gkv-302, Anlage 1 TP5 V21 §5.5.2 / §5.5.3.1). Niye: Karten-IK (kartta
  basılı) `prescriptions.krankenkasse_ik`'ye yazılır; Kostenträger-IK **her zaman ondan türetilir**,
  DTA'daki sessiz geri düşüş kaldırıldı. Yeni:
  - `kartenIkNormalisieren` — **bilinçli ayna**: `module/krankenkasse-suche.js` ↔
    `api-backend/lib/rezept-felder.js`. Sunucu karar verir, ikisi birlikte değişir.
  - `kartenIkHinweise`, `kartenIkStatus`, `kasseAbrechnungsbereit` (`krankenkasse-suche.js`).
  - `kostentraegerAbfrage` (`rezept-felder.js`) — `kostentraeger_auswahl` view'ının filtre aynası
    (echt/active/gkv/valid_to). View'ın filtresi değişirse bu da değişir.
  - `kartenIkPflicht` (`dta/builder.js`), yeni `api-backend/billing/utils/karten-ik.js` →
    `kartenIkFehler`, `istKartenIk`; preflight kuralı `V:01017`.
  - Nerede: Muster-13 maskesi, OCR, `/rezept/confirm`, DTA mapper'ları, §302 liste "bereit" rozeti
    (`dashboard.js` + `abrechnung-auswahl.js`).
  - ⛔ **İkinci IK çözümleyici yazılmaz.** Tek kaynak: `kostentraegerIkAufloesen` (sunucu, karar) /
    `aufgeloesteIk` (istemci, yalnız gösterim).
- d92e422 — `dashboard.js`'te 7 "bugün" varsayılanı `toISODate` (= `alsISODatum`) ile yerel güne.
  Kural: "bugün" için `toISOString().slice(0,10)` yazılmaz (akşam saatinde ertesi güne kayar).
  - **Kalan örnekler (30.09 sayımı, dokunulmadı — karar sahibi builder/Kemal):** `dashboard.js`
    3 yer (biri dosya adı, zararsız); `module/` altında `abrechnung-detail`, `behandlungsbestaetigung`,
    `rechnung-zahlungseingang`, `termin-leistungen`, `zuzahlung-befreiung`; ve **S3.8a'nın kendi
    `kostentraegerAbfrage` varsayılan parametresi** (sunucu, UTC konteynerde gece 00–02 arası
    `valid_to` filtresi bir gün geride kalır — küçük ama aynı kural).

### 30.09.2026 · Podoloji reform sprinti — tarih biçimleyici birleşimi, S2.3b onay geçerliliği
- f30f407 — `module/datum.js` yeni `datumDe(wert, leer='')`. Niye: `eingangsbefundung-regel.js` ve
  `fussbefund-archiv.js`'teki iki farklı davranışlı kopya tek yere indi (Kemal onayı). Saf
  YYYY-MM-DD regex'le (saat dilimi kayması yok), zaman damgası `alsISODatum` ile yerel güne.
  Nerede: `befundungFuerLeistung` (regel dosyası `datumDe`'yi re-export ediyor, eski importlar
  kırılmıyor) ve `renderFussbefundArchiv` (`leer='—'`). 29.09 kaydındaki regel-içi `datumDe` artık
  buraya taşındı.
  - **Bilinçli dokunulmayan kopya adayları** (karar Kemal'in, INDEX'te aday olarak kalır):
    `verordnung-aus-ocr` → `alsDeutschesDatum`, `verordnung-pruefung` / `heilmittel-fristen` →
    `deDatum` ve benzerleri. Yeni tarih biçimleyici yazılmaz — `datumDe` kullanılır.
- f8ea2aa — Reform S2.3b: `bestaetigungNochGueltig` + `gueltigBestaetigteIds`, ayna çifti
  `api-backend/billing/utils/offene-einheiten.js` ↔ `module/offene-einheiten.js` (S2.3'ün devamı).
  Niye: Bereit'te açık birimle onaylanan reçete Erstellen'de ikinci kez sorulmasın; offen sayısı
  değiştiyse veya ileri tarihli Termin varsa onay düşer, yeniden sorulur. Nerede: sunucu kapısı
  `abrechnung.routes.js` → `create-podologie`; istemci `module/abrechnung-auswahl.js` (ön seçim +
  onay diyaloğundan hariç tutma). ⚠️ `prescription_validations`'ı **okuyan ilk yer** (önceden
  yalnız yazılıyordu) — tablonun kolon/anlam değişikliği artık bu iki kapıyı da etkiler.
  Ayna kuralı S2.3 ile aynı: sunucu otorite, ikisi birlikte değişir.

### 29.09.2026 · Podoloji reform sprinti S1.12 + S2 + S3 — Befundpauschale önerisi, Test dosyası, Abrechnung/Termin/Fahrtenbuch
- S2.1 (13d4351) — `api-backend/billing/api/betriebsart.js` yeni `verordnungFestschreiben(betriebsart)`.
  Niye: §302 Test dosyası (Anhang 2 Kap. 9 §5, keine Zahlung) reçeteye `belegnummer` yazıp GoBD
  kilidini tetikliyordu, reçete bir daha faturalanamıyordu. Nerede: `abrechnung.routes.js` →
  `create-podologie` — test'te `prescriptions` güncellemesi ve belegnummer döngüsü atlanır.
  ⚠️ Physio `/abrechnung/create` ve Korrektur yolunda aynı hata **bilerek bırakıldı** (fizyo
  ertelendi) — o yollara dokunulduğunda bu yardımcı oraya da bağlanmalı, ikinci kural yazılmamalı.
- S1.12 (ee51827) — `module/termin-leistungen.js`: `mitBefundungsvorschlag()` artık satır eklemiyor,
  `vorschlag` döndürüyor; yeni `vorschlagText()`, `zeilenFuerTermin()`, `raeumeAngenommenenVorschlag()`,
  iç `zeichneVorschlag()`/`serieAktiv()`. Niye: 05.09 kararı ("Befundpauschale önerilir, işaretsiz")
  arayüzde uygulanmamıştı; öneri otomatik satır olarak kaydediliyor, S1.10'dan beri her seri
  randevusuna 78030 (yeni hastada 78040) kopyalanıyordu. Nerede: Terminmaske (tekli + seri,
  "Serie verteilen" dahil), `speichereLeistungen`. `module/eingangsbefundung-regel.js` yeni
  `datumDe()` (ISO→TT.MM.JJJJ), ipucu metni "eingeplant/dokumentiert".
  `api-backend/billing/dta/befundpauschale-regeln.js` (d)+(e) iki sert kural; frontend aynası
  `module/abrechnung-auswahl.js` → `podoBefundOhneBehandlung()`. Kural iki yerde bilinçli (sunucu
  otorite, istemci ön uyarı) — ayna değişirse ikisi birlikte değişir.
  - **Kopya adayı notu:** `eingangsbefundung-regel.js` artık iki farklı `?v=` ile import ediliyor
    (`termin-leistungen` → 20260929, diğerleri → 20260920s). Tarayıcı iki ayrı modül örneği yükler.
    Saf modül olduğu için bugün zararsız; modüle durum (state) eklenirse iki kopya ayrışır.
    Bir sonraki dokunuşta `?v` birleştirilmeli.
- S2.2 (36fb9ff) — `module/abrechnung-detail.js` yeni `etikettFuer()`, `istTestDatei()`. Niye: dosya
  detayında karışık dil + test dosyası gerçek dosyadan ayırt edilmiyordu. Nerede: Abrechnung → dosya detayı.
- S2.3 (2c3fc45) — `api-backend/billing/utils/offene-einheiten.js` + ayna `module/offene-einheiten.js`.
  Niye: açık birim = `anzahl_einheiten` − iptal edilmemiş `podologie_behandlungen`; açık birimle
  faturalamada 428 `OFFENE_EINHEITEN`, bilinçli onay `prescription_validations`'a yazılır. Kural iki
  yerde bilinçli (sunucu kural sahibi). ⚠️ Ham satırda `anzahl_einheiten`, `verordnung-topf`'ta
  `behandlungseinheiten` — ayna değişirse ad çevirisine dikkat.
- S2.4 (9a71119) — `module/abrechnung-auswahl.js` yeni `ansichtNachErstellung()`: Erstellen sonrası
  "Bisherige"ye geçiş kararı; boş durumda protokol çizimi. Nerede: Abrechnung → Erstellen.
- S2.6 (8486dee) — `api-backend/billing/dta/hausbesuch-regeln.js` `hausbesuchRegeln()` + ayna
  `podoHausbesuchSperren()` (`abrechnung-auswahl.js`) + yeni `module/podo-hausbesuch.js`
  (Tagesbehandlung). Niye: 79933/79934 yalnız Hausbesuch=Ja iken faturalanabilir (Podo Anlage 3 c)).
- S2.7 (e2144ac) — `api-backend/billing/utils/ik-fehlt.js` `ikFehltAntwort()` + ön yüz `zeigeIkKnopf()`
  (`abrechnung-auswahl.js`). Niye: IK yoksa anlaşılır metin + Einstellungen'e düğme.
  - **Kopya notu (bilinçli bırakıldı):** IK çözümlemesi 3 yerde (physio upsert, podo, korrektur) —
    birleştirilmedi; fizyo ertelendiği için. O yollara dokunulduğunda tek yardımcıya indirilmeli.
- S3.1 (1fb3a7e) — yeni `module/lead-felder.js`: `leadGeburtsdatum`, `leadHausbesuch`,
  `leadMetadataZusammenfuehren`. Niye: `leads` sütunu kaynak, metadata üzerine yazılmaz birleştirilir.
- S3.2 (f117668) — yeni `module/vorlagen-seed.js` (`DEFAULT_VORLAGE_SEEDS`, `fehlendeSeedZeilen`,
  `seedeVorlagen`): tek toplu insert yerine satır satır fallback; migration 0043. `seedMissingVorlagen`
  `dashboard.js`'te ince sarmalayıcı olarak duruyor, gövdesi bu modüle indi.
- S3.3/S3.4 (cc6f346) — Fahrtenbuch: `window.__fb`, `saveQuickVehicleHandler`, `openQuickVehicleModal`
  **SİLİNDİ** (araç hızlı-ekleme ikinci yolu). Yerine `openVehicleEditModal(v, { zurueckZuFahrtStart })`;
  `saveVehicleEdit` → çekirdek `saveVehicleEditCore`. Kopya kapandı: araç kaydı tek yoldan.
- S3.5 (a541ae3) — yeni `module/termin-fehler.js`: Terminmaske hata kutusu (Speichern düğmesi yanında),
  `confirm()` yerine kendi dialog.
- S3.6 (5e764a8) — `katalog-suche.js` yeni `nichtEndstaendigHinweis()`; preflight `icdTerminal` → V:01016
  uyarısı. Nerede: ICD seçimi + Podologie-Preflight.
- S3.7 (22480aa) — yeni `module/podo-arztangaben.js`, `module/lanr-pruefung.js` (preflight `isValidLanr`
  aynası), `api-backend/billing/utils/arztangaben.js` `fehlendeArztangaben()`. Niye: Arzt-Nr./imza
  yoksa ne Behandlung ne "Bereit". LANR kuralı iki yerde bilinçli (sunucu otorite).
- S3.9 (0418566) — `katalog-suche.js` closeDropdown/Escape: liste güvenilir kapanır, Escape yalnız listeyi kapatır.
- S3.10 (410cc6f) — `customer_name` yalnız ad; okuyucular eski veriyi `parseNameMitGeburt` ile tolere eder.
- S3.11 (7331d46) — `termin-leistungen.js` yeni `zeilenMinuten()` (süresiz Befundpauschale = 0 dk);
  `schlageBefundungVor` export edildi (Folgetermin yolu kullanıyor).
- S3.13 (46faff6) — yeni `module/fahrt-beenden.js`: Tagesbehandlung'dan "Fahrt beenden";
  `openFahrtEndModal` opsiyonel bağlam alır (ikinci modal yazılmadı).

### 28-29.09.2026 · Podoloji reform sprinti S1 — Termin ↔ Verordnung, Tagesbehandlung
- S1.11 (24d751b) — yeni `module/termin-mail-angebot.js`: `mailAngebotZustand` (saf),
  `istPodoOhneRechnung`, `oeffneMailAngebotModal`. `openMailOfferModal` `dashboard.js`'ten buraya
  **taşındı** (kuşatma, -52 satır). `meldePodoSerienBindung` artık `_physioFlow.podo = true` koyuyor;
  `proceedToRechnungForPhysio` podo'da erken çıkıyor. Niye: podo serisinden sonra, henüz tek seans
  yokken fatura adımı açılıyordu (podoloji kararı). Nerede: `maybeOfferAppointmentConfirmEmail`.
  Ayrıca `zeigeVerordnungenFuerTermin` artık `sb/ownerId/leadId`'yi `rendereVeroKarten`'a geçiyor —
  maskedeki Verordnung sayacı podo'da 0/3 gösteriyordu (S1.3 podo dalı maskeye de bağlandı).
- S1.10 (32f1a4d) — `module/termin-leistungen.js`: `speichereLeistungen` artık tek id YA DA dizi
  alıyor; yeni `speichereLeistungenFuerErstellte(created, {showToast})`. Niye: seri randevuları
  (`batch-create`, `batch-create-explicit`) `booking_leistungen` yazmıyordu, KI yolu süreyi
  katalogdan alıyordu (canli-test P1: 65 dk yerine 35 dk). Nerede: `bkSaveBtn` manuel seri dalı,
  `aiSuggestConfirm`; `aiPrefSubmit` ve onay payload'ı `duration: leseDauer()`. Backend
  `ai-suggest-series` isteğe bağlı `duration` (1-480) alıyor, yeni route yok. Tekil ve seri
  kayıt aynı yazıcıdan geçiyor — `booking_leistungen` için ikinci yazan yol açılmadı.
- S1.9 (dbd79f0) — `module/heilmittel-fristen.js` yeni `pruefeBehandlungsbeginn` (saf; 28/14 gün,
  Berlin günü). `module/frequenz-pruefung.js` yeni `pruefeErsttermin` (yalnız podo, yalnız ilk
  randevu → BLOK); `bewerteAbstand` 4. parametre `pruefeUnterbrechung`; `pruefeFrequenz` podo'da
  `ladePodoTermine`'den okuyor, kesinti kuralı yok, UI1/UI2 muaf. Niye: `gkv-302`, HeilM-RL §16
  Abs. 4 S. 5 ve §15 — eski kod FAK Nr. 11'i ters okuyordu (podolojiye 12-hafta kesinti kuralı
  uyguluyordu); podo frekans kontrolü `prescription_sessions` üzerinden sayıldığı için fiilen
  ölüydü. Nerede: `bkSaveBtn`, `aiSuggestConfirm` (KI seri yolu, `batch-create-explicit` öncesi).
  **Tek kaynağa inen hesaplar:** `podologie-abrechnung.js` `vordAlerts` / `podSaveBehBtn` ve
  `dashboard.js` `computeRxDeadlineAlerts` / `loadUeberblickDeadlines` artık ortak
  `behandlungsbeginnFrist` kullanıyor (dringlich önceden atlanıyordu). 14/28 hesabının ön yüzde
  ikinci bir kopyası kalmadı. Bilinçli ayna: `api-backend/ai/validators/standardRules.js`
  (`DEFAULT_/DRINGEND_GUELTIG_TAGE`) — ayrı deploy yüzeyi, kopya adayı sayılmaz; kural değişirse ikisi.
- S1.8 (72e56cb) — `module/podo-einheiten.js`: yeni `bindePodoSerie`, `bindePodoSerieVonRezept`,
  `meldePodoSerienBindung`; `zeichnePodoEinheiten` yeni `aufSerie` enjeksiyonu; `ladeVerordnung`
  select'ine `frequenz`, `hausbesuch`. Niye: podolojide seri düğmesi gizliydi; KI seri yolu podo
  reçetesinde `prescription_sessions` üretiyordu (tuzak — podolojide seans tablosu yok). Nerede:
  `linkBookingsToPrescriptionSessions` başı (karar `rx.therapie_bereich`'e göre) + manuel
  `batch-create` yolu. Aşımda bağlama yapılmaz, fazla randevular bağsız kalır (`podoloji` +
  `gkv-302`, Anlage 3 lit. f).
  `module/termin-aktionen.js`: yeni `frequenzErkannt`, `normalisierePodoFrequenz`;
  `uebernimmSerienfrequenzAusRx` + `setFreqValue` `dashboard.js`'ten buraya **taşındı** (kuşatma).
  Niye: boş/tanınmayan podo frekansı sessizce haftalığa düşüyordu; "alle N Wochen"da eski hafta
  günü kutuları işaretli kalıp batch-create'te fazla randevu üretiyordu (**Physio'yu da
  etkileyen** hata). Nerede: `verteileOffeneSitzungen` (yalnız podo dalı), `openBookingFromRxPreset`.
- S1.4 (45d91c3) — yeni `module/podo-behandlungen-oeffnen.js`: `oeffnePodoBehandlungen`
  `dashboard.js`'ten buraya **taşındı** (kuşatma; `dashboard.js`'te ince sarmalayıcı +
  `podoBehandlungenDeps()` enjeksiyonu). İkinci parametre `{ vordId, datum, mehrdeutigFragen }`
  — niye: tarihsiz `setPodVorwahl` çağrısı Tagesbehandlung ön seçimini eziyordu; eski
  çağıranlar yalnız `leadId` ile çağırıyor, davranışları değişmedi. Yeni yardımcılar
  `terminIstPodo`, `terminDatum`, `terminInZukunft`, `terminStartenPodo`. Nerede:
  `handleTerminStarten` (normal + Hausbesuch dalı) — podoloji randevusu artık Physio'nun
  `markPrescriptionSession` yolunu değil Tagesbehandlung'u açar (reçete + randevu günü).
  Gelecek tarihli randevuda onay sorulur; bağsız randevu + 2 laufend reçetede ön seçim
  yapılmaz (`podoloji` ajanı önerisi). Bu, `podBehandlungsdatumVorschlag`/`setPodVorwahl
  { datum }` için beklenen ilk çağıranı bağladı (aşağıdaki 2d8aea5 maddesi).
- S1.3 (2a596dc) — `TERMIN_SELECT` ve `loadScheduleBookings` select'ine `verordnung_id`;
  `openBookingActionModal` `wunschRx` zincirine `booking.verordnung_id`;
  `module/termin-verordnung.js` `rendereVeroKarten` opsiyonel `sb/ownerId/leadId` + podo dalı
  (`ladePodoTermine` + `terminZaehler`, sayaç `[data-vero-zaehler]` asenkron dolar). Niye:
  panel podolojide aynı anda "0/3" ve "keine aktive Verordnung" gösteriyordu (podolojide
  `prescription_sessions` yok, sayım `bookings.verordnung_id` üzerinden). Nerede:
  Termin-Aktionen paneli.
- `module/termin-verordnung.js` `waehleVerordnung` podo dalı (b41d31d) — niye: kartla
  kaydedilen podoloji randevusu `bookings.verordnung_id` almıyordu. Nerede: Terminmodal kart
  seçimi (`dashboard.js` `selectVerordnung`).
- `module/termin-verordnung.js` `zeigeVerordnungenFuerTermin`, `resetVerordnungFelder`,
  `verdrahteAbwahl`, `aktualisiereBindungBeimSpeichern` (2db4146) — niye: düzenleme penceresi
  Verordnung kartlarını gizliyordu, UPDATE kolu bağlamıyor/çözmüyordu; `loadBkVerordnungen` ile
  `openBookingModal`'ın **ortak** kart-yükleme yolu (ikinci bir yükleyici yazılmasın diye).
  Nerede: `openBookingModal`, `loadBkVerordnungen`, `bkSaveBtn` UPDATE kolu.
- Yeni `module/podo-behandlungsposition-regel.js` `behandlungspositionVorschlag` +
  `podologie-abrechnung.js` `podVordBehandlungsposition`; `erstePositionAusItems` artık
  `verordnung-pruefung.js`'ten export (65a1b9e) — niye: Tagesbehandlung reçetedeki tedaviyi
  önseçmiyordu (a/b → 78010, c → 78010 öneri); export, 3. kopya yazılmasın diye. Nerede:
  `loadPodologieBilling` Leistung kutuları.
- Yeni `api-backend/billing/dta/befundpauschale-regeln.js` `befundpauschaleRegeln` + ön yüz
  aynası `module/abrechnung-auswahl.js` `podoBefundOhneBehandlung` (0520c3f) — niye: 78030 aynı
  gün tedavisiz = sert blok, 78040 reçetede hiç tedavi yoksa = atlanabilir blok (`gkv-302`).
  Nerede: `create-podologie` sperren döngüsü; Neue Abrechnung listesi.
  **BİLİNÇLİ AYNA** (backend/frontend ayrı deploy yüzeyi) — kopya adayı sayılmaz; biri
  değişirse ikisi.
- Yeni `module/podo-behandlungsdatum-vorwahl.js` `podBehandlungsdatumVorschlag`,
  `setPodVorwahl(id, { datum })` genişledi (2d8aea5 + hotfix 94c753c) — niye: Tagesbehandlung
  tarihi hep "heute" idi. Nerede: **henüz çağıran yok**; S1.4 "Termin Starten"
  `setPodVorwahl(vordId, { datum: randevu günü })` ile bağlayacak.
- `tools/check-syntax.sh` (pre-commit, 90c5652) — niye: 2d8aea5'teki template-literal backtick
  hatası canlı dashboard'u boşalttı; `npm test` o modülü yükleyemiyor.
### 26.09.2026 · QA-Fix `2007c8e` — datetime-local yerel, arama seçimden sonra susar
- **Yeni export `module/datum.js` `alsDatetimeLocal(d)`** — Zeitpunkt'u yerel okuyup
  `<input type="datetime-local">` için `YYYY-MM-DDTHH:MM` yazar; `new Date(feld.value)` ile
  kaydetmenin tersi. Niye: `openBookingModal` `start_time.substring(0,16)` ile UTC metni forma
  yazıyordu → 2 saat kayma, değiştirmeden kaydetmek termini kaydırıyordu. İlk kullanım:
  `dashboard.js` `openBookingModal` (`bkStart`). **Aynı işi elle yapan ikizler (henüz göçmedi):**
  `dashboard.js` Fahrtenbuch-Edit `toLocal = iso => iso.slice(0,16)` (`fbEditStartedAt/EndedAt`,
  timestamptz → aynı UTC kayması şüphesi, canlıda doğrulanmadı) · getTimezoneOffset hilesiyle
  inline yerel metin: `loadSlots`, `openManualBooking` (`bkStart.min`), `messDatum` varsayılanı.
- **Kapalı yardımcı `katalog-suche.js` `attachAutocomplete` → `verwirfSuche()`** (export değil) —
  seçim/blur sonrası bekleyen debounce'u ve yoldaki RPC cevabını geçersiz kılar (dropdown dolu
  alanın üstünde yeniden açılıyordu). Kullanım: `selectItem` + blur zamanlayıcısı. İkizi yok.
- Harita bu commit'te tazelenmedi (paylaşılan dizinde Ops #304 oturumunun commit'siz haritası);
  o oturumun commit'iyle birlikte üretilecek.

### 26.09.2026 · Ops #304 Nachtrag — iki ICD alanı, DG'ye tek yazan
- **Yeni modül `module/icd-dg-verdrahtung.js`** (`verdrahteIcdDg`, `icdAufZweiFelder`,
  `icdKodesAusFeld`) — `dashboard.js` `_wireDgIcdPair` buraya taşındı (kuşatma). Niye: test
  edilebilsin (`module/icd-dg-verdrahtung.test.js` 19 test + `tools/browser-probe/icd-dg-probe`
  gerçek maskede klavye/Tab ile 15 kontrol) ve kurallar: (1) `rzIcd` **ve** `rzIcd2` birlikte
  sayılır; (2) ilk alanda iki kod + ikinci boş → çıkışta ikinci kod `rzIcd2`'ye (`icd10` tek kod:
  `preflight.js` V:01002); ≥3 kod → taşınmaz, ipucu + kaydederken `formatErrors` (sperre yok —
  `gkv-302`: 3+ kodlu Verordnung geçerli); (3) Fachbereich **maskeninki** (`rzTherapieBereich`),
  yoksa mandantınki — `praxis` mandantında kural yoktu, otomatik susuyordu; (4) DG elle
  boşaltılınca hemen yeni öneri; (5) "passt nicht" ipucu uygun grupları da söyler.
  Fachlich: `podoloji` + `gkv-302` 26.09.2026. İlk kullanım: Muster 13.
- **Kopya kararı verildi (26.09.2026, kullanıcı devretti):** `rzDg`'ye otomatik yazan artık
  yalnız `verdrahteIcdDg`. `module/verordnung-podo.js` `dgAuswahlEingrenzen` yalnız seçim
  listesini daraltır (`data-pod-erlaubt`), DG yazmaz, "passt nicht / zulässig" satırlarını da
  basmaz. Niye: iki yazan + iki kriter = ağ yarışı; işaretsiz DF hiç geri alınmıyordu (d/d2
  canlıda bu yüzden kaldı) ve aynı ipucu iki yerde çıkıyordu.
- `api-backend/billing/dta/preflight.js` — `icd10` boş + `icd10_2` dolu: V:01002 boş alanda
  yanlış alarm veriyordu ve tek kod hiç denetlenmiyordu (`gkv-302` buldu). `preflight.test.js` +1.
- `module/icd-dg-verdrahtung.js` `icdMehrAlsEinKodeJeFeld` (26.09.2026 akşam) — `saveRezept`'teki
  „Trotzdem speichern?" kuralı modüle alındı. Niye: canlı turda yerel `confirm()` otomasyonla
  doğrulanamadı; kural artık testli. Tek kullanım: `dashboard.js` `saveRezept`.
- `dashboard.js` `podoCtx()` — ölü `_wireDgIcdPair` aktarımı silindi. `wireM13Toggles` —
  Fachbereich değişince ICD yeniden değerlendirilir.
- i18n `pod_icd_nach_feld2`, `pod_icd_je_feld` (de/en/tr) · cache `dashboard.js` ve
  `verordnung-podo.js` `?v=20260926a` · `modul-probe.html` listesi · `npm run probe` +`icd-dg-probe`.

### 25.09.2026 · Ops #304 — DG-Automatik nimmt nur Eindeutiges, Papierwert gewinnt
Yeni fonksiyon yok, silinen yok; davranış değişikliği.
- `icd-dg-match.js` `dgVorschlag()` — `auto` artık yalnız başka hiçbir grup `icd_accept` ile
  eşleşmiyorsa döner (`kandidaten.every(k => k === auto)`). Niye: E11.74 + L60.0 `auto:'DF'`
  veriyordu, oysa DF/UI1/UI2 hepsi mümkün; DG kâğıttan gelmeli (Podologie-Vertrag Anlage 3
  Ziffer 5 j). **`autoSelectDg` bilinçli olarak değişmedi** — `api-backend/ai/validators/icdDgRules.js`
  ile parite (ayna çifti, biri değişirse ikisi). Tek tüketici: `dashboard.js` `_wireDgIcdPair`.
- `dashboard.js` `_wireDgIcdPair` — `dataset.manualOverride` kalktı, yerine `dataset.dgAuto`
  (otomatiğin kendi koyduğu değer). `_setDgProgrammatically` yalnız boş alanı ya da kendi
  değerini değiştirir; `''` kendi önerisini geri alır (ICD alanından çıkışta: belirsiz ya da ICD
  silindi). `markManual` yalnız `change`'i dinler, `dgAuto`'yu siler → focusin/`input` dürtüsü
  ve `verordnung-podo.js:schreibe()` otomatiği artık kapatmaz. >1 aday → aday ipucu her zaman.
- `dashboard.js` köprü `ensureDgIcdWiring` (tek çağıran `module/verordnung-maske.js`
  `fuelleMuster13`) — yüklemeden önce `dgAuto` silinir: tarama/düzenleme/Folgeverordnung ile
  gelen DG kâğıt değeridir, üzerine yazılmaz.
- i18n `pod_icd_mismatch` (de/en/tr) yeniden yazıldı · cache `?v=20260925a` · `module/icd-dg-vorschlag.test.js` +2 test.
- İlk kullanım: Rezept-Maske Muster 13 (`rzIcd` → `rzDg`), podoloji.
- **Açık kalan:** DG alanına ikinci yazan yol `module/verordnung-podo.js` `dgAuswahlEingrenzen` /
  `podRegelnLaden` — kopya kartı Melih'te, karar bekliyor. Bu değişiklik onu çözmedi, yalnız
  `schreibe()`'nin otomatiği kapatmasını engelledi.

### 01.10.2026 · Reform 3.12 — PHI-Schattenspalten aus, Fahrtenbuch ohne Patientendaten
- `module/fahrtenbuch-regeln.js` (neu): `fahrtReferenz` (P-XXXXXXXX aus `booking_id`, keine neue Spalte),
  `fahrtZweckUndZiel`, `fahrtAnzeigeText` (maskiert lead_id-Zeilen + Altzeilen „Hausbesuch <Name>"),
  `fahrtenbuchCsv` (11 Spalten, kein Name/Anschrift), `patientenverzeichnisCsv` (getrennter Export,
  nur auf Anforderung des Finanzamts), `csvHerunterladen`. Niye: S-35, legal-de/OFD Frankfurt 19.01.2011.
  Nerede: `dashboard.js` `saveFahrtEndHandler` (Upsert), `loadFbFahrten`, `openFbFahrtEditModal`,
  `exportFbFahrtenCsv` + neuer `exportFbPatientenverzeichnisCsv` (Knopf `fbFahrtenExportVerz`).
- Backend: `/rezept/confirm` + `PATCH /rezept/:id` schreiben `ocr_raw_response`/`ocr_raw_enc`/`icd10_enc`/
  `phi_encrypted` nicht mehr; `encryptPHI`-Import + Start-Warnung aus `server.js` entfernt
  (`lib/phi-encrypt.js` + Schlüssel-Selbsttest bleiben). Wächter: `api-backend/lib/phi-nicht-schreiben.test.js`.
- `select('*')` auf `prescriptions` im Browser verengt: `rechnung-dmrz.js`, `dashboard.js` `handleSessionDrop`.

### 30.09.2026 · Podologie-Reform S4-1 (commit 8716a3d) — Aktionsleiste, Folgetermin, Vorbelegungsgrund, Behandlungstag
- `module/termin-aktionsleiste.js` (neu): `verdrahteAktionsleiste`, `verordnungsZiel`, `SICHTBARE_AKTIONEN`,
  `MENUE_AKTIONEN`. Niye: Konsey S0 (30.09) — rechtes Terminpanel (`#bkActionModal`) höchstens 6 sichtbare
  Knöpfe, Rest im Menü „Weitere Aktionen". Nerede: Verdrahtungsaufruf in `dashboard.js`.
- `module/termin-folge.js` (neu): `folgeterminStart`, `folgeLeistungen`, `oeffneFolgetermin`, `alsLokalesDatetime`.
  Niye: Folgetermin aus dem rechten Panel — füllt die bestehende Neuer-Termin-Maske (`prefillBookingModal`)
  mit demselben Patienten/Hausbesuch/Verordnung/Leistungen, Datum aus der Verordnungsfrequenz
  (`sollAbstand`). Keine zweite Maske.
- `module/podo-vorbelegung-grund.js` (neu): `tagesVorbelegungGrund`, `befundGrundText`, `verordnetZeile`.
  Niye: Konsey S0 Beschluss 2b — Grundtext zur Vor-/Vorschlagsbelegung + Zeile „Verordnet: 78xxx".
  Keine neue Regel, nur Texte. Nerede: `podologie-abrechnung.js`, `termin-leistungen.js`.
- `module/podo-behandlungstag-regel.js` (neu): `abrechenbareBehandlungstage`, `bestehenderBehandlungstag`,
  `zweiterBehandlungstagFrage`, `datumTTMMJJJJ`, `ABRECHENBARE_BEHANDLUNG`. Niye: gkv-302 30.09
  (HeilM-RL § 12 Abs. 8) — Rückfrage beim zweiten Eintrag am selben Tag (`podologie-abrechnung.js`
  `loadPodologieBilling`) und „Bereit" nur mit ≥1 abrechenbarem Behandlungstag (`abrechnungsstatus.js`
  `oeffneStatusDialogFuer`).
- Signaturänderungen: `setzeAktionsSichtbarkeit(hatTermin, podologie)` (termin-panel.js),
  `vorschlagText(code, {…, grund})` (termin-leistungen.js).
- **Kopya adayları (fonksiyon-ustasi 30.09, karar Kemal'de, birleştirilmedi):**
  `alsLokalesDatetime` ↔ `module/datum.js` `alsDatetimeLocal` (aynı çıktı);
  `datumTTMMJJJJ` + `podo-vorbelegung-grund.js` yerel `datumDe` ↔ `module/datum.js` `datumDe`;
  `abrechenbareBehandlungstage` ↔ `verordnung-uebersicht.js` `istBehandlungseinheit` — iki ayrı soru
  (kasıtlı), ama **78620** iki yerde zıt sınıflanıyor (burada Behandlung, orada Zuschlag) → gkv-302 sorusu.

### 30.09.2026 · Podologie-Reform S4-2 (commit f14b2d8) — Fußbefund in der Tagesbehandlung, Folgetermin-Frage, Patientenpost-Status
- `module/podo-tag-zusatz.js` (neu): `fussbefundKopf`, `fussbefundBoxHtml`, `ladeLetzterBefund`. Niye: Konsey S0
  Beschluss 1a — aufklappbarer Fußbefund-Abschnitt in der Tagesbehandlung; zu nur „zuletzt am …", auf wird die
  vorhandene Karte (`mountFussbefund`) eingesetzt, die selbst nach `pat_fussbefund` schreibt — kein zweiter
  Schreibweg. Nerede: `podologie-abrechnung.js` `loadPodologieBilling`.
- Ebenda `folgeAusgangstermin`, `ladeTagesTermin`, `frageFolgetermin`, `FOLGE_FRAGE` (+ `podologie-abrechnung.js`
  `fragFolgetermin`, Verdrahtung). Niye: S0 Beschluss 1b — nach dem Speichern „Folgetermin jetzt anlegen?", legt
  nichts an, öffnet die vorhandene Maske über `termin-folge.js` `oeffneFolgetermin`. Hausbesuch: erst Fahrt
  beenden, dann fragen (`fahrtBeendenKlick` → `onFertig`).
- `module/lead-status.js` (neu): `LEAD_STATUS_DE`, `leadStatusLabel`. Niye: canli-test 30.09 P3 — Patientenpost-Badge
  zeigte Rohwert (`new`, `contacted`). Nerede: `dashboard.js` `renderB2C`. Unbekannte Werte bleiben roh.
- Signaturänderungen: `mountFussbefund(deps, preset, { wurzel })` (eingebettete Wurzel; Karte bleibt ein Exemplar),
  `oeffneFolgetermin` nimmt Ausgangstermin ohne `id` (dann keine Leistungen gelesen), `zeigeFahrtHinweis` → boolean.
- **Kopya kontrolü (fonksiyon-ustasi 30.09, birleştirilmedi):** `ladeLetzterBefund` — kopya değil; diğer
  `pat_fussbefund` okuyucuları (`fussbefund.js` `ladePatientenkontext`, `fussbefund-archiv.js`
  `renderFussbefundArchiv`, `patientenkarte.js` `ladeVerlauf`) tam liste/zaman çizelgesi çekiyor, aynı
  `ist_aktuell` kuralıyla; tek-tarih okuyucusu başka yok. `leadStatusLabel` — kopya değil, lead status için başka
  etiket haritası yok (`b2bStatusBadge` ayrı tablo, `abrechnungsstatus.js` ayrı eksen). `ladeTagesTermin` ↔
  `termin-laden.js` `ladeTerminVollstaendig` kopya değil (o id ile okur); ama **yakın aday:**
  `podologie-abrechnung.js` `podGeplanteHpnr` aynı soruyu (Verordnung'un o günkü termini) soruyor ve günü
  Berlin'e göre (`alsISODatum`) kesiyor, `ladeTagesTermin` tarayıcı yerel gece yarısıyla — iki gün sınırı kuralı.

### 30.09.2026 · Öffentliche Seiten + Anwesenheit (O-140) + S6 temizliği — builder bildirimi

- `module/public-owner.js` (neu): `slugAusKennung`, `kennungAusSuche`, `ladeOwnerId`. Niye: booking.html `?u=` ve
  booking-request.html `?business=` iki link şemasını tek yerde çözmek (Reform S4). Nerede: `booking-request.js` +
  `booking-request.html` inline modül.
- `module/anfrage-anliegen.js` (neu): `ANLIEGEN`, `zahlungsartenFuer`, `hausbesuchFrageNoetig`, `anliegenNotiz`,
  `anliegenFuerBereich`, `findAnliegen`, `heilmittelFrage`, `behandlungsartFuer` + metin sabitleri. Niye: podoloji
  Online-Anfrage kararları (Rezept / Nagelspange / ohne Rezept). Nerede: `booking-request.js`
  (`aktualisiereHausbesuch`, `setzeHausbesuch`, `behandlungsartAktuell`, `zeigeHeilmittelFrage`). `adressePflicht` silindi.
- `module/public-supabase.js` (neu): `getPublicClient`. Niye: canli-test P3 — iki `createClient` → „Multiple
  GoTrueClient instances". Nerede: booking-request.js + inline modül.
- `module/praxis-standort.js` (neu): `standortStatusText`, `mountPraxisStandort`. Niye: onprem O-140 — Nominatim
  CSP'ye takılıyordu, `clinic_lat` boş kalıyordu; konum owner cihazından `businesses.clinic_lat/lng`'e. Nerede:
  dashboard.js Anwesenheit yüklemesi. `ensureBusinessCoords` silindi.
- Silinen: `reportSidebarVisibility` (visibility_reports, 14.07'den beri 403 — db-ustasi W-07); login/kalender/setup
  EN/TR sözlükleri. Düzeltilen: `patient-termine.js` `ladePatientTermine` → lead_id; `akte-podo.js` fizyo Rezept
  listesini podolojide gizler.
- **Kopya kontrolü (fonksiyon-ustasi 30.09, birleştirilmedi — karar kullanıcının):**
  - 🔴 **Aday:** `booking.js:8-100` kendi owner çözümlemesini taşıyor (slug/URL kırpma, UUID, `INF-` RPC,
    `booking_slug` or-filtresi, businesses fallback) — `ladeOwnerId`'nin ikinci uygulaması. Kural farkı:
    `booking.js` `?business=` değerini slug olarak da kabul ediyor, `kennungAusSuche` UUID değilse reddediyor;
    `booking.js`'te PostgREST filtresine giden slug için `^[\w.-]+$` koruması yok. Fark: booking.js owner id'yi
    değil tam profil + business bağlamını istiyor → birleşirse `ladeOwnerId` sonrası profil ayrıca okunur.
  - 🟡 `booking.js:4` hâlâ kendi `createClient`'ını açıyor — tek istemci olduğu için uyarı üretmez, kopya değil.
  - 🟡 **Yakın aday (farklı tablo):** `dashboard.js` `ensureClinicLocation` praxis konumunu `profiles.clinic_lat/lng`'e
    (Fahrtenbuch geocode, adres üzerinden) yazıyor; `mountPraxisStandort` `businesses.clinic_lat/lng`'e (cihaz GPS).
    Aynı kavram iki tabloda — db-ustasi'ye sorulmalı; tek-praxis owner'da `businesses` kaydı olmayabilir.
  - `anfrage-anliegen.js` — kopya değil; Nagelspange kuralları dashboard/abrechnung'da HPNR/Befundpauschale düzeyinde,
    hasta tarafı Anliegen sorusu başka yerde yok.


### 07.10.2026 · M3 — lokale PDF417-Erfassung — Intentmeldung

- `module/rezept-barcode.js`, `rezept-barcode-scan.js`, `rezept-barcode-dialog.js`,
  `rezept-barcode-bestaetigung.js`: lokale Bild/PDF/Kamera-Erkennung und KBV-BFB-Muster-13-Parser.
  Zweck: Barcodewerte in bestehende `rezept-in-maske.js` / `verordnung-maske.js` übernehmen;
  Papiervergleich vor bestehendem Confirm/PATCH erzwingen. Kein zweiter Formular- oder Speicherweg,
  kein automatischer Cloud-Upload bei erfolglosem Scan. Erste Integration: Rezept anlegen im Dashboard.
- `module/podologie-heilmittel-position.js` (`podologiePositionFuerText`): kanonische deterministische
  HPNR-Zuordnung. `api-backend/lib/podologie-heilmittel-position.js` ist byteidentische generierte
  Spiegelung für Docker-Laufzeitgrenze; Sync-Test verhindert unabhängige Regelpflege. Bewusste Spiegelung,
  kein eigenständiger zweiter Mappingweg.
- `api-backend/lib/rezept-erfassung.js` (`validiereBarcodeErfassung`, `computedMitErfassung`):
  whitelisted Barcode-Provenienz in bestehendem `computed` für POST/PATCH; keine Barcode-Rohdaten.
- Kartenprüfung: erzeugt 07.10.2026, 3076 Funktionen / 373 Dateien. Gezielte Integrationsprüfung
  bestätigt bestehende Masken- und Speichernaht; kein konkreter Doppelweg gefunden.
- Vom Builder gemeldete Prüfung: 2864 Tests grün, Typecheck grün, Browserprobe 21/21.
  Echte Box, Telefonkamera und Live-Speichern bleiben offen; hier nicht erneut ausgeführt.


### 07.10.2026 · M3 Teamreview — Speicherlauf und Dialogabschluss — Intentmeldung

- `module/rezept-speicher-riegel.js` (`beginRezeptSpeicherlauf`): verhindert geänderte
  Formularwerte während asynchronem Speichern. Erster Einsatz: `dashboard.js` `saveRezept`;
  Eintrittssnapshot, disabled/inert, Prüfung vor Writes, Freigabe in finally. Bestehender
  Speicherweg bleibt erhalten.
- `module/bestaetigungs-dialog.js` (`zeigeBestaetigungsDialog`): bestehender Confirm-Dialog
  löst auch bei generischem Schließen/Escape mit false auf. Erster Einsatz: `dashboard.js`
  `showConfirmModal`-Wrapper. Zweck: hängende Speicherläufe und dauerhaft gesperrte Maske vermeiden.
- Vom Builder gemeldet: gezielte Tests 13/13 und Browserprobe 29/29; hier nicht erneut ausgeführt.
  Funktionskarte wird durch Builder aktualisiert.

### M3-Nachmeldung: Modal-Escape und gespeicherte Barcode-Verordnungen (07.10.2026)

`module/modal-escape.js` übernimmt bisherigen Dashboard-Escape-Handler, damit
Produkt und Browserprobe dieselbe Modalpriorität prüfen. Erster Einsatz:
`dashboard.js`; zusätzlich `tools/browser-probe/rezept-barcode-probe.html`.
Bestehendes `maskeEinbetten` montiert nach vollständiger Befüllung erneut
`mountBarcodeBestaetigung`: alte gespeicherte Bestätigung darf aktuelle Änderungen
nicht freigeben. `schreibeVerordnung` trägt frische Metadaten im PATCH; Backend
verlangt sie für gespeicherte Barcodequelle. Echte lokale UI/DB-Abnahme war Auslöser.

### 08.10.2026 · M4 — KI-Gateway und Freigaben — Intentmeldung

- `api-backend/ai/ki-gateway.js` (`executeKiTask`): gemeinsame Eintrittsstelle für bestehende
  KI-Tasks. Zweck: geschlossene Eingabeschemas, tenantbezogenes Wörterbuch, Maskierung,
  Restprüfung und gebundene Rückfragen vor dem Azure-Transport durchsetzen. Erste Integration:
  bestehende Backend-Task-Handler über `run`; Kategorie C und OCR bleiben früh gesperrt.
  `ki-schema.js`, `ki-woerterbuch.js` und serverseitiges `ki-rueckfrage.js` sind bewusste
  Schichten dieses Ablaufs, keine unabhängigen zweiten Task-Wege.
- `api-backend/ai/ki-einwilligung.js` (`createOwnerDecisionStore`): versionierte Owner-Entscheidung
  für Tenant und Box in separatem privatem Volume. Zweck: individuelle Freigabe zusätzlich
  zu Betreiber-, Mail- und Freitextschaltern prüfen; Standard bleibt ausgeschaltet.
  `ki-jeton.js` (`createJetonClient`) hält Transportberechtigung im RAM. Gateway-Callback
  `beforeSend` soll aktuelle Freigabe und Konfiguration unmittelbar vor jedem Send prüfen.
  Auditdaten dienen aggregierter Nutzungserfassung, nicht als Freigabe- oder Produktionsnachweis.
- `module/ki-client.js` (`requestKiTask`, `runMailDraftInUi`), `module/ki-rueckfrage.js`
  (`zeigeKiRueckfrageDialog`) und `module/ki-einstellungen.js` (`mountKiEinstellungen`):
  gemeinsamer Browservertrag für Task-Aufruf, abbrechbare Rückfrage und Owner-Einstellungen.
  Erster Einsatz: Dashboard-Mailentwürfe, Terminbestätigung und Einstellungen. Bestehende
  Termin- und Leistungswerte werden lokal wieder eingesetzt; B2B-Kontakte folgen Backend-Feld
  `company`. Browser-Spracherkennung bleibt ohne freigegebenen Audio-Endpunkt gesperrt.
- Funktionenkarte bei dieser Nachmeldung: erzeugt 08.10.2026, 3192 Einträge. Gezielte
  Karten- und Quellenprüfung bestätigt genannte Integrationsstellen. Diese Intentmeldung
  bestätigt weder abgeschlossene QA noch externe Provider-, Rechts- oder Produktionsfreigabe.
