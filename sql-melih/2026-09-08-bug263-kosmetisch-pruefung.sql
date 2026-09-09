-- Bug #263 — "Kosmetisch/Medizinisch" erschien fälschlich bei GKV-Zuzahlung.
-- Prüfung, ob dadurch falsche USt-Werte in invoices liegen.
-- NUR SELECT. Nichts wird verändert. Melih führt aus, Ergebnis zurück an Claude.

-- A) Wie oft fehlt der Kassenstatus am Patienten überhaupt? (die Auslöse-Bedingung)
SELECT COALESCE(insurance_type, '<NULL>') AS insurance_type, count(*)
FROM leads
GROUP BY 1 ORDER BY 2 DESC;

-- B) Rechnungen MIT Kassenanteil, auf denen trotzdem USt ausgewiesen ist.
--    Das sind die Kandidaten für "falsch gespeichert".
SELECT id, invoice_number, issued_at, status, invoice_type, steuer_status,
       subtotal, eigenanteil_pct, kassenzuzahlung, total_patient,
       netto_gesamt, steuer_gesamt, brutto_gesamt,
       steuerhinweis_text, tax_summary
FROM invoices
WHERE COALESCE(kassenzuzahlung, 0) > 0
  AND (
        COALESCE(steuer_gesamt, 0) > 0
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(tax_summary) g
                WHERE COALESCE((g->>'satz')::numeric, 0) > 0)
      )
ORDER BY issued_at DESC;

-- C) Dieselbe Frage eine Ebene tiefer: einzelne Zeilen mit USt > 0 auf einer
--    Rechnung mit Kassenanteil.
SELECT i.id, i.invoice_number, i.issued_at,
       COALESCE(i.kassenzuzahlung, 0) AS kassenzuzahlung,
       count(*)                                                          AS zeilen_gesamt,
       count(*) FILTER (WHERE COALESCE((l->>'ust_satz')::numeric, 0) > 0) AS zeilen_mit_ust,
       count(*) FILTER (WHERE l->>'ust_grund' = '4_14a')                  AS zeilen_steuerfrei
FROM invoices i
CROSS JOIN LATERAL jsonb_array_elements(i.line_items) AS l
WHERE COALESCE(i.kassenzuzahlung, 0) > 0
GROUP BY 1, 2, 3, 4
HAVING count(*) FILTER (WHERE COALESCE((l->>'ust_satz')::numeric, 0) > 0) > 0
ORDER BY i.issued_at DESC;

-- D) Überblick in Zahlen — für die Frage "sind Altdaten betroffen, ja/nein".
SELECT
  count(*)                                                                        AS rechnungen_gesamt,
  count(*) FILTER (WHERE COALESCE(kassenzuzahlung, 0) > 0)                        AS mit_kassenanteil,
  count(*) FILTER (WHERE COALESCE(kassenzuzahlung, 0) > 0
                     AND COALESCE(steuer_gesamt, 0) > 0)                          AS mit_kassenanteil_und_ust,
  count(*) FILTER (WHERE COALESCE(kassenzuzahlung, 0) > 0
                     AND COALESCE(steuerhinweis_text, '') <> '')                  AS mit_kassenanteil_und_hinweis,
  count(*) FILTER (WHERE invoice_type IS NULL)                                    AS ohne_invoice_type
FROM invoices;
