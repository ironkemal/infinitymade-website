-- services.kostentraeger_typ — Abrechnungsart je Leistung
--
-- ANLASS: Beta-Rueckmeldung 25.08.2026 — „Klare Trennung nach Abrechnungsart:
-- GKV bundeseinheitlich, Privat, Selbstzahler, BG."
--
-- Bisher wurde nur implizit unterschieden: `gkv_position_nr` gefuellt hiess GKV,
-- leer hiess Privat. **Selbstzahler und BG waren gar nicht abbildbar** — zwei
-- von fuenf Gruppen in der Leistungsuebersicht waren toter Code.
--
-- DRINGLICHKEIT: gering, aber die Funktion fehlt. Der Code laeuft auch ohne
-- dieses Skript: `module/leistungen-liste.js` faellt auf die alte implizite
-- Regel zurueck, und das Auswahlfeld „Abrechnungsart" bleibt ausgeblendet
-- (Erkennung: `module/kostentraeger-spalte.js`). Nichts ist kaputt, solange es
-- nicht laeuft — es fehlt nur die Faehigkeit.
--
-- WARUM `text` + CHECK UND NICHT ENUM ODER LOOKUP-TABELLE
-- Dieses Schema kennt keinen einzigen ENUM (0 × `CREATE TYPE`), dafuer 59
-- CHECK-Wertelisten. Alle vergleichbaren Felder sind so gebaut:
-- `invoices.invoice_type`, `leads.insurance_type`, `booking_requests.payment_type`,
-- `services.required_certificate`. Ein ENUM waere zudem der einzige Typ, aus dem
-- sich ein Wert spaeter nicht mehr entfernen liesse. Eine Lookup-Tabelle waere
-- fuer vier gesetzlich feste Kategorien ein Join zu viel bei jeder Abfrage.
--
-- WARUM NULL ERLAUBT BLEIBT
-- NULL ist kein Versaeumnis, sondern ein eigener Zustand: „nicht gepflegt,
-- bitte herleiten". Drei Gruende, die alle drei zaehlen:
--   1. Interne Leistungen (Kalenderblocker, Blanko-Zuschlaege) sind keine
--      abrechenbare Leistung. Sie zu einem Kostentraegertyp zu zwingen, waere
--      eine Luege in den Daten.
--   2. `api/stripe/webhook.js` und `api-backend/server.js` legen beim Onboarding
--      Leistungen ohne GKV-Felder an. Bei NOT NULL ohne Default braeche das
--      Onboarding.
--   3. Ein offener Browser-Tab, der waehrend der Migration speichert, liefe bei
--      NOT NULL in den Constraint.
--
-- WARUM `intern` NICHT IM CHECK STEHT
-- Darueber entscheidet `is_internal`. Zwei Spalten, die dasselbe behaupten
-- koennen, widersprechen sich irgendwann — und dann glaubt jeder Leser einer
-- anderen.

-- =====================================================================
-- 1. Spalte
-- =====================================================================
-- Ohne DEFAULT ist das in PostgreSQL 11+ eine reine Katalogaenderung: kein
-- Tabellen-Neuschreiben, keine spuerbare Sperre, auch bei laufendem Betrieb.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS kostentraeger_typ text;

-- =====================================================================
-- 2. Erlaubte Werte
-- =====================================================================
-- Muss deckungsgleich sein mit `ABRECHENBARE_TYPEN` in
-- `module/leistungen-liste.js` — ein Test wacht darueber
-- (`module/leistungen-liste.test.js`, „die Gruppendefinitionen sind vollstaendig").
-- `conname` ist nur JE TABELLE eindeutig. Ohne `conrelid` wuerde ein
-- gleichnamiges Constraint auf einer anderen Tabelle das Anlegen hier
-- stillschweigend ueberspringen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.services'::regclass
      AND conname = 'services_kostentraeger_typ_check'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_kostentraeger_typ_check
      CHECK (kostentraeger_typ IS NULL
             OR kostentraeger_typ IN ('gkv', 'privat', 'selbstzahler', 'bg'));
  END IF;
END $$;

-- =====================================================================
-- 3. Bestand nachtragen
-- =====================================================================
-- Pflicht, nicht Kuer: ohne diesen Schritt stuenden alle vorhandenen Leistungen
-- auf NULL. Sichtbar waeren sie trotzdem (der Rueckfall greift), aber die Praxis
-- muesste jede einzeln nachpflegen, um sie umzugruppieren.
--
-- Der Ausdruck bildet die alte implizite Regel aus `kostentraegerTyp()` nach,
-- damit nach der Migration jede Leistung genauso aussieht wie vorher.
--
-- ⚠️ Eine Abweichung bleibt: JS `.trim()` schneidet auch \t \n \r \f \v und
--    Unicode-Leerzeichen weg, `btrim()` ohne zweites Argument nur ASCII-Blanks.
--    Deshalb steht die Zeichenmenge hier ausgeschrieben. Vollstaendige Deckung
--    mit Unicode-Whitespace (NBSP u. a.) ist damit immer noch nicht erreicht —
--    praktisch unerreichbar, weil die Werte aus der festen <option>-Liste in
--    dashboard.html kommen und nie von Hand getippt werden.
--
-- Interne Leistungen bleiben bewusst NULL (siehe Kopf).
UPDATE public.services
SET kostentraeger_typ = CASE
      WHEN gkv_position_nr IS NOT NULL AND btrim(gkv_position_nr, E' \t\n\r\f\v') <> '' THEN 'gkv'
      ELSE 'privat'
    END
WHERE kostentraeger_typ IS NULL
  AND COALESCE(is_internal, false) = false;

-- =====================================================================
-- 4. Kontrolle — nach dem Lauf separat ausfuehren
-- =====================================================================
-- (a) Spalte und Constraint da?
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'services' AND column_name = 'kostentraeger_typ';
--   -- erwartet: kostentraeger_typ | text | YES
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE conname = 'services_kostentraeger_typ_check';
--   -- erwartet: CHECK (kostentraeger_typ IS NULL OR kostentraeger_typ = ANY (...))
--
-- (b) Zeilen je Typ. `intern` und NULL bei internen Leistungen sind in Ordnung.
--     Eine Zeile „OFFEN — NULL" waere ein Fehler: nicht-interne Leistung ohne Typ.
--
--   SELECT COALESCE(kostentraeger_typ,
--                   CASE WHEN is_internal THEN 'intern (NULL)' ELSE 'OFFEN — NULL' END) AS typ,
--          count(*)
--   FROM public.services
--   GROUP BY 1 ORDER BY 1;
--
-- (c) Vollstaendigkeit: keine nicht-interne Leistung ohne Typ. Muss 0 ergeben.
--
--   SELECT count(*) FROM public.services
--   WHERE COALESCE(is_internal, false) = false AND kostentraeger_typ IS NULL;
--
-- ⚠️ Was (c) NICHT beweist: dass sich die Anzeige nicht veraendert hat. Eine
--    Abfrage, die die Spalte gegen denselben CASE prueft, den das UPDATE gerade
--    geschrieben hat, ist tautologisch — sie kann gar nicht anders ausgehen.
--    Wer die Anzeige wirklich absichern will, zaehlt VOR dem Lauf:
--
--      SELECT CASE WHEN COALESCE(is_internal,false) THEN 'intern'
--                  WHEN gkv_position_nr IS NOT NULL
--                       AND btrim(gkv_position_nr, E' \t\n\r\f\v') <> '' THEN 'gkv'
--                  ELSE 'privat' END AS typ, count(*)
--      FROM public.services GROUP BY 1 ORDER BY 1;
--
--    und vergleicht das Ergebnis mit (b) nach dem Lauf. Die Zahlen muessen
--    uebereinstimmen ('intern' dort = 'intern (NULL)' hier).

-- =====================================================================
-- 5. RUECKBAU — nur von Hand, nie automatisch
-- =====================================================================
-- ⚠️ UNUMKEHRBAR: `DROP COLUMN` verwirft jeden von Hand gepflegten Wert. Alles,
--    was eine Praxis nach der Migration als Selbstzahler oder BG eingetragen
--    hat, ist danach weg und laesst sich aus `gkv_position_nr` nicht
--    rekonstruieren — diese Information gab es vorher schlicht nicht.
--
--    Vorher sichern:
--      SELECT id, title, kostentraeger_typ FROM public.services
--      WHERE kostentraeger_typ IN ('selbstzahler', 'bg');
--
--    ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_kostentraeger_typ_check;
--    ALTER TABLE public.services DROP COLUMN IF EXISTS kostentraeger_typ;
--
-- Der Code ueberlebt den Rueckbau ohne Aenderung: `kostentraeger-spalte.js`
-- stellt die fehlende Spalte wieder fest, das Auswahlfeld blendet sich aus,
-- und `kostentraegerTyp()` faellt auf die implizite Regel zurueck.
--
-- ⚠️ ABER: erst nach einem Neuladen. `bekannt` klebt an der Sitzung. Ein Tab,
--    der vor dem DROP schon "Spalte da" gemerkt hat, schickt `kostentraeger_typ`
--    weiter mit, und jedes Speichern schlaegt fehl. Nach einem Rueckbau also
--    allen offenen Tabs einen Neuladen verordnen.

-- =====================================================================
-- DANACH NICHT VERGESSEN
-- =====================================================================
-- Regel aus db/README.md: nach jeder Schemaaenderung werden db/SCHEMA.sql und
-- db/SCHEMA-RLS.sql neu aus der Datenbank erzeugt, im selben Commit, samt Datum
-- und letzter Migration im Kopf beider Dateien. Tetikleyici: „schema güncelle".
--
-- Sonst zeigt der Dump eine `services`-Tabelle ohne diese Spalte — und wer ihn
-- liest, glaubt es.
