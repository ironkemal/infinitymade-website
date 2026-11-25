// Einmalige Umplanung (Kemal 25.11.2026): „Erst die hochwertigen Videos, auch die witzigen — ab morgen."
// Premium-Videos aus _muster (fertig gerendert, mit Stimme) belegen 11-26 … 12-09 (12-06 Nikolaus bleibt).
// Verdrängte Tage hängen in Originalreihenfolge hinten an (nach dem letzten 2027-Tag). Medien wandern mit.
// Nicht eingeplant: F14 + F17 (sagen „läuft ohne Internet"/„Rechner in Ihrer Praxis" → widerspricht Praxis-Cloud, neu sprechen).
import { existsSync, readdirSync, renameSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const S = 'sosyal', A = 'sosyal/ausgabe';
const PLAN = [ // [Tag 2026, Muster]
  ['11-26', 'F9-knete'], ['11-27', 'F10-produktfilm'], ['11-28', 'F7-museum'], ['11-29', 'F12-fristen'],
  ['11-30', 'F8-doku'], ['12-01', 'F13-beruf-gewaehlt'], ['12-02', 'F4-warteschleife'], ['12-03', 'F11-befund'],
  ['12-04', 'F5-gekuendigt'], ['12-05', 'F15-therapiebericht'], ['12-07', 'F3-legende'], ['12-08', 'F16-podo-pause'],
  ['12-09', 'F6-beruf']
];
// nächster freier Tag in 2027 nach dem letzten belegten
const tage27 = readdirSync(`${S}/2027`).filter((f) => /^\d\d-\d\d\.json$/.test(f)).map((f) => f.slice(0, 5)).sort();
let d = new Date(Date.UTC(2027, Number(tage27.at(-1).slice(0, 2)) - 1, Number(tage27.at(-1).slice(3))));
const naechster = () => { d = new Date(d.getTime() + 864e5); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
mkdirSync(`${A}/2027`, { recursive: true });
const verschoben = [];
for (const [tag, muster] of PLAN) {
  // 1. bisherigen Inhalt nach hinten
  const alt = `${S}/2026/${tag}.json`;
  if (existsSync(alt)) {
    const neu = naechster();
    execFileSync('git', ['mv', alt, `${S}/2027/${neu}.json`]);
    for (const f of readdirSync(`${A}/2026`).filter((f) => f.startsWith(tag + '.') || f.startsWith(tag + '-')))
      renameSync(`${A}/2026/${f}`, `${A}/2027/${neu}${f.slice(5)}`);
    verschoben.push(`${tag} → 2027-${neu}`);
  }
  // 2. Premium-Video einsetzen
  const j = JSON.parse(readFileSync(`${S}/_muster/${muster}.json`, 'utf8'));
  j.quelleMuster = muster;
  writeFileSync(alt, JSON.stringify(j, null, 2) + '\n');
  copyFileSync(`${A}/_muster/${muster}.mp4`, `${A}/2026/${tag}.mp4`);
  if (existsSync(`${A}/_muster/${muster}-stumm.mp4`)) copyFileSync(`${A}/_muster/${muster}-stumm.mp4`, `${A}/2026/${tag}-stumm.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(j.coverBei ?? 1.8), '-i', `${A}/2026/${tag}.mp4`, '-frames:v', '1', '-q:v', '3', `${A}/2026/${tag}-cover.jpg`]);
  writeFileSync(`${A}/2026/${tag}.txt`, (j.caption || '').trim() + '\n');
  console.log(`${tag}  ${muster}`);
}
console.log('\nNach hinten verschoben:\n  ' + verschoben.join('\n  '));
