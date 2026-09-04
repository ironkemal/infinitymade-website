// Schema-Migrations-Runner — Praxura
//
// Warum es das gibt (04.09.2026):
// Der Code kommt per Image in die Kundenbox (Watchtower), das SCHEMA bisher gar nicht.
// Bis heute wurde jede Schemaänderung von Hand auf die Live-DB angewandt. Bei 20 Boxen,
// zu denen wir laut K10 keinen Zugang haben, gibt es diesen Weg nicht.
// Entwurf und Begründung: onprem/SCHEMA-VERTEILUNG.md §4 und §9.
//
// Die fünf Regeln, die hier Gesetz sind:
//   1. Vorwärts. Kein `down`. Der Rückweg ist das Backup (§4.6).
//   2. Eine Datei = eine Transaktion. Kein halb angewandtes File.
//   3. Beim ERSTEN Fehler anhalten. Die Reihenfolge darf nie durcheinandergeraten.
//   4. Niemals `process.exit`. Ein Crash-Loop + Watchtower = eine Box, die alle
//      60 s neu startet und dem Kunden nichts zeigt (Register O-28).
//      Der Aufrufer bekommt ein Ergebnis-Objekt und entscheidet.
//   5. Angewandte Dateien werden NICHT mehr geändert. Die Prüfsumme erzwingt das.
//
// Das Buch ist `praxura_migrations` — unser eigenes, NICHT
// `supabase_migrations.schema_migrations`. Begründung: SCHEMA-VERTEILUNG.md §4.5.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Fester Schlüssel für pg_advisory_lock. Beliebig, aber unveränderlich: ändert man
// ihn, laufen alte und neue Instanz gleichzeitig los. "praxura-migrations" als bigint.
export const LOCK_ID = 7_314_920_115_442_066n;

// Wie lange eine Instanz auf die andere wartet, bevor sie aufgibt. Ohne Timeout
// hängt der Container ewig und der Healthcheck hängt mit (§4.3).
const LOCK_TIMEOUT_MS = 60_000;

const DATEI_MUSTER = /^(\d{4})_([a-z0-9_]+)\.sql$/;

/**
 * Liest das Migrationsverzeichnis und gibt die Dateien in Reihenfolge zurück.
 * Rein — kein DB-Zugriff, deshalb testbar ohne Postgres.
 */
export function migrationenLesen(verzeichnis) {
  let eintraege;
  try {
    eintraege = readdirSync(verzeichnis);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const dateien = [];
  for (const name of eintraege.sort()) {
    if (!name.endsWith('.sql')) continue;

    const treffer = DATEI_MUSTER.exec(name);
    if (!treffer) {
      // Lieber laut scheitern als eine Datei stillschweigend überspringen:
      // eine übersprungene Migration ist ein Schema-Unterschied, den niemand sieht.
      throw new Error(
        `Migrationsdatei mit unerwartetem Namen: "${name}". ` +
        `Erwartet wird NNNN_name_mit_unterstrichen.sql (z. B. 0001_zuzahlung_feld.sql).`
      );
    }

    const sql = readFileSync(join(verzeichnis, name), 'utf8');
    dateien.push({
      version: treffer[1],
      name,
      sql,
      checksum: createHash('sha256').update(sql, 'utf8').digest('hex'),
      // Ausnahme für CREATE INDEX CONCURRENTLY & Co., die in keiner Transaktion
      // laufen können. Solche Dateien MÜSSEN idempotent geschrieben sein (§4.4).
      transaktional: !/^\s*--\s*no-transaction\s*$/m.test(sql)
    });
  }

  return dateien;
}

/**
 * Findet doppelte Versionsnummern. Lücken sind erlaubt (eine Migration kann vor
 * dem Commit verworfen werden), doppelte Nummern nicht — bei ihnen ist die
 * Reihenfolge nicht mehr definiert.
 */
export function pruefeVersionen(dateien) {
  const gesehen = new Map();
  for (const d of dateien) {
    if (gesehen.has(d.version)) {
      return { ok: false, grund: `Version ${d.version} doppelt: ${gesehen.get(d.version)} und ${d.name}` };
    }
    gesehen.set(d.version, d.name);
  }
  return { ok: true };
}

/**
 * Vergleicht Dateien gegen das Buch.
 *
 * Drei Ergebnisse:
 *   offen      — noch nicht angewandt, muss laufen
 *   veraendert — angewandt, aber der Dateiinhalt weicht ab. HALT.
 *   unbekannt  — im Buch steht eine Version, die es als Datei nicht gibt.
 *                Das heisst: die Box lief schon mal mit einem NEUEREN Image.
 *                Ein Downgrade darf das Schema nicht anfassen (§6.3).
 */
export function planErstellen(dateien, buch) {
  const angewandt = new Map(buch.map(z => [z.version, z]));
  const offen = [];
  const veraendert = [];

  for (const d of dateien) {
    const zeile = angewandt.get(d.version);
    if (!zeile) {
      offen.push(d);
    } else if (zeile.checksum !== d.checksum) {
      veraendert.push({ version: d.version, name: d.name, erwartet: zeile.checksum, jetzt: d.checksum });
    }
  }

  const dateiVersionen = new Set(dateien.map(d => d.version));
  const unbekannt = buch.filter(z => !dateiVersionen.has(z.version)).map(z => z.version);

  return { offen, veraendert, unbekannt };
}

const BUCH_DDL = `
CREATE TABLE IF NOT EXISTS praxura_migrations (
  version     text PRIMARY KEY,
  name        text NOT NULL,
  checksum    text NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  app_version text
);
`;

/**
 * Wendet ausstehende Migrationen an.
 *
 * Wirft NICHT. Gibt immer ein Ergebnis zurück:
 *   { status: 'ok' | 'uebersprungen' | 'fehler', angewandt: [...], fehler?: {...} }
 * Der Aufrufer (server.js) entscheidet, was er damit macht — hier wird kein
 * Prozess beendet (Regel 4).
 *
 * @param {object}   opt
 * @param {string}   opt.databaseUrl    Direkte Postgres-Verbindung. FEHLT SIE, wird
 *                                      übersprungen — so ändert sich im SaaS nichts,
 *                                      solange die Variable dort nicht gesetzt ist.
 * @param {string}   opt.verzeichnis    Pfad zu db/migrations
 * @param {string}   [opt.appVersion]   Image-Version, kommt ins Buch
 * @param {function} [opt.log]
 */
export async function runMigrations({ databaseUrl, verzeichnis, appVersion, log = console.log }) {
  if (!databaseUrl) {
    log('[migrate] DATABASE_URL nicht gesetzt — Migrationen werden übersprungen.');
    return { status: 'uebersprungen', grund: 'keine DATABASE_URL', angewandt: [] };
  }

  const dateien = migrationenLesen(verzeichnis);
  if (dateien.length === 0) {
    return { status: 'ok', angewandt: [], hinweis: 'keine Migrationsdateien gefunden' };
  }

  const doppelt = pruefeVersionen(dateien);
  if (!doppelt.ok) {
    return { status: 'fehler', angewandt: [], fehler: { art: 'reihenfolge', text: doppelt.grund } };
  }

  // pg wird absichtlich erst hier geladen: ist DATABASE_URL nicht gesetzt, muss das
  // Paket nicht einmal vorhanden sein. Hält den SaaS-Pfad unverändert.
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: databaseUrl });

  const angewandt = [];
  let gesperrt = false;

  try {
    await client.connect();
    await client.query(`SET lock_timeout = ${LOCK_TIMEOUT_MS}`);

    // Nur einer zieht durch. Der zweite wartet, liest danach das Buch und stellt
    // fest, dass nichts mehr offen ist (§4.3).
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID.toString()]);
    gesperrt = true;

    await client.query(BUCH_DDL);
    const { rows: buch } = await client.query('SELECT version, name, checksum FROM praxura_migrations');

    const plan = planErstellen(dateien, buch);

    if (plan.veraendert.length > 0) {
      const l = plan.veraendert.map(v => `${v.name} (Buch ${v.erwartet.slice(0, 12)}…, Datei ${v.jetzt.slice(0, 12)}…)`);
      return {
        status: 'fehler',
        angewandt: [],
        fehler: {
          art: 'pruefsumme',
          text:
            `Bereits angewandte Migration(en) wurden nachträglich geändert:\n  ${l.join('\n  ')}\n` +
            `Eine angewandte Datei wird nicht mehr bearbeitet — sonst laufen SaaS und Kundenboxen ` +
            `still auseinander. Korrektur: eine NEUE Migrationsdatei schreiben.`
        }
      };
    }

    if (plan.unbekannt.length > 0) {
      // Die Box kennt Versionen, die dieses Image nicht hat: sie lief schon mit einem
      // neueren Stand. Ein älteres Image darf hier nichts "nachziehen".
      return {
        status: 'fehler',
        angewandt: [],
        fehler: {
          art: 'downgrade',
          text:
            `Die Datenbank kennt Migrationen, die dieses Image nicht enthält: ` +
            `${plan.unbekannt.join(', ')}. Dieses Image ist ÄLTER als die Datenbank. ` +
            `Ein Downgrade wird nicht automatisch durchgeführt (SCHEMA-VERTEILUNG.md §6.3).`
        }
      };
    }

    if (plan.offen.length === 0) {
      log('[migrate] Schema ist aktuell — nichts zu tun.');
      return { status: 'ok', angewandt: [] };
    }

    log(`[migrate] ${plan.offen.length} Migration(en) offen.`);

    for (const datei of plan.offen) {
      const start = Date.now();
      try {
        if (datei.transaktional) await client.query('BEGIN');
        await client.query(datei.sql);
        const dauer = Date.now() - start;
        await client.query(
          `INSERT INTO praxura_migrations (version, name, checksum, duration_ms, app_version)
           VALUES ($1, $2, $3, $4, $5)`,
          [datei.version, datei.name, datei.checksum, dauer, appVersion || null]
        );
        if (datei.transaktional) await client.query('COMMIT');

        angewandt.push({ version: datei.version, name: datei.name, dauer_ms: dauer });
        log(`[migrate] ✓ ${datei.name} (${dauer} ms)`);
      } catch (err) {
        if (datei.transaktional) {
          try { await client.query('ROLLBACK'); } catch { /* Verbindung evtl. schon hin */ }
        }
        // Regel 3: hier ist Schluss. Kein "überspringen und weiter".
        return {
          status: 'fehler',
          angewandt,
          fehler: {
            art: 'migration',
            datei: datei.name,
            code: err.code || null,        // Postgres-SQLSTATE, z. B. 42P07
            position: err.position || null,
            text: err.message,
            transaktional: datei.transaktional
          }
        };
      }
    }

    return { status: 'ok', angewandt };
  } catch (err) {
    return {
      status: 'fehler',
      angewandt,
      fehler: { art: 'verbindung', code: err.code || null, text: err.message }
    };
  } finally {
    try {
      if (gesperrt) await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID.toString()]);
    } catch { /* beim Verbindungsabbruch gibt Postgres das Lock ohnehin frei */ }
    try { await client.end(); } catch { /* egal */ }
  }
}
