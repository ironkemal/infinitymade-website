-- Ops-Karte #254 — Schreibzugriffe auf die drei Patientendaten-Tabellen waren
-- nicht nachweisbar. `guvenlik` hat es am 17.09.2026 gegen
-- information_schema.triggers geprueft: `leads`, `prescriptions` und
-- `podologie_behandlungen` hatten KEINEN einzigen Audit-Trigger (Sicherheits-
-- register A-18). Es gab nur `api-backend/_lib/access-log.js` — und die
-- schreibt nur, was der Express-Backend sieht. Alles was der Browser per
-- PostgREST direkt schreibt (der Normalfall im Dashboard), lief an jedem
-- Protokoll vorbei.
--
-- Was hier NICHT drin ist, bewusst (guvenlik, 17.09.2026):
--   Lesezugriffe (SELECT). RLS haelt die Mandantengrenze bereits, und ein
--   SELECT-Protokoll (pgaudit) wuerde PHI in ein NEUES Silo tragen — genau
--   die Bewegung, die wir vermeiden. Der Beweiswert (§630f Abs. 3 SGB V /
--   Dokumentationspflicht, GoBD-Nachvollziehbarkeit) steckt ohnehin in der
--   SCHREIBSEITE: wer hat wann welchen Datensatz veraendert.
--
-- ⚠️ KERNREGEL — `metadata` enthaelt nur SPALTENNAMEN, nie WERTE.
--   Ein Audit-Log, das alte/neue Werte mitschreibt, ist eine zweite
--   Patientenakte ohne Loeschkonzept. Das ist Befund R12 im Sicherheits-
--   register (PHI sickert in ein Log). `geaenderte_spalten` beantwortet
--   "was wurde angefasst", der Datensatz selbst beantwortet "was steht
--   drin" — und nur der unterliegt der DSGVO-Loeschkette in api/dsgvo.js.
--
-- Bauteile:
--   `audit_write_log()` — SECURITY DEFINER, damit der Trigger in
--     data_access_log schreiben darf. Die Tabelle hat bewusst NUR eine
--     SELECT-Policy ("owner reads own access log"): niemand, auch nicht der
--     eingeloggte Owner, darf Zeilen einfuegen, aendern oder loeschen. Der
--     Definer (Eigentuemer der Tabelle) umgeht RLS, der Client nicht —
--     ein manipulationssicheres Protokoll setzt genau das voraus.
--     Kein FORCE ROW LEVEL SECURITY auf data_access_log, sonst wuerde auch
--     der Definer an der fehlenden INSERT-Policy scheitern.
--
--   EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW, OLD) — das Protokoll
--     darf den eigentlichen Schreibvorgang NIE blockieren. Ein Trigger, der
--     bei einem Log-Fehler die Behandlungsdokumentation verhindert, richtet
--     mehr Schaden an als die Luecke, die er schliesst. Der PL/pgSQL-
--     EXCEPTION-Block ist eine Subtransaktion: faellt das INSERT aus,
--     verschwindet nur das Protokoll, das UPDATE bleibt.
--
--   AFTER statt BEFORE — protokolliert wird, was TATSAECHLICH passiert ist.
--     Bricht ein BEFORE-Trigger ab (siehe naechster Absatz), feuert der
--     AFTER-Trigger nie und es entsteht korrekterweise kein Eintrag.
--
-- Zusammenspiel mit `trg_prescriptions_festschreibung` (0020, gleicher Tag):
--   Kein Konflikt, zwei verschiedene Phasen und Zwecke.
--     BEFORE UPDATE: Festschreibung entscheidet, OB die Aenderung erlaubt ist
--                    (wirft ggf. eine Exception → ganze Anweisung faellt aus,
--                    kein Audit-Eintrag, korrekt).
--     AFTER  UPDATE: Audit schreibt auf, DASS sie passiert ist.
--   Folge, bewusst so: die Festschreibung setzt `new.updated_at`, der
--   AFTER-Trigger sieht also den Zeilenstand NACH allen BEFORE-Triggern.
--   Deshalb steht bei `prescriptions` in `geaenderte_spalten` praktisch
--   immer auch `updated_at` — das ist die Wahrheit, nicht ein Fehler.
--   Live durchgespielt (MCP, 17.09.2026, komplett zurueckgerollte Probe):
--   gesperrte Spalte → Festschreibung blockt, 0 Audit-Zeilen; offene Spalte
--   → geht durch, 1 Audit-Zeile mit action=UPDATE.
--
-- `user_id = auth.uid()` ist NULL, wenn der Express-Backend mit dem
--   service_role-Schluessel schreibt (dort gibt es keinen JWT-sub). Das ist
--   kein Defekt, sondern die Trennlinie: user_id gefuellt = der Browser des
--   Behandlers hat direkt geschrieben; user_id leer + method='DB' = es kam
--   ueber den Backend, dessen eigenes Protokoll access-log.js fuehrt.
--   owner_id/resource_id stehen in beiden Faellen, die Zeile ist also auch
--   ohne user_id einem Mandanten und einem Datensatz zuzuordnen.
--
-- `business_id` wird mitgeschrieben, obwohl die Karte es nicht verlangt:
--   die Spalte existiert in data_access_log, ist nicht personenbezogen und
--   ist bei Mehr-Standort-Praxen die einzige Moeglichkeit, einen Zugriff dem
--   richtigen Standort zuzuordnen. Ueber to_jsonb() gelesen, damit die
--   Funktion auch an Tabellen ohne diese Spalte haengen kann —
--   `podologie_behandlungen` hat naemlich keine (dort bleibt sie NULL).
--
-- Keine Grants an anon/authenticated auf die Funktion: ein Trigger braucht
--   sie nicht (die EXECUTE-Pruefung findet bei CREATE TRIGGER statt, nicht
--   beim Feuern), und eine frei aufrufbare SECURITY-DEFINER-Funktion mit
--   INSERT-Recht auf das Audit-Log waere genau der Weg, ein Protokoll zu
--   faelschen. Direktaufruf scheitert ohnehin an "trigger functions can only
--   be called as triggers" — hier gilt trotzdem Guertel und Hosentraeger.
--
-- ZAEHLER: +1 Funktion, +3 Trigger. Keine neue Tabelle/Policy/Spalte/Index.
--          `erwartete-zaehler.json`: nur `bis_version` auf 0021 gezogen —
--          die `zaehler`-Werte brauchen laut eigener Regel eine PHYSISCHE
--          Messung auf dem WSL-Testkasten, die macht `onprem`.
--
-- ✅ Im SaaS angewendet 17.09.2026 (MCP).

CREATE FUNCTION public.audit_write_log() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_zeile     jsonb;
  v_alt       jsonb;
  v_metadata  jsonb := null;
begin
  -- Bei DELETE gibt es kein NEW — die geloeschte Zeile ist die Quelle.
  if tg_op = 'DELETE' then
    v_zeile := to_jsonb(old);
  else
    v_zeile := to_jsonb(new);
  end if;

  -- NUR Spaltennamen, nie Werte (siehe Kernregel im Kopf).
  -- jsonb_agg sammelt ausschliesslich s.key; s.value wird verglichen,
  -- aber nirgends ausgegeben.
  if tg_op = 'UPDATE' then
    v_alt := to_jsonb(old);
    select jsonb_build_object(
             'geaenderte_spalten',
             coalesce(jsonb_agg(s.key order by s.key), '[]'::jsonb))
      into v_metadata
      from jsonb_each(v_zeile) s
     where s.value is distinct from (v_alt -> s.key);
  end if;

  insert into public.data_access_log
    (user_id, owner_id, business_id, method, path,
     resource, resource_id, action, metadata)
  values
    (auth.uid(),
     nullif(v_zeile ->> 'owner_id', '')::uuid,
     nullif(v_zeile ->> 'business_id', '')::uuid,
     'DB',
     'db://' || tg_table_name,
     tg_table_name,
     v_zeile ->> 'id',
     tg_op,
     v_metadata);

  return coalesce(new, old);
exception when others then
  -- Protokollieren darf nie die Behandlungsdokumentation verhindern.
  return coalesce(new, old);
end $$;

REVOKE ALL ON FUNCTION public.audit_write_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_write_log() FROM anon;
REVOKE ALL ON FUNCTION public.audit_write_log() FROM authenticated;

CREATE TRIGGER trg_audit_write_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_write_log();

CREATE TRIGGER trg_audit_write_prescriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_write_log();

CREATE TRIGGER trg_audit_write_podologie_behandlungen
  AFTER INSERT OR UPDATE OR DELETE ON public.podologie_behandlungen
  FOR EACH ROW EXECUTE FUNCTION public.audit_write_log();
