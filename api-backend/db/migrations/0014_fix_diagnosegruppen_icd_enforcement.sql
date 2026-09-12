-- O-38 Gegenlesen (db-ustasi, 12.09.2026): 0011_seed_diagnosegruppen.sql 20 kolondan
-- yalnız 19'unu yazdı, `icd_enforcement` eksikti → kutuda tüm satırlar kolonun
-- DEFAULT'u olan 'warn'a düşüyordu. Canlıda UI1/UI2 (Unguis incarnatus, podologie —
-- ilk teslim edilen alan) tek istisna: 'hard_before_dta'. module/icd-dg-match.js:207
-- ve dashboard.js:16083 DTA üretimini YALNIZ 'hard_before_dta'da kilitliyor — kutuda
-- yanlış ICD'li bir Unguis-incarnatus reçetesi kilitlenmek yerine sadece uyarırdı.
-- 0011 checksum kilitli (uygulanmış dosya değiştirilmez), düzeltme bu yüzden ayrı dosya.

UPDATE public.diagnosegruppen
SET icd_enforcement = 'hard_before_dta'
WHERE code IN ('UI1', 'UI2');

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.diagnosegruppen
  WHERE code IN ('UI1','UI2') AND icd_enforcement = 'hard_before_dta';
  IF n < 2 THEN RAISE EXCEPTION 'fix icd_enforcement: % satır güncellendi, beklenen 2', n; END IF;
END $$;
