#!/usr/bin/env node
// tools/kostentraeger-kutu-seed.mjs — Kutu ikizinden deterministik Kostenträger seed üretici.
//
// Bağlam:
//   - tools/bekci-ajan/SPEC.md (Faz 4)
//   - onprem O-257 / O-258 / O-139
//   - db/REGISTER.md "Seed-Kette"
//
// Amaç:
//   GitHub Actions Postgres servis kutusunda (DATABASE_URL):
//   1. İkizi kurar (kur(query)): boş DB'ye DDL + kutu migration zinciri.
//   2. vorher = dokum(query)
//   3. synchronisiere(...) çalıştırır (Stichtag ve dosya durumuna göre).
//   4. nachher = dokum(query)
//   5. vorher === nachher -> { degisiklik: false }, dosya yazılmaz.
//   6. Aksi -> 0132 şablonunda deterministik seed SQL dosyası üretir.
//   7. Kendi kendini doğrular (dogrula(query2, metin)) -> DATABASE_URL_DOGRULA.
//   8. api-backend/db/migrations/NNNN_seed_kostentraeger_<YYYYMMDD>.sql yazar,
//      erwartete-zaehler.json bis_version günceller, stdout'a JSON özet basar.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

import { berlinHeute, istStichtag } from '../api-backend/lib/berlin-tag.js';
import { ladeAusgaben, ECHT_DIR, sqlClient, synchronisiere } from './kostentraeger-annahmestellen-laden.mjs';
import { waehleAusgaben } from '../api-backend/billing/kostentraeger/lade-plan.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, '..');
const DEFAULT_MIG_DIR = join(REPO, 'api-backend', 'db', 'migrations');
const DEFAULT_ZAEHLER_PFAD = join(REPO, 'api-backend', 'db', 'erwartete-zaehler.json');

/**
 * Üç tablo konfigürasyonu (seed-generieren.mjs TABLES ile uyumlu).
 */
export const TABELLEN_CONFIG = {
  kostentraeger: {
    columns: [
      'ik', 'name', 'das_ik', 'payer_type', 'region', 'active', 'valid_from',
      'valid_to', 'updated_at', 'kurzname', 'abrechnender_kt_ik', 'ist_abrechnender_kt',
      'quelle', 'quelle_stand', 'datensatz_status'
    ],
    conflictKeys: ['ik'],
    orderBy: 'ik',
    where: "datensatz_status = 'echt'",
    keepOnConflict: [],
  },
  kostentraeger_annahmestellen: {
    columns: [
      'kostentraeger_ik', 'verknuepfungsart', 'partner_ik', 'leistungserbringergruppe',
      'abrechnungscode', 'art_datenlieferung', 'uebermittlungsmedium', 'bundesland', 'quelle',
      'quelle_stand', 'valid_from', 'valid_to'
    ],
    conflictKeys: [
      'kostentraeger_ik', 'verknuepfungsart', 'partner_ik', 'abrechnungscode',
      'art_datenlieferung', 'uebermittlungsmedium', 'bundesland'
    ],
    orderBy: 'kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland',
    keepOnConflict: ['valid_from'],
  },
  kostentraeger_anschriften: {
    columns: [
      'kostentraeger_ik', 'art', 'plz', 'ort', 'strasse', 'quelle', 'quelle_stand',
      'valid_from', 'valid_to'
    ],
    conflictKeys: ['kostentraeger_ik', 'art', 'plz', 'ort', 'strasse'],
    orderBy: 'kostentraeger_ik, art, plz, ort, strasse',
    keepOnConflict: ['valid_from'],
  },
};

/**
 * `grep -l kostentraeger` (0006-0132) analizi sonucu belirlenen sabit zincir listesi.
 * Gerekçeler:
 * - 0006: kostentraeger ilk ana veri tohumu (INSERT) -> 'tam'
 * - 0007: kostentraeger_annahmestellen ilk tohum (INSERT) -> 'tam'
 * - 0008: heilmittel_tarif tohumu; 3 tabloya dokunmaz -> Hariç
 * - 0020: prescriptions kısıtlamaları; 3 tabloya dokunmaz -> Hariç
 * - 0032: kostentraeger_anschriften DDL (tablo, PK, identity, UNIQUE; FK/RLS yok) -> 'ddl-cikar'
 * - 0036: kostentraeger_anschriften ilk tohum (INSERT) -> 'tam'
 * - 0037: kostentraeger_annahmestellen quelle_stand tohumu (INSERT) -> 'tam'
 * - 0038: empfaenger_zertifikate; 3 tabloya dokunmaz -> Hariç
 * - 0040: kostentraeger_auswahl VIEW; 3 tablo verisine/kolonuna dokunmaz -> Hariç
 * - 0041: krankenkassen tablosu; 3 tabloya dokunmaz -> Hariç
 * - 0044: leads tablosu; 3 tabloya dokunmaz -> Hariç
 * - 0045: Q4 2026 üç tablo ana tohumu (temp tablolar üzerinden upsert + delete) -> 'tam'
 * - 0046: valid_from / valid_to kolonları eklenir (ALTER TABLE; VIEW hariç) -> 'ifade-sec'
 * - 0047: anamnese tablosu; 3 tabloya dokunmaz -> Hariç
 * - 0048: kostentraeger_auswahl VIEW; 3 tabloya dokunmaz -> Hariç
 * - 0049: prescriptions fonksiyonu; 3 tabloya dokunmaz -> Hariç
 * - 0054: RLS/yetki; 3 tabloya dokunmaz -> Hariç
 * - 0056: mock_unbestaetigt kostentraeger satırları temizlenir (DELETE; diğer drop'lar hariç) -> 'ifade-sec'
 * - 0058: abrechnung tablosu; 3 tabloya dokunmaz -> Hariç
 * - 0062: trigger fonksiyonu; 3 tabloya dokunmaz -> Hariç
 * - 0089: services tablosu; 3 tabloya dokunmaz -> Hariç
 * - 0099: items tablosu; 3 tabloya dokunmaz -> Hariç
 * - 0112: prescriptions tablosu; 3 tabloya dokunmaz -> Hariç
 * - 0113: physio fonksiyonları; 3 tabloya dokunmaz -> Hariç
 * - 0132: Q4 2026 nachlieferung tohumu (üç tablo UPSERT + DO kontrolü) -> 'tam'
 */
export const ZINCIR = [
  { datei: '0006_seed_kostentraeger.sql', nasil: 'tam', gerekce: 'kostentraeger ilk ana veri tohumu' },
  { datei: '0007_seed_kostentraeger_annahmestellen.sql', nasil: 'tam', gerekce: 'kostentraeger_annahmestellen ilk tohumu' },
  { datei: '0032_kostentraeger_anschriften.sql', nasil: 'ddl-cikar', gerekce: 'kostentraeger_anschriften tablo DDL (PK, identity, UNIQUE)' },
  { datei: '0036_seed_kostentraeger_anschriften.sql', nasil: 'tam', gerekce: 'kostentraeger_anschriften ilk tohumu' },
  { datei: '0037_seed_kostentraeger_annahmestellen_quelle_stand.sql', nasil: 'tam', gerekce: 'kostentraeger_annahmestellen quelle_stand re-seed' },
  { datei: '0045_seed_kostentraeger_q4_2026.sql', nasil: 'tam', gerekce: 'Q4 2026 üç tablo ana tohumu' },
  { datei: '0046_kostentraeger_gueltigkeit_annahmestellen.sql', nasil: 'ifade-sec', gerekce: 'valid_from/valid_to kolonları (VIEW hariç)' },
  { datei: '0056_db_aufraeumen.sql', nasil: 'ifade-sec', gerekce: 'DELETE mock_unbestaetigt kostentraeger (diğer tablolar hariç)' },
  { datei: '0132_seed_kostentraeger_q4_2026_nachlieferung.sql', nasil: 'tam', gerekce: 'Q4 2026 nachlieferung seed' },
];

/**
 * pg paketini dinamik yükler (api-backend/package.json üzerinden).
 */
export async function ladePg() {
  const req = createRequire(join(REPO, 'api-backend', 'package.json'));
  const pg = req('pg');
  return pg.default ?? pg;
}

/**
 * Postgres format('%L') eşdeğeri değer kaçışı.
 * - NULL veya undefined -> 'NULL'
 * - string içinde ters bölü (\) varsa -> E'...' ve \ ile ' kaçışı
 * - string içinde ters bölü yoksa -> '...' ve tek tırnak ikilenir ('')
 * @param {unknown} v
 * @returns {string}
 */
export function L(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = typeof v === 'boolean' ? (v ? 't' : 'f') : String(v);
  if (s.includes('\\')) {
    return `E'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * DDL çıkarıcı: SQL metninden hedef tabloların DDL ifadelerini seçer.
 * Yalnızca CREATE TABLE, identity ALTER, PK/UNIQUE kısıtları ve indeksler alınır.
 * Policy, RLS, GRANT, REVOKE, TRIGGER, FOREIGN KEY (REFERENCES) ASLA ALINMAZ.
 * @param {string} [sql]
 * @param {string[]} [tabellen]
 * @returns {string}
 */
export function ddlCikar(sql, tabellen = ['kostentraeger', 'kostentraeger_annahmestellen', 'kostentraeger_anschriften']) {
  let sourceSql = sql;
  if (!sourceSql) {
    const bPath = join(DEFAULT_MIG_DIR, '0000_baseline.sql');
    const aPath = join(DEFAULT_MIG_DIR, '0032_kostentraeger_anschriften.sql');
    sourceSql = `${readFileSync(bPath, 'utf8')}\n\n${readFileSync(aPath, 'utf8')}`;
  }

  const tableSet = new Set(tabellen);
  const stmts = [];

  const re = /(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+public\.([a-z0-9_]+)\s*\([^;]+?\);|ALTER\s+TABLE\s+(?:ONLY\s+)?public\.([a-z0-9_]+)\s+[^;]+?;|CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_]+)\s+ON\s+(?:ONLY\s+)?public\.([a-z0-9_]+)\s+[^;]+?;)/gis;

  let m;
  while ((m = re.exec(sourceSql)) !== null) {
    const full = m[0].trim();
    const t = m[1] || m[2] || m[4];
    if (!tableSet.has(t)) continue;

    if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(full)) continue;
    if (/FOREIGN\s+KEY/i.test(full)) continue;
    if (/POLICY/i.test(full)) continue;
    if (/GRANT|REVOKE/i.test(full)) continue;
    if (/TRIGGER/i.test(full)) continue;

    let cleaned = full;
    if (/CREATE\s+TABLE/i.test(full)) {
      cleaned = cleaned.replace(/REFERENCES\s+public\.[a-z0-9_]+\s*\([^)]+\)\s*(ON\s+DELETE\s+[A-Z\s]+)?/gi, '');
    }

    stmts.push(cleaned);
  }

  return stmts.join('\n\n');
}

/**
 * 'ifade-sec' kapsamındaki dosyalardan yalnız hedef 3 tabloya ait ifadeleri alır.
 * @param {string} datei
 * @param {string} content
 * @returns {string}
 */
export function secIfadeler(datei, content) {
  if (datei.startsWith('0046_')) {
    return [
      'ALTER TABLE public.kostentraeger_annahmestellen ADD COLUMN IF NOT EXISTS valid_from date, ADD COLUMN IF NOT EXISTS valid_to date;',
      'ALTER TABLE public.kostentraeger_anschriften ADD COLUMN IF NOT EXISTS valid_from date, ADD COLUMN IF NOT EXISTS valid_to date;',
    ].join('\n\n');
  }
  if (datei.startsWith('0056_')) {
    return "DELETE FROM public.kostentraeger WHERE datensatz_status = 'mock_unbestaetigt';";
  }
  throw new Error(`Bilinmeyen ifade-sec dosyası: ${datei}`);
}

/**
 * Zincir listesini hazırlar (yeni *_seed_kostentraeger* dosyalarını otomatik ekler).
 * @param {{ migDir?: string, haricDosyalar?: Set<string> }} [opts]
 * @returns {Array<{ datei: string, nasil: 'tam' | 'ddl-cikar' | 'ifade-sec', gerekce?: string }>}
 */
export function zincirOlustur({ migDir = DEFAULT_MIG_DIR, haricDosyalar = new Set() } = {}) {
  const gesehene = new Set(ZINCIR.map(z => z.datei));
  const sonuc = [...ZINCIR];

  if (existsSync(migDir)) {
    const dosyalar = readdirSync(migDir).sort();
    for (const f of dosyalar) {
      if (f.endsWith('.sql') && f.includes('_seed_kostentraeger') && !gesehene.has(f)) {
        sonuc.push({ datei: f, nasil: 'tam', gerekce: 'otomatik eklenen yeni seed' });
        gesehene.add(f);
      }
    }
  }

  return sonuc
    .filter(item => !haricDosyalar.has(item.datei))
    .sort((a, b) => a.datei.slice(0, 4).localeCompare(b.datei.slice(0, 4)));
}

/**
 * İkizi kurar: boş DB'ye üç tablonun DDL'i + zincir ifadeleri.
 * @param {(sql: string, params?: unknown[]) => Promise<any>} query
 * @param {{ migDir?: string, haricDosyalar?: Set<string>, dropSchema?: boolean }} [opts]
 */
export async function kur(query, {
  migDir = DEFAULT_MIG_DIR,
  haricDosyalar = new Set(),
  dropSchema = false,
} = {}) {
  if (dropSchema) {
    await query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  }

  // 1) 0000_baseline.sql'den kostentraeger ve kostentraeger_annahmestellen DDL
  const baselinePath = join(migDir, '0000_baseline.sql');
  const baselineSql = readFileSync(baselinePath, 'utf8');
  const ddlBaseline = ddlCikar(baselineSql, ['kostentraeger', 'kostentraeger_annahmestellen']);
  await query(ddlBaseline);

  // 2) Zincir
  const zincir = zincirOlustur({ migDir, haricDosyalar });
  for (const item of zincir) {
    const dateiPfad = join(migDir, item.datei);
    const inhalt = readFileSync(dateiPfad, 'utf8');

    if (item.nasil === 'tam') {
      await query(inhalt);
    } else if (item.nasil === 'ddl-cikar') {
      const ddl = ddlCikar(inhalt, ['kostentraeger_anschriften']);
      await query(ddl);
    } else if (item.nasil === 'ifade-sec') {
      const sql = secIfadeler(item.datei, inhalt);
      await query(sql);
    }
  }
}

/**
 * Üç tablonun 0132'deki kolon listesi ve sırasıyla dökümü (her kolon col::text, boolean t/f).
 * @param {(sql: string, params?: unknown[]) => Promise<any>} query
 */
export async function dokum(query) {
  await query("SET TIME ZONE 'UTC';");
  await query("SET DateStyle = 'ISO, MDY';");

  const ktRes = await query(`
    SELECT
      ik::text,
      name::text,
      das_ik::text,
      payer_type::text,
      region::text,
      CASE WHEN active IS NULL THEN NULL WHEN active THEN 't' ELSE 'f' END AS active,
      valid_from::text,
      valid_to::text,
      updated_at::text,
      kurzname::text,
      abrechnender_kt_ik::text,
      CASE WHEN ist_abrechnender_kt IS NULL THEN NULL WHEN ist_abrechnender_kt THEN 't' ELSE 'f' END AS ist_abrechnender_kt,
      quelle::text,
      quelle_stand::text,
      datensatz_status::text
    FROM public.kostentraeger
    WHERE datensatz_status = 'echt'
    ORDER BY ik;
  `);

  const asRes = await query(`
    SELECT
      kostentraeger_ik::text,
      verknuepfungsart::text,
      partner_ik::text,
      leistungserbringergruppe::text,
      abrechnungscode::text,
      art_datenlieferung::text,
      uebermittlungsmedium::text,
      bundesland::text,
      quelle::text,
      quelle_stand::text,
      valid_from::text,
      valid_to::text
    FROM public.kostentraeger_annahmestellen
    ORDER BY kostentraeger_ik, verknuepfungsart, partner_ik, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland;
  `);

  const anRes = await query(`
    SELECT
      kostentraeger_ik::text,
      art::text,
      plz::text,
      ort::text,
      strasse::text,
      quelle::text,
      quelle_stand::text,
      valid_from::text,
      valid_to::text
    FROM public.kostentraeger_anschriften
    ORDER BY kostentraeger_ik, art, plz, ort, strasse;
  `);

  return {
    kostentraeger: ktRes.rows,
    kostentraeger_annahmestellen: asRes.rows,
    kostentraeger_anschriften: anRes.rows,
  };
}

/**
 * İki döküm arasındaki fark istatistiklerini hesaplar.
 * @param {Awaited<ReturnType<typeof dokum>>} vorher
 * @param {Awaited<ReturnType<typeof dokum>>} nachher
 */
export function berechneStats(vorher, nachher) {
  const stats = {
    kostentraeger: { satir: (nachher.kostentraeger || []).length, yeni: 0, kapanan: 0, degisen: 0 },
    kostentraeger_annahmestellen: { satir: (nachher.kostentraeger_annahmestellen || []).length, yeni: 0, kapanan: 0, degisen: 0 },
    kostentraeger_anschriften: { satir: (nachher.kostentraeger_anschriften || []).length, yeni: 0, kapanan: 0, degisen: 0 },
  };

  const yeniIk = [];
  const kapananIk = [];
  const degisenAbrechnenderKt = [];

  // 1) kostentraeger
  const ktVorherMap = new Map((vorher.kostentraeger || []).map(r => [r.ik, r]));
  for (const n of nachher.kostentraeger || []) {
    const v = ktVorherMap.get(n.ik);
    if (!v) {
      stats.kostentraeger.yeni++;
      yeniIk.push(n.ik);
    } else {
      let changed = false;
      for (const k of Object.keys(n)) {
        if (k === 'updated_at') continue;
        if (n[k] !== v[k]) {
          changed = true;
          break;
        }
      }
      if (changed) {
        stats.kostentraeger.degisen++;
      }
      if (!v.valid_to && n.valid_to) {
        stats.kostentraeger.kapanan++;
        kapananIk.push(n.ik);
      }
      if (v.abrechnender_kt_ik !== n.abrechnender_kt_ik) {
        degisenAbrechnenderKt.push({ ik: n.ik, alt: v.abrechnender_kt_ik, yeni: n.abrechnender_kt_ik });
      }
    }
  }

  // 2) kostentraeger_annahmestellen
  const vkgKey = (r) => `${r.kostentraeger_ik}|${r.verknuepfungsart}|${r.partner_ik}|${r.abrechnungscode}|${r.art_datenlieferung}|${r.uebermittlungsmedium}|${r.bundesland}`;
  const asVorherMap = new Map((vorher.kostentraeger_annahmestellen || []).map(r => [vkgKey(r), r]));
  for (const n of nachher.kostentraeger_annahmestellen || []) {
    const k = vkgKey(n);
    const v = asVorherMap.get(k);
    if (!v) {
      stats.kostentraeger_annahmestellen.yeni++;
    } else {
      let changed = false;
      for (const col of Object.keys(n)) {
        if (n[col] !== v[col]) {
          changed = true;
          break;
        }
      }
      if (changed) stats.kostentraeger_annahmestellen.degisen++;
      if (!v.valid_to && n.valid_to) stats.kostentraeger_annahmestellen.kapanan++;
    }
  }

  // 3) kostentraeger_anschriften
  const ansKey = (r) => `${r.kostentraeger_ik}|${r.art}|${r.plz}|${r.ort}|${r.strasse}`;
  const anVorherMap = new Map((vorher.kostentraeger_anschriften || []).map(r => [ansKey(r), r]));
  for (const n of nachher.kostentraeger_anschriften || []) {
    const k = ansKey(n);
    const v = anVorherMap.get(k);
    if (!v) {
      stats.kostentraeger_anschriften.yeni++;
    } else {
      let changed = false;
      for (const col of Object.keys(n)) {
        if (n[col] !== v[col]) {
          changed = true;
          break;
        }
      }
      if (changed) stats.kostentraeger_anschriften.degisen++;
      if (!v.valid_to && n.valid_to) stats.kostentraeger_anschriften.kapanan++;
    }
  }

  const degisiklik = (
    stats.kostentraeger.yeni > 0 || stats.kostentraeger.kapanan > 0 || stats.kostentraeger.degisen > 0 ||
    stats.kostentraeger_annahmestellen.yeni > 0 || stats.kostentraeger_annahmestellen.kapanan > 0 || stats.kostentraeger_annahmestellen.degisen > 0 ||
    stats.kostentraeger_anschriften.yeni > 0 || stats.kostentraeger_anschriften.kapanan > 0 || stats.kostentraeger_anschriften.degisen > 0
  );

  return { stats, yeniIk, kapananIk, degisenAbrechnenderKt, degisiklik };
}

/**
 * 0132 DO bloğu SELECT'lerini ikizde çalıştırıp count ve md5 alır (JS'te hesaplanmaz).
 * @param {(sql: string, params?: unknown[]) => Promise<any>} query
 */
export async function ozKontrolHesapla(query) {
  await query('BEGIN');
  try {
    await query("SELECT set_config('TimeZone', 'UTC', true);");
    await query("SELECT set_config('DateStyle', 'ISO, MDY', true);");

    const ktRes = await query(`
      SELECT count(*) AS n, md5(string_agg(t, E'\\n' ORDER BY t COLLATE "C")) AS h FROM (
        SELECT format('(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)', ik, name, das_ik, payer_type, region, active, valid_from, valid_to, updated_at AT TIME ZONE 'UTC', kurzname, abrechnender_kt_ik, ist_abrechnender_kt, quelle, quelle_stand, datensatz_status) AS t
          FROM public.kostentraeger WHERE datensatz_status = 'echt') x;
    `);

    const asRes = await query(`
      SELECT count(*) AS n, md5(string_agg(t, E'\\n' ORDER BY t COLLATE "C")) AS h FROM (
        SELECT format('(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)', kostentraeger_ik, verknuepfungsart, partner_ik, leistungserbringergruppe, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland, quelle, quelle_stand, valid_from, valid_to) AS t
          FROM public.kostentraeger_annahmestellen) x;
    `);

    const anRes = await query(`
      SELECT count(*) AS n, md5(string_agg(t, E'\\n' ORDER BY t COLLATE "C")) AS h FROM (
        SELECT format('(%L,%L,%L,%L,%L,%L,%L,%L,%L)', kostentraeger_ik, art, plz, ort, strasse, quelle, quelle_stand, valid_from, valid_to) AS t
          FROM public.kostentraeger_anschriften) x;
    `);

    await query('COMMIT');

    return {
      kostentraeger: { n: Number(ktRes.rows[0].n), h: ktRes.rows[0].h },
      kostentraeger_annahmestellen: { n: Number(asRes.rows[0].n), h: asRes.rows[0].h },
      kostentraeger_anschriften: { n: Number(anRes.rows[0].n), h: anRes.rows[0].h },
    };
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}

/**
 * 0132 şablonunda deterministik migration dosyası metni üretir (SAF fonksiyon).
 * @param {{
 *   version: string,
 *   stichtag: string,
 *   aktiv: Array<{ datei: string, gueltigAb: string, sha256: string }>,
 *   kommend: Array<{ datei: string, gueltigAb: string, sha256: string }>,
 *   tablolar: { kostentraeger: any[], kostentraeger_annahmestellen: any[], kostentraeger_anschriften: any[] },
 *   ozKontrol: { kostentraeger: { n: number, h: string }, kostentraeger_annahmestellen: { n: number, h: string }, kostentraeger_anschriften: { n: number, h: string } },
 *   stats: ReturnType<typeof berechneStats>['stats'],
 * }} params
 * @returns {string}
 */
export function seedDosyasi({ version, stichtag, aktiv = [], kommend = [], tablolar, ozKontrol, stats }) {
  const parts = [];

  // Başlık
  parts.push(`-- O-258 / O-118 / O-139 (onprem/REGISTER.md) — Kostentraegerdatei Seed ${version} fuer die Box.`);
  parts.push('--');
  parts.push('-- SaaS: nicht angewandt (box-only): von Bekci-Ajan aus dem Kutu-Zwilling erzeugt (tools/kostentraeger-kutu-seed.mjs)');
  parts.push('-- ZAEHLER: unveraendert (reine Daten-UPSERT, public; kein DDL — README.md Kural 6)');
  parts.push('--');
  parts.push(`-- WAS: Stand der drei Kostentraeger-Tabellen im Kutu-Zwilling am ${stichtag}.`);
  parts.push(`--   kostentraeger                : ${stats.kostentraeger.satir} Zeilen (datensatz_status = 'echt'), ${stats.kostentraeger.yeni} neue IK, ${stats.kostentraeger.kapanan} beendete IK, ${stats.kostentraeger.degisen} geaenderte Zeilen`);
  parts.push(`--   kostentraeger_annahmestellen : ${stats.kostentraeger_annahmestellen.satir} Zeilen — ${stats.kostentraeger_annahmestellen.yeni} neue Schluessel, ${stats.kostentraeger_annahmestellen.kapanan} beendete Schluessel, ${stats.kostentraeger_annahmestellen.degisen} geaenderte Zeilen`);
  parts.push(`--   kostentraeger_anschriften    : ${stats.kostentraeger_anschriften.satir} Zeilen — ${stats.kostentraeger_anschriften.yeni} neue Schluessel, ${stats.kostentraeger_anschriften.kapanan} beendete Schluessel, ${stats.kostentraeger_anschriften.degisen} geaenderte Zeilen`);
  parts.push('--');
  parts.push('-- QUELLEN (wissensbank/gemeinsam/kostentraeger/, sha256 der Datei im Repo):');
  for (const a of aktiv) {
    parts.push(`--   ${a.datei.padEnd(16)}  ab ${a.gueltigAb}  ${a.sha256}`);
  }
  if (kommend.length) {
    parts.push('--   NICHT enthalten (kommend):');
    for (const k of kommend) {
      parts.push(`--   ${k.datei.padEnd(16)}  ab ${k.gueltigAb}  ${k.sha256}`);
    }
  }
  parts.push('');

  // 1) kostentraeger
  parts.push(`-- ─── 1) kostentraeger — ${stats.kostentraeger.satir} echte Zeilen, ON CONFLICT (ik), kein DELETE ───────`);
  const ktCfg = TABELLEN_CONFIG.kostentraeger;
  const ktRows = tablolar.kostentraeger || [];
  parts.push(tabloInserts('kostentraeger', ktRows, ktCfg));
  parts.push('');

  // 2) kostentraeger_annahmestellen
  parts.push(`-- ─── 2) kostentraeger_annahmestellen — ${stats.kostentraeger_annahmestellen.satir} Zeilen, ON CONFLICT, kein DELETE ───────`);
  const asCfg = TABELLEN_CONFIG.kostentraeger_annahmestellen;
  const asRows = tablolar.kostentraeger_annahmestellen || [];
  parts.push(tabloInserts('kostentraeger_annahmestellen', asRows, asCfg));
  parts.push('');

  // 3) kostentraeger_anschriften
  parts.push(`-- ─── 3) kostentraeger_anschriften — ${stats.kostentraeger_anschriften.satir} Zeilen, ON CONFLICT, kein DELETE ───────`);
  const anCfg = TABELLEN_CONFIG.kostentraeger_anschriften;
  const anRows = tablolar.kostentraeger_anschriften || [];
  parts.push(tabloInserts('kostentraeger_anschriften', anRows, anCfg));
  parts.push('');

  // 4) Selbstpruefung
  parts.push('-- ─── 4) Selbstpruefung — schlaegt eine fehl, rollt die ganze Datei zurueck ────');
  parts.push('-- Sortierung COLLATE "C" (unabhaengig von der Locale der Box), updated_at in UTC,');
  parts.push('-- DateStyle/TimeZone nur fuer diese Transaktion fest (set_config(..., true)).');
  parts.push('DO $$');
  parts.push('DECLARE n bigint; h text;');
  parts.push('BEGIN');
  parts.push("  PERFORM set_config('TimeZone', 'UTC', true);");
  parts.push("  PERFORM set_config('DateStyle', 'ISO, MDY', true);");
  parts.push('');
  parts.push("  SELECT count(*), md5(string_agg(t, E'\\n' ORDER BY t COLLATE \"C\")) INTO n, h FROM (");
  parts.push("    SELECT format('(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)', ik, name, das_ik, payer_type, region, active, valid_from, valid_to, updated_at AT TIME ZONE 'UTC', kurzname, abrechnender_kt_ik, ist_abrechnender_kt, quelle, quelle_stand, datensatz_status) AS t");
  parts.push("      FROM public.kostentraeger WHERE datensatz_status = 'echt') x;");
  parts.push(`  IF n <> ${ozKontrol.kostentraeger.n} THEN RAISE EXCEPTION '${version}: kostentraeger % statt ${ozKontrol.kostentraeger.n} echte Zeilen', n; END IF;`);
  parts.push(`  IF h <> '${ozKontrol.kostentraeger.h}' THEN RAISE EXCEPTION '${version}: kostentraeger md5 % weicht vom SaaS-Stand ab', h; END IF;`);
  parts.push('');
  parts.push("  SELECT count(*), md5(string_agg(t, E'\\n' ORDER BY t COLLATE \"C\")) INTO n, h FROM (");
  parts.push("    SELECT format('(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)', kostentraeger_ik, verknuepfungsart, partner_ik, leistungserbringergruppe, abrechnungscode, art_datenlieferung, uebermittlungsmedium, bundesland, quelle, quelle_stand, valid_from, valid_to) AS t");
  parts.push('      FROM public.kostentraeger_annahmestellen) x;');
  parts.push(`  IF n <> ${ozKontrol.kostentraeger_annahmestellen.n} THEN RAISE EXCEPTION '${version}: annahmestellen % statt ${ozKontrol.kostentraeger_annahmestellen.n}', n; END IF;`);
  parts.push(`  IF h <> '${ozKontrol.kostentraeger_annahmestellen.h}' THEN RAISE EXCEPTION '${version}: annahmestellen md5 % weicht vom SaaS-Stand ab', h; END IF;`);
  parts.push('');
  parts.push("  SELECT count(*), md5(string_agg(t, E'\\n' ORDER BY t COLLATE \"C\")) INTO n, h FROM (");
  parts.push("    SELECT format('(%L,%L,%L,%L,%L,%L,%L,%L,%L)', kostentraeger_ik, art, plz, ort, strasse, quelle, quelle_stand, valid_from, valid_to) AS t");
  parts.push('      FROM public.kostentraeger_anschriften) x;');
  parts.push(`  IF n <> ${ozKontrol.kostentraeger_anschriften.n} THEN RAISE EXCEPTION '${version}: anschriften % statt ${ozKontrol.kostentraeger_anschriften.n}', n; END IF;`);
  parts.push(`  IF h <> '${ozKontrol.kostentraeger_anschriften.h}' THEN RAISE EXCEPTION '${version}: anschriften md5 % weicht vom SaaS-Stand ab', h; END IF;`);
  parts.push('');
  parts.push('  -- Adim 2: keine Zeile mit valid_from in der Zukunft (Berlin) darf aus dieser Datei stammen.');
  parts.push("  SELECT (SELECT count(*) FROM public.kostentraeger_annahmestellen WHERE valid_from > (now() AT TIME ZONE 'Europe/Berlin')::date)");
  parts.push("       + (SELECT count(*) FROM public.kostentraeger_anschriften   WHERE valid_from > (now() AT TIME ZONE 'Europe/Berlin')::date) INTO n;");
  parts.push(`  IF n <> 0 THEN RAISE EXCEPTION '${version}: % Zeilen mit valid_from in der Zukunft (O-139 Adim 2)', n; END IF;`);
  parts.push('END $$;');

  return parts.join('\n');
}

/**
 * 500'lük parçalarla INSERT ... ON CONFLICT DO UPDATE blokları üretir.
 * @param {string} tabelle
 * @param {any[]} rows
 * @param {typeof TABELLEN_CONFIG['kostentraeger']} cfg
 * @returns {string}
 */
export function tabloInserts(tabelle, rows, cfg) {
  const BATCH_SIZE = 500;
  const updateCols = cfg.columns.filter(c => !cfg.conflictKeys.includes(c) && !cfg.keepOnConflict.includes(c));
  const setClause = updateCols.map(c => `${c}=EXCLUDED.${c}`).join(', ');
  const blocks = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const rowLines = chunk.map(r => `  (${cfg.columns.map(c => L(r[c])).join(',')})`);
    const sql = [
      `INSERT INTO public.${tabelle} (${cfg.columns.join(', ')}) VALUES`,
      rowLines.join(',\n'),
      `ON CONFLICT (${cfg.conflictKeys.join(', ')}) DO UPDATE SET`,
      `  ${setClause};`,
    ].join('\n');
    blocks.push(sql);
  }

  return blocks.join('\n\n');
}

/**
 * İki dökümün birebir eşitliğini doğrular.
 * @param {Awaited<ReturnType<typeof dokum>>} dokum2
 * @param {Awaited<ReturnType<typeof dokum>>} nachher
 */
export function assertDokumMatch(dokum2, nachher) {
  for (const t of ['kostentraeger', 'kostentraeger_annahmestellen', 'kostentraeger_anschriften']) {
    const r1 = nachher[t] || [];
    const r2 = dokum2[t] || [];
    if (r1.length !== r2.length) {
      throw new Error(`dogrula: Zeilenzahl für ${t} weicht ab (${r2.length} statt ${r1.length})`);
    }
    for (let i = 0; i < r1.length; i++) {
      const a = r1[i];
      const b = r2[i];
      for (const k of Object.keys(a)) {
        if (a[k] !== b[k]) {
          throw new Error(`dogrula: Abweichung in ${t}[${i}].${k}: erwartet '${a[k]}', erhalten '${b[k]}'`);
        }
      }
    }
  }
}

/**
 * Üretilen metni ikinci boş DB üzerinde kendi kendine doğrular.
 * @param {(sql: string, params?: unknown[]) => Promise<any>} query2
 * @param {string} metin
 * @param {{ nachher: Awaited<ReturnType<typeof dokum>>, kurFn: (q: typeof query2) => Promise<void> }} opts
 */
export async function dogrula(query2, metin, { nachher, kurFn }) {
  await kurFn(query2);
  await query2(metin);
  // İkinci kez uygula (idempotent kontrolü)
  await query2(metin);

  const dokum2 = await dokum(query2);
  assertDokumMatch(dokum2, nachher);
  return { ok: true };
}

/**
 * Migration dizinindeki en büyük numarayı bulur ve bir sonrakini döner ('0133').
 * @param {string} [migDir]
 * @returns {string}
 */
export function sonrakiNumara(migDir = DEFAULT_MIG_DIR) {
  let max = 0;
  if (existsSync(migDir)) {
    const dosyalar = readdirSync(migDir);
    for (const f of dosyalar) {
      const m = f.match(/^(\d{4})_.*\.sql$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > max) max = num;
      }
    }
  }
  return String(max + 1).padStart(4, '0');
}

/**
 * api-backend/db/erwartete-zaehler.json içindeki bis_version değerini günceller.
 * @param {string} zaehlerPfad
 * @param {string} bisVersion
 */
export function zaehlerAktualisieren(zaehlerPfad, bisVersion) {
  const text = readFileSync(zaehlerPfad, 'utf8');
  const neu = text.replace(/"bis_version":\s*"[^"]+"/, `"bis_version": "${bisVersion}"`);
  writeFileSync(zaehlerPfad, neu, 'utf8');
}

/**
 * Dosya SHA-256'sını hesaplar.
 * @param {string} pfad
 * @returns {string}
 */
export function sha256Hesapla(pfad) {
  const buf = readFileSync(pfad);
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * CLI ana fonksiyonu.
 */
export async function main() {
  const args = process.argv.slice(2);
  const kuru = args.includes('--kuru');
  const stichtagArg = args.find(a => a.startsWith('--stichtag='));
  const stichtag = stichtagArg ? stichtagArg.split('=')[1] : berlinHeute();

  if (!istStichtag(stichtag)) {
    console.error(`Ungültiger Stichtag: ${stichtag} (Format: YYYY-MM-DD)`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ist erforderlich (Postgres-Verbindung für Kutu-Zwilling).');
    process.exit(1);
  }

  const pg = await ladePg();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const query = async (sql, params = []) => (params.length ? client.query(sql, params) : client.query(sql));

  try {
    // 1) İkizi kur
    await kur(query, { dropSchema: true });

    // 2) vorher döküm
    const vorher = await dokum(query);

    // 3) synchronisiere
    const ausgaben = ladeAusgaben();
    const syncRes = await synchronisiere({
      db: sqlClient(query),
      stichtag,
      heute: berlinHeute(),
      write: true,
      ausgaben,
      log: console.error,
    });

    // 4) nachher döküm
    const nachher = await dokum(query);

    // 5) Fark hesabı
    const { stats, yeniIk, kapananIk, degisenAbrechnenderKt, degisiklik } = berechneStats(vorher, nachher);

    if (!degisiklik) {
      const ozet = {
        degisiklik: false,
        dosya: null,
        stichtag,
        aktiv: syncRes.aktiv,
        kommend: syncRes.kommend,
        tablolar: stats,
        yeniIk: [],
        kapananIk: [],
        degisenAbrechnenderKt: [],
      };
      console.log(JSON.stringify(ozet));
      return ozet;
    }

    // 6) Değişiklik var -> dosya metni oluştur
    const nextNum = sonrakiNumara(DEFAULT_MIG_DIR);
    const datumTag = stichtag.replace(/-/g, '');
    const dosyaAd = `${nextNum}_seed_kostentraeger_${datumTag}.sql`;
    const dosyaPfad = join(DEFAULT_MIG_DIR, dosyaAd);

    const { aktiv: aktivMeta, kommend: kommendMeta } = waehleAusgaben(ausgaben, stichtag);
    const aktivMitSha = aktivMeta.map(a => ({
      datei: a.datei,
      gueltigAb: a.gueltigAb,
      sha256: sha256Hesapla(join(ECHT_DIR, a.datei)),
    }));
    const kommendMitSha = kommendMeta.map(k => ({
      datei: k.datei,
      gueltigAb: k.gueltigAb,
      sha256: sha256Hesapla(join(ECHT_DIR, k.datei)),
    }));

    const ozKontrol = await ozKontrolHesapla(query);
    const metin = seedDosyasi({
      version: nextNum,
      stichtag,
      aktiv: aktivMitSha,
      kommend: kommendMitSha,
      tablolar: nachher,
      ozKontrol,
      stats,
    });

    // 7) Kendi kendini doğrula
    if (process.env.DATABASE_URL_DOGRULA) {
      const client2 = new pg.Client({ connectionString: process.env.DATABASE_URL_DOGRULA });
      await client2.connect();
      const query2 = async (sql, params = []) => (params.length ? client2.query(sql, params) : client2.query(sql));
      try {
        await dogrula(query2, metin, {
          nachher,
          kurFn: async (q) => kur(q, { dropSchema: true }),
        });
      } finally {
        await client2.end();
      }
    } else if (!kuru) {
      throw new Error('DATABASE_URL_DOGRULA ist erforderlich für Selbstverifikation vor dem Schreiben');
    }

    // 8) Dosya yazımı
    if (!kuru) {
      writeFileSync(dosyaPfad, metin, 'utf8');
      zaehlerAktualisieren(DEFAULT_ZAEHLER_PFAD, nextNum);
    }

    const ozet = {
      degisiklik: true,
      dosya: kuru ? null : dosyaPfad,
      stichtag,
      aktiv: syncRes.aktiv,
      kommend: syncRes.kommend,
      tablolar: stats,
      yeniIk,
      kapananIk,
      degisenAbrechnenderKt,
    };
    console.log(JSON.stringify(ozet));
    return ozet;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
