// tools/bekci-ajan/rapor.mjs
// Ne: Bekçi-Ajan haftalık raporlama, olay defteri (olaylar.jsonl) ve hata takip modülü.
// Niye: Kemal'in 25.11.2026 talimatı uyarınca: "Bana yalnız aksiyon almam gereken mesaj gelsin.
// Kendi uyguladığını tek tek yazma, haftada bir rapor ver."

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { berlinGunu } from './vaka.mjs';

export const GECERLI_OLAY_TURLERI = new Set([
  'auto',
  'uygulandi',
  'birakildi',
  'hata',
  'takili',
  'sessiz',
  'elle',
]);

/**
 * Metinden kontrol karakterlerini (\u0000-\u0008, \u000B-\u001F, \u007F) temizler,
 * satır sonlarını boşluğa çevirir ve tek satır ≤ 300 karakter yapar.
 */
function temizleOzet(metin) {
  if (metin === null || metin === undefined) return '';
  return String(metin)
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 300);
}

/**
 * Tarihi Europe/Berlin saat diliminde DD.MM formatına dönüştürür.
 */
function formatGgAa(date) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(d);
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  return `${day}.${month}`;
}

/**
 * Olay defterine (kokDizin/rapor/olaylar.jsonl) yeni bir satır ekler.
 *
 * @param {string} kokDizin - vakalar dalının kök dizini
 * @param {object} params
 * @param {string} params.bekci - Bekçi adı (preise | quellen | kostentraeger vs.)
 * @param {'auto'|'uygulandi'|'birakildi'|'hata'|'takili'|'sessiz'} params.tur - Olay türü
 * @param {string} params.ozet - Düz Türkçe tek cümle ≤ 300
 * @param {Date|string} [params.simdi=new Date()]
 * @returns {Promise<object>} Eklenen olay nesnesi
 */
export async function olayEkle(kokDizin, { bekci, tur, ozet, simdi = new Date() }) {
  if (!kokDizin || typeof kokDizin !== 'string') {
    throw new Error('gecersiz_kok_dizin');
  }
  if (!GECERLI_OLAY_TURLERI.has(tur)) {
    throw new Error(`gecersiz_olay_turu: ${tur}`);
  }

  const simdiDate = simdi instanceof Date ? simdi : new Date(simdi);
  const olay = {
    bekci: String(bekci || 'preise'),
    tur,
    ozet: temizleOzet(ozet),
    zaman: simdiDate.toISOString(),
  };

  const raporDir = path.join(kokDizin, 'rapor');
  await mkdir(raporDir, { recursive: true });
  const dosyaYolu = path.join(raporDir, 'olaylar.jsonl');
  const satir = JSON.stringify(olay) + '\n';

  // Dosyaya ekle (append)
  let mevcut = '';
  if (existsSync(dosyaYolu)) {
    try {
      mevcut = await readFile(dosyaYolu, 'utf-8');
    } catch {
      mevcut = '';
    }
  }
  await writeFile(dosyaYolu, mevcut + satir, 'utf-8');
  return olay;
}

/**
 * kokDizin/rapor/olaylar.jsonl dosyasındaki tüm olayları okur.
 */
export async function olaylariYukle(kokDizin) {
  if (!kokDizin) return [];
  const dosyaYolu = path.join(kokDizin, 'rapor', 'olaylar.jsonl');
  if (!existsSync(dosyaYolu)) return [];

  try {
    const icerik = await readFile(dosyaYolu, 'utf-8');
    return icerik
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Son 7 günde (Europe/Berlin) gerçekleşen olaylara göre sade dille haftalık rapor üretir.
 *
 * @param {object} params
 * @param {Array<object>} params.olaylar
 * @param {Array<object>|number} [params.acikVakalar=[]]
 * @param {Date|string} [params.simdi=new Date()]
 * @returns {string} Telegram metni
 */
export function haftalikRapor({ olaylar = [], acikVakalar = [], simdi = new Date() }) {
  const simdiDate = simdi instanceof Date ? simdi : new Date(simdi);
  const baslangicDate = new Date(simdiDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const ggAaBaslangic = formatGgAa(baslangicDate);
  const ggAaBitis = formatGgAa(simdiDate);

  const simdiGunStr = berlinGunu(simdiDate);
  const baslangicGunStr = berlinGunu(baslangicDate);

  // Son 7 günün olayları
  const sonOlaylar = (Array.isArray(olaylar) ? olaylar : []).filter(o => {
    if (!o || !o.zaman) return false;
    const oGun = berlinGunu(o.zaman);
    return oGun >= baslangicGunStr && oGun <= simdiGunStr;
  });

  // Kendim hallettiklerim: 'auto' veya 'uygulandi' olayları
  const halledilenler = sonOlaylar.filter(o => o.tur === 'auto' || o.tur === 'uygulandi');

  const parcalar = [];
  parcalar.push(`📋 Haftalık bekçi raporu (${ggAaBaslangic} – ${ggAaBitis})`);
  parcalar.push('');
  parcalar.push('Kendim hallettiklerim:');

  if (halledilenler.length === 0) {
    parcalar.push('Bu hafta resmî kaynaklarda bizi ilgilendiren bir değişiklik olmadı.');
  } else {
    const ilk10 = halledilenler.slice(0, 10);
    for (const h of ilk10) {
      parcalar.push(`• ${h.ozet}`);
    }
    if (halledilenler.length > 10) {
      parcalar.push(`… ve ${halledilenler.length - 10} tane daha`);
    }
  }

  parcalar.push('');

  // Senin kararını bekleyenler
  let nAcik = 0;
  if (Array.isArray(acikVakalar)) {
    nAcik = acikVakalar.filter(v => v.durum === 'acik' || v.durum === 'uygulaniyor').length;
  } else if (typeof acikVakalar === 'number') {
    nAcik = acikVakalar;
  }

  if (nAcik > 0) {
    parcalar.push(`Senin kararını bekleyenler: ${nAcik} → /vakalar`);
  } else {
    parcalar.push('Senin kararını bekleyenler: Senden beklediğim bir karar yok ✅');
  }

  // Sorunlar (yalnız bu hafta hata olduysa)
  const hatalar = sonOlaylar.filter(o => o.tur === 'hata');
  if (hatalar.length > 0) {
    const hataOzetleri = hatalar.map(h => h.ozet).filter(Boolean);
    const ozetMetin = hataOzetleri.length > 0 ? hataOzetleri.join('; ') : 'Bekçi çalışırken hata oluştu';
    parcalar.push('');
    parcalar.push(`Sorun: ${ozetMetin}`);
    parcalar.push('Senin yapacağın bir şey yok — Claude\'a "bekçi hatalarına bak" demen yeterli.');
  }

  return parcalar.join('\n');
}

/**
 * Aynı bekçinin son iki olayı ikisi de 'hata' ise true döner.
 *
 * @param {Array<object>} olaylar - Kronolojik olay dizisi
 * @param {string} bekci - Bekçi adı
 * @returns {boolean}
 */
export function ikinciHataMi(olaylar = [], bekci) {
  if (!bekci || !Array.isArray(olaylar)) return false;
  const bekciOlaylari = olaylar.filter(o => o && o.bekci === bekci);
  if (bekciOlaylari.length < 2) return false;
  const sonIki = bekciOlaylari.slice(-2);
  return sonIki[0].tur === 'hata' && sonIki[1].tur === 'hata';
}

/**
 * 60 günden eski satırları olaylar.jsonl dosyasından siler.
 *
 * @param {string} kokDizin - vakalar dalının kök dizini
 * @param {Date|string} [simdi=new Date()]
 * @returns {Promise<number>} Kalan satır sayısı
 */
export async function eskiOlaylariBuda(kokDizin, simdi = new Date()) {
  if (!kokDizin) return 0;
  const dosyaYolu = path.join(kokDizin, 'rapor', 'olaylar.jsonl');
  if (!existsSync(dosyaYolu)) return 0;

  const simdiDate = simdi instanceof Date ? simdi : new Date(simdi);
  const esikZaman = simdiDate.getTime() - 60 * 24 * 60 * 60 * 1000;

  const olaylar = await olaylariYukle(kokDizin);
  const kalanlar = olaylar.filter(o => {
    if (!o.zaman) return false;
    const t = new Date(o.zaman).getTime();
    return t >= esikZaman;
  });

  const yeniIcerik = kalanlar.length > 0 ? kalanlar.map(o => JSON.stringify(o)).join('\n') + '\n' : '';
  await writeFile(dosyaYolu, yeniIcerik, 'utf-8');
  return kalanlar.length;
}
