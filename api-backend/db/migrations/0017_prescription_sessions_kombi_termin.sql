-- Ops-Karte 42a66a3b — Kombi-Termin (zwei Heilmittel, ein Termin) war seit dem
-- 17.08.2026 still kaputt.
--
-- Problem
-- ───────
-- `uniq_prescription_sessions_booking` stand auf (prescription_id, booking_id)
-- WHERE booking_id IS NOT NULL. Gedacht war: „ein Termin hat je Verordnung
-- genau eine Sitzungszeile" (Befund 12.08.2026 — doppelte Abrechnungspositionen).
--
-- Seit dem Kombi-Termin stimmt diese Annahme nicht mehr. Zieht die Praxis zwei
-- offene Einheiten DERSELBEN Verordnung — etwa „KG" und „Manuelle Therapie",
-- also zwei verschiedene `heilmittel_index` — auf denselben Termin, dann wollen
-- beide Zeilen dasselbe Paar (prescription_id, booking_id) tragen. Der Index
-- verbietet das. Und weil dashboard.js beide Zeilen in EINEM Statement
-- verknüpft (`.in('id', ids)`), scheiterte nicht nur die zweite, sondern
-- KEINE der beiden wurde gebunden — während die Maske „gespeichert" meldete.
-- Der Fehler stand allein in console.error.
--
-- Entscheidung
-- ────────────
-- Der Index wird nicht abgeschafft, sondern um die Spalte erweitert, die genau
-- diese Unterscheidung schon trägt: `heilmittel_index`. Sie existiert seit dem
-- Kombi-Termin und sagt, welches Heilmittel der Verordnung die Zeile meint.
--
--   ALT:  (prescription_id, booking_id)
--   NEU:  (prescription_id, booking_id, COALESCE(heilmittel_index, 0))
--
-- Was weiterhin verboten bleibt, ist der Fall, um den es dem alten Index ging:
-- ZWEIMAL DASSELBE Heilmittel derselben Verordnung an einem Termin. Das wäre
-- eine doppelte Abrechnungsposition. Zwei VERSCHIEDENE Heilmittel an einem
-- Termin sind dagegen fachlich richtig und werden auch zweimal abgerechnet.
--
-- Warum COALESCE und nicht die Spalte pur
-- ───────────────────────────────────────
-- `heilmittel_index` ist NULLABLE (DEFAULT 0, aber ohne NOT NULL). In einem
-- UNIQUE-Index gilt NULL <> NULL — zwei Zeilen mit NULL kollidieren also NIE.
-- Ohne COALESCE hätte die Erweiterung den Schutz für den gesamten Altbestand
-- lautlos abgeschaltet: genau der Fehler, den der alte Index verhindern sollte,
-- wäre wieder möglich geworden, nur unsichtbar. Mit COALESCE(…, 0) zählt eine
-- NULL-Zeile wie Index 0 — das ist auch die Bedeutung, die der Anwendungscode
-- ihr überall gibt (`s.heilmittel_index ?? 0`).
--
-- Kann diese Migration an Altdaten scheitern?
-- ───────────────────────────────────────────
-- Nein. Der neue Index ist echt SCHWÄCHER als der alte: jedes Paar, das den
-- alten passiert hat, passiert auch den neuen. Ein Zeilenpaar, das jetzt
-- kollidieren würde, hätte schon vorher kollidiert und kann deshalb gar nicht
-- in der Tabelle stehen.
--
-- Reihenfolge: erst anlegen, dann den alten löschen — so ist die Tabelle zu
-- keinem Zeitpunkt ungeschützt. Beides in einer Transaktion (Kural 5).
--
-- Der zweite Index, `codex_192_prescription_sessions_booking_idx`
-- (nur `booking_id` WHERE booking_id IS NOT NULL, NICHT unique — Nachschlage-
-- index der Absage-Trigger, #192), steht auf anderen Spalten und wird bewusst
-- nicht angefasst.
--
-- ZAEHLER: unveraendert (+1 Index, -1 Index — netto 0; keine Tabelle/Policy/
--          Funktion/Trigger, keine storage.*/auth.*-Aenderung).

CREATE UNIQUE INDEX IF NOT EXISTS uniq_prescription_sessions_booking_hm
  ON public.prescription_sessions
  (prescription_id, booking_id, COALESCE(heilmittel_index, 0))
  WHERE (booking_id IS NOT NULL);

COMMENT ON INDEX public.uniq_prescription_sessions_booking_hm IS
  'Ein Termin = eine Sitzungszeile je Verordnung UND Heilmittel. Verhindert doppelte Abrechnungspositionen (Befund 12.08.2026) und laesst den Kombi-Termin zu (Ops 42a66a3b, 16.09.2026). COALESCE, weil heilmittel_index NULLABLE ist und NULL in UNIQUE nicht kollidiert.';

DROP INDEX IF EXISTS public.uniq_prescription_sessions_booking;
