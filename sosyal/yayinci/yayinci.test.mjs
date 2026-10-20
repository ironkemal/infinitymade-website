// node --test sosyal/yayinci/  — ohne Netz: Graph API und Telegram werden nachgebildet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MetaClient } from './meta.mjs';
import { tick, schluessel } from './yayinci.mjs';
import { berlin, inTagen } from './tag.mjs';

const dir = await mkdtemp(path.join(tmpdir(), 'yayinci-'));
const png = path.join(dir, 'a.png'), mp4 = path.join(dir, 'a.mp4');
await writeFile(png, 'png'); await writeFile(mp4, 'mp4');

/** Nachgebildete Graph API: antwortet nach Pfad, protokolliert jeden Aufruf. */
function graphAttrappe() {
  const aufrufe = []; let n = 0;
  const fetch = async (url, opt = {}) => {
    const u = new URL(url); const pfad = u.pathname.replace(/^\/v[\d.]+\//, '');
    const params = opt.body instanceof URLSearchParams ? Object.fromEntries(opt.body) : Object.fromEntries(u.searchParams);
    aufrufe.push({ host: u.host, pfad, method: opt.method || 'GET', params, headers: opt.headers });
    const ok = d => ({ ok: true, json: async () => d });
    if (u.host === 'rupload.facebook.com') return ok({ success: true });
    if (pfad.endsWith('/photos')) return ok({ id: `foto${++n}`, post_id: 'page_post1' });
    if (pfad.startsWith('foto')) return ok({ images: [{ width: 100, source: 'https://cdn/klein' }, { width: 1080, source: `https://cdn/${pfad}` }] });
    if (pfad.endsWith('/media')) return ok({ id: `c${++n}`, uri: params.upload_type ? `https://rupload.facebook.com/ig-api-upload/v23.0/c${n}` : undefined });
    if (pfad.endsWith('/media_publish')) return ok({ id: 'ig_post1' });
    if (pfad.endsWith('/feed')) return ok({ id: 'page_feed1' });
    if (pfad.endsWith('/videos')) return ok({ id: 'vid1' });
    if (params.fields?.includes('status_code')) return ok({ status_code: 'FINISHED' });
    if (params.fields === 'permalink') return ok({ permalink: 'https://instagram.com/p/x' });
    return ok({});
  };
  return { aufrufe, client: new MetaClient({ token: 'T', igUserId: 'IG', pageId: 'PG', fetch, warte: async () => {} }) };
}

test('Reel: resumable Container → Datei-Upload → warten → veröffentlichen', async () => {
  const { aufrufe, client } = graphAttrappe();
  const r = await client.igReel(mp4, 'Hallo', 1800);
  assert.equal(r.id, 'ig_post1'); assert.equal(r.link, 'https://instagram.com/p/x');
  const c = aufrufe[0];
  assert.equal(c.pfad, 'IG/media');
  assert.deepEqual([c.params.media_type, c.params.upload_type, c.params.thumb_offset, c.params.share_to_feed], ['REELS', 'resumable', '1800', 'true']);
  const up = aufrufe.find(a => a.host === 'rupload.facebook.com');
  assert.equal(up.headers.Authorization, 'OAuth T'); assert.equal(up.headers.file_size, '3');
  assert.ok(aufrufe.findIndex(a => a.pfad === 'IG/media_publish') > aufrufe.indexOf(up));
});

test('Instagram-Bild: unveröffentlichtes FB-Foto liefert die größte CDN-URL', async () => {
  const { aufrufe, client } = graphAttrappe();
  await client.igBild([png], 'Text');
  assert.equal(aufrufe[0].pfad, 'PG/photos');
  const media = aufrufe.find(a => a.pfad === 'IG/media');
  assert.match(media.params.image_url, /^https:\/\/cdn\/foto/);
  assert.equal(media.params.caption, 'Text');
});

test('Karussell: Kinder mit is_carousel_item, dann CAROUSEL-Container mit allen IDs', async () => {
  const { aufrufe, client } = graphAttrappe();
  await client.igBild([png, png, png], 'Text');
  const kinder = aufrufe.filter(a => a.pfad === 'IG/media' && a.params.is_carousel_item === 'true');
  assert.equal(kinder.length, 3);
  const parent = aufrufe.find(a => a.params.media_type === 'CAROUSEL');
  assert.equal(parent.params.children.split(',').length, 3);
});

test('Facebook: mehrere Bilder als ein Beitrag mit attached_media', async () => {
  const { aufrufe, client } = graphAttrappe();
  const r = await client.fbBild([png, png], 'Text');
  assert.equal(r.id, 'page_feed1');
  const feed = aufrufe.find(a => a.pfad === 'PG/feed');
  assert.equal(JSON.parse(feed.params.attached_media).length, 2);
});

test('Facebook-Video geht an graph-video.facebook.com', async () => {
  const { aufrufe, client } = graphAttrappe();
  await client.fbVideo(mp4, 'Text');
  assert.equal(aufrufe[0].host, 'graph-video.facebook.com');
});

test('Graph-Fehler wird mit Meldung geworfen', async () => {
  const client = new MetaClient({ token: 'T', igUserId: 'IG', pageId: 'PG', warte: async () => {},
    fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid token', code: 190 } }) }) });
  await assert.rejects(client.igBild([png], 'x'), /Invalid token \(code 190\)/);
});

// ---------- tick ----------
const MITTAG = new Date('2026-10-21T10:30:00Z'); // 12:30 Berlin (MESZ)
const cfg = { sendezeit: 735, sendezeitText: '12:15', vorschauzeit: 1140, plattformen: ['instagram', 'facebook'], vorratWarnung: 7 };
const inhalt = (jahr, tag) => ({ jahr, tag, caption: 'Hook\nmehr', hook: 'Hook', fehlt: [], medien: { art: 'bild', dateien: [png] } });
const leer = () => ({ tage: {}, gesperrt: [], pausiert: false, tgOffset: 0, vorschau: {}, gemeldet: {} });
function tg(befehle = []) {
  const gesendet = [];
  return { gesendet, sende: async t => gesendet.push(t), sendeBild: async (_, t) => gesendet.push(t), befehle: async o => ({ offset: o + befehle.length, befehle: befehle.splice(0) }) };
}

test('postet heute auf jede Plattform genau einmal', async () => {
  const z = leer(), telegram = tg(); let posts = 0;
  const plattformen = { instagram: async () => ({ id: `i${++posts}` }), facebook: async () => ({ id: `f${++posts}` }) };
  const ctx = { z, cfg, jetzt: MITTAG, laden: async (j, t) => inhalt(j, t), telegram, plattformen, log: () => {} };
  await tick(ctx); await tick(ctx);
  assert.equal(posts, 2);
  assert.ok(z.tage['2026-10-21'].instagram.id && z.tage['2026-10-21'].facebook.id);
});

test('vor der Sendezeit wird nichts gepostet', async () => {
  const z = leer(); let posts = 0;
  await tick({ z, cfg, jetzt: new Date('2026-10-21T08:00:00Z'), laden: async (j, t) => inhalt(j, t), telegram: tg(),
    plattformen: { instagram: async () => ({ id: ++posts }), facebook: async () => ({ id: ++posts }) }, log: () => {} });
  assert.equal(posts, 0);
});

test('/stopp sperrt den Tag, /pause stoppt alles', async () => {
  for (const befehle of [[{ befehl: 'stopp', arg: '10-21' }], [{ befehl: 'pause' }]]) {
    const z = leer(); let posts = 0;
    await tick({ z, cfg, jetzt: MITTAG, laden: async (j, t) => inhalt(j, t), telegram: tg(befehle),
      plattformen: { instagram: async () => ({ id: ++posts }), facebook: async () => ({ id: ++posts }) }, log: () => {} });
    assert.equal(posts, 0, JSON.stringify(befehle));
  }
});

test('Fehler: bis zu 3 Versuche, Meldung beim ersten und letzten', async () => {
  const z = leer(), telegram = tg(); let versuche = 0;
  const ctx = { z, cfg: { ...cfg, plattformen: ['instagram'] }, jetzt: MITTAG, laden: async (j, t) => inhalt(j, t), telegram,
    plattformen: { instagram: async () => { versuche++; throw new Error('kaputt'); } }, log: () => {} };
  for (let i = 0; i < 5; i++) await tick(ctx);
  assert.equal(versuche, 3);
  assert.equal(telegram.gesendet.filter(t => t.startsWith('❌')).length, 2);
});

test('fehlender Inhalt wird einmal gemeldet, nicht bei jedem Durchlauf', async () => {
  const z = leer(), telegram = tg();
  const ctx = { z, cfg, jetzt: MITTAG, laden: async () => null, telegram, plattformen: {}, log: () => {} };
  await tick(ctx); await tick(ctx);
  assert.equal(telegram.gesendet.filter(t => t.includes('keinen Inhalt')).length, 1);
});

test('abends: Vorschau für morgen + Vorratswarnung', async () => {
  const z = leer(), telegram = tg();
  const abend = new Date('2026-10-21T18:00:00Z'); // 20:00 Berlin
  const laden = async (j, t) => (t <= '10-24' ? inhalt(j, t) : null); // nur 3 Tage Vorrat ab morgen
  await tick({ z, cfg, jetzt: abend, laden, telegram, plattformen: { instagram: async () => ({ id: 1 }), facebook: async () => ({ id: 2 }) }, log: () => {} });
  assert.ok(telegram.gesendet.some(t => t.startsWith('Morgen 12:15 (10-22')));
  assert.ok(telegram.gesendet.some(t => t.includes('Nur noch 3 Tage')));
});

test('Datum: Berlin-Zeit, Jahreswechsel und DST', () => {
  assert.deepEqual(berlin(new Date('2026-12-31T23:30:00Z')), { jahr: '2027', tag: '01-01', minuten: 30 });
  assert.equal(inTagen(1, new Date('2026-10-24T22:30:00Z')).tag, '10-26'); // 25.10. 00:30 MEZ-Wechsel → morgen 26.10.
  assert.equal(schluessel('01-02', new Date('2026-12-20T10:00:00Z')), '2027-01-02');
  assert.equal(schluessel('12-24', new Date('2026-12-20T10:00:00Z')), '2026-12-24');
});
