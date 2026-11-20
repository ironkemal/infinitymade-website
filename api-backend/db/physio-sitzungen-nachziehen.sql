-- Nach Migration 0124 separat ausführen. Bestehende Terminbindungen,
-- Entwürfe und abgeschlossene Verordnungen bleiben erhalten.
SELECT public.physio_sitzungsplan_initialisieren(rx.id)
FROM public.prescriptions rx
WHERE rx.therapie_bereich = 'physio' AND rx.status IN ('confirmed','in_therapy')
  AND NOT EXISTS (SELECT FROM public.prescription_sessions s WHERE s.prescription_id = rx.id)
ORDER BY rx.id;
