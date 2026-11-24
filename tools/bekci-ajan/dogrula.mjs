// tools/bekci-ajan/dogrula.mjs
// Ne: Yama doğrulayıcısı, unified diff ayrıştırıcı ve sent hassasiyetinde rakam karşılaştırıcı.
// Niye: SPEC.md §3.0 madde 1, 5 ve 6 uyarınca güvenlik kapısı: ajanın ürettiği
// yamaların yalnızca izinli dosyalara dokunmasını, bilinen satır iskeletlerini korumasını,
// kod enjeksiyonunu engellemesini ve deterministik diff özeti sunmasını sağlar.

import { createHash } from 'node:crypto';

/**
 * Metnin SHA-256 özetini hex olarak döner.
 */
export function sha256(text) {
  return createHash('sha256').update(String(text ?? ''), 'utf-8').digest('hex');
}

/**
 * İskelet ve string regex'leri.
 * \r, \u2028, \u2029 karakterleri dışlanır; sayılardan -? çıkarılmıştır (negatif fiyat ayrı iskelet).
 * null, sayı yer tutucusuyla (\u0000N\u0000) aynı kabul edilir.
 */
export const ISKELET_RE = /'(?:[^'\\\r\n\u2028\u2029]|\\.)*'|"(?:[^"\\\r\n\u2028\u2029]|\\.)*"|(?<![\w$])(?:null|\d+(?:\.\d+)?)(?![\w$])/g;
export const STRING_RE = /'(?:[^'\\\r\n\u2028\u2029]|\\.)*'|"(?:[^"\\\r\n\u2028\u2029]|\\.)*"/g;

/**
 * Fiyat dosyaları için varsayılan veri satırı kalıpları (preise preset'i).
 * - Pozisyon satırı (hpnr veya x ile başlayan tek satırlık nesne, dengeli süslü parantezler)
 * - PREISSTAND sabit tanımı
 * - preise_autoupdate.mjs'in yeni fenster bloğu açılış ve kapanış satırları
 */
export const PREISE_VERI_SATIRI = [
  /^\s{2,6}\{\s*(hpnr|x):\s*'[A-Z0-9]{4,6}', .*( \},?|,)$/,
  /^export const PREISSTAND = '[0-9-]{8}';$/,
  /^  Object\.freeze\(\{ gueltig_ab: '\d{4}-\d{2}-\d{2}', gueltig_bis: '\d{4}-\d{2}-\d{2}', positionen: Object\.freeze\(\[$/,
  /^  Object\.freeze\(\{ gueltig_ab: '\d{4}-\d{2}-\d{2}', gueltig_bis: '\d{4}-\d{2}-\d{2}', positionen: [A-Z0-9_]+ \}\),$/,
  /^  \]\) \}\),$/,
];

/**
 * Satırın izinli veri satırı kalıplarından birine uyup uymadığını denetler.
 */
export function veriSatiriMi(satir, veriSatiri = PREISE_VERI_SATIRI) {
  if (typeof satir !== 'string') return false;
  if (/[\r\u2028\u2029]/.test(satir)) return false;
  const list = Array.isArray(veriSatiri) ? veriSatiri : PREISE_VERI_SATIRI;
  for (const re of list) {
    if (re.test(satir)) {
      return true;
    }
  }
  return false;
}

/**
 * Satırdaki literalleri tek birleşik regex geçişiyle yer tutuculara çevirir:
 * String'ler → \u0000S\u0000, Sayılar ve null → \u0000N\u0000
 */
export function iskelet(satir) {
  if (typeof satir !== 'string') return '';
  return satir.replace(ISKELET_RE, m => {
    if (m.startsWith("'") || m.startsWith('"')) {
      return '\u0000S\u0000';
    }
    return '\u0000N\u0000';
  });
}

/**
 * Satırdaki ilk string literalini bulur ('...' veya "...").
 */
function ilkStringLiteral(satir) {
  const m = satir.match(/'(?:[^'\\\r\n\u2028\u2029]|\\.)*'|"(?:[^"\\\r\n\u2028\u2029]|\\.)*"/);
  return m ? m[0] : null;
}

/**
 * Unified git diff metnini sıkı durum makinesi ile nesne yapısına dönüştürür.
 * YALNIZ `diff --git a/X b/Y` ile dosya açılır. Hunk satırları kalan sayaçlarıyla izlenir.
 * Boşluksuz boş bağlam satırı ('') bağlam sayılır; \ No newline satırları yutulur.
 */
export function parseDiff(patchText) {
  if (!patchText || typeof patchText !== 'string') return [];
  const satirlar = patchText.split(/\r?\n/);
  const dosyalar = [];

  let aktifDosya = null;
  let aktifHunk = null;
  let kalanAlt = 0;
  let kalanNeu = 0;
  let altNo = 0;
  let neuNo = 0;
  let state = 'OUTSIDE_FILE'; // OUTSIDE_FILE | FILE_HEADER | IN_HUNK | AFTER_HUNK

  for (let i = 0; i < satirlar.length; i++) {
    const satir = satirlar[i];

    if (satir.startsWith('diff --git ')) {
      if (aktifDosya) {
        if (state === 'IN_HUNK' && (kalanAlt > 0 || kalanNeu > 0)) {
          aktifDosya.hata = aktifDosya.hata || 'eksik hunk satırı (EOF)';
        }
        dosyalar.push(aktifDosya);
      }

      const rest = satir.slice('diff --git '.length).trim();
      const parts = rest.split(/\s+/);
      const diffGitAlt = parts[0]?.replace(/^a\//, '') || null;
      const diffGitNeu = parts[1]?.replace(/^b\//, '') || null;

      aktifDosya = {
        alt: diffGitAlt,
        neu: diffGitNeu,
        diffGitAlt,
        diffGitNeu,
        sawMinusMinusMinus: false,
        sawPlusPlusPlus: false,
        flags: {
          rename: false,
          mode: false,
          symlink: false,
          binary: false,
          yeniDosya: false,
          silindi: false,
        },
        eklenen: [],
        silinen: [],
        hunks: [],
        hata: null,
      };

      if (parts.length < 2) {
        aktifDosya.hata = 'geçersiz diff --git başlığı';
      }

      aktifHunk = null;
      state = 'FILE_HEADER';
      continue;
    }

    if (state === 'OUTSIDE_FILE') {
      if (!satir.trim()) continue;
      // diff --git olmadan başlayan yama -> doğrudan hata kaydı
      dosyalar.push({
        alt: null,
        neu: null,
        flags: {
          rename: false,
          mode: false,
          symlink: false,
          binary: false,
          yeniDosya: false,
          silindi: false,
        },
        eklenen: [],
        silinen: [],
        hunks: [],
        hata: 'diff --git başlığı yok',
      });
      return dosyalar;
    }

    if (state === 'FILE_HEADER') {
      if (satir.startsWith('old mode ') || satir.startsWith('new mode ')) {
        aktifDosya.flags.mode = true;
        const mode = satir.slice(9).trim();
        if (mode === '120000') aktifDosya.flags.symlink = true;
        continue;
      }
      if (satir.startsWith('new file mode ')) {
        aktifDosya.flags.yeniDosya = true;
        const mode = satir.slice('new file mode '.length).trim();
        if (mode === '120000') {
          aktifDosya.flags.symlink = true;
        } else if (mode !== '100644') {
          aktifDosya.flags.mode = true;
        }
        continue;
      }
      if (satir.startsWith('deleted file mode ')) {
        aktifDosya.flags.silindi = true;
        const mode = satir.slice('deleted file mode '.length).trim();
        if (mode === '120000') {
          aktifDosya.flags.symlink = true;
        } else if (mode !== '100644') {
          aktifDosya.flags.mode = true;
        }
        continue;
      }
      if (
        satir.startsWith('rename from ') ||
        satir.startsWith('rename to ') ||
        satir.startsWith('copy from ') ||
        satir.startsWith('copy to ') ||
        satir.startsWith('similarity index ') ||
        satir.startsWith('dissimilarity index ')
      ) {
        aktifDosya.flags.rename = true;
        continue;
      }
      if (satir.startsWith('index ')) {
        continue;
      }
      if (satir.startsWith('Binary files ') || satir.startsWith('GIT binary patch')) {
        aktifDosya.flags.binary = true;
        continue;
      }
      if (satir.startsWith('--- ')) {
        if (aktifDosya.sawMinusMinusMinus) {
          aktifDosya.hata = aktifDosya.hata || 'birden fazla --- başlığı';
        }
        aktifDosya.sawMinusMinusMinus = true;
        const p = satir.slice(4).trim();
        const altPath = p === '/dev/null' ? null : p.replace(/^a\//, '');
        if (p === '/dev/null') {
          aktifDosya.flags.yeniDosya = true;
        } else if (altPath !== aktifDosya.diffGitAlt) {
          aktifDosya.hata = aktifDosya.hata || 'diff --git ve --- yolları uyuşmuyor';
        }
        aktifDosya.alt = altPath;
        continue;
      }
      if (satir.startsWith('+++ ')) {
        if (aktifDosya.sawPlusPlusPlus) {
          aktifDosya.hata = aktifDosya.hata || 'birden fazla +++ başlığı';
        }
        aktifDosya.sawPlusPlusPlus = true;
        const p = satir.slice(4).trim();
        const neuPath = p === '/dev/null' ? null : p.replace(/^b\//, '');
        if (p === '/dev/null') {
          aktifDosya.flags.silindi = true;
        } else if (neuPath !== aktifDosya.diffGitNeu) {
          aktifDosya.hata = aktifDosya.hata || 'diff --git ve +++ yolları uyuşmuyor';
        }
        aktifDosya.neu = neuPath;
        continue;
      }

      if (satir.startsWith('@@ -')) {
        if (!aktifDosya.sawMinusMinusMinus || !aktifDosya.sawPlusPlusPlus) {
          aktifDosya.hata = aktifDosya.hata || 'eksik --- veya +++ başlığı';
        }
        const hunkMatch = satir.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!hunkMatch) {
          aktifDosya.hata = aktifDosya.hata || `geçersiz hunk başlığı: ${satir}`;
          continue;
        }
        altNo = parseInt(hunkMatch[1], 10);
        const altUzunluk = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
        neuNo = parseInt(hunkMatch[3], 10);
        const neuUzunluk = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;

        kalanAlt = altUzunluk;
        kalanNeu = neuUzunluk;

        aktifHunk = {
          altBasla: altNo,
          altUzunluk,
          neuBasla: neuNo,
          neuUzunluk,
          eklenen: [],
          silinen: [],
          satirlar: [],
        };
        aktifDosya.hunks.push(aktifHunk);

        if (kalanAlt === 0 && kalanNeu === 0) {
          state = 'AFTER_HUNK';
        } else {
          state = 'IN_HUNK';
        }
        continue;
      }

      aktifDosya.hata = aktifDosya.hata || `geçersiz başlık satırı: ${satir}`;
      continue;
    }

    if (state === 'IN_HUNK') {
      if (satir === '\\ No newline at end of file') {
        continue;
      }

      if (satir.startsWith(' ') || satir === '') {
        if (kalanAlt <= 0 || kalanNeu <= 0) {
          aktifDosya.hata = aktifDosya.hata || 'hunk sayaç aşımı (bağlam satırı)';
        }
        kalanAlt--;
        kalanNeu--;
        const text = satir.startsWith(' ') ? satir.slice(1) : '';
        aktifHunk.satirlar.push({ tip: ' ', satir: text, altNo, neuNo });
        altNo++;
        neuNo++;
      } else if (satir.startsWith('-')) {
        if (kalanAlt <= 0) {
          aktifDosya.hata = aktifDosya.hata || 'hunk sayaç aşımı (silinen satır)';
        }
        kalanAlt--;
        const text = satir.slice(1);
        const sil = { satir: text, no: altNo };
        aktifDosya.silinen.push(sil);
        aktifHunk.silinen.push(sil);
        aktifHunk.satirlar.push({ tip: '-', satir: text, altNo, neuNo });
        altNo++;
      } else if (satir.startsWith('+')) {
        if (kalanNeu <= 0) {
          aktifDosya.hata = aktifDosya.hata || 'hunk sayaç aşımı (eklenen satır)';
        }
        kalanNeu--;
        const text = satir.slice(1);
        const ekl = { satir: text, no: neuNo };
        aktifDosya.eklenen.push(ekl);
        aktifHunk.eklenen.push(ekl);
        aktifHunk.satirlar.push({ tip: '+', satir: text, altNo, neuNo });
        neuNo++;
      } else {
        aktifDosya.hata = aktifDosya.hata || `hunk içinde geçersiz satır: ${satir}`;
      }

      if (kalanAlt === 0 && kalanNeu === 0) {
        state = 'AFTER_HUNK';
      } else if (kalanAlt < 0 || kalanNeu < 0) {
        aktifDosya.hata = aktifDosya.hata || 'hunk sayaç aşımı';
        state = 'AFTER_HUNK';
      }
      continue;
    }

    if (state === 'AFTER_HUNK') {
      if (satir === '\\ No newline at end of file') {
        continue;
      }

      if (satir.startsWith('@@ -')) {
        const hunkMatch = satir.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!hunkMatch) {
          aktifDosya.hata = aktifDosya.hata || `geçersiz hunk başlığı: ${satir}`;
          continue;
        }
        altNo = parseInt(hunkMatch[1], 10);
        const altUzunluk = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
        neuNo = parseInt(hunkMatch[3], 10);
        const neuUzunluk = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;

        kalanAlt = altUzunluk;
        kalanNeu = neuUzunluk;

        aktifHunk = {
          altBasla: altNo,
          altUzunluk,
          neuBasla: neuNo,
          neuUzunluk,
          eklenen: [],
          silinen: [],
          satirlar: [],
        };
        aktifDosya.hunks.push(aktifHunk);

        if (kalanAlt === 0 && kalanNeu === 0) {
          state = 'AFTER_HUNK';
        } else {
          state = 'IN_HUNK';
        }
        continue;
      }

      if (!satir.trim()) {
        continue;
      }

      aktifDosya.hata = aktifDosya.hata || `hunk sonrası geçersiz satır: ${satir}`;
    }
  }

  if (aktifDosya) {
    if (state === 'IN_HUNK' && (kalanAlt > 0 || kalanNeu > 0)) {
      aktifDosya.hata = aktifDosya.hata || 'eksik hunk satırı (EOF)';
    }
    dosyalar.push(aktifDosya);
  }

  return dosyalar;
}

const YASAKLI_KELIMELER_RE = /(?<![\w$])(import|export|require|eval|Function|process|globalThis|window|fetch|constructor|__proto__|prototype|function|new|await|async|this)(?![\w$])/;

/**
 * Eklenen satırda güvensiz karakter, escape, yorum veya yasaklı anahtar kelime denetimi.
 */
function eklenenSatirHatalari(satir, no, orjinalIskeletler) {
  const hatalar = [];

  if (satir.includes('\u0000')) {
    hatalar.push(`NUL karakteri içeriyor: satir ${no}`);
    return hatalar;
  }

  if (satir.includes('`') || satir.includes('${')) {
    hatalar.push(`guvensiz karakter (escape/template string): satir ${no}`);
  }

  if (/[\r\u2028\u2029]/.test(satir)) {
    hatalar.push(`guvensiz karakter (CR/satır sonu): satir ${no}`);
  }

  if (satir.includes('"')) {
    hatalar.push(`çift tırnak yasak: satir ${no}`);
  }

  const stringler = satir.match(STRING_RE) || [];
  for (const s of stringler) {
    if (s.includes('\\')) {
      hatalar.push(`guvensiz karakter (escape/template string): satir ${no}`);
      break;
    }
  }

  const stringsiz = satir.replace(STRING_RE, '');
  if (stringsiz.includes('//') || stringsiz.includes('/*') || stringsiz.includes('*/')) {
    hatalar.push(`guvensiz yorum / karakter: satir ${no}`);
  }

  const isPreisstand = /^export const PREISSTAND = '[0-9-]{8}';$/.test(satir);
  if (!isPreisstand && (stringsiz.includes('=>') || YASAKLI_KELIMELER_RE.test(stringsiz))) {
    hatalar.push(`yasaklı sözcük/fonksiyon: satir ${no}`);
  }

  const isFensterZeile =
    /^  Object\.freeze\(\{ gueltig_ab: '\d{4}-\d{2}-\d{2}', gueltig_bis: '\d{4}-\d{2}-\d{2}', positionen: Object\.freeze\(\[$/.test(satir) ||
    /^  Object\.freeze\(\{ gueltig_ab: '\d{4}-\d{2}-\d{2}', gueltig_bis: '\d{4}-\d{2}-\d{2}', positionen: [A-Z0-9_]+ \}\),$/.test(satir);

  const isk = iskelet(satir);
  if (isk.includes('(') && !isFensterZeile) {
    if (!orjinalIskeletler || !orjinalIskeletler.has(isk)) {
      hatalar.push(`bilinmeyen fonksiyon çağrısı / parantez: satir ${no}`);
    }
  }

  return hatalar;
}

/**
 * Hunk'ları orijinal satırlara uygulayarak sonuç içeriğini (dizi olarak) hesaplar.
 */
function dosyaSonucunuHesapla(orjinalSatirlar, hunks) {
  const sonuc = [];
  let altIdx = 0; // 0-based

  const siraliHunklar = [...hunks].sort((a, b) => a.altBasla - b.altBasla);

  for (const hunk of siraliHunklar) {
    const hedefBasla = hunk.altBasla - 1; // 0-based
    while (altIdx < hedefBasla && altIdx < orjinalSatirlar.length) {
      sonuc.push(orjinalSatirlar[altIdx++]);
    }
    for (const item of hunk.satirlar) {
      if (item.tip === ' ') {
        sonuc.push(orjinalSatirlar[altIdx++]);
      } else if (item.tip === '-') {
        altIdx++;
      } else if (item.tip === '+') {
        sonuc.push(item.satir);
      }
    }
  }
  while (altIdx < orjinalSatirlar.length) {
    sonuc.push(orjinalSatirlar[altIdx++]);
  }
  return sonuc;
}

/**
 * Sonuç içeriğinde her Object.freeze([ ... ]) bloğu içinde aynı kodun iki kez
 * geçip geçmediğini denetler (gölgeleme saldırısını engellemek için).
 */
function fensterTekrarKontrolu(satirlar) {
  const hatalar = [];
  let blokta = false;
  let blokKodlari = new Set();

  for (const satir of satirlar) {
    if (satir.includes('Object.freeze([')) {
      blokta = true;
      blokKodlari = new Set();
      continue;
    }
    if (blokta) {
      if (satir.includes('])') || satir.includes(']);')) {
        blokta = false;
        blokKodlari = new Set();
        continue;
      }
      const m = satir.match(/(?:hpnr|x):\s*['"]([A-Z0-9]{4,6})['"]/);
      if (m) {
        const code = m[1];
        if (blokKodlari.has(code)) {
          hatalar.push(`tekrar eden kod: ${code}`);
        }
        blokKodlari.add(code);
      }
    }
  }
  return hatalar;
}

/**
 * Eşi olmayan (+) eklenen satırın doğrulaması.
 */
function kontrolEtEsiOlmayanEkl(ekl, orjinalIskeletler, gruende) {
  // 1. Pozisyon kaydı ise tek satırlık ve { / } dengeli olmalı (yarım kayıt yasak)
  if (/^\s{2,6}\{\s*(hpnr|x):/.test(ekl.satir)) {
    const ac = (ekl.satir.match(/\{/g) || []).length;
    const kapa = (ekl.satir.match(/\}/g) || []).length;
    if (ac !== kapa || !ekl.satir.trim().endsWith('},')) {
      gruende.push(`veri satırı değil: ${ekl.neuNo}`);
      return;
    }
    return;
  }

  // 2. Pozisyon kaydı değilse izin verilen yeni fenster blok satırları veya PREISSTAND olmalı
  const isFensterBloğuSatiri =
    /^  Object\.freeze\(\{ gueltig_ab: '\d{4}-\d{2}-\d{2}', gueltig_bis: '\d{4}-\d{2}-\d{2}', positionen: Object\.freeze\(\[$/.test(ekl.satir) ||
    /^  \]\) \}\),$/.test(ekl.satir) ||
    /^export const PREISSTAND = '[0-9-]{8}';$/.test(ekl.satir);

  if (!isFensterBloğuSatiri) {
    gruende.push(`bilinmeyen satır biçimi: ${ekl.neuNo}`);
  }
}

/**
 * Yamayı güvenlik korkuluklarına karşı denetler.
 * Ret sebepleri toplanır, ok = gruende.length === 0.
 */
export function pruefeYama(
  patchText,
  { erlaubt = [], dateiInhalt = {}, veriSatiri = PREISE_VERI_SATIRI } = {}
) {
  const gruende = [];
  const hash = sha256(patchText);
  const degisiklikler = {};

  if (!patchText || typeof patchText !== 'string' || patchText.trim().length === 0) {
    gruende.push('bos yama');
    return { ok: false, gruende, sha256: hash, degisiklikler };
  }

  const dosyalar = parseDiff(patchText);
  if (dosyalar.length === 0) {
    gruende.push('bos yama');
    return { ok: false, gruende, sha256: hash, degisiklikler };
  }

  const gorulenYollar = new Set();
  let toplamDegisiklik = 0;

  for (const d of dosyalar) {
    if (d.hata) {
      gruende.push(`biçim: ${d.hata}`);
    }

    if (d.alt !== d.neu) {
      gruende.push(`alt !== neu: ${d.alt} !== ${d.neu}`);
    }

    const yol = d.neu || d.alt;
    if (!yol) {
      gruende.push('yol eksik');
      continue;
    }

    degisiklikler[yol] = { eklenen: d.eklenen.length, silinen: d.silinen.length };
    toplamDegisiklik += d.eklenen.length + d.silinen.length;

    // Yol güvenlik kontrolleri: .., başta /, \, :, NUL
    if (
      yol.startsWith('/') ||
      yol.includes('\\') ||
      yol.includes(':') ||
      yol.includes('\u0000') ||
      yol.split('/').includes('..') ||
      yol.includes('..')
    ) {
      gruende.push(`gecersiz yol: ${yol}`);
    }

    // Aynı yol ikinci kez
    if (gorulenYollar.has(yol)) {
      gruende.push(`tekrarlanan dosya: ${yol}`);
    }
    gorulenYollar.add(yol);

    // İzinli dosya tam eşleşme kontrolü (regex'te ^$ olmasa bile tamamı eşleşmeli)
    const izinli = Array.isArray(erlaubt) && erlaubt.some(re => {
      if (!(re instanceof RegExp)) return false;
      const cleanRe = new RegExp(re.source, re.flags.replace(/[gy]/g, ''));
      const m = cleanRe.exec(yol);
      return m !== null && m.index === 0 && m[0].length === yol.length;
    });
    if (!izinli) {
      gruende.push(`izinsiz dosya: ${yol}`);
    }

    // Tehlikeli git bayrakları kontrolü
    if (d.flags.rename) gruende.push(`guvensiz bayrak: rename (${yol})`);
    if (d.flags.mode) gruende.push(`guvensiz bayrak: mode (${yol})`);
    if (d.flags.symlink) gruende.push(`guvensiz bayrak: symlink (${yol})`);
    if (d.flags.binary) gruende.push(`guvensiz bayrak: binary (${yol})`);
    if (d.flags.yeniDosya) gruende.push(`guvensiz bayrak: yeniDosya (${yol})`);
    if (d.flags.silindi) gruende.push(`guvensiz bayrak: silindi (${yol})`);

    // Orijinal dosya içeriği varlığı
    if (!dateiInhalt || typeof dateiInhalt[yol] !== 'string') {
      gruende.push(`dateiInhalt eksik: ${yol}`);
      continue;
    }

    const orjinalMetin = dateiInhalt[yol];
    const orjinalSatirlar = orjinalMetin.split(/\r?\n/);

    // İskelet kümesi yalnız orijinal dosyanın veri satırlarından kurulur
    const orjinalVeriSatirlari = orjinalSatirlar.filter(
      s => veriSatiriMi(s, veriSatiri) && /^\s{2,6}\{\s*(hpnr|x):/.test(s)
    );
    const orjinalIskeletler = new Set(orjinalVeriSatirlari.map(s => iskelet(s)));

    // 5. Hunk sıralama ve çakışma kontrolü
    let oncekiAltBitis = 0;
    for (const hunk of d.hunks) {
      if (hunk.altBasla <= oncekiAltBitis) {
        gruende.push(`çakışan veya sırasız hunk: satır ${hunk.altBasla}`);
      }
      const buBitis = hunk.altUzunluk === 0 ? hunk.altBasla : hunk.altBasla + hunk.altUzunluk - 1;
      oncekiAltBitis = Math.max(oncekiAltBitis, buBitis);

      // -N,0 biçimi yalnız N geçerli satır numarasıysa
      if (hunk.altUzunluk === 0) {
        if (hunk.altBasla < 1 || hunk.altBasla > orjinalSatirlar.length) {
          gruende.push(`geçersiz satır numarası (-N,0): satır ${hunk.altBasla}`);
        }
      } else {
        const baglamVeyaSilinenVar = hunk.satirlar.some(s => s.tip === ' ' || s.tip === '-');
        if (!baglamVeyaSilinenVar) {
          gruende.push(`hunk bağlam veya silinen satır içermiyor: satır ${hunk.altBasla}`);
        }
      }
    }

    for (const hunk of d.hunks) {
      // 7. Bağlam satırları (' ') ve silinen satırlar orijinal dosyada ilgili satırda durmalı
      for (const item of hunk.satirlar) {
        if (item.tip === ' ' || item.tip === '-') {
          const idx = item.altNo - 1;
          if (idx < 0 || idx >= orjinalSatirlar.length || orjinalSatirlar[idx] !== item.satir) {
            gruende.push(`bağlam uyuşmuyor: satır ${item.altNo}`);
          }
        }
      }

      // 2. Her silinen satır veriSatiri kalıplarından birine uymalı
      for (const sil of hunk.silinen) {
        if (!veriSatiriMi(sil.satir, veriSatiri)) {
          gruende.push(`veri satırı değil: ${sil.no}`);
        }
      }

      // 2. Her eklenen satır veriSatiri kalıplarından birine uymalı
      for (const ekl of hunk.eklenen) {
        if (!veriSatiriMi(ekl.satir, veriSatiri)) {
          gruende.push(`veri satırı değil: ${ekl.no}`);
        }
      }

      // 3. Eşleme: hunk içinde art arda gelen - bloğu ile hemen ardından gelen + bloğu eşlenir
      let sIdx = 0;
      while (sIdx < hunk.satirlar.length) {
        const item = hunk.satirlar[sIdx];
        if (item.tip === ' ') {
          sIdx++;
          continue;
        }

        if (item.tip === '-') {
          const minusBlock = [];
          while (sIdx < hunk.satirlar.length && hunk.satirlar[sIdx].tip === '-') {
            minusBlock.push(hunk.satirlar[sIdx]);
            sIdx++;
          }
          const plusBlock = [];
          while (sIdx < hunk.satirlar.length && hunk.satirlar[sIdx].tip === '+') {
            plusBlock.push(hunk.satirlar[sIdx]);
            sIdx++;
          }

          if (plusBlock.length === 0) {
            for (const m of minusBlock) {
              gruende.push(`silme yasak: satır ${m.altNo}`);
            }
            continue;
          }

          if (minusBlock.length > plusBlock.length) {
            for (let i = plusBlock.length; i < minusBlock.length; i++) {
              gruende.push(`silme yasak: satır ${minusBlock[i].altNo}`);
            }
          }

          const ortakSayi = Math.min(minusBlock.length, plusBlock.length);
          for (let i = 0; i < ortakSayi; i++) {
            const sil = minusBlock[i];
            const ekl = plusBlock[i];
            const iskSil = iskelet(sil.satir);
            const iskEkl = iskelet(ekl.satir);
            if (iskSil !== iskEkl) {
              gruende.push(`iskelet uyuşmuyor: satır ${ekl.neuNo}`);
            }
            const isPreisstand = /^export const PREISSTAND =/.test(sil.satir);
            if (!isPreisstand) {
              const litSil = ilkStringLiteral(sil.satir);
              const litEkl = ilkStringLiteral(ekl.satir);
              if (litSil !== null && litEkl !== null && litSil !== litEkl) {
                gruende.push(`kod değiştirilemez: satır ${ekl.neuNo}`);
              }
            }
          }

          // Kalan plusBlock satırları eşi olmayan eklenen satırlardır
          for (let i = ortakSayi; i < plusBlock.length; i++) {
            const ekl = plusBlock[i];
            kontrolEtEsiOlmayanEkl(ekl, orjinalIskeletler, gruende);
          }
          continue;
        }

        if (item.tip === '+') {
          const plusBlock = [];
          while (sIdx < hunk.satirlar.length && hunk.satirlar[sIdx].tip === '+') {
            plusBlock.push(hunk.satirlar[sIdx]);
            sIdx++;
          }
          for (const ekl of plusBlock) {
            kontrolEtEsiOlmayanEkl(ekl, orjinalIskeletler, gruende);
          }
          continue;
        }
      }

      // Eklenen satırların genel güvenlik kuralları
      for (const ekl of hunk.eklenen) {
        const hList = eklenenSatirHatalari(ekl.satir, ekl.no, orjinalIskeletler);
        for (const h of hList) {
          gruende.push(h);
        }
      }
    }

    // 4. Sonuç içeriğinde aynı fenster bloğunda mükerrer kod kontrolü
    const dosyaSonucSatirlari = dosyaSonucunuHesapla(orjinalSatirlar, d.hunks);
    const tekrarHatalari = fensterTekrarKontrolu(dosyaSonucSatirlari);
    for (const th of tekrarHatalari) {
      gruende.push(th);
    }
  }

  if (toplamDegisiklik === 0) {
    gruende.push('bos yama');
  }

  return {
    ok: gruende.length === 0,
    gruende,
    sha256: hash,
    degisiklikler,
  };
}

/** Satırdaki literalleri sırayla ayıklar. */
function literalleriAyikla(satir) {
  const re = /'(?:[^'\\\r\n\u2028\u2029]|\\.)*'|"(?:[^"\\\r\n\u2028\u2029]|\\.)*"|(?<![\w$])(?:null|-?\d+(?:\.\d+)?)(?![\w$])/g;
  const lits = [];
  let m;
  while ((m = re.exec(satir)) !== null) {
    lits.push(m[0]);
  }
  return lits;
}

/** Satırdaki ilk tek veya çift tırnaklı anahtarı bulur; yoksa 'satır <no>' döner. */
function anahtarBul(satir, no) {
  const m = satir.match(/'(?:[^'\\\r\n\u2028\u2029]|\\.)*'|"(?:[^"\\\r\n\u2028\u2029]|\\.)*"/);
  return m ? m[0] : `satır ${no}`;
}

/**
 * Unified diff için Telegram'a uygun, deterministik satır özeti üretir.
 * En fazla 15 satır, fazlası '… ve N satır daha'.
 * Yeni satırlarda fiyat bilgisi varsa "+ '78010' 37.20 € (yeni satır)" şeklinde gösterir.
 */
export function diffOzet(patchText) {
  const dosyalar = parseDiff(patchText);
  const sonuc = [];

  for (const d of dosyalar) {
    for (const h of d.hunks) {
      const ortak = Math.min(h.silinen.length, h.eklenen.length);

      for (let i = 0; i < ortak; i++) {
        const s = h.silinen[i];
        const e = h.eklenen[i];
        const anahtar = anahtarBul(s.satir, s.no) !== `satır ${s.no}`
          ? anahtarBul(s.satir, s.no)
          : anahtarBul(e.satir, e.no);

        const litsAlt = literalleriAyikla(s.satir);
        const litsNeu = literalleriAyikla(e.satir);

        const farklar = [];
        const maxL = Math.max(litsAlt.length, litsNeu.length);
        for (let j = 0; j < maxL; j++) {
          const la = litsAlt[j];
          const ln = litsNeu[j];
          if (la !== ln) {
            if (la !== undefined && ln !== undefined) {
              farklar.push(`${la} → ${ln}`);
            } else if (la !== undefined) {
              farklar.push(`${la} → (kaldırıldı)`);
            } else {
              farklar.push(`(yok) → ${ln}`);
            }
          }
        }

        if (farklar.length > 0) {
          sonuc.push(`${anahtar}: ${farklar.join(', ')}`);
        } else {
          sonuc.push(`${anahtar}: ${s.satir.trim()} → ${e.satir.trim()}`);
        }
      }

      for (let i = ortak; i < h.silinen.length; i++) {
        const s = h.silinen[i];
        sonuc.push(`- ${anahtarBul(s.satir, s.no)} (kaldırıldı)`);
      }

      for (let i = ortak; i < h.eklenen.length; i++) {
        const e = h.eklenen[i];
        const anahtar = anahtarBul(e.satir, e.no);
        const mPreis = e.satir.match(/(?<![\w$])preis:\s*(\d+(?:\.\d+)?)/);
        if (mPreis) {
          const pVal = Number(mPreis[1]).toFixed(2);
          sonuc.push(`+ ${anahtar} ${pVal} € (yeni satır)`);
        } else {
          sonuc.push(`+ ${anahtar} (yeni satır)`);
        }
      }
    }
  }

  if (sonuc.length > 15) {
    const kalan = sonuc.length - 15;
    return [...sonuc.slice(0, 15), `… ve ${kalan} satır daha`];
  }

  return sonuc;
}

/**
 * Değeri sent tamsayısına dönüştürür ve geçerliliğini denetler.
 */
function parseCent(val) {
  if (val === null) return { ok: true, isNull: true, cent: null };
  if (val === undefined) return { ok: true, isUndefined: true, cent: null };
  if (typeof val === 'boolean') return { ok: false, error: 'geçersiz değer' };
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Number.isNaN(val)) {
      return { ok: false, error: 'geçersiz değer' };
    }
    return { ok: true, cent: Math.round(val * 100) };
  }
  if (typeof val === 'string') {
    if (/^-?\d+(\.\d{1,2})?$/.test(val.trim())) {
      return { ok: true, cent: Math.round(Number(val) * 100) };
    }
    return { ok: false, error: 'geçersiz değer' };
  }
  return { ok: false, error: 'geçersiz değer' };
}

/**
 * İki sent değerini karşılaştırır.
 */
function karsilastirCent(valA, valB) {
  const pA = parseCent(valA);
  const pB = parseCent(valB);

  if (!pA.ok || !pB.ok) {
    return { esit: false, sebep: 'geçersiz değer' };
  }
  if (pA.isNull && pB.isNull) return { esit: true };
  if (pA.isUndefined && pB.isUndefined) return { esit: true };
  if (pA.isNull || pB.isNull || pA.isUndefined || pB.isUndefined) {
    return { esit: false, sebep: `${valA} ≠ ${valB}` };
  }
  if (pA.cent !== pB.cent) {
    return { esit: false, sebep: `${valA} ≠ ${valB}` };
  }
  return { esit: true };
}

/**
 * Fiyat ve ödeme rakamlarını sent tamsayısına çevirerek karşılaştırır.
 * null yalnız null'a, undefined yalnız undefined'a eşit; '', boolean, NaN, sonsuz -> geçersiz değer.
 * Tekrarlanan kod tespiti durumunda fark listesine eklenir.
 */
export function rakamlariKarsilastir(a = [], b = []) {
  const farklar = [];

  const seenA = new Set();
  for (const item of (a || [])) {
    if (item && item.code) {
      if (seenA.has(item.code)) {
        farklar.push(`tekrar eden kod: ${item.code}`);
      }
      seenA.add(item.code);
    }
  }

  const seenB = new Set();
  for (const item of (b || [])) {
    if (item && item.code) {
      if (seenB.has(item.code)) {
        farklar.push(`tekrar eden kod: ${item.code}`);
      }
      seenB.add(item.code);
    }
  }

  const mapA = new Map((a || []).map(x => [x.code, x]));
  const mapB = new Map((b || []).map(x => [x.code, x]));

  const kodlar = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();

  for (const code of kodlar) {
    if (!mapA.has(code)) {
      farklar.push(`${code}: a'da eksik`);
      continue;
    }
    if (!mapB.has(code)) {
      farklar.push(`${code}: b'de eksik`);
      continue;
    }

    const itemA = mapA.get(code);
    const itemB = mapB.get(code);

    const resPreis = karsilastirCent(itemA.preis, itemB.preis);
    if (!resPreis.esit) {
      if (resPreis.sebep === 'geçersiz değer') {
        farklar.push(`${code} preis: geçersiz değer (${itemA.preis} vs ${itemB.preis})`);
      } else {
        farklar.push(`${code} preis: ${itemA.preis} ≠ ${itemB.preis}`);
      }
    }

    const resZu = karsilastirCent(itemA.zuzahlung, itemB.zuzahlung);
    if (!resZu.esit) {
      if (resZu.sebep === 'geçersiz değer') {
        farklar.push(`${code} zuzahlung: geçersiz değer (${itemA.zuzahlung} vs ${itemB.zuzahlung})`);
      } else {
        farklar.push(`${code} zuzahlung: ${itemA.zuzahlung} ≠ ${itemB.zuzahlung}`);
      }
    }

    if (itemA.gueltig_ab !== itemB.gueltig_ab) {
      farklar.push(`${code} gueltig_ab: ${itemA.gueltig_ab} ≠ ${itemB.gueltig_ab}`);
    }
  }

  return {
    uyusuyor: farklar.length === 0,
    farklar,
  };
}
