// tools/bekci-ajan/telegram.mjs
// Ne: Bekçi-Ajan için Telegram bot arayüzü (BekciTelegram sınıfı).
// Niye: SPEC.md §2.2 ve §2.3 uyarınca interaktif vaka bildirimlerini göndermek
// (sendeVaka, sendeKisa) ve getUpdates üzerinden Kemal'in onay/ret/açıklama
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

        // Düğmedeki yükleme çarkını hemen durdur
        await this.api('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});

        const rawData = String(cq.data || '').trim();
        const parts = rawData.split(':');
        if (parts.length === 3 && parts[0] === 'v') {
          const vakaId = parts[1];
          const eylem = parts[2];
          if (['uygula', 'birak', 'acikla'].includes(eylem) && ID_RE.test(vakaId)) {
            cevaplar.push({ vakaId, eylem, updateId: u.update_id });
          }
        }
      } else if (m) {
        const mChatId = String(m.chat?.id || '');
        const mFromId = String(m.from?.id || '');

        if (mChatId !== this.chatId || mFromId !== this.userId) continue;

        const text = typeof m.text === 'string' ? m.text.trim() : '';
        if (/^\/vakalar(?:@\w+)?$/i.test(text)) {
          cevaplar.push({ vakaId: null, eylem: 'liste', updateId: u.update_id });
        } else if (text.length > 0) {
          // Metnin kendisi döndürülmez veya loglanmaz (SPEC §3.0 madde 4)
          cevaplar.push({ vakaId: null, eylem: 'metin_desteklenmiyor', updateId: u.update_id });
        }
      }
    }

    return { offset, cevaplar };
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
   */
  sendeKisa(text) {
    const raw = String(text ?? '');
    const kesilmis = raw.length > 3800 ? raw.slice(0, 3799) + '…' : raw;
    return this.sende(kesilmis);
  }
}
