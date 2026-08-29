#!/usr/bin/env node
// TABELLENKARTE — her veritabanı tablosunun KİM tarafından kullanıldığını üretir.
//
// Neden var: `db/SCHEMA.sql` tabloların NE olduğunu söyler, `db/REGISTER.md`
// NİYE açıldıklarını söyler — ama "bu tablodan kim besleniyor, kim yazıyor,
// hangi ekrandan geliyor" sorusunun cevabı okuyarak değil SAYARAK bulunur.
// Bu script okumaz, sayar.
//
// Üretir:
//   db/NUTZUNG.json  — makine okuru (db-ustasi ajanı buradan cevap verir)
//   db/NUTZUNG.md    — insan okuru (özet + kayıtsız tablolar + ölü tablo adayları)
//
// Kullanım:
//   node tools/tabellenkarte.mjs            # üret
//   node tools/tabellenkarte.mjs --check    # kapı: kaydı olmayan tablo varsa exit 1
//
// KURAL: yeni tablo açıldığında `db/REGISTER.md` içine kaydı aynı commit'te yazılır.
// Tetikleyici cümle: "tablo kaydı güncelle". Kayıtsız tablo, altı ay sonra
// "bu neydi, silsek mi" diye bakılan tablodur.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');

const SCHEMA    = join(ROOT, 'db/SCHEMA.sql');
const SCHEMARLS = join(ROOT, 'db/SCHEMA-RLS.sql');
const REGISTER  = join(ROOT, 'db/REGISTER.md');
const FNKARTE   = join(ROOT, 'funktionen/INDEX.json');

const OUT_JSON = join(ROOT, 'db/NUTZUNG.json');
const OUT_MD   = join(ROOT, 'db/NUTZUNG.md');

const uniq = (a) => [...new Set(a)];
const rel  = (p) => relative(ROOT, p).split(sep).join('/');

// ── 1. Şemadaki tablolar ────────────────────────────────────────────────────
if (!existsSync(SCHEMA)) { console.error('db/SCHEMA.sql yok — önce "şema güncelle".'); process.exit(2); }
const schemaText = readFileSync(SCHEMA, 'utf8');

const tabellen = new Map(); // name -> { name, spalten, fkRaus[] }
{
  const re = /^CREATE TABLE ([^\s(]+) \(([\s\S]*?)^\);/gm;
  let m;
  while ((m = re.exec(schemaText))) {
    const name = m[1].replace(/^public\./, '').replace(/"/g, '');
    const body = m[2];
    const spalten = body.split('\n').filter(l => /^\s{2}\S/.test(l)).length;
    // FK yorumları CREATE bloğunun hemen ardından gelir
    const after = schemaText.slice(re.lastIndex, re.lastIndex + 2000).split('\nCREATE TABLE')[0];
    const fkRaus = uniq([...after.matchAll(/--\s+FK\s+\S+\s+->\s+([a-zA-Z0-9_."ßäöü]+)\(/g)]
      .map(x => x[1].replace(/^public\./, '').replace(/"/g, '')));
    tabellen.set(name, { name, spalten, fkRaus });
  }
}
const schemaStand = (schemaText.match(/ERZEUGT AM:\s*([0-9-]+)/) || [])[1] || '?';

// ── 2. Fonksiyon haritasını ters çevir ──────────────────────────────────────
const karte = existsSync(FNKARTE) ? JSON.parse(readFileSync(FNKARTE, 'utf8')) : { eintraege: [], erzeugt: null };
const leser = new Map(), schreiber = new Map();
const add = (map, t, v) => { if (!map.has(t)) map.set(t, []); map.get(t).push(v); };

for (const fn of karte.eintraege || []) {
  const ops = new Map(); // table -> [op]
  for (const w of fn.writes || []) {
    const [t, op] = w.split(':');
    if (!ops.has(t)) ops.set(t, []);
    ops.get(t).push(op);
  }
  for (const t of fn.tables || []) {
    const eintrag = {
      name: fn.name, file: fn.file, start: fn.start,
      module: fn.modules || [], uiPfad: fn.uiPfad || [],
    };
    if (ops.has(t)) add(schreiber, t, { ...eintrag, ops: uniq(ops.get(t)).sort() });
    else            add(leser, t, eintrag);
  }
}

// ── 3. Ham dosya taraması — fonksiyon dışında kalan kodu da yakalar ─────────
// Fonksiyon haritası yalnız FONKSİYON GÖVDELERİNİ tarar. Modül üst seviyesindeki
// kod, HTML içindeki inline script ve backend router gövdeleri oradan düşer.
// "Bu tabloyu kimse kullanmıyor" cümlesi ancak bu tarama da boşsa kurulabilir.
// `ops/` BİLEREK dışarıda: Ops-Dashboard AYRI bir Supabase projesidir
// (farkaejociddtgqkusvm). `ops_*` tabloları bu şemada yoktur; taransaydı iki
// projenin tablo listesi tek kovada karışırdı.
const SKIP_DIRS = new Set(['node_modules', '.git', 'archive', 'dist', 'build', '.vercel', '.next',
  'funktionen', 'coverage', '.claude', 'onprem', 'competitor-research', 'ui-audit', 'mobile-audit',
  'db', 'supabase', 'sql-melih', 'ops']);
function walk(dir, acc = []) {
  let entries; try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e) || e.startsWith('.')) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(js|mjs|cjs|html)$/.test(e)) acc.push(p);
  }
  return acc;
}
const dateien = walk(ROOT);
const dateiTreffer = new Map();  // table -> Set(datei)   — .from() ile gerçek erişim
const erwaehnungen = new Map();  // table -> Set(datei)   — string literali olarak anılma
const treffer = (map, t, f) => { if (!map.has(t)) map.set(t, new Set()); map.get(t).add(f); };

for (const f of dateien) {
  let txt; try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  const r = rel(f);
  if (r === 'tools/tabellenkarte.mjs') continue;   // kendini sayma
  // (a) supabase-js: .from('tabelle')
  for (const m of txt.matchAll(/\.from\(\s*['"`]([a-zA-Z0-9_ßäöü]+)['"`]/g)) {
    if (tabellen.has(m[1])) treffer(dateiTreffer, m[1], r);
  }
  // (b) PostgREST doğrudan URL: fetch('/demo_bookings?select=...') — api/demo-booking.js
  //     böyle çalışır ve (a) taramasından tamamen düşerdi.
  for (const m of txt.matchAll(/['"`]\/([a-zA-Z0-9_ßäöü]+)(?=['"`?])/g)) {
    if (tabellen.has(m[1])) treffer(dateiTreffer, m[1], r);
  }
  // (c) Tam string literali olarak anılma: DSGVO tablo listeleri, silme sıraları,
  //     migration yardımcıları. Erişim değil ama "kim biliyor" sorusunun cevabı.
  //     TAM eşleşme şart — `rx.heilmittel_position` bir SÜTUN adıdır, tablo değil.
  for (const m of txt.matchAll(/['"]([a-zA-Z0-9_ßäöü]+)['"]/g)) {
    if (tabellen.has(m[1])) treffer(erwaehnungen, m[1], r);
  }
}

// ── 3b. DSGVO kapsamı — hasta/inhaber verisi taşıyan her tablo burada olmalı ──
// `api/dsgvo.js` Auskunft (Art. 15) ve Löschung (Art. 17) için tablo listelerini
// elle tutar. Yeni tablo açılıp buraya yazılmazsa DSGVO cevabı EKSİK çıkar —
// 2026-08-28'de tam olarak bu oldu. Bu yüzden kapının bir parçası.
const dsgvoPfad = join(ROOT, 'api/dsgvo.js');
const dsgvo = { auskunft: new Set(), loeschung: new Set(), anonymisiert: new Set(), vorhanden: existsSync(dsgvoPfad) };
if (dsgvo.vorhanden) {
  const txt = readFileSync(dsgvoPfad, 'utf8');
  for (const m of txt.matchAll(/\{\s*table:\s*['"]([a-zA-Z0-9_ßäöü]+)['"]/g)) dsgvo.auskunft.add(m[1]);
  // Listeler dosyada `const X_TABLES = [ ... ];` biçiminde duruyor.
  const liste = (konstante, ziel) => {
    const m = txt.match(new RegExp(`const\\s+${konstante}\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`));
    if (!m) return;
    for (const x of m[1].matchAll(/['"]([a-zA-Z0-9_ßäöü]+)['"]/g)) if (tabellen.has(x[1])) ziel.add(x[1]);
  };
  liste('DELETE_TABLES', dsgvo.loeschung);
  liste('ANONYMIZE_TABLES', dsgvo.anonymisiert);
}

// ── 4. SQL tarafı: trigger/RPC/policy içinde geçen tablolar ────────────────
// Bir tablo koddan hiç çağrılmıyor ama bir trigger onu besliyor olabilir
// (ör. nummernkreise). Bu tarama olmadan "ölü" damgası yanlış olur.
const rlsText = existsSync(SCHEMARLS) ? readFileSync(SCHEMARLS, 'utf8') : '';
const sqlTreffer = new Map();
for (const t of tabellen.keys()) {
  const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  const n = (rlsText.match(re) || []).length;
  if (n) sqlTreffer.set(t, n);
}

// ── 5. Register (NİYE açıldı) — db-ustasi ajanının baktığı dosya ───────────
const registerText = existsSync(REGISTER) ? readFileSync(REGISTER, 'utf8') : '';
const registerEintraege = new Map();
{
  const re = /^###\s+`?([a-zA-Z0-9_ßäöü]+)`?\s*$/gm;
  let m;
  const positions = [];
  while ((m = re.exec(registerText))) positions.push({ name: m[1], idx: m.index });
  positions.forEach((p, i) => {
    const block = registerText.slice(p.idx, i + 1 < positions.length ? positions[i + 1].idx : undefined);
    const feld = (k) => (block.match(new RegExp(`\\*\\*${k}:\\*\\*\\s*(.+)`)) || [])[1]?.trim() || null;
    registerEintraege.set(p.name, {
      warum: feld('Warum'),
      seit: feld('Seit'),
      status: feld('Status'),
      offen: /ungeklärt/i.test(block),
    });
  });
}

// ── 6. Birleştir ────────────────────────────────────────────────────────────
const out = [];
for (const [name, t] of [...tabellen].sort()) {
  const reg = registerEintraege.get(name) || null;
  const l = leser.get(name) || [], s = schreiber.get(name) || [];
  const d = [...(dateiTreffer.get(name) || [])].sort();
  const e = [...(erwaehnungen.get(name) || [])].sort().filter(x => !d.includes(x));
  out.push({
    name,
    spalten: t.spalten,
    fkRaus: t.fkRaus,
    dsgvoAuskunft: dsgvo.auskunft.has(name),
    dsgvoLoeschung: dsgvo.loeschung.has(name),
    dsgvoAnonymisiert: dsgvo.anonymisiert.has(name),
    erwaehnt: e,
    register: !!reg,
    status: reg?.status || null,
    warum: reg?.warum || null,
    seit: reg?.seit || null,
    ungeklaert: reg?.offen || false,
    leser: l.sort((a, b) => a.name.localeCompare(b.name)),
    schreiber: s.sort((a, b) => a.name.localeCompare(b.name)),
    dateien: d,
    module: uniq([...l, ...s].flatMap(x => x.module)).sort(),
    sqlTreffer: sqlTreffer.get(name) || 0,
    codeStumm: l.length === 0 && s.length === 0 && d.length === 0,
  });
}

// Hasta/inhaber verisi taşıyıp DSGVO listelerinde olmayan tablolar.
// Ölçüt: owner_id/user_id/patient_id/lead_id FK'si var ama Auskunft listesinde yok.
const dsgvoLuecke = out.filter(t =>
  !t.dsgvoAuskunft &&
  t.fkRaus.some(fk => ['leads', 'profiles', 'auth.users'].includes(fk)) &&
  !['spatial_ref_sys'].includes(t.name)
).map(t => t.name);

const ohneRegister = out.filter(t => !t.register).map(t => t.name);
const ungeklaert   = out.filter(t => t.ungeklaert).map(t => t.name);
const verwaist     = [...registerEintraege.keys()].filter(n => !tabellen.has(n));
const stumm        = out.filter(t => t.codeStumm).map(t => ({ name: t.name, sql: t.sqlTreffer, status: t.status }));

const json = {
  erzeugt: new Date().toISOString().slice(0, 10),
  quellen: {
    schema: `db/SCHEMA.sql (Stand ${schemaStand})`,
    funktionskarte: `funktionen/INDEX.json (erzeugt ${karte.erzeugt || '?'})`,
    register: existsSync(REGISTER) ? 'db/REGISTER.md' : null,
  },
  anzahl: out.length,
  tabellen: out,
  ohneRegister, ungeklaert, registerVerwaist: verwaist, codeStumm: stumm,
  dsgvo: {
    auskunft: [...dsgvo.auskunft].sort(),
    loeschung: [...dsgvo.loeschung].sort(),
    anonymisiert: [...dsgvo.anonymisiert].sort(),
    verdaechtigeLuecke: dsgvoLuecke,
  },
};
writeFileSync(OUT_JSON, JSON.stringify(json, null, 1) + '\n');

// ── 7. İnsan okuru ──────────────────────────────────────────────────────────
const md = [];
md.push('# Tabellen-Nutzung — wer liest, wer schreibt');
md.push('');
md.push('> ÜRETİLEN DOSYA — elle düzenleme. `node tools/tabellenkarte.mjs`');
md.push('> NİYE açıldıkları: `db/REGISTER.md` · YAPILARI: `db/SCHEMA.sql`');
md.push('');
md.push(`**Erzeugt:** ${json.erzeugt} · ${out.length} Tabellen · Quelle: ${json.quellen.schema}, ${json.quellen.funktionskarte}`);
md.push('');
md.push('## Kayıt durumu');
md.push('');
md.push(`- Register kaydı olan: **${out.length - ohneRegister.length}/${out.length}**`);
if (ohneRegister.length) md.push(`- ⛔ **Kaydı olmayan (${ohneRegister.length}):** ${ohneRegister.map(n => '`' + n + '`').join(', ')}`);
if (ungeklaert.length)   md.push(`- ⚠️ **"Warum" hâlâ ungeklärt (${ungeklaert.length}):** ${ungeklaert.map(n => '`' + n + '`').join(', ')}`);
if (verwaist.length)     md.push(`- 🧹 **Register içinde var, şemada yok (${verwaist.length}):** ${verwaist.map(n => '`' + n + '`').join(', ')}`);
md.push('');
md.push('## Kodda hiç çağrılmayan tablolar');
md.push('');
md.push('`.from()` ile hiçbir dosyadan erişilmiyor. **Ölü demek değildir** — trigger, RPC,');
md.push('view veya backend raw SQL üzerinden beslenebilir. `SQL-Treffer` sütunu SCHEMA-RLS.sql');
md.push('içindeki geçiş sayısıdır: 0 ise gerçekten şüphelidir.');
md.push('');
md.push('| Tabelle | SQL-Treffer | Register-Status |');
md.push('|---|---|---|');
for (const t of stumm) md.push(`| \`${t.name}\` | ${t.sql} | ${t.status || '—'} |`);
md.push('');
md.push('## DSGVO-Abdeckung (`api/dsgvo.js`)');
md.push('');
md.push(`Auskunft (Art. 15): **${dsgvo.auskunft.size}** · Löschung (Art. 17): **${dsgvo.loeschung.size}** · anonymisiert statt gelöscht: **${dsgvo.anonymisiert.size}**`);
md.push('');
if (dsgvoLuecke.length) {
  md.push(`⚠️ Personenbezug (FK auf \`leads\`/\`profiles\`/\`auth.users\`) aber **nicht** in der Auskunftsliste:`);
  md.push('');
  md.push(dsgvoLuecke.map(n => '`' + n + '`').join(', '));
  md.push('');
  md.push('Prüfen, nicht blind nachtragen: manche davon sind Konfigurations- oder');
  md.push('Referenztabellen ohne Personendaten. Die Entscheidung gehört ins Register.');
  md.push('');
}
md.push('## En çok yazılan tablolar');
md.push('');
md.push('| Tabelle | Schreiber | Leser | Dateien | Module |');
md.push('|---|---|---|---|---|');
for (const t of [...out].sort((a, b) => b.schreiber.length - a.schreiber.length).slice(0, 25)) {
  md.push(`| \`${t.name}\` | ${t.schreiber.length} | ${t.leser.length} | ${t.dateien.length} | ${t.module.join(', ') || '—'} |`);
}
md.push('');
md.push('## Alle Tabellen');
md.push('');
for (const t of out) {
  md.push(`### \`${t.name}\``);
  md.push('');
  md.push(`${t.spalten} Spalten · ${t.status ? `Status: ${t.status}` : '⛔ kein Register-Eintrag'}`);
  if (t.warum) md.push(`Warum: ${t.warum}`);
  md.push('');
  if (t.schreiber.length) {
    md.push(`**Schreibt (${t.schreiber.length}):** ` + t.schreiber.map(f => `\`${f.name}()\` [${f.ops.join('/')}] — ${f.file}:${f.start}`).join(' · '));
    md.push('');
  }
  if (t.leser.length) {
    md.push(`**Liest (${t.leser.length}):** ` + t.leser.slice(0, 20).map(f => `\`${f.name}()\``).join(', ') + (t.leser.length > 20 ? ` … +${t.leser.length - 20}` : ''));
    md.push('');
  }
  if (t.dateien.length) { md.push(`**Dateien:** ${t.dateien.map(d => '`' + d + '`').join(', ')}`); md.push(''); }
  if (t.module.length)  { md.push(`**Module:** ${t.module.join(', ')}`); md.push(''); }
}
writeFileSync(OUT_MD, md.join('\n') + '\n');

console.log(CHECK
  ? `tabellenkarte --check — ${out.length} Tabellen (dosya yazilmadi)`
  : `db/NUTZUNG.json + db/NUTZUNG.md — ${out.length} Tabellen`);
console.log(`  Register kaydı olan : ${out.length - ohneRegister.length}/${out.length}`);
console.log(`  Kaydı olmayan       : ${ohneRegister.length}${ohneRegister.length ? ' -> ' + ohneRegister.join(', ') : ''}`);
console.log(`  Ungeklärt "Warum"   : ${ungeklaert.length}`);
console.log(`  Register verwaist   : ${verwaist.length}${verwaist.length ? ' -> ' + verwaist.join(', ') : ''}`);
console.log(`  Kodda sessiz        : ${stumm.length}`);

if (CHECK && (ohneRegister.length || verwaist.length)) {
  console.error('\nKAPI: her tablonun db/REGISTER.md icinde bir kaydi olmali.');
  console.error('Yeni tablo actiysan kaydini ayni commite yaz (db-ustasi ajani yazar).');
  process.exit(1);
}
