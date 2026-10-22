-- SaaS: angewandt 22.10.2026 (MCP: 20261022153644; REVOKE der Triggerfunktion nachgezogen als 0087b_therapieberichte_revoke, gleicher Tag, vor jedem Box-Rollout)
-- 0087: Therapieberichte — der Bericht an den verordnenden Arzt, so wie er versandt wurde.
-- Anlass: Kemal 22.10.2026 (Dokumentenversand per Mail, auch für Podologie).
-- Beratung: podoloji (Inhalt), db-ustasi (eigene Tabelle statt prescriptions-Spalten:
-- mehrere Berichte je VO; prescription_documents ist ein Datei-Anhang ohne Text/Versand),
-- legal-de (compliance/LEGAL_DECISIONS.md 2026-10-22: passwortgeschütztes PDF, Passwort
-- wird NIRGENDS gespeichert), onprem O-216.
-- Nur Ergänzungen (Kural 4): neue Tabelle, nichts Bestehendes geändert.
--
-- Eine Zeile entsteht erst beim Versand (Mail/Fax/Druck) — Entwürfe gibt es nicht in der DB.
-- Ab dann ist sie festgeschrieben (§ 630f Abs. 1 S. 2 BGB): der versandte Bericht bleibt in
-- der Akte, wie er hinausging. `inhalt_snapshot` friert den automatisch zusammengestellten
-- Teil ein (Patient, Arzt, VO, Behandlungen, Befund) — das PDF ist daraus jederzeit neu
-- erzeugbar, es wird nicht zusätzlich gespeichert (keine zweite Kopie im Storage).
-- Korrektur = neuer Bericht mit `vorgaenger_id`.

CREATE TABLE IF NOT EXISTS public.therapieberichte (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid,
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES public.leads(id) ON DELETE RESTRICT,
  arzt_id uuid REFERENCES public.aerzte(id) ON DELETE SET NULL,
  art text NOT NULL DEFAULT 'zwischenbericht'
    CONSTRAINT therapieberichte_art_check CHECK (art IN ('zwischenbericht', 'abschlussbericht')),
  verlauf text,
  empfehlung text,
  empfehlung_code text
    CONSTRAINT therapieberichte_empfehlung_code_check
    CHECK (empfehlung_code IS NULL OR empfehlung_code IN ('fortsetzung', 'ziel_erreicht', 'abklaerung')),
  inhalt_snapshot jsonb NOT NULL,
  versand_weg text NOT NULL
    CONSTRAINT therapieberichte_versand_weg_check CHECK (versand_weg IN ('mail', 'fax', 'druck')),
  empfaenger text,
  verschluesselt boolean NOT NULL DEFAULT false,
  versendet_am timestamptz NOT NULL DEFAULT now(),
  versendet_von uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  passwort_telefonisch boolean NOT NULL DEFAULT false,
  vorgaenger_id uuid REFERENCES public.therapieberichte(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.therapieberichte IS
  'Versandte Therapieberichte an den verordnenden Arzt. Zeile entsteht beim Versand und ist festgeschrieben (§ 630f BGB). Passwort des PDFs wird nie gespeichert (legal-de 22.10.2026).';
COMMENT ON COLUMN public.therapieberichte.inhalt_snapshot IS
  'Eingefrorener automatischer Teil zum Versandzeitpunkt: praxis, patient, arzt, verordnung, behandlungen, befund. Quelle für die Neuerzeugung des PDFs.';
COMMENT ON COLUMN public.therapieberichte.verschluesselt IS
  'true = PDF war passwortgeschützt (Mail). Fax/Druck: false.';
COMMENT ON COLUMN public.therapieberichte.passwort_telefonisch IS
  'Vermerk der Praxis: Passwort auf separatem Kanal (Telefon) übermittelt. Einzige Spalte, die nach dem Versand noch gesetzt werden darf (false → true).';

CREATE INDEX IF NOT EXISTS therapieberichte_rx_idx ON public.therapieberichte (prescription_id);
CREATE INDEX IF NOT EXISTS therapieberichte_owner_idx ON public.therapieberichte (owner_id, versendet_am DESC);
CREATE INDEX IF NOT EXISTS therapieberichte_lead_idx ON public.therapieberichte (lead_id);

-- Festschreibung. Erlaubt bleiben nur: der Telefon-Vermerk (false → true) und das
-- Nullsetzen der Fremdschlüssel durch ON DELETE SET NULL (Arzt/Mitarbeiter gelöscht —
-- der Snapshot trägt die Angaben weiter).
CREATE OR REPLACE FUNCTION public.therapieberichte_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Ein versandter Therapiebericht ist unveraenderlich (§ 630f Abs. 1 S. 2 BGB). Eine Korrektur erfolgt durch einen neuen Bericht.';
  end if;

  if new.owner_id         is distinct from old.owner_id
  or new.business_id      is distinct from old.business_id
  or new.prescription_id  is distinct from old.prescription_id
  or new.lead_id          is distinct from old.lead_id
  or new.art              is distinct from old.art
  or new.verlauf          is distinct from old.verlauf
  or new.empfehlung       is distinct from old.empfehlung
  or new.empfehlung_code  is distinct from old.empfehlung_code
  or new.inhalt_snapshot  is distinct from old.inhalt_snapshot
  or new.versand_weg      is distinct from old.versand_weg
  or new.empfaenger       is distinct from old.empfaenger
  or new.verschluesselt   is distinct from old.verschluesselt
  or new.versendet_am     is distinct from old.versendet_am
  or new.vorgaenger_id    is distinct from old.vorgaenger_id
  or new.created_at       is distinct from old.created_at
  or (new.arzt_id is distinct from old.arzt_id and new.arzt_id is not null)
  or (new.versendet_von is distinct from old.versendet_von and new.versendet_von is not null)
  or (old.passwort_telefonisch and not new.passwort_telefonisch)
  then
    raise exception 'Ein versandter Therapiebericht ist unveraenderlich (§ 630f Abs. 1 S. 2 BGB). Eine Korrektur erfolgt durch einen neuen Bericht.';
  end if;

  return new;
end $function$;

-- Triggerfunktion: niemand ruft sie direkt (Lehre _hinweis_0035: alle drei REVOKEs).
REVOKE ALL ON FUNCTION public.therapieberichte_festschreibung() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS therapieberichte_festschreibung ON public.therapieberichte;
CREATE TRIGGER therapieberichte_festschreibung
  BEFORE UPDATE OR DELETE ON public.therapieberichte
  FOR EACH ROW EXECUTE FUNCTION public.therapieberichte_festschreibung();

-- RLS: Lesen für Inhaber + Team. Geschrieben wird nur über das Backend (service_role,
-- POST /api/dokument/therapiebericht) — dort entsteht der Snapshot, nicht im Browser.
-- Der Telefon-Vermerk läuft ebenfalls über das Backend.
ALTER TABLE public.therapieberichte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS therapieberichte_select_policy ON public.therapieberichte;
CREATE POLICY therapieberichte_select_policy ON public.therapieberichte
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((owner_id = (SELECT auth.uid() AS uid)) OR (EXISTS (SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = (SELECT auth.uid() AS uid)) AND (profiles.owner_id = therapieberichte.owner_id))))));

REVOKE ALL ON public.therapieberichte FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.therapieberichte FROM authenticated;
GRANT SELECT ON public.therapieberichte TO authenticated;
GRANT ALL ON public.therapieberichte TO service_role;
