-- leads.krankenkasse_ik — IK von der Versichertenkarte am Patienten (Reform S3.8b)
-- + Kommentar-Korrektur prescriptions.krankenkasse_ik (Reform S3.8a, Commit e665aca).
--
-- Datei geschrieben 30.09.2026. Live-Status: db/REGISTER.md (leads / prescriptions).
--
-- ZAEHLER: counter-neutral (+1 nullable Spalte, +1 CHECK, +1 neuer COMMENT, 1 COMMENT
--          ersetzt — kein neues
--          Tabelle/Policy/Index/Funktion/Trigger). Dritte Form von Kural 6, wie 0033/0042/0043.
--
-- FACHLICHER GRUND (PODOLOGIE_REFORM_SPRINT.md, S3.8; db-ustasi 30.09.2026):
--   Die Patientenakte (`leads`) kennt die Kasse nur als Freitext-Namen (`krankenkasse`).
--   Die IK wird heute erst in der Rezeptmaske erfasst — pro Verordnung neu, und bei Kassen
--   mit mehreren IKs (AOK BW, AOK NordWest, IKK, mkk, SBK …) bleibt sie leer, weil
--   `krankenkassen.ik_number` dort bewusst NULL ist (Konsey 21.09.2026, 0041). Die richtige
--   IK hängt an der Karte des einzelnen Patienten; der Ort dafür ist der Patient.
--
-- BEDEUTUNG — Karten-IK, NICHT Kostenträger-IK:
--   Gleiche Bedeutung und gleiches Format wie `prescriptions.krankenkasse_ik` (Aufdruck der
--   Versichertenkarte, Anlage 1 TP5 V21 § 5.5.3.1). Die Kostenträger-IK
--   (`prescriptions.kostentraeger_ik`) ist daraus über die Kostenträgerdatei (VKG 01)
--   ableitbar und wird hier bewusst NICHT gespeichert — sonst zwei Wahrheiten.
--   Der Wert ist die Vorbelegung für neue Verordnungen: beim Anlegen wird er nach
--   `prescriptions.krankenkasse_ik` kopiert (Momentaufnahme; ein späterer Kassenwechsel
--   des Patienten darf alte Verordnungen nicht ändern — 0020 schreibt sie ohnehin fest).
--
-- BEWUSST KEIN FREMDSCHLÜSSEL auf kostentraeger(ik): wie bei prescriptions.krankenkasse_ik.
--   Die Kostenträgerdatei wird quartalsweise ersetzt; ein FK würde entweder den Austausch
--   blockieren oder eine gültige, noch nicht geladene Karten-IK abweisen.
--
-- :beta / :stable: rein additiv, nullable, kein DEFAULT. Ältere Images schreiben die
--   Spalte nicht und lesen sie über select('*') nur mit — beides unschädlich.
--
-- ZWEITER TEIL — COMMENT ON prescriptions.krankenkasse_ik (Reform S3.8a, 30.09.2026):
--   Der Live-Kommentar sagte noch „NULL = nicht erfasst, DTA faellt dann auf
--   kostentraeger_ik zurueck". Das ist seit Commit e665aca FALSCH:
--   - Maske (module/verordnung-an-backend.js), OCR (module/verordnung-aus-ocr.js) und
--     /rezept/confirm bzw. /rezept/save (server.js) schreiben die Karten-IK, auf 9 Ziffern
--     normalisiert (kartenIkNormalisieren, lib/rezept-felder.js).
--   - kostentraeger_ik wird serverseitig IMMER aus der Karten-IK abgeleitet
--     (kostentraegerIkAufloesen: kostentraeger.ik = Karten-IK, aktiv, bis zum abrechnenden
--     Endpunkt verfolgt); ein vom Client geschicktes kostentraeger_ik wird ignoriert.
--   - DTA: kein Rueckfall mehr. Karten-IK ist Mussfeld (V:01017, preflight.js); ohne sie
--     lehnt der Bau mit 422 KARTEN_IK_FEHLT ab (billing/utils/karten-ik.js, builder.js).
--   - Speichern ohne Karten-IK bleibt erlaubt (OCR legt zuerst an) — NULL = "noch nicht
--     erfasst", die Verordnung ist dann nicht abrechnungsbereit (kasseAbrechnungsbereit).
--   Nur Metadaten, keine Daten- oder Strukturaenderung; :beta/:stable unschaedlich.
--
-- DSGVO: `leads` steht in api/dsgvo.js in USER_TABLES mit select '*' (Auskunft) und in
--   DELETE_TABLES (ganze Zeile) — die neue Spalte ist ohne Codeänderung abgedeckt.
--   trg_audit_write_leads protokolliert Schreibzugriffe nur mit Spaltennamen — unverändert.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS krankenkasse_ik text;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_krankenkasse_ik_format
  CHECK (krankenkasse_ik IS NULL OR krankenkasse_ik ~ '^[0-9]{9}$');

COMMENT ON COLUMN public.leads.krankenkasse_ik IS
  'IK der Krankenkasse von der Versichertenkarte des Patienten (Karten-IK, §302 Anlage 1 TP5 V21 § 5.5.3.1). Gleiche Bedeutung wie prescriptions.krankenkasse_ik, NICHT die Kostentraeger-IK. Vorbelegung fuer neue Verordnungen. NULL = nicht erfasst.';

COMMENT ON COLUMN public.prescriptions.krankenkasse_ik IS
  'IK der Krankenkasse von der Versichertenkarte (Karten-IK, §302 Anlage 1 TP5 V21 § 5.5.3.1), 9 Ziffern. NICHT die Kostentraeger-IK: kostentraeger_ik wird serverseitig immer aus diesem Wert abgeleitet (Kostentraegerdatei). Im DTA Mussfeld (V:01017) - kein Rueckfall auf kostentraeger_ik, ohne Karten-IK lehnt der Bau ab (KARTEN_IK_FEHLT). NULL = noch nicht erfasst, Verordnung nicht abrechnungsbereit.';
