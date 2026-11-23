-- VORSCHLAG — NICHT VON CLAUDE AUSFÜHREN. Ausführen nur Melih, nur auf der Hetzner-TESTBOX, nie auf SaaS/Live.
-- Box-Browser-Test 22.11.2026: entfernt genau die im Bericht gelisteten, selbst angelegten Testdaten.
--
--   Leistung   „KG Test“                      (services.title)
--   Patient    „Testpatient Eins“              (leads.title) + seine Verordnung (Entwurf) + Termin 23.11. 11:00
--   Patient    „Realtime Test“                 (leads.title) + Termin „Realtime Test“ 23.11. 14:00
--
-- Alle übrigen Patienten und Mitarbeiter bleiben unberührt (exakte Namensgleichheit + Anlagedatum).
--
-- Standard = TROCKENLAUF: zeigt Treffer und abhängige Zeilen, ändert nichts (ROLLBACK).
--   docker exec -i <db-container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tools/box-testdaten-aufraeumen.sql
-- Löschen (eine Transaktion; jeder Fehler, z. B. RESTRICT durch eine Einwilligung, nimmt ALLES zurück):
--   docker exec -i <db-container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 -v ausfuehren=on < tools/box-testdaten-aufraeumen.sql
-- Vorher: Sicherung (backup.sh) — die Box hat sie nachts, ein frischer Lauf schadet nicht.

\if :{?ausfuehren}
\else
\set ausfuehren off
\endif

BEGIN;

CREATE TEMP TABLE _ziel_leads ON COMMIT DROP AS
  SELECT id, title, created_at FROM public.leads
   WHERE title IN ('Testpatient Eins', 'Realtime Test')
     AND (created_at AT TIME ZONE 'Europe/Berlin')::date BETWEEN DATE '2026-11-22' AND DATE '2026-11-23';

CREATE TEMP TABLE _ziel_bookings ON COMMIT DROP AS
  SELECT id, customer_name, start_time FROM public.bookings
   WHERE (start_time AT TIME ZONE 'Europe/Berlin')::date = DATE '2026-11-23'
     AND (lead_id IN (SELECT id FROM _ziel_leads) OR customer_name IN ('Testpatient Eins', 'Realtime Test'));

CREATE TEMP TABLE _ziel_rx ON COMMIT DROP AS
  SELECT id, status, ausstellungsdatum FROM public.prescriptions
   WHERE patient_id IN (SELECT id FROM _ziel_leads) AND status = 'parsed';

CREATE TEMP TABLE _ziel_services ON COMMIT DROP AS
  SELECT id, title FROM public.services
   WHERE title = 'KG Test' AND (created_at AT TIME ZONE 'Europe/Berlin')::date = DATE '2026-11-22'
     AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.service_id = services.id AND b.id NOT IN (SELECT id FROM _ziel_bookings));

\echo '== Treffer (prüfen: nur die Testdaten aus dem Bericht?)'
SELECT 'patient' AS art, title AS name, created_at::text AS wann FROM _ziel_leads
UNION ALL SELECT 'termin', customer_name, start_time::text FROM _ziel_bookings
UNION ALL SELECT 'verordnung (entwurf)', status, ausstellungsdatum::text FROM _ziel_rx
UNION ALL SELECT 'leistung', title, '' FROM _ziel_services
ORDER BY 1, 2;

\echo '== Abhängige Zeilen (> 0 bei Einwilligung/Rechnung/Sperre = STOPP, nicht löschen)'
SELECT 'patient_consents' AS tabelle, count(*) FROM public.patient_consents WHERE patient_id IN (SELECT id FROM _ziel_leads)
UNION ALL SELECT 'aufbewahrung_sperre', count(*) FROM public.aufbewahrung_sperre WHERE patient_id IN (SELECT id FROM _ziel_leads)
UNION ALL SELECT 'ausfallrechnungen', count(*) FROM public.ausfallrechnungen WHERE patient_id IN (SELECT id FROM _ziel_leads)
UNION ALL SELECT 'prescription_sessions', count(*) FROM public.prescription_sessions WHERE prescription_id IN (SELECT id FROM _ziel_rx);

\if :ausfuehren
  \echo '== LÖSCHEN (Transaktion)'
  DELETE FROM public.bookings WHERE id IN (SELECT id FROM _ziel_bookings);
  DELETE FROM public.prescription_sessions WHERE prescription_id IN (SELECT id FROM _ziel_rx);
  DELETE FROM public.prescriptions WHERE id IN (SELECT id FROM _ziel_rx);
  DELETE FROM public.leads WHERE id IN (SELECT id FROM _ziel_leads);
  DELETE FROM public.services WHERE id IN (SELECT id FROM _ziel_services);
  COMMIT;
  \echo '== erledigt'
\else
  \echo '== TROCKENLAUF: nichts geändert (ROLLBACK). Zum Löschen: -v ausfuehren=on'
  ROLLBACK;
\endif
