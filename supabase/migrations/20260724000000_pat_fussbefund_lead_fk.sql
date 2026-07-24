-- FK pat_fussbefund.lead_id -> leads.id, damit PostgREST-Embeds (leads:lead_id(...)) funktionieren.
-- Ohne diese Beziehung schlägt die "Gespeicherte Befunde"-Tabelle mit
-- "Could not find a relationship between pat_fussbefund and leads" fehl.
alter table public.pat_fussbefund
  add constraint pat_fussbefund_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete cascade;
