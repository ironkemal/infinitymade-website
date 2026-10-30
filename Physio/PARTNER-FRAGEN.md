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

### #11 — Raumbelegung: Raum je Therapeut oder je Leistung?
- **Soru (Almanca, partnere aynen):** „Hat bei Ihnen jeder Therapeut seinen festen Raum — oder hängt der Raum an der Leistung (z. B. KG-Gerät, Fango, Liege für MLD) und wechselt im Tagesverlauf?"
- **Varsayımımız:** Karışık: çoğu terapistin sabit odası var, KG-Gerät/Fango gibi oda-bağlı leistungen ortak oda kullanır. Kodda oda kavramı hiç yok (`db/SCHEMA.sql`'de `raum`/`room` 0 eşleşme).
- **Cevap "hayır" ise değişen:** Yalnız "sabit oda" ise Mitarbeiter-ayarına tek alan + takvimde etiket yeter; "Leistung'a bağlı" ise oda bir kaynak olur (çakışma kontrolü, `no_overlapping_bookings` benzeri ikinci kısıt).
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-10-30 (P1 görüşmesi) · **Cevap:** —

### #12 — Testphase: wird parallel in Praxura abgerechnet?
- **Soru (Almanca, partnere aynen):** „In den 3–4 Testwochen am neuen Standort: sollen die Verordnungen dort schon über Praxura abgerechnet werden, oder planen und dokumentieren Sie in Praxura und rechnen noch über THEORG ab?"
- **Varsayımımız:** Test süresince Abrechnung THEORG'da kalır; Praxura'da Termin + Doku + Zuzahlung. Gerekçe: §302 Echtbetrieb kodda Zulassung olmadan kilitli (`api-backend/billing/api/betriebsart.js:126`) ve bir Verordnung tek sistemde tek kez abgerechnet olur.
- **Cevap "hayır" ise değişen:** Test başında Echtbetrieb hazır olmalı (Zulassung/Testverfahren, gkv-302) — bu, testin başlangıç tarihini bizim değil kasaların takvimine bağlar.
- **Öncelik:** 🔴 para/hata
- **Eklendi:** 2026-10-30 (P1) · **Cevap:** —

### #13 — THEORG-Export
- **Soru (Almanca, partnere aynen):** „Können Sie aus THEORG Ihren Patientenstamm und die offenen Verordnungen als Datei (CSV/Excel) exportieren — und dürfen wir uns eine anonymisierte Beispieldatei ansehen?"
- **Varsayımımız:** Patientenstamm CSV olarak çıkar; `module/patienten-import.js` genel CSV'yi alır. Offene Verordnungen için import bugün yalnız Podologie (`module/verordnung-import.js:2`).
- **Cevap "hayır" ise değişen:** Export yoksa Datenübernahme elle olur (satış engeli iki Standort geçişinde); export varsa THEORG sütun eşlemesi + Physio-VO-import (yalnız hiç seans yapılmamış VO'lar, podolojideki "Fall D" kuralı) yazılır.
- **Öncelik:** 🔴 para/hata (geçiş engeli)
- **Eklendi:** 2026-10-30 (P1) · **Cevap:** —

### #14 — Zweiter Standort: eigenes IK?
- **Soru (Almanca, partnere aynen):** „Bekommt der neue Standort ein eigenes IK und eine eigene Zulassung, oder läuft er unter dem IK der bestehenden Praxis?"
- **Varsayımımız:** Kendi IK'sı olur (ayrı Betriebsstätte). Mandant modelinde iki Standort + `data_sharing_settings`; §302 tarafında Absender-IK başına ayrı sayaç (`onprem/REGISTER.md` Dateinummer notu).
- **Cevap "hayır" ise değişen:** Tek IK ise iki Standort'un Abrechnung'u tek gönderici, tek Dateinummer sayacı — iki ayrı hesapta tutulursa numaralar çakışır; tek Abrechnung ekranından iki Standort birlikte çıkmalı.
- **Öncelik:** 🔴 para/hata
- **Eklendi:** 2026-10-30 (P1) · **Cevap:** —
