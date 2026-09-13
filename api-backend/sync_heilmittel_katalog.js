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
 *   node sync_heilmittel_katalog.js           # schreiben (DB-Zugriff)
 *   node sync_heilmittel_katalog.js --check   # nur prüfen (Drift-Test, CI-tauglich, DB-Zugriff)
 *   node sync_heilmittel_katalog.js --sql     # INSERT ... ON CONFLICT nach stdout — KEIN DB-Zugriff
 *
 * Bei --check ist Exit-Code 1 = DB weicht von den Codedateien ab.
 *
 * --sql (O-95, onprem/REGISTER.md): braucht weder Supabase-URL noch Service-
 * Role-Key — nur die Codedateien. Existiert, weil `preise-check.yml`'s
 * automatischer Preis-Commit (Ops-Karte #213) in einem nackten CI-Checkout
 * läuft, ganz ohne DB-Zugang, und trotzdem eine neue Seed-Migration für die
 * Box mitschreiben soll (O-79's Seed-Kapı verlangt das für jede *_positions.js-
 * Änderung; `preise-check.yml` selbst greift das Git-Hook bisher nicht, siehe
 * O-95). Erzeugt EXAKT dasselbe SQL wie die handschriftlich gepflegte
 * db/migrations/0012_seed_heilmittel_katalog.sql — derselbe Zeilen-Bauer,
 * nur ein zweiter Ausgang.
 */

import { PHYSIO_POSITIONS } from './billing/codes/physio_positions.js';
import { PODOLOGIE_PREISFENSTER } from './billing/codes/podologie_positions.js';

const CHECK_ONLY = process.argv.includes('--check');
const SQL_ONLY = process.argv.includes('--sql');

// Supabase-Client nur bauen, wenn er auch gebraucht wird — --sql läuft ohne
// SUPABASE_URL/SERVICE_ROLE_KEY (genau der CI-Kontext, für den es gedacht ist),
// createClient() wirft sofort, wenn die URL fehlt.
let supabase = null;
if (!SQL_ONLY) {
  const [{ default: dotenv }, { createClient }] = await Promise.all([
    import('dotenv'),
    import('@supabase/supabase-js'),
  ]);
  dotenv.config();
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

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

// Spaltenreihenfolge — muss mit db/migrations/0012_seed_heilmittel_katalog.sql
// und den Objektschlüsseln in physioRows()/podoRows() übereinstimmen.
const SPALTEN = [
  'code', 'bereich', 'label', 'kuerzel', 'kategorie', 'diagnosegruppen',
  'preis_eur', 'zuzahlung_eur', 'dauer', 'gueltig_ab', 'gueltig_bis',
  'deprecated', 'ungueltig_ab', 'ersetzt_durch', 'max_pro_tag',
  'max_pro_termin', 'notiz', 'gruppe', 'telemed', 'sort',
];

function sqlWert(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? "'t'" : "'f'";
  if (Array.isArray(v)) return `'{${v.join(',')}}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Baut EXAKT dieselbe Form wie db/migrations/0012_seed_heilmittel_katalog.sql. */
function buildInsertSql(rows) {
  const zeilen = rows.map(r => `  (${SPALTEN.map(s => sqlWert(r[s])).join(',')})`).join(',\n');
  const setListe = SPALTEN
    .filter(s => s !== 'code' && s !== 'bereich' && s !== 'gueltig_ab') // Konfliktschlüssel, nicht neu setzen
    .map(s => `${s}=EXCLUDED.${s}`).join(', ');
  return `INSERT INTO public.heilmittel_katalog (${SPALTEN.join(', ')}) VALUES\n${zeilen}\n`
    + `ON CONFLICT (bereich, code, gueltig_ab) DO UPDATE SET\n  ${setListe};\n`;
}

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

  if (SQL_ONLY) {
    // Kein DB-Zugriff — reiner Text aus den Codedateien. Der Aufrufer (CI oder
    // ein Mensch) leitet stdout in eine neue db/migrations/NNNN_*.sql-Datei um.
    process.stdout.write(buildInsertSql(want));
    return;
  }

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
