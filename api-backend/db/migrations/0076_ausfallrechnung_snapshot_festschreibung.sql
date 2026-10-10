-- Migration 0076_ausfallrechnung_snapshot_festschreibung.sql
-- SaaS: angewandt 10.10.2026 (MCP: 20261010002216, Freigabe Kemal; geprüft: 2 Spalten da, prosecdef=false,
-- anon ohne SELECT, Betragsänderung an bezahlter AF-1 → check_violation, in zurückgerollter Transaktion).
-- Nummer: die bisher als „0076" angekündigte Pflicht-Migration für invoices (Snapshot NULL → Verlassen von draft
-- verweigert, siehe Kopf von 0075 Punkt 3) erhält eine SPÄTERE, eigene Nummer — 0076 ist diese Datei.
-- Auftrag: KUTU_HAZIRLIK_SPRINT.md §4 „Hat K → Hat M notu (09.10 akşam) — Fatura snapshot", Punkt „Ausfall".
-- Muster: 0075 (invoices). Rechtsgrundlage wie dort: compliance/LEGAL_DECISIONS.md letzter Block
-- (§ 147 Abs. 2 Nr. 1 AO „bildlich übereinstimmend", § 14 Abs. 4 Nr. 1 UStG).
--
-- Problem: GET /billing/ausfall/:id/print rendert jede Ausfallrechnung bei jedem Aufruf NEU aus den Live-Daten
-- (Praxisprofil, leads, bookings). Nach Umzug, Umbenennung oder Anonymisierung druckt dieselbe Nummer anders.
-- Zusätzlich war eine bezahlte Ausfallrechnung nur im Code gesperrt (ausfall.routes.js: 409 bei status='bezahlt');
-- die Policy ausfallrechnungen_update erlaubt dem Inhaber per PostgREST jede Spalte zu ändern, auch Betrag und Nummer.
--
-- (1) Zwei nullable jsonb-Spalten, gleiche Form wie invoices (0075). Geschrieben werden sie vom SERVER beim
--     Anlegen (POST /billing/ausfall/create, service_role) — es gibt keinen Entwurfszustand; die Rechnung ist mit
--     dem INSERT ausgestellt und wird sofort gedruckt.
-- (2) „Bezahlt" ist status = 'bezahlt' (bezahlt_at ist nur der Zeitstempel dazu; ausfall.routes.js setzt beide
--     zusammen und lehnt jede weitere Änderung ab, die Liste/Statistik/Mahnwesen lesen status).
--     Neuer Trigger ausfallrechnung_festschreibung (BEFORE UPDATE, SECURITY INVOKER wie invoice_festschreibung):
--       a) bezahlt ist endgültig: status und bezahlt_at bleiben.
--       b) zurück auf 'offen' geht aus KEINEM anderen Status (Gegenstück zu „nicht zurück auf draft").
--       c) an einer bezahlten Zeile sind amount_eur, service_name, leistung_datum, rechnung_nr, reason,
--          created_at, owner_id und beide Snapshots unveränderlich — wie 0075: Snapshot ohne „einmal nachtragen";
--          ein nachträglich aus Live-Daten gebauter Snapshot wäre nicht der gedruckte Beleg.
--       d) patient_id/booking_id: an einer bezahlten Zeile kein Umhängen auf eine ANDERE Zeile; auf NULL bleibt
--          erlaubt, weil beide FKs ON DELETE SET NULL sind (leads/bookings) und die RI-Aktion ein UPDATE ist, das
--          diesen Trigger durchläuft — sonst würde jedes Löschen eines Termins/Patienten mit bezahlter
--          Ausfallrechnung scheitern. Der Snapshot hält fest, was gedruckt wurde.
--     notes, business_id (FK SET NULL), created_by bleiben frei.
-- (3) DELETE: es gibt keine DELETE-Policy (seit 12.07.2026) — bleibt so, kein DELETE-Zweig im Trigger.
--     owner_id ON DELETE CASCADE (Kontolöschung) ist ein DELETE und wird nicht berührt.
-- (4) anon: Tabellenrechte INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN (Supabase-Default).
--     Heute durch RLS wirkungslos (alle Policies prüfen auth.uid(), anon = NULL; keine DELETE-Policy; TRUNCATE über
--     PostgREST nicht erreichbar) — also nur EINE Schicht. Kein anon-Leser im Code (einziger Zugriff:
--     api-backend mit service_role). Muster S-58/0074: REVOKE ALL FROM anon, kein GRANT zurück.
--     authenticated bleibt unverändert (Policies gelten, kein Client liest die Tabelle heute direkt).
--
-- Zähler: +1 Funktion (ausfallrechnung_festschreibung), +1 Trigger (trg_ausfallrechnung_festschreibung).
-- Spalten, COMMENTs und ACLs zählt keiner der zehn Zähler (_hinweis_0024/_0042). anon_*_kolon betreffen nur
-- profiles/businesses -> unverändert.
-- DSGVO: ausfallrechnungen ist in api-backend/dsgvo/klassifikation.js (kategorie beleg); loeschen.js schreibt die
-- Tabelle nicht. empfaenger_snapshot enthält Name/Anschrift/Geburtsdatum (wie gedruckt), keine Diagnose, kein IBAN.

ALTER TABLE public.ausfallrechnungen
  ADD COLUMN IF NOT EXISTS aussteller_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS empfaenger_snapshot jsonb;

COMMENT ON COLUMN public.ausfallrechnungen.aussteller_snapshot IS
  'Praxis (Aussteller) wie gedruckt, eingefroren beim Anlegen (POST /billing/ausfall/create): gleiche Schlüssel wie invoices.aussteller_snapshot (v, name, inhaber, strasse, plzOrt, telefon, email, ik, bank{name,iban,bic}); name = tatsächlich gedruckter Name (Standortname bei mehreren Standorten). Ab status=bezahlt gesperrt (ausfallrechnung_festschreibung, 0076). § 147 Abs. 2 Nr. 1 AO.';
COMMENT ON COLUMN public.ausfallrechnungen.empfaenger_snapshot IS
  'Rechnungsempfänger (Patient) wie gedruckt: gleiche Schlüssel wie invoices.empfaenger_snapshot art=patient (v, art, name, strasse, plzOrt, geburtsdatum, krankenkasse, versichertennummer). Kein IBAN, keine Diagnose. Ab status=bezahlt gesperrt (0076).';

CREATE OR REPLACE FUNCTION public.ausfallrechnung_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- b) zurück auf offen: aus keinem anderen Status
  IF NEW.status = 'offen' AND OLD.status IS DISTINCT FROM 'offen' THEN
    RAISE EXCEPTION 'Ausfallrechnung AF-% (Status %) kann nicht wieder auf offen gesetzt werden.', OLD.rechnung_nr, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status IS DISTINCT FROM 'bezahlt' THEN
    RETURN NEW;
  END IF;

  -- a) + c) + d): bezahlte Ausfallrechnung ist festgeschrieben
  IF NEW.status          IS DISTINCT FROM OLD.status
  OR NEW.bezahlt_at      IS DISTINCT FROM OLD.bezahlt_at
  OR NEW.amount_eur      IS DISTINCT FROM OLD.amount_eur
  OR NEW.service_name    IS DISTINCT FROM OLD.service_name
  OR NEW.leistung_datum  IS DISTINCT FROM OLD.leistung_datum
  OR NEW.rechnung_nr     IS DISTINCT FROM OLD.rechnung_nr
  OR NEW.reason          IS DISTINCT FROM OLD.reason
  OR NEW.created_at      IS DISTINCT FROM OLD.created_at
  OR NEW.owner_id        IS DISTINCT FROM OLD.owner_id
  OR NEW.aussteller_snapshot IS DISTINCT FROM OLD.aussteller_snapshot
  OR NEW.empfaenger_snapshot IS DISTINCT FROM OLD.empfaenger_snapshot
  -- FK ON DELETE SET NULL muss durchgehen; Umhängen auf eine andere Zeile nicht
  OR (NEW.patient_id IS NOT NULL AND NEW.patient_id IS DISTINCT FROM OLD.patient_id)
  OR (NEW.booking_id IS NOT NULL AND NEW.booking_id IS DISTINCT FROM OLD.booking_id)
  THEN
    RAISE EXCEPTION 'Bezahlte Ausfallrechnung AF-% ist festgeschrieben und kann inhaltlich nicht geaendert werden.', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- Lehre 0035: FROM PUBLIC allein genügt nicht (Supabase-Default-Privileges geben anon/authenticated explizit EXECUTE).
REVOKE ALL ON FUNCTION public.ausfallrechnung_festschreibung() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ausfallrechnung_festschreibung ON public.ausfallrechnungen;
CREATE TRIGGER trg_ausfallrechnung_festschreibung BEFORE UPDATE ON public.ausfallrechnungen
  FOR EACH ROW EXECUTE FUNCTION public.ausfallrechnung_festschreibung();

-- (4) anon: keine Rechte (S-58-Muster). Folgeregel wie 0072/0074: kein GRANT ... TO anon auf diese Tabelle.
REVOKE ALL ON public.ausfallrechnungen FROM anon;
