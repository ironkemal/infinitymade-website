// Erzeugt die Tagesinhalte. Ein Tag = ein Inhalt = eine Datei sosyal/<jahr>/<MM-TT>.json
//   node sosyal/erzeuge.mjs 10-20            → sosyal/ausgabe/2026/10-20.mp4|png (+ -cover.jpg, .txt)
//   node sosyal/erzeuge.mjs 10-20 10-21      mehrere Tage
//   node sosyal/erzeuge.mjs --jahr 2027 01-05   oder   node sosyal/erzeuge.mjs 2026-12-31 2027-01-01
//   node sosyal/erzeuge.mjs sosyal/_muster/P1.json   beliebige Datei (Muster, Tests)
// "art": "post"  → vorlage/vorlage.html, 1080x1350; mit "seiten": [...] als Carousel (-1, -2, …)
// "art": "video" → video/vorlage-video.html, 1080x1920, 30 fps, H.264 (ffmpeg im PATH)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const FPS = 30;
const hier = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let jahr = String(new Date().getFullYear());
let vorschau = false; // --vorschau: Video nur als Kontaktbogen (ein Frame pro Szene), schnell
let nurMusik = false; // --nur-musik: vorhandenes <tag>-stumm.mp4 neu vertonen, ohne neu zu rendern
const ziele = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--jahr') jahr = args[++i];
  else if (args[i] === '--vorschau') vorschau = true;
  else if (args[i] === '--nur-musik') nurMusik = true;
  else ziele.push(args[i]);
}
let warnungen = 0;
if (!ziele.length) { console.error('Aufruf: node sosyal/erzeuge.mjs <MM-TT> [...]'); process.exit(1); }

const browser = await chromium.launch();
for (const ziel of ziele) {
  const istDatei = ziel.endsWith('.json');
  // "2027-01-05" = Jahr + Tag in einem (für Läufe über den Jahreswechsel), sonst "01-05" mit --jahr
  const mitJahr = ziel.match(/^(\d{4})-(\d{2}-\d{2})$/);
  const j = mitJahr ? mitJahr[1] : jahr, tag = mitJahr ? mitJahr[2] : ziel;
  const quelle = istDatei ? path.resolve(ziel) : path.join(hier, j, `${tag}.json`);
  const name = istDatei ? path.basename(ziel, '.json') : tag;
  const ordner = path.join(hier, 'ausgabe', istDatei ? '_muster' : j);
  await mkdir(ordner, { recursive: true });
  const inhalt = JSON.parse(await readFile(quelle, 'utf8'));
  if (inhalt.caption) await writeFile(path.join(ordner, `${name}.txt`), inhalt.caption);
  if (inhalt.art === 'video') await video(inhalt, path.join(ordner, name));
  else await post(inhalt, path.join(ordner, name));
}
await browser.close();
if (warnungen) { console.error(`\n⚠ ${warnungen} Überlauf-Warnung(en) — Text kürzen, dann neu erzeugen.`); process.exitCode = 2; }

function melde(name, fehler) {
  for (const f of fehler) { console.error(`⚠ ${name}: ${f}`); warnungen++; }
}

async function post(inhalt, basis) {
  const seiten = inhalt.seiten || [inhalt];
  for (const [i, seite] of seiten.entries()) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.addInitScript(p => { window.POST = p; }, seite);
    await page.goto(pathToFileURL(path.join(hier, 'vorlage', 'vorlage.html')).href);
    await page.evaluate(() => document.fonts.ready);
    const datei = seiten.length > 1 ? `${basis}-${i + 1}.png` : `${basis}.png`;
    melde(path.basename(datei), await page.evaluate(() => window.pruefe()));
    await page.locator('#post').screenshot({ path: datei });
    await page.close();
    console.log('✓', datei);
  }
}

// Musik (sosyal/musik/*.wav, selbst komponiert: komponiere.py). "musik" im JSON: ruhig | warm | leicht | keine.
// Ohne Angabe nach Format: POV/Countdown → leicht, Storytelling/Teaser (tippen, enthuellung) → ruhig, sonst warm.
function waehleMusik(inhalt) {
  if (inhalt.musik) return inhalt.musik;
  const s = inhalt.szenen || [];
  if (s.some(x => x.typ === 'countdown' || /POV/i.test(x.kicker || ''))) return 'leicht';
  if (['tippen', 'enthuellung'].includes(s[0]?.typ)) return 'ruhig';
  return 'warm';
}

async function vertone(inhalt, basis, dauer) {
  const stumm = `${basis}-stumm.mp4`, wahl = waehleMusik(inhalt);
  const { copyFile } = await import('node:fs/promises');
  if (wahl === 'keine') { await copyFile(stumm, `${basis}.mp4`); return wahl; }
  const spur = path.join(hier, 'musik', `${wahl}.wav`);
  const aus = Math.max(0, dauer - 1.2).toFixed(2);
  await new Promise((r, j) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', stumm, '-stream_loop', '-1', '-i', spur,
    '-filter_complex', `[1:a]atrim=0:${dauer.toFixed(2)},afade=t=in:st=0:d=0.3,afade=t=out:st=${aus}:d=1.2,volume=-2dB[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
    `${basis}.mp4`], { stdio: 'inherit' }).on('close', c => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
  return wahl;
}

async function video(inhalt, basis) {
  const { existsSync } = await import('node:fs');
  if (nurMusik && existsSync(`${basis}-stumm.mp4`)) {
    const dauer = await new Promise(r => { let o = ''; spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'csv=p=0', `${basis}-stumm.mp4`]).stdout.on('data', d => o += d).on('end', () => r(parseFloat(o))); });
    console.log(`✓ ${basis}.mp4 (Musik: ${await vertone(inhalt, basis, dauer)})`);
    return;
  }
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.addInitScript(v => { window.VIDEO = v; }, inhalt);
  await page.goto(pathToFileURL(path.join(hier, 'video', 'vorlage-video.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const dauer = await page.evaluate(() => window.DAUER);
  const frames = Math.ceil(dauer * FPS);
  melde(path.basename(basis), await page.evaluate(() => window.pruefe()));

  if (vorschau) {
    const zeiten = await page.evaluate(() => window.SZENEN_ENDE);
    const bilder = [];
    for (const [i, t] of zeiten.entries()) {
      await page.evaluate(x => window.renderAt(x), t);
      const datei = `${basis}-v${i}.png`;
      await page.screenshot({ path: datei });
      bilder.push(datei);
    }
    const ein = bilder.flatMap(b => ['-i', b]);
    const filter = bilder.map((_, i) => `[${i}]scale=360:-1[s${i}]`).join(';') + ';' +
      bilder.map((_, i) => `[s${i}]`).join('') + `hstack=inputs=${bilder.length}`;
    await new Promise((r, j) => spawn('ffmpeg', ['-y', '-loglevel', 'error', ...ein, '-filter_complex',
      bilder.length > 1 ? filter : '[0]scale=360:-1', `${basis}-vorschau.png`], { stdio: 'inherit' })
      .on('close', c => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
    const { unlink } = await import('node:fs/promises');
    await Promise.all(bilder.map(b => unlink(b)));
    await page.close();
    console.log(`✓ ${basis}-vorschau.png (${dauer.toFixed(1)} s, ${zeiten.length} Szenen)`);
    return;
  }
  // Cover: Ende der ersten Szene, wenn alles steht (Stempel gesetzt, Text fertig getippt)
  const ersteEnde = (await page.evaluate(() => window.SZENEN_ENDE))[0];
  const coverFrame = Math.round((inhalt.coverBei ?? ersteEnde) * FPS);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS),
    '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-crf', '18', '-movflags', '+faststart', `${basis}-stumm.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const bild = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(bild)) await new Promise(r => ff.stdin.once('drain', r));
    if (f === coverFrame) await writeFile(`${basis}-cover.jpg`, bild);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', c => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
  await page.close();
  console.log(`✓ ${basis}.mp4 (${dauer.toFixed(1)} s, Musik: ${await vertone(inhalt, basis, frames / FPS)})`);
}
