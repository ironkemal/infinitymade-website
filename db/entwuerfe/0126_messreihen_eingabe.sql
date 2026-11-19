-- Vorhandene Messungen bleiben erhalten. Neue Messungen und Änderungen prüfen.
ALTER TABLE public.messreihen ADD CONSTRAINT messreihen_eingabe_check CHECK (
  NULLIF(btrim(koerperteil), '') IS NOT NULL AND wert >= 0 AND
  CASE typ WHEN 'VAS' THEN wert <= 10 WHEN 'ROM' THEN wert <= 360
    WHEN 'kraft' THEN wert <= CASE WHEN einheit = 'MFT' THEN 5 ELSE 999 END
    ELSE wert <= 999 END
) NOT VALID;
