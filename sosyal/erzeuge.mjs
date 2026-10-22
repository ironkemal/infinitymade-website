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
let nurMusik = false;
let karen = null; // --kare 1.5,4: nur Einzelbilder zu diesen Sekunden (<tag>-k1.5.png), zum Prüfen von Animation/Untertiteln // --nur-musik: vorhandenes <tag>-stumm.mp4 neu vertonen, ohne neu zu rendern
const ziele = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--jahr') jahr = args[++i];
  else if (args[i] === '--vorschau') vorschau = true;
  else if (args[i] === '--nur-musik') nurMusik = true;
  else if (args[i] === '--kare') karen = args[++i].split(',').map(Number);
  else ziele.push(args[i]);
}
let warnungen = 0;
if (!ziele.length) { console.error('Aufruf: node sosyal/erzeuge.mjs <MM-TT> [...]'); process.exit(1); }


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

// Sprecher: Szenen mit "sprecher" bekommen eine Sprachspur. Piper (MIT) + Stimme Thorsten (CC0), lokal,
// Modell in sosyal/musik/stimme/ (nicht in git, Bezug: SOSYAL-LOG A6). Szenen werden bei Bedarf verlängert.
const STIMME = path.join(hier, 'musik', 'stimme', 'de_DE-thorsten-high.onnx');
const TEMPO = '0.9'; // < 1 = schneller; Reels vertragen zügiges Sprechen
function lauf(cmd, argv, eingabe) {
  return new Promise((r, j) => {
    const p = spawn(cmd, argv, { stdio: [eingabe == null ? 'ignore' : 'pipe', 'pipe', 'inherit'] });
    let o = ''; p.stdout.on('data', d => o += d);
    if (eingabe != null) { p.stdin.write(eingabe); p.stdin.end(); }
    p.on('close', c => (c === 0 ? r(o) : j(new Error(`${cmd} ${c}`))));
  });
}
// Gemini TTS (bevorzugt): Schlüssel GEMINI_API_KEY aus Umgebung oder sosyal/yayinci/.env. Es geht nur Werbetext raus,
// keine Patientendaten. Ohne Schlüssel → Piper. "stimme" (Top-Level) = Gemini-Stimmname, "sprechweise" = Regieanweisung.
const STIMME_GEMINI = 'Laomedeia';
const SPRECHWEISE = 'Sprich auf Deutsch, lebendig, warm und begeistert, wie eine junge Praxismanagerin, die einer Kollegin einen Tipp gibt. Zügiges, natürliches Tempo, ein Lächeln in der Stimme.';
let schluessel;
async function geminiSchluessel() {
  if (schluessel !== undefined) return schluessel;
  schluessel = process.env.GEMINI_API_KEY || null;
  if (!schluessel) {
    try {
      const env = await readFile(path.join(hier, 'yayinci', '.env'), 'utf8');
      schluessel = env.match(/^GEMINI_API_KEY=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim() || null;
    } catch { schluessel = null; }
  }
  return schluessel;
}
let ttsModell;
async function geminiSprich(text, weise, stimme, datei) {
  const key = await geminiSchluessel(), basis = 'https://generativelanguage.googleapis.com/v1beta';
  if (!ttsModell) {
    const liste = await (await fetch(`${basis}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })).json();
    const namen = (liste.models || []).map(m => m.name).filter(n => /tts/.test(n));
    ttsModell = namen.find(n => /pro/.test(n)) || namen.find(n => /flash/.test(n)) || namen[0];
    if (!ttsModell) throw new Error('Gemini: kein TTS-Modell verfügbar — ' + JSON.stringify(liste.error || {}).slice(0, 200));
  }
  const res = await fetch(`${basis}/${ttsModell}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${weise || SPRECHWEISE}

${text}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: stimme || STIMME_GEMINI } } } },
    }),
  });
  const j = await res.json();
  const teil = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!teil) throw new Error(`Gemini TTS ${res.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const roh = datei.replace(/\.wav$/, '.pcm');
  await writeFile(roh, Buffer.from(teil.inlineData.data, 'base64'));
  const rate = teil.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] || '24000';
  // Stille an Anfang/Ende abschneiden, damit die Untertitel-Zeiten stimmen
  await lauf('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', rate, '-ac', '1', '-i', roh, '-af',
    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', datei]);
  const { unlink } = await import('node:fs/promises'); await unlink(roh);
}
const dauerVon = async datei => parseFloat(await lauf('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', datei]));
async function stimmen(inhalt) {
  const { existsSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const ablage = path.join(hier, 'ausgabe', '_stimme');
  await mkdir(ablage, { recursive: true });
  const spuren = [];
  let t = 0;
  for (const [i, s] of (inhalt.szenen || []).entries()) {
    if (s.sprecher) {
      const motor = (await geminiSchluessel()) ? `gemini:${inhalt.stimme || STIMME_GEMINI}:${s.sprechweise || inhalt.sprechweise || ''}` : `piper:${TEMPO}`;
      const datei = path.join(ablage, createHash('sha1').update(motor + s.sprecher).digest('hex').slice(0, 16) + '.wav');
      if (!existsSync(datei)) {
        if (await geminiSchluessel()) await geminiSprich(s.sprecher, s.sprechweise || inhalt.sprechweise, inhalt.stimme, datei);
        else await lauf('python', ['-m', 'piper', '-m', STIMME, '-f', datei, '--length-scale', TEMPO, '--sentence-silence', '0.12'], s.sprecher);
      }
      const d = await dauerVon(datei), bei = i === 0 ? .1 : .25;
      if (s.dauer < bei + d + .3) s.dauer = +(bei + d + .3).toFixed(2);
      s.vo = { bei, dauer: d };
      spuren.push({ datei, start: t + bei });
    }
    t += s.dauer;
  }
  return spuren;
}

async function vertone(inhalt, basis, dauer, spuren = []) {
  const stumm = `${basis}-stumm.mp4`, wahl = waehleMusik(inhalt);
  const { copyFile } = await import('node:fs/promises');
  if (wahl === 'keine' && !spuren.length) { await copyFile(stumm, `${basis}.mp4`); return wahl; }
  const aus = Math.max(0, dauer - 1.2).toFixed(2), D = dauer.toFixed(2);
  const ein = ['-i', stumm];
  const f = [];
  let n = 1;
  if (wahl !== 'keine') {
    ein.push('-stream_loop', '-1', '-i', path.join(hier, 'musik', `${wahl}.wav`));
    f.push(`[${n++}:a]atrim=0:${D},afade=t=in:st=0:d=0.3,afade=t=out:st=${aus}:d=1.2,volume=${spuren.length ? '-5dB' : '-2dB'}[mu]`);
  }
  if (spuren.length) {
    spuren.forEach((sp, k) => {
      ein.push('-i', sp.datei);
      const ms = Math.round(sp.start * 1000);
      f.push(`[${n++}:a]aresample=48000,adelay=${ms}|${ms},volume=2.5dB[v${k}]`);
    });
    f.push(`${spuren.map((_, k) => `[v${k}]`).join('')}amix=inputs=${spuren.length}:normalize=0,apad,atrim=0:${D}[vo]`);
    if (wahl !== 'keine') {
      // Musik duckt unter der Stimme
      f.push('[vo]asplit[vo1][vo2]', '[mu][vo1]sidechaincompress=threshold=0.02:ratio=12:attack=15:release=400[md]',
        `[md][vo2]amix=inputs=2:normalize=0,atrim=0:${D}[a]`);
    } else f.push('[vo]anull[a]');
  } else f.push('[mu]anull[a]');
  await lauf('ffmpeg', ['-y', '-loglevel', 'error', ...ein, '-filter_complex', f.join(';'),
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', `${basis}.mp4`]);
  return spuren.length ? `${wahl} + Stimme` : wahl;
}

async function video(inhalt, basis) {
  const { existsSync } = await import('node:fs');
  const spuren = await stimmen(inhalt);
  if (nurMusik && existsSync(`${basis}-stumm.mp4`)) {
    const dauer = await new Promise(r => { let o = ''; spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'csv=p=0', `${basis}-stumm.mp4`]).stdout.on('data', d => o += d).on('end', () => r(parseFloat(o))); });
    console.log(`✓ ${basis}.mp4 (Musik: ${await vertone(inhalt, basis, dauer, spuren)})`);
    return;
  }
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.addInitScript(v => { window.VIDEO = v; }, inhalt);
  await page.goto(pathToFileURL(path.join(hier, 'video', 'vorlage-video.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const dauer = await page.evaluate(() => window.DAUER);
  const frames = Math.ceil(dauer * FPS);
  melde(path.basename(basis), await page.evaluate(() => window.pruefe()));

  if (karen) {
    for (const t of karen) { await page.evaluate(x => window.renderAt(x), t); await page.screenshot({ path: `${basis}-k${t}.png` }); }
    await page.close(); console.log(`✓ ${karen.length} Einzelbilder`); return;
  }
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
  console.log(`✓ ${basis}.mp4 (${dauer.toFixed(1)} s, Musik: ${await vertone(inhalt, basis, frames / FPS, spuren)})`);
}

// Hauptlauf am Ende: alle Konstanten/Funktionen oben sind dann initialisiert
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
