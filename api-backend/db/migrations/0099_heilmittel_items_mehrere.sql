-- Ops #202 — mehrere Heilmittel je Verordnung: prescriptions.heilmittel_items absichern.
-- Entwurf db-ustasi (02.11.2026). Eintrag: {code, bezeichnung, einheiten, doppelbehandlung}.
-- Inhaltsregeln (Summe der Einheiten, erlaubte Codes) gehoeren NICHT in die DB, nur die Form.
--
-- 1. CHECK: NULL oder jsonb-Array; Array mit "einheiten"-Eintraegen (moderne Form) hoechstens 3 Elemente.
--    Alte Eintraege ohne "einheiten" (string/bezeichnung) bleiben unbegrenzt gueltig.
--    Live-Stand 02.11.2026: 99 Zeilen, alle Arrays, max. Laenge 3 -> Constraint wird direkt validiert
--    (kein NOT VALID noetig; auf frischer DB ist die Tabelle leer).
-- 2. prescriptions_festschreibung(): heilmittel_items nach Belegnummer gesperrt. Rumpf 1:1 aus der Live-DB,
--    einzige Aenderung = eine Zeile. fn_abrechnung_zeile_festschreibung() nicht betroffen
--    (schuetzt abrechnung_zeile, liest heilmittel_items nicht).
-- ZAEHLER: +-0 (CHECK und CREATE OR REPLACE zaehlen nicht).
-- SaaS: angewandt 02.11.2026, MCP apply_migration (Kemal-Freigabe; vorher Rollback-Probe auf Live, 9 Faelle ok).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'prescriptions_heilmittel_items_check'
                   AND conrelid = 'public.prescriptions'::regclass) THEN
    ALTER TABLE public.prescriptions
      ADD CONSTRAINT prescriptions_heilmittel_items_check CHECK (
        heilmittel_items IS NULL
        OR (
          jsonb_typeof(heilmittel_items) = 'array'
          AND (
            jsonb_array_length(heilmittel_items) <= 3
            OR NOT jsonb_path_exists(heilmittel_items, '$[*] ? (exists(@.einheiten))')
          )
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prescriptions_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.belegnummer is null then
    return new;
  end if;

  if new.owner_id             is distinct from old.owner_id
  or new.business_id          is distinct from old.business_id
  or new.created_at           is distinct from old.created_at
  or new.belegnummer          is distinct from old.belegnummer
  or new.ausstellungsdatum    is distinct from old.ausstellungsdatum
  or new.diagnosegruppe       is distinct from old.diagnosegruppe
  or new.icd10                is distinct from old.icd10
  or new.icd10_2              is distinct from old.icd10_2
  or new.leitsymptomatik      is distinct from old.leitsymptomatik
  or new.pat_leitsymptomatik  is distinct from old.pat_leitsymptomatik
  or new.is_dringend          is distinct from old.is_dringend
  or new.hausbesuch           is distinct from old.hausbesuch
  or new.frequenz             is distinct from old.frequenz
  or new.rezeptart            is distinct from old.rezeptart
  or new.zuzahlung_befreit    is distinct from old.zuzahlung_befreit
  or new.zuzahlung_eur        is distinct from old.zuzahlung_eur
  or new.kostentraeger_ik     is distinct from old.kostentraeger_ik
  or new.arzt_id              is distinct from old.arzt_id
  or new.wagner_grad          is distinct from old.wagner_grad
  or new.nagel                is distinct from old.nagel
  or new.krankenkasse_ik      is distinct from old.krankenkasse_ik
  or new.behandlungsanlass    is distinct from old.behandlungsanlass
  or new.heilmittel           is distinct from old.heilmittel
  or new.heilmittel_position  is distinct from old.heilmittel_position
  or new.anzahl_einheiten     is distinct from old.anzahl_einheiten
  or new.doctor_lanr          is distinct from old.doctor_lanr
  or new.doctor_bsnr          is distinct from old.doctor_bsnr
  or new.rezept_typ           is distinct from old.rezept_typ
  or new.is_blanko            is distinct from old.is_blanko
  or new.is_lhb_bvb           is distinct from old.is_lhb_bvb
  or new.behandlungsbeginn    is distinct from old.behandlungsbeginn
  or new.gueltig_bis          is distinct from old.gueltig_bis
  -- 0089 (gkv-302, 27.10.2026): ergänzendes Heilmittel, Hausbesuch-Ort, Doppelbehandlung
  or new.ergaenzendes_heilmittel is distinct from old.ergaenzendes_heilmittel
  or new.ergaenzend_einheiten is distinct from old.ergaenzend_einheiten
  or new.vorrangig_einheiten  is distinct from old.vorrangig_einheiten
  or new.ergaenzend_position  is distinct from old.ergaenzend_position
  or new.hausbesuch_ort       is distinct from old.hausbesuch_ort
  or new.doppelbehandlung     is distinct from old.doppelbehandlung
  -- 0099 (Ops #202): mehrere Heilmittel je Verordnung
  or new.heilmittel_items     is distinct from old.heilmittel_items
  then
    raise exception 'Eingereichte Verordnung ist festgeschrieben (GoBD, §302 SGB V). Offen bleiben nur status/absetzung_*/storno_*/zuzahlung_kassiert_* und die Anonymisierung.';
  end if;

  if new.patient_name is not null and new.patient_name is distinct from old.patient_name then
    raise exception 'patient_name darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;
  if new.versichertennummer is not null and new.versichertennummer is distinct from old.versichertennummer then
    raise exception 'versichertennummer darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;
  if new.patient_id is not null and new.patient_id is distinct from old.patient_id then
    raise exception 'patient_id darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end $function$;
