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
  const [postgres, rest, auth, storage, disk, dataKey, realtime, dateien] = await Promise.all([
    lauf('postgres', p.postgres), lauf('rest', p.rest), lauf('auth', p.auth),
    lauf('storage', p.storage), lauf('disk', p.disk), lauf('data_key', p.dataKey),
    lauf('realtime', p.realtime),
    // Host-Dateien (O-191): jeder Lesefehler heißt „nicht messbar", nie „kaputt".
    Promise.resolve().then(() => (p.dateien ? mitTimeout(p.dateien()) : null))
      .catch((err) => { log(`[status] dateien: ${err?.message || err}`); return null; }),
  ]);
  const jetztMs = jetzt().getTime();
  const d = dateien || { verzeichnis: false };

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
    backup: backupBewerten(d.sicherung, { verzeichnis: !!d.verzeichnis, jetztMs }),
    data_key: dataKeyVergleichen(dataKey, d.sicherung, p.eigenerFingerprint),
    license: { status: 'nicht_implementiert' },
    zeit: zeitBewerten(d.zeit, jetztMs),
    realtime,
    version: { status: 'info', version: p.version?.version || 'dev', digest: digestAus(d.stand), schema: buchMax },
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

const istEpoch = (n) => Number.isSafeInteger(n) && n > 0;
const istV1 = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && o.v === 1;

/**
 * backup (§6.5/§6.6). Verzeichnis fehlt → unbekannt (altes compose + neues Image, J7).
 * Verzeichnis da, aber keine Sicherungsdatei → warnung `keine`: eine Box, die nie
 * gesichert hat, darf `gesamt` nicht grün lassen (praxura-backup.timer ist bis zur
 * Schlüsselbestätigung aus). Das Alter rechnet DIESER Prozess aus dem Epoch —
 * nie einem Feld „alter" aus der Datei glauben (guvenlik B3).
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
    anlass: SEBEP.includes(roh.sebep) ? roh.sebep : null,
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

export function digestAus(stand) {
  return istV1(stand) && typeof stand.api_digest === 'string' && RE_DIGEST.test(stand.api_digest) ? stand.api_digest : null;
}

/**
 * Liest die drei Host-Zustandsdateien. Feste Namen, kein Verzeichnis-Listing.
 * O_NOFOLLOW + fstat auf dem Deskriptor (guvenlik B1): ein Symlink auf
 * /proc/self/environ oder ein FIFO darf weder gelesen werden noch blockieren.
 * Rückgabe je Datei: Objekt · null (da, aber unlesbar/kaputt) · undefined (fehlt).
 */
export async function statusDateienLesen(verzeichnis) {
  try {
    if (!(await fs.stat(verzeichnis)).isDirectory()) return { verzeichnis: false };
  } catch { return { verzeichnis: false }; }
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
      return err?.code === 'ENOENT' ? undefined : null;
    } finally {
      await fh?.close().catch(() => {});
    }
  };
  const [sicherung, stand, zeit] = await Promise.all([eine('sicherung.json'), eine('stand.json'), eine('zeit.json')]);
  return { verzeichnis: true, sicherung, stand, zeit };
}

/**
 * Die echten Prüfungen. Nur Box (Route ist auf SaaS 404). Keine neue env:
 * DATABASE_URL, SUPABASE_URL (http://kong:8000), SUPABASE_ANON_KEY, DATA_ENCRYPTION_KEY.
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
