// Sperre gegen "Modul unter zwei URLs in einer Seite" (signal.js-Klasse, 30.09.2026).
// Dieselbe Moduldatei mit zwei verschiedenen ?v=-Strings im Importgraphen EINER
// HTML-Seite wird vom Browser zweimal geladen: Modulzustand (Listener, Supabase-
// Client, Registries, Caches) ist dann nicht geteilt. Die Pruefung baut je
// HTML-Seite den Graphen (statische + dynamische Importe mit Stringliteral)
// und schlaegt fehl, wenn eine Datei unter >1 URL erreichbar ist.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RE_STATIC = /(?:^|[;\s}])(?:import|export)\s*(?:[^'"`;()]*?\sfrom\s*)?(['"])([^'"\n]+)\1/g;
const RE_DYN = /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

export function specifiers(src) {
  const s = stripComments(src);
  const out = [];
  for (const re of [RE_STATIC, RE_DYN]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) out.push(m[2]);
  }
  return out;
}

// URL-Identitaet relativ zur Wurzel: "/pfad/datei.js?v=1"
function resolveUrl(spec, fromUrl) {
  if (/^(https?:)?\/\//.test(spec) || spec.startsWith('data:')) return null;
  if (!/^(\.{0,2}\/|[^:]*\.m?js)/.test(spec)) return null; // bare specifier
  const base = new URL(fromUrl, 'http://x');
  const u = new URL(spec, base);
  return u.pathname + u.search;
}

export function htmlEntries(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!/type\s*=\s*["']module["']/i.test(m[1])) continue;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[1]);
    if (src) out.push({ url: src[1] });
    else out.push({ inline: m[2] });
  }
  return out;
}

export function buildPage(htmlFile, readFile = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')) {
  const pageUrl = '/' + htmlFile;
  const html = readFile(htmlFile);
  const byFile = new Map(); // dateipfad -> Set(url)
  const seen = new Set();
  const add = (url) => {
    const file = url.split('?')[0];
    if (!byFile.has(file)) byFile.set(file, new Set());
    byFile.get(file).add(url);
  };
  const visit = (url) => {
    if (seen.has(url)) return;
    seen.add(url);
    add(url);
    let src;
    try { src = readFile(url.split('?')[0].replace(/^\//, '')); } catch { return; }
    for (const spec of specifiers(src)) {
      const u = resolveUrl(spec, url);
      if (u && /\.m?js$/.test(u.split('?')[0])) visit(u);
    }
  };
  for (const e of htmlEntries(html)) {
    if (e.url) {
      const u = resolveUrl(e.url, pageUrl);
      if (u) visit(u);
    } else {
      for (const spec of specifiers(e.inline)) {
        const u = resolveUrl(spec, pageUrl);
        if (u) visit(u);
      }
    }
  }
  const dups = {};
  for (const [file, urls] of byFile) if (urls.size > 1) dups[file] = [...urls].sort();
  return dups;
}

const SKIP = new Set(['archive', 'ops', 'blog', 'onprem', 'node_modules']);

export function htmlFiles() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !SKIP.has(f));
}

test('Modulgraph: keine Datei unter zwei URLs in einer Seite', () => {
  const problems = [];
  for (const f of htmlFiles()) {
    const d = buildPage(f);
    for (const [file, urls] of Object.entries(d)) problems.push(`${f}: ${file} -> ${urls.join(' | ')}`);
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'));
});

test('Selbsttest: erkennt Doppel-Version (signal.js-Fall)', () => {
  const files = {
    'p.html': '<script type="module" src="a.js?v=1"></script>',
    'a.js': "import './module/s.js?v=1'; import './b.js?v=1';",
    'b.js': "import { x } from './module/s.js?v=2';\nexport const y = 1;",
    'module/s.js': 'export const x = 1;',
  };
  const d = buildPage('p.html', (p) => { if (!(p in files)) throw new Error('nf'); return files[p]; });
  assert.deepEqual(d, { '/module/s.js': ['/module/s.js?v=1', '/module/s.js?v=2'] });
});

test('Selbsttest: gleiche Version + dynamischer Import ok', () => {
  const files = {
    'p.html': '<script type="module">import("./a.js?v=1")</script>',
    'a.js': "export * from './s.js?v=1'; const m = await import('./s.js?v=1');",
    's.js': '',
  };
  assert.deepEqual(buildPage('p.html', (p) => files[p]), {});
});
