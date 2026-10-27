-- Physio-Zusatzpositionen: ergänzendes Heilmittel, Hausbesuch-Ort, Doppelbehandlung,
-- schriftliche Berichtsanforderung (X1906). Physio-Feinabstimmung, 27.10.2026.
--
-- SaaS: angewendet 27.10.2026, MCP (20261027222343).
--
-- FACHLICHER GRUND (gkv-302, wissensbank/SPEC-RULES.md „Physio: Zusatzpositionen"):
--   Der Physio-Mapper (abrechnung.routes.js mapPrescriptionToDtaShape) schrieb je
--   Sitzung nur rx.heilmittel_position. Ergänzendes Heilmittel und Hausbesuch-
--   Pauschale (X9950/X9951/X9922) wurden nie abgerechnet, Doppelbehandlung gab es nicht.
--
-- MODELL (db-ustasi, 27.10.2026):
--   • ergänzend: Position je Verordnung (prescriptions.ergaenzend_position), erbracht
--     je Sitzung als Merker (prescription_sessions.ergaenzend_erbracht) — KEINE
--     eigene Sitzungszeile mit heilmittel_index=1: der Index gehört der Aufteilung
--     bis zu drei vorrangiger Heilmittel (0017), und UNIQUE (prescription_id,
--     session_number) zählt indexunabhängig.
--   • hausbesuch_ort: Kategorie je Verordnung, KEINE Adresse (onprem, keine neue PHI).
--     NULL = Altbestand → Mapper fällt auf X9950 (häuslich) zurück, kein Backfill.
--     OB an einem Tag ein Hausbesuch stattfand, sagt bookings.hausbesuch (gkv-302:
--     Pauschale je durchgeführtem Hausbesuch, Anlage 2 B(5)); der Ort je Tag ist
--     Ausnahme und bekommt erst bei Bedarf eine eigene Spalte.
--   • doppelbehandlung: boolean je Verordnung; frequenz ist Freitext, booking_requests.
--     doppelbehandlung ist der Patientenwunsch, ein anderer Begriff.
--   • X1906-Anforderung: ein Dokument → neuer art-Wert in prescription_documents.
--
-- FESTSCHREIBUNG: die neuen abrechnungsrelevanten Spalten (und die bisher fehlenden
--   ergaenzendes_heilmittel/ergaenzend_einheiten/vorrangig_einheiten) kommen in
--   prescriptions_festschreibung(). Gövde = Live-Stand (pg_get_functiondef, 27.10.2026)
--   + neue Zeilen; sonst unverändert.
--
-- ZAEHLER: counter-neutral — Spalten, CHECKs, DEFAULTs und CREATE OR REPLACE einer
--   BESTEHENDEN Funktion zählt keiner der zehn Zähler (dritte Form von Kural 6, wie
--   0043/0049). Kein Index, keine Policy, keine Tabelle, kein Trigger.

ALTER TABLE public.prescriptions
  ADD COLUMN ergaenzend_position text
    CONSTRAINT prescriptions_ergaenzend_position_format CHECK (ergaenzend_position IS NULL OR ergaenzend_position ~ '^[X0-9][0-9]{4}$'),
  ADD COLUMN hausbesuch_ort text
    CONSTRAINT prescriptions_hausbesuch_ort_check CHECK (hausbesuch_ort IS NULL OR hausbesuch_ort = ANY (ARRAY['haeuslich','soziale_einrichtung','tagespflege_kurzzeit_betreut'])),
  ADD COLUMN doppelbehandlung boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prescriptions.ergaenzend_position IS 'Physio/Ergo/Logo: Positionsnummer des ergänzenden Heilmittels (X-Vorlage wie heilmittel_position). Abgerechnet je Sitzung mit prescription_sessions.ergaenzend_erbracht.';
COMMENT ON COLUMN public.prescriptions.hausbesuch_ort IS 'Ort des Hausbesuchs als Kategorie (keine Adresse): haeuslich→X9950, soziale_einrichtung→X9951, tagespflege_kurzzeit_betreut→X9922. NULL = Altbestand, Mapper fällt auf hausbesuch zurück.';
COMMENT ON COLUMN public.prescriptions.doppelbehandlung IS 'Doppelbehandlung ausdrücklich verordnet (HeilM-RL §12 Abs. 8): eine Sitzung = zwei Einheiten, DTA eine EHE mit Anzahl 2. Nicht für ergänzende Heilmittel.';

ALTER TABLE public.prescription_sessions
  ADD COLUMN ergaenzend_erbracht boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prescription_sessions.ergaenzend_erbracht IS 'An dieser Sitzung wurde zusätzlich das ergänzende Heilmittel (prescriptions.ergaenzend_position) erbracht → eigene EHE am selben Tag.';

ALTER TABLE public.prescription_documents
  DROP CONSTRAINT prescription_documents_art_check;
ALTER TABLE public.prescription_documents
  ADD CONSTRAINT prescription_documents_art_check
  CHECK (art = ANY (ARRAY['befreiungsausweis'::text, 'lhb_genehmigung'::text, 'korrigierte_verordnung'::text,
                          'therapiebericht'::text, 'sonstiges'::text, 'berichtsanforderung'::text]));

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
