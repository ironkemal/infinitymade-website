-- db-ustasi-Fund (11.09.2026, beim Abnahmetest von 0003): ausfallrechnungen hatte
-- nie ein UNIQUE (owner_id, rechnung_nr) -- anders als belegliste_owner_id_beleg_nr_key
-- und mahnungen_owner_id_mahnung_nr_key, die es seit der Baseline haben. Vor 0003
-- bedeutete das: zwei gleichzeitige INSERTs (MAX+1-Wettlauf) konnten still dieselbe
-- Rechnungsnummer vergeben -- bei beleg/mahnung waere das ein sichtbarer Fehler
-- gewesen, hier waeren zwei Rechnungen mit derselben Nummer durchgegangen. § 14
-- Abs. 4 Nr. 4 UStG verlangt eine einmalig vergebene, fortlaufende Nummer.
--
-- 0003 hat den Wettlauf selbst schon beseitigt (naechste_nummer sperrt die Zeile).
-- Diese Migration schliesst die zweite, unabhaengige Verteidigungslinie: ein
-- UNIQUE-Index, der jeden kuenftigen Schreibweg (nicht nur den heutigen Trigger)
-- daran hindert, zwei gleiche Nummern fuer denselben Inhaber abzulegen -- exakt
-- die Konsistenz, die belegliste/mahnungen bereits haben.
--
-- Geprueft vor dem Schreiben: 0 Duplikate, 0 NULL-Werte in owner_id/rechnung_nr
-- (Stand 11.09.2026) -- der Index kann konfliktfrei gebaut werden.

ALTER TABLE public.ausfallrechnungen
  ADD CONSTRAINT ausfallrechnungen_owner_id_rechnung_nr_key UNIQUE (owner_id, rechnung_nr);
