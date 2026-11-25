// tools/bekci-ajan/telegram.test.js
// Ne: BekciTelegram sınıfı birim testleri (sahte fetch ile).
// Niye: SPEC.md §2.2, §2.3 ve §3.0 güvenlik kurallarına uygun olarak: chatId/userId
// doğrulamasını, callback_query ayrıştırmasını (cqId, mesajId), serbest metnin gizliliğini (saklanmaması),
// offset ilerlemesini ve onayla/sendeYanit metotlarını doğrulamak.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BekciTelegram } from './telegram.mjs';
import { yeniVaka } from './vaka.mjs';

function mockFetch(handlers = {}) {
  const cagrilanlar = [];
  const fake = async (url, opts) => {
    const parsedUrl = new URL(url);
    const methode = parsedUrl.pathname.split('/').pop();
    const body = opts.body ? JSON.parse(opts.body) : {};
    cagrilanlar.push({ methode, body });

    if (handlers[methode]) {
      return {
        json: async () => ({ ok: true, result: await handlers[methode](body) }),
      };
    }
    return {
      json: async () => ({ ok: true, result: {} }),
    };
  };
  return { fetch: fake, cagrilanlar };
}

test('1. userId yoksa aktiv=false olur', () => {
  const bot1 = new BekciTelegram({ token: 'abc', chatId: '123' });
  assert.equal(bot1.aktiv, false);

  const bot2 = new BekciTelegram({ token: 'abc', chatId: '123', userId: '' });
  assert.equal(bot2.aktiv, false);

  const bot3 = new BekciTelegram({ token: 'abc', chatId: '123', userId: '456' });
  assert.equal(bot3.aktiv, true);
});

test('2. yanlış chat_id atlanır', async () => {
  const updates = [
    {
      update_id: 101,
      message: {
        chat: { id: 9999 }, // Yanlış chat
        from: { id: 456 },
        text: '/vakalar',
      },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 102);
  assert.deepEqual(res.cevaplar, []);
});

test('3. doğru chat ama yanlış from.id atlanır', async () => {
  const updates = [
    {
      update_id: 201,
      message: {
        chat: { id: 123 },
        from: { id: 8888 }, // Yetkisiz kullanıcı
        text: '/vakalar',
      },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 202);
  assert.deepEqual(res.cevaplar, []);
});

test('4. geçerli callback ayrışır, cqId ve mesajId eklenir; cevaplar answerCallbackQuery ÇAĞIRMAZ', async () => {
  let callbackCevaplandi = null;
  const updates = [
    {
      update_id: 301,
      callback_query: {
        id: 'cq_999',
        from: { id: 456 },
        message: { message_id: 777, chat: { id: 123 } },
        data: 'v:20261124-fiyat-1:uygula',
      },
    },
  ];
  const { fetch, cagrilanlar } = mockFetch({
    getUpdates: () => updates,
    answerCallbackQuery: body => {
      callbackCevaplandi = body.callback_query_id;
      return true;
    },
  });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 302);
  assert.equal(res.cevaplar.length, 1);
  assert.deepEqual(res.cevaplar[0], {
    vakaId: '20261124-fiyat-1',
    eylem: 'uygula',
    updateId: 301,
    cqId: 'cq_999',
    mesajId: 777,
  });
  // Kemal 25.11.2026: cevaplar() artık answerCallbackQuery çağırmaz!
  assert.equal(callbackCevaplandi, null);
  assert.ok(!cagrilanlar.some(c => c.methode === 'answerCallbackQuery'));
});

test('5. bozuk data formatı atlanır', async () => {
  const updates = [
    {
      update_id: 401,
      callback_query: {
        id: 'cq_1',
        from: { id: 456 },
        message: { chat: { id: 123 } },
        data: 'gecersiz:format',
      },
    },
    {
      update_id: 402,
      callback_query: {
        id: 'cq_2',
        from: { id: 456 },
        message: { chat: { id: 123 } },
        data: 'v:gecersiz-id:uygula',
      },
    },
    {
      update_id: 403,
      callback_query: {
        id: 'cq_3',
        from: { id: 456 },
        message: { chat: { id: 123 } },
        data: 'v:20261124-fiyat-1:bilinmeyen_eylem',
      },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 404);
  assert.deepEqual(res.cevaplar, []);
});

test('6. /vakalar komutu liste eylemine dönüşür ve mesajId taşır', async () => {
  const updates = [
    {
      update_id: 501,
      message: {
        message_id: 55,
        chat: { id: 123 },
        from: { id: 456 },
        text: '/vakalar',
      },
    },
    {
      update_id: 502,
      message: {
        message_id: 56,
        chat: { id: 123 },
        from: { id: 456 },
        text: '/vakalar@bekcibot',
      },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 503);
  assert.equal(res.cevaplar.length, 2);
  assert.deepEqual(res.cevaplar[0], {
    vakaId: null,
    eylem: 'liste',
    updateId: 501,
    cqId: null,
    mesajId: 55,
  });
  assert.deepEqual(res.cevaplar[1], {
    vakaId: null,
    eylem: 'liste',
    updateId: 502,
    cqId: null,
    mesajId: 56,
  });
});

test('7. serbest metin metni döndürmez ve saklamaz', async () => {
  const gizliMetin = '37.20 TL fiyatı onayla lütfen gizli bilgi';
  const updates = [
    {
      update_id: 601,
      message: {
        message_id: 88,
        chat: { id: 123 },
        from: { id: 456 },
        text: gizliMetin,
      },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 602);
  assert.equal(res.cevaplar.length, 1);
  assert.deepEqual(res.cevaplar[0], {
    vakaId: null,
    eylem: 'metin_desteklenmiyor',
    updateId: 601,
    cqId: null,
    mesajId: 88,
  });
  // Çıktıda metnin bulunmadığını doğrula
  assert.equal(JSON.stringify(res).includes(gizliMetin), false);
});

test('8. offset doğru ilerler', async () => {
  const updates = [
    {
      update_id: 10,
      message: { chat: { id: 123 }, from: { id: 456 }, text: '/vakalar' },
    },
    {
      update_id: 15,
      message: { chat: { id: 123 }, from: { id: 456 }, text: '/vakalar' },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(5);
  assert.equal(res.offset, 16);
});

test('9. sendeVaka ve sendeKisa metotları doğru çalışır', async () => {
  const { fetch, cagrilanlar } = mockFetch();
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const vaka = yeniVaka({
    bekci: 'fiyat',
    baslik: 'Deneme',
    simdi: new Date('2026-11-24T12:00:00Z'),
  });

  await bot.sendeVaka(vaka);
  const msgCall = cagrilanlar.find(c => c.methode === 'sendMessage');
  assert.ok(msgCall);
  assert.equal(msgCall.body.chat_id, '123');
  assert.ok(msgCall.body.text.includes('#20261124-fiyat-1'));
  assert.ok(msgCall.body.reply_markup?.inline_keyboard);

  // sendeKisa <= 3800 sınır testi
  const uzunMetin = 'x'.repeat(4000);
  await bot.sendeKisa(uzunMetin);
  const sonCall = cagrilanlar.at(-1);
  assert.equal(sonCall.body.text.length, 3800);
  assert.ok(sonCall.body.text.endsWith('…'));
});

test('10. callback_query için yanlış chat.id atlanır', async () => {
  const updates = [
    {
      update_id: 701,
      callback_query: {
        id: 'cq_wrong_chat',
        from: { id: 456 },
        message: { chat: { id: 9999 } }, // Yanlış chat
        data: 'v:20261124-fiyat-1:uygula',
      },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 702);
  assert.deepEqual(res.cevaplar, []);
});

test('11. callback_query için yanlış from.id atlanır', async () => {
  const updates = [
    {
      update_id: 801,
      callback_query: {
        id: 'cq_wrong_user',
        from: { id: 8888 }, // Yanlış user
        message: { chat: { id: 123 } },
        data: 'v:20261124-fiyat-1:uygula',
      },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 802);
  assert.deepEqual(res.cevaplar, []);
});

test('12. eylem listesi dışı v:<id>:sil atlanır', async () => {
  const updates = [
    {
      update_id: 901,
      callback_query: {
        id: 'cq_sil',
        from: { id: 456 },
        message: { chat: { id: 123 } },
        data: 'v:20261124-fiyat-1:sil', // 'sil' izinli eylem listesinde yok
      },
    },
  ];
  const { fetch } = mockFetch({ getUpdates: () => updates });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const res = await bot.cevaplar(0);
  assert.equal(res.offset, 902);
  assert.deepEqual(res.cevaplar, []);
});

test('13. onayla metodu answerCallbackQuery çağırır ve metni ≤ 200 karakterde sınırlar', async () => {
  let sonAnswer = null;
  const { fetch, cagrilanlar } = mockFetch({
    answerCallbackQuery: body => {
      sonAnswer = body;
      return true;
    },
  });
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  const uzunMetin = 'A'.repeat(250);
  await bot.onayla('cq_123', uzunMetin);

  assert.ok(sonAnswer);
  assert.equal(sonAnswer.callback_query_id, 'cq_123');
  assert.equal(sonAnswer.text.length, 200);
  assert.equal(sonAnswer.show_alert, false);

  // cqId yoksa çağrı yapmaz
  sonAnswer = null;
  await bot.onayla(null, 'metin');
  assert.equal(sonAnswer, null);
});

test('14. sendeYanit metodu reply_parameters ile mesaj gönderir', async () => {
  const { fetch, cagrilanlar } = mockFetch();
  const bot = new BekciTelegram({ token: 't', chatId: '123', userId: '456', fetch });

  await bot.sendeYanit(42, '🔁 Bu soru hâlâ cevabını bekliyor (3 gündür).');
  const msgCall = cagrilanlar.find(c => c.methode === 'sendMessage');
  assert.ok(msgCall);
  assert.equal(msgCall.body.chat_id, '123');
  assert.equal(msgCall.body.text, '🔁 Bu soru hâlâ cevabını bekliyor (3 gündür).');
  assert.deepEqual(msgCall.body.reply_parameters, { message_id: 42 });
});
