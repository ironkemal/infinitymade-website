# Podoloji reform sprinti

> Kaynak: 28.09.2026 uçtan uca canlı test (sentetik owner "TEST-Podologie QA") +
> 28.09 `canli-test` kontrol turu. Rapor: https://claude.ai/artifact/5dKYyNndv11AsfXS9UYD7g
> (ham bulgular B-001…B-119). Ekran sicili: `canli-test/REGISTER.md` → 28.09 kayıtları.
>
> **Kurallar (Kemal, 28.09.2026):**
> - Bu sprint için **Ops kartı açılmaz.** Plan bu dosyada yaşar.
> - Tek oturumda ya da oturumlara bölünerek **tek seferde** bitirilir.
> - Reformla çözülen eski Ops kartları **sprintin son işi** olarak kapatılır (S7).
> - Ürün yalnız Almanca: yeni metinde yalnız `de` sözlüğü güncellenir.
>
> Her oturumun sonunda: `canli-test` yalnız o oturumun akışlarını yeniden sınar (taze `goto`,
> `-s=praxura-qa`), `fonksiyon-ustasi`'na "niye + nerede" bildirilir, "harita güncelle",
> gerekiyorsa "şema güncelle", `fortschritte/<gün>.md`. Push her adım tek başına bitmişse.

## Çalışma yöntemi: ana oturum şef, iş subagent'larda (Kemal, 28.09)

Ana oturum kod yazmaz; planlar, dağıtır, doğrular, commit/push eder. Her madde için sıra:

1. **Sor** — `fonksiyon-ustasi`: "şunu yapacağım, var mı / nereye dokunur?" Şema varsa `db-ustasi`,
   dış çağrı/şema/env varsa `onprem`. (Bu üçü izin sormadan çağrılır — CLAUDE.md.)
2. **Uygula** — subagent: çok adımlı/çok dosyalı işler `builder`'a; tek dosyalık net işler
   `Agent` + `model: sonnet`; CSS işleri `mobil-ui`. Prompt'a şunlar girer: madde numarası,
   dosya:satır, "bitti" ölçütü, `dashboard.js` BÜYÜMEZ (yeni kod `module/`'e), yalnız `de` metin,
   koyu tema değişkenleri, commit YOK.
3. **Denetle** — alan sorusu varsa `gkv-302` (fatura) / `podoloji` (akış); diff'i ana oturum okur,
   `npm test` + `bash tools/check-dashboard-size.sh`.
4. **Doğrula** — `canli-test`, yalnız o maddenin akışı, deploy sonrası taze `goto`, `-s=praxura-qa`.
5. **Bildir** — `fonksiyon-ustasi`'na "niye + nerede"; oturum sonunda "harita güncelle".
6. **Commit + push** ana oturumda, ön planda (subagent'ta push asılı kalır). Madde başına bir commit.

Paralellik: aynı dosyaya dokunan iki subagent **aynı anda çalışmaz** (özellikle `dashboard.js`,
`dashboard.html`). Farklı modüller paralel olabilir. Subagent bir izin reddi alırsa ana oturum
dolanmaz, Kemal'e sorar.

## Durum tablosu

| Oturum | Konu | Karar gerekir mi | Durum |
|---|---|---|---|
| S0 | Ürün kararları (/konsey) + Beta-1 soruları | evet | ⏳ |
| S1 | Randevu → reçete → tedavi zinciri (P0) | hayır | ✅ kod tamam (1.1–1.11, 29.09); 1.9–1.11 canlı doğrulaması bekliyor — bkz. S1 devir notu |
| S2 | §302 durum semantiği | kısmen (gkv-302) | ⏳ |
| S3 | Güvenilirlik ve veri doğruluğu | hayır | ⏳ |
| S4 | Arayüz reformu (menü, sağ panel, dosya, anamnez, Fußbefund) | S0'a bağlı | ⏳ |
| S5 | Mobil / tablet (yalnız CSS) | hayır | ⏳ |
| S6 | Temizlik: yalnız Almanca, ölü kod, konsol | hayır | ⏳ |
| S7 | Kapanış: tam regresyon turu + Ops kartlarını kapat | — | ⏳ |

S0 ile S1–S3 paralel yürüyebilir; S4 S0 bitmeden başlamaz.

---

## S0 · Ürün kararları (önce, paralel)

`/konsey` — tek oturum, iki soru. Katılımcı: podoloji, gkv-302, muhalif, deger-mi, fonksiyon-ustasi (+ legal-de soru 2c için).

1. **Tedavi günü ve sağ panel:** Randevudan tek "Behandlung dokumentieren" ekranı (Leistungen + Fußbefund + not + Abschließen → Folgetermin?) mı, yoksa bugünkü Behandlungen paneli kalıp yalnız doğru yönlendirme mi? Sağ panelde hangi 6 aksiyon?
2. **Kapanmış kararlarla çelişkiler:**
   a) 10.08: "Wagner görünür kalır" — 18.09'da maskeden çıktı, yeri yok. Fußbefund'a mı?
   b) 05.09: "Zusatzleistung otomatik işaretlenmez" — bugün 78040/78030 önseçili, 78010 değil. Verordnete pozisyon önseçili, Befund önerili-işaretsiz kuralı kabul mü?
   c) Fahrtenbuch `zweck`'inde hasta adı (legal-de + guvenlik S-35).
3. **Menü önerisi** (podoloji ajanı): Heute · Termine · Patienten · Abrechnung · Praxis · Einstellungen (≈14 giriş). Menü değişikliği `nav-registry.js` + `module_visibility` ile; satır silinmez.

**Beta-1'e 10 dakikalık sorular** (kurucunun işi, konseyden bağımsız):
- Anamnezi hastayla birlikte mi dolduruyorsun, hasta tek başına mı?
- DF hastasında her seans neyi belgelersin (Sensibilität, Puls, Wagner, Ulkus)?
- Seans sonunda ekranda ne görmek istersin: sadece "bitti" mi, Folgetermin mi?
- Hausbesuch randevusu 87 dk (yol + seans + 10 dk tampon) bloklanıyor — doğru mu?
- Yarım kalan reçeteyi (ör. 1/3 seans) ne yapıyorsun — faturalayıp kapatıyor musun, kalanı sonra mı faturalıyorsun? (S2.5 kararının dayanağı)
- Hausbesuch'a kendi arabanla mı, praxis arabasıyla mı gidiyorsun? (S3.4 varsayılanı)

**Bitti:** konsey kararı `konsey/KARARLAR.md`'de, podoloji kararları `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md`'de.

---

## S1 · Randevu → reçete → tedavi zinciri (P0, karar gerektirmez)

| # | İş | Nerede | Efor | Bitti ölçütü |
|---|---|---|---|---|
| 1.1 ✅ `b41d31d` | Terminmodal'da reçete kartı seçilince podoloji reçetesini tanı, `_pendingRxSession = { prescriptionId, podoVordId }` kur; "Alle Sitzungen bereits vergeben" 0/3'te çıkmasın | `module/termin-verordnung.js:142` (`waehleVerordnung`), `dashboard.js:5114/5129` (`loadBkVerordnungen` select'ine `therapie_bereich`) | S | Kartla kaydedilen randevuda `bookings.verordnung_id` dolu; portalda "Termine (1)" |
| 1.2 ✅ `2db4146` | Bağlamayı UPDATE koluna da taşı (mevcut randevuyu düzenleyip kart seçmek) | `dashboard.js:6064-6088` | S | Düzenlenen randevu bağlanıyor |
| 1.3 ✅ `2a596dc` | Aynı panelde "0/3" ile "keine aktive Verordnung hinterlegt" çelişkisini gider | Termin-Aktionen, `module/podo-einheiten.js` | S | Tek, tutarlı Verordnung bloğu |
| 1.4 ✅ `45d91c3` | Podolojide "Termin Starten" → `oeffnePodoBehandlungen(b.lead_id)`; `markPrescriptionSession` ve isimle hasta arama atlanır; Hausbesuch dalı da | `dashboard.js:4349-4417`, hedef `dashboard.js:6126` | S | Not kaybı yok, Tagesbehandlung o hastanın reçetesiyle açılır |
| 1.5 ✅ `65a1b9e` | Tagesbehandlung'da reçetenin `heilmittel_position`'ı (78010/78020) her seansta önseçili; 78030/78040 kurala göre önerili | `module/podologie-abrechnung.js:314-320` | S | 2. seansta 78030 + 78010 hazır gelir |
| 1.6 ✅ `0520c3f` | Preflight: "78030/78040 var, 78010/78020 yok" = blok | `api-backend/billing/…/preflight.js` | S | Test ile kanıtlı (`node --test`) |
| 1.7 ✅ modül `2d8aea5`+hotfix `94c753c`, çağıran `45d91c3` | Tagesbehandlung tarihi randevudan gelsin (bugün sabit "heute") | `module/podologie-abrechnung.js` | M | Randevudan açılınca tarih = randevu tarihi |
| 1.8 ✅ `72e56cb` | Podolojide seri dağıtma kapalı (`module/podo-einheiten.js:320`) → açılabilir mi, 1.1'le aynı bağlama yolu | `module/termin-aktionen.js:467`, `module/podo-einheiten.js:320` | M | Kalan seanslar tek adımda dağıtılır ve bağlanır |
| 1.9 ✅ `dbd79f0` | **gkv-302 bulgusu 29.09:** podolojide kesinti Verordnung'u geçersiz KILMAZ (HeilM-RL §16 Abs.4 S.5) — `module/frequenz-pruefung.js:53` `UNTERBRECHUNG_TAGE=12*7` + 329-331 metni yanlış (FAK Nr. 11 ters okunmuş). Seride ilk randevu için Behandlungsbeginn fristi 28 gün / dringlich 14 gün (§15) = BLOK; frekans sapması SARI uyarı, UI1/UI2'de uyarı yok. İki kural `wissensbank/SPEC-RULES.md`'ye | `module/frequenz-pruefung.js`, seri önizlemesi | S–M | Podoloji serisinde 12 hafta uyarısı yok; ilk randevu fristi aşarsa onay engelli |
| 1.10 ✅ `32f1a4d` | **canli-test 29.09 (S1.8), P1:** KI seri yolu (`aiSuggestConfirm` dashboard.js ~6773-6791) yalnız `service.duration` gönderiyor, batch sonrası `speichereLeistungen` yok → seri randevuları 35 dk ve `booking_leistungen`'siz (maske 78010+78030 / 65 dk gösteriyordu) | `dashboard.js` aiSuggestConfirm, `module/termin-leistungen.js` | S–M | Seriyle oluşan her randevuda maskedeki Leistungen ve süre |
| 1.11 ✅ `24d751b` | **canli-test 29.09 (S1.8), P2:** (a) seri/randevu maskesindeki Verordnung kartı podo'da 0/3 — `zeigeVerordnungenFuerTermin` → `rendereVeroKarten` çağrısına `sb/ownerId/leadId` geçmiyor (1.3 yalnız paneli düzeltti); (b) seri sonrası e-posta diyaloğu ✕ → podolojide Rechnungen paneline gidiyor (`proceedToRechnungForPhysio`), gelecek tarihli seride yanlış. **podoloji kararı:** podo seride fatura adımı tamamen atlanır (`proceedToRechnungForPhysio` ~7462, çağrı ~7356/~7404), kullanıcı Verordnung/hasta görünümünde kalır; e-posta varsa tek tıkla geçilebilir „Terminübersicht mitgeben (Drucken / E-Mail)", yoksa yalnız Drucken, e-posta sorulmaz | `module/termin-verordnung.js`, `dashboard.js` ~6830 | S | Maske sayacı doğru; podo seride fatura adımı yok |

Ajanlar: fonksiyon-ustasi (önce/sonra), gkv-302 (1.5/1.6), canli-test (sonra).

**S1 dışına not (29.09):** (1) Fizyo/Ergo/Logo'da gerçek kesinti sınırı gerekçesiz **14 gün** (HeilM-RL §16 Abs.4 S.1, wissensbank Z-16); kod 84 gün kullanıyor (`module/frequenz-pruefung.js` `UNTERBRECHUNG_TAGE`) — fizyo ince ayarı ertelendi, o sırası gelince. (2) Manuel `batch-create` ve KI seri yolunda Hausbesuch yol süresi (2×yol + tampon) eklenmiyor; tekli kayıt ekliyor (fonksiyon-ustasi) — S3'e aday.

### S1 devir notu (29.09.2026 — oturum burada temiz durdu)

**Bitti ve push edildi:** 1.1 `b41d31d` · 1.2 `2db4146` · 1.5 `65a1b9e` · 1.6 `0520c3f` (+ `wissensbank/SPEC-RULES.md` kaydı) ·
1.7 modül tarafı `2d8aea5` + hotfix `94c753c`. Ek: pre-commit sözdizimi kapısı `90c5652`.

**Kalan, bu sırayla (hepsi `dashboard.js`'e dokunuyor → SIRAYLA, paralel değil):**
1. **1.3** — panelde iki blok iki ayrı sorgudan: "Aktive Verordnungen 0/3" `dashboard.js:~3548` (sayaç `prescription_sessions`'tan, podolojide hep 0) vs "keine aktive Verordnung" `loadRxSessionsPanel` `dashboard.js:~6150` (yalnız `prescription_sessions.booking_id`'ye bakıyor, `bookings.verordnung_id`'yi okumuyor; `TERMIN_SELECT` `module/termin-laden.js:50` ve `dashboard.js:~1752` select'inde `verordnung_id` yok) + `ladeVerordnung` (`module/podo-einheiten.js:224`) `abrechnung_status IS NULL|bereit` filtresi. Üç ayrı "laufend" tanımı var (fonksiyon-ustasi). Önce `verordnung_id`'yi termin nesnesine ekle — 1.4 buna dayanıyor.
2. **1.4** — `handleTerminStarten` `dashboard.js:~4355-4417`: podolojide `markPrescriptionSession` (fizyo defteri, not kayboluyor) ve `split('·')` isim araması yerine `oeffnePodoBehandlungen(b.lead_id)` (`dashboard.js:~6124`); `b.verordnung_id` varsa o reçete, **ve `setPodVorwahl(vordId, { datum: randevu günü })`** ile 1.7'yi tamamla. Karar (Kemal'e bildirildi): podolojide not sorusu kalkar, not Tagesbehandlung'un mevcut not alanına girer. Hausbesuch dalı dahil. Mantık modüle; `dashboard.js` taban 20602.
3. **1.8** — seri dağıtma: `module/podo-einheiten.js:~321` butonu kapatıyor. ⚠ Tuzak: `linkBookingsToPrescriptionSessions` (`dashboard.js:~7269`, `gleicheSitzungenAb`) podoloji korumasız → podoloji reçetesinde `prescription_sessions` üretir. `dashboard.js:~6844`'te `therapie_bereich==='podo'` dalı açıp her booking için `bindeTermin`; backend'e route açma. `frequenz` `ladeVerordnung` select'ine eklenmeli. `podoloji` ajanı akışı denetlesin.

**Canlı doğrulama (29.09, hotfix sonrası):** dashboard açılıyor · 1.1 GEÇTİ (`verordnung_id` yazıldı, portal "Termine: 1") · 1.5 GEÇTİ kısmen (78010+78030 önseçili; ilk gün 78040 ve c)-dalı için QA'da veri yok) · 1.6 SINANAMADI (tedavisiz 78030'lu reçete yok; birim testleri kanıt). 1.2 ve 1.7 canlıda sınanmadı — 1.4 bitince birlikte sına. Yan gözlem (P3): düzenleme penceresinin başlığı "Neuer Termin" kalıyor.

**Dersler / tuzaklar:**
- 28.09 22:49–29.09 ~10:40: `2d8aea5` template literal içindeki HTML yorumunda backtick → canlı dashboard boş (beta dahil). Artık pre-commit `tools/check-syntax.sh` yakalar; yine de diff'te template literal içindeki `` ` `` karakterine bak.
- `git push` öncesi `git fetch`: paralel oturum `main`'e yazıyor (28.09'da 30 commit geride kalındı).
- `npm test` / kapılar `db/NUTZUNG.*`'ı yeniden üretebiliyor — madde commit'lerine karıştırma, oturum sonunda ayrı tazele.
- Import `?v=` sürümü: `vercel.json` `max-age=0, must-revalidate` verdiği için eski modül servis edilmiyor; yine de dokunulan modülün `?v=`'sini artır.
- `erstePositionAusItems` hâlâ iki kopya: `module/verordnung-pruefung.js:361` (export'lu) + `module/verordnung-maske.js:339` (eski, export'suz). Birleştirme kararı Kemal'in (fonksiyon-ustasi).
- 1.6(b) (yalnız 78040'lı reçete) kaynakta açık cümle yok — GKV-SV/ZFD teyidi gelince sert bloğa çevrilebilir.


---

## S2 · §302 durum semantiği

| # | İş | Efor | Bitti ölçütü |
|---|---|---|---|
| 2.1 | **Test dosyası reçeteyi festschreiben yapmaz.** Durum zinciri: `erstellt` → `übermittelt` (yalnız Echt, kilit burada) → `quittiert/abgewiesen` → `bezahlt/abgesetzt` (gkv-302, Anhang 2 Kap. 9 §5) | M–L | Test DTA sonrası reçete düzenlenebilir, "an die Kasse übermittelt" yazmaz |
| 2.2 | Detayda "Eingereicht: noch nicht" ↔ "Eingereicht 43,29 €" çelişkisi → "In Datei (Test)" | S | Tek, doğru dil |
| 2.3 | **Kemal kararı 28.09 (VKZ 02 yerine):** açık seanslı reçete "Bereit"e alınırken ya da §302 seçimine girerken `showConfirmModal`: „Es sind noch N Einheit(en) offen. Die Verordnung wird damit abgeschlossen, offene Einheiten verfallen. Trotzdem abrechnen?" Onaysız Teilabrechnung yok; onay loglanır | S | Onaysız geçiş imkânsız; metin gkv-302 onaylı |
| 2.4 | Erstellen sonrası: protokol boş-durum dalında da çizilir, görünüm "Bisherige"ye geçer | S | Yenilemeden liste görünür (`module/abrechnung-auswahl.js:590-598, 1043`) |
| 2.5 | ~~VKZ 02 Nachforderung~~ — **bu sprintte YAPILMAZ** (Kemal, 28.09). Gerekçe: Muster-13 aslı faturayla gider, yarım reçetenin kalanını sonra faturalamak nadir; 2.3 bilinçli kararı sağlar. Beta-1'e soru: "Yarım kalan reçeteyi ne yapıyorsun?" — cevap "sık" ise ayrı iş olarak açılır | — | — |
| 2.6 | 79933 yalnız reçetede Hausbesuch=Ja iken önerilir; Nein/boşsa 79933/79934 blok | S | Anlage 3 Podo c) |
| 2.7 | IK hatası "Kein IK-Nummer" → "Praxis-IK fehlt — unter Einstellungen → Abrechnung eintragen" + link | S | — |

Ajanlar: gkv-302 (her madde), db-ustasi (2.1 durum kolonları), onprem (2.1 şema değişirse).

---

## S3 · Güvenilirlik ve veri doğruluğu

| # | İş | Nerede | Efor |
|---|---|---|---|
| 3.1 | Neuer Patient: `geburtsdatum` + `hausbesuch` sütuna yazılsın; metadata'dan backfill; terminmodal hasta seçince Hausbesuch önseçsin | `dashboard.js:9154-9164`, `applyLeadById` 5102; backfill db-ustasi | S+M |
| 3.2 | Vorlagen CHECK'e `rechnung_ausfall` (migration + döküm) | `api-backend/db/migrations/`, `db/SCHEMA*.sql` | S |
| 3.3 | Çift bağlı 9 düğme: inline `onclick` kaldır (canlıda Fahrt zinciri 2× istek, araç 2× satır doğrulandı) | `dashboard.html` 1966, 4825, 4834, 4841, 4858, 5103, 5129, 5215, 5254 | S |
| 3.4 | **Kemal kararı 28.09:** araç için TEK kaydetme yolu kalır = `saveVehicleEdit` (tür kullanıcı seçer). Fahrt Starten'deki "+ Neues Privatfahrzeug" → "+ Fahrzeug" olur ve aynı küçük formu açar; formda "Praxisfahrzeug / Privatfahrzeug" seçimi, varsayılan owner→Praxis, çalışan→Privat. `saveQuickVehicleHandler` kaldırılır (kod modüle göç ederse `dashboard.js` küçülür). Bitti: tek tık = tek satır, tür seçilen değer | `dashboard.js:4105-4127`, `saveVehicleEdit` 18082, `dashboard.html` quickVehicleModal | S |
| 3.5 | Hata kaydetme düğmesinin yanında (çakışma dahil); toast yalnız başarı. Tarayıcı `confirm()` → `showConfirmModal` | `dashboard.js:6066`, Verordnung formu | S |
| 3.6 | Endständig olmayan ICD seçimde ve preflight'ta blok | `katalog-suche.js`, `preflight.js:99-101` | S |
| 3.7 | LANR Prüfziffer formda uyarı; LANR/Unterschrift yoksa Behandlung/"Bereit" blok, BSNR yalnız uyarı | `arzt-register.js`, Verordnung formu, preflight 305-307 | S |
| 3.8 | Kasse IK'sı Kostenträgerdatei'den, hastaya IK yazılsın; IK boşsa formda sert uyarı | `krankenkassen` dropdown ← `kostentraeger`, db-ustasi | M |
| 3.9 | ICD öneri listesi panel değişince kapansın (`requestSeq++` in `closeDropdown`, `activeElement` kontrolü) | `katalog-suche.js:206/349` | S |
| 3.10 | `customer_name` = yalnız ad; kalender kartı `parseNameMitGeburt()`; `split('·')` 4 yer | `dashboard.js:2191-2204, 5105`, `module/termin-patient-bezug.js:42` | S–M |
| 3.11 | 78030 süresi (`duration: null`) Folgetermin'e +30 dk eklemesin | `dashboard.js:9409` | S |
| 3.13 | **Tagesbehandlung'dan "Fahrt beenden"** (podoloji, 29.09, P2): Hausbesuch'ta "Termin starten" artık Tagesbehandlung'a gidiyor; kayıttan sonra `fahrt_status=in_progress` ise kaydet onayının yanında "Fahrt beenden" düğmesi — yoksa Fahrt açık kalır, Fahrtenbuch eksik | `module/podo-behandlungen-oeffnen.js`, `podologie-abrechnung.js`, `renderBkActionFahrtState` | S |
| 3.12 | Açık metin PHI (guvenlik sicili S-34/S-35) — yön guvenlik + db-ustasi ile | `api-backend/server.js` /rezept/confirm, `leads` | M |

---

## S4 · Arayüz reformu (S0 kararına göre)

- Menü: S0 kararındaki yapı; Fahrtenbuch podoloji menüsüne; Demo-Modus kaldır; Feedback yardım ikonuna.
- Sağ panel: 1 birincil ("Behandlung dokumentieren") + Verschieben · Absagen · Nicht erschienen · Folgetermin · Akte; "…": Drucken, Löschen. "Löschen" etiketi Absage'den ayrılır. Taşıma sonrası panel güncellenir.
- Hasta dosyası: 11 → 6 sekme (Verlauf · Anamnese · Fußbefund · Verordnungen · Dokumente · Rechnungen), başlıkta "+ Termin", "+ Verordnung". Messreihen ve Überweisung podolojide gizli.
- Anamnese: Tagesbehandlung'da hastanın Anamnese kaydı yoksa engellemeyen "Anamnese fehlt" uyarısı + tek tık bağlantı (podoloji, 29.09 — S1.4 ilk seansta otomatik Anamnese yönlendirmesini kaldırdı; gkv-302'ye sor: fatura şartı mı?).
- Anamnese: podoloji içeriği (diyabet/HbA1c, antikoagülasyon, pAVK, nöropati, ülser/amputasyon, dializ, alerji, ayakkabı/Einlagen, Hausarzt/Diabetologe); kiosk'ta yalnız onam.
- Fußbefund: Wagner/Armstrong (S0-2a), DF'de Sensibilität, Fußpulse, Ulkus; L/R etiketi; Speichern altta sabit.
- Terminoloji: "Neuer Lead" → "Neuer Patient", "Kundenname" → "Patient", "Dienstleistung" → "Leistung"; "(Ops #244)" kullanıcıdan gizli.
- Selbstzahler randevusu: GKV pozisyonları gizli, Preisstufen + son tutar.
- Online-Anfrage: hasta sebep seçer (mit Verordnung · Erstbehandlung · Hausbesuch · Nagelspange · Fußpflege); `booking.html` boş sayfa; iki link şeması tekleşir.
- Takvimde sürükle-bırak ile taşıma (bugün yok) — S0'da "gerekli mi" sorusu.

Ajanlar: podoloji, fonksiyon-ustasi, mobil-ui (yeni ekranlar tablet ölçüsü).

---

## S5 · Mobil / tablet (yalnız CSS, mobil-ui)

P0 Fußbefund "Rechts" sütunu 375 px'de görünmüyor (`.fbp-card-container`) · P1 Patientenakte sekmeleri (`.pd-tabs` kendi `overflow-x:auto`) · P1 Termin-Aktionen hedefleri ≥44 px, yıkıcı düğmelere boşluk · P1 Einstellungen Konten "×" · P1 Muster-13 375 · P1 Behandlungen 2 sütun · P1 kalender kartı soyad · P2 sağ padding 0, sidebar gölgesi, küçük ikon düğmeleri. Ayrıntı: rapordaki mobil tablo.

---

## S6 · Temizlik

- Yalnız Almanca: `dashboard.js` en/tr sözlüğü (~390 satır), `langSelect`/`setLang` kalıntıları, `labelEn/labelTr`, `login.html` DE/EN/TR düğmeleri, `infinity_lang`; CLAUDE.md "üç dili güncelle" kuralı kaldırılır.
- `triggerNoShowBot` + "Bot wurde ausgelöst" toast'u silinir.
- Konsol: `loadActivityFeed` TypeError (her yüklemede), `visibility_reports` 403 (W-07), `[init]` logları, Nominatim CSP (ya `connect-src`'e ekle ya sunucuya taşı — onprem'e sor).
- Metinler: "Kein Präferenz", "entfaellt", "bereits abgerechnet" (henüz değil), karşılama "test2" yerine ad.

---

## S7 · Kapanış (son iş)

1. `canli-test` tam tur: `canli-test/REGISTER.md`'deki 28.09 kayıtlarının hepsi + çalışan hesabıyla yetki kontrolü.
2. "harita güncelle", "şema güncelle" (değiştiyse), `db/REGISTER.md`, `fortschritte/`.
3. **Ops panosu:** bu reformla çözülen eski kartları bul ve kapat (yapan oturum ne değiştiğini bilir).
4. Bu dosyanın durum tablosu ✅; sprint notu `fortschritte/`'ye.

---

## 28.09 kontrol turu sonucu (canli-test)

| Bulgu | Sonuç | Plana etkisi |
|---|---|---|
| B-078 çakışmada mesaj yok | ÇÜRÜTÜLDÜ — kırmızı toast 3,5 sn, modaldan uzak | P1 → P2, S3.5'te kalır |
| B-108 "‹ Zurück" | Zurück sağlam; "Erstellen sonrası ekran" açık | S2.4 |
| B-101 9 düğme çift bağlı | DOĞRULANDI; Fahrt zinciri 2× istek ama upsert veriyi koruyor | Araç P1, Fahrt P3 → S3.3/3.4 |
| Seri dağıtma podolojide | Bilerek kapalı (`podo-einheiten.js:320`) | S1.8 |
| Çalışan yetkileri | bekliyor | sonuç gelince S4/S0'a işlenir |
| Yeni: panelde "0/3" + "keine aktive Verordnung" | — | S1.3 |
| Yeni: Hausbesuch → 87 dk | Tasarım gereği (yol + seans + 10 dk) — Beta-1'e sor | S0 |
| Yeni: `loadActivityFeed` TypeError | — | S6 |
