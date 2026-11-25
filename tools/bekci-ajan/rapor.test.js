// tools/bekci-ajan/rapor.test.js
// Ne: rapor.mjs birim testleri (olayEkle, takipEkle, takipKapat, takipYukle, haftalikRapor, ikinciHataMi, eskiOlaylariBuda).
// Niye: Kemal'in 25.11.2026 talimatı uyarınca haftalık bekçi raporlama, takip listesi ve hata takip
// kurallarının doğrulanması.

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import {
  olayEkle,
  olaylariYukle,
  takipEkle,
  takipYukle,
  takipKapat,
  haftalikRapor,
  ikinciHataMi,
  eskiOlaylariBuda,
} from './rapor.mjs';

test('1. olayEkle: geçerli türlerle olaylar.jsonl dosyasına yazar ve kontrol karakterlerini temizler', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rapor-test-'));
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const kirliOzet = 'Podologie fiyatı güncellendi\u0000\u0007\n\tçok iyi';
    const olay1 = await olayEkle(tmpDir, {
      bekci: 'preise',
      tur: 'auto',
      ozet: kirliOzet,
      simdi,
    });

    assert.equal(olay1.bekci, 'preise');
    assert.equal(olay1.tur, 'auto');
    assert.equal(olay1.ozet, 'Podologie fiyatı güncellendi çok iyi');

    const olay2 = await olayEkle(tmpDir, {
      bekci: 'preise',
      tur: 'uygulandi',
      ozet: 'Senin onayınla uyguladım: 78010 artışı',
      simdi,
    });

    const yuklenen = await olaylariYukle(tmpDir);
    assert.equal(yuklenen.length, 2);
    assert.equal(yuklenen[0].tur, 'auto');
    assert.equal(yuklenen[1].tur, 'uygulandi');

    // Geçersiz tür reddedilir
    await assert.rejects(
      async () => olayEkle(tmpDir, { bekci: 'preise', tur: 'gecersiz_tur', ozet: 'test' }),
      /gecersiz_olay_turu/
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('2. haftalikRapor: boş hafta ve 0 açık vaka biçimi', () => {
  const simdi = new Date('2026-11-25T12:00:00Z');
  const rapor = haftalikRapor({ olaylar: [], acikVakalar: [], takipler: [], simdi });

  assert.ok(rapor.includes('📋 Haftalık bekçi raporu (18.11 – 25.11)'));
  assert.ok(rapor.includes('Bu hafta kendim uyguladıklarım (0):'));
  assert.ok(rapor.includes('Bu hafta resmî kaynaklarda bizi ilgilendiren bir değişiklik olmadı.'));
  assert.ok(rapor.includes('Senin kararını bekleyenler: Senden beklediğim bir karar yok ✅'));
  assert.ok(!rapor.includes('Takip listesi'));
  assert.ok(!rapor.includes('Sorun:'));
});

test('3. haftalikRapor: dolu hafta, açık vaka ve hata satırı', () => {
  const simdi = new Date('2026-11-25T12:00:00Z');
  const olaylar = [
    {
      bekci: 'preise',
      tur: 'auto',
      ozet: '78010 Podologie fiyatı güncellendi (1 değişiklik)',
      zaman: '2026-11-24T10:00:00Z',
    },
    {
      bekci: 'quellen',
      tur: 'uygulandi',
      ozet: 'Senin onayınla uyguladım: GKV Anlage 2',
      zaman: '2026-11-23T10:00:00Z',
    },
    {
      bekci: 'preise',
      tur: 'hata',
      ozet: 'XML indirme zaman aşımı',
      zaman: '2026-11-25T08:00:00Z',
    },
  ];

  const acikVakalar = [
    { id: '20261124-preise-1', durum: 'acik' },
    { id: '20261125-quellen-1', durum: 'acik' },
  ];

  const rapor = haftalikRapor({ olaylar, acikVakalar, simdi });

  assert.ok(rapor.includes('Bu hafta kendim uyguladıklarım (2):'));
  assert.ok(rapor.includes('• 78010 Podologie fiyatı güncellendi (1 değişiklik)'));
  assert.ok(rapor.includes('• Senin onayınla uyguladım: GKV Anlage 2'));
  assert.ok(rapor.includes('Senin kararını bekleyenler: 2 → /vakalar'));
  assert.ok(rapor.includes('Sorun: XML indirme zaman aşımı'));
  assert.ok(
    rapor.includes('Senin yapacağın bir şey yok — Claude\'a "bekçi hatalarına bak" demen yeterli.')
  );
});

test('4. haftalikRapor: 10+ olay kesmesi ("… ve N tane daha")', () => {
  const simdi = new Date('2026-11-25T12:00:00Z');
  const olaylar = [];
  for (let i = 1; i <= 14; i++) {
    olaylar.push({
      bekci: 'preise',
      tur: 'auto',
      ozet: `Değişiklik ${i}`,
      zaman: '2026-11-24T10:00:00Z',
    });
  }

  const rapor = haftalikRapor({ olaylar, acikVakalar: 0, simdi });
  assert.ok(rapor.includes('Bu hafta kendim uyguladıklarım (14):'));
  assert.ok(rapor.includes('• Değişiklik 10'));
  assert.ok(!rapor.includes('• Değişiklik 11'));
  assert.ok(rapor.includes('… ve 4 tane daha'));
});

test('5. ikinciHataMi: aynı bekçinin son iki olayı ikisi de hata ise true döner', () => {
  // 1. Henüz 1 hata var
  const olaylar1 = [
    { bekci: 'preise', tur: 'auto' },
    { bekci: 'preise', tur: 'hata' },
  ];
  assert.equal(ikinciHataMi(olaylar1, 'preise'), false);

  // 2. Üst üste 2 hata var -> true
  const olaylar2 = [
    { bekci: 'preise', tur: 'auto' },
    { bekci: 'preise', tur: 'hata' },
    { bekci: 'preise', tur: 'hata' },
  ];
  assert.equal(ikinciHataMi(olaylar2, 'preise'), true);

  // 3. Araya auto girmiş -> false
  const olaylar3 = [
    { bekci: 'preise', tur: 'hata' },
    { bekci: 'preise', tur: 'auto' },
    { bekci: 'preise', tur: 'hata' },
  ];
  assert.equal(ikinciHataMi(olaylar3, 'preise'), false);

  // 4. Farklı bekçi hatası etkilemez
  const olaylar4 = [
    { bekci: 'preise', tur: 'hata' },
    { bekci: 'quellen', tur: 'hata' },
    { bekci: 'preise', tur: 'hata' },
  ];
  assert.equal(ikinciHataMi(olaylar4, 'preise'), true);
  assert.equal(ikinciHataMi(olaylar4, 'quellen'), false);
});

test('6. eskiOlaylariBuda: 60 günden eski olayları siler', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'buda-test-'));
  try {
    const simdi = new Date('2026-11-25T12:00:00Z');
    const gun10Once = new Date('2026-11-15T12:00:00Z');
    const gun70Once = new Date('2026-09-15T12:00:00Z');

    await olayEkle(tmpDir, { bekci: 'preise', tur: 'auto', ozet: 'Eski olay', simdi: gun70Once });
    await olayEkle(tmpDir, { bekci: 'preise', tur: 'auto', ozet: 'Yeni olay', simdi: gun10Once });

    const yuklenenOnce = await olaylariYukle(tmpDir);
    assert.equal(yuklenenOnce.length, 2);

    const kalanSayisi = await eskiOlaylariBuda(tmpDir, simdi);
    assert.equal(kalanSayisi, 1);

    const yuklenenSonra = await olaylariYukle(tmpDir);
    assert.equal(yuklenenSonra.length, 1);
    assert.equal(yuklenenSonra[0].ozet, 'Yeni olay');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('7. takipEkle: aynı quelleId + is tekrarlanmaz', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'takip-test-'));
  try {
    const t1 = await takipEkle(tmpDir, {
      quelleId: 'podo-125',
      is: 'Podoloji fiyat listesi kontrol edilecek',
      son_tarih: '2026-12-15',
    });

    assert.equal(t1.quelleId, 'podo-125');
    assert.equal(t1.is, 'Podoloji fiyat listesi kontrol edilecek');
    assert.equal(t1.durum, 'acik');

    // Aynı quelleId + is tekrar eklenmeye çalışıldığında yeni kayıt eklenmez
    const t2 = await takipEkle(tmpDir, {
      quelleId: 'podo-125',
      is: 'Podoloji fiyat listesi kontrol edilecek',
      son_tarih: '2026-12-20',
    });

    const yuklenen = await takipYukle(tmpDir);
    assert.equal(yuklenen.length, 1);
    assert.equal(t2.son_tarih, '2026-12-15'); // İlk kayıt korunur
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('8. takipKapat: eşleşen açık takip maddesini kapatır', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'takip-kapat-test-'));
  try {
    await takipEkle(tmpDir, {
      quelleId: 'tp5-anlagen',
      is: 'Yeni EDIFACT şeması kontrol edilecek',
      son_tarih: '2027-01-01',
    });

    const kapatilan = await takipKapat(tmpDir, {
      quelleId: 'tp5-anlagen',
      is: 'Yeni EDIFACT şeması kontrol edilecek',
    });
    assert.equal(kapatilan, 1);

    const yuklenen = await takipYukle(tmpDir);
    assert.equal(yuklenen.length, 1);
    assert.equal(yuklenen[0].durum, 'kapandi');
    assert.ok(yuklenen[0].kapanis);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('9. haftalikRapor: takip listesi, tarihi yaklaşan önce ve 30 günden yakına ⏰', () => {
  const simdi = new Date('2026-11-25T12:00:00Z');
  const takipler = [
    {
      quelleId: 'podo-125',
      is: 'Uzak vadeli kontrol',
      son_tarih: '2027-04-01', // > 30 gün -> ⏰ yok
      durum: 'acik',
    },
    {
      quelleId: 'tp5-anlagen',
      is: 'Acil EDIFACT kontrolü',
      son_tarih: '2026-11-28', // 3 gün var (<= 30 gün) -> ⏰
      durum: 'acik',
    },
    {
      quelleId: 'hpnr',
      is: 'Tarihsiz genel takip',
      son_tarih: null, // Tarih yok -> en sona
      durum: 'acik',
    },
    {
      quelleId: 'kvnr',
      is: 'Kapanmış madde',
      son_tarih: '2026-11-26',
      durum: 'kapandi', // Kapanmış -> listelenmez
    },
  ];

  const rapor = haftalikRapor({
    olaylar: [],
    acikVakalar: 0,
    takipler,
    simdi,
  });

  assert.ok(rapor.includes('Takip listesi (tarihi yaklaşan önce):'));

  const satirlar = rapor.split('\n');
  const takipSatirlari = satirlar.filter(s => s.startsWith('• '));

  assert.equal(takipSatirlari.length, 3);
  assert.equal(takipSatirlari[0], '• ⏰ 28.11.2026 — Acil EDIFACT kontrolü');
  assert.equal(takipSatirlari[1], '• 01.04.2027 — Uzak vadeli kontrol');
  assert.equal(takipSatirlari[2], '• tarih yok — Tarihsiz genel takip');
});

test('10. olayEkle tur listesine takip eklenmez (ayrı defter)', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'olay-takip-test-'));
  try {
    await assert.rejects(
      async () => olayEkle(tmpDir, { bekci: 'quellen', tur: 'takip', ozet: 'Takip konusu' }),
      /gecersiz_olay_turu/
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
