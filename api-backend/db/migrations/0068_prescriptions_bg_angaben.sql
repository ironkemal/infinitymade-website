-- Migration 0068_prescriptions_bg_angaben.sql
-- SaaS: angewandt 06.10.2026 (MCP: 20261006084322).
-- KHS M2.2 / PE-006 B (05.10.2026, gkv-302 + legal-de + podoloji): BG-/Arbeitsunfall-Verordnung (Podologie). BG laeuft NICHT ueber
-- §302/DTA; Rechnungsempfaenger ist der UV-Traeger. Nur belegte Angaben (Unfalltag, Aktenzeichen optional, Kostenzusage,
-- Einverstaendnis zur Uebermittlung nach § 100 SGB X / § 203 StGB); keine Diagnose/Befunde, kein Aktenzeichen-Format.
-- Alle Spalten nullable; Befuellung nur bei rezeptart='bg' (Backend, lib/rezept-felder.js bgFelderAusRezept; ein Wechsel weg von BG leert sie).
-- Bewusst NICHT in prescriptions_festschreibung (greift nur ab belegnummer, die BG/Privat nie bekommen) und NICHT in die
-- Browser-Sperre 0066 (die Maske schreibt ausschliesslich ueber das Backend). Sperre nach Rechnung: PATCH /rezept/:id (409).
-- Zusaetzlich: invoices_invoice_type_check kennt 'bg' (Rechnung an den UV-Traeger, kein Zuzahlungsabzug).
-- Keine Funktion/Trigger/Policy/Index -> Schema-Zaehler unveraendert (nur Spalten + CHECKs).

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS bg_traeger_name text,
  ADD COLUMN IF NOT EXISTS bg_traeger_anschrift text,
  ADD COLUMN IF NOT EXISTS bg_unfalltag date,
  ADD COLUMN IF NOT EXISTS bg_aktenzeichen text,
  ADD COLUMN IF NOT EXISTS bg_kostenzusage_datum date,
  ADD COLUMN IF NOT EXISTS bg_kostenzusage_zeichen text,
  ADD COLUMN IF NOT EXISTS bg_einverstaendnis_am date;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_bg_laengen_check CHECK (
    (bg_traeger_name IS NULL OR char_length(bg_traeger_name) <= 200)
    AND (bg_traeger_anschrift IS NULL OR char_length(bg_traeger_anschrift) <= 500)
    AND (bg_aktenzeichen IS NULL OR char_length(bg_aktenzeichen) <= 80)
    AND (bg_kostenzusage_zeichen IS NULL OR char_length(bg_kostenzusage_zeichen) <= 80)
  );

COMMENT ON COLUMN public.prescriptions.bg_traeger_name IS 'BG/Unfallkasse (UV-Traeger) = Rechnungsempfaenger der BG-Rechnung. Nur bei rezeptart=bg. PE-006 B.';
COMMENT ON COLUMN public.prescriptions.bg_traeger_anschrift IS 'Anschrift des UV-Traegers (mehrzeilig). Nur bei rezeptart=bg.';
COMMENT ON COLUMN public.prescriptions.bg_unfalltag IS 'Unfalltag. Pflicht erst beim Erstellen der BG-Rechnung (Frontend), nicht beim Speichern.';
COMMENT ON COLUMN public.prescriptions.bg_aktenzeichen IS 'Aktenzeichen/Schadennummer des UV-Traegers, optional, Freitext (kein Format belegt).';
COMMENT ON COLUMN public.prescriptions.bg_kostenzusage_datum IS 'Datum der Kostenzusage der BG (Podologie: kein DGUV-Vertrag, Einzelfall). Fehlt sie: Warnung, keine Sperre.';
COMMENT ON COLUMN public.prescriptions.bg_kostenzusage_zeichen IS 'Zeichen/Nummer der Kostenzusage.';
COMMENT ON COLUMN public.prescriptions.bg_einverstaendnis_am IS 'Datum des dokumentierten Patienten-Einverstaendnisses zur Uebermittlung an den UV-Traeger (§ 100 SGB X, § 203 StGB).';

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IS NULL OR (invoice_type = ANY (ARRAY['gkv'::text, 'privat'::text, 'selbstzahler'::text, 'bg'::text])));
