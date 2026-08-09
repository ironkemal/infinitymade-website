// Board-Gliederung — welche Themen es gibt, in welcher Reihenfolge sie sinnvoll
// abgearbeitet werden und welche Aufgabe auf welche wartet.
//
// Reihenfolge-Logik (oben = zuerst):
//   1. Rechtliche/gesellschaftliche Basis — alles andere haftet sonst persönlich
//   2. Zugänge & Geheimnisse — Sicherheit gehört an den Anfang, nicht ans Ende
//   3.–8. Produkt: Podologie erst zu Ende bauen (Vertikal-Reihenfolge), dann Abrechnung
//   9.–10. Oberfläche und technische Schulden
//   11.–12. Härtung und Rechtstexte — vor dem Launch, nicht danach
//   13.–14. Bezahlung, Sichtbarkeit, Mail
//   15. Launch-Kontrolle — der Smoke-Test ist per Definition der letzte Schritt
//   16. Bewusst zurückgestellt
//
// `match` ist ein eindeutiges Textstück aus dem bestehenden Kartentitel.
// `after` = Titel-Stück der Aufgabe, die vorher fertig sein muss.

export const GROUPS = [
  {
    title: 'Şirket ve ortaklık temeli',
    category: 'Ortaklık',
    priority: 'hoch',
    notes: 'Ortaklığın hukuki zemini. Şirket kurulmadan birlikte çalışmak otomatik GbR yaratır ve kişisel sınırsız sorumluluk demektir — bu yüzden panonun en üstünde. Diğer ortaklık maddeleri şirket formu netleşmeden ilerlemez.',
    items: [
      { match: 'Şirket formu netleşsin' },
      { match: 'Koruyucu belgeler imzalansın' },
      { match: 'Ortaklık sözleşmesi', after: ['Şirket formu netleşsin'] },
      { match: 'Marka ve domain şirkete devredilsin', after: ['Şirket formu netleşsin'] },
      { match: 'Sigorta + Steuerberater', after: ['Şirket formu netleşsin'] },
      { match: 'Ekim 2026 kontrol noktasını' }
    ]
  },
  {
    title: 'Erişim, hesap ve sır güvenliği',
    category: 'Güvenlik',
    priority: 'hoch',
    notes: 'Hesap devralma ve sızmış anahtar riskleri. Bunlar geliştirmenin sonunda değil başında kapatılır — sonradan yapılırsa aradaki tüm süre açık geçmiş olur. Erişim paylaşımı koruyucu belgeler imzalanmadan yapılmaz.',
    items: [
      { match: '2FA’yı kalan platformlarda', alt: "2FA'yı kalan platformlarda" },
      { match: 'Fal AI anahtarı iptali' },
      { match: 'Erişim ve süreç kurulumu', after: ['Koruyucu belgeler imzalansın'] },
      { match: 'Ajanlar için ayrı private GitHub' },
      { match: 'SSH portu değişikliği' }
    ]
  },
  {
    title: 'Podoloji — Verordnung ve katalog doğruluğu',
    category: 'Podoloji',
    priority: 'hoch',
    notes: 'Podoloji vertikalinin çekirdeği: doğru Heilmittel, doğru HPNR, doğru Diagnosegruppe. Buradaki bir hata faturaya, oradan da kasa reddine dönüşür — bu yüzden ekran güzelleştirmesinden önce gelir. Vertikal sırası gereği tüm podoloji zinciri diğer alanların önünde.',
    items: [
      { match: 'Podoloji katalogunu daralt' },
      { match: 'Heilmittel seçilince Leitsymptomatik', after: ['Podoloji katalogunu daralt'] },
      { match: 'Nagelbearbeitung için HPNR' },
      { match: 'Diagnosegruppe ⇄ ICD çapraz' },
      { match: 'Diagnosegruppe seçicisi tıklamayla' },
      { match: 'Verordnung’dan doktor kaydı otomatik', alt: "Verordnung'dan doktor kaydı otomatik" },
      { match: 'Verordnung formunda doktor otomatik tamamlama', after: ['doktor kaydı otomatik'] },
      { match: 'Privatpatient akışını ayır' },
      { match: 'KI Verordnung kontrolünün maliyet' },
      { match: 'Verordnung prüfen (KI) butonu', after: ['KI Verordnung kontrolünün maliyet'] },
      { match: 'İmza tanıma sonucunu' },
      { match: 'Hasta ekranında paralel Verordnung' },
      { match: 'Auswertung: hangi doktordan' }
    ]
  },
  {
    title: 'Podoloji — Termin ve takvim',
    category: 'Podoloji',
    priority: 'hoch',
    notes: 'Termin-Anfrage akışı canlı ama yarım: onay/ret bitmeden üzerine Gegenangebot veya hasta bildirimi eklemek boşa emek olur. Bu yüzden zincir kabul/ret ile başlıyor.',
    items: [
      { match: 'Termin-Anfrage kabul/ret akışını bitir' },
      { match: 'Termin-Anfrage slot çakışma testi', after: ['Termin-Anfrage kabul/ret akışını bitir'] },
      { match: 'Takvime Verschieben-Modus' },
      { match: 'Termin-Anfrage’ye Gegenangebot', alt: "Termin-Anfrage'ye Gegenangebot", after: ['Termin-Anfrage kabul/ret akışını bitir'] },
      { match: 'Termin-Anfrage üzerinden hastaya not', after: ['Termin-Anfrage kabul/ret akışını bitir'] },
      { match: 'Termin-Anfrage formunu Verordnung maskesiyle' },
      { match: 'Randevu saatinde dakika hassasiyeti' },
      { match: 'Takvimde Mitarbeiter filtresi' },
      { match: 'Her çalışan için ayrı rezervasyon linki' },
      { match: 'Per-business working_hours' }
    ]
  },
  {
    title: 'Podoloji — Kassieren, Zuzahlung ve fatura akışı',
    category: 'Podoloji',
    priority: 'hoch',
    notes: 'Paranın praksise girdiği zincir. Fiyat kaynağı netleşmeden merkezi fiyat tablosu kurulamaz, o kurulmadan da tek tıkla Zuzahlung faturası doğru tutar üretmez — sıra bilerek böyle.',
    items: [
      { match: 'Kassieren akışını yeniden kurgula' },
      { match: 'Zuzahlung ve GKV fiyatları merkezi', after: ['Resmî GKV fiyat listesi kaynağını'] },
      { match: 'Tek tıkla Zuzahlung faturası', after: ['Zuzahlung ve GKV fiyatları merkezi'] },
      { match: 'Zuzahlung ekranını sadeleştir' },
      { match: 'Kassiert sonrası faturaya kalıcı bağlantı', after: ['Kassieren akışını yeniden kurgula'] },
      { match: 'Aylık genel bakış ve ödeme durumu' },
      { match: 'Stefan’dan örnek Ausfallrechnung', alt: "Stefan'dan örnek Ausfallrechnung" },
      { match: 'Ausfallrechnung şablonunu Stefan', after: ['örnek Ausfallrechnung'] },
      { match: 'Mahnung (ihtar) şablonu', after: ['Ausfallrechnung şablonunu Stefan'] },
      { match: 'Hasta adı düzeltilince' }
    ]
  },
  {
    title: 'Fatura şablonları ve praksis kimliği',
    category: 'Podoloji',
    priority: 'normal',
    notes: 'Logo, kaşe, banka bilgisi, footer ve vergi notu tek bir Hauptvorlage’de toplanır; faturaların görünen yüzü budur. Logo ve kaşe yüklenmeden Hauptvorlage tamamlanamaz.',
    items: [
      { match: 'Logo yükleme çalışır hale' },
      { match: 'Dijital kaşe (Stempel)' },
      { match: 'Tek Hauptvorlage kur', after: ['Logo yükleme çalışır hale', 'Dijital kaşe (Stempel)'] },
      { match: 'Rechnungs-Fußzeile alanını', after: ['Tek Hauptvorlage kur'] },
      { match: 'Şablon düzenleme noktalarını', after: ['Tek Hauptvorlage kur'] },
      { match: '§ 4 Nr. 14 a UStG' }
    ]
  },
  {
    title: 'GKV fiyatları ve §302 canlı hazırlık',
    category: 'Teknik',
    priority: 'hoch',
    notes: 'Gerçek para akışının ön koşulları: resmî fiyat kaynağı, IK/ITSG hesabı, gerçek Kostenträgerdatei, GoBD izi. ITSG hesabı açılmadan gerçek Kostenträgerdatei alınamaz, o alınmadan DMRZ üzerinden gerçek dosya gönderilemez.',
    items: [
      { match: 'Resmî GKV fiyat listesi kaynağını' },
      { match: 'Stefan’ın kardeşinden GKV Leistung', alt: "Stefan'ın kardeşinden GKV Leistung" },
      { match: 'IK-Nummer + ITSG portalına' },
      { match: 'Gerçek Kostenträgerdatei', after: ['IK-Nummer + ITSG portalına'] },
      { match: 'GoBD audit trail' },
      { match: 'DMRZ ile bir gerçek müşteri', after: ['Gerçek Kostenträgerdatei'] }
    ]
  },
  {
    title: 'eGK, kart okuyucu ve TI',
    category: 'Podoloji',
    priority: 'normal',
    notes: 'Kart okuyucu zinciri tek bir kapıya bağlı: VSDM/TI hukuki ve G8 (on-prem) uygunluğu onaylanmadan donanım araştırması da entegrasyon da boşa emektir. Onay çıkmadan alttaki hiçbir madde başlamaz.',
    items: [
      { match: 'eGK ön koşulu: VSDM/TI' },
      { match: 'eGK/Verordnung yüklemesi için DSGVO', after: ['eGK ön koşulu: VSDM/TI'] },
      { match: 'Kartenlesegerät marka/model', after: ['eGK ön koşulu: VSDM/TI'] },
      { match: 'eGK kart okuyucu entegrasyonunu araştır', after: ['eGK ön koşulu: VSDM/TI', 'Kartenlesegerät marka/model'] },
      { match: 'Lesegerät anbindung', after: ['eGK kart okuyucu entegrasyonunu araştır'] },
      { match: 'Zuzahlung Befreiungsstatus', after: ['eGK kart okuyucu entegrasyonunu araştır'] }
    ]
  },
  {
    title: 'Mobil ve responsive düzen',
    category: 'Teknik',
    priority: 'hoch',
    notes: 'Önce ölç, sonra düzelt: envanter çıkmadan tek tek px düzeltmek aynı yeri iki kez ellemek demek. Breakpoint sadeleşmesi de envanterden sonra gelir, PWA ise düzen oturmadan paketlenmez.',
    items: [
      { match: 'Mobil taşma envanteri çıkar' },
      { match: 'Breakpoint ölçeğini sadeleştir', after: ['Mobil taşma envanteri çıkar'] },
      { match: 'Sabit px genişlikleri esnek', after: ['Mobil taşma envanteri çıkar'] },
      { match: 'Kompakter Modus kaldırılsın', after: ['Mobil taşma envanteri çıkar'] },
      { match: 'PWA ve mobil installer', after: ['Breakpoint ölçeğini sadeleştir'] }
    ]
  },
  {
    title: 'Teknik borç ve site hijyeni',
    category: 'Teknik',
    priority: 'normal',
    notes: 'Tek başına küçük, birikince pahalı işler: ölü UI, bozuk kodlama, eksik 404/noindex, cache disiplini. Birbirinden bağımsız, aralara sığdırılır.',
    items: [
      { match: 'Pano atamaları kendiliğinden siliniyor' },
      { match: 'Dashboard Einstellungen’deki ölü WhatsApp', alt: "Dashboard Einstellungen'deki ölü WhatsApp" },
      { match: 'Ayarlardaki "Google Kalender" etiketi' },
      { match: 'UTF-8 encoding sorunu' },
      { match: 'Cache busting disiplini' },
      { match: 'demo-booking.html Google Fonts' },
      { match: 'noindex kontrolü' },
      { match: '404 sayfası var mı' },
      { match: 'Google OAuth doğrulama başvurusunu' }
    ]
  },
  {
    title: 'Güvenlik sertleştirme — yayın öncesi',
    category: 'Güvenlik',
    priority: 'hoch',
    notes: 'Ürün tarafı sertleştirme: MFA, bot koruması, çerez uyumu, hata izleme, yedek. Launch smoke testinden ÖNCE bitmeli — sonraya bırakılırsa ilk gerçek trafikte açık kalır.',
    items: [
      { match: 'MFA zorunluluğu owner girişinde' },
      { match: 'reCAPTCHA v3' },
      { match: 'Cookie banner TTDSG' },
      { match: 'Vercel serverless Sentry' },
      { match: 'Umami production domain' },
      { match: 'Hetzner günlük snapshot' }
    ]
  },
  {
    title: 'Hukuki metinler ve DSGVO belgeleri',
    category: 'Güvenlik',
    priority: 'hoch',
    notes: 'Impressum, AGB, Widerruf, DPA listesi, DSB bilgisi ve pazarlama iddialarının doğruluğu (UWG). Yayın öncesi kapanması gereken kalem; tarih damgası en sona, metinler oturduktan sonra.',
    items: [
      { match: 'Karşılaştırma tablosundaki yanlış özellik' },
      { match: 'Impressum güncelle' },
      { match: 'AGB güncelle' },
      { match: 'Widerruf sayfası' },
      { match: 'Support SLA’sını AGB’ye', alt: "Support SLA'sını AGB'ye", after: ['AGB güncelle'] },
      { match: 'DPA referans listesi' },
      { match: 'DSB iletişim bilgisini' },
      { match: 'AGB/Einwilligung checkbox' },
      { match: 'Mitarbeiter-Verpflichtung imzası' },
      { match: 'Tüm legal sayfalara Zuletzt aktualisiert', after: ['Impressum güncelle', 'AGB güncelle', 'Widerruf sayfası'] }
    ]
  },
  {
    title: 'Ödeme ve abonelik (Stripe)',
    category: 'Launch',
    priority: 'hoch',
    notes: 'Enterprise planı satılabilir değil: price ID yok. Vergi ve fraud ayarları da ilk gerçek ödemelerden önce oturmalı.',
    items: [
      { match: 'Stripe Enterprise price ID' },
      { match: 'Stripe Tax kurulumu' },
      { match: 'Stripe Radar' }
    ]
  },
  {
    title: 'Görünürlük, mail ve dış altyapı',
    category: 'Launch',
    priority: 'normal',
    notes: 'Dışarıdan görünen yüz: mail teslim edilebilirliği (DKIM/DMARC), statü sayfası, arama motoru dosyaları, tanıtım ve yardım içeriği.',
    items: [
      { match: 'Microsoft 365 DKIM' },
      { match: 'E-posta rate limit + DMARC' },
      { match: 'status.praxura.de CNAME' },
      { match: 'robots.txt ve sitemap.xml' },
      { match: 'Onboarding videosu ve Hilfe-Center' }
    ]
  },
  {
    title: 'Launch kontrolü ve canlıya geçiş',
    category: 'Launch',
    priority: 'hoch',
    notes: 'Uçtan uca smoke testi tanım gereği EN SON adımdır: altındaki tüm temalar bitmeden çalıştırmak, birkaç gün sonra tekrar çalıştırmak demektir.',
    blockedByGroups: [
      'Podoloji — Verordnung ve katalog doğruluğu',
      'Podoloji — Termin ve takvim',
      'Podoloji — Kassieren, Zuzahlung ve fatura akışı',
      'GKV fiyatları ve §302 canlı hazırlık',
      'Güvenlik sertleştirme — yayın öncesi',
      'Hukuki metinler ve DSGVO belgeleri',
      'Ödeme ve abonelik (Stripe)'
    ],
    items: [
      { match: 'Vercel NEXT_PUBLIC_URL' },
      { match: 'Launch günü smoke testi', after: ['Vercel NEXT_PUBLIC_URL'] }
    ]
  },
  {
    title: 'Bilinçli ertelenenler ve karar bekleyenler',
    category: 'Fikir',
    priority: 'niedrig',
    notes: 'Kapatılmadı, bilinçli beklemede: ya bir plan yükseltmesine, ya bir müşteri talebine, ya da verilmemiş bir karara bağlı. Buradan bir madde yukarı çıkmadan üzerinde çalışılmaz.',
    items: [
      { match: 'Ergotherapie Blankoverordnung' },
      { match: 'Column-level encryption' },
      { match: 'Supabase PITR' },
      { match: 'Multi-currency desteği' },
      { match: 'ISO 27001 hazırlığı' },
      { match: 'GKV-Datenaustausch otomatik izleme' }
    ]
  }
];
