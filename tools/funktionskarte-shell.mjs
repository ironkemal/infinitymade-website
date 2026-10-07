// tools/funktionskarte-shell.mjs
// Reine Parser- und Analysefunktionen für Shell-Skripte (Bash + PowerShell).
// Kein Dateisystem-Zugriff, keine Seiteneffekte beim Laden.

/**
 * Erkennt den Beginn eines Here-Documents in Bash.
 * Unterstützt <<, <<-, mit/ohne Quotes (' oder "), z. B. <<EOF, <<'EOF', <<-EOF.
 * Ignoriert Here-Strings (<<<) und Kommentarzeilen.
 */
function getHeredocStart(line) {
  if (/^\s*#/.test(line)) return null;
  const m = line.match(/(?:^|[^<])<<-?\s*(?:'([^']+)'|"([^"]+)"|\\?([A-Za-z0-9_]+))/);
  if (!m) return null;
  return m[1] || m[2] || m[3];
}

/**
 * Ermittelt das Ende eines Funktionskörpers ohne Klammerzählen.
 * - Endet die Definitionszeile selbst mit '}' (z. B. log() { ...; }) -> Ende = diese Zeile.
 * - Sonst: erste Folgezeile, die nur aus '}' besteht (optional mit ';' / Kommentar)
 *   und deren Einrückung <= der Einrückung der Definitionszeile ist.
 * - Heredoc-Zeilen innerhalb der Funktion können das Ende nicht auslösen.
 * - Nichts gefunden -> Ende = Definitionszeile.
 */
function findBodyEnd(lines, start, defIndent, lang) {
  const defLine = lines[start];
  const defClean = defLine.replace(/(?:^|\s+)#.*$/, '').trim();
  if (defClean.endsWith('}') || defClean.endsWith('};')) {
    return start;
  }

  let inHeredoc = null;
  for (let j = start + 1; j < lines.length; j++) {
    const line = lines[j];

    if (lang === 'bash') {
      if (inHeredoc) {
        if (line.trim() === inHeredoc) {
          inHeredoc = null;
        }
        continue;
      }
      const delim = getHeredocStart(line);
      if (delim) {
        inHeredoc = delim;
        continue;
      }
    }

    // Zeile besteht (nach optionalem Leerraum) nur aus '}' (optional gefolgt von Kommentar/;)
    const m = line.match(/^(\s*)\}(?:\s*(?:;|#.*))?\s*$/);
    if (m) {
      const lineIndent = m[1].length;
      if (lineIndent <= defIndent) {
        return j;
      }
    }
  }

  return start;
}

/**
 * Sammelt zusammenhängende #-Kommentarzeilen unmittelbar über der Definition
 * und sucht nach Spiegel-Hinweisen ("Spiegel von" / "Identisch mit").
 */
function extractSpiegelHinweis(lines, defIdx) {
  const toplanan = [];
  let i = defIdx - 1;
  while (i >= 0) {
    const t = lines[i].trim();
    if (t === '' && toplanan.length === 0) { i--; continue; }
    if (t === '') break;
    if (t.startsWith('#')) {
      toplanan.unshift(t);
      i--;
      continue;
    }
    break;
  }
  if (!toplanan.length) return null;
  const rawText = toplanan
    .map(l => l.replace(/^#+\s*/, '').trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Anders als JS (spiegelYakala: bis zum ersten Punkt): Shell-Verweise nennen
  // Dateinamen mit Punkt (install.sh) — erst Satzende-Punkt (". " oder Ende) beendet.
  const m = rawText.match(/(Spiegel von|Identisch mit)\b.{0,160}?(?=\.\s|\.?$)/i);
  return m ? m[0].trim() : null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Findet Funktionsdefinitionen in Bash- oder PowerShell-Text.
 * @param {string} text - Dateiinhalt
 * @param {string} datei - Relativer Dateipfad
 * @param {'bash'|'ps1'} lang - Skriptsprache
 * @returns {Array<{ name: string, kind: string, lang: string, file: string, start: number, end: number, lines: number, body: string, spiegelHinweis: string|null }>}
 */
export function shellFunktionenFinden(text, datei, lang) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const result = [];
  let inHeredoc = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (lang === 'bash') {
      if (inHeredoc) {
        if (line.trim() === inHeredoc) inHeredoc = null;
        continue;
      }
      const delim = getHeredocStart(line);
      if (delim) {
        inHeredoc = delim;
        continue;
      }
    }

    if (/^\s*#/.test(line)) continue;

    let match = null;
    let kind = null;

    if (lang === 'bash') {
      const m1 = line.match(/^\s*(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{?/);
      if (m1) {
        match = m1[1];
        kind = 'bash-function';
      } else {
        const m2 = line.match(/^\s*function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
        if (m2) {
          match = m2[1];
          kind = 'bash-function';
        }
      }
    } else if (lang === 'ps1') {
      const mp = line.match(/^\s*function\s+([A-Za-z_][A-Za-z0-9_-]*)\b/i);
      if (mp) {
        match = mp[1];
        kind = 'ps-function';
      }
    }

    if (!match) continue;

    const defIndent = (line.match(/^(\s*)/) || [''])[1].length;
    const end = findBodyEnd(lines, i, defIndent, lang);

    result.push({
      name: match,
      kind,
      lang,
      file: datei,
      start: i + 1,
      end: end + 1,
      lines: end - i + 1,
      body: lines.slice(i, end + 1).join('\n'),
      spiegelHinweis: extractSpiegelHinweis(lines, i),
    });

    i = end;
  }

  return result;
}

/**
 * Ermittelt die per `source` oder `.` eingebundenen Dateinamen (nur Basename).
 * Kommentarzeilen werden ignoriert.
 * @param {string} text - Dateiinhalt
 * @returns {string[]} Liste der eindeutigen Basenamen
 */
export function shellQuellen(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const quellen = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const stripped = line.replace(/(?:^|\s+)#.*$/, '').trim();
    const m = stripped.match(/(?:^|[;&|]\s*|\s+)(?:source|\.)\s+(?:["']([^"']+)["']|(\S+))/);
    if (m) {
      const rawPath = m[1] || m[2];
      if (rawPath) {
        const base = rawPath.replace(/["']/g, '').split(/[/\\]/).pop().trim();
        if (base && !quellen.includes(base)) {
          quellen.push(base);
        }
      }
    }
  }

  return quellen;
}

/**
 * Ermittelt Aufrufe bekannter Funktionen innerhalb eines Code-Körpers.
 * @param {string} body - Zu durchsuchender Code
 * @param {Set<string>|string[]} bekannteNamen - Menge bekannter Funktionsnamen
 * @param {string|null} [eigenerName=null] - Name der aktuellen Funktion (wird ausgeschlossen)
 * @param {'bash'|'ps1'} [lang='bash'] - Skriptsprache
 * @returns {string[]} Sortierte, eindeutige Liste der aufgerufenen Funktionsnamen
 */
export function shellAufrufe(body, bekannteNamen, eigenerName = null, lang = 'bash') {
  if (!body || !bekannteNamen) return [];

  const namenList = [...bekannteNamen].filter(n => n && n !== eigenerName);
  if (!namenList.length) return [];

  // Kommentare (# bis Zeilenende, wenn # am Wortanfang steht) vorher entfernen
  const cleanLines = body.split(/\r?\n/).map(line => line.replace(/(?:^|\s+)#.*$/, ''));
  const cleanBody = cleanLines.join('\n');

  const gefundene = new Set();

  if (lang === 'ps1') {
    // ps1: Name als Wort gefolgt von Leerraum/(/Zeilenende, case-insensitive.
    for (const name of namenList) {
      const re = new RegExp(String.raw`\b${escapeRegex(name)}(?=[\s(]|$)`, 'im');
      if (re.test(cleanBody)) {
        gefundene.add(name);
      }
    }
  } else {
    // bash: am Zeilenanfang (nach Leerraum), oder nach ;, &&, ||, |, $(, `, if , ! , then , do , else , elif , while , until ;
    // gefolgt von Leerraum, Zeilenende, ; oder )
    // \x60 = Backtick (im String.raw-Template nicht direkt schreibbar)
    const PRE = String.raw`(?:\s*(?:;|&&|\|\||\||\$\(|\x60|(?:\b(?:if|then|do|else|elif|while|until)|!)\s+)|^)\s*`;
    const SUF = String.raw`(?=[\s;)\x60]|$)`;

    for (const name of namenList) {
      const re = new RegExp(PRE + escapeRegex(name) + SUF, 'm');
      if (re.test(cleanBody)) {
        gefundene.add(name);
      }
    }
  }

  return [...gefundene].sort();
}
