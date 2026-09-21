-- Ops #301 — krankenkassen.ik_number: Bestand bereinigt (13 Zeilen, nur Daten).
--
-- ZAEHLER: unveraendert (reine Daten-UPDATE, public — migrations/README.md Kural 6)
--
-- WARUM. Der Wert aus dem Kassen-Auswahlfeld wird als prescriptions.kostentraeger_ik
-- gespeichert und im DTA als "IK des Kostenträgers" gesendet. Gegen die echte
-- Kostenträgerdatei (Q3/2026, 7 Dateien, wissensbank/gemeinsam/kostentraeger/) geprüft:
--   * 9 gefüllte IKs existieren dort GAR NICHT (Reste des alten Mock-Seeds).
--     NULL blockiert sichtbar, eine erfundene IK würde gesendet — schlimmer als NULL.
--   * 4 Einzelkassen tragen keine IK, haben aber genau EINEN Kostenträger.
-- Fachurteil gkv-302, Entscheidung Konsey 21.09.2026 (konsey/tutanak/2026-09-21-
-- krankenkassen-ik-nachtrag.md). Bewusst NICHT hier: Kassen mit mehreren echten IKs
-- (AOK BW, AOK NordWest, IKK, mkk, SBK …) — dort hängt die IK an der Versichertenkarte,
-- ein Standardwert wäre geraten. Sie bleiben NULL.
--
-- ART DER ÄNDERUNG (je Zeile, siehe plan unten):
--   nachtragen: NULL      -> echte IK   (AOK Hessen, BERGISCHE, BKK firmus, Krones BKK)
--   ersetzen:   Mock-IK   -> echte IK   (Mobil, AOK Niedersachsen, AOK PLUS)
--   leeren:     Mock-IK   -> NULL       (AOK Nordost, IKK classic, AOK Rheinland/Hamburg,
--                                        BAHN-BKK, BIG direkt gesund, LKK)
--
-- SAAS UND KUNDENBOX. 0009 legt jede ik_number als NULL an. Im SaaS steht dort der Live-
-- Stand vom 21.09.2026 (76 gefüllt). Beide Ausgangslagen sind erlaubt: eine Zeile wird nur
-- angefasst, wenn sie NULL ist oder genau den erwarteten Altwert trägt. Alles andere bleibt
-- unberührt und schlägt in der Selbstprüfung an — die Datei läuft dann gar nicht.
--
-- ROLLBACK-QUELLE (Altwerte im SaaS, 21.09.2026). Kein down-Schritt (README Kural 3);
-- Rückweg ist eine neue Datei, die diese Werte per id zurückschreibt:
--   Mobil Krankenkasse                 107300000  ->  101520078
--   AOK Niedersachsen                  108310401  ->  102114819
--   AOK PLUS                           101000026  ->  107299005
--   AOK Nordost                        101000016  ->  NULL
--   IKK classic                        107708612  ->  NULL
--   AOK Rheinland/Hamburg              107436001  ->  NULL
--   BAHN-BKK                           101317994  ->  NULL
--   BIG direkt gesund                  107636345  ->  NULL
--   Landwirtschaftliche Krankenkasse   109006429  ->  NULL
--   (nachtragen-Zeilen waren NULL)
--
-- Jede Datei läuft in EINER Transaktion (README Kural 5): schlägt die Selbstprüfung an,
-- wird nichts geschrieben.

DO $mig$
DECLARE
  plan CONSTANT jsonb := '[
    {"id":"d76855d1-0510-4b65-b62a-3507926fc583","kasse":"AOK Hessen","neu":"105313145","alt":null},
    {"id":"bc23391b-684e-4fc5-91be-664ee3b900f3","kasse":"BERGISCHE KRANKENKASSE","neu":"104926702","alt":null},
    {"id":"e528a879-fde7-4856-8094-94d15bd1dcfb","kasse":"BKK firmus","neu":"102529638","alt":null},
    {"id":"528329d8-85c0-41fd-bd00-0c796b3dcd7f","kasse":"Krones BKK","neu":"108934142","alt":null},
    {"id":"17d750da-5de5-4ee6-89a9-d1256714a25f","kasse":"Mobil Krankenkasse","neu":"101520078","alt":"107300000"},
    {"id":"fc2ab98c-f1e0-465c-b5af-8bbfd5a27989","kasse":"AOK Niedersachsen","neu":"102114819","alt":"108310401"},
    {"id":"dd2a153b-e4c2-4bb8-b5e0-14ab51084848","kasse":"AOK PLUS","neu":"107299005","alt":"101000026"},
    {"id":"6b839faf-e036-403b-968d-ad3c2113b0c1","kasse":"AOK Nordost","neu":null,"alt":"101000016"},
    {"id":"bbfd8d19-f7e2-49de-95eb-17ac0d77d61c","kasse":"IKK classic","neu":null,"alt":"107708612"},
    {"id":"8153221c-8ac2-4232-a858-ca05aab11ed7","kasse":"AOK Rheinland/Hamburg","neu":null,"alt":"107436001"},
    {"id":"c10392ca-104f-4f92-ac6e-907a40a82395","kasse":"BAHN-BKK","neu":null,"alt":"101317994"},
    {"id":"59b43dc4-07f8-4809-ae86-7deb408c5a71","kasse":"BIG direkt gesund","neu":null,"alt":"107636345"},
    {"id":"897278ab-a1d5-454c-99bf-5c9230ae4a99","kasse":"Landwirtschaftliche Krankenkasse","neu":null,"alt":"109006429"}
  ]';
  abweichung text;
  ohne_ziel  text;
  uebrig     text;
BEGIN
  UPDATE public.krankenkassen k
     SET ik_number = p.neu
    FROM jsonb_to_recordset(plan) AS p(id uuid, kasse text, neu text, alt text)
   WHERE k.id = p.id
     AND (k.ik_number IS NULL OR k.ik_number = p.alt);

  -- Selbstprüfung 1: jede der 13 Zeilen steht auf dem Sollwert (fehlende Zeile zählt mit).
  SELECT string_agg(p.kasse || ' ist ' || coalesce(k.ik_number, 'NULL') || ', Soll ' || coalesce(p.neu, 'NULL'), '; ')
    INTO abweichung
    FROM jsonb_to_recordset(plan) AS p(id uuid, kasse text, neu text, alt text)
    LEFT JOIN public.krankenkassen k ON k.id = p.id
   WHERE k.id IS NULL OR k.ik_number IS DISTINCT FROM p.neu;
  IF abweichung IS NOT NULL THEN
    RAISE EXCEPTION '0040 krankenkassen_ik_nachtrag: Zeile weicht vom Sollwert ab: %', abweichung;
  END IF;

  -- Selbstprüfung 2: jede geschriebene IK ist ein echter Kostenträger (FK-Ziel von
  -- prescriptions.kostentraeger_ik, in SaaS und Kundenbox aus 0006 vorhanden).
  SELECT string_agg(p.kasse || ' ' || p.neu, '; ')
    INTO ohne_ziel
    FROM jsonb_to_recordset(plan) AS p(id uuid, kasse text, neu text, alt text)
   WHERE p.neu IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.kostentraeger t WHERE t.ik = p.neu AND t.datensatz_status = 'echt');
  IF ohne_ziel IS NOT NULL THEN
    RAISE EXCEPTION '0040 krankenkassen_ik_nachtrag: IK nicht in kostentraeger (echt): %', ohne_ziel;
  END IF;

  -- Selbstprüfung 3: keine der neun Mock-IKs steht mehr in krankenkassen.
  SELECT string_agg(k.name || ' ' || k.ik_number, '; ')
    INTO uebrig
    FROM public.krankenkassen k
   WHERE k.ik_number IN (SELECT p.alt FROM jsonb_to_recordset(plan) AS p(id uuid, kasse text, neu text, alt text) WHERE p.alt IS NOT NULL);
  IF uebrig IS NOT NULL THEN
    RAISE EXCEPTION '0040 krankenkassen_ik_nachtrag: Mock-IK steht noch: %', uebrig;
  END IF;
END
$mig$;
