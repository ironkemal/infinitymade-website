import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path'; import { tmpdir } from 'node:os';
const env = readFileSync('sosyal/yayinci/.env', 'utf8'); const key = (env.match(/^GEMINI_API_KEY=\s*"?([^"\r\n]+)/m) || [])[1] || process.env.GEMINI_API_KEY;
const dir = join(tmpdir(), 'praxura-tts-cache');
const files = readdirSync(dir).map(f => join(dir, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
for (const f of files) {
  const b64 = readFileSync(f).toString('base64');
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data: b64 } }, { text: 'Transkribiere exakt Wort für Wort, inklusive Wiederholungen und Versprecher. Nur der Text.' }] }] }) });
  const j = await r.json(); console.log(f.slice(-12, -4), '|', (j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || JSON.stringify(j.error)).trim());
}
