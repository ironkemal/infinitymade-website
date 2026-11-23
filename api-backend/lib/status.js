// O-40 / Faz 2.4b — tiefer Box-Status für GET /api/status (RELEASE-STANDARD §6.5).
//
// Rein: jede Prüfung kommt als Funktion herein (statusSammeln), damit die Logik
// ohne Postgres/Kong testbar ist. Die echten Prüfungen baut standardPruefungen().
//
// Regeln (onprem 11.10.2026, guvenlik S-60):
//  - Status je Feld: ok · warnung · fehler · unbekannt · nicht_implementiert.
//    Nur fehler/warnung färben `gesamt`; unbekannt heißt „hier nicht messbar",
//    nicht „kaputt" (backup/zeit/digest lesen die Host-Dateien aus O-191;
//    fehlt das Verzeichnis — altes compose —, bleiben sie unbekannt).
//  - Nie err.message, Pfad, Host:Port oder Schlüssel-Fingerabdruck in der
//    Antwort — nur ein Code aus FEHLER_CODES. Details gehen ins Log.
//  - db getrennt messen: postgres (direkt) und rest (über Kong/PostgREST).
//    10.10.2026 21:51 war api grün, während Container→db/rest tot war (O-190).

import fs from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { rundlaufTest as echterRundlauf, keyFingerprint as echterFingerprint } from './phi-encrypt.js';

export const FEHLER_CODES = Object.freeze(['timeout', 'refused', 'http_5xx', 'auth', 'unbekannt']);

const STANDARD_TIMEOUT_MS = 4000;
const DB_GRUEN_MS = 500;
// Disk: §6.5 / §6.6 — ab 85 % belegt Warnung, ab 92 % Fehler.
const DISK_WARN_FREI = 0.15;
const DISK_FEHLER_FREI = 0.08;
// O-191 — Host-Zustandsdateien (./volumes/status → /var/lib/praxura/status:ro).
const DATEI_MAX_BYTES = 8192;
const BACKUP_MAX_STUNDEN = 36;          // §6.5: letzte erfolgreiche Sicherung < 36 h
const ZEIT_FRISCH_MS = 10 * 60 * 1000;  // Host-Timer läuft alle 2 Min; älter = Timer tot
const ZUKUNFT_TOLERANZ_MS = 5 * 60 * 1000;
const SEBEP = ['nightly', 'vor-migration', 'manuel'];
const RE_FP = /^[0-9a-f]{16}$/;
const RE_DIGEST = /^sha256:[0-9a-f]{64}$/;

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} [ms]
 * @returns {Promise<T>}
 */
export function mitTimeout(promise, ms = STANDARD_TIMEOUT_MS) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms); }),
  ]).finally(() => clearTimeout(t));
}

/** @param {unknown} err */
export function fehlerCode(err) {
  if (!err || typeof err !== 'object') return 'unbekannt';
  const e = /** @type {{ code?: unknown, cause?: { code?: unknown }, name?: unknown, status?: unknown, statusCode?: unknown }} */ (err);
  const code = String(e.code || e.cause?.code || '');
  if (code === 'ETIMEOUT' || code === 'ETIMEDOUT' || e.name === 'AbortError') return 'timeout';
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'EHOSTUNREACH', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) return 'refused';
  const s = Number(e.status ?? e.statusCode);
  if (s === 401 || s === 403) return 'auth';
  if (s >= 500) return 'http_5xx';
  return 'unbekannt';
}

// Führt eine Prüfung aus, misst die Zeit, wandelt Ausnahmen in {status:'fehler', code}.
// Die Prüfung selbst darf ein Ergebnisobjekt liefern (z. B. warnung + Zahlen).
/**
 * @param {string} name
 * @param {() => unknown} fn
 * @param {(msg: string) => void} log
 * @returns {Promise<Record<string, any>>}
 */
async function laufen(name, fn, log) {
  const start = Date.now();
  try {
    const erg = /** @type {Record<string, unknown> | null | undefined} */ (await mitTimeout(Promise.resolve().then(fn))) || {};
    return { status: 'ok', ...erg, ms: Date.now() - start };
  } catch (err) {
    log(`[status] ${name}: ${fehlerCode(err)} — ${err instanceof Error ? err.message : String(err)}`);
    return { status: 'fehler', code: fehlerCode(err), ms: Date.now() - start };
  }
}

/** @type {Record<string, number>} */
const RANG = { fehler: 3, warnung: 2, ok: 1, unbekannt: 0, nicht_implementiert: 0, info: 0 };

/** @param {Record<string, { status?: string } | null | undefined>} felder */
export function gesamtStatus(felder) {
  let max = 'ok';
  for (const f of Object.values(felder)) {
    const s = f?.status;
    if (s && (RANG[s] ?? 0) > RANG[max]) max = s;
  }
  return max;
}

/**
 * @typedef {{
 *   postgres?: (() => unknown) | null,
 *   rest?: (() => unknown) | null,
 *   auth?: (() => unknown) | null,
 *   storage?: (() => unknown) | null,
 *   disk?: (() => unknown) | null,
 *   dataKey?: (() => unknown) | null,
 *   realtime?: (() => unknown) | null,
 *   dateien?: (() => Promise<{ verzeichnis: boolean, sicherung?: unknown, stand?: unknown, zeit?: unknown, zertifikat?: unknown }>) | null,
 *   schema?: { imageMax?: string | null, wartung?: { art?: string | null } | null, zaehler?: { status?: string | null } | null },
 *   version?: { version?: string | null },
 *   eigenerFingerprint?: (() => string | null) | null,
 * }} StatusPruefungen
 */

/**
 * @param {StatusPruefungen} p  Prüfungen: { postgres, rest, auth, storage, disk, dataKey, realtime } (async, je optional),
 *                    plus statische Angaben { version, schema }.
 * @param {{ log?: (msg: string) => void, jetzt?: () => Date }} [opts]
 */
export async function statusSammeln(p, { log = console.warn, jetzt = () => new Date() } = {}) {
  /** @type {(name: string, fn: (() => unknown) | null | undefined) => Promise<Record<string, any>>} */
  const lauf = (name, fn) => (fn ? laufen(name, fn, log) : Promise.resolve({ status: 'unbekannt' }));
  const [postgres, rest, auth, storage, disk, dataKey, realtime, dateien] = await Promise.all([
    lauf('postgres', p.postgres), lauf('rest', p.rest), lauf('auth', p.auth),
    lauf('storage', p.storage), lauf('disk', p.disk), lauf('data_key', p.dataKey),
    lauf('realtime', p.realtime),
    // Host-Dateien (O-191): jeder Lesefehler heißt „nicht messbar", nie „kaputt".
    Promise.resolve().then(() => (p.dateien ? mitTimeout(p.dateien()) : null))
      .catch((err) => { log(`[status] dateien: ${err instanceof Error ? err.message : String(err)}`); return null; }),
  ]);
  const jetztMs = jetzt().getTime();
  const d = dateien || { verzeichnis: false };

  // postgres liefert nebenbei die Ledger-Höchstnummer und die Größen für die
  // Disk-Regel „frei > 2× (db + storage)" — nicht an den Client weiterreichen.
  const { buchMax = null, belegtBytes = null, restoreReste = [], ...pgSicht } = postgres;
  if (pgSicht.status === 'ok' && pgSicht.ms > DB_GRUEN_MS) pgSicht.status = 'warnung';

  const db = { status: schlechter(pgSicht.status, rest.status), postgres: pgSicht, rest };

  const schema = schemaBewerten({ ...p.schema, buchMax });
  const diskFeld = diskBewerten(disk, belegtBytes);

  const felder = {
    db,
    schema,
    auth,
    storage,
    disk: restoreResteAnhaengen(diskFeld, restoreReste),
    zertifikat: zertifikatBewerten(d.zertifikat, { verzeichnis: !!d.verzeichnis, jetztMs }),
    backup: backupBewerten(d.sicherung, { verzeichnis: !!d.verzeichnis, jetztMs }),
    data_key: dataKeyVergleichen(dataKey, d.sicherung, p.eigenerFingerprint),
    license: { status: 'nicht_implementiert' },
    zeit: zeitBewerten(d.zeit, jetztMs),
    realtime,
    version: { status: 'info', version: p.version?.version || 'dev', digest: digestAus(d.stand), schema: buchMax },
  };
  return { gesamt: gesamtStatus(felder), gemessen_am: jetzt().toISOString(), felder };
}

/**
 * @param {string} a
 * @param {string} b
 */
function schlechter(a, b) { return (RANG[a] ?? 0) >= (RANG[b] ?? 0) ? a : b; }

/**
 * @param {{
 *   imageMax?: string | null,
 *   buchMax?: string | null,
 *   wartung?: { art?: string | null } | null,
 *   zaehler?: { status?: string | null } | null,
 * }} [opts]
 */
export function schemaBewerten({ imageMax = null, buchMax = null, wartung = null, zaehler = null } = {}) {
  const out = { image: imageMax, buch: buchMax, zaehler: zaehler?.status ?? null };
  if (wartung) return { status: 'fehler', code: 'migration', ...out, art: wartung.art ?? null };
  if (!imageMax || !buchMax) return { status: 'unbekannt', ...out };
  if (imageMax !== buchMax) return { status: 'fehler', code: 'abweichung', ...out };
  if (zaehler && zaehler.status && zaehler.status !== 'ok') return { status: 'warnung', code: 'zaehler', ...out };
  return { status: 'ok', ...out };
}

/**
 * @param {{ status?: string, gesamtBytes?: number, freiBytes?: number } | null | undefined} disk
 * @param {number | null | undefined} belegtBytes
 */
export function diskBewerten(disk, belegtBytes) {
  if (!disk || disk.status !== 'ok' || !disk.gesamtBytes) return disk?.status === 'fehler' ? disk : { status: 'unbekannt' };
  const freiBytes = disk.freiBytes ?? 0;
  const { gesamtBytes } = disk;
  const anteilFrei = freiBytes / gesamtBytes;
  const out = { frei_prozent: Math.round(anteilFrei * 1000) / 10, frei_bytes: freiBytes, gesamt_bytes: gesamtBytes };
  if (anteilFrei < DISK_FEHLER_FREI) return { status: 'fehler', code: 'voll', ...out };
  if (anteilFrei < DISK_WARN_FREI) return { status: 'warnung', code: 'knapp', ...out };
  if (belegtBytes != null && freiBytes < 2 * belegtBytes) return { status: 'warnung', code: 'kein_platz_fuer_sicherung', ...out };
  return { status: 'ok', ...out };
}

/**
 * @param {unknown} n
 * @returns {n is number}
 */
const istEpoch = (n) => Number.isSafeInteger(n) && /** @type {number} */ (n) > 0;
/**
 * @param {unknown} o
 * @returns {o is Record<string, unknown> & { v: 1 }}
 */
const istV1 = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && /** @type {{ v?: unknown }} */ (o).v === 1;

/**
 * backup (§6.5/§6.6). Verzeichnis fehlt → unbekannt (altes compose + neues Image, J7).
 * Verzeichnis da, aber keine Sicherungsdatei → warnung `keine`: eine Box, die nie
 * gesichert hat, darf `gesamt` nicht grün lassen (praxura-backup.timer ist bis zur
 * Schlüsselbestätigung aus). Das Alter rechnet DIESER Prozess aus dem Epoch —
 * nie einem Feld „alter" aus der Datei glauben (guvenlik B3).
 *
 * @param {unknown} roh
 * @param {{ verzeichnis?: boolean, jetztMs?: number }} [opts]
 */
export function backupBewerten(roh, { verzeichnis = false, jetztMs = Date.now() } = {}) {
  if (!verzeichnis) return { status: 'unbekannt' };
  if (roh === undefined) return { status: 'warnung', code: 'keine' };
  if (!istV1(roh) || !istEpoch(roh.letzte_ok_epoch)) return { status: 'unbekannt' };
  const ms = roh.letzte_ok_epoch * 1000;
  if (ms - jetztMs > ZUKUNFT_TOLERANZ_MS) return { status: 'unbekannt' };
  const alter = Math.max(0, Math.round(((jetztMs - ms) / 3_600_000) * 10) / 10);
  const ausserhalb = typeof roh.ziel_ausserhalb === 'boolean' ? roh.ziel_ausserhalb : null;
  const out = {
    letzte_ok: new Date(ms).toISOString(),
    alter_stunden: alter,
    anlass: typeof roh.sebep === 'string' && SEBEP.includes(roh.sebep) ? roh.sebep : null,
    ziel_ausserhalb: ausserhalb,
  };
  if (alter > BACKUP_MAX_STUNDEN) return { status: 'fehler', code: 'alt', ...out };
  // Lokales Ziel ist nie grün (§6.6, O-154): Sicherung stirbt mit der Platte.
  if (ausserhalb === false) return { status: 'warnung', code: 'lokal', ...out };
  return { status: 'ok', ...out };
}

/**
 * zeit: Container teilt die Host-Uhr, „Abweichung < 60 s" ist von hier nicht
 * messbar — bewertet wird das NTPSynchronized-Flag des Hosts. null (kein
 * timedatectl, z. B. WSL) und veraltete Datei (Timer tot) = unbekannt.
 *
 * @param {unknown} roh
 * @param {number} [jetztMs]
 */
export function zeitBewerten(roh, jetztMs = Date.now()) {
  if (!istV1(roh) || !istEpoch(roh.gemessen_epoch)) return { status: 'unbekannt' };
  const ms = roh.gemessen_epoch * 1000;
  if (ms - jetztMs > ZUKUNFT_TOLERANZ_MS || jetztMs - ms > ZEIT_FRISCH_MS) return { status: 'unbekannt' };
  if (roh.ntp_synchron === true) return { status: 'ok' };
  if (roh.ntp_synchron === false) return { status: 'warnung', code: 'ntp' };
  return { status: 'unbekannt' };
}

/**
 * data_key.vergleich: laufender Schlüssel gegen den der Sicherung. Zwei Felder:
 * `data_key_fingerprint` (letzte Sicherung) und `data_key_fingerprint_erst`
 * (erste je gesehene) — backup.sh rechnet den Abdruck jede Nacht aus dem dann
 * gültigen Schlüssel, ohne `_erst` würde eine Abweichung nach 24 h von selbst
 * verschwinden (onprem 11.10.2026). null in der Künye (api war aus) = unbekannt,
 * nicht Abweichung. Der Abdruck selbst geht NIE in die Antwort (S-60 f).
 *
 * @param {({ status?: string } & Record<string, unknown>) | null | undefined} feld
 * @param {unknown} sicherung
 * @param {(() => string | null) | null | undefined} [eigenerFingerprint]
 */
export function dataKeyVergleichen(feld, sicherung, eigenerFingerprint) {
  const basis = { ...feld };
  let eigen = null;
  try { eigen = eigenerFingerprint ? eigenerFingerprint() : null; } catch { eigen = null; }
  const kandidaten = istV1(sicherung)
    ? [sicherung.data_key_fingerprint, sicherung.data_key_fingerprint_erst].filter((x) => typeof x === 'string' && RE_FP.test(x))
    : [];
  if (!eigen || !RE_FP.test(eigen) || !kandidaten.length) return { ...basis, vergleich: 'unbekannt' };
  if (kandidaten.every((x) => x === eigen)) return { ...basis, vergleich: 'gleich' };
  return basis.status === 'fehler'
    ? { ...basis, vergleich: 'abweichung' }
    : { ...basis, status: 'fehler', code: 'schluessel_abweichung', vergleich: 'abweichung' };
}

/** @param {unknown} stand */
export function digestAus(stand) {
  return istV1(stand) && typeof stand.api_digest === 'string' && RE_DIGEST.test(stand.api_digest) ? stand.api_digest : null;
}

const ZERT_FRISCH_MS = 48 * 3600 * 1000;
/**
 * Zertifikat (O-172 ii, Box-Test 22.11.2026): update.sh misst nachts per s_client gegen 127.0.0.1
 * und schreibt zertifikat.json {v:1, art:'le'|'lokale_ca', not_after_epoch, gemessen_epoch}.
 * le: > 21 Tage ok, darunter warnung, abgelaufen fehler. lokale_ca (Zwischen-CA, erneuert sich
 * nicht selbst): Warnung ab 90 Tagen. Älter als 48 h oder fehlend → unbekannt / info.
 * @param {unknown} roh @param {{ verzeichnis?: boolean, jetztMs?: number }} [o]
 */
export function zertifikatBewerten(roh, { verzeichnis = false, jetztMs = Date.now() } = {}) {
  if (!verzeichnis) return { status: 'unbekannt' };
  if (roh === undefined) return { status: 'info', code: 'nicht_ueberwacht' };
  const z = /** @type {any} */ (roh);
  if (!istV1(z) || !istEpoch(z.gemessen_epoch) || !['le', 'lokale_ca'].includes(String(z.art))) return { status: 'unbekannt' };
  if (jetztMs - z.gemessen_epoch * 1000 > ZERT_FRISCH_MS) return { status: 'unbekannt', code: 'alt', art: z.art };
  if (!istEpoch(z.not_after_epoch)) return { status: 'unbekannt', art: z.art };
  const ms = z.not_after_epoch * 1000;
  const tage = Math.floor((ms - jetztMs) / 86400000);
  const out = { art: z.art, gueltig_bis: new Date(ms).toISOString(), tage_rest: tage, code: z.art === 'lokale_ca' ? 'intern' : undefined };
  if (tage < 0) return { status: 'fehler', ...out };
  if (tage < (z.art === 'lokale_ca' ? 90 : 21)) return { status: 'warnung', ...out };
  return { status: 'ok', ...out };
}

/**
 * Restore-Reste an das Disk-Feld hängen: info; warnung nur, wenn der Platz selbst knapp ist.
 * @param {any} disk @param {Array<{name:string, bytes:number}>} reste
 */
export function restoreResteAnhaengen(disk, reste) {
  if (!Array.isArray(reste) || !reste.length) return disk;
  return { ...disk, restore_reste: reste.slice(0, 10) };
}

/**
 * Liest die drei Host-Zustandsdateien. Feste Namen, kein Verzeichnis-Listing.
 * O_NOFOLLOW + fstat auf dem Deskriptor (guvenlik B1): ein Symlink auf
 * /proc/self/environ oder ein FIFO darf weder gelesen werden noch blockieren.
 * Rückgabe je Datei: Objekt · null (da, aber unlesbar/kaputt) · undefined (fehlt).
 *
 * @param {string} verzeichnis
 */
export async function statusDateienLesen(verzeichnis) {
  try {
    if (!(await fs.stat(verzeichnis)).isDirectory()) return { verzeichnis: false };
  } catch { return { verzeichnis: false }; }
  /** @param {string} name */
  const eine = async (name) => {
    let fh;
    try {
      fh = await fs.open(`${verzeichnis}/${name}`, FS.O_RDONLY | (FS.O_NOFOLLOW || 0) | (FS.O_NONBLOCK || 0));
      const st = await fh.stat();
      if (!st.isFile() || st.size > DATEI_MAX_BYTES) return null;
      const buf = Buffer.alloc(DATEI_MAX_BYTES);
      const { bytesRead } = await fh.read(buf, 0, DATEI_MAX_BYTES, 0);
      const o = JSON.parse(buf.subarray(0, bytesRead).toString('utf8'));
      return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
    } catch (err) {
      return /** @type {{ code?: unknown } | null} */ (err)?.code === 'ENOENT' ? undefined : null;
    } finally {
      await fh?.close().catch(() => {});
    }
  };
  const [sicherung, stand, zeit, zertifikat] = await Promise.all([eine('sicherung.json'), eine('stand.json'), eine('zeit.json'), eine('zertifikat.json')]);
  return { verzeichnis: true, sicherung, stand, zeit, zertifikat };
}

/**
 * Die echten Prüfungen. Nur Box (Route ist auf SaaS 404). Keine neue env:
 * DATABASE_URL, SUPABASE_URL (http://kong:8000), SUPABASE_ANON_KEY, DATA_ENCRYPTION_KEY.
 *
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient,
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   diskPfad?: string,
 *   statusPfad?: string,
 *   rundlaufTest?: typeof echterRundlauf,
 *   fingerprint?: typeof echterFingerprint,
 * }} opts
 */
export function standardPruefungen({ supabase, env = process.env, diskPfad = '/var/lib/praxura/ip', statusPfad = '/var/lib/praxura/status', rundlaufTest = echterRundlauf, fingerprint = echterFingerprint }) {
  const kong = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  return {
    dateien: () => statusDateienLesen(statusPfad),
    eigenerFingerprint: fingerprint,
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
        // Box-Test 22.11.2026: restore.sh lässt die alte DB als <db>_onceki_<zeit> liegen (restore.sh, ${DB_NAME}).
        // Nur Name + Größe anzeigen, Löschen nur per Anleitung (onprem 23.11.2026). Eigenes try: Zusatz.
        /** @type {Array<{name: string, bytes: number}>} */
        let restoreReste = [];
        try {
          const r = await client.query(
            `SELECT datname AS name, pg_database_size(datname) AS bytes FROM pg_database
              WHERE datname LIKE current_database() || '\\_onceki\\_%' ORDER BY datname LIMIT 10`);
          restoreReste = r.rows.map((/** @type {any} */ z) => ({ name: String(z.name), bytes: Number(z.bytes) }));
        } catch { /* CONNECT-Recht fehlt o. ä. — kein Fehler */ }
        return { buchMax: rows[0]?.v ?? null, belegtBytes, restoreReste };
      } finally {
        client.end().catch(() => {});
      }
    } : null,
    rest: async () => {
      const { error } = await supabase.from('profiles').select('id', { head: true, count: 'planned' }).limit(1);
      if (error) {
        const pgErr = /** @type {{ message: string, status?: number, code?: string }} */ (error);
        throw Object.assign(new Error(pgErr.message), { status: pgErr.status || pgErr.code });
      }
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
      if (error) {
        const stErr = /** @type {{ message: string, status?: number, statusCode?: string | number }} */ (error);
        throw Object.assign(new Error(stErr.message), { status: stErr.status || stErr.statusCode });
      }
    },
    disk: async () => {
      let s;
      try { s = await fs.statfs(diskPfad); } catch (err) {
        if (/** @type {{ code?: unknown } | null} */ (err)?.code === 'ENOENT') return { status: 'unbekannt' };
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
