-- ==============================================
-- INFINITY V12 — § 302 SGB V Anlage 3 V22 Code Lists
-- 2026-05-18
--
-- Source: handbücher/Anlage_3_TP5_V22_20260218.pdf (V22, gültig ab 01.02.2027)
-- Single normalized reference table seeded from all relevant Schlüssel-
-- Verzeichnisse. Frontend dropdowns + builder validation use this table.
-- ==============================================

CREATE TABLE IF NOT EXISTS dta_schluessel (
  id              BIGSERIAL PRIMARY KEY,
  schluessel_typ  TEXT NOT NULL,                   -- e.g. 'verarbeitungskennzeichen'
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  leistungsbereich TEXT,                           -- 'A'..'S' if applicable
  notes           TEXT,
  source_version  TEXT NOT NULL DEFAULT 'Anlage 3 V22',
  valid_from      DATE,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (schluessel_typ, code, source_version)
);

CREATE INDEX IF NOT EXISTS idx_schluessel_typ ON dta_schluessel (schluessel_typ, active);
CREATE INDEX IF NOT EXISTS idx_schluessel_bereich ON dta_schluessel (leistungsbereich) WHERE leistungsbereich IS NOT NULL;

ALTER TABLE dta_schluessel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dta_schluessel_read_all" ON dta_schluessel;
CREATE POLICY "dta_schluessel_read_all" ON dta_schluessel
  FOR SELECT USING (auth.role() = 'authenticated');

-- §8.1.7 Verarbeitungskennzeichen ----------------------------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('verarbeitungskennzeichen', '01', 'Abrechnung ohne Besonderheiten'),
  ('verarbeitungskennzeichen', '02', 'Nachforderung'),
  ('verarbeitungskennzeichen', '03', 'Zuzahlungsforderung'),
  ('verarbeitungskennzeichen', '04', 'Korrekturrechnung'),
  ('verarbeitungskennzeichen', '10', 'Wiederaufnahme')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.4 Rechnungsart ----------------------------------------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('rechnungsart', '1', 'Abrechnung von Leistungserbringer, Zahlung an IK LE'),
  ('rechnungsart', '2', 'Über Abrechnungsstelle (ohne Inkasso), Zahlung an IK LE'),
  ('rechnungsart', '3', 'Über Abrechnungsstelle (mit Inkasso), Zahlung an IK Abrechnungsstelle')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.3 Zuzahlungskennzeichen -------------------------------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('zuzahlungskennzeichen', '0', 'keine gesetzliche Zuzahlung'),
  ('zuzahlungskennzeichen', '1', 'Zuzahlungsbefreit'),
  ('zuzahlungskennzeichen', '2', 'keine Zuzahlung trotz Zahlungsaufforderung'),
  ('zuzahlungskennzeichen', '3', 'Zuzahlungspflichtig'),
  ('zuzahlungskennzeichen', '4', 'Übergang zuzahlungspflichtig → zuzahlungsfrei'),
  ('zuzahlungskennzeichen', '5', 'Übergang zuzahlungsfrei → zuzahlungspflichtig')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.2 Unfallkennzeichen + §8.1.2.1 BVG/SER ----------------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('unfallkennzeichen', '1', 'Arbeitsunfall / Wegeunfall / Berufskrankheit'),
  ('unfallkennzeichen', '2', 'sonstige Unfallfolgen'),
  ('unfallkennzeichen', '3', 'Sonstiges (BVFG, BEG, HHG, OEG, IfSG, SVG)'),
  ('bvg_ser', '6', 'BVG/SER')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.11 Verordnungsbesonderheiten -------------------------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('verordnungsbesonderheiten', '1', 'Verordnung von Zahnarzt/Kieferorthopäden'),
  ('verordnungsbesonderheiten', '2', 'Schwangerschaft / Entbindung'),
  ('verordnungsbesonderheiten', '4', 'Entlassmanagement'),
  ('verordnungsbesonderheiten', '7', 'Terminservicestellen'),
  ('verordnungsbesonderheiten', '8', 'Empfehlung nach §40 Abs.6 SGB XI (nur Hilfsmittel)'),
  ('verordnungsbesonderheiten', '9', 'Modellvorhaben nach §64d SGB V')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.12 Verordnungsart Heilmittel -------------------------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('verordnungsart_heilmittel', '03', 'orientierende Behandlungsmenge (§7 Abs.1-5 HeilM-RL)'),
  ('verordnungsart_heilmittel', '04', 'besonderer Verordnungsbedarf / langfristiger HM-Bedarf (§7 Abs.6)'),
  ('verordnungsart_heilmittel', '05', 'Blankoverordnung (§13a HeilM-RL)')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.6 Summenstatus ----------------------------------------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('summenstatus', '00', 'Gesamtsumme aller Status'),
  ('summenstatus', '11', 'Mitglieder (Status beginnt mit 1)'),
  ('summenstatus', '31', 'Angehörige (Status beginnt mit 3)'),
  ('summenstatus', '51', 'Rentner (Status beginnt mit 5)'),
  ('summenstatus', '99', 'nicht zuzuordnende Status')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.18 Beleginformation ----------------------------------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('beleginformation', '0', 'keine Belegübermittlung'),
  ('beleginformation', '1', 'Belege per Post übermittelt'),
  ('beleginformation', '2', 'Belege elektronisch übermittelt')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.14 Leistungserbringer-Sammelgruppenschlüssel ---------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label, leistungsbereich) VALUES
  ('sammelgruppe', 'A', 'Hilfsmittel', 'A'),
  ('sammelgruppe', 'B', 'Heilmittel', 'B'),
  ('sammelgruppe', 'C', 'Häusliche Krankenpflege', 'C'),
  ('sammelgruppe', 'D', 'Haushaltshilfe', 'D'),
  ('sammelgruppe', 'E', 'Krankentransport', 'E'),
  ('sammelgruppe', 'F', 'Hebammen', 'F'),
  ('sammelgruppe', 'G', 'Dialyse (nichtärztlich)', 'G'),
  ('sammelgruppe', 'H', 'Rehabilitationssport', 'H'),
  ('sammelgruppe', 'I', 'Funktionstraining', 'I'),
  ('sammelgruppe', 'J', 'Sonstige Leistungserbringer', 'J'),
  ('sammelgruppe', 'K', 'Präventions-/Vorsorgeleistungen', 'K'),
  ('sammelgruppe', 'L', 'ergänzende Rehamaßnahmen', 'L'),
  ('sammelgruppe', 'M', 'Sozialpädiatrie / Frühförderung', 'M'),
  ('sammelgruppe', 'N', 'Soziotherapie', 'N'),
  ('sammelgruppe', 'O', 'SAPV', 'O'),
  ('sammelgruppe', 'P', '§132g SGB V', 'P'),
  ('sammelgruppe', 'Q', 'Kurzzeitpflege', 'Q'),
  ('sammelgruppe', 'R', 'Außerklinische Intensivpflege', 'R'),
  ('sammelgruppe', 'S', 'Modellvorhaben §64d SGB V', 'S')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.5.1 Abrechnungscode (LE-Code) — Heilmittel (B) ekleniyor önce ----------
INSERT INTO dta_schluessel (schluessel_typ, code, label, leistungsbereich) VALUES
  ('abrechnungscode', '21', 'Masseur / Med. Badebetrieb',     'B'),
  ('abrechnungscode', '22', 'Krankengymnast / Physiotherapeut', 'B'),
  ('abrechnungscode', '23', 'Logopäde / Sprachtherapeut',     'B'),
  ('abrechnungscode', '24', 'Sprachheilpädagoge',             'B'),
  ('abrechnungscode', '25', 'Sonstiger Sprachtherapeut',      'B'),
  ('abrechnungscode', '26', 'Ergotherapeut',                  'B'),
  ('abrechnungscode', '27', 'Krankenhaus (Heilmittel)',       'B'),
  ('abrechnungscode', '28', 'Kurbetrieb',                     'B'),
  ('abrechnungscode', '29', 'Sonstige therap. Heilperson',    'B'),
  ('abrechnungscode', '71', 'Podologe',                       'B'),
  ('abrechnungscode', '72', 'Med. Fußpfleger (§10 Abs.4-6 PodG)', 'B'),
  ('abrechnungscode', '73', 'Ernährungstherapie (seltene Stoffwechselerkrk.)', 'B'),
  ('abrechnungscode', '74', 'Ernährungstherapie (Mukoviszidose)', 'B')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.5.2 Tarifbereich (Stelle 1+2 des Tarifkennzeichens) --------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label) VALUES
  ('tarifbereich', '00', 'Bundeseinheitlich (Ost+West)'),
  ('tarifbereich', '01', 'Baden-Württemberg'),
  ('tarifbereich', '02', 'Bayern'),
  ('tarifbereich', '03', 'Berlin Ost'),
  ('tarifbereich', '04', 'Bremen'),
  ('tarifbereich', '05', 'Hamburg'),
  ('tarifbereich', '06', 'Hessen'),
  ('tarifbereich', '07', 'Niedersachsen'),
  ('tarifbereich', '08', 'Nordrhein-Westfalen'),
  ('tarifbereich', '09', 'Rheinland-Pfalz'),
  ('tarifbereich', '10', 'Saarland'),
  ('tarifbereich', '11', 'Schleswig-Holstein'),
  ('tarifbereich', '12', 'Brandenburg'),
  ('tarifbereich', '13', 'Sachsen'),
  ('tarifbereich', '14', 'Sachsen-Anhalt'),
  ('tarifbereich', '15', 'Mecklenburg-Vorpommern'),
  ('tarifbereich', '16', 'Thüringen'),
  ('tarifbereich', '17', 'Stuttgart / Karlsruhe'),
  ('tarifbereich', '18', 'Freiburg / Tübingen'),
  ('tarifbereich', '19', 'Berlin West'),
  ('tarifbereich', '20', 'Nordrhein'),
  ('tarifbereich', '21', 'Westfalen-Lippe'),
  ('tarifbereich', '22', 'Lippe'),
  ('tarifbereich', '23', 'Berlin (gesamt)'),
  ('tarifbereich', '24', 'Bundeseinheitlich (West)'),
  ('tarifbereich', '25', 'Bundeseinheitlich (Ost)')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;

-- §8.1.17 Art der Genehmigung (Heilmittel subset) ----------------------------
INSERT INTO dta_schluessel (schluessel_typ, code, label, leistungsbereich) VALUES
  ('art_genehmigung', 'B2', 'Genehmigung gem. §8 Abs.3 HeilM-RL (langfristiger Heilmittelbedarf)', 'B')
ON CONFLICT (schluessel_typ, code, source_version) DO NOTHING;
