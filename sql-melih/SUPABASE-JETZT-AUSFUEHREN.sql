-- =============================================================================
-- SAMMELSKRIPT — jetzt im Supabase SQL-Editor ausführen
-- Projekt: njvuclullotbksskpwgk (Produkt, NICHT das Ops-Projekt)
-- Stand: 10.08.2026
-- =============================================================================
--
-- ANLASS: Der Code wurde bereits gepusht und ist live (Vercel sofort, Backend
-- über Watchtower nach ~60 s), die Spalten fehlen in der Datenbank aber noch.
-- Solange dieses Skript nicht gelaufen ist, sind kaputt:
--   1. Kassieren            → belegliste.zahlart / prescriptions.zuzahlung_zahlart
--   2. Ausfallrechnung      → leads.ausfallvereinbarung_am
--   3. Mahnwesen-Bildschirm → mahnungen.ausfallrechnung_id
--
-- Fasst zusammen:
--   database_v32_kassieren_zahlart.sql                        (Aufgabe 1)
--   supabase/migrations/20260810000000_ausfallvereinbarung.sql (Aufgabe 8)
--   supabase/migrations/20260810010000_mahnwesen_ausfall.sql   (Aufgabe 9)
--
-- Wer die Einzeldateien schon ausgeführt hat, kann dieses Skript trotzdem
-- laufen lassen: alles ist IF NOT EXISTS / DROP IF EXISTS, also gefahrlos
-- wiederholbar. Es werden keine Bestandsdaten verändert oder gelöscht.
--
-- Läuft als eine Transaktion — bricht ein Schritt ab, bleibt nichts halb getan.
-- =============================================================================

BEGIN;

-- =============================================================================
-- TEIL 1 — v32: Zahlart beim Kassieren
-- =============================================================================
-- Bestandsdaten bekommen NULL. Das ist gewollt: für Altbelege ist die Zahlart
-- nicht bekannt und darf nicht erfunden werden.

-- 1.1 Kassenbuch: Zahlart am Beleg
--     Die belegliste ist per Trigger unveränderlich (v27). Das betrifft nur
--     Zeilen (UPDATE/DELETE), nicht die Tabellenstruktur — ADD COLUMN geht.
ALTER TABLE public.belegliste
  ADD COLUMN IF NOT EXISTS zahlart TEXT;

ALTER TABLE public.belegliste
  DROP CONSTRAINT IF EXISTS belegliste_zahlart_check;
ALTER TABLE public.belegliste
  ADD CONSTRAINT belegliste_zahlart_check
  CHECK (zahlart IS NULL OR zahlart IN ('bar', 'ec', 'ueberweisung', 'sonstiges'));

COMMENT ON COLUMN public.belegliste.zahlart IS
  'Zahlungsart des Belegs: bar | ec | ueberweisung | sonstiges. NULL = Altbeleg vor v32.';

-- 1.2 Rezept: Zahlart der kassierten Zuzahlung
--     Redundant zum Beleg, aber das Termin-Panel zeigt die Zuzahlung direkt aus
--     prescriptions an. Ohne diese Spalte bräuchte jede Terminansicht einen
--     zusätzlichen Join auf belegliste.
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS zuzahlung_zahlart TEXT;

ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_zuzahlung_zahlart_check;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_zahlart_check
  CHECK (zuzahlung_zahlart IS NULL OR zuzahlung_zahlart IN ('bar', 'ec', 'ueberweisung', 'sonstiges'));

COMMENT ON COLUMN public.prescriptions.zuzahlung_zahlart IS
  'Zahlungsart, mit der die Zuzahlung kassiert wurde. Gehört zu zuzahlung_kassiert_am/_von.';

-- 1.3 Index für die Monatsübersicht (Aufgabe 6)
--     statistik.routes.js sucht Rezepte mit offener Zuzahlung. Ohne Index ist
--     das ein Full Scan über alle Rezepte des Mandanten.
CREATE INDEX IF NOT EXISTS idx_prescriptions_zuzahlung_offen
  ON public.prescriptions (owner_id, ausstellungsdatum)
  WHERE zuzahlung_eur > 0 AND zuzahlung_befreit = false;


-- =============================================================================
-- TEIL 2 — Ausfallvereinbarung je Patient (Aufgabe 8)
-- =============================================================================
-- Die Ausfallrechnung nimmt im Text Bezug auf "die mit Ihnen getroffene
-- Ausfallvereinbarung" — genau diese Unterschrift ist die Voraussetzung dafür,
-- dass die Forderung durchsetzbar ist. Bisher wusste das System nichts davon.
--
-- Bewusst NUR ein Datum, kein Dokumentenupload: viele Praxen führen die
-- Vereinbarung auf Papier. Fehlt das Datum, warnt die Oberfläche sichtbar,
-- blockiert aber nicht (Entscheidung Melih, 10.08.2026).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ausfallvereinbarung_am date;

COMMENT ON COLUMN public.leads.ausfallvereinbarung_am IS
  'Datum, an dem der Patient die Ausfallvereinbarung unterschrieben hat. NULL = liegt nicht vor bzw. nicht erfasst; die Ausfallrechnung wird dann nur mit Warnhinweis erstellt.';


-- =============================================================================
-- TEIL 3 — Mahnungen auch für Ausfallrechnungen (Aufgabe 9)
-- =============================================================================
-- Blocker war: mahnungen.prescription_id ist NOT NULL (database_v28_mahnwesen),
-- eine Ausfallrechnung hat aber kein Rezept.
--
-- Eine Mahnung bezieht sich künftig auf GENAU EINE Quelle: entweder auf ein
-- Rezept (offene Zuzahlung) oder auf eine Ausfallrechnung. Der CHECK verhindert
-- beides gleichzeitig und auch keines von beidem.
--
-- Bestandszeilen sind unkritisch: sie haben alle prescription_id gesetzt und
-- ausfallrechnung_id NULL, erfüllen den CHECK also bereits.

ALTER TABLE public.mahnungen
  ALTER COLUMN prescription_id DROP NOT NULL;

ALTER TABLE public.mahnungen
  ADD COLUMN IF NOT EXISTS ausfallrechnung_id uuid
    REFERENCES public.ausfallrechnungen(id) ON DELETE CASCADE;

ALTER TABLE public.mahnungen
  DROP CONSTRAINT IF EXISTS mahnungen_genau_eine_quelle;
ALTER TABLE public.mahnungen
  ADD CONSTRAINT mahnungen_genau_eine_quelle
    CHECK (num_nonnulls(prescription_id, ausfallrechnung_id) = 1);

CREATE INDEX IF NOT EXISTS idx_mahnungen_ausfall
  ON public.mahnungen (ausfallrechnung_id);

COMMENT ON COLUMN public.mahnungen.ausfallrechnung_id IS
  'Gemahnte Ausfallrechnung. Genau eines von prescription_id / ausfallrechnung_id ist gesetzt (CHECK mahnungen_genau_eine_quelle).';

COMMIT;


-- =============================================================================
-- KONTROLLE — separat ausführen. Alle fünf Zeilen müssen "true" zeigen.
-- =============================================================================
-- SELECT 'v32 belegliste.zahlart' AS pruefung,
--        EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_schema='public' AND table_name='belegliste'
--                  AND column_name='zahlart') AS ok
-- UNION ALL SELECT 'v32 prescriptions.zuzahlung_zahlart',
--        EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_schema='public' AND table_name='prescriptions'
--                  AND column_name='zuzahlung_zahlart')
-- UNION ALL SELECT 'leads.ausfallvereinbarung_am',
--        EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_schema='public' AND table_name='leads'
--                  AND column_name='ausfallvereinbarung_am')
-- UNION ALL SELECT 'mahnungen.ausfallrechnung_id',
--        EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_schema='public' AND table_name='mahnungen'
--                  AND column_name='ausfallrechnung_id')
-- UNION ALL SELECT 'mahnungen.prescription_id ist jetzt nullable',
--        EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_schema='public' AND table_name='mahnungen'
--                  AND column_name='prescription_id' AND is_nullable='YES');
