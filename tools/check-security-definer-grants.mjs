#!/usr/bin/env node
// Node-Teil von tools/check-security-definer-grants.sh — siehe dort für Gerechtfertigung.
import { execSync } from 'node:child_process';

// S-01/S-02/S-19 (0001) + S-24 (0002) — guvenlik/REGISTER.md §4 Behoben.
const PROTECTED = [
  'get_gmail_token',
  'set_gmail_token',
  'clear_gmail_token',
  'naechste_nummer',
  'naechste_verordnungsnummer',
  // §302-Echtbetrieb Schritt 1.2 (0029). Dieselbe Bauart wie naechste_nummer:
  // SECURITY DEFINER, Mandant kommt als ARGUMENT statt aus auth.uid(), und aus
  // dem Ergebnis entsteht eine Rechnungs-/Datenaustauschnummer. Wer die
  // Funktion aufrufen darf, darf die Nummernfolge einer fremden Praxis
  // weiterdrehen — deshalb gehoert sie auf diese Liste.
  'naechste_datenaustauschreferenz',
  'naechste_transfernummer',
  'datenaustausch_zaehler_vorstellen',
];

// ⚠️ DREI QUELLEN, NICHT EINE (Lehre aus 0035, 20.09.2026).
//
// Bis dahin verlangte dieses Tor nur `REVOKE ... FROM ... PUBLIC`. Migration
// 0029 hatte genau das — und trotzdem waren ihre drei SECURITY-DEFINER-
// Funktionen anschliessend fuer `anon` UND `authenticated` ueber
// POST /rest/v1/rpc/<name> aufrufbar. Das Tor war gruen und das Loch offen.
//
// Grund: in Supabase kommt EXECUTE auf NEU angelegte Funktionen in `public`
// nicht nur ueber PUBLIC, sondern zusaetzlich als EIGENER Grant aus
// ALTER DEFAULT PRIVILEGES. Live nachgemessen (pg_default_acl, defaclobjtype
// 'f', Schema public, Grantor postgres):
//   {postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
// Ein REVOKE FROM PUBLIC nimmt einem EINZELNEN Grantee nichts weg.
//
// Umgekehrt war der Befund von 0024 (17.09.2026) genau andersherum: dort trugen
// BESTANDS-Funktionen `=X/postgres` (PUBLIC), und ein REVOKE nur von anon und
// authenticated haette nichts geschlossen, weil beide es ueber PUBLIC geerbt
// haetten.
//
// Beide Wege existieren also nebeneinander, und wer nur einen schliesst,
// schliesst nichts. Deshalb werden ab sofort ALLE DREI Grantees verlangt.
const GRANTEES = ['PUBLIC', 'anon', 'authenticated'];

const files = process.argv.slice(2);
const bad = [];

for (const f of files) {
  let content;
  try {
    content = execSync('git show :' + JSON.stringify(f), { encoding: 'utf8' });
  } catch {
    continue; // gelöschte Datei o. ä. — nichts zu prüfen
  }

  for (const name of PROTECTED) {
    const creates = new RegExp(
      'CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.' + name + '\\s*\\(',
      'i'
    ).test(content);
    if (!creates) continue;

    // Ein REVOKE kann mehrere Grantees in EINER Anweisung nennen
    // ("FROM PUBLIC, anon, authenticated") oder je Grantee eine eigene
    // Anweisung haben (Bauart 0001/0002/0035). Beides zaehlt.
    const fehlend = GRANTEES.filter((rolle) => !new RegExp(
      'REVOKE\\s+(EXECUTE|ALL)\\b[^;]*\\bpublic\\.' + name + '\\b[^;]*\\bFROM\\b[^;]*\\b' + rolle + '\\b',
      'is'
    ).test(content));

    if (fehlend.length) bad.push({ file: f, name, fehlend });
  }
}

if (bad.length) {
  console.error('');
  console.error("  ✗ COMMIT REDDEDILDI — SECURITY DEFINER fonksiyonu eksik REVOKE ile yeniden yaratiliyor (S-04)");
  console.error('');
  for (const { file, name, fehlend } of bad) {
    console.error('      ' + file + '  →  ' + name + '()   eksik: ' + fehlend.join(', '));
  }
  console.error('');
  console.error("  CREATE (OR REPLACE) FUNCTION Postgres'te PUBLIC EXECUTE hakkini sifirlar.");
  console.error('  AYRICA Supabase ALTER DEFAULT PRIVILEGES her yeni fonksiyona anon ve');
  console.error("  authenticated icin AYRI birer GRANT verir — FROM PUBLIC onlari ALMAZ.");
  console.error('  Bu yuzden ucu de gerekli (0035, 20.09.2026 — 0029 tam bu yuzden acik kaldi):');
  console.error('');
  console.error('      REVOKE EXECUTE ON FUNCTION public.<isim>(...) FROM PUBLIC;');
  console.error('      REVOKE EXECUTE ON FUNCTION public.<isim>(...) FROM anon;');
  console.error('      REVOKE EXECUTE ON FUNCTION public.<isim>(...) FROM authenticated;');
  console.error('      GRANT  EXECUTE ON FUNCTION public.<isim>(...) TO service_role;');
  console.error('');
  console.error('  Sicil: guvenlik/REGISTER.md §4 — S-01/S-02/S-19 (0001), S-24 (0002).');
  console.error('  Bilincli istisna gerekiyorsa:  SKIP_SECDEF_GATE=1 git commit ...');
  console.error('');
  process.exit(1);
}
