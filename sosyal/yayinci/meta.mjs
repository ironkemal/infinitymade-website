// Meta Graph API: Instagram (Business) + Facebook-Seite. Nur offizielle Endpunkte, ein Page-Token.
// Instagram verlangt für Bilder eine öffentliche URL: wir laden das Bild unveröffentlicht auf die
// Facebook-Seite und geben deren CDN-URL weiter — so braucht es keinen eigenen Medienserver.
// Reels gehen per "resumable upload" direkt als Datei (rupload.facebook.com).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const schlaf = ms => new Promise(r => setTimeout(r, ms));

export class MetaClient {
  constructor({ token, igUserId, pageId, version = 'v23.0', fetch = globalThis.fetch, warte = schlaf, maxWarten = 60 }) {
    if (!token) throw new Error('META_PAGE_TOKEN fehlt');
    Object.assign(this, { token, igUserId, pageId, version, fetch, warte, maxWarten });
  }

  async graph(pfad, { method = 'GET', params = {}, form, host = 'graph.facebook.com' } = {}) {
    const url = new URL(`https://${host}/${this.version}/${pfad}`);
    let body;
    if (form) {
      body = form; form.set('access_token', this.token);
    } else if (method === 'GET') {
      for (const [k, v] of Object.entries({ ...params, access_token: this.token })) url.searchParams.set(k, v);
    } else {
      body = new URLSearchParams({ ...params, access_token: this.token });
    }
    const res = await this.fetch(url, { method, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const e = data.error || {};
      throw new Error(`Graph ${method} ${pfad}: ${e.message || res.status}${e.code ? ` (code ${e.code})` : ''}`);
    }
    return data;
  }

  async datei(pfad, typ) {
    const buf = await readFile(pfad);
    return { buf, blob: new Blob([buf], { type: typ }), name: path.basename(pfad) };
  }

  // ---------- Facebook ----------
  async fbFotoUnveroeffentlicht(pfad) {
    const { blob, name } = await this.datei(pfad, 'image/png');
    const form = new FormData(); form.set('source', blob, name); form.set('published', 'false');
    const { id } = await this.graph(`${this.pageId}/photos`, { method: 'POST', form });
    const { images } = await this.graph(id, { params: { fields: 'images' } });
    const groesstes = [...images].sort((a, b) => b.width - a.width)[0];
    return { id, url: groesstes.source };
  }

  async fbBild(dateien, text) {
    if (dateien.length === 1) {
      const { blob, name } = await this.datei(dateien[0], 'image/png');
      const form = new FormData(); form.set('source', blob, name); form.set('message', text);
      const r = await this.graph(`${this.pageId}/photos`, { method: 'POST', form });
      return { id: r.post_id || r.id };
    }
    const fotos = [];
    for (const d of dateien) fotos.push((await this.fbFotoUnveroeffentlicht(d)).id);
    const r = await this.graph(`${this.pageId}/feed`, { method: 'POST', params: {
      message: text, attached_media: JSON.stringify(fotos.map(f => ({ media_fbid: f }))),
    } });
    return { id: r.id };
  }

  async fbVideo(datei, text) {
    const { blob, name } = await this.datei(datei, 'video/mp4');
    const form = new FormData(); form.set('source', blob, name); form.set('description', text);
    const r = await this.graph(`${this.pageId}/videos`, { method: 'POST', form, host: 'graph-video.facebook.com' });
    return { id: r.id };
  }

  // ---------- Instagram ----------
  async igWarte(containerId) {
    for (let i = 0; i < this.maxWarten; i++) {
      const { status_code: s, status } = await this.graph(containerId, { params: { fields: 'status_code,status' } });
      if (s === 'FINISHED') return;
      if (s === 'ERROR' || s === 'EXPIRED') throw new Error(`Instagram-Container ${s}: ${status || ''}`);
      await this.warte(5000);
    }
    throw new Error('Instagram-Container nicht rechtzeitig fertig');
  }

  async igVeroeffentliche(containerId, text) {
    if (text.length > 2200) throw new Error('Caption länger als 2200 Zeichen');
    await this.igWarte(containerId);
    const { id } = await this.graph(`${this.igUserId}/media_publish`, { method: 'POST', params: { creation_id: containerId } });
    const { permalink } = await this.graph(id, { params: { fields: 'permalink' } }).catch(() => ({}));
    return { id, link: permalink };
  }

  async igBild(dateien, text) {
    if (dateien.length === 1) {
      const { url } = await this.fbFotoUnveroeffentlicht(dateien[0]);
      const { id } = await this.graph(`${this.igUserId}/media`, { method: 'POST', params: { image_url: url, caption: text } });
      return this.igVeroeffentliche(id, text);
    }
    const kinder = [];
    for (const d of dateien) {
      const { url } = await this.fbFotoUnveroeffentlicht(d);
      const { id } = await this.graph(`${this.igUserId}/media`, { method: 'POST', params: { image_url: url, is_carousel_item: 'true' } });
      await this.igWarte(id);
      kinder.push(id);
    }
    const { id } = await this.graph(`${this.igUserId}/media`, { method: 'POST', params: {
      media_type: 'CAROUSEL', children: kinder.join(','), caption: text,
    } });
    return this.igVeroeffentliche(id, text);
  }

  async igReel(datei, text, coverMs = 1200) {
    const { id, uri } = await this.graph(`${this.igUserId}/media`, { method: 'POST', params: {
      media_type: 'REELS', upload_type: 'resumable', caption: text, share_to_feed: 'true', thumb_offset: String(coverMs),
    } });
    const { buf } = await this.datei(datei, 'video/mp4');
    const ziel = uri || `https://rupload.facebook.com/ig-api-upload/${this.version}/${id}`;
    const res = await this.fetch(ziel, { method: 'POST', body: buf, headers: {
      Authorization: `OAuth ${this.token}`, offset: '0', file_size: String(buf.length),
    } });
    const r = await res.json().catch(() => ({}));
    if (!res.ok || r.success === false) throw new Error(`Reel-Upload fehlgeschlagen: ${r.message || r.debug_info?.message || res.status}`);
    return this.igVeroeffentliche(id, text);
  }
}

/**
 * Kennzahlen eines Instagram-Beitrags (braucht instagram_manage_insights).
 * Meta benennt Metriken gelegentlich um — fällt der volle Satz durch, wird der kleinste gemeinsame versucht.
 * → { reichweite, aufrufe, gespeichert, likes, kommentare, geteilt, wiedergabeMs }
 */
MetaClient.prototype.igKennzahlen = async function (mediaId, istVideo) {
  const saetze = [
    ['reach', 'views', 'saved', 'likes', 'comments', 'shares', ...(istVideo ? ['ig_reels_avg_watch_time'] : [])],
    ['reach', 'saved', 'likes', 'comments'],
  ];
  let letzter;
  for (const metric of saetze) {
    try {
      const { data } = await this.graph(`${mediaId}/insights`, { params: { metric: metric.join(',') } });
      const w = Object.fromEntries(data.map(d => [d.name, d.total_value?.value ?? d.values?.[0]?.value ?? null]));
      return {
        reichweite: w.reach ?? null, aufrufe: w.views ?? null, gespeichert: w.saved ?? null, likes: w.likes ?? null,
        kommentare: w.comments ?? null, geteilt: w.shares ?? null, wiedergabeMs: w.ig_reels_avg_watch_time ?? null,
      };
    } catch (e) { letzter = e; }
  }
  throw letzter;
};

/** Plattform-Funktionen für den Veröffentlicher: (tagesInhalt) → { id, link? } */
export function metaPlattformen(client) {
  return {
    instagram: t => t.medien.art === 'video'
      ? client.igReel(t.medien.datei, t.caption, t.medien.coverMs)
      : client.igBild(t.medien.dateien, t.caption),
    facebook: t => t.medien.art === 'video'
      ? client.fbVideo(t.medien.datei, t.caption)
      : client.fbBild(t.medien.dateien, t.caption),
  };
}
