-- db-ustasi-Befund (11.09.2026, offen seit 16.08.2026): db/REGISTER.md sagt bei
-- nummernkreise, die Tabelle beliefere rechnung_nr, beleg_nr UND mahnung_nr —
-- eingeloest wurde nur rechnung_nr (invoices, ueber set_invoice_nummer()).
-- set_next_beleg_nr()/set_next_mahnung_nr() liefen weiter mit dem alten
-- SELECT COALESCE(MAX(...),0)+1-Muster, das nummernkreise gerade abloesen
-- sollte: zwei gleichzeitige INSERTs derselben Praxis koennen dieselbe Nummer
-- ziehen (der UNIQUE-Index faengt es als Fehler ab, vergibt aber keine zweite
-- Nummer -- kein GoBD-Verstoss, aber ein unnoetiger Fehler fuer den Benutzer).
-- Dieselbe Luecke hatte set_next_ausfallrechnung_nr() (Ausfallhonorar-
-- Rechnungsnummer, § 14 UStG) -- beim Nachzaehlen gefunden, war nicht auf der
-- urspruenglichen Liste.
--
-- Fix: alle drei auf naechste_nummer() umstellen, wie set_invoice_nummer() es
-- bereits vormacht -- SECURITY DEFINER (sonst "permission denied", seit 0002
-- hat authenticated/anon kein EXECUTE mehr auf naechste_nummer direkt) +
-- SET search_path.
--
-- p_jahr = 0 ist bewusst: beleg_nr/mahnung_nr/Ausfallrechnung-Nummer liefen nie
-- jahresweise (kein Reset), sondern fortlaufend je Inhaber -- anders als
-- rechnung_nr (jahr = Ausstellungsjahr). Ein fester Dummy-Wert 0 haelt genau
-- dieses Verhalten 1:1, ohne eine zweite Variante von naechste_nummer zu
-- brauchen (die Tabelle hat jahr NOT NULL als Teil des Primary Key -- NULL
-- wuerde bei ON CONFLICT nie matchen und den Zaehler jedes Mal auf 1
-- zuruecksetzen). Bedeutung an drei Stellen dokumentiert: hier, in den
-- COMMENT ON FUNCTION unten, und in db/REGISTER.md (db-ustasi zieht das nach).
--
-- Bewusst akzeptierte Verhaltensaenderung: nummernkreise verbraucht eine
-- Nummer auch bei einem Transaktions-Rollback (MAX+1 tat das nicht) -- eine
-- Luecke wird moeglich. GoBD verbietet Luecken nicht, verlangt nur, dass sie
-- erklaerbar sind; invoices/rechnung_nr verhaelt sich seit 16.08.2026 bereits
-- so. Das hier zieht beleg/mahnung/ausfallrechnung auf dieselbe Konsistenz.

CREATE OR REPLACE FUNCTION public.set_next_beleg_nr() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.beleg_nr := naechste_nummer(NEW.owner_id, 'beleg', 0);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_next_beleg_nr() IS 'Nutzt naechste_nummer() mit p_jahr=0 (kein Jahresbezug, fortlaufend je Inhaber -- wie vor 0003, nur ohne MAX+1-Wettlauf). Seit 0003 (11.09.2026), db-ustasi-Fund.';

CREATE OR REPLACE FUNCTION public.set_next_mahnung_nr() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.mahnung_nr := naechste_nummer(NEW.owner_id, 'mahnung', 0);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_next_mahnung_nr() IS 'Nutzt naechste_nummer() mit p_jahr=0 (kein Jahresbezug, fortlaufend je Inhaber -- wie vor 0003, nur ohne MAX+1-Wettlauf). Seit 0003 (11.09.2026), db-ustasi-Fund.';

CREATE OR REPLACE FUNCTION public.set_next_ausfallrechnung_nr() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.rechnung_nr := naechste_nummer(NEW.owner_id, 'ausfallrechnung', 0);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_next_ausfallrechnung_nr() IS 'Nutzt naechste_nummer() mit p_jahr=0 (kein Jahresbezug, fortlaufend je Inhaber -- wie vor 0003, nur ohne MAX+1-Wettlauf). Eigener Kreis "ausfallrechnung", nicht "rechnung" -- das ist invoices. Seit 0003 (11.09.2026), db-ustasi-Fund.';

-- Bestand nachziehen, damit der erste Aufruf nach dem Umschalten nicht auf den
-- UNIQUE-Index laeuft (belegliste_owner_id_beleg_nr_key /
-- mahnungen_owner_id_mahnung_nr_key / aehnlich bei ausfallrechnungen).
-- GREATEST macht das idempotent: auf einer leeren Kundenbox liefert jedes
-- SELECT null Zeilen, also No-Op; auf einem bereits einmal migrierten Bestand
-- ueberschreibt es last_nr nicht mit einem kleineren Wert.

INSERT INTO nummernkreise (owner_id, kreis, jahr, last_nr)
SELECT owner_id, 'beleg', 0, MAX(beleg_nr) FROM belegliste GROUP BY owner_id
ON CONFLICT (owner_id, kreis, jahr)
DO UPDATE SET last_nr = GREATEST(nummernkreise.last_nr, EXCLUDED.last_nr);

INSERT INTO nummernkreise (owner_id, kreis, jahr, last_nr)
SELECT owner_id, 'mahnung', 0, MAX(mahnung_nr) FROM mahnungen GROUP BY owner_id
ON CONFLICT (owner_id, kreis, jahr)
DO UPDATE SET last_nr = GREATEST(nummernkreise.last_nr, EXCLUDED.last_nr);

INSERT INTO nummernkreise (owner_id, kreis, jahr, last_nr)
SELECT owner_id, 'ausfallrechnung', 0, MAX(rechnung_nr) FROM ausfallrechnungen GROUP BY owner_id
ON CONFLICT (owner_id, kreis, jahr)
DO UPDATE SET last_nr = GREATEST(nummernkreise.last_nr, EXCLUDED.last_nr);
