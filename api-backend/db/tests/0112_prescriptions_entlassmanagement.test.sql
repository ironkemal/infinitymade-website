-- Only disposable PostgreSQL after migrations through 0112; never a live database.
-- Synthetic temporary clone: no public rows, FKs, audit or auth data touched.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE entlass_probe
  (LIKE public.prescriptions INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TRIGGER entlass_probe_freeze BEFORE UPDATE ON entlass_probe
  FOR EACH ROW EXECUTE FUNCTION public.prescriptions_festschreibung();

DO $$
DECLARE
  probe_id uuid;
  variant record;
  before_row jsonb;
  failed_constraint text;
BEGIN
  -- NULL/NULL survives: no invented false for legacy data.
  INSERT INTO entlass_probe(owner_id)
    VALUES ('61111111-1111-4111-8111-111111111111') RETURNING id INTO probe_id;
  IF EXISTS (SELECT 1 FROM entlass_probe WHERE id = probe_id
             AND (entlassmanagement IS NOT NULL OR entlassungsdatum IS NOT NULL)) THEN
    RAISE EXCEPTION 'Unknown must remain NULL/NULL';
  END IF;

  UPDATE entlass_probe SET entlassmanagement = false WHERE id = probe_id;
  UPDATE entlass_probe SET entlassmanagement = true, entlassungsdatum = DATE '2026-11-01'
    WHERE id = probe_id;
  UPDATE entlass_probe SET entlassmanagement = NULL, entlassungsdatum = NULL
    WHERE id = probe_id;

  -- All invalid pairs fail through the actual copied CHECK, including SQL NULL semantics.
  FOR variant IN SELECT * FROM (VALUES
    (true, NULL::date), (false, DATE '2026-11-01'), (NULL::boolean, DATE '2026-11-01')
  ) AS invalid(flag, datum) LOOP
    BEGIN
      UPDATE entlass_probe SET entlassmanagement = variant.flag, entlassungsdatum = variant.datum
        WHERE id = probe_id;
      RAISE EXCEPTION 'Invalid pair accepted: % / %', variant.flag, variant.datum;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS failed_constraint = CONSTRAINT_NAME;
      IF failed_constraint <> 'prescriptions_entlassmanagement_datum_check' THEN RAISE; END IF;
    END;
  END LOOP;

  -- Effective-state invariant in BOTH directions: omitted fields cannot bypass it.
  FOR variant IN SELECT * FROM (VALUES
    ('is_blanko=true'), ('rezept_typ=''blanko''')
  ) AS blanko(assignment) LOOP
    UPDATE entlass_probe SET entlassmanagement = true, entlassungsdatum = DATE '2026-11-01',
      is_blanko = false, rezept_typ = 'standard' WHERE id = probe_id;
    BEGIN
      -- PATCH changes only the Blanko indicator; discharge pair remains stored.
      EXECUTE format('UPDATE entlass_probe SET %s WHERE id=$1', variant.assignment) USING probe_id;
      RAISE EXCEPTION 'Blanko enabled on discharge: %', variant.assignment;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS failed_constraint = CONSTRAINT_NAME;
      IF failed_constraint <> 'prescriptions_entlassmanagement_datum_check' THEN RAISE; END IF;
    END;
    UPDATE entlass_probe SET entlassmanagement = NULL, entlassungsdatum = NULL WHERE id = probe_id;
    EXECUTE format('UPDATE entlass_probe SET %s WHERE id=$1', variant.assignment) USING probe_id;
    BEGIN
      -- Reverse PATCH omits the existing Blanko indicator.
      UPDATE entlass_probe SET entlassmanagement = true, entlassungsdatum = DATE '2026-11-01'
        WHERE id = probe_id;
      RAISE EXCEPTION 'Discharge enabled on existing Blanko: %', variant.assignment;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS failed_constraint = CONSTRAINT_NAME;
      IF failed_constraint <> 'prescriptions_entlassmanagement_datum_check' THEN RAISE; END IF;
    END;
    UPDATE entlass_probe SET is_blanko = false, rezept_typ = 'standard' WHERE id = probe_id;
  END LOOP;

  -- Calendar validity is enforced by PostgreSQL date input.
  BEGIN
    EXECUTE 'UPDATE entlass_probe SET entlassmanagement=true, entlassungsdatum=''2026-02-30''';
    RAISE EXCEPTION 'Invalid calendar date accepted';
  EXCEPTION WHEN datetime_field_overflow THEN NULL;
  END;

  -- First publication may set the facts together with belegnummer.
  UPDATE entlass_probe SET entlassmanagement = true, entlassungsdatum = DATE '2026-11-01',
    belegnummer = 'SYNTHETIC-0112' WHERE id = probe_id;
  SELECT to_jsonb(p) INTO before_row FROM entlass_probe p WHERE id = probe_id;

  FOR variant IN SELECT * FROM (VALUES
    ('entlassmanagement=false, entlassungsdatum=NULL'),
    ('entlassmanagement=NULL, entlassungsdatum=NULL'),
    ('entlassungsdatum=DATE ''2026-11-02'''),
    ('heilmittel_items=''[{"code":"synthetic"}]''::jsonb'),
    ('doppelbehandlung=true'),
    ('belegnummer=NULL')
  ) AS mutation(assignment) LOOP
    BEGIN
      EXECUTE format('UPDATE entlass_probe SET %s WHERE id=$1', variant.assignment) USING probe_id;
      RAISE EXCEPTION 'Frozen mutation accepted: %', variant.assignment;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Eingereichte Verordnung ist festgeschrieben%' THEN RAISE; END IF;
    END;
  END LOOP;
  IF (SELECT to_jsonb(p) FROM entlass_probe p WHERE id = probe_id) IS DISTINCT FROM before_row THEN
    RAISE EXCEPTION 'Failed mutations changed the frozen row';
  END IF;
  -- Existing operational updates and no-op writes remain possible.
  UPDATE entlass_probe SET entlassmanagement = entlassmanagement,
    entlassungsdatum = entlassungsdatum, absetzung_grund = 'synthetic'
    WHERE id = probe_id;
END $$;
ROLLBACK;
