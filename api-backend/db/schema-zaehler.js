// RELEASE-STANDARD.md §5.4/1 — "10 Zaehler" (Faz 2.2 dilim 2b).
//
// Zaehlt strukturelle DB-Objekte und vergleicht sie gegen erwartete-zaehler.json.
// Laeuft NUR in migrate.js, auf der bereits offenen `pg`-Verbindung, direkt nach
// den Migrationen und VOR dem advisory-unlock (onprem-Konsultation 12.09.2026):
// der Router (PostgREST/service_role) kann pg_catalog/auth/storage.buckets/
// pg_publication_tables gar nicht sehen, migrate.js schon.
//
// Zaehlt STRUKTUR, keine Daten — Zeilenzahlen einzelner Tabellen gehoeren in die
// jeweilige Seed-Migration (Beispiel: icd10_titles, 0013), nicht hierher.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SORGULAR = {
  public_tablo: `SELECT count(*)::int AS n FROM information_schema.tables
                 WHERE table_schema='public' AND table_type='BASE TABLE'`,
  rls_policy: `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public'`,
  fonksiyon: `SELECT count(*)::int AS n FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
              AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`,
  trigger: `SELECT count(*)::int AS n FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND NOT t.tgisinternal`,
  index: `SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public'`,
  rls_kapali_tablo: `SELECT count(*)::int AS n FROM pg_tables t
                     JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = t.schemaname::regnamespace
                     WHERE t.schemaname='public' AND NOT c.relrowsecurity`,
  auth_trigger: `SELECT count(*)::int AS n FROM pg_trigger t
                 JOIN pg_class c ON c.oid = t.tgrelid
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'auth' AND NOT t.tgisinternal`,
  storage_bucket: `SELECT count(*)::int AS n FROM storage.buckets`,
  publication_uye_tablo: `SELECT count(*)::int AS n FROM pg_publication_tables`,
  extension: `SELECT count(*)::int AS n FROM pg_extension`,
};

/**
 * Liest erwartete-zaehler.json. Rein, kein DB-Zugriff — testbar ohne Postgres.
 */
export function erwarteteZaehlerLesen(verzeichnis) {
  const pfad = join(verzeichnis, 'erwartete-zaehler.json');
  return JSON.parse(readFileSync(pfad, 'utf8'));
}

/**
 * Fuehrt alle Zaehl-Abfragen auf der uebergebenen (bereits verbundenen) `pg`-Client
 * aus und vergleicht gegen die erwarteten Werte.
 *
 * @param {import('pg').Client} client
 * @param {object} erwartet   Rueckgabe von erwarteteZaehlerLesen()
 * @param {string} [aktuelleVersion]  hoechste angewandte Migrationsversion (Buch) —
 *                                    ist sie NEUER als erwartet.bis_version, ist die
 *                                    Erwartung veraltet, nicht die Box: Ergebnis "grau"
 *                                    statt rot (onprem-Konsultation, Punkt (b)).
 */
export async function zaehlerPruefen(client, erwartet, aktuelleVersion) {
  const gemessen = {};
  for (const [name, sql] of Object.entries(SORGULAR)) {
    const { rows } = await client.query(sql);
    gemessen[name] = rows[0].n;
  }

  const erwartungVeraltet = !!aktuelleVersion && aktuelleVersion > erwartet.bis_version;

  const abweichungen = [];
  for (const name of Object.keys(SORGULAR)) {
    const soll = erwartet.zaehler[name];
    const ist = gemessen[name];
    if (soll !== ist) abweichungen.push({ name, soll, ist });
  }

  return {
    status: abweichungen.length === 0 ? 'ok' : (erwartungVeraltet ? 'veraltet' : 'abweichung'),
    gemessen,
    abweichungen,
    bis_version: erwartet.bis_version,
    aktuelleVersion: aktuelleVersion || null,
  };
}
