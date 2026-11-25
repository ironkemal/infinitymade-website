// tools/bekci-ajan/rapor.mjs
// Ne: Bekçi-Ajan haftalık raporlama, olay defteri (olaylar.jsonl), takip listesi (takip.jsonl) ve hata takip modülü.
// Niye: Kemal'in 25.11.2026 talimatı uyarınca: "Bana yalnız aksiyon almam gereken mesaj gelsin.
// Zaten okey olan, risksiz şeyleri kendisi uygulasın, bana hafta sonunda '6 tane uygulandı' diye rapor versin."

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
 * @param {'auto'|'uygulandi'|'birakildi'|'hata'|'takili'|'sessiz'|'elle'} params.tur - Olay türü
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
 * kokDizin/rapor/takip.jsonl dosyasındaki takip kayıtlarını okur.
 *
 * @param {string} kokDizin
 * @returns {Promise<Array<object>>}
 */
export async function takipYukle(kokDizin) {
  if (!kokDizin) return [];
  const dosyaYolu = path.join(kokDizin, 'rapor', 'takip.jsonl');
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
 * Takip listesine (kokDizin/rapor/takip.jsonl) yeni bir madde ekler.
 * Aynı quelleId + is tekrarlanmaz.
 *
 * @param {string} kokDizin
 * @param {object} params
 * @param {string} params.quelleId
 * @param {string} params.is - ≤ 200, sade Türkçe, ne yapılacak
 * @param {string|null} [params.son_tarih=null] - YYYY-MM-DD takvim tarihi veya null
 * @param {Date|string} [params.simdi=new Date()]
 * @returns {Promise<object>} Eklenen veya mevcut takip nesnesi
 */
export async function takipEkle(kokDizin, { quelleId, is, son_tarih = null, simdi = new Date() }) {
  if (!kokDizin || typeof kokDizin !== 'string') {
    throw new Error('gecersiz_kok_dizin');
  }
  const qId = String(quelleId || '');
  const isTemiz = temizleOzet(is).slice(0, 200);
  if (!isTemiz) {
    throw new Error('gecersiz_is');
  }

  const simdiDate = simdi instanceof Date ? simdi : new Date(simdi);
  const raporDir = path.join(kokDizin, 'rapor');
  await mkdir(raporDir, { recursive: true });
  const dosyaYolu = path.join(raporDir, 'takip.jsonl');

  const mevcut = await takipYukle(kokDizin);
  const varOlan = mevcut.find(t => t.quelleId === qId && t.is === isTemiz && t.durum !== 'kapandi');
  if (varOlan) {
    return varOlan;
  }

  const kayit = {
    quelleId: qId,
    is: isTemiz,
    son_tarih: son_tarih || null,
    durum: 'acik',
    zaman: simdiDate.toISOString(),
  };

  const satir = JSON.stringify(kayit) + '\n';
  let icerik = '';
  if (existsSync(dosyaYolu)) {
    try {
      icerik = await readFile(dosyaYolu, 'utf-8');
    } catch {
      icerik = '';
    }
  }
  await writeFile(dosyaYolu, icerik + satir, 'utf-8');
  return kayit;
}

/**
 * Takip listesindeki açık maddeyi kapatır (durum = 'kapandi').
 *
 * @param {string} kokDizin
 * @param {object} params
 * @param {string} params.quelleId
 * @param {string} params.is
 * @returns {Promise<number>} Kapatılan madde sayısı
 */
export async function takipKapat(kokDizin, { quelleId, is }) {
  if (!kokDizin || typeof kokDizin !== 'string') {
    throw new Error('gecersiz_kok_dizin');
  }
  const qId = String(quelleId || '');
  const isTemiz = temizleOzet(is).slice(0, 200);

  const dosyaYolu = path.join(kokDizin, 'rapor', 'takip.jsonl');
  if (!existsSync(dosyaYolu)) return 0;

  const mevcut = await takipYukle(kokDizin);
  let kapatilanSayi = 0;
  for (const t of mevcut) {
    if (t.quelleId === qId && t.is === isTemiz && t.durum === 'acik') {
      t.durum = 'kapandi';
      t.kapanis = new Date().toISOString();
      kapatilanSayi++;
    }
  }

  if (kapatilanSayi > 0) {
    const yeniIcerik = mevcut.map(t => JSON.stringify(t)).join('\n') + '\n';
    await writeFile(dosyaYolu, yeniIcerik, 'utf-8');
  }

  return kapatilanSayi;
}

/**
 * Son 7 günde (Europe/Berlin) gerçekleşen olaylara ve takip listesine göre haftalık rapor üretir.
 *
 * @param {object} params
 * @param {Array<object>} params.olaylar
 * @param {Array<object>|number} [params.acikVakalar=[]]
 * @param {Array<object>} [params.takipler=[]]
 * @param {Date|string} [params.simdi=new Date()]
 * @returns {string} Telegram metni
 */
export function haftalikRapor({ olaylar = [], acikVakalar = [], takipler = [], simdi = new Date() }) {
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
  parcalar.push(`Bu hafta kendim uyguladıklarım (${halledilenler.length}):`);

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

  // Takip listesi (tarihi yaklaşan önce)
  const acikTakipler = (Array.isArray(takipler) ? takipler : []).filter(
    t => t && t.durum !== 'kapandi'
  );
  if (acikTakipler.length > 0) {
    parcalar.push('');
    parcalar.push('Takip listesi (tarihi yaklaşan önce):');

    const sirali = [...acikTakipler].sort((a, b) => {
      const aTarih = a.son_tarih;
      const bTarih = b.son_tarih;
      if (aTarih && bTarih) {
        return aTarih.localeCompare(bTarih);
      }
      if (aTarih && !bTarih) return -1;
      if (!aTarih && bTarih) return 1;
      return 0;
    });

    for (const t of sirali) {
      let tarihMetni = 'tarih yok';
      let saatVar = false;

      if (t.son_tarih && /^\d{4}-\d{2}-\d{2}$/.test(t.son_tarih)) {
        const [y, m, d] = t.son_tarih.split('-');
        tarihMetni = `${d}.${m}.${y}`;

        // 30 günden yakın kontrolü (hedef <= simdi + 30 gün)
        const simdiUtcMidnight = Date.UTC(
          simdiDate.getUTCFullYear(),
          simdiDate.getUTCMonth(),
          simdiDate.getUTCDate()
        );
        const hedefUtcMidnight = Date.UTC(Number(y), Number(m) - 1, Number(d));
        const farkGun = (hedefUtcMidnight - simdiUtcMidnight) / (24 * 60 * 60 * 1000);
        if (farkGun <= 30) {
          saatVar = true;
        }
      }

      const ikon = saatVar ? '⏰ ' : '';
      parcalar.push(`• ${ikon}${tarihMetni} — ${t.is}`);
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
