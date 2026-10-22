// node --test sosyal/yayinci/  — ohne Netz: Graph API und Telegram werden nachgebildet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MetaClient } from './meta.mjs';
import { tick, schluessel, letzterSchluessel, HILFE } from './yayinci.mjs';
import { Telegram } from './telegram.mjs';
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
  const gesendet = [], knoepfe = [];
  const merke = (t, k) => { gesendet.push(t); knoepfe.push(k); };
  return { gesendet, knoepfe, sende: async (t, k) => merke(t, k),sendeBild: async (_, t, k) => merke(t, k), befehle: async o => ({ offset: o + befehle.length, befehle: befehle.splice(0) }) };
}

test('Telegram: Text, Knopfdruck und Unbekanntes werden zu Befehlen; nur eigener Chat', async () => {
  const aufrufe = [];
  const updates = [
    { update_id: 1, message: { chat: { id: 42 }, text: '/stopp 10-23' } },
    { update_id: 2, callback_query: { id: 'cb', data: 'freigeben 10-23', message: { chat: { id: 42 } } } },
    { update_id: 3, message: { chat: { id: 42 }, text: 'was kann der bot?' } },
    { update_id: 4, message: { chat: { id: 99 }, text: '/pause' } },
  ];
  const fetch = async (url, opt) => {
    aufrufe.push({ methode: url.split('/').pop(), body: JSON.parse(opt.body) });
    return { json: async () => ({ ok: true, result: url.endsWith('getUpdates') ? updates : true }) };
  };
  const r = await new Telegram({ token: 'T', chatId: 42, fetch }).befehle(0);
  assert.equal(r.offset, 5);
  assert.deepEqual(r.befehle, [{ befehl: 'stopp', arg: '10-23' }, { befehl: 'freigeben', arg: '10-23' }, { befehl: 'hilfe' }]);
  assert.ok(aufrufe.some(a => a.methode === 'answerCallbackQuery' && a.body.callback_query_id === 'cb'));
});

test('Hilfe mit Knöpfen; Vorschau hat „Nicht posten"-Knopf; /stopp ohne Datum fragt mit Knöpfen', async () => {
  const telegram = tg([{ befehl: 'hilfe' }, { befehl: 'stopp' }]);
  await tick({ z: leer(), cfg, jetzt: new Date('2026-10-21T18:00:00Z'), laden: async (j, t) => inhalt(j, t), telegram,
    plattformen: { instagram: async () => ({ id: 1 }), facebook: async () => ({ id: 2 }) }, log: () => {} });
  assert.equal(telegram.gesendet[0], HILFE);
  assert.ok(telegram.knoepfe[0].flat().some(k => k.befehl === 'status'));
  assert.deepEqual(telegram.knoepfe[1][0].map(k => k.befehl), ['stopp 10-21', 'stopp 10-22']);
  const vorschau = telegram.gesendet.findIndex(t => t.startsWith('Morgen'));
  assert.equal(telegram.knoepfe[vorschau][0][0].befehl, 'stopp 10-22');
});

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

test('START_AB: Tage davor werden nicht automatisch gepostet', async () => {
  const z = leer(); let posts = 0;
  const plattformen = { instagram: async () => ({ id: ++posts }), facebook: async () => ({ id: ++posts }) };
  await tick({ z, cfg: { ...cfg, startAb: '2026-10-22' }, jetzt: MITTAG, laden: async (j, t) => inhalt(j, t), telegram: tg(), plattformen, log: () => {} });
  assert.equal(posts, 0);
  await tick({ z, cfg: { ...cfg, startAb: '2026-10-21' }, jetzt: MITTAG, laden: async (j, t) => inhalt(j, t), telegram: tg(), plattformen, log: () => {} });
  assert.equal(posts, 2);
});

test('/jetzt holt einen aufgegebenen und gesperrten Tag sofort nach, auch vor der Sendezeit', async () => {
  const z = leer(), telegram = tg([{ befehl: 'jetzt', arg: '10-20' }]); let posts = 0;
  z.gesperrt.push('2026-10-20');
  z.tage['2026-10-20'] = { instagram: { versuche: 3, fehler: 'kaputt' }, facebook: { id: 'f0' } };
  await tick({ z, cfg, jetzt: new Date('2026-10-21T08:00:00Z'), laden: async (j, t) => inhalt(j, t), telegram,
    plattformen: { instagram: async () => ({ id: `i${++posts}` }), facebook: async () => ({ id: `f${++posts}` }) }, log: () => {} });
  assert.equal(posts, 1); // nur Instagram, Facebook war schon draußen
  assert.equal(z.tage['2026-10-20'].instagram.id, 'i1');
  assert.deepEqual(z.gesperrt, []);
});

test('/test meldet die Verbindung, auch wenn sie gestört ist', async () => {
  for (const [verbindung, erwartet] of [[async () => '✓ ok', '✓ ok'], [async () => { throw new Error('Invalid token'); }, /Verbindung gestört:\nInvalid token/]]) {
    const telegram = tg([{ befehl: 'test' }]);
    await tick({ z: leer(), cfg, jetzt: new Date('2026-10-21T08:00:00Z'), laden: async () => null, telegram, plattformen: {}, verbindung, log: () => {} });
    if (typeof erwartet === 'string') assert.equal(telegram.gesendet[0], erwartet); else assert.match(telegram.gesendet[0], erwartet);
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
  assert.equal(letzterSchluessel('12-31', new Date('2027-01-02T10:00:00Z')), '2026-12-31');
  assert.equal(letzterSchluessel('01-02', new Date('2027-01-02T10:00:00Z')), '2027-01-02');
  assert.equal(schluessel('12-24', new Date('2026-12-20T10:00:00Z')), '2026-12-24');
});

// ---------- Kennzahlen, Wochenbericht, Log ----------
import { aktualisiere } from './log-aktualisieren.mjs';

test('Kennzahlen: fällt der volle Metrik-Satz durch, wird der kleine versucht', async () => {
  const gefragt = [];
  const client = new MetaClient({ token: 'T', igUserId: 'IG', pageId: 'PG', warte: async () => {}, fetch: async url => {
    const metric = new URL(url).searchParams.get('metric'); gefragt.push(metric);
    if (metric.includes('views')) return { ok: false, status: 400, json: async () => ({ error: { message: 'unsupported metric' } }) };
    return { ok: true, json: async () => ({ data: [{ name: 'reach', values: [{ value: 420 }] }, { name: 'saved', total_value: { value: 7 } }] }) };
  } });
  const k = await client.igKennzahlen('m1', true);
  assert.equal(gefragt.length, 2);
  assert.equal(k.reichweite, 420); assert.equal(k.gespeichert, 7); assert.equal(k.aufrufe, null);
});

test('Kennzahlen werden erst ab Tag 7 geholt, danach nicht erneut', async () => {
  const z = leer(); let geholt = 0;
  z.tage['2026-10-14'] = { art: 'video', instagram: { id: 'alt' } };   // 7 Tage vor 21.10.
  z.tage['2026-10-15'] = { art: 'bild', instagram: { id: 'jung' } };   // 6 Tage
  const ctx = { z, cfg: { ...cfg, plattformen: [] }, jetzt: MITTAG, laden: async () => null, telegram: tg(), plattformen: {},
    kennzahlen: async (id, video) => { geholt++; assert.equal(id, 'alt'); assert.equal(video, true); return { reichweite: 100 }; }, log: () => {} };
  await tick(ctx); await tick(ctx);
  assert.equal(geholt, 1);
  assert.equal(z.tage['2026-10-14'].instagram.kennzahlen.reichweite, 100);
});

test('Wochenbericht: sonntags abends, einmal, bester Beitrag zuerst', async () => {
  const z = leer(), telegram = tg();
  z.tage['2026-10-16'] = { art: 'bild', hook: 'Schwach', instagram: { id: 'a', kennzahlen: { reichweite: 50, gespeichert: 1 } } };
  z.tage['2026-10-17'] = { art: 'video', hook: 'Stark', instagram: { id: 'b', kennzahlen: { reichweite: 1500, gespeichert: 30, aufrufe: 4000 } } };
  const sonntagAbend = new Date('2026-10-25T19:00:00Z'); // 20:00 MEZ
  const ctx = { z, cfg, jetzt: sonntagAbend, laden: async () => null, telegram, plattformen: {}, log: () => {} };
  await tick(ctx); await tick(ctx);
  const bericht = telegram.gesendet.filter(t => t.startsWith('📊'));
  assert.equal(bericht.length, 1);
  assert.match(bericht[0], /🏆 10-17 🎬 Reichweite 1,5k/);
  assert.match(bericht[0], /Bester Hook: Stark/);
});

test('Log: Durum → Yayında mit Link, Sonuç → Kennzahlen; fremde Zeilen bleiben', () => {
  const log = [
    '| 10-21 | Post | wissen | Ortak | „Hook" | Quelle | Taslak | |',
    '| 10-22 | Video | POV | Ortak | „Hook2" | Quelle | Taslak | |',
    'Freitext | mit | Pipes',
  ].join('\n');
  const { text, geaendert } = aktualisiere(log, { tage: {
    '2026-10-21': { instagram: { id: '1', link: 'https://instagram.com/p/x', kennzahlen: { reichweite: 1234, gespeichert: 12 } }, facebook: { id: '2' } },
  } });
  assert.equal(geaendert, 1);
  const [z1, z2, z3] = text.split('\n');
  assert.equal(z1, '| 10-21 | Post | wissen | Ortak | „Hook" | Quelle | Yayında [IG](https://instagram.com/p/x) FB | Reichweite 1,2k · gespeichert 12 |');
  assert.equal(z2, '| 10-22 | Video | POV | Ortak | „Hook2" | Quelle | Taslak | |');
  assert.equal(z3, 'Freitext | mit | Pipes');
});
