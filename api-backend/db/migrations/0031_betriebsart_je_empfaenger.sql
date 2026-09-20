-- §302-Echtbetrieb, Schritt 1.7 (ABRECHNUNG_ECHTBETRIEB_PLAN.md) —
-- Betriebsart je Paar (Praxis-Inhaber × Datenannahmestelle).
--
-- FACHLICHER GRUND (gkv-302, 20.09.2026):
--   Anlage 1 TP5 V21 Kap. 2 (1)(2), Kap. 3 (1) + Kap. 8, Anhang 2 zur Anlage 1
--   Kap. 9 § 1/§ 5/§ 6: Erprobung und Zulassung zum Echtverfahren laufen
--   zwischen Absender und Empfaenger. Ein praxisweites Einzel-Flag ist in
--   beide Richtungen still falsch:
--     • zu frueh echt -> Echtdatei an eine Datenannahmestelle OHNE Zulassung
--     • zu spaet echt -> Testdatei an eine Datenannahmestelle MIT Zulassung,
--       "loest keine Zahlungen aus" — das Geld bleibt einfach aus, es kommt
--       keine Fehlermeldung.
--
-- Migration 0028_terapeut_zertifikat_betriebsart.sql bildete zunaechst die
-- praxisweite Lesart ab. Sie bleibt unveraendert als Vorgabewert erhalten;
-- diese Tabelle bildet die Ausnahme je Empfaenger ab.
--
-- ZAEHLER: +1 Tabelle, +1 Policy, +1 Index (der Primaerschluessel), +0 Funktion, +0 Trigger.

CREATE TABLE public.betriebsart_empfaenger (
  owner_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empfaenger_ik       text NOT NULL,
  betriebsart         text NOT NULL DEFAULT 'test',
  zulassung_referenz  text,
  zulassung_datum     date,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (owner_id, empfaenger_ik)
);

COMMENT ON TABLE public.betriebsart_empfaenger IS
  'Ausnahmen der §302-Betriebsart je Paar (Praxis-Inhaber × Datenannahmestelle). Anlage 1 TP5 V21 Kap. 2 (1)(2), Kap. 3 (1) + Kap. 8, Anhang 2 zur Anlage 1 Kap. 9 § 1/§ 5/§ 6. Ohne Zeile gilt der Vorgabewert aus terapeut_zertifikat.';
COMMENT ON COLUMN public.betriebsart_empfaenger.empfaenger_ik IS
  'Institutionskennzeichen der Datenannahmestelle (Empfaenger der Abrechnungsdatei).';
COMMENT ON COLUMN public.betriebsart_empfaenger.betriebsart IS
  'test | erprobung | echt — steuert UNB-Testindikator (0/1/2) und Dateinamen (T/T/E) fuer diese Datenannahmestelle. Ueberschreibt terapeut_zertifikat.betriebsart.';
COMMENT ON COLUMN public.betriebsart_empfaenger.zulassung_referenz IS
  'Aktenzeichen/Referenz der Zulassung zum Echtverfahren fuer diese Datenannahmestelle. Erteilt die KRANKENKASSE, nicht die Datenannahmestelle. Pflicht bei betriebsart echt.';
COMMENT ON COLUMN public.betriebsart_empfaenger.zulassung_datum IS
  'Datum der schriftlichen Zulassung zum Echtverfahren fuer diese Datenannahmestelle.';

ALTER TABLE public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_betriebsart_chk
  CHECK (betriebsart IN ('test', 'erprobung', 'echt'));

ALTER TABLE public.betriebsart_empfaenger
  ADD CONSTRAINT betriebsart_empfaenger_echt_braucht_zulassung_chk
  CHECK (
    betriebsart <> 'echt'
    OR (btrim(COALESCE(zulassung_referenz, '')) <> '' AND zulassung_datum IS NOT NULL)
  );

ALTER TABLE public.betriebsart_empfaenger ENABLE ROW LEVEL SECURITY;

CREATE POLICY betriebsart_empfaenger_owner_all ON public.betriebsart_empfaenger
  USING (((auth.uid() = owner_id) OR (auth.uid() IN ( SELECT profiles.id
     FROM public.profiles
    WHERE (profiles.owner_id = betriebsart_empfaenger.owner_id)))));
