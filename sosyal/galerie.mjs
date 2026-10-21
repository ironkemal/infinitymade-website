// Prüfgalerie: alle Tage eines Jahres auf einer Seite (Video/Bild + Caption), zum Durchsehen vor der Freigabe.
// Aufruf: node sosyal/galerie.mjs [jahr]  → sosyal/ausgabe/<jahr>/galerie.html
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const hier = path.dirname(fileURLToPath(import.meta.url));
const jahr = process.argv[2] || String(new Date().getFullYear());
const ausgabe = path.join(hier, 'ausgabe', jahr);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

const tage = (await readdir(path.join(hier, jahr))).filter(f => f.endsWith('.json')).sort();
const karten = [];
for (const f of tage) {
  const tag = f.replace('.json', '');
  const d = JSON.parse(await readFile(path.join(hier, jahr, f), 'utf8'));
  let medien = '';
  if (d.art === 'video') {
    medien = `<video src="${tag}.mp4" poster="${tag}-cover.jpg" controls preload="none" playsinline></video>`;
  } else {
    const n = d.seiten ? d.seiten.length : 0;
    const bilder = n ? [...Array(n)].map((_, i) => `${tag}-${i + 1}.png`) : [`${tag}.png`];
    medien = `<div class="bilder">${bilder.map(b => `<img src="${b}" loading="lazy">`).join('')}</div>`;
  }
  const fehlt = d.art === 'video' ? !existsSync(path.join(ausgabe, `${tag}.mp4`)) : false;
  karten.push(`<article><header><b>${tag}</b><span>${d.art === 'video' ? 'Video' : (d.seiten ? 'Carousel' : 'Post')}</span>${fehlt ? '<em>noch nicht gerendert</em>' : ''}</header>
    ${medien}<pre>${esc(d.caption)}</pre></article>`);
}

await writeFile(path.join(ausgabe, 'galerie.html'), `<!doctype html><html lang="de"><meta charset="utf-8">
<title>Praxura Social ${jahr}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;background:#F8F3E8;color:#1A1611;font:15px/1.45 system-ui,sans-serif}
  h1{font:400 34px Georgia,serif;margin:28px 24px 4px} p.i{margin:0 24px 20px;color:#685E52}
  main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;padding:0 24px 40px}
  article{background:#FFFEFB;border:1px solid rgba(26,22,17,.1);border-radius:10px;overflow:hidden}
  header{display:flex;gap:10px;align-items:center;padding:10px 14px;font-family:monospace}
  header span{color:#6B5538} header em{color:#9C3A3A;font-style:normal;margin-left:auto}
  video,img{display:block;width:100%;background:#1E3D2F}
  .bilder{display:flex;overflow-x:auto;scroll-snap-type:x mandatory} .bilder img{flex:0 0 100%;scroll-snap-align:start}
  pre{white-space:pre-wrap;font:13px/1.45 system-ui,sans-serif;margin:0;padding:12px 14px;color:#4A4036}
</style>
<h1>Praxura Social · ${jahr}</h1><p class="i">${tage.length} Tage · ein Tag = ein Inhalt · Carousel: seitlich wischen</p>
<main>${karten.join('\n')}</main></html>`);
console.log(`✓ ${path.join(ausgabe, 'galerie.html')} (${tage.length} Tage)`);
