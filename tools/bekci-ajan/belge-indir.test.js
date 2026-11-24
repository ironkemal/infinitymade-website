// tools/bekci-ajan/belge-indir.test.js
// Ne: belge-indir.mjs modülü için kapsamlı birim testleri (en az 10 test).
// Niye: SPEC.md ve görev tanımı uyarınca PDF/HTML/XLSX indirme, izinli host denetimi,
// yönlendirme korkulukları, bayt ve belge sınırları, dosya adlandırması ve hata dayanıklılığının doğrulanması.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indir, htmlToText, tespitEtTur } from './belge-indir.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, 'belge-indir.mjs');

// 1. Sahte fetch ile PDF indirme ve metin çıkarma
test('1. Sahte fetch ile PDF indirme ve metin çıkarma', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-pdf-'));
  try {
    const fakeBuffer = Buffer.from('%PDF-1.4 test pdf stream');
    const sahteFetch = async (url) => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/pdf',
        'content-length': String(fakeBuffer.byteLength),
      }),
      arrayBuffer: async () => fakeBuffer.buffer,
    });

    const sahtePdfToText = async (buf) => 'Bu bir test PDF metnidir.';

    const befunde = [
      {
        id: 'g-ba-beschluss',
        neu: ['www.g-ba.de/downloads/123/beschluss.pdf'],
      },
    ];

    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
      pdfToText: sahtePdfToText,
    });

    assert.equal(index.length, 1);
    const item = index[0];
    assert.equal(item.quelleId, 'g-ba-beschluss');
    assert.equal(item.tur, 'pdf');
    assert.equal(item.dosya, '01.txt');
    assert.equal(item.kisaltildi, false);
    assert.equal(item.atlandi, null);
    assert.equal(item.not, null);

    const dosyaIcerik = await readFile(path.join(tempDir, '01.txt'), 'utf-8');
    assert.equal(dosyaIcerik, 'Bu bir test PDF metnidir.');

    const indexJsonIcerik = JSON.parse(await readFile(path.join(tempDir, 'index.json'), 'utf-8'));
    assert.deepEqual(indexJsonIcerik, index);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 2. Sahte fetch ile HTML indirme ve etiket temizleme
test('2. Sahte fetch ile HTML indirme ve etiket temizleme', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-html-'));
  try {
    const rawHtml = '<html><head><script>alert(1);</script><style>body {color:red;}</style></head><body><h1>Başlık</h1><p>Paragraf &amp; metin.</p></body></html>';
    const fakeBuffer = Buffer.from(rawHtml, 'utf-8');

    const sahteFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      arrayBuffer: async () => fakeBuffer.buffer,
    });

    const befunde = [
      {
        id: 'gkv-haber',
        neu: ['www.gkv-spitzenverband.de/news/1.html | 2026-11-24'],
      },
    ];

    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
    });

    assert.equal(index.length, 1);
    assert.equal(index[0].tur, 'html');
    assert.equal(index[0].dosya, '01.txt');

    const dosyaIcerik = await readFile(path.join(tempDir, '01.txt'), 'utf-8');
    assert.ok(!dosyaIcerik.includes('alert'));
    assert.ok(!dosyaIcerik.includes('body {color:red;}'));
    assert.ok(dosyaIcerik.includes('Başlık'));
    assert.ok(dosyaIcerik.includes('Paragraf & metin.'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 3. Sahte fetch ile XLSX/ikili dosya indirme
test('3. Sahte fetch ile XLSX/ikili dosya indirme (metin yok, not: ikili dosya)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-xlsx-'));
  try {
    const fakeBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // zip/xlsx magic

    const sahteFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      arrayBuffer: async () => fakeBuffer.buffer,
    });

    const befunde = [
      {
        id: 'kbv-liste',
        neu: ['www.kbv.de/tabelle.xlsx'],
      },
    ];

    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
    });

    assert.equal(index.length, 1);
    assert.equal(index[0].tur, 'xlsx');
    assert.equal(index[0].dosya, null);
    assert.equal(index[0].not, 'ikili dosya, içerik okunmadı');
    assert.equal(index[0].atlandi, null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 4. İzinsiz host atlama
test('4. İzinsiz host atlama (atlandi: host)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-host-'));
  try {
    let fetchCagirildi = false;
    const sahteFetch = async () => {
      fetchCagirildi = true;
      return { ok: true, status: 200 };
    };

    const befunde = [
      {
        id: 'zararli-kaynak',
        neu: ['https://kotu-site.example.com/zararli.pdf'],
      },
    ];

    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
    });

    assert.equal(fetchCagirildi, false);
    assert.equal(index.length, 1);
    assert.equal(index[0].atlandi, 'host');
    assert.equal(index[0].dosya, null);
    assert.equal(index[0].not, 'izinsiz host');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 5. İzinsiz yönlendirme atlama
test('5. İzinsiz yönlendirme (3xx sonrası izinli olmayan host atlandi: host, not: izinsiz yönlendirme)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-yonlendirme-'));
  try {
    const sahteFetch = async (url) => {
      if (url.includes('www.gkv-spitzenverband.de')) {
        return {
          ok: false,
          status: 302,
          headers: new Headers({
            location: 'https://izinsiz-hedef.example.org/dosya.pdf',
          }),
        };
      }
      return { ok: true, status: 200 };
    };

    const befunde = [
      {
        id: 'gkv-yonlendirme',
        neu: ['www.gkv-spitzenverband.de/yonlendir.html'],
      },
    ];

    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
    });

    assert.equal(index.length, 1);
    assert.equal(index[0].atlandi, 'host');
    assert.equal(index[0].not, 'izinsiz yönlendirme');
    assert.equal(index[0].dosya, null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 6. Bayt sınırı aşımı
test('6. Bayt sınırı aşımı (kisaltildi: true, içerik okunmaz)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-bayt-'));
  try {
    const fakeBuffer = Buffer.alloc(500);

    const sahteFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/pdf',
        'content-length': '500',
      }),
      arrayBuffer: async () => fakeBuffer.buffer,
    });

    const befunde = [
      {
        id: 'buyuk-dosya',
        neu: ['www.g-ba.de/buyuk.pdf'],
      },
    ];

    // Sınırı 100 bayt olarak belirliyoruz
    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
      sinir: { bayt: 100 },
    });

    assert.equal(index.length, 1);
    assert.equal(index[0].kisaltildi, true);
    assert.equal(index[0].dosya, null);
    assert.equal(index[0].not, 'bayt sınırı aşıldı');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 7. Belge sınırı
test('7. Belge sınırı (sinir.belge aşılınca fazlası atlandi: sinir)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-sinir-'));
  try {
    const fakeBuffer = Buffer.from('<html>icerik</html>');
    const sahteFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: async () => fakeBuffer.buffer,
    });

    const befunde = [
      {
        id: 'cok-belge',
        neu: [
          'www.gkv-spitzenverband.de/1.html',
          'www.gkv-spitzenverband.de/2.html',
          'www.gkv-spitzenverband.de/3.html',
        ],
      },
    ];

    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
      sinir: { belge: 2 },
    });

    assert.equal(index.length, 3);
    assert.equal(index[0].atlandi, null);
    assert.equal(index[0].dosya, '01.txt');
    assert.equal(index[1].atlandi, null);
    assert.equal(index[1].dosya, '02.txt');
    assert.equal(index[2].atlandi, 'sinir');
    assert.equal(index[2].dosya, null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 8. Dosya adlarının NN.txt olması
test('8. Dosya adları NN.txt (01.txt, 02.txt...) formatında ardışık üretilir', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-nn-'));
  try {
    const fakeBuffer = Buffer.from('metin');
    const sahteFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: async () => fakeBuffer.buffer,
    });

    const befunde = [
      {
        id: 'kaynak-1',
        neu: ['www.bfarm.de/a.html', 'www.bfarm.de/b.html'],
      },
    ];

    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
    });

    assert.equal(index[0].dosya, '01.txt');
    assert.equal(index[1].dosya, '02.txt');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 9. pdfToText hatası durumunda akış durmaz
test('9. pdfToText hatasında öğe not ile döner ve sonraki belgeler işlenmeye devam eder', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-hata-'));
  try {
    const fakeBuffer = Buffer.from('%PDF bozuk');
    const sahteFetch = async (url) => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      arrayBuffer: async () => fakeBuffer.buffer,
    });

    const sahtePdfToText = async (buf) => {
      throw new Error('PDF parsing failed');
    };

    const befunde = [
      {
        id: 'hatali-pdf',
        neu: ['www.g-ba.de/bozuk.pdf'],
      },
    ];

    const index = await indir({
      befunde,
      hedefDizin: tempDir,
      fetch: sahteFetch,
      pdfToText: sahtePdfToText,
    });

    assert.equal(index.length, 1);
    assert.equal(index[0].dosya, null);
    assert.ok(index[0].not.includes('PDF parsing failed'));
    assert.equal(index[0].tur, 'pdf');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

// 10. CLI alt süreç testi (--json ve --out bayrakları)
test('10. CLI alt süreci --json ve --out ile başarıyla çalışır (exit 0)', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'indir-cli-'));
  const quellenFile = path.join(tempDir, 'quellen.json');
  const outDir = path.join(tempDir, 'belgeler');

  try {
    const befunde = [
      {
        id: 'kaynak-cli',
        neu: ['https://kotu-site.example.com/test.pdf'], // İzinli host olmadığı için indirmeden atlar
      },
    ];
    await (await import('node:fs/promises')).writeFile(
      quellenFile,
      JSON.stringify({ befunde }),
      'utf-8'
    );

    execFileSync(
      process.execPath,
      [cliPath, `--json=${quellenFile}`, `--out=${outDir}`],
      { stdio: 'pipe' }
    );

    const indexIcerik = JSON.parse(await readFile(path.join(outDir, 'index.json'), 'utf-8'));
    assert.equal(indexIcerik.length, 1);
    assert.equal(indexIcerik[0].atlandi, 'host');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
