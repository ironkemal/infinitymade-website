-- ENTWURF — NICHT aktiv, nicht in api-backend/db/migrations, nicht live angewandt (GO nötig).
-- ZAA-Import: gleiche Datei zweimal hochgeladen ändert nichts (Hash je Abrechnung).
-- Heute ersetzt zaa_fehler_anwenden (0061) den Fehlerbestand vollständig; Wiederholung
-- verschiebt nur absetzung_am/zaa_uploaded_at. Mit Hash wird Wiederholung erkannt und ausgelassen.
-- Backend: anwenden.js übergibt p_sha256 nur bei idempotenz=true (Flag, Standard aus).
-- Beim Aktivieren: als nächste Migration unter api-backend/db/migrations/ ablegen,
-- db/SCHEMA*.sql + db/REGISTER.md + dsgvo/klassifikation.js aktualisieren (onprem prüfen).

CREATE TABLE IF NOT EXISTS public.zaa_import (
  abrechnung_id uuid NOT NULL REFERENCES public.abrechnung(id) ON DELETE CASCADE,
  sha256        text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  angewendet_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (abrechnung_id, sha256)
);
ALTER TABLE public.zaa_import ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.zaa_import FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.zaa_import TO service_role;

-- Erweiterung der RPC 0061: neuer Parameter p_sha256 text DEFAULT NULL (alte Aufrufe unverändert).
-- Nach dem Owner-/Versions-Check (vor DELETE FROM zaa_fehler) einzufügen:
--   IF p_sha256 IS NOT NULL THEN
--     IF EXISTS (SELECT 1 FROM public.zaa_import WHERE abrechnung_id = p_abrechnung AND sha256 = p_sha256) THEN
--       RETURN jsonb_build_object('konflikt', false, 'wiederholt', true);
--     END IF;
--     INSERT INTO public.zaa_import(abrechnung_id, sha256) VALUES (p_abrechnung, p_sha256);
--   END IF;
-- Hinweis: alte 7-Parameter-Signatur per DROP FUNCTION entfernen, sonst Überladungs-Mehrdeutigkeit
-- bei PostgREST. Eine ANDERE (spätere) ZAA-Datei wird weiter normal angewendet.
