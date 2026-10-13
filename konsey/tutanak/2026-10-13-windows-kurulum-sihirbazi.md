# Konsey Kararı — Windows kurulum sihirbazı (grafik)
Tarih: 2026-10-13 · Oturan üyeler: onprem, guvenlik, muhalif, deger-mi, fonksiyon-ustasi

## KARAR
İki aşama, ikisi de **A (PowerShell + WinForms, `.ps1`)** üzerine kurulur; imzasız `.exe` (B) ve MSI (C) yapılmaz.

**Aşama 1 — bugün, image'a dokunmadan (0.6.2 gerekmez):** `install.ps1`'e grafik mod eklenir. Pencere 11 Windows adımını işaretli liste + ilerleme olarak gösterir (ön kontrol, WSL, Docker, autostart, firewall, sertifika, enerji). Adım 6 (`install.sh`) **bugünkü gibi kendi konsol penceresinde** koşar — kod, kutu adı, yedek hedefi ve `GESICHERT` orada, kullanıcının kendi klavyesiyle. Hiçbir sır GUI'den geçmez, argv/env/dosyaya yazılmaz. Başlatma: aynı `irm` satırı **ya da** `installieren.html`'den indirilen `Praxura-Einrichtung.cmd` (çift tık → yönetici PowerShell → aynı betik). Metin modu yerinde kalır (`-Text`), GUI açılamazsa ona düşer.

**Aşama 2 — ilk müşteriden önce:** `install.sh`'ın soruları başta tek blokta toplanır; GUI gizli olmayan cevapları (kanal, TLS, yedek hedefi önerisi) toplar, kurulum kodu **stdin** ile verilir (argv/env/`%TEMP%` yok). Gizli sorular yeniden başlatmadan **sonra** sorulur. `GESICHERT` her zaman elle yazılır, onay kutusu yerine geçmez. `install.ps1` önce image'taki `install.sh`'ın yeteneğini sorar (manifest sürümü), tanımazsa metin akışına döner (`:stable` eski kalabilir). Release 0.6.2+.

## Gerekçe
Kimse veto vermedi. Belirleyici iki olgu: (1) sır disiplini `install.sh`'ta zaten var (`reveal_once`, log'a yazmama, elle `GESICHERT`) ve onu atlatmanın tek yolu GUI'nin sırrı taşıması — aşama 1 bunu hiç yapmaz (guvenlik, onprem). (2) Test PC'de dört hatayı bulan yol interaktif konsoldu; bugün install.sh'a ikinci giriş yolu açmak, hiç koşmamış bir yolu ilk müşteriye taşır (muhalif). Aşama 1 kodu aşama 2'de atılmaz: pencere aynı kalır, yalnız soru sayfaları eklenir.

## Ödün verilenler
Bugün test PC'de kurulum sorularının bir kısmı hâlâ siyah pencerede. "Hiç terminal görmeyen" deneyim aşama 2'ye kalır. İndirilen `.cmd`/`.ps1` için Windows uyarısı (MOTW/SmartScreen) bugün de çıkar.

## Uzlaşma
- İmzasız `.exe` yok — müşteriye "uyarıyı geç" öğretmek sahte `Praxura-Setup.exe`'ye yol açar (guvenlik, muhalif, deger-mi).
- `GESICHERT` elle kalır; kurulum kodu argv/`env X=`/log/`Start-Transcript`'e düşmez.
- Kutu adı, yedek hedefi, anahtar onayı kullanıcıda; kanal ve TLS varsayılan alabilir.
- Cevap dosyası sır içermez.

## Anlaşmazlık
deger-mi + muhalif: "bugün önce mevcut tek satırla test PC'yi bitir, GUI sonra". onprem: "bugün A, metin dönüşü açık". Chairman: kurucunun bugünkü isteği komut yazmadan denemek; aşama 1 test edilmiş `install.sh` yolunu değiştirmediği için muhalifin riski (test görmemiş yol) doğmaz. Bu yüzden A bugün, ama yalnız Windows kabuğu.

## Kör noktalar
- `install.ps1:175` (`--neuer-jeton`) bugün `env X=… bash` biçiminde çağırıyor — aşama 2'de süreç listesi açısından gözden geçirilecek (onprem).
- `install.ps1` her zaman güncel praxura.de'den, `install.sh` kanalın image'ından gelir → sürüm uyumsuzluğu; aşama 2'nin yetenek kontrolü bunun için.
- İndirilen `.ps1`'in SHA-256'sı ayrı kanaldan teyit edilebilmeli (guvenlik, müşteriden önce, ucuz).

## Uygulama — builder'a
- [ ] Aşama 1: `install.ps1` GUI modu (WinForms, adım listesi + log alanı, adım 6 ayrı konsolda, `-Text` dönüşü, `-Fortsetzen` sonrası GUI yeniden açılır) — K2
- [ ] `Praxura-Einrichtung.cmd` başlatıcı + `installieren.html` indirme bağlantısı + `check-onprem.sh` başlatıcı bloğu — K1
- [ ] Test PC'de uçtan uca koşu (T17 b) — K1
- [ ] Aşama 2: `install.sh` soru bloğu + stdin kodu + yetenek kontrolü + 0.6.2 — K3 (ilk müşteriden önce)

## Backlog (karara dahil DEĞİL)
- Kod imzalama sertifikası + imzalı `.exe` sarmalayıcı — tetikleyici: ilk ödeyen müşterinin kurulum tarihi kesinleşince ya da bir beta müşterisi SmartScreen/PowerShell'de takılırsa.
- MSI — yalnız bir IT hizmet sağlayıcı/kurumsal müşteri isterse.
- `.ps1` SHA-256 yayını ayrı kanalda.
- Cloudflare Pages ölçüm listesine `.cmd` dosyası (CLOUDFLARE_PAGES_GECIS_PLANI.md madde 8).

## Sert veto varsa
Yok.
