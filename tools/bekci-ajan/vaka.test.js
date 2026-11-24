// tools/bekci-ajan/vaka.test.js
// Ne: vaka.mjs birim testleri (en az 8 anlamlı test).
// Niye: SPEC.md §2.2 ve §3.0 gereksinimlerini (id üretimi, Europe/Berlin sınırı,
// tüm durum geçişleri, sha güvenliği, hatırlatma ve dosya yönetimi) doğrulamak.

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import {
  ID_RE,
  DURUMLAR,
  VakaHatasi,
  yeniVaka,
  gecis,
  mesaj,
  hatirlatmaGerekli,
  eskidi,
  kaydet,
  yukle,
  listele,
} from './vaka.mjs';

test('1. id üretimi ve n sayacı', () => {
  const simdi = new Date('2026-11-24T12:00:00Z');
  const v1 = yeniVaka({
    bekci: 'fiyat',
    baslik: 'İlk vaka',
    simdi,
    mevcutIdler: [],
  });
  assert.equal(v1.id, '20261124-fiyat-1');

  const v2 = yeniVaka({
    bekci: 'fiyat',
    baslik: 'İkinci vaka',
    simdi,
    mevcutIdler: ['20261124-fiyat-1', '20261124-fiyat-4', '20261124-diger-9'],
  });
  assert.equal(v2.id, '20261124-fiyat-5');
  assert.ok(ID_RE.test(v2.id));
});

test('2. Berlin gece yarısı sınırı (2026-11-24T23:30:00Z -> 20261125)', () => {
  // UTC 23:30, Berlin saatinde (CET/UTC+1) ertesi gün 00:30'dur.
  const simdi = new Date('2026-11-24T23:30:00Z');
  const v = yeniVaka({
    bekci: 'preise',
    baslik: 'Gece vaka',
    simdi,
  });
  assert.equal(v.id, '20261125-preise-1');
});

test('3. tüm durum geçişleri ve kuralları', () => {
  const simdi = new Date('2026-11-24T10:00:00Z');
  const sha = 'a'.repeat(64);
  const v = yeniVaka({
    bekci: 'fiyat',
    baslik: 'Fiyat testi',
    yamaSha256: sha,
    simdi,
  });

  // acik -> uygula -> uygulaniyor
  const vUygulaniyor = gecis(v, 'uygula', { simdi, yamaSha256: sha });
  assert.equal(vUygulaniyor.durum, 'uygulaniyor');

  // uygulaniyor -> tamam -> uygulandi
  const vUygulandi = gecis(vUygulaniyor, 'tamam', { simdi });
  assert.equal(vUygulandi.durum, 'uygulandi');

  // uygulaniyor -> hata -> acik
  const vHata = gecis(vUygulaniyor, 'hata', { simdi });
  assert.equal(vHata.durum, 'acik');

  // acik -> birak -> birakildi
  const vBirakildi = gecis(v, 'birak', { simdi });
  assert.equal(vBirakildi.durum, 'birakildi');

  // acik -> acikla -> acik
  const vAcikla = gecis(v, 'acikla', { simdi });
  assert.equal(vAcikla.durum, 'acik');
  assert.equal(vAcikla.gecmis.at(-1)?.eylem, 'acikla');

  // acik -> hatirlat -> acik, hatirlatma+1, sonHatirlatma güncellenir
  const vHatirlat = gecis(v, 'hatirlat', { simdi });
  assert.equal(vHatirlat.durum, 'acik');
  assert.equal(vHatirlat.hatirlatma, 1);
  assert.equal(vHatirlat.sonHatirlatma, simdi.toISOString());
});

test('4. sha uyuşmazlığı hatası', () => {
  const sha1 = 'a'.repeat(64);
  const sha2 = 'b'.repeat(64);
  const v = yeniVaka({
    bekci: 'fiyat',
    baslik: 'Sha testi',
    yamaSha256: sha1,
  });

  assert.throws(
    () => gecis(v, 'uygula', { yamaSha256: sha2 }),
    err => err instanceof VakaHatasi && err.message === 'sha'
  );
  assert.throws(
    () => gecis(v, 'uygula', { yamaSha256: null }),
    err => err instanceof VakaHatasi && err.message === 'sha'
  );
});

test('5. kapalı vaka her eylemde VakaHatasi(kapali) fırlatır', () => {
  const v = yeniVaka({ bekci: 'fiyat', baslik: 'Kapalı testi' });
  const kapali1 = gecis(v, 'birak');
  assert.throws(
    () => gecis(kapali1, 'uygula'),
    err => err instanceof VakaHatasi && err.message === 'kapali'
  );

  const v2 = yeniVaka({ bekci: 'fiyat', baslik: 'Uygulandı testi' });
  const uygulaniyor = gecis(v2, 'uygula');
  const kapali2 = gecis(uygulaniyor, 'tamam');
  assert.throws(
    () => gecis(kapali2, 'birak'),
    err => err instanceof VakaHatasi && err.message === 'kapali'
  );
});

test('6. girdi nesnesi değişmiyor (immutability)', () => {
  const v = yeniVaka({ bekci: 'fiyat', baslik: 'Değişmezlik testi' });
  const orjinalGecmisSayisi = v.gecmis.length;
  const sonraki = gecis(v, 'birak');

  assert.equal(v.durum, 'acik');
  assert.equal(v.gecmis.length, orjinalGecmisSayisi);
  assert.equal(sonraki.durum, 'birakildi');
  assert.equal(sonraki.gecmis.length, orjinalGecmisSayisi + 1);
});

test('7. mesaj içeriği, düğmeler ve callback_data <= 64 bayt', () => {
  // En uzun bekci adı: 25 karakter
  const uzunBekci = 'a'.repeat(25);
  const v = yeniVaka({
    bekci: uzunBekci,
    baslik: 'Mesaj biçimi testi',
    satirlar: ['Satır 1', 'Satır 2'],
    dosyalar: ['dosya1.js', 'dosya2.js'],
    yamaSha256: 'f'.repeat(64),
    oneri: 'Yeni fiyatları uygulayalım.',
    mevcutIdler: [`20261124-${uzunBekci}-998`], // n = 999
  });

  const { text, knoepfe } = mesaj(v);
  assert.ok(text.includes(`⚠️ ${uzunBekci} · Mesaj biçimi testi`));
  assert.ok(text.includes('Satır 1'));
  assert.ok(text.includes('Dosya: dosya1.js, dosya2.js'));
  assert.ok(text.includes(`Yama: ${'f'.repeat(12)}`));
  assert.ok(text.includes('Ajan önerisi (YZ — rakamlar yukarıdaki satırlardan):'));
  assert.ok(text.includes('Yeni fiyatları uygulayalım.'));
  assert.ok(text.includes(`#${v.id}`));

  assert.ok(Array.isArray(knoepfe));
  for (const satir of knoepfe) {
    for (const k of satir) {
      const baytUzunlugu = Buffer.byteLength(k.befehl, 'utf-8');
      assert.ok(
        baytUzunlugu <= 64,
        `callback_data 64 baytı aştı: ${k.befehl} (${baytUzunlugu} bayt)`
      );
    }
  }

  // Kapalı vakada düğme olmamalı
  const kapali = gecis(v, 'birak');
  const kapaliMesaj = mesaj(kapali);
  assert.equal(kapaliMesaj.knoepfe, undefined);
});

test('8. hatırlatmaGerekli mantığı', () => {
  const dOlusturma = new Date('2026-11-20T10:00:00Z');
  const v = yeniVaka({
    bekci: 'fiyat',
    baslik: 'Hatırlatma testi',
    simdi: dOlusturma,
  });

  // Aynı gün: henüz hatırlatma gerekmez
  assert.equal(hatirlatmaGerekli(v, dOlusturma), false);

  // 1 gün sonra, henüz hatırlatma yapılmamış: gerekir
  const ertesiGun = new Date('2026-11-21T09:00:00Z');
  assert.equal(hatirlatmaGerekli(v, ertesiGun), true);

  // Hatırlatma yapıldıktan sonra aynı gün tekrar gerekmez
  const hatirlatildi = gecis(v, 'hatirlat', { simdi: ertesiGun });
  assert.equal(hatirlatmaGerekli(hatirlatildi, ertesiGun), false);

  // Ertesi gün tekrar gerekir
  const ikiGunSonra = new Date('2026-11-22T09:00:00Z');
  assert.equal(hatirlatmaGerekli(hatirlatildi, ikiGunSonra), true);

  // Kapalı vakada gerekmez
  const kapali = gecis(v, 'birak');
  assert.equal(hatirlatmaGerekli(kapali, ikiGunSonra), false);
});

test('9. eskidi mantığı (>= 14 gün)', () => {
  const dOlusturma = new Date('2026-11-01T10:00:00Z');
  const v = yeniVaka({
    bekci: 'fiyat',
    baslik: 'Eskime testi',
    simdi: dOlusturma,
  });

  // 13 gün sonra: eskimedi
  const gun13 = new Date('2026-11-14T10:00:00Z');
  assert.equal(eskidi(v, gun13), false);

  // 14 gün sonra: eskidi
  const gun14 = new Date('2026-11-15T10:00:00Z');
  assert.equal(eskidi(v, gun14), true);

  // Kapalı vaka eskidi dönmez
  const kapali = gecis(v, 'birak');
  assert.equal(eskidi(kapali, gun14), false);
});

test('10. kaydet, yukle ve listele (geçici dizin)', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'vaka-test-'));
  try {
    const v1 = yeniVaka({
      bekci: 'fiyat',
      baslik: 'Vaka 1',
      simdi: new Date('2026-11-24T08:00:00Z'),
    });
    const v2 = yeniVaka({
      bekci: 'fiyat',
      baslik: 'Vaka 2',
      simdi: new Date('2026-11-24T09:00:00Z'),
      mevcutIdler: [v1.id],
    });

    await kaydet(tmpDir, v1);
    await kaydet(tmpDir, v2);

    const yuklenen1 = await yukle(tmpDir, v1.id);
    assert.equal(yuklenen1.id, v1.id);
    assert.equal(yuklenen1.baslik, 'Vaka 1');

    const liste = await listele(tmpDir);
    assert.equal(liste.length, 2);
    assert.equal(liste[0].id, v1.id);
    assert.equal(liste[1].id, v2.id);

    // Olmayan dizin boş dizi döner
    const bosListe = await listele(path.join(tmpDir, 'olmayan-alt-dizin'));
    assert.deepEqual(bosListe, []);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('11. path traversal ve geçersiz id reddi', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'vaka-traversal-'));
  try {
    assert.throws(
      () => yeniVaka({ bekci: 'Gecersiz_Buyuk_Harf', baslik: 'test' }),
      err => err instanceof VakaHatasi && err.message === 'gecersiz_bekci'
    );

    await assert.rejects(
      async () => yukle(tmpDir, '../etc/passwd'),
      err => err instanceof VakaHatasi && err.message === 'gecersiz_id'
    );

    await assert.rejects(
      async () => kaydet(tmpDir, { id: '../../saldiri' }),
      err => err instanceof VakaHatasi && err.message === 'gecersiz_id'
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('12. vaka.mjs ek: boyut sınırı + kopya + mesajda görünmüyor', () => {
  const simdi = new Date('2026-11-24T12:00:00Z');

  // null veya undefined durumunda ek null olur
  const vNull = yeniVaka({ bekci: 'preise', baslik: 'Null ek', simdi });
  assert.equal(vNull.ek, null);

  const vNullAçık = yeniVaka({ bekci: 'preise', baslik: 'Açık null ek', ek: null, simdi });
  assert.equal(vNullAçık.ek, null);

  // Geçersiz ek tipleri VakaHatasi fırlatır
  assert.throws(
    () => yeniVaka({ bekci: 'preise', baslik: 'Dizi ek', ek: ['gecersiz'], simdi }),
    err => err instanceof VakaHatasi && err.message === 'gecersiz_ek'
  );
  assert.throws(
    () => yeniVaka({ bekci: 'preise', baslik: 'String ek', ek: 'metin', simdi }),
    err => err instanceof VakaHatasi && err.message === 'gecersiz_ek'
  );
  assert.throws(
    () => yeniVaka({ bekci: 'preise', baslik: 'Sayı ek', ek: 12345, simdi }),
    err => err instanceof VakaHatasi && err.message === 'gecersiz_ek'
  );

  // 2000 karakter sınırı aşımı VakaHatasi fırlatır
  const buyukEk = { veri: 'x'.repeat(2001) };
  assert.throws(
    () => yeniVaka({ bekci: 'preise', baslik: 'Büyük ek', ek: buyukEk, simdi }),
    err => err instanceof VakaHatasi && err.message === 'ek_boyut_siniri'
  );

  // Geçerli ek derin kopyalanır (orijinal nesne mutasyonu vakayı etkilemez)
  const orjinalEk = { stand: '2026-11-24', erlaubeSprung: ['78010'], artlar: ['sprung'] };
  const v = yeniVaka({ bekci: 'preise', baslik: 'Geçerli ek', ek: orjinalEk, simdi });
  assert.deepEqual(v.ek, orjinalEk);

  orjinalEk.erlaubeSprung.push('78020');
  assert.deepEqual(v.ek.erlaubeSprung, ['78010'], 'orijinal nesne değişince vaka.ek değişmemeli (derin kopya)');

  // gecis durumunda ek korunur
  const vGecis = gecis(v, 'birak', { simdi });
  assert.deepEqual(vGecis.ek, { stand: '2026-11-24', erlaubeSprung: ['78010'], artlar: ['sprung'] });

  // mesajda ek görünmez
  const msg = mesaj(v);
  assert.ok(!msg.text.includes('78010'));
  assert.ok(!msg.text.includes('2026-11-24'));
  assert.ok(!msg.text.includes('erlaubeSprung'));
});

test('13. M4: uygulanabilir false ise yalnız Bırak ve Açıkla düğmeleri ve uyarı satırı üretilir', () => {
  const simdi = new Date('2026-11-24T12:00:00Z');

  // 1. uygulanabilir === false
  const vUygulanamaz = yeniVaka({
    bekci: 'preise',
    baslik: 'Yeni kod bulundu',
    ek: { uygulanabilir: false },
    simdi,
  });

  const m1 = mesaj(vUygulanamaz);
  assert.ok(m1.text.includes('(Bu vaka otomatik uygulanamaz — yerel oturumda yapılır.)'));
  assert.deepEqual(m1.knoepfe, [
    [{ text: '❌ Bırak', befehl: `v:${vUygulanamaz.id}:birak` }],
    [{ text: '💬 Açıkla', befehl: `v:${vUygulanamaz.id}:acikla` }],
  ]);

  // 2. ek.uygulanabilir yoksa veya true ise eski format (Uygula düğmesi var, uyarı metni yok)
  const vNormal = yeniVaka({
    bekci: 'preise',
    baslik: 'Normal vaka',
    simdi,
  });

  const m2 = mesaj(vNormal);
  assert.ok(!m2.text.includes('(Bu vaka otomatik uygulanamaz'));
  assert.deepEqual(m2.knoepfe, [
    [
      { text: '✅ Uygula', befehl: `v:${vNormal.id}:uygula` },
      { text: '❌ Bırak', befehl: `v:${vNormal.id}:birak` },
    ],
    [
      { text: '💬 Açıkla', befehl: `v:${vNormal.id}:acikla` },
    ],
  ]);
});
