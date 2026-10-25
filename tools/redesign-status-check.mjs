#!/usr/bin/env node
/**
 * redesign-status-check.mjs — Wache für `redesign/STATUS.md` (Redesign v2, PLAN-V2 §9).
 *
 * Warum
 * ─────
 * Der Dauerlauf arbeitet über viele Sitzungen und Kompaktierungen. Sein einziges
 * Gedächtnis ist `redesign/STATUS.md`. Im v1-Lauf driftete die Datei (Kopf sagte
 * „fertig“, Checkliste darunter „offen“, Cache-Nummer veraltet). Eine Sitzung,
 * die einer falschen STATUS-Zeile glaubt, baut doppelt oder überspringt Arbeit.
 *
 * Was geprüft wird
 * ────────────────
 *  1. Paketliste (Abschnitt „## 2 Paketliste“) hat nur bekannte Status-Werte.
 *  2. Höchstens ein Paket „in Arbeit“.
 *  3. Jedes „fertig“ nennt einen Commit: einen SHA, der in HEAD enthalten ist,
 *     oder genau einmal „dieser Commit“ (das gerade entstehende Paket).
 *  4. Jedes „blockiert“ steht im Fehlerbuch (ID kommt in „## 4 Fehlerbuch“ vor).
 *  5. „Nächstes Paket“ im Kurzzustand existiert und ist nicht fertig.
 *  6. Jede Cache-Nummer im Kurzzustand stimmt mit `dashboard.html` überein.
 *  7. Keine zweite Fortschrittsquelle: keine Checklisten-Zeilen „- [ ]“ / „- [x]“.
 *
 *   node tools/redesign-status-check.mjs     prüfen (Exit 1 bei Fehler)
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUS_WERTE = new Set(['offen', 'in Arbeit', 'blockiert', 'wartet-Melih', 'fertig']);

function abschnitt(text, kopf) {
  const start = text.indexOf(kopf);
  if (start < 0) return '';
  const rest = text.slice(start + kopf.length);
  const ende = rest.search(/\n## /);
  return ende < 0 ? rest : rest.slice(0, ende);
}

/** Zeilen der Paketliste als Objekte. Spalten laut Tabellenkopf in STATUS.md. */
export function paketZeilen(text) {
  return abschnitt(text, '## 2 Paketliste')
    .split('\n')
    .filter((z) => /^\|\s*V\d/.test(z))
    .map((z) => {
      const zellen = z.split('|').slice(1, -1).map((s) => s.trim());
      return { id: zellen[0], status: zellen[6], commit: zellen[7] ?? '' };
    });
}

/**
 * Reine Prüfung, testbar ohne git.
 * @param {string} text  Inhalt von STATUS.md
 * @param {{html: string, istInHead: (sha: string) => boolean}} umgebung
 * @returns {string[]} Fehlermeldungen (leer = gut)
 */
export function pruefeStatus(text, { html, istInHead }) {
  const fehler = [];
  const pakete = paketZeilen(text);
  if (!pakete.length) fehler.push('Paketliste fehlt oder ist leer (Abschnitt „## 2 Paketliste“).');

  const ids = new Set();
  for (const p of pakete) {
    if (ids.has(p.id)) fehler.push(`Paket ${p.id} doppelt.`);
    ids.add(p.id);
    if (!STATUS_WERTE.has(p.status)) fehler.push(`Paket ${p.id}: unbekannter Status „${p.status}“.`);
  }

  const inArbeit = pakete.filter((p) => p.status === 'in Arbeit');
  if (inArbeit.length > 1) fehler.push(`Mehr als ein Paket „in Arbeit“: ${inArbeit.map((p) => p.id).join(', ')}.`);

  let dieser = 0;
  for (const p of pakete.filter((p) => p.status === 'fertig')) {
    if (p.commit === 'dieser Commit') { dieser++; continue; }
    const sha = p.commit.match(/\b[0-9a-f]{7,40}\b/)?.[0];
    if (!sha) fehler.push(`Paket ${p.id} ist fertig, nennt aber keinen Commit.`);
    else if (!istInHead(sha)) fehler.push(`Paket ${p.id}: Commit ${sha} ist nicht in HEAD enthalten.`);
  }
  if (dieser > 1) fehler.push(`„dieser Commit“ steht ${dieser}× (erlaubt: 1). Ältere durch den SHA ersetzen.`);

  const fehlerbuch = abschnitt(text, '## 4 Fehlerbuch');
  for (const p of pakete.filter((p) => p.status === 'blockiert')) {
    if (!fehlerbuch.includes(p.id)) fehler.push(`Paket ${p.id} ist blockiert, steht aber nicht im Fehlerbuch.`);
  }

  const kurz = abschnitt(text, '## 0 Kurzzustand');
  const naechstes = kurz.match(/Nächstes Paket:\s*(V[\w.]+)/)?.[1];
  if (!naechstes) fehler.push('Kurzzustand nennt kein „Nächstes Paket“.');
  else {
    const p = pakete.find((x) => x.id === naechstes);
    if (!p) fehler.push(`„Nächstes Paket“ ${naechstes} steht nicht in der Paketliste.`);
    else if (p.status === 'fertig') fehler.push(`„Nächstes Paket“ ${naechstes} ist schon fertig.`);
  }

  const cacheZeile = kurz.split('\n').find((z) => z.includes('Cache-Nummern:')) ?? '';
  for (const [, datei, version] of cacheZeile.matchAll(/([\w./-]+\.(?:css|js))\s*\?v=([\w.-]+)/g)) {
    const re = new RegExp(`${datei.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=([\\w.-]+)`);
    const ist = html.match(re)?.[1];
    if (!ist) fehler.push(`Cache-Nummer: ${datei} wird in dashboard.html nicht mit ?v= geladen.`);
    else if (ist !== version) fehler.push(`Cache-Nummer: ${datei} steht in STATUS als ${version}, in dashboard.html als ${ist}.`);
  }

  if (/^\s*- \[[ x~]\]/m.test(text)) fehler.push('Checklisten-Zeilen „- [ ]“ gefunden: Fortschritt nur in der Paketliste führen.');
  return fehler;
}

const istHaupt = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (istHaupt) {
  const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
  const text = readFileSync(join(wurzel, 'redesign', 'STATUS.md'), 'utf8');
  const html = readFileSync(join(wurzel, 'dashboard.html'), 'utf8');
  const istInHead = (sha) => {
    try { execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: wurzel, stdio: 'ignore' }); return true; }
    catch { return false; }
  };
  const fehler = pruefeStatus(text, { html, istInHead });
  if (fehler.length) {
    console.error(`✗ redesign-status: ${fehler.length} Problem(e) in redesign/STATUS.md`);
    for (const f of fehler) console.error('   - ' + f);
    process.exit(1);
  }
  const pakete = paketZeilen(text);
  const fertig = pakete.filter((p) => p.status === 'fertig').length;
  console.log(`✓ redesign-status: ${pakete.length} Pakete, ${fertig} fertig, Kurzzustand und Cache-Nummern stimmig`);
}
