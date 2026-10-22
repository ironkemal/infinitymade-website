// Telegram: Meldungen an Kemal + Steuerbefehle (/stopp MM-TT, /pause, /weiter, /status, /test, /jetzt).
// Befehle kommen als Text oder als Knopfdruck (callback_query, data = "stopp 10-23").
// Jede andere Nachricht → Hilfe mit Knöpfen. Nur aus der konfigurierten Chat-ID. Eigener Bot, kein Webhook (getUpdates).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BEFEHL = /^\/?(stopp|stop|freigeben|pause|weiter|status|test|jetzt)(?:@\w+)?(?:\s+(\d{2}-\d{2}))?\s*$/i;

/** Menü im Telegram-Client ("/"-Liste) — Beschreibung erscheint neben dem Befehl. */
export const MENUE = [
  { command: 'status', description: 'Heute gepostet? Vorrat, gestoppte Tage' },
  { command: 'test', description: 'Verbindung prüfen, ohne etwas zu posten' },
  { command: 'stopp', description: 'Tag nicht posten — /stopp MM-TT' },
  { command: 'freigeben', description: 'Stopp aufheben — /freigeben MM-TT' },
  { command: 'jetzt', description: 'Heute (oder /jetzt MM-TT) sofort posten' },
  { command: 'pause', description: 'Alles anhalten (Urlaub, Krise)' },
  { command: 'weiter', description: 'Veröffentlichung fortsetzen' },
  { command: 'hilfe', description: 'Alle Befehle mit Erklärung' },
];

/** [[{ text, befehl }]] → inline_keyboard */
const tastatur = knoepfe => (knoepfe?.length ? { inline_keyboard: knoepfe.map(r => r.map(k => ({ text: k.text, callback_data: k.befehl }))) } : undefined);

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

  sende(text, knoepfe) {
    return this.api('sendMessage', { chat_id: this.chatId, text, disable_web_page_preview: true, reply_markup: tastatur(knoepfe) });
  }

  async sendeBild(datei, text, knoepfe) {
    if (!this.aktiv) return null;
    const form = new FormData();
    form.set('chat_id', this.chatId);
    form.set('caption', text.slice(0, 1000));
    if (knoepfe?.length) form.set('reply_markup', JSON.stringify(tastatur(knoepfe)));
    form.set('photo', new Blob([await readFile(datei)]), path.basename(datei));
    return this.api('sendPhoto', form);
  }

  menueSetzen() { return this.api('setMyCommands', { commands: MENUE }); }

  /** Wartet bis zu `sekunden` auf eine neue Nachricht, ohne sie zu bestätigen (offset bleibt). → true, wenn etwas da ist. */
  async warte(offset, sekunden) {
    if (!this.aktiv) { await new Promise(r => setTimeout(r, sekunden * 1000)); return false; }
    const u = await this.api('getUpdates', { offset, timeout: sekunden, limit: 1, allowed_updates: ['message', 'callback_query'] });
    return Boolean(u?.length);
  }

  /** Liest neue Befehle seit `offset`. → { offset, befehle: [{ befehl, arg }] }; Unbekanntes → { befehl: 'hilfe' } */
  async befehle(offset = 0) {
    if (!this.aktiv) return { offset, befehle: [] };
    const updates = await this.api('getUpdates', { offset, timeout: 0, allowed_updates: ['message', 'callback_query'] }) || [];
    const befehle = [];
    for (const u of updates) {
      offset = Math.max(offset, u.update_id + 1);
      const cq = u.callback_query, m = u.message || cq?.message;
      if (cq) await this.api('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {}); // Ladekreisel am Knopf beenden
      if (!m || String(m.chat?.id) !== this.chatId) continue;
      const t = (cq ? cq.data : m.text || '').trim().match(BEFEHL);
      befehle.push(t ? { befehl: t[1].toLowerCase().replace(/^stop$/, 'stopp'), arg: t[2] } : { befehl: 'hilfe' });
    }
    return { offset, befehle };
  }
}
