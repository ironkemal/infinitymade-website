// start.mjs — Prozess-Starter für das API-Image, ersetzt pm2-runtime (O-179, 08.10.2026).
//
// Warum: pm2 (AGPL-3.0) ruft alle 24 h version.pm2.io auf (pm2/lib/Worker.js:201,
// TLS-Prüfung aus) — nicht abschaltbar, nicht patchbar (Patchen löst AGPL §13 aus).
// Auf der Box ist das eine undeklarierte Außenverbindung (G1), legal-de 08.10.
//
// Was er übernimmt (vorher pm2 -i 2 --max-memory-restart 500M --node-args …):
//   · 2 Worker über node:cluster, gleicher Port (cluster verteilt).
//   · NODE_APP_INSTANCE = 0/1 je Worker — server.js:3881 (23:55-Abschluss nur
//     einmal) und merkez-istemci/ip-abgleich.js:248 lesen genau diese Variable.
//   · execArgv: --max-old-space-size=256 + --import ./instrument.js (Sentry vor
//     Express, O-83 Schicht 1) für jeden Worker.
//   · O-83 Schicht 2: RSS je Worker aus /proc/<pid>/status; > 500 MB → SIGTERM,
//     Neustart nur dieses Workers, der andere bedient weiter.
//   · Absturz → Neustart mit wachsender Pause (1 s … 30 s), zurück auf 1 s
//     nach 60 s Laufzeit — kein heißer Crash-Loop.
//   · PID 1 im Container: SIGTERM/SIGINT an alle Worker weiterreichen, nach
//     8 s hart beenden (docker stop wartet 10 s).
import cluster from 'node:cluster';
import { readFileSync } from 'node:fs';

const ANZAHL = Math.max(1, Number.parseInt(process.env.PRAXURA_WORKER || '2', 10) || 2);
const MAX_RSS_KB = 500 * 1024;
const PRUEF_MS = 30_000;

if (!cluster.isPrimary) {
  throw new Error('start.mjs ist nur der Primärprozess — Worker laufen server.js');
}

cluster.setupPrimary({
  exec: 'server.js',
  execArgv: ['--max-old-space-size=256', '--import', './instrument.js'],
});

const log = (msg) => console.log(`[start] ${new Date().toISOString()} ${msg}`);
const stand = new Map(); // index -> { worker, seit, pause }
let beenden = false;

function starte(index) {
  const vorher = stand.get(index);
  const worker = cluster.fork({ NODE_APP_INSTANCE: String(index) });
  stand.set(index, { worker, seit: Date.now(), pause: vorher?.pause ?? 1000 });
  log(`Worker ${index} gestartet (pid ${worker.process.pid})`);
}

cluster.on('exit', (worker, code, signal) => {
  const index = [...stand.entries()].find(([, s]) => s.worker === worker)?.[0];
  if (index === undefined) return;
  if (beenden) {
    stand.delete(index);
    if (stand.size === 0) process.exit(0);
    return;
  }
  const s = stand.get(index);
  const lief = Date.now() - s.seit;
  const pause = lief > 60_000 ? 1000 : Math.min(s.pause * 2, 30_000);
  s.pause = pause;
  log(`Worker ${index} beendet (code ${code}, signal ${signal ?? '-'}, lief ${Math.round(lief / 1000)} s) — Neustart in ${pause / 1000} s`);
  setTimeout(() => { if (!beenden) starte(index); }, pause);
});

function rssKb(pid) {
  try {
    const m = readFileSync(`/proc/${pid}/status`, 'utf8').match(/^VmRSS:\s+(\d+)\s+kB/m);
    return m ? Number(m[1]) : null;
  } catch { return null; } // kein /proc (z. B. Windows-Entwicklung) → keine Prüfung
}

setInterval(() => {
  for (const [index, { worker }] of stand) {
    const kb = rssKb(worker.process.pid);
    if (kb !== null && kb > MAX_RSS_KB) {
      log(`Worker ${index} RSS ${Math.round(kb / 1024)} MB > 500 MB — kontrollierter Neustart (O-83)`);
      worker.process.kill('SIGTERM');
    }
  }
}, PRUEF_MS).unref();

function stoppe(sig) {
  if (beenden) return;
  beenden = true;
  log(`${sig} — beende ${stand.size} Worker`);
  for (const { worker } of stand.values()) worker.process.kill(sig);
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => stoppe('SIGTERM'));
process.on('SIGINT', () => stoppe('SIGINT'));

for (let i = 0; i < ANZAHL; i++) starte(i);
