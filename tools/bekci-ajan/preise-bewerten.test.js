// tools/bekci-ajan/preise-bewerten.test.js
// Ne: preise-bewerten.mjs birim testleri (en az 14 senaryo).
// Niye: SPEC.md §2 ve §3.0 gereksinimlerini (sessiz, auto, vaka durumları, çift dikiş
// doğrulama, sıkı şema ihlalleri, satır biçimlendirme ve kesme, ek içeriği, CLI) doğrulamak.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bewerte, kararGecerliMi, preiseIz } from './preise-bewerten.mjs';

function ornekGecerliKarar(overrides = {}) {
  return {
    tur: 'sprung_belegt',
    guven: 'hoch',
    ozet: 'Podoloji fiyat sıçraması resmî sözleşme ile doğrulandı.',
    okunan_rakamlar: [
      {
        code: '78010',
        preis: 37.2,
        zuzahlung: 3.72,
        gueltig_ab: '2027-01-01',
        quelle: 'wissensbank/podologie/anlage2.txt',
        zeile: 120,
      },
      {
        code: '78020',
        preis: 42.5,
        zuzahlung: null,
        gueltig_ab: '2027-01-01',
        quelle: 'wissensbank/podologie/anlage2.txt',
        zeile: 125,
      },
    ],
    neue_positionen: [],
    erlaube_sprung: ['78010', '78020'],
    warnungen: [],
    ...overrides,
  };
}

function ornekBericht(overrides = {}) {
  return {
    stand: '2026-11-24',
    needsReview: [
      {
        art: 'sprung',
        grund: '78010 ve 78020 için %15 üzeri fiyat sıçraması algılandı',
        bereich: 'podologie',
        details: [
          {
            bereich: 'podologie',
            xmlGueltigAb: '2027-01-01',
            sprungCodes: [
              { code: '78010', altPreis: 32.0, neuPreis: 37.2, prozent: 16.25 },
              { code: '78020', altPreis: 35.0, neuPreis: 42.5, prozent: 21.43 },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

test('1. sessiz: needsReview boş veya yok', () => {
  const res1 = bewerte({ bericht: { needsReview: [] }, karar: ornekGecerliKarar() });
  assert.equal(res1.karar, 'sessiz');
  assert.deepEqual(res1.erlaubeSprung, []);
  assert.equal(res1.vaka, null);
  assert.deepEqual(res1.gruende, []);

  const res2 = bewerte({ bericht: {}, karar: null });
  assert.equal(res2.karar, 'sessiz');
  assert.equal(res2.vaka, null);

  const res3 = bewerte({ bericht: null, karar: null });
  assert.equal(res3.karar, 'sessiz');
  assert.equal(res3.vaka, null);
});

test('2. tam auto (iki kod): tüm şartlar uyuşuyor', () => {
  const bericht = ornekBericht();
  const karar = ornekGecerliKarar();

  const res = bewerte({ bericht, karar });
  assert.equal(res.karar, 'auto');
  assert.deepEqual(res.erlaubeSprung, ['78010', '78020']);
  assert.equal(res.vaka, null);
  assert.deepEqual(res.gruende, []);
  assert.ok(Array.isArray(res.rapor));
  assert.ok(res.rapor.some(s => s.includes('78010')));
  assert.ok(res.rapor.some(s => s.includes('78020')));
});

test('3. auto: bir kodun preis’i 1 sent farklı → vaka', () => {
  const bericht = ornekBericht();
  const karar = ornekGecerliKarar({
    okunan_rakamlar: [
      {
        code: '78010',
        preis: 37.21, // XML 37.20 idi, 1 sent farklı
        zuzahlung: 3.72,
        gueltig_ab: '2027-01-01',
        quelle: 'wissensbank/podologie/anlage2.txt',
        zeile: 120,
      },
      {
        code: '78020',
        preis: 42.5,
        zuzahlung: null,
        gueltig_ab: '2027-01-01',
        quelle: 'wissensbank/podologie/anlage2.txt',
        zeile: 125,
      },
    ],
  });

  const res = bewerte({ bericht, karar });
  assert.equal(res.karar, 'vaka');
  assert.deepEqual(res.erlaubeSprung, []);
  assert.ok(res.vaka);
  assert.ok(res.gruende.some(g => g.includes('78010 fiyatı XML\'den farklı: 37.21 ≠ 37.20')));
  // c ve d sağlanmadığı için ek.erlaubeSprung boş olmalı
  assert.deepEqual(res.vaka.ek.erlaubeSprung, []);
});

test('4. tarih farklı → vaka', () => {
  const bericht = ornekBericht();
  const karar = ornekGecerliKarar({
    okunan_rakamlar: [
      {
        code: '78010',
        preis: 37.2,
        zuzahlung: 3.72,
        gueltig_ab: '2027-02-01', // XML 2027-01-01 idi
        quelle: 'wissensbank/podologie/anlage2.txt',
        zeile: 120,
      },
      {
        code: '78020',
        preis: 42.5,
        zuzahlung: null,
        gueltig_ab: '2027-01-01',
        quelle: 'wissensbank/podologie/anlage2.txt',
        zeile: 125,
      },
    ],
  });

  const res = bewerte({ bericht, karar });
  assert.equal(res.karar, 'vaka');
  assert.ok(res.gruende.some(g => g.includes('78010 tarihi XML\'den farklı: 2027-02-01 ≠ 2027-01-01')));
});

test('5. erlaube_sprung eksik/fazla kod → vaka', () => {
  const bericht = ornekBericht();

  // Eksik kod: yalnız 78010 izinli, 78020 eksik
  const resEksik = bewerte({
    bericht,
    karar: ornekGecerliKarar({ erlaube_sprung: ['78010'] }),
  });
  assert.equal(resEksik.karar, 'vaka');
  assert.ok(resEksik.gruende.some(g => g.includes('eksik kodlar var: 78020')));

  // Fazla kod: 78030 fazla
  const resFazla = bewerte({
    bericht,
    karar: ornekGecerliKarar({ erlaube_sprung: ['78010', '78020', '78030'] }),
  });
  assert.equal(resFazla.karar, 'vaka');
  assert.ok(resFazla.gruende.some(g => g.includes('fazla kodlar var: 78030')));
});

test('6. guven mittel → vaka', () => {
  const bericht = ornekBericht();
  const res = bewerte({
    bericht,
    karar: ornekGecerliKarar({ guven: 'mittel' }),
  });
  assert.equal(res.karar, 'vaka');
  assert.ok(res.gruende.some(g => g.includes('güven derecesi \'hoch\' değil: mittel')));
});

test('7. warnungen dolu → vaka', () => {
  const bericht = ornekBericht();
  const res = bewerte({
    bericht,
    karar: ornekGecerliKarar({ warnungen: ['Kaynak metinde belirsiz satır'] }),
  });
  assert.equal(res.karar, 'vaka');
  assert.ok(res.gruende.some(g => g.includes('uyarılar mevcut')));
});

test('8. sprung + neue_codes karışık → vaka', () => {
  const bericht = {
    stand: '2026-11-24',
    needsReview: [
      {
        art: 'sprung',
        grund: '78010 sıçrama',
        bereich: 'podologie',
        details: [
          {
            sprungCodes: [{ code: '78010', altPreis: 30, neuPreis: 37.2, prozent: 24, xmlGueltigAb: '2027-01-01' }],
          },
        ],
      },
      {
        art: 'neue_codes',
        grund: 'Yeni kod 78099 eklendi',
        bereich: 'podologie',
      },
    ],
  };

  const res = bewerte({
    bericht,
    karar: ornekGecerliKarar({ erlaube_sprung: ['78010'] }),
  });

  assert.equal(res.karar, 'vaka');
  assert.ok(res.gruende.some(g => g.includes('needsReview içinde sprung dışında maddeler var: neue_codes')));
  assert.equal(res.vaka.baslik, 'Fiyat: büyük fiyat sıçraması (+1 konu)');
  assert.ok(res.vaka.ek.artlar.includes('neue_codes'));
});

test('9. karar null → vaka + Ajan çalışmadı.', () => {
  const bericht = ornekBericht();
  const res = bewerte({ bericht, karar: null });

  assert.equal(res.karar, 'vaka');
  assert.equal(res.vaka.oneri, 'Ajan çalışmadı.');
  assert.ok(res.gruende.includes('Ajan çalışmadı.'));
});

test('10. şema ihlalleri: kararGecerliMi sıkı kontrolleri', () => {
  // Fazla anahtar
  const resFazla = kararGecerliMi({ ...ornekGecerliKarar(), bilinmeyen_alan: 123 });
  assert.equal(resFazla.ok, false);
  assert.ok(resFazla.hatalar.some(h => h.includes('beklenmeyen fazla anahtar')));

  // quelle içinde ../ (path traversal)
  const resQuelle = kararGecerliMi(
    ornekGecerliKarar({
      okunan_rakamlar: [
        {
          code: '78010',
          preis: 37.2,
          zuzahlung: null,
          gueltig_ab: '2027-01-01',
          quelle: 'wissensbank/../../etc/passwd',
          zeile: 1,
        },
      ],
    })
  );
  assert.equal(resQuelle.ok, false);
  assert.ok(resQuelle.hatalar.some(h => h.includes('quelle geçersiz')));

  // preis 3 ondalık (37.205)
  const resPreis = kararGecerliMi(
    ornekGecerliKarar({
      okunan_rakamlar: [
        {
          code: '78010',
          preis: 37.205,
          zuzahlung: null,
          gueltig_ab: '2027-01-01',
          quelle: 'wissensbank/podologie/a.txt',
          zeile: 1,
        },
      ],
    })
  );
  assert.equal(resPreis.ok, false);
  assert.ok(resPreis.hatalar.some(h => h.includes('preis geçersiz')));

  // geçersiz tarih 2027-02-30
  const resTarih = kararGecerliMi(
    ornekGecerliKarar({
      okunan_rakamlar: [
        {
          code: '78010',
          preis: 37.2,
          zuzahlung: null,
          gueltig_ab: '2027-02-30',
          quelle: 'wissensbank/podologie/a.txt',
          zeile: 1,
        },
      ],
    })
  );
  assert.equal(resTarih.ok, false);
  assert.ok(resTarih.hatalar.some(h => h.includes('gueltig_ab geçersiz')));

  // code küçük harf
  const resCode = kararGecerliMi(
    ornekGecerliKarar({
      okunan_rakamlar: [
        {
          code: 'x8010', // küçük x
          preis: 37.2,
          zuzahlung: null,
          gueltig_ab: '2027-01-01',
          quelle: 'wissensbank/podologie/a.txt',
          zeile: 1,
        },
      ],
    })
  );
  assert.equal(resCode.ok, false);
  assert.ok(resCode.hatalar.some(h => h.includes('code geçersiz')));

  // geçersiz karar ile bewerte çağrıldığında oneri: "Ajan çıktısı geçersiz: <ilk 3 hata>"
  const resVaka = bewerte({
    bericht: ornekBericht(),
    karar: { ...ornekGecerliKarar(), bilinmeyen_alan: 123 },
  });
  assert.equal(resVaka.karar, 'vaka');
  assert.ok(resVaka.vaka.oneri.startsWith('Ajan çıktısı geçersiz:'));
});

test('11. satır biçimi ve ≤20 kesme kuralı', () => {
  // Çok sayıda satır üreten yapay bir needsReview
  const nrList = [];
  for (let i = 1; i <= 25; i++) {
    nrList.push({
      art: 'sprung',
      grund: `Sıçrama sebebi test ${i}`,
      bereich: 'podologie',
      details: [
        {
          sprungCodes: [
            { code: `780${i < 10 ? '0' + i : i}`, altPreis: 10, neuPreis: 20, prozent: 100, xmlGueltigAb: '2027-01-01' },
          ],
        },
      ],
    });
  }

  const res = bewerte({
    bericht: { stand: '2026-11-24', needsReview: nrList },
    karar: null,
  });

  assert.equal(res.karar, 'vaka');
  assert.ok(res.vaka.satirlar.length <= 20, `Satır sayısı 20'yi aşamaz, bulundu: ${res.vaka.satirlar.length}`);
  const sonSatir = res.vaka.satirlar.at(-1);
  assert.ok(sonSatir.startsWith('… (+'), `Son satır kesme formatında olmalı: ${sonSatir}`);
});

test('12. ek içeriği: c ve d sağlandığında kod listesi, aksi halde boş', () => {
  // 1. c ve d sağlandı ama başka bir sebeple vaka oldu (ör. guven: 'mittel')
  const bericht = ornekBericht();
  const res1 = bewerte({
    bericht,
    karar: ornekGecerliKarar({ guven: 'mittel' }),
  });
  assert.equal(res1.karar, 'vaka');
  assert.equal(res1.vaka.ek.stand, '2026-11-24');
  assert.deepEqual(res1.vaka.ek.erlaubeSprung, ['78010', '78020']);
  assert.deepEqual(res1.vaka.ek.artlar, ['sprung']);

  // 2. c ve d sağlanmadı (rakamlar uyuşmuyor)
  const res2 = bewerte({
    bericht,
    karar: ornekGecerliKarar({
      okunan_rakamlar: [
        {
          code: '78010',
          preis: 99.99, // Farklı
          zuzahlung: null,
          gueltig_ab: '2027-01-01',
          quelle: 'wissensbank/podologie/a.txt',
          zeile: 1,
        },
        {
          code: '78020',
          preis: 42.5,
          zuzahlung: null,
          gueltig_ab: '2027-01-01',
          quelle: 'wissensbank/podologie/a.txt',
          zeile: 2,
        },
      ],
    }),
  });
  assert.equal(res2.karar, 'vaka');
  assert.deepEqual(res2.vaka.ek.erlaubeSprung, [], 'Uyuşmazlık durumunda ek.erlaubeSprung boş olmalıdır');
});

test('13. dosya listesi: bereich eşleşmesi', () => {
  const resPod = bewerte({
    bericht: {
      needsReview: [{ art: 'sprung', bereich: 'podologie', details: [] }],
    },
    karar: null,
  });
  assert.deepEqual(resPod.vaka.dosyalar, ['api-backend/billing/codes/podologie_positions.js']);

  const resPhysio = bewerte({
    bericht: {
      needsReview: [{ art: 'sprung', bereich: 'physiotherapie', details: [] }],
    },
    karar: null,
  });
  assert.deepEqual(resPhysio.vaka.dosyalar, ['api-backend/billing/codes/physio_positions.js']);
});

test('14. CLI doğrudan çalışınca doğru davranıyor, import edilince çalışmıyor', async () => {
  // Test dosyası preise-bewerten.mjs'i import etti ve CLI otomatik çalışmadı (exit olmadı, buradayız).
  assert.ok(typeof bewerte === 'function');

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'preise-cli-test-'));
  const scriptPath = path.resolve(fileURLToPath(import.meta.url), '../preise-bewerten.mjs');

  try {
    const bPath = path.join(tmpDir, 'bericht.json');
    const kPath = path.join(tmpDir, 'karar.json');
    const oPath = path.join(tmpDir, 'out.json');

    await writeFile(bPath, JSON.stringify(ornekBericht()), 'utf-8');
    await writeFile(kPath, JSON.stringify(ornekGecerliKarar()), 'utf-8');

    // Başarılı auto senaryosu CLI
    const cpAuto = spawnSync(process.execPath, [scriptPath, `--bericht=${bPath}`, `--karar=${kPath}`, `--out=${oPath}`], {
      encoding: 'utf-8',
    });
    assert.equal(cpAuto.status, 0);
    assert.equal(cpAuto.stdout.trim(), 'karar: auto');

    const outJson = JSON.parse(await readFile(oPath, 'utf-8'));
    assert.equal(outJson.karar, 'auto');
    assert.deepEqual(outJson.erlaubeSprung, ['78010', '78020']);

    // Karar dosyası bozuk veya yokken CLI: exit 0 ve karar: vaka
    const cpNoKarar = spawnSync(process.execPath, [scriptPath, `--bericht=${bPath}`, `--karar=olmayan.json`], {
      encoding: 'utf-8',
    });
    assert.equal(cpNoKarar.status, 0);
    assert.equal(cpNoKarar.stdout.trim(), 'karar: vaka');

    // Bericht dosyası okunamazsa CLI: exit 1
    const cpFail = spawnSync(process.execPath, [scriptPath, `--bericht=olmayan_bericht.json`], {
      encoding: 'utf-8',
    });
    assert.equal(cpFail.status, 1);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('15. iz kararlılığı: kod sırası farklı needsReview aynı vaka.ek.iz üretir', () => {
  const b1 = {
    stand: '2026-11-24',
    needsReview: [
      {
        art: 'sprung',
        grund: 'Sıçrama',
        bereich: 'podologie',
        details: [
          {
            xmlGueltigAb: '2027-01-01',
            sprungCodes: [
              { code: '78010', altPreis: 30, neuPreis: 37.2, prozent: 24 },
              { code: '78020', altPreis: 35, neuPreis: 42.5, prozent: 21 },
            ],
          },
        ],
      },
    ],
  };

  const b2 = {
    stand: '2026-11-24',
    needsReview: [
      {
        art: 'sprung',
        grund: 'Sıçrama',
        bereich: 'podologie',
        details: [
          {
            xmlGueltigAb: '2027-01-01',
            sprungCodes: [
              { code: '78020', altPreis: 35, neuPreis: 42.5, prozent: 21 },
              { code: '78010', altPreis: 30, neuPreis: 37.2, prozent: 24 },
            ],
          },
        ],
      },
    ],
  };

  const res1 = bewerte({ bericht: b1, karar: null });
  const res2 = bewerte({ bericht: b2, karar: null });

  assert.ok(res1.vaka);
  assert.ok(res2.vaka);
  assert.equal(res1.vaka.ek.iz.length, 16);
  assert.equal(res1.vaka.ek.iz, res2.vaka.ek.iz);
});

test('16. ajan metni değişince iz değişmiyor (aynı bericht, farklı karar.ozet / null)', () => {
  const bericht = ornekBericht();
  const k1 = ornekGecerliKarar({ ozet: 'Ajan ilk özeti yazdı' });
  const k2 = ornekGecerliKarar({ ozet: 'Ajan tamamen farklı ikinci özeti yazdı' });

  // İkisi de vaka durumuna düşsün diye güveni mittel yapalım
  k1.guven = 'mittel';
  k2.guven = 'mittel';

  const res1 = bewerte({ bericht, karar: k1 });
  const res2 = bewerte({ bericht, karar: k2 });
  const resNull = bewerte({ bericht, karar: null });

  assert.ok(res1.vaka);
  assert.ok(res2.vaka);
  assert.ok(resNull.vaka);
  assert.equal(res1.vaka.ek.iz, res2.vaka.ek.iz);
  assert.equal(res1.vaka.ek.iz, resNull.vaka.ek.iz);
});

test('17. bericht.stand değişince iz değişmiyor', () => {
  const b1 = ornekBericht({ stand: '2026-11-24' });
  const b2 = ornekBericht({ stand: '2026-11-25' });

  const res1 = bewerte({ bericht: b1, karar: null });
  const res2 = bewerte({ bericht: b2, karar: null });

  assert.equal(res1.vaka.ek.iz, res2.vaka.ek.iz);
});

test('18. XML fiyatı değişince iz değişiyor', () => {
  const b1 = ornekBericht();
  const b2 = {
    stand: '2026-11-24',
    needsReview: [
      {
        art: 'sprung',
        grund: 'Sıçrama',
        bereich: 'podologie',
        details: [
          {
            xmlGueltigAb: '2027-01-01',
            sprungCodes: [
              { code: '78010', altPreis: 32.0, neuPreis: 38.0, prozent: 18.75 }, // 37.2 yerine 38.0
              { code: '78020', altPreis: 35.0, neuPreis: 42.5, prozent: 21.43 },
            ],
          },
        ],
      },
    ],
  };

  const res1 = bewerte({ bericht: b1, karar: null });
  const res2 = bewerte({ bericht: b2, karar: null });

  assert.notEqual(res1.vaka.ek.iz, res2.vaka.ek.iz);
});

test('20. K1: vaka kararında erlaubeSprung dolu ise üst düzey erlaubeSprung ve ek.uygulanabilir true döner', () => {
  const bericht = ornekBericht();
  // guven: 'mittel' vaka açtırır ama c ve d sağlandığı için erlaubeSprung doludur
  const res = bewerte({
    bericht,
    karar: ornekGecerliKarar({ guven: 'mittel' }),
  });

  assert.equal(res.karar, 'vaka');
  assert.deepEqual(res.erlaubeSprung, ['78010', '78020'], 'Üst düzey erlaubeSprung boş olmamalı');
  assert.deepEqual(res.vaka.ek.erlaubeSprung, ['78010', '78020']);
  assert.equal(res.vaka.ek.uygulanabilir, true);

  // Sayı uyuşmazlığında ise boş olmalı ve uygulanabilir false
  const resUyuşmaz = bewerte({
    bericht,
    karar: ornekGecerliKarar({
      okunan_rakamlar: [
        {
          code: '78010',
          preis: 999.0, // Yanlış fiyat
          zuzahlung: null,
          gueltig_ab: '2027-01-01',
          quelle: 'wissensbank/podologie/a.txt',
          zeile: 1,
        },
      ],
    }),
  });

  assert.equal(resUyuşmaz.karar, 'vaka');
  assert.deepEqual(resUyuşmaz.erlaubeSprung, []);
  assert.deepEqual(resUyuşmaz.vaka.ek.erlaubeSprung, []);
  assert.equal(resUyuşmaz.vaka.ek.uygulanabilir, false);
});

test('21. M7: preiseIz ajan metninden bağımsızdır ve neue_codes kodlarını toplar', () => {
  const bNeue1 = {
    stand: '2026-11-24',
    needsReview: [
      {
        art: 'neue_codes',
        grund: 'podologie: yeni kodlar bulundu',
        details: {
          zusaetzlich: ['78099'],
        },
      },
    ],
  };

  const bNeue2 = {
    stand: '2026-11-25', // Farklı stand
    needsReview: [
      {
        art: 'neue_codes',
        grund: 'podologie: yeni kodlar bulundu',
        details: {
          zusaetzlich: ['78099', '78098'], // Ekstra kod eklendi
        },
      },
    ],
  };

  const iz1 = preiseIz(bNeue1);
  const iz2 = preiseIz(bNeue2);
  assert.equal(iz1.length, 16);
  assert.equal(iz2.length, 16);
  assert.notEqual(iz1, iz2, 'Yeni kod eklenince iz değişmelidir');

  // Farklı ajan çıktısı veya karar null olsa da aynı bericht için iz aynıdır
  const resA = bewerte({ bericht: bNeue1, karar: null });
  const resB = bewerte({
    bericht: bNeue1,
    karar: ornekGecerliKarar({ ozet: 'Tamamen farklı ajan özeti' }),
  });
  assert.equal(resA.vaka.ek.iz, iz1);
  assert.equal(resB.vaka.ek.iz, iz1);
});
