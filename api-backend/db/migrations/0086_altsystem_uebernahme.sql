-- SaaS: angewandt 21.10.2026 (MCP: 20261021104136, Beratung db-ustasi + gkv-302 + onprem O-210: GEÇER; Spalten, CHECKs und Festschreibung live geprüft)
-- 0086: Übernahme halb behandelter Podologie-Verordnungen aus der Altsoftware (Schritt 2).
-- Anlass: Kemal 21.10.2026; Regeln gkv-302 21.10.2026 (wissensbank/SPEC-RULES.md
-- „Übernahme teilweise erbrachter VOs (Fall B/C)"), Schema db-ustasi 21.10.2026.
-- Nur Ergänzungen (Kural 4): neue Spalten mit Default/NULL, Festschreibung um eine Zeile erweitert.

-- 1) Herkunft einer Behandlungszeile. 'altsystem' = im bisherigen Programm erbracht und
--    in Praxura nachgetragen (Datum + HPNR); wie jede Zeile unveränderlich (§ 630f).
ALTER TABLE public.podologie_behandlungen
  ADD COLUMN IF NOT EXISTS herkunft text NOT NULL DEFAULT 'praxura';
ALTER TABLE public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_herkunft_check CHECK (herkunft IN ('praxura', 'altsystem'));
COMMENT ON COLUMN public.podologie_behandlungen.herkunft IS
  'praxura = in Praxura erbracht; altsystem = im bisherigen Programm erbracht, nachgetragen beim Praxiswechsel (Datum + HPNR, employee_id NULL). Festgeschrieben.';

CREATE OR REPLACE FUNCTION public.podologie_behandlungen_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.behandlungsdatum  is distinct from old.behandlungsdatum
  or new.hpnr_codes        is distinct from old.hpnr_codes
  or new.diagnosegruppe    is distinct from old.diagnosegruppe
  or new.lokalisation      is distinct from old.lokalisation
  or new.notizen           is distinct from old.notizen
  or new.betrag_gkv        is distinct from old.betrag_gkv
  or new.owner_id          is distinct from old.owner_id
  or new.created_at        is distinct from old.created_at
  or new.herkunft          is distinct from old.herkunft
  then
    raise exception 'Dokumentierte Behandlung ist unveraenderlich (§ 630f Abs. 1 S. 2 BGB). Eine Korrektur erfolgt durch Stornierung mit Grund und eine neue Behandlungszeile.';
  end if;

  if old.storniert_am is not null
     and (new.storniert_am  is distinct from old.storniert_am
       or new.storno_grund  is distinct from old.storno_grund
       or new.storniert_von is distinct from old.storniert_von)
  then
    raise exception 'Eine Stornierung laesst sich nicht zuruecknehmen oder aendern (§ 630f Abs. 1 S. 2 BGB).';
  end if;

  if new.verordnung_id is not null
     and new.verordnung_id is distinct from old.verordnung_id
  then
    raise exception 'Die Zuordnung zur Verordnung ist festgeschrieben und kann nur aufgehoben (NULL), nicht umgehaengt werden.';
  end if;

  if old.employee_id is not null
     and new.employee_id is not null
     and new.employee_id is distinct from old.employee_id
  then
    raise exception 'Die durchfuehrende Person ist festgeschrieben und kann nicht ausgetauscht werden.';
  end if;

  return new;
end $function$;

-- 2) Vorgeschichte des Patienten aus dem bisherigen Programm — nur Daten von VOs, die das
--    Altsystem SELBST abgerechnet hat (Tage übernommener VOs stehen als Behandlungszeilen).
--    Gelesen von den Einmaligkeitsregeln 78040/78100/Erstbefundung je Nagel.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS podo_vorgeschichte_erste_beh_am date,
  ADD COLUMN IF NOT EXISTS podo_vorgeschichte_78040_am date,
  ADD COLUMN IF NOT EXISTS podo_vorgeschichte_78100_am date,
  ADD COLUMN IF NOT EXISTS podo_vorgeschichte_naegel jsonb,
  ADD COLUMN IF NOT EXISTS podo_vorgeschichte_erfasst_am timestamptz;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_podo_vorgeschichte_naegel_check
  CHECK (podo_vorgeschichte_naegel IS NULL OR jsonb_typeof(podo_vorgeschichte_naegel) = 'object');
COMMENT ON COLUMN public.leads.podo_vorgeschichte_erste_beh_am IS 'Erste podologische Behandlung in dieser Praxis im Altsystem (78040-Anspruch, Anlage 1a Teil 1 Nr. 2).';
COMMENT ON COLUMN public.leads.podo_vorgeschichte_78040_am IS 'Eingangsbefundung 78040 im Altsystem, falls erbracht.';
COMMENT ON COLUMN public.leads.podo_vorgeschichte_78100_am IS 'Letzte 78100 im Altsystem (einmal je Patient und Kalenderjahr, Anlage 1c Teil 1 Nr. 5 I.1).';
COMMENT ON COLUMN public.leads.podo_vorgeschichte_naegel IS 'Je Nagel (Schlüssel wie prescriptions.nagel): {"erstbefundung":{"code":"78100|78110","am":"YYYY-MM-DD"},"abschluss_78520_am":"YYYY-MM-DD"} (§ 3b lit. a).';
COMMENT ON COLUMN public.leads.podo_vorgeschichte_erfasst_am IS 'Wann die Vorgeschichte erfasst wurde (Beleg).';

-- 3) Im Altsystem schon kassierte Zuzahlung einer übernommenen VO (Vermerk, kein Beleg —
--    das Geld steht im Kassenbuch des Altsystems; Praxura kassiert nur den Rest, Vertrag § 8).
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS zuzahlung_altsystem_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS zuzahlung_altsystem_am date,
  ADD COLUMN IF NOT EXISTS zuzahlung_altsystem_beleg text;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_altsystem_check CHECK (zuzahlung_altsystem_eur IS NULL OR zuzahlung_altsystem_eur >= 0);
COMMENT ON COLUMN public.prescriptions.zuzahlung_altsystem_eur IS 'Im Altsystem schon kassierte Zuzahlung dieser übernommenen VO; Praxura kassiert Soll minus Vermerk (gkv-302 21.10.2026).';
