// tools/bekci-ajan/quellen-bewerten.mjs
// Ne: Kaynak bekçisi değerlendiricisi (karar şeması doğrulayıcı + deterministik karar motoru + CLI).
// Niye: SPEC.md §4 uyarınca quellen-waechter bulguları ve ajanın karar.json çıktısını değerlendirip
// sadece tam güvenli durumlarda "biliniyor" (otomatik) kararı verir, aksi halde deterministik
// satır formatıyla vaka nesneleri üretir.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iz } from './iz.mjs';
import { nesneSirIceriyor } from './cli.mjs';

const IZINLI_KOK_ANAHTARLAR = new Set(['belgeler', 'ozet', 'warnungen']);

const IZINLI_BELGE_ANAHTARLARI = new Set([
  'quelle_id',
  'url',
  'ne_degisti',
  'etki',
  'gecerlilik',
  'etkilenen_dosyalar',
  'oneri',
  'guven',
]);

const GECERLI_ETKI = new Set(['yok', 'dusuk', 'orta', 'yuksek']);
const GECERLI_ONERI = new Set(['biliniyor', 'incele', 'acil']);
const GECERLI_GUVEN = new Set(['hoch', 'mittel', 'niedrig']);

/**
 * YYYY-MM-DD formatındaki tarihin geçerli bir takvim tarihi olup olmadığını denetler.
 * @param {string} str
 * @returns {boolean}
 */
export function gecerliTarihMi(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * İki URL'nin şema ve sondaki bölü işaretinden bağımsız aynı hedefi gösterip göstermediğini denetler.
 * @param {string} u1
 * @param {string} u2
 * @returns {boolean}
 */
export function urlEslesiyorMu(u1, u2) {
  if (!u1 || !u2) return false;
  const s1 = String(u1).trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const s2 = String(u2).trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return s1 === s2;
}

/**
 * URL veya iz metninden dosya adını (son yol parçasını) çıkarır.
 * @param {string} raw
 * @returns {string}
 */
export function urlSonParca(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const link = raw.includes('|') ? raw.split('|')[0].trim() : raw.trim();
  try {
    const u = new URL(link.startsWith('http') ? link : `https://${link}`);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : link;
  } catch {
    const parts = link.split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : link;
  }
}

/**
 * Kaynak bulgusunun deterministik izini hesaplar.
 * @param {object} befund
 * @returns {string} 16 haneli sha256 izi
 */
export function quellenBefundIz(befund) {
  const quelleId = befund?.id || 'bilinmeyen';
  const neuList = Array.isArray(befund?.neu) ? befund.neu : [];
  const wegList = Array.isArray(befund?.weg) ? befund.weg : [];
  const siraliNeu = [...neuList].sort();
  const siraliWeg = [...wegList].sort();
  return iz([quelleId, siraliNeu, siraliWeg]);
}

/**
 * Ajanın ürettiği karar.json yapısını sıkı şemaya göre denetler.
 *
 * @param {any} karar
 * @param {Array<object>} befunde - quellen-waechter bulguları
 * @returns {{ ok: boolean, hatalar: string[] }}
 */
export function kararGecerliMi(karar, befunde = []) {
  const hatalar = [];

  if (
    !karar ||
    typeof karar !== 'object' ||
    Array.isArray(karar) ||
    Object.prototype.toString.call(karar) !== '[object Object]'
  ) {
    return { ok: false, hatalar: ['karar düz bir nesne olmalıdır'] };
  }

  // Fazla kök anahtar kontrolü
  for (const k of Object.keys(karar)) {
    if (!IZINLI_KOK_ANAHTARLAR.has(k)) {
      hatalar.push(`beklenmeyen fazla anahtar: ${k}`);
    }
  }

  // Eksik kök anahtar kontrolü
  for (const k of IZINLI_KOK_ANAHTARLAR) {
    if (karar[k] === undefined) {
      hatalar.push(`zorunlu anahtar eksik: ${k}`);
    }
  }

  // ozet
  if (typeof karar.ozet !== 'string' || karar.ozet.length > 600) {
    hatalar.push('ozet string ve en fazla 600 karakter olmalıdır');
  }

  // warnungen
  if (!Array.isArray(karar.warnungen)) {
    hatalar.push('warnungen dizi olmalıdır');
  } else {
    if (karar.warnungen.length > 10) {
      hatalar.push('warnungen en fazla 10 eleman içerebilir');
    }
    for (let i = 0; i < karar.warnungen.length; i++) {
      const w = karar.warnungen[i];
      if (typeof w !== 'string' || w.length > 300) {
        hatalar.push(`warnungen[${i}] string ve en fazla 300 karakter olmalıdır`);
      }
    }
  }

  // belgeler
  if (!Array.isArray(karar.belgeler)) {
    hatalar.push('belgeler dizi olmalıdır');
  } else {
    const befundMap = new Map();
    if (Array.isArray(befunde)) {
      for (const b of befunde) {
        if (b?.id) befundMap.set(b.id, b);
      }
    }

    for (let i = 0; i < karar.belgeler.length; i++) {
      const b = karar.belgeler[i];
      if (!b || typeof b !== 'object' || Array.isArray(b)) {
        hatalar.push(`belgeler[${i}] düz bir nesne olmalıdır`);
        continue;
      }

      // Fazla anahtar kontrolü
      for (const bk of Object.keys(b)) {
        if (!IZINLI_BELGE_ANAHTARLARI.has(bk)) {
          hatalar.push(`belgeler[${i}] içinde beklenmeyen fazla anahtar: ${bk}`);
        }
      }

      // Eksik anahtar kontrolü
      for (const bk of IZINLI_BELGE_ANAHTARLARI) {
        if (b[bk] === undefined) {
          hatalar.push(`belgeler[${i}] içinde zorunlu anahtar eksik: ${bk}`);
        }
      }

      // quelle_id befunde içinde var mı?
      const ilgiliBefund = befundMap.get(b.quelle_id);
      if (!ilgiliBefund) {
        hatalar.push(`belgeler[${i}].quelle_id befunde içinde bulunamadı: ${b.quelle_id}`);
      } else {
        // url o befund'un neu/weg öğelerinden birinin link kısmı mı? (art === 'text' ise befund.url de geçerlidir)
        const befundLinkler = [
          ...(ilgiliBefund.neu || []),
          ...(ilgiliBefund.weg || []),
          ...(ilgiliBefund.art === 'text' && ilgiliBefund.url ? [ilgiliBefund.url] : []),
        ].map(item => (item.includes('|') ? item.split('|')[0].trim() : item.trim()));

        const urlUlusuyor = befundLinkler.some(link => urlEslesiyorMu(b.url, link));
        if (!urlUlusuyor) {
          hatalar.push(
            `belgeler[${i}].url ${b.quelle_id} kaynağının neu/weg listesinde yok: ${b.url}`
          );
        }
      }

      // ne_degisti <= 500
      if (typeof b.ne_degisti !== 'string' || b.ne_degisti.length > 500) {
        hatalar.push(`belgeler[${i}].ne_degisti string ve en fazla 500 karakter olmalıdır`);
      }

      // etki
      if (!GECERLI_ETKI.has(b.etki)) {
        hatalar.push(`belgeler[${i}].etki geçersiz: ${b.etki}`);
      }

      // oneri
      if (!GECERLI_ONERI.has(b.oneri)) {
        hatalar.push(`belgeler[${i}].oneri geçersiz: ${b.oneri}`);
      }

      // guven
      if (!GECERLI_GUVEN.has(b.guven)) {
        hatalar.push(`belgeler[${i}].guven geçersiz: ${b.guven}`);
      }

      // gecerlilik null ya da gerçek takvim tarihi
      if (b.gecerlilik !== null && !gecerliTarihMi(b.gecerlilik)) {
        hatalar.push(`belgeler[${i}].gecerlilik null veya YYYY-MM-DD takvim tarihi olmalıdır`);
      }

      // etkilenen_dosyalar <= 10, depo-göreli yol
      if (!Array.isArray(b.etkilenen_dosyalar)) {
        hatalar.push(`belgeler[${i}].etkilenen_dosyalar dizi olmalıdır`);
      } else {
        if (b.etkilenen_dosyalar.length > 10) {
          hatalar.push(`belgeler[${i}].etkilenen_dosyalar en fazla 10 eleman içerebilir`);
        }
        for (let j = 0; j < b.etkilenen_dosyalar.length; j++) {
          const dosya = b.etkilenen_dosyalar[j];
          if (typeof dosya !== 'string' || dosya.length > 200) {
            hatalar.push(`belgeler[${i}].etkilenen_dosyalar[${j}] string ve en fazla 200 karakter olmalıdır`);
            continue;
          }
          if (
            dosya.startsWith('/') ||
            dosya.startsWith('\\') ||
            /^[a-zA-Z]:/.test(dosya) ||
            dosya.includes('\\') ||
            dosya.split('/').includes('..') ||
            dosya.includes('..')
          ) {
            hatalar.push(
              `belgeler[${i}].etkilenen_dosyalar[${j}] geçersiz veya güvensiz dosya yolu: ${dosya}`
            );
          }
        }
      }
    }
  }

  // Sır kontrolü (iki kat emniyet)
  if (nesneSirIceriyor(karar)) {
    hatalar.push('sır benzeri içerik');
  }

  return { ok: hatalar.length === 0, hatalar };
}

/**
 * quellen-waechter bulguları, ajan kararı ve indirilen belge indeksini değerlendirir.
 *
 * @param {object} params
 * @param {Array<object>} params.befunde
 * @param {object|null} params.karar
 * @param {Array<object>} [params.indeks=[]]
 * @returns {{
 *   otomatik: string[],
 *   vakalar: Array<{
 *     bekci: 'quellen',
 *     baslik: string,
 *     satirlar: string[],
 *     dosyalar: string[],
 *     oneri: string,
 *     ek: { quelleId: string, neu: string[], weg: string[] }
 *   }>,
 *   rapor: string[],
 *   gruende: string[]
 * }}
 */
export function bewerte({ befunde = [], karar = null, indeks = [] }) {
  const otomatik = [];
  const vakalar = [];
  const rapor = [];
  const gruende = [];

  const safeBefunde = Array.isArray(befunde) ? befunde : [];
  const safeIndeks = Array.isArray(indeks) ? indeks : [];

  let kararGecerli = false;
  let kararHatalari = [];

  if (!karar) {
    gruende.push('Ajan çalışmadı.');
  } else {
    const kontrol = kararGecerliMi(karar, safeBefunde);
    kararGecerli = kontrol.ok;
    kararHatalari = kontrol.hatalar;
    if (!kararGecerli) {
      gruende.push(`Ajan çıktısı geçersiz: ${kararHatalari.slice(0, 3).join('; ')}`);
    }
  }

  for (const befund of safeBefunde) {
    const quelleId = befund?.id || 'bilinmeyen';
    const wichtig = befund?.wichtig || 'normal';
    const neuList = Array.isArray(befund?.neu) ? befund.neu : [];
    const wegList = Array.isArray(befund?.weg) ? befund.weg : [];
    const tumOgeler = [...neuList, ...wegList];

    const kaynakGruende = [];

    // 1. Kritik kaynak kontrolü
    if (wichtig === 'kritisch') {
      kaynakGruende.push('kaynak kritik');
    }

    // 2. Karar geçerliliği
    if (!karar) {
      kaynakGruende.push('Ajan çalışmadı.');
    } else if (!kararGecerli) {
      kaynakGruende.push('Ajan çıktısı geçersiz');
    }

    // 3. Karar uyarıları kontrolü
    if (karar && Array.isArray(karar.warnungen) && karar.warnungen.length > 0) {
      kaynakGruende.push(`kararda uyarılar var (${karar.warnungen.length})`);
    }

    // 4. Belge kayıtları ve ajan alanları kontrolü
    const ilgiliKararBelgeleri = [];
    if (karar && Array.isArray(karar.belgeler)) {
      for (const b of karar.belgeler) {
        if (b.quelle_id === quelleId) {
          ilgiliKararBelgeleri.push(b);
        }
      }
    }

    // Her neu/weg için belge kaydı var mı?
    let eksikBelgeKaydi = false;
    for (const oge of tumOgeler) {
      const link = oge.includes('|') ? oge.split('|')[0].trim() : oge.trim();
      const kayitVar = ilgiliKararBelgeleri.some(
        b => urlEslesiyorMu(b.url, link) || (befund.art === 'text' && urlEslesiyorMu(b.url, befund.url))
      );
      if (!kayitVar) {
        eksikBelgeKaydi = true;
        break;
      }
    }

    if (tumOgeler.length > 0 && eksikBelgeKaydi) {
      kaynakGruende.push('eksik belge kaydı');
    }

    // Belge alanları: etki === 'yok', oneri === 'biliniyor', guven === 'hoch'
    let alanlarUygun = ilgiliKararBelgeleri.length > 0;
    for (const b of ilgiliKararBelgeleri) {
      if (b.etki !== 'yok' || b.oneri !== 'biliniyor' || b.guven !== 'hoch') {
        alanlarUygun = false;
        kaynakGruende.push(
          `belge alanı uygun değil: etki=${b.etki}, öneri=${b.oneri}, güven=${b.guven}`
        );
        break;
      }
    }

    // 5. İndirilen belgeler kontrolü (kisaltildi / ikili / indirilemedi)
    let indirmeSorunlu = false;
    for (const item of neuList) {
      const link = item.includes('|') ? item.split('|')[0].trim() : item.trim();
      const idxEntry = safeIndeks.find(
        entry =>
          entry.quelleId === quelleId &&
          (urlEslesiyorMu(entry.url, link) || (befund.art === 'text' && urlEslesiyorMu(entry.url, befund.url)))
      );

      if (!idxEntry) {
        indirmeSorunlu = true;
        kaynakGruende.push(`belge indekste bulunamadı: ${link}`);
        break;
      }

      if (
        idxEntry.kisaltildi ||
        idxEntry.dosya === null ||
        idxEntry.atlandi !== null ||
        idxEntry.tur === 'xlsx' ||
        idxEntry.tur === 'zip' ||
        idxEntry.tur === 'ikili' ||
        (idxEntry.not && idxEntry.not.includes('ikili'))
      ) {
        indirmeSorunlu = true;
        kaynakGruende.push(
          `belge tam okunamadı (kisaltildi=${idxEntry.kisaltildi}, tur=${idxEntry.tur}, dosya=${idxEntry.dosya})`
        );
        break;
      }
    }

    // Kaldırılan belge kontrolü (M6/L12: kaldırılan belge her zaman insana/vaka)
    if (wegList.length > 0) {
      kaynakGruende.push(`kaldırılan belge var (weg=${wegList.length})`);
    }

    // Otomatik "biliniyor" şartı:
    // kaynak wichtig !== 'kritisch' VE karar geçerli VE her neu/weg için belge kaydı var
    // VE hepsi etki==='yok', oneri==='biliniyor', guven==='hoch' VE warnungen boş
    // VE kaldırılan belge yok (weg.length === 0)
    // VE ilgili belgelerin hiçbiri kisaltildi/ikili/indirilemedi değil
    const isOtomatik =
      wichtig !== 'kritisch' &&
      kararGecerli &&
      tumOgeler.length > 0 &&
      wegList.length === 0 &&
      !eksikBelgeKaydi &&
      alanlarUygun &&
      Array.isArray(karar.warnungen) &&
      karar.warnungen.length === 0 &&
      !indirmeSorunlu;

    if (isOtomatik) {
      otomatik.push(quelleId);
      const n = neuList.length;
      const ilkNe = ilgiliKararBelgeleri[0]?.ne_degisti || '';
      rapor.push(
        `✓ ${quelleId}: ${n} yeni belge — ajan: bizi etkilemiyor (${String(ilkNe).slice(0, 80)})`
      );
    } else {
      // Vaka oluştur
      for (const kg of kaynakGruende) {
        if (!gruende.includes(kg)) gruende.push(kg);
      }

      const baslik = wichtig === 'kritisch' ? `‼️ Kaynak: ${quelleId}` : `Kaynak: ${quelleId}`;
      const satirlar = [];

      // 1. Kaynak başlık satırı
      const neKisaltilmis = String(befund?.ne || '').slice(0, 100);
      satirlar.push(`• Kaynak: ${quelleId} (${wichtig}) · ${neKisaltilmis}`);

      // 2. her neu: + <dosya adı>
      for (const n of neuList) {
        satirlar.push(`  + ${urlSonParca(n)}`);
      }

      // 3. her weg: - <dosya adı>
      for (const w of wegList) {
        satirlar.push(`  - ${urlSonParca(w)}`);
      }

      // 4. belge başına ajan alanları etiketli
      for (const b of ilgiliKararBelgeleri) {
        const tarih = b.gecerlilik || '—';
        satirlar.push(
          `  ajan: etki=${b.etki}, öneri=${b.oneri}, geçerlilik=${tarih}, güven=${b.guven}`
        );
        if (Array.isArray(b.etkilenen_dosyalar) && b.etkilenen_dosyalar.length > 0) {
          satirlar.push(`  dosya: ${b.etkilenen_dosyalar.join(', ')}`);
        }
      }

      // 5. Kaçırılırsa
      const folgeKisaltilmis = String(befund?.folge || '').slice(0, 120);
      satirlar.push(`  Kaçırılırsa: ${folgeKisaltilmis}`);

      // Öneri
      let oneriMetni = '';
      if (!karar) {
        oneriMetni = 'Ajan çalışmadı.';
      } else if (!kararGecerli) {
        oneriMetni = `Ajan çıktısı geçersiz: ${kararHatalari.slice(0, 3).join('; ')}`;
      } else {
        const neList = ilgiliKararBelgeleri.map(b => b.ne_degisti).filter(Boolean);
        oneriMetni = (neList.length > 0 ? neList.join('; ') : 'Değişiklik belirtilmedi.').slice(
          0,
          600
        );
      }

      // Dosyalar (birleşim <= 10)
      const dosyaSet = new Set();
      for (const b of ilgiliKararBelgeleri) {
        if (Array.isArray(b.etkilenen_dosyalar)) {
          for (const d of b.etkilenen_dosyalar) {
            if (dosyaSet.size < 10) dosyaSet.add(d);
          }
        }
      }
      const dosyalar = Array.from(dosyaSet);

      const vakaIz = quellenBefundIz(befund);

      vakalar.push({
        bekci: 'quellen',
        baslik,
        satirlar,
        dosyalar,
        oneri: oneriMetni,
        ek: {
          quelleId,
          neu: neuList,
          weg: wegList,
          iz: vakaIz,
          uygulanabilir: true,
        },
      });
    }
  }

  return {
    otomatik,
    vakalar,
    rapor,
    gruende,
  };
}

/**
 * CLI giriş noktası.
 */
function cliCalistir() {
  const args = process.argv.slice(2);
  let befundePath = null;
  let kararPath = null;
  let indeksPath = null;
  let outPath = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--befunde=')) {
      befundePath = a.slice('--befunde='.length);
    } else if (a === '--befunde' && i + 1 < args.length) {
      befundePath = args[++i];
    } else if (a.startsWith('--karar=')) {
      kararPath = a.slice('--karar='.length);
    } else if (a === '--karar' && i + 1 < args.length) {
      kararPath = args[++i];
    } else if (a.startsWith('--indeks=')) {
      indeksPath = a.slice('--indeks='.length);
    } else if (a === '--indeks' && i + 1 < args.length) {
      indeksPath = args[++i];
    } else if (a.startsWith('--out=')) {
      outPath = a.slice('--out='.length);
    } else if (a === '--out' && i + 1 < args.length) {
      outPath = args[++i];
    }
  }

  if (!befundePath) {
    process.exit(1);
  }

  let befunde = [];
  try {
    const raw = readFileSync(befundePath, 'utf-8');
    const parsed = JSON.parse(raw);
    befunde = Array.isArray(parsed) ? parsed : (parsed.befunde || []);
  } catch {
    process.exit(1);
  }

  let karar = null;
  if (kararPath) {
    try {
      const raw = readFileSync(kararPath, 'utf-8');
      karar = JSON.parse(raw);
    } catch {
      karar = null;
    }
  }

  let indeks = [];
  if (indeksPath) {
    try {
      const raw = readFileSync(indeksPath, 'utf-8');
      indeks = JSON.parse(raw);
    } catch {
      indeks = [];
    }
  }

  const sonuc = bewerte({ befunde, karar, indeks });

  if (outPath) {
    try {
      writeFileSync(outPath, JSON.stringify(sonuc, null, 2), 'utf-8');
    } catch {
      process.exit(1);
    }
  }

  console.log(`otomatik=${sonuc.otomatik.length} vaka=${sonuc.vakalar.length}`);
  process.exit(0);
}

const suAnkiDosya = fileURLToPath(import.meta.url).toLowerCase();
const cagirilanDosya = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (cagirilanDosya && cagirilanDosya === suAnkiDosya) {
  cliCalistir();
}
