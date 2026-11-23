#!/usr/bin/env node
// IndexNow — meldet praxura.de-Seiten an Bing/Yandex/Seznam/Naver (23.11.2026).
//
// Warum: ChatGPT-Suche und Copilot stützen sich auf den Bing-Index. Neue oder
// geänderte Seiten (v. a. blog/) erscheinen dort so in Minuten statt Tagen.
// Google nutzt IndexNow NICHT — dort bleibt Search Console + sitemap.xml.
//
// Nur von Hand auf dem Entwicklerrechner, NACH dem Deploy (die Seite muss live
// sein, sonst holt der Crawler den alten Stand). Kein Runtime-Code, keine Box,
// kein Cron, keine env var. tools/ ist in .vercelignore.
//
//   node tools/indexnow.mjs --dry                  # nur anzeigen
//   node tools/indexnow.mjs                        # alle URLs aus sitemap.xml
//   node tools/indexnow.mjs https://praxura.de/blog/neu.html   # nur diese
//
// Schlüssel: die Datei <32 hex>.txt im Repo-Wurzelverzeichnis (öffentlich per
// Protokoll — beweist nur, dass wir die Domain kontrollieren, kein Geheimnis).

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const HOST = 'praxura.de';
export const ENDPOINT = 'https://api.indexnow.org/indexnow';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} xml @returns {string[]} */
export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
}

/** @param {string[]} files @returns {string} */
export function findKey(files) {
  const keys = files.filter(f => /^[0-9a-f]{32}\.txt$/.test(f));
  if (keys.length !== 1) throw new Error(`Genau eine IndexNow-Schlüsseldatei erwartet, gefunden: ${keys.length}`);
  return keys[0].slice(0, -4);
}

/** @param {string} key @param {string[]} urls */
export function payload(key, urls) {
  const fremd = urls.filter(u => new URL(u).host !== HOST);
  if (fremd.length) throw new Error(`Fremder Host: ${fremd.join(', ')}`);
  return { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls };
}

async function main(argv) {
  const dry = argv.includes('--dry');
  const explicit = argv.filter(a => !a.startsWith('--'));
  const key = findKey(readdirSync(ROOT));
  const urls = explicit.length ? explicit : sitemapUrls(readFileSync(join(ROOT, 'sitemap.xml'), 'utf8'));
  const body = payload(key, urls);

  console.log(`${urls.length} URL(s) → ${ENDPOINT}`);
  for (const u of urls) console.log(`  ${u}`);
  if (dry) return 0;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  // 200 = angenommen, 202 = angenommen, Schlüssel wird noch geprüft
  console.log(`HTTP ${res.status} ${res.statusText}`);
  if (res.status === 200 || res.status === 202) return 0;
  console.error(await res.text().catch(() => ''));
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(code => process.exit(code), err => { console.error(err.message); process.exit(1); });
}
