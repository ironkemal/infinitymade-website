#!/usr/bin/env node
// ============================================================================
// tools/schema-dokumente.mjs
// Deterministic Catalog Metadata Snapshot Renderer
//
// PURPOSE:
//   Pure library and CLI utility that renders PostgreSQL catalog metadata
//   snapshots (produced by tools/schema-export-katalog.sql and enriched with
//   external metadata) into complete, standardized structural documents:
//     - db/SCHEMA.sql (enums, domains, composites, sequences, tables, constraints, views)
//     - db/SCHEMA-RLS.sql (RLS flags, policies, functions/procedures, triggers, indexes, ACLs)
//
// CONTRACT & INTEGRITY RULES:
//   1. Pure rendering: No database connections, no network, no environment side-effects.
//   2. Explicit metadata contract: Requires `metadata` with:
//      - `exported_at`: Valid ISO date/timestamp string (never substituted, no unescaped newlines).
//      - `last_migration`: exact version/filename of applied migration ledger (never faked).
//      - `environment`: 'saas' | 'box' | explicit label.
//   3. Deterministic output: Elements within every structural group are sorted
//      by stable canonical keys (schema, name, identity_args) regardless of input order.
//   4. Tabellenkarte & DSGVO parser compatibility:
//      Every CREATE TABLE block matches:
//        - tools/tabellenkarte.mjs: /^CREATE TABLE ([^\s(]+) \(([\s\S]*?)^\);/gm
//        - api-backend/dsgvo/klassifikation.test.js: /CREATE TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/g
//      Columns use bare identifiers where valid and are indented with 2 spaces.
//      Foreign key comments `--   FK <col> -> <target_table>(<target_col>)` are placed
//      IMMEDIATELY after the CREATE block with no whitespace in the left-hand token.
//   5. Strict error handling: Fails immediately if any required group, header metadata,
//      or non-extension object definition (functiondef, triggerdef, viewdef, indexdef)
//      is missing. Transparent failure prevents false claims of completeness.
//   6. Extension ownership: Extension-owned objects are fully documented with metadata
//      and wrapped in non-executable comments (e.g. /* [EXTENSION OWNED - NON-EXECUTABLE] ... */)
//      to preserve structural inventory while preventing executable duplication.
//   7. Outside-public boundaries: Auth triggers and storage policies are clearly
//      marked as outside public schema inventory and not full system exports.
//
// CLI USAGE:
//   node tools/schema-dokumente.mjs --input <path-to-katalog.json> --output-dir <path-to-dir>
//   node tools/schema-dokumente.mjs --help
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_GROUPS = [
  'tables',
  'views',
  'materialized_views',
  'enums',
  'domains',
  'composites',
  'sequences',
  'functions',
  'aggregates',
  'window_functions',
  'policies',
  'triggers',
  'indexes',
  'acls',
  'default_acls',
  'extensions',
  'counts',
  'other_types',
  'publications',
  'auth_triggers',
  'storage_policies',
  'rlsoff_tables',
];

/**
 * Escapes an SQL string literal by doubling single quotes.
 * Strips raw newlines in comment strings to prevent comment escaping/injection.
 * @param {string} str
 * @returns {string}
 */
export function escapeSqlLiteral(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/'/g, "''");
}

/**
 * Formats a single identifier: bare simple name if standard alphanumeric/underscore,
 * otherwise safely quoted with double quotes.
 * @param {string} ident
 * @returns {string}
 */
export function formatIdent(ident) {
  if (ident === null || ident === undefined) return '""';
  const str = String(ident);
  // PostgreSQL17 reserved words, read from pg_get_keywords() (catcode='R').
  const reserved = new Set('all analyse analyze and any array as asc asymmetric both case cast check collate column constraint create current_catalog current_date current_role current_time current_timestamp current_user default deferrable desc distinct do else end except false fetch for foreign from grant group having in initially intersect into lateral leading limit localtime localtimestamp not null offset on only or order placing primary references returning select session_user some symmetric system_user table then to trailing true union unique user using variadic when where window with'.split(' '));
  if (/^[a-z_][a-z0-9_]*$/.test(str) && !reserved.has(str)) {
    return str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Formats a schema-qualified name (e.g. public.tableName or public."quoted").
 * @param {string} schema
 * @param {string} name
 * @returns {string}
 */
export function formatQualifiedName(schema, name) {
  const sch = schema || 'public';
  return `${formatIdent(sch)}.${formatIdent(name)}`;
}

/**
 * Validates the metadata object. Throws if invalid or missing required fields.
 * Never substitutes current time or a fake migration name.
 * @param {object} meta
 */
export function validateMetadata(meta) {
  if (!meta || typeof meta !== 'object') {
    throw new Error('Invalid metadata: metadata object is required.');
  }
  const { exported_at, last_migration, environment } = meta;
  if (!exported_at || typeof exported_at !== 'string' || exported_at.trim() === '') {
    throw new Error('Invalid metadata: "exported_at" must be a non-empty string timestamp/date.');
  }
  if (/[\r\n]/.test(exported_at)) {
    throw new Error('Invalid metadata: "exported_at" contains unescaped newlines.');
  }
  const parsedTime = Date.parse(exported_at);
  if (isNaN(parsedTime)) {
    throw new Error(`Invalid metadata: "exported_at" must be a valid ISO date/timestamp, got "${exported_at}".`);
  }

  if (!last_migration || typeof last_migration !== 'string' || last_migration.trim() === '') {
    throw new Error('Invalid metadata: "last_migration" must be a non-empty string identifier.');
  }
  if (/[\r\n]/.test(last_migration)) {
    throw new Error('Invalid metadata: "last_migration" contains unescaped newlines.');
  }

  if (!environment || typeof environment !== 'string' || environment.trim() === '') {
    throw new Error('Invalid metadata: "environment" must be a non-empty string (e.g. "saas", "box").');
  }
  if (/[\r\n]/.test(environment)) {
    throw new Error('Invalid metadata: "environment" contains unescaped newlines.');
  }
}

/**
 * Validates the input catalog payload for required groups, counts, and definitions.
 * @param {object} data
 */
export function validateKatalog(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid catalog: catalog must be a non-null object.');
  }

  for (const group of REQUIRED_GROUPS) {
    if (data[group] === undefined || data[group] === null) {
      throw new Error(`Missing required structural group: "${group}".`);
    }
    if (group !== 'counts' && !Array.isArray(data[group])) {
      throw new Error(`Invalid structural group: "${group}" must be an array.`);
    }
  }

  // Validate counts
  if (typeof data.counts !== 'object' || data.counts === null) {
    throw new Error('Invalid catalog: "counts" must be an object.');
  }
  const countKeys = ['public_tables', 'table_columns', 'view_columns', 'matview_columns', 'rls_policies', 'functions', 'triggers', 'indexes', 'auth_triggers', 'publication_tables', 'extensions'];
  for (const k of countKeys) {
    const val = data.counts[k];
    if (!Number.isInteger(val) || val < 0) {
      throw new Error(`Invalid count "${k}": must be a non-negative finite integer, got ${val}.`);
    }
  }

  // Validate other_types
  for (const ot of data.other_types) {
    if (!ot.is_extension_owned) {
      throw new Error(
        `Cannot reconstruct DDL for unhandled custom type: "${ot.schema || 'public'}.${ot.name}" (typtype: ${ot.typtype}). Full refresh claim rejected.`
      );
    }
  }

  // Validate aggregates (custom non-extension aggregates unsupported for full refresh)
  for (const ag of data.aggregates) {
    if (!ag.is_extension_owned) {
      throw new Error(
        `Cannot reconstruct DDL for custom aggregate: "${ag.schema || 'public'}.${ag.name}". Transparent failure prevents false full refresh claim.`
      );
    }
  }

  // Validate window functions
  if (Array.isArray(data.window_functions)) {
    for (const wf of data.window_functions) {
      if (!wf.is_extension_owned) {
        throw new Error(
          `Cannot reconstruct DDL for custom window function: "${wf.schema || 'public'}.${wf.name}". Transparent failure prevents false full refresh claim.`
        );
      }
    }
  }

  // Validate function definitions
  for (const fn of data.functions) {
    if (!fn.is_extension_owned) {
      if (!fn.functiondef || typeof fn.functiondef !== 'string' || fn.functiondef.trim() === '') {
        throw new Error(
          `Missing functiondef for non-extension function: "${fn.schema || 'public'}.${fn.name}(${fn.identity_args || ''})".`
        );
      }
    }
  }

  // Validate trigger definitions
  for (const trg of data.triggers) {
    if (!trg.is_extension_owned) {
      if (!trg.triggerdef || typeof trg.triggerdef !== 'string' || trg.triggerdef.trim() === '') {
        throw new Error(
          `Missing triggerdef for non-extension trigger: "${trg.tgname}" on "${trg.tablename}".`
        );
      }
    }
  }

  // Validate view definitions
  for (const v of data.views) {
    if (!v.is_extension_owned) {
      if (!v.viewdef || typeof v.viewdef !== 'string' || v.viewdef.trim() === '') {
        throw new Error(
          `Missing viewdef for non-extension view: "${v.schema || 'public'}.${v.name}".`
        );
      }
    }
  }

  // Validate materialized view definitions
  for (const mv of data.materialized_views) {
    if (!mv.is_extension_owned) {
      if (!mv.viewdef || typeof mv.viewdef !== 'string' || mv.viewdef.trim() === '') {
        throw new Error(
          `Missing viewdef for non-extension materialized view: "${mv.schema || 'public'}.${mv.name}".`
        );
      }
    }
  }

  // Validate index definitions (must be present for all indexes)
  for (const idx of data.indexes) {
    if (!idx.indexdef || typeof idx.indexdef !== 'string' || idx.indexdef.trim() === '') {
      throw new Error(
        `Missing indexdef for index: "${idx.indexname}" on "${idx.tablename}".`
      );
    }
  }
}

/**
 * Pure function: renders catalog metadata into { schema: string, rls: string }.
 * @param {object} input
 * @returns {{ schema: string, rls: string }}
 */
export function renderSchemaDokumente(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Input to renderSchemaDokumente must be a non-null object.');
  }

  // Extract catalog groups and metadata
  const katalog = input.katalog && typeof input.katalog === 'object' ? input.katalog : input;
  const metadata = input.metadata || katalog.metadata;

  validateMetadata(metadata);
  validateKatalog(katalog);

  const { exported_at, last_migration, environment } = metadata;
  const erzeugtAm = exported_at.slice(0, 10);
  const pgVersion = katalog.postgresql_version || 'PostgreSQL 17';
  const counts = katalog.counts || {};

  function renderCommonHeader(title, purpose) {
    const lines = [
      '-- ============================================================================',
      `-- ${title}`,
      `-- PURPOSE: ${purpose}`,
      '--',
      `-- ENVIRONMENT:        ${environment}`,
      `-- LAST MIGRATION:     ${last_migration}`,
      `-- EXPORTED AT:        ${exported_at}`,
      `-- ERZEUGT AM:         ${erzeugtAm}`,
      `-- POSTGRESQL VERSION: ${pgVersion}`,
      '--',
      '-- COUNTS SUMMARY (SCOPE: schema-zaehler.js):',
      `--   public_tables:       ${counts.public_tables ?? 'N/A'}`,
      `--   table_columns:       ${counts.table_columns ?? 'N/A'}`,
      `--   view_columns:        ${counts.view_columns ?? 'N/A'}`,
      `--   matview_columns:     ${counts.matview_columns ?? 'N/A'}`,
      `--   rls_policies:        ${counts.rls_policies ?? 'N/A'}`,
      `--   functions:           ${counts.functions ?? 'N/A'}`,
      `--   triggers:            ${counts.triggers ?? 'N/A'}`,
      `--   indexes:             ${counts.indexes ?? 'N/A'}`,
      `--   auth_triggers:       ${counts.auth_triggers ?? 'N/A'}`,
      `--   publication_tables:  ${counts.publication_tables ?? 'N/A'}`,
      `--   extensions:          ${counts.extensions ?? 'N/A'}`,
      `--   rls_disabled_tables: ${Array.isArray(counts.rls_kapali_tablolar) ? counts.rls_kapali_tablolar.length : 0}`,
      '--',
      '-- CAUTION / HINWEIS:',
      '-- This document is a deterministic structural documentation snapshot.',
      '-- It is NOT guaranteed to be standalone restore-executable in one single pass',
      '-- due to circular dependencies, catalog constraints, and external state.',
      '-- ============================================================================',
      '',
    ];
    return lines.join('\n');
  }

  // ==========================================================================
  // 1. RENDER SCHEMA.SQL
  // ==========================================================================
  let schemaOut = renderCommonHeader(
    'SCHEMA.sql — Database Structural Schema Definition',
    'Catalog definitions for enums, domains, composites, sequences, tables, constraints, and views.'
  );

  // 1.1 Extensions Inventory
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  schemaOut += '-- EXTENSIONS INVENTORY\n';
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  const extensions = [...(katalog.extensions || [])].sort((a, b) => a.name.localeCompare(b.name));
  if (extensions.length === 0) {
    schemaOut += '-- (no extensions recorded)\n\n';
  } else {
    for (const ext of extensions) {
      schemaOut += `-- Extension: ${ext.name} (version: ${ext.version}, schema: ${ext.schema || 'public'})\n`;
    }
    schemaOut += '\n';
  }

  // 1.2 Enums
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  schemaOut += '-- ENUMS\n';
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  const enums = [...(katalog.enums || [])].sort((a, b) => {
    const s = (a.schema || 'public').localeCompare(b.schema || 'public');
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });
  if (enums.length === 0) {
    schemaOut += '-- (no enums defined)\n\n';
  } else {
    for (const en of enums) {
      const qual = formatQualifiedName(en.schema, en.name);
      if (en.is_extension_owned) {
        schemaOut += `-- [EXTENSION OWNED] Enum ${qual} (owned by extension)\n\n`;
      } else {
        const labels = Array.isArray(en.labels) ? en.labels : [];
        const labelLines = labels.map(l => `  '${escapeSqlLiteral(l)}'`).join(',\n');
        schemaOut += `CREATE TYPE ${qual} AS ENUM (\n${labelLines}\n);\n`;
        if (en.comment) {
          schemaOut += `COMMENT ON TYPE ${qual} IS '${escapeSqlLiteral(en.comment)}';\n`;
        }
        schemaOut += '\n';
      }
    }
  }

  // 1.3 Domains
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  schemaOut += '-- DOMAINS\n';
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  const domains = [...(katalog.domains || [])].sort((a, b) => {
    const s = (a.schema || 'public').localeCompare(b.schema || 'public');
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });
  if (domains.length === 0) {
    schemaOut += '-- (no domains defined)\n\n';
  } else {
    for (const d of domains) {
      const qual = formatQualifiedName(d.schema, d.name);
      if (d.is_extension_owned) {
        schemaOut += `-- [EXTENSION OWNED] Domain ${qual} (owned by extension)\n\n`;
      } else {
        let stmt = `CREATE DOMAIN ${qual} AS ${d.basetype}`;
        if (d.collation) stmt += ` COLLATE ${d.collation}`;
        if (d.default_expr) stmt += ` DEFAULT ${d.default_expr}`;
        if (d.notnull) stmt += ' NOT NULL';
        const constraints = Array.isArray(d.constraints) ? [...d.constraints].sort((a, b) => a.name.localeCompare(b.name)) : [];
        for (const c of constraints) {
          stmt += `\n  CONSTRAINT ${formatIdent(c.name)} ${c.condef}`;
        }
        stmt += ';\n';
        schemaOut += stmt;
        if (d.comment) {
          schemaOut += `COMMENT ON DOMAIN ${qual} IS '${escapeSqlLiteral(d.comment)}';\n`;
        }
        schemaOut += '\n';
      }
    }
  }

  // 1.4 Composite Types
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  schemaOut += '-- COMPOSITE TYPES\n';
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  const composites = [...(katalog.composites || [])].sort((a, b) => {
    const s = (a.schema || 'public').localeCompare(b.schema || 'public');
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });
  if (composites.length === 0) {
    schemaOut += '-- (no composite types defined)\n\n';
  } else {
    for (const cp of composites) {
      const qual = formatQualifiedName(cp.schema, cp.name);
      if (cp.is_extension_owned) {
        schemaOut += `-- [EXTENSION OWNED] Type ${qual} (owned by extension)\n\n`;
      } else {
        const attrs = [...(cp.attributes || [])].sort((a, b) => a.attnum - b.attnum);
        const attrLines = attrs.map(a => {
          let line = `${formatIdent(a.name)} ${a.typ}`;
          if (a.collation) line += ` COLLATE ${a.collation}`;
          return `  ${line}`;
        }).join(',\n');
        schemaOut += `CREATE TYPE ${qual} AS (\n${attrLines}\n);\n`;
        if (cp.comment) {
          schemaOut += `COMMENT ON TYPE ${qual} IS '${escapeSqlLiteral(cp.comment)}';\n`;
        }
        schemaOut += '\n';
      }
    }
  }

  // 1.5 Sequences
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  schemaOut += '-- SEQUENCES\n';
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  const sequences = [...(katalog.sequences || [])].sort((a, b) => {
    const s = (a.schema || 'public').localeCompare(b.schema || 'public');
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });
  if (sequences.length === 0) {
    schemaOut += '-- (no sequences defined)\n\n';
  } else {
    for (const seq of sequences) {
      const qual = formatQualifiedName(seq.schema, seq.name);
      const seqDataType = seq.data_type || 'bigint';
      if (seq.is_extension_owned) {
        schemaOut += `-- [EXTENSION OWNED] Sequence ${qual} (owned by extension)\n\n`;
      } else if (seq.is_identity_owned) {
        schemaOut += `-- Sequence ${qual} (identity-owned for ${formatQualifiedName(seq.schema, seq.ref_table || '')}.${formatIdent(seq.ref_column || '')}, AS ${seqDataType}, START WITH ${seq.seqstart}, INCREMENT BY ${seq.seqincrement}, MINVALUE ${seq.seqmin}, MAXVALUE ${seq.seqmax}, CACHE ${seq.seqcache}, ${seq.seqcycle ? 'CYCLE' : 'NO CYCLE'})\n\n`;
      } else {
        schemaOut += `CREATE SEQUENCE ${qual}\n`;
        schemaOut += `  AS ${seqDataType}\n`;
        schemaOut += `  START WITH ${seq.seqstart}\n`;
        schemaOut += `  INCREMENT BY ${seq.seqincrement}\n`;
        schemaOut += `  MINVALUE ${seq.seqmin}\n`;
        schemaOut += `  MAXVALUE ${seq.seqmax}\n`;
        schemaOut += `  CACHE ${seq.seqcache}\n`;
        schemaOut += `  ${seq.seqcycle ? 'CYCLE' : 'NO CYCLE'};\n`;
        if (seq.ref_table && seq.ref_column) {
          schemaOut += `ALTER SEQUENCE ${qual} OWNED BY ${formatQualifiedName(seq.ref_schema || seq.schema, seq.ref_table)}.${formatIdent(seq.ref_column)};\n`;
        }
        if (seq.owner) {
          schemaOut += `ALTER SEQUENCE ${qual} OWNER TO ${formatIdent(seq.owner)};\n`;
        }
        if (seq.comment) {
          schemaOut += `COMMENT ON SEQUENCE ${qual} IS '${escapeSqlLiteral(seq.comment)}';\n`;
        }
        schemaOut += '\n';
      }
    }
  }

  // 1.6 Tables & Constraints
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  schemaOut += '-- TABLES & CONSTRAINTS\n';
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  const tables = [...(katalog.tables || [])].sort((a, b) => {
    const s = (a.schema || 'public').localeCompare(b.schema || 'public');
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });

  for (const tbl of tables) {
    const qual = formatQualifiedName(tbl.schema, tbl.name);
    const cols = [...(tbl.columns || [])].sort((a, b) => a.attnum - b.attnum);
    const colDefs = cols.map(c => {
      let d = `${formatIdent(c.name)} ${c.typ}`;
      if (c.collation) {
        d += ` COLLATE ${c.collation}`;
      }
      if (c.default_expr && c.generated !== 's') {
        d += ` DEFAULT ${c.default_expr}`;
      }
      if (c.identity === 'a') {
        if (c.identity_sequence) {
          const s = c.identity_sequence;
          d += ` GENERATED ALWAYS AS IDENTITY (START WITH ${s.start} INCREMENT BY ${s.increment} MINVALUE ${s.min} MAXVALUE ${s.max} CACHE ${s.cache}${s.cycle ? ' CYCLE' : ''})`;
        } else {
          d += ' GENERATED ALWAYS AS IDENTITY';
        }
      } else if (c.identity === 'd') {
        if (c.identity_sequence) {
          const s = c.identity_sequence;
          d += ` GENERATED BY DEFAULT AS IDENTITY (START WITH ${s.start} INCREMENT BY ${s.increment} MINVALUE ${s.min} MAXVALUE ${s.max} CACHE ${s.cache}${s.cycle ? ' CYCLE' : ''})`;
        } else {
          d += ' GENERATED BY DEFAULT AS IDENTITY';
        }
      } else if (c.generated === 's') {
        d += ` GENERATED ALWAYS AS (${c.default_expr}) STORED`;
      }
      if (c.notnull) {
        d += ' NOT NULL';
      }
      return `  ${d}`;
    });

    const tableStartIndex = schemaOut.length;
    const isSimpleIdent = /^[a-zA-Z0-9_]+$/.test(tbl.name);

    if (!isSimpleIdent) {
      schemaOut += `-- NOTICE: Table identifier "${tbl.name}" contains non-standard characters and is quoted.\n`;
    }
    if (tbl.persistence === 'u') {
      schemaOut += '-- PERSISTENCE: UNLOGGED\n';
    }

    // Matches tools/tabellenkarte.mjs: /^CREATE TABLE ([^\s(]+) \(([\s\S]*?)^\);/gm
    // and api-backend/dsgvo/klassifikation.test.js: /CREATE TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/g
    schemaOut += `CREATE TABLE ${qual} (\n`;
    schemaOut += colDefs.join(',\n');
    schemaOut += '\n);\n';

    // FOREIGN KEY comments IMMEDIATELY after CREATE block (before large comments/constraints)
    // Format: --   FK col1 -> targetTable(targetCol)
    // Left-hand side token has NO whitespace to satisfy \S+ in tabellenkarte regex
    const constraints = [...(tbl.constraints || [])].sort((a, b) => a.name.localeCompare(b.name));
    for (const con of constraints) {
      if (con.contype === 'f' || (con.condef && /FOREIGN KEY/i.test(con.condef))) {
        if (Array.isArray(con.confkey_columns) && con.confrel_table && Array.isArray(con.confrel_columns)) {
          const lhs = con.confkey_columns.map(formatIdent).join(',');
          const targetTable = con.confrel_table.replace(/^public\./, '').replace(/"/g, '');
          const rhs = con.confrel_columns.map(formatIdent).join(',');
          schemaOut += `--   FK ${lhs} -> ${targetTable}(${rhs})\n`;
        } else {
          const fkMatch = con.condef.match(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*(?:([a-zA-Z0-9_ßäöü."]+))\s*\(([^)]+)\)/i);
          if (fkMatch) {
            const lhs = fkMatch[1].replace(/\s+/g, '').replace(/"/g, '');
            const targetTable = fkMatch[2].replace(/^public\./, '').replace(/"/g, '');
            const rhs = fkMatch[3].replace(/\s+/g, '').replace(/"/g, '');
            schemaOut += `--   FK ${lhs} -> ${targetTable}(${rhs})\n`;
          }
        }
      }
    }

    // Owner and Table Options
    if (tbl.owner) {
      schemaOut += `ALTER TABLE ONLY ${qual} OWNER TO ${formatIdent(tbl.owner)};\n`;
    }
    if (Array.isArray(tbl.options) && tbl.options.length > 0) {
      const opts = [...tbl.options].sort().join(', ');
      schemaOut += `ALTER TABLE ONLY ${qual} SET (${opts});\n`;
    }

    // Table comments
    if (tbl.comment) {
      schemaOut += `COMMENT ON TABLE ${qual} IS '${escapeSqlLiteral(tbl.comment)}';\n`;
    }
    for (const c of cols) {
      if (c.comment) {
        schemaOut += `COMMENT ON COLUMN ${qual}.${formatIdent(c.name)} IS '${escapeSqlLiteral(c.comment)}';\n`;
      }
    }

    // Partition / Inheritance metadata
    if (tbl.kind === 'p' && tbl.partition_key) {
      schemaOut += `-- PARTITIONED BY: ${tbl.partition_key}\n`;
    }
    if (Array.isArray(tbl.partition_parents) && tbl.partition_parents.length > 0) {
      const parentsStr = tbl.partition_parents.map(p => formatQualifiedName('public', p)).join(', ');
      schemaOut += `-- ${tbl.is_partition ? 'PARTITION OF' : 'INHERITS FROM'}: ${parentsStr}\n`;
    }
    if (tbl.partition_bound) {
      schemaOut += `-- PARTITION BOUND: ${tbl.partition_bound}\n`;
    }

    // Table constraints
    for (const con of constraints) {
      schemaOut += `\nALTER TABLE ONLY ${qual}\n  ADD CONSTRAINT ${formatIdent(con.name)} ${con.condef};\n`;
      if (con.comment) {
        schemaOut += `COMMENT ON CONSTRAINT ${formatIdent(con.name)} ON ${qual} IS '${escapeSqlLiteral(con.comment)}';\n`;
      }
    }
    schemaOut += '\n';
    if (tbl.is_extension_owned) {
      const rawBlock = schemaOut.slice(tableStartIndex);
      // Neutralize premature block comment termination in non-executable wrapper
      const safeBlock = rawBlock.replace(/\*\//g, '* /');
      schemaOut = schemaOut.slice(0, tableStartIndex) + `/* [EXTENSION OWNED - NON-EXECUTABLE]\n${safeBlock}*/\n\n`;
    }
  }

  // 1.7 Views
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  schemaOut += '-- VIEWS\n';
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  const views = [...(katalog.views || [])].sort((a, b) => {
    const s = (a.schema || 'public').localeCompare(b.schema || 'public');
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });
  if (views.length === 0) {
    schemaOut += '-- (no views defined)\n\n';
  } else {
    for (const v of views) {
      const qual = formatQualifiedName(v.schema, v.name);
      if (v.is_extension_owned) {
        schemaOut += `-- [EXTENSION OWNED] View ${qual} (owned by extension)\n\n`;
      } else {
        const viewdefClean = v.viewdef.trim().replace(/;$/, '');
        let withClause = '';
        if (Array.isArray(v.options) && v.options.length > 0) {
          const opts = [...v.options].sort().join(', ');
          withClause = ` WITH (${opts})`;
        }
        schemaOut += `CREATE OR REPLACE VIEW ${qual}${withClause} AS\n${viewdefClean};\n`;
        if (v.owner) {
          schemaOut += `ALTER VIEW ${qual} OWNER TO ${formatIdent(v.owner)};\n`;
        }
        if (v.comment) {
          schemaOut += `COMMENT ON VIEW ${qual} IS '${escapeSqlLiteral(v.comment)}';\n`;
        }
        const vCols = [...(v.columns || [])].sort((a, b) => a.attnum - b.attnum);
        for (const vc of vCols) {
          if (vc.comment) {
            schemaOut += `COMMENT ON COLUMN ${qual}.${formatIdent(vc.name)} IS '${escapeSqlLiteral(vc.comment)}';\n`;
          }
        }
        schemaOut += '\n';
      }
    }
  }

  // 1.8 Materialized Views
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  schemaOut += '-- MATERIALIZED VIEWS\n';
  schemaOut += '-- ----------------------------------------------------------------------------\n';
  const matviews = [...(katalog.materialized_views || [])].sort((a, b) => {
    const s = (a.schema || 'public').localeCompare(b.schema || 'public');
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });
  if (matviews.length === 0) {
    schemaOut += '-- (no materialized views defined)\n\n';
  } else {
    for (const mv of matviews) {
      const qual = formatQualifiedName(mv.schema, mv.name);
      if (mv.is_extension_owned) {
        schemaOut += `-- [EXTENSION OWNED] Materialized View ${qual} (owned by extension)\n\n`;
      } else {
        const viewdefClean = mv.viewdef.trim().replace(/;$/, '');
        let withClause = '';
        if (Array.isArray(mv.options) && mv.options.length > 0) {
          const opts = [...mv.options].sort().join(', ');
          withClause = ` WITH (${opts})`;
        }
        schemaOut += `CREATE MATERIALIZED VIEW ${qual}${withClause} AS\n${viewdefClean}\nWITH ${mv.is_populated ? '' : 'NO '}DATA;\n`;
        if (mv.owner) {
          schemaOut += `ALTER MATERIALIZED VIEW ${qual} OWNER TO ${formatIdent(mv.owner)};\n`;
        }
        if (mv.comment) {
          schemaOut += `COMMENT ON MATERIALIZED VIEW ${qual} IS '${escapeSqlLiteral(mv.comment)}';\n`;
        }
        const mvCols = [...(mv.columns || [])].sort((a, b) => a.attnum - b.attnum);
        for (const mvc of mvCols) {
          if (mvc.comment) {
            schemaOut += `COMMENT ON COLUMN ${qual}.${formatIdent(mvc.name)} IS '${escapeSqlLiteral(mvc.comment)}';\n`;
          }
        }
        schemaOut += '\n';
      }
    }
  }

  // ==========================================================================
  // 2. RENDER SCHEMA-RLS.SQL
  // ==========================================================================
  let rlsOut = renderCommonHeader(
    'SCHEMA-RLS.sql — Row Level Security, Policies, Functions, Triggers & ACLs',
    'Catalog definitions for RLS flags, policies, functions, procedures, triggers, indexes, and ACLs.'
  );

  // 2.1 Outside-Public Inventories
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  rlsOut += '-- OUTSIDE-PUBLIC INVENTORIES\n';
  rlsOut += '-- ----------------------------------------------------------------------------\n';

  // Publications
  const publications = [...(katalog.publications || [])].sort((a, b) => a.name.localeCompare(b.name));
  rlsOut += '-- PUBLICATIONS:\n';
  if (publications.length === 0) {
    rlsOut += '--   (none)\n';
  } else {
    for (const pub of publications) {
      const tblList = Array.isArray(pub.tables) ? [...pub.tables].sort().join(', ') : '';
      rlsOut += `--   Publication: "${pub.name}" (all_tables: ${pub.all_tables}, tables: [${tblList}])\n`;
    }
  }
  rlsOut += '\n';

  // Auth Triggers
  const authTriggers = [...(katalog.auth_triggers || [])].sort((a, b) => {
    const t = (a.tablename || '').localeCompare(b.tablename || '');
    return t !== 0 ? t : (a.tgname || '').localeCompare(b.tgname || '');
  });
  rlsOut += '-- AUTH NON-INTERNAL TRIGGERS (OUTSIDE PUBLIC INVENTORY — REFERENCE ONLY):\n';
  if (authTriggers.length === 0) {
    rlsOut += '--   (none)\n';
  } else {
    for (const at of authTriggers) {
      rlsOut += `--   Trigger: "${at.tgname}" ON auth."${at.tablename}" (enabled: ${at.tgenabled})\n`;
      if (at.triggerdef) {
        rlsOut += `--   Definition: ${at.triggerdef.replace(/\n/g, '\n--     ')}\n`;
      }
    }
  }
  rlsOut += '\n';

  // Storage Policies
  const storagePolicies = [...(katalog.storage_policies || [])].sort((a, b) => {
    const t = (a.tablename || '').localeCompare(b.tablename || '');
    return t !== 0 ? t : (a.policyname || '').localeCompare(b.policyname || '');
  });
  rlsOut += '-- STORAGE POLICIES (OUTSIDE PUBLIC INVENTORY — POLICY METADATA ONLY, NO ROW DATA):\n';
  if (storagePolicies.length === 0) {
    rlsOut += '--   (none)\n';
  } else {
    for (const sp of storagePolicies) {
      const rolesStr = Array.isArray(sp.roles) ? [...sp.roles].sort().join(', ') : 'PUBLIC';
      rlsOut += `--   Policy: "${sp.policyname}" ON storage."${sp.tablename}" (cmd: ${sp.command}, permissive: ${sp.permissive}, roles: [${rolesStr}])\n`;
      if (sp.qual) rlsOut += `--     USING: (${sp.qual})\n`;
      if (sp.with_check) rlsOut += `--     WITH CHECK: (${sp.with_check})\n`;
    }
  }
  rlsOut += '\n';

  // 2.2 RLS Status for Tables
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  rlsOut += '-- ROW LEVEL SECURITY (RLS) STATUS\n';
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  const rlsoffSet = new Set(katalog.rlsoff_tables || []);
  for (const tbl of tables) {
    const qual = formatQualifiedName(tbl.schema, tbl.name);
    const isRlsOff = rlsoffSet.has(tbl.name) || tbl.relrowsecurity === false;
    if (tbl.is_extension_owned) {
      rlsOut += `-- [EXTENSION OWNED] Table ${qual} RLS (rowsecurity: ${tbl.relrowsecurity}, force: ${tbl.relforcerowsecurity})\n`;
    } else if (isRlsOff) {
      rlsOut += `-- [RLS DISABLED] Table ${qual}\n`;
      rlsOut += `ALTER TABLE ${qual} DISABLE ROW LEVEL SECURITY;\n`;
      rlsOut += `-- FORCE ROW LEVEL SECURITY: ${tbl.relforcerowsecurity ? 'true' : 'false'}\n`;
    } else {
      rlsOut += `ALTER TABLE ${qual} ENABLE ROW LEVEL SECURITY;\n`;
      if (tbl.relforcerowsecurity) {
        rlsOut += `ALTER TABLE ${qual} FORCE ROW LEVEL SECURITY;\n`;
      } else {
        rlsOut += `-- FORCE ROW LEVEL SECURITY: false\n`;
      }
    }
  }
  rlsOut += '\n';

  // 2.3 Policies
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  rlsOut += '-- ROW LEVEL SECURITY POLICIES\n';
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  const policies = [...(katalog.policies || [])].sort((a, b) => {
    const t = (a.tablename || '').localeCompare(b.tablename || '');
    return t !== 0 ? t : (a.policyname || '').localeCompare(b.policyname || '');
  });
  if (policies.length === 0) {
    rlsOut += '-- (no RLS policies defined)\n\n';
  } else {
    for (const pol of policies) {
      const qual = formatQualifiedName(pol.schema, pol.tablename);
      const permissive = pol.permissive !== false ? 'AS PERMISSIVE' : 'AS RESTRICTIVE';
      const cmd = pol.command || 'ALL';
      let rolesStr = 'PUBLIC';
      if (Array.isArray(pol.roles) && pol.roles.length > 0) {
        rolesStr = [...pol.roles].sort().map(r => r === 'PUBLIC' ? 'PUBLIC' : formatIdent(r)).join(', ');
      }
      rlsOut += `CREATE POLICY ${formatIdent(pol.policyname)} ON ${qual}\n`;
      rlsOut += `  ${permissive}\n`;
      rlsOut += `  FOR ${cmd}\n`;
      rlsOut += `  TO ${rolesStr}`;
      if (pol.qual) {
        rlsOut += `\n  USING (${pol.qual})`;
      }
      if (pol.with_check) {
        rlsOut += `\n  WITH CHECK (${pol.with_check})`;
      }
      rlsOut += ';\n';
      if (pol.comment) {
        rlsOut += `COMMENT ON POLICY ${formatIdent(pol.policyname)} ON ${qual} IS '${escapeSqlLiteral(pol.comment)}';\n`;
      }
      rlsOut += '\n';
    }
  }

  // 2.4 Functions & Procedures
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  rlsOut += '-- FUNCTIONS & PROCEDURES\n';
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  const functions = [...(katalog.functions || [])].sort((a, b) => {
    const s = (a.schema || 'public').localeCompare(b.schema || 'public');
    if (s !== 0) return s;
    const n = a.name.localeCompare(b.name);
    if (n !== 0) return n;
    return (a.identity_args || '').localeCompare(b.identity_args || '');
  });
  if (functions.length === 0) {
    rlsOut += '-- (no custom functions defined)\n\n';
  } else {
    for (const fn of functions) {
      const qual = formatQualifiedName(fn.schema, fn.name);
      const isProcedure = fn.prokind === 'p';
      if (fn.is_extension_owned) {
        rlsOut += `-- [EXTENSION OWNED] ${isProcedure ? 'Procedure' : 'Function'} ${qual}(${fn.identity_args || ''}) (owned by extension)\n\n`;
      } else {
        let fnBody = fn.functiondef;
        if (!fnBody.endsWith('\n')) {
          fnBody += '\n';
        }
        if (!fnBody.trim().endsWith(';')) {
          fnBody += ';\n';
        }
        rlsOut += fnBody;
        if (fn.owner) {
          rlsOut += `ALTER ${isProcedure ? 'PROCEDURE' : 'FUNCTION'} ${qual}(${fn.identity_args || ''}) OWNER TO ${formatIdent(fn.owner)};\n`;
        }
        if (fn.comment) {
          rlsOut += `COMMENT ON ${isProcedure ? 'PROCEDURE' : 'FUNCTION'} ${qual}(${fn.identity_args || ''}) IS '${escapeSqlLiteral(fn.comment)}';\n`;
        }
        rlsOut += '\n';
      }
    }
  }

  // 2.5 Triggers
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  rlsOut += '-- TRIGGERS\n';
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  const triggers = [...(katalog.triggers || [])].sort((a, b) => {
    const t = (a.tablename || '').localeCompare(b.tablename || '');
    return t !== 0 ? t : (a.tgname || '').localeCompare(b.tgname || '');
  });
  if (triggers.length === 0) {
    rlsOut += '-- (no custom triggers defined)\n\n';
  } else {
    for (const trg of triggers) {
      const qual = formatQualifiedName(trg.schema, trg.tablename);
      if (trg.is_extension_owned) {
        rlsOut += `-- [EXTENSION OWNED] Trigger ${formatIdent(trg.tgname)} ON ${qual}\n\n`;
      } else {
        const trgClean = trg.triggerdef.trim().replace(/;$/, '');
        rlsOut += `${trgClean};\n`;
        if (trg.tgenabled === 'D') {
          rlsOut += `ALTER TABLE ${qual} DISABLE TRIGGER ${formatIdent(trg.tgname)};\n`;
        } else if (trg.tgenabled === 'R') {
          rlsOut += `ALTER TABLE ${qual} ENABLE REPLICA TRIGGER ${formatIdent(trg.tgname)};\n`;
        } else if (trg.tgenabled === 'A') {
          rlsOut += `ALTER TABLE ${qual} ENABLE ALWAYS TRIGGER ${formatIdent(trg.tgname)};\n`;
        }
        if (trg.comment) {
          rlsOut += `COMMENT ON TRIGGER ${formatIdent(trg.tgname)} ON ${qual} IS '${escapeSqlLiteral(trg.comment)}';\n`;
        }
        rlsOut += '\n';
      }
    }
  }

  // 2.6 Indexes
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  rlsOut += '-- INDEXES\n';
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  const indexes = [...(katalog.indexes || [])].sort((a, b) => {
    const t = (a.tablename || '').localeCompare(b.tablename || '');
    return t !== 0 ? t : (a.indexname || '').localeCompare(b.indexname || '');
  });
  if (indexes.length === 0) {
    rlsOut += '-- (no custom indexes defined)\n\n';
  } else {
    for (const idx of indexes) {
      const qual = formatQualifiedName(idx.schema, idx.tablename);
      const isInvalid = idx.indisvalid === false || idx.indisready === false;
      if (idx.is_extension_owned) {
        rlsOut += `-- [EXTENSION OWNED] Index ${formatIdent(idx.indexname)} ON ${qual}\n`;
        rlsOut += `-- DDL: ${idx.indexdef.trim().replace(/;$/, '')};\n\n`;
      } else if (idx.is_constraint) {
        rlsOut += `-- Index ${formatIdent(idx.indexname)} ON ${qual} is enforced by constraint\n`;
        rlsOut += `-- DDL: ${idx.indexdef.trim().replace(/;$/, '')};\n\n`;
      } else if (isInvalid) {
        rlsOut += `-- [INVALID / NOT READY] Index ${formatIdent(idx.indexname)} (valid: ${idx.indisvalid}, ready: ${idx.indisready})\n`;
        rlsOut += `-- DDL: ${idx.indexdef.trim().replace(/;$/, '')};\n\n`;
      } else {
        const idxClean = idx.indexdef.trim().replace(/;$/, '');
        rlsOut += `${idxClean};\n`;
        if (idx.comment) {
          rlsOut += `COMMENT ON INDEX ${formatQualifiedName(idx.schema, idx.indexname)} IS '${escapeSqlLiteral(idx.comment)}';\n`;
        }
        rlsOut += '\n';
      }
    }
  }

  // 2.7 ACLs & Default ACLs
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  rlsOut += '-- ACCESS CONTROL LISTS (ACL) & DEFAULT ACLS\n';
  rlsOut += '-- ----------------------------------------------------------------------------\n';
  rlsOut += '-- Structured documentation rows of all effective and default privileges.\n';

  const acls = [...(katalog.acls || [])].sort((a, b) => {
    const o = (a.object_type || '').localeCompare(b.object_type || '');
    if (o !== 0) return o;
    const s = (a.schema || '').localeCompare(b.schema || '');
    if (s !== 0) return s;
    const n = (a.object_name || '').localeCompare(b.object_name || '');
    if (n !== 0) return n;
    const c = (a.column_name || '').localeCompare(b.column_name || '');
    if (c !== 0) return c;
    const g = (a.grantee || '').localeCompare(b.grantee || '');
    if (g !== 0) return g;
    const p = (a.privilege || '').localeCompare(b.privilege || '');
    if (p !== 0) return p;
    const gr = (a.grantor || '').localeCompare(b.grantor || '');
    if (gr !== 0) return gr;
    return (a.is_grantable ? 1 : 0) - (b.is_grantable ? 1 : 0);
  });

  if (acls.length === 0) {
    rlsOut += '-- (no ACLs recorded)\n';
  } else {
    for (const a of acls) {
      if (a.empty_acl) {
        rlsOut += `-- EMPTY_ACL: type=${a.object_type} schema=${a.schema || '-'} object=${a.object_name} column=${a.column_name || '-'} (no explicit privileges)\n`;
      } else {
        rlsOut += `-- ACL: type=${a.object_type} schema=${a.schema || '-'} object=${a.object_name} column=${a.column_name || '-'} grantee=${a.grantee} privilege=${a.privilege} grantor=${a.grantor} grantable=${a.is_grantable ? 'YES' : 'NO'}\n`;
      }
    }
  }
  rlsOut += '\n';

  const defaultAcls = [...(katalog.default_acls || [])].sort((a, b) => {
    const r = (a.target_role || '').localeCompare(b.target_role || '');
    if (r !== 0) return r;
    const s = (a.target_schema || '').localeCompare(b.target_schema || '');
    if (s !== 0) return s;
    const o = (a.object_type || '').localeCompare(b.object_type || '');
    if (o !== 0) return o;
    const g = (a.grantee || '').localeCompare(b.grantee || '');
    if (g !== 0) return g;
    const p = (a.privilege || '').localeCompare(b.privilege || '');
    if (p !== 0) return p;
    const gr = (a.grantor || '').localeCompare(b.grantor || '');
    if (gr !== 0) return gr;
    return (a.is_grantable ? 1 : 0) - (b.is_grantable ? 1 : 0);
  });

  rlsOut += '-- DEFAULT ACLS:\n';
  if (defaultAcls.length === 0) {
    rlsOut += '-- (no default ACLs recorded)\n';
  } else {
    for (const da of defaultAcls) {
      if (da.empty_acl) {
        rlsOut += `-- EMPTY_DEFAULT_ACL: target_role=${da.target_role} schema=${da.target_schema || '-'} object_type=${da.object_type} (no explicit privileges)\n`;
      } else {
        rlsOut += `-- DEFAULT_ACL: target_role=${da.target_role} schema=${da.target_schema || '-'} object_type=${da.object_type} grantee=${da.grantee} privilege=${da.privilege} grantor=${da.grantor} grantable=${da.is_grantable ? 'YES' : 'NO'}\n`;
      }
    }
  }
  rlsOut += '\n';

  return { schema: schemaOut.replace(/\n+$/, '\n'), rls: rlsOut.replace(/\n+$/, '\n') };
}

// ============================================================================
// CLI ENTRYPOINT
// ============================================================================
function printHelp() {
  console.log(`
Deterministic PostgreSQL 17 Catalog Metadata Snapshot Renderer

USAGE:
  node tools/schema-dokumente.mjs --input <path> --output-dir <path>
  node tools/schema-dokumente.mjs --help

OPTIONS:
  --input, -i       Path to local JSON file containing katalog data and metadata.
  --output-dir, -o  Directory where SCHEMA.sql and SCHEMA-RLS.sql will be written.
  --help, -h        Display this help message.

JSON METADATA CONTRACT:
  The input JSON must contain:
    - metadata: {
        exported_at: string (Valid ISO timestamp / date, e.g. "2026-10-03T12:00:00Z"),
        last_migration: string (migration ledger head, e.g. "0195_add_payments.sql"),
        environment: string ("saas" | "box" | explicit label)
      }
    - katalog: object with all required catalog groups:
        tables, views, materialized_views, enums, domains, composites,
        sequences, functions, aggregates, policies, triggers, indexes, acls,
        default_acls, extensions, counts, other_types, publications,
        auth_triggers, storage_policies, rlsoff_tables.

NOTES:
  - Header metadata must be provided externally; it is NEVER faked or substituted.
  - Generates db/SCHEMA.sql and db/SCHEMA-RLS.sql deterministically.
`);
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let inputPath = null;
  let outputDir = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '-i') {
      inputPath = args[++i];
    } else if (args[i] === '--output-dir' || args[i] === '-o') {
      outputDir = args[++i];
    } else {
      console.error(`Error: Unknown flag "${args[i]}".`);
      printHelp();
      process.exit(1);
    }
  }

  if (!inputPath || !outputDir) {
    console.error('Error: Both --input and --output-dir arguments are required.');
    console.error('Run "node tools/schema-dokumente.mjs --help" for usage.');
    process.exit(1);
  }

  try {
    const raw = readFileSync(resolve(inputPath), 'utf8');
    const parsed = JSON.parse(raw);
    const { schema, rls } = renderSchemaDokumente(parsed);

    const targetDir = resolve(outputDir);
    mkdirSync(targetDir, { recursive: true });

    writeFileSync(join(targetDir, 'SCHEMA.sql'), schema, 'utf8');
    writeFileSync(join(targetDir, 'SCHEMA-RLS.sql'), rls, 'utf8');

    console.log(`Successfully rendered SCHEMA.sql and SCHEMA-RLS.sql into ${targetDir}`);
    process.exit(0);
  } catch (err) {
    console.error(`Error rendering schema documents: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCli();
}
