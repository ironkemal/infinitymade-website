# Ops-Dashboard — Kurulum

İkimizin (Kemal + Melih) ortak takip panosu. `ops.infinitymade.de`.
Ürün kodundan **tamamen ayrı**: ayrı Supabase projesi, ayrı Vercel projesi.
Mevcut 12/12 serverless fonksiyon limitine dokunmaz — burada hiç fonksiyon yok, saf statik sayfa.

---

## 1. Supabase projesi (5 dk)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   - İsim: `praxura-ops` · Region: **Frankfurt (eu-central-1)** · Free plan
   - ⚠️ Ürün projesine (`njvuclullotbksskpwgk`) **kurma.** Orada hasta verisi var.
2. **SQL Editor** → `schema.sql` dosyasının tamamını yapıştır → Run
3. **Authentication → Providers → Email** → *Confirm email* kapalı olabilir,
   ama **Authentication → Sign In / Providers → "Allow new users to sign up" → KAPAT.**
   Bu asıl güvenlik kapısı: kapalıyken kimse kendini üye yapamaz.
4. **Authentication → Users → Add user** ile iki hesabı elle aç
   (kendi e-postan + Melih'inki, şifreleri belirle, ona kendi şifresini ilet)
5. SQL Editor'da `schema.sql` sonundaki **SEED** bloğunu yorumdan çıkarıp çalıştır.
   Melih'in e-postası farklıysa oradaki `case` satırını ona göre düzelt.

## 2. Anahtarları yerleştir

Supabase → **Project Settings → API**:

- `Project URL` ve `anon public` → `ops/config.js` içine yaz.
  (Bu ikisi gizli değil, tarayıcıya zaten gider. Koruma RLS + kapalı signup.)
- `GITHUB_REPO` doğru mu kontrol et (`ironkemal5/website`).
- `ONEDRIVE_SHARE_URL` → paylaşılan belge klasörünün linkini yapıştır (adım 5).

`ops/.env.ops` dosyası (git'e girmez) sadece Claude'un `ingest.mjs` script'i içindir —
dashboard'un çalışması için gerekli **değildir.** İlk toplantı notu işlenirken
`SUPABASE_SERVICE_ROLE_KEY=` satırına secret anahtar yapıştırılır, o kadar.

## 3. Vercel (yeni proje)

1. Vercel → **Add New → Project** → aynı GitHub reposunu seç
2. **Root Directory: `ops`** ← en önemli ayar. Bunu yaparsan mevcut praxura projesi
   hiç etkilenmez, iki proje aynı repodan bağımsız deploy olur.
3. Framework Preset: **Other** · Build Command: boş · Output Directory: boş
4. Deploy → sonra **Settings → Domains → `ops.infinitymade.de`** ekle
5. Vercel'in verdiği CNAME kaydını `infinitymade.de` DNS'ine gir

## 4. Kontrol

- `ops.infinitymade.de` → giriş ekranı gelmeli
- Giriş yap → Aufgaben panosu, üç kolon: **Kemal | Gemeinsam | Melih**
- İki tarayıcıda aç, birinde kart taşı → diğerinde anında oynamalı (Realtime)
- Telefondan aç → kolonlar alt alta, kartın sağındaki **⋮** ile atama
  (telefonda sürükle-bırak çalışmaz, bu yüzden menü var)

## 5. Paylaşılan belge klasörü (OneDrive)

**Tüm projeyi senkronlama.** Depo 1,1 GB, `.git` tek başına 352 MB — OneDrive'da
`.git` bozulur ve iki kişi aynı anda çalışınca kod çakışan-kopyalara ayrılır.

Bunun yerine:

| Ne | Nerede |
|---|---|
| Kod | GitHub — Melih'i collaborator yap |
| Gitignore'lu paylaşılabilir belgeler (`legal/`, toplantı notları, faturalar) | Küçük bir OneDrive klasörü: `Praxura-Shared/` — içinde kod ve `.git` yok |
| Sırlar (`.env`, SSH anahtarı, API key, `INFRASTRUCTURE.md`) | Bitwarden / 1Password — ikisine de girmez |

`Praxura-Shared/` klasörünü Melih'le paylaş, linkini `config.js`'teki
`ONEDRIVE_SHARE_URL`'e koy → Dateien sekmesinde "Geteilter Ordner ↗" butonu belirir.

> **OneDrive silme davranışı:** Melih paylaşılan klasörden bir dosya silerse **senin
> lokal diskinden de silinir.** OneDrive silmeyi bir değişiklik olarak yayar.
> 30 gün içinde onedrive.com → Geri Dönüşüm Kutusu'ndan geri alınabilir, ama lokalde
> anında yok olur. Kodun neden orada olmaması gerektiğinin bir sebebi daha bu.

---

## Claude görevleri nasıl yazıyor

Toplantı notundan çıkan görevler doğrudan panoya düşer:

```bash
node ops/tools/ingest.mjs --meeting 2026-08-08 --file "Praxura weekly meeting/08.08.2026/notes.md" --dry
node ops/tools/ingest.mjs --meeting 2026-08-08 --file "Praxura weekly meeting/08.08.2026/notes.md"
```

`--dry` önce ne yazılacağını gösterir, hiçbir şey yazmaz. Not formatı:

```markdown
- [Kemal] Stripe Enterprise price ID oluştur !hoch
- [Melih] Podoloji ekranını gözden geçir
- [] Sözleşme taslağını ikimiz de okuyalım      ← boş köşeli parantez = ortak havuz
```

Script aynı başlıkta açık bir görev varsa atlar — aynı toplantıyı iki kez işlersen
kopya oluşmaz. Yazılan görevler panoda **Claude** rozetiyle ve meeting tarihiyle görünür.

## Themen ve Unteraufgaben

Pano iki seviyeli: **Thema** (Oberaufgabe) → altında açılıp kapanan **Unteraufgaben**.

- Bir tema kendi checkbox'ını taşımaz; `4/12` rozetiyle ilerlemesini gösterir ve son
  alt görev işaretlenince kendiliğinden "erledigt" olur.
- Bir kart **başka bir kartı bekleyebilir**: kartta `Zuerst: …` yazar. Bunu kart
  düzenleme kutusundaki *"Erst nach …"* alanından ayarlarsın.
- Kartı bir temanın altına sürükle-bırakla ya da **⋮ → ↳ Thema** ile taşırsın;
  kolonun boşluğuna bırakmak kartı tekrar en üst seviyeye çıkarır.
- İki seviye sabittir (DB trigger'ı üçüncüyü reddeder) — daha derini pano okunmaz yapar.

Sıralama elle: temalar yukarıdan aşağıya **yapılma sırasına** göre dizilidir
(önce hukuki zemin ve erişim güvenliği, en sonda launch smoke testi).

Mevcut panoyu yeniden gruplamak için (kart silmez, sadece bağlar ve sıralar):

```bash
node ops/tools/regroup.mjs --dry     # ne olacağını gösterir
node ops/tools/regroup.mjs
```

Gruplama tanımı `ops/tools/groups.mjs` dosyasında — tema başlıkları, sıra ve
"önce şu bitsin" bağları orada duruyor.

## Haftalık toplantı odağı — mavi kartlar

Toplantıdan çıkan görevler `meeting_date` taşır (bkz. `ingest.mjs`). Pano bunu
renk olarak kullanıyor:

- **Mavi kart = en son toplantıdan gelen, hâlâ açık istek.** Yani müşteri/kullanıcı
  isteği. Bir tema, altında o haftadan açık madde varsa mavi olur ve
  `◆ Diese Woche 6` rozetiyle kaç tane olduğunu yazar.
- Daha eski toplantılardan gelen kartlar soluk mavi `Meeting 08.08.` rozetiyle işaretli —
  kaynağı belli ama odakta değil.
- Filtre çubuğundaki **◆ Diese Woche** düğmesi panoyu sadece o haftaya indirger:
  temalar kendiliğinden açılır ve içinde yalnız o haftanın maddeleri görünür,
  rozet `6/13` olur. Tekrar basınca tam pano geri gelir.

"Bu hafta" otomatik ilerler: yeni toplantı notu işlendiğinde en yeni tarih o olur.
Eski haftanın tüm maddeleri kapandığında da odak kendiliğinden bir önceki açık
toplantıya döner — elle ayar yok.

## Verlauf / Audit-Trail — die Falle für verschwundene Zuweisungen

Zuweisungen sind auf dem Board schon mehrfach von selbst verschwunden, ohne dass
sich hinterher sagen ließ, wer oder was sie entfernt hat. Ohne einen Vorfall zum
Untersuchen lässt sich die Ursache nicht finden — deshalb wird ab jetzt jede
Änderung mitgeschrieben.

**Einmalig einspielen** (Supabase → Projekt `praxura-ops` → SQL Editor):

```
ops/schema-audit.sql        ← Inhalt einfügen → Run
```

⚠️ Nicht im Produkt-Projekt (`njvuclullotbksskpwgk`) ausführen — dort liegen
Patientendaten. Das Skript ist idempotent, mehrfaches Ausführen schadet nicht.

Danach protokolliert die Tabelle `ops_todos_audit` jede Änderung an **Zuständig**,
**Thema** und **Erledigt** sowie jedes **Löschen** einer Aufgabe — mit Zeitpunkt und
Verursacher.

**Ansehen:** auf der Karte **⋮ → Verlauf**. Ist das Skript noch nicht gelaufen,
sagt der Dialog das offen, statt einen Fehler zu zeigen.

Zwei Dinge, die man beim nächsten Vorfall dort abliest:

- `Verursacher = Skript / SQL-Editor` heißt: nicht geklickt, sondern von
  `ops/tools/ingest.mjs`, `regroup.mjs` oder direkt im SQL-Editor geändert.
- Ein Eintrag `Zuständig: Melih → Gemeinsam (Pool)` direkt neben einem Eintrag
  `Thema: kein Thema → …` heißt: die Karte wurde unter ein Thema gehängt und hat
  dabei dessen Spalte übernommen. Das ist so gewollt (Unteraufgaben werden nur
  unter ihrem Thema gezeichnet), das Board weist beim Einhängen jetzt ausdrücklich
  darauf hin.

## Sınırlar — bilinçli

- **TODO.md burada değil.** `TODO.md` ürün/teknik listesi olarak kalır (§302, launch, kod).
  Bu pano ikimizin arasındaki işler, haftalık toplantı görevleri ve şirket/ortaklık işleri için.
- **Dateien sekmesi salt-okunur** ve sadece GitHub'daki (yani gitignore'lu olmayan)
  dosyaları gösterir. Sözleşmeler ve gizli belgeler oraya düşmez — onlar paylaşılan klasörde.
- Sohbet / dosya yükleme / takvim yok. WhatsApp zaten var; kullanılmayacak ama bakım
  isteyecek şey eklemiyoruz.
