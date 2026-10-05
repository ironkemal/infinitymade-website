# Konsey Kararı — KI: tek Praxura Azure hesabı + kısa ömürlü jeton (K-20)
Tarih: 2026-10-05 (akşam) · Oturan üyeler: guvenlik, muhalif, deger-mi, fonksiyon-ustasi · ön görüş: legal-de, onprem · karar: Kemal

## Çerçeve
SORU: Kutu, metin KI işlerini (seri planlama, randevu teyit / B2C / B2B mail taslağı, Heilmittel normalizasyonu) hangi hesapla yapar?
YENİ OLGU (yeniden açma gerekçesi): aynı gün öğlen 3b.2 kararı merkezi relay'i reddedip "praksis başına anahtar" (K4 / B′) yolunu göstermişti. Bu yol fiilen çöktü: STACKIT 01.10'da hesap açmadı, praksislerin kendi Azure hesabı açması gerçekçi değil. Reçete fotoğraf OCR'ı iptal (barkod yerelde). APIM (≈42–173 €/ay sabit) ve kendi model sunucusu (~184 €/ay + §393 sorunu) Kemal tarafından reddedildi.
SEÇENEKLER: A) tek Praxura Azure kaynağı + kısa ömürlü jeton · B) praksis başına ayrı Azure kaynağı (otomatik, 0 € sabit, 30 kaynak/bölge/abonelik) · C) KI yok / yalnız BYO.
ON-PREM ETKİSİ: içerik merkezden geçmez; merkez yalnız jeton + sayaç (metadata).

## KARAR
**A, küçük sürümle.** Praxura'nın Azure aboneliğinde tek Azure OpenAI kaynağı (Sweden Central, Standard). Gerçek sır yalnız `merkez/`'de. Kutu K-18'deki tek kimlikle saatte bir 60–90 dakikalık Entra jetonu alır, yalnız bellekte tutar, M4 kapısında izin listesiyle maskeler (serbest metin çıkmaz, fail-closed) ve doğrudan Azure'a gider. İçerik merkezden geçmez; relay yok (K6 aynen). v1: kutu başına sabit aylık sınır, merkezin verdiği jeton sayısına dayalı; Stripe/ekstra kredi yok; beta süresince ücretsiz; opt-in. Betalar kutuya KI kapalı geçer. Açılış sırası: seri planlama + Heilmittel normalizasyonu önce, mail taslakları avukat cevabından sonra. Playbook K4 (müşterinin kendi hesabı) bununla değişir; `direkt` (BYO) modu istisna olarak kalır. Uygulama: KHS K-20, 3b.4, M4.11, K2b.17, §5 ORG.

## Gerekçe
legal-de'nin 05.10 vetosu içeriğin bizim sunucumuzdan geçmesine dayanıyordu; bu modelde geçmiyor, §393 C5 yükü Microsoft'ta kalıyor. guvenlik'in %13 vetosu serbest metnin merkezde açık okunmasına dayanıyordu; serbest metin hiç çıkmıyor. Belirleyici olan muhalif ve deger-mi: kutunun bildirdiği sayı doğrulanamaz ve fiyat henüz yok, bu yüzden kredi muhasebesi şimdi yazılmaz.

## Ödün verilenler
- KI için AV oluruz (opt-in modülle sınırlı); Microsoft alt işleyicimiz. "Veriye hiç dokunmuyoruz" cümlesi KI modülü açık praksiste geçerli değil.
- Tek kaynak: Azure tarafında kutular ayırt edilemez; kota yumuşak, asıl fren TPM.
- Jeton süresinden önce iptal edilemeyebilir (doğrulanmadı) → çalınan jeton ≤ 90 dk çalışır, faturası bize.
- Merkez kapalıysa KI kapalı (kutunun geri kalanı çalışır).

## Uzlaşma
İçerik merkezden geçmez · kalıcı anahtar kutuya girmez · store:false + kayıt tutan Azure özellikleri kapalı · dar RBAC + kutular için ayrı SP · endpoint tam host adıyla denetlenir · tek kutu kimliği · v1 küçük.

## Anlaşmazlık
- Mail taslakları: muhalif "hukuk teyidine kadar bekle", legal-de "şartlarla olur". Karar: avukat cevabından sonra (legal-de'nin kendi 5. şartıyla da uyumlu).
- Kota kaynağı: ilk tasarım kutu bildirimi; muhalif "merkezin verdiği jeton sayısı". Karar: muhalif.

## Kör noktalar
- Paylaşılan kaynakta kiracılar arası okuma (Responses `store` varsayılan açık) — onprem + legal-de + guvenlik üçü de buldu.
- Ele geçirilmiş merkez kendi Azure kaynağını endpoint olarak gönderebilir → joker değil tam host (guvenlik).
- Aynı Azure kimliği VPS'teki eski KI kaynağına da açık olabilir → ayrı SP (guvenlik).
- Kutu kimliği üç yerde ayrı icat edilebilir (fonksiyon-ustasi).

## Uygulama — builder'a
- [ ] KHS 3b.4 — merkez jeton ucu (`merkez/`, Hat K) — karmaşıklık: K3
- [ ] KHS K2b.17 — tek kutu kimliği Ed25519 (Hat K) — K3
- [ ] KHS M4.11 — kutu tarafı jeton modu (Hat M, M4.1 sonrası) — K2
- [ ] §5 ORG — avukat, Microsoft talebi, Azure kurulumu + üç elle test, belgeler — K1
Doğrulanmamış (kurulumdan önce): jeton iptali · özel rolün data action listesi · içerik log ayarları · Entra jeton ömrü 60–90 dk.

## Backlog (karara dahil DEĞİL)
- Tam model (kota + ekstra kredi + Stripe): fiyatlar kesin + ≥5 ödeyen kutu + bir kutu iki ay üst üste %80 (deger-mi).
- Kutu bazında doğrulanabilir ölçüm gerekirse praksis grubu başına ayrı kaynak (B'nin hafif hâli).
- Kutuda yerel model (Ollama, 16 GB PC) seçeneği.

## Sert veto
Yok. legal-de 05.10 vetosu bu model için 🔧 koşullu (`compliance/LEGAL_DECISIONS.md` Nachtrag 4). guvenlik vetosu bu model için kalktı (sicil S-45). onprem veto yok (sicil O-169).
