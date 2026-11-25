// tools/bekci-ajan/cevap-isle.test.js
// Ne: cevap-isle.mjs birim testleri (en az 12 senaryo).
// Niye: SPEC.md ve Kemal 25.11.2026 talimatı uyarınca: liste ve metin yanıtları,
// toast bildirimleri (sohbete mesaj yok), takılı vakanın sessiz geri açılması,
// hatırlatmalarda 3 gün eşiği, mesajId yanıtı ve 3'ten fazla vakada toplu özet.

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { isle, parseCliArgs } from './cevap-isle.mjs';
import { yeniVaka, kaydet, yukle, gecis, mesajIdYaz } from './vaka.mjs';
import { olaylariYukle } from './rapor.mjs';

function sahteTg(opts = {}) {
  const gonderilenKisa = [];
  const gonderilenSende = [];
  const gonderilenVaka = [];
  const gonderilenYanit = [];
  const onaylananlar = [];
  let kisaHataKalan = opts.kisaHataSayisi || 0;

  return {
    cevaplarListesi: opts.cevaplarListesi || [],
    gonderilenKisa,
    gonderilenSende,
    gonderilenVaka,
    gonderilenYanit,
    onaylananlar,
    async cevaplar(offset = 0) {
      if (opts.cevaplarHata) {
        throw new Error('Telegram getUpdates hatası');
      }
      return {
        offset: typeof opts.yeniOffset === 'number' ? opts.yeniOffset : offset,
        cevaplar: this.cevaplarListesi,
      };
    },
    async onayla(cqId, metin) {
      onaylananlar.push({ cqId, metin });
      return { ok: true };
    },
    async sendeKisa(text, { replyTo } = {}) {
      if (kisaHataKalan > 0) {
        kisaHataKalan--;
        throw new Error('Telegram sendeKisa hatası');
      }
      gonderilenKisa.push({ text, replyTo });
      return { ok: true, message_id: 9001 };
    },
    async sende(text, knoepfe) {
      if (opts.sendeHata) {
        throw new Error('Telegram sende hatası');
      }
      gonderilenSende.push({ text, knoepfe });
      return { ok: true, message_id: 9002 };
    },
    async sendeVaka(vaka) {
      gonderilenVaka.push(vaka);
      return { ok: true, message_id: 9900 };
    },
    async sendeYanit(mesajId, text) {
      gonderilenYanit.push({ mesajId, text });
      return { ok: true, message_id: 9003 };
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

test('1. liste (dolu): açık vakaları "• <baslik> — <n> gün" biçiminde listeler', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const v1Tarih = new Date('2026-11-20T10:00:00Z'); // 5 gün önce
    const v2Tarih = new Date('2026-11-24T10:00:00Z'); // 1 gün önce

    const v1 = yeniVaka({ bekci: 'fiyat', baslik: 'Podologie artış', simdi: v1Tarih, mevcutIdler: [] });
    const v2 = yeniVaka({ bekci: 'fiyat', baslik: 'Physio yeni kod', simdi: v2Tarih, mevcutIdler: [v1.id] });
    const v3 = yeniVaka({ bekci: 'fiyat', baslik: 'Eski kapatılmış', simdi: v1Tarih, mevcutIdler: [v1.id, v2.id] });

    await kaydet(env.vakalarDizini, v1);
    await kaydet(env.vakalarDizini, gecis(v2, 'uygula', { simdi }));
    await kaydet(env.vakalarDizini, gecis(v3, 'birak', { simdi }));

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: null, eylem: 'liste', updateId: 10, cqId: null }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.equal(res.dispatch.length, 0);
    assert.equal(tg.gonderilenKisa.length, 1);
    const beklenen = '• Podologie artış — 5 gün\n• Physio yeni kod — 1 gün';
    assert.equal(tg.gonderilenKisa[0].text, beklenen);
  } finally {
    await env.temizle();
  }
});

test('2. liste (boş): hiç açık vaka yoksa "Şu an senden beklediğim bir karar yok ✅" döner', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: null, eylem: 'liste', updateId: 11, cqId: null }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.equal(tg.gonderilenKisa.length, 1);
    assert.equal(tg.gonderilenKisa[0].text, 'Şu an senden beklediğim bir karar yok ✅');
  } finally {
    await env.temizle();
  }
});

test('3. metin: desteklenmeyen metin cevabında yönlendirme mesajı gönderir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: null, eylem: 'metin_desteklenmiyor', updateId: 12, cqId: null }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
    });

    assert.equal(res.islenen, 1);
    assert.equal(tg.gonderilenKisa.length, 1);
    assert.equal(
      tg.gonderilenKisa[0].text,
      'Şimdilik yalnız mesajlardaki düğmeler çalışıyor. Bekleyen kararlar için: /vakalar'
    );
  } finally {
    await env.temizle();
  }
});

test('4. bulunamayan id: cqId varsa tg.onayla çağrılır, sohbete mesaj gitmez', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: '20261124-fiyat-99', eylem: 'uygula', updateId: 13, cqId: 'cq_404' }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
    });

    assert.equal(res.islenen, 1);
    assert.equal(res.dispatch.length, 0);
    // Sohbete mesaj gitmez!
    assert.equal(tg.gonderilenKisa.length, 0);
    // onayla toast çağrılır
    assert.equal(tg.onaylananlar.length, 1);
    assert.equal(tg.onaylananlar[0].cqId, 'cq_404');
    assert.equal(tg.onaylananlar[0].metin, 'Bu soruyu bulamadım.');
  } finally {
    await env.temizle();
  }
});

test('5. birak: cqId ile sohbete mesaj gitmez, toast onayı verilir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Bırakılacak vaka', simdi });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: v.id, eylem: 'birak', updateId: 14, cqId: 'cq_birak_1' }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.equal(res.dispatch.length, 0);
    // Sohbete mesaj gitmedi
    assert.equal(tg.gonderilenKisa.length, 0);
    // Toast onayı
    assert.equal(tg.onaylananlar.length, 1);
    assert.equal(tg.onaylananlar[0].cqId, 'cq_birak_1');
    assert.equal(tg.onaylananlar[0].metin, '❌ Tamam, bırakıldı.');

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.durum, 'birakildi');
  } finally {
    await env.temizle();
  }
});

test('6. acikla: cqId ile sohbete mesaj gitmez, dispatch listesine eklenir ve toast onayı verilir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Açıklama istenecek', simdi });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: v.id, eylem: 'acikla', updateId: 15, cqId: 'cq_acikla_1' }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.deepEqual(res.dispatch, [{ vakaId: v.id, eylem: 'acikla' }]);
    // Sohbete mesaj yok
    assert.equal(tg.gonderilenKisa.length, 0);
    // Toast onayı
    assert.equal(tg.onaylananlar.length, 1);
    assert.equal(tg.onaylananlar[0].metin, '💬 Açıklama hazırlanıyor, birkaç dakika içinde gelecek.');

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.durum, 'acik');
  } finally {
    await env.temizle();
  }
});

test('7. uygula: cqId ile toast onayı verilir ("bitince haftalık raporda görürsün"), dispatch edilir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Uygulanacak', yamaSha256: sha, simdi });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: v.id, eylem: 'uygula', updateId: 16, cqId: 'cq_uygula_1' }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.deepEqual(res.dispatch, [{ vakaId: v.id, eylem: 'uygula' }]);
    // Sohbete mesaj yok
    assert.equal(tg.gonderilenKisa.length, 0);
    // Toast onayı
    assert.equal(tg.onaylananlar.length, 1);
    assert.equal(
      tg.onaylananlar[0].metin,
      '✅ Alındı — uyguluyorum, bitince haftalık raporda görürsün.'
    );

    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.durum, 'uygulaniyor');
  } finally {
    await env.temizle();
  }
});

test('8. kapalı vakaya basış: cqId varsa toast onayı "Bu soru zaten kapanmış." verilir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const v = yeniVaka({ bekci: 'fiyat', baslik: 'Zaten uygulanmış', simdi });
    const kapali = gecis(gecis(v, 'uygula', { simdi }), 'tamam', { simdi });
    await kaydet(env.vakalarDizini, kapali);

    const tg = sahteTg({
      cevaplarListesi: [{ vakaId: v.id, eylem: 'uygula', updateId: 17, cqId: 'cq_kapali_1' }],
    });

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      simdi,
    });

    assert.equal(res.islenen, 1);
    assert.equal(res.dispatch.length, 0);
    assert.equal(tg.gonderilenKisa.length, 0);
    assert.equal(tg.onaylananlar.length, 1);
    assert.equal(tg.onaylananlar[0].metin, 'Bu soru zaten kapanmış.');
  } finally {
    await env.temizle();
  }
});

test('9. hatırlatma (3 gün eşiği): 1 veya 2 günlük vakaya hatırlatma gönderilmez, 3+ günde gönderilir', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const ikiGunOnce = new Date('2026-11-23T10:00:00Z'); // 2 gün
    const ucGunOnce = new Date('2026-11-22T10:00:00Z'); // 3 gün

    const v2 = yeniVaka({ bekci: 'fiyat', baslik: '2 günlük vaka', simdi: ikiGunOnce, mevcutIdler: [] });
    const v3 = yeniVaka({ bekci: 'fiyat', baslik: '3 günlük vaka', simdi: ucGunOnce, mevcutIdler: [v2.id] });

    await kaydet(env.vakalarDizini, v2);
    await kaydet(env.vakalarDizini, v3);

    const tg = sahteTg();

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      hatirlat: true,
      simdi,
    });

    // Yalnızca 3 günlük vaka hatırlatılmalı
    assert.equal(res.hatirlatilan, 1);
    const guncel3 = await yukle(env.vakalarDizini, v3.id);
    assert.equal(guncel3.hatirlatma, 1);

    const guncel2 = await yukle(env.vakalarDizini, v2.id);
    assert.equal(guncel2.hatirlatma, 0);
  } finally {
    await env.temizle();
  }
});

test('10. hatırlatma (mesajId yanıtı ve mesajId yoksa tam mesaj): mesajId varsa yanıt, yoksa tam mesaj ve id kaydı', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const dortGunOnce = new Date('2026-11-21T10:00:00Z');

    // 1. mesajId'li vaka
    let vWithMsg = yeniVaka({
      bekci: 'preise',
      baslik: 'MesajId olan vaka',
      simdi: dortGunOnce,
      mesajId: 444,
      mevcutIdler: [],
    });
    await kaydet(env.vakalarDizini, vWithMsg);

    // 2. mesajId'siz vaka
    let vNoMsg = yeniVaka({
      bekci: 'preise',
      baslik: 'MesajId olmayan vaka',
      simdi: dortGunOnce,
      mevcutIdler: [vWithMsg.id],
    });
    await kaydet(env.vakalarDizini, vNoMsg);

    const tg = sahteTg();

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      hatirlat: true,
      simdi,
    });

    assert.equal(res.hatirlatilan, 2);

    // mesajId olan vaka için sendeYanit çağrıldı
    assert.equal(tg.gonderilenYanit.length, 1);
    assert.equal(tg.gonderilenYanit[0].mesajId, 444);
    assert.equal(
      tg.gonderilenYanit[0].text,
      '🔁 Bu soru hâlâ cevabını bekliyor (4 gündür).'
    );

    // mesajId olmayan vaka için sendeVaka çağrıldı ve dönen message_id vakaya yazıldı
    assert.equal(tg.gonderilenVaka.length, 1);
    assert.equal(tg.gonderilenVaka[0].id, vNoMsg.id);

    const guncelNoMsg = await yukle(env.vakalarDizini, vNoMsg.id);
    assert.equal(guncelNoMsg.mesajId, 9900); // sahteTg'nin döndürdüğü id
  } finally {
    await env.temizle();
  }
});

test('11. hatırlatma (>3 vaka): 3\'ten fazla vaka hatırlatılacaksa tek özet mesaj atılır, asıl mesaja yanıt yok', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T10:00:00Z');
    const besGunOnce = new Date('2026-11-20T10:00:00Z');

    // 4 adet vaka oluştur
    const mevcutIdler = [];
    for (let i = 1; i <= 4; i++) {
      const v = yeniVaka({
        bekci: 'preise',
        baslik: `Vaka ${i}`,
        simdi: besGunOnce,
        mesajId: 100 + i,
        mevcutIdler,
      });
      mevcutIdler.push(v.id);
      await kaydet(env.vakalarDizini, v);
    }

    const tg = sahteTg();

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      hatirlat: true,
      simdi,
    });

    assert.equal(res.hatirlatilan, 4);

    // Bireysel yanıtlama veya sendeVaka YAPILMADI
    assert.equal(tg.gonderilenYanit.length, 0);
    assert.equal(tg.gonderilenVaka.length, 0);

    // Tek özet mesajı gönderildi
    assert.equal(tg.gonderilenKisa.length, 1);
    assert.equal(tg.gonderilenKisa[0].text, '🔁 4 soru cevabını bekliyor: /vakalar');
  } finally {
    await env.temizle();
  }
});

test('12. takılı uygulaniyor: 2 saatten eskiyse acik durumuna döner, Kemal\'e mesaj gitmez, rapor olayına yazılır', async () => {
  const env = await geciciOrtamOlustur();
  try {
    const simdi = new Date('2026-11-25T12:00:00Z');
    const ucSaatOnce = new Date('2026-11-25T09:00:00Z');

    let v = yeniVaka({
      bekci: 'preise',
      baslik: 'Takılı fiyat vakası',
      simdi: ucSaatOnce,
    });
    v = gecis(v, 'uygula', { simdi: ucSaatOnce });
    await kaydet(env.vakalarDizini, v);

    const tg = sahteTg();

    const res = await isle({
      tg,
      dizin: env.vakalarDizini,
      kok: env.tempDir,
      offsetDosya: env.offsetDosya,
      dispatchDosya: env.dispatchDosya,
      hatirlat: false,
      simdi,
    });

    // Kemal'e sohbete mesaj gitmedi!
    assert.equal(tg.gonderilenKisa.length, 0);
    assert.equal(tg.gonderilenYanit.length, 0);

    // Vaka 'acik' durumuna döndü
    const guncel = await yukle(env.vakalarDizini, v.id);
    assert.equal(guncel.durum, 'acik');

    // Rapor olay defterine 'takili' olayı yazıldı
    const olaylar = await olaylariYukle(env.tempDir);
    assert.equal(olaylar.length, 1);
    assert.equal(olaylar[0].tur, 'takili');
    assert.ok(olaylar[0].ozet.includes(v.id));
  } finally {
    await env.temizle();
  }
});
