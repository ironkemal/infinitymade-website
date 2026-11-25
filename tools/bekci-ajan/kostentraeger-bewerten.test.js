// tools/bekci-ajan/kostentraeger-bewerten.test.js
// Ne: kostentraeger-bewerten.mjs için kapsamlı birim testleri (≥ 14 test).
// Niye: SPEC.md §3.0e ve gkv-302 kararı (25.11.2026) uyarınca 11 anomali eşiğinin sınır altı/üstü,
// delta kontrolleri, sessiz/auto/vaka akışları, iz kararlılığı ve CLI davranışlarını doğrulamak.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { bewerte, sha256 } from './kostentraeger-bewerten.mjs';

function ornekTemizOzet() {
  return {
    degisiklik: true,
    stichtag: '2026-10-01',
    dosya: 'api-backend/db/migrations/0133_seed_kostentraeger_20261001.sql',
    dosyaIcerik: '-- seed dummy content',
    aktiv: ['AO05Q426_KE0.txt', 'BK05Q426_KE0.txt'],
    tablolar: {
      kostentraeger: { satir: 1000, acik: 950, yeni: 2, kapanan: 1, degisen: 10, degisenGercek: 2 },
      kostentraeger_annahmestellen: { satir: 5000, acik: 4800, yeni: 10, kapanan: 20, degisen: 50, degisenGercek: 10 },
      kostentraeger_anschriften: { satir: 3000, acik: 2900, yeni: 5, kapanan: 10, degisen: 30, degisenGercek: 5 },
    },
    yeniIk: ['100000001', '100000002'],
    kapananIk: ['100000003'],
    reopens: 5,
    ungueltigeAnschriften: { onceki: 0, simdi: 0 },
    dosyaSayilari: {
      AO: { onceki: 500, simdi: 500 },
      BK: { onceki: 300, simdi: 300 },
    },
    kontroller: {
      vorher: {
        acikSatirlar: { vkg: 4800, ans: 2900 },
        gecersizAbrechnenderKt: [],
        zincirDongu: [],
        cozulemeyenKt: [{ ik: '999999999', name: 'Eski Çözülemeyen' }],
        vkgVe09Sayisi: [{ ik: '100000001', acik_vkg_sayisi: 5, acik_09_sayisi: 1 }],
        vkg03Partnerler: [{ kostentraeger_ik: '100000001', partner_ikler: '661430035' }],
        istAbrechnenderKt: [{ ik: '100000001', ist_abrechnender_kt: true }],
        tum03Partnerler: ['661430035', '661430046'],
      },
      nachher: {
        acikSatirlar: { vkg: 4800, ans: 2900 },
        gecersizAbrechnenderKt: [],
        zincirDongu: [],
        cozulemeyenKt: [{ ik: '999999999', name: 'Eski Çözülemeyen' }],
        vkgVe09Sayisi: [{ ik: '100000001', acik_vkg_sayisi: 5, acik_09_sayisi: 1 }],
        vkg03Partnerler: [{ kostentraeger_ik: '100000001', partner_ikler: '661430035' }],
        istAbrechnenderKt: [{ ik: '100000001', ist_abrechnender_kt: true }],
        tum03Partnerler: ['661430035', '661430046'],
      },
    },
  };
}

// 1. Sessiz durum
test('1. sessiz: degisiklik false ve hata yoksa sessiz karar üretir', () => {
  const ozet = { degisiklik: false, stichtag: '2026-10-01' };
  const r = bewerte({ ozet });
  assert.equal(r.karar, 'sessiz');
  assert.deepEqual(r.gruende, []);
  assert.equal(r.vaka, null);
  assert.deepEqual(r.rapor, []);
});

// 2. Bozuk özet
test('2. bozuk özet: istisna fırlatmaz, vaka (özet okunamadı) üretir', () => {
  for (const bozuk of [null, undefined, 'metin', 123, []]) {
    const r = bewerte({ ozet: bozuk });
    assert.equal(r.karar, 'vaka');
    assert.ok(r.gruende.includes('özet okunamadı'));
    assert.ok(r.vaka.satirlar[0].includes('Özet verisi geçersiz'));
  }
});

// 3. Eşik 1: VKG kapanan > %3
test('3. Eşik 1 — VKG kapanan anahtar: %3 sınır altı (auto) vs %3 sınır üstü (vaka)', () => {
  // Sınır altı / eşit: 3000 açık, 90 kapanan (%3.0) -> auto
  const ozetAlt = ornekTemizOzet();
  ozetAlt.kontroller.nachher.acikSatirlar.vkg = 3000;
  ozetAlt.tablolar.kostentraeger_annahmestellen.kapanan = 90;
  const rAlt = bewerte({ ozet: ozetAlt });
  assert.equal(rAlt.karar, 'auto');

  // Sınır üstü: 3000 açık, 91 kapanan (%3.033) -> vaka
  const ozetUst = ornekTemizOzet();
  ozetUst.kontroller.nachher.acikSatirlar.vkg = 3000;
  ozetUst.tablolar.kostentraeger_annahmestellen.kapanan = 91;
  const rUst = bewerte({ ozet: ozetUst });
  assert.equal(rUst.karar, 'vaka');
  assert.ok(rUst.gruende.includes('vkg_kapanan_esigi_asildi'));
  assert.ok(rUst.vaka.satirlar.some(s => s.includes('VKG kapanan anahtar (%3.0)')));
});

// 4. Eşik 1: ANS kapanan > %5
test('4. Eşik 1 — ANS kapanan anahtar: %5 sınır altı (auto) vs %5 sınır üstü (vaka)', () => {
  // Sınır altı / eşit: 2000 açık, 100 kapanan (%5.0) -> auto
  const ozetAlt = ornekTemizOzet();
  ozetAlt.kontroller.nachher.acikSatirlar.ans = 2000;
  ozetAlt.tablolar.kostentraeger_anschriften.kapanan = 100;
  const rAlt = bewerte({ ozet: ozetAlt });
  assert.equal(rAlt.karar, 'auto');

  // Sınır üstü: 2000 açık, 101 kapanan (%5.05) -> vaka
  const ozetUst = ornekTemizOzet();
  ozetUst.kontroller.nachher.acikSatirlar.ans = 2000;
  ozetUst.tablolar.kostentraeger_anschriften.kapanan = 101;
  const rUst = bewerte({ ozet: ozetUst });
  assert.equal(rUst.karar, 'vaka');
  assert.ok(rUst.gruende.includes('ans_kapanan_esigi_asildi'));
  assert.ok(rUst.vaka.satirlar.some(s => s.includes('ANS kapanan anahtar (%5.1)')));
});

// 5. Eşik 1: reopens > 20
test('5. Eşik 1 — reopens: 20 sınır altı (auto) vs 21 sınır üstü (vaka)', () => {
  const ozetAlt = ornekTemizOzet();
  ozetAlt.reopens = 20;
  assert.equal(bewerte({ ozet: ozetAlt }).karar, 'auto');

  const ozetUst = ornekTemizOzet();
  ozetUst.reopens = 21;
  const rUst = bewerte({ ozet: ozetUst });
  assert.equal(rUst.karar, 'vaka');
  assert.ok(rUst.gruende.includes('reopens_esigi_asildi'));
  assert.ok(rUst.vaka.satirlar.some(s => s.includes('reopens: 21') || s.includes('sayısı (21)')));
});

// 6. Eşik 1 & 10: gerçek değişen satır > %10 (herhangi bir tabloda)
test('6. Eşik 1 — gerçek değişen satır: %10 sınır altı (auto) vs %10 sınır üstü (vaka)', () => {
  // kostentraeger_annahmestellen toplam 5000, degisenGercek 500 (%10.0) -> auto
  const ozetAlt = ornekTemizOzet();
  ozetAlt.tablolar.kostentraeger_annahmestellen.satir = 5000;
  ozetAlt.tablolar.kostentraeger_annahmestellen.degisenGercek = 500;
  assert.equal(bewerte({ ozet: ozetAlt }).karar, 'auto');

  // degisenGercek 501 (%10.02) -> vaka
  const ozetUst = ornekTemizOzet();
  ozetUst.tablolar.kostentraeger_annahmestellen.satir = 5000;
  ozetUst.tablolar.kostentraeger_annahmestellen.degisenGercek = 501;
  const rUst = bewerte({ ozet: ozetUst });
  assert.equal(rUst.karar, 'vaka');
  assert.ok(rUst.gruende.includes('kostentraeger_annahmestellen_degisen_gercek_esigi_asildi'));
  assert.ok(rUst.vaka.satirlar.some(s => s.includes('kostentraeger_annahmestellen gerçek değişen satır')));
});

// 7. Eşik 10: yalnız quelle / stand / updated_at değişenler SAYILMAZ
test('7. Eşik 10 — yalnız quelle/quelle_stand/updated_at değişen satırlar degisenGercek sayılmaz', () => {
  const ozet = ornekTemizOzet();
  // degisen 1000 (>%10) ama degisenGercek 0 -> vaka açılmamalı
  ozet.tablolar.kostentraeger.satir = 1000;
  ozet.tablolar.kostentraeger.degisen = 800; // dosya adı değiştiği için yüksek
  ozet.tablolar.kostentraeger.degisenGercek = 5; // gerçek alan değişimi çok az
  const r = bewerte({ ozet });
  assert.equal(r.karar, 'auto');
});

// 8. Eşik 2: KT kapanan IK > 5
test('8. Eşik 2 — KT kapanan IK: 5 sınır altı (auto) vs 6 sınır üstü (vaka)', () => {
  const ozetAlt = ornekTemizOzet();
  ozetAlt.tablolar.kostentraeger.kapanan = 5;
  ozetAlt.kapananIk = ['1', '2', '3', '4', '5'];
  assert.equal(bewerte({ ozet: ozetAlt }).karar, 'auto');

  const ozetUst = ornekTemizOzet();
  ozetUst.tablolar.kostentraeger.kapanan = 6;
  ozetUst.kapananIk = ['1', '2', '3', '4', '5', '6'];
  const rUst = bewerte({ ozet: ozetUst });
  assert.equal(rUst.karar, 'vaka');
  assert.ok(rUst.gruende.includes('kt_kapanan_esigi_asildi'));
  assert.ok(rUst.vaka.satirlar.some(s => s.includes('kapanan IK (6)')));
});

// 9. Eşik 2: KT yeni IK > 30
test('9. Eşik 2 — KT yeni IK: 30 sınır altı (auto) vs 31 sınır üstü (vaka)', () => {
  const ozetAlt = ornekTemizOzet();
  ozetAlt.tablolar.kostentraeger.yeni = 30;
  ozetAlt.yeniIk = Array.from({ length: 30 }, (_, i) => `1000000${String(i).padStart(2, '0')}`);
  assert.equal(bewerte({ ozet: ozetAlt }).karar, 'auto');

  const ozetUst = ornekTemizOzet();
  ozetUst.tablolar.kostentraeger.yeni = 31;
  ozetUst.yeniIk = Array.from({ length: 31 }, (_, i) => `1000000${String(i).padStart(2, '0')}`);
  const rUst = bewerte({ ozet: ozetUst });
  assert.equal(rUst.karar, 'vaka');
  assert.ok(rUst.gruende.includes('kt_yeni_esigi_asildi'));
  assert.ok(rUst.vaka.satirlar.some(s => s.includes('yeni IK (31)')));
});

// 10. Eşik 3: abrechnender_kt_ik hedef ve döngü delta kontrolleri
test('10. Eşik 3 — abrechnender_kt_ik: önceden var olan durum auto, yeni ortaya çıkan vaka', () => {
  // A) Önceden var olan durum (vorher'de de var) -> vaka DEĞİL
  const ozetEski = ornekTemizOzet();
  const eskiGecersiz = { ik: '101111111', abrechnender_kt_ik: '999999999', ziel_ik: null, ziel_valid_to: null };
  const eskiDongu = { start_ik: '102222222', aktueller_ik: '102222222', pfad: ['102222222', '102222222'] };
  ozetEski.kontroller.vorher.gecersizAbrechnenderKt = [eskiGecersiz];
  ozetEski.kontroller.nachher.gecersizAbrechnenderKt = [eskiGecersiz];
  ozetEski.kontroller.vorher.zincirDongu = [eskiDongu];
  ozetEski.kontroller.nachher.zincirDongu = [eskiDongu];
  assert.equal(bewerte({ ozet: ozetEski }).karar, 'auto');

  // B) Yeni ortaya çıkan geçersiz hedef -> vaka
  const ozetYeni = ornekTemizOzet();
  ozetYeni.kontroller.vorher.gecersizAbrechnenderKt = [];
  ozetYeni.kontroller.nachher.gecersizAbrechnenderKt = [
    { ik: '103333333', abrechnender_kt_ik: '104444444', ziel_ik: '104444444', ziel_valid_to: '2026-06-30' },
  ];
  const rYeni = bewerte({ ozet: ozetYeni });
  assert.equal(rYeni.karar, 'vaka');
  assert.ok(rYeni.gruende.includes('yeni_gecersiz_abrechnender_kt'));
  assert.ok(rYeni.vaka.satirlar.some(s => s.includes('103333333 → 104444444')));

  // C) Yeni zincir döngüsü -> vaka
  const ozetDongu = ornekTemizOzet();
  ozetDongu.kontroller.vorher.zincirDongu = [];
  ozetDongu.kontroller.nachher.zincirDongu = [
    { start_ik: '105555555', aktueller_ik: '105555555', pfad: ['105555555', '106666666', '105555555'] },
  ];
  const rDongu = bewerte({ ozet: ozetDongu });
  assert.equal(rDongu.karar, 'vaka');
  assert.ok(rDongu.gruende.includes('yeni_zincir_dongusu'));
  assert.ok(rDongu.vaka.satirlar.some(s => s.includes('105555555')));
});

// 11. Eşik 4: waehleAusgaben().ohneGueltige veya hata
test('11. Eşik 4 — waehleAusgaben().ohneGueltige veya hata taşıyan özet her zaman vaka', () => {
  const ozet1 = {
    degisiklik: false,
    stichtag: '2026-10-01',
    ohneGueltige: ['EK', 'AO'],
  };
  const r1 = bewerte({ ozet: ozet1 });
  assert.equal(r1.karar, 'vaka');
  assert.ok(r1.gruende.includes('ohne_gueltige_ausgabe'));

  const ozet2 = {
    degisiklik: false,
    stichtag: '2026-10-01',
    hata: 'Keine zum 2026-10-01 gültige Ausgabe für Kassenart EK',
  };
  const r2 = bewerte({ ozet: ozet2 });
  assert.equal(r2.karar, 'vaka');
  assert.ok(r2.gruende.includes('ohne_gueltige_ausgabe'));
});

// 12. Eşik 5: Aktif ist_abrechnender_kt VKG 02/03 + 07/30 çözülemiyor (DELTA)
test('12. Eşik 5 — çözülemeyen KT: vorherde de olan (~82 KT) auto, yeni çözülemeyen vaka', () => {
  // A) Önceden de çözülemeyen IK -> auto
  const ozetEski = ornekTemizOzet();
  ozetEski.kontroller.vorher.cozulemeyenKt = ['109999999'];
  ozetEski.kontroller.nachher.cozulemeyenKt = ['109999999'];
  assert.equal(bewerte({ ozet: ozetEski }).karar, 'auto');

  // B) Yeni çözülemeyen IK -> vaka
  const ozetYeni = ornekTemizOzet();
  ozetYeni.kontroller.vorher.cozulemeyenKt = ['109999999'];
  ozetYeni.kontroller.nachher.cozulemeyenKt = [
    { ik: '109999999', name: 'Eski' },
    { ik: '101234567', name: 'Yeni Kapanan DAS' },
  ];
  const rYeni = bewerte({ ozet: ozetYeni });
  assert.equal(rYeni.karar, 'vaka');
  assert.ok(rYeni.gruende.includes('yeni_cozulemeyen_kt'));
  assert.ok(rYeni.vaka.satirlar.some(s => s.includes('101234567')));
});

// 13. Eşik 6: Açık 09 satırı kalmıyor ya da hiç açık VKG kalmıyor
test('13. Eşik 6 — açık 09 veya açık VKG kalmaması: vorherde varsa ve nachherde yoksa vaka', () => {
  // A) vorherde de yoktu (0 -> 0) -> auto
  const ozetEski = ornekTemizOzet();
  ozetEski.kontroller.vorher.vkgVe09Sayisi = [{ ik: '101', acik_vkg_sayisi: 0, acik_09_sayisi: 0 }];
  ozetEski.kontroller.nachher.vkgVe09Sayisi = [{ ik: '101', acik_vkg_sayisi: 0, acik_09_sayisi: 0 }];
  assert.equal(bewerte({ ozet: ozetEski }).karar, 'auto');

  // B) vorherde 09 vardı (1 -> 0) -> vaka
  const ozet09 = ornekTemizOzet();
  ozet09.kontroller.vorher.vkgVe09Sayisi = [{ ik: '102', acik_vkg_sayisi: 2, acik_09_sayisi: 1 }];
  ozet09.kontroller.nachher.vkgVe09Sayisi = [{ ik: '102', acik_vkg_sayisi: 2, acik_09_sayisi: 0 }];
  const r09 = bewerte({ ozet: ozet09 });
  assert.equal(r09.karar, 'vaka');
  assert.ok(r09.gruende.includes('acik_09_satiri_kalmadi'));
  assert.ok(r09.vaka.satirlar.some(s => s.includes('KT 102')));

  // C) vorherde VKG vardı (3 -> 0) -> vaka
  const ozetVkg = ornekTemizOzet();
  ozetVkg.kontroller.vorher.vkgVe09Sayisi = [{ ik: '103', acik_vkg_sayisi: 3, acik_09_sayisi: 1 }];
  ozetVkg.kontroller.nachher.vkgVe09Sayisi = [{ ik: '103', acik_vkg_sayisi: 0, acik_09_sayisi: 0 }];
  const rVkg = bewerte({ ozet: ozetVkg });
  assert.equal(rVkg.karar, 'vaka');
  assert.ok(rVkg.gruende.includes('hic_acik_vkg_kalmadi'));
});

// 14. Eşik 7: VKG 03 partner kümesi değişiyor + hiç 03 hedefi olmamış partner tespiti
test('14. Eşik 7 — VKG 03 partner kümesi değişimi ve yeni bilinmeyen partner uyarısı', () => {
  const ozet = ornekTemizOzet();
  ozet.kontroller.vorher.vkg03Partnerler = [
    { kostentraeger_ik: '101', partner_ikler: '661430035' },
  ];
  ozet.kontroller.nachher.vkg03Partnerler = [
    { kostentraeger_ik: '101', partner_ikler: '661430035,999999999' },
  ];
  // 999999999 daha önce hiçbir 03'te yoktu
  ozet.kontroller.vorher.tum03Partnerler = ['661430035', '661430046'];

  const r = bewerte({ ozet });
  assert.equal(r.karar, 'vaka');
  assert.ok(r.gruende.includes('vkg_03_partner_degisti'));
  assert.ok(r.vaka.satirlar.some(s => s.includes('daha önce hiç 03 hedefi olmadı')));
  assert.ok(r.vaka.satirlar.some(s => s.includes('999999999')));
});

// 15. Eşik 8: ist_abrechnender_kt tersine dönüyor
test('15. Eşik 8 — ist_abrechnender_kt tersine döndüğünde vaka açılır', () => {
  const ozet = ornekTemizOzet();
  ozet.kontroller.vorher.istAbrechnenderKt = [
    { ik: '101', ist_abrechnender_kt: true },
    { ik: '102', ist_abrechnender_kt: false },
  ];
  ozet.kontroller.nachher.istAbrechnenderKt = [
    { ik: '101', ist_abrechnender_kt: false }, // tersine döndü
    { ik: '102', ist_abrechnender_kt: false }, // değişmedi
  ];

  const r = bewerte({ ozet });
  assert.equal(r.karar, 'vaka');
  assert.ok(r.gruende.includes('ist_abrechnender_kt_tersine_dondu'));
  assert.ok(r.vaka.satirlar.some(s => s.includes('101 ist_abrechnender_kt tersine döndü: true → false')));
});

// 16. Eşik 9: ungueltigeAnschriften artışı
test('16. Eşik 9 — ungueltigeAnschriften sayısı arttığında vaka açılır', () => {
  // A) Aynı kalıyor (0 -> 0) -> auto
  const ozetAyni = ornekTemizOzet();
  ozetAyni.ungueltigeAnschriften = { onceki: 2, simdi: 2 };
  assert.equal(bewerte({ ozet: ozetAyni }).karar, 'auto');

  // B) Artıyor (0 -> 1) -> vaka
  const ozetArtan = ornekTemizOzet();
  ozetArtan.ungueltigeAnschriften = { onceki: 0, simdi: 1 };
  const rArtan = bewerte({ ozet: ozetArtan });
  assert.equal(rArtan.karar, 'vaka');
  assert.ok(rArtan.gruende.includes('ungueltige_anschriften_artti'));
  assert.ok(rArtan.vaka.satirlar.some(s => s.includes('ungueltigeAnschriften') && s.includes('0 → 1')));
});

// 17. Eşik 11: Kassenart kayıt sayısı > %5 düşüşü
test('17. Eşik 11 — Kassenart kayıt sayısı %5 sınır altı (auto) vs %5.1 sınır üstü (vaka)', () => {
  // A) %5.0 düşüş (100 -> 95) -> auto
  const ozetAlt = ornekTemizOzet();
  ozetAlt.dosyaSayilari = {
    AO: { onceki: 100, simdi: 95 },
  };
  assert.equal(bewerte({ ozet: ozetAlt }).karar, 'auto');

  // B) %6.0 düşüş (100 -> 94) -> vaka
  const ozetUst = ornekTemizOzet();
  ozetUst.dosyaSayilari = {
    AO: { onceki: 100, simdi: 94 },
  };
  const rUst = bewerte({ ozet: ozetUst });
  assert.equal(rUst.karar, 'vaka');
  assert.ok(rUst.gruende.includes('kassenart_ao_kayit_sayisi_dustu'));
  assert.ok(rUst.vaka.satirlar.some(s => s.includes('Kassenart AO') && s.includes('%6.0')));
});

// 18. Auto rapor biçimi
test('18. Auto rapor biçimi — tablo istatistikleri ve dosya listesi', () => {
  const ozet = ornekTemizOzet();
  const r = bewerte({ ozet });
  assert.equal(r.karar, 'auto');
  assert.ok(Array.isArray(r.rapor));
  assert.ok(r.rapor[0].startsWith('✓ Kostenträger: kostentraeger +2 / −1 / ~10'));
  assert.ok(r.rapor[1].startsWith('✓ Kostenträger: kostentraeger_annahmestellen +10 / −20 / ~50'));
  assert.ok(r.rapor[2].startsWith('✓ Kostenträger: kostentraeger_anschriften +5 / −10 / ~30'));
  assert.ok(r.rapor[3].includes('AO05Q426_KE0.txt'));
  assert.ok(r.rapor[4].includes('0133_seed_kostentraeger_20261001.sql'));
});

// 19. İz kararlılığı (ek.iz)
test('19. İz kararlılığı — aynı dosya/özet her zaman aynı 16 haneli hash üretir', () => {
  const ozet1 = ornekTemizOzet();
  ozet1.reopens = 50; // vaka açtıralım
  ozet1.dosyaSha256 = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  const r1 = bewerte({ ozet: ozet1 });
  const r2 = bewerte({ ozet: { ...ozet1 } });

  assert.equal(r1.vaka.ek.iz.length, 16);
  assert.equal(r1.vaka.ek.iz, r2.vaka.ek.iz);
  assert.equal(r1.vaka.ek.uygulanabilir, true);
});

// 20. Satır sayısı sınırı (≤ 15)
test('20. Satır sayısı sınırı — çok sayıda anomali olduğunda satırlar en fazla 15 satırdır', () => {
  const ozet = ornekTemizOzet();
  // 25 adet yeni geçersiz KT üret
  ozet.kontroller.nachher.gecersizAbrechnenderKt = Array.from({ length: 25 }, (_, i) => ({
    ik: `1000000${String(i).padStart(2, '0')}`,
    abrechnender_kt_ik: '999999999',
    ziel_ik: null,
    ziel_valid_to: null,
  }));

  const r = bewerte({ ozet });
  assert.equal(r.karar, 'vaka');
  assert.equal(r.vaka.satirlar.length, 15);
});

// 21. CLI testi (--ozet=FILE --out=FILE)
test('21. CLI — --ozet ve --out argümanları ile düzgün çalışır ve stdout karar basar', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kt-bewerten-'));
  const ozetDosya = join(tmp, 'ozet.json');
  const outDosya = join(tmp, 'karar.json');
  const scriptPath = join(process.cwd(), 'tools', 'bekci-ajan', 'kostentraeger-bewerten.mjs');

  try {
    const temizOzet = ornekTemizOzet();
    writeFileSync(ozetDosya, JSON.stringify(temizOzet), 'utf8');

    const out = execFileSync(
      process.execPath,
      [scriptPath, `--ozet=${ozetDosya}`, `--out=${outDosya}`],
      { encoding: 'utf8' }
    );

    assert.ok(out.includes('karar: auto'));
    const cikti = JSON.parse(readFileSync(outDosya, 'utf8'));
    assert.equal(cikti.karar, 'auto');
    assert.ok(cikti.rapor.length > 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
