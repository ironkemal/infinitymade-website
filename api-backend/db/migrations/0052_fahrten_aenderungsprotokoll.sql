-- Fahrtenbuch-Änderungsprotokoll (BMF-Schreiben 18.11.2009: ein elektronisches
-- Fahrtenbuch muss nachträgliche Änderungen ausschliessen ODER dokumentieren).
--
-- WARUM: `fahrten` wird per upsert/update/delete geschrieben (Start, Ankunft,
--   Ende, Edit-Modal, Löschen, CASCADE beim Termin-Löschen) — bisher ohne jede
--   Spur. legal-de 01.10.2026: ein append-only Protokoll mit altem + neuem Wert,
--   Benutzer und Zeitpunkt erfüllt die zweite Alternative; Löschen muss NICHT
--   gesperrt werden, der gelöschte Inhalt muss aber erhalten bleiben.
--   db-ustasi 01.10.2026: neue Tabelle (data_access_log hält bewusst nur
--   Spaltennamen); keine FK — die Spur muss Fahrt UND Benutzerkonto überleben.
--   onprem 01.10.2026: geht (reines Postgres, auth.uid() existiert auch in der Box).
--
-- WAS WIRD PROTOKOLLIERT:
--   * UPDATE nur an ABGESCHLOSSENEN Fahrten (OLD.fahrt_ended_at IS NOT NULL) und
--     nur wenn sich ein Finanzamt-Feld ändert. Start → Ankunft → Ende einer
--     offenen Fahrt ist der normale Ablauf, kein „nachträgliches" Ändern.
--   * DELETE immer (auch per CASCADE vom Termin), mit vollem altem Inhalt.
--   Felder: fahrt_started_at, fahrt_arrived_at, fahrt_ended_at, start_km,
--   end_km, distance_km, zweck, abfahrtsort, zielort, vehicle_id,
--   kennzeichen_snapshot, user_id (Fahrer), notes. NICHT lead_id (Patientenbezug
--   bleibt im Patientenverzeichnis; zweck/zielort sind seit 0050 neutral).
--
-- SCHUTZ: kein INSERT/UPDATE/DELETE/TRUNCATE für anon/authenticated (REVOKE),
--   keine Schreib-Policy; geschrieben wird nur vom SECURITY-DEFINER-Trigger.
--   Lesen: Inhaber (owner_id) und der Fahrer der Fahrt (fahrer_id).
--   Restrisiko akzeptiert (legal-de): DB-Owner/service_role kann technisch ändern.
--
-- AUFBEWAHRUNG: wie das Fahrtenbuch selbst (§147 AO; legal-de: 8 Jahre
--   annehmen, mit Steuerberater klären). Deshalb NICHT in api/dsgvo.js
--   DELETE_TABLES (Art. 17 Abs. 3 lit. b DSGVO), aber in der Auskunft.
--
-- SaaS: angewandt 01.10.2026, MCP.
-- ZAEHLER: public_tablo +1, rls_policy +1, fonksiyon +1, trigger +1, index +2
--   (PK + fahrten_aenderungen_owner_fahrt_idx).

CREATE TABLE IF NOT EXISTS public.fahrten_aenderungen (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fahrt_id     uuid        NOT NULL,
  owner_id     uuid        NOT NULL,
  business_id  uuid,
  fahrer_id    uuid,
  op           text        NOT NULL CHECK (op IN ('UPDATE', 'DELETE')),
  alt          jsonb       NOT NULL,
  neu          jsonb,
  geaendert_von uuid,
  geaendert_am timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fahrten_aenderungen IS
  'Fahrtenbuch-Änderungsprotokoll (BMF 18.11.2009): nachträgliche Änderungen abgeschlossener Fahrten und jede Löschung mit altem/neuem Wert, Benutzer, Zeit. Append-only, nur per Trigger beschrieben; ohne FK, damit die Spur Fahrt und Konto überlebt.';

CREATE INDEX IF NOT EXISTS fahrten_aenderungen_owner_fahrt_idx
  ON public.fahrten_aenderungen (owner_id, fahrt_id);

ALTER TABLE public.fahrten_aenderungen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fahrten_aenderungen_select ON public.fahrten_aenderungen;
CREATE POLICY fahrten_aenderungen_select ON public.fahrten_aenderungen
  FOR SELECT USING (owner_id = auth.uid() OR fahrer_id = auth.uid());

-- Supabase vergibt per Default-Privileges auch anon SELECT/REFERENCES/TRIGGER —
-- deshalb ALLES entziehen und nur SELECT fuer authenticated zurueckgeben.
REVOKE ALL ON public.fahrten_aenderungen FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fahrten_aenderungen TO authenticated;

CREATE OR REPLACE FUNCTION public.fahrten_aenderung_protokollieren()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_alt jsonb;
  v_neu jsonb;
begin
  v_alt := jsonb_build_object(
    'fahrt_started_at', old.fahrt_started_at, 'fahrt_arrived_at', old.fahrt_arrived_at,
    'fahrt_ended_at', old.fahrt_ended_at, 'start_km', old.start_km, 'end_km', old.end_km,
    'distance_km', old.distance_km, 'zweck', old.zweck, 'abfahrtsort', old.abfahrtsort,
    'zielort', old.zielort, 'vehicle_id', old.vehicle_id,
    'kennzeichen_snapshot', old.kennzeichen_snapshot, 'user_id', old.user_id, 'notes', old.notes);

  if tg_op = 'UPDATE' then
    if old.fahrt_ended_at is null then
      return new;                       -- offene Fahrt: normaler Ablauf
    end if;
    v_neu := jsonb_build_object(
      'fahrt_started_at', new.fahrt_started_at, 'fahrt_arrived_at', new.fahrt_arrived_at,
      'fahrt_ended_at', new.fahrt_ended_at, 'start_km', new.start_km, 'end_km', new.end_km,
      'distance_km', new.distance_km, 'zweck', new.zweck, 'abfahrtsort', new.abfahrtsort,
      'zielort', new.zielort, 'vehicle_id', new.vehicle_id,
      'kennzeichen_snapshot', new.kennzeichen_snapshot, 'user_id', new.user_id, 'notes', new.notes);
    if v_neu = v_alt then
      return new;                       -- kein Finanzamt-Feld geändert
    end if;
  end if;

  insert into public.fahrten_aenderungen
    (fahrt_id, owner_id, business_id, fahrer_id, op, alt, neu, geaendert_von)
  values
    (old.id, old.owner_id, old.business_id, old.user_id, tg_op, v_alt, v_neu, auth.uid());

  return coalesce(new, old);
end $function$;

REVOKE EXECUTE ON FUNCTION public.fahrten_aenderung_protokollieren() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fahrten_aenderung_protokollieren() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fahrten_aenderung_protokollieren() FROM authenticated;

DROP TRIGGER IF EXISTS trg_fahrten_aenderung_protokollieren ON public.fahrten;
CREATE TRIGGER trg_fahrten_aenderung_protokollieren
  AFTER UPDATE OR DELETE ON public.fahrten
  FOR EACH ROW EXECUTE FUNCTION public.fahrten_aenderung_protokollieren();
