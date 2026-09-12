-- O-38 (onprem/REGISTER.md) — Referenzdaten für die Box: icd_sector_ranges
-- (Fachbereich `strict` filtresinin ICD aralık tablosu, search_diagnosen() içinde).
-- Basit, FK'sız, sorunsuz — dört alan da doğrudan dump.

INSERT INTO public.icd_sector_ranges (bereich, gte, lt, label, sort) VALUES
  ('ergotherapie','C00','D50','Neubildungen (Nachsorge)','8'),
  ('ergotherapie','F00','G00','Psychische Störungen (PS1-PS4, EN)','1'),
  ('ergotherapie','G00','H00','Nervensystem (EN1-EN3)','2'),
  ('ergotherapie','I60','I70','Schlaganfall (EN)','5'),
  ('ergotherapie','M00','N00','Muskel-Skelett-System (SB1-SB3)','3'),
  ('ergotherapie','Q90','R00','Chromosomenanomalien (EN)','6'),
  ('ergotherapie','R25','R30','Bewegungsstörungen','7'),
  ('ergotherapie','S00','U00','Verletzungen (SB)','4'),
  ('logopaedie','C00','C15','Kopf-Hals-Tumoren (ST, SC)','10'),
  ('logopaedie','F00','F10','Demenz (SP6)','3'),
  ('logopaedie','F80','F90','Entwicklungsstörungen Sprache (SP1-SP5)','2'),
  ('logopaedie','G00','H00','Nervensystem (SP, SC, RE)','4'),
  ('logopaedie','H90','H92','Hörstörungen (SP)','11'),
  ('logopaedie','I60','I70','Schlaganfall (SP, SC)','5'),
  ('logopaedie','J30','J40','Obere Atemwege','6'),
  ('logopaedie','J38','J39','Stimmlippen & Kehlkopf (ST)','7'),
  ('logopaedie','Q35','Q39','Lippen-Kiefer-Gaumenspalte (SF)','8'),
  ('logopaedie','R13','R14','Dysphagie (SC)','9'),
  ('logopaedie','R47','R50','Sprech-/Sprachstörungen (SP, RE)','1'),
  ('physiotherapy','C00','D50','Neubildungen (LY, Nachsorge)','13'),
  ('physiotherapy','F70','F80','Intelligenzminderung (GE)','9'),
  ('physiotherapy','G00','H00','Nervensystem (ZN, PN, GE)','2'),
  ('physiotherapy','I60','I70','Zerebrovaskulär (ZN1/ZN2)','4'),
  ('physiotherapy','I80','I90','Venen & Lymphgefäße (LY)','5'),
  ('physiotherapy','J00','K00','Atmungssystem (AT1-AT3)','6'),
  ('physiotherapy','K55','K65','Abdomen (SO)','12'),
  ('physiotherapy','M00','N00','Muskel-Skelett-System (WS, EX, CS)','1'),
  ('physiotherapy','N30','N40','Blase (SO - Inkontinenz)','11'),
  ('physiotherapy','Q65','Q80','Angeborene Fehlbildungen Bewegungsapparat','7'),
  ('physiotherapy','Q90','R00','Chromosomenanomalien (GE)','8'),
  ('physiotherapy','R25','R30','Bewegungsstörungen','10'),
  ('physiotherapy','S00','U00','Verletzungen & Traumafolgen (EX, ZN)','3'),
  ('podologie','B35','B37','Dermatomykosen / Onychomykose','8'),
  ('podologie','E08','E10','Sonstiger Diabetes','13'),
  ('podologie','E10','E15','Diabetes mellitus (DF)','1'),
  ('podologie','G60','G65','Polyneuropathien (NF)','2'),
  ('podologie','G82','G83','Querschnittlähmung (QF)','3'),
  ('podologie','I70','I80','Periphere arterielle Verschlusskrankheit','9'),
  ('podologie','L60','L61','Nagelkrankheiten (UI1/UI2)','4'),
  ('podologie','L61','L76','Krankheiten der Hautanhangsgebilde','5'),
  ('podologie','L84','L86','Klavus & Hornhautverdickung','6'),
  ('podologie','L97','L99','Ulcus cruris / Haut sonstige','7'),
  ('podologie','M20','M22','Fußdeformitäten (Hallux, Hammerzehe)','10'),
  ('podologie','M79','M80','Weichteilerkrankungen Fuß','11'),
  ('podologie','Q65','Q67','Angeborene Fußdeformitäten','12')
ON CONFLICT (bereich, gte, lt) DO UPDATE SET
  label = EXCLUDED.label,
  sort = EXCLUDED.sort;

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.icd_sector_ranges;
  IF n < 45 THEN RAISE EXCEPTION 'seed icd_sector_ranges: % Zeilen, erwartet >= 45', n; END IF;
END $$;
