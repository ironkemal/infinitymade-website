-- Zuzahlung bei Abbruch korrigierbar machen — Ops-Karte 31.08.2026 (Podologie, hoch)
--
-- Der Fall: der Patient bricht nach 3 von 6 Einheiten ab. `prescriptions.zuzahlung_eur`
-- steht weiter auf dem Betrag für 6 Einheiten, weil er beim Anlegen der Verordnung
-- von Hand eingetragen wurde. Beta-1 rechnet den richtigen Betrag heute im Kopf aus.
--
-- Drei Fähigkeiten, zwei Tabellen:
--   1. Einheitenzahl senken        -> zuzahlung_korrekturen (alt_/neu_einheiten)
--   2. Betrag von Hand überschreiben -> zuzahlung_korrekturen (alt_/neu_betrag_eur)
--   3. Zuviel gezahltes als Guthaben führen und verrechnen -> zuzahlung_guthaben
--
-- WARUM ZWEI TABELLEN UND NICHT SPALTEN AN `prescriptions`
-- Eine Verordnung kann mehrfach korrigiert werden. Spalten würden die vorige
-- Begründung überschreiben — genau das, was GoBD verbietet. Der geforderte
-- Betrag bleibt weiter in `prescriptions.zuzahlung_eur` (das Jetzt);
-- `zuzahlung_korrekturen` trägt das Davor. Dadurch bleiben Mahnwesen, Statistik,
-- Kassieren und `istZuzahlungBezahlt()` unverändert.
--
-- WARUM NICHT ÜBER `belegliste`
-- Das Kassenbuch bildet Zahlungsvorgänge ab (§ 146 AO) und ist append-only. Ein
-- Guthaben ist kein Zahlungsvorgang, sondern ein Zustand, der sich ändert
-- (offen -> teilweise verrechnet -> verrechnet). Ein veränderlicher Zustand in
-- einem unveränderlichen Buch geht nicht. Fliesst echtes Bargeld zurück, wird
-- weiterhin ganz normal ein `type='storno'`-Beleg gebucht — dieser Weg bleibt.

-- =====================================================================
-- 1. Guthaben — der veränderliche Teil
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.zuzahlung_guthaben (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  business_id UUID,
  -- Das Guthaben gehört dem PATIENTEN, nicht der Verordnung: es soll ja auf die
  -- nächste Verordnung angerechnet werden. Deshalb NOT NULL und CASCADE —
  -- gleiches Muster wie zuzahlung_befreiung, und die DSGVO-Löschung räumt mit ab.
  patient_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Woraus es entstanden ist. Höchstens eine der beiden Quellen; nach einer
  -- Löschung dürfen beide leer sein, das Guthaben bleibt bestehen.
  quelle_prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  quelle_verordnung_id   UUID REFERENCES public.verordnungen(id)  ON DELETE SET NULL,

  betrag_eur NUMERIC(10,2) NOT NULL CHECK (betrag_eur > 0),
  rest_eur   NUMERIC(10,2) NOT NULL CHECK (rest_eur >= 0),

  status TEXT NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'teilweise_verrechnet', 'verrechnet', 'ausgezahlt', 'verfallen')),
  notiz TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT zuzahlung_guthaben_rest_hoechstens_betrag CHECK (rest_eur <= betrag_eur),
  CONSTRAINT zuzahlung_guthaben_ein_bezug
    CHECK (NOT (quelle_prescription_id IS NOT NULL AND quelle_verordnung_id IS NOT NULL))
);

COMMENT ON TABLE public.zuzahlung_guthaben IS
  'Zuviel gezahlte Zuzahlung, die auf eine spaetere Verordnung angerechnet wird. '
  'Entsteht, wenn das Soll nach einer Korrektur unter den bereits kassierten Betrag faellt.';

CREATE INDEX IF NOT EXISTS idx_zuzahlung_guthaben_patient_offen
  ON public.zuzahlung_guthaben (patient_id)
  WHERE status IN ('offen', 'teilweise_verrechnet');
CREATE INDEX IF NOT EXISTS idx_zuzahlung_guthaben_owner
  ON public.zuzahlung_guthaben (owner_id, created_at DESC);

-- Der Status ist abgeleitet, nicht eingegeben — sonst behauptet irgendwann eine
-- Zeile „verrechnet" bei rest_eur = 12,00 €. Auszahlung und Verfall setzt der
-- Mensch und bleiben unangetastet.
CREATE OR REPLACE FUNCTION public.fn_zuzahlung_guthaben_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('ausgezahlt', 'verfallen') THEN
    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
  END IF;
  NEW.status := CASE
    WHEN NEW.rest_eur = 0                 THEN 'verrechnet'
    WHEN NEW.rest_eur < NEW.betrag_eur    THEN 'teilweise_verrechnet'
    ELSE 'offen'
  END;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zuzahlung_guthaben_status ON public.zuzahlung_guthaben;
CREATE TRIGGER trg_zuzahlung_guthaben_status
  BEFORE INSERT OR UPDATE ON public.zuzahlung_guthaben
  FOR EACH ROW EXECUTE FUNCTION public.fn_zuzahlung_guthaben_status();

-- =====================================================================
-- 2. Korrekturen — der unveränderliche Teil
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.zuzahlung_korrekturen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  business_id UUID,
  patient_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Höchstens einer der beiden Verordnungstöpfe. Podologie (`verordnungen`) ist
  -- hier von Anfang an vorgesehen, damit die Tabelle nicht spaeter aufgebrochen
  -- werden muss — siehe HINWEIS am Dateiende.
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  verordnung_id   UUID REFERENCES public.verordnungen(id)  ON DELETE SET NULL,

  alt_betrag_eur NUMERIC(10,2),
  neu_betrag_eur NUMERIC(10,2) NOT NULL CHECK (neu_betrag_eur >= 0),
  alt_einheiten  INTEGER,
  neu_einheiten  INTEGER CHECK (neu_einheiten IS NULL OR neu_einheiten >= 0),

  grund_code TEXT NOT NULL CHECK (grund_code IN (
    'abbruch',                -- Patient hat die Behandlung nicht zu Ende gefuehrt
    'korrektur_soll',         -- Betrag war schlicht falsch erfasst
    'guthaben_verrechnung',   -- Soll gesenkt, weil ein Guthaben angerechnet wurde
    'befreiung_nachgereicht', -- Befreiungsnachweis kam spaeter
    'sonstiges'
  )),
  -- Eine Begruendung ist Pflicht und darf kein Leerzeichen sein. Ein Betrag,
  -- der sich ohne Grund aendert, ist im Nachhinein nicht mehr erklaerbar.
  grund TEXT NOT NULL CHECK (length(btrim(grund)) >= 3),

  guthaben_id UUID REFERENCES public.zuzahlung_guthaben(id) ON DELETE SET NULL,

  erfasst_von UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  erfasst_am  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT zuzahlung_korrekturen_ein_bezug
    CHECK (NOT (prescription_id IS NOT NULL AND verordnung_id IS NOT NULL))
);

COMMENT ON TABLE public.zuzahlung_korrekturen IS
  'GoBD-Protokoll jeder Aenderung am geforderten Zuzahlungsbetrag: wer, wann, '
  'alter Wert, neuer Wert, Grund. Append-only. Der GUELTIGE Betrag steht weiterhin '
  'in prescriptions.zuzahlung_eur — diese Tabelle ist das Gedaechtnis, nicht die Wahrheit.';

CREATE INDEX IF NOT EXISTS idx_zuzahlung_korrekturen_rezept
  ON public.zuzahlung_korrekturen (prescription_id, erfasst_am DESC);
CREATE INDEX IF NOT EXISTS idx_zuzahlung_korrekturen_verordnung
  ON public.zuzahlung_korrekturen (verordnung_id, erfasst_am DESC);
CREATE INDEX IF NOT EXISTS idx_zuzahlung_korrekturen_owner
  ON public.zuzahlung_korrekturen (owner_id, erfasst_am DESC);

-- Gleiche Härte wie belegliste: ein Protokoll, das sich nachtraeglich aendern
-- laesst, ist kein Protokoll. Wortlaut bewusst nah an prevent_belegliste_mod().
CREATE OR REPLACE FUNCTION public.prevent_zuzahlung_korrekturen_mod()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Das Zuzahlungs-Korrekturprotokoll ist unveraenderlich (GoBD). '
                  'Eine falsche Korrektur wird durch eine NEUE Korrektur richtiggestellt.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_zuzahlung_korrekturen_mod ON public.zuzahlung_korrekturen;
CREATE TRIGGER trg_prevent_zuzahlung_korrekturen_mod
  BEFORE UPDATE OR DELETE ON public.zuzahlung_korrekturen
  FOR EACH ROW EXECUTE FUNCTION public.prevent_zuzahlung_korrekturen_mod();

-- =====================================================================
-- 3. RLS — Muster „owner + Team" wie belegliste / zuzahlung_befreiung
-- =====================================================================
ALTER TABLE public.zuzahlung_guthaben    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zuzahlung_korrekturen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guthaben owner scoping" ON public.zuzahlung_guthaben;
CREATE POLICY "Guthaben owner scoping" ON public.zuzahlung_guthaben
  FOR ALL USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = zuzahlung_guthaben.owner_id)
  ) WITH CHECK (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = zuzahlung_guthaben.owner_id)
  );

-- Lesen und Anlegen ja, Aendern/Loeschen nein — das erledigt zusaetzlich der
-- Trigger. Zwei Riegel, weil ein Policy-Fehler sonst still das Protokoll oeffnet.
DROP POLICY IF EXISTS "Korrekturen select scoping" ON public.zuzahlung_korrekturen;
CREATE POLICY "Korrekturen select scoping" ON public.zuzahlung_korrekturen
  FOR SELECT USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = zuzahlung_korrekturen.owner_id)
  );

DROP POLICY IF EXISTS "Korrekturen insert scoping" ON public.zuzahlung_korrekturen;
CREATE POLICY "Korrekturen insert scoping" ON public.zuzahlung_korrekturen
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = zuzahlung_korrekturen.owner_id)
  );

-- =====================================================================
-- HINWEIS ZUR PODOLOGIE (31.08.2026)
-- =====================================================================
-- Beide Tabellen tragen `verordnung_id` bzw. `quelle_verordnung_id` von Anfang
-- an. Benutzt wird heute nur der `prescriptions`-Topf, denn im Podologie-Topf
-- gibt es noch gar keinen gespeicherten Zuzahlungsbetrag, den man senken
-- koennte: `verordnungen` hat nur `zuzahlung_befreit`, der Betrag wird
-- ausschliesslich beim Erzeugen der DTA-Datei fluechtig gerechnet
-- (abrechnung.routes.js, create-podologie) und nirgends abgelegt. Entsprechend
-- kennen Kassieren, Kassenbuch, Mahnwesen und Statistik podologische
-- Zuzahlungen bis heute nicht.
--
-- Das symmetrisch nachzuziehen ist ein eigenes Stueck Arbeit (Spalten an
-- `verordnungen`, `belegliste.verordnung_id`, Mahnwesen, Statistik, Kassieren)
-- und eine Produktentscheidung, keine Nebenwirkung dieser Karte. Die Spalten
-- hier stehen bereit, damit die Tabellen dafuer nicht erneut aufgemacht werden
-- muessen.
