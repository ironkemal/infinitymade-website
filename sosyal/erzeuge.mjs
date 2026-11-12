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
let ohneStimme = false; // --ohne-stimme: Vorschau ohne TTS-Anfrage, Sprechdauer geschätzt (Layout prüfen, solange das Kontingent leer ist)
let karen = null; // --kare 1.5,4: nur Einzelbilder zu diesen Sekunden (<tag>-k1.5.png), zum Prüfen von Animation/Untertiteln // --nur-musik: vorhandenes <tag>-stumm.mp4 neu vertonen, ohne neu zu rendern
const ziele = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--jahr') jahr = args[++i];
  else if (args[i] === '--vorschau') vorschau = true;
  else if (args[i] === '--nur-musik') nurMusik = true;
  else if (args[i] === '--kare') karen = args[++i].split(',').map(Number);
  else if (args[i] === '--ohne-stimme') { ohneStimme = true; vorschau = true; }
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
// Mehrere Schlüssel möglich: GEMINI_API_KEY, GEMINI_API_KEY_2, _3 … — ist das Tageskontingent eines Schlüssels leer, kommt der nächste
let schluessel, schluesselListe = [], schluesselNr = 0;
async function geminiSchluessel() {
  if (schluessel !== undefined) return schluessel;
  let env = '';
  try { env = await readFile(path.join(hier, 'yayinci', '.env'), 'utf8'); } catch {}
  const ausEnv = [...env.matchAll(/^GEMINI_API_KEY(?:_\d+)?=\s*"?([^"\r\n]+)"?/gm)].map(m => m[1].trim()).filter(Boolean);
  schluesselListe = [...new Set([process.env.GEMINI_API_KEY, ...ausEnv].filter(Boolean))];
  schluessel = schluesselListe[0] || null;
  return schluessel;
}
let ttsListe, ttsAlle;
async function geminiSprich(text, weise, stimme, datei, versuche) {
  await geminiSchluessel();
  let key = schluesselListe[schluesselNr];
  const basis = 'https://generativelanguage.googleapis.com/v1beta';
  if (!ttsListe) {
    const liste = await (await fetch(`${basis}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })).json();
    const namen = (liste.models || []).map(m => m.name).filter(n => /tts/.test(n));
    // pro-TTS hat im Gratis-Kontingent 0 Quote → flash-tts zuerst, lite zuletzt
    const rang = n => /pro/.test(n) ? 9 : /lite/.test(n) ? 5 : /flash-tts$/.test(n) ? 0 : 1;
    // lite liest die Regieanweisung mit vor (gemessen 23.10.2026: 22 s statt 2 s) → raus
    ttsAlle = namen.filter(n => !/pro|lite/.test(n)).sort((a, b) => rang(a) - rang(b) || b.localeCompare(a));
    ttsListe = [...ttsAlle];
    if (!ttsListe.length) throw new Error('Gemini: kein TTS-Modell verfügbar — ' + JSON.stringify(liste.error || {}).slice(0, 200));
  }
  // Gratis-Kontingent: 3 Anfragen/Minute je Modell → kurz warten; Tageskontingent leer (Wartezeit > 2 min) → nächstes Modell
  let res, j, ausweich = 0;
  for (let versuch = 0; versuch < 20; versuch++) {
    const ttsModell = ttsListe[Math.min(ausweich, ttsListe.length - 1)];
    res = await fetch(`${basis}/${ttsModell}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        // Regie als DIRECTOR'S NOTES, Sprechtext unter TRANSCRIPT — andere Rahmungen liest 3.8-flash-tts mit vor (gemessen 23.10.2026: 5,5 s statt 17–26 s)
        contents: [{ parts: [{ text: `### DIRECTOR'S NOTES\nStyle: ${weise || SPRECHWEISE}\nLanguage: German.\n\n#### TRANSCRIPT\n${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: stimme || STIMME_GEMINI } } } },
      }),
    });
    j = await res.json();
    // 200 ohne Audio (finishReason OTHER): einmal neu, dann dieses eine Stück mit dem nächsten Modell
    if (res.ok && !j.candidates?.[0]?.content?.parts?.some(p => p.inlineData) && versuch < 6) {
      if (versuch % 2) ausweich++;
      console.log(`  … ${ttsModell}: keine Audiodaten (${j.candidates?.[0]?.finishReason}), neuer Versuch`);
      continue;
    }
    if (res.status !== 429) break;
    const warte = parseFloat(j.error?.details?.find(d => d.retryDelay)?.retryDelay) || 30;
    // erst den Schlüssel wechseln, dann das Modell: gleiches Modell = gleicher Stimmklang im ganzen Video
    if (warte > 120 && schluesselNr < schluesselListe.length - 1) {
      schluesselNr++; key = schluesselListe[schluesselNr];
      console.log(`  … Schlüssel ${schluesselNr}: Tageskontingent leer, weiter mit Schlüssel ${schluesselNr + 1} (${ttsModell})`);
      continue;
    }
    if (warte > 120 && ttsListe.length > 1) {
      console.log(`  … ${ttsModell}: Tageskontingent leer, weiter mit ${ttsListe[1]}`);
      ttsListe.shift();
      // neues Modell hat auf jedem Schlüssel eigenes Kontingent → wieder beim ersten anfangen
      schluesselNr = 0; key = schluesselListe[0];
      continue;
    }
    if (warte > 120) throw new Error(`Gemini TTS: Tageskontingent aller Modelle leer (frei in ${Math.round(warte / 3600 * 10) / 10} h)`);
    console.log(`  … Gemini-Kontingent, warte ${Math.ceil(warte) + 2} s`);
    await new Promise(r => setTimeout(r, (warte + 2) * 1000));
  }
  const teil = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!teil) throw new Error(`Gemini TTS ${res.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const daten = Buffer.from(teil.inlineData.data, 'base64');
  // Neuere TTS-Modelle liefern fertiges WAV statt rohem PCM. Als PCM gelesen wird der Dateikopf („RIFF…") mit abgespielt
  // = lautes Knacken an jedem Szenenwechsel (gemessen 24.10.2026). Darum Kopf erkennen und ffmpeg das Format selbst lesen lassen.
  const istWav = daten.subarray(0, 4).toString('latin1') === 'RIFF';
  const roh = datei.replace(/\.wav$/, istWav ? '.roh.wav' : '.pcm');
  await writeFile(roh, daten);
  const rate = teil.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] || '24000';
  // Stille an Anfang/Ende abschneiden, damit die Untertitel-Zeiten stimmen
  await lauf('ffmpeg', ['-y', '-loglevel', 'error', ...(istWav ? [] : ['-f', 's16le', '-ar', rate, '-ac', '1']), '-i', roh, '-af',
    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', datei]);
  const { unlink } = await import('node:fs/promises'); await unlink(roh);
  // Plausibilität: ~15 Zeichen/s; deutlich länger = Anweisung mitgelesen → neu sprechen
  const erwartet = text.length / 15, d = await dauerVon(datei);
  if (d > erwartet * 2.6 + 1.5) {
    await unlink(datei);
    if ((versuche || 0) >= 2) throw new Error(`Gemini TTS: Sprechdauer ${d.toFixed(1)} s statt ~${erwartet.toFixed(1)} s für „${text.slice(0, 40)}…"`);
    console.log(`  … Sprechdauer ${d.toFixed(1)} s statt ~${erwartet.toFixed(1)} s, neu`);
    return geminiSprich(text, weise, stimme, datei, (versuche || 0) + 1);
  }
}
// Ablage vor dem 24.10.2026: WAV-Kopf als Ton mitgespeichert (Knacken). Der Kopf steckt unversehrt in den Daten
// (Stillekürzung hat an den lauten Kopfbytes nichts abgeschnitten) → inneres WAV herauslösen und neu kürzen, ohne neue TTS-Anfrage.
async function repariere(datei) {
  const buf = await readFile(datei);
  const d = buf.indexOf('data', 12, 'latin1');
  if (d < 0 || buf.subarray(d + 8, d + 12).toString('latin1') !== 'RIFF') return false;
  const innen = buf.subarray(d + 8, d + 8 + buf.readUInt32LE(d + 4));
  const roh = datei.replace(/\.wav$/, '.roh.wav');
  await writeFile(roh, innen);
  await lauf('ffmpeg', ['-y', '-loglevel', 'error', '-i', roh, '-af',
    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', datei]);
  const { unlink, readdir } = await import('node:fs/promises'); await unlink(roh);
  // abgeleitete Spuren (Tempo/Telefon, Suffix -xxxxxx) stammen vom kaputten Stand → weg, werden neu abgeleitet
  const stamm = path.basename(datei, '.wav'), ordner = path.dirname(datei);
  for (const f of await readdir(ordner)) if (f.startsWith(stamm + '-')) await unlink(path.join(ordner, f));
  return true;
}
const dauerVon = async datei => parseFloat(await lauf('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', datei]));
async function stimmen(inhalt) {
  const { existsSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const ablage = path.join(hier, 'ausgabe', '_stimme');
  await mkdir(ablage, { recursive: true });
  // Stimme: Laomedeia (energisch) Standard, Aoede (ruhig, warm) für Foto-Geschichten — Kemal, 22.10.2026
  const stimme = inhalt.stimme || ((inhalt.szenen || []).some(x => x.typ === 'foto') ? 'Aoede' : STIMME_GEMINI);
  const spuren = [];
  let t = 0;
  for (const [i, s] of (inhalt.szenen || []).entries()) {
    if (s.sprecher) {
      // "stimme" je Szene überschreibt die Video-Stimme (Dialoge: Bandansage, Kassenmitarbeiterin, …)
      const st = s.stimme || stimme;
      const motor = (await geminiSchluessel()) ? `gemini:${st}:${s.sprechweise || inhalt.sprechweise || ''}` : `piper:${TEMPO}`;
      const datei = path.join(ablage, createHash('sha1').update(motor + s.sprecher).digest('hex').slice(0, 16) + '.wav');
      // alte Ablage kann noch Aufnahmen mit mitgelesener Anweisung enthalten → verwerfen
      if (existsSync(datei) && motor.startsWith('gemini') && await repariere(datei)) console.log(`  … Knacken entfernt: ${path.basename(datei)}`);
      if (existsSync(datei) && motor.startsWith('gemini') && await dauerVon(datei) > s.sprecher.length / 15 * 2.6 + 1.5) {
        const { unlink } = await import('node:fs/promises'); await unlink(datei);
      }
      if (!existsSync(datei)) {
        if (await geminiSchluessel()) await geminiSprich(s.sprecher, s.sprechweise || inhalt.sprechweise, st, datei);
        else await lauf('python', ['-m', 'piper', '-m', STIMME, '-f', datei, '--length-scale', TEMPO, '--sentence-silence', '0.12'], s.sprecher);
      }
      // "tempo" (Top-Level oder Szene, z. B. 1.15): Aufnahme nachträglich straffen, ohne Tonhöhe zu ändern, ohne neue TTS-Anfrage
      // "telefon": true → klingt wie durch den Hörer (Bandpass + leichte Verzerrung)
      const tempo = s.tempo || inhalt.tempo;
      const af = [tempo && tempo !== 1 ? `atempo=${tempo}` : '', s.telefon ? 'highpass=f=380,lowpass=f=3200,acrusher=bits=10:mix=.35,volume=2dB' : ''].filter(Boolean);
      let spur = datei;
      if (af.length) {
        spur = datei.replace(/\.wav$/, `-${createHash('sha1').update(af.join(',')).digest('hex').slice(0, 6)}.wav`);
        if (!existsSync(spur)) await lauf('ffmpeg', ['-y', '-loglevel', 'error', '-i', datei, '-af', af.join(','), spur]);
      }
      const d = await dauerVon(spur), bei = i === 0 ? .1 : .25;
      // "nachlauf": Sekunden Bild nach dem letzten Wort (Pointe, Reaktion), Standard 0,3
      const nach = s.nachlauf ?? .3;
      if (s.dauer < bei + d + nach) s.dauer = +(bei + d + nach).toFixed(2);
      s.vo = { bei, dauer: d };
      spuren.push({ datei: spur, start: t + bei });
    }
    t += s.dauer;
  }
  return spuren;
}

// 15 ms Ein-, 40 ms Ausblendung je Sprach-/Effektspur: harte Kanten knacken an Szenenwechseln
const KANTEN = 'afade=t=in:d=0.015,areverse,afade=t=in:d=0.04,areverse';
async function vertone(inhalt, basis, dauer, spuren = []) {
  const stumm = `${basis}-stumm.mp4`, wahl = waehleMusik(inhalt);
  const { copyFile } = await import('node:fs/promises');
  if (wahl === 'keine' && !spuren.length && !(inhalt.szenen || []).some(s => s.klang?.length)) { await copyFile(stumm, `${basis}.mp4`); return wahl; }
  // Szenenanfänge (nach stimmen() verlängert) für Klangeffekte und Musikstopp
  const anfang = []; (inhalt.szenen || []).reduce((t, s) => (anfang.push(t), t + s.dauer), 0);
  // "musikStopp": true an einer Szene → Musik bricht dort hart ab (Pointe nach dem Trailer)
  const stoppIdx = (inhalt.szenen || []).findIndex(s => s.musikStopp);
  const musikEnde = stoppIdx > 0 ? anfang[stoppIdx] : dauer;
  const aus = Math.max(0, musikEnde - (stoppIdx > 0 ? .06 : 1.2)).toFixed(2), D = dauer.toFixed(2);
  const ein = ['-i', stumm];
  const f = [];
  let n = 1;
  if (wahl !== 'keine') {
    ein.push('-stream_loop', '-1', '-i', path.join(hier, 'musik', `${wahl}.wav`));
    f.push(`[${n++}:a]atrim=0:${D},afade=t=in:st=0:d=0.3,afade=t=out:st=${aus}:d=${stoppIdx > 0 ? .06 : 1.2},volume=${spuren.length ? '-5dB' : '-2dB'}[mu]`);
  }
  // Klangeffekte (sosyal/musik/klang/<art>.wav): "klang": [{"art":"boom","bei":0}] · "bei":"ende" = endet mit der Szene,
  // negativ = Sekunden vor Szenenende (die Szenendauer steht erst nach der Sprachaufnahme fest)
  const klaenge = [];
  for (const [i, s] of (inhalt.szenen || []).entries()) for (const k of s.klang || []) {
    const datei = path.join(hier, 'musik', 'klang', `${k.art}.wav`);
    const bei = k.bei === 'ende' ? s.dauer - await dauerVon(datei) : k.bei === 'nach' ? (s.vo ? s.vo.bei + s.vo.dauer + .12 : s.dauer * .5) : k.bei < 0 ? s.dauer + k.bei : (k.bei || 0);
    klaenge.push({ datei, start: Math.max(0, anfang[i] + bei), laut: k.laut ?? 0 });
  }
  klaenge.forEach((k, j) => {
    ein.push('-i', k.datei);
    const ms = Math.round(k.start * 1000);
    // weiche Kanten: kein Knacken, wenn ein Effekt einsetzt oder endet (Kemal, 24.10.2026)
    f.push(`[${n++}:a]aresample=44100,${KANTEN},adelay=${ms}|${ms},volume=${k.laut - 4}dB[k${j}]`);
  });
  if (klaenge.length) f.push(`${klaenge.map((_, j) => `[k${j}]`).join('')}amix=inputs=${klaenge.length}:normalize=0,apad,atrim=0:${D}[kl]`);
  // ohne Musik, aber mit Effekten: Stille als Musikspur, damit der Rest gleich bleibt
  if (wahl === 'keine' && klaenge.length) f.push(`anullsrc=r=44100:cl=stereo,atrim=0:${D}[mu]`);
  const hatMusik = wahl !== 'keine' || klaenge.length;
  // Effekte kommen NACH dem Ducking dazu — ein Einschlag soll nicht unter der Stimme verschwinden
  const ziel = klaenge.length ? '[a0]' : '[ar]';
  if (spuren.length) {
    spuren.forEach((sp, k) => {
      ein.push('-i', sp.datei);
      const ms = Math.round(sp.start * 1000);
      f.push(`[${n++}:a]aresample=48000,${KANTEN},adelay=${ms}|${ms},volume=2.5dB[v${k}]`);
    });
    f.push(`${spuren.map((_, k) => `[v${k}]`).join('')}amix=inputs=${spuren.length}:normalize=0,apad,atrim=0:${D}[vo]`);
    if (hatMusik) {
      // Musik duckt unter der Stimme
      f.push('[vo]asplit[vo1][vo2]', '[mu][vo1]sidechaincompress=threshold=0.02:ratio=12:attack=15:release=400[md]',
        `[md][vo2]amix=inputs=2:normalize=0,atrim=0:${D}${ziel}`);
    } else f.push(`[vo]anull${ziel}`);
  } else f.push(`[mu]anull${ziel}`);
  if (klaenge.length) f.push(`[a0][kl]amix=inputs=2:normalize=0,atrim=0:${D}[ar]`);
  // Stimme + Musik + Effekte addieren sich (gemessen 23.10.2026: +2,6 dBFS) → Limiter auf −2 dB (AAC-Kodierung erzeugt Zwischenspitzen)
  f.push('[ar]alimiter=limit=0.79:attack=5:release=60:level=false[a]');
  await lauf('ffmpeg', ['-y', '-loglevel', 'error', ...ein, '-filter_complex', f.join(';'),
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', `${basis}.mp4`]);
  return spuren.length ? `${wahl} + Stimme` : wahl;
}

// Ersatz für stimmen() ohne TTS: ~13 Zeichen/s (gemessen 24.10.2026 an natürlichen Gemini-Stimmen, tempo 1.05), gleiche Verlängerungslogik
function schaetzeStimmen(inhalt) {
  for (const [i, s] of (inhalt.szenen || []).entries()) {
    if (!s.sprecher) continue;
    const bei = i === 0 ? .1 : .25, d = s.sprecher.length / 13 / (s.tempo || inhalt.tempo || 1), nach = s.nachlauf ?? .3;
    if (s.dauer < bei + d + nach) s.dauer = +(bei + d + nach).toFixed(2);
    s.vo = { bei, dauer: d };
  }
  return [];
}
async function video(inhalt, basis) {
  const { existsSync } = await import('node:fs');
  const spuren = ohneStimme ? schaetzeStimmen(inhalt) : await stimmen(inhalt);
  if (ohneStimme) basis += '-entwurf';
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
