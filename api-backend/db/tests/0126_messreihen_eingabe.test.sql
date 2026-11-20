-- Mit psql in einer frischen, isolierten Testdatenbank ausführen.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE public.physio_befunde(id integer PRIMARY KEY);
CREATE TABLE public.messreihen (
  id text PRIMARY KEY,
  typ text NOT NULL CHECK (typ IN ('VAS','ROM','kraft','custom')),
  wert numeric(6,2) NOT NULL,
  einheit text NOT NULL,
  koerperteil text,
  befund_id integer REFERENCES public.physio_befunde(id) ON DELETE SET NULL
);
INSERT INTO public.physio_befunde VALUES (1);
INSERT INTO public.messreihen VALUES ('Chrome1911-Alt', 'VAS', 15, 'Punkte', NULL, 1);
\ir ../migrations/0126_messreihen_eingabe.sql

DELETE FROM public.physio_befunde WHERE id = 1;
DO $$
DECLARE
  fall record;
  regel text;
BEGIN
  IF NOT EXISTS (SELECT FROM public.messreihen WHERE id = 'Chrome1911-Alt' AND wert = 15 AND befund_id IS NULL) THEN
    RAISE EXCEPTION 'Historische Messung oder technische Entkopplung verloren';
  END IF;
  FOR fall IN SELECT * FROM (VALUES
     ('VAS', 11, '/ 10', 'Knie'), ('ROM', 361, '°', 'Knie'),
     ('kraft', 6, 'MFT', 'Hand'), ('kraft', -1, 'kg', 'Hand'),
     ('VAS', 5, '/ 10', ' ')
  ) AS fall(typ,wert,einheit,koerperteil) LOOP
    BEGIN
      INSERT INTO public.messreihen VALUES ('Chrome1911-Neu', fall.typ, fall.wert, fall.einheit, fall.koerperteil, NULL);
      RAISE EXCEPTION 'Ungültige Messung angenommen';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS regel = CONSTRAINT_NAME;
      IF regel <> 'messreihen_eingabe_check' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    UPDATE public.messreihen SET wert = 14 WHERE id = 'Chrome1911-Alt';
    RAISE EXCEPTION 'Ungültige fachliche Korrektur angenommen';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  UPDATE public.messreihen SET wert = 10, koerperteil = 'Knie' WHERE id = 'Chrome1911-Alt';
  INSERT INTO public.messreihen VALUES ('Chrome1911-Neu', 'kraft', 5, 'MFT', 'Hand', NULL);
END;
$$;
ROLLBACK;
