// Einmalige Umplanung (Kemal 25.11.2026): Black Week + Cyber Week statt der Premium-Reihe, danach weiter, wo sie war.
//   11-26, 11-27 Black Week (F31, F32) · 11-28, 11-29 Cyber Week (F33, F34)
//   Premium-Reihe aus umplanen-2026-11-25.mjs rückt nach: 11-30 … 12-13, 12-06 (Nikolaus) bleibt.
//   Die bisherigen Inhalte von 12-10 … 12-13 hängen hinten an 2027 an (Reihenfolge gleich, Medien wandern mit).
// Voraussetzung: _muster/F31–F34 gerendert (node sosyal/erzeuge.mjs sosyal/_muster/F31-black-week.json …).
// Aufruf aus der Repo-Wurzel: node sosyal/umplanen-2026-11-26.mjs
import { existsSync, readdirSync, renameSync, copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const S = 'sosyal', A = 'sosyal/ausgabe';
const PLAN = [
  ['11-26', 'F31-black-week'], ['11-27', 'F32-black-friday'], ['11-28', 'F33-cyber-week'], ['11-29', 'F34-cyber-sonntag'],
  ['11-30', 'F9-knete'], ['12-01', 'F10-produktfilm'], ['12-02', 'F7-museum'], ['12-03', 'F12-fristen'],
  ['12-04', 'F8-doku'], ['12-05', 'F13-beruf-gewaehlt'], ['12-07', 'F4-warteschleife'], ['12-08', 'F11-befund'],
  ['12-09', 'F5-gekuendigt'], ['12-10', 'F15-therapiebericht'], ['12-11', 'F3-legende'], ['12-12', 'F16-podo-pause'],
  ['12-13', 'F6-beruf']
];
// optional: nur bestimmte Tage (z. B. `node … 11-26`), damit fertige Videos sofort eingeplant werden können
const nur = process.argv.slice(2);
if (nur.length) PLAN.splice(0, PLAN.length, ...PLAN.filter(([t]) => nur.includes(t)));
for (const [, m] of PLAN) if (!existsSync(`${A}/_muster/${m}.mp4`)) throw new Error(`fehlt: ${A}/_muster/${m}.mp4`);

const tage27 = readdirSync(`${S}/2027`).filter((f) => /^\d\d-\d\d\.json$/.test(f)).map((f) => f.slice(0, 5)).sort();
let d = new Date(Date.UTC(2027, Number(tage27.at(-1).slice(0, 2)) - 1, Number(tage27.at(-1).slice(3))));
const naechster = () => { d = new Date(d.getTime() + 864e5); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
mkdirSync(`${A}/2027`, { recursive: true });
const medien = (tag) => readdirSync(`${A}/2026`).filter((f) => f.startsWith(tag + '.') || f.startsWith(tag + '-'));
const verschoben = [];
for (const [tag, muster] of PLAN) {
  const alt = `${S}/2026/${tag}.json`;
  if (existsSync(alt)) {
    const j = JSON.parse(readFileSync(alt, 'utf8'));
    if (j.quelleMuster) {
      // schon ein Premium-Video aus der Umplanung vom 25.11. → einfach ersetzen
      for (const f of medien(tag)) rmSync(`${A}/2026/${f}`);
    } else {
      const neu = naechster();
      execFileSync('git', ['mv', alt, `${S}/2027/${neu}.json`]);
      for (const f of medien(tag)) renameSync(`${A}/2026/${f}`, `${A}/2027/${neu}${f.slice(5)}`);
      verschoben.push(`${tag} → 2027-${neu}`);
    }
  }
  const j = JSON.parse(readFileSync(`${S}/_muster/${muster}.json`, 'utf8'));
  j.quelleMuster = muster;
  writeFileSync(alt, JSON.stringify(j, null, 2) + '\n');
  copyFileSync(`${A}/_muster/${muster}.mp4`, `${A}/2026/${tag}.mp4`);
  if (existsSync(`${A}/_muster/${muster}-stumm.mp4`)) copyFileSync(`${A}/_muster/${muster}-stumm.mp4`, `${A}/2026/${tag}-stumm.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(j.coverBei ?? 1.8), '-i', `${A}/2026/${tag}.mp4`, '-frames:v', '1', '-q:v', '3', `${A}/2026/${tag}-cover.jpg`]);
  writeFileSync(`${A}/2026/${tag}.txt`, (j.caption || '').trim() + '\n');
  console.log(`${tag}  ${muster}`);
}
console.log('\nNach hinten verschoben:\n  ' + (verschoben.join('\n  ') || '—'));
