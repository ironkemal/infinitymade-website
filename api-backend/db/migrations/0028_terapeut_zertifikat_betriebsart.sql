-- §302-Echtbetrieb, Schritt 1.7 (ABRECHNUNG_ECHTBETRIEB_PLAN.md) — `kind` wird DREIwertig.
--
-- Bisher steht in allen drei Erzeugungsrouten hart `kind: 'test'`. Der Weg in
-- den Echtbetrieb fuehrt aber ueber DREI Stufen, nicht ueber zwei:
--
--   Stufe          UNB-Testindikator   physikalischer Dateiname
--   Testverfahren  0                   TSOL0nnn
--   Erprobung      1                   TSOL0nnn   ← das "T" bleibt!
--   Echtbetrieb    2                   ESOL0nnn
--
-- ⚠️ In der Erprobung bleibt der Dateiname "T". Das ist gegenintuitiv (es
--    gehen echte Daten raus) und jemand wird es "korrigieren" wollen.
--    filename.js:73 und auftragsdatei.js:142 machen es bereits richtig.
--
-- WARUM DB-SPALTE UND KEINE UMGEBUNGSVARIABLE (onprem O-117, 20.09.2026):
--   • Im SaaS ist eine Umgebungsvariable mandantenuebergreifend — sie wuerde
--     ALLE Praxen gleichzeitig umstellen, auch die ohne Zulassung.
--   • In der Kundenbox bedeutet eine Umgebungsvariable: `.env` bearbeiten und
--     den Container neu erzeugen. Der Kunde macht das nicht, und wir kommen
--     nicht hinein (K10). Der Schalter muss dort liegen, wo der Inhaber
--     drankommt.
--   ⛔ `praxura_setup` scheidet aus: die Tabelle existiert nur in der Box,
--      im SaaS gaebe es keine Entsprechung — zwei Codewege (G7).
--
-- WARUM AN `terapeut_zertifikat`:
--   Die Tabelle traegt bereits owner_id (PK) UND ik_nummer, also genau das
--   Paar, unter dem eine Praxis §302 einreicht. Eine eigene Tabelle fuer drei
--   Spalten waere ein zweiter Ort fuer dieselbe Identitaet.
--
-- ❓ OFFENE FACHFRAGE AN `gkv-302` — bewusst hier notiert, nicht geraten:
--    Wird die Zulassung zum Echtverfahren JE PRAXIS oder JE PRAXIS ×
--    DATENANNAHMESTELLE erteilt? Diese Migration bildet die erste Lesart ab
--    (eine Zeile je owner). Ist die zweite richtig, braucht es eine
--    Zuordnungstabelle (owner_id, das_ik) — dann ist DIESE Spalte der
--    Vorgabewert und die Tabelle die Ausnahme. Additiv nachruestbar,
--    deshalb blockiert die offene Frage den Schritt nicht.
--
-- ZAEHLER: +5 Spalten + 2 CHECK an einer bestehenden Tabelle.
--          Keine Tabelle, keine Policy, kein Index, kein Trigger,
--          keine Funktion — counter-neutral.

ALTER TABLE public.terapeut_zertifikat
  ADD COLUMN IF NOT EXISTS betriebsart              text NOT NULL DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS betriebsart_geaendert_am timestamptz,
  ADD COLUMN IF NOT EXISTS betriebsart_geaendert_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zulassung_referenz       text,
  ADD COLUMN IF NOT EXISTS zulassung_datum          date;

COMMENT ON COLUMN public.terapeut_zertifikat.betriebsart IS
  'test | erprobung | echt — steuert UNB-Testindikator (0/1/2) und den ersten Buchstaben des physikalischen Dateinamens (T/T/E). Vorgabe test. Umgestellt wird ausschliesslich vom Inhaber ueber die Oberflaeche, nie per Umgebungsvariable (onprem O-117).';
COMMENT ON COLUMN public.terapeut_zertifikat.zulassung_referenz IS
  'Aktenzeichen/Referenz der Zulassung zum Echtverfahren. Erteilt die KRANKENKASSE, nicht die Datenannahmestelle. Pflicht, bevor betriebsart auf echt gehen darf.';
COMMENT ON COLUMN public.terapeut_zertifikat.zulassung_datum IS
  'Datum der schriftlichen Zulassung zum Echtverfahren.';

ALTER TABLE public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_betriebsart_chk
  CHECK (betriebsart IN ('test', 'erprobung', 'echt'));

-- Der eigentliche Riegel: ohne nachgewiesene Zulassung keine Echtdatei.
-- Die Pruefung gehoert in die Datenbank und nicht (nur) in die Route —
-- `abrechnung` wird auch vom Frontend ueber PostgREST gelesen und
-- geschrieben, und eine Regel, die nur in einer von drei Routen steht, ist
-- keine Regel. Aus demselben Grund steht sie NICHT als Anwendungslogik da.
ALTER TABLE public.terapeut_zertifikat
  ADD CONSTRAINT terapeut_zertifikat_echt_braucht_zulassung_chk
  CHECK (
    betriebsart <> 'echt'
    OR (btrim(COALESCE(zulassung_referenz, '')) <> '' AND zulassung_datum IS NOT NULL)
  );
