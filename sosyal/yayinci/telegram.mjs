// Telegram: Meldungen an Kemal + Steuerbefehle (/stopp MM-TT, /pause, /weiter, /status).
// Befehle werden nur aus der konfigurierten Chat-ID angenommen. Eigener Bot, kein Webhook (getUpdates).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export class Telegram {
  constructor({ token, chatId, fetch = globalThis.fetch }) {
    Object.assign(this, { token, chatId: String(chatId || ''), fetch });
    this.aktiv = Boolean(token && chatId);
  }

  async api(methode, body) {
    if (!this.aktiv) return null;
    const istForm = body instanceof FormData;
    const res = await this.fetch(`https://api.telegram.org/bot${this.token}/${methode}`, {
      method: 'POST', body: istForm ? body : JSON.stringify(body),
      headers: istForm ? undefined : { 'content-type': 'application/json' },
    });
    const d = await res.json().catch(() => ({}));
    if (!d.ok) throw new Error(`Telegram ${methode}: ${d.description || res.status}`);
    return d.result;
  }

  sende(text) { return this.api('sendMessage', { chat_id: this.chatId, text, disable_web_page_preview: true }); }

  async sendeBild(datei, text) {
    if (!this.aktiv) return null;
    const form = new FormData();
    form.set('chat_id', this.chatId);
    form.set('caption', text.slice(0, 1000));
    form.set('photo', new Blob([await readFile(datei)]), path.basename(datei));
    return this.api('sendPhoto', form);
  }

  /** Liest neue Befehle seit `offset`. → { offset, befehle: [{ befehl, arg }] } */
  async befehle(offset = 0) {
    if (!this.aktiv) return { offset, befehle: [] };
    const updates = await this.api('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] }) || [];
    const befehle = [];
    for (const u of updates) {
      offset = Math.max(offset, u.update_id + 1);
      const m = u.message;
      if (!m || String(m.chat?.id) !== this.chatId) continue;
      const t = (m.text || '').trim().match(/^\/(stopp|stop|freigeben|pause|weiter|status)(?:@\w+)?(?:\s+(\d{2}-\d{2}))?/i);
      if (t) befehle.push({ befehl: t[1].toLowerCase().replace(/^stop$/, 'stopp'), arg: t[2] });
    }
    return { offset, befehle };
  }
}
