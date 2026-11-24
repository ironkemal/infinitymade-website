// tools/bekci-ajan/cli.mjs
// Ne: Bekçi-Ajan iş akışının çağırdığı tek komut satırı aracı (CLI) ve saf mantık fonksiyonları.
// Niye: SPEC.md §2 ve §3.0 uyarınca GitHub Actions workflow'larında yama kontrolü,
// vaka açma, vaka durumu güncelleme, Telegram bildirimi gönderme ve karar okuma adımlarını
// tek merkezden, katı güvenlik kuralları ve deterministik çıktılarla yürütmek.

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { BekciTelegram } from './telegram.mjs';
import {
  yeniVaka,
  gecis,
  mesaj,
  kaydet,
  yukle,
  listele,
  VakaHatasi,
} from './vaka.mjs';
import {
  parseDiff,
  pruefeYama,
  diffOzet,
  sha256,
} from './dogrula.mjs';

/**
 * Bekçi izinli dosya listesi şablonları (presets).
 */
export const PRESETS = {
  preise: {
    erlaubt: [/^api-backend\/billing\/codes\/(podologie|physio)_positions\.js$/],
  },
};

/**
 * Metinden kontrol karakterlerini (\u0000-\u0008) temizler.
 */
function temizleKontrol(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[\u0000-\u0008]/g, '');
}

/**
 * Dosya yolunun dogrula.mjs güvenlik kurallarına uygunluğunu denetler.
 */
export function guvenliYolMu(yol) {
  if (!yol || typeof yol !== 'string') return false;
  if (
    yol.startsWith('/') ||
    yol.includes('\\') ||
    yol.includes(':') ||
    yol.includes('\u0000') ||
    yol.split('/').includes('..') ||
    yol.includes('..')
  ) {
    return false;
  }
  return true;
}

/**
 * 1. Yama doğrulama saf fonksiyonu.
 *
 * @param {object} params
 * @param {string} params.patch - Unified git diff metni
 * @param {string|object} [params.preset='preise'] - Preset adı ('preise') veya { erlaubt: RegExp[] }
 * @param {Record<string, string>} [params.dateiInhalt={}] - Dosya yollarının orijinal içerikleri
 * @param {string} [params.beklenenSha] - Doğrulanması beklenen SHA-256 hash'i (hex)
 * @returns {{ ok: boolean, gruende: string[], sha256: string, ozet: string[] }}
 */
export function yamaKontrol({
  patch,
  preset = 'preise',
  dateiInhalt = {},
  beklenenSha = null,
} = {}) {
  const hash = sha256(patch ?? '');

  if (!patch || typeof patch !== 'string' || patch.trim().length === 0) {
    return {
      ok: false,
      gruende: ['boş yama'],
      sha256: hash,
      ozet: [],
    };
  }

  const gruende = [];

  // beklenen-sha kontrolü
  if (beklenenSha) {
    const bSha = String(beklenenSha).trim().toLowerCase();
    if (bSha !== hash.toLowerCase()) {
      gruende.push('sha uyuşmuyor');
    }
  }

  // Preset tespiti
  let erlaubt = [];
  if (typeof preset === 'string') {
    const tanim = PRESETS[preset];
    if (!tanim) {
      gruende.push('bilinmeyen preset');
    } else {
      erlaubt = tanim.erlaubt;
    }
  } else if (preset && Array.isArray(preset.erlaubt)) {
    erlaubt = preset.erlaubt;
  } else {
    gruende.push('geçersiz preset');
  }

  if (erlaubt.length > 0) {
    const dSonuc = pruefeYama(patch, { erlaubt, dateiInhalt });
    for (const g of dSonuc.gruende) {
      if (g === 'bos yama') {
        gruende.push('boş yama');
      } else {
        gruende.push(g);
      }
    }
  }

  const ozet = diffOzet(patch);

  return {
    ok: gruende.length === 0,
    gruende,
    sha256: hash,
    ozet,
  };
}

/**
 * 2. Vaka hazırlama saf fonksiyonu.
 *
 * @param {object} params
 * @param {object} params.entscheidung - preise-bewerten çıktısı ({ karar: 'vaka', vaka: {...} })
 * @param {string} [params.patch] - Varsa yama diff metni
 * @param {string[]} [params.mevcutIdler=[]] - Mevcut vaka ID'leri listesi
 * @param {Date|string} [params.simdi=new Date()] - Referans zaman
 * @returns {object} yeniVaka nesnesi
 */
export function vakaHazirla({
  entscheidung,
  patch,
  mevcutIdler = [],
  simdi = new Date(),
} = {}) {
  if (!entscheidung || entscheidung.karar !== 'vaka' || !entscheidung.vaka) {
    throw new Error('entscheidung_vaka_degil');
  }

  const v = entscheidung.vaka;
  let satirlar = Array.isArray(v.satirlar) ? [...v.satirlar] : [];
  let yamaSha256 = v.yamaSha256 || null;

  if (patch && typeof patch === 'string' && patch.trim().length > 0) {
    yamaSha256 = sha256(patch);
    const ozet = diffOzet(patch);
    satirlar.push('Değişiklik:');
    satirlar.push(...ozet);
  }

  return yeniVaka({
    bekci: v.bekci || 'preise',
    baslik: v.baslik,
    satirlar,
    dosyalar: v.dosyalar,
    yamaSha256,
    oneri: v.oneri,
    ek: v.ek,
    simdi,
    mevcutIdler,
  });
}

/**
 * 3. Vaka durumu güncelleme saf fonksiyonu (vaka.mjs köprüsü).
 *
 * @param {object} vaka - Vaka nesnesi
 * @param {'tamam'|'hata'|'uygula'} eylem - Gerçekleştirilecek eylem
 * @param {object} [opsiyonlar]
 * @param {string} [opsiyonlar.sha] - Varsa yama sha256 doğrulaması için
 * @param {Date|string} [opsiyonlar.simdi=new Date()]
 * @returns {object} Güncellenmiş yeni vaka nesnesi
 */
export function vakaDurumGuncelle(vaka, eylem, { sha = null, simdi = new Date() } = {}) {
  return gecis(vaka, eylem, { yamaSha256: sha, simdi });
}

/**
 * 4. Bildirim metni oluşturma saf fonksiyonu.
 *
 * @param {object} params
 * @param {'auto'|'vaka'|'aciklama'|'hata'|'uygulandi'|'elle'} params.tur - Bildirim türü
 * @param {string|string[]} [params.satirlar] - Dosya veya detay satırları
 * @param {object|string} [params.vaka] - Vaka nesnesi veya vaka ID'si
 * @param {string} [params.link] - İlgili GitHub run/işlem URL'si
 * @returns {{ text: string, knoepfe?: Array<Array<{ text: string, befehl: string }>>, vakaMi: boolean }}
 */
export function bildirimMetni({ tur, satirlar, vaka, link } = {}) {
  const vakaId = typeof vaka === 'string' ? vaka : (vaka?.id || '');

  function linkMetni(l) {
    if (!l) return null;
    const t = temizleKontrol(l).trim();
    if (!t) return null;
    return t.startsWith('Çalışma:') ? t : `Çalışma: ${t}`;
  }

  if (tur === 'auto') {
    const parcalar = ['🤖 Fiyat bekçisi — otomatik uygulandı (çift dikiş tuttu)'];
    if (Array.isArray(satirlar)) {
      for (const s of satirlar.slice(0, 15)) {
        const t = temizleKontrol(s);
        if (t) parcalar.push(t);
      }
    } else if (typeof satirlar === 'string' && satirlar.trim().length > 0) {
      const lines = satirlar.split(/\r?\n/).map(temizleKontrol).filter(Boolean).slice(0, 15);
      parcalar.push(...lines);
    }
    parcalar.push(":beta'ya çıktı; :stable için elle promote bekliyor.");
    const lm = linkMetni(link);
    if (lm) {
      parcalar.push(lm);
    }
    return { text: parcalar.join('\n'), vakaMi: false };
  }

  if (tur === 'vaka') {
    if (!vaka || typeof vaka !== 'object') {
      throw new Error('vaka_eksik');
    }
    const m = mesaj(vaka);
    return { text: m.text, knoepfe: m.knoepfe, vakaMi: true };
  }

  if (tur === 'aciklama') {
    const icerikRaw = typeof satirlar === 'string'
      ? satirlar
      : (Array.isArray(satirlar) ? satirlar.join('\n') : '');
    const icerik = temizleKontrol(icerikRaw).slice(0, 3000);
    const baslik = `💬 #${vakaId} açıklaması (YZ yazdı, rakamlar vakadaki satırlardan):`;
    const text = icerik ? `${baslik}\n${icerik}` : baslik;
    return { text, vakaMi: false };
  }

  if (tur === 'uygulandi') {
    const baslik = `✅ #${vakaId} uygulandı. :beta'ya çıktı; :stable için elle promote bekliyor.`;
    const lm = linkMetni(link);
    const text = lm ? `${baslik}\n${lm}` : baslik;
    return { text, vakaMi: false };
  }

  if (tur === 'elle') {
    const text = `ℹ️ #${vakaId}: bu vaka otomatik uygulanamıyor (yeni/kaybolan kod ya da doğrulanmamış rakam). Yerel oturumda yapılmalı; vaka açık kalıyor.`;
    return { text, vakaMi: false };
  }

  if (tur === 'hata') {
    let baslik = '⚠️ Bekçi-ajan çalışırken hata oldu';
    if (vakaId) {
      baslik += ` · #${vakaId}`;
    }
    const lm = linkMetni(link);
    const text = lm ? `${baslik}\n${lm}` : baslik;
    return { text, vakaMi: false };
  }

  throw new Error(`gecersiz_tur: ${tur}`);
}

/**
 * 5. Karar okuma saf fonksiyonu.
 *
 * @param {object} obj - preise-bewerten JSON çıktısı
 * @returns {{ karar: string, erlaube_sprung: string }}
 */
export function kararOku(obj) {
  if (!obj || typeof obj !== 'object' || typeof obj.karar !== 'string') {
    throw new Error('gecersiz_karar');
  }

  const rawSprung = obj.erlaubeSprung || obj.erlaube_sprung || [];
  if (!Array.isArray(rawSprung)) {
    throw new Error('gecersiz_erlaube_sprung');
  }

  for (const c of rawSprung) {
    if (typeof c !== 'string' || !/^[A-Z0-9]{4,6}$/.test(c)) {
      throw new Error(`gecersiz_kod: ${c}`);
    }
  }

  return {
    karar: obj.karar,
    erlaube_sprung: rawSprung.join(','),
  };
}

/**
 * Komut satırı argümanlarını ayrıştırır.
 */
export function parseArgs(rawArgs) {
  const komut = rawArgs[0] && !rawArgs[0].startsWith('-') ? rawArgs[0] : null;
  const args = komut ? rawArgs.slice(1) : rawArgs;
  const flags = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eqIdx = a.indexOf('=');
      if (eqIdx !== -1) {
        const key = a.slice(2, eqIdx);
        const val = a.slice(eqIdx + 1);
        flags[key] = val;
      } else {
        const key = a.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          flags[key] = args[++i];
        } else {
          flags[key] = true;
        }
      }
    }
  }

  return { komut, flags };
}

/**
 * CLI ana fonksiyonu.
 *
 * Çıkış kodları:
 * 0: Başarı
 * 1: Hata / Ret
 * 2: Kullanım hatası
 */
export async function cli(rawArgs = process.argv.slice(2)) {
  const { komut, flags } = parseArgs(rawArgs);

  if (!komut) {
    console.error('Kullanım: node tools/bekci-ajan/cli.mjs <komut> --anahtar=değer ...');
    process.exit(2);
  }

  // 1. yama-kontrol
  if (komut === 'yama-kontrol') {
    const patchFile = flags.patch;
    const preset = flags.preset;
    const beklenenSha = flags['beklenen-sha'];
    const outFile = flags.out;

    if (!patchFile || !preset) {
      console.error('Eksik parametre: --patch ve --preset zorunludur');
      process.exit(2);
    }

    if (preset !== 'preise' && !PRESETS[preset]) {
      console.error(`Bilinmeyen preset: ${preset}`);
      process.exit(2);
    }

    let patchText = '';
    try {
      patchText = readFileSync(patchFile, 'utf-8');
    } catch {
      console.error(`Yama dosyası okunamadı: ${patchFile}`);
      process.exit(1);
    }

    const dateiInhalt = {};
    if (patchText.trim().length > 0) {
      const diffFiles = parseDiff(patchText);
      for (const df of diffFiles) {
        const yol = df.neu || df.alt;
        if (!yol || !guvenliYolMu(yol)) continue;

        try {
          const icerik = execFileSync('git', ['show', `HEAD:${yol}`], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          dateiInhalt[yol] = icerik;
        } catch {
          // git show başarısız olursa dateiInhalt eklenmez; pruefeYama bildirecektir
        }
      }
    }

    const sonuc = yamaKontrol({
      patch: patchText,
      preset,
      dateiInhalt,
      beklenenSha,
    });

    if (outFile) {
      try {
        writeFileSync(outFile, JSON.stringify(sonuc, null, 2), 'utf-8');
      } catch {
        console.error(`Çıktı dosyasına yazılamadı: ${outFile}`);
        process.exit(1);
      }
    }

    if (!sonuc.ok) {
      console.error(`Yama kontrolü başarısız: ${sonuc.gruende.join('; ')}`);
      process.exit(1);
    }

    process.exit(0);
  }

  // 2. vaka-ac
  if (komut === 'vaka-ac') {
    const entscheidungFile = flags.entscheidung;
    const dizin = flags.dizin;
    const patchFile = flags.patch;
    const outIdFile = flags['out-id'];

    if (!entscheidungFile || !dizin) {
      console.error('Eksik parametre: --entscheidung ve --dizin zorunludur');
      process.exit(2);
    }

    let entscheidung = null;
    try {
      const raw = readFileSync(entscheidungFile, 'utf-8');
      entscheidung = JSON.parse(raw);
    } catch {
      console.error(`Entscheidung dosyası okunamadı veya JSON geçersiz: ${entscheidungFile}`);
      process.exit(1);
    }

    let patch = null;
    if (patchFile) {
      try {
        patch = readFileSync(patchFile, 'utf-8');
      } catch {
        console.error(`Yama dosyası okunamadı: ${patchFile}`);
        process.exit(1);
      }
    }

    let mevcutVakalar = [];
    try {
      mevcutVakalar = await listele(dizin);
    } catch {
      mevcutVakalar = [];
    }
    const mevcutIdler = mevcutVakalar.map(v => v.id);

    let vaka;
    try {
      vaka = vakaHazirla({ entscheidung, patch, mevcutIdler });
    } catch (err) {
      console.error(`Vaka hazırlanamadı: ${err.message}`);
      process.exit(1);
    }

    try {
      await kaydet(dizin, vaka);
    } catch (err) {
      console.error(`Vaka kaydedilemedi: ${err.message}`);
      process.exit(1);
    }

    console.log(vaka.id);

    if (outIdFile) {
      try {
        writeFileSync(outIdFile, vaka.id + '\n', 'utf-8');
      } catch {
        console.error(`Vaka ID çıktısı yazılamadı: ${outIdFile}`);
        process.exit(1);
      }
    }

    process.exit(0);
  }

  // 3. vaka-durum
  if (komut === 'vaka-durum') {
    const dizin = flags.dizin;
    const id = flags.id;
    const eylem = flags.eylem;
    const sha = flags.sha;

    if (!dizin || !id || !eylem) {
      console.error('Eksik parametre: --dizin, --id ve --eylem zorunludur');
      process.exit(2);
    }

    if (!['tamam', 'hata', 'uygula'].includes(eylem)) {
      console.error(`Geçersiz eylem: ${eylem} (tamam | hata | uygula bekleniyor)`);
      process.exit(2);
    }

    let vaka;
    try {
      vaka = await yukle(dizin, id);
    } catch {
      console.error(`Vaka bulunamadı: ${id}`);
      process.exit(1);
    }

    let yeniVaka;
    try {
      yeniVaka = vakaDurumGuncelle(vaka, eylem, { sha });
    } catch (err) {
      console.error(`Vaka durumu güncellenemedi: ${err.message}`);
      process.exit(1);
    }

    try {
      await kaydet(dizin, yeniVaka);
    } catch (err) {
      console.error(`Vaka kaydedilemedi: ${err.message}`);
      process.exit(1);
    }

    process.exit(0);
  }

  // 4. bildir
  if (komut === 'bildir') {
    const tur = flags.tur;
    const dosya = flags.dosya;
    const dizin = flags.dizin;
    const id = flags.id;
    const link = flags.link;

    if (!tur || !['auto', 'vaka', 'aciklama', 'hata', 'uygulandi', 'elle'].includes(tur)) {
      console.error('Eksik veya geçersiz --tur (auto|vaka|aciklama|hata|uygulandi|elle)');
      process.exit(2);
    }

    const token = process.env.TELEGRAM_BEKCI_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_BEKCI_CHAT_ID;
    const userId = process.env.TELEGRAM_BEKCI_USER_ID;

    if (!token || !chatId || !userId) {
      console.log('Bekçi-Bot nicht konfiguriert');
      process.exit(0);
    }

    if (tur === 'vaka' && (!dizin || !id)) {
      console.error('tur=vaka için --dizin ve --id zorunludur');
      process.exit(2);
    }

    if (['aciklama', 'uygulandi', 'elle'].includes(tur) && !id) {
      console.error(`tur=${tur} için --id zorunludur`);
      process.exit(2);
    }

    let satirlar = '';
    if (dosya) {
      try {
        satirlar = readFileSync(dosya, 'utf-8');
      } catch {
        console.error(`Dosya okunamadı: ${dosya}`);
        process.exit(1);
      }
    }

    let vaka = null;
    if (dizin && id) {
      try {
        vaka = await yukle(dizin, id);
      } catch {
        if (tur === 'vaka') {
          console.error(`Vaka bulunamadı: ${id}`);
          process.exit(1);
        }
      }
    }
    if (!vaka && id) {
      vaka = { id };
    }

    let bildirim;
    try {
      bildirim = bildirimMetni({ tur, satirlar, vaka, link });
    } catch (err) {
      console.error(`Bildirim oluşturulamadı: ${err.message}`);
      process.exit(1);
    }

    try {
      const tg = new BekciTelegram({ token, chatId, userId });
      if (bildirim.vakaMi) {
        await tg.sendeVaka(vaka);
      } else {
        await tg.sendeKisa(bildirim.text);
      }
    } catch {
      console.error('Telegram bildirimi gönderilemedi');
      process.exit(1);
    }

    process.exit(0);
  }

  // 5. karar-oku
  if (komut === 'karar-oku') {
    const file = flags.file;
    if (!file) {
      console.error('Eksik parametre: --file zorunludur');
      process.exit(2);
    }

    let obj;
    try {
      const raw = readFileSync(file, 'utf-8');
      obj = JSON.parse(raw);
    } catch {
      console.error(`Dosya okunamadı veya geçersiz JSON: ${file}`);
      process.exit(1);
    }

    let sonuc;
    try {
      sonuc = kararOku(obj);
    } catch (err) {
      console.error(`Karar okunamadı: ${err.message}`);
      process.exit(1);
    }

    console.log(`karar=${sonuc.karar}`);
    console.log(`erlaube_sprung=${sonuc.erlaube_sprung}`);

    if (process.env.GITHUB_OUTPUT) {
      try {
        appendFileSync(
          process.env.GITHUB_OUTPUT,
          `karar=${sonuc.karar}\nerlaube_sprung=${sonuc.erlaube_sprung}\n`,
          'utf-8'
        );
      } catch {}
    }

    process.exit(0);
  }

  console.error(`Bilinmeyen komut: ${komut}`);
  process.exit(2);
}

// Yalnızca doğrudan komut satırından çalıştırıldığında CLI'ı tetikle
function isDirectExecution() {
  if (!process.argv[1]) return false;
  try {
    const executedPath = resolve(process.argv[1]).toLowerCase();
    const currentFilePath = fileURLToPath(import.meta.url).toLowerCase();
    return executedPath === currentFilePath;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  cli().catch(() => {
    process.exit(1);
  });
}
