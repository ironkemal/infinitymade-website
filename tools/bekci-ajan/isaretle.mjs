// tools/bekci-ajan/isaretle.mjs
// Ne: PDF belgelerinde aranan metni bulup ilgili sayfayı işaretli PNG olarak çizen modül.
// Niye: Kemal'in "Gerekirse fotoğraf atsın, ilgili yeri işaretlesin" talebi üzerine;
// pdftotext -bbox-layout ile metin koordinatlarını bulur, pdftoppm ile sayfayı render eder,
// ImageMagick ile sarı dolgu + kırmızı çerçeve çizerek tek başına anlaşılır görsel üretir.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Varsayılan komut çalıştırıcı (shell yok, 60 sn zaman aşımı).
 * @param {string} komut
 * @param {string[]} argumanlar
 * @returns {string}
 */
function varsayilanCalistir(komut, argumanlar) {
  return execFileSync(komut, argumanlar, {
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });
}

/**
 * XML / HTML karakter varlıklarını çözer.
 * @param {string} str
 * @returns {string}
 */
function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Metni karşılaştırma için normalize eder.
 * @param {string} s
 * @returns {string}
 */
function normalizeStr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * İki metnin boşluk, tire ve büyük-küçük harf toleransıyla eşleşip eşleşmediğini denetler.
 * @param {string} candidateText
 * @param {string} targetText
 * @returns {boolean}
 */
function eslesiyorMu(candidateText, targetText) {
  const cNorm = normalizeStr(candidateText);
  const tNorm = normalizeStr(targetText);
  if (!cNorm || !tNorm) return false;
  if (cNorm === tNorm || cNorm.includes(tNorm)) return true;

  // Tireleri kaldırarak karşılaştır (satır sonu heceleme toleransı)
  const cNoHyphen = cNorm.replace(/[-–—]/g, '');
  const tNoHyphen = tNorm.replace(/[-–—]/g, '');
  if (cNoHyphen && tNoHyphen && (cNoHyphen === tNoHyphen || cNoHyphen.includes(tNoHyphen))) {
    return true;
  }

  // Tireleri boşluğa çevirerek karşılaştır
  const cSpaceHyphen = cNorm.replace(/[-–—]/g, ' ').replace(/\s+/g, ' ');
  const tSpaceHyphen = tNorm.replace(/[-–—]/g, ' ').replace(/\s+/g, ' ');
  if (cSpaceHyphen && tSpaceHyphen && (cSpaceHyphen === tSpaceHyphen || cSpaceHyphen.includes(tSpaceHyphen))) {
    return true;
  }

  return false;
}

/**
 * pdftotext -bbox-layout çıktısını (XHTML) ayrıştırıp sayfalar ve kelimeler listesine çevirir.
 * @param {string} xhtml
 * @returns {Array<{ sayfa: number, sayfaGenislik: number, sayfaYukseklik: number, words: Array<{ text: string, xMin: number, yMin: number, xMax: number, yMax: number, lineIdx: number }> }>}
 */
export function ayrrBboxXhtml(xhtml) {
  if (typeof xhtml !== 'string' || !xhtml.trim()) return [];

  const sayfalar = [];
  const pageRe = /<page\b([^>]*)>([\s\S]*?)<\/page>/gi;
  let pm;
  let sayfaNo = 1;

  while ((pm = pageRe.exec(xhtml)) !== null) {
    const pageAttrs = pm[1];
    const pageContent = pm[2];

    const wMatch = pageAttrs.match(/width="([0-9.]+)"/i);
    const hMatch = pageAttrs.match(/height="([0-9.]+)"/i);
    const sayfaGenislik = wMatch ? parseFloat(wMatch[1]) : 595.28;
    const sayfaYukseklik = hMatch ? parseFloat(hMatch[1]) : 841.89;

    const words = [];
    const lineRe = /<line\b[^>]*>([\s\S]*?)<\/line>/gi;
    let lm;
    let lineIdx = 0;
    let lineFound = false;

    while ((lm = lineRe.exec(pageContent)) !== null) {
      lineFound = true;
      lineIdx++;
      const lineContent = lm[1];
      const wordRe = /<word\s+xMin="([0-9.]+)"\s+yMin="([0-9.]+)"\s+xMax="([0-9.]+)"\s+yMax="([0-9.]+)"[^>]*>([\s\S]*?)<\/word>/gi;
      let wm;
      while ((wm = wordRe.exec(lineContent)) !== null) {
        const text = decodeEntities(wm[5]).trim();
        if (text.length > 0) {
          words.push({
            xMin: parseFloat(wm[1]),
            yMin: parseFloat(wm[2]),
            xMax: parseFloat(wm[3]),
            yMax: parseFloat(wm[4]),
            text,
            lineIdx,
          });
        }
      }
    }

    if (!lineFound) {
      // Satır etiketi yoksa doğrudan kelimeleri al ve yMin değişimine göre satır oluştur
      const wordRe = /<word\s+xMin="([0-9.]+)"\s+yMin="([0-9.]+)"\s+xMax="([0-9.]+)"\s+yMax="([0-9.]+)"[^>]*>([\s\S]*?)<\/word>/gi;
      let wm;
      let currentLineIdx = 1;
      let lastY = null;
      while ((wm = wordRe.exec(pageContent)) !== null) {
        const text = decodeEntities(wm[5]).trim();
        if (text.length > 0) {
          const yMin = parseFloat(wm[2]);
          if (lastY !== null && Math.abs(yMin - lastY) > 5) {
            currentLineIdx++;
          }
          lastY = yMin;
          words.push({
            xMin: parseFloat(wm[1]),
            yMin,
            xMax: parseFloat(wm[3]),
            yMax: parseFloat(wm[4]),
            text,
            lineIdx: currentLineIdx,
          });
        }
      }
    }

    sayfalar.push({
      sayfa: sayfaNo++,
      sayfaGenislik,
      sayfaYukseklik,
      words,
    });
  }

  return sayfalar;
}

/**
 * Kelime diliminden ham birleştirme ve tireyle birleştirme metinlerini üretir.
 * @param {Array<{ text: string }>} slice
 * @returns {{ raw: string, hyphen: string }}
 */
function birlestirKelimeler(slice) {
  const raw = slice.map(w => w.text).join(' ');
  let hyphen = '';
  let prevHyphen = false;
  for (let k = 0; k < slice.length; k++) {
    const t = slice[k].text;
    const ends = k < slice.length - 1 && (t.endsWith('-') || t.endsWith('–') || t.endsWith('—'));
    const clean = ends ? t.slice(0, -1) : t;
    if (hyphen === '') {
      hyphen = clean;
    } else if (prevHyphen) {
      hyphen += clean;
    } else {
      hyphen += ' ' + clean;
    }
    prevHyphen = ends;
  }
  return { raw, hyphen };
}

/**
 * PDF dosyasında aranan metni bulur ve koordinat kutularını döner.
 *
 * @param {object} params
 * @param {string} params.pdfYolu
 * @param {string} params.arananMetin
 * @param {Function} [params.calistir]
 * @returns {Promise<{ sayfa: number, kutular: Array<{ x: number, y: number, w: number, h: number }>, sayfaGenislik: number, sayfaYukseklik: number } | null>}
 */
export async function sayfaBul({ pdfYolu, arananMetin, calistir = varsayilanCalistir }) {
  if (!pdfYolu || !arananMetin || typeof arananMetin !== 'string' || !arananMetin.trim()) {
    return null;
  }

  let xhtml;
  try {
    xhtml = calistir('pdftotext', ['-bbox-layout', pdfYolu, '-']);
  } catch {
    return null;
  }

  if (typeof xhtml !== 'string' || !xhtml.trim()) {
    return null;
  }

  const sayfalar = ayrrBboxXhtml(xhtml);

  for (const page of sayfalar) {
    const words = page.words;
    let buldukKelimeler = null;

    for (let i = 0; i < words.length; i++) {
      for (let j = i; j < Math.min(words.length, i + 40); j++) {
        const slice = words.slice(i, j + 1);
        const { raw: rawJoined, hyphen: hyphenJoined } = birlestirKelimeler(slice);

        if (eslesiyorMu(rawJoined, arananMetin) || eslesiyorMu(hyphenJoined, arananMetin)) {
          // Sol taraftan daraltma yapılabilir mi? (Minimal aralık bulma)
          let canShrink = false;
          if (j > i) {
            const sub = birlestirKelimeler(words.slice(i + 1, j + 1));
            if (eslesiyorMu(sub.raw, arananMetin) || eslesiyorMu(sub.hyphen, arananMetin)) {
              canShrink = true;
            }
          }

          if (!canShrink) {
            buldukKelimeler = slice;
            break;
          }
        }
      }
      if (buldukKelimeler) break;
    }

    if (buldukKelimeler && buldukKelimeler.length > 0) {
      // Bulunan ardışık kelimelerin kutularını satır satır birleştir
      const satirlarMap = new Map();
      for (const w of buldukKelimeler) {
        if (!satirlarMap.has(w.lineIdx)) {
          satirlarMap.set(w.lineIdx, []);
        }
        satirlarMap.get(w.lineIdx).push(w);
      }

      const kutular = [];
      for (const lineWords of satirlarMap.values()) {
        const xMin = Math.min(...lineWords.map(w => w.xMin));
        const yMin = Math.min(...lineWords.map(w => w.yMin));
        const xMax = Math.max(...lineWords.map(w => w.xMax));
        const yMax = Math.max(...lineWords.map(w => w.yMax));
        kutular.push({
          x: xMin,
          y: yMin,
          w: xMax - xMin,
          h: yMax - yMin,
        });
      }

      return {
        sayfa: page.sayfa,
        kutular,
        sayfaGenislik: page.sayfaGenislik,
        sayfaYukseklik: page.sayfaYukseklik,
      };
    }
  }

  return null;
}

/**
 * pdftoppm ile sayfayı çizip ImageMagick ile kutuları işaretleyerek PNG çıktısı üretir.
 *
 * @param {object} params
 * @param {string} params.pdfYolu
 * @param {number} params.sayfa
 * @param {Array<{ x: number, y: number, w: number, h: number }>} params.kutular
 * @param {string} params.cikti
 * @param {number} [params.sayfaGenislik]
 * @param {number} [params.sayfaYukseklik]
 * @param {Function} [params.calistir]
 * @returns {Promise<string | null>}
 */
export async function isaretliPng({
  pdfYolu,
  sayfa,
  kutular,
  cikti,
  sayfaGenislik = 595.28,
  sayfaYukseklik = 841.89,
  calistir = varsayilanCalistir,
}) {
  if (!pdfYolu || !sayfa || !Array.isArray(kutular) || kutular.length === 0 || !cikti) {
    return null;
  }

  let tmpDizin;
  try {
    tmpDizin = mkdtempSync(join(tmpdir(), 'bekci-ppm-'));
  } catch {
    return null;
  }

  const ppmPrefix = join(tmpDizin, 'sayfa');
  const ppmPng = `${ppmPrefix}.png`;

  try {
    calistir('pdftoppm', [
      '-png',
      '-r',
      '110',
      '-f',
      String(sayfa),
      '-l',
      String(sayfa),
      '-singlefile',
      pdfYolu,
      ppmPrefix,
    ]);
  } catch {
    rmSync(tmpDizin, { recursive: true, force: true });
    return null;
  }

  const scale = 110 / 72;
  const pageHeightPx = Math.round(sayfaYukseklik * scale);
  const pageWidthPx = Math.round(sayfaGenislik * scale);

  const magickArgs = [ppmPng];
  for (const b of kutular) {
    const x0 = Math.round(b.x * scale);
    const y0 = Math.round(b.y * scale);
    const x1 = Math.round((b.x + b.w) * scale);
    const y1 = Math.round((b.y + b.h) * scale);
    magickArgs.push(
      '-fill',
      'rgba(255,230,0,0.35)',
      '-stroke',
      'red',
      '-strokewidth',
      '3',
      '-draw',
      `rectangle ${x0},${y0} ${x1},${y1}`
    );
  }

  // Sayfa çok uzunsa işaretin çevresinden ±700px kırp
  if (pageHeightPx > 1500) {
    const minY = Math.min(...kutular.map(b => b.y * scale));
    const maxY = Math.max(...kutular.map(b => (b.y + b.h) * scale));
    const top = Math.max(0, Math.round(minY - 700));
    const bottom = Math.min(pageHeightPx, Math.round(maxY + 700));
    const cropH = bottom - top;
    if (top > 0 || bottom < pageHeightPx) {
      magickArgs.push('-crop', `${pageWidthPx}x${cropH}+0+${top}`, '+repage');
    }
  }

  magickArgs.push(cikti);

  let basarili = false;
  try {
    calistir('magick', magickArgs);
    basarili = true;
  } catch {
    try {
      calistir('convert', magickArgs);
      basarili = true;
    } catch {
      basarili = false;
    }
  } finally {
    rmSync(tmpDizin, { recursive: true, force: true });
  }

  return basarili ? cikti : null;
}

/**
 * Belgedeki aranan metni bulup işaretli PNG dosyası üretir.
 *
 * @param {object} params
 * @param {string} params.pdfYolu
 * @param {string} params.arananMetin
 * @param {string} [params.ciktiDizin]
 * @param {Function} [params.calistir]
 * @returns {Promise<string | null>}
 */
export async function isaretle({
  pdfYolu,
  arananMetin,
  ciktiDizin,
  calistir = varsayilanCalistir,
}) {
  try {
    const bul = await sayfaBul({ pdfYolu, arananMetin, calistir });
    if (!bul) return null;

    const hedefDizin = ciktiDizin || tmpdir();
    try {
      mkdirSync(hedefDizin, { recursive: true });
    } catch {}

    const ciktiYolu = join(
      hedefDizin,
      `isaretli-s${bul.sayfa}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    );

    const sonuc = await isaretliPng({
      pdfYolu,
      sayfa: bul.sayfa,
      kutular: bul.kutular,
      cikti: ciktiYolu,
      sayfaGenislik: bul.sayfaGenislik,
      sayfaYukseklik: bul.sayfaYukseklik,
      calistir,
    });

    return sonuc;
  } catch {
    return null;
  }
}
