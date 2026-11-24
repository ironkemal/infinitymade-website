// tools/bekci-ajan/quellen-bewerten.test.js
// Ne: quellen-bewerten.mjs için kapsamlı birim testleri (en az 10 test).
// Niye: SPEC.md ve görev tanımı uyarınca sıkı şema denetimleri, tam otomatik / vaka kararları,
// kritik kaynak korkulukları, eksik/kesik belge durumları, deterministik satır biçimi ve CLI doğrulanması.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  kararGecerliMi,
  bewerte,
  urlEslesiyorMu,
  urlSonParca,
  gecerliTarihMi,
  quellenBefundIz,
} from './quellen-bewerten.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, 'quellen-bewerten.mjs');

function ornekBefunde() {
  return [
    {
      id: 'gkv-anlage2',
      ref: 'GKV Anlage 2',
      wichtig: 'normal',
      ne: 'Yeni fiyat listesi ve teşhis ekleri',
      url: 'https://www.gkv-spitzenverband.de/heilmittel',
      folge: 'Faturalar reddedilebilir',
      neu: ['www.gkv-spitzenverband.de/downloads/anlage2_2027.pdf'],
      weg: [],
    },
  ];
}

function ornekGecerliKarar() {
  return {
    belgeler: [
      {
        quelle_id: 'gkv-anlage2',
        url: 'https://www.gkv-spitzenverband.de/downloads/anlage2_2027.pdf',
        ne_degisti: 'Podoloji için geçerli değil, yalnızca işitme cihazı listesi güncellenmiş.',
        etki: 'yok',
        gecerlilik: '2027-01-01',
        etkilenen_dosyalar: ['api-backend/billing/codes/podologie_positions.js'],
        oneri: 'biliniyor',
        guven: 'hoch',
      },
    ],
    ozet: 'Bizi etkileyen bir değişiklik yok, otomatik biliniyor işaretlenebilir.',
    warnungen: [],
  };
}

function ornekIndeks() {
  return [
    {
      quelleId: 'gkv-anlage2',
      url: 'https://www.gkv-spitzenverband.de/downloads/anlage2_2027.pdf',
      dosya: '01.txt',
      bayt: 12500,
      sha256: 'a'.repeat(64),
      tur: 'pdf',
      kisaltildi: false,
      not: null,
      atlandi: null,
    },
  ];
}

// 1. Tam otomatik (kritik olmayan)
test('1. Tam otomatik: kritik olmayan, karar geçerli, etki yok, oneri biliniyor, guven hoch', () => {
  const befunde = ornekBefunde();
  const karar = ornekGecerliKarar();
  const indeks = ornekIndeks();

  const sonuc = bewerte({ befunde, karar, indeks });

  assert.deepEqual(sonuc.otomatik, ['gkv-anlage2']);
  assert.equal(sonuc.vakalar.length, 0);
  assert.equal(sonuc.rapor.length, 1);
  assert.ok(sonuc.rapor[0].startsWith('✓ gkv-anlage2: 1 yeni belge — ajan: bizi etkilemiyor'));
  assert.ok(sonuc.rapor[0].includes('Podoloji için geçerli değil'));
});

// 2. Kritik kaynak her zaman vaka
test('2. Kritik kaynak (wichtig=kritisch) her zaman vaka açar (otomatik olamaz)', () => {
  const befunde = ornekBefunde();
  befunde[0].wichtig = 'kritisch';
  const karar = ornekGecerliKarar();
  const indeks = ornekIndeks();

  const sonuc = bewerte({ befunde, karar, indeks });

  assert.equal(sonuc.otomatik.length, 0);
  assert.equal(sonuc.vakalar.length, 1);
  const v = sonuc.vakalar[0];
  assert.equal(v.bekci, 'quellen');
  assert.equal(v.baslik, '‼️ Kaynak: gkv-anlage2');
  assert.ok(v.satirlar.some(s => s.includes('(kritisch)')));
  assert.ok(sonuc.gruende.includes('kaynak kritik'));
});

// 3. Bir belge etki: dusuk -> vaka
test('3. Bir belge etki: dusuk olduğunda vaka açılır', () => {
  const befunde = ornekBefunde();
  const karar = ornekGecerliKarar();
  karar.belgeler[0].etki = 'dusuk';
  const indeks = ornekIndeks();

  const sonuc = bewerte({ befunde, karar, indeks });

  assert.equal(sonuc.otomatik.length, 0);
  assert.equal(sonuc.vakalar.length, 1);
  assert.equal(sonuc.vakalar[0].baslik, 'Kaynak: gkv-anlage2');
  assert.ok(sonuc.gruende.some(g => g.includes('etki=dusuk')));
});

// 4. Eksik belge kaydı -> vaka
test('4. Kaynağın neu/weg öğelerinden biri kararda eksikse vaka açılır', () => {
  const befunde = ornekBefunde();
  befunde[0].neu.push('www.gkv-spitzenverband.de/downloads/ikinci_belge.pdf');
  const karar = ornekGecerliKarar(); // Sadece birinci belge var
  const indeks = ornekIndeks();

  const sonuc = bewerte({ befunde, karar, indeks });

  assert.equal(sonuc.otomatik.length, 0);
  assert.equal(sonuc.vakalar.length, 1);
  assert.ok(sonuc.gruende.includes('eksik belge kaydı'));
});

// 5. Kesik belge -> vaka
test('5. İndirilen belge kisaltildi: true olduğunda vaka açılır', () => {
  const befunde = ornekBefunde();
  const karar = ornekGecerliKarar();
  const indeks = ornekIndeks();
  indeks[0].kisaltildi = true;

  const sonuc = bewerte({ befunde, karar, indeks });

  assert.equal(sonuc.otomatik.length, 0);
  assert.equal(sonuc.vakalar.length, 1);
  assert.ok(sonuc.gruende.some(g => g.includes('kisaltildi=true')));
});

// 6. Şema ihlalleri: yabancı url, ../ dosya, fazla anahtar
test('6. Şema ihlalleri: kararGecerliMi sıkı kontrolleri', () => {
  const befunde = ornekBefunde();

  // Fazla kök anahtarı
  const resFazlaKok = kararGecerliMi(
    { ...ornekGecerliKarar(), ekstra_anahtar: 123 },
    befunde
  );
  assert.equal(resFazlaKok.ok, false);
  assert.ok(resFazlaKok.hatalar.some(h => h.includes('beklenmeyen fazla anahtar: ekstra_anahtar')));

  // Belgede fazla anahtar
  const kararFazlaBelge = ornekGecerliKarar();
  kararFazlaBelge.belgeler[0].bilinmeyen = 'test';
  const resFazlaBelge = kararGecerliMi(kararFazlaBelge, befunde);
  assert.equal(resFazlaBelge.ok, false);
  assert.ok(resFazlaBelge.hatalar.some(h => h.includes('beklenmeyen fazla anahtar: bilinmeyen')));

  // Yabancı URL (befund içinde olmayan URL)
  const kararYabanciUrl = ornekGecerliKarar();
  kararYabanciUrl.belgeler[0].url = 'https://www.gkv-spitzenverband.de/baska_bir_dosya.pdf';
  const resYabanci = kararGecerliMi(kararYabanciUrl, befunde);
  assert.equal(resYabanci.ok, false);
  assert.ok(resYabanci.hatalar.some(h => h.includes('neu/weg listesinde yok')));

  // Güvensiz dosya yolu: ../ içeren dosya
  const kararGecersizYol = ornekGecerliKarar();
  kararGecersizYol.belgeler[0].etkilenen_dosyalar = ['api-backend/../../../etc/passwd'];
  const resGecersizYol = kararGecerliMi(kararGecersizYol, befunde);
  assert.equal(resGecersizYol.ok, false);
  assert.ok(resGecersizYol.hatalar.some(h => h.includes('güvensiz dosya yolu')));

  // Mutlak yol / veya C:\
  const kararMutlak = ornekGecerliKarar();
  kararMutlak.belgeler[0].etkilenen_dosyalar = ['/var/log/test.js'];
  const resMutlak = kararGecerliMi(kararMutlak, befunde);
  assert.equal(resMutlak.ok, false);
  assert.ok(resMutlak.hatalar.some(h => h.includes('güvensiz dosya yolu')));
});

// 7. Karar yok -> Ajan çalışmadı.
test('7. Karar verilmediğinde (karar: null) vaka önerisi "Ajan çalışmadı." olur', () => {
  const befunde = ornekBefunde();
  const indeks = ornekIndeks();

  const sonuc = bewerte({ befunde, karar: null, indeks });

  assert.equal(sonuc.otomatik.length, 0);
  assert.equal(sonuc.vakalar.length, 1);
  assert.equal(sonuc.vakalar[0].oneri, 'Ajan çalışmadı.');
  assert.ok(sonuc.gruende.includes('Ajan çalışmadı.'));
});

// 8. Deterministik satır biçimi
test('8. Deterministik satır biçimi ve etiketli alanlar', () => {
  const befunde = [
    {
      id: 'gkv-anlage2',
      ref: 'GKV Anlage 2',
      wichtig: 'normal',
      ne: 'Fiyat ve kural listesi',
      url: 'https://www.gkv-spitzenverband.de/heilmittel',
      folge: 'Abrechnung durdurulur',
      neu: ['www.gkv-spitzenverband.de/downloads/yeni.pdf | 2026-11-24'],
      weg: ['www.gkv-spitzenverband.de/downloads/eski.pdf'],
    },
  ];

  const karar = {
    belgeler: [
      {
        quelle_id: 'gkv-anlage2',
        url: 'https://www.gkv-spitzenverband.de/downloads/yeni.pdf',
        ne_degisti: 'Yeni kural eklendi.',
        etki: 'orta',
        gecerlilik: '2027-01-01',
        etkilenen_dosyalar: ['module/billing.js'],
        oneri: 'incele',
        guven: 'mittel',
      },
      {
        quelle_id: 'gkv-anlage2',
        url: 'https://www.gkv-spitzenverband.de/downloads/eski.pdf',
        ne_degisti: 'Eski kural kalktı.',
        etki: 'yok',
        gecerlilik: null,
        etkilenen_dosyalar: [],
        oneri: 'biliniyor',
        guven: 'hoch',
      },
    ],
    ozet: 'Özet metin.',
    warnungen: [],
  };

  const indeks = [
    {
      quelleId: 'gkv-anlage2',
      url: 'https://www.gkv-spitzenverband.de/downloads/yeni.pdf',
      dosya: '01.txt',
      bayt: 500,
      sha256: 'b'.repeat(64),
      tur: 'pdf',
      kisaltildi: false,
      not: null,
      atlandi: null,
    },
  ];

  const sonuc = bewerte({ befunde, karar, indeks });
  assert.equal(sonuc.vakalar.length, 1);
  const v = sonuc.vakalar[0];

  assert.equal(v.satirlar[0], '• Kaynak: gkv-anlage2 (normal) · Fiyat ve kural listesi');
  assert.equal(v.satirlar[1], '  + yeni.pdf');
  assert.equal(v.satirlar[2], '  - eski.pdf');
  assert.equal(
    v.satirlar[3],
    '  ajan: etki=orta, öneri=incele, geçerlilik=2027-01-01, güven=mittel'
  );
  assert.equal(v.satirlar[4], '  dosya: module/billing.js');
  assert.equal(
    v.satirlar[5],
    '  ajan: etki=yok, öneri=biliniyor, geçerlilik=—, güven=hoch'
  );
  assert.equal(v.satirlar[6], '  Kaçırılırsa: Abrechnung durdurulur');

  assert.deepEqual(v.dosyalar, ['module/billing.js']);
  assert.equal(v.ek.quelleId, 'gkv-anlage2');
  assert.deepEqual(v.ek.neu, ['www.gkv-spitzenverband.de/downloads/yeni.pdf | 2026-11-24']);
  assert.deepEqual(v.ek.weg, ['www.gkv-spitzenverband.de/downloads/eski.pdf']);
});

// 9. İkili dosya indirildiğinde otomatik olamaz
test('9. İndirilen belge ikili/xlsx olduğunda vaka açılır', () => {
  const befunde = ornekBefunde();
  const karar = ornekGecerliKarar();
  const indeks = [
    {
      quelleId: 'gkv-anlage2',
      url: 'https://www.gkv-spitzenverband.de/downloads/anlage2_2027.pdf',
      dosya: null,
      bayt: 2000,
      sha256: 'c'.repeat(64),
      tur: 'xlsx',
      kisaltildi: false,
      not: 'ikili dosya, içerik okunmadı',
      atlandi: null,
    },
  ];

  const sonuc = bewerte({ befunde, karar, indeks });
  assert.equal(sonuc.otomatik.length, 0);
  assert.equal(sonuc.vakalar.length, 1);
  assert.ok(sonuc.gruende.some(g => g.includes('tur=xlsx')));
});

// 10. CLI çalıştırılması
test('10. CLI --befunde, --karar, --indeks ve --out ile doğru çalışır (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'quellen-bewerten-cli-'));
  const befundeFile = path.join(tempDir, 'befunde.json');
  const kararFile = path.join(tempDir, 'karar.json');
  const indeksFile = path.join(tempDir, 'indeks.json');
  const outFile = path.join(tempDir, 'entscheidung.json');

  try {
    await writeFile(befundeFile, JSON.stringify(ornekBefunde()), 'utf-8');
    await writeFile(kararFile, JSON.stringify(ornekGecerliKarar()), 'utf-8');
    await writeFile(indeksFile, JSON.stringify(ornekIndeks()), 'utf-8');

    const out = execFileSync(
      process.execPath,
      [
        cliPath,
        `--befunde=${befundeFile}`,
        `--karar=${kararFile}`,
        `--indeks=${indeksFile}`,
        `--out=${outFile}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    assert.equal(out.trim(), 'otomatik=1 vaka=0');

    const writtenJson = JSON.parse(await readFile(outFile, 'utf-8'));
    assert.deepEqual(writtenJson.otomatik, ['gkv-anlage2']);
    assert.equal(writtenJson.vakalar.length, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('11. her vakada ek.iz sha256(JSON.stringify([quelleId, sıralı neu, sıralı weg])) ilk 16 hanesidir', () => {
  const befunde = [
    {
      id: 'gkv-anlage2',
      ref: 'GKV Anlage 2',
      wichtig: 'normal',
      ne: 'Yeni fiyatlar',
      neu: ['www.gkv.de/b.pdf', 'www.gkv.de/a.pdf'],
      weg: ['www.gkv.de/eski.pdf'],
    },
  ];

  const sonuc = bewerte({ befunde, karar: null });
  assert.equal(sonuc.vakalar.length, 1);
  const v = sonuc.vakalar[0];

  assert.ok(v.ek?.iz);
  assert.equal(v.ek.iz.length, 16);
  assert.match(v.ek.iz, /^[0-9a-f]{16}$/);

  // Doğrudan sha256 hesabı ile karşılaştır
  const beklenen = createHash('sha256')
    .update(JSON.stringify(['gkv-anlage2', ['www.gkv.de/a.pdf', 'www.gkv.de/b.pdf'], ['www.gkv.de/eski.pdf']]))
    .digest('hex')
    .slice(0, 16);
  assert.equal(v.ek.iz, beklenen);
});

test('12. neu ve weg sırası karışık verilse bile sıralandığı için aynı ek.iz üretilir', () => {
  const b1 = [
    {
      id: 'gkv-anlage2',
      wichtig: 'normal',
      neu: ['www.gkv.de/2.pdf', 'www.gkv.de/1.pdf'],
      weg: ['www.gkv.de/y.pdf', 'www.gkv.de/x.pdf'],
    },
  ];

  const b2 = [
    {
      id: 'gkv-anlage2',
      wichtig: 'normal',
      neu: ['www.gkv.de/1.pdf', 'www.gkv.de/2.pdf'],
      weg: ['www.gkv.de/x.pdf', 'www.gkv.de/y.pdf'],
    },
  ];

  const res1 = bewerte({ befunde: b1, karar: null });
  const res2 = bewerte({ befunde: b2, karar: null });

  assert.equal(res1.vakalar[0].ek.iz, res2.vakalar[0].ek.iz);
});

test('13. neu veya weg listesi değiştiğinde ek.iz değişir', () => {
  const b1 = [{ id: 'gkv-anlage2', wichtig: 'normal', neu: ['a.pdf'], weg: [] }];
  const b2 = [{ id: 'gkv-anlage2', wichtig: 'normal', neu: ['b.pdf'], weg: [] }];
  const b3 = [{ id: 'gkv-anlage2', wichtig: 'normal', neu: ['a.pdf'], weg: ['c.pdf'] }];

  const res1 = bewerte({ befunde: b1, karar: null });
  const res2 = bewerte({ befunde: b2, karar: null });
  const res3 = bewerte({ befunde: b3, karar: null });

  assert.notEqual(res1.vakalar[0].ek.iz, res2.vakalar[0].ek.iz);
  assert.notEqual(res1.vakalar[0].ek.iz, res3.vakalar[0].ek.iz);
});

test('14. ajan önerisi veya özeti değişse bile ek.iz değişmez', () => {
  const befunde = [{ id: 'gkv-anlage2', wichtig: 'normal', neu: ['a.pdf'], weg: [] }];
  const k1 = {
    belgeler: [
      {
        quelle_id: 'gkv-anlage2',
        url: 'a.pdf',
        ne_degisti: 'İlk açıklama',
        etki: 'orta',
        gecerlilik: null,
        etkilenen_dosyalar: [],
        oneri: 'incele',
        guven: 'mittel',
      },
    ],
    ozet: 'İlk ajan özeti',
    warnungen: [],
  };

  const k2 = {
    belgeler: [
      {
        quelle_id: 'gkv-anlage2',
        url: 'a.pdf',
        ne_degisti: 'İkinci farklı açıklama',
        etki: 'orta',
        gecerlilik: null,
        etkilenen_dosyalar: [],
        oneri: 'incele',
        guven: 'mittel',
      },
    ],
    ozet: 'İkinci tamamen farklı ajan özeti',
    warnungen: [],
  };

  const res1 = bewerte({ befunde, karar: k1 });
  const res2 = bewerte({ befunde, karar: k2 });
  const resNull = bewerte({ befunde, karar: null });

  assert.equal(res1.vakalar[0].ek.iz, res2.vakalar[0].ek.iz);
  assert.equal(res1.vakalar[0].ek.iz, resNull.vakalar[0].ek.iz);
});

test('15. M4: quellen-bewerten her vakada ek.uygulanabilir true belirler', () => {
  const befunde = [
    {
      id: 'gkv-anlage2',
      wichtig: 'normal',
      ne: 'Anlage 2',
      neu: ['www.gkv.de/a.pdf'],
      weg: [],
    },
  ];

  const res = bewerte({ befunde, karar: null });
  assert.equal(res.vakalar.length, 1);
  assert.equal(res.vakalar[0].ek.uygulanabilir, true);
  assert.equal(res.vakalar[0].ek.iz, quellenBefundIz(befunde[0]));
});

test('16. L12(4): yalnız weg bulgusu olan kritik olmayan kaynakta otomatik biliniyor yerine vaka açılır', () => {
  const befund = {
    id: 'gkv-eski-dokuman',
    wichtig: 'normal',
    ne: 'Kaldırılan belge testi',
    url: 'https://www.gkv-spitzenverband.de/index.html',
    neu: [],
    weg: ['https://www.gkv-spitzenverband.de/eski.pdf'],
  };

  const karar = {
    belgeler: [
      {
        quelle_id: 'gkv-eski-dokuman',
        url: 'https://www.gkv-spitzenverband.de/eski.pdf',
        ne_degisti: 'Eski belge yayından kaldırıldı',
        etki: 'yok',
        gecerlilik: null,
        etkilenen_dosyalar: [],
        oneri: 'biliniyor',
        guven: 'hoch',
      },
    ],
    ozet: 'Belge kaldırılmış, bizi etkilemiyor',
    warnungen: [],
  };

  // Karar geçerli olmasına ve her belge etki: yok, oneri: biliniyor, guven: hoch olmasına rağmen
  // weg.length > 0 olduğu için otomatik olamaz, insana (vaka) gitmelidir.
  const res = bewerte({ befunde: [befund], karar, indeks: [] });
  assert.equal(res.otomatik.length, 0, 'Kaldırılan belgede otomatik biliniyor işaretlenemez');
  assert.equal(res.vakalar.length, 1, 'Yalnız weg bulgusunda vaka açılmalıdır');
  assert.equal(res.vakalar[0].ek.uygulanabilir, true);
  assert.ok(res.gruende.some(g => g.includes('kaldırılan belge var')));
});
