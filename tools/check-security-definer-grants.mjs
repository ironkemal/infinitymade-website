#!/usr/bin/env node
// Node-Teil von tools/check-security-definer-grants.sh — siehe dort für Gerechtfertigung.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// S-01/S-02/S-19 (0001) + S-24 (0002) — guvenlik/REGISTER.md §4 Behoben.
export const PROTECTED = [
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
  // Vor 0024 geschriebene Trigger-Funktionen (0003, 0021). Diese muessen
  // geschlossen bleiben: falls sie jemals per DROP+CREATE neu angelegt werden,
  // muessen sie drei REVOKEs mitbringen, da die 0024-Schleife nur EINMAL lief.
  'set_next_beleg_nr',
  'set_next_mahnung_nr',
  'set_next_ausfallrechnung_nr',
  'audit_write_log',
];

// Bewusst fuer anon/authenticated geoeffnete RPC-Funktionen.
// Nur Funktionen, die aus dem Browser (Frontend / oeffentliche Buchungsmaske)
// direkt aufgerufen werden muessen. Enge Liste — keine Trigger-Funktionen hier!
export const AUSNAHMEN = [
  {
    name: 'search_diagnosen',
    grund: 'ICD-/Diagnosegruppen-Katalogsuche via katalog-suche.js:59; Aufruf durch Dashboard und Eingabemasken erforderlich.',
  },
  {
    name: 'search_heilmittel',
    grund: 'Heilmittel-/HPNR-Katalogsuche via katalog-suche.js:73; Aufruf durch Dashboard und Eingabemasken erforderlich.',
  },
  {
    name: 'public_praxis_sector',
    grund: 'Oeffentliche Terminanfrageseite booking-request.html:677 ruft anon auf; liefert ausschliesslich Fachbereich-Text der Praxis.',
  },
  {
    name: 'find_owner_id_by_code',
    grund: 'Oeffentliche Buchungsseite booking.js:75 loest Slug zu owner_id auf; anon-Zugriff zwingend notwendig.',
  },
  {
    name: 'get_my_permissions',
    grund: 'Liest Berechtigungen des angemeldeten Benutzers in dashboard.js:907; authenticated zwingend notwendig.',
  },
];

// Historische Migrationen, die ihren REVOKE erst in einer spaeteren Migration
// erhalten haben. Da angewandte Migrationen unveraenderlich sind (SHA-256-Pruefsummen),
// werden fehlende REVOKEs ausschliesslich fuer diese exakte Datei-Funktions-Kombination
// unterdrueckt. Erscheint derselbe Funktionsname in einer anderen Datei, schlaegt das Tor an.
export const BEKANNTE_ALTLASTEN = [
  {
    datei: '0003_nummernkreis_beleg_mahnung_ausfallrechnung.sql',
    name: 'set_next_beleg_nr',
    grund: '0003 traegt keinen REVOKE in sich; Rechte wurden nachtraeglich durch die 0024-Trigger-Schleife (17.09.2026) fuer PUBLIC/anon/authenticated entzogen.',
  },
  {
    datei: '0003_nummernkreis_beleg_mahnung_ausfallrechnung.sql',
    name: 'set_next_mahnung_nr',
    grund: '0003 traegt keinen REVOKE in sich; Rechte wurden nachtraeglich durch die 0024-Trigger-Schleife (17.09.2026) fuer PUBLIC/anon/authenticated entzogen.',
  },
  {
    datei: '0003_nummernkreis_beleg_mahnung_ausfallrechnung.sql',
    name: 'set_next_ausfallrechnung_nr',
    grund: '0003 traegt keinen REVOKE in sich; Rechte wurden nachtraeglich durch die 0024-Trigger-Schleife (17.09.2026) fuer PUBLIC/anon/authenticated entzogen.',
  },
  {
    datei: '0029_datenaustausch_zaehler.sql',
    name: 'naechste_datenaustauschreferenz',
    grund: '0029 hatte nur REVOKE FROM PUBLIC; anon und authenticated wurden in 0035 (20.09.2026, S-33) geschlossen.',
  },
  {
    datei: '0029_datenaustausch_zaehler.sql',
    name: 'naechste_transfernummer',
    grund: '0029 hatte nur REVOKE FROM PUBLIC; anon und authenticated wurden in 0035 (20.09.2026, S-33) geschlossen.',
  },
  {
    datei: '0029_datenaustausch_zaehler.sql',
    name: 'datenaustausch_zaehler_vorstellen',
    grund: '0029 hatte nur REVOKE FROM PUBLIC; anon und authenticated wurden in 0035 (20.09.2026, S-33) geschlossen.',
  },
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
export const GRANTEES = ['PUBLIC', 'anon', 'authenticated'];

const protectedSet = new Set(PROTECTED.map((n) => n.toLowerCase()));
const ausnahmenSet = new Set(AUSNAHMEN.map((a) => a.name.toLowerCase()));

/**
 * Extrahiert normalen SQL-Text ausserhalb von Kommentaren (-- und /* ... *\/),
 * Zeichenketten ('...') und Dollar-gequoteten Funktionskoerpern ($$ oder $tag$).
 * Ausgefilterte Bereiche werden durch Leerzeichen ersetzt, um Wortgrenzen
 * und Token-Positionen zu erhalten.
 *
 * @param {string} sql - Vollstaendiger SQL-Quelltext
 * @returns {string} Text nur aus dem Normalzustand
 */
function extrahiereNormalenText(sql) {
  let normalerText = '';
  let zustand = 'normal'; // 'normal' | 'satirYorumu' | 'blokYorumu' | 'dizgi' | 'govde'
  let aktivesTag = '';

  for (let i = 0; i < sql.length; i++) {
    if (zustand === 'normal') {
      if (sql[i] === '-' && sql[i + 1] === '-') {
        zustand = 'satirYorumu';
        normalerText += ' ';
        i++; // zweites '-'
      } else if (sql[i] === '/' && sql[i + 1] === '*') {
        zustand = 'blokYorumu';
        normalerText += ' ';
        i++; // '*'
      } else if (sql[i] === '\'') {
        zustand = 'dizgi';
        normalerText += ' ';
      } else if (sql[i] === '$') {
        const tagMatch = sql.slice(i, i + 64).match(/^\$([a-z0-9_]*)\$/i);
        if (tagMatch) {
          zustand = 'govde';
          aktivesTag = tagMatch[0];
          normalerText += ' ';
          i += aktivesTag.length - 1;
        } else {
          normalerText += sql[i];
        }
      } else {
        normalerText += sql[i];
      }
    } else if (zustand === 'satirYorumu') {
      if (sql[i] === '\n') {
        zustand = 'normal';
        normalerText += '\n';
      }
    } else if (zustand === 'blokYorumu') {
      if (sql[i] === '*' && sql[i + 1] === '/') {
        zustand = 'normal';
        normalerText += ' ';
        i++; // '/'
      }
    } else if (zustand === 'dizgi') {
      if (sql[i] === '\'') {
        if (sql[i + 1] === '\'') {
          // Escaped quote: ''
          i++;
        } else {
          zustand = 'normal';
          normalerText += ' ';
        }
      }
    } else if (zustand === 'govde') {
      if (sql.startsWith(aktivesTag, i)) {
        zustand = 'normal';
        normalerText += ' ';
        i += aktivesTag.length - 1;
        aktivesTag = '';
      }
    }
  }

  return normalerText;
}

/**
 * Prueft den Inhalt einer einzelnen Migrationsdatei auf Sicherheitsmaengel
 * bei SECURITY DEFINER Funktionen (reine Funktion, keine Dateisystem-Seiteneffekte).
 *
 * @param {string} dateiname - Relativer oder absoluter Pfad der Datei
 * @param {string} inhalt - Inhalt der SQL-Datei
 * @returns {Array<{ art: string, datei: string, file: string, name: string, fehlend?: string[] }>}
 */
export function pruefeDatei(dateiname, inhalt) {
  const bulgular = [];
  const dateiBasisname = (dateiname || '').split(/[/\\]/).pop();

  // 1) Bestehende Pruefung: Alle Funktionen aus PROTECTED muessen
  //    REVOKE-Anweisungen fuer alle drei Grantees (PUBLIC, anon, authenticated) haben.
  for (const name of PROTECTED) {
    const creates = new RegExp(
      'CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.' + name + '\\s*\\(',
      'i'
    ).test(inhalt);
    if (!creates) continue;

    // Ein REVOKE kann mehrere Grantees in EINER Anweisung nennen
    // ("FROM PUBLIC, anon, authenticated") oder je Grantee eine eigene
    // Anweisung haben (Bauart 0001/0002/0035). Beides zaehlt.
    const fehlend = GRANTEES.filter((rolle) => !new RegExp(
      'REVOKE\\s+(EXECUTE|ALL)\\b[^;]*\\bpublic\\.' + name + '\\b[^;]*\\bFROM\\b[^;]*\\b' + rolle + '\\b',
      'is'
    ).test(inhalt));

    if (fehlend.length) {
      const istAltlast = BEKANNTE_ALTLASTEN.some(
        (alt) => alt.datei === dateiBasisname && alt.name === name
      );
      if (!istAltlast) {
        bulgular.push({
          art: 'fehlende_revokes',
          datei: dateiname,
          file: dateiname,
          name,
          fehlend,
        });
      }
    }
  }

  // 2) Neue Pruefung: Jede neu angelegte SECURITY DEFINER Funktion muss entweder
  //    auf der PROTECTED-Liste oder auf der AUSNAHMEN-Liste stehen.
  //
  //    Zustandsautomat: extrahiert reinen SQL-Text ausserhalb von Kommentaren,
  //    Strings und Dollar-Quotes. Danach wird nach Statements (Semikolons) getrennt
  //    und per robustem Regex nach CREATE FUNCTION und SECURITY DEFINER gesucht.
  const normalerText = extrahiereNormalenText(inhalt);
  const deyimler = normalerText.split(';');

  for (const deyimRoh of deyimler) {
    const deyim = deyimRoh.replace(/\s+/g, ' ').trim();
    if (!deyim) continue;

    const fnMatch = deyim.match(
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?[a-z0-9_äöüß]+"?\s*\.\s*)?"?([a-z0-9_äöüß]+)"?\s*\(/i
    );
    if (!fnMatch) continue;

    const fnName = fnMatch[1].toLowerCase();
    const isDefiner = /\bSECURITY\s+DEFINER\b/i.test(deyim);
    if (!isDefiner) continue;

    // Wenn die Funktion in PROTECTED ist, schweigt die neue Pruefung
    // (wird bereits von Pruefung 1 mit REVOKE-Pflicht abgedeckt).
    if (protectedSet.has(fnName)) continue;

    // Wenn die Funktion eine bewusste Ausnahme ist (RPCs fuer anon/authenticated), schweigen.
    if (ausnahmenSet.has(fnName)) continue;

    // Unbekannte SECURITY DEFINER Funktion -> Fund melden (Deduplizierung pro Datei)
    if (!bulgular.some((b) => b.art === 'unbekannte_definer_funktion' && b.name === fnName)) {
      bulgular.push({
        art: 'unbekannte_definer_funktion',
        datei: dateiname,
        file: dateiname,
        name: fnName,
      });
    }
  }

  return bulgular;
}

function standardLeseFn(datei) {
  try {
    return execSync('git show :' + JSON.stringify(datei), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return readFileSync(datei, 'utf8');
  }
}

/**
 * Prueft eine Liste von Migrationsdateien.
 * 0000_baseline.sql wird automatisch uebersprungen.
 *
 * @param {string[]} dateien - Liste von Dateipfaden
 * @param {Function} [leseFn] - Optionale Funktion zum Lesen des Dateiinhalts
 * @returns {Array<{ art: string, datei: string, file: string, name: string, fehlend?: string[] }>}
 */
export function pruefeDateien(dateien, leseFn = standardLeseFn) {
  const alleBulgular = [];

  for (const datei of dateien) {
    const norm = datei.replace(/\\/g, '/');
    if (norm.endsWith('/0000_baseline.sql') || norm === '0000_baseline.sql') {
      continue;
    }

    let inhalt;
    try {
      inhalt = leseFn(datei);
    } catch {
      continue; // geloeschte Datei o. ae. — nichts zu pruefen
    }

    if (typeof inhalt !== 'string') continue;

    const bulgular = pruefeDatei(datei, inhalt);
    alleBulgular.push(...bulgular);
  }

  return alleBulgular;
}

// CLI-Aufruf: nur ausfuehren, wenn direkt gestartet (nicht beim Import in Tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  const bulgular = pruefeDateien(files);

  const fehlendeRevokes = bulgular.filter((b) => b.art === 'fehlende_revokes');
  const unbekannteDefiner = bulgular.filter((b) => b.art === 'unbekannte_definer_funktion');

  if (fehlendeRevokes.length) {
    console.error('');
    console.error("  ✗ COMMIT REDDEDILDI — SECURITY DEFINER fonksiyonu eksik REVOKE ile yeniden yaratiliyor (S-04)");
    console.error('');
    for (const { datei, name, fehlend } of fehlendeRevokes) {
      console.error('      ' + datei + '  →  ' + name + '()   eksik: ' + fehlend.join(', '));
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
  }

  if (unbekannteDefiner.length) {
    console.error('');
    console.error('  ✗ COMMIT REDDEDILDI — listede olmayan yeni SECURITY DEFINER fonksiyonu');
    console.error('');
    for (const { datei, name } of unbekannteDefiner) {
      console.error('      ' + datei + '  →  ' + name + '()');
    }
    console.error('');
    for (const { name } of unbekannteDefiner) {
      console.error("  Yeni SECURITY DEFINER fonksiyonu '" + name + "' bulundu, PROTECTED listesine");
      console.error('  eklenmemis — anon/authenticated EXECUTE hakki kontrol edilmeden gecmesin diye');
      console.error('  reddedildi. Ya listeye ekle ya da bilincli olarak acik kalacaksa istisna');
      console.error('  listesine ekle.');
      console.error('');
    }
    console.error('  Supabase ALTER DEFAULT PRIVILEGES her yeni fonksiyona anon ve');
    console.error('  authenticated icin ayri GRANT verir; liste disi kalan fonksiyon');
    console.error('  sessizce disariya acik dogar (0029/0035, 20.09.2026).');
    console.error('');
    console.error('  Bilincli istisna gerekiyorsa:  SKIP_SECDEF_GATE=1 git commit ...');
    console.error('');
  }

  if (fehlendeRevokes.length || unbekannteDefiner.length) {
    process.exit(1);
  }
}
