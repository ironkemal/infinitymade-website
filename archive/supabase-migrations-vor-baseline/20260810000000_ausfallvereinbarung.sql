-- Ausfallvereinbarung je Patient (Loop-Liste "Kassieren", Aufgabe 8, L2)
--
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
