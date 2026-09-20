import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pruefeDatei,
  pruefeDateien,
  PROTECTED,
  AUSNAHMEN,
  BEKANNTE_ALTLASTEN,
  GRANTEES,
} from './check-security-definer-grants.mjs';

test('1. 0029-aehnlich mit allen REVOKEs fuer PUBLIC, anon, authenticated -> keine Befunde', () => {
  const sql = `
CREATE FUNCTION public.naechste_datenaustauschreferenz(
  p_owner uuid, p_absender_ik text, p_empfaenger_ik text
) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN 1;
END $$;

CREATE FUNCTION public.naechste_transfernummer(
  p_owner uuid, p_absender_ik text, p_empfaenger_ik text
) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN 1;
END $$;

CREATE FUNCTION public.datenaustausch_zaehler_vorstellen(
  p_owner uuid, p_absender_ik text, p_empfaenger_ik text,
  p_referenz bigint, p_transfernummer integer
) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NULL;
END $$;

REVOKE ALL ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.naechste_transfernummer(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.naechste_transfernummer(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.naechste_transfernummer(uuid, text, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) FROM authenticated;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/test_0029.sql', sql);
  assert.deepEqual(bulgular, []);
});

test('2. Gleicher Inhalt ohne FROM anon -> art: fehlende_revokes mit anon in fehlend', () => {
  const sql = `
CREATE FUNCTION public.naechste_datenaustauschreferenz(
  p_owner uuid, p_absender_ik text, p_empfaenger_ik text
) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
BEGIN
  RETURN 1;
END $$;

REVOKE ALL ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM authenticated;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/test_fehlende_revokes.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'fehlende_revokes');
  assert.equal(bulgular[0].name, 'naechste_datenaustauschreferenz');
  assert.deepEqual(bulgular[0].fehlend, ['anon']);
});

test('3. Neue unbekannte SECURITY DEFINER Funktion -> art: unbekannte_definer_funktion', () => {
  const sql = `
CREATE FUNCTION public.neue_geheime_fn(p_mandant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM 1;
END;
$$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_geheim.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'neue_geheime_fn');
  assert.equal(bulgular[0].datei, 'api-backend/db/migrations/9999_geheim.sql');
});

test('4. Funktion ohne SECURITY DEFINER (INVOKER oder gar keine Angabe) -> keine Befunde', () => {
  const sql = `
CREATE FUNCTION public.neue_geheime_fn(p_mandant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Body darf den Begriff erwaehnen ohne Fehlalarm
  -- SECURITY DEFINER im Kommentar
  SELECT 1;
END;
$$;

CREATE FUNCTION public.weitere_normale_fn()
RETURNS int
LANGUAGE sql
AS $$
  SELECT 42;
$$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_invoker.sql', sql);
  assert.deepEqual(bulgular, []);
});

test('5. search_diagnosen aus AUSNAHMEN mit SECURITY DEFINER -> keine Befunde', () => {
  const sql = `
CREATE OR REPLACE FUNCTION public.search_diagnosen(q text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/0010_test.sql', sql);
  assert.deepEqual(bulgular, []);
});

test('6. Kommentarzeile mit CREATE FUNCTION ... SECURITY DEFINER -> keine Befunde (kein Fehlalarm)', () => {
  const sql = `
-- 0024_revoke_unused_function_grants.sql Referenz-Stil:
-- CREATE FUNCTION public.hayali_fn() RETURNS trigger
--     LANGUAGE plpgsql SECURITY DEFINER
--     AS $$ ...

   -- Auch mit fuehrenden Leerzeichen:
   -- CREATE FUNCTION public.andere_hayali_fn() SECURITY DEFINER AS $$

SELECT 1;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/0024_kommentar.sql', sql);
  assert.deepEqual(bulgular, []);
});

test('7. 0003-Stil: LANGUAGE plpgsql SECURITY DEFINER auf einer Zeile mit unbekanntem Namen -> erkannt', () => {
  const sql = `
CREATE OR REPLACE FUNCTION public.neuer_zaehler_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN NEW;
END;
$$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/0003_custom.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'neuer_zaehler_trigger');
});

test('8. pruefeDateien ueberspringt 0000_baseline.sql', () => {
  const dateien = [
    'api-backend/db/migrations/0000_baseline.sql',
    'api-backend\\db\\migrations\\0000_baseline.sql',
  ];
  let aufgerufen = false;
  const bulgular = pruefeDateien(dateien, () => {
    aufgerufen = true;
    return 'CREATE FUNCTION public.neue_geheime_fn() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;';
  });

  assert.equal(aufgerufen, false);
  assert.deepEqual(bulgular, []);
});

test('9. Listenstruktur: AUSNAHMEN (5), PROTECTED (12) und BEKANNTE_ALTLASTEN (6) mit Begruendung', () => {
  // AUSNAHMEN: genau 5 oeffentliche RPCs
  assert.equal(AUSNAHMEN.length, 5);
  const erwarteteAusnahmen = [
    'search_diagnosen',
    'search_heilmittel',
    'public_praxis_sector',
    'find_owner_id_by_code',
    'get_my_permissions',
  ];
  for (const name of erwarteteAusnahmen) {
    const eintrag = AUSNAHMEN.find((a) => a.name === name);
    assert.ok(eintrag, 'Ausnahme fehlt: ' + name);
    assert.ok(typeof eintrag.grund === 'string' && eintrag.grund.length > 10, 'Begruendung fehlt fuer Ausnahme: ' + name);
  }

  // PROTECTED: 8 urspruengliche + 4 Trigger-Funktionen aus 0003 und 0021 = 12
  assert.equal(PROTECTED.length, 12);
  const erwarteteProtected = [
    'get_gmail_token',
    'set_gmail_token',
    'clear_gmail_token',
    'naechste_nummer',
    'naechste_verordnungsnummer',
    'naechste_datenaustauschreferenz',
    'naechste_transfernummer',
    'datenaustausch_zaehler_vorstellen',
    'set_next_beleg_nr',
    'set_next_mahnung_nr',
    'set_next_ausfallrechnung_nr',
    'audit_write_log',
  ];
  for (const name of erwarteteProtected) {
    assert.ok(PROTECTED.includes(name), 'PROTECTED fehlt: ' + name);
  }

  // BEKANNTE_ALTLASTEN: genau 6 Eintraege mit datei, name, grund
  assert.equal(BEKANNTE_ALTLASTEN.length, 6);
  for (const alt of BEKANNTE_ALTLASTEN) {
    assert.ok(typeof alt.datei === 'string' && alt.datei.endsWith('.sql'), 'Datei ungueltig in Altlast: ' + JSON.stringify(alt));
    assert.ok(typeof alt.name === 'string' && alt.name.length > 0, 'Name fehlt in Altlast: ' + JSON.stringify(alt));
    assert.ok(typeof alt.grund === 'string' && alt.grund.length > 10, 'Grund fehlt in Altlast: ' + JSON.stringify(alt));
  }
});

test('10. Nitelikler goevdeden SONRA (spaete_attribute_fn) -> art: unbekannte_definer_funktion', () => {
  const sql = `
CREATE FUNCTION public.spaete_attribute_fn(p_owner uuid) RETURNS void AS $$
BEGIN
  PERFORM 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_spaet.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'spaete_attribute_fn');
});

test('11. Etiketli dolar-tirnak goevdesi ($function$) + goevdeden sonra SECURITY DEFINER -> yakalaniyor', () => {
  const sql = `
CREATE FUNCTION public.etiketli_definer_fn(p_owner uuid) RETURNS void AS $function$
BEGIN
  PERFORM 1;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_etiketli.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'etiketli_definer_fn');
});

test('12. DO $$ ... EXECUTE format(CREATE FUNCTION ... SECURITY DEFINER ...) $$ -> bulgu YOK', () => {
  const sql = `
DO $$
BEGIN
  EXECUTE format('CREATE FUNCTION public.dynamisch(p uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS ...');
END $$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_dynamisch_do.sql', sql);
  assert.deepEqual(bulgular, []);
});

test('13. Goevde icinde satir basinda SECURITY DEFINER gecen INVOKER fonksiyon -> bulgu yok', () => {
  const sql = `
CREATE FUNCTION public.invoker_mit_body_fund() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
SECURITY DEFINER
  PERFORM 1;
END;
$$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_invoker_body.sql', sql);
  assert.deepEqual(bulgular, []);
});

test('14. Arka arkaya iki fonksiyon: ilki AUSNAHMEN (search_heilmittel), ikincisi yeni definer -> tam 1 bulgu', () => {
  const sql = `
CREATE FUNCTION public.search_heilmittel(q text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;

CREATE FUNCTION public.echte_unbekannte_fn(p uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM 1;
END;
$$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_zwei_funktionen.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'echte_unbekannte_fn');
});

test('15. Ad ile parantez arasinda satir sonu -> yakalaniyor', () => {
  const sql = `
CREATE FUNCTION public.test_fn_7
  (p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_newline_paren.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'test_fn_7');
});

test('16. CREATE und FUNCTION durch Zeilenumbruch getrennt -> yakalaniyor', () => {
  const sql = `
CREATE
FUNCTION public.newline_create_fn(p uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_newline_create.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'newline_create_fn');
});

test('17. Leerzeichen nach Schema-Punkt (public. foo) -> yakalaniyor', () => {
  const sql = `
CREATE FUNCTION public. spaced_dot_fn(p uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_spaced_dot.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'spaced_dot_fn');
});

test('18. Inline-Blockkommentar vor CREATE FUNCTION -> yakalaniyor', () => {
  const sql = `
/* inline */ CREATE FUNCTION public.inline_comment_fn(p uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_inline_comment.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'inline_comment_fn');
});

test('19. Semikolon im String-Literal (DEFAULT \';\') und danach SECURITY DEFINER -> yakalaniyor', () => {
  const sql = `
CREATE FUNCTION public.semicolon_in_default_fn(p text DEFAULT ';') RETURNS void AS $$ BEGIN END
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_semicolon_str.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'semicolon_in_default_fn');
});

test('20. CREATE TRIGGER ... EXECUTE FUNCTION enthaelt -> bulgu YOK', () => {
  const sql = `
CREATE TRIGGER trg_demo BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.irgendwas();
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_trigger.sql', sql);
  assert.deepEqual(bulgular, []);
});

test('21. Vollstaendige Funktionsdefinition im mehrzeiligen Blockkommentar -> bulgu YOK', () => {
  const sql = `
/*
CREATE FUNCTION public.auskommentiert_fn(p uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;
*/
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_multiline_comment.sql', sql);
  assert.deepEqual(bulgular, []);
});

test('22. BEKANNTE_ALTLASTEN dateibasiert: 0003 unterdrueckt, gleicher Inhalt in 0038 schlaegt an', () => {
  const sql0003 = `
CREATE OR REPLACE FUNCTION public.set_next_beleg_nr() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN NEW;
END;
$$;
`;

  // Mit 0003-Dateiname: Altlast greift, fehlende REVOKEs werden unterdrueckt
  const bulgular0003 = pruefeDatei('api-backend/db/migrations/0003_nummernkreis_beleg_mahnung_ausfallrechnung.sql', sql0003);
  assert.deepEqual(bulgular0003, []);

  // Gleicher Inhalt mit anderem Dateinamen (z.B. 0038_neu.sql): Gate schlaegt an!
  const bulgular0038 = pruefeDatei('api-backend/db/migrations/0038_neu.sql', sql0003);
  assert.equal(bulgular0038.length, 1);
  assert.equal(bulgular0038[0].art, 'fehlende_revokes');
  assert.equal(bulgular0038[0].name, 'set_next_beleg_nr');
});

test('23. String-Literal mit $$ (RAISE EXCEPTION \'kein $$ Body\') taeuscht keinen Funktionskoerper vor', () => {
  const sql = `
-- Statement mit einem String-Literal, das $$ enthaelt (kein Dollar-Quote-Body):
DO 'BEGIN RAISE EXCEPTION ''kein $$ Body''; END;';

CREATE FUNCTION public.echte_definer_nach_dollar_str(p uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_dollar_in_str.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'unbekannte_definer_funktion');
  assert.equal(bulgular[0].name, 'echte_definer_nach_dollar_str');
});

test('24. Unpraefixierte PROTECTED-Funktion mit auskommentiertem REVOKE (Kommentar-Falle) -> art: fehlende_revokes', () => {
  const sql = `
CREATE OR REPLACE FUNCTION naechste_nummer(p_owner uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION naechste_nummer(uuid) FROM PUBLIC;
-- REVOKE EXECUTE ON FUNCTION naechste_nummer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION naechste_nummer(uuid) FROM authenticated;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_kommentar_falle.sql', sql);
  assert.equal(bulgular.length, 1);
  assert.equal(bulgular[0].art, 'fehlende_revokes');
  assert.equal(bulgular[0].name, 'naechste_nummer');
  assert.deepEqual(bulgular[0].fehlend, ['anon']);
});

test('25. Unpraefixierte PROTECTED-Funktion mit allen unpraefixierten REVOKEs -> keine Befunde', () => {
  const sql = `
CREATE OR REPLACE FUNCTION naechste_nummer(p_owner uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION naechste_nummer(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION naechste_nummer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION naechste_nummer(uuid) FROM authenticated;
`;

  const bulgular = pruefeDatei('api-backend/db/migrations/9999_unpraefixiert_vollstaendig.sql', sql);
  assert.deepEqual(bulgular, []);
});

