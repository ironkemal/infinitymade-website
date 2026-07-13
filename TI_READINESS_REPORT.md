# TI-Readiness Report — Praxura × Telematikinfrastruktur

> Araştırma tarihi: 2026-07-13. Kaynaklar: gematik, GKV-Spitzenverband, Physio Deutschland, Optica/DMRZ/thevea/redmedical sektör rehberleri + repo envanteri (verordnung-data-map.html, api-backend/billing, live_schema).

---

## 1. TI geldiğinde bizde ne değişiyor? (Zaman çizelgesi — güncel yasal durum)

| Tarih | Ne oluyor | Bizi nasıl etkiler |
|---|---|---|
| **01.01.2027** | **eVO (elektronische Heilmittelverordnung)**: Vertragsärzte Heilmittelverordnung'u elektronik düzenlemekle yükümlü (Digital-Gesetz). Konsept gematik + Physio Deutschland ile hâlâ geliştiriliyor; sektör 2027 pilot / 2028 tam zorunluluk bekliyor — kayma olası. | Verordnung'lar kâğıt Muster 13 yerine **E-Rezept-Fachdienst'ten FHIR** olarak gelecek. Rezept-Modal + OCR akışımızın yanına dijital alım akışı gerekecek. |
| **01.10.2027** | **TI-Anschlusspflicht** tüm Heilmittelerbringer için (06.11.2025 Bundestag kararıyla 01.01.2026'dan ertelendi). Physio/Ergo/Logo/Podo — praxis büyüklüğünden bağımsız. | Müşterilerimiz SMC-B + eHBA + Kartenterminal + TI-Gateway + **KIM** edinmek zorunda. Yazılımları "TI-fähig" değilse rakibe geçerler. |
| Süregelen | **ePA für alle**: Physio'lara şu an ağırlıklı **okuma** yetkisi (eGK okutunca 90 gün erişim); yazma sonraki Ausbaustufe'de. | Orta vadede ePA görüntüleme/yükleme; P0 değil. |
| Süregelen | **TI-Pauschale**: aylık Grundpauschale (GKV-SV portalında Eigenerklärung + SMC-B/eHBA Telematik-ID doğrulaması şartı; **KIM aktuelle Version desteklenmeli**). Çeyrek dönem sonunda ödeme. | Müşteriye "TI masrafın GKV'den geri geliyor" satış argümanı geçerli. ⚠️ Landing'deki 221,74 €/ay rakamı ile yeni kaynaklardaki 207,93 € + 7,77 €/eHBA-çalışan rakamı çelişiyor — GKV-SV Finanzierungsvereinbarung Heilmittel (01.07.2024 + güncellemeleri) üzerinden doğrulanmalı. |

**Net değişim özeti:** TI bize üç yeni veri kanalı getiriyor: (1) **eVO alımı** (E-Rezept-Fachdienst, FHIR/XML, Task-ID + AccessCode modeli — eczane akışının Heilmittel'e uyarlanmışı, Heilmittel'de ayrıca sigortalının Gegenzeichnung'u öngörülüyor), (2) **KIM mesajlaşma** (Arzt ↔ Praxis: Rezeptänderung, Therapiebericht, Kostenvoranschlag; Kasse ↔ Praxis: Abrechnung iletişimi), (3) **eGK/VSDM kart okuma** (hasta kimlik + Versichertenstatus doğrulama).

---

## 2. KIM — mesajlaşma için "kim" bu?

- KIM = **Kommunikation im Medizinwesen**: TI içindeki S/MIME-şifreli, sertifikalı e-posta standardı. Faks'ın yasal halefi.
- Teknik: **POP3/SMTP** + **KIM-Clientmodul** (şifreleme/imzalama yapan yerel ya da rechenzentrum'da barındırılan modül). Yani mevcut **nodemailer/SMTP mimarimiz protokol olarak uyumlu** — Clientmodul'e SMTP/POP3 ile konuşulur.
- Sadece **gematik-onaylı KIM anbieter** hizmet verebilir (ör. AKQUINET, DGN, Telekom, kv.dox). Biz KIM anbieter olmayız; **onaylı bir anbieter'le partner** olur, Clientmodul'ü entegre ederiz ("KIM as a Service" modeli — Optica Viva aynen böyle yapıyor).
- Adres dizini: TI-Verzeichnisdienst (VZD) — doktor KIM adresleri buradan aranır; PVS'ten dizin araması beklenen özellik.
- TI-Messenger (TIM) ayrı bir uygulama (anlık mesajlaşma) — Heilmittel için henüz zorunluluk yok, blog içeriği yeterli.

## 3. eVO teknik resim (bugünkü bilgi)

- Altyapı: **E-Rezept-Fachdienst** (merkezi FHIR resource server, REST + XML FHIR, VAU şifreleme). İlaç E-Rezept'inde akış: Task-ID + AccessCode → `GET /Task` ile abruf; eGK takılınca KVNR-bazlı einlösbar liste. Heilmittel-eVO aynı Fachdienst'e ek Workflow-Typ olarak gelecek.
- Heilmittel'e özgü: sigortalının **Gegenzeichnung** adımı öngörülüyor; ayrıntılı spec **henüz final değil** (gematik Anforderungsworkshop'ları sürüyor). Yani bugün spec'e karşı kod yazılamaz; veri modeli hazırlığı yapılır.
- İçerik alanları kâğıt Muster 13 ile birebir örtüşecek: Versichertendaten (KVNR, Kasse/IK, Status), **LANR + BSNR + Ausstellungsdatum** (üçünden biri eksikse geçersiz), ICD-10 (+ ikinci Diagnose), **Diagnosegruppe**, **Leitsymptomatik** (harf kodu veya Klartext), Heilmittel-Position, Einheiten, Frequenz, Hausbesuch, Therapiebericht, Dringlichkeit, Zuzahlungsstatus.

---

## 4. Repo envanteri: neyimiz var, neyimiz uygun değil?

### ✅ Zaten uygun / hazır
- **§302 DTA motoru** (api-backend/billing/dta/): Anlage 1 V21 EDIFACT, SLGA/SLLA, **EVO segmenti ve `evoId` alanı şimdiden var** — eVO ID'si abrechnung'a akıtılabilir.
- Alan altyapısı: `doctor_lanr/bsnr`, `kostentraeger_ik` (+DAS haritası), `patient.kvnr`, Zuzahlung hesabı, Dakota sertifika modeli (`terapeut_zertifikat`), OAuth token saklama deseni (KIM credential'ları için şablon).
- `prescriptions` tablosu Muster 13 alanlarının çoğunu karşılıyor: icd10, diagnosegruppe, leitsymptomatik, heilmittel_items, frequenz, ausstellungsdatum, hausbesuch, dringend, blanko, bericht_*.
- Pazarlama yüzeyi: ti-anbindung-heilmittel.html + 8 TI blog makalesi + Vormerkliste.

### 🔎 Doğrulama güncellemesi (2026-07-13, canlı DB + kod kontrolü)

- **#1 status bug:** DÜZELTİLMİŞ — saveRezept artık `status:'confirmed'` yazıyor (dashboard.js:15523).
- **#5 Pauschale rakamı:** DOĞRU — 221,74 € "Stand 2026" değeri (213,75 € Basis + 7,99 € eHBA); 207,93 € 2025 rakamıydı. Değişiklik gerekmez.
- **#2 verordnungen birleştirme:** ERTELENDİ — `verordnungen` podoloji billing'in **çalışan** zinciri (`loadPodologieBilling` + `POST /abrechnung/create-podologie`), fa97a78 ile erişim bilinçli restore edildi; tabloda `lead_id` FK zaten var. Birleştirme ayrı, planlı bir refactor olmalı.
- **#3 patients/leads birleştirme:** ERTELENDİ — `patients` legacy DEĞİL: public booking-request wizard'ın canlı tablosu (server.js /api/patients/lookup, /api/booking-request/create, booking_requests.patient_id FK). Birleştirme public API'yi kırar. Sınır: `patients` = wizard kimliği, `leads` = praxis hasta kaydı.
- **Yapıldı (2026-07-13):** `leads.versichertenstatus`, `prescriptions.evo_task_id/evo_access_code/quelle/fhir_raw`, `profiles.kim_adresse/telematik_id` kolonları eklendi (migration `ti_readiness_additive_fields`); abrechnung.routes.js hardcoded `versichertenstatus:'1'` yerine lead değerini (geçerliyse) kullanıyor; frontend KVNR/Muster-13 soft validasyonları + Krankenkasse datalist + Settings TI alanları eklendi.

### ❌ Uygun olmayan / eksik (uyguna çevirme planı)

| # | Sorun | Uyguna çevirme |
|---|---|---|
| 1 | **İki paralel Verordnung havuzu** (`prescriptions` 41 kayıt vs terkedilmiş `verordnungen` 2 kayıt, podoloji). eVO tek akışa inecek. | `verordnungen`'i `prescriptions`'a migrate et, tabloyu emekliye ayır. `wagner_grad` gibi podoloji alanlarını `prescriptions`'a taşı. |
| 2 | **İki hasta tablosu** (`leads` asıl, `patients` legacy) + `verordnungen.patient_name` serbest metin (FK yok). eGK/KVNR eşleştirmesi FK'sız çalışmaz. | Tek hasta tablosu; her Verordnung `patient_id` FK zorunlu. |
| 3 | `versichertennummer` validasyonsuz TEXT. | KVNR format validasyonu (1 büyük harf + 9 rakam, kontrol basamağı) UI + DB check. |
| 4 | `versichertenstatus` kalıcı kolon değil (DTA'da runtime input). eGK/VSDM bunu otomatik verecek. | `leads`'e `versichertenstatus` kolonu + UI alanı. |
| 5 | `krankenkasse` serbest metin; IK bağlantısı zayıf. | `leads.krankenkasse` → `kostentraeger(ik)` FK/lookup; UI'da IK-destekli Kasse seçici (93 GKV seed'i mevcut). |
| 6 | eVO kimlik alanları yok. | `prescriptions`'a ekle: `evo_task_id`, `evo_access_code` (şifreli), `quelle` enum (`papier` / `ocr` / `evo`), `fhir_raw` jsonb (gelen bundle arşivi — GoBD). |
| 7 | KIM implementasyonu sıfır (yalnız blog). | Faz planı: onaylı KIM-anbieter partnerliği → Clientmodul'e SMTP/POP3 köprüsü (nodemailer uyumlu) → `praxen`/profiles'a `kim_adresse`, `telematik_id`, `smc_b_iccsn` meta alanları → Therapiebericht/Rezeptänderung KIM üzerinden. |
| 8 | eGK okuma / VSDM yok. | Kartenterminal entegrasyonu TI-Gateway üzerinden; on-prem pivotla uyumlu (Konnektor/Gateway praxis yerelinde). Spec finalleşince. |
| 9 | 🔴 Bilinen bug: "+ Neue Verordnung" `status:'active'` yazıyor, DB constraint reddediyor (dashboard.js:15408). | TI'den bağımsız, hemen düzeltilmeli. |
| 10 | Landing'deki Förderpauschale rakamı (221,74 €) yeni kaynaklarla (207,93 € + 7,77 €/eHBA) çelişiyor. | GKV-SV Finanzierungsvereinbarung güncel sürümünden doğrula, landing'i güncelle. |

---

## 5. Önerilen yol haritası

1. **Şimdi (2026 Q3):** #9 bug fix; #1–#5 veri modeli konsolidasyonu (test fazındayız, destructive migration güvenli). Bu, hem §302'yi sağlamlaştırır hem eVO tabanını kurar.
2. **2026 Q4:** #6 eVO alanları + `quelle` ayrımı; UI'da Verordnung formunu Muster 13 zorunlu alanlarıyla hizala (LANR/BSNR/Ausstellungsdatum üçlüsü zorunlu, Leitsymptomatik kod/Klartext toggle). KIM-anbieter'lerle görüşme (AKQUINET/DGN tipi "as a service").
3. **2027 H1:** gematik Heilmittel-eVO spec'i finalleşince FHIR alım istemcisi + KIM entegrasyonu (Zusatzmodul olarak, landing'deki "Q3/Q4 2027" vaadiyle uyumlu). TI-Gateway partnersizliği on-prem playbook ile birlikte kararlaştırılmalı: on-prem kurulumda Gateway praxis tarafında, SaaS'ta merkezi.
4. **Sonra:** ePA okuma → yazma (Ausbaustufe'ye göre), TIM.

**G8 kuralına uygunluk:** KIM/eVO istemcileri **api-backend (Express)** içinde yaşamalı — yeni bulut zinciri değil; on-prem kurulumda aynı kod praxis sunucusunda çalışır. TI mimarisi doğası gereği (Konnektor/Gateway praxis'e yakın) on-prem pivotumuzla örtüşüyor.

---

## Kaynaklar
- https://www.telekonnekt.de/artikel/telematikinfrastruktur-physiotherapie
- https://www.optica.de/wissenswert/detail/telematikinfrastruktur-fristen
- https://www.dmrz.de/blog/ti-fuer-heilmittelerbringerinnen-die-elektronische-verordnung-evo
- https://www.dmrz.de/wissen/ratgeber/telematikinfrastruktur-im-heilmittelbereich
- https://redmedical.de/2025/09/23/telematikinfrastruktur-heilmittelerbringer/
- https://www.buchner.de/blog/digitalisierung/digital-gesetz-start-der-elektronischen-heilmittelverordnung-erst-2027/
- https://www.physio-deutschland.de/fachkreise/news-bundesweit/einzelansicht/artikel/anforderungsworkshop-der-gematik.html
- https://www.gkv-spitzenverband.de/media/dokumente/krankenversicherung_1/telematik/telematik_3/20240701_TI-Finanzierungsvereinbarung_Heilmittel.pdf
- https://fachportal.gematik.de/hersteller-anbieter/komponenten-dienste/kim-clientmodul
- https://github.com/gematik/api-erp
- https://www.aerzteblatt.de/news/elektronische-patientenakte-physiotherapeuten-wollen-mehr-zugriffsrechte-0c2931ad-1285-49c0-910c-ac1a3b2180dc
- https://www.optica.de/wissenswert/detail/so-funktioniert-ti-as-a-service-tiaas
- https://hashtagpraxis.com/2026/03/heilmittelverordnung-13-ausfuellhilfe-und-faqs-fuer-deinen-praxisalltag-und-medizinische-partnerinnen/
