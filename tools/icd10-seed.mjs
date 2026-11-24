#!/usr/bin/env node
// ICD-10-GM Jahreswechsel — ham BfArM dosyasından icd10_titles seed migration'ı üretir
// (wissensbank/REGISTER.md Z-08 / W-A02, 24.11.2026).
//
// Niye var: icd10_titles'ın 7 sütunu 07/2026'da doğrudan canlı DB'de üretildi, ham
// dosyadan bu tabloya giden adım hiçbir yerde yazılı değildi. 0013 canlı tablodan
// (tools/seed-generieren.mjs) alındı — ama 2027 verisi henüz hiçbir veritabanında
// yok, yani o yol yeni yıl için kullanılamaz. Bu betik ham dosyadan aynı satırları üretir.
//
// Kanıt: 2026 ham dosyasından üretilen INSERT blokları 0013_seed_icd10_titles.sql ile
// BAYT BAYT aynıdır (tools/icd10-seed.test.js). Sütun listesi ve conflict anahtarı
// seed-generieren.mjs'deki TABLES.icd10_titles'tan gelir — ikinci bir liste yazılmaz.
//
// Kaçış: yalnız metin + Postgres format('%L') ile aynı tek kural (tek tırnak ikilenir).
// Ters bölü içeren değer görülürse betik DURUR (format('%L') orada E'' üretir; taklit
// etmek yerine reddediyoruz). Sayı ve bool sütunları %L gibi tırnaklı yazılır ('1','t').
//
// Alan eşlemesi (icd10gmJJJJsyst_metadaten_liesmich.txt, Datensatzbeschreibung kodes):
//   code=F6 · titel=F9 · kapitel=F4 (int) · ebene=F1 · terminal=F2=='T' · code_plain=F8 · gruppe=F5
//
// Kullanım:
//   node tools/icd10-seed.mjs <icd10gmJJJJsyst_kodes.txt> --jahr JJJJ > datei.sql
//   → stdout'a tam migration dosyası basar; elle incelenip sıradaki numarayla
//     api-backend/db/migrations/NNNN_seed_icd10_titles_JJJJ.sql olarak kaydedilir.
//   node tools/icd10-seed.mjs <kodes.txt> --vergleich <migration.sql>
//   → yalnız INSERT bloklarını karşılaştırır, fark varsa ilk farklı satırı gösterir.
//
// DELETE yok (seed-generieren.mjs SEED kuralı): yıl içinde düşen kodlar tabloda kalır,
// eski Verordnung'lardaki kodların başlığı aranabilir kalır.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { TABLES } from './seed-generieren.mjs';

const CFG = TABLES.icd10_titles;
export const BATCH_SIZE = 500;

/**
 * Ham kodes.txt → satır nesneleri (ham dosyadaki sıra korunur).
 * @param {string} text
 * @returns {Array<Record<string, string|number|boolean>>}
 */
export function parseKodes(text) {
  const rows = [];
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.trim() === '') return;
    const f = line.split(';');
    if (f.length < 12) throw new Error(`Zeile ${i + 1}: ${f.length} Felder, erwartet >= 12`);
    const [ebene, ort, , kapitel, gruppe, code, , codePlain, titel] = f;
    if (!/^[345]$/.test(ebene)) throw new Error(`Zeile ${i + 1}: Ebene "${ebene}" unbekannt`);
    if (ort !== 'T' && ort !== 'N') throw new Error(`Zeile ${i + 1}: Feld 2 "${ort}" weder T noch N`);
    if (!/^\d{1,2}$/.test(kapitel)) throw new Error(`Zeile ${i + 1}: Kapitel "${kapitel}" ungültig`);
    if (!code || !titel) throw new Error(`Zeile ${i + 1}: Code oder Titel leer`);
    rows.push({
      code,
      titel,
      kapitel: Number(kapitel),
      ebene: Number(ebene),
      terminal: ort === 'T',
      code_plain: codePlain,
      gruppe,
    });
  });
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.code)) throw new Error(`Code doppelt: ${r.code}`);
    seen.add(r.code);
  }
  return rows;
}

/**
 * Postgres format('%L') eşdeğeri — yalnız düz metin/sayı/bool için.
 * @param {string|number|boolean|null} v
 */
export function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = typeof v === 'boolean' ? (v ? 't' : 'f') : String(v);
  if (s.includes('\\')) throw new Error(`Backslash im Wert ${JSON.stringify(s)} — format('%L') würde E'' erzeugen; abgebrochen`);
  return `'${s.replace(/'/g, "''")}'`;
}

/** Kod sırası: seed-generieren'in ORDER BY code'u (C-Kollation = kod noktası). */
function byCode(a, b) {
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

/**
 * INSERT ... ON CONFLICT blokları — seed-generieren.buildQuery ile aynı biçim.
 * @param {ReturnType<typeof parseKodes>} rows
 */
export function buildInserts(rows) {
  const sorted = [...rows].sort(byCode);
  const cols = CFG.columns.join(', ');
  const setClause = CFG.columns
    .filter((c) => !CFG.conflictKeys.includes(c))
    .map((c) => `${c}=EXCLUDED.${c}`)
    .join(', ');
  const blocks = [];
  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    const vals = sorted
      .slice(i, i + BATCH_SIZE)
      .map((r) => `(${CFG.columns.map((c) => literal(r[c])).join(',')})`)
      .join(',\n  ');
    blocks.push(
      `INSERT INTO public.icd10_titles (${cols}) VALUES\n  ${vals}\nON CONFLICT (${CFG.conflictKeys.join(', ')}) DO UPDATE SET\n  ${setClause};`
    );
  }
  return blocks.join('\n\n');
}

/**
 * Tam migration dosyası (başlık + bloklar + satır sayısı kapısı).
 * @param {ReturnType<typeof parseKodes>} rows
 * @param {string} jahr
 */
export function buildMigration(rows, jahr) {
  const header = `-- ICD-10-GM ${jahr} — icd10_titles Jahreswechsel (wissensbank/REGISTER.md Z-08 / W-A02).
-- Erzeugt mit: node tools/icd10-seed.mjs icd10gm${jahr}syst_kodes.txt --jahr ${jahr}
-- Quelle: BfArM, ICD-10-GM ${jahr}, Systematisches Verzeichnis, Metadaten (Band 1).
-- Rechtliche Grundlage wie 0013: § 5 Abs. 2 UrhG, BfArM-Downloadbedingungen —
-- Kodetext unverändert (§ 62 UrhG), Quellenangabe in NOTICE-QUELLEN.txt (§ 63 UrhG).
--
-- ${rows.length} Kodes. ON CONFLICT DO UPDATE, kein DELETE: Kodes, die ${jahr} entfallen,
-- bleiben stehen (alte Verordnungen behalten ihren Titel). Diese Datei nie ändern —
-- Korrektur immer mit neuer Datei (Checksum-Sperre).
`;
  const check = `DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.icd10_titles;
  IF n < ${rows.length} THEN RAISE EXCEPTION 'seed icd10_titles ${jahr}: % Zeilen, erwartet >= ${rows.length}', n; END IF;
END $$;`;
  return `${header}\n${buildInserts(rows)}\n${check}\n`;
}

/** INSERT bloklarını bir migration dosyasından çıkarır (başlık/kapı hariç). */
export function extractInserts(sql) {
  const s = sql.replace(/\r\n/g, '\n');
  const start = s.indexOf('INSERT INTO public.icd10_titles');
  const end = s.lastIndexOf('DO UPDATE SET');
  if (start < 0 || end < 0) throw new Error('Keine INSERT-Blöcke gefunden');
  const endLine = s.indexOf(';', s.indexOf('\n', end + 1));
  return s.slice(start, endLine + 1);
}

function main() {
  const args = process.argv.slice(2);
  const datei = args[0];
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (!datei) {
    console.error('Kullanım: node tools/icd10-seed.mjs <kodes.txt> --jahr JJJJ | --vergleich <migration.sql>');
    process.exit(1);
  }
  const rows = parseKodes(readFileSync(datei, 'utf8'));
  const vergleich = opt('--vergleich');
  if (vergleich) {
    const a = buildInserts(rows).split('\n');
    const b = extractInserts(readFileSync(vergleich, 'utf8')).split('\n');
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i] !== b[i]) {
        console.error(`Fark, satır ${i + 1}:\n  üretilen: ${a[i]}\n  dosyada:  ${b[i]}`);
        process.exit(2);
      }
    }
    console.error(`OK — ${rows.length} Kodes, ${a.length} satır birebir aynı.`);
    return;
  }
  const jahr = opt('--jahr');
  if (!jahr || !/^\d{4}$/.test(jahr)) {
    console.error('--jahr JJJJ gerekli');
    process.exit(1);
  }
  process.stdout.write(buildMigration(rows, jahr));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
