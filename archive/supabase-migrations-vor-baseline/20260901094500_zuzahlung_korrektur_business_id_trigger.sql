-- Zweiter Nachtrag zu 20260831120000_zuzahlung_korrektur.
--
-- Die beiden neuen Tabellen hatten `business_id`, aber keinen Trigger, der ihn
-- füllt — anders als alle 25 anderen Tabellen mit dieser Spalte
-- (set_business_id_default(), gebunden über trg_set_business_id). Der Trigger
-- ist ein reiner Rückfall (WHEN NEW.business_id IS NULL): ein von der Route
-- explizit mitgegebener Wert bleibt unberührt, fehlt er, wird der Default-
-- Standort des Owners eingesetzt. Ohne ihn blieb business_id bei jedem
-- Einfügeweg NULL, der ihn nicht selbst mitgibt — und in einem Mehr-Standort-
-- Betrieb wäre eine Korrektur/ein Guthaben damit keinem Standort zuzuordnen.

CREATE TRIGGER trg_set_business_id
  BEFORE INSERT ON public.zuzahlung_korrekturen
  FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();

CREATE TRIGGER trg_set_business_id
  BEFORE INSERT ON public.zuzahlung_guthaben
  FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();
