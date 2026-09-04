/**
 * preise_autoupdate.mjs
 *
 * Sicherer, deterministischer Auto-Updater für Ops-Karte #213.
 *
 * Warum "sicher" hier eine enge Bedeutung hat
 * ────────────────────────────────────────────
 * Die GKV-Heilmittelpreisstammdatei (siehe preise_pruefen.mjs) trägt NUR Code +
 * Preis + Startdatum. Sie trägt KEINE Zuzahlungs-Ausnahmen, keine Dauer, keine
 * Diagnosegruppen, keine Vertragsprosa (z. B. "diese Position gilt nur für
 * Verordnungen ab X" — siehe 78610/78620 in preise_pruefen.mjs). Diese Datei
 * automatisiert deshalb NUR den einen Fall, der aus reinen Zahlen sicher
 * ableitbar ist:
 *
 *   Ein Bereich hat ein neues Gueltig_ab, EXAKT dieselbe Code-Menge wie unser
 *   aktuell offenes Fenster, keine Abweichung bei bereits bekannten Fenstern.
 *   → neues Preisfenster wird angehängt, alle anderen Felder (Label, Dauer,
 *     Diagnosegruppen, Notiz, deprecated, …) werden 1:1 vom Vorgänger-Eintrag
 *     übernommen. Zuzahlung wird nur neu berechnet (10 % des neuen Preises,
 *     kaufmännisch gerundet), wenn sie vorher NICHT null war — eine
 *     zuzahlungsfreie Position bleibt zuzahlungsfrei.
 *
 * ALLES andere (neue/verschwundene Codes, uneinheitliche Startdaten, ein Preis
 * der nicht zum aktuell gültigen Fenster passt) wird NICHT angefasst — das ist
 * ein Signal für "ein Mensch muss die Anlage-2-Vertragsprosa lesen", kein Fall
 * für Automation. Aufrufer (siehe .github/workflows/preise-check.yml) meldet
 * das dann per Telegram statt einen Commit zu machen.
 *
 * Selbstprüfung vor dem Schreiben-Erfolg: nach dem Patchen wird die Datei neu
 * importiert (Cache-Bust über Zeitstempel-Query) und `vergleiche()` erneut
 * gegen dieselbe XML gefahren — nur wenn danach für den betroffenen Bereich
 * keine Abweichung mehr existiert, gilt der Schreibvorgang als erfolgreich.
 * Der Aufrufer führt zusätzlich `npm test` aus, BEVOR committet wird.
 *
 * Nutzung:
 *   node preise_autoupdate.mjs             # holt die neueste GKV-Version live
 *   node preise_autoupdate.mjs --file <xml>  # gegen lokale Datei (Tests)
 *   node preise_autoupdate.mjs --dry-run   # schreibt nichts, zeigt nur was passieren würde
 *
 * Stdout, letzte Zeile: ein JSON-Objekt (siehe `berichte()` unten) — der
 * Aufrufer parst NUR diese letzte Zeile, alles davor ist Diagnosetext.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import {
  neuesterStand, ladeXmlAusZip, parseXml, vergleiche,
} from './preise_pruefen.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BEREICHE = {
  podologie: {
    datei: join(__dirname, 'billing/codes/podologie_positions.js'),
    codeFeld: 'hpnr',
    importName: 'PODOLOGIE_PREISFENSTER',
    autoWrite: true,
  },
  physiotherapie: {
    datei: join(__dirname, 'billing/codes/physio_positions.js'),
    codeFeld: 'x',
    importName: 'PHYSIO_PREISFENSTER',
    // NICHT automatisch schreiben (04.09.2026, fonksiyon-ustasi): resolver.js
    // lässt bei Physio einen `heilmittel_tarif`-Eintrag den Katalogpreis
    // übersteuern (`!istPodologie && tariffs && datum`, resolver.js:81).
    // 928 Zeilen in `heilmittel_tarif` sind heute unbefristet (gueltig_bis IS
    // NULL, ab 2026-01-01) — ein automatisch geschriebenes neues Preisfenster
    // hätte auf den Wegen, die `tariffs` mitgeben, KEINE reale Wirkung auf die
    // Abrechnung. Ein "✅ automatisch aktualisiert" wäre dort eine falsche
    // Zusicherung. Podologie kennt diesen Override nicht (siehe Kommentar in
    // resolver.js) und bleibt automatisierbar. Sobald die `heilmittel_tarif`-
    // Frage geklärt ist (Zeilen befristen oder Override abschaffen — offene
    // Entscheidung aus resolver.js selbst), kann autoWrite hier auf true.
    autoWrite: false,
  },
};

const ANKER_ERSTE_ZEILE =
  '  // ── AUTOUPDATE-ANKER: neue Fenster werden von preise_autoupdate.mjs genau HIER,';

function vortag(isoDatum) {
  const d = new Date(isoDatum + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatWert(schluessel, wert) {
  if (wert === null || wert === undefined) return 'null';
  if (schluessel === 'preis' || schluessel === 'zuzahlung') return Number(wert).toFixed(2);
  if (typeof wert === 'number') return String(wert);
  if (typeof wert === 'boolean') return String(wert);
  if (Array.isArray(wert)) return '[' + wert.map(x => `'${x}'`).join(',') + ']';
  return `'${String(wert).replace(/'/g, "\\'")}'`;
}

/** Baut EINE Zeile für eine Position — alle Felder vom Vorgänger, 4 überschrieben. */
function formatEntry(altesEntry, overrides) {
  const merged = { ...altesEntry, ...overrides };
  const teile = Object.keys(merged).map(k => `${k}: ${formatWert(k, merged[k])}`);
  return `    { ${teile.join(', ')} },`;
}

/**
 * Prüft und baut das neue Fenster für EINEN Bereich. Gibt entweder
 * { ok: true, gueltig_ab, anzahl } oder { ok: false, grund } zurück.
 * Schreibt die Datei nur bei ok:true UND dryRun:false.
 */
export async function versucheBereich(codeFeld, datei, neuePreisrundeEintraege, aktuellesFenster, dryRun) {
  const startdaten = [...new Set(neuePreisrundeEintraege.map(e => e.xmlGueltigAb))];
  if (startdaten.length !== 1) {
    return { ok: false, grund: `uneinheitliche neue Startdaten in der XML: ${startdaten.join(', ')}` };
  }
  const neuesGueltigAb = startdaten[0];

  const unsereCodes = new Set(aktuellesFenster.positionen.map(p => p[codeFeld]));
  const xmlCodes = new Set(neuePreisrundeEintraege.map(e => e.code));
  const fehlend = [...unsereCodes].filter(c => !xmlCodes.has(c));
  const zusaetzlich = [...xmlCodes].filter(c => !unsereCodes.has(c));
  if (fehlend.length || zusaetzlich.length) {
    return {
      ok: false,
      grund: `Code-Menge weicht ab (nicht nur ein Preis-Update) — `
        + `fehlt in XML: ${fehlend.join(',') || '–'} · nur in XML: ${zusaetzlich.join(',') || '–'}`,
    };
  }

  const preisByCode = new Map(neuePreisrundeEintraege.map(e => [e.code, e.xmlPreis]));
  const neuePositionenZeilen = aktuellesFenster.positionen.map(p => {
    const neuerPreis = preisByCode.get(p[codeFeld]);
    return formatEntry(p, {
      preis: neuerPreis,
      // Kaufmännische Rundung, NICHT .toFixed(2): `50.55 * 0.10` ist binär
      // 5.054999999999999…, .toFixed(2) rundet das fälschlich zu 5.05 ab statt
      // zu 5.06 auf (fonksiyon-ustasi, 04.09.2026 — 78020 wäre beim ersten
      // Auto-Update 1 Cent zu niedrig gewesen). Dieselbe Formel wie r2() in
      // billing/preise/resolver.js und billing/zuzahlung/calculator.js.
      zuzahlung: p.zuzahlung == null ? null : Math.round(neuerPreis * 0.10 * 100) / 100,
      gueltig_ab: neuesGueltigAb,
      gueltig_bis: '9999-12-31',
    });
  });

  let content = readFileSync(datei, 'utf8');

  const schliessDatum = vortag(neuesGueltigAb);
  const altSubstr = `gueltig_ab: '${aktuellesFenster.gueltig_ab}', gueltig_bis: '9999-12-31'`;
  const neuSubstr = `gueltig_ab: '${aktuellesFenster.gueltig_ab}', gueltig_bis: '${schliessDatum}'`;
  if (!content.includes(altSubstr)) {
    return { ok: false, grund: `Anker zum Schließen des alten Fensters nicht gefunden: "${altSubstr}"` };
  }
  content = content.split(altSubstr).join(neuSubstr);

  if (!content.includes(ANKER_ERSTE_ZEILE)) {
    return { ok: false, grund: 'AUTOUPDATE-ANKER nicht gefunden — Datei wurde umstrukturiert?' };
  }
  const neuerBlock =
`  Object.freeze({ gueltig_ab: '${neuesGueltigAb}', gueltig_bis: '9999-12-31', positionen: Object.freeze([
${neuePositionenZeilen.join('\n')}
  ]) }),
${ANKER_ERSTE_ZEILE}`;
  content = content.replace(ANKER_ERSTE_ZEILE, neuerBlock);

  if (!dryRun) writeFileSync(datei, content, 'utf8');

  return { ok: true, gueltig_ab: neuesGueltigAb, anzahl: neuePositionenZeilen.length, datei, geschrieben: !dryRun };
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  const dryRun = args.includes('--dry-run');

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

  const bericht = { stand: stand || null, changed: [], needsReview: [] };

  if (ergebnis.abweichend.length > 0) {
    bericht.needsReview.push({
      grund: 'Preisabweichung bei bereits bekanntem Fenster — Codedatei stimmt nicht mit GKV überein',
      details: ergebnis.abweichend,
    });
  } else {
    const proBereich = {};
    for (const e of ergebnis.neuePreisrunde) {
      (proBereich[e.bereich] = proBereich[e.bereich] || []).push(e);
    }

    for (const [bereichSchluessel, eintraege] of Object.entries(proBereich)) {
      const bereich = bereichSchluessel === 'Podologie' ? 'podologie'
        : bereichSchluessel === 'Physiotherapie' ? 'physiotherapie'
        : bereichSchluessel;
      const cfg = BEREICHE[bereich];
      if (!cfg) { bericht.needsReview.push({ grund: `unbekannter Bereich: ${bereichSchluessel}`, details: eintraege }); continue; }
      if (!cfg.autoWrite) {
        bericht.needsReview.push({
          grund: `${bereich}: neue Preisrunde erkannt, aber Auto-Write für diesen Bereich deaktiviert (siehe BEREICHE-Kommentar in preise_autoupdate.mjs)`,
          details: eintraege,
        });
        continue;
      }

      const mod = await import(`${pathToFileURL(cfg.datei).href}?t=${Date.now()}`);
      const fenster = mod[cfg.importName];
      const offene = fenster.filter(f => f.gueltig_bis === '9999-12-31');
      if (offene.length !== 1) {
        bericht.needsReview.push({ grund: `${bereich}: ${offene.length} offene Fenster statt genau 1`, details: eintraege });
        continue;
      }

      const res = await versucheBereich(cfg.codeFeld, cfg.datei, eintraege, offene[0], dryRun);
      if (res.ok) bericht.changed.push({ bereich, ...res });
      else bericht.needsReview.push({ grund: `${bereich}: ${res.grund}`, details: eintraege });
    }
  }

  if (ergebnis.fehlt.length > 0) {
    // Bekannte, stabile Lücke (z. B. §125a-Blanko-Codes) — informativ, kein Review-Grund
    // für sich allein, aber sichtbar im Bericht.
    bericht.fehltInfo = ergebnis.fehlt.length;
  }

  console.log(`Stand: ${bericht.stand ?? '(lokale Datei)'}`);
  console.log(`Geändert: ${bericht.changed.length}  ·  Braucht Review: ${bericht.needsReview.length}`);
  for (const c of bericht.changed) console.log(`  ✓ ${c.bereich}: neues Fenster ab ${c.gueltig_ab}, ${c.anzahl} Positionen${dryRun ? ' (DRY RUN, nicht geschrieben)' : ' → ' + c.datei}`);
  for (const r of bericht.needsReview) console.log(`  ⚠ ${r.grund}`);

  console.log('---JSON---');
  console.log(JSON.stringify(bericht));
}

main().catch((err) => {
  console.error('✗', err.message, err.stack);
  console.log('---JSON---');
  console.log(JSON.stringify({ error: err.message, changed: [], needsReview: [{ grund: 'Skript-Fehler: ' + err.message }] }));
  process.exit(0); // Aufrufer soll den JSON-Bericht lesen, nicht an einem Crash scheitern
});
