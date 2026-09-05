# Wissensbank — dışarıdan indirilen resmî verinin tek adresi

GKV-Spitzenverband, gkv-datenaustausch.de, BfArM, KBV, G-BA, ITSG ve Vertragspartner'lardan
indirdiğimiz **her** resmî belge burada durur. Başka yerde durmaz.

Sahibi: `wissensbank` ajanı · Kuruldu: 05.09.2026

---

## Üç yönetim dosyası — üç ayrı soru

| Dosya | Soru |
|---|---|
| `REGISTER.md` | **Nereden geldi**, hangi sürüm, ne zaman düşer, **hangi kodu/tabloyu besler** |
| `INDEX.md` | Belgenin **içinde ne var**, hangi bölüm nerede + okuma protokolü |
| `SPEC-RULES.md` | Belgeden **süzülmüş kural** (kaynak + sürüm + kod satırı üçlüsü) |

Biri diğerinin yerine geçmez. Yeni belge geldiğinde **REGISTER'a her zaman**, INDEX'e
okunduğunda kayıt açılır.

---

## Klasör kuralı — yeni belge nereye gider

**Tek soru:** *bu belge kaç Fachbereich'ı ilgilendiriyor?*

| Klasör | Ne girer | Örnek |
|---|---|---|
| `gemeinsam/` | **Birden fazla alanı** ilgilendiren her şey | §302 anlagenleri, ICD-10-GM, HeilM-RL, Kostenträgerdatei |
| `podologie/` | Yalnız podolojiye özel | Podologie Anlage 1a–3, FAK, filtrelenmiş HPNR |
| `physiotherapie/` | Yalnız fizyoterapiye özel | Physio Vertrag §125 Anlage 2, Blanko-Leitfaden |
| `ergotherapie/` | Yalnız ergoterapiye özel | Ergo Anlage 2 Vergütungsvereinbarung |
| `logopaedie/` | Yalnız logopediye özel (`sssst` = Stimm-, Sprech-, Sprach-, Schlucktherapie) | sssst Anlage 2 |
| `_archiv/` | Düşmüş · kapsam dışı · mükerrer | Ernährungstherapie, Rettungsdienst-Anhang, duplikatlar |

`gemeinsam/` içindeki alt bölümler:

```
gemeinsam/302-tp5/                §302 SGB V teknik anlagenler + Anhänge + XSD
gemeinsam/kostentraeger/          Kostenträgerdatei (EDIFACT KOTR) — IK numaraları
gemeinsam/heilmittel-richtlinie/  HeilM-RL, KBV Diagnoseliste, praxiswissen
gemeinsam/positionsnummern/       Heilmittelpositionsnummernverzeichnis (tüm bereich'lar)
gemeinsam/icd-10-gm/              BfArM ICD-10-GM veri paketi
```

**Kararsız kaldığında `gemeinsam/`.** Bir alanın belgesini ortak klasöre koymak ucuz bir
hatadır (fazladan bir kişi görür); ortak belgeyi alan klasörüne koymak pahalıdır — diğer
üç alan onu hiç bulamaz.

**Buraya girmeyen:** kendi ürettiğimiz iş. Prototip, ürün kararı, loop promptu, kod, ekran
görüntüsü — bunlar `Podoloji/`, `module/`, `compliance/` gibi kendi yerlerinde kalır.
Ölçüt basit: **dışarıdan mı indirdik?** Hayırsa buraya girmez.

---

## Okuma kuralı

1. **PDF açılmaz.** Her PDF'in yanında `pdftotext -enc UTF-8 -layout` ile üretilmiş `.txt`
   karşılığı var; arama ve okuma onun üzerinden yapılır.
2. **Tamamı okunmaz.** `INDEX.md`'deki bölüm haritasından hangi kısmın lazım olduğu bulunur,
   `Grep` ile o aralık okunur. `Anlage_1_TP5_V21` tek başına ~130k token, `icd10gm2026syst_kodes.txt`
   ~1M token — tamamını okumak neredeyse her zaman hatadır.
3. **Türev otorite değildir.** Fatura/hukuk iddiası her zaman orijinal + bölüm + sürüm
   üçlüsüne dayanır.
4. **Sayı taşıyan tabloyu YZ çevirmez** — fiyat, pozisyon no, IK, Schlüssel, ICD. Deterministik
   araç + orijinale karşı örnekleme. Gerekçe: `api-backend/preise_pruefen.mjs` başlığı.

---

## Yedekleme uyarısı

`.gitignore:1` → `*.pdf`. Buradaki **PDF'ler git'te değil**, yalnızca `.txt` karşılıkları
izleniyor. Yani metin kayıp değil ama imzalı/orijinal PDF yalnızca bu makinede duruyor.
Absetzung itirazında başvurulan belge odur. → `REGISTER.md` W-A05.
