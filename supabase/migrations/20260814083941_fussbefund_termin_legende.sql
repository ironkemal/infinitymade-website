-- Fußbefund: Bindung an den Termin + praxiseigene Legende
--
-- 1) booking_id  — Ein Befund gehört zu genau einem Termin. Bisher hing er an
--    einem frei gewählten Datum; damit liess sich der Verlauf nicht mit der
--    Behandlungsserie zusammenbringen. NULL bleibt erlaubt: Altbestand und
--    Befunde ohne Termin (Erstkontakt, Nacherfassung).
--
-- 2) uebernommen_von — Herkunft. Ein Folgebefund wird als KOPIE des vorherigen
--    angelegt, nie als Referenz: die Dokumentation eines vergangenen Termins
--    darf sich nicht rückwirkend ändern. Diese Spalte hält nur fest, WOVON
--    kopiert wurde, sie verändert nichts an der Kopie.
--
-- 3) profiles.fussbefund_legende — Was ✕, ◯, ● auf der Fußgrafik bedeuten,
--    entscheidet die Praxis, nicht wir (Nausad, 12.08.2026). Owner-Ebene, also
--    profiles und nicht businesses (Einzelstandort-Owner haben dort keine Zeile).

alter table public.pat_fussbefund
  add column if not exists booking_id uuid
    references public.bookings(id) on delete set null,
  add column if not exists uebernommen_von uuid
    references public.pat_fussbefund(id) on delete set null;

-- Ein Termin trägt höchstens einen Befund. Ohne das entstehen beim doppelten
-- Speichern zwei Karten für denselben Termin und der Verlauf wird unlesbar.
create unique index if not exists pat_fussbefund_booking_uidx
  on public.pat_fussbefund (booking_id)
  where booking_id is not null;

alter table public.profiles
  add column if not exists fussbefund_legende jsonb not null default '[]'::jsonb;

comment on column public.pat_fussbefund.booking_id is
  'Termin, zu dem dieser Befund gehört. NULL = ohne Termin erfasst.';
comment on column public.pat_fussbefund.uebernommen_von is
  'Befund, aus dem dieser als Kopie hervorgegangen ist (nur Herkunft, keine Bindung).';
comment on column public.profiles.fussbefund_legende is
  'Praxiseigene Legende der Fußgrafik: [{id,symbol,color,label}]. Leer = Standard.';
