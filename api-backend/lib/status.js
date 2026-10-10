// O-40 / Faz 2.4b — tiefer Box-Status für GET /api/status (RELEASE-STANDARD §6.5).
//
// Rein: jede Prüfung kommt als Funktion herein (statusSammeln), damit die Logik
// ohne Postgres/Kong testbar ist. Die echten Prüfungen baut standardPruefungen().
//
// Regeln (onprem 11.10.2026, guvenlik S-60):
//  - Status je Feld: ok · warnung · fehler · unbekannt · nicht_implementiert.
//    Nur fehler/warnung färben `gesamt`; unbekannt heißt „hier nicht messbar",
//    nicht „kaputt" (backup/zeit/digest brauchen die Box-Dateien aus O-191).
//  - Nie err.message, Pfad, Host:Port oder Schlüssel-Fingerabdruck in der
//    Antwort — nur ein Code aus FEHLER_CODES. Details gehen ins Log.
//  - db getrennt messen: postgres (direkt) und rest (über Kong/PostgREST).
//    10.10.2026 21:51 war api grün, während Container→db/rest tot war (O-190).

import fs from 'node:fs/promises';
import { rundlaufTest as echterRundlauf } from './phi-encrypt.js';

export const FEHLER_CODES = Object.freeze(['timeout', 'refused', 'http_5xx', 'auth', 'unbekannt']);

const STANDARD_TIMEOUT_MS = 4000;
const DB_GRUEN_MS = 500;
// Disk: §6.5 / §6.6 — ab 85 % belegt Warnung, ab 92 % Fehler.
const DISK_WARN_FREI = 0.15;
const DISK_FEHLER_FREI = 0.08;

export function mitTimeout(promise, ms = STANDARD_TIMEOUT_MS) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms); }),
  ]).finally(() => clearTimeout(t));
}

export function fehlerCode(err) {
  if (!err) return 'unbekannt';
  const code = err.code || err.cause?.code || '';
  if (code === 'ETIMEOUT' || code === 'ETIMEDOUT' || err.name === 'AbortError') return 'timeout';
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'EHOSTUNREACH', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) return 'refused';
  const s = Number(err.status ?? err.statusCode);
  if (s === 401 || s === 403) return 'auth';
  if (s >= 500) return 'http_5xx';
  return 'unbekannt';
}

// Führt eine Prüfung aus, misst die Zeit, wandelt Ausnahmen in {status:'fehler', code}.
// Die Prüfung selbst darf ein Ergebnisobjekt liefern (z. B. warnung + Zahlen).
async function laufen(name, fn, log) {
  const start = Date.now();
  try {
    const erg = (await mitTimeout(Promise.resolve().then(fn))) || {};
    return { status: 'ok', ...erg, ms: Date.now() - start };
  } catch (err) {
    log(`[status] ${name}: ${fehlerCode(err)} — ${err?.message || err}`);
    return { status: 'fehler', code: fehlerCode(err), ms: Date.now() - start };
  }
}

const RANG = { fehler: 3, warnung: 2, ok: 1, unbekannt: 0, nicht_implementiert: 0, info: 0 };

export function gesamtStatus(felder) {
  let max = 'ok';
  for (const f of Object.values(felder)) {
    const s = f?.status;
    if ((RANG[s] ?? 0) > RANG[max]) max = s;
  }
  return max;
}

/**
 * @param {object} p  Prüfungen: { postgres, rest, auth, storage, disk, dataKey, realtime } (async, je optional),
 *                    plus statische Angaben { version, schema }.
 */
export async function statusSammeln(p, { log = console.warn, jetzt = () => new Date() } = {}) {
  const lauf = (name, fn) => (fn ? laufen(name, fn, log) : Promise.resolve({ status: 'unbekannt' }));
  const [postgres, rest, auth, storage, disk, dataKey, realtime] = await Promise.all([
    lauf('postgres', p.postgres), lauf('rest', p.rest), lauf('auth', p.auth),
    lauf('storage', p.storage), lauf('disk', p.disk), lauf('data_key', p.dataKey),
    lauf('realtime', p.realtime),
  ]);

  // postgres liefert nebenbei die Ledger-Höchstnummer und die Größen für die
  // Disk-Regel „frei > 2× (db + storage)" — nicht an den Client weiterreichen.
  const { buchMax = null, belegtBytes = null, ...pgSicht } = postgres;
  if (pgSicht.status === 'ok' && pgSicht.ms > DB_GRUEN_MS) pgSicht.status = 'warnung';

  const db = { status: schlechter(pgSicht.status, rest.status), postgres: pgSicht, rest };

  const schema = schemaBewerten({ ...p.schema, buchMax });
  const diskFeld = diskBewerten(disk, belegtBytes);

  const felder = {
    db,
    schema,
    auth,
    storage,
    disk: diskFeld,
    backup: { status: 'unbekannt' },
    data_key: dataKey,
    license: { status: 'nicht_implementiert' },
    zeit: { status: 'unbekannt' },
    realtime,
    version: { status: 'info', version: p.version?.version || 'dev', digest: null, schema: buchMax },
  };
  return { gesamt: gesamtStatus(felder), gemessen_am: jetzt().toISOString(), felder };
}

function schlechter(a, b) { return (RANG[a] ?? 0) >= (RANG[b] ?? 0) ? a : b; }

export function schemaBewerten({ imageMax = null, buchMax = null, wartung = null, zaehler = null } = {}) {
  const out = { image: imageMax, buch: buchMax, zaehler: zaehler?.status ?? null };
  if (wartung) return { status: 'fehler', code: 'migration', ...out, art: wartung.art ?? null };
  if (!imageMax || !buchMax) return { status: 'unbekannt', ...out };
  if (imageMax !== buchMax) return { status: 'fehler', code: 'abweichung', ...out };
  if (zaehler && zaehler.status && zaehler.status !== 'ok') return { status: 'warnung', code: 'zaehler', ...out };
  return { status: 'ok', ...out };
}

export function diskBewerten(disk, belegtBytes) {
  if (!disk || disk.status !== 'ok' || !disk.gesamtBytes) return disk?.status === 'fehler' ? disk : { status: 'unbekannt' };
  const { freiBytes, gesamtBytes } = disk;
  const anteilFrei = freiBytes / gesamtBytes;
  const out = { frei_prozent: Math.round(anteilFrei * 1000) / 10, frei_bytes: freiBytes, gesamt_bytes: gesamtBytes };
  if (anteilFrei < DISK_FEHLER_FREI) return { status: 'fehler', code: 'voll', ...out };
  if (anteilFrei < DISK_WARN_FREI) return { status: 'warnung', code: 'knapp', ...out };
  if (belegtBytes != null && freiBytes < 2 * belegtBytes) return { status: 'warnung', code: 'kein_platz_fuer_sicherung', ...out };
  return { status: 'ok', ...out };
}

/**
 * Die echten Prüfungen. Nur Box (Route ist auf SaaS 404). Keine neue env:
 * DATABASE_URL, SUPABASE_URL (http://kong:8000), SUPABASE_ANON_KEY, DATA_ENCRYPTION_KEY.
 */
export function standardPruefungen({ supabase, env = process.env, diskPfad = '/var/lib/praxura/ip', rundlaufTest = echterRundlauf }) {
  const kong = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  return {
    postgres: env.DATABASE_URL ? async () => {
      const { default: pg } = await import('pg');
      // query_timeout schützt vor hängendem Socket (statement_timeout nur serverseitig);
      // so erreicht finally() sicher client.end() — keine lecke Verbindung (agy-Prüfung).
      const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 2000, query_timeout: 1500 });
      client.on('error', () => {});
      try {
        await client.connect();
        await client.query('SELECT 1');
        const { rows } = await client.query('SELECT max(version) AS v FROM public.praxura_migrations');
        let belegtBytes = null;
        try {
          const g = await client.query(
            `SELECT pg_database_size(current_database())
                    + coalesce((SELECT sum((metadata->>'size')::bigint) FROM storage.objects), 0) AS b`);
          belegtBytes = Number(g.rows[0].b);
        } catch { /* Größe ist Zusatz, kein Fehler */ }
        return { buchMax: rows[0]?.v ?? null, belegtBytes };
      } finally {
        client.end().catch(() => {});
      }
    } : null,
    rest: async () => {
      const { error } = await supabase.from('profiles').select('id', { head: true, count: 'planned' }).limit(1);
      if (error) throw Object.assign(new Error(error.message), { status: error.status || error.code });
    },
    auth: kong ? async () => {
      const r = await fetch(`${kong}/auth/v1/health`, { headers: { apikey: env.SUPABASE_ANON_KEY || '' }, signal: AbortSignal.timeout(3500) });
      if (!r.ok) throw Object.assign(new Error(`auth ${r.status}`), { status: r.status });
    } : null,
    // Realtime: /api/ping ist die einzige über Kong offene, key-auth-geschützte
    // Route (api/tenants und openapi beendet Kong, kong.yml). Auf der Soak-Box
    // 11.10.2026 gemessen: 200 von Cowboy (= realtime), ohne apikey 401.
    realtime: kong ? async () => {
      const r = await fetch(`${kong}/realtime/v1/api/ping`, { headers: { apikey: env.SUPABASE_ANON_KEY || '' }, signal: AbortSignal.timeout(3500) });
      if (!r.ok) throw Object.assign(new Error(`realtime ${r.status}`), { status: r.status });
    } : null,
    // Nur lesend: ein Schreib-Lösch-Durchlauf pro Minute brächte Reste und
    // keinen Erkenntnisgewinn gegenüber „Storage antwortet mit service_role" (onprem).
    // listBuckets statt eines bestimmten Buckets: unabhängig vom Schema-Stand.
    storage: async () => {
      const { error } = await supabase.storage.listBuckets();
      if (error) throw Object.assign(new Error(error.message), { status: error.status || error.statusCode });
    },
    disk: async () => {
      let s;
      try { s = await fs.statfs(diskPfad); } catch (err) {
        if (err.code === 'ENOENT') return { status: 'unbekannt' };
        throw err;
      }
      return { gesamtBytes: s.blocks * s.bsize, freiBytes: s.bavail * s.bsize };
    },
    dataKey: async () => {
      if (!env.DATA_ENCRYPTION_KEY) return { status: 'fehler', code: 'fehlt', rundlauf: false, vergleich: 'unbekannt' };
      const r = rundlaufTest();
      return r.ok
        ? { rundlauf: true, vergleich: 'unbekannt' }
        : { status: 'fehler', code: 'rundlauf', rundlauf: false, vergleich: 'unbekannt' };
    },
  };
}
