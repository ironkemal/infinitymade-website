-- Ops-Karte #167 — `prescriptions` hatte nie eine GoBD-/§302-Festschreibung.
--
-- Alle anderen §302-Tabellen (belegliste, zuzahlung_korrekturen,
-- rechnung_zahlungen, abrechnung_zeile, abrechnung_zahlung,
-- booking_status_korrekturen) sind seit 09.09.2026 per BEFORE-Trigger gegen
-- stille nachtraegliche Aenderung geschuetzt. `prescriptions` — die Tabelle,
-- aus der die DTA-Datei ueberhaupt gebaut wird — war die einzige Luecke
-- (db/SCHEMA-RLS.sql:895-914, dort seit dem 04.09.2026-Merge als
-- "OFFENE LUECKE" markiert).
--
-- Die alte `verordnung_festschreibung()` (verwaist, siehe
-- 0000_baseline.sql:2374-2405) schuetzte nur die Podologie-Spalten der
-- damaligen `verordnungen`-Tabelle. Physio/Ergo/Logo hatte NIE einen
-- Festschreibungs-Schutz. `prescriptions_festschreibung()` schliesst beide
-- Luecken in einem Trigger.
--
-- Kapı: wie beim alten Vorbild — `OLD.belegnummer IS NULL` laesst jede
-- Aenderung durch (ein Entwurf vor der Einreichung ist frei editierbar).
-- Erst sobald belegnummer gesetzt ist (Datei wurde gebaut), greift die
-- Sperre. Ops #247 schreibt zuzahlung_eur in DERSELBEN Transaktion wie
-- belegnummer (siehe abrechnung.routes.js "Belegnummer einfrieren") — zu dem
-- Zeitpunkt ist OLD.belegnummer noch NULL, die Zeile passiert also das Tor.
--
-- Kolonlisten-Entscheidung: db-ustasi (Schema) + gkv-302 (welche Felder sind
-- abrechnungsrelevant) + legal-de (DSGVO-Anonymisierungs-Ausnahme),
-- Konsultation 2026-09-17.
--
-- Gesperrt (Identitaet/Mandant + Abrechnungsinhalt, alle Fachbereiche):
--   owner_id, business_id, created_at — Mandantenschutz, gleiche Begruendung
--     wie fn_abrechnung_zeile_festschreibung(): ohne sie liesse sich eine
--     eingereichte Zeile einem fremden Mandanten umhaengen.
--   belegnummer, ausstellungsdatum, diagnosegruppe, icd10, icd10_2,
--   icd10_enc, leitsymptomatik, pat_leitsymptomatik, is_dringend,
--   hausbesuch, frequenz, rezeptart, zuzahlung_befreit, zuzahlung_eur,
--   kostentraeger_ik, arzt_id, wagner_grad, nagel, krankenkasse_ik,
--   behandlungsanlass — Podologie-Abrechnungsinhalt (teils 04.09.2026 aus
--   der gedroppten `verordnungen` uebernommen).
--   heilmittel, heilmittel_position, anzahl_einheiten, doctor_lanr,
--   doctor_bsnr, rezept_typ, is_blanko, is_lhb_bvb, behandlungsbeginn,
--   gueltig_bis — Physio/Ergo/Logo-Abrechnungsinhalt, erstmals geschuetzt.
--
-- Anonymisierungs-Ausnahme (DSGVO, legal-de 2026-09-17, gleiche Form wie
-- fn_abrechnung_zeile_festschreibung): patient_name, versichertennummer,
-- patient_id duerfen NUR auf NULL gesetzt werden, nie auf einen anderen
-- Wert. Hinweis aus der Konsultation: `prescriptions` steht heute in
-- api/dsgvo.js DELETE_TABLES (Hard-Delete, nicht ANONYMIZE_TABLES) — ein
-- BEFORE-UPDATE-Trigger sieht ein DELETE nie, blockiert die Loeschkette also
-- so oder so nicht. Die Ausnahme steht trotzdem hier, fuer Konsistenz mit
-- dem abrechnung_zeile-Muster und falls `prescriptions` spaeter (offene
-- Folgefrage, gkv-302+legal-de) auf Anonymisierung statt Hard-Delete
-- umgestellt wird.
--
-- Bewusst OFFEN (Post-Belegnummer-Ereignisse — Absetzung-Nachbearbeitung,
-- Storno, Zuzahlung kassiert, Mahnwesen — Sperre dieser Spalten wuerde die
-- Folgeprozesse blockieren, dasselbe Muster wie bei abrechnung_zeile):
--   abrechnung_status, absetzung_betrag, absetzung_grund, absetzung_am,
--   storno_grund, storno_am, zuzahlung_kassiert_am, zuzahlung_kassiert_von,
--   zuzahlung_kassiert_eur, zuzahlung_zahlart, bericht_angefordert,
--   bericht_status, deadline_reminders, dmrz_exported_at, status,
--   confirmed_by, confirmed_at — und jede hier nicht genannte Spalte.
--
-- DELETE wird NICHT geworfen (anders als abrechnung_zeile) — `prescriptions`
-- hat keinen expliziten DELETE-Schutz-Auftrag in dieser Karte, und ein
-- Hard-Delete-Verbot wuerde direkt gegen den heutigen DSGVO-Loeschweg
-- (api/dsgvo.js DELETE_TABLES) laufen. Die offene Retention-Frage (gesendete
-- Verordnungen werden heute ohne Aufbewahrungsfrist komplett geloescht) ist
-- separat an gkv-302+legal-de geflaggt, nicht Teil dieser Migration.
--
-- ZAEHLER: +1 Funktion, +1 Trigger — beides strukturell, kein neues Tabelle/
--          Policy/Index, keine storage.*/auth.*-Aenderung.

CREATE FUNCTION public.prescriptions_festschreibung() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
  or new.icd10_enc            is distinct from old.icd10_enc
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
end $$;

CREATE TRIGGER trg_prescriptions_festschreibung
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.prescriptions_festschreibung();

GRANT ALL ON FUNCTION public.prescriptions_festschreibung() TO anon;
GRANT ALL ON FUNCTION public.prescriptions_festschreibung() TO authenticated;
GRANT ALL ON FUNCTION public.prescriptions_festschreibung() TO service_role;
