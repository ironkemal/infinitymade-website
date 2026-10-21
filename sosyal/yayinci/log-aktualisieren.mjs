// Überträgt den Server-Zustand ins Produktionslog: Spalte „Durum" → Yayında + Link, „Sonuç (7 gün)" → Kennzahlen.
// Aufruf: bash sosyal/yayinci/bericht.sh   (holt zustand.json vom merkez-VPS und ruft dieses Skript)
//         node sosyal/yayinci/log-aktualisieren.mjs <zustand.json> [SOSYAL-LOG.md]
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { kennzahlText } from './yayinci.mjs';

/** Gibt den neuen Log-Text und die Zahl geänderter Zeilen zurück. Reine Funktion. */
export function aktualisiere(logText, zustand) {
  const nachTag = {};
  for (const [key, t] of Object.entries(zustand.tage || {})) nachTag[key.slice(5)] = t;
  let geaendert = 0;
  const zeilen = logText.split('\n').map(zeile => {
    const m = zeile.match(/^\| (\d{2}-\d{2}) \|/);
    if (!m || !nachTag[m[1]]) return zeile;
    const zellen = zeile.split('|').slice(1, -1).map(z => z.trim());
    if (zellen.length < 8) return zeile;
    const t = nachTag[m[1]], ig = t.instagram || {}, fb = t.facebook || {};
    let durum = zellen[6];
    if (ig.id || fb.id) {
      const links = [ig.link && `[IG](${ig.link})`, fb.id && 'FB'].filter(Boolean).join(' ');
      durum = `Yayında${links ? ` ${links}` : ''}`;
    } else if (ig.fehler || fb.fehler) durum = 'Hata';
    const sonuc = ig.kennzahlen ? kennzahlText(ig.kennzahlen) : zellen[7];
    if (durum === zellen[6] && sonuc === zellen[7]) return zeile;
    geaendert++;
    zellen[6] = durum; zellen[7] = sonuc;
    return `| ${zellen.join(' | ')} |`;
  });
  return { text: zeilen.join('\n'), geaendert };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [zustandDatei, logDatei = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'SOSYAL-LOG.md')] = process.argv.slice(2);
  const zustand = JSON.parse(await readFile(zustandDatei, 'utf8'));
  const { text, geaendert } = aktualisiere(await readFile(logDatei, 'utf8'), zustand);
  if (geaendert) await writeFile(logDatei, text);
  console.log(`✓ ${geaendert} Zeile(n) in ${path.basename(logDatei)} aktualisiert`);
}
