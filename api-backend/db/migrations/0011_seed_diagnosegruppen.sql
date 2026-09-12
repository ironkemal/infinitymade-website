-- O-38 (onprem/REGISTER.md) — Referenzdaten für die Box: diagnosegruppen
-- (search_diagnosen() RPC + module/diagnosegruppen-regeln.js'in kaynağı).
--
-- jsonb sütunlar (icd_accept/icd_exclude/icd_auto_select/icd_accept_unsicher) regex
-- desenleri taşıyor — bu dosya elle YAZILMADI, Postgres'in kendi format('%L', ...)
-- fonksiyonuyla üretildi ve gerçek bir Postgres'e karşı fonksiyonel olarak test
-- edildi (12.09.2026): DF kodunun ilk deseni gerçekten "E10.74"e eşleşiyor.
-- Elle bir escape denemesi burada bir yerde sessizce yanlış kaçırırdı.

INSERT INTO public.diagnosegruppen (code, label, untergruppen, icd10_codes, icd10_pflicht, befundung_erlaubt, nagelspange_erlaubt, lokalisation_pflicht, bereich, indikation, leitsymptomatik, hoechstmenge, icd_ranges, sort, aktiv, icd_accept, icd_exclude, icd_auto_select, icd_accept_unsicher) VALUES
  ('AT','Störungen der Atmung',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{J00-J99,E84}','60','t','[]','[]','[]','[]'),
  ('AT1','Störungen der Atmung (akut)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{J00-J99}','61','t','[]','[]','[]','[]'),
  ('AT2','Störungen der Atmung (chronisch)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{J40-J47,E84}','62','t','[]','[]','[]','[]'),
  ('AT3','Störungen der Atmung (Kinder)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{J00-J99,E84}','63','t','[]','[]','[]','[]'),
  ('CS','Chronifiziertes Schmerzsyndrom',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{F45.4,M79,R52}','30','t','[]','[]','[]','[]'),
  ('DF','Diabetisches Fußsyndrom','{a,b,c}','{E10.74,E10.75,E11.74,E11.75}',NULL,'t','f','f','podologie','Diabetische Neuropathie mit oder ohne Angiopathie',NULL,NULL,'{E10-E14}','10','t',E'[{"re": "^E1[0-4]\\\\.7[45]$", "note": "Diabetisches Fußsyndrom (…74 nicht entgleist / …75 entgleist)"}, {"re": "^E1[0-4]\\\\.4[01]$", "note": "Diabetes mellitus mit neurologischen Komplikationen = diabetische Neuropathie"}, {"re": "^G63\\\\.2\\\\*?$", "note": "Diabetische Polyneuropathie — Sternkode, allein nicht kodierfähig: Primärkode fehlt (E1x.4x†)"}]','[]',E'[{"re": "^E1[0-4]\\\\.7[45]$"}, {"re": "^E1[0-4]\\\\.4[01]$"}, {"re": "^G63\\\\.2\\\\*?$"}]',E'[{"re": "^E1[0-4]\\\\.7[23]$", "note": "Sonstige multiple Komplikationen — ein diabetisches Fußsyndrom ist damit nicht ausdrücklich angegeben"}]'),
  ('EN1','ZNS-Erkrankungen (Gehirn) / Entwicklungsstörungen',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{G00-G99,I60-I69,F80-F89,Q90}','20','t','[]','[]','[]','[]'),
  ('EN2','ZNS-Erkrankungen (Rückenmark) / Neuromuskuläre Erkrankungen',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{G82,G12,G70-G73}','21','t','[]','[]','[]','[]'),
  ('EN3','Periphere Nervenläsionen / Muskelerkrankungen',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{G50-G64,G70-G73}','22','t','[]','[]','[]','[]'),
  ('EX','Erkrankungen der Extremitäten und des Beckens',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{M00-M25,M60-M99,S00-T98}','20','t','[]','[]','[]','[]'),
  ('EX1','Erkrankungen der Extremitäten und des Beckens (akut)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{M00-M25,S00-T98}','21','t','[]','[]','[]','[]'),
  ('EX2','Erkrankungen der Extremitäten und des Beckens (prolongierter Verlauf)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{M00-M25,S00-T98}','22','t','[]','[]','[]','[]'),
  ('EX3','Erkrankungen der Extremitäten und des Beckens (schwer/postoperativ)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'10','{M00-M25,S00-T98}','23','t','[]','[]','[]','[]'),
  ('EX4','Erkrankungen der Extremitäten und des Beckens (schwerste Schädigung)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'10','{M00-M25,S00-T98}','24','t','[]','[]','[]','[]'),
  ('GE','Arterielle Gefäßerkrankungen',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{I70-I79}','70','t','[]','[]','[]','[]'),
  ('LY','Lymphabflussstörungen',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{I87,I89,Q82.0,C00-C97}','80','t','[]','[]','[]','[]'),
  ('LY1','Lymphabflussstörungen (Stadium I)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{I87,I89,Q82.0}','81','t','[]','[]','[]','[]'),
  ('LY2','Lymphabflussstörungen (Stadium II/III)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{I87,I89,Q82.0}','82','t','[]','[]','[]','[]'),
  ('LY3','Lymphabflussstörungen (schwerwiegend, z. B. postoperativ)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'10','{I87,I89,C00-C97}','83','t','[]','[]','[]','[]'),
  ('NF','Krankhafte Schädigung am Fuß als Folge einer sensiblen oder sensomotorischen Neuropathie',NULL,'{G60.0,G63.2,E10.40,E11.40}',NULL,'t','f','f','podologie','Primär oder sekundär',NULL,NULL,'{G60-G64,E10-E14}','20','t',E'[{"re": "^G60\\\\.", "note": "Hereditäre und idiopathische Neuropathie"}, {"re": "^G61\\\\.", "note": "Polyneuritis"}, {"re": "^G62\\\\.", "note": "Sonstige Polyneuropathien (G62.8- ist fünfstellig: G62.80/G62.88)"}, {"re": "^G63\\\\.[013-68]\\\\*?$", "note": "Polyneuropathie bei anderenorts klassifizierten Krankheiten — Sternkode (G63.2 ausgenommen, gehört nach DF)"}]',E'[{"re": "^G63\\\\.2\\\\*?$", "note": "Diabetische Polyneuropathie gehört zur Diagnosegruppe DF, nicht NF"}, {"re": "^E1[0-4]\\\\.", "note": "Diabetes-Kodes gehören zur Diagnosegruppe DF, nicht NF"}]',E'[{"re": "^G6[012]\\\\."}, {"re": "^G63\\\\.[013-68]\\\\*?$"}]',E'[{"re": "^G90\\\\.", "note": "Krankheiten des autonomen Nervensystems — nach § 27 Abs. 1 Nr. 2b ein zusätzliches Kriterium, für sich genommen weder sensibel noch sensomotorisch"}, {"re": "^G58\\\\.", "note": "Sonstige Mononeuropathien"}, {"re": "^M3[0-5]", "note": "Kollagenose — in der HeilM-RL als Beispiel genannt, erklärt selbst aber keine Neuropathie (therapierelevant wäre G63.5*)"}]'),
  ('PN','Periphere Nervenläsionen / Muskelerkrankungen',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'10','{G50-G64,G70-G73}','50','t','[]','[]','[]','[]'),
  ('PS1','Entwicklungs-, Verhaltens- und emotionale Störungen mit Beginn in Kindheit und Jugend',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{F80-F98}','30','t','[]','[]','[]','[]'),
  ('PS2','Neurotische, Belastungs-, somatoforme und Persönlichkeitsstörungen',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{F40-F48,F60-F69}','31','t','[]','[]','[]','[]'),
  ('PS3','Wahnhafte und affektive Störungen / Abhängigkeitserkrankungen',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{F10-F19,F20-F29,F30-F39}','32','t','[]','[]','[]','[]'),
  ('PS4','Dementielle Syndrome',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{F00-F03,G30}','33','t','[]','[]','[]','[]'),
  ('QF','Krankhafte Schädigung am Fuß als Folge eines Querschnittsyndroms',NULL,'{G82.0,G82.1,G82.2,G82.3,G82.4,G82.5}',NULL,'t','f','f','podologie','Komplett oder inkomplett',NULL,NULL,'{G82}','30','t',E'[{"re": "^G82\\\\.[0-5][0-3]$", "note": "Para-/Tetraparese und -plegie, fünfstellig (x0 akut komplett, x1 akut inkomplett, x2 chronisch komplett, x3 chronisch inkomplett)"}, {"re": "^G82\\\\.[0-5]9$", "note": "Para-/Tetraparese und -plegie, nicht näher bezeichnet"}, {"re": "^S14\\\\.1", "note": "Verletzung des zervikalen Rückenmarks"}, {"re": "^S24\\\\.1", "note": "Verletzung des thorakalen Rückenmarks"}, {"re": "^S34\\\\.1", "note": "Verletzung des lumbalen Rückenmarks"}, {"re": "^T09\\\\.3$", "note": "Verletzung des Rückenmarks, Höhe nicht näher bezeichnet"}]',E'[{"re": "^G82\\\\.6[0-9]!?$", "note": "G82.6-! beschreibt die funktionale Höhe der Schädigung — Ausrufezeichenkode, niemals Hauptdiagnose (ICD-10-GM Feld 13 = ''Z'')"}, {"re": "^G82\\\\.[0-6]-?$", "note": "Vierstellige Gruppenüberschrift, nicht endständig (§ 301 Feld 14 = ''V'')"}]',E'[{"re": "^G82\\\\.[0-5][0-39]$"}, {"re": "^S14\\\\.1"}, {"re": "^S24\\\\.1"}, {"re": "^S34\\\\.1"}, {"re": "^T09\\\\.3$"}]',E'[{"re": "^Q05\\\\.", "note": "Spina bifida — benennt die Grundkrankheit, nicht das Querschnittsyndrom"}, {"re": "^G95\\\\.0$", "note": "Syringomyelie — benennt die Grundkrankheit, nicht das Querschnittsyndrom"}, {"re": "^G04\\\\.", "note": "Myelitis — benennt die Grundkrankheit, nicht das Querschnittsyndrom"}]'),
  ('RE1','Störungen des Redeflusses (Stottern)',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{F98.5}','30','t','[]','[]','[]','[]'),
  ('RE2','Störungen des Redeflusses (Poltern)',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{F98.6}','31','t','[]','[]','[]','[]'),
  ('SB1','Erkrankungen der Wirbelsäule, Gelenke und Extremitäten (motorisch-funktionelle Schädigungen)',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{M00-M99,S00-T98}','10','t','[]','[]','[]','[]'),
  ('SB2','Erkrankungen der Wirbelsäule, Gelenke und Extremitäten (motorisch-funktionelle und sensomotorisch-perzeptive Schädigungen)',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{M00-M99,S00-T98}','11','t','[]','[]','[]','[]'),
  ('SB3','System- und Autoimmunerkrankungen mit Bindegewebe-, Muskel- und Gefäßbeteiligung',NULL,NULL,NULL,'t','f','f','ergotherapie',NULL,NULL,NULL,'{M30-M36,M05-M14}','12','t','[]','[]','[]','[]'),
  ('SC','Krankhafte Störungen des Schluckaktes',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{R13,I60-I69,G20,C00-C15}','50','t','[]','[]','[]','[]'),
  ('SF','Störungen der Stimm- und Sprechfunktion (Rhinophonie)',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{Q35-Q37,R49.2}','40','t','[]','[]','[]','[]'),
  ('SM','Segmentmassage',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{M00-M99}','95','t','[]','[]','[]','[]'),
  ('SO1','Störung der Dickdarmfunktion',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{K56-K64}','90','t','[]','[]','[]','[]'),
  ('SO2','Störungen der Ausscheidung (Stuhlinkontinenz, Harninkontinenz)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{N39,R32,R15}','91','t','[]','[]','[]','[]'),
  ('SO3','Schwindel unterschiedlicher Genese und Ätiologie',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{H81,H82,R42}','92','t','[]','[]','[]','[]'),
  ('SO4','Sekundäre periphere trophische Störungen bei Erkrankungen',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{L89,I83,E10-E14}','93','t','[]','[]','[]','[]'),
  ('SO5','Sonstige Erkrankungen (chronische Adnexitis/Prostatitis u. a.)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{N41,N70}','94','t','[]','[]','[]','[]'),
  ('SP1','Störungen der Sprache vor Abschluss der Sprachentwicklung',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{F80,R47,H90}','20','t','[]','[]','[]','[]'),
  ('SP2','Störungen der auditiven Wahrnehmung',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{F80.2,H93.2}','21','t','[]','[]','[]','[]'),
  ('SP3','Störungen der Artikulation, Dyslalie',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{F80.0,R47.8}','22','t','[]','[]','[]','[]'),
  ('SP4','Störungen des Sprechens/der Sprache bei hochgradiger Schwerhörigkeit oder Taubheit',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{H90,H91}','23','t','[]','[]','[]','[]'),
  ('SP5','Störungen der Sprache nach Abschluss der Sprachentwicklung',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{R47.0,I60-I69,F80}','24','t','[]','[]','[]','[]'),
  ('SP6','Störungen der Sprechmotorik (Dysarthrie/Dysarthrophonie/Sprechapraxie)',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{R47.1,G20,G35,I60-I69}','25','t','[]','[]','[]','[]'),
  ('ST1','Organisch bedingte Erkrankungen der Stimme',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{J38,C32,G51}','10','t','[]','[]','[]','[]'),
  ('ST2','Funktionell bedingte Erkrankungen der Stimme',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{R49,F44}','11','t','[]','[]','[]','[]'),
  ('ST3','Psychogene Aphonie',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{F44.4,R49.1}','12','t','[]','[]','[]','[]'),
  ('ST4','Psychogene Dysphonie',NULL,NULL,NULL,'t','f','f','logopaedie',NULL,NULL,NULL,'{F44.4,R49.0}','13','t','[]','[]','[]','[]'),
  ('UI1','Unguis incarnatus Stadium 1',NULL,'{L60.0}','L60.0','f','f','t','podologie','Unguis incarnatus (L60.0)',NULL,NULL,'{L60.0}','40','t',E'[{"re": "^L60\\\\.0$", "note": "Unguis incarnatus — ausschließlich zulässiger Kode"}]','[]','[]','[]'),
  ('UI2','Unguis incarnatus Stadium 2 oder 3',NULL,'{L60.0}','L60.0','f','t','t','podologie','Unguis incarnatus (L60.0)',NULL,NULL,'{L60.0}','50','t',E'[{"re": "^L60\\\\.0$", "note": "Unguis incarnatus — ausschließlich zulässiger Kode"}]','[]','[]','[]'),
  ('WS','Wirbelsäulenerkrankungen',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{M40-M54,M95,Q76}','10','t','[]','[]','[]','[]'),
  ('WS1','Wirbelsäulenerkrankungen (akut/postoperativ)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{M40-M54,Q76}','11','t','[]','[]','[]','[]'),
  ('WS2','Wirbelsäulenerkrankungen (prolongierter Verlauf)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'6','{M40-M54,Q76}','12','t','[]','[]','[]','[]'),
  ('ZN','ZNS-Erkrankungen einschließlich des Rückenmarks / Neuromuskuläre Erkrankungen',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'10','{G00-G99,I60-I69,S06,S14,S24,S34}','40','t','[]','[]','[]','[]'),
  ('ZN1','ZNS-Erkrankungen (Erwachsene)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'10','{G00-G99,I60-I69}','41','t','[]','[]','[]','[]'),
  ('ZN2','ZNS-Erkrankungen (Kinder / frühkindliche Schädigung)',NULL,NULL,NULL,'t','f','f','physiotherapy',NULL,NULL,'10','{G80-G83,P91,Q00-Q07}','42','t','[]','[]','[]','[]')
ON CONFLICT (code) DO UPDATE SET
  label=EXCLUDED.label, untergruppen=EXCLUDED.untergruppen, icd10_codes=EXCLUDED.icd10_codes,
  icd10_pflicht=EXCLUDED.icd10_pflicht, befundung_erlaubt=EXCLUDED.befundung_erlaubt,
  nagelspange_erlaubt=EXCLUDED.nagelspange_erlaubt, lokalisation_pflicht=EXCLUDED.lokalisation_pflicht,
  bereich=EXCLUDED.bereich, indikation=EXCLUDED.indikation, leitsymptomatik=EXCLUDED.leitsymptomatik,
  hoechstmenge=EXCLUDED.hoechstmenge, icd_ranges=EXCLUDED.icd_ranges, sort=EXCLUDED.sort, aktiv=EXCLUDED.aktiv,
  icd_accept=EXCLUDED.icd_accept, icd_exclude=EXCLUDED.icd_exclude, icd_auto_select=EXCLUDED.icd_auto_select,
  icd_accept_unsicher=EXCLUDED.icd_accept_unsicher;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.diagnosegruppen;
  IF n < 57 THEN RAISE EXCEPTION 'seed diagnosegruppen: % Zeilen, erwartet >= 57', n; END IF;
END $$;
