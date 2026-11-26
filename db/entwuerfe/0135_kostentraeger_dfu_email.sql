-- Migration 0135: dfu_email auf public.kostentraeger (F6 — §302 E-Mail-Weg ohne dakota.le)
-- Quelle: DFU-Segment Protokoll 070 (Internet E-Mail) aus den aktiven Q4/2026-Kostenträgerdateien
-- in wissensbank/gemeinsam/kostentraeger/ (Vorrang AO/BK/IK/BN/LK vor EK).
-- Idempotent, zählerneutral, :stable-kompatibel (db-ustasi & onprem Freigabe 26.11.2026).

ALTER TABLE public.kostentraeger ADD COLUMN IF NOT EXISTS dfu_email text;

UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '100295017';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '100395611';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '100696012';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '100696023';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '101097008';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '101317004';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '101519213';
UPDATE public.kostentraeger SET dfu_email = 'dav001@vdek-dav.de' WHERE ik = '101575519';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '102110939';
UPDATE public.kostentraeger SET dfu_email = 'dav@mobil-isc.de' WHERE ik = '102193212';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '103119199';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '103411401';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '103511264';
UPDATE public.kostentraeger SET dfu_email = 'le@bitmarck-daten.de' WHERE ik = '104027544';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '104212516';
UPDATE public.kostentraeger SET dfu_email = 'le-ek@bitmarck-daten.de' WHERE ik = '104593971';
UPDATE public.kostentraeger SET dfu_email = 'dav-le@vdek-dav.de' WHERE ik = '104940005';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '105810615';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '106198626';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '107299005';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '107310373';
UPDATE public.kostentraeger SET dfu_email = 'inbox@tp5.arz-emmendingen.de' WHERE ik = '107436557';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '108018007';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '108310400';
UPDATE public.kostentraeger SET dfu_email = 'da@dta.aok.de' WHERE ik = '109519005';
UPDATE public.kostentraeger SET dfu_email = 'le@bitmarck-daten.de' WHERE ik = '109900019';
UPDATE public.kostentraeger SET dfu_email = 'dta302@convema.com' WHERE ik = '590301867';
UPDATE public.kostentraeger SET dfu_email = 'dta@kv-service-plus-gmbh.de' WHERE ik = '590311426';
UPDATE public.kostentraeger SET dfu_email = 'dta302@ddg-online.de' WHERE ik = '660510336';
UPDATE public.kostentraeger SET dfu_email = 'da302@iqvia-hss.de' WHERE ik = '661400051';
UPDATE public.kostentraeger SET dfu_email = 'dta302@condatesta.de' WHERE ik = '661400073';
UPDATE public.kostentraeger SET dfu_email = 'edi302@iqvia-hss.de' WHERE ik = '661400233';
UPDATE public.kostentraeger SET dfu_email = 'datenservice@gfs-web.de' WHERE ik = '661420011';
UPDATE public.kostentraeger SET dfu_email = 'edi302@iqvia-hss.de' WHERE ik = '661430035';
UPDATE public.kostentraeger SET dfu_email = 'da302@iqvia-hss.de' WHERE ik = '661430046';
