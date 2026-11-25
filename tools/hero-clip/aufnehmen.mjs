// Hero-Clip für praxura.de aus der Demo aufnehmen (Kemal 25.11.2026: „video istiyorum,
// hareketli ve dikkat çekici, tüm önemli fonksiyonları anlatsın").
//
// Warum aus der Demo und nicht von Hand gefilmt: Die Demo ändert sich mit dem Produkt.
// Ein von Hand geschnittenes Video veraltet; dieses hier wird mit einem Befehl neu erzeugt.
//
//   npm run hero-clip
//
// Ablauf: demo-dashboard.html?film=1&auto=0 öffnen → window.startFilm() → CDP-Screencast
// (JPEG-Frames mit Zeitstempel, schärfer als Playwrights eigene VP8-Aufnahme) → ffmpeg baut
// daraus MP4 (H.264) + WebM (VP9) + Poster. Ausgabe: assets/video/
//
// Voraussetzungen: playwright (devDependency) + chromium, ffmpeg im PATH.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'assets', 'video');
const TMP = join(tmpdir(), 'praxura-hero-clip');
const W = 1440, H = 900;          // Aufnahme
const OW = 1280, OH = 800;        // Ausgabe
const POSTER_AT = Number(process.env.POSTER_AT || 6.3); // Sekunde: Verordnung eingelesen, Felder gefüllt

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const url = pathToFileURL(join(ROOT, 'demo-dashboard.html')).href + '?film=1&auto=0';
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(400);

const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ data, t: metadata.timestamp });
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* Ende */ }
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
await page.waitForTimeout(300);
await page.evaluate(() => window.startFilm());
await page.waitForFunction(() => window.__filmDone === true, null, { timeout: 120000, polling: 200 });
await cdp.send('Page.stopScreencast');
await browser.close();

if (frames.length < 20) throw new Error(`Zu wenige Frames (${frames.length}) — Screencast lief nicht.`);

// Frames + Dauer für ffmpeg concat (Screencast liefert nur bei Änderung einen Frame)
let list = '';
frames.forEach((f, i) => {
  const p = join(TMP, `f${String(i).padStart(5, '0')}.jpg`);
  writeFileSync(p, Buffer.from(f.data, 'base64'));
  const dur = i < frames.length - 1 ? Math.max(frames[i + 1].t - f.t, 0.001) : 0.5;
  list += `file '${p.replace(/\\/g, '/')}'\nduration ${dur.toFixed(4)}\n`;
});
const last = join(TMP, `f${String(frames.length - 1).padStart(5, '0')}.jpg`).replace(/\\/g, '/');
list += `file '${last}'\n`;
const listPath = join(TMP, 'list.txt');
writeFileSync(listPath, list);
const total = frames[frames.length - 1].t - frames[0].t;

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
// Leicht beschleunigt: in der Demo wartet alles auf Menschen, im Clip soll es zügig wirken.
const SPEED = Number(process.env.SPEED || 1.4);
const vf = `setpts=PTS/${SPEED},fps=30,scale=${OW}:${OH}:flags=lanczos,format=yuv420p`;
const mp4 = join(OUT, 'praxura-hero.mp4');
const webm = join(OUT, 'praxura-hero.webm');
const poster = join(OUT, 'praxura-hero-poster.webp');

ff(['-f', 'concat', '-safe', '0', '-i', listPath, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-tune', 'stillimage', '-movflags', '+faststart', '-an', mp4]);
ff(['-f', 'concat', '-safe', '0', '-i', listPath, '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-an', webm]);
ff(['-ss', String(POSTER_AT), '-i', mp4, '-frames:v', '1', '-vf', `scale=${OW}:${OH}`, '-c:v', 'libwebp', '-quality', '82', poster]);

const kb = (p) => Math.round(statSync(p).size / 1024) + ' KB';
console.log(`Frames: ${frames.length} · Dauer: ${total.toFixed(1)} s`);
console.log(`MP4  ${kb(mp4)}\nWebM ${kb(webm)}\nPoster ${kb(poster)}`);
rmSync(TMP, { recursive: true, force: true });
