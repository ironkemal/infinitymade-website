-- ============================================================================
-- tools/schema-export-katalog.sql
-- Deterministic PostgreSQL 17 Catalog Metadata Snapshot Query
--
-- PURPOSE:
--   Extracts all public schema structural definition metadata, extensions,
--   access control lists (ACL), default ACLs, outside-public inventories
--   (auth non-internal trigger definitions, storage policies), and exact
--   structural counts in ONE single top-level SELECT statement.
--
-- SAFETY & INTEGRITY GUARANTEES:
--   1. SINGLE top-level SELECT (no CREATE, no ALTER, no DROP, no INSERT/UPDATE/DELETE).
--   2. Reads ONLY from pg_catalog and information_schema metadata tables.
--   3. Reads NO application row data, NO auth user records, and NO storage bucket table rows.
--   4. Does NOT read pg_sequences.last_value or is_called (avoids application state).
--   5. Excludes aggregates and window functions from pg_get_functiondef calls.
--   6. Deterministic ordering across all definition arrays.
--   7. Header metadata (exported_at, last_migration, environment) is NOT read from
--      any live migration ledger; it is supplied externally to the renderer.
-- ============================================================================

WITH
extension_deps AS (
  SELECT d.classid, d.objid
  FROM pg_depend d
  WHERE d.deptype = 'e'
),

meta AS (
  SELECT
    'praxura-catalog-v1'::text AS schema_format,
    current_setting('server_version') AS postgresql_version,
    current_setting('server_version_num')::integer AS postgresql_version_num
),

ext_inventory AS (
  SELECT
    e.extname AS name,
    e.extversion AS version,
    n.nspname AS schema,
    e.extrelocatable AS relocatable
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  ORDER BY e.extname
),

enum_types AS (
  SELECT
    t.oid,
    n.nspname AS schema,
    t.typname AS name,
    pg_get_userbyid(t.typowner) AS owner,
    obj_description(t.oid, 'pg_type') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid
    ) AS is_extension_owned,
    (
      SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder)
      FROM pg_enum e
      WHERE e.enumtypid = t.oid
    ) AS labels
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typtype = 'e'
  ORDER BY n.nspname, t.typname
),

domain_types AS (
  SELECT
    t.oid,
    n.nspname AS schema,
    t.typname AS name,
    format_type(t.typbasetype, t.typtypmod) AS basetype,
    t.typnotnull AS notnull,
    pg_get_expr(t.typdefaultbin, 0) AS default_expr,
    CASE
      WHEN t.typcollation != 0 AND t.typcollation != (SELECT b.typcollation FROM pg_type b WHERE b.oid = t.typbasetype)
      THEN (
        SELECT cn.nspname || '.' || quote_ident(coll.collname)
        FROM pg_collation coll
        JOIN pg_namespace cn ON cn.oid = coll.collnamespace
        WHERE coll.oid = t.typcollation
      )
      ELSE NULL
    END AS collation,
    pg_get_userbyid(t.typowner) AS owner,
    obj_description(t.oid, 'pg_type') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid
    ) AS is_extension_owned,
    COALESCE((
      SELECT json_agg(json_build_object(
        'name', c.conname,
        'condef', pg_get_constraintdef(c.oid, true),
        'comment', obj_description(c.oid, 'pg_constraint')
      ) ORDER BY c.conname)
      FROM pg_constraint c
      WHERE c.contypid = t.oid
    ), '[]'::json) AS constraints
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typtype = 'd'
  ORDER BY n.nspname, t.typname
),

composite_types AS (
  SELECT
    t.oid,
    n.nspname AS schema,
    t.typname AS name,
    pg_get_userbyid(t.typowner) AS owner,
    obj_description(t.oid, 'pg_type') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid
    ) AS is_extension_owned,
    COALESCE((
      SELECT json_agg(json_build_object(
        'attnum', a.attnum,
        'name', a.attname,
        'typ', format_type(a.atttypid, a.atttypmod),
        'collation', CASE
          WHEN a.attcollation != 0 AND a.attcollation != (SELECT bt.typcollation FROM pg_type bt WHERE bt.oid = a.atttypid)
          THEN (
            SELECT cn.nspname || '.' || quote_ident(coll.collname)
            FROM pg_collation coll
            JOIN pg_namespace cn ON cn.oid = coll.collnamespace
            WHERE coll.oid = a.attcollation
          )
          ELSE NULL
        END,
        'comment', col_description(c.oid, a.attnum)
      ) ORDER BY a.attnum)
      FROM pg_attribute a
      LEFT JOIN pg_collation coll ON coll.oid = a.attcollation
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    ), '[]'::json) AS attributes
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_class c ON c.oid = t.typrelid
  WHERE n.nspname = 'public' AND t.typtype = 'c' AND c.relkind = 'c'
  ORDER BY n.nspname, t.typname
),

other_custom_types AS (
  SELECT
    t.oid,
    n.nspname AS schema,
    t.typname AS name,
    t.typtype::text AS typtype,
    pg_get_userbyid(t.typowner) AS owner,
    obj_description(t.oid, 'pg_type') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid
    ) AS is_extension_owned
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  LEFT JOIN pg_class c ON c.oid = t.typrelid
  WHERE n.nspname = 'public'
    AND t.typtype NOT IN ('e', 'd')
    AND NOT (t.typtype = 'c' AND c.relkind = 'c')
    AND NOT (t.typtype = 'c' AND c.relkind IN ('r', 'p', 'v', 'm', 'S'))
    AND NOT (t.typelem != 0 AND EXISTS (SELECT 1 FROM pg_type el WHERE el.oid = t.typelem AND el.typarray = t.oid))
  ORDER BY n.nspname, t.typname
),

sequences_cte AS (
  SELECT
    c.oid,
    n.nspname AS schema,
    c.relname AS name,
    format_type(s.seqtypid, NULL) AS data_type,
    pg_get_userbyid(c.relowner) AS owner,
    obj_description(c.oid, 'pg_class') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
    ) AS is_extension_owned,
    s.seqstart::text AS seqstart,
    s.seqmin::text AS seqmin,
    s.seqmax::text AS seqmax,
    s.seqincrement::text AS seqincrement,
    s.seqcycle AS seqcycle,
    s.seqcache::text AS seqcache,
    dep.ref_schema,
    dep.ref_table,
    dep.ref_column,
    COALESCE(dep.is_identity, false) AS is_identity_owned
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_sequence s ON s.seqrelid = c.oid
  LEFT JOIN LATERAL (
    SELECT
      refn.nspname AS ref_schema,
      refc.relname AS ref_table,
      att.attname AS ref_column,
      (d.deptype = 'i') AS is_identity
    FROM pg_depend d
    JOIN pg_class refc ON refc.oid = d.refobjid
    JOIN pg_namespace refn ON refn.oid = refc.relnamespace
    JOIN pg_attribute att ON att.attrelid = d.refobjid AND att.attnum = d.refobjsubid
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = c.oid
      AND d.refclassid = 'pg_class'::regclass
      AND d.deptype IN ('a', 'i')
    LIMIT 1
  ) dep ON true
  WHERE n.nspname = 'public' AND c.relkind = 'S'
  ORDER BY n.nspname, c.relname
),

columns_cte AS (
  SELECT
    a.attrelid,
    json_agg(json_build_object(
      'attnum', a.attnum,
      'name', a.attname,
      'typ', format_type(a.atttypid, a.atttypmod),
      'notnull', a.attnotnull,
      'default_expr', pg_get_expr(ad.adbin, ad.adrelid),
      'identity', a.attidentity::text,
      'generated', a.attgenerated::text,
      'collation', CASE
        WHEN a.attcollation != 0 AND a.attcollation != (SELECT bt.typcollation FROM pg_type bt WHERE bt.oid = a.atttypid)
        THEN (
          SELECT cn.nspname || '.' || quote_ident(coll.collname)
          FROM pg_collation coll
          JOIN pg_namespace cn ON cn.oid = coll.collnamespace
          WHERE coll.oid = a.attcollation
        )
        ELSE NULL
      END,
      'comment', col_description(a.attrelid, a.attnum),
      'is_extension_owned', EXISTS (
        SELECT 1 FROM extension_deps d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = a.attrelid
      ),
      'identity_sequence', (
        SELECT json_build_object(
          'data_type', format_type(seq.seqtypid, NULL),
          'start', seq.seqstart::text,
          'min', seq.seqmin::text,
          'max', seq.seqmax::text,
          'increment', seq.seqincrement::text,
          'cycle', seq.seqcycle,
          'cache', seq.seqcache::text
        )
        FROM pg_depend d
        JOIN pg_sequence seq ON seq.seqrelid = d.objid
        WHERE d.classid = 'pg_class'::regclass
          AND d.refclassid = 'pg_class'::regclass
          AND d.refobjid = a.attrelid
          AND d.refobjsubid = a.attnum
          AND d.deptype = 'i'
        LIMIT 1
      )
    ) ORDER BY a.attnum) AS cols
  FROM pg_attribute a
  LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
  LEFT JOIN pg_collation coll ON coll.oid = a.attcollation
  WHERE a.attnum > 0 AND NOT a.attisdropped
  GROUP BY a.attrelid
),

table_constraints_cte AS (
  SELECT
    con.conrelid,
    json_agg(json_build_object(
      'name', con.conname,
      'contype', con.contype::text,
      'condef', pg_get_constraintdef(con.oid, true),
      'convalidated', con.convalidated,
      'condeferrable', con.condeferrable,
      'condeferred', con.condeferred,
      'confrel_table', CASE WHEN con.contype = 'f' THEN con.confrelid::regclass::text ELSE NULL END,
      'confkey_columns', CASE
        WHEN con.contype = 'f' THEN (
          SELECT json_agg(att.attname ORDER BY u.attpos)
          FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, attpos)
          JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
        )
        ELSE NULL
      END,
      'confrel_columns', CASE
        WHEN con.contype = 'f' THEN (
          SELECT json_agg(att.attname ORDER BY u.attpos)
          FROM unnest(con.confkey) WITH ORDINALITY AS u(attnum, attpos)
          JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = u.attnum
        )
        ELSE NULL
      END,
      'comment', obj_description(con.oid, 'pg_constraint')
    ) ORDER BY con.conname) AS cons
  FROM pg_constraint con
  WHERE con.conrelid != 0
  GROUP BY con.conrelid
),

tables_cte AS (
  SELECT
    c.oid,
    n.nspname AS schema,
    c.relname AS name,
    c.relkind::text AS kind,
    pg_get_userbyid(c.relowner) AS owner,
    c.relpersistence::text AS persistence,
    COALESCE(c.reloptions, ARRAY[]::text[]) AS options,
    c.relrowsecurity,
    c.relforcerowsecurity,
    obj_description(c.oid, 'pg_class') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
    ) AS is_extension_owned,
    c.relispartition AS is_partition,
    COALESCE((
      SELECT json_agg(p.relname ORDER BY p.relname)
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      WHERE i.inhrelid = c.oid
    ), '[]'::json) AS partition_parents,
    CASE WHEN c.relispartition THEN pg_get_expr(c.relpartbound, c.oid) ELSE NULL END AS partition_bound,
    CASE WHEN c.relkind = 'p' THEN pg_get_partkeydef(c.oid) ELSE NULL END AS partition_key,
    COALESCE(cols.cols, '[]'::json) AS columns,
    COALESCE(tc.cons, '[]'::json) AS constraints
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN columns_cte cols ON cols.attrelid = c.oid
  LEFT JOIN table_constraints_cte tc ON tc.conrelid = c.oid
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  ORDER BY n.nspname, c.relname
),

views_cte AS (
  SELECT
    c.oid,
    n.nspname AS schema,
    c.relname AS name,
    pg_get_viewdef(c.oid, true) AS viewdef,
    pg_get_userbyid(c.relowner) AS owner,
    COALESCE(c.reloptions, ARRAY[]::text[]) AS options,
    obj_description(c.oid, 'pg_class') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
    ) AS is_extension_owned,
    COALESCE((
      SELECT json_agg(json_build_object(
        'attnum', a.attnum,
        'name', a.attname,
        'typ', format_type(a.atttypid, a.atttypmod),
        'comment', col_description(c.oid, a.attnum)
      ) ORDER BY a.attnum)
      FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    ), '[]'::json) AS columns
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v'
  ORDER BY n.nspname, c.relname
),

matviews_cte AS (
  SELECT
    c.oid,
    n.nspname AS schema,
    c.relname AS name,
    pg_get_viewdef(c.oid, true) AS viewdef,
    pg_get_userbyid(c.relowner) AS owner,
    COALESCE(c.reloptions, ARRAY[]::text[]) AS options,
    c.relispopulated AS is_populated,
    obj_description(c.oid, 'pg_class') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
    ) AS is_extension_owned,
    COALESCE((
      SELECT json_agg(json_build_object(
        'attnum', a.attnum,
        'name', a.attname,
        'typ', format_type(a.atttypid, a.atttypmod),
        'comment', col_description(c.oid, a.attnum)
      ) ORDER BY a.attnum)
      FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    ), '[]'::json) AS columns
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'm'
  ORDER BY n.nspname, c.relname
),

-- Own function definitions only; extension libraries are inventoried by version and ACL.
functions_cte AS (
  SELECT
    p.oid,
    n.nspname AS schema,
    p.proname AS name,
    p.prokind::text AS prokind,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    format_type(p.prorettype, NULL) AS result_type,
    pg_get_functiondef(p.oid) AS functiondef,
    p.prosecdef AS security_definer,
    p.proconfig AS search_path,
    l.lanname AS language,
    pg_get_userbyid(p.proowner) AS owner,
    obj_description(p.oid, 'pg_proc') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid
    ) AS is_extension_owned
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.prokind NOT IN ('a', 'w')
    AND NOT EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid
    )
  ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
),

aggregates_cte AS (
  SELECT
    p.oid,
    n.nspname AS schema,
    p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    pg_get_userbyid(p.proowner) AS owner,
    'aggregate'::text AS kind,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid
    ) AS is_extension_owned
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'a'
  ORDER BY n.nspname, p.proname
),

window_funcs_cte AS (
  SELECT
    p.oid,
    n.nspname AS schema,
    p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    pg_get_userbyid(p.proowner) AS owner,
    'window'::text AS kind,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid
    ) AS is_extension_owned
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'w'
  ORDER BY n.nspname, p.proname
),

policies_cte AS (
  SELECT
    pol.oid,
    n.nspname AS schema,
    c.relname AS tablename,
    pol.polname AS policyname,
    pol.polpermissive AS permissive,
    CASE pol.polcmd
      WHEN '*' THEN 'ALL'
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE pol.polcmd::text
    END AS command,
    COALESCE((
      SELECT json_agg(
        CASE WHEN r.roleid = 0 THEN 'PUBLIC'
             ELSE pg_get_userbyid(r.roleid)
        END
      )
      FROM unnest(pol.polroles) AS r(roleid)
    ), '["PUBLIC"]'::json) AS roles,
    pg_get_expr(pol.polqual, pol.polrelid) AS qual,
    pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
    obj_description(pol.oid, 'pg_policy') AS comment
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  ORDER BY c.relname, pol.polname
),

triggers_cte AS (
  SELECT
    t.oid,
    n.nspname AS schema,
    c.relname AS tablename,
    t.tgname,
    pg_get_triggerdef(t.oid, true) AS triggerdef,
    t.tgenabled::text AS tgenabled,
    obj_description(t.oid, 'pg_trigger') AS comment,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_trigger'::regclass AND d.objid = t.oid
    ) AS is_extension_owned
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
  ORDER BY c.relname, t.tgname
),

indexes_cte AS (
  SELECT
    ci.oid,
    n.nspname AS schema,
    ct.relname AS tablename,
    ci.relname AS indexname,
    pg_get_indexdef(i.indexrelid, 0, true) AS indexdef,
    i.indisunique,
    i.indisprimary,
    i.indisvalid,
    i.indisready,
    (i.indisprimary OR EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = i.indexrelid)) AS is_constraint,
    EXISTS (
      SELECT 1 FROM extension_deps d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = ci.oid
    ) AS is_extension_owned,
    obj_description(ci.oid, 'pg_class') AS comment
  FROM pg_index i
  JOIN pg_class ci ON ci.oid = i.indexrelid
  JOIN pg_class ct ON ct.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = ct.relnamespace
  WHERE n.nspname = 'public'
  ORDER BY ct.relname, ci.relname
),

acls_cte AS (
  SELECT
    'SCHEMA'::text AS object_type,
    n.nspname AS schema,
    n.nspname AS object_name,
    NULL::text AS column_name,
    CASE WHEN e.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(e.grantee) END AS grantee,
    pg_get_userbyid(e.grantor) AS grantor,
    e.privilege_type AS privilege,
    e.is_grantable,
    e.grantee IS NULL AS empty_acl
  FROM pg_namespace n
  LEFT JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) e ON true
  WHERE n.nspname = 'public'

  UNION ALL

  SELECT
    CASE c.relkind
      WHEN 'r' THEN 'TABLE'
      WHEN 'p' THEN 'PARTITIONED_TABLE'
      WHEN 'v' THEN 'VIEW'
      WHEN 'm' THEN 'MATERIALIZED_VIEW'
      WHEN 'S' THEN 'SEQUENCE'
      ELSE 'RELATION'
    END AS object_type,
    n.nspname AS schema,
    c.relname AS object_name,
    NULL::text AS column_name,
    CASE WHEN e.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(e.grantee) END AS grantee,
    pg_get_userbyid(e.grantor) AS grantor,
    e.privilege_type AS privilege,
    e.is_grantable,
    e.grantee IS NULL AS empty_acl
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault((CASE c.relkind WHEN 'S' THEN 'S' ELSE 'r' END)::"char", c.relowner))) e ON true
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')

  UNION ALL

  SELECT
    'COLUMN'::text AS object_type,
    n.nspname AS schema,
    c.relname AS object_name,
    a.attname AS column_name,
    CASE WHEN e.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(e.grantee) END AS grantee,
    pg_get_userbyid(e.grantor) AS grantor,
    e.privilege_type AS privilege,
    e.is_grantable,
    e.grantee IS NULL AS empty_acl
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN LATERAL aclexplode(a.attacl) e ON true
  WHERE n.nspname = 'public' AND a.attacl IS NOT NULL AND a.attnum > 0 AND NOT a.attisdropped

  UNION ALL

  SELECT
    CASE p.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS object_type,
    n.nspname AS schema,
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS object_name,
    NULL::text AS column_name,
    CASE WHEN e.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(e.grantee) END AS grantee,
    pg_get_userbyid(e.grantor) AS grantor,
    e.privilege_type AS privilege,
    e.is_grantable,
    e.grantee IS NULL AS empty_acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) e ON true
  WHERE n.nspname = 'public'

  UNION ALL

  SELECT
    'TYPE'::text AS object_type,
    n.nspname AS schema,
    t.typname AS object_name,
    NULL::text AS column_name,
    CASE WHEN e.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(e.grantee) END AS grantee,
    pg_get_userbyid(e.grantor) AS grantor,
    e.privilege_type AS privilege,
    e.is_grantable,
    e.grantee IS NULL AS empty_acl
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  LEFT JOIN LATERAL aclexplode(COALESCE(t.typacl, acldefault('T', t.typowner))) e ON true
  WHERE n.nspname = 'public'
),

default_acls_cte AS (
  SELECT
    pg_get_userbyid(d.defaclrole) AS target_role,
    n.nspname AS target_schema,
    CASE d.defaclobjtype
      WHEN 'r' THEN 'TABLES'
      WHEN 'S' THEN 'SEQUENCES'
      WHEN 'f' THEN 'FUNCTIONS'
      WHEN 'T' THEN 'TYPES'
      WHEN 'n' THEN 'SCHEMAS'
      ELSE d.defaclobjtype::text
    END AS object_type,
    CASE WHEN e.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(e.grantee) END AS grantee,
    pg_get_userbyid(e.grantor) AS grantor,
    e.privilege_type AS privilege,
    e.is_grantable,
    e.grantee IS NULL AS empty_acl
  FROM pg_default_acl d
  LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  LEFT JOIN LATERAL aclexplode(d.defaclacl) e ON true
  ORDER BY target_role, target_schema, object_type, grantee, privilege
),

publications_cte AS (
  SELECT
    p.pubname AS name,
    p.puballtables AS all_tables,
    COALESCE((
      SELECT json_agg((t.schemaname || '.' || t.tablename) ORDER BY t.schemaname, t.tablename)
      FROM pg_publication_tables t
      WHERE t.pubname = p.pubname
    ), '[]'::json) AS tables
  FROM pg_publication p
  ORDER BY p.pubname
),

auth_triggers_cte AS (
  SELECT
    t.oid,
    'auth'::text AS schema,
    c.relname AS tablename,
    t.tgname,
    pg_get_triggerdef(t.oid, true) AS triggerdef,
    t.tgenabled::text AS tgenabled,
    'EXTERNAL_AUTH_INVENTORY'::text AS scope_marker
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'auth' AND NOT t.tgisinternal
  ORDER BY c.relname, t.tgname
),

storage_policies_cte AS (
  SELECT
    pol.oid,
    'storage'::text AS schema,
    c.relname AS tablename,
    pol.polname AS policyname,
    pol.polpermissive AS permissive,
    CASE pol.polcmd
      WHEN '*' THEN 'ALL'
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE pol.polcmd::text
    END AS command,
    COALESCE((
      SELECT json_agg(
        CASE WHEN r.roleid = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(r.roleid) END
      )
      FROM unnest(pol.polroles) AS r(roleid)
    ), '["PUBLIC"]'::json) AS roles,
    pg_get_expr(pol.polqual, pol.polrelid) AS qual,
    pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
    'EXTERNAL_STORAGE_INVENTORY'::text AS scope_marker
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage'
  ORDER BY c.relname, pol.polname
),

rlsoff_tables_cte AS (
  SELECT c.relname AS tablename
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity
  ORDER BY c.relname
),

counts_cte AS (
  SELECT json_build_object(
    'public_tables', (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),
    'rls_policies', (SELECT count(*)::int FROM pg_policies WHERE schemaname='public'),
    'functions', (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e')),
    'triggers', (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal),
    'indexes', (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public'),
    'auth_triggers', (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'auth' AND NOT t.tgisinternal),
    'publication_tables', (SELECT count(*)::int FROM pg_publication_tables),
    'extensions', (SELECT count(*)::int FROM pg_extension),
    'table_columns', (SELECT count(*)::int FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'),
    'view_columns', (SELECT count(*)::int FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name WHERE c.table_schema = 'public' AND t.table_type = 'VIEW'),
    'matview_columns', (SELECT count(*)::int FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'm' AND a.attnum > 0 AND NOT a.attisdropped),
    'rls_kapali_tablolar', (SELECT COALESCE(json_agg(t.tablename ORDER BY t.tablename), '[]'::json) FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = t.schemaname::regnamespace WHERE t.schemaname='public' AND NOT c.relrowsecurity)
  ) AS counts
)

SELECT json_build_object(
  'schema_format', (SELECT schema_format FROM meta),
  'postgresql_version', (SELECT postgresql_version FROM meta),
  'postgresql_version_num', (SELECT postgresql_version_num FROM meta),
  'counts', (SELECT counts FROM counts_cte),
  'extensions', (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM ext_inventory e),
  'enums', (SELECT COALESCE(json_agg(row_to_json(en)), '[]'::json) FROM enum_types en),
  'domains', (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM domain_types d),
  'composites', (SELECT COALESCE(json_agg(row_to_json(cp)), '[]'::json) FROM composite_types cp),
  'other_types', (SELECT COALESCE(json_agg(row_to_json(ot)), '[]'::json) FROM other_custom_types ot),
  'sequences', (SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) FROM sequences_cte s),
  'tables', (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM tables_cte t),
  'views', (SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json) FROM views_cte v),
  'materialized_views', (SELECT COALESCE(json_agg(row_to_json(mv)), '[]'::json) FROM matviews_cte mv),
  'functions', (SELECT COALESCE(json_agg(row_to_json(fn)), '[]'::json) FROM functions_cte fn),
  'aggregates', (SELECT COALESCE(json_agg(row_to_json(ag)), '[]'::json) FROM aggregates_cte ag),
  'window_functions', (SELECT COALESCE(json_agg(row_to_json(wf)), '[]'::json) FROM window_funcs_cte wf),
  'policies', (SELECT COALESCE(json_agg(row_to_json(pol)), '[]'::json) FROM policies_cte pol),
  'triggers', (SELECT COALESCE(json_agg(row_to_json(trg)), '[]'::json) FROM triggers_cte trg),
  'indexes', (SELECT COALESCE(json_agg(row_to_json(idx)), '[]'::json) FROM indexes_cte idx),
  'acls', (SELECT COALESCE(json_agg(row_to_json(a) ORDER BY a.object_type,a.schema,a.object_name,a.column_name,a.grantee,a.privilege,a.grantor,a.is_grantable), '[]'::json) FROM acls_cte a),
  'default_acls', (SELECT COALESCE(json_agg(row_to_json(da)), '[]'::json) FROM default_acls_cte da),
  'publications', (SELECT COALESCE(json_agg(row_to_json(pub)), '[]'::json) FROM publications_cte pub),
  'auth_triggers', (SELECT COALESCE(json_agg(row_to_json(at)), '[]'::json) FROM auth_triggers_cte at),
  'storage_policies', (SELECT COALESCE(json_agg(row_to_json(sp)), '[]'::json) FROM storage_policies_cte sp),
  'rlsoff_tables', (SELECT COALESCE(json_agg(tablename ORDER BY tablename), '[]'::json) FROM rlsoff_tables_cte)
) AS katalog;
