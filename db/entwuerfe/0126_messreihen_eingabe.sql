-- Neue Messwerte und Änderungen der Messangaben prüfen. Ein technisches
-- UPDATE, etwa ein FK mit ON DELETE SET NULL, darf Altwerte behalten.
CREATE FUNCTION public.messreihe_eingabe_pruefen()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NULLIF(btrim(NEW.koerperteil), '') IS NULL OR NEW.wert < 0 OR
     NEW.wert > (CASE NEW.typ
       WHEN 'VAS' THEN 10
       WHEN 'ROM' THEN 360
       WHEN 'kraft' THEN CASE WHEN NEW.einheit = 'MFT' THEN 5 ELSE 999 END
       ELSE 999
     END) THEN
    RAISE EXCEPTION 'Körperteil und gültigen Wert für den gewählten Messtyp angeben.'
      USING ERRCODE = '23514', CONSTRAINT = 'messreihen_eingabe_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messreihen_eingabe_check
BEFORE INSERT OR UPDATE OF typ, wert, einheit, koerperteil ON public.messreihen
FOR EACH ROW EXECUTE FUNCTION public.messreihe_eingabe_pruefen();
