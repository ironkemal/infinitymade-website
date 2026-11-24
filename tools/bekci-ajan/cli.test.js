// tools/bekci-ajan/cli.test.js
// Ne: cli.mjs birim testleri (en az 16 test).
// Niye: SPEC.md ve görev tanımı uyarınca her alt komutun saf fonksiyonlarının,
// güvenlik kontrollerinin (sha, izinli dosyalar, kod formatı, metin formatı)
// ve CLI argüman / süreç köprüsünün doğrulanması.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  yamaKontrol,
  vakaHazirla,
  vakaDurumGuncelle,
  bildirimMetni,
  kararOku,
  parseArgs,
  guvenliYolMu,
} from './cli.mjs';
import { sha256 } from './dogrula.mjs';
import { yeniVaka, ID_RE } from './vaka.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, 'cli.mjs');

// 1. yamaKontrol — geçerli yama
test('1. yamaKontrol — geçerli yama başarıyla onaylanır', () => {
  const dosyaYolu = 'api-backend/billing/codes/podologie_positions.js';
  const orjinal = "const x = 1;\nconst preis = '30.00';\nconst y = 2;\n";
  const patch = [
    `diff --git a/${dosyaYolu} b/${dosyaYolu}`,
    'index 1111111..2222222 100644',
    `--- a/${dosyaYolu}`,
    `+++ b/${dosyaYolu}`,
    '@@ -1,3 +1,3 @@',
    ' const x = 1;',
    "-const preis = '30.00';",
    "+const preis = '32.00';",
    ' const y = 2;',
  ].join('\n');

  const sonuc = yamaKontrol({
    patch,
    preset: 'preise',
    dateiInhalt: { [dosyaYolu]: orjinal },
  });

  assert.equal(sonuc.ok, true);
  assert.equal(sonuc.gruende.length, 0);
  assert.equal(sonuc.sha256, sha256(patch));
  assert.ok(Array.isArray(sonuc.ozet));
  assert.ok(sonuc.ozet.length > 0);
});

// 2. yamaKontrol — izinsiz dosya reddi
test('2. yamaKontrol — izinsiz dosya içeren yama reddedilir', () => {
  const dosyaYolu = 'api-backend/billing/codes/baska_dosya.js';
  const orjinal = "const x = 'eski';\n";
  const patch = [
    `diff --git a/${dosyaYolu} b/${dosyaYolu}`,
    'index 1111111..2222222 100644',
    `--- a/${dosyaYolu}`,
    `+++ b/${dosyaYolu}`,
    '@@ -1,1 +1,1 @@',
    "-const x = 'eski';",
    "+const x = 'yeni';",
  ].join('\n');

  const sonuc = yamaKontrol({
    patch,
    preset: 'preise',
    dateiInhalt: { [dosyaYolu]: orjinal },
  });

  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.some(g => g.includes('izinsiz dosya')));
});

// 3. yamaKontrol — boş yama reddi
test('3. yamaKontrol — boş yama dosyası reddedilir', () => {
  const sonuc1 = yamaKontrol({ patch: '' });
  assert.equal(sonuc1.ok, false);
  assert.ok(sonuc1.gruende.includes('boş yama'));

  const sonuc2 = yamaKontrol({ patch: '   \n  \n' });
  assert.equal(sonuc2.ok, false);
  assert.ok(sonuc2.gruende.includes('boş yama'));
});

// 4. yamaKontrol — beklenenSha eşleşmesi
test('4. yamaKontrol — beklenenSha eşleşirse onaylanır', () => {
  const dosyaYolu = 'api-backend/billing/codes/podologie_positions.js';
  const orjinal = "const a = 10;\nconst b = 20;\n";
  const patch = [
    `diff --git a/${dosyaYolu} b/${dosyaYolu}`,
    'index 1111111..2222222 100644',
    `--- a/${dosyaYolu}`,
    `+++ b/${dosyaYolu}`,
    '@@ -1,2 +1,2 @@',
    ' const a = 10;',
    '-const b = 20;',
    '+const b = 25;',
  ].join('\n');

  const patchSha = sha256(patch);
  const sonuc = yamaKontrol({
    patch,
    preset: 'preise',
    dateiInhalt: { [dosyaYolu]: orjinal },
    beklenenSha: patchSha,
  });

  assert.equal(sonuc.ok, true);
  assert.equal(sonuc.gruende.length, 0);
  assert.equal(sonuc.sha256, patchSha);
});

// 5. yamaKontrol — beklenenSha uyuşmazlığı
test('5. yamaKontrol — beklenenSha uyuşmazlığında ret verilir', () => {
  const dosyaYolu = 'api-backend/billing/codes/podologie_positions.js';
  const orjinal = "const a = 10;\n";
  const patch = [
    `diff --git a/${dosyaYolu} b/${dosyaYolu}`,
    'index 1111111..2222222 100644',
    `--- a/${dosyaYolu}`,
    `+++ b/${dosyaYolu}`,
    '@@ -1,1 +1,1 @@',
    '-const a = 10;',
    '+const a = 15;',
  ].join('\n');

  const sonuc = yamaKontrol({
    patch,
    preset: 'preise',
    dateiInhalt: { [dosyaYolu]: orjinal },
    beklenenSha: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  });

  assert.equal(sonuc.ok, false);
  assert.ok(sonuc.gruende.includes('sha uyuşmuyor'));
});

// 6. vakaHazirla — karar≠vaka reddi
test('6. vakaHazirla — karar vaka değilse hata fırlatır', () => {
  assert.throws(() => {
    vakaHazirla({ entscheidung: { karar: 'auto', vaka: null } });
  }, /entscheidung_vaka_degil/);

  assert.throws(() => {
    vakaHazirla({ entscheidung: { karar: 'sessiz' } });
  }, /entscheidung_vaka_degil/);

  assert.throws(() => {
    vakaHazirla({ entscheidung: { karar: 'vaka', vaka: null } });
  }, /entscheidung_vaka_degil/);
});

// 7. vakaHazirla — entscheidung'dan vaka nesnesi üretimi
test('7. vakaHazirla — temel entscheidung alanlarını doğru aktarır', () => {
  const simdi = new Date('2026-11-24T10:00:00Z');
  const entscheidung = {
    karar: 'vaka',
    vaka: {
      bekci: 'preise',
      baslik: 'Fiyat: büyük sıçrama',
      satirlar: ['• 78010 fiyatı %20 arttı'],
      dosyalar: ['api-backend/billing/codes/podologie_positions.js'],
      oneri: 'Kemal kontrol etmeli',
      ek: { test: 1 },
    },
  };

  const vaka = vakaHazirla({
    entscheidung,
    mevcutIdler: ['20261124-preise-1'],
    simdi,
  });

  assert.equal(vaka.id, '20261124-preise-2');
  assert.equal(vaka.bekci, 'preise');
  assert.equal(vaka.durum, 'acik');
  assert.equal(vaka.baslik, 'Fiyat: büyük sıçrama');
  assert.deepEqual(vaka.satirlar, ['• 78010 fiyatı %20 arttı']);
  assert.equal(vaka.yamaSha256, null);
});

// 8. vakaHazirla — patch verilince sha256 hesaplama ve diffOzet satır birleştirme (≤20)
test('8. vakaHazirla — patch sha256 ekler ve Değişiklik başlığıyla satırları bağlar', () => {
  const dosyaYolu = 'api-backend/billing/codes/podologie_positions.js';
  const patch = [
    `diff --git a/${dosyaYolu} b/${dosyaYolu}`,
    'index 1111111..2222222 100644',
    `--- a/${dosyaYolu}`,
    `+++ b/${dosyaYolu}`,
    '@@ -1,1 +1,1 @@',
    "-const preis = '30.00';",
    "+const preis = '35.00';",
  ].join('\n');

  const cokSayidaSatir = Array.from({ length: 18 }, (_, i) => `Madde ${i + 1}`);
  const entscheidung = {
    karar: 'vaka',
    vaka: {
      bekci: 'preise',
      baslik: 'Fiyat değişimi',
      satirlar: cokSayidaSatir,
      dosyalar: [dosyaYolu],
      oneri: null,
      ek: null,
    },
  };

  const vaka = vakaHazirla({
    entscheidung,
    patch,
    simdi: new Date('2026-11-24T12:00:00Z'),
  });

  assert.equal(vaka.yamaSha256, sha256(patch));
  assert.ok(vaka.satirlar.includes('Değişiklik:'));
  assert.ok(vaka.satirlar.length <= 20);
});

// 9. vakaDurumGuncelle — durum geçişleri
test('9. vakaDurumGuncelle — acik -> uygulaniyor -> uygulandi adımlarını yürütür', () => {
  const simdi = new Date('2026-11-24T14:00:00Z');
  const v0 = yeniVaka({
    bekci: 'preise',
    baslik: 'Test vaka',
    simdi,
  });

  assert.equal(v0.durum, 'acik');

  const v1 = vakaDurumGuncelle(v0, 'uygula', { simdi });
  assert.equal(v1.durum, 'uygulaniyor');

  const v2 = vakaDurumGuncelle(v1, 'tamam', { simdi });
  assert.equal(v2.durum, 'uygulandi');

  // Kapalı vakada hata
  assert.throws(() => {
    vakaDurumGuncelle(v2, 'uygula');
  });
});

// 10. bildirimMetni — auto türü
test('10. bildirimMetni — auto türü tam format ve 15 satır sınırı', () => {
  const satirlar = [
    '78010: 30.00 → 32.00 € (+6.7%)',
    '78011: 40.00 → 42.00 € (+5.0%)',
  ];
  const link = 'https://github.com/praxura/actions/runs/123';

  const res = bildirimMetni({
    tur: 'auto',
    satirlar,
    link,
  });

  assert.equal(res.vakaMi, false);
  const beklenen = [
    '🤖 Fiyat bekçisi — otomatik uygulandı (çift dikiş tuttu)',
    '78010: 30.00 → 32.00 € (+6.7%)',
    '78011: 40.00 → 42.00 € (+5.0%)',
    ":beta'ya çıktı; :stable için elle promote bekliyor.",
    'Çalışma: https://github.com/praxura/actions/runs/123',
  ].join('\n');

  assert.equal(res.text, beklenen);

  // 15 satırdan fazla test
  const yirmiSatir = Array.from({ length: 20 }, (_, i) => `Satır ${i + 1}`);
  const res2 = bildirimMetni({ tur: 'auto', satirlar: yirmiSatir });
  assert.ok(res2.text.includes('Satır 15'));
  assert.ok(!res2.text.includes('Satır 16'));
});

// 11. bildirimMetni — vaka türü
test('11. bildirimMetni — vaka türü düğmeli mesaj nesnesi döner', () => {
  const v = yeniVaka({
    bekci: 'preise',
    baslik: 'Önemli fark',
    satirlar: ['satır a', 'satır b'],
    simdi: new Date('2026-11-24T12:00:00Z'),
  });

  const res = bildirimMetni({ tur: 'vaka', vaka: v });
  assert.equal(res.vakaMi, true);
  assert.ok(res.text.includes('⚠️ preise · Önemli fark'));
  assert.ok(res.text.includes(`#${v.id}`));
  assert.ok(Array.isArray(res.knoepfe));
  assert.equal(res.knoepfe.length, 2);
});

// 12. bildirimMetni — aciklama türü (3000 kesme ve kontrol karakteri temizliği)
test('12. bildirimMetni — aciklama türü kontrol karakterlerini temizler ve 3000 karakterde keser', () => {
  const kirliMetin = 'Temiz kısım\u0000\u0001\u0007\u0008' + 'X'.repeat(3500);
  const res = bildirimMetni({
    tur: 'aciklama',
    satirlar: kirliMetin,
    vaka: { id: '20261124-preise-1' },
  });

  assert.equal(res.vakaMi, false);
  const baslik = '💬 #20261124-preise-1 açıklaması (YZ yazdı, rakamlar vakadaki satırlardan):';
  assert.ok(res.text.startsWith(baslik));
  assert.ok(!res.text.includes('\u0000'));
  assert.ok(!res.text.includes('\u0001'));
  assert.ok(!res.text.includes('\u0008'));

  const govde = res.text.slice(baslik.length + 1); // başlık ve '\n' sonrası
  assert.equal(govde.length, 3000);
  assert.ok(govde.startsWith('Temiz kısım'));
});

// 13. bildirimMetni — uygulandi türü
test('13. bildirimMetni — uygulandi türü link ile birlikte birebir eşleşir', () => {
  const res1 = bildirimMetni({
    tur: 'uygulandi',
    vaka: { id: '20261124-preise-1' },
    link: 'https://github.com/runs/456',
  });

  const beklenen1 = [
    "✅ #20261124-preise-1 uygulandı. :beta'ya çıktı; :stable için elle promote bekliyor.",
    'Çalışma: https://github.com/runs/456',
  ].join('\n');
  assert.equal(res1.text, beklenen1);

  const res2 = bildirimMetni({
    tur: 'uygulandi',
    vaka: { id: '20261124-preise-2' },
  });
  assert.equal(
    res2.text,
    "✅ #20261124-preise-2 uygulandı. :beta'ya çıktı; :stable için elle promote bekliyor."
  );
});

// 14. bildirimMetni — elle türü
test('14. bildirimMetni — elle türü birebir metin eşleşmesi', () => {
  const res = bildirimMetni({
    tur: 'elle',
    vaka: { id: '20261124-preise-1' },
  });

  const beklenen =
    'ℹ️ #20261124-preise-1: bu vaka otomatik uygulanamıyor (yeni/kaybolan kod ya da doğrulanmamış rakam). Yerel oturumda yapılmalı; vaka açık kalıyor.';
  assert.equal(res.text, beklenen);
});

// 15. bildirimMetni — hata türü
test('15. bildirimMetni — hata türü ID ve link varyasyonları (hata detayı içermez)', () => {
  const res1 = bildirimMetni({
    tur: 'hata',
    vaka: { id: '20261124-preise-1' },
    link: 'https://github.com/runs/999',
  });

  const beklenen1 = [
    '⚠️ Bekçi-ajan çalışırken hata oldu · #20261124-preise-1',
    'Çalışma: https://github.com/runs/999',
  ].join('\n');
  assert.equal(res1.text, beklenen1);

  const res2 = bildirimMetni({ tur: 'hata' });
  assert.equal(res2.text, '⚠️ Bekçi-ajan çalışırken hata oldu');
});

// 16. kararOku — geçerli nesne
test('16. kararOku — geçerli preise-bewerten nesnesinden karar ve virgüllü erlaube_sprung üretir', () => {
  const girdi1 = {
    karar: 'auto',
    erlaubeSprung: ['78010', '78011', 'X1234'],
  };
  const res1 = kararOku(girdi1);
  assert.equal(res1.karar, 'auto');
  assert.equal(res1.erlaube_sprung, '78010,78011,X1234');

  const girdi2 = {
    karar: 'vaka',
    erlaube_sprung: [],
  };
  const res2 = kararOku(girdi2);
  assert.equal(res2.karar, 'vaka');
  assert.equal(res2.erlaube_sprung, '');
});

// 17. kararOku — geçersiz kod reddi
test('17. kararOku — /^[A-Z0-9]{4,6}$/ formatına uymayan kodlarda hata fırlatır', () => {
  assert.throws(() => {
    kararOku({
      karar: 'auto',
      erlaubeSprung: ['780', 'GECERLI'], // '780' 3 karakter -> geçersiz
    });
  }, /gecersiz_kod/);

  assert.throws(() => {
    kararOku({
      karar: 'auto',
      erlaubeSprung: ['78010!', 'X123'], // '!' içeriyor -> geçersiz
    });
  }, /gecersiz_kod/);

  assert.throws(() => {
    kararOku({
      karar: 'auto',
      erlaubeSprung: ['COK_UZUN_KOD_123'],
    });
  }, /gecersiz_kod/);
});

// 18. CLI — import edilince çalışmaz
test('18. CLI import edilince process.exit veya komut koşturmaz', () => {
  // Test dosyasının kendisi başındaki import ile cli.mjs'i içe aktarmıştır ve
  // bu noktaya başarıyla ulaşılması import anında hiçbir exit çağrılmadığını kanıtlar.
  assert.equal(typeof yamaKontrol, 'function');
  assert.equal(typeof vakaHazirla, 'function');
});

// 19. CLI alt süreç — argüman eksik veya bilinmeyen komut exit 2 verir
test('19. CLI alt süreç — eksik argümanlar veya geçersiz komutta exit 2 döner', () => {
  // Komutsuz çağrı
  assert.throws(
    () => {
      execFileSync(process.execPath, [cliPath], { stdio: 'pipe' });
    },
    err => err.status === 2
  );

  // Bilinmeyen komut
  assert.throws(
    () => {
      execFileSync(process.execPath, [cliPath, 'bilinmeyen-islem'], { stdio: 'pipe' });
    },
    err => err.status === 2
  );

  // yama-kontrol eksik parametre
  assert.throws(
    () => {
      execFileSync(process.execPath, [cliPath, 'yama-kontrol'], { stdio: 'pipe' });
    },
    err => err.status === 2
  );

  // vaka-ac eksik parametre
  assert.throws(
    () => {
      execFileSync(process.execPath, [cliPath, 'vaka-ac', '--dizin=tmp'], { stdio: 'pipe' });
    },
    err => err.status === 2
  );

  // vaka-durum eksik eylem
  assert.throws(
    () => {
      execFileSync(process.execPath, [cliPath, 'vaka-durum', '--dizin=tmp', '--id=20261124-preise-1'], {
        stdio: 'pipe',
      });
    },
    err => err.status === 2
  );

  // bildir eksik tur
  assert.throws(
    () => {
      execFileSync(process.execPath, [cliPath, 'bildir'], { stdio: 'pipe' });
    },
    err => err.status === 2
  );

  // karar-oku eksik file
  assert.throws(
    () => {
      execFileSync(process.execPath, [cliPath, 'karar-oku'], { stdio: 'pipe' });
    },
    err => err.status === 2
  );
});

// 20. CLI alt süreç — karar-oku komutu çıktı basar ve exit 0 verir
test('20. CLI alt süreç — karar-oku GitHub output satırlarını basar (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'karar-test-'));
  const dosya = path.join(tempDir, 'karar.json');

  try {
    await writeFile(
      dosya,
      JSON.stringify({
        karar: 'auto',
        erlaubeSprung: ['78010', '78012'],
      }),
      'utf-8'
    );

    const out = execFileSync(
      process.execPath,
      [cliPath, 'karar-oku', `--file=${dosya}`],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    assert.ok(out.includes('karar=auto'));
    assert.ok(out.includes('erlaube_sprung=78010,78012'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 21. CLI alt süreç — vaka-ac vaka oluşturur, ID basar ve kaydeder (exit 0)
test('21. CLI alt süreç — vaka-ac vakayı kaydeder ve id basar (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vaka-ac-test-'));
  const entscheidungDosya = path.join(tempDir, 'entscheidung.json');
  const vakalarDizin = path.join(tempDir, 'vakalar');
  const outIdDosya = path.join(tempDir, 'vaka-id.txt');

  try {
    await writeFile(
      entscheidungDosya,
      JSON.stringify({
        karar: 'vaka',
        vaka: {
          bekci: 'preise',
          baslik: 'CLI Vaka Testi',
          satirlar: ['Satır 1'],
          dosyalar: ['api-backend/billing/codes/podologie_positions.js'],
          oneri: 'Test önerisi',
          ek: null,
        },
      }),
      'utf-8'
    );

    const out = execFileSync(
      process.execPath,
      [
        cliPath,
        'vaka-ac',
        `--entscheidung=${entscheidungDosya}`,
        `--dizin=${vakalarDizin}`,
        `--out-id=${outIdDosya}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const vakaId = out.trim();
    assert.ok(ID_RE.test(vakaId));

    const idDosyaIcerik = (await readFile(outIdDosya, 'utf-8')).trim();
    assert.equal(idDosyaIcerik, vakaId);

    const vakaJsonIcerik = await readFile(path.join(vakalarDizin, `${vakaId}.json`), 'utf-8');
    const vakaObj = JSON.parse(vakaJsonIcerik);
    assert.equal(vakaObj.id, vakaId);
    assert.equal(vakaObj.baslik, 'CLI Vaka Testi');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 22. guvenliYolMu yardımcı fonksiyonu
test('22. guvenliYolMu — tehlikeli yolları reddeder', () => {
  assert.equal(guvenliYolMu('api-backend/billing/codes/podologie_positions.js'), true);
  assert.equal(guvenliYolMu('/etc/passwd'), false);
  assert.equal(guvenliYolMu('api/../secret'), false);
  assert.equal(guvenliYolMu('api\\test.js'), false);
  assert.equal(guvenliYolMu('C:\\test'), false);
  assert.equal(guvenliYolMu('test\u0000.js'), false);
});

// 23. CLI alt süreç — vaka-durum eylemi dosyayı günceller (exit 0)
test('23. CLI alt süreç — vaka-durum eylemi dosyayı günceller (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vaka-durum-test-'));
  const v = yeniVaka({
    bekci: 'preise',
    baslik: 'Durum testi',
    simdi: new Date('2026-11-24T12:00:00Z'),
  });

  try {
    await writeFile(path.join(tempDir, `${v.id}.json`), JSON.stringify(v, null, 2), 'utf-8');

    // uygula
    execFileSync(
      process.execPath,
      [cliPath, 'vaka-durum', `--dizin=${tempDir}`, `--id=${v.id}`, '--eylem=uygula'],
      { stdio: 'pipe' }
    );

    let guncel = JSON.parse(await readFile(path.join(tempDir, `${v.id}.json`), 'utf-8'));
    assert.equal(guncel.durum, 'uygulaniyor');

    // tamam
    execFileSync(
      process.execPath,
      [cliPath, 'vaka-durum', `--dizin=${tempDir}`, `--id=${v.id}`, '--eylem=tamam'],
      { stdio: 'pipe' }
    );

    guncel = JSON.parse(await readFile(path.join(tempDir, `${v.id}.json`), 'utf-8'));
    assert.equal(guncel.durum, 'uygulandi');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 24. CLI alt süreç — bildir bot yapılandırılmamışsa sessiz geçer (exit 0)
test('24. CLI alt süreç — bildir bot token eksikken exit 0 ve açıklama basar', () => {
  const out = execFileSync(
    process.execPath,
    [cliPath, 'bildir', '--tur=elle', '--id=20261124-preise-1'],
    {
      encoding: 'utf-8',
      env: { ...process.env, TELEGRAM_BEKCI_BOT_TOKEN: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  assert.ok(out.includes('Bekçi-Bot nicht konfiguriert'));
});

// 25. parseArgs — argüman ve bayrak ayrıştırma doğruluğu
test('25. parseArgs — komut ve bayrakları hem --key=val hem --key val ile ayrıştırır', () => {
  const res1 = parseArgs(['yama-kontrol', '--patch=test.patch', '--preset=preise']);
  assert.equal(res1.komut, 'yama-kontrol');
  assert.equal(res1.flags.patch, 'test.patch');
  assert.equal(res1.flags.preset, 'preise');

  const res2 = parseArgs(['bildir', '--tur', 'auto', '--link', 'https://link.com']);
  assert.equal(res2.komut, 'bildir');
  assert.equal(res2.flags.tur, 'auto');
  assert.equal(res2.flags.link, 'https://link.com');
});

