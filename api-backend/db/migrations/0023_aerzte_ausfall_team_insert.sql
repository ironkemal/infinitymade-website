-- Ops-Karte #299 (Folge von S-30) — Team-Schreibrecht auf `aerzte` und
-- `ausfallrechnungen`.
--
-- SaaS: uygulandı 17.09.2026, MCP (Defter-Regel, README.md „SaaS'a hangi
--   migration'lar uygulandı?" — `migrate.js` laeuft auf der SaaS nicht, die
--   einzige Spur ist diese Zeile).
-- ZAEHLER: rls_policy +3 — drei CREATE POLICY, sonst KEIN DDL (keine Tabelle,
--   Funktion, Trigger, Index; nichts in storage.*/auth.*). Auf der SaaS-Live-DB
--   nachgezaehlt: aerzte 4 → 6, ausfallrechnungen 3 → 4. `erwartete-zaehler.json`
--   wurde entsprechend 154 → 157 gezogen — RECHNERISCH, nicht auf einer frischen
--   Box gemessen; `gemessen_am` bleibt deshalb der Messstand von 0022.
--
-- ANLASS: Die service_role-Pruefung S-30 hat zwei Routen gefunden, die mit dem
-- Service-Role-Client schreiben und dabei KEINE Rollenpruefung machen:
--   · `api-backend/lib/arzt-registry.js` (`resolveOrCreateArzt()`, INSERT+UPDATE
--     auf `aerzte`) — laeuft im Rezept-Scan, ausgeloest ueber
--     `POST /rezept/confirm` bzw. `/rezept/save`;
--   · `api-backend/billing/api/ausfall.routes.js` `POST /ausfall/create`
--     (INSERT auf `ausfallrechnungen`) — No-Show-Rechnung.
-- Beide Bildschirme sind in `nav-registry.js` fuer roles:['owner','employee']
-- freigegeben und werden taeglich benutzt. RLS sagte bisher "nur Inhaber", der
-- Service-Role-Client ging daran vorbei: der Angestellte KONNTE es laengst, nur
-- stand es nirgends.
--
-- ENTSCHEIDUNG (Kemal, 17.09.2026): nicht die Routen auf 403 setzen, sondern
-- RLS an das tatsaechliche, gewollte Verhalten angleichen. Eine 403 haette hier
-- keine Luecke geschlossen, sondern zwei laufende Arbeitsablaeufe gebrochen —
-- der Angestellte, der das Rezept scannt, ist derselbe, der den Arzt anlegen
-- muss; wer den ausgefallenen Termin aufnimmt, ist derselbe, der die
-- Ausfallrechnung schreibt.
--
-- ⚠️ MANDANTENBEZUG STRIKT UEBER `profiles.owner_id`, NIE ueber `business_id` —
--   gleiche Begruendung wie in 0022: ein Einzelpraxis-Inhaber hat gar keine
--   `businesses`-Zeile, `business_id` ist eine Standort-, keine
--   Mandantenspalte.
--
-- ⚠️ ADDITIV. Die bestehenden Owner-Policies werden NICHT angefasst.
--   PERMISSIVE Policies werden ODER-verknuepft; niemandem wird etwas entzogen,
--   und ein Rueckbau heisst schlicht: die drei neuen Policies droppen.

-- --- aerzte: INSERT + UPDATE fuers Team -------------------------------
-- `aerzte` ist ein Stammdatenregister (Name, LANR, BSNR, Anschrift), keine
-- Behandlungsdokumentation — kein Art.-9-Datum des Patienten, also auch keine
-- § 630f-BGB-Frage. Das Team darf die Tabelle seit jeher LESEN
-- (`aerzte_select_owner`); ohne Schreibrecht sieht der Angestellte beim Scan
-- einen Arzt, den er nicht anlegen darf, obwohl der Datensatz direkt aus dem
-- Rezept vor ihm stammt.
--
-- UPDATE ist hier bewusst mitentschieden und nicht die Ausnahme: der
-- Normalfall in `resolveOrCreateArzt()` ist die ANREICHERUNG eines vorhandenen
-- Eintrags (LANR-Treffer → fehlende Felder nachtragen,
-- `api-backend/lib/arzt-registry.js:132`). Ohne UPDATE waere der haeufigere
-- der beiden Pfade gesperrt und das INSERT-Recht damit halb wertlos.
--
-- ⛔ KEIN DELETE — `aerzte_delete_owner` bleibt unangetastet beim Inhaber.
--   Ein geloeschter Arzt reisst die Auswertung „welcher Arzt ueberweist wie
--   viel" auf und ist aus der Verordnung heraus nicht wiederherstellbar.
--   Loeschen ist ausserdem nie Teil des Scan-Ablaufs.
--
-- Der EXISTS-Ausdruck im WITH CHECK ist die eigentliche Mandantensperre: ohne
-- ihn koennte ein Angestellter Zeilen unter fremder `owner_id` anlegen bzw.
-- eine Zeile aus dem Mandanten herausschreiben. Deshalb steht er beim UPDATE
-- in USING *und* WITH CHECK.

DROP POLICY IF EXISTS "Employees can insert team aerzte" ON public.aerzte;
CREATE POLICY "Employees can insert team aerzte"
  ON public.aerzte
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = aerzte.owner_id
    )
  );

DROP POLICY IF EXISTS "Employees can update team aerzte" ON public.aerzte;
CREATE POLICY "Employees can update team aerzte"
  ON public.aerzte
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = aerzte.owner_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = aerzte.owner_id
    )
  );

-- --- ausfallrechnungen: NUR INSERT fuers Team --------------------------
-- Anlegen darf das Team, weil der Ausfall an der Anmeldung entsteht und dort
-- auch erfasst wird (`handleDirectAusfallrechnung()` → `POST /ausfall/create`).
-- Die Frist- und Betragslogik liegt nicht im Ermessen des Erfassenden: Hoehe
-- und Hinweistext kommen aus `profiles.ausfall_*` des Inhabers,
-- `pruefeAusfallFrist()` entscheidet ueber die Fristwahrung.
--
-- ⛔ KEIN UPDATE — `ausfallrechnungen_update` bleibt owner-only, und das ist
--   die eigentliche Grenze: UPDATE ist hier der Statuswechsel
--   offen → bezahlt | storniert | abgeschrieben, also eine Geldaussage.
--   „Bezahlt" setzen heisst eine Forderung fuer erledigt erklaeren,
--   „abgeschrieben" heisst darauf verzichten. Die passende Code-Sperre steht
--   seit 17.09.2026 in `PATCH /ausfall/:id/status`
--   (`profile.role !== 'owner'` → 403, Commit 9ac1978); RLS und Route sagen
--   damit dasselbe.
--
-- ⛔ KEIN DELETE — gab es vorher nicht und kommt auch jetzt nicht dazu: eine
--   vergebene Rechnungsnummer (Nummernkreis `ausfallrechnung`, siehe 0003)
--   verschwindet nicht.

DROP POLICY IF EXISTS "Employees can insert team ausfallrechnungen" ON public.ausfallrechnungen;
CREATE POLICY "Employees can insert team ausfallrechnungen"
  ON public.ausfallrechnungen
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = ausfallrechnungen.owner_id
    )
  );
