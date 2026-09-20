-- §302-Echtbetrieb, Schritte 1.1 und 1.11/Ö1 (ABRECHNUNG_ECHTBETRIEB_PLAN.md).
--
-- SCHRITT 1.1 — Auftragsdatei speichern
-- `buildDtaFile()` erzeugt die Auftragsdatei seit dem 17.09.2026 und gibt sie
-- als `auftragsdatei` zurueck (dta/builder.js) — aber keine der drei
-- Erzeugungsrouten nahm sie entgegen. Sie wurde gebaut und weggeworfen.
--
-- Warum das ein Blocker ist: Anhang 2 zur Anlage 1 TP5, Kap. 9 § 3.1
-- (Pruefstufe 1) verlangt, dass die Dateien "paarweise, d. h. Auftragsdatei
-- und zugehoerige Nutzdatei uebermittelt" werden. Fehlt die Auftragsdatei,
-- wird abgelehnt, ohne dass der Inhalt ueberhaupt gelesen wird.
--
-- SCHRITT 1.11/Ö1 — Pruefsumme je Stufe (guvenlik, 20.09.2026)
-- Bisher steht nirgends, WELCHE Bytes rausgegangen sind. Sechs Monate spaeter
-- ist "war das diese Datei?" nicht mehr beantwortbar: der Storage-Pfad kann
-- ueberschrieben worden sein (alle Uploads laufen mit `upsert: true`).
-- Ein SHA-256 ist kein Personenbezug, kostet nichts und macht die Frage
-- beantwortbar. Je Stufe eine eigene Summe, weil Signatur und (spaeter)
-- Verschluesselung die Bytes veraendern.
--
-- ⚠️ Es wird bewusst KEIN Index angelegt: gesucht wird nie nach dem Hash,
--    er wird nur nachgeschlagen, wenn man die Zeile ohnehin schon hat.
--
-- ZAEHLER: +6 Spalten an einer bestehenden Tabelle. Keine Tabelle, keine
--          Policy, kein Index, kein Trigger, keine Funktion — counter-neutral.

ALTER TABLE public.abrechnung
  ADD COLUMN IF NOT EXISTS auftragsdatei_path   text,
  ADD COLUMN IF NOT EXISTS auftragsdatei_size   integer,
  ADD COLUMN IF NOT EXISTS dta_sha256           text,
  ADD COLUMN IF NOT EXISTS auftragsdatei_sha256 text,
  ADD COLUMN IF NOT EXISTS signed_sha256        text,
  ADD COLUMN IF NOT EXISTS betriebsart          text;

COMMENT ON COLUMN public.abrechnung.auftragsdatei_path IS
  'Storage-Pfad der Auftragsdatei (Auftragssatz 348 Byte, GGT Anlage 2). Liegt neben der .dta — die beiden gehen nur PAARWEISE raus (Anhang 2 Kap. 9 § 3.1, Pruefstufe 1).';
COMMENT ON COLUMN public.abrechnung.auftragsdatei_size IS
  'Byte-Laenge der Auftragsdatei. Heute immer 348; als Spalte gefuehrt, damit ein Formatfehler auffaellt, ohne die Datei zu laden.';
COMMENT ON COLUMN public.abrechnung.dta_sha256 IS
  'SHA-256 der unsignierten Nutzdatendatei, hex. Beweismittel: welche Bytes wurden erzeugt (guvenlik Ö1). Kein Personenbezug.';
COMMENT ON COLUMN public.abrechnung.auftragsdatei_sha256 IS
  'SHA-256 der Auftragsdatei, hex.';
COMMENT ON COLUMN public.abrechnung.signed_sha256 IS
  'SHA-256 des signierten PKCS#7-Payloads (.p7m), hex. Wird beim Upload der Browser-Signatur gesetzt.';
COMMENT ON COLUMN public.abrechnung.betriebsart IS
  'Betriebsart, mit der DIESE Datei erzeugt wurde: test | erprobung | echt. Kopie aus terapeut_zertifikat.betriebsart zum Erzeugungszeitpunkt — die Einstellung kann sich spaeter aendern, die Datei nicht. NULL = vor Einfuehrung erzeugt (faktisch test).';

-- Nur die drei dokumentierten Werte. Ein vierter Wert waere ein
-- UNB-Testindikator, den die Annahmestelle nicht kennt.
ALTER TABLE public.abrechnung
  ADD CONSTRAINT abrechnung_betriebsart_chk
  CHECK (betriebsart IS NULL OR betriebsart IN ('test', 'erprobung', 'echt'));
