// ============================================================================
// tools/schema-dokumente.test.js
// Test Suite for PostgreSQL 17 Catalog Snapshot SQL & Document Renderer
//
// RUN:
//   node --test tools/schema-dokumente.test.js
// ============================================================================

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { renderSchemaDokumente, escapeSqlLiteral, formatIdent, formatQualifiedName } from './schema-dokumente.mjs';

// ============================================================================
// 1. QUERY SOURCE SAFETY & STRUCTURAL AUDIT (tools/schema-export-katalog.sql)
// ============================================================================
describe('schema-export-katalog.sql Source Safety & Catalog Compliance', () => {
  const sqlPath = join(process.cwd(), 'tools/schema-export-katalog.sql');
  const sqlContent = readFileSync(sqlPath, 'utf8');

  // Strip comments, but keep SQL structure and literal contents intact
  const sqlWithoutComments = sqlContent
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip comments AND string literals for DDL/relation target checks
  const cleanSqlNoStrings = sqlWithoutComments
    .replace(/'(?:''|[^'])*'/g, "''");

  it('file exists and contains content', () => {
    assert.ok(sqlContent.length > 500, 'SQL file must not be empty');
  });

  it('is a single top-level SELECT statement (WITH CTEs allowed)', () => {
    const trimmed = cleanSqlNoStrings.trim();
    assert.ok(
      trimmed.startsWith('WITH') || trimmed.startsWith('SELECT'),
      'Must start with WITH or SELECT'
    );
    assert.ok(
      /SELECT\s+json_build_object\([\s\S]+?\)\s+AS\s+katalog;/i.test(trimmed),
      'Must output single top-level JSON object column AS katalog'
    );

    const statements = trimmed.split(/;\s*$/m).filter(s => s.trim().length > 0);
    assert.equal(statements.length, 1, 'Must be exactly one top-level SQL query');
  });

  it('contains NO DDL or data modification statements outside comments or strings', () => {
    const forbidden = [
      /\bCREATE\s+(TABLE|VIEW|INDEX|FUNCTION|TRIGGER|DATABASE|SCHEMA|ROLE|USER)\b/i,
      /\bDROP\s+(TABLE|VIEW|INDEX|FUNCTION|TRIGGER|DATABASE|SCHEMA)\b/i,
      /\bALTER\s+(TABLE|VIEW|INDEX|FUNCTION|TRIGGER|DATABASE|SCHEMA)\b/i,
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+[a-zA-Z0-9_.]+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\s+/i,
    ];

    for (const pattern of forbidden) {
      assert.ok(
        !pattern.test(cleanSqlNoStrings),
        `Query must not contain DDL or writes: ${pattern.toString()}`
      );
    }
  });

  it('reads NO application row data, NO storage.buckets rows, NO sequence application state', () => {
    // Assert clean SQL has no storage.buckets relation query
    assert.ok(
      !/\bstorage\.buckets\b/i.test(cleanSqlNoStrings),
      'Must NOT query storage.buckets relation for rows'
    );

    // Assert clean SQL has no sequence application state queries
    assert.ok(
      !/\blast_value\b/i.test(cleanSqlNoStrings),
      'Must NOT query pg_sequences.last_value or sequence application state'
    );
    assert.ok(
      !/\bis_called\b/i.test(cleanSqlNoStrings),
      'Must NOT query is_called sequence application state'
    );
  });

  it('filters out aggregates and window functions from pg_get_functiondef calls', () => {
    assert.ok(
      /p\.prokind\s+NOT\s+IN\s*\(\s*'a'\s*,\s*'w'\s*\)/i.test(sqlWithoutComments) ||
      (/prokind\s*!=\s*'a'/i.test(sqlWithoutComments) && /prokind\s*!=\s*'w'/i.test(sqlWithoutComments)),
      'pg_proc query must filter out aggregates and window functions before pg_get_functiondef'
    );
  });

  it('queries only pg_catalog, information_schema metadata, CTEs, or catalog built-in functions', () => {
    // Extract FROM and JOIN relation targets (skipping LATERAL keyword)
    const fromMatches = [...cleanSqlNoStrings.matchAll(/\bFROM\s+(?:LATERAL\s+)?([a-zA-Z0-9_.]+)/gi)].map(m => m[1].toLowerCase());
    const joinMatches = [...cleanSqlNoStrings.matchAll(/\bJOIN\s+(?:LATERAL\s+)?([a-zA-Z0-9_.]+)/gi)].map(m => m[1].toLowerCase());
    const allSources = [...fromMatches, ...joinMatches];

    const allowedPrefixes = [
      'pg_',
      'information_schema.',
      'extension_deps',
      'meta',
      'ext_inventory',
      'enum_types',
      'domain_types',
      'composite_types',
      'other_custom_types',
      'sequences_cte',
      'columns_cte',
      'table_constraints_cte',
      'tables_cte',
      'views_cte',
      'matviews_cte',
      'functions_cte',
      'aggregates_cte',
      'window_funcs_cte',
      'policies_cte',
      'triggers_cte',
      'indexes_cte',
      'acls_cte',
      'default_acls_cte',
      'publications_cte',
      'auth_triggers_cte',
      'storage_policies_cte',
      'rlsoff_tables_cte',
      'counts_cte',
      'unnest', // PostgreSQL catalog set-returning function
      'aclexplode', // PostgreSQL catalog set-returning function
    ];

    for (const src of allSources) {
      if (src === 'lateral') continue;
      const isAllowed = allowedPrefixes.some(p => src === p || src.startsWith(p));
      assert.ok(
        isAllowed,
        `Unexpected data source in query: "${src}". Only pg_catalog, information_schema, catalog builtins, and CTEs are permitted.`
      );
    }
  });

  it('explains in header comments that migration ledger and exported_at are supplied externally', () => {
    assert.ok(
      /supplied externally/i.test(sqlContent) || /external/i.test(sqlContent),
      'Header comments must clarify that exported_at and migration ledger are externally supplied'
    );
  });
});

// ============================================================================
// 2. SYNTHETIC FIXTURE BUILDER
// ============================================================================
function createComprehensiveSyntheticFixture() {
  return {
    metadata: {
      exported_at: '2026-10-03T18:30:00Z',
      last_migration: '0195_add_payments.sql',
      environment: 'saas',
    },
    schema_format: 'praxura-catalog-v1',
    postgresql_version: 'PostgreSQL 17.0 (Debian 17.0-1)',
    postgresql_version_num: 170000,
    counts: {
      public_tables: 5,
      table_columns: 16,
      view_columns: 2,
      matview_columns: 2,
      rls_policies: 2,
      functions: 3,
      triggers: 4,
      indexes: 4,
      auth_triggers: 1,
      publication_tables: 2,
      extensions: 3,
      rls_kapali_tablolar: ['public_config'],
    },
    extensions: [
      { name: 'plpgsql', version: '1.0', schema: 'pg_catalog', relocatable: false },
      { name: 'uuid-ossp', version: '1.1', schema: 'public', relocatable: true },
      { name: 'pgcrypto', version: '1.3', schema: 'public', relocatable: true },
    ],
    enums: [
      {
        schema: 'public',
        name: 'user_role',
        labels: ['admin', 'staff', 'patient'],
        owner: 'postgres',
        comment: 'User system roles',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        name: 'status"type',
        labels: ["active'status", 'pending"review', 'done\nmultiline'],
        owner: 'postgres',
        comment: "Adversarial'quote comment",
        is_extension_owned: false,
      },
      {
        schema: 'public',
        name: 'ext_enum',
        labels: ['e1', 'e2'],
        owner: 'postgres',
        comment: null,
        is_extension_owned: true,
      },
    ],
    domains: [
      {
        schema: 'public',
        name: 'email_address',
        basetype: 'text',
        collation: 'pg_catalog."C"',
        notnull: true,
        default_expr: "'unverified@example.com'::text",
        constraints: [
          { name: 'check_email', condef: "CHECK (VALUE ~* '^[A-Z0-9._%-]+@[A-Z0-9.-]+\\.[A-Z]{2,4}$')", comment: 'Email regex check' },
        ],
        owner: 'postgres',
        comment: 'Validated email format',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        name: 'ext_domain',
        basetype: 'integer',
        collation: null,
        notnull: false,
        default_expr: null,
        constraints: [],
        owner: 'postgres',
        comment: null,
        is_extension_owned: true,
      },
    ],
    composites: [
      {
        schema: 'public',
        name: 'address_type',
        owner: 'postgres',
        comment: 'Postal address composite',
        is_extension_owned: false,
        attributes: [
          { attnum: 1, name: 'street', typ: 'text', collation: null, comment: 'Street line' },
          { attnum: 2, name: 'city', typ: 'text', collation: 'pg_catalog."de_DE"', comment: null },
          { attnum: 3, name: 'zip', typ: 'text', collation: null, comment: null },
        ],
      },
      {
        schema: 'public',
        name: 'ext_composite',
        owner: 'postgres',
        comment: null,
        is_extension_owned: true,
        attributes: [{ attnum: 1, name: 'val', typ: 'integer', collation: null, comment: null }],
      },
    ],
    other_types: [],
    sequences: [
      {
        schema: 'public',
        name: 'invoice_number_seq',
        data_type: 'smallint',
        owner: 'postgres',
        comment: 'Invoice numbering sequence',
        is_extension_owned: false,
        seqstart: '1000',
        seqmin: '1',
        seqmax: '32767',
        seqincrement: '1',
        seqcycle: false,
        seqcache: '10',
        ref_table: 'invoices',
        ref_column: 'invoice_no',
        is_identity_owned: false,
      },
      {
        schema: 'public',
        name: 'large_seq',
        data_type: 'bigint',
        owner: 'postgres',
        comment: 'Exact 64-bit digits preservation',
        is_extension_owned: false,
        seqstart: '1',
        seqmin: '1',
        seqmax: '9223372036854775807',
        seqincrement: '1',
        seqcycle: false,
        seqcache: '1',
        ref_table: null,
        ref_column: null,
        is_identity_owned: false,
      },
      {
        schema: 'public',
        name: 'patient_id_seq',
        data_type: 'integer',
        owner: 'postgres',
        comment: null,
        is_extension_owned: false,
        seqstart: '1',
        seqmin: '1',
        seqmax: '2147483647',
        seqincrement: '1',
        seqcycle: false,
        seqcache: '1',
        ref_table: 'patients',
        ref_column: 'id',
        is_identity_owned: true,
      },
      {
        schema: 'public',
        name: 'ext_seq',
        data_type: 'integer',
        owner: 'postgres',
        comment: null,
        is_extension_owned: true,
        seqstart: '1',
        seqmin: '1',
        seqmax: '1000',
        seqincrement: '1',
        seqcycle: false,
        seqcache: '1',
        ref_table: null,
        ref_column: null,
        is_identity_owned: false,
      },
    ],
    tables: [
      {
        schema: 'public',
        name: 'profiles',
        kind: 'r',
        owner: 'postgres',
        persistence: 'p',
        options: ['fillfactor=70'],
        relrowsecurity: true,
        relforcerowsecurity: false,
        comment: 'User profile entity',
        is_extension_owned: false,
        is_partition: false,
        partition_parents: [],
        partition_bound: null,
        partition_key: null,
        columns: [
          { attnum: 1, name: 'id', typ: 'uuid', notnull: true, default_expr: 'gen_random_uuid()', identity: '', generated: '', collation: null, comment: 'Primary ID' },
          { attnum: 2, name: 'email', typ: 'text', notnull: true, default_expr: null, identity: '', generated: '', collation: 'pg_catalog."de_DE"', comment: 'User email' },
        ],
        constraints: [
          { name: 'profiles_pkey', contype: 'p', condef: 'PRIMARY KEY (id)', convalidated: true, comment: null },
        ],
      },
      {
        schema: 'public',
        name: 'leads',
        kind: 'r',
        owner: 'postgres',
        persistence: 'p',
        options: [],
        relrowsecurity: true,
        relforcerowsecurity: false,
        comment: 'Potential leads entity',
        is_extension_owned: false,
        is_partition: false,
        partition_parents: [],
        partition_bound: null,
        partition_key: null,
        columns: [
          { attnum: 1, name: 'id', typ: 'uuid', notnull: true, default_expr: 'gen_random_uuid()', identity: '', generated: '', collation: null, comment: null },
        ],
        constraints: [
          { name: 'leads_pkey', contype: 'p', condef: 'PRIMARY KEY (id)', convalidated: true, comment: null },
        ],
      },
      {
        schema: 'public',
        name: 'patients',
        kind: 'r',
        owner: 'postgres',
        persistence: 'p',
        options: [],
        relrowsecurity: true,
        relforcerowsecurity: true,
        comment: "Patient's records with special symbols",
        is_extension_owned: false,
        is_partition: false,
        partition_parents: [],
        partition_bound: null,
        partition_key: null,
        columns: [
          { attnum: 1, name: 'id', typ: 'uuid', notnull: true, default_expr: 'gen_random_uuid()', identity: '', generated: '', collation: null, comment: 'Patient PK' },
          { attnum: 2, name: 'owner_id', typ: 'uuid', notnull: true, default_expr: null, identity: '', generated: '', collation: null, comment: 'FK to profiles' },
          { attnum: 3, name: 'patient_id', typ: 'uuid', notnull: false, default_expr: null, identity: '', generated: '', collation: null, comment: 'FK to leads' },
          {
            attnum: 4,
            name: 'code',
            typ: 'bigint',
            notnull: true,
            default_expr: null,
            identity: 'a',
            generated: '',
            collation: null,
            comment: 'Identity col',
            identity_sequence: {
              data_type: 'bigint',
              start: '100',
              increment: '5',
              min: '1',
              max: '9223372036854775807',
              cycle: false,
              cache: '20',
            },
          },
          { attnum: 5, name: 'first_name', typ: 'text', notnull: true, default_expr: "''::text", identity: '', generated: '', collation: null, comment: null },
          { attnum: 6, name: 'last_name', typ: 'text', notnull: true, default_expr: "''::text", identity: '', generated: '', collation: null, comment: null },
          { attnum: 7, name: 'full_name', typ: 'text', notnull: false, default_expr: "first_name || ' ' || last_name", identity: '', generated: 's', collation: null, comment: 'Stored generated' },
          { attnum: 8, name: 'status', typ: 'text', notnull: true, default_expr: "'active'::text", identity: '', generated: '', collation: null, comment: null },
        ],
        constraints: [
          { name: 'patients_pkey', contype: 'p', condef: 'PRIMARY KEY (id)', convalidated: true, comment: null },
          {
            name: 'patients_owner_id_fkey',
            contype: 'f',
            condef: 'FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE',
            convalidated: true,
            confrel_table: 'public.profiles',
            confkey_columns: ['owner_id'],
            confrel_columns: ['id'],
            comment: 'Profile FK',
          },
          {
            name: 'patients_lead_fkey',
            contype: 'f',
            condef: 'FOREIGN KEY (patient_id) REFERENCES public.leads(id)',
            convalidated: true,
            confrel_table: 'public.leads',
            confkey_columns: ['patient_id'],
            confrel_columns: ['id'],
            comment: 'Lead FK',
          },
          { name: 'check_status_val', contype: 'c', condef: "CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]))", convalidated: true, comment: null },
        ],
      },
      {
        schema: 'public',
        name: 'measurements',
        kind: 'p',
        owner: 'postgres',
        persistence: 'p',
        options: [],
        relrowsecurity: true,
        relforcerowsecurity: false,
        comment: 'Partitioned measurements table',
        is_extension_owned: false,
        is_partition: false,
        partition_parents: [],
        partition_bound: null,
        partition_key: 'RANGE (measured_at)',
        columns: [
          { attnum: 1, name: 'id', typ: 'uuid', notnull: true, default_expr: 'gen_random_uuid()', identity: '', generated: '', collation: null, comment: null },
          { attnum: 2, name: 'measured_at', typ: 'timestamp with time zone', notnull: true, default_expr: 'now()', identity: '', generated: '', collation: null, comment: null },
        ],
        constraints: [
          { name: 'measurements_pkey', contype: 'p', condef: 'PRIMARY KEY (id, measured_at)', convalidated: true, comment: null },
        ],
      },
      {
        schema: 'public',
        name: 'measurements_y2026',
        kind: 'r',
        owner: 'postgres',
        persistence: 'p',
        options: [],
        relrowsecurity: true,
        relforcerowsecurity: false,
        comment: 'Partition child table for 2026',
        is_extension_owned: false,
        is_partition: true,
        partition_parents: ['measurements'],
        partition_bound: "FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00')",
        partition_key: null,
        columns: [
          { attnum: 1, name: 'id', typ: 'uuid', notnull: true, default_expr: null, identity: '', generated: '', collation: null, comment: null },
          { attnum: 2, name: 'measured_at', typ: 'timestamp with time zone', notnull: true, default_expr: null, identity: '', generated: '', collation: null, comment: null },
        ],
        constraints: [],
      },
      {
        schema: 'public',
        name: 'order"table',
        kind: 'r',
        owner: 'postgres',
        persistence: 'p',
        options: [],
        relrowsecurity: true,
        relforcerowsecurity: false,
        comment: "Adversarial \"table\" comment with 'quotes'",
        is_extension_owned: false,
        is_partition: false,
        partition_parents: [],
        partition_bound: null,
        partition_key: null,
        columns: [
          { attnum: 1, name: 'col"one', typ: 'text', notnull: true, default_expr: "'val''quote'", identity: '', generated: '', collation: null, comment: "Column 'one' comment" },
        ],
        constraints: [
          { name: 'order_table_pkey', contype: 'p', condef: 'PRIMARY KEY ("col""one")', convalidated: true, comment: null },
        ],
      },
      {
        schema: 'public',
        name: 'spatial_ref_sys',
        kind: 'r',
        owner: 'postgres',
        persistence: 'p',
        options: [],
        relrowsecurity: false,
        relforcerowsecurity: false,
        comment: 'PostGIS reference table',
        is_extension_owned: true,
        is_partition: false,
        partition_parents: [],
        partition_bound: null,
        partition_key: null,
        columns: [
          { attnum: 1, name: 'srid', typ: 'integer', notnull: true, default_expr: null, identity: '', generated: '', collation: null, comment: null },
        ],
        constraints: [],
      },
      {
        schema: 'public',
        name: 'public_config',
        kind: 'r',
        owner: 'postgres',
        persistence: 'u',
        options: [],
        relrowsecurity: false,
        relforcerowsecurity: false,
        comment: 'Public reference configuration table without RLS',
        is_extension_owned: false,
        is_partition: false,
        partition_parents: [],
        partition_bound: null,
        partition_key: null,
        columns: [
          { attnum: 1, name: 'key', typ: 'text', notnull: true, default_expr: null, identity: '', generated: '', collation: null, comment: null },
          { attnum: 2, name: 'value', typ: 'text', notnull: false, default_expr: null, identity: '', generated: '', collation: null, comment: null },
        ],
        constraints: [
          { name: 'public_config_pkey', contype: 'p', condef: 'PRIMARY KEY (key)', convalidated: true, comment: null },
        ],
      },
    ],
    views: [
      {
        schema: 'public',
        name: 'active_patients_view',
        viewdef: "SELECT id, owner_id, first_name, last_name\nFROM public.patients\nWHERE status = 'active'",
        owner: 'postgres',
        options: ['security_invoker=true'],
        comment: 'View of active patients',
        is_extension_owned: false,
        columns: [
          { attnum: 1, name: 'id', typ: 'uuid', comment: 'Patient ID' },
          { attnum: 2, name: 'owner_id', typ: 'uuid', comment: null },
        ],
      },
      {
        schema: 'public',
        name: 'ext_view',
        viewdef: 'SELECT 1 AS dummy',
        owner: 'postgres',
        options: [],
        comment: null,
        is_extension_owned: true,
        columns: [],
      },
    ],
    materialized_views: [
      {
        schema: 'public',
        name: 'patient_summary_matview',
        viewdef: 'SELECT owner_id, count(*) AS total_patients\nFROM public.patients\nGROUP BY owner_id',
        owner: 'postgres',
        options: ['security_barrier=true'],
        is_populated: true,
        comment: 'Materialized patient summary',
        is_extension_owned: false,
        columns: [
          { attnum: 1, name: 'owner_id', typ: 'uuid', comment: 'Owner key' },
          { attnum: 2, name: 'total_patients', typ: 'bigint', comment: null },
        ],
      },
      {
        schema: 'public',
        name: 'patient_unpopulated_matview',
        viewdef: 'SELECT count(*) FROM public.patients',
        owner: 'postgres',
        options: [],
        is_populated: false,
        comment: null,
        is_extension_owned: false,
        columns: [],
      },
      {
        schema: 'public',
        name: 'ext_matview',
        viewdef: 'SELECT 1',
        owner: 'postgres',
        options: [],
        is_populated: false,
        comment: null,
        is_extension_owned: true,
        columns: [],
      },
    ],
    functions: [
      {
        schema: 'public',
        name: 'calculate_billing',
        prokind: 'f',
        identity_args: 'patient_id uuid, factor numeric',
        result_type: 'numeric',
        functiondef: `CREATE OR REPLACE FUNCTION public.calculate_billing(patient_id uuid, factor numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total numeric := 0;
BEGIN
  -- Multiline comment preservation test:
  -- Check input parameters
  IF factor IS NULL OR factor <= 0 THEN
    factor := 1.0;
  END IF;

  SELECT coalesce(count(*), 0) * factor INTO v_total
  FROM public.patients
  WHERE id = patient_id;

  RETURN v_total;
END;
$function$\n`,
        security_definer: true,
        search_path: ['search_path=public, pg_temp'],
        language: 'plpgsql',
        owner: 'postgres',
        comment: 'Computes billable units with multiplier',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        name: 'calculate_billing',
        prokind: 'f',
        identity_args: 'patient_id uuid',
        result_type: 'numeric',
        functiondef: `CREATE OR REPLACE FUNCTION public.calculate_billing(patient_id uuid)
 RETURNS numeric
 LANGUAGE sql
AS $function$
  SELECT public.calculate_billing(patient_id, 1.0);
$function$\n`,
        security_definer: false,
        search_path: null,
        language: 'sql',
        owner: 'postgres',
        comment: 'Overload with default factor',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        name: 'archive_old_records',
        prokind: 'p',
        identity_args: 'retention_days integer',
        result_type: 'void',
        functiondef: `CREATE OR REPLACE PROCEDURE public.archive_old_records(IN retention_days integer)
 LANGUAGE plpgsql
AS $procedure$
BEGIN
  -- Procedure body
  COMMIT;
END;
$procedure$\n`,
        security_definer: false,
        search_path: null,
        language: 'plpgsql',
        owner: 'postgres',
        comment: 'Archival procedure',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        name: 'ext_fn',
        prokind: 'f',
        identity_args: '',
        result_type: 'integer',
        functiondef: 'CREATE FUNCTION ext_fn() RETURNS integer AS $$ SELECT 1; $$ LANGUAGE sql;',
        security_definer: false,
        search_path: null,
        language: 'sql',
        owner: 'postgres',
        comment: null,
        is_extension_owned: true,
      },
    ],
    aggregates: [],
    window_functions: [],
    policies: [
      {
        schema: 'public',
        tablename: 'patients',
        policyname: 'patients_owner_all',
        permissive: true,
        command: 'ALL',
        roles: ['authenticated'],
        qual: 'owner_id = auth.uid()',
        with_check: 'owner_id = auth.uid()',
        comment: 'Allow owner full access',
      },
      {
        schema: 'public',
        tablename: 'patients',
        policyname: 'patients_active_restrictive',
        permissive: false,
        command: 'SELECT',
        roles: ['PUBLIC'],
        qual: "status != 'deleted'",
        with_check: null,
        comment: 'Restrictive policy hiding deleted rows',
      },
    ],
    triggers: [
      {
        schema: 'public',
        tablename: 'patients',
        tgname: 'trg_patients_updated',
        triggerdef: 'CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
        tgenabled: 'O',
        comment: 'Timestamp trigger',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        tablename: 'patients',
        tgname: 'trg_audit_disabled',
        triggerdef: 'CREATE TRIGGER trg_audit_disabled AFTER INSERT ON public.patients FOR EACH ROW EXECUTE FUNCTION public.audit_log()',
        tgenabled: 'D',
        comment: 'Disabled trigger',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        tablename: 'patients',
        tgname: 'trg_sync_replica',
        triggerdef: 'CREATE TRIGGER trg_sync_replica AFTER UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.sync_replica()',
        tgenabled: 'R',
        comment: 'Replica trigger',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        tablename: 'patients',
        tgname: 'trg_always_fire',
        triggerdef: 'CREATE TRIGGER trg_always_fire AFTER DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.on_delete()',
        tgenabled: 'A',
        comment: 'Always trigger',
        is_extension_owned: false,
      },
      {
        schema: 'public',
        tablename: 'patients',
        tgname: 'ext_trigger',
        triggerdef: 'CREATE TRIGGER ext_trigger ...',
        tgenabled: 'O',
        comment: null,
        is_extension_owned: true,
      },
    ],
    indexes: [
      {
        schema: 'public',
        tablename: 'patients',
        indexname: 'idx_patients_owner_id',
        indexdef: 'CREATE INDEX idx_patients_owner_id ON public.patients USING btree (owner_id)',
        indisunique: false,
        indisprimary: false,
        indisvalid: true,
        indisready: true,
        is_constraint: false,
        is_extension_owned: false,
        comment: 'Index for owner FK lookups',
      },
      {
        schema: 'public',
        tablename: 'patients',
        indexname: 'patients_pkey',
        indexdef: 'CREATE UNIQUE INDEX patients_pkey ON public.patients USING btree (id)',
        indisunique: true,
        indisprimary: true,
        indisvalid: true,
        indisready: true,
        is_constraint: true,
        is_extension_owned: false,
        comment: null,
      },
      {
        schema: 'public',
        tablename: 'patients',
        indexname: 'idx_patients_broken',
        indexdef: 'CREATE INDEX idx_patients_broken ON public.patients USING btree (status)',
        indisunique: false,
        indisprimary: false,
        indisvalid: false,
        indisready: false,
        is_constraint: false,
        is_extension_owned: false,
        comment: 'Invalid failed index build',
      },
      {
        schema: 'public',
        tablename: 'spatial_ref_sys',
        indexname: 'spatial_ref_sys_pkey',
        indexdef: 'CREATE UNIQUE INDEX spatial_ref_sys_pkey ON public.spatial_ref_sys (srid)',
        indisunique: true,
        indisprimary: true,
        indisvalid: true,
        indisready: true,
        is_constraint: true,
        is_extension_owned: true,
        comment: null,
      },
    ],
    acls: [
      {
        object_type: 'SCHEMA',
        schema: 'public',
        object_name: 'public',
        column_name: null,
        grantee: 'PUBLIC',
        grantor: 'postgres',
        privilege: 'USAGE',
        is_grantable: false,
      },
      {
        object_type: 'TABLE',
        schema: 'public',
        object_name: 'patients',
        column_name: null,
        grantee: 'authenticated',
        grantor: 'postgres',
        privilege: 'SELECT',
        is_grantable: false,
      },
      {
        object_type: 'COLUMN',
        schema: 'public',
        object_name: 'patients',
        column_name: 'first_name',
        grantee: 'staff',
        grantor: 'postgres',
        privilege: 'SELECT',
        is_grantable: false,
      },
      {
        object_type: 'FUNCTION',
        schema: 'public',
        object_name: 'calculate_billing(uuid, numeric)',
        column_name: null,
        grantee: 'authenticated',
        grantor: 'postgres',
        privilege: 'EXECUTE',
        is_grantable: false,
      },
    ],
    default_acls: [
      {
        target_role: 'postgres',
        target_schema: 'public',
        object_type: 'TABLES',
        grantee: 'authenticated',
        grantor: 'postgres',
        privilege: 'SELECT',
        is_grantable: false,
      },
    ],
    publications: [
      {
        name: 'praxura_pub',
        all_tables: false,
        tables: ['public.patients', 'public.profiles'],
      },
    ],
    auth_triggers: [
      {
        schema: 'auth',
        tablename: 'users',
        tgname: 'on_auth_user_created',
        triggerdef: 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()',
        tgenabled: 'O',
        scope_marker: 'EXTERNAL_AUTH_INVENTORY',
      },
    ],
    storage_policies: [
      {
        schema: 'storage',
        tablename: 'objects',
        policyname: 'authenticated_read',
        permissive: true,
        command: 'SELECT',
        roles: ['authenticated'],
        qual: "bucket_id = 'prescriptions'",
        with_check: null,
        scope_marker: 'EXTERNAL_STORAGE_INVENTORY',
      },
    ],
    rlsoff_tables: ['public_config'],
  };
}

// ============================================================================
// 3. RENDERER UNIT & ADVERSARIAL TESTS
// ============================================================================
describe('renderSchemaDokumente() Unit & Integration Tests', () => {
  const fixture = createComprehensiveSyntheticFixture();
  const { schema, rls } = renderSchemaDokumente(fixture);

  it('renders valid header metadata in both SCHEMA.sql and SCHEMA-RLS.sql', () => {
    assert.ok(schema.includes('ENVIRONMENT:        saas'));
    assert.ok(schema.includes('LAST MIGRATION:     0195_add_payments.sql'));
    assert.ok(schema.includes('EXPORTED AT:        2026-10-03T18:30:00Z'));
    assert.ok(schema.includes('ERZEUGT AM:         2026-10-03'));
    assert.ok(schema.includes('POSTGRESQL VERSION: PostgreSQL 17.0'));

    assert.ok(rls.includes('ENVIRONMENT:        saas'));
    assert.ok(rls.includes('LAST MIGRATION:     0195_add_payments.sql'));
    assert.ok(rls.includes('EXPORTED AT:        2026-10-03T18:30:00Z'));
    assert.ok(rls.includes('ERZEUGT AM:         2026-10-03'));
  });

  it('exercises EXACT real parser code from tools/tabellenkarte.mjs lines 43-59', () => {
    // Exact parser logic from tools/tabellenkarte.mjs:
    const schemaText = schema;
    const tabellen = new Map();
    const re = /^CREATE TABLE ([^\s(]+) \(([\s\S]*?)^\);/gm;
    let m;
    while ((m = re.exec(schemaText))) {
      const name = m[1].replace(/^public\./, '').replace(/"/g, '');
      const body = m[2];
      const spalten = body.split('\n').filter(l => /^\s{2}\S/.test(l)).length;
      const after = schemaText.slice(re.lastIndex, re.lastIndex + 2000).split('\nCREATE TABLE')[0];
      const fkRaus = [...new Set([...after.matchAll(/--\s+FK\s+\S+\s+->\s+([a-zA-Z0-9_."ßäöü]+)\(/g)]
        .map(x => x[1].replace(/^public\./, '').replace(/"/g, '')))];
      tabellen.set(name, { name, spalten, fkRaus });
    }

    // Must match our tables:
    assert.ok(tabellen.has('profiles'), 'Must detect profiles table');
    assert.equal(tabellen.get('profiles').spalten, 2, 'profiles has 2 columns');

    assert.ok(tabellen.has('leads'), 'Must detect leads table');
    assert.equal(tabellen.get('leads').spalten, 1, 'leads has 1 column');

    assert.ok(tabellen.has('patients'), 'Must detect patients table');
    assert.equal(tabellen.get('patients').spalten, 8, 'patients has 8 columns');
    assert.ok(tabellen.get('patients').fkRaus.includes('profiles'), 'patients has FK to profiles');
    assert.ok(tabellen.get('patients').fkRaus.includes('leads'), 'patients has FK to leads');

    assert.ok(tabellen.has('measurements'), 'Must detect measurements table');
    assert.equal(tabellen.get('measurements').spalten, 2);

    assert.ok(tabellen.has('measurements_y2026'), 'Must detect partition child measurements_y2026');
    assert.equal(tabellen.get('measurements_y2026').spalten, 2);

    // Note: tabellenkarte does .replace(/"/g, '') on m[1], so 'order"table' key becomes 'ordertable'
    assert.ok(tabellen.has('ordertable'), 'Must detect adversarial order"table as ordertable per tabellenkarte normalize');
    assert.equal(tabellen.get('ordertable').spalten, 1);

    assert.ok(tabellen.has('public_config'), 'Must detect public_config table');
    assert.equal(tabellen.get('public_config').spalten, 2);

    // Extension-owned table spatial_ref_sys is in block comment, tabellenkarte parser sees it:
    assert.ok(tabellen.has('spatial_ref_sys'), 'spatial_ref_sys is documented and captured by tabellenkarte');
    assert.equal(tabellen.get('spatial_ref_sys').spalten, 1);
  });

  it('exercises EXACT real parser code from api-backend/dsgvo/klassifikation.test.js lines 16-37', () => {
    // Exact tableRegex from api-backend/dsgvo/klassifikation.test.js:16
    const tableRegex = /CREATE TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/g;
    const gefundeneTabellen = new Set();
    const personenTabellen = new Set();

    let match;
    while ((match = tableRegex.exec(schema)) !== null) {
      const tableName = match[1];
      const columnsBlock = match[2];
      gefundeneTabellen.add(tableName);

      const hatPersonenSpalte = /\b(owner_id|user_id|employee_id|owner_user_id)\b/.test(columnsBlock);
      if (hatPersonenSpalte) {
        personenTabellen.add(tableName);
      }
    }

    assert.ok(gefundeneTabellen.has('profiles'), 'DSGVO regex must find profiles');
    assert.ok(gefundeneTabellen.has('leads'), 'DSGVO regex must find leads');
    assert.ok(gefundeneTabellen.has('patients'), 'DSGVO regex must find patients');
    assert.ok(personenTabellen.has('patients'), 'patients must be detected as containing owner_id');
  });

  it('exercises EXACT real parser code from api-backend/dsgvo/klassifikation.test.js lines 66-87 (lead references)', () => {
    // Exact section splitting and lead FK detection from api-backend/dsgvo/klassifikation.test.js
    const sections = schema.split(/CREATE TABLE\s+(?:public\.)?/);
    const schemaFks = [];

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const tableMatch = section.match(/^([a-zA-Z0-9_]+)/);
      if (!tableMatch) continue;
      const tableName = tableMatch[1];

      const bodyAndComments = section.split(/\n-- =+/)[0];
      const fkMatches = bodyAndComments.matchAll(/(?:FK\s+)?([a-zA-Z0-9_]+)\s*->\s*leads(?:\(id\))?|([a-zA-Z0-9_]+)\s+uuid\s+REFERENCES\s+(?:public\.)?leads/gi);
      for (const fm of fkMatches) {
        const colName = fm[1] || fm[2];
        if (colName && colName !== 'id') {
          schemaFks.push([tableName, colName]);
        }
      }
    }

    assert.ok(schemaFks.length > 0, 'Must find at least one lead reference');
    assert.ok(schemaFks.some(([tbl, col]) => tbl === 'patients' && col === 'patient_id'));
  });

  it('documents extension-owned table in non-executable block comment without executable DDL', () => {
    assert.ok(schema.includes('/* [EXTENSION OWNED - NON-EXECUTABLE]\nCREATE TABLE public.spatial_ref_sys ('));
    assert.match(schema, /\/\* \[EXTENSION OWNED - NON-EXECUTABLE\][\s\S]*?  srid integer NOT NULL\n\);[\s\S]*?\*\//);
  });

  it('renders exact sequence parameters as strings without inventing defaults', () => {
    // smallint sequence
    assert.ok(schema.includes('CREATE SEQUENCE public.invoice_number_seq\n  AS smallint\n  START WITH 1000\n  INCREMENT BY 1\n  MINVALUE 1\n  MAXVALUE 32767\n  CACHE 10\n  NO CYCLE;'));

    // 64-bit sequence max value exact preservation
    assert.ok(schema.includes('MAXVALUE 9223372036854775807'));

    // Identity-owned sequence documentation
    assert.ok(schema.includes('-- Sequence public.patient_id_seq (identity-owned for public.patients.id, AS integer, START WITH 1, INCREMENT BY 1, MINVALUE 1, MAXVALUE 2147483647, CACHE 1, NO CYCLE)'));
  });

  it('shows actual sequence parameters in column identity clause', () => {
    assert.ok(schema.includes('code bigint GENERATED ALWAYS AS IDENTITY (START WITH 100 INCREMENT BY 5 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 20) NOT NULL'));
  });

  it('renders table owner, persistence UNLOGGED, and table options SET', () => {
    // Table owner
    assert.ok(schema.includes('ALTER TABLE ONLY public.profiles OWNER TO postgres;'));

    // Table options SET
    assert.ok(schema.includes('ALTER TABLE ONLY public.profiles SET (fillfactor=70);'));

    // Unlogged table
    assert.ok(schema.includes('-- PERSISTENCE: UNLOGGED\nCREATE TABLE public.public_config ('));
  });

  it('renders view and matview options, owner, columns and comments', () => {
    // View with options & owner
    assert.ok(schema.includes('CREATE OR REPLACE VIEW public.active_patients_view WITH (security_invoker=true) AS'));
    assert.ok(schema.includes('ALTER VIEW public.active_patients_view OWNER TO postgres;'));
    assert.ok(schema.includes("COMMENT ON COLUMN public.active_patients_view.id IS 'Patient ID';"));

    // Matview with options & owner
    assert.ok(schema.includes('CREATE MATERIALIZED VIEW public.patient_summary_matview WITH (security_barrier=true) AS'));
    assert.ok(schema.includes('ALTER MATERIALIZED VIEW public.patient_summary_matview OWNER TO postgres;'));
    assert.ok(schema.includes("COMMENT ON COLUMN public.patient_summary_matview.owner_id IS 'Owner key';"));
  });

  it('renders procedure comments as COMMENT ON PROCEDURE (not FUNCTION)', () => {
    assert.ok(rls.includes("COMMENT ON PROCEDURE public.archive_old_records(retention_days integer) IS 'Archival procedure';"));
    assert.ok(!rls.includes("COMMENT ON FUNCTION public.archive_old_records"));
    assert.ok(rls.includes("COMMENT ON FUNCTION public.calculate_billing(patient_id uuid, factor numeric) IS 'Computes billable units with multiplier';"));
  });

  it('renders schema-qualified collations properly', () => {
    assert.ok(schema.includes('CREATE DOMAIN public.email_address AS text COLLATE pg_catalog."C"'));
    assert.ok(schema.includes('email text COLLATE pg_catalog."de_DE" NOT NULL'));
  });

  it('always records RLS force boolean status', () => {
    // When relforcerowsecurity is true
    assert.ok(rls.includes('ALTER TABLE public.patients FORCE ROW LEVEL SECURITY;'));
    // When relforcerowsecurity is false on enabled table
    assert.ok(rls.includes('-- FORCE ROW LEVEL SECURITY: false'));
    // When RLS is disabled
    assert.ok(rls.includes('-- [RLS DISABLED] Table public.public_config\nALTER TABLE public.public_config DISABLE ROW LEVEL SECURITY;\n-- FORCE ROW LEVEL SECURITY: false'));
  });

  it('renders index definitions even for constraint indexes and invalid indexes', () => {
    // Constraint index
    assert.ok(rls.includes('-- Index patients_pkey ON public.patients is enforced by constraint'));
    assert.ok(rls.includes('-- DDL: CREATE UNIQUE INDEX patients_pkey ON public.patients USING btree (id);'));

    // Invalid index
    assert.ok(rls.includes('-- [INVALID / NOT READY] Index idx_patients_broken (valid: false, ready: false)'));
    assert.ok(rls.includes('-- DDL: CREATE INDEX idx_patients_broken ON public.patients USING btree (status);'));
  });
});

// ============================================================================
// 4. DETERMINISTIC STABLE ORDERING TEST
// ============================================================================
describe('Deterministic Stable Ordering across Random Input Order', () => {
  it('produces 100% byte-identical output when groups and arrays are shuffled', () => {
    const fixture1 = createComprehensiveSyntheticFixture();
    const fixture2 = createComprehensiveSyntheticFixture();

    // Reverse and shuffle arrays in fixture2
    fixture2.tables = [...fixture2.tables].reverse();
    for (const t of fixture2.tables) {
      t.columns = [...t.columns].reverse();
      t.constraints = [...t.constraints].reverse();
    }
    fixture2.enums = [...fixture2.enums].reverse();
    fixture2.domains = [...fixture2.domains].reverse();
    fixture2.composites = [...fixture2.composites].reverse();
    fixture2.sequences = [...fixture2.sequences].reverse();
    fixture2.views = [...fixture2.views].reverse();
    fixture2.materialized_views = [...fixture2.materialized_views].reverse();
    fixture2.functions = [...fixture2.functions].reverse();
    fixture2.policies = [...fixture2.policies].reverse();
    fixture2.triggers = [...fixture2.triggers].reverse();
    fixture2.indexes = [...fixture2.indexes].reverse();
    fixture2.acls = [...fixture2.acls].reverse();
    fixture2.default_acls = [...fixture2.default_acls].reverse();
    fixture2.extensions = [...fixture2.extensions].reverse();
    fixture2.publications = [...fixture2.publications].reverse();
    fixture2.auth_triggers = [...fixture2.auth_triggers].reverse();
    fixture2.storage_policies = [...fixture2.storage_policies].reverse();
    fixture2.rlsoff_tables = [...fixture2.rlsoff_tables].reverse();

    const res1 = renderSchemaDokumente(fixture1);
    const res2 = renderSchemaDokumente(fixture2);

    assert.equal(res1.schema, res2.schema, 'SCHEMA.sql must be byte-identical regardless of input array ordering');
    assert.equal(res1.rls, res2.rls, 'SCHEMA-RLS.sql must be byte-identical regardless of input array ordering');
  });
});

// ============================================================================
// 5. VALIDATION & ERROR HANDLING TESTS
// ============================================================================
describe('Validation & Error Rejection (Fail Fast Guarantee)', () => {
  it('fails if metadata is missing', () => {
    const f = createComprehensiveSyntheticFixture();
    delete f.metadata;
    assert.throws(() => renderSchemaDokumente(f), /Invalid metadata/);
  });

  it('fails if exported_at contains newlines', () => {
    const f = createComprehensiveSyntheticFixture();
    f.metadata.exported_at = '2026-10-03\nSELECT 1;';
    assert.throws(() => renderSchemaDokumente(f), /unescaped newlines/);
  });

  it('fails if exported_at is not a valid date', () => {
    const f = createComprehensiveSyntheticFixture();
    f.metadata.exported_at = 'not-a-date';
    assert.throws(() => renderSchemaDokumente(f), /valid ISO date/);
  });

  it('fails if last_migration contains newlines', () => {
    const f = createComprehensiveSyntheticFixture();
    f.metadata.last_migration = '0195\nDROP TABLE patients;';
    assert.throws(() => renderSchemaDokumente(f), /unescaped newlines/);
  });

  it('fails if environment contains newlines', () => {
    const f = createComprehensiveSyntheticFixture();
    f.metadata.environment = 'saas\nDROP TABLE patients;';
    assert.throws(() => renderSchemaDokumente(f), /unescaped newlines/);
  });

  it('fails if a required structural group is missing', () => {
    const f = createComprehensiveSyntheticFixture();
    delete f.tables;
    assert.throws(() => renderSchemaDokumente(f), /Missing required structural group: "tables"/);
  });

  it('fails if counts contains invalid negative number', () => {
    const f = createComprehensiveSyntheticFixture();
    f.counts.public_tables = -1;
    assert.throws(() => renderSchemaDokumente(f), /non-negative finite integer/);
  });

  it('fails if non-extension function lacks functiondef', () => {
    const f = createComprehensiveSyntheticFixture();
    f.functions[0].functiondef = '';
    assert.throws(() => renderSchemaDokumente(f), /Missing functiondef for non-extension function/);
  });

  it('fails if non-extension trigger lacks triggerdef', () => {
    const f = createComprehensiveSyntheticFixture();
    f.triggers[0].triggerdef = '';
    assert.throws(() => renderSchemaDokumente(f), /Missing triggerdef for non-extension trigger/);
  });

  it('fails if non-extension view lacks viewdef', () => {
    const f = createComprehensiveSyntheticFixture();
    f.views[0].viewdef = '   ';
    assert.throws(() => renderSchemaDokumente(f), /Missing viewdef for non-extension view/);
  });

  it('fails if an unhandled custom type exists in other_types without extension ownership', () => {
    const f = createComprehensiveSyntheticFixture();
    f.other_types = [
      { schema: 'public', name: 'my_range_type', typtype: 'r', is_extension_owned: false },
    ];
    assert.throws(() => renderSchemaDokumente(f), /Cannot reconstruct DDL for unhandled custom type/);
  });

  it('fails if a custom aggregate exists without extension ownership', () => {
    const f = createComprehensiveSyntheticFixture();
    f.aggregates = [
      { schema: 'public', name: 'my_custom_agg', is_extension_owned: false },
    ];
    assert.throws(() => renderSchemaDokumente(f), /Cannot reconstruct DDL for custom aggregate/);
  });
});

// ============================================================================
// 6. CLI EXECUTION & TEMP OUTPUT VERIFICATION
// ============================================================================
describe('CLI Execution with Isolated Temporary Directories', () => {
  let tempDir;
  let inputFilePath;
  let outputDirPath;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'schema-cli-test-'));
    inputFilePath = join(tempDir, 'katalog-input.json');
    outputDirPath = join(tempDir, 'output');
    writeFileSync(inputFilePath, JSON.stringify(createComprehensiveSyntheticFixture(), null, 2), 'utf8');
  });

  after(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('CLI successfully writes SCHEMA.sql and SCHEMA-RLS.sql when given valid input', () => {
    const scriptPath = join(process.cwd(), 'tools/schema-dokumente.mjs');
    execFileSync(process.execPath, [scriptPath, '--input', inputFilePath, '--output-dir', outputDirPath], {
      encoding: 'utf8',
    });

    const schemaPath = join(outputDirPath, 'SCHEMA.sql');
    const rlsPath = join(outputDirPath, 'SCHEMA-RLS.sql');

    assert.ok(existsSync(schemaPath), 'SCHEMA.sql must exist in output directory');
    assert.ok(existsSync(rlsPath), 'SCHEMA-RLS.sql must exist in output directory');

    const schemaContent = readFileSync(schemaPath, 'utf8');
    const rlsContent = readFileSync(rlsPath, 'utf8');

    assert.ok(schemaContent.includes('SCHEMA.sql — Database Structural Schema Definition'));
    assert.ok(rlsContent.includes('SCHEMA-RLS.sql — Row Level Security'));
  });

  it('CLI rejects missing arguments with non-zero exit code', () => {
    const scriptPath = join(process.cwd(), 'tools/schema-dokumente.mjs');
    assert.throws(() => {
      execFileSync(process.execPath, [scriptPath], { encoding: 'utf8', stdio: 'pipe' });
    });
  });

  it('CLI rejects unknown flags with non-zero exit code', () => {
    const scriptPath = join(process.cwd(), 'tools/schema-dokumente.mjs');
    assert.throws(() => {
      execFileSync(process.execPath, [scriptPath, '--unknown-flag'], { encoding: 'utf8', stdio: 'pipe' });
    });
  });

  it('CLI rejects invalid input JSON with non-zero exit code and writes no partial output', () => {
    const badInputPath = join(tempDir, 'bad-input.json');
    const badOutputDir = join(tempDir, 'bad-output');
    writeFileSync(badInputPath, JSON.stringify({ metadata: { exported_at: 'bad-date' } }), 'utf8');

    const scriptPath = join(process.cwd(), 'tools/schema-dokumente.mjs');
    assert.throws(() => {
      execFileSync(process.execPath, [scriptPath, '--input', badInputPath, '--output-dir', badOutputDir], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    });

    assert.ok(!existsSync(badOutputDir), 'Must NOT create output files on validation failure');
  });

  it('CLI --help exits with 0 and prints usage', () => {
    const scriptPath = join(process.cwd(), 'tools/schema-dokumente.mjs');
    const stdout = execFileSync(process.execPath, [scriptPath, '--help'], { encoding: 'utf8' });
    assert.ok(stdout.includes('USAGE:'));
    assert.ok(stdout.includes('JSON METADATA CONTRACT:'));
  });
});


describe('schema repairs patch-51bd', () => {
  it('preserves cross-schema sequence ownership', () => {
    const f = createComprehensiveSyntheticFixture(); f.sequences[0].ref_schema = 'other';
    f.sequences[0].ref_table = 'target'; f.sequences[0].ref_column = 'id';
    assert.match(renderSchemaDokumente(f).schema, /OWNED BY other\.target\.id;/);
  });
  it('does not append trigger-dependent whitespace to structural schema', () => {
    const f = createComprehensiveSyntheticFixture(); const schema = renderSchemaDokumente(f).schema;
    f.triggers = []; assert.equal(renderSchemaDokumente(f).schema, schema);
  });
  it('preserves quoted case, numeric-leading names and reserved identifiers', () => {
    for (const name of ['Foo', '1foo', 'user', 'select']) assert.equal(formatIdent(name), `"${name}"`);
    assert.equal(formatIdent('owner_id'), 'owner_id');
  });
  it('rejects missing required counts instead of printing N/A', () => {
    const fixture = createComprehensiveSyntheticFixture(); delete fixture.counts.table_columns;
    assert.throws(() => renderSchemaDokumente(fixture), /Invalid count "table_columns"/);
  });
  it('validates window_functions required group (missing and wrong type throw)', () => {
    const base = createComprehensiveSyntheticFixture();
    const missing = { ...base };
    delete missing.window_functions;
    assert.throws(() => renderSchemaDokumente(missing));

    const wrongType = { ...base, window_functions: {} };
    assert.throws(() => renderSchemaDokumente(wrongType));
  });

  it('retains all extension-owned table metadata inside non-executable wrapper', () => {
    const fixture = createComprehensiveSyntheticFixture();
    fixture.tables = [{
      name: 'ext_tbl',
      is_extension_owned: true,
      owner: 'postgres',
      options: ['fillfactor=80'],
      comment: 'tbl comment */ test',
      columns: [{ attnum: 1, name: 'id', typ: 'integer', notnull: true, comment: 'col comment' }],
      constraints: [
        { name: 'pk_ext', contype: 'p', condef: 'PRIMARY KEY (id)' },
        { name: 'chk_ext', contype: 'c', condef: 'CHECK (id > 0)' },
      ],
    }];
    const { schema } = renderSchemaDokumente(fixture);
    assert.match(schema, /\/\* \[EXTENSION OWNED - NON-EXECUTABLE\]/);
    assert.match(schema, /CREATE TABLE public\.ext_tbl/);
    assert.match(schema, /ALTER TABLE ONLY public\.ext_tbl OWNER TO postgres;/);
    assert.match(schema, /ALTER TABLE ONLY public\.ext_tbl SET \(fillfactor=80\);/);
    assert.match(schema, /COMMENT ON TABLE public\.ext_tbl IS 'tbl comment \* \/ test';/);
    assert.match(schema, /COMMENT ON COLUMN public\.ext_tbl\.id IS 'col comment';/);
    assert.match(schema, /ADD CONSTRAINT pk_ext PRIMARY KEY \(id\);/);
    assert.match(schema, /ADD CONSTRAINT chk_ext CHECK \(id > 0\);/);
    const outside = schema.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(outside, /ext_tbl/);
  });

  it('renders explicit empty ACL and default ACL rows distinctly with no phantom grants', () => {
    const fixture = createComprehensiveSyntheticFixture();
    fixture.acls = [{
      object_type: 'TABLE',
      schema: 'public',
      object_name: 'empty_tbl',
      empty_acl: true,
    }];
    fixture.default_acls = [{
      target_role: 'app_admin',
      target_schema: 'public',
      object_type: 'TABLES',
      empty_acl: true,
    }];
    const { rls } = renderSchemaDokumente(fixture);
    assert.match(rls, /-- EMPTY_ACL: type=TABLE schema=public object=empty_tbl column=- \(no explicit privileges\)/);
    assert.match(rls, /-- EMPTY_DEFAULT_ACL: target_role=app_admin schema=public object_type=TABLES \(no explicit privileges\)/);
    assert.doesNotMatch(rls, /grantee=null/);
    assert.doesNotMatch(rls, /privilege=null/);
  });
});
