// tools/bekci-ajan/cevap-isle.test.js
// Ne: cevap-isle.mjs birim testleri (en az 10 senaryo).
// Niye: SPEC.md §2.2, §3.0 ve .github/workflows/bekci-cevap.yml uyarınca; liste, metin,
// vaka eylemleri (birak, acikla, uygula), kapalı vaka ve çift basış kontrolleri,
// hatırlatma döngüleri, offset/dispatch dosya yazımları ve hata dayanıklılığını doğrulamak.

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { isle, parseCliArgs } from './cevap-isle.mjs';
import { yeniVaka, kaydet, yukle, gecis } from './vaka.mjs';

function sahteTg(opts = {}) {
  const gonderilenKisa = [];
  const gonderilenSende = [];
  const gonderilenVaka = [];
  let kisaHataKalan = opts.kisaHataSayisi || 0;

  return {
    cevaplarListesi: opts.cevaplarListesi || [],
    gonderilenKisa,
    gonderilenSende,
    gonderilenVaka,
    async cevaplar(offset = 0) {
      if (opts.cevaplarHata) {
        throw new Error('Telegram getUpdates hatası');
      }
      return {
        offset: typeof opts.yeniOffset === 'number' ? opts.yeniOffset : offset,
        cevaplar: this.cevaplarListesi,
      };
    },
    async sendeKisa(text) {
      if (kisaHataKalan > 0) {
        kisaHataKalan--;
        throw new Error('Telegram sendeKisa hatası');
      }
      gonderilenKisa.push(text);
      return { ok: true };
    },
    async sende(text, knoepfe) {
      if (opts.sendeHata) {
        throw new Error('Telegram sende hatası');
      }
      gonderilenSende.push({ text, knoepfe });
      return { ok: true };
    },
    async sendeVaka(vaka) {
      gonderilenVaka.push(vaka);
      return { ok: true };
    },
  };
}

async function geciciOrtamOlustur() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'bekci-test-'));
  const vakalarDizini = path.join(tempDir, 'vakalar');
  const offsetDosya = path.join(tempDir, 'offset.json');
  const dispatchDosya = path.join(tempDir, 'dispatch.txt');
  return {
    tempDir,
    vakalarDizini,
    offsetDosya,
    dispatchDosya,
    temizle: () => rm(tempDir, { recursive: true, force: true }),
  };
}

test('1. liste (dolu): açık ve uygulanıyor vakaları listeler, kapatılanları göstermez', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const v1 = yeniVaka({ bekci: 'fiyat', baslik: 'Podologie artış', simdi, mevcutIdler: [] });
    const v2 = yeniVaka({ bekci: 'fiyat', baslik: 'Physio yeni kod', simdi, mevcutIdler: [v1.id] });
    const v3 = yeniVaka({ bekci: 'fiyat', baslik: 'Eski kapatılmış', simdi, mevcutIdler: [v1.id, v2.id] });

    await kaydet(env.vakalarDizini, v1);
    await kaydet(env.vakalarDizini, gecis(v2, 'uygula', { simdi }));
    await kaydet(env.vakalarDizini, gecis(v3, 'birak', { simdi }));

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: null, eylem: 'liste', updateId: 10 }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.equal(res.dispatch.length, 0);
    assert.equal(tg.gonderilenKisa.length, 1);
    const beklenen = `#${v1.id} · Podologie artış\n#${v2.id} · Physio yeni kod`;
    assert.equal(tg.gonderilenKisa[0], beklenen);
  } finally {
    await env.temizle();
  }
});

test('2. liste (boş): hiç açık vaka yoksa "Açık vaka yok ✅" döner', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: null, eylem: 'liste', updateId: 11 }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.equal(tg.gonderilenKisa.length, 1);
    assert.equal(tg.gonderilenKisa[0], 'Açık vaka yok ✅');
  } finally {
    await env.temizle();
  }
});

test('3. metin: desteklenmeyen metin cevabında bilgilendirme mesajı gönderir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: null, eylem: 'metin_desteklenmiyor', updateId: 12 }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
    });

    assert.equal(res.islenen, 1);
    assert.equal(tg.gonderilenKisa.length, 1);
    assert.equal(
      tg.gonderilenKisa[0],
      'Şimdilik yalnız düğmeler çalışıyor (✅ Uygula · ❌ Bırak · 💬 Açıkla). Açık vakalar: /vakalar'
    );
  } finally {
    await env.temizle();
  }
});

test('4. bulunamayan id: vaka mevcut değilse "#id bulunamadı" yazar', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: '20261124-fiyat-99', eylem: 'uygula', updateId: 13 }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
    });

    assert.equal(res.islenen, 1);
    assert.equal(res.dispatch.length, 0);
    assert.equal(tg.gonderilenKisa.length, 1);
    assert.equal(tg.gonderilenKisa[0], '#20261124-fiyat-99 bulunamadı');
  } finally {
    await env.temizle();
  }
});

test('5. birak: vaka durumunu "birakildi" yapar, onay mesajı atar, dispatch etmez', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Bırakılacak vaka', simdi });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: v.id, eylem: 'birak', updateId: 14 }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.equal(res.dispatch.length, 0);
    assert.equal(tg.gonderilenKisa[0], `❌ #${v.id} bırakıldı.`);

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.durum, 'birakildi');
  } finally {
    await env.temizle();
  }
});

test('6. acikla → dispatch: vaka açık kalır, dispatch listesine eklenir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Açıklama istenecek', simdi });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: v.id, eylem: 'acikla', updateId: 15 }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.deepEqual(res.dispatch, [{ vakaId: v.id, eylem: 'acikla' }]);
    assert.equal(tg.gonderilenKisa[0], `💬 #${v.id} için açıklama hazırlanıyor…`);

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.durum, 'acik');
    assert.equal(guncel.gecmis.at(-1)?.eylem, 'acikla');
  } finally {
    await env.temizle();
  }
});

test('7. uygula → dispatch + durum uygulaniyor: vaka uygulaniyor olur ve dispatch edilir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Uygulanacak', yamaSha256: sha, simdi });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: v.id, eylem: 'uygula', updateId: 16 }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.deepEqual(res.dispatch, [{ vakaId: v.id, eylem: 'uygula' }]);
    assert.equal(tg.gonderilenKisa[0], `✅ #${v.id} uygulanıyor, bitince haber veririm.`);

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.durum, 'uygulaniyor');
  } finally {
    await env.temizle();
  }
});

test('8. kapalı vakaya basış: vaka zaten kapalıysa VakaHatasi yakalanır ve kullanıcı bilgilendirilir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Zaten uygulanmış', simdi });
    const kapali = gecis(gecis(v, 'uygula', { simdi }), 'tamam', { simdi });
    assert.equal(kapali.durum, 'uygulandi');
    await kaydet(env.vakalarDizini, kapali);

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: v.id, eylem: 'uygula', updateId: 17 }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.equal(res.dispatch.length, 0);
    assert.equal(tg.gonderilenKisa[0], `#${v.id} zaten kapalı (durum: uygulandi).`);
  } finally {
    await env.temizle();
  }
});

test('9. çift basış: aynı turda ilk basış işlenir, ikinci basış VakaHatasi yoluna düşer', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Çift basış testi', simdi });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg({
      cevaplarListesi: [
        { vakaId: v.id, eylem: 'uygula', updateId: 18 },
        { vakaId: v.id, eylem: 'uygula', updateId: 19 },
      ],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 2);
    assert.equal(res.dispatch.length, 1);
    assert.equal(tg.gonderilenKisa.length, 2);
    assert.equal(tg.gonderilenKisa[0], `✅ #${v.id} uygulanıyor, bitince haber veririm.`);
    assert.equal(tg.gonderilenKisa[1], `#${v.id} zaten kapalı (durum: uygulaniyor).`);

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.durum, 'uygulaniyor');
  } finally {
    await env.temizle();
  }
});

test('10. hatırlatma (gerekli): dünün açık vakası hatırlatılır ve hatirlatma sayısı artar', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const dun = new Date('2026-11-23T10:00:00Z');
    const bugun = new Date('2026-11-24T10:00:00Z');

    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Dünden kalan vaka', simdi: dun });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg();

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      hatirlat: true,
      simdi: bugun,
    });

    assert.equal(res.hatirlatilan, 1);
    assert.equal(tg.gonderilenSende.length, 1);
    assert.ok(tg.gonderilenSende[0].text.startsWith('🔁 Hatırlatma 1 · '));

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.hatirlatma, 1);
    assert.equal(guncel.sonHatirlatma, bugun.toISOString());
  } finally {
    await env.temizle();
  }
});

test('11. hatırlatma (gereksiz): bugün açılan vakaya hatırlatma gönderilmez', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const bugun = new Date('2026-11-24T10:00:00Z');
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Bugün açılan vaka', simdi: bugun });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg();

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      hatirlat: true,
      simdi: bugun,
    });

    assert.equal(res.hatirlatilan, 0);
    assert.equal(tg.gonderilenSende.length, 0);
  } finally {
    await env.temizle();
  }
});

test('12. hatırlatma (eskidi öneki): 14 günden eski vakaya ⏳ öneki eklenir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const eskiTarih = new Date('2026-11-01T10:00:00Z');
    const bugun = new Date('2026-11-24T10:00:00Z');

    let v = yeniVaka({ bekci: 'fiyat', baslik: 'Çok eski vaka', simdi: eskiTarih });
    v = gecis(v, 'hatirlat', { simdi: new Date('2026-11-10T10:00:00Z') });
    v = gecis(v, 'hatirlat', { simdi: new Date('2026-11-15T10:00:00Z') });
    assert.equal(v.hatirlatma, 2);
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg();

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      hatirlat: true,
      simdi: bugun,
    });

    assert.equal(res.hatirlatilan, 1);
    assert.equal(tg.gonderilenSende.length, 1);
    assert.ok(
      tg.gonderilenSende[0].text.startsWith('⏳ 14+ gündür açık · 🔁 Hatırlatma 3 · ')
    );

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.hatirlatma, 3);
  } finally {
    await env.temizle();
  }
});

test('13. offset yazılıyor: offset dosyası yeni offset değeriyle güncellenir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    await writeFile(env.offsetDosya, JSON.stringify({ offset: 100 }), 'utf-8');

    const tg = sahteTg({
      yeniOffset: 155,
      cevaplarListesi: [{ vakaId: null, eylem: 'liste', updateId: 154 }],
    });

    await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
    });

    const icerik = await readFile(env.offsetDosya, 'utf-8');
    const parsed = JSON.parse(icerik);
    assert.equal(parsed.offset, 155);
  } finally {
    await env.temizle();
  }
});

test('14. dispatch dosyası biçimi: satır başına "<vakaId> <eylem>" yazar, boşsa boş dosya üretir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const v1 = yeniVaka({ bekci: 'fiyat', baslik: 'Vaka 1', simdi });
    const v2 = yeniVaka({ bekci: 'fiyat', baslik: 'Vaka 2', simdi, mevcutIdler: [v1.id] });
    await kaydet(env.vakalarDizini, v1);
    await kaydet(env.vakalarDizini, v2);

    const tg = sahteTg({
      cevaplarListesi: [
        { vakaId: v1.id, eylem: 'uygula', updateId: 20 },
        { vakaId: v2.id, eylem: 'acikla', updateId: 21 },
      ],
    });

    await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    const dispatchIcerik = await readFile(env.dispatchDosya, 'utf-8');
    assert.equal(dispatchIcerik, `${v1.id} uygula\n${v2.id} acikla\n`);

    // Boş dispatch durumu testi
    const tgBos = sahteTg({
      cevaplarListesi: [{ vakaId: null, eylem: 'liste', updateId: 22 }],
    });

    await isle({
      tg: tgBos,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    const bosDispatch = await readFile(env.dispatchDosya, 'utf-8');
    assert.equal(bosDispatch, '');
  } finally {
    await env.temizle();
  }
});

test('15. gönderme hatası diğerlerini düşürmüyor: hata yakalanır, sonraki cevaplar işlenir ve dosyalar yazılır', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-24T10:00:00Z');
    const v1 = yeniVaka({ bekci: 'fiyat', baslik: 'Vaka 1', simdi });
    const v2 = yeniVaka({ bekci: 'fiyat', baslik: 'Vaka 2', simdi, mevcutIdler: [v1.id] });
    await kaydet(env.vakalarDizini, v1);
    await kaydet(env.vakalarDizini, v2);

    // İlk sendeKisa çağrısında hata fırlat, sonrakinde başarılı ol
    const tg = sahteTg({
      kisaHataSayisi: 1,
      yeniOffset: 88,
      cevaplarListesi: [
        { vakaId: v1.id, eylem: 'birak', updateId: 30 },
        { vakaId: v2.id, eylem: 'birak', updateId: 31 },
      ],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 2);
    assert.equal(res.hataSayisi, 1);

    // Her iki vaka da diske kaydedilmiş olmalıdır
    const guncel1 = await yukle(env.vakalarDizini, v1.id);
    const guncel2 = await yukle(env.vakalarDizini, v2.id);
    assert.equal(guncel1.durum, 'birakildi');
    assert.equal(guncel2.durum, 'birakildi');

    // Offset dosyası yine de güncellenmelidir
    const offsetIcerik = await readFile(env.offsetDosya, 'utf-8');
    assert.equal(JSON.parse(offsetIcerik).offset, 88);
  } finally {
    await env.temizle();
  }
});

test('16. import edildiğinde CLI çalışmıyor & parseCliArgs argümanları doğru ayrıştırır', () => {
  // Test dosyasında import yapılmış olmasına rağmen CLI'ın çalışmadığı (process.exit çağrılmadığı) kanıtlandı.
  // parseCliArgs doğrulaması:
  const args1 = parseCliArgs([
    '--vakalar=vakalar/yol',
    '--offset=offset.json',
    '--dispatch=dispatch.txt',
    '--hatirlat',
  ]);
  assert.equal(args1.dizin, 'vakalar/yol');
  assert.equal(args1.offsetDosya, 'offset.json');
  assert.equal(args1.dispatchDosya, 'dispatch.txt');
  assert.equal(args1.hatirlat, true);

  const args2 = parseCliArgs([
    '--vakalar',
    'dizin2',
    '--offset',
    'off2.json',
    '--dispatch',
    'disp2.txt',
  ]);
  assert.equal(args2.dizin, 'dizin2');
  assert.equal(args2.offsetDosya, 'off2.json');
  assert.equal(args2.dispatchDosya, 'disp2.txt');
  assert.equal(args2.hatirlat, false);
});
