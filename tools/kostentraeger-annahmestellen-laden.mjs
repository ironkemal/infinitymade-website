#!/usr/bin/env node
// Synchronisiert die Kostenträgerdateien (TP5) mit der DB — DATUMSGESTEUERT.
//   kostentraeger                 Enddaten/Änderungen/neue IK (nie DELETE, FK prescriptions)
//   kostentraeger_annahmestellen  VKG-Zeilen (Datenannahmestelle) — Sync auf den Stichtagsstand
//   kostentraeger_anschriften     ANS-Zeilen — Sync auf den Stichtagsstand
//
// Warum das hier steht (06.09.2026, Ops #264): der erste Import lief per Hand,
// nicht wiederholbar — dieses Script macht ihn mit einem Aufruf erneut.
// 30.09.2026 (W-01 #9-#11): umgebaut für den Q4-Wechsel:
//   · Dateien werden nach Zeichensatz gelesen (Q4 = ISO-8859-1, sonst U+FFFD in Namen)
//   · "gültig" = Datum: je Kassenart zählt die zum STICHTAG gültige Ausgabe
//     (Standard: heute, Berlin; --stichtag=YYYY-MM-DD zum Vorausrechnen)
//   · kostentraeger: Enddaten der KOMMENDEN Ausgabe (IKK Nordrhein 30.09., entfallene IK)
//     werden schon heute gesetzt und wirken erst am Datum — kostentraegerAbfrage()
//     filtert valid_to >= heute. Der übrige Stand kommt nur aus der heute gültigen Ausgabe.
//   · Annahmestellen/Anschriften tragen seit Migration 0046 (O-139) valid_from/valid_to
//     (NULL = offen) und der Leser filtert nach dem Stichtag. Es wird NICHTS mehr gelöscht:
//       neuer Schlüssel            → INSERT mit valid_from = gültig-ab der Ausgabe
//       Schlüssel bleibt           → UPDATE ohne valid_from (sonst wäre die Zeile heute
//                                    ohne Empfänger)
//       Schlüssel fällt weg        → valid_to = Tag vor gültig-ab der neuen Ausgabe
//       geschlossener kehrt zurück → valid_to = NULL
//     Insert und Update laufen als getrennte Aufrufe (PostgREST verlangt einheitliche Spalten).
//     ⚠️ Migration 0046 MUSS vor dem ersten Lauf auf der Ziel-DB angewendet sein, sonst
//     scheitert schon das Lesen von valid_from.
//   · Adim 2 (onprem O-139): --write mit einem Stichtag NACH heute (Berlin) wird verweigert —
//     solange :stable den filternden Leser nicht trägt, dürfen keine Zeilen mit valid_from in
//     der Zukunft entstehen (ein älterer Leser sähe beide Stände). Vorschau ohne --write bleibt.
//
// Nutzung:
//   node tools/kostentraeger-annahmestellen-laden.mjs                        # nur anzeigen (DB nur LESEN)
//   node tools/kostentraeger-annahmestellen-laden.mjs --stichtag=2026-10-01  # Vorschau des Wechsels
//   node tools/kostentraeger-annahmestellen-laden.mjs --write                # tatsächlich schreiben
//
// Neue Lieferung: Datei in AUSGABEN eintragen (Dateiname + gültig-ab laut
// wissensbank/REGISTER.md W-01), alte Zeile STEHEN LASSEN (Datei bleibt im Repo).
// ⚠️ Die Tabellen werden im laufenden Abrechnungsbetrieb gelesen — kein TRUNCATE.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { berlinHeute, istStichtag } from '../api-backend/lib/berlin-tag.js';
import { parseKostentraegerDatei } from '../api-backend/billing/kostentraeger/parser.js';
import { leseKostentraegerDatei } from '../api-backend/billing/kostentraeger/datei-lesen.js';
import {
  waehleAusgaben, planKostentraeger, sollZeilen, planKind,
  VKG_SCHLUESSEL, ANS_SCHLUESSEL, adim2Sperre,
} from '../api-backend/billing/kostentraeger/lade-plan.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, '..');
const ECHT_DIR = join(REPO, 'wissensbank', 'gemeinsam', 'kostentraeger');

// Gültig-ab je Datei (VDT-Segment / Herausgeberseite, wissensbank/REGISTER.md W-01).
// Regel: heute gilt je Kassenart die NEUESTE Ausgabe mit gültig-ab <= Stichtag.
// Nichts hier löschen, wenn eine Ausgabe fällt — das Datum regelt es.
const AUSGABEN = [
  { datei: 'AO05Q326_KE3.txt', gueltigAb: '2026-07-27' },
  { datei: 'BK05Q326_KE1.txt', gueltigAb: '2026-07-01' },
  { datei: 'IK05Q326_KE1.txt', gueltigAb: '2026-07-01' },
  { datei: 'EK05Q226_KE0.txt', gueltigAb: '2026-04-01' },
  // Q4/2026 (30.09.2026 byte-exakt vom Herausgeber, ISO-8859-1). EK05Q426_KE0 ist
  // NIE gültig geworden (durch KE1 ersetzt) und steht bewusst nicht in der Liste.
  { datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-10-01' },
  { datei: 'BK05Q426_KE0.txt', gueltigAb: '2026-10-01' },
  { datei: 'IK05Q426_KE0.txt', gueltigAb: '2026-10-01' },
  { datei: 'EK05Q426_KE1.txt', gueltigAb: '2026-10-01' },
  // Unverändert gültig
  { datei: 'BN050526_KE0.txt', gueltigAb: '2026-05-01' },
  { datei: 'LK05Q226_KE0.txt', gueltigAb: '2025-08-26' },
];

function parseDatei(ausgabe) {
  return { ausgabe, records: parseKostentraegerDatei(leseKostentraegerDatei(join(ECHT_DIR, ausgabe.datei))) };
}

function envLesen() {
  const text = readFileSync(join(REPO, 'api-backend', '.env'), 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function restClient(env) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const kopf = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  const json = { ...kopf, 'Content-Type': 'application/json' };
  const pruefen = async (res, was) => {
    if (!res.ok) { console.error(`${was} fehlgeschlagen: ${res.status} ${(await res.text()).slice(0, 500)}`); process.exit(1); }
  };
  return {
    async alle(tabelle, select, order) {
      const out = [];
      for (let o = 0; ; o += 1000) {
        const res = await fetch(`${base}/${tabelle}?select=${select}&order=${order}&offset=${o}&limit=1000`, { headers: kopf });
        await pruefen(res, `Lesen ${tabelle}`);
        const j = await res.json();
        out.push(...j);
        if (j.length < 1000) break;
      }
      return out;
    },
    async insert(tabelle, zeilen) {
      for (let i = 0; i < zeilen.length; i += 500) {
        const res = await fetch(`${base}/${tabelle}`, { method: 'POST', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify(zeilen.slice(i, i + 500)) });
        await pruefen(res, `INSERT ${tabelle} ${i}`);
      }
    },
    async upsert(tabelle, zeilen, onConflict) {
      for (let i = 0; i < zeilen.length; i += 500) {
        const res = await fetch(`${base}/${tabelle}?on_conflict=${onConflict}`, { method: 'POST', headers: { ...json, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(zeilen.slice(i, i + 500)) });
        await pruefen(res, `UPSERT ${tabelle} ${i}`);
      }
    },
    async patch(tabelle, ik, felder) {
      const res = await fetch(`${base}/${tabelle}?ik=eq.${encodeURIComponent(ik)}`, { method: 'PATCH', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ ...felder, updated_at: new Date().toISOString() }) });
      await pruefen(res, `PATCH ${tabelle} ${ik}`);
    },
    // Gültigkeitsende setzen (kein DELETE mehr, O-139): gleicher Wert je Aufruf, IDs in Blöcken.
    async schliessen(tabelle, ids, validTo) {
      for (let i = 0; i < ids.length; i += 100) {
        const res = await fetch(`${base}/${tabelle}?id=in.(${ids.slice(i, i + 100).join(',')})`, { method: 'PATCH', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ valid_to: validTo }) });
        await pruefen(res, `valid_to ${tabelle}`);
      }
    },
  };
}

async function main() {
  const write = process.argv.includes('--write');
  const argSt = process.argv.find(a => a.startsWith('--stichtag='));
  const stichtag = argSt ? argSt.split('=')[1] : berlinHeute();
  if (!istStichtag(stichtag)) { console.error('--stichtag=YYYY-MM-DD (echtes Datum)'); process.exit(1); }
  const sperre = write ? adim2Sperre(stichtag, berlinHeute()) : null;
  if (sperre) { console.error(sperre); process.exit(4); }

  const { aktiv: aktivA, kommend: kommendA, ohneGueltige } = waehleAusgaben(AUSGABEN, stichtag);
  if (ohneGueltige.length) { console.error(`Keine zum ${stichtag} gültige Ausgabe für Kassenart ${ohneGueltige.join(', ')}`); process.exit(2); }
  const aktiv = aktivA.map(parseDatei);
  const kommend = kommendA.map(parseDatei);

  console.log(`Stichtag: ${stichtag}${argSt ? ' (vorgegeben)' : ' (heute, Berlin)'}`);
  for (const e of aktiv) console.log(`  gültig  ${e.ausgabe.datei} (ab ${e.ausgabe.gueltigAb}): ${e.records.length} Datensätze`);
  for (const e of kommend) console.log(`  kommend ${e.ausgabe.datei} (ab ${e.ausgabe.gueltigAb}): ${e.records.length} Datensätze — nur Enddaten`);
  const ffd = [...aktiv, ...kommend].reduce((n, e) => n + e.records.filter(r => (r.name || '').includes('\uFFFD')).length, 0);
  if (ffd) { console.error(`Abbruch: ${ffd} Namen mit U+FFFD (Kodierung).`); process.exit(3); }

  const env = envLesen();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in api-backend/.env'); process.exit(1); }
  const db = restClient(env);

  // 1) kostentraeger
  const ktDb = await db.alle('kostentraeger', 'ik,name,kurzname,valid_from,valid_to,abrechnender_kt_ik,ist_abrechnender_kt,quelle,quelle_stand,datensatz_status', 'ik.asc');
  const kt = planKostentraeger({ dbZeilen: ktDb, aktiv, kommend, stichtag });
  const enddaten = kt.patches.filter(p => 'valid_to' in p.patch);
  console.log(`\nkostentraeger (DB ${ktDb.length} Zeilen): ${kt.inserts.length} neue IK, ${kt.patches.length} Änderungen (davon Enddaten: ${enddaten.length}), ${kt.namensabweichungen} Namensabweichungen (Name wird nie überschrieben), 0 Löschungen (nie)`);
  for (const p of enddaten.slice(0, 5)) console.log(`   Enddatum ${p.ik}: ${JSON.stringify(p.patch)}  [${p.grund}]`);

  // 2) VKG / Anschriften
  const { vkg, ans, ungueltigeAnschriften } = sollZeilen(aktiv);
  const vkgDb = await db.alle('kostentraeger_annahmestellen', 'id,kostentraeger_ik,verknuepfungsart,partner_ik,leistungserbringergruppe,abrechnungscode,art_datenlieferung,uebermittlungsmedium,bundesland,quelle,quelle_stand,valid_from,valid_to', 'id.asc');
  const ansDb = await db.alle('kostentraeger_anschriften', 'id,kostentraeger_ik,art,plz,ort,strasse,quelle,quelle_stand,valid_from,valid_to', 'id.asc');
  const vkgPlan = planKind({ dbZeilen: vkgDb, soll: vkg, felder: VKG_SCHLUESSEL, vergleich: ['quelle', 'quelle_stand', 'leistungserbringergruppe'] });
  const ansPlan = planKind({ dbZeilen: ansDb, soll: ans, felder: ANS_SCHLUESSEL, vergleich: ['quelle', 'quelle_stand'] });
  if (ungueltigeAnschriften) console.warn(`⚠️  ${ungueltigeAnschriften} ANS-Segmente mit art ausserhalb 1/2/3 ignoriert.`);
  console.log(`kostentraeger_annahmestellen (DB ${vkgDb.length}, Soll ${vkg.size}): +${vkgPlan.inserts.length} neu, ~${vkgPlan.updates.length} aktualisiert, ${vkgPlan.reopens.length} wieder offen, ${vkgPlan.closes.length} beendet (valid_to, kein DELETE)`);
  console.log(`kostentraeger_anschriften    (DB ${ansDb.length}, Soll ${ans.size}): +${ansPlan.inserts.length} neu, ~${ansPlan.updates.length} aktualisiert, ${ansPlan.reopens.length} wieder offen, ${ansPlan.closes.length} beendet (valid_to, kein DELETE)`);
  for (const z of vkgPlan.closes.slice(0, 3)) console.log(`   beenden VKG id ${z.id} bis ${z.valid_to}`);
  for (const z of vkgPlan.inserts.slice(0, 3)) console.log(`   neu     VKG ${z.kostentraeger_ik} ${z.verknuepfungsart} ${z.partner_ik} code ${z.abrechnungscode}`);
  const umlaute = aktiv.flatMap(e => e.records).filter(r => /[äöüßÄÖÜ]/.test(r.name || '')).slice(0, 3);
  console.log('Namensprobe (Umlaute):', umlaute.map(r => `${r.ik} ${r.name}`).join(' | '));

  if (!write) { console.log('\nNur-Anzeige-Modus (DB nur gelesen). Zum Schreiben: --write'); return; }

  // Reihenfolge: erst Eltern (kostentraeger), dann Kinder
  console.log('\nSchreibe …');
  if (kt.inserts.length) await db.insert('kostentraeger', kt.inserts);
  let n = 0;
  const queue = [...kt.patches];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) { await db.patch('kostentraeger', p.ik, p.patch); n++; }
  }));
  console.log(`  kostentraeger: ${kt.inserts.length} eingefügt, ${n} geändert`);
  // Erst neue/aktualisierte/wieder geöffnete Zeilen, dann veraltete beenden: kurzzeitig zwei Stände
  // ist besser als kurzzeitig keiner. INSERT und UPDATE getrennt — die Payloads haben verschiedene
  // Spalten (valid_from nur beim INSERT, valid_to nur beim Wiederöffnen).
  const schreibeKind = async (tabelle, plan, schl) => {
    if (plan.inserts.length) await db.insert(tabelle, plan.inserts);
    if (plan.updates.length) await db.upsert(tabelle, plan.updates, schl.join(','));
    if (plan.reopens.length) await db.upsert(tabelle, plan.reopens, schl.join(','));
    const nachBis = new Map();
    for (const c of plan.closes) nachBis.set(c.valid_to, [...(nachBis.get(c.valid_to) || []), c.id]);
    for (const [bis, ids] of nachBis) await db.schliessen(tabelle, ids, bis);
  };
  await schreibeKind('kostentraeger_annahmestellen', vkgPlan, VKG_SCHLUESSEL);
  await schreibeKind('kostentraeger_anschriften', ansPlan, ANS_SCHLUESSEL);
  console.log('Fertig.');
}

main();
