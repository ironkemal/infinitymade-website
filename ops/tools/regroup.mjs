#!/usr/bin/env node
// Board umbauen: 100+ Einzelkarten → Themen mit Unteraufgaben, in sinnvoller
// Reihenfolge, mit Voraussetzungen ("erst nach …"), alles im gemeinsamen Pool.
//
//   node ops/tools/regroup.mjs --dry     ← zeigt nur, was passieren würde
//   node ops/tools/regroup.mjs
//
// Nichts wird gelöscht: bestehende Karten werden nur eingehängt und sortiert.
// Mehrfach ausführbar — Themen werden am Titel wiedererkannt.
//
// Voraussetzung: ops/schema-groups.sql einmal im Supabase-SQL-Editor ausführen.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from './groups.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };

function loadEnv() {
  let raw;
  try { raw = readFileSync(join(here, '..', '.env.ops'), 'utf8'); }
  catch { die('ops/.env.ops yok.'); }
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    die('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env.ops içinde olmalı.');
  return env;
}

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

// Türkçe/Almanca kesme işaretleri ve tırnaklar kaynaktan kaynağa değişiyor;
// eşleştirme bunlara takılmasın.
const norm = (s) => String(s)
  .replace(/[’‘‛`´']/g, "'")
  .replace(/[“”„]/g, '"')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('tr');

// ── Bestand lesen ───────────────────────────────────────────────────────

const all = await api('ops_todos?select=*');
if (!all.length) die('Board boş.');
// --dry planı sütunlar olmadan da hesaplanabilir; yazmak için şart.
const schemaReady = 'parent_id' in all[0] && 'blocked_by' in all[0];
if (!schemaReady && !dry)
  die('parent_id / blocked_by sütunları yok. Önce ops/schema-groups.sql dosyasını\n'
    + '  Supabase (praxura-ops) → SQL Editor içinde çalıştır.');

const groupTitles = new Set(GROUPS.map(g => norm(g.title)));
const parents = new Map();                       // group title → mevcut satır
for (const t of all) if (groupTitles.has(norm(t.title)) && !t.parent_id) parents.set(norm(t.title), t);

// Eşleşme havuzu: tema kartlarının kendisi hariç her şey.
const pool = all.filter(t => !groupTitles.has(norm(t.title)));

function resolve(spec, groupTitle) {
  for (const needle of [spec.match, spec.alt].filter(Boolean)) {
    const hits = pool.filter(t => norm(t.title).includes(norm(needle)));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1)
      die(`"${needle}" (${groupTitle}) ${hits.length} karta uyuyor:\n   `
        + hits.map(h => h.title).join('\n   '));
  }
  die(`"${spec.match}" (${groupTitle}) hiçbir karta uymuyor. Kart silinmiş veya başlığı değişmiş olabilir.`);
}

// ── Plan aufbauen ───────────────────────────────────────────────────────

const resolved = new Map();      // match-string → todo id (blocker çözümü için)
const plan = [];                 // { id?, insert?, patch, label }
let newParents = 0;

GROUPS.forEach((g, gi) => {
  // Önce çocukları çöz — blocker'lar hep aynı çalışmada tanımlı olsun.
  g.items.forEach(it => {
    const row = resolve(it, g.title);
    resolved.set(norm(it.match), row.id);
    if (it.alt) resolved.set(norm(it.alt), row.id);
    it._row = row;
  });
});

// Blocker referansları: önce tam eşleşme, sonra "içeren" araması.
function blockerId(needle, ctx) {
  const key = norm(needle);
  if (resolved.has(key)) return resolved.get(key);
  const hit = [...resolved.entries()].find(([k]) => k.includes(key) || key.includes(k));
  if (hit) return hit[1];
  die(`Ön koşul "${needle}" (${ctx}) çözülemedi.`);
}

GROUPS.forEach((g, gi) => {
  const sort = (gi + 1) * 10;
  const existing = parents.get(norm(g.title));
  const base = {
    title: g.title,
    notes: g.notes,
    category: g.category,
    priority: g.priority,
    assignee: null,
    parent_id: null,
    sort_order: sort
  };

  if (existing) {
    plan.push({ id: existing.id, patch: base, label: `Tema (mevcut): ${g.title}` });
    g._id = existing.id;
  } else {
    newParents++;
    plan.push({ insert: { ...base, source: 'claude' }, label: `Tema (YENİ): ${g.title}`, _group: g });
  }

  g.items.forEach((it, ii) => {
    plan.push({
      id: it._row.id,
      patch: {
        parent_id: '__PARENT__' + gi,
        assignee: null,
        sort_order: (ii + 1) * 10,
        blocked_by: (it.after || []).map(a => blockerId(a, it.match))
      },
      label: `   ${ii + 1}. ${it._row.title}${it.after ? `   ⟵ önce: ${it.after.join(' + ')}` : ''}`
    });
  });
});

// ── Ausgabe ─────────────────────────────────────────────────────────────

const childCount = GROUPS.reduce((n, g) => n + g.items.length, 0);
const untouched = pool.filter(t => !GROUPS.some(g => g.items.some(i => i._row.id === t.id)));

for (const p of plan) console.log(p.label);
console.log(`\n${GROUPS.length} tema · ${childCount} alt görev · ${newParents} yeni tema kartı`);
console.log(`Panoda görünecek kart sayısı: ${GROUPS.length} (şu an ${pool.length})`);
if (untouched.length) {
  console.log(`\n⚠ Hiçbir temaya girmeyen ${untouched.length} kart (elle bak):`);
  for (const t of untouched) console.log('   · ' + t.title);
}

if (dry) { console.log('\n--dry: hiçbir şey yazılmadı.'); process.exit(0); }

// ── Schreiben ───────────────────────────────────────────────────────────

// 1) Eksik tema kartlarını aç
for (const p of plan) {
  if (!p.insert) continue;
  const [row] = await api('ops_todos', { method: 'POST', body: JSON.stringify(p.insert) });
  p._group._id = row.id;
}

// 2) Mevcut tema kartlarını güncelle
for (const p of plan) {
  if (!p.id || !p.patch.title) continue;
  await api(`ops_todos?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify(p.patch) });
}

// 3) Alt görevleri bağla
for (const p of plan) {
  if (!p.id || p.patch.title) continue;
  const gi = Number(String(p.patch.parent_id).replace('__PARENT__', ''));
  await api(`ops_todos?id=eq.${p.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...p.patch, parent_id: GROUPS[gi]._id })
  });
}

// 4) Tema düzeyindeki ön koşullar (Launch → diğer temalar)
for (const g of GROUPS) {
  if (!g.blockedByGroups?.length) continue;
  const ids = g.blockedByGroups.map(t => {
    const target = GROUPS.find(x => norm(x.title) === norm(t));
    if (!target) die(`Tema ön koşulu "${t}" bulunamadı.`);
    return target._id;
  });
  await api(`ops_todos?id=eq.${g._id}`, { method: 'PATCH', body: JSON.stringify({ blocked_by: ids }) });
}

console.log(`\n✓ Board yeniden düzenlendi: ${GROUPS.length} tema, ${childCount} alt görev, hepsi Gemeinsam.`);
