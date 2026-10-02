-- zweistufig: "fußstatus" — Schritt 1 lange erledigt (kein Code-Zugriff mehr; panel-fussstatus liest
--   pat_fussbefund, die einzigen Verweise in api/dsgvo.js sind im selben Commit entfernt);
--   visibility_reports — Schreibweg 30.09., Leseweg (admin.js) 01.10.2026 entfernt, in der Box nie
--   vorhanden. :stable wurde nie veröffentlicht (onprem O-143).
-- DB-Aufräumen (KHS K1.6, db/REGISTER W-07, DB-7..9). K-14: keine echten Daten.
--
-- WAS:
--   1. DROP "fußstatus" (Live 3 Testzeilen, K-14) — Vorgänger von pat_fussbefund;
--      Namensfalle: der Reiter „Fußstatus" liest pat_fussbefund.
--   2. DROP visibility_reports (Live 0 Zeilen; nur im SaaS, nicht im Box-Paket).
--   3. aerzte_owner_id_arzt_name_key weg: der dritte Unique verhinderte, dass ein
--      Arzt ohne LANR neben einem gleichnamigen mit LANR steht (Absicht v32).
--      uq_aerzte_owner_name_no_lanr + uq_aerzte_owner_lanr bleiben. Der 23505-
--      Zweig in api-backend/lib/arzt-registry.js wird damit toter Code (harmlos).
--   4. 9 Kostenträger-Zeilen mit datensatz_status = 'mock_unbestaetigt' löschen.
--      Idempotent; in einer Box zeigt nichts auf sie. Im SaaS hingen 7 Test-
--      Abrechnungen + 4 Verordnungen daran — die wurden am 02.10.2026 VOR dieser
--      Datei per MCP bereinigt (Freigabe Kemal; GoBD-Trigger nur in jener
--      Transaktion aus). Diese Datei setzt KEINEN Trigger außer Kraft.
--   db-ustasi 02.10.2026: Vier-Quellen-Regel für 1–3 leer.
--
-- SaaS: angewandt 02.10.2026, MCP.
-- ZAEHLER: public_tablo −1 ("fußstatus"; visibility_reports zählt in der Box
--   nicht), rls_policy −1 (owner_fußstatus), index −2 (fußstatus_pkey,
--   aerzte_owner_id_arzt_name_key).

DROP TABLE IF EXISTS public."fußstatus";
DROP TABLE IF EXISTS public.visibility_reports;
ALTER TABLE public.aerzte DROP CONSTRAINT IF EXISTS aerzte_owner_id_arzt_name_key;
DELETE FROM public.kostentraeger WHERE datensatz_status = 'mock_unbestaetigt';
