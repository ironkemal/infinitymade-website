// tools/bekci-ajan/preise-bewerten.mjs
// Ne: Fiyat bekçisi değerlendiricisi (deterministik karar motoru + CLI).
// Niye: SPEC.md §2 ve §3.0 uyarınca GKV-XML raporu (preise_autoupdate bericht) ile ajanın
// ürettiği karar.json'ı karşılaştırır; tam çift dikiş uyuşmasında 'auto', aksi halde 'vaka'
// veya ihtiyaç yoksa 'sessiz' kararı üretir. Ajan metni değil, yalnız deterministik rakamlar kullanılır.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { rakamlariKarsilastir } from './dogrula.mjs';
import { iz } from './iz.mjs';
import { nesneSirIceriyor } from './cli.mjs';

const IZINLI_ANAHTARLAR = new Set([
  'tur',
  'guven',
  'ozet',
  'okunan_rakamlar',
  'neue_positionen',
  'erlaube_sprung',
  'warnungen',
]);

const GECERLI_TURLER = new Set([
  'sprung_belegt',
  'sprung_nicht_belegt',
  'neue_codes',
  'fehlende_codes',
  'unklar',
]);

const GECERLI_GUVEN = new Set(['hoch', 'mittel', 'niedrig']);

export const ART_TR = {
  sprung: 'büyük fiyat sıçraması',
  neue_codes: 'yeni kod',
  fehlende_codes: 'kaybolan kod',
  abweichend: 'bilinen fiyat uyuşmuyor',
  startdaten: 'başlangıç tarihleri uyuşmuyor',
  datum: 'bozuk tarih',
  fenster: 'fiyat penceresi sorunu',
  bereich: 'bilinmeyen alan',
  fehler: 'script hatası',
};

const CODE_RE = /^[A-Z0-9]{4,6}$/;

/**
 * Sayının sonlu, 0 < x < 10000 ve en fazla 2 ondalık basamaklı olup olmadığını kontrol eder.
 */
function preisGecerliMi(val) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0 || val >= 10000) {
    return false;
  }
  const str = String(val);
  if (str.includes('.')) {
    const dec = str.split('.')[1];
    if (dec.length > 2) return false;
  }
  return true;
}

/**
 * YYYY-MM-DD formatındaki tarihin gerçek bir takvim tarihi olup olmadığını denetler.
 */
function gecerliTarihMi(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Ajanın ürettiği karar.json yapısını sıkı şemaya göre denetler.
 * @param {any} karar
 * @returns {{ ok: boolean, hatalar: string[] }}
 */
export function kararGecerliMi(karar) {
  const hatalar = [];

  if (
    !karar ||
    typeof karar !== 'object' ||
    Array.isArray(karar) ||
    Object.prototype.toString.call(karar) !== '[object Object]'
  ) {
    return { ok: false, hatalar: ['karar düz bir nesne olmalıdır'] };
  }

  // Fazla anahtar kontrolü
  for (const k of Object.keys(karar)) {
    if (!IZINLI_ANAHTARLAR.has(k)) {
      hatalar.push(`beklenmeyen fazla anahtar: ${k}`);
    }
  }

  // Eksik zorunlu anahtar kontrolü
  for (const k of IZINLI_ANAHTARLAR) {
    if (karar[k] === undefined) {
      hatalar.push(`zorunlu anahtar eksik: ${k}`);
    }
  }

  // tur
  if (!GECERLI_TURLER.has(karar.tur)) {
    hatalar.push(`geçersiz tur: ${karar.tur}`);
  }

  // guven
  if (!GECERLI_GUVEN.has(karar.guven)) {
    hatalar.push(`geçersiz guven: ${karar.guven}`);
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

  // okunan_rakamlar
  if (!Array.isArray(karar.okunan_rakamlar)) {
    hatalar.push('okunan_rakamlar dizi olmalıdır');
  } else {
    if (karar.okunan_rakamlar.length > 200) {
      hatalar.push('okunan_rakamlar en fazla 200 eleman içerebilir');
    }
    for (let i = 0; i < karar.okunan_rakamlar.length; i++) {
      const r = karar.okunan_rakamlar[i];
      if (!r || typeof r !== 'object' || Array.isArray(r)) {
        hatalar.push(`okunan_rakamlar[${i}] düz bir nesne olmalıdır`);
        continue;
      }

      if (typeof r.code !== 'string' || !CODE_RE.test(r.code)) {
        hatalar.push(`okunan_rakamlar[${i}].code geçersiz: ${r.code}`);
      }

      if (!preisGecerliMi(r.preis)) {
        hatalar.push(`okunan_rakamlar[${i}].preis geçersiz: ${r.preis}`);
      }

      if (r.zuzahlung !== null && !preisGecerliMi(r.zuzahlung)) {
        hatalar.push(`okunan_rakamlar[${i}].zuzahlung geçersiz: ${r.zuzahlung}`);
      }

      if (!gecerliTarihMi(r.gueltig_ab)) {
        hatalar.push(`okunan_rakamlar[${i}].gueltig_ab geçersiz: ${r.gueltig_ab}`);
      }

      if (
        typeof r.quelle !== 'string' ||
        r.quelle.length > 200 ||
        !r.quelle.startsWith('wissensbank/') ||
        r.quelle.includes('..')
      ) {
        hatalar.push(`okunan_rakamlar[${i}].quelle geçersiz: ${r.quelle}`);
      }

      if (typeof r.zeile !== 'number' || !Number.isInteger(r.zeile) || r.zeile <= 0) {
        hatalar.push(`okunan_rakamlar[${i}].zeile pozitif tamsayı olmalıdır: ${r.zeile}`);
      }
    }
  }

  // erlaube_sprung
  if (!Array.isArray(karar.erlaube_sprung)) {
    hatalar.push('erlaube_sprung dizi olmalıdır');
  } else {
    if (karar.erlaube_sprung.length > 100) {
      hatalar.push('erlaube_sprung en fazla 100 eleman içerebilir');
    }
    const gorulen = new Set();
    let tekrarVar = false;
    for (let i = 0; i < karar.erlaube_sprung.length; i++) {
      const c = karar.erlaube_sprung[i];
      if (typeof c !== 'string' || !CODE_RE.test(c)) {
        hatalar.push(`erlaube_sprung[${i}] geçersiz kod formatı: ${c}`);
      }
      if (gorulen.has(c)) {
        tekrarVar = true;
      }
      gorulen.add(c);
    }
    if (tekrarVar) {
      hatalar.push('erlaube_sprung tekrarlı kodlar içeremez');
    }
  }

  // neue_positionen
  if (!Array.isArray(karar.neue_positionen)) {
    hatalar.push('neue_positionen dizi olmalıdır');
  } else {
    if (karar.neue_positionen.length > 50) {
      hatalar.push('neue_positionen en fazla 50 eleman içerebilir');
    }
    for (let i = 0; i < karar.neue_positionen.length; i++) {
      const np = karar.neue_positionen[i];
      if (!np || typeof np !== 'object' || Array.isArray(np)) {
        hatalar.push(`neue_positionen[${i}] düz bir nesne olmalıdır`);
        continue;
      }
      if (np.label !== undefined && (typeof np.label !== 'string' || np.label.length > 200)) {
        hatalar.push(`neue_positionen[${i}].label en fazla 200 karakter olmalıdır`);
      }
      if (
        np.diagnosegruppen !== undefined &&
        (!Array.isArray(np.diagnosegruppen) || np.diagnosegruppen.some(dg => typeof dg !== 'string'))
      ) {
        hatalar.push(`neue_positionen[${i}].diagnosegruppen string dizisi olmalıdır`);
      }
      if (np.zuzahlungsfrei !== undefined && typeof np.zuzahlungsfrei !== 'boolean') {
        hatalar.push(`neue_positionen[${i}].zuzahlungsfrei boolean olmalıdır`);
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
 * SPEC.md M7 uyarınca tüm needsReview bulgularından deterministik fiyat izi hesaplar.
 * Girdi: her needsReview öğesi için [art, bereich (grund'un : öncesi), sıralı {code, xmlPreis, xmlGueltigAb} listesi].
 * Kodlar details (dizi ya da {eintraege, sprungCodes} nesnesi) ve sprungCodes'tan toplanır.
 * Ajan metni ve stand girmez.
 * @param {any} bericht
 * @returns {string}
 */
export function preiseIz(bericht) {
  const needsReview = Array.isArray(bericht?.needsReview) ? bericht.needsReview : [];
  if (needsReview.length === 0) {
    return iz([]);
  }

  const maddeler = [];
  for (const nr of needsReview) {
    if (!nr) continue;
    const art = nr.art || 'belirsiz';
    let bereich = '';
    if (typeof nr.grund === 'string' && nr.grund.includes(':')) {
      bereich = nr.grund.split(':')[0].trim();
    } else if (nr.bereich) {
      bereich = String(nr.bereich).trim();
    }

    const kodMap = new Map();

    function ekle(c, p, d) {
      if (!c) return;
      const codeStr = String(c).trim();
      if (!codeStr) return;
      const mevcut = kodMap.get(codeStr);
      const preis = (p !== undefined && p !== null) ? (typeof p === 'number' ? p : Number(p)) : (mevcut?.xmlPreis ?? null);
      const datum = (d !== undefined && d !== null) ? String(d) : (mevcut?.xmlGueltigAb ?? null);
      kodMap.set(codeStr, {
        code: codeStr,
        xmlPreis: Number.isFinite(preis) ? preis : null,
        xmlGueltigAb: datum,
      });
    }

    function inceleNesne(obj, defaultDatum = null) {
      if (!obj) return;
      if (typeof obj === 'string') {
        ekle(obj, null, defaultDatum);
        return;
      }
      if (typeof obj !== 'object') return;
      const c = obj.code || obj.hpnr;
      const p = obj.xmlPreis ?? obj.neuPreis ?? obj.preis;
      const d = obj.xmlGueltigAb ?? obj.gueltig_ab ?? defaultDatum;
      if (c) {
        ekle(c, p, d);
      }
    }

    if (Array.isArray(nr.sprungCodes)) {
      for (const sc of nr.sprungCodes) {
        inceleNesne(sc, nr.xmlGueltigAb);
      }
    }

    if (Array.isArray(nr.details)) {
      for (const d of nr.details) {
        if (!d) continue;
        if (Array.isArray(d.sprungCodes)) {
          for (const sc of d.sprungCodes) {
            inceleNesne(sc, d.xmlGueltigAb || nr.xmlGueltigAb);
          }
        } else {
          inceleNesne(d, nr.xmlGueltigAb);
        }
      }
    } else if (nr.details && typeof nr.details === 'object') {
      if (Array.isArray(nr.details.eintraege)) {
        for (const e of nr.details.eintraege) {
          inceleNesne(e, nr.xmlGueltigAb);
        }
      }
      if (Array.isArray(nr.details.sprungCodes)) {
        for (const sc of nr.details.sprungCodes) {
          inceleNesne(sc, nr.xmlGueltigAb);
        }
      }
      if (Array.isArray(nr.details.zusaetzlich)) {
        for (const z of nr.details.zusaetzlich) {
          inceleNesne(z, nr.xmlGueltigAb);
        }
      }
      if (Array.isArray(nr.details.fehlend)) {
        for (const f of nr.details.fehlend) {
          inceleNesne(f, nr.xmlGueltigAb);
        }
      }
    }

    const siraliKodlar = Array.from(kodMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    maddeler.push([art, bereich, siraliKodlar]);
  }

  return iz(maddeler);
}

/**
 * needsReview ve karar nesnelerini inceleyerek deterministik karar üretir.
 * @param {{ bericht: any, karar: any, simdi?: Date }} params
 * @returns {{
 *   karar: 'sessiz' | 'auto' | 'vaka',
 *   erlaubeSprung: string[],
 *   vaka: null | { bekci: 'preise', baslik: string, satirlar: string[], dosyalar: string[], oneri: string | null, ek: any },
 *   gruende: string[],
 *   rapor?: string[]
 * }}
 */
export function bewerte({ bericht, karar, simdi = new Date() }) {
  try {
    const needsReview = bericht?.needsReview;
    if (!Array.isArray(needsReview) || needsReview.length === 0) {
      return {
        karar: 'sessiz',
        erlaubeSprung: [],
        vaka: null,
        gruende: [],
      };
    }

    const gruende = [];

    // needsReview içindeki art ve bereich bilgileri
    const artlar = needsReview.map(r => r?.art || 'belirsiz');
    const benzersizArtlar = [...new Set(artlar)];

    // Sprung kodlarını topla
    const sprungCodes = [];
    const bereiche = new Set();

    for (const nr of needsReview) {
      if (!nr) continue;
      if (nr.bereich) bereiche.add(nr.bereich);

      if (Array.isArray(nr.details)) {
        for (const d of nr.details) {
          if (!d) continue;
          if (d.bereich) bereiche.add(d.bereich);
          if (Array.isArray(d.sprungCodes)) {
            for (const sc of d.sprungCodes) {
              if (!sc) continue;
              sprungCodes.push({
                code: sc.code,
                altPreis: sc.altPreis,
                neuPreis: sc.neuPreis,
                prozent:
                  sc.prozent ??
                  (sc.altPreis != null
                    ? Math.round(((sc.neuPreis - sc.altPreis) / sc.altPreis) * 1000) / 10
                    : null),
                xmlGueltigAb: sc.xmlGueltigAb || d.xmlGueltigAb || d.gueltig_ab || nr.xmlGueltigAb,
                bereich: d.bereich || nr.bereich,
              });
            }
          }
        }
      }

      if (Array.isArray(nr.sprungCodes)) {
        for (const sc of nr.sprungCodes) {
          if (!sc) continue;
          sprungCodes.push({
            code: sc.code,
            altPreis: sc.altPreis,
            neuPreis: sc.neuPreis,
            prozent:
              sc.prozent ??
              (sc.altPreis != null
                ? Math.round(((sc.neuPreis - sc.altPreis) / sc.altPreis) * 1000) / 10
                : null),
            xmlGueltigAb: sc.xmlGueltigAb || nr.xmlGueltigAb,
            bereich: nr.bereich,
          });
        }
      }
    }

    // Kodları tekilleştir
    const uniqueSprungCodesMap = new Map();
    for (const sc of sprungCodes) {
      if (sc.code && !uniqueSprungCodesMap.has(sc.code)) {
        uniqueSprungCodesMap.set(sc.code, sc);
      }
    }
    const uniqueSprungCodes = Array.from(uniqueSprungCodesMap.values());
    const xmlKodlarSet = new Set(uniqueSprungCodes.map(s => s.code));
    const xmlKodlarList = [...xmlKodlarSet].sort();

    // 2.a) her needsReview girdisi art === 'sprung'
    const hepsiSprung = needsReview.length > 0 && needsReview.every(r => r?.art === 'sprung');
    if (!hepsiSprung) {
      const diger = benzersizArtlar.filter(a => a !== 'sprung');
      gruende.push(`needsReview içinde sprung dışında maddeler var: ${diger.join(', ')}`);
    }

    // 2.b) karar geçerli, tur==='sprung_belegt', guven==='hoch', warnungen boş
    let gecerliMi = false;
    let kararHatalari = [];
    if (!karar) {
      gruende.push('Ajan çalışmadı.');
    } else {
      const g = kararGecerliMi(karar);
      gecerliMi = g.ok;
      kararHatalari = g.hatalar;
      if (!gecerliMi) {
        gruende.push(`Ajan çıktısı geçersiz: ${kararHatalari.slice(0, 3).join('; ')}`);
      } else {
        if (karar.tur !== 'sprung_belegt') {
          gruende.push(`karar türü 'sprung_belegt' değil: ${karar.tur}`);
        }
        if (karar.guven !== 'hoch') {
          gruende.push(`karar güven derecesi 'hoch' değil: ${karar.guven}`);
        }
        if (Array.isArray(karar.warnungen) && karar.warnungen.length > 0) {
          gruende.push(`kararda uyarılar mevcut (${karar.warnungen.length} adet): ${karar.warnungen[0]}`);
        }
      }
    }

    // 2.c) erlaube_sprung kümesi == bütün sprungCodes'ların kod kümesi (birebir)
    let cSaglandi = false;
    const erlaubeSprungSet = new Set(karar?.erlaube_sprung || []);
    const erlaubeSprungList = [...erlaubeSprungSet].sort();

    if (xmlKodlarSet.size === 0 && hepsiSprung) {
      gruende.push('sprung girdisinde sıçrayan kod bulunamadı');
    } else if (gecerliMi && xmlKodlarSet.size > 0) {
      const eksik = xmlKodlarList.filter(c => !erlaubeSprungSet.has(c));
      const fazla = erlaubeSprungList.filter(c => !xmlKodlarSet.has(c));
      if (eksik.length === 0 && fazla.length === 0) {
        cSaglandi = true;
      } else {
        if (eksik.length > 0) {
          gruende.push(`erlaube_sprung listesinde eksik kodlar var: ${eksik.join(', ')}`);
        }
        if (fazla.length > 0) {
          gruende.push(`erlaube_sprung listesinde fazla kodlar var: ${fazla.join(', ')}`);
        }
      }
    }

    // 2.d) her sıçrayan kod için okunan_rakamlar'da kayıt var ve rakamlariKarsilastir ile preis + gueltig_ab XML ile birebir aynı
    let dSaglandi = false;
    if (gecerliMi && xmlKodlarSet.size > 0) {
      let okunanEksik = false;
      const okunanList = [];
      const xmlList = [];

      for (const sc of uniqueSprungCodes) {
        const okunan = (karar.okunan_rakamlar || []).find(r => r.code === sc.code);
        if (!okunan) {
          gruende.push(`sıçrayan ${sc.code} kodu için ajanın okuduğu rakam bulunamadı`);
          okunanEksik = true;
        } else {
          okunanList.push({
            code: okunan.code,
            preis: okunan.preis,
            zuzahlung: null,
            gueltig_ab: okunan.gueltig_ab,
          });
          xmlList.push({
            code: sc.code,
            preis: sc.neuPreis,
            zuzahlung: null,
            gueltig_ab: sc.xmlGueltigAb,
          });
        }
      }

      if (!okunanEksik) {
        const karsilastirma = rakamlariKarsilastir(okunanList, xmlList);
        if (karsilastirma.uyusuyor) {
          dSaglandi = true;
        } else {
          for (const f of karsilastirma.farklar) {
            const pMatch = f.match(/^([A-Z0-9]+)\s+preis:\s+(.+?)\s+≠\s+(.+)$/);
            const dMatch = f.match(/^([A-Z0-9]+)\s+gueltig_ab:\s+(.+?)\s+≠\s+(.+)$/);
            if (pMatch) {
              const pAjan = Number(pMatch[2]).toFixed(2);
              const pXml = Number(pMatch[3]).toFixed(2);
              gruende.push(`ajanın okuduğu ${pMatch[1]} fiyatı XML'den farklı: ${pAjan} ≠ ${pXml}`);
            } else if (dMatch) {
              gruende.push(`ajanın okuduğu ${dMatch[1]} tarihi XML'den farklı: ${dMatch[2]} ≠ ${dMatch[3]}`);
            } else {
              gruende.push(`karşılaştırma farkı: ${f}`);
            }
          }
        }
      }
    }

    const isAuto =
      hepsiSprung &&
      gecerliMi &&
      karar.tur === 'sprung_belegt' &&
      karar.guven === 'hoch' &&
      Array.isArray(karar.warnungen) &&
      karar.warnungen.length === 0 &&
      cSaglandi &&
      dSaglandi;

    // Satırların inşası
    const hamSatirlar = [];

    // 1. her needsReview girdisi: • <art-türkçe>: <grund ilk 120 karakter>
    for (const nr of needsReview) {
      const art = nr?.art || 'belirsiz';
      const tr = ART_TR[art] || art;
      const grund = String(nr?.grund || '').slice(0, 120);
      hamSatirlar.push(`• ${tr}: ${grund}`);
      // Sprung dışı bulgularda da kodu ve XML fiyatını göster (deterministik, bericht'ten) — 25.11.2026
      if (art !== 'sprung') {
        const liste = Array.isArray(nr?.details) ? nr.details : (Array.isArray(nr?.details?.eintraege) ? nr.details.eintraege : []);
        for (const d of liste.slice(0, 6)) {
          if (!d || typeof d.code !== 'string' || !/^[A-Z0-9]{4,6}$/.test(d.code)) continue;
          const p = typeof d.xmlPreis === 'number' && isFinite(d.xmlPreis) ? `${d.xmlPreis.toFixed(2)} €` : '—';
          const ab = typeof d.xmlGueltigAb === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.xmlGueltigAb) ? ` · XML ab ${d.xmlGueltigAb}` : '';
          hamSatirlar.push(`  ${d.code}: ${p}${ab}`);
        }
      }
    }

    // 2. her sıçrayan kod: <code>: <alt> → <neu> € (<+%x.y>) · XML ab <tarih>
    for (const sc of uniqueSprungCodes) {
      const alt = sc.altPreis != null ? Number(sc.altPreis).toFixed(2) : '?';
      const neu = sc.neuPreis != null ? Number(sc.neuPreis).toFixed(2) : '?';
      const prz =
        sc.prozent != null
          ? ` (${sc.prozent >= 0 ? '+' : ''}${Number(sc.prozent).toFixed(1)}%)`
          : '';
      const ab = sc.xmlGueltigAb || '?';
      hamSatirlar.push(`  ${sc.code}: ${alt} → ${neu} €${prz} · XML ab ${ab}`);
    }

    // 3. ajanın okuduğu her kod için: sözleşme metni (ajan okudu): <code> = <preis> € ab <tarih> · <quelle>:<zeile>
    if (karar && Array.isArray(karar.okunan_rakamlar)) {
      for (const or of karar.okunan_rakamlar) {
        const pr = or.preis != null ? Number(or.preis).toFixed(2) : '?';
        hamSatirlar.push(
          `  sözleşme metni (ajan okudu): ${or.code} = ${pr} € ab ${or.gueltig_ab} · ${or.quelle}:${or.zeile}`
        );
      }
    }

    // 4. gruende'nin ilk 5'i `  ⚠ ...` olarak
    for (const g of gruende.slice(0, 5)) {
      hamSatirlar.push(`  ⚠ ${g}`);
    }

    // 5. fazlası kesilir, son satır `… (+N)` (toplam ≤ 20)
    let sonSatirlar = [];
    if (hamSatirlar.length > 20) {
      const kesilen = hamSatirlar.length - 19;
      sonSatirlar = [...hamSatirlar.slice(0, 19), `… (+${kesilen})`];
    } else {
      sonSatirlar = hamSatirlar;
    }

    // Başlık
    const ilkArt = needsReview[0]?.art;
    const ilkArtTr = ART_TR[ilkArt] || ilkArt || 'fiyat';
    const ekKonuSayisi = benzersizArtlar.length - 1;
    const baslik =
      ekKonuSayisi > 0 ? `Fiyat: ${ilkArtTr} (+${ekKonuSayisi} konu)` : `Fiyat: ${ilkArtTr}`;

    // Dosyalar
    const dosyalar = [];
    const lowerBereiche = new Set([...bereiche].map(b => String(b).toLowerCase()));
    if (lowerBereiche.has('podologie')) {
      dosyalar.push('api-backend/billing/codes/podologie_positions.js');
    }
    if (lowerBereiche.has('physiotherapie') || lowerBereiche.has('physio')) {
      dosyalar.push('api-backend/billing/codes/physio_positions.js');
    }

    // Öneri
    let oneri = null;
    if (!karar) {
      oneri = 'Ajan çalışmadı.';
    } else if (gecerliMi) {
      oneri = String(karar.ozet || '').slice(0, 600);
    } else {
      oneri = `Ajan çıktısı geçersiz: ${kararHatalari.slice(0, 3).join('; ')}`;
    }

    // ek
    const vakaIz = preiseIz(bericht);
    const erlaubeSprungVaka = cSaglandi && dSaglandi ? xmlKodlarList : [];
    const uygulanabilir = erlaubeSprungVaka.length > 0;

    const ek = {
      stand: bericht.stand ?? null,
      erlaubeSprung: erlaubeSprungVaka,
      artlar,
      iz: vakaIz,
      uygulanabilir,
    };

    if (isAuto) {
      return {
        karar: 'auto',
        erlaubeSprung: xmlKodlarList,
        vaka: null,
        gruende: [],
        rapor: sonSatirlar,
      };
    }

    return {
      karar: 'vaka',
      erlaubeSprung: erlaubeSprungVaka.length > 0 ? erlaubeSprungVaka : [],
      vaka: {
        bekci: 'preise',
        baslik,
        satirlar: sonSatirlar,
        dosyalar,
        oneri,
        ek,
      },
      gruende,
    };
  } catch (err) {
    const hataMesaj = err?.message || String(err);
    const ilkArt = bericht?.needsReview?.[0]?.art || 'fehler';
    const tr = ART_TR[ilkArt] || ilkArt;
    return {
      karar: 'vaka',
      erlaubeSprung: [],
      vaka: {
        bekci: 'preise',
        baslik: `Fiyat: ${tr}`,
        satirlar: [`• script hatası: ${hataMesaj.slice(0, 120)}`],
        dosyalar: [],
        oneri: `Script hatası: ${hataMesaj}`,
        ek: {
          stand: bericht?.stand ?? null,
          erlaubeSprung: [],
          artlar: ['fehler'],
          iz: iz([ilkArt, []]),
          uygulanabilir: false,
        },
      },
      gruende: [`Beklenmeyen hata: ${hataMesaj}`],
    };
  }
}

// CLI desteği
function cliCalistir() {
  const args = process.argv.slice(2);
  let berichtPath = null;
  let kararPath = null;
  let outPath = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--bericht=')) {
      berichtPath = a.slice('--bericht='.length);
    } else if (a === '--bericht' && i + 1 < args.length) {
      berichtPath = args[++i];
    } else if (a.startsWith('--karar=')) {
      kararPath = a.slice('--karar='.length);
    } else if (a === '--karar' && i + 1 < args.length) {
      kararPath = args[++i];
    } else if (a.startsWith('--out=')) {
      outPath = a.slice('--out='.length);
    } else if (a === '--out' && i + 1 < args.length) {
      outPath = args[++i];
    }
  }

  if (!berichtPath) {
    process.exit(1);
  }

  let bericht = null;
  try {
    const icerik = readFileSync(berichtPath, 'utf-8');
    bericht = JSON.parse(icerik);
  } catch {
    process.exit(1);
  }

  let karar = null;
  if (kararPath) {
    try {
      const icerik = readFileSync(kararPath, 'utf-8');
      karar = JSON.parse(icerik);
    } catch {
      karar = null;
    }
  }

  const sonuc = bewerte({ bericht, karar });

  if (outPath) {
    try {
      writeFileSync(outPath, JSON.stringify(sonuc, null, 2), 'utf-8');
    } catch {}
  }

  console.log(`karar: ${sonuc.karar}`);
  process.exit(0);
}

// Yalnız doğrudan çalıştırıldığında CLI tetiklenir
const suAnkiDosya = fileURLToPath(import.meta.url).toLowerCase();
const cagirilanDosya = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (cagirilanDosya && cagirilanDosya === suAnkiDosya) {
  cliCalistir();
}
