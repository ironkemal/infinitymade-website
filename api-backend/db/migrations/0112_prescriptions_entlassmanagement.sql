-- 0112_prescriptions_entlassmanagement.sql — Entlassmanagement an der Verordnung (07.11.2026).
--
-- WAS: zwei nullable Spalten prescriptions.entlassmanagement / entlassungsdatum, ein CHECK,
--      Festschreibungstrigger prescriptions_festschreibung() um beide Felder erweitert.
-- WARUM: Physio-Abrechnung braucht die bestaetigte Entlassmanagement-Angabe (Muster 13,
--      Entwurf db/entwuerfe/2026-11-07-physio-abrechnung.md Abschnitt 1). Melih GO 07.11.2026.
-- NULL bleibt unbekannt; kein Default, keine Ableitung und kein Backfill.
-- Datum ist nur zusammen mit bestaetigtem Entlassmanagement zulaessig.
-- Bestaetigtes Entlassmanagement schliesst beide vorhandenen Blanko-Kennzeichen aus;
-- CHECK prueft den effektiven Zeilenzustand auch bei partiellen Updates.
-- Festschreibung: vollstaendiger letzter Rumpf aus 0099, nur zwei Vergleiche ergaenzt.
-- Expand-only (Kural 4): :stable kennt die Spalten nicht und schreibt sie nie; NULL/NULL erfuellt den CHECK.
-- ZAEHLER: tablo +0, rls_policy +0, fonksiyon +0 (CREATE OR REPLACE), trigger +0, index +0 —
--      zaehlerneutral (in Wegwerf-PostgreSQL nach Kette gemessen 07.11.2026, siehe 0115-Kopf).
-- SaaS: angewandt 10.11.2026, Supabase Management-API (SQL) + Ledger-Eintrag supabase_migrations
--      (Gate O-129 laesst diese Zeile absichtlich nicht durch.)

ALTER TABLE public.prescriptions
  ADD COLUMN entlassmanagement boolean,
  ADD COLUMN entlassungsdatum date;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_entlassmanagement_datum_check CHECK (
    (entlassmanagement IS TRUE AND entlassungsdatum IS NOT NULL
      AND is_blanko IS NOT TRUE AND rezept_typ IS DISTINCT FROM 'blanko')
    OR (entlassmanagement IS NOT TRUE AND entlassungsdatum IS NULL)
  );

COMMENT ON COLUMN public.prescriptions.entlassmanagement IS
  $$Bestaetigtes Entlassmanagement: NULL ungeprueft, false ausdruecklich nein, true ja. Kein stiller Standardwert. Ab belegnummer festgeschrieben (0112).$$;
COMMENT ON COLUMN public.prescriptions.entlassungsdatum IS
  $$Bestaetigtes Entlassungsdatum; genau bei entlassmanagement=true erforderlich. Fristen prueft die versionierte Fachlogik. Ab belegnummer festgeschrieben (0112).$$;

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
  -- 0112: bestaetigte Entlassmanagement-Angaben
  or new.entlassmanagement    is distinct from old.entlassmanagement
  or new.entlassungsdatum     is distinct from old.entlassungsdatum
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
