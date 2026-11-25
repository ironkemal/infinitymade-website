// tools/bekci-ajan/anlat.mjs
// Ne: Bekçi soru mesajları için anlatım şeması doğrulayıcı, rakam koruması,
// anlatım seçici ve Telegram mesaj kurucu modülü.
// Niye: Kemal'in "Gelen mesajlardan hiçbir şey anlamadım" şikâyeti üzerine;
// teknik jargon, dosya adı ve vaka id'si içermeyen, kendi başına anlaşılır
// sade Türkçe mesajlar üretilmesini ve uydurma rakamların engellenmesini sağlar.

import { sirIceriyor } from './cli.mjs';

const GECERLI_ACILIYET = new Set(['dusuk', 'orta', 'yuksek']);

const IZINLI_KOK_ANAHTARLAR = new Set([
  'baslik',
  'ne_oldu',
  'bizi_etkisi',
  'senden_istenen',
  'uygula_ne_yapar',
  'birak_ne_yapar',
  'oneri',
  'aciliyet',
  'son_tarih',
  'isaretler',
]);

const IZINLI_ISARET_ANAHTARLAR = new Set([
  'belge',
  'aranan_metin',
  'neden',
]);

// Yasak kalıp kontrolleri
const YASAK_UZANTI_RE = /\.(pdf|txt|xlsx|zip|json|mjs|js|sql)\b/i;
const YASAK_HTTP_RE = /http/i;
const YASAK_VAKA_ID_RE = /#\d{8}-/;
const YASAK_YOL_RE = /(?:^|[\s"'(])(?:~?\/|\.\.?\/|[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/;

/**
 * Bir metin alanında yasak kalıp olup olmadığını denetler.
 * Yasak kalıplar: dosya uzantıları, / içeren yol benzeri dizeler, http,
 * _ içeren >=6 karakterlik tokenlar, #\d{8}- vaka id'si.
 * @param {string} metin
 * @returns {string | null} Bulunan ilk yasak kalıbın adı veya null
 */
function yasakKalipBul(metin) {
  if (typeof metin !== 'string') return null;

  if (YASAK_UZANTI_RE.test(metin)) {
    return 'dosya_uzantisi';
  }
  if (YASAK_HTTP_RE.test(metin)) {
    return 'http_url';
  }
  if (YASAK_VAKA_ID_RE.test(metin)) {
    return 'vaka_id';
  }
  if (YASAK_YOL_RE.test(metin)) {
    return 'yol_dizesi';
  }

  // _ içeren >=6 karakterlik tokenlar
  const tokens = metin.match(/[^\s,.;:!?()\[\]{}"'<>]+/g) || [];
  for (const t of tokens) {
    if (t.includes('_') && t.length >= 6) {
      return `altcizgili_token:${t}`;
    }
  }

  return null;
}

/**
 * YYYY-MM-DD formatında geçerli bir takvim tarihi olup olmadığını denetler.
 * @param {string} str
 * @returns {boolean}
 */
function gecerliTarihMi(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * GG.AA.JJJJ veya JJJJ-AA-GG tarihini YYYY-MM-DD olarak standartlaştırır.
 * @param {string} str
 * @returns {string | null}
 */
function normalizeTarih(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const trMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (trMatch) {
    const [, d, m, y] = trMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Girdiden (string, dizi, nesne) tüm metin değerlerini toplar.
 * @param {any} val
 * @returns {string}
 */
function tumMetinleriCikar(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    return val.map(tumMetinleriCikar).join(' ');
  }
  if (typeof val === 'object') {
    return Object.values(val).map(tumMetinleriCikar).join(' ');
  }
  return '';
}

/**
 * Anlatımın bütün metin alanlarındaki 3+ haneli sayıları, ondalıklı sayıları (12,34 / 12.34)
 * ve tarihleri (gg.aa.jjjj, jjjj-aa-gg) olgular metniyle karşılaştırır.
 * 1–2 haneli sayılar serbesttir.
 *
 * @param {any} a - Anlatım nesnesi veya metin
 * @param {any} olgular - Vaka satırları, özet/bericht nesnesi veya düz metin
 * @returns {{ ok: boolean, uydurma: string[] }}
 */
export function rakamKorumasi(a, olgular) {
  const uydurma = [];
  const olgularMetni = tumMetinleriCikar(olgular);

  // Anlatım metnini topla
  let anlatimMetni = '';
  if (typeof a === 'string') {
    anlatimMetni = a;
  } else if (a && typeof a === 'object') {
    const parcalar = [
      a.baslik,
      a.ne_oldu,
      a.bizi_etkisi,
      a.senden_istenen,
      a.uygula_ne_yapar,
      a.birak_ne_yapar,
      a.oneri,
      a.son_tarih,
    ];
    if (Array.isArray(a.isaretler)) {
      for (const is of a.isaretler) {
        if (is && typeof is === 'object') {
          parcalar.push(is.aranan_metin, is.neden);
        }
      }
    }
    anlatimMetni = parcalar.filter(p => typeof p === 'string').join(' ');
  }

  if (!anlatimMetni.trim()) {
    return { ok: true, uydurma: [] };
  }

  // 1) Olgulardaki tarihleri çıkar ve normalize et
  const olgularTarihSet = new Set();
  const olguTarihRe = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\.\d{1,2}\.\d{4})\b/g;
  let om;
  while ((om = olguTarihRe.exec(olgularMetni)) !== null) {
    const norm = normalizeTarih(om[1]);
    if (norm) olgularTarihSet.add(norm);
  }

  // Anlatımdaki tarihleri bul ve denetle
  let metinKalan = anlatimMetni;
  const anlatimTarihRe = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\.\d{1,2}\.\d{4})\b/g;
  const bulunanTarihler = [];
  let tm;
  while ((tm = anlatimTarihRe.exec(anlatimMetni)) !== null) {
    bulunanTarihler.push(tm[1]);
  }

  for (const rawDate of bulunanTarihler) {
    const norm = normalizeTarih(rawDate);
    if (!norm || (!olgularTarihSet.has(norm) && !olgularMetni.includes(rawDate))) {
      uydurma.push(rawDate);
    }
  }

  // Tarihleri metinden temizle (yıl veya gün 3+ basamaklı sayı olarak tekrar işlenmesin)
  metinKalan = metinKalan.replace(/\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\.\d{1,2}\.\d{4})\b/g, ' ');
  // Tek başına yıl (2000–2099) serbest: "1 Aralık 2026" gibi yazılı tarihler için (25.11.2026).
  // Fiyat/IK/kod gibi diğer 3+ haneli sayılar verideki değerle birebir tutmak zorunda.
  metinKalan = metinKalan.replace(/(?<![\d.,])20\d{2}(?![\d.,])/g, ' ');

  // 2) Ondalıklı sayıları (12,34 / 12.34) çıkar ve denetle (virgül / nokta eşdeğer)
  // Olgulardaki ondalıklı sayıları topla
  const olgularOndalikSet = new Set();
  const olgularOndalikFloatSet = new Set();
  const olguOndalikRe = /\b\d+[,.]\d+\b/g;
  let oom;
  while ((oom = olguOndalikRe.exec(olgularMetni)) !== null) {
    const norm = oom[0].replace(',', '.');
    olgularOndalikSet.add(norm);
    const f = parseFloat(norm);
    if (!Number.isNaN(f)) olgularOndalikFloatSet.add(f);
  }

  const ondalikRe = /\b\d+[,.]\d+\b/g;
  const bulunanOndaliklar = [];
  let odm;
  while ((odm = ondalikRe.exec(metinKalan)) !== null) {
    bulunanOndaliklar.push(odm[0]);
  }

  for (const rawDec of bulunanOndaliklar) {
    const norm = rawDec.replace(',', '.');
    const f = parseFloat(norm);
    const eslesiyor =
      olgularOndalikSet.has(norm) ||
      olgularOndalikFloatSet.has(f) ||
      olgularMetni.includes(rawDec) ||
      olgularMetni.includes(norm) ||
      olgularMetni.includes(rawDec.replace('.', ','));

    if (!eslesiyor) {
      uydurma.push(rawDec);
    }
  }

  // Ondalıkları metinden temizle
  metinKalan = metinKalan.replace(/\b\d+[,.]\d+\b/g, ' ');

  // 3) Kalan tam sayıları çıkar
  // 1-2 basamaklılar serbest, 3+ basamaklılar olgularda geçmeli
  const tamSayiRe = /\b\d+\b/g;
  let tsm;
  while ((tsm = tamSayiRe.exec(metinKalan)) !== null) {
    const numStr = tsm[0];
    if (numStr.length >= 3) {
      // Olgular metninde bu sayı geçiyor mu?
      if (!olgularMetni.includes(numStr)) {
        uydurma.push(numStr);
      }
    }
  }

  const tekilUydurma = [...new Set(uydurma)];
  return {
    ok: tekilUydurma.length === 0,
    uydurma: tekilUydurma,
  };
}

/**
 * Anlatım nesnesinin şemaya, sınırlara, sır taramasına ve yasak kalıplara
 * uygunluğunu denetler. Olgular verilmişse rakam korumasını da uygular.
 *
 * @param {any} a
 * @param {object} [opsiyonlar]
 * @param {any} [opsiyonlar.olgular]
 * @param {string[] | Set<string>} [opsiyonlar.belgeAdlari]
 * @param {boolean} [opsiyonlar.aciklama]
 * @returns {{ ok: boolean, hatalar: string[] }}
 */
export function anlatimGecerliMi(a, { olgular, belgeAdlari, aciklama = false } = {}) {
  const hatalar = [];

  if (!a || typeof a !== 'object' || Array.isArray(a)) {
    return { ok: false, hatalar: ['anlatim nesne olmali'] };
  }

  // 1) Bilinmeyen kök anahtar denetimi
  for (const k of Object.keys(a)) {
    if (!IZINLI_KOK_ANAHTARLAR.has(k)) {
      hatalar.push(`bilinmeyen_anahtar: ${k}`);
    }
  }

  // Çarpan: Açıklama isteğinde sınırlar ×2
  const carpan = aciklama ? 2 : 1;

  // 2) Alan tipi ve uzunluk denetimleri
  const metinAlanlari = [
    { ad: 'baslik', max: 80 * carpan },
    { ad: 'ne_oldu', max: 700 * carpan },
    { ad: 'bizi_etkisi', max: 700 * carpan },
    { ad: 'senden_istenen', max: 300 * carpan },
    { ad: 'uygula_ne_yapar', max: 250 * carpan },
    { ad: 'birak_ne_yapar', max: 250 * carpan },
    { ad: 'oneri', max: 400 * carpan },
  ];

  for (const { ad, max } of metinAlanlari) {
    const val = a[ad];
    if (typeof val !== 'string' || val.trim().length === 0) {
      hatalar.push(`${ad} bos olmayan string olmali`);
    } else if (val.length > max) {
      hatalar.push(`${ad} siniri asti: ${val.length} > ${max}`);
    } else {
      // Yasak kalıp denetimi
      const yasak = yasakKalipBul(val);
      if (yasak) {
        hatalar.push(`${ad} yasak kalip iceriyor: ${yasak}`);
      }
      // Sır denetimi
      if (sirIceriyor(val)) {
        hatalar.push(`${ad} sir iceriyor`);
      }
    }
  }

  // aciliyet
  if (!GECERLI_ACILIYET.has(a.aciliyet)) {
    hatalar.push(`gecersiz_aciliyet: ${a.aciliyet}`);
  }

  // son_tarih
  if (a.son_tarih !== null && a.son_tarih !== undefined) {
    if (typeof a.son_tarih !== 'string' || !gecerliTarihMi(a.son_tarih)) {
      hatalar.push(`gecersiz_son_tarih: ${a.son_tarih}`);
    } else {
      if (yasakKalipBul(a.son_tarih)) {
        hatalar.push('son_tarih yasak kalip iceriyor');
      }
    }
  }

  // isaretler
  const maxIsaret = 3 * carpan;
  if (!Array.isArray(a.isaretler)) {
    hatalar.push('isaretler dizi olmali');
  } else if (a.isaretler.length > maxIsaret) {
    hatalar.push(`isaretler siniri asti: ${a.isaretler.length} > ${maxIsaret}`);
  } else {
    const gecerliBelgeler = belgeAdlari
      ? belgeAdlari instanceof Set
        ? belgeAdlari
        : new Set(belgeAdlari)
      : null;

    for (let i = 0; i < a.isaretler.length; i++) {
      const is = a.isaretler[i];
      if (!is || typeof is !== 'object' || Array.isArray(is)) {
        hatalar.push(`isaretler[${i}] nesne olmali`);
        continue;
      }

      for (const k of Object.keys(is)) {
        if (!IZINLI_ISARET_ANAHTARLAR.has(k)) {
          hatalar.push(`isaretler[${i}] bilinmeyen_anahtar: ${k}`);
        }
      }

      // belge
      if (typeof is.belge !== 'string' || is.belge.trim().length === 0) {
        hatalar.push(`isaretler[${i}].belge bos olmayan string olmali`);
      } else if (gecerliBelgeler && !gecerliBelgeler.has(is.belge)) {
        hatalar.push(`isaretler[${i}].belge bilinmiyor: ${is.belge}`);
      }

      // aranan_metin
      const maxAranan = 120 * carpan;
      if (typeof is.aranan_metin !== 'string' || is.aranan_metin.trim().length === 0) {
        hatalar.push(`isaretler[${i}].aranan_metin bos olmayan string olmali`);
      } else if (is.aranan_metin.length > maxAranan) {
        hatalar.push(`isaretler[${i}].aranan_metin siniri asti: ${is.aranan_metin.length} > ${maxAranan}`);
      } else {
        const yasak = yasakKalipBul(is.aranan_metin);
        if (yasak) {
          hatalar.push(`isaretler[${i}].aranan_metin yasak kalip iceriyor: ${yasak}`);
        }
        if (sirIceriyor(is.aranan_metin)) {
          hatalar.push(`isaretler[${i}].aranan_metin sir iceriyor`);
        }
      }

      // neden
      const maxNeden = 200 * carpan;
      if (typeof is.neden !== 'string' || is.neden.trim().length === 0) {
        hatalar.push(`isaretler[${i}].neden bos olmayan string olmali`);
      } else if (is.neden.length > maxNeden) {
        hatalar.push(`isaretler[${i}].neden siniri asti: ${is.neden.length} > ${maxNeden}`);
      } else {
        const yasak = yasakKalipBul(is.neden);
        if (yasak) {
          hatalar.push(`isaretler[${i}].neden yasak kalip iceriyor: ${yasak}`);
        }
        if (sirIceriyor(is.neden)) {
          hatalar.push(`isaretler[${i}].neden sir iceriyor`);
        }
      }
    }
  }

  // 3) Rakam koruması (olgular verilmişse)
  if (olgular !== undefined && olgular !== null) {
    const koruma = rakamKorumasi(a, olgular);
    if (!koruma.ok) {
      for (const u of koruma.uydurma) {
        hatalar.push(`uydurma_rakam: ${u}`);
      }
    }
  }

  return {
    ok: hatalar.length === 0,
    hatalar,
  };
}

/**
 * Denetçi ve ajan çıktıları arasından en güvenilir ve geçerli anlatımı seçer.
 * Öncelik:
 * 1. denetim.duzeltilmis (geçerli + rakam koruması tamam ise) -> 'denetci'
 * 2. denetim.anlasilir === true ise ajanınki (geçerli + koruma tamam ise) -> 'ajan'
 * 3. aksi halde null
 *
 * @param {object} params
 * @param {any} [params.anlatim]
 * @param {any} [params.denetim]
 * @param {any} [params.olgular]
 * @param {string[] | Set<string>} [params.belgeAdlari]
 * @returns {{ anlatim: object | null, kaynak: 'denetci' | 'ajan' | null, notlar: string[] }}
 */
export function anlatimSec({ anlatim, denetim, olgular, belgeAdlari } = {}) {
  const notlar = [];

  // 1) Denetçinin düzeltilmiş anlatımı var mı?
  if (denetim?.duzeltilmis) {
    const dg = anlatimGecerliMi(denetim.duzeltilmis, { olgular, belgeAdlari });
    const dr = rakamKorumasi(denetim.duzeltilmis, olgular);
    if (dg.ok && dr.ok) {
      notlar.push('denetci duzeltmesi gecerli ve secildi');
      return {
        anlatim: denetim.duzeltilmis,
        kaynak: 'denetci',
        notlar,
      };
    } else {
      notlar.push(`denetci duzeltmesi gecersiz: ${[...dg.hatalar, ...dr.uydurma].join('; ')}`);
    }
  }

  // 2) Denetçi onaylamışsa ajanın anlatımını dene
  if (denetim?.anlasilir === true && anlatim) {
    const ag = anlatimGecerliMi(anlatim, { olgular, belgeAdlari });
    const ar = rakamKorumasi(anlatim, olgular);
    if (ag.ok && ar.ok) {
      notlar.push('ajan anlatimi gecerli ve secildi');
      return {
        anlatim,
        kaynak: 'ajan',
        notlar,
      };
    } else {
      notlar.push(`ajan anlatimi gecersiz: ${[...ag.hatalar, ...ar.uydurma].join('; ')}`);
    }
  } else if (denetim && denetim.anlasilir === false) {
    notlar.push('denetci anlatimi anlasilir bulmadi');
  }

  notlar.push('gecerli anlatim bulunamadi');
  return {
    anlatim: null,
    kaynak: null,
    notlar,
  };
}

/**
 * Anlatımdan Telegram mesaj metni ve düğmeleri üretir.
 * Telegram sınırı <= 3900 karakter (kesilirse son satır …).
 * Vaka id'si metne yazılmaz.
 *
 * @param {object} params
 * @param {object} params.vaka
 * @param {object} params.anlatim
 * @returns {{ text: string, knoepfe: Array<Array<{ text: string, befehl: string }>> }}
 */
export function mesajKur({ vaka, anlatim }) {
  if (!vaka || !anlatim) {
    throw new Error('vaka ve anlatim zorunludur');
  }

  const satirlar = [];

  // Başlık
  satirlar.push(`📌 ${anlatim.baslik}`);

  // Tarih ve aciliyet satırı
  let tarihMetni = null;
  if (anlatim.son_tarih) {
    const p = anlatim.son_tarih.split('-');
    if (p.length === 3) {
      tarihMetni = `${p[2]}.${p[1]}.${p[0]}`;
    } else {
      tarihMetni = anlatim.son_tarih;
    }
  }

  if (anlatim.aciliyet === 'yuksek') {
    if (tarihMetni) {
      satirlar.push(`⏰ Acil — son tarih: ${tarihMetni}`);
    } else {
      satirlar.push('⏰ Acil');
    }
  } else if (tarihMetni) {
    satirlar.push(`Son tarih: ${tarihMetni}`);
  }

  satirlar.push('');
  satirlar.push('Ne oldu?');
  satirlar.push(anlatim.ne_oldu);

  satirlar.push('');
  satirlar.push('Bizi nasıl etkiliyor?');
  satirlar.push(anlatim.bizi_etkisi);

  satirlar.push('');
  satirlar.push('Senden istediğim:');
  satirlar.push(anlatim.senden_istenen);

  satirlar.push('');
  const otomatikUygulanabilir = vaka.ek?.uygulanabilir !== false;
  if (otomatikUygulanabilir) {
    satirlar.push(`✅ Uygula → ${anlatim.uygula_ne_yapar}`);
  } else {
    satirlar.push('Bu konu otomatik uygulanamıyor; karar verirsen Claude yerel oturumda yapar.');
  }
  satirlar.push(`❌ Bırak → ${anlatim.birak_ne_yapar}`);

  satirlar.push('');
  satirlar.push(`Benim önerim: ${anlatim.oneri}`);

  if (Array.isArray(anlatim.isaretler) && anlatim.isaretler.length > 0) {
    satirlar.push('📎 Yukarıdaki görselde ilgili yeri sarıyla işaretledim.');
  }

  let text = satirlar.join('\n');
  if (text.length > 3900) {
    text = text.slice(0, 3899) + '…';
  }

  // Düğmeler
  let knoepfe;
  if (otomatikUygulanabilir) {
    knoepfe = [
      [
        { text: '✅ Uygula', befehl: `v:${vaka.id}:uygula` },
        { text: '❌ Bırak', befehl: `v:${vaka.id}:birak` },
      ],
      [
        { text: '💬 Açıkla', befehl: `v:${vaka.id}:acikla` },
      ],
    ];
  } else {
    knoepfe = [
      [
        { text: '❌ Bırak', befehl: `v:${vaka.id}:birak` },
      ],
      [
        { text: '💬 Açıkla', befehl: `v:${vaka.id}:acikla` },
      ],
    ];
  }

  return { text, knoepfe };
}

/**
 * Anlatım hiç geçerli değilse üretilecek sade yedek mesaj.
 * Ham satırlar ve dosya adları gösterilmez. Vaka id metne yazılmaz.
 *
 * @param {object} params
 * @param {object} params.vaka
 * @returns {{ text: string, knoepfe: Array<Array<{ text: string, befehl: string }>> }}
 */
export function yedekMesaj({ vaka }) {
  if (!vaka) {
    throw new Error('vaka zorunludur');
  }

  // Başlığı sadeleştir: teknik uzantı ve yolları temizle
  let sadeBaslik = String(vaka.baslik || 'Bekçi bildirimi')
    .replace(/\.(pdf|txt|xlsx|zip|json|mjs|js|sql)\b/gi, '')
    .replace(YASAK_YOL_RE, '')
    .trim();
  if (!sadeBaslik) sadeBaslik = 'Yeni bir konu var';

  const text = `📌 ${sadeBaslik}\n\nBunu sana anlaşılır biçimde özetleyemedim. Karar vermeden önce "💬 Açıkla"ya bas, ayrıntılı anlatayım.`;

  const otomatikUygulanabilir = vaka.ek?.uygulanabilir !== false;
  let knoepfe;
  if (otomatikUygulanabilir) {
    knoepfe = [
      [
        { text: '✅ Uygula', befehl: `v:${vaka.id}:uygula` },
        { text: '❌ Bırak', befehl: `v:${vaka.id}:birak` },
      ],
      [
        { text: '💬 Açıkla', befehl: `v:${vaka.id}:acikla` },
      ],
    ];
  } else {
    knoepfe = [
      [
        { text: '❌ Bırak', befehl: `v:${vaka.id}:birak` },
      ],
      [
        { text: '💬 Açıkla', befehl: `v:${vaka.id}:acikla` },
      ],
    ];
  }

  return { text, knoepfe };
}
