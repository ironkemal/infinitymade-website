#!/usr/bin/env node
// Read-only Hostprobe für Ops #334. Kein Alarmversand, keine Installation und
// keine Bereinigung. Unter WSL misst df das Gast-Dateisystem, nicht Windows.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {(file: string, args: readonly string[], options?: import('node:child_process').ExecFileOptions) => Promise<{ stdout: string }>} DiskRunner
 * @typedef {{ path?: string, warning?: number, critical?: number, run?: DiskRunner }} DiskCheckOptions
 * @typedef {{ exitCode: number, help?: string, status?: string, error?: string, path?: string, blocks?: { total: number, used: number, free: number, percent: number }, inodes?: { total: number, used: number, free: number, percent: number } }} DiskCheckResult
 */

/** @type {DiskRunner} */
const exec = promisify(execFile);

/**
 * @param {string} text
 * @param {'blocks' | 'inodes'} [kind]
 */
export function parseDf(text, kind = 'blocks') {
  if (!['blocks', 'inodes'].includes(kind)) throw new Error('Unbekannte Messart');
  const lines = String(text).trim().split(/\r?\n/);
  if (lines.length !== 2 || !/^Filesystem\s/.test(lines[0])) throw new Error('Ungültige df-Ausgabe');
  // POSIX/GNU df -P: Filesystem, Gesamt, Belegt, Frei, Prozent, Mountpoint.
  // BSD/macOS -Pi kann zusätzliche Inode-Spalten vor dem Mountpoint ausgeben.
  const row = lines[1].trim().split(/\s+/);
  const percentageIndices = row.flatMap((value, index) => /^\d+%$/.test(value) ? [index] : []);
  const index = kind === 'inodes' ? percentageIndices.at(-1) : percentageIndices[0];
  if (index === undefined || index < 4 || row.length <= index + 1) throw new Error('Messwerte fehlen');
  const bsdInodes = kind === 'inodes' && percentageIndices.length > 1;
  const raw = row.slice(index - (bsdInodes ? 2 : 3), index);
  if (!raw.every(value => /^\d+$/.test(value))) throw new Error('Messwerte ungültig');
  let [total, used, free] = raw.map(Number);
  if (bsdInodes) { used = Number(raw[0]); free = Number(raw[1]); total = used + free; }
  const percent = Number(row[index].slice(0, -1));
  if (![total, used, free, percent].every(Number.isSafeInteger) || total <= 0 || used > total || free > total) {
    throw new Error('Messwerte nicht plausibel');
  }
  return { total, used, free, percent };
}

/**
 * @param {DiskCheckOptions} [opts]
 * @returns {Promise<DiskCheckResult>}
 */
export async function checkDisk({ path = '/', warning = 80, critical = 90, run = exec } = {}) {
  try {
    if (typeof path !== 'string' || !path.startsWith('/') || path.includes('\0')) throw new Error('Absoluter Pfad erforderlich');
    if (![warning, critical].every(Number.isInteger) || warning < 1 || warning >= critical || critical > 100) {
      throw new Error('Schwellen müssen 1 <= warning < critical <= 100 erfüllen');
    }
    const options = { env: { ...process.env, LC_ALL: 'C' }, timeout: 5000, maxBuffer: 64 * 1024 };
    const blocks = parseDf((await run('df', ['-Pk', path], options)).stdout);
    const inodes = parseDf((await run('df', ['-Pi', path], options)).stdout, 'inodes');
    const highest = Math.max(blocks.percent, inodes.percent);
    const exitCode = highest >= critical ? 2 : highest >= warning ? 1 : 0;
    return { status: ['OK', 'WARNING', 'CRITICAL'][exitCode], exitCode, path, blocks, inodes };
  } catch {
    // Keine rohe Prozessfehlermeldung/Umgebung ausgeben. Unbekannt ist nicht OK.
    return { status: 'UNKNOWN', exitCode: 3, error: 'Speichermessung fehlgeschlagen; Pfad, df-Unterstützung und Schwellen prüfen.' };
  }
}

/**
 * @param {string[]} args
 * @param {DiskRunner} [run]
 * @returns {Promise<DiskCheckResult>}
 */
export async function diskcheckCli(args, run = exec) {
  if (args.length === 1 && args[0] === '--help') {
    return { exitCode: 0, help: 'node tools/diskcheck.mjs [--path /] [--warning 80] [--critical 90]\nExit: 0 OK, 1 WARNING, 2 CRITICAL, 3 UNKNOWN. Keine Alarmierung. WSL: nur Gast-Dateisystem.' };
  }
  /** @type {DiskCheckOptions} */
  const options = { run };
  /** @type {Record<string, 'path' | 'warning' | 'critical'>} */
  const argMap = { '--path': 'path', '--warning': 'warning', '--critical': 'critical' };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = argMap[args[i]];
    if (!key || seen.has(key) || args[i + 1] === undefined) return { status: 'UNKNOWN', exitCode: 3, error: 'Ungültige Argumente; --help verwenden.' };
    seen.add(key);
    const value = args[i + 1];
    if (key !== 'path' && !/^\d+$/.test(value)) return { status: 'UNKNOWN', exitCode: 3, error: 'Ungültige Schwelle.' };
    if (key === 'path') options.path = value;
    else options[key] = Number(value);
  }
  return checkDisk(options);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await diskcheckCli(process.argv.slice(2));
  process.stdout.write(result.help ? result.help + '\n' : JSON.stringify(result) + '\n');
  process.exitCode = result.exitCode;
}
