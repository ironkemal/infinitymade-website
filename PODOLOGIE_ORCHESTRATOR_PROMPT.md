# Podologie Transition — Orkestra Şefi Görevi

## AUTO MOD — KULLANICI AFKta

**Hiçbir şey için durup sormayacaksın.** Takıldığında en mantıklı kararı ver ve devam et. Tercih sırası:
1. Mevcut kodda aynı pattern'i bul ve onu takip et
2. Supabase şemasına bak, mevcut yapıya uy
3. Eğer iki seçenek arasında kalırsan → daha az değişiklik yapanı seç (minimal invasive)
4. Sadece gerçekten imkânsız bir durum varsa (kritik env var eksik, tablo çakışması vb.) çalışmayı durdur ve durumu açıkla

Her fazın sonunda **gerçek test yap** — "muhtemelen çalışır" deme. Test geçmeden bir sonraki faza geçme.

---

Sen bu implementasyonun orkestra şefisin. **Kendi başına kod yazma.**

- **DB işleri (Supabase):** Doğrudan `mcp__supabase__*` araçlarıyla yap — MCP sadece sende var.
- **Kod değişiklikleri (dashboard.js vb.):** Her iş için ayrı bir prompt dosyası yaz, agy sub-agent'a delege et.

**agy çağırma komutu:**
```bash
agy -p "$(cat /path/to/prompt.md)" --dangerously-skip-permissions --print-timeout 20m
```
Uzun prompt'ları mutlaka dosyaya yaz, `cat` ile geçir. `run_in_background: true` kullan.

**Kritik kurallar:**
- `dashboard.js`'e dokunan görevleri PARALEL ÇALIŞTIRMA — biri bitmeden diğerini başlatma.
- agy'nin "yaptım" özetine güvenme — her işten sonra `git diff` ile doğrula.
- Dashboard JS/CSS değişince `dashboard.html`'deki `?v=YYYYMMDD` param'ını `?v=20260613` yap.
- Dark theme CSS değişkenleri kullan: `--bg-card-solid`, `--text-main` (asla `#fff`/`#f3f4f6` yazma).

---

## Test Hesabı
- **URL:** http://localhost:3000 (veya https://praxura.de eğer localde server yok)
- **Login:** fizyo6@gmail.com / Yavuzkemal123.
- **Not:** Localde test için `cd c:\Users\Test\Desktop\claude\website && npx serve . -p 3000` çalıştır.

---

## Proje Bağlamı

**Praxura** — Almanya'daki Heilmittelerbringer praxisleri için SaaS.

- Frontend: Vanilla HTML/CSS/JS, Vercel'de (`c:\Users\Test\Desktop\claude\website\`)
- DB/Auth: Supabase `njvuclullotbksskpwgk` (EU region)
- Backend: `api-backend/server.js` VPS'te Docker
- Ana dosyalar: `dashboard.html` + `dashboard.js`, `onboarding.js`

**Mevcut durum:**
- `onboarding.js`'te `podologie` sektör seçeneği zaten var
- `§302` billing modülü `dashboard.js`'te var ama sadece `sector === 'physiotherapy'` için açık
- Podologie HPNR kodları ve validasyon mantığı yok → sen ekleyeceksin

---

## ADIM 1 — Supabase Tabloları (Sen yap, MCP ile)

`mcp__supabase__apply_migration` kullanarak sırayla çalıştır:

### Tablo 1: `heilmittel_catalog`

```sql
CREATE TABLE IF NOT EXISTS heilmittel_catalog (
  hpnr              TEXT PRIMARY KEY,
  leistung          TEXT NOT NULL,
  leistungsart      TEXT,
  heilmittelbereich TEXT NOT NULL DEFAULT 'Podologie',
  grundlage         TEXT,
  verguetung_gkv    DECIMAL(8,2),
  gueltig_ab        DATE NOT NULL,
  gueltig_bis       DATE NOT NULL DEFAULT '9999-12-31',
  aktiv             BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

INSERT INTO heilmittel_catalog (hpnr, leistung, leistungsart, grundlage, gueltig_ab) VALUES
  ('78010','Podologische Behandlung (klein)',           'Maßnahmen der podologischen Therapie','§125 Abs. 1 SGB V','1900-01-01'),
  ('78020','Podologische Behandlung (groß)',            'Maßnahmen der podologischen Therapie','§125 Abs. 1 SGB V','1900-01-01'),
  ('78030','Podologische Befundung',                   'Maßnahmen der podologischen Therapie','§125 Abs. 1 SGB V','1900-01-01'),
  ('78040','Eingangsbefundung',                        'Maßnahmen der podologischen Therapie','§125 Abs. 1 SGB V','1900-01-01'),
  ('78100','Nagelspange Erstbefundung groß',           'Nagelspangenbehandlung Erstbefundung', '§125 Abs. 1 SGB V','1900-01-01'),
  ('78110','Nagelspange Erstbefundung klein',          'Nagelspangenbehandlung Erstbefundung', '§125 Abs. 1 SGB V','1900-01-01'),
  ('78210','Ross Fraser – Anpassung',                  'Nagelspangenbehandlung nach Ross Fraser','§125 Abs. 1 SGB V','1900-01-01'),
  ('78220','Ross Fraser – Fertigung',                  'Nagelspangenbehandlung nach Ross Fraser','§125 Abs. 1 SGB V','1900-01-01'),
  ('78230','Ross Fraser – Nachregulierung',            'Nagelspangenbehandlung nach Ross Fraser','§125 Abs. 1 SGB V','1900-01-01'),
  ('78300','Nagelspange mehrteilig bilateral',         'Nagelspangenbehandlung mehrteilig',    '§125 Abs. 1 SGB V','1900-01-01'),
  ('78400','Nagelspange einteilig Kunststoff/Metall',  'Nagelspangenbehandlung einteilig',     '§125 Abs. 1 SGB V','1900-01-01'),
  ('78510','Kontrolle Sitz- und Passgenauigkeit',      'Nagelspangenbehandlung weitere',       '§125 Abs. 1 SGB V','1900-01-01'),
  ('78520','Behandlungsabschluss / Entfernung Spange', 'Nagelspangenbehandlung weitere',       '§125 Abs. 1 SGB V','1900-01-01'),
  ('78530','Therapiebericht UI 2',                    'Nagelspangenbehandlung weitere',        '§125 Abs. 1 SGB V','1900-01-01'),
  ('78610','Nagelspangenbehandlung',                  'Nagelspangenbehandlung',                '§125 Abs. 1 SGB V','2025-07-01'),
  ('78620','Aufschlag für besonderen Aufwand',         'Nagelspangenbehandlung',               '§125 Abs. 1 SGB V','2025-07-01'),
  ('79933','Hausbesuch inkl. Wegegeld',               'Hausbesuch/Wegegeld',                   '§125 Abs. 1 SGB V','1900-01-01'),
  ('79934','Hausbesuch in soz. Einrichtung inkl. Wegegeld','Hausbesuch/Wegegeld',              '§125 Abs. 1 SGB V','1900-01-01')
ON CONFLICT (hpnr) DO NOTHING;
```

### Tablo 2: `diagnosegruppen`

```sql
CREATE TABLE IF NOT EXISTS diagnosegruppen (
  code                  TEXT PRIMARY KEY,
  label                 TEXT NOT NULL,
  untergruppen          TEXT[],
  icd10_codes           TEXT[],
  icd10_pflicht         TEXT,
  befundung_erlaubt     BOOLEAN DEFAULT true,
  nagelspange_erlaubt   BOOLEAN DEFAULT false,
  lokalisation_pflicht  BOOLEAN DEFAULT false
);

INSERT INTO diagnosegruppen VALUES
  ('DF','Diabetisches Fußsyndrom',     ARRAY['a','b','c'], ARRAY['E10.74','E10.75','E11.74','E11.75'], NULL,    true,  false, false),
  ('NF','Neuropathisches Fußsyndrom',  NULL,               ARRAY['G60.0','G63.2','E10.40','E11.40'],  NULL,    true,  false, false),
  ('QF','Querschnittslähmung',         NULL,               ARRAY['G82.0','G82.1','G82.2','G82.3','G82.4','G82.5'], NULL, true, false, false),
  ('UI1','Unguis incarnatus Stufe 1',  NULL,               ARRAY['L60.0'],                            'L60.0', false, false, true),
  ('UI2','Unguis incarnatus Stufe 2-3',NULL,               ARRAY['L60.0'],                            'L60.0', false, true,  true)
ON CONFLICT (code) DO NOTHING;
```

### Tablo 3: `verordnungen` (Muster 13 reçete takibi)

```sql
CREATE TABLE IF NOT EXISTS verordnungen (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID REFERENCES profiles(id),
  patient_name          TEXT,
  ausstellungsdatum     DATE NOT NULL,
  diagnosegruppe        TEXT REFERENCES diagnosegruppen(code),
  icd10                 TEXT[],
  leitsymptomatik       TEXT,
  behandlungseinheiten  INT,
  therapiefrequenz      TEXT,
  hausbesuch            BOOLEAN DEFAULT false,
  therapiebericht       BOOLEAN DEFAULT false,
  dringend              BOOLEAN DEFAULT false,
  behandlungsstart      DATE,
  status                TEXT DEFAULT 'aktiv' CHECK (status IN ('aktiv','abgeschlossen','abgebrochen','ungueltig')),
  notizen               TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE verordnungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_verordnungen" ON verordnungen
  FOR ALL USING (owner_id = auth.uid());
```

### Tablo 4: `podologie_behandlungen`

```sql
CREATE TABLE IF NOT EXISTS podologie_behandlungen (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID REFERENCES profiles(id),
  verordnung_id     UUID REFERENCES verordnungen(id) ON DELETE SET NULL,
  behandlungsdatum  DATE NOT NULL,
  hpnr_codes        TEXT[],
  diagnosegruppe    TEXT,
  lokalisation      TEXT,
  notizen           TEXT,
  betrag_gkv        DECIMAL(8,2),
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE podologie_behandlungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_behandlungen" ON podologie_behandlungen
  FOR ALL USING (owner_id = auth.uid());
```

### Tablo 5: `fußstatus`

```sql
CREATE TABLE IF NOT EXISTS fußstatus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES profiles(id),
  patient_name  TEXT,
  aufnahmedatum DATE NOT NULL DEFAULT CURRENT_DATE,
  wagner_grad   SMALLINT CHECK (wagner_grad BETWEEN 0 AND 5),
  seite         TEXT CHECK (seite IN ('links','rechts','beide')),
  befunde       JSONB,
  foto_urls     TEXT[],
  notizen       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fußstatus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_fußstatus" ON fußstatus
  FOR ALL USING (owner_id = auth.uid());
```

Tablolar oluştuktan sonra `mcp__supabase__execute_sql` ile doğrula:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('heilmittel_catalog','diagnosegruppen','verordnungen','podologie_behandlungen','fußstatus');
```
5 satır gelmiyorsa hata var, düzelt.

```sql
SELECT COUNT(*) FROM heilmittel_catalog;  -- 18 olmalı
SELECT COUNT(*) FROM diagnosegruppen;     -- 5 olmalı
```

**FAZ 1 TEST GEÇTİ mi?** → Her iki sorgu beklenen sayıyı döndürüyorsa FAZ 2'ye geç. Dönmüyorsa migration'ı tekrar çalıştır.

---

## ADIM 2 — §302 Gate'i Aç (agy sub-agent)

`dashboard.js` dosyasında `sector === 'physiotherapy'` kontrolü yapılan her yeri bul. `['physiotherapy','podologie'].includes(sector)` olarak değiştir. Birden fazla yer olabilir — hepsini bul.

**agy prompt'u yaz ve çalıştır:**
```
dashboard.js dosyasında (c:\Users\Test\Desktop\claude\website\dashboard.js) 
sector === 'physiotherapy' ile yapılan her kontrol kontrolünü bul. 
Bunları ['physiotherapy','podologie'].includes(sector) olarak değiştir.
Önce Read ile dosyayı oku, grep ile tüm eşleşmeleri bul, sonra Edit ile değiştir.
Değişiklik sonrası dashboard.html'deki dashboard.js?v= query param'ını ?v=20260613 yap.
```

**FAZ 2 TEST:** agy sub-agent'a şunu yaptır:
```
dashboard.js dosyasını oku (c:\Users\Test\Desktop\claude\website\dashboard.js).
grep ile "physiotherapy" kelimesini ara. Sadece string literal olarak kalan var mı?
(array içindeki 'physiotherapy','podologie' geçişler normal — tek başına === 'physiotherapy' kalmamalı)
Kaç tane bulduğunu say ve hangi satırlarda olduğunu raporla.
```
Tek başına kalan varsa agy'ye düzelttir, sonra tekrar kontrol et.

---

## ADIM 3 — Podologie Billing UI (agy sub-agent, ADIM 2 bittikten sonra)

**2. ADIM 2 tamamlanmadan başlatma.**

`dashboard.js`'e Podologie sektörü için yeni bir panel ekle. Panel şunları içermeli:

**A. Yeni Verordnung (Reçete) Ekle formu:**
- Hasta adı input
- Ausstellungsdatum (date picker)
- Diagnosegruppe select: DF-a / DF-b / DF-c / NF / QF / UI1 / UI2
- Behandlungseinheiten (sayı)
- Therapiefrequenz (text, örn. "2x wöchentlich")
- Dringend checkbox (işaretliyse 14 gün kuralı, değilse 28 gün)
- Hausbesuch checkbox
- Kaydet → `verordnungen` tablosuna INSERT

**B. Aktif Verordnungen listesi:**
- Her reçete için: hasta adı, diagnosegruppe, ausstellungsdatum, kalan seans
- Uyarı: ausstellungsdatum + 28 gün (dringend ise 14) geçmişse ve behandlungsstart boşsa → kırmızı uyarı "Başlangıç süresi dolmuş olabilir"
- Uyarı: Son behandlungsdatum'dan bu yana 84 gün (12 hafta) geçmişse → "Verordnung geçersiz olabilir"

**C. Tagesbehandlung kaydet formu (bir verordnung seçiliyken):**
- Behandlungsdatum (date picker, default bugün)
- HPNR seçici — diagnosegruppe'ye göre filtreli:
  - DF/NF/QF: 78010, 78020, 78030 (otomatik seçili), 78040, 79933, 79934
  - UI1: 78010, 78020, 78510 — 78030 LISTEDE YOK
  - UI2: 78100, 78110, 78610, 78620, 78530, 78510, 78520 — 78030 LISTEDE YOK
- Lokalisation input: sadece UI1/UI2 seçiliyken görünür ve zorunlu (hangi zehe?)
- Validasyon (kaydet butonuna basınca kontrol et):
  1. UI1/UI2 + 78030 seçildi → "Befundung (78030) UI1/UI2 ile kullanılamaz"
  2. UI1/UI2 + ICD-10 L60.0 değil → "UI1/UI2 için yalnızca L60.0 geçerlidir"
  3. 78040 + 78030 aynı gün → "Eingangsbefundung ve Befundung aynı günde birlikte kullanılamaz"
  4. 78610/78620 + UI2 değil → "Nagelspange yalnızca UI2 ile"
  5. Lokalisation boş + UI1/UI2 → "Zehe lokalizasyonu zorunludur"
- Geçerliyse `podologie_behandlungen` tablosuna INSERT

**Stil:** Dark theme. `--bg-card-solid`, `--text-main`, `--border-subtle` CSS değişkenlerini kullan. Mevcut dashboard panel stilini kopyala.

**FAZ 3 TEST:** agy sub-agent'a şunu yaptır:
```
c:\Users\Test\Desktop\claude\website\dashboard.js dosyasını oku.
Şunların varlığını doğrula ve raporla:
1. diagnosegruppe değişkenine göre hpnr listesi filtreleme yapan bir fonksiyon var mı?
2. UI1 veya UI2 seçiliyken 78030'u ÇIKARAN kod var mı? (filter veya exclude mantığı)
3. Validasyon fonksiyonu: şu 5 kontrolü içeriyor mu:
   - UI1/UI2 + 78030 → hata
   - UI1/UI2 + L60.0 değil → hata  
   - 78040 + 78030 aynı gün → hata
   - 78610/78620 + UI2 değil → hata
   - lokalisation boş + UI1/UI2 → hata
4. Supabase'e INSERT yapan kod: verordnungen ve podologie_behandlungen tablolarına yazıyor mu?
Her madde için EVET/HAYIR + satır numarası ver.
```
HAYIR olan maddeler varsa agy'ye tamamlattır.

---

## ADIM 4 — Wagner Staging / Fußstatus Modülü (agy, ADIM 3 bittikten sonra)

`dashboard.js`'e Podologie kullanıcıları için Fußstatus paneli ekle:

- Yeni kayıt formu:
  - Hasta adı
  - Tarih (default bugün)
  - Seite: Links / Rechts / Beide
  - Wagner Grad: 0-5 görsel seçici (her derece için kısa açıklama göster)
    - 0: Risikofuß (keine offene Läsion)
    - 1: Oberflächliche Ulzeration
    - 2: Tiefes Ulkus (Sehne/Knochen sichtbar)
    - 3: Tiefeninfektion / Abszess
    - 4: Begrenzte Gangrän
    - 5: Ausgedehnte Gangrän
  - Befunde checkboxları: Hyperkeratose, Nagelveränderungen, Durchblutungsstörungen, Sensibilitätsstörungen, Ödem
  - Notizen textarea
  - Foto yükleme alanı: şimdilik UI hazırla, "Speichern" butonuna basınca fotoğraf seçimini al ama storage entegrasyonu henüz yok — console.log yap, kullanıcıya "Fotoğraf depolama yakında" mesajı göster
  - Kaydet → `fußstatus` tablosuna INSERT (foto_urls boş array)
- Kayıt geçmişi: son 10 kaydı listele, wagner_grad renkli badge ile göster (0=yeşil, 1-2=sarı, 3-4=turuncu, 5=kırmızı)

**FAZ 4 TEST:** agy sub-agent'a şunu yaptır:
```
c:\Users\Test\Desktop\claude\website\dashboard.js dosyasını oku.
Wagner staging paneli için şunları kontrol et:
1. wagner_grad 0-5 arası seçim UI'ı var mı? (select veya radio buttons)
2. Her derece için açıklama metni var mı? (Risikofuß, Oberflächliche Ulzeration vs.)
3. seite seçimi var mı? (links/rechts/beide)
4. fußstatus tablosuna INSERT yapan kod var mı?
5. Geçmiş kayıtları listeleyen kod var mı?
Her madde EVET/HAYIR + satır numarası.
```

---

## ADIM 5 — Son Entegrasyon Testi (agy sub-agent)

Tüm adımlar bittikten sonra agy sub-agent'a kapsamlı test yaptır:

```
Görev: Praxura dashboard Podologie entegrasyonunu test et.

1. Localde server başlat: npx serve c:\Users\Test\Desktop\claude\website -p 3001
2. Tarayıcıda http://localhost:3001/dashboard.html aç
3. fizyo6@gmail.com / Yavuzkemal123. ile giriş yap
4. Eğer mevcut profil Physiotherapie sektöründeyse, Podologie sektöründe YENİ bir test profili oluştur
   (Onboarding sayfasına git: http://localhost:3001/onboarding.html, yeni hesap gerekmiyorsa profil sektörünü geçici değiştir)
5. Dashboard'da Podologie kullanıcısı olarak §302 / Billing modülünün görünüp görünmediğini kontrol et
6. Yeni bir Verordnung ekle: Diagnosegruppe=DF-a, ICD-10=E11.74, 6 seans
7. Diagnosegruppe UI2 seç ve 78030 kodunun listede çıkmadığını doğrula
8. Lokalisation alanının UI2 seçilince göründüğünü kontrol et
9. Wagner Staging: Wagner Grad=2, Seite=rechts seç, kaydet
10. Browser console'da hata var mı? (F12 → Console)

Her adım için: GEÇTI / BAŞARISIZ + gördüğün şeyi yaz.
BAŞARISIZ olan varsa hatayı dashboard.js'te bul ve düzelt, sonra tekrar test et.
```

---

---

## §302 EDIFACT Billing Notu (V2 için, şimdi implement etme — sadece bil)

Podologie §302 veri iletimi Physiotherapie ile **aynı EDIFACT formatını** kullanır (Technische Anlage 3, TA 3). Yeni bir parser/writer gerekmez. Sadece şu kodlar farklı:

| Alan | Physiotherapie | Podologie |
|------|----------------|-----------|
| Abrechnungscode | 22 | **71** |
| HPNR prefix | 20xxx/10xxx | **78xxx** |
| Tarifkennzeichen | 00 | **00** (aynı) |
| Verordnungsart standard | 03 | **03** (aynı) |
| Blanko-Verordnung (05) | Uygulanabilir | **Henüz geçerli değil** |

Kaynak: Anlage 3 TP5 V21 (19.09.2025, anzuwenden ab 01.10.2025), §8.1.5.1 Abrechnungscode.  
En güncel versiyon: `Handbücher/Anlage_3_TP5_V22_20260218.pdf` (V22, 18.02.2026).

Mevcut §302 billing kodu Podologie için devreye alınırken sadece Abrechnungscode `71` ve HPNR `78xxx` geçmesi yeterli — mesaj zarfı aynı.

---

## Bitti Sayılma Kriteri

- [ ] 5 tablo Supabase'de oluştu (MCP ile doğrulandı)
- [ ] §302 modülü Podologie'ye açık (sector kontrolü güncellendi)
- [ ] HPNR seçici diagnosegruppe'ye göre filtreli, UI1/UI2'de 78030 yok
- [ ] 5 validasyon kuralı çalışıyor
- [ ] Verordnung (reçete) eklenip takip edilebiliyor
- [ ] Wagner staging formu kayıt yapabiliyor
- [ ] cache-busting `?v=20260613` güncellendi
- [ ] git diff doğrulandı
