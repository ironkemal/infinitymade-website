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

/** @type {Record<string, { datei: string, codeFeld: string, importName: string, autoWrite: boolean }>} */
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
    // Bis 13.09.2026 hier `autoWrite: false` (04.09.2026, fonksiyon-ustasi):
    // resolver.js liess bei Physio einen `heilmittel_tarif`-Eintrag den
    // Katalogpreis übersteuern, und die 928 Zeilen dort waren unbefristet —
    // ein automatisch geschriebenes neues Preisfenster hätte auf diesem Weg
    // KEINE reale Wirkung auf die Abrechnung gehabt. Der Override ist jetzt
    // entfernt (O-96, gkv-302-Review — Begründung in resolver.js Kopf: Anlage 2
    // §125 Physio kennt keine Bundesland-Dimension). Katalog ist die einzige
    // Preisquelle, genau wie bei Podologie — autoWrite kann jetzt scharf sein.
    autoWrite: true,
  },
};

const ANKER_ERSTE_ZEILE =
  '  // ── AUTOUPDATE-ANKER: neue Fenster werden von preise_autoupdate.mjs genau HIER,';

/** @param {string} isoDatum */
function vortag(isoDatum) {
  const d = new Date(isoDatum + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} schluessel
 * @param {any} wert
 */
function formatWert(schluessel, wert) {
  if (wert === null || wert === undefined) return 'null';
  if (schluessel === 'preis' || schluessel === 'zuzahlung') return Number(wert).toFixed(2);
  if (typeof wert === 'number') return String(wert);
  if (typeof wert === 'boolean') return String(wert);
  if (Array.isArray(wert)) return '[' + wert.map(x => `'${x}'`).join(',') + ']';
  return `'${String(wert).replace(/'/g, "\\'")}'`;
}

/** Baut EINE Zeile für eine Position — alle Felder vom Vorgänger, 4 überschrieben.
 * @param {Record<string, any>} altesEntry
 * @param {Record<string, any>} overrides
 */
function formatEntry(altesEntry, overrides) {
  /** @type {Record<string, any>} */
  const merged = { ...altesEntry, ...overrides };
  const teile = Object.keys(merged).map(k => `${k}: ${formatWert(k, merged[k])}`);
  return `    { ${teile.join(', ')} },`;
}

/**
 * Prüft und baut das neue Fenster für EINEN Bereich. Gibt entweder
 * { ok: true, gueltig_ab, anzahl } oder { ok: false, grund } zurück.
 * Schreibt die Datei nur bei ok:true UND dryRun:false.
 *
 * @param {string} codeFeld
 * @param {string} datei
 * @param {Array<{ code: string, xmlPreis: number, xmlGueltigAb: string }>} neuePreisrundeEintraege
 * @param {{ gueltig_ab: string, gueltig_bis: string, positionen: ReadonlyArray<Record<string, any>> }} aktuellesFenster
 * @param {boolean} dryRun
 * @param {Set<string> | string[]} [erlaubeSprung=new Set()]
 * @returns {Promise<{ ok: true, gueltig_ab: string, anzahl: number, datei: string, geschrieben: boolean, erlaubteSpruenge: string[] } | { ok: false, art: string, grund: string, sprungCodes?: Array<{ code: string, altPreis: number, neuPreis: number, prozent: number }>, details?: any }>}
 */
export async function versucheBereich(codeFeld, datei, neuePreisrundeEintraege, aktuellesFenster, dryRun, erlaubeSprung = new Set()) {
  const startdaten = [...new Set(neuePreisrundeEintraege.map(e => e.xmlGueltigAb))];
  if (startdaten.length !== 1) {
    return {
      ok: false,
      art: 'startdaten',
      grund: `uneinheitliche neue Startdaten in der XML: ${startdaten.join(', ')}`,
    };
  }
  const neuesGueltigAb = startdaten[0];
  // Direkt aus der XML (extern) — wird unten UNGESCHÜTZT (kein formatWert(),
  // kein Escaping) in JS-Quellcode interpoliert (gueltig_ab/gueltig_bis dieser
  // Funktion). Ein Datumsformat-Check hier ist die einzige Bremse gegen ein
  // manipuliertes oder kaputtes XML, das über ein Anführungszeichen aus dem
  // String-Literal ausbricht (guvenlik-Review, O-99, 13.09.2026).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(neuesGueltigAb)) {
    return {
      ok: false,
      art: 'datum',
      grund: `xmlGueltigAb hat kein gültiges Datumsformat (erwartet JJJJ-MM-TT): "${neuesGueltigAb}"`,
    };
  }

  const unsereCodes = new Set(aktuellesFenster.positionen.map(p => p[codeFeld]));
  const xmlCodes = new Set(neuePreisrundeEintraege.map(e => e.code));
  const fehlend = [...unsereCodes].filter(c => !xmlCodes.has(c));
  const zusaetzlich = [...xmlCodes].filter(c => !unsereCodes.has(c));
  if (fehlend.length || zusaetzlich.length) {
    const art = zusaetzlich.length > 0 ? 'neue_codes' : 'fehlende_codes';
    return {
      ok: false,
      art,
      grund: `Code-Menge weicht ab (nicht nur ein Preis-Update) — `
        + `fehlt in XML: ${fehlend.join(',') || '–'} · nur in XML: ${zusaetzlich.join(',') || '–'}`,
      details: { fehlend, zusaetzlich },
    };
  }

  const preisByCode = new Map(neuePreisrundeEintraege.map(e => [e.code, e.xmlPreis]));
  const erlaubeSprungSet = erlaubeSprung instanceof Set ? erlaubeSprung : new Set(erlaubeSprung || []);

  // Sicherheitsventil (gkv-302-Review, O-99, 13.09.2026): ein normaler GKV-
  // Preisschritt liegt im niedrigen einstelligen Prozentbereich. Ein Sprung
  // >15% bei einem BEKANNTEN Code (Code-Menge stimmt ja schon oben) ist eher
  // ein XML-Fehler, ein Parserproblem oder ein Fall, der Vertragsprosa
  // braucht, als ein normales Preisupdate — automatisches Schreiben stoppt,
  // geht stattdessen in `needsReview`.
  //
  // Bekçi-Ajan (24.11.2026): Wurde der Sprung anhand des Vertragstexts verifiziert,
  // kann er gezielt über erlaubeSprung / --erlaube-sprung übersprungen werden.
  const unallowedSpruenge = [];
  const tatsaechlichErlaubteSpruenge = [];

  for (const p of aktuellesFenster.positionen) {
    const code = p[codeFeld];
    const neuerPreis = preisByCode.get(code);
    if (neuerPreis == null || !p.preis) continue;
    const aenderung = Math.abs(neuerPreis - p.preis) / p.preis;
    if (aenderung > 0.15) {
      const sprungInfo = {
        code,
        altPreis: p.preis,
        neuPreis: neuerPreis,
        prozent: Number((aenderung * 100).toFixed(1)),
        // preise-bewerten.mjs vergleicht Preis UND Gültig-ab mit dem Vertragstext — ohne
        // dieses Feld wäre die doppelte Naht nie erfüllbar (24.11.2026, Integrationsfund).
        xmlGueltigAb: neuePreisrundeEintraege.find(e => e.code === code)?.xmlGueltigAb ?? null,
      };
      if (erlaubeSprungSet.has(code)) {
        tatsaechlichErlaubteSpruenge.push(code);
      } else {
        unallowedSpruenge.push(sprungInfo);
      }
    }
  }

  if (unallowedSpruenge.length > 0) {
    const erster = unallowedSpruenge[0];
    return {
      ok: false,
      art: 'sprung',
      grund: `${erster.code}: Preissprung ${erster.prozent.toFixed(1)}% `
        + `(${erster.altPreis} → ${erster.neuPreis}) — zu groß für Automatik, bitte manuell gegen die Anlage prüfen`,
      sprungCodes: unallowedSpruenge,
      details: { sprungCodes: unallowedSpruenge },
    };
  }

  const neuePositionenZeilen = aktuellesFenster.positionen.map(p => {
    const neuerPreis = /** @type {number} */ (preisByCode.get(p[codeFeld]));
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
    return { ok: false, art: 'fehler', grund: `Anker zum Schließen des alten Fensters nicht gefunden: "${altSubstr}"` };
  }
  content = content.split(altSubstr).join(neuSubstr);

  if (!content.includes(ANKER_ERSTE_ZEILE)) {
    return { ok: false, art: 'fehler', grund: 'AUTOUPDATE-ANKER nicht gefunden — Datei wurde umstrukturiert?' };
  }
  const neuerBlock =
`  Object.freeze({ gueltig_ab: '${neuesGueltigAb}', gueltig_bis: '9999-12-31', positionen: Object.freeze([
${neuePositionenZeilen.join('\n')}
  ]) }),
${ANKER_ERSTE_ZEILE}`;
  content = content.replace(ANKER_ERSTE_ZEILE, neuerBlock);

  if (!dryRun) writeFileSync(datei, content, 'utf8');

  return {
    ok: true,
    gueltig_ab: neuesGueltigAb,
    anzahl: neuePositionenZeilen.length,
    datei,
    geschrieben: !dryRun,
    erlaubteSpruenge: tatsaechlichErlaubteSpruenge,
  };
}

/**
 * Reiner Kern des Auto-Updates: führt Vergleich und Bereichs-Updates aus.
 * Keine CLI-Argumente, keine Konsolenausgaben, kein exit.
 *
 * @param {{
 *   xml: string,
 *   stand?: string | null,
 *   dryRun?: boolean,
 *   erlaubeSprung?: Set<string> | string[],
 *   bereiche?: typeof BEREICHE,
 * }} opts
 * @returns {Promise<{
 *   stand: string | null,
 *   changed: Array<{ bereich: string, ok: true, gueltig_ab: string, anzahl: number, datei: string, geschrieben: boolean, erlaubteSpruenge?: string[] }>,
 *   needsReview: Array<{ art: string, grund: string, details?: any, sprungCodes?: Array<{ code: string, altPreis: number, neuPreis: number, prozent: number }> }>,
 *   erlaubteSpruenge: string[],
 *   fehltInfo?: number,
 * }>}
 */
export async function fuehreAus({ xml, stand = null, dryRun = false, erlaubeSprung = new Set(), bereiche = BEREICHE }) {
  const erlaubeSprungSet = erlaubeSprung instanceof Set
    ? erlaubeSprung
    : new Set(Array.isArray(erlaubeSprung) ? erlaubeSprung : []);

  for (const c of erlaubeSprungSet) {
    if (!/^[A-Z0-9]{4,6}$/.test(c)) {
      return {
        stand: stand || null,
        changed: [],
        needsReview: [{
          art: 'fehler',
          grund: `Ungültiger Code in erlaubeSprung: "${c}" (erwartet /^[A-Z0-9]{4,6}$/)`,
          details: [c],
        }],
        erlaubteSpruenge: [],
      };
    }
  }

  const zeilen = parseXml(xml);
  const ergebnis = vergleiche(zeilen);

  /** @type {{
   *   stand: string | null,
   *   changed: Array<{ bereich: string, ok: true, gueltig_ab: string, anzahl: number, datei: string, geschrieben: boolean, erlaubteSpruenge?: string[] }>,
   *   needsReview: Array<{ art: string, grund: string, details?: any, sprungCodes?: Array<{ code: string, altPreis: number, neuPreis: number, prozent: number }> }>,
   *   erlaubteSpruenge: string[],
   *   fehltInfo?: number
   * }} */
  const bericht = { stand: stand || null, changed: [], needsReview: [], erlaubteSpruenge: [] };

  if (ergebnis.abweichend.length > 0) {
    bericht.needsReview.push({
      art: 'abweichend',
      grund: 'Preisabweichung bei bereits bekanntem Fenster — Codedatei stimmt nicht mit GKV überein',
      details: ergebnis.abweichend,
    });
  } else {
    /** @type {Record<string, Array<{ code: string, bereich: string, label: string, xmlPreis: number, xmlGueltigAb: string, unserLetztesFenster: string }>>} */
    const proBereich = {};
    for (const e of ergebnis.neuePreisrunde) {
      (proBereich[e.bereich] = proBereich[e.bereich] || []).push(e);
    }

    for (const [bereichSchluessel, eintraege] of Object.entries(proBereich)) {
      const bereich = bereichSchluessel === 'Podologie' ? 'podologie'
        : bereichSchluessel === 'Physiotherapie' ? 'physiotherapie'
        : bereichSchluessel;
      const cfg = bereiche[bereich];
      if (!cfg) {
        bericht.needsReview.push({
          art: 'bereich',
          grund: `unbekannter Bereich: ${bereichSchluessel}`,
          details: eintraege,
        });
        continue;
      }
      if (!cfg.autoWrite) {
        bericht.needsReview.push({
          art: 'bereich',
          grund: `${bereich}: neue Preisrunde erkannt, aber Auto-Write für diesen Bereich deaktiviert (siehe BEREICHE-Kommentar in preise_autoupdate.mjs)`,
          details: eintraege,
        });
        continue;
      }

      const mod = await import(`${pathToFileURL(cfg.datei).href}?t=${Date.now()}`);
      const fenster = mod[cfg.importName];
      const offene = fenster.filter((/** @type {any} */ f) => f.gueltig_bis === '9999-12-31');
      if (offene.length !== 1) {
        bericht.needsReview.push({
          art: 'fenster',
          grund: `${bereich}: ${offene.length} offene Fenster statt genau 1`,
          details: eintraege,
        });
        continue;
      }

      const res = await versucheBereich(cfg.codeFeld, cfg.datei, eintraege, offene[0], dryRun, erlaubeSprungSet);
      if (res.ok) {
        bericht.changed.push({ bereich, ...res });
        if (res.erlaubteSpruenge && res.erlaubteSpruenge.length > 0) {
          for (const c of res.erlaubteSpruenge) {
            if (!bericht.erlaubteSpruenge.includes(c)) {
              bericht.erlaubteSpruenge.push(c);
            }
          }
        }
      } else {
        const item = {
          art: res.art || 'fehler',
          grund: `${bereich}: ${res.grund}`,
          details: res.art === 'sprung' ? { eintraege, sprungCodes: res.sprungCodes } : eintraege,
        };
        if (res.sprungCodes) item.sprungCodes = res.sprungCodes;
        bericht.needsReview.push(item);
      }
    }
  }

  if (ergebnis.fehlt.length > 0) {
    // Bekannte, stabile Lücke (z. B. §125a-Blanko-Codes) — informativ, kein Review-Grund
    // für sich allein, aber sichtbar im Bericht.
    bericht.fehltInfo = ergebnis.fehlt.length;
  }

  return bericht;
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  const dryRun = args.includes('--dry-run');

  let rawSprung = null;
  const sprungEq = args.find(a => a.startsWith('--erlaube-sprung='));
  if (sprungEq) {
    rawSprung = sprungEq.slice('--erlaube-sprung='.length);
  } else {
    const idx = args.indexOf('--erlaube-sprung');
    if (idx !== -1 && idx + 1 < args.length) {
      rawSprung = args[idx + 1];
    }
  }

  const erlaubeSprung = new Set();
  if (rawSprung !== null && rawSprung.trim() !== '') {
    for (const c of rawSprung.split(',').map(s => s.trim())) {
      erlaubeSprung.add(c);
    }
  }

  // CLI-Korkengrenze: Ungültige Codes sofort abfangen (exit 0 + JSON art:'fehler')
  for (const c of erlaubeSprung) {
    if (!/^[A-Z0-9]{4,6}$/.test(c)) {
      const fehlerBericht = {
        stand: null,
        changed: [],
        needsReview: [{
          art: 'fehler',
          grund: `Ungültiger Code in --erlaube-sprung: "${c}" (erwartet /^[A-Z0-9]{4,6}$/)`,
          details: [c],
        }],
        erlaubteSpruenge: [],
      };
      console.error(`✗ ${fehlerBericht.needsReview[0].grund}`);
      console.log('---JSON---');
      console.log(JSON.stringify(fehlerBericht));
      process.exit(0);
    }
  }

  let xml, stand;
  if (fileArg) {
    xml = readFileSync(fileArg, 'utf8');
  } else {
    const neu = await neuesterStand();
    stand = neu.stand;
    xml = await ladeXmlAusZip(neu.url);
  }

  const bericht = await fuehreAus({ xml, stand, dryRun, erlaubeSprung });

  console.log(`Stand: ${bericht.stand ?? '(lokale Datei)'}`);
  console.log(`Geändert: ${bericht.changed.length}  ·  Braucht Review: ${bericht.needsReview.length}`);
  for (const c of bericht.changed) {
    console.log(`  ✓ ${c.bereich}: neues Fenster ab ${c.gueltig_ab}, ${c.anzahl} Positionen${dryRun ? ' (DRY RUN, nicht geschrieben)' : ' → ' + c.datei}`);
  }
  if (bericht.erlaubteSpruenge && bericht.erlaubteSpruenge.length > 0) {
    console.log(`  ⚡ Erlaubte Preissprünge: ${bericht.erlaubteSpruenge.join(', ')}`);
  }
  for (const r of bericht.needsReview) {
    console.log(`  ⚠ ${r.grund}`);
  }

  console.log('---JSON---');
  console.log(JSON.stringify(bericht));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('✗', err.message, err.stack);
    console.log('---JSON---');
    console.log(JSON.stringify({
      error: err.message,
      changed: [],
      needsReview: [{ art: 'fehler', grund: 'Skript-Fehler: ' + err.message }],
      erlaubteSpruenge: [],
    }));
    process.exit(0); // Aufrufer soll den JSON-Bericht lesen, nicht an einem Crash scheitern
  });
}
