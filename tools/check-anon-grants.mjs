#!/usr/bin/env node
// Node-Teil von tools/check-anon-grants.sh — siehe dort für die Begründung (S-56, O-181).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { extrahiereNormalenText } from './check-security-definer-grants.mjs';

// Migrationen, die vor 0072 geschrieben wurden und deshalb Regel 3 nicht kennen.
// Angewandte Dateien sind unveränderlich (SHA-256) — Ausnahme nur für genau diese Datei.
export const BEKANNTE_ALTLASTEN = [
  {
    datei: '0055_mitarbeiter_zugang_haertung.sql',
    regel: 'sicht_ohne_spaltengrant',
    grund: '0055 hat profiles_public neu angelegt, als anon noch Tabellenrechte auf profiles hatte (vor S-56/0072). Die nötigen Spaltenrechte vergibt 0072.',
  },
];

const ANON = /\b(anon|PUBLIC)\b/i;

/**
 * Prüft eine Migrationsdatei auf die drei S-56-Rückfallwege.
 * @returns {Array<{ regel: string, datei: string, satz?: string }>}
 */
export function pruefeDatei(dateiname, inhalt) {
  const basis = (dateiname || '').split(/[/\\]/).pop();
  const text = extrahiereNormalenText(inhalt);
  const saetze = text.split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const befunde = [];
  let hatSicht = false;
  let hatSpaltenGrant = false;

  for (const satz of saetze) {
    if (/^CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+("?public"?\s*\.\s*)?"?profiles_public"?\b/i.test(satz)) hatSicht = true;

    // ALTER DEFAULT PRIVILEGES … GRANT … ON TABLES TO anon: jede künftige Tabelle offen
    const adp = satz.match(/^ALTER\s+DEFAULT\s+PRIVILEGES\b.*\bGRANT\b.*\bON\s+TABLES\s+TO\s+(.*)$/i);
    if (adp && ANON.test(adp[1])) {
      befunde.push({ regel: 'default_privileges', datei: dateiname, satz });
      continue;
    }
    const g = satz.match(/^GRANT\s+(.*?)\s+ON\s+(.*?)\s+TO\s+(.*)$/i);
    if (!g) continue;
    const [, rechte, objekt, empfaenger] = g;
    if (!ANON.test(empfaenger)) continue;

    // (1) GRANT … ON ALL TABLES IN SCHEMA … TO anon
    if (/^ALL\s+TABLES\s+IN\s+SCHEMA\b/i.test(objekt)) {
      befunde.push({ regel: 'alle_tabellen', datei: dateiname, satz });
      continue;
    }
    // (2) Tabellenrecht auf profiles ohne Spaltenliste
    if (/^(TABLE\s+)?("?public"?\s*\.\s*)?"?profiles"?$/i.test(objekt)) {
      if (rechte.includes('(')) {
        if (/^SELECT\s*\(/i.test(rechte)) hatSpaltenGrant = true;
      } else {
        befunde.push({ regel: 'profiles_ohne_spaltenliste', datei: dateiname, satz });
      }
    }
  }

  // (3) Sicht angefasst, Spaltenrechte vergessen → Buchungsseite bricht lautlos
  if (hatSicht && !hatSpaltenGrant) {
    const altlast = BEKANNTE_ALTLASTEN.some((a) => a.datei === basis && a.regel === 'sicht_ohne_spaltengrant');
    if (!altlast) befunde.push({ regel: 'sicht_ohne_spaltengrant', datei: dateiname });
  }
  return befunde;
}

function standardLeseFn(datei) {
  try {
    return execSync('git show :' + JSON.stringify(datei), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return readFileSync(datei, 'utf8');
  }
}

export function pruefeDateien(dateien, leseFn = standardLeseFn) {
  const alle = [];
  for (const datei of dateien) {
    const norm = datei.replace(/\\/g, '/');
    if (norm.endsWith('/0000_baseline.sql') || norm === '0000_baseline.sql') continue;
    let inhalt;
    try { inhalt = leseFn(datei); } catch { continue; }
    if (typeof inhalt !== 'string') continue;
    alle.push(...pruefeDatei(datei, inhalt));
  }
  return alle;
}

const TEXT = {
  default_privileges: 'ALTER DEFAULT PRIVILEGES … ON TABLES TO anon — jede künftige Tabelle wäre anon-lesbar (S-56)',
  alle_tabellen: 'GRANT … ON ALL TABLES … TO anon — dreht 0072 zurück (S-56, S-04-Klasse)',
  profiles_ohne_spaltenliste: 'Tabellenrecht auf public.profiles für anon ohne Spaltenliste — IBAN/E-Mail wieder lesbar (S-56)',
  sicht_ohne_spaltengrant: 'profiles_public neu angelegt, aber kein GRANT SELECT (…) ON public.profiles TO anon in derselben Datei — Buchungsseite bricht lautlos',
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const befunde = pruefeDateien(process.argv.slice(2));
  if (befunde.length) {
    console.error('');
    console.error('  ✗ COMMIT REDDEDILDI — anon-Rechte auf profiles (S-56 / O-181)');
    console.error('');
    for (const b of befunde) {
      console.error('      ' + b.datei + '  →  ' + TEXT[b.regel]);
      if (b.satz) console.error('        ' + b.satz.slice(0, 160));
    }
    console.error('');
    console.error('  Regel (db/REGISTER.md → profiles): anon bekommt profiles nur SPALTENWEISE.');
    console.error('  Neue Spalte in profiles_public ⇒ in derselben Migration:');
    console.error('      GRANT SELECT (<spalte>, …) ON public.profiles TO anon;');
    console.error('');
    console.error('  Bilinçli istisna:  SKIP_ANON_GRANT_GATE=1 git commit ...');
    console.error('');
    process.exit(1);
  }
}
