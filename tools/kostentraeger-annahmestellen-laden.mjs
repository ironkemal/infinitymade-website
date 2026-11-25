#!/usr/bin/env node
// Synchronisiert die Kostenträgerdateien (TP5) mit der DB — DATUMSGESTEUERT.
//   kostentraeger                 Enddaten/Änderungen/neue IK (nie DELETE, FK prescriptions)
//   kostentraeger_annahmestellen  VKG-Zeilen (Datenannahmestelle) — Sync auf den Stichtagsstand
//   kostentraeger_anschriften     ANS-Zeilen — Sync auf den Stichtagsstand
//
// Nutzung:
//   node tools/kostentraeger-annahmestellen-laden.mjs                        # nur anzeigen (DB nur LESEN)
//   node tools/kostentraeger-annahmestellen-laden.mjs --stichtag=2026-10-01  # Vorschau des Wechsels
//   node tools/kostentraeger-annahmestellen-laden.mjs --write                # tatsächlich schreiben
//
// Neue Lieferung: Datei in tools/kostentraeger-ausgaben.json eintragen (Dateiname +
// gültig-ab laut wissensbank/REGISTER.md W-01), alte Zeile STEHEN LASSEN (Datei bleibt im Repo).
// ⚠️ Die Tabellen werden im laufenden Abrechnungsbetrieb gelesen — kein TRUNCATE.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { berlinHeute, istStichtag } from '../api-backend/lib/berlin-tag.js';
import { parseKostentraegerDatei } from '../api-backend/billing/kostentraeger/parser.js';
import { leseKostentraegerDatei } from '../api-backend/billing/kostentraeger/datei-lesen.js';
import {
  waehleAusgaben, planKostentraeger, sollZeilen, planKind,
  VKG_SCHLUESSEL, ANS_SCHLUESSEL, adim2Sperre,
} from '../api-backend/billing/kostentraeger/lade-plan.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, '..');
export const ECHT_DIR = join(REPO, 'wissensbank', 'gemeinsam', 'kostentraeger');
export const DATEINAME_RE = /^[A-Z]{2}\d{2}(Q\d|\d{2})\d{2}_KE\d\.txt$/;

const ERLAUBTE_TABELLEN = new Set([
  'kostentraeger',
  'kostentraeger_annahmestellen',
  'kostentraeger_anschriften',
]);

const DATUM_SPALTEN = new Set(['valid_from', 'valid_to', 'quelle_stand']);

function pruefeTabelle(tabelle) {
  if (!ERLAUBTE_TABELLEN.has(tabelle)) {
    throw new Error(`Unerlaubte Tabelle: ${tabelle}`);
  }
}

function pruefeSpalte(spalte) {
  if (typeof spalte !== 'string' || !/^[a-z_]+$/.test(spalte)) {
    throw new Error(`Ungültiger Spaltenname: ${spalte}`);
  }
}

function formatiereZeile(row) {
  if (!row) return row;
  const neu = { ...row };
  for (const [k, v] of Object.entries(neu)) {
    if (v instanceof Date) {
      neu[k] = v.toISOString().slice(0, 10);
    }
  }
  return neu;
}

/**
 * Liest die Ausgaben-Liste aus JSON und validiert jeden Eintrag.
 * @param {string} [pfad]
 * @returns {Array<{ datei: string, gueltigAb: string, not?: string }>}
 */
export function ladeAusgaben(pfad = join(HIER, 'kostentraeger-ausgaben.json')) {
  let text;
  try {
    text = readFileSync(pfad, 'utf8');
  } catch (err) {
    throw new Error(`Ausgaben-Datei konnte nicht gelesen werden (${pfad}): ${err instanceof Error ? err.message : String(err)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Ungültiges JSON in Ausgaben-Datei (${pfad}): ${err instanceof Error ? err.message : String(err)}`);
  }
  const ausgaben = Array.isArray(json) ? json : json?.ausgaben;
  if (!Array.isArray(ausgaben)) {
    throw new Error(`Ausgaben-Datei (${pfad}) enthält kein 'ausgaben'-Array.`);
  }

  const geseheneDateien = new Set();
  for (const [idx, item] of ausgaben.entries()) {
    if (!item || typeof item !== 'object') {
      throw new Error(`Eintrag an Index ${idx} in Ausgaben ist kein Objekt.`);
    }
    const { datei, gueltigAb } = item;
    if (typeof datei !== 'string' || !DATEINAME_RE.test(datei)) {
      throw new Error(`Ungültiger Dateiname in Ausgaben: '${datei}'`);
    }
    if (!istStichtag(gueltigAb)) {
      throw new Error(`Ungültiges Datum 'gueltigAb' in Ausgaben für '${datei}': '${gueltigAb}'`);
    }
    if (geseheneDateien.has(datei)) {
      throw new Error(`Doppelte Datei in Ausgaben: '${datei}'`);
    }
    geseheneDateien.add(datei);

    const dateiPfad = join(ECHT_DIR, datei);
    if (!existsSync(dateiPfad)) {
      throw new Error(`Datei nicht in wissensbank gefunden (${ECHT_DIR}): '${datei}'`);
    }
  }

  return ausgaben;
}

/**
 * @param {{ datei: string, gueltigAb: string }} ausgabe
 * @returns {Parameters<typeof planKostentraeger>[0]['aktiv'][number]}
 */
export function parseDatei(ausgabe) {
  return {
    ausgabe,
    records: /** @type {Parameters<typeof planKostentraeger>[0]['aktiv'][number]['records']} */ (
      /** @type {unknown} */ (parseKostentraegerDatei(leseKostentraegerDatei(join(ECHT_DIR, ausgabe.datei))))
    ),
  };
}

export function envLesen() {
  const text = readFileSync(join(REPO, 'api-backend', '.env'), 'utf8');
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

/** @param {Record<string, string>} env */
export function restClient(env) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const kopf = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  const json = { ...kopf, 'Content-Type': 'application/json' };
  /**
   * @param {Response} res
   * @param {string} was
   */
  const pruefen = async (res, was) => {
    if (!res.ok) { console.error(`${was} fehlgeschlagen: ${res.status} ${(await res.text()).slice(0, 500)}`); process.exit(1); }
  };
  return {
    /**
     * @param {string} tabelle
     * @param {string} select
     * @param {string} order
     */
    async alle(tabelle, select, order) {
      /** @type {any[]} */
      const out = [];
      for (let o = 0; ; o += 1000) {
        const res = await fetch(`${base}/${tabelle}?select=${select}&order=${order}&offset=${o}&limit=1000`, { headers: kopf });
        await pruefen(res, `Lesen ${tabelle}`);
        const j = /** @type {any[]} */ (await res.json());
        out.push(...j);
        if (j.length < 1000) break;
      }
      return out;
    },
    /**
     * @param {string} tabelle
     * @param {Array<Record<string, unknown>>} zeilen
     */
    async insert(tabelle, zeilen) {
      for (let i = 0; i < zeilen.length; i += 500) {
        const res = await fetch(`${base}/${tabelle}`, { method: 'POST', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify(zeilen.slice(i, i + 500)) });
        await pruefen(res, `INSERT ${tabelle} ${i}`);
      }
    },
    /**
     * @param {string} tabelle
     * @param {Array<Record<string, unknown>>} zeilen
     * @param {string} onConflict
     */
    async upsert(tabelle, zeilen, onConflict) {
      for (let i = 0; i < zeilen.length; i += 500) {
        const res = await fetch(`${base}/${tabelle}?on_conflict=${onConflict}`, { method: 'POST', headers: { ...json, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(zeilen.slice(i, i + 500)) });
        await pruefen(res, `UPSERT ${tabelle} ${i}`);
      }
    },
    /**
     * @param {string} tabelle
     * @param {string} ik
     * @param {Record<string, unknown>} felder
     */
    async patch(tabelle, ik, felder) {
      const res = await fetch(`${base}/${tabelle}?ik=eq.${encodeURIComponent(ik)}`, { method: 'PATCH', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ ...felder, updated_at: new Date().toISOString() }) });
      await pruefen(res, `PATCH ${tabelle} ${ik}`);
    },
    /**
     * @param {string} tabelle
     * @param {Array<string | number>} ids
     * @param {string} validTo
     */
    async schliessen(tabelle, ids, validTo) {
      for (let i = 0; i < ids.length; i += 100) {
        const res = await fetch(`${base}/${tabelle}?id=in.(${ids.slice(i, i + 100).join(',')})`, { method: 'PATCH', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ valid_to: validTo }) });
        await pruefen(res, `valid_to ${tabelle}`);
      }
    },
  };
}

/**
 * SQL-Client für direkte Postgres-/PGlite-Verbindung.
 * @param {(text: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 */
export function sqlClient(query) {
  return {
    /**
     * @param {string} tabelle
     * @param {string} select
     * @param {string} [order]
     */
    async alle(tabelle, select, order) {
      pruefeTabelle(tabelle);
      const spalten = select.split(',').map(s => s.trim());
      for (const s of spalten) pruefeSpalte(s);

      const spaltenSelect = spalten.map(s => (DATUM_SPALTEN.has(s) ? `${s}::text AS ${s}` : s)).join(', ');

      let orderSql = '';
      if (order) {
        const parts = order.split('.');
        const col = parts[0];
        const dir = (parts[1] || 'asc').toLowerCase();
        pruefeSpalte(col);
        if (dir !== 'asc' && dir !== 'desc') {
          throw new Error(`Ungültige Sortierrichtung: ${dir}`);
        }
        orderSql = ` ORDER BY ${col} ${dir.toUpperCase()}`;
      }

      const sql = `SELECT ${spaltenSelect} FROM ${tabelle}${orderSql}`;
      const res = await query(sql, []);
      return (res.rows || []).map(formatiereZeile);
    },

    /**
     * @param {string} tabelle
     * @param {Array<Record<string, unknown>>} zeilen
     */
    async insert(tabelle, zeilen) {
      pruefeTabelle(tabelle);
      if (!zeilen || zeilen.length === 0) return;

      const spalten = Object.keys(zeilen[0]);
      for (const s of spalten) pruefeSpalte(s);

      for (let i = 0; i < zeilen.length; i += 500) {
        const chunk = zeilen.slice(i, i + 500);
        let paramIdx = 1;
        const valueClauses = [];
        const params = [];

        for (const row of chunk) {
          const rowParams = [];
          for (const s of spalten) {
            rowParams.push(`$${paramIdx++}`);
            params.push(row[s] ?? null);
          }
          valueClauses.push(`(${rowParams.join(', ')})`);
        }

        const sql = `INSERT INTO ${tabelle} (${spalten.join(', ')}) VALUES ${valueClauses.join(', ')}`;
        await query(sql, params);
      }
    },

    /**
     * @param {string} tabelle
     * @param {Array<Record<string, unknown>>} zeilen
     * @param {string} onConflict
     */
    async upsert(tabelle, zeilen, onConflict) {
      pruefeTabelle(tabelle);
      if (!zeilen || zeilen.length === 0) return;

      const spalten = Object.keys(zeilen[0]);
      for (const s of spalten) pruefeSpalte(s);

      const conflictCols = onConflict.split(',').map(s => s.trim());
      for (const c of conflictCols) pruefeSpalte(c);
      const conflictSet = new Set(conflictCols);

      const updateCols = spalten.filter(c => !conflictSet.has(c));

      for (let i = 0; i < zeilen.length; i += 500) {
        const chunk = zeilen.slice(i, i + 500);
        let paramIdx = 1;
        const valueClauses = [];
        const params = [];

        for (const row of chunk) {
          const rowParams = [];
          for (const s of spalten) {
            rowParams.push(`$${paramIdx++}`);
            params.push(row[s] ?? null);
          }
          valueClauses.push(`(${rowParams.join(', ')})`);
        }

        let doClause;
        if (updateCols.length > 0) {
          const setList = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
          doClause = `DO UPDATE SET ${setList}`;
        } else {
          doClause = 'DO NOTHING';
        }

        const sql = `INSERT INTO ${tabelle} (${spalten.join(', ')}) VALUES ${valueClauses.join(', ')} ON CONFLICT (${conflictCols.join(', ')}) ${doClause}`;
        await query(sql, params);
      }
    },

    /**
     * @param {string} tabelle
     * @param {string} ik
     * @param {Record<string, unknown>} felder
     */
    async patch(tabelle, ik, felder) {
      pruefeTabelle(tabelle);
      const spalten = Object.keys(felder);
      for (const s of spalten) pruefeSpalte(s);

      const setClauses = spalten.map((s, idx) => `${s} = $${idx + 2}`);
      setClauses.push('updated_at = now()');

      const sql = `UPDATE ${tabelle} SET ${setClauses.join(', ')} WHERE ik = $1`;
      const params = [ik, ...spalten.map(s => felder[s] ?? null)];
      await query(sql, params);
    },

    /**
     * @param {string} tabelle
     * @param {Array<string | number>} ids
     * @param {string} validTo
     */
    async schliessen(tabelle, ids, validTo) {
      pruefeTabelle(tabelle);
      if (!ids || ids.length === 0) return;

      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const sql = `UPDATE ${tabelle} SET valid_to = $1 WHERE id = ANY($2)`;
        await query(sql, [validTo, chunk]);
      }
    },
  };
}

/**
 * Synchronisiert die Kostenträger-Tabellen mit dem Datenbestand zum Stichtag.
 * @param {{
 *   db: ReturnType<typeof restClient> | ReturnType<typeof sqlClient> | any,
 *   stichtag: string,
 *   write?: boolean,
 *   ausgaben?: Array<{ datei: string, gueltigAb: string, not?: string }>,
 *   heute?: string,
 *   log?: (...args: any[]) => void,
 * }} opts
 */
export async function synchronisiere({ db, stichtag, write = false, ausgaben, heute = berlinHeute(), log = console.log }) {
  if (!istStichtag(stichtag)) {
    const err = new Error('--stichtag=YYYY-MM-DD (echtes Datum)');
    /** @type {any} */ (err).kod = 1;
    throw err;
  }
  const sperre = write ? adim2Sperre(stichtag, heute) : null;
  if (sperre) {
    const err = new Error(sperre);
    /** @type {any} */ (err).kod = 4;
    throw err;
  }

  const ausgabenListe = ausgaben || ladeAusgaben();
  const { aktiv: aktivA, kommend: kommendA, ohneGueltige } = waehleAusgaben(ausgabenListe, stichtag);
  if (ohneGueltige.length) {
    const err = new Error(`Keine zum ${stichtag} gültige Ausgabe für Kassenart ${ohneGueltige.join(', ')}`);
    /** @type {any} */ (err).kod = 2;
    throw err;
  }
  const aktiv = aktivA.map(parseDatei);
  const kommend = kommendA.map(parseDatei);

  log(`Stichtag: ${stichtag}${stichtag === heute ? ' (heute, Berlin)' : ' (vorgegeben)'}`);
  for (const e of aktiv) log(`  gültig  ${e.ausgabe.datei} (ab ${e.ausgabe.gueltigAb}): ${e.records.length} Datensätze`);
  for (const e of kommend) log(`  kommend ${e.ausgabe.datei} (ab ${e.ausgabe.gueltigAb}): ${e.records.length} Datensätze — nur Enddaten`);
  const ffd = [...aktiv, ...kommend].reduce((n, e) => n + e.records.filter(r => (r.name || '').includes('\uFFFD')).length, 0);
  if (ffd) {
    const err = new Error(`Abbruch: ${ffd} Namen mit U+FFFD (Kodierung).`);
    /** @type {any} */ (err).kod = 3;
    throw err;
  }

  // 1) kostentraeger
  const ktDb = await db.alle('kostentraeger', 'ik,name,kurzname,valid_from,valid_to,abrechnender_kt_ik,ist_abrechnender_kt,quelle,quelle_stand,datensatz_status', 'ik.asc');
  const kt = planKostentraeger({ dbZeilen: ktDb, aktiv, kommend, stichtag });
  const enddaten = kt.patches.filter(p => 'valid_to' in p.patch);
  log(`\nkostentraeger (DB ${ktDb.length} Zeilen): ${kt.inserts.length} neue IK, ${kt.patches.length} Änderungen (davon Enddaten: ${enddaten.length}), ${kt.namensabweichungen} Namensabweichungen (Name wird nie überschrieben), 0 Löschungen (nie)`);
  for (const p of enddaten.slice(0, 5)) log(`   Enddatum ${p.ik}: ${JSON.stringify(p.patch)}  [${p.grund}]`);

  // 2) VKG / Anschriften
  const { vkg, ans, ungueltigeAnschriften } = sollZeilen(aktiv);
  const vkgDb = await db.alle('kostentraeger_annahmestellen', 'id,kostentraeger_ik,verknuepfungsart,partner_ik,leistungserbringergruppe,abrechnungscode,art_datenlieferung,uebermittlungsmedium,bundesland,quelle,quelle_stand,valid_from,valid_to', 'id.asc');
  const ansDb = await db.alle('kostentraeger_anschriften', 'id,kostentraeger_ik,art,plz,ort,strasse,quelle,quelle_stand,valid_from,valid_to', 'id.asc');
  const vkgPlan = planKind({ dbZeilen: vkgDb, soll: vkg, felder: VKG_SCHLUESSEL, vergleich: ['quelle', 'quelle_stand', 'leistungserbringergruppe'] });
  const ansPlan = planKind({ dbZeilen: ansDb, soll: ans, felder: ANS_SCHLUESSEL, vergleich: ['quelle', 'quelle_stand'] });
  if (ungueltigeAnschriften) console.warn(`⚠️  ${ungueltigeAnschriften} ANS-Segmente mit art ausserhalb 1/2/3 ignoriert.`);
  log(`kostentraeger_annahmestellen (DB ${vkgDb.length}, Soll ${vkg.size}): +${vkgPlan.inserts.length} neu, ~${vkgPlan.updates.length} aktualisiert, ${vkgPlan.reopens.length} wieder offen, ${vkgPlan.closes.length} beendet (valid_to, kein DELETE)`);
  log(`kostentraeger_anschriften    (DB ${ansDb.length}, Soll ${ans.size}): +${ansPlan.inserts.length} neu, ~${ansPlan.updates.length} aktualisiert, ${ansPlan.reopens.length} wieder offen, ${ansPlan.closes.length} beendet (valid_to, kein DELETE)`);
  for (const z of vkgPlan.closes.slice(0, 3)) log(`   beenden VKG id ${z.id} bis ${z.valid_to}`);
  for (const z of vkgPlan.inserts.slice(0, 3)) log(`   neu     VKG ${z.kostentraeger_ik} ${z.verknuepfungsart} ${z.partner_ik} code ${z.abrechnungscode}`);
  const umlaute = aktiv.flatMap(e => e.records).filter(r => /[äöüßÄÖÜ]/.test(r.name || '')).slice(0, 3);
  log('Namensprobe (Umlaute):', umlaute.map(r => `${r.ik} ${r.name}`).join(' | '));

  const ergebnis = {
    stichtag,
    aktiv: aktivA.map(a => a.datei),
    kommend: kommendA.map(a => a.datei),
    kt: { inserts: kt.inserts, patches: kt.patches, enddaten },
    vkg: { inserts: vkgPlan.inserts, updates: vkgPlan.updates, reopens: vkgPlan.reopens, closes: vkgPlan.closes },
    ans: { inserts: ansPlan.inserts, updates: ansPlan.updates, reopens: ansPlan.reopens, closes: ansPlan.closes },
  };

  if (!write) {
    log('\nNur-Anzeige-Modus (DB nur gelesen). Zum Schreiben: --write');
    return ergebnis;
  }

  // Reihenfolge: erst Eltern (kostentraeger), dann Kinder
  log('\nSchreibe …');
  if (kt.inserts.length) await db.insert('kostentraeger', kt.inserts);
  let n = 0;
  const queue = [...kt.patches];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) { await db.patch('kostentraeger', p.ik, p.patch); n++; }
  }));
  log(`  kostentraeger: ${kt.inserts.length} eingefügt, ${n} geändert`);

  // Erst neue/aktualisierte/wieder geöffnete Zeilen, dann veraltete beenden: kurzzeitig zwei Stände
  // ist besser als kurzzeitig keiner. INSERT und UPDATE getrennt — die Payloads haben verschiedene
  // Spalten (valid_from nur beim INSERT, valid_to nur beim Wiederöffnen).
  /**
   * @param {string} tabelle
   * @param {ReturnType<typeof planKind>} plan
   * @param {readonly string[]} schl
   */
  const schreibeKind = async (tabelle, plan, schl) => {
    if (plan.inserts.length) await db.insert(tabelle, plan.inserts);
    if (plan.updates.length) await db.upsert(tabelle, plan.updates, schl.join(','));
    if (plan.reopens.length) await db.upsert(tabelle, plan.reopens, schl.join(','));
    /** @type {Map<string, Array<string | number>>} */
    const nachBis = new Map();
    for (const c of plan.closes) nachBis.set(c.valid_to, [...(nachBis.get(c.valid_to) || []), c.id]);
    for (const [bis, ids] of nachBis) await db.schliessen(tabelle, ids, bis);
  };
  await schreibeKind('kostentraeger_annahmestellen', vkgPlan, VKG_SCHLUESSEL);
  await schreibeKind('kostentraeger_anschriften', ansPlan, ANS_SCHLUESSEL);
  log('Fertig.');
  return ergebnis;
}

export async function main() {
  const write = process.argv.includes('--write');
  const argSt = process.argv.find(a => a.startsWith('--stichtag='));
  const stichtag = argSt ? argSt.split('=')[1] : berlinHeute();
  const env = envLesen();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in api-backend/.env');
    process.exit(1);
  }
  const db = restClient(env);
  try {
    await synchronisiere({ db, stichtag, write, heute: berlinHeute(), log: console.log });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit((err && typeof err === 'object' && 'kod' in err && typeof err.kod === 'number') ? err.kod : 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
