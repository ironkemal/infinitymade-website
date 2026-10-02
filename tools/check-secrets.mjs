#!/usr/bin/env node
// Secret-Scan-Tor (Praxura, guvenlik S-05/S-16, KHS K1.7)
// Verhindert das versehentliche Committen von API-Schlüsseln, Passwörtern und Tokens in das öffentliche Repository.
import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Liste der Secret-Muster mit Name, Regex und Sicherheitsbegründung.
 */
export const MUSTER = [
  {
    name: 'JWT',
    re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    grund: 'JSON Web Token (JWT) mit Header und Payload im Klartext',
  },
  {
    name: 'Stripe geheim',
    re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/,
    grund: 'Geheimer Stripe-API-Schlüssel (Live oder Test)',
  },
  {
    name: 'Stripe Webhook',
    re: /\bwhsec_[A-Za-z0-9]{16,}/,
    grund: 'Stripe Webhook-Signaturschlüssel',
  },
  {
    name: 'GitHub',
    re: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/,
    grund: 'GitHub Personal Access Token oder Secret',
  },
  {
    name: 'AWS',
    re: /\bAKIA[0-9A-Z]{16}\b/,
    grund: 'AWS Access Key ID',
  },
  {
    name: 'Google API',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
    grund: 'Google API-Schlüssel',
  },
  {
    name: 'Slack',
    re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
    grund: 'Slack Token (Bot, User oder App)',
  },
  {
    name: 'OpenAI/Anthropic',
    re: /\bsk-(proj-|ant-)?[A-Za-z0-9_-]{32,}/,
    grund: 'OpenAI- oder Anthropic-API-Schlüssel',
  },
  {
    name: 'Privater Schlüssel',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    grund: 'Privater kryptografischer Schlüssel',
  },
  {
    name: 'Azure/allgemein Schlüssel-Zuweisung',
    re: /(api[_-]?key|secret|password|passwort|token)\s*(?::=|[:=])\s*['"][A-Za-z0-9+/_\-]{24,}['"]/i,
    grund: 'Explizite Schlüssel- oder Passwort-Zuweisung',
  },
  {
    name: 'Verbindungs-URL mit Passwort',
    // Passwortteil darf keine Variable (${X}, $X) und kein Platzhalter (<…>, PASSWORT) sein.
    re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|smtps?):\/\/[^:\s'"]+:(?!\$|<|PASSWOR[TD]@)[^@\s'"]{6,}@/i,
    grund: 'Verbindungs-URL mit Benutzername und Passwort',
  },
];

/**
 * Liest SHA-256-Hashes aus der Allowlist-Datei.
 *
 * @param {string} [pfad] - Pfad zur Allowlist-Datei
 * @returns {Set<string>} Menge der klein geschriebenen SHA-256-Hex-Hashes
 */
export function ladeAllowlist(pfad) {
  const allowlistPfad = pfad || fileURLToPath(new URL('./.secret-allowlist', import.meta.url));
  const hashes = new Set();
  try {
    if (existsSync(allowlistPfad)) {
      const inhalt = readFileSync(allowlistPfad, 'utf8');
      for (const zeile of inhalt.split(/\r?\n/)) {
        const ohneKommentar = zeile.split('#')[0].trim();
        if (!ohneKommentar) continue;
        const hash = ohneKommentar.split(/\s+/)[0].toLowerCase();
        if (hash) {
          hashes.add(hash);
        }
      }
    }
  } catch {
    // Bei Lesefehler leeres Set zurückgeben
  }
  return hashes;
}

/**
 * Prüft, ob ein Dateipfad von der Secret-Prüfung ausgenommen werden soll.
 *
 * @param {string} pfad - Relativer oder absoluter Dateipfad
 * @returns {boolean}
 */
export function sollDateiUebersprungenWerden(pfad) {
  if (!pfad || typeof pfad !== 'string') return false;
  const norm = pfad.replace(/\\/g, '/').replace(/^\.\//, '');

  if (
    norm.startsWith('node_modules/') ||
    norm.includes('/node_modules/') ||
    norm.startsWith('vendor/') ||
    norm.includes('/vendor/') ||
    norm.startsWith('tools/vendor/') ||
    // Upstream-Kopie von supabase/docker (nicht unser Code, CLAUDE.md) — ihre
    // Beispielwerte sind dokumentierte Platzhalter.
    norm.startsWith('onprem/supabase-docker/') ||
    norm.includes('/tools/vendor/') ||
    norm.startsWith('archive/') ||
    norm.includes('/archive/')
  ) {
    return true;
  }

  if (norm.endsWith('.min.js')) {
    return true;
  }

  if (norm === 'package-lock.json' || norm.endsWith('/package-lock.json')) {
    return true;
  }

  // tools/check-secrets*.mjs und .test.js selbst
  if (/(?:^|\/)tools\/check-secrets[^/]*\.(mjs|test\.js)$/.test(norm)) {
    return true;
  }
  const basisname = norm.split('/').pop();
  if (/^check-secrets.*(\.mjs|\.test\.js)$/.test(basisname)) {
    return true;
  }

  return false;
}

/**
 * Prüft, ob der Inhalt binär ist (enthält Null-Byte \0 in den ersten 8000 Bytes).
 *
 * @param {string|Buffer} inhalt
 * @returns {boolean}
 */
export function istBinaer(inhalt) {
  if (!inhalt) return false;
  if (Buffer.isBuffer(inhalt)) {
    return inhalt.subarray(0, 8000).includes(0);
  }
  if (typeof inhalt === 'string') {
    return inhalt.slice(0, 8000).includes('\0');
  }
  return false;
}

/**
 * Prüft Text auf Secrets anhand der definierten MUSTER.
 *
 * @param {string} text - Quelltext der Datei
 * @param {string} [dateiname=''] - Name der Datei für Berichte und Pfadfilterung
 * @param {Set<string>|string[]|null} [allowlist=undefined] - Menge erlaubter Hashes
 * @returns {Array<{ datei: string, zeile: number, muster: string, auszug: string }>}
 */
export function pruefeText(text, dateiname = '', allowlist = undefined) {
  if (typeof text !== 'string') return [];
  if (istBinaer(text)) return [];
  if (dateiname && sollDateiUebersprungenWerden(dateiname)) return [];

  const allowSet =
    allowlist instanceof Set
      ? allowlist
      : Array.isArray(allowlist)
        ? new Set(allowlist.map((h) => String(h).toLowerCase()))
        : allowlist
          ? new Set(allowlist)
          : ladeAllowlist();

  const funde = [];
  const zeilen = text.split(/\r?\n/);

  for (let i = 0; i < zeilen.length; i++) {
    const zeile = zeilen[i];
    if (zeile.includes('secret-scan: ignore')) continue;
    // Ein Wert, der auf zwei Muster passt (z. B. ghToken = "ghp_…"), zählt einmal:
    // überlappende Trefferbereiche derselben Zeile werden nur beim ersten Muster gemeldet.
    const belegt = [];

    for (const muster of MUSTER) {
      const flags = muster.re.flags.includes('g') ? muster.re.flags : muster.re.flags + 'g';
      const re = new RegExp(muster.re.source, flags);
      let match;
      while ((match = re.exec(zeile)) !== null) {
        const treffer = match[0];
        const von = match.index, bis = match.index + treffer.length;
        if (treffer.length === 0) { re.lastIndex++; continue; }
        if (belegt.some(([a, b]) => von < b && a < bis)) continue;
        const trefferHash = createHash('sha256').update(treffer, 'utf8').digest('hex').toLowerCase();

        // Allowlist-Prüfung für exakten Treffer-String
        if (allowSet.has(trefferHash)) {
          continue;
        }

        // Bei Zuweisungen auch prüfen, ob der innere Wert gehasht in der Allowlist steht
        const quotesMatch = treffer.match(/['"]([^'"]+)['"]/);
        if (quotesMatch) {
          const innerHash = createHash('sha256').update(quotesMatch[1], 'utf8').digest('hex').toLowerCase();
          if (allowSet.has(innerHash)) {
            continue;
          }
        }

        // Auszug maskieren: erste 6 Zeichen + … (druckt NIE den ganzen Wert)
        const auszug = (treffer.length <= 6 ? treffer : treffer.slice(0, 6)) + '…';

        belegt.push([von, bis]);
        funde.push({
          datei: dateiname,
          zeile: i + 1,
          muster: muster.name,
          auszug,
        });

        // Verhindere Endlosschleife bei leeren Treffern
        if (match.index === re.lastIndex) {
          re.lastIndex++;
        }
      }
    }
  }

  return funde;
}

/**
 * Prüft den Inhalt einer einzelnen Datei.
 *
 * @param {string} dateiname
 * @param {string} inhalt
 * @param {Set<string>} [allowlist]
 * @returns {Array<{ datei: string, zeile: number, muster: string, auszug: string }>}
 */
export function pruefeDatei(dateiname, inhalt, allowlist) {
  return pruefeText(inhalt, dateiname, allowlist);
}

/**
 * Scannt alle gestagten Dateien im Repository.
 *
 * @param {string} [repoRoot=process.cwd()]
 * @param {Set<string>} [allowlist=null]
 * @returns {Array<{ datei: string, zeile: number, muster: string, auszug: string }>}
 */
export function scanneStaged(repoRoot = process.cwd(), allowlist = null) {
  if (process.env.SKIP_SECRET_GATE === '1') {
    console.warn('⚠️  WARNUNG / UYARI: SKIP_SECRET_GATE=1 gesetzt — Secret-Scan-Tor wird übersprungen (S-05/S-16).');
    return [];
  }

  const effectiveAllowlist = allowlist || ladeAllowlist(join(repoRoot, 'tools/.secret-allowlist'));
  let diffFilesRaw = '';
  try {
    diffFilesRaw = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err) {
    console.error('Fehler beim Ausführen von git diff --cached:', err.message);
    return [];
  }

  const dateien = diffFilesRaw
    .split(/\r?\n/)
    .map((d) => d.trim())
    .filter(Boolean);

  const alleBulgular = [];
  for (const datei of dateien) {
    if (sollDateiUebersprungenWerden(datei)) continue;

    let buf;
    try {
      buf = execFileSync('git', ['show', `:${datei}`], {
        cwd: repoRoot,
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch {
      continue;
    }

    if (istBinaer(buf)) continue;
    const inhalt = buf.toString('utf8');
    const bulgular = pruefeText(inhalt, datei, effectiveAllowlist);
    alleBulgular.push(...bulgular);
  }

  return alleBulgular;
}

/**
 * Scannt alle getrackten Dateien in der Arbeitskopie.
 *
 * @param {string} [repoRoot=process.cwd()]
 * @param {Set<string>} [allowlist=null]
 * @returns {Array<{ datei: string, zeile: number, muster: string, auszug: string }>}
 */
export function scanneAlle(repoRoot = process.cwd(), allowlist = null) {
  const effectiveAllowlist = allowlist || ladeAllowlist(join(repoRoot, 'tools/.secret-allowlist'));
  let lsFilesRaw = '';
  try {
    lsFilesRaw = execFileSync('git', ['ls-files'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err) {
    console.error('Fehler beim Ausführen von git ls-files:', err.message);
    return [];
  }

  const dateien = lsFilesRaw
    .split(/\r?\n/)
    .map((d) => d.trim())
    .filter(Boolean);

  const alleBulgular = [];
  for (const datei of dateien) {
    if (sollDateiUebersprungenWerden(datei)) continue;

    const vollerPfad = join(repoRoot, datei);
    let buf;
    try {
      buf = readFileSync(vollerPfad);
    } catch {
      continue;
    }

    if (istBinaer(buf)) continue;
    const inhalt = buf.toString('utf8');
    const bulgular = pruefeText(inhalt, datei, effectiveAllowlist);
    alleBulgular.push(...bulgular);
  }

  return alleBulgular;
}

// CLI-Ausführung: nur ausführen, wenn direkt gestartet
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const istStaged = args.includes('--staged');
  const istAlle = args.includes('--alle');

  let repoRoot;
  try {
    repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    repoRoot = process.cwd();
  }

  const allowlist = ladeAllowlist(join(repoRoot, 'tools/.secret-allowlist'));

  if (istStaged || (!istAlle && args.length === 0)) {
    if (process.env.SKIP_SECRET_GATE === '1') {
      console.warn('⚠️  WARNUNG / UYARI: SKIP_SECRET_GATE=1 gesetzt — Secret-Scan-Tor wird übersprungen (S-05/S-16).');
      process.exit(0);
    }

    const bulgular = scanneStaged(repoRoot, allowlist);
    if (bulgular.length > 0) {
      console.error('');
      console.error('  ✗ COMMIT REDDEDİLDİ — Secret-Scan-Tor: Gizli anahtar / token bulundu (S-05/S-16, KHS K1.7)');
      console.error('');
      for (const { datei, zeile, muster, auszug } of bulgular) {
        console.error(`      ${datei}:${zeile}  →  [${muster}] ${auszug}`);
      }
      console.error('');
      console.error('  Depo PUBLIC (açık kaynak). Gizli anahtarlar, API token’ları ve şifreler depoya GİREMEZ.');
      console.error('  Örnek olay: S-08 (05.08.2026) — herkese açık repoya sızan token geri alınamaz.');
      console.error('');
      console.error('  Çıkış / Çözüm:');
      console.error('    1. Gizli değeri koddan çıkarın ve ortam değişkenine (.env) taşıyın.');
      console.error('    2. Bilinçli sahte/test değeri ise aynı satıra şu işareti ekleyin:');
      console.error('         // secret-scan: ignore');
      console.error('    3. İzin verilen bilinen bir değer ise SHA-256 hash’ini allowlist’e ekleyin:');
      console.error('         tools/.secret-allowlist  (asla düz metin yazmayın, sadece sha256 hash)');
      console.error('    4. Bilinçli istisna / acil durum:');
      console.error('         SKIP_SECRET_GATE=1 git commit ...');
      console.error('');
      process.exit(1);
    }
    process.exit(0);
  } else if (istAlle) {
    const bulgular = scanneAlle(repoRoot, allowlist);
    if (bulgular.length > 0) {
      console.error('');
      console.error('  ✗ Secret-Scan-Tor: Gizli anahtar / token bulundu (S-05/S-16, KHS K1.7)');
      console.error('');
      for (const { datei, zeile, muster, auszug } of bulgular) {
        console.error(`      ${datei}:${zeile}  →  [${muster}] ${auszug}`);
      }
      const dateienAnzahl = new Set(bulgular.map((b) => b.datei)).size;
      console.error('');
      console.error(`  ✗ ${bulgular.length} Funde in ${dateienAnzahl} Dateien / ${bulgular.length} bulgu ${dateienAnzahl} dosyada tespit edildi.`);
      console.error('');
      process.exit(1);
    } else {
      console.log('  ✓ Secret-Scan: Keine Funde in Arbeitskopie / Gizli anahtar bulunamadı.');
      process.exit(0);
    }
  } else {
    // Einzelne Dateipfade prüfen
    const dateien = args.filter((a) => !a.startsWith('--'));
    const alleBulgular = [];
    for (const d of dateien) {
      if (sollDateiUebersprungenWerden(d)) continue;
      try {
        const buf = readFileSync(d);
        if (istBinaer(buf)) continue;
        const text = buf.toString('utf8');
        alleBulgular.push(...pruefeText(text, d, allowlist));
      } catch {
        // Ignorieren falls nicht lesbar
      }
    }
    if (alleBulgular.length > 0) {
      for (const { datei, zeile, muster, auszug } of alleBulgular) {
        console.error(`      ${datei}:${zeile}  →  [${muster}] ${auszug}`);
      }
      process.exit(1);
    }
    process.exit(0);
  }
}
