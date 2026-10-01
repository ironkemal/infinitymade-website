-- Reform 3.12 Schritt (b) — Klartext-PHI-Reste leeren (Daten, kein DDL).
--
-- WARUM (guvenlik + db-ustasi + legal-de 30.09.2026, Freigabe Kemal 01.10.2026):
--   * prescriptions.ocr_raw_response (jsonb) haelt die rohe OCR-Antwort im
--     Klartext — Name, Anschrift, Versichertennummer. Kein Leser im Code
--     (grep 01.10.2026: nur Negativtests „wird nicht geschrieben"); ham OCR
--     wird nicht mehr gespeichert (e9d0286). Live 01.10.2026: 60 Zeilen.
--   * prescriptions.ocr_raw_enc / icd10_enc / phi_encrypted: Reste der
--     aufgegebenen Feldverschluesselung (live 23 / 22 / 23 Zeilen).
--   * fahrten.zweck/zielort: Altzeilen tragen Patientennamen und -anschrift
--     (OFD Frankfurt 19.01.2011: im Fahrtenbuch von Heilberufen unzulaessig).
--     Neue Zeilen schreibt der Code bereits neutral
--     (module/fahrtenbuch-regeln.js fahrtZweckUndZiel). Altzeilen werden auf
--     GENAU dieses Format gebracht — „Patientenbesuch" /
--     „Patientenbesuch (s. Verzeichnis Nr. P-XXXXXXXX)", Referenz = 'P-' +
--     erste 8 Hex-Zeichen von booking_id (gross), wie fahrtReferenz(). Der
--     Patient bleibt ueber lead_id im Patientenverzeichnis auffindbar.
--     Kriterium wie fahrtAnzeigeText(): lead_id gesetzt ODER zweck beginnt mit
--     „Hausbesuch". Live 01.10.2026: 7 Altzeilen.
--   * leads.*_enc: live 0 befuellte Zeilen, nichts zu tun.
--
-- VORAUSSETZUNG: 0049 (Festschreibungs-Trigger ohne icd10_enc) — sonst bricht
--   das Leeren von icd10_enc auf eingereichten Verordnungen ab.
-- Der Audit-Trigger (audit_write_log) protokolliert nur die NAMEN geaenderter
--   Spalten, keine Werte — die PHI wandert nicht ins data_access_log.
--
-- SaaS: angewandt 01.10.2026, MCP (Freigabe Kemal). Auf frischen Boxen No-op.
-- ZAEHLER: counter-neutral (reine Daten-UPDATE, Kural 6).

UPDATE public.prescriptions
   SET ocr_raw_response = NULL,
       ocr_raw_enc      = NULL,
       icd10_enc        = NULL,
       phi_encrypted    = false
 WHERE ocr_raw_response IS NOT NULL
    OR ocr_raw_enc      IS NOT NULL
    OR icd10_enc        IS NOT NULL
    OR phi_encrypted;

UPDATE public.fahrten
   SET zweck   = 'Patientenbesuch',
       zielort = CASE
                   WHEN booking_id IS NULL THEN 'Patientenbesuch'
                   ELSE 'Patientenbesuch (s. Verzeichnis Nr. P-'
                        || upper(left(replace(booking_id::text, '-', ''), 8)) || ')'
                 END
 WHERE (lead_id IS NOT NULL OR zweck ~* '^Hausbesuch\M')
   AND NOT (zweck = 'Patientenbesuch' AND coalesce(zielort, '') LIKE 'Patientenbesuch%');

DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.prescriptions
   WHERE ocr_raw_response IS NOT NULL OR ocr_raw_enc IS NOT NULL OR icd10_enc IS NOT NULL OR phi_encrypted;
  IF n <> 0 THEN RAISE EXCEPTION '0050: noch % prescriptions mit PHI-Resten', n; END IF;
  SELECT count(*) INTO n FROM public.fahrten
   WHERE (lead_id IS NOT NULL OR zweck ~* '^Hausbesuch\M')
     AND NOT (zweck = 'Patientenbesuch' AND coalesce(zielort, '') LIKE 'Patientenbesuch%');
  IF n <> 0 THEN RAISE EXCEPTION '0050: noch % Fahrten mit Klartext-Ziel', n; END IF;
END $$;
