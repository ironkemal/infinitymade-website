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

## Sınırlar — bilinçli

- **TODO.md burada değil.** `TODO.md` ürün/teknik listesi olarak kalır (§302, launch, kod).
  Bu pano ikimizin arasındaki işler, haftalık toplantı görevleri ve şirket/ortaklık işleri için.
- **Dateien sekmesi salt-okunur** ve sadece GitHub'daki (yani gitignore'lu olmayan)
  dosyaları gösterir. Sözleşmeler ve gizli belgeler oraya düşmez — onlar paylaşılan klasörde.
- Sohbet / dosya yükleme / takvim yok. WhatsApp zaten var; kullanılmayacak ama bakım
  isteyecek şey eklemiyoruz.
