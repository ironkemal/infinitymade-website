// tools/bekci-ajan/vaka.mjs
// Ne: Bekçi-Ajan vaka veri modeli, durum makinesi, mesaj formatlayıcı ve dosya işlemleri.
// Niye: SPEC.md §2.2 uyarınca doğrulayıcının tespit ettiği uyuşmazlıklarda açılan vakaların
// Berlin saat diliminde deterministik id üretimi, güvenli durum geçişleri (acik → uygulaniyor →
// uygulandi | birakildi) ve path traversal korumalı JSON dosya yönetimini sağlar.

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const ID_RE = /^\d{8}-[a-z][a-z-]{1,24}-\d{1,3}$/;
export const DURUMLAR = ['acik', 'uygulaniyor', 'uygulandi', 'birakildi'];

export class VakaHatasi extends Error {
  constructor(mesaj) {
    super(mesaj);
    this.name = 'VakaHatasi';
  }
}

/** Tarihi Europe/Berlin saat diliminde YYYY-MM-DD olarak döner. */
export function berlinGunu(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d);
}

/** İki tarih arasındaki Berlin takvim günü farkını (tarih2 - tarih1) döner. */
export function gunFarki(tarih1, tarih2) {
  const d1 = new Date(berlinGunu(tarih1) + 'T00:00:00Z');
  const d2 = new Date(berlinGunu(tarih2) + 'T00:00:00Z');
  return Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Yeni bir vaka nesnesi oluşturur.
 * id: JJJJMMTT-<bekci>-<n> (Europe/Berlin günü + mevcutIdler sayacı)
 */
export function yeniVaka({
  bekci,
  baslik,
  satirlar = [],
  dosyalar = [],
  yamaSha256 = null,
  oneri = null,
  ek = null,
  mesajId = null,
  simdi = new Date(),
  mevcutIdler = [],
}) {
  if (typeof bekci !== 'string' || !/^[a-z][a-z-]{1,24}$/.test(bekci)) {
    throw new VakaHatasi('gecersiz_bekci');
  }

  const d = simdi instanceof Date ? simdi : new Date(simdi);
  const gun = berlinGunu(d).replace(/-/g, '');
  const prefix = `${gun}-${bekci}-`;

  let maxN = 0;
  for (const mid of mevcutIdler) {
    if (typeof mid === 'string' && mid.startsWith(prefix)) {
      const rest = mid.slice(prefix.length);
      const num = parseInt(rest, 10);
      if (!Number.isNaN(num) && String(num) === rest && num > maxN) {
        maxN = num;
      }
    }
  }

  const id = `${prefix}${maxN + 1}`;
  if (!ID_RE.test(id)) {
    throw new VakaHatasi(`gecersiz_id_uretildi: ${id}`);
  }

  let sha = null;
  if (yamaSha256 !== null && yamaSha256 !== undefined) {
    const s = String(yamaSha256).trim();
    if (!/^[0-9a-fA-F]{64}$/.test(s)) {
      throw new VakaHatasi('gecersiz_sha');
    }
    sha = s.toLowerCase();
  }

  const temizSatirlar = (Array.isArray(satirlar) ? satirlar : [])
    .slice(0, 20)
    .map(s => String(s ?? '').slice(0, 300));

  const temizDosyalar = (Array.isArray(dosyalar) ? dosyalar : []).map(f => String(f ?? ''));
  const temizOneri = oneri != null ? String(oneri).slice(0, 600) : null;

  let temizEk = null;
  if (ek !== null && ek !== undefined) {
    if (
      typeof ek !== 'object' ||
      Array.isArray(ek) ||
      Object.prototype.toString.call(ek) !== '[object Object]'
    ) {
      throw new VakaHatasi('gecersiz_ek');
    }
    let jsonStr;
    try {
      jsonStr = JSON.stringify(ek);
    } catch {
      throw new VakaHatasi('gecersiz_ek');
    }
    if (jsonStr === undefined || jsonStr.length > 2000) {
      throw new VakaHatasi('ek_boyut_siniri');
    }
    temizEk = JSON.parse(jsonStr);
  }

  let temizMesajId = null;
  if (mesajId !== null && mesajId !== undefined) {
    const num = Number(mesajId);
    if (Number.isInteger(num) && num > 0) {
      temizMesajId = num;
    }
  }

  return {
    id,
    bekci,
    olusturma: d.toISOString(),
    durum: 'acik',
    baslik: String(baslik ?? ''),
    satirlar: temizSatirlar,
    dosyalar: temizDosyalar,
    yamaSha256: sha,
    oneri: temizOneri,
    ek: temizEk,
    mesajId: temizMesajId,
    hatirlatma: 0,
    sonHatirlatma: null,
    gecmis: [{ zaman: d.toISOString(), eylem: 'olusturuldu' }],
  };
}

/**
 * Vakaya Telegram message_id bilgisini yazar ve yeni bir kopya döner (değişmezlik kuralı).
 */
export function mesajIdYaz(vaka, id) {
  if (!vaka || typeof vaka !== 'object') {
    throw new VakaHatasi('gecersiz_vaka');
  }
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    throw new VakaHatasi('gecersiz_mesaj_id');
  }
  const yeni = structuredClone(vaka);
  yeni.mesajId = num;
  return yeni;
}

/**
 * Vaka durumunu bir sonraki duruma geçirir. Girdi nesnesini değiştirmez.
 */
export function gecis(vaka, eylem, { simdi = new Date(), yamaSha256 = null } = {}) {
  if (!vaka || typeof vaka !== 'object') {
    throw new VakaHatasi('gecersiz_vaka');
  }
  if (vaka.durum === 'uygulandi' || vaka.durum === 'birakildi') {
    throw new VakaHatasi('kapali');
  }

  const yeni = structuredClone(vaka);
  const d = simdi instanceof Date ? simdi : new Date(simdi);
  const zaman = d.toISOString();

  if (vaka.durum === 'acik') {
    if (eylem === 'uygula') {
      if (vaka.yamaSha256) {
        if (!yamaSha256 || String(yamaSha256).toLowerCase() !== vaka.yamaSha256.toLowerCase()) {
          throw new VakaHatasi('sha');
        }
      }
      yeni.durum = 'uygulaniyor';
    } else if (eylem === 'birak') {
      yeni.durum = 'birakildi';
    } else if (eylem === 'acikla') {
      yeni.durum = 'acik';
    } else if (eylem === 'hatirlat') {
      yeni.durum = 'acik';
      yeni.hatirlatma = (yeni.hatirlatma || 0) + 1;
      yeni.sonHatirlatma = zaman;
    } else {
      throw new VakaHatasi(`gecersiz_eylem: ${eylem}`);
    }
  } else if (vaka.durum === 'uygulaniyor') {
    if (eylem === 'tamam') {
      yeni.durum = 'uygulandi';
    } else if (eylem === 'hata') {
      yeni.durum = 'acik';
    } else {
      throw new VakaHatasi(`gecersiz_eylem: ${eylem}`);
    }
  } else {
    throw new VakaHatasi(`gecersiz_durum: ${vaka.durum}`);
  }

  yeni.gecmis = Array.isArray(yeni.gecmis) ? [...yeni.gecmis] : [];
  yeni.gecmis.push({ zaman, eylem });

  return yeni;
}

/**
 * Vaka için Telegram mesaj metni ve inline klavye düğmelerini üretir.
 */
export function mesaj(vaka) {
  const satirlar = [];
  satirlar.push(`⚠️ ${vaka.bekci} · ${vaka.baslik}`);

  if (Array.isArray(vaka.satirlar)) {
    for (const s of vaka.satirlar) {
      satirlar.push(s);
    }
  }

  if (Array.isArray(vaka.dosyalar) && vaka.dosyalar.length > 0) {
    satirlar.push(`Dosya: ${vaka.dosyalar.join(', ')}`);
  }

  if (vaka.yamaSha256) {
    satirlar.push(`Yama: ${vaka.yamaSha256.slice(0, 12)}`);
  }

  if (vaka.oneri) {
    satirlar.push('');
    satirlar.push('Ajan önerisi (YZ — rakamlar yukarıdaki satırlardan):');
    satirlar.push(vaka.oneri);
  }

  if (vaka.ek?.uygulanabilir === false) {
    satirlar.push('');
    satirlar.push('(Bu vaka otomatik uygulanamaz — yerel oturumda yapılır.)');
  }

  satirlar.push('');
  satirlar.push(`#${vaka.id}`);

  let knoepfe;
  if (vaka.durum === 'acik') {
    if (vaka.ek?.uygulanabilir === false) {
      knoepfe = [
        [
          { text: '❌ Bırak', befehl: `v:${vaka.id}:birak` },
        ],
        [
          { text: '💬 Açıkla', befehl: `v:${vaka.id}:acikla` },
        ],
      ];
    } else {
      knoepfe = [
        [
          { text: '✅ Uygula', befehl: `v:${vaka.id}:uygula` },
          { text: '❌ Bırak', befehl: `v:${vaka.id}:birak` },
        ],
        [
          { text: '💬 Açıkla', befehl: `v:${vaka.id}:acikla` },
        ],
      ];
    }
  }

  return { text: satirlar.join('\n'), knoepfe };
}

/**
 * Vaka için bugün hatırlatma yapılması gerekip gerekmediğini kontrol eder.
 * Kural (Kemal 25.11.2026): Son hatırlatmadan (yoksa oluşturmadan) bu yana ≥ 3 Berlin günü geçtiyse true.
 */
export function hatirlatmaGerekli(vaka, simdi = new Date()) {
  if (vaka.durum !== 'acik') return false;
  const refTarih = vaka.sonHatirlatma || vaka.olusturma;
  const fark = gunFarki(refTarih, simdi);
  return fark >= 3;
}

/**
 * Açık vakanın 14 günden eski olup olmadığını denetler.
 */
export function eskidi(vaka, simdi = new Date()) {
  if (vaka.durum !== 'acik') return false;
  const s = (simdi instanceof Date ? simdi : new Date(simdi)).getTime();
  const o = new Date(vaka.olusturma).getTime();
  return (s - o) >= 14 * 24 * 60 * 60 * 1000;
}

/**
 * Vakayı dizin/<id>.json dosyasına kaydeder.
 */
export async function kaydet(dizin, vaka) {
  if (!vaka || !vaka.id || !ID_RE.test(vaka.id)) {
    throw new VakaHatasi('gecersiz_id');
  }
  await mkdir(dizin, { recursive: true });
  const dosya = path.join(dizin, `${vaka.id}.json`);
  await writeFile(dosya, JSON.stringify(vaka, null, 2), 'utf-8');
}

/**
 * dizin/<id>.json dosyasından vakayı okur.
 */
export async function yukle(dizin, id) {
  if (!id || !ID_RE.test(id)) {
    throw new VakaHatasi('gecersiz_id');
  }
  const dosya = path.join(dizin, `${id}.json`);
  const icerik = await readFile(dosya, 'utf-8');
  return JSON.parse(icerik);
}

/**
 * dizin altındaki tüm ID_RE uyumlu vaka dosyalarını olusturma tarihine göre sıralı döner.
 */
export async function listele(dizin) {
  let dosyalar;
  try {
    dosyalar = await readdir(dizin);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const vakalar = [];
  for (const d of dosyalar) {
    if (!d.endsWith('.json')) continue;
    const id = d.slice(0, -5);
    if (!ID_RE.test(id)) continue;
    try {
      const icerik = await readFile(path.join(dizin, d), 'utf-8');
      vakalar.push(JSON.parse(icerik));
    } catch {}
  }
  vakalar.sort((a, b) => new Date(a.olusturma).getTime() - new Date(b.olusturma).getTime());
  return vakalar;
}
