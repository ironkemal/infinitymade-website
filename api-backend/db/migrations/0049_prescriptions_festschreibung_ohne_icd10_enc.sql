-- Reform 3.12 Schritt (a) — Festschreibungs-Trigger ohne icd10_enc.
--
-- WARUM: die Feldverschluesselung ist aufgegeben (Reform 3.12, guvenlik +
-- db-ustasi + legal-de 30.09.2026; Code-Schritt e9d0286). Die Spalten
-- prescriptions.icd10_enc / ocr_raw_enc / phi_encrypted werden in 0050 geleert
-- und spaeter entfernt. prescriptions_festschreibung() (0020) vergleicht aber
-- noch new.icd10_enc mit old.icd10_enc:
--   * 0050 koennte die Spalte auf eingereichten Verordnungen (belegnummer
--     gesetzt) nicht leeren — der Trigger wuerde abbrechen;
--   * nach einem DROP der Spalte wuerde jedes UPDATE einer eingereichten
--     Verordnung mit "record new has no field icd10_enc" scheitern.
-- Deshalb zuerst die Funktion ohne diese Zeile. 0020 bleibt unveraendert (SHA).
--
-- WAS: CREATE OR REPLACE mit exakt dem Live-Stand vom 01.10.2026 (inkl. der
-- spaeter ergaenzten Spalten wagner_grad, nagel, krankenkasse_ik, ...), nur die
-- icd10_enc-Zeile entfaellt. Alle uebrigen Festschreibungs-Pruefungen bleiben.
-- Trigger, Grants, search_path unveraendert.
--
-- SaaS: angewandt 01.10.2026, MCP (Freigabe Kemal 01.10.2026: "Reform 3.12 a
-- ve b migration'larini yaz ve canliya uygula").
-- ZAEHLER: counter-neutral (Funktion ersetzt, nicht neu).

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
