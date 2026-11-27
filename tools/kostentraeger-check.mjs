#!/usr/bin/env node
// Kostenträgerdatei-Wächter (onprem/REGISTER.md O-138) — NUR BERICHT.
//
// Liest den RSS-Feed von gkv-datenaustausch.de (Kostenträgerdateien sonstige
// Leistungserbringer), vergleicht die Einträge mit den bekannten Ausgaben und
// prüft jede NEUE Datei gegen die heute gültige Datei derselben Kassenart.
// Schreibt NICHTS ins Repo, nichts in die DB, ruft KEIN Telegram auf — der
// Workflow (.github/workflows/kostentraeger-check.yml) schickt die Nachrichten.
//
// Aufruf:
//   node tools/kostentraeger-check.mjs [--out=DIR] [--dry]
//        [--vergiss=NAME.txt]     Testhilfe: Datei als "unbekannt" behandeln
//        [--rss-datei=PFAD]       Testhilfe: RSS aus lokaler Datei statt Netz
//        [--heute=JJJJ-MM-TT]     Testhilfe: Stichtag
// Ergebnis: <out>/msg-01.txt, msg-02.txt … (je ≤ 3800 Zeichen; keine Datei = Stille)
// und dieselben Texte auf stdout. --dry ist derselbe Lauf (Telegram macht nur der
// Workflow) — die Option bleibt für die Lesbarkeit von Aufrufen.
//
// Sicherheit: aus dem RSS kommt nur ein Dateiname in Frage, und nur wenn der Link
// mit https://www.gkv-datenaustausch.de/ beginnt UND Pfad + Name einem strengen
// Muster entsprechen. Alles andere wird als Auffälligkeit gemeldet, nie benutzt.
//
// Import-Kette: parser.js → ../dta/encoding.js, datei-lesen.js → node:fs. Kein npm.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { leseKostentraegerDatei } from '../api-backend/billing/kostentraeger/datei-lesen.js';
import { parseKostentraegerDatei } from '../api-backend/billing/kostentraeger/parser.js';
import { berlinHeute } from '../api-backend/lib/berlin-tag.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, '..');
const WB_DIR = join(REPO, 'wissensbank', 'gemeinsam', 'kostentraeger');
const AUSGABEN_JSON = join(HIER, 'kostentraeger-ausgaben.json');
const LADER = join(HIER, 'kostentraeger-annahmestellen-laden.mjs');

export const RSS_URL =
  'https://www.gkv-datenaustausch.de/leistungserbringer/sonstige_leistungserbringer/kostentraegerdateien_sle/rss_kostentraegerdateien_sonstige_leistungserbringer.xml';
const LINK_PRAEFIX = 'https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/kostentraegerdateien_1/';
// AO05Q426.ke0 · BN050526.ke0 · LK05Q226.ke0 — Kassenart(2) + "05" + (Qn | Monat) + Jahr(2)
const LINK_RE = /^https:\/\/www\.gkv-datenaustausch\.de\/media\/dokumente\/leistungserbringer_1\/sonstige_leistungserbringer\/kostentraegerdateien_1\/([A-Z]{2}\d{2}(?:Q\d|\d{2})\d{2})\.(ke\d)$/;
export const DATEINAME_RE = /^[A-Z]{2}\d{2}(Q\d|\d{2})\d{2}_KE\d\.txt$/;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_MSG = 3800;

/**
 * @typedef {{ name: string, link: string, gueltigAb: string | null }} KtRssEintrag
 * @typedef {{ name: string, gueltigAb: string }} KtAusgabeInfo
 * @typedef {{ records: number, iks: Set<string>, vkg: number, ersatz: number, vkgLang: number, fehlPartner: Set<string>, papier: Map<string, string> }} KtAnalyse
 */

/** Nur druckbare Zeichen, gekürzt — für alles, was aus dem Netz in eine Nachricht geht.
 * @param {unknown} s
 * @param {number} [n]
 */
export function sauber(s, n = 120) {
  return String(s ?? '').replace(/[^\x20-\x7EÀ-ÿ]/g, '?').slice(0, n);
}

/** RSS-Text → { eintraege: [{name, gueltigAb, link}], unerwartet: [String] } — ohne XML-Bibliothek.
 * @param {string} xml
 */
export function rssParsen(xml) {
  /** @type {KtRssEintrag[]} */
  const eintraege = [];
  /** @type {string[]} */
  const unerwartet = [];
  const items = String(xml).match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    const roh = (it.match(/<guid[^>]*>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/) || [])[1] || '';
    // Seit ca. 11/2026 liefert der Feed "…datenaustausch.de//media/…" (doppelter Schrägstrich):
    // nur direkt nach dem festen Host auf einen zusammenziehen, alles andere bleibt streng.
    const guid = roh.replace(/^(https:\/\/www\.gkv-datenaustausch\.de)\/{2,}/, '$1/');
    const m = LINK_RE.exec(guid);
    if (!m) { unerwartet.push(sauber(guid) || '(leer)'); continue; }
    const name = `${m[1]}_${m[2].toUpperCase()}.txt`;
    if (!DATEINAME_RE.test(name)) { unerwartet.push(sauber(guid)); continue; }
    const d = (it.match(/<description>[\s\S]*?(\d{2})\.(\d{2})\.(\d{4})/) || []);
    eintraege.push({ name, link: guid, gueltigAb: d[1] ? `${d[3]}-${d[2]}-${d[1]}` : null });
  }
  return { eintraege, unerwartet };
}

/** Bekannte Ausgaben: ausgaben-Liste (JSON/Array) + wissensbank-Dateinamen.
 * @param {{ ausgaben?: Array<{ datei?: string, name?: string, gueltigAb: string }> | null, ladeText?: string | null, wbNamen?: string[] }} opts
 */
export function bekannteAusgaben({ ausgaben = null, ladeText = null, wbNamen = [] }) {
  /** @type {KtAusgabeInfo[]} */
  const out = [];
  if (Array.isArray(ausgaben)) {
    for (const a of ausgaben) {
      const name = a.name || a.datei;
      if (name && a.gueltigAb) {
        out.push({ name, gueltigAb: a.gueltigAb });
      }
    }
  } else if (ladeText) {
    for (const m of ladeText.matchAll(/datei:\s*'([^']+)'\s*,\s*gueltigAb:\s*'(\d{4}-\d{2}-\d{2})'/g)) {
      out.push({ name: m[1], gueltigAb: m[2] });
    }
  }
  const bekannt = new Set([...out.map(a => a.name.toUpperCase()), ...wbNamen.map(n => n.toUpperCase())]);
  return { ausgaben: out, bekannt };
}

/** Heute gültige Ausgabe derselben Kassenart (neueste mit gültig-ab <= Stichtag).
 * @param {string} name
 * @param {KtAusgabeInfo[]} ausgaben
 * @param {string} heute
 */
export function basisFuer(name, ausgaben, heute) {
  const art = name.slice(0, 2);
  return ausgaben
    .filter(a => a.name.startsWith(art) && a.gueltigAb <= heute)
    .sort((a, b) => (a.gueltigAb < b.gueltigAb ? 1 : a.gueltigAb > b.gueltigAb ? -1 : 0))[0] || null;
}

/** Kennzahlen einer Datei (Text bereits dekodiert).
 * @param {string} text
 * @returns {KtAnalyse}
 */
export function analysiere(text) {
  const records = /** @type {Array<{ ik: string, name?: string, namensteile?: string[], datenannahmestellen: Array<{ verknuepfungsart?: string, partner_ik?: string, abrechnungsstelle_ik?: string }> }>} */ (
    /** @type {unknown} */ (parseKostentraegerDatei(text))
  );
  const iks = new Set(records.map(r => r.ik));
  let vkg = 0;
  /** @type {Set<string>} */
  let fehlPartner = new Set();
  /** @type {Map<string, string>} */
  const papier = new Map(); // IK → sortierte Partner-IKs der VKG-09-Zeilen
  for (const r of records) {
    /** @type {string[]} */
    const p = [];
    for (const v of r.datenannahmestellen) {
      vkg++;
      for (const ik of [v.partner_ik, v.abrechnungsstelle_ik]) {
        if (ik && !iks.has(ik)) fehlPartner.add(ik);
      }
      if (v.verknuepfungsart === '09' && v.partner_ik) p.push(v.partner_ik);
    }
    if (p.length) papier.set(r.ik, [...new Set(p)].sort().join(','));
  }
  const ersatz = records.filter(r => /�/.test(r.name || '') || (r.namensteile || []).some(n => /�/.test(n))).length;
  // W-01 #12: rohe VKG-Segmente mit mehr als 10 Feldern (Parser liest nur 10)
  const roh = text.replace(/\r\n|\r|\n/g, '').split(/(?<!\?)'/);
  const vkgLang = roh.filter(s => s.startsWith('VKG+') && s.split(/(?<!\?)\+/).length - 1 > 10).length;
  return { records: records.length, iks, vkg, ersatz, vkgLang, fehlPartner, papier };
}

/**
 * @param {string[]} arr
 * @param {number} [n]
 */
const zeige = (arr, n = 5) => arr.slice(0, n).join(', ') + (arr.length > n ? ` … (+${arr.length - n})` : '');
/**
 * @param {number} a
 * @param {number} b
 */
const delta = (a, b) => `${a} (Basis ${b}, ${a - b >= 0 ? '+' : ''}${a - b})`;

/** Abschnitt (Text) für EINE neue Datei; wirft nicht — Fehler werden zum Abschnitt.
 * @param {{ eintrag: KtRssEintrag & { heute?: string }, sha: string, neu: KtAnalyse, basis: KtAnalyse | null, basisName?: string }} opts
 */
export function berichtDatei({ eintrag, sha, neu, basis, basisName }) {
  const z = [];
  z.push(`== ${eintrag.name} — NEU (gültig ab ${eintrag.gueltigAb || '?'}) ==`);
  z.push(`sha256: ${sha}`);
  z.push(`Kennzahlen: Datensätze ${neu.records}, IK ${neu.iks.size}, VKG ${neu.vkg}`);
  const warn = [];
  if (neu.records === 0) warn.push('0 Datensätze geparst — Format geändert?');
  if (neu.ersatz > 0) warn.push(`${neu.ersatz} Namen mit U+FFFD (Kodierung kaputt)`);
  if (neu.vkgLang > 0) warn.push(`${neu.vkgLang} VKG-Zeilen mit >10 Feldern (Parser liest nur 10, W-01 #12)`);
  if (basis) {
    z.push(`Vergleich mit heute gültiger Datei: ${basisName}`);
    z.push(`  Datensätze ${delta(neu.records, basis.records)} · IK ${delta(neu.iks.size, basis.iks.size)} · VKG ${delta(neu.vkg, basis.vkg)}`);
    const neueIk = [...neu.iks].filter(i => !basis.iks.has(i)).sort();
    const weg = [...basis.iks].filter(i => !neu.iks.has(i)).sort();
    z.push(`  neue IK: ${neueIk.length}${neueIk.length ? ' — ' + zeige(neueIk) : ''}`);
    z.push(`  weggefallene IK: ${weg.length}${weg.length ? ' — ' + zeige(weg) : ''}`);
    z.push(`  IK-Kette (VKG-Partner/Abrechnungsstelle nicht in Datei): ${neu.fehlPartner.size} (Basis ${basis.fehlPartner.size})`);
    if (neu.fehlPartner.size > basis.fehlPartner.size) warn.push(`IK-Kette: ${neu.fehlPartner.size - basis.fehlPartner.size} mehr fehlende Partner-IK als in der Basis (${zeige([...neu.fehlPartner].sort())})`);
    const gew = [];
    for (const [ik, p] of neu.papier) {
      if (basis.papier.has(ik) && basis.papier.get(ik) !== p) gew.push(`${ik}: ${basis.papier.get(ik)} → ${p}`);
    }
    const np = [...neu.papier.keys()].filter(i => !basis.papier.has(i) && basis.iks.has(i)).length;
    const wp = [...basis.papier.keys()].filter(i => !neu.papier.has(i) && neu.iks.has(i)).length;
    z.push(`  Papierannahmestelle (VKG 09) — Partner gewechselt: ${gew.length}${gew.length ? ' — ' + zeige(gew, 4) : ''}; neu vorhanden: ${np}; entfallen: ${wp}`);
    if (gew.length || np || wp) warn.push('Papierannahmestellen ändern sich (Urbelege-Postweg) — vor dem Laden prüfen');
  } else {
    z.push('Vergleich: keine Basisdatei derselben Kassenart gefunden (nur Kennzahlen)');
    warn.push('keine Vergleichsbasis');
    if (neu.fehlPartner.size) z.push(`  IK-Kette: ${neu.fehlPartner.size} Partner-IK nicht in Datei`);
  }
  if (eintrag.gueltigAb && eintrag.heute && eintrag.gueltigAb <= eintrag.heute) warn.push('bereits GÜLTIG (gültig-ab liegt in der Vergangenheit) — dringend');
  z.push(warn.length ? 'WARNUNG:\n' + warn.map(w => '  - ' + w).join('\n') : 'Auffälligkeiten: keine');
  return z.join('\n');
}

/** Abschnitte → Nachrichten ≤ MAX_MSG; Kopf vorn, Erinnerung hinten.
 * @param {string[]} abschnitte
 * @param {string} kopf
 * @param {string} fuss
 */
export function nachrichten(abschnitte, kopf, fuss) {
  const out = [];
  let cur = kopf + '\n';
  for (const a of abschnitte) {
    const teil = a.length > MAX_MSG - 200 ? a.slice(0, MAX_MSG - 230) + '\n[gekürzt]' : a;
    if ((cur + '\n' + teil).length > MAX_MSG) { out.push(cur); cur = ''; }
    cur += '\n' + teil + '\n';
  }
  if ((cur + '\n' + fuss).length > MAX_MSG) { out.push(cur); cur = ''; }
  cur += '\n' + fuss;
  out.push(cur);
  return out;
}

/**
 * @param {string} url
 * @param {{ text?: boolean }} [opts]
 * @returns {Promise<string | Buffer>}
 */
async function holen(url, { text = false } = {}) {
  let letzter;
  for (let v = 1; v <= 3; v++) {
    try {
      const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error(`zu groß (${buf.length} Bytes)`);
      return text ? buf.toString('utf8') : buf;
    } catch (e) {
      letzter = e;
      await new Promise(r => setTimeout(r, 2000 * v));
    }
  }
  throw letzter;
}

/**
 * @param {{ out?: string, vergiss?: string[], rssDatei?: string | null, heute?: string | null, ausgaben?: Array<{ datei?: string, name?: string, gueltigAb: string }> | null, ladeText?: string | null, wbNamen?: string[] | null }} [opts]
 */
export async function lauf({ out = '.', vergiss = [], rssDatei = null, heute = null, ausgaben = null, ladeText = null, wbNamen = null } = {}) {
  const stichtag = heute || berlinHeute();
  let rawAusgaben = ausgaben;
  if (!rawAusgaben && ladeText === null) {
    try {
      const parsed = JSON.parse(readFileSync(AUSGABEN_JSON, 'utf8'));
      rawAusgaben = Array.isArray(parsed) ? parsed : parsed.ausgaben;
    } catch {
      rawAusgaben = [];
    }
  }
  const { ausgaben: ausgabenListe, bekannt } = bekannteAusgaben({
    ausgaben: rawAusgaben,
    ladeText,
    wbNamen: wbNamen ?? readdirSync(WB_DIR).filter(n => DATEINAME_RE.test(n)),
  });
  for (const v of vergiss) {
    bekannt.delete(v.toUpperCase());
    const i = ausgabenListe.findIndex(a => a.name.toUpperCase() === v.toUpperCase());
    if (i >= 0) ausgabenListe.splice(i, 1);
  }

  // 1) RSS — nicht abrufbar/leer = der Wächter ist blind. Kein Zustand: jeden Tag erneut melden.
  let xml;
  try {
    xml = rssDatei ? readFileSync(rssDatei, 'utf8') : /** @type {string} */ (await holen(RSS_URL, { text: true }));
  } catch (e) {
    return { meldungen: [`Kostenträgerdatei-Wächter BLIND: RSS nicht abrufbar (${sauber(e instanceof Error ? e.message : String(e), 80)}). Es wird täglich erneut gemeldet, bis der Feed wieder lädt — bis dahin neue Dateien manuell auf gkv-datenaustausch.de prüfen.`], neu: 0 };
  }
  const { eintraege, unerwartet } = rssParsen(xml);
  if (!eintraege.length) {
    return { meldungen: [`Kostenträgerdatei-Wächter BLIND: RSS geladen, aber 0 gültige Einträge (Format geändert?). ${unerwartet.length} unerwartete Einträge${unerwartet.length ? ': ' + zeige(unerwartet, 3) : ''}. Täglich erneut, bis behoben.`], neu: 0 };
  }

  const neue = eintraege.filter(e => !bekannt.has(e.name.toUpperCase()));
  const abschnitte = [];
  if (unerwartet.length) abschnitte.push(`== RSS-Auffälligkeit ==\n${unerwartet.length} Eintrag/Einträge mit unerwartetem Link-/Namensmuster (nicht heruntergeladen): ${zeige(unerwartet, 3)}`);

  // 2) jede neue Datei einzeln — ein Fehler unterdrückt die anderen nicht (O-130)
  for (const e of neue) {
    try {
      const bytes = /** @type {Buffer} */ (await holen(e.link));
      const sha = createHash('sha256').update(bytes).digest('hex');
      mkdirSync(join(out, 'dl'), { recursive: true });
      const pfad = join(out, 'dl', e.name); // e.name ist streng validiert
      writeFileSync(pfad, bytes);
      const text = leseKostentraegerDatei(pfad);
      if (!/^UN[AB]/.test(text)) throw new Error('kein EDIFACT (weder UNA noch UNB am Anfang)'); // BN-Datei hat keinen UNA-Kopf
      const neu = analysiere(text);
      const bs = basisFuer(e.name, ausgabenListe, stichtag);
      let basis = null;
      try { if (bs) basis = analysiere(leseKostentraegerDatei(join(WB_DIR, bs.name))); } catch { /* Basis nicht lesbar → ohne Vergleich */ }
      abschnitte.push(berichtDatei({ eintrag: { ...e, heute: stichtag }, sha, neu, basis, basisName: bs?.name }));
    } catch (err) {
      abschnitte.push(`== ${e.name} — NEU, aber FEHLER ==\n${sauber(err instanceof Error ? err.message : String(err), 200)}\nQuelle: ${e.link}`);
    }
  }

  if (!abschnitte.length) return { meldungen: [], neu: 0 }; // nichts Neues → Stille
  const kopf = `Kostenträgerdatei-Wächter (O-138): ${neue.length} neue Datei(en) im RSS, ${eintraege.length} Einträge insgesamt. Nur Bericht — nichts übernommen.`;
  const fuss = neue.length
    ? 'Freigabe -> Datei in wissensbank/gemeinsam/kostentraeger/ ablegen (W-01), in tools/kostentraeger-ausgaben.json eintragen, laden (db-ustasi).'
    : '';
  return { meldungen: nachrichten(abschnitte, kopf, fuss), neu: neue.length };
}

/** @param {string} n */
const arg = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').slice(n.length + 3) || null;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = arg('out') || join(REPO, 'kostentraeger-check-out');
  mkdirSync(out, { recursive: true });
  const vergiss = process.argv.filter(a => a.startsWith('--vergiss=')).map(a => a.slice(10));
  try {
    const { meldungen, neu } = await lauf({ out, vergiss, rssDatei: arg('rss-datei'), heute: arg('heute') });
    meldungen.forEach((m, i) => {
      writeFileSync(join(out, `msg-${String(i + 1).padStart(2, '0')}.txt`), m);
      console.log(m + '\n');
    });
    if (!meldungen.length) console.log('Nichts Neues — keine Nachricht.');
    else console.log(`(${meldungen.length} Nachricht(en) in ${out}, neue Dateien: ${neu})`);
  } catch (e) {
    // Absturz des Wächters selbst: Nachricht schreiben (Workflow sendet sie), Job rot.
    writeFileSync(join(out, 'msg-01.txt'), `Kostenträgerdatei-Wächter ABGESTÜRZT: ${sauber(e instanceof Error ? e.message : String(e), 200)}. Actions-Log prüfen.`);
    console.error(e);
    process.exit(1);
  }
}
