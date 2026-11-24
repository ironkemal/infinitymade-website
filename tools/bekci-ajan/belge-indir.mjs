// tools/bekci-ajan/belge-indir.mjs
// Ne: Kaynak bekçisi belge indirme ve metin çıkarma modülü (CLI + kütüphane).
// Niye: SPEC.md §4 uyarınca quellen-waechter bulgularındaki yeni belgeleri izinli hostlardan
// indirip PDF/HTML'den metin ayıklar, boyut sınırlarını ve dosya adlandırma güvenliğini sağlar.

import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { hostErlaubt } from '../quellen-waechter.mjs';

/**
 * pdftotext alt süreci ile PDF verisinden metin çıkarır (60 sn zaman aşımı, shell yok).
 * @param {Buffer} buffer
 * @returns {string}
 */
export function defaultPdfToText(buffer) {
  return execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', '-', '-'], {
    input: buffer,
    encoding: 'utf-8',
    timeout: 60_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * HTML metninden script/style bloklarını ve etiketleri temizler.
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * URL ve Content-Type bilgisine göre dosya türünü tespit eder.
 * @param {string} urlStr
 * @param {string} [contentType]
 * @returns {'pdf' | 'html' | 'xlsx' | 'zip' | 'ikili'}
 */
export function tespitEtTur(urlStr, contentType = '') {
  const ct = String(contentType || '').toLowerCase();
  let pathname = '';
  try {
    pathname = new URL(urlStr).pathname.toLowerCase();
  } catch {}

  if (ct.includes('application/pdf') || pathname.endsWith('.pdf')) {
    return 'pdf';
  }
  if (ct.includes('text/html') || pathname.endsWith('.html') || pathname.endsWith('.htm')) {
    return 'html';
  }
  if (
    ct.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
    ct.includes('application/vnd.ms-excel') ||
    pathname.endsWith('.xlsx') ||
    pathname.endsWith('.xls')
  ) {
    return 'xlsx';
  }
  if (ct.includes('application/zip') || pathname.endsWith('.zip')) {
    return 'zip';
  }
  return 'ikili';
}

/**
 * Ham link girdisini temizler ve şema ekler.
 * @param {string} raw
 * @returns {string}
 */
function normalizeLink(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.includes('|') ? raw.split('|')[0].trim() : raw.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Kaynak bekçisi bulgularındaki yeni belgeleri indirir ve metinlerini çıkarır.
 *
 * @param {object} params
 * @param {Array<object>} params.befunde - quellen-waechter bulguları
 * @param {string} params.hedefDizin - Çıktıların yazılacağı dizin
 * @param {Function} [params.fetch=globalThis.fetch]
 * @param {Function} [params.pdfToText=defaultPdfToText]
 * @param {object} [params.sinir]
 * @param {number} [params.sinir.belge=12]
 * @param {number} [params.sinir.bayt=20000000]
 * @param {number} [params.sinir.karakter=400000]
 * @returns {Promise<Array<object>>}
 */
export async function indir({
  befunde = [],
  hedefDizin,
  fetch = globalThis.fetch,
  pdfToText = defaultPdfToText,
  sinir = {},
}) {
  const aktifSinir = {
    belge: 12,
    bayt: 20_000_000,
    karakter: 400_000,
    ...sinir,
  };

  await mkdir(hedefDizin, { recursive: true });

  const index = [];
  let dosyaSayac = 0;
  let indirilenSayisi = 0;

  for (const befund of befunde) {
    const quelleId = befund?.id || 'bilinmeyen';
    const neuList = Array.isArray(befund?.neu) ? befund.neu : [];

    for (const item of neuList) {
      const url = normalizeLink(item);

      // 1. İzinli host kontrolü
      if (!hostErlaubt(url)) {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt: 0,
          sha256: null,
          tur: null,
          kisaltildi: false,
          not: 'izinsiz host',
          atlandi: 'host',
        });
        continue;
      }

      // 2. Toplam belge sınırı kontrolü
      if (indirilenSayisi >= aktifSinir.belge) {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt: 0,
          sha256: null,
          tur: null,
          kisaltildi: false,
          not: null,
          atlandi: 'sinir',
        });
        continue;
      }

      // 3. İndirme (manual redirect ile en fazla 3 yönlendirme)
      let currentUrl = url;
      let res = null;
      let redirectSayisi = 0;
      let izinsizYonlendirme = false;
      let indirmeHatasi = null;

      while (redirectSayisi <= 3) {
        try {
          res = await fetch(currentUrl, { redirect: 'manual' });
        } catch (err) {
          indirmeHatasi = `fetch hatası: ${err?.message || err}`;
          break;
        }

        // 3xx yönlendirmeleri
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) {
            indirmeHatasi = `yönlendirme adresi yok (HTTP ${res.status})`;
            break;
          }

          let nextUrl;
          try {
            nextUrl = new URL(loc, currentUrl).href;
          } catch {
            indirmeHatasi = `geçersiz yönlendirme URL'si: ${loc}`;
            break;
          }

          if (!hostErlaubt(nextUrl)) {
            izinsizYonlendirme = true;
            break;
          }

          redirectSayisi++;
          if (redirectSayisi > 3) {
            indirmeHatasi = 'en fazla 3 yönlendirme sınırı aşıldı';
            break;
          }

          currentUrl = nextUrl;
          continue;
        }

        break;
      }

      if (izinsizYonlendirme) {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt: 0,
          sha256: null,
          tur: null,
          kisaltildi: false,
          not: 'izinsiz yönlendirme',
          atlandi: 'host',
        });
        continue;
      }

      if (indirmeHatasi) {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt: 0,
          sha256: null,
          tur: null,
          kisaltildi: false,
          not: indirmeHatasi,
          atlandi: null,
        });
        continue;
      }

      if (!res.ok) {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt: 0,
          sha256: null,
          tur: null,
          kisaltildi: false,
          not: `HTTP ${res.status}`,
          atlandi: null,
        });
        continue;
      }

      // 4. Content-Length bayt sınırı kontrolü
      const contentType = res.headers.get('content-type') || '';
      const clHeader = res.headers.get('content-length');
      const clBytes = clHeader ? parseInt(clHeader, 10) : null;
      const tespitTur = tespitEtTur(currentUrl, contentType);

      if (clBytes !== null && !Number.isNaN(clBytes) && clBytes > aktifSinir.bayt) {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt: clBytes,
          sha256: null,
          tur: tespitTur,
          kisaltildi: true,
          not: 'bayt sınırı aşıldı',
          atlandi: null,
        });
        indirilenSayisi++;
        continue;
      }

      // 5. Gövdeyi tampona oku
      let buffer;
      try {
        const ab = await res.arrayBuffer();
        buffer = Buffer.from(ab);
      } catch (err) {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt: 0,
          sha256: null,
          tur: tespitTur,
          kisaltildi: false,
          not: `gövde okunamadı: ${err?.message || err}`,
          atlandi: null,
        });
        continue;
      }

      // Gövde bayt kontrolü
      if (buffer.byteLength > aktifSinir.bayt) {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt: buffer.byteLength,
          sha256: null,
          tur: tespitTur,
          kisaltildi: true,
          not: 'bayt sınırı aşıldı',
          atlandi: null,
        });
        indirilenSayisi++;
        continue;
      }

      const sha = createHash('sha256').update(buffer).digest('hex');
      const bayt = buffer.byteLength;

      // 6. İkili dosya ayrıştırması
      if (tespitTur === 'xlsx' || tespitTur === 'zip' || tespitTur === 'ikili') {
        index.push({
          quelleId,
          url,
          dosya: null,
          bayt,
          sha256: sha,
          tur: tespitTur,
          kisaltildi: false,
          not: 'ikili dosya, içerik okunmadı',
          atlandi: null,
        });
        indirilenSayisi++;
        continue;
      }

      // 7. Metin çıkarma (PDF veya HTML)
      let metin = '';
      if (tespitTur === 'pdf') {
        try {
          metin = await pdfToText(buffer);
        } catch (err) {
          index.push({
            quelleId,
            url,
            dosya: null,
            bayt,
            sha256: sha,
            tur: 'pdf',
            kisaltildi: false,
            not: `pdfToText hatası: ${err?.message || err}`,
            atlandi: null,
          });
          indirilenSayisi++;
          continue;
        }
      } else {
        // html veya diğer metin
        const hamMetin = buffer.toString('utf-8');
        metin = htmlToText(hamMetin);
      }

      // 8. Karakter sınırı kontrolü
      let kisaltildi = false;
      if (metin.length > aktifSinir.karakter) {
        metin = metin.slice(0, aktifSinir.karakter);
        kisaltildi = true;
      }

      // 9. Dosyayı kaydet
      dosyaSayac++;
      const dosyaAdi = `${String(dosyaSayac).padStart(2, '0')}.txt`;
      await writeFile(join(hedefDizin, dosyaAdi), metin, 'utf-8');

      index.push({
        quelleId,
        url,
        dosya: dosyaAdi,
        bayt,
        sha256: sha,
        tur: tespitTur,
        kisaltildi,
        not: null,
        atlandi: null,
      });
      indirilenSayisi++;
    }
  }

  await writeFile(join(hedefDizin, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  return index;
}

/**
 * CLI giriş noktası.
 */
async function cliCalistir() {
  const args = process.argv.slice(2);
  let jsonPath = null;
  let outDir = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--json=')) {
      jsonPath = a.slice('--json='.length);
    } else if (a === '--json' && i + 1 < args.length) {
      jsonPath = args[++i];
    } else if (a.startsWith('--out=')) {
      outDir = a.slice('--out='.length);
    } else if (a === '--out' && i + 1 < args.length) {
      outDir = args[++i];
    }
  }

  if (!jsonPath || !outDir) {
    process.exit(1);
  }

  let befunde = [];
  try {
    const raw = readFileSync(jsonPath, 'utf-8');
    const parsed = JSON.parse(raw);
    befunde = Array.isArray(parsed) ? parsed : (parsed.befunde || []);
  } catch {
    process.exit(1);
  }

  try {
    await indir({ befunde, hedefDizin: outDir });
  } catch {
    process.exit(1);
  }

  process.exit(0);
}

const suAnkiDosya = fileURLToPath(import.meta.url).toLowerCase();
const cagirilanDosya = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (cagirilanDosya && cagirilanDosya === suAnkiDosya) {
  cliCalistir().catch(() => process.exit(1));
}
