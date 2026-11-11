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

### #15 — Befund: wie tief, wie oft?
- **Soru (Almanca, partnere aynen):** „Dokumentieren Ihre Therapeuten den Erstbefund strukturiert (ROM-Gradzahlen, MFT 0–5, Tests +/−) oder als Freitext — und machen Sie einen Zwischenbefund nur, wenn der Arzt einen Bericht anfordert?"
- **Varsayımımız:** Erstbefund kısa-yapılandırılmış (NRS, ROM, MFT, 3–5 test, Ziel) + serbest not; Zwischenbefund yalnız Therapiebericht istendiğinde veya Folgeverordnung öncesi; Abschlussbefund = Erstbefund'un kopyası, yalnız değişen alanlar. K8 formu buna göre.
- **Cevap "hayır" ise değişen:** Serbest metin ağırlıklıysa yapılandırılmış alanlar opsiyonel + katlanır olur, ilk ekranda yalnız NRS + Ziel + not; Zwischenbefund rutinse seri ortasında (örn. 6'nın 3.'sünde) otomatik hatırlatma eklenir.
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-10-31 (P1, K8) · **Cevap:** —

### #16 — Standortwechsel: Einzeltage oder Zeiträume?
- **Soru (Almanca, partnere aynen):** „Wenn ein Therapeut am anderen Standort aushilft — ist das meist ein einzelner Tag, oder kommen mehrwöchige Vertretungen (Urlaub, Krankheit) mit festem Wochenmuster vor?"
- **Varsayımımız:** Çoğunlukla tek gün; birkaç haftalık Vertretung nadir. Pilot: Wochenmuster (ab Datum) + Einzeltag; Einzeltag girişinde "von–bis" aralığı N adet Einzeltag üretir (ayrı Zeitraum modeli yok). M4c, `employee_standort_plan`.
- **Cevap "hayır" ise değişen:** Mehrwöchige Vertretung sıksa ayrı "Zeitraum mit eigenem Wochenmuster" (gültig von–bis, sonra eski desene dönüş) gerekir — tabloya `gueltig_bis` + UI'da "befristet versetzen".
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-11-01 (P1, M4) · **Cevap:** —

### #17 — Doppelbehandlung: pro Heilmittel oder pro Rezept?
- **Soru (Almanca, partnere aynen):** „Wenn auf einem Rezept KG und MT stehen — kreuzt der Arzt „Doppelbehandlung" einmal fürs ganze Rezept an, oder meinen Sie damit je Heilmittel etwas anderes? Und wie nennen Ihre Mitarbeiterinnen am Empfang das Feld?"
- **Varsayımımız:** Muster 13'te Doppelbehandlung tek kutu (Rezept başına); Zeile başına „D" yalnız Termin-Planlama için. Etiket „D" Empfang için belirsiz → „Doppelb." önerildi.
- **Cevap "hayır" ise değişen:** Rezept başına ise satır başı D kalkar, tek kutu kalır.
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-11-02 (P1 ekran incelemesi) · **Cevap:** —

### #18 — Räume: welche, wie viele Plätze?
- **Soru (Almanca, partnere aynen):** „Welche Räume gibt es an jedem Standort, und wie viele Patienten können darin gleichzeitig behandelt werden (Liegen, Wärme/Fango parallel)? Gibt es Räume, die nur für bestimmte Leistungen taugen (z. B. KGG-Gerät)?"
- **Varsayımımız:** Standort başına 4–7 oda, çoğu 1 Platz, Wärme/Fango odası 2+. Model hazır: `rooms.plaetze`, `rooms.ausstattung` + `services.raum_ausstattung` (0092/0103/0104), çakışma uyarır, engellemez.
- **Cevap "hayır" ise değişen:** Liegen/Wärmephasen ayrı kapasite olarak sayılmalıysa (bir Termin iki aşama, iki oda) Termin başına tek `room_id` yetmez → aşamalı rezervasyon.
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-11-04 (physio-Prüfung M1–M7) · **Cevap:** —

### #19 — Standortwechsel innerhalb eines Tages
- **Soru (Almanca, partnere aynen):** „Arbeitet jemand am selben Tag an beiden Standorten (z. B. vormittags hier, nachmittags dort)? Wenn ja: wie viel Fahrzeit planen Sie dazwischen ein?"
- **Varsayımımız:** Evet, ara sıra. 04.11.2026'dan beri Wochenmuster'da Zeitfenster var (0109: „Mo 8–12 A, 14–18 B"); Fahrzeit = iki pencere arasındaki boşluk, ayrıca hesaplanmaz.
- **Cevap "hayır" ise değişen:** Hiç olmuyorsa Zeitfenster boş kalır (ganzer Tag, eski davranış). Aynı Standort'ta günde iki pencere gerekiyorsa UNIQUE'e `von` eklenir (yeni migration).
- **Öncelik:** 🟠 her gün sürtünme
- **Eklendi:** 2026-11-04 (physio-Prüfung, Melih-Entscheid Zeitfenster) · **Cevap:** —

### #20 — Schließtag: wer informiert die Patienten?
- **Soru (Almanca, partnere aynen):** „Wenn ein Standort an einem Tag schließt: Wer informiert die betroffenen Patienten — Empfang per Telefon, oder soll Praxura nach Ihrer Freigabe E-Mails verschicken? Wer darf diese Freigabe geben?"
- **Varsayımımız:** Kemal 31.10.: neue Termine gesperrt, bestehende rot, keine automatische Mail. Vorschau + Freigabe + Anrufliste existieren (M6b/c, 0101/0102); Versand nur mit ausdrücklichem Klick, Einwilligung E13.
- **Cevap "hayır" ise değişen:** Nur Telefon → Mail-Knopf ausblenden, Anrufliste genügt. Freigabe durch Empfang statt Inhaber → Rechte der Route `sondertag/mitteilung` erweitern (guvenlik).
- **Öncelik:** 🟡 selten
- **Eklendi:** 2026-11-04 (physio-Prüfung M6) · **Cevap:** —

### #21 — Online-Termine: für wen?
- **Soru (Almanca, partnere aynen):** „Sollen über Ihre Webseite nur Bestandspatienten Folgetermine anfragen, oder auch Neupatienten mit Rezept — und Selbstzahler (z. B. Massage) getrennt davon?"
- **Varsayımımız:** Başlangıçta Terminanfrage (Empfang onaylar), Neupatient dahil; Selbstzahler ayrı Leistung olarak. Widget: `widget/booking-widget.html` (M7).
- **Cevap "hayır" ise değişen:** Yalnız Bestandspatient ise widget'ta Telefon/Geburtsdatum ile eşleştirme zorunlu olur; Selbstzahler ayrı ise ikinci widget/sekme.
- **Öncelik:** 🟡 selten
- **Eklendi:** 2026-11-04 (physio-Prüfung M7) · **Cevap:** —

### #22 — Zuzahlung: Alter 18 und Befreiung innerhalb einer Verordnung
- **Soru (Almanca, Praxisablauf):** „Wie erfassen Sie Befreiungsnachweise mit Beginn und Ende, einen Jahreswechsel und bereits erhobene Blattgebühren? Können wir an synthetischen Beispielen prüfen, welche Angaben Empfang und Abrechnung dafür benötigen?"
- **Quellenstand 10.11.2026:** Vollendung des 18. Lebensjahres am Geburtstag durch SGB V §32 Abs.2 und BGB §§187 Abs.2/188 Abs.2 belegt (W-29/W-30). Physio-Vertrag §8 Abs.2–4 (W-17, Lesefassung 04.04.2022, TXT 753–783) bindet Nachweis an Leistungszeitpunkt, verlangt Prüfung beim Jahreswechsel und nennt ersten Behandlungstag für Blattgebühr. Status dieses Tages für Blattgebühr systematisch abgeleitet; konkrete Übergangsfälle extern fachlich prüfen. Partnerantwort ersetzt keine Vertragsregel.
- **Technisch offen:** `calcAbrechnungsfallZuzahlungProTag` vorhanden, noch nicht durchgängig angebunden oder abgenommen. Jahresbindung des Nachweises, ursprünglicher erster Behandlungstag und schon erhobene Blattgebühr müssen über Vorschau, Patientenforderung, Snapshot und DTA gemeinsam geführt werden.
- **Auswirkung der Antwort:** Erfassungsablauf und notwendige Nachweise konkretisieren; belegte Alters-/Vertragsregeln werden nicht durch Praxisgewohnheiten überschrieben.
- **Öncelik:** 🟠 Geld (Kassenabsetzung möglich)
- **Eklendi:** 2026-11-07 (Zuzahlung je Tag) · **Cevap:** —

### #23 — Redesign Startseite/Kalender: Reihenfolge und Statusbegriffe am Empfang
- **Soru (Almanca, Praxisablauf):** „Sortiert Ihr Empfang die Tagesliste nach Uhrzeit oder nach Behandler:in? Wird die Unterschrift direkt am Empfang oder gesammelt am Serienende abgehakt? Gehört eine offene Zuzahlung auf die Startseite? Reicht im Tageskalender eine Spalte pro Therapeut:in, auch auf dem Tablet?“
- **Varsayımımız:** Zeit-Sortierung mit Behandler:in in der Zeile; Status „erschienen / unterschrieben / nicht erschienen“ statt „vorbei“ nach Uhrzeit.
- **Cevap „hayır“ ise değişen:** Startseitenliste, Statusfarben/-texte, Spalten im Tagesansicht-Kalender.
- **Öncelik:** 🟡 Redesign-Feinschliff
- **Eklendi:** 2026-11-11 (physio-Bildabnahme Redesign) · **Cevap:** —
