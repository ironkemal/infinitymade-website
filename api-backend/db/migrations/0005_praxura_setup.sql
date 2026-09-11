-- Faz 2.2 (Einrichtungsassistent) — das Zeichen, dass der SETUP_TOKEN verbraucht ist.
--
-- Warum eine Tabelle und nicht die .env: install.sh erzeugt den Token und schreibt ihn
-- nach .env; der Container liest seine Umgebung aber NUR beim Start. Der Assistent
-- laeuft im Container und kann die Datei deshalb nicht sinnvoll aendern (und soll es
-- auch nicht — Geheimnisse erzeugt/aendert install.sh, G2). Bleibt: ein dauerhaftes
-- Zeichen in der Datenbank, die der Assistent ohnehin schon beschreibt.
--
-- Naechster Verwandter ist praxura_migrations: kein Produktdatensatz, sondern ein
-- Buch ueber den Zustand der Box. Deshalb derselbe Namensraum (praxura_*) und
-- dieselbe Behandlung: RLS an, KEINE Policy, anon/authenticated ohne Rechte.
--
-- Drei Festlegungen, die hier Gesetz sind (onprem/REGISTER.md, Faz 2.2):
--   1. Der Klartext-Token steht NIE in der Datenbank — nur sein SHA-256, und erst
--      beim Verbrauch. Wer die DB liest, kann damit keine zweite Box uebernehmen.
--   2. Der Verbrauch ist EIN bedingtes UPDATE, kein SELECT-dann-UPDATE:
--        UPDATE praxura_setup
--           SET verbraucht_am = now(), token_sha256 = $1, owner_user_id = $2
--         WHERE id = 1 AND verbraucht_am IS NULL
--        RETURNING id;
--      Keine Zeile zurueck = war schon verbraucht. Zwei gleichzeitige Anfragen
--      koennen so nie zwei Owner anlegen.
--   3. Das Tor ist die Umgebungsvariable, nicht diese Tabelle. Ist SETUP_TOKEN leer
--      (SaaS), werden die /setup-Routen gar nicht erst registriert und niemand fasst
--      die Tabelle an. "Gibt es schon einen Owner?" wird NICHT gezaehlt — das Verhalten
--      der Produktion an einen Datenbestand zu haengen ist genau die Tuer, die
--      irgendwann im falschen Moment aufgeht.
--
-- Im SaaS existiert die Tabelle also, bleibt aber fuer immer eine leere Zeile. Das ist
-- der guenstigere Preis: eine inerte Zeile kostet nichts, ein Schema-Unterschied
-- zwischen Box und Produktion kostet den naechsten Fehlersuchtag (SCHEMA-VERTEILUNG §5.2,
-- "Fork yok"). Ein eigenes, nicht von PostgREST ausgeliefertes Schema waere strenger,
-- wuerde aber Suchpfad und Grants an einer Stelle aufmachen, an der wir sonst nichts
-- zu regeln haben — dafuer ist eine Zeile zu wenig Gewinn.

CREATE TABLE IF NOT EXISTS public.praxura_setup (
  id                smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  angelegt_am       timestamptz NOT NULL DEFAULT now(),
  token_sha256      text,
  verbraucht_am     timestamptz,
  owner_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  abgeschlossen_am  timestamptz,
  schritte          jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Verbraucht heisst: Zeitpunkt UND Hash stehen da. Ein Hash ohne Zeitpunkt waere
  -- ein halber Schreibvorgang, ein Zeitpunkt ohne Hash nicht nachvollziehbar.
  -- owner_user_id steht bewusst NICHT in dieser Bedingung: der FK oben setzt sie auf
  -- NULL, wenn das Konto spaeter geloescht wird — das darf die Zeile nicht ungueltig
  -- machen. Dass verbraucht wurde, sagt verbraucht_am, nicht der Owner.
  CONSTRAINT praxura_setup_verbrauch_vollstaendig CHECK (
    (verbraucht_am IS NULL     AND token_sha256 IS NULL AND owner_user_id IS NULL)
    OR
    (verbraucht_am IS NOT NULL AND token_sha256 IS NOT NULL)
  ),

  -- Abgeschlossen kann nur werden, was verbraucht wurde (Schritt 8 nach Schritt 5).
  CONSTRAINT praxura_setup_abschluss_nach_verbrauch CHECK (
    abgeschlossen_am IS NULL OR verbraucht_am IS NOT NULL
  )
);

-- Die eine Zeile wird HIER angelegt, nicht vom Assistenten. Sonst waere der Verbrauch
-- ein INSERT … ON CONFLICT und damit ein zweiter Nebenlaeufigkeitsfall mehr als noetig;
-- so ist er ein reines UPDATE (Festlegung 2 oben).
INSERT INTO public.praxura_setup (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Wie bei praxura_migrations: RLS allein liefert anon nur leere Ergebnisse, erst der
-- Entzug macht daraus 42501. Noetig, weil pg_default_acl in public jeder neuen Tabelle
-- automatisch ALL an anon/authenticated/service_role gibt (live nachgesehen 11.09.2026).
-- service_role behaelt die Rechte — der Assistent schreibt genau damit, und wer diesen
-- Schluessel hat, hat ohnehin die ganze Datenbank.
ALTER TABLE public.praxura_setup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.praxura_setup FROM anon, authenticated;

COMMENT ON TABLE public.praxura_setup IS
  'Eine Zeile je Box: ist der SETUP_TOKEN aus install.sh schon gegen den ersten Owner eingetauscht worden? Kein Produktdatensatz. Im SaaS vorhanden, aber unberuehrt (Tor ist die Umgebungsvariable SETUP_TOKEN, nicht diese Tabelle). Seit 0005 (11.09.2026), Faz 2.2.';
COMMENT ON COLUMN public.praxura_setup.token_sha256 IS
  'SHA-256 des verbrauchten Tokens, hex. Nie der Klartext. Erst beim Verbrauch gesetzt — dient dem Nachweis "dieser Token war es", nicht der Pruefung (die vergleicht gegen die Umgebungsvariable, zeitkonstant).';
COMMENT ON COLUMN public.praxura_setup.verbraucht_am IS
  'Gesetzt beim Anlegen des ersten Owners (Schritt 5). Wird ueber UPDATE … WHERE verbraucht_am IS NULL gesetzt — das ist die Einmaligkeitsgarantie.';
COMMENT ON COLUMN public.praxura_setup.owner_user_id IS
  'auth.users.id des angelegten Inhabers. NULL heisst nicht "unverbraucht" — das Konto kann geloescht worden sein (FK ON DELETE SET NULL).';
COMMENT ON COLUMN public.praxura_setup.abgeschlossen_am IS
  'Ende des Assistenten (Schritt 8, nach den billigen Pruefungen). Solange NULL und verbraucht_am gesetzt: Owner existiert, Assistent unfertig — der angemeldete Owner darf fortsetzen.';
COMMENT ON COLUMN public.praxura_setup.schritte IS
  'Nur Zustand der Assistenten-Schritte (erledigt/uebersprungen, Ergebnis der billigen Pruefungen). KEINE Geheimnisse, keine Zugangsdaten, keine Patientendaten — die Zeile wird in Supportfaellen gelesen.';
