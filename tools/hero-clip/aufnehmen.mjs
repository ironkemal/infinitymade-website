// Hero-Clip für praxura.de aus der Demo aufnehmen (Kemal 25.11.2026: „video istiyorum,
// hareketli ve dikkat çekici, tüm önemli fonksiyonları anlatsın").
//
// Warum aus der Demo und nicht von Hand gefilmt: Die Demo ändert sich mit dem Produkt.
// Ein von Hand geschnittenes Video veraltet; dieses hier wird mit einem Befehl neu erzeugt.
//
//   npm run hero-clip                 → „Die Absetzung" (tools/hero-clip/absetzung.html), Standard
//   QUELLE=werbung npm run hero-clip  → Nutzen-Werbefilm (tools/hero-clip/werbefilm.html)
//   QUELLE=demo npm run hero-clip     → Mitschnitt der Demo (demo-dashboard.html?film=1)
//
// Kemal 25.11.2026 (dritter Schritt): Nutzen-Film war zu nah an der Demo → Hero zeigt jetzt
// „Die Absetzung" (Verlust → Rückblende → bezahlt), gebaut für Besucher, die uns nicht kennen.
//
// Kemal 25.11.2026 (zweiter Wunsch): kein Demo-Mitschnitt im Hero, sondern ein Werbefilm,
// der „was macht das, ist das gut?" beantwortet → werbefilm.html ist jetzt der Standard.
//
// Ablauf: Quelle mit &auto=0 öffnen → window.startFilm() → CDP-Screencast
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
const DEMO = process.env.QUELLE === 'demo';
const W = DEMO ? 1440 : 1280, H = DEMO ? 900 : 800; // Aufnahme (Werbefilm ist fest 1280×800 gebaut)
const OW = 1280, OH = 800;        // Ausgabe
// Poster = erstes Bild, das man sieht, bevor das Video lädt: Demo → Verordnung eingelesen; Werbefilm → Verordnungs-Szene
const QUELLE = process.env.QUELLE || 'absetzung';
const POSTER_AT = Number(process.env.POSTER_AT || (DEMO ? 6.3 : QUELLE === 'werbung' ? 8.6 : 4.4));

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

// ── Tonfassung (TON=1): Sprecherin + Untertitel + leise Musik, für „Mit Ton ansehen" ──
// „Die Absetzung" = Geld/Vertrauen → Katharina (tts.mjs → SPRECHERIN). Jede Szene bekommt
// ihren Satz; ist er länger als die Szene, wird die Szene verlängert (?tl=… an den Film).
const TON = process.env.TON === '1' && QUELLE === 'absetzung';
const BASIS_TL = [5600, 2900, 2400, 2100, 5400, 3200, 3300, 3600]; // = TL in absetzung.html
const TEXT = [ // [gesprochen, Untertitel, Vorlauf s]
  ['Kennen Sie diesen Brief? Die Kasse kürzt zweihundertdreizehn Euro.', 'Kennen Sie diesen Brief? Die Kasse kürzt 213 Euro.', 0.7],
  ['Sechs Behandlungen geleistet. Bezahlt: nichts.', 'Sechs Behandlungen geleistet. Bezahlt: nichts.', 0.25],
  ['Dabei war der Fehler vom ersten Tag an sichtbar.', 'Dabei war der Fehler vom ersten Tag an sichtbar.', 0.2],
  ['Gehen wir zurück. Zu dem Tag, an dem die Verordnung kam.', 'Gehen wir zurück. Zu dem Tag, an dem die Verordnung kam.', 0.25],
  ['Praxura prüft die Verordnung schon beim Einlesen. Und meldet: Die Behandlung muss bis zum einundzwanzigsten Dezember beginnen. Der erste Termin liegt rechtzeitig.',
    'Praxura prüft die Verordnung schon beim Einlesen. Und meldet: Die Behandlung muss bis zum 21. Dezember beginnen. Der erste Termin liegt rechtzeitig.', 0.4],
  ['Gleiche Arbeit. Diesmal bezahlt.', 'Gleiche Arbeit. Diesmal bezahlt.', 0.6],
  ['Praxura findet Fehler, bevor die Kasse es tut.', 'Praxura findet Fehler, bevor die Kasse es tut.', 0.3],
  ['Damit Ihre Arbeit auch bezahlt wird.', 'Damit Ihre Arbeit auch bezahlt wird.', 0.5]
];
let tlMs = null; const clips = [];
if (TON) {
  const { sprich, SPRECHERIN } = await import('./tts.mjs');
  const sp = SPRECHERIN[process.env.SPRECHERIN || 'katharina'];
  tlMs = [];
  // Cache je Stimme+Text: Musik/Schnitt neu machen, ohne die Sprecherin neu anzufragen (Gemini-Kontingent)
  const { createHash } = await import('node:crypto');
  const { existsSync, copyFileSync } = await import('node:fs');
  const CACHE = join(tmpdir(), 'praxura-tts-cache'); mkdirSync(CACHE, { recursive: true });
  for (let i = 0; i < TEXT.length; i++) {
    const f = join(TMP, `stimme${i}.wav`);
    const c = join(CACHE, createHash('sha1').update(sp.stimme + '|' + sp.weise + '|' + TEXT[i][0]).digest('hex') + '.wav');
    if (!existsSync(c)) await sprich(TEXT[i][0], c, sp);
    copyFileSync(c, f);
    const { dauer } = await import('./tts.mjs'); const d = dauer(f);
    clips.push({ f, d, lead: TEXT[i][2], sub: TEXT[i][1] });
    tlMs.push(Math.max(BASIS_TL[i], Math.round((TEXT[i][2] + d + 0.6) * 1000)));
    console.log(`  Satz ${i + 1}: ${d.toFixed(1)} s`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const url = DEMO ? pathToFileURL(join(ROOT, 'demo-dashboard.html')).href + '?film=1&auto=0'
                 : pathToFileURL(join(ROOT, 'tools', 'hero-clip', QUELLE === 'werbung' ? 'werbefilm.html' : 'absetzung.html')).href + '?auto=0' + (tlMs ? '&tl=' + tlMs.join(',') : '');
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
const filmStart = Date.now() / 1000;
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
const SPEED = Number(process.env.SPEED || (DEMO ? 1.4 : 1));
const vf = `setpts=PTS/${SPEED},fps=30,scale=${OW}:${OH}:flags=lanczos,format=yuv420p`;
const name = TON ? 'praxura-hero-ton' : 'praxura-hero';
const mp4 = join(OUT, name + '.mp4');
const webm = join(OUT, name + '.webm');
const poster = join(OUT, 'praxura-hero-poster.webp');
const kb = (p) => Math.round(statSync(p).size / 1024) + ' KB';

if (TON) {
  // Zeitachse: Video beginnt beim ersten Frame, der Film bei filmStart
  const off = filmStart - frames[0].t;
  const starts = []; let acc = off; tlMs.forEach((ms) => { starts.push(acc); acc += ms / 1000; });
  const ende = total, tPx = starts[4]; // Szene „Mit Praxura": hier kippt die Musik
  const VOR = 60 / 122;                  // aufbruch.wav beginnt mit 1 Schlag Anstieg → Eins fällt auf den Szenenwechsel
  const vStumm = join(TMP, 'stumm.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', listPath, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-tune', 'stillimage', '-an', vStumm]);
  // Ton (Kemal 25.11.: „Praxura gelince canlı, enerjik müzik girmeli"):
  //   Problem-Teil: traurig.wav leise · ab „Mit Praxura": aufbruch.wav (122 bpm), kräftig, unter der Stimme geduckt
  //   (sidechaincompress), am Ende ausgeblendet. Eigene Kompositionen aus sosyal/musik/komponiere.py.
  const M = join(ROOT, 'sosyal', 'musik'); const n = clips.length;
  const vox = clips.map((c, i) => `[${i}:a]aresample=48000,adelay=${Math.round((starts[i] + c.lead) * 1000)}:all=1[v${i}]`).join(';');
  const fc = `${vox};${clips.map((_, i) => `[v${i}]`).join('')}amix=inputs=${n}:normalize=0,asplit=2[vox][key];`
    + `[${n}:a]aresample=48000,atrim=0:${(tPx + 0.3).toFixed(2)},afade=t=in:d=1.2,afade=t=out:st=${(tPx - 0.7).toFixed(2)}:d=0.8,volume=0.16[m1];`
    + `[${n + 1}:a]aresample=48000,atrim=0:${(ende - tPx + VOR + 0.5).toFixed(2)},afade=t=out:st=${Math.max(ende - tPx + VOR - 2.2, 1).toFixed(2)}:d=2.2,adelay=${Math.round((tPx - VOR) * 1000)}:all=1,volume=0.42[m2r];`
    + `[m2r][key]sidechaincompress=threshold=0.04:ratio=5:attack=20:release=350[m2];`
    + `[vox][m1][m2]amix=inputs=3:normalize=0,alimiter=limit=0.8:level=0,atrim=0:${ende.toFixed(2)}[a]`;
  const ton = join(TMP, 'ton.wav');
  ff([...clips.flatMap((c) => ['-i', c.f]), '-i', join(M, 'traurig.wav'), '-i', join(M, 'aufbruch.wav'), '-filter_complex', fc, '-map', '[a]', ton]);
  ff(['-i', vStumm, '-i', ton, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', mp4]);
  ff(['-i', vStumm, '-i', ton, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-c:a', 'libopus', '-b:a', '96k', '-shortest', webm]);
  // Untertitel (WebVTT): lange Sätze an Satzzeichen geteilt, Zeit anteilig nach Zeichen
  const ts = (x) => { const m = Math.floor(x / 60), s = (x % 60).toFixed(3).padStart(6, '0'); return `00:${String(m).padStart(2, '0')}:${s}`; };
  let vtt = 'WEBVTT\n\n';
  clips.forEach((c, i) => {
    // nur am Satzende teilen („Bezahlt: nichts." bleibt eine Zeile), Zeilen überlappen nicht
    const teile = c.sub.match(/[^.?!]+[.?!]+/g) || [c.sub];
    const ges = teile.reduce((s, t) => s + t.length, 0); let t0 = starts[i] + c.lead;
    teile.forEach((t) => { const d = c.d * t.length / ges; vtt += `${ts(t0)} --> ${ts(t0 + d - 0.05)}\n${t.trim()}\n\n`; t0 += d; });
  });
  writeFileSync(join(OUT, name + '.de.vtt'), vtt);
  console.log(`Tonfassung: ${ende.toFixed(1)} s · MP4 ${kb(mp4)} · WebM ${kb(webm)} · Szenen ${tlMs.join(',')}`);
  rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
}

ff(['-f', 'concat', '-safe', '0', '-i', listPath, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-tune', 'stillimage', '-movflags', '+faststart', '-an', mp4]);
ff(['-f', 'concat', '-safe', '0', '-i', listPath, '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-an', webm]);
ff(['-ss', String(POSTER_AT), '-i', mp4, '-frames:v', '1', '-vf', `scale=${OW}:${OH}`, '-c:v', 'libwebp', '-quality', '82', poster]);

console.log(`Frames: ${frames.length} · Dauer: ${total.toFixed(1)} s`);
console.log(`MP4  ${kb(mp4)}\nWebM ${kb(webm)}\nPoster ${kb(poster)}`);
rmSync(TMP, { recursive: true, force: true });
