// Datum in Berlin + Auflösen eines Tagesinhalts (JSON + gerenderte Medien).
// Ein Tag = ein Inhalt: <inhalt>/<jahr>/<MM-TT>.json, Medien unter <medien>/<jahr>/<MM-TT>.mp4|.png|-N.png
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const fmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** { jahr: '2026', tag: '10-21', minuten: 735 } für einen Zeitpunkt, in Europe/Berlin (DST-sicher). */
export function berlin(d = new Date()) {
  const t = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  return { jahr: t.year, tag: `${t.month}-${t.day}`, minuten: Number(t.hour) * 60 + Number(t.minute) };
}

/** "12:15" → 735 */
export const minutenVon = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Berlin-Datum in n Tagen (Mittag als Anker, damit DST-Sprünge nicht den Tag verschieben). */
export function inTagen(n, d = new Date()) {
  const { jahr, tag } = berlin(d);
  const mittag = new Date(`${jahr}-${tag}T12:00:00Z`);
  return berlin(new Date(mittag.getTime() + n * 86400000));
}

async function existiert(p) { try { await stat(p); return true; } catch { return false; } }

/** Lädt JSON + Medienliste eines Tages. Gibt null zurück, wenn es für den Tag keinen Inhalt gibt. */
export async function ladeTag(inhaltDir, medienDir, jahr, tag) {
  const json = path.join(inhaltDir, jahr, `${tag}.json`);
  if (!await existiert(json)) return null;
  const inhalt = JSON.parse(await readFile(json, 'utf8'));
  const basis = path.join(medienDir, jahr, tag);
  const fehlt = [];
  let medien;
  if (inhalt.art === 'video') {
    const datei = `${basis}.mp4`;
    if (!await existiert(datei)) fehlt.push(datei);
    medien = { art: 'video', datei, cover: `${basis}-cover.jpg`, coverMs: Math.round((inhalt.coverBei ?? 1.2) * 1000) };
  } else {
    const n = inhalt.seiten ? inhalt.seiten.length : 0;
    const dateien = n ? [...Array(n)].map((_, i) => `${basis}-${i + 1}.png`) : [`${basis}.png`];
    for (const d of dateien) if (!await existiert(d)) fehlt.push(d);
    medien = { art: dateien.length > 1 ? 'karussell' : 'bild', dateien };
  }
  const caption = (inhalt.caption || '').trim();
  if (!caption) fehlt.push('caption');
  return { jahr, tag, caption, medien, fehlt, hook: caption.split('\n')[0] };
}
