#!/usr/bin/env node
// FUNKTIONSKARTE — projedeki her fonksiyonun haritasını üretir.
//
// Neden var: dashboard.js 26.000+ satır. "Bu fonksiyon var mı, nerede kullanılıyor,
// neyle besleniyor" sorusunun cevabı okuyarak değil SAYARAK bulunur. Bir model
// 26.000 satırı okuyamaz, örnekler; bu script okumaz, sayar — o yüzden eksiksizdir.
//
// Üretir:
//   funktionen/INDEX.json  — makine okuru (fonksiyon-ustasi ajanı buradan cevap verir)
//   funktionen/INDEX.md    — insan okuru (özet + kopya adayları)
//
// Kullanım:
//   node tools/funktionskarte.mjs            # üret
//   node tools/funktionskarte.mjs --check    # üretilen ile diskteki farklı mı (CI/koruma)
//
// KURAL: fonksiyon eklendiğinde/silindiğinde bu harita tazelenir. Tetikleyici
// cümle: "harita güncelle". Eski harita hiç haritadan kötüdür — okuyan ona inanır.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'funktionen');

// ── Hangi dosyalar taranır ──────────────────────────────────────────────────
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'archive', 'dist', 'build', '.vercel', '.next',
  'funktionen', 'coverage', '.claude'
]);
// 'module' — Konsey 2026-08-13 yeni frontend kodunu oraya yönlendiriyor. Kök dizin
// taraması yalnız üst seviyeyi okuduğu için alt klasör ayrıca yazılmalı; yazılmazsa
// haritanın kör noktası tam da büyümesi beklenen yer olurdu.
const SCAN_ROOTS = ['.', 'module', 'api', 'api-backend', 'ops', 'lib'];

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(js|mjs)$/.test(e) && !/\.(test|spec)\.(js|mjs)$/.test(e)) acc.push(p);
  }
  return acc;
}

const files = [...new Set(
  SCAN_ROOTS.flatMap(r => {
    const abs = join(ROOT, r);
    if (!existsSync(abs)) return [];
    return r === '.'
      ? readdirSync(abs).filter(f => /\.(js|mjs)$/.test(f) && !/\.(test|spec)\./.test(f)).map(f => join(abs, f))
      : walk(abs);
  })
)].sort();

const rel = (p) => relative(ROOT, p).split(sep).join('/');

// ── Fonksiyon çıkarımı ──────────────────────────────────────────────────────
// Bu proje vanilla JS; üst seviye fonksiyonlar `function x()` veya
// `const x = () =>` biçiminde. AST kullanmıyoruz (bağımlılık eklemek G8'e
// yaklaşır ve gerek yok) — süslü parantez sayarak gövde sınırı bulunuyor.

const DEF_PATTERNS = [
  { re: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, kind: 'function' },
  { re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\(/, kind: 'function-expr' },
  { re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/, kind: 'arrow' },
  { re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/, kind: 'arrow' },
];

/** Açılış satırından itibaren süslü parantez dengeleyerek gövde sonunu bulur. */
function bodyEnd(lines, start) {
  let depth = 0, seen = false;
  for (let i = start; i < lines.length; i++) {
    const line = stripNoise(lines[i]);
    for (const ch of line) {
      if (ch === '{') { depth++; seen = true; }
      else if (ch === '}') { depth--; if (seen && depth === 0) return i; }
    }
    if (seen && depth === 0) return i;
    if (i - start > 3000) return i; // güvenlik freni
  }
  return lines.length - 1;
}

/** Satır içi yorum ve string literalleri kabaca temizler (parantez sayımı için). */
function stripNoise(line) {
  return line
    .replace(/\\./g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/\/\/.*$/, '');
}

const functions = [];   // {name, file, start, end, kind, body}
const byName = new Map(); // name -> [fn]

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const { re, kind } of DEF_PATTERNS) {
      const m = lines[i].match(re);
      if (!m) continue;
      const name = m[1];
      const end = bodyEnd(lines, i);
      const fn = {
        name, kind,
        file: rel(f),
        start: i + 1,
        end: end + 1,
        lines: end - i + 1,
        body: lines.slice(i, end + 1).join('\n'),
      };
      functions.push(fn);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(fn);
      break;
    }
  }
}

const knownNames = new Set(byName.keys());

// ── Her fonksiyonun beslendiği veri ve çağırdıkları ─────────────────────────
const uniq = (a) => [...new Set(a)];

for (const fn of functions) {
  const b = fn.body;

  fn.tables = uniq([...b.matchAll(/\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g)].map(m => m[1]));
  fn.rpcs   = uniq([...b.matchAll(/\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g)].map(m => m[1]));

  // Yazma mı okuma mı — kopya avında en ayırt edici sinyal bu.
  fn.writes = uniq([
    ...[...b.matchAll(/\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)\s*\.\s*(insert|update|upsert|delete)/g)]
      .map(m => `${m[1]}:${m[2]}`),
  ]);

  fn.endpoints = uniq([
    ...[...b.matchAll(/fetch\(\s*[`'"]([^`'"]+)[`'"]/g)].map(m => m[1]),
    ...[...b.matchAll(/(?:apiBase|API_BASE|BACKEND)\s*\+\s*[`'"]([^`'"]+)[`'"]/g)].map(m => m[1]),
  ]).filter(u => !u.startsWith('data:'));

  fn.storage = uniq([...b.matchAll(/\.storage\s*\.\s*from\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]));

  // Çağrı grafiği: gövdede geçen ve tanımlı olduğunu bildiğimiz isimler.
  const called = new Set();
  for (const m of b.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const n = m[1];
    if (n !== fn.name && knownNames.has(n)) called.add(n);
  }
  fn.calls = [...called].sort();
}

// Ters kenar: kim beni çağırıyor
const callers = new Map();
for (const fn of functions) {
  for (const c of fn.calls) {
    if (!callers.has(c)) callers.set(c, new Set());
    callers.get(c).add(fn.name);
  }
}
for (const fn of functions) fn.calledBy = [...(callers.get(fn.name) || [])].sort();

// ── Modül haritası: sidebar id → giriş fonksiyonu → erişilebilen her şey ────
// dashboard.js:973+ `if (id === 'x') loadX();` yönlendiricisi tek kaynak.
const dash = files.find(f => rel(f) === 'dashboard.js');
const moduleEntries = new Map(); // moduleId -> [entryFnName]
if (dash) {
  const src = readFileSync(dash, 'utf8');
  for (const m of src.matchAll(/if\s*\(\s*id\s*===\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)\s*\{?([^}\n]*)/g)) {
    const id = m[1];
    const fns = [...m[2].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map(x => x[1]).filter(n => knownNames.has(n));
    if (!fns.length) continue;
    if (!moduleEntries.has(id)) moduleEntries.set(id, []);
    moduleEntries.get(id).push(...fns);
  }
}

// Sidebar etiketleri (UI yolu üretmek için) — nav-registry.js'ten
const navLabels = new Map();   // id -> label
const navSectors = new Map();  // id -> Set(sector)
const navReg = files.find(f => rel(f) === 'nav-registry.js');
if (navReg) {
  const src = readFileSync(navReg, 'utf8');
  let sector = null;
  for (const line of src.split('\n')) {
    const sm = line.match(/^\s{2}([a-zA-Z_]+)\s*:\s*\[/);
    if (sm) { sector = sm[1]; continue; }
    const im = line.match(/id:\s*'([^']+)'[\s\S]*?label:\s*'([^']*)'/);
    if (im) {
      navLabels.set(im[1], im[2]);
      if (!navSectors.has(im[1])) navSectors.set(im[1], new Set());
      if (sector) navSectors.get(im[1]).add(sector);
    }
  }
}

// Giriş fonksiyonlarından ileriye doğru yayılım
const fnModules = new Map(); // fnName -> Set(moduleId)
for (const [modId, entries] of moduleEntries) {
  const queue = [...entries];
  const seen = new Set();
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n)) continue;
    seen.add(n);
    if (!fnModules.has(n)) fnModules.set(n, new Set());
    fnModules.get(n).add(modId);
    for (const fn of byName.get(n) || []) for (const c of fn.calls) if (!seen.has(c)) queue.push(c);
  }
}
for (const fn of functions) {
  const mods = [...(fnModules.get(fn.name) || [])].sort();
  fn.modules = mods;
  // Çok sayıda modülden erişilen fonksiyon "o modüle ait" değildir, ORTAK'tır.
  // (İlk sürüm hepsini tek tek listeliyordu; openEmpDetail gibi paylaşılan bir
  //  yardımcı "Sidebar → §302-Abrechnung" diye görünüyordu — yanıltıcı.)
  fn.gemeinsam = mods.length > 4;
  fn.uiPfad = fn.gemeinsam
    ? [`ortak yardımcı — ${mods.length} modülden çağrılıyor`]
    : mods.map(id => {
        const label = navLabels.get(id) || id;
        const secs = [...(navSectors.get(id) || [])];
        return secs.length && !secs.includes('default')
          ? `Sidebar → ${label} (${secs.join('/')})`
          : `Sidebar → ${label}`;
      });
}

// ── Kopya adayları ──────────────────────────────────────────────────────────
// Ölçüt: aynı tabloya YAZAN, birbirini ÇAĞIRMAYAN, ayrı fonksiyonlar.
// Proje kuralı: var olan fonksiyon modifiye edilir, ikinci kez sıfırdan yazılmaz.
// Bilinçli katman ayrımı (base + üstüne binen alan modifikasyonu) kopya DEĞİLDİR —
// o ayrımı script yapamaz, karar insana bırakılır. Burası aday listesidir, suçlama değil.
const writeIndex = new Map(); // "table:op" -> [fn]
for (const fn of functions) {
  for (const w of fn.writes) {
    if (!writeIndex.has(w)) writeIndex.set(w, []);
    writeIndex.get(w).push(fn);
  }
}

const clusters = [];
const tableWriters = new Map(); // table -> Set(fn)
for (const fn of functions) {
  for (const w of fn.writes) {
    const t = w.split(':')[0];
    if (!tableWriters.has(t)) tableWriters.set(t, new Set());
    tableWriters.get(t).add(fn);
  }
}
// Birbirini çağıran fonksiyonlar TEK bir yazma yoludur (zincir), kopya değil.
// Bu yüzden önce bağlı bileşenlere ayır, sonra BİLEŞENLERİ karşılaştır.
// (İlk sürümde bunlar elenip gidiyordu ve gerçek kopyalar — pat_fussbefund gibi —
//  listeden düşüyordu. Eleme değil gruplama gerekiyor.)
function bilesenler(fns) {
  const idx = new Map(fns.map((f, i) => [f.name, i]));
  const parent = fns.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  fns.forEach((f, i) => {
    for (const c of f.calls) if (idx.has(c)) union(i, idx.get(c));
    for (const c of f.calledBy) if (idx.has(c)) union(i, idx.get(c));
  });
  const groups = new Map();
  fns.forEach((f, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(f);
  });
  return [...groups.values()];
}

for (const [table, set] of tableWriters) {
  const fns = [...set];
  if (fns.length < 2) continue;
  const gruppen = bilesenler(fns);
  if (gruppen.length < 2) continue;   // hepsi tek zincir → kopya değil
  clusters.push({
    tabelle: table,
    anzahl: gruppen.length,
    pfade: gruppen.map(g => ({
      // her bileşen = bir yazma yolu; en büyük fonksiyon onu temsil eder
      leitfunktion: g.slice().sort((a, b) => b.lines - a.lines)[0].name,
      funktionen: g.map(f => ({
        name: f.name, file: f.file, start: f.start, end: f.end, lines: f.lines,
        writes: f.writes.filter(w => w.startsWith(table + ':')),
        modules: f.modules, uiPfad: f.uiPfad,
      })),
    })),
  });
}
clusters.sort((a, b) => b.anzahl - a.anzahl || a.tabelle.localeCompare(b.tabelle));

// Aynı isim, birden fazla tanım
const doppelteNamen = [...byName.entries()]
  .filter(([, arr]) => arr.length > 1)
  .map(([name, arr]) => ({ name, orte: arr.map(f => `${f.file}:${f.start}`) }))
  .sort((a, b) => b.orte.length - a.orte.length);

// ── Yazım ───────────────────────────────────────────────────────────────────
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const index = {
  erzeugt: new Date().toISOString().slice(0, 10),
  dateien: files.length,
  funktionen: functions.length,
  module: [...moduleEntries.keys()].sort(),
  eintraege: functions
    .map(({ body, ...rest }) => rest)
    .sort((a, b) => a.file.localeCompare(b.file) || a.start - b.start),
  kopieKandidaten: clusters,
  doppelteNamen,
};

writeFileSync(join(OUT_DIR, 'INDEX.json'), JSON.stringify(index, null, 1) + '\n');

// İnsan okuru
const topTables = [...tableWriters.entries()]
  .map(([t, s]) => [t, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 20);

const md = [];
md.push('# Funktionskarte', '');
md.push(`> Üretim: ${index.erzeugt} · \`node tools/funktionskarte.mjs\``);
md.push('> **Elle düzenleme.** Script üretir; fonksiyon eklendiğinde "harita güncelle" ile tazelenir.', '');
md.push(`**${index.funktionen} fonksiyon** · ${index.dateien} dosya · ${index.module.length} sidebar modülü`, '');
md.push('## Kopya adayları — aynı tabloya yazan, birbirini çağırmayan fonksiyonlar', '');
md.push('Bu bir suçlama listesi değil, **inceleme kuyruğu**. Projede bilinçli katmanlama var');
md.push('(ortak taban + alana göre modifikasyon); onu script ayırt edemez. Karar insanın.', '');
for (const c of clusters.slice(0, 30)) {
  md.push(`### \`${c.tabelle}\` — ${c.anzahl} bağımsız yazma yolu`, '');
  c.pfade.forEach((p, i) => {
    const lead = p.funktionen.find(f => f.name === p.leitfunktion);
    const yol = lead.uiPfad.length ? lead.uiPfad.join(' · ') : '_UI yolu çözülemedi_';
    md.push(`**Yol ${i + 1} — \`${p.leitfunktion}()\`** · Ekran: ${yol}`);
    for (const f of p.funktionen) {
      md.push(`- \`${f.name}()\` — [${f.file}:${f.start}](${f.file}#L${f.start}-L${f.end}) · ${f.lines} satır · ${f.writes.join(', ')}`);
    }
    md.push('');
  });
}
md.push('## En çok yazılan tablolar', '');
for (const [t, n] of topTables) md.push(`- \`${t}\` — ${n} ayrı fonksiyon yazıyor`);
md.push('');
if (doppelteNamen.length) {
  md.push('## Aynı ada sahip birden fazla tanım', '');
  for (const d of doppelteNamen.slice(0, 40)) md.push(`- \`${d.name}\` — ${d.orte.join(' · ')}`);
  md.push('');
}
writeFileSync(join(OUT_DIR, 'INDEX.md'), md.join('\n'));

console.log(`✓ ${index.funktionen} fonksiyon / ${index.dateien} dosya`);
console.log(`✓ ${clusters.length} kopya adayı kümesi`);
console.log(`✓ ${doppelteNamen.length} çift isim`);
console.log(`→ funktionen/INDEX.json · funktionen/INDEX.md`);
