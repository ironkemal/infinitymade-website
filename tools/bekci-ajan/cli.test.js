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
  tekillestir,
  sirIceriyor,
  nesneSirIceriyor,
} from './cli.mjs';
import { sha256 } from './dogrula.mjs';
import { yeniVaka, ID_RE } from './vaka.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, 'cli.mjs');

// Gerçek biçimli veri satırları (24.11.2026: kapı yalnız veri satırlarına izin veriyor)
const VERI_A = "  { hpnr: '78010', label: 'Podologische Behandlung (klein)',   kat: 'Podologische Komplexbehandlung', diagnosegruppen: ['DF','NF','QF'], preis: 36.10, zuzahlung: 3.61,  dauer: '35', gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },";
const VERI_B = "  { hpnr: '78030', label: 'Podologische Befundung',           diagnosegruppen: ['DF','NF','QF'], preis:  3.57, zuzahlung: 0.36,  dauer: null, gueltig_ab: '2026-07-01', gueltig_bis: '9999-12-31' },";
const VERI_ORJINAL = ['export const X = Object.freeze([', VERI_A, VERI_B, ']);', ''].join('\n');
function veriYama(yol, neuPreis = '3.70', neuZu = '0.37') {
  return [
    `diff --git a/${yol} b/${yol}`, 'index 1111111..2222222 100644', `--- a/${yol}`, `+++ b/${yol}`,
    '@@ -2,2 +2,2 @@', ' ' + VERI_A, '-' + VERI_B,
    '+' + VERI_B.replace('preis:  3.57, zuzahlung: 0.36', `preis:  ${neuPreis}, zuzahlung: ${neuZu}`),
  ].join('\n');
}

// 1. yamaKontrol — geçerli yama
test('1. yamaKontrol — geçerli yama başarıyla onaylanır', () => {
  const dosyaYolu = 'api-backend/billing/codes/podologie_positions.js';
  const orjinal = VERI_ORJINAL;
  const patch = veriYama(dosyaYolu);

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
  const orjinal = VERI_ORJINAL;
  const patch = veriYama(dosyaYolu, '3.80', '0.38');

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

// 26. bildirimMetni — bekci=quellen ile auto metni (:beta yok, quellen başlığı)
test('26. bildirimMetni — bekci=quellen ile auto bildirim metni üretimi', () => {
  const satirlar = [
    '✓ gkv-anlage2: 1 yeni belge — ajan: bizi etkilemiyor (podoloji değil)',
  ];
  const res = bildirimMetni({
    tur: 'auto',
    satirlar,
    bekci: 'quellen',
  });

  assert.equal(res.vakaMi, false);
  const beklenen = [
    '🤖 Kaynak bekçisi — şunları "biliniyor" işaretledim (ajan: bizi etkilemiyor)',
    '✓ gkv-anlage2: 1 yeni belge — ajan: bizi etkilemiyor (podoloji değil)',
  ].join('\n');

  assert.equal(res.text, beklenen);
  assert.ok(!res.text.includes(':beta'));
});

// 27. bildirimMetni — bekci=quellen ile uygulandi metni (:beta cümlesi yok)
test('27. bildirimMetni — bekci=quellen ile uygulandi bildirim metni üretimi', () => {
  const res1 = bildirimMetni({
    tur: 'uygulandi',
    vaka: { id: '20261124-quellen-1' },
    bekci: 'quellen',
  });

  assert.equal(
    res1.text,
    '✅ #20261124-quellen-1: kaynak "biliniyor" işaretlendi, bekçi artık bunu hatırlatmayacak.'
  );
  assert.ok(!res1.text.includes(':beta'));

  // vaka nesnesi bekci: 'quellen' taşıdığında da geçerli
  const res2 = bildirimMetni({
    tur: 'uygulandi',
    vaka: { id: '20261124-quellen-2', bekci: 'quellen' },
    link: 'https://github.com/runs/789',
  });

  const beklenen2 = [
    '✅ #20261124-quellen-2: kaynak "biliniyor" işaretlendi, bekçi artık bunu hatırlatmayacak.',
    'Çalışma: https://github.com/runs/789',
  ].join('\n');
  assert.equal(res2.text, beklenen2);
});

// 28. CLI alt süreç — vaka-ac-coklu çoklu vaka kaydeder ve idleri satır satır basar
test('28. CLI alt süreç — vaka-ac-coklu çıktıyı kaydeder ve out-ids dosyasına yazar (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vaka-ac-coklu-test-'));
  const entscheidungDosya = path.join(tempDir, 'entscheidung.json');
  const vakalarDizin = path.join(tempDir, 'vakalar');
  const outIdsDosya = path.join(tempDir, 'out-ids.txt');

  try {
    const entscheidung = {
      vakalar: [
        {
          bekci: 'quellen',
          baslik: 'Kaynak 1',
          satirlar: ['Satır 1'],
          dosyalar: ['module/billing.js'],
          oneri: 'İncele',
          ek: { quelleId: 'q1', neu: ['a.pdf'], weg: [] },
        },
        {
          bekci: 'quellen',
          baslik: 'Kaynak 2',
          satirlar: ['Satır 2'],
          dosyalar: [],
          oneri: 'İncele 2',
          ek: { quelleId: 'q2', neu: ['b.pdf'], weg: ['c.pdf'] },
        },
      ],
    };
    await writeFile(entscheidungDosya, JSON.stringify(entscheidung), 'utf-8');

    const out = execFileSync(
      process.execPath,
      [
        cliPath,
        'vaka-ac-coklu',
        `--entscheidung=${entscheidungDosya}`,
        `--dizin=${vakalarDizin}`,
        `--out-ids=${outIdsDosya}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const idler = out.trim().split(/\r?\n/).filter(Boolean);
    assert.equal(idler.length, 2);
    assert.ok(idler[0].includes('quellen-1'));
    assert.ok(idler[1].includes('quellen-2'));

    const idDosyaIcerik = (await readFile(outIdsDosya, 'utf-8')).trim().split(/\r?\n/).filter(Boolean);
    assert.deepEqual(idDosyaIcerik, idler);

    const vaka1 = JSON.parse(await readFile(path.join(vakalarDizin, `${idler[0]}.json`), 'utf-8'));
    assert.equal(vaka1.baslik, 'Kaynak 1');
    assert.equal(vaka1.ek.quelleId, 'q1');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 29. CLI alt süreç — ek-yaz dosyaları yazar ve stdout'a quelleId basar
test('29. CLI alt süreç — ek-yaz ek.neu ve ek.weg yazar ve quelleId basar (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ek-yaz-test-'));
  const vakalarDizin = path.join(tempDir, 'vakalar');
  const neuDosya = path.join(tempDir, 'neu.txt');
  const wegDosya = path.join(tempDir, 'weg.txt');

  try {
    const v = yeniVaka({
      bekci: 'quellen',
      baslik: 'Ek testi',
      ek: {
        quelleId: 'gkv-anlage2',
        neu: ['https://www.gkv.de/neu1.pdf', 'https://www.gkv.de/neu2.pdf'],
        weg: ['https://www.gkv.de/eski.pdf'],
      },
    });

    const { kaydet } = await import('./vaka.mjs');
    await kaydet(vakalarDizin, v);

    const out = execFileSync(
      process.execPath,
      [
        cliPath,
        'ek-yaz',
        `--dizin=${vakalarDizin}`,
        `--id=${v.id}`,
        `--neu-datei=${neuDosya}`,
        `--weg-datei=${wegDosya}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    assert.equal(out.trim(), 'gkv-anlage2');

    const neuIcerik = (await readFile(neuDosya, 'utf-8')).trim().split(/\r?\n/);
    assert.deepEqual(neuIcerik, ['https://www.gkv.de/neu1.pdf', 'https://www.gkv.de/neu2.pdf']);

    const wegIcerik = (await readFile(wegDosya, 'utf-8')).trim().split(/\r?\n/);
    assert.deepEqual(wegIcerik, ['https://www.gkv.de/eski.pdf']);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 30. CLI alt süreç — ek-yaz vakanın eki yoksa exit 1 verir
test('30. CLI alt süreç — ek-yaz ek bilgisi bulunamazsa exit 1 döner', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ek-yaz-hata-'));
  const vakalarDizin = path.join(tempDir, 'vakalar');
  const neuDosya = path.join(tempDir, 'neu.txt');
  const wegDosya = path.join(tempDir, 'weg.txt');

  try {
    const v = yeniVaka({
      bekci: 'quellen',
      baslik: 'Eksiz vaka',
      ek: null,
    });

    const { kaydet } = await import('./vaka.mjs');
    await kaydet(vakalarDizin, v);

    assert.throws(
      () => {
        execFileSync(
          process.execPath,
          [
            cliPath,
            'ek-yaz',
            `--dizin=${vakalarDizin}`,
            `--id=${v.id}`,
            `--neu-datei=${neuDosya}`,
            `--weg-datei=${wegDosya}`,
          ],
          { stdio: 'pipe' }
        );
      },
      err => err.status === 1
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 31. tekillestir — tekrar (acik): aynı bekci + aynı ek.iz + durum acik ise açılmaz
test('31. tekillestir — tekrar (acik): aynı bekci + aynı ek.iz + durum acik ise açılmaz', () => {
  const yeni = { bekci: 'preise', ek: { iz: '1234567890abcdef' } };
  const mevcut = [
    { id: '20261124-preise-1', bekci: 'preise', durum: 'acik', ek: { iz: '1234567890abcdef' } },
  ];

  const sonuc = tekillestir({ yeni, mevcut });
  assert.deepEqual(sonuc, {
    ac: false,
    tekrarId: '20261124-preise-1',
    eskiyenler: [],
  });
});

// 32. tekillestir — tekrar (uygulaniyor): aynı bekci + aynı ek.iz + durum uygulaniyor ise açılmaz
test('32. tekillestir — tekrar (uygulaniyor): aynı bekci + aynı ek.iz + durum uygulaniyor ise açılmaz', () => {
  const yeni = { bekci: 'preise', ek: { iz: '1234567890abcdef' } };
  const mevcut = [
    { id: '20261124-preise-1', bekci: 'preise', durum: 'uygulaniyor', ek: { iz: '1234567890abcdef' } },
  ];

  const sonuc = tekillestir({ yeni, mevcut });
  assert.deepEqual(sonuc, {
    ac: false,
    tekrarId: '20261124-preise-1',
    eskiyenler: [],
  });
});

// 33. tekillestir — kapalı vaka tekrar sayılmaz (birakildi / uygulandi)
test('33. tekillestir — kapalı vaka tekrar sayılmaz (birakildi / uygulandi)', () => {
  const yeni = { bekci: 'preise', ek: { iz: '1234567890abcdef' } };
  const mevcut1 = [
    { id: '20261124-preise-1', bekci: 'preise', durum: 'birakildi', ek: { iz: '1234567890abcdef' } },
  ];
  assert.deepEqual(tekillestir({ yeni, mevcut: mevcut1 }), {
    ac: true,
    tekrarId: null,
    eskiyenler: [],
  });

  const mevcut2 = [
    { id: '20261124-preise-2', bekci: 'preise', durum: 'uygulandi', ek: { iz: '1234567890abcdef' } },
  ];
  assert.deepEqual(tekillestir({ yeni, mevcut: mevcut2 }), {
    ac: true,
    tekrarId: null,
    eskiyenler: [],
  });
});

// 34. tekillestir — farklı iz: eski acik vaka eskiyenler listesine alınır, uygulaniyor korunur
test('34. tekillestir — farklı iz: eski acik vaka eskiyenler listesine alınır, uygulaniyor korunur', () => {
  const yeni = { bekci: 'preise', ek: { iz: 'yeni_iz_22222222' } };
  const mevcut = [
    { id: '20261124-preise-1', bekci: 'preise', durum: 'acik', ek: { iz: 'eski_iz_11111111' } },
    { id: '20261124-preise-2', bekci: 'preise', durum: 'uygulaniyor', ek: { iz: 'baska_iz_33333333' } },
  ];

  const sonuc = tekillestir({ yeni, mevcut });
  assert.deepEqual(sonuc, {
    ac: true,
    tekrarId: null,
    eskiyenler: ['20261124-preise-1'],
  });
});

// 35. tekillestir — quellen farklı quelleId birbirini etkilemez
test('35. tekillestir — quellen farklı quelleId birbirini etkilemez', () => {
  const yeni = { bekci: 'quellen', ek: { quelleId: 'gkv-anlage2', iz: 'iz_yeni_anlage' } };
  const mevcut = [
    {
      id: '20261124-quellen-1',
      bekci: 'quellen',
      durum: 'acik',
      ek: { quelleId: 'kbv-praxis', iz: 'iz_kbv' },
    },
    {
      id: '20261124-quellen-2',
      bekci: 'quellen',
      durum: 'acik',
      ek: { quelleId: 'gkv-anlage2', iz: 'iz_eski_anlage' },
    },
  ];

  const sonuc = tekillestir({ yeni, mevcut });
  assert.deepEqual(sonuc, {
    ac: true,
    tekrarId: null,
    eskiyenler: ['20261124-quellen-2'],
  });
});

// 36. tekillestir — ek.iz'siz eski vaka yok sayılır
test('36. tekillestir — ek.iz\'siz eski vaka yok sayılır', () => {
  const yeni = { bekci: 'preise', ek: { iz: 'yeni_iz_22222222' } };
  const mevcut = [
    { id: '20261124-preise-1', bekci: 'preise', durum: 'acik', ek: null },
    { id: '20261124-preise-2', bekci: 'preise', durum: 'acik', ek: {} },
  ];

  const sonuc = tekillestir({ yeni, mevcut });
  assert.deepEqual(sonuc, {
    ac: true,
    tekrarId: null,
    eskiyenler: [],
  });
});

// 37. tekillestir — yeni vakanın ek.iz'i yoksa tekilleştirme yapılmaz
test('37. tekillestir — yeni vakanın ek.iz\'i yoksa tekilleştirme yapılmaz', () => {
  const yeni = { bekci: 'preise', ek: null };
  const mevcut = [
    { id: '20261124-preise-1', bekci: 'preise', durum: 'acik', ek: { iz: 'iz1' } },
  ];

  const sonuc = tekillestir({ yeni, mevcut });
  assert.deepEqual(sonuc, {
    ac: true,
    tekrarId: null,
    eskiyenler: [],
  });
});

// 38. CLI alt süreç — vaka-ac tekrar durumunda --out-id boş yazar ve stdout tekrar basar (exit 0)
test('38. CLI alt süreç — vaka-ac tekrar durumunda --out-id boş yazar ve stdout tekrar basar (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vaka-ac-tekrar-test-'));
  const entscheidungDosya = path.join(tempDir, 'entscheidung.json');
  const vakalarDizin = path.join(tempDir, 'vakalar');
  const outIdDosya = path.join(tempDir, 'vaka-id.txt');

  try {
    const { kaydet } = await import('./vaka.mjs');
    const mevcutVaka = yeniVaka({
      bekci: 'preise',
      baslik: 'Mevcut açık vaka',
      ek: { iz: 'ayni_iz_12345678' },
    });
    await kaydet(vakalarDizin, mevcutVaka);

    await writeFile(
      entscheidungDosya,
      JSON.stringify({
        karar: 'vaka',
        vaka: {
          bekci: 'preise',
          baslik: 'Yeni vaka adayı',
          satirlar: ['Satır 1'],
          dosyalar: [],
          oneri: null,
          ek: { iz: 'ayni_iz_12345678' },
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

    assert.equal(out.trim(), `tekrar: ${mevcutVaka.id}`);

    // out-id dosyası boş olmalı
    const idDosyaIcerik = await readFile(outIdDosya, 'utf-8');
    assert.equal(idDosyaIcerik, '');

    // Dizinde yalnızca ilk vaka bulunmalı, yeni vaka dosyası açılmamalı
    const { listele } = await import('./vaka.mjs');
    const tumVakalar = await listele(vakalarDizin);
    assert.equal(tumVakalar.length, 1);
    assert.equal(tumVakalar[0].id, mevcutVaka.id);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 39. CLI alt süreç — vaka-ac farklı iz durumunda eskiyi birakildi yapar ve yeni vaka açar (exit 0)
test('39. CLI alt süreç — vaka-ac farklı iz durumunda eskiyi birakildi yapar ve yeni vaka açar (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vaka-ac-farkli-iz-test-'));
  const entscheidungDosya = path.join(tempDir, 'entscheidung.json');
  const vakalarDizin = path.join(tempDir, 'vakalar');
  const outIdDosya = path.join(tempDir, 'vaka-id.txt');

  try {
    const { kaydet, yukle } = await import('./vaka.mjs');
    const eskiVaka = yeniVaka({
      bekci: 'preise',
      baslik: 'Eski açık vaka',
      ek: { iz: 'eski_iz_11111111' },
    });
    await kaydet(vakalarDizin, eskiVaka);

    await writeFile(
      entscheidungDosya,
      JSON.stringify({
        karar: 'vaka',
        vaka: {
          bekci: 'preise',
          baslik: 'Yeni güncel vaka',
          satirlar: ['Satır 1'],
          dosyalar: [],
          oneri: null,
          ek: { iz: 'yeni_iz_22222222' },
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

    const yeniId = out.trim();
    assert.ok(ID_RE.test(yeniId));
    assert.notEqual(yeniId, eskiVaka.id);

    const idDosyaIcerik = (await readFile(outIdDosya, 'utf-8')).trim();
    assert.equal(idDosyaIcerik, yeniId);

    // Eski vakanın durumu birakildi olmalı
    const guncelEski = await yukle(vakalarDizin, eskiVaka.id);
    assert.equal(guncelEski.durum, 'birakildi');

    // Yeni vaka açılmış ve durumu acik olmalı
    const guncelYeni = await yukle(vakalarDizin, yeniId);
    assert.equal(guncelYeni.durum, 'acik');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 40. CLI alt süreç — vaka-ac-coklu yalnız yenileri yazar, tekrarları out-ids'e yazmaz (exit 0)
test('40. CLI alt süreç — vaka-ac-coklu yalnız yenileri yazar, tekrarları out-ids\'e yazmaz (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vaka-ac-coklu-tekrar-test-'));
  const entscheidungDosya = path.join(tempDir, 'entscheidung.json');
  const vakalarDizin = path.join(tempDir, 'vakalar');
  const outIdsDosya = path.join(tempDir, 'out-ids.txt');

  try {
    const { kaydet } = await import('./vaka.mjs');
    const mevcutQ1 = yeniVaka({
      bekci: 'quellen',
      baslik: 'Mevcut Q1',
      ek: { quelleId: 'q1', iz: 'iz_q1_tekrar' },
    });
    await kaydet(vakalarDizin, mevcutQ1);

    const entscheidung = {
      vakalar: [
        {
          bekci: 'quellen',
          baslik: 'Kaynak 1 (Tekrar)',
          satirlar: ['Satır 1'],
          dosyalar: [],
          oneri: null,
          ek: { quelleId: 'q1', iz: 'iz_q1_tekrar' },
        },
        {
          bekci: 'quellen',
          baslik: 'Kaynak 2 (Yeni)',
          satirlar: ['Satır 2'],
          dosyalar: [],
          oneri: null,
          ek: { quelleId: 'q2', iz: 'iz_q2_yeni' },
        },
      ],
    };
    await writeFile(entscheidungDosya, JSON.stringify(entscheidung), 'utf-8');

    const out = execFileSync(
      process.execPath,
      [
        cliPath,
        'vaka-ac-coklu',
        `--entscheidung=${entscheidungDosya}`,
        `--dizin=${vakalarDizin}`,
        `--out-ids=${outIdsDosya}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const satirlar = out.trim().split(/\r?\n/).filter(Boolean);
    assert.equal(satirlar.length, 2);
    assert.equal(satirlar[0], `tekrar: ${mevcutQ1.id}`);
    assert.ok(satirlar[1].includes('quellen-2'));

    // out-ids dosyası yalnızca yeni vakanın ID'sini içermeli (tekrar olan yazılmaz)
    const outIdsIcerik = (await readFile(outIdsDosya, 'utf-8')).trim().split(/\r?\n/).filter(Boolean);
    assert.deepEqual(outIdsIcerik, [satirlar[1]]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 31. sirIceriyor — her kalıp + temiz metin yanlış pozitif vermiyor
test('31. sirIceriyor: her kalıp için pozitif, temiz metinlerde yanlış pozitif vermez', () => {
  // Pozitif kalıplar (sır içerenler)
  assert.equal(sirIceriyor('sk-ant-api03-abcdef123456'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('ghp_abcdefghijklmnopqrstuvwxyz0123456789'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('ghs_abcdefghijklmnopqrstuvwxyz0123456789'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('gho_abcdefghijklmnopqrstuvwxyz0123456789'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('github_pat_11AAAAAAA0123456789_abcdef'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('xoxb-12345-67890-abcdef'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('xoxa-12345-67890-abcdef'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('xoxp-12345-67890-abcdef'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('-----BEGIN PRIVATE KEY-----'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2g='), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('e3b0c44298fc1c149afbf4c8996fb92427ae41e4'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('123456789:ABCdefGHIjklMNOpqrSTUvwxYZ123456'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('export CLAUDE_CODE_OAUTH_TOKEN=secret'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('prefix GITHUB_TOKEN suffix'), true); // secret-scan: ignore (sahte test değeri)
  assert.equal(sirIceriyor('ACTIONS_RUNTIME_TOKEN=xyz'), true); // secret-scan: ignore (sahte test değeri)

  // Yanlış pozitif vermeyen temiz metinler
  assert.equal(sirIceriyor('Podoloji fiyat sıçraması resmî sözleşme ile doğrulandı.'), false);
  assert.equal(sirIceriyor('2027-01-01'), false);
  assert.equal(sirIceriyor('78010'), false);
  assert.equal(
    sirIceriyor('https://www.gkv-spitzenverband.de/media/dokumente/heilmittel/podologie/anlage2.pdf'),
    false
  );
  assert.equal(sirIceriyor('wissensbank/podologie/anlage2.txt'), false);
  assert.equal(sirIceriyor('Podologische Komplexbehandlung (klein)'), false);
  assert.equal(sirIceriyor(null), false);
  assert.equal(sirIceriyor(undefined), false);

  // nesneSirIceriyor nesne ve dizi taraması
  assert.equal(
    nesneSirIceriyor({ ozet: 'temiz metin', ic: { token: 'ghp_gizli1234567890' } }),
    true
  );
  assert.equal(
    nesneSirIceriyor({ dizi: ['temiz', 'dizi', 'sk-ant-gizli'] }),
    true
  );
  assert.equal(
    nesneSirIceriyor({ ozet: 'tamamen temiz', rakam: 123, dizi: ['2027-01-01', '78010'] }),
    false
  );
});

// 32. karar-temizle iki bekçi
test('32. karar-temizle: preise ve quellen için sır temizleme ve şema denetimi', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cli-temizle-'));
  try {
    // A) preise: geçerli ve temiz karar -> stdout 'temiz'
    const dosyaA = path.join(tempDir, 'kararA.json');
    const gecerliPreiseKarar = {
      tur: 'sprung_belegt',
      guven: 'hoch',
      ozet: 'Fiyatlar doğrulandı.',
      okunan_rakamlar: [
        {
          code: '78010',
          preis: 37.2,
          zuzahlung: null,
          gueltig_ab: '2027-01-01',
          quelle: 'wissensbank/podologie/a.txt',
          zeile: 10,
        },
      ],
      neue_positionen: [],
      erlaube_sprung: ['78010'],
      warnungen: [],
    };
    await writeFile(dosyaA, JSON.stringify(gecerliPreiseKarar), 'utf-8');

    const outA = execFileSync(
      process.execPath,
      [cliPath, 'karar-temizle', '--bekci=preise', `--dosya=${dosyaA}`],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.equal(outA.trim(), 'temiz');
    const icerikA = JSON.parse(await readFile(dosyaA, 'utf-8'));
    assert.equal(icerikA.tur, 'sprung_belegt');

    // B) preise: sır içeren karar -> stdout 'gecersiz', dosya değiştirilir, aciklama silinir
    const dosyaB = path.join(tempDir, 'kararB.json');
    const aciklamaB = path.join(tempDir, 'aciklamaB.md');
    const sirliKarar = {
      ...gecerliPreiseKarar,
      ozet: 'Burada bir sır var: sk-ant-gizli-token',
    };
    await writeFile(dosyaB, JSON.stringify(sirliKarar), 'utf-8');
    await writeFile(aciklamaB, 'Normal açıklama', 'utf-8');

    const outB = execFileSync(
      process.execPath,
      [
        cliPath,
        'karar-temizle',
        '--bekci=preise',
        `--dosya=${dosyaB}`,
        `--aciklama=${aciklamaB}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.equal(outB.trim(), 'gecersiz');
    const icerikB = JSON.parse(await readFile(dosyaB, 'utf-8'));
    assert.equal(icerikB.gecersiz, true);
    assert.deepEqual(icerikB.hatalar, ['sır benzeri içerik']);
    // aciklama dosyası silinmiş olmalıdır
    const aciklamaVarMi = await (import('node:fs')).then(fs => fs.existsSync(aciklamaB));
    assert.equal(aciklamaVarMi, false, 'Sır tespit edildiğinde aciklama.md silinmelidir');

    // C) quellen: aciklama.md içinde sır varsa yine silinmeli ve gecersiz olmalı
    const dosyaC = path.join(tempDir, 'kararC.json');
    const aciklamaC = path.join(tempDir, 'aciklamaC.md');
    const befundeC = path.join(tempDir, 'befundeC.json');
    const quellenBefund = [
      {
        id: 'q1',
        url: 'https://www.gkv-spitzenverband.de/a.html',
        neu: ['www.gkv-spitzenverband.de/b.pdf'],
        weg: [],
      },
    ];
    const quellenKarar = {
      belgeler: [
        {
          quelle_id: 'q1',
          url: 'www.gkv-spitzenverband.de/b.pdf',
          ne_degisti: 'Yeni dosya',
          etki: 'yok',
          gecerlilik: null,
          etkilenen_dosyalar: [],
          oneri: 'biliniyor',
          guven: 'hoch',
        },
      ],
      ozet: 'Temiz özet',
      warnungen: [],
    };
    await writeFile(dosyaC, JSON.stringify(quellenKarar), 'utf-8');
    await writeFile(befundeC, JSON.stringify(quellenBefund), 'utf-8');
    await writeFile(aciklamaC, 'Sır sızıntısı: GITHUB_TOKEN=ghp_secret1234567890', 'utf-8');

    const outC = execFileSync(
      process.execPath,
      [
        cliPath,
        'karar-temizle',
        '--bekci=quellen',
        `--dosya=${dosyaC}`,
        `--aciklama=${aciklamaC}`,
        `--befunde=${befundeC}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.equal(outC.trim(), 'gecersiz');
    const icerikC = JSON.parse(await readFile(dosyaC, 'utf-8'));
    assert.equal(icerikC.gecersiz, true);
    assert.deepEqual(icerikC.hatalar, ['sır benzeri içerik']);

    // D) quellen: geçersiz şema -> ilk 5 hata ile gecersiz
    const dosyaD = path.join(tempDir, 'kararD.json');
    const gecersizQuellenKarar = {
      belgeler: 'dizi degil', // Şema hatası
      ozet: 123,
      warnungen: 'dizi degil',
    };
    await writeFile(dosyaD, JSON.stringify(gecersizQuellenKarar), 'utf-8');

    const outD = execFileSync(
      process.execPath,
      [
        cliPath,
        'karar-temizle',
        '--bekci=quellen',
        `--dosya=${dosyaD}`,
        `--befunde=${befundeC}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.equal(outD.trim(), 'gecersiz');
    const icerikD = JSON.parse(await readFile(dosyaD, 'utf-8'));
    assert.equal(icerikD.gecersiz, true);
    assert.ok(Array.isArray(icerikD.hatalar));
    assert.ok(icerikD.hatalar.length <= 5);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 33. kararOku allowlist ve uygulanabilir satırı
test('33. kararOku: allowlist denetimi ve uygulanabilir satırı', async () => {
  // Allowlist: {sessiz, auto, vaka, elle} izinli
  assert.equal(kararOku({ karar: 'sessiz' }).karar, 'sessiz');
  assert.equal(kararOku({ karar: 'sessiz' }).uygulanabilir, false);

  assert.equal(kararOku({ karar: 'auto', erlaubeSprung: ['78010'] }).karar, 'auto');
  assert.equal(kararOku({ karar: 'auto', erlaubeSprung: ['78010'] }).uygulanabilir, true);

  assert.equal(kararOku({ karar: 'vaka', erlaubeSprung: ['78010'] }).uygulanabilir, true);
  assert.equal(kararOku({ karar: 'vaka', erlaubeSprung: [] }).uygulanabilir, false);
  assert.equal(kararOku({ karar: 'vaka', vaka: { ek: { uygulanabilir: false } } }).uygulanabilir, false);

  assert.equal(kararOku({ karar: 'elle' }).karar, 'elle');
  assert.equal(kararOku({ karar: 'elle' }).uygulanabilir, false);

  // İzinli olmayan kararlar hata fırlatır
  assert.throws(() => kararOku({ karar: 'onay' }), /gecersiz_karar/);
  assert.throws(() => kararOku({ karar: 'iptal' }), /gecersiz_karar/);
  assert.throws(() => kararOku({ karar: '' }), /gecersiz_karar/);
  assert.throws(() => kararOku({ karar: 123 }), /gecersiz_karar/);

  // CLI süreci yalnız stdout'a yazar (GITHUB_OUTPUT'a yazmaz)
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cli-karar-oku-'));
  try {
    const kararDosya = path.join(tempDir, 'karar.json');
    await writeFile(
      kararDosya,
      JSON.stringify({ karar: 'auto', erlaubeSprung: ['78010', '78020'] }),
      'utf-8'
    );

    const out = execFileSync(
      process.execPath,
      [cliPath, 'karar-oku', `--file=${kararDosya}`],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const satirlar = out.trim().split(/\r?\n/).filter(Boolean);
    assert.deepEqual(satirlar, [
      'karar=auto',
      'erlaube_sprung=78010,78020',
      'uygulanabilir=true',
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 34. acik-iz iki bekçi + dizin yok
test('34. acik-iz: preise ve quellen için açık vaka ve dizin yok denetimi', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cli-acik-iz-'));
  try {
    const olmayanDizin = path.join(tempDir, 'olmayan-dal-vakalar');
    const varOlanDizin = path.join(tempDir, 'mevcut-vakalar');

    const berichtDosya = path.join(tempDir, 'bericht.json');
    const befundeInDosya = path.join(tempDir, 'befunde-in.json');
    const befundeOutDosya = path.join(tempDir, 'befunde-out.json');

    const ornekBericht = {
      stand: '2026-11-24',
      needsReview: [
        {
          art: 'sprung',
          grund: 'podologie: sıçrama',
          bereich: 'podologie',
          details: [
            {
              sprungCodes: [{ code: '78010', altPreis: 30, neuPreis: 37.2, prozent: 24, xmlGueltigAb: '2027-01-01' }],
            },
          ],
        },
      ],
    };
    await writeFile(berichtDosya, JSON.stringify(ornekBericht), 'utf-8');

    const ornekBefunde = [
      {
        id: 'q1',
        neu: ['www.gkv-spitzenverband.de/a.pdf'],
        weg: [],
      },
      {
        id: 'q2',
        neu: ['www.gkv-spitzenverband.de/b.pdf'],
        weg: [],
      },
    ];
    await writeFile(befundeInDosya, JSON.stringify(ornekBefunde), 'utf-8');

    // 1. Dizin yokken preise -> zaten_acik=false
    const outP1 = execFileSync(
      process.execPath,
      [cliPath, 'acik-iz', `--dizin=${olmayanDizin}`, '--bekci=preise', `--bericht=${berichtDosya}`],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.equal(outP1.trim(), 'zaten_acik=false');

    // 2. Dizin yokken quellen -> kalan=2 ve befunde-out yazılır
    const outQ1 = execFileSync(
      process.execPath,
      [
        cliPath,
        'acik-iz',
        `--dizin=${olmayanDizin}`,
        '--bekci=quellen',
        `--befunde-in=${befundeInDosya}`,
        `--befunde-out=${befundeOutDosya}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.equal(outQ1.trim(), 'kalan=2');
    const outQ1Icerik = JSON.parse(await readFile(befundeOutDosya, 'utf-8'));
    assert.equal(outQ1Icerik.length, 2);

    // 3. Dizin varken ve açık vaka varken preise
    const preiseIzHesap = (await import('./preise-bewerten.mjs')).preiseIz(ornekBericht);
    const vPreiseAcik = yeniVaka({
      bekci: 'preise',
      baslik: 'Fiyat sıçraması',
      ek: { iz: preiseIzHesap },
      simdi: new Date('2026-11-24T10:00:00Z'),
    });
    await (await import('./vaka.mjs')).kaydet(varOlanDizin, vPreiseAcik);

    const outP2 = execFileSync(
      process.execPath,
      [cliPath, 'acik-iz', `--dizin=${varOlanDizin}`, '--bekci=preise', `--bericht=${berichtDosya}`],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.equal(outP2.trim(), 'zaten_acik=true');

    // 4. Dizin varken quellen: q1 için açık vaka var, q2 için yok -> kalan=1
    const quellenIzQ1 = (await import('./quellen-bewerten.mjs')).quellenBefundIz(ornekBefunde[0]);
    const vQuellenAcik = yeniVaka({
      bekci: 'quellen',
      baslik: 'Kaynak q1',
      ek: { quelleId: 'q1', iz: quellenIzQ1 },
      simdi: new Date('2026-11-24T10:00:00Z'),
      mevcutIdler: [vPreiseAcik.id],
    });
    await (await import('./vaka.mjs')).kaydet(varOlanDizin, vQuellenAcik);

    const outQ2 = execFileSync(
      process.execPath,
      [
        cliPath,
        'acik-iz',
        `--dizin=${varOlanDizin}`,
        '--bekci=quellen',
        `--befunde-in=${befundeInDosya}`,
        `--befunde-out=${befundeOutDosya}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert.equal(outQ2.trim(), 'kalan=1');
    const outQ2Icerik = JSON.parse(await readFile(befundeOutDosya, 'utf-8'));
    assert.equal(outQ2Icerik.length, 1);
    assert.equal(outQ2Icerik[0].id, 'q2');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});


