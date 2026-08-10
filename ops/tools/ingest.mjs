#!/usr/bin/env node
// Claude'un yazma kanalı — toplantı notundan çıkan görevleri Board'a basar.
//
// Neden ayrı bir script: dashboard tarayıcıda oturum açmış bir insana bağlı.
// Ben oturum açamam. Bu script service-role anahtarıyla doğrudan PostgREST'e
// yazar, anahtar depoya girmez (ops/.env.ops → .gitignore'da).
//
// Kullanım:
//   node ops/tools/ingest.mjs --meeting 2026-08-08 --file notes.md
//   node ops/tools/ingest.mjs --json tasks.json
//   node ops/tools/ingest.mjs --file launch.md --category Launch
//   node ops/tools/ingest.mjs --meeting 2026-08-08 --file notes.md --dry
//
// notes.md formatı — her satır bir görev:
//   - [Kemal] Stripe Enterprise price ID oluştur !hoch
//   - [Melih] Podoloji ekranını gözden geçir
//   - [] Ortak: sözleşme taslağını oku          ← köşeli parantez boşsa havuz
//
// tasks.json formatı: [{ "title": "...", "assignee": "Kemal", "priority": "hoch",
//                        "notes": "...", "category": "Podoloji", "parent": "üst görevin başlığı" }]
// "parent" verilirse kart o üst görevin altına açılır (iki seviye; şema üçüncüyü reddeder).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env.ops');

function loadEnv() {
  let raw;
  try { raw = readFileSync(envPath, 'utf8'); }
  catch { die(`${envPath} yok. .env.ops.example'ı kopyalayıp doldur.`); }
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    die('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env.ops içinde olmalı.');
  return env;
}

const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? fallback : (process.argv[i + 1]?.startsWith('--') ? true : process.argv[i + 1]);
};

const env = loadEnv();
const dry = process.argv.includes('--dry');

async function api(path, opts = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...opts.headers
    }
  });
  const text = await r.text();
  if (!r.ok) die(`${r.status} ${path} → ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── Görevleri ayrıştır ──────────────────────────────────────────────────

function parseMarkdown(src) {
  const out = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*[-*]\s+(?:\[([^\]]*)\]\s*)?(.+?)\s*$/);
    if (!m) continue;
    let title = m[2];
    let priority = 'normal';
    const p = title.match(/\s*!(hoch|normal|niedrig)\s*$/i);
    if (p) { priority = p[1].toLowerCase(); title = title.slice(0, p.index).trim(); }
    if (!title) continue;
    out.push({ title, assignee: (m[1] || '').trim() || null, priority });
  }
  return out;
}

const meetingDate = arg('meeting');
const fileArg = arg('file');
const jsonArg = arg('json');

let tasks;
if (jsonArg) tasks = JSON.parse(readFileSync(jsonArg, 'utf8'));
else if (fileArg) tasks = parseMarkdown(readFileSync(fileArg, 'utf8'));
else die('--file veya --json ver.');

if (!tasks.length) die('Görev bulunamadı.');

// ── Üye adı → id ────────────────────────────────────────────────────────

const members = await api('ops_members?select=id,display_name');
const byName = new Map(members.map(m => [m.display_name.toLowerCase(), m.id]));

const rows = tasks.map(t => {
  const key = (t.assignee || '').toLowerCase();
  if (key && !byName.has(key)) die(`"${t.assignee}" ops_members'ta yok. Mevcut: ${members.map(m => m.display_name).join(', ')}`);
  return {
    title: t.title,
    notes: t.notes || null,
    assignee: key ? byName.get(key) : null,       // boş → ortak havuz
    priority: t.priority || 'normal',
    category: t.category || arg('category') || null,
    source: 'claude',
    meeting_date: meetingDate || null,
    sort_order: 0,
    // Sadece JSON girdisinde: "parent" bir üst görevin BAŞLIĞIDIR. Aynı çalıştırmada
    // yazılan bir üst görevi de, panoda zaten duran birini de gösterebilir.
    // Şemada iki seviye sınırı var (ops_todo_depth_guard), üçüncüyü DB reddeder.
    _parent: t.parent || null,
  };
});

// ── Aynı görev iki kez girmesin ─────────────────────────────────────────

const existing = await api('ops_todos?select=id,title&done=is.false');
const seen = new Map(existing.map(e => [e.title.trim().toLowerCase(), e.id]));
const fresh = rows.filter(r => !seen.has(r.title.trim().toLowerCase()));
const skipped = rows.length - fresh.length;

console.log(`${rows.length} görev okundu · ${skipped} zaten açık · ${fresh.length} yazılacak`);
for (const r of fresh) {
  const who = r.assignee ? members.find(m => m.id === r.assignee).display_name : 'Gemeinsam';
  console.log(`  ${r._parent ? '└─ ' : ''}[${who}] ${r.title}${r.priority !== 'normal' ? ` (${r.priority})` : ''}`);
}

if (dry) { console.log('\n--dry: hiçbir şey yazılmadı.'); process.exit(0); }
if (!fresh.length) { console.log('Yazılacak yeni görev yok.'); process.exit(0); }

// Üst görevler önce yazılır, yoksa alt görev bağlanacak id'yi bulamaz.
const strip = (r) => { const { _parent, ...row } = r; return row; };
const parents = fresh.filter(r => !r._parent);
const children = fresh.filter(r => r._parent);

if (parents.length) {
  const written = await api('ops_todos', { method: 'POST', body: JSON.stringify(parents.map(strip)) });
  for (const w of written) seen.set(w.title.trim().toLowerCase(), w.id);
}

if (children.length) {
  const rows2 = children.map(r => {
    const pid = seen.get(r._parent.trim().toLowerCase());
    if (!pid) die(`Üst görev bulunamadı: "${r._parent}" (alt görev: "${r.title}")`);
    return { ...strip(r), parent_id: pid };
  });
  await api('ops_todos', { method: 'POST', body: JSON.stringify(rows2) });
}

console.log(`\n✓ ${fresh.length} görev Board'a yazıldı.`);
