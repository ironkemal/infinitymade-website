import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { durumOlustur, isle, araclar } from './funktionskarte-mcp.mjs';

const sunucuDosyaYolu = fileURLToPath(new URL('./funktionskarte-mcp.mjs', import.meta.url));

describe('funktionskarte-mcp birim ve protokol testleri', () => {
  let tmpDir;
  let durum;

  const sahteIndex = {
    erzeugt: '2026-11-06',
    dateien: 2,
    funktionen: 4,
    module: ['abrechnung', 'dashboard'],
    kopieKandidaten: [
      {
        tabelle: 'abrechnung',
        anzahl: 1,
        pfade: [
          {
            leitfunktion: 'fnB',
            funktionen: [
              {
                name: 'fnB',
                file: 'module/b.js',
                start: 10,
                end: 25,
                lines: 16,
                writes: ['abrechnung:insert'],
                modules: ['abrechnung'],
                uiPfad: ['Abrechnung']
              }
            ]
          }
        ]
      }
    ],
    doppelteNamen: [],
    bilinciAynalar: [],
    eintraege: [
      {
        name: 'fnA',
        kind: 'function',
        lang: 'js',
        file: 'module/a.js',
        start: 5,
        end: 15,
        lines: 11,
        spiegelHinweis: null,
        tables: ['abrechnung'],
        rpcs: [],
        writes: [],
        endpoints: [],
        storage: [],
        domIds: ['btnSave'],
        domRender: true,
        calls: ['fnB'],
        calledBy: ['(datei) module/a.js'],
        modules: ['abrechnung'],
        gemeinsam: false,
        uiPfad: ['Abrechnung', 'Kaydet']
      },
      {
        name: 'fnB',
        kind: 'function',
        lang: 'js',
        file: 'module/b.js',
        start: 10,
        end: 25,
        lines: 16,
        spiegelHinweis: null,
        tables: ['abrechnung'],
        rpcs: [],
        writes: ['abrechnung:insert'],
        endpoints: [],
        storage: [],
        domIds: [],
        domRender: false,
        calls: ['fnC'],
        calledBy: ['fnA'],
        modules: ['abrechnung'],
        gemeinsam: false,
        uiPfad: ['Abrechnung']
      },
      {
        name: 'fnC',
        kind: 'function',
        lang: 'js',
        file: 'module/b.js',
        start: 30,
        end: 40,
        lines: 11,
        spiegelHinweis: null,
        tables: ['patients'],
        rpcs: [],
        writes: ['patients:update'],
        endpoints: [],
        storage: [],
        domIds: [],
        domRender: false,
        calls: [],
        calledBy: ['fnB'],
        modules: [],
        gemeinsam: false,
        uiPfad: []
      },
      {
        name: 'fnHelper',
        kind: 'function',
        lang: 'js',
        file: 'module/helper.js',
        start: 1,
        end: 5,
        lines: 5,
        spiegelHinweis: null,
        tables: [],
        rpcs: [],
        writes: [],
        endpoints: [],
        storage: [],
        domIds: ['toastContainer'],
        domRender: false,
        calls: [],
        calledBy: [],
        modules: [],
        gemeinsam: true,
        uiPfad: []
      }
    ]
  };

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fn-mcp-test-'));
    mkdirSync(join(tmpDir, 'funktionen'), { recursive: true });
    mkdirSync(join(tmpDir, 'db'), { recursive: true });

    // INDEX.json yaz
    writeFileSync(join(tmpDir, 'funktionen', 'INDEX.json'), JSON.stringify(sahteIndex, null, 2), 'utf8');

    // Başlangıçta NUTZUNG.json yazmıyoruz — yokken zarifçe çalışma testi için
    durum = durumOlustur(tmpDir);
  });

  after(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Temizlik hatasını yut
    }
  });

  test('1. initialize isteği doğru başlık ve yetenekleri döner', () => {
    const mesaj = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' }
    };

    const yanit = isle(mesaj, durum);
    assert.equal(yanit.jsonrpc, '2.0');
    assert.equal(yanit.id, 1);
    assert.equal(yanit.result.protocolVersion, '2024-11-05');
    assert.equal(yanit.result.serverInfo.name, 'praxura-funktionskarte');
    assert.deepEqual(yanit.result.capabilities, { tools: {} });
  });

  test('2. ping isteği boş result nesnesi döner', () => {
    const mesaj = { jsonrpc: '2.0', id: 2, method: 'ping' };
    const yanit = isle(mesaj, durum);
    assert.equal(yanit.id, 2);
    assert.deepEqual(yanit.result, {});
  });

  test('3. tools/list tam 9 araç döndürür ve şemaları geçerlidir', () => {
    const mesaj = { jsonrpc: '2.0', id: 3, method: 'tools/list' };
    const yanit = isle(mesaj, durum);
    assert.equal(yanit.id, 3);
    assert.ok(Array.isArray(yanit.result.tools));
    assert.equal(yanit.result.tools.length, 9);

    const isimler = yanit.result.tools.map(t => t.name);
    assert.ok(isimler.includes('fonksiyon_bul'));
    assert.ok(isimler.includes('fonksiyon_detay'));
    assert.ok(isimler.includes('cagiranlar'));
    assert.ok(isimler.includes('cagirdiklari'));
    assert.ok(isimler.includes('tablo_kullanan'));
    assert.ok(isimler.includes('dom_hedefi'));
    assert.ok(isimler.includes('kopya_adaylari'));
    assert.ok(isimler.includes('dosya_fonksiyonlari'));
    assert.ok(isimler.includes('harita_durumu'));

    for (const t of yanit.result.tools) {
      assert.ok(t.description && typeof t.description === 'string');
      assert.equal(t.inputSchema.type, 'object');
    }
  });

  test('4. fonksiyon_bul: tam ad öne alınır, kompakt çıktı ve limit çalışır', () => {
    // Tam ad eşleşmesi
    const msg1 = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'fonksiyon_bul', arguments: { name: 'fnA' } }
    };
    const r1 = isle(msg1, durum);
    const data1 = JSON.parse(r1.result.content[0].text);
    assert.equal(data1.toplam, 1);
    assert.equal(data1.sonuclar[0].name, 'fnA');
    assert.equal(data1.sonuclar[0].file, 'module/a.js');
    assert.equal(data1.sonuclar[0].calls, 1);
    assert.equal(data1.sonuclar[0].calledBy, 1);

    // Limit ve kesilme
    const msg2 = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'fonksiyon_bul', arguments: { ara: 'fn', limit: 2 } }
    };
    const r2 = isle(msg2, durum);
    const data2 = JSON.parse(r2.result.content[0].text);
    assert.equal(data2.toplam, 4);
    assert.equal(data2.sonuclar.length, 2);
    assert.equal(data2.kesildi, true);
    assert.equal(data2.limit, 2);

    // Dosya filtresi
    const msg3 = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'fonksiyon_bul', arguments: { dosya: 'module/b.js' } }
    };
    const r3 = isle(msg3, durum);
    const data3 = JSON.parse(r3.result.content[0].text);
    assert.equal(data3.toplam, 2);
    assert.deepEqual(data3.sonuclar.map(s => s.name).sort(), ['fnB', 'fnC']);
  });

  test('5. fonksiyon_detay: tam kaydı döndürür', () => {
    const msg = {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'fonksiyon_detay', arguments: { name: 'fnA' } }
    };
    const r = isle(msg, durum);
    const data = JSON.parse(r.result.content[0].text);
    assert.equal(data.name, 'fnA');
    assert.equal(data.toplam, 1);
    assert.equal(data.kayitlar[0].domRender, true);
    assert.deepEqual(data.kayitlar[0].domIds, ['btnSave']);
  });

  test('6. cagiranlar (blast radius): derinlik 2 ve ustSeviyeKod bayrağı', () => {
    // fnC çağrı zincirinde: fnC <- fnB <- fnA
    const msg1 = {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'cagiranlar', arguments: { name: 'fnC', derinlik: 2 } }
    };
    const r1 = isle(msg1, durum);
    const d1 = JSON.parse(r1.result.content[0].text);
    assert.equal(d1.fonksiyon, 'fnC');
    assert.equal(d1.derinlik, 2);

    const s1 = d1.cagiranlar.find(c => c.seviye === 1);
    assert.equal(s1?.cagiran, 'fnB');
    assert.equal(s1?.ustSeviyeKod, false);

    const s2 = d1.cagiranlar.find(c => c.seviye === 2);
    assert.equal(s2?.cagiran, 'fnA');
    assert.equal(s2?.ustSeviyeKod, false);

    // fnA çağıran: (datei) module/a.js -> ustSeviyeKod: true
    const msg2 = {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'cagiranlar', arguments: { name: 'fnA', derinlik: 1 } }
    };
    const r2 = isle(msg2, durum);
    const d2 = JSON.parse(r2.result.content[0].text);
    const fileCall = d2.cagiranlar.find(c => c.cagiran.startsWith('(datei)'));
    assert.ok(fileCall);
    assert.equal(fileCall.ustSeviyeKod, true);
  });

  test('7. cagirdiklari: derinlik 2 ile fnA -> fnB -> fnC zinciri', () => {
    const msg = {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: { name: 'cagirdiklari', arguments: { name: 'fnA', derinlik: 2 } }
    };
    const r = isle(msg, durum);
    const d = JSON.parse(r.result.content[0].text);
    assert.equal(d.fonksiyon, 'fnA');

    const s1 = d.cagirdiklari.find(c => c.seviye === 1);
    assert.equal(s1?.cagrilan, 'fnB');

    const s2 = d.cagirdiklari.find(c => c.seviye === 2);
    assert.equal(s2?.cagrilan, 'fnC');
  });

  test('8. tablo_kullanan: NUTZUNG.json yokken zarifçe çalışır', () => {
    const msg = {
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: { name: 'tablo_kullanan', arguments: { tablo: 'abrechnung' } }
    };
    const r = isle(msg, durum);
    const d = JSON.parse(r.result.content[0].text);

    assert.equal(d.tablo, 'abrechnung');
    assert.equal(d.okuyanlarSayisi, 2); // fnA ve fnB
    assert.equal(d.yazanlarSayisi, 1); // fnB
    assert.equal(d.yazanlar[0].name, 'fnB');
    assert.equal(d.yazanlar[0].op, 'insert');
    assert.equal(d.nutzung, null);
  });

  test('9. tablo_kullanan: NUTZUNG.json eklendiğinde mtime ile otomatik yüklenir', () => {
    const sahteNutzung = {
      erzeugt: '2026-11-06',
      anzahl: 1,
      tabellen: [
        {
          name: 'abrechnung',
          spalten: 10,
          status: 'aktiv',
          warum: 'Abrechnung ana tablosu',
          fkRaus: ['businesses'],
          dsgvoAuskunft: true,
          dsgvoLoeschung: false,
          codeStumm: false
        }
      ]
    };

    writeFileSync(join(tmpDir, 'db', 'NUTZUNG.json'), JSON.stringify(sahteNutzung, null, 2), 'utf8');

    const msg = {
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: { name: 'tablo_kullanan', arguments: { tablo: 'abrechnung' } }
    };
    const r = isle(msg, durum);
    const d = JSON.parse(r.result.content[0].text);

    assert.ok(d.nutzung);
    assert.equal(d.nutzung.spalten, 10);
    assert.equal(d.nutzung.status, 'aktiv');
    assert.equal(d.nutzung.warum, 'Abrechnung ana tablosu');
  });

  test('10. dom_hedefi: id eşleşir ve domRender durumu kontrol edilir', () => {
    const msg = {
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: { name: 'dom_hedefi', arguments: { id: 'btnSave' } }
    };
    const r = isle(msg, durum);
    const d = JSON.parse(r.result.content[0].text);

    assert.equal(d.id, 'btnSave');
    assert.equal(d.toplam, 1);
    assert.equal(d.fonksiyonlar[0].name, 'fnA');
    assert.equal(d.fonksiyonlar[0].domRender, true);
  });

  test('11. kopya_adaylari: kopieKandidaten listesini filtreler', () => {
    const msg = {
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: { name: 'kopya_adaylari', arguments: { tablo: 'abrechnung' } }
    };
    const r = isle(msg, durum);
    const d = JSON.parse(r.result.content[0].text);

    assert.equal(d.toplam, 1);
    assert.equal(d.kopyaAdaylari[0].tabelle, 'abrechnung');
  });

  test('12. dosya_fonksiyonlari: belirtilen dosyadaki fonksiyonları satır sırasıyla listeler', () => {
    const msg = {
      jsonrpc: '2.0',
      id: 15,
      method: 'tools/call',
      params: { name: 'dosya_fonksiyonlari', arguments: { dosya: 'module/b.js' } }
    };
    const r = isle(msg, durum);
    const d = JSON.parse(r.result.content[0].text);

    assert.equal(d.toplam, 2);
    assert.equal(d.fonksiyonlar[0].name, 'fnB');
    assert.equal(d.fonksiyonlar[0].start, 10);
    assert.equal(d.fonksiyonlar[1].name, 'fnC');
    assert.equal(d.fonksiyonlar[1].start, 30);
  });

  test('13. harita_durumu: erzeugt ve mtime bilgilerini döner', () => {
    const msg = {
      jsonrpc: '2.0',
      id: 16,
      method: 'tools/call',
      params: { name: 'harita_durumu', arguments: {} }
    };
    const r = isle(msg, durum);
    const d = JSON.parse(r.result.content[0].text);

    assert.equal(d.erzeugt, '2026-11-06');
    assert.equal(d.dateien, 2);
    assert.equal(d.funktionen, 4);
    assert.ok(d.indexMtime);
    assert.ok(d.not.includes('funktionskarte.mjs'));
  });

  test('14. bilinmeyen metot -32601 hatası döner', () => {
    const msg = { jsonrpc: '2.0', id: 17, method: 'olmayan_metot', params: {} };
    const r = isle(msg, durum);
    assert.equal(r.id, 17);
    assert.equal(r.error.code, -32601);
  });

  test('15. bildirimler ve notifications/* sessizce null döner', () => {
    assert.equal(isle({ jsonrpc: '2.0', method: 'notifications/initialized' }, durum), null);
    assert.equal(isle({ jsonrpc: '2.0', method: 'notifications/custom' }, durum), null);
    assert.equal(isle({ jsonrpc: '2.0', method: 'herhangiBirBildirim' }, durum), null);
  });

  test('16. alt-süreç testi: spawn ile initialize ve tools/list sorgulama', async () => {
    const cp = spawn(process.execPath, [sunucuDosyaYolu], {
      env: { ...process.env, FUNKTIONSKARTE_ROOT: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const satirlar = [];
    const rl = createInterface({ input: cp.stdout, terminal: false });

    const ikiSatirPromise = new Promise((resolve, reject) => {
      rl.on('line', (line) => {
        satirlar.push(line);
        if (satirlar.length === 2) resolve(satirlar);
      });
      cp.on('error', reject);
      cp.on('exit', (code) => {
        if (satirlar.length < 2) {
          reject(new Error(`Süreç erken kapandı, çıkış kodu: ${code}`));
        }
      });
    });

    // 1. İstek: initialize
    cp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 101, method: 'initialize', params: {} }) + '\n');
    // 2. İstek: tools/list
    cp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 102, method: 'tools/list' }) + '\n');

    const gelenler = await ikiSatirPromise;
    cp.kill();

    const r1 = JSON.parse(gelenler[0]);
    assert.equal(r1.id, 101);
    assert.equal(r1.result?.serverInfo?.name, 'praxura-funktionskarte');

    const r2 = JSON.parse(gelenler[1]);
    assert.equal(r2.id, 102);
    assert.equal(r2.result?.tools?.length, 9);
  });
});
