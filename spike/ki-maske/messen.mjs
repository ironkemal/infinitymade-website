/**
 * Messskript für PII-Maskierer
 * 
 * Vergleicht die Maskierungsausgabe von maskPII gegen die Grundwahrheit (pii_truth)
 * im Korpus spike/ki-maske/korpus.json und misst Leak-Quoten sowie Roundtrip-Treue.
 * 
 * Reines Node.js >= 18, keine externen Abhängigkeiten.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { maskPII } from '../../api-backend/ai/pii-mask.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Stoppwörter und Titel, die nicht als eigenständiger Namensteil geprüft werden sollen
const NAME_STOP_WORDS = new Set([
  'herr', 'herrn', 'frau', 'fräulein',
  'dr', 'med', 'prof', 'dres',
  'von', 'und', 'der', 'die', 'das', 'den', 'dem'
]);

/**
 * Zerlegt einen Personennamen in Teilstrings (auch kurze Namen) (ohne Titel/Stoppwörter).
 * @param {string} name
 * @returns {string[]}
 */
export function getNameParts(name) {
  return String(name || '')
    .split(/[\s\-_/.,;:!?()]+/)
    .map(p => p.trim())
    .filter(p => p.length >= 1 && !NAME_STOP_WORDS.has(p.toLowerCase()));
}

/**
 * Prüft, ob ein PII-Wahrheitselement in masked vorkommt.
 * NFKC + case-insensitive; NAME-Teile nur an Unicode-Wortgrenzen.
 * 
 * @param {{ value: string, type: string }} truth
 * @param {string} masked
 * @returns {{ isLeak: boolean, match: string | null }}
 */
export function checkLeak(truth, masked) {
  if (typeof masked !== 'string') throw new TypeError('Masked output must be a string');
  const maskedLower = masked.normalize('NFKC').toLowerCase();
  const valStr = String(truth.value ?? '').trim();
  const valLower = valStr.normalize('NFKC').toLowerCase();
  const type = String(truth.type || 'UNKNOWN').toUpperCase();

  if (type !== 'NAME' && valLower.length > 0 && maskedLower.includes(valLower)) {
    return { isLeak: true, match: valStr };
  }

  if (type === 'NAME') {
    const parts = getNameParts(valStr);
    for (const part of parts) {
      if (new RegExp('(?<![\\p{L}\\p{N}])' + part.normalize('NFKC').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'u').test(maskedLower)) {
        return { isLeak: true, match: part };
      }
    }
  }

  return { isLeak: false, match: null };
}

/**
 * Führt die Messung eines Maskierers über das Korpus durch.
 * 
 * @param {Function} [maskFn=maskPII] Maskierer mit Signatur maskFn(text, { entities }) -> { masked, unmask }
 * @param {Object} [options={}] Optionen
 * @param {string} [options.corpusPath] Pfad zu korpus.json
 * @param {string} [options.outputPath] Pfad zu ergebnis-ist.json
 * @param {boolean} [options.writeJson=true] Ob JSON geschrieben werden soll
 * @param {boolean} [options.silent=false] Ob Konsolenausgabe unterdrückt werden soll
 * @returns {Object} Messergebnis mit Zusammenfassung, Aufschlüsselung nach Typ und Leak-Liste
 */
export function messe(maskFn = maskPII, options = {}) {
  const corpusPath = options.corpusPath || resolve(__dirname, 'korpus.json');
  const outputPath = options.outputPath || resolve(__dirname, 'ergebnis-ist.json');
  const writeJson = options.writeJson !== false;
  const silent = Boolean(options.silent);

  const rawCorpus = readFileSync(corpusPath, 'utf8');
  const corpus = JSON.parse(rawCorpus);

  if (!Array.isArray(corpus)) {
    throw new Error(`Korpus unter ${corpusPath} muss ein JSON-Array sein.`);
  }

  const byType = {};
  const allLeaks = [];
  const caseResults = [];
  let roundtripOkCount = 0;
  let roundtripFailCount = 0;

  for (const c of corpus) {
    const entities = c.entities || [];
    const piiTruth = c.pii_truth || [];

    const maskRes = maskFn(c.text, { entities });
    if (!maskRes || typeof maskRes.masked !== 'string' || (c.text.trim() && !maskRes.masked.trim())) throw new Error('Invalid/empty masker output: ' + c.id);
    const masked = maskRes.masked;
    const unmask = (maskRes && typeof maskRes.unmask === 'function') ? maskRes.unmask : (s => s);

    const unmasked = unmask(masked);
    const roundtrip = (unmasked === c.text);

    if (roundtrip) {
      roundtripOkCount++;
    } else {
      roundtripFailCount++;
    }

    const caseLeaks = [];

    for (const truth of piiTruth) {
      const type = String(truth.type || 'UNKNOWN').toUpperCase();
      if (!byType[type]) {
        byType[type] = { gesamt: 0, geleakt: 0, quote_percent: 0 };
      }
      byType[type].gesamt++;

      const leakTest = checkLeak(truth, masked);
      if (leakTest.isLeak) {
        byType[type].geleakt++;
        const leakEntry = {
          id: c.id,
          task: c.task,
          type,
          value: truth.value,
          match: leakTest.match
        };
        allLeaks.push(leakEntry);
        caseLeaks.push({
          type,
          value: truth.value,
          match: leakTest.match
        });
      }
    }

    caseResults.push({
      id: c.id,
      task: c.task,
      roundtrip,
      pii_count: piiTruth.length,
      leak_count: caseLeaks.length,
      leaks: caseLeaks,
      text: c.text,
      masked,
      unmasked
    });
  }

  // Prozentquoten berechnen
  let totalPii = 0;
  let totalLeaked = 0;

  for (const type of Object.keys(byType)) {
    const stat = byType[type];
    stat.quote_percent = stat.gesamt > 0
      ? Number(((stat.geleakt / stat.gesamt) * 100).toFixed(1))
      : 0;
    totalPii += stat.gesamt;
    totalLeaked += stat.geleakt;
  }

  const overallLeakRate = totalPii > 0
    ? Number(((totalLeaked / totalPii) * 100).toFixed(1))
    : 0;

  const roundtripRate = corpus.length > 0
    ? Number(((roundtripOkCount / corpus.length) * 100).toFixed(1))
    : 0;

  const result = {
    timestamp: new Date().toISOString(),
    summary: {
      total_cases: corpus.length,
      roundtrip_ok: roundtripOkCount,
      roundtrip_failed: roundtripFailCount,
      roundtrip_quote_percent: roundtripRate,
      total_pii: totalPii,
      total_leaked: totalLeaked,
      leak_quote_percent: overallLeakRate
    },
    by_type: byType,
    leaks: allLeaks,
    cases: caseResults
  };

  // Konsolenausgabe
  if (!silent) {
    console.log('\n' + '='.repeat(70));
    console.log(' PII-MASKIERER MESSPROTOKOLL');
    console.log('='.repeat(70));
    console.log(
      'Typ'.padEnd(16) +
      'Gesamt'.padStart(10) +
      'Geleakt'.padStart(12) +
      'Leak-Quote (%)'.padStart(18)
    );
    console.log('-'.repeat(70));

    const sortedTypes = Object.keys(byType).sort();
    for (const t of sortedTypes) {
      const row = byType[t];
      console.log(
        t.padEnd(16) +
        String(row.gesamt).padStart(10) +
        String(row.geleakt).padStart(12) +
        `${row.quote_percent.toFixed(1)} %`.padStart(18)
      );
    }

    console.log('-'.repeat(70));
    console.log(
      'GESAMT'.padEnd(16) +
      String(totalPii).padStart(10) +
      String(totalLeaked).padStart(12) +
      `${overallLeakRate.toFixed(1)} %`.padStart(18)
    );
    console.log('='.repeat(70));
    console.log(`Gesamtquote Leaks:   ${totalLeaked} / ${totalPii} (${overallLeakRate} %)`);
    console.log(`Roundtrip-Quote:     ${roundtripOkCount} / ${corpus.length} (${roundtripRate} %)`);
    if (roundtripFailCount > 0) {
      const failedIds = caseResults.filter(r => !r.roundtrip).map(r => r.id).join(', ');
      console.log(`  -> Roundtrip fehlgeschlagen bei: ${failedIds}`);
    }
    console.log('='.repeat(70));

    console.log(`\nListe aller Leaks (${allLeaks.length} Einträge):`);
    console.log('-'.repeat(70));
    for (const l of allLeaks) {
      console.log(`[${l.id}] ${l.type.padEnd(12)} : "${l.value}" (Match: "${l.match}")`);
    }
    console.log('-'.repeat(70));
  }

  // JSON speichern
  if (writeJson) {
    const outDir = dirname(outputPath);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    if (!silent) {
      console.log(`\nJSON-Ergebnis exportiert nach: ${outputPath}\n`);
    }
  }

  return result;
}

// Direkte CLI-Ausführung (z.B. node messen.mjs)
const isDirectRun = Boolean(
  process.argv[1] &&
  resolve(process.argv[1]).replace(/\\/g, '/').toLowerCase() ===
  __filename.replace(/\\/g, '/').toLowerCase()
);

if (isDirectRun) {
  messe(maskPII);
}
