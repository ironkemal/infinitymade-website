# Physio — Partnere Sorulacaklar

> Belgeden çıkarılamayan, gerçek bir Physio-Praxis'in alışkanlığına bağlı sorular.
> Sahibi: `physio` ajanı. Partner bulununca bu liste **kısa bir görüşmede** sorulur
> (her soru evet/hayır ya da tek cümle).
>
> Kural: soru yazılmadan önce bir **varsayım** seçilir ve kod onunla ilerler. Partnerin
> cevabı varsayımı bozarsa ne değişeceği soruda yazılıdır. Cevaplanan soru silinmez —
> cevap + tarih eklenir.

## Şablon

```markdown
### #<n> — <kısa soru>
- **Soru (Almanca, partnere aynen):** „…?"
- **Varsayımımız:** <şu an kod buna göre>
- **Cevap "hayır" ise değişen:** <ekran / dosya / iş>
- **Öncelik:** 🔴 para/hata · 🟠 her gün sürtünme · 🟢 nadir
- **Eklendi:** <YYYY-MM-DD> · **Cevap:** — 
```

---

## Açık sorular

### #1 — Abrechnung: kendi DTA'sı mı, Abrechnungszentrum mu?
- **Soru (Almanca, partnere aynen):** „Rechnen Sie heute über ein Abrechnungszentrum ab — und wenn ja, schicken Sie nur die Papierrezepte hin, oder auch Daten aus Ihrer Software?"
- **Varsayımımız:** Küçük Physio-Praxis'lerin çoğu bir Abrechnungszentrum'a kâğıt Rezept yollar; biz yine de doğrudan §302 DTA üretiyoruz (`api-backend/billing/api/abrechnung.routes.js`, `mapPrescriptionToDtaShape`).
- **Cevap "hayır" ise değişen:** "Abrechnungszentrum + veri" derse DTA yerine AZ'ye export/Begleitliste lazım (satış engeli, Physio yol haritasında öne çıkar); "yalnız kâğıt" derse ay sonu ekranı DTA değil Rezept-Stapel kontrol listesi olarak sadeleşir.
- **Öncelik:** 🔴 para/hata
- **Eklendi:** 2026-10-26 · **Cevap:** —

### #2 — Rezeptprüfung'u kim, ne zaman yapıyor?
- **Soru (Almanca, partnere aynen):** „Wer prüft das Rezept auf Fehler — die Rezeption beim Annehmen, oder der Therapeut bei der ersten Behandlung?"
- **Varsayımımız:** Empfang, Rezept'i aldığı anda (telefon/kapı). Uyarılar Verordnung maskesinde, kaydetmeden önce çıkıyor (`dashboard.js` `saveRezept` → `pruefeMaske`).
- **Cevap "hayır" ise değişen:** Terapist ilk seansta bakıyorsa aynı uyarılar ilk Termin'in aksiyon panelinde de (`module/termin-aktionen.js`) gösterilmeli.
- **Öncelik:** 🔴 para/hata
- **Eklendi:** 2026-10-26 · **Cevap:** —

### #3 — Muster 13 arkası: elle mi, yazıcıdan mı?
- **Soru (Almanca, partnere aynen):** „Bedrucken Sie die Rückseite der Verordnung (Behandlungsdaten, Leistungen) mit der Software, oder trägt der Patient Datum und Unterschrift von Hand ein?"
- **Varsayımımız:** Elle — hasta her seansta tarih + imza atıyor; yazılım arka yüzü basmıyor (kodda Rückseiten-Druck yok).
- **Cevap "hayır" ise değişen:** "Bedrucken" derse Rückseite-Druck (Muster 13 arkasına seans tarihleri + pozisyonlar) yeni bir modül olur; ayrıca seans "erbracht" ile imza arasında eşleme gerekir.
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-10-26 · **Cevap:** —

### #4 — Seansı "erledigt" kim işaretliyor?
- **Soru (Almanca, partnere aynen):** „Wer hakt eine Behandlung als erledigt ab — der Therapeut direkt nach der Behandlung, oder die Rezeption gesammelt am Tagesende?"
- **Varsayımımız:** Terapist, hemen tedaviden sonra, Termin'den ("Termin starten" → Sitzungsnotiz, `dashboard.js` ~3751). Her durumda Leistungsdatum Termin tarihinden alınmalı, tık anından değil.
- **Cevap "hayır" ise değişen:** Empfang toplu işaretliyorsa "Heute erschienen" günlük listesinde tek tıkla toplu abhaken gerekir; seans başına not modalı Empfang için kaldırılır.
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-10-26 · **Cevap:** —

### #5 — Ergänzendes Heilmittel aynı Termin'de mi?
- **Soru (Almanca, partnere aynen):** „Wird das ergänzende Heilmittel (z. B. Wärme vor KG) im selben Termin direkt mit dem vorrangigen gegeben — ein Termin, zwei Leistungen?"
- **Varsayımımız:** Evet — bir Termin, iki Leistung (Kombi-Termin); süre toplanır (`module/termin-leistungen.js`).
- **Cevap "hayır" ise değişen:** Ayrı Termin'ler olursa ergänzend seanslar kendi Termin'lerine bağlanır; Serienplanung iki ayrı seri üretir.
- **Öncelik:** 🔴 para/hata
- **Eklendi:** 2026-10-26 · **Cevap:** —

### #6 — Seri: aynı terapist + aynı saat mi?
- **Soru (Almanca, partnere aynen):** „Planen Sie eine 6er-Serie möglichst beim selben Therapeuten zur selben Uhrzeit — oder einfach in die nächsten freien Lücken?"
- **Varsayımımız:** Aynı terapist, aynı saat; olmuyorsa en yakın boşluk. Bugünkü seri yolu (`/booking/batch-create`) zaten tek terapist + sabit saat alıyor.
- **Cevap "hayır" ise değişen:** "Freie Lücken" derse seri önerisi terapistler arası boşluk arayan bir öneriye döner (KI kutuda kapalı olduğundan deterministik).
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-10-26 · **Cevap:** —

### #7 — Hausbesuch / Heim oranı
- **Soru (Almanca, partnere aynen):** „Wie viel Prozent Ihrer Behandlungen sind Hausbesuche — und davon wie viele im Pflegeheim (mehrere Patienten an einem Ort)?"
- **Varsayımımız:** ~%10–20 Hausbesuch, bunun önemli kısmı Heim. Bu yüzden Hausbesuch-Pauschale (X9950/X9951) faturalanmazsa kayıp gerçek.
- **Cevap "hayır" ise değişen:** Oran çok düşükse Hausbesuch-Pauschale işi listede aşağı iner; Heim ağırlıklıysa "aynı adreste ardışık hastalar" planlaması öne çıkar.
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-10-26 · **Cevap:** —

### #8 — Folgeverordnung'u kim istiyor?
- **Soru (Almanca, partnere aynen):** „Wenn die Serie zu Ende geht: fordert die Praxis die Folgeverordnung beim Arzt an (Fax/Anruf), oder schicken Sie den Patienten selbst zum Arzt?"
- **Varsayımımız:** Hasta kendisi gidiyor; praxis yalnız 2 seans kala hatırlatıyor.
- **Cevap "hayır" ise değişen:** Praxis istiyorsa hatırlatma, Arzt-Register + Fax-Deckblatt'tan (`module/fax-deckblatt.js`) "Folgeverordnung anfordern" faksına bağlanır.
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-10-26 · **Cevap:** —

### #9 — Ergänzendes Heilmittel her seansta mı?
- **Soru (Almanca, partnere aynen):** „Wenn ein ergänzendes Heilmittel verordnet ist (z. B. KG + Wärme): geben Sie es praktisch immer im selben Termin — oder kommt es vor, dass es an einem Termin ausfällt?"
- **Varsayımımız:** Neredeyse her zaman aynı Termin'de. Bu yüzden seans kapatılınca ergänzend otomatik işaretleniyor (`module/ergaenzend-mitbuchen.js`), verordnete Menge dolana kadar.
- **Cevap "hayır" ise değişen:** Seans kapatma ekranına "ergänzend heute nicht" seçeneği gerekir; yoksa verilmeyen leistung faturalanır.
- **Öncelik:** 🔴 para/hata
- **Eklendi:** 2026-10-27 · **Cevap:** —

### #10 — Aynı reçetede Hausbesuch yeri değişir mi?
- **Soru (Almanca, partnere aynen):** „Kommt es vor, dass ein Patient mit derselben Verordnung mal zu Hause und mal im Heim/in der Tagespflege behandelt wird?"
- **Varsayımımız:** Hayır, yer reçete boyunca sabit (`prescriptions.hausbesuch_ort`).
- **Cevap "evet" ise değişen:** Yer seans başına tutulmalı (`prescription_sessions.hausbesuch_ort`, yeni migration); X9950/X9951 gün gün seçilir.
- **Öncelik:** 🟢 nadir
- **Eklendi:** 2026-10-27 · **Cevap:** —
