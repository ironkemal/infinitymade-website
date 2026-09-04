/**
 * preise_pruefen.mjs
 *
 * Vergleicht unsere Heilmittel-Preise (billing/codes/*_positions.js) gegen die vom
 * GKV-Spitzenverband veröffentlichte "Heilmittelpreisstammdatei" — eine maschinenlesbare
 * XML-Datei nach § 73 Abs. 10 SGB V, in einem ZIP pro Preisrunde:
 *
 *   https://www.gkv-heilmittel.de/fuer_vertragsaerzte/heilmittelpreisstammdatei/heilmittelpreise.jsp
 *   .../Hoechstpreise-Alle-Heilmittelbereiche-Stand_TT-MM-JJ.zip
 *
 * Warum es das gibt (Ops-Karte #213, 04.09.2026)
 * ───────────────────────────────────────────────
 * Beta-1 wollte, dass Preisänderungen der Kasse sich "von selbst" im System
 * niederschlagen. Das XML ist dafür KEINE Ersatzquelle — sein eigener
 * Haftungsausschluss sagt "nicht zu Abrechnungszwecken bestimmt, keine Gewähr
 * für Richtigkeit und Vollständigkeit", und es führt weder Zuzahlung noch Dauer
 * noch Diagnosegruppen. Maßgeblich bleibt Anlage 2 (die Codedateien).
 *
 * Was dieses Skript stattdessen tut: es ist eine ZWEITE, unabhängige Quelle, die
 * unsere Zahlen bei jedem Lauf bestätigt oder widerspricht — kein PDF-Parser (die
 * Anlage-2-PDFs sind layout-unzuverlässig, siehe Podoloji/Leistungen/*.txt Zeile
 * 320f., wo ein Preis eine Zeile über seinem Code steht), keine KI (Finanzdaten
 * sollen deterministisch bleiben, nicht "meistens richtig").
 *
 * Nutzung:
 *   node preise_pruefen.mjs                  # neueste Stand-Version von der GKV-Seite holen
 *   node preise_pruefen.mjs --file <xml>     # gegen eine lokale XML-Datei prüfen (Tests/Debug)
 *   node preise_pruefen.mjs --json           # maschinenlesbare Ausgabe zusätzlich zum Text
 *
 * Exit-Code 1 bei Abweichung (unsere Zahl ≠ XML-Zahl für denselben Code).
 * Eine neuere Stand-Version als unser PREISSTAND ist KEIN Abweichungsfehler —
 * die Preise können identisch sein, nur ein neues Zeitfenster eröffnet. Das wird
 * separat gemeldet ("neue Preisrunde"), ändert den Exit-Code aber nicht, damit
 * ein CI-Lauf nicht rot wird, nur weil die GKV ein neues Dokument hochgeladen hat.
 */

import yauzl from 'yauzl';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fetchWithTimeout } from './lib/fetch-with-timeout.js';
import {
  PODOLOGIE_PREISFENSTER,
  PREISSTAND as PODO_PREISSTAND,
} from './billing/codes/podologie_positions.js';
import { PHYSIO_PREISFENSTER, PREISSTAND as PHYSIO_PREISSTAND } from './billing/codes/physio_positions.js';

const LISTE_URL = 'https://www.gkv-heilmittel.de/fuer_vertragsaerzte/heilmittelpreisstammdatei/heilmittelpreise.jsp';
const BASIS_URL = 'https://www.gkv-heilmittel.de';

/**
 * Liest die GKV-Downloadseite und gibt die neueste verfügbare Stand-Version zurück.
 * Reine Regex-Extraktion aus echtem HTML — kein KI-Zusammenfassen, deterministisch.
 */
export async function neuesterStand() {
  const res = await fetchWithTimeout(LISTE_URL, {}, 15000);
  if (!res.ok) throw new Error(`GKV-Seite: HTTP ${res.status}`);
  const html = await res.text();
  const treffer = [...html.matchAll(
    /href="([^"]*Hoechstpreise-Alle-Heilmittelbereiche-Stand_(\d{2}-\d{2}-\d{2})[^"]*\.zip)"/g
  )];
  if (!treffer.length) {
    throw new Error('Kein Download-Link auf der GKV-Seite gefunden — Seitenstruktur geändert?');
  }
  const parsed = treffer.map(([, href, stand]) => ({ stand, href, datum: standZuDatum(stand) }));
  parsed.sort((a, b) => b.datum - a.datum); // neueste zuerst, unabhängig von der Reihenfolge auf der Seite
  const top = parsed[0];
  return { stand: top.stand, url: new URL(top.href, BASIS_URL).href };
}

function standZuDatum(stand) {
  const [t, m, j] = stand.split('-').map(Number);
  return new Date(2000 + j, m - 1, t); // die Datei existiert erst seit 2025, 2-stelliges Jahr ist eindeutig
}

/** Lädt eine ZIP-URL und gibt den Inhalt der ersten .xml-Datei darin als String zurück. */
export async function ladeXmlAusZip(url) {
  const res = await fetchWithTimeout(url, {}, 30000);
  if (!res.ok) throw new Error(`ZIP-Download fehlgeschlagen: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return entpackeXml(buf);
}

function entpackeXml(buf) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      let gefunden = false;
      zip.readEntry();
      zip.on('entry', (entry) => {
        if (gefunden || !/\.xml$/i.test(entry.fileName)) { zip.readEntry(); return; }
        gefunden = true;
        zip.openReadStream(entry, (err, stream) => {
          if (err) return reject(err);
          const chunks = [];
          stream.on('data', (c) => chunks.push(c));
          stream.on('error', reject);
          stream.on('end', () => { zip.close(); resolve(Buffer.concat(chunks).toString('utf8')); });
        });
      });
      zip.on('end', () => { if (!gefunden) reject(new Error('Keine .xml-Datei im ZIP gefunden')); });
      zip.on('error', reject);
    });
  });
}

/** Parst die Heilmittelpreisstammdatei-XML (Schema HMP4_V03.2) in Zeilen. */
export function parseXml(xml) {
  const zeilen = [];
  for (const block of xml.split('<HMP>').slice(1)) {
    const body = block.split('</HMP>')[0];
    const val = (tag) => {
      const m = body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return m ? m[1] : '';
    };
    zeilen.push({
      hmp4: val('HMP4'),
      bereich: val('Heilmittelbereich'),
      preis: Number(val('Hoechstpreis')),
      gueltig_ab: val('Gueltig_ab'),
      bezeichnung: val('Bezeichnung'),
    });
  }
  return zeilen;
}

/**
 * HMP4-Code → unser Code. Nur Podologie und Physiotherapie sind heute in den
 * Codedateien gepflegt (Ergo/Logo/Ernährungstherapie noch nicht — siehe Karte #213).
 *   Podologie:     X8010 → 78010  (Präfix 'X' → unser ZL-Präfix '7')
 *   Physiotherapie: X0501 → X0501, 20522 → 20522 (schon identisch zum HMP4-Code)
 */
function unserCode(bereich, hmp4) {
  if (bereich === 'Podologie') return '7' + hmp4.slice(1);
  if (bereich === 'Physiotherapie') return hmp4;
  return null;
}

/**
 * Alle unsere Positionen, JEDE mit ihrem eigenen `gueltig_ab` — das ist der Schlüssel,
 * über den verglichen wird (wie `KEY` in sync_heilmittel_katalog.js). Ein XML-Snapshot
 * zeigt für jeden Code immer nur den zum Stand-Datum GERADE gültigen Preis mit dessen
 * echtem Startdatum (geprüft: Stand_01-01-26 listet Podologie-Preise noch mit
 * `Gueltig_ab=2025-07-01`, nicht mit dem Stand-Datum selbst) — Preisfenster, die zu
 * dem Zeitpunkt noch in der Zukunft liegen, tauchen dort schlicht nicht auf. Ohne den
 * Fenstervergleich würde jedes ältere unserer beiden Podologie-Fenster fälschlich als
 * "abweichend" gegen das jeweils andere gemeldet — genau das ist am 04.09.2026 beim
 * ersten Testlauf passiert (18 Scheinabweichungen).
 */
function unserePositionen() {
  const podo = PODOLOGIE_PREISFENSTER.flatMap(f => f.positionen)
    .map(p => ({ code: p.hpnr, bereich: 'podologie', preis: p.preis, label: p.label, gueltig_ab: p.gueltig_ab }));
  const physio = PHYSIO_PREISFENSTER.flatMap(fenster =>
    fenster.positionen.map(p => ({ code: p.x, bereich: 'physiotherapie', preis: p.preis, label: p.label, gueltig_ab: fenster.gueltig_ab })));
  return [...podo, ...physio];
}

/**
 * Vergleicht unsere Codedateien gegen die geparste XML — angetrieben von der XML-Seite,
 * weil jede XML-Zeile die "gerade wahre" Kombination aus Code + Startdatum + Preis ist.
 *
 * @returns {{
 *   ok: number,
 *   abweichend: object[],     // gleicher Code + gleiches gueltig_ab, anderer Preis — echtes Problem
 *   neuePreisrunde: object[], // XML kennt ein späteres gueltig_ab als unser bekanntestes Fenster — wir müssen nachziehen
 *   fehlt: object[],          // Code komplett unbekannt bei uns (z. B. §125a-Blanko-Positionen)
 *   neu: string[],            // Codes nur im XML (informativ, Teilmenge von "fehlt")
 *   gesamt: number,
 * }}
 */
export function vergleiche(zeilen) {
  const unsere = unserePositionen();
  const unsereByCode = new Map();
  for (const p of unsere) {
    if (!unsereByCode.has(p.code)) unsereByCode.set(p.code, []);
    unsereByCode.get(p.code).push(p);
  }

  let ok = 0;
  const abweichend = [];
  const neuePreisrunde = [];
  const fehlt = [];

  for (const z of zeilen) {
    const code = unserCode(z.bereich, z.hmp4);
    if (!code) continue; // Ergo/Logo/Ernährungstherapie — noch nicht in den Codedateien (Karte #213)

    const fenster = unsereByCode.get(code);
    if (!fenster || fenster.length === 0) { fehlt.push({ code, bereich: z.bereich, preis: z.preis, label: z.bezeichnung }); continue; }

    const gleichesFenster = fenster.find(f => f.gueltig_ab === z.gueltig_ab);
    if (gleichesFenster) {
      if (Math.abs(gleichesFenster.preis - z.preis) < 0.005) { ok++; }
      else { abweichend.push({ ...gleichesFenster, xmlPreis: z.preis, xmlGueltigAb: z.gueltig_ab }); }
      continue;
    }

    // Kein Fenster mit exakt diesem Startdatum — hat die XML ein neueres als unser
    // spätestes Fenster für diesen Code? Dann fehlt uns die nächste Preisrunde.
    const spaetestesFenster = fenster.reduce((a, b) => (a.gueltig_ab > b.gueltig_ab ? a : b));
    if (z.gueltig_ab > spaetestesFenster.gueltig_ab) {
      neuePreisrunde.push({ code, bereich: z.bereich, label: z.bezeichnung, xmlPreis: z.preis, xmlGueltigAb: z.gueltig_ab, unserLetztesFenster: spaetestesFenster.gueltig_ab });
    }
    // sonst: XML-Zeile bezieht sich auf ein älteres, bei uns nicht mehr geführtes
    // Fenster (z. B. eine Preisrunde vor 2025) — kein Fehler, keine Aktion nötig.
    //
    // Bekannter, harmloser Fall (geprüft 04.09.2026, Stand_01-01-26 gegen 78610/78620):
    // die GKV-XML datiert `Gueltig_ab` nach PREISRUNDE (Anlage 2 §2 = 01.07.2025),
    // unsere Codedatei datiert `gueltig_ab` nach BILLING-GÜLTIGKEIT (78610/78620
    // ersetzen die alten Nagelspange-Codes erst für Verordnungsdatum ab 01.10.2025 —
    // andere Bedeutung, gleicher Feldname). Der Betrag stimmt in beiden Fällen exakt
    // überein; nur das Startdatum-Konzept läuft auseinander. Landet hier zu Recht als
    // "weder Treffer noch Abweichung" statt als Fehlalarm.
  }

  const bekannteCodes = new Set(unsere.map(p => p.code));
  const neu = [...new Set(zeilen.map(z => unserCode(z.bereich, z.hmp4)).filter(c => c && !bekannteCodes.has(c)))];

  return { ok, abweichend, neuePreisrunde, fehlt, neu, gesamt: unsere.length };
}

function formatBericht({ ergebnis, stand }) {
  const zeilen = [];
  zeilen.push(`GKV-Stand geprüft: ${stand ?? '(lokale Datei)'}`);
  zeilen.push(`Positionen geprüft: ${ergebnis.gesamt}  ·  passt: ${ergebnis.ok}  ·  abweichend: ${ergebnis.abweichend.length}  ·  neue Preisrunde fehlt: ${ergebnis.neuePreisrunde.length}  ·  Code unbekannt: ${ergebnis.fehlt.length}`);

  for (const a of ergebnis.abweichend) {
    zeilen.push(`  ABWEICHUNG   ${a.code}  (gültig ab ${a.gueltig_ab})  wir: ${a.preis.toFixed(2)} €  |  GKV: ${a.xmlPreis.toFixed(2)} €  |  ${a.label}`);
  }
  for (const n of ergebnis.neuePreisrunde) {
    zeilen.push(`  NEUE RUNDE   ${n.code}  (${n.bereich})  GKV: ${n.xmlPreis.toFixed(2)} € ab ${n.xmlGueltigAb}  |  unser letztes Fenster: ${n.unserLetztesFenster}  |  ${n.label}`);
  }
  for (const f of ergebnis.fehlt.slice(0, 10)) {
    zeilen.push(`  UNBEKANNT    ${f.code}  (${f.bereich})  ${f.label}`);
  }
  if (ergebnis.fehlt.length > 10) zeilen.push(`  … und ${ergebnis.fehlt.length - 10} weitere unbekannte Codes`);

  return zeilen.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  const jsonOut = args.includes('--json');

  let xml, stand;
  if (fileArg) {
    xml = readFileSync(fileArg, 'utf8');
  } else {
    const neu = await neuesterStand();
    stand = neu.stand;
    xml = await ladeXmlAusZip(neu.url);
  }

  const zeilen = parseXml(xml);
  const ergebnis = vergleiche(zeilen);

  console.log(formatBericht({ ergebnis, stand }));

  if (jsonOut) {
    console.log('\n---JSON---');
    console.log(JSON.stringify({ stand, aktuellerStand: { podologie: PODO_PREISSTAND, physiotherapie: PHYSIO_PREISSTAND }, ergebnis }, null, 2));
  }

  if (ergebnis.abweichend.length > 0) {
    console.error(`\n✗ ${ergebnis.abweichend.length} Preisabweichung(en) — Codedatei stimmt nicht mit GKV-XML überein.`);
    process.exit(1);
  }
  if (ergebnis.neuePreisrunde.length > 0) {
    console.log(`\n⚠ ${ergebnis.neuePreisrunde.length} Position(en) haben laut GKV eine neuere Preisrunde als unsere Codedatei kennt.`);
    return; // kein harter Fehler — kein CI-Rot nur weil die GKV ein neues Dokument veröffentlicht hat
  }
  console.log('\n✓ Keine Abweichung.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('✗', err.message);
    process.exit(1);
  });
}
