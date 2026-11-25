// tools/bekci-ajan/telegram.mjs
// Ne: Bekçi-Ajan için Telegram bot arayüzü (BekciTelegram sınıfı).
// Niye: SPEC.md §2.2 ve §2.3 uyarınca interaktif vaka bildirimlerini göndermek
// (sendeVaka, sendeKisa, sendeYanit, onayla) ve getUpdates üzerinden Kemal'in onay/ret/açıklama
// kararlarını güvenli biçimde (chatId ve userId doğrulamasıyla) okumak.

import { Telegram } from '../../sosyal/yayinci/telegram.mjs';
import { ID_RE, mesaj } from './vaka.mjs';

export class BekciTelegram extends Telegram {
  constructor({ token, chatId, userId, fetch = globalThis.fetch }) {
    super({ token, chatId, fetch });
    this.userId = userId != null && userId !== '' ? String(userId) : null;
    if (!this.userId) {
      this.aktiv = false;
    }
  }

  /**
   * Telegram getUpdates ile yeni cevapları okur.
   * Yalnız chatId ve userId eşleşen mesajlar/callback_query'ler işlenir.
   * Kemal 25.11.2026: answerCallbackQuery artık burada çağrılmaz;
   * dönen her cevaba cqId ve mesajId eklenir.
   */
  async cevaplar(offset = 0) {
    if (!this.aktiv) return { offset, cevaplar: [] };

    const updates = await this.api('getUpdates', {
      offset,
      timeout: 0,
      allowed_updates: ['message', 'callback_query'],
    }) || [];

    const cevaplar = [];
    for (const u of updates) {
      offset = Math.max(offset, u.update_id + 1);
      const cq = u.callback_query;
      const m = u.message;

      if (cq) {
        const cChatId = String(cq.message?.chat?.id || '');
        const cFromId = String(cq.from?.id || '');

        if (cChatId !== this.chatId || cFromId !== this.userId) continue;

        const rawData = String(cq.data || '').trim();
        const parts = rawData.split(':');
        if (parts.length === 3 && parts[0] === 'v') {
          const vakaId = parts[1];
          const eylem = parts[2];
          if (['uygula', 'birak', 'acikla'].includes(eylem) && ID_RE.test(vakaId)) {
            cevaplar.push({
              vakaId,
              eylem,
              updateId: u.update_id,
              cqId: cq.id || null,
              mesajId: cq.message?.message_id || null,
            });
          }
        }
      } else if (m) {
        const mChatId = String(m.chat?.id || '');
        const mFromId = String(m.from?.id || '');

        if (mChatId !== this.chatId || mFromId !== this.userId) continue;

        const text = typeof m.text === 'string' ? m.text.trim() : '';
        if (/^\/vakalar(?:@\w+)?$/i.test(text)) {
          cevaplar.push({
            vakaId: null,
            eylem: 'liste',
            updateId: u.update_id,
            cqId: null,
            mesajId: m.message_id || null,
          });
        } else if (text.length > 0) {
          // Metnin kendisi döndürülmez veya loglanmaz (SPEC §3.0 madde 4)
          cevaplar.push({
            vakaId: null,
            eylem: 'metin_desteklenmiyor',
            updateId: u.update_id,
            cqId: null,
            mesajId: m.message_id || null,
          });
        }
      }
    }

    return { offset, cevaplar };
  }

  /**
   * Kemal 25.11.2026: Düğmeye basıldığında sohbete mesaj atmadan
   * Telegram toast/bildirim kutusu ile onay verir. Hata yutulur.
   *
   * @param {string} cqId - Callback query id
   * @param {string} [metin] - Gösterilecek kısa toast metni (≤200 karakter)
   */
  async onayla(cqId, metin) {
    if (!this.aktiv || !cqId) return;
    const body = {
      callback_query_id: cqId,
      show_alert: false,
    };
    if (metin !== undefined && metin !== null) {
      body.text = String(metin).slice(0, 200);
    }
    try {
      await this.api('answerCallbackQuery', body);
    } catch {
      // Hata yutulur
    }
  }

  /**
   * Vaka mesajını düğmelerle birlikte gönderir.
   */
  sendeVaka(vaka) {
    const { text, knoepfe } = mesaj(vaka);
    return this.sende(text, knoepfe);
  }

  /**
   * Düz metin gönderir; 3800 karakterden uzunsa sonu kesilip "…" eklenir.
   * İsteğe bağlı olarak { replyTo: message_id } parametresiyle yanıtlama desteği verir.
   */
  sendeKisa(text, { replyTo } = {}) {
    const raw = String(text ?? '');
    const kesilmis = raw.length > 3800 ? raw.slice(0, 3799) + '…' : raw;
    const body = {
      chat_id: this.chatId,
      text: kesilmis,
      disable_web_page_preview: true,
    };
    if (replyTo != null && Number.isInteger(Number(replyTo))) {
      body.reply_parameters = { message_id: Number(replyTo) };
    }
    return this.api('sendMessage', body);
  }

  /**
   * Belirtilen mesajId'ye yanıt olarak metin gönderir.
   */
  sendeYanit(mesajId, text) {
    return this.sendeKisa(text, { replyTo: mesajId });
  }
}
