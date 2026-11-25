// Gemini-TTS für Praxura-Filme (Hero-Clip und spätere „Praxura im Einsatz"-Videos).
//
// Warum eigenes Modul statt sosyal/erzeuge.mjs → geminiSprich: das ist ein Skript mit
// Top-Level-Ablauf (Import würde es starten). Die Lehren von dort sind hier übernommen:
// DIRECTOR'S NOTES/TRANSCRIPT-Rahmen (sonst liest das Modell die Regie mit), WAV-Kopf
// erkennen (sonst Knacken), Stille abschneiden (Untertitel-Zeiten), Schlüssel-Rotation.
// Schlüssel: GEMINI_API_KEY[_n] aus Umgebung oder sosyal/yayinci/.env. Es geht nur
// Werbetext raus, keine Patientendaten.

import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASIS = 'https://generativelanguage.googleapis.com/v1beta';

// Die zwei festen Praxura-Sprecherinnen (Kemal 25.11.2026). Rolle = Stimme, nie tauschen:
//   Lena      → Funktionen, „Praxura im Einsatz", Anleitungen   (jung, warm)
//   Katharina → Preise, Vertrauen, Datenschutz, Geld/Absetzung   (tief, ruhig, mittleres Alter)
// In gemeinsamen Videos sprechen sie sich mit diesen Namen an. Es sind KI-Stimmen, keine
// echten Mitarbeiterinnen — so auch nie darstellen; in Beschreibungen „Stimmen KI-generiert".
// Katharina nie Erfahrungs-Behauptungen („seit X Jahren") in den Mund legen.
// Social Media (sosyal/erzeuge.mjs) bleibt bei Laomedeia.
export const SPRECHERIN = {
  lena: {
    stimme: 'Sulafat',
    weise: 'Natürliche, warme deutsche Sprecherin um die dreißig, freundlich und klar, wie eine Kollegin, die am Empfang etwas zeigt. '
      + 'Normales Sprechtempo, kleine natürliche Pausen. Nicht werblich, nicht übertrieben, nicht theatralisch.'
  },
  katharina: {
    stimme: 'Gacrux',
    weise: 'Tiefe, ruhige, souveräne deutsche Sprecherin mittleren Alters. Vertrauenswürdig und warm, ohne Werbeton. '
      + 'Spricht direkt zu einer Praxisinhaberin. Normales Tempo, natürliche Pausen, nicht theatralisch.'
  }
};
export const STIMME = process.env.STIMME || SPRECHERIN.lena.stimme;
export const SPRECHWEISE = SPRECHERIN.lena.weise;

let keys, kNr = 0, modelle;
async function schluessel() {
  if (keys) return keys;
  let env = '';
  try { env = await readFile(join(ROOT, 'sosyal', 'yayinci', '.env'), 'utf8'); } catch { /* keine Datei */ }
  const aus = [...env.matchAll(/^GEMINI_API_KEY(?:_\d+)?=\s*"?([^"\r\n]+)"?/gm)].map((m) => m[1].trim());
  keys = [...new Set([process.env.GEMINI_API_KEY, ...aus].filter(Boolean))];
  if (!keys.length) throw new Error('Kein GEMINI_API_KEY (Umgebung oder sosyal/yayinci/.env)');
  return keys;
}
async function modellListe() {
  if (modelle) return modelle;
  const j = await (await fetch(`${BASIS}/models?pageSize=200`, { headers: { 'x-goog-api-key': keys[kNr] } })).json();
  const n = (j.models || []).map((m) => m.name).filter((x) => /tts/.test(x) && !/pro|lite/.test(x));
  modelle = n.sort((a, b) => (/flash-tts$/.test(a) ? 0 : 1) - (/flash-tts$/.test(b) ? 0 : 1) || b.localeCompare(a));
  if (!modelle.length) throw new Error('Gemini: kein TTS-Modell');
  return modelle;
}
export const dauer = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

/** Spricht `text` und schreibt eine getrimmte WAV-Datei nach `datei`. Gibt die Dauer in s zurück. */
export async function sprich(text, datei, { stimme = STIMME, weise = SPRECHWEISE } = {}, versuch = 0) {
  await schluessel(); await modellListe();
  let j, res;
  for (let i = 0; i < 20; i++) {
    res = await fetch(`${BASIS}/${modelle[0]}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': keys[kNr], 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `### DIRECTOR'S NOTES\nStyle: ${weise}\nLanguage: German.\n\n#### TRANSCRIPT\n${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: stimme } } } }
      })
    });
    j = await res.json();
    if (res.ok && !j.candidates?.[0]?.content?.parts?.some((p) => p.inlineData)) continue;
    if (res.status !== 429) break;
    const warte = parseFloat(j.error?.details?.find((d) => d.retryDelay)?.retryDelay) || 30;
    if (warte > 120 && kNr < keys.length - 1) { kNr++; continue; }
    if (warte > 120 && modelle.length > 1) { modelle.shift(); kNr = 0; continue; }
    if (warte > 120) throw new Error('Gemini TTS: Tageskontingent leer');
    console.log(`  … Kontingent, warte ${Math.ceil(warte) + 2} s`);
    await new Promise((r) => setTimeout(r, (warte + 2) * 1000));
  }
  const teil = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!teil) throw new Error(`Gemini TTS ${res.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const daten = Buffer.from(teil.inlineData.data, 'base64');
  const istWav = daten.subarray(0, 4).toString('latin1') === 'RIFF';
  const roh = datei + (istWav ? '.roh.wav' : '.pcm');
  await writeFile(roh, daten);
  const rate = teil.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] || '24000';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...(istWav ? [] : ['-f', 's16le', '-ar', rate, '-ac', '1']), '-i', roh, '-af',
    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-ar', '48000', datei]);
  await unlink(roh);
  const d = dauer(datei);
  if (d > text.length / 15 * 2.6 + 1.5 && versuch < 2) { await unlink(datei); return sprich(text, datei, { stimme, weise }, versuch + 1); }
  return d;
}
