-- Raumplan: Tabelle rooms + bookings.room_id (Physio/PILOT-PLAN.md M1, 31.10.2026).
--
-- WAS: Räume je Standort; ein Termin kann einen Raum tragen (optional).
-- WARUM nur Warnung statt EXCLUDE: Wärme/Fango laufen parallel, Gruppen-Kinder teilen sich einen
--      Raum (db-ustasi, physio; Ops #307 „warnen statt blockieren"). Die Warnung sitzt in
--      module/raum-plan.js und vergleicht mit rooms.plaetze. Eine harte Sperre wäre eine eigene Migration.
-- WARUM business_id nullable: nur für Inhaber ohne businesses-Zeile. Sonst setzt
--      trg_set_business_id den Default-Standort, ein Raum steht an genau einem Ort.
-- WARUM Trigger: ein FK läuft an RLS vorbei, ein Termin könnte sonst die room_id eines fremden
--      Mandanten oder Standorts tragen. Prüft owner_id UND den Mandanten von user_id (guvenlik) und
--      auch die Wege mit service_role. INVOKER genügt: ein per RLS unsichtbarer Raum liest sich als
--      NULL und wird abgewiesen (schlägt geschlossen fehl). Name trg_zz_…, weil BEFORE-Trigger
--      alphabetisch laufen und business_id vorher von trg_set_business_id gesetzt sein muss.
-- Rechte: Lesen ganzes Team, Schreiben nur Inhaber, anon nichts. Die öffentliche Buchung kennt
--      room_id nicht (/booking/create hat eine feste Feldliste).
-- :stable/:beta-sicher: nur neue Tabelle und nullable Spalte; bei room_id NULL endet der Trigger sofort.
-- SaaS: angewandt 31.10.2026, MCP.
-- ZAEHLER: public_tablo +1, rls_policy +2, fonksiyon +1, trigger +3, index +4.

CREATE TABLE IF NOT EXISTS public.rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  plaetze     smallint NOT NULL DEFAULT 1 CHECK (plaetze BETWEEN 1 AND 99),
  aktiv       boolean NOT NULL DEFAULT true,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rooms_name_uniq
  ON public.rooms (owner_id, COALESCE(business_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE INDEX IF NOT EXISTS rooms_business_idx ON public.rooms (business_id);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rooms FROM anon;

DROP POLICY IF EXISTS rooms_select_mandant ON public.rooms;
CREATE POLICY rooms_select_mandant ON public.rooms
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT public.auth_tenant_id()));

DROP POLICY IF EXISTS rooms_write_owner ON public.rooms;
CREATE POLICY rooms_write_owner ON public.rooms
  FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND (business_id IS NULL OR EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = rooms.business_id AND b.owner_id = (SELECT auth.uid())))
  );

DROP TRIGGER IF EXISTS rooms_updated_at ON public.rooms;
CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_set_business_id ON public.rooms;
CREATE TRIGGER trg_set_business_id
  BEFORE INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_room_time_idx
  ON public.bookings (room_id, start_time) WHERE room_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bookings_room_mandant()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
DECLARE
  r_owner  uuid;
  r_biz    uuid;
  t_owner  uuid;
BEGIN
  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT r.owner_id, r.business_id INTO r_owner, r_biz FROM public.rooms r WHERE r.id = NEW.room_id;
  SELECT COALESCE(p.owner_id, p.id) INTO t_owner FROM public.profiles p WHERE p.id = NEW.user_id;
  IF r_owner IS NULL
     OR r_owner IS DISTINCT FROM NEW.owner_id
     OR r_owner IS DISTINCT FROM t_owner
     OR r_biz <> NEW.business_id THEN
    RAISE EXCEPTION 'room_id gehoert nicht zu Mandant oder Standort des Termins' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.bookings_room_mandant() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bookings_room_mandant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zz_booking_room ON public.bookings;
CREATE TRIGGER trg_zz_booking_room
  BEFORE INSERT OR UPDATE OF room_id, owner_id, user_id, business_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_room_mandant();
