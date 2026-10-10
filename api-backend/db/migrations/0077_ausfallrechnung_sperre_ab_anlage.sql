-- Migration 0077_ausfallrechnung_sperre_ab_anlage.sql
-- SaaS: angewandt 10.10.2026 (MCP: 20261010005233, Freigabe Kemal; geprüft im Rollback: Betragsänderung an offener AF-3 -> check_violation).
-- Auftrag: KUTU_HAZIRLIK_SPRINT.md §4 „Ausfall" — Folgeschritt zu 0076.
-- Rechtsgrundlage: compliance/LEGAL_DECISIONS.md Block 2026-10-10 („ZU, Privat- und Ausfallrechnung = Buchungsbelege,
-- § 147 Abs. 1 Nr. 4 AO, bildlich reproduzierbar") + Block 2026-10-09 (Nachtrag: Variante (a) ließ zwischen
-- Druck und Zahlung ein Änderungsfenster offen — „Restrisiko akzeptiert").
--
-- Problem: 0076 sperrt den Inhalt einer Ausfallrechnung erst ab status = 'bezahlt'. Eine Ausfallrechnung hat aber
-- KEINEN Entwurf: POST /billing/ausfall/create legt die Zeile an und druckt sie im selben Aufruf (ausfall.routes.js,
-- insert … status:'offen' → renderInvoiceHtml). Zwischen Ausgabe an den Patienten und Zahlung (oder für immer, bei
-- storniert/abgeschrieben) waren Betrag, Nummer, Leistung und Snapshots per PostgREST änderbar (Policy
-- ausfallrechnungen_update, owner). Für eine ausgegebene Rechnung ist das genau die Lücke, die 0075/0076 schließen.
--
-- Neu (CREATE OR REPLACE ausfallrechnung_festschreibung, gleicher Trigger, SECURITY INVOKER bleibt):
--   a) Inhalt ist ab INSERT gesperrt, in JEDEM Status: amount_eur, service_name, leistung_datum, rechnung_nr, reason,
--      created_at, owner_id, aussteller_snapshot, empfaenger_snapshot. Kein „einmal nachtragen" der Snapshots —
--      ein nachträglich aus Live-Daten gebauter Snapshot wäre nicht der gedruckte Beleg (wie 0075/0076).
--      Altbelege ohne Snapshot (vor 0076) bleiben ohne.
--   b) patient_id/booking_id: nur auf NULL (FK ON DELETE SET NULL läuft als UPDATE durch diesen Trigger), nie auf eine
--      andere Zeile — jetzt ebenfalls in jedem Status.
--   c) Statusübergänge — derselbe Regelsatz wie PATCH /billing/ausfall/:id/status (ausfall.routes.js:440-480):
--        - Ziel 'offen' aus keinem anderen Status (unverändert aus 0076).
--        - 'bezahlt' ist endgültig: status und bezahlt_at bleiben (Code: 409 „Bereits als bezahlt gebucht").
--        - Aus 'storniert'/'abgeschrieben' lässt der Code jedes Ziel außer 'offen' zu (bezahlt/storniert/abgeschrieben;
--          er prüft nur existing.status === 'bezahlt'). Die DB übernimmt das UNVERÄNDERT — fachlich ist z. B.
--          „abgeschrieben → bezahlt" (späte Zahlung) legitim. ⚠️ „storniert → bezahlt" ist im Code ebenfalls offen,
--          obwohl /ausfall/create nach einem Storno eine NEUE AF zum selben Termin erlaubt (ausfall.routes.js:231,
--          .not('status','eq','storniert')) — dann wären zwei AF zum Termin „lebendig". ENTSCHIEDEN (Hauptsitzung
--          10.10.2026, Kemal-Freigabe „vorgeschlagener Weg"): 'storniert' ist endgültig — DB hier und Code (PATCH 409)
--          im selben Commit. 'abgeschrieben → bezahlt|storniert' bleibt erlaubt.
--        - bezahlt_at darf sich nur zusammen mit dem Übergang auf 'bezahlt' ändern (Code setzt beide zusammen; live
--          10.10.2026 gezählt: 0 Zeilen mit bezahlt_at bei status <> 'bezahlt').
--   d) Frei bleiben: status (im Rahmen von c), notes, business_id (FK SET NULL), created_by.
--   DELETE: unverändert keine DELETE-Policy, kein DELETE-Zweig (owner_id CASCADE bei Kontolöschung bleibt).
--
-- Zähler: COUNTER-NEUTRAL — CREATE OR REPLACE einer bestehenden Funktion, gleicher Trigger. Kein neues Objekt.
-- DSGVO: unverändert (ausfallrechnungen in api-backend/dsgvo/klassifikation.js, kategorie beleg; loeschen.js schreibt
-- die Tabelle nicht). patient_id → NULL bleibt möglich, die Anonymisierungs-/Löschkette wird nicht blockiert.

CREATE OR REPLACE FUNCTION public.ausfallrechnung_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- c) zurück auf offen: aus keinem anderen Status
  IF NEW.status = 'offen' AND OLD.status IS DISTINCT FROM 'offen' THEN
    RAISE EXCEPTION 'Ausfallrechnung AF-% (Status %) kann nicht wieder auf offen gesetzt werden.', OLD.rechnung_nr, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- c) bezahlt ist endgültig
  IF OLD.status = 'bezahlt'
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.bezahlt_at IS DISTINCT FROM OLD.bezahlt_at) THEN
    RAISE EXCEPTION 'Bezahlte Ausfallrechnung AF-% ist festgeschrieben (Status und Zahlungsdatum).', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  -- c) storniert ist endgültig (Hauptsitzung 10.10.2026): POST /ausfall/create erlaubt nach Storno eine neue
  --    AF für denselben Termin — ein Zurück aus storniert ergäbe zwei lebende AF für einen Termin.
  IF OLD.status = 'storniert' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Stornierte Ausfallrechnung AF-% ist endgültig. Für den Termin bitte eine neue Ausfallrechnung anlegen.', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  -- c) bezahlt_at nur zusammen mit dem Übergang auf bezahlt
  IF NEW.bezahlt_at IS DISTINCT FROM OLD.bezahlt_at AND NEW.status IS DISTINCT FROM 'bezahlt' THEN
    RAISE EXCEPTION 'Ausfallrechnung AF-%: Zahlungsdatum nur zusammen mit Status bezahlt.', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  -- a) + b): Inhalt ab Anlage gesperrt (es gibt keinen Entwurf)
  IF NEW.amount_eur      IS DISTINCT FROM OLD.amount_eur
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
    RAISE EXCEPTION 'Ausfallrechnung AF-% ist ausgestellt und kann inhaltlich nicht geaendert werden. Bitte stornieren.', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- Lehre 0035 (wie 0076). CREATE OR REPLACE behält die ACL, der REVOKE ist idempotent und hält den Stand in der Datei fest.
REVOKE ALL ON FUNCTION public.ausfallrechnung_festschreibung() FROM PUBLIC, anon, authenticated;
