// FUNKTIONSKARTE-MCP — Model Context Protocol (MCP) stdio sunucusu.
//
// Ne işe yarar:
//   `funktionen/INDEX.json` (~257k satır) ve `db/NUTZUNG.json` dosyalarını
//   Claude Code ajanlarının dosyanın tamamını belleğe yüklemeden hızlı,
//   hafif ve indeksli şekilde sorgulayabilmesini sağlar.
//   Tamamen yereldir, ağ çağrısı yoktur, npm bağımlılığı yoktur (yalnız `node:` modülleri).
//
// Claude Code'a kayıt (.mcp.json):
//   {
//     "mcpServers": {
//       "funktionskarte": {
//         "command": "node",
//         "args": ["tools/funktionskarte-mcp.mjs"]
//       }
//     }
//   }
//
// Kural:
//   Yayına gitmez (`tools/` dizini `.vercelignore` içindedir).
//   Kutuya / on-prem paketine girmez.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

export const VARSAYILAN_KOK = process.env.FUNKTIONSKARTE_ROOT || fileURLToPath(new URL('..', import.meta.url));

/**
 * MCP araç tanımları (Türkçe kısa açıklamalar ve JSON Schema girdi modelleri).
 */
export const araclar = [
  {
    name: 'fonksiyon_bul',
    description: 'İsim, alt dize/regex veya dosya filtresiyle fonksiyonları kompakt listeler.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tam veya kısmi fonksiyon adı (tam eşleşmeler öne alınır)' },
        ara: { type: 'string', description: 'Fonksiyon adı içinde aranacak alt dize veya regex (büyük-küçük duyarsız)' },
        dosya: { type: 'string', description: 'Dosya adı veya yolu filtresi' },
        limit: { type: 'number', description: 'Maksimum sonuç sayısı (varsayılan 30)' }
      }
    }
  },
  {
    name: 'fonksiyon_detay',
    description: 'Fonksiyonun tüm alanlarıyla eksiksiz detayını döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Aranacak fonksiyon adı' },
        dosya: { type: 'string', description: 'İsteğe bağlı dosya yolu filtresi' }
      },
      required: ['name']
    }
  },
  {
    name: 'cagiranlar',
    description: 'Fonksiyonu çağıranların (calledBy) derinlikli etki analizi (blast radius) ağacını çıkarır.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Hedef fonksiyon adı' },
        derinlik: { type: 'number', description: 'Arama derinliği (1-4, varsayılan 1)' },
        limit: { type: 'number', description: 'En fazla kayıt (varsayılan 150)' }
      },
      required: ['name']
    }
  },
  {
    name: 'cagirdiklari',
    description: 'Fonksiyonun çağırdığı (calls) alt fonksiyonların çağrı ağacını çıkarır.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Kaynak fonksiyon adı' },
        derinlik: { type: 'number', description: 'Arama derinliği (1-4, varsayılan 1)' },
        limit: { type: 'number', description: 'En fazla kayıt (varsayılan 150)' }
      },
      required: ['name']
    }
  },
  {
    name: 'tablo_kullanan',
    description: 'Veritabanı tablosunu okuyan ve yazan fonksiyonları listeler, kullanım şemasını gösterir.',
    inputSchema: {
      type: 'object',
      properties: {
        tablo: { type: 'string', description: 'Veritabanı tablo adı' },
        limit: { type: 'number', description: 'Okuyan/yazan listesi başına en fazla kayıt (varsayılan 15)' },
        tam: { type: 'boolean', description: 'true: kesmeden tüm liste + ham NUTZUNG kaydı (büyük olabilir)' }
      },
      required: ['tablo']
    }
  },
  {
    name: 'dom_hedefi',
    description: 'Belirli bir DOM element id\'sini kullanan veya render eden fonksiyonları bulur.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'DOM element ID\'si' }
      },
      required: ['id']
    }
  },
  {
    name: 'kopya_adaylari',
    description: 'Aynı tabloya yazıp birbirini çağırmayan kopya fonksiyon kümelerini listeler.',
    inputSchema: {
      type: 'object',
      properties: {
        tablo: { type: 'string', description: 'İsteğe bağlı tablo filtresi' },
        limit: { type: 'number', description: 'Maksimum küme sayısı (varsayılan 3)' }
      }
    }
  },
  {
    name: 'dosya_fonksiyonlari',
    description: 'Belirtilen dosyadaki tüm fonksiyonları satır sırasıyla listeler.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'En fazla kayıt (varsayılan 150)' },
        dosya: { type: 'string', description: 'Dosya adı veya yolu' }
      },
      required: ['dosya']
    }
  },
  {
    name: 'harita_durumu',
    description: 'Fonksiyon haritası ve tablo kullanım verilerinin güncellik durumunu gösterir.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Sunucu durumunu başlatır.
 */
export function durumOlustur(kok = VARSAYILAN_KOK) {
  return {
    kok,
    indexPfad: join(kok, 'funktionen', 'INDEX.json'),
    nutzungPfad: join(kok, 'db', 'NUTZUNG.json'),
    indexMtime: 0,
    nutzungMtime: 0,
    indexVerisi: null,
    nutzungVerisi: null,
    isimHaritasi: new Map(),
    dosyaHaritasi: new Map(),
    domHaritasi: new Map(),
    tabloHaritasi: new Map()
  };
}

/**
 * INDEX.json ve NUTZUNG.json verilerini mtime kontrolüyle tembel (lazy) yükler.
 */
export function verileriYukle(durum) {
  // 1. INDEX.json kontrolü
  if (existsSync(durum.indexPfad)) {
    try {
      const st = statSync(durum.indexPfad);
      if (st.mtimeMs !== durum.indexMtime || !durum.indexVerisi) {
        durum.indexVerisi = JSON.parse(readFileSync(durum.indexPfad, 'utf8'));
        durum.indexMtime = st.mtimeMs;
        indeksleriKur(durum);
      }
    } catch (e) {
      console.error(`[funktionskarte-mcp] INDEX.json okuma hatası: ${e.message}`);
    }
  } else {
    durum.indexVerisi = null;
    durum.indexMtime = 0;
    durum.isimHaritasi.clear();
    durum.dosyaHaritasi.clear();
    durum.domHaritasi.clear();
    durum.tabloHaritasi.clear();
  }

  // 2. NUTZUNG.json kontrolü (yoksa zarifçe null kalır)
  if (existsSync(durum.nutzungPfad)) {
    try {
      const st = statSync(durum.nutzungPfad);
      if (st.mtimeMs !== durum.nutzungMtime || !durum.nutzungVerisi) {
        durum.nutzungVerisi = JSON.parse(readFileSync(durum.nutzungPfad, 'utf8'));
        durum.nutzungMtime = st.mtimeMs;
      }
    } catch (e) {
      console.error(`[funktionskarte-mcp] NUTZUNG.json okuma hatası: ${e.message}`);
    }
  } else {
    durum.nutzungVerisi = null;
    durum.nutzungMtime = 0;
  }
}

/**
 * Hızlı arama için Map indekslerini oluşturur.
 */
function indeksleriKur(durum) {
  durum.isimHaritasi.clear();
  durum.dosyaHaritasi.clear();
  durum.domHaritasi.clear();
  durum.tabloHaritasi.clear();

  const eintraege = durum.indexVerisi?.eintraege || [];

  for (const fn of eintraege) {
    // İsim indeksi
    if (fn.name) {
      let arr = durum.isimHaritasi.get(fn.name);
      if (!arr) {
        arr = [];
        durum.isimHaritasi.set(fn.name, arr);
      }
      arr.push(fn);
    }

    // Dosya indeksi
    if (fn.file) {
      let arr = durum.dosyaHaritasi.get(fn.file);
      if (!arr) {
        arr = [];
        durum.dosyaHaritasi.set(fn.file, arr);
      }
      arr.push(fn);
    }

    // DOM id indeksi
    if (Array.isArray(fn.domIds)) {
      for (const id of fn.domIds) {
        if (!id) continue;
        let arr = durum.domHaritasi.get(id);
        if (!arr) {
          arr = [];
          durum.domHaritasi.set(id, arr);
        }
        arr.push(fn);
      }
    }

    // Tablo okuyanlar
    if (Array.isArray(fn.tables)) {
      for (const t of fn.tables) {
        if (!t) continue;
        let entry = durum.tabloHaritasi.get(t);
        if (!entry) {
          entry = { okuyan: [], yazan: [] };
          durum.tabloHaritasi.set(t, entry);
        }
        entry.okuyan.push(fn);
      }
    }

    // Tablo yazanlar
    if (Array.isArray(fn.writes)) {
      for (const w of fn.writes) {
        if (!w) continue;
        const [t, op] = w.split(':');
        if (!t) continue;
        let entry = durum.tabloHaritasi.get(t);
        if (!entry) {
          entry = { okuyan: [], yazan: [] };
          durum.tabloHaritasi.set(t, entry);
        }
        entry.yazan.push({
          eintrag: fn,
          op: op || 'write',
          rawWrite: w
        });
      }
    }
  }
}

// ── Araç Çalıştırıcıları ─────────────────────────────────────────────────────

function calistirFonksiyonBul(durum, args) {
  const { name, ara, dosya, limit: rawLimit } = args;
  const limit = Math.max(1, Math.min(Number(rawLimit) || 30, 200));

  const eintraege = durum.indexVerisi?.eintraege || [];

  let regex = null;
  if (ara) {
    try {
      regex = new RegExp(ara, 'i');
    } catch {
      // Regex geçersizse alt dize eşleşmesi fallback
    }
  }

  const tamEslesenler = [];
  const digerEslesenler = [];

  for (const fn of eintraege) {
    if (dosya) {
      const fLower = (fn.file || '').toLowerCase();
      const dLower = dosya.toLowerCase();
      if (!fLower.includes(dLower) && !fLower.endsWith(dLower)) {
        continue;
      }
    }

    let eslesti = false;
    let tamAd = false;

    if (name) {
      if (fn.name === name) {
        tamAd = true;
        eslesti = true;
      } else if (fn.name?.toLowerCase() === name.toLowerCase()) {
        tamAd = true;
        eslesti = true;
      } else if (fn.name?.toLowerCase().includes(name.toLowerCase())) {
        eslesti = true;
      }
    }

    if (ara) {
      const match = regex ? regex.test(fn.name) : fn.name?.toLowerCase().includes(ara.toLowerCase());
      if (name) {
        if (!match) eslesti = false;
      } else {
        if (match) eslesti = true;
      }
    }

    if (!name && !ara && dosya) {
      eslesti = true;
    }

    if (eslesti) {
      const kompakt = {
        name: fn.name,
        file: fn.file,
        start: fn.start,
        end: fn.end,
        lines: fn.lines,
        tables: fn.tables || [],
        writes: fn.writes || [],
        endpoints: fn.endpoints || [],
        modules: fn.modules || [],
        uiPfad: fn.uiPfad || [],
        calls: (fn.calls || []).length,
        calledBy: (fn.calledBy || []).length
      };

      if (tamAd) {
        tamEslesenler.push(kompakt);
      } else {
        digerEslesenler.push(kompakt);
      }
    }
  }

  const toplamListe = [...tamEslesenler, ...digerEslesenler];
  const toplam = toplamListe.length;
  const kesildi = toplam > limit;
  const sonuclar = kesildi ? toplamListe.slice(0, limit) : toplamListe;

  return {
    sonuclar,
    toplam,
    ...(kesildi ? { kesildi: true, limit } : {})
  };
}

function calistirFonksiyonDetay(durum, args) {
  const { name, dosya } = args;
  if (!name) throw new Error('name parametresi zorunludur');

  const eslesenler = (durum.isimHaritasi.get(name) || []).filter(fn => {
    if (!dosya) return true;
    const fLower = (fn.file || '').toLowerCase();
    const dLower = dosya.toLowerCase();
    return fLower === dLower || fLower.includes(dLower) || fLower.endsWith(dLower);
  });

  return {
    name,
    toplam: eslesenler.length,
    kayitlar: eslesenler
  };
}

// Cevap boyu sınırı (06.11.2026): sunucunun amacı token tasarrufu. Derinlik 4'te
// çağrı ağacı 120 KB'a, dashboard.js fonksiyon listesi 40 KB'a çıkıyordu.
function kesVeIsaretle(liste, rawLimit, varsayilan) {
  const limit = Math.max(1, Math.min(Number(rawLimit) || varsayilan, 2000));
  return liste.length > limit
    ? { liste: liste.slice(0, limit), ek: { kesildi: true, limit } }
    : { liste, ek: {} };
}

function calistirCagiranlar(durum, args) {
  const { name, derinlik: rawDerinlik } = args;
  if (!name) throw new Error('name parametresi zorunludur');
  const derinlik = Math.max(1, Math.min(Number(rawDerinlik) || 1, 4));

  const ziyaret = new Set([name]);
  const sonuclar = [];
  let simdikiDalga = [name];

  for (let s = 1; s <= derinlik; s++) {
    const sonrakiDalga = new Set();
    for (const hedef of simdikiDalga) {
      const tanimlar = durum.isimHaritasi.get(hedef) || [];
      const cagiranlarKumesi = new Set();
      for (const t of tanimlar) {
        for (const cb of (t.calledBy || [])) {
          cagiranlarKumesi.add(cb);
        }
      }

      for (const cagiran of cagiranlarKumesi) {
        const ustSeviye = cagiran.startsWith('(datei)');
        sonuclar.push({
          hedef,
          cagiran,
          seviye: s,
          ustSeviyeKod: ustSeviye
        });

        if (!ustSeviye && !ziyaret.has(cagiran)) {
          ziyaret.add(cagiran);
          sonrakiDalga.add(cagiran);
        }
      }
    }
    simdikiDalga = [...sonrakiDalga];
    if (simdikiDalga.length === 0) break;
  }

  return {
    fonksiyon: name,
    derinlik,
    toplamBaglanti: sonuclar.length,
    ...(({ liste, ek }) => ({ ...ek, cagiranlar: liste }))(kesVeIsaretle(sonuclar, args.limit, 150))
  };
}

function calistirCagirdiklari(durum, args) {
  const { name, derinlik: rawDerinlik } = args;
  if (!name) throw new Error('name parametresi zorunludur');
  const derinlik = Math.max(1, Math.min(Number(rawDerinlik) || 1, 4));

  const ziyaret = new Set([name]);
  const sonuclar = [];
  let simdikiDalga = [name];

  for (let s = 1; s <= derinlik; s++) {
    const sonrakiDalga = new Set();
    for (const kaynak of simdikiDalga) {
      const tanimlar = durum.isimHaritasi.get(kaynak) || [];
      const callsKumesi = new Set();
      for (const t of tanimlar) {
        for (const c of (t.calls || [])) {
          callsKumesi.add(c);
        }
      }

      for (const cagrilan of callsKumesi) {
        sonuclar.push({
          kaynak,
          cagrilan,
          seviye: s
        });

        if (!ziyaret.has(cagrilan)) {
          ziyaret.add(cagrilan);
          sonrakiDalga.add(cagrilan);
        }
      }
    }
    simdikiDalga = [...sonrakiDalga];
    if (simdikiDalga.length === 0) break;
  }

  return {
    fonksiyon: name,
    derinlik,
    toplamBaglanti: sonuclar.length,
    ...(({ liste, ek }) => ({ ...ek, cagirdiklari: liste }))(kesVeIsaretle(sonuclar, args.limit, 150))
  };
}

function calistirTabloKullanan(durum, args) {
  const { tablo } = args;
  if (!tablo) throw new Error('tablo parametresi zorunludur');

  const veri = durum.tabloHaritasi.get(tablo) || { okuyan: [], yazan: [] };

  const okuyanlar = veri.okuyan.map(fn => ({
    name: fn.name,
    file: fn.file,
    start: fn.start,
    lines: fn.lines,
    modules: fn.modules || [],
    uiPfad: fn.uiPfad || []
  }));

  const yazanlar = veri.yazan.map(item => ({
    name: item.eintrag.name,
    file: item.eintrag.file,
    start: item.eintrag.start,
    lines: item.eintrag.lines,
    op: item.op,
    rawWrite: item.rawWrite,
    modules: item.eintrag.modules || [],
    uiPfad: item.eintrag.uiPfad || []
  }));

  // NUTZUNG kaydı tek tabloda 35 KB'a çıkabiliyor (prescriptions: leser 25 KB).
  // Büyük diziler sayıya indirilir; ayrıntı isteyen `tam: true` gönderir.
  const ham = durum.nutzungVerisi?.tabellen?.find(t => t.name === tablo) || null;
  const BUYUK = ['leser', 'schreiber', 'erwaehnt', 'dateien', 'module'];
  const nutzungKaydi = !ham || args.tam ? ham : Object.fromEntries(
    Object.entries(ham).map(([k, v]) => BUYUK.includes(k) && Array.isArray(v) ? [k + 'Sayisi', v.length] : [k, v])
  );

  const limit = Number.isInteger(args.limit) && args.limit > 0 ? args.limit : 15;
  const kes = (a) => args.tam ? a : a.slice(0, limit);

  return {
    tablo,
    okuyanlarSayisi: okuyanlar.length,
    yazanlarSayisi: yazanlar.length,
    ...(!args.tam && (okuyanlar.length > limit || yazanlar.length > limit) ? { kesildi: true, limit } : {}),
    okuyanlar: kes(okuyanlar),
    yazanlar: kes(yazanlar),
    nutzung: nutzungKaydi
  };
}

function calistirDomHedefi(durum, args) {
  const { id } = args;
  if (!id) throw new Error('id parametresi zorunludur');

  const eslesenler = durum.domHaritasi.get(id) || [];
  const fonksiyonlar = eslesenler.map(fn => ({
    name: fn.name,
    file: fn.file,
    start: fn.start,
    end: fn.end,
    lines: fn.lines,
    domRender: Boolean(fn.domRender),
    domIds: fn.domIds || [],
    uiPfad: fn.uiPfad || []
  }));

  return {
    id,
    toplam: fonksiyonlar.length,
    ...(({ liste, ek }) => ({ ...ek, fonksiyonlar: liste }))(kesVeIsaretle(fonksiyonlar, args.limit, 150))
  };
}

function calistirKopyaAdaylari(durum, args) {
  const { tablo, limit: rawLimit } = args;
  const limit = Math.max(1, Math.min(Number(rawLimit) || 3, 100));

  let adaylar = durum.indexVerisi?.kopieKandidaten || [];
  if (tablo) {
    const tLower = tablo.toLowerCase();
    adaylar = adaylar.filter(k => k.tabelle === tablo || (k.tabelle && k.tabelle.toLowerCase() === tLower));
  }

  const toplam = adaylar.length;
  const kesildi = toplam > limit;
  // Kompakt biçim: her yol tek satırlık "ad dosya:satır" listesi.
  const sonuclar = (kesildi ? adaylar.slice(0, limit) : adaylar).map(k => ({
    tabelle: k.tabelle,
    anzahl: k.anzahl,
    pfade: (k.pfade || []).map(p => ({
      leitfunktion: p.leitfunktion,
      funktionen: (p.funktionen || []).map(f => `${f.name} ${f.file}:${f.start} [${(f.writes || []).join(',')}]`),
    })),
  }));

  return {
    kopyaAdaylari: sonuclar,
    toplam,
    ...(kesildi ? { kesildi: true, limit } : {})
  };
}

function calistirDosyaFonksiyonlari(durum, args) {
  const { dosya } = args;
  if (!dosya) throw new Error('dosya parametresi zorunludur');

  let eslesenler = durum.dosyaHaritasi.get(dosya);
  if (!eslesenler) {
    const dLower = dosya.toLowerCase();
    for (const [fPath, fns] of durum.dosyaHaritasi.entries()) {
      const pLower = fPath.toLowerCase();
      if (pLower === dLower || pLower.endsWith(dLower) || pLower.includes(dLower)) {
        eslesenler = fns;
        break;
      }
    }
  }

  const liste = (eslesenler || []).slice().sort((a, b) => a.start - b.start);
  const fonksiyonlar = liste.map(fn => ({
    name: fn.name,
    start: fn.start,
    end: fn.end,
    lines: fn.lines
  }));

  return {
    dosya,
    toplam: fonksiyonlar.length,
    ...(({ liste, ek }) => ({ ...ek, fonksiyonlar: liste }))(kesVeIsaretle(fonksiyonlar, args.limit, 150))
  };
}

function calistirHaritaDurumu(durum) {
  return {
    erzeugt: durum.indexVerisi?.erzeugt || null,
    dateien: durum.indexVerisi?.dateien || 0,
    funktionen: durum.indexVerisi?.funktionen || 0,
    indexMtime: durum.indexMtime ? new Date(durum.indexMtime).toISOString() : null,
    nutzungMtime: durum.nutzungMtime ? new Date(durum.nutzungMtime).toISOString() : null,
    not: 'eski olabilir: node tools/funktionskarte.mjs ile tazele'
  };
}

// ── JSON-RPC Mesaj İşleme ───────────────────────────────────────────────────

/**
 * Tek bir JSON-RPC mesajını işler ve gerekiyorsa cevabı döner.
 */
export function isle(mesaj, durum) {
  if (!mesaj || typeof mesaj !== 'object') return null;

  const { id, method, params } = mesaj;

  // JSON-RPC bildirimi: id yoksa veya method notifications/ ile başlıyorsa yanıt üretilmez
  if (id === undefined || id === null) {
    return null;
  }
  if (typeof method === 'string' && method.startsWith('notifications/')) {
    return null;
  }

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'praxura-funktionskarte',
          version: '1.0.0'
        }
      }
    };
  }

  if (method === 'ping') {
    return {
      jsonrpc: '2.0',
      id,
      result: {}
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: araclar
      }
    };
  }

  if (method === 'tools/call') {
    verileriYukle(durum);

    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    const tool = araclar.find(t => t.name === toolName);
    if (!tool) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Bilinmeyen araç: ${toolName}`
            }
          ],
          isError: true
        }
      };
    }

    try {
      let sonuc;
      switch (toolName) {
        case 'fonksiyon_bul':
          sonuc = calistirFonksiyonBul(durum, toolArgs);
          break;
        case 'fonksiyon_detay':
          sonuc = calistirFonksiyonDetay(durum, toolArgs);
          break;
        case 'cagiranlar':
          sonuc = calistirCagiranlar(durum, toolArgs);
          break;
        case 'cagirdiklari':
          sonuc = calistirCagirdiklari(durum, toolArgs);
          break;
        case 'tablo_kullanan':
          sonuc = calistirTabloKullanan(durum, toolArgs);
          break;
        case 'dom_hedefi':
          sonuc = calistirDomHedefi(durum, toolArgs);
          break;
        case 'kopya_adaylari':
          sonuc = calistirKopyaAdaylari(durum, toolArgs);
          break;
        case 'dosya_fonksiyonlari':
          sonuc = calistirDosyaFonksiyonlari(durum, toolArgs);
          break;
        case 'harita_durumu':
          sonuc = calistirHaritaDurumu(durum);
          break;
        default:
          throw new Error(`Araç uygulayıcısı bulunamadı: ${toolName}`);
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sonuc, null, 1)
            }
          ]
        }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: err?.message || String(err)
            }
          ],
          isError: true
        }
      };
    }
  }

  // Bilinmeyen metot
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}

/**
 * Satır bazlı stdio JSON-RPC döngüsünü başlatır.
 */
export function baslat(durum) {
  const rl = createInterface({
    input: process.stdin,
    terminal: false
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let mesaj;
    try {
      mesaj = JSON.parse(trimmed);
    } catch (parseErr) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${parseErr.message}`
        }
      }) + '\n');
      return;
    }

    try {
      const yanit = isle(mesaj, durum);
      if (yanit !== null && yanit !== undefined) {
        process.stdout.write(JSON.stringify(yanit) + '\n');
      }
    } catch (err) {
      console.error(`[funktionskarte-mcp] Beklenmeyen hata: ${err.stack || err.message}`);
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

// ── Doğrudan CLI ile çalıştırma kontrolü ─────────────────────────────────────
const suankiDosyaUrl = import.meta.url;
const calistirilanDosyaUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (calistirilanDosyaUrl && suankiDosyaUrl === calistirilanDosyaUrl) {
  const durum = durumOlustur();
  baslat(durum);
}
