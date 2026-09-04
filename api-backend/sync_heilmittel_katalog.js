/**
 * sync_heilmittel_katalog.js
 *
 * Projiziert die Abrechnungs-Positionsdateien in die Tabelle `heilmittel_katalog`,
 * aus der ALLE Heilmittel-Auswahlfelder der Oberfläche gespeist werden.
 *
 * Quelle der Wahrheit bleiben die Codedateien — sie sind getestet und für die
 * §302-Abrechnung maßgeblich. Diese Tabelle ist nur ihre Projektion, damit das
 * Frontend keine eigenen Listen mehr pflegen muss.
 *
 *   node sync_heilmittel_katalog.js           # schreiben
 *   node sync_heilmittel_katalog.js --check   # nur prüfen (Drift-Test, CI-tauglich)
 *
 * Bei --check ist Exit-Code 1 = DB weicht von den Codedateien ab.
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { PHYSIO_POSITIONS } from './billing/codes/physio_positions.js';
import { PODOLOGIE_PREISFENSTER } from './billing/codes/podologie_positions.js';

dotenv.config();

const CHECK_ONLY = process.argv.includes('--check');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Verordnungs-Kürzel → X-Code. Ärzte schreiben "KG" auf das Rezept, nicht "X0501".
// Gleiche Zuordnung wie in seed_tarifs.js; hier zentral, damit die Suche auch
// auf das Kürzel anspringt.
const KUERZEL = {
  X0501: 'KG',      X0502: 'KG',      X0710: 'KG-ZNS',  X0702: 'KG-MUKO',
  X1201: 'MT',      X0205: 'MLD',     X0201: 'MLD-45',  X0202: 'MLD-60',
  X0106: 'KMT',     X0107: 'BGM',     X0301: 'ÜB',      X1302: 'E',
  X1501: 'W',       X1534: 'K',       X2001: 'D1',      X0801: 'KGG',
  X1101: 'Schlingentisch',
};

function physioRows() {
  return PHYSIO_POSITIONS.map((p, i) => ({
    code:            p.x,
    bereich:         'physiotherapy',
    label:           p.label,
    kuerzel:         KUERZEL[p.x] || null,
    kategorie:       p.kat || null,
    diagnosegruppen: null,
    preis_eur:       p.preis ?? null,
    zuzahlung_eur:   p.zuzahlung ?? null,
    dauer:           p.dauer || null,
    gueltig_ab:      p.gueltig_ab  || '1900-01-01',
    gueltig_bis:     p.gueltig_bis || '9999-12-31',
    deprecated:      !!p.deprecated,
    ungueltig_ab:    p.ungueltig_ab || null,
    ersetzt_durch:   p.ersetzt_durch || null,
    max_pro_tag:     p.max_pro_tag ?? null,
    max_pro_termin:  p.max_pro_termin ?? null,
    notiz:           p.notiz || null,
    gruppe:          !!p.gruppe,
    telemed:         !!p.telemed,
    sort:            i,
  }));
}

function podoRows() {
  const all = PODOLOGIE_PREISFENSTER.flatMap(f => f.positionen);
  return all.map((p, i) => ({
    code:            p.hpnr,
    bereich:         'podologie',
    label:           p.label,
    kuerzel:         null,
    kategorie:       null,
    diagnosegruppen: p.diagnosegruppen || null,
    preis_eur:       p.preis ?? null,
    zuzahlung_eur:   p.zuzahlung ?? null,
    dauer:           p.dauer || null,
    gueltig_ab:      p.gueltig_ab,
    gueltig_bis:     p.gueltig_bis,
    deprecated:      !!p.deprecated,
    ungueltig_ab:    p.ungueltig_ab || null,
    ersetzt_durch:   p.ersetzt_durch || null,
    max_pro_tag:     p.max_pro_tag ?? null,
    max_pro_termin:  p.max_pro_termin ?? null,
    notiz:           p.notiz || null,
    gruppe:          false,
    telemed:         false,
    sort:            i,
  }));
}

const KEY = r => `${r.bereich}|${r.code}|${r.gueltig_ab}`;

function normalise(r) {
  // Vergleichbare Form: Zahlen als Zahl, undefined → null
  return JSON.stringify({
    ...r,
    preis_eur:     r.preis_eur     == null ? null : Number(r.preis_eur),
    zuzahlung_eur: r.zuzahlung_eur == null ? null : Number(r.zuzahlung_eur),
    diagnosegruppen: r.diagnosegruppen ? [...r.diagnosegruppen].sort() : null,
  });
}

async function main() {
  const want = [...physioRows(), ...podoRows()];
  const dupes = want.length - new Set(want.map(KEY)).size;
  if (dupes) { console.error(`✗ ${dupes} doppelte Schlüssel in den Codedateien`); process.exit(1); }

  const { data: have, error } = await supabase
    .from('heilmittel_katalog')
    .select('code,bereich,label,kuerzel,kategorie,diagnosegruppen,preis_eur,zuzahlung_eur,dauer,'
          + 'gueltig_ab,gueltig_bis,deprecated,ungueltig_ab,ersetzt_durch,max_pro_tag,max_pro_termin,'
          + 'notiz,gruppe,telemed,sort');
  if (error) { console.error('✗ Lesen fehlgeschlagen:', error.message); process.exit(1); }

  const haveMap = new Map((have || []).map(r => [KEY(r), r]));
  const wantMap = new Map(want.map(r => [KEY(r), r]));

  const missing = want.filter(r => !haveMap.has(KEY(r)));
  const extra   = (have || []).filter(r => !wantMap.has(KEY(r)));
  const changed = want.filter(r => {
    const h = haveMap.get(KEY(r));
    return h && normalise(h) !== normalise(r);
  });

  console.log(`Codedateien: ${want.length} Positionen  (Physio ${physioRows().length}, Podologie ${podoRows().length})`);
  console.log(`Datenbank:   ${(have || []).length} Zeilen`);
  console.log(`fehlend ${missing.length} · überzählig ${extra.length} · abweichend ${changed.length}`);

  if (CHECK_ONLY) {
    const drift = missing.length + extra.length + changed.length;
    for (const r of missing.slice(0, 10)) console.log(`  fehlt:      ${KEY(r)}`);
    for (const r of extra.slice(0, 10))   console.log(`  überzählig: ${KEY(r)}`);
    for (const r of changed.slice(0, 10)) console.log(`  abweichend: ${KEY(r)}`);
    if (drift) { console.error(`\n✗ DRIFT: ${drift} Abweichung(en). 'node sync_heilmittel_katalog.js' ausführen.`); process.exit(1); }
    console.log('\n✓ Datenbank deckungsgleich mit den Codedateien.');
    return;
  }

  for (const r of extra) {
    const { error: e } = await supabase.from('heilmittel_katalog')
      .delete().eq('bereich', r.bereich).eq('code', r.code).eq('gueltig_ab', r.gueltig_ab);
    if (e) { console.error('✗ Löschen:', e.message); process.exit(1); }
  }
  for (let i = 0; i < want.length; i += 200) {
    const { error: e } = await supabase.from('heilmittel_katalog')
      .upsert(want.slice(i, i + 200), { onConflict: 'bereich,code,gueltig_ab' });
    if (e) { console.error('✗ Schreiben:', e.message); process.exit(1); }
  }
  console.log(`✓ ${want.length} Positionen synchronisiert (${extra.length} entfernt).`);
}

main();
